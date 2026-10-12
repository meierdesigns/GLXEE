"use strict";

// Invasion scenarios. A pilot who starts in their faction's HOME galaxy finds
// it under attack: a hostile faction invades a planet next to the start
// planet. Galaxies ruled by an ALLY of the pilot's faction are attacked too —
// by a common enemy — and the pilot comes to defend them:
//
//   profile.invasion       = { galaxyId, planetId, attacker, defender, resolved }
//   profile.allyInvasions  = { [galaxyId]: same shape, ally: true }
//
// The planet is unlocked so it can be reached right away, it is marked on the
// galaxy map, everyone fighting there is the attacker, and winning a stage on
// it repels the invasion (bounty paid once).

const INVASION_REWARD = { credits: 150, scrap: 60 };
// Defending an ally pays more and raises reputation with the ally.
const ALLY_DEFENSE_REWARD = { credits: 220, scrap: 80 };
const ALLY_DEFENSE_REP = 15;

extendClass(ProfileManager, {
    /** All invasions of a profile (home + ally defenses), resolved ones included. */
    getAllInvasions(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return [];
        const out = p.invasion ? [p.invasion] : [];
        const allies = p.allyInvasions && typeof p.allyInvasions === 'object' ? p.allyInvasions : {};
        Object.keys(allies).forEach((gid) => { if (allies[gid]) out.push(allies[gid]); });
        return out;
    },

    /**
     * Active (unresolved) invasion. With a galaxy id: the one in that galaxy;
     * without: the home invasion (opening scenario).
     */
    getActiveInvasion(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        if (galaxyId == null) {
            const inv = p.invasion;
            return inv && !inv.resolved ? inv : null;
        }
        const gid = String(galaxyId).toLowerCase();
        return this.getAllInvasions(p).find((inv) => !inv.resolved && inv.galaxyId === gid) || null;
    },

    /** Active invasion on a planet, or null. */
    getInvasionForPlanet(planetId, profile) {
        const pid = String(planetId || '').toLowerCase();
        return this.getAllInvasions(profile).find((inv) => !inv.resolved && inv.planetId === pid) || null;
    },

    /** Planet id under attack in a galaxy (active invasion only), or null. */
    getInvadedPlanetId(galaxyId) {
        const inv = this.getActiveInvasion(null, galaxyId);
        return inv ? inv.planetId : null;
    },

    /**
     * Seeded attacker and target for an invasion of galaxyId. The attacker is
     * hostile to the pilot and to the defender (a galaxy rival when possible);
     * the target is a planet linked to the start planet.
     */
    pickInvasion(p, gid, defender, salt) {
        const pcm = planetConfigManager;
        const own = String(p.faction || '').toLowerCase();
        const allied = (a, f) => (pcm.areFactionsAllied ? pcm.areFactionsAllied(a, f) : f === a);
        const hostile = (f) => !allied(own, f) && !allied(defender, f);
        const control = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
        const rivals = ((control && control.rivals) || []).filter(hostile);
        const others = (pcm.availableFactions || []).filter(hostile);
        const pool = rivals.length ? rivals : others;
        if (!pool.length) return null;
        const seed = pcm.hashSeed ? pcm.hashSeed(salt + '|' + p.id + '|' + gid) : 1;
        const attacker = pool[seed % pool.length];

        const map = pcm.getGalaxyMap(gid) || {};
        const start = map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId);
        const neighbors = pcm.getGalaxyNeighbors ? pcm.getGalaxyNeighbors(gid, start) : [];
        const candidates = neighbors.length ? neighbors
            : (map.nodes || []).map((n) => n.planetId).filter((id) => id !== start);
        if (!candidates.length) return null;
        return {
            galaxyId: gid,
            planetId: candidates[(seed >>> 4) % candidates.length],
            attacker: attacker,
            defender: defender,
            resolved: false,
            startedAt: Date.now()
        };
    },

    /** Unlock, discover and save a freshly picked invasion. */
    openInvasion(p, inv) {
        if (this.ensureGalaxyProgress) this.ensureGalaxyProgress(p, inv.galaxyId);
        if (this.unlockPlanet) this.unlockPlanet(inv.planetId);
        if (this.discoverFaction) this.discoverFaction(inv.attacker);
        this.save();
        return inv;
    },

    /** Start the home-galaxy invasion for a new profile. */
    startInvasionScenario(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return null;
        const gid = String(galaxyId || '').toLowerCase();
        const own = String(p.faction || '').toLowerCase();
        const inv = this.pickInvasion(p, gid, own, 'invasion');
        if (!inv) return null;
        p.invasion = inv;
        return this.openInvasion(p, inv);
    },

    /**
     * Ally defense: a galaxy ruled by an ally of the pilot's faction is
     * attacked by a common enemy, once per galaxy. Needs the galaxy's map,
     * so it runs when the galaxy is reached. Returns the invasion or null.
     */
    ensureAllyDefense(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return null;
        const pcm = planetConfigManager;
        const gid = String(galaxyId || '').toLowerCase();
        const own = String(p.faction || '').toLowerCase();
        const ruler = pcm.getGalaxyFaction ? String(pcm.getGalaxyFaction(gid) || '').toLowerCase() : '';
        if (!own || !ruler || ruler === own || !pcm.areFactionsAllied || !pcm.areFactionsAllied(own, ruler)) return null;
        if (!p.allyInvasions || typeof p.allyInvasions !== 'object') p.allyInvasions = {};
        if (p.allyInvasions[gid]) return p.allyInvasions[gid].resolved ? null : p.allyInvasions[gid];
        const map = pcm.getGalaxyMap(gid) || {};
        if (!(map.nodes && map.nodes.length)) return null;
        const inv = this.pickInvasion(p, gid, ruler, 'ally-defense');
        if (!inv) return null;
        inv.ally = true;
        p.allyInvasions[gid] = inv;
        return this.openInvasion(p, inv);
    },

    /** Won a stage on planetId: repel the invasion there. Returns the notice text or null. */
    resolveInvasion(planetId) {
        const p = this.getActiveProfile();
        const inv = this.getInvasionForPlanet(planetId, p);
        if (!inv) return null;
        inv.resolved = true;
        inv.resolvedAt = Date.now();
        const reward = inv.ally ? ALLY_DEFENSE_REWARD : INVASION_REWARD;
        if (!p.resources || typeof p.resources !== 'object') p.resources = {};
        Object.keys(reward).forEach((k) => {
            const n = reward[k];
            if (k === 'credits') p.credits = (Number(p.credits) || 0) + n;
            else p.resources[k] = (Number(p.resources[k]) || 0) + n;
        });
        if (inv.ally && typeof factionManager !== 'undefined' && factionManager.addReputation) {
            factionManager.addReputation(inv.defender, ALLY_DEFENSE_REP);
        }
        this.save();
        return inv.ally
            ? String(inv.defender).toUpperCase() + ' DEFENDED FROM ' + String(inv.attacker).toUpperCase() + ' — +' + reward.credits + ' CR'
            : String(inv.attacker).toUpperCase() + ' INVASION REPELLED — +' + reward.credits + ' CR';
    }
});

