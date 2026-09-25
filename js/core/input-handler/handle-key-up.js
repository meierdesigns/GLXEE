"use strict";

// InputHandler methods, split from input-handler.js.
extendClass(InputHandler, {
    handleKeyUp(event) {
        this.keys[event.key] = false;

        if (event.key === ' ') {
            if (typeof bulletManager !== 'undefined' && typeof playerManager !== 'undefined') {
                const mode = bulletManager.getFireMode ? bulletManager.getFireMode() : 'auto';
                if (mode === 'charge' && bulletManager.isCharging) {
                    bulletManager.releaseChargeShot(playerManager.getPosition());
                }
            }
        }

        if (event.key === 'Shift' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            this.keys['Shift'] = false;
            this.keys['ShiftLeft'] = false;
            this.keys['ShiftRight'] = false;
            if (typeof chargeSystem !== 'undefined' && chargeSystem.isDriveCharging()) {
                chargeSystem.releaseDriveCharge();
            }
        }
    },

    togglePause() {
        if (!this.gameState.gameRunning) {
            return;
        }

        if (this.gameState.isPaused) {
            if (typeof game !== 'undefined') {
                game.resumeGame();
            } else {
                this.gameState.resumeGame();
            }
        } else {
            if (typeof game !== 'undefined') {
                game.pauseGame();
            } else {
                this.gameState.pauseGame();
            }
        }
    },

    cycleEnemyShipType() {
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.cycleEnemyShipType();
        }
    },

    clearFastFireTimeouts() {
        this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
        this.activeTimeouts = [];
    },
});
