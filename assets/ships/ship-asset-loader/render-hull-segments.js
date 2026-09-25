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
        // Every part of this ship is drawn with one voxel size.
        const prevCell = this._shipVoxelCell;
        this._shipVoxelCell = this.shipVoxelCell(shipModel, scale);
        try {
            this.renderHullSegmentParts(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions);
        } finally {
            this._shipVoxelCell = prevCell;
        }
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
                const rootOverlap = Math.max(1, Math.min(3, scale));
                const bridgeStart = isLeft ? centerEdge + rootOverlap : centerEdge - rootOverlap;
                const bridgeEnd = isLeft ? wingEdge - rootOverlap : wingEdge + rootOverlap;
                const centerHalf = Math.max(2, centerSeg.height * scale * (
                    style === 'plate' ? connectionWidth * 2 : connectionWidth
                ));
                const wingHalf = Math.max(2, vis.height * scale * (
                    style === 'plate' ? connectionWidth * 2.2 : connectionWidth * 1.2
                ));
                // Bridges use the ship-wide voxel size like every hull part.
                const voxelSize = this.hullPartResolution(
                    1, 1, Number(layout.loadout && layout.loadout.voxelScale) || 1, scale
                ).cell;
                // Silhouette along the bridge: 0 = hull root, 1 = wing root.
                const shapeProfile = (t) => {
                    const pinch = Math.abs(t * 2 - 1);
                    if (style === 'plate') return 1;
                    if (style === 'hinge') return 0.4 + 0.6 * pinch;
                    if (style === 'double') return 0.9 + 0.1 * pinch;
                    return 0.75 + 0.25 * pinch;
                };
                const drawBridge = (fromY, toY, halfA, halfB) => {
                    const minX = Math.min(bridgeStart, bridgeEnd);
                    const maxX = Math.max(bridgeStart, bridgeEnd);
                    const span = bridgeEnd - bridgeStart;
                    // Raster anchored to the ship, not the screen: snapping
                    // against absolute canvas coords made the bridge voxels
                    // re-land on a different grid whenever the view panned.
                    const firstVoxelX = Math.floor((minX - x) / voxelSize) * voxelSize;
                    const lastVoxelX = maxX - x;
                    for (let vx = firstVoxelX; vx <= lastVoxelX; vx += voxelSize) {
                        const centerX = Math.min(lastVoxelX, vx + voxelSize * 0.5) + x;
                        const t = Math.max(0, Math.min(1, (centerX - bridgeStart) / (span || 1)));
                        const centerY = fromY + (toY - fromY) * t;
                        const half = (halfA + (halfB - halfA) * t) * shapeProfile(t);
                        const thickness = Math.max(1, Math.round(half * 2 / voxelSize));
                        const row = Math.round((centerY - y) / voxelSize) * voxelSize;
                        for (let layer = 0; layer < thickness; layer++) {
                            this.fillVoxelCell(
                                ctx,
                                Math.round(x) + vx,
                                Math.round(y) + row + (layer - Math.floor(thickness / 2)) * voxelSize,
                                voxelSize,
                                voxelSize,
                                wingPalette[2]
                            );
                        }
                    }
                };
                if (style === 'double') {
                    drawBridge(centerY - centerHalf * 1.25, wingY - wingHalf * 0.9, centerHalf * 0.35, wingHalf * 0.35);
                    drawBridge(centerY + centerHalf * 1.25, wingY + wingHalf * 0.9, centerHalf * 0.35, wingHalf * 0.35);
                } else {
                    drawBridge(centerY, wingY, centerHalf, wingHalf);
                }
                if (style === 'hinge') {
                    const capW = Math.max(2, voxelSize * 2);
                    ctx.fillRect(bridgeStart - capW / 2, centerY - centerHalf, capW, centerHalf * 2);
                    ctx.fillRect(bridgeEnd - capW / 2, wingY - wingHalf, capW, wingHalf * 2);
                }
            });
        }
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
            if (seg.replace && seg.replace.id) {
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
                    variantOverride, shipModel.segmentUv && shipModel.segmentUv.wingCrop,
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
