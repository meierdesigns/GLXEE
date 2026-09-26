"use strict";

// Bullet management
class BulletManager {
    constructor() {
        this.bullets = [];
        this.enemyBullets = [];
        this.shotType = 0;
        this.shotTypes = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getIds()
            : ['laser', 'spread', 'rapid', 'plasma', 'missile', 'ion', 'wave', 'burst', 'pierce', 'nova'];
        this.currentShipModel = null;
        this.currentWeapon = 'laser';
        this.weaponCooldowns = {};
        this.lastShotTime = 0;
        this.maxEnemyBullets = 3; // Maximum enemy bullets on screen
        this.lastEnemyShotTime = 0;
        this.enemyShotCooldown = 800; // Minimum time between enemy shots (ms)
        this.fireMode = 'auto'; // 'auto' | 'charge'
        this.chargeLevel = 0; // 0..1 while holding space in charge mode
        this.isCharging = false;
        this.chargeStartTime = 0;
        this.maxChargeMs = 900;
        this.minChargeMult = 1;
        this.maxChargeMult = 2.75;
        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.syncFromShipModel(null);
        }
    }

    getFireMode() {
        if (typeof chargeSystem !== 'undefined') {
            return chargeSystem.getFireMode();
        }
        if (this.currentShipModel && this.currentShipModel.fireMode) {
            return this.currentShipModel.fireMode === 'charge' ? 'charge' : 'auto';
        }
        return this.fireMode === 'charge' ? 'charge' : 'auto';
    }

    setFireMode(mode) {
        this.fireMode = (mode === 'charge') ? 'charge' : 'auto';
        if (this.currentShipModel) {
            this.currentShipModel.fireMode = this.fireMode;
        }
        this.resetCharge();
    }

    resetCharge() {
        this.chargeLevel = 0;
        this.isCharging = false;
        this.chargeStartTime = 0;
        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.resetWeaponCharge();
        }
    }

    beginCharge() {
        if (typeof playerManager !== 'undefined' && playerManager.isSystemsOnline
            && !playerManager.isSystemsOnline()) {
            return false;
        }
        if (typeof chargeSystem !== 'undefined') {
            if (!chargeSystem.beginWeaponCharge()) return false;
            this.isCharging = true;
            this.chargeStartTime = Date.now();
            this.chargeLevel = 0;
            return true;
        }
        this.isCharging = true;
        this.chargeStartTime = Date.now();
        this.chargeLevel = 0;
        return true;
    }

    updateCharge() {
        if (typeof chargeSystem !== 'undefined') {
            this.chargeLevel = chargeSystem.updateWeaponCharge();
            this.isCharging = chargeSystem.isWeaponCharging();
            return this.chargeLevel;
        }
        if (!this.isCharging) return 0;
        const elapsed = Date.now() - this.chargeStartTime;
        this.chargeLevel = Math.min(1, elapsed / this.maxChargeMs);
        return this.chargeLevel;
    }

    getChargeMultiplier() {
        if (typeof chargeSystem !== 'undefined' && chargeSystem.isWeaponCharging()) {
            return chargeSystem.getShotChargeMult();
        }
        const t = this.chargeLevel;
        return this.minChargeMult + (this.maxChargeMult - this.minChargeMult) * t;
    }

    releaseChargeShot(playerPosition) {
        if (typeof chargeSystem !== 'undefined') {
            if (!chargeSystem.isWeaponCharging()) return false;
            const mult = chargeSystem.releaseWeaponCharge();
            this.resetCharge();
            return this.shoot(playerPosition, { chargeMult: mult });
        }
        if (!this.isCharging) return false;
        this.updateCharge();
        const mult = this.getChargeMultiplier();
        this.resetCharge();
        return this.shoot(playerPosition, { chargeMult: mult });
    }

    update(deltaTime = 16.67, keys = null) { // Default to ~60 FPS if no deltaTime provided
        // Calculate frame-rate independent speed multiplier
        const speedMultiplier = deltaTime / 16.67; // 16.67ms = 60 FPS baseline

        // Autofire / charge while space held
        if (keys && typeof playerManager !== 'undefined') {
            const spaceHeld = !!(keys[' '] || keys['Space']);
            const mode = this.getFireMode();
            if (mode === 'auto' && spaceHeld) {
                this.shoot(playerManager.getPosition());
            } else if (mode === 'charge' && spaceHeld && this.isCharging) {
                this.updateCharge();
                const chargeDrain = playerManager.getChargeEnergyPerSec
                    ? playerManager.getChargeEnergyPerSec()
                    : 12;
                if (chargeDrain > 0) {
                    const cost = chargeDrain * (deltaTime / 1000);
                    if (!playerManager.spendEnergy(cost)) {
                        // Out of power — release weak shot or cancel
                        if (this.chargeLevel > 0.05) {
                            this.releaseChargeShot(playerManager.getPosition());
                        } else {
                            this.resetCharge();
                        }
                    }
                }
                this.updateChargeHud();
            }
        }

        // Update player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

        // Handle angled bullets (spread shot) and wave sway
            if (bullet.type === 'wave_beam' && bullet.waveAmp) {
                bullet.wavePhase = (bullet.wavePhase || 0) + 0.25 * speedMultiplier;
                bullet.x += Math.sin(bullet.wavePhase) * bullet.waveAmp * speedMultiplier;
                bullet.y -= bullet.speed * speedMultiplier;
            } else if (bullet.angle !== undefined) {
                bullet.x += Math.sin(bullet.angle) * bullet.speed * speedMultiplier;
                bullet.y -= Math.cos(bullet.angle) * bullet.speed * speedMultiplier;
            } else {
                bullet.y -= bullet.speed * speedMultiplier;
            }

            // Remove bullets that are off screen
            // Get canvas width from game if available
            const canvasWidth = (typeof game !== 'undefined' && game.internalWidth) ? game.internalWidth : 200;
            if (bullet.y < 0 || bullet.x < 0 || bullet.x > canvasWidth) {
                this.bullets.splice(i, 1);
            }
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];

            // Handle angled enemy bullets (after reflection)
            if (bullet.angle !== undefined) {
                bullet.x += Math.sin(bullet.angle) * bullet.speed * speedMultiplier;
                bullet.y += Math.cos(bullet.angle) * bullet.speed * speedMultiplier;
            } else {
                bullet.y += bullet.speed * speedMultiplier;
            }

            // Remove bullets that are off screen
            // Get canvas dimensions from game if available
            const canvasWidth = (typeof game !== 'undefined' && game.internalWidth) ? game.internalWidth : 200;
            const canvasHeight = (typeof game !== 'undefined' && game.internalHeight) ? game.internalHeight : 300;
            if (bullet.y > canvasHeight || bullet.x < 0 || bullet.x > canvasWidth) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    setShipModel(shipModel) {
        this.currentShipModel = shipModel;
        if (shipModel && shipModel.defaultWeapon) {
            this.currentWeapon = shipModel.defaultWeapon;
        }
        // Per-slot cooldowns (keyed by mount, not weapon id — two equipped
        // weapons of the same type still fire on independent clocks).
        this.weaponCooldowns = {};
        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.syncFromShipModel(shipModel);
            this.fireMode = chargeSystem.getFireMode();
            if (shipModel) shipModel.fireMode = this.fireMode;
            this.maxChargeMs = chargeSystem.stats.maxChargeMs;
            this.maxChargeMult = chargeSystem.stats.maxChargeMult;
            this.minChargeMult = chargeSystem.stats.minChargeMult;
        } else if (shipModel && shipModel.fireMode) {
            this.fireMode = shipModel.fireMode === 'charge' ? 'charge' : 'auto';
        } else if (typeof shipLoadoutManager !== 'undefined' && shipModel && shipModel.id) {
            this.fireMode = shipLoadoutManager.getFireMode(shipModel.id);
        }
        this.resetCharge();
        // Update weapon display
        this.updateWeaponDisplay();
    }

    /**
     * Every equipped weapon module's fire origin, in playerPosition's
     * screen space — one entry per physical mount, so two of the same
     * weapon type in different slots still fire from their own spot.
     * Falls back to the ship's bounding-box center when there's no
     * modular layout (legacy/non-modular ship models).
     */
    getWeaponFirePositions(playerPosition) {
        const model = this.currentShipModel;
        const layout = model && model.layout;
        const weaponModules = layout && Array.isArray(layout.modules)
            ? layout.modules.filter((m) => m && m.kind === 'weapon')
            : [];
        if (!weaponModules.length) {
            return [{ id: this.currentWeapon, key: this.currentWeapon, position: playerPosition }];
        }
        const lw = Math.max(1, layout.width || playerPosition.width);
        const lh = Math.max(1, layout.height || playerPosition.height);
        const scaleX = playerPosition.width / lw;
        const scaleY = playerPosition.height / lh;
        return weaponModules.map((m) => ({
            id: m.id,
            mount: m.mountSegment === 'wing' ? 'wing' : 'front',
            key: String(m.id || '') + '@' + String(m.face || 'up'),
            position: {
                x: playerPosition.x + m.x * scaleX,
                y: playerPosition.y + m.y * scaleY,
                width: Math.max(1, (m.width || 0) * scaleX),
                height: Math.max(1, (m.height || 0) * scaleY)
            }
        }));
    }

    switchWeapon() {
        if (!this.currentShipModel || !this.currentShipModel.availableWeapons) {
            // Fallback to old system
            this.shotType = (this.shotType + 1) % this.shotTypes.length;
            this.updateWeaponDisplay();
            const fallback = this.shotTypes[this.shotType];
            return fallback;
        }

        const currentIndex = this.currentShipModel.availableWeapons.indexOf(this.currentWeapon);
        const nextIndex = (currentIndex + 1) % this.currentShipModel.availableWeapons.length;
        this.currentWeapon = this.currentShipModel.availableWeapons[nextIndex];
        this.updateWeaponDisplay();
        return this.currentWeapon;
    }
}
