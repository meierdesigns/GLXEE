"use strict";

// Player Control Ability - Starfighter
export const playerControlAbility = {
    name: "Player Control",
    description: "Direct player control with enhanced responsiveness",
    type: "passive",
    tier: 1,
    
    // Visual effects
    icon: "ability_player_control",
    color: "var(--current-primary)",
    
    // Game mechanics
    effects: {
        responsiveness: 1.0,      // Perfect responsiveness
        inputLag: 0,               // No input lag
        precisionModifier: 1.15,   // 15% precision bonus
        controlSensitivity: 1.2    // 20% more sensitive controls
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
            type: "control_feedback",
            color: "var(--current-primary)",
            intensity: 0.2
        },
        sound: null
    },
    
    // Description for UI
    uiDescription: "Enhanced player control and responsiveness",
    detailedDescription: "Provides perfect player control with enhanced responsiveness and precision. This ability ensures the ship responds exactly to player input with maximum accuracy."
};
