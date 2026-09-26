"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    /**
     * Draw segmented hull: back → wings → center → front.
     * Prefer dedicated segment PNGs; else distinct procedural blocks
     * (full-sprite UV crop only as last soft fallback — it looks fused).
     */
    renderHullSegments(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions) {
        this.withShipVoxelRaster(shipModel, x, y, scale, () => {
            this.renderHullSegmentParts(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions);
        });
    },

    /**
     * Run draw() with the ship-wide voxel size and a ship-anchored lattice
     * active, so every part drawn inside (hull, wings, bridges, modules)
     * shares one resolution and lines up instead of sitting a sub-cell apart.
     */
    withShipVoxelRaster(shipModel, x, y, scale, draw) {
        const prevCell = this._shipVoxelCell;
        const prevAnchor = this._shipVoxelAnchor;
        this._shipVoxelCell = this.shipVoxelCell(shipModel, scale);
        this._shipVoxelAnchor = { x: this.devicePx(x), y: this.devicePx(y) };
        try {
            draw();
        } finally {
            this._shipVoxelCell = prevCell;
            this._shipVoxelAnchor = prevAnchor;
        }
    },

    /**
     * Lay out collected joint voxels ("col,row" on the ship lattice) as one
     * outlined, faction-plated part — same treatment as every hull piece.
     */
    drawJointCells(ctx, cells, palette, ox, oy, voxelSize, factionStyle, seedIndex, openAxis = null, insideRects = null) {
        if (!cells.size) return;
        let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
        cells.forEach((val, key) => {
            const [c, r] = key.split(',').map(Number);
            c0 = Math.min(c0, c); c1 = Math.max(c1, c);
            r0 = Math.min(r0, r); r1 = Math.max(r1, r);
        });
        const grid = this.blankGrid(c1 - c0 + 1, r1 - r0 + 1);
        cells.forEach((val, key) => {
            const [c, r] = key.split(',').map(Number);
            grid[r - r0][c - c0] = val;
        });
        this.outlineJointEdges(grid, openAxis);
        // Where the joint runs under a part it joins, it gets no outline:
        // a part's silhouette can dip inward there, and the joint's dark
        // edge then drew a stray line into the part's flank.
        if (insideRects && insideRects.length) {
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[r].length; c++) {
                    if (grid[r][c] !== 1) continue;
                    const px = ox + (c0 + c + 0.5) * voxelSize;
                    const py = oy + (r0 + r + 0.5) * voxelSize;
                    if (insideRects.some((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h)) {
                        grid[r][c] = 2;
                    }
                }
            }
        }
        this.applyFactionPlating(grid, factionStyle ? factionStyle.silhouette : 'modular', seedIndex);
        this.drawPixelGridHull(
            ctx, grid, palette, ox + c0 * voxelSize, oy + r0 * voxelSize,
            grid[0].length * voxelSize, grid.length * voxelSize, voxelSize
        );
    },

    /**
     * Call mark(col, row) for every ship-lattice voxel whose centre lies in
     * the polygon (screen px). Even-odd ray test; fine for the convex-ish
     * joint shapes.
     */
    markPolygonCells(poly, ox, oy, voxelSize, mark) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        poly.forEach(([px, py]) => {
            minX = Math.min(minX, px); maxX = Math.max(maxX, px);
            minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        });
        const c0 = Math.floor((minX - ox) / voxelSize);
        const c1 = Math.ceil((maxX - ox) / voxelSize);
        const r0 = Math.floor((minY - oy) / voxelSize);
        const r1 = Math.ceil((maxY - oy) / voxelSize);
        for (let row = r0; row <= r1; row++) {
            const cy = oy + (row + 0.5) * voxelSize;
            for (let col = c0; col <= c1; col++) {
                const cx = ox + (col + 0.5) * voxelSize;
                let inside = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const [xi, yi] = poly[i];
                    const [xj, yj] = poly[j];
                    if ((yi > cy) !== (yj > cy)
                        && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside;
                }
                if (inside) mark(col, row);
            }
        }
    },

    /**
     * Outline a joint only along its long sides. Its ends sit under the
     * parts it joins; outlining them left dark caps poking out around the
     * parts' silhouettes. openAxis 'x' = runs sideways (wing bridge),
     * 'y' = runs fore/aft (spine joint).
     */
    outlineJointEdges(g, openAxis) {
        if (!openAxis) {
            this.outlineGridEdges(g);
            return;
        }
        const rows = g.length;
        const cols = g[0].length;
        const src = g.map((row) => row.slice());
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (src[r][c] !== 2) continue;
                const empty = openAxis === 'x'
                    ? (r === 0 || !src[r - 1][c] || r === rows - 1 || !src[r + 1][c])
                    : (c === 0 || !src[r][c - 1] || c === cols - 1 || !src[r][c + 1]);
                if (empty) g[r][c] = 1;
            }
        }
    },

    /**
     * Vertical spine joints nose→body→aft, the fore/aft counterpart of the
     * wing bridges: when a part is moved away, a plated strut keeps it
     * visibly attached instead of floating. Drawn before the parts, so it
     * only shows in the gap.
     */
    renderSpineJoints(ctx, layout, segs, x, y, scale, colorOverlay, overlayIntensity, factionStyle) {
        const paths = this.spineJointPaths(layout, scale);
        if (!paths.length) return;
        const palette = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        const voxelSize = this.hullPartResolution(
            1, 1, Number(layout.loadout && layout.loadout.voxelScale) || 0.5, scale
        ).cell;
        const ox = Math.round(x);
        const oy = Math.round(y);
        // Silhouette along the joint: 0 = upper part, 1 = lower part.
        const profileFor = (style) => (t) => {
            const pinch = Math.abs(t * 2 - 1);
            if (style === 'plate') return 1;
            if (style === 'hinge') return 0.4 + 0.6 * pinch;
            if (style === 'double') return 0.9 + 0.1 * pinch;
            return 0.75 + 0.25 * pinch;
        };
        paths.forEach((path, index) => {
            const style = path.style;
            const profile = profileFor(style);
            // Reach a little into both parts so the joint is seated, not
            // butted against their outlines.
            const topY = path.seatY0 * scale;
            const botY = path.seatY1 * scale;
            const topX = path.x0 * scale;
            const botX = path.x1 * scale;
            const halfTop = Math.max(voxelSize, path.half0 * scale);
            const halfBot = Math.max(voxelSize, path.half1 * scale);
            const span = botY - topY;
            const cells = new Map();
            const firstRow = Math.floor(topY / voxelSize);
            const lastRow = Math.ceil(botY / voxelSize);
            // Built mirror-symmetric around the parts' shared centre seam:
            // one side is computed in whole voxels and mirrored, so both
            // halves always get the same count. Rounding each strut edge
            // separately left one side a voxel wider than the other.
            for (let row = firstRow; row <= lastRow; row++) {
                const t = Math.max(0, Math.min(1, (row * voxelSize + voxelSize / 2 - topY) / span));
                const half = halfTop + (halfBot - halfTop) * t;
                // Same seam the parts' even-column grids are centred on
                // (their lattice is anchored at the rounded ship origin ox).
                const axis = Math.round((x + topX + (botX - topX) * t - ox) / voxelSize);
                const outer = Math.max(1, Math.round(half * profile(t) / voxelSize));
                // Columns on the left of the seam: axis-outer .. axis-1.
                let from = axis - outer;
                let to = axis - 1;
                if (style === 'double') {
                    // Two posts flush with the outer edges, 35 % of the side.
                    to = from + Math.max(1, Math.round(outer * 0.7)) - 1;
                    if (to >= axis - 1 && outer > 1) to = axis - 2;
                }
                for (let col = from; col <= to; col++) {
                    cells.set(col + ',' + row, 2);
                    cells.set((2 * axis - 1 - col) + ',' + row, 2);
                }
            }
            if (style === 'hinge') {
                // Accent collars where the joint meets each part.
                [[topX, firstRow, halfTop, 1], [botX, lastRow, halfBot, -1]].forEach(([cx, row, half, dir]) => {
                    const axis = Math.round((x + cx - ox) / voxelSize);
                    const outer = Math.max(1, Math.round(half / voxelSize));
                    for (let col = axis - outer; col < axis + outer; col++) {
                        cells.set(col + ',' + row, 3);
                        cells.set(col + ',' + (row + dir), 3);
                    }
                });
            }
            const frames = [path.upperId, path.lowerId]
                .map((id) => (layout.segments || []).find((seg) => seg.id === id))
                .filter(Boolean)
                .map((seg) => ({ x: x + seg.x * scale, y: y + seg.y * scale, w: seg.width * scale, h: seg.height * scale }));
            this.drawJointCells(ctx, cells, palette, ox, oy, voxelSize, factionStyle, 2 + index, 'y', frames);
        });
    },

    /**
     * Nose→body and body→aft joint centrelines in layout units. Shared by
     * the renderer and the hangar hit test / focus marker, so what you can
     * click is exactly what is drawn. y0..y1 is the visible gap; seatY0/1
     * reach into the parts where the joint is anchored.
     */
    spineJointPaths(layout, scale = 1) {
        const segs = (layout && layout.segments) || [];
        const byId = {};
        segs.forEach((seg) => { byId[seg.id] = seg; });
        const loadout = (layout && layout.loadout) || {};
        // Strength alone sets the joint's outer width; styles only change
        // how that width is filled, so switching style never resizes it.
        const plateMul = 1;
        return [['front', 'center'], ['center', 'back']]
            .map(([a, b]) => [byId[a], byId[b]])
            .filter(([upper, lower]) => upper && lower)
            .map(([upper, lower]) => {
                // Nose↔core and core↔aft are tuned independently.
                const id = upper.id === 'front' ? 'spineFront' : 'spineBack';
                const joint = window.resolveSpineJoint(loadout, id);
                const startFrac = joint.width;
                const endFrac = joint.widthEnd || startFrac;
                const offsetX = joint.x;
                const narrow = Math.min(upper.width, lower.width);
                // Offset slides the joint sideways within the narrower part.
                const shift = offsetX * narrow * 0.4;
                return {
                    id: id,
                    style: joint.style,
                    upperId: upper.id,
                    lowerId: lower.id,
                    x0: upper.x + upper.width / 2 + shift,
                    x1: lower.x + lower.width / 2 + shift,
                    y0: upper.y + upper.height,
                    y1: lower.y,
                    seatY0: upper.y + upper.height * 0.75,
                    seatY1: lower.y + lower.height * 0.25,
                    half0: narrow * startFrac * plateMul,
                    half1: narrow * endFrac * plateMul
                };
            })
            // Touching parts need no joint, and the outer part can hide it.
            .filter((path) => path.seatY1 > path.seatY0 && path.y1 - path.y0 > 0.5
                && !(path.id === 'spineFront' ? loadout.hideSpineFront : loadout.hideSpineBack));
    },

    /**
     * A wing bridge is drawn as long as it still has length once both ends
     * are tucked under the parts they join — i.e. until the wing root really
     * sits inside the hull. Measuring against the hull's bounding box alone
     * hid it too early: faction hulls taper inward, so a visible air gap
     * opens well before the wing clears the box edge. Hidden also when the
     * wing panel switched the joint off.
     */
    wingConnectionVisible(layout, isLeft, centerEdge, wingEdge, scale) {
        if (layout.loadout && layout.loadout.hideWingConnection) return false;
        const gap = isLeft ? centerEdge - wingEdge : wingEdge - centerEdge;
        const center = (layout.segments || []).find((seg) => seg.id === 'center');
        const voxel = this.hullPartResolution
            ? this.hullPartResolution(1, 1, Number(layout.loadout && layout.loadout.voxelScale) || 0.5, scale).cell
            : Math.max(1, scale);
        const rootOverlap = voxel * 2;
        // Same reach into the hull as the bridge itself (see renderHullSegmentParts).
        const hullOverlap = Math.max(rootOverlap, center ? center.width * scale * 0.2 : rootOverlap);
        return gap + hullOverlap - rootOverlap > voxel;
    },

    /**
     * Wing joint extents above (up) and below (down) the centreline at the
     * hull end (0) and wing end (1), as strength fractions. Both wings use
     * the same values, so left and right stay mirror images.
     */
    wingJointSides(loadout) {
        const lo = loadout || {};
        const sides = lo.wingJointSides;
        if (sides) return sides;
        const start = Number(lo.wingConnectionWidth) || 0.1;
        const end = Number(lo.wingConnectionWidthEnd) || start;
        return { up0: start, down0: start, up1: end, down1: end };
    },

    renderHullSegmentParts(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions) {
        const layout = shipModel.layout;
        const order = { back: 0, wingLeft: 1, wingRight: 2, center: 3, front: 4 };
        const segs = (layout.segments || []).slice().sort((a, b) => {
            const oa = order[a.id] != null ? order[a.id] : 9;
            const ob = order[b.id] != null ? order[b.id] : 9;
            return oa - ob;
        });
        const showGuides = !!(renderOptions && renderOptions.showSegmentGuides === true);
        // Player hulls always render each segment as its own faction-styled
        // procedural graphic — regenerated fresh (never a stretched bitmap)
        // every time a segment's size or position changes.
        const factionStyle = this.resolvePlayerFactionStyle(shipModel);
        const shapeSeed = this.resolveHullShapeSeed(shipModel);
        const centerSeg = segs.find((seg) => seg.id === 'center');
        if (centerSeg) {
            const wingPalette = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
            ctx.fillStyle = wingPalette[2];
            segs.filter((seg) => seg.id === 'wingLeft' || seg.id === 'wingRight').forEach((wing) => {
                const isLeft = wing.id === 'wingLeft';
                const centerEdge = x + (isLeft ? centerSeg.x : centerSeg.x + centerSeg.width) * scale;
                // The bridge spans to the cropped, rotated wing root.
                const vis = this.wingVisibleRect(wing, shipModel, scale);
                const attach = this.wingAttachPoint(wing, shipModel, scale);
                const wingEdge = x + attach.x * scale;
                const connectionY = Math.max(-1, Math.min(1,
                    Number(layout.loadout && layout.loadout.wingConnectionY) || 0
                ));
                const connectionWidth = Math.max(0.02, Math.min(0.5,
                    Number(layout.loadout && layout.loadout.wingConnectionWidth) || 0.1
                ));
                const centerY = y + (
                    centerSeg.y + centerSeg.height * (0.5 + connectionY * 0.5)
                ) * scale;
                const wingY = y + attach.y * scale;
                const style = layout.loadout && layout.loadout.wingConnectionStyle || 'strut';
                if (!this.wingConnectionVisible(layout, isLeft, centerEdge, wingEdge, scale)) return;
                // Bridges use the ship-wide voxel size like every hull part.
                const voxelSize = this.hullPartResolution(
                    1, 1, Number(layout.loadout && layout.loadout.voxelScale) || 0.5, scale
                ).cell;
                // Tuck both ends two voxels under the parts they join, so the
                // parts' own outlines close the seam instead of a gap or a
                // stray end cap of the joint showing.
                const rootOverlap = voxelSize * 2;
                // The hull flank often tapers inward (faction silhouettes),
                // so reach a fifth of the body in to stay under it.
                const hullOverlap = Math.max(rootOverlap, centerSeg.width * scale * 0.2);
                const bridgeStart = isLeft ? centerEdge + hullOverlap : centerEdge - hullOverlap;
                const bridgeEnd = isLeft ? wingEdge - rootOverlap : wingEdge + rootOverlap;
                const sides = this.wingJointSides(layout.loadout);
                // Strength alone sets the outer extents; styles fill them.
                const hullUnit = centerSeg.height * scale;
                const wingUnit = vis.height * scale * 1.2;
                const up0 = Math.max(1, hullUnit * sides.up0);
                const down0 = Math.max(1, hullUnit * sides.down0);
                const up1 = Math.max(1, wingUnit * sides.up1);
                const down1 = Math.max(1, wingUnit * sides.down1);
                const centerHalf = Math.max(2, (up0 + down0) / 2);
                const wingHalf = Math.max(2, (up1 + down1) / 2);
                // Silhouette along the bridge: 0 = hull root, 1 = wing root.
                const shapeProfile = (t) => {
                    const pinch = Math.abs(t * 2 - 1);
                    if (style === 'plate') return 1;
                    if (style === 'hinge') return 0.4 + 0.6 * pinch;
                    if (style === 'double') return 0.9 + 0.1 * pinch;
                    return 0.75 + 0.25 * pinch;
                };
                // Bridge voxels are collected on the ship lattice first, then
                // outlined and plated like every other hull part, so the
                // joint reads in the faction style instead of a flat fill.
                const ox = Math.round(x);
                const oy = Math.round(y);
                const cells = new Map();
                const mark = (col, row, val) => {
                    const key = col + ',' + row;
                    if (!cells.has(key) || val === 3) cells.set(key, val);
                };
                // Wing-side frame turned with the wing: struts offset from the
                // joint's centre land on the tilted root, not on a fixed row.
                const wingDeg = Math.max(-60, Math.min(60,
                    Number(layout.loadout && layout.loadout.wingRotation) || 0));
                const ang = wingDeg * Math.PI / 180 * (isLeft ? -1 : 1);
                const dirX = (isLeft ? -1 : 1) * Math.cos(ang);
                const dirY = (isLeft ? -1 : 1) * Math.sin(ang);
                // Normal pointing "down" in the wing's frame for both sides.
                const nX = isLeft ? dirY : -dirY;
                const nY = isLeft ? -dirX : dirX;
                // One continuous polygon per strut: the hull end is a vertical
                // edge tucked into the body, the wing end is the wing root
                // line turned with the wing and pushed a few voxels into it.
                // Rasterising that single shape onto the ship lattice keeps
                // the joint in one piece at any wing angle — building it
                // column by column plus a separately turned collar split it
                // into visible chunks.
                const wingDepth = voxelSize * 3;
                const drawBridge = (fromY, wingOffset, upA, downA, upB, downB) => {
                    const bx = wingEdge + nX * wingOffset + dirX * wingDepth;
                    const by = wingY + nY * wingOffset + dirY * wingDepth;
                    const ax = bridgeStart;
                    const ay = fromY;
                    // Hull end: vertical edge. Wing end: along the turned root.
                    const aTop = [ax, ay - upA];
                    const aBot = [ax, ay + downA];
                    const bTop = [bx - nX * upB, by - nY * upB];
                    const bBot = [bx + nX * downB, by + nY * downB];
                    const pinch = shapeProfile(0.5);
                    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
                    const mc = mid([ax, ay], [bx, by]);
                    const squeeze = (pt) => [mc[0] + (pt[0] - mc[0]) * pinch, mc[1] + (pt[1] - mc[1]) * pinch];
                    const poly = [aTop, squeeze(mid(aTop, bTop)), bTop, bBot, squeeze(mid(aBot, bBot)), aBot];
                    this.markPolygonCells(poly, ox, oy, voxelSize, (col, row) => mark(col, row, 2));
                };
                if (style === 'double') {
                    // Each strut sits on its own side, so the upper one follows
                    // the "up" extents and the lower one the "down" extents.
                    // Two struts inside the same outer extents: each is 35 %
                    // of its side and sits flush with that side's edge.
                    const sa = (v) => Math.max(voxelSize * 1.5, v * 0.35);
                    drawBridge(centerY - up0 + sa(up0), -(up1 - sa(up1)), sa(up0), sa(up0), sa(up1), sa(up1));
                    drawBridge(centerY + down0 - sa(down0), down1 - sa(down1), sa(down0), sa(down0), sa(down1), sa(down1));
                } else {
                    const m = (v) => Math.max(voxelSize * 1.5, v);
                    drawBridge(centerY, 0, m(up0), m(down0), m(up1), m(down1));
                }
                if (style === 'hinge') {
                    // Hinge caps are accent-coloured voxel blocks.
                    const cap = (cx, cy, half) => {
                        const col0 = Math.round((cx - x) / voxelSize) - 1;
                        const rows = Math.max(1, Math.round(half * 2 / voxelSize));
                        const row0 = Math.round((cy - half - y) / voxelSize);
                        for (let r = 0; r < rows; r++) {
                            mark(col0, row0 + r, 3);
                            mark(col0 + 1, row0 + r, 3);
                        }
                    };
                    cap(bridgeStart, centerY, centerHalf);
                    cap(bridgeEnd, wingY, wingHalf);
                }
                this.drawJointCells(ctx, cells, wingPalette, ox, oy, voxelSize, factionStyle, isLeft ? 0 : 1, 'x', [{
                    x: x + centerSeg.x * scale,
                    y: y + centerSeg.y * scale,
                    w: centerSeg.width * scale,
                    h: centerSeg.height * scale
                }]);
            });
        }
        this.renderSpineJoints(ctx, layout, segs, x, y, scale, colorOverlay, overlayIntensity, factionStyle);
        const hasDedicatedSegments = !factionStyle && segs.some((seg) => {
            const key = this.resolveSegmentSpriteKey(shipModel, seg.id);
            return key
                && typeof spriteLoader !== 'undefined'
                && spriteLoader.getSprite
                && spriteLoader.getSprite(key);
        });
        // Without authored segment assets, split the original sprite into
        // source-backed body and wing pieces. This preserves the ship's
        // anatomy while making both wings independently movable.
        if (!hasDedicatedSegments) {
            this.renderFallbackSegmentedHull(
                ctx,
                shipModel,
                segs,
                x,
                y,
                scale,
                colorOverlay,
                overlayIntensity,
                renderOptions,
                factionStyle,
                shapeSeed
            );
            if (showGuides) {
                this.drawSegmentGuides(
                    ctx,
                    layout,
                    x,
                    y,
                    scale,
                    colorOverlay,
                    overlayIntensity
                );
            }
            return;
        }

        segs.forEach((seg) => {
            const renderSeg = seg;
            const sx = x + renderSeg.x * scale;
            const sy = y + renderSeg.y * scale;
            const sw = Math.max(1, renderSeg.width * scale);
            const sh = Math.max(1, renderSeg.height * scale);

            // Module replace: draw mount art stretched into the segment box
            if (seg.replace && seg.replace.id && seg.replace.kind === 'weapon') {
                const replaceModule = (layout.modules || []).find(
                    (m) => m.kind === seg.replace.kind && m.id === seg.replace.id
                );
                const mod = {
                    id: seg.replace.id,
                    kind: seg.replace.kind,
                    role: (typeof shipLoadoutManager !== 'undefined'
                        && shipLoadoutManager.getModuleVisualRole)
                        ? shipLoadoutManager.getModuleVisualRole(seg.replace.kind, seg.replace.id)
                        : seg.replace.kind,
                    face: seg.id === 'wingRight' ? 'right'
                        : (seg.id === 'wingLeft' ? 'left'
                            : (seg.id === 'back' ? 'down' : 'up')),
                    skin: replaceModule ? replaceModule.skin : null
                };
                this.renderShipModule(
                    ctx,
                    mod,
                    Math.round(sx),
                    Math.round(sy),
                    Math.round(sw),
                    Math.round(sh),
                    colorOverlay,
                    overlayIntensity,
                    renderOptions,
                    factionStyle
                );
                if (showGuides) {
                    this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                return;
            }

            const segKey = factionStyle ? null : this.resolveSegmentSpriteKey(shipModel, seg.id);
            const hasSegPng = segKey
                && typeof spriteLoader !== 'undefined'
                && spriteLoader.getSprite
                && spriteLoader.getSprite(segKey);

            if (hasSegPng) {
                ctx.save();
                if (seg.mirror) {
                    ctx.translate(sx + sw, sy);
                    ctx.scale(-1, 1);
                    spriteLoader.renderSprite(ctx, segKey, 0, 0, sw, sh, colorOverlay, overlayIntensity);
                } else {
                    spriteLoader.renderSprite(ctx, segKey, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                ctx.restore();
                if (showGuides) {
                    this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                return;
            }

            // Soft fallback: crop UV region from full ship sprite only when
            // at least one authored segment exists and the missing part needs
            // a temporary visual. Player hulls with a faction style skip this
            // entirely — each segment is generated procedurally instead.
            if (this.renderSegmentFromFullSprite(
                ctx, shipModel, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity
            )) {
                if (showGuides) {
                    this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                return;
            }

            const variantOverride = this.resolveSegmentVariantOverride(shipModel, seg.id);
            if (seg.id === 'wingLeft' || seg.id === 'wingRight') {
                this.renderProceduralWing(
                    ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
                    variantOverride, null,
                    shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.wingRotation,
                    shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.voxelScale,
                    scale
                );
            } else {
                this.renderProceduralBodyBand(
                    ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
                    variantOverride,
                    shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.voxelScale,
                    scale
                );
            }
            if (showGuides) {
                this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
            }
        });

        if (showGuides) {
            this.drawSegmentConnectors(ctx, layout, x, y, scale, colorOverlay, overlayIntensity);
        }
    },
});
