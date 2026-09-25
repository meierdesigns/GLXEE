"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    buildWingGrid(seg, cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const left = seg.id === 'wingLeft';
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const base = this.wingShapeVariants[shapeVariant || 0] || this.wingShapeVariants[0];
        let reach = base.reach;
        let center = base.center;
        let spread = base.spread;
        if (silhouette === 'spikes') {
            reach *= 1.3;
            spread *= 0.5;
        } else if (silhouette === 'scrap') {
            spread *= 1.35;
        }
        // Root spar (fuselage-facing strip) tapers out to `reach` at the tip band.
        for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 0.5 : r / (rows - 1);
            const dist = Math.abs(t - center) / Math.max(0.08, spread);
            const taper = Math.max(0, 1 - dist);
            let widthFrac;
            if (shapeVariant === 1) {
                // Swept blade: narrow root with a strong diagonal tip.
                widthFrac = 0.04 + taper * 0.82;
            } else if (shapeVariant === 2) {
                // Stub/fork: compact wing with a blunt central shoulder.
                widthFrac = 0.12 + taper * 0.58;
            } else if (shapeVariant === 3) {
                // Bat wing: two broad lobes with a shallow center notch.
                const lobe = Math.max(0, 1 - Math.abs(Math.abs(t - 0.5) - 0.22) / 0.18);
                widthFrac = 0.04 + lobe * 0.86;
            } else if (shapeVariant === 4) {
                // Gull wing: broad upper sweep with a raised outer tip.
                widthFrac = 0.06 + Math.max(0, taper * (0.72 + (0.5 - t) * 0.42));
            } else {
                // Delta: broad triangular wing.
                widthFrac = 0.05 + taper * Math.max(0, reach - 0.05);
            }
            const prof = this.factionRowProfile(silhouette, t, left ? 1 : 2);
            widthFrac = Math.min(1, widthFrac * prof.widthMul);
            // The default modular faction must still read as a wing: its
            // silhouette profile is for body plates and otherwise widens the
            // wing into a rectangular bar.
            if (silhouette === 'modular') widthFrac *= 0.58;
            const width = Math.max(1, Math.round(cols * widthFrac));
            if (left) this.gridFillRect(g, cols - width, r, width, 1, 2);
            else this.gridFillRect(g, 0, r, width, 1, 2);
        }
        this.outlineGridEdges(g);
        this.applyFactionPlating(g, silhouette, left ? 1 : 2);
        // Slim wing rail accent: keep it attached to the wing silhouette
        // instead of rendering a large rectangular block over the wing.
        const railR0 = Math.round(rows * 0.22);
        const railH = Math.max(1, Math.round(rows * 0.56));
        for (let r = railR0; r < railR0 + railH; r++) {
            const t = railH <= 1 ? 0 : (r - railR0) / (railH - 1);
            const railC = left
                ? cols - 1 - Math.round(t * Math.max(0, cols * 0.12))
                : Math.round(t * Math.max(0, cols * 0.12));
            this.gridFillRect(g, railC, r, 1, 1, 3);
        }
        if (silhouette === 'rings') {
            const holeC = Math.round(cols * (left ? 0.58 : 0.42));
            const holeR = Math.max(1, Math.round(Math.min(cols, rows) * 0.18));
            this.gridFillRect(g, holeC - holeR / 2, rows * 0.5 - holeR / 2, holeR, holeR, 0);
        } else if (silhouette === 'circuit') {
            this.gridFillRect(g, Math.round(cols * (left ? 0.68 : 0.18)), Math.round(rows * 0.15), 1, Math.max(1, Math.round(rows * 0.12)), 1);
            this.gridFillRect(g, Math.round(cols * (left ? 0.32 : 0.6)), Math.round(rows * 0.75), 1, Math.max(1, Math.round(rows * 0.12)), 1);
        }
        return g;
    },

    /** Number of shape variants available for a given body-band segment id. */
    bodyShapeVariantCount(segId) {
        if (segId === 'front' || segId === 'back') return 3;
        return 2;
    },

    renderProceduralBodyBand(
        ctx, seg, x, y, w, h, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
        variantOverride = null, voxelScale = 1, pixelZoom = 1
    ) {
        const { resW, resH, cell } = this.hullPartResolution(w, h, voxelScale, pixelZoom);
        let shapeVariant;
        if (variantOverride != null) {
            shapeVariant = variantOverride;
        } else {
            shapeVariant = this.hullShapeVariantIndex(shapeSeed, seg.id, this.bodyShapeVariantCount(seg.id));
        }
        const colors = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        let grid;
        if (seg.id === 'front') grid = this.buildNoseGrid(resW, resH, factionStyle, shapeVariant);
        else if (seg.id === 'back') grid = this.buildAftGrid(resW, resH, factionStyle, shapeVariant);
        else grid = this.buildCenterGrid(resW, resH, factionStyle, shapeVariant);
        this.drawPixelGridHull(ctx, grid, colors, x, y, w, h, cell);
    },

    buildNoseGrid(cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const variant = shapeVariant || 0;
        for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 1 : r / (rows - 1); // 0 apex .. 1 base
            let widthFrac;
            if (variant === 1) {
                widthFrac = 0.55 + t * 0.45; // blunt: wide from the start
            } else if (variant === 2) {
                const bump = Math.abs(Math.sin(Math.min(1, t * 1.6) * Math.PI));
                widthFrac = 0.25 + t * 0.55 + bump * 0.18; // forked twin prong
            } else {
                widthFrac = 0.1 + t * 0.9; // pointed
            }
            const prof = this.factionRowProfile(silhouette, t, 0);
            widthFrac *= prof.widthMul;
            const width = Math.max(1, Math.round(cols * Math.min(1, widthFrac)));
            let c0 = Math.round((cols - width) / 2 + prof.offsetMul * cols);
            c0 = Math.max(0, Math.min(cols - width, c0));
            this.gridFillRect(g, c0, r, width, 1, 2);
        }
        this.outlineGridEdges(g);
        this.applyFactionPlating(g, silhouette, 0);
        const capW = Math.max(1, Math.round(cols * 0.2));
        const capC = Math.round((cols - capW) / 2);
        const capR0 = Math.round(rows * 0.4);
        const capH = Math.max(1, Math.round(rows * 0.32));
        this.gridFillRect(g, capC, capR0, capW, capH, 3);
        // Faction cockpit / sensor treatment — structure, not just texture.
        if (silhouette === 'rings') {
            const holeR = Math.max(1, Math.round(Math.min(cols, rows) * 0.16));
            this.gridFillRect(g, cols / 2 - holeR / 2, rows * 0.65 - holeR / 2, holeR, holeR, 0);
        } else if (silhouette === 'circuit') {
            // Sensor bar plus a row of contacts across the brow.
            this.gridFillRect(g, cols * 0.2, rows * 0.72, cols * 0.6, Math.max(1, rows * 0.1), 3);
            const node = Math.max(1, Math.round(cols * 0.08));
            for (let i = 0; i < 4; i++) {
                this.gridFillRect(g, cols * (0.16 + i * 0.22), rows * 0.86, node, node, 1);
            }
        } else if (silhouette === 'modular') {
            // Boxed canopy flanked by two service vents.
            this.gridFillRect(g, cols * 0.34, rows * 0.58, cols * 0.32, Math.max(1, rows * 0.26), 3);
            const vent = Math.max(1, Math.round(cols * 0.1));
            this.gridFillRect(g, cols * 0.14, rows * 0.72, vent, Math.max(1, rows * 0.16), 1);
            this.gridFillRect(g, cols * 0.76, rows * 0.72, vent, Math.max(1, rows * 0.16), 1);
        } else if (silhouette === 'spikes') {
            // A driven spearhead: bright wedge running up to the tip.
            for (let r = 0; r < rows; r++) {
                const t = rows <= 1 ? 0 : r / (rows - 1);
                const w = Math.max(1, Math.round(cols * 0.06 + t * cols * 0.2));
                this.gridFillRect(g, Math.round((cols - w) / 2), r, w, 1, r < rows * 0.55 ? 3 : 1);
            }
        } else if (silhouette === 'scrap') {
            // Bolted-on replacement plate, deliberately off-centre.
            this.gridFillRect(g, cols * 0.5, rows * 0.5, cols * 0.42, Math.max(1, rows * 0.34), 3);
            this.gridFillRect(g, cols * 0.12, rows * 0.74, cols * 0.22, Math.max(1, rows * 0.16), 1);
        }
        return g;
    },

    buildAftGrid(cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const variant = shapeVariant || 0;
        // Taper the tail per faction instead of a plain rectangle — row 0
        // joins the core at full width, row (rows-1) is the open tail edge.
        for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 0 : r / (rows - 1);
            const prof = this.factionRowProfile(silhouette, t, 3);
            const widthFrac = Math.min(1, prof.widthMul);
            const width = Math.max(1, Math.round(cols * widthFrac));
            let c0 = Math.round((cols - width) / 2 + prof.offsetMul * cols);
            c0 = Math.max(0, Math.min(cols - width, c0));
            this.gridFillRect(g, c0, r, width, 1, 2);
        }
        this.outlineGridEdges(g);
        this.applyFactionPlating(g, silhouette, 3);
        // Engine block layout is a faction trait — the shape variant only
        // nudges it, so a Kronax tail never reads like a Machine tail.
        const r0 = Math.round(rows * 0.4);
        const h = Math.max(1, Math.round(rows * 0.5));
        if (silhouette === 'rings') {
            // One large annular thruster with a hollow core.
            const w = Math.max(3, Math.round(cols * 0.52));
            this.gridFillRect(g, (cols - w) / 2, r0, w, h, 3);
            const hole = Math.max(1, Math.round(w * 0.38));
            this.gridFillRect(g, (cols - hole) / 2, r0 + Math.max(1, Math.round(h * 0.25)), hole, Math.max(1, h - Math.round(h * 0.4)), 0);
        } else if (silhouette === 'circuit') {
            // Evenly machined array of four identical ports.
            const w = Math.max(1, Math.round(cols * 0.12));
            for (let i = 0; i < 4; i++) {
                this.gridFillRect(g, cols * (0.1 + i * 0.24), r0, w, h, 3);
            }
        } else if (silhouette === 'spikes') {
            // Three raked nozzles, centre one driven further out.
            const w = Math.max(1, Math.round(cols * 0.16));
            this.gridFillRect(g, cols * 0.12, r0, w, Math.max(1, Math.round(h * 0.6)), 3);
            this.gridFillRect(g, (cols - w) / 2, r0, w, h, 3);
            this.gridFillRect(g, cols * 0.72, r0, w, Math.max(1, Math.round(h * 0.6)), 3);
        } else if (silhouette === 'scrap') {
            // Two mismatched salvaged engines at different depths.
            this.gridFillRect(g, cols * 0.1, r0, Math.max(1, Math.round(cols * 0.3)), h, 3);
            this.gridFillRect(g, cols * 0.58, r0 + Math.max(1, Math.round(h * 0.28)),
                Math.max(1, Math.round(cols * 0.2)), Math.max(1, Math.round(h * 0.7)), 3);
        } else {
            // Modular: a disciplined pair of square blocks, twinned by variant.
            const count = variant === 1 ? 1 : 2;
            if (count === 1) {
                const w = Math.max(1, Math.round(cols * 0.34));
                this.gridFillRect(g, (cols - w) / 2, r0, w, h, 3);
            } else {
                const w = Math.max(1, Math.round(cols * 0.22));
                this.gridFillRect(g, cols * 0.18, r0, w, h, 3);
                this.gridFillRect(g, cols * 0.6, r0, w, h, 3);
            }
        }
        return g;
    },
});
