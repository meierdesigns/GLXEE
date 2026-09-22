"use strict";

// Combined Level and Ship Selection Manager
class CombinedSelectionManager {
    constructor() {
        this.isVisible = false;
        this.selectedLevelIndex = 0;
        this.selectedShipIndex = 0;
        this.currentSelection = 'level'; // 'level' or 'ship'
        this.levels = [];
        this.playerShips = [];
        this.overlay = null;
        
        // Initialize with delay
        setTimeout(() => {
            this.initialize();
        }, 100);
    }

    // Initialize levels and ships
    initialize() {
        
        // Initialize levels
        this.initializeLevels();
        
        // Initialize ships
        this.initializeShips();
        
    }

    // Initialize levels from planet selection manager
    initializeLevels() {
        if (typeof planetSelectionManager !== 'undefined' && planetSelectionManager.planets) {
            this.levels = planetSelectionManager.planets.map(planet => ({
                id: planet.id,
                name: planet.name,
                difficulty: planet.difficulty,
                unlocked: planet.unlocked,
                description: planet.description || `${planet.name} - ${planet.difficulty} difficulty`,
                enemyCount: planet.enemyCount || 5,
                obstacleCount: planet.obstacleCount || 3,
                reward: planet.reward || 'XP'
            }));
        } else {
            // Fallback levels
            this.levels = [
                { id: 1, name: "Mars", difficulty: "Easy", unlocked: true, description: "Red planet with basic enemies", enemyCount: 5, obstacleCount: 3, reward: "XP" },
                { id: 2, name: "Jupiter", difficulty: "Medium", unlocked: true, description: "Gas giant with faster enemies", enemyCount: 8, obstacleCount: 5, reward: "XP" },
                { id: 3, name: "Saturn", difficulty: "Hard", unlocked: true, description: "Ringed planet with evasive enemies", enemyCount: 12, obstacleCount: 7, reward: "XP" },
                { id: 4, name: "Neptune", difficulty: "Expert", unlocked: false, description: "Ice giant with advanced AI", enemyCount: 15, obstacleCount: 10, reward: "XP" }
            ];
        }
    }

