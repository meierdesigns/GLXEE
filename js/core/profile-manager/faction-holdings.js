"use strict";

// Faction holdings: the ruling faction of a galaxy has a BASE planet and
// founds STATIONS over time.
//
//   profile.factionHoldings[galaxyId] = {
//       ruler, base, baseLost, stations: [{ id, planetId, faction, founded }],
//       ticks, battles
//   }
//
// Expansion ticks on every flight on the galaxy map and every
// BATTLES_PER_TICK won stages. Each faction expands its own way (EXPANSION).
// Stations show on the map, can be docked at (they trade like trading posts,
// stocking their faction's parts) and raided. Raiding every station opens the
// base to an assault; losing the base costs the ruler its hold, so a HELD
// galaxy turns CONTESTED. Base planets and planets with stations field extra
// defenders and tougher enemies (see enemies/core.js).

const FACTION_HOLDING_BATTLES_PER_TICK = 3;

// every: ticks between attempts · chance: per attempt · max stations ·
// place: where new stations go · defenders: extra enemies per station ·
// warmup: ticks before the first station.
const FACTION_EXPANSION = {
    terran:   { every: 2, chance: 1,    max: 4, place: 'near',     defenders: 1, warmup: 0, label: 'OUTPOST' },
    kronax:   { every: 1, chance: 0.5,  max: 5, place: 'frontier', defenders: 2, warmup: 0, label: 'WARCAMP' },
    voidborn: { every: 3, chance: 1,    max: 3, place: 'far',      defenders: 3, warmup: 0, label: 'SANCTUM' },
    pirate:   { every: 1, chance: 0.35, max: 6, place: 'random',   defenders: 1, warmup: 0, label: 'HIDEOUT' },
    machine:  { every: 2, chance: 1,    max: 5, place: 'spread',   defenders: 2, warmup: 2, label: 'RELAY' }
};

