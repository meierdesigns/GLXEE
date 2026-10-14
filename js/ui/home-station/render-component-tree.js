"use strict";

// HomeStationUI methods: style-unlock check and style thumbnails (shop styles tab, floating style panels).
extendClass(HomeStationUI, {
    /**
     * Paint every style thumbnail canvas under root: hull areas via the
     * procedural part renderers, module skins via the module renderer — the
     * same art the ship shows, in the ship's faction colours. The active
     * thumbnail is scrolled into view so the strip opens on the choice.
     */
    /** Style unlock check that stays permissive if the unlock system is missing. */
    isStyleOwned(groupId, styleId) {
        if (typeof profileManager === 'undefined' || !profileManager.isStyleUnlocked) return true;
        return profileManager.isStyleUnlocked(groupId, styleId);
    },
    renderStyleThumbs(root) {
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!root || !loader) return;
        root.querySelectorAll('canvas[data-thumb]').forEach((canvas) => {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const shipTree = canvas.closest('[data-ship-tree]');
            const shipId = (shipTree && shipTree.getAttribute('data-ship-tree')) || this.hangarShipId || 'player_scrap';
            const model = typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel
                ? shipConfigManager.getMergedModel(shipId)
                : null;
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#09090d';
            ctx.fillRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = false;
            // Thumbnails use their own coarse voxel so shapes stay readable.
            const prevCell = loader._shipVoxelCell;
            const prevAnchor = loader._shipVoxelAnchor;
            loader._shipVoxelCell = 3;
            loader._shipVoxelAnchor = null;
            try {
                if (canvas.getAttribute('data-thumb') === 'joint') {
                    // Two stub plates with the joint style between them.
                    const faction = loader.resolvePlayerFactionStyle(model);
                    const layout = {
                        loadout: {
                            spineConnectionStyle: canvas.getAttribute('data-thumb-style'),
                            spineConnectionWidth: 0.22
                        },
                        segments: [
                            { id: 'front', x: 2, y: 0, width: 12, height: 2 },
                            { id: 'center', x: 2, y: 10, width: 12, height: 2 }
                        ]
                    };
                    loader.renderSpineJoints(ctx, layout, layout.segments, 0, 0, 3, null, 0, faction);
                    // Plates on top, like the real parts covering the seats.
                    const palette = loader.buildHullPartPalette(null, 0, faction);
                    ctx.fillStyle = palette[1];
                    ctx.fillRect(6, 0, 36, 6);
                    ctx.fillRect(6, 30, 36, 6);
                } else if (canvas.getAttribute('data-thumb') === 'area') {
                    const area = canvas.getAttribute('data-thumb-area');
                    const index = Number(canvas.getAttribute('data-thumb-index'));
                    const faction = loader.resolvePlayerFactionStyle(model);
                    const seed = loader.resolveHullShapeSeed({ id: shipId });
                    // Draw the part at the ship's own proportions and voxel
                    // count: a fixed 48×36 box with 3 px voxels stretched
                    // every shape and resampled it to a different grid, so
                    // the thumbnail did not match the part on the ship.
                    const geo = this.styleThumbGeometry(shipId, area, loader);
                    const aspect = geo ? geo.aspect : (area.indexOf('wing') === 0 ? 1.4 : 1.1);
                    const boxW = w - 6;
                    const boxH = h - 6;
                    const fw = Math.min(boxW, boxH * aspect);
                    const fh = Math.min(boxH, boxW / aspect);
                    loader._shipVoxelCell = geo ? Math.max(1, Math.min(fw / geo.cols, fh / geo.rows)) : 3;
                    const fx = 3 + (boxW - fw) / 2;
                    const fy = 3 + (boxH - fh) / 2;
                    if (area === 'wingLeft' || area === 'wingRight') {
                        loader.renderProceduralWing(ctx, { id: area }, fx, fy, fw, fh,
                            null, 0, faction, seed, index, null, 0, 1, 1);
                    } else {
                        loader.renderProceduralBodyBand(ctx, { id: area }, fx, fy, fw, fh,
                            null, 0, faction, seed, index, 1, 1);
                    }
                } else {
                    const kind = canvas.getAttribute('data-thumb-kind');
                    const id = canvas.getAttribute('data-thumb-module');
                    const size = Math.min(w, h) - 6;
                    loader.renderShipModule(ctx, {
                        id,
                        kind,
                        role: typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getModuleVisualRole
                            ? shipLoadoutManager.getModuleVisualRole(kind, id)
                            : kind,
                        face: 'up',
                        skin: canvas.getAttribute('data-thumb-skin')
                    }, (w - size) / 2, (h - size) / 2, size, size, null, 0, null,
                    loader.resolveModuleFactionStyle ? loader.resolveModuleFactionStyle(model) : null);
                }
            } catch (e) {
                /* a thumbnail failing must not break the tree */
            } finally {
                loader._shipVoxelCell = prevCell;
                loader._shipVoxelAnchor = prevAnchor;
            }
        });
        const saved = this._styleTrackScroll || {};
        this._styleTrackScroll = null;
        root.querySelectorAll('.hs-style-carousel-track').forEach((track) => {
            // Instant, not smooth: a rebuild must not visibly scroll other
            // strips (picking an AFT style used to slide the WINGS strip).
            track.style.scrollBehavior = 'auto';
            const owner = track.closest('.hs-tree-branch, .hs-tree-item');
            const active = track.querySelector('.hs-style-thumb.is-active');
            if (owner && owner.id && saved[owner.id] != null) {
                track.scrollLeft = saved[owner.id];
                // Still bring the active thumb into view if it is off-strip.
                if (active && (active.offsetLeft < track.scrollLeft
                    || active.offsetLeft + active.offsetWidth > track.scrollLeft + track.clientWidth)) {
                    track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
                }
            } else if (active) {
                track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
            }
            track.style.scrollBehavior = '';
            // The strip hides its scrollbar, so map the mouse wheel to
            // horizontal scrolling and keep the page from scrolling instead.
            if (!track._wheelBound) {
                track._wheelBound = true;
                track.addEventListener('wheel', (e) => {
                    if (track.scrollWidth <= track.clientWidth) return;
                    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                    if (!delta) return;
                    e.preventDefault();
                    track.scrollLeft += delta;
                }, { passive: false });
            }
        });
    },
    /**
     * A ship part's frame aspect and voxel grid size as the bay draws it,
     * so style thumbnails reproduce the same shape at a smaller size.
     */
    styleThumbGeometry(shipId, area, loader) {
        const model = this._hangarLastModel;
        if (!model || !model.layout || (this.hangarShipId || 'player_scrap') !== shipId) return null;
        const seg = (model.layout.segments || []).find((item) => item.id === area);
        if (!seg || !seg.width || !seg.height) return null;
        const scale = this._hangarLastScale || 1;
        const cell = loader.shipVoxelCell(model, scale);
        const res = loader.hullPartResolution(seg.width * scale, seg.height * scale,
            Number(model.layout.loadout && model.layout.loadout.voxelScale) || 0.5, scale);
        return {
            aspect: seg.width / seg.height,
            cols: Math.max(1, Math.round(seg.width * scale / cell)) || res.resW,
            rows: Math.max(1, Math.round(seg.height * scale / cell)) || res.resH
        };
    },
});
