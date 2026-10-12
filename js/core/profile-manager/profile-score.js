"use strict";

// ProfileManager: overall pilot score from the profile's stats, plus the
// "recently played" order used by the start-screen scoreboard.
extendClass(ProfileManager, {
    /** Point weights per stat; tune here. */
    scoreWeights: {
        planetCleared: 500,
        bossCleared: 750,
        stage: 60,
        galaxyDiscovered: 1000,
        shipOwned: 400,
        blueprint: 150,
        stationLevel: 120,
        moduleLevel: 40,
        credits: 0.5,
        resource: 1
    },

    /** Total score for a profile (active one by default). */
    getProfileScore(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        const w = this.scoreWeights;
        const num = (v) => Math.max(0, Number(v) || 0);
        let score = 0;

        const galaxies = (p.progress && p.progress.galaxies) || {};
        Object.keys(galaxies).forEach((gid) => {
            const gp = galaxies[gid] || {};
            score += (gp.clearedPlanetIds || []).length * w.planetCleared;
            const stages = gp.stages || {};
            Object.keys(stages).forEach((pid) => {
                const st = stages[pid] || {};
                score += num(st.highestStage) * w.stage;
                if (st.bossCleared) score += w.bossCleared;
            });
        });

        const disc = p.discovered && p.discovered.galaxies;
        const galaxyCount = Array.isArray(disc) ? disc.length
            : (disc && typeof disc === 'object') ? Object.keys(disc).length
            : Object.keys(galaxies).length;
        score += galaxyCount * w.galaxyDiscovered;

        score += (p.ownedShipIds || []).length * w.shipOwned;
        score += Object.keys(p.blueprints || {}).length * w.blueprint;

        const station = (p.homeStation && p.homeStation.upgrades) || {};
        Object.keys(station).forEach((id) => { score += num(station[id]) * w.stationLevel; });

        const mods = p.moduleUpgrades || {};
        Object.keys(mods).forEach((cat) => {
            const group = mods[cat] || {};
            Object.keys(group).forEach((id) => {
                const v = group[id];
                score += num(v && typeof v === 'object' ? v.level : v) * w.moduleLevel;
            });
        });

        score += num(p.credits) * w.credits;
        const res = p.resources || {};
        Object.keys(res).forEach((id) => { score += num(res[id]) * w.resource; });

        return Math.round(score);
    },

    /** Profiles by most recently played, newest first. */
    getRecentProfiles(limit) {
        const at = (p) => Number(p.lastPlayedAt) || Number(p.createdAt) || 0;
        const list = this.profiles.slice().sort((a, b) => at(b) - at(a));
        return limit ? list.slice(0, limit) : list;
    }
});
