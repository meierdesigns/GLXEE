"use strict";

// Resolves soundtrack overrides on top of startPlanetAmbient()'s planet×faction
// vftrack / YouTube / drone. Priority: enemy type > stage > planet:faction track.
// setStageContext also resolves the hostile faction for composition.
extendClass(SoundManager, {
    setStageContext(planetId, stageId) {
        this._musicContextActive = true;
        this._currentPlanetId = planetId;
        this._currentStageId = stageId || null;
        this._currentHostileFaction = this._resolveHostileFaction(planetId);
        // Always re-bind combat music when a stage boots (don't trust stale keys).
        this._activeOverrideKey = null;
        // Fresh stage boot → play one-shot intro before the combat loop.
        this._pendingMissionIntro = true;
        this._introPlaying = false;
        this._reevaluateMusic();
        this._ensureCombatMusicPlaying();
    },

    introTrackKeys(planetId, factionId) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || this._currentPlanetId || 'mars')
            : String(planetId || this._currentPlanetId || 'mars').toLowerCase().split('-')[0];
        const faction = String(factionId || this._currentHostileFaction || '').toLowerCase();
        const keys = [];
        if (faction) keys.push('intro:' + id + ':' + faction);
        keys.push('intro:' + id);
        if (faction) keys.push('intro:' + faction);
        keys.push('intro');
        return keys;
    },

    _startMissionIntroThenCombat(planetId) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || this._currentPlanetId || 'mars')
            : String(planetId || this._currentPlanetId || 'mars').toLowerCase().split('-')[0];
        if (typeof vfTrackerManager === 'undefined' || !vfTrackerManager.playIntro) {
            this._pendingMissionIntro = false;
            this._introPlaying = false;
            return false;
        }
        if (!this.ensureContext()) return false;
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
        this.stopPlanetAmbientNodesOnly && this.stopPlanetAmbientNodesOnly();
        const keys = this.introTrackKeys(id, this._currentHostileFaction);
        vfTrackerManager.setEnabled(true);
        vfTrackerManager.setVolume(Math.max(0.05, this.musicBusVolume()));
        let started = false;
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!vfTrackerManager.hasTrack(k)) continue;
            const ok = vfTrackerManager.playIntro(k, {
                onEnded: () => {
                    if (!this._introPlaying) return;
                    this._introPlaying = false;
                    this._pendingMissionIntro = false;
                    // Resume combat / override loop after the fanfare.
                    this._activeOverrideKey = null;
                    this.startPlanetAmbient(this._currentPlanetId || id);
                }
            });
            if (ok) {
                started = true;
                this._introPlaying = true;
                this._pendingMissionIntro = false;
                this.clearPendingMusic && this.clearPendingMusic();
                break;
            }
        }
        if (!started) {
            this._pendingMissionIntro = false;
            this._introPlaying = false;
        }
        return started;
    },

    _resolveHostileFaction(planetId) {
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        if (!pid) return '';
        try {
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getHostileFactions) {
                const list = planetConfigManager.getHostileFactions(pid) || [];
                if (list.length) return String(list[0]).toLowerCase();
            }
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetFactions) {
                const list = planetConfigManager.getPlanetFactions(pid) || [];
                if (list.length) return String(list[0]).toLowerCase();
            }
        } catch (e) { /* ignore */ }
        return '';
    },

    setActiveEnemyTypes(types) {
        const list = (types || []).filter(Boolean);
        const key = list.slice().sort().join(',');
        if (key === this._activeEnemyTypesKey) return;
        this._activeEnemyTypesKey = key;
        this._activeEnemyTypes = list;
        this._reevaluateMusic();
        this._ensureCombatMusicPlaying();
    },

    _resolveSoundtrackOverride() {
        if (typeof soundtrackConfigManager === 'undefined') return null;
        const enemyTypes = this._activeEnemyTypes || [];
        for (let i = 0; i < enemyTypes.length; i++) {
            const track = soundtrackConfigManager.getEnemyTrack(enemyTypes[i]);
            if (soundtrackConfigManager.hasTrack(track)) {
                return { track, key: 'enemy:' + enemyTypes[i] };
            }
        }
        if (this._currentStageId) {
            const track = soundtrackConfigManager.getStageTrack(this._currentStageId);
            if (soundtrackConfigManager.hasTrack(track)) {
                return { track, key: 'stage:' + this._currentStageId };
            }
        }
        return null;
    },

    /** Candidate vftrack keys for current planet / stage / hostile faction. */
    combatTrackKeys(planetId, stageId, factionId) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || 'mars')
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        const stage = String(stageId || this._currentStageId || '').toLowerCase();
        const boss = stage === 'boss' || stage === 'b';
        const faction = String(factionId || this._currentHostileFaction || '').toLowerCase();
        const keys = [];
        // Prefer planet×faction (works for explored/ambush ids via motif mapping).
        // Do NOT fall back to bare faction:theme — that made every planet share
        // one loop whenever the planet slug wasn't mars..pluto.
        if (boss && faction) keys.push(id + '-boss:' + faction);
        if (faction) keys.push(id + ':' + faction);
        if (boss) keys.push(id + '-boss');
        keys.push(id);
        return keys;
    },

    _musicActuallyPlaying() {
        if (this._introPlaying) return true;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying && vfTrackerManager.isPlaying()) {
            return true;
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.el && !localAudioManager.el.paused) {
            return true;
        }
        if (typeof youtubeSoundtrackManager !== 'undefined'
            && youtubeSoundtrackManager.mode
            && youtubeSoundtrackManager.enabled) {
            return true;
        }
        if (this.ambientNodes) return true;
        return false;
    },

    _ensureCombatMusicPlaying() {
        if (!this._musicContextActive || !this.musicEnabled) return;
        if (this._musicActuallyPlaying()) return;
        this._activeOverrideKey = null;
        this.startPlanetAmbient(this._currentPlanetId || this.ambientPlanetId || 'mars');
    },

    _reevaluateMusic() {
        if (!this._musicContextActive) return;
        // Never interrupt the launch fanfare for enemy/stage override swaps.
        if (this._introPlaying || this._pendingMissionIntro) {
            if (this._pendingMissionIntro && this.musicEnabled) {
                this._startMissionIntroThenCombat(this._currentPlanetId || 'mars');
            }
            return;
        }
        const resolved = this._resolveSoundtrackOverride();
        const overrideKey = resolved ? resolved.key : null;
        const ambientKey = overrideKey || ('ambient:' + (this._currentPlanetId || 'mars')
            + ':' + (this._currentStageId || '')
            + ':' + (this._currentHostileFaction || ''));

        // Skip only when the same key is already audibly playing.
        if (ambientKey === this._activeOverrideKey && this._musicActuallyPlaying()) return;
        this._activeOverrideKey = ambientKey;

        if (!resolved) {
            // Don't pre-stop here — startPlanetAmbient stops/restarts cleanly.
            this.startPlanetAmbient(this._currentPlanetId || 'mars');
            return;
        }

        const track = resolved.track;
        if (!this.musicEnabled) {
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
            this.stopPlanetAmbientNodesOnly();
            return;
        }

        this.stopPlanetAmbientNodesOnly();
        const bus = this.musicBusVolume ? this.musicBusVolume() : (this.masterVolume * this.musicVolume);
        if (track.localAudioData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
            if (typeof localAudioManager !== 'undefined') {
                localAudioManager.setVolume(bus);
                localAudioManager.play(overrideKey, track.localAudioData);
            }
        } else if (track.trackerData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof vfTrackerManager !== 'undefined') {
                vfTrackerManager.setVolume(bus);
                vfTrackerManager.play(overrideKey, track.trackerData);
            }
        } else if (track.youtubeUrl) {
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
            if (typeof youtubeSoundtrackManager !== 'undefined') {
                youtubeSoundtrackManager.setEnabled(true);
                youtubeSoundtrackManager.setVolume(bus);
                youtubeSoundtrackManager.playUrl(overrideKey, track.youtubeUrl);
            }
        }
    },

    clearMusicContext() {
        this._musicContextActive = false;
        this._currentPlanetId = null;
        this._currentStageId = null;
        this._currentHostileFaction = null;
        this._activeEnemyTypes = [];
        this._activeEnemyTypesKey = null;
        this._activeOverrideKey = null;
        this._pendingMissionIntro = false;
        this._introPlaying = false;
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
        if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.stop();
    }
});
