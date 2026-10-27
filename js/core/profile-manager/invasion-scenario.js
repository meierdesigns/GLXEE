"use strict";

// Invasion scenarios. A pilot who starts in their faction's HOME galaxy gets a
// few nearby planets unlocked for travel; UNDER ATTACK begins only after they
// clear their first stage there (profile.invasionPending until then). Galaxies
// ruled by an ALLY are attacked when first reached — by a common enemy — and
// the pilot comes to defend them:
//
//   profile.invasionPending = { galaxyId }   // home invasion armed, not yet live
//   profile.invasion        = { galaxyId, planetId, attacker, defender, resolved }
//   profile.allyInvasions   = { [galaxyId]: same shape, ally: true }
//
// The invaded planet is unlocked when the attack starts, it is marked on the
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

    /** True once any stage (or boss) has been cleared in this galaxy. */
    hasClearedAnyStageInGalaxy(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p || !this.ensureGalaxyProgress) return false;
        const gp = this.ensureGalaxyProgress(p, galaxyId);
        if (!gp || !gp.stages) return false;
        return Object.keys(gp.stages).some((pid) => {
            const st = gp.stages[pid];
            return !!(st && ((Number(st.highestStage) || 0) > 0 || st.bossCleared));
        }) || ((gp.clearedPlanetIds || []).length > 0);
    },

    /** True once any stage (or boss) has been cleared in any galaxy. */
    hasClearedAnyStage(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || !p.progress || !p.progress.galaxies) return false;
        return Object.keys(p.progress.galaxies).some((gid) => this.hasClearedAnyStageInGalaxy(p, gid));
    },

    /** True once the pilot's starting planet (first planet) is fully cleared, boss included. */
    hasClearedFirstPlanet(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined' || !this.getPlanetStageState) return false;
        const galaxyId = (p.homeStation && p.homeStation.currentGalaxyId) || 'milky_way';
        const map = planetConfigManager.getGalaxyMap(galaxyId) || {};
        const g = planetConfigManager.getGalaxy(galaxyId) || {};
        const firstPlanetId = map.startPlanetId
            || (map.nodes && map.nodes[0] && map.nodes[0].planetId)
            || (g.planetIds && g.planetIds[0])
            || null;
        if (!firstPlanetId) return false;
        const st = this.getPlanetStageState(galaxyId, firstPlanetId);
        return !!(st && st.bossCleared);
    },

    /**
     * Active (unresolved) invasion. With a galaxy id: the one in that galaxy;
     * without: the home invasion (opening scenario).
     * Home UNDER ATTACK stays hidden until the pilot has cleared a stage there.
     */
    getActiveInvasion(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        const ready = (inv) => {
            if (!inv || inv.resolved) return null;
            // Ally defenses show on arrival; home invasion waits for a stage win.
            if (!inv.ally && !this.hasClearedAnyStageInGalaxy(p, inv.galaxyId)) return null;
            return inv;
        };
        if (galaxyId == null) return ready(p.invasion);
        const gid = String(galaxyId).toLowerCase();
        return ready(this.getAllInvasions(p).find((inv) => !inv.resolved && inv.galaxyId === gid) || null);
    },

    /** Active invasion on a planet, or null (same stage gate as getActiveInvasion). */
    getInvasionForPlanet(planetId, profile) {
        const p = profile || this.getActiveProfile();
        const pid = String(planetId || '').toLowerCase();
        const inv = this.getAllInvasions(p).find((i) => !i.resolved && i.planetId === pid) || null;
        if (!inv) return null;
        if (!inv.ally && !this.hasClearedAnyStageInGalaxy(p, inv.galaxyId)) return null;
        return inv;
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

    /** True when the galaxy is the faction home or ruled by the pilot's faction. */
    isOwnFactionGalaxy(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return false;
        const gid = String(galaxyId || '').toLowerCase();
        const own = String(p.faction || '').toLowerCase();
        if (!gid || !own) return false;
        const pcm = planetConfigManager;
        const meta = pcm.getFactionMeta ? pcm.getFactionMeta(own) : null;
        if (meta && String(meta.homeGalaxy || '').toLowerCase() === gid) return true;
        const ruler = pcm.getGalaxyFaction ? String(pcm.getGalaxyFaction(gid) || '').toLowerCase() : '';
        return !!(ruler && ruler === own);
    },

    /**
     * Own-faction start: unlock the start planet and a few neighbours so the
     * pilot can travel before anything is cleared.
     */
    unlockOwnFactionStartCluster(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined' || !this.isOwnFactionGalaxy(p, galaxyId)) return [];
        const pcm = planetConfigManager;
        const gid = String(galaxyId || '').toLowerCase();
        const map = pcm.getGalaxyMap(gid) || {};
        const start = map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId);
        if (!start) return [];
        const want = 4;
        const out = [];
        const seen = Object.create(null);
        const queue = [String(start).toLowerCase()];
        while (queue.length && out.length < want) {
            const id = queue.shift();
            if (!id || seen[id]) continue;
            seen[id] = true;
            out.push(id);
            (pcm.getGalaxyNeighbors ? pcm.getGalaxyNeighbors(gid, id) : []).forEach((n) => {
                const nid = String(n || '').toLowerCase();
                if (nid && !seen[nid]) queue.push(nid);
            });
        }
        const gp = this.ensureGalaxyProgress ? this.ensureGalaxyProgress(p, gid) : null;
        out.forEach((pid) => {
            if (gp && gp.unlockedPlanetIds.indexOf(pid) === -1) gp.unlockedPlanetIds.push(pid);
            if (this.discover) this.discover('planets', pid);
        });
        this.save();
        return out;
    },

    /** Unlock, discover and save a freshly picked invasion. */
    openInvasion(p, inv) {
        if (this.ensureGalaxyProgress) this.ensureGalaxyProgress(p, inv.galaxyId);
        if (this.unlockPlanet) this.unlockPlanet(inv.planetId);
        if (this.discoverFaction) this.discoverFaction(inv.attacker);
        this.save();
        return inv;
    },

    /** Arm the home-galaxy invasion; it goes live after the first stage clear. */
    scheduleHomeInvasion(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return false;
        // Strip a premature live invasion (older creates) so the map stays clear.
        if (p.invasion && !p.invasion.resolved && String(p.invasion.galaxyId || '').toLowerCase() === gid
            && !this.hasClearedAnyStageInGalaxy(p, gid)) {
            delete p.invasion;
        }
        if (p.invasion && !p.invasion.resolved) return false;
        p.invasionPending = { galaxyId: gid };
        this.save();
        return true;
    },

    /** After a stage clear in the pending home galaxy: start UNDER ATTACK. */
    tryStartPendingInvasion(planetId) {
        const p = this.getActiveProfile();
        if (!p || !p.invasionPending || (p.invasion && !p.invasion.resolved)) return null;
        const gid = String(p.invasionPending.galaxyId || '').toLowerCase();
        if (!gid) { delete p.invasionPending; return null; }
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetGalaxyId) {
            const planetGid = String(planetConfigManager.getPlanetGalaxyId(planetId) || '').toLowerCase();
            if (planetGid && planetGid !== gid) return null;
        }
        delete p.invasionPending;
        const inv = this.startInvasionScenario(p, gid);
        if (inv && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            const where = String(inv.planetId || '').replace(/_/g, ' ').toUpperCase();
            levelInfoManager.showLootNotice(String(inv.attacker).toUpperCase() + ' INVADES ' + where + ' — UNDER ATTACK');
        }
        return inv;
    },

    /** Start the home-galaxy invasion for a profile (live UNDER ATTACK). */
    startInvasionScenario(profile, galaxyId) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return null;
        const gid = String(galaxyId || '').toLowerCase();
        const own = String(p.faction || '').toLowerCase();
        if (p.invasionPending && String(p.invasionPending.galaxyId || '').toLowerCase() === gid) {
            delete p.invasionPending;
        }
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

    // First stage in the home galaxy can arm UNDER ATTACK; a win on the
    // invaded planet then repels it.
    const baseMark = pm.markStageCleared;
    pm.markStageCleared = function (planetId, stageKey) {
        const res = baseMark.apply(this, arguments);
        try {
            if (this.tryStartPendingInvasion) this.tryStartPendingInvasion(planetId);
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
