"use strict";

// Player Heavy Fighter Model - Armored Combat Unit
export const playerHeavyFighterModel = {
    name: "Heavy Fighter",
    type: "player",
    modelClass: "heavy_fighter",
    tier: 2,
    width: 24,  // Match sprite width
    height: 18, // Match sprite height
    
    // Detailed pixel art sprite (24x18) - Heavy Armored Fighter Design
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    
    // Color palette - Grayscale for color overlay system
    colors: {
        0: 'transparent',
        1: 'var(--gray-800)',  // Dark gray
        2: 'var(--gray-600)',  // Medium gray
        3: 'var(--gray-400)'   // Light gray
    },
    
    // Engine glow effect
    engineGlow: {
        positions: [
            {x: 10, y: 17, intensity: 0.8},
            {x: 11, y: 17, intensity: 0.8},
            {x: 12, y: 17, intensity: 0.8},
            {x: 13, y: 17, intensity: 0.8}
        ],
        color: 'var(--gray-100)'
    },
    
    // Ship properties - Slow but powerful
    speed: 2.5,        // Slowest player ship
    maxHealth: 150,    // Highest health
    armor: 40,         // Heavy armor
    damage: 45,        // High damage
    
    // Movement constraints
    minY: 200,
    maxY: 284,
    
    // Weapons - Heavy Fighter specializes in area suppression
    defaultWeapon: 'spread',
    availableWeapons: ['spread', 'plasma'],
    weaponConfig: {
        spread: { damage: 12, speed: 6, cooldown: 500, bulletCount: 4, spreadAngle: 0.5 },  // Wide spread
        plasma: { damage: 18, speed: 4, cooldown: 800, width: 4, height: 8 }
    },
    
    // Special abilities
    abilities: ['heavy_armor', 'powerful_cannon', 'shield_generator'],
    experienceValue: 0,
    
    // Description for selection screen
    description: "Heavily armored combat unit. High health and powerful weapons. Slow but devastating.",
    tier: 2,
    cost: 100
};
