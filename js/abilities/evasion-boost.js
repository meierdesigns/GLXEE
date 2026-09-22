"use strict";

// Evasion Boost Ability - Starfighter
export const evasionBoostAbility = {
    name: "Evasion Boost",
    description: "Enhanced maneuverability and evasion capabilities",
    type: "active",
    tier: 1,
    
    // Visual effects
    icon: "ability_evasion_boost",
    color: "var(--status-error)",
    
    // Game mechanics
    effects: {
        speedModifier: 1.5,        // 50% speed boost
        evasionChance: 0.3,        // 30% chance to dodge attacks
        accelerationModifier: 2.0,  // Double acceleration
        turnRateModifier: 1.8       // 80% faster turning
    },
    
    // Activation conditions
    activation: {
        type: "manual",
        cooldown: 8000,            // 8 second cooldown
        duration: 3000,            // 3 second duration
        cost: 25                   // 25 energy cost
    },
    
    // Visual feedback
    visualEffects: {
        particles: {
            type: "speed_trails",
            color: "var(--status-error)",
            intensity: 0.8
        },
        sound: "boost_activate"
    },
    
    // Description for UI
    uiDescription: "Temporary speed and evasion boost",
    detailedDescription: "Activates a powerful boost that dramatically increases speed, acceleration, and evasion chance for a short duration. Perfect for escaping dangerous situations or closing distance quickly."
};
