"use strict";

// HomeStationUI: weapon slot buy dialog, hover move handle and area helpers of the hangar bay.
extendClass(HomeStationUI, {
    /** Confirm dialog for buying the next weapon slot (reuses the area-upgrade modal look). */
    openWeaponSlotBuyModal(shipId) {
        const root = this.overlay && this.overlay.querySelector('.home-station-content');
        if (!root) return;
        this.closeAreaUpgradeModal();
        const profile = this.getProfile();
        const check = profileManager.canPurchaseWeaponSlot(shipId);
        if (!check || check.reason === 'MAX SLOTS' || check.reason === 'N/A') return;
        const short = !check.ok;
        const modal = document.createElement('div');
        modal.className = 'hs-res-buy-modal hs-area-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Buy weapon slot');
        modal.innerHTML = `<div class="hs-res-buy-dialog">` +
            `<div class="hs-res-buy-head"><h3>BUY WEAPON SLOT</h3>` +
            `<p class="hs-res-buy-sub">${this.shipName(shipId)}</p></div>` +
            `<ul class="hs-area-modal-list"><li>Adds <strong>+1 weapon slot</strong> — drag it onto the ship afterwards</li></ul>` +
            `<div class="hs-res-buy-cost">${check.cost ? this.renderCostGrid(check.cost, (profile && profile.resources) || {}, profile) : ''}</div>` +
            (short ? `<p class="hs-area-modal-short">NOT ENOUGH RESOURCES</p>` : '') +
            `<div class="hs-res-buy-actions">` +
            `<button type="button" class="action-button hs-res-buy-close" data-area-modal-cancel>CANCEL</button>` +
            `<button type="button" class="action-button" data-area-modal-confirm ${short ? 'disabled' : ''}>CONFIRM</button>` +
            `</div></div>`;
        root.appendChild(modal);
        const confirmBtn = modal.querySelector('[data-area-modal-confirm]');
        const close = () => this.closeAreaUpgradeModal();
        modal.querySelector('[data-area-modal-cancel]').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        confirmBtn.addEventListener('click', () => {
            close();
            const res = profileManager.purchaseWeaponSlot(shipId);
            this.setStatus(res.ok ? 'WEAPON SLOT BOUGHT — DRAG IT ONTO THE SHIP'
                : (res.reason === 'RESOURCES' ? 'NOT ENOUGH RESOURCES FOR A WEAPON SLOT' : 'CANNOT BUY SLOT: ' + res.reason));
        });
        this._areaModalKeys = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace') close();
            else if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
            else return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        document.addEventListener('keydown', this._areaModalKeys, true);
        (confirmBtn.disabled ? modal.querySelector('[data-area-modal-cancel]') : confirmBtn).focus();
    },

    /**
     * Hover-only move handle on the corner of an equipped weapon slot.
     * Dragging it moves the slot (weapon stays in) — dragging the weapon
     * itself still pulls it out. null hides the handle.
     */
    showHangarSlotMoveHandle(slotEl) {
        const handle = this.overlay && this.overlay.querySelector('#hsSlotMoveHandle');
        const stage = this.overlay && this.overlay.querySelector('#hsHangarBayStage');
        if (!handle || !stage) return;
        // Slots are dragged directly now: no separate move handle.
        slotEl = null;
        // Split slots get a second handle on the mirrored half.
        let mirror = this.overlay.querySelector('#hsSlotMoveHandleMirror');
        if (!mirror) {
            mirror = handle.cloneNode(true);
            mirror.id = 'hsSlotMoveHandleMirror';
            mirror.hidden = true;
            delete mirror.dataset.bound;
            handle.after(mirror);
        }
        const drag = this._hangarSlotMoveDrag;
        if (drag && (drag.handle === handle || drag.handle === mirror)) return;
        const ok = slotEl && slotEl.getAttribute('data-slot-kind') === 'weapon' && !slotEl.classList.contains('is-empty');
        const sized = (el) => el && el.getBoundingClientRect().width > 0 ? el : null;
        const pin = ok ? sized(slotEl.querySelector('.hs-hangar-slot-pin:not(.is-mirror)')) : null;
        const mpin = ok ? sized(slotEl.querySelector('.hs-hangar-slot-pin.is-mirror')) : null;
        if (!pin && !mpin) {
            handle.hidden = true;
            mirror.hidden = true;
            this._hangarMoveHandleSlot = null;
            return;
        }
        this._hangarMoveHandleSlot = slotEl;
        const sr = stage.getBoundingClientRect();
        const index = slotEl.getAttribute('data-slot-index') || '0';
        // On the outer top corner of its half (away from the hull).
        const place = (h, p, outward) => {
            if (!p) {
                h.hidden = true;
                return;
            }
            const r = p.getBoundingClientRect();
            // Self-calibrating: park the handle at its own origin, measure where that lands on screen and
            // its real scale, then shift it by the visual distance to the slot's outer top corner.
            h.hidden = false;
            h.style.left = '0px';
            h.style.top = '0px';
            const hr = h.getBoundingClientRect();
            const sc = (hr.width && h.offsetWidth) ? hr.width / h.offsetWidth : 1;
            const tx = outward < 0 ? r.left : r.right;
            h.style.left = Math.round((tx - (hr.left + hr.width / 2)) / sc) + 'px';
            h.style.top = Math.round((r.top - (hr.top + hr.height / 2)) / sc) + 'px';
            h.setAttribute('data-slot-index', index);
            h.hidden = false;
            if (h.dataset.bound !== '1') {
                h.dataset.bound = '1';
                h.addEventListener('pointerdown', (e) => this.startHangarSlotMove(h, e));
            }
        };
        // Outward = away from the other half; a lone pin keeps the right side.
        const cx = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
        const pinOut = pin && mpin ? (cx(pin) < cx(mpin) ? -1 : 1) : 1;
        place(handle, pin, pinOut);
        place(mirror, mpin, -pinOut);
    },

    /**
     * Stage pointermove: show the move handle next to the equipped weapon
     * slot under the pointer. Pure geometry on the slot markers, so it works
     * whatever element is on top; it stays while the pointer is inside the
     * zone slot + gap + handle, so it can be reached reliably.
     */
    trackHangarSlotMoveHandle(clientX, clientY) {
        if (!this.overlay) return;
        // A drag whose handle was re-rendered away never got its pointerup:
        // drop the stale flag instead of blocking the handle for good.
        if (this._hangarSlotMoveDrag && !(this._hangarSlotMoveDrag.handle && this._hangarSlotMoveDrag.handle.isConnected)) {
            this._hangarSlotMoveDrag = null;
        }
        if (this._hangarSlotMoveDrag) return;
        const handle = this.overlay.querySelector('#hsSlotMoveHandle');
        if (!handle) return;
        const inside = (r, pad) => clientX >= r.left - pad && clientX <= r.right + pad
            && clientY >= r.top - pad && clientY <= r.bottom + pad;
        if (this._hangarMoveHandleSlot && this._hangarMoveHandleSlot.isConnected) {
            // Stay while the pointer is on either half or its handle.
            const mirror = this.overlay.querySelector('#hsSlotMoveHandleMirror');
            const zones = [
                [this._hangarMoveHandleSlot.querySelector('.hs-hangar-slot-pin:not(.is-mirror)'), handle],
                [this._hangarMoveHandleSlot.querySelector('.hs-hangar-slot-pin.is-mirror'), mirror]
            ];
            const keep = zones.some(([p, h]) => {
                if (!p || !h || h.hidden) return false;
                const a = p.getBoundingClientRect();
                const b = h.getBoundingClientRect();
                return inside({
                    left: Math.min(a.left, b.left), right: Math.max(a.right, b.right),
                    top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom)
                }, 12);
            });
            if (keep) {
                this.cancelHangarMoveHandleHide();
                return;
            }
        }
        let found = null;
        // Any marker of the slot counts (wing pairs have one per wing).
        this.overlay.querySelectorAll('.hs-hangar-slot[data-slot-kind="weapon"]:not(.is-empty)').forEach((el) => {
            if (found) return;
            el.querySelectorAll('.hs-hangar-slot-pin').forEach((pin) => {
                const r = pin.getBoundingClientRect();
                if (!found && r.width > 0 && inside(r, 6)) found = el;
            });
        });
        if (found) {
            this.cancelHangarMoveHandleHide();
            this.showHangarSlotMoveHandle(found);
            return;
        }
        // Leaving the zone: hide after a short grace period, so crossing the
        // gap to the handle or grazing the edge doesn't make it flicker.
        if (!this._hangarMoveHandleHideTimer && this._hangarMoveHandleSlot) {
            this._hangarMoveHandleHideTimer = setTimeout(() => {
                this._hangarMoveHandleHideTimer = null;
                if (!this._hangarSlotMoveDrag) this.showHangarSlotMoveHandle(null);
            }, 220);
        }
    },

    cancelHangarMoveHandleHide() {
        if (this._hangarMoveHandleHideTimer) {
            clearTimeout(this._hangarMoveHandleHideTimer);
            this._hangarMoveHandleHideTimer = null;
        }
    },

    /** Drag the move handle: the slot (with its weapon) follows the pointer. */
    startHangarSlotMove(handle, downEvent) {
        if (downEvent.button !== 0) return;
        downEvent.preventDefault();
        downEvent.stopPropagation();
        const index = Number(handle.getAttribute('data-slot-index') || 0);
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        this.cancelHangarMoveHandleHide();
        this._hangarSlotMoveDrag = { handle: handle };
        this.overlay.querySelectorAll('.hs-slot-move-handle').forEach((h) => {
            if (h !== handle) h.hidden = true;
        });
        handle.classList.add('is-dragging');
        handle.setPointerCapture(downEvent.pointerId);
        let raf = 0;
        const move = (e) => {
            const sr = stage.getBoundingClientRect();
            const z = window.vfEffectiveZoom ? window.vfEffectiveZoom(stage) : 1;
            handle.style.left = Math.round((e.clientX - sr.left) / z) + 'px';
            handle.style.top = Math.round((e.clientY - sr.top) / z) + 'px';
            const spot = this.hangarSocketSpotAt(index, e.clientX, e.clientY);
            this.showHangarSlotsInArea(spot ? spot.area : null);
            handle.classList.toggle('is-invalid', !!(spot && !spot.ok));
            if (!spot || !spot.ok) return;
            shipLoadoutManager.setEmptySlotAnchor(this.hangarShipId, 'weapon', index, spot.nx, spot.ny);
            if (!raf) {
                raf = requestAnimationFrame(() => {
                    raf = 0;
                    this.drawHangarBay();
                });
            }
        };
        let ended = false;
        const end = (e) => {
            if (ended) return;
            ended = true;
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
            handle.removeEventListener('lostpointercapture', end);
            document.removeEventListener('pointerup', end, true);
            if (e && e.pointerId != null && handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            handle.classList.remove('is-dragging', 'is-invalid');
            this._hangarSlotMoveDrag = null;
            this._hangarMoveHandleSlot = null;
            this.overlay.querySelectorAll('.hs-slot-move-handle').forEach((h) => { h.hidden = true; });
            this.showHangarSlotsInArea(null);
            handle.hidden = true;
            this.drawHangarBay();
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        // Also end when capture is lost (handle re-rendered) or the button
        // is released anywhere.
        handle.addEventListener('lostpointercapture', end);
        document.addEventListener('pointerup', end, true);
    },

    /**
     * While a slot is dragged: show every slot already in the area under the
     * pointer (both wings count as one area — wing slots are pairs). null
     * clears it. Uses the same is-area-hover class as hovering an area.
     */
    showHangarSlotsInArea(area) {
        this._hangarDragRevealArea = area || null;
        if (!this.overlay) return;
        const wing = area && area.indexOf('wing') === 0;
        this.overlay.querySelectorAll('.hs-hangar-slot').forEach((el) => {
            const at = el.getAttribute('data-slot-area') || '';
            const hit = !!area && (wing ? at.indexOf('wing') === 0 : at === area);
            el.classList.toggle('is-area-hover', hit);
        });
    },

    /** Area of the ship under a screen point, or null. */
    hangarAreaAtClient(clientX, clientY) {
        const spot = this.hangarSocketSpotAt(0, clientX, clientY);
        return spot ? spot.area : null;
    },

    /**
     * Ship-normalized drop spot for a weapon slot socket, or null when the
     * pointer is off the ship. ok = the area fits the slot (nose slot on
     * the nose, wing slots on a wing).
     */
    hangarSocketSpotAt(index, clientX, clientY) {
        const canvas = this.overlay && this.overlay.querySelector('#hsHangarBayCanvas');
        const model = this._hangarLastModel;
        if (!canvas || !model || !model.layout || this._hangarLastOx == null) return null;
        const rect = canvas.getBoundingClientRect();
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
        const scale = Math.max(1, this._hangarLastScale || 1);
        const px = (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
        const py = (clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
        // Same box the bay draws and positions the slot markers on
        // (draw-hangar-bay: mw / mh), or the dropped socket lands elsewhere.
        const lw = Math.max(8, model.width || 20);
        const lh = Math.max(8, model.height || 16);
        const lx = (px - this._hangarLastOx) / scale;
        const ly = (py - this._hangarLastOy) / scale;
        const area = this.hangarAreaAt(model.layout, lx, ly);
        if (!area) return null;
        // Nose and core take any weapon slot (single or split); wings take
        // wing slots only — the nose slot stays on the body.
        const wingArea = area === 'wingLeft' || area === 'wingRight';
        const ok = area === 'front' || area === 'center' || wingArea;
        return { ok: ok, area: area, nx: lx / lw, ny: ly / lh };
    },
});
