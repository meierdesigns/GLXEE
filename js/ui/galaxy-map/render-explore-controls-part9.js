"use strict";

// GalaxyMapManager members, continued from render-explore-controls.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
    explore() {
        if (typeof profileManager === 'undefined' || !profileManager.exploreGalaxyPlanet) {
            this.statusMsg = 'EXPLORE UNAVAILABLE';
            this.createUI();
            return;
        }
        const res = profileManager.exploreGalaxyPlanet(this.galaxyId);
        if (res.ok) {
            this.statusMsg = 'DISCOVERED: ' + (res.name || res.planetId);
            this.loadMap();
            this.selectedPlanetId = res.planetId;
            if (typeof this.onExplored === 'function') this.onExplored(res);
            this.createUI();
            return;
        }
        if (res.reason === 'BUDGET') this.statusMsg = 'EXPLORE BUDGET FULL — UPGRADE NAV COMPUTER';
        else if (res.reason === 'RESOURCES') this.statusMsg = 'NEED RESOURCES';
        else if (res.reason === 'DRIVE') this.statusMsg = 'NEED WARP DRIVE';
        else this.statusMsg = res.reason || 'EXPLORE FAILED';
        this.createUI();
    },
});
