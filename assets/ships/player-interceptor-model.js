"use strict";

// Player Interceptor Model - Fast Attack Craft
export const playerInterceptorModel = {
    name: "Interceptor",
    type: "player",
    modelClass: "interceptor",
    tier: 1,
    width: 16,
    height: 12,
    
    // Detailed pixel art sprite (16x12) - Fast Interceptor Design
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
        [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0]
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
            {x: 6, y: 11, intensity: 0.9},
            {x: 7, y: 11, intensity: 0.9},
            {x: 8, y: 11, intensity: 0.9},
            {x: 9, y: 11, intensity: 0.9}
        ],
        color: '#e0e0e0'
    },
    
    // Ship properties - Very fast but weak
    speed: 6.0,        // Fastest ship
    maxHealth: 60,     // Lowest health
    armor: 8,          // Lightest armor
    damage: 18,        // Low damage
    
    // Movement constraints
    minY: 200,
    maxY: 284,
    
    // Weapons - Interceptor specializes in rapid strikes
    defaultWeapon: 'rapid',
    availableWeapons: ['rapid', 'laser'],
    weaponConfig: {
        rapid: { damage: 5, speed: 15, cooldown: 80, bulletCount: 4 },   // Very fast
        laser: { damage: 8, speed: 12, cooldown: 150 }  // Fast laser
    },
    
    // Special abilities
    abilities: ['high_speed', 'rapid_fire', 'agile_maneuver'],
    experienceValue: 0,
    
    // Description for selection screen
    description: "Ultra-fast attack craft. Extreme speed and rapid fire rate. Low durability.",
    tier: 1,
    cost: 75
};