extendClass(ProfileManager, {
    getFactionExpansion(factionId) {
        return FACTION_EXPANSION[String(factionId || '').toLowerCase()] || FACTION_EXPANSION.pirate;
    },

    /** Stored ruler of a galaxy (the config's faction, before any loss of control). */
    getHoldingRuler(galaxyId) {
        if (typeof planetConfigManager === 'undefined') return 'pirate';
        const g = planetConfigManager.getGalaxy ? planetConfigManager.getGalaxy(galaxyId) : null;
        if (g && planetConfigManager.ensureGalaxyFaction) return planetConfigManager.ensureGalaxyFaction(g);
        return (g && g.faction) || 'pirate';
    },

    getFactionHoldings(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return null;
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return null;
        if (!p.factionHoldings || typeof p.factionHoldings !== 'object') p.factionHoldings = {};
        let h = p.factionHoldings[gid];
        if (!h) {
            h = p.factionHoldings[gid] = {
                ruler: this.getHoldingRuler(gid),
                base: this.pickHoldingBase(gid),
                baseModel: 2,
                baseLost: false,
                stations: [],
                ticks: 0,
                battles: 0
            };
        } else if (h.baseModel !== 2 && !h.baseLost && !this.isHoldingBaseRevealed(gid, p, h)) {
            // Older saves: move a still-hidden base to the new far-away spot.
            const next = this.pickHoldingBase(gid);
            if (next && h.stations.every((s) => s.planetId !== next)) h.base = next;
            h.baseModel = 2;
        }
        return h;
    },

    /**
     * Base = the planet furthest from the start planet (most map hops), so it
     * is never within easy reach; ties broken by a seeded pick.
     */
    pickHoldingBase(galaxyId) {
        const map = planetConfigManager.getGalaxyMap(galaxyId) || {};
        const nodes = (map.nodes || []).filter((n) => n.planetId !== map.startPlanetId
            && !(planetConfigManager.isEncounterPlanet && planetConfigManager.isEncounterPlanet(n.planetId)));
        if (!nodes.length) return null;
        const hops = {};
        const start = map.startPlanetId || (map.nodes[0] && map.nodes[0].planetId);
        hops[start] = 0;
        const queue = [start];
        while (queue.length) {
            const cur = queue.shift();
            (map.edges || []).forEach((e) => {
                const next = e[0] === cur ? e[1] : (e[1] === cur ? e[0] : null);
                if (next && hops[next] == null) {
                    hops[next] = hops[cur] + 1;
                    queue.push(next);
                }
            });
        }
        const far = Math.max(...nodes.map((n) => hops[n.planetId] || 0));
        const candidates = nodes.filter((n) => (hops[n.planetId] || 0) === far);
        return candidates[this.tradingPostHash(galaxyId + '|base') % candidates.length].planetId;
    },

    /** The base is only known once its planet is reachable (unlocked or visited). */
    isHoldingBaseRevealed(galaxyId, profile, holdings) {
        const h = holdings || this.getFactionHoldings(galaxyId, profile);
        if (!h || !h.base) return false;
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) return true;
        const gid = String(galaxyId || '').toLowerCase();
        return !!((this.isPlanetUnlocked && this.isPlanetUnlocked(gid, h.base))
            || (this.hasVisitedPlanet && this.hasVisitedPlanet(gid, h.base, profile))
            || (this.isPlanetCleared && this.isPlanetCleared(gid, h.base, profile)));
    },

    /** One expansion step for the ruler of a galaxy. Returns the new station or null. */
    tickFactionExpansion(galaxyId, reason) {
        const p = this.getActiveProfile();
        const h = this.getFactionHoldings(galaxyId, p);
        if (!h || h.baseLost || !h.base) return null;
        h.ticks += 1;
        const ex = this.getFactionExpansion(h.ruler);
        if (h.ticks <= ex.warmup || h.ticks % ex.every !== 0 || h.stations.length >= ex.max) return null;
        const roll = (this.tradingPostHash(galaxyId + '|tick|' + h.ticks + '|' + (p.missionSeed || 0)) % 1000) / 1000;
        if (roll >= ex.chance) return null;
        const planetId = this.pickStationPlanet(galaxyId, h, ex);
        if (!planetId) return null;
        const station = {
            id: String(galaxyId).toLowerCase() + ':fs' + h.ticks,
            planetId: planetId,
            faction: h.ruler,
            founded: h.ticks,
            reason: reason || 'travel'
        };
        h.stations.push(station);
        p.factionNews = { galaxyId: galaxyId, text: String(h.ruler).toUpperCase() + ' FOUNDED A ' + ex.label, at: Date.now() };
        return station;
    },

    /** Where the next station goes, by the faction's expansion style. */
    pickStationPlanet(galaxyId, h, ex) {
        const map = planetConfigManager.getGalaxyMap(galaxyId) || {};
        const byId = {};
        (map.nodes || []).forEach((n) => { byId[n.planetId] = n; });
        const base = byId[h.base];
        const used = h.stations.map((s) => s.planetId);
        const free = (map.nodes || []).filter((n) => n.planetId !== h.base && used.indexOf(n.planetId) === -1
            && !(planetConfigManager.isEncounterPlanet && planetConfigManager.isEncounterPlanet(n.planetId)));
        if (!free.length) return null;
        const dist = (a, b) => (a && b ? Math.hypot(a.x - b.x, (a.y - b.y) * 0.4) : 0);
        const seed = this.tradingPostHash(galaxyId + '|place|' + h.ticks);
        let sorted;
        if (ex.place === 'near') sorted = free.slice().sort((a, b) => dist(a, base) - dist(b, base));
        else if (ex.place === 'frontier' || ex.place === 'far') sorted = free.slice().sort((a, b) => dist(b, base) - dist(a, base));
        else if (ex.place === 'spread') {
            // Furthest from every existing holding.
            const holds = [base].concat(h.stations.map((s) => byId[s.planetId])).filter(Boolean);
            const score = (n) => Math.min(...holds.map((o) => dist(n, o)));
            sorted = free.slice().sort((a, b) => score(b) - score(a));
        } else {
            return free[seed % free.length].planetId;
        }
        // Frontier factions push towards the rivals; 'far' keeps to the edge.
        return sorted[ex.place === 'frontier' ? Math.min(sorted.length - 1, seed % 2) : 0].planetId;
    },

    /** { isBase, stations, defenders, ruler } for a planet — drives harder fights. */
    getPlanetHoldingInfo(planetId) {
        if (typeof planetConfigManager === 'undefined' || !planetId) return null;
        const gid = planetConfigManager.getPlanetGalaxyId ? planetConfigManager.getPlanetGalaxyId(planetId) : null;
        const h = gid ? this.getFactionHoldings(gid) : null;
        if (!h) return null;
        const ex = this.getFactionExpansion(h.ruler);
        const isBase = h.base === planetId && !h.baseLost;
        const stations = h.stations.filter((s) => s.planetId === planetId).length;
        return {
            ruler: h.ruler,
            isBase: isBase,
            stations: stations,
            defenders: stations * ex.defenders + (isBase ? ex.defenders + 1 : 0)
        };
    },

    /** Mark the next fight as a raid on a station (or the base when stationId is 'base'). */
    beginHoldingRaid(galaxyId, stationId, planetId) {
        const p = this.getActiveProfile();
        if (!p) return;
        p.pendingRaid = { galaxyId: String(galaxyId).toLowerCase(), stationId: stationId, planetId: planetId };
        this.save();
    },

    /** Won a stage: resolve a pending raid on that planet. Returns a short news text or null. */
    resolveHoldingRaid(planetId) {
        const p = this.getActiveProfile();
        const r = p && p.pendingRaid;
        if (!r || r.planetId !== planetId) return null;
        p.pendingRaid = null;
        const h = this.getFactionHoldings(r.galaxyId, p);
        if (!h) return null;
        if (r.stationId === 'base') {
            if (h.stations.length) return null;
            h.baseLost = true;
            p.factionNews = { galaxyId: r.galaxyId, text: String(h.ruler).toUpperCase() + ' BASE DESTROYED — HOLD BROKEN', at: Date.now() };
        } else {
            const before = h.stations.length;
            h.stations = h.stations.filter((s) => s.id !== r.stationId);
            if (h.stations.length === before) return null;
            p.factionNews = { galaxyId: r.galaxyId, text: String(h.ruler).toUpperCase() + ' STATION DESTROYED', at: Date.now() };
            if (typeof factionManager !== 'undefined' && factionManager.addReputation) factionManager.addReputation(h.ruler, -5);
        }
        this.save();
        return p.factionNews.text;
    }
});

