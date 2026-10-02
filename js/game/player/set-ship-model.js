"use strict";

// Fixed in-game player ship width (internal pixels, before contentScale).
const PLAYER_FOOTPRINT_WIDTH = 18;
// Fixed scale: in-game pixels per layout unit (18 px for the 36-unit default
// hull). The ship and its guns keep their size however areas are moved —
// a wider layout makes the ship wider, it no longer shrinks to fit.
const PLAYER_UNIT_SCALE = PLAYER_FOOTPRINT_WIDTH / 36;
// Reference hull size the hangar views fit to (not the edited layout).
const PLAYER_REF_W = 36;
const PLAYER_REF_H = 28;

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
        const playerSizeMul = (typeof uiAppearanceManager !== 'undefined'
            && uiAppearanceManager.getPlayerSizeMul)
            ? uiAppearanceManager.getPlayerSizeMul() : 1;
        const model = this.currentShipModel || {};
        const mw = Math.max(1, Number(model.width || model.nativeWidth) || 20);
        const mh = Math.max(1, Number(model.height || model.nativeHeight) || 16);
        // Wide layouts (long wings) used to make the ship huge: cap the
        // footprint at 1.3× the reference size, keeping the aspect.
        const k = Math.min(PLAYER_UNIT_SCALE, (PLAYER_FOOTPRINT_WIDTH * 1.3) / mw, (PLAYER_FOOTPRINT_WIDTH * 1.3) / mh);
        this.player.width = Math.max(8, Math.round(mw * k * contentScale * playerSizeMul));
        this.player.height = Math.max(8, Math.round(mh * k * contentScale * playerSizeMul));
        this.refreshPlayerHitMask();
    },

    /**
     * Pixel hit mask of the player ship: the model rendered offscreen exactly
     * as GraphicsManager.renderPlayerShip fits it into the footprint, so hits
     * need real hull pixels (not the empty box between the wings).
     * Retries on later frames while the ship art is still loading.
     */
    refreshPlayerHitMask() {
        const p = this.player;
        const model = (typeof graphicsManager !== 'undefined' && graphicsManager.currentPlayerModel) || this.currentShipModel;
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!p || !model || !loader || !loader.renderShip || (loader.isLoaded && !loader.isLoaded())
            || typeof document === 'undefined') {
            p && (p.collision = null);
            return;
        }
        const W = Math.max(1, Math.round(p.width));
        const H = Math.max(1, Math.round(p.height));
        const key = [model.id || model.name, model.width, model.height, W, H, model.moduleCount || 0].join('|');
        if (this._hitMaskKey === key && p.collision) return;
        const k = 3; // sub-pixel resolution
        const mw = Math.max(1, model.width || W);
        const mh = Math.max(1, model.height || H);
        const fit = Math.max(0.25, Math.min(W / mw, H / mh));
        try {
            const c = document.createElement('canvas');
            c.width = W * k;
            c.height = H * k;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            loader.renderShip(ctx, model, ((W - mw * fit) / 2) * k, ((H - mh * fit) / 2) * k, fit * k, null, 0, {});
            const data = ctx.getImageData(0, 0, c.width, c.height).data;
            const grid = [];
            let solid = 0;
            for (let r = 0; r < c.height; r++) {
                const row = new Array(c.width);
                for (let q = 0; q < c.width; q++) {
                    const on = data[(r * c.width + q) * 4 + 3] > 110 ? 1 : 0;
                    row[q] = on;
                    solid += on;
                }
                grid.push(row);
            }
            if (solid < 4) { p.collision = null; return; } // art not ready yet
            p.collision = { sprite: grid, colors: {}, drawW: W, drawH: H, insetL: 0, insetT: 0, insetR: 0, insetB: 0 };
            this._hitMaskKey = key;
        } catch (e) {
            p.collision = null;
        }
    },

    getCurrentShipModel() {
        return this.currentShipModel;
    },
});
