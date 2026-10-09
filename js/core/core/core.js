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
            if (window.vfBootLoader) window.vfBootLoader.setPhase('menu', 0.9);
            setTimeout(() => {
                Promise.resolve(this.restoreMenuWhenReady())
                    .catch((err) => console.error('[boot] menu restore failed:', err))
                    .finally(() => this.dismissBootVeil());
            }, 0);
            // The map's nebula is prepared (or loaded from its stored copy) while the menu builds.
            setTimeout(() => {
                if (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.prewarmNebula) galaxyMapManager.prewarmNebula();
            }, 60);
            // Failsafe: never leave the loader stuck, whatever fails above
            setTimeout(() => this.dismissBootVeil(), 8000);
        } else {
            this.showStartScreen({ skipPersist: true });
            this.dismissBootVeil();
        }

    }

    showBootVeil(state) {
        let veil = document.getElementById('vf-boot-veil');
        if (!veil) {
            veil = document.createElement('div');
            veil.id = 'vf-boot-veil';
            document.body.appendChild(veil);
        }
        // Keep the loading panel; layer destination art behind it while systems finish.
        const loader = document.getElementById('vf-boot-loader');
        veil.className = 'vf-boot-veil vf-boot-veil-loading';
        if (loader) veil.appendChild(loader);
        document.documentElement.classList.add('vf-booting');
        veil.removeAttribute('data-hs-tab');
        veil.style.pointerEvents = 'auto';
        const screen = state && state.screen;
        if (screen === 'home-station') {
            veil.classList.add('vf-boot-veil-hs');
            veil.dataset.hsTab = (state && state.tab) || 'station';
        } else if (
            !screen ||
            screen === 'start' ||
            screen === 'settings' ||
            screen === 'credits' ||
            screen === 'profiles' ||
            screen === 'ingame'
        ) {
            // Same art as .start-screen (ships in hangar)
            veil.classList.add('vf-boot-veil-start');
        } else if (screen === 'theme-editor') {
            veil.classList.add('vf-boot-veil-start');
        } else {
            veil.classList.add('vf-boot-veil-menu');
        }
        if (window.vfBootLoader) window.vfBootLoader.setPhase('assets', 0.86);
    }

    // Menu is built under the veil — finish the loader, then drop the cover.
    dismissBootVeil() {
        const veil = document.getElementById('vf-boot-veil');
        if (!veil) {
            if (window.vfBootLoader && !window.vfBootLoader.isFinished()) {
                window.vfBootLoader.finish({ instant: true });
            }
            return;
        }
        if (veil.dataset.vfDismissed === '1') return;
        veil.dataset.vfDismissed = '1';
        document.querySelectorAll('.vf-menu-enter').forEach((el) => el.classList.remove('vf-menu-enter'));
        if (window.vfBootLoader && !window.vfBootLoader.isFinished()) {
            window.vfBootLoader.setPhase('ready', 1);
            window.vfBootLoader.finish();
            setTimeout(() => {
                if (veil.parentNode) veil.parentNode.removeChild(veil);
                document.documentElement.classList.remove('vf-booting');
            }, 360);
            return;
        }
        if (veil.parentNode) veil.parentNode.removeChild(veil);
        setTimeout(() => document.documentElement.classList.remove('vf-booting'), 800);
    }

    async restoreMenuWhenReady() {
        const state = (typeof menuStateManager !== 'undefined') ? menuStateManager.get() : null;
        const screen = state && state.screen;
        const lightMenu = !screen || screen === 'start' || screen === 'settings' || screen === 'credits' || screen === 'profiles';

        if (!lightMenu) {
            if (window.vfBootLoader) window.vfBootLoader.setPhase('assets', 0.88);
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

        // Pixel font must be ready before the menu paints, otherwise the
        // fallback→Silkscreen swap makes the layout jump under the veil fade
        if (window.vfBootLoader) window.vfBootLoader.setPhase('font', 0.9);
        if (document.fonts && document.fonts.load) {
            await Promise.race([
                document.fonts.load("700 16px 'Silkscreen'").catch(() => {}),
                new Promise((resolve) => setTimeout(resolve, 800))
            ]);
        }
        if (window.vfBootLoader) window.vfBootLoader.setPhase('menu', 0.95);

        const restored = menuStateManager.restore();
        if (!restored) {
            this.showStartScreen({ skipPersist: true });
            menuStateManager.setScreen('start');
        }
        // Boot intro only on a fresh app start (not a refresh of a running session)
        // and not when we resume straight into the home station
        const landedScreen = menuStateManager.get() && menuStateManager.get().screen;
        let alreadyRunning = false;
        try {
            alreadyRunning = sessionStorage.getItem('vf_app_running_v1') === '1';
            sessionStorage.setItem('vf_app_running_v1', '1');
        } catch (e) { /* storage blocked — treat as fresh start */ }
        const inStation = landedScreen === 'home-station'
            || (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible);
        if (!alreadyRunning && !inStation && typeof VFStartIntro !== 'undefined') {
            VFStartIntro.play({
                title: (typeof startScreenManager !== 'undefined' && startScreenManager.title) || 'GLXEE',
                subtitle: (typeof startScreenManager !== 'undefined' && startScreenManager.subtitle) || ''
            });
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
        return this.restartGame();
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
