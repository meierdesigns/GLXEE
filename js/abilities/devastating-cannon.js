"use strict";

// Devastating Cannon Ability - Battleship
export const devastatingCannonAbility = {
    name: "Devastating Cannon",
    description: "Massive plasma cannon capable of devastating damage",
    type: "active",
    tier: 5,
    
    // Visual effects
    icon: "ability_devastating_cannon",
    color: "var(--status-error)",
    
    // Game mechanics
    effects: {
        damageModifier: 3.0,       // Triple damage
        projectileSize: 2.5,      // 2.5x larger projectiles
        penetrationPower: 0.8,     // 80% penetration
        splashDamage: 0.5,         // 50% splash damage
        rangeModifier: 1.5          // 50% increased range
    },
    
    // Activation conditions
    activation: {
        type: "manual",
        cooldown: 15000,           // 15 second cooldown
        duration: 2000,            // 2 second charge time
        cost: 50                   // 50 energy cost
    },
    
    // Visual feedback
    visualEffects: {
        particles: {
            type: "plasma_charge",
            color: "var(--status-error)",
            intensity: 1.0
        },
        sound: "cannon_charge"
    },
    
    // Description for UI
    uiDescription: "Devastating plasma cannon with massive damage",
    detailedDescription: "Charges up a devastating plasma cannon shot that deals massive damage and can penetrate through multiple targets. The ultimate weapon for destroying heavily armored enemies."
};
