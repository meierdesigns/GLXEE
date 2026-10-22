"use strict";

// Game loop and timing management
class GameLoop {
    constructor(gameState, systemManager = null) {
        this.gameState = gameState;
        this.systemManager = systemManager;
        this.lastTime = 0;
        this.frameCount = 0;
        this.gameRunning = true;
    }

    start() {
        this.lastTime = 0;
        this.frameCount = 0;
        if (this._parkTimer) { clearTimeout(this._parkTimer); this._parkTimer = 0; }
        // Do not force gameRunning here — startGame() owns that flag. Boot must
        // leave the loop idle so menus are not fighting a combat RAF.
        if (!this.gameState.gameRunning) return;
        this.loop(performance.now());
    }

    stop() {
        this.gameState.gameRunning = false;
        if (this._parkTimer) { clearTimeout(this._parkTimer); this._parkTimer = 0; }
    }

    /** True only while the fight screen is the active surface. */
    isCombatSurfaceActive() {
        try {
            if (typeof document === 'undefined') return true;
            if (!document.documentElement.classList.contains('vf-game-shown')) return false;
            if (typeof startScreenManager !== 'undefined' && startScreenManager.isVisible
                && startScreenManager.isVisible()) return false;
            const gc = document.querySelector('.game-container');
            if (gc && gc.style && gc.style.display === 'none') return false;
            return true;
        } catch (e) {
            return true;
        }
    }

    loop(currentTime) {
        if (!this.gameState.gameRunning) return;

        // Tab in background: keep the RAF chain alive but skip sim/draw so we
        // don't burn CPU. Quality is unchanged when the tab is visible again.
        if (typeof document !== 'undefined' && document.hidden) {
            this.lastTime = 0;
            requestAnimationFrame((time) => this.loop(time));
            return;
        }

        // Menu / station / overlays: park the combat RAF until a fight starts.
        // Poll slowly instead of a empty 60 Hz RAF chain.
        if (!this.isCombatSurfaceActive()) {
            this.lastTime = 0;
            if (this._parkTimer) clearTimeout(this._parkTimer);
            this._parkTimer = setTimeout(() => {
                this._parkTimer = 0;
                if (this.gameState.gameRunning) {
                    requestAnimationFrame((time) => this.loop(time));
                }
            }, 250);
            return;
        }
        
        // Fix initial deltaTime spike on first frame
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
        }
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Fix zero and negative deltaTime issues - ignore negative values completely
        let safeDeltaTime;
        if (deltaTime < 0) {
            // Skip this frame if deltaTime is negative
            requestAnimationFrame((time) => this.loop(time));
            return;
        } else {
            safeDeltaTime = Math.max(deltaTime, 0.1); // Minimum 0.1ms to prevent division by zero
        }
        
        // Cap deltaTime to prevent extreme speed on first frame or lag spikes
        const cappedDeltaTime = Math.min(safeDeltaTime, 50); // Max 50ms = 20 FPS minimum
        
        this.update(cappedDeltaTime);
        // Paused: keep the last frame; the pause overlay is CSS on top. While the remote control is open the
        // field is frozen by it, but still repainted so slider changes (sizes, effects) show up live.
        const fxScope = (typeof window !== 'undefined' && window.vfFitScope) ? window.vfFitScope.vfs : null;
        if (!this.gameState.isPaused || (fxScope && fxScope.fxOpen)) this.render();
        
