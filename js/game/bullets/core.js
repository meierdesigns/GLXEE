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

    /** 'all' when this key is the ship's fire-all key, else the key itself. */
    fireGroupFor(key) {
        const L = this.currentShipModel && this.currentShipModel.loadout;
        const allKey = (L && L.allFireKey) || 'space';
        return key === allKey ? 'all' : key;
    }

    releaseChargeShot(playerPosition) {
        if (typeof chargeSystem !== 'undefined') {
            if (!chargeSystem.isWeaponCharging()) return false;
            const mult = chargeSystem.releaseWeaponCharge();
            this.resetCharge();
            return this.shoot(playerPosition, { chargeMult: mult, fireKey: this.fireGroupFor('space') });
        }
        if (!this.isCharging) return false;
        this.updateCharge();
        const mult = this.getChargeMultiplier();
        this.resetCharge();
        return this.shoot(playerPosition, { chargeMult: mult, fireKey: this.fireGroupFor('space') });
    }

    update(deltaTime = 16.67, keys = null) { // Default to ~60 FPS if no deltaTime provided
        // Calculate frame-rate independent speed multiplier
        const baseSpeedMultiplier = deltaTime / 16.67; // 16.67ms = 60 FPS baseline
        const speedMultiplier = baseSpeedMultiplier;

        // Autofire / charge while space held
        if (keys && typeof playerManager !== 'undefined') {
            const spaceHeld = !!(keys[' '] || keys['Space']);
            const mode = this.getFireMode();
            // A / S / D fire their assigned slots — or every weapon when that
            // key is the ALL key (hangar slot bar).
            ['a', 's', 'd'].forEach((k) => {
                if (keys[k] || keys[k.toUpperCase()]) this.shoot(playerManager.getPosition(), { fireKey: this.fireGroupFor(k) });
            });
            if (mode === 'auto' && spaceHeld) {
                this.shoot(playerManager.getPosition(), { fireKey: this.fireGroupFor('space') });
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

        // Shot speed settings (SIZES overlay), percent of each weapon's own speed.
        const ui = typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSpeedMul ? uiAppearanceManager : null;
        const playerSpeed = ui ? ui.getShotSpeedMul('player') : 1;
        const enemySpeed = ui ? ui.getShotSpeedMul('enemy') : 1;
        const bossSpeed = ui ? ui.getShotSpeedMul('boss') : 1;

        const cv = (typeof window !== 'undefined') ? window.combatVoxels : null;
        const voxelMove = !!(cv && cv.active && cv.active() && cv.stepMove);

        // Update player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            const speedMultiplier = baseSpeedMultiplier * playerSpeed;
            let bdx = 0;
            let bdy = 0;

            // Handle angled bullets (spread shot) and wave sway
            if (bullet.type === 'wave_beam' && bullet.waveAmp) {
                bullet.wavePhase = (bullet.wavePhase || 0) + 0.25 * speedMultiplier;
                bdx = Math.sin(bullet.wavePhase) * bullet.waveAmp * speedMultiplier;
                bdy = -bullet.speed * speedMultiplier;
            } else if (bullet.angle !== undefined) {
                bdx = Math.sin(bullet.angle) * bullet.speed * speedMultiplier;
                bdy = -Math.cos(bullet.angle) * bullet.speed * speedMultiplier;
            } else {
                bdy = -bullet.speed * speedMultiplier;
            }
            if (voxelMove) cv.stepMove(bullet, bdx, bdy);
            else {
                bullet.x += bdx;
                bullet.y += bdy;
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
            const speedMultiplier = baseSpeedMultiplier * (bullet.isBossShot ? bossSpeed : enemySpeed);
            let bdx = 0;
            let bdy = 0;

            // Handle angled enemy bullets (after reflection)
            if (bullet.angle !== undefined) {
                bdx = Math.sin(bullet.angle) * bullet.speed * speedMultiplier;
                bdy = Math.cos(bullet.angle) * bullet.speed * speedMultiplier;
            } else {
                bdy = bullet.speed * speedMultiplier;
            }
            if (voxelMove) cv.stepMove(bullet, bdx, bdy);
            else {
                bullet.x += bdx;
                bullet.y += bdy;
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
        // Same fit as GraphicsManager.renderPlayerShip: one uniform scale,
        // ship centred in the footprint. Separate x / y scales stretched the
        // mounts away from where the guns are drawn.
        const mw = Math.max(1, model.width || lw);
        const mh = Math.max(1, model.height || lh);
        const fit = Math.min(playerPosition.width / mw, playerPosition.height / mh);
        const drawScale = Math.max(0.25, fit);
        const scaleX = drawScale * (mw / lw);
        const scaleY = drawScale * (mh / lh);
        playerPosition = {
            x: playerPosition.x - (mw * drawScale - playerPosition.width) / 2,
            y: playerPosition.y - (mh * drawScale - playerPosition.height) / 2,
            width: playerPosition.width,
            height: playerPosition.height
        };
        const muzzleUp = () => 1.4;
        const fireKeys = (model.loadout && model.loadout.weaponKeys) || {};
        return weaponModules.map((m) => ({
            id: m.id,
            // Trigger of this slot: 'space' (default) or 'a' / 's' / 'd'.
            fireKey: (m.slotIndex != null && fireKeys[String(m.slotIndex)]) || 'space',
            // Split halves (wings, or a nose/core pair) are the weaker mount.
            mount: (m.mountSegment === 'wing' || m.split) ? 'wing' : 'front',
            key: String(m.id || '') + '@' + String(m.face || 'up')
                + (m.slotIndex != null ? '#' + m.slotIndex : '') + (m.side ? ':' + m.side : ''),
            // Muzzle in layout units (top centre of the mount) for the flash.
            // Slot size factor (bigger slot → bigger gun and shots).
            sizeScale: m.slotSizeScale || 1,
            // Slot size class (0 S, 1 M, 2 L) — sets the shot size.
            sizeLevel: (m.slotIndex != null && typeof shipLoadoutManager !== 'undefined'
                && shipLoadoutManager.getSlotSizeLevel && model.id)
                ? shipLoadoutManager.getSlotSizeLevel(model.id, 'weapon', m.slotIndex) : 1,
            muzzle: { lx: m.x + (m.width || 0) / 2, ly: m.y - (m.height || 0) * muzzleUp(m), lw: m.width || 4, lh: m.height || 4, by: m.y + (m.height || 0) },
            position: {
                x: playerPosition.x + m.x * scaleX,
                // Weapon art is drawn taller than its frame, seated on the base
                // (ShipAssetLoader.WEAPON_DRAW_SCALE y − 1 frames above the mount).
                y: playerPosition.y + (m.y - (m.height || 0) * muzzleUp(m)) * scaleY,
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
