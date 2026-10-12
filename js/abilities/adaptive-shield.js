"use strict";

// Adaptive Shield Ability - Assault Ship
export const adaptiveShieldAbility = {
    name: "Adaptive Shield",
    description: "Shield system that adapts to incoming damage types",
    type: "passive",
    tier: 1,
    
    // Visual effects
    icon: "ability_adaptive_shield",
    color: "#808080",
    
    // Game mechanics
    effects: {
        shieldStrength: 1.25,     // 25% stronger shields
        damageReduction: 0.15,     // 15% damage reduction
        shieldRegen: 1.3,          // 30% faster shield regeneration
        energyEfficiency: 1.1      // 10% more energy efficient
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
            type: "shield_ripple",
            color: "#808080",
            intensity: 0.5
        },
        sound: "shield_hum"
    },
    
    // Description for UI
    uiDescription: "Enhanced shield system with adaptive protection",
    detailedDescription: "Provides stronger shields that automatically adapt to different damage types, reducing incoming damage and regenerating faster than standard shield systems."
};
