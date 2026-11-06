"use strict";

// Volume Controls Manager — linear MASTER × (SOUND|MUSIC) routing into soundManager.
// Defaults live on VFVolume (sounds/core.js) so every audio path shares one source.
class VolumeControlsManager {
    constructor() {
        const d = (typeof VFVolume !== 'undefined') ? VFVolume : { MASTER: 0.1, SOUND: 0.5, MUSIC: 0.65 };
        this.masterVolume = d.MASTER;
        this.soundVolume = d.SOUND;
        this.musicVolume = d.MUSIC;
        /**
         * Heard playback tempo (BPM = beats/minute). Default = authored
         * combat reference (132) — not the old 3.5× inflated value (462).
         */
        this.referenceBpm = 132;
        this.musicBpm = 132;
        /** @deprecated kept in sync as musicBpm / referenceBpm for older callers */
        this.musicSpeed = 1;
        /** Per-channel music fine-tune: bass / lead / arp / drums (1 = authored level). */
        this.channelVolumes = [1, 1, 1, 1];
        /** Per-channel instrument voice ids (VFTrackerVoices). */
        this.channelVoices = ['default', 'default', 'default', 'default'];
        /** Style intensity 0..1 (how far into selected STYLE). */
        this.jungleAmount = 0;
        /** Style dropdown index — see VFTrackerThemes.list. */
        this.musicTheme = 0;
        /**
         * When true, track/role swaps re-adapt MUSIC BPM to STYLE × authored
         * song (same path as picking a STYLE). Manual BPM fader sets false.
         */
        this.bpmFollowsStyle = true;
        this.init();
    }

    init() {
        this.loadVolumes();
        this.setupEventListeners();
        this.updateUI();
        this.applyVolumes();
    }

