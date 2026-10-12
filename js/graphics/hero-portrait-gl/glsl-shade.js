"use strict";

// Pilot portrait renderer, part 3/4: materials, lighting and the two shader passes
// (pass A raymarches the scene at 2x; pass B pixelates, outlines and quantises to a small palette).
HP_GLSL.shade = `
uniform sampler2D uGAlb, uGNrm, uGDepth;
// Sphere tracing; stops at tmax (the scanned head, rasterised beforehand): returns (-2, 0) when the scan is reached first.
vec2 march(vec3 ro, vec3 rd, float t0, float tmax, out float t) {
    t = t0; vec2 h = vec2(1.0, 0.0);
    for (int i = 0; i < 110; i++) {
        h = map(ro + rd * t);
        if (h.x < 0.0007) return h;
        t += h.x * 0.85;
        if (t >= tmax) { t = tmax; return vec2(-2.0, 0.0); }
        if (t > 5.2) break;
    }
    return vec2(-1.0, 0.0);
}
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0016, -0.0016);
    return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}
float softShadow(vec3 ro, vec3 rd) {
    gNoGlass = true;
    float res = 1.0, t = 0.02;
    for (int i = 0; i < 22; i++) {
        float h = map(ro + rd * t).x;
        res = min(res, 9.0 * h / t);
        t += clamp(h, 0.012, 0.1);
        if (res < 0.02 || t > 1.3) break;
    }
    gNoGlass = false;
    return clamp(res, 0.0, 1.0);
}
float calcAO(vec3 p, vec3 n) {
    gNoGlass = true;
    float occ = 0.0, w = 1.0;
    for (int i = 1; i <= 5; i++) { float h = 0.012 * float(i * i); occ += (h - map(p + n * h).x) * w; w *= 0.7; }
    gNoGlass = false;
    return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }

// skin relief: pores, forehead lines, crow's feet (stronger on men)
float skinHeight(vec3 ph) {
    float fem = uA.x, age = mix(1.0, 0.45, fem);
    float h = 0.5 * vnoise(ph * 105.0) + 0.5 * vnoise(ph * 42.0);
    float fore = smoothstep(0.1, 0.16, ph.y) * smoothstep(0.2, 0.3, ph.z) * smoothstep(0.34, 0.26, ph.y + 0.0);
    h += age * 0.55 * fore * (0.5 + 0.5 * sin(ph.y * 150.0 + vnoise(ph * 9.0) * 3.0));
    vec3 e = vec3(abs(ph.x), ph.y, ph.z) - vec3(0.165, 0.0, 0.222);
    float cf = smoothstep(0.075, 0.05, length(e.xy - vec2(0.09, 0.0))) * step(0.07, e.x);
    h += age * 0.5 * cf * (0.5 + 0.5 * sin(atan(e.y, e.x - 0.09) * 15.0));
    return h;
}
vec3 bumpNormal(vec3 n, vec3 ph, float amp) {
    const float e = 0.0035;
    float h0 = skinHeight(ph);
    vec3 g = vec3(skinHeight(ph + vec3(e, 0, 0)) - h0, skinHeight(ph + vec3(0, e, 0)) - h0, skinHeight(ph + vec3(0, 0, e)) - h0) / e;
    return normalize(n - amp * (g - n * dot(g, n)));
}

vec3 skinAlbedo(vec3 ph) {
    float fem = uA.x;
    vec3 s = vec3(abs(ph.x), ph.y, ph.z);
    vec3 c = uSkin * (0.92 + 0.16 * vnoise(ph * 8.0)) * (1.0 - 0.08 * vnoise(ph * 80.0));
    float front = step(0.2, ph.z);
    float lk = mix(0.95, 1.35, fem);
    float lipD = min(sdEll(ph - vec3(0.0, -0.265, 0.345), vec3(0.078, 0.019 * lk, 0.036)), sdEll(ph - vec3(0.0, -0.302, 0.345), vec3(0.070, 0.024 * lk, 0.040)));
    float lipM = smoothstep(0.007, -0.003, lipD) * front;
    float br = dot(uSkin, vec3(0.33));
    c = mix(c, vec3(0.66, 0.27, 0.25) * (0.55 + 0.9 * br), lipM * mix(0.38, 0.6, fem));
    c = mix(c, c * 0.3, smoothstep(0.005, 0.0, abs(ph.y + 0.282) - 0.003) * step(abs(ph.x), 0.082) * front);
    // eyelid lash line + eye bags + crease
    vec3 e = s - vec3(0.165, 0.0, 0.222);
    float eyeSize = mix(1.0, 1.2, fem) * (isFac(2.0) ? 1.18 : 1.0);
    float lidC = mix(-0.008, -0.034, uBlink), lidH = mix(0.0165, 0.003, uBlink) * eyeSize * (1.0 + 0.1 * fem);
    vec2 o = vec2(e.x / (0.06 * eyeSize), (e.y - lidC - e.x * 0.12) / lidH);
    float rim = abs(length(o) - 1.0) * 0.04;
    c = mix(c, vec3(0.03, 0.02, 0.02), smoothstep(0.0075, 0.002, rim) * step(0.0, e.z + 0.03) * (1.0 + 0.4 * fem));
    c *= 1.0 - 0.13 * smoothstep(0.03, 0.0, length(vec2(e.x * 0.7, e.y + 0.075)) - 0.03) * front * (1.0 - 0.4 * fem);
    c *= 1.0 - 0.18 * smoothstep(0.006, 0.0, abs(e.y - 0.062 - 0.2 * e.x * 0.0) - 0.002) * step(abs(e.x), 0.07) * front;
    c *= 1.0 - 0.2 * smoothstep(0.11, 0.03, length(vec2(e.x * 0.75, e.y - 0.0))) * front;
    c = mix(c, c * vec3(0.9, 0.84, 0.95), 0.4 * smoothstep(0.05, 0.015, abs(length(vec2(e.x * 0.8, e.y + 0.075)) - 0.04)) * front);
    c.r *= 1.0 + 0.06 * smoothstep(0.08, 0.02, length(ph.xy - vec2(0.0, -0.14))) * front;
    // brows
    if (!isFac(2.0) && !isFac(4.0)) {
        float bx = s.x;
        float by = 0.097 + 0.026 * sin(clamp((bx - 0.04) / 0.24, 0.0, 1.0) * 3.14159) + fem * 0.012;
        float th = (0.0125 + 0.0035 * uC.y) * (1.0 - 0.35 * fem) * (0.55 + 0.45 * smoothstep(0.04, 0.10, bx) * (1.0 - smoothstep(0.2, 0.275, bx)));
        float bm = smoothstep(th, th * 0.45, abs(s.y - by)) * step(0.035, bx) * step(bx, 0.278) * step(0.22, ph.z);
        c = mix(c, uHair * 0.75 * (0.8 + 0.4 * vnoise(ph * 120.0)), bm * 0.92);
    }
    // nasolabial fold, frown lines
    float nl = segD(s.xy, vec2(0.07, -0.175), vec2(0.098, -0.268));
    c *= 1.0 - mix(0.14, 0.07, fem) * smoothstep(0.007, 0.0, nl) * front;
    c *= 1.0 - (1.0 - fem) * 0.16 * smoothstep(0.004, 0.0, abs(s.x - 0.022)) * step(0.1, ph.y) * step(ph.y, 0.17) * front;
    // stubble / beard
    int bd = int(uB.z + 0.5);
    bool stub = bd == 2 || (isFac(3.0) && bd == 0);
    float lower = smoothstep(-0.12, -0.2, ph.y) * smoothstep(-0.05, 0.1, ph.z) * (1.0 - lipM);
    float moustache = smoothstep(0.045, 0.02, abs(ph.x)) * 0.0;
    float hs = hash1(floor(ph * 150.0));
    if (stub) c = mix(c, uHair * 0.45 + c * 0.35, lower * 0.75 * step(hs, 0.5));
    if (bd == 3) {
        float m2 = smoothstep(-0.15, -0.21, ph.y) * smoothstep(-0.05, 0.1, ph.z);
        m2 = max(m2, smoothstep(0.1, 0.06, abs(ph.x)) * smoothstep(-0.21, -0.235, -ph.y) * step(-0.24, ph.y) * front);
        c = mix(c, uHair * (0.8 + 0.5 * vnoise(ph * vec3(70.0, 24.0, 70.0))), m2 * 0.85 * (1.0 - lipM * 0.8));
    }
    // scars
    int sc = int(uB.w + 0.5);
    vec3 scarC = c * vec3(1.15, 0.75, 0.75) + vec3(0.05, 0.0, 0.0);
    if (sc == 1) c = mix(c, scarC, smoothstep(0.007, 0.002, segD(s.xy, vec2(0.05, 0.15), vec2(0.20, -0.11))) * front * (ph.x > 0.0 ? 1.0 : 0.0));
    if (sc == 2) c = mix(c, scarC, smoothstep(0.007, 0.002, segD(s.xy, vec2(0.20, -0.12), vec2(0.30, -0.22))) * front * (ph.x > 0.0 ? 1.0 : 0.0));
    if (sc == 3) c = mix(c, vec3(0.5, 0.25, 0.2) * (0.7 + 0.6 * vnoise(ph * 90.0)), smoothstep(0.075, 0.03, length(ph.xy - vec2(0.2, -0.10))) * front * vnoise(ph * 40.0));
    return c;
}

vec3 eyeAlbedo(vec3 ph, out float emis) {
    emis = 0.0;
    vec3 e = ph - vec3(sign(ph.x) * 0.165, 0.0, 0.222 - 0.012 * step(0.0, ph.x));
    float eyeSize = mix(1.0, 1.12, uA.x) * (isFac(2.0) ? 1.18 : 1.0);
    vec2 g = uGaze * 0.02 * eyeSize;
    vec2 d = e.xy - g;
    float r = length(d - vec2(0.0, -0.006)) / (0.0265 * eyeSize);
    if (e.z < 0.0) r = 9.0;
    float ang = atan(d.y, d.x);
    vec3 sclera = isFac(1.0) ? vec3(0.62, 0.55, 0.28) : isFac(2.0) ? vec3(0.03, 0.03, 0.05) : vec3(0.62, 0.57, 0.52);
    sclera *= mix(0.5, 1.0, smoothstep(0.035, -0.025, e.y)) * mix(0.8, 1.0, smoothstep(0.0, 0.05, abs(e.x)));
    vec3 iris = uEye * (0.55 + 0.75 * vnoise(vec3(ang * 3.2, r * 4.5, 1.0)));
    iris *= mix(1.0, 0.45, smoothstep(0.72, 1.0, r));
    iris = mix(iris, uEye * 1.5, 0.35 * smoothstep(0.55, 0.3, r));
    vec3 c = mix(iris, sclera, smoothstep(0.92, 1.04, r));
    c = mix(c, isFac(1.0) ? vec3(0.45, 0.05, 0.04) : vec3(0.015), smoothstep(0.5, 0.42, r));
    if (isFac(2.0)) emis = 0.35 * smoothstep(1.0, 0.5, r);
    return c;
}

vec3 matAlbedo(float m, vec3 ph, vec3 p, out float rough, out float spec, out float sss, out float emis) {
    rough = 0.6; spec = 0.15; sss = 0.0; emis = 0.0;
    if (m < 1.5) { sss = 1.0; rough = 0.55; spec = 0.13; return skinAlbedo(ph); }
    if (m < 2.5) { rough = 0.1; spec = 0.0; return eyeAlbedo(ph, emis); }
    if (m < 3.5) {
        spec = 0.55; rough = 0.35;
        vec3 c = uPaint;
        c *= 1.0 - 0.28 * smoothstep(0.465, 0.5, abs(fract(ph.y * 7.0 + 0.2) - 0.5) + 0.5) * step(0.1, ph.y);
        c = mix(c, uTrim * 0.9, smoothstep(0.016, 0.01, abs(ph.x)) * step(0.15, ph.y));
        float scuff = smoothstep(0.58, 0.8, vnoise(p * vec3(70.0, 14.0, 70.0))) * 0.4 + smoothstep(0.7, 0.85, vnoise(p * 22.0)) * 0.3;
        return mix(c * (0.9 + 0.12 * vnoise(p * 30.0)), c * 0.45 + vec3(0.05), scuff);
    }
    if (m < 4.5) { spec = 0.5; rough = 0.3; return vec3(0.11, 0.12, 0.145) + uTrim * 0.05; }
    if (m < 5.5) {
        float weave = 0.9 + 0.1 * sin(p.x * 260.0) * sin(p.y * 260.0);
        vec3 c = uCloth * weave;
        float badge = smoothstep(0.0, 0.01, 0.065 - length(p.xy - vec2(0.40, -0.98))) * step(0.0, p.z);
        c = mix(c, uTrim * 0.8, badge * 0.9);
        if (isFac(3.0)) {
            float band = segD(p.xy, vec2(-0.62, -0.78), vec2(0.58, -1.38));
            c = mix(c, vec3(0.16, 0.10, 0.07), smoothstep(0.05, 0.04, band));
            float dots = step(0.5, fract(dot(p.xy, vec2(0.86, -0.5)) * 14.0)) * smoothstep(0.012, 0.006, abs(band - 0.0) - 0.0);
            c = mix(c, vec3(0.8, 0.62, 0.2), dots * smoothstep(0.03, 0.02, band));
        }
        sss = 0.0; spec = 0.05;
        return c;
    }
    if (m < 6.5) { spec = 0.28; rough = 0.45; return uHair * (0.75 + 0.5 * vnoise(vec3(ph.x * 60.0, ph.y * 5.0, ph.z * 60.0))); }
    if (m < 7.5) return vec3(0.1, 0.2, 0.28);
    if (m < 8.5) { spec = 0.3; rough = 0.4; return uTrim * 0.55 * (0.85 + 0.2 * vnoise(p * 50.0)); }
    if (m < 10.5) { spec = 0.02; return vec3(0.34, 0.24, 0.14) * (0.5 + 0.9 * vnoise(p * 70.0)); }
    if (m < 11.5) { emis = 1.0; return (ph.y > 0.6 ? vec3(1.0, 0.18, 0.12) : isFac(4.0) && ph.y < 0.2 ? uEye : uAcc) * 1.6; }
    if (m < 12.5) { spec = 0.05; vec3 c = isFac(3.0) ? vec3(0.55, 0.07, 0.07) : uTrim * 0.7; return c * (0.94 + 0.07 * sin((p.x + p.y) * 160.0)); }
    if (m < 13.5) { spec = 0.9; rough = 0.2; return vec3(0.86, 0.66, 0.22); }
    if (m < 14.5) { spec = 0.2; return vec3(0.86, 0.83, 0.7); }
    if (m > 17.5) {                                                // voidborn flesh: mauve-grey, pores, folds, glowing veins
        spec = 0.22; rough = 0.45;
        float tex = uC.y, tr = uC.z;
        vec3 c = mix(vec3(0.46, 0.38, 0.42), uSkin * 0.9, 0.35) * (0.8 + 0.4 * vnoise(p * 9.0));
        float crev = smoothstep(0.55, 0.85, vnoise(p * 24.0));
        c = mix(c, vec3(0.1, 0.04, 0.09), crev * (0.35 + 0.2 * tex));
        if (tex > 0.5 && tex < 1.5) c = mix(c, vec3(0.05, 0.02, 0.05), smoothstep(0.76, 0.84, vnoise(p * 55.0)));                    // pores
        if (tex > 1.5) c *= 0.75 + 0.35 * smoothstep(0.2, 0.8, abs(sin(p.y * 40.0 + vnoise(p * 7.0) * 6.0)));                       // folds
        float chit = uB.w;
        if (chit > 0.5) c *= 0.8 + 0.3 * smoothstep(0.3, 0.7, abs(sin((p.y + 0.3 * vnoise(p * 5.0)) * (chit > 2.5 ? 16.0 : 30.0))));
        float vein = smoothstep(0.02, 0.0, abs(vnoise(p * 15.0 + 3.0) - 0.5));
        emis = vein * (0.2 + 0.4 * tr);
        c = mix(c, uEye * (0.8 + tr), vein * (0.35 + 0.3 * tr));
        c = mix(c, uEye * 0.35 + vec3(0.1, 0.03, 0.08), tr * 0.25 * (1.0 - vein));
        return c;
    }
    if (m > 16.5) { emis = 1.0; return uEye * 1.25 + vec3(0.15); }
    if (m > 15.5) { spec = 0.1; return vec3(0.035, 0.035, 0.04); }
    // 15: android faceplate
    spec = 0.5; rough = 0.3;
    vec3 c = uSkin * 0.85 * (0.9 + 0.15 * vnoise(ph * 40.0));
    float seam = smoothstep(0.004, 0.0015, abs(ph.x)) + smoothstep(0.004, 0.0015, abs(ph.y + 0.13)) + smoothstep(0.004, 0.0015, abs(abs(ph.x) - 0.2)) * step(ph.y, 0.1);
    return mix(c, vec3(0.04), clamp(seam, 0.0, 1.0) * step(0.1, ph.z + 0.4));
}

vec3 lighting(vec3 p, vec3 n, vec3 rd, vec3 alb, float rough, float specK, float sss, float emis, bool eye) {
    vec3 L1 = normalize(vec3(-0.72, 0.5, 0.62)), L2 = normalize(vec3(0.85, 0.05, 0.35)), L3 = normalize(vec3(0.5, 0.35, -0.7));
    float sh = softShadow(p + n * 0.012, L1);
    float ao = calcAO(p, n);
    float wrap = 0.2 + 0.25 * sss;
    float d1 = clamp((dot(n, L1) + wrap) / (1.0 + wrap), 0.0, 1.0);
    vec3 key = vec3(1.0, 0.92, 0.82) * 1.55 * d1 * mix(0.1, 1.0, sh);
    vec3 fill = (uAcc * 0.5 + vec3(0.08, 0.11, 0.2)) * max(dot(n, L2), 0.0) * 0.42;
    vec3 amb = vec3(0.03, 0.04, 0.07) * (0.65 + 0.35 * n.y);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * clamp(dot(n, L3) * 0.7 + 0.5, 0.0, 1.0);
    vec3 col = alb * (key + fill + amb) * ao + uAcc * rim * 0.8 * ao;
    col += alb * vec3(0.55, 0.1, 0.04) * sss * pow(1.0 - d1, 2.0) * d1 * 1.6 * ao;
    vec3 hv = normalize(L1 - rd);
    float sp = pow(max(dot(n, hv), 0.0), mix(10.0, 70.0, 1.0 - rough)) * specK * sh;
    col += vec3(1.0, 0.95, 0.9) * sp;
    if (eye) col += vec3(1.0) * pow(max(dot(n, hv), 0.0), 220.0) * 2.2 * sh;
    col += alb * emis;
    return col;
}

vec3 shadeMesh(vec3 p, vec3 rd, ivec2 px) {
    vec4 ga = texelFetch(uGAlb, px, 0), gn = texelFetch(uGNrm, px, 0);
    vec3 n = normalize(gn.xyz * 2.0 - 1.0);
    return lighting(p, n, rd, ga.rgb, 0.55, gn.a, gn.a < 0.3 ? 1.0 : 0.0, 0.0, false);
}
vec3 shadePoint(vec3 p, vec3 n, vec3 rd, float m) {
    vec3 ph = headUndeform(headSpace(p));
    float rough, spec, sss, emis;
    vec3 alb = matAlbedo(m, ph, p, rough, spec, sss, emis);
    if (m < 1.5) n = bumpNormal(n, ph, mix(0.0042, 0.0024, uA.x));
    return lighting(p, n, rd, alb, rough, spec, sss, emis, m > 1.5 && m < 2.5);
}

vec3 background(vec2 uv) {
    float g = smoothstep(1.15, 0.0, length((uv - vec2(0.35, 0.25)) * vec2(1.0, 0.9)));
    // Keep the portrait backdrop in deliberate pixel-art bands instead of a
    // soft photographic gradient.
    g = floor(g * 7.0 + 0.5) / 7.0;
    return mix(vec3(0.018, 0.026, 0.05), uAcc * 0.16 + vec3(0.02, 0.03, 0.06), g) * (1.0 - 0.45 * dot(uv, uv) * 0.4);
}

out vec4 outColor;
void main() {
    vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
    float aspect = uRes.x / uRes.y;
    const float halfH = 0.74, cy = -0.10;
    vec3 ro = vec3(0.0, cy, 3.4);
    vec3 target = vec3(uv.x * halfH * aspect, uv.y * halfH + cy, 0.0);
    vec3 rd = normalize(target - ro);
    ivec2 px = ivec2(gl_FragCoord.xy);
    float tm = 1e5;
    if (uMesh > 0.5 && texelFetch(uGAlb, px, 0).a > 0.5) tm = (texelFetch(uGDepth, px, 0).r * 3.2 + 2.0) / (-rd.z);
    float t;
    vec2 h = march(ro, rd, 2.0, tm, t);
    vec3 col; float dn = 1.0;
    if (h.x < -1.5) {
        col = shadeMesh(ro + rd * tm, rd, px);
        dn = clamp((tm - 2.4) / 2.2, 0.0, 1.0);
    } else if (h.x < 0.0) {
        col = background(uv);
    } else {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        col = shadePoint(p, n, rd, h.y);
        dn = clamp((t - 2.4) / 2.2, 0.0, 1.0);
        if (abs(h.y - 7.0) < 0.5) {                                   // glass: look through at what is behind
            float t2;
            float tt = 0.02;                                           // step out through the glass thickness (also at oblique angles)
            for (int i = 0; i < 14; i++) { vec2 mm = map(p + rd * tt); if (mm.x > 0.003 || abs(mm.y - 7.0) > 0.5) break; tt += 0.012; }
            vec3 p2 = p + rd * tt;
            vec2 h2 = march(p2, rd, 0.0, max(tm - t - tt, 0.0), t2);
            vec3 behind;
            if (h2.x < -1.5 && tm < 1e4) behind = shadeMesh(p2 + rd * t2, rd, px);
            else if (h2.x < 0.0) behind = background(uv);
            else if (h2.x < 0.0) behind = background(uv);
            else { vec3 q = p2 + rd * t2; behind = shadePoint(q, calcNormal(q), rd, abs(h2.y - 7.0) < 0.5 ? 4.0 : h2.y); }
            vec3 tint = vec3(0.08, 0.2, 0.3) + uAcc * 0.25;
            float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
            float glare = smoothstep(0.1, 0.0, abs((p.x * 0.8 + p.y * 0.6) + 0.12) - 0.05);    // one soft diagonal reflection
            col = mix(behind, tint, 0.05) + uAcc * fres * 0.05 + vec3(0.75, 0.88, 1.0) * glare * 0.035 + vec3(1.0) * pow(max(dot(n, normalize(vec3(-0.55, 0.55, 0.65) - rd)), 0.0), 140.0) * 0.25;
        }
    }
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(vec3(lum), col, 0.72) + vec3(-0.006, 0.004, 0.014) * (1.0 - smoothstep(0.0, 0.5, lum));   // muted, cool shadows
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));
    outColor = vec4(col, dn);
}
`;

HP_GLSL.vert = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }
`;
