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
}
