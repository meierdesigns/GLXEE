"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    updateComponentDetails(kind, index, same) {
        if (!this.overlay) return;
        const detailsPanel = this.overlay.querySelector('#hsComponentDetails');
        const hangarList = this.overlay.querySelector('.hs-hangar-list');
        const titleEl = detailsPanel?.querySelector('.hs-component-title');
        const infoEl = detailsPanel?.querySelector('.hs-component-info');
        const settingsEl = detailsPanel?.querySelector('.hs-component-settings');
        
        if (same || !kind) {
            // Hide details, show ships
            if (hangarList) hangarList.classList.remove('hs-component-selected');
            return;
        }

        // Always show the title with component name
        if (titleEl) {
            const typeLabel = kind.toUpperCase();
            titleEl.textContent = `${typeLabel} ${index + 1}`;
        }

        // Get component info
        if (typeof shipLoadoutManager === 'undefined') {
            // Show details panel and hide ships
            if (hangarList) hangarList.classList.add('hs-component-selected');
            if (infoEl) infoEl.textContent = '';
            if (settingsEl) settingsEl.innerHTML = '';
            return;
        }

        const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
        const key = shipLoadoutManager.kindToLoadoutKey(kind);
        const modId = (loadout[key] || [])[index];
        const slotEl = this.overlay.querySelector(
            `.hs-hangar-slot[data-slot-kind="${kind}"][data-slot-index="${index}"]`
        );
        const slotPin = slotEl ? slotEl.querySelector('.hs-hangar-slot-pin') : null;
        const modFace = slotPin ? (slotPin.getAttribute('data-mod-face') || '') : '';
        
        // Update settings (skins)
        if (settingsEl) {
            if (!modId) {
                settingsEl.innerHTML = '';
            } else {
                const skins = shipLoadoutManager.getAvailableSkins ? shipLoadoutManager.getAvailableSkins(kind) : [];
                if (skins && skins.length > 1) {
                    const activeSkin = shipLoadoutManager.getModuleSkin
                        ? shipLoadoutManager.getModuleSkin(this.hangarShipId, kind, modId, modFace)
                        : 'default';
                    const skinHtml = `
                        <div class="hs-component-skins">
                            <label class="hs-component-skins-label">SKIN</label>
                            <div class="hs-component-skins-options">
                                ${skins.map((s) => `<button type="button" class="hs-component-skin-btn${s.id === activeSkin ? ' is-active' : ''}" data-skin-kind="${kind}" data-slot-index="${index}" data-skin-id="${s.id}">${s.label}</button>`).join('')}
                            </div>
                        </div>
                    `;
                    settingsEl.innerHTML = skinHtml;
                    
                    // Bind skin button events
                    settingsEl.querySelectorAll('[data-skin-kind]').forEach((btn) => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const skinKind = btn.getAttribute('data-skin-kind');
                            const slotIdx = Number(btn.getAttribute('data-slot-index'));
                            const skinId = btn.getAttribute('data-skin-id');
                            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.setModuleSkin) {
                                shipLoadoutManager.setModuleSkin(this.hangarShipId, skinKind, modId, modFace, skinId);
                                // Also persist by slot so the selected area keeps its
                                // cosmetic when the same module is mounted more than once.
                                if (shipLoadoutManager.setSlotSkin) {
                                    shipLoadoutManager.setSlotSkin(this.hangarShipId, skinKind, slotIdx, skinId);
                                }
                                this.updateComponentDetails(kind, index, false);
                                this.drawHangarBay();
                            }
                        });
                    });
                } else {
                    settingsEl.innerHTML = '';
                }
            }
        }
        
        if (!modId) {
            // Show details panel and hide ships (even if slot is empty)
            if (hangarList) hangarList.classList.add('hs-component-selected');
            if (infoEl) infoEl.textContent = '(Empty slot)';
            return;
        }

        // Get module info from library
        const lib = typeof moduleLibrary !== 'undefined' ? moduleLibrary : null;
        const mod = lib ? lib.getModule(kind, modId) : null;
        
        if (infoEl) {
            let info = `${mod?.label || modId}`;
            if (mod?.description) {
                info += `\n\n${mod.description}`;
            }
            if (mod?.stats) {
                info += '\n\n--- STATS ---';
                for (const [key, val] of Object.entries(mod.stats)) {
                    info += `\n${key}: ${val}`;
                }
            }
            infoEl.textContent = info;
        }
        
        // Show details panel and hide ships
        if (hangarList) hangarList.classList.add('hs-component-selected');
    },

    showFloatingAreaStyle(area) {
        if (!this.overlay || typeof profileManager === 'undefined'
            || typeof graphicsManager === 'undefined'
            || !graphicsManager.shipAssetLoader) return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (!stage) return;
        stage.querySelectorAll('.hs-floating-area-style, .hs-floating-connection-style')
            .forEach((el) => el.remove());
        this._hangarSelectedConnection = null;

        const shipId = this.hangarShipId || 'player_scrap';
        const isWing = area === 'wingLeft' || area === 'wingRight';
        const symmetric = !isWing || profileManager.getWingStyleSymmetry(shipId);
        const segmentId = isWing && symmetric ? 'wing' : area;
        const loader = graphicsManager.shipAssetLoader;
        const count = segmentId === 'wing'
            ? loader.wingShapeVariants.length
            : loader.bodyShapeVariantCount(segmentId);
        const saved = profileManager.getSegmentShapeVariant(shipId, segmentId);
        const fallbackId = segmentId === 'wing' ? 'wingLeft' : segmentId;
        const active = saved == null
            ? loader.hullShapeVariantIndex(loader.resolveHullShapeSeed({ id: shipId }), fallbackId, count)
            : saved;

        const panel = document.createElement('div');
        panel.className = 'hs-floating-area-style'
            + (area === 'wingLeft' ? ' is-right' : '');
        panel.innerHTML = `<strong>${isWing ? 'WING STYLE' : 'AREA STYLE'}</strong>` +
            (isWing ? `<canvas class="hs-floating-wing-preview" width="240" height="120" aria-label="Wing crop preview"></canvas>
                <span class="hs-floating-preview-caption">VISIBLE CROP</span>` : '') +
            `<label class="hs-floating-style-select-label"><span>STYLE</span>
                <select class="hs-floating-style-select" data-style-select>
                    ${Array.from({ length: count }, (_, index) =>
                        `<option value="${index}"${index === active ? ' selected' : ''}>STYLE ${index + 1}</option>`
                    ).join('')}
                </select>
            </label>` +
            `<label class="hs-floating-style-select-label"><span>VOXEL SIZE</span>
                <input type="range" data-voxel-scale min="0.1" max="10" step="0.01" value="${this.getVoxelScaleValue(shipId)}">
            </label>` +
            (isWing ? `<div class="hs-floating-area-crop">
                <label><span>CROP X</span><input type="range" data-crop="x" min="0" max="0.9" step="0.01" value="${this.getWingCropValue(shipId, 'x')}"></label>
                <label><span>CROP Y</span><input type="range" data-crop="y" min="0" max="0.9" step="0.01" value="${this.getWingCropValue(shipId, 'y')}"></label>
                <label><span>CROP W</span><input type="range" data-crop="w" min="0.05" max="1" step="0.01" value="${this.getWingCropValue(shipId, 'w')}"></label>
                <label><span>CROP H</span><input type="range" data-crop="h" min="0.05" max="1" step="0.01" value="${this.getWingCropValue(shipId, 'h')}"></label>
                <label><span>ROTATION</span><input type="range" data-wing-rotation min="-60" max="60" step="1" value="${this.getWingRotationValue(shipId)}"></label>
            </div>
            <button type="button" class="hs-floating-panel-link" data-open-connection>EDIT CONNECTION →</button>` : '');
        panel.querySelectorAll('[data-style-select]').forEach((select) => {
            select.addEventListener('change', () => {
                profileManager.setSegmentShapeVariant(
                    shipId,
                    segmentId,
                    Number(select.value)
                );
                this.showFloatingAreaStyle(area);
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-crop]').forEach((input) => {
            input.addEventListener('input', () => {
                if (typeof shipConfigManager === 'undefined') return;
                const cfg = shipConfigManager.getConfig(shipId);
                const wingCrop = Object.assign({}, this.getWingCrop(shipId), {
                    [input.getAttribute('data-crop')]: Number(input.value)
                });
                shipConfigManager.setConfig(shipId, {
                    segmentUv: Object.assign({}, cfg.segmentUv || {}, { wingCrop: wingCrop })
                });
                this.renderFloatingWingCropPreview(panel, shipId, area);
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-open-connection]').forEach((button) => {
            button.addEventListener('click', () => this.showFloatingConnectionStyle(area));
        });
        panel.querySelectorAll('[data-voxel-scale]').forEach((input) => {
            input.addEventListener('input', () => {
                if (typeof shipLoadoutManager === 'undefined'
                    || !shipLoadoutManager.setVoxelScale) return;
                shipLoadoutManager.setVoxelScale(shipId, Number(input.value));
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-wing-rotation]').forEach((input) => {
            input.addEventListener('input', () => {
                if (typeof shipLoadoutManager === 'undefined'
                    || !shipLoadoutManager.setWingRotation) return;
                shipLoadoutManager.setWingRotation(shipId, Number(input.value));
                this.drawHangarBay();
            });
        });
        if (isWing) this.renderFloatingWingCropPreview(panel, shipId, area);
        stage.appendChild(panel);
    },

    /**
     * Wing-to-hull connection settings. Opened by clicking the connector
     * itself in the bay, so it stays separate from the wing's own panel.
     */
    showFloatingConnectionStyle(area) {
        if (!this.overlay || typeof shipLoadoutManager === 'undefined') return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (!stage) return;
        stage.querySelectorAll('.hs-floating-area-style, .hs-floating-connection-style')
            .forEach((el) => el.remove());
        this._hangarSelectedConnection = area === 'wingRight' ? 'wingRight' : 'wingLeft';
        this.drawHangarBay();

        const shipId = this.hangarShipId || 'player_scrap';
        const panel = document.createElement('div');
        panel.className = 'hs-floating-area-style hs-floating-connection-style'
            + (area === 'wingLeft' ? ' is-right' : '');
        const activeStyle = this.getWingConnectionStyle(shipId);
        panel.innerHTML = `<strong>WING CONNECTION</strong>
            <label class="hs-floating-style-select-label"><span>STYLE</span>
                <select class="hs-floating-style-select" data-wing-connection-style-select>
                    ${['strut', 'plate', 'double', 'hinge'].map((style) =>
                        `<option value="${style}"${style === activeStyle ? ' selected' : ''}>${style.toUpperCase()}</option>`
                    ).join('')}
                </select>
            </label>
            <label class="hs-floating-style-select-label"><span>VOXEL SIZE</span>
                <input type="range" data-wing-connection-voxel min="0" max="10" step="0.01" value="${this.getWingConnectionVoxelScaleValue(shipId)}">
            </label>
            <div class="hs-floating-area-crop">
                <label><span>STRENGTH</span><input type="range" data-wing-connection-width min="0.02" max="0.5" step="0.01" value="${this.getWingConnectionWidthValue(shipId)}"></label>
                <label><span>OFFSET</span><input type="range" data-wing-connection min="-1" max="1" step="0.01" value="${this.getWingConnectionValue(shipId)}"></label>
            </div>
            <button type="button" class="hs-floating-panel-link" data-open-wing>← BACK TO WING</button>`;

        panel.querySelectorAll('[data-wing-connection]').forEach((input) => {
            input.addEventListener('input', () => {
                shipLoadoutManager.setWingConnection(shipId, Number(input.value));
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-wing-connection-width]').forEach((input) => {
            input.addEventListener('input', () => {
                shipLoadoutManager.setWingConnectionWidth(shipId, Number(input.value));
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-wing-connection-style-select]').forEach((select) => {
            select.addEventListener('change', () => {
                shipLoadoutManager.setWingConnectionStyle(shipId, select.value);
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-wing-connection-voxel]').forEach((input) => {
            input.addEventListener('input', () => {
                shipLoadoutManager.setWingConnectionVoxelScale(shipId, Number(input.value));
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-open-wing]').forEach((button) => {
            button.addEventListener('click', () => this.showFloatingAreaStyle(area));
        });
        stage.appendChild(panel);
    },
});
