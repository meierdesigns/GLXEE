"use strict";

// MissionStartManager methods, split from mission-start.js.
extendClass(MissionStartManager, {
    async prepareFlyIn() {
        const w = this.canvasWidth();
        const h = this.canvasHeight();

        if (typeof playerManager !== 'undefined') {
            if (playerManager.reset) playerManager.reset();
            const p = playerManager.player;
            this.playerTo = { x: p.x, y: p.y };
            this.playerFrom = { x: p.x, y: h + p.height + 36 };
            p.x = this.playerFrom.x;
            p.y = this.playerFrom.y;
        }

        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = false;
            enemyManager.scheduleElapsedMs = 0;
            if (!Array.isArray(enemyManager.schedule) || !enemyManager.schedule.length) {
                const type = enemyManager.currentShipType || 'enemyBasic';
                enemyManager.setEnemySchedule([{
                    id: 'main',
                    type: type,
                    champion: true,
                    level: 2,
                    spawnAt: 0
                }], {
                    planetId: (typeof game !== 'undefined' && game.coreLevelManager &&
                        game.coreLevelManager.getCurrentLevel &&
                        game.coreLevelManager.getCurrentLevel() &&
                        game.coreLevelManager.getCurrentLevel().planetId) || 'mars'
                });
            }
            if (Array.isArray(enemyManager.schedule)) {
                enemyManager.schedule.forEach((e) => { e.spawned = false; });
            }
            enemyManager.enemy = null;
            enemyManager.sideEnemies = [];
            const state = { width: w, height: h };

            // Spawn due-at-0 entries (respect cluster wave times); await champion model
            const clusterWaveAt = {};
            (enemyManager.schedule || []).forEach((e) => {
                const c = e.cluster || 'alpha';
                const at = Number(e.spawnAt != null ? e.spawnAt : 0);
                if (clusterWaveAt[c] == null || at < clusterWaveAt[c]) {
                    clusterWaveAt[c] = at;
                }
            });
            let due = (enemyManager.schedule || []).filter((entry) => {
                if (entry.spawned) return false;
                const at = Number(entry.spawnAt != null ? entry.spawnAt : 0);
                const waveAt = clusterWaveAt[entry.cluster || 'alpha'];
                const dueAt = Math.min(at, waveAt != null ? waveAt : at);
                return dueAt <= 0;
            });
            // Always bring at least the champion in during fly-in
            if (!due.length && enemyManager.schedule.length) {
                const champ = enemyManager.schedule.find((e) => e.champion) || enemyManager.schedule[0];
                if (champ) due = [champ];
            }
            for (const entry of due) {
                entry.spawned = true;
                if (entry.champion) {
                    await enemyManager.spawnChampionFromEntry(entry);
                } else {
                    enemyManager.spawnScheduledNormal(entry, state);
                }
            }

            if (enemyManager.enemy) {
                const e = enemyManager.enemy;
                this.enemyTo = { x: e.x, y: e.y };
                this.enemyFrom = { x: e.x, y: -e.height - 24 };
                e.x = this.enemyFrom.x;
                e.y = this.enemyFrom.y;
            } else {
                this.enemyFrom = null;
                this.enemyTo = null;
            }

            this.sideFrom = [];
            this.sideTo = [];
            (enemyManager.sideEnemies || []).forEach((s, i) => {
                const to = { x: s.x, y: s.y };
                let from;
                if (s.isEscort) {
                    from = { x: to.x, y: -s.height - 20 - i * 12 };
                } else if (s.speed < 0) {
                    from = { x: w + s.width + 30 + i * 10, y: to.y };
                } else {
                    from = { x: -s.width - 30 - i * 10, y: to.y };
                }
                this.sideFrom.push(from);
                this.sideTo.push(to);
                s.x = from.x;
                s.y = from.y;
            });
        }

        if (!this.active) return;
        this.phase = 'flyIn';
        this.flyInElapsed = 0;
    },

    applyFlyIn(ease) {
        if (this.playerFrom && this.playerTo && typeof playerManager !== 'undefined') {
            const p = playerManager.player;
            p.x = this.playerFrom.x + (this.playerTo.x - this.playerFrom.x) * ease;
            p.y = this.playerFrom.y + (this.playerTo.y - this.playerFrom.y) * ease;
        }
        if (this.enemyFrom && this.enemyTo && typeof enemyManager !== 'undefined' && enemyManager.enemy) {
            const e = enemyManager.enemy;
            e.x = this.enemyFrom.x + (this.enemyTo.x - this.enemyFrom.x) * ease;
            e.y = this.enemyFrom.y + (this.enemyTo.y - this.enemyFrom.y) * ease;
        }
        if (typeof enemyManager !== 'undefined' && enemyManager.sideEnemies) {
            enemyManager.sideEnemies.forEach((s, i) => {
                const from = this.sideFrom[i];
                const to = this.sideTo[i];
                if (!from || !to) return;
                s.x = from.x + (to.x - from.x) * ease;
                s.y = from.y + (to.y - from.y) * ease;
            });
        }
    },

    complete() {
        this.applyFlyIn(1);
        this.active = false;
        this.phase = null;
        this._armed = false;
        this.hideOverlay();

        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = false;
        }

        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.startLevel) {
            levelInfoManager.startLevel();
        }
        if (typeof game !== 'undefined' && game.gameState && game.gameState.stats) {
            game.gameState.stats.levelStartTime = Date.now();
        }
    },

    cancel() {
        this.active = false;
        this.phase = null;
        this._armed = false;
        this.hideOverlay();
        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = false;
        }
    },
});
