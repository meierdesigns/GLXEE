"use strict";

// Pilot portrait renderer, part 4/4a: pixelate pass. Averages 3x3 texels per output pixel, draws an outline
// where a nearer surface sits in front of a farther one, then quantises to a small palette with an ordered dither.
HP_GLSL.post = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uOut;
uniform float uBlock;   // 0 = dithered VGA look (alien factions), 1 = painted pixel look (human factions), 2 = same with 2x2 blocks
out vec4 outColor;
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
vec4 fetchPx(ivec2 q) {
    q = clamp(q, ivec2(0), ivec2(uOut) - 1);
    ivec2 b = q * 3;
    vec4 s = vec4(0.0);
    for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) s += texelFetch(uTex, b + ivec2(i, j), 0);
    return s / 9.0;
}
vec4 fetchCell(ivec2 c) {
    int k = uBlock > 1.5 ? 2 : 1;
    if (k <= 1) return fetchPx(c);
    vec4 s = vec4(0.0);
    for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) s += fetchPx(c * k + ivec2(i, j));
    return s / 4.0;
}
void main() {
    ivec2 q = ivec2(gl_FragCoord.xy);
    bool chunky = uBlock > 0.5;
    int k = uBlock > 1.5 ? 2 : 1;
    ivec2 cell = q / k;
    vec4 c0 = chunky ? fetchCell(cell) : fetchPx(q);
    float dn = c0.a;
    float edge = 0.0;
    vec4 n[4];
    if (chunky) { n[0] = fetchCell(cell + ivec2(1, 0)); n[1] = fetchCell(cell + ivec2(-1, 0)); n[2] = fetchCell(cell + ivec2(0, 1)); n[3] = fetchCell(cell + ivec2(0, -1)); }
    else { n[0] = fetchPx(q + ivec2(1, 0)); n[1] = fetchPx(q + ivec2(-1, 0)); n[2] = fetchPx(q + ivec2(0, 1)); n[3] = fetchPx(q + ivec2(0, -1)); }
    for (int i = 0; i < 4; i++) edge = max(edge, step(0.05, n[i].a - dn));
    vec3 col = c0.rgb;
    col = mix(col, col * 0.15 + vec3(0.01, 0.012, 0.03), edge * 0.85);
    float l = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(vec3(l), col, 1.1) + vec3(-0.02, -0.005, 0.03) * (1.0 - smoothstep(0.1, 0.5, l));   // punchy colour, cool shadows
    col = (col - 0.5) * 1.12 + 0.5;
    if (chunky) {                                         // hand-painted look: local contrast, warm shadows, many flat tones, no dither
        vec3 avg = (n[0].rgb + n[1].rgb + n[2].rgb + n[3].rgb) * 0.25;
        col = c0.rgb + (c0.rgb - avg) * 0.9 * (1.0 - edge);                      // unsharp: carves eyes, nose, lips, jaw planes
        col = mix(col, col * 0.3 + vec3(0.01, 0.012, 0.03), edge * 0.6);
        float lh = clamp(dot(col, vec3(0.3, 0.59, 0.11)), 0.0, 1.0);
        col = (col - lh) * 0.82 + lh;                                             // realistic, less saturated skin
        col = pow(max(col, 0.0), vec3(1.3)) * 1.12;                              // deeper shadows, bright planes
        col += vec3(0.02, 0.01, 0.0) * smoothstep(0.35, 0.0, lh);       // warm brown shadow tint
        col = floor(max(col, 0.0) * 20.0 + 0.5) / 20.0;
    } else {
        float b = BAYER[(q.y & 3) * 4 + (q.x & 3)] / 16.0;
        const float LV = 7.0;
        col = floor(max(col, 0.0) * LV + 0.5 + (b - 0.5) * 0.45) / LV;
    }
    outColor = vec4(col, 1.0);
}
`;
