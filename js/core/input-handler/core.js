"use strict";

// Input handling and keyboard management
class InputHandler {
    constructor(gameState) {
        this.gameState = gameState;
        this.keys = {};
        this.activeTimeouts = []; // Track active timeouts for cleanup
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(event) {
        const blockShip = typeof menuNavHelper !== 'undefined' && menuNavHelper.shouldBlockShipControls();
        if (!(blockShip && typeof menuNavHelper !== 'undefined' && menuNavHelper.isMoveKey(event.key))) {
            this.keys[event.key] = true;
        } else {
            // Clear sticky movement while menus own the arrows
            this.keys[event.key] = false;
            this.keys['ArrowUp'] = false;
            this.keys['ArrowDown'] = false;
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
            this.keys['w'] = this.keys['W'] = false;
            this.keys['a'] = this.keys['A'] = false;
            this.keys['s'] = this.keys['S'] = false;
            this.keys['d'] = this.keys['D'] = false;
        }
        
        // Handle level selection first - it has highest priority
        if (typeof cheatSystem !== 'undefined' && cheatSystem.levelSelectVisible) {
            cheatSystem.handleLevelSelectInput(event.key);
            return;
        }
        
        // Handle cheat menu second - it has high priority
        if (typeof cheatSystem !== 'undefined' && cheatSystem.cheatMenuVisible) {
            cheatSystem.handleCheatMenuInput(event.key);
            return;
        }
        
        // Handle start screen first - it has priority over game controls
        if (typeof startScreenManager !== 'undefined' && startScreenManager.isVisible()) {
            // Check for cheat sequence first, even in start screen
            if (typeof cheatSystem !== 'undefined') {
                cheatSystem.detectCheatSequence(event.key);
            }
            
            if (startScreenManager.handleKeyDown(event)) {
                return; // Start screen consumed the key
            }
        } else {
            // Handle cheat sequence detection when start screen is not visible
            if (typeof cheatSystem !== 'undefined') {
                cheatSystem.detectCheatSequence(event.key);
            }
        }

        // Any other menu / archive / station overlay owns input (not ship)
        if (typeof menuNavHelper !== 'undefined' && menuNavHelper.isAnyOverlayOpen()) {
            if (typeof startScreenManager === 'undefined' || !startScreenManager.isVisible()) {
                const tag = event.target && event.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                    return;
                }
                // Overlays register their own keydown listeners; do not fall through to pause/ship
                if (menuNavHelper.isArrowKey(event.key) || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                }
                return;
            }
        }
        
        // Handle combined selection
        if (typeof combinedSelectionManager !== 'undefined' && combinedSelectionManager.isVisible) {
            // Combined selection handles its own keyboard input
            return; // Combined selection consumed the key
        }
        
        // Handle player selection
        if (typeof playerSelectionManager !== 'undefined' && playerSelectionManager.isVisible) {
            // Player selection handles its own keyboard input
            return; // Player selection consumed the key
        }
        
        // Handle planet selection
        if (typeof planetSelectionManager !== 'undefined' && planetSelectionManager.isVisible) {
            planetSelectionManager.handleKeyDown(event);
            return; // Planet selection consumed the key
        }
        
        // Handle game over screen
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) {
            if (typeof uiManager !== 'undefined') {
                uiManager.handleGameOverInput(event);
            }
            return; // Game over consumed the key
        }
        
        // Handle victory screen
        const victoryOverlay = document.getElementById('victoryOverlay');
        if (victoryOverlay && !victoryOverlay.classList.contains('hidden')) {
            if (typeof uiManager !== 'undefined') {
                uiManager.handleVictoryInput(event);
            }
            return; // Victory screen consumed the key
        }
        
        // Handle ESC key for pause/unpause and settings close
        if (event.key === 'Escape') {
            event.preventDefault();
            
            // Check if settings overlay is visible
            const settingsOverlay = document.getElementById('settingsOverlay');
            if (settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
                // Close settings and return to pause menu
                if (typeof settingsManager !== 'undefined') {
                    settingsManager.hideSettings();
                }
                return;
            }
            
            // Otherwise toggle pause/unpause
            this.togglePause();
            return;
        }
        
