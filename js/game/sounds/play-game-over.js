"use strict";

// SoundManager methods, split from sounds.js.
extendClass(SoundManager, {
    playGameOver() {
        this._endMusicPlanet = this._currentPlanetId || this.ambientPlanetId || null;
        this._endMusicFaction = this._currentHostileFaction || null;
        this.clearActiveTimeouts();
        this.stopPlanetAmbientNodesOnly();
        this.ambientPlanetId = null;
        this.createBeep(300, 0.3, 'sine', 0.9);
        this.schedule(() => this.createBeep(250, 0.3, 'sine', 0.85), 300);
        this.schedule(() => this.createBeep(200, 0.5, 'sine', 0.9), 600);
        if (typeof beatSyncManager !== 'undefined') beatSyncManager.stop();
        this.schedule(() => this.startEndMusic('lose'), 950);
    },

    playVictory() {
        this._endMusicPlanet = this._currentPlanetId || this.ambientPlanetId || null;
        this._endMusicFaction = this._currentHostileFaction || null;
        this.clearActiveTimeouts();
        this.stopPlanetAmbientNodesOnly();
        this.ambientPlanetId = null;
        this.createBeep(500, 0.2, 'sine', 0.85);
        this.schedule(() => this.createBeep(600, 0.2, 'sine', 0.85), 200);
        this.schedule(() => this.createBeep(700, 0.2, 'sine', 0.9), 400);
        this.schedule(() => this.createBeep(800, 0.3, 'sine', 1), 600);
        if (typeof beatSyncManager !== 'undefined') beatSyncManager.stop();
        this.schedule(() => this.startEndMusic('victory'), 900);
    },

    /** Looping victory / lose vftrack, biased by hostile faction (+ optional planet). */
    startEndMusic(kind) {
        if (!this.musicEnabled) return;
        const mode = kind === 'victory' ? 'victory' : 'lose';
        this.notePendingMusic(mode, mode);
        if (!this.ensureContext()) return;
        const faction = String(this._endMusicFaction || this._currentHostileFaction || '').toLowerCase();
        const planet = String(this._endMusicPlanet || this._currentPlanetId || '').toLowerCase().split('-')[0];
        const keys = [];
        if (planet && faction) keys.push(mode + ':' + faction + ':' + planet);
        if (faction) keys.push(mode + ':' + faction);
        if (planet) keys.push(mode + ':' + planet);
        keys.push(mode);
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
        if (typeof vfTrackerManager === 'undefined') return;
        vfTrackerManager.setVolume(this.musicBusVolume());
        vfTrackerManager.setEnabled(true);
        if (vfTrackerManager.playFirst(keys)) this.clearPendingMusic();
    },

    playPowerUp() {
        this.clearActiveTimeouts();
        this.createBeep(600, 0.1, 'square', 0.8);
        this.schedule(() => this.createBeep(800, 0.1, 'square', 0.85), 100);
        this.schedule(() => this.createBeep(1000, 0.2, 'square', 0.95), 200);
    },

    // --- Planet ambient (music bus) ---

    startPlanetAmbient(planetId) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || 'mars')
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        this.ambientPlanetId = id;
        this.notePendingMusic('planet', id);
        this.markAudioUnlocked && this.markAudioUnlocked();

        // Mission boot: coded intro fanfare, then this method again for combat.
        if (this._pendingMissionIntro && this.musicEnabled && !this._introPlaying) {
            if (this._startMissionIntroThenCombat && this._startMissionIntroThenCombat(id)) {
                return;
            }
        }
        // Intro already owning the bus — don't clobber it with combat yet.
        if (this._introPlaying) return;

        if (!this._currentHostileFaction && this._resolveHostileFaction) {
            this._currentHostileFaction = this._resolveHostileFaction(id);
        }
        const combatKeys = this.combatTrackKeys
            ? this.combatTrackKeys(id, this._currentStageId, this._currentHostileFaction)
            : [id];
        if (combatKeys.indexOf(id) === -1) combatKeys.push(id);

        // Same song already going — check BEFORE stop, or we always restart.
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying) {
            const keepKey = typeof vfTrackerManager.firstPlayableKey === 'function'
                ? vfTrackerManager.firstPlayableKey(combatKeys)
                : null;
            if (keepKey && vfTrackerManager.isPlaying(keepKey)) {
                this.clearPendingMusic();
                return;
            }
            for (let i = 0; i < combatKeys.length; i++) {
                if (vfTrackerManager.isPlaying(combatKeys[i])) {
                    this.clearPendingMusic();
                    return;
                }
            }
        }
        if (typeof youtubeSoundtrackManager !== 'undefined'
            && youtubeSoundtrackManager.hasPlanetTrack
            && youtubeSoundtrackManager.hasPlanetTrack(id)
            && youtubeSoundtrackManager.mode === 'planet'
            && youtubeSoundtrackManager.currentKey === id
            && youtubeSoundtrackManager.enabled) {
            this.clearPendingMusic();
            return;
        }

        // Fade drone only — tracker/local crossfade inside their play()/fadeOut().
        this.stopPlanetAmbientNodesOnly({ keepTracker: true, keepLocal: true });

        // Leaving hub: fade menu sources so they can't mask planet music.
        if (typeof localAudioManager !== 'undefined' && localAudioManager.currentKey === 'menu') {
            if (localAudioManager.fadeOut) localAudioManager.fadeOut();
            else localAudioManager.stop();
        }

        if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.hasPlanetTrack(id)) {
            if (typeof vfTrackerManager !== 'undefined') {
                if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                else vfTrackerManager.stop();
            }
            if (!this.musicEnabled) {
                youtubeSoundtrackManager.setEnabled(false);
                if (typeof beatSyncManager !== 'undefined') beatSyncManager.start(id);
                return;
            }
            youtubeSoundtrackManager.setEnabled(true);
            youtubeSoundtrackManager.setVolume(this.musicBusVolume());
            youtubeSoundtrackManager.playPlanet(id);
            this.clearPendingMusic();
            if (typeof beatSyncManager !== 'undefined') {
                beatSyncManager.start(id);
            }
            return;
        }
        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.stop();
        }
        if (!this.musicEnabled) {
            if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
            if (typeof beatSyncManager !== 'undefined') beatSyncManager.start(id);
            return;
        }
        if (!this.ensureContext()) {
            // Wait for first user gesture (resumePendingMusic).
            if (typeof beatSyncManager !== 'undefined') beatSyncManager.start(id);
            return;
        }

        // Prefer coded vftrack: planet×faction (and boss) over the old drone.
        if (typeof vfTrackerManager !== 'undefined') {
            if (typeof localAudioManager !== 'undefined' && localAudioManager.el
                && !localAudioManager.el.paused) {
                if (localAudioManager.fadeOut) localAudioManager.fadeOut();
                else localAudioManager.stop();
            }
            vfTrackerManager.setEnabled(true);
            vfTrackerManager.setVolume(Math.max(0.05, this.musicBusVolume()));
            const played = vfTrackerManager.playFirst(combatKeys);
            if (played) {
                this.clearPendingMusic();
                return;
            }
        }

        // Last-resort soft drone if tracker failed to start.
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

    stopPlanetAmbientNodesOnly(opts) {
        const keepTracker = opts && opts.keepTracker;
        const keepLocal = opts && opts.keepLocal;
        if (!keepTracker && typeof vfTrackerManager !== 'undefined') {
            if (opts && opts.fade && vfTrackerManager.fadeOut) vfTrackerManager.fadeOut(opts.fade);
            else vfTrackerManager.stop();
        }
        if (!keepLocal && typeof localAudioManager !== 'undefined' && opts && opts.fadeLocal) {
            if (localAudioManager.fadeOut) localAudioManager.fadeOut(opts.fadeLocal);
        }
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
        this.notePendingMusic('menu', 'menu');
        if (!this.musicEnabled) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
            return;
        }
        // Keep tracker for combat→menu crossfade; only kill the soft drone bus.
        this.stopPlanetAmbientNodesOnly({ keepTracker: true });
        this.ambientPlanetId = null;

        const menuTrack = (typeof soundtrackConfigManager !== 'undefined')
            ? soundtrackConfigManager.getMenuTrack() : null;
        if (menuTrack && soundtrackConfigManager.hasTrack(menuTrack) && menuTrack.localAudioData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof vfTrackerManager !== 'undefined') {
                if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                else vfTrackerManager.stop();
            }
            if (typeof localAudioManager !== 'undefined') {
                localAudioManager.setVolume(this.musicBusVolume());
                localAudioManager.play('menu', menuTrack.localAudioData);
                this.clearPendingMusic();
            }
            return;
        }
        if (menuTrack && soundtrackConfigManager.hasTrack(menuTrack) && menuTrack.trackerData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof localAudioManager !== 'undefined') {
                if (localAudioManager.fadeOut) localAudioManager.fadeOut();
                else localAudioManager.stop();
            }
            if (!this.ensureContext()) return;
            if (typeof vfTrackerManager !== 'undefined') {
                vfTrackerManager.setVolume(this.musicBusVolume());
                if (vfTrackerManager.play('menu', menuTrack.trackerData, { force: true })) {
                    this.clearPendingMusic();
                }
            }
            return;
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.currentKey === 'menu') {
            localAudioManager.stop();
        }

        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setVolume(this.musicBusVolume());
            youtubeSoundtrackManager.setEnabled(!!this.musicEnabled);
            if (menuTrack && soundtrackConfigManager.hasTrack(menuTrack) && menuTrack.youtubeUrl) {
                if (typeof vfTrackerManager !== 'undefined') {
                    if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                    else vfTrackerManager.stop();
                }
                youtubeSoundtrackManager.playUrl('menu-override', menuTrack.youtubeUrl);
                this.clearPendingMusic();
                return;
            }
            if (youtubeSoundtrackManager.hasMenuTrack()) {
                if (typeof vfTrackerManager !== 'undefined') {
                    if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                    else vfTrackerManager.stop();
                }
                youtubeSoundtrackManager.playMenu();
                this.clearPendingMusic();
                return;
            }
            youtubeSoundtrackManager.stop();
        }

        if (!this.ensureContext()) return;
        if (typeof vfTrackerManager !== 'undefined') {
            vfTrackerManager.setVolume(this.musicBusVolume());
            if (vfTrackerManager.playMenu()) this.clearPendingMusic();
        }
    },

    stopMenuMusic() {
        if (typeof youtubeSoundtrackManager !== 'undefined'
            && (youtubeSoundtrackManager.mode === 'menu' || youtubeSoundtrackManager.currentKey === 'menu-override')) {
            youtubeSoundtrackManager.stop();
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.currentKey === 'menu') {
            localAudioManager.stop();
        }
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.currentKey === 'menu') {
            vfTrackerManager.stop();
        }
    },

    updateAmbientVolume() {
        const bus = this.musicBusVolume();
        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setVolume(bus);
        }
        if (typeof localAudioManager !== 'undefined') {
            localAudioManager.setVolume(bus);
        }
        if (typeof vfTrackerManager !== 'undefined') {
            vfTrackerManager.setVolume(bus);
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
            if (typeof localAudioManager !== 'undefined') {
                localAudioManager.stop();
            }
            if (typeof vfTrackerManager !== 'undefined') {
                vfTrackerManager.stop();
            }
        } else if (this._musicContextActive) {
            this._activeOverrideKey = null;
            this._reevaluateMusic();
        } else if (this.ambientPlanetId) {
            this.startPlanetAmbient(this.ambientPlanetId);
        } else {
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
