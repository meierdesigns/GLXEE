"use strict";

// Neptune Level - Extreme Ice Planet Environment
class NeptuneLevel {
    constructor() {
        this.id = "neptune";
        this.name = "NEPTUNE";
        this.difficulty = "EXTREME";
        this.environment = "ICE_PLANET";
        this.color = "#808080";
        this.description = "Ice planet with freezing storms";
        this.background = "neptune";
        this.enemyType = "enemyHeavy";
        
        // Neptune-specific obstacle patterns
        this.obstaclePatterns = [
            {
                type: "ice_spike",
                spawnRate: 0.4,
                speed: 3.5,
                size: { width: 30, height: 30 }, // Reduced to moderate size
                color: "#a0a0a0"
            },
            {
                type: "freeze_ray",
                spawnRate: 0.3,
                speed: 4,
                size: { width: 15, height: 50 }, // Reduced to moderate size
                color: "#808080"
            },
            {
                type: "blizzard",
                spawnRate: 0.3,
                speed: 2.5,
                size: { width: 45, height: 45 }, // Reduced to moderate size
                color: "#d0d0d0"
            }
        ];
        
        // Neptune-specific settings
        this.obstacleSpawnInterval = 1500; // 1.5 seconds
        this.enemySpeed = 3;
        this.enemyHealth = 150;
        this.playerSpeed = 5;
    }
    
    getObstaclePattern() {
        const totalRate = this.obstaclePatterns.reduce((sum, pattern) => sum + pattern.spawnRate, 0);
        let random = Math.random() * totalRate;
        
        for (const pattern of this.obstaclePatterns) {
            random -= pattern.spawnRate;
            if (random <= 0) {
                return pattern;
            }
        }
        
        return this.obstaclePatterns[0];
    }
    
    getEnvironmentColor() {
        return this.color;
    }
    
    getBackgroundElements() {
        return [
            { type: "ice_storm", intensity: 0.8 },
            { type: "freezing_wind", particles: 15 },
            { type: "crystal_formation", density: 0.6 }
        ];
    }
}
