"use strict";

// Retro pilot portrait generator (64x72 cells, 90s-VGA look: height-field lit face,
// ordered dither, limited tones, scanlines). A "look" is a small plain object:
//   { faction, skin, hair, hairCol, eye, face, brow, scar, beard, gear }
// heroPortrait.html(look, accent) → inline <svg>; randomLook / heroLook / cycle build looks.
const heroPortrait = (() => {
    const W = 96, H = 108;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const TONES = [0.07, 0.19, 0.36, 0.58, 0.82];   // few flat bands, like hand-painted pixel art
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
        const EYE_COLS = ['#5a8ab8', '#4a7a52', '#7a5230', '#8a8f96', '#c8a030', '#a83a30'];
    // Eye shapes: half-width, half-height, outer-corner slant, iris radius, lid weight.
    const EYE_SHAPES = [
        { w: 3.6, h: 1.9, sl: 0.0, ir: 1.7, lid: 0.5 }, { w: 4.2, h: 1.3, sl: 0.35, ir: 1.5, lid: 0.8 }, { w: 3.2, h: 2.4, sl: -0.15, ir: 2.0, lid: 0.3 },
        { w: 4.0, h: 1.6, sl: -0.3, ir: 1.6, lid: 0.9 }, { w: 3.0, h: 1.5, sl: 0.2, ir: 1.4, lid: 0.6 }, { w: 4.4, h: 2.1, sl: 0.1, ir: 1.9, lid: 0.4 }
    ];
        const OPTIONS = { v: 16, gender: 7, skin: 5, headW: 5, headL: 5, jaw: 5, chin: 5, cheek: 5, noseS: 5, hair: 10, hairCol: 7, hairc: 7, eye: 6, face: 5, nose: 5, mouth: 4, brow: 3, scar: 4, beard: 4, gear: 3 };
    const LABELS = { v: 'PORTRAIT', gender: 'GENDER', skin: 'SKIN', headW: 'FACE WIDTH', headL: 'FACE LENGTH', jaw: 'JAW', chin: 'CHIN', cheek: 'CHEEKBONES', noseS: 'NOSE SIZE', hair: 'HELMET', hairCol: 'PAINT', hairc: 'HAIR COLOUR', eye: 'EYES', face: 'EYEWEAR', nose: 'FIXTURE', mouth: 'MASK', brow: 'BROW', scar: 'SCAR', beard: 'BEARD', gear: 'GEAR' };
    const NAMES = {
        headW: ['NARROW', 'SLIM', 'NORMAL', 'BROAD', 'WIDE'], headL: ['SHORT', 'COMPACT', 'NORMAL', 'LONG', 'VERY LONG'], jaw: ['SOFT', 'SLIM', 'NORMAL', 'STRONG', 'HEAVY'],
        chin: ['RECEDING', 'SMALL', 'NORMAL', 'PRONOUNCED', 'JUTTING'], cheek: ['FLAT', 'SOFT', 'NORMAL', 'HIGH', 'SHARP'], noseS: ['TINY', 'SMALL', 'NORMAL', 'LARGE', 'HUGE'],
        gender: ['MALE', 'MASCULINE', 'SOFT MALE', 'NEUTRAL', 'SOFT FEMALE', 'FEMININE', 'FEMALE'], hairc: ['BLACK', 'BROWN', 'CHESTNUT', 'BLONDE', 'GREY', 'WHITE', 'RED'],
        hair: ['CAP', 'FLIGHT', 'FULL', 'CREST', 'HORNED', 'BRIM', 'HOOD', 'SPIKED', 'HEADSET', 'AVIATOR'],
        hairCol: ['STEEL', 'SILVER', 'RUST', 'JADE', 'BONE', 'GRAPHITE', 'BRASS'],
        face: ['NONE', 'GOGGLES', 'VISOR', 'MONOCLE', 'FULL VISOR'], nose: ['NONE', 'ANTENNA', 'LAMP', 'SENSOR', 'VENTS'],
        mouth: ['NONE', 'OXYGEN', 'FILTER', 'SCARF'], beard: ['NONE', 'STRAP', 'STUBBLE', 'BEARD'], brow: ['LIGHT', 'MEDIUM', 'HEAVY'], scar: ['NONE', 'EYE', 'CHEEK', 'BURN']
    };
    const GLOWS = ['#ff2ec8', '#9a5cff', '#34e0ff', '#ff3a4a', '#4cff9a', '#f0f0ff', '#ffc040'];
    // Voidborn have their own feature sheet: the same look slots, relabelled (slot -> [label, value names]).
    const VOID = {
        hair: ['HEAD SHAPE', ['SMOOTH', 'LOW CREST', 'CREST', 'LONG CREST', 'SWEPT', 'FLARED', 'FLARED LOW', 'FLARED CREST', 'FLARED LONG', 'FLARED SWEPT']],
        headW: ['FACE WIDTH', null], jaw: ['FACE SLIT', ['HAIRLINE', 'THIN', 'MEDIUM', 'WIDE', 'GAPING']],
        nose: ['SENSORS', ['NONE', 'TWO', 'FOUR', 'SIX', 'EIGHT']], cheek: ['SENSOR SIZE', ['TINY', 'SMALL', 'NORMAL', 'LARGE', 'HUGE']],
        beard: ['TENTACLES', ['NONE', 'FEW', 'MANY', 'DENSE']], chin: ['TENTACLE LENGTH', ['SHORT', 'MEDIUM-', 'MEDIUM', 'LONG', 'VERY LONG']],
        scar: ['CHITIN', ['SMOOTH', 'PLATED', 'RIBBED', 'SHELLED']], brow: ['SKIN TEXTURE', ['SMOOTH', 'PORED', 'FOLDED']],
        skin: ['SKIN COLOUR', null], hairCol: ['BIOLUMINESCENCE', ['MAGENTA', 'VIOLET', 'CYAN', 'RED', 'GREEN', 'WHITE', 'GOLD']],
        gear: ['TISSUE', ['OPAQUE', 'TRANSLUCENT', 'GLASSY']], noseS: ['ASYMMETRY', ['STRONG LEFT', 'LEFT', 'NONE', 'RIGHT', 'STRONG RIGHT']],
        face: ['VOID EFFECT', ['NONE', 'MOTES', 'RINGS', 'RIFT', 'STORM']]
    };
    const isVoid = (look) => !!look && look.faction === 'voidborn';
    const HAIRS = ['#16110e', '#3a281c', '#6b4a2a', '#a07a44', '#8a8d96', '#c8c4b8', '#5a1c18'];
    const PAINTS = ['#7d8794', '#a9b0ba', '#b0503c', '#4f8a6c', '#d4d0c4', '#4a4a5a', '#b8923c'];

    function seeded(seed) {
        let s = seed >>> 0 || 1;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function randomLook(faction, seed) {
        const r = seeded(seed == null ? Math.floor(Math.random() * 1e9) : seed);
        const look = { faction: faction || 'terran', v: Math.floor(r() * 16) };
        if (typeof VXP !== 'undefined') return look;
        Object.keys(OPTIONS).forEach((k) => { look[k] = Math.floor(r() * OPTIONS[k]); });
        if (look.faction !== 'voidborn') { look.face = 0; look.nose = 0; look.mouth = 0; look.gear = 0; look.brow = 1; ['headW', 'headL', 'jaw', 'chin', 'cheek', 'noseS'].forEach((k) => { delete look[k]; }); }
        if (r() < 0.55) look.scar = 0;
        if (r() < 0.45) look.beard = 0;
        return look;
    }
    // The faction heroes keep fixed, recognisable looks.
    const HEROES = {
        terran: { gender: 0, hairc: 1, skin: 1, hair: 1, hairCol: 0, eye: 0, face: 0, nose: 0, mouth: 0, brow: 1, scar: 0, beard: 2, gear: 1 },
        kronax: { gender: 0, hairc: 0, skin: 0, hair: 4, hairCol: 2, eye: 4, face: 0, nose: 0, mouth: 0, brow: 2, scar: 1, beard: 2, gear: 1 },
        voidborn: { gender: 6, hairc: 5, skin: 3, hair: 1, hairCol: 0, eye: 3, face: 0, nose: 2, mouth: 0, brow: 1, scar: 1, beard: 2, gear: 1 },
        pirate: { gender: 0, hairc: 2, skin: 0, hair: 9, hairCol: 4, eye: 1, face: 3, nose: 0, mouth: 0, brow: 2, scar: 2, beard: 1, gear: 2 },
        machine: { gender: 0, hairc: 0, skin: 2, hair: 2, hairCol: 1, eye: 0, face: 0, nose: 1, mouth: 0, brow: 1, scar: 0, beard: 0, gear: 2 }
    };
    function heroLook(faction) { return Object.assign({ faction, v: 0 }, HEROES[faction] || HEROES.terran); }
    // Fills keys that older saved looks lack: gender from the former sex flag, head-shape sliders at the middle.
    function normalize(look) {
        const o = Object.assign({}, look);
        if (o.gender == null) o.gender = o.sex === 1 ? 6 : 0;
        delete o.sex;
        if (o.v == null) o.v = (((o.skin || 0) * 3 + (o.hair || 0) * 5 + (o.eye || 0) * 7 + (o.gender || 0)) % 16 + 16) % 16;
        ['headW', 'headL', 'jaw', 'chin', 'cheek', 'noseS'].forEach((k) => { if (o[k] == null) o[k] = 2; });
        return o;
    }
    function cycle(look, key, dir) {
        const n = OPTIONS[key];
        look = normalize(look);
        return Object.assign({}, look, { [key]: (((look[key] || 0) + dir) % n + n) % n });
    }

    // ---- polygon helpers: angular, chamfered armour instead of lit ellipsoids ----
    const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const area = (pts) => { let t = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; t += a[0] * b[1] - b[0] * a[1]; } return t / 2; };
    const smooth = (pts, n) => { for (; n > 0; n--) { const o = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } pts = o; } return pts; };
    const move = (pts, dx, dy) => pts.map((q) => [q[0] + dx, q[1] + (dy || 0)]);
    // Pixels inside a polygon with distance to the nearest edge and that edge's outward normal.
    function raster(pts) {
        const sg = area(pts) > 0 ? 1 : -1, out = [];
        let x0 = W, x1 = 0, y0 = H, y1 = 0;
        pts.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
        for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
            const px = x + 0.5, py = y + 0.5;
            if (!inPoly(pts, px, py)) continue;
            let best = 1e9, nx = 0, ny = 0;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
                const d = Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
                if (d < best) { best = d; const l = Math.sqrt(l2); nx = sg * dy / l; ny = -sg * dx / l; }
            }
            out.push({ x, y, d: best, nx, ny });
        }
        return out;
    }
    const ellipse = (cx, cy, rx, ry, n) => Array.from({ length: n || 18 }, (_, i) => [cx + Math.cos(i / (n || 18) * 6.2832) * rx, cy + Math.sin(i / (n || 18) * 6.2832) * ry]);
    // Frontal portrait, symmetric about x = 48. A half outline [halfWidth, y] runs from the top centre to the bottom centre.
    const mirror = (half) => half.map((q) => [48 + q[0], q[1]]).concat(half.slice(1, -1).reverse().map((q) => [48 - q[0], q[1]]));
    const flipX = (poly) => poly.map((q) => [96 - q[0], q[1]]);
    // Skulls per faction: Kronax = wide jaw, Voidborn = tall narrow, Machine = boxy (faceted, not smoothed).
    const HEAD_HALF = {
        terran: [[0, 15], [9, 17], [16, 21], [19.5, 30], [20.5, 40], [21, 48], [20, 56], [18, 64], [16.5, 72], [15, 78], [11.5, 84], [7, 88.5], [0, 91]],
        kronax: [[0, 15], [10, 17], [18, 21], [21.5, 30], [23.5, 40], [24.5, 50], [25, 60], [24, 70], [22, 78], [17.5, 86], [10, 92], [0, 95]],
        voidborn: [[0, 10], [8, 12], [14, 18], [17, 28], [18, 40], [18, 50], [16, 60], [13, 70], [9, 80], [5, 90], [2, 98], [0, 101]],
        machine: [[0, 15], [12, 16], [18, 18], [20, 30], [21, 40], [21, 50], [20, 60], [19, 72], [16, 84], [12, 88], [0, 90]]
    };
    // Proportions: shorter and broader than the raw tables (eyes at ~45% of the face height).
    Object.keys(HEAD_HALF).forEach((f) => { const y0 = HEAD_HALF[f][0][1]; HEAD_HALF[f] = HEAD_HALF[f].map(([hw, y]) => [hw * 1.12, y0 + (y - y0) * (f === 'voidborn' ? 0.92 : 0.87)]); });
    HEAD_HALF.pirate = HEAD_HALF.terran;
    const FACE = { terran: { my: 70, nose: 1, brow: 1 }, pirate: { my: 70, nose: 1, brow: 1 }, kronax: { my: 73, nose: 0.8, brow: 1.6 }, voidborn: { my: 77, nose: 0.3, brow: 0.6 }, machine: { my: 72, nose: 0.6, brow: 0.5 } };
    const HEAD_CACHE = {};
    const headPoly = (f, female) => {                                    // female: narrower jaw and chin, softer cheeks
        const key = f + (female ? 'F' : 'M');
        if (!HEAD_CACHE[key]) HEAD_CACHE[key] = smooth(mirror(HEAD_HALF[f].map(([hw, y]) => [female ? hw * (y <= 56 ? 0.97 : 0.97 - (y - 56) * 0.0046) : hw, y])), f === 'machine' ? 0 : 1);
        return HEAD_CACHE[key];
    };
    const EARS = {
        terran: [ellipse(22.5, 52, 3.8, 7, 12), ellipse(73.5, 52, 3.8, 7, 12)],
        kronax: [[[30, 48], [13, 33], [27, 62]], [[66, 48], [83, 33], [69, 62]]],
        voidborn: [[[31, 46], [10, 20], [30, 60]], [[65, 46], [86, 20], [66, 60]]],
        machine: [ellipse(25, 52, 5, 6, 10), ellipse(71, 52, 5, 6, 10)]
    };
    EARS.pirate = EARS.terran;
    const NECK = [[38, 74], [58, 74], [66, 100], [30, 100]], NECK_F = [[41, 74], [55, 74], [62, 100], [34, 100]];
    const CUPS = [smooth(ellipse(21, 53, 6.5, 9.5, 12), 0), smooth(ellipse(75, 53, 6.5, 9.5, 12), 0)];
    const HAIR = smooth(mirror([[0, 14], [16, 16], [23, 26], [24, 40], [19, 41], [12, 33], [0, 31]]), 1);
    // Helmet shells (symmetric) with add-on parts behind the shell, ear cups and forehead strap.
    const CAP = mirror([[0, 8], [16, 10], [24, 20], [26, 32], [24, 41], [18, 38], [10, 35], [0, 34]]);
    const HELMETS = [
        { pts: CAP, it: 1 },
        { pts: CAP, it: 1, cups: true },
        { pts: mirror([[0, 8], [16, 10], [26, 20], [30, 36], [30, 58], [25, 66], [20, 60], [21, 46], [14, 38], [0, 35]]), it: 1 },
        { pts: CAP, it: 1, extra: [[[34, 14], [48, 0], [62, 14]]] },
        { pts: CAP, it: 1, extra: [[[24, 24], [10, 2], [31, 17]], flipX([[24, 24], [10, 2], [31, 17]])] },
        { pts: mirror([[0, 8], [16, 10], [24, 20], [26, 32], [26, 42], [18, 42], [10, 43], [0, 44]]), it: 1, cups: true },
        { pts: CAP, it: 1, extra: [mirror([[0, 6], [20, 8], [32, 24], [36, 50], [34, 80], [26, 94], [0, 98]])] },
        { pts: CAP, it: 0, extra: [[[28, 18], [26, 4], [39, 12]], [[43, 10], [48, 0], [53, 10]], [[57, 12], [70, 4], [68, 18]]] },
        { pts: mirror([[0, 12], [16, 14], [24, 24], [26, 42], [22, 42], [20, 29], [14, 23], [0, 21]]), it: 1, cups: true, boom: true },
        { pts: CAP, it: 1, cups: true, strap: true }
    ];

    // Pilot: frontal face under a flight helmet, rim-lit by the faction accent from the right.
    function build(look, accent) {
        const faction = SPECIES[look.faction] ? look.faction : 'terran';
        const S = SPECIES[faction];
        const acc = hex(accent || '#c8a040');
        const skin = hex(S.skins[look.skin % S.skins.length]), skinB = skin.map((v) => v * (look.faction === 'voidborn' ? 1.0 : 1.4));
        const female = look.gender != null ? look.gender >= 4 : look.sex === 1, hairBase = hex(HAIRS[(look.hairc || 0) % HAIRS.length]).map((v) => v * 1.6 + 8);
        const gearIdx = look.gear % 3;
        const buf = new Array(W * H).fill(null), ids = new Uint8Array(W * H), visorMask = new Uint8Array(W * H);
        const layers = { eye: [], lamp: [], glint: [] };               // animated overlays: [x, y, colour]
        let curId = 0;      // depth: 1 suit, 2 neck, 3 skin, 4 behind-shell parts, 5 shell, 6 cups, 7 glass, 9 loose detail (no outline)
        const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) { buf[y * W + x] = c; ids[y * W + x] = curId; } };
        const get = (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < W && y < H ? buf[y * W + x] : null; };
        const idAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? ids[Math.round(y) * W + Math.round(x)] : 0);
        const visorD = (x, y) => (visorMask[Math.round(y) * W + Math.round(x)] ? 0.5 : 2);
        const shade = (base, t, x, y) => {
            const thr = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
            const lvl = Math.max(0, Math.min(TONES.length - 1, Math.floor(t * (TONES.length - 1) + 0.5 + (thr - 0.5) * 0.28)));
            const f = TONES[lvl], sh = 1 - f, hi = Math.max(0, f - 0.7);
            // shadows drift to violet, highlights to warm
            return [base[0] * f + sh * 12 + hi * 90, base[1] * f + sh * 8 + hi * 55, base[2] * f + sh * 34 + hi * 10];
        };
        const SKT = [0.08, 0.17, 0.3, 0.45, 0.6, 0.76, 0.93];
        const skinShade = (base, t, x, y) => {                          // smooth skin ramp: 7 levels, barely any dither
            const thr = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
            const f = SKT[Math.max(0, Math.min(6, Math.floor(t * 6 + 0.5 + (thr - 0.5) * 0.14)))], sh = 1 - f, hi = Math.max(0, f - 0.75);
            const c = [base[0] * f + sh * 10 + hi * 60, base[1] * f + sh * 6 + hi * 36, base[2] * f + sh * 26 + hi * 8], gr = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
            return c.map((v) => v * 0.96 + gr * 0.04);                                                   // less plastic: slightly desaturated
        };
        // Chamfered surface: bevel band lit by its edge normal (light L), flat planes inside, accent rim on the right edges.
        const bevel = (base, q, bw, lift, rimK, L) => {
            L = L || [0.6, -0.7];
            const dot = q.nx * L[0] + q.ny * L[1], rd = q.nx * 0.6 - q.ny * 0.7;
            const raw = q.d < bw ? 0.2 + 0.7 * Math.max(0, Math.min(1, dot * 0.55 + 0.5))
                : 0.58 + Math.max(-0.2, Math.min(0.2, ((q.x - 48) * 0.35 - (q.y - 50) * 0.3) / 24)) + (lift || 0);
            const c = shade(base, Math.round(raw * 4) / 4, q.x, q.y);                  // snapped to a band: flat planes, no checker dither
            return q.d < 1.3 && rd > 0.6 ? c.map((v, i) => Math.min(255, v + acc[i] * 0.45 * (rimK == null ? 1 : rimK))) : c;
        };
        const surf = (base, nx, ny, nz, x, y, rim, lift) => bevel(base, { x, y, d: nz < 0.6 ? 1 : 4, nx, ny }, 3, lift, rim);   // flat-lit patch for gear details
        const line = (x0, y0, x1, y1, col, k) => {
            const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, c = typeof col === 'string' ? hex(col) : col;
            for (let i = 0; i <= n; i++) set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, k ? c.map((v) => v * k) : c);
        };
        const paint = (pts, id, fn) => { curId = id; raster(pts).forEach((q) => set(q.x, q.y, fn(q))); };
        const paintOnFace = (pts, fn) => { curId = 9; raster(pts).forEach((q) => { if (idAt(q.x, q.y) === 3 || idAt(q.x, q.y) === 9) set(q.x, q.y, fn(q)); }); };   // clipped to the face
        const onSkin = (x, y) => idAt(x, y) === 3;
        const both = (fn) => [-1, 1].forEach(fn);                       // left / right of the centre line

        // Background: near-black with a soft accent glow behind the head.
        curId = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const d = Math.hypot((x - 60) / 50, (y - 36) / 54);
            set(x, y, shade(acc.map((v) => v * 0.55), Math.max(0, 1 - d) * 0.38 + 0.03, x, y));
        }

        // ---- Shoulders / suit ----
        const suit = hex(S.cloth).map((v) => v * 1.4 + 38), trim = hex(S.trim);
        paint([[0, 96], [10, 88], [28, 82], [68, 82], [86, 88], [96, 96], [96, 108], [0, 108]], 1, (q) => bevel(suit, q, 3, Math.sin(q.x * 0.3 + q.y * 0.12) > 0.55 ? 0.1 : 0, 0.8));
        paint([[72, 86], [96, 90], [96, 106], [78, 102]], 2, (q) => bevel(trim.map((v) => v * 0.7), q, 3, 0, 0.7));
        paint([[24, 86], [0, 90], [0, 106], [18, 102]], 2, (q) => bevel(trim.map((v) => v * 0.55), q, 3, 0, 0.4));
        curId = 9;
        line(30, 100, 40, 108, trim, 0.4); line(31, 100, 41, 108, [10, 10, 14]); line(66, 100, 56, 108, trim, 0.4);
        const bx = 82, by = 97;                                          // faction patch: triangle badge
        for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) {
            const inT = faction === 'machine' ? (x * x + y * y <= 36) : (y >= -5 && Math.abs(x) <= (y + 5) * 0.62 + 0.5 && y <= 5);
            if (!inT) continue;
            const edge = faction === 'machine' ? (x * x + y * y > 22) : (y > 3 || Math.abs(x) > (y + 5) * 0.62 - 1.2);
            set(bx + x, by + y, edge ? trim.map((v) => v * 0.75) : [12, 12, 14]);
        }
        if (gearIdx === 2) for (let i = 0; i < 26; i++) set(8 + i * 0.9, 90 + Math.sin(i * 0.5) * 3 + i * 0.6, [8, 8, 10]);   // hanging cable

        // ---- Neck, collar ----
        paint(female ? NECK_F : NECK, 2, (q) => bevel(faction === 'machine' ? [60, 66, 76] : skinB.map((v) => v * 0.7), q, 3, 0, 0.5, [-0.4, -0.6]));
        if (faction === 'machine') { curId = 9; for (let i = 0; i < 4; i++) line(40 + i * 5, 76, 38 + i * 6, 98, i % 2 ? [20, 22, 28] : trim.map((v) => v * 0.7)); }
        if (faction === 'voidborn') {                                    // tall cowl rising beside the jaw, glowing hem
            paint([[18, 102], [20, 62], [34, 86], [62, 86], [76, 62], [78, 102]], 2, (q) => bevel([46, 40, 96], q, 3, Math.sin(q.x * 0.4) > 0.6 ? 0.1 : 0, 0.9));
            curId = 9; line(20, 62, 34, 86, trim.map((v) => Math.min(255, v * 1.3))); line(76, 62, 62, 86, trim.map((v) => Math.min(255, v * 1.3)));
        } else if (faction === 'kronax') {                               // fur ruff + bone spikes
            paint([[20, 88], [48, 94], [76, 88], [82, 102], [14, 102]], 2, (q) => bevel([120, 92, 62], q, 3, hash(q.x >> 1, q.y >> 1) < 0.3 ? 0.18 : -0.08, 0.5));
            [[[70, 88], [74, 74], [78, 88]], [[80, 90], [86, 76], [90, 92]], [[18, 88], [22, 74], [26, 88]], [[6, 92], [10, 78], [16, 92]]].forEach((t) => paint(t, 2, (q) => bevel([226, 218, 196], q, 2, 0, 0.5)));
        } else if (faction === 'pirate') {                               // knotted red scarf + bandolier
            paint([[30, 86], [66, 86], [72, 94], [48, 102], [24, 94]], 2, (q) => bevel([170, 44, 44], q, 2.5, ((q.x + q.y) % 5 < 1) ? -0.12 : 0, 0.7));
            curId = 9; line(4, 92, 62, 108, [34, 22, 16]); line(4, 93, 62, 109, [60, 42, 28]);
            for (let i = 0; i < 6; i++) { const bx2 = 12 + i * 9, by2 = 96 + i * 2.7; set(bx2, by2, [220, 180, 70]); set(bx2, by2 + 1, [220, 180, 70]); }
        } else if (faction === 'machine') {
            paint([[26, 88], [48, 94], [70, 88], [76, 100], [20, 100]], 2, (q) => bevel(trim.map((v) => v * 0.45), q, 2.5, q.y % 4 === 0 ? 0.1 : 0, 0.7));
            curId = 9; for (let i = 0; i < 5; i++) set(30 + i * 9, 98, trim.map((v) => Math.min(255, v * 1.3)));
        } else {                                                         // terran: zipped flight collar, rank chevrons
            paint([[26, 88], [48, 94], [70, 88], [76, 100], [20, 100]], 2, (q) => bevel(trim.map((v) => v * 0.6), q, 2.5, q.y % 5 === 0 ? 0.1 : 0, 0.7));
            curId = 9; line(48, 94, 48, 108, [20, 22, 28]); for (let i = 0; i < 3; i++) { line(6, 100 + i * 3, 12, 97 + i * 3, trim); line(12, 97 + i * 3, 18, 100 + i * 3, trim); }
        }

        // ---- Head: ears first, then the face ----
        const g = gauss, P = FACE[faction], MY = P.my, KEY = [-0.45, -0.5, 0.74];
        const H0 = HELMETS[look.hair % HELMETS.length];
        const shellBase = hex(PAINTS[look.hairCol % PAINTS.length]).map((v, i) => v * 1.25 + acc[i] * 0.06);
        (H0.extra || []).forEach((poly) => paint(poly, 4, (q) => bevel(shellBase.map((v) => v * 0.7), q, 2.5, -0.05)));   // crest, horns, hood: behind the head
        if (female && faction !== 'machine') [[[22, 22], [30, 30], [33, 54], [33, 80], [29, 94], [16, 94], [15, 62], [18, 34]], flipX([[22, 22], [30, 30], [33, 54], [33, 80], [29, 94], [16, 94], [15, 62], [18, 34]])].forEach((c) => paint(smooth(c, 1), 4, (q) => bevel(hairBase, q, 3, ((q.x + q.y * 0.5) % 7 < 1.2) ? 0.12 : 0, 0.5, [-0.45, -0.6])));   // long hair: two side curtains
        EARS[faction].forEach((ear) => paint(ear, 3, (q) => bevel(skinB.map((v) => v * 0.88), q, 2, 0, 0.5, [-0.45, -0.6])));
        if (faction === 'terran' || faction === 'pirate') [21.6, 74.4].forEach((ex) => paint(ellipse(ex, 53, 1.8, 4.4, 10), 3, (q) => skinShade(skinB.map((v) => v * 0.55), 0.35, q.x, q.y)));
        if (faction === 'machine') {
            paint(headPoly('machine', female), 3, (q) => bevel(skinB, q, 3, 0, 0.5, [-0.45, -0.6]));
        } else {
            // Organic face: height field (rounded skull + brow, sockets, nose, cheekbones, lips, chin) lit by its surface normal.
            const hq = raster(headPoly(faction, female)), Z = new Float32Array(W * H), R = 13;
            hq.forEach((q) => {
                const e = 1 - Math.min(q.d, R) / R, X = q.x, Y = q.y;
                let z = R * Math.sqrt(Math.max(0, 1 - e * e));
                z += 2 * g(X, Y, 48, 30, 16, 9) + P.brow * (female ? 0.7 : 1.1) * (3 + look.brow * 0.7) * (g(X, Y, 39, 41, 8, 2.2) + g(X, Y, 57, 41, 8, 2.2));
                z -= 1.8 * (g(X, Y, 39, 47, 5, 3.2) + g(X, Y, 57, 47, 5, 3.2));
                let ridge = 0; for (let i = 0; i <= 5; i++) ridge = Math.max(ridge, g(X, Y, 48, 43 + i * 3.2, 1.2 + i * 0.15, 2.6));
                z += P.nose * (female ? 0.82 : 1) * (3.6 * ridge + 3.6 * g(X, Y, 48, 60, 2.2, 2.1) + 1.8 * (g(X, Y, 44.6, 61, 1.5, 1.6) + g(X, Y, 51.4, 61, 1.5, 1.6)) - 1.0 * (g(X, Y, 43, 51, 1.8, 5) + g(X, Y, 53, 51, 1.8, 5)) - 0.8 * g(X, Y, 48, 66, 1.4, 1.8));
                z += (female ? 1.2 : 1.9) * (g(X, Y, 35, 57, 6, 4) + g(X, Y, 61, 57, 6, 4)) - (female ? 0.9 : 1.7) * (g(X, Y, 36, 69, 6, 5) + g(X, Y, 60, 69, 6, 5));
                const LP = female ? 1.3 : 0.85; z += LP * (1.5 * g(X, Y, 48, MY - 2.6, 5.2, 1.3) - 0.6 * g(X, Y, 48, MY - 3.2, 1.2, 1) + 2 * g(X, Y, 48, MY + 2.6, 4.8, 1.8)) - 2.2 * g(X, Y, 48, MY, 6.2, 0.5) - 1.2 * (g(X, Y, 41.5, MY, 1.3, 1.3) + g(X, Y, 54.5, MY, 1.3, 1.3)) + 2.4 * g(X, Y, 48, MY + 10, 7, 4);
                Z[Y * W + X] = z;
            });
            hq.forEach((q) => {
                const i = q.y * W + q.x, gx = (Z[i + 1] - Z[i - 1]) / 2, gy = (Z[i + W] - Z[i - W]) / 2, l = Math.hypot(gx, gy, 1.0);
                const nx = -gx / l, ny = -gy / l, nz = 1.0 / l;
                let c = skinShade(skinB, 0.02 + (nx * KEY[0] + ny * KEY[1] + nz * KEY[2]), q.x, q.y);
                const lip = Math.max(g(q.x, q.y, 48, MY - 2.6, 5.4, 1.5), g(q.x, q.y, 48, MY + 2.6, 5, 2));
                if (lip > 0.45) c = female ? [c[0] * 1.02, c[1] * 0.78, c[2] * 0.82] : [c[0] * 0.98, c[1] * 0.84, c[2] * 0.86];
                const bl = (g(q.x, q.y, 36, 62, 6, 5) + g(q.x, q.y, 60, 62, 6, 5)) * 0.08; c = [c[0] + 16 * bl, c[1] - 2 * bl, c[2] - 4 * bl];
                const rim = nx * 0.75 - ny * 0.4 - 0.15;
                if (q.d < 3 && rim > 0) c = c.map((v, k) => Math.min(255, v + acc[k] * 0.5 * Math.min(1, rim * 1.6)));
                curId = 3; set(q.x, q.y, c);
            });
        }
        for (let y = 34; y < H; y++) for (let x = 0; x < W; x++) if (ids[y * W + x] === 3) visorMask[y * W + x] = 1;   // face area: gear keeps off it
        curId = 9;
        // Adult skin: pores, frown lines, nasolabial folds, eye bags, crow's feet.
        if (faction !== 'machine' && faction !== 'voidborn') {
            const dk = (x, y, k) => { if (onSkin(x, y)) set(x, y, get(x, y).map((v) => v * k)); };
            const ag = female ? 0.93 : 0.86;
            for (let y = 34; y < 92; y++) for (let x = 20; x < 76; x++) if (onSkin(x, y) && hash(x * 3, y * 7) < (female ? 0.012 : 0.03)) set(x, y, get(x, y).map((v) => v * 0.95));
            both((s2) => {
                for (let t = 0; t <= 8; t++) dk(48 + s2 * (5.5 + t * 0.55), 62 + t * ((MY - 61) / 8), ag);                   // nasolabial fold
                for (let t = -4; t <= 4; t++) dk(48 + s2 * 9 + t, 52.5 + Math.abs(t) * 0.25, ag + 0.05);                      // eye bag
                dk(48 + s2 * 15, 46, 0.86); dk(48 + s2 * 16, 48, 0.86); dk(48 + s2 * 15, 50, 0.86);                           // crow's feet
            });
            if (!female) both((s2) => { for (let y = 37; y < 42; y++) dk(48 + s2 * 2, y, 0.78); });                           // frown lines
        }
        // Nose: nostrils and the shadow under it; features that need a flat look on the android.
        if (faction === 'voidborn') both((s2) => set(48 + s2 * 1.6, 60, skinB.map((v) => v * 0.35)));            // slit nostrils
        else if (faction === 'machine') { line(48, 46, 48, 58, skinB.map((v) => Math.min(255, v * 1.2))); line(44, 61, 52, 61, skinB.map((v) => v * 0.3)); }
        else {
            const dkn = [40, 24, 22];
            both((s2) => { set(48 + s2 * 2.4, 62, dkn); set(48 + s2 * 2.4, 63, dkn.map((v) => v * 1.4)); });
            for (let x = 44; x <= 53; x++) { const c = get(x, 64); if (c && onSkin(x, 64)) set(x, 64, c.map((v) => v * (x > 49 ? 0.82 : 0.9))); }   // cast shadow under the nose, longer toward the right
        }
        if (faction === 'kronax') {                                      // tusks + war paint
            both((s2) => { paint([[48 + s2 * 8, MY + 8], [48 + s2 * 9, MY - 6], [48 + s2 * 4, MY + 2]], 9, (q) => bevel([232, 224, 198], q, 2, 0, 0.5)); });
            curId = 9; both((s2) => [[56, 54], [56, 58]].forEach((o) => { line(48 + s2 * 10, o[0], 48 + s2 * 20, o[1] + 2, trim.map((v) => v * 1.1)); line(48 + s2 * 10, o[0] + 1, 48 + s2 * 20, o[1] + 3, trim.map((v) => v * 0.8)); }));
        }
        if (faction === 'voidborn') { curId = 9; const rune = trim.map((v) => Math.min(255, v * 1.4)); both((s2) => { line(48 + s2 * 12, 60, 48 + s2 * 15, 72, rune); line(48 + s2 * 8, 66, 48 + s2 * 12, 70, rune, 0.7); }); set(48, 36, rune); }
        if (faction === 'machine') {                                     // faceplate seams + rivets
            curId = 9; line(48, 40, 48, 44, [14, 16, 20]); line(28, 66, 68, 66, [14, 16, 20]); both((s2) => line(48 + s2 * 14, 40, 48 + s2 * 18, 66, [14, 16, 20]));
            [[32, 56], [64, 56], [34, 78], [62, 78]].forEach(([rx, ry]) => { set(rx, ry, [200, 206, 216]); set(rx + 1, ry, [60, 66, 76]); });
        }
        // Beard option: none / chin strap / stubble / full beard.
        if (look.beard === 2 || (faction === 'pirate' && look.beard === 0)) for (let y = 64; y < 96; y++) for (let x = 24; x < 72; x++) if (onSkin(x, y) && hash(x, y) < 0.22 && y > 66 + Math.abs(x - 48) * 0.1) set(x, y, get(x, y).map((v) => v * 0.8));
        if (look.beard === 3) paintOnFace([[26, 66], [38, 64], [48, 68], [58, 64], [70, 66], [66, 86], [48, 98], [30, 86]], (q) => bevel(hairBase, q, 3, hash(q.x, q.y) < 0.3 ? 0.12 : 0, 0.4, [-0.45, -0.6]));
        // Mouth: line and corner shadows (the lips come from the height field).
        if (faction === 'machine') for (let i = 0; i < 5; i++) line(40 + i * 3.4, MY - 2, 40 + i * 3.4, MY + 5, [10, 12, 16]);
        else if (faction === 'voidborn') line(43, MY, 53, MY, [60, 40, 90]);
        else { const mc = faction === 'kronax' ? [40, 20, 20] : skinB.map((v, k) => v * [0.34, 0.2, 0.2][k] + 14); line(42, MY, 54, MY, mc); set(41, MY - 1, mc.map((v) => v * 1.3)); set(55, MY - 1, mc.map((v) => v * 1.3)); }
        // Mask option: none / oxygen mask + hoses / filter canister / scarf.
        if (look.mouth === 1) {
            paintOnFace([[30, 63], [66, 63], [70, 78], [60, 94], [48, 98], [36, 94], [26, 78]], (q) => bevel([100, 106, 118], q, 3, 0, 1));
            both((s2) => { line(48 + s2 * 15, 78, 48 + s2 * 24, 98, [10, 10, 14]); line(48 + s2 * 15 + 1, 78, 48 + s2 * 24 + 1, 98, [64, 70, 80]); });
            for (let i = 0; i < 3; i++) line(42 + i * 6, 74, 42 + i * 6, 84, [14, 14, 18]);
        }
        if (look.mouth === 2) {                                          // voice grille: flat plate with slits and side tubes
            for (let y = -5; y <= 5; y++) for (let x = -11; x <= 11; x++) set(48 + x, MY + 3 + y, bevel([86, 92, 102], { x: 48 + x, y: MY + 3 + y, d: Math.min(5 - Math.abs(y), 11 - Math.abs(x)) + 1, nx: x / 11, ny: y / 5 }, 3, 0));
            for (let i = 0; i < 3; i++) line(41, MY + 1 + i * 3, 55, MY + 1 + i * 3, [12, 12, 16]);
            both((s2) => line(48 + s2 * 11, MY + 3, 48 + s2 * 22, MY - 10, [20, 20, 26]));
        }
        if (look.mouth === 3) paintOnFace([[26, 68], [70, 68], [74, 86], [48, 100], [22, 86]], (q) => bevel(trim.map((v) => v * 0.65), q, 2.5, ((q.x + q.y) % 6 < 1) ? -0.15 : 0, 0.6));
        if (look.beard === 1) {                                          // chin strap
            line(27, 56, 33, 84, [30, 22, 18]); line(33, 84, 48, 90, [30, 22, 18]); line(48, 90, 63, 84, [30, 22, 18]); line(63, 84, 69, 56, [30, 22, 18]);
            set(47, 91, [200, 170, 90]); set(48, 91, [200, 170, 90]); set(49, 91, [200, 170, 90]);
        }
        // Scar: across the eye / cheek slash / burn.
        if (look.scar === 1) { line(54, 36, 60, 57, [130, 62, 64]); line(55, 36, 61, 57, skinB.map((v) => Math.min(255, v * 1.1))); }
        if (look.scar === 2) { line(56, 60, 66, 71, [130, 62, 64]); line(56, 61, 66, 72, skinB.map((v) => Math.min(255, v * 1.1))); }
        if (look.scar === 3) for (let y = 52; y < 74; y++) for (let x = 50; x < 70; x++) if (onSkin(x, y) && Math.hypot(x - 59, y - 62) < 4.5 + hash(x, y) * 2) set(x, y, hash(x + 1, y) < 0.35 ? [150, 70, 60] : get(x, y).map((v, k) => v * [0.85, 0.7, 0.7][k]));

        // ---- Helmet ----
        paint(HAIR, 4, (q) => bevel(hairBase, q, 2.5, hash(q.x >> 1, q.y >> 1) < 0.25 ? 0.12 : 0, 0.5, [-0.45, -0.6]));
        paint(smooth(H0.pts, H0.it), 5, (q) => {
            const seam = (q.d >= 3 && q.y < 30 && (q.y % 19) < 1) ? -0.14 : 0;
            return q.d >= 3 && Math.abs(q.x - 48) < 1.4 && q.y < 32 ? shade(trim, 0.62, q.x, q.y) : bevel(shellBase, q, 3.5, seam);
        });
        if (H0.cups) CUPS.forEach((cup) => paint(cup, 6, (q) => bevel(shellBase.map((v) => v * 0.8), q, 3, q.d > 3 && q.d < 4.2 ? -0.15 : 0, 0.8)));
        curId = 9;
        if (H0.boom) { line(26, 62, 38, 72, [20, 20, 24]); line(38, 72, 44, 74, [20, 20, 24]); set(45, 74, [60, 64, 72]); set(45, 75, [60, 64, 72]); set(46, 75, [60, 64, 72]); }
        if (H0.strap) { line(24, 38, 48, 35, [26, 22, 22]); line(48, 35, 72, 38, [26, 22, 22]); line(24, 39, 48, 36, trim.map((v) => v * 0.5)); line(48, 36, 72, 39, trim.map((v) => v * 0.5)); }

        // ---- Eyewear ----
        const glass = (poly, id, tintK) => raster(poly).forEach((q) => {
            curId = 7;
            if (q.d < 2.2) { set(q.x, q.y, bevel([128, 134, 146], q, 2.2, 0, 1.2)); return; }
            const under = get(q.x, q.y) || [10, 12, 18], top = Math.max(0, 1 - Math.hypot(q.x - 62, q.y - 40) / 22);
            if ((q.x + q.y) % 23 < 2 && q.d > 3) layers.glint.push([q.x, q.y, [200, 224, 250]]);
            set(q.x, q.y, under.map((v, i) => Math.min(255, v * (1 - tintK) + ([26, 50, 70][i] + acc[i] * 0.25) * tintK + acc[i] * top * 0.3)));
        });
        if (look.face === 1) {                                           // goggles pushed up onto the helmet
            line(22, 30, 74, 30, [26, 24, 30]); line(22, 31, 74, 31, [14, 14, 18]);
            glass(ellipse(38, 27, 8.5, 5.5), 7, 0.85); glass(ellipse(58, 27, 8.5, 5.5), 7, 0.85);
        }
        if (look.face === 2) glass([[27, 40], [69, 40], [67, 54], [29, 54]], 7, 0.5);
        if (look.face === 3) { glass(ellipse(57, 46.5, 9.5, 8.5), 7, 0.4); line(66, 42, 76, 34, [60, 64, 72]); set(77, 33, [255, 60, 50]); }
        if (look.face === 4) glass([[26, 38], [70, 38], [68, 62], [58, 80], [48, 84], [38, 80], [28, 62]], 7, 0.4);

        // ---- Eyes (animated overlay): almond eyes with lids, iris, pupil and catchlight; faction variants ----
        {
            const eyeCol = hex(EYE_COLS[look.eye % EYE_COLS.length]), ES = EYE_SHAPES[look.eye % EYE_SHAPES.length];
            const glow = look.face === 2 || look.face === 4;
            const brown = hairBase.map((v) => v * 0.45);
            if (faction === 'machine') {                                 // one LED bar instead of eyes
                const bright = eyeCol.map((v) => Math.min(255, v * 1.5 + 60));
                for (let x = 31; x <= 65; x++) for (let y = 45; y <= 47; y++) layers.eye.push([x, y, y === 46 && Math.abs(x - 48) < 8 ? [255, 255, 250] : bright.map((v) => v * (y === 46 ? 1 : 0.55))]);
            } else [[39, 46.5, -1], [57, 46.5, 1]].forEach(([cx, cy, side]) => {      // side: -1 left of centre, +1 right (outer corner lies on that side)
                if (faction === 'pirate' && side < 0) return;            // eyepatch side
                const big = faction === 'voidborn' ? 1.1 : 1;
                const w = (5.4 + ES.w * 0.2) * big, h = (1.9 + ES.h * 0.45) * big * (female ? 1.12 : 1);
                for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w); x++) {
                    const u = (x - cx) / w, lidK = Math.max(0, 1 - u * u), sl = -u * side * (1.1 + ES.sl * 2);
                    const up = -h * Math.pow(lidK, 0.62) + sl, lo = h * 0.55 * Math.pow(lidK, 0.8) + sl * 0.6;
                    const top = Math.ceil(cy + up);
                    for (let y = top; y <= Math.floor(cy + lo); y++) {
                        const dy = y - cy;
                        let c;
                        if (faction === 'voidborn') { const r = Math.hypot(x - cx + 0.5, dy - 0.3); c = r < 1.7 ? eyeCol.map((v) => Math.min(255, v * 1.25 + 25)) : [10, 8, 22]; if (r < 0.7) c = [14, 10, 24]; if (Math.abs(x - cx + 1.2) < 0.6 && Math.abs(dy + 0.8) < 0.6) c = [255, 255, 255]; }
                        else if (glow) c = Math.abs(u) < 0.3 ? [255, 255, 245] : eyeCol.map((v) => Math.min(255, v * 1.5 + 40) * (0.85 - Math.abs(u) * 0.3));
                        else {
                            const ix = cx - side * 0.2, iy = cy + 0.3, r = Math.hypot(x - ix, y - iy), ir = 2.2 * (faction === 'kronax' ? 1.1 : 1);
                            const rad = Math.min(1, u * u + (dy / (h + 0.5)) ** 2);
                            c = [186 - 80 * rad, 178 - 78 * rad, 172 - 72 * rad];                          // sclera: dim, darker toward the rim
                            if (r < ir) { const k = 0.5 + 0.5 * Math.max(0, (y - iy + ir) / (ir * 2)); c = eyeCol.map((v) => v * k * (r > ir - 0.9 ? 0.6 : 1)); if (r < 1) c = faction === 'kronax' ? [180, 36, 28] : [6, 6, 10]; }
                            else if (faction === 'kronax') c = [200, 186, 110].map((v) => v * (1 - rad * 0.4));
                            if (y === top + 1) c = c.map((v) => v * 0.58);                                 // heavy upper-lid shadow
                            if (x === Math.round(ix - 1) && y === Math.round(iy - 1.3) && r < ir) c = [200, 206, 214];   // catchlight
                            if (x === (side < 0 ? Math.floor(cx + w) : Math.ceil(cx - w))) c = [190, 124, 118];            // tear duct on the nose side
                        }
                        if (y === top || (y === top + 1 && u * side > 0.15 && !glow)) c = [30, 20, 20];    // lash line, thicker toward the outer corner
                        layers.eye.push([x, y, c]);
                    }
                    if (female && faction !== 'voidborn' && !glow) layers.eye.push([x, top - 1, [26, 16, 18]]);                                   // thicker lashes
                    curId = 9;
                    if (faction !== 'voidborn') { const cr = Math.round(cy + up) - 2; if (onSkin(x, cr)) set(x, cr, get(x, cr).map((v) => v * 0.8)); if (onSkin(x, cr - 1)) set(x, cr - 1, get(x, cr - 1).map((v) => v * 0.92)); const lw = Math.floor(cy + lo) + 1; if (Math.abs(u) < 0.8 && onSkin(x, lw)) set(x, lw, get(x, lw).map((v) => v * 0.88)); }   // lid crease + lower lid
                }
                curId = 9;
                if (faction !== 'voidborn') for (let r = 0; r <= (female ? 0 : look.brow * 0.7) + (faction === 'kronax' ? 1 : 0); r++) for (let x = Math.round(cx - w - 1); x <= Math.round(cx + w + 1); x++) {
                    const u = (x - cx) / (w + 2), yy = Math.round(cy - h - 3.2 - r - (female ? 2.4 : 1.8) * Math.cos(u * 1.4) + u * side * 1.4);
                    if (onSkin(x, yy)) set(x, yy, brown);                                                   // arched brow
                }
            });
        }
        curId = 9;
        if (faction === 'pirate') {                                      // eyepatch, strap, gold hoop
            paint(ellipse(39, 46.5, 8, 6.5), 9, (q) => bevel([36, 34, 40], q, 2, 0, 0.6));
            curId = 9; line(31, 43, 22, 30, [20, 16, 18]); line(47, 42, 72, 34, [20, 16, 18]); line(31, 50, 26, 58, [20, 16, 18]);
            for (let i = 0; i < 8; i++) set(70 + Math.cos(i * 0.785) * 2.6, 61 + Math.sin(i * 0.785) * 2.6, [226, 184, 72]);
            if (gearIdx === 1) { set(44, MY + 3, [226, 184, 72]); set(45, MY + 3, [226, 184, 72]); }
        }
        // Fixture (helmet): none / antenna / lamp / side sensor / vents.
        if (look.nose === 1) { line(58, 12, 64, -1, [96, 102, 112]); layers.lamp.push([64, 0, [255, 60, 50]], [63, 0, [120, 30, 30]], [65, 0, [120, 30, 30]]); }
        if (look.nose === 2) { for (let y = 0; y < 4; y++) for (let x = 0; x < 11; x++) { if (y === 0) layers.lamp.push([43 + x, 19, acc.map((v) => Math.min(255, v * 1.3 + 40))]); else set(43 + x, 19 + y, [40, 44, 52]); } }
        if (look.nose === 3) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const r = x * x + y * y; if (r <= 16) { if (r < 3) layers.lamp.push([66 + x, 24 + y, acc.map((v) => Math.min(255, v * 1.4 + 60))]); else set(66 + x, 24 + y, r < 9 ? [10, 10, 14] : trim.map((v) => v * 0.6)); } }
        if (look.nose === 4) for (let i = 0; i < 4; i++) line(58, 16 + i * 3, 70, 20 + i * 3, [10, 10, 14]);

        // ---- Faction gear ----
        if (faction === 'kronax') {
            if (gearIdx === 1) { for (let i = 0; i < 8; i++) set(48 + Math.cos(i * 0.785) * 3, MY - 6 + Math.sin(i * 0.785) * 3, [200, 196, 190]); line(48, MY - 3, 48, MY + 8, [200, 196, 190], 0.8); }   // nose ring + chain
            if (gearIdx === 2) for (let i = 0; i < 7; i++) { const x = 30 + i * 6, y = 96 + Math.sin(i * 0.9) * 2; for (let k = 0; k < 4; k++) set(x, y + k, [232, 224, 198]); }   // bone necklace
        }
        if (faction === 'voidborn') {
            if (gearIdx === 1) for (let a2 = 0.1; a2 < 6.2; a2 += 0.02) if (Math.sin(a2 * 5) > -0.5) set(48 + Math.cos(a2) * 42, 44 + Math.sin(a2) * 44, trim.map((v) => v * (0.4 + 0.4 * Math.sin(a2 * 3))));   // halo ring
            if (gearIdx === 2) { line(30, 90, 38, 104, trim.map((v) => Math.min(255, v * 1.2))); line(66, 90, 58, 104, trim.map((v) => Math.min(255, v * 1.2))); }
            for (let i = 0; i < 24; i++) set(4 + hash(i, 7) * 88, 4 + hash(i, 9) * 70, trim.map((v) => v * (0.2 + hash(i, 5) * 0.4)));
        }
        if (faction === 'pirate') {
            if (gearIdx === 0) for (let y = 14; y < 24; y++) for (let x = 20; x < 76; x++) { const g2 = get(x, y); if (g2 && ids[y * W + x] === 5) set(x, y, shade([120, 24, 30], 0.35 + (x > 56 ? 0.25 : 0), x, y)); }   // bandana band over the helmet
            if (gearIdx === 2) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 14) set(48 + x, 96 + y, Math.abs(x) < 1 && y > -2 && y < 2 ? [12, 12, 14] : [226, 220, 205]);   // skull badge
        }
        if (faction === 'machine') {
            for (let i = 0; i < 6; i++) line(42 + i * 2.2, 8, 42 + i * 2.2, 14 + (i % 2) * 4, [60, 66, 74], 0.8);
            if (gearIdx === 0) { line(48, 20, 48, 2, [60, 66, 74]); set(48, 1, [255, 60, 50]); }
            if (gearIdx === 1) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) { set(24 + x, 52 + y, trim.map((v) => v * (x * x + y * y < 3 ? 1.2 : 0.45))); set(72 + x, 52 + y, trim.map((v) => v * (x * x + y * y < 3 ? 1.2 : 0.45))); }
        }
        if (faction === 'terran' && gearIdx === 2) { line(36, 94, 44, 104, [200, 200, 210]); for (let i = 0; i < 3; i++) set(44 + i, 105, [200, 200, 210]); set(45, 106, [226, 184, 72]); }   // dog tag chain

        // ---- Grade: strong vignette, dark, no scanlines (small palette) ----
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const c = get(x, y); if (!c) continue;
            const dx = (x - 48) / 66, dy = (y - 50) / 76, d = dx * dx + dy * dy;
            const v = d < 0.35 ? 1 : d < 0.7 ? 0.84 : d < 1.1 ? 0.68 : 0.52;
            buf[y * W + x] = c.map((q) => Math.round(q * v / 12) * 12);
        }
        // Outline: the upper layer's edge pixels go dark, tinted by their own colour.
        const edge = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const a = ids[y * W + x]; if (a < 1 || a > 7) continue;
            const lower = (nx, ny) => nx >= 0 && ny >= 0 && nx < W && ny < H && ids[ny * W + nx] < a;
            if (lower(x - 1, y) || lower(x + 1, y) || lower(x, y - 1) || lower(x, y + 1)) edge.push(y * W + x);
        }
        edge.forEach((i) => { const c = buf[i]; if (c) buf[i] = [c[0] * 0.16 + 4, c[1] * 0.14 + 4, c[2] * 0.2 + 10]; });
        return { buf, ids, layers };
    }

    // Pixel buffer → run-length SVG paths (1 cell = 1 pixel of the 96x108 canvas).
    function paths(fine) {
        const byColor = {};
        for (let y = 0; y < H; y++) {
            let x = 0;
            while (x < W) {
                const c = fine[y * W + x];
                if (!c) { x++; continue; }
                const hx = toHex(c);
                let e = x + 1;
                while (e < W && fine[y * W + e] && toHex(fine[y * W + e]) === hx) e++;
                (byColor[hx] = byColor[hx] || []).push(`M${x} ${y}h${e - x}v1h${-(e - x)}z`);
                x = e;
            }
        }
        return Object.keys(byColor).map((hx) => `<path fill="${hx}" d="${byColor[hx].join('')}"/>`).join('');
    }
    const fromList = (list) => { const a = new Array(W * H).fill(null); list.forEach(([x, y, c]) => { a[y * W + x] = c; }); return a; };
    // Idle animation: head breathes, eyes blink and glance around, lamps blink, glints sweep the visor.
    const ANIM_CSS = '.hp-head{animation:hp-breath 3.4s steps(1) infinite}.hp-eyes{animation:hp-look 7s steps(1) infinite}' +
        '.hp-eyes path{animation:hp-blink 5.3s steps(1) infinite;transform-box:fill-box;transform-origin:center}' +
        '.hp-lamp{animation:hp-lamp 1.3s steps(1) infinite}.hp-glint{animation:hp-glint 6s steps(1) infinite}' +
        '@keyframes hp-breath{0%{transform:translateY(0)}50%{transform:translateY(1px)}}' +
        '@keyframes hp-look{0%{transform:translateX(0)}30%{transform:translateX(-2px)}42%{transform:translateX(0)}70%{transform:translateX(2px)}78%{transform:translateX(0)}}' +
        '@keyframes hp-blink{0%{transform:scaleY(1)}93%{transform:scaleY(0.12)}96%{transform:scaleY(1)}}' +
        '@keyframes hp-lamp{0%{opacity:1}55%{opacity:0.25}}@keyframes hp-glint{0%{opacity:0}80%{opacity:0.85}90%{opacity:0}}' +
        '@media (prefers-reduced-motion:reduce){.hero-portrait *{animation:none!important}}';
    function svgHtml(look, accent) {
        const lk = typeof look === 'string' ? heroLook(look) : (look || heroLook('terran'));
        const { buf, ids, layers } = build(lk, accent);
        const body = new Array(W * H).fill(null), head = new Array(W * H).fill(null);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, id = ids[i];
            (id >= 3 && !(id === 9 && y >= 80) ? head : body)[i] = buf[i];
        }
        const delay = (k) => `style="animation-delay:-${(Math.random() * k).toFixed(1)}s"`;
        const out = `<style>${ANIM_CSS}</style>${paths(body)}<g class="hp-head" ${delay(3)}>${paths(head)}` +
            `<g class="hp-glint" ${delay(6)}>${paths(fromList(layers.glint))}</g><g class="hp-eyes" ${delay(7)}>${paths(fromList(layers.eye))}</g><g class="hp-lamp" ${delay(1)}>${paths(fromList(layers.lamp))}</g></g>`;
        return `<svg class="hero-portrait" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice" shape-rendering="crispEdges" role="img" aria-label="Pilot portrait">${out}</svg>`;
    }

    // 3D WebGL2 renderer when available (hero-portrait-gl/), otherwise the SVG pixel generator above.
    function html(look, accent, opts) {
        const lk = typeof look === 'string' ? heroLook(look) : (look || heroLook('terran'));
        if (typeof voxelPortrait !== 'undefined') return voxelPortrait.canvasHtml({ faction: lk.faction, v: normalize(lk).v }, accent, opts);
        if (typeof heroPortraitGL !== 'undefined' && heroPortraitGL.supported()) return heroPortraitGL.canvasHtml(lk, accent);
        return svgHtml(lk, accent);
    }
    const data = { SPECIES, PAINTS, HAIRS, EYE_COLS, EYE_SHAPES, GLOWS };

    // The editor shows only the main choices; the rest (face-shape sliders, eyewear, mask, fixture, gear) stay neutral.
    const SIMPLE = ['gender', 'skin', 'hair', 'hairc', 'eye', 'beard', 'scar'], SIMPLE_VOID = ['hair', 'skin', 'hairCol', 'nose', 'beard', 'face'];
    const keysFor = (look) => (typeof VXP !== 'undefined' ? ['v'] : isVoid(look) ? SIMPLE_VOID : SIMPLE);
    const labelFor = (k, look) => (isVoid(look) && VOID[k] ? VOID[k][0] : LABELS[k]);
    const valueName = (k, v, look) => {
        const vn = isVoid(look) && VOID[k] ? VOID[k][1] : null;
        if (vn) return vn[v];
        if (k === 'v') return String(v + 1).padStart(2, '0') + ' / 16';
        return NAMES[k] ? NAMES[k][v] : String(v + 1);
    };
    return { html, svgHtml, data, normalize, randomLook, heroLook, cycle, OPTIONS, LABELS, keysFor, labelFor, valueName };
})();
if (typeof module !== 'undefined') module.exports = heroPortrait;
