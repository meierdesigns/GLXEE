"use strict";

/**
 * Beat clock synced to planet soundtrack / procedural ambient.
 * YouTube audio cannot be analyzed in-browser; BPM + start time drive the pulse.
 */
class BeatSyncManager {
    constructor() {
        this.active = false;
        this.bpm = 120;
        this.beatsPerBar = 4;
        this.startMs = 0;
        this.offsetMs = 0;
        this.planetId = null;

        this.beatIndex = 0;
        this.barBeat = 0;
        this.phase = 0;
        this.barPhase = 0;
        this.pulse = 0;
        this.justBeat = false;
        this.justDownbeat = false;
        this._lastBeatIndex = -1;

        this.powerWindow = 0.18; // fraction of beat near attack
        this.powerDamageMul = 1.85;
        this.powerCooldownMul = 0.72;

        this.defaultBpm = {
            mars: 110,
            jupiter: 92,
            saturn: 104,
            neptune: 128,
            pluto: 140
        };
    }

    resolveBpm(planetId) {
        const id = String(planetId || '').toLowerCase().split('-')[0];
        if (typeof planetConfigManager !== 'undefined' && id) {
            const cfg = planetConfigManager.getConfig(id);
            if (cfg && cfg.soundtrackBpm != null) {
                const n = Number(cfg.soundtrackBpm);
                if (Number.isFinite(n) && n >= 60 && n <= 220) return n;
            }
        }
        return this.defaultBpm[id] || 120;
    }

    start(planetId, bpm) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        this.planetId = id;
        this.bpm = Math.max(60, Math.min(220, Number(bpm) || this.resolveBpm(id)));
        this.startMs = performance.now();
        this.offsetMs = 0;
        this.active = true;
        this._lastBeatIndex = -1;
        this.justBeat = false;
        this.justDownbeat = false;
        this.update(0);
    }

    restartFromNow() {
        if (!this.active) return;
        this.startMs = performance.now();
        this._lastBeatIndex = -1;
    }

    stop() {
        this.active = false;
        this.pulse = 0;
        this.phase = 0;
        this.justBeat = false;
        this.justDownbeat = false;
        this._lastBeatIndex = -1;
    }

    setBpm(bpm) {
        const n = Number(bpm);
        if (!Number.isFinite(n)) return;
        this.bpm = Math.max(60, Math.min(220, n));
    }

    beatDurationMs() {
        return 60000 / Math.max(1, this.bpm);
    }

    update(deltaTime) {
        this.justBeat = false;
        this.justDownbeat = false;
        if (!this.active) {
            this.pulse = 0;
            this.phase = 0;
            return;
        }

        const elapsed = Math.max(0, performance.now() - this.startMs - this.offsetMs);
        const beatMs = this.beatDurationMs();
        const rawBeat = elapsed / beatMs;
        const beatIndex = Math.floor(rawBeat);
        this.phase = rawBeat - beatIndex;
        this.beatIndex = beatIndex;
        this.barBeat = ((beatIndex % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;
        this.barPhase = (this.barBeat + this.phase) / this.beatsPerBar;

        // Sharp attack pulse on each beat
        const attack = Math.max(0, 1 - this.phase / 0.22);
        this.pulse = attack * attack;

        if (beatIndex !== this._lastBeatIndex) {
            this.justBeat = true;
            this.justDownbeat = this.barBeat === 0;
            this._lastBeatIndex = beatIndex;
        }

        if (deltaTime == null) return;
    }

    isPowerBeatWindow() {
        if (!this.active) return false;
        // Stronger shots on downbeats (beat 1 of bar) and mid-bar accents (beat 3)
        const accent = this.barBeat === 0 || this.barBeat === 2;
        if (!accent) return false;
        return this.phase < this.powerWindow || this.phase > (1 - this.powerWindow * 0.35);
    }

    getEnemySpeedMul() {
        if (!this.active) return 1;
        // Idle groove + kick surge
        const groove = 0.82 + 0.18 * Math.sin(this.barPhase * Math.PI * 2);
        const kick = 1 + 0.45 * this.pulse * (this.barBeat === 0 ? 1.25 : 0.85);
        return Math.max(0.55, Math.min(1.75, groove * kick));
    }

    getEnemyBobOffset() {
        if (!this.active) return 0;
        return Math.sin(this.barPhase * Math.PI * 2) * (1.2 + 1.8 * this.pulse);
    }

    getPlayerDamageMul() {
        if (!this.isPowerBeatWindow()) return 1;
        return this.powerDamageMul;
    }

    getPlayerCooldownMul() {
        if (!this.isPowerBeatWindow()) return 1;
        return this.powerCooldownMul;
    }

    getShotOptions() {
        if (!this.isPowerBeatWindow()) {
            return { chargeMult: 1, beatPower: false };
        }
        return {
            chargeMult: this.powerDamageMul,
            beatPower: true,
            cooldownMul: this.powerCooldownMul
        };
    }

    getPulse() {
        return this.active ? this.pulse : 0;
    }

    getBpm() {
        return this.bpm;
    }

    isActive() {
        return this.active;
    }
}

const beatSyncManager = new BeatSyncManager();
window.beatSyncManager = beatSyncManager;
