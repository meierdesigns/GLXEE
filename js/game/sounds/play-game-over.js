"use strict";

// SoundManager methods, split from sounds.js.
extendClass(SoundManager, {
    playGameOver() {
        this._endMusicPlanet = this._currentPlanetId || this.ambientPlanetId || null;
        this._endMusicFaction = this._currentHostileFaction || null;
        // Stop combat reevaluation so defeat motif is not yanked back to stage BGM.
        if (this.clearMusicContext) this.clearMusicContext();
        this.clearActiveTimeouts();
        this.stopPlanetAmbientNodesOnly({ keepTracker: true });
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
        // Keep combat loop rolling through the victory screen. Swapping to the
        // victory fanfare (then back on next stage) felt like the old intro
        // fanfare every clear. Beeps still celebrate; music stays on the bus.
        this.clearActiveTimeouts();
        this.stopPlanetAmbientNodesOnly({ keepTracker: true, keepLocal: true });
        this.createBeep(500, 0.2, 'sine', 0.85);
        this.schedule(() => this.createBeep(600, 0.2, 'sine', 0.85), 200);
        this.schedule(() => this.createBeep(700, 0.2, 'sine', 0.9), 400);
        this.schedule(() => this.createBeep(800, 0.3, 'sine', 1), 600);
        if (typeof beatSyncManager !== 'undefined') beatSyncManager.stop();
        // Soft duck only — no track swap (55% of current music bus).
        if (this.pushMusicBusVolume) this.pushMusicBusVolume(0.55);
        else if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setVolume) {
            vfTrackerManager.setVolume((this.musicBusVolume ? this.musicBusVolume() : VFVolume.busDefault()) * 0.55);
        }
    },

    /** Menu difficulty + planet tier for scene-feel (tempo / STYLE intensity). */
    _musicSceneOpts(role, galaxyFaction) {
        const difficulty = (typeof difficultyConfigManager !== 'undefined'
            && difficultyConfigManager.current)
            ? String(difficultyConfigManager.current).toLowerCase()
            : 'normal';
        let planetTier = null;
        if (typeof game !== 'undefined' && game.currentLevel
            && game.currentLevel.planetTier != null) {
            planetTier = Number(game.currentLevel.planetTier);
        } else if (typeof levelManager !== 'undefined' && levelManager.currentLevel
            && levelManager.currentLevel.planetTier != null) {
            planetTier = Number(levelManager.currentLevel.planetTier);
        }
        return { role: role || 'menu', difficulty, planetTier, galaxyFaction: galaxyFaction || '' };
    },

    /** Galaxy faction for a planet id — drives AUTO STYLE's combat/boss genre pick. */
    _galaxyFactionForPlanet(planetId) {
        try {
            if (typeof planetConfigManager === 'undefined' || !planetConfigManager.configs) return '';
            const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
                ? VFTrackerDefaults.normalizePlanetKey(planetId)
                : String(planetId || '').toLowerCase().split('-')[0];
            const cfg = planetConfigManager.configs[id];
            const galaxyId = cfg && cfg.galaxyId;
            if (!galaxyId || !planetConfigManager.getGalaxy) return '';
            const galaxy = planetConfigManager.getGalaxy(galaxyId);
            return (galaxy && galaxy.faction) || '';
        } catch (e) {
            return '';
        }
    },

    _applyMusicScene(role, galaxyFaction) {
        if (typeof vfTrackerManager === 'undefined' || !vfTrackerManager.setSceneFeel) return;
        vfTrackerManager.setSceneFeel(this._musicSceneOpts(role, galaxyFaction));
    },

    /** Looping victory / lose vftrack, biased by hostile faction (+ optional planet). */
    startEndMusic(kind) {
        if (!this.musicEnabled) return;
        const mode = kind === 'victory' ? 'victory' : 'lose';
        this.notePendingMusic(mode, mode);
        if (!this.ensureContext()) return;
        const faction = String(this._endMusicFaction || this._currentHostileFaction || '').toLowerCase();
        const planet = String(this._endMusicPlanet || this._currentPlanetId || '').toLowerCase().split('-')[0];
        // Prefer planet Hauptmelodie; faction only skins instruments when both known.
        const keys = [];
        if (planet && faction) keys.push(mode + ':' + faction + ':' + planet);
        if (planet) keys.push(mode + ':' + planet);
        if (faction) keys.push(mode + ':' + faction);
        keys.push(mode);
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof localAudioManager !== 'undefined') localAudioManager.stop();
        if (typeof vfTrackerManager === 'undefined') return;
        this._applyMusicScene(mode);
        if (this.pushMusicBusVolume) this.pushMusicBusVolume();
        vfTrackerManager.setEnabled(true);
        if (vfTrackerManager.playFirst(keys)) this.clearPendingMusic();
    },

    /**
     * Trader / victory-shop / home-shop BGM — planet bazaar motif.
     * Pass `{ resume: 'victory'|'map'|'menu' }` so close can restore.
     */
    startShopMusic(planetId, opts) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId
                || this._endMusicPlanet
                || this._currentPlanetId
                || (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.selectedPlanetId)
                || 'mars')
            : String(planetId || this._currentPlanetId || 'mars').toLowerCase().split('-')[0];
        const key = 'shop:' + id;
        this._shopMusicResume = (opts && opts.resume) || this._shopMusicResume || 'menu';
        this.notePendingMusic('shop', key);
        if (!this.musicEnabled) return;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying
            && vfTrackerManager.isPlaying(key)) {
            this.clearPendingMusic();
            return;
        }
        this.stopPlanetAmbientNodesOnly({ keepTracker: true });
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof localAudioManager !== 'undefined'
            && localAudioManager.currentKey
            && localAudioManager.currentKey !== key) {
            if (localAudioManager.fadeOut) localAudioManager.fadeOut();
            else localAudioManager.stop();
        }
        if (!this.ensureContext()) return;
        if (typeof vfTrackerManager === 'undefined') return;
        this._applyMusicScene('shop');
        if (this.pushMusicBusVolume) this.pushMusicBusVolume();
        vfTrackerManager.setEnabled(true);
        const keys = [key, 'shop', 'menu'];
        if (vfTrackerManager.playFirst && vfTrackerManager.playFirst(keys)) {
            this.clearPendingMusic();
            return;
        }
        if (vfTrackerManager.playShop && vfTrackerManager.playShop(id)) {
            this.clearPendingMusic();
            return;
        }
        this.clearPendingMusic();
    },

    /** Leave shop bus — restore victory / map / menu depending on how shop opened. */
    stopShopMusic() {
        const resume = this._shopMusicResume || 'menu';
        this._shopMusicResume = null;
        if (!this.musicEnabled) return;
        if (resume === 'victory') {
            this.startEndMusic('victory');
            return;
        }
        if (resume === 'map' && this.startMapMusic) {
            const id = (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.selectedPlanetId)
                || this._currentPlanetId
                || 'mars';
            this.startMapMusic(id, { immediate: true });
            return;
        }
        if (this.startMenuMusic) this.startMenuMusic();
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

        // Intro fanfare retired — never divert combat boot through playIntro.
        this._pendingMissionIntro = false;
        this._introPlaying = false;

        if (!this._currentHostileFaction && this._resolveHostileFaction) {
            this._currentHostileFaction = this._resolveHostileFaction(id);
        }
        const combatKeys = this.combatTrackKeys
            ? this.combatTrackKeys(id, this._currentStageId, this._currentHostileFaction)
            : [id];
        if (combatKeys.indexOf(id) === -1) combatKeys.push(id);

        // Same preferred song already going — check BEFORE stop.
        // Prefer-only: boss must not keep a regular combat key that happens
        // to sit later in the fallback list.
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying) {
            const preferKeys = this.combatTrackKeys
                ? this.combatTrackKeys(id, this._currentStageId, this._currentHostileFaction, { preferOnly: true })
                : combatKeys;
            const keepKey = typeof vfTrackerManager.firstPlayableKey === 'function'
                ? vfTrackerManager.firstPlayableKey(preferKeys)
                : null;
            if (keepKey && vfTrackerManager.isPlaying(keepKey)) {
                // Restore full bus (victory duck left volume at ~55%).
                if (this.pushMusicBusVolume) this.pushMusicBusVolume();
                this.clearPendingMusic();
                return;
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
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
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
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
            const stage = String(this._currentStageId || '').toLowerCase();
            const boss = stage === 'boss' || stage === 'b';
            const transit = !boss && this._currentStageKind === 'transit';
            this._applyMusicScene(
                boss ? 'boss' : (transit ? 'corridor' : 'combat'),
                this._galaxyFactionForPlanet(id)
            );
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

    /**
     * Galaxy map BGM — per-planet Hauptmelodie (map role), interpreted by STYLE.
     * Debounced so arrow-hopping planets does not thrash the tracker bus.
     * Pass `{ immediate: true }` on map open so the first cue is not delayed.
     */
    startMapMusic(planetId, opts) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || this._currentPlanetId || 'mars')
            : String(planetId || this._currentPlanetId || 'mars').toLowerCase().split('-')[0];
        const key = 'map:' + id;
        this._pendingMapMusicId = id;
        this.notePendingMusic('map', key);
        if (!this.musicEnabled) return;
        // Already on this map motif — keep playhead (no restart).
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying
            && vfTrackerManager.isPlaying(key)) {
            this.clearPendingMusic();
            return;
        }
        if (opts && opts.immediate) {
            if (this._mapMusicTimer) {
                try { clearTimeout(this._mapMusicTimer); } catch (e) { /* ignore */ }
                this._mapMusicTimer = null;
            }
            this._applyMapMusic(id);
            return;
        }
        if (this._mapMusicTimer) {
            try { clearTimeout(this._mapMusicTimer); } catch (e) { /* ignore */ }
        }
        this._mapMusicTimer = setTimeout(() => {
            this._mapMusicTimer = null;
            if (this._pendingMapMusicId !== id) return;
            this._applyMapMusic(id);
        }, 280);
    },

    /**
     * Border checkpoint between systems — "pure Weltall": no planet motif,
     * galaxy-toned drone. Mirrors startMapMusic's debounce for arrow-hopping.
     */
    startMapVoidMusic(galaxyId) {
        const gid = String(galaxyId || '').toLowerCase();
        const key = gid ? 'map-void:' + gid : 'map-void';
        this._pendingMapMusicId = key;
        this.notePendingMusic('map', key);
        if (!this.musicEnabled) return;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying
            && vfTrackerManager.isPlaying(key)) {
            this.clearPendingMusic();
            return;
        }
        if (this._mapMusicTimer) {
            try { clearTimeout(this._mapMusicTimer); } catch (e) { /* ignore */ }
        }
        this._mapMusicTimer = setTimeout(() => {
            this._mapMusicTimer = null;
            if (this._pendingMapMusicId !== key) return;
            this._applyMapVoidMusic(gid);
        }, 280);
    },

    _applyMapVoidMusic(galaxyId) {
        const key = galaxyId ? 'map-void:' + galaxyId : 'map-void';
        if (!this.musicEnabled) return;
        this.stopPlanetAmbientNodesOnly({ keepTracker: true });
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (!this.ensureContext()) return;
        if (typeof vfTrackerManager === 'undefined') return;
        const voidFaction = (galaxyId && typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy)
            ? ((planetConfigManager.getGalaxy(galaxyId) || {}).faction || '')
            : '';
        this._applyMusicScene('map-void', voidFaction);
        if (this.pushMusicBusVolume) this.pushMusicBusVolume();
        vfTrackerManager.setEnabled(true);
        if (vfTrackerManager.isPlaying && vfTrackerManager.isPlaying(key)) {
            this.clearPendingMusic();
            return;
        }
        if (vfTrackerManager.playMapVoid && vfTrackerManager.playMapVoid(galaxyId)) {
            this.clearPendingMusic();
            return;
        }
        if (vfTrackerManager.playMenu) vfTrackerManager.playMenu();
        this.clearPendingMusic();
    },

    _applyMapMusic(planetId) {
        const id = (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.normalizePlanetKey)
            ? VFTrackerDefaults.normalizePlanetKey(planetId || 'mars')
            : String(planetId || 'mars').toLowerCase().split('-')[0];
        const key = 'map:' + id;
        if (!this.musicEnabled) return;
        this.stopPlanetAmbientNodesOnly({ keepTracker: true });
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof localAudioManager !== 'undefined'
            && localAudioManager.currentKey
            && localAudioManager.currentKey !== key) {
            if (localAudioManager.fadeOut) localAudioManager.fadeOut();
            else localAudioManager.stop();
        }
        if (!this.ensureContext()) return;
        if (typeof vfTrackerManager === 'undefined') return;
        this._applyMusicScene('map', this._galaxyFactionForPlanet(id));
        if (this.pushMusicBusVolume) this.pushMusicBusVolume();
        vfTrackerManager.setEnabled(true);
        if (vfTrackerManager.isPlaying && vfTrackerManager.isPlaying(key)) {
            this.clearPendingMusic();
            return;
        }
        const keys = [key, 'map', 'menu'];
        if (vfTrackerManager.playFirst && vfTrackerManager.playFirst(keys)) {
            this.clearPendingMusic();
            return;
        }
        if (vfTrackerManager.playMap && vfTrackerManager.playMap(id)) {
            this.clearPendingMusic();
            return;
        }
        if (vfTrackerManager.playMenu) vfTrackerManager.playMenu();
        this.clearPendingMusic();
    },

    /**
     * Story launch cutscene BGM — one-shot intro fanfare skinned by faction.
     * Always forces a scene-role music update (menu/hub → intro) so the
     * cutscene handoff is heard, not just a soft remix of the hub loop.
     */
    startStoryIntroMusic(factionId) {
        if (!this.musicEnabled) return false;
        const faction = String(factionId || '').toLowerCase();
        this.notePendingMusic('intro', faction ? ('intro:' + faction) : 'intro');
        this.stopPlanetAmbientNodesOnly({ keepTracker: true });
        if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
        if (typeof localAudioManager !== 'undefined' && localAudioManager.fadeOut) {
            try { localAudioManager.fadeOut(); } catch (e) { /* ignore */ }
        } else if (typeof localAudioManager !== 'undefined' && localAudioManager.stop) {
            try { localAudioManager.stop(); } catch (e) { /* ignore */ }
        }
        if (!this.ensureContext()) return false;
        if (typeof vfTrackerManager === 'undefined' || !vfTrackerManager.play) return false;
        this._applyMusicScene('intro', faction);
        if (this.pushMusicBusVolume) this.pushMusicBusVolume();
        vfTrackerManager.setEnabled(true);
        const keys = this.introTrackKeys
            ? this.introTrackKeys(null, faction)
            : (faction ? ['intro:' + faction, 'intro', 'title-intro'] : ['intro', 'title-intro']);
        const target = vfTrackerManager.firstPlayableKey
            ? vfTrackerManager.firstPlayableKey(keys)
            : (keys[0] || 'intro');
        if (!target) return false;
        const ok = vfTrackerManager.play(target, null, {
            fade: 0.95,
            fadeIn: 0.75,
            force: true,
            forceScene: true,
            galaxyFaction: faction
        });
        if (ok) this.clearPendingMusic();
        return !!ok;
    },

    startMenuMusic() {
        // Global title fanfare — once per session, before the Planet Select
        // hub loop takes over. Re-entrant: the onEnded callback below calls
        // startMenuMusic() again, which skips this block (flag already set)
        // and falls through to the normal menu logic.
        if (!this._titleIntroDone) {
            this._titleIntroDone = true;
            if (this.musicEnabled && typeof vfTrackerManager !== 'undefined' && vfTrackerManager.playTitleIntro
                && this.ensureContext && this.ensureContext()) {
                vfTrackerManager.playTitleIntro(() => this.startMenuMusic());
                return;
            }
        }
        // Embedded / open galaxy map owns the hub bus — don't yank it back to menu.
        if (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.isVisible
            && this.startMapMusic) {
            this.startMapMusic(galaxyMapManager.selectedPlanetId || 'mars');
            return;
        }
        if (this._mapMusicTimer) {
            try { clearTimeout(this._mapMusicTimer); } catch (e) { /* ignore */ }
            this._mapMusicTimer = null;
        }
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
        // Already on hub / map motif — keep going instead of restarting.
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying
            && vfTrackerManager.isPlaying()) {
            const ck = String(vfTrackerManager.currentKey || '');
            if (ck === 'menu' || ck === 'station' || ck === 'hub' || ck.indexOf('map:') === 0) {
                if (this.pushMusicBusVolume) this.pushMusicBusVolume();
                this.clearPendingMusic();
                return;
            }
        }

        const menuTrack = (typeof soundtrackConfigManager !== 'undefined')
            ? soundtrackConfigManager.getMenuTrack() : null;
        // Same hub song already going (faction/wizard remount, station reopen) —
        // keep row position instead of restarting from the top.
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.isPlaying
            && vfTrackerManager.isPlaying('menu')
            && !(menuTrack && soundtrackConfigManager.hasTrack(menuTrack)
                && (menuTrack.localAudioData || menuTrack.youtubeUrl))) {
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
            this.clearPendingMusic();
            return;
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.isPlaying
            && localAudioManager.isPlaying('menu')
            && menuTrack && soundtrackConfigManager.hasTrack(menuTrack) && menuTrack.localAudioData) {
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
            this.clearPendingMusic();
            return;
        }
        if (menuTrack && soundtrackConfigManager.hasTrack(menuTrack) && menuTrack.localAudioData) {
            if (typeof youtubeSoundtrackManager !== 'undefined') youtubeSoundtrackManager.stop();
            if (typeof vfTrackerManager !== 'undefined') {
                if (vfTrackerManager.fadeOut) vfTrackerManager.fadeOut();
                else vfTrackerManager.stop();
            }
            if (typeof localAudioManager !== 'undefined') {
                if (this.pushMusicBusVolume) this.pushMusicBusVolume();
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
                if (this.pushMusicBusVolume) this.pushMusicBusVolume();
                // No force: play() keeps position when the same menu track is already audible.
                if (vfTrackerManager.play('menu', menuTrack.trackerData)) {
                    this.clearPendingMusic();
                }
            }
            return;
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.currentKey === 'menu') {
            localAudioManager.stop();
        }

        if (typeof youtubeSoundtrackManager !== 'undefined') {
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
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
            this._applyMusicScene('menu');
            if (this.pushMusicBusVolume) this.pushMusicBusVolume();
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
        if (this.pushMusicBusVolume) this.pushMusicBusVolume();
        else {
            const bus = this.musicBusVolume();
            if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.setVolume) {
                youtubeSoundtrackManager.setVolume(bus);
            }
            if (typeof localAudioManager !== 'undefined' && localAudioManager.setVolume) {
                localAudioManager.setVolume(bus);
            }
            if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setVolume) {
                vfTrackerManager.setVolume(bus);
            }
        }
        if (!this.ambientGain || !this.audioContext) return;
        const now = this.audioContext.currentTime;
        // Soft planet drone at 35% of the music bus (single intentional scale).
        const vol = this.musicEnabled ? this.musicVol(0.35) : 0.0001;
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.linearRampToValueAtTime(vol, now + 0.15);
    },

    // --- Volume / settings ---

    setMasterVolume(volume) {
        this.masterVolume = (typeof VFVolume !== 'undefined')
            ? VFVolume.normalize(volume)
            : Math.max(0, Math.min(1, Number(volume) || 0));
        this.updateAmbientVolume();
    },

    setSoundVolume(volume) {
        this.soundVolume = (typeof VFVolume !== 'undefined')
            ? VFVolume.normalize(volume)
            : Math.max(0, Math.min(1, Number(volume) || 0));
    },

    setMusicVolume(volume) {
        this.musicVolume = (typeof VFVolume !== 'undefined')
            ? VFVolume.normalize(volume)
            : Math.max(0, Math.min(1, Number(volume) || 0));
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
        } else {
            this.ensureMusicPlaying();
        }
    },

    /** Start (or resume) music for the current context if it isn't already audible. */
    ensureMusicPlaying() {
        if (!this.musicEnabled) return;
        // Include fading-out legs — volume drags must not spawn a second song.
        if (this._musicActuallyPlaying && this._musicActuallyPlaying()) return;
        if (this._musicContextActive) {
            // Keep the current override slot; only fill silence.
            this._ensureCombatMusicPlaying
                ? this._ensureCombatMusicPlaying()
                : this._reevaluateMusic();
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
