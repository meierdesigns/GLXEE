"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    resetHangarPreviewSim() {
        const canvas = this._hangarPreviewCanvas;
        if (!canvas) return;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const size = this.hangarCloseupSize(model, canvas.width, canvas.height);
        this._hangarPreviewShipId = shipId;
        this._hangarPreviewSim = {
            player: {
                x: (canvas.width - size.width) / 2,
                y: canvas.height * 0.42,
                width: size.width,
                height: size.height,
                dir: 1
            },
            bullets: [],
            thrust: [],
            phase: 0,
            shootAcc: 0,
            burstLeft: 0,
            burstGap: 0,
            nextBurst: 900,
            mode: 'fly',
            modeTimer: 1800
        };
        this._hangarPreviewLastTs = 0;
    },

    destroyHangarPanelResize() {
        if (this._hangarPanelResize) {
            this._hangarPanelResize.destroy();
            this._hangarPanelResize = null;
        }
    },

    setupHangarPanelResize() {
        this.destroyHangarPanelResize();
        if (!this.overlay || typeof setupPanelResize !== 'function') return;
        const body = this.overlay.querySelector('.hs-hangar-split');
        if (!body) return;
        this._hangarPanelResize = setupPanelResize({
            body,
            root: body,
            storageKey: 'hsHangarPanelWidths',
            leftVar: '--hs-hangar-left-w',
            rightVar: '--hs-hangar-right-w',
            defaults: { left: 160, right: 220 },
            mins: { left: 110, right: 160, center: 240 }
        });
    },

    toggleHangarSidebar(side) {
        if (side === 'left') {
            this._hangarLeftCollapsed = !this._hangarLeftCollapsed;
        } else if (side === 'right') {
            this._hangarRightCollapsed = !this._hangarRightCollapsed;
        }
        try {
            localStorage.setItem('vf_hs_hangar_sidebar_prefs_v1', JSON.stringify({
                left: this._hangarLeftCollapsed,
                right: this._hangarRightCollapsed
            }));
        } catch (e) { /* ignore */ }
        this.createUI();
    },

    toggleHangarAreaGuides() {
        this._hangarShowGuides = !this._hangarShowGuides;
        this._hangarSegmentHover = null;
        this._hangarSelectedModule = null;
        this.drawHangarBay();
        const button = this.overlay && this.overlay.querySelector('#hsToggleAreaGuides');
        if (button) button.textContent = this._hangarShowGuides ? 'HIDE AREAS' : 'SHOW AREAS';
    },

    recalculateHangarAreas() {
        this._hangarSegmentHover = null;
        this._hangarSelectedModule = null;
        this._hangarWingDragState = null;
        this.drawHangarBay();
        this.updateHangarSlotPins(this._hangarLastModel);
    },

    resetHangarAnatomy() {
        const shipId = this.hangarShipId || 'player_scrap';
        if (typeof shipLoadoutManager !== 'undefined') {
            const loadout = shipLoadoutManager.getLoadout(shipId);
            loadout.wingOffsetX = 0;
            loadout.wingOffsetY = 0;
            loadout.wingConnectionY = 0;
            loadout.wingConnectionWidth = 0.1;
            loadout.wingRotation = 0;
            loadout.voxelScale = 1;
            loadout.wingConnectionVoxelScale = 0;
            loadout.wingConnectionStyle = 'strut';
            loadout.spineConnectionStyle = 'strut';
            loadout.spineConnectionWidth = 0.18;
            loadout.spineConnectionX = 0;
            loadout.wingConnectionWidthEnd = 0;
            loadout.wingJointSides = null;
            loadout.spineConnectionWidthEnd = 0;
            loadout.hideWingConnection = false;
            loadout.hideSpineFront = false;
            loadout.hideSpineBack = false;
            loadout.segmentScale = {};
            loadout.segmentOffset = {};
            loadout.moduleOffset = {};
            loadout.moduleOffsets = {};
            shipLoadoutManager.setLoadout(shipId, loadout);
        }
        if (typeof shipConfigManager !== 'undefined') {
            shipConfigManager.setConfig(shipId, { segmentUv: null });
        }
        if (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) {
            const profile = profileManager.getActiveProfile();
            if (profile) {
                if (profile.segmentShapeVariants) delete profile.segmentShapeVariants[shipId];
                if (profile.wingStyleSymmetry) delete profile.wingStyleSymmetry[shipId];
                if (profileManager.save) profileManager.save();
            }
        }
        this._hangarSegmentHover = null;
        this._hangarSelectedModule = null;
        // Reset also re-fits and re-centres the ship in the bay.
        this._hangarFit = null;
        this._hangarBayPanX = 0;
        this._hangarBayPanY = 0;
        this.createUI();
    },

    startHangarPreview() {
        this.stopHangarPreview();
        if (!this.overlay) return;
        const canvas = this.overlay.querySelector('#hsHangarPreview');
        if (!canvas) return;
        this._hangarPreviewCanvas = canvas;
        this._hangarPreviewCtx = canvas.getContext('2d');
        this.resetHangarPreviewSim();
        this.bindHangarPreviewZoom();
        const loop = (ts) => {
            if (!this.isVisible || this.tab !== 'hangar') return;
            if (!this._hangarPreviewLastTs) this._hangarPreviewLastTs = ts;
            const dt = Math.min(50, ts - this._hangarPreviewLastTs);
            this._hangarPreviewLastTs = ts;
            this.updateHangarPreviewSim(dt);
            this.drawHangarPreview();
            this._hangarPreviewAnimId = requestAnimationFrame(loop);
        };
        this._hangarPreviewAnimId = requestAnimationFrame(loop);
    },

    stopHangarPreview() {
        if (this._hangarPreviewWheelBound) {
            const viewport = this.overlay && this.overlay.querySelector('#hsHangarPreviewViewport');
            if (viewport) viewport.removeEventListener('wheel', this._hangarPreviewWheelBound);
            this._hangarPreviewWheelBound = null;
        }
        if (this._hangarPreviewAnimId) {
            cancelAnimationFrame(this._hangarPreviewAnimId);
            this._hangarPreviewAnimId = null;
        }
        this._hangarPreviewLastTs = 0;
        this._hangarPreviewSim = null;
        this._hangarPreviewCanvas = null;
        this._hangarPreviewCtx = null;
        this._hangarPreviewShipId = null;
    },

    _bindHangarEvents() {
        // Bind events for the new HangarUI module
        if (!this.hangarUI || !this.overlay) return;

        // Slot selection
        this.overlay.addEventListener('click', (e) => {
            const slotItem = e.target.closest('.hs-slot-item');
            if (slotItem) {
                const idx = parseInt(slotItem.dataset.slotIdx);
                this.hangarUI.onSlotSelected(idx);
            }
        });

        // Collapse/Expand sidebars
        this.overlay.addEventListener('click', (e) => {
            const collapseBtn = e.target.closest('.hs-hangar-collapse-btn');
            if (collapseBtn) {
                const side = collapseBtn.dataset.side;
                if (side === 'left') {
                    this.hangarUI.leftCollapsed = !this.hangarUI.leftCollapsed;
                } else if (side === 'right') {
                    this.hangarUI.rightCollapsed = !this.hangarUI.rightCollapsed;
                }
                this.hangarUI.savePrefs();
                this.createUI();
            }
        });

        // Equipment selection
        this.overlay.addEventListener('change', (e) => {
            const select = e.target.closest('.hs-hangar-slot-select');
            if (select) {
                const idx = parseInt(select.dataset.slotIdx);
                const newId = select.value;
                this.hangarUI.onSlotEquipmentChange(idx, newId);
            }
        });
    },
});
