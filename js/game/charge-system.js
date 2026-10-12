"use strict";

/**
 * Multi-channel charge runtime: weapon (Space), drive boost (Shift), shield side-effects.
 */
class ChargeSystem {
    constructor() {
        this.stats = this.defaultStats();
        this.weapon = { active: false, level: 0, startTime: 0 };
        this.drive = { active: false, level: 0, startTime: 0 };
        this._divertShieldSaved = null;
    }

    defaultStats() {
        return {
            weaponCharge: false,
            overcharge: false,
            shieldSync: false,
            shieldDivert: false,
            driveCharge: false,
            driveDampen: false,
            maxChargeMs: 900,
            minChargeMult: 1,
            maxChargeMult: 2.75,
            divertShotBonus: 0,
            shieldFillPerSec: 0,
            driveBoostMul: 1.55,
            driveBoostDrainPerSec: 22,
            driveSlowMul: 1,
            driveFullSlowMul: 1,
            driveBurstMul: 1,
            driveBurstMs: 0
        };
    }

    setStats(stats) {
        this.stats = Object.assign(this.defaultStats(), stats || {});
        if (!this.stats.weaponCharge) this.resetWeaponCharge();
        if (!this.stats.driveCharge) this.resetDriveCharge();
    }

    syncFromShipModel(shipModel) {
        if (shipModel && shipModel.chargeStats) {
            this.setStats(shipModel.chargeStats);
            return;
        }
        const ids = (shipModel && Array.isArray(shipModel.abilities)) ? shipModel.abilities : [];
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.computeChargeStats) {
            this.setStats(shipLoadoutManager.computeChargeStats(ids));
        } else {
            this.setStats(this.defaultStats());
        }
    }

    hasWeaponCharge() {
        return !!this.stats.weaponCharge;
    }

    hasDriveCharge() {
        return !!this.stats.driveCharge;
    }

    getFireMode() {
        return this.hasWeaponCharge() ? 'charge' : 'auto';
    }

    resetWeaponCharge() {
        this.weapon.active = false;
        this.weapon.level = 0;
        this.weapon.startTime = 0;
        this._endDivert();
    }

    resetDriveCharge() {
        this.drive.active = false;
        this.drive.level = 0;
        this.drive.startTime = 0;
    }

    beginWeaponCharge() {
        if (!this.hasWeaponCharge()) return false;
        this.weapon.active = true;
        this.weapon.startTime = Date.now();
        this.weapon.level = 0;
        this._beginDivert();
        return true;
    }

    updateWeaponCharge() {
        if (!this.weapon.active) return 0;
        const ms = Math.max(1, this.stats.maxChargeMs || 900);
        const elapsed = Date.now() - this.weapon.startTime;
        this.weapon.level = Math.min(1, elapsed / ms);
        return this.weapon.level;
    }

    getWeaponChargeLevel() {
        return this.weapon.active ? this.weapon.level : 0;
    }

    isWeaponCharging() {
        return !!this.weapon.active;
    }

    getShotChargeMult() {
        const t = this.weapon.level;
        const minM = this.stats.minChargeMult || 1;
        const maxM = this.stats.maxChargeMult || 2.75;
        let mult = minM + (maxM - minM) * t;
        if (this.stats.shieldDivert) {
            mult += (this.stats.divertShotBonus || 0) * t;
        }
        return mult;
    }

    releaseWeaponCharge() {
        if (!this.weapon.active) return 0;
        this.updateWeaponCharge();
        const mult = this.getShotChargeMult();
        this.resetWeaponCharge();
        return mult;
    }

    onPlayerHitWhileCharging() {
        if (!this.weapon.active) return false;
        if (!this.stats.shieldSync) return false;
        this.weapon.startTime = Date.now();
        this.weapon.level = 0;
        return true;
    }

    beginDriveCharge() {
        if (!this.hasDriveCharge()) return false;
        this.drive.active = true;
        this.drive.startTime = Date.now();
        this.drive.level = 1;
        return true;
    }

    updateDriveCharge() {
        if (!this.drive.active) return 0;
        this.drive.level = 1;
        return this.drive.level;
    }

    getDriveChargeLevel() {
        return this.drive.active ? 1 : 0;
    }

    isDriveCharging() {
        return !!this.drive.active;
    }

    releaseDriveCharge() {
        if (!this.drive.active) return 0;
        this.resetDriveCharge();
        return 0;
    }

    tickShieldEffects(playerManager, deltaTime) {
        if (!playerManager || !this.weapon.active) {
            this._endDivert();
            return;
        }
        this.updateWeaponCharge();
        const level = this.weapon.level;
        if (this.stats.shieldSync && this.stats.shieldFillPerSec > 0 && playerManager.shieldMax > 0) {
            const add = this.stats.shieldFillPerSec * level * (deltaTime / 1000);
            playerManager.shield = Math.min(
                playerManager.shieldMax,
                (playerManager.shield || 0) + add
            );
        }
        if (this.stats.shieldDivert && playerManager.shieldMax > 0) {
            if (this._divertShieldSaved == null) {
                this._divertShieldSaved = playerManager.shield;
            }
            playerManager.shield = 0;
        }
    }

    _beginDivert() {
        if (!this.stats.shieldDivert) return;
        this._divertShieldSaved = null;
    }

    _endDivert() {
        if (this._divertShieldSaved != null && typeof playerManager !== 'undefined') {
            this._divertShieldSaved = null;
        }
    }

    /**
     * Hold-Shift boost multiplier when drive module is active and powered.
     */
    getMoveSpeedMul() {
        if (this.drive.active && this.hasDriveCharge()) {
            return Math.max(1, Number(this.stats.driveBoostMul) || 1.55);
        }
        return 1;
    }

    getBoostDrainPerSec() {
        if (!this.drive.active || !this.hasDriveCharge()) return 0;
        return Math.max(0, Number(this.stats.driveBoostDrainPerSec) || 0);
    }

    getShieldChargeVisual() {
        if (!this.weapon.active || !this.stats.shieldSync) {
            return { thick: 2, pulse: 1, active: false };
        }
        const level = this.weapon.level;
        const pulseSpeed = 2 + level * 6;
        const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(Date.now() / 1000 * pulseSpeed * Math.PI * 2));
        const thick = 2 + Math.round(level * 3);
        return { thick: thick, pulse: pulse, active: true, level: level };
    }
}

const chargeSystem = new ChargeSystem();
window.chargeSystem = chargeSystem;
