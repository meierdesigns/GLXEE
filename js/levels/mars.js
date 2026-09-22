"use strict";

// Mars Level - Easy Desert Environment
class MarsLevel {
    constructor() {
        this.id = "mars";
        this.name = "MARS";
        this.difficulty = "EASY";
        this.environment = "DESERT";
        this.color = "#808080";
        this.description = "Red planet with basic obstacles";
        this.background = "mars";
        this.enemyType = "enemyBasic";
        
        // Mars-specific obstacle patterns
        this.obstaclePatterns = [
            {
                type: "rock",
                spawnRate: 0.3,
                speed: 2,
                size: { width: 18, height: 18 }, // Reduced to moderate size
                color: "#606060"
            },
            {
                type: "dust_cloud",
                spawnRate: 0.2,
                speed: 1.5,
                size: { width: 25, height: 25 }, // Reduced to moderate size
                color: "#a0a0a0"
            }
        ];
        
        // Mars-specific settings
        this.obstacleSpawnInterval = 3000; // 3 seconds
        this.enemySpeed = 1.5;
        this.enemyHealth = 80;
        this.playerSpeed = 8;
    }
    
    getObstaclePattern() {
        // Return a random obstacle pattern based on spawn rates
        const totalRate = this.obstaclePatterns.reduce((sum, pattern) => sum + pattern.spawnRate, 0);
        let random = Math.random() * totalRate;
        
        for (const pattern of this.obstaclePatterns) {
            random -= pattern.spawnRate;
            if (random <= 0) {
                return pattern;
            }
        }
        
        // Fallback to first pattern
        return this.obstaclePatterns[0];
    }
    
    getEnvironmentColor() {
        return this.color;
    }
    
    getBackgroundElements() {
        return [
            { type: "dust_storm", intensity: 0.3 },
            { type: "red_sand", particles: 5 }
        ];
    }
}
