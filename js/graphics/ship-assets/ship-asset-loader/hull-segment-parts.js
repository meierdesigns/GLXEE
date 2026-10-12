"use strict";

import { extendClass } from '../../../core/extend-class-module.js';

import { ShipAssetLoader } from './core.js';

extendClass(ShipAssetLoader, {
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
                const wingDeg = Math.max(-180, Math.min(180,
                    Number(layout.loadout && layout.loadout.wingRotation) || 0));
                const ang = wingDeg * Math.PI / 180 * (isLeft ? -1 : 1);
                const dirX = (isLeft ? -1 : 1) * Math.cos(ang);
                const dirY = (isLeft ? -1 : 1) * Math.sin(ang);
                // Normal pointing "down" in the wing's frame for both sides.
                const nX = isLeft ? dirY : -dirY;
                const nY = isLeft ? -dirX : dirX;
                // Bridge end slid along the (turned) wing root; the wing's
                // attach point stays its rotation pivot.
                const endShift = Math.max(-1, Math.min(1,
                    Number(layout.loadout && layout.loadout.wingConnectionYEnd) || 0)) * vis.height * scale * 0.5;
                // One continuous polygon per strut: the hull end is a vertical
                // edge tucked into the body, the wing end is the wing root
                // line turned with the wing and pushed a few voxels into it.
                // Rasterising that single shape onto the ship lattice keeps
                // the joint in one piece at any wing angle — building it
                // column by column plus a separately turned collar split it
                // into visible chunks.
                const wingDepth = voxelSize * 3;
                const drawBridge = (fromY, wingOffset, upA, downA, upB, downB) => {
                    const bx = wingEdge + nX * (wingOffset + endShift) + dirX * wingDepth;
                    const by = wingY + nY * (wingOffset + endShift) + dirY * wingDepth;
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
                    cap(bridgeEnd + nX * endShift, wingY + nY * endShift, wingHalf);
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
