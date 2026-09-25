"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    drawHangarBay(deferSlotSync) {
        if (!this.overlay) return;
        const canvas = this.overlay.querySelector('#hsHangarBayCanvas');
        if (!canvas) return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cssW = Math.max(280, Math.floor((stage && stage.clientWidth) || 420));
        const cssH = Math.max(220, Math.floor((stage && stage.clientHeight) || 320));
        if (canvas.width !== cssW || canvas.height !== cssH) {
            canvas.width = cssW;
            canvas.height = cssH;
        }

        const shipId = this.hangarShipId || 'player_scrap';
        let model = this.getHangarShipModel(shipId);
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
            model = Object.assign({}, model);
            if (model.sprite) model.sprite = model.sprite;
            if (model.colors) model.colors = model.colors;
            shipLoadoutManager.applyLayoutToModel(model, shipId);
        }

        const accent = this.getHangarPreviewAccent();
        const w = canvas.width;
        const h = canvas.height;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, w, h);

        // Dock grid
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.12;
        const grid = 16;
        for (let x = 0; x <= w; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const mw = Math.max(8, model.width || 20);
        const mh = Math.max(8, model.height || 16);
        // Leave side gutters for slot cards; ship stays centered and clickable
        const padX = Math.max(150, Math.floor(w * 0.28));
        const padY = Math.max(28, Math.floor(h * 0.1));
        const baseScale = Math.max(2, Math.min(
            Math.floor((w - padX * 2) / mw),
            Math.floor((h - padY * 2) / mh),
            10
        ));
        // Scroll-wheel zoom (bindHangarWingDrag) multiplies the auto-fit
        // scale; drag-to-pan on empty canvas space offsets the centered
        // origin on top of that. Both persist per ship until reset.
        const zoom = Math.max(0.4, Math.min(4, this._hangarBayZoom || 1));
        const scale = Math.max(1, baseScale * zoom);
        const sw = mw * scale;
        const sh = mh * scale;
        const panX = this._hangarBayPanX || 0;
        const panY = this._hangarBayPanY || 0;
        const ox = Math.floor((w - sw) / 2) + panX;
        const oy = Math.floor((h - sh) / 2) + panY;
        // Cache the current ship-bbox geometry so the HTML slot-pin buttons
        // (which sit on top of the canvas and intercept its pointer events)
        // can convert their own drag deltas into the same layout-unit space
        // the canvas drag code uses, without recomputing the model/layout.
        this._hangarLastOx = ox;
        this._hangarLastOy = oy;
        this._hangarLastScale = scale;
        this._hangarLastModel = model;

        // Soft pedestal
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(ox - 10, oy + sh - 4, sw + 20, 10);
        ctx.globalAlpha = 1;

        try {
            if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader
                && graphicsManager.shipAssetLoader.renderShip) {
                graphicsManager.shipAssetLoader.renderShip(
                    ctx, model, ox, oy, scale, null, 0,
                    {
                        showThrusterGlow: true,
                        allowColorMountSprites: true
                    }
                );
            } else if (typeof shipRenderer !== 'undefined') {
                if (shipRenderer.init) shipRenderer.init();
                const tmp = document.createElement('canvas');
                tmp.width = Math.max(1, sw);
                tmp.height = Math.max(1, sh);
                shipRenderer.renderShipPreview(tmp, model, 1);
                ctx.drawImage(tmp, ox, oy, sw, sh);
            } else {
                ctx.fillStyle = accent;
                ctx.fillRect(ox, oy, sw, sh);
            }
        } catch (e) {
            ctx.fillStyle = accent;
            ctx.fillRect(ox, oy, sw, sh);
        }

        // Keep slot layer aligned to the same ship bbox used for rendering
        const layer = this.overlay.querySelector('#hsHangarSlotLayer');
        if (layer) {
            layer.style.setProperty('--bay-ship-left', ox + 'px');
            layer.style.setProperty('--bay-ship-top', oy + 'px');
            layer.style.setProperty('--bay-ship-w', sw + 'px');
            layer.style.setProperty('--bay-ship-h', sh + 'px');
        }
        // While actively zooming/panning, skip the (relatively heavy) slot
        // rebuild — the on-ship pins stay visually attached via the
        // --bay-ship-* vars above regardless, and the dropdown cards/links
        // resync once the gesture actually ends (see bindHangarWingDrag).
        if (!deferSlotSync) {
            this.updateHangarSlotPins(model);
        }
        this.syncHangarModuleScaleUi();
        this.drawHangarSegmentHover(canvas, model, ox, oy, scale);
        this.bindHangarWingDrag(canvas, model, ox, oy, scale);
    },

    syncHangarModuleScaleUi() {
        if (!this.overlay) return;
        const bar = this.overlay.querySelector('#hsHangarModuleScale');
        const slider = this.overlay.querySelector('#hsHangarModuleScaleSlider');
        const label = this.overlay.querySelector('#hsHangarModuleScaleLabel');
        if (!bar || !slider) return;
        const selected = this._hangarSelectedModule;
        if (!selected || !selected.id) {
            bar.hidden = true;
            return;
        }
        let scale = 1;
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getModuleScale) {
            scale = shipLoadoutManager.getModuleScale(
                this.hangarShipId,
                selected.kind,
                selected.id
            );
        }
        const pct = Math.round(Math.max(0.25, Math.min(6, scale)) * 100);
        bar.hidden = false;
        if (Number(slider.value) !== pct) slider.value = String(pct);
        if (label) label.textContent = pct + '%';
    },

    /**
     * Live-sync pink slot pins to the current module layout without rebuilding
     * the hangar DOM (keeps open dropdowns while dragging).
     */
    updateHangarSlotPins(model) {
        if (!this.overlay) return;
        const layer = this.overlay.querySelector('#hsHangarSlotLayer');
        if (!layer || typeof shipLoadoutManager === 'undefined'
            || !shipLoadoutManager.buildHangarSlots) return;
        const shipId = this.hangarShipId || 'player_scrap';
        let merged = model;
        if (!merged || !merged.layout) {
            merged = this.getHangarShipModel(shipId);
            if (shipLoadoutManager.applyLayoutToModel) {
                merged = Object.assign({}, merged);
                shipLoadoutManager.applyLayoutToModel(merged, shipId);
            }
        }
        const hangarSlots = shipLoadoutManager.buildHangarSlots(
            shipId,
            merged && merged.modelClass,
            merged
        );
        const slots = (hangarSlots && hangarSlots.slots) || [];
        slots.forEach((slot) => {
            const el = layer.querySelector(
                `.hs-hangar-slot[data-slot-kind="${slot.kind}"][data-slot-index="${slot.index}"]`
            );
            if (!el) return;
            const pinX = Math.round((slot.nx != null ? slot.nx : 0.5) * 1000) / 1000;
            const pinY = Math.round((slot.ny != null ? slot.ny : 0.5) * 1000) / 1000;
            el.style.setProperty('--pin-x', String(pinX));
            el.style.setProperty('--pin-y', String(pinY));
            if (slot.side === 'left' || slot.side === 'right') {
                el.setAttribute('data-slot-side', slot.side);
            }
        });
        this.updateHangarSlotLinks();
    },

    /**
     * Draws the actual connector path from each dropdown card to its on-ship
     * mount point. A single CSS line couldn't do this: the card's anchor and
     * the pin sit at different heights (nose vs. mid vs. aft mounts), so a
     * horizontal-only stub stopped short of the mount instead of visibly
     * reaching it. This reads both real DOM rects (card + pin, both already
     * positioned correctly by CSS) and draws a straight diagonal line from
     * the card's edge directly to the pin's exact center — the center of the
     * mounted component — so it's always geometrically exact regardless of
     * zoom, panel resize, or how many slots share a rail.
     */
    updateHangarSlotLinks() {
        if (!this.overlay) return;
        const layer = this.overlay.querySelector('#hsHangarSlotLayer');
        const svg = this.overlay.querySelector('#hsHangarLinkSvg');
        if (!layer || !svg) return;
        const layerRect = layer.getBoundingClientRect();
        if (!layerRect.width || !layerRect.height) return;
        const seen = new Set();
        layer.querySelectorAll('.hs-hangar-slot').forEach((slotEl) => {
            const kind = slotEl.getAttribute('data-slot-kind');
            const index = slotEl.getAttribute('data-slot-index');
            const card = slotEl.querySelector('.hs-hangar-slot-card');
            const pin = slotEl.querySelector('.hs-hangar-slot-pin');
            if (!card || !pin || !kind || index == null) return;
            const cardRect = card.getBoundingClientRect();
            const pinRect = pin.getBoundingClientRect();
            const side = slotEl.getAttribute('data-slot-side') === 'left' ? 'left' : 'right';
            const startX = (side === 'left' ? cardRect.right : cardRect.left) - layerRect.left;
            const startY = (cardRect.top + cardRect.height / 2) - layerRect.top;
            const endX = (pinRect.left + pinRect.width / 2) - layerRect.left;
            const endY = (pinRect.top + pinRect.height / 2) - layerRect.top;
            const d = `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;
            const key = kind + ':' + index;
            seen.add(key);
            let path = svg.querySelector(`path[data-slot-kind="${kind}"][data-slot-index="${index}"]`);
            if (!path) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'hs-hangar-link');
                path.setAttribute('data-slot-kind', kind);
                path.setAttribute('data-slot-index', index);
                svg.appendChild(path);
            }
            path.setAttribute('d', d);
            const active = slotEl.classList.contains('is-open') || slotEl.classList.contains('is-hover-linked');
            path.classList.toggle('is-active', active);
        });
        svg.querySelectorAll('path[data-slot-kind]').forEach((path) => {
            const key = path.getAttribute('data-slot-kind') + ':' + path.getAttribute('data-slot-index');
            if (!seen.has(key)) path.remove();
        });
    },
});
