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
            const { shipAssetLoader } = await import('../../../assets/ships/ship-asset-loader.js');
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
}
