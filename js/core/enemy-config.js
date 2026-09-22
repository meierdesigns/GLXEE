"use strict";

/**
 * Enemy configuration — stats, behavior, weapons, armor/shields per enemy type.
 * Persisted in localStorage; applied when enemy models are selected.
 */
class EnemyConfigManager {
    constructor() {
        this.storageKey = 'vf_enemy_configs_v2_balanced';
        this.playerHullIds = [
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableTypes = [
            'enemyBasic', 'enemyFast', 'enemyHeavy', 'enemyBoss',
            'fighter', 'interceptor', 'cruiser', 'battleship',
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableHullIds = [
            'enemyBasic', 'enemyFast', 'enemyHeavy', 'enemyBoss',
            'fighter', 'interceptor', 'cruiser', 'battleship', 'scout',
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableWeapons = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getIds()
            : ['laser', 'plasma', 'spread', 'rapid', 'missile', 'ion', 'wave', 'burst', 'pierce', 'nova'];
        this.availableDefenseMechanisms = [
            'heavy_armor', 'energy_shield', 'adaptive_shield', 'shield_regen', 'massive_armor'
        ];
        Object.defineProperty(this, 'availableAbilities', {
            get: () => {
                if (typeof abilityConfigManager !== 'undefined') {
                    return abilityConfigManager.getIds();
                }
                return this.availableDefenseMechanisms.slice();
            }
        });
        this.displayNames = {
            enemyBasic: 'BASIC',
            enemyFast: 'FAST',
            enemyHeavy: 'HEAVY',
            enemyBoss: 'BOSS',
            fighter: 'FIGHTER',
            interceptor: 'INTERCEPTOR',
            cruiser: 'CRUISER',
            battleship: 'BATTLESHIP',
            player: 'STARFIGHTER',
            player_interceptor: 'P-INTERCEPTOR',
            player_heavy: 'P-HEAVY',
            player_assault: 'P-ASSAULT'
        };
        this.defaultFactionsByType = {
            enemyBasic: ['pirate'],
            enemyFast: ['kronax'],
            enemyHeavy: ['machine'],
            enemyBoss: ['voidborn'],
            fighter: ['terran'],
            interceptor: ['kronax'],
            cruiser: ['machine'],
            battleship: ['voidborn'],
            player: ['terran'],
            player_interceptor: ['terran'],
            player_heavy: ['terran'],
            player_assault: ['terran']
        };
        this.configs = this.createDefaults();
        this.load();
    }

    createDefaults() {
        return {
            enemyBasic: this.makeEnemy({
                id: 'enemyBasic',
                name: 'Basic Fighter',
                description: 'Fast enemy fighter. Quick but fragile.',
                hullId: 'fighter',
                factions: ['pirate'],
                speed: 1.5,
                verticalSpeed: 0.4,
                maxHealth: 60,
                armor: 6,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                abilities: [],
                damage: 25,
                shootInterval: 1200,
                evasionCooldown: 2000,
                evasionDuration: 800,
                evasionSpeed: 3,
                minY: 25,
                maxY: 100,
                experienceValue: 80,
                defaultWeapon: 'laser',
                weaponDamage: 6,
                weaponSpeed: 6,
                weaponCooldown: 1200
            }),
            enemyFast: this.makeEnemy({
                id: 'enemyFast',
                name: 'Interceptor',
                description: 'High-speed attack craft.',
                hullId: 'interceptor',
                factions: ['kronax'],
                speed: 2.75,
                verticalSpeed: 0.75,
                maxHealth: 50,
                armor: 4,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                damage: 20,
                shootInterval: 1000,
                evasionCooldown: 1800,
                evasionDuration: 700,
                evasionSpeed: 4,
                minY: 25,
                maxY: 100,
                experienceValue: 150,
                defaultWeapon: 'laser',
                weaponDamage: 5,
                weaponSpeed: 7,
                weaponCooldown: 1000
            }),
            enemyHeavy: this.makeEnemy({
                id: 'enemyHeavy',
                name: 'Cruiser',
                description: 'Heavy armored warship.',
                hullId: 'cruiser',
                factions: ['machine'],
                speed: 1.0,
                verticalSpeed: 0.2,
                maxHealth: 110,
                armor: 16,
                shieldMax: 20,
                shieldRegen: 1,
                damageReduction: 5,
                reflectChance: 0,
                defenseMechanisms: ['heavy_armor', 'shield_regen'],
                abilities: ['heavy_armor', 'shield_regen'],
                damage: 40,
                shootInterval: 3000,
                evasionCooldown: 5000,
                evasionDuration: 1500,
                evasionSpeed: 1,
                minY: 25,
                maxY: 100,
                experienceValue: 300,
                defaultWeapon: 'plasma',
                weaponDamage: 16,
                weaponSpeed: 3,
                weaponCooldown: 1500
            }),
            enemyBoss: this.makeEnemy({
                id: 'enemyBoss',
                name: 'Battleship',
                description: 'Massive enemy battleship.',
                hullId: 'battleship',
                factions: ['voidborn'],
                speed: 0.4,
                verticalSpeed: 0.05,
                maxHealth: 220,
                armor: 28,
                shieldMax: 45,
                shieldRegen: 1,
                damageReduction: 10,
                reflectChance: 0,
                defenseMechanisms: ['massive_armor', 'energy_shield', 'shield_regen'],
                abilities: ['massive_armor', 'energy_shield', 'shield_regen', 'boss_ai'],
                damage: 90,
                shootInterval: 1800,
                evasionCooldown: 8000,
                evasionDuration: 2500,
                evasionSpeed: 0.5,
                minY: 25,
                maxY: 100,
                experienceValue: 750,
                defaultWeapon: 'plasma',
                weaponDamage: 22,
                weaponSpeed: 2,
                weaponCooldown: 1200,
                combatEvents: [
                    {
                        id: 'reinforce_low',
                        trigger: 'hpBelow',
                        threshold: 0.35,
                        once: true,
                        action: 'summon',
                        count: 2,
                        role: 'gunner',
                        type: 'enemyFast'
                    },
                    {
                        id: 'repair_panic',
                        trigger: 'hpBelow',
                        threshold: 0.2,
                        once: true,
                        action: 'summon',
                        count: 2,
                        role: 'repair',
                        type: 'enemyBasic'
                    }
                ]
            }),
            fighter: this.makeEnemy({
                id: 'fighter',
                name: 'Fighter',
                description: 'Fast enemy fighter. Quick but fragile.',
                hullId: 'fighter',
                factions: ['terran'],
                speed: 1.5,
                verticalSpeed: 0.4,
                maxHealth: 60,
                armor: 6,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                abilities: [],
                damage: 25,
                shootInterval: 1200,
                evasionCooldown: 2000,
                evasionDuration: 800,
                evasionSpeed: 3,
                minY: 25,
                maxY: 100,
                experienceValue: 80,
                defaultWeapon: 'laser',
                weaponDamage: 6,
                weaponSpeed: 6,
                weaponCooldown: 1200
            }),
            interceptor: this.makeEnemy({
                id: 'interceptor',
                name: 'Interceptor',
                description: 'High-speed attack craft.',
                hullId: 'interceptor',
                factions: ['kronax'],
                speed: 2.75,
                verticalSpeed: 0.75,
                maxHealth: 50,
                armor: 4,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                damage: 20,
                shootInterval: 1000,
                evasionCooldown: 1800,
                evasionDuration: 700,
                evasionSpeed: 4,
                minY: 25,
                maxY: 100,
                experienceValue: 150,
                defaultWeapon: 'laser',
                weaponDamage: 5,
                weaponSpeed: 7,
                weaponCooldown: 1000
            }),
            cruiser: this.makeEnemy({
                id: 'cruiser',
                name: 'Cruiser',
                description: 'Heavy armored warship.',
                hullId: 'cruiser',
                factions: ['machine'],
                speed: 1.0,
                verticalSpeed: 0.2,
                maxHealth: 110,
                armor: 16,
                shieldMax: 20,
                shieldRegen: 1,
                damageReduction: 5,
                reflectChance: 0,
                defenseMechanisms: ['heavy_armor', 'shield_regen'],
                abilities: ['heavy_armor', 'shield_regen'],
                damage: 40,
                shootInterval: 3000,
                evasionCooldown: 5000,
                evasionDuration: 1500,
                evasionSpeed: 1,
                minY: 25,
                maxY: 100,
                experienceValue: 300,
                defaultWeapon: 'plasma',
                weaponDamage: 16,
                weaponSpeed: 3,
                weaponCooldown: 1500
            }),
            battleship: this.makeEnemy({
                id: 'battleship',
                name: 'Battleship',
                description: 'Massive enemy battleship.',
                hullId: 'battleship',
                factions: ['voidborn'],
                speed: 0.4,
                verticalSpeed: 0.05,
                maxHealth: 220,
                armor: 28,
                shieldMax: 45,
                shieldRegen: 1,
                damageReduction: 10,
                reflectChance: 0,
                defenseMechanisms: ['massive_armor', 'energy_shield', 'shield_regen'],
                abilities: ['massive_armor', 'energy_shield', 'shield_regen', 'boss_ai'],
                damage: 90,
                shootInterval: 1800,
                evasionCooldown: 8000,
                evasionDuration: 2500,
                evasionSpeed: 0.5,
                minY: 25,
                maxY: 100,
                experienceValue: 750,
                defaultWeapon: 'plasma',
                weaponDamage: 22,
                weaponSpeed: 2,
                weaponCooldown: 1200,
                combatEvents: [
                    {
                        id: 'reinforce_low',
                        trigger: 'hpBelow',
                        threshold: 0.35,
                        once: true,
                        action: 'summon',
                        count: 2,
                        role: 'gunner',
                        type: 'enemyFast'
                    },
                    {
                        id: 'repair_panic',
                        trigger: 'hpBelow',
                        threshold: 0.2,
                        once: true,
                        action: 'summon',
                        count: 2,
                        role: 'repair',
                        type: 'enemyBasic'
                    }
                ]
            }),
            player: this.makeEnemyFromPlayerHull('player', {
                name: 'Starfighter (Enemy)',
                description: 'Player starfighter hull used as enemy.',
                factions: ['terran'],
                speed: 1.8,
                verticalSpeed: 0.45,
                maxHealth: 90,
                armor: 15,
                damage: 22,
                experienceValue: 100,
                defaultWeapon: 'laser',
                weaponDamage: 8,
                weaponSpeed: 7,
                weaponCooldown: 900
            }),
            player_interceptor: this.makeEnemyFromPlayerHull('player_interceptor', {
                name: 'Interceptor (Enemy)',
                description: 'Player interceptor hull used as enemy.',
                factions: ['terran', 'kronax'],
                speed: 2.9,
                verticalSpeed: 0.8,
                maxHealth: 70,
                armor: 8,
                damage: 18,
                experienceValue: 140,
                defaultWeapon: 'rapid',
                weaponDamage: 5,
                weaponSpeed: 9,
                weaponCooldown: 500
            }),
            player_heavy: this.makeEnemyFromPlayerHull('player_heavy', {
                name: 'Heavy Fighter (Enemy)',
                description: 'Player heavy fighter hull used as enemy.',
                factions: ['terran', 'machine'],
                speed: 1.0,
                verticalSpeed: 0.2,
                maxHealth: 160,
                armor: 40,
                damage: 40,
                experienceValue: 280,
                defaultWeapon: 'spread',
                weaponDamage: 14,
                weaponSpeed: 4,
                weaponCooldown: 1400
            }),
            player_assault: this.makeEnemyFromPlayerHull('player_assault', {
                name: 'Assault (Enemy)',
                description: 'Player assault hull used as enemy.',
                factions: ['terran', 'pirate'],
                speed: 1.4,
                verticalSpeed: 0.35,
                maxHealth: 120,
                armor: 25,
                damage: 30,
                experienceValue: 180,
                defaultWeapon: 'laser',
                weaponDamage: 10,
                weaponSpeed: 6,
                weaponCooldown: 1000
            })
        };
    }

    makeEnemyFromPlayerHull(hullId, data) {
        return this.makeEnemy(Object.assign({
            id: hullId,
            hullId: hullId,
            minY: 25,
            maxY: 100
        }, data || {}));
    }

    normalizeIdList(value) {
        if (!Array.isArray(value)) return [];
        const out = [];
        value.forEach((v) => {
            const id = String(v || '').trim();
            if (id && out.indexOf(id) === -1) out.push(id);
        });
        return out;
    }

    makeEnemy(data) {
        const fromAbilities = Array.isArray(data.abilities) ? data.abilities.map(String) : null;
        const fromDefense = Array.isArray(data.defenseMechanisms) ? data.defenseMechanisms.map(String) : [];
        const abilities = fromAbilities && fromAbilities.length
            ? fromAbilities
            : fromDefense;
        const id = data.id;
        const defaultFactions = this.defaultFactionsByType[id] || [];
        const factions = this.normalizeIdList(
            data.factions != null
                ? data.factions
                : (data.faction != null ? [data.faction] : defaultFactions)
        );
        const hullId = data.hullId
            || (this.availableHullIds.indexOf(id) !== -1 ? id : 'fighter');
        return {
            id: id,
            name: data.name || data.id,
            description: data.description || '',
            hullId: String(hullId),
            factions: factions,
            planetIds: this.normalizeIdList(data.planetIds),
            galaxyIds: this.normalizeIdList(data.galaxyIds),
            speed: data.speed != null ? Number(data.speed) : 1,
            verticalSpeed: data.verticalSpeed != null ? Number(data.verticalSpeed) : 0.3,
            maxHealth: data.maxHealth != null ? Math.round(Number(data.maxHealth)) : 100,
            armor: data.armor != null ? Math.round(Number(data.armor)) : 10,
            shieldMax: data.shieldMax != null ? Math.round(Number(data.shieldMax)) : 0,
            shieldRegen: data.shieldRegen != null ? Number(data.shieldRegen) : 0,
            damageReduction: data.damageReduction != null ? Math.round(Number(data.damageReduction)) : 0,
            reflectChance: data.reflectChance != null ? Math.round(Number(data.reflectChance)) : 0,
            abilities: abilities.slice(),
            defenseMechanisms: abilities.slice(),
            damage: data.damage != null ? Math.round(Number(data.damage)) : 20,
            shootInterval: data.shootInterval != null ? Math.round(Number(data.shootInterval)) : 1200,
            evasionCooldown: data.evasionCooldown != null ? Math.round(Number(data.evasionCooldown)) : 3000,
            evasionDuration: data.evasionDuration != null ? Math.round(Number(data.evasionDuration)) : 1000,
            evasionSpeed: data.evasionSpeed != null ? Number(data.evasionSpeed) : 2,
            evasionChance: data.evasionChance != null ? Math.max(0, Math.min(1, Number(data.evasionChance))) : 1,
            predictionSkill: data.predictionSkill != null ? Math.max(0, Math.min(1, Number(data.predictionSkill))) : 0.35,
            minY: data.minY != null ? Math.round(Number(data.minY)) : 25,
            maxY: data.maxY != null ? Math.round(Number(data.maxY)) : 100,
            experienceValue: data.experienceValue != null ? Math.round(Number(data.experienceValue)) : 100,
            defaultWeapon: data.defaultWeapon || 'laser',
            weaponDamage: data.weaponDamage != null ? Number(data.weaponDamage) : 6,
            weaponSpeed: data.weaponSpeed != null ? Number(data.weaponSpeed) : 5,
            weaponCooldown: data.weaponCooldown != null ? Math.round(Number(data.weaponCooldown)) : 1200,
            combatEvents: Array.isArray(data.combatEvents)
                ? data.combatEvents.map((ev, i) => {
                    const e = ev || {};
                    return {
                        id: e.id || ('evt' + i),
                        trigger: e.trigger || 'hpBelow',
                        threshold: e.threshold != null ? Number(e.threshold) : 0.35,
                        elapsedSec: e.elapsedSec != null ? Number(e.elapsedSec) : 0,
                        once: e.once !== false,
                        cooldownMs: e.cooldownMs != null ? Number(e.cooldownMs) : 0,
                        action: 'summon',
                        count: Math.max(1, Math.round(Number(e.count != null ? e.count : 1))),
                        role: e.role || 'assault',
                        type: e.type || 'enemyBasic'
                    };
                })
                : [],
            explosionId: data.explosionId || this.defaultExplosionId(id)
        };
    }

    defaultExplosionId(typeId) {
        const id = String(typeId || '');
        if (id === 'enemyBoss' || id === 'battleship' || id.indexOf('player') === 0) return 'ship_death';
        if (id === 'enemyHeavy' || id === 'cruiser') return 'plasma_bloom';
        if (id === 'enemyFast' || id === 'interceptor') return 'small_pop';
        return 'default';
    }

    getHullId(typeId) {
        const cfg = this.getConfig(typeId);
        const hull = cfg && cfg.hullId ? String(cfg.hullId) : String(typeId || 'enemyBasic');
        return hull;
    }

    getHullOptions() {
        const ids = this.availableHullIds.slice();
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getTypeIds) {
            shipConfigManager.getTypeIds().forEach((id) => {
                if (ids.indexOf(id) === -1) ids.push(id);
            });
        }
        return ids;
    }

    getFactionOptions() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.availableFactions) {
            return planetConfigManager.availableFactions.slice();
        }
        return ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    }

