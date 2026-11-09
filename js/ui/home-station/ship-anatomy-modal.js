"use strict";

// HomeStationUI methods: a standalone "ship anatomy" modal — the same canvas-drawn
// hull/wing/spine editing the full HANGAR tab's bay stage has (drag a wing to rotate
// it, drag a joint to scale it, toggle hull areas), opened from the STATION view
// without navigating away. It reuses the hangar bay's own ids (#hsHangarBayCanvas,
// #hsHangarBayStage, …) and drawing/drag functions (drawHangarBay, bindHangarWingDrag,
// onHangarDragDown/Up) unchanged — those already read/write the same profile +
// shipLoadoutManager state the HANGAR tab's own editor does, so a change made here
// shows up there too (and vice versa) with no separate state to keep in sync.
extendClass(HomeStationUI, {
    /** True while the hangar bay stage is live on screen — either the full HANGAR tab
     *  or this modal — so the many `this.tab === 'hangar'` redraw gates elsewhere also
     *  fire for the modal instead of silently dropping every interactive drag frame. */
    hangarBayActive() {
        return this.tab === 'hangar' || !!this._anatomyModalShipId;
    },
    /** True when the hangar ship-tree sidebar is the place to edit selections.
     *  The anatomy modal has no tree — clicks must open floating style panels. */
    hangarSidebarOpen() {
        if (this._anatomyModalShipId) return false;
        return !this._hangarLeftCollapsed;
    },
    /** On-ship slot pins for the anatomy modal (same markup as the hangar bay
     *  layer, without needing the hangar tab's side rails). */
    renderAnatomyModalSlotsHtml(shipId) {
        if (!shipId || typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.buildHangarSlots) return '';
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId) : null;
        const modelClass = this.shipModelClass
            ? this.shipModelClass(shipId, typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(shipId) : null)
            : null;
        const hangarSlots = shipLoadoutManager.buildHangarSlots(shipId, modelClass, merged);
        const loadout = shipLoadoutManager.getLoadout(shipId) || {};
        const inventory = shipLoadoutManager.getInventory
            ? shipLoadoutManager.getInventory(shipId) : loadout;
        const equippedByKind = { weapon: {}, defense: {}, ability: {}, energy: {} };
        (loadout.weapons || []).forEach((id) => { equippedByKind.weapon[id] = true; });
        (loadout.defenses || []).forEach((id) => { equippedByKind.defense[id] = true; });
        (loadout.abilities || []).forEach((id) => { equippedByKind.ability[id] = true; });
        (loadout.energy || []).forEach((id) => { equippedByKind.energy[id] = true; });
        if (!this.renderHangarSlotDropdown) return '';
        return (hangarSlots.slots || []).map((slot) =>
            this.renderHangarSlotDropdown(slot, inventory, equippedByKind)).join('');
    },

    renderShipAnatomyModalHtml(shipId) {
        return `<div class="hs-anatomy-modal-overlay" data-anatomy-modal role="dialog" aria-modal="true" aria-label="Ship anatomy">` +
            `<div class="hs-anatomy-modal">` +
            `<div class="hs-anatomy-modal-head">` +
            `<span class="hs-anatomy-modal-title">${this.shipName(shipId)} · ANATOMY</span>` +
            `<button type="button" class="hs-anatomy-modal-close" data-anatomy-modal-close aria-label="Close">✕</button>` +
            `</div>` +
            `<div class="hs-hangar-bay-stage is-anatomy-modal" id="hsHangarBayStage">` +
            `<canvas id="hsHangarBayCanvas" class="hs-hangar-bay-canvas" width="420" height="320" aria-label="Ship anatomy"></canvas>` +
            `<div class="hs-bay-zoom" role="group" aria-label="Zoom">` +
            `<input type="range" id="hsBayZoomSlider" class="hs-bay-zoom-slider" min="0" max="100" step="1" value="63" aria-label="Zoom" title="Zoom (mouse wheel works too)">` +
            `<output id="hsBayZoomOut" class="hs-bay-zoom-out">100%</output>` +
            `<button type="button" class="hs-bay-zoom-btn is-fit" data-bay-zoom="fit" title="Fit ship" aria-label="Fit ship">FIT</button>` +
            `</div>` +
            `<div class="hs-hangar-slot-layer" id="hsHangarSlotLayer">` +
            `<svg class="hs-hangar-link-svg" id="hsHangarLinkSvg" aria-hidden="true"></svg>` +
            this.renderAnatomyModalSlotsHtml(shipId) +
            `</div>` +
            `</div>` +
            `</div></div>`;
    },

    /**
     * Open ship anatomy as a modal inside the station screen (.home-station-content):
     * dimmed overlay + dialog over the tab body, not over the browser/bezel.
     */
    openShipAnatomyModal(shipId) {
        if (!shipId || !this.overlay) return;
        // Drop a previous modal without a station refresh (we're mounting a new one).
        const prev = this.overlay.querySelector('[data-anatomy-modal]');
        if (prev) prev.remove();
        if (this._anatomyModalKeyHandler) {
            document.removeEventListener('keydown', this._anatomyModalKeyHandler);
            this._anatomyModalKeyHandler = null;
        }
        this.hangarShipId = shipId;
        this._anatomyModalShipId = shipId;
        this._hangarFit = null;
        this._hangarBayZoom = 1;
        this._hangarZoomTarget = 1;
        const root = this.overlay.querySelector('.vf-browser-shell .home-station-content')
            || this.overlay.querySelector('.home-station-content');
        if (!root) {
            this._anatomyModalShipId = null;
            return;
        }
        root.insertAdjacentHTML('beforeend', this.renderShipAnatomyModalHtml(shipId));
        this.bindShipAnatomyModalEvents();
        // Pins + bay ResizeObserver (same path the HANGAR tab uses).
        if (this.bindHangarSlotEvents) this.bindHangarSlotEvents();
        // Two frames: first lets the modal layout size the stage, second fits
        // the ship (a single frame often measured a 0×0 canvas and left wings tiny).
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this._anatomyModalShipId !== shipId) return;
                this._hangarFit = null;
                if (this.hangarBayZoomStep) this.hangarBayZoomStep('fit');
                else if (this.drawHangarBay) this.drawHangarBay();
            });
        });
    },

    closeShipAnatomyModal(opts) {
        if (!this.overlay) return;
        const had = !!this._anatomyModalShipId
            || !!this.overlay.querySelector('[data-anatomy-modal]');
        const modal = this.overlay.querySelector('[data-anatomy-modal]');
        if (modal) modal.remove();
        this._anatomyModalShipId = null;
        if (this._anatomyModalKeyHandler) {
            document.removeEventListener('keydown', this._anatomyModalKeyHandler);
            this._anatomyModalKeyHandler = null;
        }
        // Modal owned the bay ResizeObserver — drop it unless the hangar tab is live.
        if (this.tab !== 'hangar' && this._hangarBayResizeObs) {
            this._hangarBayResizeObs.disconnect();
            this._hangarBayResizeObs = null;
        }
        // The station ship row's own thumb/stats may have changed (e.g. an area
        // toggled off changes stats) — refresh it now that the modal is gone.
        if (had && this.tab === 'station' && !(opts && opts.skipRefresh)) this.createUI();
    },

    bindShipAnatomyModalEvents() {
        const modal = this.overlay && this.overlay.querySelector('[data-anatomy-modal]');
        if (!modal) return;
        const closeBtn = modal.querySelector('[data-anatomy-modal-close]');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeShipAnatomyModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeShipAnatomyModal();
        });
        const fitBtn = modal.querySelector('[data-bay-zoom="fit"]');
        if (fitBtn) fitBtn.addEventListener('click', () => this.hangarBayZoomStep('fit'));
        const slider = modal.querySelector('#hsBayZoomSlider');
        if (slider) slider.addEventListener('input', () => this.hangarBayZoomStep('set', slider.value));
        this._anatomyModalKeyHandler = (e) => {
            if (e.key === 'Escape') this.closeShipAnatomyModal();
        };
        document.addEventListener('keydown', this._anatomyModalKeyHandler);
        // Slot pins must be draggable here too — the hangar tab binds these on
        // its own mount, but the anatomy modal is a separate stage.
        if (this.bindHangarSlotPinDrag) this.bindHangarSlotPinDrag();
        if (this.ensureHangarMirrorPinGrab) this.ensureHangarMirrorPinGrab();
        if (this.bindHangarSlotHoverLink) this.bindHangarSlotHoverLink();
    },
});
