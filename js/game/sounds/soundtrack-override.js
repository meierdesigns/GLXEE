"use strict";

// Resolves soundtrack overrides on top of startPlanetAmbient()'s planet
// track / procedural drone: active enemy type > current stage > planet.
// Set by levelManager.buildStageLevel (stage context) and by game-loop.js
// (active enemy types), both best-effort / optional at the call sites.
extendClass(SoundManager, {
    setStageContext(planetId, stageId) {
        this._musicContextActive = true;
        this._currentPlanetId = planetId;
        this._currentStageId = stageId || null;
        this._reevaluateMusic();
    },

    setActiveEnemyTypes(types) {
        const list = (types || []).filter(Boolean);
        const key = list.slice().sort().join(',');
        if (key === this._activeEnemyTypesKey) return;
        this._activeEnemyTypesKey = key;
        this._activeEnemyTypes = list;
        this._reevaluateMusic();
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

    _reevaluateMusic() {
        if (!this._musicContextActive) return;
        const resolved = this._resolveSoundtrackOverride();
        const overrideKey = resolved ? resolved.key : null;
        if (overrideKey && overrideKey === this._activeOverrideKey) return;
        this._activeOverrideKey = overrideKey;

        if (!resolved) {
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            this.startPlanetAmbient(this._currentPlanetId || 'mars');
            return;
        }

        const track = resolved.track;
        if (!this.musicEnabled) {
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            this.stopPlanetAmbientNodesOnly();
            return;
        }

        this.stopPlanetAmbientNodesOnly();
        if (track.localAudioData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof localAudioManager !== 'undefined') {
                localAudioManager.setVolume(this.masterVolume * this.musicVolume);
                localAudioManager.play(overrideKey, track.localAudioData);
            }
        } else if (track.youtubeUrl) {
            if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
            if (typeof youtubeSoundtrackManager !== 'undefined') {
                youtubeSoundtrackManager.setEnabled(true);
                youtubeSoundtrackManager.setVolume(this.masterVolume * this.musicVolume);
                youtubeSoundtrackManager.playUrl(overrideKey, track.youtubeUrl);
            }
        }
    },

    clearMusicContext() {
        this._musicContextActive = false;
        this._currentPlanetId = null;
        this._currentStageId = null;
        this._activeEnemyTypes = [];
        this._activeEnemyTypesKey = null;
        this._activeOverrideKey = null;
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
    }
});
