"use strict";

// HomeStationUI members, continued from draw-hangar-connection-marker.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
    bindHangarWingDrag(canvas, model, ox, oy, scale) {
        if (!canvas || !model || !model.layout || typeof shipLoadoutManager === 'undefined'
            || !shipLoadoutManager.setWingOffset
            || !shipLoadoutManager.setModuleOffset) return;
        if (this._hangarWingDragCleanup) this._hangarWingDragCleanup();

        const core = model.layout.core || {
            x: 0,
            y: 0,
            width: model.coreWidth || model.width || 1,
            height: model.coreHeight || model.height || 1
        };
        const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
        // Pointer state shared by the hangar drag handlers below.
        const h = {
            canvas: canvas,
            model: model,
            ox: ox,
            oy: oy,
            scale: scale,
            core: core,
            loadout: loadout,
            drag: this._hangarWingDragState || null,
            lastPointerEvent: null
        };
        const down = (e) => this.onHangarDragDown(h, e);
        const move = (e) => {
            if (h.drag) {
                this.applyHangarDrag(h, e);
            } else {
                this.updateHangarDragHover(h, e);
            }
        };
        const up = (e) => this.onHangarDragUp(h, e);
        const cancel = () => this.cancelHangarDrag(h);
        const onWheel = (e) => this.onHangarBayWheel(e);
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', cancel);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.style.cursor = 'grab';
        this._hangarWingDragCleanup = () => {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', cancel);
            canvas.removeEventListener('wheel', onWheel);
            canvas.classList.remove('is-wing-dragging');
            canvas.classList.remove('is-wing-scaling');
            canvas.classList.remove('is-module-dragging');
            canvas.classList.remove('is-panning');
            this._hangarWingDragCleanup = null;
        };
    },
});
