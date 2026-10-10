"use strict";

// ProfileManager methods: the hangar mission board. Missions are drawn from
// the planets of the ship's current galaxy — LIBERATE an unlocked planet that
// isn't cleared yet, or PATROL a cleared one again for half the bounty. One
// mission can be active; clearing any stage on its planet pays the bounty
// (see beginVictoryLootPhase) and rotates the board's offers.

const MISSION_BOUNTY_BY_DIFFICULTY = { EASY: 60, NORMAL: 110, HARD: 180, EXPERT: 260, NIGHTMARE: 360 };

extendClass(ProfileManager, {
    missionHash(text) {
        let h = 2166136261;
        const s = String(text || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    },

    /** Bounty for a planet: credits by difficulty plus one seeded material. */
    getMissionReward(galaxyId, planetId, patrol, profile) {
        const p = profile || this.getActiveProfile();
        const cfg = typeof planetConfigManager !== 'undefined' ? planetConfigManager.getConfig(planetId) : null;
        const diff = String((cfg && cfg.difficulty) || 'NORMAL').toUpperCase();
        const base = MISSION_BOUNTY_BY_DIFFICULTY[diff] || 110;
        const seed = this.missionHash(galaxyId + '|' + planetId + '|' + ((p && p.missionSeed) || 0));
        const mats = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds.slice() : ['scrap', 'ore', 'crystal', 'voltex'];
        const mat = mats[seed % mats.length];
        const scale = patrol ? 0.5 : 1;
        // ±20% so offers on the board differ a little each rotation.
        const jitter = 0.8 + ((seed >>> 8) % 41) / 100;
        const reward = { credits: Math.round(base * scale * jitter / 5) * 5 };
        reward[mat] = Math.max(2, Math.round((base / 12) * scale * jitter));
        return { difficulty: diff, reward: reward };
    },

    /** Mission entries for the current galaxy, available first. */
    getMissionBoard(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return [];
        const gid = this.getCurrentGalaxyId(p);
        const map = planetConfigManager.getGalaxyMap(gid) || {};
        const active = p.activeMission || null;
        const rank = { available: 0, patrol: 1, locked: 2 };
        return (map.nodes || [])
            .filter((n) => !(planetConfigManager.isEncounterPlanet && planetConfigManager.isEncounterPlanet(n.planetId)))
            .map((n) => {
                const pid = String(n.planetId).toLowerCase();
                const cfg = planetConfigManager.getConfig(pid) || {};
                const cleared = this.isPlanetCleared(gid, pid);
                const unlocked = cleared || this.isPlanetUnlocked(gid, pid);
                const status = cleared ? 'patrol' : (unlocked ? 'available' : 'locked');
                const stage = this.getPlanetStageState ? this.getPlanetStageState(gid, pid) : { highestStage: 0 };
                const rw = this.getMissionReward(gid, pid, status === 'patrol', p);
                return {
                    galaxyId: gid,
                    planetId: pid,
                    name: String(cfg.name || pid).toUpperCase(),
                    type: status === 'patrol' ? 'PATROL' : 'LIBERATE',
                    status: status,
                    difficulty: rw.difficulty,
                    stagesDone: Number(stage.highestStage) || 0,
                    stagesTotal: typeof getPlanetStageCount === 'function' ? getPlanetStageCount(pid) + 1 : 4,
                    reward: rw.reward,
                    active: !!(active && active.planetId === pid && active.galaxyId === gid)
                };
            })
            .sort((a, b) => (b.active - a.active) || (rank[a.status] - rank[b.status]));
    },

    acceptMission(planetId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        const entry = this.getMissionBoard(p).find((m) => m.planetId === String(planetId).toLowerCase());
        if (!entry || entry.status === 'locked') return null;
        p.activeMission = { galaxyId: entry.galaxyId, planetId: entry.planetId, type: entry.type, reward: entry.reward };
        this.save();
        return p.activeMission;
    },

    abandonMission(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return;
        p.activeMission = null;
        this.save();
    },

    /**
     * A stage on planetId was cleared: pay the active mission's bounty if it
     * targets that planet. Returns the paid mission, or null.
     */
    completeMissionFor(planetId, profile) {
        const p = profile || this.getActiveProfile();
        const m = p && p.activeMission;
        if (!m || m.planetId !== String(planetId || '').toLowerCase()) return null;
        if (!p.resources || typeof p.resources !== 'object') p.resources = {};
        // Credits are their own wallet (profile.credits); materials go to
        // the station stores.
        Object.keys(m.reward || {}).forEach((id) => {
            const n = Number(m.reward[id]) || 0;
            if (id.indexOf('part:weapon:') === 0) {
                const wid = id.slice(12);
                if (!p.parts || typeof p.parts !== 'object') p.parts = {};
                if (!p.parts.weapons || typeof p.parts.weapons !== 'object') p.parts.weapons = {};
                p.parts.weapons[wid] = (Number(p.parts.weapons[wid]) || 0) + Math.max(1, n);
            } else if (id === 'credits') p.credits = Math.max(0, Math.round(Number(p.credits) || 0) + n);
            else p.resources[id] = (Number(p.resources[id]) || 0) + n;
        });
        p.activeMission = null;
        p.missionSeed = (Number(p.missionSeed) || 0) + 1;
        p.missionsCompleted = (Number(p.missionsCompleted) || 0) + 1;
        this.save();
        return m;
    },
});