(function wrapHoldingHooks() {
    const pm = ProfileManager.prototype;

    // Travel tick: every real flight on the map.
    const baseSetLoc = pm.setShipLocation;
    pm.setShipLocation = function (galaxyId, kind, id) {
        const p = this.getActiveProfile();
        const gid = String(galaxyId || '').toLowerCase();
        const prev = p && p.shipLocations && p.shipLocations[gid];
        const moved = !prev || prev.kind !== kind || prev.id !== id;
        baseSetLoc.call(this, galaxyId, kind, id);
        if (moved && !this._suppressHoldingTick) {
            this.tickFactionExpansion(gid, 'travel');
            this.save();
        }
    };

    // Battle tick + raids: every won stage.
    const baseMark = pm.markStageCleared;
    pm.markStageCleared = function (planetId, stageKey) {
        const res = baseMark.apply(this, arguments);
        try {
            const gid = typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetGalaxyId
                ? planetConfigManager.getPlanetGalaxyId(planetId) : null;
            const news = this.resolveHoldingRaid(planetId);
            if (news && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                levelInfoManager.showLootNotice(news);
            }
            const h = gid ? this.getFactionHoldings(gid) : null;
            if (h) {
                h.battles += 1;
                if (h.battles % FACTION_HOLDING_BATTLES_PER_TICK === 0) this.tickFactionExpansion(gid, 'battles');
                this.save();
            }
        } catch (e) { /* holdings must never break progress saving */ }
        return res;
    };

    // Stations dock like trading posts.
    const baseGetPosts = pm.getTradingPosts;
    pm.getTradingPosts = function (galaxyId) {
        const posts = baseGetPosts.call(this, galaxyId);
        const h = this.getFactionHoldings(galaxyId);
        if (!h || !h.stations.length || typeof planetConfigManager === 'undefined') return posts;
        const map = planetConfigManager.getGalaxyMap(String(galaxyId).toLowerCase()) || {};
        const byId = {};
        (map.nodes || []).forEach((n) => { byId[n.planetId] = n; });
        const placed = posts.map((p) => ({ x: p.x, y: p.y }));
        const ex = this.getFactionExpansion(h.ruler);
        h.stations.forEach((s) => {
            const node = byId[s.planetId];
            if (!node) return;
            const pos = this.placeTradingPost(map.nodes || [], node, placed, this.tradingPostHash(s.id));
            placed.push(pos);
            posts.push({
                id: s.id,
                galaxyId: String(galaxyId).toLowerCase(),
                planetId: s.planetId,
                anchors: [s.planetId],
                deepSpace: false,
                x: pos.x,
                y: pos.y,
                name: String(s.faction).toUpperCase() + ' ' + ex.label,
                categories: ['parts'],
                factionStation: true,
                faction: s.faction
            });
        });
        return posts;
    };

    // A faction station stocks its own faction's parts (plus a little neutral gear).
    const baseStock = pm.getTradingPostStock;
    pm.getTradingPostStock = function (post) {
        if (!post || !post.factionStation) return baseStock.call(this, post);
        const seed = this.tradingPostHash(post.id + '|stock');
        const rank = (e) => this.tradingPostHash(seed + '|' + e.kind + ':' + e.id);
        const pool = this.getTradingPostPool().sort((a, b) => rank(a) - rank(b));
        return pool.filter((e) => e.faction === post.faction).slice(0, 6)
            .concat(pool.filter((e) => !e.faction).slice(0, 2));
    };
})();

// Losing the base breaks the ruler's hold: HELD → CONTESTED.
(function wrapGalaxyControl() {
    if (typeof PlanetConfigManager === 'undefined') return;
    const proto = PlanetConfigManager.prototype;
    const baseControl = proto.getGalaxyControl;
    proto.getGalaxyControl = function (galaxyId) {
        const c = baseControl.call(this, galaxyId);
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const p = pm && pm.getActiveProfile ? pm.getActiveProfile() : null;
        const h = p && p.factionHoldings && p.factionHoldings[String(galaxyId || '').toLowerCase()];
        if (!h || !h.baseLost || !c || c.control !== 'held') return c;
        const others = (this.availableFactions || []).filter((f) => f !== c.main);
        if (!others.length) return c;
        const rival = others[pm.tradingPostHash(galaxyId + '|uprising') % others.length];
        return {
            control: 'contested',
            main: c.main,
            rivals: [rival],
            factions: [{ id: c.main, share: 0.5 }, { id: rival, share: 0.5 }]
        };
    };
})();
