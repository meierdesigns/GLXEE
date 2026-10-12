"use strict";

// Fighter Model - Balanced Combat Unit
export const fighterModel = {
    name: "Fighter",
    type: "enemy",
    modelClass: "fighter",
    tier: 2,
    width: 18,
    height: 14,
    
    // Detailed pixel art sprite (18x14) - Enemy Fighter Design
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    
    // Color palette - Grayscale for color overlay system
    colors: {
        0: 'transparent',
        1: 'var(--current-text-secondary)',  // Dark gray
        2: 'var(--current-text)',  // Medium gray
        3: 'var(--current-text)'   // Light gray
    },
    
    // Engine glow effect
    engineGlow: {
        positions: [
            {x: 7, y: 13, intensity: 0.7},
            {x: 8, y: 13, intensity: 0.7},
            {x: 9, y: 13, intensity: 0.7},
            {x: 10, y: 13, intensity: 0.7}
        ],
        color: 'var(--current-text)'
    },
    
    // Ship properties
    speed: 1.5, // Reduced from 3.0 to 1.5 (50% slower)
    verticalSpeed: 0.4, // Reduced from 0.8 to 0.4 (50% slower)
    maxHealth: 100,
    armor: 15,
    damage: 25,
    
    // Movement constraints
    minY: 25,
    maxY: 100,
    
    // Behavior - Fast enemy
    shootInterval: 1200,    // Faster shooting
    evasionCooldown: 2000,  // More frequent evasion
    evasionDuration: 800,   // Shorter evasion
    evasionSpeed: 3,        // Reduced from 6 to 3 (50% slower)
    
    // Weapons - Fighter uses rapid laser
    defaultWeapon: 'laser',
    availableWeapons: ['laser'],
    weaponConfig: {
        laser: { damage: 6, speed: 6, cooldown: 1200 }  // Fast but weak
    },
    
    // Special abilities
    abilities: ['agile_combat', 'light_armor'],
    experienceValue: 80,
    
    // Description
    description: "Fast enemy fighter. Quick but fragile.",
    tier: 2
};