        // Only continue loop if game is still running
        if (this.gameState.gameRunning) {
            requestAnimationFrame((time) => this.loop(time));
        }
    }

    update(deltaTime) {
        this.frameCount++;
        
        // Update start screen first
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.update(deltaTime);
            if (startScreenManager.isVisible()) {
                return; // Don't update game if start screen is visible
            }
        }
        
        // Increment frame count
        this.gameState.frameCount++;
        
        // Don't update game logic if paused or game over
        if (this.gameState.isPaused || !this.gameState.gameRunning) {
            // Still update UI even when paused
            if (typeof uiManager !== 'undefined') uiManager.updateUI();
            return;
        }

        const introActive = typeof missionStartManager !== 'undefined' && missionStartManager.isActive();
        if (introActive) {
            missionStartManager.update(deltaTime);
            if (typeof objectiveManager !== 'undefined' && objectiveManager.updateArrivalIntro) {
                objectiveManager.updateArrivalIntro(deltaTime, missionStartManager.phase);
            }
            if (typeof parallaxManager !== 'undefined') parallaxManager.update(deltaTime);
            if (typeof graphicsManager !== 'undefined') graphicsManager.updateParticles();
            if (typeof explosionSystem !== 'undefined') explosionSystem.update(16);
            if (typeof uiManager !== 'undefined') uiManager.updateUI();
            return;
        }
        
        if (typeof playerManager !== 'undefined') {
            const inputHandler = this.systemManager ? this.systemManager.getSubsystem('inputHandler') : null;
            if (inputHandler) {
                playerManager.update(inputHandler.keys, deltaTime);
            }
        }
        if (typeof beatSyncManager !== 'undefined') {
            beatSyncManager.update(deltaTime);
        }

        const gameControl = (typeof game !== 'undefined' && game.gameControl)
            ? game.gameControl
            : ((typeof gameCore !== 'undefined' && gameCore.gameControl) ? gameCore.gameControl : null);
        const lootPhase = !!(gameControl && gameControl._victoryLootPhase);
        if (lootPhase) {
            // Keep in-flight shots / obstacles moving during loot scoop / flee cleanup.
            // No keys: held fire buttons must not keep shooting after the win.
            if (typeof bulletManager !== 'undefined') {
                bulletManager.update(deltaTime, null);
            }
            if (typeof obstacleManager !== 'undefined') obstacleManager.update(deltaTime, this.gameState);
            if (typeof enemyManager !== 'undefined'
                && enemyManager.sideEnemies
                && enemyManager.sideEnemies.length
                && enemyManager.updateSideEnemies) {
                enemyManager.updateSideEnemies(deltaTime, this.gameState);
            }
            if (typeof pickupManager !== 'undefined') pickupManager.update(deltaTime);
            if (typeof parallaxManager !== 'undefined') parallaxManager.update(deltaTime);
            if (typeof graphicsManager !== 'undefined') graphicsManager.updateParticles();
            if (typeof explosionSystem !== 'undefined') explosionSystem.update(deltaTime || 16);
            if (gameControl.updateVictoryLootPhase) gameControl.updateVictoryLootPhase(deltaTime);
            if (typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.snapWorld) {
                window.combatVoxels.snapWorld();
            }
            if (typeof uiManager !== 'undefined') uiManager.updateUI();
            return;
        }

        if (typeof bulletManager !== 'undefined') {
            const inputHandler = this.systemManager ? this.systemManager.getSubsystem('inputHandler') : null;
            const keys = inputHandler ? inputHandler.keys : null;
            bulletManager.update(deltaTime, keys);
        }
        if (typeof enemyManager !== 'undefined') enemyManager.update(deltaTime, this.gameState);
        if (typeof missionStartManager !== 'undefined' && missionStartManager.updateEnemyEntry) {
            missionStartManager.updateEnemyEntry(deltaTime);
        }
        if (typeof obstacleManager !== 'undefined') obstacleManager.update(deltaTime, this.gameState);
        if (typeof pickupManager !== 'undefined') pickupManager.update(deltaTime);
        if (typeof collisionManager !== 'undefined') collisionManager.checkCollisions(this.gameState);
        if (typeof parallaxManager !== 'undefined') parallaxManager.update(deltaTime);
        if (typeof graphicsManager !== 'undefined') graphicsManager.updateParticles();
        if (typeof explosionSystem !== 'undefined') explosionSystem.update(deltaTime || 16);

        // VOXEL: lock every combat element to the Game-Boy lattice after physics.
        if (typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.snapWorld) {
            window.combatVoxels.snapWorld();
        }
        
        // Always update UI, even when paused
        if (typeof uiManager !== 'undefined') uiManager.updateUI();
    }

    render() {
        // Don't render if game is not running or the fight screen is hidden.
        if (!this.gameState.gameRunning) return;
        if (!this.isCombatSurfaceActive()) return;
        
        if (typeof renderManager !== 'undefined') renderManager.render();
    }
}
