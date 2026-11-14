"use strict";

// GamepadManager combat mapping: writes into the same inputHandler.keys map
// the keyboard sets (js/core/input-handler/core.js), so playerManager /
// bulletManager need zero changes.
// Shoulders: LB=a, RB=s, LT=d, RT=space (face A also space for fire-to-start).
// Face X/Y/B still alias a/s/d. L3=boost (Shift), R3=switch shot, Start=pause.
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

        // RT (front right) + face A → Space
        const spaceHeld = this.isButtonPressed(gamepad, 7) || this.isButtonPressed(gamepad, 0);
        const wasSpaceHeld = !!this._combatState.space;
        inputHandler.keys[' '] = spaceHeld;
        inputHandler.keys['Space'] = spaceHeld;
        if (spaceHeld && !wasSpaceHeld) this.onSpacePress();
        if (!spaceHeld && wasSpaceHeld) this.onSpaceRelease();
        this._combatState.space = spaceHeld;

        // L3 → Charge Drive boost (was RB before shoulders took fire)
        const shiftHeld = this.isButtonPressed(gamepad, 10);
        inputHandler.keys['Shift'] = shiftHeld;
        inputHandler.keys['ShiftLeft'] = shiftHeld;
        inputHandler.keys['ShiftRight'] = shiftHeld;

        // LB / RB (rear) + face X/Y; LT (front left) + face B
        inputHandler.keys['a'] = this.isButtonPressed(gamepad, 4) || this.isButtonPressed(gamepad, 2);
        inputHandler.keys['s'] = this.isButtonPressed(gamepad, 5) || this.isButtonPressed(gamepad, 3);
        inputHandler.keys['d'] = this.isButtonPressed(gamepad, 6) || this.isButtonPressed(gamepad, 1);

        // R3 → switch shot type (was LB); DevMode fills all slots like keyboard E
        const switchHeld = this.isButtonPressed(gamepad, 11);
        if (switchHeld && !this._combatState.switchShot) {
            if (typeof bulletManager !== 'undefined') {
                const devOn = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
                const newType = (devOn && bulletManager.devCycleWeaponCheat)
                    ? bulletManager.devCycleWeaponCheat(1)
                    : bulletManager.switchShotType(1);
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
