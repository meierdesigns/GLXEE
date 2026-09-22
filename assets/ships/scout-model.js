"use strict";

// Scout Model - Fast and Agile
export const scoutModel = {
    name: "Scout",
    type: "enemy",
    modelClass: "scout",
    tier: 1,
    width: 14,
    height: 10,
    
    // Detailed pixel art sprite (14x10) - Fast Scout Design
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,2,2,2,2,2,2,2,2,2,1,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,0,0]
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
            {x: 5, y: 9, intensity: 0.8},
            {x: 6, y: 9, intensity: 0.8},
            {x: 7, y: 9, intensity: 0.8},
            {x: 8, y: 9, intensity: 0.8}
        ],
        color: 'var(--gray-100)'
    },
    
    // Ship properties
    speed: 2.25, // Reduced from 4.5 to 2.25 (50% slower)
    verticalSpeed: 0.6, // Reduced from 1.2 to 0.6 (50% slower)
    maxHealth: 60,
    armor: 5,
    damage: 15,
    
    // Movement constraints
    minY: 25,
    maxY: 100,
    
    // Behavior
    shootInterval: 1200,
    evasionCooldown: 1500,
    evasionDuration: 600,
    evasionSpeed: 3.5, // Reduced from 7 to 3.5 (50% slower)
    
    // Special abilities
    abilities: ['quick_evasion', 'rapid_fire'],
    experienceValue: 50
};
