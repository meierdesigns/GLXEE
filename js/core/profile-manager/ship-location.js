"use strict";

// ProfileManager methods: where the player's ship sits on each galaxy map.
// A location is { kind: 'planet' | 'post', id }. Missions start and trading
// posts open only at the current location — the ship must fly there first.

extendClass(ProfileManager, {
    getShipLocation(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        const gid = String(galaxyId || '').toLowerCase();
        const stored = p && p.shipLocations && p.shipLocations[gid];
        if (stored && stored.kind && stored.id) return stored;
        const map = (typeof planetConfigManager !== 'undefined') ? planetConfigManager.getGalaxyMap(gid) : null;
        const startId = map && map.startPlanetId;
        return startId ? { kind: 'planet', id: startId } : null;
    },

    setShipLocation(galaxyId, kind, id) {
        const p = this.getActiveProfile();
        if (!p) return;
        if (!p.shipLocations) p.shipLocations = {};
        const gid = String(galaxyId || '').toLowerCase();
        p.shipLocations[gid] = { kind: kind, id: id };
        if (kind === 'planet') this.markPlanetVisited(gid, id, p);
        this.save();
    },

    /** Planets the ship has flown to per galaxy (opens nearby trading posts). */
    markPlanetVisited(galaxyId, planetId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || !planetId) return;
        if (!p.visitedPlanets) p.visitedPlanets = {};
        const gid = String(galaxyId || '').toLowerCase();
        const list = p.visitedPlanets[gid] || (p.visitedPlanets[gid] = []);
        if (list.indexOf(planetId) === -1) list.push(planetId);
    },

    hasVisitedPlanet(galaxyId, planetId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        const gid = String(galaxyId || '').toLowerCase();
        const list = p.visitedPlanets && p.visitedPlanets[gid];
        if (list && list.indexOf(planetId) !== -1) return true;
        // The ship's current (or default start) spot counts as reached.
        const loc = this.getShipLocation(gid, p);
        return !!(loc && loc.kind === 'planet' && loc.id === planetId);
    },

    isShipAt(galaxyId, kind, id) {
        const loc = this.getShipLocation(galaxyId);
        return !!(loc && loc.kind === kind && loc.id === id);
    },
});
