// Sound Configuration and Settings
export const soundConfig = {
    // Master volume settings
    masterVolume: 0.1, // Drastically reduced to 0.1
    soundVolume: 0.05, // Drastically reduced to 0.05
    musicVolume: 0.3,  // Reduced to 0.3
    
    // Audio context settings
    sampleRate: 44100,
    bufferSize: 4096,
    
    // Sound categories
    categories: {
        effects: {
            volume: 0.05, // Drastically reduced to 0.05
            enabled: true,
            sounds: ['shoot', 'explosion', 'hit', 'shieldReflect', 'powerUp']
        },
        ui: {
            volume: 0.1, // Drastically reduced to 0.1
            enabled: true,
            sounds: ['menuSelect', 'menuNavigate', 'gameOver', 'victory', 'levelComplete']
        },
        music: {
            volume: 0.2, // Reduced to 0.2
            enabled: true,
            tracks: ['menuMusic', 'marsMusic', 'jupiterMusic', 'saturnMusic', 'neptuneMusic', 'plutoMusic', 'battleMusic', 'victoryMusic']
        }
    },
    
    // Audio file formats (for future implementation)
    formats: {
        preferred: 'wav',
        fallback: 'mp3',
        supported: ['wav', 'mp3', 'ogg']
    },
    
    // Game Boy style audio constraints
    constraints: {
        maxChannels: 4,
        maxFrequency: 20000,
        minFrequency: 20,
        bitDepth: 8,
        sampleRate: 22050
    },
    
    // Sound presets
    presets: {
        gameboy: {
            masterVolume: 0.05, // Drastically reduced to 0.05
            soundVolume: 0.02,  // Drastically reduced to 0.02
            musicVolume: 0.2,   // Reduced to 0.2
            lowPass: true,
            bitCrush: true
        },
        modern: {
            masterVolume: 0.1, // Drastically reduced to 0.1
            soundVolume: 0.05, // Drastically reduced to 0.05
            musicVolume: 0.3,  // Reduced to 0.3
            lowPass: false,
            bitCrush: false
        },
        retro: {
            masterVolume: 0.05, // Drastically reduced to 0.05
            soundVolume: 0.02,  // Drastically reduced to 0.02
            musicVolume: 0.2,   // Reduced to 0.2
            lowPass: true,
            bitCrush: true
        }
    }
};
