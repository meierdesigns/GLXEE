"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    renderFallbackSegmentedHull(
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
    ) {
        const showGuides = !!(renderOptions && renderOptions.showSegmentGuides === true);
        segs.forEach((seg) => {
            const renderSeg = seg;
            const sx = x + renderSeg.x * scale;
            const sy = y + renderSeg.y * scale;
            const sw = Math.max(1, renderSeg.width * scale);
            const sh = Math.max(1, renderSeg.height * scale);
            if (seg.replace && seg.replace.id) {
                const replaceModule = ((shipModel.layout && shipModel.layout.modules) || []).find(
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
                return;
            }
            const drawn = !factionStyle && this.renderSegmentFromFullSprite(
                ctx,
                shipModel,
                seg,
                sx,
                sy,
                sw,
                sh,
                colorOverlay,
                overlayIntensity
            );
            if (!drawn) {
                const variantOverride = this.resolveSegmentVariantOverride(shipModel, seg.id);
                if (seg.id === 'wingLeft' || seg.id === 'wingRight') {
                    ctx.save();
                    this.renderProceduralWing(
                        ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
                        variantOverride, null,
                        shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.wingRotation,
                        shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.voxelScale,
                        scale
                    );
                    ctx.restore();
                } else {
                    this.renderProceduralBodyBand(
                        ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed,
                        variantOverride,
                        shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.voxelScale,
                        scale
                    );
                }
            }
            if (showGuides) {
                this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
            }
        });
        if (showGuides) {
            this.drawSegmentConnectors(ctx, shipModel.layout, x, y, scale, colorOverlay, overlayIntensity);
        }
    },

    drawSegmentGuides(ctx, layout, x, y, scale, colorOverlay, overlayIntensity) {
        const segs = layout.segments || [];
        const byId = {};
        segs.forEach((seg) => { byId[seg.id] = seg; });
        const seam = this.applyHullOverlayHex('#171917', colorOverlay, overlayIntensity, 0);
        const edge = this.applyHullOverlayHex('#b4bba4', colorOverlay, overlayIntensity, 3);
        ctx.save();
        ctx.strokeStyle = seam;
        ctx.lineWidth = Math.max(1, Math.round(scale * 0.18));
        ctx.setLineDash([Math.max(1, Math.round(scale * 0.6)), Math.max(1, Math.round(scale * 0.45))]);

        const horizontalGuide = (a, b) => {
            if (!a || !b) return;
            const left = Math.max(a.x, b.x);
            const right = Math.min(a.x + a.width, b.x + b.width);
            if (right <= left) return;
            const yPos = y + ((a.y + a.height + b.y) * 0.5) * scale;
            ctx.beginPath();
            ctx.moveTo(x + left * scale, yPos);
            ctx.lineTo(x + right * scale, yPos);
            ctx.stroke();
        };
        horizontalGuide(byId.front, byId.center);
        horizontalGuide(byId.center, byId.back);
        ctx.setLineDash([]);

        // Short bright docking marks show where interchangeable wings connect,
        // without drawing detached replacement geometry.
        ctx.strokeStyle = edge;
        ctx.lineWidth = Math.max(1, Math.round(scale * 0.22));
        const wingGuide = (wing, core, left) => {
            if (!wing || !core) return;
            const root = left ? wing.x + wing.width : wing.x;
            const y0 = wing.y + wing.height * 0.28;
            const y1 = wing.y + wing.height * 0.72;
            ctx.beginPath();
            ctx.moveTo(x + root * scale, y + y0 * scale);
            ctx.lineTo(x + root * scale, y + y1 * scale);
            ctx.stroke();
        };
        wingGuide(byId.wingLeft, byId.center, true);
        wingGuide(byId.wingRight, byId.center, false);
        ctx.restore();
    },

    /** Thin dark outline so each segment reads as its own plate. */
    drawSegmentSeam(ctx, segId, x, y, w, h, colorOverlay, overlayIntensity) {
        const edge = this.applyHullOverlayHex('#141414', colorOverlay, overlayIntensity, 0);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
        // Highlight docking edge toward the core
        const hi = this.applyHullOverlayHex('#c8c8c8', colorOverlay, overlayIntensity, 6);
        ctx.fillStyle = hi;
        if (segId === 'front') {
            ctx.fillRect(x + w * 0.25, y + h - 1, w * 0.5, 1);
        } else if (segId === 'back') {
            ctx.fillRect(x + w * 0.25, y, w * 0.5, 1);
        } else if (segId === 'wingLeft') {
            ctx.fillRect(x + w - 1, y + h * 0.3, 1, h * 0.4);
        } else if (segId === 'wingRight') {
            ctx.fillRect(x, y + h * 0.3, 1, h * 0.4);
        } else if (segId === 'center') {
            ctx.fillRect(x + w * 0.2, y, w * 0.6, 1);
            ctx.fillRect(x + w * 0.2, y + h - 1, w * 0.6, 1);
        }
    },

    /** Tiny bridge pixels in the air gaps so parts feel docked, not floating random. */
    drawSegmentConnectors(ctx, layout, x, y, scale, colorOverlay, overlayIntensity) {
        const segs = layout.segments || [];
        if (segs.length < 2) return;
        const byId = {};
        segs.forEach((s) => { byId[s.id] = s; });
        const pin = this.applyHullOverlayHex('#8a8a8a', colorOverlay, overlayIntensity, 4);
        ctx.fillStyle = pin;
        const link = (a, b, axis) => {
            if (!a || !b) return;
            if (axis === 'y') {
                const ax = x + (a.x + a.width * 0.5) * scale;
                const top = Math.min(a.y + a.height, b.y);
                const bot = Math.max(a.y + a.height, b.y);
                const mid = y + ((top + bot) * 0.5) * scale;
                ctx.fillRect(Math.round(ax - 1), Math.round(mid - 0.5), 2, 1);
            } else {
                const ay = y + (a.y + a.height * 0.5) * scale;
                const left = Math.min(a.x + a.width, b.x);
                const right = Math.max(a.x + a.width, b.x);
                const mid = x + ((left + right) * 0.5) * scale;
                ctx.fillRect(Math.round(mid - 0.5), Math.round(ay - 1), 1, 2);
            }
        };
        link(byId.front, byId.center, 'y');
        link(byId.center, byId.back, 'y');
        link(byId.wingLeft, byId.center, 'x');
        link(byId.wingRight, byId.center, 'x');
    },
});
