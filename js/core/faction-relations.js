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

// Gang names for bounty hunts, one pool shared by all galaxies.
const FACTION_BOUNTY_GANGS = ['RUST FANGS', 'NULL CORSAIRS', 'ASH COVENANT', 'BLACK TIDE', 'IRON JACKALS', 'HOLLOW STAR'];

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
            factions.forEach((fid) => {
                add({ kind: 'job', type: 'FACTION JOB', factionId: fid, planetId: pick(fid), mult: 1.1, rep: 8 });
            });
            if (factions.length) {
                const issuer = factions[this.missionHash(seedBase + gid + 'bounty') % factions.length];
                const gang = FACTION_BOUNTY_GANGS[this.missionHash(seedBase + gid + 'gang') % FACTION_BOUNTY_GANGS.length];
                const renegade = this.missionHash(seedBase + gid + 'kind') % 2 === 0;
                add({
                    kind: 'bounty',
                    type: 'BOUNTY HUNT',
                    factionId: issuer,
                    target: renegade ? 'RENEGADE ' + issuer.toUpperCase() + ' WING' : gang,
                    planetId: pick('bounty'),
                    mult: 1.5,
                    rep: 12
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
            target: c.target || null
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
        }
        return paid;
    };
})();
