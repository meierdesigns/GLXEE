// Neptune Level Configuration
export const neptuneLevel = {
    name: "NEPTUNE",
    difficulty: "EXPERT",
    description: "Ice giant with advanced AI",
    
    // Enemy settings
    enemySpeed: 5,
    enemyHealth: 150,
    enemyShootInterval: 1000,
    
    // Obstacle settings
    obstacleSpawnRate: 1000,
    obstacleTypes: ['large_asteroid', 'small_shield', 'medium_shield', 'large_shield'],
    
    // Background settings
    backgroundLayers: [
        { speed: 0.5, pattern: 'neptune_storms' },
        { speed: 0.7, pattern: 'neptune_atmosphere' },
        { speed: 0.9, pattern: 'neptune_sky' }
    ],
    
    // Color theme
    primaryColor: '#808080',
    secondaryColor: '#666666',
    accentColor: '#999999'
};
