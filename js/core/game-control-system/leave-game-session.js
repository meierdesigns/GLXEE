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
        // The planet just fought on: the map opens with it already selected.
        let foughtPlanet = null;
        try {
            const lvl = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
                ? this.coreLevelManager.getCurrentLevel() : null;
            const pid = lvl && String(lvl.planetId || (lvl.id && String(lvl.id).split('-')[0]) || '').toLowerCase();
            if (pid && pid.indexOf('ambush_') !== 0) foughtPlanet = pid;
        } catch (e) { foughtPlanet = null; }
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
            if (foughtPlanet && typeof galaxyMapManager !== 'undefined') {
                const selectFought = () => {
                    if (galaxyMapManager.nodeById && galaxyMapManager.nodeById[foughtPlanet] && galaxyMapManager.selectPlanet) {
                        galaxyMapManager.selectPlanet(foughtPlanet);
                        if (galaxyMapManager.markUserPicked) galaxyMapManager.markUserPicked();
                        if (galaxyMapManager.frameSelectionCamera) galaxyMapManager.frameSelectionCamera('follow');
                        return true;
                    }
                    return false;
                };
                if (!selectFought()) requestAnimationFrame(selectFought);
            }
            // Ambush lost: show the flight back to the last station.
            if (typeof galaxyMapManager !== 'undefined' && galaxyMapManager._ambushLost
                && galaxyMapManager._postAmbushFlight && galaxyMapManager.retreatAfterAmbush) {
                const f = galaxyMapManager._postAmbushFlight;
                galaxyMapManager._postAmbushFlight = null;
                galaxyMapManager._ambushLost = false;
                galaxyMapManager.retreatAfterAmbush(f);
            }
            // Ambush won: carry on from the fight spot along the route.
            else if (typeof galaxyMapManager !== 'undefined' && galaxyMapManager._postAmbushFlight
                && galaxyMapManager.resumeAfterAmbush) {
                const f = galaxyMapManager._postAmbushFlight;
                galaxyMapManager._postAmbushFlight = null;
                galaxyMapManager.resumeAfterAmbush(f);
            }
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
            const isAmbush = currentLevel
                && String(currentLevel.id || '').toLowerCase().indexOf('ambush_') === 0;
            stageElement.textContent = currentLevel
                ? (isAmbush
                    ? `${currentLevel.planetName || currentLevel.name || 'PIRATE AMBUSH'} — STAGE 1/1`
                    : (currentLevel.name || `${currentLevel.planetName || ''} ${currentLevel.stageLabel || ''}`.trim() || currentLevel.id || ''))
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

    /** Remember an end screen so a page refresh lands on it again (menu-state/restore.js). */
    persistEndScreen(kind, extra) {
        if (typeof menuStateManager === 'undefined') return;
        const stats = this.gameState.getStats ? this.gameState.getStats() : {};
        menuStateManager.setScreen('endscreen', Object.assign({
            endKind: kind,
            levelId: this.getRestartLevelId(),
            endStats: { score: stats.score || 0, levelTime: stats.levelTime || 0, enemiesKilled: stats.enemiesKilled || 0 },
            endLoot: null
        }, extra || {}));
    },

    /**
     * Refresh on a victory / game-over screen: load the level (no match), put the
     * saved numbers back and show the same overlay again. Returns false if impossible.
     */
    restoreEndScreen(s) {
        if (!s || !s.levelId || (s.endKind !== 'victory' && s.endKind !== 'gameover')) return false;
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) gameContainer.style.display = 'flex';
        if (gameContainer) document.documentElement.classList.add('vf-game-shown');
        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.update) window.viewportFit.update();
        if (!this.coreLevelManager.startLevel(s.levelId)) return false;
        const stats = s.endStats || {};
        const lim = this.systemManager.getSubsystem('levelInfoManager');
        if (typeof game !== 'undefined') game.score = stats.score || 0;
        if (lim && lim.stats) {
            lim.stats.score = stats.score || 0;
            lim.stats.levelTime = stats.levelTime || 0;
            lim.stats.enemiesKilled = stats.enemiesKilled || 0;
            lim.stats.startTime = null;
        }
        if (s.endKind === 'victory') {
            this.lastVictoryLoot = s.endLoot || null;
            this.showVictoryOverlay();
        } else {
            const overlay = document.getElementById('gameOver');
            if (!overlay) return false;
            this.applyGameOverFaction(overlay, s.endLoot || {});
            overlay.classList.remove('hidden');
            if (typeof VFGameOverWreck !== 'undefined') VFGameOverWreck.start(overlay);
        }
        return true;
    },
});
