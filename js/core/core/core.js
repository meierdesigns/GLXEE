"use strict";

/**
 * Game Core - Main coordinator
 * Simplified main class that coordinates all subsystems
 */
class GameCore {
    constructor() {
        // Initialize core managers
        this.gameState = new GameStateManager();
        this.levelManager = new CoreLevelManager(this.gameState);
        this.coreLevelManager = this.levelManager;
        this.systemManager = new SystemManager(this.gameState);
        this.gameControl = new GameControlSystem(this.gameState, this.levelManager, this.systemManager);
        
        // Game state properties
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnInterval = 2000; // 2 seconds default
        
        // Legacy compatibility - expose commonly used subsystems
        this.gameLoop = null;
        this.inputHandler = null;
        this.uiManager = null;
        this.cheatSystem = null;
        this.settingsManager = null;
        this.renderManager = null;
        this.levelInfoManager = null;
    }

    init() {
        
        // Initialize all systems
        this.systemManager.init();
        
        // Set up legacy compatibility
        this.setupLegacyCompatibility();

        // Theme before any paint (avoid grayscale flash → forest)
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
        }

        // Keep shells hidden until restore decides (avoid Start → Station hop on refresh)
        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.add('hidden');
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) gameContainer.style.display = 'none';

        if (typeof menuStateManager !== 'undefined') {
            this.showBootVeil(menuStateManager.get());
            setTimeout(() => {
                this.restoreMenuWhenReady();
            }, 0);
        } else {
            this.showStartScreen({ skipPersist: true });
        }
        
    }

    showBootVeil(state) {
        let veil = document.getElementById('vf-boot-veil');
        if (!veil) {
            veil = document.createElement('div');
            veil.id = 'vf-boot-veil';
            document.body.appendChild(veil);
        }
        veil.className = 'vf-boot-veil';
        veil.removeAttribute('data-hs-tab');
        const screen = state && state.screen;
        if (screen === 'home-station') {
            veil.classList.add('vf-boot-veil-hs');
            veil.dataset.hsTab = (state && state.tab) || 'station';
        } else if (
            !screen ||
            screen === 'start' ||
            screen === 'settings' ||
            screen === 'credits' ||
            screen === 'ingame'
        ) {
            // Same art as .start-screen (ships in hangar)
            veil.classList.add('vf-boot-veil-start');
        } else if (screen === 'theme-editor') {
            veil.classList.add('vf-boot-veil-start');
        } else {
            veil.classList.add('vf-boot-veil-menu');
        }
    }

    dismissBootVeil() {
        const veil = document.getElementById('vf-boot-veil');
        if (!veil) return;
        veil.classList.add('is-leaving');
        const done = () => {
            if (veil.parentNode) veil.parentNode.removeChild(veil);
        };
        veil.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 420);
    }

    async restoreMenuWhenReady() {
        const state = (typeof menuStateManager !== 'undefined') ? menuStateManager.get() : null;
        const screen = state && state.screen;
        const lightMenu = !screen || screen === 'start' || screen === 'settings' || screen === 'credits' || screen === 'ingame';

        if (!lightMenu) {
            // Short wait for icons/ships — boot veil already shows destination art
            const deadline = Date.now() + 600;
            while (Date.now() < deadline) {
                const spritesReady = typeof spriteLoader !== 'undefined' && spriteLoader.isLoaded();
                const shipsReady = typeof graphicsManager !== 'undefined'
                    && graphicsManager.shipAssetLoader
                    && graphicsManager.shipAssetLoader.isLoaded();
                if (spritesReady && shipsReady) break;
                await new Promise((resolve) => setTimeout(resolve, 30));
            }
            if (typeof spriteLoader !== 'undefined' && spriteLoader.whenLoaded) {
                await spriteLoader.whenLoaded(400);
            }
        }

        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
        }

        const restored = menuStateManager.restore();
        if (!restored) {
            this.showStartScreen({ skipPersist: true });
            menuStateManager.setScreen('start');
        }
        // Let start-screen / station paint under the veil, then fade
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        requestAnimationFrame(() => {
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
            requestAnimationFrame(() => this.dismissBootVeil());
        });
    }

    setupLegacyCompatibility() {
        // Expose subsystems for backward compatibility
        this.gameLoop = this.systemManager.getSubsystem('gameLoop');
        this.inputHandler = this.systemManager.getSubsystem('inputHandler');
        this.uiManager = this.systemManager.getSubsystem('uiManager');
        this.cheatSystem = this.systemManager.getSubsystem('cheatSystem');
        this.settingsManager = this.systemManager.getSubsystem('settingsManager');
        this.renderManager = this.systemManager.getSubsystem('renderManager');
        this.levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        
        // Make managers globally available
        if (this.uiManager) {
            window.uiManager = this.uiManager;
        }
        if (this.settingsManager) {
            window.settingsManager = this.settingsManager;
        }
        if (typeof colorManager !== 'undefined') {
            window.colorManager = colorManager;
        }
        if (typeof startScreenManager !== 'undefined') {
            window.startScreenManager = startScreenManager;
        }
        
        // Make game globally available
        window.game = this;
        this.width = this.gameState.width;
        this.height = this.gameState.height;
        this.baseWidth = this.gameState.width;
        this.baseHeight = this.gameState.height;
        this.internalWidth = this.gameState.width;
        this.internalHeight = this.gameState.height;

        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.update) {
            window.viewportFit.update();
        }
    }

    // Main game control methods
    startGame(levelId = 'mars') {
        return this.gameControl.startGame(levelId);
    }

    restart() {
        // Reset obstacle spawn timer
        this.obstacleSpawnTimer = 0;
        this.gameRunning = true;
        this.isPaused = false;
        
        // Hide victory screen if visible
        const victoryScreen = document.getElementById('victoryScreen');
        if (victoryScreen) {
            victoryScreen.classList.add('hidden');
        }
        
        // Reset all managers
        if (typeof bulletManager !== 'undefined') bulletManager.reset();
        if (typeof enemyManager !== 'undefined') enemyManager.reset();
        if (typeof playerManager !== 'undefined') playerManager.reset();
        if (typeof obstacleManager !== 'undefined') obstacleManager.reset();
        if (typeof pickupManager !== 'undefined') pickupManager.reset(true);
        
        // Hide game over screen
        const gameOverScreen = document.getElementById('gameOver');
        if (gameOverScreen) {
            gameOverScreen.classList.add('hidden');
        }
    }

    restartGame() {
        // Reset obstacle spawn timer
        this.obstacleSpawnTimer = 0;
        return this.gameControl.restartGame();
    }

    stopGame() {
        this.gameControl.stopGame();
    }

    pauseGame() {
        this.gameControl.pauseGame();
    }

    resumeGame() {
        this.gameControl.resumeGame();
    }

    gameOver() {
        this.gameControl.gameOver();
    }

    playerWins() {
        this.gameControl.playerWins();
    }

    quitToMainMenu() {
        this.gameControl.quitToMainMenu();
    }

    showLevelSelection() {
        this.gameControl.showLevelSelection();
    }
}
