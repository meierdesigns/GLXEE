"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    syncAvailableEnemyTypes() {
        if (typeof enemyConfigManager === 'undefined' || !enemyConfigManager.getTypeIds) return;
        enemyConfigManager.getTypeIds().forEach((id) => {
            if (this.availableEnemyTypes.indexOf(id) === -1) {
                this.availableEnemyTypes.push(id);
            }
        });
    },

    getAvailableEnemyTypesForPlanet(planetId) {
        this.syncAvailableEnemyTypes();
        const pid = String(planetId || '').toLowerCase();
        const gid = this.getPlanetGalaxyId(pid);
        let types = this.availableEnemyTypes.slice();
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getTypesForLocation) {
            const filtered = enemyConfigManager.getTypesForLocation(pid, gid);
            if (filtered.length) types = filtered;
        }
        const planetFactions = this.getPlanetFactions(pid);
        if (planetFactions.length && typeof enemyConfigManager !== 'undefined') {
            types = types.filter((typeId) => this.enemyMatchesPlanetFactions(typeId, planetFactions));
            if (!types.length) types = this.availableEnemyTypes.slice();
        }
        return types;
    },

    getPlanetFactions(planetId) {
        const cfg = this.getConfig(planetId);
        if (!cfg || !Array.isArray(cfg.factions)) return [];
        return cfg.factions.map(String).filter(Boolean);
    },

    /**
     * Empty planet.factions = all factions allowed.
     */
    getAvailableFactionsForPlanet(planetId) {
        const assigned = this.getPlanetFactions(planetId);
        if (assigned.length) return assigned.slice();
        return (this.availableFactions || []).slice();
    },

    enemyMatchesPlanetFactions(typeId, planetFactions) {
        const list = Array.isArray(planetFactions) ? planetFactions : [];
        if (!list.length) return true;
        if (typeof enemyConfigManager === 'undefined') return true;
        const cfg = enemyConfigManager.getConfig(typeId);
        const enemyFactions = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
            ? cfg.factions
            : (enemyConfigManager.getDefaultFaction
                ? [enemyConfigManager.getDefaultFaction(typeId)]
                : []);
        if (!enemyFactions.length) return true;
        return enemyFactions.some((f) => list.indexOf(f) !== -1);
    },

    ensureCatalogValue(list, value, fallback) {
        const v = value != null && String(value).trim() !== '' ? String(value).trim() : fallback;
        if (v && list.indexOf(v) === -1) list.push(v);
        return v;
    },

    normalizeCombatEvent(ev, index) {
        const e = ev || {};
        const triggers = ['hpBelow', 'shieldBelow', 'elapsed'];
        const roles = [
            'assault', 'repair', 'shieldBattery', 'gunner',
            'blocker', 'bomber', 'jammer', 'tether'
        ];
        const trigger = triggers.indexOf(e.trigger) !== -1 ? e.trigger : 'hpBelow';
        const role = roles.indexOf(e.role) !== -1 ? e.role : 'assault';
        return {
            id: e.id || ('evt' + (index != null ? index : 0)),
            trigger: trigger,
            threshold: Math.max(0, Math.min(1, Number(e.threshold != null ? e.threshold : 0.35))),
            elapsedSec: Math.max(0, Number(e.elapsedSec != null ? e.elapsedSec : 0)),
            once: e.once !== false,
            cooldownMs: Math.max(0, Number(e.cooldownMs != null ? e.cooldownMs : 0)),
            action: 'summon',
            count: Math.max(1, Math.min(6, Math.round(Number(e.count != null ? e.count : 1)))),
            role: role,
            type: e.type || 'enemyBasic'
        };
    },

    normalizeEnemyEntry(entry, index) {
        const e = entry || {};
        const type = e.type || 'enemyBasic';
        const defaults = this.taxonomyForType(type);
        const faction = this.ensureCatalogValue(
            this.availableFactions,
            e.faction != null ? e.faction : defaults.faction,
            defaults.faction
        );
        const enemyClass = this.ensureCatalogValue(
            this.availableEnemyClasses,
            e.enemyClass != null ? e.enemyClass : defaults.enemyClass,
            defaults.enemyClass
        );
        const clusterRaw = e.cluster != null ? String(e.cluster).trim() : 'alpha';
        const cluster = this.ensureCatalogValue(
            this.availableClusters,
            clusterRaw || 'alpha',
            'alpha'
        );
        const roles = [
            'assault', 'repair', 'shieldBattery', 'gunner',
            'blocker', 'bomber', 'jammer', 'tether'
        ];
        const role = roles.indexOf(e.role) !== -1 ? e.role : null;
        const combatEvents = Array.isArray(e.combatEvents)
            ? e.combatEvents.map((ev, i) => this.normalizeCombatEvent(ev, i))
            : [];
        const out = {
            id: e.id || this.nextEnemyId('e'),
            type: type,
            faction: faction,
            enemyClass: enemyClass,
            cluster: cluster,
            champion: !!e.champion,
            level: Math.max(1, Math.round(e.level != null ? Number(e.level) : (e.champion ? 2 : 1))),
            spawnAt: Math.max(0, Number(e.spawnAt != null ? e.spawnAt : (index || 0) * 8))
        };
        if (role) out.role = role;
        if (combatEvents.length) out.combatEvents = combatEvents;
        return out;
    },

    normalizeObjective(obj, enemies) {
        const list = Array.isArray(enemies) ? enemies : [];
        const fallbackTarget = (list.find(e => e.champion) || list[0] || {}).id || null;
        const o = obj && typeof obj === 'object' ? obj : {};
        const type = this.availableObjectiveTypes.indexOf(o.type) !== -1 ? o.type : 'hunt';
        const normalized = { type: type };
        if (type === 'hunt') {
            normalized.targetEnemyId = o.targetEnemyId || fallbackTarget;
        } else if (type === 'killCount') {
            normalized.count = Math.max(1, Math.round(o.count != null ? Number(o.count) : 5));
            if (o.enemyType) normalized.enemyType = o.enemyType;
            if (o.faction) normalized.faction = o.faction;
            if (o.enemyClass) normalized.enemyClass = o.enemyClass;
            if (o.cluster) normalized.cluster = o.cluster;
        } else if (type === 'surviveCount') {
            normalized.count = Math.max(1, Math.round(o.count != null ? Number(o.count) : 5));
        } else if (type === 'surviveTime') {
            normalized.seconds = Math.max(1, Math.round(o.seconds != null ? Number(o.seconds) : 60));
        }
        return normalized;
    },

    normalizeDailies(d) {
        if (!d || typeof d !== 'object') {
            return {
                enabled: false,
                enemyType: 'enemyBasic',
                faction: null,
                enemyClass: null,
                killCountPerDay: 5,
                requiredDays: 3
            };
        }
        return {
            enabled: d.enabled !== false,
            enemyType: d.enemyType || 'enemyBasic',
            faction: d.faction || null,
            enemyClass: d.enemyClass || null,
            killCountPerDay: Math.max(1, Math.round(d.killCountPerDay != null ? Number(d.killCountPerDay) : 5)),
            requiredDays: Math.max(1, Math.round(d.requiredDays != null ? Number(d.requiredDays) : 3))
        };
    },

    normalizeStage(stage) {
        if (!stage || typeof stage !== 'object') return null;
        const enemies = Array.isArray(stage.enemies)
            ? stage.enemies.map((e, i) => this.normalizeEnemyEntry(e, i))
            : null;
        const out = {};
        if (enemies) out.enemies = enemies;
        if (stage.objective) out.objective = this.normalizeObjective(stage.objective, enemies || []);
        if (stage.theme != null && stage.theme !== '' && stage.theme !== 'inherit') {
            out.theme = String(stage.theme).toLowerCase();
        }
        return Object.keys(out).length ? out : null;
    },

    migrateLegacyEnemies(data) {
        // Explicit enemies array (including empty) wins — needed for blank planets.
        if (Array.isArray(data.enemies)) {
            return data.enemies.map((e, i) => this.normalizeEnemyEntry(e, i));
        }
        const enemies = [];
        const mainType = (data.graphics && data.graphics.enemyShip) || data.enemyType || 'fighter';
        enemies.push(this.normalizeEnemyEntry({
            id: this.nextEnemyId(data.id || 'main'),
            type: mainType,
            champion: true,
            level: 2,
            spawnAt: 0
        }, 0));
        const sides = Array.isArray(data.sideEnemies) ? data.sideEnemies : [];
        sides.forEach((s, i) => {
            enemies.push(this.normalizeEnemyEntry({
                id: this.nextEnemyId('side'),
                type: s.type || 'enemyBasic',
                champion: false,
                level: 1,
                spawnAt: (i + 1) * 8
            }, i + 1));
        });
        return enemies;
    },

    createDefaults() {
        return {
            ...this.createMainPlanetDefaults(),
            ...this.createPlutoDefaults()
        };
    },
});