    setupEventListeners() {
        const bind = (id, prop) => {
            const slider = document.getElementById(id);
            if (!slider) return;
            slider.addEventListener('input', (e) => {
                this[prop] = this._normVol(parseInt(e.target.value, 10) / 100);
                this.autoUnmuteOnSliderMove();
                this.updateUI();
                this.applyVolumes();
                this.saveVolumes();
            });
        };
        bind('masterVolume', 'masterVolume');
        bind('soundVolume', 'soundVolume');
        bind('musicVolume', 'musicVolume');

        const bindChannel = (id, ch) => {
            const slider = document.getElementById(id);
            if (!slider) return;
            slider.addEventListener('input', (e) => {
                this.setChannelVolume(ch, parseInt(e.target.value, 10) / 100);
            });
        };
        bindChannel('musicChannelBass', 0);
        bindChannel('musicChannelLead', 1);
        bindChannel('musicChannelArp', 2);
        bindChannel('musicChannelDrums', 3);

        const bindVoice = (id, valueId, ch) => {
            const slider = document.getElementById(id);
            if (!slider) return;
            slider.addEventListener('input', (e) => {
                const opts = (typeof VFTrackerVoices !== 'undefined' && VFTrackerVoices.optionsFor)
                    ? VFTrackerVoices.optionsFor(ch)
                    : [{ id: 'default', label: 'DEFAULT' }];
                const max = Math.max(0, opts.length - 1);
                slider.max = String(max);
                const i = Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0));
                const opt = opts[i] || opts[0];
                this.setChannelVoice(ch, opt.id);
                const nameEl = document.getElementById(valueId);
                if (nameEl) nameEl.textContent = opt.label;
                slider.style.setProperty('--vol-fill', (i / Math.max(1, max) * 100) + '%');
            });
        };
        bindVoice('musicVoiceBass', 'musicVoiceBassValue', 0);
        bindVoice('musicVoiceLead', 'musicVoiceLeadValue', 1);
        bindVoice('musicVoiceArp', 'musicVoiceArpValue', 2);
        bindVoice('musicVoiceDrums', 'musicVoiceDrumsValue', 3);

        const bpmSlider = document.getElementById('musicBpm') || document.getElementById('musicSpeed');
        if (bpmSlider) {
            bpmSlider.addEventListener('input', (e) => {
                const raw = parseInt(e.target.value, 10);
                // musicBpm slider is absolute BPM; legacy musicSpeed was ×100 scale.
                if (bpmSlider.id === 'musicSpeed' && raw <= 400 && bpmSlider.max <= 400) {
                    this.setMusicBpm(Math.round((raw / 100) * this.referenceBpm));
                } else {
                    this.setMusicBpm(this.snapMusicBpm(raw));
                }
                this.updateUI();
            });
        }

        const jungleSlider = document.getElementById('musicJungle');
        if (jungleSlider) {
            jungleSlider.addEventListener('input', (e) => {
                this.setJungleAmount(parseInt(e.target.value, 10) / 100);
                this.updateUI();
            });
        }

        const themeSelect = document.getElementById('musicTheme');
        if (themeSelect) {
            const syncThemeOptions = () => {
                if (!themeSelect.options.length && typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.list) {
                    VFTrackerThemes.list.forEach((o, i) => {
                        const opt = document.createElement('option');
                        opt.value = String(i);
                        opt.textContent = o.label;
                        themeSelect.appendChild(opt);
                    });
                }
            };
            syncThemeOptions();
            themeSelect.addEventListener('change', (e) => {
                this.setMusicTheme(parseInt(e.target.value, 10));
                this.updateUI();
            });
        }
    }

    updateUI() {
        const sync = (id, valueId, vol) => {
            const pct = Math.round(Math.max(0, Math.min(1, Number(vol) || 0)) * 100);
            const valueEl = document.getElementById(valueId);
            if (valueEl) valueEl.textContent = pct + '%';
            const slider = document.getElementById(id);
            if (slider) {
                slider.value = pct;
                slider.style.setProperty('--vol-fill', pct + '%');
            }
        };

        sync('masterVolume', 'masterVolumeValue', this.masterVolume);
        sync('soundVolume', 'soundVolumeValue', this.soundVolume);
        sync('musicVolume', 'musicVolumeValue', this.musicVolume);

        if (this.channelVolumes) {
            const syncChannel = (id, valueId, vol) => {
                const pct = Math.round(Math.max(0, Math.min(2, Number(vol) || 0)) * 100);
                const valueEl = document.getElementById(valueId);
                if (valueEl) valueEl.textContent = pct + '%';
                const slider = document.getElementById(id);
                if (slider) {
                    slider.value = pct;
                    slider.style.setProperty('--vol-fill', Math.min(100, pct) + '%');
                }
            };
            syncChannel('musicChannelBass', 'musicChannelBassValue', this.channelVolumes[0]);
            syncChannel('musicChannelLead', 'musicChannelLeadValue', this.channelVolumes[1]);
            syncChannel('musicChannelArp', 'musicChannelArpValue', this.channelVolumes[2]);
            syncChannel('musicChannelDrums', 'musicChannelDrumsValue', this.channelVolumes[3]);
        }

        if (this.channelVoices) {
            const syncVoice = (id, valueId, ch) => {
                const slider = document.getElementById(id);
                if (!slider) return;
                const opts = (typeof VFTrackerVoices !== 'undefined' && VFTrackerVoices.optionsFor)
                    ? VFTrackerVoices.optionsFor(ch)
                    : [{ id: 'default', label: 'DEFAULT' }];
                const max = Math.max(0, opts.length - 1);
                slider.min = '0';
                slider.max = String(max);
                slider.step = '1';
                const cur = this.channelVoices[ch] || 'default';
                let i = 0;
                for (let n = 0; n < opts.length; n++) {
                    if (opts[n].id === cur) { i = n; break; }
                }
                slider.value = String(i);
                slider.style.setProperty('--vol-fill', (i / Math.max(1, max) * 100) + '%');
                const nameEl = document.getElementById(valueId);
                if (nameEl) nameEl.textContent = (opts[i] && opts[i].label) || 'DEFAULT';
            };
            syncVoice('musicVoiceBass', 'musicVoiceBassValue', 0);
            syncVoice('musicVoiceLead', 'musicVoiceLeadValue', 1);
            syncVoice('musicVoiceArp', 'musicVoiceArpValue', 2);
            syncVoice('musicVoiceDrums', 'musicVoiceDrumsValue', 3);
        }

        const bpm = Math.round(Math.max(60, Math.min(300, Number(this.musicBpm) || 132)));
        const bpmSlider = document.getElementById('musicBpm');
        if (bpmSlider) {
            bpmSlider.value = bpm;
            const min = Number(bpmSlider.min) || 60;
            const max = Number(bpmSlider.max) || 300;
            bpmSlider.style.setProperty('--vol-fill', ((bpm - min) / Math.max(1, max - min) * 100) + '%');
            this.applyBpmMark(bpmSlider, min, max);
        }
        const bpmValue = document.getElementById('musicBpmValue') || document.getElementById('musicSpeedValue');
        if (bpmValue) bpmValue.textContent = this.formatMusicSpeed(bpm);
        // Legacy id still present in some overlays.
        const legacySpeed = document.getElementById('musicSpeed');
        if (legacySpeed && legacySpeed !== bpmSlider) {
            legacySpeed.value = bpm;
            this.applyBpmMark(legacySpeed, Number(legacySpeed.min) || 60, Number(legacySpeed.max) || 300);
        }

        const jungleAmt = Math.max(0, Math.min(1, Number(this.jungleAmount) || 0));
        const junglePct = Math.round(jungleAmt * 100);
        const jungleSlider = document.getElementById('musicJungle');
        if (jungleSlider) {
            if (Number(jungleSlider.min) < 0) {
                jungleSlider.min = '0';
                jungleSlider.max = '100';
            }
            jungleSlider.value = junglePct;
            jungleSlider.style.setProperty('--vol-fill', junglePct + '%');
        }
        const jungleValue = document.getElementById('musicJungleValue');
        if (jungleValue) {
            jungleValue.textContent = junglePct === 0 ? 'OFF' : junglePct + '%';
        }

        const themeMax = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
            ? VFTrackerThemes.count() - 1
            : 8;
        const themeIdx = Math.max(0, Math.min(themeMax, Math.round(Number(this.musicTheme) || 0)));
        const themeSelect = document.getElementById('musicTheme');
        if (themeSelect) {
            if (!themeSelect.options.length && typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.list) {
                VFTrackerThemes.list.forEach((o, i) => {
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = o.label;
                    themeSelect.appendChild(opt);
                });
            }
            themeSelect.value = String(themeIdx);
        }
        const themeValue = document.getElementById('musicThemeValue');
        if (themeValue) {
            themeValue.textContent = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.labelOf)
                ? VFTrackerThemes.labelOf(themeIdx)
                : String(themeIdx);
        }

        document.querySelectorAll('.volume-slider[data-volume]').forEach((slider) => {
            const key = slider.dataset.volume;
            let vol = null;
            if (key === 'master') vol = this.masterVolume;
            else if (key === 'sound') vol = this.soundVolume;
            else if (key === 'music') vol = this.musicVolume;
            if (vol == null) return;
            const pct = Math.round(Math.max(0, Math.min(1, Number(vol) || 0)) * 100);
            slider.value = pct;
            slider.style.setProperty('--vol-fill', pct + '%');
            const value = slider.parentElement && slider.parentElement.querySelector(`[data-volume-value="${key}"]`);
            if (value) value.textContent = pct + '%';
        });
    }

    applyVolumes() {
        if (typeof soundManager !== 'undefined') {
            // Assign levels once, then one bus push (updateAmbientVolume →
            // pushMusicBusVolume + soft drone). Avoid triple setMaster/Sound/Music.
            soundManager.masterVolume = this.masterVolume;
            soundManager.soundVolume = this.soundVolume;
            soundManager.musicVolume = this.musicVolume;
            if (soundManager.updateAmbientVolume) soundManager.updateAmbientVolume();
            else if (soundManager.pushMusicBusVolume) soundManager.pushMusicBusVolume();
        } else {
            const bus = Math.max(0, Math.min(1, this.masterVolume * this.musicVolume));
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
        const bus = (typeof soundManager !== 'undefined' && soundManager.musicBusVolume)
            ? soundManager.musicBusVolume()
            : Math.max(0, Math.min(1, this.masterVolume * this.musicVolume));
        if (bus > 0 && typeof soundManager !== 'undefined' && soundManager.ensureMusicPlaying) {
            soundManager.ensureMusicPlaying();
        }
        this.applyMusicBpm();
        this.applyJungleAmount();
        this.applyMusicTheme();
        this.applyChannelVolumes();
        this.applyChannelVoices();

        if (typeof soundConfig !== 'undefined') {
            soundConfig.masterVolume = this.masterVolume;
            soundConfig.soundVolume = this.soundVolume;
            soundConfig.musicVolume = this.musicVolume;
        }
    }

    applyJungleAmount() {
        let t = Math.max(0, Math.min(1, Number(this.jungleAmount) || 0));
        if (t < 0.03) t = 0;
        this.jungleAmount = t;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setJungleAmount) {
            vfTrackerManager.setJungleAmount(t);
        }
    }

    applyMusicTheme() {
        const max = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
            ? VFTrackerThemes.count() - 1
            : 8;
        const i = Math.max(0, Math.min(max, Math.round(Number(this.musicTheme) || 0)));
        this.musicTheme = i;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setThemeIndex) {
            vfTrackerManager.setThemeIndex(i);
        }
        // Keep Music Editor STYLE select locked to the left slider.
        if (typeof musicEditorUI !== 'undefined' && musicEditorUI.syncStyleFromVolume
            && !musicEditorUI._syncingStyle) {
            musicEditorUI.syncStyleFromVolume({ reload: true });
        }
    }

    setChannelVolume(ch, v) {
        const idx = Number(ch);
        if (!Number.isFinite(idx) || idx < 0 || idx > 3) return;
        if (!this.channelVolumes) this.channelVolumes = [1, 1, 1, 1];
        this.channelVolumes[idx] = Math.max(0, Math.min(2, Number(v)));
        this.updateUI();
        this.applyChannelVolumes();
        this.saveVolumes();
    }

    getChannelVolume(ch) {
        return (this.channelVolumes && this.channelVolumes[ch] != null) ? this.channelVolumes[ch] : 1;
    }

    applyChannelVolumes() {
        if (!this.channelVolumes) this.channelVolumes = [1, 1, 1, 1];
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setChannelVolume) {
            for (let i = 0; i < 4; i++) vfTrackerManager.setChannelVolume(i, this.channelVolumes[i]);
        }
    }

    setChannelVoice(ch, voiceId) {
        const idx = Number(ch);
        if (!Number.isFinite(idx) || idx < 0 || idx > 3) return;
        if (!this.channelVoices) this.channelVoices = ['default', 'default', 'default', 'default'];
        const id = String(voiceId || 'default');
        this.channelVoices[idx] = id;
        this.updateUI();
        this.applyChannelVoices();
        this.saveVolumes();
    }

    getChannelVoice(ch) {
        return (this.channelVoices && this.channelVoices[ch]) || 'default';
    }

    applyChannelVoices() {
        if (!this.channelVoices) this.channelVoices = ['default', 'default', 'default', 'default'];
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setChannelVoice) {
            for (let i = 0; i < 4; i++) vfTrackerManager.setChannelVoice(i, this.channelVoices[i]);
        }
    }

    applyMusicBpm() {
        const bpm = Math.max(60, Math.min(300, Math.round(Number(this.musicBpm) || 132)));
        this.musicBpm = bpm;
        this.musicSpeed = bpm / this.referenceBpm;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setPlaybackBpm) {
            vfTrackerManager.setPlaybackBpm(bpm);
        } else if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setTempoScale) {
            vfTrackerManager.setTempoScale(this.musicSpeed);
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setPlaybackRate) {
            localAudioManager.setPlaybackRate(this.musicSpeed);
        }
    }

    /** @deprecated use applyMusicBpm */
    applyMusicSpeed() {
        this.applyMusicBpm();
    }

    saveVolumes() {
        const set = (k, v) => {
            if (typeof VFStorage !== 'undefined') VFStorage.set(k, v);
            else try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ }
        };
        const setJSON = (k, v) => {
            if (typeof VFStorage !== 'undefined') VFStorage.setJSON(k, v);
            else try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
        };
        try {
            set('vf_masterVolume', this.masterVolume);
            set('vf_soundVolume', this.soundVolume);
            set('vf_musicVolume', this.musicVolume);
            set('vf_musicBpm', this.musicBpm);
            set('vf_musicSpeed', this.musicSpeed);
            set('vf_musicJungle', this.jungleAmount);
            set('vf_musicJungleBipolar', '1');
            set('vf_musicStyleAmount', '1');
            set('vf_musicTheme', this.musicTheme);
            set('vf_musicStyleSchema', '3');
            set('vf_musicBpmFollowsStyle', this.bpmFollowsStyle === false ? '0' : '1');
            setJSON('vf_channelVolumes', this.channelVolumes || [1, 1, 1, 1]);
            setJSON('vf_channelVoices', this.channelVoices || ['default', 'default', 'default', 'default']);
            set('vf_volumeSchema', '3');
            if (typeof VFStorage !== 'undefined') VFStorage.schema('volume', '3');
        } catch (e) {
            console.warn('Could not save volume settings:', e);
        }
    }

    loadVolumes() {
        try {
            const schema = localStorage.getItem('vf_volumeSchema');
            const savedMaster = localStorage.getItem('vf_masterVolume');
            const savedSound = localStorage.getItem('vf_soundVolume');
            const savedMusic = localStorage.getItem('vf_musicVolume');
            const savedBpm = localStorage.getItem('vf_musicBpm');
            const savedSpeed = localStorage.getItem('vf_musicSpeed');
            const bpmDefaultMark = localStorage.getItem('vf_musicBpmDefault');
            const savedChannels = localStorage.getItem('vf_channelVolumes');
            const savedVoices = localStorage.getItem('vf_channelVoices');
            const savedJungle = localStorage.getItem('vf_musicJungle');
            const savedTheme = localStorage.getItem('vf_musicTheme');

            if (savedMaster !== null) this.masterVolume = parseFloat(savedMaster);
            if (savedSound !== null) this.soundVolume = parseFloat(savedSound);
            if (savedMusic !== null) this.musicVolume = parseFloat(savedMusic);
            if (savedJungle !== null) {
                let j = parseFloat(savedJungle);
                try {
                    // New model: intensity 0..1. Migrate bipolar -1..+1 → abs.
                    if (localStorage.getItem('vf_musicStyleAmount') !== '1') {
                        if (Number.isFinite(j)) j = Math.abs(j);
                        localStorage.setItem('vf_musicStyleAmount', '1');
                    }
                    localStorage.setItem('vf_musicJungleBipolar', '1');
                } catch (e) { /* ignore */ }
                this.jungleAmount = j;
            }
            if (savedTheme !== null) {
                let th = parseInt(savedTheme, 10);
                // Schema 3 inserts JUNGLE DNB + MINIMAL ELEKTRO after PLANET.
                // Old 0..4 = PLANET/AMEN/REESE/NEURO/LIQUID → 0,3,4,5,6.
                try {
                    if (localStorage.getItem('vf_musicStyleSchema') !== '3'
                        && Number.isFinite(th) && th >= 0 && th <= 4) {
                        const map = [0, 3, 4, 5, 6];
                        th = map[th];
                        localStorage.setItem('vf_musicStyleSchema', '3');
                        localStorage.setItem('vf_musicTheme', String(th));
                    }
                } catch (e) { /* ignore */ }
                this.musicTheme = th;
            }

            // MUSIC BPM = true heard tempo. Migrate off old 3.5× default (462).
            if (bpmDefaultMark !== '132') {
                let next = 132;
                if (savedBpm != null && Number.isFinite(parseFloat(savedBpm))) {
                    next = parseFloat(savedBpm);
                } else if (savedSpeed != null && Number.isFinite(parseFloat(savedSpeed))) {
                    next = parseFloat(savedSpeed) * this.referenceBpm;
                }
                // 462 was the inflated 3.5× default, not real BPM.
                if (Math.round(next) === 462) next = 132;
                this.musicBpm = next;
                localStorage.setItem('vf_musicBpmDefault', '132');
                localStorage.setItem('vf_musicBpm', String(Math.round(this.musicBpm)));
            } else if (savedBpm !== null) {
                this.musicBpm = parseFloat(savedBpm);
            } else if (savedSpeed !== null) {
                this.musicBpm = parseFloat(savedSpeed) * this.referenceBpm;
            }

            const d = (typeof VFVolume !== 'undefined') ? VFVolume : { MASTER: 0.1, SOUND: 0.5, MUSIC: 0.65 };
            if (!Number.isFinite(this.masterVolume)) this.masterVolume = d.MASTER;
            if (!Number.isFinite(this.soundVolume)) this.soundVolume = d.SOUND;
            if (!Number.isFinite(this.musicVolume)) this.musicVolume = d.MUSIC;
            if (!Number.isFinite(this.musicBpm)) this.musicBpm = 132;

            if (savedChannels) {
                try {
                    const arr = JSON.parse(savedChannels);
                    if (Array.isArray(arr) && arr.length === 4) {
                        this.channelVolumes = arr.map((v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(2, Number(v))) : 1));
                    }
                } catch (e) { /* ignore malformed value */ }
            }

            if (savedVoices) {
                try {
                    const arr = JSON.parse(savedVoices);
                    if (Array.isArray(arr) && arr.length === 4) {
                        this.channelVoices = arr.map((v) => String(v || 'default'));
                    }
                } catch (e) { /* ignore malformed value */ }
            }

            this.masterVolume = Math.max(0, Math.min(1, this.masterVolume));
            this.soundVolume = Math.max(0, Math.min(1, this.soundVolume));
            this.musicVolume = Math.max(0, Math.min(1, this.musicVolume));
            this.musicBpm = Math.max(60, Math.min(300, Math.round(this.musicBpm)));
            this.musicSpeed = this.musicBpm / this.referenceBpm;
            this.jungleAmount = Math.max(0, Math.min(1, Number.isFinite(this.jungleAmount) ? Math.abs(this.jungleAmount) : 0));
            if (this.jungleAmount < 0.03) this.jungleAmount = 0;
            const themeMax = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
                ? VFTrackerThemes.count() - 1
                : 8;
            this.musicTheme = Math.max(0, Math.min(themeMax, Number.isFinite(this.musicTheme) ? this.musicTheme : 0));

            // Missing key → follow STYLE (legacy saves never recorded overrides).
            const savedFollow = localStorage.getItem('vf_musicBpmFollowsStyle');
            this.bpmFollowsStyle = savedFollow !== '0';

            // Schema 1: 10%/5%/20% (+ hidden ×8 music bus) → keep master 10%, raise SND/MUS.
            // Schema 2: 75%/50%/65% authored default → master 10% (quiet start until adjusted).
            // Never treat intentional quiet/mute levels as "legacy".
            if (schema !== '3') {
                const near = (a, b) => Math.abs(a - b) < 0.001;
                if (near(this.masterVolume, 0.1)
                    && near(this.soundVolume, 0.05)
                    && near(this.musicVolume, 0.2)) {
                    this.masterVolume = 0.1;
                    this.soundVolume = 0.5;
                    this.musicVolume = 0.65;
                } else if (near(this.masterVolume, 0.75)
                    && near(this.soundVolume, 0.5)
                    && near(this.musicVolume, 0.65)) {
                    this.masterVolume = 0.1;
                }
                this.saveVolumes();
            }
        } catch (e) {
            console.warn('Could not load volume settings:', e);
        }
    }

    getMasterVolume() { return this.masterVolume; }
    getSoundVolume() { return this.soundVolume; }
    getMusicVolume() { return this.musicVolume; }
    getMusicBpm() { return this.musicBpm; }
    getMusicSpeed() { return this.musicBpm / this.referenceBpm; }

    /** Preferred MUSIC BPM for the active STYLE (fader mark + snap). */
    getPreferredMusicBpm(themeIndex) {
        const idx = themeIndex != null ? themeIndex : this.musicTheme;
        const authored = (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.getAuthoredBpm)
            ? vfTrackerManager.getAuthoredBpm()
            : 132;
        if (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.adaptedBpmOf) {
            return VFTrackerThemes.adaptedBpmOf(idx, authored);
        }
        if (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.preferredBpmOf) {
            return VFTrackerThemes.preferredBpmOf(idx);
        }
        return Math.round(authored || 132);
    }

    /** Snap radius around a style preferred BPM (absolute BPM units). */
    getMusicBpmSnapRadius() { return 18; }

    /** If near the active style preferred BPM, snap to it. */
    snapMusicBpm(bpm) {
        const raw = Math.max(60, Math.min(300, Math.round(Number(bpm) || 120)));
        const pref = this.getPreferredMusicBpm();
        const radius = this.getMusicBpmSnapRadius();
        if (Math.abs(raw - pref) <= radius) return pref;
        return raw;
    }

    /** Paint preferred-BPM mark CSS vars on a range input. */
    applyBpmMark(slider, min, max) {
        if (!slider || !slider.style || !slider.style.setProperty) return;
        const lo = Number.isFinite(Number(min)) ? Number(min) : 60;
        const hi = Number.isFinite(Number(max)) ? Number(max) : 300;
        const span = Math.max(1, hi - lo);
        const pref = this.getPreferredMusicBpm();
        const pct = ((pref - lo) / span) * 100;
        slider.style.setProperty('--bpm-mark', Math.max(0, Math.min(100, pct)).toFixed(2) + '%');
        slider.classList.add('has-bpm-mark');
        slider.setAttribute('data-bpm-mark', String(pref));
    }

    /** UI readout: heard MUSIC BPM (beats/minute). */
    formatMusicSpeed(bpm) {
        const b = Math.max(60, Math.min(300, Math.round(Number(bpm) || this.musicBpm || 132)));
        return b + ' BPM';
    }
    getJungleAmount() { return this.jungleAmount; }
    getMusicTheme() { return this.musicTheme; }

    /**
     * Dragging a VOL/SND/MUS slider above 0 is the player asking for that
     * channel to be audible — undo a stale soundEnabled/musicEnabled=false
     * left over from an earlier mute, or the slider alone would stay silent.
     * Only called from the explicit setters below (real user action) — never
     * from applyVolumes()/boot, or a persisted mute would be undone on every
     * page load just because the sliders themselves sit above 0.
     */
    autoUnmuteOnSliderMove() {
        if (typeof soundManager === 'undefined') return;
        const wantSound = this.masterVolume > 0 && this.soundVolume > 0;
        const wantMusic = this.masterVolume > 0 && this.musicVolume > 0;
        if (wantSound && !soundManager.soundEnabled && soundManager.setSoundEnabled) {
            soundManager.setSoundEnabled(true);
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.soundEnabled = true;
                if (settingsManager.saveMuteState) settingsManager.saveMuteState('vf_soundEnabled', true);
            }
        }
        if (wantMusic && !soundManager.musicEnabled && soundManager.setMusicEnabled) {
            soundManager.setMusicEnabled(true);
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.musicEnabled = true;
                if (settingsManager.saveMuteState) settingsManager.saveMuteState('vf_musicEnabled', true);
            }
        }
    }

    _normVol(volume) {
        return (typeof VFVolume !== 'undefined')
            ? VFVolume.normalize(volume)
            : Math.max(0, Math.min(1, Number(volume) > 1 ? Number(volume) / 100 : (Number(volume) || 0)));
    }

    setMasterVolume(volume) {
        this.masterVolume = this._normVol(volume);
        this.autoUnmuteOnSliderMove();
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }

    setSoundVolume(volume) {
        this.soundVolume = this._normVol(volume);
        this.autoUnmuteOnSliderMove();
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume = this._normVol(volume);
        this.autoUnmuteOnSliderMove();
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }

    setMusicBpm(bpm) {
        this.musicBpm = this.snapMusicBpm(bpm);
        this.musicSpeed = this.musicBpm / this.referenceBpm;
        // User (or snap) owns absolute tempo until STYLE is picked again.
        this.bpmFollowsStyle = false;
        this.applyMusicBpm();
        this.saveVolumes();
    }

    /**
     * Finish STYLE + BPM adaptation for the track now loaded in the tracker.
     * Called after every real song swap so planet/map/combat don't start
     * "half styled" until the AUDIO faders are touched.
     */
    applyStylePlaybackForTrack() {
        const theme = Math.max(0, Math.round(Number(this.musicTheme) || 0));
        let dirty = false;
        // Armed non-PLANET STYLE with STRENGTH at 0 → same mild colour as
        // setMusicTheme when switching away from PLANET.
        if (theme > 0 && this.jungleAmount < 0.03) {
            this.jungleAmount = 0.4;
            dirty = true;
        }
        this.applyJungleAmount();
        this.applyMusicTheme();
        if (this.bpmFollowsStyle !== false) {
            const pref = this.getPreferredMusicBpm(theme);
            if (Number.isFinite(pref) && pref > 0) {
                const next = Math.max(60, Math.min(300, Math.round(pref)));
                if (next !== Math.round(Number(this.musicBpm) || 0)) {
                    this.musicBpm = next;
                    this.musicSpeed = this.musicBpm / this.referenceBpm;
                    dirty = true;
                }
            }
        }
        this.applyMusicBpm();
        if (dirty) {
            this.updateUI();
            this.saveVolumes();
        }
    }

    setMusicSpeed(speed) {
        this.setMusicBpm((Number(speed) || 1) * this.referenceBpm);
    }

    setJungleAmount(amount) {
        let t = Math.max(0, Math.min(1, Number(amount) || 0));
        if (t < 0.03) t = 0;
        this.jungleAmount = t;
        this.applyJungleAmount();
        this.saveVolumes();
    }

    setMusicTheme(index) {
        const max = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
            ? VFTrackerThemes.count() - 1
            : 8;
        const next = Math.max(0, Math.min(max, Math.round(Number(index) || 0)));
        const prev = this.musicTheme;
        this.musicTheme = next;
        // Mild STYLE colour when switching from PLANET with AMOUNT at 0.
        if (next > 0 && prev !== next && this.jungleAmount < 0.03) {
            this.jungleAmount = 0.4;
            this.applyJungleAmount();
        }
        this.applyMusicTheme();
        // Adapt heard tempo to STYLE × current song (keeps map/victory musical).
        if (prev !== next) {
            this.bpmFollowsStyle = true;
            const pref = this.getPreferredMusicBpm(next);
            if (Number.isFinite(pref) && pref > 0) {
                this.musicBpm = Math.max(60, Math.min(300, Math.round(pref)));
                this.musicSpeed = this.musicBpm / this.referenceBpm;
                this.applyMusicBpm();
                this.updateUI();
            }
        }
        this.saveVolumes();
    }

    resetToDefaults() {
        const d = (typeof VFVolume !== 'undefined') ? VFVolume : { MASTER: 0.1, SOUND: 0.5, MUSIC: 0.65 };
        this.masterVolume = d.MASTER;
        this.soundVolume = d.SOUND;
        this.musicVolume = d.MUSIC;
        this.musicBpm = 132;
        this.musicSpeed = 1;
        this.jungleAmount = 0;
        this.musicTheme = 0;
        this.bpmFollowsStyle = true;
        this.channelVolumes = [1, 1, 1, 1];
        this.channelVoices = ['default', 'default', 'default', 'default'];
        if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.crossfadeSeconds = 1.4;
        if (typeof localAudioManager !== 'undefined') localAudioManager.crossfadeSeconds = 1.4;
        try { localStorage.setItem('vf_musicCrossfade', '1.4'); } catch (e) { /* ignore */ }
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }
}

const volumeControlsManager = new VolumeControlsManager();
