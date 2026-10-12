"use strict";

// Pilot portrait renderer, part 2/4: the signed-distance scene (head, helmet, eyewear, masks, faction parts, body).
// Material ids: 1 skin, 2 eyeball, 3 helmet shell, 4 dark metal, 5 suit, 6 hair, 7 glass, 8 collar, 10 fur,
// 11 emissive, 12 trim cloth, 13 gold, 14 bone.
HP_GLSL.scene = `
const vec3 PIV = vec3(0.0, -0.52, -0.04);
vec3 headSpace(vec3 p) {
    vec3 q = p - PIV;
    q.yz = rot(uPitch) * q.yz;
    q.xz = rot(uYaw) * q.xz;
    return q + PIV;
}
bool isFac(float f) { return abs(uA.y - f) < 0.5; }
${HP_GLSL.deform}


// ---- voidborn: a grown bone-and-fold skull, no human face (swept crest, hollow fenestrations, glowing core) ----
float sdOct(vec3 p, float r) { p = abs(p); return (p.x + p.y * 0.6 + p.z - r) * 0.57; }
// Voidborn controls (look slots reused): uA.z head shape, uB.x void effect, uB.z tentacle count, uB.w chitin, uC.x sensors,
// uC.y skin texture, uC.z transparency, uD.x width, uD.z face-slit width, uD.w tentacle length, uE.x sensor size, uE.y asymmetry.
vec2 voidGeo(vec3 ph) {
    int sh = int(uA.z + 0.5);
    float crest = max(float(sh - (sh / 5) * 5) / 4.0, 0.08);
    float flare = sh >= 5 ? 1.0 : 0.0;
    ph.x += uE.y * 0.11 * (ph.y + 0.2) + uE.y * 0.02;            // asymmetry: the whole skull leans
    ph.x /= 1.0 + 0.16 * uD.x;
    vec3 s = vec3(abs(ph.x), ph.y, ph.z);
    float d = sdEll(ph - vec3(0.0, 0.02, -0.02), vec3(0.25, 0.41, 0.31));
    d = smin(d, sdRoundCone(ph, vec3(0.0, 0.16, 0.06), vec3(0.0, -0.5, 0.2), 0.2, 0.05), 0.13);   // long smooth face tapering to the chin
    d = smin(d, sdRoundCone(ph, vec3(0.0, 0.2, -0.12), vec3(0.0, 0.2 + 0.5 * crest, -0.12 - 0.42 * crest), 0.12, 0.012), 0.1);
    if (flare > 0.5) d = smin(d, sdRoundCone(s, vec3(0.2, 0.1, -0.02), vec3(0.46, 0.4, -0.3), 0.06, 0.01), 0.07);
    float slitW = 0.011 + 0.009 * (uD.z + 1.0);
    d = smax(d, -sdEll(ph - vec3(0.0, 0.0, 0.33), vec3(slitW * 2.4, 0.2, 0.09)), 0.03);   // recess around the slit
    float chit = float(int(uB.w + 0.5));
    d += 0.007 * vnoise(ph * 13.0);
    if (chit > 0.5) d += 0.0045 * chit * smoothstep(0.55, 0.9, abs(sin(ph.y * 34.0 + (chit > 1.5 ? ph.x * 12.0 : 0.0))));
    vec2 res = vec2(d * 0.85, 18.0);
    res = opU(res, vec2(sdEll(ph - vec3(0.0, 0.0, 0.325), vec3(slitW, 0.18, 0.022)), 17.0));   // glowing face slit
    int ns = int(uC.x + 0.5) * 2;
    float sz = 0.016 + 0.01 * (uE.x + 1.0);
    for (int i = 0; i < 8; i++) {
        if (i >= ns) break;
        float fi = float(i / 2);
        res = opU(res, vec2(sdSph(vec3(ph.x * (mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0) * -1.0, ph.y, ph.z) - vec3(0.11 + 0.025 * fi, 0.2 - 0.09 * fi, 0.285 - 0.03 * fi), sz * (1.0 + 0.35 * uE.y * (mod(float(i), 2.0) - 0.5))), 17.0));
    }
    int fx = int(uB.x + 0.5);
    if (fx == 1 || fx == 4) for (int i = 0; i < 6; i++) {
        float fi = float(i);
        res = opU(res, vec2(sdSph(ph - vec3(0.42 * sin(uTime * 0.6 + fi * 2.1), 0.15 + 0.35 * sin(uTime * 0.5 + fi * 1.7), -0.2 + 0.2 * cos(fi * 3.0)), 0.014 + 0.006 * mod(fi, 3.0)), 17.0));
    }
    if (fx == 2 || fx == 4) res = opU(res, vec2(sdTorus(vec3(ph.x, ph.y - 0.1, ph.z + 0.4), vec2(0.55, 0.008)), 17.0));
    if (fx == 3) res = opU(res, vec2(sdCap(ph, vec3(-0.35, 0.65, -0.45), vec3(0.25, -0.55, -0.45), 0.012), 17.0));
    return res;
}

// ---- head: skull, jaw, brow, eye sockets, eyelids, nose, lips, ears. Returns (distance, material) ----
vec2 headGeo(vec3 ph) {
    if (isFac(2.0)) return voidGeo(ph);
    float fem = uA.x;
    bool kron = isFac(1.0), voidb = isFac(2.0), mach = isFac(4.0);
    vec3 s = vec3(abs(ph.x), ph.y, ph.z);
    float jawW = 1.0 - 0.11 * fem + (kron ? 0.18 : 0.0) - (voidb ? 0.2 : 0.0);
    float d;
    if (mach) {
        d = sdRBox(ph - vec3(0.0, -0.02, 0.0), vec3(0.285, 0.43, 0.32), 0.07);
        d = smin(d, sdRBox(ph - vec3(0.0, -0.31, 0.07), vec3(0.20 * jawW, 0.17, 0.24), 0.05), 0.05);
    } else {
        vec3 sk = voidb ? vec3(0.32, 0.49, 0.38) : vec3(0.345, 0.43, 0.40);
        d = sdEll(ph - vec3(0.0, 0.10, -0.02), sk);
        // mandible: a rounded block (squarer jaw), softer chin, full cheeks
        d = smin(d, sdRBox(ph - vec3(0.0, -0.315, 0.07), vec3(0.115 * jawW, 0.07, 0.18), 0.10), 0.13);
        d = smin(d, sdEll(ph - vec3(0.0, -0.475, 0.19 + (kron ? 0.03 : 0.0)), vec3(0.085 * jawW + (kron ? 0.03 : 0.0), 0.05, 0.07)), 0.08);
        d = smin(d, sdEll(ph - vec3(0.0, -0.17, 0.07), vec3(0.245 * jawW, 0.15, 0.26)), 0.14);   // mid-face: blends cheeks into the jaw
        d = smin(d, sdEll(s - vec3(0.215, -0.07, 0.18), vec3(0.10, 0.10, 0.11)), 0.10);
        d = smin(d, sdEll(s - vec3(0.235, -0.045, 0.19), vec3(0.085, 0.065, 0.09)), 0.07);
    }
    float browAmt = mix(1.0, 0.55, fem) * (0.7 + 0.3 * uC.y) * (kron ? 1.5 : 1.0) * (voidb ? 0.5 : 1.0);
    d = smin(d, sdEll(ph - vec3(0.0, 0.095, 0.322), vec3(0.26, 0.032 + 0.008 * browAmt, 0.04 + 0.016 * browAmt)), 0.05);
    vec3 ec = vec3(0.165, 0.0, 0.222 - 0.012 * step(0.0, ph.x));
    float eyeSize = mix(1.0, 1.2, fem) * (voidb ? 1.18 : 1.0);
    vec2 res;
    if (!mach) {
        d = smax(d, -sdEll(s - vec3(0.165, 0.012, 0.415), vec3(0.098, 0.066, 0.07)), 0.055);   // shallow eye socket
        vec3 e = s - ec;
        float lidC = mix(-0.008, -0.034, uBlink);
        float lidH = mix(0.0165, 0.003, uBlink) * eyeSize * (1.0 + 0.1 * fem);
        vec2 o = vec2(e.x / (0.06 * eyeSize), (e.y - lidC - e.x * 0.12) / lidH);
        float hole = (length(o) - 1.0) * min(0.06 * eyeSize, lidH + 0.02);
        d = smax(d, -max(hole, 0.2 - s.z), 0.012);              // the eyelids are the skin around this opening
    } else {
        d = smax(d, -sdRBox(ph - vec3(0.0, 0.0, 0.34), vec3(0.205, 0.022, 0.04), 0.01), 0.01);
    }
    // nose: bridge, tip, wings, nostrils
    float noseK = (kron ? 1.15 : 1.08) * (voidb ? 0.25 : 1.0) * mix(1.0, 0.85, fem);
    float nose = sdCap(ph, vec3(0.0, 0.045, 0.315), vec3(0.0, -0.115, 0.315 + 0.07 * noseK), 0.03 * noseK + 0.004);
    nose = smin(nose, sdEll(ph - vec3(0.0, -0.145, 0.355 + 0.07 * noseK), vec3(0.042, 0.038, 0.042) * noseK + 0.004), 0.03);
    nose = smin(nose, sdEll(s - vec3(0.052, -0.15, 0.35 + 0.035 * noseK), vec3(0.033, 0.028, 0.036) * noseK + 0.004), 0.03);
    d = smin(d, nose, 0.04);
    if (!mach && !voidb) {                                       // adult structure: sunken cheeks, eye bags, a firmer chin
        d = smax(d, -sdEll(s - vec3(0.292, -0.165, 0.19), vec3(0.06 - 0.012 * fem, 0.075, 0.085)), 0.06);
        d = smin(d, sdEll(s - vec3(0.165, -0.064, 0.322), vec3(0.058, 0.011, 0.03)), 0.025);
    }
    d = smax(d, -sdEll(s - vec3(0.026, -0.172, 0.38 + 0.03 * noseK), vec3(0.015, 0.011, 0.03)), 0.01);
    // lips and mouth line
    float lipK = mix(0.95, 1.35, fem);
    d = smin(d, sdEll(ph - vec3(0.0, -0.265, 0.345), vec3(0.078, 0.019 * lipK, 0.036)), 0.015);
    d = smin(d, sdEll(ph - vec3(0.0, -0.302, 0.345), vec3(0.070, 0.024 * lipK, 0.040)), 0.015);
    d = smax(d, -sdEll(ph - vec3(0.0, -0.282, 0.376), vec3(0.085, 0.004, 0.04)), 0.006);
    // ears
    float er = kron ? 0.03 : (voidb ? 0.026 : 0.03);
    float ear = sdEll(s - vec3(0.34, -0.01, -0.02), vec3(er, 0.072, 0.048));
    ear = max(ear, -sdEll(s - vec3(0.375, -0.01, -0.005), vec3(0.03, 0.045, 0.028)));
    if (kron) ear = min(ear, sdRoundCone(s, vec3(0.33, 0.0, -0.01), vec3(0.50, 0.19, -0.05), 0.04, 0.006));
    if (voidb) ear = min(ear, sdRoundCone(s, vec3(0.32, 0.02, -0.01), vec3(0.56, 0.36, -0.08), 0.035, 0.005));
    if (mach) ear = sdCap(s, vec3(0.29, -0.02, 0.0), vec3(0.37, -0.02, 0.0), 0.06);
    d = smin(d, ear, 0.02);
    bool M = uMesh > 0.5;
    res = vec2(M ? 1e3 : d, mach ? 15.0 : 1.0);
    if (M) {                                                     // scanned head: add only what the scan lacks
        if (kron) res = opU(res, vec2(sdRoundCone(s, vec3(0.33, 0.0, -0.01), vec3(0.50, 0.19, -0.05), 0.04, 0.006), 1.0));
        if (voidb) res = opU(res, vec2(sdRoundCone(s, vec3(0.32, 0.02, -0.01), vec3(0.56, 0.36, -0.08), 0.035, 0.005), 1.0));
        if (mach) res = opU(res, vec2(sdCap(s, vec3(0.29, -0.02, 0.0), vec3(0.37, -0.02, 0.0), 0.06), 4.0));
    }
    if (mach) {
        res = opU(res, vec2(sdRBox(ph - vec3(0.0, 0.0, 0.34), vec3(0.19, 0.011, 0.006), 0.006), 11.0));
    } else {
        res = opU(res, vec2(sdSph(s - ec, 0.052 * eyeSize), 2.0));
    }
    // faction parts: tusks, eyepatch, earring
    if (kron) res = opU(res, vec2(sdRoundCone(s, vec3(0.07, -0.31, 0.335), vec3(0.078, -0.17, 0.385), 0.019, 0.006), 14.0));
    if (isFac(3.0)) {
        res = opU(res, vec2(sdEll(ph - vec3(-0.165, 0.0, 0.322), vec3(0.088, 0.078, 0.014)), 16.0));
        float band = max(abs(length(ph - vec3(0.0, 0.02, -0.02)) - 0.355) - 0.005, abs(ph.y - (0.10 + 0.30 * ph.x)) * 0.9 - 0.012);
        res = opU(res, vec2(band, 16.0));
        res = opU(res, vec2(sdTorus(vec3(ph.y + 0.2, ph.x - 0.335, ph.z + 0.01), vec2(0.022, 0.004)), 13.0));
    }
    return res;
}

// ---- hair under the helmet (and long hair for women) ----
vec2 hairGeo(vec3 ph) {
    if (isFac(4.0)) return vec2(1e3, 0.0);
    vec3 s = vec3(abs(ph.x), ph.y, ph.z);
    float hairEdge = mix(-0.02, 0.17, smoothstep(-0.1, 0.3, ph.z));
    float d = max(sdEll(ph - vec3(0.0, 0.10, -0.02), vec3(0.362, 0.443, 0.412)), hairEdge - ph.y);
    if (uA.x > 0.3) {                                            // long hair grows in as the gender slider moves toward female
        float g = clamp((uA.x - 0.3) / 0.4, 0.15, 1.0);
        d = min(d, sdEll(ph - vec3(0.0, -0.17, -0.19), vec3(0.28, 0.42, 0.17) * g));
        d = min(d, sdEll(s - vec3(0.335, -0.18, 0.0), vec3(0.055, 0.34, 0.14) * g));
    }
    return vec2(d, 6.0);
}

// ---- helmet shells, ear cups, horns, spikes, fixtures ----
vec2 helmetGeo(vec3 ph) {
    int h = int(uA.z + 0.5);
    vec3 s = vec3(abs(ph.x), ph.y, ph.z);
    vec3 sk = vec3(0.378, 0.458, 0.428);
    vec3 hc = ph - vec3(0.0, 0.10, -0.02);
    float edgeY = mix(-0.2, 0.165, smoothstep(-0.05, 0.3, ph.z));
    if (h == 2) edgeY = mix(-0.2, 0.165, smoothstep(0.12, 0.3, ph.z));
    float outer = max(sdEll(hc, sk), sdRBox(hc, vec3(0.335, 0.5, 0.40), 0.16));
    float cap = max(outer, -sdEll(hc, sk - 0.03));
    cap = min(cap, max(max(abs(length(vec2(hc.x, hc.z + 0.02)) - 0.375) - 0.016, abs(ph.y - 0.185) - 0.012), -ph.z - 0.0));   // rear rim
    cap = max(cap, edgeY - ph.y);
    vec2 res = vec2(cap, 3.0);
    if (h == 1 || h == 5 || h == 8) res = opU(res, vec2(sdRBox(s - vec3(0.365, -0.03, 0.0), vec3(0.03, 0.075, 0.07), 0.03), 4.0));
    if (h == 3) res = opU(res, vec2(sdRBox(ph - vec3(0.0, 0.50, -0.05), vec3(0.012, 0.09, 0.22), 0.01), 3.0));
    if (h == 4) res = opU(res, vec2(sdRoundCone(s, vec3(0.30, 0.33, 0.0), vec3(0.50, 0.62, 0.05), 0.045, 0.008), 4.0));
    if (h == 5) res = opU(res, vec2(sdRBox(ph - vec3(0.0, 0.15, 0.34), vec3(0.19, 0.008, 0.09), 0.008), 3.0));
    if (h == 6) {
        vec3 hd = ph - vec3(0.0, 0.0, -0.07);
        float hood = max(sdEll(hd, vec3(0.44, 0.54, 0.48)), -sdEll(hd, vec3(0.41, 0.51, 0.45)));
        hood = max(hood, -sdEll(ph - vec3(0.0, -0.05, 0.3), vec3(0.30, 0.40, 0.3)));
        hood = max(hood, -0.36 - ph.y);
        res = opU(res, vec2(hood, 5.0));
    }
    if (h == 7) {
        res = opU(res, vec2(sdRoundCone(s, vec3(0.16, 0.43, 0.04), vec3(0.20, 0.62, 0.04), 0.032, 0.004), 4.0));
        res = opU(res, vec2(sdRoundCone(ph, vec3(0.0, 0.46, -0.02), vec3(0.0, 0.66, -0.02), 0.034, 0.004), 4.0));
    }
    if (h == 8) {
        float band = sdTorus(vec3(ph.x, ph.z + 0.02, ph.y - 0.08), vec2(0.39, 0.016));
        res = vec2(max(band, 0.05 - ph.y), 4.0);
        res = opU(res, vec2(sdRBox(s - vec3(0.365, -0.03, 0.0), vec3(0.03, 0.075, 0.07), 0.03), 4.0));
        res = opU(res, vec2(sdCap(ph, vec3(-0.36, -0.07, 0.05), vec3(-0.18, -0.25, 0.30), 0.008), 4.0));
    }
    if (h == 9) {
        res = opU(res, vec2(sdEll(s - vec3(0.365, -0.09, 0.03), vec3(0.045, 0.15, 0.115)), 4.0));
        res = opU(res, vec2(max(abs(length(hc) - 0.455) - 0.012, abs(ph.y - 0.20) - 0.018), 4.0));
    }
    return res;
}

// ---- eyewear, masks, fixtures, gear ----
vec2 gearGeo(vec3 ph) {
    vec3 s = vec3(abs(ph.x), ph.y, ph.z);
    vec2 res = vec2(1e3, 0.0);
    int ew = int(uB.x + 0.5), mk = int(uB.y + 0.5), fx = int(uC.x + 0.5);
    vec3 hc = ph - vec3(0.0, 0.02, -0.02);
    if (ew == 1) {
        res = opU(res, vec2(sdEll(s - vec3(0.105, 0.245, 0.37), vec3(0.075, 0.052, 0.04)) * 0.6, 7.0));
        res = opU(res, vec2(sdTorus(vec3(s.x - 0.105, s.z - 0.375, s.y - 0.245), vec2(0.078, 0.009)), 4.0));
        res = opU(res, vec2(max(abs(length(ph - vec3(0.0, 0.10, -0.02)) - 0.465) - 0.007, abs(ph.y - 0.245) - 0.016), 4.0));
    }
    if (ew == 2) {
        float shell = abs(sdEll(ph - vec3(0.0, 0.0, -0.14), vec3(0.365, 0.53, 0.49)));
        float reg = max(abs(ph.y - 0.012) - 0.058, max(abs(ph.x) - 0.31, -ph.z));
        res = opU(res, vec2(max(shell - 0.009, reg) * 0.45, 7.0));                               // thin shell: conservative steps so rays never skip it
        res = opU(res, vec2(max(shell - 0.013, abs(reg) - 0.011) * 0.45, 4.0));                  // frame
    }
    if (ew == 3) {
        res = opU(res, vec2(sdTorus(vec3(ph.x - 0.165, ph.z - 0.335, ph.y), vec2(0.082, 0.008)), 4.0));
        res = opU(res, vec2(sdEll(ph - vec3(0.165, 0.0, 0.335), vec3(0.08, 0.08, 0.006)) * 0.5, 7.0));
        res = opU(res, vec2(sdCap(ph, vec3(0.245, 0.04, 0.32), vec3(0.34, 0.09, 0.1), 0.006), 4.0));
    }
    if (ew == 4) {
        float shell = abs(sdEll(ph - vec3(0.0, -0.12, -0.12), vec3(0.385, 0.60, 0.53)));
        float reg = max(0.1 - ph.z, abs(ph.y + 0.155) - 0.285);
        res = opU(res, vec2(max(shell - 0.009, reg) * 0.45, 7.0));
        res = opU(res, vec2(max(shell - 0.014, abs(reg) - 0.012) * 0.45, 4.0));                  // frame
    }
    if (mk >= 1) {                                               // oxygen mask: the shell comes from the scan pass; hose runs down to the suit
        vec3 q = ph;
        float sw = 0.045 * sin((q.y + 0.4) * 22.0);
        float hose = 1e3;
        for (int i = 0; i < 6; i++) {
            float t0 = float(i) / 6.0, t1 = float(i + 1) / 6.0;
            vec3 a = vec3(sin(t0 * 6.0) * 0.045, mix(-0.40, -0.80, t0), mix(0.31, 0.42, t0));
            vec3 b = vec3(sin(t1 * 6.0) * 0.045, mix(-0.40, -0.80, t1), mix(0.31, 0.42, t1));
            hose = min(hose, sdCap(q, a, b, 0.055 + 0.008 * sin(q.y * 90.0)));
        }
        res = opU(res, vec2(hose, 4.0));
        res = opU(res, vec2(sdCap(ph, vec3(0.0, -0.36, 0.33), vec3(0.0, -0.43, 0.31), 0.05), 13.0));   // coupling
        res = opU(res, vec2(sdCap(s, vec3(0.2, -0.17, 0.2), vec3(0.345, -0.07, 0.01), 0.008), 12.0));    // head straps
    }
    if (fx == 1) {
        res = opU(res, vec2(sdCap(ph, vec3(0.18, 0.42, -0.08), vec3(0.25, 0.72, -0.1), 0.008), 4.0));
        res = opU(res, vec2(sdSph(ph - vec3(0.25, 0.72, -0.1), 0.017), 11.0));
    }
    if (fx == 2) res = opU(res, vec2(sdRBox(ph - vec3(0.0, 0.325, 0.37), vec3(0.055, 0.016, 0.026), 0.008), 11.0));
    if (fx == 3) res = opU(res, vec2(sdSph(s - vec3(0.372, 0.21, 0.07), 0.034), 11.0));
    if (isFac(4.0) && int(uC.z + 0.5) == 0) {
        res = opU(res, vec2(sdCap(ph, vec3(0.1, 0.40, -0.06), vec3(0.14, 0.72, -0.08), 0.007), 4.0));
        res = opU(res, vec2(sdSph(ph - vec3(0.14, 0.72, -0.08), 0.016), 11.0));
    }
    return res;
}

// ---- body: neck, torso, collar, faction clothing ----
vec2 bodyGeo(vec3 p) {
    float fem = uA.x;
    vec3 b = p; b.y += uBreath * 0.012;
    vec3 s = vec3(abs(b.x), b.y, b.z);
    float neckR = 0.14 * (1.0 - 0.12 * fem);
    bool M = uMesh > 0.5;
    vec2 res = vec2(M ? 1e3 : sdCap(b, vec3(0.0, -0.40, -0.04), vec3(0.0, -0.80, -0.07), neckR), 1.0);
    if (isFac(4.0)) res.y = 15.0;
    float torso = sdEll(b - vec3(0.0, -1.02, -0.07), vec3(0.76 - 0.1 * fem, 0.36, 0.36));
    res = opU(res, vec2(torso, 5.0));
    res = opU(res, vec2(sdEll(s - vec3(0.56 - 0.06 * fem, -0.76, -0.07), vec3(0.2, 0.11, 0.22)), 8.0));
    float coll = sdTorus(b - vec3(0.0, -0.66, -0.05), vec2(0.175, 0.055));
    if (M) coll = max(abs(length(b.xz - vec2(0.0, -0.05)) - 0.245) - 0.045, abs(b.y + 0.69) - 0.15) - 0.012;   // standing collar hides the throat notch
    if (isFac(1.0)) {
        float nz = vnoise(b * 38.0) * 0.012;
        res = opU(res, vec2(sdTorus(b - vec3(0.0, M ? -0.63 : -0.71, -0.05), vec2(M ? 0.31 : 0.22, M ? 0.12 : 0.095)) - nz, 10.0));
        res = opU(res, vec2(sdRoundCone(s, vec3(0.50, -0.80, -0.05), vec3(0.56, -0.58, -0.05), 0.04, 0.004), 14.0));
        res = opU(res, vec2(sdRoundCone(s, vec3(0.64, -0.84, -0.05), vec3(0.74, -0.64, -0.05), 0.035, 0.004), 14.0));
    } else if (isFac(2.0)) {
        vec3 cw = b - vec3(0.0, -0.50, -0.13);
        float cowl = max(sdEll(cw, vec3(0.37, 0.55, 0.32)), -sdEll(cw, vec3(0.325, 0.52, 0.29)));
        cowl = max(cowl, max(-b.y - 0.95, b.y + 0.08 - 0.5 * abs(b.x)));
        res = opU(res, vec2(cowl, 5.0));
        int nt = int(uB.z + 0.5) * 4;
        float tl = 0.8 + 0.3 * uD.w;
        for (int i = 0; i < 12; i++) {
            if (i >= nt) break;
            float fi = float(i / 2);
            float sd = mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0;
            vec3 a = vec3(sd * (0.12 + 0.05 * fi), 0.0 - 0.03 * fi, -0.15);
            vec3 c = vec3(sd * (0.28 + 0.07 * fi + 0.04 * sin(fi * 2.0)), -0.2 - 0.6 * tl, -0.02 + 0.03 * fi);
            vec3 m = mix(a, c, 0.5) + vec3(sd * 0.05, 0.0, 0.06);
            res = opU(res, vec2(min(sdRoundCone(b, a, m, 0.04, 0.03), sdRoundCone(b, m, c, 0.03, 0.008)), 18.0));
        }
    } else if (isFac(3.0)) {
        res = opU(res, vec2(sdTorus(b - vec3(0.0, M ? -0.62 : -0.69, -0.05), vec2(M ? 0.27 : 0.15, M ? 0.075 : 0.058)), 12.0));
        res = opU(res, vec2(sdSph(b - vec3(0.09, M ? -0.72 : -0.78, M ? 0.2 : 0.09), 0.062), 12.0));
    } else if (isFac(4.0)) {
        res = opU(res, vec2(coll, 4.0));
        for (int i = 0; i < 3; i++) {
            float fi = float(i) - 1.0;
            res = opU(res, vec2(sdCap(b, vec3(fi * 0.045, -0.42, 0.08), vec3(fi * 0.075, -0.80, 0.09), 0.012), i == 1 ? 11.0 : 4.0));
        }
    } else {
        res = opU(res, vec2(coll, 8.0));
    }
    return res;
}

bool gNoGlass = false;     // shadow and occlusion rays pass through glass
vec2 map(vec3 p) {
    vec2 res = bodyGeo(p);
    vec3 ph = headSpace(p);
    float bd = length(ph - vec3(0.0, 0.12, 0.1)) - 1.0;
    if (bd > 0.2) return opU(res, vec2(bd - 0.1, 0.0));
    vec3 q = headUndeform(ph);                                   // helmets, eyewear, eyes, hair... follow the head's shape
    vec2 hp = headGeo(q); hp.x *= 0.85; res = opU(res, hp);
    if (isFac(2.0)) return res;
    hp = helmetGeo(q); hp.x *= 0.85; res = opU(res, hp);
    hp = gearGeo(q); hp.x *= 0.85;
    if (gNoGlass && abs(hp.y - 7.0) < 0.5) hp.x += 10.0;
    res = opU(res, hp);
    hp = hairGeo(q); hp.x *= 0.85; res = opU(res, hp);
    return res;
}
`;
