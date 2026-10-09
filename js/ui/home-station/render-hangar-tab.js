"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    renderHangarTab(profile) {
        const owned = profile.ownedShipIds || [];
        if (!owned.length) {
            return `<div class="hs-section"><h3>HANGAR</h3><p class="hs-muted">No ships owned.</p></div>`;
        }
        if (!this.hangarShipId || owned.indexOf(this.hangarShipId) === -1) {
            this.hangarShipId = profile.activeShipId || owned[0];
        }
        const shipId = this.hangarShipId;
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
            : { slots: [], caps: { weapons: 2, defenses: 1, abilities: 1, energy: 1 }, layout: { width: 0, height: 0 }, width: 0, height: 0 };
        const caps = hangarSlots.caps || { weapons: 2, defenses: 1, abilities: 1, energy: 1 };
        const layout = hangarSlots.layout || { width: hangarSlots.width || 0, height: hangarSlots.height || 0 };
        const frameLevel = (typeof profileManager !== 'undefined')
            ? profileManager.getShipFrameLevel(shipId, profile)
            : 0;
        const frameMax = (typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 9) : 9;
        const frameCheck = (typeof profileManager !== 'undefined' && profileManager.canPurchaseShipFrameUpgrade)
            ? profileManager.canPurchaseShipFrameUpgrade(shipId, profile)
            : { ok: false };
        const frameCost = !frameCheck.ok && frameCheck.cost
            ? frameCheck.cost
            : (frameCheck.ok
                ? frameCheck.cost
                : ((typeof economyConfig !== 'undefined' && economyConfig.getShipFrameUpgradeCost)
                    ? economyConfig.getShipFrameUpgradeCost(frameLevel + 1)
                    : null));
        const frameMaxed = frameLevel >= frameMax;

        // Areas view: only the current ship's tree. Ships view: a plain picker.
        const shipButtons = (this._hangarLeftView === 'ships' ? [] : owned.filter((id) => id === shipId)).map((id) => {
            const selected = id === profile.activeShipId ? ' ★' : '';
            return `
                <details class="hs-hangar-ship-tree" data-ship-tree="${id}"${id === shipId ? ' open' : ''}>
                    <summary class="hs-hangar-ship${id === shipId ? ' active' : ''}" data-hangar-ship="${id}">
                        <span class="hs-btn-icon">${this.iconHtml('hsShip', 24, 'hs-pixel hs-pixel-24')}</span>
                        <span>${this.shipName(id)}${selected}</span>
                    </summary>
                    <div class="hs-component-tree-container" aria-label="${this.shipName(id)} components">
                        <div class="hs-component-tree-header">COMPONENTS</div>
                        <div class="hs-component-tree" data-ship-id="${id}"></div>
                    </div>
                </details>`;
        }).join('');
        const shipPicker = owned.map((id) => {
            const selected = id === profile.activeShipId ? ' ★' : '';
            return `<button type="button" class="hs-hangar-ship hs-hangar-ship-pick${id === shipId ? ' active' : ''}" data-hangar-ship="${id}">` +
                `<span class="hs-btn-icon">${this.iconHtml('hsShip', 24, 'hs-pixel hs-pixel-24')}</span>` +
                `<span>${this.shipName(id)}${selected}</span></button>`;
        }).join('');

        const powerBudget = (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.computePowerBudget)
            ? shipLoadoutManager.computePowerBudget(loadout)
            : { gen: 0, idleDraw: 0, net: 0 };
        const netSign = powerBudget.net >= 0 ? '+' : '';
        const powerLine = `POWER · GEN ${powerBudget.gen}/s · IDLE DRAW ${powerBudget.idleDraw}/s · NET ${netSign}${powerBudget.net}/s`;

        const equippedByKind = {
            weapon: {},
            defense: {},
            ability: {},
            energy: {}
        };
        (loadout.weapons || []).forEach((id) => { equippedByKind.weapon[id] = true; });
        (loadout.defenses || []).forEach((id) => { equippedByKind.defense[id] = true; });
        (loadout.abilities || []).forEach((id) => { equippedByKind.ability[id] = true; });
        (loadout.energy || []).forEach((id) => { equippedByKind.energy[id] = true; });

        const slots = (hangarSlots.slots || []).slice();
        // Force even left/right rail fill so every slot card is visible
        slots.forEach((slot, i) => {
            slot.side = (i % 2 === 0) ? 'left' : 'right';
        });
        const leftSlots = [];
        const rightSlots = [];
        slots.forEach((slot) => {
            if (slot.side === 'left') leftSlots.push(slot);
            else rightSlots.push(slot);
        });
        // Stable vertical order: weapons → defenses → energy → abilities
        const kindOrder = { weapon: 0, defense: 1, energy: 2, ability: 3 };
        const sortRail = (arr) => arr.sort((a, b) => {
            const ka = kindOrder[a.kind] != null ? kindOrder[a.kind] : 9;
            const kb = kindOrder[b.kind] != null ? kindOrder[b.kind] : 9;
            if (ka !== kb) return ka - kb;
            return (a.index || 0) - (b.index || 0);
        });
        sortRail(leftSlots);
        sortRail(rightSlots);
        leftSlots.forEach((slot, i) => {
            slot.railIndex = i;
            slot.railCount = leftSlots.length;
            slot.side = 'left';
        });
        rightSlots.forEach((slot, i) => {
            slot.railIndex = i;
            slot.railCount = rightSlots.length;
            slot.side = 'right';
        });

        const slotHtml = slots.map((slot) =>
            this.renderHangarSlotDropdown(slot, inventory, equippedByKind)
        ).join('');

        const filledSlots = (hangarSlots.slots || []).filter((s) => s && !s.empty).length;
        const totalSlots = (hangarSlots.slots || []).length;

        return `
            <div class="hs-section hs-panel hs-hangar-root">
                <h3 class="hs-panel-title">
                    <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                    <span class="hs-panel-label">HANGAR — OPEN BAY</span>
                    <span class="hs-panel-scan" aria-hidden="true"></span>
                    <label class="hs-hangar-voxel is-in-title" title="Voxel size of the whole ship">
                        <span>VOXEL SIZE</span>
                        <input type="range" data-voxel-scale data-hangar-voxel min="0.2" max="1.5" step="0.05" value="${this.getVoxelScaleValue(this.hangarShipId)}">
                        <output data-hangar-voxel-out>${this.getVoxelScaleValue(this.hangarShipId).toFixed(2)}×</output>
                    </label>
                </h3>
                <div class="hs-hangar-detail-head hs-panel">
                    <div class="hs-hangar-head-title">
                        <span class="hs-chip-icon">${this.iconHtml('hsShip', 24, 'hs-pixel hs-pixel-24')}</span>
                        <strong class="hs-hangar-head-name">${this.shipName(shipId)}</strong>
                        ${shipId === profile.activeShipId
                            ? '<span class="hs-hangar-active-tag">★ ACTIVE</span>'
                            : `<button type="button" class="action-button hs-activate-ship" data-activate-ship="${shipId}">SET ACTIVE</button>`}
                    </div>
                    <div class="hs-hangar-stats is-row">
                        <div class="hs-stat-group is-slots" role="group" aria-label="Slots">
                        ${[['statWeapon', 'weapon', 'WEAPON SLOTS', loadout.weapons.length,
                            // caps.weapons counts guns (a split pair = 2); a slot is one weapon, split or not.
                            (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.weaponMountSlots)
                                ? shipLoadoutManager.weaponMountSlots(caps.weapons) : caps.weapons],
                            ['statArmor', 'defense', 'DEFENSE SLOTS', loadout.defenses.length, caps.defenses],
                            ['statAbilities', 'ability', 'ABILITY SLOTS', loadout.abilities.length, caps.abilities],
                            ['statEnergy', 'energy', 'ENERGY SLOTS', (loadout.energy || []).length, caps.energy || 1]]
                            // One tile per slot type, in the global category colour code.
                            .map(([ic, kind, label, n, cap]) => this.hangarStatTile(ic, label, `${n}<span class="hs-stat-of">/${cap}</span>`,
                                `${label}: ${n} of ${cap} used (${this.shipName(shipId)})`, '', ' is-slot' + (n >= cap ? ' is-full' : ''),
                                (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor) ? iconRenderer.getModuleKindColor(kind) : null)).join('')}
                        </div>
                        ${this.renderHangarAreaUpgrades(shipId, profile)}
                        <div class="hs-stat-group is-stats" role="group" aria-label="Ship stats">
                        ${this.hangarStatTile('hsShip', 'SIZE', `${layout.width}<span class="hs-stat-x">×</span>${layout.height}`, 'Hull footprint in voxels', '')}
                        ${this.hangarStatTile('hsUpgrade', 'AREAS', `${frameLevel}<span class="hs-stat-of">/${frameMax}</span>`, 'Hull area levels (open new slots, add hull HP)', '')}
                        ${(() => {
                            // Move speed after ability effects; ability hover previews change it (bindHangarAbilityHover).
                            const pm = this.getHangarPreviewModel(shipId);
                            return this.hangarStatTile('statSpeed', 'SPEED', `${pm.speed}`, 'Move speed (after abilities)', '', ' is-speed');
                        })()}
                        ${this.hangarStatTile('statEnergy', 'POWER', `${netSign}${powerBudget.net}<span class="hs-stat-of">/s</span>`, powerLine, '',
                            powerBudget.net < 0 ? ' is-negative' : '',
                            (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor) ? iconRenderer.getModuleKindColor('energy') : null)}
                        </div>
                    </div>
                </div>
                <div class="hs-hangar-split${this._hangarLeftCollapsed ? ' hs-hangar-left-collapsed' : ''}${this._hangarRightCollapsed ? ' hs-hangar-right-collapsed' : ''}">
                    <aside class="hs-hangar-list hs-panel">
                        <h3 class="hs-panel-title">
                            <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                            <span class="hs-panel-label">${this._hangarLeftView === 'parts' ? 'PARTS' : 'SHIPS'}</span>
                            <span class="hs-panel-scan" aria-hidden="true"></span>
                            ${this.renderHangarLeftViewToggle()}
                            <button type="button" class="hs-sidebar-toggle hs-sidebar-strip" data-hangar-sidebar="left"
                                aria-label="Expand ship list" aria-expanded="${!this._hangarLeftCollapsed}"><span class="hs-collapsed-label">${this._hangarLeftView === 'parts' ? 'PARTS' : 'SHIPS'} ›</span></button>
                        </h3>
                        ${this._hangarLeftView === 'parts'
                            ? this.renderHangarPartsGrid(inventory, loadout)
                            : this._hangarLeftView === 'ships'
                            ? `<div class="hs-actions-col hs-hangar-ships is-picker" id="hsHangarShipsContainer">${shipPicker}</div>`
                            : `<div class="hs-actions-col hs-hangar-ships" id="hsHangarShipsContainer">${shipButtons}</div>`}
                        <div class="hs-component-details" id="hsComponentDetails">
                            <button type="button" class="hs-component-close" data-close-component>✕</button>
                            <h4 class="hs-component-title"></h4>
                            <div class="hs-component-info"></div>
                            <div class="hs-component-settings" id="hsComponentSettings"></div>
                        </div>
                    </aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ship list"></div>
                    <div class="hs-hangar-detail">
                        <div class="hs-hangar-bay hs-panel">
                            <div class="hs-hangar-bay-stage" id="hsHangarBayStage">
                                <canvas id="hsHangarBayCanvas" class="hs-hangar-bay-canvas" width="420" height="320" aria-label="Open hangar ship"></canvas>
                                <div class="hs-bay-zoom" role="group" aria-label="Zoom">
                                    <input type="range" id="hsBayZoomSlider" class="hs-bay-zoom-slider" min="0" max="100" step="1" value="63" aria-label="Zoom" title="Zoom (mouse wheel works too)">
                                    <output id="hsBayZoomOut" class="hs-bay-zoom-out">100%</output>
                                    <button type="button" class="hs-bay-zoom-btn is-fit" data-bay-zoom="fit" title="Fit ship" aria-label="Fit ship">FIT</button>
                                </div>
                                <div class="hs-slot-bar" id="hsSlotBar" role="group" aria-label="Weapon slots"></div>
                                <button type="button" class="hs-slot-move-handle" id="hsSlotMoveHandle" hidden
                                    aria-label="Move slot" title="Drag to move this slot (keeps the weapon)">
                                    <svg viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true">
                                        <path d="M4 0h1v1h1v1H3V1h1zM4 2h1v5H4zM0 4h7v1H0zM1 3h1v3H1zM7 3h1v3H7zM8 4h1v1H8zM3 7h3v1H5v1H4V8H3zM2 4h5v1H2z"/>
                                    </svg>
                                </button>
                                <div class="hs-hangar-slot-layer" id="hsHangarSlotLayer">
                                    <svg class="hs-hangar-link-svg" id="hsHangarLinkSvg" aria-hidden="true"></svg>
                                    ${slotHtml}
                                </div>
                            </div>
                            <div class="hs-hangar-module-scale" id="hsHangarModuleScale" hidden>
                                <label class="hs-hangar-zoom-label" for="hsHangarModuleScaleSlider">SCALE</label>
                                <input type="range" id="hsHangarModuleScaleSlider" class="hs-hangar-zoom-slider"
                                    min="25" max="600" step="5" value="100"
                                    title="Module scale" aria-label="Module scale">
                                <span class="pe-zoom-label" id="hsHangarModuleScaleLabel">100%</span>
                            </div>
                            <div class="hs-hangar-bay-tools">
                                <button type="button" class="action-button hs-mod" id="hsResetAnatomy">RESET ANATOMY</button>
                                <button type="button" class="action-button hs-mod" id="hsSaveAnatomyDefault" title="Save this ship as the RESET ANATOMY default for your faction">SET AS DEFAULT</button>
                            </div>
                            <p class="hs-muted hs-hangar-bay-hint">DRAG MODULES WITHIN THEIR COMPONENT · CLICK A SLOT TO EQUIP</p>
                        </div>
                    </div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="hs-hangar-preview hs-panel">
                        <h3 class="hs-panel-title">
                            <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                            <span class="hs-panel-label">LIVE PREVIEW</span>
                            <span class="hs-panel-scan" aria-hidden="true"></span>
                            <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="right"
                                aria-label="${this._hangarRightCollapsed ? 'Expand' : 'Collapse'} live preview"
                                aria-expanded="${!this._hangarRightCollapsed}">${this._hangarRightCollapsed ? '<span class="hs-collapsed-label">‹ LIVE PREVIEW</span>' : '›'}</button>
                        </h3>
                        <div class="hs-hangar-preview-toolbar" id="hsHangarZoomBar">
                            <label class="hs-hangar-zoom-label" for="hsHangarZoom">ZOOM</label>
                            <input type="range" id="hsHangarZoom" class="hs-hangar-zoom-slider"
                                min="50" max="300" step="5" value="${Math.round((this._hangarPreviewZoom || 1) * 100)}"
                                title="Preview zoom" aria-label="Preview zoom">
                            <span class="pe-zoom-label" id="hsHangarZoomLabel">${Math.round((this._hangarPreviewZoom || 1) * 100)}%</span>
                        </div>
                        <button type="button" class="hs-hangar-preview-hit" id="hsOpenTestArea"
                            title="Open test area" aria-label="Open hangar test area">
                            <div class="hs-hangar-preview-viewport" id="hsHangarPreviewViewport">
                                <canvas id="hsHangarPreview" class="hs-hangar-preview-canvas" width="240" height="360" aria-label="Ship live preview"></canvas>
                            </div>
                            <p class="hs-muted hs-hangar-preview-caption">CLICK · TEST AREA · SCROLL ZOOM</p>
                        </button>
                    </aside>
                </div>
            </div>`;
    },

    getHangarShipModel(shipId) {
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
            const model = shipConfigManager.getMergedModel(shipId);
            if (model) return model;
        }
        // Assets not ready yet — never hand combat a white stub sprite.
        // Prefer whatever the asset loader already has, then apply loadout.
        let base = null;
        if (typeof graphicsManager !== 'undefined') {
            const loader = graphicsManager.shipAssetLoader;
            const key = (typeof shipConfigManager !== 'undefined' && shipConfigManager.resolveAssetKey)
                ? shipConfigManager.resolveAssetKey(shipId) : 'player';
            if (loader && loader.isLoaded && loader.isLoaded()) base = loader.getShip(key);
            if (!base && graphicsManager.shipModels) base = graphicsManager.shipModels.getShipModel(key);
        }
        if (base) {
            const model = Object.assign({}, base, { id: shipId, type: 'player', name: shipId });
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
                shipLoadoutManager.applyLayoutToModel(model, shipId);
            }
            return model;
        }
        return {
            id: shipId,
            name: shipId,
            type: 'player',
            modelClass: 'starfighter',
            width: 30,
            height: 24,
            speed: 4,
            weaponSpeed: 8,
            weaponCooldown: 300,
            defaultWeapon: 'laser',
            availableWeapons: ['laser'],
            sprite: [
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 1, 2, 2, 1, 0, 0],
                [0, 1, 2, 3, 3, 2, 1, 0],
                [1, 2, 3, 3, 3, 3, 2, 1],
                [0, 1, 2, 3, 3, 2, 1, 0],
                [0, 0, 1, 2, 2, 1, 0, 0]
            ],
            colors: {
                0: 'transparent',
                1: '#4a5560',
                2: '#8a96a0',
                3: '#c8d0d8'
            }
        };
    },
});
