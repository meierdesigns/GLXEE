"use strict";

// Mission logbook: the start-menu story is the MAIN QUEST chain; sidequests are
// accepted at stations, planets, or the hangar board. Targets can be a known
// planet, a station on a planet, a planet you still have to locate, or a
// galaxy you still have to find.

extendClass(ProfileManager, {
    ensureMissionLog(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        if (!p.missionLog || typeof p.missionLog !== 'object') {
            p.missionLog = { main: null, side: [] };
        }
        if (!Array.isArray(p.missionLog.side)) p.missionLog.side = [];
        return p.missionLog;
    },

    getMissionLog(profile) {
        const p = profile || this.getActiveProfile();
        const log = this.ensureMissionLog(p);
        if (!log) return { main: null, side: [], active: null, currentMain: null };
        const main = log.main || null;
        const idx = main ? Math.max(0, Number(main.missionIndex) || 0) : 0;
        const currentMain = main && main.missions && main.missions[idx] ? main.missions[idx] : null;
        return {
            main: main,
            side: log.side.slice(),
            active: (p && p.activeMission) || null,
            currentMain: currentMain
        };
    },

    /**
     * Install the chosen start-profile story as the main quest and focus the
     * first step as activeMission.
     */
    setMainQuestFromStory(story, boundMissions, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || !story || !boundMissions || !boundMissions.length) return null;
        const log = this.ensureMissionLog(p);
        const missions = boundMissions.map((m, i) => Object.assign({}, m, {
            done: false,
            status: i === 0 ? 'active' : 'locked'
        }));
        log.main = {
            kitId: story.kitId || null,
            pathId: story.pathId || story.id,
            title: story.title,
            blurb: story.blurb || '',
            icon: story.icon || null,
            missionIndex: 0,
            missions: missions
        };
        this.focusMission(missions[0], { main: true }, p);
        this.save();
        return log.main;
    },

    /** Set profile.activeMission from a log entry (main step or sidequest). */
    focusMission(entry, opts, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || !entry) return null;
        this.materializeMainTarget(entry, p);
        const o = opts || {};
        const gid = entry.galaxyId || this.getCurrentGalaxyId(p);
        let reward = entry.reward;
        if (!reward && entry.planetId && this.getMissionReward) {
            const rw = this.getMissionReward(gid, entry.planetId, false, p);
            reward = (rw && rw.reward) || { credits: 60 };
        }
        p.activeMission = {
            galaxyId: gid,
            planetId: entry.planetId || null,
            stationId: entry.stationId || null,
            type: String(entry.type || 'PATROL').toUpperCase(),
            name: entry.name || entry.title || 'MISSION',
            reward: reward || { credits: 60 },
            story: !!o.main,
            main: !!o.main,
            side: !!o.side,
            sideId: o.side ? (entry.id || null) : null,
            storyPathId: entry.pathId || null,
            storyMissionId: entry.id || null,
            targetKind: entry.targetKind || 'planet',
            objective: entry.objective || '',
            hint: entry.hint || '',
            galaxyName: entry.galaxyName || '',
            planetName: entry.planetName || '',
            stationName: entry.stationName || ''
        };
        return p.activeMission;
    },

    /** Sidequest offers at the ship's current spot (station / planet / hangar). */
    getSideQuestOffers(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof planetConfigManager === 'undefined') return [];
        const gid = this.getCurrentGalaxyId(p);
        const loc = this.getShipLocation ? this.getShipLocation(gid, p) : null;
        const log = this.ensureMissionLog(p);
        const taken = {};
        (log.side || []).forEach((s) => { taken[s.id] = true; });
        if (p.activeMission && p.activeMission.sideId) taken[p.activeMission.sideId] = true;
        const seed = (Number(p.missionSeed) || 0) + '|' + (p.id || '') + '|' + gid;
        const offers = [];
        const push = (entry) => {
            if (!entry || taken[entry.id]) return;
            offers.push(entry);
        };

        if (loc && loc.kind === 'post') {
            const post = this.getTradingPost ? this.getTradingPost(loc.id) : null;
            if (post) {
                const anchor = post.planetId || (post.anchors && post.anchors[0]);
                const cfg = anchor ? planetConfigManager.getConfig(anchor) : null;
                const rw = anchor ? this.getMissionReward(gid, anchor, false, p) : { reward: { credits: 80 } };
                push({
                    id: 'side:station:' + post.id + ':' + ((this.missionHash(seed + '|st') % 7)),
                    name: 'DOCK BOUNTY',
                    type: 'PATROL',
                    source: 'station',
                    sourceName: post.name || 'STATION',
                    targetKind: 'station',
                    galaxyId: gid,
                    galaxyName: this.galaxyLabel(gid),
                    planetId: anchor || null,
                    planetName: cfg ? String(cfg.name || anchor).toUpperCase() : '',
                    stationId: post.id,
                    stationName: String(post.name || 'STATION').toUpperCase(),
                    objective: 'CLEAR A STAGE AT ' + String(post.name || 'STATION').toUpperCase() + '\'S ANCHOR',
                    hint: 'Docked here — the bounty is paid when you clear a stage on the station\'s planet.',
                    difficulty: (rw && rw.difficulty) || 'NORMAL',
                    reward: (rw && rw.reward) || { credits: 80 }
                });
                // Second offer: haul to another unlocked planet.
                const board = this.getMissionBoard(p).filter((m) => m.status !== 'locked' && m.planetId !== anchor);
                if (board.length) {
                    const pick = board[this.missionHash(seed + '|haul') % board.length];
                    push({
                        id: 'side:haul:' + post.id + ':' + pick.planetId,
                        name: 'FREIGHT RUN',
                        type: 'ESCORT',
                        source: 'station',
                        sourceName: post.name || 'STATION',
                        targetKind: 'planet',
                        galaxyId: gid,
                        galaxyName: this.galaxyLabel(gid),
                        planetId: pick.planetId,
                        planetName: pick.name,
                        objective: 'DELIVER TO ' + pick.name,
                        hint: 'Accepted at ' + String(post.name || 'station') + ' — fly to ' + pick.name + ' and clear a stage.',
                        difficulty: pick.difficulty,
                        reward: pick.reward
                    });
                }
            }
        } else if (loc && loc.kind === 'planet') {
            const pid = loc.id;
            const cfg = planetConfigManager.getConfig(pid) || {};
            const posts = (this.getTradingPosts(gid) || []).filter((t) =>
                t.planetId === pid || (t.anchors && t.anchors.indexOf(pid) >= 0));
            if (posts.length) {
                const post = posts[this.missionHash(seed + '|findst') % posts.length];
                const open = this.isTradingPostOpen ? this.isTradingPostOpen(post.id) : true;
                push({
                    id: 'side:findst:' + pid + ':' + post.id,
                    name: open ? 'STATION CALL' : 'FIND THE DOCK',
                    type: 'PATROL',
                    source: 'planet',
                    sourceName: String(cfg.name || pid).toUpperCase(),
                    targetKind: 'station',
                    galaxyId: gid,
                    galaxyName: this.galaxyLabel(gid),
                    planetId: post.planetId || pid,
                    planetName: String(cfg.name || pid).toUpperCase(),
                    stationId: post.id,
                    stationName: String(post.name || 'STATION').toUpperCase(),
                    objective: (open ? 'DOCK AT ' : 'LOCATE ') + String(post.name || 'STATION').toUpperCase(),
                    hint: open
                        ? 'A station hangs off this world — dock and clear its anchor stage.'
                        : 'Charts show a station near this world. Unlock/open it, then dock.',
                    difficulty: String(cfg.difficulty || 'NORMAL').toUpperCase(),
                    reward: (this.getMissionReward(gid, post.planetId || pid, false, p) || {}).reward || { credits: 70 }
                });
            }
            const remote = this.getMissionBoard(p).filter((m) => m.planetId !== pid && m.status !== 'locked');
            if (remote.length) {
                const pick = remote[this.missionHash(seed + '|scout') % remote.length];
                push({
                    id: 'side:scout:' + pid + ':' + pick.planetId,
                    name: 'LOCAL SCOUT',
                    type: pick.type || 'PATROL',
                    source: 'planet',
                    sourceName: String(cfg.name || pid).toUpperCase(),
                    targetKind: pick.status === 'available' ? 'planet' : 'find_planet',
                    galaxyId: gid,
                    galaxyName: this.galaxyLabel(gid),
                    planetId: pick.planetId,
                    planetName: pick.name,
                    objective: (pick.status === 'available' ? 'REACH ' : 'LOCATE ') + pick.name,
                    hint: 'Posted on ' + String(cfg.name || pid).toUpperCase() + '.',
                    difficulty: pick.difficulty,
                    reward: pick.reward
                });
            }
        }

        // Hangar board always offers one liberate / patrol as a sidequest.
        const board = this.getMissionBoard(p).filter((m) => m.status !== 'locked');
        if (board.length) {
            const pick = board[this.missionHash(seed + '|board') % board.length];
            push({
                id: 'side:board:' + pick.planetId,
                name: pick.type === 'PATROL' ? 'PATROL SWEEP' : 'LIBERATION',
                type: pick.type,
                source: 'board',
                sourceName: 'MISSION BOARD',
                targetKind: 'planet',
                galaxyId: gid,
                galaxyName: this.galaxyLabel(gid),
                planetId: pick.planetId,
                planetName: pick.name,
                objective: pick.type + ' ' + pick.name,
                hint: 'Hangar board contract.',
                difficulty: pick.difficulty,
                reward: pick.reward
            });
        }
        return offers.slice(0, 4);
    },

    galaxyLabel(galaxyId) {
        if (typeof planetConfigManager === 'undefined') return String(galaxyId || '').toUpperCase();
        const g = planetConfigManager.getGalaxy(galaxyId);
        return String((g && g.name) || galaxyId || '').replace(/_/g, ' ').toUpperCase();
    },

    acceptSideQuest(offerId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        const log = this.ensureMissionLog(p);
        const offer = this.getSideQuestOffers(p).find((o) => o.id === offerId);
        if (!offer) return null;
        if (log.side.length >= 5) return { ok: false, reason: 'LOG FULL' };
        if (log.side.some((s) => s.id === offer.id)) return { ok: false, reason: 'ALREADY TAKEN' };
        const entry = Object.assign({}, offer, { acceptedAt: Date.now() });
        log.side.push(entry);
        this.focusMission(entry, { side: true }, p);
        this.save();
        return { ok: true, quest: entry };
    },

    abandonSideQuest(sideId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return;
        const log = this.ensureMissionLog(p);
        log.side = (log.side || []).filter((s) => s.id !== sideId);
        if (p.activeMission && p.activeMission.sideId === sideId) {
            // Refocus main quest if any.
            const cur = this.getMissionLog(p).currentMain;
            if (cur) this.focusMission(cur, { main: true }, p);
            else p.activeMission = null;
        }
        this.save();
    },

    /** Track the current main-quest step (without abandoning sidequests). */
    trackMainQuest(profile) {
        const p = profile || this.getActiveProfile();
        const cur = this.getMissionLog(p).currentMain;
        if (!cur) return null;
        return this.focusMission(cur, { main: true }, p);
    },

    /** Pay reward and advance main / drop side. Returns the completed entry. */
    resolveMissionCompletion(planetId, profile) {
        const p = profile || this.getActiveProfile();
        const m = p && p.activeMission;
        if (!m || !(m.main || m.side || m.story)) return null;
        const pid = String(planetId || '').toLowerCase();
        // Station quests complete on their anchor planet.
        const targetPid = String(m.planetId || '').toLowerCase();
        if (!targetPid || targetPid !== pid) return null;

        if (!p.resources || typeof p.resources !== 'object') p.resources = {};
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

        const log = this.ensureMissionLog(p);
        if ((m.main || m.story) && log.main && log.main.missions) {
            const idx = Math.max(0, Number(log.main.missionIndex) || 0);
            if (log.main.missions[idx]) {
                log.main.missions[idx].done = true;
                log.main.missions[idx].status = 'done';
            }
            const next = idx + 1;
            if (next < log.main.missions.length) {
                log.main.missionIndex = next;
                log.main.missions[next].status = 'active';
                // Resolve find_galaxy targets now that the pilot may have arrived.
                this.materializeMainTarget(log.main.missions[next], p);
                this.focusMission(log.main.missions[next], { main: true }, p);
            } else {
                p.activeMission = null;
            }
        } else if (m.side && m.sideId) {
            log.side = (log.side || []).filter((s) => s.id !== m.sideId);
            const cur = this.getMissionLog(p).currentMain;
            if (cur && !cur.done) this.focusMission(cur, { main: true }, p);
            else p.activeMission = null;
        }

        p.missionSeed = (Number(p.missionSeed) || 0) + 1;
        p.missionsCompleted = (Number(p.missionsCompleted) || 0) + 1;
        this.save();
        return m;
    },

    /** Fill planetId for find_galaxy steps once the target galaxy has a map. */
    materializeMainTarget(entry, profile) {
        if (!entry || entry.planetId) return entry;
        if (entry.targetKind !== 'find_galaxy' || !entry.galaxyId) return entry;
        if (typeof planetConfigManager === 'undefined') return entry;
        const map = planetConfigManager.getGalaxyMap(entry.galaxyId) || {};
        const nodes = map.nodes || [];
        if (!nodes.length) return entry;
        const start = map.startPlanetId || nodes[0].planetId;
        const cfg = planetConfigManager.getConfig(start);
        entry.planetId = start;
        entry.planetName = String((cfg && cfg.name) || start).toUpperCase();
        entry.objective = 'REACH ' + entry.planetName + ' IN ' + (entry.galaxyName || this.galaxyLabel(entry.galaxyId));
        return entry;
    }
});

// Route main/side stage-clear payouts through the logbook; board/contracts keep legacy path.
(function wrapMissionLogCompletion() {
    const prev = ProfileManager.prototype.completeMissionFor;
    ProfileManager.prototype.completeMissionFor = function (planetId, profile) {
        const p = profile || this.getActiveProfile();
        const m = p && p.activeMission;
        if (m && (m.main || m.side || m.story) && typeof this.resolveMissionCompletion === 'function') {
            const paid = this.resolveMissionCompletion(planetId, profile);
            if (paid) return paid;
        }
        return typeof prev === 'function' ? prev.call(this, planetId, profile) : null;
    };
})();
