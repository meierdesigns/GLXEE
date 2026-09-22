"use strict";

// Balanced Combat Ability - Assault Ship
export const balancedCombatAbility = {
    name: "Balanced Combat",
    description: "Versatile combat system with balanced offense and defense",
    type: "passive",
    tier: 1,
    
    // Visual effects
    icon: "ability_balanced_combat",
    color: "var(--status-success)",
    
    // Game mechanics
    effects: {
        damageModifier: 1.0,      // No damage bonus
        speedModifier: 1.0,       // No speed bonus
        healthModifier: 1.1,      // 10% health bonus
        accuracyModifier: 1.05,   // 5% accuracy bonus
        cooldownModifier: 0.95    // 5% faster cooldown
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
            type: "subtle_glow",
            color: "var(--status-success)",
            intensity: 0.3
        },
        sound: null
    },
    
    // Description for UI
    uiDescription: "Provides balanced performance across all combat metrics",
    detailedDescription: "This ability enhances the ship's overall combat effectiveness through improved health, accuracy, and weapon cooldown times. Perfect for players who prefer a well-rounded approach to combat."
};
