"use strict";

// GameControlSystem methods, split from game-control-system.js.
extendClass(GameControlSystem, {
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
    },

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
    },

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
    },

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
    },

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
    },
});
