"use strict";

// Player management
class PlayerManager {
    constructor() {
        this.player = {
            x: 105,
            y: 270,
            width: 30,
            height: 24,
            speed: 4,
            color: 'var(--gray-1000)',
            type: 'spaceship',
            minY: 200,
            maxY: 276
        };
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.shield = 0;
        this.shieldMax = 0;
        this.shieldRegen = 0;
        this.maxEnergy = 0;
        this.energy = 0;
        this.energyRegen = 0;
        this.energyIdleDraw = 0;
        this.energyDrainMul = 1;
        this.shotEnergyCost = 4;
        this.chargeEnergyPerSec = 12;
        this.shieldAbsorbEnergyPerDmg = 0.5;
        this.boostEnergyPerSec = 22;
        this.boostSpeedMul = 1.55;
        this.armor = 0;
        this.damageReduction = 0;
        this.reflectChance = 0;
        this.defenseMechanisms = [];
        this.currentShipModel = null;
    }

    isSystemsOnline() {
        return this.maxEnergy > 0 && this.energy > 0;
    }

    update(keys, deltaTime = 16.67) {
        const dt = deltaTime / 1000;

        // Energy regen net of idle draw (idle pauses when offline / empty)
        if (this.maxEnergy > 0) {
            let net = this.energyRegen || 0;
            if (this.energy > 0) {
                net -= (this.energyIdleDraw || 0);
            }
            this.energy = Math.max(0, Math.min(this.maxEnergy, this.energy + net * dt));
        }

        // Shift boost (charge_drive): speed up while held and powered
        if (typeof chargeSystem !== 'undefined' && keys) {
            const shiftHeld = !!(keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']);
            const canBoost = shiftHeld && chargeSystem.hasDriveCharge() && this.isSystemsOnline();
            if (canBoost) {
                if (!chargeSystem.isDriveCharging()) chargeSystem.beginDriveCharge();
                else chargeSystem.updateDriveCharge();
                const boostDrain = (this.boostEnergyPerSec != null)
                    ? this.boostEnergyPerSec
                    : (chargeSystem.getBoostDrainPerSec ? chargeSystem.getBoostDrainPerSec() : 22);
                this.energy = Math.max(0, this.energy - boostDrain * dt);
                if (this.energy <= 0) {
                    chargeSystem.releaseDriveCharge();
                }
            } else if (chargeSystem.isDriveCharging()) {
                chargeSystem.releaseDriveCharge();
            }
            chargeSystem.tickShieldEffects(this, deltaTime);
        }

        const speedMultiplier = deltaTime / 16.67;
        let chargeMul = 1;
        if (typeof chargeSystem !== 'undefined' && chargeSystem.isDriveCharging()
            && this.isSystemsOnline()) {
            chargeMul = chargeSystem.getMoveSpeedMul();
        }
        let tetherMul = 1;
        if (typeof enemyManager !== 'undefined' && enemyManager.getTetherSpeedMul) {
            tetherMul = enemyManager.getTetherSpeedMul();
        }
        const moveSpeed = this.player.speed * speedMultiplier * chargeMul * tetherMul;

        if (typeof game !== 'undefined') {
            const canvasHeight = game.internalHeight || game.baseHeight || 300;
            const canvasWidth = game.internalWidth || game.baseWidth || 200;
            // Once every enemy is down (victory loot phase) the ship may fly
            // the whole screen to reach pickups; otherwise it keeps to the
            // lower two thirds and drifts back there after the phase ends.
            const freeFlight = !!(game.gameControl && game.gameControl._victoryLootPhase);
            this.player.minY = freeFlight ? 0 : canvasHeight * 0.33;
            this.player.maxY = canvasHeight - this.player.height;
            if (!freeFlight && this.player.y < this.player.minY) {
                this.player.y = Math.min(this.player.minY, this.player.y + moveSpeed);
            }

            // The ship's centre (its guns) may reach either edge, so enemies
            // bouncing along the walls stay hittable.
            const halfW = this.player.width / 2;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                this.player.x = Math.max(-halfW, this.player.x - moveSpeed);
            }
            if (keys['ArrowRight'] || keys['d'] || keys['D']) {
                this.player.x = Math.min(canvasWidth - halfW, this.player.x + moveSpeed);
            }
        } else {
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                this.player.x = Math.max(0, this.player.x - moveSpeed);
            }
            if (keys['ArrowRight'] || keys['d'] || keys['D']) {
                this.player.x = Math.min(200 - this.player.width, this.player.x + moveSpeed);
            }
        }

