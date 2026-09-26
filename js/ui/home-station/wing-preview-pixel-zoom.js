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

    /**
     * Draw one wing style on its own, fitted to the canvas. Wings carry no
     * hull fragments, so the whole generated wing is shown — no crop window.
     */
    renderFloatingWingPreview(canvas, shipId, area, variant) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!ctx || !loader || !loader.renderProceduralWing) return;
        const w = canvas.width;
        const h = canvas.height;
        const pad = Math.max(4, Math.round(Math.min(w, h) * 0.08));
        const boxW = w - pad * 2;
        const boxH = h - pad * 2;
        const aspect = this.wingPreviewAspect();
        const pw = Math.min(boxW, boxH * aspect);
        const ph = Math.min(boxH, boxW / aspect);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#09090d';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        const model = typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel
            ? shipConfigManager.getMergedModel(shipId)
            : null;
        const seed = loader.resolveHullShapeSeed ? loader.resolveHullShapeSeed({ id: shipId }) : '';
        loader.renderProceduralWing(
            ctx,
            { id: area === 'wingRight' ? 'wingRight' : 'wingLeft' },
            pad + (boxW - pw) / 2,
            pad + (boxH - ph) / 2,
            pw,
            ph,
            null,
            0,
            loader.resolvePlayerFactionStyle(model),
            seed,
            variant,
            null,
            0,
            this.getVoxelScaleValue(shipId),
            this.wingPreviewPixelZoom(pw)
        );
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
        // Max 1.5 — older loadouts may still store larger values.
        return Math.max(0.5, Math.min(1.5, Number(loadout && loadout.voxelScale) || 1));
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
        const endWidth = Number(loadout.wingConnectionWidthEnd) || connectionWidth;
        const style = loadout.wingConnectionStyle || 'strut';
        const loader = graphicsManager.shipAssetLoader;
        return segments
            .filter((seg) => seg.id === 'wingLeft' || seg.id === 'wingRight')
            .filter((seg) => {
                // Same visibility rule as the renderer: no bridge, no hit.
                const isLeft = seg.id === 'wingLeft';
                const attach = loader.wingAttachPoint(seg, model, scale);
                const edge = isLeft ? center.x : center.x + center.width;
                return loader.wingConnectionVisible(
                    model.layout, isLeft, edge * scale, attach.x * scale, scale
                );
            })
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
                    // Outer extents exactly as renderHullSegments draws them:
                    // plate widens the band, double splits it into two
                    // struts whose outer edges reach further out.
                    ...(() => {
                        const sides = loader.wingJointSides(model.layout.loadout);
                        // Same rule as the renderer: style never changes the
                        // outer extents, only strength does.
                        const hullUnit = center.height;
                        const wingUnit = loader.wingVisibleRect(seg, model, scale).height * 1.2;
                        const up0 = Math.max(1, hullUnit * sides.up0);
                        const down0 = Math.max(1, hullUnit * sides.down0);
                        const up1 = Math.max(1, wingUnit * sides.up1);
                        const down1 = Math.max(1, wingUnit * sides.down1);
                        return { up0, down0, up1, down1, half0: (up0 + down0) / 2, half1: (up1 + down1) / 2 };
                    })(),
                    half: Math.max(4, center.height * Math.max(connectionWidth, endWidth))
                };
            });
    },
});
