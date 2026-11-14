"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
    reset() {
        // Detach from live lists first — releaseBullet refuses shells that are
        // still indexed on bullets/enemyBullets (dual-membership guard).
        const playerShots = this.bullets.splice(0, this.bullets.length);
        const enemyShots = this.enemyBullets.splice(0, this.enemyBullets.length);
        if (this.releaseBullet) {
            for (let i = 0; i < playerShots.length; i++) this.releaseBullet(playerShots[i]);
            for (let i = 0; i < enemyShots.length; i++) this.releaseBullet(enemyShots[i]);
        }
        this.shotType = 0;
        this.tempWeapon = null;
        this._devWeaponCheatId = null;
        this.resetCharge();
        // Reset weapon display
        this.updateWeaponDisplay();
    },
});
