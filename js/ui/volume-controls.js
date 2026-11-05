"use strict";

// Volume Controls Manager — linear MASTER × (SOUND|MUSIC) routing into soundManager.
class VolumeControlsManager {
    constructor() {
        this.masterVolume = 0.75;
        this.soundVolume = 0.5;
        this.musicVolume = 0.65;
        /** Music tempo multiplier (1 = authored BPM). */
        this.musicSpeed = 3.5;
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
                this[prop] = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100));
                this.updateUI();
                this.applyVolumes();
                this.saveVolumes();
            });
        };
        bind('masterVolume', 'masterVolume');
        bind('soundVolume', 'soundVolume');
        bind('musicVolume', 'musicVolume');
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
            if (soundManager.setMasterVolume) soundManager.setMasterVolume(this.masterVolume);
            if (soundManager.setSoundVolume) soundManager.setSoundVolume(this.soundVolume);
            if (soundManager.setMusicVolume) soundManager.setMusicVolume(this.musicVolume);
        }

        const bus = (typeof soundManager !== 'undefined' && soundManager.musicBusVolume)
            ? soundManager.musicBusVolume()
            : Math.max(0, Math.min(1, this.masterVolume * this.musicVolume));

        if (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.setVolume) {
            youtubeSoundtrackManager.setVolume(bus);
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setVolume) {
            localAudioManager.setVolume(bus);
        }
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setVolume) {
            vfTrackerManager.setVolume(bus);
        }
        this.applyMusicSpeed();

        if (typeof soundConfig !== 'undefined') {
            soundConfig.masterVolume = this.masterVolume;
            soundConfig.soundVolume = this.soundVolume;
            soundConfig.musicVolume = this.musicVolume;
        }
    }

    applyMusicSpeed() {
        const speed = Math.max(0.5, Math.min(4, Number(this.musicSpeed) || 1));
        this.musicSpeed = speed;
        if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.setTempoScale) {
            vfTrackerManager.setTempoScale(speed);
        } else if (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.player) {
            vfTrackerManager.player.tempoScale = speed;
        }
        if (typeof localAudioManager !== 'undefined' && localAudioManager.setPlaybackRate) {
            localAudioManager.setPlaybackRate(speed);
        }
    }

    saveVolumes() {
        try {
            localStorage.setItem('vf_masterVolume', String(this.masterVolume));
            localStorage.setItem('vf_soundVolume', String(this.soundVolume));
            localStorage.setItem('vf_musicVolume', String(this.musicVolume));
            localStorage.setItem('vf_musicSpeed', String(this.musicSpeed));
            localStorage.setItem('vf_volumeSchema', '2');
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
            const savedSpeed = localStorage.getItem('vf_musicSpeed');
            const speedDefaultMark = localStorage.getItem('vf_musicSpeedDefault');

            if (savedMaster !== null) this.masterVolume = parseFloat(savedMaster);
            if (savedSound !== null) this.soundVolume = parseFloat(savedSound);
            if (savedMusic !== null) this.musicVolume = parseFloat(savedMusic);

            // One-shot migrate: lock in 3.5× as the stored music speed.
            if (speedDefaultMark !== '3.5') {
                this.musicSpeed = 3.5;
                localStorage.setItem('vf_musicSpeedDefault', '3.5');
                localStorage.setItem('vf_musicSpeed', '3.5');
            } else if (savedSpeed !== null) {
                this.musicSpeed = parseFloat(savedSpeed);
            }

            if (!Number.isFinite(this.masterVolume)) this.masterVolume = 0.75;
            if (!Number.isFinite(this.soundVolume)) this.soundVolume = 0.5;
            if (!Number.isFinite(this.musicVolume)) this.musicVolume = 0.65;
            if (!Number.isFinite(this.musicSpeed)) this.musicSpeed = 3.5;

            this.masterVolume = Math.max(0, Math.min(1, this.masterVolume));
            this.soundVolume = Math.max(0, Math.min(1, this.soundVolume));
            this.musicVolume = Math.max(0, Math.min(1, this.musicVolume));
            this.musicSpeed = Math.max(0.5, Math.min(4, this.musicSpeed));

            // Old schema used ~10%/5%/20% plus a hidden ×8 music bus — migrate up once.
            if (schema !== '2'
                && this.masterVolume <= 0.15
                && this.soundVolume <= 0.12
                && this.musicVolume <= 0.3) {
                this.masterVolume = 0.75;
                this.soundVolume = 0.5;
                this.musicVolume = 0.65;
                this.saveVolumes();
            }
        } catch (e) {
            console.warn('Could not load volume settings:', e);
        }
    }

    getMasterVolume() { return this.masterVolume; }
    getSoundVolume() { return this.soundVolume; }
    getMusicVolume() { return this.musicVolume; }
    getMusicSpeed() { return this.musicSpeed; }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }

    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }

    setMusicSpeed(speed) {
        this.musicSpeed = Math.max(0.5, Math.min(4, Number(speed) || 1));
        this.applyMusicSpeed();
        this.saveVolumes();
    }

    resetToDefaults() {
        this.masterVolume = 0.75;
        this.soundVolume = 0.5;
        this.musicVolume = 0.65;
        this.musicSpeed = 3.5;
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }
}

const volumeControlsManager = new VolumeControlsManager();
