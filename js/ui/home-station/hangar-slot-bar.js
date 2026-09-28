"use strict";

// HomeStationUI: weapon slot bar at the top centre of the hangar bay.
// One tile per weapon slot (NOSE, then one per wing pair). Weapons are
// dropped onto a tile to equip that slot; an empty tile is dragged onto the
// ship to place its socket (nose slot → nose, wing slots → wings); a filled
// tile is dragged like the part on the ship (move / swap / unequip).
extendClass(HomeStationUI, {
    /** Rebuild the tiles when the weapon slots change (called from updateHangarSlotPins). */
    renderHangarSlotBar(slots) {
        const bar = this.overlay && this.overlay.querySelector('#hsSlotBar');
        if (!bar) return;
        const weapons = (slots || []).filter((s) => s.kind === 'weapon');
        // Tile size follows where the slot sits on the ship (like its socket):
        // big on the nose, half size on a wing.
        const onWing = (s) => !!s.split
            || String(s.area || (s.index > 0 ? 'wingLeft' : 'front')).indexOf('wing') === 0;
        const L = shipLoadoutManager.getLoadout(this.hangarShipId);
        const fireKey = (i) => (shipLoadoutManager.getWeaponFireKey ? shipLoadoutManager.getWeaponFireKey(L, i) : 'space');
        const allKey = shipLoadoutManager.getAllFireKey ? shipLoadoutManager.getAllFireKey(L) : 'space';
        const keyLabel = (k) => (k === 'space' ? 'SPC' : String(k).toUpperCase());
        // Buy tile: next weapon slot (new-profile purchase model only).
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const buy = pm && pm.usesWeaponSlotPurchase && pm.usesWeaponSlotPurchase()
            ? pm.canPurchaseWeaponSlot(this.hangarShipId) : null;
        const costLabel = (c) => Object.keys(c || {}).map((k) => c[k] + ' ' + k.toUpperCase()).join(' · ');
        const buyTile = !buy || buy.reason === 'MAX SLOTS' || buy.reason === 'N/A' ? ''
            : `<button type="button" class="hs-slot-tile hs-slot-tile-buy${buy.ok ? '' : ' is-locked'}" data-buy-weapon-slot="1"` +
              ` title="BUY WEAPON SLOT — ${costLabel(buy.cost)}${buy.ok ? '' : ' · NOT ENOUGH RESOURCES'}">` +
              `<span class="hs-slot-tile-key hs-slot-tile-buy-cost">BUY</span>` +
              `<span class="hs-slot-tile-socket hs-slot-tile-all-label">+</span>` +
              `</button>`;
        const sig = 'buy:' + (buy ? (buy.ok ? 1 : 0) + costLabel(buy.cost) : '-') + '|all:' + allKey + '|' + weapons.map((s) => s.index + ':' + (s.id || '') + ':' + (onWing(s) ? 'w' : 'n') + ':' + fireKey(s.index)).join('|');
        if (bar.dataset.sig !== sig) {
            bar.dataset.sig = sig;
            // ALL tile: the key that fires every weapon at once.
            // As tall as the biggest slot: wing size only when every slot is a wing slot.
            const allSmall = weapons.length > 0 && weapons.every(onWing);
            const allTile = `<div class="hs-slot-tile hs-slot-tile-all is-filled${allSmall ? ' is-wing' : ''}" aria-label="ALL WEAPONS · ${keyLabel(allKey)}"` +
                ` title="ALL WEAPONS — this key fires every gun at once">` +
                `<span class="hs-slot-tile-socket hs-slot-tile-all-label">ALL</span>` +
                `<span class="hs-slot-tile-key is-${allKey}" data-fire-key-all="1"` +
                ` title="FIRE-ALL KEY — click to cycle SPACE · A · S · D">${keyLabel(allKey)}</span>` +
                `</div>`;
            bar.innerHTML = allTile + weapons.map((s) => {
                const wing = s.index > 0;
                const label = wing ? 'WING ' + s.index : 'NOSE';
                const small = onWing(s);
                const name = s.id ? this.hangarModuleLabel(s.id) : 'EMPTY';
                const body = s.id
                    ? this.moduleIconHtml('weapon', s.id, 32, 'hs-pixel', false)
                    : '<span class="hs-slot-tile-bore" aria-hidden="true"></span>';
                const hint = s.id
                    ? 'drag to move or remove'
                    : 'drag onto nose or core (centre = single, off-centre = split)' + (wing ? ' or a wing' : '');
                return `<button type="button" class="hs-slot-tile${s.id ? ' is-filled' : ' is-empty'}${small ? ' is-wing' : ''}"` +
                    ` data-slot-kind="weapon" data-slot-index="${s.index}" aria-label="${label} · ${name}"` +
                    ` title="${label} · ${name}${wing ? ' · SPLIT ONTO BOTH WINGS' : ''} — ${hint}">` +

                    `<span class="hs-slot-tile-socket">${body}</span>` +
                    (s.id
                        ? `<span class="hs-slot-tile-key is-${fireKey(s.index)}" data-fire-key-slot="${s.index}"` +
                          ` title="SOLO FIRE KEY — click to cycle SPACE · A · S · D">${keyLabel(fireKey(s.index))}</span>`
                        : '') +
                    `</button>`;
            }).join('') + buyTile;
        }
        if (bar.dataset.bound !== '1') {
            bar.dataset.bound = '1';
            bar.addEventListener('pointerdown', (e) => this.onHangarSlotTileDown(e));
        }
    },

    onHangarSlotTileDown(e) {
        if (e.button !== 0) return;
        // ALL tile: its badge cycles the fire-all key; the tile itself is inert.
        if (e.target.closest && e.target.closest('[data-fire-key-all]')) {
            e.preventDefault();
            e.stopPropagation();
            // No status line: the badge itself shows the new key.
            shipLoadoutManager.cycleAllFireKey(this.hangarShipId);
            this.drawHangarBay();
            return;
        }
        if (e.target.closest && e.target.closest('.hs-slot-tile-all')) return;
        // Buy tile: purchase the next weapon slot for this ship.
        if (e.target.closest && e.target.closest('[data-buy-weapon-slot]')) {
            e.preventDefault();
            const res = profileManager.purchaseWeaponSlot(this.hangarShipId);
            this.setStatus(res.ok ? 'WEAPON SLOT BOUGHT — DRAG IT ONTO THE SHIP'
                : (res.reason === 'RESOURCES' ? 'NOT ENOUGH RESOURCES FOR A WEAPON SLOT' : 'CANNOT BUY SLOT: ' + res.reason));
            return;
        }
        // Key badge: cycle this slot's fire key instead of dragging.
        const keyBadge = e.target.closest && e.target.closest('[data-fire-key-slot]');
        if (keyBadge) {
            e.preventDefault();
            e.stopPropagation();
            const idx = Number(keyBadge.getAttribute('data-fire-key-slot') || 0);
            shipLoadoutManager.cycleWeaponFireKey(this.hangarShipId, idx);
            // The key badge itself shows the new key; no status line needed.
            this.drawHangarBay();
            return;
        }
        const tile = e.target.closest && e.target.closest('.hs-slot-tile');
        if (!tile) return;
        e.preventDefault();
        const index = Number(tile.getAttribute('data-slot-index') || 0);
        // A plain click (no drag) focuses the slot on the ship — both
        // halves of a split slot.
        const sx = e.clientX;
        const sy = e.clientY;
        const up = (ev) => {
            document.removeEventListener('pointerup', up, true);
            if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) this.focusHangarSlot(index);
        };
        document.addEventListener('pointerup', up, true);
        if (tile.classList.contains('is-filled')) {
            // Same as grabbing the installed part on the ship.
            const slotEl = this.overlay.querySelector(
                `.hs-hangar-slot[data-slot-kind="weapon"][data-slot-index="${index}"]`);
            if (slotEl) this.startHangarSlotPull(slotEl, e);
            return;
        }
        this.startHangarSocketDrag(tile, index, e);
    },

    /** Highlight a weapon slot on the ship (every marker of it) and its tile. */
    focusHangarSlot(index) {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-hangar-slot.is-focused, .hs-slot-tile.is-focused')
            .forEach((el) => el.classList.remove('is-focused'));
        const slot = this.overlay.querySelector(
            `.hs-hangar-slot[data-slot-kind="weapon"][data-slot-index="${index}"]`);
        const tile = this.overlay.querySelector(`.hs-slot-tile[data-slot-index="${index}"]`);
        if (slot) slot.classList.add('is-focused');
        if (tile) tile.classList.add('is-focused');
        // Cleared by the next press anywhere else.
        const clear = (ev) => {
            if (ev.target.closest && ev.target.closest('.hs-slot-tile')) return;
            document.removeEventListener('pointerdown', clear, true);
            if (slot) slot.classList.remove('is-focused');
            if (tile) tile.classList.remove('is-focused');
        };
        document.addEventListener('pointerdown', clear, true);
    },

    /** Drag an empty slot tile onto the ship to place its socket. */
    startHangarSocketDrag(tile, index, downEvent) {
        const startX = downEvent.clientX;
        const startY = downEvent.clientY;
        let ghost = null;
        const move = (e) => {
            if (!ghost) {
                if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
                ghost = document.createElement('div');
                ghost.className = 'hs-slot-socket-ghost' + (index > 0 ? ' is-wing' : '');
                document.body.appendChild(ghost);
                tile.classList.add('is-dragging');
            }
            const spot = this.hangarSocketSpotAt(index, e.clientX, e.clientY);
            this.showHangarSlotsInArea(spot ? spot.area : null);
            ghost.style.transform = `translate(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px)`;
            ghost.classList.toggle('is-valid', !!(spot && spot.ok));
            ghost.classList.toggle('is-invalid', !!(spot && !spot.ok));
        };
        const finish = (e, cancelled) => {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', cancel);
            tile.classList.remove('is-dragging');
            this.showHangarSlotsInArea(null);
            if (!ghost) return;
            ghost.remove();
            if (cancelled) return;
            const spot = this.hangarSocketSpotAt(index, e.clientX, e.clientY);
            if (!spot) return;
            if (!spot.ok) {
                this.setStatus(index > 0 ? 'WEAPONS GO ON NOSE, CORE OR WINGS' : 'THE NOSE SLOT GOES ON NOSE OR CORE');
                return;
            }
            const res = shipLoadoutManager.setEmptySlotAnchor(this.hangarShipId, 'weapon', index, spot.nx, spot.ny);
            if (res && res.ok === false && res.reason === 'SLOT_OCCUPIED') {
                this.setStatus('NO ROOM THERE — SLOTS CAN\'T OVERLAP');
            }
            this.drawHangarBay();
        };
        const up = (e) => finish(e, false);
        const cancel = (e) => finish(e, true);
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', cancel);
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
        // Beside its half, on the inner side (towards the hull), never over it.
        const place = (h, p, outward) => {
            if (!p) {
                h.hidden = true;
                return;
            }
            const r = p.getBoundingClientRect();
            const x = outward < 0 ? r.left - sr.left - 16 : r.right - sr.left + 16;
            h.style.left = Math.round(x) + 'px';
            h.style.top = Math.round(r.top + r.height / 2 - sr.top) + 'px';
            h.setAttribute('data-slot-index', index);
            h.hidden = false;
            if (h.dataset.bound !== '1') {
                h.dataset.bound = '1';
                h.addEventListener('pointerdown', (e) => this.startHangarSlotMove(h, e));
            }
        };
        place(handle, pin, 1);
        place(mirror, mpin, -1);
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
            handle.style.left = Math.round(e.clientX - sr.left) + 'px';
            handle.style.top = Math.round(e.clientY - sr.top) + 'px';
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
        const lw = Math.max(1, model.layout.width || model.width || 1);
        const lh = Math.max(1, model.layout.height || model.height || 1);
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
