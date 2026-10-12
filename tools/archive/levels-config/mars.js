// Mars Level Configuration
export const marsLevel = {
    name: "MARS",
    difficulty: "EASY",
    description: "Red planet with basic enemies",
    
    // Enemy settings
    enemySpeed: 2,
    enemyHealth: 80,
    enemyShootInterval: 2000,
    
    // Obstacle settings
    obstacleSpawnRate: 3000,
    obstacleTypes: ['small_asteroid', 'medium_asteroid'],
    
    // Background settings
    backgroundLayers: [
        { speed: 0.2, pattern: 'mars_surface' },
        { speed: 0.4, pattern: 'mars_dust' },
        { speed: 0.6, pattern: 'mars_sky' }
    ],
    
    // Color theme
    primaryColor: '#808080',
    secondaryColor: '#666666',
    accentColor: '#999999'
};
