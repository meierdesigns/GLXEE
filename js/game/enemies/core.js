"use strict";

// Enemy management
class EnemyManager {
    constructor() {
        this.enemy = null;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.shield = 0;
        this.shieldMax = 0;
        this.shieldRegen = 0;
        this.armor = 0;
        this.damageReduction = 0;
        this.reflectChance = 0;
        this.defenseMechanisms = [];
        this.evasionTimer = 0;
        this.evasionCooldown = 5000;
        this.evasionDuration = 1000;
        this.isEvading = false;
        this.evasionSpeed = 2;
        this.evasionChance = 1;
        this.predictionSkill = 0;
        this.lastPlayerPosition = null;
        this.currentShipType = 'enemyBasic';
        this.currentEnemyModel = null;
        this.sideEnemies = [];
        this.sideEnemyPool = [];
        this.sideEnemySpawnTimer = 0;
        this.sideEnemySpawnInterval = 8000;
        this.sideEnemyCap = 3;
        this.schedule = [];
        this.scheduleElapsedMs = 0;
        this.levelMods = { enemySpeed: 1, enemyHealth: 100, isBoss: false, planetId: 'mars' };
        this.pendingChampionEntry = null;
        this.activeCombatEvents = [];
        this.firedCombatEventIds = {};
        this.combatEventCooldowns = {};
        this.pendingCombatAnnounces = {};
        this.championCombatElapsedMs = 0;
        this.sideDebuffs = { jammer: false, tether: false };
        this.spawnFrozen = false;
        this.sideFleeing = false;
    }

    /** Side craft break formation and exit the field (still able to fire). */
    beginSideEnemyFlee(gameState) {
        this.sideFleeing = true;
        if (!this.sideEnemies || !this.sideEnemies.length) return;
        const canvasWidth = (gameState && gameState.width)
            || (typeof game !== 'undefined' && (game.internalWidth || game.width))
            || 200;
        const midX = canvasWidth * 0.5;
        for (let i = 0; i < this.sideEnemies.length; i++) {
            const e = this.sideEnemies[i];
            if (!e || e.fleeing) continue;
            e.fleeing = true;
            e.isEscort = false;
            e.repairBeamActive = false;
            const cx = e.x + (e.width || 0) * 0.5;
            const awayX = cx < midX ? -1 : 1;
            const fleeSpd = 0.85 + Math.random() * 0.55;
            e.speed = awayX * fleeSpd;
            e.verticalSpeed = -(0.95 + Math.random() * 0.55);
            e.lifetimeMs = 0;
        }
    }

