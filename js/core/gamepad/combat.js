"use strict";

// GamepadManager combat mapping: writes into the same inputHandler.keys map
// the keyboard sets (js/core/input-handler/core.js), so playerManager /
// bulletManager need zero changes. Buttons: A=shoot/charge, B/X/Y=fire
// groups a/s/d, RB=boost (Shift), LB=switch shot type, Start=pause.
// K/S debug cheats are intentionally never mapped to a gamepad.
extendClass(GamepadManager, {
    updateCombat(gamepad) {
        const g = window.game;
        const inputHandler = g && g.inputHandler;
        if (!inputHandler) return;
        this._combatState.any = true;

        const dir = this.direction(gamepad);
        inputHandler.keys['ArrowUp'] = dir.up;
        inputHandler.keys['ArrowDown'] = dir.down;
        inputHandler.keys['ArrowLeft'] = dir.left;
        inputHandler.keys['ArrowRight'] = dir.right;

        const spaceHeld = this.isButtonPressed(gamepad, 0); // A
        const wasSpaceHeld = !!this._combatState.space;
        inputHandler.keys[' '] = spaceHeld;
        inputHandler.keys['Space'] = spaceHeld;
        if (spaceHeld && !wasSpaceHeld) this.onSpacePress();
        if (!spaceHeld && wasSpaceHeld) this.onSpaceRelease();
        this._combatState.space = spaceHeld;

        const shiftHeld = this.isButtonPressed(gamepad, 5); // RB
        inputHandler.keys['Shift'] = shiftHeld;
        inputHandler.keys['ShiftLeft'] = shiftHeld;
        inputHandler.keys['ShiftRight'] = shiftHeld;

        inputHandler.keys['a'] = this.isButtonPressed(gamepad, 2); // X -> fire group a
        inputHandler.keys['s'] = this.isButtonPressed(gamepad, 3); // Y -> fire group s
        inputHandler.keys['d'] = this.isButtonPressed(gamepad, 1); // B -> fire group d

        const switchHeld = this.isButtonPressed(gamepad, 4); // LB
        if (switchHeld && !this._combatState.switchShot) {
            if (typeof bulletManager !== 'undefined') {
                const newType = bulletManager.switchShotType();
                if (typeof uiManager !== 'undefined') uiManager.updateShotTypeDisplay(newType);
            }
        }
        this._combatState.switchShot = switchHeld;

        const startHeld = this.isButtonPressed(gamepad, 9); // Start
        if (startHeld && !this._combatState.start) inputHandler.togglePause();
        this._combatState.start = startHeld;
    },

    onSpacePress() {
        if (typeof bulletManager === 'undefined' || typeof playerManager === 'undefined') return;
        const mode = bulletManager.getFireMode ? bulletManager.getFireMode() : 'auto';
        if (mode === 'charge' && !bulletManager.isCharging) {
            bulletManager.beginCharge();
        }
    },

    onSpaceRelease() {
        if (typeof bulletManager === 'undefined' || typeof playerManager === 'undefined') return;
        const mode = bulletManager.getFireMode ? bulletManager.getFireMode() : 'auto';
        if (mode === 'charge' && bulletManager.isCharging) {
            bulletManager.releaseChargeShot(playerManager.getPosition());
        }
    }
});
