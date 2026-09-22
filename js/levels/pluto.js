"use strict";

// Pluto Level - Nightmare Dwarf Planet Environment
class PlutoLevel {
    constructor() {
        this.id = "pluto";
        this.name = "PLUTO";
        this.difficulty = "NIGHTMARE";
        this.environment = "DWARF_PLANET";
        this.color = "#808080";
        this.description = "Dwarf planet with chaotic gravity";
        this.background = "pluto";
        this.enemyType = "enemyBoss";
        
        // Pluto-specific obstacle patterns
        this.obstaclePatterns = [
            {
                type: "gravity_well",
                spawnRate: 0.3,
                speed: 2,
                size: { width: 35, height: 35 }, // Reduced to moderate size
                color: "#606060"
            },
            {
                type: "dark_matter",
                spawnRate: 0.4,
                speed: 4.5,
                size: { width: 22, height: 22 }, // Reduced to moderate size
                color: "#404040"
            },
            {
                type: "void_portal",
                spawnRate: 0.3,
                speed: 3.5,
                size: { width: 40, height: 40 }, // Reduced to moderate size
                color: "#202020"
            }
        ];
        
        // Pluto-specific settings
        this.obstacleSpawnInterval = 1000; // 1 second
        this.enemySpeed = 3.5;
        this.enemyHealth = 200;
        this.playerSpeed = 4;
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
            { type: "chaotic_gravity", intensity: 1.0 },
            { type: "dark_energy", particles: 20 },
            { type: "void_distortion", density: 0.8 }
        ];
    }
}
