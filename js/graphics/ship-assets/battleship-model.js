"use strict";

// Battleship Model - Ultimate Heavy Warship
export const battleshipModel = {
    name: "Battleship",
    type: "enemy",
    modelClass: "battleship",
    tier: 5,
    width: 26,
    height: 20,
    
    // Detailed pixel art sprite (28x24)
    sprite: [
        [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
        [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0]
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
            {x: 11, y: 23, intensity: 1.0},
            {x: 12, y: 23, intensity: 1.0},
            {x: 13, y: 23, intensity: 1.0},
            {x: 14, y: 23, intensity: 1.0},
            {x: 10, y: 22, intensity: 0.7},
            {x: 15, y: 22, intensity: 0.7}
        ],
        color: 'var(--current-text)'
    },
    
    // Ship properties - Extremely slow but devastating
    speed: 0.4,        // Reduced from 0.8 to 0.4 (50% slower)
    verticalSpeed: 0.05, // Reduced from 0.1 to 0.05 (50% slower)
    maxHealth: 400,    // Highest health
    armor: 80,         // Highest armor
    damage: 90,        // Highest damage
    
    // Movement constraints
    minY: 25,
    maxY: 100,
    
    // Behavior - Slow but powerful
    shootInterval: 1000,   // Slower shooting
    evasionCooldown: 8000, // Very infrequent evasion
    evasionDuration: 2500, // Long evasion
    evasionSpeed: 0.5,       // Reduced from 1 to 0.5 (50% slower)
    
    // Weapons - Battleship has devastating multi-weapon systems
    defaultWeapon: 'plasma',
    availableWeapons: ['plasma', 'spread', 'rapid'],
    weaponConfig: {
        plasma: { damage: 22, speed: 2, cooldown: 1200, width: 4, height: 8 },
        spread: { damage: 12, speed: 3, cooldown: 1500, bulletCount: 4, spreadAngle: 0.6 },
        rapid: { damage: 10, speed: 4, cooldown: 600, bulletCount: 3 }
    },
    
    // Special abilities
    abilities: ['massive_armor', 'devastating_cannon', 'energy_shield', 'boss_ai'],
    experienceValue: 750,
    
    // Description
    description: "Massive enemy battleship. Extremely slow but devastating firepower.",
    tier: 5
};
