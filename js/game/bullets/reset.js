"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
    reset() {
        if (this.releaseBullet) {
            for (let i = 0; i < this.bullets.length; i++) this.releaseBullet(this.bullets[i]);
            for (let i = 0; i < this.enemyBullets.length; i++) this.releaseBullet(this.enemyBullets[i]);
        }
        this.bullets.length = 0;
        this.enemyBullets.length = 0;
        this.shotType = 0;
        this.tempWeapon = null;
        this.resetCharge();
        // Reset weapon display
        this.updateWeaponDisplay();
    },
});