        if (keys['ArrowUp'] || keys['w'] || keys['W']) {
            this.player.y = Math.max(this.player.minY, this.player.y - moveSpeed);
        }
        if (keys['ArrowDown'] || keys['s'] || keys['S']) {
            this.player.y = Math.min(this.player.maxY, this.player.y + moveSpeed);
        }

        const diverting = typeof chargeSystem !== 'undefined'
            && chargeSystem.isWeaponCharging()
            && chargeSystem.stats.shieldDivert;
        if (!diverting && this.shieldMax > 0 && this.shieldRegen > 0 && this.shield < this.shieldMax) {
            const mechs = this.defenseMechanisms || [];
            const canRegen = !mechs.length
                || mechs.indexOf('shield_regen') !== -1
                || this.shieldRegen > 0;
            if (canRegen) {
                this.shield = Math.min(
                    this.shieldMax,
                    this.shield + this.shieldRegen * dt
                );
            }
        }
    }

    getPosition() {
        return this.player;
    }

    takeDamage(damage) {
        if (typeof game !== 'undefined' && game.cheats && game.cheats.godMode) {
            return false;
        }

        let hpDamage = Number(damage) || 0;
        const online = this.isSystemsOnline();
        const costPer = Math.max(0.01, Number(this.shieldAbsorbEnergyPerDmg) || 0.5);
        const maxAbsByEnergy = online ? (this.energy / costPer) : 0;
        const usableShield = online ? Math.min(this.shield, maxAbsByEnergy) : 0;
        const savedShield = this.shield;

        if (hpDamage > 0 && typeof enemyManager !== 'undefined' && enemyManager.applyDefenseToDamage) {
            const target = {
                armor: this.armor,
                shield: usableShield,
                damageReduction: this.damageReduction,
                reflectChance: this.reflectChance,
                defenseMechanisms: this.defenseMechanisms
            };
            hpDamage = enemyManager.applyDefenseToDamage(target, hpDamage);
            const used = Math.max(0, usableShield - (target.shield || 0));
            this.shield = savedShield - used;
            if (used > 0) {
                this.energy = Math.max(0, this.energy - used * costPer);
            }
        } else if (hpDamage > 0 && usableShield > 0) {
            const absorbed = Math.min(usableShield, hpDamage);
            this.shield = savedShield - absorbed;
            this.energy = Math.max(0, this.energy - absorbed * costPer);
            hpDamage -= absorbed;
        }

        if (typeof chargeSystem !== 'undefined' && chargeSystem.onPlayerHitWhileCharging) {
            chargeSystem.onPlayerHitWhileCharging();
            if (typeof bulletManager !== 'undefined') {
                bulletManager.chargeLevel = chargeSystem.getWeaponChargeLevel();
            }
        }

        this.health -= hpDamage;
        if (this.health <= 0) {
            this.health = 0;
            return true;
        }
        return false;
    }

    getHealth() {
        return this.health;
    }

    getMaxHealth() {
        return this.maxHealth;
    }

    getShield() {
        return this.shield;
    }

    getShieldMax() {
        return this.shieldMax;
    }

    getEnergy() {
        return this.energy;
    }

    getMaxEnergy() {
        return this.maxEnergy;
    }

    spendEnergy(amount) {
        const cost = Math.max(0, Number(amount) || 0);
        if (!this.isSystemsOnline() || this.energy < cost) return false;
        this.energy -= cost;
        return true;
    }

    getShotEnergyCost() {
        return Math.max(0, Number(this.shotEnergyCost) || 0);
    }

    getChargeEnergyPerSec() {
        return Math.max(0, Number(this.chargeEnergyPerSec) || 0);
    }

    reset() {
        let canvasWidth = 200;
        let canvasHeight = 300;

        if (typeof game !== 'undefined') {
            canvasWidth = game.internalWidth || game.baseWidth || 200;
            canvasHeight = game.internalHeight || game.baseHeight || 300;
        }

        this.applyFixedFootprint();
        this.player.x = (canvasWidth / 2) - (this.player.width / 2);
        this.player.y = canvasHeight - this.player.height - 20;
        this.player.minY = canvasHeight * 0.33;
        this.player.maxY = canvasHeight - this.player.height;

        this.health = this.maxHealth;
        this.shield = this.shieldMax;
        this.energy = this.maxEnergy;
    }
}