        // Handle pause menu navigation
        if (this.gameState.isPaused) {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (typeof uiManager !== 'undefined') {
                    uiManager.pauseMenuIndex = (uiManager.pauseMenuIndex - 1 + uiManager.pauseMenuItems.length) % uiManager.pauseMenuItems.length;
                    uiManager.updatePauseMenuDisplay();
                }
                return;
            }
            
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (typeof uiManager !== 'undefined') {
                    uiManager.pauseMenuIndex = (uiManager.pauseMenuIndex + 1) % uiManager.pauseMenuItems.length;
                    uiManager.updatePauseMenuDisplay();
                }
                return;
            }
            
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (typeof uiManager !== 'undefined') {
                    uiManager.selectPauseMenuItem();
                }
                return;
            }
        }
        
        // Don't handle other keys if paused
        if (this.gameState.isPaused) {
            return;
        }

        // Mission intro: SPACE = FIRE TO START (no combat yet)
        if (typeof missionStartManager !== 'undefined' && missionStartManager.isActive()) {
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                if (missionStartManager.isAwaitingFire()) {
                    missionStartManager.onFire();
                }
            }
            return;
        }
        
        // Shoot on spacebar (mode-dependent)
        if (event.key === ' ') {
            event.preventDefault();
            if (typeof bulletManager !== 'undefined' && typeof playerManager !== 'undefined') {
                const mode = bulletManager.getFireMode ? bulletManager.getFireMode() : 'auto';
                if (mode === 'charge') {
                    if (!bulletManager.isCharging) {
                        bulletManager.beginCharge();
                    }
                } else {
                    bulletManager.shoot(playerManager.getPosition());
                    
                    // Fast fire cheat - shoot multiple bullets
                    if (typeof cheatSystem !== 'undefined' && cheatSystem.cheats && cheatSystem.cheats.fastFire) {
                        this.clearFastFireTimeouts();
                        this.activeTimeouts.push(
                            setTimeout(() => bulletManager.shoot(playerManager.getPosition()), 50)
                        );
                        this.activeTimeouts.push(
                            setTimeout(() => bulletManager.shoot(playerManager.getPosition()), 100)
                        );
                    }
                }
            }
        }

        // Drive charge begin on Shift
        if (event.key === 'Shift' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            this.keys['Shift'] = true;
            this.keys['ShiftLeft'] = true;
            this.keys['ShiftRight'] = true;
            if (typeof chargeSystem !== 'undefined' && chargeSystem.hasDriveCharge()
                && !chargeSystem.isDriveCharging()) {
                chargeSystem.beginDriveCharge();
            }
        }
        
        // Switch shot type with Q and E
        if (event.key === 'q' || event.key === 'Q') {
            if (typeof bulletManager !== 'undefined') {
                const newType = bulletManager.switchShotType();
                if (typeof uiManager !== 'undefined') {
                    uiManager.updateShotTypeDisplay(newType);
                }
            }
        }
        if (event.key === 'e' || event.key === 'E') {
            if (typeof bulletManager !== 'undefined') {
                const newType = bulletManager.switchShotType();
                if (typeof uiManager !== 'undefined') {
                    uiManager.updateShotTypeDisplay(newType);
                }
            }
        }
        
        // Kill enemy cheat with K
        if (event.key === 'k' || event.key === 'K') {
            if (typeof enemyManager !== 'undefined') {
                enemyManager.killEnemy();
            }
        }
        
        // S key cheat - cycle ship types
        if (event.key === 's' || event.key === 'S') {
            if (typeof cheatSystem !== 'undefined' && cheatSystem.cheats && cheatSystem.cheats.shipSelect) {
                this.cycleEnemyShipType();
            }
        }
        
        // Display scale is locked to full-map fit during missions (+/- disabled in-game)
        if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_') {
            const ingame = typeof menuStateManager !== 'undefined'
                && menuStateManager.getScreen
                && menuStateManager.getScreen() === 'ingame';
            if (ingame) {
                event.preventDefault();
                return;
            }
            event.preventDefault();
            if (typeof renderManager === 'undefined') return;
            if (event.key === '+' || event.key === '=') renderManager.increaseScale();
            else renderManager.decreaseScale();
        }
    }
}
