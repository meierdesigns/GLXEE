"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    renderComponentTree(shipId, treeContainer) {
        if (!this.overlay) return;
        shipId = shipId || this.hangarShipId || 'player_scrap';
        treeContainer = treeContainer || this.overlay.querySelector(`[data-ship-id="${shipId}"]`);
        if (!treeContainer) return;
        if (typeof window.componentTree !== 'undefined') {
            window.componentTree.setShip(shipId);
            treeContainer.querySelectorAll('.hs-tree-branch, .hs-tree-item').forEach((node) => {
                window.componentTree.setNodeExpanded(node.id, node.open);
            });
        }

        const modelClass = this.shipModelClass(
            shipId,
            typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(shipId) : null
        ) || 'starfighter';
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId)
            : null;
        const loadout = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getLoadout(shipId)
            : { weapons: [], defenses: [], abilities: [], energy: [] };
        const inventory = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getInventory(shipId)
            : loadout;
        const hangarSlots = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.buildHangarSlots)
            ? shipLoadoutManager.buildHangarSlots(shipId, modelClass, merged)
            : { slots: [] };

        if (typeof window.componentTree !== 'undefined') {
            const layoutModules = (hangarSlots.layout && hangarSlots.layout.modules) || [];
            const usedModules = new Set();
            const slotsWithAreas = (hangarSlots.slots || []).map((slot) => {
                const moduleIndex = slot.id
                    ? layoutModules.findIndex((candidate, index) =>
                        !usedModules.has(index)
                        && candidate.kind === slot.kind
                        && candidate.id === slot.id
                        && (!slot.face || candidate.face === slot.face)
                    )
                    : -1;
                const module = moduleIndex === -1 ? null : layoutModules[moduleIndex];
                if (moduleIndex !== -1) usedModules.add(moduleIndex);
                const mountSegment = module && module.mountSegment;
                const emptySlotArea = slot.kind === 'weapon'
                    ? (slot.index % 2 === 0 ? 'wingLeft' : 'wingRight')
                    : (slot.kind === 'ability' ? 'back' : 'center');
                const area = mountSegment === 'wing'
                    ? (module.face === 'right' ? 'wingRight' : 'wingLeft')
                    : (mountSegment || emptySlotArea);
                return { ...slot, area };
            });
            // Keep every style strip where the user left it across the
            // rebuild; only strips that never scrolled get centred.
            const trackScroll = {};
            treeContainer.querySelectorAll('.hs-style-carousel-track').forEach((track) => {
                const key = track.closest('.hs-tree-branch, .hs-tree-item');
                if (key && key.id) trackScroll[key.id] = track.scrollLeft;
            });
            this._styleTrackScroll = trackScroll;
            treeContainer.innerHTML = window.componentTree.render(
                { ...hangarSlots, slots: slotsWithAreas },
                loadout,
                inventory,
                (kind, slot, moduleId) => {
                    const skins = shipLoadoutManager.getAvailableSkins(kind);
                    const activeSkin = shipLoadoutManager.getModuleSkin(
                        shipId,
                        kind,
                        moduleId,
                        slot.face
                    );
                    return skins.map((skin) => ({
                        ...skin,
                        active: skin.id === activeSkin
                    }));
                },
                (area) => {
                    if (typeof profileManager === 'undefined'
                        || typeof graphicsManager === 'undefined'
                        || !graphicsManager.shipAssetLoader) {
                        return [];
                    }
                    const isWing = area === 'wingLeft' || area === 'wingRight';
                    const symmetric = !isWing || profileManager.getWingStyleSymmetry(shipId);
                    const segmentId = isWing && symmetric ? 'wing' : area;
                    const loader = graphicsManager.shipAssetLoader;
                    const count = segmentId === 'wing'
                        ? loader.wingShapeVariants.length
                        : loader.bodyShapeVariantCount(segmentId);
                    const savedStyle = profileManager.getSegmentShapeVariant(shipId, segmentId);
                    const defaultSegmentId = segmentId === 'wing'
                        ? 'wingLeft'
                        : segmentId;
                    const activeStyle = savedStyle == null
                        ? loader.hullShapeVariantIndex(
                            loader.resolveHullShapeSeed({ id: shipId }),
                            defaultSegmentId,
                            count
                        )
                        : savedStyle;
                    return {
                        isWing,
                        symmetric,
                        styles: Array.from({ length: count }, (_, index) => ({
                            segmentId,
                            index,
                            label: `STYLE ${index + 1}`,
                            active: index === activeStyle
                        }))
                    };
                }
            );
            this.appendConnectionBranches(treeContainer, shipId);
            this.renderStyleThumbs(treeContainer);
        }
    },

    /**
     * WING CONNECTION and HULL CONNECTION as their own expandable tree
     * sections, carrying the same settings as the floating joint panels.
     */
    appendConnectionBranches(treeContainer, shipId) {
        const root = treeContainer.querySelector('.hs-tree-root');
        if (!root || typeof shipLoadoutManager === 'undefined' || !window.componentTree) return;
        const tree = window.componentTree;
        const lo = shipLoadoutManager.getLoadout(shipId);
        const styles = ['strut', 'plate', 'double', 'hinge'];
        const styleCarousel = (joint, active) => tree.renderStyleCarousel(styles.map((style) => ({
            active: style === active,
            label: style.toUpperCase(),
            attrs: `data-tree-joint-style="${joint}" data-style-id="${style}"`,
            thumb: `data-thumb="joint" data-thumb-style="${style}"`
        })));
        const toggle = (joint, key, label) =>
            `<label class="hs-connection-link-ends"><input type="checkbox" data-tree-joint-show="${joint}"${lo[key] ? '' : ' checked'}> <span>${label}</span></label>`;
        const branch = (id, icon, label, body) => {
            const nodeId = `hs-tree-conn-${id}`;
            return `<details class="hs-tree-branch hs-tree-connection" id="${nodeId}"${tree.expandedNodes.has(nodeId) ? ' open' : ''}>
                <summary class="hs-tree-branch-label">
                    <span class="hs-tree-toggle">▶</span>
                    <span class="hs-tree-icon">${icon}</span>
                    <span class="hs-tree-text">${label}</span>
                </summary>
                <div class="hs-tree-items hs-tree-connection-body" data-joint-panel="${id}">${body}</div>
            </details>`;
        };
        const wingStart = Number(lo.wingConnectionWidth) || 0.1;
        const spineStart = Number(lo.spineConnectionWidth) || 0.18;
        const html =
            branch('wing', '╪', 'WING CONNECTION', `
                <span class="hs-tree-skin-label">STYLE</span>
                ${styleCarousel('wing', lo.wingConnectionStyle || 'strut')}
                ${toggle('wing', 'hideWingConnection', 'SHOW')}
                ${this.connectionStrengthRow('HULL', 'data-wing-connection-width', 0.02, 0.5, wingStart)}
                ${this.connectionStrengthRow('WING', 'data-wing-connection-width-end', 0.02, 0.5, Number(lo.wingConnectionWidthEnd) || wingStart)}
                <label class="hs-connection-link-ends"><input type="checkbox" data-link-ends${Number(lo.wingConnectionWidthEnd) ? '' : ' checked'}> <span>SAME BOTH ENDS</span></label>
                <label class="hs-tree-joint-range"><span>OFFSET</span><input type="range" data-tree-joint-offset="wing" min="-1" max="1" step="0.01" value="${Number(lo.wingConnectionY) || 0}"></label>`) +
            branch('hull', '╫', 'HULL CONNECTION', `
                <span class="hs-tree-skin-label">STYLE</span>
                ${styleCarousel('hull', lo.spineConnectionStyle || 'strut')}
                ${toggle('spineFront', 'hideSpineFront', 'SHOW NOSE ↔ CORE')}
                ${toggle('spineBack', 'hideSpineBack', 'SHOW CORE ↔ AFT')}
                ${this.connectionStrengthRow('FRONT', 'data-spine-width', 0.05, 0.6, spineStart)}
                ${this.connectionStrengthRow('AFT', 'data-spine-width-end', 0.05, 0.6, Number(lo.spineConnectionWidthEnd) || spineStart)}
                <label class="hs-connection-link-ends"><input type="checkbox" data-link-ends${Number(lo.spineConnectionWidthEnd) ? '' : ' checked'}> <span>SAME BOTH ENDS</span></label>
                <label class="hs-tree-joint-range"><span>OFFSET</span><input type="range" data-tree-joint-offset="hull" min="-1" max="1" step="0.01" value="${Number(lo.spineConnectionX) || 0}"></label>`);
        root.insertAdjacentHTML('beforeend', html);

        const refresh = () => {
            this.renderAllComponentTrees();
            this.bindComponentTreeEvents();
            this.drawHangarBay();
        };
        root.querySelectorAll('[data-tree-joint-style]').forEach((button) => {
            button.addEventListener('click', () => {
                const style = button.getAttribute('data-style-id');
                if (button.getAttribute('data-tree-joint-style') === 'wing') {
                    shipLoadoutManager.setWingConnectionStyle(shipId, style);
                } else {
                    shipLoadoutManager.setSpineConnectionStyle(shipId, style);
                }
                refresh();
            });
        });
        root.querySelectorAll('[data-tree-joint-show]').forEach((input) => {
            input.addEventListener('change', () => {
                shipLoadoutManager.setConnectionHidden(shipId, input.getAttribute('data-tree-joint-show'), !input.checked);
                this.drawHangarBay();
            });
        });
        root.querySelectorAll('[data-tree-joint-offset]').forEach((input) => {
            input.addEventListener('input', () => {
                if (input.getAttribute('data-tree-joint-offset') === 'wing') {
                    shipLoadoutManager.setWingConnection(shipId, Number(input.value));
                } else {
                    shipLoadoutManager.setSpineConnectionX(shipId, Number(input.value));
                }
                this.drawHangarBay();
            });
        });
        const wingPanel = root.querySelector('[data-joint-panel="wing"]');
        const hullPanel = root.querySelector('[data-joint-panel="hull"]');
        if (wingPanel) {
            this.bindConnectionStrength(wingPanel, {
                start: '[data-wing-connection-width]',
                end: '[data-wing-connection-width-end]',
                setStart: (v) => shipLoadoutManager.setWingConnectionWidth(shipId, v),
                setEnd: (v) => shipLoadoutManager.setWingConnectionWidthEnd(shipId, v)
            });
        }
        if (hullPanel) {
            this.bindConnectionStrength(hullPanel, {
                start: '[data-spine-width]',
                end: '[data-spine-width-end]',
                setStart: (v) => shipLoadoutManager.setSpineConnectionWidth(shipId, v),
                setEnd: (v) => shipLoadoutManager.setSpineConnectionWidthEnd(shipId, v)
            });
        }
    },

    /**
     * Paint every style thumbnail canvas under root: hull areas via the
     * procedural part renderers, module skins via the module renderer — the
     * same art the ship shows, in the ship's faction colours. The active
     * thumbnail is scrolled into view so the strip opens on the choice.
     */
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
            Number(model.layout.loadout && model.layout.loadout.voxelScale) || 1, scale);
        return {
            aspect: seg.width / seg.height,
            cols: Math.max(1, Math.round(seg.width * scale / cell)) || res.resW,
            rows: Math.max(1, Math.round(seg.height * scale / cell)) || res.resH
        };
    },

    renderAllComponentTrees() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-component-tree[data-ship-id]').forEach((tree) => {
            this.renderComponentTree(tree.getAttribute('data-ship-id'), tree);
        });
    },

    bindComponentTreeEvents() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-tree-branch, .hs-tree-item').forEach((node) => {
            node.addEventListener('toggle', () => {
                if (typeof window.componentTree === 'undefined' || !node.id) return;
                const shipTree = node.closest('[data-ship-tree]');
                if (shipTree) {
                    window.componentTree.setShip(shipTree.getAttribute('data-ship-tree'));
                }
                window.componentTree.setNodeExpanded(node.id, node.open);
            });
        });

        this.overlay.querySelectorAll('.hs-tree-slot-select').forEach((select) => {
            select.addEventListener('change', (event) => {
                const kind = select.getAttribute('data-slot-kind');
                const slotIndex = Number(select.getAttribute('data-slot-index'));
                const selectedId = event.target.value;
                const shipTree = select.closest('[data-ship-tree]');
                const shipId = shipTree ? shipTree.getAttribute('data-ship-tree') : this.hangarShipId;
                const loadoutKeys = {
                    weapon: 'weapons',
                    defense: 'defenses',
                    ability: 'abilities',
                    energy: 'energy'
                };
                const loadoutKey = loadoutKeys[kind];

                if (!loadoutKey || typeof shipLoadoutManager === 'undefined') return;
                const loadout = shipLoadoutManager.getLoadout(shipId);
                const modules = loadout[loadoutKey];
                const currentId = modules[slotIndex];

                if (!selectedId) {
                    if (kind === 'weapon' && modules.length <= 1) {
                        this.setStatus('AT LEAST ONE WEAPON IS REQUIRED');
                        this.renderAllComponentTrees();
                        return;
                    }
                    modules.splice(slotIndex, 1);
                } else {
                    const selectedIndex = modules.indexOf(selectedId);
                    if (selectedIndex !== -1 && selectedIndex !== slotIndex) {
                        modules[selectedIndex] = currentId;
                    }
                    modules[slotIndex] = selectedId;
                }
                shipLoadoutManager.setLoadout(shipId, loadout);
                this.renderAllComponentTrees();
                this.drawHangarBay();
            });
        });

        this.overlay.querySelectorAll('[data-tree-skin-set]').forEach((button) => {
            button.addEventListener('click', () => {
                if (typeof shipLoadoutManager === 'undefined') return;
                const kind = button.getAttribute('data-tree-skin-set');
                const slotIndex = Number(button.getAttribute('data-slot-index'));
                const face = button.getAttribute('data-mod-face') || '';
                const skinId = button.getAttribute('data-skin-id') || 'default';
                const shipTree = button.closest('[data-ship-tree]');
                const shipId = shipTree ? shipTree.getAttribute('data-ship-tree') : this.hangarShipId;
                const loadoutKey = shipLoadoutManager.kindToLoadoutKey(kind);
                const moduleId = loadoutKey
                    ? shipLoadoutManager.getLoadout(shipId)[loadoutKey][slotIndex]
                    : null;
                if (!moduleId) return;

                shipLoadoutManager.setModuleSkin(
                    shipId,
                    kind,
                    moduleId,
                    face,
                    skinId
                );
                this.renderAllComponentTrees();
                this.bindComponentTreeEvents();
                this.drawHangarBay();
            });
        });

        this.overlay.querySelectorAll('[data-tree-area-style]').forEach((button) => {
            button.addEventListener('click', () => {
                if (typeof profileManager === 'undefined') return;
                const segmentId = button.getAttribute('data-segment-id');
                const styleIndex = Number(button.getAttribute('data-style-index'));
                const shipTree = button.closest('[data-ship-tree]');
                const shipId = shipTree ? shipTree.getAttribute('data-ship-tree') : this.hangarShipId;
                if (!segmentId || !Number.isInteger(styleIndex)) return;

                profileManager.setSegmentShapeVariant(shipId, segmentId, styleIndex);
                this.renderAllComponentTrees();
                this.bindComponentTreeEvents();
                this.drawHangarBay();
            });
        });

        this.overlay.querySelectorAll('[data-tree-wing-symmetry]').forEach((button) => {
            button.addEventListener('click', () => {
                if (typeof profileManager === 'undefined') return;
                const enableSymmetry = button.getAttribute('data-tree-wing-symmetry') !== 'on';
                const shipTree = button.closest('[data-ship-tree]');
                const shipId = shipTree ? shipTree.getAttribute('data-ship-tree') : this.hangarShipId;
                profileManager.setWingStyleSymmetry(shipId, enableSymmetry);
                this.renderAllComponentTrees();
                this.bindComponentTreeEvents();
                this.drawHangarBay();
            });
        });
    },
});
