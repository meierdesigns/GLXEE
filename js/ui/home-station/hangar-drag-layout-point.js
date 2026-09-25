"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Pointer event → hangar layout coordinates. */
    hangarDragLayoutPoint(h, e) {
        const rect = h.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (h.canvas.width / Math.max(1, rect.width));
        const py = (e.clientY - rect.top) * (h.canvas.height / Math.max(1, rect.height));
        return {
            lx: (px - h.ox) / Math.max(1, h.scale),
            ly: (py - h.oy) / Math.max(1, h.scale)
        };
    },

    /** Topmost layout module under the pointer, or null. */
    hangarDragModuleHit(h, e) {
        const pt = this.hangarDragLayoutPoint(h, e);
        const modules = h.model.layout.modules || [];
        // Topmost module wins (later in draw order).
        for (let i = modules.length - 1; i >= 0; i--) {
            const mod = modules[i];
            if (pt.lx >= mod.x && pt.lx <= mod.x + mod.width
                && pt.ly >= mod.y && pt.ly <= mod.y + mod.height) {
                return mod;
            }
        }
        return null;
    },

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
        const GRIP_PX = 9;
        const reach = GRIP_PX / Math.max(1, h.scale);
        const inward = (size) => Math.min(reach, size * 0.35);
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
        // The wing root (rotation pivot) is the joint handle, even where the
        // bridge band itself is only a pixel or two thick.
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (loader && loader.wingAttachPoint) {
            for (const seg of h.model.layout.segments || []) {
                if (seg.id !== 'wingLeft' && seg.id !== 'wingRight') continue;
                const pivot = loader.wingAttachPoint(seg, h.model, h.scale);
                if (Math.hypot(pt.lx - pivot.x, pt.ly - pivot.y) <= reach) {
                    return {
                        segment: 'wing',
                        left: seg.id === 'wingLeft',
                        right: seg.id === 'wingRight',
                        width: seg.width,
                        height: seg.height,
                        edge: null,
                        connector: true
                    };
                }
            }
        }
        let hit = segments.find((seg) =>
            (seg.id === 'wingLeft' || seg.id === 'wingRight') && inGrip(seg));
        if (!hit) hit = segments.find((seg) => {
            const q = local(seg);
            return q.lx >= seg.x && q.lx <= seg.x + seg.width
                && q.ly >= seg.y && q.ly <= seg.y + seg.height;
        });
        if (hit) localPt = local(hit);
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
                if (Math.abs(pt.ly - bridgeY) <= path.half) {
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
                return 'move';
        }
    },

    updateHangarDragHover(h, e) {
        h.lastPointerEvent = { clientX: e.clientX, clientY: e.clientY };
        if (this.hangarDragModuleHit(h, e)) {
            h.canvas.style.cursor = 'move';
            if (this._hangarSegmentHover) {
                this._hangarSegmentHover = null;
                this.drawHangarBay();
            }
            return;
        }
        const hit = this.hangarDragAreaHit(h, e);
        h.canvas.style.cursor = this.hangarDragCursor(hit);
        const next = hit
            ? {
                segment: hit.segment,
                edge: hit.edge,
                connector: !!hit.connector,
                side: hit.left ? 'left' : 'right'
            }
            : null;
        const prev = this._hangarSegmentHover;
        if ((prev && next && prev.segment === next.segment && prev.edge === next.edge
            && prev.connector === next.connector && prev.side === next.side)
            || (!prev && !next)) {
            return;
        }
        this._hangarSegmentHover = next;
        this.drawHangarBay();
    },
});
