"use strict";

// HomeStationUI members, continued from hangar-drag-layout-point.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
    /** Hull segment / wing bridge / resize grip under the pointer, or null. */
    hangarDragAreaHit(h, e) {
        const pt = this.hangarDragLayoutPoint(h, e);
        const segments = (h.model.layout.segments || []).filter((seg) =>
            ['front', 'center', 'back', 'wingLeft', 'wingRight'].indexOf(seg.id) !== -1
        ).map((seg) => this.hangarSegmentFrame(seg, h.model, h.scale));
        // Prefer exact segment frames — no soft fallback bands that create
        // oversized empty hit areas around the ship.
        // Resize grips are a fixed on-screen size and reach outside the
        // frame as well as into it. A proportional inner band collapsed to
        // a couple of pixels on a tightly cropped wing, which made those
        // parts practically unresizable.
        const GRIP_PX = 14;
        const reach = GRIP_PX / Math.max(1, h.scale);
        const inward = (size) => Math.min(reach, size * 0.4);
        // Each segment is tested in its own space, so a rotated wing's
        // clickable area tilts with the frame drawn around it.
        const local = (seg) => this.hangarSegmentLocalPoint(pt, seg.id, h.model, h.scale);
        let localPt = pt;
        // Wing resize grips win over hull frames: a rotated wing's edge
        // sweeps across the nose/tail frames and was unreachable there.
        const inGrip = (seg) => {
            const q = local(seg);
            const inside = q.lx >= seg.x - reach && q.lx <= seg.x + seg.width + reach
                && q.ly >= seg.y - reach && q.ly <= seg.y + seg.height + reach;
            if (!inside) return false;
            return q.lx - seg.x <= inward(seg.width) || seg.x + seg.width - q.lx <= inward(seg.width)
                || q.ly - seg.y <= inward(seg.height) || seg.y + seg.height - q.ly <= inward(seg.height);
        };
        const jointHandle = this.hangarJointHandleHit(h, pt);
        if (jointHandle) {
            return {
                segment: 'joint',
                jointHandle,
                connector: true,
                spine: jointHandle.band.kind === 'spine' ? jointHandle.band.id : null,
                left: jointHandle.band.id === 'wingLeft',
                right: jointHandle.band.id === 'wingRight',
                edge: null
            };
        }
        // Rotation knob just past the tip of the wing in focus. It sits in
        // empty space outside the wing, so it never competes with the
        // wing's own move/resize grips or with the joint.
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        for (const wingId of this.hangarRotatableWings()) {
            const knob = this.hangarWingRotateHandle(wingId, h.model, h.scale);
            // Grab radius matches the drawn knob (~16 screen px).
            if (knob && Math.hypot(pt.lx - knob.x, pt.ly - knob.y) <= Math.max(reach * 1.2, 16 / Math.max(1, h.scale))) {
                const seg = (h.model.layout.segments || []).find((s) => s.id === wingId);
                return {
                    segment: 'wing',
                    left: wingId === 'wingLeft',
                    right: wingId === 'wingRight',
                    width: seg ? seg.width : 0,
                    height: seg ? seg.height : 0,
                    edge: null,
                    rotateHandle: true
                };
            }
        }
        // Corners first: a generous square around each frame corner (bigger
        // than the edge bands, matching the drawn corner bracket), so a
        // corner is easy to hit and never loses to a neighbouring part.
        // The area whose panel is open, or the one hovered, wins near-ties.
        const CORNER_PX = 22;
        const cReach = CORNER_PX / Math.max(1, h.scale);
        const prefId = this._hangarSelectedArea
            || (this._hangarSegmentHover && this._hangarSegmentHover.segment) || null;
        const prefers = (seg) => prefId && (seg.id === prefId
            || (prefId === 'wing' && (seg.id === 'wingLeft' || seg.id === 'wingRight'))
            || ((prefId === 'wingLeft' || prefId === 'wingRight') && seg.id === prefId));
        let bestCorner = null;
        segments.forEach((seg) => {
            const q = local(seg);
            // Inside reach: at most a third of the part, so small parts
            // keep a move band in the middle.
            const inX = Math.min(cReach, seg.width / 3);
            const inY = Math.min(cReach, seg.height / 3);
            [['left', seg.x, 1], ['right', seg.x + seg.width, -1]].forEach(([xe, cx, sx]) => {
                [['top', seg.y, 1], ['bottom', seg.y + seg.height, -1]].forEach(([ye, cy, sy]) => {
                    const dx = (q.lx - cx) * sx; // >0 = inside the frame
                    const dy = (q.ly - cy) * sy;
                    if (dx < -cReach || dx > inX || dy < -cReach || dy > inY) return;
                    // Nearest corner wins, so hull and wing corners next to
                    // each other stay separately grabbable; the selected
                    // area only breaks near-ties (within 3 screen px).
                    const d = Math.hypot(q.lx - cx, q.ly - cy) - (prefers(seg) ? 3 / Math.max(1, h.scale) : 0);
                    if (!bestCorner || d < bestCorner.d) bestCorner = { seg, edge: ye + '-' + xe, d };
                });
            });
        });
        if (bestCorner) {
            const seg = bestCorner.seg;
            return {
                segment: seg.id === 'wingLeft' || seg.id === 'wingRight' ? 'wing' : seg.id,
                left: seg.id === 'wingLeft',
                right: seg.id === 'wingRight',
                width: seg.width,
                height: seg.height,
                edge: bestCorner.edge,
                rotation: (this.hangarSegmentRotation(seg.id, h.model, h.scale) || { angle: 0 }).angle
            };
        }
        let hit = segments.find((seg) =>
            (seg.id === 'wingLeft' || seg.id === 'wingRight') && inGrip(seg));
        if (!hit) hit = segments.find((seg) => {
            const q = local(seg);
            return q.lx >= seg.x && q.lx <= seg.x + seg.width
                && q.ly >= seg.y && q.ly <= seg.y + seg.height;
        });
        if (hit) localPt = local(hit);
        if (!hit && loader && loader.spineJointPaths) {
            // Nose→body→aft joints: clickable in the visible gap between
            // the parts, with a few screen pixels of slack so thin joints
            // stay easy to hit.
            const slack = 6 / Math.max(1, h.scale);
            for (const path of loader.spineJointPaths(h.model.layout, h.scale)) {
                if (path.y1 - path.y0 <= 0) continue;
                if (pt.ly < path.y0 - slack * 0.5 || pt.ly > path.y1 + slack * 0.5) continue;
                const t = Math.max(0, Math.min(1, (pt.ly - path.y0) / (path.y1 - path.y0)));
                const cx = path.x0 + (path.x1 - path.x0) * t;
                const half = path.half0 + (path.half1 - path.half0) * t;
                if (Math.abs(pt.lx - cx) <= Math.max(half, slack)) {
                    return {
                        segment: 'spine',
                        spine: path.id,
                        left: false,
                        right: false,
                        width: half * 2,
                        height: path.y1 - path.y0,
                        edge: null,
                        connector: true
                    };
                }
            }
        }
        if (!hit) {
            // The bridge keeps priority over the grip ring around it.
            for (const path of this.hangarConnectionPaths(h.model, h.scale)) {
                // Slack in screen pixels — a flat 6 layout units reached
                // far past the bridge and swallowed neighbouring parts.
                const slack = 6 / Math.max(1, h.scale);
                const minX = Math.min(path.x0, path.x1) - slack;
                const maxX = Math.max(path.x0, path.x1) + slack;
                if (pt.lx < minX || pt.lx > maxX) continue;
                const span = path.x1 - path.x0;
                const t = Math.abs(span) > 0.01 ? (pt.lx - path.x0) / span : 0;
                const bridgeY = path.y0
                    + (path.y1 - path.y0) * Math.max(0, Math.min(1, t));
                const bridgeHalf = path.half0 + (path.half1 - path.half0) * Math.max(0, Math.min(1, t));
                if (Math.abs(pt.ly - bridgeY) <= Math.max(bridgeHalf, slack)) {
                    return {
                        segment: 'wing',
                        left: path.left,
                        right: !path.left,
                        width: Math.abs(span),
                        height: path.half * 2,
                        edge: null,
                        connector: true
                    };
                }
            }
            // Outside every frame: the grip ring just beyond a frame's
            // edge still resizes it, so small parts stay grabbable.
            hit = segments.find((seg) => {
                const q = local(seg);
                return q.lx >= seg.x - reach && q.lx <= seg.x + seg.width + reach
                    && q.ly >= seg.y - reach && q.ly <= seg.y + seg.height + reach;
            });
            if (!hit) return null;
            localPt = local(hit);
        }
        // The grip reaches `reach` outside the edge and at most `inward`
        // inside it, so the middle always stays a grab-to-move band.
        const marginX = inward(hit.width);
        const marginY = inward(hit.height);
        const distLeft = localPt.lx - hit.x;
        const distRight = (hit.x + hit.width) - localPt.lx;
        const distTop = localPt.ly - hit.y;
        const distBottom = (hit.y + hit.height) - localPt.ly;
        // Resolve each axis independently first, then combine — a point
        // inside both an X edge band and a Y edge band is a corner (both
        // axes resize together), not just whichever axis is closest.
        const onEdge = (distIn, margin) => distIn <= margin && distIn >= -reach;
        let xEdge = null;
        if (onEdge(distLeft, marginX) && onEdge(distRight, marginX)) xEdge = distLeft <= distRight ? 'left' : 'right';
        else if (onEdge(distLeft, marginX)) xEdge = 'left';
        else if (onEdge(distRight, marginX)) xEdge = 'right';
        let yEdge = null;
        if (onEdge(distTop, marginY) && onEdge(distBottom, marginY)) yEdge = distTop <= distBottom ? 'top' : 'bottom';
        else if (onEdge(distTop, marginY)) yEdge = 'top';
        else if (onEdge(distBottom, marginY)) yEdge = 'bottom';
        const edge = (xEdge && yEdge) ? (yEdge + '-' + xEdge) : (xEdge || yEdge || null);
        return {
            segment: hit.id === 'wingLeft' || hit.id === 'wingRight' ? 'wing' : hit.id,
            left: hit.id === 'wingLeft',
            right: hit.id === 'wingRight',
            width: hit.width,
            height: hit.height,
            edge: edge,
            rotation: (this.hangarSegmentRotation(hit.id, h.model, h.scale) || { angle: 0 }).angle
        };
    },
    hangarDragCursor(hit) {
        if (!hit) return 'grab';
        if (hit.jointHandle) return this.hangarJointHandleCursor(hit.jointHandle);
        if (hit.rotateHandle) return 'grab';
        // Wing bridge slides up/down along the hull.
        if (hit.connector && !hit.spine && (hit.left || hit.right)) return 'ns-resize';
        if (hit.connector) return 'alias';
        if (hit.edge && hit.rotation) {
            // Turn the edge's direction with the wing, then pick the
            // closest of the four resize cursors (45° steps).
            const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
            let vx = 0;
            let vy = 0;
            hit.edge.split('-').forEach((part) => { vx += dir[part][0]; vy += dir[part][1]; });
            const deg = (Math.atan2(vy, vx) + hit.rotation) * 180 / Math.PI;
            const step = ((Math.round(deg / 45) % 4) + 4) % 4;
            return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][step];
        }
        switch (hit.edge) {
            case 'left':
            case 'right':
                return 'ew-resize';
            case 'top':
            case 'bottom':
                return 'ns-resize';
            case 'top-left':
            case 'bottom-right':
                return 'nwse-resize';
            case 'top-right':
            case 'bottom-left':
                return 'nesw-resize';
            default:
                return this.hangarMoveCursor(hit);
        }
    },
    /**
     * Grab-to-move cursor that only shows the directions the part can still
     * go: body parts slide fore/aft only, and at the end of their travel the
     * blocked arrow drops away.
     */
    hangarMoveCursor(hit) {
        if (!hit || ['front', 'center', 'back'].indexOf(hit.segment) === -1
            || typeof shipLoadoutManager === 'undefined') return 'move';
        const loadout = shipLoadoutManager.getLoadout(this.hangarShipId || 'player_scrap');
        const offset = loadout.segmentOffset && loadout.segmentOffset[hit.segment];
        const y = Number(offset && offset.y) || 0;
        if (y >= 0.999) return 'n-resize';
        if (y <= -0.999) return 's-resize';
        return 'ns-resize';
    },
    updateHangarDragHover(h, e) {
        h.lastPointerEvent = { clientX: e.clientX, clientY: e.clientY };
        const layout = h.model && h.model.layout;
        const target = this.hangarPointerTarget(h, e);
        this.setHangarTargetPin(target.type === 'slot' ? target.pin : null);
        if (target.type === 'slot') {
            // A slot is targeted: no part frame, no area edges competing with it.
            h.canvas.style.cursor = 'grab';
            const hadOther = this._hangarHoverModule || this._hangarSegmentHover;
            this._hangarHoverModule = null;
            this._hangarSegmentHover = null;
            if (hadOther) this.drawHangarBay();
            return;
        }
        const hovMod = target.type === 'module' ? target.module : null;

        const prevHov = this._hangarHoverModule;
        const nextHov = hovMod ? { kind: hovMod.kind, id: hovMod.id, face: hovMod.face } : null;
        const hovChanged = !!prevHov !== !!nextHov || (prevHov && nextHov
            && (prevHov.kind !== nextHov.kind || prevHov.id !== nextHov.id || prevHov.face !== nextHov.face));
        if (hovChanged) {
            this._hangarHoverModule = nextHov;
            if (!nextHov || !this._hangarSegmentHover) this.drawHangarBay();
        }
        if (layout && this.hangarAreaAt) {
            const mod = hovMod;
            const pt = this.hangarDragLayoutPoint(h, e);
            const area = mod
                ? this.hangarAreaAt(layout, mod.x + mod.width / 2, mod.y + mod.height / 2)
                : this.hangarAreaAt(layout, pt.lx, pt.ly);
            if (area !== this._hangarHoverArea) this.setHangarHoverArea(area);
        }
        if (hovMod) {
            // Installed parts are grabbed to pull them out of their slot.
            h.canvas.style.cursor = 'grab';
            if (this._hangarSegmentHover) {
                this._hangarSegmentHover = null;
                this.drawHangarBay();
            }
            return;
        }
        const hit = target.type === 'area' ? target.hit : null;
        h.canvas.style.cursor = this.hangarDragCursor(hit);
        const next = hit
            ? {
                segment: hit.segment,
                edge: hit.edge,
                connector: !!hit.connector,
                spine: hit.spine || null,
                handle: hit.jointHandle ? hit.jointHandle.end + hit.jointHandle.side
                    : (hit.rotateHandle ? 'rotate' : null),
                side: hit.left ? 'left' : 'right'
            }
            : null;
        const prev = this._hangarSegmentHover;
        if ((prev && next && prev.segment === next.segment && prev.edge === next.edge
            && prev.connector === next.connector && prev.side === next.side
            && prev.spine === next.spine && prev.handle === next.handle)
            || (!prev && !next)) {
            return;
        }
        this._hangarSegmentHover = next;
        this.drawHangarBay();
    },
});
