"use strict";

// CombinedSelectionManager methods, split from combined-selection.js.
extendClass(CombinedSelectionManager, {
    // Show combined selection — prefer Home Station PLAY tab (embedded map).
    show() {
        if (typeof profileManager !== 'undefined' && !profileManager.hasActiveProfile()) {
            if (typeof profileSelectionManager !== 'undefined') {
                profileSelectionManager.show({
                    onClose: () => {
                        if (profileManager.hasActiveProfile()) {
                            this.show();
                        } else if (typeof startScreenManager !== 'undefined') {
                            startScreenManager.show();
                        }
                    }
                });
                return;
            }
        }

        if (typeof homeStationUI !== 'undefined') {
            if (typeof startScreenManager !== 'undefined') {
                startScreenManager.hide();
            }
            homeStationUI.show({
                tab: 'play',
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.show();
                    }
                }
            });
            return;
        }

        this.isVisible = true;
        this.selectedShipIndex = 0;
        this.selectedPlanet = null;
        this.selectedGalaxyId = null;
        this.currentSelection = 'ship';
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getAllMergedPlayerModels) {
            const configured = shipConfigManager.getAllMergedPlayerModels();
            if (configured && configured.length > 0) {
                this.playerShips = configured;
            }
        }
        this.filterOwnedShips();

        const galaxyId = (typeof profileManager !== 'undefined' && profileManager.getCurrentGalaxyId)
            ? profileManager.getCurrentGalaxyId()
            : 'milky_way';
        this.openGalaxyMap(galaxyId);
    },

    openGalaxyMap(galaxyId) {
        this.selectedGalaxyId = galaxyId;
        if (typeof galaxyMapManager === 'undefined') {
            this.openShipSelection({
                planetId: 'mars',
                name: 'MARS',
                difficulty: 'EASY',
                unlocked: true,
                description: '3 stages + boss chamber',
                enemyCount: 5,
                obstacleCount: 3,
                reward: 'XP',
                galaxyId: galaxyId
            });
            return;
        }
        galaxyMapManager.show({
            galaxyId: galaxyId,
            onConfirm: (planet) => this.openShipSelection(planet),
            onBack: () => {
                this.selectedGalaxyId = null;
                this.selectedPlanet = null;
                this.hide();
                if (typeof startScreenManager !== 'undefined') {
                    startScreenManager.show();
                }
            },
            onExplored: () => {
                // Map reloads itself; keep galaxy selection
            }
        });
    },

    openShipSelection(planet) {
        const pid = String(planet.planetId || planet.id || planet.name || 'mars').toLowerCase();
        this.selectedGalaxyId = planet.galaxyId || this.selectedGalaxyId;
        this.selectedPlanet = {
            id: pid,
            name: planet.name || pid.toUpperCase(),
            difficulty: planet.difficulty || '',
            unlocked: planet.unlocked !== false,
            description: planet.description || '',
            enemyCount: planet.enemyCount || 5,
            obstacleCount: planet.obstacleCount || 3,
            reward: planet.reward || 'XP',
            galaxyId: planet.galaxyId || this.selectedGalaxyId
        };
        this.levels = [this.selectedPlanet];
        this.selectedLevelIndex = 0;
        this.currentSelection = 'ship';
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getAllMergedPlayerModels) {
            const configured = shipConfigManager.getAllMergedPlayerModels();
            if (configured && configured.length > 0) {
                this.playerShips = configured;
            }
        }
        this.filterOwnedShips();
        this.createShipOnlyUI();
        // Keep PLAY tab as restore target so refresh does not reopen the map modal.
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('home-station', { tab: 'play' });
        }
    },

    createShipOnlyUI() {
        if (this.overlay) {
            this.overlay.remove();
        }
        this.overlay = document.createElement('div');
        this.overlay.className = 'combined-selection-overlay';
        const planetName = this.selectedPlanet ? this.selectedPlanet.name : '—';
        this.overlay.innerHTML = `
            <div class="combined-selection-content">
                <h2 class="combined-selection-title">SELECT SHIP</h2>
                <div class="selection-summary ship-only-summary">
                    <div class="selected-level"><strong>Planet:</strong> ${planetName}</div>
                    <div class="selected-ship"><strong>Ship:</strong> ${this.playerShips[this.selectedShipIndex]?.name || 'None'}</div>
                </div>
                <div class="selection-content">
                    <div class="ship-selection active">
                        <div class="ship-belt-container">
                            <div class="ship-belt">
                                ${this.playerShips.map((ship, index) => `
                                    <div class="ship-belt-item ${index === this.selectedShipIndex ? 'selected' : ''}" data-index="${index}">
                                        <canvas class="ship-belt-canvas" width="70" height="50" data-ship="${ship.name}"></canvas>
                                        <span class="ship-belt-label">${ship.name || ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="ship-details-container">
                            <div class="ship-preview-large">
                                <canvas class="ship-large-canvas" width="300" height="200" data-ship="${this.playerShips[this.selectedShipIndex]?.name || ''}"></canvas>
                            </div>
                            <div class="ship-info-detailed">
                                <h3 class="ship-name-large">${this.playerShips[this.selectedShipIndex]?.name || ''}</h3>
                                <p class="ship-description-large">${this.playerShips[this.selectedShipIndex]?.description || ''}</p>
                                <div class="ship-stats-detailed">
                                    <div class="stat-row"><span class="stat-label">Speed:</span><span class="stat-value">${this.playerShips[this.selectedShipIndex]?.speed || 0}</span></div>
                                    <div class="stat-row"><span class="stat-label">Health:</span><span class="stat-value">${this.playerShips[this.selectedShipIndex]?.maxHealth || 0}</span></div>
                                    <div class="stat-row"><span class="stat-label">Armor:</span><span class="stat-value">${this.playerShips[this.selectedShipIndex]?.armor || 0}</span></div>
                                    <div class="stat-row"><span class="stat-label">Damage:</span><span class="stat-value">${this.playerShips[this.selectedShipIndex]?.damage || 0}</span></div>
                                </div>
                                <div class="ship-weapons">
                                    <h4 class="weapons-title">Weapons:</h4>
                                    <div class="weapons-list">
                                        ${(this.playerShips[this.selectedShipIndex]?.weapons || []).map(weapon => `
                                            <span class="weapon-item">${weapon}</span>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="ship-abilities">
                                    <h4 class="abilities-title">Special Abilities:</h4>
                                    <div class="abilities-detailed-list">
                                        ${this.getDetailedAbilities(this.playerShips[this.selectedShipIndex])}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="combined-selection-actions">
                    <button type="button" class="pe-btn pe-primary" id="csStart">START</button>
                    <button type="button" class="pe-btn" id="csCancel">BACK</button>
                </div>
                <div class="combined-selection-instructions">
                    <p>← → Ship • ENTER Start • ESC Back to Map</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.isVisible = true;
        this.renderShipPreviews();
        this.addEventListeners();
    },

    // Hide selection screen
    hide() {
        this.isVisible = false;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    },
});
