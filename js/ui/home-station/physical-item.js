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

    function render(kind, id, w, h, color) {
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
            glowCore(cx, my + Math.floor(bh / 2), r);
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
            const r = Math.max(3, Math.round(Math.min(bw, bh) * 0.28)), cy = my + Math.floor(bh / 2);
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
                const d = Math.abs(x) + Math.abs(y);
                if (d > r) continue;
                dot(cx + x, cy + y, d === r ? OUT : mix(shade(kc, 0.72 - (x + y) * 0.07 / r * 3), [255, 255, 255], d <= 1 ? 0.7 : 0));
            }
        }
        // Wear.
        const n = Math.round(cw * ch / 30);
        for (let i = 0; i < n; i++) dot(mx + 2 + Math.floor(rnd() * (bw - 4)), my + 2 + Math.floor(rnd() * (bh - 4)), rnd() < 0.5 ? [255, 255, 255] : [0, 0, 0], 0.12);
        return cv.toDataURL('image/png');
    }

    return {
        /** Wrap `innerHtml` (the part icon) in its generated casing; w/h = footprint in screen px. */
        wrap(kind, id, w, h, color, innerHtml) {
            const key = kind + ':' + id + ':' + w + 'x' + h + ':' + color;
            let url = cache.get(key);
            if (!url) { try { url = render(kind, id, w, h, color); } catch (e) { url = ''; } cache.set(key, url); }
            return url ? `<span class="hs-item-body" style="background-image:url(${url})" aria-hidden="true"></span>${innerHtml}` : innerHtml;
        }
    };
})();

