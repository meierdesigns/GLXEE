"use strict";

/**
 * Library + playback facade for vftrack soundtracks.
 * Storage: vf_tracker_library_v1 (per-key JSON tracks).
 * Keys include planet, planet:faction, planet-boss:faction, victory[:faction], lose[:faction].
 */
class VFTrackerManager {
    constructor() {
        this.storageKey = 'vf_tracker_library_v1';
        this.player = new VFTrackerPlayer();
        this.library = {};
        this.currentKey = null;
        this.enabled = true;
        this.volume = 0.2;
        this.loadLibrary();
        // Pick up persisted AUDIO → MUSIC SPEED (volumeControls may load earlier).
        if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.getMusicSpeed) {
            this.setTempoScale(volumeControlsManager.getMusicSpeed());
        } else {
            try {
                const saved = localStorage.getItem('vf_musicSpeed');
                if (saved != null) this.setTempoScale(parseFloat(saved));
            } catch (e) { /* ignore */ }
        }
    }

    loadLibrary() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && typeof data === 'object') this.library = data;
        } catch (e) {
            this.library = {};
        }
    }

    saveLibrary() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.library));
        } catch (e) {
            // quota — skip
        }
    }

    _builtInRaw(key) {
        const k = String(key || '');
        if (!k) return null;
        if (this.library[k]) return this.library[k];

        if (k === 'menu' || k === 'station' || k === 'hub') {
            return VFTrackerDefaults.menu();
        }
        if (k === 'intro' || k.indexOf('intro:') === 0) {
            if (typeof VFTrackerFactionCompose !== 'undefined') {
                const composed = VFTrackerFactionCompose.resolveKey(k);
                if (composed) return composed;
            }
            const planet = k.split(':')[1] || 'mars';
            return VFTrackerDefaults.intro(planet);
        }
        if (typeof VFTrackerFactionCompose !== 'undefined') {
            const composed = VFTrackerFactionCompose.resolveKey(k);
            if (composed) return composed;
        }
        if (typeof VFTrackerDefaults !== 'undefined' && VFTrackerDefaults.allKeys().indexOf(k) !== -1) {
            return VFTrackerDefaults.forPlanet(k);
        }
        // Bare planet id — including explored / ambush / editor slugs.
        if (k.indexOf(':') === -1 && /^[a-z][a-z0-9_]*(-boss)?$/.test(k)
            && k !== 'menu' && k !== 'intro' && k !== 'victory' && k !== 'lose'
            && k !== 'faction' && k !== 'station' && k !== 'hub') {
            return VFTrackerDefaults.forPlanet(k);
        }
        return null;
    }

    getTrack(key) {
        const raw = this._builtInRaw(key);
        if (!raw) return null;
        try { return VFTrackerParse.normalize(raw); } catch (e) { return null; }
    }

    hasTrack(key) {
        return !!this._builtInRaw(key);
    }

    setTrack(key, data) {
        const k = String(key || '').trim();
        if (!k) return false;
        if (!data) {
            delete this.library[k];
            this.saveLibrary();
            return true;
        }
        const normalized = VFTrackerParse.normalize(data);
        this.library[k] = VFTrackerParse.toCompact(normalized);
        this.saveLibrary();
        return true;
    }

    importJson(key, jsonText) {
        const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        return this.setTrack(key, data);
    }

    exportJson(key) {
        const track = this.getTrack(key);
        if (!track) return null;
        return JSON.stringify(VFTrackerParse.toCompact(track), null, 2);
    }

    listKeys() {
        const keys = new Set(VFTrackerDefaults.allKeys());
        keys.add('menu');
        keys.add('intro');
        keys.add('victory');
        keys.add('lose');
        ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'].forEach((p) => keys.add('intro:' + p));
        if (typeof VFTrackerFactionCompose !== 'undefined') {
            VFTrackerFactionCompose.FACTIONS.forEach((f) => {
                keys.add('faction:' + f);
                keys.add('victory:' + f);
                keys.add('lose:' + f);
                keys.add('intro:' + f);
                ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'].forEach((p) => {
                    keys.add(p + ':' + f);
                    keys.add(p + '-boss:' + f);
                    keys.add('intro:' + p + ':' + f);
                });
            });
        }
        Object.keys(this.library).forEach((k) => keys.add(k));
        return [...keys].sort();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, Number(v) || 0));
        this.player.setVolume(this.volume);
    }

    getTempoScale() {
        const s = Number(this.player && this.player.tempoScale);
        return Number.isFinite(s) && s > 0 ? s : 1;
    }

    setTempoScale(scale) {
        const s = Math.max(0.5, Math.min(4, Number(scale) || 1));
        if (this.player) this.player.tempoScale = s;
        if (this.player && this.player.isPlaying()
            && typeof beatSyncManager !== 'undefined' && beatSyncManager.setBpm) {
            beatSyncManager.setBpm(this.player.bpm);
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setPlaybackRate) {
            localAudioManager.setPlaybackRate(s);
        }
        return s;
    }

    setEnabled(on) {
        this.enabled = !!on;
        if (!this.enabled) this.stop();
    }

    play(key, trackOverride, opts) {
        if (!this.enabled) return false;
        const k = String(key || 'mars');
        let track = trackOverride || this.getTrack(k);
        if (!track) return false;
        const ctx = (opts && opts.context)
            || (typeof soundManager !== 'undefined' && soundManager.ensureContext
                ? soundManager.ensureContext() : null);
        if (!ctx) return false;
        this.currentKey = k;
        this.player.play(track, {
            context: ctx,
            volume: this.volume,
            onEnded: opts && opts.onEnded
        });
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.start) {
            const planetHint = (track.meta && track.meta.planet) || k.split(':')[0].split('-')[0];
            beatSyncManager.start(
                planetHint === 'menu' || planetHint === 'intro' ? 'mars' : planetHint,
                this.player.bpm || track.bpm
            );
        }
        return true;
    }

    /**
     * Play a one-shot intro, then invoke onEnded (combat loop, etc.).
     */
    playIntro(key, opts) {
        const k = String(key || 'intro');
        const track = (opts && opts.track) || this.getTrack(k);
        if (!track) return false;
        // Force non-loop even if a library override set loop:true.
        const oneShot = Object.assign({}, VFTrackerParse.toCompact(track), { loop: false });
        return this.play(k, oneShot, { onEnded: opts && opts.onEnded });
    }

    playPlanet(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        return this.play(id);
    }

    playMenu() {
        return this.play('menu');
    }

    /**
     * Try keys in order; first playable wins.
     */
    playFirst(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (let i = 0; i < list.length; i++) {
            const k = list[i];
            if (!k || !this.hasTrack(k)) continue;
            if (this.play(k)) return k;
        }
        return null;
    }

    stop() {
        this.player.stop(true);
        this.currentKey = null;
    }

    isPlaying(key) {
        if (key != null) return this.currentKey === key && this.player.isPlaying();
        return this.player.isPlaying();
    }

    downloadTrack(key, filename) {
        const json = this.exportJson(key);
        if (!json) return false;
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || ((key || 'track').replace(/:/g, '_') + '.vftrack.json');
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 500);
        return true;
    }
}

const vfTrackerManager = new VFTrackerManager();
