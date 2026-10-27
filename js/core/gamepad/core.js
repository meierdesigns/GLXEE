"use strict";

// Gamepad support: polls the Gamepad API every frame and feeds the same
// input paths the keyboard already drives (inputHandler.keys in combat,
// synthetic keydown/keyup events everywhere a screen already listens for
// Arrow/Enter/Escape). See js/core/gamepad/combat.js and
// js/core/gamepad/menu-nav.js for the two modes.
class GamepadManager {
    constructor() {
        this.deadzone = 0.35;
        this._running = false;
        this._combatState = {};
        this._menuState = {
            up: { active: false },
            down: { active: false },
            left: { active: false },
            right: { active: false },
            a: false,
            b: false
        };
    }

    start() {
        if (this._running) return;
        this._running = true;
        const tick = () => {
            this.poll();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    isButtonPressed(gamepad, index) {
        const b = gamepad.buttons[index];
        if (!b) return false;
        return typeof b === 'number' ? b > 0.5 : !!b.pressed;
    }

    /** Analog stick OR d-pad button, whichever reads "pressed" for that direction. */
    direction(gamepad) {
        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;
        return {
            left: this.isButtonPressed(gamepad, 14) || axisX < -this.deadzone,
            right: this.isButtonPressed(gamepad, 15) || axisX > this.deadzone,
            up: this.isButtonPressed(gamepad, 12) || axisY < -this.deadzone,
            down: this.isButtonPressed(gamepad, 13) || axisY > this.deadzone
        };
    }

    /** Combat only while the fight screen owns the frame and isn't paused. */
    isCombatMode() {
        const g = (typeof window !== 'undefined') ? window.game : null;
        if (!g || !g.gameLoop || !g.gameState) return false;
        if (g.gameState.isPaused) return false;
        // Victory/game-over sit on top of the combat surface without
        // hiding it, so isCombatSurfaceActive() stays true there too;
        // route those to menu-style arrow/enter navigation instead.
        if (typeof document !== 'undefined') {
            const victoryOverlay = document.getElementById('victoryOverlay');
            if (victoryOverlay && !victoryOverlay.classList.contains('hidden')) return false;
            const gameOverOverlay = document.getElementById('gameOver');
            if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) return false;
        }
        try {
            return g.gameLoop.isCombatSurfaceActive();
        } catch (e) {
            return false;
        }
    }

    poll() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
        const pads = navigator.getGamepads();
        let gamepad = null;
        for (let i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].connected) { gamepad = pads[i]; break; }
        }
        if (!gamepad) {
            this.resetCombatKeys();
            return;
        }
        // "FIRE TO START" lives inside the combat surface (isCombatMode()
        // is already true there) but wants a discrete confirm press like a
        // menu, not held-key combat state, so it's special-cased here.
        if (typeof missionStartManager !== 'undefined' && missionStartManager.isAwaitingFire()) {
            const fireHeld = this.isButtonPressed(gamepad, 0); // A, same button combat uses for shoot
            if (fireHeld && !this._menuState.a) missionStartManager.onFire();
            this._menuState.a = fireHeld;
            return;
        }
        if (this.isCombatMode()) {
            this.updateCombat(gamepad);
        } else {
            const wasCombat = !!this._combatState.any;
            this.resetCombatKeys();
            if (wasCombat) {
                // A may still be physically held from firing in combat; sync
                // the menu edge-tracker so this frame isn't read as a fresh
                // press (which would instantly confirm the first menu item,
                // e.g. auto-restarting on the game-over screen).
                this._menuState.a = this.isButtonPressed(gamepad, 0);
            }
            this.updateMenu(gamepad);
        }
    }

    /** Release every key the combat adapter may have set, so an unplugged
     * controller (or leaving combat) never leaves the ship stuck moving/firing. */
    resetCombatKeys() {
        const g = (typeof window !== 'undefined') ? window.game : null;
        const inputHandler = g && g.inputHandler;
        if (!inputHandler || !this._combatState.any) return;
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ',
            'Shift', 'ShiftLeft', 'ShiftRight', 'a', 's', 'd'].forEach((k) => {
            inputHandler.keys[k] = false;
        });
        this._combatState = {};
    }
}

const gamepadManager = new GamepadManager();
if (typeof window !== 'undefined') {
    window.gamepadManager = gamepadManager;
    gamepadManager.start();
}
