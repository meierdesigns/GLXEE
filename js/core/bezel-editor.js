"use strict";

/**
 * DevMode Bezel Editor — resolution, regions, organic, live/flux/export.
 * Default contract: SLICE=32, GRID=192, RIM=56u (editable per pack).
 */
(function () {
    const DEF_SLICE = 32;
    const DEF_GRID = 192;
    const RIM_U = 56;
    const STORE_KEY = 'vf-bezel-pack-edit-v1';
    const OPEN_KEY = 'vf-bezel-editor-open-v1';
    const GEOM_KEY = 'vf-bezel-editor-geom-v1';
    const UI_KEY = 'vf-bezel-editor-ui-v1';
    const SAVED_KEY = 'vf-bezel-saved-v1';
    const FACTIONS = ['terran', 'kronax', 'pirate', 'machine', 'voidborn'];
    const RES_PRESETS = [
        { slice: 16, grid: 96, label: '16 / 96' },
        { slice: 24, grid: 144, label: '24 / 144' },
        { slice: 32, grid: 192, label: '32 / 192 ★' },
        { slice: 48, grid: 288, label: '48 / 288' },
        { slice: 64, grid: 384, label: '64 / 384' }
    ];
    const TOKENS = {
        terran: { hull: '#131a26', lit: '#2a3a52', dark: '#05080e', accent: '#c9a24a' },
        kronax: { hull: '#1c0d0a', lit: '#4a1d14', dark: '#060202', accent: '#e0603a' },
        pirate: { hull: '#14160f', lit: '#3a4030', dark: '#040503', accent: '#cdc7a4' },
        machine: { hull: '#071312', lit: '#143832', dark: '#020706', accent: '#50e0a8' },
        voidborn: { hull: '#3a0f36', lit: '#7a2468', dark: '#14041c', accent: '#d45cc0' }
    };
    const REGIONS = [
        ['full', 'FULL'],
        ['tl', 'TL'], ['tr', 'TR'], ['bl', 'BL'], ['br', 'BR'],
        ['top', 'TOP'], ['bottom', 'BOT'], ['left', 'LEFT'], ['right', 'RIGHT'],
        ['topstrip', 'STRIP']
    ];

    const state = {
        open: false,
        tab: 'tile',
        pack: null,
        tone: 2,
        brush: 2,
        region: 'full',
        painting: false,
        blobUrl: null,
        fluxPart: 'full',
        fluxBusy: false,
        fluxStatus: '',
        draftSlice: DEF_SLICE,
        draftGrid: DEF_GRID,
        geom: null
    };

    const UI_TABS = ['contract', 'frame', 'palette', 'tile', 'organic', 'live', 'flux', 'export'];
    const UI_REGIONS = ['full', 'tl', 'tr', 'bl', 'br', 'top', 'bottom', 'left', 'right', 'topstrip'];
    (function loadUi() {
        try {
            const u = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
            if (!u) return;
            if (UI_TABS.indexOf(u.tab) >= 0) state.tab = u.tab;
            if (UI_REGIONS.indexOf(u.region) >= 0) state.region = u.region;
            if (u.tone >= 0 && u.tone <= 8) state.tone = u.tone | 0;
            if (FACTIONS.indexOf(u.fac) >= 0) state.fac = u.fac;
            state.max = !!u.max;
            if (u.brush >= 1 && u.brush <= 8) state.brush = u.brush | 0;
            if (['full', 'corner', 'edge', 'topstrip'].indexOf(u.fluxPart) >= 0) state.fluxPart = u.fluxPart;
        } catch (e) { /* ignore */ }
    })();
    function saveUi() {
        try {
            localStorage.setItem(UI_KEY, JSON.stringify({
                max: !!state.max, tab: state.tab, fac: (state.pack && state.pack.id) || state.fac, region: state.region, tone: state.tone, brush: state.brush, fluxPart: state.fluxPart
            }));
        } catch (e) { /* ignore */ }
    }

    function S() { return (state.pack && state.pack.slice) || DEF_SLICE; }
    function G() { return (state.pack && state.pack.grid) || DEF_GRID; }

    function clampRes(slice, grid) {
        let s = Math.max(8, Math.min(128, Math.round(Number(slice) || DEF_SLICE)));
        let g = Math.max(s * 2, Math.min(512, Math.round(Number(grid) || DEF_GRID)));
        if (g % 2) g += 1;
        if (s * 2 > g) s = (g / 2) | 0;
        return { slice: s, grid: g };
    }

    function shiftHex(hex, amount) {
        const h = String(hex || '#000').replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        function ch(v) {
            return amount < 0 ? Math.round(v * (1 + amount)) : Math.round(v + (255 - v) * amount);
        }
        return '#' + [ch(r), ch(g), ch(b)].map(function (v) {
            return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
        }).join('');
    }

    function buildPalette(tok) {
        return {
            0: null,
            1: tok.dark,
            2: tok.hull,
            3: tok.lit,
            4: shiftHex(tok.hull, -0.38),
            5: shiftHex(tok.hull, 0.34),
            6: shiftHex(tok.accent, -0.4),
            7: tok.accent,
            8: shiftHex(tok.accent, 0.35)
        };
    }

    function emptyCells(n) {
        n = n || DEF_GRID;
        return new Uint8Array(n * n);
    }

    function inferGrid(arr, fallback) {
        if (!arr || !arr.length) return fallback || DEF_GRID;
        const n = Math.round(Math.sqrt(arr.length));
        if (n * n === arr.length) return n;
        return fallback || DEF_GRID;
    }

    function scaleCells(src, oldN, newN) {
        const out = emptyCells(newN);
        if (!src || !oldN || !newN) return out;
        if (oldN === newN) {
            out.set(src.length === newN * newN ? src : src.subarray(0, newN * newN));
            return out;
        }
        for (let y = 0; y < newN; y++) {
            const sy = Math.min(oldN - 1, ((y * oldN) / newN) | 0);
            for (let x = 0; x < newN; x++) {
                const sx = Math.min(oldN - 1, ((x * oldN) / newN) | 0);
                out[y * newN + x] = src[sy * oldN + sx] & 15;
            }
        }
        return out;
    }

    function inBand(x, y) {
        const s = S(), g = G();
        return x < s || y < s || x >= g - s || y >= g - s;
    }

    function regionRect(id) {
        const s = S(), g = G();
        switch (id) {
            case 'tl': return { x0: 0, y0: 0, x1: s - 1, y1: s - 1 };
            case 'tr': return { x0: g - s, y0: 0, x1: g - 1, y1: s - 1 };
            case 'bl': return { x0: 0, y0: g - s, x1: s - 1, y1: g - 1 };
            case 'br': return { x0: g - s, y0: g - s, x1: g - 1, y1: g - 1 };
            case 'top': return { x0: s, y0: 0, x1: g - s - 1, y1: s - 1 };
            case 'bottom': return { x0: s, y0: g - s, x1: g - s - 1, y1: g - 1 };
            case 'left': return { x0: 0, y0: s, x1: s - 1, y1: g - s - 1 };
            case 'right': return { x0: g - s, y0: s, x1: g - 1, y1: g - s - 1 };
            case 'topstrip': return { x0: 0, y0: 0, x1: g - 1, y1: s - 1 };
            case 'full':
            default: return { x0: 0, y0: 0, x1: g - 1, y1: g - 1 };
        }
    }

    function inRegion(x, y, id) {
        const r = regionRect(id || 'full');
        if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) return false;
        if ((id || 'full') === 'full' || id === 'topstrip') return id === 'topstrip' ? true : inBand(x, y);
        return true;
    }

    function forRegion(id, fn) {
        const r = regionRect(id || 'full');
        for (let y = r.y0; y <= r.y1; y++) {
            for (let x = r.x0; x <= r.x1; x++) {
                if (!inRegion(x, y, id)) continue;
                fn(x, y);
            }
        }
    }

    function bandFill(cells, tone, region) {
        const t = tone || 2;
        const g = G();
        forRegion(region || 'full', function (x, y) {
            cells[y * g + x] = t;
        });
    }

    function clearRegion(cells, region) {
        const g = G();
        forRegion(region || 'full', function (x, y) {
            cells[y * g + x] = 0;
        });
    }

    function vh(a, b, k) {
        return (((a * 73856093) ^ (b * 19349663) ^ ((k | 0) * 83492791)) & 0x7fffffff) % 100;
    }

    function putDisk(cells, cx, cy, r, tone, region) {
        const g = G();
        const r2 = r * r;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r2) continue;
                const x = cx + dx, y = cy + dy;
                if (x < 0 || y < 0 || x >= g || y >= g) continue;
                if (region && !inRegion(x, y, region)) continue;
                if (!inBand(x, y) && region !== 'topstrip') continue;
                cells[y * g + x] = tone;
            }
        }
    }

    function generateVines(cells, opts, region) {
        const num = function (v, d) { const n = Number(v); return (v == null || v === '' || !isFinite(n)) ? d : n; };
        const amount = Math.max(0, Math.min(100, num(opts.amount, 70)));
        const wave = Math.max(0, Math.min(20, num(opts.wave, 8)));
        const buds = Math.max(0, Math.min(40, num(opts.buds, 16)));
        const thorns = Math.max(0, Math.min(20, num(opts.thorns, 8)));
        const lush = Math.max(0, Math.min(100, num(opts.lush, 40)));
        const seed = (Number(opts.seed) || 1) | 0;
        const reg = region || 'full';
        const s = S(), g = G();
        const R = function (i, k) { return vh(i, seed, k) / 100; };

        forRegion(reg, function (x, y) { cells[y * g + x] = 0; });

        const K = Math.max(0.5, S() / DEF_SLICE);
        const th = Math.max(1, Math.round((lush >= 80 ? 4 : (lush >= 55 ? 3 : (lush >= 25 ? 2 : 1))) * K));
        const cy = s / 2;
        const amp = Math.max(1, Math.min(s / 2 - th - 3, K * (1.5 + wave * 0.35 * (0.4 + amount / 100))));
        const period = Math.max(24, s * 1.8) + (seed % 9);
        const TAU = Math.PI * 2;
        const sw = curAnim.mv.sway ? mvP('sway') * TAU : 0;
        let tIdx = 0;
        const bk = curAnim.mv.breathe ? 0.7 * mvA('breathe') * Math.sin(mvP('breathe') * TAU) : 0;
        const ampK = 1 + (curAnim.mv.sway ? 0.5 * mvA('sway') * Math.sin(mvP('sway') * TAU) : 0);
        const strokes = [], leaves = [], bulbs = [], thornPts = [];

        function edgeAt(e, u, phase) {
            const off = ampK * (amp * Math.sin(u / period * TAU + phase + seed * 0.7 + sw)) +
                ampK * amp * 0.25 * Math.sin(u / (period * 0.4) * TAU + seed + sw * 2);
            const c = cy + off;
            if (e === 0) return { x: u, y: c, tx: 1, ty: 0, nx: 0, ny: 1 };
            if (e === 1) return { x: u, y: g - 1 - c, tx: 1, ty: 0, nx: 0, ny: -1 };
            if (e === 2) return { x: c, y: u, tx: 0, ty: 1, nx: 1, ny: 0 };
            return { x: g - 1 - c, y: u, tx: 0, ty: 1, nx: -1, ny: 0 };
        }

        // twisted main stems along every edge
        const phases = amount > 25 ? [0, Math.PI] : [0];
        if (lush > 65) phases.push(Math.PI / 2);
        for (let e = 0; e < 4; e++) {
            phases.forEach(function (ph) {
                const pts = [];
                for (let u = 0; u < g; u++) {
                    const p = edgeAt(e, u, ph);
                    const sw = Math.sin(u * 0.07 + ph * 1.7 + e + seed);
                    const r = Math.max(1, Math.round((th * (0.75 + 0.25 * Math.sin(u * 0.11 + ph + e)) + (lush / 100) * 2.2 * Math.max(0, sw * sw * sw)) * (1 + bk)));
                    pts.push([p.x, p.y, r, 1.8 * Math.cos(u / period * TAU + ph + seed * 0.7)]);
                }
                strokes.push(pts);
            });
        }

        // tendril: curved taper that rolls up at its end
        function tendril(x, y, ang, len, r0, cs) {
            const pts = [];
            const cf = 1 + (curAnim.mv.curl ? 1.2 * Math.sin(mvP('curl') * TAU + (tIdx++) * 1.3) : 0);
            const n = Math.max(6, Math.round(len));
            for (let i = 0; i < n; i++) {
                const t = i / (n - 1);
                pts.push([x, y, Math.max(1, Math.round(r0 * (1 - t) + 1 * t)), 1.2]);
                x += Math.cos(ang);
                y += Math.sin(ang);
                ang += cs * (0.015 + 0.16 * t * t) * cf;
            }
            strokes.push(pts);
            return pts;
        }

        const nb = Math.round(buds * (0.5 + amount / 100));
        for (let i = 0; i < nb; i++) {
            const e = i % 4;
            const u = s + R(i, 1) * Math.max(1, g - 2 * s);
            const p = edgeAt(e, u, (i & 4) ? Math.PI : 0);
            const side = (i & 1) ? 1 : -1;
            const dT = R(i, 2) < 0.5 ? -0.6 : 0.6;
            const ang = Math.atan2(p.ny * side * 0.8 + p.ty * dT, p.nx * side * 0.8 + p.tx * dT);
            const len = s * (0.5 + 0.6 * R(i, 3)) * (0.6 + amount / 100 * 0.6) * (curAnim.mv.grow ? Math.max(0.15, 1 + 0.9 * mvA('grow') * Math.sin(mvP('grow') * TAU + i)) : 1);
            const cs = side * ((i % 3) ? 1 : -1);
            const pts = tendril(p.x, p.y, ang, len, Math.max(1, th - 1), cs);
            const mid = pts[pts.length >> 1], end = pts[pts.length - 1];
            if (i % 2 === 0 || lush > 70) bulbs.push({ x: end[0], y: end[1], r: Math.round((2 + (i % 3) + Math.round(lush / 40)) * K) });
            const la = ang + cs * 1.0;
            const lk = 1 + lush / 60;
            leaves.push({ x: mid[0], y: mid[1], dx: Math.cos(la), dy: Math.sin(la), len: (4 + R(i, 4) * 5) * lk * K });
            if (lush > 60) {
                const q2 = pts[Math.max(0, (pts.length * 3) >> 2)];
                leaves.push({ x: q2[0], y: q2[1], dx: Math.cos(la - cs * 1.4), dy: Math.sin(la - cs * 1.4), len: (3 + R(i, 7) * 4) * lk * K });
            }
            if (amount > 50 || lush > 50) {
                const lb = ang - cs * 1.0;
                const q = pts[Math.max(0, (pts.length >> 2))];
                leaves.push({ x: q[0], y: q[1], dx: Math.cos(lb), dy: Math.sin(lb), len: (3 + R(i, 5) * 4) * K });
            }
        }

        // corner spirals
        if (amount > 20) {
            [[cy, cy, 1], [g - 1 - cy, cy, -1], [cy, g - 1 - cy, -1], [g - 1 - cy, g - 1 - cy, 1]].forEach(function (c, k) {
                const pts = [];
                const rad = s * 0.42;
                const a0 = k * Math.PI / 2 + seed * 0.3;
                for (let i = 0; i <= 40; i++) {
                    const t = i / 40;
                    const a = a0 + c[2] * t * 5.2;
                    const rr = rad * (1 - t * 0.9);
                    pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, Math.max(1, Math.round(th * (1 - t) + t)), 1.2]);
                }
                strokes.push(pts);
                const e = pts[pts.length - 1];
                bulbs.push({ x: e[0], y: e[1], r: 2 });
            });
        }

        for (let i = 0; i < thorns; i++) {
            const e = i % 4;
            const u = s + R(i, 6) * Math.max(1, g - 2 * s);
            const p = edgeAt(e, u, (i & 1) ? Math.PI : 0);
            const side = (i & 2) ? 1 : -1;
            thornPts.push({ x: p.x, y: p.y, nx: p.nx * side, ny: p.ny * side, r: th });
        }

        const sc = makeSculptor(cells, reg, { bulge: 0, relief: num(opts.relief, 60) });
        const splat = function (x, y, r, e, k) { sc.splat(x, y, r, e, k, 0); };
        const outline = sc.outline, g2 = sc.g2;
        const ribs = [], cores = [];
        function leafWalk(l, fn) {
            const n = Math.max(2, Math.round(l.len));
            for (let k = 0; k <= n; k++) {
                const w = Math.sin(Math.PI * k / n) * (l.len * 0.3) + 0.3;
                fn(l.x + l.dx * k, l.y + l.dy * k, w, k, n);
            }
        }
        strokes.forEach(function (st) {
            st.forEach(function (p, i) {
                outline(p[0], p[1], p[2]);
                splat(p[0], p[1], p[2], p[3] || 0, 1);
                if (p[2] >= 2 && i % 5 === 0) cores.push(p);
            });
        });
        leaves.forEach(function (l) {
            leafWalk(l, function (x, y, w, k, n) {
                outline(x, y, w);
                splat(x, y, w, 1.0, 0.6);
                if (k > 0 && k < n) ribs.push([x, y]);
            });
        });
        bulbs.forEach(function (b) { outline(b.x, b.y, b.r); splat(b.x, b.y, b.r, 1.4, 1.1); });

        sc.shade(0);
        cores.forEach(function (p) { g2(p[0] + 1, p[1] + 1, 7); });
        ribs.forEach(function (p, i) { if (i % 2 === 0) g2(p[0], p[1], 7); });
        bulbs.forEach(function (b, bi) {
            const on = curAnim.mv.glow ? Math.sin(mvP('glow') * TAU + bi * 1.7) > 0 : true;
            g2(b.x - 1, b.y - 1, on ? 8 : 3);
            g2(b.x, b.y, 3);
            if (curAnim.mv.glow && on) { g2(b.x + 1, b.y, 3, 5); g2(b.x, b.y + 1, 3, 5); }
        });
        thornPts.forEach(function (t) {
            for (let j = 0; j < 4; j++) {
                const x = t.x + t.nx * (t.r + j), y = t.y + t.ny * (t.r + j);
                if (j < 3) { g2(x + t.ny, y + t.nx, 1); g2(x - t.ny, y - t.nx, 1); }
                g2(x, y, j === 3 ? 8 : (j === 0 ? 2 : 5));
            }
        });
    }

    // Animation context read by the generators: phase 0..1 of the cycle + which parts move.
    const TAU2 = Math.PI * 2;
    let curAnim = { ph: 0, mv: {}, amt: 0.7 };
    // Move values: false/0 = off, true/1 = normal, else a named variant (see MOVE_MODES).
    const MOVE_MODES = [['0', 'OFF', 0, 0], ['1', 'NORMAL', 1, 1], ['2', 'SOFT', 1, 0.5], ['3', 'STRONG', 1, 1.7], ['4', 'FAST x2', 2, 1], ['5', 'REVERSE', -1, 1], ['6', 'WILD', 3, 1.7]];
    function mvMode(k) { const v = curAnim.mv[k]; const n = v === true ? 1 : (Number(v) || 0); return MOVE_MODES[n] || MOVE_MODES[n > 0 ? 1 : 0]; }
    function mvOn(k) { return mvMode(k)[2] !== 0; }
    function mvP(k) { return curAnim.ph * mvMode(k)[2]; }
    function mvA(k) { return curAnim.amt * mvMode(k)[3]; }

    // ---------- shared sculpting toolkit (height map + lambert, light from top-left) ----------
    const FX_BULGE = ['bulge', 'BULGE', 0, 100, 35];
    const FX_RELIEF = ['relief', 'RELIEF', 0, 100, 60];
    function makeSculptor(cells, reg, fx) {
        const g = G();
        const bulgeK = Math.max(0, Math.min(100, Number(fx && fx.bulge) || 0)) / 100;
        const reliefK = Math.max(0, Math.min(100, fx && fx.relief != null ? Number(fx.relief) : 60)) / 100;
        const hm = new Float32Array(g * g).fill(-1e9);
        const ol = new Uint8Array(g * g);
        const bm = new Float32Array(g * g);
        function okCell(x, y) {
            if (x < 0 || y < 0 || x >= g || y >= g) return false;
            if (!inRegion(x, y, reg)) return false;
            if (!inBand(x, y) && reg !== 'topstrip') return false;
            return true;
        }
        function put(xx, yy, h, bias) {
            if (!okCell(xx, yy)) return;
            const i = yy * g + xx;
            if (h > hm[i]) { hm[i] = h; bm[i] = bias || 0; }
        }
        function splat(x, y, r, elev, k, bias) {
            r = r * (1 + bulgeK * 0.35);
            k = k * (1 + bulgeK * 0.8);
            elev = elev * (1 + bulgeK * 0.6);
            const R = r + 0.5, R2 = R * R;
            for (let yy = Math.floor(y - R); yy <= Math.ceil(y + R); yy++) {
                for (let xx = Math.floor(x - R); xx <= Math.ceil(x + R); xx++) {
                    const d2 = (xx - x) * (xx - x) + (yy - y) * (yy - y);
                    if (d2 > R2) continue;
                    put(xx, yy, elev + k * Math.sqrt(R2 - d2), bias);
                }
            }
        }
        function outline(x, y, r) {
            const R = r + 1.6, R2 = R * R;
            for (let yy = Math.floor(y - R); yy <= Math.ceil(y + R); yy++) {
                for (let xx = Math.floor(x - R); xx <= Math.ceil(x + R); xx++) {
                    const d2 = (xx - x) * (xx - x) + (yy - y) * (yy - y);
                    if (d2 <= R2 && okCell(xx, yy)) ol[yy * g + xx] = 1;
                }
            }
        }
        function box(x0, y0, x1, y1, elev, bev, bias) {
            x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
            for (let yy = y0 - 1; yy <= y1 + 1; yy++) {
                for (let xx = x0 - 1; xx <= x1 + 1; xx++) {
                    if (xx < x0 || xx > x1 || yy < y0 || yy > y1) {
                        if (okCell(xx, yy)) ol[yy * g + xx] = 1;
                        continue;
                    }
                    const md = Math.min(xx - x0, x1 - xx, yy - y0, y1 - yy);
                    const bv = bev * (1 + bulgeK * 1.4);
                    let h = elev * (1 + bulgeK * 0.6) + Math.min(bv, md + 0.5);
                    if (bulgeK > 0) {
                        const fu = Math.sin(Math.PI * (xx - x0 + 0.5) / (x1 - x0 + 1));
                        const fv = Math.sin(Math.PI * (yy - y0 + 0.5) / (y1 - y0 + 1));
                        h += bulgeK * 3.2 * fu * fv;
                    }
                    put(xx, yy, h, bias);
                }
            }
        }
        const LX = -0.45, LY = -0.55, LZ = 0.7;
        const LN = Math.sqrt(LX * LX + LY * LY + LZ * LZ);
        function hAt(x, y) {
            if (x < 0 || y < 0 || x >= g || y >= g) return 0;
            const v = hm[y * g + x];
            return v < -1e8 ? 0 : v;
        }
        function covered(x, y) { return x >= 0 && y >= 0 && x < g && y < g && hm[y * g + x] > -1e8; }
        function shade(gbias) {
            forRegion(reg, function (x, y) {
                const i = y * g + x;
                if (hm[i] < -1e8) { cells[i] = ol[i] ? 1 : 0; return; }
                const h = hm[i];
                if (reliefK > 0.15 && (covered(x - 1, y) && hm[i - 1] > h + 1.4) || (covered(x, y - 1) && hm[i - g] > h + 1.4) ||
                    (covered(x + 1, y) && hm[i + 1] > h + 2.2) || (covered(x, y + 1) && hm[i + g] > h + 2.2)) {
                    cells[i] = 1; return;
                }
                const nf = 0.08 + reliefK * 0.85;
                const nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * nf;
                const ny = -(hAt(x, y + 1) - hAt(x, y - 1)) * nf;
                const nl = Math.sqrt(nx * nx + ny * ny + 1);
                const lam = (nx * LX + ny * LY + LZ) / (nl * LN) + (gbias || 0) + bm[i];
                let t;
                if (lam < 0.3) t = 4;
                else if (lam < 0.62) t = 2;
                else if (lam < 0.86) t = 5;
                else t = 3;
                if (lam > 0.97) t = 8;
                cells[i] = t;
            });
        }
        function g2(x, y, t, only) {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || y < 0 || x >= g || y >= g || !inRegion(x, y, reg)) return;
            if (only && cells[y * g + x] !== only) return;
            cells[y * g + x] = t;
        }
        return { splat: splat, outline: outline, box: box, shade: shade, g2: g2, covered: covered, put: put };
    }

    function bandGeom() {
        const g = G();
        function pt(e, u, d) {
            if (e === 0) return { x: u, y: d };
            if (e === 1) return { x: u, y: g - 1 - d };
            if (e === 2) return { x: d, y: u };
            return { x: g - 1 - d, y: u };
        }
        function rect(e, u0, u1, d0, d1) {
            const a = pt(e, u0, d0), b = pt(e, u1, d1);
            return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
        }
        return { pt: pt, rect: rect };
    }

    function styleSetup(cells, opts, region, defs) {
        const reg = region || 'full';
        const seed = (Number(opts.seed) || 1) | 0;
        forRegion(reg, function (x, y) { cells[y * G() + x] = 0; });
        const P = function (k) {
            const d = defs.concat([FX_BULGE, FX_RELIEF]).filter(function (q) { return q[0] === k; })[0];
            const n = Number(opts[k]);
            const v = (opts[k] == null || opts[k] === '' || !isFinite(n)) ? d[4] : n;
            return Math.max(d[2], Math.min(d[3], v));
        };
        return {
            reg: reg, seed: seed, s: S(), g: G(), K: Math.max(0.5, S() / DEF_SLICE), P: P, sc: makeSculptor(cells, reg, { bulge: P('bulge'), relief: P('relief') }), B: bandGeom(),
            R: function (i, k) { return vh(i, seed, k) / 100; }
        };
    }

    // Corner caps + an elbow that runs from every cap into both adjacent edges (centred on the band), so
    // the corners are procedurally welded to the sides instead of sitting next to them. Scales with the band.
    function corners(c, elev, bev, bias, elbow) {
        const s = c.s, g = c.g;
        [[0, 0], [g - s, 0], [0, g - s], [g - s, g - s]].forEach(function (q) {
            c.sc.box(q[0] + 1, q[1] + 1, q[0] + s - 2, q[1] + s - 2, elev, bev, bias);
        });
        if (!elbow) return;                                     // plated factions: the plates themselves run into the caps
        const t = Math.max(2, Math.round(s * 0.26));          // elbow thickness
        const reach = Math.round(s * 0.5);                      // how far it runs into the edge
        [[0, 0], [g - s, 0], [0, g - s], [g - s, g - s]].forEach(function (q) {
            const cx = q[0] + s / 2, cy = q[1] + s / 2;
            const left = q[0] === 0, top = q[1] === 0;
            const hx0 = left ? cx : q[0] - reach, hx1 = left ? q[0] + s + reach : cx;     // along the top/bottom edge
            const vy0 = top ? cy : q[1] - reach, vy1 = top ? q[1] + s + reach : cy;       // along the left/right edge
            c.sc.box(hx0, cy - t / 2, hx1, cy + t / 2, elev + 0.8, Math.max(1, t / 2 - 0.5), bias);
            c.sc.box(cx - t / 2, vy0, cx + t / 2, vy1, elev + 0.8, Math.max(1, t / 2 - 0.5), bias);
        });
    }

    // TERRAN — riveted armor plating
    const DEFS_TERRAN = [
        ['plates', 'PLATES / EDGE', 2, 24, 8], ['bevel', 'BEVEL', 1, 6, 3], ['rivets', 'RIVETS', 0, 4, 2],
        ['gap', 'SEAM GAP', 0, 6, 2], ['wear', 'WEAR', 0, 100, 30], ['stripes', 'HAZARD STRIPES', 0, 100, 30]
    ];
    function genTerran(cells, o, region) {
        const c = styleSetup(cells, o, region, DEFS_TERRAN), sc = c.sc, B = c.B, s = c.s, g = c.g, R = c.R, P = c.P;
        const K = c.K;
        const n = P('plates'), bev = P('bevel') * K, gap = P('gap') * K;
        const plates = [], rivetPts = [];
        corners(c, 1.5, bev + 1, 0);
        for (let e = 0; e < 4; e++) {
            const len = (g - 2 * s) / n;
            for (let k = 0; k < n; k++) {
                const id = e * 40 + k;
                const sl = mvOn('slide') ? Math.round(Math.sin(mvP('slide') * TAU2 + k * 0.6 + e) * mvA('slide') * (len * 0.3 + gap * 1.5)) : 0;
                const u0 = s + k * len + gap / 2 + sl, u1 = s + (k + 1) * len - gap / 2 - 1 + sl;
                const br = mvOn('breathe') ? Math.round(Math.sin(mvP('breathe') * TAU2 + k * 0.8 + e * 0.5) * mvA('breathe') * 5) : 0;
                const d0 = Math.round(2 * K) + (R(id, 1) > 0.7 ? 1 : 0);
                const d1 = Math.max(d0 + 4, Math.min(s - 2, s - Math.round(3 * K) - (R(id, 2) > 0.7 ? 1 : 0) + br));
                const r = B.rect(e, u0, u1, d0, d1);
                const md = Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2;
                const elev = Math.max(0, (R(id, 3) > 0.55 ? 1.5 : 0) + (mvOn('breathe') ? Math.sin(mvP('breathe') * TAU2 + k * 0.8 + e) * mvA('breathe') * 1.6 : 0));
                sc.box(r.x0, r.y0, r.x1, r.y1, elev, Math.max(1, Math.min(bev, md - 0.5)), R(id, 4) * 0.1);
                const ri = Math.round(3 * K);
                const pos = [[ri, ri], [ri, -ri], [-ri, ri], [-ri, -ri]];
                for (let q = 0; q < P('rivets'); q++) {
                    const pu = pos[q][0] > 0 ? u0 + pos[q][0] : u1 + pos[q][0];
                    const pd = pos[q][1] > 0 ? d0 + pos[q][1] : d1 + pos[q][1];
                    const p = B.pt(e, pu, pd);
                    sc.splat(p.x, p.y, Math.max(1, K * 0.9), elev + bev, 1, 0.1);
                    rivetPts.push({ x: p.x, y: p.y });
                }
                plates.push({ e: e, u0: u0, u1: u1, dm: (d0 + d1) / 2, id: id });
            }
        }
        sc.shade(-0.06);
        if (mvOn('blink')) {
            rivetPts.forEach(function (r, i) { if ((i + Math.round(mvP('blink') * 2)) % 2 === 0) sc.g2(r.x, r.y, 8); });
        }
        if (mvOn('scan')) {
            const uu = s + (((mvP('scan') % 1) + 1) % 1) * (g - 2 * s);
            for (let e = 0; e < 4; e++) {
                for (let u = Math.floor(uu) - 2; u <= Math.floor(uu) + 2; u++) {
                    for (let d = 2; d < s - 2; d++) {
                        const q = B.pt(e, u, d), x = Math.round(q.x), y = Math.round(q.y);
                        if (x < 0 || y < 0 || x >= g || y >= g) continue;
                        const t = cells[y * g + x];
                        if (t === 2 || t === 4 || t === 5) sc.g2(x, y, 3);
                    }
                }
            }
        }
        plates.forEach(function (p) {
            if (R(p.id, 5) * 100 < P('stripes')) {
                for (let u = Math.ceil(p.u0) + 3; u < p.u1 - 3; u++) {
                    const dash = Math.max(2, Math.round(2 * K));
                    if (Math.floor((u + (mvOn('scroll') ? Math.round(mvP('scroll') * 2 * dash) : 0)) / dash) % 2 === 0) {
                        for (let t = -Math.floor(K / 2); t <= Math.floor(K / 2); t++) { const q = B.pt(p.e, u, Math.round(p.dm) + t); sc.g2(q.x, q.y, 7); }
                    }
                }
            }
            if (R(p.id, 6) * 100 < P('wear')) {
                const q = B.pt(p.e, p.u0 + 2 + R(p.id, 7) * (p.u1 - p.u0 - 4), p.dm - 2 + R(p.id, 8) * 4);
                const dx = R(p.id, 9) > 0.5 ? 1 : -1;
                for (let j = 0; j < (4 + R(p.id, 10) * 6) * K; j++) sc.g2(q.x + j * dx, q.y + j, 4);
            }
        });
        for (let e = 0; e < 4; e++) { /* lit seam highlights handled by shading */ }
    }

    // KRONAX — forged rim, blades and glowing lava cracks
    const DEFS_KRONAX = [
        ['blades', 'BLADES', 0, 30, 12], ['length', 'BLADE LENGTH', 4, 60, 22], ['cracks', 'LAVA CRACKS', 0, 30, 10],
        ['heat', 'HEAT', 0, 100, 50], ['rim', 'RIM THICKNESS', 1, 6, 3]
    ];
    function genKronax(cells, o, region) {
        const c = styleSetup(cells, o, region, DEFS_KRONAX), sc = c.sc, B = c.B, s = c.s, g = c.g, R = c.R, P = c.P;
        const K = c.K;
        const rim = Math.max(1, P('rim') * K + (mvOn('rimpulse') ? Math.round(Math.sin(mvP('rimpulse') * TAU2) * mvA('rimpulse') * 1.6 * K) : 0));
        corners(c, 1, 3 * K, -0.1, true);
        for (let e = 0; e < 4; e++) {
            if (mvOn('rimpulse')) {
                // molten rim: thickness ripples along the edge and travels with the phase
                for (let u = s; u < g - s; u += 4) {
                    const rk = Math.max(1, Math.round(P('rim') * K + Math.sin(u * 0.09 + mvP('rimpulse') * Math.PI * 2 + e) * mvA('rimpulse') * 2.2 * K));
                    const rr = B.rect(e, u, Math.min(g - s - 1, u + 7), Math.max(2, s / 2 - rk - 1), Math.min(s - 3, s / 2 + rk));
                    sc.box(rr.x0, rr.y0, rr.x1, rr.y1, 0.5, Math.min(2 * K, rk), -0.12);
                }
                continue;
            }
            const r = B.rect(e, s, g - s - 1, Math.max(2, s / 2 - rim - 1), Math.min(s - 3, s / 2 + rim));
            sc.box(r.x0, r.y0, r.x1, r.y1, 0.5, Math.min(2 * K, rim), -0.12);
        }
        for (let i = 0; i < P('blades'); i++) {
            const e = i % 4;
            const u = s + R(i, 1) * (g - 2 * s);
            const p = B.pt(e, u, s / 2);
            const tx = (e < 2) ? 1 : 0, ty = (e < 2) ? 0 : 1;
            const sg = R(i, 2) < 0.5 ? -1 : 1;
            const nx = (e === 0) ? 0 : (e === 1 ? 0 : (e === 2 ? 1 : -1));
            const ny = (e === 0) ? 1 : (e === 1 ? -1 : 0);
            let dx = tx * sg * 0.9 + nx * (R(i, 3) - 0.5) * 0.8, dy = ty * sg * 0.9 + ny * (R(i, 3) - 0.5) * 0.8;
            if (mvOn('blades')) {
                const sw = Math.sin((R(i, 13) + mvP('blades')) * Math.PI * 2) * (0.2 + 0.8 * mvA('blades'));
                const cs2 = Math.cos(sw), sn2 = Math.sin(sw);
                const ndx = dx * cs2 - dy * sn2, ndy = dx * sn2 + dy * cs2;
                dx = ndx; dy = ndy;
            }
            const L = P('length') * K * (0.6 + R(i, 4) * 0.7) * (mvOn('grow') ? Math.max(0.2, 1 + 0.9 * mvA('grow') * Math.sin((R(i, 14) + mvP('grow')) * TAU2)) : 1), rb = (2 + (R(i, 5) > 0.6 ? 1 : 0)) * K;
            for (let t = 0; t <= 1; t += 1 / Math.max(4, L)) {
                const r = rb * (1 - t) + 0.3;
                sc.outline(p.x + dx * t * L, p.y + dy * t * L, r);
            }
            for (let t = 0; t <= 1; t += 1 / Math.max(4, L)) {
                const r = rb * (1 - t) + 0.3;
                sc.splat(p.x + dx * t * L, p.y + dy * t * L, r, 1 + r * 0.6, 1, 0.08);
            }
        }
        const cracks = [];
        for (let i = 0; i < P('cracks'); i++) {
            const e = i % 4;
            let p = B.pt(e, s + R(i, 6) * (g - 2 * s), s / 2);
            let a = R(i, 7) * Math.PI * 2;
            const path = [];
            for (let j = 0; j < 10 + R(i, 8) * 18; j++) {
                path.push([p.x, p.y]);
                a += (R(i * 31 + j, 9) - 0.5) * 1.3;
                p = { x: p.x + Math.cos(a) * K, y: p.y + Math.sin(a) * K };
            }
            cracks.push(path);
        }
        sc.shade(-0.05);
        cracks.forEach(function (path, i) {
            const hot = mvOn('lava')
                ? (Math.sin((R(i, 12) + mvP('lava')) * Math.PI * 2) + 1) / 2 > 1 - P('heat') / 100
                : R(i, 11) * 100 < P('heat');
            path.forEach(function (q) {
                if (!sc.covered(Math.round(q[0]), Math.round(q[1]))) return;
                sc.g2(q[0], q[1], hot ? 8 : 7);
                if (K >= 1.5) { sc.g2(q[0] + 1, q[1], hot ? 8 : 7); sc.g2(q[0], q[1] + 1, hot ? 8 : 7); }
                if (hot) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { sc.g2(q[0] + d[0], q[1] + d[1], 7, 2); sc.g2(q[0] + d[0], q[1] + d[1], 6, 4); }); }
            });
        });
    }

    // PIRATE — scavenged scrap patchwork with chain and rust
    const DEFS_PIRATE = [
        ['patches', 'PATCHES / EDGE', 3, 20, 9], ['chain', 'CHAIN LENGTH', 0, 100, 40],
        ['rust', 'RUST', 0, 100, 45], ['rivets', 'BOLTS', 0, 4, 2]
    ];
    function genPirate(cells, o, region) {
        const c = styleSetup(cells, o, region, DEFS_PIRATE), sc = c.sc, B = c.B, s = c.s, g = c.g, R = c.R, P = c.P;
        const K = c.K;
        corners(c, 1, 2 * K, 0.05);
        const n = P('patches');
        for (let e = 0; e < 4; e++) {
            let u = s - 2, k = 0;
            while (u < g - s) {
                const id = e * 50 + k++;
                const w = Math.max(5, ((g - 2 * s) / n) * (0.6 + R(id, 1) * 0.9));
                const d0 = Math.round((2 + Math.floor(R(id, 2) * 4)) * K), d1 = s - Math.round((3 + Math.floor(R(id, 3) * 4)) * K);
                const elev = Math.max(0, Math.floor(R(id, 4) * 4) * 0.8 + (mvOn('shift') ? Math.sin(mvP('shift') * TAU2 + id) * mvA('shift') * 1.6 : 0));
                const us = mvOn('shift') ? Math.sin(mvP('shift') * TAU2 + id * 0.9) * mvA('shift') * 6 : 0;
                const db = mvOn('shift') ? Math.round(Math.sin(mvP('shift') * TAU2 + id * 1.3) * mvA('shift') * 4) : 0;
                const r = B.rect(e, u + us, Math.min(g - s + 1, u + w) + us, d0, Math.max(d0 + 4, d1 + db));
                sc.box(r.x0, r.y0, r.x1, r.y1, elev, (1 + Math.floor(R(id, 5) * 2)) * K, (R(id, 6) - 0.5) * 0.5);
                for (let q = 0; q < P('rivets'); q++) {
                    const ri = Math.round(3 * K);
                    const p = B.pt(e, q % 2 ? u + w - ri : u + ri, q < 2 ? d0 + ri : d1 - ri);
                    sc.splat(p.x, p.y, Math.max(1, K * 0.9), elev + 1.5, 1, 0.12);
                }
                u += w - 1;
            }
            const links = Math.round((g - 2 * s) * P('chain') / 100 / (5 * K));
            for (let l = 0; l < links; l++) {
                const p = B.pt(e, s + l * 5 * K + 2, s / 2 + (mvOn('chain') ? Math.sin((l / 3 + mvP('chain')) * Math.PI * 2) * (0.6 + mvA('chain') * 1.6) : 0));
                const horiz = (e < 2) === (l % 2 === 0);
                for (let a = 0; a < 8; a++) {
                    const an = a / 8 * Math.PI * 2;
                    const rx = (horiz ? 2.4 : 1.2) * K, ry = (horiz ? 1.2 : 2.4) * K;
                    sc.outline(p.x + Math.cos(an) * rx, p.y + Math.sin(an) * ry, 0.8 * K);
                }
                for (let a = 0; a < 8; a++) {
                    const an = a / 8 * Math.PI * 2;
                    const rx = (horiz ? 2.4 : 1.2) * K, ry = (horiz ? 1.2 : 2.4) * K;
                    sc.splat(p.x + Math.cos(an) * rx, p.y + Math.sin(an) * ry, 0.8 * K, 4, 1, 0.2);
                }
            }
        }
        sc.shade(0);
        const rust = P('rust');
        forRegion(c.reg, function (x, y) {
            const i = y * g + x;
            if (!cells[i] || cells[i] === 1) return;
            const h = vh(x, y, c.seed + 17);
            if (h < rust / 5) cells[i] = 6;
            else if (h < rust / 2.5) cells[i] = 4;
        });
        if (mvOn('sparks')) {
            const key = Math.round(curAnim.ph * 100);
            for (let i = 0; i < 10; i++) {
                const q = B.pt(i % 4, s + Math.floor(vh(i, key, 41) / 100 * (g - 2 * s)), Math.floor(vh(i, key, 42) / 100 * s));
                const x = Math.round(q.x), y = Math.round(q.y);
                if (x >= 0 && y >= 0 && x < g && y < g && cells[y * g + x] > 1) sc.g2(x, y, 8);
            }
        }
    }

    // MACHINE — conduits, circuit traces, nodes and data pulses
    const DEFS_MACHINE = [
        ['traces', 'CONDUITS', 1, 3, 2], ['thick', 'CABLE THICKNESS', 1, 8, 2], ['jogs', 'BENDS', 0, 16, 6], ['nodes', 'NODES / CHIPS', 0, 24, 8],
        ['pulse', 'DATA PULSE', 0, 100, 40]
    ];
    function genMachine(cells, o, region) {
        const c = styleSetup(cells, o, region, DEFS_MACHINE), sc = c.sc, B = c.B, s = c.s, g = c.g, R = c.R, P = c.P;
        const lanes = P('traces');
        const K = c.K;
        const rad = P('thick') * 0.8 * K;
        const am = Math.min(1.3, curAnim.amt);
        const rmax = rad * (mvOn('throb') ? 1.35 : 1);
        corners(c, 1, 2 * K, -0.08, true);
        const paths = [];
        for (let e = 0; e < 4; e++) {
            for (let l = 0; l < lanes; l++) {
                const base = s * (l + 1) / (lanes + 1);
                const jogs = [];
                for (let j = 0; j < P('jogs'); j++) {
                    jogs.push({ u: s + R(e * 99 + l * 13 + j, 1) * (g - 2 * s), h: (R(e * 99 + l * 13 + j, 2) - 0.5) * s * 0.4 });
                }
                const path = [];
                for (let u = s; u < g - s; u += 0.5) {
                    let d = base;
                    // a bend is a smooth bump: ramps out over 4 cells, holds, ramps back (no cliff)
                    jogs.forEach(function (j) {
                        const up = Math.max(0, Math.min(1, (u - j.u) / (4 * K))), dn = Math.max(0, Math.min(1, (j.u + 16 * K - u) / (4 * K)));
                        d += j.h * (up * up * (3 - 2 * up)) * (dn * dn * (3 - 2 * dn));
                    });
                    if (mvOn('wiggle')) d += am * 1.6 * K * Math.sin(u * 0.22 / K + mvP('wiggle') * TAU2 + e + l);
                    d = Math.max(rmax + 3, Math.min(s - rmax - 3, d));
                    const pt = B.pt(e, u, d);
                    // throb = a thickening that flows along the cable (never pulses the whole cable thin)
                    pt.r = mvOn('throb') ? Math.max(1.4, rad * (1 + 0.25 * am * Math.sin(u * 0.14 - mvP('throb') * TAU2 + e + l))) : rad;
                    path.push(pt);
                }
                paths.push(path);
            }
        }
        paths.forEach(function (path) { path.forEach(function (p) { sc.outline(p.x, p.y, p.r); }); });
        paths.forEach(function (path) { path.forEach(function (p) { sc.splat(p.x, p.y, p.r, 1, 1, 0); }); });
        const chips = [];
        for (let i = 0; i < P('nodes'); i++) {
            const e = i % 4;
            const u = s + 4 + R(i, 3) * (g - 2 * s - 8);
            const big = i % 3 === 0;
            const hw = Math.round((big ? 5 : 2) * K), hd = Math.round((big ? 3 : 2) * K);
            const p = B.pt(e, u, s / 2);
            const r = B.rect(e, u - hw, u + hw, s / 2 - hd, s / 2 + hd);
            sc.box(r.x0, r.y0, r.x1, r.y1, 2, 1, 0.05);
            chips.push({ p: p, big: big, e: e, hw: hw, hd: hd, u: u });
        }
        sc.shade(-0.04);
        chips.forEach(function (ch, ci) {
            sc.g2(ch.p.x, ch.p.y, mvOn('leds') ? (((ci + Math.round(mvP('leds') * 2)) % 2 === 0) ? 8 : 6) : 8); sc.g2(ch.p.x + 1, ch.p.y, 7); sc.g2(ch.p.x, ch.p.y + 1, 7);
            if (ch.big) {
                for (let k = -ch.hw + 1; k < ch.hw; k += 2) {
                    [-ch.hd - 1, ch.hd + 1].forEach(function (dd) { const q = B.pt(ch.e, ch.u + k, s / 2 + dd); sc.g2(q.x, q.y, 5); });
                }
            }
        });
        const pulse = P('pulse');
        paths.forEach(function (path, i) {
            path.forEach(function (p, j) {
                if (mvOn('pulse')) {
                    if (vh(i, c.seed, 50) > pulse + 10) return;
                    const per = Math.round(14 * K);
                    const m = (((j - Math.round(mvP('pulse') * per)) % per) + per) % per;
                    if (m === 0) sc.g2(p.x, p.y, 8);
                    else if (m === per - 1 || m === per - 2) sc.g2(p.x, p.y, 7);
                    return;
                }
                const h = vh(j, c.seed + i, 21);
                if (h < pulse / 14) sc.g2(p.x, p.y, h < pulse / 40 ? 8 : 7, undefined);
            });
        });
    }

    const STYLES = {
        terran: { moves: [['breathe', 'PLATES BREATHE · form'], ['slide', 'PLATES SLIDE · form'], ['scroll', 'HAZARD STRIPES SCROLL'], ['blink', 'RIVET LIGHTS'], ['scan', 'SCAN SWEEP']], tab: 'PLATING', note: 'Terran: riveted armor plating with hazard stripes.', defs: DEFS_TERRAN.concat([FX_BULGE, FX_RELIEF]), gen: genTerran },
        kronax: { moves: [['grow', 'BLADES GROW · form'], ['blades', 'BLADES SWAY · form'], ['rimpulse', 'RIM PULSE · form'], ['lava', 'LAVA PULSE']], tab: 'FORGE', note: 'Kronax: forged rim, blades and glowing lava cracks.', defs: DEFS_KRONAX.concat([FX_BULGE, FX_RELIEF]), gen: genKronax },
        pirate: { moves: [['shift', 'PATCHES SHIFT · form'], ['chain', 'SWINGING CHAIN · form'], ['sparks', 'SPARKS']], tab: 'SCRAP', note: 'Pirate: scavenged patchwork, chains and rust.', defs: DEFS_PIRATE.concat([FX_BULGE, FX_RELIEF]), gen: genPirate },
        machine: { moves: [['wiggle', 'CONDUIT RIPPLE · form'], ['throb', 'CABLE THROB · form'], ['pulse', 'DATA PULSE FLOW'], ['leds', 'CHIP LEDS']], tab: 'CIRCUIT', note: 'Machine: conduits, circuit traces and data pulses.', defs: DEFS_MACHINE.concat([FX_BULGE, FX_RELIEF]), gen: genMachine },
        voidborn: {
            moves: [['sway', 'VINE SWAY · form'], ['breathe', 'VINE BREATHE · form'], ['grow', 'TENDRIL GROW · form'], ['curl', 'TENDRIL CURL · form'], ['glow', 'BUD GLOW']],
            tab: 'ORGANIC', note: 'Voidborn: living vines, leaves, buds and thorns.',
            defs: [['amount', 'AMOUNT', 0, 100, 85], ['wave', 'WAVE', 0, 20, 10], ['buds', 'BUDS', 0, 40, 20],
                ['lush', 'LUSH', 0, 100, 60], ['thorns', 'THORNS', 0, 20, 10], FX_RELIEF],
            gen: function (cells, o, region) { generateVines(cells, o, region); }
        }
    };

    function generateOrganic(cells, opts, region) {
        const id = (state.pack && state.pack.id) || 'voidborn';
        (STYLES[id] || STYLES.voidborn).gen(cells, opts, region);
    }

    function defaultOrganic(id) {
        const o = { seed: 1 };
        (STYLES[id] || STYLES.voidborn).defs.forEach(function (d) { o[d[0]] = d[4]; });
        return o;
    }

    function defaultAnim(id) {
        const mv = {};
        ((STYLES[id] || STYLES.voidborn).moves || []).forEach(function (m) { mv[m[0]] = true; });
        return { on: true, frames: 12, ms: 1800, flicker: 0, amount: 70, moves: mv };
    }

    function defaultPack(id, slice, grid) {
        const res = clampRes(slice || DEF_SLICE, grid || DEF_GRID);
        const tok = TOKENS[id] || TOKENS.terran;
        const prev = state.pack;
        state.pack = { id: id, slice: res.slice, grid: res.grid, cells: emptyCells(res.grid), palette: buildPalette(tok), frames: [], liveMs: 60000, organic: defaultOrganic(id), anim: defaultAnim(id), rim: RIM_U };
        const organic = state.pack.organic;
        if (id === 'voidborn') generateOrganic(state.pack.cells, organic, 'full');
        else bandFill(state.pack.cells, 2, 'full');
        const pack = state.pack;
        state.pack = prev;
        return pack;
    }

    function cellsToJson(cells) { return Array.from(cells); }

    function jsonToCells(arr, grid) {
        const n = grid || inferGrid(arr, DEF_GRID);
        const out = emptyCells(n);
        if (!arr || !arr.length) return out;
        const len = Math.min(out.length, arr.length);
        for (let i = 0; i < len; i++) out[i] = arr[i] & 15;
        return out;
    }

    function loadDrafts() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; }
        catch (e) { return {}; }
    }

    function saveDraft(pack) {
        const all = loadDrafts();
        all[pack.id] = {
            id: pack.id,
            slice: pack.slice,
            grid: pack.grid,
            liveMs: pack.liveMs,
            rim: pack.rim || RIM_U,
            cells: cellsToJson(pack.cells),
            frames: (pack.frames || []).map(cellsToJson),
            palette: pack.palette,
            organic: pack.organic || defaultOrganic(pack.id),
            anim: pack.anim || defaultAnim(pack.id)
        };
        try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    function loadPack(id) {
        const all = loadDrafts();
        const raw = all[id];
        if (!raw) return defaultPack(id);
        const grid = Number(raw.grid) || inferGrid(raw.cells, DEF_GRID);
        const slice = Number(raw.slice) || Math.round(grid / 6) || DEF_SLICE;
        const res = clampRes(slice, grid);
        const pack = defaultPack(id, res.slice, res.grid);
        pack.cells = jsonToCells(raw.cells, res.grid);
        if (inferGrid(raw.cells, res.grid) !== res.grid) {
            pack.cells = scaleCells(jsonToCells(raw.cells, inferGrid(raw.cells, res.grid)), inferGrid(raw.cells, res.grid), res.grid);
        }
        pack.frames = (raw.frames || []).map(function (f) {
            const fn = inferGrid(f, res.grid);
            const cells = jsonToCells(f, fn);
            return fn === res.grid ? cells : scaleCells(cells, fn, res.grid);
        });
        pack.liveMs = Number(raw.liveMs) || 60000;
        if (raw.palette) pack.palette = raw.palette;
        if (raw.organic) pack.organic = Object.assign(defaultOrganic(id), raw.organic);
        pack.rim = Number(raw.rim) >= 20 ? Number(raw.rim) : RIM_U;
        if (raw.anim) {
            const da = defaultAnim(id);
            pack.anim = Object.assign(da, raw.anim);
            pack.anim.moves = Object.assign(da.moves, (raw.anim && raw.anim.moves) || {});
        }
        pack.slice = res.slice;
        pack.grid = res.grid;
        return pack;
    }

    function applyResolution(slice, grid) {
        const res = clampRes(slice, grid);
        const p = state.pack;
        if (!p) return;
        const oldG = p.grid;
        if (oldG !== res.grid) {
            p.cells = scaleCells(p.cells, oldG, res.grid);
            p.frames = (p.frames || []).map(function (f) {
                return scaleCells(f, oldG, res.grid);
            });
        }
        p.slice = res.slice;
        p.grid = res.grid;
        state.draftSlice = res.slice;
        state.draftGrid = res.grid;
        saveDraft(p);
    }

    function gridToSvg(cells, palette, n, rows) {
        n = n || G();
        rows = rows || n;
        const byTone = {};
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < n; ) {
                const t = cells[y * n + x];
                if (!t) { x++; continue; }
                let w = 1;
                while (x + w < n && cells[y * n + x + w] === t) w++;
                (byTone[t] || (byTone[t] = [])).push('M' + x + ' ' + y + 'h' + w + 'v1h-' + w + 'z');
                x += w;
            }
        }
        let body = '';
        Object.keys(byTone).sort().forEach(function (t) {
            const hex = palette[t];
            if (!hex) return;
            body += '<path fill="' + hex + '" d="' + byTone[t].join('') + '"/>';
        });
        return "<svg xmlns='http://www.w3.org/2000/svg' width='" + n + "' height='" + rows +
            "' viewBox='0 0 " + n + " " + rows + "' shape-rendering='crispEdges'>" + body + '</svg>';
    }

    function download(name, text, mime) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: mime || 'image/svg+xml' }));
        a.download = name;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }

    function factionOf() {
        const bz = document.getElementById('vf-bezel');
        return (bz && bz.getAttribute('data-faction')) || 'terran';
    }

    function loadGeom() {
        try {
            const g = JSON.parse(localStorage.getItem(GEOM_KEY) || 'null');
            if (g && isFinite(g.l) && isFinite(g.t)) return g;
        } catch (e) { /* ignore */ }
        return null;
    }

    function saveGeom(g) {
        try { localStorage.setItem(GEOM_KEY, JSON.stringify(g)); } catch (e) { /* ignore */ }
    }

    function applyGeom(plate, g) {
        if (!plate) return;
        if (state.max) { applyMaxRect(plate); return; }
        if (!g || !isFinite(g.l) || !isFinite(g.t)) {
            plate.style.left = '';
            plate.style.top = '';
            plate.style.right = '';
            plate.classList.remove('is-placed');
            return;
        }
        const W = window.innerWidth, H = window.innerHeight;
        const w = plate.offsetWidth || 360;
        const h = Math.min(plate.offsetHeight || 200, H);
        const l = Math.max(0, Math.min(g.l, W - Math.min(w, W)));
        const t = Math.max(0, Math.min(g.t, H - Math.min(48, h)));
        plate.style.left = l + 'px';
        plate.style.top = t + 'px';
        plate.style.right = 'auto';
        plate.classList.add('is-placed');
    }

    function startPlateDrag(e, plate) {
        if (state.max) return;
        if (e.button != null && e.button !== 0) return;
        if (e.target.closest && e.target.closest('button')) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        const r = plate.getBoundingClientRect();
        const g0 = { l: r.left, t: r.top };
        plate.classList.add('is-dragging');
        plate.style.right = 'auto';
        plate.classList.add('is-placed');
        const move = function (ev) {
            const g = { l: g0.l + ev.clientX - sx, t: g0.t + ev.clientY - sy };
            applyGeom(plate, g);
            state.geom = g;
        };
        const up = function () {
            plate.classList.remove('is-dragging');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            if (state.geom) saveGeom(state.geom);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    }

    // Maximized = exactly the glass opening of the bezel (band stays visible around it).
    function applyMaxRect(plate) {
        const bz = document.getElementById('vf-bezel');
        const back = bz && bz.querySelector('.vf-bezel-back');
        if (!bz || !back) return;
        const r = back.getBoundingClientRect();
        const k = back.offsetWidth ? r.width / back.offsetWidth : 1;
        const cs = getComputedStyle(back);
        const l = r.left + (parseFloat(cs.paddingLeft) || 0) * k;
        const t = r.top + (parseFloat(cs.paddingTop) || 0) * k;
        const w = r.width - ((parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)) * k;
        const h = r.height - ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)) * k;
        if (!(w > 200 && h > 200)) return;
        const set = function (n, v) { plate.style.setProperty(n, v, 'important'); };
        set('left', Math.round(l) + 'px');
        set('top', Math.round(t) + 'px');
        set('right', 'auto');
        set('bottom', 'auto');
        set('width', Math.round(w) + 'px');
        set('height', Math.round(h) + 'px');
        plate.style.setProperty('--max-h', Math.round(h) + 'px');
    }
    function clearMaxRect(plate) {
        ['left', 'top', 'right', 'bottom', 'width', 'height', '--max-h'].forEach(function (n) { plate.style.removeProperty(n); });
        if (state.geom) applyGeom(plate, state.geom);
    }

    // The stage scale / bezel layout settles after boot: keep the maximized plate glued to the opening.
    setInterval(function () {
        const pl = document.getElementById('vf-bezel-editor');
        if (pl && state.open && state.max) applyMaxRect(pl);
    }, 400);

    // Animated preview inside the ANIMATE tab: plays the generated frames at the configured rate.
    let prevK = 0;
    (function previewLoop() {
        let per = 200;
        try {
            const pl = document.getElementById('vf-bezel-editor');
            const pv = pl && state.open && state.tab === 'live' ? pl.querySelector('[data-bz-preview]') : null;
            const fr = state.animFrames;
            const an = state.pack && state.pack.anim;
            if (an) per = Math.max(60, Math.min(1000, (Math.max(300, an.ms | 0)) / Math.max(1, (fr && fr.cells.length) || an.frames || 8)));
            if (pv && fr && state.pack && fr.id === state.pack.id && fr.grid === state.pack.grid && fr.cells.length > 1) {
                prevK = (prevK + 1) % fr.cells.length;
                paintCanvas(pv, fr.cells[prevK]);
                const lb = pl.querySelector('[data-bz-prev-label]');
                if (lb) lb.textContent = 'preview · frame ' + (prevK + 1) + ' / ' + fr.cells.length;
            }
        } catch (e) { /* ignore */ }
        setTimeout(previewLoop, per);
    })();

    function ensurePlate() {
        let plate = document.getElementById('vf-bezel-editor');
        if (plate) return plate;
        plate = document.createElement('div');
        plate.id = 'vf-bezel-editor';
        plate.className = 'vf-bezel-editor';
        plate.hidden = true;
        document.body.appendChild(plate);
        plate.addEventListener('click', onClick);
        plate.addEventListener('input', onInput);
        plate.addEventListener('change', onInput);
        plate.addEventListener('pointerdown', function (e) {
            const head = e.target.closest && e.target.closest('.vf-bz-ed-head');
            if (head) {
                startPlateDrag(e, plate);
                return;
            }
            onPaintDown(e);
        });
        plate.addEventListener('pointermove', onPaintMove);
        plate.addEventListener('pointerout', function (e) {
            const c = e.target.closest && e.target.closest('[data-bz-canvas],[data-bz-mini]');
            if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) clearHover(c);
        });
        plate.addEventListener('contextmenu', function (e) {
            if (e.target.closest && e.target.closest('[data-bz-canvas],[data-bz-mini]')) e.preventDefault();
        });
        plate.addEventListener('dblclick', function (e) {
            if (!(e.target.closest && e.target.closest('.vf-bz-ed-head'))) return;
            if (e.target.closest('button')) return;
            state.geom = null;
            try { localStorage.removeItem(GEOM_KEY); } catch (err) { /* ignore */ }
            applyGeom(plate, null);
        });
        window.addEventListener('pointerup', function () { state.painting = false; });
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && state.open && state.max) { e.stopPropagation(); state.max = false; render(); }
        }, true);
        window.addEventListener('resize', function () {
            if (state.max) applyMaxRect(plate);
            else if (state.geom) applyGeom(plate, state.geom);
        });
        state.geom = loadGeom();
        applyGeom(plate, state.geom);
        return plate;
    }

    function measureN() {
        const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bz-u')) || 1;
        return ((RIM_U * u) / S()).toFixed(2);
    }

    function fit() { return window.vfFitScope || null; }

    function frameVal(key, fallback) {
        const ns = fit();
        if (ns && typeof ns.phFrValue === 'function') {
            const v = ns.phFrValue(key);
            return v != null ? v : fallback;
        }
        return fallback;
    }

    function setFrame(key, v) {
        const ns = fit();
        if (ns && typeof ns.phSetFr === 'function') ns.phSetFr(key, v);
        if (ns && typeof ns.renderFrameEditGrips === 'function') ns.renderFrameEditGrips();
        syncFrameBtn();
    }

    function toggleGrips(force) {
        const ns = fit();
        if (!ns || typeof ns.toggleFrameEdit !== 'function') return;
        ns.toggleFrameEdit(force);
        syncFrameBtn();
    }

    function syncFrameBtn() {
        const on = !!(fit() && fit().isFrameEditOn && fit().isFrameEditOn());
        document.querySelectorAll('.vf-bezel-tools [data-tool="frameEdit"]').forEach(function (btn) {
            btn.classList.toggle('is-open', on);
        });
    }

    function org() {
        if (!state.pack.organic) state.pack.organic = defaultOrganic(state.pack.id);
        return state.pack.organic;
    }

    function syncDraftRes() {
        state.draftSlice = S();
        state.draftGrid = G();
    }

    function render() {
        const plate = ensurePlate();
        if (!state.open) { plate.hidden = true; return; }
        plate.hidden = false;
        state.hover = null;
        plate.classList.toggle('is-max', !!state.max);
        // <body> carries the stage scale transform, which would offset/shrink a fixed full-screen plate.
        const host = state.max ? document.documentElement : document.body;
        if (plate.parentElement !== host) host.appendChild(plate);
        if (state.max) applyMaxRect(plate); else clearMaxRect(plate);
        saveUi();
        if (!state.pack) {
            state.pack = loadPack(factionOf());
            syncDraftRes();
        }
        const p = state.pack;
        const o = org();
        const g = G(), s = S();
        const tabs = [
            ['contract', 'CONTRACT'],
            ['frame', 'FRAME'],
            ['palette', 'PALETTE'],
            ['tile', 'TILE'],
            ['organic', (STYLES[p.id] || STYLES.voidborn).tab],
            ['live', 'ANIMATE'],
            ['flux', 'FLUX'],
            ['export', 'EXPORT']
        ];
        let h = '<div class="vf-bz-ed-head" title="Drag to move · double-click to reset">' +
            '<strong>BEZEL EDITOR</strong>' +
            '<span class="vf-bz-ed-head-btns">' +
            '<button type="button" data-bz="maxToggle" title="' + (state.max ? 'Restore window (Esc)' : 'Maximize to full screen') + '">' + (state.max ? '❐' : '⛶') + '</button>' +
            '<button type="button" data-bz="close" title="Close">✕</button></span></div>';
        h += '<div class="vf-bz-ed-tabs vf-bz-ed-factabs">' + FACTIONS.map(function (f) {
            return '<button type="button" data-bz-fac="' + f + '" title="' + f.toUpperCase() + '" style="--fc:' + TOKENS[f].accent + '"' + (p.id === f ? ' class="is-on"' : '') + '>' + emblemHtml(f) + '</button>';
        }).join('') + '</div>';
        h += '<div class="vf-bz-ed-tabs">' + tabs.map(function (t) {
            return '<button type="button" data-bz-tab="' + t[0] + '"' +
                (state.tab === t[0] ? ' class="is-on"' : '') + '>' + t[1] + '</button>';
        }).join('') + '</div><div class="vf-bz-ed-body">';

        if (state.tab === 'tile' || state.tab === 'organic' || state.tab === 'flux') {
            const rl = (REGIONS.filter(function (r) { return r[0] === state.region; })[0] || ['full', 'FULL'])[1];
            h += '<div class="vf-bz-ed-region-info"><div>REGION <b>' + rl + '</b><br><span>' +
                (state.tab === 'tile' ? 'Right-click the preview to pick' : 'Click the preview to pick') +
                ' a corner or edge · centre = FULL · click it again to go back · Shift+click top = STRIP</span></div>' +
                (state.tab === 'flux' ? '<canvas class="vf-bz-ed-mini" width="150" height="150" data-bz-mini="1"></canvas>' : '') + '</div>';
        }

        if (state.tab === 'contract') {
            const presetKey = state.draftSlice + '/' + state.draftGrid;
            h += '<div class="vf-bz-ed-row"><span>PRESET</span><select data-bz="resPreset">' +
                '<option value="">custom…</option>' +
                RES_PRESETS.map(function (pr) {
                    const k = pr.slice + '/' + pr.grid;
                    return '<option value="' + k + '"' + (presetKey === k ? ' selected' : '') + '>' + pr.label + '</option>';
                }).join('') + '</select></div>' +
                '<div class="vf-bz-ed-row"><span>SLICE</span><input type="number" data-bz="draftSlice" min="8" max="128" step="1" value="' + state.draftSlice + '"></div>' +
                '<div class="vf-bz-ed-row"><span>GRID</span><input type="number" data-bz="draftGrid" min="32" max="512" step="2" value="' + state.draftGrid + '"></div>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="applyRes">SET RESOLUTION</button>' +
                '<button type="button" data-bz="lockRatio">GRID = 6×SLICE</button>' +
                '</div>' +
                '<div class="vf-bz-ed-row"><span>ACTIVE</span><output>' + s + ' / ' + g + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>RIM_U</span><output>' + RIM_U + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>N (px/art)</span><output>' + measureN() + '</output></div>' +
                '<p class="vf-bz-ed-note">SET RESOLUTION scales the tile (nearest). APPLY LIVE pushes slice + art to the bezel.</p>';
        } else if (state.tab === 'frame') {
            const gripsOn = !!(window.vfFitScope && window.vfFitScope.isFrameEditOn && window.vfFitScope.isFrameEditOn());
            const fill = frameVal('bgCrop', 100);
            const vine = frameVal('vineInset', 0);
            h += rimRowHtml(p) + '<div class="vf-bz-ed-row"><span>GRIPS</span>' +
                '<button type="button" data-bz="toggleGrips" class="vf-bz-ed-toggle' + (gripsOn ? ' is-on' : '') + '">' +
                (gripsOn ? 'ON' : 'OFF') + '</button></div>' +
                '<div class="vf-bz-ed-row"><span>BEZEL FILL</span>' +
                '<input type="range" data-bz-fr="bgCrop" min="0" max="100" step="5" value="' + fill + '">' +
                '<output>' + fill + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>VINE INSET</span>' +
                '<input type="range" data-bz-fr="vineInset" min="0" max="8" step="1" value="' + vine + '">' +
                '<output>' + vine + '</output></div>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="resetFrame">RESET FRAME</button>' +
                '<button type="button" data-bz="toggleGrips">' + (gripsOn ? 'HIDE GRIPS' : 'SHOW GRIPS') + '</button>' +
                '</div>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="organicFull">BUILD BEZEL</button>' +
                '<button type="button" data-bz-tab="organic">STYLE SETTINGS…</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">Same knobs as DevBar crosshair. Grips drag on the bezel band; sliders write live.</p>';
        } else if (state.tab === 'palette') {
            h += [1, 2, 3, 4, 5, 6, 7, 8].map(function (t) {
                return '<label class="vf-bz-ed-swatch' + (state.tone === t ? ' is-on' : '') +
                    '" data-bz-tone="' + t + '" style="--sw:' + (p.palette[t] || '#000') +
                    '"><input type="color" data-bz-pal="' + t + '" value="' + (p.palette[t] || '#000000') +
                    '"><span>' + t + '</span></label>';
            }).join('') +
                '<button type="button" data-bz="resetPal">RESET PALETTE</button>';
        } else if (state.tab === 'tile') {
            h += '<div class="vf-bz-ed-tones">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (t) {
                const c = t === 0 ? 'transparent' : (p.palette[t] || '#000');
                return '<button type="button" data-bz-tone="' + t + '" class="vf-bz-ed-tone' +
                    (state.tone === t ? ' is-on' : '') + '" style="background:' + c +
                    '" title="tone ' + t + '"></button>';
            }).join('') + '</div>' +
                '<div class="vf-bz-ed-row"><span>BRUSH</span><input type="range" data-bz="brush" min="1" max="8" value="' + state.brush + '"><output>' + state.brush + '</output></div>' +
                '<canvas class="vf-bz-ed-canvas" width="' + g + '" height="' + g +
                '" data-bz-canvas="1"></canvas>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="fillRegion">FILL REGION</button>' +
                '<button type="button" data-bz="clearRegion">CLEAR REGION</button>' +
                '<button type="button" data-bz="apply">APPLY LIVE</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">' + g + '² · slice ' + s + ' · region <b>' + state.region.toUpperCase() + '</b></p>';
        } else if (state.tab === 'organic') {
            const st = STYLES[p.id] || STYLES.voidborn;
            h += '<p class="vf-bz-ed-note">' + st.note + '</p>' + rimRowHtml(p);
            st.defs.forEach(function (d) {
                const v = o[d[0]] == null ? d[4] : o[d[0]];
                h += '<div class="vf-bz-ed-row"><span>' + d[1] + '</span><input type="range" data-bz-org="' + d[0] +
                    '" min="' + d[2] + '" max="' + d[3] + '" value="' + v + '"><output>' + v + '</output></div>';
            });
            h += '<div class="vf-bz-ed-row"><span>SEED</span><input type="number" data-bz-org="seed" min="0" max="9999" value="' + o.seed + '"></div>' +
                '<canvas class="vf-bz-ed-canvas" width="' + g + '" height="' + g + '" data-bz-canvas="1"></canvas>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="organicRegion">BUILD IN REGION</button>' +
                '<button type="button" data-bz="organicFull">BUILD FULL</button>' +
                '</div><div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="randomize">RANDOMIZE</button>' +
                '<button type="button" data-bz="rollSeed">NEW SEED</button>' +
                '<button type="button" data-bz="resetStyle">RESET STYLE</button>' +
                '<button type="button" data-bz="apply">APPLY LIVE</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">' + st.tab + ' @ ' + g + '² / slice ' + s + '</p>';
        } else if (state.tab === 'live') {
            const an = p.anim || (p.anim = defaultAnim(p.id));
            const stl = STYLES[p.id] || STYLES.voidborn;
            h += '<div class="vf-bz-ed-row"><span>ANIMATE</span>' +
                '<button type="button" data-bz="animToggle" class="vf-bz-ed-toggle' + (an.on ? ' is-on' : '') + '" title="Turn the animation on / off">' + (an.on ? 'ON' : 'OFF') + '</button></div>' +
                '<div class="vf-bz-ed-row"><span>FRAMES</span><input type="range" data-bz-anim="frames" min="2" max="12" step="1" value="' + an.frames + '"><output>' + an.frames + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>SPEED (cycle ms)</span><input type="range" data-bz-anim="ms" min="500" max="12000" step="100" value="' + (12500 - an.ms) + '"><output>' + an.ms + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>MOTION AMOUNT</span><input type="range" data-bz-anim="amount" min="0" max="100" step="0.5" value="' + (an.amount == null ? 70 : an.amount) + '"><output>' + (an.amount == null ? 70 : an.amount) + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>FLICKER</span><input type="range" data-bz-anim="flicker" min="0" max="100" step="5" value="' + an.flicker + '"><output>' + an.flicker + '</output></div>' +
                '<p class="vf-bz-ed-note vf-bz-ed-anim-status">' + animStatusText(an, stl) + '</p>' +
                '<canvas class="vf-bz-ed-canvas" width="' + g + '" height="' + g + '" data-bz-preview="1"></canvas>' +
                '<div class="vf-bz-ed-note" data-bz-prev-label>preview</div>' +
                '<div class="vf-bz-ed-title">WHAT MOVES</div>' +
                (stl.moves || []).map(function (m) {
                    const cur = an.moves[m[0]] === true ? 1 : (Number(an.moves[m[0]]) || 0);
                    return '<label class="vf-bz-ed-row vf-bz-ed-move"><span>' + m[1] + '</span><select data-bz-move="' + m[0] + '">' +
                        MOVE_MODES.map(function (md, mi) { return '<option value="' + mi + '"' + (mi === cur ? ' selected' : '') + '>' + md[1] + '</option>'; }).join('') +
                        '</select></label>';
                }).join('') +
                '<div class="vf-bz-ed-actions"><button type="button" data-bz="apply">APPLY LIVE</button></div>' +
                '<p class="vf-bz-ed-note">Frames are rebuilt from the ' + stl.tab + ' settings (hand-painted cells are not animated). Saved with SAVE BEZEL.</p>';
        } else if (state.tab === 'flux') {
            h += '<div class="vf-bz-ed-row"><span>PART</span><select data-bz="fluxPart">' +
                [['full', 'FULL'], ['corner', 'CORNER'], ['edge', 'EDGE'], ['topstrip', 'TOPSTRIP']].map(function (o2) {
                    return '<option value="' + o2[0] + '"' + (state.fluxPart === o2[0] ? ' selected' : '') + '>' + o2[1] + '</option>';
                }).join('') + '</select></div>' +
                '<label class="vf-bz-ed-prompt">PROMPT<textarea data-bz="fluxPrompt" rows="3" placeholder="organic vine hollow frame…"></textarea></label>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="fluxGen"' + (state.fluxBusy ? ' disabled' : '') + '>GENERATE</button>' +
                '<button type="button" data-bz="fluxMerge"' + (state.fluxBusy ? ' disabled' : '') + '>MERGE → REGION</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">' + (state.fluxStatus || 'Needs ComfyUI + bridge. Size = active GRID ' + g + '.') + '</p>' +
                (state.fluxPreview ? '<img class="vf-bz-ed-preview" alt="flux preview" src="' + state.fluxPreview + '">' : '');
        } else if (state.tab === 'export') {
            h += '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="saveDraft">SAVE DRAFT</button>' +
                '<button type="button" data-bz="dlSvg">DOWNLOAD SVG</button>' +
                '<button type="button" data-bz="exportJson">EXPORT JSON</button>' +
                '<label class="vf-bz-ed-file">IMPORT JSON<input type="file" accept="application/json,.json" data-bz="importFile" hidden></label>' +
                '<button type="button" data-bz="apply">APPLY LIVE</button>' +
                '<button type="button" data-bz="clearApply">CLEAR OVERRIDE</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">SVG ' + g + '² · slice ' + s + ' · drafts in localStorage.</p>';
        }
        h += '</div>';
        const hh = H();
        h += '<div class="vf-bz-ed-foot"><span class="vf-bz-ed-foot-tools">' +
            '<button type="button" data-bz="undo" title="Undo"' + (hh.u.length ? '' : ' disabled') + '>↶</button>' +
            '<button type="button" data-bz="redo" title="Redo"' + (hh.r.length ? '' : ' disabled') + '>↷</button>' +
            '<button type="button" data-bz="compare" title="Show the original faction bezel"' + (state.compare ? ' class="is-on"' : '') + '>ORIGINAL</button></span>' +
            '<span class="vf-bz-ed-foot-msg">' +
            (state.saveMsg || (loadSaved()[p.id] ? '● ' + p.id.toUpperCase() + ' bezel saved' : 'not saved yet')) +
            '</span><button type="button" class="vf-bz-ed-save" data-bz="saveBezel">SAVE BEZEL</button></div>';
        plate.innerHTML = h;
        const canvas = plate.querySelector('[data-bz-canvas]');
        if (canvas) paintCanvas(canvas);
        const pv = plate.querySelector('[data-bz-preview]');
        if (pv) paintCanvas(pv);
        const mini = plate.querySelector('[data-bz-mini]');
        if (mini) paintMini(mini);
    }

    function paintCanvas(canvas, cellsOverride) {
        const ctx = canvas.getContext('2d');
        const p = state.pack;
        const cells = cellsOverride || p.cells;
        const g = G(), s = S();
        const img = ctx.createImageData(g, g);
        const d = img.data;
        const r = regionRect(state.region);
        for (let i = 0; i < cells.length; i++) {
            const t = cells[i];
            const o = i * 4;
            const x = i % g, y = (i / g) | 0;
            const dim = !inRegion(x, y, state.region);
            if (!t) {
                d[o] = dim ? 12 : 20; d[o + 1] = dim ? 12 : 20; d[o + 2] = dim ? 18 : 28; d[o + 3] = 255;
                continue;
            }
            const hex = (p.palette[t] || '#888888').replace('#', '');
            const n = parseInt(hex, 16);
            let rr = (n >> 16) & 255, gg = (n >> 8) & 255, bb = n & 255;
            if (dim) { rr = (rr * 0.35) | 0; gg = (gg * 0.35) | 0; bb = (bb * 0.35) | 0; }
            d[o] = rr; d[o + 1] = gg; d[o + 2] = bb; d[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        ctx.strokeStyle = 'rgba(255,220,80,0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x0 + 0.5, r.y0 + 0.5, r.x1 - r.x0, r.y1 - r.y0);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
        ctx.strokeRect(g - s + 0.5, 0.5, s - 1, s - 1);
        ctx.strokeRect(0.5, g - s + 0.5, s - 1, s - 1);
        ctx.strokeRect(g - s + 0.5, g - s + 0.5, s - 1, s - 1);
        drawRegionMarks(ctx, g, false);
    }

    // ---- region picking straight in the view ----
    function regionAt(x, y, shift) {
        const s = S(), g = G();
        const l = x < s, r = x >= g - s, t = y < s, b = y >= g - s;
        if (t && shift) return 'topstrip';
        if (t && l) return 'tl';
        if (t && r) return 'tr';
        if (b && l) return 'bl';
        if (b && r) return 'br';
        if (t) return 'top';
        if (b) return 'bottom';
        if (l) return 'left';
        if (r) return 'right';
        return 'full';
    }
    function pickRegionAt(canvas, e) {
        const xy = canvasXY(canvas, e);
        let reg = regionAt(xy.x, xy.y, e.shiftKey);
        if (reg === state.region && reg !== 'full') reg = 'full';
        state.region = reg;
        state.hover = null;
        render();
    }
    function hoverRegion(canvas, e) {
        const xy = canvasXY(canvas, e);
        const reg = regionAt(xy.x, xy.y, e.shiftKey);
        if (reg === state.hover) return;
        state.hover = reg;
        if (canvas.hasAttribute('data-bz-mini')) paintMini(canvas); else paintCanvas(canvas);
    }
    function clearHover(canvas) {
        if (!state.hover) return;
        state.hover = null;
        if (canvas.hasAttribute('data-bz-mini')) paintMini(canvas); else paintCanvas(canvas);
    }
    function drawRegionMarks(ctx, g, small) {
        const lab = function (id) { return (REGIONS.filter(function (r) { return r[0] === id; })[0] || ['', id])[1]; };
        if (state.hover && state.hover !== state.region) {
            const h = regionRect(state.hover);
            ctx.save();
            ctx.setLineDash([3, 2]);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = small ? 1.5 : 1;
            ctx.strokeRect(h.x0 + 0.5, h.y0 + 0.5, h.x1 - h.x0, h.y1 - h.y0);
            ctx.restore();
            ctx.font = (small ? 11 : 9) + 'px monospace';
            const tx = Math.max(2, Math.min(g - 46, h.x0 + 3)), ty = Math.max(11, h.y0 + 11);
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(tx - 2, ty - 9, 44, 12);
            ctx.fillStyle = '#fff';
            ctx.fillText(lab(state.hover), tx, ty);
        }
    }
    // Small region map (FLUX tab has no big preview).
    function paintMini(canvas) {
        const ctx = canvas.getContext('2d');
        const g = G(), W = canvas.width, k = W / g;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#0a0e15';
        ctx.fillRect(0, 0, g, g);
        REGIONS.forEach(function (r) {
            if (r[0] === 'full' || r[0] === 'topstrip') return;
            const q = regionRect(r[0]);
            ctx.fillStyle = r[0] === state.region ? 'rgba(255,216,74,0.5)' : 'rgba(120,140,170,0.22)';
            ctx.fillRect(q.x0, q.y0, q.x1 - q.x0 + 1, q.y1 - q.y0 + 1);
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1 / k;
            ctx.strokeRect(q.x0 + 0.5 / k, q.y0 + 0.5 / k, q.x1 - q.x0, q.y1 - q.y0);
        });
        if (state.region === 'full') { ctx.strokeStyle = 'rgba(255,216,74,0.95)'; ctx.lineWidth = 2 / k; ctx.strokeRect(1 / k, 1 / k, g - 2 / k, g - 2 / k); }
        if (state.region === 'topstrip') { ctx.fillStyle = 'rgba(255,216,74,0.5)'; ctx.fillRect(0, 0, g, S()); }
        drawRegionMarks(ctx, g, true);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function canvasXY(canvas, e) {
        const g = G();
        const r = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / r.width * g);
        const y = Math.floor((e.clientY - r.top) / r.height * g);
        return {
            x: Math.max(0, Math.min(g - 1, x)),
            y: Math.max(0, Math.min(g - 1, y))
        };
    }

    function paintAt(canvas, e) {
        const { x, y } = canvasXY(canvas, e);
        const g = G();
        const br = state.brush | 0;
        for (let dy = -br; dy <= br; dy++) {
            for (let dx = -br; dx <= br; dx++) {
                if (dx * dx + dy * dy > br * br) continue;
                const xx = x + dx, yy = y + dy;
                if (xx < 0 || yy < 0 || xx >= g || yy >= g) continue;
                if (!inRegion(xx, yy, state.region)) continue;
                state.pack.cells[yy * g + xx] = state.tone & 15;
            }
        }
        paintCanvas(canvas);
        liveSoon();
    }

    // Throttled live apply (painting / dragging a colour): never more than ~8 per second.
    function liveSoon() {
        if (state.liveT) return;
        state.liveT = setTimeout(function () { state.liveT = 0; applyLive(); }, 120);
    }

    function onPaintDown(e) {
        const mini = e.target.closest && e.target.closest('[data-bz-mini]');
        if (mini) { pickRegionAt(mini, e); e.preventDefault(); return; }
        const canvas = e.target.closest && e.target.closest('[data-bz-canvas]');
        if (!canvas) return;
        // TILE paints with the left button and picks a region with the right one; the other tabs just pick.
        if (state.tab !== 'tile' || e.button === 2) { pickRegionAt(canvas, e); e.preventDefault(); return; }
        if (e.button != null && e.button !== 0) return;
        state.painting = true;
        pushHist();
        canvas.setPointerCapture(e.pointerId);
        paintAt(canvas, e);
        e.preventDefault();
    }

    function onPaintMove(e) {
        const hc = e.target.closest && e.target.closest('[data-bz-canvas],[data-bz-mini]');
        if (!state.painting) {
            if (hc) hoverRegion(hc, e);
            return;
        }
        const canvas = e.target.closest && e.target.closest('[data-bz-canvas]');
        if (!canvas) return;
        paintAt(canvas, e);
    }

    function blobOf(cells, p) {
        return URL.createObjectURL(new Blob([gridToSvg(cells, p.palette, p.grid)], { type: 'image/svg+xml' }));
    }
    function revokeAnim() {
        state.animFrames = null;
        if (state.animDrv) { clearInterval(state.animDrv); state.animDrv = 0; }
        (state.animUrls || []).forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
        state.animUrls = [];
        const el = document.getElementById('vf-bz-anim-style');
        if (el) el.remove();
    }
    function animStatusText(an, stl) {
        const n = (stl.moves || []).filter(function (m) { return an.moves[m[0]]; }).length;
        if (!an.on) return 'ANIMATION OFF — click the ON/OFF button (or move any slider) to start it.';
        if (!n) return 'No movement selected: only the flicker runs. Tick something below.';
        return 'RUNNING · ' + n + ' movement' + (n > 1 ? 's' : '') + ' · ' + an.frames + ' frames · ' + (an.frames / (an.ms / 1000)).toFixed(1) + ' fps · motion ' + an.amount + '%';
    }
    // Update the toggle + status line in place (no re-render, so a slider drag is not interrupted).
    function syncAnimUi() {
        const pl = document.getElementById('vf-bezel-editor');
        if (!pl || !state.pack || !state.pack.anim) return;
        const an = state.pack.anim;
        const tg = pl.querySelector('[data-bz="animToggle"]');
        if (tg) { tg.classList.toggle('is-on', !!an.on); tg.textContent = an.on ? 'ON' : 'OFF'; }
        const st = pl.querySelector('.vf-bz-ed-anim-status');
        if (st) st.textContent = animStatusText(an, STYLES[state.pack.id] || STYLES.voidborn);
    }

    function releasePending() { document.documentElement.removeAttribute('data-vf-bz-pending'); }
    function decodeUrl(url) {
        return new Promise(function (res) {
            const im = new Image();
            im.onload = im.onerror = function () { res(); };
            im.src = url;
            if (im.decode) im.decode().then(res, res);
        });
    }
    function bumpApply() { state.applyTok = (state.applyTok || 0) + 1; return state.applyTok; }

    // Some engines don't step border-image-source from @keyframes: if the computed image never changes,
    // drive the frames from a timer instead (same frames, same cycle time).
    function verifyAnim(urls, a, tok) {
        if (urls.length < 2) return;
        const per = Math.max(300, a.ms | 0) / urls.length;
        setTimeout(function () {
            if (tok !== state.applyTok) return;
            const el = document.querySelector('#vf-bezel .vf-fr');
            if (!el) return;
            const seen = {};
            let n = 0;
            const iv = setInterval(function () {
                const v = getComputedStyle(el, '::after').borderImageSource;
                seen[v] = 1;
                if (++n < Math.min(12, urls.length * 2)) return;
                clearInterval(iv);
                if (tok !== state.applyTok || Object.keys(seen).length > 1) return;
                const bz = document.getElementById('vf-bezel');
                const st = document.getElementById('vf-bz-anim-style');
                if (!bz) return;
                if (st) st.textContent = '#vf-bezel.vf-bezel[data-faction] .vf-fr::after { animation: none !important; }\n';
                let k = 0;
                state.animDrv = setInterval(function () {
                    k = (k + 1) % urls.length;
                    bz.style.setProperty('--fr-art', 'url("' + urls[k] + '")');
                }, per);
            }, Math.max(60, per * 0.7));
        }, 400);
    }

    // Animation frames are built one per tick (no long task) and swapped in only once all are decoded.
    function buildAnim(p, tok) {
        const a = p.anim;
        const st = STYLES[p.id] || STYLES.voidborn;
        const anyMove = !!a && (st.moves || []).some(function (m) { return a.moves && a.moves[m[0]]; });
        if (!a || !a.on || (!anyMove && !(a.flicker > 0))) { revokeAnim(); return; }
        const N = anyMove ? Math.max(2, Math.min(12, Math.round(a.frames) || 6)) : 4;
        const urls = [];
        const cellFrames = [];
        function abort() { urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } }); }
        function finish() {
            Promise.all(urls.map(decodeUrl)).then(function () {
                if (tok !== state.applyTok) { abort(); return; }
                revokeAnim();
                const list = anyMove ? urls : [urls[0]];
                state.animUrls = list;
                state.animFrames = { id: p.id, grid: p.grid, cells: anyMove ? cellFrames : [p.cells] };
                let css = '@keyframes vf-bz-custom {\n';
                for (let k = 0; k < N; k++) {
                    const br = 1 + (a.flicker / 100) * 0.22 * ((vh(k, 7, 3) / 100) - 0.35);
                    css += (k / N * 100).toFixed(3) + '% { border-image-source: url("' + urls[k] + '"); filter: brightness(' + br.toFixed(3) + '); }\n';
                }
                css += '100% { border-image-source: url("' + urls[0] + '"); filter: brightness(1); }\n}\n' +
                    '#vf-bezel.vf-bezel[data-faction] .vf-fr::after { animation: vf-bz-custom ' + Math.max(300, a.ms | 0) + 'ms steps(1, end) infinite !important; }\n';
                const el = document.createElement('style');
                el.id = 'vf-bz-anim-style';
                el.textContent = css;
                document.head.appendChild(el);
                verifyAnim(list, a, tok);
            });
        }
        if (!anyMove) {
            const u = blobOf(p.cells, p);
            for (let k = 0; k < N; k++) urls.push(u);
            finish();
            return;
        }
        let k = 0;
        (function step() {
            if (tok !== state.applyTok) { abort(); return; }
            const prev = state.pack;
            state.pack = p;
            try {
                curAnim = { ph: k / N, mv: a.moves, amt: ((a.amount == null ? 70 : a.amount) / 100) * 1.5 };
                const cells = new Uint8Array(p.grid * p.grid);
                st.gen(cells, p.organic || defaultOrganic(p.id), 'full');
                urls.push(blobOf(cells, p));
                cellFrames.push(cells);
            } finally { curAnim = { ph: 0, mv: {}, amt: 0.7 }; state.pack = prev; }
            k++;
            if (k < N) setTimeout(step, 0); else finish();
        })();
    }

    function applyPackArt(p) {
        state.compare = false;
        const tok = bumpApply();
        const url = blobOf(p.cells, p);
        // Header strip (taller than the rim) is cut from the top band of the new art, so the stock strip doesn't show.
        const topUrl = URL.createObjectURL(new Blob([gridToSvg(p.cells, p.palette, p.grid, p.slice)], { type: 'image/svg+xml' }));
        Promise.all([decodeUrl(url), decodeUrl(topUrl)]).then(function () {
            if (tok !== state.applyTok) { URL.revokeObjectURL(url); URL.revokeObjectURL(topUrl); return; }
            const old = state.blobUrl, oldTop = state.topUrl;
            state.blobUrl = url;
            state.topUrl = topUrl;
            const bz = document.getElementById('vf-bezel');
            if (bz) {
                const dark = (p.palette && p.palette[1]) || '#05060a';
                applyRimVars(p.rim);
                bz.style.setProperty('--fr-topstrip', 'url("' + topUrl + '")');
                bz.style.setProperty('--fr-band-fill', dark);
                bz.style.setProperty('--fr-art-fallback', dark);
                bz.style.setProperty('--fr-art', 'url("' + url + '")');
                bz.style.setProperty('--fr-slice', String(p.slice));
                const ms = (p.anim && p.anim.on) ? p.anim.ms : p.liveMs;
                if (ms) bz.style.setProperty('--fr-live-dur', ms + 'ms');
            }
            if (old) setTimeout(function () { try { URL.revokeObjectURL(old); } catch (e) { /* ignore */ } }, 800);
            if (oldTop) setTimeout(function () { try { URL.revokeObjectURL(oldTop); } catch (e) { /* ignore */ } }, 800);
            releasePending();
            buildAnim(p, tok);
        });
    }

    let applyTimer = 0;
    function scheduleApply() {
        clearTimeout(applyTimer);
        applyTimer = setTimeout(function () { applyLive(); }, (state.pack && state.pack.anim && state.pack.anim.on) ? 160 : 0);
    }

    function applyLive() {
        const p = state.pack;
        if (!p) return;
        applyPackArt(p);
        saveDraft(p);
        state.fluxStatus = 'Applied live · ' + p.grid + '² slice ' + p.slice;
    }

    function loadSaved() {
        try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function setSaved(id, on) {
        const all = loadSaved();
        if (on) all[id] = true; else delete all[id];
        try { localStorage.setItem(SAVED_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    // ---- undo / redo ----
    const histMap = {};
    function H() {
        const id = state.pack.id;
        return histMap[id] || (histMap[id] = { u: [], r: [] });
    }
    function snap() {
        const p = state.pack;
        return {
            id: p.id, cells: p.cells.slice(), grid: p.grid, slice: p.slice, rim: p.rim || RIM_U,
            organic: JSON.parse(JSON.stringify(p.organic || {})),
            anim: JSON.parse(JSON.stringify(p.anim || {})),
            palette: JSON.parse(JSON.stringify(p.palette || {}))
        };
    }
    function pushHist(throttle) {
        if (!state.pack) return;
        const now = Date.now();
        const quick = throttle && now - (state.histAt || 0) < 900;
        state.histAt = now;
        if (quick) return;
        const h = H();
        h.u.push(snap());
        if (h.u.length > 40) h.u.shift();
        h.r = [];
    }
    function restoreSnap(sn) {
        const p = state.pack;
        p.cells = sn.cells.slice();
        if (sn.grid) { p.grid = sn.grid; p.slice = sn.slice; p.rim = sn.rim || RIM_U; syncDraftRes(); }
        p.organic = sn.organic;
        p.anim = sn.anim;
        if (sn.palette) p.palette = sn.palette;
    }
    function undo() {
        const h = H();
        if (!h.u.length) return;
        h.r.push(snap());
        restoreSnap(h.u.pop());
        applyLive();
        render();
    }
    function redo() {
        const h = H();
        if (!h.r.length) return;
        h.u.push(snap());
        restoreSnap(h.r.pop());
        applyLive();
        render();
    }
    function toggleCompare() {
        if (state.compare) { applyLive(); render(); return; }
        const bz = document.getElementById('vf-bezel');
        if (bz) clearApplyInline(bz);
        state.compare = true;
        render();
    }
    function randomizeStyle() {
        pushHist();
        const o = org();
        (STYLES[state.pack.id] || STYLES.voidborn).defs.forEach(function (d) {
            o[d[0]] = d[2] + Math.round(Math.random() * (d[3] - d[2]));
        });
        o.seed = 1 + Math.floor(Math.random() * 9998);
        generateOrganic(state.pack.cells, o, 'full');
        applyLive();
        render();
    }
    function exportJson() {
        const p = state.pack;
        download(p.id + '-bezel.json', JSON.stringify({
            id: p.id, slice: p.slice, grid: p.grid, liveMs: p.liveMs, palette: p.palette,
            organic: p.organic, anim: p.anim, cells: cellsToJson(p.cells)
        }), 'application/json');
    }
    function importJson(file) {
        if (!file) return;
        const rd = new FileReader();
        rd.onload = function () {
            try {
                const raw = JSON.parse(String(rd.result));
                const p = state.pack;
                pushHist();
                if (raw.organic) p.organic = Object.assign(defaultOrganic(p.id), raw.organic);
                if (raw.anim) {
                    const da = defaultAnim(p.id);
                    p.anim = Object.assign(da, raw.anim);
                    p.anim.moves = Object.assign(da.moves, raw.anim.moves || {});
                }
                if (raw.palette) p.palette = raw.palette;
                if (raw.cells && inferGrid(raw.cells, 0) === p.grid) p.cells = jsonToCells(raw.cells, p.grid);
                else generateOrganic(p.cells, p.organic, 'full');
                applyLive();
                state.saveMsg = 'Imported ' + file.name;
            } catch (err) { state.saveMsg = 'Import failed: ' + err.message; }
            render();
        };
        rd.readAsText(file);
    }

    function saveBezel() {
        const p = state.pack;
        if (!p) return;
        applyPackArt(p);
        saveDraft(p);
        setSaved(p.id, true);
        state.saveMsg = 'Saved ' + p.id.toUpperCase() + ' · ' + p.grid + '² / slice ' + p.slice;
    }

    // Re-apply the saved bezel of the faction currently shown (boot + faction change).
    function applySavedForCurrent() {
        const fac = factionOf();
        if (loadSaved()[fac] && loadDrafts()[fac]) applyPackArt(loadPack(fac));
        else {
            const bz = document.getElementById('vf-bezel');
            if (bz && bz.style.getPropertyValue('--fr-art')) clearApplyInline(bz);
            releasePending();
        }
    }
    // Everything a custom bezel overrides: art, slice, timing, the header strip and the band fill underneath.
    // Bezel thickness is layout: the opening (and so the whole stage) follows it. Lives on <html>, per faction.
    function applyRimVars(rim) {
        const root = document.documentElement;
        const v = Number(rim);
        const key = (v >= 20 && v !== RIM_U) ? String(v) : '';
        if (state.rimApplied === key) return;
        state.rimApplied = key;
        if (key) {
            root.style.setProperty('--fr-rim', key);
            root.style.setProperty('--fr-open-side', 'calc(' + key + ' * var(--bz-u))');
            root.style.setProperty('--fr-open-bottom', 'calc(' + key + ' * var(--bz-u))');
        } else {
            ['--fr-rim', '--fr-open-side', '--fr-open-bottom'].forEach(function (n) { root.style.removeProperty(n); });
        }
        window.dispatchEvent(new Event('resize'));   // the game re-reads the opening on resize
    }
    function clearBezelVars(bz) {
        applyRimVars(null);
        ['--fr-art', '--fr-slice', '--fr-live-dur', '--fr-topstrip', '--fr-band-fill', '--fr-art-fallback'].forEach(function (n) { bz.style.removeProperty(n); });
    }
    function clearApplyInline(bz) {
        bumpApply();
        revokeAnim();
        clearBezelVars(bz);
    }
    function setPreview(f) {
        const bz = document.getElementById('vf-bezel');
        if (window.vfFitScope && window.vfFitScope.setPreviewFaction) window.vfFitScope.setPreviewFaction(f);
        else if (bz) bz.setAttribute('data-faction', f);
    }
    // Faction on the bezel changed (preview, profile load, boot): keep editor + saved art in step.
    function onFactionAttr() {
        applySavedForCurrent();
        if (!state.open) return;
        const f = factionOf();
        if (state.pack && state.pack.id !== f) {
            state.pack = loadPack(f);
            state.fac = f;
            syncDraftRes();
            render();
        }
    }
    let watchedEl = null, watchObs = null;
    function bindSavedWatch() {
        const bz = document.getElementById('vf-bezel');
        if (!bz || bz === watchedEl) return;
        watchedEl = bz;
        if (watchObs) watchObs.disconnect();
        watchObs = new MutationObserver(onFactionAttr);
        watchObs.observe(bz, { attributes: true, attributeFilter: ['data-faction'] });
        applySavedForCurrent();
    }
    // The game may create / replace #vf-bezel after this script ran: keep checking.
    setInterval(bindSavedWatch, 1000);

    function clearApply() {
        bumpApply();
        revokeAnim();
        const bz = document.getElementById('vf-bezel');
        if (bz) {
            clearBezelVars(bz);
        }
        if (state.blobUrl) { URL.revokeObjectURL(state.blobUrl); state.blobUrl = null; }
        if (state.topUrl) { URL.revokeObjectURL(state.topUrl); state.topUrl = null; }
    }

    function mergeFluxIntoRegion(dataUrl) {
        return new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () {
                const g = G();
                const c = document.createElement('canvas');
                c.width = g; c.height = g;
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, g, g);
                const data = ctx.getImageData(0, 0, g, g).data;
                const pal = state.pack.palette;
                const tones = [1, 2, 3, 4, 5, 6, 7, 8].map(function (t) {
                    const hex = (pal[t] || '#000').replace('#', '');
                    const n = parseInt(hex, 16);
                    return { t: t, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                });
                for (let i = 0; i < g * g; i++) {
                    const x = i % g, y = (i / g) | 0;
                    if (!inRegion(x, y, state.region)) continue;
                    const o = i * 4;
                    const r = data[o], gv = data[o + 1], b = data[o + 2], a = data[o + 3];
                    if (a < 40 || (r > 200 && gv < 40 && b > 200)) {
                        state.pack.cells[i] = 0;
                        continue;
                    }
                    let best = 2, bd = Infinity;
                    for (let k = 0; k < tones.length; k++) {
                        const dd = (r - tones[k].r) ** 2 + (gv - tones[k].g) ** 2 + (b - tones[k].b) ** 2;
                        if (dd < bd) { bd = dd; best = tones[k].t; }
                    }
                    state.pack.cells[i] = best;
                }
                resolve();
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    async function fluxGenerate() {
        state.fluxBusy = true;
        state.fluxStatus = 'Generating…';
        render();
        try {
            if (typeof assetGenClient === 'undefined' || !assetGenClient.generate) {
                throw new Error('assetGenClient missing — run npm run assets');
            }
            const promptEl = document.querySelector('#vf-bezel-editor [data-bz="fluxPrompt"]');
            const prompt = (promptEl && promptEl.value) || '';
            const tok = TOKENS[state.pack.id] || TOKENS.terran;
            const g = G();
            const part = state.region === 'topstrip' ? 'topstrip'
                : (state.region === 'tl' || state.region === 'tr' || state.region === 'bl' || state.region === 'br') ? 'corner'
                    : (state.region === 'top' || state.region === 'bottom' || state.region === 'left' || state.region === 'right') ? 'edge'
                        : (state.fluxPart || 'full');
            const entry = {
                type: 'bezel', id: state.pack.id, faction: state.pack.id, kind: part,
                size: g, filenamePrefix: 'ui/vf_bezel_' + state.pack.id, promptSuffix: prompt
            };
            const res = await assetGenClient.generate(entry, {
                mode: 'bezel', faction: state.pack.id, part: part, prompt: prompt,
                palette: { hull: tok.hull, lit: tok.lit, dark: tok.dark, accent: tok.accent },
                size: g, genSize: Math.max(512, g * 2), steps: 8, prependStyle: false,
                filenamePrefix: 'ui/vf_bezel_' + state.pack.id
            });
            state.fluxPreview = res.previewDataUrl || '';
            state.fluxStagingId = res.stagingId || '';
            state.fluxStatus = 'Ready — Merge → ' + state.region.toUpperCase();
            state._fluxCellsHint = res.cells || null;
        } catch (err) {
            state.fluxStatus = String(err && err.message ? err.message : err);
        }
        state.fluxBusy = false;
        render();
    }

    async function fluxMerge() {
        if (!state.fluxPreview && !state._fluxCellsHint) {
            state.fluxStatus = 'Generate first.';
            render();
            return;
        }
        state.fluxBusy = true;
        state.fluxStatus = 'Merging into ' + state.region + '…';
        render();
        try {
            const g = G();
            if (state._fluxCellsHint && state._fluxCellsHint.length === g * g && state.region === 'full') {
                state.pack.cells = jsonToCells(state._fluxCellsHint, g);
            } else if (state.fluxPreview) {
                await mergeFluxIntoRegion(state.fluxPreview);
            }
            applyLive();
            state.fluxStatus = 'Merged into ' + state.region.toUpperCase();
            state.tab = 'tile';
        } catch (err) {
            state.fluxStatus = String(err && err.message ? err.message : err);
        }
        state.fluxBusy = false;
        render();
    }

    const CELL_U = RIM_U / DEF_SLICE;   // 1.75 rim-units per art cell keeps the pixel size constant
    function rimRowHtml(p) {
        const v = p.rim || RIM_U;
        return '<div class="vf-bz-ed-row"><span>SIDE THICKNESS</span><input type="range" data-bz-rim="1" min="28" max="112" step="2" value="' + v + '">' +
            '<output data-rim-out>' + v + 'u · ' + p.slice + ' cells</output></div>';
    }
    function thicknessCells(rim) {
        const sl = Math.max(12, Math.round(rim / CELL_U));
        let gr = Math.min(510, sl * 6);
        if (gr % 2) gr += 1;
        return { slice: sl, grid: gr };
    }
    function refreshCanvasesLabelOnly() {
        const pl = document.getElementById('vf-bezel-editor');
        if (!pl || !state.pack) return;
        const c = thicknessCells(state.pack.rim || RIM_U);
        pl.querySelectorAll('[data-rim-out]').forEach(function (o) { o.textContent = (state.pack.rim || RIM_U) + 'u · ' + c.slice + ' cells'; });
    }
    function refreshCanvases() {
        const pl = document.getElementById('vf-bezel-editor');
        if (!pl || !state.pack) return;
        const g = G();
        pl.querySelectorAll('[data-bz-canvas],[data-bz-preview]').forEach(function (c) { c.width = g; c.height = g; paintCanvas(c); });
        const mini = pl.querySelector('[data-bz-mini]'); if (mini) paintMini(mini);
        pl.querySelectorAll('[data-rim-out]').forEach(function (o) { o.textContent = (state.pack.rim || RIM_U) + 'u · ' + state.pack.slice + ' cells'; });
    }
    // Thickness = a new art size (slice cells) at the SAME pixel size, rebuilt procedurally so the corners fit.
    function applyThickness() {
        const p = state.pack;
        if (!p) return;
        const c = thicknessCells(p.rim || RIM_U);
        if (c.slice !== p.slice || c.grid !== p.grid) applyResolution(c.slice, c.grid);
        generateOrganic(p.cells, p.organic || defaultOrganic(p.id), 'full');
        refreshCanvases();
        applyLive();
    }

    function emblemHtml(f) {
        try {
            if (typeof iconRenderer !== 'undefined' && typeof factionShipStyles !== 'undefined' && iconRenderer.imgHtml) {
                const key = factionShipStyles.emblemCamelKey(f) + '@2x';
                const html = iconRenderer.imgHtml(key, 24, 'vf-bz-ed-emblem', TOKENS[f].accent, f);
                if (html) return html;
            }
        } catch (e) { /* fall back to the name */ }
        return f.toUpperCase();
    }

    function switchFaction(f) {
        if (!state.pack || state.pack.id === f) return;
        saveDraft(state.pack);
        state.pack = loadPack(f);
        state.fac = f;
        state.saveMsg = '';
        syncDraftRes();
        setPreview(f);
        render();
    }

    function onClick(e) {
        const t = e.target.closest('[data-bz],[data-bz-fac],[data-bz-tab],[data-bz-tone],[data-bz-region]');
        if (!t) return;
        if (t.dataset.bz === 'close') { hide(); return; }
        if (t.dataset.bz === 'maxToggle') { state.max = !state.max; render(); return; }
        if (t.dataset.bzFac) { switchFaction(t.dataset.bzFac); return; }
        if (t.dataset.bzTab) { state.tab = t.dataset.bzTab; render(); return; }
        if (t.dataset.bzTone != null) { state.tone = Number(t.dataset.bzTone) || 0; render(); return; }
        if (t.dataset.bzRegion) { state.region = t.dataset.bzRegion; render(); return; }
        const act = t.dataset.bz;
        if (act === 'applyRes') {
            applyResolution(state.draftSlice, state.draftGrid);
            applyLive();
            render();
        } else if (act === 'lockRatio') {
            state.draftGrid = Math.max(32, state.draftSlice * 6);
            pushHist();
            applyResolution(state.draftSlice, state.draftGrid);
            applyLive();
            render();
        } else if (act === 'toggleGrips') {
            toggleGrips();
            render();
        } else if (act === 'resetFrame') {
            const ns = fit();
            const fac = factionOf();
            if (ns && ns.vfs && ns.vfs.frameStyles && ns.vfs.frameStyles[fac]) {
                delete ns.vfs.frameStyles[fac].bgCrop;
                delete ns.vfs.frameStyles[fac].vineInset;
            }
            if (ns && typeof ns.saveFrameStyles === 'function') ns.saveFrameStyles();
            if (ns && typeof ns.applyFrameStyle === 'function') ns.applyFrameStyle();
            if (ns && typeof ns.renderFrameEditGrips === 'function') ns.renderFrameEditGrips();
            render();
        } else if (act === 'undo') { undo(); }
        else if (act === 'redo') { redo(); }
        else if (act === 'compare') { toggleCompare(); }
        else if (act === 'randomize') { randomizeStyle(); }
        else if (act === 'rollSeed') {
            pushHist();
            org().seed = 1 + Math.floor(Math.random() * 9998);
            generateOrganic(state.pack.cells, org(), state.region);
            applyLive();
            render();
        }
        else if (act === 'resetStyle') {
            pushHist();
            state.pack.organic = defaultOrganic(state.pack.id);
            generateOrganic(state.pack.cells, state.pack.organic, 'full');
            applyLive();
            render();
        }
        else if (act === 'exportJson') { exportJson(); }
        else if (act === 'fillRegion') { pushHist(); bandFill(state.pack.cells, state.tone || 2, state.region); applyLive(); render(); }
        else if (act === 'clearRegion') { pushHist(); clearRegion(state.pack.cells, state.region); applyLive(); render(); }
        else if (act === 'organicRegion') {
            pushHist();
            generateOrganic(state.pack.cells, org(), state.region);
            applyLive();
            render();
        } else if (act === 'organicFull') {
            pushHist();
            generateOrganic(state.pack.cells, org(), 'full');
            applyLive();
            render();
        } else if (act === 'apply') { applyLive(); render(); }
        else if (act === 'clearApply') { clearApply(); if (state.pack) setSaved(state.pack.id, false); state.fluxStatus = 'Override cleared.'; render(); }
        else if (act === 'animToggle') {
            const an = state.pack.anim || (state.pack.anim = defaultAnim(state.pack.id));
            an.on = !an.on;
            applyLive();
            render();
        }
        else if (act === 'saveBezel') { saveBezel(); render(); }
        else if (act === 'saveDraft') { saveDraft(state.pack); state.fluxStatus = 'Draft saved.'; render(); }
        else if (act === 'dlSvg') download(state.pack.id + '-bezel-art.svg', gridToSvg(state.pack.cells, state.pack.palette, G()));
        else if (act === 'resetPal') {
            pushHist();
            state.pack.palette = buildPalette(TOKENS[state.pack.id] || TOKENS.terran);
            applyLive();
            render();
        } else if (act === 'pushFrame') {
            if (state.pack.frames.length < 8) state.pack.frames.push(state.pack.cells.slice());
            render();
        } else if (act === 'popFrame') { state.pack.frames.pop(); render(); }
        else if (act === 'fluxGen') fluxGenerate();
        else if (act === 'fluxMerge') fluxMerge();
    }

    function onInput(e) {
        const el = e.target;
        if (el.dataset.bz === 'resPreset' && el.value) {
            const parts = el.value.split('/');
            state.draftSlice = Number(parts[0]) || DEF_SLICE;
            state.draftGrid = Number(parts[1]) || DEF_GRID;
            pushHist();
            applyResolution(state.draftSlice, state.draftGrid);
            applyLive();
            render();
            return;
        }
        if (el.dataset.bz === 'draftSlice') {
            state.draftSlice = Math.max(8, Math.min(128, Number(el.value) || DEF_SLICE));
            if (e.type === 'change') { pushHist(); applyResolution(state.draftSlice, state.draftGrid); applyLive(); render(); }
            return;
        }
        if (el.dataset.bz === 'draftGrid') {
            state.draftGrid = Math.max(32, Math.min(512, Number(el.value) || DEF_GRID));
            if (e.type === 'change') { pushHist(); applyResolution(state.draftSlice, state.draftGrid); applyLive(); render(); }
            return;
        }
        if (el.dataset.bzFr) {
            const key = el.dataset.bzFr;
            let v = Number(el.value);
            if (key === 'bgCrop') v = Math.round(v / 5) * 5;
            setFrame(key, v);
            const out = el.parentElement && el.parentElement.querySelector('output');
            if (out) out.textContent = String(v);
            return;
        }
        if (el.dataset.bz === 'liveMs') state.pack.liveMs = Math.max(1000, Number(el.value) || 60000);
        if (el.dataset.bz === 'fluxPart') { state.fluxPart = el.value; saveUi(); }
        if (el.dataset.bz === 'brush') {
            state.brush = Math.max(1, Math.min(8, Number(el.value) || 1));
            saveUi();
            const out = el.parentElement && el.parentElement.querySelector('output');
            if (out) out.textContent = String(state.brush);
            return;
        }
        if (el.dataset.bz === 'importFile') { importJson(el.files && el.files[0]); el.value = ''; return; }
        if (el.dataset.bzRim) {
            pushHist(true);
            state.pack.rim = Number(el.value) || RIM_U;
            refreshCanvasesLabelOnly();
            clearTimeout(state.rimT);
            state.rimT = setTimeout(applyThickness, 220);
            return;
        }
        if (el.dataset.bzAnim) {
            pushHist(true);
            const an = state.pack.anim || (state.pack.anim = defaultAnim(state.pack.id));
            an[el.dataset.bzAnim] = Number(el.value) || 0;
            if (el.dataset.bzAnim === 'ms') an.ms = 12500 - an.ms; // slider runs right = faster
            if (el.dataset.bzAnim === 'ms') state.pack.liveMs = an.ms;
            an.on = true;
            const out = el.parentElement && el.parentElement.querySelector('output');
            if (out) out.textContent = String(an[el.dataset.bzAnim]);
            syncAnimUi();
            scheduleApply();
            return;
        }
        if (el.dataset.bzMove) {
            pushHist(true);
            const an = state.pack.anim || (state.pack.anim = defaultAnim(state.pack.id));
            an.moves[el.dataset.bzMove] = Number(el.value) || 0;
            an.on = true;
            scheduleApply();
            render();
            return;
        }
        if (el.dataset.bzOrg) {
            pushHist(true);
            const key = el.dataset.bzOrg;
            org()[key] = Number(el.value) || 0;
            const out = el.parentElement && el.parentElement.querySelector('output');
            if (out && key !== 'seed') out.textContent = String(org()[key]);
            if (!state.orgRaf) {
                state.orgRaf = requestAnimationFrame(function () {
                    state.orgRaf = 0;
                    generateOrganic(state.pack.cells, org(), state.region);
                    scheduleApply();
                    const cv = document.querySelector('#vf-bezel-editor [data-bz-canvas]');
                    if (cv) paintCanvas(cv);
                });
            }
            return;
        }
        if (el.dataset.bzPal) {
            pushHist(true);
            state.pack.palette[Number(el.dataset.bzPal)] = el.value;
            liveSoon();
            render();
        }
    }

    function persistOpen(on) {
        try { localStorage.setItem(OPEN_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    }
    function wantOpen() {
        try { return localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; }
    }

    function show() {
        state.open = true;
        persistOpen(true);
        // The editor follows the faction the player is actually in; a preview only lasts until the next refresh.
        state.fac = factionOf();
        state.pack = loadPack(factionOf());
        syncDraftRes();
        render();
        const plate = ensurePlate();
        if (!state.geom) state.geom = loadGeom();
        applyGeom(plate, state.geom);
    }
    function showTab(tab) {
        if (tab) state.tab = tab;
        show();
        if (tab === 'frame') {
            const ns = fit();
            if (ns && !ns.isFrameEditOn()) toggleGrips(true);
            else syncFrameBtn();
        }
    }
    function hide() {
        state.open = false;
        persistOpen(false);
        render();
    }
    function toggle() { if (state.open) hide(); else show(); }

    function tryRestore() {
        bindSavedWatch();
        if (!wantOpen() || state.open) return;
        if (!document.getElementById('vf-bezel')) return;
        show();
    }
    window.addEventListener('vf-bezel-tools-sync', tryRestore);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(tryRestore, 0); });
    } else {
        setTimeout(tryRestore, 0);
    }

    window.bezelEditorUI = {
        show: show,
        showTab: showTab,
        hide: hide,
        toggle: toggle,
        isOpen: function () { return state.open; }
    };
})();
