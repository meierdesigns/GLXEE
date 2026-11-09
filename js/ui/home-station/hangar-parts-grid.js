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
        const view = this._hangarLeftView === 'parts' ? 'parts' : 'slots';
        const btn = (id, label, icon) =>
            `<button type="button" class="hs-hangar-view-btn${view === id ? ' is-active' : ''}" data-hangar-left-view="${id}" aria-pressed="${view === id}">` +
            `${this.iconHtml(icon, 40, 'hs-pixel hs-pixel-40', false, view === id ? '#05060a' : null)}<span>${label}</span></button>`;
        return `<div class="hs-hangar-view-toggle" role="group" aria-label="Sidebar view">${btn('slots', 'SLOTS', 'hsUpgrade')}${btn('parts', 'PARTS', 'hsCraft')}</div>`;
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
            const slotSz = 'SML'[Math.max(0, Math.min(2, slm.getSlotSizeLevel(this.hangarShipId, sl.kind, sl.index) | 0))];
            const tip = ((sl.id ? this.hangarModuleTip(sl.kind, sl.id) : 'NO PART INSTALLED') + '\nSIZE_FIT:' + slotSz + ':' + (partSz || slotSz)).replace(/"/g, '&quot;');
            // The installed part sits inside its slot at its own footprint (never bigger than the slot).
            const partLv = sl.id && slm.getPartSizeLevel ? Math.max(0, Math.min(lvl, slm.getPartSizeLevel(sl.kind, sl.id) | 0)) : lvl;
            const inner = sl.id
                ? `<span class="hs-slotview-part" style="width:${dims[partLv][0]}px;height:${dims[partLv][1]}px">${typeof physicalItem !== 'undefined' ? physicalItem.wrap(sl.kind, sl.id, dims[partLv][0] - 4, dims[partLv][1] - 4, color[sl.kind], img) : img}</span>`
                : img;
            return `<span class="hs-slotview-cell${sl.id ? ' is-filled' : ''}" data-ui-tip-instant data-ui-tip-head="${name}" data-ui-tip="${tip}" style="--pk-c:${color[sl.kind]};--svw:${dims[lvl][0]}px;--svh:${dims[lvl][1]}px" role="button" tabindex="0" data-slot-pick="${sl.kind}" data-slot-index="${sl.index}" aria-label="${name}">${inner}<span class="hs-slotview-size">${'SML'[partLv]}</span></span>`;
        };
        // Just the slots, side by side — no hull-area grouping/labels/toggles here any more
        // (area on/off still lives in the AREAS/LAYOUT sub-tab, area-upgrades.js).
        const cells = list.map((sl) => (sl.split && sl.kind === 'weapon' ? cell(sl, 0) + cell(sl, 1) : cell(sl))).join('');
        return `<div class="hs-slotview"><div class="hs-slotview-row"><span class="hs-slotview-slots">${cells || '<em>NO SLOT</em>'}</span></div></div>`;
    },
    /** Click on a slot in the SLOTS list: modal with the ship's real storage grid (same as bay / station). */
    openHangarSlotPicker(kind, index) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const profile = typeof profileManager !== 'undefined' && profileManager.getActiveProfile
            ? profileManager.getActiveProfile() : null;
        if (!slm || !this.overlay || !profile || !this.renderShipStorage) return;
        this.closeHangarSlotPicker();
        const shipId = this.hangarShipId;
        const poolKey = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy' }[kind];
        const L = slm.getLoadout(shipId);
        const curList = (kind === 'weapon' && Array.isArray(L.weaponSlots) && L.weaponSlots.length ? L.weaponSlots : L[poolKey]) || [];
        const current = curList[index] || '';
        const pickSlotSz = 'SML'[Math.max(0, Math.min(2, slm.getSlotSizeLevel(shipId, kind, index) | 0))];
        const kindColors = (() => { const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d; return { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') }; })();
        const blockedOf = (partKind, id) => {
            if (partKind !== kind) return 'WRONG SLOT TYPE';
            if (id === current) return null;
            const fit = slm.partFitsSlot ? slm.partFitsSlot(shipId, kind, id, index) : { ok: true };
            if (!fit.ok) return 'NEEDS ' + slm.slotSizeLabel(fit.need) + ' SLOT';
            const chk = slm.canInstallModule ? slm.canInstallModule(shipId, kind, id) : { ok: true };
            if (chk.ok || chk.removing || chk.reason === 'FULL' || chk.reason === 'TOO_BIG') return null;
            return String(chk.reason || 'BLOCKED').replace(/_/g, ' ');
        };
        const cs = (this.STORAGE_CELL_PX | 0) || 56;
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const ico = (key, col) => (ir ? String(ir.imgHtml(key, 16, 'hs-pixel', col, false) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '');
        const filter = kind; // default: this slot's type (same filter chips as bay inventory)
        const fb = [['all', 'ALL', 'hsCraft', '#ffffff'], ['weapon', 'WEAPONS', 'statWeapon', kindColors.weapon], ['defense', 'DEFENSE', 'statArmor', kindColors.defense], ['ability', 'ABILITIES', 'statAbilities', kindColors.ability], ['energy', 'ENERGY', 'statEnergy', kindColors.energy]]
            .map(([k, l, key, col]) => `<button type="button" class="hs-bay-inv-filter${k === filter ? ' is-active' : ''}" style="--fc:${col}" data-inv-filter="${k}" data-ui-tip="${l}" aria-label="${l}"><span class="is-off">${ico(key, col)}</span><span class="is-on">${ico(key, '#05060a')}</span></button>`).join('');
        // Exact same ship-storage markup as bay inventory / station SHIP STORAGE — one grid, one footprint layout.
        const gridHtml = this.renderShipStorage(profile, shipId, { extraGridClass: 'hs-pick-grid', tipAction: false });
        const modal = document.createElement('div');
        modal.className = 'hs-res-buy-modal hs-slot-picker';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `<div class="hs-res-buy-dialog hs-pick-dialog">` +
            `<div class="hs-res-buy-head"><h3>${String(kind).toUpperCase()} SLOT ${index + 1}</h3>` +
            `<p class="hs-res-buy-sub">${this.shipName ? this.shipName(shipId) : ''} · SLOT SIZE ${slm.slotSizeLabel(slm.getSlotSizeLevel(shipId, kind, index))}</p></div>` +
            `<div class="hs-pick-body">` +
            `<div class="hs-slot-picker hs-bay-inv hs-pick-inv" data-filter="${filter}" style="--cs:${cs}px"><div class="hs-bay-inv-bar"><div class="hs-bay-inv-filters">${fb}</div></div>${gridHtml}</div>` +
            (kind === 'weapon' ? `<div class="hs-pick-keys" role="group" aria-label="Shortcut"></div>` : '') +
            `</div>` +
            `<div class="hs-res-buy-actions">${current ? '<button type="button" class="action-button" data-pick-set="">EMPTY SLOT</button>' : ''}<button type="button" class="action-button hs-res-buy-close" data-pick-close>CLOSE</button></div></div>`;
        const inv = modal.querySelector('.hs-pick-inv');
        const grid = modal.querySelector('.hs-storage-grid.hs-pick-grid');
        const keysBar = modal.querySelector('.hs-pick-keys');
        const decorate = () => {
            if (!grid) return;
            grid.querySelectorAll('[data-part-id]').forEach((cell) => {
                const partKind = cell.getAttribute('data-part-kind');
                const id = cell.getAttribute('data-part-id');
                if (!id || partKind === 'blueprint') return;
                const blocked = blockedOf(partKind, id);
                cell.setAttribute('data-pick-set', id);
                cell.classList.toggle('is-current', partKind === kind && id === current);
                cell.classList.toggle('is-blocked', !!blocked);
                if (blocked) cell.setAttribute('disabled', '');
                else cell.removeAttribute('disabled');
                // Keep size-fit tip (same SIZE_FIT token the hangar tooltips parse).
                const tip = (String(this.hangarModuleTip(partKind, id) || '') + '\nSIZE_FIT:' + pickSlotSz + ':' + (slm.partSizeLabel ? slm.partSizeLabel(partKind, id) : 'S') + (blocked ? '\n' + blocked : '')).replace(/"/g, '&quot;');
                cell.setAttribute('data-ui-tip', tip);
                cell.setAttribute('data-ui-tip-instant', '');
            });
        };
        decorate();
        const drawKeys = () => {
            if (!keysBar) return;
            const loadout = slm.getLoadout(shipId);
            const set = slm.getWeaponKeySet(loadout, index);
            const allKey = slm.getAllFireKey ? slm.getAllFireKey(loadout) : 'space';
            keysBar.innerHTML = '<span class="hs-pick-keys-label">SHORTCUT</span>' + ['space', 'a', 's', 'd'].map((k) => {
                const taken = k === allKey && k !== 'space';
                const on = set.indexOf(k) !== -1;
                return `<button type="button" role="checkbox" aria-checked="${on}" class="hs-pick-keyopt${on ? ' is-on' : ''}${taken ? ' is-off' : ''}" data-pick-key="${k}"${taken ? ' disabled data-ui-tip="ALREADY FIRES ALL WEAPONS"' : ''}><span class="hs-pick-keybox"></span><span class="hs-pick-keyname">${k.toUpperCase()}</span></button>`;
            }).join('');
        };
        drawKeys();
        const close = () => this.closeHangarSlotPicker();
        // Drag a cell onto a ship slot to install it there; a plain click installs into THIS slot.
        // Capture on the modal so the bay-inv document click (toggle any free slot) never steals it.
        let dragged = false;
        inv.addEventListener('pointerdown', (e) => {
            const cell = e.target.closest('[data-pick-set]');
            if (!cell || cell.disabled || e.button !== 0) return;
            e.stopPropagation();
            const sx = e.clientX, sy = e.clientY;
            const off = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', off, true); window.removeEventListener('pointercancel', off, true); };
            const mv = (m) => {
                if (Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return;
                off();
                dragged = true;
                this.startHangarPartDrag(cell, e);
                const closeOnce = () => { window.removeEventListener('pointerup', closeOnce, true); window.removeEventListener('pointercancel', closeOnce, true); close(); };
                window.addEventListener('pointerup', closeOnce, true);
                window.addEventListener('pointercancel', closeOnce, true);
            };
            window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', off, true); window.addEventListener('pointercancel', off, true);
        }, true);
        inv.addEventListener('click', (e) => {
            const cell = e.target.closest('[data-pick-set]');
            if (!cell) return;
            e.preventDefault();
            e.stopPropagation();
            if (cell.disabled) return;
            if (dragged) { dragged = false; return; }
            close();
            this.applyHangarSlotChoice(kind, index, cell.getAttribute('data-pick-set'), null);
        }, true);
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-pick-close]')) { close(); return; }
            const empty = e.target.closest('[data-pick-set=""]');
            if (empty && empty.closest('.hs-res-buy-actions')) {
                close();
                this.applyHangarSlotChoice(kind, index, '', null);
            }
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
        return { damage: '#ff6a4a', shotspeed: '#4ad8ff', firerate: '#ffa04a', speed: '#6dff8a', armor: '#7aa8ff', energy: '#ffd24a', power: '#c9a0ff' }[type] || null;
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
    /**
     * Tip/detail text → hangar-style icon chips with coloured values.
     * Matches "DMG 10 · SPD 12 · 4.0/S" (optional rate / AMMO) and ability
     * stat deltas like "+0.3 SPEED · +1 DAMAGE".
     */
    formatDetailStatLineHtml(line) {
        const text = String(line || '');
        const chip = (icon, val, type, worse, better) =>
            `<span class="hs-hangar-weapon-stat${worse ? ' is-bad' : ''}${better ? ' is-good' : ''}" data-stat="${type}">` +
            `${this.iconHtml(icon, 14, 'hs-pixel', false, this.hangarStatColor(type))}` +
            `<b class="hs-stat-num">${String(val).replace(/</g, '&lt;')}</b>` +
            `${worse ? '<span class="hs-stat-worse">▼</span>' : ''}` +
            `${better ? '<span class="hs-stat-better">▲</span>' : ''}</span>`;
        const wrap = (html) => `<span class="hs-hangar-weapon-stats">${html}</span>`;
        const sm = text.match(/^DMG (\S+) · SPD (\S+)(?: · (\S+))?(?: · AMMO (\S+))?$/);
        if (sm) {
            let html = chip('statDamage', sm[1], 'damage') + chip('statSpeed', sm[2], 'shotspeed');
            if (sm[3]) html += chip('shotRapid', sm[3], 'firerate');
            if (sm[4]) html += chip('statWeapon', 'AMMO ' + sm[4], 'power');
            return wrap(html);
        }
        const statIcon = { SPEED: 'statSpeed', DAMAGE: 'statDamage', ARMOR: 'statArmor', 'FIRE RATE': 'shotRapid' };
        const statType = { SPEED: 'speed', DAMAGE: 'damage', ARMOR: 'armor', 'FIRE RATE': 'firerate' };
        const parts = text.split(' · ').map((part) => part.match(/^([+-]\d+(?:\.\d+)?) (SPEED|DAMAGE|ARMOR|FIRE RATE)$/));
        if (parts.length && parts.every(Boolean)) {
            return wrap(parts.map((pm) => {
                const n = Number(pm[1]);
                const worse = Number.isFinite(n) && n < 0;
                const better = Number.isFinite(n) && n > 0;
                return chip(statIcon[pm[2]], pm[1], statType[pm[2]], worse, better);
            }).join(''));
        }
        return text.replace(/</g, '&lt;');
    },
    /** Compact DMG / SPD / fire-rate line for a weapon row.
     *  `compareId`: when set (e.g. currently equipped gun), stats that are worse
     *  than that baseline get `is-bad` / better get `is-good`. */
    hangarWeaponStatsHtml(id, compareId) {
        if (typeof weaponConfigManager === 'undefined') return '';
        const w = weaponConfigManager.getWeapon(id);
        if (!w) return '';
        const rateNum = w.cooldown ? (1000 / w.cooldown) : 0;
        const rate = w.cooldown ? rateNum.toFixed(1) : '—';
        // Icon instead of a text label (same icons as the details panel); label stays in the tooltip.
        const stat = (icon, tip, value, type, boosted, worse, better) =>
            `<span class="hs-hangar-weapon-stat${boosted ? ' is-boosted' : ''}${worse ? ' is-bad' : ''}${better ? ' is-good' : ''}" data-stat="${type}" data-ui-tip="${tip}">${this.iconHtml(icon, 16, 'hs-pixel', false, this.hangarStatColor(type))}<b class="hs-stat-num">${value}</b>${boosted ? '<span class="hs-stat-boost">▲</span>' : ''}${worse ? '<span class="hs-stat-worse">▼</span>' : ''}${better ? '<span class="hs-stat-better">▲</span>' : ''}</span>`;
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
        const cmp = (compareId && compareId !== id) ? weaponConfigManager.getWeapon(compareId) : null;
        let cDmg = null;
        let cSpd = null;
        let cRate = null;
        if (cmp) {
            const cMul = (weaponConfigManager.getShipClassWeaponMul
                ? weaponConfigManager.getShipClassWeaponMul(model && model.modelClass, compareId) : 1)
                * (weaponConfigManager.getFactionWeaponMul
                    ? weaponConfigManager.getFactionWeaponMul(faction, compareId) : 1);
            cDmg = Math.round((cmp.damage || 0) * cMul);
            cSpd = Number(cmp.speed) || 0;
            cRate = cmp.cooldown ? (1000 / cmp.cooldown) : 0;
        }
        const worse = (mine, theirs) => (theirs != null && mine != null && Number(mine) < Number(theirs));
        const better = (mine, theirs) => (theirs != null && mine != null && Number(mine) > Number(theirs));
        let powerHtml = '';
        if (typeof balanceConfigManager !== 'undefined' && balanceConfigManager.computeWeaponPower) {
            const power = balanceConfigManager.computeWeaponPower(w, id);
            const eDps = Math.round(balanceConfigManager.volleyDps(w) * balanceConfigManager.getHitRate(id, w));
            let powerWorse = false;
            let powerBetter = false;
            if (cmp && balanceConfigManager.computeWeaponPower) {
                const cPower = balanceConfigManager.computeWeaponPower(cmp, compareId);
                powerWorse = power < cPower;
                powerBetter = power > cPower;
            }
            powerHtml = stat('statDamage', 'BALANCE POWER (eDPS ' + eDps + ')', power.toFixed(2), 'power', false, powerWorse, powerBetter);
        }
        return `<span class="hs-hangar-weapon-stats">` +
            stat('statDamage', dmgTip, dmg, 'damage', sources.length > 0, worse(dmg, cDmg), better(dmg, cDmg)) +
            stat('statSpeed', 'SHOT SPEED', w.speed, 'shotspeed', false, worse(w.speed, cSpd), better(w.speed, cSpd)) +
            stat('shotRapid', 'SHOTS PER SECOND', rate + '/S', 'firerate', false, worse(rateNum, cRate), better(rateNum, cRate)) +
            powerHtml +
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
                ? `<span class="hs-section-slot is-filled" data-section-slot="${sec.kind}|${i}" data-ui-tip="${this.hangarModuleLabel(id)} — DRAG OFF TO UNEQUIP">` +
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
                // A plain click on a filled slot box in the section header used to unequip that
                // part — too easy to trigger by accident while just opening/closing the section,
                // right next to the collapse caret. Dragging a filled box off the ship still
                // unequips it (below); a click here only toggles the section now.
                const box = e.target.closest('[data-section-slot]');
                if (box) {
                    e.stopPropagation();
                    if (box._vfDragged) { box._vfDragged = false; } // tail end of a drag, already handled
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
        // Drag a filled section-slot box onto a ship slot to move the part there, or off the ship to unequip it.
        this.overlay.querySelectorAll('.hs-section-slot.is-filled[data-section-slot]').forEach((box) => {
            box.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const sx = e.clientX, sy = e.clientY;
                const off = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', off, true); window.removeEventListener('pointercancel', off, true); };
                const mv = (m) => {
                    if (Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return;
                    off();
                    box._vfDragged = true;
                    this.startHangarSectionSlotPull(box, e);
                };
                window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', off, true); window.addEventListener('pointercancel', off, true);
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
    /** Non-weapon part: switch it on (first free slot, else the first). A click while it's
     *  already on no longer switches it off directly — same change as the weapon rows and the
     *  section-header slot strip: too easy to unequip by accident with a plain click. It opens
     *  the details panel (explicit UNEQUIP button there) instead. */
    toggleHangarPart(cell) {
        const kind = cell.getAttribute('data-part-kind');
        const id = cell.getAttribute('data-part-id');
        const key = shipLoadoutManager.kindToLoadoutKey(kind);
        const list = shipLoadoutManager.getLoadout(this.hangarShipId)[key] || [];
        const at = list.indexOf(id);
        if (at !== -1) {
            this.toggleHangarPartDetails(cell);
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
    /** Drag out of a section header's filled slot box (sidebar list), same pull as dragging off the ship itself. */
    startHangarSectionSlotPull(box, downEvent) {
        const [kind, idxStr] = box.getAttribute('data-section-slot').split('|');
        const index = Number(idxStr) || 0;
        const id = this.hangarSlotModuleId(kind, index);
        if (!id) return;
        const holder = document.createElement('span');
        holder.innerHTML = this.moduleIconHtml(kind, id, 32, 'hs-pixel', false);
        this.startHangarPartDrag(null, downEvent, {
            kind: kind,
            id: id,
            iconEl: holder.querySelector('img'),
            sourceSlot: box,
            sourceIndex: index
        });
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
