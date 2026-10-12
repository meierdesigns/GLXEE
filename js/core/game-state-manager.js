"use strict";

/**
 * Game State Manager
 * Handles core game state and configuration
 */
class GameStateManager {
    constructor() {
        this.width = 240;
        this.height = 300;
        this.gameRunning = true;
        this.isPaused = false;
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnInterval = 3000; // Default speed matching level settings
        this.frameCount = 0;
        
        // Game statistics
        this.stats = {
            score: 0,
            enemiesKilled: 0,
            levelStartTime: null,
            levelTime: 0
        };
        
        // Current level data
        this.currentLevel = null;
        this.currentPlanet = null;
    }

    // Game state control
    startGame() {
        this.gameRunning = true;
        this.isPaused = false;
        this.stats.levelStartTime = Date.now();
    }

    pauseGame() {
        this.isPaused = true;
    }

    resumeGame() {
        this.isPaused = false;
    }

    stopGame() {
        this.gameRunning = false;
        this.isPaused = false;
    }

    // Level management
    setLevel(level) {
        this.currentLevel = level;
        this.currentPlanet = level.id;
    }

    getCurrentLevel() {
        return this.currentLevel;
    }

    getCurrentPlanet() {
        return this.currentPlanet;
    }

    // Statistics management
    updateStats(newStats) {
        this.stats = { ...this.stats, ...newStats };
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = {
            score: 0,
            enemiesKilled: 0,
            levelStartTime: null,
            levelTime: 0
        };
    }

    // Obstacle spawn management
    updateObstacleSpawnTimer(deltaTime) {
        this.obstacleSpawnTimer += deltaTime;
    }

    shouldSpawnObstacle() {
        return this.obstacleSpawnTimer >= this.obstacleSpawnInterval;
    }

    resetObstacleSpawnTimer() {
        this.obstacleSpawnTimer = 0;
    }

    setObstacleSpawnInterval(interval) {
        this.obstacleSpawnInterval = interval;
    }

    // Game configuration
    setGameDimensions(width, height) {
        this.width = width;
        this.height = height;
    }

    getGameDimensions() {
        return { width: this.width, height: this.height };
    }
}
