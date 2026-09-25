"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** pointerdown: start a module move, segment move/resize, or view pan. */
    onHangarDragDown(h, e) {
        if (e.button !== 0) return;
        // Ignore clicks on hangar slot buttons - check if click coordinates hit a slot element
        const elementAtClick = document.elementFromPoint(e.clientX, e.clientY);
        const slotElement = elementAtClick?.closest('.hs-hangar-slot, [data-hangar-slot-toggle]');
        if (slotElement) {
            return;
        }
        // Ship areas have priority over the modules drawn inside them.
        // Clicking the hull must select/adjust the area, not move a module.
        const rawModule = this.hangarDragModuleHit(h, e);
        let areaHit = this.hangarDragAreaHit(h, e);
        if (!areaHit && rawModule) {
            const segmentId = rawModule.mountSegment === 'wing'
                ? (rawModule.face === 'left' ? 'wingLeft' : 'wingRight')
                : rawModule.mountSegment;
            const segment = (h.model.layout.segments || []).find((seg) => seg.id === segmentId);
            if (segment) {
                areaHit = {
                    segment: segmentId === 'wingLeft' || segmentId === 'wingRight'
                        ? 'wing' : segmentId,
                    left: segmentId === 'wingLeft',
                    right: segmentId === 'wingRight',
                    width: segment.width,
                    height: segment.height,
                    edge: null
                };
            }
        }
        const module = null;
        if (module && shipLoadoutManager.setModuleOffset) {
            // A single drag both selects and moves the module now — a
            // release without real movement still counts as "select" so
            // clicking to highlight a module still works.
            const moduleOffsetKey = shipLoadoutManager.moduleOffsetKey
                ? shipLoadoutManager.moduleOffsetKey(module.id, module.face)
                : module.id;
            const stored = h.loadout.moduleOffsets
                && h.loadout.moduleOffsets[module.kind]
                && (h.loadout.moduleOffsets[module.kind][moduleOffsetKey]
                    || h.loadout.moduleOffsets[module.kind][module.id]);
            const segmentId = module.mountSegment === 'wing'
                ? (module.face === 'left' ? 'wingLeft' : 'wingRight')
                : module.mountSegment;
            const segment = (h.model.layout.segments || []).find((seg) => seg.id === segmentId);
            h.drag = {
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
                startModuleOffsetX: stored ? Number(stored.x) || 0 : 0,
                startModuleOffsetY: stored ? Number(stored.y) || 0 : 0,
                module: module,
                segmentWidth: Math.max(1, segment ? segment.width : module.width || 1),
                segmentHeight: Math.max(1, segment ? segment.height : module.height || 1)
            };
            this._hangarSelectedModule = { kind: module.kind, id: module.id };
            this._hangarSegmentHover = null;
            this._hangarWingDragState = h.drag;
            h.canvas.classList.add('is-module-dragging');
            h.canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }
        const hit = areaHit || this.hangarDragAreaHit(h, e);
        if (!hit) {
            if (this._hangarSelectedModule) {
                this._hangarSelectedModule = null;
                this.drawHangarBay();
            }
            // Empty canvas space pans the view instead of doing nothing.
            h.drag = {
                pan: true,
                startX: e.clientX,
                startY: e.clientY,
                startPanX: this._hangarBayPanX || 0,
                startPanY: this._hangarBayPanY || 0
            };
            this._hangarWingDragState = h.drag;
            h.canvas.classList.add('is-panning');
            h.canvas.style.cursor = 'grabbing';
            h.canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }
        if (hit.connector && shipLoadoutManager.setWingRotation) {
            // Dragging the hull-to-wing joint swings the wing around its
            // root pivot; a plain click still opens the connection style.
            const wingId = hit.left ? 'wingLeft' : 'wingRight';
            const seg = (h.model.layout.segments || []).find((s) => s.id === wingId);
            const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
            if (seg && loader && loader.wingAttachPoint) {
                const pivot = loader.wingAttachPoint(seg, h.model, h.scale);
                h.drag = {
                    rotate: true,
                    connector: true,
                    segment: 'wing',
                    side: hit.left ? 'left' : 'right',
                    moved: false,
                    startX: e.clientX,
                    startY: e.clientY,
                    pivot: pivot
                };
                this._hangarSelectedModule = null;
                this._hangarWingDragState = h.drag;
                h.canvas.classList.add('is-wing-dragging');
                h.canvas.style.cursor = 'grabbing';
                h.canvas.setPointerCapture(e.pointerId);
                e.preventDefault();
                return;
            }
        }
        const segmentId = hit.segment === 'wing' ? 'wing' : hit.segment;
        const segmentScale = (h.loadout.segmentScale && h.loadout.segmentScale[segmentId])
            || { x: 1, y: 1 };
        const segmentOffset = (h.loadout.segmentOffset && h.loadout.segmentOffset[segmentId])
            || { x: 0, y: 0 };
        const rawSegmentId = hit.segment === 'wing'
            ? (hit.left ? 'wingLeft' : 'wingRight')
            : hit.segment;
        const rawSegment = (h.model.layout.segments || []).find((seg) => seg.id === rawSegmentId);
        h.drag = {
            startX: e.clientX,
            startY: e.clientY,
            startOffsetX: Number(h.loadout.wingOffsetX) || 0,
            startOffsetY: Number(h.loadout.wingOffsetY) || 0,
            startSegmentOffsetX: Number(segmentOffset.x) || 0,
            startSegmentOffsetY: Number(segmentOffset.y) || 0,
            startScaleX: Number(segmentScale.x) || 1,
            startScaleY: Number(segmentScale.y) || 1,
            segment: segmentId,
            edge: hit.edge,
            side: hit.left ? 'left' : 'right',
            connector: !!hit.connector,
            // Resize sensitivity follows the part's real layout size, not
            // its cropped visible box — a 2-unit wing frame made one short
            // drag slam straight into the scale clamp.
            frameWidth: Math.max(1, (rawSegment && rawSegment.width) || hit.width || h.core.width || 1),
            frameHeight: Math.max(1, (rawSegment && rawSegment.height) || hit.height || h.core.height || 1),
            // A rotated wing resizes along its own axes, not the screen's.
            rotation: (this.hangarSegmentRotation(rawSegmentId, h.model, h.scale) || { angle: 0 }).angle
        };
        this._hangarSelectedModule = null;
        this._hangarWingDragState = h.drag;
        h.canvas.classList.add(hit.edge ? 'is-wing-scaling' : 'is-wing-dragging');
        h.canvas.style.cursor = this.hangarDragCursor(hit);
        h.canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
    },

    applyHangarDrag(h, e) {
        if (!h.drag) return;
        const rect = h.canvas.getBoundingClientRect();
        const sx = h.canvas.width / Math.max(1, rect.width);
        const sy = h.canvas.height / Math.max(1, rect.height);
        const dx = (e.clientX - h.drag.startX) * sx / Math.max(1, h.scale);
        const dy = (e.clientY - h.drag.startY) * sy / Math.max(1, h.scale);
        if (h.drag.pan) {
            // Raw canvas-pixel delta (not divided by scale) — pan offset
            // is added directly to ox/oy in canvas-pixel space.
            this._hangarBayPanX = h.drag.startPanX + (e.clientX - h.drag.startX) * sx;
            this._hangarBayPanY = h.drag.startPanY + (e.clientY - h.drag.startY) * sy;
            this.drawHangarBay(true);
            return;
        }
        if (h.drag.rotate) {
            if (!h.drag.moved && (Math.abs(e.clientX - h.drag.startX) > 4 || Math.abs(e.clientY - h.drag.startY) > 4)) {
                h.drag.moved = true;
            }
            if (!h.drag.moved) return;
            // The wing aims at the pointer from its root. Too close to the
            // pivot the direction is noise, so hold the last angle there.
            const pt = this.hangarDragLayoutPoint(h, e);
            const vx = pt.lx - h.drag.pivot.x;
            const vy = pt.ly - h.drag.pivot.y;
            if (Math.hypot(vx, vy) < 2) return;
            // Left wing points along -x and is drawn with the mirrored angle.
            const deg = Math.atan2(vy, h.drag.side === 'left' ? -vx : vx) * 180 / Math.PI;
            shipLoadoutManager.setWingRotation(this.hangarShipId, Math.round(deg));
        } else if (h.drag.module) {
            // A generous click-vs-drag threshold: a real mouse click
            // almost always jitters a couple of pixels between down and
            // up, so a tight 3px cutoff was flagging most clicks as
            // drags and silently skipping the "open this slot" behavior
            // below in up().
            if (!h.drag.moved && (Math.abs(e.clientX - h.drag.startX) > 6 || Math.abs(e.clientY - h.drag.startY) > 6)) {
                h.drag.moved = true;
            }
            if (!h.drag.moved) return;
            shipLoadoutManager.setModuleOffset(
                this.hangarShipId,
                h.drag.module.kind,
                h.drag.module.id,
                h.drag.startModuleOffsetX + dx / Math.max(1, h.drag.segmentWidth),
                h.drag.startModuleOffsetY + dy / Math.max(1, h.drag.segmentHeight),
                h.drag.module.face
            );
        } else if (h.drag.segment === 'wing') {
            const edge = h.drag.edge;
            if (edge) {
                // Project the drag into the wing's rotated frame first.
                const a = -(h.drag.rotation || 0);
                const ldx = dx * Math.cos(a) - dy * Math.sin(a);
                const ldy = dx * Math.sin(a) + dy * Math.cos(a);
                const outward = h.drag.side === 'left' ? -ldx : ldx;
                // Corner edges (e.g. "top-left") contain both an X and a Y
                // token, so both axes resize together from one drag.
                const hasX = edge.indexOf('left') !== -1 || edge.indexOf('right') !== -1;
                const hasY = edge.indexOf('top') !== -1 || edge.indexOf('bottom') !== -1;
                const heightSign = edge.indexOf('bottom') !== -1 ? 1 : (edge.indexOf('top') !== -1 ? -1 : 0);
                shipLoadoutManager.setSegmentScale(
                    this.hangarShipId,
                    'wing',
                    h.drag.startScaleX + (hasX ? outward : 0) / Math.max(1, h.drag.frameWidth),
                    h.drag.startScaleY + (hasY ? heightSign * ldy : 0) / Math.max(1, h.drag.frameHeight)
                );
            } else {
                const outward = h.drag.side === 'left' ? -dx : dx;
                shipLoadoutManager.setWingOffset(
                    this.hangarShipId,
                    h.drag.startOffsetX + outward / Math.max(1, h.core.width),
                    h.drag.startOffsetY + dy / Math.max(1, h.core.height)
                );
            }
        } else if (h.drag.edge) {
            const edge = h.drag.edge;
            const widthSign = edge.indexOf('right') !== -1 ? 1 : (edge.indexOf('left') !== -1 ? -1 : 0);
            const heightSign = edge.indexOf('bottom') !== -1 ? 1 : (edge.indexOf('top') !== -1 ? -1 : 0);
            shipLoadoutManager.setSegmentScale(
                this.hangarShipId,
                h.drag.segment,
                h.drag.startScaleX + (widthSign * dx) / Math.max(1, h.drag.frameWidth || h.core.width),
                h.drag.startScaleY + (heightSign * dy) / Math.max(1, h.drag.frameHeight || h.core.height)
            );
        } else {
            shipLoadoutManager.setSegmentOffset(
                this.hangarShipId,
                h.drag.segment,
                0,
                h.drag.startSegmentOffsetY + dy / Math.max(1, h.core.height)
            );
        }
        this._hangarWingDragState = h.drag;
        if (!this._hangarLiveDrawRaf) {
            this._hangarLiveDrawRaf = requestAnimationFrame(() => {
                this._hangarLiveDrawRaf = 0;
                if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
            });
        }
    },
});
