"use strict";

// Retro pilot portrait generator (64x72 cells, 90s-VGA look: height-field lit face,
// ordered dither, limited tones, scanlines). A "look" is a small plain object:
//   { faction, skin, hair, hairCol, eye, face, brow, scar, beard, gear }
// heroPortrait.html(look, accent) → inline <svg>; randomLook / heroLook / cycle build looks.
const heroPortrait = (() => {
    const W = 96, H = 108;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const TONES = [0.04, 0.09, 0.15, 0.23, 0.32, 0.43, 0.56, 0.7, 0.86];
    const KEY = (() => { const v = [-0.75, -0.4, 0.45]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) * (x - cx)) / (2 * sx * sx) + ((y - cy) * (y - cy)) / (2 * sy * sy)));
    const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967296; };

    // Per-faction species: skin tones (light → dark), gear and clothing colours.
    const SPECIES = {
        terran: { skins: ['#d9b8a0', '#c49a7c', '#a87a5c', '#82583e', '#5c3c2a'], cloth: '#252f42', trim: '#8c97ae', gear: ['none', 'cap', 'collar'] },
        kronax: { skins: ['#7d8f5e', '#66794c', '#8a7a52', '#5a6a58', '#7a5a4a'], cloth: '#3a2016', trim: '#a0602a', gear: ['none', 'horns', 'brow'] },
        voidborn: { skins: ['#b4b0cc', '#9c98b8', '#8a86a8', '#c4bed8', '#a8a0c0'], cloth: '#12102a', trim: '#6a62d0', gear: ['hood', 'hood', 'none'] },
        pirate: { skins: ['#d0a488', '#b88468', '#9a6a50', '#7a4c38', '#d8b898'], cloth: '#2c1a12', trim: '#b8903a', gear: ['bandana', 'none', 'patch'] },
        machine: { skins: ['#8a94a4', '#76808f', '#9aa4b2', '#68727f', '#7c8896'], cloth: '#161b22', trim: '#3affc0', gear: ['plate', 'plate', 'half'] }
    };
    const HAIR_COLS = ['#16110e', '#3a281c', '#6b4a2a', '#a07a44', '#8a8d96', '#c8c4b8', '#5a1c18'];
    const EYE_COLS = ['#5a8ab8', '#4a7a52', '#7a5230', '#8a8f96', '#c8a030', '#a83a30'];
    // Eye shapes: half-width, half-height, outer-corner slant, iris radius, lid weight.
    const EYE_SHAPES = [
        { w: 3.6, h: 1.9, sl: 0.0, ir: 1.7, lid: 0.5 }, { w: 4.2, h: 1.3, sl: 0.35, ir: 1.5, lid: 0.8 }, { w: 3.2, h: 2.4, sl: -0.15, ir: 2.0, lid: 0.3 },
        { w: 4.0, h: 1.6, sl: -0.3, ir: 1.6, lid: 0.9 }, { w: 3.0, h: 1.5, sl: 0.2, ir: 1.4, lid: 0.6 }, { w: 4.4, h: 2.1, sl: 0.1, ir: 1.9, lid: 0.4 }
    ];
    const HAIR_STYLES = ['bald', 'crop', 'swept', 'long', 'mohawk', 'bun', 'slick', 'spiky'];
    // Head shapes: width offset, jaw taper, cheekbone strength, chin strength.
    const FACES = [{ w: 0, jaw: 0.5, ck: 1.0, ch: 1.0, p: 2.3, je: 1.6 }, { w: 0.9, jaw: 0.22, ck: 1.6, ch: 1.3, p: 3.2, je: 2.6 }, { w: 1.8, jaw: 0.12, ck: 0.6, ch: 2.0, p: 3.8, je: 3.2 }, { w: -1, jaw: 0.8, ck: 2.2, ch: 0.5, p: 2.1, je: 1.1 }, { w: 1.2, jaw: 0.6, ck: 0.4, ch: 1.6, p: 2.6, je: 1.3 }];
    const NOSES = [{ br: 3.2, tp: 2.2, w: 3.6 }, { br: 4.2, tp: 3.0, w: 4.6 }, { br: 2.2, tp: 1.4, w: 2.8 }];
    const MOUTHS = [{ lip: 1.1, x0: 27, x1: 37 }, { lip: 0.6, x0: 25, x1: 39 }, { lip: 1.9, x0: 28, x1: 36 }];
    const OPTIONS = { skin: 5, hair: 8, hairCol: 7, eye: 6, face: 5, nose: 3, mouth: 3, brow: 3, scar: 4, beard: 3, gear: 3 };
    const LABELS = { skin: 'SKIN', hair: 'HAIR', hairCol: 'HAIR COLOUR', eye: 'EYES', face: 'FACE', nose: 'NOSE', mouth: 'MOUTH', brow: 'BROW', scar: 'SCAR', beard: 'BEARD', gear: 'GEAR' };
    const hasHair = (f) => f === 'terran' || f === 'pirate' || f === 'kronax' && false;

    function seeded(seed) {
        let s = seed >>> 0 || 1;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function randomLook(faction, seed) {
        const r = seeded(seed == null ? Math.floor(Math.random() * 1e9) : seed);
        const look = { faction: faction || 'terran' };
        Object.keys(OPTIONS).forEach((k) => { look[k] = Math.floor(r() * OPTIONS[k]); });
        if (r() < 0.55) look.scar = 0;
        if (r() < 0.45) look.beard = 0;
        return look;
    }
    // The faction heroes keep fixed, recognisable looks.
    const HEROES = {
        terran: { skin: 1, hair: 1, hairCol: 4, eye: 0, face: 0, brow: 1, scar: 0, beard: 0, gear: 1 },
        kronax: { skin: 0, hair: 0, hairCol: 0, eye: 4, face: 2, brow: 2, scar: 2, beard: 0, gear: 1 },
        voidborn: { skin: 3, hair: 0, hairCol: 5, eye: 3, face: 1, brow: 0, scar: 0, beard: 0, gear: 0 },
        pirate: { skin: 0, hair: 3, hairCol: 0, eye: 1, face: 1, brow: 2, scar: 1, beard: 0, gear: 2 },
        machine: { skin: 2, hair: 0, hairCol: 0, eye: 0, face: 2, brow: 1, scar: 0, beard: 0, gear: 2 }
    };
    function heroLook(faction) { return Object.assign({ faction }, HEROES[faction] || HEROES.terran); }
    function cycle(look, key, dir) {
        const n = OPTIONS[key];
        return Object.assign({}, look, { [key]: (((look[key] || 0) + dir) % n + n) % n });
    }

    // Helmet silhouettes: head ellipsoid radii, visor radii.
    const HELMETS = [
        { rx: 30, ry: 32, vx: 20, vy: 17 }, { rx: 28, ry: 35, vx: 18, vy: 20 }, { rx: 33, ry: 30, vx: 23, vy: 15 },
        { rx: 30, ry: 32, vx: 19, vy: 17, chin: true }, { rx: 31, ry: 33, vx: 21, vy: 16, crest: true }
    ];

    // 3/4-view helmeted pilot, rim-lit by the faction accent from the upper right.
    function build(look, accent) {
        const faction = SPECIES[look.faction] ? look.faction : 'terran';
        const S = SPECIES[faction];
        const acc = hex(accent || '#c8a040');
        const skin = hex(S.skins[look.skin % S.skins.length]);
        const gearIdx = look.gear % 3;
        const buf = new Array(W * H).fill(null);
        const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
        const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? buf[y * W + x] : null);
        const shade = (base, t, x, y) => {
            const thr = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
            const lvl = Math.max(0, Math.min(TONES.length - 1, Math.floor(t * (TONES.length - 1) + 0.5 + (thr - 0.5) * 0.7)));
            const f = TONES[lvl], sh = (1 - f) * 0.14;
            return [base[0] * f * (1 - sh), base[1] * f * (1 - sh * 0.4), base[2] * f + (255 - base[2] * f) * sh * 0.1];
        };
        // Lit surface: ambient + key, plus an accent rim on the upper-right edge.
        const surf = (base, nx, ny, nz, x, y, rim, lift) => {
            const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
            const key = Math.max(0, nx * 0.55 - ny * 0.5 + nz * 0.35);
            const c = shade(base, 0.2 + key * 0.8 + (lift || 0), x, y);
            const r = Math.pow(Math.max(0, 1 - nz), 1.6) * Math.max(0, nx * 0.75 - ny * 0.5 + 0.1) * (rim == null ? 1 : rim);
            return c.map((v, i) => Math.min(255, v + acc[i] * r * 1.1));
        };
        const line = (x0, y0, x1, y1, col, k) => {
            const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, c = typeof col === 'string' ? hex(col) : col;
            for (let i = 0; i <= n; i++) set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, k ? c.map((v) => v * k) : c);
        };

        // Background: near-black with a soft accent glow behind the head.
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const d = Math.hypot((x - 62) / 50, (y - 36) / 54);
            set(x, y, shade(acc.map((v) => v * 0.55), Math.max(0, 1 - d) * 0.38 + 0.03, x, y));
        }

        // ---- Shoulders / suit ----
        const suit = hex(S.cloth).map((v) => v * 1.4 + 38);
        for (let y = 70; y < H; y++) for (let x = 0; x < W; x++) {
            const ux = (x - 50) / 62, uy = (y - 114) / 50, d = ux * ux + uy * uy;
            if (d >= 1) continue;
            const nz = Math.sqrt(1 - d);
            const fold = Math.sin(x * 0.45 + y * 0.18) * 0.06 + (hash(x >> 1, y >> 1) - 0.5) * 0.08;
            set(x, y, surf(suit, ux * 1.2, uy * 1.2, nz, x, y, 0.9, fold));
        }
        // Armour plates + straps.
        for (let i = 0; i < 3; i++) line(8 + i * 5, 96 + i * 4, 50 + i * 3, 76 + i * 3, S.trim, 0.22 + i * 0.05);
        line(70, 108, 94, 84, S.trim, 0.3); line(70, 109, 94, 85, [10, 10, 12]);
        for (let y = 84; y < H; y++) for (let x = 56; x < 94; x++) {                          // chest plate
            const g = get(x, y); if (!g) continue;
            if ((x - 56) * 0.5 + (y - 84) > 32 && x < 90) set(x, y, g.map((v) => v * 0.8));
        }
        // Faction patch on the chest (as in the briefing art): triangle badge.
        const bx = 76, by = 100;
        for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) {
            const inT = faction === 'machine' ? (x * x + y * y <= 36) : (y >= -5 && Math.abs(x) <= (y + 5) * 0.62 + 0.5 && y <= 5);
            if (!inT) continue;
            const edge = faction === 'machine' ? (x * x + y * y > 22) : (y > 3 || Math.abs(x) > (y + 5) * 0.62 - 1.2);
            set(bx + x, by + y, edge ? hex(S.trim).map((v) => v * 0.55) : [12, 12, 14]);
        }
        if (gearIdx === 2) for (let i = 0; i < 26; i++) set(14 + i * 0.9, 84 + Math.sin(i * 0.5) * 3 + i * 0.6, [8, 8, 10]);   // hanging cable

        // ---- Neck seal ----
        for (let y = 68; y < 86; y++) for (let x = 28; x < 74; x++) {
            const ux = (x - 50) / 20, uy = (y - 76) / 8, d = ux * ux + uy * uy;
            if (d >= 1) continue;
            const ring = (y + (x >> 3)) % 4 === 0;
            set(x, y, surf(ring ? hex(S.trim).map((v) => v * 0.4) : [26, 26, 30], ux, uy * 0.8, Math.sqrt(1 - d), x, y, 0.8, ring ? 0.1 : 0));
        }

        // ---- Helmet ----
        const H0 = HELMETS[look.face % HELMETS.length];
        const CX = 52, CY = 44, RX = H0.rx, RY = H0.ry;
        const VX = 38, VY = 49;                                    // visor centre (head turned to the left)
        const visorD = (x, y) => ((x - VX) / H0.vx) ** 2 + ((y - VY) / H0.vy) ** 2;
        const browK = [0.1, 0.22, 0.36][look.brow % 3];
        const shell = hex(S.cloth).map((v, i) => v * 1.2 + 70 + acc[i] * 0.1);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const uy = (y + 0.5 - CY) / RY, ux = (x + 0.5 - CX) / (RX * (1 - 0.3 * Math.pow(Math.max(0, uy), 1.7))), d = ux * ux + uy * uy;
            if (d >= 1) continue;
            const nz = Math.sqrt(1 - d);
            let nx = ux, ny = uy;
            const vd = visorD(x + 0.5, y + 0.5);
            let c;
            if (vd < 0.78) {                                       // visor glass
                const gl = Math.max(0, Math.sin((x * 0.5 - y * 0.9) * 0.35 + 1.3)) * 0.22;
                const top = Math.max(0, 1 - Math.hypot(x - 52, y - 40) / 16);            // accent reflection upper right
                c = shade([30, 38, 48], 0.3 + gl * 1.2 + top * 0.6 - vd * 0.15, x, y).map((v, i) => Math.min(255, v + acc[i] * top * 0.5));
                // faint face behind the glass
                const fd = ((x - 33) / 12) ** 2 + ((y - 51) / 14) ** 2;
                if (fd < 1) c = c.map((v, i) => v + skin[i] * (1 - fd) * 0.13);
            } else if (vd < 1.12) {                                // visor rim ring
                const t = (vd - 0.78) / 0.34;
                c = surf([110, 116, 126], nx + (x < VX ? -0.4 : 0.3), ny + (y < VY ? -0.4 : 0.2), nz, x, y, 1.3, 0.12 - Math.abs(t - 0.5) * 0.15);
            } else {
                // brow guard above the visor, chin guard below it
                const above = y < VY && vd < 1.12 + browK * 2.2;
                const chin = H0.chin && y > VY && vd < 1.7;
                const base = (above || chin) ? [58, 62, 70] : shell;
                nx += (x < VX ? -0.15 : 0); 
                const panel = ((x + y * 2) % 23 === 0 || Math.abs(Math.hypot(x - CX, y - CY - 4) - RX * 0.82) < 0.55) ? -0.1 : 0;   // panel seams
                c = surf(base, nx, ny, nz, x, y, 1.1, panel + (hash(x, y) - 0.5) * 0.04);
            }
            set(x, y, c);
        }
        // Visor eyes: glowing shapes inside the glass; the Eyes option changes their shape.
        {
            const eyeCol = hex(EYE_COLS[look.eye % EYE_COLS.length]).map((v) => Math.min(255, v * 1.5 + 40));
            const ES = EYE_SHAPES[look.eye % EYE_SHAPES.length];
            [[29, 49], [42, 48]].forEach(([ex, ey], k) => {
                const w = Math.round(ES.w * 0.9), h = Math.max(1, Math.round(ES.h * 0.7));
                for (let x = -w; x <= w; x++) for (let y = -h; y <= h; y++) {
                    const yy = y - (k ? x : -x) * ES.sl * 0.35;
                    if ((x / w) ** 2 + (yy / h) ** 2 > 1.05) continue;
                    set(ex + x, ey + y, Math.abs(x) <= 1 && Math.abs(y) <= h - 1 ? [255, 255, 245] : eyeCol.map((v) => v * (0.7 - Math.abs(x) / (w + 2) * 0.3)));
                }
                for (let x = -w - 2; x <= w + 2; x++) { const g = get(ex + x, ey + h + 2); if (g) set(ex + x, ey + h + 2, g.map((v, i) => Math.min(255, v + eyeCol[i] * 0.12))); }   // glow bleed
            });
        }
        // Top fixture (Nose option): none / antenna / lamp.
        if (look.nose === 1) { line(64, 18, 70, 4, [70, 76, 84]); set(70, 3, [255, 60, 50]); set(69, 3, [120, 30, 30]); set(71, 3, [120, 30, 30]); }
        if (look.nose === 2) { for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) set(48 + x, 10 + y, y === 0 ? acc.map((v) => Math.min(255, v * 1.3 + 40)) : [40, 44, 52]); }
        if (H0.crest) for (let y = 4; y < 22; y++) { const x = 52 + Math.round((y - 4) * 0.12); set(x, y, surf([60, 64, 72], 0.8, -0.2, 0.5, x, y)); set(x - 1, y, [20, 22, 26]); set(x + 1, y, acc.map((v) => v * 0.6)); }
        // Respirator (Mouth option): none / filter canister / vent grille.
        if (look.mouth === 1) {
            for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) set(31 + x, 69 + y, surf([46, 50, 58], x / 6, y / 6, Math.sqrt(Math.max(0.05, 1 - (x * x + y * y) / 36)), 31 + x, 69 + y, 1));
            for (let i = 0; i < 4; i++) line(26 + i * 3, 66, 26 + i * 3, 72, [12, 12, 16]);
            line(26, 75, 18, 90, [10, 10, 12]);
        } else if (look.mouth === 2) for (let i = 0; i < 4; i++) line(28, 66 + i * 2, 46, 66 + i * 2, [8, 9, 11]);
        // Scar (damage on the shell): scratch / cracked visor / scorch.
        if (look.scar === 1) { line(34, 28, 46, 70, acc.map((v) => v * 0.9)); line(35, 28, 47, 70, [6, 6, 8]); }
        if (look.scar === 2) { [[24, 40, 40, 52], [32, 44, 28, 60], [34, 46, 44, 44], [33, 45, 38, 38]].forEach((l) => line(l[0], l[1], l[2], l[3], [150, 160, 170], 0.7)); }
        if (look.scar === 3) for (let y = 14; y < 44; y++) for (let x = 56; x < 82; x++) { const g = get(x, y); if (g && Math.hypot(x - 70, y - 28) < 11 + hash(x, y) * 4) set(x, y, hash(x + 3, y) < 0.06 ? acc.map((v) => Math.min(255, v * 1.4)) : g.map((v) => v * 0.42)); }

        // ---- Faction gear ----
        if (faction === 'kronax' && gearIdx === 1) for (let i = 0; i < 18; i++) {
            const w = Math.max(1, 5 - (i >> 2)), x0 = 26 - i * 0.7, y = 26 - i, x1 = 78 + i * 0.7;
            for (let k = 0; k < w; k++) { set(x0 - k, y, shade([168, 150, 110], 0.5 - k * 0.08, x0 - k, y)); set(x1 + k, y, surf([168, 150, 110], 1, -0.3, 0.3, x1 + k, y)); }
        }
        if (faction === 'kronax' && gearIdx === 2) for (let i = 0; i < 4; i++) for (let k = 0; k < 9 - i * 2; k++) set(80 + i * 3, 92 - k - i * 4, surf([150, 130, 100], 1, 0, 0.3, 80 + i * 3, 92 - k));
        if (faction === 'voidborn') {
            if (gearIdx === 0) for (let y = 4; y < 48; y++) for (let x = 14; x < 92; x++) {          // draped hood over the shell
                const g = get(x, y); if (!g) continue;
                const hd = ((x - 52) / 40) ** 2 + ((y - 38) / 36) ** 2;
                if (hd < 1 && hd > 0.5 && visorD(x, y) > 1.2) set(x, y, shade([20, 18, 46], 0.2 + (1 - hd) * 0.3 + Math.sin(x * 0.5) * 0.04, x, y));
            }
            if (gearIdx === 1) for (let a = 0.1; a < 6.2; a += 0.02) if (Math.sin(a * 5) > -0.5) set(52 + Math.cos(a) * 42, 36 + Math.sin(a) * 38, hex(S.trim).map((v) => v * (0.4 + 0.4 * Math.sin(a * 3))));
            for (let i = 0; i < 24; i++) set(4 + hash(i, 7) * 88, 4 + hash(i, 9) * 70, hex(S.trim).map((v) => v * (0.2 + hash(i, 5) * 0.4)));
        }
        if (faction === 'pirate') {
            if (gearIdx === 0) { for (let y = 16; y < 24; y++) for (let x = 24; x < 82; x++) { const g = get(x, y); if (g && visorD(x, y) > 1.3) set(x, y, shade([100, 22, 28], 0.35 + (x > 60 ? 0.25 : 0), x, y)); } }
            if (gearIdx === 1) { line(24, 36, 80, 30, [20, 14, 12]); for (let x = 30; x < 44; x += 12) for (let y = -4; y <= 4; y++) for (let xx = -4; xx <= 4; xx++) if (xx * xx + y * y <= 16) set(x + xx, 22 + y, xx + y < -3 ? [200, 170, 90] : [30, 24, 18]); }
            if (gearIdx === 2) line(22, 58, 82, 24, [14, 10, 10]);
        }
        if (faction === 'machine') {
            for (let i = 0; i < 6; i++) line(40 + i * 2.2, 8, 40 + i * 2.2, 14 + (i % 2) * 4, [60, 66, 74], 0.8);
            if (gearIdx === 0) { line(60, 20, 60, 2, [60, 66, 74]); set(60, 1, [255, 60, 50]); }
            if (gearIdx === 1) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) set(72 + x, 50 + y, hex(S.trim).map((v) => v * (x * x + y * y < 3 ? 1.2 : 0.45)));
        }

        // ---- Grade: strong vignette, dark, no scanlines (small palette) ----
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const c = get(x, y); if (!c) continue;
            const dx = (x - 56) / 66, dy = (y - 50) / 76, d = dx * dx + dy * dy;
            const v = Math.max(0.3, 1 - d * 0.55);
            set(x, y, c.map((q) => Math.round(q * v / 8) * 8));
        }
        return buf;
    }

    function html(look, accent) {
        const lk = typeof look === 'string' ? heroLook(look) : (look || heroLook('terran'));
        const buf = build(lk, accent);
        const byColor = {};
        for (let y = 0; y < H; y++) {
            let x = 0;
            while (x < W) {
                const c = buf[y * W + x];
                if (!c) { x++; continue; }
                const hx = toHex(c);
                let e = x + 1;
                while (e < W && buf[y * W + e] && toHex(buf[y * W + e]) === hx) e++;
                (byColor[hx] = byColor[hx] || []).push(`M${x} ${y}h${e - x}v1h${-(e - x)}z`);
                x = e;
            }
        }
        const paths = Object.keys(byColor).map((hx) => `<path fill="${hx}" d="${byColor[hx].join('')}"/>`).join('');
        return `<svg class="hero-portrait" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice" shape-rendering="crispEdges" role="img" aria-label="Pilot portrait">${paths}</svg>`;
    }

    return { html, randomLook, heroLook, cycle, OPTIONS, LABELS, valueName: (k, v) => (k === 'hair' ? HAIR_STYLES[v] : String(v + 1)).toUpperCase() };
})();
if (typeof module !== 'undefined') module.exports = heroPortrait;
