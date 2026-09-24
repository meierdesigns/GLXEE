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

    beginVictoryLootPhase() {
        const grace = (typeof economyConfig !== 'undefined' && economyConfig.getVictoryLootGraceMs)
            ? economyConfig.getVictoryLootGraceMs()
            : 10000;
        this._victoryLootPhase = true;
        this._victoryLootTimer = grace;
        this._victoryLootMinMs = Math.min(2500, grace * 0.25);
        this.lastVictoryLoot = null;

        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = true;
        }
        if (typeof pickupManager !== 'undefined' && pickupManager.beginLootPhase) {
            pickupManager.beginLootPhase(grace + 3000);
        }
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            const secs = Math.ceil(grace / 1000);
            levelInfoManager.showLootNotice('COLLECT RESOURCES — ' + secs + 's');
        }

        // Mark stage cleared early so progress is safe if the tab closes mid-loot
        try {
            const currentLevel = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
                ? this.coreLevelManager.getCurrentLevel()
                : null;
            if (currentLevel && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
                const planetId = currentLevel.planetId
                    || (currentLevel.id && String(currentLevel.id).split('-')[0])
                    || null;
                const stageKey = currentLevel.stageKey
                    || (currentLevel.isBoss ? 'boss' : String(currentLevel.stageIndex || 1));
                if (planetId) {
                    profileManager.markStageCleared(planetId, stageKey);
                    if (profileManager.discover) profileManager.discover('planets', planetId);
                    this._victoryStageMarked = true;
                    profileManager.save();
                }
            }
        } catch (e) {
            console.warn('Progress save failed', e);
        }
    }

    updateVictoryLootPhase(deltaTime) {
        if (!this._victoryLootPhase) return;
        const dt = Math.max(0, Number(deltaTime) || 0);
        this._victoryLootTimer -= dt;
        this._victoryLootMinMs -= dt;

        const remaining = Math.max(0, this._victoryLootTimer);
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice
            && Math.floor(remaining / 1000) !== Math.floor((remaining + dt) / 1000)) {
            const secs = Math.ceil(remaining / 1000);
            if (secs > 0) {
                levelInfoManager.showLootNotice('COLLECT RESOURCES — ' + secs + 's');
            }
        }

        const noPickups = !(typeof pickupManager !== 'undefined' && pickupManager.pickups
            && pickupManager.pickups.length > 0);
        const enemiesClear = !(typeof enemyManager !== 'undefined' && enemyManager.isFieldClear)
            || enemyManager.isFieldClear();
        const minElapsed = this._victoryLootMinMs <= 0;

        // Finish only when enemies are gone and all resources are collected
        if (noPickups && enemiesClear && minElapsed) {
            this.finalizeVictory();
            return;
        }

        // Keep scooping if the timer ran out but loot remains
        if (this._victoryLootTimer <= 0 && !noPickups) {
            this._victoryLootTimer = 8000;
            if (typeof pickupManager !== 'undefined' && pickupManager.beginLootPhase) {
                pickupManager.beginLootPhase(8000);
            }
            if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                levelInfoManager.showLootNotice('COLLECT REMAINING RESOURCES');
            }
        }
    }

    finalizeVictory() {
        if (this._victoryFinalizing) return;
        this._victoryFinalizing = true;
        this._victoryLootPhase = false;
        this._victoryLootTimer = 0;

        if (typeof pickupManager !== 'undefined' && pickupManager.endLootPhase) {
            pickupManager.endLootPhase();
        }
        if (typeof enemyManager !== 'undefined') {
            enemyManager.spawnFrozen = false;
        }

        this.gameState.stopGame();
        this.lastVictoryLoot = null;

        try {
            const currentLevel = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
                ? this.coreLevelManager.getCurrentLevel()
                : null;
            if (currentLevel && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
                const planetId = currentLevel.planetId
                    || (currentLevel.id && String(currentLevel.id).split('-')[0])
                    || null;
                const stageKey = currentLevel.stageKey
                    || (currentLevel.isBoss ? 'boss' : String(currentLevel.stageIndex || 1));
                if (planetId) {
                    if (!this._victoryStageMarked) {
                        profileManager.markStageCleared(planetId, stageKey);
                        if (profileManager.discover) {
                            profileManager.discover('planets', planetId);
                        }
                    }
                    if (typeof pickupManager !== 'undefined' && pickupManager.collectAll) {
                        pickupManager.collectAll();
                        const granted = pickupManager.getCollectedThisRun
                            ? pickupManager.getCollectedThisRun()
                            : null;
                        this.lastVictoryLoot = granted && Object.keys(granted).length ? granted : null;
                        if (granted && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                            const parts = Object.keys(granted).map((id) => {
                                const label = (typeof economyConfig !== 'undefined')
                                    ? economyConfig.getResourceLabel(id)
                                    : id.toUpperCase();
                                return granted[id] + ' ' + label;
                            });
                            if (parts.length) {
                                levelInfoManager.showLootNotice('LOOT: ' + parts.join(', '));
                            }
                        }
                    } else if (profileManager.grantPlanetResources) {
                        const granted = profileManager.grantPlanetResources(planetId);
                        this.lastVictoryLoot = granted && Object.keys(granted).length ? granted : null;
                    }
                    if (profileManager.teleportCargoToStation) {
                        profileManager.teleportCargoToStation();
                    }
                    profileManager.save();
                    try {
                        if (typeof factionManager !== 'undefined' && factionManager.recordMissionVictory) {
                            factionManager.recordMissionVictory(planetId);
                        }
                    } catch (factionErr) {
                        console.warn('Faction victory record failed', factionErr);
                    }
                }
            }
        } catch (e) {
            console.warn('Progress save failed', e);
        }

        this._victoryStageMarked = false;
        this._victoryFinalizing = false;
        this.showVictoryOverlay();

        if (typeof soundManager !== 'undefined') {
            if (soundManager.stopPlanetAmbient) soundManager.stopPlanetAmbient();
            soundManager.playVictory();
        }
    }

    // UI overlay management
    showPauseOverlay() {
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) {
            pauseOverlay.classList.remove('hidden');
        }
        if (typeof uiManager !== 'undefined') {
            uiManager.pauseMenuIndex = 0;
            uiManager.updatePauseMenuDisplay();
        }
    }

    hidePauseOverlay() {
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) {
            pauseOverlay.classList.add('hidden');
        }
    }

    showGameOverOverlay() {
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay) {
            gameOverOverlay.classList.remove('hidden');
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
        }
    }

    hideGameOverOverlay() {
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
    }

    showVictoryOverlay() {
        // Hide start screen to prevent input conflicts
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        }
        
        // Hide side HUD clusters
        const leftCluster = document.getElementById('gameLeftCluster');
        if (leftCluster) {
            leftCluster.style.display = 'none';
        }

        const rightCluster = document.getElementById('gameRightCluster');
        if (rightCluster) {
            rightCluster.style.display = 'none';
        }
        
        // Create / refresh victory overlay layout
        let victoryOverlay = document.getElementById('victoryOverlay');
        const needsBuild = !victoryOverlay || !document.getElementById('victoryLootList');
        if (!victoryOverlay) {
            victoryOverlay = document.createElement('div');
            victoryOverlay.id = 'victoryOverlay';
            victoryOverlay.className = 'victory-screen';
            document.body.appendChild(victoryOverlay);
        }
        if (needsBuild) {
            victoryOverlay.innerHTML = `
                <div class="victory-content">
                    <div class="victory-header">
                        <h1 class="victory-title">VICTORY!</h1>
                        <p class="victory-subtitle">Mission Accomplished</p>
                        <p class="victory-stage" id="victoryStage"></p>
                    </div>

                    <div class="victory-stats">
                        <div class="stat-item">
                            <span class="stat-label">SCORE</span>
                            <span class="stat-value" id="victoryScore">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">TIME</span>
                            <span class="stat-value" id="victoryTime">00:00</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">ENEMIES</span>
                            <span class="stat-value" id="victoryEnemies">0</span>
                        </div>
                    </div>

                    <div class="victory-body">
                        <div class="victory-loot" id="victoryLoot">
                            <div class="victory-loot-title">RESOURCES ACQUIRED</div>
                            <div class="victory-loot-list" id="victoryLootList"></div>
                        </div>

                        <div class="victory-buttons">
                            <button class="victory-button" data-index="0" id="victoryNextButton">
                                <span class="button-icon" data-icon="menuStart"></span>
                                <span class="button-text">NEXT STAGE</span>
                            </button>
                            <button class="victory-button" data-index="1">
                                <span class="button-icon" data-icon="menuRetry"></span>
                                <span class="button-text">PLAY AGAIN</span>
                            </button>
                            <button class="victory-button" data-index="2">
                                <span class="button-icon" data-icon="menuPlanets"></span>
                                <span class="button-text">PLANET SELECT</span>
                            </button>
                        </div>
                    </div>

                    <div class="victory-instructions">
                        <p>ARROW KEYS: Navigate | ENTER: Select</p>
                    </div>
                </div>
            `;
            victoryOverlay.dataset.bound = '';
        }
        victoryOverlay.classList.remove('hidden');
        this.applyVictoryPixelIcons(victoryOverlay);

        if (!victoryOverlay.dataset.bound) {
            this.bindVictoryButtons(victoryOverlay);
            victoryOverlay.dataset.bound = '1';
        }

        this.updateVictoryNextButton();

        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuIndex = 0;
            uiManager.updateVictoryMenuDisplay();
        }

        this.updateVictoryStats();

        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
    }

    victoryResourceIconKey(id) {
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceIconKey) {
            return economyConfig.getResourceIconKey(id);
        }
        const map = {
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        return map[id] || 'resScrap';
    }

    renderVictoryLootHtml(loot) {
        const entries = loot
            ? Object.keys(loot).filter((id) => (loot[id] || 0) > 0)
            : [];
        if (!entries.length) {
            return '<div class="victory-loot-empty">NO RESOURCES THIS RUN</div>';
        }
        return entries.map((id) => {
            const amount = loot[id] || 0;
            const label = (typeof economyConfig !== 'undefined')
                ? economyConfig.getResourceLabel(id)
                : String(id).toUpperCase();
            const iconKey = this.victoryResourceIconKey(id);
            const tint = (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor)
                ? economyConfig.getResourceColor(id)
                : undefined;
            const iconHtml = (typeof iconRenderer !== 'undefined')
                ? iconRenderer.imgHtml(iconKey, 28, 'victory-loot-pixel', tint)
                : '';
            const color = tint || '#ccc';
            return `<div class="victory-loot-row victory-loot-${id}" style="--victory-res-color:${color}">` +
                `<span class="victory-loot-icon">${iconHtml}</span>` +
                `<span class="victory-loot-label">${label}</span>` +
                `<span class="victory-loot-amount">+${amount}</span>` +
                `</div>`;
        }).join('');
    }

    applyVictoryPixelIcons(victoryOverlay) {
        if (!victoryOverlay) return;
        const defaults = {
            '0': 'menuStart',
            '1': 'menuRetry',
            '2': 'menuPlanets'
        };
        victoryOverlay.querySelectorAll('.victory-button').forEach((button) => {
            let iconEl = button.querySelector('.button-icon');
            if (!iconEl) {
                iconEl = document.createElement('span');
                iconEl.className = 'button-icon';
                button.insertBefore(iconEl, button.firstChild);
            }
            const key = iconEl.dataset.icon || defaults[button.dataset.index];
            if (!key) return;
            iconEl.dataset.icon = key;
            if (typeof iconRenderer !== 'undefined') {
                iconEl.innerHTML = iconRenderer.imgHtml(key, 20, 'victory-pixel-icon');
            }
        });
    }

    updateVictoryNextButton() {
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        const currentId = currentLevel
            ? (currentLevel.id || currentLevel.planetId || currentLevel.background)
            : null;
        const meta = currentId && typeof this.coreLevelManager.getNextLevelMeta === 'function'
            ? this.coreLevelManager.getNextLevelMeta(currentId)
            : null;

        const button = document.querySelector('#victoryOverlay .victory-button[data-index="0"] .button-text')
            || document.querySelector('#victoryNextButton .button-text');
        if (button) {
            button.textContent = meta ? meta.label : 'CAMPAIGN COMPLETE';
        }

        const nextBtn = document.querySelector('#victoryOverlay .victory-button[data-index="0"]');
        if (nextBtn) {
            nextBtn.disabled = !meta;
            nextBtn.classList.toggle('disabled', !meta);
        }
    }

    bindVictoryButtons(victoryOverlay) {
        const buttons = victoryOverlay.querySelectorAll('.victory-button');
        buttons.forEach((button) => {
            button.addEventListener('mouseenter', () => {
                const index = parseInt(button.dataset.index, 10);
                if (typeof uiManager !== 'undefined' && !Number.isNaN(index)) {
                    uiManager.victoryMenuIndex = index;
                    uiManager.updateVictoryMenuDisplay();
                }
            });
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const index = parseInt(button.dataset.index, 10);
                if (typeof uiManager !== 'undefined' && !Number.isNaN(index)) {
                    uiManager.victoryMenuIndex = index;
                    uiManager.updateVictoryMenuDisplay();
                    uiManager.selectVictoryOption();
                }
            });
        });
    }

    hideVictoryOverlay() {
        const victoryOverlay = document.getElementById('victoryOverlay');
        if (victoryOverlay) {
            victoryOverlay.classList.add('hidden');
        }
        
        // Show side HUD clusters again
        const leftCluster = document.getElementById('gameLeftCluster');
        if (leftCluster) {
            leftCluster.style.display = '';
        }

        const rightCluster = document.getElementById('gameRightCluster');
        if (rightCluster) {
            rightCluster.style.display = '';
        }
    }

    hideAllOverlays() {
        this.hidePauseOverlay();
        this.hideGameOverOverlay();
        this.hideVictoryOverlay();
        
        // Hide settings overlay
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    }

    // Level info management
    updateLevelInfo() {
        const levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        if (levelInfoManager) {
            const levelData = levelInfoManager.collectLevelData();
            levelInfoManager.updateLevelData(levelData);
            // Always paint the info panel when combat HUD is up. Only the
            // combat clock waits for FIRE TO START → fly-in to finish.
            if (typeof missionStartManager !== 'undefined' && missionStartManager.isActive()) {
                if (typeof levelInfoManager.prepareForCombat === 'function') {
                    levelInfoManager.prepareForCombat();
                } else {
                    levelInfoManager.showPanel();
                    levelInfoManager.updateDisplay();
                }
            } else {
                levelInfoManager.startLevel();
            }
        } else {
            console.warn('LevelInfoManager not available for update');
        }
    }

    updateLevelStats(stats) {
        const levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        if (levelInfoManager) {
            levelInfoManager.updateStats(stats);
        }
    }

    leaveGameSession() {
        this.stopGame();
        this.hideAllOverlays();
        if (typeof soundManager !== 'undefined') {
            if (soundManager.stopPlanetAmbient) soundManager.stopPlanetAmbient();
            if (soundManager.ambientPlanetId != null) soundManager.ambientPlanetId = null;
        }

        if (typeof planetEditorUI !== 'undefined' && planetEditorUI.visible) {
            planetEditorUI.returnTo = null;
            planetEditorUI.hide();
        }
        if (typeof enemyEditorUI !== 'undefined' && enemyEditorUI.visible) {
            enemyEditorUI.returnTo = null;
            enemyEditorUI.hide();
        }
        if (typeof shipEditorUI !== 'undefined' && shipEditorUI.visible) {
            shipEditorUI.returnTo = null;
            shipEditorUI.hide();
        }
        if (typeof planetViewerUI !== 'undefined' && planetViewerUI.visible) {
            planetViewerUI.hide();
        }
        if (typeof enemyViewerUI !== 'undefined' && enemyViewerUI.visible) {
            enemyViewerUI.hide();
        }
        if (typeof shipViewerUI !== 'undefined' && shipViewerUI.visible) {
            shipViewerUI.hide();
        }
        if (typeof abilityViewerUI !== 'undefined' && abilityViewerUI.visible) {
            abilityViewerUI.hide();
        }
        if (typeof weaponViewerUI !== 'undefined' && weaponViewerUI.visible) {
            weaponViewerUI.hide();
        }
        if (typeof defenseViewerUI !== 'undefined' && defenseViewerUI.visible) {
            defenseViewerUI.hide();
        }
        if (typeof factionViewerUI !== 'undefined' && factionViewerUI.visible) {
            factionViewerUI.hide();
        }
        if (typeof abilityEditorUI !== 'undefined' && abilityEditorUI.visible) {
            abilityEditorUI.returnTo = null;
            abilityEditorUI.hide();
        }

        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
        }

        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        const leftCluster = document.getElementById('gameLeftCluster');
        if (leftCluster) {
            leftCluster.style.display = 'none';
        }

        const rightCluster = document.getElementById('gameRightCluster');
        if (rightCluster) {
            rightCluster.style.display = 'none';
        }
    }

    // Level selection (planet map) — default exit after a run
    showLevelSelection() {
        this.leaveGameSession();

        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        }
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            startScreen.classList.add('hidden');
        }

        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'play',
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') {
                        startScreenManager.returnToHub();
                    }
                }
            });
        } else if (typeof combinedSelectionManager !== 'undefined') {
            combinedSelectionManager.show();
        } else if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.show();
        }
    }

    // Main menu
    quitToMainMenu() {
        this.leaveGameSession();

        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            startScreen.classList.add('hidden');
        }

        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.returnToHub({ tab: 'play' });
        }

        if (typeof menuStateManager !== 'undefined') {
            if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
                menuStateManager.setScreen('home-station', { tab: 'play' });
            } else {
                menuStateManager.setScreen('start');
            }
        }
    }

    syncVictoryStatsFromLiveSources() {
        const lim = this.systemManager.getSubsystem('levelInfoManager')
            || (typeof levelInfoManager !== 'undefined' ? levelInfoManager : null);
        const liveScore = (typeof game !== 'undefined' && typeof game.score === 'number')
            ? game.score
            : (lim && lim.stats ? lim.stats.score : 0);
        let levelTime = 0;
        let enemiesKilled = 0;
        if (lim && lim.stats) {
            if (lim.stats.startTime) {
                lim.stats.levelTime = Math.floor((Date.now() - lim.stats.startTime) / 1000);
            }
            levelTime = lim.stats.levelTime || 0;
            enemiesKilled = lim.stats.enemiesKilled || 0;
            lim.stats.score = liveScore;
        }
        this.gameState.updateStats({
            score: liveScore || 0,
            levelTime: levelTime,
            enemiesKilled: enemiesKilled
        });
        return this.gameState.getStats();
    }

    updateVictoryStats() {
        const stageElement = document.getElementById('victoryStage');
        if (stageElement) {
            const currentLevel = this.coreLevelManager.getCurrentLevel();
            stageElement.textContent = currentLevel
                ? (currentLevel.name || `${currentLevel.planetName || ''} ${currentLevel.stageLabel || ''}`.trim() || currentLevel.id || '')
                : '';
        }

        const stats = this.syncVictoryStatsFromLiveSources();

        const scoreElement = document.getElementById('victoryScore');
        if (scoreElement) {
            scoreElement.textContent = String(stats.score || 0);
        }

        const timeElement = document.getElementById('victoryTime');
        if (timeElement) {
            const levelTime = stats.levelTime || 0;
            const minutes = Math.floor(levelTime / 60);
            const seconds = levelTime % 60;
            timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        const enemiesElement = document.getElementById('victoryEnemies');
        if (enemiesElement) {
            enemiesElement.textContent = String(stats.enemiesKilled || 0);
        }

        const lootList = document.getElementById('victoryLootList');
        if (lootList) {
            lootList.innerHTML = this.renderVictoryLootHtml(this.lastVictoryLoot);
        }
    }
}