    getPlanetOptions() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetIds) {
            return planetConfigManager.getPlanetIds();
        }
        return ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
    }

    getGalaxyOptions() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds) {
            return planetConfigManager.getGalaxyIds();
        }
        return ['milky_way', 'andromeda'];
    }

    /**
     * Empty planetIds / galaxyIds = appears everywhere.
     */
    canAppearOn(typeId, planetId, galaxyId) {
        const cfg = this.getConfig(typeId);
        if (!cfg) return false;
        const pid = planetId != null ? String(planetId).toLowerCase() : null;
        const gid = galaxyId != null ? String(galaxyId).toLowerCase() : null;
        if (cfg.galaxyIds && cfg.galaxyIds.length) {
            if (!gid || cfg.galaxyIds.indexOf(gid) === -1) return false;
        }
        if (cfg.planetIds && cfg.planetIds.length) {
            if (!pid || cfg.planetIds.indexOf(pid) === -1) return false;
        }
        return true;
    }

    getTypesForLocation(planetId, galaxyId) {
        return this.getTypeIds().filter((id) => this.canAppearOn(id, planetId, galaxyId));
    }

    getDefaultFaction(typeId) {
        const cfg = this.getConfig(typeId);
        if (cfg && cfg.factions && cfg.factions.length) return cfg.factions[0];
        const fallback = this.defaultFactionsByType[typeId];
        return (fallback && fallback[0]) || 'pirate';
    }

    getTypeIds() {
        return this.availableTypes.slice();
    }

    getDisplayName(typeId) {
        return this.displayNames[typeId] || String(typeId).toUpperCase();
    }

    getConfig(typeId) {
        const id = String(typeId || 'enemyBasic');
        if (!this.configs[id]) {
            const defaults = this.createDefaults();
            this.configs[id] = defaults[id] || this.makeEnemy({ id: id, name: id });
        }
        return this.configs[id];
    }

    setConfig(typeId, data) {
        const id = String(typeId);
        this.configs[id] = this.makeEnemy(Object.assign({}, this.getConfig(id), data, { id: id }));
        this.save();
        return this.configs[id];
    }

    resetConfig(typeId) {
        const defaults = this.createDefaults();
        const id = String(typeId);
        if (defaults[id]) {
            this.configs[id] = defaults[id];
            this.save();
        }
        return this.configs[id];
    }

    resetAll() {
        this.configs = this.createDefaults();
        this.save();
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('EnemyConfigManager: save failed', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const defaults = this.createDefaults();
            Object.keys(defaults).forEach(id => {
                if (parsed[id]) {
                    this.configs[id] = this.makeEnemy(Object.assign({}, defaults[id], parsed[id], { id: id }));
                }
            });
            Object.keys(parsed).forEach(id => {
                if (!this.configs[id]) {
                    this.configs[id] = this.makeEnemy(Object.assign({}, parsed[id], { id: id }));
                }
            });
        } catch (e) {
            console.warn('EnemyConfigManager: load failed', e);
        }
    }

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
    }

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
    }

    getMergedModel(typeId) {
        return this.applyOverridesToModel(typeId, this.getBaseModel(typeId));
    }

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
    }

    exportJSON(typeId) {
        return JSON.stringify(this.getConfig(typeId), null, 2);
    }

    importJSON(typeId, jsonText) {
        const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        return this.setConfig(typeId, data);
    }
}

const enemyConfigManager = new EnemyConfigManager();
