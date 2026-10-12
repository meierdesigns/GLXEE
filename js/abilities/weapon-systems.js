"use strict";

// Weapon Systems Ability - Starfighter
export const weaponSystemsAbility = {
    name: "Weapon Systems",
    description: "Advanced targeting and weapon management systems",
    type: "passive",
    tier: 1,
    
    // Visual effects
    icon: "ability_weapon_systems",
    color: "var(--status-warning)",
    
    // Game mechanics
    effects: {
        accuracyModifier: 1.2,     // 20% accuracy bonus
        criticalChance: 0.15,      // 15% critical hit chance
        weaponDamage: 1.1,         // 10% weapon damage bonus
        rangeModifier: 1.25         // 25% increased range
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
            type: "targeting_lines",
            color: "var(--status-warning)",
            intensity: 0.4
        },
        sound: "targeting_lock"
    },
    
    // Description for UI
    uiDescription: "Enhanced targeting and weapon damage systems",
    detailedDescription: "Advanced targeting systems provide improved accuracy, critical hit chance, and weapon damage. Essential for precision strikes and maximizing combat effectiveness."
};
