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
    /**
     * Single source of truth for what the pointer is over. Hover feedback
     * and pointerdown both use it, so what lights up is exactly what a
     * click grabs. Priority: empty slot > installed part > hull area.
     */
    hangarPointerTarget(h, e) {
        const pin = this.hangarEmptyPinNear(e.clientX, e.clientY, 18);
        if (pin) return { type: 'slot', pin: pin };
        const mod = h.model && h.model.layout ? this.hangarNearestModuleAt(h, e) : null;
        if (mod) return { type: 'module', module: mod };
        const hit = this.hangarDragAreaHit(h, e);
        return hit ? { type: 'area', hit: hit } : { type: 'none' };
    },
    /** Mark the one slot the pointer targets (null clears it). */
    setHangarTargetPin(pin) {
        const slot = pin ? pin.closest('.hs-hangar-slot') : null;
        if (slot === this._hangarTargetSlot) return;
        if (this._hangarTargetSlot) this._hangarTargetSlot.classList.remove('is-pointer-target');
        this._hangarTargetSlot = slot;
        if (slot) slot.classList.add('is-pointer-target');
        const stage = this.overlay && this.overlay.querySelector('.hs-hangar-bay-stage');
        if (stage) stage.classList.toggle('is-slot-targeted', !!slot);
    },
    /** Hull segment a layout module is mounted on (wing modules by face). */
    hangarModuleSegment(layout, mod) {
        const segs = (layout && layout.segments) || [];
        const id = mod.mountSegment === 'wing'
            ? (mod.face === 'left' ? 'wingLeft' : 'wingRight')
            : mod.mountSegment;
        return segs.find((seg) => seg.id === id)
            || segs.find((seg) => seg.id === this.hangarAreaAt(layout, mod.x + mod.width / 2, mod.y + mod.height / 2))
            || null;
    },
    /**
     * Hover / grab box of a part, in layout units. Parts are drawn larger
     * than their area, so the box is clamped into the area and, when the
     * area holds several parts, cut to one cell each along the area's long
     * axis — every slot of an area fits inside it without overlapping.
     */
    hangarModuleHitBox(layout, mod) {
        const seg = this.hangarModuleSegment(layout, mod);
        const cx = mod.x + mod.width / 2;
        const cy = mod.y + mod.height / 2;
        // A gun on a turned wing sits where the wing carries it; clamping it into the wing's unturned frame pulled the
        // grab box off the drawn gun, so the press fell through to the knob / wing underneath.
        const wingDeg = Math.abs(Number(layout && layout.loadout && layout.loadout.wingRotation) || 0);
        if (mod.mountSegment === 'wing' && wingDeg > 0.5) {
            return { x: mod.x, y: mod.y, width: mod.width, height: mod.height };
        }
        if (!seg) return { x: mod.x, y: mod.y, width: mod.width, height: mod.height };
        const mates = ((layout && layout.modules) || []).filter((m) => m.kind === 'weapon'
            && this.hangarModuleSegment(layout, m) === seg);
        const n = Math.max(1, mates.length);
        const tall = seg.height >= seg.width;
        const maxW = tall ? seg.width : seg.width / n;
        const maxH = tall ? seg.height / n : seg.height;
        const w = Math.min(mod.width, maxW);
        const hgt = Math.min(mod.height, maxH);
        const x = Math.max(seg.x, Math.min(seg.x + seg.width - w, cx - w / 2));
        const y = Math.max(seg.y, Math.min(seg.y + seg.height - hgt, cy - hgt / 2));
        return { x: x, y: y, width: w, height: hgt };
    },
    /** Nearest visible empty-slot marker within radius (screen px), or null. */
    hangarEmptyPinNear(clientX, clientY, radius) {
        if (!this.overlay) return null;
        let best = null;
        let bestD = radius;
        // Every empty socket can be moved — weapon slots too, and either
        // half of a split pair (its mirror marker included).
        this.overlay.querySelectorAll('.hs-hangar-slot.is-empty .hs-hangar-slot-pin').forEach((pin) => {
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
        // Tiny parts get a grab zone of at least ~44 screen px, so a gun is easy to hit with the mouse.
        // (screen px: the bay canvas is usually displayed smaller than its backing size)
        const cvRect = h.canvas && h.canvas.getBoundingClientRect ? h.canvas.getBoundingClientRect() : null;
        const shown = cvRect && h.canvas.width ? cvRect.width / h.canvas.width : 1;
        const minUnits = 44 / Math.max(0.05, h.scale * shown);
        let best = null;
        let bestD = Infinity;
        (h.model.layout.modules || []).forEach((mod) => {
            if (mod.kind !== 'weapon') return;
            const b = this.hangarModuleHitBox(h.model.layout, mod);
            const padX = Math.max(0, (minUnits - b.width) / 2);
            const padY = Math.max(0, (minUnits - b.height) / 2);
            if (pt.lx < b.x - padX || pt.lx > b.x + b.width + padX
                || pt.ly < b.y - padY || pt.ly > b.y + b.height + padY) return;
            const d = Math.hypot(pt.lx - (b.x + b.width / 2), pt.ly - (b.y + b.height / 2));
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
            const b = this.hangarModuleHitBox(h.model.layout, mod);
            if (pt.lx >= b.x && pt.lx <= b.x + b.width
                && pt.ly >= b.y && pt.ly <= b.y + b.height) {
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
            || this.hangarSidebarOpen();
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
        // Normals + optional silhouette corners from wingBridgeGeometry.
        return {
            id, kind: 'wing',
            x0: path.x0, y0: path.y0, x1: path.x1, y1: path.y1,
            half0: path.half0, half1: path.half1,
            up0: path.up0, down0: path.down0, up1: path.up1, down1: path.down1,
            n0: path.n0 || [0, 1], n1: path.n1 || [0, 1],
            e0Override: path.e0 || null,
            e1Override: path.e1 || null
        };
    },
    /** The joint's four corners and the midpoints of its two long sides. */
    hangarJointCorners(band) {
        // side "-1" = nose / up, "+1" = aft / down — same mapping the renderer uses.
        const s0 = [band.x0 - band.n0[0] * band.up0, band.y0 - band.n0[1] * band.up0];
        const s1 = [band.x0 + band.n0[0] * band.down0, band.y0 + band.n0[1] * band.down0];
        // Prefer the wing's nearest-edge corners so the marker hugs the same
        // side the voxels meet.
        const e0 = band.e0Override
            || [band.x1 - band.n1[0] * band.up1, band.y1 - band.n1[1] * band.up1];
        const e1 = band.e1Override
            || [band.x1 + band.n1[0] * band.down1, band.y1 + band.n1[1] * band.down1];
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
        // End-centre grips (wing joints) slide that end vertically.
        if (band.kind === 'wing') {
            for (const [end, c] of [['start', [band.x0, band.y0]], ['end', [band.x1, band.y1]]]) {
                if (Math.hypot(pt.lx - c[0], pt.ly - c[1]) <= reach) return { band, end, side: 0, shift: true };
            }
        }
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
        if (hit.shift) return 'ns-resize';
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
            || this.hangarSidebarOpen();
        const selected = panelOpen ? this._hangarSelectedArea : null;
        const wings = new Set();
        if (selected === 'wingLeft' || selected === 'wingRight') wings.add(selected);
        if (this._hangarWingDragState && this._hangarWingDragState.rotate) {
            wings.add(this._hangarWingDragState.side === 'left' ? 'wingLeft' : 'wingRight');
        }
        return [...wings];
    },
    /**
     * Rotation knob position in layout units: fixed on the outer left/right
     * of the upright scale frame (AABB). Tracks wing size, but never swings
     * with wingRotation — left stays left, right stays right. Stem Y follows
     * the attach pivot (real rotation axis), not the AABB mid — swept wings
     * leave empty bbox space that drifts the mid off the axis.
     */
    hangarWingRotateHandle(wingId, model, scale) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        const seg = model && model.layout && (model.layout.segments || []).find((s) => s.id === wingId);
        if (!seg || !loader || !loader.wingVisibleRect) return null;
        const frame = this.hangarSegmentFrame
            ? this.hangarSegmentFrame(seg, model, scale)
            : loader.wingVisibleRect(seg, model, scale);
        if (!frame) return null;
        const pivot = loader.wingAttachPoint
            ? loader.wingAttachPoint(seg, model, scale)
            : { x: frame.x + frame.width * 0.5, y: frame.y + frame.height * 0.5 };
        const left = wingId === 'wingLeft';
        const tipX = left ? frame.x : frame.x + frame.width;
        const tipY = Math.max(frame.y, Math.min(frame.y + frame.height, pivot.y));
        const push = 28 / Math.max(1, scale);
        const outward = left ? -1 : 1;
        return {
            x: tipX + outward * push,
            y: tipY,
            tipX: tipX,
            tipY: tipY,
            pivot
        };
    },
});
