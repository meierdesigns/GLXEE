"use strict";

// Pilot portrait renderer, part 1/4: GLSL header, uniforms and signed-distance helpers.
// The portrait is a real 3D head raymarched in a fragment shader (see glsl-scene.js / glsl-shade.js),
// then pixelated and palette-quantised by glsl-post.js. All parts share the global HP_GLSL.
var HP_GLSL = window.HP_GLSL || {};
HP_GLSL.lib = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform float uTime, uYaw, uPitch, uBlink, uBreath, uMesh;
uniform vec2 uGaze;
uniform vec4 uA;   // sex (0 male, 1 female), faction (0 terran, 1 kronax, 2 voidborn, 3 pirate, 4 machine), helmet, -
uniform vec4 uB;   // eyewear, mask, beard, scar
uniform vec4 uC;   // fixture, brow, gear, eye shape
uniform vec4 uD, uE;   // head shape sliders (-1..1): width, length, jaw, chin / cheekbones, nose size
uniform vec3 uSkin, uHair, uEye, uPaint, uAcc, uCloth, uTrim;

float hash1(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash1(i), hash1(i + vec3(1, 0, 0)), f.x), mix(hash1(i + vec3(0, 1, 0)), hash1(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash1(i + vec3(0, 0, 1)), hash1(i + vec3(1, 0, 1)), f.x), mix(hash1(i + vec3(0, 1, 1)), hash1(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float dot2(vec3 v) { return dot(v, v); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdSph(vec3 p, float r) { return length(p) - r; }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
    vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
    vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2; float x2 = dot2(pa * l2 - ba * y); float y2 = y * y * l2; float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;
HP_GLSL.deform = `
// Head deformation shared by the scan mesh (vertex shader) and the SDF parts (via headUndeform): landmark space → deformed head space.
vec3 headDeform(vec3 w) {
    if (abs(uA.y - 2.0) < 0.5) return w;                         // voidborn: own skull, sliders are read by voidGeo
    float fem = uA.x;
    bool kron = isFac(1.0), voidb = isFac(2.0);
    float low = smoothstep(-0.02, -0.30, w.y), neck = smoothstep(-0.45, -0.7, w.y);
    float nose = smoothstep(0.1, 0.04, abs(w.x)) * smoothstep(-0.2, -0.17, w.y) * smoothstep(0.1, 0.06, w.y);
    w.x *= 1.0 - 0.17 * fem * low - 0.13 * fem * neck;
    w.x *= 1.0 - 0.16 * neck; w.z = -0.05 + (w.z + 0.05) * (1.0 - 0.16 * neck);   // slimmer neck than the scan's
    w.z -= 0.026 * fem * exp(-pow((w.y - 0.09) / 0.05, 2.0)) * smoothstep(0.32, 0.0, abs(w.x));   // flatter brow ridge
    w.z -= 0.022 * fem * nose; w.x *= 1.0 - 0.14 * fem * smoothstep(0.1, 0.02, abs(w.x)) * smoothstep(-0.2, -0.16, w.y) * smoothstep(-0.08, -0.14, w.y);
    w.y += 0.012 * fem * smoothstep(-0.5, -0.3, w.y) * smoothstep(-0.55, -0.4, -w.y);
    if (kron) {
        w.x *= 1.0 + 0.2 * low;
        w.z += 0.04 * low * smoothstep(0.2, 0.0, abs(w.x));
        w.z += 0.03 * exp(-pow((w.y - 0.09) / 0.04, 2.0)) * smoothstep(0.3, 0.0, abs(w.x));
        w.z -= 0.02 * nose;
    }
    if (voidb) {
        w.y *= 1.1;
        w.x *= 0.94 * (1.0 - 0.24 * low);
    }
    // user head shape (sliders): width, length, jaw, chin, cheekbones, nose size
    float lowJ = low * (1.0 - neck);
    w.x *= 1.0 + 0.15 * uD.x * (1.0 - 0.7 * neck);
    w.y += 0.17 * uD.y * w.y * smoothstep(0.12, -0.12, w.y) * (1.0 - 0.6 * neck);
    w.x *= 1.0 + 0.32 * uD.z * lowJ;
    float chinM = smoothstep(-0.36, -0.5, w.y) * smoothstep(0.2, 0.0, abs(w.x));
    w.z += 0.075 * uD.w * chinM; w.y -= 0.04 * uD.w * chinM; w.x *= 1.0 - 0.2 * uD.w * smoothstep(-0.36, -0.5, w.y);
    float cheekM = smoothstep(0.06, 0.2, abs(w.x)) * smoothstep(0.34, 0.2, abs(w.x)) * smoothstep(-0.2, -0.06, w.y) * smoothstep(0.04, -0.06, w.y);
    w.z += 0.06 * uE.x * cheekM; w.x *= 1.0 + 0.11 * uE.x * cheekM;
    float noseM = smoothstep(0.14, 0.04, abs(w.x)) * smoothstep(-0.22, -0.15, w.y) * smoothstep(0.12, 0.04, w.y);
    w.z += 0.07 * uE.y * noseM; w.x *= 1.0 + 0.45 * uE.y * smoothstep(0.1, 0.02, abs(w.x)) * smoothstep(-0.2, -0.16, w.y) * smoothstep(-0.08, -0.14, w.y);
    return w;
}
// Approximate inverse (fixed-point): the landmark-space point that the deformation moves to ph.
vec3 headUndeform(vec3 ph) {
    vec3 q = ph;
    q = ph - (headDeform(q) - q);
    q = ph - (headDeform(q) - q);
    q = ph - (headDeform(q) - q);
    return q;
}
`;
window.HP_GLSL = HP_GLSL;
