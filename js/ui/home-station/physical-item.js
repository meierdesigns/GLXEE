"use strict";

// Generative "physical object" look for inventory items: every part gets a seeded, pixel-shaded metal
// casing (bevel, rivets, vents / label plate / hazard stripe / pipes, scratches, cast shadow) with a
// recessed socket the part icon sits in. Same id -> same item, always.
const physicalItem = (() => {
    const PX = 2; // one object pixel = 2 screen px
    const cache = new Map();

    const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const rngOf = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const rgbOf = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); const n = m ? parseInt(m[1], 16) : 0xc88bff; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const css = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a == null ? 1 : a})`;

    function render(kind, id, w, h, color, opts) {
        const plain = !!(opts && opts.plain);
        const cw = Math.max(8, Math.round(w / PX)), ch = Math.max(8, Math.round(h / PX));
        const cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        const g = cv.getContext('2d');
        const rnd = rngOf(hash(kind + ':' + id));
        const kc = rgbOf(color), K = mix(kc, [255, 255, 255], 0.15);
        const OUT = [5, 6, 10];
        const dot = (x, y, c, a) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= cw || y >= ch) return; g.fillStyle = css(c, a); g.fillRect(x, y, 1, 1); };
        const rect = (x, y, rw, rh, c, a) => { g.fillStyle = css(c, a); g.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh)); };
        const q = (v, n) => Math.round(v * n) / n;
        // Material per kind, kept bright enough to read against the dark cell.
        const base = { weapon: [128, 134, 148], defense: [104, 128, 160], energy: [150, 122, 96], ability: [112, 96, 150] }[kind] || [120, 124, 140];
        const mat = mix(base, kc, 0.22 + rnd() * 0.12);
        const shade = (m, v) => (v >= 0.5 ? mix(m, [255, 255, 255], (v - 0.5) * 0.9) : mix(m, [8, 9, 16], (0.5 - v) * 1.1));
        // Filled shape with outline; fn(u,v) -> brightness 0..1 for pixel at relative coords.
        const solid = (x, y, rw, rh, m, fn, cut) => {
            for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
                if (cut && ((i < cut || i >= rw - cut) && (j < cut || j >= rh - cut)) && (i + j < cut || (rw - 1 - i) + j < cut || i + (rh - 1 - j) < cut || (rw - 1 - i) + (rh - 1 - j) < cut)) continue;
                const edge = i === 0 || j === 0 || i === rw - 1 || j === rh - 1;
                dot(x + i, y + j, edge ? OUT : shade(m, q(fn(i / (rw - 1 || 1), j / (rh - 1 || 1)), 5)));
            }
        };
        const cylV = (u) => 1 - Math.abs(u - 0.32) * 1.5;      // vertical tube: lit left of centre
        const cylH = (u, v) => 1 - Math.abs(v - 0.3) * 1.5;    // horizontal tube
        const plane = (u, v) => 0.78 - (u * 0.4 + v * 0.45);   // flat plate, light top-left
        const circle = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 0.5) dot(cx + x, cy + y, c); };
        const glowCore = (cx, cy, r) => { circle(cx, cy, r + 1, OUT); circle(cx, cy, r, mix(kc, [0, 0, 0], 0.35)); circle(cx - 0, cy - 0, Math.max(1, r - 1), kc); circle(cx, cy, Math.max(0, r - 2), mix(kc, [255, 255, 255], 0.75)); };
        const rivet = (x, y) => { dot(x, y, shade(mat, 0.2)); dot(x - 1, y - 1, shade(mat, 0.95), 0.8); };

        // Cast shadow on the cell floor.
        const mx = 2, my = 2, bw = cw - mx * 2 - 1, bh = ch - my * 2 - 1;
        for (let x = mx + 2; x < mx + bw; x++) for (let y = my + bh - 2; y <= my + bh + 1; y++) dot(x, y, [0, 0, 0], 0.5);
        const cx = Math.floor(cw / 2), tall = ch > cw * 1.3;

        if (kind === 'weapon') {
            const dual = rnd() < 0.3, bwid = Math.max(5, Math.round(bw * (dual ? 0.28 : 0.34 + rnd() * 0.1)));
            const top = my + 1, brTop = my + Math.round(bh * 0.55);
            const barrel = (x) => {
                solid(x, top + 2, bwid, brTop - top, mat, (u) => cylV(u));
                const ribs = 2 + Math.floor(rnd() * 3);
                for (let r = 0; r < ribs; r++) rect(x + 1, top + 5 + r * Math.max(3, Math.round((brTop - top) / (ribs + 1))), bwid - 2, 1, OUT, 0.55);
                solid(x - 1, top, bwid + 2, 3, shade(mat, 0.62), (u, v) => cylV(u) - v * 0.1); // muzzle ring
                rect(x + 2, top + 1, bwid - 4, 1, [3, 3, 6]);
            };
            if (dual) { barrel(cx - bwid - 1); barrel(cx + 1); } else barrel(cx - Math.floor(bwid / 2));
            const bx = mx + 1, bwd = bw - 2, bht = my + bh - brTop - 1;
            solid(bx, brTop, bwd, bht, shade(mat, 0.46), plane, 2);
            solid(bx + 2, brTop + 2, bwd - 4, Math.max(3, bht - 5), mat, (u, v) => plane(u, v) + 0.05);
            rect(bx + 3, brTop + 3, bwd - 6, 1, K); rect(bx + 3, brTop + 3, bwd - 6, 1, [255, 255, 255], 0.25); // energy slit
            rivet(bx + 2, brTop + bht - 3); rivet(bx + bwd - 3, brTop + bht - 3);
        } else if (kind === 'defense') {
            solid(mx, my, bw, bh, shade(mat, 0.5), plane, Math.max(2, Math.round(Math.min(bw, bh) * 0.2)));
            solid(mx + 2, my + 2, bw - 4, bh - 4, mat, (u, v) => plane(u, v) + 0.06, Math.max(1, Math.round(Math.min(bw, bh) * 0.16)));
            const r = Math.max(2, Math.round(Math.min(bw, bh) * 0.2));
            const chev = rnd() < 0.5;
            if (chev) for (let i = 0; i < 3; i++) { rect(mx + 4, my + 4 + i * 2, bw - 8, 1, OUT, 0.35); }
            if (!plain) glowCore(cx, my + Math.floor(bh / 2), r);
            [[mx + 3, my + 3], [mx + bw - 4, my + 3], [mx + 3, my + bh - 4], [mx + bw - 4, my + bh - 4]].forEach(([x, y]) => rivet(x, y));
        } else if (kind === 'energy') {
            const bwid = Math.max(6, Math.round(bw * 0.62)), x = cx - Math.floor(bwid / 2);
            solid(cx - 2, my, 5, 3, shade(mat, 0.8), (u) => cylV(u));                      // top terminal
            solid(x, my + 3, bwid, bh - 3, mat, (u) => cylV(u));                            // cell body
            const bands = 1 + Math.floor(rnd() * 3), bandH = Math.max(2, Math.round(bh * 0.1));
            for (let i = 0; i < bands; i++) {
                const y = my + 5 + Math.round((i + 0.6) * (bh - 10) / (bands + 0.2));
                for (let xx = x + 1; xx < x + bwid - 1; xx++) for (let yy = 0; yy < bandH; yy++) dot(xx, y + yy, yy === 0 ? mix(kc, [255, 255, 255], 0.7) : mix(kc, [0, 0, 0], yy * 0.15));
            }
            rect(x + 1, my + bh - 3, bwid - 2, 2, shade(mat, 0.25));                         // base ring
        } else { // ability: circuit chip with a faceted gem
            solid(mx, my, bw, bh, mix([54, 46, 88], kc, 0.25), plane, 1);
            const traces = 5 + Math.floor(rnd() * 5);
            for (let i = 0; i < traces; i++) {
                let x = mx + 1 + Math.floor(rnd() * (bw - 2)), y = my + 1 + Math.floor(rnd() * (bh - 2));
                const len = 3 + Math.floor(rnd() * 6), hz = rnd() < 0.5;
                for (let k = 0; k < len; k++) { dot(x, y, K, 0.55); if (hz) x++; else y++; if (x >= mx + bw - 1 || y >= my + bh - 1) break; }
                dot(x, y, K, 0.9);
            }
            for (let i = 0; i < 4; i++) { rect(mx, my + 2 + i * 3, 1, 2, [210, 190, 90]); rect(mx + bw - 1, my + 2 + i * 3, 1, 2, [210, 190, 90]); }
            if (!plain) {
                const r = Math.max(3, Math.round(Math.min(bw, bh) * 0.28)), cy = my + Math.floor(bh / 2);
                for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
                    const d = Math.abs(x) + Math.abs(y);
                    if (d > r) continue;
                    dot(cx + x, cy + y, d === r ? OUT : mix(shade(kc, 0.72 - (x + y) * 0.07 / r * 3), [255, 255, 255], d <= 1 ? 0.7 : 0));
                }
            }
        }
        // Wear.
        const n = Math.round(cw * ch / 30);
        for (let i = 0; i < n; i++) dot(mx + 2 + Math.floor(rnd() * (bw - 4)), my + 2 + Math.floor(rnd() * (bh - 4)), rnd() < 0.5 ? [255, 255, 255] : [0, 0, 0], 0.12);
        return cv.toDataURL('image/png');
    }

    /** A resource storage silo: metal frame, pipe + lamp trim, and a glass viewport with resource
     *  chunks piled up to the fill level — same seeded-pixel technique as render(), own layout. */
    /** `capMarkPct` = where the default capacity Grenze sits (100 = top of glass). */
    function renderChamber(id, w, h, color, pct, capMarkPct) {
        const cw = Math.max(10, Math.round(w / PX)), ch = Math.max(16, Math.round(h / PX));
        const cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        const g = cv.getContext('2d');
        const rnd = rngOf(hash('chamber:' + id));
        const kc = rgbOf(color);
        const OUT = [5, 6, 10];
        const frame = [52, 56, 66];
        const dot = (x, y, c, a) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= cw || y >= ch) return; g.fillStyle = css(c, a); g.fillRect(x, y, 1, 1); };
        const rect = (x, y, rw, rh, c, a) => { g.fillStyle = css(c, a); g.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh)); };
        const shade = (m, v) => (v >= 0.5 ? mix(m, [255, 255, 255], (v - 0.5) * 0.9) : mix(m, [8, 9, 16], (0.5 - v) * 1.1));

        const mx = 1, my = 1, bw = cw - mx * 2, bh = ch - my * 2;
        // Outer bezel.
        rect(mx, my, bw, bh, shade(frame, 0.42));
        rect(mx + 1, my + 1, bw - 2, bh - 2, [6, 7, 11]);
        // Corner rivets.
        [[mx, my], [mx + bw - 1, my], [mx, my + bh - 1], [mx + bw - 1, my + bh - 1]].forEach(([x, y]) => dot(x, y, shade(frame, 0.85)));
        // Top pipe stub (bent elbow) feeding into the silo.
        const pipeX = mx + bw - 4;
        rect(pipeX, my - 1, 2, 3, shade(frame, 0.6));
        rect(pipeX - 3, my - 1, 3, 2, shade(frame, 0.6));
        // Side lamps, glowing in the resource color.
        [my + 3, my + Math.round(bh * 0.35)].forEach((y) => {
            dot(mx - 1, y, kc, 0.9); dot(mx + bw, y, kc, 0.9);
        });
        // Glass viewport.
        const vx = mx + 3, vy = my + 3, vw = bw - 6, vh = bh - 9;
        rect(vx, vy, vw, vh, [10, 12, 18]);
        rect(vx, vy, 1, vh, shade(frame, 0.55)); rect(vx + vw - 1, vy, 1, vh, shade(frame, 0.2));
        // Resource column, bottom-up: level fill surface (grain in colour only — no jagged silhouette
        // that reads as a broken container when the silo is stretched on screen).
        const fillBase = Math.round(vh * Math.max(0, Math.min(1, pct / 100)));
        if (fillBase > 0) {
            const cols = Math.max(1, vw - 2);
            const bottomY = vy + vh - 1;
            const topY = bottomY - fillBase;
            for (let i = 0; i < cols; i++) {
                const x = vx + 1 + i;
                for (let y = topY; y <= bottomY; y++) {
                    const depth = (y - topY) / Math.max(1, fillBase);
                    const grain = 0.5 + (rnd() - 0.5) * 0.3;
                    const v = Math.max(0, Math.min(1, 0.58 - depth * 0.28 + (grain - 0.5) * 0.22));
                    dot(x, y, shade(kc, v));
                }
                // Even lit rim — flat level line across the glass.
                dot(x, topY, mix(kc, [255, 255, 255], 0.4), 0.88);
            }
        }
        // Glass highlight streak + rim light.
        rect(vx + 1, vy + 1, 1, Math.round(vh * 0.4), [255, 255, 255], 0.18);
        rect(vx, vy, vw, 1, shade(frame, 0.7));
        // Capacity Grenze: default (base) cap mark — at the top when unupgraded.
        const markPct = Math.max(0, Math.min(100, Number(capMarkPct) || 100));
        const markY = vy + vh - Math.round(vh * (markPct / 100));
        const markClamped = Math.max(vy, Math.min(vy + vh - 1, markY));
        rect(vx + 1, markClamped, vw - 2, 1, [140, 148, 160], 0.95);
        for (let x = vx + 1; x < vx + vw - 1; x += 2) {
            dot(x, markClamped, [210, 216, 224], 0.85);
        }
        // Baseplate with a lit status slot, colored by fill state.
        rect(mx + 2, my + bh - 4, bw - 4, 3, shade(frame, 0.5));
        rect(mx + 4, my + bh - 3, bw - 8, 1, pct >= 100 ? mix(kc, [255, 255, 255], 0.4) : kc, 0.9);
        return cv.toDataURL('image/png');
    }

    return {
        /** Wrap `innerHtml` (the part icon) in its generated casing; w/h = footprint in screen px. */
        wrap(kind, id, w, h, color, innerHtml, opts) {
            const plain = !!(opts && opts.plain);
            const key = kind + ':' + id + ':' + w + 'x' + h + ':' + color + (plain ? ':plain' : '');
            let url = cache.get(key);
            if (!url) { try { url = render(kind, id, w, h, color, opts); } catch (e) { url = ''; } cache.set(key, url); }
            return url ? `<span class="hs-item-body" style="background-image:url(${url})" aria-hidden="true"></span>${innerHtml}` : innerHtml;
        },
        /** A resource storage silo casing with its fill level baked in (chunks piled to `pct`, 0-100).
         *  `capMarkPct` places the default capacity Grenze (100 = top of glass). */
        wrapChamber(id, w, h, color, pct, capMarkPct) {
            const bucketedPct = Math.round(pct / 4) * 4;
            const mark = Math.round((Number(capMarkPct) || 100) / 4) * 4;
            const key = 'chamber:' + id + ':' + w + 'x' + h + ':' + color + ':' + bucketedPct + ':' + mark;
            let url = cache.get(key);
            if (!url) { try { url = renderChamber(id, w, h, color, bucketedPct, mark); } catch (e) { url = ''; } cache.set(key, url); }
            return url ? `<span class="hs-item-body" style="background-image:url(${url})" aria-hidden="true"></span>` : '';
        }
    };
})();

// Bucket (plural, used by profile.storagePos / Ship Storage) for a bay-inventory cell's
// data-part-kind (singular, used for ship-slot matching — "blueprint" is a synthetic kind,
// never a real slot type, so a blueprint cell can never register as an equip match).
physicalItem.BUCKET_OF_KIND = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy', blueprint: 'blueprints' };

// Inventory grid positions per ship: { 'bucket:id': [col, row] } (1-based grid lines) — the
// exact same profile.storagePos map (scope 'ship:<shipId>') that SHIP STORAGE on the station
// tab reads/writes (render-parts-list.js renderShipStorage), not a separate one: dragging an
// item here and seeing it elsewhere use one shared position, not two that can drift apart.
physicalItem.invPositions = function (shipId) {
    if (typeof profileManager === 'undefined' || !profileManager.getStoragePosMap) return {};
    const profile = profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
    if (!profile) return {};
    return profileManager.getStoragePosMap(profile, 'ship', shipId);
};
/** Grid target for an inventory item with its top-left at client (x, y): { grid, col, row, w, h, free, all, at } or null. */
physicalItem.gridTarget = function (cell, x, y) {
    const grid = cell && cell.closest('.hs-bay-inv .hs-storage-grid');
    if (!grid) return null;
    const gr = grid.getBoundingClientRect();
    const k = gr.width / Math.max(1, grid.offsetWidth);
    const cs = parseFloat(getComputedStyle(grid).getPropertyValue('--cs')) || 48;
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 2;
    const step = (cs + gap) * k;
    // Tile (1,1)'s own top-left, not the grid's outer border-box edge: the grid now also
    // carries the shared .hs-storage-grid border (same card framing as ship/station storage),
    // so content starts border-width (+ any padding) in from gr.left/top — origin must match
    // that or every column/row comes out shifted by that offset, landing drops a slot off.
    const gcs = getComputedStyle(grid);
    const originX = gr.left + ((parseFloat(gcs.borderLeftWidth) || 0) + (parseFloat(gcs.paddingLeft) || 0)) * k;
    const originY = gr.top + ((parseFloat(gcs.borderTopWidth) || 0) + (parseFloat(gcs.paddingTop) || 0)) * k;
    const cols = Number(grid.getAttribute('data-inv-cols')) || 8;
    const spanOf = (c, prop) => Number((c.style[prop].match(/span (\d+)/) || [0, 1])[1]);
    const w = spanOf(cell, 'gridColumn'), h = spanOf(cell, 'gridRow');
    // Over the grid at all (by the item's centre)?
    const cx = x + w * step / 2, cy = y + h * step / 2;
    if (cx < gr.left || cx > gr.right || cy < gr.top || cy > gr.bottom) return null;
    const col = Math.max(1, Math.min(cols - w + 1, Math.round((x - originX) / step) + 1));
    const rows = Number(grid.getAttribute('data-inv-rows')) || 99;
    const row = Math.max(1, Math.min(rows - h + 1, Math.round((y - originY) / step) + 1));
    // Every other item keeps its current tile; the target must be free.
    // (Empty placeholder cells just tile the unused grid area visually and don't occupy anything.)
    const all = Array.from(grid.querySelectorAll('[data-part-id]'));
    const at = (c) => {
        const r = c.getBoundingClientRect();
        return [Math.round((r.left - originX) / step) + 1, Math.round((r.top - originY) / step) + 1, spanOf(c, 'gridColumn'), spanOf(c, 'gridRow')];
    };
    const free = !all.some((c) => {
        if (c === cell) return false;
        const [c0, r0, cw, ch] = at(c);
        return col < c0 + cw && c0 < col + w && row < r0 + ch && r0 < row + h;
    });
    return { grid, col, row, w, h, free, all, at };
};
/** Show where the dragged item would land (null x clears it). */
physicalItem.previewInGrid = function (cell, x, y) {
    const old = document.querySelector('.hs-inv-drop-preview');
    const t = x == null ? null : physicalItem.gridTarget(cell, x, y);
    if (!t) { if (old) old.remove(); return; }
    const isNew = !(old && old.parentNode === t.grid);
    const el = isNew ? document.createElement('div') : old;
    if (isNew && old) old.remove();
    // Dropping on an occupied tile now swaps instead of being refused, so the preview reads
    // "swap" rather than "blocked" there — never a dead-end red X for a drop that will work.
    el.className = 'hs-inv-drop-preview' + (t.free ? '' : ' is-swap');
    const gcs = getComputedStyle(t.grid);
    const cs = parseFloat(gcs.getPropertyValue('--cs')) || 48;
    const gap = parseFloat(gcs.columnGap) || 2;
    const step = cs + gap;
    // Absolute left/top are from the grid's padding edge; cells sit after padding — match that
    // or the preview paints in the padding gutter while Inspect still shows the cell elsewhere.
    const padL = parseFloat(gcs.paddingLeft) || 0;
    const padT = parseFloat(gcs.paddingTop) || 0;
    el.style.left = `${padL + (t.col - 1) * step}px`;
    el.style.top = `${padT + (t.row - 1) * step}px`;
    el.style.width = `${t.w * step - gap}px`;
    el.style.height = `${t.h * step - gap}px`;
    // The dragged item's own casing sitting in the hovered tile, not a highlighted box.
    if (isNew) {
        const body = cell && cell.querySelector && cell.querySelector('.hs-item-body');
        if (body) el.appendChild(body.cloneNode(true));
    }
    if (!el.parentNode) t.grid.appendChild(el);
};
/** Drop an inventory item with its top-left at client (x, y). Returns true when it landed in the grid. */
physicalItem.dropInGrid = function (ui, cell, x, y) {
    physicalItem.previewInGrid(null);
    const t = physicalItem.gridTarget(cell, x, y);
    if (!t) return false;
    if (typeof profileManager === 'undefined' || !profileManager.freezeStoragePositions) return false;
    const profile = profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
    if (!profile) return false;
    const key = (c) => {
        const kind = c.getAttribute('data-part-kind');
        return (physicalItem.BUCKET_OF_KIND[kind] || kind) + ':' + c.getAttribute('data-part-id');
    };
    const posByKey = {};
    // Pin every item to where it is now, so the others don't reflow around the moved one.
    t.all.forEach((c) => { const [c0, r0] = t.at(c); posByKey[key(c)] = [c0, r0]; });
    const [oldCol, oldRow] = t.at(cell);
    // Whatever already sits on the dropped-on tile(s) swaps back into this item's old tile
    // instead of just blocking the drop (free is false exactly when this list is non-empty).
    t.all.filter((c) => {
        if (c === cell) return false;
        const [c0, r0, cw, ch] = t.at(c);
        return t.col < c0 + cw && c0 < t.col + t.w && t.row < r0 + ch && r0 < t.row + t.h;
    }).forEach((c) => { posByKey[key(c)] = [oldCol, oldRow]; });
    posByKey[key(cell)] = [t.col, t.row];
    profileManager.freezeStoragePositions(profile, 'ship', ui.hangarShipId, posByKey);
    ui.createUI();
    return true;
};

// Hangar bay: switch the centre ship view to the part inventory. Literally renders through
// HomeStationUI.renderShipStorage (render-parts-list.js) — the exact same function SHIP
// STORAGE on the station tab uses for this ship — instead of a second, independent item
// set/position/grid-size pipeline, which kept drifting out of sync with it (wrong item count,
// wrong grid size, positions landing in the wrong spot).
physicalItem.bayInventoryHtml = function (ui) {
    const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
    if (!slm || !ui || !ui.hangarShipId) return '';
    const profile = typeof profileManager !== 'undefined' && profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
    if (!profile) return '';
    const shipId = ui.hangarShipId;
    const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d;
    const colors = { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') };
    const filter = ui._bayInvFilter || 'all';
    const cs = (ui.STORAGE_CELL_PX | 0) || 56;
    const gridHtml = ui.renderShipStorage(profile, shipId, { extraGridClass: 'hs-pick-grid', tipAction: false });
    // Station storage too — its cells already carry data-move-to-ship (render-parts-list.js),
    // so a click/drag here moves the part straight onto this ship without a tab switch.
    const stationGridHtml = ui.renderStationStorage(profile, { extraGridClass: 'hs-pick-grid' });
    const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
    // Native 16×16 sprite grid — size ≥24 triggers Scale2x and looks mushy in these tiny filter buttons.
    const ico = (key, col) => (ir ? String(ir.imgHtml(key, 16, 'hs-pixel', col, false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '');
    const fb = [['all', 'ALL', 'hsCraft', '#ffffff'], ['weapon', 'WEAPONS', 'statWeapon', colors.weapon], ['defense', 'DEFENSE', 'statArmor', colors.defense], ['ability', 'ABILITIES', 'statAbilities', colors.ability], ['energy', 'ENERGY', 'statEnergy', colors.energy]]
        .map(([k, l, key, col]) => `<button type="button" class="hs-bay-inv-filter${k === filter ? ' is-active' : ''}" style="--fc:${col}" data-inv-filter="${k}" data-ui-tip="${l}" aria-label="${l}"><span class="is-off">${ico(key, col)}</span><span class="is-on">${ico(key, '#05060a')}</span></button>`).join('');
    return `<div class="hs-slot-picker hs-bay-inv" data-filter="${filter}" style="--cs:${cs}px"><div class="hs-bay-inv-bar"><div class="hs-bay-inv-filters">${fb}</div>` +
        `</div>` +
        `<div class="hs-bay-inv-body">` +
        `<div class="hs-bay-inv-group"><div class="hs-bay-inv-group-label">SHIP</div>${gridHtml}</div>` +
        `<div class="hs-bay-inv-group"><div class="hs-bay-inv-group-label">STATION</div>${stationGridHtml}</div>` +
        `</div></div>`;
};
document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-bay-inv]');
    if (!b || typeof homeStationUI === 'undefined') return;
    e.preventDefault(); e.stopPropagation();
    homeStationUI._bayInv = !homeStationUI._bayInv;
    try { localStorage.setItem('vf_hs_bay_inv', homeStationUI._bayInv ? '1' : '0'); } catch (err) { /* ignore */ }
    // Refit and centre the ship in the visible part of the bay (zoom back to fit).
    homeStationUI._hangarFit = null; homeStationUI._hangarBayZoom = 1; homeStationUI._hangarZoomTarget = 1;
    homeStationUI.createUI();
}, true);
// The grid itself is HomeStationUI.renderShipStorage's own markup (render-parts-list.js —
// the same SHIP STORAGE grid shown on the station tab), which marks its buttons
// draggable="true" for the *station's* pointer-suppressed-native-drag convention
// (bindStorageDragAndDrop). That bind call skips anything inside .hs-bay-inv (the hangar
// drag below needs those cells instead), so nothing else turns off the browser's native
// HTML5 drag for them — do that here, or a native dragstart fights the pointer-based one.
document.addEventListener('dragstart', (e) => {
    if (e.target.closest && e.target.closest('.hs-bay-inv [data-part-id]')) e.preventDefault();
}, true);
// Drag an inventory part onto a slot (reuses the hangar part drag; a plain click does nothing).
document.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest && e.target.closest('.hs-bay-inv [data-part-id]');
    // Slot-picker modal (.hs-pick-inv) owns its own drag/click → install into THAT slot.
    if (!cell || cell.closest('.hs-pick-inv') || e.button !== 0 || typeof homeStationUI === 'undefined') return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const off = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', off, true); window.removeEventListener('pointercancel', off, true); };
    const mv = (m) => { if (Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return; off(); homeStationUI.startHangarPartDrag(cell, e); };
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', off, true); window.addEventListener('pointercancel', off, true);
}, true);
// Toggle a bay-inventory part's slot state: installed → unequip, not installed → install into
// a free slot that fits (else swap into the first slot that fits). Shared by a plain click
// (the inventory's main gesture: tap a part to slot/unslot it) and right-click (same toggle,
// kept as a muscle-memory alias for players used to the storage grid's right-click equip).
function toggleHangarInventorySlot(cell) {
    if (typeof homeStationUI === 'undefined') return;
    const ui = homeStationUI, slm = shipLoadoutManager;
    const kind = cell.getAttribute('data-part-kind'), id = cell.getAttribute('data-part-id');
    const idx = [];
    ui.overlay.querySelectorAll(`.hs-hangar-slot[data-slot-kind="${kind}"]`).forEach((el) => { const i = Number(el.getAttribute('data-slot-index') || 0); if (idx.indexOf(i) === -1) idx.push(i); });
    idx.sort((a, b) => a - b);
    const at = idx.find((i) => ui.hangarSlotModuleId(kind, i) === id);
    if (at != null) { ui.applyHangarSlotChoice(kind, at, '', null); return; } // installed: toggles it off
    const fits = (i) => !slm.partFitsSlot || slm.partFitsSlot(ui.hangarShipId, kind, id, i).ok;
    const target = idx.find((i) => !ui.hangarSlotModuleId(kind, i) && fits(i)) ?? idx.find((i) => fits(i));
    if (target == null) { ui.playButtonResult(cell, false, idx.length ? 'NO SLOT BIG ENOUGH' : 'NO ' + kind.toUpperCase() + ' SLOT'); return; }
    ui.applyHangarSlotChoice(kind, target, id, null);
}
document.addEventListener('contextmenu', (e) => {
    const cell = e.target.closest && e.target.closest('.hs-bay-inv [data-part-id]');
    if (!cell || cell.closest('.hs-pick-inv')) return;
    e.preventDefault();
    toggleHangarInventorySlot(cell);
}, true);
// Plain click: same toggle as right-click above. Needs its own flag since the pointerdown
// handler right above already preventDefault()s and arms a drag-or-not watch — a click fired
// without having dragged (the pointerup below the threshold) is this gesture, not a drag.
// button !== 0 guard: a right-click on a <button> still fires a trailing 'click' (button 2) as
// the browser's own activation behavior, after the 'contextmenu' listener above already ran the
// toggle once — without this guard that trailing click ran the same toggle a second time,
// immediately undoing it (equip-then-unequip), which is what made a part vanish on right-click.
document.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const cell = e.target.closest && e.target.closest('.hs-bay-inv [data-part-id]');
    if (!cell || cell.closest('.hs-pick-inv')) return;
    e.preventDefault();
    e.stopPropagation();
    toggleHangarInventorySlot(cell);
}, true);

// Inventory filter + zoom: applied in place (no re-render), remembered on the UI.
document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-inv-filter]');
    if (!b || typeof homeStationUI === 'undefined') return;
    e.preventDefault();
    const panel = b.closest('.hs-bay-inv');
    if (!panel) return;
    const next = b.getAttribute('data-inv-filter');
    // Slot-picker modal filter is local — don't overwrite the bay sidebar's remembered filter.
    if (!panel.classList.contains('hs-pick-inv')) {
        homeStationUI._bayInvFilter = next;
        try { localStorage.setItem('vf_hs_bay_inv_filter', next); } catch (err) { /* ignore */ }
    }
    panel.setAttribute('data-filter', next);
    panel.querySelectorAll('[data-inv-filter]').forEach((x) => x.classList.toggle('is-active', x === b));
}, true);

// The inventory switch and its filter are remembered across reloads; restored synchronously
// in HomeStationUI.createUI() (create-ui.js) before the first render/draw, since this
// DOMContentLoaded listener fired too late and raced the hangar tab's own first paint.
