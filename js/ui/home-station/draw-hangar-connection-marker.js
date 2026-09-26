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
        ctx.setLineDash(hovered ? [] : [5, 4]);
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
        ctx.setLineDash(hovered ? [] : [5, 4]);
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
    drawHangarJointHandles(ctx, model, ox, oy, scale, accent, hoverHandle) {
        const band = this.hangarSelectedJointBand(model, scale);
        if (!band) return;
        const k = this.hangarJointCorners(band);
        const px = (p) => [ox + p[0] * scale, oy + p[1] * scale];
        const handle = (key, p, w, hgt) => {
            const [x, y] = px(p);
            const hot = hoverHandle === key;
            ctx.fillStyle = hot ? '#ffffff' : '#09090d';
            ctx.strokeStyle = hot ? accent : '#ffffff';
            ctx.lineWidth = 2;
            ctx.fillRect(Math.round(x - w / 2), Math.round(y - hgt / 2), w, hgt);
            ctx.strokeRect(Math.round(x - w / 2), Math.round(y - hgt / 2), w, hgt);
        };
        ctx.save();
        handle('start-1', k.s0, 8, 8);
        handle('start1', k.s1, 8, 8);
        handle('end-1', k.e0, 8, 8);
        handle('end1', k.e1, 8, 8);
        const a = this.hangarJointAxes(band);
        const flat = Math.abs(a.ux) > Math.abs(a.uy);
        handle('both-1', k.side0, flat ? 14 : 6, flat ? 6 : 14);
        handle('both1', k.side1, flat ? 14 : 6, flat ? 6 : 14);
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
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(ox + knob.tipX * scale, oy + knob.tipY * scale);
            ctx.lineTo(kx, ky);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = hot ? '#ffffff' : '#09090d';
            ctx.strokeStyle = hot ? accent : '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(kx, ky, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Curved arrow glyph: this knob turns the wing.
            ctx.strokeStyle = hot ? accent : '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(kx, ky, 3.5, -Math.PI * 0.9, Math.PI * 0.4);
            ctx.stroke();
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
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = accent;
        selected.forEach((seg) => withRotation(seg, () => {
            ctx.fillRect(
                Math.round(ox + seg.x * scale),
                Math.round(oy + seg.y * scale),
                Math.max(1, Math.round(seg.width * scale)),
                Math.max(1, Math.round(seg.height * scale))
            );
        }));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        selected.forEach((seg) => withRotation(seg, () => {
            const left = Math.round(ox + seg.x * scale);
            const top = Math.round(oy + seg.y * scale);
            const right = Math.round(ox + (seg.x + seg.width) * scale);
            const bottom = Math.round(oy + (seg.y + seg.height) * scale);
            const corner = Math.max(4, Math.min(14, (right - left) * 0.24, (bottom - top) * 0.24));
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
            if (hover.edge && hover.edge.indexOf('-') !== -1) {
                const cx = hover.edge.indexOf('right') !== -1 ? right : left;
                const cy = hover.edge.indexOf('bottom') !== -1 ? bottom : top;
                const r = Math.max(3, Math.min(7, corner * 0.5));
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
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
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(left, top, Math.max(2, right - left), Math.max(2, bottom - top));
                // Centre line, shown only while the drag is actually snapped,
                // so the snap is visible rather than just felt.
                if (this._hangarSnapCenter === selectedModule.kind) {
                    const cx = Math.round((left + right) / 2);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 3]);
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
        canvas.title = 'Mitte ziehen: verschieben · Rand ziehen: skalieren · Leere Fläche: schwenken · Scrollen: zoomen';
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
