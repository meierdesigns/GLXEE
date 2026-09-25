"use strict";

// SoundManager methods, split from sounds.js.
extendClass(SoundManager, {
    playGameOver() {
        this.clearActiveTimeouts();
        this.stopPlanetAmbientNodesOnly();
        this.ambientPlanetId = null;
        this.createBeep(300, 0.3, 'sine', 0.9);
        this.schedule(() => this.createBeep(250, 0.3, 'sine', 0.85), 300);
        this.schedule(() => this.createBeep(200, 0.5, 'sine', 0.9), 600);
        if (typeof beatSyncManager !== 'undefined') beatSyncManager.stop();
    },

    playVictory() {
        this.clearActiveTimeouts();
        this.stopPlanetAmbientNodesOnly();
        this.ambientPlanetId = null;
        this.createBeep(500, 0.2, 'sine', 0.85);
        this.schedule(() => this.createBeep(600, 0.2, 'sine', 0.85), 200);
        this.schedule(() => this.createBeep(700, 0.2, 'sine', 0.9), 400);
        this.schedule(() => this.createBeep(800, 0.3, 'sine', 1), 600);
        if (typeof beatSyncManager !== 'undefined') beatSyncManager.stop();
    },

    playPowerUp() {
        this.clearActiveTimeouts();
        this.createBeep(600, 0.1, 'square', 0.8);
        this.schedule(() => this.createBeep(800, 0.1, 'square', 0.85), 100);
        this.schedule(() => this.createBeep(1000, 0.2, 'square', 0.95), 200);
    },

    // --- Planet ambient (music bus) ---

    startPlanetAmbient(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        this.ambientPlanetId = id;
        this.stopPlanetAmbientNodesOnly();

        if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.hasPlanetTrack(id)) {
            if (!this.musicEnabled) {
                youtubeSoundtrackManager.setEnabled(false);
                if (typeof beatSyncManager !== 'undefined') beatSyncManager.start(id);
                return;
            }
            youtubeSoundtrackManager.setEnabled(true);
            youtubeSoundtrackManager.setVolume(this.masterVolume * this.musicVolume);
            youtubeSoundtrackManager.playPlanet(id);
            if (typeof beatSyncManager !== 'undefined') {
                beatSyncManager.start(id);
            }
            return;
        }
        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.stop();
        }
        if (!this.canPlayMusic()) {
            if (typeof beatSyncManager !== 'undefined') {
                beatSyncManager.start(id);
            }
            return;
        }

        const profile = this.planetAmbient[id] || this.planetAmbient.mars;
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = profile.type;
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(profile.base, now);
        osc2.frequency.setValueAtTime(profile.base * 1.5, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(profile.filter, now);
        filter.Q.setValueAtTime(0.7, now);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(profile.lfo, now);
        lfoGain.gain.setValueAtTime(profile.filter * 0.35, now);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        const vol = this.musicVol(0.35);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 1.2);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc2.start(now);
        lfo.start(now);

        this.ambientGain = gain;
        this.ambientNodes = { osc, osc2, filter, gain, lfo, lfoGain };

        if (typeof beatSyncManager !== 'undefined') {
            beatSyncManager.start(id);
        }
    },

    stopPlanetAmbientNodesOnly() {
        if (!this.ambientNodes) return;
        const nodes = this.ambientNodes;
        const ctx = this.audioContext;
        try {
            if (this.ambientGain && ctx) {
                const now = ctx.currentTime;
                this.ambientGain.gain.cancelScheduledValues(now);
                this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);
                this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
            }
            const stopAt = (ctx ? ctx.currentTime : 0) + 0.3;
            if (nodes.osc) nodes.osc.stop(stopAt);
            if (nodes.osc2) nodes.osc2.stop(stopAt);
            if (nodes.lfo) nodes.lfo.stop(stopAt);
        } catch (e) {
            // ignore stop races
        }
        this.ambientNodes = null;
        this.ambientGain = null;
    },

    stopPlanetAmbient() {
        this.stopPlanetAmbientNodesOnly();
        if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.mode === 'planet') {
            youtubeSoundtrackManager.stop();
        }
        if (typeof beatSyncManager !== 'undefined') {
            beatSyncManager.stop();
        }
        // keep ambientPlanetId so music toggle can restart
    },

    setPlanetAmbient(planetId) {
        this.startPlanetAmbient(planetId);
    },

    startMenuMusic() {
        if (typeof youtubeSoundtrackManager === 'undefined') return;
        youtubeSoundtrackManager.setVolume(this.masterVolume * this.musicVolume);
        youtubeSoundtrackManager.setEnabled(!!this.musicEnabled);
        if (!this.musicEnabled || !youtubeSoundtrackManager.hasMenuTrack()) {
            youtubeSoundtrackManager.stop();
            return;
        }
        this.stopPlanetAmbientNodesOnly();
        this.ambientPlanetId = null;
        youtubeSoundtrackManager.playMenu();
    },

    stopMenuMusic() {
        if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.mode === 'menu') {
            youtubeSoundtrackManager.stop();
        }
    },

    updateAmbientVolume() {
        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setVolume(this.masterVolume * this.musicVolume);
        }
        if (!this.ambientGain || !this.audioContext) return;
        const now = this.audioContext.currentTime;
        const vol = this.musicEnabled ? this.musicVol(0.35) : 0.0001;
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.linearRampToValueAtTime(vol, now + 0.15);
    },

    // --- Volume / settings ---

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateAmbientVolume();
    },

    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
    },

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateAmbientVolume();
    },

    getMasterVolume() {
        return this.masterVolume;
    },

    getSoundVolume() {
        return this.soundVolume;
    },

    getMusicVolume() {
        return this.musicVolume;
    },

    setSoundEnabled(enabled) {
        this.soundEnabled = !!enabled;
    },

    setEnabled(enabled) {
        this.setSoundEnabled(enabled);
    },

    setMusicEnabled(enabled) {
        this.musicEnabled = !!enabled;
        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setEnabled(this.musicEnabled);
        }
        if (!this.musicEnabled) {
            this.stopPlanetAmbientNodesOnly();
            if (typeof youtubeSoundtrackManager !== 'undefined') {
                youtubeSoundtrackManager.pause();
            }
        } else if (this.ambientPlanetId) {
            this.startPlanetAmbient(this.ambientPlanetId);
        } else if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.hasMenuTrack()) {
            this.startMenuMusic();
        }
    },

    getSoundEnabled() {
        return this.soundEnabled;
    },

    getMusicEnabled() {
        return this.musicEnabled;
    },
});
