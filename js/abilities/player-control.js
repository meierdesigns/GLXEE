"use strict";

// Flight Assist (id: player_control) - Starfighter
// Sharper steering: more sensitive, more precise, no input lag.
export const playerControlAbility = {
    name: "Flight Assist",
    description: "Flight computer that sharpens steering response",
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
    uiDescription: "+20% steering sensitivity, +15% precision",
    detailedDescription: "A flight computer that removes input lag and sharpens steering: controls are 20% more sensitive and 15% more precise."
};
