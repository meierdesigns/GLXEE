"use strict";

// EnemyConfigManager methods, split from enemy-config.js.
extendClass(EnemyConfigManager, {
    /**
     * Merge saved stats onto a base ship model (non-destructive copy).
     */
    applyOverridesToModel(typeId, baseModel) {
        if (!baseModel) return baseModel;
        const cfg = this.getConfig(typeId);
        const merged = Object.assign({}, baseModel);
        merged.forceEnemyOrientation = true;
        merged.name = cfg.name || baseModel.name;
        merged.description = cfg.description || baseModel.description;
        merged.hullId = cfg.hullId || this.getHullId(typeId);
        merged.factions = (cfg.factions || []).slice();
        merged.planetIds = (cfg.planetIds || []).slice();
        merged.galaxyIds = (cfg.galaxyIds || []).slice();
        merged.speed = cfg.speed;
        merged.verticalSpeed = cfg.verticalSpeed;
        merged.maxHealth = cfg.maxHealth;
        merged.armor = cfg.armor;
        merged.shieldMax = cfg.shieldMax;
        merged.shieldRegen = cfg.shieldRegen;
        merged.damageReduction = cfg.damageReduction;
        merged.reflectChance = cfg.reflectChance;
        merged.abilities = (cfg.abilities || cfg.defenseMechanisms || []).slice();
        merged.defenseMechanisms = merged.abilities.slice();
        merged.specialAbilities = merged.abilities.slice();
        merged.damage = cfg.damage;
        merged.shootInterval = cfg.shootInterval;
        merged.evasionCooldown = cfg.evasionCooldown;
        merged.evasionDuration = cfg.evasionDuration;
        merged.evasionSpeed = cfg.evasionSpeed;
        merged.evasionChance = cfg.evasionChance;
        merged.predictionSkill = cfg.predictionSkill;
        merged.minY = cfg.minY;
        merged.maxY = cfg.maxY;
        merged.experienceValue = cfg.experienceValue;
        merged.defaultWeapon = cfg.defaultWeapon;

        const weaponKey = cfg.defaultWeapon || 'laser';
        const weaponEntry = {
            damage: cfg.weaponDamage,
            speed: cfg.weaponSpeed,
            cooldown: cfg.weaponCooldown
        };
        const fromRegistry = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getDefaultsForShip(weaponKey)
            : { width: 2, height: 8 };
        merged.weaponConfig = Object.assign({}, baseModel.weaponConfig || {});
        merged.weaponConfig[weaponKey] = Object.assign(
            {},
            fromRegistry,
            (baseModel.weaponConfig && baseModel.weaponConfig[weaponKey]) || {},
            weaponEntry,
            { width: fromRegistry.width, height: fromRegistry.height }
        );
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
            Object.keys(merged.weaponConfig).forEach((k) => {
                weaponConfigManager.clampWeaponShot(merged.weaponConfig[k]);
            });
        }
        if (!merged.availableWeapons) {
            merged.availableWeapons = [weaponKey];
        } else if (merged.availableWeapons.indexOf(weaponKey) === -1) {
            merged.availableWeapons = merged.availableWeapons.concat([weaponKey]);
        }
        return merged;
    },

    getBaseModel(typeId) {
        const hullId = this.getHullId(typeId);
        let model = null;
        if (typeof graphicsManager !== 'undefined') {
            if (graphicsManager.shipAssetLoader && graphicsManager.shipAssetLoader.isLoaded()) {
                model = graphicsManager.shipAssetLoader.getShip(hullId);
            } else if (graphicsManager.shipModels) {
                model = graphicsManager.shipModels.getShipModel(hullId);
            }
        }
        if (model) {
            model = Object.assign({}, model, { forceEnemyOrientation: true });
        }
        return model;
    },

    getMergedModel(typeId) {
        return this.applyOverridesToModel(typeId, this.getBaseModel(typeId));
    },

    applyToRuntime(typeId) {
        const id = typeId || (typeof enemyManager !== 'undefined' && enemyManager.getShipType
            ? enemyManager.getShipType()
            : 'enemyBasic');
        if (typeof graphicsManager !== 'undefined' && graphicsManager.setEnemyShipType) {
            graphicsManager.setEnemyShipType(id);
        }
        if (typeof enemyManager !== 'undefined' && enemyManager.setShipType) {
            enemyManager.setShipType(id);
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
