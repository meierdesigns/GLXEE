"use strict";

// Faction relations: reputation per faction, trade with allied factions and
// faction contracts (faction jobs + bounty hunts on renegades and gangs).
// Contracts are offered in every galaxy the pilot can already reach (current
// galaxy, warp range or owned portal). Accepting one in another galaxy
// teleports there first. Contracts reuse the hangar mission slot
// (profile.activeMission) so the bounty is paid by completeMissionFor; a
// wrapper below adds the reputation gain for the issuing faction.

const FACTION_REP_MIN = -100;
const FACTION_REP_MAX = 100;
// Reputation from which a faction trades with the pilot without a pact.
const FACTION_TRADE_REP = 40;

// Gang names for bounty hunts, one pool shared by all galaxies; each gang
// paints its ships in its own colour (renegade livery, enemy-variants.js).
const FACTION_BOUNTY_GANGS = ['RUST FANGS', 'NULL CORSAIRS', 'ASH COVENANT', 'BLACK TIDE', 'IRON JACKALS', 'HOLLOW STAR'];
const FACTION_GANG_COLORS = ['#ff7a2a', '#3ad8ff', '#c0c0c0', '#2a6aff', '#ffd23a', '#c86aff'];
// Callsigns of renegade captains (deserters a faction wants gone).
const FACTION_RENEGADE_NAMES = ['VEX', 'KORR', 'SABLE', 'DRAX', 'NYX', 'HALVOR', 'RIKE', 'OSSA', 'MARROW', 'TESK'];

/**
 * Faction contract kinds. Each has a concrete goal on its target planet:
 *   renegade — a deserter of the issuing faction leads the enemies there
 *   conquer  — take a planet from a rival; on success the issuer holds it
 *   defend   — drive a rival's raiders off one of the issuer's planets
 *   bounty   — an outlaw gang (pirate ships in gang colours)
 * All pay out when a stage on the target planet is won.
 */
const FACTION_CONTRACT_KINDS = {
    renegade: { type: 'RENEGADE HUNT', mult: 1.3, rep: 10 },
    conquer:  { type: 'CONQUEST',      mult: 1.6, rep: 14 },
    defend:   { type: 'DEFENSE',       mult: 1.1, rep: 8 },
    bounty:   { type: 'BOUNTY HUNT',   mult: 1.5, rep: 12 }
};

extendClass(FactionManager, {
    getReputation(id) {
        const key = String(id || '').toLowerCase();
        if (!this.state.reputation) this.state.reputation = {};
        const base = key === 'pirate' ? -40 : 0;
        const v = this.state.reputation[key];
        return v == null ? base : v;
    },

    addReputation(id, delta) {
        const key = String(id || '').toLowerCase();
        if (!this.factions[key]) return 0;
        if (!this.state.reputation) this.state.reputation = {};
        const next = Math.max(FACTION_REP_MIN, Math.min(FACTION_REP_MAX, this.getReputation(key) + (Number(delta) || 0)));
        this.state.reputation[key] = next;
        this.save();
        return next;
    },

    /** Relation of the pilot to a faction: score -100..100 plus a label. */
    getRelation(id) {
        const key = String(id || '').toLowerCase();
        if (this.getAllegiance() === key) return { score: 100, label: 'ALLEGIANCE', tone: 'ally' };
        const pact = this.getPacts()[key];
        const rep = this.getReputation(key);
        const score = Math.max(FACTION_REP_MIN, Math.min(FACTION_REP_MAX, rep + (pact === 'active' ? 30 : 0)));
        if (pact === 'active') return { score: score, label: 'PACT', tone: 'friend' };
        if (score >= 60) return { score: score, label: 'FRIENDLY', tone: 'friend' };
        if (score >= FACTION_TRADE_REP) return { score: score, label: 'CORDIAL', tone: 'friend' };
        if (score <= -30) return { score: score, label: 'HOSTILE', tone: 'hostile' };
        if (pact === 'proposed') return { score: score, label: 'TALKS', tone: 'neutral' };
        return { score: score, label: 'NEUTRAL', tone: 'neutral' };
    },

    /** Allied = own faction, active pact, or reputation high enough to trade. */
    isAllied(id) {
        const key = String(id || '').toLowerCase();
        return this.getAllegiance() === key || this.hasPact(key) || this.getRelation(key).score >= FACTION_TRADE_REP;
    },

    /**
     * Trade terms of a faction: its specialty material (cheap to buy, poor to
     * sell), its demanded material (sells high) and a price factor from the
     * relation score (better relations, better prices).
     */
    getTradeTerms(id) {
        const key = String(id || '').toLowerCase();
        const mats = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds.slice() : ['scrap', 'ore', 'crystal', 'voltex'];
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        const specialty = mats[h % mats.length];
        const rest = mats.filter((m) => m !== specialty);
        const demand = rest[(h >>> 3) % rest.length];
        const score = this.getRelation(key).score;
        // 100 relation → 20% discount, 40 relation → 8%.
        const discount = Math.max(0, score) / 500;
        return { specialty: specialty, demand: demand, discount: discount, materials: mats };
    },

    /** Credits per unit to buy / sell a material with a faction. */
    getTradeQuote(id, mat) {
        if (typeof economyConfig === 'undefined') return { buy: 0, sell: 0 };
        const t = this.getTradeTerms(id);
        const buyBase = (economyConfig.getResourceBuyCost(mat, 10) || { credits: 0 }).credits / 10;
        const sellBase = (economyConfig.getResourceSellPayout(mat, 10) || { credits: 0 }).credits / 10;
        const buyMult = (mat === t.specialty ? 0.6 : 1) * (1 - t.discount);
        const sellMult = (mat === t.demand ? 1.5 : (mat === t.specialty ? 0.6 : 1)) * (1 + t.discount);
        return {
            buy: Math.max(1, Math.ceil(buyBase * buyMult)),
            sell: Math.max(1, Math.floor(sellBase * sellMult))
        };
    }
});

