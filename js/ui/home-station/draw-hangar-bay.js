"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Opaque pixel bounds of the ship rendered at `scale`, relative to its bbox origin. */
    measureHangarShipVisible(model, scale) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.renderShip) return null;
        try {
            const mw = Math.max(8, model.width || 20);
            const mh = Math.max(8, model.height || 16);
            const pad = Math.ceil(scale * 12);
            const c = document.createElement('canvas');
            c.width = Math.ceil(mw * scale) + pad * 2;
            c.height = Math.ceil(mh * scale) + pad * 2;
            const cctx = c.getContext('2d');
            loader.renderShip(cctx, model, pad, pad, scale, null, 0, { allowColorMountSprites: true });
            const data = cctx.getImageData(0, 0, c.width, c.height).data;
            let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
            for (let y = 0; y < c.height; y++) {
                for (let x = 0; x < c.width; x++) {
                    if (data[(y * c.width + x) * 4 + 3] > 16) {
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
                }
            }
            if (x1 < 0) return null;
            return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 1, h: y1 - y0 + 1 };
        } catch (e) {
            return null;
        }
    },

    drawHangarBay(deferSlotSync) {
        if (!this.overlay) return;
        const canvas = this.overlay.querySelector('#hsHangarBayCanvas');
        if (!canvas) return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Size the backing store to the canvas's own box (CSS 100% of the
        // stage) so the drawing — grid included — fills it edge to edge.
        const cssW = Math.max(280, Math.floor(canvas.clientWidth || (stage && stage.clientWidth) || 420));
        const cssH = Math.max(220, Math.floor(canvas.clientHeight || (stage && stage.clientHeight) || 320));
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


        const mw = Math.max(8, model.width || 20);
        const mh = Math.max(8, model.height || 16);
        // Leave side gutters for slot cards; ship stays centered and clickable
        // (smaller gutters → a bigger default zoom; the wheel still zooms out)
        const padX = Math.max(48, Math.floor(w * 0.12));
        const padY = Math.max(20, Math.floor(h * 0.06));
        // Fit the reference hull, not this layout, so moving areas never
        // rescales the ship (it grows/shrinks in place instead).
        const refW = typeof PLAYER_REF_W !== 'undefined' ? PLAYER_REF_W : 36;
        const refH = typeof PLAYER_REF_H !== 'undefined' ? PLAYER_REF_H : 28;
        const fitScale = Math.max(2, Math.min(
            Math.floor((w - padX * 2) / refW),
            Math.floor((h - padY * 2) / refH),
            10
        ));
        // The fit scale is sticky per ship and bay size: editing a part
        // grows or shrinks the bounding box, and re-fitting on every change
        // popped the whole ship to a new size.
        const fitKey = shipId + '|' + w + '|' + h;
        if (!this._hangarFit || this._hangarFit.key !== fitKey) {
            // Default view: fit and centre the ship's visible pixels (the
            // bbox has empty rows), with margin on every side and extra room
            // at the top for the slot bar. Pan/zoom start fresh.
            this._hangarFit = { key: fitKey, scale: fitScale };
            const vis = this.measureHangarShipVisible(model, fitScale);
            if (vis) {
                const padTop = Math.max(110, Math.floor(h * 0.22));
                const padBottom = Math.max(40, Math.floor(h * 0.15));
                const padSide = Math.max(80, Math.floor(w * 0.24));
                const bw = vis.w / fitScale;
                const bh = vis.h / fitScale;
                const s = Math.max(2, Math.min(
                    Math.floor((w - padSide * 2) / bw),
                    Math.floor((h - padTop - padBottom) / bh),
                    10
                ));
                this._hangarFit.scale = s;
                const ox0 = Math.floor((w - mw * s) / 2);
                const oy0 = Math.floor((h - mh * s) / 2);
                const cx = (vis.x + vis.w / 2) / fitScale * s;
                const cy = (vis.y + vis.h / 2) / fitScale * s;
                this._hangarBayZoom = 1;
                this._hangarZoomTarget = 1;
                this._hangarBayPanX = Math.round(w / 2 - (ox0 + cx));
                this._hangarBayPanY = Math.round(padTop + (h - padTop - padBottom) / 2 - (oy0 + cy));
            }
        }
        const baseScale = this._hangarFit.scale;
        // Area switched on/off: keep scale and zoom, re-centre the visible ship.
        if (this._hangarRecenter) {
            this._hangarRecenter = false;
            const vis = this.measureHangarShipVisible(model, baseScale);
            if (vis) {
                const padTop = Math.max(110, Math.floor(h * 0.22));
                const padBottom = Math.max(40, Math.floor(h * 0.15));
                const z = Math.max(0.12, Math.min(4, this._hangarBayZoom || 1));
                const s = baseScale * z;
                const cx = (vis.x + vis.w / 2) / baseScale * s;
                const cy = (vis.y + vis.h / 2) / baseScale * s;
                this._hangarBayPanX = Math.round(w / 2 - (Math.floor((w - mw * s) / 2) + cx));
                this._hangarBayPanY = Math.round(padTop + (h - padTop - padBottom) / 2 - (Math.floor((h - mh * s) / 2) + cy));
                this._hangarLastOx = null;
            }
        }
        // Scroll-wheel zoom (bindHangarWingDrag) multiplies the auto-fit
        // scale; drag-to-pan on empty canvas space offsets the centered
        // origin on top of that. Both persist per ship until reset.
        const zoom = Math.max(0.12, Math.min(4, this._hangarBayZoom || 1));
        // Zoom in whole-pixel voxel steps: the ship is voxelised at the fit
        // scale with cell size c, then magnified so each voxel becomes
        // exactly k screen pixels. Any other factor made some voxels a
        // pixel wider than others, and which ones changed every zoom tick.
        const zoomLoader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        const refCell = zoomLoader && zoomLoader.shipVoxelCellAt
            ? Math.max(1, Math.round(zoomLoader.shipVoxelCellAt(model, baseScale)))
            : 1;
        this._hangarRefCell = refCell;
        const cellPx = Math.max(1, Math.round(refCell * zoom));
        // Below one screen pixel per voxel the ship shrinks smoothly instead.
        // While the zoom eases between steps the scale is continuous (smooth);
        // it settles on whole pixels per voxel when the motion ends.
        let scale = (refCell * zoom < 1 || this._hangarZoomAnimating)
            ? Math.max(0.2, baseScale * zoom)
            : Math.max(1, baseScale * cellPx / refCell);
        this.syncHangarZoomSlider();
        const panX = this._hangarBayPanX || 0;
        const panY = this._hangarBayPanY || 0;
        let ox = Math.floor((w - mw * scale) / 2) + panX;
        let oy = Math.floor((h - mh * scale) / 2) + panY;
        // While a part is dragged, the ship's bounding box changes under
        // the pointer. Re-fitting scale and re-centring on it every frame
        // made the whole ship jump. Freeze the scale and pin the core where
        // it was when the drag began; the ship re-fits after release.
        // Pin the ship on its core frame origin (layout.core): unlike any
        // single part it never moves when parts are dragged or resized —
        // only the bounding-box normalisation around it shifts. Anchoring on
        // the bbox (re-centring) or on a part that itself moves made the
        // ship jump. Scale is frozen for the drag; on release the pinned
        // offset is folded into the pan so nothing snaps back.
        const drag = this._hangarWingDragState;
        const coreFrame = model.layout && (model.layout.anchor || model.layout.core);
        if (coreFrame && drag && !drag.pan) {
            if (!this._hangarDragFrame) {
                const prevCore = this._hangarLastModel && this._hangarLastModel.layout
                    && (this._hangarLastModel.layout.anchor || this._hangarLastModel.layout.core);
                const prevScale = this._hangarLastScale || scale;
                this._hangarDragFrame = {
                    scale: prevScale,
                    x: (this._hangarLastOx != null ? this._hangarLastOx : ox) + (prevCore ? prevCore.x : coreFrame.x) * prevScale,
                    y: (this._hangarLastOy != null ? this._hangarLastOy : oy) + (prevCore ? prevCore.y : coreFrame.y) * prevScale
                };
            }
            const frame = this._hangarDragFrame;
            scale = frame.scale;
            ox = Math.round(frame.x - coreFrame.x * scale);
            oy = Math.round(frame.y - coreFrame.y * scale);
        } else if (this._hangarDragFrame) {
            const frame = this._hangarDragFrame;
            if (coreFrame && frame.scale === scale) {
                const pinnedOx = Math.round(frame.x - coreFrame.x * scale);
                const pinnedOy = Math.round(frame.y - coreFrame.y * scale);
                this._hangarBayPanX = panX + (pinnedOx - ox);
                this._hangarBayPanY = panY + (pinnedOy - oy);
                ox = pinnedOx;
                oy = pinnedOy;
            }
            this._hangarDragFrame = null;
        } else if (coreFrame && this._hangarLastModel && this._hangarLastModel.layout
            && (this._hangarLastModel.layout.anchor || this._hangarLastModel.layout.core) && this._hangarLastScale === scale
            && this._hangarLastShipId === shipId && this._hangarLastOx != null) {
            // Any other edit (sidebar slider, style change, reset of one
            // part) also keeps the core where it was instead of re-centring.
            // Only the core's shift inside the bbox is compensated, so pan
            // and zoom gestures are left untouched.
            const prevCore = this._hangarLastModel.layout.anchor || this._hangarLastModel.layout.core;
            const dx = Math.round((prevCore.x - coreFrame.x) * scale);
            const dy = Math.round((prevCore.y - coreFrame.y) * scale);
            if (dx || dy) {
                this._hangarBayPanX = panX + dx;
                this._hangarBayPanY = panY + dy;
                ox += dx;
                oy += dy;
            }
        }
        this._hangarLastShipId = shipId;
        const sw = mw * scale;
        const sh = mh * scale;

        // Dock grid: a whole number of ship voxels per cell (~16px at zoom 1),
        // anchored on the bay centre: it zooms with the ship but stays put
        // while the ship is panned or dragged.
        const gridVoxels = Math.max(1, Math.round(16 / refCell));
        const grid = Math.max(4, cellPx * gridVoxels);
        // Lines as filled rects, 2 *displayed* px thick: when the canvas is
        // shown scaled down (UI scale), 1–2 backing px lines dropped out and
        // looked dotted.
        const shown = canvas.getBoundingClientRect();
        const ratio = shown.width > 0 ? w / shown.width : 1;
        const lw = Math.max(3, Math.ceil(3 * ratio));
        ctx.fillStyle = accent;
        // Zooming out packs the fixed-width lines tighter: fade them with the
        // grid spacing (relative to zoom 1) so the bay doesn't turn solid.
        const gridAtFit = Math.max(4, refCell * gridVoxels);
        const density = Math.max(0.12, Math.min(1, grid / gridAtFit));
        ctx.globalAlpha = 0.12 * density * density;
        const gx = Math.round(w / 2);
        const gy = Math.round(h / 2);
        for (let x = ((gx % grid) + grid) % grid; x <= w; x += grid) {
            ctx.fillRect(Math.round(x), 0, lw, h);
        }
        for (let y = ((gy % grid) + grid) % grid; y <= h; y += grid) {
            ctx.fillRect(0, Math.round(y), w, lw);
        }
        ctx.globalAlpha = 1;
        // Cache the current ship-bbox geometry so the HTML slot-pin buttons
        // (which sit on top of the canvas and intercept its pointer events)
        // can convert their own drag deltas into the same layout-unit space
        // the canvas drag code uses, without recomputing the model/layout.
        this._hangarLastOx = ox;
        this._hangarLastOy = oy;
        this._hangarLastScale = scale;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
            // Scoped to this hangar model object only — in-game ships and
            // other previews keep computing their own voxel size.
            graphicsManager.shipAssetLoader._voxelRef = { model, scale: baseScale };
        }
        this._hangarLastModel = model;

        try {
            if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader
                && graphicsManager.shipAssetLoader.renderShip) {
                // Voxelise once at the integer fit scale, then magnify the
                // finished image with nearest-neighbour. Rendering straight
                // at a fractional zoom scale re-rounded every voxel size and
                // part origin per zoom step, so parts re-resolved and slid
                // against each other while zooming.
                const loader = graphicsManager.shipAssetLoader;
                const refScale = baseScale;
                const mag = scale / refScale;
                const renderOpts = { showThrusterGlow: true, allowColorMountSprites: true };
                if (Math.abs(mag - 1) < 0.001) {
                    loader.renderShip(ctx, model, ox, oy, scale, null, 0, renderOpts);
                } else {
                    // Pad and buffer size are whole voxels, so after the
                    // k/c magnification every voxel edge lands on a pixel.
                    const pad = refCell * Math.ceil(refScale * 12 / refCell);
                    if (!this._hangarShipBuffer) this._hangarShipBuffer = document.createElement('canvas');
                    const buf = this._hangarShipBuffer;
                    buf.width = refCell * Math.ceil((Math.ceil(mw * refScale) + pad * 2) / refCell);
                    buf.height = refCell * Math.ceil((Math.ceil(mh * refScale) + pad * 2) / refCell);
                    const bctx = buf.getContext('2d');
                    bctx.clearRect(0, 0, buf.width, buf.height);
                    bctx.imageSmoothingEnabled = false;
                    loader.renderShip(bctx, model, pad, pad, refScale, null, 0, renderOpts);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(buf, Math.round(ox - pad * mag), Math.round(oy - pad * mag),
                        Math.round(buf.width * mag), Math.round(buf.height * mag));
                }
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
        this.drawHangarModuleIcons(canvas, model, ox, oy, scale);
        this.drawHangarSegmentHover(canvas, model, ox, oy, scale);
        this.drawHangarModuleHover(canvas, model, ox, oy, scale);
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
        const layout = merged && merged.layout;
        const shipW = parseFloat(layer.style.getPropertyValue('--bay-ship-w')) || 0;
        const pxPerUnit = layout && layout.width ? shipW / layout.width : 0;
        const modsLeft = ((layout && layout.modules) || []).slice();
        slots.forEach((slot) => {
            const el = layer.querySelector(
                `.hs-hangar-slot[data-slot-kind="${slot.kind}"][data-slot-index="${slot.index}"]`
            );
            if (!el) return;
            const pinX = Math.round((slot.nx != null ? slot.nx : 0.5) * 1000) / 1000;
            const pinY = Math.round((slot.ny != null ? slot.ny : 0.5) * 1000) / 1000;
            el.style.setProperty('--pin-x', String(pinX));
            if (shipLoadoutManager.getSlotSizeLevel && shipLoadoutManager.slotSizeLabel) {
                el.setAttribute('data-slot-size', shipLoadoutManager.slotSizeLabel(
                    shipLoadoutManager.getSlotSizeLevel(shipId, slot.kind, slot.index)));
            }
            el.style.setProperty('--pin-y', String(pinY));
            // Wing slots are a mirrored pair: add / drop the second marker
            // live, so a slot dragged onto a wing splits right away (and
            // merges back when dragged off it) instead of after a rebuild.
            let mirrorPin = el.querySelector('.hs-hangar-slot-pin.is-mirror');
            if (slot.mirrorNx != null) {
                el.style.setProperty('--pin-mx', String(Math.round(slot.mirrorNx * 1000) / 1000));
                el.style.setProperty('--pin-my', String(Math.round(slot.mirrorNy * 1000) / 1000));
                if (!mirrorPin) {
                    mirrorPin = document.createElement('span');
                    mirrorPin.className = 'hs-hangar-slot-pin is-mirror';
                    mirrorPin.setAttribute('aria-hidden', 'true');
                    mirrorPin.innerHTML = '<span class="hs-hangar-slot-dot"></span>';
                    const pin = el.querySelector('.hs-hangar-slot-pin:not(.is-mirror)');
                    if (pin) pin.after(mirrorPin); else el.prepend(mirrorPin);
                }
                el.classList.add('is-wing-pair');
            } else {
                if (mirrorPin) mirrorPin.remove();
                el.classList.remove('is-wing-pair');
                el.style.removeProperty('--pin-mx');
                el.style.removeProperty('--pin-my');
            }
            // A filled slot's grab frame covers the whole installed part.
            const mi = slot.id ? modsLeft.findIndex((m) => m.kind === slot.kind && m.id === slot.id) : -1;
            if (mi !== -1 && pxPerUnit) {
                const m = modsLeft.splice(mi, 1)[0];
                el.style.setProperty('--pin-w', Math.max(28, Math.round(m.width * pxPerUnit) + 6) + 'px');
                el.style.setProperty('--pin-h', Math.max(28, Math.round(m.height * pxPerUnit) + 6) + 'px');
            } else {
                el.style.removeProperty('--pin-w');
                el.style.removeProperty('--pin-h');
            }
            // Empty socket = the size a part mounted here would have in game,
            // by the area it sits in: big on the nose, half size on a wing.
            const ms = layout && layout.mountSizes;
            if (!slot.id && ms && pxPerUnit) {
                const at = slot.area
                    || this.hangarAreaAt(layout, pinX * layout.width, pinY * layout.height) || '';
                const area = at.indexOf('wing') === 0 ? 'wing'
                    : (at === 'front' || at === 'back' ? at : 'center');
                // Socket size follows the slot size: S (split pairs by default)
                // ≈ 0.7 of the centred M socket, L 1.3×.
                const sizeLv = shipLoadoutManager.getSlotSizeLevel
                    ? shipLoadoutManager.getSlotSizeLevel(shipId, slot.kind, slot.index) : 1;
                const base = (ms.front || ms.center || ms[area] || 4) * [Math.SQRT1_2, 1, 1.3][sizeLv];
                // Floor keeps sockets easy to see and grab at low zoom.
                const px = Math.max(28, Math.round(base * pxPerUnit));
                el.style.setProperty('--socket-size', px + 'px');
            } else {
                el.style.removeProperty('--socket-size');
            }
            // Ship part the pin sits on — pins show while that part is hovered.
            if (layout) {
                // Weapon spots know their part (a rotated wing's pin can sit
                // outside the wing's unrotated box).
                el.setAttribute('data-slot-area', slot.area
                    || this.hangarAreaAt(layout, pinX * layout.width, pinY * layout.height) || '');
            }
            if (slot.side === 'left' || slot.side === 'right') {
                el.setAttribute('data-slot-side', slot.side);
            }
        });
        this.updateHangarSlotLinks();
        if (this.renderHangarSlotBar) this.renderHangarSlotBar(slots);
        this.setHangarHoverArea(this._hangarHoverArea || null);
    },

    /**
     * Installed parts are drawn as hull mounts, which all look alike. In the
     * hangar each one also shows its part icon (same as the PARTS grid), so
     * you can see what sits in which slot.
     */
    drawHangarModuleIcons(canvas, model, ox, oy, scale) {
        if (!canvas || !model || !model.layout || typeof iconRenderer === 'undefined') return;
        const ctx = canvas.getContext('2d');
        const tint = (getComputedStyle(this.overlay || document.documentElement)
            .getPropertyValue('--color-second-basecolor') || '').trim() || '#ffffff';
        // Parts stacked in one spot (shield + core in the fuselage) would hide
        // each other's icon: group overlapping mounts and list their icons
        // top to bottom on the centreline of the group.
        // Only weapons are placed on the ship; other parts are switched in the sidebar.
        // Icons only show for the hovered hull part.
        const hoverArea = this._hangarHoverArea;
        if (!hoverArea) return;
        const items = (model.layout.modules || []).filter((mod) => mod.kind === 'weapon'
            && this.hangarAreaAt(model.layout, mod.x + mod.width / 2, mod.y + mod.height / 2) === hoverArea).map((mod) => {
            const w = mod.width * scale;
            const h = mod.height * scale;
            return {
                mod: mod,
                cx: ox + mod.x * scale + w / 2,
                cy: oy + mod.y * scale + h / 2,
                size: Math.max(16, Math.floor(Math.min(w, h) * 0.8 / 16) * 16)
            };
        });
        const groups = [];
        items.forEach((it) => {
            const g = groups.find((gr) => gr.some((o) =>
                Math.abs(o.cx - it.cx) < (o.size + it.size) / 2 && Math.abs(o.cy - it.cy) < (o.size + it.size) / 2));
            if (g) g.push(it);
            else groups.push([it]);
        });
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        groups.forEach((g) => {
            const n = g.length;
            const cx = g.reduce((a, it) => a + it.cx, 0) / n;
            const cy = g.reduce((a, it) => a + it.cy, 0) / n;
            const base = Math.min.apply(null, g.map((it) => it.size));
            const size = n > 1 ? Math.max(16, Math.floor(base / n / 16) * 16 || 16) : base;
            const gap = 2;
            const total = n * size + (n - 1) * gap;
            g.forEach((it, i) => {
                const x = Math.round(cx - size / 2);
                const y = Math.round(cy - total / 2 + i * (size + gap));
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
                if (it.mod.kind === 'weapon' && iconRenderer.drawWeapon) {
                    iconRenderer.drawWeapon(ctx, it.mod.id, x, y, size);
                } else {
                    iconRenderer.drawKey(ctx, this.hangarModuleIconKey(it.mod.kind, it.mod.id), x, y, size, tint);
                }
            });
        });
        ctx.restore();
    },

    /** Hover feedback for an equipped part on the ship: glowing accent frame + tint. */
    drawHangarModuleHover(canvas, model, ox, oy, scale) {
        const hov = this._hangarHoverModule;
        if (!hov || !canvas || !model || !model.layout) return;
        const mod = (model.layout.modules || []).find((m) =>
            m.kind === hov.kind && m.id === hov.id && (!hov.face || m.face === hov.face));
        if (!mod) return;
        const ctx = canvas.getContext('2d');
        const accent = (getComputedStyle(this.overlay || document.documentElement)
            .getPropertyValue('--faction-accent') || '').trim() || '#ffffff';
        // Same box the pointer hits: clamped into the part's area.
        const b = this.hangarModuleHitBox(model.layout, mod);
        const x = Math.round(ox + b.x * scale) - 1;
        const y = Math.round(oy + b.y * scale) - 1;
        const w = Math.round(b.width * scale) + 2;
        const h = Math.round(b.height * scale) + 2;
        ctx.save();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 4;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    },

    /** Smallest hull part (front/center/back/wingLeft/wingRight) containing a layout point. */
    hangarAreaAt(layout, lx, ly) {
        let best = null;
        let bestArea = Infinity;
        (layout.segments || []).forEach((seg) => {
            if (lx < seg.x || lx > seg.x + seg.width || ly < seg.y || ly > seg.y + seg.height) return;
            const area = seg.width * seg.height;
            if (area < bestArea) {
                bestArea = area;
                best = seg.id;
            }
        });
        return best;
    },

    /** Reveal the slot pins of one hull part (null hides them all again). */
    setHangarHoverArea(areaId) {
        const changed = (areaId || null) !== (this._hangarHoverArea || null);
        this._hangarHoverArea = areaId || null;
        if (!this.overlay) return;
        if (changed && !this._hangarHoverAreaSyncing) {
            // Part icons are drawn on the canvas: redraw so they follow the hover.
            this._hangarHoverAreaSyncing = true;
            try { this.drawHangarBay(true); } finally { this._hangarHoverAreaSyncing = false; }
        }
        // A slot drag reveals its target area's slots; redraws keep that.
        const reveal = this._hangarDragRevealArea;
        const revealWing = reveal && reveal.indexOf('wing') === 0;
        this.overlay.querySelectorAll('.hs-hangar-slot').forEach((el) => {
            const at = el.getAttribute('data-slot-area') || '';
            const revealed = !!reveal && (revealWing ? at.indexOf('wing') === 0 : at === reveal);
            el.classList.toggle('is-area-hover', revealed || (!!areaId && at === areaId));
        });
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
