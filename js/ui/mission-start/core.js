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
}