extendClass(ProfileManager, {
    /** Galaxies the pilot can reach right now: current one first. */
    getReachableGalaxyIds(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return [];
        const current = this.getCurrentGalaxyId(p);
        const others = planetConfigManager.getGalaxyIds()
            .filter((gid) => gid !== current && this.canTravelToGalaxy(gid, p).ok);
        return [current].concat(others);
    },

    /** Faction holding a planet: a conquest result first, else its configured owner. */
    getPlanetOwner(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const p = this.getActiveProfile();
        if (p && p.planetCaptures && p.planetCaptures[pid]) return p.planetCaptures[pid];
        if (typeof planetConfigManager === 'undefined' || !planetConfigManager.getPlanetFactions) return null;
        return planetConfigManager.getPlanetFactions(pid)[0] || null;
    },

    /**
     * The active contract shapes the fight on its target planet (called from
     * enemies/core.js setEnemySchedule with the built schedule).
     */
    applyContractToSchedule(planetId, schedule) {
        const p = this.getActiveProfile();
        const m = p && p.activeMission;
        if (!m || !m.kind || !Array.isArray(schedule) || !schedule.length) return;
        if (m.planetId !== String(planetId || '').toLowerCase()) return;
        const champ = schedule.find((e) => e.champion) || schedule[0];
        const others = schedule.filter((e) => e !== champ);
        if (m.kind === 'renegade') {
            // The deserter and his wingmen fly the issuer's ships, stripped of its colours.
            [champ].concat(others.slice(0, 2)).forEach((e) => {
                e.faction = m.factionId;
                e.renegade = true;
            });
            champ.missionTarget = 'RENEGADE ' + (m.target || '');
        } else if (m.kind === 'bounty') {
            [champ].concat(others.slice(0, 3)).forEach((e) => {
                e.faction = 'pirate';
                e.renegade = true;
                e.renegadeColor = m.gangColor || null;
            });
            champ.missionTarget = m.target || 'GANG LEADER';
        } else if ((m.kind === 'conquer' || m.kind === 'defend') && m.enemyFaction) {
            schedule.forEach((e) => { e.faction = m.enemyFaction; });
        }
    },

    /** Planets of a galaxy a contract can target (unlocked or cleared). */
    getContractPlanets(galaxyId) {
        if (typeof planetConfigManager === 'undefined') return [];
        const map = planetConfigManager.getGalaxyMap(galaxyId) || {};
        return (map.nodes || [])
            .map((n) => String(n.planetId).toLowerCase())
            .filter((pid) => !(planetConfigManager.isEncounterPlanet && planetConfigManager.isEncounterPlanet(pid)))
            .filter((pid) => this.isPlanetCleared(galaxyId, pid) || this.isPlanetUnlocked(galaxyId, pid));
    },

    /**
     * Contract board: per reachable galaxy one job for every faction present
     * there plus one bounty hunt. Hostile factions offer nothing. Galaxies
     * not charted yet get contracts without a planet — the target is picked
     * on arrival.
     */
    getFactionContracts(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof factionManager === 'undefined' || typeof planetConfigManager === 'undefined') return [];
        const seedBase = (p.missionSeed || 0) + '|' + (p.id || '');
        const active = p.activeMission || null;
        const current = this.getCurrentGalaxyId(p);
        const out = [];
        this.getReachableGalaxyIds(p).forEach((gid) => {
            const g = planetConfigManager.getGalaxy(gid) || {};
            const planets = this.getContractPlanets(gid);
            const factions = (planetConfigManager.getGalaxyFactionIds
                ? planetConfigManager.getGalaxyFactionIds(gid) : [])
                .filter((f) => factionManager.factions[f] && factionManager.getRelation(f).tone !== 'hostile');
            const pick = (salt) => {
                if (!planets.length) return null;
                return planets[this.missionHash(seedBase + '|' + gid + '|' + salt) % planets.length];
            };
            const remote = gid !== current;
            const add = (entry) => {
                const pid = entry.planetId;
                const cfg = pid ? (planetConfigManager.getConfig(pid) || {}) : {};
                const rw = pid ? this.getMissionReward(gid, pid, false, p)
                    : { difficulty: 'NORMAL', reward: { credits: 110 } };
                const mult = entry.mult * (remote ? 1.25 : 1);
                const reward = {};
                Object.keys(rw.reward).forEach((k) => {
                    reward[k] = k === 'credits' ? Math.round(rw.reward[k] * mult / 5) * 5 : Math.round(rw.reward[k] * mult);
                });
                out.push(Object.assign(entry, {
                    id: entry.kind + ':' + gid + ':' + entry.factionId,
                    galaxyId: gid,
                    galaxyName: String(g.name || gid).replace(/_/g, ' ').toUpperCase(),
                    remote: remote,
                    planetName: pid ? String(cfg.name || pid).toUpperCase() : 'UNCHARTED',
                    difficulty: rw.difficulty,
                    reward: reward,
                    active: !!(active && active.contractId === entry.kind + ':' + gid + ':' + entry.factionId)
                }));
            };
            const pcm = planetConfigManager;
            const ownerOf = (pid) => this.getPlanetOwner(pid);
            const allied = (a, b) => a === b || !!(pcm.areFactionsAllied && pcm.areFactionsAllied(a, b));
            const pickFrom = (list, salt) => list.length
                ? list[this.missionHash(seedBase + '|' + gid + '|' + salt) % list.length] : null;
            factions.forEach((fid) => {
                const F = fid.toUpperCase();
                // Which goals make sense for this faction here?
                const own = planets.filter((pid) => ownerOf(pid) === fid);
                const rivalHeld = planets.filter((pid) => ownerOf(pid) && !allied(ownerOf(pid), fid));
                const kinds = ['renegade'];
                if (rivalHeld.length) kinds.push('conquer');
                if (own.length && factions.concat(planetConfigManager.getGalaxyFactionIds ? planetConfigManager.getGalaxyFactionIds(gid) : [])
                    .some((f) => !allied(f, fid))) kinds.push('defend');
                const kind = pickFrom(kinds, fid + 'kind') || 'renegade';
                const def = FACTION_CONTRACT_KINDS[kind];
                const entry = { kind: kind, type: def.type, factionId: fid, mult: def.mult, rep: def.rep };
                if (kind === 'renegade') {
                    const name = 'CAPTAIN ' + pickFrom(FACTION_RENEGADE_NAMES, fid + 'name');
                    entry.planetId = pick(fid);
                    entry.target = name;
                    entry.goal = 'TAKE DOWN RENEGADE ' + name + ' · ' + F + ' DESERTER';
                } else if (kind === 'conquer') {
                    entry.planetId = pickFrom(rivalHeld, fid + 'conq');
                    entry.enemyFaction = ownerOf(entry.planetId);
                    entry.goal = 'SEIZE IT FROM ' + entry.enemyFaction.toUpperCase() + ' FOR ' + F;
                } else {
                    entry.planetId = pickFrom(own, fid + 'def');
                    const galaxyFactions = planetConfigManager.getGalaxyFactionIds ? planetConfigManager.getGalaxyFactionIds(gid) : [];
                    const foes = galaxyFactions.filter((f) => !allied(f, fid));
                    entry.enemyFaction = pickFrom(foes.length ? foes : ['pirate'], fid + 'foe');
                    entry.goal = 'DRIVE ' + entry.enemyFaction.toUpperCase() + ' RAIDERS OFF ' + F + ' GROUND';
                }
                add(entry);
            });
            if (factions.length) {
                const issuer = factions[this.missionHash(seedBase + gid + 'bounty') % factions.length];
                const g = this.missionHash(seedBase + gid + 'gang') % FACTION_BOUNTY_GANGS.length;
                const def = FACTION_CONTRACT_KINDS.bounty;
                add({
                    kind: 'bounty',
                    type: def.type,
                    factionId: issuer,
                    target: FACTION_BOUNTY_GANGS[g],
                    gangColor: FACTION_GANG_COLORS[g],
                    goal: 'WIPE OUT THE ' + FACTION_BOUNTY_GANGS[g] + ' GANG',
                    planetId: pick('bounty'),
                    mult: def.mult,
                    rep: def.rep
                });
            }
        });
        return out.sort((a, b) => (b.active - a.active) || (a.remote - b.remote));
    },

    /**
     * Accept a contract. Travels to its galaxy first when needed (and picks
     * an arrival planet for uncharted ones). Returns { ok, mission, travelled }.
     */
    acceptFactionContract(contractId) {
        const p = this.getActiveProfile();
        if (!p) return { ok: false, reason: 'NO PROFILE' };
        const c = this.getFactionContracts(p).find((x) => x.id === contractId);
        if (!c) return { ok: false, reason: 'GONE' };
        let travelled = false;
        if (c.galaxyId !== this.getCurrentGalaxyId(p)) {
            const res = this.travelToGalaxy(c.galaxyId);
            if (!res.ok) return { ok: false, reason: res.reason === 'DRIVE' ? 'OUT OF RANGE' : (res.reason || 'TRAVEL FAILED') };
            travelled = true;
        }
        let pid = c.planetId;
        if (!pid) {
            const planets = this.getContractPlanets(c.galaxyId);
            pid = planets[0] || null;
        }
        if (!pid) return { ok: false, reason: 'NO TARGET', travelled: travelled };
        p.activeMission = {
            galaxyId: c.galaxyId,
            planetId: pid,
            type: c.type,
            reward: c.reward,
            factionId: c.factionId,
            repGain: c.rep,
            contractId: c.id,
            kind: c.kind,
            target: c.target || null,
            goal: c.goal || null,
            enemyFaction: c.enemyFaction || null,
            gangColor: c.gangColor || null
        };
        this.save();
        return { ok: true, mission: p.activeMission, travelled: travelled };
    }
});

