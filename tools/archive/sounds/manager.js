// Sound Manager Asset Integration
export class SoundAssetManager {
    constructor() {
        this.sounds = {};
        this.music = {};
        this.config = null;
        this.audioContext = null;
    }
    
    // Initialize sound assets
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.loadSoundAssets();
            await this.loadMusicAssets();
            await this.loadConfig();
            return true;
        } catch (error) {
            console.error('Failed to initialize sound assets:', error);
            return false;
        }
    }
    
    // Load sound effect assets
    async loadSoundAssets() {
        // Import sound effects
        const { soundAssets } = await import('./sound-effects.js');
        this.sounds = soundAssets;
    }
    
    // Load music assets
    async loadMusicAssets() {
        // Import music tracks
        const { musicAssets } = await import('./music.js');
        this.music = musicAssets;
    }
    
    // Load sound configuration
    async loadConfig() {
        // Import sound configuration
        const { soundConfig } = await import('./config.js');
        this.config = soundConfig;
    }
    
    // Get sound asset by name
    getSound(soundName) {
        return this.sounds[soundName] || null;
    }
    
    // Get music asset by name
    getMusic(musicName) {
        return this.music[musicName] || null;
    }
    
    // Get sound configuration
    getConfig() {
        return this.config;
    }
    
    // Create Web Audio API sound from asset
    createSoundFromAsset(soundAsset) {
        if (!this.audioContext || !soundAsset) return null;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Configure based on asset type
        switch (soundAsset.type) {
            case 'laser':
                if (soundAsset.frequency.start && soundAsset.frequency.end) {
                    oscillator.frequency.setValueAtTime(soundAsset.frequency.start, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(soundAsset.frequency.end, this.audioContext.currentTime + soundAsset.duration);
                } else {
                    oscillator.frequency.value = soundAsset.frequency;
                }
                oscillator.type = 'sawtooth';
                break;
            case 'beep':
                oscillator.frequency.value = soundAsset.frequency;
                oscillator.type = 'square';
                break;
            case 'melody':
                // Handle melody with multiple frequencies
                oscillator.frequency.value = soundAsset.frequencies[0];
                oscillator.type = 'square';
                break;
            default:
                oscillator.frequency.value = soundAsset.frequency || 440;
                oscillator.type = 'square';
        }
        
        // Set volume (with additional reduction for laser sounds)
        let baseVolume = soundAsset.volume || 0.1;
        if (soundAsset.type === 'laser') {
            baseVolume *= 0.1; // Additional 90% reduction for laser sounds
        }
        
        // Apply volume controls from volume manager
        let masterVolume = 1.0;
        let soundVolume = 1.0;
        let musicVolume = 1.0;
        
        if (typeof volumeControlsManager !== 'undefined') {
            masterVolume = volumeControlsManager.getMasterVolume();
            soundVolume = volumeControlsManager.getSoundVolume();
            musicVolume = volumeControlsManager.getMusicVolume();
        }
        
        // Apply appropriate volume based on sound type
        let finalVolume = baseVolume * masterVolume;
        if (soundAsset.type === 'laser' || soundAsset.type === 'beep' || soundAsset.type === 'explosion') {
            finalVolume *= soundVolume;
        } else if (soundAsset.type === 'melody' || soundAsset.name?.includes('music')) {
            finalVolume *= musicVolume;
        }
        
        gainNode.gain.setValueAtTime(finalVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + soundAsset.duration);
        
        return { oscillator, gainNode };
    }
    
    // Play sound from asset
    playSound(soundName) {
        const soundAsset = this.getSound(soundName);
        if (!soundAsset) {
            console.warn(`Sound asset not found: ${soundName}`);
            return;
        }
        
        const { oscillator, gainNode } = this.createSoundFromAsset(soundAsset);
        if (!oscillator) return;
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + soundAsset.duration);
    }
    
    // Get all available sounds
    getAllSounds() {
        return Object.keys(this.sounds);
    }
    
    // Get all available music
    getAllMusic() {
        return Object.keys(this.music);
    }
}

// Global sound asset manager instance
export const soundAssetManager = new SoundAssetManager();
