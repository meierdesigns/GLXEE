"use strict";

// Player Starfighter Model - Advanced Combat Craft
export const playerStarfighterModel = {
    name: "Starfighter",
    type: "player",
    modelClass: "starfighter",
    tier: 1,
    width: 30,
    height: 24,
    
    // Detailed pixel art sprite (30x24) - Sleek Starfighter Design
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
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
            {x: 12, y: 22, intensity: 0.9},
            {x: 13, y: 22, intensity: 0.9},
            {x: 14, y: 22, intensity: 0.9},
            {x: 15, y: 22, intensity: 0.9},
            {x: 16, y: 22, intensity: 0.9},
            {x: 17, y: 22, intensity: 0.9}
        ],
        color: 'var(--gray-100)'
    },
    
    // Ship properties - Fast and agile
    speed: 5.0,        // Fastest player ship
    maxHealth: 80,     // Lower health for balance
    armor: 15,         // Light armor
    damage: 25,        // Moderate damage
    
    // Movement constraints
    minY: 200,
    maxY: 284,
    
    // Weapons - Starfighter specializes in precision strikes
    defaultWeapon: 'laser',
    availableWeapons: ['laser', 'rapid'],
    weaponConfig: {
        laser: { damage: 15, speed: 10, cooldown: 250 },      // High damage, fast
        rapid: { damage: 8, speed: 12, cooldown: 120, bulletCount: 2 }  // Very fast
    },
    
    // Special abilities
    abilities: ['player_control', 'weapon_systems', 'evasion_boost'],
    experienceValue: 0,
    
    // Ship description
    description: "Fast and agile fighter with precision weapons. High speed and maneuverability.",
    tier: 1,
    cost: 0
};
