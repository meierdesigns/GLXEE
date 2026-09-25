"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    bindHangarSlotEvents() {
        if (!this.overlay) return;
        this.bindHangarModuleScale();
        this.bindHangarSlotPinDrag();
        this.bindHangarSlotHoverLink();
        this.bindHangarSlotCardDrag();

        // Close button for component details
        const closeBtn = this.overlay.querySelector('[data-close-component]');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._hangarOpenSlot = null;
                this.overlay.querySelectorAll('.hs-hangar-slot.is-open').forEach((el) => el.classList.remove('is-open'));
                this.updateHangarSlotLinks();
                this.updateComponentDetails(null, 0, true);
            });
        }

        this.overlay.querySelectorAll('[data-hangar-slot-toggle]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                if (btn._hsJustDragged) {
                    btn._hsJustDragged = false;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const kind = btn.getAttribute('data-hangar-slot-toggle');
                const index = Number(btn.getAttribute('data-slot-index') || 0);
                const same = this._hangarOpenSlot
                    && this._hangarOpenSlot.kind === kind
                    && Number(this._hangarOpenSlot.index) === index;
                this._hangarOpenSlot = same ? null : { kind: kind, index: index };
                this.overlay.querySelectorAll('.hs-hangar-slot').forEach((el) => {
                    const open = el.getAttribute('data-slot-kind') === kind
                        && Number(el.getAttribute('data-slot-index')) === index
                        && !same;
                    el.classList.toggle('is-open', open);
                });
                this.updateHangarSlotLinks();
                this.updateComponentDetails(kind, index, same);
            });
        });

        this.overlay.querySelectorAll('[data-hangar-slot-set]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const kind = btn.getAttribute('data-hangar-slot-set');
                const index = Number(btn.getAttribute('data-slot-index') || 0);
                const modId = btn.getAttribute('data-mod-id') || '';
                this.applyHangarSlotChoice(kind, index, modId, btn);
            });
        });

        this.overlay.querySelectorAll('[data-hangar-slot-select]').forEach((sel) => {
            sel.addEventListener('change', () => {
                const kind = sel.getAttribute('data-hangar-slot-select');
                const index = Number(sel.getAttribute('data-slot-index') || 0);
                this.applyHangarSlotChoice(kind, index, sel.value || '', sel);
            });
            sel.addEventListener('click', (e) => e.stopPropagation());
        });

        this.overlay.querySelectorAll('[data-hangar-slot-skin-set]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.setModuleSkin) return;
                const kind = btn.getAttribute('data-hangar-slot-skin-set');
                const face = btn.getAttribute('data-mod-face') || '';
                const skinId = btn.getAttribute('data-skin-id') || 'default';
                const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
                const key = shipLoadoutManager.kindToLoadoutKey(kind);
                const modId = (loadout[key] || [])[Number(btn.getAttribute('data-slot-index') || 0)];
                const slotIndex = Number(btn.getAttribute('data-slot-index') || 0);
                if (modId) {
                    shipLoadoutManager.setModuleSkin(this.hangarShipId, kind, modId, face, skinId);
                }
                if (shipLoadoutManager.setSlotSkin) {
                    shipLoadoutManager.setSlotSkin(this.hangarShipId, kind, slotIndex, skinId);
                } else if (!modId) {
                    return;
                }
                const group = btn.closest('.hs-hangar-slot-skin-options');
                if (group) {
                    group.querySelectorAll('.hs-hangar-slot-skin-option').forEach((b) => {
                        b.classList.toggle('is-active', b === btn);
                    });
                }
                this.drawHangarBay();
            });
        });

        if (!this._hangarSlotOutsideBound) {
            this._hangarSlotOutsideBound = (e) => {
                if (this._hangarSuppressNextOutsideClick) {
                    this._hangarSuppressNextOutsideClick = false;
                    return;
                }
                if (!this.isVisible || this.tab !== 'hangar' || !this._hangarOpenSlot) return;
                if (e.target && e.target.closest && e.target.closest('.hs-hangar-slot')) return;
                if (e.target && e.target.closest && e.target.closest('#hsHangarBayStage')) return;
                this._hangarOpenSlot = null;
                if (this.overlay) {
                    this.overlay.querySelectorAll('.hs-hangar-slot.is-open')
                        .forEach((el) => el.classList.remove('is-open'));
                }
            };
            document.addEventListener('click', this._hangarSlotOutsideBound);
        }

        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (stage && typeof ResizeObserver !== 'undefined') {
            if (this._hangarBayResizeObs) {
                this._hangarBayResizeObs.disconnect();
                this._hangarBayResizeObs = null;
            }
            this._hangarBayResizeObs = new ResizeObserver(() => {
                if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
            });
            this._hangarBayResizeObs.observe(stage);
        }

        // Redraw bay after layout settles (stage may start at 0 height)
        requestAnimationFrame(() => {
            this.drawHangarBay();
            requestAnimationFrame(() => this.drawHangarBay());
        });
    },

    bindHangarSlotCardDrag() {
        if (!this.overlay) return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (!stage) return;

        this.overlay.querySelectorAll('.hs-hangar-slot-card').forEach((card) => {
            const slot = card.closest('.hs-hangar-slot');
            if (!slot) return;
            const key = `${slot.getAttribute('data-slot-kind')}:${slot.getAttribute('data-slot-index')}`;
            const offset = this._hangarCardOffsets[key] || { x: 0, y: 0 };
            card.style.setProperty('--card-drag-x', `${offset.x}px`);
            card.style.setProperty('--card-drag-y', `${offset.y}px`);

            card.addEventListener('pointerdown', (event) => {
                if (event.button !== 0
                    || event.target.closest('button, select, option, input, label')) return;
                event.preventDefault();
                event.stopPropagation();
                const cardRect = card.getBoundingClientRect();
                this._hangarCardDragState = {
                    card,
                    key,
                    startX: event.clientX,
                    startY: event.clientY,
                    offsetX: offset.x,
                    offsetY: offset.y,
                    width: cardRect.width,
                    height: cardRect.height
                };
                card.setPointerCapture(event.pointerId);
                card.classList.add('is-dragging');
            });

            card.addEventListener('pointermove', (event) => {
                const drag = this._hangarCardDragState;
                if (!drag || drag.card !== card) return;
                const stageRect = stage.getBoundingClientRect();
                const baseRect = card.getBoundingClientRect();
                const nextX = drag.offsetX + event.clientX - drag.startX;
                const nextY = drag.offsetY + event.clientY - drag.startY;
                const baseLeft = baseRect.left - drag.offsetX;
                const baseTop = baseRect.top - drag.offsetY;
                const minX = stageRect.left + 8 - baseLeft;
                const maxX = stageRect.right - 8 - drag.width - baseLeft;
                const minY = stageRect.top + 8 - baseTop;
                const maxY = stageRect.bottom - 8 - drag.height - baseTop;
                const x = Math.max(minX, Math.min(maxX, nextX));
                const y = Math.max(minY, Math.min(maxY, nextY));
                card.style.setProperty('--card-drag-x', `${x}px`);
                card.style.setProperty('--card-drag-y', `${y}px`);
                this._hangarCardOffsets[drag.key] = { x, y };
            });

            const stopDrag = (event) => {
                const drag = this._hangarCardDragState;
                if (!drag || drag.card !== card) return;
                if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
                card.classList.remove('is-dragging');
                this._hangarCardDragState = null;
            };
            card.addEventListener('pointerup', stopDrag);
            card.addEventListener('pointercancel', stopDrag);
        });
    },

    /**
     * Drives the .is-hover-linked class from both ends of a connector:
     * hovering the dropdown card (a real mouseenter/leave — CSS :hover alone
     * isn't enough since the sibling <svg> path can't be reached by a plain
     * :hover selector), and hovering the on-ship component. The pin marking
     * that component stays pointer-events:none until its slot is open (so it
     * never steals a click/drag meant for the canvas underneath), so it has
     * no native :hover either — that direction is approximated by finding
     * the pin geometrically nearest the cursor on every pointer move (via
     * getBoundingClientRect, which works even while pointer-events is none).
     * Either path ends by refreshing updateHangarSlotLinks() so the SVG
     * connector's highlight follows immediately.
     */
    bindHangarSlotHoverLink() {
        if (!this.overlay) return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (!stage || stage.dataset.hoverLinkBound === '1') return;
        stage.dataset.hoverLinkBound = '1';
        const setLinked = (targetSlot) => {
            this.overlay.querySelectorAll('.hs-hangar-slot.is-hover-linked').forEach((el) => {
                if (el !== targetSlot) el.classList.remove('is-hover-linked');
            });
            if (targetSlot) targetSlot.classList.add('is-hover-linked');
            this.updateHangarSlotLinks();
        };
        const HOVER_RADIUS_PX = 22;
        stage.addEventListener('pointermove', (e) => {
            if (e.target && e.target.closest && e.target.closest('.hs-hangar-slot-card')) return;
            let closestSlot = null;
            let closestDist = HOVER_RADIUS_PX;
            this.overlay.querySelectorAll('.hs-hangar-slot-pin').forEach((pin) => {
                const rect = pin.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestSlot = pin.closest('.hs-hangar-slot');
                }
            });
            setLinked(closestSlot);
        });
        stage.addEventListener('pointerleave', () => setLinked(null));
        this.overlay.querySelectorAll('.hs-hangar-slot-card').forEach((card) => {
            if (card.dataset.hoverLinkBound === '1') return;
            card.dataset.hoverLinkBound = '1';
            const slot = card.closest('.hs-hangar-slot');
            card.addEventListener('mouseenter', () => setLinked(slot));
            card.addEventListener('mouseleave', () => setLinked(null));
        });
    },

    /**
     * The .hs-hangar-slot-pin buttons sit on top of the hangar-bay canvas
     * (pointer-events: auto, so they can be clicked to open the loadout
     * dropdown) and therefore intercept every pointerdown on a module icon
     * before the canvas's own moduleHit/drag code ever sees it — dragging a
     * module was effectively impossible. This gives each pin its own
     * pointer-drag: a plain click still opens the dropdown, but a real drag
     * moves the module, using the same ox/oy/scale/model cached by
     * drawHangarBay() so both systems agree on where the module actually is.
     */
    /**
     * A module's stored x offset is measured from its area's centre, so 0 is
     * exactly centred. Pull the drag onto it within a fixed screen-pixel
     * range, which keeps the snap feeling the same at every zoom level.
     */
    snapOffsetToCenter(offset, spanLayoutUnits, scale) {
        const tolerance = 10 / Math.max(1, scale) / Math.max(1, spanLayoutUnits);
        return Math.abs(offset) <= tolerance ? 0 : offset;
    },
});
