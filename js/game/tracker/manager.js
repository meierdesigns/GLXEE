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
        /** Crossfade length when swapping distinct tracks (seconds). */
        this.crossfadeSeconds = 1.4;
        this._outgoing = [];
        /** Manager-owned mixer state — survives fadeOut/stop player swaps. */
        this._themeIndex = 0;
        this._jungleAmount = 0;
        this.loadLibrary();
        /** Typical authored combat BPM — local-audio rate is musicBpm / this. */
        this.referenceBpm = 132;
        // Pick up persisted AUDIO → MUSIC BPM (volumeControls may load earlier).
        if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.getMusicBpm) {
            this.setPlaybackBpm(volumeControlsManager.getMusicBpm());
        } else if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.getMusicSpeed) {
            this.setPlaybackBpm(volumeControlsManager.getMusicSpeed() * this.referenceBpm);
        } else {
            try {
                const savedBpm = localStorage.getItem('vf_musicBpm');
                if (savedBpm != null) this.setPlaybackBpm(parseFloat(savedBpm));
                else {
                    const saved = localStorage.getItem('vf_musicSpeed');
                    if (saved != null) this.setPlaybackBpm(parseFloat(saved) * this.referenceBpm);
                }
            } catch (e) { /* ignore */ }
        }
        try {
            const xf = localStorage.getItem('vf_musicCrossfade');
            if (xf != null && Number.isFinite(parseFloat(xf))) {
                this.crossfadeSeconds = Math.max(0.2, Math.min(3, parseFloat(xf)));
            }
        } catch (e) { /* ignore */ }
        if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.getJungleAmount) {
            this.setJungleAmount(volumeControlsManager.getJungleAmount());
        } else {
            try {
                const j = localStorage.getItem('vf_musicJungle');
                if (j != null) this.setJungleAmount(parseFloat(j));
            } catch (e) { /* ignore */ }
        }
        if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.getMusicTheme != null) {
            this.setThemeIndex(volumeControlsManager.getMusicTheme());
        } else {
            try {
                const th = localStorage.getItem('vf_musicTheme');
                if (th != null) this.setThemeIndex(parseInt(th, 10));
            } catch (e) { /* ignore */ }
        }
        if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.applyChannelVoices) {
            volumeControlsManager.applyChannelVoices();
        } else {
            try {
                const raw = localStorage.getItem('vf_channelVoices');
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr) && arr.length === 4) {
                        for (let i = 0; i < 4; i++) this.setChannelVoice(i, arr[i]);
                    }
                }
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

    /** ch: 0=bass, 1=lead, 2=arp, 3=drums. v: 0-2 user fine-tune multiplier. */
    setChannelVolume(ch, v) {
        if (this.player && this.player.setChannelVolume) this.player.setChannelVolume(ch, v);
        (this._outgoing || []).forEach((p) => {
            if (p && p.setChannelVolume) p.setChannelVolume(ch, v);
        });
    }

    getChannelVolume(ch) {
        const mix = this.player && this.player.channelUserMix && this.player.channelUserMix[ch];
        return Number.isFinite(mix) ? mix : 1;
    }

    /** ch: 0=bass, 1=lead, 2=arp, 3=drums. voiceId from VFTrackerVoices. */
    setChannelVoice(ch, voiceId) {
        let id = 'default';
        if (this.player && this.player.setChannelVoice) {
            id = this.player.setChannelVoice(ch, voiceId);
        } else if (this.player) {
            if (!this.player.channelVoices) this.player.channelVoices = ['default', 'default', 'default', 'default'];
            this.player.channelVoices[ch] = String(voiceId || 'default');
            id = this.player.channelVoices[ch];
        }
        (this._outgoing || []).forEach((p) => {
            if (p && p.setChannelVoice) p.setChannelVoice(ch, voiceId);
            else if (p) {
                if (!p.channelVoices) p.channelVoices = ['default', 'default', 'default', 'default'];
                p.channelVoices[ch] = String(voiceId || 'default');
            }
        });
        return id;
    }

    getChannelVoice(ch) {
        const v = this.player && this.player.channelVoices && this.player.channelVoices[ch];
        return v || 'default';
    }

    getTempoScale() {
        const bpm = this.getPlaybackBpm();
        const ref = this.referenceBpm || 132;
        return Math.max(0.5, Math.min(4, bpm / ref));
    }

    getPlaybackBpm() {
        if (Number.isFinite(this._basePlaybackBpm) && this._basePlaybackBpm > 0) {
            return this._basePlaybackBpm;
        }
        const b = Number(this.player && this.player.playbackBpm);
        if (Number.isFinite(b) && b > 0) return b;
        const s = Number(this.player && this.player.tempoScale);
        const ref = this.referenceBpm || 132;
        if (Number.isFinite(s) && s > 0) return Math.round(ref * s);
        return Math.round(ref * 3.5);
    }

    /** Absolute playback tempo in BPM (game clock + tracker). */
    setPlaybackBpm(bpm) {
        const b = Math.max(60, Math.min(600, Math.round(Number(bpm) || 120)));
        this._basePlaybackBpm = b;
        return this._applyPlaybackTempo();
    }

    getJungleAmount() {
        if (Number.isFinite(this._jungleAmount)) return this._jungleAmount;
        const a = Number(this.player && this.player.jungleAmount);
        return Number.isFinite(a) ? a : 0;
    }

    /**
     * Style intensity 0..1 — how far into the selected STYLE
     * (break layer + mix morph + relative tempo boost on top of MUSIC BPM).
     */
    setJungleAmount(amount) {
        let t = Math.max(0, Math.min(1, Number(amount) || 0));
        if (t < 0.03) t = 0;
        this._jungleAmount = t;
        if (this.player && this.player.setJungleAmount) this.player.setJungleAmount(t);
        else if (this.player) this.player.jungleAmount = t;
        (this._outgoing || []).forEach((p) => {
            if (p && p.setJungleAmount) p.setJungleAmount(t);
            else if (p) p.jungleAmount = t;
        });
        this._applyPlaybackTempo();
        return t;
    }

    getThemeIndex() {
        if (Number.isFinite(this._themeIndex)) return this._themeIndex;
        return Number(this.player && this.player.themeIndex) || 0;
    }

    /** Melody / style index — see VFTrackerThemes.list (dropdown). */
    setThemeIndex(index) {
        const max = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
            ? VFTrackerThemes.count() - 1
            : 6;
        const i = Math.max(0, Math.min(max, Math.round(Number(index) || 0)));
        this._themeIndex = i;
        if (this.player && this.player.setThemeIndex) this.player.setThemeIndex(i);
        else if (this.player) this.player.themeIndex = i;
        (this._outgoing || []).forEach((p) => {
            if (p && p.setThemeIndex) p.setThemeIndex(i);
            else if (p) p.themeIndex = i;
        });
        this._applyPlaybackTempo();
        return i;
    }

    /**
     * Re-assert THEME / STYLE / channel mix from volume UI (or manager memory)
     * so every planet / menu / intro / combat swap keeps the selected head.
     */
    _reassertMixerSettings() {
        if (typeof volumeControlsManager !== 'undefined') {
            if (volumeControlsManager.getMusicTheme != null) {
                this.setThemeIndex(volumeControlsManager.getMusicTheme());
            }
            if (volumeControlsManager.getJungleAmount != null) {
                this.setJungleAmount(volumeControlsManager.getJungleAmount());
            }
            if (volumeControlsManager.applyChannelVolumes) {
                volumeControlsManager.applyChannelVolumes();
            }
            if (volumeControlsManager.applyChannelVoices) {
                volumeControlsManager.applyChannelVoices();
            }
            return;
        }
        this.setThemeIndex(this.getThemeIndex());
        this.setJungleAmount(this.getJungleAmount());
    }

    /**
     * Effective sequencer BPM = MUSIC BPM × style/theme boost × AMOUNT.
     * Style never ignores the BPM slider (no fixed 560 target).
     */
    _applyPlaybackTempo() {
        const base = Number.isFinite(this._basePlaybackBpm)
            ? this._basePlaybackBpm
            : this.getPlaybackBpm();
        const styleMag = Math.max(0, Math.min(1, Math.abs(this.getJungleAmount()) || 0));
        const themeIdx = this.getThemeIndex();
        const meta = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.metaOf)
            ? VFTrackerThemes.metaOf(themeIdx)
            : { tempoBoost: 0 };
        // Tempo tint scales with AMOUNT only — no forced floor that locks every
        // section to the same feel when a non-PLANET STYLE is selected.
        const themeBoost = themeIdx > 0 ? (Number(meta.tempoBoost) || 0) * styleMag : 0;
        const side = meta.breakSide || 'off';
        const styleBoost = side === 'jungle' || side === 'hybrid' ? styleMag * 0.35
            : side === 'dnb' ? styleMag * 0.24
                : side === 'drive' ? styleMag * 0.16
                    : side === 'elektro' ? styleMag * 0.12
                        : 0;
        const rel = 1 + Math.max(styleBoost, themeBoost);
        const b = Math.max(60, Math.min(600, Math.round(base * rel)));
        const ref = this.referenceBpm || 132;
        const scale = Math.max(0.5, Math.min(4, b / ref));
        if (this.player) {
            this.player.playbackBpm = b;
            this.player.tempoScale = scale;
        }
        (this._outgoing || []).forEach((p) => {
            if (!p) return;
            p.playbackBpm = b;
            p.tempoScale = scale;
        });
        if (this.player && this.player.isPlaying()
            && typeof beatSyncManager !== 'undefined' && beatSyncManager.setBpm) {
            beatSyncManager.setBpm(b);
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setPlaybackRate) {
            localAudioManager.setPlaybackRate(scale);
        }
        return b;
    }

    setTempoScale(scale) {
        const ref = this.referenceBpm || 132;
        this.setPlaybackBpm((Number(scale) || 1) * ref);
        return this.getTempoScale();
    }

    setEnabled(on) {
        this.enabled = !!on;
        if (!this.enabled) this.stop();
    }

    _fingerprint(track) {
        if (!track) return null;
        try {
            return JSON.stringify(VFTrackerParse.toCompact(VFTrackerParse.normalize(track)));
        } catch (e) {
            return null;
        }
    }

    /**
     * Coarse playback role for a library key. Keep-same only within a role —
     * combat→menu (planet select) must always swap, even under a non-PLANET style.
     */
    _trackRole(key) {
        const k = String(key || '').toLowerCase();
        if (!k) return 'combat';
        if (k === 'menu' || k === 'station' || k === 'hub') return 'menu';
        if (k === 'intro' || k.indexOf('intro:') === 0) return 'intro';
        if (k === 'victory' || k.indexOf('victory:') === 0) return 'victory';
        if (k === 'lose' || k.indexOf('lose:') === 0) return 'lose';
        return 'combat';
    }

    _syncPlayerSettings(target) {
        if (!target) return;
        const src = this.player;
        const theme = this.getThemeIndex();
        const jungle = this.getJungleAmount();
        const tempoScale = (src && src.tempoScale) || this.getTempoScale();
        const playbackBpm = (src && src.playbackBpm) || this.getPlaybackBpm();
        target.tempoScale = tempoScale;
        target.playbackBpm = playbackBpm;
        target.jungleAmount = jungle;
        target.themeIndex = theme;
        target.channelMixBase = ((src && src.channelMixBase) || [1.1, 0.42, 2.4, 1.25]).slice();
        target.channelMixJungle = ((src && src.channelMixJungle) || [1.75, 0.06, 0.95, 2.85]).slice();
        target.channelMixDnb = ((src && src.channelMixDnb) || [2.15, 0.1, 0.75, 1.95]).slice();
        target.channelMixJungleDnb = ((src && src.channelMixJungleDnb) || [1.95, 0.08, 0.85, 2.4]).slice();
        target.channelMixElektro = ((src && src.channelMixElektro) || [2.05, 0.16, 1.05, 1.95]).slice();
        target.channelMixLiquid = ((src && src.channelMixLiquid) || [1.45, 0.28, 1.65, 1.35]).slice();
        target.channelMixNightrun = ((src && src.channelMixNightrun) || [1.85, 0.72, 0.95, 2.05]).slice();
        target.channelMix = ((src && src.channelMix) || target.channelMixBase).slice();
        target.channelUserMix = ((src && src.channelUserMix) || [1, 1, 1, 1]).slice();
        target.channelVoices = ((src && src.channelVoices) || ['default', 'default', 'default', 'default']).slice();
        target.fadeSeconds = this.crossfadeSeconds;
        target.volume = this.volume;
        if (target.setJungleAmount) target.setJungleAmount(jungle);
        if (target.setThemeIndex) target.setThemeIndex(theme);
        if (target.setChannelVoice && target.channelVoices) {
            for (let i = 0; i < 4; i++) target.setChannelVoice(i, target.channelVoices[i]);
        }
    }

    _retireOutgoing(oldPlayer, fadeSec) {
        if (!oldPlayer) return;
        this._outgoing.push(oldPlayer);
        const dur = oldPlayer.fadeOut ? oldPlayer.fadeOut(fadeSec) : 0;
        setTimeout(() => {
            try { oldPlayer.stop(true); } catch (e) { /* ignore */ }
            this._outgoing = this._outgoing.filter((p) => p !== oldPlayer);
        }, Math.max(0.05, dur) * 1000 + 80);
    }

    play(key, trackOverride, opts) {
        if (!this.enabled) return false;
        const k = String(key || 'mars');
        let track = trackOverride || this.getTrack(k);
        if (!track) return false;
        // Theme / style belong on every song — reassert before keep-or-swap.
        this._reassertMixerSettings();
        // Same song already audible (even under a new key) — keep row position.
        // Never keep across roles (combat↔menu/intro/end): style heads must not
        // glue hub and in-game into one continuous loop (PLANET-style swaps).
        if (!(opts && opts.force) && !(opts && opts.onEnded) && this.player.isPlaying()) {
            const sameRole = this._trackRole(this.currentKey) === this._trackRole(k);
            if (sameRole) {
                const fp = this._fingerprint(track);
                if ((fp && fp === this._currentFingerprint) || this.currentKey === k) {
                    this.currentKey = k;
                    if (fp) this._currentFingerprint = fp;
                    return true;
                }
            }
        }
        const ctx = (opts && opts.context)
            || (typeof soundManager !== 'undefined' && soundManager.ensureContext
                ? soundManager.ensureContext() : null);
        if (!ctx) return false;

        const fade = opts && opts.fade != null
            ? Math.max(0, Number(opts.fade) || 0)
            : this.crossfadeSeconds;
        const wasPlaying = this.player.isPlaying();
        const hasOutgoing = !!(this._outgoing && this._outgoing.length);
        const doFade = fade > 0 && !(opts && opts.forceHard);

        // Crossfade: outgoing player keeps sounding while the new one fades in.
        if (wasPlaying && doFade) {
            const incoming = new VFTrackerPlayer();
            this._syncPlayerSettings(incoming);
            this._retireOutgoing(this.player, fade);
            this.player = incoming;
        } else {
            // Soft-stop left a blank player — stamp manager THEME onto it.
            this._syncPlayerSettings(this.player);
        }

        this.currentKey = k;
        this._currentFingerprint = this._fingerprint(track);
        // Always ease in when a fade is requested — covers intro→combat and
        // source handoffs where the previous player already finished.
        const fadeIn = opts && opts.fadeIn != null
            ? Math.max(0, Number(opts.fadeIn) || 0)
            : (doFade ? fade : 0);
        this.player.play(track, {
            context: ctx,
            volume: this.volume,
            fadeIn: (wasPlaying || hasOutgoing || doFade) ? fadeIn : 0,
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
        return this.play(k, oneShot, {
            onEnded: opts && opts.onEnded,
            fade: opts && opts.fade != null ? opts.fade : this.crossfadeSeconds
        });
    }

    playPlanet(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        return this.play(id);
    }

    playMenu() {
        // Always restart hub music when entering planet select / station —
        // same as PLANET (default) style song swaps, even with THEME heads on.
        return this.play('menu', null, { force: true });
    }

    /** First library/default key that would actually play from `keys`. */
    firstPlayableKey(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (let i = 0; i < list.length; i++) {
            const k = list[i];
            if (k && this.hasTrack(k)) return String(k);
        }
        return null;
    }

    /**
     * Try keys in order; first playable wins.
     * If that song is already playing, keep its position.
     */
    playFirst(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        const target = this.firstPlayableKey(list);
        if (!target) return null;
        if (this.currentKey === target && this.player.isPlaying()) return target;
        if (this.play(target)) return target;
        return null;
    }

    stop(opts) {
        const fade = opts && opts.fade != null ? Number(opts.fade) : 0;
        if (fade > 0 && this.player && this.player.isPlaying()) {
            this._retireOutgoing(this.player, fade);
            this.player = new VFTrackerPlayer();
            this._syncPlayerSettings(this.player);
        } else {
            this.player.stop(true);
            (this._outgoing || []).forEach((p) => {
                try { p.stop(true); } catch (e) { /* ignore */ }
            });
            this._outgoing = [];
        }
        this.currentKey = null;
        this._currentFingerprint = null;
    }

    /** Soft stop used when handing the bus to local/YouTube audio. */
    fadeOut(seconds) {
        const fade = seconds != null ? Number(seconds) : this.crossfadeSeconds;
        if (!(fade > 0) || !this.player.isPlaying()) {
            this.stop();
            return;
        }
        this._retireOutgoing(this.player, fade);
        this.player = new VFTrackerPlayer();
        this._syncPlayerSettings(this.player);
        this.currentKey = null;
        this._currentFingerprint = null;
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
