"use strict";

// ProfileManager methods: trading posts — independent space-station shops
// with their own spot on the galaxy map. Each post is seeded from a planet
// (its "anchor") but placed in free space nearby. A post opens once its
// anchor planet is cleared and stocks parts from the galaxy's faction mixed with other
// factions. Parts always render in the player's own faction colours, so
// mixed loadouts stay visually consistent.

const TRADING_POST_NAMES = [
    'RUSTHAVEN', 'KESTREL DOCK', 'MERIDIAN EXCHANGE', 'SALVAGE RING', 'NOVA BAZAAR',
    'IRON LANTERN', 'DRIFTWORKS', 'HALCYON DEPOT', 'CINDER MARKET', 'VANTAGE POST'
];

// Shop categories a trader can specialise in. Every post also trades
// resources; docking at a post unlocks its trader, and from then on its
// categories are sold at the home station too.
const TRADING_POST_CATEGORIES = ['parts', 'ships', 'blueprints', 'portals', 'styles'];

// Ability ids sold anywhere (same set as the home station shop).
const TRADING_POST_ABILITY_IDS = ['charge_shot', 'overcharge_core', 'charge_drive', 'drive_charge_dampen', 'spike_drive'];

extendClass(ProfileManager, {
    tradingPostHash(text) {
        let h = 2166136261;
        const s = String(text || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    },

    /**
     * Trading posts of a galaxy, derived from its map so every galaxy
     * (including explored ones) gets posts without extra config: roughly one
     * per three planets, never on the start planet, at least one per galaxy.
     */
    getTradingPosts(galaxyId) {
        if (typeof planetConfigManager === 'undefined') return [];
        const gid = String(galaxyId || '').toLowerCase();
        const map = planetConfigManager.getGalaxyMap(gid) || {};
        const nodes = (map.nodes || []).filter((n) => n.planetId !== map.startPlanetId);
        if (!nodes.length) return [];
        let picked = nodes.filter((n) => this.tradingPostHash(gid + '|post|' + n.planetId) % 3 === 0);
        if (!picked.length) picked = [nodes[this.tradingPostHash(gid + '|post') % nodes.length]];
        const placed = [];
        const byId = {};
        (map.nodes || []).forEach((node) => { byId[node.planetId] = node; });
        return picked.map((n) => {
            const id = gid + ':' + n.planetId;
            const h = this.tradingPostHash(id);
            // About half the posts are deep-space stations between two linked
            // planets instead of orbiting one; they open from either side.
            const links = (map.edges || [])
                .filter((e) => e[0] === n.planetId || e[1] === n.planetId)
                .map((e) => byId[e[0] === n.planetId ? e[1] : e[0]])
                .filter(Boolean);
            const deep = links.length > 0 && (h >>> 3) % 2 === 0;
            let pos;
            let anchors = [n.planetId];
            if (deep) {
                const other = links[(h >>> 5) % links.length];
                pos = this.placeDeepSpacePost(n, other, map.nodes || [], placed, h);
                anchors = [n.planetId, other.planetId];
            } else {
                pos = this.placeTradingPost(map.nodes || [], n, placed, h);
            }
            placed.push(pos);
            return {
                id: id,
                galaxyId: gid,
                planetId: n.planetId,
                anchors: anchors,
                deepSpace: deep,
                x: pos.x,
                y: pos.y,
                name: TRADING_POST_NAMES[h % TRADING_POST_NAMES.length],
                categories: this.getTradingPostCategories(id)
            };
        });
    },

    /**
     * Deep-space spot off the lane between two linked planets: the lane's
     * midpoint pushed sideways, on whichever side is further from everything.
     */
    placeDeepSpacePost(a, b, nodes, placed, seed) {
        const SX = 544;
        const SY = 224;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = (b.x - a.x) * SX;
        const dy = (b.y - a.y) * SY;
        const len = Math.max(1, Math.hypot(dx, dy));
        const off = 34 + (seed % 12);
        const others = nodes.map((o) => ({ x: o.x, y: o.y })).concat(placed);
        let best = { x: mx, y: my };
        let bestScore = -Infinity;
        [1, -1].forEach((side) => {
            const x = Math.min(1, Math.max(0, mx + (-dy / len) * off * side / SX));
            const y = Math.min(1, Math.max(0, my + (dx / len) * off * side / SY));
            let score = Infinity;
            others.forEach((o) => {
                score = Math.min(score, Math.hypot((o.x - x) * SX, (o.y - y) * SY));
            });
            if (score > bestScore) {
                bestScore = score;
                best = { x: x, y: y };
            }
        });
        return best;
    },

    /**
     * Free map spot near the anchor planet: tries seeded angles around it and
     * keeps the one furthest from every planet and already placed post.
     * Distances are measured in map pixels (map area is ~544x224).
     */
    placeTradingPost(nodes, anchor, placed, seed) {
        const SX = 544;
        const SY = 224;
        const radius = 62;
        const others = nodes.map((o) => ({ x: o.x, y: o.y })).concat(placed);
        let best = null;
        let bestScore = -Infinity;
        for (let i = 0; i < 12; i++) {
            const a = ((seed % 360) + i * 30) * Math.PI / 180;
            const x = Math.min(1, Math.max(0, anchor.x + Math.cos(a) * radius / SX));
            const y = Math.min(1, Math.max(0, anchor.y + Math.sin(a) * radius / SY));
            let score = Infinity;
            others.forEach((o) => {
                score = Math.min(score, Math.hypot((o.x - x) * SX, (o.y - y) * SY));
            });
            if (score > bestScore) {
                bestScore = score;
                best = { x: x, y: y };
            }
        }
        return best || { x: anchor.x, y: anchor.y };
    },

    /** Seeded specialty: 1–2 categories plus resources, e.g. ['resources', 'parts', 'styles']. */
    getTradingPostCategories(postId) {
        const h = this.tradingPostHash(String(postId) + '|cats');
        const all = TRADING_POST_CATEGORIES.slice();
        const first = all.splice(h % all.length, 1)[0];
        const cats = [first];
        if ((h >>> 7) % 2 === 0) cats.push(all[(h >>> 9) % all.length]);
        return ['resources'].concat(cats);
    },

    /** Remember a trader once the player has docked there. */
    unlockTrader(postId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || !postId) return false;
        if (!Array.isArray(p.unlockedTraders)) p.unlockedTraders = [];
        if (p.unlockedTraders.indexOf(postId) !== -1) return false;
        p.unlockedTraders.push(postId);
        if (this.save) this.save();
        return true;
    },

    /** Shop categories open at the home station: resources + every unlocked trader's. */
    getUnlockedShopCategories(profile) {
        const p = profile || this.getActiveProfile();
        const out = ['resources'];
        ((p && p.unlockedTraders) || []).forEach((postId) => {
            this.getTradingPostCategories(postId).forEach((c) => {
                if (out.indexOf(c) === -1) out.push(c);
            });
        });
        return out;
    },

    getTradingPost(postId) {
        const gid = String(postId || '').split(':')[0];
        return this.getTradingPosts(gid).find((p) => p.id === postId) || null;
    },

    /** A post opens once the ship has reached one of its anchor planets. */
    isTradingPostUnlocked(post, profile) {
        if (!post) return false;
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) return true;
        return (post.anchors || [post.planetId]).some((pid) =>
            (this.hasVisitedPlanet && this.hasVisitedPlanet(post.galaxyId, pid, profile))
            || this.isPlanetCleared(post.galaxyId, pid, profile));
    },

    /** Planet names a locked post waits on, e.g. "SATURN / PLUTO". */
    getTradingPostUnlockLabel(post) {
        if (!post || typeof planetConfigManager === 'undefined') return '';
        return (post.anchors || [post.planetId]).map((pid) => {
            const cfg = planetConfigManager.getConfig(pid);
            return String((cfg && cfg.name) || pid).toUpperCase();
        }).join(' / ');
    },

    /** Every part a trading post could sell: [{ kind, id, item, faction }]. */
    getTradingPostPool() {
        const pool = [];
        const add = (kind, id, item) => {
            if (!item) return;
            pool.push({ kind: kind, id: id, item: item, faction: String(item.faction || '').toLowerCase() });
        };
        if (typeof weaponConfigManager !== 'undefined') {
            weaponConfigManager.getIds().forEach((id) => add('weapon', id, weaponConfigManager.getWeapon(id)));
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const byCluster = abilityConfigManager.getIdsByCluster();
            (byCluster.defense || []).forEach((id) => add('defense', id, abilityConfigManager.getAbility(id)));
            TRADING_POST_ABILITY_IDS.forEach((id) => add('ability', id, abilityConfigManager.getAbility(id)));
            add('energy', 'energy_core', abilityConfigManager.getAbility('energy_core'));
        }
        return pool;
    },

    /**
     * A post's fixed stock: the galaxy faction's parts plus a seeded pick of
     * other factions' and neutral parts, so each post sells a different mix.
     */
    getTradingPostStock(post) {
        if (!post) return [];
        const home = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
            ? String(planetConfigManager.getGalaxyFaction(post.galaxyId) || '').toLowerCase()
            : '';
        const seed = this.tradingPostHash(post.id + '|stock');
        const rank = (entry) => this.tradingPostHash(seed + '|' + entry.kind + ':' + entry.id);
        const pool = this.getTradingPostPool().sort((a, b) => rank(a) - rank(b));
        // Every faction active in the galaxy counts as local, so posts in
        // contested galaxies sell a wider mix of the warring factions.
        const present = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFactionIds)
            ? planetConfigManager.getGalaxyFactionIds(post.galaxyId)
            : [home];
        const isLocal = (e) => e.faction && present.indexOf(e.faction) !== -1;
        const local = pool.filter(isLocal).slice(0, present.length > 1 ? 6 : 4);
        const foreign = pool.filter((e) => e.faction && !isLocal(e)).slice(0, present.length > 1 ? 3 : 4);
        const neutral = pool.filter((e) => !e.faction).slice(0, 3);
        return local.concat(foreign, neutral);
    },

    /**
     * Economic profile of a post for the map card:
     * { stockValue, wealth, sells: { weapon: n, ... }, seeks: [resourceId] }.
     * Wealth is graded on the credit value of the stock; each post seeks two
     * materials, seeded from its id.
     */
    getTradingPostEconomy(post) {
        const stock = this.getTradingPostStock(post);
        const sells = {};
        let stockValue = 0;
        stock.forEach((e) => {
            sells[e.kind] = (sells[e.kind] || 0) + 1;
            if (typeof economyConfig === 'undefined') return;
            const cost = economyConfig.getPartCost(e.kind, e.item) || {};
            stockValue += Number(cost.credits) || (economyConfig.materialCostToCredits
                ? economyConfig.materialCostToCredits(cost) : 0);
        });
        const wealth = stockValue >= 6000 ? 'RICH' : (stockValue >= 5000 ? 'PROSPEROUS' : 'MODEST');
        const materials = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds.slice()
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const h = this.tradingPostHash((post && post.id) + '|seeks');
        const first = materials[h % materials.length];
        const rest = materials.filter((m) => m !== first);
        return {
            stockValue: Math.round(stockValue),
            wealth: wealth,
            sells: sells,
            seeks: [first, rest[(h >>> 4) % rest.length]]
        };
    },

    isPartInTradingPost(postId, kind, partId) {
        const post = this.getTradingPost(postId);
        if (!post || !this.isTradingPostUnlocked(post)) return false;
        return this.getTradingPostStock(post).some((e) => e.kind === kind && e.id === partId);
    },
});
