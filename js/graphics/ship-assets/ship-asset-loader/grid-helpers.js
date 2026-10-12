"use strict";

import { extendClass } from '../../../core/extend-class-module.js';

import { ShipAssetLoader } from './core.js';

extendClass(ShipAssetLoader, {
    applyFactionPlatingPattern(g, silhouette, seedIndex = 0, flipX = false) {
        const rows = g.length;
        const cols = rows ? g[0].length : 0;
        for (let r = 0; r < rows; r++) {
            for (let cc = 0; cc < cols; cc++) {
                if (g[r][cc] !== 2) continue;
                // flipX runs the pattern mirrored, so a left wing is the exact
                // mirror image of the right one.
                const c = flipX ? cols - 1 - cc : cc;
                // Sparse panel seams only: full-coverage patterns made the
                // faction read as a texture instead of by its shape.
                if (silhouette === 'modular') {
                    // Rectangular plates: a seam every 4 rows, staggered joints.
                    if (r % 4 === 3) g[r][cc] = 4;
                    else if ((c + Math.floor(r / 4) * 3) % 7 === 0) g[r][cc] = 4;
                } else if (silhouette === 'spikes') {
                    // Single swept seam lines along the blade.
                    if ((c + r + seedIndex) % 7 === 0) g[r][cc] = 4;
                } else if (silhouette === 'rings') {
                    // Thin shell lines around the part's centre.
                    const dy = (r - rows / 2) / Math.max(1, rows / 2);
                    const dx = (c - cols / 2) / Math.max(1, cols / 2);
                    const d = Math.sqrt(dx * dx + dy * dy) * 3;
                    if (d % 1 < 0.22 && d > 0.8) g[r][cc] = 4;
                } else if (silhouette === 'scrap') {
                    // A few mismatched welded panels.
                    const block = Math.floor(r / 3) * 31 + Math.floor(c / 4) * 17 + seedIndex * 7;
                    const h = (Math.imul(block, 2654435761) >>> 0) % 9;
                    if (h === 0) g[r][cc] = 4;
                    else if (h === 1) g[r][cc] = 5;
                } else if (silhouette === 'circuit') {
                    // A few bright traces with right-angle turns.
                    if (c % 6 === 2 && r % 8 < 5) g[r][cc] = 5;
                    else if (r % 8 === 5 && c % 6 >= 2 && c % 6 <= 4) g[r][cc] = 5;
                }
            }
        }
    },

    /**
     * Target on-screen size (actual device px) of one hull-part "pixel" cell.
     * Deriving it from the segment's already-scaled on-screen w/h keeps every
     * part's cell size pinned to this same constant regardless of zoom or how
     * big that particular part is — uniform across the whole ship — and it
     * recomputes (more/fewer cells) every render call as parts are scaled or
     * moved, since it always reads the current w/h.
     */
    /**
     * Copy the left half of a grid onto the right, mirrored, so parts that
     * sit on the ship's centre line (nose, core, aft) are symmetric.
     */
    mirrorGridLeftToRight(g) {
        for (let r = 0; r < g.length; r++) {
            const row = g[r];
            const cols = row.length;
            for (let c = 0; c < Math.floor(cols / 2); c++) row[cols - 1 - c] = row[c];
        }
        return g;
    },

    get HULL_PIXEL_CELL_PX() {
        // Fixed default cell (no longer shrunk per smallest part, so it has
        // to be fine on its own — 4 read far too coarse).
        return 2;
    },

    /**
     * Ship-wide voxel size in pixels. The default size (factor 1) is the
     * target cell, independent of part sizes so resizing a part never changes
     * the resolution. voxelScale is a plain size factor on that default:
     * 2 = voxels twice as big, 0.5 = half. It used to divide the target
     * before the cap, so for most ships the slider changed nothing.
     */
    shipVoxelCell(shipModel, scale) {
        // Hangar zoom magnifies an image voxelised at the fit scale; at any
        // other scale report that same grid, proportionally, so hit tests
        // and handles line up with what is shown.
        const refInfo = this._voxelRef;
        const ref = refInfo && refInfo.model === shipModel ? refInfo.scale : 0;
        if (ref && scale && Math.abs(scale - ref) > 0.001) {
            return this.shipVoxelCellAt(shipModel, ref) * scale / ref;
        }
        return this.shipVoxelCellAt(shipModel, scale);
    },

    shipVoxelCellAt(shipModel, scale) {
        // Playfield VOXEL mode: one absolute cell for every ship/module so the
        // lattice matches terrain / obstacles / debris.
        let global = Number(this.globalVoxelCell);
        // The hangar bay sizes voxels from the ship's own voxel slider, not
        // from the playfield's shared lattice.
        const hangarRef = this._voxelRef;
        const inHangar = !!(hangarRef && hangarRef.model === shipModel);
        if (inHangar) global = NaN;
        if (!inHangar && !(Number.isFinite(global) && global > 0)
            && typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.cell) {
            const shared = Number(window.combatVoxels.cell());
            if (Number.isFinite(shared) && shared > 0) global = shared;
        }
        if (!inHangar && !(Number.isFinite(global) && global > 0)) {
            const fromWin = Number(typeof window !== 'undefined' ? window.PLAYFIELD_VOXEL_CELL : NaN);
            if (Number.isFinite(fromWin) && fromWin > 0
                && typeof uiAppearanceManager !== 'undefined'
                && String(uiAppearanceManager.shipRenderStyle || '').toUpperCase() === 'VOXEL') {
                global = fromWin;
            }
        }
        if (Number.isFinite(global) && global > 0) {
            const d = this.getDeviceScale();
            return Math.max(1 / d, Math.round(global * d) / d);
        }
        const layout = shipModel && shipModel.layout;
        const loadout = layout && layout.loadout;
        const zoom = Math.max(0.25, Number(scale) || 1);
        const factor = Math.max(0.2, Math.min(1.5, Number(loadout && loadout.voxelScale) || 0.5));
        // Voxel size depends only on zoom and the ship's voxel setting — not
        // on part sizes. Deriving it from the smallest part made the whole
        // ship's resolution jump whenever one part was resized.
        // deviceScale: backing pixels per logical unit (supersampled
        // playfield); voxelDetail < 1 packs more voxels into a ship. Both
        // default to 1, so hangar and editors are unchanged.
        const d = this.getDeviceScale();
        const detail = Math.max(0.25, Math.min(1, Number(this.voxelDetail) || 1));
        return Math.max(1, Math.round(this.HULL_PIXEL_CELL_PX * zoom * factor * detail * d)) / d;
    },

    getDeviceScale() {
        const d = Number(this.deviceScale);
        return Number.isFinite(d) && d >= 1 ? d : 1;
    },

    /** Round to the nearest whole backing pixel (logical units). */
    devicePx(v) {
        const d = this.getDeviceScale();
        return Math.round(v * d) / d;
    },

    hullPartResolution(w, h, voxelScale = 1, pixelZoom = 1) {
        // One whole-pixel voxel size for the entire ship: every part (and the
        // wing bridges) is drawn with this exact cell, so voxels never differ
        // in size between nose, body, wings and joints.
        const d = this.getDeviceScale();
        const cell = this._shipVoxelCell || Math.max(1, Math.round(this.HULL_PIXEL_CELL_PX
            * Math.max(0.25, Number(pixelZoom) || 1)
            * Math.max(0.2, Math.min(1.5, Number(voxelScale) || 0.5)) * d)) / d;
        return {
            resW: Math.max(6, Math.round(w / cell)),
            resH: Math.max(6, Math.round(h / cell)),
            cell: cell
        };
    },

    /**
     * Row width with the same parity as the grid, so a centred row has equal
     * margins on both sides instead of leaning one voxel to a side.
     */
    evenSpan(cols, width) {
        if ((cols - width) % 2 === 0) return width;
        return width < cols ? width + 1 : width - 1;
    },

    blankGrid(cols, rows) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    },

    gridFillRect(g, c0, r0, cw, rh, val) {
        const rows = g.length;
        const cols = g[0].length;
        const r1 = Math.min(rows, Math.round(r0 + rh));
        const c1 = Math.min(cols, Math.round(c0 + cw));
        for (let r = Math.max(0, Math.round(r0)); r < r1; r++) {
            for (let c = Math.max(0, Math.round(c0)); c < c1; c++) {
                g[r][c] = val;
            }
        }
    },

    /**
     * Turns any filled (index 2) cell that touches an empty neighbor into an
     * edge (index 1) cell — a cheap, shape-agnostic way to give every part a
     * dark outline (like real pixel-art sprites) without hand-authoring one
     * per shape.
     */
    outlineGridEdges(g, openSide = null) {
        const rows = g.length;
        const cols = g[0].length;
        const src = g.map((row) => row.slice());
        // openSide ('left' | 'right'): that grid border continues into
        // another part (a wing's root), so it gets no outline there.
        const pastLeft = openSide === 'left' ? 2 : 0;
        const pastRight = openSide === 'right' ? 2 : 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (src[r][c] !== 2) continue;
                const up = r > 0 ? src[r - 1][c] : 0;
                const down = r < rows - 1 ? src[r + 1][c] : 0;
                const leftN = c > 0 ? src[r][c - 1] : pastLeft;
                const rightN = c < cols - 1 ? src[r][c + 1] : pastRight;
                if (!up || !down || !leftN || !rightN) g[r][c] = 1;
            }
        }
    },

    /**
     * Each hull part (wing/nose/aft/core) is its own procedural pixel-index
     * grid, built fresh from its live on-screen w/h every render call — the
     * faction silhouette id bends the shape so each faction reads distinct.
     * Drawn with drawPixelGridHull (plain axis-aligned fillRect per cell),
     * never a vector path or an image-scaled bitmap, so it's never blurred
     * or anti-aliased — a real pixel-art sprite, not a stretched drawing.
     */
    renderProceduralWing(
        ctx, seg, x, y, w, h, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
        variantOverride = null, crop = null, rotation = 0, voxelScale = 1, pixelZoom = 1
    ) {
        const { resW, resH, cell } = this.hullPartResolution(w, h, voxelScale, pixelZoom);
        let shapeVariant;
        if (variantOverride != null) {
            shapeVariant = variantOverride;
        } else {
            shapeVariant = this.defaultWingVariant(shapeSeed, factionStyle);
        }
        const grid = this.buildWingGrid(seg, resW, resH, factionStyle, shapeVariant);
        this.applyWingCrop(grid, seg, crop);
        const colors = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        const angle = Math.max(-180, Math.min(180, Number(rotation) || 0)) * Math.PI / 180;
        if (Math.abs(angle) < 0.001) {
            this.drawPixelGridHull(ctx, grid, colors, x, y, w, h, cell);
        } else {
            // A wing swings from where it meets the hull, not from its own
            // middle, so the root stays put and only the span sweeps.
            const bounds = this.litBounds(grid);
            let pivotX = null;
            let pivotY = null;
            if (bounds) {
                const size = cell;
                const originX = this.snapToVoxelLattice(x + (w - grid[0].length * size) * 0.5, size, 'x');
                const originY = this.snapToVoxelLattice(y + (h - grid.length * size) * 0.5, size, 'y');
                const isLeft = seg.id === 'wingLeft';
                pivotX = originX + (isLeft ? bounds.x1 : bounds.x0) * size;
                pivotY = originY + (bounds.y0 + bounds.y1) * 0.5 * size;
            }
            this.drawRotatedVoxelGrid(
                ctx, grid, colors, x, y, w, h,
                angle * (seg.id === 'wingLeft' ? -1 : 1),
                pivotX, pivotY, cell
            );
        }
    },
});
