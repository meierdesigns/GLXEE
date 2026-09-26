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
        this._hangarSelectedArea = area;

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
        const wingStyles = isWing ? loader.wingShapeVariants : [];
        // Outer parts own the joint that attaches them: nose → front joint,
        // aft → back joint, wings → wing bridge. The core has none of its own.
        const joint = isWing ? 'wing' : ({ front: 'spineFront', back: 'spineBack' }[area] || null);
        const jointLoadout = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager.getLoadout(shipId) : {};
        const hiddenJoint = joint && jointLoadout[{ wing: 'hideWingConnection', spineFront: 'hideSpineFront', spineBack: 'hideSpineBack' }[joint]];
        panel.innerHTML = `<strong>${isWing ? 'WING STYLE' : 'AREA STYLE'}</strong>` +
            (isWing ? `<canvas class="hs-floating-wing-preview" width="240" height="120" aria-label="Wing preview"></canvas>` : '') +
            `<div class="hs-floating-style-carousel" data-ship-tree="${shipId}">${window.componentTree.renderStyleCarousel(
                Array.from({ length: count }, (_, index) => ({
                    active: index === active,
                    locked: index !== active && !this.isStyleOwned(profileManager.hullStyleGroup(segmentId), index),
                    label: isWing ? wingStyles[index].label : (loader.bodyShapeVariantLabels(segmentId)[index] || `STYLE ${index + 1}`),
                    attrs: `data-panel-style="${index}"`,
                    thumb: `data-thumb="area" data-thumb-area="${area}" data-thumb-index="${index}"`
                }))
            )}</div>` +
            `<label class="hs-floating-style-select-label"><span>VOXEL SIZE</span>
                <input type="range" data-voxel-scale min="0.5" max="1.5" step="0.01" value="${this.getVoxelScaleValue(shipId)}">
            </label>` +
            (isWing ? `<div class="hs-floating-area-crop">
                <label><span>ROTATION</span><input type="range" data-wing-rotation min="-60" max="60" step="1" value="${this.getWingRotationValue(shipId)}"></label>
            </div>
            <button type="button" class="hs-floating-panel-link" data-open-connection>EDIT CONNECTION →</button>`
                : `<button type="button" class="hs-floating-panel-link" data-open-spine>EDIT CONNECTION →</button>`);
        panel.querySelectorAll('[data-show-joint]').forEach((input) => {
            input.addEventListener('change', () => {
                shipLoadoutManager.setConnectionHidden(shipId, joint, !input.checked);
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-open-spine]').forEach((button) => {
            button.addEventListener('click', () => this.showFloatingSpineConnectionStyle(area));
        });
        panel.querySelectorAll('[data-panel-style]').forEach((control) => {
            control.addEventListener('click', () => {
                profileManager.setSegmentShapeVariant(shipId, segmentId, Number(control.getAttribute('data-panel-style')));
                this.showFloatingAreaStyle(area);
                this.drawHangarBay();
                this.renderAllComponentTrees();
                this.bindComponentTreeEvents();
            });
        });
        panel.querySelectorAll('[data-show-joint]').forEach((input) => {
            input.addEventListener('change', () => {
                shipLoadoutManager.setConnectionHidden(shipId, joint, !input.checked);
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-open-spine]').forEach((button) => {
            button.addEventListener('click', () => this.showFloatingSpineConnectionStyle(area));
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
        if (isWing) {
            this.renderFloatingWingPreview(panel.querySelector('.hs-floating-wing-preview'), shipId, area, active);
        }
        stage.appendChild(panel);
        this.renderStyleThumbs(panel);
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
        this._hangarSelectedArea = null;
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
                        `<option value="${style}"${style === activeStyle ? ' selected' : ''}${style !== activeStyle && !this.isStyleOwned('joint', style) ? ' disabled' : ''}>${style.toUpperCase()}${style !== activeStyle && !this.isStyleOwned('joint', style) ? ' · LOCKED' : ''}</option>`
                    ).join('')}
                </select>
            </label>
            <label class="hs-floating-style-select-label"><span>VOXEL SIZE</span>
                <input type="range" data-wing-connection-voxel min="0" max="10" step="0.01" value="${this.getWingConnectionVoxelScaleValue(shipId)}">
            </label>
            <div class="hs-floating-area-crop">
                ${this.connectionStrengthRow('HULL', 'data-wing-connection-width', 0.02, 0.5, this.getWingConnectionWidthValue(shipId))}
                ${this.connectionStrengthRow('WING', 'data-wing-connection-width-end', 0.02, 0.5,
                    Number(shipLoadoutManager.getLoadout(shipId).wingConnectionWidthEnd) || this.getWingConnectionWidthValue(shipId))}
                <label class="hs-connection-link-ends"><input type="checkbox" data-link-ends${Number(shipLoadoutManager.getLoadout(shipId).wingConnectionWidthEnd) ? '' : ' checked'}> <span>SAME BOTH ENDS</span></label>
                <label><span>OFFSET</span><input type="range" data-wing-connection min="-1" max="1" step="0.01" value="${this.getWingConnectionValue(shipId)}"></label>
            </div>
            <button type="button" class="hs-floating-panel-link" data-open-wing>← BACK TO WING</button>`;

        panel.querySelectorAll('[data-wing-connection]').forEach((input) => {
            input.addEventListener('input', () => {
                shipLoadoutManager.setWingConnection(shipId, Number(input.value));
                this.drawHangarBay();
            });
        });
        this.bindConnectionStrength(panel, {
            start: '[data-wing-connection-width]',
            end: '[data-wing-connection-width-end]',
            setStart: (v) => shipLoadoutManager.setWingConnectionWidth(shipId, v),
            setEnd: (v) => shipLoadoutManager.setWingConnectionWidthEnd(shipId, v)
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

    /**
     * Settings of one spine joint: nose↔core (spineFront) or core↔aft
     * (spineBack). Each joint has its own style, strength and offset.
     */
    showFloatingSpineConnectionStyle(area, spineId = null) {
        if (!this.overlay || typeof shipLoadoutManager === 'undefined') return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (!stage) return;
        stage.querySelectorAll('.hs-floating-area-style, .hs-floating-connection-style')
            .forEach((el) => el.remove());
        // Mark the joint this panel edits: the clicked one, or the one next
        // to the area it was opened from.
        this._hangarSelectedConnection = spineId || (area === 'back' ? 'spineBack' : 'spineFront');
        this._hangarSelectedArea = null;
        this.drawHangarBay();

        const shipId = this.hangarShipId || 'player_scrap';
        const loadout = shipLoadoutManager.getLoadout(shipId);
        const joint = this._hangarSelectedConnection;
        const settings = resolveSpineJoint(loadout, joint);
        const activeStyle = settings.style;
        const start = settings.width;
        const end = settings.widthEnd || start;
        const panel = document.createElement('div');
        panel.className = 'hs-floating-area-style hs-floating-connection-style';
        panel.innerHTML = `<strong>${joint === 'spineBack' ? 'CORE ↔ AFT' : 'NOSE ↔ CORE'} CONNECTION</strong>
            <label class="hs-floating-style-select-label"><span>STYLE</span>
                <select class="hs-floating-style-select" data-spine-style-select>
                    ${['strut', 'plate', 'double', 'hinge'].map((style) =>
                        `<option value="${style}"${style === activeStyle ? ' selected' : ''}${style !== activeStyle && !this.isStyleOwned('joint', style) ? ' disabled' : ''}>${style.toUpperCase()}${style !== activeStyle && !this.isStyleOwned('joint', style) ? ' · LOCKED' : ''}</option>`
                    ).join('')}
                </select>
            </label>
            <div class="hs-floating-area-crop">
                ${this.connectionStrengthRow('FRONT', 'data-spine-width', 0.05, 0.6, start)}
                ${this.connectionStrengthRow('AFT', 'data-spine-width-end', 0.05, 0.6, end)}
                <label class="hs-connection-link-ends"><input type="checkbox" data-link-ends${settings.widthEnd ? '' : ' checked'}> <span>SAME BOTH ENDS</span></label>
                <label><span>OFFSET</span><input type="range" data-spine-offset min="-1" max="1" step="0.01" value="${settings.x}"></label>
            </div>
            <span class="hs-floating-preview-caption">DRAG THE JOINT'S CORNERS OR SIDES TO SCALE</span>
            <button type="button" class="hs-floating-panel-link" data-open-area>← BACK TO AREA</button>`;

        panel.querySelectorAll('[data-spine-style-select]').forEach((select) => {
            select.addEventListener('change', () => {
                shipLoadoutManager.setSpineConnectionStyle(shipId, select.value, joint);
                this.drawHangarBay();
            });
        });
        this.bindConnectionStrength(panel, {
            start: '[data-spine-width]',
            end: '[data-spine-width-end]',
            setStart: (v) => shipLoadoutManager.setSpineConnectionWidth(shipId, v, joint),
            setEnd: (v) => shipLoadoutManager.setSpineConnectionWidthEnd(shipId, v, joint)
        });
        panel.querySelectorAll('[data-spine-offset]').forEach((input) => {
            input.addEventListener('input', () => {
                shipLoadoutManager.setSpineConnectionX(shipId, Number(input.value), joint);
                this.drawHangarBay();
            });
        });
        panel.querySelectorAll('[data-open-area]').forEach((button) => {
            button.addEventListener('click', () => this.showFloatingAreaStyle(area));
        });
        stage.appendChild(panel);
    },

    /** Strength slider with a live % readout and fine −/+ steps. */
    connectionStrengthRow(label, attr, min, max, value) {
        const v = Number(value) || min;
        return `<div class="hs-connection-strength">
                <span>${label}</span>
                <button type="button" class="hs-connection-step" data-step="-1" data-for="${attr}" aria-label="${label} weaker">−</button>
                <input type="range" ${attr} min="${min}" max="${max}" step="0.01" value="${v}">
                <button type="button" class="hs-connection-step" data-step="1" data-for="${attr}" aria-label="${label} stronger">+</button>
                <output data-readout-for="${attr}">${Math.round(v * 100)}%</output>
            </div>`;
    },

    /**
     * Wire a start/end strength pair. With "same both ends" ticked the end
     * follows the start (stored as 0 = inherit); unticking splits them.
     */
    bindConnectionStrength(panel, opts) {
        const startInput = panel.querySelector(opts.start);
        const endInput = panel.querySelector(opts.end);
        const link = panel.querySelector('[data-link-ends]');
        if (!startInput || !endInput) return;
        const readout = (input) => {
            const out = panel.querySelector(`[data-readout-for="${input.getAttributeNames().find((n) => n.indexOf('data-') === 0)}"]`);
            if (out) out.textContent = Math.round(Number(input.value) * 100) + '%';
        };
        const linked = () => !link || link.checked;
        const apply = (source) => {
            if (linked()) {
                endInput.value = startInput.value;
                if (source === endInput) startInput.value = endInput.value;
            }
            endInput.disabled = linked();
            opts.setStart(Number(startInput.value));
            opts.setEnd(linked() ? 0 : Number(endInput.value));
            readout(startInput);
            readout(endInput);
            this.drawHangarBay();
        };
        startInput.addEventListener('input', () => apply(startInput));
        endInput.addEventListener('input', () => apply(endInput));
        if (link) link.addEventListener('change', () => apply(startInput));
        endInput.disabled = linked();
        panel.querySelectorAll('.hs-connection-step').forEach((button) => {
            button.addEventListener('click', () => {
                const input = panel.querySelector(`[${button.getAttribute('data-for')}]`);
                if (!input || input.disabled) return;
                input.value = String(Math.round((Number(input.value) + Number(button.getAttribute('data-step')) * 0.01) * 100) / 100);
                apply(input);
            });
        });
    },

    /** Pull strength values back into an open panel after a wheel nudge. */
    syncConnectionStrengthInputs(stage) {
        const loadout = shipLoadoutManager.getLoadout(this.hangarShipId || 'player_scrap');
        const set = (attr, value) => {
            const input = stage.querySelector(`[${attr}]`);
            if (!input) return;
            input.value = String(value);
            const out = stage.querySelector(`[data-readout-for="${attr}"]`);
            if (out) out.textContent = Math.round(Number(value) * 100) + '%';
        };
        const wingStart = Number(loadout.wingConnectionWidth) || 0.1;
        const spine = resolveSpineJoint(loadout, this._hangarSelectedConnection === 'spineBack' ? 'spineBack' : 'spineFront');
        set('data-wing-connection-width', wingStart);
        set('data-wing-connection-width-end', Number(loadout.wingConnectionWidthEnd) || wingStart);
        set('data-spine-width', spine.width);
        set('data-spine-width-end', spine.widthEnd || spine.width);
        const link = stage.querySelector('[data-link-ends]');
        if (link && link.checked) {
            const endInput = stage.querySelector('[data-wing-connection-width-end], [data-spine-width-end]');
            const startInput = stage.querySelector('[data-wing-connection-width], [data-spine-width]');
            if (startInput && endInput && endInput.value !== startInput.value) link.checked = false;
            if (endInput) endInput.disabled = link.checked;
        }
    },
});
