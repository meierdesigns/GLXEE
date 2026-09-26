"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** pointerup: commit the drag, or treat a still click as a selection. */
    onHangarDragUp(h, e) {
        if (!h.drag) return;
        if (h.drag.jointScale) {
            // Resizing a joint keeps it selected; no panel churn.
            h.drag = null;
            this._hangarWingDragState = null;
            if (this._hangarLiveDrawRaf) {
                cancelAnimationFrame(this._hangarLiveDrawRaf);
                this._hangarLiveDrawRaf = 0;
            }
            h.canvas.classList.remove('is-wing-scaling');
            if (h.canvas.hasPointerCapture(e.pointerId)) h.canvas.releasePointerCapture(e.pointerId);
            this.drawHangarBay();
            return;
        }
        if (h.drag.rotateHandle) {
            // Rotating keeps the wing selected; just settle the drag.
            h.drag = null;
            this._hangarWingDragState = null;
            if (this._hangarLiveDrawRaf) {
                cancelAnimationFrame(this._hangarLiveDrawRaf);
                this._hangarLiveDrawRaf = 0;
            }
            h.canvas.classList.remove('is-wing-dragging');
            if (h.canvas.hasPointerCapture(e.pointerId)) h.canvas.releasePointerCapture(e.pointerId);
            h.canvas.style.cursor = 'grab';
            this.drawHangarBay();
            return;
        }
        const wasPanning = !!h.drag.pan;
        const stillClick = Math.abs(e.clientX - h.drag.startX) < 4 && Math.abs(e.clientY - h.drag.startY) < 4;
        const movingModule = !!h.drag.module;
        const clickedModule = movingModule && !h.drag.moved ? h.drag.module : null;
        const clickedSegment = !movingModule && !wasPanning && !h.drag.moved
            ? h.drag.segment
            : null;
        const clickedConnector = !!h.drag.connector && !movingModule && !wasPanning && !h.drag.moved;
        const clickedSegmentSide = clickedSegment ? h.drag.side : null;
        const clickedSpine = clickedConnector ? h.drag.spine || null : null;
        this.applyHangarDrag(h, e);
        h.drag = null;
        this._hangarWingDragState = null;
        if (this._hangarLiveDrawRaf) {
            cancelAnimationFrame(this._hangarLiveDrawRaf);
            this._hangarLiveDrawRaf = 0;
        }
        h.canvas.classList.remove('is-wing-dragging');
        h.canvas.classList.remove('is-wing-scaling');
        h.canvas.classList.remove('is-module-dragging');
        h.canvas.classList.remove('is-panning');
        if (h.canvas.hasPointerCapture(e.pointerId)) h.canvas.releasePointerCapture(e.pointerId);
        if (wasPanning && stillClick) {
            // A still click on empty space deselects part and joint.
            this._hangarSelectedArea = null;
            this._hangarSelectedConnection = null;
            if (this.overlay) {
                this.overlay.querySelectorAll('.hs-floating-area-style').forEach((el) => el.remove());
            }
        }
        if (wasPanning) {
            // Panning ended — resync the dropdown cards/pins/links now,
            // rather than on every frame while dragging.
            h.canvas.style.cursor = 'grab';
            this.drawHangarBay();
            return;
        }
        // A plain click (no drag) on an on-ship component opens its
        // dropdown — the only place the per-module skin selector lives —
        // so a component can be reskinned by clicking it directly instead
        // of having to find the matching card by its label first.
        let moduleToSelect = null;
        let floatingArea = null;
        let floatingConnection = null;
        this._hangarSelectedConnection = null;
        this._hangarSelectedArea = null;
        let floatingSpine = null;
        if (clickedSpine) {
            floatingSpine = clickedSpine;
            this._hangarSuppressNextOutsideClick = true;
        } else if (clickedConnector) {
            floatingConnection = clickedSegmentSide === 'left' ? 'wingLeft' : 'wingRight';
            this._hangarSuppressNextOutsideClick = true;
        } else if (clickedSegment) {
            // A hull click selects that area itself. It used to route
            // through the first module mounted there, so clicking the nose
            // opened the laser instead of the nose section. Modules stay
            // reachable through their own pin.
            const area = clickedSegment === 'wing'
                ? (clickedSegmentSide === 'left' ? 'wingLeft' : 'wingRight')
                : clickedSegment;
            floatingArea = area;
            if (typeof window.componentTree !== 'undefined'
                && window.componentTree.setNodeExpanded) {
                // Symmetric wings live in one merged WINGS branch.
                const treeArea = (area === 'wingLeft' || area === 'wingRight')
                    && typeof profileManager !== 'undefined'
                    && profileManager.getWingStyleSymmetry(this.hangarShipId || 'player_scrap')
                    ? 'wings'
                    : area;
                window.componentTree.setNodeExpanded(`hs-tree-area-${treeArea}`, true);
            }
            this._hangarOpenSlot = null;
            this._hangarSuppressNextOutsideClick = true;
        } else if (clickedModule) {
            const slotIndex = this.findHangarSlotIndexForModule(clickedModule);
            if (slotIndex != null) {
                moduleToSelect = { kind: clickedModule.kind, index: slotIndex };
                this._hangarOpenSlot = { kind: clickedModule.kind, index: slotIndex };
                // createUI() below replaces the canvas with a fresh
                // element; the browser still fires a native 'click'
                // right after this pointerup, targeting the now-detached
                // old canvas. The document-level outside-click watcher
                // (bindHangarSlotEvents) can't recognize that stale,
                // parentless target as "inside" the hangar bay, so
                // without this guard it closed the slot we just opened
                // in the same gesture.
                this._hangarSuppressNextOutsideClick = true;
            }
        }
        // Keep the side dropdown open while an individual module moves.
        // Still refresh canvas + pink pins without rebuilding the hangar DOM.
        if (movingModule && !clickedModule) this.drawHangarBay();
        else this.createUI();

        // Show component details in sidebar AFTER createUI(). With the ship
        // tree open, jump to the slot's own entry there instead of swapping
        // the sidebar over to the details view.
        if (moduleToSelect) {
            // Tree shown: jump to the slot there. Otherwise nothing extra —
            // the separate component details panel is not used for slots.
            if (!this._hangarLeftCollapsed && this.focusTreeSlot(moduleToSelect.kind, moduleToSelect.index)) return;
        }
        // With the ship sidebar open, its tree already holds every setting:
        // open the matching section there instead of a second panel on top
        // of the bay.
        if (!this._hangarLeftCollapsed && (floatingSpine || floatingConnection || floatingArea)) {
            let nodeId;
            if (floatingSpine) {
                this._hangarSelectedConnection = floatingSpine;
                nodeId = 'hs-tree-conn-hull';
            } else if (floatingConnection) {
                this._hangarSelectedConnection = floatingConnection;
                nodeId = 'hs-tree-conn-wing';
            } else {
                this._hangarSelectedArea = floatingArea;
                const wing = floatingArea === 'wingLeft' || floatingArea === 'wingRight';
                const merged = wing && typeof profileManager !== 'undefined'
                    && profileManager.getWingStyleSymmetry(this.hangarShipId || 'player_scrap');
                nodeId = `hs-tree-area-${merged ? 'wings' : floatingArea}`;
            }
            this.focusTreeSection(nodeId);
            return;
        }
        if (floatingSpine) {
            this.showFloatingSpineConnectionStyle(floatingSpine === 'spineBack' ? 'back' : 'front', floatingSpine);
        } else if (floatingConnection) {
            this.showFloatingConnectionStyle(floatingConnection);
        } else if (floatingArea) {
            this.showFloatingAreaStyle(floatingArea);
        }
    },

    /**
     * Open a slot's entry in the sidebar tree: expand its area section (and
     * the entry itself), scroll it into view and flash it. Returns false if
     * the tree has no entry for that slot.
     */
    focusTreeSlot(kind, index) {
        if (!this.overlay) return false;
        const item = this.overlay.querySelector(`#hs-tree-slot-${kind}-${index}`);
        if (!item) return false;
        const branch = item.closest('.hs-tree-branch');
        if (branch && branch.id) {
            branch.parentElement.querySelectorAll(':scope > .hs-tree-branch').forEach((other) => {
                other.open = other === branch;
                if (window.componentTree && window.componentTree.setNodeExpanded) {
                    window.componentTree.setNodeExpanded(other.id, other.open);
                }
            });
        }
        item.open = true;
        if (window.componentTree && window.componentTree.setNodeExpanded) {
            window.componentTree.setNodeExpanded(item.id, true);
        }
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        item.classList.add('is-focused');
        setTimeout(() => item.classList.remove('is-focused'), 900);
        return true;
    },

    /** Expand one sidebar tree section, collapse its sibling sections, and scroll it into view. */
    focusTreeSection(nodeId) {
        if (!this.overlay) return;
        const node = this.overlay.querySelector(`#${nodeId}`);
        if (!node) return;
        node.parentElement.querySelectorAll(':scope > .hs-tree-branch').forEach((branch) => {
            branch.open = branch === node;
            if (window.componentTree && window.componentTree.setNodeExpanded) {
                window.componentTree.setNodeExpanded(branch.id, branch.open);
            }
        });
        node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        node.classList.add('is-focused');
        setTimeout(() => node.classList.remove('is-focused'), 900);
        this.drawHangarBay();
    },

    cancelHangarDrag(h) {
        h.drag = null;
        this._hangarWingDragState = null;
        h.canvas.classList.remove('is-wing-dragging');
        h.canvas.classList.remove('is-wing-scaling');
        h.canvas.classList.remove('is-module-dragging');
        h.canvas.classList.remove('is-panning');
    },

    // Scroll-wheel zoom, centered on the ship. The dropdown cards/pins
    // resync only after scrolling stops (debounced), same reasoning as
    // the pan-end resync above — repositioning that DOM every wheel tick
    // would fight the in-progress gesture instead of following it.
    onHangarBayWheel(e) {
        e.preventDefault();
        const prevZoom = Math.max(0.4, Math.min(4, this._hangarBayZoom || 1));
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        this._hangarBayZoom = Math.max(0.4, Math.min(4, prevZoom * factor));
        this.drawHangarBay(true);
        if (this._hangarZoomEndTimer) clearTimeout(this._hangarZoomEndTimer);
        this._hangarZoomEndTimer = setTimeout(() => {
            this._hangarZoomEndTimer = null;
            if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
        }, 160);
    },

    applyHangarSlotChoice(kind, slotIndex, moduleId, sourceEl) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.setSlotModule) return;
        const res = shipLoadoutManager.setSlotModule(this.hangarShipId, kind, slotIndex, moduleId);
        if (!res.ok) {
            let msg = 'SLOT UPDATE FAILED';
            if (res.reason === 'NEED_WEAPON') msg = 'NEED AT LEAST ONE WEAPON';
            if (res.reason === 'NEED_ENERGY') msg = 'NEED AN ENERGY CORE';
            if (res.reason === 'NEED_CHARGE_SHOT') msg = 'NEED CHARGE SHOT FIRST';
            if (res.reason === 'NEED_CHARGE_DRIVE') msg = 'NEED CHARGE DRIVE FIRST';
            if (res.reason === 'NO_SLOT') msg = 'NO SLOT';
            if (res.reason === 'TOO_BIG') {
                msg = 'PART NEEDS A ' + shipLoadoutManager.slotSizeLabel(res.need)
                    + ' SLOT · UPGRADE THE ' + this.areaLabel(shipLoadoutManager.getSlotArea(kind, slotIndex));
            }
            if (sourceEl) this.playButtonResult(sourceEl, false, msg);
            else {
                this.statusMsg = msg;
                this.createUI();
            }
            return;
        }
        if (typeof shipConfigManager !== 'undefined') {
            const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                ? profileManager.getActiveProfile().activeShipId
                : this.hangarShipId;
            if (active === this.hangarShipId) {
                shipConfigManager.applyToRuntime(this.hangarShipId);
            }
        }
        this._hangarOpenSlot = null;
        const label = moduleId
            ? (this.hangarModuleLabel(moduleId) + ' EQUIPPED')
            : 'SLOT CLEARED';
        if (sourceEl) this.playButtonResult(sourceEl, true, label);
        else {
            this.statusMsg = label;
            this.createUI();
        }
    },
});
