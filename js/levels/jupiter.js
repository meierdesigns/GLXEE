"use strict";

// Jupiter Level - Medium Gas Giant Environment
class JupiterLevel {
    constructor() {
        this.id = "jupiter";
        this.name = "JUPITER";
        this.difficulty = "MEDIUM";
        this.environment = "GAS_GIANT";
        this.color = "#808080";
        this.description = "Gas giant with swirling storms";
        this.background = "jupiter";
        this.enemyType = "enemyFast";
        
        // Jupiter-specific obstacle patterns
        this.obstaclePatterns = [
            {
                type: "gas_cloud",
                spawnRate: 0.4,
                speed: 2.5,
                size: { width: 30, height: 30 }, // Reduced to moderate size
                color: "#a0a0a0"
            },
            {
                type: "lightning",
                spawnRate: 0.3,
                speed: 3,
                size: { width: 18, height: 45 }, // Reduced to moderate size
                color: "#d0d0d0"
            },
            {
                type: "storm_eye",
                spawnRate: 0.2,
                speed: 1.8,
                size: { width: 40, height: 40 }, // Reduced to moderate size
                color: "#606060"
            }
        ];
        
        // Jupiter-specific settings
        this.obstacleSpawnInterval = 2500; // 2.5 seconds
        this.enemySpeed = 2;
        this.enemyHealth = 100;
        this.playerSpeed = 7;
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
            { type: "swirling_gas", intensity: 0.5 },
            { type: "storm_clouds", particles: 8 },
            { type: "lightning_flashes", frequency: 0.1 }
        ];
    }
}
