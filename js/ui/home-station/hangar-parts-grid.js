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
    /** @deprecated Toggle removed — slots + parts are one merged sidebar. */
    renderHangarLeftViewToggle() { return ''; },
    /** One slot box (optional mirror half for split wing weapons). */
    /** Kind fallback tint, or the preferred-faction / weapon-family color when a part is installed. */
    hangarPartColor(kind, id) {
        const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d;
        const fallback = { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') }[kind] || g(kind, '#7ec8ff');
        if (!id || typeof physicalItem === 'undefined' || !physicalItem.partColor) return fallback;
        return physicalItem.partColor(kind, id, fallback) || fallback;
    },
    /** Slot chrome / BG: weapons stay category red; item art uses hangarPartColor. */
    hangarSlotColor(kind, id) {
        const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d;
        const fallback = { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') }[kind] || g(kind, '#7ec8ff');
        if (typeof physicalItem !== 'undefined' && physicalItem.slotColor) {
            return physicalItem.slotColor(kind, id, fallback) || fallback;
        }
        return fallback;
    },
    hangarSlotCellHtml(sl) {
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const pk = this.hangarPartColor(sl.kind, sl.id);
        const slotC = this.hangarSlotColor(sl.kind, sl.id);
        const kindIcon = { weapon: 'statWeapon', defense: 'statArmor', energy: 'statEnergy', ability: 'statAbilities' };
        const dims = [[40, 40], [40, 84], [84, 84]];
        let lvl = 0;
        try {
            const sizeFn = slm.getSlotEffectiveSizeLevel || slm.getSlotSizeLevel;
            lvl = Math.max(0, Math.min(2, sizeFn.call(slm, this.hangarShipId, sl.kind, sl.index) | 0));
        } catch (e) { lvl = 0; }
        let key = kindIcon[sl.kind];
        if (sl.id && slm && slm.resolveModuleIcon) { try { key = slm.resolveModuleIcon({ kind: sl.kind, id: sl.id }) || key; } catch (e) { /* type icon */ } }
        const name = sl.id ? this.hangarModuleLabel(sl.id) : 'EMPTY ' + String(sl.kind).toUpperCase() + ' SLOT';
        const img = ir ? String((sl.kind === 'weapon' && sl.id && ir.weaponImgHtml ? ir.weaponImgHtml(sl.id, 32, 'hs-pixel', false) : ir.imgHtml(key, 32, 'hs-pixel', pk, false)) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '';
        const partSz = sl.id && slm && slm.partSizeLabel ? slm.partSizeLabel(sl.kind, sl.id) : null;
        const slotSz = 'SML'[lvl];
        const tip = ((sl.id ? this.hangarModuleTip(sl.kind, sl.id) : 'NO PART INSTALLED') + '\nSIZE_FIT:' + slotSz + ':' + (partSz || slotSz)).replace(/"/g, '&quot;');
        // Slot keeps its S/M/L box; the part nests at its own footprint (S in M stays S-sized).
        const partLv = sl.id && slm.getPartSizeLevel ? Math.max(0, Math.min(lvl, slm.getPartSizeLevel(sl.kind, sl.id) | 0)) : lvl;
        const inner = sl.id
            ? `<span class="hs-slotview-part" style="width:${dims[partLv][0]}px;height:${dims[partLv][1]}px">${typeof physicalItem !== 'undefined' ? physicalItem.wrap(sl.kind, sl.id, dims[partLv][0] - 4, dims[partLv][1] - 4, pk, img) : img}</span>`
            : img;
        return `<span class="hs-slotview-cell${sl.id ? ' is-filled' : ' is-empty'}" data-ui-tip-instant data-ui-tip-head="${name}" data-ui-tip="${tip}" style="--pk-c:${slotC};--svw:${dims[lvl][0]}px;--svh:${dims[lvl][1]}px" role="button" tabindex="0" data-slot-pick="${sl.kind}" data-slot-index="${sl.index}" data-part-kind="${sl.kind}" aria-label="${name}">${inner}<span class="hs-slotview-size">${slotSz}</span></span>`;
    },
    /** Slot boxes for the hangar sidebar / bay SHIP grid. Optional `kindFilter` limits to one slot type. */
    renderHangarSlotsView(slots, layout, kindFilter) {
        const shown = (slots || []).filter((sl) => sl && (!kindFilter || sl.kind === kindFilter));
        const cells = shown.map((sl) => (sl.split && sl.kind === 'weapon'
            ? this.hangarSlotCellHtml(sl) + this.hangarSlotCellHtml(sl)
            : this.hangarSlotCellHtml(sl))).join('');
        const kindAttr = kindFilter ? ` data-slot-kind="${kindFilter}"` : '';
        return `<div class="hs-slotview"${kindAttr}><div class="hs-slotview-row"><span class="hs-slotview-slots">${cells || '<em>NO SLOT</em>'}</span></div></div>`;
    },
    /** Shortcut dropdown at the right of a weapon / executable-ability row ('' = none). */
    hangarKeySelectHtml(kind, sl) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        if (!slm || !sl || !sl.id) return '';
        const L = slm.getLoadout(this.hangarShipId);
        const opt = (v, label, cur, dis) => `<option value="${v}"${v === cur ? ' selected' : ''}${dis ? ' disabled' : ''}>${label}</option>`;
        if (kind === 'weapon') {
            const set = slm.getWeaponKeySet(L, sl.index);
            const all = slm.getAllFireKey ? slm.getAllFireKey(L) : 'space';
            const cur = set.length === 1 ? set[0] : 'multi';
            const opts = ['space', 'a', 's', 'd'].map((k) => opt(k, k === 'space' ? 'SPACE' : k.toUpperCase(), cur, k === all && k !== 'space')).join('')
                + (cur === 'multi' ? opt('multi', 'MULTI', cur, true) : '');
            return `<label class="hs-hangar-key" data-ui-tip="SHORTCUT — KEY THAT FIRES THIS WEAPON"><select data-hangar-key="weapon" data-slot-index="${sl.index}" aria-label="Weapon shortcut">${opts}</select></label>`;
        }
        if (kind === 'ability') {
            const a = typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.getAbility(sl.id) : null;
            if (!a || a.type !== 'active') return '';
            const cur = slm.getAbilityKey ? slm.getAbilityKey(L, sl.id) : '';
            const opts = opt('', '—', cur) + (slm.ABILITY_KEYS || []).map((k) => opt(k, k.toUpperCase(), cur)).join('');
            return `<label class="hs-hangar-key" data-ui-tip="SHORTCUT — KEY THAT TRIGGERS THIS ABILITY"><select data-hangar-key="ability" data-slot-index="${sl.index}" data-part-id="${sl.id}" aria-label="Ability shortcut">${opts}</select></label>`;
        }
        return '';
    },
    /**
     * Slot box for the merged row: real S/M/L footprint, part graphic inside (weapon mount
     * when available), slot-size letter on the corner.
     */
    hangarMergedSlotIconHtml(sl) {
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const pk = this.hangarPartColor(sl.kind, sl.id);
        const slotC = this.hangarSlotColor(sl.kind, sl.id);
        const kindIcon = { weapon: 'statWeapon', defense: 'statArmor', energy: 'statEnergy', ability: 'statAbilities' };
        const dims = [[40, 40], [40, 84], [84, 84]];
        let lvl = 0;
        try {
            const sizeFn = slm.getSlotEffectiveSizeLevel || slm.getSlotSizeLevel;
            lvl = Math.max(0, Math.min(2, sizeFn.call(slm, this.hangarShipId, sl.kind, sl.index) | 0));
        } catch (e) { lvl = 0; }
        // Split wing pairs use effective mount size (≥ M) so M guns fit without shrinking.
        const slotLetter = 'SML'[lvl];
        const [sw, sh] = dims[lvl];
        let inner = '';
        if (sl.id && sl.kind === 'weapon') {
            const mount = this.hangarWeaponMountHtml(sl.id);
            if (mount) {
                inner = `<span class="hs-slotview-part is-mount" style="width:${sw}px;height:${sh}px">${mount}</span>`;
            }
        }
        if (!inner) {
            let key = kindIcon[sl.kind];
            if (sl.id && slm && slm.resolveModuleIcon) {
                try { key = slm.resolveModuleIcon({ kind: sl.kind, id: sl.id }) || key; } catch (e) { /* type icon */ }
            }
            const img = ir ? String((sl.kind === 'weapon' && sl.id && ir.weaponImgHtml
                ? ir.weaponImgHtml(sl.id, 32, 'hs-pixel', false)
                : ir.imgHtml(key, 32, 'hs-pixel', pk, false)) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '';
            if (sl.id) {
                const partLv = slm.getPartSizeLevel
                    ? Math.max(0, Math.min(lvl, slm.getPartSizeLevel(sl.kind, sl.id) | 0)) : lvl;
                const [pw, ph] = dims[partLv];
                inner = `<span class="hs-slotview-part" style="width:${pw}px;height:${ph}px">${typeof physicalItem !== 'undefined' ? physicalItem.wrap(sl.kind, sl.id, pw - 4, ph - 4, pk, img) : img}</span>`;
            } else {
                inner = img;
            }
        }
        return `<span class="hs-hangar-part-slot hs-slotview-cell${sl.id ? ' is-filled' : ''}" style="--pk-c:${slotC};--svw:${sw}px;--svh:${sh}px" aria-hidden="true">${inner}<span class="hs-slotview-size">${slotLetter}</span></span>`;
    },
    /** One merged row: sized slot box (left) + part info. */
    hangarMergedSlotRowHtml(sec, sl, single) {
        const slm = shipLoadoutManager;
        const id = sl.id || '';
        const slotC = this.hangarSlotColor(sec.kind, id);
        const slot = this.hangarMergedSlotIconHtml(sl);
        if (!id) {
            return `<button type="button" class="hs-hangar-part is-empty is-merged" style="--pk-c:${slotC}"` +
                ` data-slot-pick="${sec.kind}" data-slot-index="${sl.index}"` +
                ` data-ui-tip="EMPTY ${String(sec.kind).toUpperCase()} SLOT — CLICK TO EQUIP" aria-label="Empty ${sec.kind} slot">` +
                slot +
                `<span class="hs-hangar-part-name"><span class="hs-hangar-part-title">EMPTY SLOT</span></span>` +
                `</button>`;
        }
        const label = this.hangarModuleLabel(id);
        const size = slm.partSizeLabel ? slm.partSizeLabel(sec.kind, id) : 'S';
        const fits = !slm.partFitsSlot || slm.partFitsSlot(this.hangarShipId, sec.kind, id, sl.index).ok;
        const isToggle = sec.kind !== 'weapon';
        const expanded = this._hangarExpandedPart === sec.kind + ':' + id;
        return `<button type="button" class="hs-hangar-part is-equipped is-merged${expanded ? ' is-expanded' : ''}${fits ? '' : ' is-too-big'}${isToggle ? ' is-toggle' : ''}"` +
            (isToggle ? (single ? ` role="radio" aria-checked="true"` : ` role="switch" aria-checked="true"`) : '') +
            ` style="--pk-c:${slotC}" data-part-kind="${sec.kind}" data-part-id="${id}" data-part-size="${size}"` +
            ` data-slot-pick="${sec.kind}" data-slot-index="${sl.index}"` +
            ` data-ui-tip="${String(this.hangarModuleTip(sec.kind, id)).replace(/"/g, '&quot;')}\nSIZE ${size} · EQUIPPED${fits ? '' : ' · NEEDS ' + size + ' SLOT'}">` +
            slot +
            `<span class="hs-hangar-part-name"><span class="hs-hangar-part-title">${label} ` +
            `<span class="hs-hangar-part-size is-${size}">(${size})</span></span>` +
            (sec.kind === 'weapon' ? this.hangarWeaponStatsHtml(id) : '') +
            (sec.kind === 'energy' ? this.hangarEnergyStatsHtml(id) : '') +
            (sec.kind === 'ability' ? this.hangarAbilityStatsHtml(id) : '') + `</span>` +
            `</button>`;
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
        const curList = (kind === 'weapon' && Array.isArray(L.weaponSlots) && L.weaponSlots.length ? L.weaponSlots : slm.getSlotList(L, kind)) || [];
        const current = curList[index] || '';
        const sizeFn = slm.getSlotEffectiveSizeLevel || slm.getSlotSizeLevel;
        const pickSlotLv = Math.max(0, Math.min(2, sizeFn.call(slm, shipId, kind, index) | 0));
        const pickSlotSz = 'SML'[pickSlotLv];
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
        const gridHtml = this.renderBayShipInventoryGrid
            ? this.renderBayShipInventoryGrid(profile, shipId)
            : this.renderShipStorage(profile, shipId, { extraGridClass: 'hs-pick-grid', tipAction: false });
        const modal = document.createElement('div');
        modal.className = 'hs-res-buy-modal hs-slot-picker';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `<div class="hs-res-buy-dialog hs-pick-dialog">` +
            `<div class="hs-res-buy-head"><h3>${String(kind).toUpperCase()} SLOT ${index + 1}</h3>` +
            `<p class="hs-res-buy-sub">${this.shipName ? this.shipName(shipId) : ''} · SLOT SIZE ${slm.slotSizeLabel(pickSlotLv)}</p></div>` +
            `<div class="hs-pick-body">` +
            `<div class="hs-slot-picker hs-bay-inv hs-pick-inv" data-filter="${filter}" style="--cs:${cs}px"><div class="hs-bay-inv-bar"><div class="hs-bay-inv-filters">${fb}</div></div>${gridHtml}</div>` +
            (kind === 'weapon' ? `<div class="hs-pick-keys" role="group" aria-label="Shortcut"></div>` : '') +
            `</div>` +
            `<div class="hs-res-buy-actions"><button type="button" class="action-button hs-res-buy-close" data-pick-close>CLOSE</button>${current ? '<button type="button" class="action-button" data-pick-set="">EMPTY SLOT</button>' : ''}</div></div>`;
        const inv = modal.querySelector('.hs-pick-inv');
        const grid = modal.querySelector('.hs-storage-grid.hs-pick-grid');
        const keysBar = modal.querySelector('.hs-pick-keys');
        const decorate = () => {
            if (!grid) return;
            grid.querySelectorAll('[data-part-id]').forEach((cell) => {
                const partKind = cell.getAttribute('data-part-kind');
                const id = cell.getAttribute('data-part-id');
                if (!id || partKind === 'blueprint') return;
                // Hull-slot tiles (equipped mounts) are shown for orientation only; pick from cargo.
                if (cell.classList.contains('is-ship-slot')) return;
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
    /** CSS row kind for iss/tps detail stat lines. */
    detailStatLineClass(text, index) {
        const t = String(text || '').trim();
        if (index === 0 && /^(PERMANENT PART|TEMP|INVENTORY)/i.test(t)) return ' is-tag';
        if (/\d+c$/i.test(t) || /^MARKED FOR SALE ·/i.test(t)) return ' is-cost';
        if (/^CLASS RANGE ·/i.test(t)) return ' is-class-range';
        if (/^CLASS ·/i.test(t)) return ' is-shop-class';
        if (/^DMG \d/.test(t)) return ' is-weapon-roll';
        if (/^(REVERTS|DURATION|AMMO \d)/i.test(t)) return ' is-meta';
        return ' is-desc';
    },

    /** Icon chips for "CLASS RANGE · DMG -4…+8% · …" shop spread lines. */
    formatClassRangeChipsHtml(rangeLine) {
        const rest = String(rangeLine || '').replace(/^CLASS RANGE ·\s*/i, '');
        if (!rest) return '';
        const iconMap = {
            DMG: 'statDamage', SPD: 'statSpeed', RATE: 'shotRapid',
            POTENCY: 'statAbilities', TIME: 'shotRapid', AMMO: 'statWeapon'
        };
        const typeMap = {
            DMG: 'damage', SPD: 'shotspeed', RATE: 'firerate',
            POTENCY: 'power', TIME: 'firerate', AMMO: 'power'
        };
        const toneFor = (val) => {
            const m = String(val).match(/([+-]?\d+)(?:…|\.\.\.)([+-]?\d+)%/);
            if (!m) return '';
            const lo = Number(m[1]);
            const hi = Number(m[2]);
            if (hi > 0 && lo >= 0) return ' is-good';
            if (hi <= 0 && lo < 0) return ' is-bad';
            return ' is-mixed';
        };
        const chip = (label, val, type) =>
            `<span class="hs-hangar-weapon-stat vf-iss-range-chip${toneFor(val)}" data-stat="${type}">` +
            `${this.iconHtml(iconMap[label] || 'statWeapon', 14, 'hs-pixel', false, this.hangarStatColor(type))}` +
            `<span class="vf-iss-range-lbl">${label}</span>` +
            `<b class="hs-stat-num">${String(val).replace(/</g, '&lt;')}</b></span>`;
        return `<span class="hs-hangar-weapon-stats vf-iss-range-grid">` +
            rest.split(' · ').map((part) => {
                const m = part.match(/^(DMG|SPD|RATE|POTENCY|TIME|AMMO)\s+(.+)$/);
                if (!m) {
                    return `<span class="vf-iss-range-fallback">${part.replace(/</g, '&lt;')}</span>`;
                }
                return chip(m[1], m[2], typeMap[m[1]] || 'power');
            }).join('') +
            `</span>`;
    },

    /** Shop class label + roll range in one readable cluster. */
    formatDetailClassClusterHtml(classLine, rangeLine) {
        const label = String(classLine || '').replace(/^CLASS ·\s*/i, '').trim();
        return `<section class="vf-iss-detail-cluster vf-iss-class-cluster" aria-label="Shop class">` +
            `<header class="vf-iss-cluster-head">` +
            `<span class="vf-iss-cluster-kicker">CLASS</span>` +
            `<strong class="vf-iss-class-pill">${label.replace(/</g, '&lt;')}</strong>` +
            `</header>` +
            `<div class="vf-iss-cluster-body">` +
            `<span class="vf-iss-cluster-sub">Roll band</span>` +
            this.formatClassRangeChipsHtml(rangeLine) +
            `</div></section>`;
    },

    /**
     * Tip/detail text → hangar-style icon chips with coloured values.
     * Matches "DMG 10 · SPD 12 · 4.0/S" (optional rate / AMMO) and ability
     * stat deltas like "+0.3 SPEED · +1 DAMAGE".
     */
    formatDetailStatLineHtml(line) {
        const text = String(line || '');
        if (/^CLASS RANGE ·/i.test(text)) return this.formatClassRangeChipsHtml(text);
        if (/^CLASS ·/i.test(text)) {
            const label = text.replace(/^CLASS ·\s*/i, '').trim();
            return `<span class="vf-iss-class-inline">` +
                `<span class="vf-iss-cluster-kicker">CLASS</span>` +
                `<strong class="vf-iss-class-pill">${label.replace(/</g, '&lt;')}</strong></span>`;
        }
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
        // Found-loot ranges: "+1.8…+2.2 ARMOR" / "-0.2…-0.18 SPEED"
        const rangeParts = text.split(' · ').map((part) =>
            part.match(/^([+-]?\d+(?:\.\d+)?)…([+-]?\d+(?:\.\d+)?) (SPEED|DAMAGE|ARMOR|FIRE RATE)$/));
        if (rangeParts.length && rangeParts.every(Boolean)) {
            return wrap(rangeParts.map((pm) => {
                const lo = Number(pm[1]);
                const hi = Number(pm[2]);
                const worse = Number.isFinite(hi) && hi < 0;
                const better = Number.isFinite(lo) && lo > 0;
                return chip(statIcon[pm[3]], pm[1] + '…' + pm[2], statType[pm[3]], worse, better);
            }).join(''));
        }
        return text.replace(/</g, '&lt;');
    },

    /** Apply a salvage/shop vendorRoll to hangar tip stat lines (final numbers after loot). */
    applyVendorRollToStatLines(kind, partId, lines, mul) {
        const m = mul || {};
        const scaleNum = (n, factor) => Math.round(Number(n) * (Number(factor) || 1) * 10) / 10;
        const fmt = (n) => {
            const v = scaleNum(n, 1);
            return (Math.abs(v - Math.round(v)) < 0.05) ? String(Math.round(v)) : String(v);
        };
        const scaleSigned = (raw, factor) => {
            const n = Number(raw);
            if (!Number.isFinite(n)) return raw;
            const v = scaleNum(n, factor);
            const s = fmt(v);
            return (v > 0 && !String(raw).startsWith('-') ? (String(raw).startsWith('+') ? '+' : '') : '') + s;
        };
        return (lines || []).map((line) => {
            const text = String(line || '');
            const weapon = text.match(/^DMG (\S+) · SPD (\S+)(?: · (\S+))?(?: · AMMO (\S+))?$/);
            if (weapon && kind === 'weapon') {
                const dmg = scaleNum(weapon[1], m.dmgMul || 1);
                const spd = scaleNum(weapon[2], m.spdMul || 1);
                let out = 'DMG ' + fmt(dmg) + ' · SPD ' + fmt(spd);
                if (weapon[3] && /\/S$/i.test(weapon[3])) {
                    const rate = Number(String(weapon[3]).replace(/\/S$/i, ''));
                    if (Number.isFinite(rate)) {
                        const cdMul = Number(m.cdMul) || 1;
                        out += ' · ' + fmt(rate / cdMul) + '/S';
                    } else out += ' · ' + weapon[3];
                } else if (weapon[3]) out += ' · ' + weapon[3];
                if (weapon[4]) out += ' · AMMO ' + weapon[4];
                return out;
            }
            const pot = m.potencyMul || 1;
            return text.split(' · ').map((part) => {
                const dm = part.match(/^([+-]\d+(?:\.\d+)?) (SPEED|DAMAGE|ARMOR|FIRE RATE)$/);
                if (dm) return scaleSigned(dm[1], pot) + ' ' + dm[2];
                const sh = part.match(/^(SHIELD|REGEN|DMG REDUCTION|REFLECT|MAX ENERGY)\s+(\+?\d+(?:\.\d+)?)(\/s)?$/i);
                if (sh) return sh[1].toUpperCase() + ' ' + scaleSigned(sh[2], pot) + (sh[3] || '');
                return part;
            }).join(' · ');
        });
    },
    /** Compact DMG / SPD / fire-rate line for a weapon row.
     *  `compareId`: when set (e.g. currently equipped gun), stats that are worse
     *  than that baseline get `is-bad` / better get `is-good`. */
    hangarWeaponStatsHtml(id, compareId, statMul) {
        if (typeof weaponConfigManager === 'undefined') return '';
        const w = weaponConfigManager.getWeapon(id);
        if (!w) return '';
        const mul = statMul || {};
        const cd = Math.max(50, Number(w.cooldown || 300) * (mul.cdMul || 1));
        const shotSpd = Math.round((Number(w.speed) || 0) * (mul.spdMul || 1) * 10) / 10;
        const rateNum = 1000 / cd;
        const rate = rateNum.toFixed(1);
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
        const dmg = Math.round((w.damage || 0) * classMul * factionMul * (mul.dmgMul || 1));
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
            const wRoll = Object.assign({}, w, {
                damage: (w.damage || 0) * (mul.dmgMul || 1),
                cooldown: cd,
                speed: shotSpd
            });
            const power = balanceConfigManager.computeWeaponPower(wRoll, id);
            const eDps = Math.round(balanceConfigManager.volleyDps(wRoll) * balanceConfigManager.getHitRate(id, wRoll));
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
            stat('statSpeed', 'SHOT SPEED', shotSpd, 'shotspeed', false, worse(shotSpd, cSpd), better(shotSpd, cSpd)) +
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
    /**
     * Bay SHIP inventory grid: every hull equipment slot (empty + filled) as a
     * container cell on the same storage grid, sized S/M/L. Unequipped cargo
     * still packs after the slots. Positions are pinned (storagePos) so a re-render
     * never auto-reflows items the player already placed.
     */
    renderBayShipInventoryGrid(profile, shipId) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        if (!slm || !shipId || !this._storageGridHtml) {
            return this.renderShipStorage ? this.renderShipStorage(profile, shipId, { extraGridClass: 'hs-pick-grid', tipAction: false }) : '';
        }
        const modelClass = this.shipModelClass
            ? this.shipModelClass(shipId, typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(shipId) : null)
            : 'starfighter';
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId) : null;
        try { if (profileManager.reconcileShipParts) profileManager.reconcileShipParts(profile, shipId); } catch (e) { /* ignore */ }
        const hangarSlots = slm.buildHangarSlots
            ? slm.buildHangarSlots(shipId, modelClass, merged) : { slots: [] };
        const color = (() => {
            const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor
                && iconRenderer.getModuleKindColor(k)) || d;
            return { weapon: g('weapon', '#ff6a4a'), defense: g('defense', '#4ac8ff'), energy: g('energy', '#ffd24a'), ability: g('ability', '#c08cff') };
        })();
        const kindIcon = { weapon: 'statWeapon', defense: 'statArmor', energy: 'statEnergy', ability: 'statAbilities' };
        const ir = typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml ? iconRenderer : null;
        // Slot-type badge (bottom-left, shown while hovering the inventory — CSS .hs-storage-slot-kind).
        const kindBadge = (kind) => {
            const ico = ir ? String(ir.imgHtml(kindIcon[kind] || 'statWeapon', 16, 'hs-pixel hs-pixel-16', color[kind] || '#fff', false) || '')
                .replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '';
            return `<span class="hs-storage-slot-kind" data-slot-kind="${kind}" aria-hidden="true">${ico}</span>`;
        };
        const layoutPx = this._storageLayoutPx ? this._storageLayoutPx() : { cell: 56, gap: 2 };
        const cs = layoutPx.cell;
        const spanOf = (lv) => [[1, 1], [1, 2], [2, 2]][Math.max(0, Math.min(2, lv | 0))];
        const posMap = (typeof profileManager !== 'undefined' && profileManager.getStoragePosMap)
            ? profileManager.getStoragePosMap(profile, 'ship', shipId) : {};
        const cellSpecs = [];
        const movePinUsed = {};
        const equippedKeys = {};
        const overlapLeft = {};
        // Explicit pins only — never leave pos null (dense auto-flow would reshuffle on re-render).
        let baseGrid = this._storageGrid ? this._storageGrid(shipId) : { cols: 6, rows: 2 };
        const cols = Math.max(baseGrid.cols || 4, 4);
        let rows = Math.max(baseGrid.rows || 2, 2);
        const claimed = new Set();
        const cellsOf = (col, row, w, h) => {
            const out = [];
            for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) out.push(c + ',' + r);
            return out;
        };
        const fits = (col, row, w, h) => {
            if (col < 1 || row < 1 || col + w - 1 > cols || row + h - 1 > rows) return false;
            return !cellsOf(col, row, w, h).some((k) => claimed.has(k));
        };
        const mark = (col, row, w, h) => { cellsOf(col, row, w, h).forEach((k) => claimed.add(k)); };
        const placeNext = (w, h) => {
            for (let guard = 0; guard < 400; guard++) {
                for (let r = 1; r <= rows - h + 1; r++) {
                    for (let c = 1; c <= cols - w + 1; c++) {
                        if (fits(c, r, w, h)) {
                            mark(c, r, w, h);
                            return [c, r];
                        }
                    }
                }
                rows += 1;
            }
            const fallback = [1, rows - h + 1];
            mark(fallback[0], fallback[1], w, h);
            return fallback;
        };
        const resolvePos = (pinned, w, h) => {
            if (pinned && pinned[0] > 0 && pinned[1] > 0) {
                // A stale pin below the grid must NOT grow it (phantom empty rows): only honour pins that
                // fit the current rows; everything else re-packs into the first free cell.
                if (fits(pinned[0], pinned[1], w, h)) {
                    mark(pinned[0], pinned[1], w, h);
                    return [pinned[0], pinned[1]];
                }
            }
            return placeNext(w, h);
        };
        const gap = layoutPx.gap || 2;
        (hangarSlots.slots || []).forEach((sl) => {
            if (!sl) return;
            let slotLv = 0;
            try {
                const sizeFn = slm.getSlotEffectiveSizeLevel || slm.getSlotSizeLevel;
                slotLv = Math.max(0, Math.min(2, sizeFn.call(slm, shipId, sl.kind, sl.index) | 0));
            } catch (e) { slotLv = 0; }
            // Split weapons use effective mount size (≥ M) so M guns fit without shrinking.
            const span = spanOf(slotLv);
            const sz = 'SML'[slotLv];
            const pk = this.hangarPartColor(sl.kind, sl.id) || color[sl.kind] || 'var(--color-primary)';
            const slotC = this.hangarSlotColor(sl.kind, sl.id) || color[sl.kind] || pk;
            const slotKey = 'slot:' + sl.kind + ':' + sl.index;
            const pos = resolvePos(posMap[slotKey], span[0], span[1]);
            if (sl.id) {
                const bucket = sl.kind === 'weapon' ? 'weapons'
                    : (sl.kind === 'defense' ? 'defenses'
                        : (sl.kind === 'energy' ? 'energy' : 'abilities'));
                equippedKeys[bucket + ':' + sl.id] = (equippedKeys[bucket + ':' + sl.id] || 0) + 1;
                const label = this.hangarModuleLabel ? this.hangarModuleLabel(sl.id) : String(sl.id).toUpperCase();
                let key = kindIcon[sl.kind];
                if (slm.resolveModuleIcon) {
                    try { key = slm.resolveModuleIcon({ kind: sl.kind, id: sl.id }) || key; } catch (e) { /* type */ }
                }
                const img = ir ? String((sl.kind === 'weapon' && ir.weaponImgHtml
                    ? ir.weaponImgHtml(sl.id, 32, 'hs-pixel', false)
                    : ir.imgHtml(key, 32, 'hs-pixel', pk, false)) || '').replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '') : '';
                // Part keeps its own S/M/L footprint nested inside the (possibly larger) slot.
                const partLv = slm.getPartSizeLevel
                    ? Math.max(0, Math.min(slotLv, slm.getPartSizeLevel(sl.kind, sl.id) | 0)) : slotLv;
                const partSpan = spanOf(partLv);
                const pw = partSpan[0] * cs + (partSpan[0] - 1) * gap - 6;
                const ph = partSpan[1] * cs + (partSpan[1] - 1) * gap - 6;
                const body = (typeof physicalItem !== 'undefined')
                    ? physicalItem.wrap(sl.kind, sl.id, Math.max(8, pw), Math.max(8, ph), pk, '', { plain: true }) : '';
                const partBox = `<span class="hs-storage-slot-part" style="width:${partSpan[0] * cs + (partSpan[0] - 1) * gap}px;height:${partSpan[1] * cs + (partSpan[1] - 1) * gap}px">${body}</span>`;
                const tip = String(this.hangarModuleTip ? this.hangarModuleTip(sl.kind, sl.id) : label)
                    .replace(/"/g, '&quot;') + '\nEQUIPPED · SLOT ' + sz;
                // Equipped mounts are not free-drag cargo — keep them on their slot tile.
                cellSpecs.push({
                    span: span,
                    pos: pos,
                    html: `<button type="button" class="hs-storage-cell is-ship-slot is-equipped" data-slot-pick="${sl.kind}" data-slot-index="${sl.index}" data-part-kind="${sl.kind}" data-part-id="${sl.id}" data-part-span-w="${partSpan[0]}" data-part-span-h="${partSpan[1]}" data-drag-key="${slotKey}" data-drag-source="ship-slot" data-drag-ship="${shipId}" draggable="false" style="__SPAN__--pk-c:${slotC}" data-ui-tip-compact data-ui-tip-head="${label.replace(/"/g, '&quot;')}" data-ui-tip="${tip}" aria-label="${label} — equipped">` +
                        `${partBox}${kindBadge(sl.kind)}<span class="hs-storage-slot-size">${sz}</span></button>`
                });
                return;
            }
            const name = 'EMPTY ' + String(sl.kind).toUpperCase() + ' SLOT';
            const typeKey = kindIcon[sl.kind] || 'statWeapon';
            const typeIco = ir
                ? String(ir.imgHtml(typeKey, Math.max(28, Math.floor(cs * 0.7)), 'hs-storage-slot-type', slotC, false) || '')
                    .replace(/\s(?:data-ui-tip|title)="[^"]*"/g, '')
                : (this.slotGlyphHtml ? this.slotGlyphHtml(sl.kind, 'hs-storage-slot-glyph') : '');
            cellSpecs.push({
                span: span,
                pos: pos,
                html: `<button type="button" class="hs-storage-cell is-ship-slot is-empty" data-slot-pick="${sl.kind}" data-slot-index="${sl.index}" data-part-kind="${sl.kind}" data-drag-key="${slotKey}" data-drag-source="ship-slot" data-drag-ship="${shipId}" draggable="false" style="__SPAN__--pk-c:${slotC}" data-ui-tip-compact data-ui-tip-head="${name}" data-ui-tip="NO PART INSTALLED · SLOT ${sz} — DRAG TO MOVE · CLICK TO EQUIP" aria-label="${name}">` +
                    `<span class="hs-storage-slot-type-bg" aria-hidden="true">${typeIco}</span>` +
                    `<span class="hs-storage-slot-size">${sz}</span></button>`
            });
        });
        // Unequipped cargo — always explicit pos (pin or next free cell after slots).
        if (typeof profileManager !== 'undefined' && profileManager.getShipStorageEntry && this._storageItemMeta) {
            const entry = profileManager.getShipStorageEntry(profile, shipId);
            const buckets = this.profileManagerShipStorageBuckets
                ? this.profileManagerShipStorageBuckets()
                : ['weapons', 'defenses', 'abilities', 'energy', 'blueprints'];
            buckets.forEach((bucket) => {
                Object.keys(entry[bucket] || {}).forEach((id) => {
                    if ((entry[bucket][id] || 0) <= 0) return;
                    const defId = this._storageDefId ? this._storageDefId(id) : id;
                    const units = (bucket !== 'blueprints' && this._expandPartUnits)
                        ? this._expandPartUnits(bucket, defId, entry[bucket][id] || 1)
                        : [{ bucket: bucket, id: id, defId: defId }];
                    units.forEach((u) => {
                        const unitKey = bucket + ':' + u.id;
                        const moveKey = bucket + ':' + (u.defId || defId);
                        // Filed copies EXCLUDE equipped ones (equip consumes filed), so several copies of one
                        // part in several slots must not hide the loose copies. Only starter parts with no
                        // owned count (filed overlaps equipped) hide one filed unit per equipped copy.
                        if (bucket !== 'blueprints') {
                            if (!(moveKey in overlapLeft)) {
                                const owned = profileManager._ownedStorageCount
                                    ? profileManager._ownedStorageCount(profile, bucket, u.defId || defId) : 1;
                                overlapLeft[moveKey] = owned > 0 ? 0 : (equippedKeys[moveKey] || 0);
                            }
                            if (overlapLeft[moveKey] > 0) { overlapLeft[moveKey] -= 1; return; }
                        }
                        const meta = this._storageItemMeta(bucket, u.defId || defId);
                        const span = this._storageItemSpan ? this._storageItemSpan(bucket, u.defId || defId) : [1, 1];
                        const body = (typeof physicalItem !== 'undefined')
                            ? physicalItem.wrap(meta.kind, meta.physId, span[0] * cs - 6, span[1] * cs - 6, meta.color, '', { plain: true }) : '';
                        const tip = String(this.hangarModuleTip ? this.hangarModuleTip(meta.kind, meta.physId) : meta.label)
                            .replace(/"/g, '&quot;');
                        // A def-level pin (bucket:defId, written when a part is taken out of a slot) applies to
                        // the first unit of that def shown, whatever its unit number is.
                        const pinnedPos = posMap[unitKey] || (!movePinUsed[moveKey] ? posMap[moveKey] : null);
                        if (!posMap[unitKey] && posMap[moveKey]) movePinUsed[moveKey] = true;
                        const pos = resolvePos(pinnedPos, span[0], span[1]);
                        cellSpecs.push({
                            span: span,
                            pos: pos,
                            html: `<button type="button" class="hs-storage-cell" data-part-kind="${meta.kind}" data-part-id="${meta.physId}" data-move-to-station="${unitKey}" data-ship="${shipId}" data-drag-key="${unitKey}" data-drag-source="ship" data-drag-ship="${shipId}" draggable="true" style="__SPAN__--pk-c:${meta.slotColor || meta.color}" data-ui-tip-compact data-ui-tip-head="${meta.label.replace(/"/g, '&quot;')}" data-ui-tip="${tip}" aria-label="${meta.label}">${body}</button>`
                        });
                    });
                });
            });
        }
        const used = cellSpecs.reduce((n, c) => n + c.span[0] * c.span[1], 0);
        cellSpecs.forEach((c) => {
            if (c.pos) rows = Math.max(rows, (c.pos[1] || 1) + (c.span[1] || 1) - 1);
            if (c.span[1] > rows) rows = c.span[1];
        });
        while (used > cols * rows) rows += 1;
        return this._storageGridHtml(
            cellSpecs,
            { cols: cols, rows: rows },
            `data-storage-target="ship" data-ship="${shipId}" data-ship-slots="1"`,
            'hs-pick-grid'
        );
    },

    /** Merged sidebar: per kind, each slot with its part info beside it (no section labels / collapse).
     *  data-filter mirrors the bay inventory chips so WEAPON/DEFENSE/… hide other kinds. */
    renderHangarPartsGrid(inventory, loadout, slots, layout) {
        const filter = this._bayInvFilter || 'all';
        return `<div class="hs-hangar-parts" data-filter="${filter}">` + HANGAR_PART_SECTIONS.map((sec) => {
            const slm = shipLoadoutManager;
            const caps = slm.getSlotCaps && slm.resolveModelClass
                ? slm.getSlotCaps(this.hangarShipId, slm.resolveModelClass(this.hangarShipId)) : {};
            const single = Math.max(0, Number(caps[sec.key]) || 0) <= 1;
            const kindSlots = (slots || []).filter((sl) => sl && sl.kind === sec.kind);
            const pairs = kindSlots.map((sl) => {
                const row = this.hangarMergedSlotRowHtml(sec, sl, single);
                const keySel = sl.id ? this.hangarKeySelectHtml(sec.kind, sl) : '';
                const detailsOpen = sl.id && this._hangarExpandedPart === sec.kind + ':' + sl.id;
                // Expanded part: ONE card (row + details inside it), framed in the part's own colour.
                return `<div class="hs-hangar-slot-pair${sl.id ? ' is-filled' : ''}${detailsOpen ? ' is-open' : ''}${keySel ? ' has-key' : ''}" data-slot-kind="${sec.kind}" data-slot-index="${sl.index}"` +
                    (detailsOpen ? ` style="--pk-c:${this.hangarSlotColor(sec.kind, sl.id)}"` : '') + `>` +
                    row + keySel +
                    (detailsOpen ? this.hangarPartDetailsHtml(sec.kind, sl.id) : '') +
                    `</div>`;
            }).join('');
            const kindColor = typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor
                ? iconRenderer.getModuleKindColor(sec.kind) : null;
            return `<section class="hs-hangar-parts-section" data-part-section="${sec.kind}"${kindColor ? ` style="--kind-color:${kindColor}"` : ''}>` +
                `<div class="hs-hangar-parts-grid" data-slot-kind="${sec.kind}">${pairs || this.emptyHtml('hsHangar', 'NO SLOT')}</div>` +
                `</section>`;
        }).join('') + `</div>`;
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
        this.overlay.querySelectorAll('.hs-hangar-part:not(.is-empty)').forEach((cell) => {
            // Pointer drag instead of native DnD: only the icon follows the cursor.
            cell.setAttribute('draggable', 'false');
            cell.addEventListener('dragstart', (e) => e.preventDefault());
            // Only weapons are placed on the ship; every other part type is
            // a plain on/off switch here in the sidebar.
            if (cell.getAttribute('data-part-kind') === 'ability') this.bindHangarAbilityHover(cell);
            if (cell.getAttribute('data-part-kind') !== 'weapon') {
                cell.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleHangarPart(cell);
                });
                return;
            }
            // Merged row: filled → details (picker via CHANGE in details); empty uses data-slot-pick.
            cell.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (cell.classList.contains('is-equipped')) this.toggleHangarPartDetails(cell);
                else this.equipHangarPart(cell, null);
            });
            cell.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
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
        const list = shipLoadoutManager.getSlotList(L, kind);
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
