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
                const geo = this.wingBridgeGeometry(wing, centerSeg, shipModel, scale);
                const centerEdge = x + geo.x0 * scale;
                const wingEdge = x + geo.attach.x * scale;
                const style = layout.loadout && layout.loadout.wingConnectionStyle || 'strut';
                if (!this.wingConnectionVisible(layout, isLeft, centerEdge, wingEdge, scale)) return;
                // Bridges use the ship-wide voxel size like every hull part.
                const voxelSize = this.hullPartResolution(
                    1, 1, Number(layout.loadout && layout.loadout.voxelScale) || 0.5, scale
                ).cell;
                // Layout units only — never divide a canvas-x pixel by scale
                // (that used to double the origin and shoot the strut past the tip).
                const rootOverlap = (voxelSize * 2) / scale;
                const hullOverlap = Math.max(rootOverlap, centerSeg.width * 0.36);
                let x0 = isLeft ? geo.x0 + hullOverlap : geo.x0 - hullOverlap;
                let x1 = geo.x1;
                if (isLeft) {
                    if (x1 > x0) x1 = x0;
                } else if (x1 < x0) {
                    x1 = x0;
                }
                const bridgeStartPx = x + x0 * scale;
                const pxGeo = {
                    x0: x0,
                    y0: geo.y0,
                    x1: x1,
                    y1: geo.y1,
                    nX: geo.nX, nY: geo.nY,
                    e0: geo.e0, e1: geo.e1,
                    attach: geo.attach
                };
                const up0 = Math.max(1, geo.up0 * scale);
                const down0 = Math.max(1, geo.down0 * scale);
                const up1 = Math.max(1, geo.up1 * scale);
                const down1 = Math.max(1, geo.down1 * scale);
                const centerHalf = Math.max(2, (up0 + down0) / 2);
                const wingHalf = Math.max(2, (up1 + down1) / 2);
                const shapeProfile = (t) => {
                    const pinch = Math.abs(t * 2 - 1);
                    if (style === 'plate') return 1;
                    if (style === 'hinge') return 0.4 + 0.6 * pinch;
                    if (style === 'double') return 0.9 + 0.1 * pinch;
                    return 0.75 + 0.25 * pinch;
                };
                const ox = Math.round(x);
                const oy = Math.round(y);
                const cells = new Map();
                const mark = (col, row, val) => {
                    const key = col + ',' + row;
                    if (!cells.has(key) || val === 3) cells.set(key, val);
                };
                // One continuous polygon per strut. Corners are paired so the
                // long sides never cross, even when the root is past 90°.
                const drawBridge = (hullYOffset, wingOffset, upA, downA, upB, downB) => {
                    const shifted = Object.assign({}, pxGeo, {
                        y0: pxGeo.y0 + (Number(hullYOffset) || 0) / scale
                    });
                    const c = this.wingBridgeCorners(
                        shifted, upA / scale, downA / scale, upB / scale, downB / scale, wingOffset / scale
                    );
                    const aTop = [x + c.aTop[0] * scale, y + c.aTop[1] * scale];
                    const aBot = [x + c.aBot[0] * scale, y + c.aBot[1] * scale];
                    const bTop = [x + c.bTop[0] * scale, y + c.bTop[1] * scale];
                    const bBot = [x + c.bBot[0] * scale, y + c.bBot[1] * scale];
                    const ax = x + c.ax * scale;
                    const ay = y + c.ay * scale;
                    const bx = x + c.bx * scale;
                    const by = y + c.by * scale;
                    const pinch = shapeProfile(0.5);
                    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
                    const mc = mid([ax, ay], [bx, by]);
                    const squeeze = (pt) => [mc[0] + (pt[0] - mc[0]) * pinch, mc[1] + (pt[1] - mc[1]) * pinch];
                    const poly = [aTop, squeeze(mid(aTop, bTop)), bTop, bBot, squeeze(mid(aBot, bBot)), aBot];
                    this.markPolygonCells(poly, ox, oy, voxelSize, (col, row) => mark(col, row, 2));
                };
                if (style === 'double') {
                    // Each strut sits on its own side of the outer extents.
                    const sa = (v) => Math.max(voxelSize * 1.5, v * 0.35);
                    drawBridge(-(up0 - sa(up0)), -(up1 - sa(up1)), sa(up0), sa(up0), sa(up1), sa(up1));
                    drawBridge(down0 - sa(down0), down1 - sa(down1), sa(down0), sa(down0), sa(down1), sa(down1));
                } else {
                    const m = (v) => Math.max(voxelSize * 1.5, v);
                    drawBridge(0, 0, m(up0), m(down0), m(up1), m(down1));
                }
                if (style === 'hinge') {
                    const cap = (cx, cy, half) => {
                        const col0 = Math.round((cx - x) / voxelSize) - 1;
                        const rows = Math.max(1, Math.round(half * 2 / voxelSize));
                        const row0 = Math.round((cy - half - y) / voxelSize);
                        for (let r = 0; r < rows; r++) {
                            mark(col0, row0 + r, 3);
                            mark(col0 + 1, row0 + r, 3);
                        }
                    };
                    cap(bridgeStartPx, y + geo.y0 * scale, centerHalf);
                    cap(x + x1 * scale, y + geo.y1 * scale, wingHalf);
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
            if (seg.replace && seg.replace.id && seg.replace.kind === 'weapon' && !(renderOptions && renderOptions.hideModules)) {
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
