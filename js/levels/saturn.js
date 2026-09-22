"use strict";

// Saturn Level - Hard Ringed Planet Environment
class SaturnLevel {
    constructor() {
        this.id = "saturn";
        this.name = "SATURN";
        this.difficulty = "HARD";
        this.environment = "RINGED_PLANET";
        this.color = "#808080";
        this.description = "Ringed planet with debris fields";
        this.background = "saturn";
        this.enemyType = "enemyHeavy";
        
        // Saturn-specific obstacle patterns
        this.obstaclePatterns = [
            {
                type: "ring_debris",
                spawnRate: 0.5,
                speed: 3,
                size: { width: 25, height: 25 }, // Reduced to moderate size
                color: "#a0a0a0"
            },
            {
                type: "ice_crystal",
                spawnRate: 0.3,
                speed: 2.8,
                size: { width: 20, height: 35 }, // Reduced to moderate size
                color: "#d0d0d0"
            },
            {
                type: "meteor_shower",
                spawnRate: 0.2,
                speed: 4,
                size: { width: 18, height: 18 }, // Reduced to moderate size
                color: "#808080"
            }
        ];
        
        // Saturn-specific settings
        this.obstacleSpawnInterval = 2000; // 2 seconds
        this.enemySpeed = 2.5;
        this.enemyHealth = 120;
        this.playerSpeed = 6;
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
            { type: "ring_particles", intensity: 0.7 },
            { type: "ice_shards", particles: 12 },
            { type: "debris_field", density: 0.4 }
        ];
    }
}
