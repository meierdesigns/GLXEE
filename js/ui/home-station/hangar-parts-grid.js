"use strict";

// HomeStationUI methods: the hangar's left sidebar can switch from the
// ship/area tree to a PARTS view — every owned module as a grid, one
// section per slot type. Drag a part onto the ship to fill the nearest slot
// of its type, or click it to fill the first free one.
const HANGAR_PART_SECTIONS = [
    { kind: 'weapon', key: 'weapons', label: 'WEAPONS', icon: 'statWeapon' },
    { kind: 'defense', key: 'defenses', label: 'DEFENSE', icon: 'statArmor' },
    { kind: 'ability', key: 'abilities', label: 'ABILITIES', icon: 'statAbilities' },
    { kind: 'energy', key: 'energy', label: 'ENERGY', icon: 'statEnergy' }
];

extendClass(HomeStationUI, {
    /** The slot type's shape (same as its pin on the ship): weapon arrowhead, defense shield, ability circle, energy diamond. */
    slotGlyphHtml(kind, extraClass) {
        return `<span class="hs-slot-glyph${extraClass ? ' ' + extraClass : ''}" data-slot-kind="${kind}" aria-hidden="true"></span>`;
    },
    renderHangarLeftViewToggle() {
        const view = (this._hangarLeftView === 'parts' || this._hangarLeftView === 'slots') ? this._hangarLeftView : 'ships';
        const btn = (id, label, icon) =>
            `<button type="button" class="hs-hangar-view-btn${view === id ? ' is-active' : ''}" data-hangar-left-view="${id}" aria-pressed="${view === id}">` +
            `${this.iconHtml(icon, 40, 'hs-pixel hs-pixel-40', false, view === id ? '#05060a' : null)}<span>${label}</span></button>`;
        return `<div class="hs-hangar-view-toggle" role="group" aria-label="Sidebar view">${btn('ships', 'SHIPS', 'menuShips')}${btn('slots', 'SLOTS', 'hsUpgrade')}${btn('parts', 'PARTS', 'hsCraft')}</div>`;
    },
    /** SLOTS view: the ship's slot layout per hull area (same idea as the start profile's HULL AREAS list). */
    renderHangarSlotsView(slots, layout) {
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        // Same kind colours as the PARTS tab and the hangar stat tiles (iconRenderer.getModuleKindColor).
        const color = (() => { const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d; return { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') }; })();
        const kindIcon = { weapon: 'statWeapon', defense: 'statArmor', energy: 'statEnergy', ability: 'statAbilities' };
        const groups = [
            { label: 'NOSE', lv: 'front', areas: ['front'] },
            { label: 'CORE', lv: 'center', areas: ['center'] },
            { label: 'AFT', lv: 'back', areas: ['back'] },
            { label: 'WINGS', lv: 'wing', areas: ['wingLeft', 'wingRight'] }
        ];
        const known = [].concat.apply([], groups.map((g) => g.areas));
        // A slot belongs to the hull area it currently sits in (it changes when the slot is dragged to another area).
        const segs = (layout && layout.segments) || [];
        const lw = Math.max(1, (layout && layout.width) || 1), lh = Math.max(1, (layout && layout.height) || 1);
        const areaAt = (sl) => {
            if (!segs.length || sl.nx == null || sl.ny == null) return sl.area;
            const px = sl.nx * lw, py = sl.ny * lh;
            let hit = segs.find((sg) => px >= sg.x && px <= sg.x + sg.width && py >= sg.y && py <= sg.y + sg.height);
            if (!hit) {
                let best = Infinity;
                segs.forEach((sg) => {
                    const d = Math.hypot(px - (sg.x + sg.width / 2), py - (sg.y + sg.height / 2));
                    if (d < best) { best = d; hit = sg; }
                });
            }
            return hit ? hit.id : sl.area;
        };
        const list = (slots || []).filter((sl) => sl).map((sl) => (sl.kind === 'weapon' ? Object.assign({}, sl, { area: areaAt(sl) }) : sl));
        const levels = slm && slm.getAreaLevels ? (slm.getAreaLevels(this.hangarShipId) || {}) : {};
        // Same footprints as the part grid: S = 1x1, M = 1 wide x 2 tall, L = 2x2 units (unit 40 px, 4 px gap).
        const dims = [[40, 40], [40, 84], [84, 84]];
        // Size class drawn for one slot (0 S, 1 M, 2 L).
        // Size class of the SLOT itself (0 S, 1 M, 2 L), filled or not: the box and its letter show the slot.
        const slotLv = (sl) => {
            try { return Math.max(0, Math.min(2, slm.getSlotSizeLevel(this.hangarShipId, sl.kind, sl.index) | 0)); } catch (e) { return 0; }
        };
        const cell = (sl, half) => {
            // A split slot (mirrored pair) shows as two boxes, each one size smaller (M = two S); S stays S.
            const lvl = sl.split && sl.kind === 'weapon' ? Math.max(0, slotLv(sl) - 1) : slotLv(sl);
            let key = kindIcon[sl.kind];
            if (sl.id && slm && slm.resolveModuleIcon) { try { key = slm.resolveModuleIcon({ kind: sl.kind, id: sl.id }) || key; } catch (e) { /* type icon */ } }
            const name = sl.id ? this.hangarModuleLabel(sl.id) : 'EMPTY ' + String(sl.kind).toUpperCase() + ' SLOT';
            const img = ir ? String((sl.kind === 'weapon' && sl.id && ir.weaponImgHtml ? ir.weaponImgHtml(sl.id, 32, 'hs-pixel', false) : ir.imgHtml(key, 32, 'hs-pixel', color[sl.kind], false)) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '';
            const partSz = sl.id && slm && slm.partSizeLabel ? slm.partSizeLabel(sl.kind, sl.id) : null;
            const tip = ((sl.id ? this.hangarModuleTip(sl.kind, sl.id) : 'NO PART INSTALLED') + '\nSLOT SIZE: ' + 'SML'[Math.max(0, Math.min(2, slm.getSlotSizeLevel(this.hangarShipId, sl.kind, sl.index) | 0))] + (partSz ? '\nPART SIZE: ' + partSz : '')).replace(/"/g, '&quot;');
            // The installed part sits inside its slot at its own footprint (never bigger than the slot).
            const partLv = sl.id && slm.getPartSizeLevel ? Math.max(0, Math.min(lvl, slm.getPartSizeLevel(sl.kind, sl.id) | 0)) : lvl;
            const inner = sl.id
                ? `<span class="hs-slotview-part" style="width:${dims[partLv][0]}px;height:${dims[partLv][1]}px">${typeof physicalItem !== 'undefined' ? physicalItem.wrap(sl.kind, sl.id, dims[partLv][0] - 4, dims[partLv][1] - 4, color[sl.kind], img) : img}</span>`
                : img;
            return `<span class="hs-slotview-cell${sl.id ? ' is-filled' : ''}" data-ui-tip-instant data-ui-tip-head="${name}" data-ui-tip="${tip}" style="--pk-c:${color[sl.kind]};--svw:${dims[lvl][0]}px;--svh:${dims[lvl][1]}px" role="button" tabindex="0" data-slot-pick="${sl.kind}" data-slot-index="${sl.index}" aria-label="${name}">${inner}<span class="hs-slotview-size">${'SML'[partLv]}</span></span>`;
        };
        // Every row keeps the height of the biggest slot its area currently offers, filled or not.
        const toggleable = slm && slm.getToggleableAreas ? slm.getToggleableAreas() : [];
        const areaToggle = (area) => {
            if (toggleable.indexOf(area) === -1) return '';
            const on = !slm.isAreaEnabled || slm.isAreaEnabled(this.hangarShipId, area);
            const areaLabel = this.areaLabel ? this.areaLabel(area) : area.toUpperCase();
            return `<button type="button" class="hs-slotview-toggle" title="${on ? 'Switch off' : 'Switch on'}" data-slot-area-toggle-button="${this.hangarShipId}|${area}" aria-pressed="${on}" aria-label="${areaLabel} on/off"><span class="hs-slotview-switch${on ? ' is-on' : ''}" aria-hidden="true"></span><span>${on ? 'ON' : 'OFF'}</span></button>`;
        };
        const row = (label, items, lvl, ico, area) => `<div class="hs-slotview-row" style="--sv:${Math.max(...[dims[Math.min(2, Math.max(0, lvl | 0))][1]].concat(items.map((sl) => dims[sl.split && sl.kind === 'weapon' ? Math.max(0, slotLv(sl) - 1) : slotLv(sl)][1])))}px"><span class="hs-slotview-name">${ico || ''}<span>${label}</span>${areaToggle(area)}</span>` +
            `<span class="hs-slotview-slots">${items.length ? items.map((sl) => (sl.split && sl.kind === 'weapon' ? cell(sl, 0) + cell(sl, 1) : cell(sl))).join('') : '<em>NO SLOT</em>'}</span></div>`;
        const AREA_SHAPES = { front: '<path d="M8 1 L10.5 6 H5.5Z"/>', center: '<rect x="5.5" y="6.5" width="5" height="4"/>', back: '<path d="M5.5 11 H10.5 L11 15 H5Z"/>', wing: '<path d="M5 7 L0.5 13 L5 12Z M11 7 L15.5 13 L11 12Z"/>' };
        const areaIco = (id) => `<svg class="hs-slotview-ico" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">` +
            Object.keys(AREA_SHAPES).map((k) => `<g class="${k === id ? 'on' : ''}">${AREA_SHAPES[k]}</g>`).join('') + '</svg>';
        const kindIco = (kind) => (ir ? String(ir.imgHtml(kindIcon[kind], 16, 'hs-pixel hs-slotview-ico', color[kind], false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '');
        // Weapons sit in their hull area; every other slot type gets its own category row.
        const rows = groups.map((g) => row(g.label, list.filter((sl) => sl.kind === 'weapon' && g.areas.indexOf(sl.area) !== -1), levels[g.lv], areaIco(g.lv), g.lv));
        const strayWeapons = list.filter((sl) => sl.kind === 'weapon' && known.indexOf(sl.area) === -1);
        if (strayWeapons.length) rows.push(row('WEAPONS', strayWeapons, 0, kindIco('weapon')));
        [['defense', 'DEFENSE'], ['energy', 'ENERGY'], ['ability', 'ABILITIES']].forEach(([kind, label]) => {
            const items = list.filter((sl) => sl.kind === kind);
            if (items.length) rows.push(row(label, items, 0, kindIco(kind)));
        });
        return `<div class="hs-slotview">${rows.join('')}</div>`;
    },
    /** Click on a slot in the SLOTS list: modal with the parts that can go in it, as a sortable grid inventory. */
    openHangarSlotPicker(kind, index) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        if (!slm || !this.overlay) return;
        this.closeHangarSlotPicker();
        const shipId = this.hangarShipId;
        const poolKey = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy' }[kind];
        const inv = slm.getInventory(shipId) || {};
        const L = slm.getLoadout(shipId);
        const curList = (kind === 'weapon' && Array.isArray(L.weaponSlots) && L.weaponSlots.length ? L.weaponSlots : L[poolKey]) || [];
        const current = curList[index] || '';
        const equipped = {};
        ((kind === 'weapon' && Array.isArray(L.weaponSlots) && L.weaponSlots.length ? L.weaponSlots : L[poolKey]) || []).forEach((id) => { if (id) equipped[id] = true; });
        // Every owned part of every type is shown; those that can't go into this slot are dimmed.
        const pools = [['weapon', 'weapons'], ['defense', 'defenses'], ['ability', 'abilities'], ['energy', 'energy']];
        const items = [];
        pools.forEach(([k, key]) => (inv[key] || []).forEach((id) => items.push({ kind: k, id: id })));
        const sizeOf = (it) => (slm.getPartSizeLevel ? slm.getPartSizeLevel(it.kind, it.id) : 0);
        const labelOf = (it) => this.hangarModuleLabel(it.id);
        const stat = (it, k) => {
            const w = it.kind === 'weapon' && typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(it.id) : null;
            if (!w) return 0;
            return k === 'damage' ? Number(w.damage) || 0 : (w.cooldown ? 1000 / w.cooldown : 0);
        };
        const sorts = [['name', 'NAME'], ['size', 'SIZE'], ['equipped', 'EQUIPPED']].concat(kind === 'weapon' ? [['damage', 'DAMAGE'], ['rate', 'FIRE RATE']] : []);
        let sort = this._pickSort && sorts.some((x) => x[0] === this._pickSort) ? this._pickSort : 'name';
        const kindColors = (() => { const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d; return { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') }; })();
        const color = kindColors[kind];
        const blockedOf = (it) => {
            const id = it.id;
            if (it.kind !== kind) return 'WRONG SLOT TYPE';
            if (id === current) return null;
            const fit = slm.partFitsSlot ? slm.partFitsSlot(shipId, kind, id, index) : { ok: true };
            if (!fit.ok) return 'NEEDS ' + slm.slotSizeLabel(fit.need) + ' SLOT';
            const chk = slm.canInstallModule ? slm.canInstallModule(shipId, kind, id) : { ok: true };
            if (chk.ok || chk.removing || chk.reason === 'FULL' || chk.reason === 'TOO_BIG') return null;
            return String(chk.reason || 'BLOCKED').replace(/_/g, ' ');
        };
        const invPos = typeof physicalItem !== 'undefined' && physicalItem.invPositions ? physicalItem.invPositions(shipId) : {};
        const invGrid = slm.getInventoryGrid ? slm.getInventoryGrid(shipId) : { cols: 4, rows: 2 };
        const modal = document.createElement('div');
        modal.className = 'hs-res-buy-modal hs-slot-picker';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `<div class="hs-res-buy-dialog hs-pick-dialog">` +
            `<div class="hs-res-buy-head"><h3>${String(kind).toUpperCase()} SLOT ${index + 1}</h3>` +
            `<p class="hs-res-buy-sub">${this.shipName ? this.shipName(shipId) : ''} · SLOT SIZE ${slm.slotSizeLabel(slm.getSlotSizeLevel(shipId, kind, index))}</p></div>` +
            `<div class="hs-pick-sort" role="group" aria-label="Sort"></div>` +
            `<div class="hs-pick-body">` +
            // Same cols × rows as the ship's inventory (bay inventory / start profile).
            `<div class="hs-pick-grid" style="--pk-c:${color}; grid-template-columns: repeat(${invGrid.cols}, 64px); grid-template-rows: repeat(${invGrid.rows}, 64px); width: calc(${invGrid.cols} * 64px + ${invGrid.cols - 1} * 4px); height: calc(${invGrid.rows} * 64px + ${invGrid.rows - 1} * 4px); min-height: 0; max-height: none; overflow: hidden"></div>` +
            (kind === 'weapon' ? `<div class="hs-pick-keys" role="group" aria-label="Shortcut"></div>` : '') +
            `</div>` +
            `<div class="hs-res-buy-actions">${current ? '<button type="button" class="action-button" data-pick-set="">EMPTY SLOT</button>' : ''}<button type="button" class="action-button hs-res-buy-close" data-pick-close>CLOSE</button></div></div>`;
        const grid = modal.querySelector('.hs-pick-grid');
        const bar = modal.querySelector('.hs-pick-sort');
        // Shortcut of this weapon slot: every key that fires it (SPACE / A / S / D), any combination.
        const keysBar = modal.querySelector('.hs-pick-keys');
        const drawKeys = () => {
            if (!keysBar) return;
            const L = slm.getLoadout(shipId);
            const set = slm.getWeaponKeySet(L, index);
            const allKey = slm.getAllFireKey ? slm.getAllFireKey(L) : 'space';
            keysBar.innerHTML = '<span class="hs-pick-keys-label">SHORTCUT</span>' + ['space', 'a', 's', 'd'].map((k) => {
                const taken = k === allKey && k !== 'space';   // that key already fires every weapon
                const on = set.indexOf(k) !== -1;
                return `<button type="button" role="checkbox" aria-checked="${on}" class="hs-pick-keyopt${on ? ' is-on' : ''}${taken ? ' is-off' : ''}" data-pick-key="${k}"${taken ? ' disabled data-ui-tip="ALREADY FIRES ALL WEAPONS"' : ''}><span class="hs-pick-keybox"></span><span class="hs-pick-keyname">${k.toUpperCase()}</span></button>`;
            }).join('');
        };
        const draw = () => {
            bar.innerHTML = sorts.map(([k, l]) => `<button type="button" class="hs-pick-sortbtn${k === sort ? ' is-active' : ''}" data-pick-sort="${k}">${l}</button>`).join('');
            const sorted = items.slice().sort((a, b) => {
                const bySlot = (blockedOf(a) ? 1 : 0) - (blockedOf(b) ? 1 : 0);   // placeable parts first
                if (bySlot) return bySlot;
                if (sort === 'size') return sizeOf(a) - sizeOf(b) || labelOf(a).localeCompare(labelOf(b));
                if (sort === 'equipped') return ((b.kind === kind && equipped[b.id]) ? 1 : 0) - ((a.kind === kind && equipped[a.id]) ? 1 : 0) || labelOf(a).localeCompare(labelOf(b));
                if (sort === 'damage') return stat(b, 'damage') - stat(a, 'damage');
                if (sort === 'rate') return stat(b, 'rate') - stat(a, 'rate');
                return labelOf(a).localeCompare(labelOf(b));
            });
            grid.innerHTML = sorted.map((it) => {
                const id = it.id;
                const blocked = blockedOf(it);
                const tip = (String(this.hangarModuleTip(it.kind, id)) + '\nPART SIZE ' + slm.partSizeLabel(it.kind, id) + (blocked ? '\n' + blocked : '')).replace(/"/g, '&quot;');
                // Diablo-style footprint: S = 1x1, M = 1 wide x 2 tall, L = 2x2 cells.
                const lv = Math.max(0, Math.min(2, sizeOf(it)));
                const span = [[1, 1], [1, 2], [2, 2]][lv];
                // Same tile as in the ship's inventory (bay inventory positions).
                const pp = invPos[it.kind + ':' + id];
                const here = it.kind === kind;
                const usedElsewhere = here && equipped[id] && id !== current;
                const assignedBadge = usedElsewhere
                    ? `<span class="hs-pick-assigned" data-ui-tip="ALREADY ASSIGNED TO ANOTHER SLOT"><svg viewBox="0 0 10 10" width="10" height="10" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 5l2 2 5-5-1-1-4 4-1-1z"/></svg></span>`
                    : '';
                return `<button type="button" style="grid-column: ${pp ? pp[0] + ' / ' : ''}span ${span[0]}; grid-row: ${pp ? pp[1] + ' / ' : ''}span ${span[1]}; --pk-c:${kindColors[it.kind]}" class="hs-pick-cell${here && id === current ? ' is-current' : ''}${usedElsewhere ? ' is-used' : ''}${blocked ? ' is-blocked' : ''}" data-pick-set="${id}"${blocked ? ' disabled' : ''} data-ui-tip-instant data-ui-tip-head="${this.hangarModuleLabel(id).replace(/"/g, '')}" data-ui-tip="${tip}">` +
                    `${typeof physicalItem !== 'undefined' ? physicalItem.wrap(it.kind, id, span[0] * 64 + (span[0] - 1) * 4 - 8, span[1] * 64 + (span[1] - 1) * 4 - 8, kindColors[it.kind], '') : ''}<span class="hs-pick-ico">${this.moduleIconHtml(it.kind, id, 32, 'hs-pixel', false)}</span>` +
                    assignedBadge +
                    `<span class="hs-pick-size">${slm.partSizeLabel(it.kind, id)}</span></button>`;
            }).join('');
        };
        draw();
        drawKeys();
        const close = () => this.closeHangarSlotPicker();
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-pick-close]')) { close(); return; }
            const sb = e.target.closest('[data-pick-sort]');
            if (sb) { sort = this._pickSort = sb.getAttribute('data-pick-sort'); draw(); return; }
            const cell = e.target.closest('[data-pick-set]');
            if (cell && !cell.disabled) { close(); this.applyHangarSlotChoice(kind, index, cell.getAttribute('data-pick-set'), null); }
        });
        if (keysBar) {
            keysBar.addEventListener('click', (e) => {
                const box = e.target.closest('[data-pick-key]');
                if (!box || box.disabled) return;
                e.preventDefault();
                e.stopPropagation();
                slm.toggleWeaponKey(shipId, index, box.getAttribute('data-pick-key'));
                drawKeys();
                if (this.drawHangarBay) this.drawHangarBay();
            });
        }
        this._pickKeys = (e) => { if (e.key === 'Escape' || e.key === 'Backspace') { close(); e.preventDefault(); e.stopImmediatePropagation(); } };
        document.addEventListener('keydown', this._pickKeys, true);
        // The slot being edited stays highlighted in the SLOTS list while the picker is open.
        const slotEl = this.overlay.querySelector(`[data-slot-pick="${kind}"][data-slot-index="${index}"]`);
        if (slotEl) slotEl.classList.add('is-picking');
        this.overlay.appendChild(modal);
    },
    closeHangarSlotPicker() {
        if (this._pickKeys) { document.removeEventListener('keydown', this._pickKeys, true); this._pickKeys = null; }
        // Only the modal: the bay inventory sidebar is also a .hs-slot-picker.
        const m = this.overlay && this.overlay.querySelector('.hs-res-buy-modal.hs-slot-picker');
        if (m) m.remove();
        this.overlay && this.overlay.querySelectorAll('.hs-slotview-cell.is-picking').forEach((el) => el.classList.remove('is-picking'));
    },
    /** Stat type colour (matches the .hs-hangar-weapon-stat[data-stat] CSS). */
    hangarStatColor(type) {
        return { damage: '#ff6a4a', shotspeed: '#4ad8ff', firerate: '#ffa04a', speed: '#6dff8a', armor: '#7aa8ff', energy: '#ffd24a' }[type] || null;
    },
    /** Ability row stat line: its stat effects as icon + change (ability-stats.js). */
    hangarAbilityStatsHtml(id) {
        const e = shipLoadoutManager.getAbilityStatEffect ? shipLoadoutManager.getAbilityStatEffect(id) : null;
        if (!e) {
            // No stat effect (charge, shield, AI …): its short description instead.
            const a = typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.getAbility(id) : null;
            const text = a && (a.uiDescription || a.description);
            return text ? `<span class="hs-hangar-weapon-stats is-desc">${String(text).toUpperCase()}</span>` : '';
        }
        const pct = (m) => (m >= 1 ? '+' : '−') + Math.round(Math.abs(m - 1) * 100) + '%';
        const stat = (icon, tip, value, bad, type) =>
            `<span class="hs-hangar-weapon-stat${bad ? ' is-bad' : ''}" data-stat="${type}" data-ui-tip="${tip}">${this.iconHtml(icon, 16, 'hs-pixel', false, this.hangarStatColor(type))}${value}</span>`;
        let html = '';
        if (e.speedMul) html += stat('statSpeed', 'MOVE SPEED', pct(e.speedMul), e.speedMul < 1, 'speed');
        if (e.damageMul) html += stat('statDamage', 'WEAPON DAMAGE', pct(e.damageMul), e.damageMul < 1, 'damage');
        if (e.fireRateMul) html += stat('shotRapid', 'FIRE RATE', pct(e.fireRateMul), e.fireRateMul < 1, 'firerate');
        if (e.armor) html += stat('statArmor', 'ARMOR', (e.armor > 0 ? '+' : '') + e.armor, e.armor < 0, 'armor');
        return html ? `<span class="hs-hangar-weapon-stats">${html}</span>` : '';
    },
    /**
     * Hovering an ability previews the SPEED tile with it toggled (equipped →
     * without it, not equipped → with it, replacing the old one if it's a
     * single slot): new value + coloured change.
     */
    bindHangarAbilityHover(cell) {
        const valueEl = () => this.overlay && this.overlay.querySelector('.hs-hangar-stat.is-speed .hs-stat-value');
        cell.addEventListener('pointerenter', () => {
            const el = valueEl();
            const slm = shipLoadoutManager;
            if (!el || !slm.getAbilityStatMods) return;
            const id = cell.getAttribute('data-part-id');
            const L = slm.getLoadout(this.hangarShipId);
            const cur = (L.abilities || []).slice();
            const caps = slm.getSlotCaps(this.hangarShipId, slm.resolveModelClass(this.hangarShipId));
            const cap = Math.max(0, Number(caps.abilities) || 0);
            let next = cur.filter((a) => a !== id);
            if (next.length === cur.length) next = (cur.length >= cap && cap > 0 ? cur.slice(0, cap - 1) : cur).concat(id);
            const model = this.getHangarPreviewModel(this.hangarShipId);
            const base = Number(model.baseSpeed) || Number(model.speed) || 0;
            const now = Number(model.speed) || 0;
            const then = Math.round(base * slm.getAbilityStatMods(next).speedMul * 100) / 100;
            const d = Math.round((then - now) * 100) / 100;
            if (!el.hasAttribute('data-orig')) el.setAttribute('data-orig', el.innerHTML);
            el.innerHTML = `${then}` + (d ? `<span class="hs-stat-delta ${d > 0 ? 'is-up' : 'is-down'}">${d > 0 ? '+' : ''}${d}</span>` : '');
        });
        cell.addEventListener('pointerleave', () => {
            const el = valueEl();
            if (el && el.hasAttribute('data-orig')) {
                el.innerHTML = el.getAttribute('data-orig');
                el.removeAttribute('data-orig');
            }
        });
    },
    /** Energy row stat line: recovery rate (icon label + number), like the weapon stats. */
    hangarEnergyStatsHtml(id) {
        const slm = shipLoadoutManager;
        const regen = slm.getEnergyCoreRegen ? slm.getEnergyCoreRegen(id) : 0;
        if (!regen) return '';
        return `<span class="hs-hangar-weapon-stats">` +
            `<span class="hs-hangar-weapon-stat" data-stat="energy" data-ui-tip="ENERGY RECOVERY PER SECOND">${this.iconHtml('statEnergy', 16, 'hs-pixel', false, this.hangarStatColor('energy'))}+${regen}/S</span>` +
            `</span>`;
    },
    /** Compact DMG / SPD / fire-rate line for a weapon row. */
    hangarWeaponStatsHtml(id) {
        if (typeof weaponConfigManager === 'undefined') return '';
        const w = weaponConfigManager.getWeapon(id);
        if (!w) return '';
        const rate = w.cooldown ? (1000 / w.cooldown).toFixed(1) : '—';
        // Icon instead of a text label (same icons as the details panel); label stays in the tooltip.
        const stat = (icon, tip, value, type, boosted) =>
            `<span class="hs-hangar-weapon-stat${boosted ? ' is-boosted' : ''}" data-stat="${type}" data-ui-tip="${tip}">${this.iconHtml(icon, 16, 'hs-pixel', false, this.hangarStatColor(type))}${value}${boosted ? '<span class="hs-stat-boost">▲</span>' : ''}</span>`;
        // Hull-class and faction affinity (+20% each, as in game): show the
        // boosted damage and name where the bonus comes from.
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel ? this.getHangarShipModel(shipId) : null;
        const cfg = typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(shipId) : null;
        const profile = typeof profileManager !== 'undefined' && profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
        const faction = (model && model.faction) || (cfg && cfg.faction) || (profile && profile.faction) || '';
        const classMul = weaponConfigManager.getShipClassWeaponMul ? weaponConfigManager.getShipClassWeaponMul(model && model.modelClass, id) : 1;
        const factionMul = weaponConfigManager.getFactionWeaponMul ? weaponConfigManager.getFactionWeaponMul(faction, id) : 1;
        const sources = [];
        if (classMul > 1) sources.push('SHIP +' + Math.round((classMul - 1) * 100) + '%');
        if (factionMul > 1) sources.push(String(faction).toUpperCase() + ' +' + Math.round((factionMul - 1) * 100) + '%');
        const dmg = Math.round((w.damage || 0) * classMul * factionMul);
        const dmgTip = sources.length ? 'DAMAGE ' + w.damage + ' → ' + dmg + ' (' + sources.join(' · ') + ')' : 'DAMAGE';
        return `<span class="hs-hangar-weapon-stats">` +
            stat('statDamage', dmgTip, dmg, 'damage', sources.length > 0) +
            stat('statSpeed', 'SHOT SPEED', w.speed, 'shotspeed') +
            stat('shotRapid', 'SHOTS PER SECOND', rate + '/S', 'firerate') +
            `</span>`;
    },
    /** The weapon's on-ship hardware sprite, shown on the row when it is slotted. */
    hangarWeaponMountHtml(id) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getModuleShipSprite
            || typeof iconRenderer === 'undefined' || !iconRenderer.spriteToSvgUrl) return '';
        // Same gun art as on the ship in game (weapon barrel on faction breech).
        const loader = (typeof graphicsManager !== 'undefined') ? graphicsManager.shipAssetLoader : null;
        // Same faction style the hull renderer picks for this ship.
        const style = (loader && loader.resolvePlayerFactionStyle && this.getHangarPreviewModel)
            ? loader.resolvePlayerFactionStyle(this.getHangarPreviewModel(this.hangarShipId || 'player_scrap'))
            : (this.currentFactionStyle ? this.currentFactionStyle() : null);
        let sprite = null;
        if (loader && loader.generateWeaponGrid) {
            // Same generated gun as on the ship, laid on its side (muzzle
            // right) so the long barrel fits the row.
            const up = loader.generateWeaponGrid(id, 12, 28);
            sprite = up[0].map((_, c) => up.map((row, r) => up[up.length - 1 - r][c]));
        } else {
            sprite = (loader && loader.getWeaponTemplate)
                ? loader.getWeaponTemplate(id, style, false)
                : shipLoadoutManager.getModuleShipSprite({ kind: 'weapon', id: id });
        }
        if (!sprite) return '';
        // Exactly the faction colours the gun has on the hull (same shade ramp).
        const ramp = loader && loader.getWeaponShadeRamp ? loader.getWeaponShadeRamp(style, id) : null;
        let url;
        if (ramp) {
            let rects = '';
            sprite.forEach((row, r) => row.forEach((idx, c) => {
                const col = idx && ramp[idx];
                if (col) rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="${col}"/>`;
            }));
            url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sprite[0].length} ${sprite.length}" shape-rendering="crispEdges">${rects}</svg>`);
        } else {
            const tint = (style && (style.hull || style.accent)) || null;
            url = iconRenderer.spriteToSvgUrl(sprite, tint, false, false, false);
        }
        return `<span class="hs-hangar-part-mount" data-ui-tip="SLOTTED">` +
            `<img src="${url}" alt="" draggable="false"></span>`;
    },
    renderHangarPartsGrid(inventory, loadout) {
        return `<div class="hs-hangar-parts">` + HANGAR_PART_SECTIONS.map((sec) => {
            const equipped = (loadout && loadout[sec.key]) || [];
            // PARTS view lists only what's fitted on the ship; the slot modal handles picking.
            const ids = ((inventory && inventory[sec.key]) || []).filter((id) => equipped.indexOf(id) !== -1);
            const slm = shipLoadoutManager;
            // One slot of this kind → picking a part replaces the other: radio.
            // Several slots → each part is independently on/off: switch.
            const caps = slm.getSlotCaps && slm.resolveModelClass
                ? slm.getSlotCaps(this.hangarShipId, slm.resolveModelClass(this.hangarShipId)) : {};
            const single = Math.max(0, Number(caps[sec.key]) || 0) <= 1;
            const cells = ids.map((id) => {
                const on = equipped.indexOf(id) !== -1;
                const label = this.hangarModuleLabel(id);
                const size = slm.partSizeLabel ? slm.partSizeLabel(sec.kind, id) : 'S';
                const fits = !slm.partFitsSlot || slm.partFitsSlot(this.hangarShipId, sec.kind, id).ok;
                const isToggle = sec.kind !== 'weapon';
                // No radio / switch box: the glowing icon and bright name show "on".
                const state = '';
                return `<button type="button" class="hs-hangar-part${on ? ' is-equipped' : ''}${on && this._hangarExpandedPart === sec.kind + ':' + id ? ' is-expanded' : ''}${fits ? '' : ' is-too-big'}${isToggle ? ' is-toggle' : ''}"` +
                    (isToggle ? (single ? ` role="radio" aria-checked="${on}"` : ` role="switch" aria-checked="${on}"`) : '') +
                    ` data-part-kind="${sec.kind}" data-part-id="${id}" data-part-size="${size}"` +
                    ` data-ui-tip="${String(this.hangarModuleTip(sec.kind, id)).replace(/"/g, '&quot;')}\nSIZE ${size}${on ? ' · EQUIPPED' : ''}${fits ? '' : ' · NEEDS ' + size + ' SLOT'}">` +
                    // No slot-type glyph per row: the section header already names the type.
                    `<span class="hs-hangar-part-icon">` +
                    `${this.moduleIconHtml(sec.kind, id, 32, 'hs-pixel', false)}</span>` +
                    `<span class="hs-hangar-part-name"><span class="hs-hangar-part-title">${label} ` +
                    `<span class="hs-hangar-part-size is-${size}">(${size})</span></span>` +
                    (sec.kind === 'weapon' ? this.hangarWeaponStatsHtml(id) : '') +
                    (sec.kind === 'energy' ? this.hangarEnergyStatsHtml(id) : '') +
                    (sec.kind === 'ability' ? this.hangarAbilityStatsHtml(id) : '') + `</span>` +
                    (sec.kind === 'weapon' && on ? this.hangarWeaponMountHtml(id) : '') + state +
                    `</button>` +
                    (on && this._hangarExpandedPart === sec.kind + ':' + id ? this.hangarPartDetailsHtml(sec.kind, id) : '');
            }).join('');
            const collapsed = !!this.hangarCollapsedSections()[sec.kind];
            // Pixel sprite + label in the section's category colour.
            const kindColor = typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor
                ? iconRenderer.getModuleKindColor(sec.kind) : null;
            return `<section class="hs-hangar-parts-section${collapsed ? ' is-collapsed' : ''}" data-part-section="${sec.kind}"${kindColor ? ` style="--kind-color:${kindColor}"` : ''}>` +
                `<h4 class="hs-hangar-parts-title" data-part-section-toggle="${sec.kind}" role="button" tabindex="0" aria-expanded="${!collapsed}">` +
                `<span class="hs-hangar-parts-icon">${this.iconHtml(sec.icon, 32, 'hs-pixel', false, kindColor)}</span>` +
                `<span class="hs-hangar-parts-label">${sec.label}</span>` +
                this.hangarSectionSlotStripHtml(sec, sec.kind === 'weapon' && loadout && loadout.weaponSlots && loadout.weaponSlots.length
                    ? loadout.weaponSlots : equipped, caps) +
                `<span class="hs-hangar-parts-caret" aria-hidden="true">${collapsed ? '▼' : '▲'}</span></h4>` +
                `<div class="hs-hangar-parts-grid">${cells || this.emptyHtml('hsHangar', 'NONE EQUIPPED')}</div>` +
                `</section>`;
        }).join('') + `</div>`;
    },
    /** Collapsed parts sections { kind: true }, loaded once from localStorage. */
    hangarCollapsedSections() {
        if (!this._hangarCollapsedSections) {
            let map = {};
            try {
                const raw = JSON.parse(localStorage.getItem('vf_hs_hangar_collapsed_sections') || '{}');
                if (raw && typeof raw === 'object') map = raw;
            } catch (err) { /* ignore */ }
            this._hangarCollapsedSections = map;
        }
        return this._hangarCollapsedSections;
    },
    /**
     * Section header slot strip: one box per slot of this kind (weapons count
     * slots, not guns), filled with the assigned part's icon; empty boxes are
     * free. Clicking a filled box unequips that part.
     */
    hangarSectionSlotStripHtml(sec, equipped, caps) {
        const slm = shipLoadoutManager;
        let cap = Math.max(0, Number(caps[sec.key]) || 0);
        if (sec.kind === 'weapon' && slm.weaponMountSlots) cap = slm.weaponMountSlots(cap);
        const kc = typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor
            ? iconRenderer.getModuleKindColor(sec.kind) : null;
        let boxes = '';
        for (let i = 0; i < cap; i++) {
            const id = equipped[i];
            boxes += id
                ? `<span class="hs-section-slot is-filled" data-section-slot="${sec.kind}|${i}" data-ui-tip="${this.hangarModuleLabel(id)} — CLICK TO UNEQUIP">` +
                  `${this.moduleIconHtml(sec.kind, id, 24, 'hs-pixel', false)}</span>`
                : `<span class="hs-section-slot" data-ui-tip="FREE ${sec.label.replace(/S$/, '')} SLOT"></span>`;
        }
        return `<span class="hs-section-slots"${kc ? ` style="--kind-color:${kc}"` : ''}>${boxes}</span>`;
    },
    /** Slot index for a part: nearest pin of its kind to the drop point, else first empty, else first. */
    hangarSlotForPart(kind, clientX, clientY) {
        const slots = Array.from(this.overlay.querySelectorAll(`.hs-hangar-slot[data-slot-kind="${kind}"]`));
        if (!slots.length) return -1;
        if (clientX != null) {
            let best = null;
            let bestDist = Infinity;
            slots.forEach((el) => {
                const pin = el.querySelector('.hs-hangar-slot-pin');
                if (!pin) return;
                const r = pin.getBoundingClientRect();
                const d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
                if (d < bestDist) {
                    bestDist = d;
                    best = el;
                }
            });
            if (best) return Number(best.getAttribute('data-slot-index') || 0);
        }
        const empty = slots.find((el) => el.classList.contains('is-empty'));
        return Number((empty || slots[0]).getAttribute('data-slot-index') || 0);
    },
    bindHangarPartsGrid() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('[data-slot-area-toggle]').forEach((input) => {
            input.onchange = () => {
                const [id, area] = input.getAttribute('data-slot-area-toggle').split('|');
                const res = shipLoadoutManager.setAreaEnabled(id, area, input.checked);
                if (!res.ok) return;
                this._hangarLastModel = null;
                this._hangarRecenter = true;
                this.createUI();
            };
        });
        this.overlay.querySelectorAll('[data-slot-area-toggle-button]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const [id, area] = button.getAttribute('data-slot-area-toggle-button').split('|');
                const res = shipLoadoutManager.setAreaEnabled(id, area, !shipLoadoutManager.isAreaEnabled(id, area));
                if (res.ok) {
                    this._hangarLastModel = null;
                    this._hangarRecenter = true;
                    this.createUI();
                }
            });
        });
        this.overlay.querySelectorAll('[data-hangar-left-view]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._hangarLeftView = btn.getAttribute('data-hangar-left-view');
                // Remembered across reloads (read in the HomeStationUI constructor).
                try {
                    localStorage.setItem('vf_hs_hangar_left_view', this._hangarLeftView);
                } catch (err) { /* ignore */ }
                this.createUI();
            });
        });
        this.overlay.querySelectorAll('[data-part-section-toggle]').forEach((head) => {
            const toggle = () => {
                const kind = head.getAttribute('data-part-section-toggle');
                const map = this.hangarCollapsedSections();
                map[kind] = !map[kind];
                // Remembered across reloads (like the AREAS / PARTS view).
                try {
                    localStorage.setItem('vf_hs_hangar_collapsed_sections', JSON.stringify(map));
                } catch (err) { /* ignore */ }
                const sec = head.closest('.hs-hangar-parts-section');
                const c = this._hangarCollapsedSections[kind];
                if (sec) sec.classList.toggle('is-collapsed', c);
                head.setAttribute('aria-expanded', String(!c));
                const caret = head.querySelector('.hs-hangar-parts-caret');
                if (caret) caret.textContent = c ? '▼' : '▲';
            };
            head.addEventListener('click', (e) => {
                const box = e.target.closest('[data-section-slot]');
                if (box) {
                    // Filled slot box: unequip that part.
                    e.stopPropagation();
                    const [kind, idx] = box.getAttribute('data-section-slot').split('|');
                    this.applyHangarSlotChoice(kind, Number(idx), '', null);
                    return;
                }
                toggle();
            });
            head.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                toggle();
            });
        });
        this.overlay.querySelectorAll('.hs-hangar-part').forEach((cell) => {
            // Pointer drag instead of native DnD: only the icon follows the cursor.
            cell.setAttribute('draggable', 'false');
            cell.addEventListener('dragstart', (e) => e.preventDefault());
            // Only weapons are placed on the ship; every other part type is
            // a plain on/off switch here in the sidebar.
            if (cell.getAttribute('data-part-kind') === 'ability') this.bindHangarAbilityHover(cell);
            if (cell.getAttribute('data-part-kind') !== 'weapon') {
                cell.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleHangarPart(cell);
                });
                return;
            }
            // No drag & drop from the PARTS list: slots are filled via the SLOTS view.
            cell.addEventListener('click', (e) => {
                e.preventDefault();
                if (cell.classList.contains('is-equipped')) this.toggleHangarPartDetails(cell);
                else this.equipHangarPart(cell, null);
            });
            cell.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                if (cell.classList.contains('is-equipped')) {
                    this.toggleHangarPartDetails(cell);
                    return;
                }
                this.equipHangarPart(cell, null);
            });
        });
    },
    /** Non-weapon part: switch it on (first free slot, else the first) or off. */
    toggleHangarPart(cell) {
        const kind = cell.getAttribute('data-part-kind');
        const id = cell.getAttribute('data-part-id');
        const key = shipLoadoutManager.kindToLoadoutKey(kind);
        const list = shipLoadoutManager.getLoadout(this.hangarShipId)[key] || [];
        const at = list.indexOf(id);
        if (at !== -1) {
            this.applyHangarSlotChoice(kind, at, '', null);
            return;
        }
        const caps = shipLoadoutManager.getSlotCaps(this.hangarShipId, shipLoadoutManager.resolveModelClass(this.hangarShipId));
        const cap = Math.max(0, Number(caps[key]) || 0);
        if (!cap) {
            this.playButtonResult(cell, false, 'NO ' + kind.toUpperCase() + ' SLOT');
            return;
        }
        // Free slot → goes in. One slot → swap (like a radio). Several slots
        // all taken → no silent replace: say so and point at the slot strip.
        if (list.length < cap) {
            this.applyHangarSlotChoice(kind, list.length, id, null);
        } else if (cap === 1) {
            this.applyHangarSlotChoice(kind, 0, id, null);
        } else {
            const strip = cell.closest('.hs-hangar-parts-section');
            const slots = strip && strip.querySelector('.hs-section-slots');
            if (slots) {
                slots.classList.remove('is-denied');
                void slots.offsetWidth;
                slots.classList.add('is-denied');
            }
            this.playButtonResult(cell, false, 'ALL ' + cap + ' ' + kind.toUpperCase() + ' SLOTS FULL — UNEQUIP ONE FIRST');
        }
    },
    /** Equip a grid part into a slot (explicit slot element, or the first free one of its kind). */
    equipHangarPart(cell, slotEl) {
        const kind = cell.getAttribute('data-part-kind');
        const id = cell.getAttribute('data-part-id');
        let index = slotEl
            ? Number(slotEl.getAttribute('data-slot-index') || 0)
            : this.hangarSlotForPart(kind);
        // The first free mount is not necessarily large enough. If the
        // requested mount cannot hold the part, choose the nearest compatible
        // empty mount before attempting the install.
        if (shipLoadoutManager.partFitsSlot) {
            const fit = shipLoadoutManager.partFitsSlot(this.hangarShipId, kind, id, index);
            if (!fit.ok) {
                const slots = Array.from(this.overlay.querySelectorAll(
                    `.hs-hangar-slot[data-slot-kind="${kind}"]`
                ));
                const compatible = slots.find((el) => {
                    const i = Number(el.getAttribute('data-slot-index') || 0);
                    return !this.hangarSlotModuleId(kind, i)
                        && shipLoadoutManager.partFitsSlot(this.hangarShipId, kind, id, i).ok;
                });
                if (compatible) index = Number(compatible.getAttribute('data-slot-index') || 0);
            }
        }
        if (index < 0) {
            this.playButtonResult(cell, false, 'NO ' + kind.toUpperCase() + ' SLOT');
            return;
        }
        this.applyHangarSlotChoice(kind, index, id, null);
    },
    /**
     * Pull an equipped part out of its slot: drop on another slot of its
     * type to move (swapping if occupied), drop off the ship to unequip.
     */
    /**
     * Module id in a slot. Weapons are positional (weaponSlots: 0 = nose,
     * gaps allowed); the compact `weapons` list does not match slot indices.
     */
    hangarSlotModuleId(kind, index) {
        const L = shipLoadoutManager.getLoadout(this.hangarShipId);
        const list = kind === 'weapon' && Array.isArray(L.weaponSlots)
            ? L.weaponSlots
            : (L[shipLoadoutManager.kindToLoadoutKey(kind)] || []);
        return list[Number(index) || 0] || null;
    },
    startHangarSlotPull(slotEl, downEvent) {
        const kind = slotEl.getAttribute('data-slot-kind');
        const index = Number(slotEl.getAttribute('data-slot-index') || 0);
        const id = this.hangarSlotModuleId(kind, index);
        if (!id) return;
        const holder = document.createElement('span');
        holder.innerHTML = this.moduleIconHtml(kind, id, 32, 'hs-pixel', false);
        this.startHangarPartDrag(null, downEvent, {
            kind: kind,
            id: id,
            iconEl: holder.querySelector('img'),
            sourceSlot: slotEl,
            sourceIndex: index
        });
    },
    /** Slot element holding an on-ship module (matched by kind, id and face). */
    hangarSlotForModule(mod) {
        if (!this.overlay || !mod) return null;
        const pins = Array.from(this.overlay.querySelectorAll(
            `.hs-hangar-slot[data-slot-kind="${mod.kind}"] .hs-hangar-slot-pin`
        )).filter((pin) => pin.getAttribute('data-mod-id') === mod.id);
        const pin = pins.find((p) => p.getAttribute('data-mod-face') === String(mod.face || '')) || pins[0];
        return pin ? pin.closest('.hs-hangar-slot') : null;
    },
});
