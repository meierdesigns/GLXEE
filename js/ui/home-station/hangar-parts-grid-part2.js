"use strict";

// HomeStationUI members, continued from hangar-parts-grid.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
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
        const iconEl = pull ? pull.iconEl : cell.querySelector('.hs-hangar-part-icon img, .hs-pick-ico img');
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
                document.body.appendChild(ghost);
                // Map viewport px to the ghost's own layout px (the page may be zoomed or scaled).
                ghost.style.cssText = 'left:0;top:0;margin:0;';
                const o = ghost.getBoundingClientRect();
                ghost.style.left = '100px';
                const k = (ghost.getBoundingClientRect().left - o.left) / 100 || 1;
                ghost._place = (x, y) => {
                    ghost.style.left = `${(x - o.left) / k}px`;
                    ghost.style.top = `${(y - o.top) / k}px`;
                };
                const itemBody = cell && cell.querySelector('.hs-item-body');
                if (itemBody) {
                    // Physical inventory item: lift the bare object, held where it was grabbed.
                    const r = cell.getBoundingClientRect();
                    const s = r.width / Math.max(1, cell.offsetWidth);
                    const wrap = document.createElement('div');
                    wrap.className = 'hs-slot-picker hs-bay-inv';
                    wrap.style.cssText = `position:absolute;left:0;top:0;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px;transform-origin:0 0;transform:scale(${s / k});margin:0;padding:0;border:0;outline:0;background:none;box-shadow:none;clip-path:none;filter:none;`;
                    const clone = cell.cloneNode(true);
                    clone.classList.remove('is-dragging');
                    clone.style.width = '100%';
                    clone.style.height = '100%';
                    // Only the object itself: no cell frame, background or labels.
                    clone.className = 'hs-pick-cell';
                    clone.style.border = '0';
                    clone.style.background = 'none';
                    clone.style.boxShadow = 'none';
                    clone.style.outline = '0';
                    clone.querySelectorAll('.hs-pick-size, .hs-pick-ico').forEach((n) => n.remove());
                    wrap.appendChild(clone);
                    ghost.appendChild(wrap);
                    ghost.classList.add('is-item');
                    ghost.style.width = `${r.width / k}px`;
                    ghost.style.height = `${r.height / k}px`;
                    ghost._grab = { x: startX - r.left, y: startY - r.top };
                    ghost._half = { x: r.width / 2, y: r.height / 2 };
                    cell.classList.add('is-dragging');
                } else {
                    if (iconEl) ghost.appendChild(iconEl.cloneNode(true));
                    ghost.style.margin = '';
                }
                // Start at the cursor; otherwise the transform transition slides it in from the top-left corner.
                ghost._place(e.clientX - (ghost._grab ? ghost._grab.x : 0), e.clientY - (ghost._grab ? ghost._grab.y : 0));
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
            const off = !ghost._grab ? { x: 0, y: 0 } : best ? ghost._half : ghost._grab;
            ghost._place(p.x - off.x, p.y - off.y);
            ghost.classList.toggle('is-snapped', !!best);
            if (ghost._grab && typeof physicalItem !== 'undefined' && physicalItem.previewInGrid) {
                if (best) physicalItem.previewInGrid(null);
                else physicalItem.previewInGrid(cell, e.clientX - ghost._grab.x, e.clientY - ghost._grab.y);
            }
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
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', up, true);
            window.removeEventListener('pointercancel', cancel, true);
            document.removeEventListener('keydown', esc, true);
            if (ghost) ghost.remove();
            if (typeof physicalItem !== 'undefined' && physicalItem.previewInGrid) physicalItem.previewInGrid(null);
            if (cell) cell.classList.remove('is-dragging');
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
            // Inventory item dropped back into the grid: move it there.
            if (moved && !slotEl && ghost && ghost._grab && typeof physicalItem !== 'undefined' && physicalItem.dropInGrid
                && physicalItem.dropInGrid(this, cell, e.clientX - ghost._grab.x, e.clientY - ghost._grab.y)) return;
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
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', cancel, true);
        document.addEventListener('keydown', esc, true);
    },
});
