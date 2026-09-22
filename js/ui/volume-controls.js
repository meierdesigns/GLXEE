"use strict";

// Volume Controls Manager
class VolumeControlsManager {
    constructor() {
        this.masterVolume = 0.1; // Default 10%
        this.soundVolume = 0.05; // Default 5%
        this.musicVolume = 0.2;  // Default 20%
        
        this.init();
    }
    
    init() {
        // Load saved volumes from localStorage
        this.loadVolumes();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update UI
        this.updateUI();
        
        // Apply volumes to sound system
        this.applyVolumes();
    }
    
    setupEventListeners() {
        // Master volume slider
        const masterSlider = document.getElementById('masterVolume');
        if (masterSlider) {
            masterSlider.addEventListener('input', (e) => {
                this.masterVolume = parseInt(e.target.value) / 100;
                this.updateUI();
                this.applyVolumes();
                this.saveVolumes();
            });
        }
        
        // Sound volume slider
        const soundSlider = document.getElementById('soundVolume');
        if (soundSlider) {
            soundSlider.addEventListener('input', (e) => {
                this.soundVolume = parseInt(e.target.value) / 100;
                this.updateUI();
                this.applyVolumes();
                this.saveVolumes();
            });
        }
        
        // Music volume slider
        const musicSlider = document.getElementById('musicVolume');
        if (musicSlider) {
            musicSlider.addEventListener('input', (e) => {
                this.musicVolume = parseInt(e.target.value) / 100;
                this.updateUI();
                this.applyVolumes();
                this.saveVolumes();
            });
        }
    }
    
    updateUI() {
        const sync = (id, valueId, vol) => {
            const pct = Math.round(vol * 100);
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

        // Embedded settings panels use data-volume attributes (no fixed ids)
        document.querySelectorAll('.volume-slider[data-volume]').forEach((slider) => {
            const key = slider.dataset.volume;
            let vol = null;
            if (key === 'master') vol = this.masterVolume;
            else if (key === 'sound') vol = this.soundVolume;
            else if (key === 'music') vol = this.musicVolume;
            if (vol == null) return;
            const pct = Math.round(vol * 100);
            slider.value = pct;
            slider.style.setProperty('--vol-fill', pct + '%');
            const value = slider.parentElement && slider.parentElement.querySelector(`[data-volume-value="${key}"]`);
            if (value) value.textContent = pct + '%';
        });
    }
    
    applyVolumes() {
        // Apply to sound manager if available
        if (typeof soundManager !== 'undefined') {
            soundManager.setMasterVolume(this.masterVolume);
            soundManager.setSoundVolume(this.soundVolume);
            soundManager.setMusicVolume(this.musicVolume);
        }

        if (typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setVolume(this.masterVolume * this.musicVolume);
        }
        
        // Apply to color manager if available (for overlay effects)
        if (typeof colorManager !== 'undefined') {
            // Could be used for visual feedback
        }
        
        // Update sound config
        if (typeof soundConfig !== 'undefined') {
            soundConfig.masterVolume = this.masterVolume;
            soundConfig.soundVolume = this.soundVolume;
            soundConfig.musicVolume = this.musicVolume;
        }
    }
    
    saveVolumes() {
        try {
            localStorage.setItem('vf_masterVolume', this.masterVolume.toString());
            localStorage.setItem('vf_soundVolume', this.soundVolume.toString());
            localStorage.setItem('vf_musicVolume', this.musicVolume.toString());
        } catch (e) {
            console.warn('Could not save volume settings:', e);
        }
    }
    
    loadVolumes() {
        try {
            const savedMaster = localStorage.getItem('vf_masterVolume');
            const savedSound = localStorage.getItem('vf_soundVolume');
            const savedMusic = localStorage.getItem('vf_musicVolume');
            
            if (savedMaster !== null) {
                this.masterVolume = parseFloat(savedMaster);
            }
            if (savedSound !== null) {
                this.soundVolume = parseFloat(savedSound);
            }
            if (savedMusic !== null) {
                this.musicVolume = parseFloat(savedMusic);
            }
        } catch (e) {
            console.warn('Could not load volume settings:', e);
        }
    }
    
    // Public methods for external access
    getMasterVolume() {
        return this.masterVolume;
    }
    
    getSoundVolume() {
        return this.soundVolume;
    }
    
    getMusicVolume() {
        return this.musicVolume;
    }
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }
    
    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }
    
    // Reset to defaults
    resetToDefaults() {
        this.masterVolume = 0.1;
        this.soundVolume = 0.05;
        this.musicVolume = 0.2;
        this.updateUI();
        this.applyVolumes();
        this.saveVolumes();
    }
}

// Global volume controls manager instance
const volumeControlsManager = new VolumeControlsManager();
