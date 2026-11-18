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

    function generateOrganic(cells, opts, region) {
        const amount = Math.max(0, Math.min(100, Number(opts.amount) || 70));
        const wave = Math.max(0, Math.min(20, Number(opts.wave) || 8));
        const buds = Math.max(0, Math.min(40, Number(opts.buds) || 16));
        const thorns = Math.max(0, Math.min(20, Number(opts.thorns) || 8));
        const seed = (Number(opts.seed) || 1) | 0;
        const pulse = 8, vein = 7;
        const reg = region || 'full';
        const s = S(), g = G();

        forRegion(reg, function (x, y) {
            const dOut = Math.min(x, y, g - 1 - x, g - 1 - y);
            const ang = Math.atan2(y - g / 2, x - g / 2);
            const scallop = (amount / 100) * (3 * Math.sin(ang * 5 + seed) + 2 * Math.sin(ang * 9 + seed * 0.7));
            const outerCut = Math.max(0, (vh(x >> 2, y >> 2, seed + 3) % 4) + (scallop | 0) / 2);
            if (dOut < outerCut) { cells[y * g + x] = 0; return; }
            const w = (wave / 8) * (4 * Math.sin((x + y) * 0.09 + seed) + 3 * Math.cos((x - y) * 0.07));
            let inner = s - 2 + (vh(x, y, seed + 5) % 5) - 2 + (w | 0) / 2;
            inner = Math.max(s >> 1, Math.min(s - 1, inner));
            if (dOut >= inner) { cells[y * g + x] = 0; return; }
            const depth = dOut - outerCut;
            let tone = 2;
            if (depth <= 1) tone = 1;
            else if (depth <= 3) tone = 4;
            else if (depth <= inner / 2) tone = 2;
            else if (depth <= inner - 3) tone = 5;
            else tone = 1;
            cells[y * g + x] = tone;
        });

        function strokeEdge(edge) {
            const amp = Math.max(2, (wave * amount) / 100);
            const pts = [];
            const period = 36 + (seed % 11);
            if (edge === 'top' || edge === 'bottom') {
                const y0 = edge === 'top' ? (s >> 1) : (g - 1 - (s >> 1));
                for (let x = 0; x < g; x += 2) {
                    if (!inRegion(x, y0, reg) && reg !== 'full') continue;
                    const wob = (amp * Math.sin(x / period * Math.PI * 2 + seed) +
                        (amp / 2) * Math.sin(x / (period * 0.37) * Math.PI * 2));
                    const y = edge === 'top'
                        ? Math.max(2, Math.min(s - 3, y0 + wob))
                        : Math.max(g - s + 2, Math.min(g - 3, y0 + wob));
                    pts.push([x, y | 0]);
                }
            } else {
                const x0 = edge === 'left' ? (s >> 1) : (g - 1 - (s >> 1));
                for (let y = 0; y < g; y += 2) {
                    if (!inRegion(x0, y, reg) && reg !== 'full') continue;
                    const wob = (amp * Math.sin(y / period * Math.PI * 2 + seed + 0.5) +
                        (amp / 2) * Math.cos(y / (period * 0.33) * Math.PI * 2));
                    const x = edge === 'left'
                        ? Math.max(2, Math.min(s - 3, x0 + wob))
                        : Math.max(g - s + 2, Math.min(g - 3, x0 + wob));
                    pts.push([x | 0, y]);
                }
            }
            for (let i = 0; i < pts.length - 1; i++) {
                const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
                const steps = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
                for (let st = 0; st <= steps; st++) {
                    const t = st / steps;
                    const x = Math.round(x0 + (x1 - x0) * t);
                    const y = Math.round(y0 + (y1 - y0) * t);
                    const th = Math.max(2, 4 + (vh(x, y, 11) % 4) - 1);
                    putDisk(cells, x, y, th, 1, reg);
                    putDisk(cells, x, y, Math.max(1, th >> 1), vein, reg);
                }
            }
        }

        if (reg === 'full' || reg === 'top' || reg === 'topstrip' || reg === 'tl' || reg === 'tr') strokeEdge('top');
        if (reg === 'full' || reg === 'bottom' || reg === 'bl' || reg === 'br') strokeEdge('bottom');
        if (reg === 'full' || reg === 'left' || reg === 'tl' || reg === 'bl') strokeEdge('left');
        if (reg === 'full' || reg === 'right' || reg === 'tr' || reg === 'br') strokeEdge('right');

        function tentacle(ox, oy, sx, sy) {
            if (reg !== 'full') {
                const r = regionRect(reg);
                if (ox < r.x0 - 2 || ox > r.x1 + 2 || oy < r.y0 - 2 || oy > r.y1 + 2) return;
            }
            for (let i = 0; i < 32; i++) {
                const t = i / 31;
                const x = Math.round(ox + sx * (3 + t * (s + 6)) + sy * 8 * Math.sin(t * Math.PI * 1.2));
                const y = Math.round(oy + sy * (3 + t * (s + 6)) + sx * 8 * Math.sin(t * Math.PI * 0.9));
                if (!inRegion(x, y, reg) && reg !== 'full') continue;
                putDisk(cells, x, y, 5, 1, reg);
                putDisk(cells, x, y, 3, pulse, reg);
                if (i === 16) putDisk(cells, x, y, 4, 8, reg);
            }
        }
        if (amount > 20) {
            if (reg === 'full' || reg === 'tl') tentacle(0, 0, 1, 1);
            if (reg === 'full' || reg === 'tr') tentacle(g - 1, 0, -1, 1);
            if (reg === 'full' || reg === 'bl') tentacle(0, g - 1, 1, -1);
            if (reg === 'full' || reg === 'br') tentacle(g - 1, g - 1, -1, -1);
        }

        for (let i = 0; i < buds; i++) {
            const side = vh(i, seed, 31) % 4;
            let bx, by;
            if (side === 0) { bx = s + vh(i, seed, 30) % Math.max(1, g - 2 * s); by = 3 + vh(i, seed, 32) % Math.max(1, s - 6); }
            else if (side === 1) { bx = s + vh(i, seed, 30) % Math.max(1, g - 2 * s); by = g - s + 3 + vh(i, seed, 32) % Math.max(1, s - 6); }
            else if (side === 2) { by = s + vh(i, seed, 33) % Math.max(1, g - 2 * s); bx = 3 + vh(i, seed, 34) % Math.max(1, s - 6); }
            else { by = s + vh(i, seed, 33) % Math.max(1, g - 2 * s); bx = g - s + 3 + vh(i, seed, 34) % Math.max(1, s - 6); }
            if (!inRegion(bx, by, reg)) continue;
            putDisk(cells, bx, by, 2 + (i % 3), (i % 2) ? pulse : 5, reg);
            if (i % 3 === 0) putDisk(cells, bx, by, 1, 8, reg);
        }

        for (let i = 0; i < thorns; i++) {
            const along = s + 10 + i * Math.floor(Math.max(1, g - 2 * s - 20) / Math.max(1, thorns));
            const edge = i % 4;
            for (let j = 0; j < 6; j++) {
                let x = along, y = along;
                if (edge === 0) { x = along; y = (s >> 1) + j; }
                else if (edge === 1) { x = along; y = g - 1 - (s >> 1) - j; }
                else if (edge === 2) { y = along; x = (s >> 1) + j; }
                else { y = along; x = g - 1 - (s >> 1) - j; }
                if (!inRegion(x, y, reg)) continue;
                cells[y * g + x] = j > 3 ? pulse : 1;
            }
        }

        forRegion(reg, function (x, y) {
            const t = cells[y * g + x];
            if (!t) return;
            const h = vh(x, y, seed + 7);
            if (h < 5 && (t === 2 || t === 5)) cells[y * g + x] = vein;
            else if (h > 95 && (t === 2 || t === 4 || t === 5)) cells[y * g + x] = 1;
        });
    }

    function defaultOrganic(id) {
        return {
            amount: id === 'voidborn' ? 85 : 55,
            wave: id === 'voidborn' ? 10 : 5,
            buds: id === 'voidborn' ? 20 : 8,
            thorns: id === 'voidborn' ? 10 : 4,
            seed: 1
        };
    }

    function defaultPack(id, slice, grid) {
        const res = clampRes(slice || DEF_SLICE, grid || DEF_GRID);
        const tok = TOKENS[id] || TOKENS.terran;
        const prev = state.pack;
        state.pack = { id: id, slice: res.slice, grid: res.grid, cells: emptyCells(res.grid), palette: buildPalette(tok), frames: [], liveMs: 60000, organic: defaultOrganic(id) };
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
            cells: cellsToJson(pack.cells),
            frames: (pack.frames || []).map(cellsToJson),
            palette: pack.palette,
            organic: pack.organic || defaultOrganic(pack.id)
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

    function gridToSvg(cells, palette, n) {
        n = n || G();
        const byTone = {};
        for (let y = 0; y < n; y++) {
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
        return "<svg xmlns='http://www.w3.org/2000/svg' width='" + n + "' height='" + n +
            "' viewBox='0 0 " + n + " " + n + "' shape-rendering='crispEdges'>" + body + '</svg>';
    }

    function download(name, text) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
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
        plate.addEventListener('dblclick', function (e) {
            if (!(e.target.closest && e.target.closest('.vf-bz-ed-head'))) return;
            if (e.target.closest('button')) return;
            state.geom = null;
            try { localStorage.removeItem(GEOM_KEY); } catch (err) { /* ignore */ }
            applyGeom(plate, null);
        });
        window.addEventListener('pointerup', function () { state.painting = false; });
        window.addEventListener('resize', function () {
            if (state.geom) applyGeom(plate, state.geom);
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
            ['organic', 'ORGANIC'],
            ['live', 'LIVE'],
            ['flux', 'FLUX'],
            ['export', 'EXPORT']
        ];
        let h = '<div class="vf-bz-ed-head" title="Drag to move · double-click to reset">' +
            '<strong>BEZEL EDITOR</strong>' +
            '<button type="button" data-bz="close" title="Close">✕</button></div>';
        h += '<div class="vf-bz-ed-tabs">' + tabs.map(function (t) {
            return '<button type="button" data-bz-tab="' + t[0] + '"' +
                (state.tab === t[0] ? ' class="is-on"' : '') + '>' + t[1] + '</button>';
        }).join('') + '</div><div class="vf-bz-ed-body">';

        if (state.tab === 'tile' || state.tab === 'organic' || state.tab === 'flux') {
            h += '<div class="vf-bz-ed-regions">' + REGIONS.map(function (r) {
                return '<button type="button" data-bz-region="' + r[0] + '" class="vf-bz-ed-region' +
                    (state.region === r[0] ? ' is-on' : '') + '">' + r[1] + '</button>';
            }).join('') + '</div>';
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
                '<div class="vf-bz-ed-row"><span>FACTION</span><select data-bz="fac">' +
                FACTIONS.map(function (f) {
                    return '<option value="' + f + '"' + (p.id === f ? ' selected' : '') + '>' + f.toUpperCase() + '</option>';
                }).join('') + '</select></div>' +
                '<p class="vf-bz-ed-note">SET RESOLUTION scales the tile (nearest). APPLY LIVE pushes slice + art to the bezel.</p>';
        } else if (state.tab === 'frame') {
            const gripsOn = !!(window.vfFitScope && window.vfFitScope.isFrameEditOn && window.vfFitScope.isFrameEditOn());
            const fill = frameVal('bgCrop', 50);
            const vine = frameVal('vineInset', 2);
            h += '<div class="vf-bz-ed-row"><span>GRIPS</span>' +
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
            h += '<div class="vf-bz-ed-row"><span>AMOUNT</span><input type="range" data-bz-org="amount" min="0" max="100" value="' + o.amount + '"><output>' + o.amount + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>WAVE</span><input type="range" data-bz-org="wave" min="0" max="20" value="' + o.wave + '"><output>' + o.wave + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>BUDS</span><input type="range" data-bz-org="buds" min="0" max="40" value="' + o.buds + '"><output>' + o.buds + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>THORNS</span><input type="range" data-bz-org="thorns" min="0" max="20" value="' + o.thorns + '"><output>' + o.thorns + '</output></div>' +
                '<div class="vf-bz-ed-row"><span>SEED</span><input type="number" data-bz-org="seed" min="0" max="9999" value="' + o.seed + '"></div>' +
                '<canvas class="vf-bz-ed-canvas" width="' + g + '" height="' + g + '" data-bz-canvas="1"></canvas>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="organicRegion">GROW IN REGION</button>' +
                '<button type="button" data-bz="organicFull">GROW FULL</button>' +
                '<button type="button" data-bz="apply">APPLY LIVE</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">Organic @ ' + g + '² / slice ' + s + '</p>';
        } else if (state.tab === 'live') {
            h += '<div class="vf-bz-ed-row"><span>FRAMES</span><output>' + (p.frames.length) + ' / 8</output></div>' +
                '<div class="vf-bz-ed-row"><span>LIVE MS</span><input type="number" data-bz="liveMs" min="1000" step="500" value="' + p.liveMs + '"></div>' +
                '<div class="vf-bz-ed-actions">' +
                '<button type="button" data-bz="pushFrame">PUSH FRAME</button>' +
                '<button type="button" data-bz="popFrame">POP FRAME</button>' +
                '<button type="button" data-bz="apply">APPLY LIVE</button>' +
                '</div>';
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
                '<button type="button" data-bz="apply">APPLY LIVE</button>' +
                '<button type="button" data-bz="clearApply">CLEAR OVERRIDE</button>' +
                '</div>' +
                '<p class="vf-bz-ed-note">SVG ' + g + '² · slice ' + s + ' · drafts in localStorage.</p>';
        }
        h += '</div>';
        plate.innerHTML = h;
        const canvas = plate.querySelector('[data-bz-canvas]');
        if (canvas) paintCanvas(canvas);
    }

    function paintCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const p = state.pack;
        const g = G(), s = S();
        const img = ctx.createImageData(g, g);
        const d = img.data;
        const r = regionRect(state.region);
        for (let i = 0; i < p.cells.length; i++) {
            const t = p.cells[i];
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
    }

    function onPaintDown(e) {
        const canvas = e.target.closest && e.target.closest('[data-bz-canvas]');
        if (!canvas) return;
        state.painting = true;
        canvas.setPointerCapture(e.pointerId);
        paintAt(canvas, e);
        e.preventDefault();
    }

    function onPaintMove(e) {
        if (!state.painting) return;
        const canvas = e.target.closest && e.target.closest('[data-bz-canvas]');
        if (!canvas) return;
        paintAt(canvas, e);
    }

    function applyLive() {
        const p = state.pack;
        if (!p) return;
        const svg = gridToSvg(p.cells, p.palette, p.grid);
        if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
        state.blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const bz = document.getElementById('vf-bezel');
        if (bz) {
            bz.style.setProperty('--fr-art', 'url("' + state.blobUrl + '")');
            bz.style.setProperty('--fr-slice', String(p.slice));
            if (p.liveMs) bz.style.setProperty('--fr-live-dur', p.liveMs + 'ms');
        }
        saveDraft(p);
        state.fluxStatus = 'Applied live · ' + p.grid + '² slice ' + p.slice;
    }

    function clearApply() {
        const bz = document.getElementById('vf-bezel');
        if (bz) {
            bz.style.removeProperty('--fr-art');
            bz.style.removeProperty('--fr-slice');
            bz.style.removeProperty('--fr-live-dur');
        }
        if (state.blobUrl) { URL.revokeObjectURL(state.blobUrl); state.blobUrl = null; }
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
            saveDraft(state.pack);
            state.fluxStatus = 'Merged into ' + state.region.toUpperCase();
            state.tab = 'tile';
        } catch (err) {
            state.fluxStatus = String(err && err.message ? err.message : err);
        }
        state.fluxBusy = false;
        render();
    }

    function onClick(e) {
        const t = e.target.closest('[data-bz],[data-bz-tab],[data-bz-tone],[data-bz-region]');
        if (!t) return;
        if (t.dataset.bz === 'close') { hide(); return; }
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
        } else if (act === 'fillRegion') { bandFill(state.pack.cells, state.tone || 2, state.region); render(); }
        else if (act === 'clearRegion') { clearRegion(state.pack.cells, state.region); render(); }
        else if (act === 'organicRegion') {
            generateOrganic(state.pack.cells, org(), state.region);
            saveDraft(state.pack);
            render();
        } else if (act === 'organicFull') {
            generateOrganic(state.pack.cells, org(), 'full');
            saveDraft(state.pack);
            render();
        } else if (act === 'apply') { applyLive(); render(); }
        else if (act === 'clearApply') { clearApply(); state.fluxStatus = 'Override cleared.'; render(); }
        else if (act === 'saveDraft') { saveDraft(state.pack); state.fluxStatus = 'Draft saved.'; render(); }
        else if (act === 'dlSvg') download(state.pack.id + '-bezel-art.svg', gridToSvg(state.pack.cells, state.pack.palette, G()));
        else if (act === 'resetPal') {
            state.pack.palette = buildPalette(TOKENS[state.pack.id] || TOKENS.terran);
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
        if (el.dataset.bz === 'fac') {
            saveDraft(state.pack);
            state.pack = loadPack(el.value);
            syncDraftRes();
            const bz = document.getElementById('vf-bezel');
            if (bz && window.vfFitScope && window.vfFitScope.setPreviewFaction) window.vfFitScope.setPreviewFaction(el.value);
            else if (bz) bz.setAttribute('data-faction', el.value);
            render();
            return;
        }
        if (el.dataset.bz === 'resPreset' && el.value) {
            const parts = el.value.split('/');
            state.draftSlice = Number(parts[0]) || DEF_SLICE;
            state.draftGrid = Number(parts[1]) || DEF_GRID;
            render();
            return;
        }
        if (el.dataset.bz === 'draftSlice') {
            state.draftSlice = Math.max(8, Math.min(128, Number(el.value) || DEF_SLICE));
            return;
        }
        if (el.dataset.bz === 'draftGrid') {
            state.draftGrid = Math.max(32, Math.min(512, Number(el.value) || DEF_GRID));
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
        if (el.dataset.bz === 'fluxPart') state.fluxPart = el.value;
        if (el.dataset.bz === 'brush') {
            state.brush = Math.max(1, Math.min(8, Number(el.value) || 1));
            const out = el.parentElement && el.parentElement.querySelector('output');
            if (out) out.textContent = String(state.brush);
            return;
        }
        if (el.dataset.bzOrg) {
            const key = el.dataset.bzOrg;
            org()[key] = Number(el.value) || 0;
            const out = el.parentElement && el.parentElement.querySelector('output');
            if (out && key !== 'seed') out.textContent = String(org()[key]);
            return;
        }
        if (el.dataset.bzPal) {
            state.pack.palette[Number(el.dataset.bzPal)] = el.value;
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
