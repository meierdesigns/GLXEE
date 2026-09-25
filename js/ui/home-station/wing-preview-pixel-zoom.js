"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /**
     * Voxel resolution depends on the part's on-screen size, so the larger
     * preview box would otherwise show a far finer wing than the bay ever
     * draws — and a crop that looks meaningful there would do nothing on the
     * ship. This rescales the preview's zoom so both grids come out equal.
     */
    wingPreviewPixelZoom(previewWidth) {
        const wing = this.hangarWingSegment();
        const scale = this._hangarLastScale;
        if (!wing || !scale) return 1;
        const wingPx = Math.max(1, wing.width * scale);
        return Math.max(0.25, (previewWidth / wingPx) * scale);
    },

    wingPreviewAspect() {
        const wing = this.hangarWingSegment();
        if (!wing || !wing.height) return 2;
        return Math.max(0.2, Math.min(5, wing.width / wing.height));
    },

    hangarWingSegment() {
        const model = this._hangarLastModel;
        return model && model.layout && (model.layout.segments || [])
            .find((seg) => seg.id === 'wingLeft' || seg.id === 'wingRight');
    },

    renderFloatingWingCropPreview(panel, shipId, area) {
        const canvas = panel && panel.querySelector('.hs-floating-wing-preview');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        const left = area === 'wingLeft';
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        const { cropX, cropY, cropW, cropH } = loader
            ? loader.normalizeWingCrop(this.getWingCrop(shipId))
            : { cropX: 0, cropY: 0, cropW: 1, cropH: 1 };
        // Match the bay wing's aspect so the crop rect lands on the same part
        // of the art here as it does on the ship.
        const boxW = w - 20;
        const boxH = h - 20;
        const aspect = this.wingPreviewAspect();
        const pw = Math.min(boxW, boxH * aspect);
        const ph = Math.min(boxH, boxW / aspect);
        const px = 10 + (boxW - pw) / 2;
        const py = 10 + (boxH - ph) / 2;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#09090d';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;

        const model = typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel
            ? shipConfigManager.getMergedModel(shipId)
            : null;
        const variant = profileManager.getSegmentShapeVariant(shipId, 'wing');
        const seed = loader && loader.resolveHullShapeSeed
            ? loader.resolveHullShapeSeed({ id: shipId })
            : '';
        if (loader && loader.renderProceduralWing) {
            const voxelScale = this.getVoxelScaleValue(shipId);
            loader.renderProceduralWing(
                ctx,
                { id: left ? 'wingLeft' : 'wingRight' },
                px,
                py,
                pw,
                ph,
                null,
                0,
                loader.resolvePlayerFactionStyle(model),
                seed,
                variant,
                null,
                0,
                voxelScale,
                this.wingPreviewPixelZoom(pw)
            );
        }

        const cutX = left ? px + pw * (1 - cropX - cropW) : px + pw * cropX;
        const cutY = py + ph * cropY;
        const cutW = pw * cropW;
        const cutH = ph * cropH;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(px, py, pw, Math.max(0, cutY - py));
        ctx.fillRect(px, cutY + cutH, pw, Math.max(0, py + ph - cutY - cutH));
        if (left) {
            ctx.fillRect(cutX + cutW, cutY, Math.max(0, px + pw - cutX - cutW), cutH);
        } else {
            ctx.fillRect(px, cutY, Math.max(0, cutX - px), cutH);
        }
        ctx.strokeStyle = '#ff00d4';
        ctx.lineWidth = 2;
        ctx.strokeRect(cutX, cutY, cutW, cutH);
    },

    /**
     * Crop rect as a 0..1 fraction of the wing's own frame, measured from the
     * hull root outward. Defaults to the full wing (no crop). Kept separate
     * from segmentUv.wing, which is the sprite UV band and also drives wing
     * height — editing the crop must not resize the wing.
     */
    getWingCrop(shipId) {
        const defaults = { x: 0, y: 0, w: 1, h: 1 };
        if (typeof shipConfigManager === 'undefined') return defaults;
        const cfg = shipConfigManager.getConfig(shipId);
        return Object.assign({}, defaults, cfg && cfg.segmentUv && cfg.segmentUv.wingCrop);
    },

    getWingCropValue(shipId, key) {
        return this.getWingCrop(shipId)[key];
    },

    getWingConnectionValue(shipId) {
        if (typeof shipLoadoutManager === 'undefined') return 0;
        const loadout = shipLoadoutManager.getLoadout(shipId);
        return Number(loadout && loadout.wingConnectionY) || 0;
    },

    getVoxelScaleValue(shipId) {
        if (typeof shipLoadoutManager === 'undefined') return 1;
        const loadout = shipLoadoutManager.getLoadout(shipId);
        return Number(loadout && loadout.voxelScale) || 1;
    },

    getWingConnectionStyle(shipId) {
        if (typeof shipLoadoutManager === 'undefined') return 'strut';
        const loadout = shipLoadoutManager.getLoadout(shipId);
        return loadout && loadout.wingConnectionStyle || 'strut';
    },

    getWingConnectionWidthValue(shipId) {
        if (typeof shipLoadoutManager === 'undefined') return 0.1;
        const loadout = shipLoadoutManager.getLoadout(shipId);
        return Number(loadout && loadout.wingConnectionWidth) || 0.1;
    },

    /** 0 means "inherit the hull's voxel size". */
    getWingConnectionVoxelScaleValue(shipId) {
        if (typeof shipLoadoutManager === 'undefined') return 0;
        const loadout = shipLoadoutManager.getLoadout(shipId);
        return Number(loadout && loadout.wingConnectionVoxelScale) || 0;
    },

    getWingRotationValue(shipId) {
        if (typeof shipLoadoutManager === 'undefined') return 0;
        const loadout = shipLoadoutManager.getLoadout(shipId);
        return Number(loadout && loadout.wingRotation) || 0;
    },

    /**
     * A wing's editable frame is the part its cropped art actually covers, so
     * the selection box and drag zones sit on the visible wing rather than
     * around empty space the crop left behind.
     */
    hangarSegmentFrame(seg, model, scale) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.wingVisibleRect) return seg;
        return loader.wingVisibleRect(seg, model, scale);
    },

    /**
     * Rotation a wing's frame and hit area share with its art: same angle and
     * same root pivot renderProceduralWing uses, so the selection box tilts
     * with the wing instead of staying axis-aligned beside it.
     */
    hangarSegmentRotation(segId, model, scale) {
        if (segId !== 'wingLeft' && segId !== 'wingRight') return null;
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.wingAttachPoint) return null;
        const loadout = model && model.layout && model.layout.loadout;
        const degrees = Math.max(-60, Math.min(60, Number(loadout && loadout.wingRotation) || 0));
        if (!degrees) return null;
        const seg = ((model.layout && model.layout.segments) || []).find((s) => s.id === segId);
        if (!seg) return null;
        return {
            angle: degrees * Math.PI / 180 * (segId === 'wingLeft' ? -1 : 1),
            pivot: loader.wingAttachPoint(seg, model, scale)
        };
    },

    /** Map a layout point into a segment's own (possibly rotated) space. */
    hangarSegmentLocalPoint(pt, segId, model, scale) {
        const rot = this.hangarSegmentRotation(segId, model, scale);
        if (!rot) return pt;
        const cos = Math.cos(-rot.angle);
        const sin = Math.sin(-rot.angle);
        const dx = pt.lx - rot.pivot.x;
        const dy = pt.ly - rot.pivot.y;
        return {
            lx: rot.pivot.x + dx * cos - dy * sin,
            ly: rot.pivot.y + dx * sin + dy * cos
        };
    },

    /**
     * Hull-to-wing bridge centrelines in layout units, matching what
     * renderHullSegments draws. Shared by the hit test and the focus marker so
     * the clickable band and the highlight can never drift apart.
     */
    hangarConnectionPaths(model, scale) {
        const segments = (model && model.layout && model.layout.segments) || [];
        const center = segments.find((seg) => seg.id === 'center');
        if (!center) return [];
        const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
        const connectionY = Number(loadout.wingConnectionY) || 0;
        const connectionWidth = Number(loadout.wingConnectionWidth) || 0.1;
        return segments
            .filter((seg) => seg.id === 'wingLeft' || seg.id === 'wingRight')
            .map((seg) => {
                const left = seg.id === 'wingLeft';
                const attach = graphicsManager.shipAssetLoader.wingAttachPoint(seg, model, scale);
                return {
                    id: seg.id,
                    left: left,
                    x0: left ? center.x : center.x + center.width,
                    y0: center.y + center.height * (0.5 + connectionY * 0.5),
                    x1: attach.x,
                    y1: attach.y,
                    half: Math.max(4, center.height * connectionWidth)
                };
            });
    },
});