// Completing a contract also raises reputation with the issuing faction.
(function wrapMissionCompletion() {
    const base = ProfileManager.prototype.completeMissionFor;
    if (typeof base !== 'function') return;
    ProfileManager.prototype.completeMissionFor = function (planetId, profile) {
        const paid = base.call(this, planetId, profile);
        if (paid && paid.factionId && typeof factionManager !== 'undefined') {
            factionManager.addReputation(paid.factionId, paid.repGain || 5);
            // Conquest: the issuer now holds the planet; the loser resents it.
            if (paid.kind === 'conquer') {
                const p = profile || this.getActiveProfile();
                if (p) {
                    if (!p.planetCaptures || typeof p.planetCaptures !== 'object') p.planetCaptures = {};
                    p.planetCaptures[paid.planetId] = paid.factionId;
                    p.factionNews = {
                        galaxyId: paid.galaxyId,
                        text: String(paid.planetId).toUpperCase() + ' SEIZED BY ' + String(paid.factionId).toUpperCase(),
                        at: Date.now()
                    };
                    this.save();
                }
                if (paid.enemyFaction) factionManager.addReputation(paid.enemyFaction, -8);
            }
        }
        return paid;
    };
})();

// Conquered planets are held by their new owner (planet owner = first faction).
(function wrapPlanetCaptures() {
    if (typeof PlanetConfigManager === 'undefined') return;
    const base = PlanetConfigManager.prototype.getPlanetFactions;
    if (typeof base !== 'function') return;
    PlanetConfigManager.prototype.getPlanetFactions = function (planetId, raw) {
        const list = base.call(this, planetId, raw);
        if (raw) return list;
        const p = typeof profileManager !== 'undefined' && profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
        const cap = p && p.planetCaptures && p.planetCaptures[String(planetId || '').toLowerCase()];
        if (!cap) return list;
        return [cap].concat(list.filter((f) => f !== cap));
    };
})();
