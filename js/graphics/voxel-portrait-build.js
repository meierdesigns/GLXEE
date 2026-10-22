"use strict";

// Voxel pilot portraits, part 2/3: builds one portrait. Every pixel is a voxel column with a depth; head, hair, gear and
// body are stacked into a depth buffer, lit from the upper left with a few flat tones and outlined. Facial details
// (eyes, brows, mouth, scars) are flat "decals" on top. Returns RGBA bytes for a VXP.W x VXP.H canvas.
VXP.build = (p, accent, blink, transparent, state, padTop) => {   // transparent: background pixels get alpha 0 (VXP.background draws them live)
    // padTop: extra rows above row 0 so tall helmets / hats are not cut off (output is W x (H + padTop)).
    const { W, H, hex, hash } = VXP, OY = padTop | 0, N = W * (H + OY), f = p.faction;
    const hurt = state === 1, dead = state === 2, joy = state === 3, mad = state === 4;   // state: 0 healthy, 1 wounded, 2 dead (visor dark, never blinks), 3 joy, 4 anger
    if (dead) blink = true;
    const vo = f === 'voidborn', ma = f === 'machine', kr = f === 'kronax';
    const full = true;                                                             // every pilot wears a closed helmet: no face is shown
    const Z = new Float32Array(N).fill(-99), C = new Float32Array(N * 3), K = new Uint8Array(N), D = new Float32Array(N * 4);
    const skin = hex(p.skin), hair = hex(p.hair), eyeC = hex(p.eye), glow = mad ? [255, 46, 30] : hex(p.glow).map((v) => (joy ? Math.min(255, v * 1.25 + 30) : v * (dead ? 0.12 : 1))), cloth = hex(VXP.THEME[f].cloth), trim = ma ? hex(p.glow) : hex(VXP.THEME[f].trim);
    const acc = hex(accent || VXP.THEME[f].trim);
    const sc = (c, k) => c.map((v) => v * k);
    const put = (x, y, z, c, k) => {
        if (x < 0 || y < -OY || x >= W || y >= H) return;
        const i = (y + OY) * W + x;
        if (z < Z[i]) return;
        Z[i] = z; C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2]; K[i] = k; D[i * 4 + 3] = 0;
    };
    const dec = (x, y, c, a, skinOnly) => {
        if (x < 0 || y < -OY || x >= W || y >= H) return;
        const i = (y + OY) * W + x;
        if (Z[i] < -50 || (skinOnly && K[i] !== 1)) return;
        D[i * 4] = c[0]; D[i * 4 + 1] = c[1]; D[i * 4 + 2] = c[2]; D[i * 4 + 3] = a == null ? 1 : a;
    };
    const g = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) * (x - cx)) / (2 * sx * sx) + ((y - cy) * (y - cy)) / (2 * sy * sy)));
    const line = (x0, y0, x1, y1, fn) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) fn(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)); };

    // ---- head profile: half-width by relative height; cw = cranium half-width ----
    const top = vo ? 4 : 5, chin = vo ? 42 : 40, hh = chin - top, cw = p.cw;
    const PR = vo ? [[0, 0.3], [0.08, 0.6], [0.18, 0.88], [0.35, 1], [0.6, 0.8], [0.8, 0.5], [1, 0.12]]
        : [[0, 0.5], [0.07, 0.72], [0.15, 0.92], [0.3, 1], [0.5, 0.96], [0.68, p.jaw], [0.8, p.jaw * 0.8], [0.92, p.chin + 0.12], [1, p.chin * 0.6]];
    const hw = (t) => {
        for (let k = 1; k < PR.length; k++) if (t <= PR[k][0]) { const a = PR[k - 1], b = PR[k]; return cw * (a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])); }
        return cw * PR[PR.length - 1][1];
    };
    // half-width of the head grown by `gr`, also above the crown (rounded cap)
    const hwG = (y, gr) => {
        if (y >= top) return hw((y + 0.5 - top) / hh) + gr;
        const q = (top - y - 0.5) / (gr + 1.5);
        return q >= 1 ? 0 : (hw(0) + gr) * Math.sqrt(1 - q * q);
    };
    // faceted instead of round: a flat front plane, a shallow cheek plane and a steep side plane; the forehead and chin tilt back
    const cl = (v) => Math.max(0, Math.min(1, v));
    const dome = (dx, w, t, depth) => {
        const u = Math.abs(dx) / w;
        if (w <= 0 || u >= 1) return 0;
        const v = t < 0.14 ? 0.55 + 0.45 * Math.max(0, t) / 0.14 : t > 0.82 ? 1 - cl((t - 0.82) / 0.18) * 0.55 : 1;
        return depth * v * (1 - 0.28 * cl((u - 0.3) / 0.4) - 0.72 * cl((u - 0.7) / 0.3));
    };
    const yE = Math.round(top + 0.44 * hh), yN = Math.round(top + 0.64 * hh), yM = Math.round(top + 0.79 * hh);
    const ex = Math.round(cw * 0.45);
    const feat = (dx, y) => {
        const ax = Math.abs(dx);
        let s = -1.4 * g(ax, y, ex, yE, 3.0, 1.5) + 0.8 * g(ax, y, cw * 0.62, yE + 4.5, 3, 2.2) + 1.2 * g(dx, y, 0, chin - 3.2, 3.0, 1.6);
        if (y >= yE - 4.5 && y <= yE - 2) s += p.brow * 0.8 * cl(1 - Math.max(0, ax - (ex + 3.5)) / 3);             // brow shelf
        if (!vo && !ma) {
            const nw = p.noseW;
            if (y >= yE - 1 && y <= yN + 1 && ax < nw) s += (1.2 + p.noseL * 1.2 + (y - yE) * 0.14) * (1 - ax / nw);   // wedge-shaped nose, wider towards the tip
            s += 0.9 * g(ax, y, nw * 1.2, yN, 0.9, 1.0) + p.lips * 0.8 * g(dx, y, 0, yM, 3.0, 0.8);
        }
        return s;
    };
    const zHead = (dx, y, gr, extra) => 4 + dome(dx, hwG(y, gr), (y + 0.5 - top) / hh, 9.5) + extra;

    // ---- hood (voidborn): drawn first so the head sits in front of it ----
    if (vo && p.gear === 'hood') {
        for (let y = top - 5; y < H; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24, w2 = hwG(y, 4.5) + (y > chin - 6 ? (y - chin + 6) * 0.9 : 0);
            if (Math.abs(dx) > w2 || w2 <= 0) continue;
            put(x, y, 2 + 1.8 * (1 - Math.abs(dx) / w2), sc(cloth, 1.15), 4);
        }
    }
    // ---- neck and body ----
    const nk = Math.min(p.neckW || 8.4, 13.5), bw = Math.min(p.bodyW || 1, 1.62);                                    // build: neck thickness and shoulder width
    for (let y = chin - 5; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - 24;
        if (Math.abs(dx) > nk) continue;
        put(x, y, 3 + 3 * (1 - (dx / nk) * (dx / nk)), sc(ma || full ? [58, 64, 78] : skin, y < chin + 2 ? 0.6 : 0.85), 1);
    }
    for (let y = 40; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - 24, adx = Math.abs(dx) / bw, ys = 43 + Math.max(0, adx - 8) * (bw < 1 ? 0.55 : 0.4);
        if (y + 0.5 < ys || adx > 24) continue;
        const pad = adx > 12.5 && adx < 23.5 && y < 53 ? 6 - Math.abs(adx - 18) * 0.5 : 0;                   // pauldrons
        put(x, y, 2 + (y - ys) * 0.25 + 2 * (1 - Math.min(1, adx / 24)) + pad, pad ? sc(cloth, 1.55) : cloth, pad ? 3 : 4);
        const ax = Math.abs(dx);
        if (!vo && ax >= 15 && ax <= 16.6 && y >= ys + 1 && y <= ys + 4) dec(x, y, sc(trim, 0.95), 1);
    }
    for (let y = 39; y < 49; y++) for (let x = 0; x < W; x++) {                  // collar ring around the neck
        const dx = x + 0.5 - 24, a = dx / (nk + 2.1), b = (y + 0.5 - 44) / 4.5;
        if (a * a + b * b > 1 || (Math.abs(dx) < nk - 1.9 && y < 44)) continue;
        put(x, y, 6, sc(cloth, 1.4), 4);
    }
    if (p.pens) [[0, [220, 60, 50]], [2, [60, 120, 220]], [4, [240, 220, 80]]].forEach(([dx, c]) => { for (let y = 46; y < 51; y++) dec(31 + dx, y, c, 1); dec(31 + dx, 45, [230, 230, 235], 1); });   // pocket-protector pens
    if (p.chin2) for (let y = chin - 1; y < chin + 5; y++) for (let x = 0; x < W; x++) {                  // double chin / thick neck roll
        const dx = x + 0.5 - 24, a = dx / (nk + 1.2), b = (y + 0.5 - (chin + 1.5)) / 3.4;
        if (a * a + b * b <= 1) put(x, y, 8 + (1 - a * a - b * b) * 2, [74, 80, 96], 3);
    }
    if (!vo) for (let j = 0; j < 5; j++) for (let i = 0; i <= j; i++) dec(37 + i - Math.floor(j / 2) + 1, 48 + j, sc(ma ? trim : acc, 1.0), 1);   // faction badge
    if (ma) for (let k = 0; k < 4; k++) line(21 + k * 2, chin + 1, 20 + k * 2.6, 52, (x, y) => dec(x, y, k % 2 ? [20, 24, 30] : sc(trim, 0.6), 1));
    // ---- head ----
    for (let y = top; y <= (full ? top - 1 : chin); y++) {                       // (the bare head is skipped under a closed helmet)
        const t = (y + 0.5 - top) / hh, w = hw(t);
        for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24;
            if (Math.abs(dx) > w) continue;
            put(x, y, 4 + dome(dx, w, t, 9.5) + feat(dx, y), sc(ma ? p.metal.map((v) => v * 1.45 + 6) : skin, 0.98 + 0.04 * hash(x, y)), 1);
        }
    }
    if (!full && !vo && !ma) [-1, 1].forEach((sd) => {                                       // ears
        const ecx = 24 + sd * (hw(0.45) + 0.8);
        for (let y = yE - 3; y <= yE + 6; y++) for (let x = 0; x < W; x++) {
            const a = (x + 0.5 - ecx) / (kr ? 2.4 : 1.9), b = (y + 0.5 - (yE + 1.5)) / (kr ? 4.8 : 3.4);
            if (a * a + b * b <= 1) put(x, y, 3.2, sc(skin, 0.9), 1);
        }
    });
    if (!full && p.earring) put(24 + (hw(0.45) + 1.5) | 0, yE + 5, 12, [226, 184, 72], 3);
    // ---- hair ----
    const hairSh = (x, y) => sc(hair, 0.8 + 0.4 * hash(x, 0) * (0.6 + 0.4 * hash(x >> 1, y >> 2)));
    const helmed = ['helmet', 'cap', 'helm', 'plate', 'dome', 'crest', 'hood', 'bandana', 'headband'].indexOf(p.gear) >= 0;
    if (!full && !vo && !ma && p.hairStyle !== 'bald' && !(helmed && p.gear !== 'bandana' && p.gear !== 'headband') && !kr) {
        const lift = p.hairStyle === 'swept' ? 1 : 0;
        for (let y = top - 3; y <= yE + 2; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24, w = hwG(y, 1.3);
            if (Math.abs(dx) > w) continue;
            const hl = top + 0.22 * hh + 3.2 * (dx / cw) * (dx / cw) + (lift ? dx * 0.22 : 0);
            if (y < hl || (Math.abs(dx) > hw((y + 0.5 - top) / hh) - 1.4 && y <= yE + 1)) put(x, y, zHead(dx, y, 1.3, 1.0), hairSh(x, y), 2);
        }
        if (p.hairStyle === 'long') [-1, 1].forEach((sd) => {
            for (let y = yE - 4; y < 49; y++) for (let k = 0; k < 4.2; k++) {
                const x = Math.round(24 + sd * (hw((y + 0.5 - top) / hh) + k) - 0.5);
                put(x, y, 7 - k * 0.4, hairSh(x, y), 2);
            }
        });
    }
    // ---- headgear ----
    const cap = (grow, bottomFn, extra, col, k) => {
        for (let y = top - 4; y <= bottomFn(0) + 6; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24, w = hwG(y, grow);
            if (Math.abs(dx) > w || y > bottomFn(dx)) continue;
            put(x, y, zHead(dx, y, grow, extra), col, k);
        }
    };
    const cups = (col) => [-1, 1].forEach((sd) => {
        for (let y = yE - 3; y <= yE + 6; y++) for (let x = 0; x < W; x++) {
            const a = (x + 0.5 - (24 + sd * (hw(0.45) + 3))) / 3.1, b = (y + 0.5 - (yE + 1.5)) / 4.6;
            if (a * a + b * b <= 1) put(x, y, 12 + (1 - a * a - b * b) * 3, col, 3);
        }
    });
    const metal = ma ? p.metal : [88, 96, 112], metalHi = metal.map((v) => Math.min(255, v * 1.7 + 12));
    const fullHelm = () => {
        const mixc = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);
        const BASE = { terran: [150, 160, 178], pirate: [84, 68, 56], kronax: [74, 62, 52], voidborn: [58, 52, 82], machine: [70, 74, 80] };
        const va = p.idx & 3, vb = (p.idx >> 2) & 3;                                  // two variant dials: every helm of a faction gets its own combination
        const TINT = { terran: [[0, 0, 0], [-14, 6, 26], [24, 14, -14], [-6, 22, 4]], kronax: [[0, 0, 0], [-16, -14, -8], [18, -6, -10], [-8, 4, 14]], pirate: [[0, 0, 0], [-20, -12, -4], [10, 6, -12], [-10, -10, 12]], machine: [[0, 0, 0], [-14, 8, 22], [26, 4, -14], [-4, 24, 8]], voidborn: [[0, 0, 0], [20, -10, 24], [-18, 8, 18], [24, 4, -4]] };
        const hm0 = mixc(BASE[f], p.metal, f === 'terran' ? 0.08 : 0.22), tnt = TINT[f][vb];
        const hm = hm0.map((v, i) => Math.max(0, Math.min(255, v + tnt[i] + (p.tintRGB ? p.tintRGB[i] : 0))));                                    // dark, desaturated gunmetal
        const YAW = 3, cf = 24 - YAW;                                                // head turned to the left: the front line sits left of centre
        const rnd = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
        const R = (cw + 2.8) * [1, 1.07, 0.94, 1.03][va] * (vb === 2 ? 0.97 : 1) * (p.shellW || 1);
        // blocky military shell: flat crown, vertical sides down to the mouth, then a narrow flat chin guard
        const hp = vo ? [[top - 3, 0.3], [top, 0.6], [top + 8, 0.9], [top + 0.5 * hh, 1], [top + 0.72 * hh, 0.85], [chin - 4, 0.6], [chin + 2, 0.3]]
            : f === 'pirate' ? [[top - 3, 0.55], [top - 1, 0.88], [top + 2, 1.04], [top + 7, 1.08], [yE + 1, 1.02], [yN - 1, 0.86], [yN + 3, 0.78], [yM + 1, 0.7], [chin - 1, 0.6], [chin + 2, 0.5]]   // skull: round cranium, cheek hollows, narrow jaw
            : [[top - 3, 0.5], [top - 1, 0.74], [top + 2, 0.92], [top + 5, 1], [yM, 1], [yM + 2, 0.86], [chin - 1, 0.62], [chin + 2, 0.58]];
        // Round the crown off: the first profile point is already 30-90 % wide, which read as a flat cut.
        { const [t0, w0] = hp[0]; hp.unshift([t0 - 3, 0], [t0 - 2, w0 * 0.45], [t0 - 1, w0 * 0.8]); }
        const hwH = (y) => {
            if (y <= hp[0][0]) return 0;
            for (let k = 1; k < hp.length; k++) if (y <= hp[k][0]) { const u = hp[k - 1], v = hp[k]; return R * (u[1] + (v[1] - u[1]) * (y - u[0]) / (v[0] - u[0])); }
            return R * hp[hp.length - 1][1];
        };
        const zH = (dx, y) => {
            const w = hwH(y), dc = dx + YAW, u = Math.abs(dc) / (dc < 0 ? w * 0.9 - YAW : w * 1.06 + YAW);
            let z = 15 - 5 * cl((u - 0.5) / 0.22) - 5 * cl((u - 0.72) / 0.28);        // flat front plane, one hard bevel, flat side plane
            if (y < top + 4) z -= (top + 4 - y) * 1.0;                                // sloped crown plane
            if (y > yM + 2) z -= (y - yM - 2) * 0.9;                                  // chin guard slopes back
            if (!vo && Math.abs(dc) < 5.5 && y >= yN - 1 && y <= chin - 2) z += 3;     // respirator snout
            return z;
        };
        for (let y = hp[0][0]; y <= chin + 2; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24, w = hwH(y);
            if (w <= 0 || (dx < 0 ? -dx > w * 0.9 : dx > w * 1.06)) continue;       // turned head: the left side is foreshortened
            put(x, y, zH(dx, y), sc(hm, 0.92 + 0.16 * rnd(x, y)), 3);
        }
        const vis = f === 'pirate' ? 'none' : p.visor;   // visor shape follows the faction
        const dark = [5, 8, 12], gl = blink ? sc(glow, 0.3) : glow, vw = ex + 4, tr = sc(trim, 0.85);
        const rect = (x0, x1, y0, y1, c, a) => { for (let x = Math.round(x0); x < Math.round(x1); x++) for (let y = y0; y <= y1; y++) dec(x, y, c, a == null ? 1 : a); };
        const seam = [sc(hm, 0.5), 1];
        if (!vo) {   // hard-edged machine decor: voidborn get organic growth instead (below)
        // heavy brow plate over the visor
        rect(cf - vw * 0.9 - 1, cf + vw * 1.15 + 1, yE - 3, yE - 2, sc(hm, 0.55));
        if (vis === 'dual') {
            [[cf - ex, 2.5], [cf + ex, 3.5]].forEach(([c, hwid]) => { rect(c - hwid, c + hwid, yE - 1, yE + 1, dark); rect(c - hwid + 1, c + hwid - 1, yE + 1, yE + 1, gl); });
        } else if (vis !== 'none') {
            const x0 = cf - vw * 0.9, x1 = cf + vw * 1.15;                           // trapezoid glass: narrower at the top
            rect(x0 + 2, x1 - 2, yE - 1, yE - 1, dark); rect(x0 + 1, x1 - 1, yE, yE, dark); rect(x0, x1, yE + 1, yE + 1, dark);
            rect(x0 + 1, x1 - 1, yE + 1, yE + 1, gl, 0.95);
            if (vis === 'round') { rect(cf - 1, cf + 1, yE + 2, yN, dark); rect(cf - 1, cf + 1, yN, yN, gl, 0.8); }
            rect(x0 + 3, x0 + 6, yE, yE, [40, 60, 80], 0.5);                          // glass glint
        }
        for (let y = top - 3; y < yE - 3; y++) if (rnd(1, y) > 0.2) { dec(cf - 1, y, tr, 0.9); dec(cf, y, tr, 0.9); }   // worn accent stripe along the crown
        const sn = p.snout;                                                                                                          // snout: five different lower-face fittings
        if (sn === 0) for (let k = 0; k < 5; k++) rect(cf - 3, cf + 3, yM + k - 1, yM + k - 1, k % 2 ? sc(hm, 0.75) : [8, 10, 14]);   // filter grille
        else if (sn === 1) for (let k = 0; k < 3; k++) { rect(cf - 5, cf - 1, yM + k * 2 - 1, yM + k * 2 - 1, [8, 10, 14]); rect(cf + 1, cf + 5, yM + k * 2 - 1, yM + k * 2 - 1, [8, 10, 14]); }   // twin vent slits
        else if (sn === 2) { for (let a = 0; a < 24; a++) { const t = a / 24 * 6.283; dec(Math.round(cf + Math.cos(t) * 3.5), Math.round(yM + 1 + Math.sin(t) * 3.5), sc(hm, 0.5), 1); } rect(cf - 1, cf + 1, yM, yM + 2, [8, 10, 14]); }   // round respirator canister
        else if (sn === 3) { rect(cf - 4, cf + 4, yM - 1, yM + 4, sc(hm, 0.6)); for (let x = cf - 3; x <= cf + 3; x += 2) rect(x, x + 1, yM, yM + 3, [8, 10, 14]); }   // boxy vented muzzle
        else { rect(cf - 2, cf + 2, yM - 1, yM + 5, [8, 10, 14]); rect(cf - 1, cf + 1, yM, yM + 4, sc(hm, 0.4)); }                      // single tall breather slot
        const seamLine = (x0, y0, x1, y1) => line(Math.round(x0), y0, Math.round(x1), y1, (x, y) => dec(x, y, seam[0], 0.9));
        seamLine(cf - hwH(top + 6), top + 5, cf + hwH(top + 6) * 1.06, top + 5);                                               // crown / brow plate seam
        seamLine(cf - hwH(yM), yM - 3, cf + hwH(yM) * 1.06, yM - 3);                                                           // jaw plate seam
        seamLine(cf - hwH(yE) * 0.6, yE + 3, cf - hwH(yE) * 0.6, yM - 3); seamLine(cf + hwH(yE) * 0.75, yE + 3, cf + hwH(yE) * 0.75, yM - 3);
        for (let y = top - 3; y <= chin + 2; y++) for (let x = 0; x < W; x++) {                                                // scuffs, dirt and worn edges
            const i = (y + OY) * W + x;
            if (K[i] !== 3) continue;
            const r = rnd(x * 3 + 1, y * 5 + 2);
            if (r < 0.035) dec(x, y, sc(hm, 1.9), 0.55); else if (r > 0.97 && f !== 'terran') dec(x, y, [14, 12, 10], 0.5);
        }
        for (let y = yE + 2; y < yE + 7; y++) if (rnd(2, y) > 0.3) dec(Math.round(cf + vw * 0.9), y, [10, 10, 10], 0.45);       // grime streak under the visor
        if (p.canister) [[-1, 0.6], [1, 1]].forEach(([sd, sz]) => {                                     // side filter canisters
            for (let y = yM - 4; y <= yM + 5; y++) for (let x = 0; x < W; x++) {
                const a2 = (x + 0.5 - (24 + sd * (hwH(yM) - 1.5))) / (2.6 * sz), b2 = (y + 0.5 - (yM + 0.5)) / 5.2;
                if (a2 * a2 + b2 * b2 <= 1) put(x, y, 19 + (1 - a2 * a2 - b2 * b2) * 3, sc(hm, 0.7), 3);
            }
        });
        if (p.lamp) { rect(cf + 3, cf + 6, top + 1, top + 2, sc(glow, 0.9)); rect(cf + 3, cf + 6, top + 3, top + 3, sc(glow, 0.4)); }   // crown lamp
        // Crown hardware: each helm rolls its own crest, fins and stripe on top of the faction shape.
        const hw0 = hwH(top + 6), hot = sc(trim, 1.1);
        if (p.crestK === 1) for (let y = top - 6; y < top + 2; y++) { dec(cf - 1, y, sc(hm, 0.8), 1); dec(cf, y, sc(hm, 1.3), 1); dec(cf + 1, y, sc(hm, 0.8), 1); }              // tall centre fin
        else if (p.crestK === 2) [-1, 1].forEach((sd) => { for (let y = top - 4; y < top + 3; y++) dec(Math.round(cf + sd * hw0 * 0.55), y, sc(hm, 1.2), 1); });                          // twin ridges
        else if (p.crestK === 3) [-1, 1].forEach((sd) => { for (let k = 0; k < 6; k++) { dec(Math.round(cf + sd * (hw0 * 0.9 + k * 0.5)), top + 2 - k, sc(hm, 1.15), 1); dec(Math.round(cf + sd * (hw0 * 0.9 + k * 0.5)), top + 3 - k, sc(hm, 0.7), 1); } });   // swept side horns
        else if (p.crestK === 4) { rect(cf - 4, cf + 5, top - 4, top - 4, hot, 0.95); rect(cf - 3, cf + 4, top - 3, top - 3, sc(hm, 0.6)); }                                        // flat visor-lid crown plate
        if (p.fins === 1) [-1, 1].forEach((sd) => { for (let y = yE - 2; y <= yE + 3; y++) dec(Math.round(cf + sd * (hwH(y) + 1.5)), y, sc(hm, 1.25), 1); });                       // cheek fins
        else if (p.fins === 2) [-1, 1].forEach((sd) => { for (let k = 0; k < 4; k++) dec(Math.round(cf + sd * (hwH(yM) + 1 + k * 0.6)), yM + 2 - k, hot, 0.9); });                         // jaw vanes
        if (p.stripe === 1) for (let y = yE + 4; y < yM - 3; y++) { dec(cf - 4, y, hot, 0.8); dec(cf + 4, y, hot, 0.8); }                                                           // paired cheek stripes
        else if (p.stripe === 2) rect(cf - hw0 * 0.8, cf + hw0, top + 5, top + 5, hot, 0.9);                                                                                          // brow band
        else if (p.stripe === 3) for (let y = top; y < yE - 4; y += 2) rect(cf - 2, cf + 3, y, y, hot, 0.85);                                                                         // ladder marks
        }
        // Faction helmet shapes on top of the shared shell.
        const hi = sc(hm, 1.6), bone = [226, 218, 180], red = [176, 52, 44];
        if (f === 'terran') {                                                       // pilot dome: ear cups, chin strap, visor-hood ridge
            const sky = sc(acc, 1.1), white = [236, 240, 248];
            [[-1, 0.9, 2], [1, 1.06, 3]].forEach(([sd, k, wd]) => {                    // angular ear guards: flat plate, speaker ring, vent slots
                const ox = 24 + sd * hwH(yE + 2) * k;
                for (let y = yE - 4; y <= yM - 1; y++) for (let w = 0; w <= wd + (y > yE - 2 && y < yM - 3 ? 1 : 0); w++) {
                    const x = Math.round(ox + sd * (w - 0.5)), edge = y === yE - 4 || y === yM - 1 || w === wd;
                    put(x, y, 16 + w * 0.5, edge ? sc(hm, 0.62) : sc(hm, 1.08), 3);
                }
                const cy = Math.round((yE + yM) / 2) - 2;
                [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => dec(Math.round(ox + sd * 0.5) + dx * sd, cy + dy, dx || dy ? sc(hm, 0.5) : sc(acc, 1.1), 0.95));   // speaker
                for (let v = 0; v < 2; v++) dec(Math.round(ox + sd * 0.5), yM - 4 + v, sc(hm, 0.45), 0.9);
            });
            if (vb < 2) { line(Math.round(24 + hwH(yE + 2) * 1.06 + 2), yM - 3, cf + 5, yM + 3, (x, y) => put(x, y, 20, [30, 32, 38], 3));   // mic boom on some helms
            put(cf + 5, yM + 3, 21, [210, 70, 60], 3); }
            if (vb === 3) for (let x = Math.round(24 - hwH(top + 6) * 0.9); x <= Math.round(24 + hwH(top + 6) * 1.06); x++) dec(x, top + 8, sc(sky, 0.9), 0.9);   // neck-scarf style brow band
            for (let y = top - 3; y < yE - 3; y++) {                                  // crown marking differs per helm: stripe / twin / ridge / chevron rows
                if (va === 0) { dec(cf - 1, y, white, 0.95); dec(cf, y, white, 0.95); dec(cf + 1, y, sc(sky, 0.9), 0.9); }
                else if (va === 1) { dec(cf - 2, y, white, 0.95); dec(cf + 2, y, white, 0.95); }
                else if (va === 2) { dec(cf, y, sc(sky, 1.1), 1); if (y < yE - 6) put(cf, y, 24, sc(hm, 1.4), 3); }
                else if ((y - top) % 3 === 0) for (let x = cf - 2; x <= cf + 2; x++) dec(x, y, x === cf ? sky : white, 0.95);
            }   // clean crown stripe
            for (let k = 0; k < 3; k++) { dec(cf - 1 - k, yE - 5 + k, sky, 1); dec(cf + k, yE - 5 + k, sky, 1); }                                // winged chevron on the brow
            for (let x = Math.round(24 - hwH(top + 5) * 0.9); x <= Math.round(24 + hwH(top + 5) * 1.06); x++) dec(x, top + 5, sc(white, 0.85), 0.8);   // polished brow band
            [-1, 1].forEach((sd) => { dec(Math.round(cf + sd * (vw + 1)), yE - 5, [230, 190, 80], 1); });                                       // gilt studs
            line(cf - hwH(yM), yM + 3, cf + 3, chin + 1, (x, y) => dec(x, y, tr, 0.8));
        } else if (f === 'kronax') {                                                // barbarian kabuto: ribbed bowl, flared neck guard, crescent crest, fanged oni mask
            const lac = [[112, 26, 22], [28, 30, 56], [34, 70, 44], [150, 140, 118]][vb], gold = [[208, 168, 70], [190, 196, 210], [208, 168, 70], [200, 90, 50]][va], iron = [58, 54, 56];
            const lft = (y) => 24 - hwH(y) * 0.9, rgt = (y) => 24 + hwH(y) * 1.06;
            for (let y = top - 2; y <= yE - 4; y++) for (let x = Math.ceil(lft(y)); x <= Math.floor(rgt(y)); x++) if (((x - cf) % 4 + 4) % 4 === 0) dec(x, y, sc(hm, 0.55), 0.9);   // vertical lames on the bowl
            for (let x = Math.round(lft(top + 4)); x <= Math.round(rgt(top + 4)); x++) { dec(x, top + 3, gold, 0.95); dec(x, top + 4, sc(iron, 1.4), 1); }   // brow rim
            [-1, 1].forEach((sd) => {                                                // shikoro: stacked plates flaring out over the neck/ears
                for (let r = 0; r < 2 + va; r++) {
                    const y0 = yE + 1 + r * 3, edge = hwH(y0) + 1 + r * 2.2;
                    for (let y = y0; y < y0 + 3; y++) for (let k = 0; k < edge - hwH(y0) + 2; k++) {
                        const x = Math.round(24 + sd * (hwH(y0) * (sd < 0 ? 0.9 : 1.06) + k - 1) - (sd < 0 ? 0 : 0));
                        put(x, y, 14 - r, y === y0 + 2 ? sc(iron, 0.7) : sc(r % 2 ? lac : iron, 1.1 - 0.06 * r), 3);
                    }
                }
            });
            for (let k = 0; k <= 16; k++) {                                          // maedate: broad crescent crest rising from the brow
                const t = k / 16, a = t * [1.25, 0.9, 1.5, 0][va], sz = [10, 7, 12, 0][va], cx = Math.sin(a) * sz, cy = (1 - Math.cos(a)) * -sz * 0.9;
                [-1, 1].forEach((sd) => { const hx = cf + sd * (2 + cx), hy = top + 2 + cy - 2; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= (t > 0.8 ? 0 : 1); dy++) put(Math.round(hx + dx), Math.round(hy + dy), 24, sc(gold, dy < 0 ? 1.1 : 0.8), 2); });
            }
            for (let y = top - 1; y < top + 3; y++) for (let x = cf - 1; x <= cf + 1; x++) put(x, y, 24, gold, 2);          // crest mount
            // Lower face: six different masks (and their own colour roll), so no two kronax share the same mouth and jaw.
            const MC = [lac, [112, 26, 22], [28, 30, 56], [34, 70, 44], [150, 140, 118], [70, 52, 36], [90, 90, 98]][p.maskCol], mk = p.mask, lacM = MC;
            const fill = (y0, y1, col, a) => { for (let y = y0; y <= y1; y++) for (let x = Math.ceil(lft(y)); x <= Math.floor(rgt(y)); x++) dec(x, y, col, a); };
            const teeth = (n, y0) => { for (let k = 0; k < n; k++) { const tx = Math.round(cf - (n - 1) + k * 2); dec(tx, y0, [236, 230, 210], 1); if (k % 2 === 0) dec(tx, y0 + 1, [236, 230, 210], 1); } };
            if (mk === 0) {                                                          // lacquered half mask, bared teeth, fangs
                fill(yN - 1, chin + 2, sc(lacM, 0.95), 0.92);
                for (let x = Math.round(cf - 5); x <= cf + 5; x++) { dec(x, yM, [236, 230, 210], 1); if ((x & 1) === 0) dec(x, yM + 1, [236, 230, 210], 1); }
                [-1, 1].forEach((sd) => line(cf + sd * 5, yM, cf + sd * 6, yM + 5, (x, y) => put(x, y, 22, bone, 2)));
            } else if (mk === 1) {                                                   // open jaw: bare green flesh, big lower tusks, no lacquer
                fill(yM - 1, chin + 1, sc(skin, 0.7), 0.95);
                for (let x = Math.round(cf - 6); x <= cf + 6; x++) dec(x, yM + 1, [14, 8, 8], 1);
                teeth(p.teethN + 2, yM);
                [-1, 1].forEach((sd) => { for (let y = yM - 2; y <= yM + 5; y++) put(cf + sd * (6 + (y > yM + 2 ? 1 : 0)), y, 22, bone, 2); put(cf + sd * 7, yM - 3, 22, bone, 2); });
            } else if (mk === 2) {                                                   // full face plate: slotted breather, no mouth at all
                fill(yE + 2, chin + 2, sc(lacM, 0.8), 0.95);
                for (let k = 0; k < 4; k++) for (let x = cf - 4; x <= cf + 4; x++) dec(x, yN + k * 2, [8, 6, 8], 1);
                for (let y = yN - 1; y <= yM + 6; y++) { dec(cf - 6, y, sc(iron, 1.3), 1); dec(cf + 6, y, sc(iron, 1.3), 1); }
                dec(cf, yE + 3, gold, 1); dec(cf, yE + 4, gold, 1);
            } else if (mk === 3) {                                                   // spider jaws: four splayed mandibles
                fill(yM - 3, chin, sc(iron, 0.9), 0.85);
                [-1, 1].forEach((sd) => { for (let k = 0; k < 2; k++) line(cf + sd * (2 + k * 3), yM - 2, cf + sd * (5 + k * 4), yM + 6 + k, (x, y) => put(x, y, 22, k ? bone : sc(bone, 0.8), 2)); });
                for (let x = cf - 2; x <= cf + 2; x++) dec(x, yM, [8, 4, 4], 1);
            } else if (mk === 4) {                                                   // chain veil: dotted mail curtain under the nose
                fill(yN, chin + 3, sc(iron, 1.0), 0.9);
                for (let y = yN; y <= chin + 3; y++) for (let x = Math.ceil(lft(y)); x <= Math.floor(rgt(y)); x++) if ((x + y) % 2 === 0) dec(x, y, sc(hm, 1.5), 0.8);
                for (let x = cf - 4; x <= cf + 4; x++) dec(x, yN - 1, gold, 1);
                [-1, 1].forEach((sd) => dec(cf + sd * 3, yM + 2, [226, 218, 180], 1));
            } else {                                                                 // snarling beast: wide lacquer muzzle with long upper fangs and a ragged beard
                fill(yN - 2, yM + 1, sc(lacM, 1.1), 0.95);
                for (let x = Math.round(cf - 7); x <= cf + 7; x++) { dec(x, yM + 2, [14, 8, 8], 1); if ((x - cf) % 3 === 0) { dec(x, yM + 3, [236, 230, 210], 1); dec(x, yM + 4, [236, 230, 210], 1); } }
                [-1, 1].forEach((sd) => line(cf + sd * 7, yN, cf + sd * 8, yM + 6, (x, y) => put(x, y, 22, bone, 2)));
            }
            [-1, 1].forEach((sd) => line(cf + sd * 4, yE + 1, cf + sd * 9, yE - 2, (x, y) => dec(x, y, [10, 8, 8], 1)));   // scowling brow
            if (mk !== 2 && mk !== 4) for (let k = 0; k < 9; k++) { const fx = Math.round(cf - 6 + k * 1.5 + hash(k, 2)), fy = chin + 1 + Math.floor(hash(k, 6) * (mk === 5 ? 7 : mk === 3 ? 1 : 4)); for (let y = chin; y <= fy; y++) put(fx, y, 22, hash(k, y) < 0.5 ? [140, 108, 72] : [92, 66, 44], 3); }   // beard / tassels
        } else if (f === 'pirate') {                                                // skull helm: bone face plate, hollow sockets, bared teeth, crossbones
            const bn = [226, 218, 192], bnD = [150, 140, 118], void2 = [8, 6, 6];
            const lft = (y) => 24 - hwH(y) * 0.9, rgt = (y) => 24 + hwH(y) * 1.06;
            for (let y = yE - 3; y <= chin + 1; y++) for (let x = Math.ceil(lft(y)); x <= Math.floor(rgt(y)); x++) {
                const dx = x + 0.5 - cf, w = (rgt(y) - lft(y)) / 2, taper = y > yM + 2 ? 0.7 : 1;
                if (Math.abs(dx) > w * taper) continue;
                dec(x, y, Math.abs(dx) > w * taper - 1.2 ? bnD : sc(bn, 0.92 + 0.12 * hash(x, y)), 0.97);   // bone plate with shaded rim
            }
            [-1, 1].forEach((sd) => {                                                // hollow eye sockets with a glinting pupil
                const sx = cf + sd * (ex + 0.5), sy = yE + 1;
                for (let dy = -2; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx * dx) / 9 + (dy * dy) / 7 <= 1) dec(Math.round(sx + dx), sy + dy, void2, 1);
                dec(Math.round(sx), sy, blink ? [60, 20, 10] : [255, 170, 40], 1); dec(Math.round(sx) + 1, sy, blink ? [40, 10, 6] : [210, 90, 20], 0.9);
            });
            dec(cf, yN - 1, void2, 1); dec(cf - 1, yN, void2, 1); dec(cf, yN, void2, 1); dec(cf + 1, yN, void2, 1); dec(cf, yN + 1, [40, 30, 24], 0.8);   // nose cavity
            {   // coarse teeth reaching down the jaw; every helm gets its own set
                const st = p.idx % 4, y0 = yN + 2, y1 = Math.min(chin, yM + 5), gold2 = [214, 170, 56], hw3 = 7 + (p.idx % 3);
                for (let x = cf - hw3; x <= cf + hw3; x++) for (let y = y0; y <= y1; y++) dec(x, y, void2, 1);            // open mouth
                for (let t = -hw3; t <= hw3; t += 3) {
                    const x0 = cf + t, miss = (st === 2 && (t === -3 || t === 6)), len = st === 3 ? ((t === -hw3 || t >= hw3 - 2) ? y1 - y0 : 3) : (st === 1 ? 3 + ((t / 3 + 8) % 2) * 2 : y1 - y0 - 1);
                    if (miss) continue;
                    for (let k = 0; k < 3; k++) {                                                                                // upper tooth
                        const tl = st === 1 ? Math.max(1, len - Math.abs(k - 1) * 2) : len - (k === 2 ? 1 : 0);
                        for (let y = y0; y < y0 + Math.min(tl, y1 - y0); y++) dec(x0 + k, y, st === 2 && t === 0 ? gold2 : sc(bn, y === y0 + tl - 1 ? 0.8 : 1), 1);
                    }
                }
                if (st !== 3) for (let t = -hw3 + 1; t <= hw3 - 2; t += 3) for (let k = 0; k < 2; k++) for (let y = y1 - (st === 1 ? 2 : 1); y <= y1; y++) dec(cf + t + k, y, sc(bn, 0.9), 1);   // lower row
                for (let y = y0; y <= y1; y += 2) dec(cf - hw3 - 1, y, bnD, 0.9), dec(cf + hw3 + 1, y, bnD, 0.9);
            }
            line(cf - 8, yE - 2, cf - 5, yN - 2, (x, y) => dec(x, y, bnD, 0.9));                                // crack across the brow
            if (va !== 3) [-1, 1].forEach((sd) => { line(cf + sd * 5, top + 5, cf + sd * 9, top + 9, (x, y) => dec(x, y, bn, 1)); line(cf + sd * 9, top + 5, cf + sd * 5, top + 9, (x, y) => dec(x, y, bn, 1)); });   // crossbones on the crown
            if (va !== 3) { dec(cf, top + 6, bn, 1); dec(cf, top + 7, bn, 1); }
            if (va === 1) { const px = cf + ex + 0; for (let dy = -3; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx * dx) / 14 + (dy * dy) / 11 <= 1) dec(px + dx, yE + 1 + dy, [26, 20, 18], 1); line(px - 5, yE - 3, cf - 8, top + 5, (x, y) => dec(x, y, [26, 20, 18], 1)); }   // eye patch + strap
            if (va === 3) for (let x = Math.round(lft(top + 2) - 4); x <= Math.round(rgt(top + 2) + 4); x++) { const e2 = Math.abs(x - cf) / 20; put(x, top - 1 + Math.round(e2 * 3), 22, [30, 24, 22], 4); put(x, top - 2 + Math.round(e2 * 3), 22, [48, 38, 30], 4); }   // tricorn brim
            if (vb === 2) for (let t2 = 0; t2 < 4; t2++) line(cf - 8 + t2 * 4, yE - 6, cf - 6 + t2 * 4, yE - 3, (x, y) => dec(x, y, bnD, 0.9));   // cracked bone
            if (vb === 3) { dec(cf - ex, yE - 1, [214, 170, 56], 1); dec(cf - ex + 1, yE - 1, [214, 170, 56], 1); }
            for (let x = Math.round(cf - 4); x <= cf + 4; x++) dec(x, top + 3, [176, 138, 52], 0.9);              // brass band
        } else if (f === 'machine') {                                               // armoured sensor dome: panels, bolts, servos, cable
            for (let k = 0; k < 3; k++) for (let x = cf - 7 + k * 2; x <= cf + 8 - k * 2; x++) dec(x, top - 1 + k * 2, sc(hm, 0.55), 0.9);
            for (let k = 0; k < 3; k++) rect(cf + 5, cf + 9, top + k * 2, top + k * 2, [8, 10, 14]);
            for (let x = Math.round(cf - vw * 0.9 - 1); x < Math.round(cf + vw * 1.15 + 1); x++) dec(x, yE - 4, (x >> 1) % 2 ? [220, 176, 40] : [20, 20, 24], 0.95);   // hazard stripe over the visor
            [[cf - 6, top + 4], [cf + 7, top + 4], [cf - hwH(yM) + 2, yM - 1], [cf + hwH(yM) - 1, yM - 1], [cf - 8, yE - 6], [cf + 9, yE - 6]].forEach(([bx, by]) => { dec(Math.round(bx), by, hi, 1); dec(Math.round(bx), by + 1, [10, 12, 16], 0.9); });   // bolts
            [-1, 1].forEach((sd) => {                                                // servo pistons at the temples
                const sx = Math.round(24 + sd * (hwH(yE) + 1) - (sd < 0 ? YAW : 0));
                for (let y = yE - 2; y <= yM; y++) { put(sx, y, 21, sc(hm, 1.3), 3); put(sx + sd, y, 21, sc(hm, 0.7), 3); if ((y & 3) === 0) dec(sx, y, gl, 0.9); }
            });
            line(cf + 6, chin, cf + 12, chin + 6, (x, y) => put(x, y, 22, [26, 28, 34], 3));   // exposed cable
            if (va === 0) { line(30, top - 3, 32, top - 12, (x, y) => put(x, y, 22, [80, 86, 96], 3)); put(32, top - 13, 22, gl, 3); }   // single antenna
            else if (va === 1) for (let y = top - 7; y < top + 3; y++) for (let x = cf - 1; x <= cf + 1; x++) put(x, y, 23, sc(hm, 1.5), 3);   // armoured crest
            else if (va === 2) { [-1, 1].forEach((sd) => line(cf + sd * 5, top - 1, cf + sd * 7, top - 9, (x, y) => put(x, y, 22, [80, 86, 96], 3))); }   // twin antennas
            else for (let k = 0; k < 3; k++) for (let x = cf - 6; x <= cf + 6; x++) put(x, top - 3 - k, 20 - k, sc(hm, 1.1 + k * 0.1), 3);   // stepped sensor array
        } else if (vo) {                                                            // organic carapace: ribs, portal slit, glow pores
            const bio = sc(glow, 0.9), shell = sc(hm, 1.25);
            for (let k = 0; k < 2 + va; k++) line(cf - hwH(top + 6 + k * 6) * 0.85, top + 5 + k * 6, cf, top + 2 + k * 6 + (k & 1), (x, y) => dec(x, y, sc(shell, 0.6 + 0.1 * k), 0.8));   // curved ribs
            const sk = p.slit == null ? 0 : p.slit;                                    // slit shape: every voidborn gets its own opening
            const y0 = top + 4 + (sk === 6 ? 3 : 0), y1 = yM + 3 - (sk === 6 ? 2 : 0), mid = (y0 + y1) / 2;
            const PROF = [
                (t) => Math.sqrt(Math.max(0, 1 - t * t)),                              // 0 oval
                (t) => Math.max(0, 1 - Math.abs(t)),                                   // 1 diamond / lens
                (t) => Math.max(0, Math.pow(1 - (t + 1) / 2, 0.8) * 1.15) * (t > 0.92 ? 0.3 : 1),   // 2 teardrop: wide at the top, tapering down
                (t) => 0.3 + 0.7 * Math.pow(Math.abs(t), 1.4),                         // 3 hourglass: pinched in the middle
                (t) => Math.sqrt(Math.max(0, 1 - t * t)) * 0.55 + 0.1,                 // 4 crescent: thin, bowed sideways
                (t) => 0.55 + 0.45 * Math.sin((t + 1) * 6.2) ,                         // 5 jagged: beaded, uneven
                (t) => (Math.abs(t) > 0.85 ? 0.5 : 1),                                 // 6 short square slot
                (t) => Math.max(0, Math.pow((t + 1) / 2, 0.8) * 1.15) * (t < -0.92 ? 0.3 : 1)       // 7 inverted teardrop: wide at the bottom
            ];
            const shiftOf = (t) => sk === 4 ? Math.round(2.2 * (1 - t * t) - 1.1) : 0;   // crescent bows sideways
            const vf = p.vface || 0, dk = [4, 2, 12], rimC = blink ? sc(glow, 0.35) : sc(glow, 0.95), lit = blink ? sc(glow, 0.4) : [255, 255, 255];
            const orb = (cx, cy, r, core) => {                                          // round opening: dark core, glowing rim, bright pupil
                for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
                    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
                    if (d <= r - 1) dec(x, y, core ? dk : sc(glow, 0.55), 1); else if (d <= r) dec(x, y, rimC, 1); else if (d <= r + 1) dec(x, y, sc(shell, 0.45), 0.8);
                }
                if (core) dec(Math.round(cx - 0.5), Math.round(cy - 0.5), lit, 1);
            };
            const ymid = Math.round(mid);
            if (vf === 1) orb(cf, ymid - 1, 6, true);                                                      // one great cyclopean eye
            else if (vf === 2) [-1, 0, 1].forEach((k) => orb(cf, ymid + k * 8 - 1, 3.2, true));          // three stacked eyes
            else if (vf === 3) [[-4, -8], [4, -6], [-2, 0], [5, 3], [-5, 7], [1, 10], [3, -12]].forEach(([dx, dy], k) => orb(cf + dx, ymid + dy, 2 + (k % 2), true));   // eye cluster
            else if (vf === 4) {                                                                         // ring of light around a dark hollow
                for (let y = ymid - 9; y <= ymid + 9; y++) for (let x = cf - 9; x <= cf + 9; x++) {
                    const d = Math.hypot(x + 0.5 - cf, (y + 0.5 - ymid) * 1.05);
                    if (d < 5.5) dec(x, y, dk, 1); else if (d < 8) dec(x, y, rimC, 0.95 - (d - 5.5) * 0.15);
                }
            } else if (vf === 5) {                                                                       // cross-shaped rift
                for (let k = -9; k <= 9; k++) { const w = Math.max(0.5, 2.2 - Math.abs(k) * 0.18); for (let d = -w; d <= w; d += 1) { dec(Math.round(cf + d), ymid + k, Math.abs(d) < w - 1 ? dk : rimC, 1); dec(Math.round(cf + k * 0.9), ymid + Math.round(d), Math.abs(d) < w - 1 ? dk : rimC, 1); } }
            } else if (vf === 6) {                                                                       // wide eye-band: two eyes and a thin brow rift
                for (let x = Math.round(cf - 11); x <= Math.round(cf + 10); x++) { dec(x, ymid - 1, dk, 1); dec(x, ymid, rimC, 0.9); dec(x, ymid - 2, sc(shell, 0.45), 0.8); }
                orb(cf - 5, ymid - 1, 3.4, true); orb(cf + 5, ymid - 1, 3.4, true);
            } else if (vf === 7) {                                                                       // maw: jagged toothed opening
                for (let y = ymid - 3; y <= ymid + 4; y++) for (let x = cf - 9; x <= cf + 8; x++) { dec(x, y, dk, 1); if (y === ymid - 3 || y === ymid + 4) dec(x, y, rimC, 0.9); }
                for (let x = cf - 8; x <= cf + 7; x += 2) { dec(x, ymid - 2, lit, 0.9); dec(x, ymid - 1, lit, 0.7); dec(x + 1, ymid + 3, lit, 0.9); dec(x + 1, ymid + 2, lit, 0.7); }
                orb(cf, ymid - 10, 2.6, true);
            }
            const petal = (bx, by, ang, len, wmax, bend, c1, c2) => {                                    // one leaf-shaped petal from base (bx,by) along angle `ang` (0 = straight up)
                const dx = Math.sin(ang), dy = -Math.cos(ang);
                for (let u = 0; u <= 1.001; u += 0.02) {
                    const cx = bx + dx * len * u + Math.cos(ang) * bend * Math.sin(u * 3.14), cy = by + dy * len * u + Math.sin(ang) * bend * Math.sin(u * 3.14);
                    const w = wmax * Math.pow(Math.sin(Math.min(1, u * 0.96 + 0.04) * 3.14159), 0.75);
                    for (let q = -w; q <= w; q += 0.5) {
                        const px = Math.round(cx - dy * q), py = Math.round(cy + dx * q), edge = Math.abs(q) > w - 0.9;
                        dec(px, py, edge ? sc(shell, 0.35) : (q < 0 ? sc(c1, 1.4) : sc(c2, 1.55)), 1);
                    }
                }
            };
            if (vf === 8 || vf === 9) {                                                                   // flower buds: petals folded round a glowing heart
                const open = vf === 9, by = ymid + 11, n = open ? 7 : 5;
                if (open) orb(cf, by - 9, 4, true);                                                        // the heart shows between spread petals
                const order = []; for (let k = 0; k < n; k++) order.push(k);
                order.sort((a2, b2) => Math.abs(b2 - (n - 1) / 2) - Math.abs(a2 - (n - 1) / 2));           // outer petals first, centre one on top
                order.forEach((k) => {
                    const f2 = (k - (n - 1) / 2) / ((n - 1) / 2), ang = f2 * (open ? 1.25 : 0.42), len = open ? 14 + (1 - Math.abs(f2)) * 4 : 20 - Math.abs(f2) * 3;
                    petal(cf + f2 * (open ? 3 : 2.2), by, ang, len, open ? 3.1 : 3.8, f2 * (open ? -1.5 : 1.2), sc(shell, 0.85 + 0.1 * (1 - Math.abs(f2))), sc(shell, 1.15));
                    if (!open || Math.abs(f2) < 0.5) petal(cf + f2 * (open ? 3 : 2.2), by, ang, len * 0.7, 0.9, 0, blink ? sc(glow, 0.4) : sc(glow, 0.8), blink ? sc(glow, 0.4) : sc(glow, 0.95));   // glowing vein
                });
            }
            if (vf === 0) for (let y = y0 - 1; y <= y1 + 1; y++) {
                const t = (y - mid) / ((y1 - y0) / 2), cc = cf + shiftOf(Math.max(-1, Math.min(1, t)));
                const hw2 = Math.max(0.6, [1.6, 2.2, 2.9, 3.4][vb] * (PROF[sk](Math.max(-1, Math.min(1, t))) * (sk === 4 ? 1.4 : 1)) + 0.6);
                for (let x = Math.floor(cc - hw2 - 1); x <= Math.ceil(cc + hw2); x++) {
                    const d = Math.abs(x + 0.5 - cc) / hw2;
                    if (d <= 0.55) dec(x, y, [4, 2, 12], 1);                              // dark void core
                    else if (d <= 1) dec(x, y, blink ? sc(glow, 0.35) : sc(glow, 1.05 - d * 0.35), 1);   // glowing rim
                    else dec(x, y, sc(shell, 0.45), 0.8);                               // lip of the rift
                }
                if (hash(y, 7) < 0.3) dec(Math.round(cc + (hash(y, 3) - 0.5) * 1.6), y, sc(glow, 0.8), 0.9);   // motes drifting inside
            }
            for (let k = 0; k < 14; k++) { const px = Math.round(cf + (rnd(k, 3) - 0.5) * hwH(top + 10) * 1.6), py = top + 1 + Math.floor(rnd(k, 9) * (yM - top)); dec(px, py, sc(glow, 0.55 + 0.3 * rnd(k, 5)), 0.7); }   // bioluminescent pores
        }
        if (ma) { if (p.gear === 'crest') for (let y = top - 9; y < top + 2; y++) put(cf - 1, y, 22, sc(hm, 1.3), 3), put(cf, y, 22, sc(hm, 1.3), 3); if (p.antenna) line(30, top - 1, 31, top - 11, (x, y) => put(x, y, 22, [60, 64, 72], 3)); }
        extras(cf, hwH);
    };
    const extras = (cf0, hwHf) => {                                           // build-type extras, drawn on top of the finished helm
        const frame = [16, 14, 12], glint = [200, 230, 255], hwE = hwHf(yE);
        if (p.glasses) {                                                          // big round nerd glasses over the visor
            (vo ? [cf0 + 4] : [cf0 - ex, cf0 + ex]).forEach((cx0) => {
                for (let a = 0; a < 40; a++) { const t = a / 40 * 6.283; dec(Math.round(cx0 + Math.cos(t) * 4.4), Math.round(yE + Math.sin(t) * 4.2), frame, 1); dec(Math.round(cx0 + Math.cos(t) * 3.6), Math.round(yE + Math.sin(t) * 3.4), frame, 0.85); }
                dec(Math.round(cx0 - 2), yE - 2, glint, 0.8); dec(Math.round(cx0 - 1), yE - 3, glint, 0.6);
            });
            if (!vo) for (let x = Math.round(cf0 - ex + 4); x <= Math.round(cf0 + ex - 4); x++) dec(x, yE - 1, frame, 1);   // bridge
        }
        if (vo && p.soft) {                                                       // soft voidborn: flowing tendril locks, lashes, cheek glow
            [-1, 1].forEach((sd) => {
                for (let k = 0; k < 3; k++) {
                    const x0 = cf0 + sd * (hwE * (k === 0 ? 0.95 : 1.1) + k * 1.4);
                    for (let y = top + 8; y < 50; y++) {
                        const bx = Math.round(x0 + sd * Math.sin((y - top) * 0.22 + k) * (1.4 + k * 0.4) + sd * Math.max(0, y - 32) * 0.12);
                        put(bx, y, 12 - k, y % 7 < 2 ? sc(glow, 0.85) : sc(skin, 0.7 - 0.08 * k), 1);
                    }
                }
                for (let k = 0; k < 3; k++) dec(Math.round(cf0 + sd * (k + 2.5)), top + 3 - (k === 2 ? 1 : 0), sc(glow, 1.0), 0.95);   // lashes over the opening
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) < 2.3) dec(Math.round(cf0 + sd * 7 + dx), yM - 3 + dy, glow, 0.22);   // soft cheek glow
            });
        }
        if (p.braid && !vo) {                                                     // long braid hanging over the shoulder
            for (let y = yE + 2; y < 52; y++) {
                const bx = Math.round(cf0 + hwE * 1.06 + 1.5 + Math.sin(y * 0.6) * 1.2 + Math.max(0, y - 40) * 0.3);
                put(bx, y, 12, sc(hair, 0.9 + 0.2 * ((y >> 1) & 1)), 3); put(bx + 1, y, 11, sc(hair, 0.7), 3);
            }
            put(Math.round(cf0 + hwE * 1.06 + 4.5), 52, 12, glow, 3);
        }
        if (p.lashes && !vo) [-1, 1].forEach((sd) => { for (let k = 0; k < 3; k++) dec(Math.round(cf0 + sd * ex * 1.1 + sd * (k + 1)), yE - 3 - (k === 2 ? 1 : 0), [10, 8, 12], 1); });   // long lashes at the visor
        if (p.belly) for (let y = 47; y < 54; y++) for (let x = 0; x < W; x++) { const dx = x + 0.5 - 24, a = dx / 15, b = (y + 0.5 - 56) / 8; if (a * a + b * b <= 1) put(x, y, 9 + (1 - a * a - b * b) * 2, sc(cloth, 1.25), 4); }   // round belly pushing out of the jacket
        if (p.build === 1 && !vo) for (let k = 0; k < 3; k++) { dec(Math.round(cf0 - hwE * 0.7), yE - 5 + k, sc(trim, 0.8), 0.9); dec(Math.round(cf0 + hwE * 0.9), yE - 5 + k, sc(trim, 0.8), 0.9); }   // heavy brow bolts
    };
    if (full) fullHelm();
    else if (f === 'terran' && (p.gear === 'helmet' || p.gear === 'cap')) {
        const brim = yE - 3.5;
        cap(2.2, () => brim, 2.5, metal, 3);
        for (let y = top - 6; y < brim; y++) dec(23, y, sc(metalHi, 0.85), 1), dec(24, y, sc(metalHi, 0.85), 1);
        if (p.gear === 'helmet') cups(sc(metal, 0.85));
    } else if (f === 'terran' && p.gear === 'headset') {
        cups(sc(metal, 0.8));
        for (let x = 0; x < W; x++) { const dx = x + 0.5 - 24, w = hwG(top - 1, 2.2), y = Math.round(top - 3 + 8 * (dx / (hw(0.45) + 3)) ** 2); if (Math.abs(dx) <= hw(0.45) + 3 && w >= 0) put(x, y, 14, sc(metal, 0.8), 3); }
    } else if (f === 'pirate' && (p.gear === 'bandana' || p.gear === 'headband')) {
        const y0 = top + 0.14 * hh, y1 = y0 + (p.gear === 'bandana' ? 6 : 3.5);
        for (let y = Math.floor(y0); y <= y1; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24, w = hwG(y, 1.4);
            if (Math.abs(dx) <= w && w > 0) put(x, y, zHead(dx, y, 1.4, 2.4), (x + y) % 5 === 0 ? [150, 40, 36] : [176, 52, 44], 4);
        }
        if (p.gear === 'bandana') { put(Math.round(24 + hw(0.2) + 2), Math.round(y1), 9, [150, 40, 36], 4); put(Math.round(24 + hw(0.2) + 3), Math.round(y1 + 1), 9, [150, 40, 36], 4); put(Math.round(24 + hw(0.2) + 2), Math.round(y1 + 2), 9, [120, 30, 28], 4); }
    } else if (kr && (p.gear === 'horns' || p.gear === 'helm')) {
        if (p.gear === 'helm') cap(2, () => yE - 4, 2.2, [70, 52, 40], 3);
        [-1, 1].forEach((sd) => line(24 + sd * (hw(0.1) - 1), top + 2, 24 + sd * (hw(0.1) + 6), top - 9, (x, y) => { put(x, y, 11, [226, 218, 180], 2); put(x + sd, y, 11, [200, 190, 150], 2); }));
    } else if (kr && p.gear === 'mohawk') {
        for (let y = top - 7; y < top + 10; y++) for (let x = 22; x < 26; x++) if (Math.abs(x + 0.5 - 24) < 2.2 - Math.max(0, y - top - 5) * 0.2) put(x, y, 12 - Math.abs(x + 0.5 - 24), sc(acc, 0.9 + 0.2 * hash(x, y)), 2);
    } else if (ma) {
        cap(p.gear === 'dome' ? 2.6 : 1.8, () => yE - 3, p.gear === 'dome' ? 3.4 : 2.2, sc(metal, 0.95), 3);
        for (let y = top - 6; y < yE - 3; y++) dec(23, y, [24, 28, 36], 1), dec(24, y, [24, 28, 36], 1);
        if (p.gear === 'crest') for (let y = top - 9; y < top + 2; y++) put(23, y, 15, metalHi, 3), put(24, y, 15, metalHi, 3);
        if (p.antenna) line(30, top - 1, 31, top - 11, (x, y) => put(x, y, 14, [60, 64, 72], 3));
    }
    if (vo) {
        for (let k = 0; k < p.tent; k++) {
            const x0 = 24 + (k - (p.tent - 1) / 2) * 2.3;
            for (let j = 0; j < 4 + (p.idx % 4) * 1.5; j++) put(Math.round(x0 + Math.sin(j * 0.9 + k) * 1.1 - 0.5), chin - 2 + j, 8, j > 4 ? sc(glow, 0.9) : sc(skin, 0.62), 1);
        }
    }
    // ---- decals: brows, eyes, nose, mouth, beard, scars (flat colour on top of the lit surface) ----
    if (!full) {
    const lid = sc(skin, 0.55), brC = sc(hair, 0.75);
    [-1, 1].forEach((sd) => {
        const px = Math.round(24 + sd * ex - 0.5);
        if (vo || ma) return;
        for (let d = -2; d <= 2; d++) {
            const lift = p.slant > 0 ? (d * sd < 0 ? 1 : 0) : (p.slant < 0 ? (d * sd > 0 ? 1 : 0) : 0);
            dec(px + d, yE - 3 + lift, brC, 1, true);
            if (p.brow > 1.2) dec(px + d, yE - 2 + lift, sc(brC, 1.2), 1, true);
        }
        if (p.patch === sd) { for (let d = -2; d <= 2; d++) for (let r = -2; r <= 1; r++) dec(px + d, yE + r, [8, 8, 12], 1, true); line(px - sd * 2, yE - 2, 24 - sd * 9, top + 3, (x, y) => dec(x, y, [10, 10, 14], 1)); return; }
        const iris = kr ? [150, 30, 26] : sc(eyeC, 0.7), scl = kr ? [200, 186, 110] : [206, 202, 198];
        for (let d = -2; d <= 2; d++) dec(px + d, yE - 1, lid, 1, true);
        if (p.female) dec(px + sd * 3, yE - 1, lid, 1, true);
        if (blink) { for (let d = -2; d <= 2; d++) dec(px + d, yE, sc(skin, 0.5), 1, true); return; }
        dec(px - 2, yE, sc(scl, sd < 0 ? 0.95 : 0.8), 1, true); dec(px + 2, yE, sc(scl, sd > 0 ? 0.95 : 0.8), 1, true);
        dec(px - 1, yE, iris, 1, true); dec(px, yE, [8, 8, 12], 1, true); dec(px + 1, yE, sc(iris, 0.8), 1, true);
        dec(px - 1, yE, sc(iris, 1.9).map((v) => Math.min(255, v + 30)), 0.8, true);
        for (let d = -1; d <= 1; d++) dec(px + d, yE + 1, sc(skin, 0.72), 1, true);
    });
    if (vo) [-1, 1].forEach((sd) => {                                                 // glowing void eyes
        const px = Math.round(24 + sd * ex - 0.5), on = blink ? 0 : 1;
        for (let d = -2; d <= 2; d++) dec(px + d, yE - 1, [14, 10, 28], 1, true);
        for (let d = -2; d <= 2; d++) dec(px + d, yE, on ? (d === 0 ? [255, 255, 255] : glow) : [14, 10, 28], 1, true);
        for (let d = -1; d <= 1; d++) dec(px + d, yE + 1, [14, 10, 28], 1, true);
        if (p.eyesN >= 4) dec(24 + sd * 3 - (sd > 0 ? 0 : 1), yE - 6, glow, 1, true);
        if (p.eyesN >= 6) dec(24 + sd * 7 - (sd > 0 ? 0 : 1), yE + 5, glow, 1, true);
    });
    if (ma) {                                                                         // visor and vents
        const vw = (p.visor === 'dual' ? ex + 3 : ex + 4) - p.plateW + 1;
        for (let x = 24 - vw; x < 24 + vw; x++) for (let y = yE - 1; y <= yE + 1; y++) dec(x, y, [10, 12, 16], 1);
        const segs = p.visor === 'dual' ? [[-ex - 2, -ex + 2], [ex - 2, ex + 2]] : p.visor === 'round' ? [[-1, 1]] : [[-vw + 1, vw - 1]];
        segs.forEach(([a, b]) => { for (let x = Math.round(24 + a); x < Math.round(24 + b); x++) dec(x, yE, blink ? sc(trim, 0.4) : trim, 1); });
        for (let k = 0; k < 4; k++) for (let x = 21; x < 27; x++) dec(x, yM - 1 + k, k % 2 ? sc(skin, 0.7) : [14, 18, 22], 1);
        line(24, yE + 3, 24, yN, (x, y) => dec(x, y, [40, 46, 54], 1));
    }
    if (!vo && !ma) {
        dec(22, yN + 1, sc(skin, 0.42), 1, true); dec(25, yN + 1, sc(skin, 0.42), 1, true); dec(23, yN + 1, sc(skin, 0.6), 1, true); dec(24, yN + 1, sc(skin, 0.6), 1, true);
        const m = kr ? 3 : 2, lipC = [skin[0] * 0.92 + 6, skin[1] * 0.78, skin[2] * 0.76];
        for (let d = -m; d < m; d++) { dec(24 + d, yM - 1, sc(lipC, 0.9), 1, true); dec(24 + d, yM, sc(skin, 0.24), 1, true); dec(24 + d, yM + 1, sc(lipC, p.lips > 1.1 ? 1.2 : 1.05), 1, true); }
        dec(24 - m - 1, yM, sc(skin, 0.4), 1, true); dec(24 + m, yM, sc(skin, 0.4), 1, true);
        if (p.lips > 1.1) dec(24, yM - 1, sc(lipC, 1.1), 1, true);
        if (p.tusks) [-1, 1].forEach((sd) => { for (let y = yM - 3; y <= yM + 1; y++) put(sd < 0 ? 24 - m - 2 : 24 + m + 1, y, 13, [226, 218, 180], 2); });
        if (kr) [-1, 1].forEach((sd) => { for (let d = -2; d <= 2; d++) dec(Math.round(24 + sd * ex - 0.5) + d, yE + 3, sc(trim, 0.9), 1, true); });   // war paint
        if (p.beard) for (let y = yM - 2; y <= chin; y++) for (let x = 0; x < W; x++) {
            const dx = x + 0.5 - 24, w = hw((y + 0.5 - top) / hh);
            if (Math.abs(dx) > w - 0.5 || (p.beard === 1 && hash(x, y) > 0.38) || (y >= yM - 1 && y <= yM + 1 && Math.abs(dx) < 3.5) || (y < yM && Math.abs(dx) < w * 0.7)) continue;
            dec(x, y, p.beard === 2 ? hairSh(x, y) : sc(hair, 0.7), p.beard === 2 ? 0.92 : 0.5, true);
        }
        if (p.hairStyle === 'bald' && !helmed && !kr) for (let y = top; y < yE - 5; y++) for (let x = 0; x < W; x++) if (hash(x, y) < 0.18 && y < top + 0.2 * hh) dec(x, y, sc(hair, 0.9), 0.35, true);
    }
    if (p.scar && !vo && !ma) {
        const sd = p.scar === 1 ? -1 : 1, sx = 24 + sd * ex;
        if (p.scar === 1) line(Math.round(sx - 1), yE - 5, Math.round(sx + 2), yE + 4, (x, y) => dec(x, y, [214, 150, 140].map((v, i) => v * 0.6 + skin[i] * 0.4), 1, true));
        else line(Math.round(sx - 3), yE + 6, Math.round(sx + 2), yE + 9, (x, y) => dec(x, y, [214, 150, 140].map((v, i) => v * 0.6 + skin[i] * 0.4), 1, true));
    }
    }
    // ---- expression on the visor: happy arcs and warm cheeks (joy), scowling brow plates and a frown (anger) ----
    if ((joy || mad) && !blink) {
        const cf = 21, hot = mad ? [255, 70, 40] : glow.map((v) => Math.min(255, v + 60)), on = (x, y) => x >= 0 && y >= -OY && x < W && y < H && Z[(y + OY) * W + x] > -50;
        [-1, 1].forEach((sd) => {
            const ox = cf + sd * ex;
            if (joy) {
                for (let d = -3; d <= 3; d++) { const y = yE + 1 - Math.round(1.6 * (1 - (d * d) / 9) + 0.2); if (on(ox + d, y)) dec(ox + d, y, hot, 1); if (on(ox + d, y + 1)) dec(ox + d, y + 1, [6, 8, 12], 1); }   // ^ ^ eyes
                for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) < 3 && on(ox + sd * 2 + dx, yN + dy)) dec(ox + sd * 2 + dx, yN + dy, [255, 120, 140], 0.45);   // blush
            } else {
                line(ox - sd * 4, yE - 1, ox + sd * 4, yE - 5, (x, y) => { if (on(x, y)) dec(x, y, [10, 6, 6], 1); if (on(x, y + 1)) dec(x, y + 1, [10, 6, 6], 1); });   // brows slanting to the nose
                for (let d = -2; d <= 2; d++) if (on(ox + d, yE + 1)) dec(ox + d, yE + 1, hot, 1);
            }
        });
        if (joy) for (let d = -5; d <= 5; d++) { const y = yM + 2 - Math.round(2 * (1 - (d * d) / 25)) + 2; if (on(cf + d, y)) dec(cf + d, y, hot, 0.95); }   // smile
        else {
            for (let d = -5; d <= 5; d++) { const y = yM + 1 + Math.round(2 * (1 - (d * d) / 25)); if (on(cf + d, y)) dec(cf + d, y, [255, 70, 40], 0.95); }   // frown
            [[-1, -3], [1, -4]].forEach(([sd, k]) => { const vx = cf + sd * (ex + 8), vy = top + 3; [[0, 0], [1, 1], [-1, 1], [0, 2]].forEach(([a, b]) => { if (on(vx + a, vy + b + k + 3)) dec(vx + a, vy + b + k + 3, [255, 50, 40], 1); }); });   // anger veins
        }
    }
    // ---- battle damage: cracks, scorch marks and blood on the helm (wounded), a shattered visor on top (dead) ----
    if (hurt || dead) {
        const rr = (a, b) => hash(p.idx * 31 + a, (f.length * 17 + b) | 0);
        const onHelm = (x, y) => x >= 0 && y >= -OY && x < W && y < H && Z[(y + OY) * W + x] > -50 && K[(y + OY) * W + x] !== 4;
        const blood = [120, 8, 10], bloodD = [70, 4, 6], crackC = [6, 6, 8];
        const crack = (x, y, n, seed) => {                                         // jagged random walk, with one side branch
            let ang = rr(seed, 1) * 6.283;
            for (let s = 0; s < n; s++) {
                if (onHelm(Math.round(x), Math.round(y))) dec(Math.round(x), Math.round(y), crackC, 1);
                if (s === (n >> 1)) crack(x, y, n >> 1, seed + 7);
                ang += (rr(seed, s + 3) - 0.5) * 1.6; x += Math.cos(ang); y += Math.sin(ang);
            }
        };
        const nCr = dead ? 4 : 2;
        for (let k = 0; k < nCr; k++) crack(24 + (rr(k, 11) - 0.5) * 14, yE + (rr(k, 12) - 0.6) * 12, dead ? 12 : 8, k * 13 + 5);
        for (let k = 0; k < (dead ? 3 : 2); k++) {                                // scorch patches
            const sx = 24 + (rr(k, 21) - 0.5) * 18, sy = top + 4 + rr(k, 22) * (yM - top), r = 2 + rr(k, 23) * 2.5;
            for (let y = Math.floor(sy - r); y <= sy + r; y++) for (let x = Math.floor(sx - r); x <= sx + r; x++) {
                const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
                if (d <= 1 && onHelm(x, y) && hash(x, y) < 1.1 - d) dec(x, y, [18, 14, 12], 0.75 * (1 - d * 0.5));
            }
        }
        for (let k = 0; k < (dead ? 3 : 1); k++) {                                // blood splash with drips running down
            const bx = 24 + (rr(k, 31) - 0.5) * 16, by = yE - 3 + rr(k, 32) * 8, r = dead ? 2.6 : 1.8;
            for (let y = Math.floor(by - r); y <= by + r; y++) for (let x = Math.floor(bx - r); x <= bx + r; x++) if (Math.hypot(x + 0.5 - bx, y + 0.5 - by) <= r && onHelm(x, y)) dec(x, y, hash(x, y) < 0.3 ? bloodD : blood, 0.95);
            for (let d = 0; d < 3; d++) {
                const dx = Math.round(bx + (d - 1) * 1.4), len = 2 + Math.floor(rr(k * 3 + d, 33) * (dead ? 9 : 5));
                for (let y = Math.round(by); y < by + r + len; y++) if (onHelm(dx, y)) dec(dx, y, y > by + r + len - 2 ? bloodD : blood, 0.9);
            }
        }
        if (dead) for (let y = yE - 3; y <= yE + 4; y++) for (let x = 24 - ex - 6; x <= 24 + ex + 6; x++) {   // shattered visor: dark hole with glass shards
            if (!onHelm(x, y)) continue;
            const h = hash(x * 7 + 3, y * 5 + 1);
            if (h < 0.08) dec(x, y, [150, 160, 170], 0.9); else if (h < 0.5 && Math.abs(y - (yE + 0.5)) < 2.5) dec(x, y, [3, 3, 5], 1);
        }
    }
    // ---- light the depth buffer ----
    const out = new Uint8ClampedArray(N * 4), L = [-0.5, -0.6, 0.62], ll = Math.hypot(...L);
    const zAt = (x, y, z0) => (x < 0 || y < -OY || x >= W || y >= H || Z[(y + OY) * W + x] < -50 ? z0 - 7 : Z[(y + OY) * W + x]);
    const filled = (x, y) => x >= 0 && y >= -OY && x < W && y < H && Z[(y + OY) * W + x] > -50;
    for (let y = -OY; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y + OY) * W + x, o = i * 4;
        if (Z[i] < -50) {
            const edge = filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1);
            if (transparent && !edge) { out[o + 3] = 0; continue; }
            const d = Math.min(1, Math.hypot((x - 24) / 30, (y - 20) / 36)), sl = y % 2 ? 0.93 : 1;
            let c = [14 - 10 * d, 34 - 26 * d, 62 - 44 * d].map((v) => v * sl);
            if (edge) c = [4, 6, 12];
            out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
            continue;
        }
        const z = Z[i], dzx = (zAt(x + 1, y, z) - zAt(x - 1, y, z)) * 0.5, dzy = (zAt(x, y + 1, z) - zAt(x, y - 1, z)) * 0.5;
        const nl = Math.hypot(dzx * 0.8, dzy * 0.8, 1), dt = (-dzx * 0.8 * L[0] - dzy * 0.8 * L[1] + L[2]) / (nl * ll);
        const q = Math.floor(Math.max(0, Math.min(1, 0.2 + 0.85 * dt)) * 6) / 6;
        const m = 0.34 + q * 0.95;
        let c = [C[i * 3] * m - 5 * (1 - q), C[i * 3 + 1] * m, C[i * 3 + 2] * m + 8 * (1 - q)];
        if (K[i] === 3 && dt > 0.92) c = c.map((v) => v + 50);
        const rt = zAt(x + 1, y, z) < z - 4;
        if (rt) c = c.map((v, k) => v + acc[k] * 0.3);
        if (zAt(x - 1, y, z) > z + 5 || zAt(x, y - 1, z) > z + 5 || zAt(x + 1, y, z) > z + 5 || zAt(x, y + 1, z) > z + 5) c = c.map((v) => v * 0.45);   // contact shadow where a nearer part overlaps
        const a = D[i * 4 + 3];
        if (a > 0) c = c.map((v, k) => v * (1 - a) + D[i * 4 + k] * a * (0.55 + q * 0.5));
        if (dead) { const gy = (c[0] + c[1] + c[2]) / 3; c = c.map((v) => (v * 0.35 + gy * 0.65) * 0.72); }   // lifeless: drained of colour, dimmed
        else if (hurt) c = [c[0] * 1.04 + 6, c[1] * 0.92, c[2] * 0.9];
        out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
    return out;
};
