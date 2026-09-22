"use strict";

// Interceptor Model - High Speed Attack Craft
export const interceptorModel = {
    name: "Interceptor",
    type: "enemy",
    modelClass: "interceptor",
    tier: 3,
    width: 16,
    height: 12,
    
    // Detailed pixel art sprite (16x12)
    sprite: [
        [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0]
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
            {x: 6, y: 11, intensity: 0.9},
            {x: 7, y: 11, intensity: 0.9},
            {x: 8, y: 11, intensity: 0.9},
            {x: 9, y: 11, intensity: 0.9}
        ],
        color: 'var(--gray-100)'
    },
    
    // Ship properties
    speed: 2.75, // Reduced from 5.5 to 2.75 (50% slower)
    verticalSpeed: 0.75, // Reduced from 1.5 to 0.75 (50% slower)
    maxHealth: 80,
    armor: 8,
    damage: 20,
    
    // Movement constraints
    minY: 25,
    maxY: 100,
    
    // Behavior
    shootInterval: 1000,
    evasionCooldown: 1800,
    evasionDuration: 700,
    evasionSpeed: 4, // Reduced from 8 to 4 (50% slower)
    
    // Special abilities
    abilities: ['high_speed', 'rapid_strike', 'agile_maneuver'],
    experienceValue: 150
};
