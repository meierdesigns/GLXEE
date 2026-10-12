// Jupiter Level Configuration
export const jupiterLevel = {
    name: "JUPITER",
    difficulty: "MEDIUM",
    description: "Gas giant with faster enemies",
    
    // Enemy settings
    enemySpeed: 3,
    enemyHealth: 100,
    enemyShootInterval: 1500,
    
    // Obstacle settings
    obstacleSpawnRate: 2000,
    obstacleTypes: ['small_asteroid', 'medium_asteroid', 'small_shield'],
    
    // Background settings
    backgroundLayers: [
        { speed: 0.3, pattern: 'jupiter_bands' },
        { speed: 0.5, pattern: 'jupiter_atmosphere' },
        { speed: 0.7, pattern: 'jupiter_sky' }
    ],
    
    // Color theme
    primaryColor: '#999999',
    secondaryColor: '#808080',
    accentColor: '#b3b3b3'
};
