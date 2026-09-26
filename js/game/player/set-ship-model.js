"use strict";

// Fixed in-game player ship width (internal pixels, before contentScale).
const PLAYER_FOOTPRINT_WIDTH = 28;

// PlayerManager methods, split from player.js.
extendClass(PlayerManager, {
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

        this.applyFixedFootprint();

        if (shipModel.minY !== undefined) this.player.minY = shipModel.minY;
        if (shipModel.maxY !== undefined) this.player.maxY = shipModel.maxY;

        if (typeof game !== 'undefined') {
            const canvasHeight = game.internalHeight || game.baseHeight || 300;
            this.player.maxY = canvasHeight - this.player.height;
        }
    },

    /**
     * The in-game ship always occupies the same footprint, whatever the
     * loadout size; the renderer fits the model into it (aspect kept).
     */
    applyFixedFootprint() {
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(3, Number(game.contentScale) || 1))
            : 1;
        const model = this.currentShipModel || {};
        const mw = Math.max(1, Number(model.width || model.nativeWidth) || 20);
        const mh = Math.max(1, Number(model.height || model.nativeHeight) || 16);
        const aspect = Math.max(0.6, Math.min(1.6, mh / mw));
        this.player.width = Math.round(PLAYER_FOOTPRINT_WIDTH * contentScale);
        this.player.height = Math.round(PLAYER_FOOTPRINT_WIDTH * aspect * contentScale);
    },

    getCurrentShipModel() {
        return this.currentShipModel;
    },
});
