"use strict";

// Procedural Web Audio sound system with named event profiles
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.activeTimeouts = [];
        this.masterVolume = 0.1;
        this.soundVolume = 0.05;
        this.musicVolume = 0.2;

        this.ambientNodes = null;
        this.ambientPlanetId = null;
        this.ambientGain = null;

        this.weaponFamilies = {
            laser: 'laser',
            pierce: 'laser',
            claw_beam: 'laser',
            spread: 'spread',
            burst: 'spread',
            spike_burst: 'spread',
            rapid: 'rapid',
            plasma: 'soft',
            ion: 'soft',
            wave: 'soft',
            missile: 'punch',
            nova: 'punch'
        };

        this.planetAmbient = {
            mars: { base: 55, filter: 420, type: 'sawtooth', lfo: 0.08 },
            jupiter: { base: 40, filter: 280, type: 'triangle', lfo: 0.05 },
            saturn: { base: 70, filter: 900, type: 'sine', lfo: 0.12 },
            neptune: { base: 90, filter: 1400, type: 'sine', lfo: 0.06 },
            pluto: { base: 120, filter: 1800, type: 'triangle', lfo: 0.15 }
        };
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    ensureContext() {
        if (!this.enabled) return null;
        if (!this.audioContext) this.init();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        return this.audioContext;
    }

    sfxVolume(scale) {
        const s = scale == null ? 1 : scale;
        return Math.max(0.0001, 0.12 * this.masterVolume * this.soundVolume * s);
    }

    musicVol(scale) {
        const s = scale == null ? 1 : scale;
        return Math.max(0.0001, 0.08 * this.masterVolume * this.musicVolume * s);
    }

    canPlaySfx() {
        return !!(this.enabled && this.ensureContext() && this.soundEnabled);
    }

    canPlayMusic() {
        return !!(this.enabled && this.ensureContext() && this.musicEnabled);
    }

    // --- Synth primitives ---

    createBeep(frequency, duration, type, volumeScale) {
        if (!this.canPlaySfx()) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(Math.max(20, frequency), now);
        const vol = this.sfxVolume(volumeScale);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(vol, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, duration));
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    createSweep(startFreq, endFreq, duration, type, volumeScale) {
        if (!this.canPlaySfx()) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type || 'sine';
        const start = Math.max(40, startFreq);
        const end = Math.max(40, endFreq);
        osc.frequency.setValueAtTime(start, now);
        osc.frequency.exponentialRampToValueAtTime(end, now + duration);
        const vol = this.sfxVolume(volumeScale);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    createNoiseBurst(duration, volumeScale, filterFreq) {
        if (!this.canPlaySfx()) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq || 800, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + duration);
        const gain = ctx.createGain();
        const vol = this.sfxVolume(volumeScale);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + duration + 0.02);
    }

    createDualTone(freq1, freq2, duration, type, volumeScale) {
        if (!this.canPlaySfx()) return;
        this.createBeep(freq1, duration, type || 'sine', (volumeScale || 1) * 0.7);
        this.createBeep(freq2, duration, type || 'sine', (volumeScale || 1) * 0.5);
    }

    schedule(fn, delayMs) {
        const id = setTimeout(fn, delayMs);
        this.activeTimeouts.push(id);
        return id;
    }

    clearActiveTimeouts() {
        this.activeTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.activeTimeouts = [];
    }

    // --- Event API ---

    play(eventId, opts) {
        const id = String(eventId || '').toLowerCase();
        const o = opts || {};
        switch (id) {
            case 'shoot':
            case 'weaponshoot':
                this.playWeaponShoot(o.weaponId || o.weapon || 'laser');
                break;
            case 'enemyshoot':
                this.playEnemyShoot(o.kind);
                break;
            case 'hit':
                this.playHit();
                break;
            case 'kill':
                this.playKill(o.scale);
                break;
            case 'explosion':
                this.playExplosion(o.scale);
                break;
            case 'reflect':
                this.playReflect();
                break;
            case 'hurt':
                this.playHurt();
                break;
            case 'powerup':
                this.playPowerUp();
                break;
            case 'gameover':
                this.playGameOver();
                break;
            case 'victory':
                this.playVictory();
                break;
            default:
                break;
        }
    }

    playWeaponShoot(weaponId) {
        const family = this.weaponFamilies[weaponId] || 'laser';
        switch (family) {
            case 'spread':
                this.createSweep(900, 500, 0.08, 'square', 0.7);
                this.schedule(() => this.createSweep(750, 420, 0.06, 'square', 0.45), 30);
                this.schedule(() => this.createSweep(820, 480, 0.06, 'square', 0.4), 55);
                break;
            case 'rapid':
                this.createSweep(1600, 900, 0.06, 'sine', 0.55);
                break;
            case 'soft':
                this.createSweep(480, 220, 0.18, 'triangle', 0.9);
                this.createBeep(180, 0.12, 'sine', 0.35);
                break;
            case 'punch':
                this.createNoiseBurst(0.08, 0.8, 500);
                this.createSweep(220, 80, 0.2, 'sawtooth', 0.85);
                break;
            case 'laser':
            default:
                this.createSweep(1200, 600, 0.14, 'sine', 0.8);
                break;
        }
    }

    playShoot() {
        this.playWeaponShoot('laser');
    }

    playEnemyShoot(kind) {
        const k = String(kind || 'laser').toLowerCase();
        if (k.indexOf('plasma') !== -1) {
            this.createSweep(320, 140, 0.12, 'sawtooth', 0.75);
        } else if (k.indexOf('spread') !== -1 || k.indexOf('burst') !== -1) {
            this.createSweep(700, 350, 0.07, 'square', 0.65);
            this.schedule(() => this.createSweep(620, 300, 0.05, 'square', 0.4), 25);
        } else if (k.indexOf('rapid') !== -1) {
            this.createSweep(1000, 550, 0.05, 'square', 0.5);
        } else {
            this.createSweep(780, 320, 0.1, 'sawtooth', 0.7);
        }
    }

    playHit() {
        this.createNoiseBurst(0.04, 0.55, 2200);
        this.createBeep(420, 0.04, 'triangle', 0.4);
    }

    playKill(scale) {
        const s = scale == null ? 1 : scale;
        this.createNoiseBurst(0.18 * s, 1.1 * s, 900);
        this.createSweep(280, 70, 0.22 * s, 'sawtooth', 0.9 * s);
        this.schedule(() => this.createBeep(90, 0.12, 'sine', 0.5 * s), 80);
    }

    playExplosion(scale) {
        const s = scale == null ? 1.15 : scale;
        this.createNoiseBurst(0.25 * s, 1.2 * s, 700);
        this.createSweep(200, 50, 0.28 * s, 'sawtooth', s);
        this.schedule(() => this.createNoiseBurst(0.1 * s, 0.6 * s, 400), 90);
    }

    playReflect() {
        this.createDualTone(1400, 2100, 0.06, 'sine', 0.7);
        this.createSweep(1800, 900, 0.08, 'triangle', 0.5);
    }

    playHurt() {
        this.createNoiseBurst(0.07, 0.7, 600);
        this.createSweep(260, 110, 0.16, 'triangle', 0.85);
    }
}
