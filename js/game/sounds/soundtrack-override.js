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
        const ambientKey = 'ambient:' + (planetId || 'mars')
            + ':' + (stageId || '')
            + ':' + (this._currentHostileFaction || '');
        // Same combat song already playing (e.g. next stage, same planet) → keep position.
        if (this._combatSongAlreadyPlaying(planetId) && !this._resolveSoundtrackOverride()) {
            this._pendingMissionIntro = false;
            this._introPlaying = false;
            this._activeOverrideKey = ambientKey;
            // Undo victory duck / stale bus level without restarting the loop.
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
            else if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setVolume) {
                vfTrackerManager.setVolume(this.musicBusVolume ? this.musicBusVolume() : VFVolume.busDefault());
            }
            return;
        }
        // Always re-bind combat music when a stage boots (don't trust stale keys).
        this._activeOverrideKey = null;
        // No one-shot intro fanfare — that played a short track then hard-cut
        // into the combat loop (heard as "one song, then another jumps in").
        // Hub/map → combat crossfades once via play().
        this._pendingMissionIntro = false;
        this._introPlaying = false;
        this._reevaluateMusic();
        this._ensureCombatMusicPlaying();
    },

    /** True when the preferred track for this stage is already audible. */
    _combatSongAlreadyPlaying(planetId) {
        if (typeof vfTrackerManager === 'undefined' || !vfTrackerManager.isPlaying
            || !vfTrackerManager.isPlaying()) {
            return false;
        }
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || this._currentPlanetId || 'mars')
            : String(planetId || this._currentPlanetId || 'mars').toLowerCase().split('-')[0];
        // Prefer-only: never treat regular combat as "same song" during boss
        // (that left the stage loop running through the boss chamber).
        const keys = this.combatTrackKeys
            ? this.combatTrackKeys(id, this._currentStageId, this._currentHostileFaction, { preferOnly: true })
            : [id];
        const target = vfTrackerManager.firstPlayableKey
            ? vfTrackerManager.firstPlayableKey(keys)
            : null;
        return !!(target && vfTrackerManager.isPlaying(target));
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

    /**
     * Mission intro fanfare disabled — it interrupted combat/hub too often.
     * Stage boot goes straight to the combat loop via startPlanetAmbient.
     */
    _startMissionIntroThenCombat(/* planetId */) {
        this._pendingMissionIntro = false;
        this._introPlaying = false;
        return false;
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
        const raw = types || [];
        // Stable key from call order (game-loop push order) — no sort/filter alloc
        // on the quiet path when nothing changed.
        let key = '';
        for (let i = 0; i < raw.length; i++) {
            if (!raw[i]) continue;
            key += (key ? ',' : '') + raw[i];
        }
        if (key === this._activeEnemyTypesKey) return;
        this._activeEnemyTypesKey = key;
        const list = [];
        for (let i = 0; i < raw.length; i++) {
            if (raw[i]) list.push(raw[i]);
        }
        this._activeEnemyTypes = list;
        // Remember types for the next silent boot, but never yank an already
        // audible combat/hub song to an enemy/stage override mid-fight —
        // that was the "track jumps to something else" glitch.
        if (this._musicActuallyPlaying() && this._activeOverrideKey) return;
        const before = this._activeOverrideKey;
        this._reevaluateMusic();
        if (this._activeOverrideKey === before && this._musicActuallyPlaying()) return;
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

    /**
     * Candidate vftrack keys for current planet / stage / hostile faction.
     * Boss stages prefer *-boss keys only when `preferOnly` (keep-same checks);
     * playback may still list soft fallbacks afterward.
     */
    combatTrackKeys(planetId, stageId, factionId, opts) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || 'mars')
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        const stage = String(stageId || this._currentStageId || '').toLowerCase();
        const boss = stage === 'boss' || stage === 'b';
        const faction = String(factionId || this._currentHostileFaction || '').toLowerCase();
        const preferOnly = !!(opts && opts.preferOnly);
        const keys = [];
        // Prefer planet×faction (works for explored/ambush ids via motif mapping).
        // Do NOT fall back to bare faction:theme — that made every planet share
        // one loop whenever the planet slug wasn't mars..pluto.
        if (boss) {
            if (faction) keys.push(id + '-boss:' + faction);
            keys.push(id + '-boss');
            if (!preferOnly) {
                // Last-resort only — never used for "already playing" keep.
                if (faction) keys.push(id + ':' + faction);
                keys.push(id);
            }
            return keys;
        }
        if (faction) keys.push(id + ':' + faction);
        keys.push(id);
        return keys;
    },

    _musicActuallyPlaying() {
        // Intro path is retired — never treat a stale pending flag as audible.
        if (typeof vfTrackerManager !== 'undefined') {
            if (vfTrackerManager.isAudible && vfTrackerManager.isAudible()) return true;
            if (vfTrackerManager.isPlaying && vfTrackerManager.isPlaying()) return true;
        }
        if (typeof localAudioManager !== 'undefined') {
            if (localAudioManager.isAudible && localAudioManager.isAudible()) return true;
            if (localAudioManager.el && !localAudioManager.el.paused) return true;
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
        // Intro fanfare path retired — never re-arm it from enemy/stage churn.
        this._pendingMissionIntro = false;
        this._introPlaying = false;
        const resolved = this._resolveSoundtrackOverride();
        const overrideKey = resolved ? resolved.key : null;
        const ambientKey = overrideKey || ('ambient:' + (this._currentPlanetId || 'mars')
            + ':' + (this._currentStageId || '')
            + ':' + (this._currentHostileFaction || ''));

        // Skip when the same logical slot is already playing.
        if (ambientKey === this._activeOverrideKey && this._musicActuallyPlaying()) return;

        // Same actual song under a new slot (stage change, override key rename) → keep position.
        if (!resolved && this._combatSongAlreadyPlaying(this._currentPlanetId)) {
            this._activeOverrideKey = ambientKey;
            return;
        }
        if (resolved && this.musicEnabled) {
            const track = resolved.track;
            if (track.localAudioData && typeof localAudioManager !== 'undefined'
                && localAudioManager.el && !localAudioManager.el.paused
                && localAudioManager._currentDataUrl === track.localAudioData) {
                localAudioManager.currentKey = overrideKey;
                this._activeOverrideKey = ambientKey;
                return;
            }
            if (track.trackerData && typeof vfTrackerManager !== 'undefined'
                && vfTrackerManager.isPlaying && vfTrackerManager.isPlaying()
                && (vfTrackerManager.isPlaying(overrideKey)
                    || vfTrackerManager.currentKey === overrideKey)) {
                this._activeOverrideKey = ambientKey;
                return;
            }
            if (track.youtubeUrl && typeof youtubeSoundtrackManager !== 'undefined'
                && youtubeSoundtrackManager.enabled
                && youtubeSoundtrackManager.currentKey === overrideKey) {
                this._activeOverrideKey = ambientKey;
                return;
            }
        }

        this._activeOverrideKey = ambientKey;

        if (!resolved) {
            // Don't pre-stop here — startPlanetAmbient keeps position if same song.
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

        // Soft handoff between sources — play()/fadeOut crossfade the audible bus.
        if (!track.localAudioData && !track.trackerData) {
            this.stopPlanetAmbientNodesOnly({ fade: 0.85 });
        } else if (track.localAudioData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof vfTrackerManager !== 'undefined') {
                if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                else vfTrackerManager.stop();
            }
        } else if (track.trackerData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof localAudioManager !== 'undefined') {
                if (localAudioManager.fadeOut) localAudioManager.fadeOut();
                else localAudioManager.stop();
            }
        }

        const bus = this.pushMusicBusVolume
            ? this.pushMusicBusVolume()
            : (this.musicBusVolume ? this.musicBusVolume() : (this.masterVolume * this.musicVolume));
        if (track.localAudioData) {
            if (typeof localAudioManager !== 'undefined') {
                if (!this.pushMusicBusVolume) localAudioManager.setVolume(bus);
                localAudioManager.play(overrideKey, track.localAudioData);
            }
        } else if (track.trackerData) {
            if (typeof vfTrackerManager !== 'undefined') {
                if (!this.pushMusicBusVolume) vfTrackerManager.setVolume(bus);
                vfTrackerManager.play(overrideKey, track.trackerData);
            }
        } else if (track.youtubeUrl) {
            if (typeof localAudioManager !== 'undefined') {
                if (localAudioManager.fadeOut) localAudioManager.fadeOut();
                else localAudioManager.stop();
            }
            if (typeof vfTrackerManager !== 'undefined') {
                if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                else vfTrackerManager.stop();
            }
            if (typeof youtubeSoundtrackManager !== 'undefined') {
                youtubeSoundtrackManager.setEnabled(true);
                if (!this.pushMusicBusVolume) youtubeSoundtrackManager.setVolume(bus);
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
        // Leave the tracker bus up so startMenuMusic can crossfade combat→menu
        // (hard-stop made non-PLANET styles feel like the same loop continued).
    }
});
