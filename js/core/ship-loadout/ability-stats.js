"use strict";

// Ship stat effects of equipped abilities (speed, damage, fire rate, armor).
//
// Applied once in applyLayoutToModel, so the game, the hangar preview and
// the hangar stats all read the same numbers:
//   model.speed      × speedMul
//   model.armor      + armor
//   model.abilityDamageMul / abilityFireRateMul → shootWithShipWeapon
// Abilities not listed here (charge, shield, drive …) keep their own systems.
const ABILITY_STAT_EFFECTS = {
    player_control:     { speedMul: 1.10 },                        // Flight Assist
    high_speed:         { speedMul: 1.20 },
    agile_maneuver:     { speedMul: 1.10 },
    evasion_boost:      { speedMul: 1.05 },
    rapid_fire:         { fireRateMul: 1.15 },
    powerful_cannon:    { damageMul: 1.15 },
    devastating_cannon: { damageMul: 1.30, fireRateMul: 0.90 },
    heavy_armor:        { armor: 2, speedMul: 0.95 },
    massive_armor:      { armor: 4, speedMul: 0.90 },
    weapon_systems:     { damageMul: 1.05 },
    balanced_combat:    { damageMul: 1.05, armor: 1 }
};

extendClass(ShipLoadoutManager, {
    /** Stat effects of one ability, or null. */
    getAbilityStatEffect(id) {
        return ABILITY_STAT_EFFECTS[String(id || '')] || null;
    },

    /** Combined effects of a list of ability ids (multipliers multiply, armor adds). */
    getAbilityStatMods(abilityIds) {
        const mods = { speedMul: 1, damageMul: 1, fireRateMul: 1, armor: 0 };
        (abilityIds || []).forEach((id) => {
            const e = this.getAbilityStatEffect(id);
            if (!e) return;
            if (e.speedMul) mods.speedMul *= e.speedMul;
            if (e.damageMul) mods.damageMul *= e.damageMul;
            if (e.fireRateMul) mods.fireRateMul *= e.fireRateMul;
            if (e.armor) mods.armor += e.armor;
        });
        return mods;
    },

    /** Apply the equipped abilities' effects to a freshly built model. */
    applyAbilityStatsToModel(model, abilityIds) {
        const mods = this.getAbilityStatMods(abilityIds);
        model.baseSpeed = Number(model.speed) || 4;
        model.speed = Math.round(model.baseSpeed * mods.speedMul * 100) / 100;
        if (mods.armor) model.armor = (Number(model.armor) || 0) + mods.armor;
        model.abilityDamageMul = mods.damageMul;
        model.abilityFireRateMul = mods.fireRateMul;
        model.abilityStatMods = mods;
        return model;
    }
});
