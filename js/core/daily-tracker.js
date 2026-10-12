"use strict";

/**
 * Per-planet daily kill challenges (localStorage).
 * Kill N of type X each calendar day for requiredDays consecutive days.
 */
class DailyTracker {
    constructor() {
        this.storageKey = 'vf_daily_progress_v1';
        this.progress = {};
        this.load();
    }

    todayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    yesterdayKey() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                this.progress = {};
                return;
            }
            const parsed = JSON.parse(raw);
            this.progress = parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            this.progress = {};
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.progress));
        } catch (e) {
            console.warn('DailyTracker: save failed', e);
        }
    }

    getPlanetState(planetId) {
        const id = String(planetId || 'mars').toLowerCase();
        if (!this.progress[id]) {
            this.progress[id] = {
                currentDay: this.todayKey(),
                todayKills: 0,
                completedDays: 0,
                lastCompletedDay: null,
                finished: false
            };
        }
        return this.progress[id];
    }

    ensureDay(planetId) {
        const state = this.getPlanetState(planetId);
        const today = this.todayKey();
        if (state.currentDay === today) return state;

        // New calendar day: if previous day wasn't completed and streak expected, break
        if (state.lastCompletedDay && state.lastCompletedDay !== this.yesterdayKey() && state.lastCompletedDay !== today) {
            if (!state.finished) {
                state.completedDays = 0;
            }
        } else if (state.currentDay !== today && state.lastCompletedDay !== state.currentDay && !state.finished) {
            // Missed completing yesterday
            if (state.currentDay !== this.yesterdayKey() || state.lastCompletedDay !== this.yesterdayKey()) {
                // Only reset if we skipped a day without completing it
                const yesterday = this.yesterdayKey();
                if (state.lastCompletedDay !== yesterday && state.currentDay !== yesterday) {
                    state.completedDays = 0;
                } else if (state.currentDay === yesterday && state.lastCompletedDay !== yesterday) {
                    state.completedDays = 0;
                }
            }
        }

        state.currentDay = today;
        state.todayKills = 0;
        this.save();
        return state;
    }

    getConfig(planetId) {
        if (typeof planetConfigManager === 'undefined') return null;
        const cfg = planetConfigManager.getConfig(planetId);
        return cfg && cfg.dailies ? cfg.dailies : null;
    }

    onEnemyKilled(planetId, info) {
        const dailies = this.getConfig(planetId);
        if (!dailies || dailies.enabled === false) return null;

        const type = typeof info === 'string' ? info : (info && info.type);
        const faction = info && typeof info === 'object' ? info.faction : null;
        const enemyClass = info && typeof info === 'object' ? info.enemyClass : null;

        if (dailies.enemyType && type !== dailies.enemyType) return null;
        if (dailies.faction && faction !== dailies.faction) return null;
        if (dailies.enemyClass && enemyClass !== dailies.enemyClass) return null;

        const state = this.ensureDay(planetId);
        if (state.finished) return this.getStatus(planetId);

        state.todayKills += 1;
        if (state.todayKills >= dailies.killCountPerDay) {
            const today = this.todayKey();
            if (state.lastCompletedDay !== today) {
                if (state.lastCompletedDay && state.lastCompletedDay !== this.yesterdayKey()) {
                    state.completedDays = 1;
                } else {
                    state.completedDays = (state.completedDays || 0) + 1;
                }
                state.lastCompletedDay = today;
                if (state.completedDays >= dailies.requiredDays) {
                    state.finished = true;
                }
            }
        }
        this.save();
        return this.getStatus(planetId);
    }

    getStatus(planetId) {
        const dailies = this.getConfig(planetId);
        if (!dailies || dailies.enabled === false) {
            return { active: false };
        }
        const state = this.ensureDay(planetId);
        const filterBits = [dailies.enemyType];
        if (dailies.faction) filterBits.push(dailies.faction);
        if (dailies.enemyClass) filterBits.push(dailies.enemyClass);
        return {
            active: true,
            enemyType: dailies.enemyType,
            faction: dailies.faction,
            enemyClass: dailies.enemyClass,
            killCountPerDay: dailies.killCountPerDay,
            requiredDays: dailies.requiredDays,
            todayKills: state.todayKills,
            completedDays: state.completedDays,
            finished: !!state.finished,
            label: `DAILY: ${state.todayKills}/${dailies.killCountPerDay} ${filterBits.join('/')} · DAY ${state.completedDays}/${dailies.requiredDays}`
        };
    }
}

const dailyTracker = new DailyTracker();
