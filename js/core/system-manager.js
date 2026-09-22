"use strict";

/**
 * System Manager
 * Handles initialization and coordination of all game subsystems
 */
class SystemManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.subsystems = {};
        this.initialized = false;
    }

    init() {
        if (this.initialized) {
            console.warn('SystemManager already initialized');
            return;
        }

        // Initialize core subsystems
        this.initializeCoreSubsystems();
        
        // Initialize optional subsystems
        this.initializeOptionalSubsystems();
        
        // Initialize external systems
        this.initializeExternalSystems();

        this.initialized = true;
    }

    initializeCoreSubsystems() {
        // Game Loop
        if (typeof GameLoop !== 'undefined') {
            this.subsystems.gameLoop = new GameLoop(this.gameState, this);
        }

        // Input Handler
        if (typeof InputHandler !== 'undefined') {
            this.subsystems.inputHandler = new InputHandler(this.gameState);
        }

        // UI Manager
        if (typeof UIManager !== 'undefined') {
            this.subsystems.uiManager = new UIManager(this.gameState);
        }

        // Settings Manager
        if (typeof SettingsManager !== 'undefined') {
            this.subsystems.settingsManager = new SettingsManager(this.gameState);
        }

        // Render Manager
        if (typeof CoreRenderManager !== 'undefined') {
            this.subsystems.renderManager = new CoreRenderManager(this.gameState);
            this.subsystems.renderManager.init();
            window.renderManager = this.subsystems.renderManager;
        }
    }

    initializeOptionalSubsystems() {
        // Cheat System
        if (typeof CheatSystem !== 'undefined') {
            this.subsystems.cheatSystem = new CheatSystem(this.gameState);
        }

        // Level Info Manager (reuse global singleton if already constructed)
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager) {
            this.subsystems.levelInfoManager = levelInfoManager;
            if (this.subsystems.levelInfoManager.panel) {
                this.subsystems.levelInfoManager.panel.style.display = 'flex';
            }
        } else if (typeof LevelInfoManager !== 'undefined') {
            this.subsystems.levelInfoManager = new LevelInfoManager();
            if (typeof window !== 'undefined') {
                window.levelInfoManager = this.subsystems.levelInfoManager;
            }
            if (this.subsystems.levelInfoManager.panel) {
                this.subsystems.levelInfoManager.panel.style.display = 'flex';
            }
        } else {
            console.warn('LevelInfoManager not found - level info panel will not work');
        }
    }

    initializeExternalSystems() {
        // Sound System
        if (typeof soundManager !== 'undefined') {
            soundManager.init();
        }

        // Graphics System
        if (typeof GraphicsManager !== 'undefined') {
            graphicsManager = new GraphicsManager();
        }

        // Color System
        // ColorManager is initialized globally
        if (typeof colorManager === 'undefined') {
            console.warn('ColorManager not available - color system may not work');
        }

        // Parallax Manager
        if (typeof parallaxManager !== 'undefined') {
            parallaxManager.init();
        } else {
            console.warn('ParallaxManager not available - background may not render');
        }

        // Ship Renderer
        if (typeof shipRenderer !== 'undefined') {
            shipRenderer.init();
        } else {
            console.warn('ShipRenderer not available - ship rendering may not work');
        }

        // Sprite Loader
        this.initializeSpriteLoader();
    }

    initializeSpriteLoader() {
        // Check if spriteLoader is available (global instance)
        if (typeof spriteLoader !== 'undefined') {
            spriteLoader.loadAllSprites().then(() => {
                // Make sprites available globally
                window.sprites = spriteLoader.sprites;
            }).catch(error => {
                console.error('Failed to load sprites:', error);
            });
        } else {
            console.warn('SpriteLoader not available - graphics may not load properly');
        }
    }

    // Subsystem access
    getSubsystem(name) {
        return this.subsystems[name] || null;
    }

    hasSubsystem(name) {
        return this.subsystems.hasOwnProperty(name);
    }

    // System control
    startAll() {
        if (this.subsystems.gameLoop) {
            this.subsystems.gameLoop.start();
        }
    }

    stopAll() {
        if (this.subsystems.gameLoop) {
            this.subsystems.gameLoop.stop();
        }
    }

    pauseAll() {
        this.gameState.pauseGame();
    }

    resumeAll() {
        this.gameState.resumeGame();
    }

    // Cleanup
    cleanup() {
        this.stopAll();
        this.subsystems = {};
        this.initialized = false;
    }

    // Status
    getStatus() {
        return {
            initialized: this.initialized,
            subsystems: Object.keys(this.subsystems),
            gameRunning: this.gameState.gameRunning,
            isPaused: this.gameState.isPaused
        };
    }
}
