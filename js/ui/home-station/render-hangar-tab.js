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

        const shipButtons = owned.map((id) => {
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

        const powerBudget = (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.computePowerBudget)
            ? shipLoadoutManager.computePowerBudget(loadout)
            : { gen: 0, idleDraw: 0, net: 0 };
        const netSign = powerBudget.net >= 0 ? '+' : '';
        const powerLine = `POWER · GEN ${powerBudget.gen}/s · IDLE DRAW ${powerBudget.idleDraw}/s · NET ${netSign}${powerBudget.net}/s`;

        const fireMode = (loadout.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        const ownsChargeShot = (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.ownsChargePart)
            ? shipLoadoutManager.ownsChargePart('ability', 'charge_shot')
            : (inventory.abilities || []).indexOf('charge_shot') !== -1;

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
                    <span class="hs-hangar-sidebar-actions">
                        <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="left"
                            aria-label="${this._hangarLeftCollapsed ? 'Expand' : 'Collapse'} ship list"
                            aria-expanded="${!this._hangarLeftCollapsed}">${this._hangarLeftCollapsed ? '›' : '‹'}</button>
                        <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="right"
                            aria-label="${this._hangarRightCollapsed ? 'Expand' : 'Collapse'} live preview"
                            aria-expanded="${!this._hangarRightCollapsed}">${this._hangarRightCollapsed ? '‹' : '›'}</button>
                    </span>
                </h3>
                <div class="hs-hangar-split${this._hangarLeftCollapsed ? ' hs-hangar-left-collapsed' : ''}${this._hangarRightCollapsed ? ' hs-hangar-right-collapsed' : ''}">
                    <aside class="hs-hangar-list hs-panel">
                        <h3 class="hs-panel-title">
                            <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                            <span class="hs-panel-label">${this._hangarLeftView === 'parts' ? 'PARTS' : 'SHIPS'}</span>
                            <span class="hs-panel-scan" aria-hidden="true"></span>
                            ${this.renderHangarLeftViewToggle()}
                            <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="left"
                                aria-label="${this._hangarLeftCollapsed ? 'Expand' : 'Collapse'} ship list"
                                aria-expanded="${!this._hangarLeftCollapsed}">${this._hangarLeftCollapsed ? '›' : '‹'}</button>
                        </h3>
                        ${this._hangarLeftView === 'parts'
                            ? this.renderHangarPartsGrid(inventory, loadout)
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
                        <div class="hs-hangar-detail-head hs-panel">
                            <div class="hs-hangar-head-title">
                                <span class="hs-chip-icon">${this.iconHtml('hsShip', 24, 'hs-pixel hs-pixel-24')}</span>
                                <strong class="hs-hangar-head-name">${this.shipName(shipId)}</strong>
                                ${shipId === profile.activeShipId
                                    ? '<span class="hs-hangar-active-tag">★ ACTIVE</span>'
                                    : `<button type="button" class="action-button hs-activate-ship" data-activate-ship="${shipId}">SET ACTIVE</button>`}
                                <div class="hs-hangar-fire-inline" role="group" aria-label="Fire mode">
                                    <button type="button" class="action-button hs-mod ${fireMode === 'auto' ? 'equipped' : ''}" data-fire-mode="auto">AUTO</button>
                                    <button type="button" class="action-button hs-mod ${fireMode === 'charge' ? 'equipped' : ''}" data-fire-mode="charge" ${ownsChargeShot ? '' : 'disabled'}
                                        title="${ownsChargeShot ? 'Charge shot' : 'Buy the charge shot in the shop'}">CHARGE${ownsChargeShot ? '' : ' 🔒'}</button>
                                </div>
                            </div>
                            <div class="hs-hangar-stats">
                                <span class="hs-hangar-stat"><em>SIZE</em>${layout.width}×${layout.height}</span>
                                <span class="hs-hangar-stat" title="Hull area levels (each S → M → L)"><em>AREAS</em>${frameLevel}/${frameMax}</span>
                                <span class="hs-hangar-stat" title="Weapons ${loadout.weapons.length}/${caps.weapons} · Defense ${loadout.defenses.length}/${caps.defenses} · Abilities ${loadout.abilities.length}/${caps.abilities} · Energy ${(loadout.energy || []).length}/${caps.energy || 1}">
                                    <em>SLOTS</em>${filledSlots}/${totalSlots}
                                    <small>W${loadout.weapons.length} D${loadout.defenses.length} A${loadout.abilities.length} E${(loadout.energy || []).length}</small>
                                </span>
                                <span class="hs-hangar-stat${powerBudget.net < 0 ? ' is-negative' : ''}" title="${powerLine}">
                                    <em>POWER</em>${netSign}${powerBudget.net}/s
                                    <small>${powerBudget.gen} gen · ${powerBudget.idleDraw} draw</small>
                                </span>
                            </div>
                            <div class="hs-hangar-head-bar">
                                <label class="hs-hangar-voxel" title="Voxel size of the whole ship">
                                    <span>VOXEL SIZE</span>
                                    <input type="range" data-voxel-scale data-hangar-voxel min="0.5" max="1.5" step="0.05" value="${this.getVoxelScaleValue(this.hangarShipId)}">
                                    <output data-hangar-voxel-out>${this.getVoxelScaleValue(this.hangarShipId).toFixed(2)}×</output>
                                </label>
                            </div>
                            ${this.renderHangarAreaUpgrades(shipId, profile)}
                        </div>
                        <div class="hs-hangar-bay hs-panel">
                            <div class="hs-hangar-bay-stage" id="hsHangarBayStage">
                                <canvas id="hsHangarBayCanvas" class="hs-hangar-bay-canvas" width="420" height="320" aria-label="Open hangar ship"></canvas>
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
                                aria-expanded="${!this._hangarRightCollapsed}">${this._hangarRightCollapsed ? '‹' : '›'}</button>
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
        return {
            name: shipId,
            type: 'player',
            modelClass: 'starfighter',
            width: 20,
            height: 16,
            speed: 4,
            weaponSpeed: 8,
            weaponCooldown: 300,
            defaultWeapon: 'laser',
            sprite: [
                [0, 0, 1, 1, 0, 0],
                [0, 1, 2, 2, 1, 0],
                [1, 2, 3, 3, 2, 1],
                [0, 1, 2, 2, 1, 0]
            ],
            colors: {
                0: 'transparent',
                1: 'var(--current-text-secondary)',
                2: 'var(--current-text)',
                3: 'var(--current-text)'
            }
        };
    },
});
