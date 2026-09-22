"use strict";

/**
 * Mission start sequence: FIRE TO START → countdown → ships fly in → combat.
 */
class MissionStartManager {
    constructor() {
        this.active = false;
        this.phase = null;
        this.countdownValue = 3;
        this.countdownTimer = 0;
        this.goTimer = 0;
        this.flyInElapsed = 0;
        this.flyInDuration = 1400;
        this.overlay = null;
        this.textEl = null;
        this.playerFrom = null;
        this.playerTo = null;
        this.enemyFrom = null;
        this.enemyTo = null;
        this.sideFrom = [];
        this.sideTo = [];
        this._armed = false;
    }

    isActive() {
        return !!this.active;
    }

    isAwaitingFire() {
        return this.active && this.phase === 'awaitFire';
    }

    isPlaying() {
        return !this.active;
    }

    arm() {
        this._armed = true;
        this.active = true;
        this.phase = 'awaitFire';
        this.countdownValue = 3;
        this.countdownTimer = 0;
        this.goTimer = 0;
        this.flyInElapsed = 0;
        this.playerFrom = null;
        this.playerTo = null;
        this.enemyFrom = null;
        this.enemyTo = null;
        this.sideFrom = [];
        this.sideTo = [];
        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = true;
            enemyManager.enemy = null;
            enemyManager.sideEnemies = [];
            enemyManager.scheduleElapsedMs = 0;
            if (Array.isArray(enemyManager.schedule)) {
                enemyManager.schedule.forEach((e) => { e.spawned = false; });
            }
        }
        if (typeof obstacleManager !== 'undefined' && obstacleManager.reset) {
            obstacleManager.reset();
        }
        if (typeof bulletManager !== 'undefined' && bulletManager.reset) {
            bulletManager.reset();
        }
    }

    begin() {
        if (!this._armed) this.arm();
        this.active = true;
        this.phase = 'awaitFire';

        if (typeof playerManager !== 'undefined') {
            if (playerManager.reset) playerManager.reset();
            const p = playerManager.player;
            const h = this.canvasHeight();
            p.y = h + (p.height || 24) + 40;
        }
        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = true;
            enemyManager.enemy = null;
            enemyManager.sideEnemies = [];
            enemyManager.scheduleElapsedMs = 0;
            if (Array.isArray(enemyManager.schedule)) {
                enemyManager.schedule.forEach((e) => { e.spawned = false; });
            }
        }

        this.ensureOverlay();
        this.setText('FIRE TO START', true);
        this.showOverlay();

        if (typeof levelInfoManager !== 'undefined') {
            if (typeof levelInfoManager.prepareForCombat === 'function') {
                levelInfoManager.prepareForCombat();
            } else if (levelInfoManager.showPanel) {
                levelInfoManager.showPanel();
            }
        }
    }

    canvasWidth() {
        if (typeof game !== 'undefined') {
            return game.internalWidth || game.baseWidth || game.width || 240;
        }
        return 240;
    }

    canvasHeight() {
        if (typeof game !== 'undefined') {
            return game.internalHeight || game.baseHeight || game.height || 300;
        }
        return 300;
    }

    ensureOverlay() {
        if (this.overlay && this.overlay.isConnected) return;
        let el = document.getElementById('missionStartOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'missionStartOverlay';
            el.className = 'mission-start-overlay hidden';
            el.innerHTML = '<div class="mission-start-text" id="missionStartText">FIRE TO START</div>';
            const stage = document.querySelector('.game-stage') || document.querySelector('.game-canvas-container') || document.body;
            stage.appendChild(el);
        }
        this.overlay = el;
        this.textEl = el.querySelector('#missionStartText') || el.querySelector('.mission-start-text');
    }

    showOverlay() {
        this.ensureOverlay();
        if (this.overlay) this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        if (this.overlay) this.overlay.classList.add('hidden');
    }

    setText(msg, pulse) {
        this.ensureOverlay();
        if (this.textEl) {
            this.textEl.classList.toggle('mission-start-pulse', !!pulse);
            this.textEl.classList.toggle('mission-start-count', !pulse && /^\d+$/.test(String(msg)));
            this.textEl.classList.toggle('mission-start-go', String(msg) === 'GO!');
            if (!pulse && /^\d+$/.test(String(msg))) {
                if (!this.pixelCanvas) {
                    this.pixelCanvas = document.createElement('canvas');
                    this.pixelCanvas.className = 'mission-start-pixel-canvas';
                    this.textEl.textContent = '';
                    this.textEl.appendChild(this.pixelCanvas);
                }
                this.drawPixelText(String(msg));
            } else {
                this.pixelCanvas = null;
                this.textEl.textContent = msg;
            }
        }
    }

    drawPixelText(msg) {
        if (!this.pixelCanvas) return;
        const canvas = this.pixelCanvas;
        canvas.width = 48;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getComputedStyle(this.textEl).color;
        ctx.font = 'bold 42px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(msg, 24, 33);
    }

    onFire() {
        if (!this.active || this.phase !== 'awaitFire') return false;
        this.phase = 'countdown';
        this.countdownValue = 3;
        this.countdownTimer = 0;
        this.setText('3', false);
        if (typeof soundManager !== 'undefined' && soundManager.playShoot) {
            try { soundManager.playShoot(); } catch (e) { /* ignore */ }
        }
        return true;
    }

    update(deltaTime) {
        if (!this.active) return;

        if (this.phase === 'countdown') {
            this.countdownTimer += deltaTime;
            if (this.countdownTimer >= 900) {
                this.countdownTimer = 0;
                this.countdownValue -= 1;
                if (this.countdownValue > 0) {
                    this.setText(String(this.countdownValue), false);
                    if (typeof soundManager !== 'undefined' && soundManager.playShoot) {
                        try { soundManager.playShoot(); } catch (e) { /* ignore */ }
                    }
                } else {
                    this.phase = 'go';
                    this.goTimer = 0;
                    this.setText('GO!', false);
                    if (typeof soundManager !== 'undefined' && soundManager.playExplosion) {
                        try { soundManager.playExplosion(); } catch (e) { /* ignore */ }
                    }
                }
            }
            return;
        }

        if (this.phase === 'go') {
            this.goTimer += deltaTime;
            if (this.goTimer >= 450) {
                this.startFlyIn();
            }
            return;
        }

        if (this.phase === 'preparingFlyIn') {
            return;
        }

        if (this.phase === 'flyIn') {
            this.flyInElapsed += deltaTime;
            const t = Math.min(1, this.flyInElapsed / this.flyInDuration);
            const ease = 1 - Math.pow(1 - t, 3);
            this.applyFlyIn(ease);
            if (t >= 1) {
                this.complete();
            }
        }
    }

    startFlyIn() {
        this.phase = 'preparingFlyIn';
        this.hideOverlay();
        this.prepareFlyIn().catch((err) => {
            console.error('Mission fly-in failed:', err);
            this.complete();
        });
    }

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
    }

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
    }

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
    }

    cancel() {
        this.active = false;
        this.phase = null;
        this._armed = false;
        this.hideOverlay();
        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = false;
        }
    }
}

const missionStartManager = new MissionStartManager();