(function wrapInvasionHooks() {
    const pm = ProfileManager.prototype;

    // Winning a stage on an invaded planet repels the attack.
    const baseMark = pm.markStageCleared;
    pm.markStageCleared = function (planetId, stageKey) {
        const res = baseMark.apply(this, arguments);
        try {
            const news = this.resolveInvasion(planetId);
            if (news && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                levelInfoManager.showLootNotice(news);
            }
        } catch (e) { /* never break progress saving */ }
        return res;
    };

    // Reaching an ally's galaxy: it is under attack by a common enemy.
    const baseDiscover = pm.discoverGalaxy;
    if (typeof baseDiscover === 'function') {
        pm.discoverGalaxy = function (galaxyId) {
            const res = baseDiscover.apply(this, arguments);
            try { this.ensureAllyDefense(galaxyId); } catch (e) { /* never break travel */ }
            return res;
        };
    }

    // An invaded planet: attacker first (= the enemy faction fought there),
    // the defending faction second.
    if (typeof PlanetConfigManager === 'undefined') return;
    const proto = PlanetConfigManager.prototype;
    const baseFactions = proto.getPlanetFactions;
    proto.getPlanetFactions = function (planetId, raw) {
        const list = baseFactions.call(this, planetId, raw);
        if (raw || typeof profileManager === 'undefined' || !profileManager.getInvasionForPlanet) return list;
        const inv = profileManager.getInvasionForPlanet(planetId);
        if (!inv) return list;
        return [inv.attacker].concat(list.filter((f) => f !== inv.attacker));
    };
})();
