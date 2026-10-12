"use strict";

// Voxel pilot portraits, part 1/3: 16 procedural face presets per faction. A preset is a plain object of face
// parameters (read by VXP.build in part 2); preset(faction, i) always returns the same face for the same index.
const VXP = (() => {
    const COUNT = 16, W = 48, H = 54;
    const SKINS = {
        terran: ['#e0bfa6', '#d2a98a', '#b98a68', '#93684a', '#6a4632'],
        pirate: ['#d8ad92', '#c1906f', '#a47556', '#80553c', '#e0c0a0'],
        kronax: ['#7d8f5e', '#66794c', '#8a7a52', '#5a6a58', '#7a5a4a'],
        voidborn: ['#b4b0cc', '#9c98b8', '#8a86a8', '#c4bed8', '#a8a0c0'],
        machine: ['#8a94a4', '#76808f', '#9aa4b2', '#68727f', '#7c8896']
    };
    const THEME = {
        terran: { cloth: '#252f42', trim: '#8c97ae' }, pirate: { cloth: '#3a2418', trim: '#c8a040' }, kronax: { cloth: '#3a2016', trim: '#c0702a' },
        voidborn: { cloth: '#171433', trim: '#7a6af0' }, machine: { cloth: '#1a2028', trim: '#3affc0' }
    };
    const HAIR = ['#16110e', '#3a281c', '#6b4a2a', '#a07a44', '#8a8d96', '#c8c4b8', '#5a1c18'];
    const EYES = ['#3a6a9a', '#3f6a48', '#6a4424', '#707880', '#a88a2c', '#8a3028'];
    const GLOW = ['#ff2ec8', '#9a5cff', '#34e0ff', '#ff3a4a', '#4cff9a', '#ffc040', '#ff7a2a', '#7aff3a', '#3a7aff', '#f0f0ff']; 
    const GEAR = { terran: ['helmet', 'headset', 'none', 'cap'], pirate: ['bandana', 'none', 'headband', 'bandana'], kronax: ['horns', 'mohawk', 'none', 'helm'], voidborn: ['hood', 'hood', 'none'], machine: ['plate', 'dome', 'crest'] };
    const BUILD_MAP = [0, 1, 0, 2, 0, 3, 0, 4, 0, 1, 0, 2, 0, 3, 0, 4];   // 0 average, 1 very masculine, 2 very feminine, 3 nerdy, 4 heavy-set
    const FSEED = { terran: 1, pirate: 2, kronax: 3, voidborn: 4, machine: 5 };
    const BASE_W = { terran: 11.6, pirate: 11.9, kronax: 13.6, voidborn: 9.4, machine: 12.4 };
    const METALS = [[88, 96, 112], [112, 100, 86], [78, 104, 96], [104, 84, 84], [70, 76, 92], [120, 124, 132], [96, 88, 118], [120, 96, 70], [64, 92, 120], [100, 112, 80]];

    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967296; };
    const seeded = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

    function preset(faction, i) {
        const f = THEME[faction] ? faction : 'terran';
        const idx = ((Math.floor(i) || 0) % COUNT + COUNT) % COUNT;
        const r = seeded(FSEED[f] * 977 + idx * 7919 + 13);
        const pick = (a) => a[Math.floor(r() * a.length)];
        const num = (a, b) => a + (b - a) * r();
        const female = f === 'terran' || f === 'pirate' ? idx % 2 === 1 : r() < 0.3;
        const kr = f === 'kronax';
        const p = { faction: f, idx, female, skin: pick(SKINS[f]), hair: pick(HAIR), eye: pick(EYES), glow: pick(GLOW) };
        p.cw = BASE_W[f] + num(-1.2, 1.2) - (female ? 0.8 : 0);
        p.jaw = num(0.74, 0.88) - (female ? 0.07 : 0) + (kr ? 0.1 : 0);
        p.chin = num(0.4, 0.62) - (female ? 0.06 : 0) + (kr ? 0.08 : 0);
        p.brow = female ? num(0.3, 0.9) : num(0.7, 1.7);
        if (kr) p.brow += 0.8;
        p.noseW = num(1.6, 2.6); p.noseL = r();
        p.lips = female ? num(0.9, 1.5) : num(0.5, 1.0);
        p.slant = Math.floor(r() * 3) - 1;
        p.hairStyle = female ? pick(['short', 'swept', 'long', 'long']) : pick(['bald', 'short', 'short', 'swept', 'swept']);
        p.gear = pick(GEAR[f]);
        p.beard = !female && r() < (f === 'pirate' ? 0.7 : 0.35) ? 1 + Math.floor(r() * 2) : 0;
        p.scar = r() < 0.3 ? 1 + Math.floor(r() * 2) : 0;
        p.earring = f === 'pirate' && r() < 0.5;
        p.patch = f === 'pirate' && r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0;
        p.tusks = kr && r() < 0.8;
        p.eyesN = pick([2, 4, 6]); p.tent = 3 + Math.floor(r() * 5); p.crest = Math.floor(r() * 3);
        p.visor = pick(['bar', 'dual', 'round']); p.metal = METALS[Math.floor(r() * METALS.length)].map((v) => v + Math.round(num(-10, 10))); p.plateW = Math.floor(r() * 3); p.antenna = r() < 0.5;
        if (f === 'machine') p.beard = 0;
        // Helmet variance, rolled apart from everything above so faces, shells and backdrops combine freely.
        p.shellW = num(0.9, 1.13); p.tintRGB = [0, 1, 2].map(() => Math.round(num(-22, 22)));
        p.crestK = Math.floor(r() * 5); p.canister = r() < 0.4; p.lamp = r() < 0.35; p.fins = Math.floor(r() * 3); p.stripe = Math.floor(r() * 4);
        p.slit = Math.floor(r() * 8);   // voidborn portal-slit shape
        p.vface = Math.floor(r() * 12); p.vface = p.vface < 3 ? 0 : p.vface - 2;   // voidborn face: ~30% slit (shapes above), else eye / cluster / ring / cross / band / maw / closed bud / open bloom
        p.bgv = FSEED[f] * 1009 + idx * 37 + Math.floor(r() * 997);   // backdrop variant: its own roll, independent of the helmet
        p.mask = Math.floor(r() * 6); p.maskCol = Math.floor(r() * 7); p.snout = Math.floor(r() * 5); p.teethN = 3 + Math.floor(r() * 4);   // lower-face variants (kronax mask, shared snout)
        // Body types, so every faction has some very masculine, very feminine, nerdy and heavy-set pilots next to ordinary builds.
        // Rolled last and by index (2 of each special per faction), so nothing above shifts.
        p.build = BUILD_MAP[(idx + FSEED[f] * 3) % 16];
        p.bodyW = 1; p.neckW = 8.4;
        if (p.build === 1) { p.female = false; p.cw *= 1.22; p.jaw = 1.05; p.chin = 0.95; p.brow += 1.4; p.bodyW = 1.4; p.neckW = 12.5; p.shellW *= 1.1; p.beard = p.beard || 2; p.scar = p.scar || 1; }
        else if (p.build === 2) { p.female = true; p.cw *= 0.8; p.jaw = 0.58; p.chin = 0.32; p.brow = 0.2; p.bodyW = 0.7; p.neckW = 5; p.shellW *= 0.88; p.braid = true; p.lashes = true; p.beard = 0; p.scar = 0; }
        else if (p.build === 3) { p.cw *= 0.88; p.jaw = 0.66; p.chin = 0.4; p.bodyW = 0.66; p.neckW = 4.8; p.shellW *= 0.93; p.glasses = true; p.visor = 'round'; p.beard = 0; p.scar = 0; p.pens = true; }
        else if (p.build === 4) { p.cw *= 1.3; p.jaw = 1.1; p.chin = 1.0; p.bodyW = 1.62; p.neckW = 13.5; p.shellW *= 1.18; p.chin2 = true; p.belly = true; }
        // Voidborn also come in a soft, feminine form (slimmer head, gentle opening, flowing tendrils, lashes, warm glow).
        if (f === 'voidborn' && p.build !== 1 && p.build !== 4 && (p.build === 2 || idx % 4 === 1)) {
            p.soft = true; p.female = true; p.cw *= 0.86; p.shellW *= 0.92; p.bodyW = Math.min(p.bodyW, 0.78); p.neckW = Math.min(p.neckW, 5.5);
            p.slit = [0, 4, 2, 0][idx % 4]; p.vface = [0, 0, 8, 9, 4][idx % 5]; p.tent = Math.max(p.tent, 5); p.glow = GLOW[[0, 1, 2, 0][(idx >> 2) % 4]];
        }
        return p;
    }
    return { COUNT, W, H, THEME, preset, hex, hash };
})();
