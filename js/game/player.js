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
            this.player.minY = canvasHeight * 0.33;
            this.player.maxY = canvasHeight - this.player.height;

            if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                this.player.x = Math.max(0, this.player.x - moveSpeed);
            }
            if (keys['ArrowRight'] || keys['d'] || keys['D']) {
                this.player.x = Math.min(canvasWidth - this.player.width, this.player.x + moveSpeed);
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
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(3, Number(game.contentScale) || 1))
            : 1;

        if (typeof game !== 'undefined') {
            canvasWidth = game.internalWidth || game.baseWidth || 200;
            canvasHeight = game.internalHeight || game.baseHeight || 300;
        }

        const baseW = (this.currentShipModel && (this.currentShipModel.width || this.currentShipModel.nativeWidth)) || 20;
        const baseH = (this.currentShipModel && (this.currentShipModel.height || this.currentShipModel.nativeHeight)) || 16;
        this.player.width = Math.max(8, Math.round(Number(baseW) * contentScale));
        this.player.height = Math.max(6, Math.round(Number(baseH) * contentScale));
        this.player.x = (canvasWidth / 2) - (this.player.width / 2);
        this.player.y = canvasHeight - this.player.height - 20;
        this.player.minY = canvasHeight * 0.33;
        this.player.maxY = canvasHeight - this.player.height;

        this.health = this.maxHealth;
        this.shield = this.shieldMax;
        this.energy = this.maxEnergy;
    }

    setShipModel(shipModel) {
        if (!shipModel) return;

        this.currentShipModel = shipModel;

        this.player.speed = shipModel.speed || 4;
        this.maxHealth = shipModel.maxHealth || 100;
        this.health = this.maxHealth;
        this.armor = Number(shipModel.armor) || 0;

        let shieldMax = Number(shipModel.shieldMax);
        let shieldRegen = Number(shipModel.shieldRegen);
        let damageReduction = Number(shipModel.damageReduction);
        let reflectChance = Number(shipModel.reflectChance);
        let mechs = Array.isArray(shipModel.defenseMechanisms)
            ? shipModel.defenseMechanisms.slice()
            : (Array.isArray(shipModel.abilities) ? shipModel.abilities.slice() : []);

        if ((!shieldMax || shieldMax <= 0) && typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.computeDefenseStats) {
            const stats = shipLoadoutManager.computeDefenseStats(
                shipModel.abilities || mechs
            );
            shieldMax = stats.shieldMax;
            shieldRegen = stats.shieldRegen;
            damageReduction = stats.damageReduction;
            reflectChance = stats.reflectChance;
            mechs = stats.mechs;
        }

        this.shieldMax = Math.max(0, Math.round(shieldMax || 0));
        this.shieldRegen = Math.max(0, shieldRegen || 0);
        this.damageReduction = Math.max(0, damageReduction || 0);
        this.reflectChance = Math.max(0, reflectChance || 0);
        this.defenseMechanisms = mechs;
        this.shield = this.shieldMax;

        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.syncFromShipModel(shipModel);
        }

        if (shipModel.energyStats || shipModel.hasEnergyCore != null) {
            this.maxEnergy = Math.max(0, Math.round(Number(shipModel.maxEnergy) || 0));
            this.energyRegen = Math.max(0, Number(shipModel.energyRegen) || 0);
            this.energyIdleDraw = Math.max(0, Number(shipModel.energyIdleDraw) || 0);
            this.energyDrainMul = Math.max(0.4, Number(shipModel.energyDrainMul) || 1);
            this.shotEnergyCost = Math.max(0, Number(shipModel.shotEnergyCost) || 0);
            this.chargeEnergyPerSec = Math.max(0, Number(shipModel.chargeEnergyPerSec) || 0);
            this.shieldAbsorbEnergyPerDmg = Math.max(0, Number(shipModel.shieldAbsorbEnergyPerDmg) || 0.5);
            this.boostEnergyPerSec = Math.max(0, Number(shipModel.boostEnergyPerSec) || 0);
            this.boostSpeedMul = Math.max(1, Number(shipModel.boostSpeedMul) || 1);
        } else if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.computeEnergyStats) {
            const es = shipLoadoutManager.computeEnergyStats(shipModel.loadout || {
                weapons: shipModel.availableWeapons || [],
                defenses: [],
                abilities: shipModel.abilities || [],
                energy: shipModel.energy || []
            });
            this.maxEnergy = es.maxEnergy;
            this.energyRegen = es.regen;
            this.energyIdleDraw = es.idleDraw;
            this.energyDrainMul = es.drainMul;
            this.shotEnergyCost = es.shotCost;
            this.chargeEnergyPerSec = es.chargePerSec;
            this.shieldAbsorbEnergyPerDmg = es.shieldAbsorbPerDmg;
            this.boostEnergyPerSec = es.boostPerSec;
            this.boostSpeedMul = es.boostSpeedMul;
        } else {
            this.maxEnergy = 0;
            this.energyRegen = 0;
            this.energyIdleDraw = 0;
        }
        this.energy = this.maxEnergy;

        if (shipModel.width != null) this.player.width = Math.max(8, Math.round(shipModel.width));
        if (shipModel.height != null) this.player.height = Math.max(8, Math.round(shipModel.height));

        if (shipModel.minY !== undefined) this.player.minY = shipModel.minY;
        if (shipModel.maxY !== undefined) this.player.maxY = shipModel.maxY;

        if (typeof game !== 'undefined') {
            const canvasHeight = game.internalHeight || game.baseHeight || 300;
            this.player.maxY = canvasHeight - this.player.height;
        }
    }

    getCurrentShipModel() {
        return this.currentShipModel;
    }
}

const playerManager = new PlayerManager();
