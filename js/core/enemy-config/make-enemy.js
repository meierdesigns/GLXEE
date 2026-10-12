"use strict";

// EnemyConfigManager methods, split from enemy-config.js.
extendClass(EnemyConfigManager, {
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
    },

    defaultExplosionId(typeId) {
        const id = String(typeId || '');
        if (id === 'enemyBoss' || id === 'battleship' || id.indexOf('player') === 0) return 'ship_death';
        if (id === 'enemyHeavy' || id === 'cruiser') return 'plasma_bloom';
        if (id === 'enemyFast' || id === 'interceptor') return 'small_pop';
        return 'default';
    },

    getHullId(typeId) {
        const cfg = this.getConfig(typeId);
        const hull = cfg && cfg.hullId ? String(cfg.hullId) : String(typeId || 'enemyBasic');
        return hull;
    },

    getHullOptions() {
        const ids = this.availableHullIds.slice();
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getTypeIds) {
            shipConfigManager.getTypeIds().forEach((id) => {
                if (ids.indexOf(id) === -1) ids.push(id);
            });
        }
        return ids;
    },

    getFactionOptions() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.availableFactions) {
            return planetConfigManager.availableFactions.slice();
        }
        return ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    },

    getPlanetOptions() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetIds) {
            return planetConfigManager.getPlanetIds();
        }
        return ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
    },

    getGalaxyOptions() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds) {
            return planetConfigManager.getGalaxyIds();
        }
        return ['milky_way', 'andromeda'];
    },

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
    },

    getTypesForLocation(planetId, galaxyId) {
        return this.getTypeIds().filter((id) => this.canAppearOn(id, planetId, galaxyId));
    },

    getDefaultFaction(typeId) {
        const cfg = this.getConfig(typeId);
        if (cfg && cfg.factions && cfg.factions.length) return cfg.factions[0];
        const fallback = this.defaultFactionsByType[typeId];
        return (fallback && fallback[0]) || 'pirate';
    },

    getTypeIds() {
        return this.availableTypes.slice();
    },

    getDisplayName(typeId) {
        return this.displayNames[typeId] || String(typeId).toUpperCase();
    },

    getConfig(typeId) {
        const id = String(typeId || 'enemyBasic');
        if (!this.configs[id]) {
            const defaults = this.createDefaults();
            this.configs[id] = defaults[id] || this.makeEnemy({ id: id, name: id });
        }
        return this.configs[id];
    },

    setConfig(typeId, data) {
        const id = String(typeId);
        this.configs[id] = this.makeEnemy(Object.assign({}, this.getConfig(id), data, { id: id }));
        this.save();
        return this.configs[id];
    },

    resetConfig(typeId) {
        const defaults = this.createDefaults();
        const id = String(typeId);
        if (defaults[id]) {
            this.configs[id] = defaults[id];
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
            console.warn('EnemyConfigManager: save failed', e);
        }
    },

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
    },
});