    setEnemySchedule(entries, levelMods) {
        if (levelMods) {
            this.levelMods = Object.assign({}, this.levelMods, levelMods);
        }
        const planetId = this.levelMods.planetId || null;
        const galaxyId = (typeof planetConfigManager !== 'undefined' && planetId)
            ? planetConfigManager.getPlanetGalaxyId(planetId)
            : null;
        const raw = Array.isArray(entries) ? entries : [];
        const allowedRaw = raw.filter((e) => {
            // Champions are the hunt target — never drop them for faction/location filters
            // (planet enemyType can disagree with assigned factions, e.g. Jupiter+cruiser).
            if (e && e.champion) return true;
            const type = e.type || 'enemyBasic';
            if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.canAppearOn) {
                if (!enemyConfigManager.canAppearOn(type, planetId, galaxyId)) return false;
            }
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.enemyMatchesPlanetFactions) {
                const planetFactions = planetConfigManager.getHostileFactions ? planetConfigManager.getHostileFactions(planetId) : planetConfigManager.getPlanetFactions(planetId);
                if (planetFactions.length && !planetConfigManager.enemyMatchesPlanetFactions(type, planetFactions)) {
                    return false;
                }
            }
            return true;
        });
        // Faction/planet filters must never wipe a stage empty — that leaves FIRE TO START
        // with no ships and an empty enemy HUD for the whole run.
        let allowed = allowedRaw.length ? allowedRaw : raw.slice();
        // If filters somehow still left no champion, force the first champion from raw back in.
        if (allowed.length && !allowed.some((e) => e && e.champion)) {
            const champ = raw.find((e) => e && e.champion);
            if (champ) allowed = [champ].concat(allowed);
        }
        // The level's factions (main first): enemies without their own faction
        // belong to the level, not to their ship type's default (mostly
        // pirate) — otherwise pirates leaked into every level.
        // Hostile only: the player's own faction and its allies never attack.
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const levelFactions = pcm && pcm.getHostileFactions
            ? (pcm.getHostileFactions(planetId) || [])
            : (pcm && pcm.getPlanetFactions ? (pcm.getPlanetFactions(planetId) || []) : []);
        const friendly = (f) => !!(pcm && pcm.isFriendlyFaction && pcm.isFriendlyFaction(f));
        this.levelFactions = levelFactions.slice();
        this.schedule = allowed.map((e, i) => {
            const type = e.type || 'enemyBasic';
            let tax = { faction: 'pirate', enemyClass: 'assault' };
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
                tax = planetConfigManager.taxonomyForType(type) || tax;
            } else if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
                tax.faction = enemyConfigManager.getDefaultFaction(type);
            }
            const typeFaction = tax.faction || 'pirate';
            // Only the level's (= galaxy's) factions fight here: a foreign
            // explicit or type faction becomes the level's main faction.
            const wanted = e.faction || typeFaction;
            let faction = levelFactions.length && levelFactions.indexOf(wanted) === -1 ? levelFactions[0] : wanted;
            // Invaded planet (invasion-scenario.js): everyone here is the attacker.
            const invader = (typeof profileManager !== 'undefined' && profileManager.getActiveInvasion)
                ? profileManager.getActiveInvasion() : null;
            if (invader && invader.planetId === planetId) faction = invader.attacker;
            if (friendly(faction) && levelFactions.length) faction = levelFactions[0];
            const enemyClass = e.enemyClass || tax.enemyClass || 'assault';
            const tier = e.tier != null
                ? Math.max(1, Math.round(Number(e.tier)))
                : (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier
                    ? (factionShipStyles.classTier[enemyClass] || 2)
                    : Math.max(1, Math.round(e.level != null ? e.level : 1)));
            return {
                id: e.id || ('e' + (i + 1)),
                type: type,
                faction: faction,
                enemyClass: enemyClass,
                tier: tier,
                cluster: e.cluster || 'alpha',
                champion: !!e.champion,
                level: Math.max(1, Math.round(e.level != null ? e.level : (e.champion ? 2 : 1))),
                spawnAt: Math.max(0, Number(e.spawnAt != null ? e.spawnAt : 0)),
                role: e.role || null,
                combatEvents: Array.isArray(e.combatEvents) ? e.combatEvents.map((ev) => Object.assign({}, ev)) : [],
                spawned: false
            };
        });
        // Faction holdings: stations add ruler defenders; the ruler's base
        // planet adds its garrison and tougher hulls (faction-holdings.js).
        const hold = (typeof profileManager !== 'undefined' && profileManager.getPlanetHoldingInfo && planetId)
            ? profileManager.getPlanetHoldingInfo(planetId) : null;
        if (hold && hold.defenders > 0 && !friendly(hold.ruler)) {
            const template = this.schedule.find((e) => !e.champion);
            if (template) {
                for (let i = 0; i < hold.defenders; i++) {
                    this.schedule.push(Object.assign({}, template, {
                        id: 'holding_def_' + i,
                        faction: hold.ruler,
                        role: 'assault',
                        combatEvents: [],
                        spawnAt: template.spawnAt + 1500 * (i + 1),
                        spawned: false
                    }));
                }
            }
        }
        if (hold && hold.isBase && !friendly(hold.ruler)) {
            this.levelMods.enemyHealth = Math.round((Number(this.levelMods.enemyHealth) || 100) * 1.35);
        }
        this.scheduleElapsedMs = 0;
        this.sideEnemies = [];
        this.sideFleeing = false;
        this.activeCombatEvents = [];
        this.firedCombatEventIds = {};
        this.combatEventCooldowns = {};
        this.pendingCombatAnnounces = {};
        this.championCombatElapsedMs = 0;
        this.sideDebuffs = { jammer: false, tether: false };
        this.sideEnemyPool = this.schedule.filter(e => !e.champion).map(e => ({
            type: e.type,
            faction: e.faction,
            weight: 1,
            chance: 0.2,
            role: e.role || 'assault'
        }));
        if (typeof difficultyConfigManager !== 'undefined') {
            const profile = difficultyConfigManager.getProfile();
            this.sideEnemyCap = Math.max(1, Math.min(3,
                Math.round(profile.enemyMaxActive * profile.enemyCountMul)));
            if (profile.enemyCountMul < 1) {
                const normalEntries = this.schedule.filter(e => !e.champion);
                normalEntries.slice(Math.max(1, Math.ceil(normalEntries.length * profile.enemyCountMul)))
                    .forEach(e => { e.spawnAt = Math.max(e.spawnAt, 999999); });
            }
        }
        // Every run differs from the authored schedule (see wave-director.js).
        if (this.varyRun) this.varyRun();
    }

    setSideEnemyPool(pool) {
        this.sideEnemyPool = Array.isArray(pool) ? pool.map(e => ({
            type: e.type,
            weight: e.weight != null ? e.weight : 1,
            chance: e.chance != null ? e.chance : 0.15,
            role: e.role || 'assault'
        })) : [];
    }

    getSideEnemyPool() {
        return this.sideEnemyPool;
    }

    getSideEnemies() {
        return this.sideEnemies;
    }

    getSchedule() {
        return this.schedule;
    }

    championScale(level) {
        const lvl = Math.max(1, level || 1);
        return 1 + 0.25 * (lvl - 1);
    }

    pickSideEnemyType() {
        if (!this.sideEnemyPool.length) return null;
        const eligible = this.sideEnemyPool.filter(e => Math.random() < (e.chance != null ? e.chance : 0.15));
        const pool = eligible.length ? eligible : this.sideEnemyPool;
        const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
        let r = Math.random() * total;
        for (const e of pool) {
            r -= (e.weight || 1);
            if (r <= 0) return e.type;
        }
        return pool[0].type;
    }

    shouldEscortChampion(entry) {
        const cluster = (entry && entry.cluster) || 'alpha';
        if (this.enemy && !this.exploding && (this.enemy.cluster || 'alpha') === cluster) {
            return true;
        }
        if (this.pendingChampionEntry && (this.pendingChampionEntry.cluster || 'alpha') === cluster) {
            return true;
        }
        return this.schedule.some((e) => e.champion && (e.cluster || 'alpha') === cluster);
    }

    nextEscortSlot() {
        const used = {};
        this.sideEnemies.forEach((e) => {
            if (e.isEscort && e.escortSlot != null) used[e.escortSlot] = true;
        });
        for (let i = 0; i < 6; i++) {
            if (!used[i]) return i;
        }
        return this.sideEnemies.filter((e) => e.isEscort).length;
    }

    escortFormationOffset(slot) {
        const shaped = this.formationOffset ? this.formationOffset(slot) : null;
        if (shaped) return shaped;
        const i = slot | 0;
        const preferredSide = (i % 2 === 0) ? -1 : 1;
        const side = Math.random() < 0.72 ? preferredSide : -preferredSide;
        const rank = Math.floor(i / 2);
        // Keep escorts clearly separated from the champion and from each
        // other; the rendered ship sprites are larger than their hitboxes.
        const distX = 30 + rank * 22 + Math.random() * 20;
        const distY = 24 + rank * 18 + Math.random() * 18;
        const ySign = Math.random() < 0.5 ? -1 : 1;
        return {
            x: side * distX,
            y: ySign * distY
        };
    }
}
