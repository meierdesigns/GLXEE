"use strict";

/**
 * Library + playback facade for vftrack soundtracks.
 * Storage: vf_tracker_library_v1 (per-key JSON tracks).
 * Keys include planet / ingame:planet, map:planet, shop:planet,
 * victory[:faction][:planet], lose[:faction][:planet], planet:faction,
 * planet-boss:faction. Hauptmelodien are planet×role; STYLE interprets them
 * at playback. Scene feel (difficulty / planet tier) nudges tempo + STYLE.
 */
class VFTrackerManager {
    constructor() {
        this.storageKey = 'vf_tracker_library_v1';
        this.player = new VFTrackerPlayer();
        this.library = {};
        this.currentKey = null;
        this.enabled = true;
        this.volume = (typeof VFVolume !== 'undefined') ? VFVolume.busDefault() : 0.065;
        /** Crossfade length when swapping distinct tracks (seconds). */
        this.crossfadeSeconds = 1.4;
        this._outgoing = [];
        /** Manager-owned mixer state — survives fadeOut/stop player swaps. */
        this._themeIndex = 0;
        this._jungleAmount = 0;
        /** Scene feel: tempo × user BPM, STYLE amount offset (combat intensity). */
        this._sceneTempoMul = 1;
        this._sceneStyleBoost = 0;
        /** AUTO STYLE: scene/galaxy picks the melody-genre dropdown (default on). */
        this._themeAuto = true;
        this._autoThemeIndex = null;
        try {
            const ta = localStorage.getItem('vf_musicThemeAuto');
            if (ta != null) this._themeAuto = ta !== '0';
        } catch (e) { /* ignore */ }
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

    /** Galaxy id for a planet slug — drives procedural motif divergence. */
    _planetGalaxyId(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id) return '';
        try {
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.configs) {
                const cfg = planetConfigManager.configs[id];
                if (cfg && cfg.galaxyId) return String(cfg.galaxyId).toLowerCase();
            }
            if (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.galaxyId) {
                return String(galaxyMapManager.galaxyId).toLowerCase();
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    _builtInRaw(key) {
        const k = String(key || '');
        if (!k) return null;
        if (this.library[k]) return this.library[k];

        if (k === 'menu' || k === 'station' || k === 'hub') {
            return VFTrackerDefaults.menu();
        }
        if (k === 'title-intro') {
            return VFTrackerDefaults.titleIntro ? VFTrackerDefaults.titleIntro() : VFTrackerDefaults.menu();
        }
        if (k === 'map-void' || k.indexOf('map-void:') === 0) {
            const galaxyId = k.split(':')[1] || '';
            return VFTrackerDefaults.mapVoid ? VFTrackerDefaults.mapVoid(galaxyId) : VFTrackerDefaults.menu();
        }
        if (k === 'map' || k.indexOf('map:') === 0) {
            const planet = k.split(':')[1] || 'mars';
            const galaxyId = this._planetGalaxyId(planet);
            if (typeof VFTrackerFactionCompose !== 'undefined'
                && VFTrackerFactionCompose.resolveKey) {
                const composed = VFTrackerFactionCompose.resolveKey(k, { galaxyId: galaxyId });
                if (composed) return composed;
            }
            return VFTrackerDefaults.map
                ? VFTrackerDefaults.map(planet, galaxyId)
                : VFTrackerDefaults.menu();
        }
        if (k === 'shop' || k.indexOf('shop:') === 0) {
            const planet = k.split(':')[1] || 'mars';
            const galaxyId = this._planetGalaxyId(planet);
            return VFTrackerDefaults.shop
                ? VFTrackerDefaults.shop(planet, galaxyId)
                : (VFTrackerDefaults.forRole
                    ? VFTrackerDefaults.forRole(planet, 'shop', galaxyId)
                    : VFTrackerDefaults.menu());
        }
        if (k === 'corridor' || k.indexOf('corridor:') === 0) {
            const planet = k.split(':')[1] || 'mars';
            const galaxyId = this._planetGalaxyId(planet);
            return VFTrackerDefaults.corridor
                ? VFTrackerDefaults.corridor(planet, galaxyId)
                : VFTrackerDefaults.forRole(planet, 'ingame', galaxyId);
        }
        if (k === 'ingame' || k.indexOf('ingame:') === 0) {
            if (typeof VFTrackerFactionCompose !== 'undefined') {
                const composed = VFTrackerFactionCompose.resolveKey(k);
                if (composed) return composed;
            }
            const planet = k.split(':')[1] || 'mars';
            const galaxySkin = this._galaxyDefaultSkin(planet, false);
            if (galaxySkin) return galaxySkin;
            return VFTrackerDefaults.forRole
                ? VFTrackerDefaults.forRole(planet, 'ingame')
                : VFTrackerDefaults.forPlanet(planet);
        }
        if (k === 'victory' || k.indexOf('victory:') === 0
            || k === 'lose' || k.indexOf('lose:') === 0) {
            if (typeof VFTrackerFactionCompose !== 'undefined') {
                const composed = VFTrackerFactionCompose.resolveKey(k);
                if (composed) return composed;
            }
            const parts = k.split(':');
            const kind = parts[0];
            const planet = parts[1] && !((typeof VFTrackerFactionCompose !== 'undefined'
                && VFTrackerFactionCompose.normalizeFaction
                && VFTrackerFactionCompose.normalizeFaction(parts[1])))
                ? parts[1]
                : (parts[2] || 'mars');
            if (kind === 'victory' && VFTrackerDefaults.victory) return VFTrackerDefaults.victory(planet);
            if (kind === 'lose' && VFTrackerDefaults.lose) return VFTrackerDefaults.lose(planet);
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
            && k !== 'shop' && k !== 'faction' && k !== 'station' && k !== 'hub') {
            const wantBoss = k.indexOf('boss') !== -1 || /-(?:boss|b)$/.test(k);
            const basePlanet = VFTrackerDefaults.normalizePlanetKey(k);
            const galaxySkin = this._galaxyDefaultSkin(basePlanet, wantBoss);
            if (galaxySkin) return galaxySkin;
            return VFTrackerDefaults.forPlanet(k);
        }
        return null;
    }

    /**
     * Galaxy-level default Faction skin for a procedurally generated planet
     * with no explicit faction/stage override — milky_way's 5 handcrafted
     * planets keep their authored sound untouched. Priority stays: active
     * hostile faction (resolveKey above) > this galaxy default > plain motif.
     */
    _galaxyDefaultSkin(planetId, boss) {
        if (typeof VFTrackerDefaults === 'undefined' || typeof VFTrackerFactionCompose === 'undefined') return null;
        const id = VFTrackerDefaults.normalizePlanetKey(planetId);
        if (VFTrackerDefaults.isHandcraftedPlanet && VFTrackerDefaults.isHandcraftedPlanet(id)) return null;
        try {
            if (typeof planetConfigManager === 'undefined' || !planetConfigManager.configs) return null;
            const cfg = planetConfigManager.configs[id];
            const galaxyId = cfg && cfg.galaxyId;
            if (!galaxyId || !planetConfigManager.getGalaxy) return null;
            const galaxy = planetConfigManager.getGalaxy(galaxyId);
            const faction = galaxy && galaxy.faction;
            if (!faction) return null;
            return VFTrackerFactionCompose.composeCombat(id, faction, { boss: boss, galaxyId: galaxyId });
        } catch (e) {
            return null;
        }
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
        keys.add('title-intro');
        keys.add('map');
        keys.add('map-void');
        keys.add('victory');
        keys.add('lose');
        keys.add('shop');
        keys.add('corridor');
        ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'].forEach((p) => {
            keys.add('intro:' + p);
            keys.add('map:' + p);
            keys.add('ingame:' + p);
            keys.add('victory:' + p);
            keys.add('lose:' + p);
            keys.add('shop:' + p);
            keys.add('corridor:' + p);
        });
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds) {
            try {
                planetConfigManager.getGalaxyIds().forEach((g) => keys.add('map-void:' + g));
            } catch (e) { /* ignore */ }
        }
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
                    keys.add('victory:' + f + ':' + p);
                    keys.add('lose:' + f + ':' + p);
                });
            });
        }
        Object.keys(this.library).forEach((k) => keys.add(k));
        return [...keys].sort();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, Number(v) || 0));
        if (this.player && this.player.setVolume) this.player.setVolume(this.volume);
        // Keep the fading-out leg at the same loudness so volume drags mid-
        // crossfade do not leave one voice blasting while the other ducks.
        (this._outgoing || []).forEach((p) => {
            if (p && p.setVolume) p.setVolume(this.volume);
        });
    }

    /** ch: 0=bass, 1=lead, 2=arp, 3=drums. v: 0-3 user fine-tune multiplier. */
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

    /** Authored BPM of the active track (fallback: reference 132). */
    getAuthoredBpm() {
        const t = this.player && this.player.track;
        const b = t && Number(t.bpm);
        if (Number.isFinite(b) && b > 0) return b;
        return this.referenceBpm || 132;
    }

    getTempoScale() {
        const bpm = this.getPlaybackBpm();
        const ref = this.getAuthoredBpm();
        return Math.max(0.25, Math.min(8, bpm / Math.max(1, ref)));
    }

    getPlaybackBpm() {
        // Heard tempo = user MUSIC BPM × scene feel (combat/boss nudge).
        const base = Number.isFinite(this._basePlaybackBpm) && this._basePlaybackBpm > 0
            ? this._basePlaybackBpm
            : null;
        if (base != null) {
            const sceneMul = Number(this._sceneTempoMul);
            const mul = Number.isFinite(sceneMul) && sceneMul > 0 ? sceneMul : 1;
            return Math.max(60, Math.min(300, Math.round(base * mul)));
        }
        const b = Number(this.player && this.player.playbackBpm);
        if (Number.isFinite(b) && b > 0) return b;
        const s = Number(this.player && this.player.tempoScale);
        const ref = this.referenceBpm || 132;
        if (Number.isFinite(s) && s > 0) return Math.round(ref * s);
        return Math.round(ref);
    }

    /** Absolute playback tempo in BPM (game clock + tracker). */
    setPlaybackBpm(bpm) {
        const b = Math.max(60, Math.min(300, Math.round(Number(bpm) || 120)));
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
     * (break layer + mix morph). Tempo stays on the MUSIC BPM slider.
     */
    setJungleAmount(amount) {
        let t = Math.max(0, Math.min(1, Number(amount) || 0));
        if (t < 0.03) t = 0;
        this._jungleAmount = t;
        this._pushJungleToPlayers(this._effectiveJungleAmount());
        return t;
    }

    /** User STYLE amount + scene intensity boost (combat difficulty / tier). */
    _effectiveJungleAmount() {
        const user = Math.max(0, Math.min(1, Number(this._jungleAmount) || 0));
        const boost = Number(this._sceneStyleBoost) || 0;
        let t = Math.max(0, Math.min(1, user + boost));
        if (t < 0.03) t = 0;
        return t;
    }

    _pushJungleToPlayers(amount) {
        const t = Math.max(0, Math.min(1, Number(amount) || 0));
        if (this.player && this.player.setJungleAmount) this.player.setJungleAmount(t);
        else if (this.player) this.player.jungleAmount = t;
        (this._outgoing || []).forEach((p) => {
            if (p && p.setJungleAmount) p.setJungleAmount(t);
            else if (p) p.jungleAmount = t;
        });
    }

    /**
     * Adapt heard tempo + STYLE intensity to the active scene.
     * role: combat|boss|corridor|victory|lose|map|map-void|shop|menu|intro|title-intro
     * difficulty: easy|normal|hard (menu preset)
     * planetTier: 0..4 (EASY…NIGHTMARE planet curve)
     * galaxyFaction: terran|kronax|voidborn|pirate|machine (drives AUTO STYLE pick)
     */
    setSceneFeel(opts) {
        const o = opts || {};
        const role = String(o.role || 'menu').toLowerCase();
        const diff = String(o.difficulty || '').toLowerCase();
        const tierRaw = o.planetTier;
        const tier = Number.isFinite(Number(tierRaw)) ? Math.max(0, Math.min(4, Number(tierRaw))) : null;
        let tempoMul = 1;
        let styleBoost = 0;
        if (role === 'combat' || role === 'boss' || role === 'ingame') {
            if (diff === 'easy') { tempoMul = 0.94; styleBoost = -0.08; }
            else if (diff === 'hard') { tempoMul = 1.07; styleBoost = 0.14; }
            else { tempoMul = 1; styleBoost = 0; }
            if (tier != null) {
                tempoMul *= 0.96 + tier * 0.035;
                styleBoost += -0.06 + tier * 0.055;
            }
            if (role === 'boss') {
                tempoMul *= 1.05;
                styleBoost += 0.1;
            }
        } else if (role === 'corridor') {
            // Schlauchlevel: tense but locked — faster pulse, less STYLE flourish.
            tempoMul = 1.08;
            styleBoost = -0.1;
            if (tier != null) tempoMul *= 0.98 + tier * 0.02;
        } else if (role === 'victory') {
            tempoMul = 1.03;
            styleBoost = 0.06;
        } else if (role === 'lose') {
            tempoMul = 0.84;
            styleBoost = -0.18;
        } else if (role === 'shop') {
            tempoMul = 0.92;
            styleBoost = -0.1;
        } else if (role === 'map-void') {
            // Pure Weltall: slower, sparsest STYLE of all scenes.
            tempoMul = 0.82;
            styleBoost = -0.22;
        } else if (role === 'map') {
            tempoMul = 0.9;
            styleBoost = -0.12;
        } else if (role === 'intro' || role === 'title-intro') {
            // Cinematic open: slower pulse, more STYLE weight than the hub loop
            // so a scene change is heard as a real music update, not a remix.
            tempoMul = 0.88;
            styleBoost = 0.16;
        } else {
            tempoMul = 1;
            styleBoost = 0;
        }
        this._sceneTempoMul = Math.max(0.75, Math.min(1.35, tempoMul));
        this._sceneStyleBoost = Math.max(-0.35, Math.min(0.45, styleBoost));
        // AUTO STYLE: scene/galaxy picks the melody-genre dropdown too, unless
        // the user has touched the STYLE select themselves (setThemeAuto(false)).
        this._autoThemeIndex = this._autoThemeIndexFor(role, o.galaxyFaction);
        if (this._themeAuto) this.setThemeIndex(this._autoThemeIndex);
        this._pushJungleToPlayers(this._effectiveJungleAmount());
        this._applyPlaybackTempo();
        return { tempoMul: this._sceneTempoMul, styleBoost: this._sceneStyleBoost };
    }

    clearSceneFeel() {
        return this.setSceneFeel({ role: 'menu' });
    }

    /**
     * Default STYLE dropdown index per scene role (+ galaxy faction for
     * combat/boss) when AUTO STYLE is on. Indices per VFTrackerThemes.list:
     * 0 planet · 1 jungle_dnb · 2 minimal · 3 amen · 4 reese · 5 neuro ·
     * 6 liquid · 7 dnb · 8 nightrun.
     */
    _autoThemeIndexFor(role, galaxyFaction) {
        const r = String(role || 'menu').toLowerCase();
        const factionIdx = { terran: 0, kronax: 5, voidborn: 6, pirate: 1, machine: 7 };
        const max = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
            ? VFTrackerThemes.count() - 1 : 8;
        const clamp = (i) => Math.max(0, Math.min(max, i));
        if (r === 'boss') return clamp(4);
        if (r === 'corridor') return clamp(2);
        if (r === 'map' || r === 'map-void') return clamp(6);
        if (r === 'shop') return clamp(0);
        if (r === 'victory') return clamp(1);
        if (r === 'lose') return clamp(2);
        // Hub stays on planet motif; story/title intros pull NIGHTRUN so the
        // scene change is audible even when the fanfare motif overlaps menu DNA.
        if (r === 'menu') return clamp(0);
        if (r === 'intro' || r === 'title-intro') return clamp(8);
        const f = String(galaxyFaction || '').toLowerCase();
        if (f && factionIdx[f] != null) return clamp(factionIdx[f]);
        return clamp(0);
    }

    /** AUTO STYLE on (default): scene/galaxy drives the melody-genre dropdown. */
    setThemeAuto(on) {
        this._themeAuto = !!on;
        try { localStorage.setItem('vf_musicThemeAuto', this._themeAuto ? '1' : '0'); } catch (e) { /* ignore */ }
        if (this._themeAuto && this._autoThemeIndex != null) this.setThemeIndex(this._autoThemeIndex);
        return this._themeAuto;
    }

    getThemeAuto() {
        return this._themeAuto !== false;
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
        return i;
    }

    /**
     * Re-assert THEME / STYLE / channel mix from volume UI (or manager memory)
     * so every planet / menu / intro / combat swap keeps the selected head.
     */
    _reassertMixerSettings() {
        if (typeof volumeControlsManager !== 'undefined') {
            if (this._themeAuto && this._autoThemeIndex != null) {
                this.setThemeIndex(this._autoThemeIndex);
            } else if (volumeControlsManager.getMusicTheme != null) {
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
     * MUSIC BPM slider = true heard tempo (beats/minute).
     * tempoScale = musicBpm / authoredTrackBpm so display == what you hear.
     * BPM = (beats / seconds) × 60 → rowDuration = 60 / bpm / rowsPerBeat.
     */
    _applyPlaybackTempo() {
        // User slider BPM only — scene mul applied once below (never via getPlaybackBpm).
        let base = Number.isFinite(this._basePlaybackBpm) ? this._basePlaybackBpm : 0;
        if (!(base > 0)) {
            const raw = Number(this.player && this.player.playbackBpm);
            base = (Number.isFinite(raw) && raw > 0) ? raw : (this.referenceBpm || 132);
        }
        const sceneMul = Number(this._sceneTempoMul);
        const mul = Number.isFinite(sceneMul) && sceneMul > 0 ? sceneMul : 1;
        const b = Math.max(60, Math.min(300, Math.round(base * mul)));
        const authored = this.getAuthoredBpm();
        const scale = Math.max(0.25, Math.min(8, b / Math.max(1, authored)));
        // Local-file rate stays vs reference 132 (files have no per-track BPM).
        const fileRate = Math.max(0.5, Math.min(4, b / (this.referenceBpm || 132)));
        if (this.player) {
            this.player.tempoScale = scale;
            this.player.playbackBpm = b;
            // Debounce re-anchor while the BPM fader is dragged — every tick
            // used to cut+retrig all voices and pump the bus loudness.
            this._queueTempoNotify(this.player);
        }
        (this._outgoing || []).forEach((p) => {
            if (!p) return;
            const pAuth = (p.track && Number(p.track.bpm) > 0) ? Number(p.track.bpm) : authored;
            p.tempoScale = Math.max(0.25, Math.min(8, b / Math.max(1, pAuth)));
            p.playbackBpm = b;
            this._queueTempoNotify(p);
        });
        if (this.player && this.player.isPlaying()
            && typeof beatSyncManager !== 'undefined' && beatSyncManager.setBpm) {
            beatSyncManager.setBpm(b);
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setPlaybackRate) {
            localAudioManager.setPlaybackRate(fileRate);
        }
        return b;
    }

    /** Coalesce rapid BPM-slider updates into one schedule re-anchor. */
    _queueTempoNotify(player) {
        if (!player || !player.notifyTempoChanged) return;
        if (player._tempoNotifyTimer) {
            clearTimeout(player._tempoNotifyTimer);
            player._tempoNotifyTimer = null;
        }
        // Slightly longer debounce — mid-drag reanchors were swallowing the mix.
        player._tempoNotifyTimer = setTimeout(() => {
            player._tempoNotifyTimer = null;
            try { player.notifyTempoChanged(); } catch (e) { /* ignore */ }
        }, 110);
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
            const c = VFTrackerParse.toCompact(VFTrackerParse.normalize(track));
            // Musical identity only — meta.title/planet must not force a restart
            // when two keys resolve to the same notes (procedural map collisions).
            return JSON.stringify({
                bpm: c.bpm,
                rowsPerBeat: c.rowsPerBeat,
                rowsPerPattern: c.rowsPerPattern,
                channels: c.channels,
                patterns: c.patterns,
                order: c.order,
                loop: c.loop !== false
            });
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
        if (k === 'title-intro') return 'title-intro';
        if (k === 'map-void' || k.indexOf('map-void:') === 0) return 'map';
        if (k === 'map' || k.indexOf('map:') === 0) return 'map';
        if (k === 'shop' || k.indexOf('shop:') === 0) return 'shop';
        if (k === 'corridor' || k.indexOf('corridor:') === 0) return 'corridor';
        if (k === 'intro' || k.indexOf('intro:') === 0) return 'intro';
        if (k === 'victory' || k.indexOf('victory:') === 0) return 'victory';
        if (k === 'lose' || k.indexOf('lose:') === 0) return 'lose';
        if (k === 'ingame' || k.indexOf('ingame:') === 0) return 'combat';
        return 'combat';
    }

    /** Play galaxy-map BGM for a planet Hauptmelodie. */
    playMap(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        return this.play('map:' + id);
    }

    /** Play trader / shop BGM for a planet Hauptmelodie. */
    playShop(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        return this.play('shop:' + id);
    }

    _syncPlayerSettings(target) {
        if (!target) return;
        const src = this.player;
        const theme = this.getThemeIndex();
        const jungle = this._effectiveJungleAmount();
        const tempoScale = (src && src.tempoScale) || this.getTempoScale();
        const playbackBpm = (src && src.playbackBpm) || this.getPlaybackBpm();
        target.tempoScale = tempoScale;
        target.playbackBpm = playbackBpm;
        target.jungleAmount = jungle;
        target.themeIndex = theme;
        target.channelMixBase = ((src && src.channelMixBase) || [1.0, 1.28, 0.68, 1.05]).slice();
        target.channelMixJungle = ((src && src.channelMixJungle) || [1.38, 0.3, 0.95, 1.72]).slice();
        target.channelMixDnb = ((src && src.channelMixDnb) || [1.58, 0.26, 0.82, 1.38]).slice();
        target.channelMixJungleDnb = ((src && src.channelMixJungleDnb) || [1.45, 0.28, 0.9, 1.62]).slice();
        target.channelMixElektro = ((src && src.channelMixElektro) || [1.4, 0.34, 1.05, 1.35]).slice();
        target.channelMixLiquid = ((src && src.channelMixLiquid) || [1.15, 0.48, 1.35, 1.1]).slice();
        target.channelMixNightrun = ((src && src.channelMixNightrun) || [1.3, 0.62, 1.0, 1.35]).slice();
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
        // Cap concurrent fade-outs at one: a track swap retriggered before the
        // previous fade finished (rapid slider drags, quick planet hops) used to
        // stack a second and third still-audible outgoing player on top of the
        // new one — heard as the music "overlapping"/stumbling. Cut any player
        // already fading out immediately instead of letting it keep sounding.
        if (this._outgoing && this._outgoing.length) {
            this._outgoing.forEach((p) => {
                try { p.stop(true); } catch (e) { /* ignore */ }
            });
            this._outgoing = [];
        }
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
        this._pushJungleToPlayers(this._effectiveJungleAmount());
        const prevRole = this._trackRole(this.currentKey);
        const nextRole = this._trackRole(k);
        const sameRole = prevRole === nextRole;
        const fp = this._fingerprint(track);
        // Same song already audible (even under a new key) — keep row position.
        // Never keep across roles (combat↔menu/intro/end/shop).
        // onEnded alone must NOT force a restart: playIntro used to re-crossfade
        // the same fanfare whenever setStageContext/reevaluate re-armed it.
        if (!(opts && opts.force) && this.player.isPlaying()) {
            if (sameRole) {
                if ((fp && fp === this._currentFingerprint) || this.currentKey === k) {
                    this.currentKey = k;
                    if (fp) this._currentFingerprint = fp;
                    if (opts && typeof opts.onEnded === 'function') {
                        this.player._onEnded = opts.onEnded;
                        this.player._endedFired = false;
                    }
                    return true;
                }
            }
        }
        // Scene/role change → always refresh tempo + AUTO STYLE before the swap
        // so the handoff is heard as a music update, not just a new pattern row.
        if (!sameRole || (opts && opts.forceScene)) {
            const galaxyFaction = (opts && opts.galaxyFaction)
                || (typeof soundManager !== 'undefined' && soundManager._currentHostileFaction)
                || '';
            if (typeof soundManager !== 'undefined' && soundManager._applyMusicScene) {
                soundManager._applyMusicScene(nextRole, galaxyFaction);
            } else {
                this.setSceneFeel({ role: nextRole, galaxyFaction: galaxyFaction });
            }
        }
        const ctx = (opts && opts.context)
            || (typeof soundManager !== 'undefined' && soundManager.ensureContext
                ? soundManager.ensureContext() : null);
        if (!ctx) return false;

        const wasPlaying = this.player.isPlaying();
        const roleChange = !sameRole && wasPlaying;
        let fade = opts && opts.fade != null
            ? Math.max(0, Number(opts.fade) || 0)
            : this.crossfadeSeconds;
        // Audible scene handoff: role changes never sneak in under a tiny fade.
        if (roleChange) fade = Math.max(fade, Math.min(1.25, Math.max(0.85, this.crossfadeSeconds * 0.75)));
        const hasOutgoing = !!(this._outgoing && this._outgoing.length);
        const doFade = fade > 0 && !(opts && opts.forceHard);

        // Distinct tracks always dual-crossfade (incl. same-role planet hops).
        // Soft in-place restarts cut mid-bar and sounded like a broken switch;
        // _retireOutgoing caps stacked fades so quick hops stay clean.
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
        this._currentFingerprint = fp;
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
        // Re-stamp live faders/voices onto the (possibly new) player so AUDIO
        // moves keep working immediately after a track swap / crossfade.
        if (typeof volumeControlsManager !== 'undefined') {
            if (volumeControlsManager.applyChannelVolumes) volumeControlsManager.applyChannelVolumes();
            if (volumeControlsManager.applyChannelVoices) volumeControlsManager.applyChannelVoices();
        } else if (this.player && this.player.applyChannelBusGains) {
            this.player.applyChannelBusGains();
        }
        // Track is loaded — finish STYLE + BPM adaptation against this song's
        // authored BPM (same result as nudging MUSIC BPM / STYLE in AUDIO).
        this._applyStylePlaybackForTrack();
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.start) {
            const planetHint = (track.meta && track.meta.planet) || k.split(':')[0].split('-')[0];
            beatSyncManager.start(
                planetHint === 'menu' || planetHint === 'intro' || planetHint === 'map'
                    ? 'mars' : planetHint,
                this.getPlaybackBpm()
            );
        }
        return true;
    }

    /**
     * After a real track load: reassert mixer + adapt MUSIC BPM to STYLE × song
     * so playback does not stay half-styled until the AUDIO faders move.
     */
    _applyStylePlaybackForTrack() {
        if (typeof volumeControlsManager !== 'undefined'
            && volumeControlsManager.applyStylePlaybackForTrack) {
            volumeControlsManager.applyStylePlaybackForTrack();
            this._pushJungleToPlayers(this._effectiveJungleAmount());
            this._applyPlaybackTempo();
            return;
        }
        this._reassertMixerSettings();
        this._pushJungleToPlayers(this._effectiveJungleAmount());
        this._applyPlaybackTempo();
    }

    /**
     * Intro fanfare retired (was a one-shot before combat). Kept as API stub
     * so old callers no-op instead of cutting the bus.
     */
    playIntro(/* key, opts */) {
        return false;
    }

    playPlanet(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        return this.play(id);
    }

    playMenu() {
        // Keep position when hub music is already the same track (faction /
        // wizard / station remounts call startMenuMusic often). play() still
        // swaps when the role or fingerprint differs (e.g. combat → menu).
        return this.play('menu');
    }

    /** Global, one-shot title-screen fanfare. `onDone` fires when it ends. */
    playTitleIntro(onDone) {
        if (typeof soundManager !== 'undefined' && soundManager._applyMusicScene) {
            soundManager._applyMusicScene('title-intro');
        } else {
            this.setSceneFeel({ role: 'title-intro' });
        }
        return this.play('title-intro', null, {
            fade: 0.55,
            fadeIn: 0.85,
            force: true,
            forceScene: true,
            onEnded: typeof onDone === 'function' ? onDone : undefined
        });
    }

    /** Schlauchlevel / corridor stage mood — tense, locked-pulse variant. */
    playCorridor(planetId) {
        const id = String(planetId || 'mars').toLowerCase().split('-')[0];
        return this.play('corridor:' + id);
    }

    /** Pure deep-space map ambience (no planet nearby) — optional galaxy tone. */
    playMapVoid(galaxyId) {
        return this.play(galaxyId ? 'map-void:' + String(galaxyId).toLowerCase() : 'map-void');
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
        if (this.currentKey === target && this.player.isPlaying()) {
            // Keep playhead, but still push STYLE / scene feel to the live player.
            this._reassertMixerSettings();
            this._pushJungleToPlayers(this._effectiveJungleAmount());
            this._applyPlaybackTempo();
            return target;
        }
        // Same map/combat motif under an alias key — keep playhead.
        if (this.player.isPlaying() && this._trackRole(this.currentKey) === this._trackRole(target)) {
            const track = this.getTrack(target);
            const fp = this._fingerprint(track);
            if (fp && fp === this._currentFingerprint) {
                this.currentKey = target;
                this._reassertMixerSettings();
                this._pushJungleToPlayers(this._effectiveJungleAmount());
                this._applyPlaybackTempo();
                return target;
            }
        }
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

    /**
     * True while the current player OR a still-fading outgoing leg is audible.
     * fadeOut() swaps in a blank player — without this, ensureMusicPlaying /
     * enemy overrides would start a second song on top of the fade.
     */
    isAudible() {
        if (this.player && this.player.isPlaying && this.player.isPlaying()) return true;
        const out = this._outgoing || [];
        for (let i = 0; i < out.length; i++) {
            const p = out[i];
            if (p && p.isPlaying && p.isPlaying()) return true;
        }
        return false;
    }

    /** Audible playhead for the Music Editor score sheet. */
    getPlayhead() {
        if (this.player && this.player.getPlayhead) return this.player.getPlayhead();
        return { playing: false, orderIndex: 0, rowIndex: 0, pattern: 0, frac: 0, absRow: 0 };
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
