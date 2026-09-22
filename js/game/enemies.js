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
        this.sideEnemyCap = 5;
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
                const planetFactions = planetConfigManager.getPlanetFactions(planetId);
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
        this.schedule = allowed.map((e, i) => {
            const type = e.type || 'enemyBasic';
            let tax = { faction: 'pirate', enemyClass: 'assault' };
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
                tax = planetConfigManager.taxonomyForType(type) || tax;
            } else if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
                tax.faction = enemyConfigManager.getDefaultFaction(type);
            }
            const faction = e.faction || tax.faction || 'pirate';
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
            weight: 1,
            chance: 0.2,
            role: e.role || 'assault'
        }));
        if (typeof difficultyConfigManager !== 'undefined') {
            const profile = difficultyConfigManager.getProfile();
            this.sideEnemyCap = Math.max(1, Math.round(profile.enemyMaxActive * profile.enemyCountMul));
            if (profile.enemyCountMul < 1) {
                const normalEntries = this.schedule.filter(e => !e.champion);
                normalEntries.slice(Math.max(1, Math.ceil(normalEntries.length * profile.enemyCountMul)))
                    .forEach(e => { e.spawnAt = Math.max(e.spawnAt, 999999); });
            }
        }
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
        const i = slot | 0;
        const preferredSide = (i % 2 === 0) ? -1 : 1;
        const side = Math.random() < 0.72 ? preferredSide : -preferredSide;
        const rank = Math.floor(i / 2);
        const distX = 14 + rank * 10 + Math.random() * 24;
        const distY = 6 + rank * 8 + Math.random() * 22;
        const ySign = Math.random() < 0.5 ? -1 : 1;
        return {
            x: side * distX,
            y: ySign * distY
        };
    }

    /**
     * Match renderEnemyShip footprint: faction visual size × drawScale × tier scaleMul,
     * then tighten AABB + attach sprite mask for pixel-accurate hits.
     */
    resolveEnemyHitProfile(opts) {
        const o = opts || {};
        const drawScale = o.drawScale != null ? o.drawScale : 1;
        let model = null;
        let scaleMul = 1;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: o.faction,
                enemyClass: o.enemyClass,
                tier: o.tier,
                level: o.level,
                typeId: o.type || o.typeId,
                width: o.width,
                height: o.height
            });
            if (visual && visual.model) {
                model = visual.model;
                scaleMul = visual.scaleMul != null ? visual.scaleMul : 1;
            }
        }
        if (!model && typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getMergedModel && o.type) {
            model = enemyConfigManager.getMergedModel(o.type);
        }
        if (!model && typeof graphicsManager !== 'undefined') {
            model = graphicsManager.currentEnemyModel;
        }
        if (!model) {
            return {
                width: Math.max(6, Math.round(16 * drawScale)),
                height: Math.max(6, Math.round(12 * drawScale)),
                sprite: null,
                colors: null,
                collision: null
            };
        }
        const fullScale = drawScale * scaleMul;
        const drawW = Math.max(4, (model.width || 16) * fullScale);
        const drawH = Math.max(4, (model.height || 12) * fullScale);
        const sprite = model.sprite || null;
        const colors = model.colors || null;
        let insetL = 0;
        let insetT = 0;
        let insetR = 0;
        let insetB = 0;
        if (sprite && sprite.length && sprite[0] && sprite[0].length) {
            const rows = sprite.length;
            const cols = sprite[0].length;
            let minC = cols;
            let maxC = -1;
            let minR = rows;
            let maxR = -1;
            for (let r = 0; r < rows; r++) {
                const row = sprite[r];
                if (!row) continue;
                for (let c = 0; c < cols; c++) {
                    if (!row[c]) continue;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                }
            }
            if (maxC >= minC && maxR >= minR) {
                const pw = drawW / cols;
                const ph = drawH / rows;
                insetL = minC * pw;
                insetT = minR * ph;
                insetR = (cols - 1 - maxC) * pw;
                insetB = (rows - 1 - maxR) * ph;
            }
        }
        return {
            width: Math.max(4, Math.round(drawW)),
            height: Math.max(4, Math.round(drawH)),
            sprite: sprite,
            colors: colors,
            collision: {
                sprite: sprite,
                colors: colors,
                drawW: drawW,
                drawH: drawH,
                insetL: insetL,
                insetT: insetT,
                insetR: insetR,
                insetB: insetB
            }
        };
    }

    applyEnemyHitProfile(entity, opts) {
        if (!entity) return entity;
        const profile = this.resolveEnemyHitProfile(opts);
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(3, Number(game.contentScale) || 1))
            : 1;
        entity.width = Math.max(4, Math.round(profile.width * contentScale));
        entity.height = Math.max(4, Math.round(profile.height * contentScale));
        entity.sprite = profile.sprite;
        entity.colors = profile.colors;
        entity.collision = profile.collision;
        return entity;
    }

    roleForcesEscort(role) {
        return role === 'repair' || role === 'shieldBattery' || role === 'blocker'
            || role === 'gunner' || role === 'jammer' || role === 'tether';
    }

    resolveCombatEventsForEntry(entry) {
        if (entry && Array.isArray(entry.combatEvents) && entry.combatEvents.length) {
            return entry.combatEvents.map((ev) => Object.assign({}, ev));
        }
        const type = (entry && entry.type) || this.currentShipType;
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getConfig) {
            const cfg = enemyConfigManager.getConfig(type);
            if (cfg && Array.isArray(cfg.combatEvents) && cfg.combatEvents.length) {
                return cfg.combatEvents.map((ev) => Object.assign({}, ev));
            }
        }
        return [];
    }

    beginChampionCombatEvents(entry) {
        this.activeCombatEvents = this.resolveCombatEventsForEntry(entry);
        this.firedCombatEventIds = {};
        this.combatEventCooldowns = {};
        this.pendingCombatAnnounces = {};
        this.championCombatElapsedMs = 0;
    }

    getRuntimeGameState(gameState) {
        if (gameState && gameState.width) return gameState;
        return {
            width: (typeof game !== 'undefined' && (game.internalWidth || game.width)) || 200,
            height: (typeof game !== 'undefined' && (game.internalHeight || game.height)) || 300,
            cheats: (typeof game !== 'undefined' && game.cheats) || {}
        };
    }

    announceCombatEvent(ev) {
        if (!ev) return;
        const catalogId = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.catalogIdForSpec(ev)
            : (ev.role || 'assault');
        const text = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.getAnnounceText(ev)
            : ('INCOMING: ' + String(ev.role || ev.id || 'EVENT').toUpperCase());
        const accent = (typeof combatEventConfigManager !== 'undefined')
            ? (combatEventConfigManager.getConfig(catalogId).accent || '#e8c060')
            : '#e8c060';
        const warnMs = (typeof combatEventConfigManager !== 'undefined')
            ? combatEventConfigManager.getAnnounceMs(ev)
            : 1800;
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showEventAnnounce) {
            levelInfoManager.showEventAnnounce(text, { accent: accent, holdMs: warnMs + 400 });
        }
        if (typeof profileManager !== 'undefined' && profileManager.discover) {
            profileManager.discover('events', catalogId);
        }
        if (typeof soundManager !== 'undefined' && soundManager.playExplosion) {
            // Soft cue — reuse existing SFX without new assets
            try { soundManager.playShoot && soundManager.playShoot(); } catch (e) { /* ignore */ }
        }
        return warnMs;
    }

    evaluateCombatEvents(gameState) {
        if (!this.enemy || this.exploding || !this.activeCombatEvents.length) return;
        const state = this.getRuntimeGameState(gameState);
        const hpFrac = this.maxHealth > 0 ? (this.health / this.maxHealth) : 1;
        const shieldFrac = this.shieldMax > 0 ? (this.shield / this.shieldMax) : 1;
        const elapsedSec = this.championCombatElapsedMs / 1000;
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        // Resolve announced events whose warn window elapsed
        const pendingIds = Object.keys(this.pendingCombatAnnounces || {});
        for (let p = 0; p < pendingIds.length; p++) {
            const pid = pendingIds[p];
            const pending = this.pendingCombatAnnounces[pid];
            if (!pending || now < pending.fireAt) continue;
            const ev = pending.ev;
            delete this.pendingCombatAnnounces[pid];
            if (!ev) continue;
            if (ev.once && this.firedCombatEventIds[ev.id]) continue;
            if (ev.action === 'summon') {
                this.spawnEventSide(ev, state);
            }
            this.firedCombatEventIds[ev.id] = true;
            this.combatEventCooldowns[ev.id] = now;
            if (!ev.once) {
                delete this.firedCombatEventIds[ev.id];
            }
        }

        for (let i = 0; i < this.activeCombatEvents.length; i++) {
            const ev = this.activeCombatEvents[i];
            if (!ev || !ev.id) continue;
            if (ev.once && this.firedCombatEventIds[ev.id]) continue;
            if (this.pendingCombatAnnounces[ev.id]) continue;
            if (ev.cooldownMs > 0 && this.combatEventCooldowns[ev.id]
                && (now - this.combatEventCooldowns[ev.id]) < ev.cooldownMs) {
                continue;
            }

            let fire = false;
            if (ev.trigger === 'hpBelow') {
                fire = hpFrac <= (ev.threshold != null ? ev.threshold : 0.35) && this.health > 0;
            } else if (ev.trigger === 'shieldBelow') {
                fire = this.shieldMax > 0
                    && shieldFrac <= (ev.threshold != null ? ev.threshold : 0.35);
            } else if (ev.trigger === 'elapsed') {
                fire = elapsedSec >= (ev.elapsedSec != null ? ev.elapsedSec : 0);
            }
            if (!fire) continue;

            const warnMs = this.announceCombatEvent(ev);
            this.pendingCombatAnnounces[ev.id] = {
                ev: ev,
                fireAt: now + (warnMs != null ? warnMs : 1800)
            };
        }
    }

    spawnEventSide(spec, gameState) {
        if (!spec || !gameState) return;
        const cluster = (this.enemy && this.enemy.cluster)
            || (this.pendingChampionEntry && this.pendingChampionEntry.cluster)
            || 'alpha';
        const role = spec.role || 'assault';
        const want = Math.max(1, Math.round(Number(spec.count) || 1));
        const type = spec.type || 'enemyBasic';
        let tax = { faction: 'pirate', enemyClass: 'assault' };
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            tax = planetConfigManager.taxonomyForType(type) || tax;
        }
        const faction = (this.enemy && this.enemy.faction)
            || (this.pendingChampionEntry && this.pendingChampionEntry.faction)
            || tax.faction
            || 'pirate';
        const enemyClass = tax.enemyClass || 'assault';
        const tier = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
            ? (factionShipStyles.classTier[enemyClass] || 2)
            : 1;
        let spawned = 0;
        for (let n = 0; n < want; n++) {
            if (this.sideEnemies.length >= this.sideEnemyCap) break;
            const side = this.spawnScheduledNormal({
                id: 'evt_' + (spec.id || 'summon') + '_' + Date.now() + '_' + n,
                type: type,
                faction: faction,
                enemyClass: enemyClass,
                tier: tier,
                level: 1,
                champion: false,
                cluster: role === 'bomber' ? ('flyby_' + Math.floor(Math.random() * 9999)) : cluster,
                role: role,
                forceEscort: this.roleForcesEscort(role)
            }, gameState);
            if (side) spawned += 1;
        }
        return spawned;
    }

    spawnScheduledNormal(entry, gameState) {
        if (!entry || !gameState) return null;
        if (this.sideEnemies.length >= this.sideEnemyCap) return null;
        const canvasWidth = gameState.width || 200;
        const canvasHeight = gameState.height || 300;
        const scale = this.championScale(entry.level);
        let baseHp = 40;
        if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(entry.type);
            if (cfg && cfg.maxHealth) baseHp = Math.max(15, Math.round(cfg.maxHealth * 0.4));
        }
        const role = entry.role || 'assault';
        if (role === 'repair' || role === 'shieldBattery') {
            baseHp = Math.max(12, Math.round(baseHp * 0.55));
        } else if (role === 'blocker') {
            baseHp = Math.round(baseHp * 2.2);
        } else if (role === 'bomber') {
            baseHp = Math.max(10, Math.round(baseHp * 0.7));
        }
        const SIDE_DRAW_SCALE = 0.7;
        const forceEscort = !!entry.forceEscort || this.roleForcesEscort(role);
        const isEscort = forceEscort || this.shouldEscortChampion(entry);
        const escortSlot = isEscort ? this.nextEscortSlot() : -1;
        let form = isEscort ? this.escortFormationOffset(escortSlot) : null;
        if (isEscort && role === 'blocker' && form) {
            form = {
                x: form.x * (0.45 + Math.random() * 0.35),
                y: form.y + 10 + Math.random() * 16
            };
        }
        const levelMul = 1 + 0.1 * ((entry.level || 1) - 1);
        const side = {
            x: canvasWidth + 20,
            y: 40 + Math.random() * Math.max(40, canvasHeight - 80),
            width: 12,
            height: 10,
            speed: isEscort
                ? 0
                : (-0.35 - Math.random() * 0.25) * levelMul,
            verticalSpeed: isEscort ? 0 : (Math.random() - 0.5) * 0.25,
            health: Math.round(baseHp * scale),
            maxHealth: Math.round(baseHp * scale),
            armor: 0,
            shield: 0,
            shieldMax: 0,
            shieldRegen: 0,
            damageReduction: 0,
            reflectChance: 0,
            defenseMechanisms: [],
            type: entry.type,
            faction: entry.faction || 'pirate',
            enemyClass: entry.enemyClass || 'assault',
            tier: entry.tier != null ? entry.tier : (entry.level || 1),
            cluster: entry.cluster || 'alpha',
            entryId: entry.id,
            level: entry.level,
            champion: false,
            isSideEnemy: true,
            role: role,
            isEscort: isEscort,
            escortSlot: escortSlot,
            formOffsetX: form ? form.x : 0,
            formOffsetY: form ? form.y : 0,
            lifetimeMs: isEscort ? 0 : 18000 + Math.random() * 8000,
            shootTimer: 0,
            shootInterval: role === 'gunner' ? 1400
                : (role === 'assault' || role === 'blocker' ? 1900 : 0),
            repairRate: role === 'repair' ? 6 : 0,
            shieldBatteryRate: role === 'shieldBattery' ? 8 : 0,
            repairRange: 70,
            repairBeamActive: false,
            bomberDamage: role === 'bomber' ? 18 : 0,
            bomberSpeed: role === 'bomber' ? 1.35 : 0
        };
        this.applyEnemyHitProfile(side, {
            faction: side.faction,
            enemyClass: side.enemyClass,
            tier: side.tier,
            level: side.level,
            type: side.type,
            drawScale: SIDE_DRAW_SCALE
        });
        if (isEscort && this.enemy && form) {
            side.x = this.enemy.x + this.enemy.width * 0.5 + form.x - side.width * 0.5;
            side.y = Math.max(10, Math.min(canvasHeight - side.height - 10,
                this.enemy.y + this.enemy.height * 0.5 + form.y - side.height * 0.5));
        } else if (!isEscort) {
            side.y = 40 + Math.random() * Math.max(40, canvasHeight - 80 - side.height);
        }
        if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(entry.type);
            if (cfg) {
                const ai = (typeof difficultyConfigManager !== 'undefined')
                    ? difficultyConfigManager.resolveEnemy(entry.faction, entry.tier, cfg) : null;
                side.armor = cfg.armor || 0;
                side.shieldMax = Math.round((cfg.shieldMax || 0) * 0.4 * scale);
                side.shield = side.shieldMax;
                side.shieldRegen = (cfg.shieldRegen || 0) * 0.4;
                side.damageReduction = cfg.damageReduction || 0;
                side.reflectChance = cfg.reflectChance || 0;
                side.damageMul = ai ? ai.damageMul : 1;
                side.evasionChance = ai ? ai.evasionChance : 1;
                side.predictionSkill = ai ? ai.predictionSkill : 0;
                side.defenseMechanisms = (cfg.abilities || cfg.defenseMechanisms || []).slice();
                side.abilities = side.defenseMechanisms.slice();
                if (role === 'gunner' && cfg.shootInterval) {
                    side.shootInterval = Math.max(800, Math.round(cfg.shootInterval * 1.2));
                }
            }
        }
        this.sideEnemies.push(side);
        if (typeof profileManager !== 'undefined' && profileManager.discoverEnemyContents && entry.type) {
            profileManager.discoverEnemyContents(entry.type);
        }
        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.onEnemySpawned(entry);
        }
        return side;
    }

    spawnSideEnemy(gameState) {
        const type = this.pickSideEnemyType();
        if (!type || !gameState) return null;
        const cluster = (this.enemy && this.enemy.cluster) || 'alpha';
        const escort = !!(this.enemy && !this.exploding && Math.random() < 0.55);
        let tax = { faction: 'pirate', enemyClass: 'assault' };
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            tax = planetConfigManager.taxonomyForType(type) || tax;
        } else if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
            tax.faction = enemyConfigManager.getDefaultFaction(type);
        }
        const enemyClass = tax.enemyClass || 'assault';
        const tier = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
            ? (factionShipStyles.classTier[enemyClass] || 2)
            : 1;
        return this.spawnScheduledNormal({
            id: 'legacy_' + Date.now(),
            type: type,
            faction: tax.faction || 'pirate',
            enemyClass: enemyClass,
            tier: tier,
            level: 1,
            champion: false,
            cluster: escort ? cluster : ('flyby_' + Math.floor(Math.random() * 9999)),
            role: this.sideEnemyPool.find(e => e.type === type)?.role || 'assault',
            forceEscort: escort
        }, gameState);
    }

    updateSchedule(deltaTime, gameState) {
        if (this.spawnFrozen) return;
        if (!this.schedule.length) return;
        this.scheduleElapsedMs += deltaTime;
        const elapsedSec = this.scheduleElapsedMs / 1000;
        const holdNormals = this.sideFleeing || this.exploding
            || (typeof objectiveManager !== 'undefined' && objectiveManager.awaitingFieldClear);

        // Cluster wave times: earliest spawnAt per cluster
        const clusterWaveAt = {};
        this.schedule.forEach(e => {
            const c = e.cluster || 'alpha';
            if (clusterWaveAt[c] == null || e.spawnAt < clusterWaveAt[c]) {
                clusterWaveAt[c] = e.spawnAt;
            }
        });

        for (const entry of this.schedule) {
            if (entry.spawned) continue;
            const waveAt = clusterWaveAt[entry.cluster || 'alpha'];
            const dueAt = Math.min(entry.spawnAt, waveAt != null ? waveAt : entry.spawnAt);
            if (elapsedSec < dueAt) continue;
            if (entry.champion && (this.enemy || this.exploding)) {
                continue;
            }
            if (!entry.champion && holdNormals) {
                continue;
            }
            entry.spawned = true;
            if (entry.champion) {
                this.spawnChampionFromEntry(entry);
            } else {
                this.spawnScheduledNormal(entry, gameState);
            }
        }
    }

    async spawnChampionFromEntry(entry) {
        this.pendingChampionEntry = entry;
        this.beginChampionCombatEvents(entry);
        await this.setShipType(entry.type);
        if (typeof graphicsManager !== 'undefined' && graphicsManager.setEnemyShipType) {
            graphicsManager.setEnemyShipType(entry.type);
        }
        this.spawnEnemy(entry);
        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.onEnemySpawned(entry);
        }
    }

    updateSideEnemies(deltaTime, gameState) {
        if (!gameState) return;
        const canSpawnSides = !this.sideFleeing && !this.spawnFrozen
            && !!(this.enemy && !this.exploding);
        if (canSpawnSides && !this.schedule.length && this.sideEnemyPool.length) {
            this.sideEnemySpawnTimer += deltaTime;
            if (this.sideEnemySpawnTimer >= this.sideEnemySpawnInterval) {
                this.sideEnemySpawnTimer = 0;
                if (this.sideEnemies.length < this.sideEnemyCap && Math.random() < 0.45) {
                    this.spawnSideEnemy(gameState);
                }
            }
        }
        const canvasWidth = gameState.width || 200;
        const canvasHeight = gameState.height || 300;
        let speedMul = (deltaTime || 16.67) / 16.67;
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
            speedMul *= beatSyncManager.getEnemySpeedMul();
        }
        const bobY = (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive())
            ? beatSyncManager.getEnemyBobOffset()
            : 0;
        const mainAlive = this.enemy && !this.exploding;
        if (!mainAlive && !this.sideFleeing && this.sideEnemies.length) {
            this.beginSideEnemyFlee(gameState);
        }
        const pendingCluster = this.pendingChampionEntry
            ? (this.pendingChampionEntry.cluster || 'alpha')
            : null;
        let hasJammer = false;
        let hasTether = false;

        for (let i = this.sideEnemies.length - 1; i >= 0; i--) {
            const e = this.sideEnemies[i];
            const eCluster = e.cluster || 'alpha';
            const teamWithMain = mainAlive && eCluster === (this.enemy.cluster || 'alpha');
            const teamPending = !!pendingCluster && eCluster === pendingCluster;
            const role = e.role || 'assault';
            e.repairBeamActive = false;

            if (e.fleeing) {
                e.x += (e.speed || 0) * speedMul;
                e.y += (e.verticalSpeed || -1) * speedMul;
            } else if (role === 'bomber' && typeof playerManager !== 'undefined') {
                const player = playerManager.getPosition();
                if (player) {
                    const tx = player.x + player.width / 2;
                    const ty = player.y + player.height / 2;
                    const cx = e.x + e.width / 2;
                    const cy = e.y + e.height / 2;
                    const dx = tx - cx;
                    const dy = ty - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const spd = (e.bomberSpeed || 1.2) * speedMul;
                    e.isEscort = false;
                    e.x += (dx / dist) * spd;
                    e.y += (dy / dist) * spd;
                    e.speed = 0;
                    e.verticalSpeed = 0;
                }
            } else if (e.isEscort && (teamWithMain || teamPending)) {
                if (mainAlive) {
                    const tx = this.enemy.x + this.enemy.width * 0.5
                        + (e.formOffsetX || 0) - e.width * 0.5;
                    const ty = Math.max(8, Math.min(canvasHeight - e.height - 8,
                        this.enemy.y + this.enemy.height * 0.5
                        + (e.formOffsetY || 0) - e.height * 0.5));
                    const follow = Math.min(1, 0.08 * speedMul);
                    e.x += (tx - e.x) * follow;
                    e.y += (ty - e.y) * follow;
                } else {
                    const tx = canvasWidth * 0.55 + (e.formOffsetX || 0) - e.width * 0.5;
                    const ty = 40 + (e.formOffsetY || 0);
                    const follow = Math.min(1, 0.04 * speedMul);
                    e.x += (tx - e.x) * follow;
                    e.y += (ty - e.y) * follow;
                }
                e.speed = 0;
                e.verticalSpeed = 0;
            } else {
                if (e.isEscort) {
                    e.isEscort = false;
                    if (!e.speed) e.speed = (-0.3 - Math.random() * 0.2);
                    if (!e.verticalSpeed) e.verticalSpeed = (Math.random() - 0.5) * 0.2;
                    if (!e.lifetimeMs) e.lifetimeMs = 12000 + Math.random() * 6000;
                }
                e.x += e.speed * speedMul;
                e.y += e.verticalSpeed * speedMul;
                if (bobY) e.y += bobY * 0.12;
                if (e.y < 10 || e.y > canvasHeight - 10) e.verticalSpeed *= -1;
                if (e.x > canvasWidth - 8 && e.speed > 0) e.speed = -Math.abs(e.speed);
                if (e.x < 8 && e.speed < 0 && e.lifetimeMs > 4000) {
                    e.speed = Math.abs(e.speed) * 0.85;
                }
                if (e.lifetimeMs != null) {
                    e.lifetimeMs -= deltaTime;
                    if (e.lifetimeMs <= 0) {
                        e.speed = -Math.max(0.45, Math.abs(e.speed));
                    }
                }
            }

            if (mainAlive && !e.fleeing && (role === 'repair' || role === 'shieldBattery')) {
                const dx = (e.x + e.width / 2) - (this.enemy.x + this.enemy.width / 2);
                const dy = (e.y + e.height / 2) - (this.enemy.y + this.enemy.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const range = e.repairRange || 70;
                if (dist <= range) {
                    const dtSec = deltaTime / 1000;
                    if (role === 'repair' && this.health < this.maxHealth) {
                        const heal = Math.min(e.repairRate || 6, 10) * dtSec;
                        this.health = Math.min(this.maxHealth, this.health + heal);
                        e.repairBeamActive = true;
                    }
                    if (role === 'shieldBattery' && this.shieldMax > 0 && this.shield < this.shieldMax) {
                        const recharge = Math.min(e.shieldBatteryRate || 8, 12) * dtSec;
                        this.shield = Math.min(this.shieldMax, this.shield + recharge);
                        e.repairBeamActive = true;
                    }
                }
            }

            // Fire while fighting and while fleeing (even during champion explosion)
            if (role === 'gunner' || role === 'assault' || role === 'blocker') {
                e.shootTimer = (e.shootTimer || 0) + deltaTime;
                let interval = e.shootInterval || 1900;
                if (e.fleeing) interval = Math.max(900, interval * 0.75);
                if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
                    // Fire on downbeats when timer is ready enough
                    const beatMs = beatSyncManager.beatDurationMs();
                    interval = Math.max(beatMs * 2, interval * 0.85);
                    if (e.shootTimer >= interval * 0.7 && beatSyncManager.justDownbeat) {
                        e.shootTimer = interval;
                    }
                }
                if (e.shootTimer >= interval) {
                    e.shootTimer = 0;
                    if (typeof bulletManager !== 'undefined' && bulletManager.enemyShoot) {
                        bulletManager.enemyShoot(e);
                    }
                }
            }

            if (!e.fleeing && role === 'jammer') hasJammer = true;
            if (!e.fleeing && role === 'tether') hasTether = true;

            if (e.shieldMax > 0 && e.shield < e.shieldMax && e.shieldRegen > 0) {
                const mechs = e.abilities || e.defenseMechanisms || [];
                const canRegen = !mechs.length || mechs.indexOf('shield_regen') !== -1
                    || e.shieldRegen > 0;
                if (canRegen) {
                    e.shield = Math.min(e.shieldMax, e.shield + e.shieldRegen * (deltaTime / 1000));
                }
            }
            const offScreen = e.x < -50 || e.x > canvasWidth + 50
                || e.y < -50 || e.y > canvasHeight + 50;
            if (e.fleeing && offScreen) {
                this.sideEnemies.splice(i, 1);
            } else if (!e.isEscort && role !== 'bomber' && e.x < -40) {
                this.sideEnemies.splice(i, 1);
            } else if (role === 'bomber' && offScreen) {
                this.sideEnemies.splice(i, 1);
            }
        }

        this.sideDebuffs.jammer = hasJammer;
        this.sideDebuffs.tether = hasTether;
        if (this.sideFleeing && (!this.sideEnemies || !this.sideEnemies.length)
            && !this.exploding && !this.enemy) {
            this.sideFleeing = false;
        }
    }

    hasJammerDebuff() {
        return !!(this.sideDebuffs && this.sideDebuffs.jammer);
    }

    hasTetherDebuff() {
        return !!(this.sideDebuffs && this.sideDebuffs.tether);
    }

    /** True when every scheduled foe is done and nothing is left alive. */
    isFieldClear() {
        if (this.enemy || this.exploding) return false;
        if (this.sideEnemies && this.sideEnemies.length > 0) return false;
        if (this.schedule && this.schedule.some((e) => !e.spawned)) return false;
        return true;
    }

    getJammerCooldownMul() {
        return this.hasJammerDebuff() ? 1.75 : 1;
    }

    getTetherSpeedMul() {
        return this.hasTetherDebuff() ? 0.55 : 1;
    }

    notifyKill(info) {
        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.onEnemyKilled(info);
        }
        const planetId = this.levelMods.planetId || 'mars';
        if (typeof dailyTracker !== 'undefined' && info) {
            dailyTracker.onEnemyKilled(planetId, info);
        }
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.stats) {
            levelInfoManager.stats.enemiesKilled = (levelInfoManager.stats.enemiesKilled || 0) + 1;
            if (levelInfoManager.updateElement) {
                levelInfoManager.updateElement('enemiesKilled', levelInfoManager.stats.enemiesKilled);
            }
        }
        if (typeof game !== 'undefined') {
            const points = info && info.champion ? 100 : 25;
            game.score = (game.score || 0) + points;
            if (typeof levelInfoManager !== 'undefined' && levelInfoManager.stats) {
                levelInfoManager.stats.score = game.score;
                if (levelInfoManager.updateElement) {
                    levelInfoManager.updateElement('currentScore', game.score);
                }
            }
        }
        if (typeof profileManager !== 'undefined' && profileManager.tryBlueprintDrop) {
            const dropped = profileManager.tryBlueprintDrop(info);
            if (dropped && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                const name = (typeof shipConfigManager !== 'undefined')
                    ? shipConfigManager.getDisplayName(dropped)
                    : String(dropped).toUpperCase();
                levelInfoManager.showLootNotice('BLUEPRINT: ' + name);
            }
        }
        if (typeof pickupManager !== 'undefined' && pickupManager.spawnFromKill) {
            let x = info && info.x;
            let y = info && info.y;
            if ((x == null || y == null) && this.enemy) {
                x = this.enemy.x + this.enemy.width / 2;
                y = this.enemy.y + this.enemy.height / 2;
            }
            pickupManager.spawnFromKill(Object.assign({}, info || {}, { x: x, y: y }));
        }
        if (typeof profileManager !== 'undefined' && profileManager.discoverEnemyContents && info) {
            const enemyType = info.type || null;
            if (enemyType) profileManager.discoverEnemyContents(enemyType);
        } else if (typeof profileManager !== 'undefined' && profileManager.discover && info) {
            const enemyType = info.type || null;
            if (enemyType) profileManager.discover('enemies', enemyType);
        }
    }

    // Set enemy ship type based on level
    async setShipType(type) {
        this.currentShipType = type;
        
        // Update graphics manager
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setEnemyShipType(type);
        }
        
        // Get ship model for weapon configuration
        this.currentEnemyModel = await this.getEnemyShipModel(type);
        
    }
    
    // Get enemy ship model for weapon configuration
    async getEnemyShipModel(type) {
        try {
            const { shipAssetLoader } = await import('../../assets/ships/ship-asset-loader.js');
            if (shipAssetLoader && shipAssetLoader.isLoaded()) {
                const hullId = (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getHullId)
                    ? enemyConfigManager.getHullId(type)
                    : type;
                let model = shipAssetLoader.getShip(hullId);
                if (typeof enemyConfigManager !== 'undefined' && model) {
                    model = enemyConfigManager.applyOverridesToModel(type, model);
                } else if (model) {
                    model = Object.assign({}, model, { forceEnemyOrientation: true });
                }
                return model;
            }
        } catch (error) {
            // ship asset loader unavailable
        }
        return null;
    }
    
    // Get current ship type
    getShipType() {
        return this.currentShipType;
    }
    
    // Set ship type based on level difficulty
    async setShipTypeByLevel(levelId) {
        let shipType = 'enemyBasic';
        
        switch(levelId) {
            case 1:
            case '1':
            case 'mars':
            case 'mars-1':
            case 'mars-2':
            case 'mars-3':
                shipType = 'enemyBasic';
                break;
            case 'mars-boss':
                shipType = 'enemyBoss';
                break;
            case 2:
            case '2':
            case 'jupiter':
            case 'jupiter-1':
            case 'jupiter-2':
            case 'jupiter-3':
                shipType = 'enemyFast';
                break;
            case 'jupiter-boss':
                shipType = 'enemyBoss';
                break;
            case 3:
            case '3':
            case 'saturn':
            case 'saturn-1':
            case 'saturn-2':
            case 'saturn-3':
                shipType = 'enemyHeavy';
                break;
            case 'saturn-boss':
                shipType = 'enemyBoss';
                break;
            case 4:
            case '4':
            case 'neptune':
            case 'neptune-1':
            case 'neptune-2':
            case 'neptune-3':
                shipType = 'enemyHeavy';
                break;
            case 'neptune-boss':
                shipType = 'enemyBoss';
                break;
            case 5:
            case '5':
            case 'pluto':
            case 'pluto-1':
            case 'pluto-2':
            case 'pluto-3':
            case 'pluto-boss':
                shipType = 'enemyBoss';
                break;
            default:
                if (typeof levelId === 'string' && levelId.endsWith('-boss')) {
                    shipType = 'enemyBoss';
                } else {
                    shipType = 'enemyBasic';
                }
        }
        
        await this.setShipType(shipType);
    }

    async init() {
        let levelEnemyType = null;
        let level = null;
        if (typeof game !== 'undefined') {
            level = (game.coreLevelManager || game.levelManager)?.getCurrentLevel?.();
            if (level && level.enemyType) levelEnemyType = level.enemyType;
        } else if (typeof gameCore !== 'undefined') {
            level = (gameCore.coreLevelManager || gameCore.levelManager)?.getCurrentLevel?.();
            if (level && level.enemyType) levelEnemyType = level.enemyType;
        }

        if (level && Array.isArray(level.enemies) && level.enemies.length) {
            this.setEnemySchedule(level.enemies, {
                enemySpeed: level.enemySpeed,
                enemyHealth: level.enemyHealth,
                isBoss: level.isBoss,
                planetId: level.planetId || 'mars'
            });
            if (typeof objectiveManager !== 'undefined') {
                objectiveManager.start(level.objective, level.enemies);
            }
        }
        if (!this.schedule.length) {
            const type = levelEnemyType || this.currentShipType || 'enemyBasic';
            this.setEnemySchedule([{
                id: 'main',
                type: type,
                champion: true,
                level: 2,
                spawnAt: 0
            }], {
                enemySpeed: level && level.enemySpeed,
                enemyHealth: level && level.enemyHealth,
                isBoss: level && level.isBoss,
                planetId: (level && level.planetId) || 'mars'
            });
            if (typeof objectiveManager !== 'undefined') {
                objectiveManager.start({ type: 'hunt', targetEnemyId: 'main' }, this.schedule);
            }
        }

        if (levelEnemyType) {
            await this.setShipType(levelEnemyType);
        } else if (!this.currentEnemyModel) {
            await this.setShipType(this.currentShipType);
        }

        if (typeof graphicsManager !== 'undefined' && !graphicsManager.currentEnemyModel) {
            graphicsManager.setEnemyShipType(this.currentShipType);
        }

        this.enemy = null;
        this.scheduleElapsedMs = 0;
        if (!this.spawnFrozen) {
            const fakeState = {
                width: (typeof game !== 'undefined' && (game.internalWidth || game.width)) || 200,
                height: (typeof game !== 'undefined' && (game.internalHeight || game.height)) || 300
            };
            this.updateSchedule(0, fakeState);
        }
    }

    update(deltaTime, gameState) {
        this.updateSchedule(deltaTime, gameState);
        this.updateSideEnemies(deltaTime, gameState);

        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.update(deltaTime);
        }

        if (!this.enemy) return;

        if (!this.exploding) {
            this.championCombatElapsedMs += deltaTime;
            this.evaluateCombatEvents(gameState);
        }
        
        // Apply slow motion cheat
        let effectiveDeltaTime = deltaTime;
        if (gameState && gameState.cheats && gameState.cheats.slowMotion) {
            effectiveDeltaTime = deltaTime * 0.3; // Slow down to 30% speed
        }

        if (!this.exploding && this.shieldMax > 0 && this.shield < this.shieldMax && this.shieldRegen > 0) {
            const hasRegen = !this.defenseMechanisms.length
                || this.defenseMechanisms.indexOf('shield_regen') !== -1
                || this.shieldRegen > 0;
            if (hasRegen) {
                this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * (effectiveDeltaTime / 1000));
            }
        }
        
        // Update explosion if enemy is exploding
        if (this.exploding) {
            const explosionFinished = this.updateExplosion(effectiveDeltaTime);
            if (explosionFinished) {
                const entry = this.pendingChampionEntry || (this.enemy && {
                    id: this.enemy.entryId,
                    type: this.currentShipType,
                    champion: true
                });
                this.notifyKill({
                    type: (entry && entry.type) || this.currentShipType,
                    entryId: (entry && entry.id) || (this.enemy && this.enemy.entryId),
                    faction: (entry && entry.faction) || (this.enemy && this.enemy.faction),
                    enemyClass: (entry && entry.enemyClass) || (this.enemy && this.enemy.enemyClass),
                    cluster: (entry && entry.cluster) || (this.enemy && this.enemy.cluster),
                    champion: true,
                    x: this.enemy ? this.enemy.x + this.enemy.width / 2 : undefined,
                    y: this.enemy ? this.enemy.y + this.enemy.height / 2 : undefined
                });
                this.enemy = null;
                this.pendingChampionEntry = null;
                this.activeCombatEvents = [];
                this.pendingCombatAnnounces = {};
                this.sideDebuffs = { jammer: false, tether: false };
            }
            return; // Don't update enemy movement during explosion
        }
        
        // Update enemy position (move left/right and up/down)
        // Calculate frame-rate independent speed multiplier
        let speedMultiplier = effectiveDeltaTime / 16.67; // 16.67ms = 60 FPS baseline
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
            speedMultiplier *= beatSyncManager.getEnemySpeedMul();
            this.enemy.y += beatSyncManager.getEnemyBobOffset() * 0.15;
        }
        this.enemy.x += this.enemy.speed * speedMultiplier;
        this.enemy.y += this.enemy.verticalSpeed * speedMultiplier;
        
        // Get current canvas dimensions with multiple fallbacks
        const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
        const canvasHeight = game?.internalHeight || game?.baseHeight || game?.height || 300;
        
        // Bounce off walls horizontally with safety margins
        if (this.enemy.x <= 0) {
            this.enemy.x = 0;
            this.enemy.speed = Math.abs(this.enemy.speed); // Force positive speed
        } else if (this.enemy.x >= canvasWidth - this.enemy.width) {
            this.enemy.x = canvasWidth - this.enemy.width;
            this.enemy.speed = -Math.abs(this.enemy.speed); // Force negative speed
        }
        
        // Bounce off vertical boundaries (1/3 of screen) with safety margins
        if (this.enemy.y <= this.enemy.minY) {
            this.enemy.y = this.enemy.minY;
            this.enemy.verticalSpeed = Math.abs(this.enemy.verticalSpeed); // Force positive speed
        } else if (this.enemy.y >= this.enemy.maxY) {
            this.enemy.y = this.enemy.maxY;
            this.enemy.verticalSpeed = -Math.abs(this.enemy.verticalSpeed); // Force negative speed
        }
        
        // Enemy evasion behavior
        this.updateEvasion(deltaTime, game);
        
        // Enemy shooting - use model-specific shooting interval (only if not exploding)
        if (!this.exploding) {
            let shootChance = 0.002; // Reduced default 0.2% chance per frame
            if (this.currentEnemyModel && this.currentEnemyModel.shootInterval) {
                // Convert shootInterval (ms) to chance per frame (60 FPS) with reduced rate
                shootChance = (60 / this.currentEnemyModel.shootInterval) * 0.4; // 40% of original rate
            }
            if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
                if (beatSyncManager.justDownbeat) shootChance = Math.max(shootChance, 0.65);
                else if (beatSyncManager.justBeat && beatSyncManager.barBeat === 2) {
                    shootChance = Math.max(shootChance, 0.35);
                } else {
                    shootChance *= 0.25;
                }
            }
            
            if (Math.random() < shootChance) {
                bulletManager.enemyShoot(this.enemy);
            }
        }
        
        // Final safety check - force enemy back into bounds if it somehow escaped
        const finalCanvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
        if (this.enemy.x < 0) {
            console.warn('Enemy escaped left boundary, forcing back');
            this.enemy.x = 0;
            this.enemy.speed = Math.abs(this.enemy.speed);
        }
        if (this.enemy.x > finalCanvasWidth - this.enemy.width) {
            console.warn('Enemy escaped right boundary, forcing back');
            this.enemy.x = finalCanvasWidth - this.enemy.width;
            this.enemy.speed = -Math.abs(this.enemy.speed);
        }
        if (this.enemy.y < this.enemy.minY) {
            console.warn('Enemy escaped top boundary, forcing back');
            this.enemy.y = this.enemy.minY;
            this.enemy.verticalSpeed = Math.abs(this.enemy.verticalSpeed);
        }
        if (this.enemy.y > this.enemy.maxY) {
            console.warn('Enemy escaped bottom boundary, forcing back');
            this.enemy.y = this.enemy.maxY;
            this.enemy.verticalSpeed = -Math.abs(this.enemy.verticalSpeed);
        }
    }

    spawnEnemy(entry) {
        const scheduleEntry = entry || this.pendingChampionEntry || null;
        if (!this.activeCombatEvents.length) {
            this.beginChampionCombatEvents(scheduleEntry);
        }
        const levelScale = this.championScale(scheduleEntry && scheduleEntry.level);

        let shipWidth = 20;
        let shipHeight = 16;

        let canvasWidth = 200;
        let canvasHeight = 300;
        if (typeof game !== 'undefined') {
            canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
            canvasHeight = game?.internalHeight || game?.baseHeight || game?.height || 300;
        }
        
        let enemySpeed = 0.4;
        let enemyVerticalSpeed = 0.25;
        let enemyMaxHealth = 100;
        
        if (typeof graphicsManager !== 'undefined' && graphicsManager.currentEnemyModel) {
            const model = graphicsManager.currentEnemyModel;
            enemySpeed = model.speed || 0.4;
            enemyVerticalSpeed = model.verticalSpeed || 0.25;
            enemyMaxHealth = model.maxHealth || 100;
        }

        let currentLevel = null;
        if (typeof game !== 'undefined') {
            currentLevel = (game.coreLevelManager || game.levelManager)?.getCurrentLevel?.() || null;
        } else if (typeof gameCore !== 'undefined') {
            currentLevel = (gameCore.coreLevelManager || gameCore.levelManager)?.getCurrentLevel?.() || null;
        }
        if (currentLevel) {
            if (currentLevel.enemyHealth) {
                enemyMaxHealth = currentLevel.enemyHealth;
            }
            if (currentLevel.enemySpeed) {
                enemySpeed = Math.max(0.2, currentLevel.enemySpeed * 0.5);
                enemyVerticalSpeed = enemySpeed * 0.6;
            }
            if (currentLevel.isBoss) {
                enemyMaxHealth = Math.round(enemyMaxHealth * 1.15);
            }
        }

        if (this.levelMods && this.levelMods.enemyHealth) {
            enemyMaxHealth = this.levelMods.enemyHealth;
        }
        enemyMaxHealth = Math.round(enemyMaxHealth * levelScale * 0.8);
        enemySpeed = enemySpeed * (1 + 0.1 * ((scheduleEntry && scheduleEntry.level ? scheduleEntry.level : 1) - 1));
        enemyVerticalSpeed = enemyVerticalSpeed * (1 + 0.08 * ((scheduleEntry && scheduleEntry.level ? scheduleEntry.level : 1) - 1));
        if (typeof difficultyConfigManager !== 'undefined') {
            const profile = difficultyConfigManager.getProfile();
            enemySpeed *= profile.enemySpeedMul;
            enemyMaxHealth = Math.max(1, Math.round(enemyMaxHealth * profile.enemyHealthMul));
        }
        
        const champType = (scheduleEntry && scheduleEntry.type)
            || (currentLevel && currentLevel.isBoss ? 'boss' : 'spaceship');
        const champFaction = (scheduleEntry && scheduleEntry.faction) || 'pirate';
        const champClass = (scheduleEntry && scheduleEntry.enemyClass) || 'assault';
        const champTier = (scheduleEntry && scheduleEntry.tier != null)
            ? scheduleEntry.tier
            : (scheduleEntry && scheduleEntry.level) || 1;
        const champLevel = scheduleEntry && scheduleEntry.level;
        const hitProfile = this.resolveEnemyHitProfile({
            faction: champFaction,
            enemyClass: champClass,
            tier: champTier,
            level: champLevel,
            type: (scheduleEntry && scheduleEntry.type) || this.currentShipType,
            drawScale: 1
        });
        shipWidth = hitProfile.width;
        shipHeight = hitProfile.height;
        // contentScale applied via applyEnemyHitProfile / explicit sizes below
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(3, Number(game.contentScale) || 1))
            : 1;
        shipWidth = Math.max(6, Math.round(shipWidth * contentScale));
        shipHeight = Math.max(6, Math.round(shipHeight * contentScale));

        this.enemy = {
            x: canvasWidth / 2 - shipWidth / 2,
            y: 25,
            width: shipWidth,
            height: shipHeight,
            speed: enemySpeed,
            verticalSpeed: enemyVerticalSpeed,
            color: 'var(--gray-1000)',
            type: champType,
            faction: champFaction,
            enemyClass: champClass,
            tier: champTier,
            cluster: (scheduleEntry && scheduleEntry.cluster) || 'alpha',
            entryId: scheduleEntry && scheduleEntry.id,
            level: champLevel,
            champion: true,
            isBoss: !!(currentLevel && currentLevel.isBoss),
            minY: 25,
            maxY: canvasHeight / 3,
            sprite: hitProfile.sprite,
            colors: hitProfile.colors,
            collision: hitProfile.collision
        };
        
        this.maxHealth = enemyMaxHealth;
        
        if (typeof graphicsManager !== 'undefined' && graphicsManager.currentEnemyModel) {
            const model = graphicsManager.currentEnemyModel;
            this.evasionCooldown = model.evasionCooldown || 5000;
            this.evasionDuration = model.evasionDuration || 1000;
            this.evasionSpeed = model.evasionSpeed || 2;
            this.evasionChance = model.evasionChance != null ? model.evasionChance : 1;
            this.predictionSkill = model.predictionSkill != null ? model.predictionSkill : 0;
            this.armor = model.armor != null ? model.armor : 0;
            this.shieldMax = model.shieldMax != null ? Math.round(model.shieldMax * levelScale) : 0;
            this.shieldRegen = model.shieldRegen != null ? model.shieldRegen : 0;
            this.damageReduction = model.damageReduction != null ? model.damageReduction : 0;
            this.reflectChance = model.reflectChance != null ? model.reflectChance : 0;
            this.defenseMechanisms = Array.isArray(model.defenseMechanisms)
                ? model.defenseMechanisms.slice()
                : [];
        } else if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(this.currentShipType);
            this.armor = (cfg && cfg.armor) || 0;
            this.shieldMax = cfg ? Math.round((cfg.shieldMax || 0) * levelScale) : 0;
            this.shieldRegen = (cfg && cfg.shieldRegen) || 0;
            this.damageReduction = (cfg && cfg.damageReduction) || 0;
            this.reflectChance = (cfg && cfg.reflectChance) || 0;
            this.defenseMechanisms = (cfg && cfg.defenseMechanisms) ? cfg.defenseMechanisms.slice() : [];
            this.evasionChance = cfg && cfg.evasionChance != null ? cfg.evasionChance : 1;
            this.predictionSkill = cfg && cfg.predictionSkill != null ? cfg.predictionSkill : 0;
        } else {
            this.armor = 0;
            this.shieldMax = 0;
            this.shieldRegen = 0;
            this.damageReduction = 0;
            this.reflectChance = 0;
            this.defenseMechanisms = [];
        }
        if (typeof difficultyConfigManager !== 'undefined') {
            const ai = difficultyConfigManager.resolveEnemy(
                this.enemy.faction, this.enemy.tier,
                { evasionChance: this.evasionChance, predictionSkill: this.predictionSkill }
            );
            this.evasionChance = ai.evasionChance;
            this.predictionSkill = ai.predictionSkill;
            this.enemy.damageMul = ai.damageMul;
        }
        this.shield = this.shieldMax;
        
        this.health = this.maxHealth;
        this.exploding = false;
        this.explosionTimer = 0;
        this.sideFleeing = false;

        const discoveredType = (scheduleEntry && scheduleEntry.type) || this.currentShipType;
        if (typeof profileManager !== 'undefined' && profileManager.discoverEnemyContents && discoveredType) {
            profileManager.discoverEnemyContents(discoveredType);
        }
    }

    /**
     * Apply armor / shield / reflect against incoming damage.
     * Mutates target.shield when present. Returns remaining HP damage (0 if fully blocked).
     */
    applyDefenseToDamage(target, rawDamage) {
        let dmg = Number(rawDamage) || 0;
        if (dmg <= 0) return 0;

        const reflect = (target.reflectChance != null ? target.reflectChance : 0) / 100;
        const mechs = target.defenseMechanisms || [];
        const canReflect = reflect > 0 && (
            mechs.indexOf('energy_shield') !== -1 || mechs.indexOf('adaptive_shield') !== -1 || reflect > 0
        );
        if (canReflect && Math.random() < reflect) {
            return 0;
        }

        let reduction = (target.damageReduction != null ? target.damageReduction : 0) / 100;
        if (mechs.indexOf('massive_armor') !== -1) reduction = Math.min(0.75, reduction + 0.1);
        else if (mechs.indexOf('heavy_armor') !== -1) reduction = Math.min(0.75, reduction + 0.05);
        if (mechs.indexOf('adaptive_shield') !== -1) reduction = Math.min(0.75, reduction + 0.05);
        dmg *= (1 - Math.max(0, Math.min(0.75, reduction)));

        // Soft armor: diminishing returns, never nullifies light weapons vs regen.
        const armor = target.armor != null ? Number(target.armor) : 0;
        if (armor > 0) {
            const mitigation = Math.min(0.65, armor / (armor + 100));
            dmg *= (1 - mitigation);
        }
        // Floor: at least 20% of post-reflect damage (or 1) reaches shield/HP.
        const floor = Math.max(1, Number(rawDamage) * 0.2);
        dmg = Math.max(floor, dmg);

        if (target.shield != null && target.shield > 0) {
            const absorbed = Math.min(target.shield, dmg);
            target.shield -= absorbed;
            dmg -= absorbed;
        }

        return Math.max(0, dmg);
    }

    takeDamage(damage) {
        const target = {
            armor: this.armor,
            shield: this.shield,
            damageReduction: this.damageReduction,
            reflectChance: this.reflectChance,
            defenseMechanisms: this.defenseMechanisms
        };
        const playerDamageMul = (typeof difficultyConfigManager !== 'undefined')
            ? difficultyConfigManager.getProfile().playerDamageMul : 1;
        const remaining = this.applyDefenseToDamage(target, Number(damage) * playerDamageMul);
        this.shield = target.shield;
        this.health -= remaining;
        if (this.health <= 0) {
            this.health = 0;
            this.startExplosion();
            return true; // Enemy defeated
        }
        this.evaluateCombatEvents(this.getRuntimeGameState(null));
        return false;
    }

    damageSideEnemy(side, damage) {
        if (!side) return false;
        const playerDamageMul = (typeof difficultyConfigManager !== 'undefined')
            ? difficultyConfigManager.getProfile().playerDamageMul : 1;
        const remaining = this.applyDefenseToDamage(side, Number(damage) * playerDamageMul);
        side.health -= remaining;
        return side.health <= 0;
    }
    
    killEnemy() {
        // Instant kill cheat - kill enemy immediately
        if (this.enemy) {
            this.health = 0;
            this.startExplosion();
            return true;
        }
        return false;
    }

    startExplosion() {
        this.exploding = true;
        this.explosionTimer = 0;
        this.beginSideEnemyFlee(this.getRuntimeGameState(null));
        let duration = 2000;
        let presetId = 'ship_death';
        if (typeof enemyConfigManager !== 'undefined' && this.enemy) {
            const typeId = this.enemy.type || this.enemy.enemyType || this.currentEnemyType;
            const cfg = enemyConfigManager.getConfig(typeId);
            if (cfg && cfg.explosionId) presetId = cfg.explosionId;
        }
        this.explosionPresetId = presetId;
        if (typeof explosionConfigManager !== 'undefined') {
            const preset = explosionConfigManager.getPreset(presetId);
            if (preset && preset.ringDurationMs) duration = preset.ringDurationMs;
        }
        this.explosionDuration = duration;
        if (this.enemy && typeof explosionSystem !== 'undefined') {
            const ex = this.enemy.x + (this.enemy.width || 0) / 2;
            const ey = this.enemy.y + (this.enemy.height || 0) / 2;
            explosionSystem.play(presetId, ex, ey, {
                width: this.enemy.width,
                height: this.enemy.height,
                silent: true
            });
        }
    }

    isExploding() {
        return this.exploding;
    }

    updateExplosion(deltaTime) {
        if (!this.exploding) return false;
        
        this.explosionTimer += deltaTime;
        if (this.explosionTimer >= this.explosionDuration) {
            this.exploding = false;
            return true; // Explosion finished
        }
        return false;
    }

    getEnemies() {
        return this.enemy ? [this.enemy] : [];
    }

    getEnemy() {
        return this.enemy;
    }

    getHealth() {
        return this.health;
    }

    getMaxHealth() {
        return this.maxHealth;
    }

    updateEvasion(deltaTime, game) {
        this.evasionTimer += deltaTime;
        
        // Check if enemy should start evading (improved detection)
        if (!this.isEvading && this.evasionTimer >= this.evasionCooldown) {
            // Check if player bullets are nearby
            const bullets = bulletManager.getBullets();
            const enemyCenterX = this.enemy.x + this.enemy.width / 2;
            const enemyCenterY = this.enemy.y + this.enemy.height / 2;
            
            for (let bullet of bullets) {
                const bulletCenterX = bullet.x + bullet.width / 2;
                const bulletCenterY = bullet.y + bullet.height / 2;
                const distance = Math.sqrt((bulletCenterX - enemyCenterX) ** 2 + (bulletCenterY - enemyCenterY) ** 2);
                
                // If bullet is close, start evading (increased detection range)
                if (distance < 100 && Math.random() <= this.evasionChance) {
                    this.startEvasion();
                    break;
                }
            }
        }
        
        // Check for nearby obstacles and avoid them
        this.avoidObstacles(game);
        
        // Update evasion movement
        if (this.isEvading) {
            if (this.evasionTimer >= this.evasionDuration) {
                this.stopEvasion();
            } else {
                // Move away from player bullets with improved logic
                const bullets = bulletManager.getBullets();
                if (bullets.length > 0) {
                    // Find the closest bullet instead of just using the first one
                    let closestBullet = bullets[0];
                    let closestBulletDistance = Infinity;
                    const enemyCenterX = this.enemy.x + this.enemy.width / 2;
                    const enemyCenterY = this.enemy.y + this.enemy.height / 2;
                    
                    for (let bullet of bullets) {
                        const bulletCenterX = bullet.x + bullet.width / 2;
                        const bulletCenterY = bullet.y + bullet.height / 2;
                        const distance = Math.sqrt((bulletCenterX - enemyCenterX) ** 2 + (bulletCenterY - enemyCenterY) ** 2);
                        
                        if (distance < closestBulletDistance) {
                            closestBulletDistance = distance;
                            closestBullet = bullet;
                        }
                    }
                    
                    const bulletCenterX = closestBullet.x + closestBullet.width / 2;
                    const bulletCenterY = closestBullet.y + closestBullet.height / 2;
                    
                    // Calculate evasion direction with better logic
                    const player = (typeof playerManager !== 'undefined') ? playerManager.getPosition() : null;
                    const playerX = player ? player.x : enemyCenterX;
                    const playerY = player ? player.y : enemyCenterY;
                    const previous = this.lastPlayerPosition || { x: playerX, y: playerY };
                    const lead = Math.max(0, Math.min(1, this.predictionSkill));
                    const predictedX = playerX + (playerX - previous.x) * lead * 8;
                    const predictedY = playerY + (playerY - previous.y) * lead * 8;
                    this.lastPlayerPosition = { x: playerX, y: playerY };
                    const deltaX = enemyCenterX - bulletCenterX + (predictedX - playerX) * 0.25;
                    const deltaY = enemyCenterY - bulletCenterY + (predictedY - playerY) * 0.25;
                    
                    // Normalize the evasion vector
                    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    if (magnitude > 0) {
                        const normalizedX = deltaX / magnitude;
                        const normalizedY = deltaY / magnitude;
                        
                        // Apply evasion movement with strength based on distance
                        const evasionStrength = Math.max(0.6, 1.0 - (closestBulletDistance / 100));
                        this.enemy.x += normalizedX * this.evasionSpeed * evasionStrength;
                        this.enemy.y += normalizedY * this.evasionSpeed * evasionStrength;
                    }
                    
                    // Keep enemy on screen with robust boundary checking
                    const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
                    this.enemy.x = Math.max(0, Math.min(canvasWidth - this.enemy.width, this.enemy.x));
                    this.enemy.y = Math.max(this.enemy.minY, Math.min(this.enemy.maxY, this.enemy.y));
                    
                    // Force enemy back if it somehow escaped
                    if (this.enemy.x < 0) this.enemy.x = 0;
                    if (this.enemy.x > canvasWidth - this.enemy.width) this.enemy.x = canvasWidth - this.enemy.width;
                    if (this.enemy.y < this.enemy.minY) this.enemy.y = this.enemy.minY;
                    if (this.enemy.y > this.enemy.maxY) this.enemy.y = this.enemy.maxY;
                }
            }
        }
    }

    avoidObstacles(game) {
        const obstacles = obstacleManager.getObstacles();
        const enemyCenterX = this.enemy.x + this.enemy.width / 2;
        const enemyCenterY = this.enemy.y + this.enemy.height / 2;
        
        // Find the closest obstacle
        let closestObstacle = null;
        let closestDistance = Infinity;
        
        for (let obstacle of obstacles) {
            const obstacleCenterX = obstacle.x + obstacle.width / 2;
            const obstacleCenterY = obstacle.y + obstacle.height / 2;
            const distance = Math.sqrt((obstacleCenterX - enemyCenterX) ** 2 + (obstacleCenterY - enemyCenterY) ** 2);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestObstacle = obstacle;
            }
        }
        
        // If obstacle is close, avoid it with improved logic
        if (closestObstacle && closestDistance < 80) { // Increased detection range from 60 to 80
            const obstacleCenterX = closestObstacle.x + closestObstacle.width / 2;
            const obstacleCenterY = closestObstacle.y + closestObstacle.height / 2;
            
            // Calculate avoidance direction with better logic
            const deltaX = enemyCenterX - obstacleCenterX;
            const deltaY = enemyCenterY - obstacleCenterY;
            
            // Normalize the avoidance vector
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (magnitude > 0) {
                const normalizedX = deltaX / magnitude;
                const normalizedY = deltaY / magnitude;
                
                // Apply stronger avoidance movement
                const avoidanceStrength = Math.max(0.8, 1.2 - (closestDistance / 80)); // Stronger when closer
                this.enemy.x += normalizedX * this.evasionSpeed * avoidanceStrength;
                this.enemy.y += normalizedY * this.enemy.verticalSpeed * avoidanceStrength;
            }
            
            // Keep enemy within bounds with robust boundary checking
            const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
            this.enemy.x = Math.max(0, Math.min(canvasWidth - this.enemy.width, this.enemy.x));
            this.enemy.y = Math.max(this.enemy.minY, Math.min(this.enemy.maxY, this.enemy.y));
            
            // Force enemy back if it somehow escaped
            if (this.enemy.x < 0) this.enemy.x = 0;
            if (this.enemy.x > canvasWidth - this.enemy.width) this.enemy.x = canvasWidth - this.enemy.width;
            if (this.enemy.y < this.enemy.minY) this.enemy.y = this.enemy.minY;
            if (this.enemy.y > this.enemy.maxY) this.enemy.y = this.enemy.maxY;
        }
    }
    
    startEvasion() {
        this.isEvading = true;
        this.evasionTimer = 0;
    }
    
    stopEvasion() {
        this.isEvading = false;
        this.evasionTimer = 0;
    }

    async reset() {
        this.enemy = null;
        this.health = this.maxHealth;
        this.shield = this.shieldMax;
        this.exploding = false;
        this.explosionTimer = 0;
        this.isEvading = false;
        this.evasionTimer = 0;
        this.sideEnemies = [];
        this.scheduleElapsedMs = 0;
        this.pendingChampionEntry = null;
        this.activeCombatEvents = [];
        this.firedCombatEventIds = {};
        this.combatEventCooldowns = {};
        this.pendingCombatAnnounces = {};
        this.championCombatElapsedMs = 0;
        this.sideDebuffs = { jammer: false, tether: false };
        this.sideFleeing = false;
        this.schedule.forEach(e => { e.spawned = false; });

        if (!this.currentEnemyModel) {
            await this.setShipType(this.currentShipType);
        }

        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.start(
                objectiveManager.objective || { type: 'hunt', targetEnemyId: (this.schedule[0] && this.schedule[0].id) },
                this.schedule
            );
        }

        if (!this.spawnFrozen) {
            const fakeState = {
                width: (typeof game !== 'undefined' && (game.internalWidth || game.width)) || 200,
                height: (typeof game !== 'undefined' && (game.internalHeight || game.height)) || 300
            };
            this.updateSchedule(0, fakeState);
        }
    }
}

// Global enemy manager instance
const enemyManager = new EnemyManager();
