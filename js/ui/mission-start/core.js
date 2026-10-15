"use strict";

/**
 * Mission start sequence: FIRE TO START → countdown → ships fly in → combat.
 * Overlay chrome follows html[data-faction] / resolveActiveFaction().
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
        this.subEl = null;
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
        this.setPhase('awaitFire');
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
        this.setPhase('awaitFire');

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
        this.syncFactionChrome();
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

    /** Active pilot faction id for overlay chrome. */
    resolveFactionId() {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveActiveFaction) {
            return factionShipStyles.resolveActiveFaction();
        }
        return 'terran';
    }

    syncFactionChrome() {
        this.ensureOverlay();
        if (!this.overlay) return;
        const id = this.resolveFactionId();
        this.overlay.dataset.faction = id;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
            const style = factionShipStyles.getFactionStyle(id);
            if (style) {
                this.overlay.style.setProperty('--ms-accent', style.accent || '');
                this.overlay.style.setProperty('--ms-hull', style.hull || '');
                this.overlay.style.setProperty('--ms-edge', style.edge || '');
            }
        }
    }

    setPhase(phase) {
        this.phase = phase;
        if (this.overlay) this.overlay.dataset.phase = phase || '';
    }

    overlayMarkup() {
        return '<div class="mission-start-vignette" aria-hidden="true"></div>' +
            '<div class="mission-start-aura" aria-hidden="true"></div>' +
            '<div class="mission-start-frame" aria-hidden="true">' +
                '<span class="ms-corner ms-tl"></span>' +
                '<span class="ms-corner ms-tr"></span>' +
                '<span class="ms-corner ms-bl"></span>' +
                '<span class="ms-corner ms-br"></span>' +
                '<span class="ms-slash ms-slash-a"></span>' +
                '<span class="ms-slash ms-slash-b"></span>' +
            '</div>' +
            '<div class="mission-start-stack">' +
                '<div class="mission-start-text" id="missionStartText">FIRE TO START</div>' +
                '<div class="mission-start-sub" id="missionStartSub">PRESS FIRE</div>' +
            '</div>';
    }

    ensureOverlay() {
        if (this.overlay && this.overlay.isConnected && this.overlay.querySelector('.mission-start-stack')) {
            this.textEl = this.overlay.querySelector('#missionStartText') || this.textEl;
            this.subEl = this.overlay.querySelector('#missionStartSub') || this.subEl;
            return;
        }
        let el = document.getElementById('missionStartOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'missionStartOverlay';
            el.className = 'mission-start-overlay hidden';
            const stage = document.querySelector('.game-stage') || document.querySelector('.game-canvas-container') || document.body;
            stage.appendChild(el);
        }
        if (!el.querySelector('.mission-start-stack')) {
            el.className = 'mission-start-overlay hidden';
            el.innerHTML = this.overlayMarkup();
        }
        this.overlay = el;
        this.textEl = el.querySelector('#missionStartText') || el.querySelector('.mission-start-text');
        this.subEl = el.querySelector('#missionStartSub');
        this.pixelCanvas = null;
    }

    showOverlay() {
        this.ensureOverlay();
        this.syncFactionChrome();
        if (this.overlay) this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        if (this.overlay) this.overlay.classList.add('hidden');
    }

    setText(msg, pulse) {
        this.ensureOverlay();
        const raw = String(msg);
        const isCount = !pulse && /^\d+$/.test(raw);
        const isGo = !pulse && raw === 'GO!';
        if (this.textEl) {
            this.textEl.classList.toggle('mission-start-pulse', !!pulse);
            this.textEl.classList.toggle('mission-start-count', isCount);
            this.textEl.classList.toggle('mission-start-go', isGo);
            this.textEl.classList.toggle('mission-start-fire', !!pulse);
            if (isCount || isGo) {
                if (!this.pixelCanvas || !this.pixelCanvas.isConnected) {
                    this.pixelCanvas = document.createElement('canvas');
                    this.pixelCanvas.className = 'mission-start-pixel-canvas';
                    this.textEl.textContent = '';
                    this.textEl.appendChild(this.pixelCanvas);
                }
                this.drawPixelText(isGo ? 'GO' : raw);
            } else {
                this.pixelCanvas = null;
                this.textEl.textContent = raw;
            }
        }
        if (this.subEl) {
            if (pulse) {
                this.subEl.textContent = 'PRESS FIRE';
                this.subEl.hidden = false;
            } else if (isCount) {
                this.subEl.textContent = 'GET READY';
                this.subEl.hidden = false;
            } else if (isGo) {
                this.subEl.textContent = 'ENGAGE';
                this.subEl.hidden = false;
            } else {
                this.subEl.hidden = true;
            }
        }
        if (this.overlay) {
            this.overlay.classList.toggle('is-fire', !!pulse);
            this.overlay.classList.toggle('is-count', isCount);
            this.overlay.classList.toggle('is-go', isGo);
        }
    }

    /** Crisp 5×7 bitmap glyphs scaled with nearest-neighbour — no blurry font. */
    drawPixelText(msg) {
        if (!this.pixelCanvas) return;
        const GLYPHS = {
            '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
            '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
            '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
            '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
            '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
            '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
            '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
            '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
            '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
            '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
            'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
            'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110']
        };
        const canvas = this.pixelCanvas;
        const chars = String(msg).toUpperCase().split('').filter((c) => GLYPHS[c]);
        // 1px margin + 1px drop shadow; 1px gap between digits.
        canvas.width = Math.max(1, chars.length * 6 + 2);
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const color = getComputedStyle(this.textEl).color;
        const paint = (ox, oy, fill, alpha) => {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = fill;
            chars.forEach((c, i) => {
                GLYPHS[c].forEach((row, y) => {
                    for (let x = 0; x < 5; x++) {
                        if (row[x] === '1') ctx.fillRect(1 + i * 6 + x + ox, 1 + y + oy, 1, 1);
                    }
                });
            });
        };
        paint(1, 1, '#000', 0.55);
        paint(0, 0, color, 1);
        ctx.globalAlpha = 1;
        // Restart the per-second progress bar and pop-in animation.
        const el = this.textEl;
        el.classList.remove('mission-start-tick');
        void el.offsetWidth;
        el.classList.add('mission-start-tick');
    }

    onFire() {
        if (!this.active || this.phase !== 'awaitFire') return false;
        this.setPhase('countdown');
        this._lastTick = 0;
        this.countdownValue = 3;
        this.countdownTimer = 0;
        this.syncFactionChrome();
        this.setText('3', false);
        if (typeof soundManager !== 'undefined' && soundManager.playShoot) {
            try { soundManager.playShoot(); } catch (e) { /* ignore */ }
        }
        return true;
    }

    update(deltaTime) {
        if (!this.active) return;

        // Countdown / GO run on wall-clock time: the loop caps deltaTime per frame, so a slow frame rate would stretch them.
        const now = performance.now();
        const real = this._lastTick ? Math.min(1000, now - this._lastTick) : deltaTime;
        this._lastTick = now;

        if (this.phase === 'countdown') {
            this.countdownTimer += Math.max(deltaTime, real);
            if (this.countdownTimer >= 900) {
                this.countdownTimer = 0;
                this.countdownValue -= 1;
                if (this.countdownValue > 0) {
                    this.setText(String(this.countdownValue), false);
                    if (typeof soundManager !== 'undefined' && soundManager.playShoot) {
                        try { soundManager.playShoot(); } catch (e) { /* ignore */ }
                    }
                } else {
                    this.setPhase('go');
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
            this.goTimer += Math.max(deltaTime, real);
            // Slightly longer GO beat so the burst reads before fly-in.
            if (this.goTimer >= 620) {
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
        this.setPhase('preparingFlyIn');
        this.hideOverlay();
        this.prepareFlyIn().catch((err) => {
            console.error('Mission fly-in failed:', err);
            this.complete();
        });
    }
}
