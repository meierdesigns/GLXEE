"use strict";

/**
 * Coded (Web Audio) environment SFX — sluice/hatch/warp, rocks, shields,
 * crystals, pickups, wall scrape. No samples; all synthesized.
 */
extendClass(SoundManager, {
    _envThrottle(key, minMs) {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (!this._envLast) this._envLast = {};
        if (now - (this._envLast[key] || 0) < (minMs || 80)) return false;
        this._envLast[key] = now;
        return true;
    },

    // --- Arrival hatch / station launch ---

    playArrivalRise() {
        if (!this.canPlaySfx() || !this._envThrottle('arrivalRise', 400)) return;
        this.createSweep(60, 140, 0.45, 'triangle', 0.7);
        this.createNoiseBurst(0.12, 0.35, 400);
        this.schedule(() => this.createBeep(90, 0.08, 'sine', 0.35), 200);
    },

    playArrivalOpen() {
        if (!this.canPlaySfx() || !this._envThrottle('arrivalOpen', 350)) return;
        this.createSweep(180, 420, 0.28, 'sawtooth', 0.55);
        this.createNoiseBurst(0.08, 0.4, 900);
        this.schedule(() => this.createBeep(520, 0.06, 'triangle', 0.45), 120);
        this.schedule(() => this.createBeep(780, 0.05, 'triangle', 0.35), 200);
    },

    // --- Sluice / warp gate ---

    playSluiceAppear() {
        if (!this.canPlaySfx() || !this._envThrottle('sluiceAppear', 500)) return;
        this.createSweep(40, 110, 0.55, 'sine', 0.75);
        this.createNoiseBurst(0.18, 0.45, 350);
        this.schedule(() => this.createDualTone(140, 210, 0.2, 'triangle', 0.5), 180);
        this.schedule(() => this.createBeep(70, 0.15, 'sine', 0.4), 320);
    },

    playWarpAppear() {
        if (!this.canPlaySfx() || !this._envThrottle('warpAppear', 500)) return;
        this.createSweep(220, 880, 0.5, 'sine', 0.55);
        this.createDualTone(440, 660, 0.35, 'sine', 0.4);
        this.schedule(() => this.createSweep(880, 1320, 0.25, 'sine', 0.35), 200);
    },

    playGateDomeHit(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('gateHit', 45)) return;
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.04 * s, 0.55 * s, 1600);
        this.createBeep(260 + Math.random() * 80, 0.05, 'triangle', 0.45 * s);
        this.createSweep(400, 180, 0.07, 'square', 0.35 * s);
    },

    playGateDomeOpen() {
        if (!this.canPlaySfx() || !this._envThrottle('gateOpen', 280)) return;
        this.createSweep(90, 320, 0.35, 'sawtooth', 0.7);
        this.createNoiseBurst(0.14, 0.55, 700);
        this.schedule(() => this.createBeep(480, 0.07, 'square', 0.4), 100);
        this.schedule(() => this.createSweep(320, 160, 0.18, 'triangle', 0.45), 160);
    },

    playGateDomeClose() {
        if (!this.canPlaySfx() || !this._envThrottle('gateClose', 280)) return;
        this.createSweep(320, 90, 0.32, 'sawtooth', 0.55);
        this.createNoiseBurst(0.1, 0.4, 500);
        this.schedule(() => this.createBeep(70, 0.1, 'sine', 0.4), 180);
    },

    playGateEnter(kind) {
        if (!this.canPlaySfx() || !this._envThrottle('gateEnter', 600)) return;
        const warp = String(kind || '') === 'warp';
        if (warp) {
            this.createSweep(300, 1200, 0.7, 'sine', 0.7);
            this.createDualTone(600, 900, 0.4, 'sine', 0.45);
            this.schedule(() => this.createSweep(1200, 2400, 0.45, 'sine', 0.4), 250);
            this.schedule(() => this.createNoiseBurst(0.2, 0.35, 2000), 500);
        } else {
            this.createSweep(120, 60, 0.55, 'triangle', 0.75);
            this.createNoiseBurst(0.2, 0.5, 450);
            this.schedule(() => this.createSweep(200, 80, 0.35, 'sawtooth', 0.45), 180);
            this.schedule(() => this.createBeep(50, 0.2, 'sine', 0.5), 400);
        }
    },

    // --- Obstacles / terrain ---

    playRockHit(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('rockHit', 35)) return;
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.035 * s, 0.5 * s, 1200);
        this.createBeep(140 + Math.random() * 60, 0.045, 'triangle', 0.4 * s);
    },

    playRockBreak(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('rockBreak', 50)) return;
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.14 * s, 0.9 * s, 800);
        this.createSweep(220, 60, 0.18 * s, 'sawtooth', 0.7 * s);
        this.schedule(() => this.createNoiseBurst(0.08 * s, 0.45 * s, 500), 60);
    },

    playShieldHit(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('shieldHit', 35)) return;
        const s = scale == null ? 1 : scale;
        this.createDualTone(700, 1100, 0.05 * s, 'sine', 0.55 * s);
        this.createSweep(1400, 600, 0.07 * s, 'triangle', 0.4 * s);
    },

    playShieldBreak(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('shieldBreak', 60)) return;
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.1 * s, 0.7 * s, 2200);
        this.createSweep(1600, 200, 0.22 * s, 'sine', 0.65 * s);
        this.schedule(() => this.createBeep(900, 0.05, 'sine', 0.35 * s), 80);
    },

    playCrystalHit(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('crystalHit', 40)) return;
        const s = scale == null ? 1 : scale;
        this.createBeep(1200 + Math.random() * 400, 0.05, 'sine', 0.5 * s);
        this.createBeep(1800 + Math.random() * 300, 0.04, 'triangle', 0.35 * s);
    },

    playCrystalShatter(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('crystalShatter', 70)) return;
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.08 * s, 0.55 * s, 3000);
        this.createBeep(1600, 0.06, 'sine', 0.55 * s);
        this.schedule(() => this.createBeep(2200, 0.05, 'sine', 0.45 * s), 40);
        this.schedule(() => this.createBeep(2800, 0.08, 'triangle', 0.35 * s), 90);
        this.schedule(() => this.createSweep(2000, 400, 0.15, 'sine', 0.3 * s), 120);
    },

    playObstacleHit(obstacle) {
        const kind = String((obstacle && (obstacle.kind || obstacle.type)) || '').toLowerCase();
        if (kind.indexOf('crystal') !== -1) this.playCrystalHit();
        else if (kind.indexOf('shield') !== -1) this.playShieldHit();
        else if (kind.indexOf('crate') !== -1 || obstacle && obstacle.isCrate) this.playCrateHit();
        else this.playRockHit();
    },

    playObstacleBreak(obstacle) {
        const kind = String((obstacle && (obstacle.kind || obstacle.type || obstacle.explosionId)) || '').toLowerCase();
        if (kind.indexOf('crystal') !== -1) this.playCrystalShatter();
        else if (kind.indexOf('crate') !== -1 || (obstacle && obstacle.isCrate)) this.playCrateBreak();
        else if (kind.indexOf('shield') !== -1 || kind.indexOf('pop') !== -1) this.playShieldBreak();
        else this.playRockBreak();
    },

    playWallScrape(scale) {
        if (!this.canPlaySfx() || !this._envThrottle('wallScrape', 180)) return;
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.09 * s, 0.55 * s, 600);
        this.createSweep(180, 90, 0.12 * s, 'sawtooth', 0.4 * s);
    },

    playWallChip() {
        if (!this.canPlaySfx() || !this._envThrottle('wallChip', 40)) return;
        this.createNoiseBurst(0.03, 0.4, 1400);
        this.createBeep(200 + Math.random() * 100, 0.03, 'triangle', 0.3);
    },

    // --- Pickups / crates ---

    playPickupCollect(id) {
        if (!this.canPlaySfx() || !this._envThrottle('pickup', 40)) return;
        const key = String(id || '').toLowerCase();
        let f = 720;
        if (key.indexOf('credit') !== -1 || key === 'credits') f = 880;
        else if (key.indexOf('scrap') !== -1) f = 520;
        else if (key.indexOf('crystal') !== -1 || key.indexOf('ore') !== -1) f = 1100;
        else if (key.indexOf('fuel') !== -1 || key.indexOf('plasma') !== -1) f = 640;
        this.createBeep(f, 0.045, 'sine', 0.7);
        this.schedule(() => this.createBeep(f * 1.35, 0.06, 'triangle', 0.55), 35);
    },

    playCrateHit() {
        if (!this.canPlaySfx() || !this._envThrottle('crateHit', 50)) return;
        this.createNoiseBurst(0.05, 0.5, 1000);
        this.createBeep(180, 0.05, 'square', 0.4);
    },

    playCrateBreak() {
        if (!this.canPlaySfx() || !this._envThrottle('crateBreak', 80)) return;
        this.createNoiseBurst(0.12, 0.75, 900);
        this.createSweep(300, 80, 0.16, 'sawtooth', 0.6);
        this.schedule(() => this.createBeep(600, 0.05, 'triangle', 0.4), 70);
    },

    playEnv(eventId, opts) {
        const id = String(eventId || '').toLowerCase();
        const o = opts || {};
        switch (id) {
            case 'arrivalrise': return this.playArrivalRise();
            case 'arrivalopen': return this.playArrivalOpen();
            case 'sluiceappear': case 'gateappear': return this.playSluiceAppear();
            case 'warpappear': return this.playWarpAppear();
            case 'gatedomehit': case 'gatehit': return this.playGateDomeHit(o.scale);
            case 'gatedomeopen': case 'gateopen': return this.playGateDomeOpen();
            case 'gatedomeclose': case 'gateclose': return this.playGateDomeClose();
            case 'gateenter': case 'sluiceenter': return this.playGateEnter(o.kind || 'sluice');
            case 'warpenter': return this.playGateEnter('warp');
            case 'rockhit': return this.playRockHit(o.scale);
            case 'rockbreak': return this.playRockBreak(o.scale);
            case 'shieldhit': return this.playShieldHit(o.scale);
            case 'shieldbreak': return this.playShieldBreak(o.scale);
            case 'crystalhit': return this.playCrystalHit(o.scale);
            case 'crystalshatter': return this.playCrystalShatter(o.scale);
            case 'wallscrape': return this.playWallScrape(o.scale);
            case 'wallchip': return this.playWallChip();
            case 'pickup': return this.playPickupCollect(o.id);
            case 'cratehit': return this.playCrateHit();
            case 'cratebreak': return this.playCrateBreak();
            default: break;
        }
    }
});
