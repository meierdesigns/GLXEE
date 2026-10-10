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
        const view = (this._hangarLeftView === 'parts' || this._hangarLeftView === 'ships') ? this._hangarLeftView : 'areas';
        const btn = (id, label, icon) =>
            `<button type="button" class="hs-hangar-view-btn${view === id ? ' is-active' : ''}" data-hangar-left-view="${id}" aria-pressed="${view === id}">` +
            `${this.iconHtml(icon, 32, 'hs-pixel hs-pixel-32', false, view === id ? '#05060a' : null)}<span>${label}</span></button>`;
        return `<div class="hs-hangar-view-toggle" role="group" aria-label="Sidebar view">${btn('ships', 'SHIPS', 'menuShips')}${btn('areas', 'AREAS', 'hsShip')}${btn('parts', 'PARTS', 'hsCraft')}</div>`;
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
            const ids = (inventory && inventory[sec.key]) || [];
            const equipped = (loadout && loadout[sec.key]) || [];
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
                    // Weapons: the icon is the drag handle (into a slot); a click elsewhere on the row opens it.
                    `<span class="hs-hangar-part-icon${sec.kind === 'weapon' ? ' is-drag-handle' : ''}"${sec.kind === 'weapon' ? ' data-ui-tip="DRAG INTO A SLOT"' : ''}>` +
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
                `<div class="hs-hangar-parts-grid">${cells || this.emptyHtml('hsHangar', 'NONE OWNED')}</div>` +
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
            cell.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 || !e.target.closest('.hs-hangar-part-icon.is-drag-handle')) return;
                e.preventDefault();
                this.startHangarPartDrag(cell, e);
            });
            cell.addEventListener('click', (e) => {
                // The icon's own click is handled when its drag finishes.
                if (e.target.closest('.hs-hangar-part-icon.is-drag-handle')) return;
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

    /**
     * pointerdown on an installed part on the ship canvas. A drag past a few
     * pixels pulls the part out of its slot; a plain click selects its slot
     * (same as clicking the slot marker). Returns false when the part has
     * no slot, so the canvas falls back to its area handling.
     */
    startHangarModuleGrab(mod, downEvent) {
        const slotEl = this.hangarSlotForModule(mod);
        if (!slotEl) return false;
        const sx = downEvent.clientX;
        const sy = downEvent.clientY;
        const cleanup = () => {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', cleanup);
        };
        const move = (e) => {
            if (Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
            cleanup();
            this.startHangarSlotPull(slotEl, downEvent);
            // Feed the current position so the icon appears under the cursor now.
            document.dispatchEvent(new PointerEvent('pointermove', { clientX: e.clientX, clientY: e.clientY, bubbles: true }));
        };
        const up = () => {
            cleanup();
            const pin = slotEl.querySelector('.hs-hangar-slot-pin');
            if (pin) pin.click();
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', cleanup);
        return true;
    },

    /**
     * Assigned weapon row: expand / collapse a details panel right under it
     * (slot, size, stats) with SHOW ON SHIP / UNEQUIP. Dragging the row still
     * pulls the part; only a plain click expands.
     */
    toggleHangarPartDetails(cell) {
        const kind = cell.getAttribute('data-part-kind');
        const id = cell.getAttribute('data-part-id');
        const key = kind + ':' + id;
        const open = this._hangarExpandedPart === key;
        this.overlay.querySelectorAll('.hs-hangar-part-details').forEach((el) => el.remove());
        this.overlay.querySelectorAll('.hs-hangar-part.is-expanded').forEach((el) => {
            el.classList.remove('is-expanded');
            el.setAttribute('aria-expanded', 'false');
        });
        this._hangarExpandedPart = open ? null : key;
        if (open) return;
        cell.classList.add('is-expanded');
        cell.setAttribute('aria-expanded', 'true');
        cell.insertAdjacentHTML('afterend', this.hangarPartDetailsHtml(kind, id));
        const panel = cell.nextElementSibling;
        if (!panel) return;
        panel.querySelectorAll('[data-part-detail-act]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const act = btn.getAttribute('data-part-detail-act');
                const index = this.hangarPartSlotIndex(kind, id);
                if (act === 'show') {
                    const slotEl = this.overlay.querySelector(`.hs-hangar-slot[data-slot-kind="${kind}"][data-slot-index="${index}"]`);
                    const pin = slotEl && slotEl.querySelector('.hs-hangar-slot-pin:not(.is-mirror)');
                    if (pin) pin.click();
                } else if (act === 'fire-auto' || act === 'fire-charge') {
                    // Ship-wide fire mode (setHangarFireMode in bind-station-events.js).
                    const mode = act === 'fire-auto' ? 'auto' : 'charge';
                    if (this.setHangarFireMode) this.setHangarFireMode(mode, btn);
                    const cur = (shipLoadoutManager.getLoadout(this.hangarShipId) || {}).fireMode || 'auto';
                    this.overlay.querySelectorAll('[data-part-detail-act^="fire-"]').forEach((b) => {
                        b.classList.toggle('equipped', b.getAttribute('data-part-detail-act').slice(5) === cur);
                    });
                } else if (act === 'unequip' && index >= 0) {
                    this._hangarExpandedPart = null;
                    this.applyHangarSlotChoice(kind, index, '', null);
                }
            });
        });
    },

    /** Slot index an equipped part sits in, or -1. */
    hangarPartSlotIndex(kind, id) {
        const slots = Array.from(this.overlay.querySelectorAll(`.hs-hangar-slot[data-slot-kind="${kind}"]`));
        const el = slots.find((s) => this.hangarSlotModuleId(kind, Number(s.getAttribute('data-slot-index') || 0)) === id);
        return el ? Number(el.getAttribute('data-slot-index') || 0) : -1;
    },

    hangarPartDetailsHtml(kind, id) {
        const slm = shipLoadoutManager;
        const size = slm.partSizeLabel ? slm.partSizeLabel(kind, id) : 'S';
        const index = this.hangarPartSlotIndex(kind, id);
        const slot = index < 0 ? '—' : (kind === 'weapon' ? this.hangarWeaponSlotLabel(index) : 'SLOT ' + (index + 1));
        const ic = (key) => `<span class="hs-hangar-part-detail-icon">${this.iconHtml(key, 16, 'hs-pixel', false)}</span>`;
        const row = (icon, k, v) => `<div class="hs-hangar-part-detail-row">${ic(icon)}<span class="hs-hangar-part-detail-key">${k}</span><span class="hs-hangar-part-detail-val">${v}</span></div>`;
        const group = (title, body) => `<div class="hs-hangar-part-detail-group"><div class="hs-hangar-part-detail-head">${title}</div>${body}</div>`;
        let html = group('MOUNT', row('navTarget', 'SLOT', slot) + row('navGrid', 'SIZE', size));
        const w = kind === 'weapon' && typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(id) : null;
        if (w) {
            html += group('COMBAT',
                row('statDamage', 'DAMAGE', w.damage != null ? w.damage : '—')
                + row('statSpeed', 'SHOT SPEED', w.speed != null ? w.speed : '—')
                + row('shotRapid', 'FIRE RATE', w.cooldown ? (1000 / w.cooldown).toFixed(1) + '/S' : '—')
                + (w.cooldown ? row('navBolt', 'COOLDOWN', w.cooldown + ' MS') : ''));
            html += group('FIRE MODE', this.hangarWeaponSettingsHtml());
        }
        const iconBtn = (act, icon, tip) =>
            `<button type="button" class="action-button secondary hs-hangar-part-icon-btn" data-part-detail-act="${act}" aria-label="${tip}" data-ui-tip="${tip}">` +
            `${this.iconHtml(icon, 16, 'hs-pixel', false)}</button>`;
        return `<div class="hs-hangar-part-details">${html}` +
            `<div class="hs-hangar-part-detail-actions">` +
            iconBtn('show', 'navEye', 'SHOW ON SHIP') +
            iconBtn('unequip', 'navDoor', 'UNEQUIP') +
            `</div></div>`;
    },

    /** Weapon settings (fire mode AUTO / CHARGE) inside the details panel. */
    hangarWeaponSettingsHtml() {
        const slm = shipLoadoutManager;
        const loadout = slm.getLoadout(this.hangarShipId) || {};
        const mode = loadout.fireMode || ((loadout.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto');
        const ownsCharge = slm.ownsChargePart ? slm.ownsChargePart('ability', 'charge_shot') : false;
        const ic = (key) => this.iconHtml(key, 16, 'hs-pixel', false);
        return `<div class="hs-hangar-part-fire-modes">` +
            `<button type="button" class="action-button hs-mod ${mode === 'auto' ? 'equipped' : ''}" data-part-detail-act="fire-auto">${ic('navCrosshair')}<span>AUTO</span></button>` +
            `<button type="button" class="action-button hs-mod ${mode === 'charge' ? 'equipped' : ''}" data-part-detail-act="fire-charge" ${ownsCharge ? '' : 'disabled'}` +
            ` data-ui-tip="${ownsCharge ? 'Charge shot' : 'Buy the charge shot in the shop'}">${ic(ownsCharge ? 'statEnergy' : 'navLock')}<span>CHARGE</span></button>` +
            `</div>`;
    },

    hangarWeaponSlotLabel(index) {
        return Number(index) === 0 ? 'NOSE SLOT' : 'WING SLOT ' + index;
    },

    /** Move/swap/unequip after a pull from an equipped slot. */
    finishHangarSlotPull(opts, targetEl, offShip, e) {
        const kind = opts.kind;
        const src = opts.sourceIndex;
        // Pulling a part only takes the part out: the slot stays where it is
        // (move an empty slot by dragging its marker instead).
        if (targetEl) {
            const dst = Number(targetEl.getAttribute('data-slot-index') || 0);
            if (dst === src) return;
            const prev = this.hangarSlotModuleId(kind, dst) || '';
            // Check both directions first: a half-done swap used to drop the
            // other part out of the loadout when it didn't fit back.
            const slm = shipLoadoutManager;
            const fits = (id, idx) => !slm.partFitsSlot || slm.partFitsSlot(this.hangarShipId, kind, id, idx);
            const fitDst = fits(opts.id, dst);
            const fitSrc = prev ? fits(prev, src) : { ok: true };
            const bad = (fitDst && fitDst.ok === false) ? [opts.id, dst, fitDst]
                : ((fitSrc && fitSrc.ok === false) ? [prev, src, fitSrc] : null);
            if (bad) {
                this.showStatusToast(this.hangarModuleLabel(bad[0]) + ' (' + slm.slotSizeLabel(bad[2].need) + ')'
                    + ' DOESN\'T FIT ' + this.hangarWeaponSlotLabel(bad[1]) + ' (' + slm.slotSizeLabel(bad[2].have) + ')');
                this.drawHangarBay();
                return;
            }
            slm.setSlotModule(this.hangarShipId, kind, dst, opts.id);
            if (prev) slm.setSlotModule(this.hangarShipId, kind, src, prev);
            this.applyHangarSlotChoice(kind, dst, opts.id, null);
            return;
        }
        this.applyHangarSlotChoice(kind, src, '', null);
    },

    startHangarPartDrag(cell, downEvent, pull) {
        const stage = this.overlay && this.overlay.querySelector('#hsHangarBayStage');
        const kind = pull ? pull.kind : cell.getAttribute('data-part-kind');
        const iconEl = pull ? pull.iconEl : cell.querySelector('.hs-hangar-part-icon img');
        const SNAP_PX = 64;
        const startX = downEvent.clientX;
        const startY = downEvent.clientY;
        let ghost = null;
        let target = null;
        let moved = false;

        // Grabbing already marks every compatible slot.
        if (stage) {
            stage.classList.add('is-part-dragging');
            stage.setAttribute('data-drag-kind', kind);
            const dragId = pull ? pull.id : cell.getAttribute('data-part-id');
            const fit = shipLoadoutManager.partFitsSlot
                ? shipLoadoutManager.partFitsSlot(this.hangarShipId, kind, dragId) : { ok: true };
            // Oversized part: slots show a "too small" state instead of pulsing.
            stage.classList.toggle('is-part-too-big', !pull && !fit.ok);
        }
        // Ship markers plus the tiles of the slot bar at the top of the bay.
        const slots = () => Array.from(this.overlay.querySelectorAll(
            `.hs-hangar-slot[data-slot-kind="${kind}"], .hs-slot-tile[data-slot-kind="${kind}"]`))
            .filter((el) => !pull || el !== pull.sourceSlot);
        if (pull && pull.sourceSlot) pull.sourceSlot.classList.add('is-pulling');
        // Slots too small for the dragged part turn red and don't snap.
        const dragPartId = pull ? pull.id : cell.getAttribute('data-part-id');
        const tooSmall = (el) => {
            if (!shipLoadoutManager.partFitsSlot) return false;
            const idx = Number(el.getAttribute('data-slot-index') || 0);
            return !shipLoadoutManager.partFitsSlot(this.hangarShipId, kind, dragPartId, idx).ok;
        };
        const smallEls = slots().filter(tooSmall);
        smallEls.forEach((el) => el.classList.add('is-too-small'));
        // Nearest of a slot's markers (wing pairs have one on each wing).
        const pinCenter = (el, px, py) => {
            if (el.classList.contains('hs-slot-tile')) {
                const r = el.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
            let best = null;
            let bestD = Infinity;
            el.querySelectorAll('.hs-hangar-slot-pin').forEach((pin) => {
                const r = pin.getBoundingClientRect();
                const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                const d = px == null ? 0 : Math.hypot(px - c.x, py - c.y);
                if (d < bestD) {
                    bestD = d;
                    best = c;
                }
            });
            return best;
        };
        const setTarget = (el) => {
            if (el === target) return;
            if (target) target.classList.remove('is-drop-target');
            target = el;
            if (target) target.classList.add('is-drop-target');
        };
        const onStage = (x, y) => {
            if (!stage) return false;
            const r = stage.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        };
        // Coalesce pointer moves to one update per frame (the slot search reads layout).
        let rafId = 0;
        let lastMove = null;
        const move = (e) => {
            lastMove = e;
            if (!rafId) rafId = requestAnimationFrame(() => {
                rafId = 0;
                if (lastMove) applyMove(lastMove);
            });
        };
        const applyMove = (e) => {
            if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
            if (!moved) {
                moved = true;
                ghost = document.createElement('div');
                ghost.className = 'hs-hangar-part-ghost';
                if (iconEl) ghost.appendChild(iconEl.cloneNode(true));
                // Start at the cursor; otherwise the transform transition slides it in from the top-left corner.
                ghost.style.transform = `translate(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px)`;
                document.body.appendChild(ghost);
                document.body.classList.add('hs-part-grabbing');
                if (typeof uiTooltip !== 'undefined' && uiTooltip && uiTooltip.hide) uiTooltip.hide();
            }
            // Nearest compatible slot within reach; the icon snaps onto it.
            let best = null;
            let bestPt = null;
            let bestDist = SNAP_PX;
            if (onStage(e.clientX, e.clientY)) {
                slots().filter((el) => smallEls.indexOf(el) === -1).forEach((el) => {
                    const c = pinCenter(el, e.clientX, e.clientY);
                    if (!c) return;
                    const d = Math.hypot(e.clientX - c.x, e.clientY - c.y);
                    if (d < bestDist) {
                        bestDist = d;
                        best = el;
                        bestPt = c;
                    }
                });
            }
            setTarget(best);
            const p = bestPt || { x: e.clientX, y: e.clientY };
            ghost.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
            ghost.classList.toggle('is-snapped', !!best);
            if (pull) {
                // Anywhere but another slot the part comes out; its slot stays put.
                ghost.classList.toggle('is-removing', !best
                    && Math.hypot(e.clientX - startX, e.clientY - startY) >= 24);
            }
        };
        const finish = (e, cancelled) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            lastMove = null;
            try {
                if (downEvent.target && downEvent.target.releasePointerCapture) downEvent.target.releasePointerCapture(downEvent.pointerId);
            } catch (err) { /* ignore */ }
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', cancel);
            document.removeEventListener('keydown', esc, true);
            if (ghost) ghost.remove();
            document.body.classList.remove('hs-part-grabbing');
            if (stage) {
                stage.classList.remove('is-part-dragging', 'is-part-too-big');
                stage.removeAttribute('data-drag-kind');
            }
            const slotEl = target;
            setTarget(null);
            smallEls.forEach((el) => el.classList.remove('is-too-small'));
            if (pull && pull.sourceSlot) pull.sourceSlot.classList.remove('is-pulling');
            if (pull && this.showHangarSlotsInArea) this.showHangarSlotsInArea(null);
            if (cancelled) return;
            if (pull) {
                const back = Math.hypot(e.clientX - startX, e.clientY - startY) < 24;
                if (moved && !back) this.finishHangarSlotPull(pull, slotEl, !slotEl, e);
                return;
            }
            if (!moved && cell.classList.contains('is-equipped')) {
                this.toggleHangarPartDetails(cell); // plain click on an assigned part: expand the row
            } else if (!moved) {
                this.equipHangarPart(cell, null); // plain click
            } else if (slotEl) {
                this.equipHangarPart(cell, slotEl);
            } else if (smallEls.length && onStage(e.clientX, e.clientY)) {
                // Dropped near slots it can't use: say why instead of nothing.
                const idx = Number(smallEls[0].getAttribute('data-slot-index') || 0);
                this.applyHangarSlotChoice(kind, idx, dragPartId, null);
            }
        };
        const up = (e) => finish(e, false);
        const cancel = (e) => finish(e, true);
        const esc = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                finish(e, true);
            }
        };
        // Keep receiving moves even when the pointer leaves the grip or crosses iframes/canvas.
        try {
            if (downEvent.target && downEvent.target.setPointerCapture) downEvent.target.setPointerCapture(downEvent.pointerId);
        } catch (err) { /* ignore */ }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', cancel);
        document.addEventListener('keydown', esc, true);
    },
});
