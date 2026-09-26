"use strict";

// GameControlSystem methods, split from game-control-system.js.
extendClass(GameControlSystem, {
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
    },

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
    },

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
    },

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
    },

    hidePauseOverlay() {
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) {
            pauseOverlay.classList.add('hidden');
        }
    },

    showGameOverOverlay() {
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay) {
            const lost = (typeof pickupManager !== 'undefined' && pickupManager.forfeitRun)
                ? pickupManager.forfeitRun()
                : {};
            this.applyGameOverFaction(gameOverOverlay, lost);
            gameOverOverlay.classList.remove('hidden');
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
        }
    },

    /** Faction wording + lost-resources list on the death screen. */
    applyGameOverFaction(overlay, lost) {
        const faction = String(document.documentElement.dataset.faction || 'terran').toLowerCase();
        const lines = {
            terran: ['GAME OVER', 'Mission Failed'],
            kronax: ['DISHONOR', 'The blade was broken'],
            voidborn: ['DISSOLVED', 'The void reclaims you'],
            pirate: ['SUNK', 'Ship scuttled, loot lost'],
            machine: ['SYSTEM FAILURE', 'Unit terminated']
        };
        const pick = lines[faction] || lines.terran;
        const content = overlay.querySelector('.game-over-content');
        if (!content) return;
        const h = content.querySelector('h2');
        const p = content.querySelector('p');
        if (h) h.textContent = pick[0];
        if (p) p.textContent = pick[1];
        let box = content.querySelector('.game-over-loss');
        if (!box) {
            box = document.createElement('div');
            box.className = 'victory-loot game-over-loss';
            const buttons = content.querySelector('.game-over-buttons');
            content.insertBefore(box, buttons);
        }
        const ids = Object.keys(lost || {}).filter((id) => lost[id] > 0);
        let rows = '<div class="victory-loot-empty">NOTHING LOST</div>';
        if (ids.length && this.renderVictoryLootHtml) {
            rows = this.renderVictoryLootHtml(lost).replace(/>\+(\d+)</g, '>−$1<');
        }
        box.innerHTML = '<div class="victory-loot-title">RESOURCES LOST</div>' +
            `<div class="victory-loot-list">${rows}</div>`;
    },

    hideGameOverOverlay() {
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
    },
});
