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

    /** Nearest visible empty-slot marker within radius (screen px), or null. */
    hangarEmptyPinNear(clientX, clientY, radius) {
        if (!this.overlay) return null;
        let best = null;
        let bestD = radius;
        // Weapon slots sit on fixed mounts and aren't moved.
        this.overlay.querySelectorAll('.hs-hangar-slot.is-empty:not([data-slot-kind="weapon"]) .hs-hangar-slot-pin:not(.is-mirror)').forEach((pin) => {
            if (getComputedStyle(pin).opacity === '0') return;
            const r = pin.getBoundingClientRect();
            const d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
            if (d < bestD) {
                bestD = d;
                best = pin;
            }
        });
        return best;
    },

    /**
     * Module under the pointer whose centre is nearest — stacked parts
     * (e.g. shield + core in the fuselage) overlap, and the topmost one
     * would otherwise always win.
     */
    hangarNearestModuleAt(h, e) {
        const pt = this.hangarDragLayoutPoint(h, e);
        // Tiny parts get a grab zone of at least ~22 screen px.
        const minUnits = 22 / Math.max(1, h.scale);
        let best = null;
        let bestD = Infinity;
        (h.model.layout.modules || []).forEach((mod) => {
            if (mod.kind !== 'weapon') return;
            const padX = Math.max(0, (minUnits - mod.width) / 2);
            const padY = Math.max(0, (minUnits - mod.height) / 2);
            if (pt.lx < mod.x - padX || pt.lx > mod.x + mod.width + padX
                || pt.ly < mod.y - padY || pt.ly > mod.y + mod.height + padY) return;
            const d = Math.hypot(pt.lx - (mod.x + mod.width / 2), pt.ly - (mod.y + mod.height / 2));
            if (d < bestD) {
                bestD = d;
                best = mod;
            }
        });
        return best;
    },

    /** Topmost layout module under the pointer, or null. */
    hangarDragModuleHit(h, e) {
        const pt = this.hangarDragLayoutPoint(h, e);
        const modules = h.model.layout.modules || [];
        // Topmost module wins (later in draw order).
        for (let i = modules.length - 1; i >= 0; i--) {
            const mod = modules[i];
            if (mod.kind !== 'weapon') continue;
            if (pt.lx >= mod.x && pt.lx <= mod.x + mod.width
                && pt.ly >= mod.y && pt.ly <= mod.y + mod.height) {
                return mod;
            }
        }
        return null;
    },

    /**
     * The selected joint as a straight band in layout units: centreline
     * p0 → p1 with half-widths half0 / half1 at each end. Wing bridges run
     * sideways from the hull, spine joints run fore/aft between parts.
     */
    hangarSelectedJointBand(model, scale) {
        const id = this._hangarSelectedConnection;
        if (!id || !model || !model.layout) return null;
        // Same rule as the marker: only while its panel or the sidebar is open.
        const panelOpen = !!(this.overlay && this.overlay.querySelector('.hs-floating-area-style'))
            || !this._hangarLeftCollapsed;
        if (!panelOpen) return null;
        return this.hangarJointBand(model, scale, id);
    },

    /**
     * A joint as the renderer draws it, in layout units: centre points of
     * its two end edges (x0,y0 at the hull / upper part, x1,y1 at the wing /
     * lower part), their half-widths, and each end edge's own direction
     * (n0 / n1). Wing joints have a vertical hull edge and a wing edge
     * turned with the wing; spine joints have two horizontal edges.
     */
    hangarJointBand(model, scale, id) {
        if (id.indexOf('spine') === 0) {
            const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
            const path = loader && loader.spineJointPaths
                && loader.spineJointPaths(model.layout, scale).find((p) => p.id === id);
            if (!path) return null;
            // Double = two struts offset ±1.1·half, each 0.4·half wide.
            const spread = 1;
            return {
                id, kind: 'spine',
                x0: path.x0, y0: path.y0, x1: path.x1, y1: path.y1,
                half0: path.half0 * spread, half1: path.half1 * spread,
                up0: path.half0 * spread, down0: path.half0 * spread,
                up1: path.half1 * spread, down1: path.half1 * spread,
                n0: [1, 0], n1: [1, 0]
            };
        }
        const path = this.hangarConnectionPaths(model, scale).find((p) => p.id === id);
        if (!path) return null;
        const loadout = model.layout.loadout || {};
        const deg = Math.max(-60, Math.min(60, Number(loadout.wingRotation) || 0));
        const left = id === 'wingLeft';
        // Same frame renderHullSegments uses for the wing-side edge.
        const ang = deg * Math.PI / 180 * (left ? -1 : 1);
        const dirX = (left ? -1 : 1) * Math.cos(ang);
        const dirY = (left ? -1 : 1) * Math.sin(ang);
        const n1 = left ? [dirY, -dirX] : [-dirY, dirX];
        return {
            id, kind: 'wing',
            x0: path.x0, y0: path.y0, x1: path.x1, y1: path.y1,
            half0: path.half0, half1: path.half1,
            up0: path.up0, down0: path.down0, up1: path.up1, down1: path.down1,
            n0: [0, 1], n1
        };
    },

    /** The joint's four corners and the midpoints of its two long sides. */
    hangarJointCorners(band) {
        // side "-1" = up / left of the edge, "+1" = down / right.
        const s0 = [band.x0 - band.n0[0] * band.up0, band.y0 - band.n0[1] * band.up0];
        const s1 = [band.x0 + band.n0[0] * band.down0, band.y0 + band.n0[1] * band.down0];
        const e0 = [band.x1 - band.n1[0] * band.up1, band.y1 - band.n1[1] * band.up1];
        const e1 = [band.x1 + band.n1[0] * band.down1, band.y1 + band.n1[1] * band.down1];
        const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        return { s0, s1, e0, e1, side0: mid(s0, e0), side1: mid(s1, e1) };
    },

    /** Unit direction and normal of a joint band (centreline). */
    hangarJointAxes(band) {
        const dx = band.x1 - band.x0;
        const dy = band.y1 - band.y0;
        const len = Math.max(0.0001, Math.hypot(dx, dy));
        return { ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, len };
    },

    /**
     * Resize handle of the selected joint under the pointer: the four
     * corners scale one end ('start' / 'end'), the two long sides scale
     * both ends together ('both').
     */
    hangarJointHandleHit(h, pt) {
        const band = this.hangarSelectedJointBand(h.model, h.scale);
        if (!band) return null;
        const k = this.hangarJointCorners(band);
        const reach = 7 / Math.max(1, h.scale);
        const corners = [['start', -1, k.s0], ['start', 1, k.s1], ['end', -1, k.e0], ['end', 1, k.e1]];
        for (const [end, side, c] of corners) {
            if (Math.hypot(pt.lx - c[0], pt.ly - c[1]) <= reach) return { band, end, side };
        }
        // Long sides: anywhere along the edge from a start corner to the
        // matching end corner.
        const onEdge = (p, q) => {
            const vx = q[0] - p[0];
            const vy = q[1] - p[1];
            const len2 = Math.max(0.0001, vx * vx + vy * vy);
            const t = Math.max(0, Math.min(1, ((pt.lx - p[0]) * vx + (pt.ly - p[1]) * vy) / len2));
            const d = Math.hypot(pt.lx - (p[0] + vx * t), pt.ly - (p[1] + vy * t));
            return d <= reach ? t : null;
        };
        const t0 = onEdge(k.s0, k.e0);
        if (t0 != null) return { band, end: 'both', side: -1, t: t0 };
        const t1 = onEdge(k.s1, k.e1);
        if (t1 != null) return { band, end: 'both', side: 1, t: t1 };
        return null;
    },

    /** Resize cursor for a joint handle: perpendicular to the band. */
    hangarJointHandleCursor(hit) {
        const band = hit.band;
        // Corners resize along their own end edge; sides across the centreline.
        const n = hit.end === 'start' ? band.n0 : (hit.end === 'end' ? band.n1 : null);
        const a = this.hangarJointAxes(band);
        const vx = n ? n[0] : a.nx;
        const vy = n ? n[1] : a.ny;
        const deg = ((Math.atan2(vy, vx) * 180 / Math.PI) % 180 + 180) % 180;
        const step = Math.round(deg / 45) % 4;
        return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][step];
    },

    /**
     * Wings whose rotation knob is live: only a wing you clicked (selected)
     * or the one being rotated. Hover alone no longer spawns knobs, which
     * left them flickering in and lingering around the ship.
     */
    hangarRotatableWings() {
        const panelOpen = !!(this.overlay && this.overlay.querySelector('.hs-floating-area-style'))
            || !this._hangarLeftCollapsed;
        const selected = panelOpen ? this._hangarSelectedArea : null;
        const wings = new Set();
        if (selected === 'wingLeft' || selected === 'wingRight') wings.add(selected);
        if (this._hangarWingDragState && this._hangarWingDragState.rotate) {
            wings.add(this._hangarWingDragState.side === 'left' ? 'wingLeft' : 'wingRight');
        }
        return [...wings];
    },

    /**
     * Rotation knob position in layout units: the middle of the wing's
     * outer edge, swung with the wing around its root pivot, then pushed a
     * fixed screen distance further out.
     */
    hangarWingRotateHandle(wingId, model, scale) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        const seg = model && model.layout && (model.layout.segments || []).find((s) => s.id === wingId);
        if (!seg || !loader || !loader.wingVisibleRect) return null;
        const vis = loader.wingVisibleRect(seg, model, scale);
        const pivot = loader.wingAttachPoint(seg, model, scale);
        const left = wingId === 'wingLeft';
        const tipX = left ? vis.x : vis.x + vis.width;
        const tipY = vis.y + vis.height * 0.5;
        const rot = this.hangarSegmentRotation(wingId, model, scale);
        const angle = rot ? rot.angle : 0;
        const dx = tipX - pivot.x;
        const dy = tipY - pivot.y;
        const x = pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle);
        const y = pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle);
        const len = Math.max(0.0001, Math.hypot(x - pivot.x, y - pivot.y));
        const push = 16 / Math.max(1, scale);
        return {
            x: x + (x - pivot.x) / len * push,
            y: y + (y - pivot.y) / len * push,
            tipX: x,
            tipY: y,
            pivot
        };
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
            if (knob && Math.hypot(pt.lx - knob.x, pt.ly - knob.y) <= reach * 1.2) {
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
        const hovMod = this.hangarDragModuleHit(h, e);
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
        const hit = this.hangarDragAreaHit(h, e);
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
