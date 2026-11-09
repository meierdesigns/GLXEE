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
        if (typeof shipLoadoutManager === 'undefined') return 0.5;
        const loadout = shipLoadoutManager.getLoadout(shipId);
        // Max 1.5 — older loadouts may still store larger values.
        return Math.max(0.2, Math.min(1.5, Number(loadout && loadout.voxelScale) || 0.5));
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
     * A wing's editable frame is the axis-aligned box around the art that is
     * actually on screen: start from the cropped visible rect, then if the
     * wing is rotated take the AABB of its lit cells after rotation so the
     * upright scale rectangle fits the silhouette (not the empty corners of
     * the unrotated rect, which pad swept wings off-axis).
     */
    hangarSegmentFrame(seg, model, scale) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.wingVisibleRect) return seg;
        const vis = loader.wingVisibleRect(seg, model, scale);
        if (!vis || (seg.id !== 'wingLeft' && seg.id !== 'wingRight')) return vis || seg;
        const rot = this.hangarSegmentRotation(seg.id, model, scale);
        if (!rot || !rot.angle) return vis;
        const cos = Math.cos(rot.angle);
        const sin = Math.sin(rot.angle);
        const px = rot.pivot.x;
        const py = rot.pivot.y;
        const lit = loader.wingLitCells && loader.wingLitCells(seg, model, scale);
        const half = lit && lit.cell ? lit.cell * 0.5 : 0;
        const pts = (lit && lit.pts && lit.pts.length)
            ? lit.pts
            : [
                [vis.x, vis.y],
                [vis.x + vis.width, vis.y],
                [vis.x, vis.y + vis.height],
                [vis.x + vis.width, vis.y + vis.height]
            ];
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        pts.forEach(([x, y]) => {
            const dx = x - px;
            const dy = y - py;
            const rx = px + dx * cos - dy * sin;
            const ry = py + dx * sin + dy * cos;
            if (rx - half < x0) x0 = rx - half;
            if (rx + half > x1) x1 = rx + half;
            if (ry - half < y0) y0 = ry - half;
            if (ry + half > y1) y1 = ry + half;
        });
        return {
            id: seg.id,
            x: x0,
            y: y0,
            width: Math.max(0.5, x1 - x0),
            height: Math.max(0.5, y1 - y0)
        };
    },

    /**
     * Wing art rotation (root pivot + angle). Used by the rotate knob and
     * procedural wing draw — not by the scale frame, which stays axis-aligned.
     */
    hangarSegmentRotation(segId, model, scale) {
        if (segId !== 'wingLeft' && segId !== 'wingRight') return null;
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || !loader.wingAttachPoint) return null;
        const loadout = model && model.layout && model.layout.loadout;
        const degrees = Math.max(-180, Math.min(180, Number(loadout && loadout.wingRotation) || 0));
        if (!degrees) return null;
        const seg = ((model.layout && model.layout.segments) || []).find((s) => s.id === segId);
        if (!seg) return null;
        return {
            angle: degrees * Math.PI / 180 * (segId === 'wingLeft' ? -1 : 1),
            pivot: loader.wingAttachPoint(seg, model, scale)
        };
    },

    /**
     * Scale/hit points stay in unrotated layout space so resize grips are
     * always upright rectangles, matching the drawn scale frame.
     */
    hangarSegmentLocalPoint(pt, segId, model, scale) {
        return pt;
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
        const connectionWidth = Number(loadout.wingConnectionWidth) || 0.1;
        const endWidth = Number(loadout.wingConnectionWidthEnd) || connectionWidth;
        const loader = graphicsManager.shipAssetLoader;
        if (!loader || !loader.wingBridgeGeometry) return [];
        return segments
            .filter((seg) => seg.id === 'wingLeft' || seg.id === 'wingRight')
            .filter((seg) => {
                const geo = loader.wingBridgeGeometry(seg, center, model, scale);
                return loader.wingConnectionVisible(
                    model.layout, geo.left, geo.x0 * scale, geo.attach.x * scale, scale
                );
            })
            .map((seg) => {
                // Same trapezoid the renderer draws — one geometry source, so
                // the hit band and the voxels cannot drift apart.
                const geo = loader.wingBridgeGeometry(seg, center, model, scale);
                return {
                    id: seg.id,
                    left: geo.left,
                    x0: geo.x0,
                    y0: geo.y0,
                    x1: geo.x1,
                    y1: geo.y1,
                    n0: geo.n0,
                    n1: geo.n1,
                    e0: geo.e0,
                    e1: geo.e1,
                    up0: geo.up0,
                    down0: geo.down0,
                    up1: geo.up1,
                    down1: geo.down1,
                    half0: geo.half0,
                    half1: geo.half1,
                    half: Math.max(4, center.height * Math.max(connectionWidth, endWidth))
                };
            });
    },
});
