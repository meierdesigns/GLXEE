"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    buildWingGrid(seg, cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const left = seg.id === 'wingLeft';
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        // Wing planform: for each span column (u = 0 at the hull root, 1 at
        // the tip) the wing covers one or more row bands [lead, trail] of the
        // frame. The grid holds only the wing itself — no hull spar or root
        // rail — so nothing needs cropping away.
        const variants = this.wingShapeVariants;
        const planform = (variants[shapeVariant || 0] || variants[0]).planform;
        const k = this.factionStyleStrength();
        for (let c = 0; c < cols; c++) {
            const u = cols <= 1 ? 0 : c / (cols - 1);
            const bands = planform(u);
            if (!bands) continue;
            (Array.isArray(bands[0]) ? bands : [bands]).forEach(([lead0, trail0]) => {
                let lead = lead0;
                let trail = trail0;
                if (silhouette === 'spikes') {
                    // Blade tips: swept back and narrowing to a sharp point.
                    lead += 0.1 * k * u * u;
                    trail -= 0.02 * k * u * u;
                    const sweep = 0.16 * k * u;
                    lead += sweep;
                    trail += sweep;
                } else if (silhouette === 'scrap') {
                    // Welded-on salvage: ragged, uneven trailing edge.
                    const h = (Math.imul(c * 31 + 7, 2654435761) >>> 0) % 3;
                    trail -= h * 0.05 * k * u;
                } else if (silhouette === 'rings') {
                    // Rounded crescent: pod-like tip, curving forward.
                    const round = Math.sqrt(Math.max(0, 1 - Math.pow(u, 4 / Math.max(0.5, k))));
                    const mid = (lead + trail) / 2 - 0.1 * k * u * u;
                    const half = (trail - lead) / 2 * round;
                    lead = mid - half;
                    trail = mid + half;
                } else if (silhouette === 'circuit') {
                    // Rectangular machined slab (no sweep) with square
                    // notches cut into the trailing edge.
                    const mix = Math.min(1, 0.45 * k);
                    lead = lead * (1 - mix) + 0.2 * mix;
                    trail = trail * (1 - mix) + 0.8 * mix;
                    if (Math.floor(u * 6) % 2 === 1) trail = lead + (trail - lead) * 0.6;
                } else if (silhouette === 'modular') {
                    // Stepped terraces along the trailing edge — a blocky plate wing.
                    const step = Math.floor(u * 3) / 3;
                    trail -= step * 0.12 * k;
                }
                const r0 = Math.max(0, Math.round(lead * rows));
                const r1 = Math.min(rows, Math.round(trail * rows));
                if (r1 - r0 < 1) return;
                this.gridFillRect(g, left ? cols - 1 - c : c, r0, 1, r1 - r0, 2);
            });
        }
        // The root side joins the hull or its connection: leave it open so
        // no dark seam line runs across the joint (worst on a turned wing).
        this.outlineGridEdges(g, left ? 'right' : 'left');
        this.applyFactionPlating(g, silhouette, 1, left);
        // Accent trim follows the leading edge: the first interior voxel of
        // each column, so it always sits on the wing and never off it.
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (g[r][c] === 0) continue;
                if (g[r][c] === 1 && r + 1 < rows && g[r + 1][c] && g[r + 1][c] !== 1) {
                    g[r + 1][c] = 3;
                }
                break;
            }
        }
        return g;
    },

    /** Number of shape variants available for a given body-band segment id. */
    bodyShapeVariantCount(segId) {
        return this.bodyShapeVariantLabels(segId).length;
    },

    /** Style names per body band, in variant-index order. */
    bodyShapeVariantLabels(segId) {
        if (segId === 'front') {
            return ['POINTED', 'BLUNT', 'FORKED', 'NEEDLE', 'SHOVEL', 'BULB', 'STEPPED', 'ARROWHEAD'];
        }
        if (segId === 'back') {
            return ['BLOCK', 'TAPER', 'SKIRT', 'FLARE', 'NOTCHED', 'WAIST', 'STUB', 'FAN'];
        }
        return ['SLAB', 'PANELED', 'SLIM', 'HOURGLASS', 'BARREL', 'WEDGE', 'KEEL', 'RIBBED'];
    },

    renderProceduralBodyBand(
        ctx, seg, x, y, w, h, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
        variantOverride = null, voxelScale = 1, pixelZoom = 1
    ) {
        const res = this.hullPartResolution(w, h, voxelScale, pixelZoom);
        // Body parts share one centre line; an even column count puts that
        // line on a voxel seam for every part, so nose, core and aft stay
        // aligned to each other at any width.
        const resW = res.resW + (res.resW % 2);
        const { resH, cell } = res;
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
            } else if (variant === 3) {
                widthFrac = 0.06 + t * t * 0.94; // needle: long thin spike
            } else if (variant === 4) {
                widthFrac = t < 0.3 ? 0.72 : 0.72 + (t - 0.3) / 0.7 * 0.28; // shovel: flat wide scoop
            } else if (variant === 5) {
                widthFrac = 0.3 + Math.sqrt(t) * 0.7; // bulb: rounded dome
            } else if (variant === 6) {
                widthFrac = 0.25 + Math.floor(t * 4) / 4 * 0.75; // stepped terraces
            } else if (variant === 7) {
                // arrowhead: barbs flare out, then pinch into the neck.
                widthFrac = t < 0.65 ? 0.1 + t / 0.65 * 0.9 : 1 - (t - 0.65) * 1.1;
            } else {
                widthFrac = 0.1 + t * 0.9; // pointed
            }
            const prof = this.factionRowProfile(silhouette, t, 0);
            widthFrac *= prof.widthMul;
            const width = this.evenSpan(cols, Math.max(1, Math.round(cols * Math.min(1, widthFrac))));
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
        // Scrap (pirate) hulls are deliberately lopsided; the rest are symmetric.
        if (silhouette !== 'scrap') this.mirrorGridLeftToRight(g);
        return g;
    },

    /** Tail outline width multiplier for aft style `variant` at row `t`. */
    aftVariantWidth(variant, t) {
        switch (variant) {
        case 1: return 1 - 0.45 * t; // tapered tail
        case 2: return 0.62 + 0.38 * Math.pow(Math.abs(t * 2 - 1), 1.5); // skirt
        case 3: return 0.6 + 0.4 * t; // flare: widens into the exhaust
        case 4: return ((t * 6) | 0) % 2 ? 0.76 : 1; // notched fins
        case 5: return 1 - 0.32 * Math.sin(t * Math.PI); // pinched waist
        case 6: return t > 0.7 ? 0.5 : 1; // stub nozzle
        case 7: return 0.7 + 0.3 * Math.abs(Math.sin(t * Math.PI * 2)); // fan
        default: return 1; // block
        }
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
            // The style picks the tail outline: 0 block, 1 tapered tail,
            // 2 pinched waist flaring into a wide exhaust skirt.
            const variantMul = this.aftVariantWidth(variant, t);
            const widthFrac = Math.min(1, prof.widthMul * variantMul);
            const width = this.evenSpan(cols, Math.max(1, Math.round(cols * widthFrac)));
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
        // Scrap (pirate) hulls are deliberately lopsided; the rest are symmetric.
        if (silhouette !== 'scrap') this.mirrorGridLeftToRight(g);
        return g;
    },
});
