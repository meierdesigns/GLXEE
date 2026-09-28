"use strict";

// Opening scenario: a pilot who starts in their faction's HOME galaxy finds it
// under attack. A hostile faction invades a planet next to the start planet:
//
//   profile.invasion = { galaxyId, planetId, attacker, defender, resolved }
//
// The planet is unlocked so it can be reached right away, it is marked on the
// galaxy map, the attacker is the main enemy faction there, and winning a
// stage on it repels the invasion (bounty paid once).

const INVASION_REWARD = { credits: 150, scrap: 60 };

extendClass(ProfileManager, {
    /** Active (unresolved) invasion of the current profile, or null. */
    getActiveInvasion(profile) {
        const p = profile || this.getActiveProfile();
        const inv = p && p.invasion;
        return inv && !inv.resolved ? inv : null;
    },

    /** Planet id under attack in a galaxy (active invasion only), or null. */
    getInvadedPlanetId(galaxyId) {
        const inv = this.getActiveInvasion();
        return inv && inv.galaxyId === String(galaxyId || '').toLowerCase() ? inv.planetId : null;
    },

    /**
     * Start the home-galaxy invasion for a new profile. Picks the attacker
     * (a galaxy rival, else any faction that is neither ours nor allied) and
     * the target (a planet linked to the start planet).
     */
    startInvasionScenario(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return null;
        const gid = String(galaxyId || '').toLowerCase();
        const own = String(p.faction || '').toLowerCase();
        const pcm = planetConfigManager;
        const allied = (f) => (pcm.areFactionsAllied ? pcm.areFactionsAllied(own, f) : f === own);
        const control = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
        const rivals = ((control && control.rivals) || []).filter((f) => !allied(f));
        const others = (pcm.availableFactions || []).filter((f) => !allied(f));
        const pool = rivals.length ? rivals : others;
        if (!pool.length) return null;
        const seed = pcm.hashSeed ? pcm.hashSeed('invasion|' + p.id + '|' + gid) : 1;
        const attacker = pool[seed % pool.length];

        const map = pcm.getGalaxyMap(gid) || {};
        const start = map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId);
        const neighbors = pcm.getGalaxyNeighbors ? pcm.getGalaxyNeighbors(gid, start) : [];
        const candidates = neighbors.length ? neighbors
            : (map.nodes || []).map((n) => n.planetId).filter((id) => id !== start);
        if (!candidates.length) return null;
        const planetId = candidates[(seed >>> 4) % candidates.length];

        p.invasion = {
            galaxyId: gid,
            planetId: planetId,
            attacker: attacker,
            defender: own,
            resolved: false,
            startedAt: Date.now()
        };
        if (this.ensureGalaxyProgress) this.ensureGalaxyProgress(p, gid);
        if (this.unlockPlanet) this.unlockPlanet(planetId);
        if (this.discoverFaction) this.discoverFaction(attacker);
        this.save();
        return p.invasion;
    },

    /** Won a stage on planetId: repel the invasion there. Returns the notice text or null. */
    resolveInvasion(planetId) {
        const p = this.getActiveProfile();
        const inv = this.getActiveInvasion(p);
        if (!inv || inv.planetId !== String(planetId || '').toLowerCase()) return null;
        inv.resolved = true;
        inv.resolvedAt = Date.now();
        if (!p.resources || typeof p.resources !== 'object') p.resources = {};
        Object.keys(INVASION_REWARD).forEach((k) => {
            const n = INVASION_REWARD[k];
            if (k === 'credits') p.credits = (Number(p.credits) || 0) + n;
            else p.resources[k] = (Number(p.resources[k]) || 0) + n;
        });
        this.save();
        return String(inv.attacker).toUpperCase() + ' INVASION REPELLED — +' + INVASION_REWARD.credits + ' CR';
    }
});

(function wrapInvasionHooks() {
    const pm = ProfileManager.prototype;

    // Winning a stage on the invaded planet repels the attack.
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

    // The invaded planet: attacker first (= the enemy faction fought there),
    // the defending faction second.
    if (typeof PlanetConfigManager === 'undefined') return;
    const proto = PlanetConfigManager.prototype;
    const baseFactions = proto.getPlanetFactions;
    proto.getPlanetFactions = function (planetId, raw) {
        const list = baseFactions.call(this, planetId, raw);
        if (raw || typeof profileManager === 'undefined' || !profileManager.getActiveInvasion) return list;
        const inv = profileManager.getActiveInvasion();
        if (!inv || inv.planetId !== String(planetId || '').toLowerCase()) return list;
        return [inv.attacker].concat(list.filter((f) => f !== inv.attacker));
    };
})();
