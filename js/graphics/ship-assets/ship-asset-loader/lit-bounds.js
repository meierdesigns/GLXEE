"use strict";

import { extendClass } from '../../../core/extend-class-module.js';

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    /** Column/row span of the set cells in a grid, or null when it is empty. */
    litBounds(grid) {
        if (!grid || !grid.length) return null;
        let x0 = Infinity;
        let x1 = 0;
        let y0 = Infinity;
        let y1 = 0;
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (!grid[r][c]) continue;
                if (c < x0) x0 = c;
                if (c + 1 > x1) x1 = c + 1;
                if (r < y0) y0 = r;
                if (r + 1 > y1) y1 = r + 1;
            }
        }
        return x1 > x0 && y1 > y0 ? { x0: x0, x1: x1, y0: y0, y1: y1 } : null;
    },

    drawRotatedVoxelGrid(ctx, grid, colors, x, y, width, height, angle, pivotX, pivotY, cellPx) {
        const rows = grid.length;
        const cols = grid[0].length;
        const size = cellPx || Math.max(1, Math.min(width / cols, height / rows));
        const originX = this.snapToVoxelLattice(x + (width - cols * size) * 0.5, size, 'x');
        const originY = this.snapToVoxelLattice(y + (height - rows * size) * 0.5, size, 'y');
        const cx = pivotX != null ? pivotX : x + width * 0.5;
        const cy = pivotY != null ? pivotY : y + height * 0.5;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Keep the lattice cell size — rounding up to ≥1 logical px doubled
        // fine combat cells and made rotated wings look soft / oversized.
        const d = this.getDeviceScale ? this.getDeviceScale() : 1;
        const cell = Math.max(1 / d, Math.round(size * d) / d);
        // Scan the destination area the rotated art actually reaches. Iterating
        // the unrotated grid box was fine while it spun around its own centre,
        // but a root pivot swings the span well outside that box and the tip
        // would be cut off.
        let colStart = 0;
        let colEnd = cols;
        let rowStart = 0;
        let rowEnd = rows;
        [[0, 0], [cols, 0], [0, rows], [cols, rows]].forEach(([c, r]) => {
            const dx = originX + c * size - cx;
            const dy = originY + r * size - cy;
            const rx = cx + dx * cos - dy * sin;
            const ry = cy + dx * sin + dy * cos;
            const gc = (rx - originX) / size;
            const gr = (ry - originY) / size;
            colStart = Math.min(colStart, Math.floor(gc) - 1);
            colEnd = Math.max(colEnd, Math.ceil(gc) + 1);
            rowStart = Math.min(rowStart, Math.floor(gr) - 1);
            rowEnd = Math.max(rowEnd, Math.ceil(gr) + 1);
        });
        for (let row = rowStart; row < rowEnd; row++) {
            for (let col = colStart; col < colEnd; col++) {
                const px = originX + (col + 0.5) * size;
                const py = originY + (row + 0.5) * size;
                // Nearest-neighbour: one sample at the voxel centre. The old
                // any-of-four supersample dilated every diagonal edge by a
                // voxel, so rotated wings grew ragged, uneven stair steps.
                const dx = px - cx;
                const dy = py - cy;
                const sourceCol = Math.floor((dx * cos + dy * sin + cx - originX) / size);
                const sourceRow = Math.floor((-dx * sin + dy * cos + cy - originY) / size);
                if (sourceCol < 0 || sourceCol >= cols || sourceRow < 0 || sourceRow >= rows) continue;
                const pixel = grid[sourceRow][sourceCol];
                if (!pixel) continue;
                this.fillVoxelCell(ctx, originX + col * cell, originY + row * cell, cell, cell, colors[pixel] || '#888888');
            }
        }
    },

    /**
     * Wing crop as a 0..1 window into the wing's own frame. x/y are measured
     * from the hull root, and w/h are clamped so the window always stays
     * inside the frame.
     */
    normalizeWingCrop(crop) {
        const src = crop || {};
        const cropX = Math.max(0, Math.min(0.95, Number(src.x) || 0));
        const cropY = Math.max(0, Math.min(0.95, Number(src.y) || 0));
        const w = src.w == null ? 1 : Number(src.w);
        const h = src.h == null ? 1 : Number(src.h);
        return {
            cropX: cropX,
            cropY: cropY,
            cropW: Math.max(0.05, Math.min(1 - cropX, w || 1)),
            cropH: Math.max(0.05, Math.min(1 - cropY, h || 1))
        };
    },

    /**
     * Sub-rect of a wing segment's frame that the cropped art actually covers,
     * in layout units. Mirrors the square-voxel letterboxing in
     * drawPixelGridHull plus the crop window, so selection frames, hit tests
     * and the hull connection follow the visible wing instead of its full
     * frame — otherwise cropping just leaves dead space behind.
     */
    wingVisibleRect(seg, shipModel, scale) {
        if (!seg || (seg.id !== 'wingLeft' && seg.id !== 'wingRight')) return seg;
        const loadout = shipModel && shipModel.layout && shipModel.layout.loadout;
        const voxelScale = Number(loadout && loadout.voxelScale) || 0.5;
        const zoom = Math.max(0.25, Number(scale) || 1);
        const wPx = Math.max(1, seg.width * zoom);
        const hPx = Math.max(1, seg.height * zoom);
        const prevCell = this._shipVoxelCell;
        this._shipVoxelCell = this.shipVoxelCell(shipModel, scale);
        const { resW, resH, cell } = this.hullPartResolution(wPx, hPx, voxelScale, zoom);
        this._shipVoxelCell = prevCell;
        // Same fixed voxel size the renderer uses; the grid may overhang the
        // frame slightly, centred on it.
        const gridW = (resW * cell) / wPx;
        const gridH = (resH * cell) / hPx;
        // Wings are generated without hull fragments, so the frame always
        // trims to the whole wing (no manual crop window).
        const { cropX, cropY, cropW, cropH } = this.normalizeWingCrop(null);
        const startX = seg.id === 'wingRight' ? cropX : 1 - cropX - cropW;
        // Tighten onto the voxels that survive the crop. The wing silhouette
        // rarely fills its own frame, so the crop window alone would still
        // leave a frame padded with empty space.
        const bounds = this.wingGridBounds(seg, shipModel, resW, resH,
            { x: cropX, y: cropY, w: cropW, h: cropH });
        const x0 = bounds ? bounds.x0 / resW : startX;
        const x1 = bounds ? bounds.x1 / resW : startX + cropW;
        const y0 = bounds ? bounds.y0 / resH : cropY;
        const y1 = bounds ? bounds.y1 / resH : cropY + cropH;
        return {
            id: seg.id,
            x: seg.x + seg.width * ((1 - gridW) / 2 + x0 * gridW),
            y: seg.y + seg.height * ((1 - gridH) / 2 + y0 * gridH),
            width: Math.max(0.5, seg.width * (x1 - x0) * gridW),
            height: Math.max(0.5, seg.height * (y1 - y0) * gridH)
        };
    },

    /**
     * Column/row span of the lit cells in a wing's cropped grid, or null when
     * the crop leaves nothing. Memoized because hover and hit-testing ask for
     * it on every pointer move.
     */
    wingGridBounds(seg, shipModel, resW, resH, crop) {
        const factionStyle = this.resolvePlayerFactionStyle(shipModel);
        const shapeSeed = this.resolveHullShapeSeed(shipModel);
        const override = this.resolveSegmentVariantOverride(shipModel, seg.id);
        const shapeVariant = override != null ? override : this.defaultWingVariant(shapeSeed, factionStyle);
        const key = [seg.id, resW, resH, shapeVariant, shapeSeed,
            factionStyle ? factionStyle.silhouette : '',
            crop.x, crop.y, crop.w, crop.h].join('|');
        if (!this._wingBoundsCache) this._wingBoundsCache = new Map();
        if (this._wingBoundsCache.has(key)) return this._wingBoundsCache.get(key);
        const grid = this.buildWingGrid(seg, resW, resH, factionStyle, shapeVariant);
        this.applyWingCrop(grid, seg, crop);
        let x0 = resW;
        let x1 = 0;
        let y0 = resH;
        let y1 = 0;
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (!grid[r][c]) continue;
                if (c < x0) x0 = c;
                if (c + 1 > x1) x1 = c + 1;
                if (r < y0) y0 = r;
                if (r + 1 > y1) y1 = r + 1;
            }
        }
        const out = x1 > x0 && y1 > y0 ? { x0: x0, x1: x1, y0: y0, y1: y1 } : null;
        if (this._wingBoundsCache.size > 256) this._wingBoundsCache.clear();
        this._wingBoundsCache.set(key, out);
        return out;
    },

    /**
     * Where the bridge should meet a wing's actual pixels, in layout units: the lit cell(s) of the turned wing that sit
     * nearest the hull edge (and the bridge height), so the joint grows out of the wing art itself instead of ending at
     * its geometric root. Returns null when the wing has no cells.
     */
    /** Lit cells of a wing's own grid as layout points in the wing's unturned frame, plus the cell size. Memoized. */
    wingLitCells(seg, shipModel, scale) {
        const loadout = shipModel && shipModel.layout && shipModel.layout.loadout;
        const voxelScale = Number(loadout && loadout.voxelScale) || 0.5;
        const zoom = Math.max(0.25, Number(scale) || 1);
        const wPx = Math.max(1, seg.width * zoom);
        const hPx = Math.max(1, seg.height * zoom);
        const prevCell = this._shipVoxelCell;
        this._shipVoxelCell = this.shipVoxelCell(shipModel, scale);
        const { resW, resH, cell } = this.hullPartResolution(wPx, hPx, voxelScale, zoom);
        this._shipVoxelCell = prevCell;
        const gridW = (resW * cell) / wPx;
        const gridH = (resH * cell) / hPx;
        const factionStyle = this.resolvePlayerFactionStyle(shipModel);
        const shapeSeed = this.resolveHullShapeSeed(shipModel);
        const override = this.resolveSegmentVariantOverride(shipModel, seg.id);
        const shapeVariant = override != null ? override : this.defaultWingVariant(shapeSeed, factionStyle);
        const key = [seg.id, seg.x, seg.y, seg.width, seg.height, resW, resH, shapeVariant, shapeSeed, factionStyle ? factionStyle.silhouette : ''].join('|');
        if (!this._wingLitCache) this._wingLitCache = new Map();
        if (this._wingLitCache.has(key)) return this._wingLitCache.get(key);
        const grid = this.buildWingGrid(seg, resW, resH, factionStyle, shapeVariant);
        const crop = this.normalizeWingCrop(null);
        this.applyWingCrop(grid, seg, { x: crop.cropX, y: crop.cropY, w: crop.cropW, h: crop.cropH });
        const pts = [];
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (!grid[r][c]) continue;
                pts.push([seg.x + seg.width * ((1 - gridW) / 2 + ((c + 0.5) / resW) * gridW),
                    seg.y + seg.height * ((1 - gridH) / 2 + ((r + 0.5) / resH) * gridH)]);
            }
        }
        const out = { pts: pts, cell: Math.max(0.3, (seg.width / resW) * gridW) };
        if (this._wingLitCache.size > 128) this._wingLitCache.clear();
        this._wingLitCache.set(key, out);
        return out;
    },

    /** Lit cells of a nose / core / aft grid as layout points, plus the cell size (mirrors renderProceduralBodyBand). Memoized. */
    bodyLitCells(seg, shipModel, scale) {
        const loadout = shipModel && shipModel.layout && shipModel.layout.loadout;
        const voxelScale = Number(loadout && loadout.voxelScale) || 0.5;
        const zoom = Math.max(0.25, Number(scale) || 1);
        const wPx = Math.max(1, seg.width * zoom);
        const hPx = Math.max(1, seg.height * zoom);
        const prevCell = this._shipVoxelCell;
        this._shipVoxelCell = this.shipVoxelCell(shipModel, scale);
        const res = this.hullPartResolution(wPx, hPx, voxelScale, zoom);
        this._shipVoxelCell = prevCell;
        const resW = res.resW + (res.resW % 2);
        const resH = res.resH;
        const cell = res.cell;
        const gridW = (resW * cell) / wPx;
        const gridH = (resH * cell) / hPx;
        const factionStyle = this.resolvePlayerFactionStyle(shipModel);
        const shapeSeed = this.resolveHullShapeSeed(shipModel);
        const override = this.resolveSegmentVariantOverride(shipModel, seg.id);
        const variant = override != null ? override : this.hullShapeVariantIndex(shapeSeed, seg.id, this.bodyShapeVariantCount(seg.id), factionStyle);
        const key = [seg.id, seg.x, seg.y, seg.width, seg.height, resW, resH, variant, shapeSeed, factionStyle ? factionStyle.silhouette : ''].join('|');
        if (!this._bodyLitCache) this._bodyLitCache = new Map();
        if (this._bodyLitCache.has(key)) return this._bodyLitCache.get(key);
        let grid;
        if (seg.id === 'front') grid = this.buildNoseGrid(resW, resH, factionStyle, variant);
        else if (seg.id === 'back') grid = this.buildAftGrid(resW, resH, factionStyle, variant);
        else grid = this.buildCenterGrid(resW, resH, factionStyle, variant);
        const pts = [];
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (!grid[r][c]) continue;
                pts.push([seg.x + seg.width * ((1 - gridW) / 2 + ((c + 0.5) / resW) * gridW),
                    seg.y + seg.height * ((1 - gridH) / 2 + ((r + 0.5) / resH) * gridH)]);
            }
        }
        const out = { pts: pts, cell: Math.max(0.3, (seg.width / resW) * gridW) };
        if (this._bodyLitCache.size > 128) this._bodyLitCache.clear();
        this._bodyLitCache.set(key, out);
        return out;
    },

    wingBridgeEnd(seg, shipModel, scale, hullEdgeX, hullY) {
        const lit = this.wingLitCells(seg, shipModel, scale);
        const loadout = shipModel && shipModel.layout && shipModel.layout.loadout;
        const resW = Math.max(1, Math.round(seg.width / lit.cell));
        const left = seg.id === 'wingLeft';
        const deg = Math.max(-180, Math.min(180, Number(loadout && loadout.wingRotation) || 0));
        const a = deg * Math.PI / 180 * (left ? -1 : 1);
        const cos = Math.cos(a), sin = Math.sin(a);
        const pivot = this.wingAttachPoint(seg, shipModel, scale);
        const cells = [];
        let sx = 0, sy = 0;
        lit.pts.forEach((q) => {
            const dx = q[0] - pivot.x, dy = q[1] - pivot.y;
            const x = pivot.x + dx * cos - dy * sin, y = pivot.y + dx * sin + dy * cos;
            cells.push([x, y]);
            sx += x; sy += y;
        });
        if (!cells.length) return null;
        // Nearest to the hull edge horizontally; the bridge height breaks ties.
        const score = (p) => Math.abs(p[0] - hullEdgeX) + 0.2 * Math.abs(p[1] - hullY);
        let best = Infinity;
        cells.forEach((p) => { const v = score(p); if (v < best) best = v; });
        const near = cells.filter((p) => score(p) <= best + lit.cell * 1.6);
        let ex = 0, ey = 0;
        near.forEach((p) => { ex += p[0]; ey += p[1]; });
        ex /= near.length; ey /= near.length;
        // Pushed a little into the wing, toward its middle, so the wing's own outline closes the seam.
        const mx = sx / cells.length, my = sy / cells.length;
        const len = Math.max(0.0001, Math.hypot(mx - ex, my - ey));
        const push = lit.cell * 1.2;
        return { x: ex + (mx - ex) / len * push, y: ey + (my - ey) / len * push };
    },

    /**
     * Where the hull connection meets a wing, in layout units. The wing art is
     * rotated about its frame centre, so the root edge swings with it — the
     * bridge has to follow or it ends in empty space beside a tilted wing.
     */
    wingAttachPoint(seg, shipModel, scale) {
        const vis = this.wingVisibleRect(seg, shipModel, scale);
        // This point is also the rotation pivot, so it stays put at any wing
        // angle and the bridge never has to chase a swinging root.
        return {
            x: seg.id === 'wingLeft' ? vis.x + vis.width : vis.x,
            y: vis.y + vis.height * 0.5
        };
    },

    applyWingCrop(grid, seg, crop) {
        if (!grid || !grid.length || !crop) return;
        const rows = grid.length;
        const cols = grid[0].length;
        const { cropX, cropY, cropW, cropH } = this.normalizeWingCrop(crop);
        const right = seg && seg.id === 'wingRight';
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const nx = (col + 0.5) / cols;
                const ny = (row + 0.5) / rows;
                // The crop origin follows the hull connection: the left wing
                // is cropped from its right/root edge, the right wing from
                // its left/root edge. This keeps both wings aligned to the
                // same attachment direction.
                const inX = right
                    ? nx >= cropX && nx <= cropX + cropW
                    : nx >= 1 - cropX - cropW && nx <= 1 - cropX;
                if (!inX || ny < cropY || ny > cropY + cropH) {
                    grid[row][col] = 0;
                }
            }
        }
    },

    // Base tip geometry per shape variant: reach (0-1.3, how far the tip extends
    // from root toward the outer edge), center/spread (vertical opening as a
    // fraction of height). Faction silhouette nudges these further below.
    /**
     * Wing styles. Each planform maps span position u (0 = hull root,
     * 1 = tip) to the row band(s) [lead, trail] the wing covers, as fractions
     * of the wing frame (0 = front, 1 = aft). Return null for no wing there.
     */
    /**
     * Seeded default wing shape, drawn from the faction's focus pool
     * (style.focus.parts.wing, by id) — e.g. Kronax claws rake forward,
     * Machine wings are missile racks. A shape the player picks in the
     * hangar still overrides this.
     */
    defaultWingVariant(shapeSeed, factionStyle) {
        return this.hullShapeVariantIndex(shapeSeed, 'wingLeft', this.wingShapeVariants.length, factionStyle);
    },

    get wingShapeVariants() {
        return [
            { id: 'delta', label: 'DELTA', planform: (u) => [0.1 + 0.7 * u, 1] },
            { id: 'swept', label: 'SWEPT', planform: (u) => [0.04 + 0.62 * u, Math.min(1, 0.7 + 0.3 * u)] },
            { id: 'stub', label: 'STUB', planform: (u) => (u > 0.65 ? null : [0.16 + 0.2 * u, 0.94 - 0.14 * u]) },
            { id: 'bat', label: 'BAT', planform: (u) => [0.06 + 0.5 * u, 1 - 0.3 * Math.abs(Math.sin(u * Math.PI * 1.5))] },
            { id: 'forward', label: 'FORWARD', planform: (u) => [Math.max(0, 0.4 - 0.4 * u), 0.96 - 0.5 * u] },
            { id: 'twin', label: 'TWIN FIN', planform: (u) => (u < 0.25
                ? [0.08, 0.96]
                : [[0.06 + 0.26 * u, 0.46 + 0.06 * u], [0.54 + 0.26 * u, 1]]) },
            { id: 'plank', label: 'PLANK', planform: (u) => [0.24 + 0.16 * u, 0.86 - 0.04 * u] },
            { id: 'lance', label: 'LANCE', planform: (u) => (u < 0.3
                ? [0.08 + 0.6 * u, 0.96 - 0.3 * u]
                : [0.26 + 0.14 * u, 0.74 - 0.02 * u]) },
            { id: 'crescent', label: 'CRESCENT', planform: (u) => [0.1 + 0.55 * u * u, 1 - 0.55 * u * u] },
            { id: 'box', label: 'BOX', planform: (u) => (u > 0.8 ? [0.1, 0.9] : [0.3, 0.7]) },
            { id: 'razor', label: 'RAZOR', planform: (u) => [0.02 + 0.9 * u, Math.min(1, 0.22 + 0.9 * u)] },
            { id: 'hook', label: 'HOOK', planform: (u) => (u < 0.7
                ? [0.2 + 0.3 * u, 0.9 - 0.2 * u]
                : [0.02 + 0.2 * (1 - u), 0.72]) },
            { id: 'ddelta', label: 'DOUBLE DELTA', planform: (u) => [u < 0.4 ? 0.1 + 1.2 * u : 0.58 + 0.25 * u, 1] },
            { id: 'ladder', label: 'LADDER', planform: (u) => (u < 0.2
                ? [0.08, 0.96]
                : [[0.08, 0.3], [0.44, 0.62], [0.78, 0.96]]) }
        ];
    },

    /**
     * Per-row silhouette bend applied on top of a part's base taper so each
     * faction's hull reads as a distinct shape family, not just a recolor:
     * `t` runs 0..1 along the part's length, `seedIndex` offsets the pattern
     * per part (nose/wing/aft) so their notches don't all land on the same
     * row. Returns a width multiplier and a sideways center offset.
     */
    factionRowProfile(silhouette, t, seedIndex) {
        // factionShipStyles.styleStrength exaggerates (or flattens) the bend.
        const k = this.factionStyleStrength();
        const p = this.baseFactionRowProfile(silhouette, t, seedIndex);
        return {
            widthMul: Math.max(0.18, Math.min(1.25, 1 + (p.widthMul - 1) * k)),
            offsetMul: p.offsetMul * Math.min(k, 1)
        };
    },

    factionStyleStrength() {
        return (typeof factionShipStyles !== 'undefined' && factionShipStyles.getStyleStrength)
            ? factionShipStyles.getStyleStrength() : 1;
    },

    baseFactionRowProfile(silhouette, t, seedIndex) {
        const tt = Math.max(0, Math.min(1, t));
        if (silhouette === 'modular') {
            // Few, deep terraces — a blocky stepped tower, widest at the base.
            const steps = 3;
            const q = Math.round(tt * steps) / steps;
            return { widthMul: 0.5 + q * 0.5, offsetMul: 0 };
        }
        if (silhouette === 'spikes') {
            // Wedge with one or two big swept barbs — a blade, not a comb.
            // (Row-by-row serrations read as stripes, not as a shape.)
            const barbs = seedIndex === 4 ? 1 : 2;
            const saw = ((tt * barbs + seedIndex * 0.13) % 1);
            const wedge = 0.55 + 0.45 * tt;
            return { widthMul: wedge * (0.8 + saw * 0.35), offsetMul: 0 };
        }
        if (silhouette === 'rings') {
            // Strong convex belly pinched hard at both ends — a hollow pod.
            return { widthMul: 0.3 + 0.82 * Math.sin(tt * Math.PI), offsetMul: 0 };
        }
        if (silhouette === 'scrap') {
            // Welded salvage: big irregular steps (patches stay lopsided), body centred on the axis.
            // Two or three large bolted-on blocks per part (low frequency).
            // Width is held per third of the part, so each block is several
            // voxel rows tall (single odd rows read as loose stripes).
            const block = Math.min(2, Math.floor(tt * 3));
            const jitter = Math.sin((block * 0.9 + seedIndex * 1.7) * 3.1) * 0.5 + 0.5;
            const chunk = Math.round(jitter * 2) / 2;
            // Irregular widths, but every row stays centred on the hull axis (no sideways drift off the axis).
            // The core (seedIndex 4) must still read as one fuselage: a shallow floor keeps it from
            // pinching into a waist that reads as an "H" — that lopsidedness belongs on the wings instead.
            const floor = seedIndex === 4 ? 0.82 : 0.62;
            const span = seedIndex === 4 ? 0.26 : 0.45;
            return { widthMul: floor + chunk * span, offsetMul: 0 };
        }
        if (silhouette === 'circuit') {
            // Rigid slab with deep rectangular notches cut at fixed intervals —
            // machined, symmetric, nothing organic about the outline.
            // One machined notch band per part, not a comb of them.
            const notch = tt > 0.42 && tt < 0.58 ? 0.72 : 1;
            return { widthMul: notch, offsetMul: 0 };
        }
        return { widthMul: 1, offsetMul: 0 };
    },
});
