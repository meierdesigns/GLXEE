"use strict";

// ShipConfigManager methods, split from ship-config.js.
extendClass(ShipConfigManager, {
    getAllMergedPlayerModels() {
        return this.getTypeIds().map((id) => {
            const model = this.getMergedModel(id);
            if (model) return model;
            const cfg = this.getConfig(id);
            return {
                id: id,
                name: cfg.name,
                type: 'player',
                modelClass: cfg.modelClass,
                faction: cfg.faction || null,
                speed: cfg.speed,
                maxHealth: cfg.maxHealth,
                armor: cfg.armor,
                damage: cfg.damage,
                description: cfg.description,
                weapons: cfg.availableWeapons,
                specialAbilities: cfg.abilities,
                abilities: cfg.abilities,
                width: 20,
                height: 16
            };
        }).filter(Boolean);
    },

    applyToRuntime(typeId) {
        const id = typeId || 'player';
        const model = this.getMergedModel(id);
        if (model && typeof graphicsManager !== 'undefined' && graphicsManager.setPlayerShipModel) {
            graphicsManager.setPlayerShipModel(model);
        }
        return this.getConfig(id);
    },

    exportJSON(typeId) {
        return JSON.stringify(this.getConfig(typeId), null, 2);
    },

    importJSON(typeId, jsonText) {
        const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        return this.setConfig(typeId, data);
    },
});
