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
        const view = this._hangarLeftView === 'parts' ? 'parts' : 'areas';
        const btn = (id, label) =>
            `<button type="button" class="hs-hangar-view-btn${view === id ? ' is-active' : ''}" data-hangar-left-view="${id}" aria-pressed="${view === id}">${label}</button>`;
        return `<div class="hs-hangar-view-toggle" role="group" aria-label="Sidebar view">${btn('areas', 'AREAS')}${btn('parts', 'PARTS')}</div>`;
    },

    renderHangarPartsGrid(inventory, loadout) {
        return `<div class="hs-hangar-parts">` + HANGAR_PART_SECTIONS.map((sec) => {
            const ids = (inventory && inventory[sec.key]) || [];
            const equipped = (loadout && loadout[sec.key]) || [];
            const slm = shipLoadoutManager;
            const cells = ids.map((id) => {
                const on = equipped.indexOf(id) !== -1;
                const label = this.hangarModuleLabel(id);
                const size = slm.partSizeLabel ? slm.partSizeLabel(sec.kind, id) : 'S';
                const fits = !slm.partFitsSlot || slm.partFitsSlot(this.hangarShipId, sec.kind, id).ok;
                const isToggle = sec.kind !== 'weapon';
                const state = isToggle ? `<span class="hs-hangar-part-state">${on ? 'ON' : 'OFF'}</span>` : '';
                return `<button type="button" class="hs-hangar-part${on ? ' is-equipped' : ''}${fits ? '' : ' is-too-big'}${isToggle ? ' is-toggle' : ''}"` +
                    (isToggle ? ` aria-pressed="${on}"` : '') +
                    ` data-part-kind="${sec.kind}" data-part-id="${id}" data-part-size="${size}"` +
                    ` title="${label} · SIZE ${size}${on ? ' · EQUIPPED' : ''}${fits ? '' : ' · NEEDS ' + size + ' SLOT'}">` +
                    `<span class="hs-slot-size is-${size}">${size}</span>` +
                    this.slotGlyphHtml(sec.kind, 'hs-hangar-part-glyph') +
                    `<span class="hs-hangar-part-icon">${this.iconHtml(this.hangarModuleIconKey(sec.kind, id), 32, 'hs-pixel', false)}</span>` +
                    `<span class="hs-hangar-part-name">${label}</span>` + state +
                    `</button>`;
            }).join('');
            return `<section class="hs-hangar-parts-section" data-part-section="${sec.kind}">` +
                `<h4 class="hs-hangar-parts-title">${this.slotGlyphHtml(sec.kind)}${sec.label} <small>${ids.length}</small></h4>` +
                `<div class="hs-hangar-parts-grid">${cells || '<p class="hs-muted hs-empty-slot">NONE OWNED</p>'}</div>` +
                `</section>`;
        }).join('') + `</div>`;
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
        this.overlay.querySelectorAll('.hs-hangar-part').forEach((cell) => {
            // Pointer drag instead of native DnD: only the icon follows the cursor.
            cell.setAttribute('draggable', 'false');
            cell.addEventListener('dragstart', (e) => e.preventDefault());
            // Only weapons are placed on the ship; every other part type is
            // a plain on/off switch here in the sidebar.
            if (cell.getAttribute('data-part-kind') !== 'weapon') {
                cell.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleHangarPart(cell);
                });
                return;
            }
            cell.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                this.startHangarPartDrag(cell, e);
            });
            cell.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
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
        this.applyHangarSlotChoice(kind, Math.min(list.length, cap - 1), id, null);
    },

    /** Equip a grid part into a slot (explicit slot element, or the first free one of its kind). */
    equipHangarPart(cell, slotEl) {
        const kind = cell.getAttribute('data-part-kind');
        const id = cell.getAttribute('data-part-id');
        const index = slotEl
            ? Number(slotEl.getAttribute('data-slot-index') || 0)
            : this.hangarSlotForPart(kind);
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
        holder.innerHTML = this.iconHtml(this.hangarModuleIconKey(kind, id), 32, 'hs-pixel', false);
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

    /** Move/swap/unequip after a pull from an equipped slot. */
    finishHangarSlotPull(opts, targetEl, offShip) {
        const kind = opts.kind;
        const src = opts.sourceIndex;
        if (targetEl) {
            const dst = Number(targetEl.getAttribute('data-slot-index') || 0);
            if (dst === src) return;
            const prev = this.hangarSlotModuleId(kind, dst) || '';
            const a = shipLoadoutManager.setSlotModule(this.hangarShipId, kind, dst, opts.id);
            if (a && a.ok) shipLoadoutManager.setSlotModule(this.hangarShipId, kind, src, prev);
            this.applyHangarSlotChoice(kind, dst, opts.id, null);
            return;
        }
        if (offShip) this.applyHangarSlotChoice(kind, src, '', null);
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
        const slots = () => Array.from(this.overlay.querySelectorAll(`.hs-hangar-slot[data-slot-kind="${kind}"]`))
            .filter((el) => !pull || el !== pull.sourceSlot);
        if (pull && pull.sourceSlot) pull.sourceSlot.classList.add('is-pulling');
        // Nearest of a slot's markers (wing pairs have one on each wing).
        const pinCenter = (el, px, py) => {
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
        const move = (e) => {
            if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
            if (!moved) {
                moved = true;
                ghost = document.createElement('div');
                ghost.className = 'hs-hangar-part-ghost';
                if (iconEl) ghost.appendChild(iconEl.cloneNode(true));
                document.body.appendChild(ghost);
                document.body.classList.add('hs-part-grabbing');
            }
            // Nearest compatible slot within reach; the icon snaps onto it.
            let best = null;
            let bestPt = null;
            let bestDist = SNAP_PX;
            if (onStage(e.clientX, e.clientY)) {
                slots().forEach((el) => {
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
                ghost.classList.toggle('is-removing', !best
                    && Math.hypot(e.clientX - startX, e.clientY - startY) >= 24);
            }
        };
        const finish = (e, cancelled) => {
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
            if (pull && pull.sourceSlot) pull.sourceSlot.classList.remove('is-pulling');
            if (cancelled) return;
            if (pull) {
                const back = Math.hypot(e.clientX - startX, e.clientY - startY) < 24;
                if (moved && !back) this.finishHangarSlotPull(pull, slotEl, !slotEl);
                return;
            }
            if (!moved) {
                this.equipHangarPart(cell, null); // plain click
            } else if (slotEl) {
                this.equipHangarPart(cell, slotEl);
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
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', cancel);
        document.addEventListener('keydown', esc, true);
    },
});
