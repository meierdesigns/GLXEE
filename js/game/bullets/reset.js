"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
    reset() {
        this.bullets.length = 0;
        this.enemyBullets.length = 0;
        this.shotType = 0;
        this.resetCharge();
        // Reset weapon display
        this.updateWeaponDisplay();
    },
});
