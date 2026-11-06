"use strict";

/**
 * Single source of truth for authored volume defaults + linear routing.
 * MASTER × SOUND → SFX, MASTER × MUSIC → music bus (tracker / YT / local / ambient).
 * Values are 0..1. UI percents (0..100) are accepted via normalize().
 */
var VFVolume = {
    MASTER: 0.1,
    SOUND: 0.5,
    MUSIC: 0.65,
    /** Authored music-bus level before the player moves a slider. */
    busDefault: function () {
        return Math.max(0, Math.min(1, this.MASTER * this.MUSIC));
    },
    /** Coerce UI/API input to 0..1 (treats values > 1 as percent). */
    normalize: function (v) {
        var n = Number(v);
        if (!Number.isFinite(n)) return 0;
        if (n > 1) n = n / 100;
        return Math.max(0, Math.min(1, n));
    }
};

// Procedural Web Audio sound system with named event profiles
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.activeTimeouts = [];
        this.masterVolume = VFVolume.MASTER;
        this.soundVolume = VFVolume.SOUND;
        this.musicVolume = VFVolume.MUSIC;
        this._audioUnlocked = false;

        this.ambientNodes = null;
        this.ambientPlanetId = null;
        this.ambientGain = null;

        this.planetAmbient = {
            mars: { base: 55, filter: 420, type: 'sawtooth', lfo: 0.08 },
            jupiter: { base: 40, filter: 280, type: 'triangle', lfo: 0.05 },
            saturn: { base: 70, filter: 900, type: 'sine', lfo: 0.12 },
            neptune: { base: 90, filter: 1400, type: 'sine', lfo: 0.06 },
            pluto: { base: 120, filter: 1800, type: 'triangle', lfo: 0.15 }
        };
    }

    /**
     * Soft boot only — do not create AudioContext here. Browsers block
     * autoplay; creating the context before a user gesture logs a console
     * warning and leaves it suspended anyway. ensureContext() opens it
     * on the first play / gesture.
     */
    init() {
        this.enabled = !!(window.AudioContext || window.webkitAudioContext);
    }

    markAudioUnlocked() {
        this._audioUnlocked = true;
    }

    ensureContext() {
        if (!this.enabled) return null;
        if (!this.audioContext) {
            // Avoid the autoplay console warning: do not construct until
            // the document has seen a real user activation.
            const unlocked = this._audioUnlocked
                || (navigator.userActivation && navigator.userActivation.hasBeenActive);
            if (!unlocked) return null;
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                this.enabled = false;
                return null;
            }
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        return this.audioContext;
    }

    sfxVolume(scale) {
        const s = scale == null ? 1 : Number(scale);
        const mul = Number.isFinite(s) ? s : 1;
        // Linear MASTER × SOUND — slider 100%/100% ≈ full SFX.
        return Math.max(0.0001, Math.min(1, this.masterVolume * this.soundVolume * mul));
    }

    /**
     * Procedural ambient / soft beds: MASTER × MUSIC × scale.
     * No hidden attenuations — scale is the only intentional quiet factor.
     */
    musicVol(scale) {
        const s = scale == null ? 1 : Number(scale);
        const mul = Number.isFinite(s) ? s : 1;
        return Math.max(0.0001, Math.min(1, this.masterVolume * this.musicVolume * mul));
    }

    /**
     * Linear music bus: MASTER × MUSIC (0..1). Shared by tracker, YouTube,
     * local audio, and volume UI — never floor or boost this value.
     */
    musicBusVolume() {
        const m = Number(this.masterVolume);
        const u = Number(this.musicVolume);
        if (!Number.isFinite(m) || !Number.isFinite(u)) {
            return (typeof VFVolume !== 'undefined') ? VFVolume.busDefault() : 0.065;
        }
        return Math.max(0, Math.min(1, m * u));
    }

    /** Push current music bus (× optional mul) to every music output. */
    pushMusicBusVolume(mul) {
        const scale = mul == null ? 1 : Number(mul);
        const bus = Math.max(0, Math.min(1, this.musicBusVolume() * (Number.isFinite(scale) ? scale : 1)));
        if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.setVolume) {
            youtubeSoundtrackManager.setVolume(bus);
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setVolume) {
            localAudioManager.setVolume(bus);
        }
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setVolume) {
            vfTrackerManager.setVolume(bus);
        }
        return bus;
    }

    canPlaySfx() {
        return !!(this.enabled && this.ensureContext() && this.soundEnabled);
    }

    canPlayMusic() {
        return !!(this.enabled && this.ensureContext() && this.musicEnabled);
    }

    /** Remember what should play once AudioContext unlocks. */
    notePendingMusic(kind, id) {
        this._pendingMusic = { kind: kind || null, id: id || null };
    }

    clearPendingMusic() {
        this._pendingMusic = null;
    }

    resumePendingMusic() {
        if (!this.musicEnabled) return;
        if (!this.ensureContext()) return;
        const pending = this._pendingMusic;
        this._pendingMusic = null;
        if (pending && (pending.kind === 'victory' || pending.kind === 'lose')) {
            if (this.startEndMusic) this.startEndMusic(pending.kind);
            return;
        }
        if (this._musicContextActive && this._reevaluateMusic) {
            this._activeOverrideKey = null;
            this._reevaluateMusic();
            return;
        }
        if (this.ambientPlanetId) {
            this.startPlanetAmbient(this.ambientPlanetId);
            return;
        }
        if (pending && pending.kind === 'planet' && pending.id) {
            this.startPlanetAmbient(pending.id);
            return;
        }
        if (pending && pending.kind === 'menu') {
            this.startMenuMusic();
            return;
        }
        if (this.startMenuMusic) this.startMenuMusic();
    }

    // --- Synth primitives ---

    /** Release Web Audio nodes after stop so long combat sessions don't retain graphs. */
    _autoRelease(nodes, when) {
        const list = nodes || [];
        const done = () => {
            for (let i = 0; i < list.length; i++) {
                try { list[i].disconnect(); } catch (e) { /* already gone */ }
            }
        };
        const lead = list[0];
        if (lead && typeof lead.addEventListener === 'function') {
            try {
                lead.addEventListener('ended', done, { once: true });
                return;
            } catch (e) { /* fall through */ }
        }
        this.schedule(done, Math.max(30, Math.ceil((when || 0.05) * 1000) + 40));
    }

    /** Shared decaying-noise buffer — createNoiseBurst used to allocate a new AudioBuffer every shot. */
    _noiseBurstBuffer(ctx, duration) {
        // Bucket durations so many SFX share one buffer (0.05 / 0.08 / 0.1 …).
        const bucket = Math.max(0.03, Math.ceil(duration * 40) / 40);
        if (!this._noiseBufCache) this._noiseBufCache = Object.create(null);
        let buffer = this._noiseBufCache[bucket];
        if (buffer && buffer.sampleRate === ctx.sampleRate) return buffer;
        const len = Math.max(1, Math.floor(ctx.sampleRate * bucket));
        buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const keys = Object.keys(this._noiseBufCache);
        if (keys.length > 24) delete this._noiseBufCache[keys[0]];
        this._noiseBufCache[bucket] = buffer;
        return buffer;
    }

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
        this._autoRelease([osc, gain], duration + 0.02);
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
        this._autoRelease([osc, gain], duration + 0.02);
    }

    createNoiseBurst(duration, volumeScale, filterFreq) {
        if (!this.canPlaySfx()) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBurstBuffer(ctx, duration);
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
        this._autoRelease([src, filter, gain], duration + 0.02);
    }

    createDualTone(freq1, freq2, duration, type, volumeScale) {
        if (!this.canPlaySfx()) return;
        this.createBeep(freq1, duration, type || 'sine', (volumeScale || 1) * 0.7);
        this.createBeep(freq2, duration, type || 'sine', (volumeScale || 1) * 0.5);
    }

    schedule(fn, delayMs) {
        const id = setTimeout(() => {
            const idx = this.activeTimeouts.indexOf(id);
            if (idx !== -1) this.activeTimeouts.splice(idx, 1);
            fn();
        }, delayMs);
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
                if (this.playEnv) this.playEnv(id, o);
                break;
        }
    }

    playWeaponShoot(weaponId) {
        const id = String(weaponId || 'laser').toLowerCase();
        switch (id) {
            case 'laser':
                this.createSweep(1200, 600, 0.14, 'sine', 0.8);
                break;
            case 'pierce':
                this.createSweep(1800, 300, 0.22, 'sine', 0.75);
                this.createBeep(2200, 0.03, 'sine', 0.3);
                break;
            case 'claw_beam':
                this.createDualTone(900, 1500, 0.12, 'sawtooth', 0.7);
                this.createSweep(1100, 700, 0.1, 'sine', 0.4);
                break;
            case 'laser_twin':
                this.createSweep(1200, 600, 0.14, 'sine', 0.65);
                this.schedule(() => this.createSweep(1260, 630, 0.14, 'sine', 0.65), 18);
                break;
            case 'spread':
                this.createSweep(900, 500, 0.08, 'square', 0.7);
                this.schedule(() => this.createSweep(750, 420, 0.06, 'square', 0.45), 30);
                this.schedule(() => this.createSweep(820, 480, 0.06, 'square', 0.4), 55);
                break;
            case 'burst':
                this.createSweep(1000, 600, 0.05, 'square', 0.65);
                this.schedule(() => this.createSweep(950, 560, 0.05, 'square', 0.5), 20);
                break;
            case 'spike_burst':
                this.createSweep(900, 500, 0.07, 'square', 0.7);
                this.createNoiseBurst(0.05, 0.4, 1800);
                this.schedule(() => this.createSweep(820, 460, 0.06, 'square', 0.4), 30);
                break;
            case 'rapid':
                this.createSweep(1600, 900, 0.06, 'sine', 0.55);
                break;
            case 'plasma':
                this.createSweep(480, 220, 0.18, 'triangle', 0.9);
                this.createBeep(180, 0.12, 'sine', 0.35);
                break;
            case 'ion':
                this.createSweep(700, 1400, 0.1, 'triangle', 0.6);
                this.createBeep(2000, 0.02, 'sine', 0.3);
                break;
            case 'wave':
                this.createSweep(260, 420, 0.22, 'sine', 0.55);
                this.schedule(() => this.createSweep(420, 260, 0.18, 'sine', 0.4), 60);
                break;
            case 'missile':
                this.createNoiseBurst(0.08, 0.8, 500);
                this.createSweep(220, 80, 0.2, 'sawtooth', 0.85);
                break;
            case 'nova':
                this.createNoiseBurst(0.1, 0.9, 650);
                this.createDualTone(260, 400, 0.18, 'sawtooth', 0.7);
                break;
            case 'railgun':
                this.createNoiseBurst(0.06, 0.6, 2500);
                this.createSweep(2400, 200, 0.26, 'sawtooth', 0.95);
                break;
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

    // --- UI sounds ---

    playUIClick() {
        this.createBeep(720, 0.04, 'triangle', 0.8);
    }

    playUIHover() {
        this.createBeep(900, 0.025, 'sine', 0.35);
    }

    playUIConfirm() {
        this.createBeep(560, 0.05, 'sine', 0.9);
        this.schedule(() => this.createBeep(880, 0.08, 'sine', 0.8), 50);
    }

    playUIDeny() {
        this.createBeep(140, 0.12, 'square', 0.5);
    }

    playUIOpen() {
        this.createSweep(400, 900, 0.12, 'sine', 0.8);
    }

    playUIClose() {
        this.createSweep(700, 320, 0.1, 'sine', 0.7);
    }

    playUITab() {
        this.createBeep(620, 0.035, 'square', 0.6);
    }
}
