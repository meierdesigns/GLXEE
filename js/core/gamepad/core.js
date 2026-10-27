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
        if (this.isCombatMode()) {
            this.updateCombat(gamepad);
        } else {
            this.resetCombatKeys();
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
