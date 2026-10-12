"use strict";

// Voxel pilot portraits, part 2b: live backdrops. Each faction has its own world and architecture behind the pilot:
// terran = ship bridge window onto a planet sky, kronax = forge hall with embers, voidborn = swirling rift,
// pirate = night cabin with a swaying lantern and a porthole sea, machine = server vault with data pulses.
// VXP.background(faction, t, accent) -> RGBA bytes (W x H, opaque) for time t in seconds; cheap enough for every frame.
VXP.background = (() => {
    const W = VXP.W, H = VXP.H, N = W * H;
    const hash = (x, y) => { const h = VXP.hash(x | 0, y | 0); return h - Math.floor(h); };   // VXP.hash can be negative: fold into 0..1, or every `hash < p` test is true for half the pixels (that was the white noise)
    const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

    // Each pilot gets its own backdrop variant (preset.bgv): `rv(n)` is a stable 0..1 value per variant, so the same
    // pilot always sees the same room, but no two pilots of a faction share one.
    let rv = () => 0.5;
    const pickOf = (n, list) => list[Math.floor(rv(n) * list.length) % list.length];

    const painters = {
        terran(put, t) {
            const wall = pickOf(1, [[10, 18, 34], [8, 28, 30], [26, 16, 36], [30, 24, 14], [16, 20, 24], [34, 14, 18]]);
            const pl = pickOf(2, [[[20, 60, 120], [90, 150, 210]], [[110, 50, 30], [220, 150, 90]], [[40, 90, 60], [140, 210, 150]], [[70, 40, 110], [190, 150, 230]]]);   // window-tint accent for the scan bar
            
            const wx0 = 3 + Math.floor(rv(7) * 5), wx1 = 45 - Math.floor(rv(8) * 5), wy1 = 28 + Math.floor(rv(9) * 8), mull = Math.floor(rv(10) * 3);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                let c = scl(wall, 1.15 - y / H * 0.7);
                if (x % 12 === 0) c = scl(c, 1.5);                                          // wall plating seams
                if (y % 9 === 0) c = scl(c, 1.25);
                put(x, y, c);
            }
            // The viewport looks out over a planet: every pilot gets its own sky (day, dusk, night, dust, storm, aurora)
            // and its own horizon (city skyline or mountains), all in motion.
            const st = Math.floor(rv(11) * 6), yh = 6 + (wy1 - 6) * (0.6 + rv(12) * 0.18), city = rv(13) > 0.5;
            const SKY = [[[60, 120, 215], [175, 215, 248]], [[70, 48, 120], [252, 150, 84]], [[3, 5, 20], [22, 30, 64]], [[150, 80, 50], [232, 172, 120]], [[66, 72, 86], [132, 138, 148]], [[3, 7, 22], [10, 28, 42]]][st];
            const sunX = wx0 + 6 + rv(14) * (wx1 - wx0 - 14);
            for (let y = 6; y < wy1; y++) for (let x = wx0 + 1; x < wx1 - 2; x++) {
                let c;
                if (y < yh) {
                    c = mix(SKY[0], SKY[1], (y - 6) / (yh - 6));
                    if (st !== 2 && st !== 5) {                                                // drifting clouds (two layers, different speeds)
                        const cl = Math.sin((x + t * 2.2) * 0.33 + y * 0.9) * Math.sin((x + t * 1.3) * 0.16 - y * 0.55) + 0.35 * Math.sin((x - t * 3.1) * 0.5 + y * 0.3);
                        if (cl > 0.5) c = mix(c, st === 4 ? [200, 204, 212] : [255, 255, 255], Math.min(0.85, (cl - 0.5) * 1.6));
                    }
                    if (st === 0 || st === 1 || st === 3) {                                    // sun with a soft glow
                        const sy2 = st === 1 ? yh - 3 : 11, sd = Math.hypot(x - sunX, (y - sy2) * 1.15);
                        if (sd < 3.2) c = [255, 244, 200]; else if (sd < 9) c = mix(c, st === 1 ? [255, 190, 90] : [255, 240, 190], (1 - sd / 9) * 0.55);
                    }
                    if (st === 2 || st === 5) {                                                // twinkling stars
                        const hs = hash(x * 3, y * 7);
                        if (hs < 0.014) c = scl([210, 225, 255], 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.2 + hs * 40) + hs * 90)));
                        if (st === 2 && Math.hypot(x - sunX, y - 12) < 3) c = Math.hypot(x - sunX + 1, y - 11) < 2.5 ? [236, 236, 220] : [190, 190, 176];   // moon
                    }
                    if (st === 5) {                                                            // aurora ribbons
                        for (let k = 0; k < 2; k++) { const ay = 11 + k * 5 + 3 * Math.sin(x * 0.22 + t * (0.7 + k * 0.3) + k * 2), d = Math.abs(y - ay); if (d < 2.4) c = mix(c, k ? [120, 255, 190] : [80, 230, 120], (1 - d / 2.4) * 0.8); }
                    }
                    if (st === 4) {                                                            // storm: rain streaks and the odd lightning flash
                        if (hash(x, 9) < 0.18 && (y + Math.floor(t * 18) + Math.floor(hash(x, 4) * 20)) % 9 < 3) c = mix(c, [190, 206, 230], 0.45);   // thin falling streaks
                        if (Math.sin(t * 0.9) > 0.985) c = mix(c, [255, 255, 255], 0.7);
                    }
                } else {                                                                       // horizon: skyline or mountains in silhouette
                    const col = st === 1 ? [22, 12, 24] : st === 3 ? [60, 28, 20] : st === 4 ? [26, 30, 36] : [8, 12, 20];
                    const hgt = city ? 2 + ((hash((x / 3) | 0, 5) * 7) | 0) : 1 + 4 * Math.abs(Math.sin(x * 0.19 + rv(15) * 6)) + 2 * Math.abs(Math.sin(x * 0.07 + 1));
                    const top = yh + 1 - hgt;
                    c = y < yh + 1 ? (y >= top ? col : null) : col;
                    if (!c) c = mix(SKY[0], SKY[1], 1);
                    if (c === col && city && y >= top + 1 && hash(x, y) < 0.18 && Math.sin(t * 0.8 + x * 3 + y) > -0.2) c = [255, 214, 120];   // lit windows
                }
                put(x, y, c);
            }
            const frm = mix(wall, [120, 140, 170], 0.55);
            for (let x = wx0; x < wx1; x++) { put(x, 5, frm); put(x, wy1, frm); }
            for (let y = 5; y <= wy1; y++) { put(wx0, y, frm); put(wx1 - 1, y, frm); if (mull) for (let m = 1; m <= mull; m++) put(Math.round(wx0 + (wx1 - wx0) * m / (mull + 1)), y, scl(frm, 0.65)); }
            for (let x = 0; x < W; x++) for (let y = 40; y < H; y++) put(x, y, scl([16, 26, 44], 0.8 + 0.3 * ((y - 40) / 14)));   // console strip
            for (let k = 0; k < 9; k++) {                                                    // blinking console lights
                const on = Math.sin(t * (1.5 + k * 0.37) + k * 2.1) > 0.15;
                const col = k % 3 === 0 ? [255, 190, 60] : k % 3 === 1 ? [70, 255, 130] : [90, 190, 255];
                put(4 + k * 5, 43, scl(col, on ? 1 : 0.25)); put(5 + k * 5, 43, scl(col, on ? 1 : 0.25));
            }
        },
        kronax(put, t) {
            const stone = pickOf(1, [[30, 16, 12], [26, 18, 16], [34, 14, 10], [22, 20, 22]]), bw = pickOf(2, [8, 6, 10]);
            const arch = 11 + rv(3) * 8, archTop = 10 + rv(4) * 8, lavaC = pickOf(5, [[[200, 70, 14], [90, 20, 6]], [[230, 120, 20], [120, 40, 8]], [[210, 30, 20], [80, 8, 8]], [[120, 200, 60], [30, 80, 14]]]);
            const torchX = pickOf(6, [[6, 42], [4, 44], [9, 39], [24]]);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const brick = ((y >> 2) + (((y >> 2) & 1) ? 3 : 0) + (x / bw | 0)) % 2;      // heavy stone blocks
                let c = brick ? stone : scl(stone, 0.8);
                if (y % 4 === 0 || (x + ((y >> 2) & 1) * (bw >> 1)) % bw === 0) c = scl(stone, 0.4);
                put(x, y, c);
            }
            for (let y = 8; y < H; y++) for (let x = Math.floor(24 - arch); x < 24 + arch; x++) {   // a great arch looking out onto a lava field
                const dx = x + 0.5 - 24, top = archTop + (1 - Math.min(1, Math.abs(dx) / arch)) * -5 + Math.abs(dx) * Math.abs(dx) * 0.03;
                if (y < top) continue;
                const hz = 34 + Math.sin(x * 0.4 + t * 1.2) * 1.2;
                let c = y < hz ? mix([40, 8, 6], [150, 40, 12], (y - top) / (hz - top + 1)) : mix(lavaC[0], lavaC[1], (y - hz) / (H - hz));
                if (y >= hz) c = scl(c, 0.8 + 0.25 * Math.sin(x * 0.7 + y * 0.9 - t * 2.4));   // flowing lava
                put(x, y, c);
            }
            for (let k = 0; k < 16; k++) {                                                   // embers rising
                const sp = 4 + (k % 5), ex = (hash(k, 1) * 36 + 6 + Math.sin(t * 0.9 + k) * 2) | 0, ey = H - ((t * sp + hash(k, 2) * H) % H);
                put(ex, ey | 0, [255, 150 + (hash(k, 3) * 80 | 0), 40]);
            }
            torchX.forEach((tx, i) => {                                                    // wall torches
                for (let y = 10; y < 22; y++) {
                    const fl = Math.sin(t * 9 + i * 3 + y * 0.7) * 1.6, w = Math.max(0, 3.2 - (y - 10) * 0.28);
                    for (let x = Math.round(tx - w + fl * 0.4); x <= Math.round(tx + w + fl * 0.4); x++) put(x, y, y < 14 ? [255, 220, 120] : [255, 110 + (y - 14) * 4, 20]);
                }
                for (let y = 22; y < 40; y++) { put(tx - 1, y, [50, 34, 22]); put(tx, y, [64, 44, 28]); }
            });
        },
        voidborn(put, t) {
            const arms = 2 + Math.floor(rv(1) * 5), arms2 = 3 + Math.floor(rv(2) * 5), twist = 0.2 + rv(3) * 0.35, rx = 14 + rv(4) * 20, ry = 18 + rv(5) * 16;
            const dark = pickOf(6, [[8, 4, 20], [4, 8, 22], [20, 4, 14], [4, 14, 16]]), glowC = pickOf(7, [[150, 40, 190], [60, 70, 220], [200, 50, 120], [40, 170, 190]]), ringC = pickOf(7, [[200, 120, 255], [130, 150, 255], [255, 130, 190], [110, 230, 240]]);
            const spires = 4 + Math.floor(rv(8) * 6);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const dx = x + 0.5 - rx, dy = y + 0.5 - ry, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
                const sw = Math.sin(a * arms + r * twist - t * 0.9), sw2 = Math.sin(a * arms2 - r * 0.2 + t * 0.6);
                const v = Math.max(0, 0.5 + 0.35 * sw + 0.15 * sw2) * Math.max(0, 1 - r / 36);
                let c = mix(dark, glowC, v);
                if (Math.abs(r - (10 + 3 * Math.sin(t * 1.1))) < 0.8) c = ringC;     // pulsing event-horizon ring
                put(x, y, c);
            }
            for (let k = 0; k < 14; k++) {                                                   // motes drifting into the rift
                const ph = (t * 0.25 + hash(k, 4)) % 1, ang = hash(k, 5) * 6.283 + t * 0.2, rr = 30 * (1 - ph);
                put(rx + Math.cos(ang) * rr | 0, ry + Math.sin(ang) * rr * 1.1 | 0, ringC);
            }
            for (let k = 0; k < spires; k++) { const bx = 3 + Math.round(k * 42 / spires), bh = 6 + Math.floor(hash(k, 40 + (rv(9) * 50 | 0)) * 12); for (let y = H - bh; y < H; y++) for (let x = bx; x < bx + 3 - Math.floor((y - (H - bh)) / 4); x++) put(x, y, [5, 3, 12]); }   // crystal spires
        },
        pirate(put, t) {
            const wood = pickOf(1, [[46, 30, 18], [38, 34, 30], [54, 24, 18], [30, 36, 28]]), pw = pickOf(2, [6, 5, 8]);
            const pcx = 17 + rv(3) * 16, pcy = 16 + rv(4) * 12, pr0 = 9 + rv(5) * 5, moon = [Math.floor(pcx - pr0 * 0.5 + rv(6) * pr0), Math.floor(pcy - pr0 * 0.7)];
            const sky = pickOf(7, [[[6, 10, 30], [24, 34, 70]], [[26, 10, 20], [90, 40, 50]], [[8, 24, 28], [30, 80, 80]], [[16, 16, 22], [60, 60, 76]]]), lampX = pickOf(8, [8, 40, 24]);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const plank = (x / pw) | 0; let c = scl(wood, 0.8 + 0.2 * hash(plank, 1));
                if (x % pw === 0) c = scl(wood, 0.4);
                if (hash(x, y >> 2) < 0.04) c = scl(c, 0.7);
                put(x, y, c);
            }
            for (let y = 2; y < 48; y++) for (let x = 6; x < 44; x++) {                     // porthole onto a moonlit sea
                const dx = x + 0.5 - pcx, dy = y + 0.5 - pcy, r = Math.hypot(dx, dy);
                if (r > pr0 + 2) continue;
                if (r > pr0) { put(x, y, r > pr0 + 1.3 ? [110, 84, 34] : [180, 142, 60]); continue; }
                const hz = Math.round(pcy + 1);
                let c = y < hz ? mix(sky[0], sky[1], y / hz) : mix([8, 22, 44], [4, 10, 24], (y - hz) / 20);
                if (y >= hz) { const wv = Math.sin(x * 0.9 + y * 1.4 - t * 2.2); if (wv > 0.6) c = [60, 100, 150]; if (Math.abs(x - moon[0] + Math.sin(y * 1.3 + t * 2) * 1.2) < 1 + (y - hz) * 0.05) c = [200, 210, 220]; }   // moon glitter
                if (Math.hypot(x - moon[0], y - moon[1]) < 2.6) c = [236, 232, 204];                    // moon
                put(x, y, c);
            }
            const sw = Math.sin(t * 1.4) * 0.22, lx = lampX + Math.sin(sw) * 12, ly = 4 + Math.cos(sw) * 12;   // swaying lantern on a chain
            for (let k = 0; k < 12; k++) put(Math.round(lampX + (lx - lampX) * k / 12), Math.round(4 + (ly - 4) * k / 12), [90, 80, 60]);
            const fl = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 5.3);
            for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x, y); if (d < 9 && d > 3) { const cx = Math.round(lx + x), cy = Math.round(ly + y), k = (1 - d / 9) * 0.5 * fl; put(cx, cy, null, [255, 170, 60], k); } }
            for (let y = -2; y <= 3; y++) for (let x = -2; x <= 2; x++) put(Math.round(lx + x), Math.round(ly + y), y < 0 ? [140, 110, 50] : [255, 210 + 30 * fl, 90]);
        },
        machine(put, t) {
            const g = pickOf(1, [5, 6, 8, 4]), tintM = Math.floor(rv(2) * 4), rackW = 4 + Math.floor(rv(3) * 5), racks = pickOf(4, [[2, 40], [2], [40], [2, 20, 40], [6, 36]]);
            const tn = (c) => tintM === 0 ? c : tintM === 1 ? [c[1] * 0.9, c[0], c[2]] : tintM === 2 ? [c[1], c[1] * 0.75, c[0] * 0.5] : [c[1], c[2] * 0.8, c[1]];   // teal / violet / amber / green-white
            const put0 = put; put = (x, y, c, add, k) => put0(x, y, c ? tn(c) : null, add ? tn(add) : null, k);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                let c = [3, 12, 12];
                if (x % g === 0 || y % g === 0) c = [6, 28, 28];
                put(x, y, c);
            }
            for (let k = 0; k < 7; k++) {                                                    // data pulses racing along the grid lines
                const horiz = k % 2 === 0, lane = (hash(k, 7) * 8 | 0) * g, pos = ((t * (10 + k * 3) + hash(k, 8) * 60) % 60) - 6;
                for (let d = 0; d < 6; d++) { const v = 1 - d / 6, c = [40 + 160 * v, 255 * v, 220 * v]; if (horiz) put(Math.round(pos - d), lane, c); else put(lane, Math.round(pos - d), c); }
            }
            racks.map((rx0) => [rx0, 4]).forEach(([sx, sy]) => {                                // server racks with status leds
                for (let y = sy; y < 52; y++) for (let x = sx; x < sx + rackW; x++) put(x, y, y % 4 === 0 ? [4, 8, 10] : [14, 26, 30]);
                for (let y = sy + 2; y < 50; y += 4) for (let x = sx + 1; x < sx + rackW - 1; x += 2) put(x, y, Math.sin(t * (2 + x + y) + x * y) > 0 ? [60, 255, 210] : [10, 70, 60]);
            });
            const sy = ((t * 14) % (H + 12)) - 6;                                             // sweeping scan beam
            for (let d = 0; d < 5; d++) for (let x = 9; x < 39; x++) put(x, Math.round(sy) - d, null, [60, 255, 230], 0.45 - d * 0.08);
            for (let x = 9; x < 39; x++) if ((x >> 1) % 2) put(x, 49, [20, 90, 84]);
        }
    };

    return function background(faction, t, accent, variant) {
        const vv = variant | 0;
        rv = (n) => { const h = hash(vv * 7 + n * 131, vv + n); return h - Math.floor(h); };   // VXP.hash can come out negative: fold into 0..1
        const out = new Uint8ClampedArray(N * 4);
        const put = (x, y, c, add, k) => {
            x |= 0; y |= 0;
            if (x < 0 || y < 0 || x >= W || y >= H) return;
            const o = (y * W + x) * 4;
            if (c) { out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; }
            else { out[o] = clamp(out[o] + add[0] * k); out[o + 1] = clamp(out[o + 1] + add[1] * k); out[o + 2] = clamp(out[o + 2] + add[2] * k); }
            out[o + 3] = 255;
        };
        (painters[faction] || painters.terran)(put, t, accent);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, k = y % 2 ? 1.28 : 1.18; out[o] = clamp(out[o] * k); out[o + 1] = clamp(out[o + 1] * k); out[o + 2] = clamp(out[o + 2] * k); }   // brighter world, light scanlines
        for (let i = 3; i < out.length; i += 4) out[i] = 255;
        return out;
    };
})();
