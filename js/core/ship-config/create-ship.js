"use strict";

// ShipConfigManager methods, split from ship-config.js.
extendClass(ShipConfigManager, {
    createShip(partial) {
        const baseId = (partial && partial.baseId) || 'player';
        const base = this.getConfig(baseId);
        const id = 'custom_' + Date.now().toString(36);
        const ship = this.makeShip(Object.assign({}, base, partial || {}, {
            id: id,
            custom: true,
            baseId: baseId,
            name: (partial && partial.name) || ('Custom ' + (base.name || 'Ship')),
            modelClass: (partial && partial.modelClass) || base.modelClass || this.modelClassById[baseId] || 'starfighter'
        }));
        this.configs[id] = ship;
        this.save();
        return ship;
    },

    deleteShip(typeId) {
        const id = String(typeId);
        if (!this.configs[id] || !this.configs[id].custom) return false;
        delete this.configs[id];
        this.save();
        return true;
    },

    resetConfig(typeId) {
        const defaults = this.createDefaults();
        const id = String(typeId);
        if (defaults[id]) {
            this.configs[id] = defaults[id];
            this.save();
            return this.configs[id];
        }
        if (this.configs[id] && this.configs[id].custom) {
            const baseId = this.configs[id].baseId || 'player';
            const base = defaults[baseId] || defaults.player;
            this.configs[id] = this.makeShip(Object.assign({}, base, {
                id: id,
                custom: true,
                baseId: baseId,
                name: this.configs[id].name
            }));
            this.save();
        }
        return this.configs[id];
    },

    resetAll() {
        this.configs = this.createDefaults();
        this.save();
    },

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('ShipConfigManager: save failed', e);
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const defaults = this.createDefaults();
            Object.keys(defaults).forEach((id) => {
                if (parsed[id]) {
                    this.configs[id] = this.makeShip(Object.assign({}, defaults[id], parsed[id], { id: id }));
                }
            });
            Object.keys(parsed).forEach((id) => {
                if (!this.configs[id]) {
                    this.configs[id] = this.makeShip(Object.assign({}, parsed[id], { id: id }));
                }
            });
        } catch (e) {
            console.warn('ShipConfigManager: load failed', e);
        }
    },

    resolveAssetKey(typeId) {
        const cfg = this.getConfig(typeId);
        if (cfg.custom && cfg.baseId) return cfg.baseId;
        if (typeId === 'player_scrap') return 'player';
        if (typeId === 'player_kronax_raider') return 'player_interceptor';
        if (typeId === 'player_kronax_claw') return 'player';
        if (this.baseTypes.indexOf(typeId) !== -1) return typeId;
        return 'player';
    },

    getBaseModel(typeId) {
        const assetKey = this.resolveAssetKey(typeId);
        let model = null;
        if (typeof graphicsManager !== 'undefined') {
            if (graphicsManager.shipAssetLoader && graphicsManager.shipAssetLoader.isLoaded()) {
                model = graphicsManager.shipAssetLoader.getShip(assetKey);
            } else if (graphicsManager.shipModels) {
                model = graphicsManager.shipModels.getShipModel(assetKey);
            }
        }
        return model;
    },

    applyOverridesToModel(typeId, baseModel) {
        if (!baseModel) return baseModel;
        const cfg = this.getConfig(typeId);
        const merged = Object.assign({}, baseModel);
        merged.id = cfg.id;
        merged.name = cfg.name || baseModel.name;
        merged.description = cfg.description || baseModel.description;
        merged.modelClass = cfg.modelClass || baseModel.modelClass;
        if (cfg.segmentUv && typeof shipLoadoutManager !== 'undefined') {
            merged.segmentUv = Object.assign(
                {},
                shipLoadoutManager.segmentUv,
                cfg.segmentUv,
                { wing: Object.assign({}, shipLoadoutManager.segmentUv.wing, cfg.segmentUv.wing) }
            );
        }
        merged.faction = cfg.faction != null ? cfg.faction : (baseModel.faction || null);
        merged.speed = cfg.speed;
        merged.maxHealth = cfg.maxHealth;
        merged.armor = cfg.armor;
        merged.damage = cfg.damage;
        merged.minY = cfg.minY;
        merged.maxY = cfg.maxY;
        merged.defaultWeapon = cfg.defaultWeapon;
        merged.availableWeapons = cfg.availableWeapons.slice();
        merged.abilities = cfg.abilities.slice();
        merged.specialAbilities = cfg.abilities.map((a) =>
            String(a).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        );
        merged.weapons = cfg.availableWeapons.map((w) =>
            String(w).replace(/\b\w/g, (c) => c.toUpperCase())
        );
        merged.tier = cfg.tier;
        merged.cost = cfg.cost;
        merged.type = 'player';
        // Hull core size comes from the modelClass, not the raw sprite pixel
        // size — source ship art isn't drawn to a shared scale, so deriving
        // size straight from sprite width/height made e.g. the base
        // Starfighter render larger on screen than the Heavy Fighter.
        // shipLoadoutManager.coreSizes already encodes the intended
        // interceptor < starfighter < assault < heavy_fighter progression.
        const classCoreSizes = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.coreSizes)
            ? shipLoadoutManager.coreSizes
            : null;
        const classCore = classCoreSizes && classCoreSizes[merged.modelClass];
        if (classCore) {
            // shipLoadoutManager.coreSizes is tuned for the hangar/editor preview,
            // which upscales the hull with an integer pixel-art zoom factor.
            // Gameplay renders at ~1:1, so scale the same proportions up —
            // too small and the procedural hull segments degenerate into a blob.
            const gameplayCoreScale = 1.7;
            merged.nativeWidth = Math.max(8, Math.round(classCore.width * gameplayCoreScale));
            merged.nativeHeight = Math.max(8, Math.round(classCore.height * gameplayCoreScale));
        } else {
            const hullShrink = 0.75;
            const bw = Math.max(8, Math.round(Number(baseModel.width) || 20));
            const bh = Math.max(8, Math.round(Number(baseModel.height) || 16));
            merged.nativeWidth = Math.max(8, Math.round(bw * hullShrink));
            merged.nativeHeight = Math.max(8, Math.round(bh * hullShrink));
        }

        const weaponKey = cfg.defaultWeapon || 'laser';
        const weaponEntry = {
            damage: cfg.weaponDamage,
            speed: cfg.weaponSpeed,
            cooldown: cfg.weaponCooldown
        };
        merged.weaponConfig = Object.assign({}, baseModel.weaponConfig || {});
        cfg.availableWeapons.forEach((w) => {
            const fromRegistry = (typeof weaponConfigManager !== 'undefined')
                ? weaponConfigManager.getDefaultsForShip(w)
                : {};
            merged.weaponConfig[w] = Object.assign(
                {},
                fromRegistry,
                (baseModel.weaponConfig && baseModel.weaponConfig[w]) || {},
                w === weaponKey ? weaponEntry : {}
            );
        });
        merged.weaponConfig[weaponKey] = Object.assign(
            {},
            merged.weaponConfig[weaponKey] || {},
            weaponEntry
        );

        // Hull is core-only; weapons / defenses / abilities attach and grow the ship.
        if (typeof shipLoadoutManager !== 'undefined') {
            shipLoadoutManager.applyLayoutToModel(merged, cfg.id);
            const L = merged.loadout || { weapons: merged.availableWeapons };
            const activeWeapon = (L.weapons && L.weapons[0]) || weaponKey;
            merged.defaultWeapon = activeWeapon;
            merged.weaponConfig = Object.assign({}, merged.weaponConfig || {});
            const bonuses = (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses)
                ? profileManager.getModuleUpgradeBonuses()
                : null;
            (L.weapons || merged.availableWeapons).forEach((w) => {
                const fromRegistry = (typeof weaponConfigManager !== 'undefined')
                    ? weaponConfigManager.getDefaultsForShip(w)
                    : {};
                const entry = Object.assign(
                    {},
                    fromRegistry,
                    (baseModel.weaponConfig && baseModel.weaponConfig[w]) || {},
                    merged.weaponConfig[w] || {},
                    w === weaponKey ? weaponEntry : {},
                    // Always keep shot footprint from the shared weapon registry.
                    {
                        width: fromRegistry.width != null ? fromRegistry.width : 2,
                        height: fromRegistry.height != null ? fromRegistry.height : 8
                    }
                );
                if (bonuses) {
                    if (entry.damage != null) {
                        entry.damage = Math.max(1, Math.round(Number(entry.damage) * bonuses.weaponDamageMul));
                    }
                    if (entry.cooldown != null) {
                        entry.cooldown = Math.max(50, Math.round(Number(entry.cooldown) * bonuses.weaponCooldownMul));
                    }
                    if (bonuses.weaponProjectileBonus > 0) {
                        entry.projectileCount = Math.max(
                            1,
                            Math.round(Number(entry.projectileCount) || 1) + bonuses.weaponProjectileBonus
                        );
                    }
                }
                if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
                    weaponConfigManager.clampWeaponShot(entry);
                }
                merged.weaponConfig[w] = entry;
            });
            if (bonuses) {
                merged.moduleUpgradeBonuses = bonuses;
            }
        }

        if (merged.weaponConfig && typeof weaponConfigManager !== 'undefined'
            && weaponConfigManager.clampWeaponShot) {
            Object.keys(merged.weaponConfig).forEach((k) => {
                weaponConfigManager.clampWeaponShot(merged.weaponConfig[k]);
            });
        }

        return merged;
    },

    getMergedModel(typeId) {
        return this.applyOverridesToModel(typeId, this.getBaseModel(typeId));
    },
});