// Inventory grid positions per ship: { 'kind:id': [col, row] } (1-based grid lines).
physicalItem.invPositions = function (shipId) {
    try { return (JSON.parse(localStorage.getItem('vf_hs_inv_pos') || '{}') || {})[shipId] || {}; } catch (e) { return {}; }
};
/** Grid target for an inventory item with its top-left at client (x, y): { grid, col, row, w, h, free, all, at } or null. */
physicalItem.gridTarget = function (cell, x, y) {
    const grid = cell && cell.closest('.hs-bay-inv .hs-pick-grid');
    if (!grid) return null;
    const gr = grid.getBoundingClientRect();
    const k = gr.width / Math.max(1, grid.offsetWidth);
    const step = (48 + 4) * k;
    const cols = Number(grid.getAttribute('data-inv-cols')) || 8;
    const spanOf = (c, prop) => Number((c.style[prop].match(/span (\d+)/) || [0, 1])[1]);
    const w = spanOf(cell, 'gridColumn'), h = spanOf(cell, 'gridRow');
    // Over the grid at all (by the item's centre)?
    const cx = x + w * step / 2, cy = y + h * step / 2;
    if (cx < gr.left || cx > gr.right || cy < gr.top || cy > gr.bottom) return null;
    const col = Math.max(1, Math.min(cols - w + 1, Math.round((x - gr.left) / step) + 1));
    const rows = Number(grid.getAttribute('data-inv-rows')) || 99;
    const row = Math.max(1, Math.min(rows - h + 1, Math.round((y - gr.top) / step) + 1));
    // Every other item keeps its current tile; the target must be free.
    const all = Array.from(grid.querySelectorAll('.hs-pick-cell'));
    const at = (c) => {
        const r = c.getBoundingClientRect();
        return [Math.round((r.left - gr.left) / step) + 1, Math.round((r.top - gr.top) / step) + 1, spanOf(c, 'gridColumn'), spanOf(c, 'gridRow')];
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
    const el = old && old.parentNode === t.grid ? old : document.createElement('div');
    if (el !== old && old) old.remove();
    el.className = 'hs-inv-drop-preview' + (t.free ? '' : ' is-blocked');
    el.style.left = `${(t.col - 1) * 52}px`;
    el.style.top = `${(t.row - 1) * 52}px`;
    el.style.width = `${t.w * 52 - 4}px`;
    el.style.height = `${t.h * 52 - 4}px`;
    if (!el.parentNode) t.grid.appendChild(el);
};
/** Drop an inventory item with its top-left at client (x, y). Returns true when it landed in the grid. */
physicalItem.dropInGrid = function (ui, cell, x, y) {
    physicalItem.previewInGrid(null);
    const t = physicalItem.gridTarget(cell, x, y);
    if (!t) return false;
    if (!t.free) return true; // over the grid but occupied: stay where it was
    const key = (c) => c.getAttribute('data-part-kind') + ':' + c.getAttribute('data-part-id');
    let store = {};
    try { store = JSON.parse(localStorage.getItem('vf_hs_inv_pos') || '{}') || {}; } catch (e) { /* ignore */ }
    // Pin every item to where it is now, so the others don't reflow around the moved one.
    const ship = store[ui.hangarShipId] = {};
    t.all.forEach((c) => { const [c0, r0] = t.at(c); ship[key(c)] = [c0, r0]; });
    ship[key(cell)] = [t.col, t.row];
    try { localStorage.setItem('vf_hs_inv_pos', JSON.stringify(store)); } catch (e) { /* ignore */ }
    ui.createUI();
    return true;
};

// Hangar bay: switch the centre ship view to the part inventory (same physical items as the slot picker).
physicalItem.bayInventoryHtml = function (ui) {
    const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
    if (!slm || !ui || !ui.hangarShipId) return '';
    const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d;
    const colors = { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') };
    const inv = slm.getInventory(ui.hangarShipId) || {}, L = slm.getLoadout(ui.hangarShipId) || {};
    const pools = [['weapon', 'weapons'], ['defense', 'defenses'], ['ability', 'abilities'], ['energy', 'energy']];
    const cells = [];
    const pos = physicalItem.invPositions(ui.hangarShipId);
    // Cells whose installed state changed since the last draw play an equip / unequip animation.
    const prev = ui._bayInvPrev && ui._bayInvPrev.ship === ui.hangarShipId ? ui._bayInvPrev.set : null;
    const now = {};
    pools.forEach(([kind, key]) => {
        const eq = {};
        ((kind === 'weapon' && Array.isArray(L.weaponSlots) && L.weaponSlots.length ? L.weaponSlots : L[key]) || []).forEach((id) => { if (id) eq[id] = true; });
        (inv[key] || []).forEach((id) => {
            now[kind + ':' + id] = !!eq[id];
            const anim = prev && prev[kind + ':' + id] !== undefined && prev[kind + ':' + id] !== !!eq[id] ? (eq[id] ? ' is-anim-equip' : ' is-anim-unequip') : '';
            const lv = Math.max(0, Math.min(2, slm.getPartSizeLevel ? slm.getPartSizeLevel(kind, id) | 0 : 0));
            const span = [[1, 1], [1, 2], [2, 2]][lv];
            const label = ui.hangarModuleLabel(id);
            // Compact tip: no repeated name line, short hint.
            const tipLines = String(ui.hangarModuleTip(kind, id)).split('\n').filter((l, n) => !(n === 0 && l.trim().toUpperCase() === String(label).trim().toUpperCase()));
            const tip = (tipLines.join('\n') + '\nSIZE: ' + slm.partSizeLabel(kind, id) + '\nSTATUS: ' + (eq[id] ? 'INSTALLED' : 'IN INVENTORY') + '\nDRAG OR RIGHT-CLICK TO TOGGLE').replace(/"/g, '&quot;');
            const body = physicalItem.wrap(kind, id, span[0] * 48 + (span[0] - 1) * 4 - 8, span[1] * 48 + (span[1] - 1) * 4 - 8, colors[kind], '');
            cells.push(`<span class="hs-pick-cell${eq[id] ? ' is-equipped' : ''}${anim}" data-part-kind="${kind}" data-part-id="${id}" style="grid-column: ${pos[kind + ':' + id] ? pos[kind + ':' + id][0] + ' / ' : ''}span ${span[0]}; grid-row: ${pos[kind + ':' + id] ? pos[kind + ':' + id][1] + ' / ' : ''}span ${span[1]}; --pk-c:${colors[kind]}" data-ui-tip-instant data-ui-tip-compact data-ui-tip-head="${ui.hangarModuleLabel(id).replace(/"/g, '')}" data-ui-tip="${tip}">${body}<span class="hs-pick-ico">${ui.moduleIconHtml(kind, id, 32, 'hs-pixel', false)}</span><span class="hs-pick-size">${slm.partSizeLabel(kind, id)}</span></span>`);
        });
    });
    ui._bayInvPrev = { ship: ui.hangarShipId, set: now };
    const filter = ui._bayInvFilter || 'all', cs = 48;
    // Grid size: the ship's inventory (start profile + frame level).
    const invGrid = slm.getInventoryGrid ? slm.getInventoryGrid(ui.hangarShipId) : { cols: 4, rows: 2 };
    const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
    const ico = (key, col) => (ir ? String(ir.imgHtml(key, 24, 'hs-pixel', col, false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '');
    const fb = [['all', 'ALL', 'hsCraft', '#ffffff'], ['weapon', 'WEAPONS', 'statWeapon', colors.weapon], ['defense', 'DEFENSE', 'statArmor', colors.defense], ['ability', 'ABILITIES', 'statAbilities', colors.ability], ['energy', 'ENERGY', 'statEnergy', colors.energy]]
        .map(([k, l, key, col]) => `<button type="button" class="hs-bay-inv-filter${k === filter ? ' is-active' : ''}" style="--fc:${col}" data-inv-filter="${k}" data-ui-tip="${l}" aria-label="${l}"><span class="is-off">${ico(key, col)}</span><span class="is-on">${ico(key, '#05060a')}</span></button>`).join('');
    return `<div class="hs-slot-picker hs-bay-inv" data-filter="${filter}" style="--cs:${cs}px"><div class="hs-bay-inv-bar"><div class="hs-bay-inv-filters">${fb}</div>` +
        `</div>` +
        `<div class="hs-pick-grid" data-inv-cols="${invGrid.cols}" data-inv-rows="${invGrid.rows}" style="grid-template-columns: repeat(${invGrid.cols}, var(--cs)); grid-template-rows: repeat(${invGrid.rows}, var(--cs)); width: calc(${invGrid.cols} * var(--cs) + ${invGrid.cols - 1} * 4px); height: calc(${invGrid.rows} * var(--cs) + ${invGrid.rows - 1} * 4px); flex: 0 0 auto; align-self: flex-start">${cells.join('') || '<em>NO PARTS OWNED</em>'}</div></div>`;
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
// Drag an inventory part onto a slot (reuses the hangar part drag; a plain click does nothing).
document.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest && e.target.closest('.hs-bay-inv .hs-pick-cell');
    if (!cell || e.button !== 0 || typeof homeStationUI === 'undefined') return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const off = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', off, true); window.removeEventListener('pointercancel', off, true); };
    const mv = (m) => { if (Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return; off(); homeStationUI.startHangarPartDrag(cell, e); };
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', off, true); window.addEventListener('pointercancel', off, true);
}, true);
// Right-click: install into a free slot that fits, else swap out an installed part of the same type.
document.addEventListener('contextmenu', (e) => {
    const cell = e.target.closest && e.target.closest('.hs-bay-inv .hs-pick-cell');
    if (!cell || typeof homeStationUI === 'undefined') return;
    e.preventDefault();
    const ui = homeStationUI, slm = shipLoadoutManager;
    const kind = cell.getAttribute('data-part-kind'), id = cell.getAttribute('data-part-id');
    const idx = [];
    ui.overlay.querySelectorAll(`.hs-hangar-slot[data-slot-kind="${kind}"]`).forEach((el) => { const i = Number(el.getAttribute('data-slot-index') || 0); if (idx.indexOf(i) === -1) idx.push(i); });
    idx.sort((a, b) => a - b);
    const at = idx.find((i) => ui.hangarSlotModuleId(kind, i) === id);
    if (at != null) { ui.applyHangarSlotChoice(kind, at, '', null); return; } // installed: right-click toggles it off
    const fits = (i) => !slm.partFitsSlot || slm.partFitsSlot(ui.hangarShipId, kind, id, i).ok;
    const target = idx.find((i) => !ui.hangarSlotModuleId(kind, i) && fits(i)) ?? idx.find((i) => fits(i));
    if (target == null) { ui.playButtonResult(cell, false, idx.length ? 'NO SLOT BIG ENOUGH' : 'NO ' + kind.toUpperCase() + ' SLOT'); return; }
    ui.applyHangarSlotChoice(kind, target, id, null);
}, true);

// Inventory filter + zoom: applied in place (no re-render), remembered on the UI.
document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-inv-filter]');
    if (!b || typeof homeStationUI === 'undefined') return;
    e.preventDefault();
    const panel = b.closest('.hs-bay-inv');
    homeStationUI._bayInvFilter = b.getAttribute('data-inv-filter');
    try { localStorage.setItem('vf_hs_bay_inv_filter', homeStationUI._bayInvFilter); } catch (err) { /* ignore */ }
    panel.setAttribute('data-filter', homeStationUI._bayInvFilter);
    panel.querySelectorAll('[data-inv-filter]').forEach((x) => x.classList.toggle('is-active', x === b));
}, true);

// The inventory switch and its filter are remembered across reloads.
document.addEventListener('DOMContentLoaded', () => {
    try { if (typeof homeStationUI === 'undefined') return; if (localStorage.getItem('vf_hs_bay_inv') === '1') homeStationUI._bayInv = true; const fl = localStorage.getItem('vf_hs_bay_inv_filter'); if (fl) homeStationUI._bayInvFilter = fl; } catch (err) { /* ignore */ }
});
