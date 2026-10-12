"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    /**
     * Faction base art, left half only (mirrored at draw time). Pixel keys
     * are the gm-base-* depths: k d m l (dark → light), w windows, c glowing
     * core, a blinking lamps. Each faction gets its own silhouette.
     */
    BASE_FORTRESS_ART: {
        terran: [ // Citadel: radar dish, watchtower, tiered keep, spire.
            '.......................a',
            '.......................l',
            '......................lm',
            '......................lm',
            '.....................llm',
            '....................lmwm',
            '....................lmmm',
            '..lll..........a...lllll',
            '.l...l.........m...mwmwm',
            'l..d..l.......lmd..mmmmm',
            '...d..........lmd.llllll',
            '..lmd.........lwd.mwmmwm',
            '..lmd.........lmd.mmmmmm',
            '..lmd.....llllllllllllll',
            '..lwd.....mmwmmwmmwmmwmm',
            '.llmdd....mmmmmmmmmmmmmm',
            '.lmmmd....mmwmmwmmwmmccc',
            '.lmwmd....dddddmmmmmmccc',
            'llllllllllllllllllllllll',
            'mmkkkkmmmmkkkkmmmmkkkkmm',
            'mmmmmmmmmmmmmmmmmmmmmmmm',
            '.ddddddddddddddddddddddd'
        ],
        kronax: [ // War hold: horns sweeping into a chevron, clawed legs.
            'a.......................',
            'ml......................',
            'mml.....................',
            'dmml....................',
            '.dmml.................a.',
            '..dmml................l.',
            '...dmml..............lm.',
            '....dmml............lmm.',
            '.....dmml..........lmmm.',
            '......dmmllllllllllmmmm.',
            '.......dmmmmmmmmmmmmwwmm',
            '.......dmmwmmwmmmmmmmmmc',
            '......ddmmmmmmmmkmmmmmcc',
            '.....dddmmkmmmmkkmmmmccc',
            '....llllllllllllllllllll',
            '...lmmmmdmmmmmmdmmmmmmmm',
            '...ddddd.ddddddd.ddddddd',
            '..ddd.....ddd......ddd..',
            '.dd.......dd........dd..'
        ],
        voidborn: [ // Sanctum: glowing eye-orb cradled by crescent arms.
            '.......................a',
            '.......................l',
            '.......................l',
            '..................llllll',
            '...............lllmmmmmm',
            '.......d......lmmmmwwmmm',
            '......dm.....lmmmwwmmmmm',
            '.....dm.....lmmmwmmmmccc',
            '....dm......lmmmmmmmcccc',
            '...dm.......lmmmmmmmcccc',
            '...dm.......dmmmmmmmmccc',
            '...dm........dmmmmmmmmmm',
            '...dml........ddmmmmmmmm',
            '....dml.........dddddddd',
            '.....dmll...............',
            '......dmmlllllllllllllll',
            '.......ddmmmmkmmmmmkmmmm',
            '.........dddmmmmmmmmmmmm',
            '............dddddddddddd'
        ],
        pirate: [ // Haven: banner mast, patched shacks, stilt pylons.
            '...a....................',
            '...l.lllllll............',
            '...l.lwlllwl............',
            '...l.llwwwll............',
            '...l.lllllll............',
            '...l.l..................',
            '..lml.l.........aa......',
            '..lml.l........lmmd.....',
            '.lmmml.l.......lwmd.....',
            '.lmwmml.l.....lmmmmd...l',
            'lmmmmmlll.....lmwmmd..lm',
            'lmwmmmmmmllllllmmmmmdlmm',
            'llllllllllllllllllllllll',
            '.mkmmkmmmkmmmmkmmmmmkmcc',
            '..dddddddddddddddddddddd',
            '...dd.......dd.......dd.',
            '...dd.......dd.......dd.'
        ],
        machine: [ // Foundry: twin smokestacks, core vents, toothed base.
            '....a..........a........',
            '....m..........m........',
            '...lmd........lmd.......',
            '...lmd........lmd.......',
            '...lwd........lwd.......',
            '...lmd..l..l..lmd..l..ll',
            '...lmd.llllllllmdlllllll',
            '..llllllmmmmmmmmmmmmmmmm',
            '..lmwmwmkkkkkkkkkkkkkkkk',
            '..lmmmmmkcckcckcckcckcck',
            '..lmwmwmkkkkkkkkkkkkkkkk',
            '..lmmmmmmmmmwmmmwmmmwmmm',
            'llllllllllllllllllllllll',
            'mdmdmdmdmdmdmdmdmdmdmdmd',
            'dddddddddddddddddddddddd',
            '.kk....kk....kk....kk...'
        ]
    },
    /**
     * Faction base on its planet: the ruling faction's pixel silhouette in
     * five depths of its colour, with lit windows, a glowing core and
     * blinking lamps. About 30 % of the planet's width, centred so the
     * animated planet stays visible around it.
     */
    baseFortressSvg(size, factionId) {
        const fid = typeof factionShipStyles !== 'undefined' && factionShipStyles.normalizeFaction
            ? factionShipStyles.normalizeFaction(factionId) : factionId;
        const half = this.BASE_FORTRESS_ART[fid] || this.BASE_FORTRESS_ART.terran;
        const rows = half.map((r) => r + r.split('').reverse().join(''));
        const w = rows[0].length;
        const h = rows.length;
        const cell = size * 0.3 / w;
        const at = (x, y) => (rows[y] && rows[y][x]) || '.';
        const rect = (x, y, rw, c) => `<rect x="${x}" y="${y}" width="${rw}" height="1" class="gm-base-${c}"/>`;
        let outline = '';
        let body = '';
        // Dark outline: every empty cell touching the art (8-neighbourhood),
        // merged into horizontal runs.
        for (let y = -1; y <= h; y++) {
            let run = -1;
            for (let x = -1; x <= w + 1; x++) {
                let edge = false;
                if (x <= w && at(x, y) === '.') {
                    for (let dy = -1; dy <= 1 && !edge; dy++) {
                        for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) !== '.') { edge = true; break; }
                    }
                }
                if (edge && run < 0) run = x;
                if (!edge && run >= 0) { outline += rect(run, y, x - run, 'o'); run = -1; }
            }
        }
        rows.forEach((row, y) => {
            let x = 0;
            while (x < w) {
                const c = row[x];
                let e = x + 1;
                while (e < w && row[e] === c) e++;
                if (c !== '.') body += rect(x, y, e - x, c);
                x = e;
            }
        });
        return `<g class="gm-base-graphic" transform="scale(${cell.toFixed(3)}) translate(${-w / 2} ${-h / 2})" shape-rendering="crispEdges">` +
            outline + body + `</g>`;
    },
    /** Map size of a planet node (same seed as renderMapSvg). */
    planetNodeSize(planetId) {
        const seed = String(planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const raw = 32 + (seed % 7) * 10;
        // Quantised to whole multiples of the global map pixel, so every planet, whatever its
        // size, is built from exactly the same pixel (bigger planet = more pixels, not bigger ones).
        const cells = this.planetGridCells(planetId);
        return cells * this.planetDetailMul(planetId) * GM_PIXEL_U0;
    },
    /** Art grid cells across a planet at detail 1 (22 with rings, else 18). */
    planetGridCells(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const spec = typeof planetSVGManager !== 'undefined' && planetSVGManager.planetSpecs && planetSVGManager.planetSpecs[pid];
        return (spec && spec.features && spec.features.rings) ? 22 : 18;
    },
    /** Grid multiplier of this planet's size class (1, 2, 3 …) on top of the zoom detail. */
    planetDetailMul(planetId) {
        const seed = String(planetId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const raw = 32 + (seed % 7) * 10;
        return Math.max(1, Math.round(raw / (this.planetGridCells(planetId) * GM_PIXEL_U0)));
    },
    /** The one pixel size of the whole map (map units per art pixel) at the current zoom detail. */
    mapPixelUnitGlobal() {
        return GM_PIXEL_U0 / (this.getMapDetail ? this.getMapDetail() : 1);
    },
    /**
     * The map's pixel unit: one art pixel of an average planet here, as
     * drawn right now (object scale + zoom detail). Stations, border
     * blockades and the nebula use it so everything shares one resolution.
     */
    mapPixelUnit() {
        return this.mapPixelUnitGlobal();
    },
    /** Map units per art pixel of a planet (grid 16 + margin; 22 with rings). */
    planetPixelSize(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const spec = typeof planetSVGManager !== 'undefined' && planetSVGManager.planetSpecs && planetSVGManager.planetSpecs[pid];
        const rings = !!(spec && spec.features && spec.features.rings);
        return this.planetNodeSize(planetId) / (rings ? 22 : 18);
    },
    /**
     * Pixel-art space station on a 12×12 grid centred on 0,0; the map scales
     * it so one cell = one pixel of its anchor planet (planetPixelSize).
     * Faction stations use military builds (ring hub, truss, spindle), plain
     * trading posts use shop builds (market hub, cargo yard, bazaar ring);
     * the build is picked from the post id. Parts: h = hull, d = dark frame,
     * p = solar panel, c = cargo crate, s = shop sign, l = beacon light,
     * lamps r / g = red / green position lights, w = white strobe,
     * a = amber shop lamp (lamps glow and blink when the post is open).
     */
    /** 3x5 pixel font for map labels (digits, slash, a few signs). */
    PIXEL_GLYPHS: {
        0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
        2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '011', '001', '111'],
        4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
        6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
        8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
        '/': ['001', '001', '010', '100', '100'], '-': ['000', '000', '111', '000', '000'],
        '+': ['000', '010', '111', '010', '000'], ' ': ['000', '000', '000', '000', '000']
    },
    /**
     * Text as pixel rects (baseline at y), with a dark one-pixel outline so
     * it reads on any background. anchor: 'start' | 'middle'.
     */
    pixelTextSvg(str, x, y, anchor, px) {
        const P = px || 1.5;
        // Zoomed in the text switches to finer bitmap fonts (3x5 → 5x7 → 7x9) of the same
        // height, so the pixels get smaller but stay square and the digits stay legible.
        const detail = this.getMapDetail ? this.getMapDetail() : 1;
        const lvl = detail >= 4 ? 2 : (detail >= 2 ? 1 : 0);
        const text = String(str).split('');
        let glyphs, gw, gh;
        if (lvl === 0) {
            glyphs = text.map((c) => this.PIXEL_GLYPHS[c] || this.PIXEL_GLYPHS[' ']); gw = 3; gh = 5;
        } else {
            const font = lvl === 1 ? this.PIXEL_GLYPHS_5X7 : this.PIXEL_GLYPHS_7X9;
            glyphs = text.map((c) => (font[c] || font[' ']).split(',')); gw = lvl === 1 ? 5 : 7; gh = lvl === 1 ? 7 : 9;
        }
        const F = (5 * P) / gh;
        const step = gw + 1, cols = glyphs.length * step - 1;
        const on = new Set();
        glyphs.forEach((g, i) => g.forEach((row, ry) => row.split('').forEach((b, rx) => {
            if (b === '1') on.add((i * step + rx) + ',' + ry);
        })));
        const x0 = anchor === 'middle' ? x - (cols * F) / 2 : x;
        const y0 = y - gh * F;
        let outline = '', fill = '';
        const r = (cx, cy, cls) => `<rect x="${(x0 + cx * F).toFixed(3)}" y="${(y0 + cy * F).toFixed(3)}" width="${F.toFixed(3)}" height="${F.toFixed(3)}" class="${cls}"/>`;
        for (let cy = -1; cy <= gh; cy++) {
            for (let cx = -1; cx <= cols; cx++) {
                if (on.has(cx + ',' + cy)) { fill += r(cx, cy, 'gm-pixel-text'); continue; }
                let edge = false;
                for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (on.has((cx + dx) + ',' + (cy + dy))) { edge = true; break; }
                if (edge) outline += r(cx, cy, 'gm-pixel-text-o');
            }
        }
        return `<g class="gm-stage-progress-px" shape-rendering="crispEdges">${outline}${fill}</g>`;
    },
    PIXEL_GLYPHS_5X7: { '0': '01110,10001,10011,10101,11001,10001,01110', '1': '00100,01100,00100,00100,00100,00100,01110', '2': '01110,10001,00001,00010,00100,01000,11111', '3': '11110,00001,00001,01110,00001,00001,11110', '4': '00010,00110,01010,10010,11111,00010,00010', '5': '11111,10000,11110,00001,00001,10001,01110', '6': '00110,01000,10000,11110,10001,10001,01110', '7': '11111,00001,00010,00100,01000,01000,01000', '8': '01110,10001,10001,01110,10001,10001,01110', '9': '01110,10001,10001,01111,00001,00010,01100', '/': '00001,00001,00010,00100,01000,10000,10000', '-': '00000,00000,00000,11111,00000,00000,00000', '+': '00000,00100,00100,11111,00100,00100,00000', ' ': '00000,00000,00000,00000,00000,00000,00000' },
    PIXEL_GLYPHS_7X9: { '0': '0111110,1000001,1000011,1000101,1001001,1010001,1100001,1000001,0111110', '1': '0001000,0011000,0101000,0001000,0001000,0001000,0001000,0001000,0111110', '2': '0111110,1000001,0000001,0000010,0000100,0001000,0010000,0100000,1111111', '3': '0111110,1000001,0000001,0000001,0011110,0000001,0000001,1000001,0111110', '4': '0000010,0000110,0001010,0010010,0100010,1000010,1111111,0000010,0000010', '5': '1111111,1000000,1000000,1111110,0000001,0000001,0000001,1000001,0111110', '6': '0011110,0100000,1000000,1000000,1111110,1000001,1000001,1000001,0111110', '7': '1111111,0000001,0000010,0000010,0000100,0001000,0001000,0010000,0010000', '8': '0111110,1000001,1000001,0111110,1000001,1000001,1000001,1000001,0111110', '9': '0111110,1000001,1000001,1000001,0111111,0000001,0000001,0000010,0111100', '/': '0000001,0000001,0000010,0000010,0000100,0001000,0010000,0100000,1000000', '-': '0000000,0000000,0000000,0000000,1111111,0000000,0000000,0000000,0000000', '+': '0000000,0000000,0001000,0001000,1111111,0001000,0001000,0000000,0000000', ' ': '0000000,0000000,0000000,0000000,0000000,0000000,0000000,0000000,0000000' },
    /**
     * Sub-pixel silhouette helpers (zoom detail d): a mask of solid
     * sub-pixels, drawn as merged row runs, with a one-sub-pixel outline —
     * so stations / checkpoints get the planets' fine edges, not 1-cell blocks.
     */
    subMaskNew(d) {
        return { d: d, set: new Set(), minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    },
    subMaskAdd(m, sx, sy) {
        m.set.add(sx + ',' + sy);
        if (sx < m.minX) m.minX = sx;
        if (sx > m.maxX) m.maxX = sx;
        if (sy < m.minY) m.minY = sy;
        if (sy > m.maxY) m.maxY = sy;
    },
    /** Rounded block (radius r in cells) as sub-pixel rows: [sx0, sx1, sy]. */
    roundedRowsSub(x, y, w, h, d, r) {
        const rows = [];
        const X0 = Math.round(x * d), Y0 = Math.round(y * d);
        const W = Math.round(w * d), H = Math.round(h * d);
        const R = Math.min(r * d, W / 2, H / 2);
        for (let sy = 0; sy < H; sy++) {
            const cy = sy + 0.5;
            const dy = cy < R ? R - cy : (cy > H - R ? cy - (H - R) : 0);
            const inset = dy > 0 ? Math.round(R - Math.sqrt(Math.max(0, R * R - dy * dy))) : 0;
            if (W - inset * 2 > 0) rows.push([X0 + inset, X0 + W - inset, Y0 + sy]);
        }
        return rows;
    },
    subRowsSvg(rows, d, cls, extra) {
        const p = 1 / d;
        return rows.map(([a, b, sy]) => `<rect x="${(a * p).toFixed(4)}" y="${(sy * p).toFixed(4)}" width="${((b - a) * p).toFixed(4)}" height="${p.toFixed(4)}"${cls ? ` class="${cls}"` : ''}${extra || ''}/>`).join('');
    },
    /** One-sub-pixel ring around the mask (8-neighbour), merged per row. */
    subMaskOutlineSvg(m, cls) {
        const rows = [];
        const has = (x, y) => m.set.has(x + ',' + y);
        for (let sy = m.minY - 1; sy <= m.maxY + 1; sy++) {
            let start = null;
            for (let sx = m.minX - 1; sx <= m.maxX + 2; sx++) {
                let edge = false;
                if (sx <= m.maxX + 1 && !has(sx, sy)) {
                    for (let dy = -1; dy <= 1 && !edge; dy++) {
                        for (let dx = -1; dx <= 1; dx++) if (has(sx + dx, sy + dy)) { edge = true; break; }
                    }
                }
                if (edge && start === null) start = sx;
                if (!edge && start !== null) { rows.push([start, sx, sy]); start = null; }
            }
        }
        return this.subRowsSvg(rows, m.d, cls);
    },
    nextClipId(prefix) {
        this._clipSeq = (this._clipSeq || 0) + 1;
        return prefix + this._clipSeq;
    },
    /**
     * Planet-style sub-pixel shading for one art block: light from the top
     * left across the whole object (cx, cy, R) plus a soft local bevel,
     * quantised to glint / shade / deep with 4x4 ordered (Bayer) dithering,
     * the same look as the planets at that zoom detail. Runs are merged.
     */
    ditherShadeSvg(x, y, w, h, d, cx, cy, R, prefix) {
        const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const p = 1 / d;
        const W = Math.round(w * d), H = Math.round(h * d);
        let out = '';
        for (let sy = 0; sy < H; sy++) {
            let run = null, runX = 0;
            const flush = (end) => {
                if (run) out += `<rect x="${(x + runX * p).toFixed(4)}" y="${(y + sy * p).toFixed(4)}" width="${((end - runX) * p).toFixed(4)}" height="${p.toFixed(4)}" class="${prefix}-${run}"/>`;
            };
            for (let sx = 0; sx <= W; sx++) {
                let tone = null;
                if (sx < W) {
                    const gx = x + (sx + 0.5) * p - cx, gy = y + (sy + 0.5) * p - cy;
                    // Global light + local bevel (lit near top/left of the block).
                    const u = (sx + 0.5) / W, v = (sy + 0.5) / H;
                    let l = -(gx + gy) / (R * 2) + (0.5 - (u + v) / 2) * 0.45;
                    l += ((BAYER[(sy & 3) * 4 + (sx & 3)] + 0.5) / 16 - 0.5) * 0.22;
                    tone = l > 0.32 ? 'glint' : l < -0.42 ? 'deep' : l < -0.14 ? 'shade' : null;
                }
                if (tone !== run) { flush(sx); run = tone; runX = sx; }
            }
        }
        return out;
    },
    /**
     * Station art is costly at high zoom (thousands of sub-pixel rects): cap
     * the detail at 4 and cache the markup per station + detail, so zoom
     * steps only swap strings instead of rebuilding the art.
     */
    /**
     * Map station art as one <image>: thousands of pixel rects (some of them
     * animated) in the live map SVG made every frame repaint them all. The
     * live .gm-station wrapper keeps the hover / closed filters.
     */
    stationArtImage(post, detail, open) {
        const raw = this.stationPixelsSvg(post, detail);
        const key = raw.length + '|' + (open ? 'o' : 'c') + '|' + this.stationPixelsSvgKey(post, detail);
        this._stationImgCache = this._stationImgCache || {};
        if (!this._stationImgCache[key]) {
            const cls = (/^<g class="([^"]*)"/.exec(raw) || [])[1] || 'gm-station';
            this._stationImgCache[key] = `<g class="${cls}">` +
                this.gmArtImage(raw, 'gm-post-node ' + (open ? 'open' : 'closed'), '', -9, -9, 18, 18) + `</g>`;
        }
        return this._stationImgCache[key];
    },
    stationPixelsSvgKey(post, detail) {
        const d = Math.min(GM_ART_DETAIL_MAX, Math.max(1, Math.round(detail || 1)));
        const st = this.stationFactionStyle(post);
        return String((post && post.id) || '') + (post && post.factionStation ? '|f' : '') + '@' + d + (st ? '|' + st.id + st.hull : '');
    },
    /** Map-art CSS (rules + keyframes) for standalone art images, collected once. */
    gmArtCss() {
        if (this._gmArtCss != null) return this._gmArtCss;
        const want = /gm-(border|station|lamp)/;
        let css = '';
        for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try { rules = sheet.cssRules; } catch (e) { continue; }
            for (const r of Array.from(rules || [])) {
                // Filters stay on the live wrapper (hover / closed), not inside.
                if (r.type === 1 && want.test(r.selectorText) && !/\bfilter\s*:/.test(r.cssText)) css += r.cssText + '\n';
                else if (r.type === 7 && /^gm-/.test(r.name)) css += r.cssText + '\n';
            }
        }
        this._gmArtCss = css;
        return css;
    },
    /**
     * Pixel art (SVG markup in art units) as a single <image> covering
     * x/y/w/h. Wrapped in wrapClass + wrapStyle inside its own document so
     * the map CSS selectors and faction vars still apply.
     */
    gmArtImage(inner, wrapClass, wrapStyle, x, y, w, h) {
        const cs = getComputedStyle((this.overlay && this.overlay.querySelector('.galaxy-map-svg')) || document.documentElement);
        const vars = ['--faction-accent', '--color-primary']
            .map((v) => { const val = cs.getPropertyValue(v).trim(); return val ? v + ':' + val + ';' : ''; }).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * 16}" height="${h * 16}" shape-rendering="crispEdges">` +
            `<style>${this.gmArtCss()}</style><g class="${wrapClass}" style="${vars}${wrapStyle || ''}">${inner}</g></svg>`;
        return `<image class="gm-art-img" href="data:image/svg+xml,${encodeURIComponent(svg)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
    },
    stationPixelsSvg(post, detail) {
        const d = Math.min(GM_ART_DETAIL_MAX, Math.max(1, Math.round(detail || 1)));
        const st = this.stationFactionStyle(post);
        const key = String((post && post.id) || '') + (post && post.factionStation ? '|f' : '') + '@' + d + (st ? '|' + st.id + st.hull : '');
        this._stationArtCache = this._stationArtCache || {};
        if (!this._stationArtCache[key]) this._stationArtCache[key] = this.stationPixelsSvgRaw(post, d);
        return this._stationArtCache[key];
    },
    /** Owner look of a station: its own faction, else the galaxy's ruler. */
    stationFactionStyle(post) {
        if (typeof factionShipStyles === 'undefined' || !factionShipStyles.getFactionStyle) return null;
        let fid = post && post.faction;
        if (!fid && typeof profileManager !== 'undefined' && profileManager.getFactionHoldings) {
            const h = profileManager.getFactionHoldings(this.galaxyId);
            fid = h && h.ruler;
        }
        return fid ? factionShipStyles.getFactionStyle(fid) : null;
    },
});
