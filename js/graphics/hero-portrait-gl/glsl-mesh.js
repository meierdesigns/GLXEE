"use strict";

// Pilot portrait renderer, part 6: head-scan mesh pass. The scan is mapped onto the same landmarks as the SDF head
// (eyes at y=0, nose tip y=-0.15, mouth y=-0.28, chin y=-0.52), deformed per sex/faction, posed like the SDF head,
// and rasterised into a G-buffer (albedo, world normal, depth) that the scene pass shades together with the SDF parts.
HP_GLSL.meshCommon = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uYaw, uPitch, uBlink;
uniform vec4 uA, uB, uC;
uniform vec4 uD, uE;
uniform float uPass;   // 0 = head, 1 = mask shell, 2 = visor shell (the scan inflated a little and clipped to a region)   // shape sliders in -1..1: width, length, jaw, chin / cheekbones, nose size
const vec3 PIV = vec3(0.0, -0.52, -0.04);
const float HALF_H = 0.74, CY = -0.10, CAM = 3.4;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 headToWorldDir(vec3 d) { d.xz = rot(-uYaw) * d.xz; d.yz = rot(-uPitch) * d.yz; return d; }
vec3 headToWorld(vec3 h) { return headToWorldDir(h - PIV) + PIV; }
bool isFac(float f) { return abs(uA.y - f) < 0.5; }
`;

HP_GLSL.meshVert = HP_GLSL.meshCommon + HP_GLSL.deform + `
in vec3 aPos; in vec3 aNrm; in vec2 aUv;
out vec3 vH; out vec3 vU; out vec3 vW; out vec3 vNw; out vec2 vUv;
void main() {
    vec3 w0 = vec3(aPos.x * 0.215, (aPos.y - 1.72) * 0.215, (aPos.z - 0.26) * 0.18);
    if (uPass > 0.5) w0 += normalize(aNrm / vec3(0.215, 0.215, 0.18)) * (uPass < 1.5 ? 0.034 : 0.03);
    vec3 w = headDeform(w0);
    vU = w0;
    vH = w;
    vec3 nh = normalize(aNrm / vec3(0.215, 0.215, 0.18));
    vNw = headToWorldDir(nh);
    vec3 p = headToWorld(w);
    vW = p; vUv = aUv;
    float dz = CAM - p.z, aspect = uRes.x / uRes.y;
    float k = CAM / dz;
    gl_Position = vec4(p.x / (HALF_H * aspect) * k * dz, (p.y - CY) / HALF_H * k * dz, ((dz - 2.0) / 1.6 - 1.0) * dz, dz);
}
`;

HP_GLSL.meshFrag = HP_GLSL.meshCommon + `
uniform sampler2D uCol, uNrmMap;
uniform vec3 uSkin, uHair, uCloth, uTrim;
in vec3 vH; in vec3 vU; in vec3 vW; in vec3 vNw; in vec2 vUv;
layout(location = 0) out vec4 oAlb;
layout(location = 1) out vec4 oNrm;
float hash1(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
    float fem = uA.x;
    bool voidb = isFac(2.0), mach = isFac(4.0), kron = isFac(1.0);
    vec3 s = vec3(abs(vU.x), vU.y, vU.z);          // landmark space: the eye holes move with the mesh
    if (vH.y < -0.84) discard;
    if (uPass > 0.5) {
        if (!gl_FrontFacing) discard;
        float ex = abs(vU.x);
        vec3 col; float spec = 0.4;
        if (uPass < 1.5) {                                       // oxygen mask: moulded cup over nose and mouth
            int mk = int(uB.y + 0.5);
            float top = (mk == 2 ? -0.17 : -0.07) - 0.28 * ex;
            float lo = mk == 3 ? -0.42 : -0.38;
            if (vU.y > top || vU.y < lo - 0.1 * ex || ex > (mk == 2 ? 0.2 : 0.25) || vU.z < 0.0) discard;
            col = mk == 3 ? vec3(0.12, 0.14, 0.12) + uTrim * 0.05 : vec3(0.1, 0.11, 0.135) + uTrim * 0.05;
            float edge = min(abs(vU.y - top), min(abs(vU.y - (lo - 0.1 * ex)), abs(ex - (mk == 2 ? 0.2 : 0.25))));
            col = mix(col, uTrim * 0.8, smoothstep(0.014, 0.004, edge));
            float vent = smoothstep(0.04, 0.03, length(vec2(ex - 0.12, vU.y + 0.3)));
            float slit = step(0.5, fract(vU.y * 60.0)) * step(ex, 0.05) * step(-0.36, vU.y) * step(vU.y, -0.24);
            col = mix(col, vec3(0.02), max(vent, slit) * 0.8);
            col *= 0.8 + 0.3 * smoothstep(0.0, 0.2, vU.z);
        } else {                                                 // scanner visor band across the eyes
            if (vU.y > 0.075 || vU.y < -0.07 || ex > 0.31 || vU.z < 0.0) discard;
            col = vec3(0.03, 0.06, 0.1) + uTrim * 0.04;
            col += vec3(0.1, 0.45, 0.6) * smoothstep(0.02, 0.0, abs(vU.y - 0.0)) * 0.7;
            spec = 0.8;
        }
        oAlb = vec4(col, 1.0);
        oNrm = vec4(normalize(vNw) * 0.5 + 0.5, spec);
        return;
    }
    // eye opening: eyelids are the scan's closed lids around this hole (same formula as the SDF eyes)
    float lash = 0.0;
    if (!mach) {
        float eyeSize = mix(1.0, 1.2, fem) * (voidb ? 1.18 : 1.0);
        vec3 e = s - vec3(0.165, 0.0, 0.222 - 0.012 * step(0.0, vU.x));
        float lidC = mix(-0.008, -0.034, uBlink), lidH = mix(0.0165, 0.003, uBlink) * eyeSize * (1.0 + 0.1 * fem);
        vec2 o = vec2(e.x / (0.06 * eyeSize), (e.y - lidC - e.x * 0.12) / lidH);
        float lo = length(o);
        if (lo < 1.0 && s.z > 0.2) discard;
        lash = smoothstep(1.35, 1.0, lo) * step(0.2, s.z);
    }
    vec3 N = normalize(vNw);
    if (!gl_FrontFacing) { oAlb = vec4(0.012, 0.01, 0.012, 1.0); oNrm = vec4(-N * 0.5 + 0.5, 0.0); return; }
    // tangent frame from screen-space derivatives
    vec3 dp1 = dFdx(vW), dp2 = dFdy(vW); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
    vec3 d2p = cross(dp2, N), d1p = cross(N, dp1);
    vec3 T = d2p * du1.x + d1p * du2.x, B = d2p * du1.y + d1p * du2.y;
    float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
    vec3 nm = texture(uNrmMap, vUv).xyz * 2.0 - 1.0;
    nm.xy *= mix(0.6, 0.35, fem) * (voidb ? 0.4 : 1.0);   // calmer skin: fewer pores, bigger planes
    N = normalize(mat3(T * im, B * im, N) * nm);
    // albedo: retint the scan colour map to the chosen skin tone, keep its detail (pores, brows, stubble)
    vec3 tex = pow(textureLod(uCol, vUv, 1.5).rgb, vec3(2.2));
    float lum = dot(tex, vec3(0.3, 0.59, 0.11));
    bool beard = int(uB.z + 0.5) >= 2 || (isFac(3.0) && int(uB.z + 0.5) == 0);
    float lower = smoothstep(-0.1, -0.16, vH.y) * smoothstep(-0.55, -0.45, vH.y) * step(0.0, vH.z);
    float blurAmt = beard ? fem : 1.0;
    if (blurAmt > 0.01) {                                        // no stubble (or a woman): use the blurred, smooth skin there
        vec3 blur = pow(textureLod(uCol, vUv, 5.0).rgb, vec3(2.2));
        tex = mix(tex, blur, lower * blurAmt);
        lum = dot(tex, vec3(0.3, 0.59, 0.11));
    }
    float ln = lum / 0.5;
    vec3 chroma = tex / max(lum, 0.02);
    vec3 alb = uSkin * ln * mix(vec3(1.0), chroma, 0.45);
    float red = chroma.r - chroma.g;
    float dark = smoothstep(0.34, 0.12, lum) * (1.0 - smoothstep(0.35, 0.65, red));   // brows and stubble, not the lips
    alb = mix(alb, uHair * (0.5 + ln * 0.8), dark * (voidb ? 0.2 : 0.7));
    alb = mix(alb, alb * vec3(1.3, 0.78, 0.84), smoothstep(0.6, 0.95, red) * fem * 0.85);   // fuller, rosier lips
    if (int(uB.z + 0.5) == 3) {
        float lipClear = smoothstep(0.03, 0.015, abs(vU.y + 0.282)) * step(abs(vU.x), 0.085);
        float hs = hash1(floor(vH * 120.0));
        alb = mix(alb, uHair * (0.55 + 0.6 * hs), lower * (1.0 - lipClear) * 0.85 * step(hs, 0.82));
    }
    float specK = 0.05;
    if (mach) {
        float seam = smoothstep(0.004, 0.0015, abs(s.x)) + smoothstep(0.004, 0.0015, abs(vU.y + 0.13)) + smoothstep(0.004, 0.0015, abs(s.x - 0.2)) * step(vU.y, 0.1);
        alb = vec3(0.5, 0.52, 0.56) * (0.55 + 0.7 * ln) * (1.0 - 0.9 * clamp(seam, 0.0, 1.0));
        specK = 0.5;
    }
    alb = mix(alb, vec3(0.03, 0.02, 0.02), lash * 0.8);
    oAlb = vec4(alb, 1.0);
    oNrm = vec4(N * 0.5 + 0.5, specK);
}
`;
