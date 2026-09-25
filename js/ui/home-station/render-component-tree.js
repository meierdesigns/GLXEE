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
        }
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
