"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    /**
     * Next stage to play for a planet based on saved progress.
     * Plain planet ids (mars) resume after the highest cleared stage.
     */
    getResumeLevelId(planetId) {
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        if (!pid) return null;

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        const stagesPerPlanet = (typeof game !== 'undefined'
            && game.levelManager
            && game.levelManager.stagesPerPlanet)
            || (typeof gameCore !== 'undefined'
                && gameCore.levelManager
                && gameCore.levelManager.stagesPerPlanet)
            || 3;
        const st = galaxyId
            ? this.getPlanetStageState(galaxyId, pid)
            : { highestStage: 0, bossCleared: false };

        if (st.bossCleared) {
            return `${pid}-1`;
        }
        const highest = Math.max(0, Math.round(Number(st.highestStage) || 0));
        if (highest >= stagesPerPlanet) {
            return `${pid}-boss`;
        }
        if (highest > 0) {
            return `${pid}-${highest + 1}`;
        }
        return `${pid}-1`;
    },

    /**
     * Start options for planet select: from stage 1, or continue at saved progress.
     * canChoose is true when mid-planet progress exists (not cleared, highestStage > 0).
     */
    getPlanetStartOptions(planetId) {
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        if (!pid) {
            return {
                canChoose: false,
                startLevelId: null,
                resumeLevelId: null,
                resumeLabel: 'STAGE 1'
            };
        }

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        const stagesPerPlanet = (typeof game !== 'undefined'
            && game.levelManager
            && game.levelManager.stagesPerPlanet)
            || (typeof gameCore !== 'undefined'
                && gameCore.levelManager
                && gameCore.levelManager.stagesPerPlanet)
            || 3;
        const st = galaxyId
            ? this.getPlanetStageState(galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const highest = Math.max(0, Math.round(Number(st.highestStage) || 0));
        const resumeLevelId = this.getResumeLevelId(pid) || `${pid}-1`;
        let resumeLabel = 'STAGE 1';
        if (st.bossCleared) {
            resumeLabel = 'STAGE 1';
        } else if (highest >= stagesPerPlanet) {
            resumeLabel = 'BOSS';
        } else if (highest > 0) {
            resumeLabel = `STAGE ${highest + 1}`;
        }

        return {
            canChoose: !st.bossCleared && highest > 0,
            startLevelId: `${pid}-1`,
            resumeLevelId,
            resumeLabel
        };
    },

    markStageCleared(planetId, stageKey) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;

        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        if (!gp.stages[pid]) {
            gp.stages[pid] = { highestStage: 0, bossCleared: false };
        }
        const st = gp.stages[pid];
        const key = String(stageKey || '1').toLowerCase();
        if (key === 'boss') {
            st.bossCleared = true;
            this.markPlanetCleared(pid);
            return true;
        }
        const num = parseInt(key, 10);
        if (!Number.isNaN(num) && num > (st.highestStage || 0)) {
            st.highestStage = num;
        }
        if (gp.unlockedPlanetIds.indexOf(pid) === -1) {
            gp.unlockedPlanetIds.push(pid);
        }
        this.save();
        return true;
    },

    markPlanetCleared(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;

        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        if (gp.clearedPlanetIds.indexOf(pid) === -1) {
            gp.clearedPlanetIds.push(pid);
        }
        if (gp.unlockedPlanetIds.indexOf(pid) === -1) {
            gp.unlockedPlanetIds.push(pid);
        }
        if (!gp.stages[pid]) {
            gp.stages[pid] = { highestStage: 3, bossCleared: true };
        } else {
            gp.stages[pid].bossCleared = true;
        }

        // Unlock neighbors along graph edges
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyNeighbors) {
            const neighbors = planetConfigManager.getGalaxyNeighbors(galaxyId, pid);
            neighbors.forEach(nid => {
                if (gp.unlockedPlanetIds.indexOf(nid) === -1) {
                    gp.unlockedPlanetIds.push(nid);
                }
            });
        }

        this.discover('planets', pid);
        this.save();
        return true;
    },

    unlockPlanet(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        if (gp.unlockedPlanetIds.indexOf(pid) === -1) {
            gp.unlockedPlanetIds.push(pid);
        }
        this.discover('planets', pid);
        this.save();
        return true;
    },

    lockPlanet(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const uIdx = gp.unlockedPlanetIds.indexOf(pid);
        if (uIdx !== -1) gp.unlockedPlanetIds.splice(uIdx, 1);
        const cIdx = gp.clearedPlanetIds.indexOf(pid);
        if (cIdx !== -1) gp.clearedPlanetIds.splice(cIdx, 1);
        if (gp.stages && gp.stages[pid]) delete gp.stages[pid];
        this.undiscover('planets', pid);
        this.save();
        return true;
    },

    togglePlanetVisited(planetId) {
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(planetId);
        }
        if (!galaxyId) return false;
        if (this.isPlanetUnlocked(galaxyId, planetId) || this.isPlanetCleared(galaxyId, planetId)) {
            this.lockPlanet(planetId);
            return false;
        }
        this.unlockPlanet(planetId);
        return true;
    },

    unmarkPlanetCleared(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const cIdx = gp.clearedPlanetIds.indexOf(pid);
        if (cIdx !== -1) gp.clearedPlanetIds.splice(cIdx, 1);
        if (gp.stages && gp.stages[pid]) {
            gp.stages[pid].bossCleared = false;
        }
        this.save();
        return true;
    },

    togglePlanetCleared(planetId) {
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(planetId);
        }
        if (!galaxyId) return false;
        if (this.isPlanetCleared(galaxyId, planetId)) {
            this.unmarkPlanetCleared(planetId);
            return false;
        }
        this.markPlanetCleared(planetId);
        return true;
    },
});
