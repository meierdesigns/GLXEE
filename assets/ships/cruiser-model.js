"use strict";

// Cruiser Model - Heavy Armored Warship
export const cruiserModel = {
    name: "Cruiser",
    type: "enemy",
    modelClass: "cruiser",
    tier: 4,
    width: 22,
    height: 17,
    
    // Detailed pixel art sprite (22x18)
    sprite: [
        [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0]
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
            {x: 9, y: 17, intensity: 0.6},
            {x: 10, y: 17, intensity: 0.6},
            {x: 11, y: 17, intensity: 0.6},
            {x: 12, y: 17, intensity: 0.6}
        ],
        color: 'var(--current-text)'
    },
    
    // Ship properties
    speed: 1.0, // Reduced from 2.0 to 1.0 (50% slower)
    verticalSpeed: 0.2, // Reduced from 0.4 to 0.2 (50% slower)
    maxHealth: 180,
    armor: 35,
    damage: 40,
    
    // Movement constraints
    minY: 25,
    maxY: 100,
    
    // Behavior - Slow but powerful
    shootInterval: 3000,    // Slower shooting
    evasionCooldown: 5000,  // Less frequent evasion
    evasionDuration: 1500,  // Longer evasion
    evasionSpeed: 1,        // Reduced from 2 to 1 (50% slower)
    
    // Weapons - Cruiser has heavy weapon systems
    defaultWeapon: 'plasma',
    availableWeapons: ['plasma', 'spread'],
    weaponConfig: {
        plasma: { damage: 16, speed: 3, cooldown: 1500, width: 4, height: 8 },
        spread: { damage: 10, speed: 4, cooldown: 1000, bulletCount: 4, spreadAngle: 0.5 }
    },
    
    // Special abilities
    abilities: ['heavy_armor', 'powerful_cannon', 'shield_generator'],
    experienceValue: 300,
    
    // Description
    description: "Heavy enemy cruiser. Slow but devastating firepower.",
    tier: 4
};
