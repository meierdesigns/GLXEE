"use strict";

// Massive Armor Ability - Battleship
export const massiveArmorAbility = {
    name: "Massive Armor",
    description: "Heavy armor plating that absorbs massive amounts of damage",
    type: "passive",
    tier: 5,
    
    // Visual effects
    icon: "ability_massive_armor",
    color: "var(--gray-700)",
    
    // Game mechanics
    effects: {
        armorModifier: 2.0,        // Double armor
        damageReduction: 0.4,      // 40% damage reduction
        healthModifier: 1.5,        // 50% more health
        knockbackResistance: 0.8    // 80% knockback resistance
    },
    
    // Activation conditions
    activation: {
        type: "always_active",
        cooldown: 0,
        duration: 0,
        cost: 0
    },
    
    // Visual feedback
    visualEffects: {
        particles: {
            type: "armor_sparks",
            color: "var(--gray-700)",
            intensity: 0.6
        },
        sound: "armor_impact"
    },
    
    // Description for UI
    uiDescription: "Heavy armor that reduces incoming damage significantly",
    detailedDescription: "Massive armor plating provides exceptional protection against all forms of damage. This ability makes the battleship extremely difficult to destroy but also significantly reduces its mobility."
};
