"use strict";

/**
 * Game Control System
 * Handles game flow, level transitions, and game state changes
 */
class GameControlSystem {
    constructor(gameState, coreLevelManager, systemManager) {
        this.gameState = gameState;
        this.coreLevelManager = coreLevelManager;
        this.systemManager = systemManager;
        this.lastVictoryLoot = null;
        this._victoryLootPhase = false;
        this._victoryLootTimer = 0;
        this._victoryLootMinMs = 0;
        this._victoryStageMarked = false;
        this._victoryFinalizing = false;
    }

    // Game flow control
    startGame(levelId = 'mars') {
        this.cancelVictoryLootPhase();

        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('ingame');
        }

        if (typeof soundManager !== 'undefined' && soundManager.stopMenuMusic) {
            soundManager.stopMenuMusic();
        }

        // Always clear pause/settings overlays before combat HUD shows
        this.hideAllOverlays();

        // Hide start screen
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            startScreen.classList.add('hidden');
        }

        // Hide StartScreenManager
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        }

        // Show left HUD cluster (info panel + vitals)
        const leftCluster = document.getElementById('gameLeftCluster');
        if (leftCluster) {
            leftCluster.style.display = '';
        }

        const rightCluster = document.getElementById('gameRightCluster');
        if (rightCluster) {
            rightCluster.style.display = '';
        }

        // Show game container
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.display = 'flex';
        }

        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.update) {
            window.viewportFit.update();
        }

        // Set up the level (applies map size → canvas bitmap = full level)
        if (!this.coreLevelManager.startLevel(levelId)) {
            console.error('Failed to start level:', levelId);
            return false;
        }

        // Re-fit after HUD is visible so the full map stays in frame
        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.update) {
            window.viewportFit.update();
        }

        if (typeof profileManager !== 'undefined' && profileManager.discover) {
            const pid = String(levelId || '').toLowerCase().split('-')[0];
            if (pid) profileManager.discover('planets', pid);
        }

        // Reset game state
        this.gameState.resetStats();
        this.gameState.startGame();
        if (typeof game !== 'undefined') {
            game.score = 0;
        }
        const lim = this.systemManager.getSubsystem('levelInfoManager');
        if (lim && lim.stats) {
            lim.stats.score = 0;
            lim.stats.enemiesKilled = 0;
            lim.stats.levelTime = 0;
            lim.stats.startTime = null;
            lim._timeString = '00:00';
        }

        if (typeof missionStartManager !== 'undefined') {
            missionStartManager.arm();
        }
        if (typeof playerManager !== 'undefined' && playerManager.reset) {
            playerManager.reset();
        }
        if (typeof bulletManager !== 'undefined' && bulletManager.reset) {
            bulletManager.reset();
        }
        if (typeof obstacleManager !== 'undefined' && obstacleManager.reset) {
            obstacleManager.reset();
        }
        if (typeof pickupManager !== 'undefined' && pickupManager.reset) {
            pickupManager.reset(true);
        }
        if (typeof explosionSystem !== 'undefined' && explosionSystem.clear) {
            explosionSystem.clear();
        }

        // Start all systems
        this.systemManager.startAll();

        // Initialize enemy manager, then run FIRE TO START → countdown → fly-in
        if (typeof enemyManager !== 'undefined') {
            enemyManager.init().then(() => {
                if (typeof missionStartManager !== 'undefined') {
                    missionStartManager.begin();
                }
            }).catch(error => {
                console.error('Failed to initialize enemy manager:', error);
                if (typeof missionStartManager !== 'undefined') {
                    missionStartManager.begin();
                }
            });
        } else if (typeof missionStartManager !== 'undefined') {
            missionStartManager.begin();
        }

        // Update level info (timer starts after fly-in via missionStartManager.complete)
        this.updateLevelInfo();

        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.scheduleUpdate) {
            window.viewportFit.scheduleUpdate();
        }

        return true;
    }

    restartGame() {

        // Stop current game
        this.stopGame();

        // Hide victory overlay
        this.hideVictoryOverlay();

        const currentLevel = this.coreLevelManager.getCurrentLevel();
        const levelId = currentLevel
            ? (currentLevel.id || currentLevel.planetId || 'mars-1')
            : 'mars-1';

        return this.startGame(levelId);
    }

    stopGame() {
        this.cancelVictoryLootPhase();

        // Stop all systems
        this.systemManager.stopAll();

        // Stop game state
        this.gameState.stopGame();

        if (typeof missionStartManager !== 'undefined') {
            missionStartManager.cancel();
        }

        // Hide overlays
        this.hideAllOverlays();

    }

    pauseGame() {
        this.gameState.pauseGame();
        this.systemManager.pauseAll();
        this.showPauseOverlay();
    }

    resumeGame() {
        this.gameState.resumeGame();
        this.systemManager.resumeAll();
        this.hidePauseOverlay();
    }

    // Level transitions
    nextLevel() {
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        if (!currentLevel) {
            return false;
        }

        const currentId = currentLevel.id || currentLevel.planetId || currentLevel.background || currentLevel.name;
        const nextLevelId = this.coreLevelManager.getNextLevel(currentId);
        if (!nextLevelId) {
            this.showLevelSelection();
            return false;
        }

        this.hideVictoryOverlay();
        return this.startGame(nextLevelId);
    }

    previousLevel() {
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        if (!currentLevel) return false;

        const prevLevelId = this.coreLevelManager.getPreviousLevel(currentLevel.id);
        if (!prevLevelId) {
            return false;
        }

        return this.startGame(prevLevelId);
    }

    // Game over handling
    gameOver() {

        this.gameState.stopGame();
        this.showGameOverOverlay();

        // Hide level info panel
        const levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        if (levelInfoManager) {
            levelInfoManager.endLevel();
        }

        // Play game over sound
        if (typeof soundManager !== 'undefined') {
            if (soundManager.stopPlanetAmbient) soundManager.stopPlanetAmbient();
            soundManager.playGameOver();
        }
    }

    playerWins() {
        if (this._victoryLootPhase || this._victoryFinalizing) return;
        this.beginVictoryLootPhase();
    }

    cancelVictoryLootPhase() {
        this._victoryLootPhase = false;
        this._victoryLootTimer = 0;
        this._victoryLootMinMs = 0;
        this._victoryStageMarked = false;
        this._victoryFinalizing = false;
        if (typeof pickupManager !== 'undefined' && pickupManager.endLootPhase) {
            pickupManager.endLootPhase();
        }
        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = false;
        }
    }
}
