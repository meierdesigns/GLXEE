"use strict";

// Level Manager - Handles all level-specific logic
class LevelManager {
    constructor() {
        this.currentLevel = null;
        this.levels = new Map();
        this.planetOrder = ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
        this.initializeLevels();
    }
    
    initializeLevels() {
        const instances = [
            new MarsLevel(),
            new JupiterLevel(),
            new SaturnLevel(),
            new NeptuneLevel(),
            new PlutoLevel()
        ];

        instances.forEach((level, index) => {
            if (!level.id) {
                level.id = this.planetOrder[index] || level.name.toLowerCase();
            }
            if (!level.background) {
                level.background = level.id;
            }
            this.levels.set(level.id, level);
            this.levels.set(index + 1, level);
            this.levels.set(String(index + 1), level);
        });
    }
    
    setLevel(levelId) {
        this.currentLevel = this.getLevelById(levelId);
        if (this.currentLevel) {
            this.applyLevelSettings();
        }
        return this.currentLevel;
    }
    
    getCurrentLevel() {
        return this.currentLevel;
    }

    getLevelByPlanetId(planetId) {
        if (planetId == null) return null;
        const key = String(planetId).toLowerCase().split('-')[0];
        return this.levels.get(key) || null;
    }
    
    getLevelById(levelId) {
        if (levelId == null) return null;

        if (this.levels.has(levelId)) {
            return this.levels.get(levelId);
        }

        const raw = String(levelId).toLowerCase();
        if (this.levels.has(raw)) {
            return this.levels.get(raw);
        }

        const planetKey = raw.split('-')[0];
        if (this.levels.has(planetKey)) {
            return this.levels.get(planetKey);
        }

        const asNum = parseInt(raw, 10);
        if (!Number.isNaN(asNum) && this.levels.has(asNum)) {
            return this.levels.get(asNum);
        }

        return null;
    }
    
    getAllLevels() {
        return this.planetOrder
            .map(id => this.levels.get(id))
            .filter(Boolean);
    }
    
    applyLevelSettings() {
        if (!this.currentLevel) return;
        
        if (typeof game !== 'undefined') {
            game.obstacleSpawnInterval = this.currentLevel.obstacleSpawnInterval;
            
            if (typeof enemyManager !== 'undefined') {
                if (typeof graphicsManager !== 'undefined') {
                    graphicsManager.setEnemyShipType(this.currentLevel.enemyType);
                }
            }
        }
    }
    
    getObstaclePattern() {
        if (!this.currentLevel) return null;
        return this.currentLevel.getObstaclePattern();
    }
    
    getEnvironmentColor() {
        if (!this.currentLevel) return '#808080';
        return this.currentLevel.getEnvironmentColor();
    }
    
    getBackgroundElements() {
        if (!this.currentLevel) return [];
        return this.currentLevel.getBackgroundElements();
    }
    
    getLevelInfo() {
        if (!this.currentLevel) return null;
        return {
            name: this.currentLevel.name,
            difficulty: this.currentLevel.difficulty,
            environment: this.currentLevel.environment,
            color: this.currentLevel.color,
            description: this.currentLevel.description
        };
    }
}

// Global level manager instance
const levelManager = new LevelManager();