    // Initialize ships
    async initializeShips() {
        // Always create fallback ships first
        this.createFallbackPlayerShips();
        
        // Prefer ship config manager (includes edits + custom ships)
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
            if (!this.playerShips.length) {
                const starter = profileManager.getStarterShipId();
                if (typeof shipConfigManager !== 'undefined') {
                    const model = shipConfigManager.getMergedModel(starter);
                    if (model) this.playerShips = [model];
                }
            }
            const activeId = profileManager.getActiveShipId();
            const idx = this.playerShips.findIndex((s) => (s.id || s.type) === activeId);
            this.selectedShipIndex = idx >= 0 ? idx : 0;
        }
        if (this.selectedShipIndex >= this.playerShips.length) {
            this.selectedShipIndex = 0;
        }
    }

    // Create fallback player ships
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
                    [0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,2,4,4,2,2,1,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)',  // Light gray
                    4: 'var(--current-text)'   // White
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
                    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,0,0,1,2,4,4,2,1,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)',  // Light gray
                    4: 'var(--current-text)'   // White
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
                    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                    [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                    [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                    [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                    [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                    [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,1,2,2,4,4,4,4,2,2,1,0,0,0,0,0,0,0]
                ],
                colors: {
                    0: 'transparent',
                    1: 'var(--current-text-secondary)',  // Dark gray
                    2: 'var(--current-text)',  // Medium gray
                    3: 'var(--current-text)',  // Light gray
                    4: 'var(--current-text)'   // White
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
    }

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
    }

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
    }

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
    }

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
    }

    // Create combined selection UI
    createCombinedSelectionUI() {
        
        // Remove existing overlay
        if (this.overlay) {
            this.overlay.remove();
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'combined-selection-overlay';
        this.overlay.innerHTML = `
            <div class="combined-selection-content">
                <h2 class="combined-selection-title">SELECT LEVEL & SHIP</h2>
                
                <div class="selection-tabs">
                    <button class="tab-button ${this.currentSelection === 'level' ? 'active' : ''}" data-tab="level">
                        LEVEL SELECTION
                    </button>
                    <button class="tab-button ${this.currentSelection === 'ship' ? 'active' : ''}" data-tab="ship">
                        SHIP SELECTION
                    </button>
                </div>
                
                <div class="selection-content">
                    <div class="level-selection ${this.currentSelection === 'level' ? 'active' : ''}">
                        <!-- Horizontal Level Belt -->
                        <div class="level-belt-container">
                            <div class="level-belt">
                                ${this.levels.map((level, index) => `
                                    <div class="level-belt-item ${index === this.selectedLevelIndex ? 'selected' : ''} ${!level.unlocked ? 'locked' : ''}" data-index="${index}">
                                        <canvas class="level-belt-canvas" width="70" height="50" data-level="${level.name}"></canvas>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Level Details -->
                        <div class="level-details-container">
                            <div class="level-preview-large">
                                <canvas class="level-large-canvas" width="300" height="200" data-level="${this.levels[this.selectedLevelIndex]?.name || ''}"></canvas>
                            </div>
                            <div class="level-info-detailed">
                                <h3 class="level-name-large">${this.levels[this.selectedLevelIndex]?.name || ''}</h3>
                                <p class="level-description-large">${this.levels[this.selectedLevelIndex]?.description || ''}</p>
                                
                                <div class="level-stats-detailed">
                                    <div class="stat-row">
                                        <span class="stat-label">Difficulty:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.difficulty || ''}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Enemies:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.enemyCount || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Obstacles:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.obstacleCount || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Reward:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.reward || 'XP'}</span>
                                    </div>
                                </div>
                                
                                ${!this.levels[this.selectedLevelIndex]?.unlocked ? '<div class="locked-indicator-large">LEVEL LOCKED</div>' : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="ship-selection ${this.currentSelection === 'ship' ? 'active' : ''}">
                        <!-- Horizontal Ship Belt -->
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
                        
                        <!-- Ship Details -->
                        <div class="ship-details-container">
                            <div class="ship-preview-large">
                                <canvas class="ship-large-canvas" width="300" height="200" data-ship="${this.playerShips[this.selectedShipIndex]?.name || ''}"></canvas>
                            </div>
                            <div class="ship-info-detailed">
                                <h3 class="ship-name-large">${this.playerShips[this.selectedShipIndex]?.name || ''}</h3>
                                <p class="ship-description-large">${this.playerShips[this.selectedShipIndex]?.description || ''}</p>
                                
                                <div class="ship-stats-detailed">
                                    <div class="stat-row">
                                        <span class="stat-label">Speed:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.speed || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Health:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.maxHealth || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Armor:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.armor || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Damage:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.damage || 0}</span>
                                    </div>
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
                
                <div class="selection-summary">
                    <div class="selected-level">
                        <strong>Level:</strong> ${this.levels[this.selectedLevelIndex]?.name || 'None'}
                    </div>
                    <div class="selected-ship">
                        <strong>Ship:</strong> ${this.playerShips[this.selectedShipIndex]?.name || 'None'}
                    </div>
                </div>

                <div class="combined-selection-actions">
                    <button type="button" class="pe-btn pe-primary" id="csStart">START</button>
                    <button type="button" class="pe-btn" id="csCancel">CANCEL</button>
                </div>
                
                <div class="combined-selection-instructions">
                    <p>CLICK to select • TAB Level/Ship • ←→ Navigate • ENTER Start • ESC Cancel</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Render ship previews
        this.renderShipPreviews();

        // Add event listeners
        this.addEventListeners();
        
        // Render previews
        this.renderLevelPreviews();
        this.renderShipPreviews();
    }

    // Render level previews on canvases
    renderLevelPreviews() {
        
        // Render belt canvases
        const beltCanvases = this.overlay.querySelectorAll('.level-belt-canvas');
        beltCanvases.forEach((canvas, index) => {
            const level = this.levels[index];
            if (level) {
                this.renderLevelPreview(canvas, level, 1); // Full scale for belt
            }
        });
        
        // Render large canvas
        const largeCanvas = this.overlay.querySelector('.level-large-canvas');
        if (largeCanvas) {
            const level = this.levels[this.selectedLevelIndex];
            if (level) {
                this.renderLevelPreview(largeCanvas, level, 1.5); // Larger scale for preview
            }
        }
    }

    // Render ship previews on canvases
    renderShipPreviews() {
        // Render belt canvases
        const beltCanvases = this.overlay.querySelectorAll('.ship-belt-canvas');
        beltCanvases.forEach((canvas, index) => {
            const ship = this.playerShips[index];
            if (ship) {
                this.renderShipPreview(canvas, ship, 1); // Full scale for belt
            }
        });
        
        // Render large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            const ship = this.playerShips[this.selectedShipIndex];
            if (ship) {
                this.renderShipPreview(largeCanvas, ship, 1.5); // Larger scale for preview
            }
        }
    }

    // Render individual level preview
    renderLevelPreview(canvas, level, scale = 3) {
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set canvas background to transparent
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        
        // Get current color overlay from color manager
        let colorOverlay = null;
        let overlayIntensity = 0;
        
        if (typeof colorManager !== 'undefined') {
            colorOverlay = colorManager.getCurrentOverlayColor();
            overlayIntensity = colorManager.getCurrentOverlayIntensity();
        }
        
        // Save context for locked level effects
        ctx.save();
        
        // Apply locked level effects
        if (!level.unlocked) {
            ctx.globalAlpha = 0.3;
            ctx.filter = 'grayscale(100%)';
        }
        
        // Try to use PNG sprite first, fallback to text rendering
        const spriteName = this.getSpriteNameForLevel(level);
        
        if (typeof spriteLoader !== 'undefined' && spriteLoader.getSprite(spriteName)) {
            // Use PNG sprite - maintain aspect ratio
            const sprite = spriteLoader.getSprite(spriteName);
            const spriteAspect = sprite.width / sprite.height;
            const canvasAspect = canvas.width / canvas.height;
            
            let renderWidth, renderHeight, offsetX, offsetY;
            
            if (spriteAspect > canvasAspect) {
                // Sprite is wider - fit to width
                renderWidth = canvas.width;
                renderHeight = canvas.width / spriteAspect;
                offsetX = 0;
                offsetY = (canvas.height - renderHeight) / 2;
            } else {
                // Sprite is taller - fit to height
                renderHeight = canvas.height;
                renderWidth = canvas.height * spriteAspect;
                offsetX = (canvas.width - renderWidth) / 2;
                offsetY = 0;
            }
            
            spriteLoader.renderSprite(ctx, spriteName, offsetX, offsetY, renderWidth, renderHeight, colorOverlay, overlayIntensity);
        } else {
            // Fallback to text rendering
            this.renderLevelText(ctx, level, canvas.width, canvas.height, colorOverlay, overlayIntensity);
        }
        
        // Restore context
        ctx.restore();
        
        // Add lock icon for locked levels
        if (!level.unlocked) {
            this.renderLockIcon(ctx, canvas.width, canvas.height);
        }
    }

    // Get sprite name for level
    getSpriteNameForLevel(level) {
        if (!level) return null;
        
        const name = level.name.toLowerCase();
        switch (name) {
            case 'mars': return 'mars-surface';
            case 'jupiter': return 'jupiter-atmosphere';
            case 'saturn': return 'saturn-rings';
            case 'neptune': return 'neptune-storm';
            case 'pluto': return 'pluto-surface';
            default: return null;
        }
    }

    // Render level text (fallback)
    renderLevelText(ctx, level, width, height, colorOverlay, overlayIntensity) {
        // Save current context state
        ctx.save();
        
        // Reset composite operation for normal rendering
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        
        // Set text properties
        ctx.fillStyle = (typeof colorManager !== 'undefined' && colorManager.currentColors)
            ? colorManager.currentColors.text
            : (getComputedStyle(document.documentElement).getPropertyValue('--current-text').trim() || '#e0e0e0');
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw level initial
        const initial = level.name.charAt(0);
        ctx.fillText(initial, width / 2, height / 2);
        
        // Restore context state
        ctx.restore();
    }

    // Render lock icon for locked levels
    renderLockIcon(ctx, width, height) {
        ctx.save();
        
        // Set lock icon properties
        ctx.fillStyle = (typeof colorManager !== 'undefined' && colorManager.currentColors)
            ? colorManager.currentColors.textSecondary
            : (getComputedStyle(document.documentElement).getPropertyValue('--current-text-secondary').trim() || '#a0a0a0');
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 5;
        
        // Draw lock icon
        ctx.fillText('🔒', width / 2, height / 2);
        
        ctx.restore();
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

        // Tab switching
        const tabButtons = this.overlay.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchTab(button.dataset.tab);
            });
        });

        // Level belt mouse select
        this.overlay.querySelectorAll('.level-belt-item').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                const level = this.levels[index];
                if (!level || !level.unlocked) return;
                this.currentSelection = 'level';
                this.selectedLevelIndex = index;
                this.switchTab('level');
                this.updateSelection();
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                const level = this.levels[index];
                if (!level || !level.unlocked) return;
                this.selectedLevelIndex = index;
                this.startGame();
            });
        });

        // Ship belt mouse select
        this.overlay.querySelectorAll('.ship-belt-item').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.currentSelection = 'ship';
                this.selectedShipIndex = index;
                this.switchTab('ship');
                this.updateSelection();
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.selectedShipIndex = index;
                this.startGame();
            });
        });

        const startBtn = this.overlay.querySelector('#csStart');
        const cancelBtn = this.overlay.querySelector('#csCancel');
        if (startBtn) startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.startGame();
        });
        if (cancelBtn) cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelSelection();
        });

        document.addEventListener('keydown', this._keyHandler);
        
        // Listen for HSL color changes to refresh ship previews
        if (typeof colorManager !== 'undefined' && colorManager.setHSL && !this._hslHooked) {
            this._hslHooked = true;
            const originalSetHSL = colorManager.setHSL.bind(colorManager);
            colorManager.setHSL = (hue, saturation, lightness) => {
                originalSetHSL(hue, saturation, lightness);
                if (this.isVisible) {
                    this.renderShipPreviews();
                }
            };
        }
    }

    // Switch between level and ship selection
    switchTab(tab) {
        if (!this.overlay) return;
        this.currentSelection = tab;

        const tabButtons = this.overlay.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });

        const levelSelection = this.overlay.querySelector('.level-selection');
        const shipSelection = this.overlay.querySelector('.ship-selection');
        if (levelSelection) levelSelection.classList.toggle('active', tab === 'level');
        if (shipSelection) shipSelection.classList.toggle('active', tab === 'ship' || !levelSelection);

        this.updateSummary();
    }

    // Handle keyboard input
    handleKeyDown(event) {
        if (!this.isVisible) return;

        switch (event.key) {
            case 'Tab':
                event.preventDefault();
                if (this.overlay && this.overlay.querySelector('.tab-button')) {
                    this.switchTab(this.currentSelection === 'level' ? 'ship' : 'level');
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.navigateUp();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.navigateDown();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.navigateLeft();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.navigateRight();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.startGame();
                break;
            case 'Escape':
                event.preventDefault();
                this.cancelSelection();
                break;
        }
    }

    // Navigation methods
    navigateUp() {
        if (this.currentSelection === 'level') {
            let newIndex = this.selectedLevelIndex - 1;
            while (newIndex >= 0 && !this.levels[newIndex].unlocked) {
                newIndex--;
            }
            if (newIndex >= 0) {
                this.selectedLevelIndex = newIndex;
                this.updateSelection();
            }
        }
    }

    navigateDown() {
        if (this.currentSelection === 'level') {
            let newIndex = this.selectedLevelIndex + 1;
            while (newIndex < this.levels.length && !this.levels[newIndex].unlocked) {
                newIndex++;
            }
            if (newIndex < this.levels.length) {
                this.selectedLevelIndex = newIndex;
                this.updateSelection();
            }
        }
    }

    navigateLeft() {
        if (this.currentSelection === 'ship') {
            this.selectedShipIndex = Math.max(0, this.selectedShipIndex - 1);
            this.updateSelection();
        } else if (this.currentSelection === 'level') {
            this.selectedLevelIndex = Math.max(0, this.selectedLevelIndex - 1);
            this.updateSelection();
        }
    }

    navigateRight() {
        if (this.currentSelection === 'ship') {
            this.selectedShipIndex = Math.min(this.playerShips.length - 1, this.selectedShipIndex + 1);
            this.updateSelection();
        } else if (this.currentSelection === 'level') {
            this.selectedLevelIndex = Math.min(this.levels.length - 1, this.selectedLevelIndex + 1);
            this.updateSelection();
        }
    }

    // Update selection visual
    updateSelection() {
        if (this.currentSelection === 'level') {
            // Update level belt items
            const levelBeltItems = this.overlay.querySelectorAll('.level-belt-item');
            levelBeltItems.forEach((item, index) => {
                item.classList.toggle('selected', index === this.selectedLevelIndex);
            });
            
            // Update level details
            this.updateLevelDetails();
        } else {
            // Update ship belt items
            const shipBeltItems = this.overlay.querySelectorAll('.ship-belt-item');
            shipBeltItems.forEach((item, index) => {
                item.classList.toggle('selected', index === this.selectedShipIndex);
            });
            
            // Update ship details
            this.updateShipDetails();
        }
        this.updateSummary();
    }
    
    // Update level details display
    updateLevelDetails() {
        if (!this.overlay) return;
        
        const selectedLevel = this.levels[this.selectedLevelIndex];
        if (!selectedLevel) return;
        
        // Update level name
        const levelNameElement = this.overlay.querySelector('.level-name-large');
        if (levelNameElement) {
            levelNameElement.textContent = selectedLevel.name;
            if (!selectedLevel.unlocked) {
                levelNameElement.style.opacity = '0.5';
                levelNameElement.style.color = 'var(--current-text-secondary)';
            } else {
                levelNameElement.style.opacity = '1';
                levelNameElement.style.color = 'var(--current-text)';
            }
        }
        
        // Update level description
        const levelDescriptionElement = this.overlay.querySelector('.level-description-large');
        if (levelDescriptionElement) {
            if (!selectedLevel.unlocked) {
                levelDescriptionElement.textContent = '🔒 Level locked — complete previous levels first';
                levelDescriptionElement.style.opacity = '0.5';
                levelDescriptionElement.style.color = 'var(--current-text-secondary)';
            } else {
                levelDescriptionElement.textContent = selectedLevel.description;
                levelDescriptionElement.style.opacity = '1';
                levelDescriptionElement.style.color = 'var(--current-text-secondary)';
            }
        }
        
        // Update level stats
        const statElements = this.overlay.querySelectorAll('.level-stats-detailed .stat-value');
        if (statElements.length >= 4) {
            if (!selectedLevel.unlocked) {
                statElements[0].textContent = '???';
                statElements[1].textContent = '???';
                statElements[2].textContent = '???';
                statElements[3].textContent = '???';
                statElements.forEach(el => {
                    el.style.opacity = '0.5';
                    el.style.color = 'var(--current-text-secondary)';
                });
            } else {
                statElements[0].textContent = selectedLevel.difficulty || '';
                statElements[1].textContent = selectedLevel.enemyCount || 0;
                statElements[2].textContent = selectedLevel.obstacleCount || 0;
                statElements[3].textContent = selectedLevel.reward || 'XP';
                statElements.forEach(el => {
                    el.style.opacity = '1';
                    el.style.color = 'var(--current-text)';
                });
            }
        }
        
        // Update locked indicator
        const lockedIndicator = this.overlay.querySelector('.locked-indicator-large');
        if (lockedIndicator) {
            lockedIndicator.style.display = !selectedLevel.unlocked ? 'block' : 'none';
        }
        
        // Update large canvas
        const largeCanvas = this.overlay.querySelector('.level-large-canvas');
        if (largeCanvas) {
            this.renderLevelPreview(largeCanvas, selectedLevel, 1.5);
        }
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
        
        const selectedShip = this.playerShips[this.selectedShipIndex];
        if (!selectedShip) return;
        
        // Update large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            largeCanvas.dataset.ship = selectedShip.name;
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
        const abilitiesList = this.overlay.querySelector('.abilities-detailed-list');
        if (abilitiesList) {
            abilitiesList.innerHTML = this.getDetailedAbilities(selectedShip);
        }
    }

    // Update summary display
    updateSummary() {
        const selectedLevel = this.overlay.querySelector('.selected-level');
        const selectedShip = this.overlay.querySelector('.selected-ship');
        
        if (selectedLevel) {
            const name = this.selectedPlanet
                ? this.selectedPlanet.name
                : (this.levels[this.selectedLevelIndex]?.name || 'None');
            selectedLevel.innerHTML = `<strong>Planet:</strong> ${name}`;
        }
        if (selectedShip) {
            selectedShip.innerHTML = `<strong>Ship:</strong> ${this.playerShips[this.selectedShipIndex]?.name || 'None'}`;
        }
    }

    // Start game with selected level and ship
    startGame() {
        const selectedLevel = this.selectedPlanet || this.levels[this.selectedLevelIndex];
        const selectedShip = this.playerShips[this.selectedShipIndex];
        
        if (!selectedLevel || !selectedShip) {
            console.error('Missing level or ship selection');
            return;
        }
        
        if (selectedLevel.unlocked === false) {
            this.showLockedMessage();
            return;
        }

        if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
            profileManager.setActiveShip(selectedShip.id || selectedShip.type);
        }
        
        this.hide();

        if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
            homeStationUI.hide();
        }
        
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(selectedShip);
        }
        
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.startGameWithLevelAndShip(selectedLevel, selectedShip);
        }
    }

    // Cancel selection — from ship UI go back to map; else main menu
    cancelSelection() {
        const galaxyId = this.selectedGalaxyId;
        this.hide();

        if (galaxyId && typeof homeStationUI !== 'undefined' && homeStationUI) {
            homeStationUI.show({ tab: 'play' });
            return;
        }

        if (galaxyId && typeof galaxyMapManager !== 'undefined') {
            galaxyMapManager.show({
                galaxyId: galaxyId,
                onConfirm: (planet) => this.openShipSelection(planet),
                onBack: () => {
                    this.selectedGalaxyId = null;
                    this.selectedPlanet = null;
                    this.cancelToMenu();
                }
            });
            return;
        }

        this.cancelToMenu();
    }

    cancelToMenu() {
        this.selectedGalaxyId = null;
        this.selectedPlanet = null;
        this.hide();
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        }
    }

    // Show locked level message
    showLockedMessage() {
        // Create temporary message overlay
        const messageOverlay = document.createElement('div');
        messageOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: var(--enemy-color);
            padding: 20px 30px;
            border-radius: 10px;
            border: 2px solid var(--enemy-color);
            font-family: 'Courier New', monospace;
            font-size: var(--font-h2);
            font-weight: bold;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
        `;
        messageOverlay.textContent = '🔒 Level locked! Complete previous levels first.';
        
        document.body.appendChild(messageOverlay);
        
        // Remove message after 2 seconds
        setTimeout(() => {
            if (messageOverlay.parentNode) {
                messageOverlay.parentNode.removeChild(messageOverlay);
            }
        }, 2000);
    }

}

// Create global instance
const combinedSelectionManager = new CombinedSelectionManager();

// Make it globally available
window.combinedSelectionManager = combinedSelectionManager;
