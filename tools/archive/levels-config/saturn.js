// Saturn Level Configuration
export const saturnLevel = {
    name: "SATURN",
    difficulty: "HARD",
    description: "Ringed planet with evasive enemies",
    
    // Enemy settings
    enemySpeed: 4,
    enemyHealth: 120,
    enemyShootInterval: 1200,
    
    // Obstacle settings
    obstacleSpawnRate: 1500,
    obstacleTypes: ['medium_asteroid', 'large_asteroid', 'small_shield', 'medium_shield'],
    
    // Background settings
    backgroundLayers: [
        { speed: 0.4, pattern: 'saturn_rings' },
        { speed: 0.6, pattern: 'saturn_sky' },
        { speed: 0.8, pattern: 'saturn_atmosphere' }
    ],
    
    // Color theme
    primaryColor: '#666666',
    secondaryColor: '#4d4d4d',
    accentColor: '#808080'
};
