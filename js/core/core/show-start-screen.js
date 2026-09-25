"use strict";

// GameCore methods, split from core.js.
extendClass(GameCore, {
    showStartScreen(options) {
        const skipPersist = options && options.skipPersist;
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
        }

        // Initialize and show StartScreenManager (routes to Station when profile loaded)
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.returnToHub({ skipPersist: !!skipPersist });
        } else {
            const startScreen = document.getElementById('startScreen');
            if (startScreen) {
                startScreen.classList.remove('hidden');
            }
        }
        
        // Hide level info panel
        const levelInfoPanel = document.getElementById('levelInfoPanel');
        if (levelInfoPanel) {
            levelInfoPanel.style.display = 'none';
        }
        
        // Hide game container
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        if (!skipPersist && typeof menuStateManager !== 'undefined') {
            const current = menuStateManager.get();
            if (!current || current.screen === 'ingame') {
                if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
                    menuStateManager.setScreen('home-station', { tab: 'station' });
                } else {
                    menuStateManager.setScreen('start');
                }
            }
        }
    },

    hideStartScreen() {
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            startScreen.classList.add('hidden');
        }
        
        // Hide StartScreenManager
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        }
    },

    // Level management
    setLevel(levelId) {
        return this.levelManager.setLevel(levelId);
    },

    getCurrentLevel() {
        return this.levelManager.getCurrentLevel();
    },

    nextLevel() {
        return this.gameControl.nextLevel();
    },

    previousLevel() {
        return this.gameControl.previousLevel();
    },

    // Level info management
    updateLevelInfo() {
        this.gameControl.updateLevelInfo();
    },

    updateLevelStats(stats) {
        this.gameControl.updateLevelStats(stats);
    },

    // Settings management (delegated to settings manager)
    updateColorSetting(color) {
        if (this.settingsManager) {
            this.settingsManager.updateColorSetting(color);
        }
    },

    changeColor() {
        if (this.settingsManager) {
            this.settingsManager.changeColor();
        }
    },

    changeDifficulty() {
        if (this.settingsManager) {
            this.settingsManager.changeDifficulty();
        }
    },

    toggleSound() {
        if (this.settingsManager) {
            this.settingsManager.toggleSound();
        }
    },

    toggleMusic() {
        if (this.settingsManager) {
            this.settingsManager.toggleMusic();
        }
    },

    showSettings() {
        if (this.settingsManager) {
            this.settingsManager.showSettings();
        }
    },

    hideSettings() {
        if (this.settingsManager) {
            this.settingsManager.hideSettings();
        }
    },

    // UI management (delegated to UI manager)
    handleKeyDown(event) {
        if (this.inputHandler) {
            this.inputHandler.handleKeyDown(event);
        }
    },

    handleGameOverInput(event) {
        if (this.uiManager) {
            this.uiManager.handleGameOverInput(event);
        }
    },

    updateGameOverMenuDisplay() {
        if (this.uiManager) {
            this.uiManager.updateGameOverMenuDisplay();
        }
    },

    selectGameOverOption() {
        if (this.uiManager) {
            this.uiManager.selectGameOverOption();
        }
    },

    // Cheat system (delegated to cheat system)
    toggleCheatMenu() {
        if (this.cheatSystem) {
            this.cheatSystem.toggleCheatMenu();
        }
    },

    toggleLevelSelect() {
        if (this.cheatSystem) {
            this.cheatSystem.toggleLevelSelect();
        }
    },

    // Game state access
    getGameState() {
        return this.gameState;
    },

    getLevelManager() {
        return this.levelManager;
    },

    getSystemManager() {
        return this.systemManager;
    },

    getGameControl() {
        return this.gameControl;
    },

    // Status and debugging
    getStatus() {
        return {
            gameState: this.gameState.getStats(),
            levelManager: {
                currentLevel: this.levelManager.getCurrentLevel(),
                availableLevels: this.levelManager.getAvailableLevels()
            },
            systemManager: this.systemManager.getStatus()
        };
    },

    // Cleanup
    cleanup() {
        this.systemManager.cleanup();
    },
});
