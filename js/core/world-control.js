"use strict";

// Shared world: galaxies are global, and so is who holds them.
//
//   galaxy.owners[planetId] = { faction, pilot, at }
//
// A pilot clearing a planet claims it for their faction (the latest clear
// wins). A faction holding more than half of a galaxy's planets becomes its
// ruler for every pilot; the old ruler fights on as a rival (CONTESTED). A
// non-allied faction holding any planet joins the rivals. Saved with the
// galaxies (add-planet.js saveGalaxies / loadGalaxies).

extendClass(PlanetConfigManager, {
    /** Galaxy whose map holds the planet (planetIds can hold strays). */
    getWorldGalaxyOfPlanet(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const cfg = this.configs[pid];
        if (cfg && cfg.galaxyId && this.galaxies[cfg.galaxyId]) return cfg.galaxyId;
        for (const gid of this.getGalaxyIds()) {
            const map = this.getGalaxyMap(gid) || {};
            if ((map.nodes || []).some((n) => n.planetId === pid)) return gid;
        }
        return null;
    },

    getPlanetOwner(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const gid = this.getWorldGalaxyOfPlanet(pid);
        const g = gid && this.galaxies[gid];
        return (g && g.owners && g.owners[pid]) || null;
    },

    /** { total, byFaction: { id: n } } over the galaxy's map planets. */
    getGalaxyOwnership(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        const nodes = ((this.getGalaxyMap(galaxyId) || {}).nodes || []);
        const byFaction = {};
        nodes.forEach((n) => {
            const o = g && g.owners && g.owners[n.planetId];
            if (o) byFaction[o.faction] = (byFaction[o.faction] || 0) + 1;
        });
        return { total: nodes.length, byFaction };
    },

    claimPlanet(planetId, faction, pilot, options) {
        const pid = String(planetId || '').toLowerCase();
        const fid = this.normalizeGalaxyFaction(faction);
        const gid = this.getWorldGalaxyOfPlanet(pid);
        if (!gid || !fid) return false;
        const g = this.galaxies[gid];
        if (!g.owners || typeof g.owners !== 'object') g.owners = {};
        g.owners[pid] = { faction: fid, pilot: String(pilot || ''), at: (options && options.at) || Date.now() };
        this.recomputeGalaxyRule(gid);
        if (!options || options.save !== false) this.saveGalaxies();
        return true;
    },

    releasePlanet(planetId) {
        const pid = String(planetId || '').toLowerCase();
        const gid = this.getWorldGalaxyOfPlanet(pid);
        const g = gid && this.galaxies[gid];
        if (!g || !g.owners || !g.owners[pid]) return false;
        delete g.owners[pid];
        this.recomputeGalaxyRule(gid);
        this.saveGalaxies();
        return true;
    },

    recomputeGalaxyRule(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return;
        this.ensureGalaxyControl(g);
        const { total, byFaction } = this.getGalaxyOwnership(galaxyId);
        let rivals = (g.rivals || []).slice();
        let main = g.faction;
        const top = Object.keys(byFaction).sort((a, b) => byFaction[b] - byFaction[a])[0];
        if (top && top !== main && byFaction[top] * 2 > total) {
            if (!g.originalFaction) g.originalFaction = main;
            rivals = [main].concat(rivals);
            main = top;
        }
        // Every non-allied faction holding ground here fights for it.
        Object.keys(byFaction).forEach((f) => {
            if (f !== main && rivals.indexOf(f) === -1) rivals.push(f);
        });
        g.faction = main;
        g.rivals = rivals.filter((f, i, arr) => f !== main && arr.indexOf(f) === i && !this.areFactionsAllied(main, f));
        g.control = g.rivals.length ? 'contested' : 'held';
        if (typeof GALAXY_CONTROL_REV !== 'undefined') g.controlRev = GALAXY_CONTROL_REV;
        g.worldControl = true;
    },

    /**
     * Fills owners from every profile's cleared planets that nobody holds
     * yet (saves made before the shared world).
     */
    syncWorldFromProfiles() {
        if (typeof profileManager === 'undefined' || !profileManager.getProfiles) return;
        let changed = false;
        profileManager.getProfiles().forEach((p) => {
            const gals = (p.progress && p.progress.galaxies) || {};
            Object.keys(gals).forEach((gid) => {
                (gals[gid].clearedPlanetIds || []).forEach((pid) => {
                    if (this.getPlanetOwner(pid)) return;
                    if (this.claimPlanet(pid, p.faction, p.name, { save: false, at: p.lastPlayed || 0 })) changed = true;
                });
            });
        });
        if (changed) this.saveGalaxies();
    }
});

// A cleared planet goes to the pilot's faction; un-clearing (dev toggle) frees it.
(function () {
    const proto = ProfileManager.prototype;
    const baseMark = proto.markPlanetCleared;
    proto.markPlanetCleared = function (planetId) {
        const res = baseMark.apply(this, arguments);
        const p = this.getActiveProfile();
        if (p && typeof planetConfigManager !== 'undefined' && planetConfigManager.claimPlanet) {
            planetConfigManager.claimPlanet(planetId, p.faction, p.name);
        }
        return res;
    };
    const baseUnmark = proto.unmarkPlanetCleared;
    proto.unmarkPlanetCleared = function (planetId) {
        const res = baseUnmark.apply(this, arguments);
        const o = typeof planetConfigManager !== 'undefined' ? planetConfigManager.getPlanetOwner(planetId) : null;
        const p = this.getActiveProfile();
        if (o && p && o.pilot === p.name) planetConfigManager.releasePlanet(planetId);
        return res;
    };
})();

window.addEventListener('load', () => {
    try { planetConfigManager.syncWorldFromProfiles(); } catch (e) { console.warn('world sync failed', e); }
});
