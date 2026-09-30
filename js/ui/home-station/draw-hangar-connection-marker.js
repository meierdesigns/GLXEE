"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /**
     * Focus marker for a hull-to-wing connection: the bridge band itself,
     * since it is too thin to read as "selected" from a bounding box.
     */
    drawHangarConnectionMarker(ctx, model, ox, oy, scale, wingId, accent, hovered) {
        const path = this.hangarConnectionPaths(model, scale)
            .find((item) => item.id === wingId);
        if (!path) return;
        const band = this.hangarJointBand(model, scale, wingId);
        const k = band ? this.hangarJointCorners(band) : null;
        const pt = (p) => [ox + p[0] * scale, oy + p[1] * scale];
        ctx.save();
        ctx.globalAlpha = hovered ? 0.3 : 0.2;
        ctx.fillStyle = accent;
        ctx.beginPath();
        if (k) {
            [k.s0, k.e0, k.e1, k.s1].forEach((p, i) => {
                const [x, y] = pt(p);
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            });
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        // Pixel dashes in the accent's shade; solid accent when hovered.
        ctx.strokeStyle = hovered ? accent : this.hangarHandleColors(accent).lineSoft;
        if (hovered) ctx.setLineDash([]); else this.hangarMarchingDash(ctx);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = accent;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        const wingText = hovered ? 'WING CONNECTION · CLICK TO SELECT · DRAG CORNERS/SIDES TO SCALE' : 'WING CONNECTION';
        ctx.textAlign = 'center';
        ctx.fillText(wingText, ctx.canvas.width / 2, 16);
        ctx.restore();
    },

    /** Focus marker for a nose→body / body→aft joint, drawn on its gap band. */
    drawHangarSpineMarker(ctx, model, ox, oy, scale, spineId, accent, hovered) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.spineJointPaths) return;
        const path = loader.spineJointPaths(model.layout, scale).find((item) => item.id === spineId);
        if (!path) return;
        const gap = path.y1 - path.y0;
        // Parts touching: mark the seam itself so the selection still shows.
        const y0 = oy + (gap > 0 ? path.y0 : path.y0 - 1) * scale;
        const y1 = oy + (gap > 0 ? path.y1 : path.y0 + 1) * scale;
        const t0 = gap > 0 ? 0 : 0.5;
        const x0 = ox + (path.x0 + (path.x1 - path.x0) * t0) * scale;
        const x1 = ox + path.x1 * scale;
        const half0 = Math.max(4, path.half0 * scale);
        const half1 = Math.max(4, path.half1 * scale);
        ctx.save();
        ctx.globalAlpha = hovered ? 0.3 : 0.2;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(x0 - half0, y0);
        ctx.lineTo(x0 + half0, y0);
        ctx.lineTo(x1 + half1, y1);
        ctx.lineTo(x1 - half1, y1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        // Pixel dashes in the accent's shade; solid accent when hovered.
        ctx.strokeStyle = hovered ? accent : this.hangarHandleColors(accent).lineSoft;
        ctx.setLineDash(hovered ? [] : [4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = accent;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        // Hint sits on the bay's top edge: beside the joint it covered the
        // ship or ran off the canvas on narrow bays.
        const text = hovered ? 'HULL CONNECTION · CLICK TO SELECT · DRAG CORNERS/SIDES TO SCALE' : 'HULL CONNECTION';
        ctx.textAlign = 'center';
        ctx.fillText(text, ctx.canvas.width / 2, 16);
        ctx.restore();
    },

    /**
     * Resize handles on the selected joint: squares on the four corners
     * (one end each) and bars mid-way along both long sides (both ends).
     * The hovered handle is filled white.
     */
    /**
     * Theme colours for canvas handles, derived from the faction accent
     * (canvas can't use color-mix): resting = dark accent-tinted fill with
     * an accent rim, hot = solid accent with a light accent rim.
     */
    hangarHandleColors(accent) {
        // Any CSS colour → #rrggbb via a canvas context.
        if (!this._handleColorCtx) this._handleColorCtx = document.createElement('canvas').getContext('2d');
        const cc = this._handleColorCtx;
        cc.fillStyle = '#ff7a45';
        cc.fillStyle = String(accent || '').trim() || '#ff7a45';
        const m = /^#([0-9a-f]{6})$/i.exec(cc.fillStyle);
        const n = m ? parseInt(m[1], 16) : 0xff7a45;
        const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        const mix = (t, k) => '#' + rgb.map((c) => Math.round(c + (t - c) * k)
            .toString(16).padStart(2, '0')).join('');
        return {
            fill: mix(8, 0.78),      // dark, slightly tinted
            stroke: accent,
            hotFill: accent,
            hotStroke: mix(255, 0.55), // light accent, not white
            line: accent,
            lineSoft: mix(8, 0.35)
        };
    },

    /**
     * Stepped animation clock (~8 fps, pixel-art feel) for handles and
     * boundary lines. Each call keeps one redraw queued, so the loop runs
     * only while something animated is drawn and stops on its own.
     */
    hangarAnimStep() {
        const step = Math.floor(performance.now() / 125);
        if (!this._hangarAnimTimer) {
            this._hangarAnimTimer = setTimeout(() => {
                this._hangarAnimTimer = 0;
                if (this.isVisible && this.tab === 'hangar' && !this._hangarLiveDrawRaf) this.drawHangarBay();
            }, 125);
        }
        return step;
    },

    /** Marching-ants dashes: chunky pixel dashes that crawl along the line. */
    hangarMarchingDash(ctx) {
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -(this.hangarAnimStep() % 8);
        ctx.lineCap = 'butt';
    },

    /**
     * Chunky pixel handle: dark tinted block, accent rim, bevel (light
     * top-left, dark bottom-right). Hot handles fill with the accent and
     * pulse one pixel on alternate animation steps.
     */
    drawHangarPixelHandle(ctx, cx, cy, w, h, hot, accent) {
        const c = this.hangarHandleColors(accent);
        const grow = hot && (this.hangarAnimStep() % 2) ? 2 : 0;
        const W = Math.round(w + grow);
        const H = Math.round(h + grow);
        const x = Math.round(cx - W / 2);
        const y = Math.round(cy - H / 2);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Dark outline block (1px pixel frame around everything).
        ctx.fillStyle = c.fill;
        ctx.fillRect(x - 2, y - 2, W + 4, H + 4);
        ctx.fillStyle = hot ? c.hotStroke : c.stroke;
        ctx.fillRect(x, y, W, H);
        ctx.fillStyle = hot ? c.hotFill : c.fill;
        ctx.fillRect(x + 2, y + 2, W - 4, H - 4);
        // Bevel pixels.
        ctx.fillStyle = c.hotStroke;
        ctx.fillRect(x + 2, y + 2, Math.max(1, W - 6), 2);
        ctx.fillRect(x + 2, y + 2, 2, Math.max(1, H - 6));
        ctx.restore();
    },

    drawHangarJointHandles(ctx, model, ox, oy, scale, accent, hoverHandle) {
        const band = this.hangarSelectedJointBand(model, scale);
        if (!band) return;
        const k = this.hangarJointCorners(band);
        const px = (p) => [ox + p[0] * scale, oy + p[1] * scale];
        const handle = (key, p, w, hgt) => {
            const [x, y] = px(p);
            this.drawHangarPixelHandle(ctx, x, y, w, hgt, hoverHandle === key, accent);
        };
        ctx.save();
        handle('start-1', k.s0, 12, 12);
        handle('start1', k.s1, 12, 12);
        handle('end-1', k.e0, 12, 12);
        handle('end1', k.e1, 12, 12);
        const a = this.hangarJointAxes(band);
        const flat = Math.abs(a.ux) > Math.abs(a.uy);
        handle('both-1', k.side0, flat ? 18 : 8, flat ? 8 : 18);
        handle('both1', k.side1, flat ? 18 : 8, flat ? 8 : 18);
        // Wing joints: a grip in the middle of each end slides that end up /
        // down (hull end: wingConnectionY, wing end: wingConnectionYEnd).
        if (band.kind === 'wing') {
            handle('start0', [band.x0, band.y0], 10, 14);
            handle('end0', [band.x1, band.y1], 10, 14);
        }
        ctx.restore();
    },

    drawHangarSegmentHover(canvas, model, ox, oy, scale) {
        if (!this._hangarShowGuides) return;
        const hoverState = this._hangarSegmentHover;
        const selectedModule = this._hangarSelectedModule;
        // Selections only mark while their panel is actually open; a UI
        // rebuild drops the panel and must not leave a stale highlight.
        // The open sidebar tree counts as the panel for the selection.
        const panelOpen = !!(this.overlay && this.overlay.querySelector('.hs-floating-area-style'))
            || !this._hangarLeftCollapsed;
        const selectedConnection = panelOpen ? this._hangarSelectedConnection : null;
        const selectedArea = panelOpen ? this._hangarSelectedArea : null;
        if (!canvas || !model || (!hoverState && !selectedModule && !selectedConnection && !selectedArea
            && !this.hangarRotatableWings().length)) return;
        // With nothing hovered, the part whose panel is open stays marked.
        const hover = hoverState || (selectedArea
            ? {
                segment: selectedArea === 'wingLeft' || selectedArea === 'wingRight' ? 'wing' : selectedArea,
                edge: null,
                selectedOnly: true
            }
            : { segment: null, edge: null });
        const ctx = canvas.getContext('2d');
        if (!ctx || !model.layout) return;
        const accent = this.getHangarPreviewAccent();
        // Hovering the bridge focuses the connection, not the wings it joins.
        const spineFocus = hover.spine
            || (selectedConnection && selectedConnection.indexOf('spine') === 0 ? selectedConnection : null);
        if (spineFocus) {
            this.drawHangarSpineMarker(ctx, model, ox, oy, scale, spineFocus, accent, !!hover.spine);
        }
        const connectionFocus = hover.connector && !hover.spine
            ? (hover.side === 'left' ? 'wingLeft' : 'wingRight')
            : (selectedConnection && selectedConnection.indexOf('spine') !== 0 ? selectedConnection : null);
        if (connectionFocus) {
            this.drawHangarConnectionMarker(
                ctx, model, ox, oy, scale, connectionFocus, accent, !!hover.connector
            );
        }
        this.hangarRotatableWings().forEach((wingId) => {
            const knob = this.hangarWingRotateHandle(wingId, model, scale);
            if (!knob) return;
            const kx = ox + knob.x * scale;
            const ky = oy + knob.y * scale;
            const hot = hover.handle === 'rotate' && (hover.side === 'left') === (wingId === 'wingLeft');
            ctx.save();
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            // Animated only while hovered, so an idle hangar doesn't redraw.
            if (hot) this.hangarMarchingDash(ctx); else ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(Math.round(ox + knob.tipX * scale), Math.round(oy + knob.tipY * scale));
            ctx.lineTo(Math.round(kx), Math.round(ky));
            ctx.stroke();
            ctx.setLineDash([]);
            // Big pixel octagon knob (square with stepped, notched corners).
            const c = this.hangarHandleColors(accent);
            const R = 14 + (hot && (this.hangarAnimStep() % 2) ? 2 : 0);
            const bx = Math.round(kx);
            const by = Math.round(ky);
            const oct = (r, color) => {
                const n = Math.max(2, Math.round(r * 0.4));
                ctx.fillStyle = color;
                ctx.fillRect(bx - r + n, by - r, 2 * r - 2 * n, 2 * r);
                ctx.fillRect(bx - r, by - r + n, 2 * r, 2 * r - 2 * n);
                ctx.fillRect(bx - r + Math.ceil(n / 2), by - r + Math.ceil(n / 2),
                    2 * r - 2 * Math.ceil(n / 2), 2 * r - 2 * Math.ceil(n / 2));
            };
            oct(R + 3, c.fill);
            oct(R, hot ? c.hotStroke : c.stroke);
            oct(R - 3, hot ? c.hotFill : c.fill);
            // Bevel: light pixels along the upper-left inner edge.
            ctx.fillStyle = c.hotStroke;
            ctx.fillRect(bx - R + 5, by - R + 3, R, 3);
            ctx.fillRect(bx - R + 3, by - R + 5, 3, R);
            // Chunky pixel turn-arrow (3px cells), turning in 4 steps on hover.
            const g = hot ? c.fill : c.hotStroke;
            const q = hot ? this.hangarAnimStep() % 4 : 0;
            const cells = [[-2, -1], [-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [2, 1],
                [1, 1], [3, 1], [2, 2]]; // arc + arrowhead
            ctx.fillStyle = g;
            cells.forEach(([cx0, cy0]) => {
                let px1 = cx0;
                let py1 = cy0;
                for (let i = 0; i < q; i++) { const t = px1; px1 = -py1; py1 = t; }
                ctx.fillRect(bx + px1 * 3 - 1, by + py1 * 3 - 1, 3, 3);
            });
            ctx.restore();
        });
        if (selectedConnection) {
            this.drawHangarJointHandles(ctx, model, ox, oy, scale, accent, hover.handle || null);
        }
        const segments = model.layout.segments || [];
        const selected = hover.connector ? [] : segments.filter((seg) => {
            if (hover.segment === 'wing') {
                return seg.id === 'wingLeft' || seg.id === 'wingRight';
            }
            return seg.id === hover.segment;
        }).map((seg) => this.hangarSegmentFrame(seg, model, scale));
        if (!selected.length && !selectedModule) return;
        ctx.save();
        // A rotated wing's frame turns with it, around the same root pivot.
        const withRotation = (seg, draw) => {
            const rot = this.hangarSegmentRotation(seg.id, model, scale);
            if (!rot) return draw();
            ctx.save();
            const px = ox + rot.pivot.x * scale;
            const py = oy + rot.pivot.y * scale;
            ctx.translate(px, py);
            ctx.rotate(rot.angle);
            ctx.translate(-px, -py);
            draw();
            ctx.restore();
        };
        // No fill: the area is outlined only, so its slots stay readable.
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        selected.forEach((seg) => withRotation(seg, () => {
            const left = Math.round(ox + seg.x * scale);
            const top = Math.round(oy + seg.y * scale);
            const right = Math.round(ox + (seg.x + seg.width) * scale);
            const bottom = Math.round(oy + (seg.y + seg.height) * scale);
            const corner = Math.max(4, Math.min(14, (right - left) * 0.24, (bottom - top) * 0.24));
            const colors = this.hangarHandleColors(accent);
            // Full outline as soft dashes between the corner brackets, so
            // every edge reads as a grabbable scale border.
            ctx.save();
            ctx.lineWidth = 1;
            ctx.strokeStyle = colors.lineSoft;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(left + 0.5, top + 0.5, right - left - 1, bottom - top - 1);
            ctx.restore();
            // Edge under the pointer — or being dragged — lights up solid
            // along its whole length, with a grip block in its middle.
            const drag = this._hangarWingDragState;
            const activeEdge = (drag && drag.edge && (drag.segment === hover.segment
                || (hover.segment === 'wing' && drag.segment === 'wing'))) ? drag.edge : hover.edge;
            if (activeEdge) {
                const has = (k) => activeEdge.indexOf(k) !== -1;
                ctx.save();
                ctx.strokeStyle = colors.hotStroke;
                ctx.lineWidth = drag && drag.edge ? 4 : 3;
                ctx.beginPath();
                if (has('top')) { ctx.moveTo(left, top); ctx.lineTo(right, top); }
                if (has('bottom')) { ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); }
                if (has('left')) { ctx.moveTo(left, top); ctx.lineTo(left, bottom); }
                if (has('right')) { ctx.moveTo(right, top); ctx.lineTo(right, bottom); }
                ctx.stroke();
                ctx.restore();
                if (activeEdge.indexOf('-') === -1) {
                    const mx = has('left') ? left : (has('right') ? right : (left + right) / 2);
                    const my = has('top') ? top : (has('bottom') ? bottom : (top + bottom) / 2);
                    const horiz = has('top') || has('bottom');
                    this.drawHangarPixelHandle(ctx, mx, my, horiz ? 14 : 8, horiz ? 8 : 14, true, accent);
                }
            }
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(left, top + corner);
            ctx.lineTo(left, top);
            ctx.lineTo(left + corner, top);
            ctx.moveTo(right - corner, top);
            ctx.lineTo(right, top);
            ctx.lineTo(right, top + corner);
            ctx.moveTo(left, bottom - corner);
            ctx.lineTo(left, bottom);
            ctx.lineTo(left + corner, bottom);
            ctx.moveTo(right - corner, bottom);
            ctx.lineTo(right, bottom);
            ctx.lineTo(right, bottom - corner);
            ctx.stroke();
            // Corner drag zones get their own filled hover marker — distinct
            // from a plain edge hover — so the diagonal resize handle is
            // clearly discoverable, not just implied by the cursor shape.
            if (activeEdge && activeEdge.indexOf('-') !== -1) {
                const cx = activeEdge.indexOf('right') !== -1 ? right : left;
                const cy = activeEdge.indexOf('bottom') !== -1 ? bottom : top;
                const r = Math.max(3, Math.min(7, corner * 0.5));
                this.drawHangarPixelHandle(ctx, cx, cy, Math.max(10, r * 2), Math.max(10, r * 2), true, accent);
            }
        }));
        if (selectedModule && model.layout.modules) {
            const mod = model.layout.modules.find((item) =>
                item.kind === selectedModule.kind && item.id === selectedModule.id
            );
            if (mod) {
                const left = Math.round(ox + mod.x * scale);
                const top = Math.round(oy + mod.y * scale);
                const right = Math.round(ox + (mod.x + mod.width) * scale);
                const bottom = Math.round(oy + (mod.y + mod.height) * scale);
                ctx.strokeStyle = this.hangarHandleColors(accent).hotStroke;
                ctx.lineWidth = 2;
                ctx.strokeRect(left, top, Math.max(2, right - left), Math.max(2, bottom - top));
                // Centre line, shown only while the drag is actually snapped,
                // so the snap is visible rather than just felt.
                if (this._hangarSnapCenter === selectedModule.kind) {
                    const cx = Math.round((left + right) / 2);
                    ctx.strokeStyle = this.hangarHandleColors(accent).hotStroke;
                    ctx.lineWidth = 2;
                    this.hangarMarchingDash(ctx);
                    ctx.beginPath();
                    ctx.moveTo(cx, Math.round(oy));
                    ctx.lineTo(cx, Math.round(oy + (model.height || 0) * scale));
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }
        if (selected.length && !hover.selectedOnly) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = accent;
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            const axisLabel = (edge) => {
                const hasX = edge.indexOf('left') !== -1 || edge.indexOf('right') !== -1;
                const hasY = edge.indexOf('top') !== -1 || edge.indexOf('bottom') !== -1;
                if (hasX && hasY) return 'WIDTH ↔ HEIGHT ↕';
                return hasX ? 'WIDTH ↔' : 'HEIGHT ↕';
            };
            const label = hover.edge
                ? 'DRAG ' + (hover.edge.indexOf('-') !== -1 ? 'CORNER' : 'EDGE') + ' · '
                    + hover.segment.toUpperCase() + ' · ' + axisLabel(hover.edge)
                : (hover.segment === 'center'
                    ? 'DRAG CENTER · MOVE · FRONT ↕ BACK'
                    : 'DRAG CENTER · MOVE ' + hover.segment.toUpperCase());
            const first = selected[0];
            const lx = ox + first.x * scale;
            const ly = Math.max(14, oy + first.y * scale - 7);
            ctx.fillText(label, Math.max(4, lx), ly);
        }
        ctx.restore();
    },

    /** Maps a layout module (kind/id/face) back to its hangar dropdown slot
     * index, so clicking a component directly on the ship can open the same
     * dropdown card that a click on its label would. */
    findHangarSlotIndexForModule(module) {
        if (!module || typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.buildHangarSlots) return null;
        const model = this._hangarLastModel;
        const hangarSlots = shipLoadoutManager.buildHangarSlots(
            this.hangarShipId,
            model && model.modelClass,
            model
        );
        const slots = (hangarSlots && hangarSlots.slots) || [];
        const exact = slots.find((s) =>
            s.kind === module.kind && s.id === module.id && s.face === module.face);
        if (exact) return exact.index;
        const fallback = slots.find((s) => s.kind === module.kind && s.id === module.id);
        return fallback ? fallback.index : null;
    },

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
