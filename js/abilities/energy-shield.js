"use strict";

// Energy Shield Ability - Battleship
export const energyShieldAbility = {
    name: "Energy Shield",
    description: "Powerful energy shield that deflects incoming projectiles",
    type: "active",
    tier: 5,
    
    // Visual effects
    icon: "ability_energy_shield",
    color: "var(--current-primary)",
    
    // Game mechanics
    effects: {
        shieldStrength: 2.0,        // Double shield strength
        reflectChance: 0.6,        // 60% chance to reflect projectiles
        energyAbsorption: 0.8,     // 80% energy absorption
        shieldRadius: 1.5           // 50% larger shield radius
    },
    
    // Activation conditions
    activation: {
        type: "manual",
        cooldown: 12000,           // 12 second cooldown
        duration: 5000,            // 5 second duration
        cost: 40                   // 40 energy cost
    },
    
    // Visual feedback
    visualEffects: {
        particles: {
            type: "shield_bubble",
            color: "var(--current-primary)",
            intensity: 0.8
        },
        sound: "shield_activate"
    },
    
    // Description for UI
    uiDescription: "Powerful energy shield with reflection capabilities",
    detailedDescription: "Activates a powerful energy shield that not only absorbs damage but also has a high chance to reflect incoming projectiles back at the attacker. Provides excellent protection against ranged attacks."
};
