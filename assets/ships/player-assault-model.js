"use strict";

// Player Assault Model - Balanced Combat Craft
export const playerAssaultModel = {
    name: "Assault",
    type: "player",
    modelClass: "assault",
    tier: 3,
    width: 20,
    height: 16,
    
    // Detailed pixel art sprite (20x16) - Assault Ship Design
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
        [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    
    // Color palette - Grayscale for color overlay system
    colors: {
        0: 'transparent',
        1: '#404040',  // Dark gray
        2: '#808080',  // Medium gray
        3: '#C0C0C0'   // Light gray
    },
    
    // Engine glow effect
    engineGlow: {
        positions: [
            {x: 8, y: 15, intensity: 0.9},
            {x: 9, y: 15, intensity: 0.9},
            {x: 10, y: 15, intensity: 0.9},
            {x: 11, y: 15, intensity: 0.9}
        ],
        color: '#e0e0e0'
    },
    
    // Ship properties - Balanced
    speed: 3.5,        // Medium speed
    maxHealth: 120,    // Medium health
    armor: 25,         // Medium armor
    damage: 35,        // Medium damage
    
    // Movement constraints
    minY: 200,
    maxY: 284,
    
    // Weapons - Assault ship has versatile weapon systems
    defaultWeapon: 'laser',
    availableWeapons: ['laser', 'spread', 'rapid'],
    weaponConfig: {
        laser: { damage: 12, speed: 8, cooldown: 300 },  // Balanced
        spread: { damage: 8, speed: 7, cooldown: 400, bulletCount: 3, spreadAngle: 0.4 },  // Good spread
        rapid: { damage: 6, speed: 11, cooldown: 100, bulletCount: 4 }  // Fast firing
    },
    
    // Special abilities
    abilities: ['balanced_combat', 'versatile_weapons', 'adaptive_shield'],
    experienceValue: 0,
    
    // Description for selection screen
    description: "Balanced combat craft. Good all-around performance. Versatile weapon systems.",
    tier: 1,
    cost: 50
};
