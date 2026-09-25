"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    applySettings() {
        const lookPatch = {};
        this.settingsItems.forEach((item) => {
            if (item.type === 'globalLook' && item.lookKey) {
                lookPatch[item.lookKey] = Number(item.value);
            }
        });
        const grayscaleSetting = this.settingsItems.find((item) => item.type === 'grayscale');
        if (grayscaleSetting) {
            lookPatch.saturation = grayscaleSetting.value === 'ON'
                ? 0
                : Number((this.settingsItems.find((item) => item.lookKey === 'saturation') || {}).value || 100);
        }
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
            colorPaletteSystem.setGlobalLook(lookPatch);
        }

        const soundSetting = this.settingsItems.find(item => item.name === 'Sound');
        if (soundSetting && typeof soundManager !== 'undefined') {
            soundManager.setSoundEnabled(soundSetting.value === 'ON');
        }

        const musicSetting = this.settingsItems.find(item => item.name === 'Music');
        if (musicSetting && typeof soundManager !== 'undefined') {
            soundManager.setMusicEnabled(musicSetting.value === 'ON');
        }

        const difficultySetting = this.settingsItems.find(item => item.name === 'Difficulty');
        if (difficultySetting) {
            const difficultyId = String(difficultySetting.value || 'normal').toLowerCase();
            if (typeof difficultyConfigManager !== 'undefined') {
                difficultyConfigManager.setDifficulty(difficultyId);
            }
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.difficulty = difficultyId;
                settingsManager.applyDifficultySettings();
                settingsManager.updateSettingsDisplay();
            }
        }

        const menuTrack = this.settingsItems.find(item => item.type === 'youtubeUrl');
        if (menuTrack && typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setMenuUrl(menuTrack.value || '');
            if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
                soundManager.startMenuMusic();
            }
        }

        const borderSetting = this.settingsItems.find(item => item.type === 'borderWeight');
        if (borderSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setBorderWeight(borderSetting.value);
        }

        const indicatorSetting = this.settingsItems.find(item => item.type === 'indicatorWeight');
        if (indicatorSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setIndicatorWeight(indicatorSetting.value);
        }

        const shipRenderSetting = this.settingsItems.find(item => item.type === 'shipRenderStyle');
        if (shipRenderSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setShipRenderStyle(shipRenderSetting.value);
        }

        const parallaxSetting = this.settingsItems.find(item => item.type === 'bgParallax');
        if (parallaxSetting && typeof VFBgMouseParallax !== 'undefined') {
            VFBgMouseParallax.setIntensity(parallaxSetting.value);
        }

        const controlsSetting = this.settingsItems.find(item => item.type === 'controlsHints');
        if (controlsSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setControlsHints(controlsSetting.value);
        }

        if (typeof uiAppearanceManager !== 'undefined') {
            this.settingsItems.forEach((item) => {
                if (item.type === 'uiFx' && item.fxKey) {
                    uiAppearanceManager.setFx(item.fxKey, item.value);
                }
            });
        }
    },

    applyPaletteChange() {
        const paletteSetting = this.settingsItems.find(item => item.name === 'App Theme' || item.name === 'Color Theme');

        if (paletteSetting) {
            const paletteId = paletteSetting.value;
            if (typeof themeContextManager !== 'undefined') {
                themeContextManager.setAppTheme(paletteId);
            } else if (typeof colorManager !== 'undefined') {
                colorManager.setPalette(paletteId, { persist: true, isAppTheme: true });
            }
            if (typeof iconRenderer !== 'undefined' && iconRenderer.clearCache) {
                iconRenderer.clearCache();
            }
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.colorPalette = paletteId;
                settingsManager.updateSettingsDisplay();
            }
            this.syncSecondBaseSettingValue();
            const secondIdx = this.settingsItems.findIndex((s) => s.type === 'secondBase');
            if (secondIdx >= 0) this.refreshSettingsRow(secondIdx);
        }
    },

    openThemeEditor(paletteId) {
        if (typeof themeEditorUI === 'undefined') {
            console.warn('Theme editor not available');
            return;
        }
        this.showSettings = false;
        this.hide();
        themeEditorUI.show({
            paletteId: paletteId || (this.settingsItems[0] && this.settingsItems[0].value),
            returnToSettings: true
        });
    },

    // Legacy method - no longer needed with palette system
    loadColorCSS(colorName) {
        console.warn('loadColorCSS is deprecated - use palette system instead');
    },

    // Start game with selected level and ship
    startGameWithLevelAndShip(selectedLevel, selectedShip) {

        // Set the selected ship in graphics manager
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(selectedShip);
        } else {
            console.error('graphicsManager not available');
        }

        // Start the game with selected level
        this.startGameWithLevel(selectedLevel);
    },

    // Start game with specific level
    startGameWithLevel(level) {
        this.hide();
        if (typeof soundManager !== 'undefined' && soundManager.stopMenuMusic) {
            soundManager.stopMenuMusic();
        }

        let levelId = level.id && typeof level.id === 'string'
            ? level.id.toLowerCase()
            : level.name.toLowerCase();
        // Resume mid-planet progress when only a planet id was supplied
        if (levelId && levelId.indexOf('-') === -1
            && typeof profileManager !== 'undefined' && profileManager.getResumeLevelId) {
            levelId = profileManager.getResumeLevelId(levelId) || levelId;
        }

        if (typeof game !== 'undefined' && typeof game.startGame === 'function') {
            game.startGame(levelId);
        } else if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.startPlanetGame(level);
        } else {
            console.error('No game start system available');
        }
    },

    // Start game with selected ship
    startGameWithShip(selectedShip) {

        // Set the selected ship in graphics manager
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(selectedShip);
        } else {
            console.error('graphicsManager not available');
        }

        // Start the game
        this.startGame();
    },

    // Set player ship model in graphics manager
    setPlayerShipModel(shipModel) {
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(shipModel);
        }
    },
});
