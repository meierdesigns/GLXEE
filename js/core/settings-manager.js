"use strict";

// Settings and configuration management
class SettingsManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.settings = {
            soundEnabled: true,
            musicEnabled: true,
            difficulty: (typeof difficultyConfigManager !== 'undefined')
                ? difficultyConfigManager.current : 'normal',
            colorPalette: this.getCachedAppTheme()
        };
        
        this.initializeColorTheme();
    }

    getCachedAppTheme() {
        if (typeof themeContextManager !== 'undefined') {
            return themeContextManager.getAppTheme();
        }
        if (typeof colorManager !== 'undefined') {
            return colorManager.getCurrentPalette();
        }
        try {
            const saved = localStorage.getItem('vf_appTheme') || localStorage.getItem('vf_colorPalette');
            if (saved) return saved;
        } catch (e) {
            // localStorage unavailable
        }
        return 'grayscale';
    }
    
    initializeColorTheme() {
        this.updatePaletteSetting(this.settings.colorPalette);
    }

    showSettings() {
        const pauseOverlay = document.getElementById('pauseOverlay');
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (pauseOverlay) {
            pauseOverlay.classList.add('hidden');
        }
        if (settingsOverlay) {
            settingsOverlay.classList.remove('hidden');
        }
        this.updateSettingsDisplay();
        if (typeof volumeControlsManager !== 'undefined') {
            volumeControlsManager.updateUI();
        }
    }

    hideSettings() {
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
        // Only return to pause menu when a match is actually paused
        const pauseOverlay = document.getElementById('pauseOverlay');
        const paused = typeof game !== 'undefined' && game.gameState && game.gameState.isPaused;
        if (pauseOverlay && paused) {
            pauseOverlay.classList.remove('hidden');
        }
    }

    /** Open Theme Editor / Color Appearance from in-game pause settings. */
    openColorAppearance() {
        if (typeof themeEditorUI === 'undefined' || !themeEditorUI.show) return;
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) settingsOverlay.classList.add('hidden');
        const paletteId = (typeof themeContextManager !== 'undefined')
            ? themeContextManager.getAppTheme()
            : this.settings.colorPalette;
        themeEditorUI.show({
            paletteId: paletteId,
            returnToInGameSettings: true,
            skipPersist: true
        });
    }

    toggleSound() {
        this.settings.soundEnabled = !this.settings.soundEnabled;
        this.updateSettingsDisplay();
        
        if (typeof soundManager !== 'undefined') {
            soundManager.setSoundEnabled(this.settings.soundEnabled);
        }
    }

    toggleMusic() {
        this.settings.musicEnabled = !this.settings.musicEnabled;
        this.updateSettingsDisplay();
        
        if (typeof soundManager !== 'undefined') {
            soundManager.setMusicEnabled(this.settings.musicEnabled);
        }
    }

    changeDifficulty() {
        const difficulties = ['easy', 'normal', 'hard'];
        const currentIndex = difficulties.indexOf(this.settings.difficulty);
        const nextIndex = (currentIndex + 1) % difficulties.length;
        this.settings.difficulty = difficulties[nextIndex];
        if (typeof difficultyConfigManager !== 'undefined') {
            difficultyConfigManager.setDifficulty(this.settings.difficulty);
        }
        this.updateSettingsDisplay();
        this.applyDifficultySettings();
    }

    updateSettingsDisplay() {
        const soundToggle = document.getElementById('soundToggle');
        const musicToggle = document.getElementById('musicToggle');
        const difficultyButton = document.getElementById('difficultyButton');
        const colorButton = document.getElementById('colorButton');
        
        if (soundToggle) {
            soundToggle.textContent = this.settings.soundEnabled ? 'ON' : 'OFF';
            soundToggle.classList.toggle('off', !this.settings.soundEnabled);
        }
        
        if (musicToggle) {
            musicToggle.textContent = this.settings.musicEnabled ? 'ON' : 'OFF';
            musicToggle.classList.toggle('off', !this.settings.musicEnabled);
        }
        
        if (difficultyButton) {
            difficultyButton.textContent = this.settings.difficulty.toUpperCase();
        }
        
        if (colorButton) {
            colorButton.textContent = this.settings.colorPalette.toUpperCase();
        }

        const look = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getGlobalLook)
            ? colorPaletteSystem.getGlobalLook() : null;
        ['brightness', 'contrast', 'saturation'].forEach((key) => {
            const input = document.getElementById(`visual${key.charAt(0).toUpperCase()}${key.slice(1)}`);
            const value = document.getElementById(`visual${key.charAt(0).toUpperCase()}${key.slice(1)}Value`);
            if (!input || !look) return;
            input.value = String(Math.round(look[key]));
            if (value) value.textContent = `${Math.round(look[key])}%`;
        });
    }

    setVisualSetting(key, value) {
        if (typeof colorPaletteSystem === 'undefined' || !colorPaletteSystem.setGlobalLook) return;
        const numeric = Math.max(0, Math.min(200, Number(value)));
        colorPaletteSystem.setGlobalLook({ [key]: numeric });
        const valueEl = document.getElementById(`visual${key.charAt(0).toUpperCase()}${key.slice(1)}Value`);
        if (valueEl) valueEl.textContent = `${Math.round(numeric)}%`;
    }
    
    applyDifficultySettings() {
        const profile = (typeof difficultyConfigManager !== 'undefined')
            ? difficultyConfigManager.getProfile(this.settings.difficulty)
            : null;
        if (profile && this.gameState) {
            this.gameState.setObstacleSpawnInterval(
                Math.max(250, Math.round(2000 * profile.obstacleSpawnMul))
            );
        }
        switch (this.settings.difficulty) {
            case 'easy':
                this.gameState.setObstacleSpawnInterval(3000);
                break;
            case 'normal':
                this.gameState.setObstacleSpawnInterval(2000);
                break;
            case 'hard':
                this.gameState.setObstacleSpawnInterval(1000);
                break;
        }
    }

    /** App theme only — does not set planet/galaxy/stage themes. */
    updatePaletteSetting(paletteId) {
        this.settings.colorPalette = paletteId;
        
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.setAppTheme(paletteId);
        } else if (typeof colorManager !== 'undefined') {
            colorManager.setPalette(paletteId, { persist: true, isAppTheme: true });
        } else {
            console.warn('ColorManager not available for palette update');
        }
    }
    
    updateCSSVariables(colorName) {
        const root = document.documentElement;
        const colorMap = SettingsManager.getColorMap();
        const themeName = colorMap[colorName] || 'teal';
        
        root.style.setProperty('--current-theme-primary', `var(--color-${themeName}-primary)`);
        root.style.setProperty('--current-theme-secondary', `var(--color-${themeName}-secondary)`);
        root.style.setProperty('--current-theme-accent', `var(--color-${themeName}-accent)`);
        root.style.setProperty('--overlay-color', `var(--color-${themeName}-primary)`);
        
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(`theme-${themeName}`);
    }

    changeColor() {
        const palettes = (typeof themeContextManager !== 'undefined')
            ? themeContextManager.presetIds.slice()
            : ['grayscale', 'retro', 'neon', 'ocean', 'fire', 'purple', 'forest', 'sunset'];
        const currentIndex = palettes.indexOf(this.settings.colorPalette);
        const nextIndex = (currentIndex + 1) % palettes.length;
        this.settings.colorPalette = palettes[nextIndex];
        
        this.updatePaletteSetting(this.settings.colorPalette);
        this.updateSettingsDisplay();
    }

    static getColorMap() {
        console.warn('getColorMap is deprecated - use palette system instead');
        return {};
    }
}
