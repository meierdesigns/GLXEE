"use strict";

// Player Selection Manager
class PlayerSelectionManager {
    constructor() {
        this.isVisible = false;
        this.selectedIndex = 0;
        this.playerShips = [];
        this.selectedShip = null;
        this.overlay = null;
        
        // Initialize with delay to allow shipAssetLoader to load
        setTimeout(() => {
            this.initialize();
        }, 100);
    }

    // Initialize player ships from asset loader
    async initialize() {
        
        // Always create fallback ships first
        this.createFallbackPlayerShips();

        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getAllMergedPlayerModels) {
            const configured = shipConfigManager.getAllMergedPlayerModels();
            if (configured && configured.length > 0) {
                this.playerShips = configured;
                this.filterOwnedShips();
                return;
            }
        }
        
        // Try to load from asset loader if available
        try {
            const { shipAssetLoader } = await import('../../assets/ships/ship-asset-loader.js');
            if (shipAssetLoader && shipAssetLoader.isLoaded()) {
                const assetShips = shipAssetLoader.getPlayerShipModels();
                if (assetShips && assetShips.length > 0) {
                    this.playerShips = assetShips;
                }
            }
        } catch (error) {
            // fallback ships already created
        }
        this.filterOwnedShips();
    }

    filterOwnedShips() {
        if (typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) {
            const starter = (typeof economyConfig !== 'undefined')
                ? economyConfig.starterShipId
                : 'player_scrap';
            this.playerShips = (this.playerShips || []).filter((s) =>
                (s.id || s.type) === starter
            );
            if (!this.playerShips.length && typeof shipConfigManager !== 'undefined') {
                const model = shipConfigManager.getMergedModel(starter);
                if (model) this.playerShips = [model];
            }
        } else {
            const owned = profileManager.getOwnedShipIds();
            this.playerShips = (this.playerShips || []).filter((s) =>
                owned.indexOf(s.id || s.type) !== -1
            );
            if (!this.playerShips.length && typeof shipConfigManager !== 'undefined') {
                const model = shipConfigManager.getMergedModel(profileManager.getStarterShipId());
                if (model) this.playerShips = [model];
            }
            const activeId = profileManager.getActiveShipId();
            const idx = this.playerShips.findIndex((s) => (s.id || s.type) === activeId);
            this.selectedIndex = idx >= 0 ? idx : 0;
        }
        if (this.selectedIndex >= this.playerShips.length) {
            this.selectedIndex = 0;
        }
    }

    // Create fallback player ships if asset loader is not available
    createFallbackPlayerShips() {
        this.playerShips = [
            {
                name: "Starfighter",
                type: "player",
                modelClass: "starfighter",
                tier: 1,
                width: 20,
                height: 16,
                speed: 4.0,
                maxHealth: 100,
                armor: 20,
                damage: 30,
                description: "Balanced combat craft. Good all-around performance.",
                weapons: ["Laser", "Rapid Fire"],
                specialAbilities: ["Shield Regen", "Weapon Systems"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Interceptor",
                type: "player",
                modelClass: "interceptor",
                tier: 2,
                width: 16,
                height: 12,
                speed: 5.0,
                maxHealth: 80,
                armor: 15,
                damage: 25,
                description: "Fast and agile attack craft. High speed and rapid fire rate.",
                weapons: ["Rapid Fire", "Laser", "Spread"],
                specialAbilities: ["High Speed", "Rapid Fire", "Agile Maneuver"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
                    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
                    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Heavy Fighter",
                type: "player",
                modelClass: "heavy_fighter",
                tier: 3,
                width: 24,
                height: 18,
                speed: 2.5,
                maxHealth: 150,
                armor: 40,
                damage: 45,
                description: "Heavily armored combat unit. High health and powerful weapons.",
                weapons: ["Spread", "Plasma"],
                specialAbilities: ["Heavy Armor", "Powerful Cannon", "Shield Generator"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
                    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Assault",
                type: "player",
                modelClass: "assault",
                tier: 3,
                width: 20,
                height: 16,
                speed: 3.5,
                maxHealth: 120,
                armor: 25,
                damage: 35,
                description: "Versatile combat craft with balanced weapon systems.",
                weapons: ["Laser", "Spread", "Rapid"],
                specialAbilities: ["Balanced Combat", "Versatile Weapons", "Adaptive Shield"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
                    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Bomber",
                type: "player",
                modelClass: "bomber",
                tier: 4,
                width: 22,
                height: 18,
                speed: 2.0,
                maxHealth: 200,
                armor: 50,
                damage: 60,
                description: "Heavy bomber with devastating firepower.",
                weapons: ["Plasma", "Bomb", "Spread"],
                specialAbilities: ["Heavy Bombs", "Devastating Firepower", "Armor Plating"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
                    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            },
            {
                name: "Stealth",
                type: "player",
                modelClass: "stealth",
                tier: 5,
                width: 18,
                height: 14,
                speed: 6.0,
                maxHealth: 90,
                armor: 10,
                damage: 40,
                description: "Stealth fighter with advanced cloaking technology.",
                weapons: ["Stealth Laser", "EMP", "Rapid"],
                specialAbilities: ["Cloaking", "EMP Burst", "Stealth Mode"],
                sprite: [
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
                    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
                    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)'   // Light gray
                }
            }
        ];
    }

    // Show player selection screen
    show() {
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getAllMergedPlayerModels) {
            const configured = shipConfigManager.getAllMergedPlayerModels();
            if (configured && configured.length > 0) {
                this.playerShips = configured;
            }
        } else if (this.playerShips.length === 0) {
            this.initialize();
        }
        this.filterOwnedShips();

        this.isVisible = true;
        this.createPlayerSelectionUI();
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('ships');
        }
    }

    // Hide player selection screen
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
    }

    // Create player selection UI
    createPlayerSelectionUI() {
        
        // Remove existing overlay
        if (this.overlay) {
            this.overlay.remove();
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'player-selection-overlay';
        this.overlay.innerHTML = `
            <div class="player-selection-content">
                <h2 class="player-selection-title">SELECT YOUR SHIP</h2>
                <!-- Horizontal Ship Belt -->
                <div class="ship-belt-container">
                    <div class="ship-belt">
                        ${this.playerShips.map((ship, index) => `
                            <div class="ship-belt-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
                                <canvas class="ship-belt-canvas" width="70" height="50" data-ship="${ship.name}"></canvas>
                                <span class="ship-belt-label">${ship.name || ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Ship Details -->
                <div class="ship-details-container">
                    <div class="ship-preview-large">
                        <canvas class="ship-large-canvas" width="300" height="200" data-ship="${this.playerShips[this.selectedIndex]?.name || ''}"></canvas>
                    </div>
                    <div class="ship-info-detailed">
                        <h3 class="ship-name-large">${this.playerShips[this.selectedIndex]?.name || ''}</h3>
                        <p class="ship-description-large">${this.playerShips[this.selectedIndex]?.description || ''}</p>
                        
                        <div class="ship-stats-detailed">
                            <div class="stat-row">
                                <span class="stat-label">Speed:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.speed || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Health:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.maxHealth || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Armor:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.armor || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Damage:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.damage || 0}</span>
                            </div>
                        </div>
                        
                        <div class="ship-weapons">
                            <h4 class="weapons-title">Weapons:</h4>
                            <div class="weapons-list">
                                ${(this.playerShips[this.selectedIndex]?.weapons || []).map(weapon => `
                                    <span class="weapon-item">${weapon}</span>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="ship-abilities">
                            <h4 class="abilities-title">Special Abilities:</h4>
                            <div class="abilities-list">
                                ${(this.playerShips[this.selectedIndex]?.specialAbilities || []).map(ability => `
                                    <span class="ability-item">${ability}</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="player-selection-instructions">
                    <p>LEFT/RIGHT ARROW: Navigate • SPACEBAR: Select • ESC: Cancel</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Render ship previews
        this.renderShipPreviews();

        // Add event listeners
        this.addEventListeners();
    }

    // Render ship previews on canvases
    renderShipPreviews() {
        // Render belt canvases
        const beltCanvases = this.overlay.querySelectorAll('.ship-belt-canvas');
        beltCanvases.forEach((canvas, index) => {
            const ship = this.playerShips[index];
            if (ship) {
                // Ensure canvas is transparent
                canvas.style.backgroundColor = 'transparent';
                this.renderShipPreview(canvas, ship, 1.5); // Scaled for belt
            }
        });
        
        // Render large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            const ship = this.playerShips[this.selectedIndex];
            if (ship) {
                // Ensure canvas is transparent
                largeCanvas.style.backgroundColor = 'transparent';
                this.renderShipPreview(largeCanvas, ship, 2.0); // Larger scale for preview
            }
        }
    }

    // Render individual ship preview
    renderShipPreview(canvas, ship, scale = 3) {
        if (typeof shipRenderer !== 'undefined') {
            shipRenderer.renderShipPreview(canvas, ship, scale);
        } else {
            console.warn('ShipRenderer not available, using fallback rendering');
        }
    }

    // Add event listeners
    addEventListeners() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => this.handleKeyDown(e);

        this.overlay.querySelectorAll('.ship-belt-item').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.selectedIndex = index;
                this.updateSelection();
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.selectedIndex = index;
                this.selectShip();
            });
        });

        document.addEventListener('keydown', this._keyHandler);
        
        // Listen for color changes to refresh ship previews
        if (typeof colorManager !== 'undefined' && !this._colorHooked) {
            this._colorHooked = true;
            const originalApplyColors = colorManager.applyColors.bind(colorManager);
            colorManager.applyColors = () => {
                originalApplyColors();
                if (this.isVisible) {
                    this.renderShipPreviews();
                }
            };
        }
    }

    // Handle keyboard input
    handleKeyDown(event) {
        if (!this.isVisible) return;

        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.updateSelection();
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.playerShips.length - 1, this.selectedIndex + 1);
                this.updateSelection();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.selectShip();
                break;
            case 'Escape':
                event.preventDefault();
                this.cancelSelection();
                break;
        }
    }

    // Update selection visual
    updateSelection() {
        // Update belt items
        const beltItems = this.overlay.querySelectorAll('.ship-belt-item');
        beltItems.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Update ship details
        this.updateShipDetails();
    }
    
    // Get detailed abilities for a ship
    getDetailedAbilities(ship) {
        if (!ship || !ship.abilities) return '';
        
        // Try to get abilities from ability manager if available
        if (typeof abilityManager !== 'undefined') {
            const abilityDescriptions = abilityManager.getAbilityDescriptions(ship.abilities);
            return abilityDescriptions.map(ability => `
                <div class="ability-detailed">
                    <div class="ability-tier">Tier ${ability.tier}</div>
                    <div class="ability-header">
                        <span class="ability-icon">${typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.resolveIconHtml(ability.icon, 20, 'cv-ability-icon-img') : ability.icon}</span>
                        <span class="ability-name">${ability.name}</span>
                        <span class="ability-type ${ability.type}">${ability.type}</span>
                    </div>
                    <div class="ability-description">${ability.description}</div>
                    <div class="ability-effects">
                        ${this.getAbilityEffects(ability)}
                    </div>
                </div>
            `).join('');
        }
        
        // Fallback to simple display
        return ship.abilities.map(ability => `
            <span class="ability-item">${ability}</span>
        `).join('');
    }
    
    // Get ability effects for display
    getAbilityEffects(ability) {
        if (!ability.effects) return '';
        
        const effects = [];
        for (const [key, value] of Object.entries(ability.effects)) {
            if (typeof value === 'number') {
                let displayValue = value;
                let label = key.replace(/([A-Z])/g, ' $1').replace(/Modifier$/, '').trim();
                
                if (key.includes('Modifier')) {
                    displayValue = `${Math.round((value - 1) * 100)}%`;
                    if (value > 1) displayValue = '+' + displayValue;
                } else if (key.includes('Chance') || key.includes('Resistance')) {
                    displayValue = `${Math.round(value * 100)}%`;
                } else {
                    displayValue = value.toString();
                }
                
                effects.push(`
                    <div class="ability-effect">
                        <div class="ability-effect-label">${label}</div>
                        <div class="ability-effect-value">${displayValue}</div>
                    </div>
                `);
            }
        }
        
        return effects.join('');
    }

    // Update ship details display
    updateShipDetails() {
        if (!this.overlay) return;
        
        const selectedShip = this.playerShips[this.selectedIndex];
        if (!selectedShip) return;
        
        // Update large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            largeCanvas.dataset.ship = selectedShip.name;
            // Ensure canvas is transparent
            largeCanvas.style.backgroundColor = 'transparent';
            this.renderShipPreview(largeCanvas, selectedShip, 1.5);
        }
        
        // Update ship info
        const nameElement = this.overlay.querySelector('.ship-name-large');
        if (nameElement) nameElement.textContent = selectedShip.name;
        
        const descElement = this.overlay.querySelector('.ship-description-large');
        if (descElement) descElement.textContent = selectedShip.description;
        
        // Update stats
        const statRows = this.overlay.querySelectorAll('.stat-row');
        if (statRows.length >= 4) {
            statRows[0].querySelector('.stat-value').textContent = selectedShip.speed;
            statRows[1].querySelector('.stat-value').textContent = selectedShip.maxHealth;
            statRows[2].querySelector('.stat-value').textContent = selectedShip.armor;
            statRows[3].querySelector('.stat-value').textContent = selectedShip.damage;
        }
        
        // Update weapons
        const weaponsList = this.overlay.querySelector('.weapons-list');
        if (weaponsList && selectedShip.weapons) {
            weaponsList.innerHTML = selectedShip.weapons.map(weapon => 
                `<span class="weapon-item">${weapon}</span>`
            ).join('');
        }
        
        // Update abilities
        const abilitiesList = this.overlay.querySelector('.abilities-list');
        if (abilitiesList) {
            abilitiesList.innerHTML = this.getDetailedAbilities(selectedShip);
        }
    }

    // Select current ship
    selectShip() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.playerShips.length) {
            this.selectedShip = this.playerShips[this.selectedIndex];

            if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
                profileManager.setActiveShip(this.selectedShip.id || this.selectedShip.type);
            }
            
            // Hide selection screen
            this.hide();
            
            // Go to level selection after ship selection
            if (typeof planetSelectionManager !== 'undefined') {
                // Pass the selected ship to planet selection
                planetSelectionManager.setSelectedShip(this.selectedShip);
                planetSelectionManager.show();
            } else {
                console.error('planetSelectionManager not available');
            }
        } else {
            console.error('Invalid selectedIndex:', this.selectedIndex);
        }
    }

    // Cancel selection
    cancelSelection() {
        this.hide();
        
        // Return to main menu
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        }
    }

    // Get selected ship
    getSelectedShip() {
        return this.selectedShip;
    }
}

// Create global instance
const playerSelectionManager = new PlayerSelectionManager();

// Make it globally available
window.playerSelectionManager = playerSelectionManager;
