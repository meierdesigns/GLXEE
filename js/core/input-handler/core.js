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
        // FIRE TO START: mouse / pointer click (overlay is pointer-events: none)
        document.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            if (typeof missionStartManager === 'undefined' || !missionStartManager.isAwaitingFire()) return;
            if (this.missionStartInputBlockedByOverlay()) return;
            const root = document.querySelector('.game-container');
            if (!root || !e.target || root.contains(e.target)) {
                missionStartManager.onFire();
            }
        });
    }

    /** Menus block mission-start except while the combat "FIRE TO START" prompt is up. */
    missionStartInputBlockedByOverlay() {
        if (typeof missionStartManager !== 'undefined' && missionStartManager.isAwaitingFire()) {
            return false;
        }
        return typeof menuNavHelper !== 'undefined' && menuNavHelper.isAnyOverlayOpen();
    }

    isMissionStartFireKey(event) {
        if (!event || !event.key) return false;
        const key = event.key;
        if (key === ' ' || key === 'Enter') return true;
        return key === 'a' || key === 'A' || key === 's' || key === 'S' || key === 'd' || key === 'D';
    }

    /** Victory loot scoop or win / lose overlay: combat is over, no firing. */
    isCombatEnded() {
        const gc = (typeof game !== 'undefined' && game.gameControl)
            ? game.gameControl
            : ((typeof gameCore !== 'undefined' && gameCore.gameControl) ? gameCore.gameControl : null);
        if (gc && gc._victoryLootPhase) return true;
        return ['gameOver', 'victoryOverlay'].some((id) => {
            const el = document.getElementById(id);
            return !!(el && !el.classList.contains('hidden'));
        });
    }

    handleKeyDown(event) {
        // Space still held from combat: end screens wait for its release.
        const spaceHeld = !!(this.keys[' '] || this.keys['Space']);
        const missionIntro = typeof missionStartManager !== 'undefined' && missionStartManager.isActive();
        const blockShip = missionIntro
            || (typeof menuNavHelper !== 'undefined' && menuNavHelper.shouldBlockShipControls());
        const moveKey = typeof menuNavHelper !== 'undefined' && menuNavHelper.isMoveKey(event.key);
        if (!(blockShip && moveKey)) {
            this.keys[event.key] = true;
        } else {
            // Clear sticky movement while menus / mission intro own the arrows
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

        // The profile overlay has its own key handler; menus underneath
        // (start screen / embedded main menu) must not react as well.
        if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.isVisible) {
            // Shift+C (dev mode) still works here: the start screen and the global
            // toggle in hud-layout-editor.js both skip it while this overlay is up.
            const tag = event.target && event.target.tagName;
            if (event.shiftKey && (event.key === 'c' || event.key === 'C') &&
                tag !== 'INPUT' && tag !== 'TEXTAREA' && typeof startScreenManager !== 'undefined') {
                if (event.repeat) return;
                event.preventDefault();
                startScreenManager.toggleDevMode();
            }
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

        // DevMode Shift+C during combat / anywhere the start screen / station /
        // onboarding aren't owning the shortcut. The HUD layout editor also
        // binds this, but that lives in the lazy editors bundle — without this
        // boot-path handler the shortcut is dead until DevMode was already on.
        if (event.shiftKey && (event.key === 'c' || event.key === 'C') && !event.repeat) {
            const tag = event.target && event.target.tagName;
            const stationOwns = typeof homeStationUI !== 'undefined' && homeStationUI.isVisible;
            const onboardOwns = typeof onboardingManager !== 'undefined' && onboardingManager.isVisible;
            const startOwns = typeof startScreenManager !== 'undefined' && startScreenManager.isVisible();
            if (tag !== 'INPUT' && tag !== 'TEXTAREA'
                && !startOwns && !stationOwns && !onboardOwns
                && typeof startScreenManager !== 'undefined') {
                event.preventDefault();
                startScreenManager.toggleDevMode();
                return;
            }
        }

        // Victory and game-over screens must receive the initial key directly.
        // The generic overlay guard below would otherwise consume it first.
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) {
            if (spaceHeld) { event.preventDefault(); return; }
            if (typeof uiManager !== 'undefined') uiManager.handleGameOverInput(event);
            return;
        }

        const victoryOverlay = document.getElementById('victoryOverlay');
        if (victoryOverlay && !victoryOverlay.classList.contains('hidden')) {
            if (spaceHeld) { event.preventDefault(); return; }
            if (typeof uiManager !== 'undefined') uiManager.handleVictoryInput(event);
            return;
        }

        // Generic modal navigation: every modal exposing data-nav-item can be
        // navigated without requiring a mouse click first.
        const modal = (event.target && event.target.closest
            ? event.target.closest('.gm-ambush, [role="dialog"], .modal, .hs-res-buy-modal')
            : null) || document.querySelector(
                '.gm-ambush, [role="dialog"]:not(.hidden), .modal:not(.hidden), .hs-res-buy-modal'
            );
        if (modal && !modal.classList.contains('hidden')) {
            const items = Array.from(modal.querySelectorAll(
                '[data-nav-item]:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter((el, i, list) => list.indexOf(el) === i);
            if (items.length && (event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                || event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                event.preventDefault();
                const current = document.activeElement;
                let index = items.indexOf(current);
                if (index < 0) index = 0;
                const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
                const step = (event.key === 'ArrowLeft' || event.key === 'ArrowUp') ? -1 : 1;
                const next = horizontal || items.length < 3
                    ? (index + step + items.length) % items.length
                    : Math.max(0, Math.min(items.length - 1, index + step));
                items[next].focus();
                return;
            }
        }

        // Mission intro must run before generic overlay / pause guards (held Space from
        // stage select, or a stale isAnyOverlayOpen flag, otherwise FIRE TO START ignores input).
        if (typeof missionStartManager !== 'undefined' && missionStartManager.isActive()) {
            if (this.isMissionStartFireKey(event)) {
                event.preventDefault();
                if (missionStartManager.isAwaitingFire()) {
                    missionStartManager.onFire();
                }
            }
            return;
        }

        // Any other menu / archive / station overlay owns input (not ship)
        if (typeof menuNavHelper !== 'undefined' && menuNavHelper.isAnyOverlayOpen()) {
            // planetSelectionManager has no document-level listener of its own
            // (unlike most other overlays) - it relies on handleKeyDown below,
            // so it must fall through here instead of being swallowed.
            const planetSelectionOwnsInput = typeof planetSelectionManager !== 'undefined' && planetSelectionManager.isVisible;
            if (!planetSelectionOwnsInput && (typeof startScreenManager === 'undefined' || !startScreenManager.isVisible())) {
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

        // Shoot on spacebar (mode-dependent)
        if (event.key === ' ' && this.isCombatEnded()) {
            event.preventDefault();
        } else if (event.key === ' ') {
            event.preventDefault();
            if (typeof bulletManager !== 'undefined' && typeof playerManager !== 'undefined') {
                const mode = bulletManager.getFireMode ? bulletManager.getFireMode() : 'auto';
                if (mode === 'charge') {
                    if (!bulletManager.isCharging) {
                        bulletManager.beginCharge();
                    }
                } else {
                    // Space fires only its own slots unless it is the ALL key.
                    const spaceOpts = () => ({ fireKey: bulletManager.fireGroupFor ? bulletManager.fireGroupFor('space') : 'space' });
                    bulletManager.shoot(playerManager.getPosition(), spaceOpts());

                    // Fast fire cheat - shoot multiple bullets
                    if (typeof cheatSystem !== 'undefined' && cheatSystem.cheats && cheatSystem.cheats.fastFire) {
                        this.clearFastFireTimeouts();
                        this.activeTimeouts.push(
                            setTimeout(() => bulletManager.shoot(playerManager.getPosition(), spaceOpts()), 50)
                        );
                        this.activeTimeouts.push(
                            setTimeout(() => bulletManager.shoot(playerManager.getPosition(), spaceOpts()), 100)
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

        // Switch shot type with Q and E (DevMode: cycle all weapons into every slot)
        if (event.key === 'q' || event.key === 'Q' || event.key === 'e' || event.key === 'E') {
            if (typeof bulletManager !== 'undefined') {
                const dir = (event.key === 'q' || event.key === 'Q') ? -1 : 1;
                const devOn = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
                const newType = (devOn && bulletManager.devCycleWeaponCheat)
                    ? bulletManager.devCycleWeaponCheat(dir)
                    : bulletManager.switchShotType(dir);
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
