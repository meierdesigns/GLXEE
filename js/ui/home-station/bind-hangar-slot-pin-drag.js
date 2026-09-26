"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    bindHangarSlotPinDrag() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-hangar-slot-pin').forEach((pin) => {
            if (pin.dataset.dragBound === '1') return;
            pin.dataset.dragBound = '1';
            let drag = null;
            // Right-click a filled slot to empty it.
            pin.addEventListener('contextmenu', (e) => {
                const modId = pin.getAttribute('data-mod-id') || '';
                const kind = pin.getAttribute('data-hangar-slot-toggle');
                if (!modId || !kind) return;
                e.preventDefault();
                e.stopPropagation();
                this.applyHangarSlotChoice(kind, Number(pin.getAttribute('data-slot-index') || 0), '', null);
            });
            pin.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const kind = pin.getAttribute('data-hangar-slot-toggle');
                const modId = pin.getAttribute('data-mod-id') || '';
                const modFace = pin.getAttribute('data-mod-face') || '';
                if (!kind || typeof shipLoadoutManager === 'undefined') return;
                const model = this._hangarLastModel;
                if (!model || !model.layout) return;
                if (!modId) {
                    // Empty slot — nothing to look up in layout.modules, so
                    // drag a standalone per-slot anchor instead of a module
                    // offset (see setEmptySlotAnchor / slotAnchors).
                    if (!shipLoadoutManager.setEmptySlotAnchor) return;
                    const container = pin.closest('.hs-hangar-slot');
                    const index = Number(pin.getAttribute('data-slot-index') || 0);
                    const startNx = container
                        ? parseFloat(container.style.getPropertyValue('--pin-x')) || 0.5
                        : 0.5;
                    const startNy = container
                        ? parseFloat(container.style.getPropertyValue('--pin-y')) || 0.5
                        : 0.5;
                    drag = {
                        emptySlot: true,
                        startX: e.clientX,
                        startY: e.clientY,
                        moved: false,
                        kind: kind,
                        index: index,
                        startNx: startNx,
                        startNy: startNy,
                        mw: Math.max(8, model.width || 20),
                        mh: Math.max(8, model.height || 16)
                    };
                    pin.setPointerCapture(e.pointerId);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // Occupied slots are pulled out by grabbing the part on the
                // ship itself (startHangarModuleGrab), not via this marker.
                if (modId) return;
                if (!shipLoadoutManager.setModuleOffset) return;
                // Two equipped modules can share the same id (e.g. the same
                // weapon in both weapon slots) — match by face too, or
                // dragging slot 2 would grab slot 1's module instead.
                const modules = model.layout.modules || [];
                const mod = modules.find((m) => m.kind === kind && m.id === modId && m.face === modFace)
                    || modules.find((m) => m.kind === kind && m.id === modId);
                if (!mod) return;
                const segmentId = mod.mountSegment === 'wing'
                    ? (mod.face === 'left' ? 'wingLeft' : 'wingRight')
                    : mod.mountSegment;
                const segment = (model.layout.segments || []).find((seg) => seg.id === segmentId);
                const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
                const offsetKey = shipLoadoutManager.moduleOffsetKey
                    ? shipLoadoutManager.moduleOffsetKey(modId, mod.face)
                    : modId;
                const stored = loadout.moduleOffsets
                    && loadout.moduleOffsets[kind]
                    && (loadout.moduleOffsets[kind][offsetKey] || loadout.moduleOffsets[kind][modId]);
                drag = {
                    startX: e.clientX,
                    startY: e.clientY,
                    moved: false,
                    kind: kind,
                    modId: modId,
                    modFace: mod.face,
                    startOffsetX: stored ? Number(stored.x) || 0 : 0,
                    startOffsetY: stored ? Number(stored.y) || 0 : 0,
                    segmentWidth: Math.max(1, segment ? segment.width : mod.width || 1),
                    segmentHeight: Math.max(1, segment ? segment.height : mod.height || 1)
                };
                this._hangarSelectedModule = { kind: kind, id: modId };
                pin.setPointerCapture(e.pointerId);
                e.preventDefault();
                e.stopPropagation();
            });
            pin.addEventListener('pointermove', (e) => {
                if (!drag) return;
                const canvas = this.overlay && this.overlay.querySelector('#hsHangarBayCanvas');
                const scale = this._hangarLastScale || 1;
                let sx = 1;
                let sy = 1;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    sx = canvas.width / Math.max(1, rect.width);
                    sy = canvas.height / Math.max(1, rect.height);
                }
                if (!drag.moved && (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3)) {
                    drag.moved = true;
                    pin._hsJustDragged = true;
                }
                if (drag.emptySlot) {
                    const dxCanvas = (e.clientX - drag.startX) * sx;
                    const dyCanvas = (e.clientY - drag.startY) * sy;
                    const sw = Math.max(1, drag.mw * scale);
                    const sh = Math.max(1, drag.mh * scale);
                    // Empty-slot anchors are ship-normalized, so 0.5 is the
                    // hull centreline rather than 0.
                    const nx = drag.startNx + dxCanvas / sw;
                    let snappedNx = 0.5 + this.snapOffsetToCenter(nx - 0.5, drag.mw, scale);
                    this._hangarSnapCenter = snappedNx !== nx ? drag.kind : null;
                    let ny = drag.startNy + dyCanvas / sh;
                    // Only the areas its type allows: weapons nose/wings,
                    // defense/energy core, abilities aft/core.
                    const lastModel = this._hangarLastModel;
                    if (lastModel && lastModel.layout && shipLoadoutManager.clampToSlotArea) {
                        const c = shipLoadoutManager.clampToSlotArea(drag.kind, snappedNx, ny, lastModel.layout);
                        snappedNx = c.nx;
                        ny = c.ny;
                    }
                    shipLoadoutManager.setEmptySlotAnchor(
                        this.hangarShipId,
                        drag.kind,
                        drag.index,
                        snappedNx,
                        ny
                    );
                } else {
                    const dx = (e.clientX - drag.startX) * sx / Math.max(1, scale);
                    const dy = (e.clientY - drag.startY) * sy / Math.max(1, scale);
                    const offsetX = drag.startOffsetX + dx / Math.max(1, drag.segmentWidth);
                    const snappedX = this.snapOffsetToCenter(offsetX, drag.segmentWidth, scale);
                    this._hangarSnapCenter = snappedX !== offsetX ? drag.kind : null;
                    shipLoadoutManager.setModuleOffset(
                        this.hangarShipId,
                        drag.kind,
                        drag.modId,
                        snappedX,
                        drag.startOffsetY + dy / Math.max(1, drag.segmentHeight),
                        drag.modFace
                    );
                }
                if (!this._hangarLiveDrawRaf) {
                    this._hangarLiveDrawRaf = requestAnimationFrame(() => {
                        this._hangarLiveDrawRaf = 0;
                        if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
                    });
                }
                e.preventDefault();
            });
            const end = (e) => {
                if (!drag) return;
                drag = null;
                this._hangarSnapCenter = null;
                if (pin.hasPointerCapture && pin.hasPointerCapture(e.pointerId)) {
                    pin.releasePointerCapture(e.pointerId);
                }
                this.drawHangarBay();
            };
            pin.addEventListener('pointerup', end);
            pin.addEventListener('pointercancel', end);
        });
    },

    getHangarPreviewAccent() {
        const root = getComputedStyle(document.documentElement);
        return (root.getPropertyValue('--color-primary') || root.getPropertyValue('--current-primary') || '#b44dff').trim() || '#b44dff';
    },

    hangarCloseupSize(model, canvasW, canvasH) {
        const mw = Math.max(8, model.width || 20);
        const mh = Math.max(8, model.height || 16);
        // Same pixel density as gameplay (2.25), mild close-up — not frame-filling
        const ingameScale = 2.25;
        const closeupZoom = 1.65;
        const userZoom = Math.max(0.5, Math.min(3, this._hangarPreviewZoom || 1));
        let scale = ingameScale * closeupZoom;
        const maxFit = Math.min((canvasW * 0.44) / mw, (canvasH * 0.38) / mh);
        scale = Math.min(scale, maxFit);
        scale = Math.max(ingameScale, scale);
        scale *= userZoom;
        return {
            width: Math.max(1, Math.round(mw * scale)),
            height: Math.max(1, Math.round(mh * scale))
        };
    },

    setHangarPreviewZoom(zoom, syncUi = true) {
        const next = Math.max(0.5, Math.min(3, Math.round(Number(zoom) * 100) / 100));
        if (!isFinite(next)) return;
        this._hangarPreviewZoom = next;
        if (syncUi && this.overlay) {
            const slider = this.overlay.querySelector('#hsHangarZoom');
            const label = this.overlay.querySelector('#hsHangarZoomLabel');
            const pct = Math.round(next * 100);
            if (slider && Number(slider.value) !== pct) slider.value = String(pct);
            if (label) label.textContent = `${pct}%`;
        }
        this.applyHangarPreviewZoomSize();
    },

    applyHangarPreviewZoomSize() {
        const canvas = this._hangarPreviewCanvas;
        const sim = this._hangarPreviewSim;
        if (!canvas || !sim || !sim.player) return;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const size = this.hangarCloseupSize(model, canvas.width, canvas.height);
        const cx = sim.player.x + sim.player.width / 2;
        const cy = sim.player.y + sim.player.height / 2;
        sim.player.width = size.width;
        sim.player.height = size.height;
        sim.player.x = cx - size.width / 2;
        sim.player.y = cy - size.height / 2;
    },

    bindHangarModuleScale() {
        if (!this.overlay) return;
        const bar = this.overlay.querySelector('#hsHangarModuleScale');
        const slider = this.overlay.querySelector('#hsHangarModuleScaleSlider');
        if (!slider || slider.dataset.bound === '1') return;
        slider.dataset.bound = '1';
        const apply = () => {
            const selected = this._hangarSelectedModule;
            if (!selected || !selected.id
                || typeof shipLoadoutManager === 'undefined'
                || !shipLoadoutManager.setModuleScale) return;
            const scale = Math.max(0.25, Math.min(6, Number(slider.value) / 100));
            shipLoadoutManager.setModuleScale(
                this.hangarShipId,
                selected.kind,
                selected.id,
                scale
            );
            const label = this.overlay.querySelector('#hsHangarModuleScaleLabel');
            if (label) label.textContent = Math.round(scale * 100) + '%';
            this.drawHangarBay();
        };
        slider.addEventListener('input', apply);
        slider.addEventListener('change', apply);
        ['click', 'mousedown', 'pointerdown'].forEach((ev) => {
            slider.addEventListener(ev, (e) => e.stopPropagation());
            if (bar) bar.addEventListener(ev, (e) => e.stopPropagation());
        });
        this.syncHangarModuleScaleUi();
    },

    bindHangarPreviewZoom() {
        if (!this.overlay) return;
        const slider = this.overlay.querySelector('#hsHangarZoom');
        const viewport = this.overlay.querySelector('#hsHangarPreviewViewport');
        if (slider) {
            slider.addEventListener('input', () => {
                this.setHangarPreviewZoom(Number(slider.value) / 100, false);
                const label = this.overlay.querySelector('#hsHangarZoomLabel');
                if (label) label.textContent = `${Math.round((this._hangarPreviewZoom || 1) * 100)}%`;
            });
            slider.addEventListener('click', (e) => e.stopPropagation());
            slider.addEventListener('mousedown', (e) => e.stopPropagation());
            slider.addEventListener('pointerdown', (e) => e.stopPropagation());
        }
        const zoomBar = this.overlay.querySelector('#hsHangarZoomBar');
        if (zoomBar) {
            zoomBar.addEventListener('click', (e) => e.stopPropagation());
        }
        if (viewport) {
            if (this._hangarPreviewWheelBound) {
                viewport.removeEventListener('wheel', this._hangarPreviewWheelBound);
            }
            this._hangarPreviewWheelBound = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const step = e.deltaY < 0 ? 0.1 : -0.1;
                this.setHangarPreviewZoom((this._hangarPreviewZoom || 1) + step);
            };
            viewport.addEventListener('wheel', this._hangarPreviewWheelBound, { passive: false });
        }
        this.setHangarPreviewZoom(this._hangarPreviewZoom || 1);
    },
});
