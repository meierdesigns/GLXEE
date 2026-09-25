"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    renderSegmentFromFullSprite(ctx, shipModel, seg, x, y, w, h, colorOverlay, overlayIntensity) {
        const rawUv = seg.uv || (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.segmentUv
            && shipLoadoutManager.segmentUv[
                seg.id === 'wingLeft' || seg.id === 'wingRight' ? 'wing' : seg.id
            ]);
        const uv = this.getEdgeCropForSegment(seg, rawUv);
        if (!uv) return false;

        const spriteName = this.getSpriteNameForShip(shipModel);
        const png = spriteName
            && typeof spriteLoader !== 'undefined'
            && spriteLoader.getSprite
            && spriteLoader.getSprite(spriteName);

        if (png) {
            const srcW = png.width;
            const srcH = png.height;
            let sx = Math.floor(uv.x * srcW);
            let sy = Math.floor(uv.y * srcH);
            let sw = Math.max(1, Math.floor(uv.w * srcW));
            let sh = Math.max(1, Math.floor(uv.h * srcH));
            // Stretch the authored crop into the full segment frame so scaled
            // wings/body never leave empty cells inside their bounds.
            const drawW = Math.max(1, Math.round(w));
            const drawH = Math.max(1, Math.round(h));
            const drawX = Math.round(x);
            const drawY = Math.round(y);
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (seg.mirror) {
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(png, sx, sy, sw, sh, 0, 0, drawW, drawH);
            } else {
                ctx.drawImage(png, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
            }
            // Apply grayscale tint overlay if needed
            if (colorOverlay && overlayIntensity > 0 && typeof spriteLoader.renderSprite === 'function') {
                // Soft overlay pass via destination-in is complex; skip — hull tint applied globally elsewhere
            }
            ctx.restore();
            return true;
        }

        // Pixel-grid crop
        const sprite = shipModel.sprite;
        if (!sprite || !sprite.length || !sprite[0]) return false;
        const cols = sprite[0].length;
        const rows = sprite.length;
        let c0 = Math.floor(uv.x * cols);
        let r0 = Math.floor(uv.y * rows);
        let cw = Math.max(1, Math.floor(uv.w * cols));
        let rh = Math.max(1, Math.floor(uv.h * rows));
        const colors = shipModel.colors || {};
        const resolve = (color) => {
            if (!color || color === 'transparent') return color;
            if (typeof color === 'string' && color.indexOf('var(') === 0) {
                const match = color.match(/var\(\s*(--[^),\s]+)/);
                if (match) {
                    const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                    if (value) return value;
                }
                return '#888888';
            }
            return color;
        };
        // Cover the full segment: leftover edge pixels get an extra cell.
        ctx.save();
        if (seg.mirror) {
            ctx.translate(x + w, y);
            ctx.scale(-1, 1);
            x = 0;
            y = 0;
        }
        for (let r = 0; r < rh; r++) {
            const row = sprite[r0 + r];
            if (!row) continue;
            const top = Math.floor(y + (r * h) / rh);
            const bottom = Math.floor(y + ((r + 1) * h) / rh);
            for (let c = 0; c < cw; c++) {
                const pixel = row[c0 + c];
                if (!pixel) continue;
                let fill = resolve(colors[pixel] || '#888888');
                fill = this.tintPixelColor(fill, colorOverlay, overlayIntensity);
                ctx.fillStyle = fill;
                const left = Math.floor(x + (c * w) / cw);
                const right = Math.floor(x + ((c + 1) * w) / cw);
                ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
            }
        }
        ctx.restore();
        return true;
    },

    /** Indexed palette for a hull part: 0 transparent, 1 edge, 2 hull, 3 accent. */
    buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle) {
        const edgeBase = factionStyle ? factionStyle.edge : '#1e221c';
        const hullBase = factionStyle ? factionStyle.hull : '#5a6350';
        const accentBase = factionStyle ? factionStyle.accent : '#a8b090';
        return {
            0: 'transparent',
            1: this.applyHullOverlayHex(edgeBase, colorOverlay, overlayIntensity, 0),
            2: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, 0),
            3: this.applyHullOverlayHex(accentBase, colorOverlay, overlayIntensity, 8),
            // Two extra hull tones carry the faction plating pattern. Without
            // them a part's interior is a single flat fill.
            4: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, -26),
            5: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, 22)
        };
    },

    /**
     * Stamp a faction's surface plating into a part's interior. Only hull
     * cells are touched, so the silhouette and its outline survive, and it
     * runs before each part's own accent marks so those stay on top.
     */
    applyFactionPlating(g, silhouette, seedIndex = 0) {
        const rows = g.length;
        const cols = rows ? g[0].length : 0;
        if (rows < 3 || cols < 3) return;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (g[r][c] !== 2) continue;
                if (silhouette === 'modular') {
                    // Brick courses with staggered vertical seams.
                    if (r % 3 === 2) g[r][c] = 4;
                    else if ((c + Math.floor(r / 3) * 2) % 5 === 0) g[r][c] = 4;
                } else if (silhouette === 'spikes') {
                    // Diagonal blade banding.
                    if ((c + r + seedIndex) % 4 < 2) g[r][c] = 4;
                } else if (silhouette === 'rings') {
                    // Concentric shells around the part's centre.
                    const dy = (r - rows / 2) / Math.max(1, rows / 2);
                    const dx = (c - cols / 2) / Math.max(1, cols / 2);
                    if (Math.floor(Math.sqrt(dx * dx + dy * dy) * 3.5) % 2 === 1) g[r][c] = 4;
                } else if (silhouette === 'scrap') {
                    // Mismatched welded panels on an irregular block grid.
                    const block = Math.floor(r / 2) * 31 + Math.floor(c / 3) * 17 + seedIndex * 7;
                    const h = (Math.imul(block, 2654435761) >>> 0) % 7;
                    if (h < 2) g[r][c] = 4;
                    else if (h === 2) g[r][c] = 5;
                } else if (silhouette === 'circuit') {
                    // Dark substrate with bright vertical traces.
                    if (c % 4 === 1) g[r][c] = 5;
                    else if (r % 3 === 0) g[r][c] = 4;
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
    get HULL_PIXEL_CELL_PX() {
        return 4;
    },

    /**
     * Ship-wide voxel size in pixels: the hull's voxelScale target, shrunk
     * until even the smallest part gets at least 6 cells to show its shape.
     */
    shipVoxelCell(shipModel, scale) {
        const layout = shipModel && shipModel.layout;
        const loadout = layout && layout.loadout;
        const zoom = Math.max(0.25, Number(scale) || 1);
        const target = this.HULL_PIXEL_CELL_PX * zoom
            / Math.max(0.1, Math.min(10, Number(loadout && loadout.voxelScale) || 1));
        let smallest = Infinity;
        ((layout && layout.segments) || []).forEach((seg) => {
            if (['front', 'center', 'back', 'wingLeft', 'wingRight'].indexOf(seg.id) === -1) return;
            smallest = Math.min(smallest, seg.width * zoom, seg.height * zoom);
        });
        const fit = Number.isFinite(smallest) ? smallest / 6 : target;
        return Math.max(1, Math.floor(Math.min(target, fit)));
    },

    hullPartResolution(w, h, voxelScale = 1, pixelZoom = 1) {
        // One whole-pixel voxel size for the entire ship: every part (and the
        // wing bridges) is drawn with this exact cell, so voxels never differ
        // in size between nose, body, wings and joints.
        const cell = this._shipVoxelCell || Math.max(1, Math.round(this.HULL_PIXEL_CELL_PX
            * Math.max(0.25, Number(pixelZoom) || 1)
            / Math.max(0.1, Math.min(10, Number(voxelScale) || 1))));
        return {
            resW: Math.max(6, Math.round(w / cell)),
            resH: Math.max(6, Math.round(h / cell)),
            cell: cell
        };
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
    outlineGridEdges(g) {
        const rows = g.length;
        const cols = g[0].length;
        const src = g.map((row) => row.slice());
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (src[r][c] !== 2) continue;
                const up = r > 0 ? src[r - 1][c] : 0;
                const down = r < rows - 1 ? src[r + 1][c] : 0;
                const leftN = c > 0 ? src[r][c - 1] : 0;
                const rightN = c < cols - 1 ? src[r][c + 1] : 0;
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
            shapeVariant = this.hullShapeVariantIndex(
                shapeSeed,
                seg.id === 'wingRight' ? 'wingLeft' : seg.id,
                this.wingShapeVariants.length
            );
        }
        const grid = this.buildWingGrid(seg, resW, resH, factionStyle, shapeVariant);
        this.applyWingCrop(grid, seg, crop);
        const colors = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        const angle = Math.max(-60, Math.min(60, Number(rotation) || 0)) * Math.PI / 180;
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
                const originX = Math.round(x + (w - grid[0].length * size) * 0.5);
                const originY = Math.round(y + (h - grid.length * size) * 0.5);
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
