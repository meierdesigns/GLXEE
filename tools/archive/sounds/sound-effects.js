// Sound Assets for GLXEE Game Boy Edition
export const soundAssets = {
    // Shooting sounds
    shoot: {
        name: "shoot",
        type: "laser",
        frequency: {
            start: 1200,
            end: 600
        },
        duration: 0.15,
        volume: 0.005, // Drastically reduced to 0.005
        description: "Laser shooting sound with frequency sweep"
    },
    
    // Explosion sounds
    explosion: {
        name: "explosion",
        type: "explosion",
        frequency: 200,
        duration: 0.3,
        volume: 0.015, // Drastically reduced to 0.015
        description: "Enemy/obstacle explosion sound"
    },
    
    // Game over sound
    gameOver: {
        name: "gameOver",
        type: "beep",
        frequency: 150,
        duration: 1.0,
        volume: 0.01, // Drastically reduced to 0.01
        description: "Game over notification sound"
    },
    
    // Power-up sound
    powerUp: {
        name: "powerUp",
        type: "beep",
        frequency: 800,
        duration: 0.2,
        volume: 0.008, // Drastically reduced to 0.008
        description: "Power-up collection sound"
    },
    
    // Hit sound
    hit: {
        name: "hit",
        type: "beep",
        frequency: 400,
        duration: 0.1,
        volume: 0.006, // Drastically reduced to 0.006
        description: "Bullet hit sound"
    },
    
    // Menu navigation sound
    menuSelect: {
        name: "menuSelect",
        type: "beep",
        frequency: 600,
        duration: 0.1,
        volume: 0.004, // Drastically reduced to 0.004
        description: "Menu selection sound"
    },
    
    // Menu navigation sound
    menuNavigate: {
        name: "menuNavigate",
        type: "beep",
        frequency: 300,
        duration: 0.05,
        volume: 0.003, // Drastically reduced to 0.003
        description: "Menu navigation sound"
    },
    
    // Victory sound
    victory: {
        name: "victory",
        type: "melody",
        frequencies: [523, 659, 784, 1047], // C, E, G, C
        duration: 0.2,
        volume: 0.008, // Drastically reduced to 0.008
        description: "Victory fanfare"
    },
    
    // Level complete sound
    levelComplete: {
        name: "levelComplete",
        type: "beep",
        frequency: 1000,
        duration: 0.5,
        volume: 0.01, // Drastically reduced to 0.01
        description: "Level completion sound"
    },
    
    // Shield reflect sound
    shieldReflect: {
        name: "shieldReflect",
        type: "laser",
        frequency: {
            start: 800,
            end: 1200
        },
        duration: 0.1,
        volume: 0.006, // Drastically reduced to 0.006
        description: "Shield reflection sound"
    }
};
