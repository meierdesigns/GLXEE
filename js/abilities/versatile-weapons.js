"use strict";

// Versatile Weapons Ability - Assault Ship
export const versatileWeaponsAbility = {
    name: "Versatile Weapons",
    description: "Access to multiple weapon systems for different combat situations",
    type: "passive",
    tier: 1,
    
    // Visual effects
    icon: "ability_versatile_weapons",
    color: "var(--status-warning)",
    
    // Game mechanics
    effects: {
        weaponVariety: ["laser", "spread", "rapid"],
        weaponSwitchSpeed: 0.5,    // 50% faster weapon switching
        ammoCapacity: 1.2,        // 20% more ammo
        reloadSpeed: 1.15          // 15% faster reload
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
            type: "weapon_glow",
            color: "var(--status-warning)",
            intensity: 0.4
        },
        sound: "weapon_cycle"
    },
    
    // Description for UI
    uiDescription: "Enhanced weapon systems with faster switching and more ammo",
    detailedDescription: "Allows rapid switching between different weapon types and provides increased ammunition capacity. Essential for adapting to different enemy types and combat situations."
};
