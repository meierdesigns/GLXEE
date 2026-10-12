"use strict";

// HomeStationUI members, continued from render-component-tree.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
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
                // Accordion: opening a section closes its open siblings.
                if (!this._areaPager && node.open && node.classList.contains('hs-tree-branch') && node.parentElement) {
                    Array.from(node.parentElement.children).forEach((sib) => {
                        if (sib !== node && sib.classList.contains('hs-tree-branch') && sib.open) sib.open = false;
                    });
                }
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
                // The tree renders the equipped id on the option; the slot
                // index can drift from the loadout list (toggle-only parts
                // like abilities), which made the pick a silent no-op.
                const list = loadoutKey ? (shipLoadoutManager.getLoadout(shipId)[loadoutKey] || []) : [];
                const moduleId = button.getAttribute('data-mod-id') || list[slotIndex] || null;
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
