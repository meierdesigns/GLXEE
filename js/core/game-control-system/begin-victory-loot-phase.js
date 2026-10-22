"use strict";

// GameControlSystem methods, split from game-control-system.js.
extendClass(GameControlSystem, {
    beginVictoryLootPhase() {
        let grace = (typeof economyConfig !== 'undefined' && economyConfig.getVictoryLootGraceMs)
            ? economyConfig.getVictoryLootGraceMs()
            : 10000;
        // Boss: slightly longer safety net only — victory ends as soon as the
        // field is clear (map-wide vacuum pulls remaining drops in).
        const lvl = this.coreLevelManager && this.coreLevelManager.getCurrentLevel
            ? this.coreLevelManager.getCurrentLevel() : null;
        if (lvl && lvl.isBoss) grace = Math.max(grace, 12000);
        this._victoryLootPhase = true;
        this._victoryLootTimer = grace;
        this._victoryLootElapsed = 0;
        this._victoryLootMinMs = 280;
        this._victoryLootLastCount = -1;
        this._victoryLootIdleMs = 0;
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
                    // Active mission on this planet: pay its bounty.
                    const paid = profileManager.completeMissionFor
                        ? profileManager.completeMissionFor(planetId) : null;
                    if (paid && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                        levelInfoManager.showLootNotice('MISSION COMPLETE — BOUNTY PAID');
                    }
                    if (profileManager.discover) profileManager.discover('planets', planetId);
                    this._victoryStageMarked = true;
                    profileManager.save();
                }
            }
        } catch (e) {
            console.warn('Progress save failed', e);
        }

        // Ship already inside the sluice: it cannot scoop anything, so bank the rest and go straight to the win screen.
        if (typeof objectiveManager !== 'undefined' && objectiveManager.enter) {
            this.finalizeVictory();
        }
    },

    updateVictoryLootPhase(deltaTime) {
        if (!this._victoryLootPhase) return;
        const dt = Math.max(0, Number(deltaTime) || 0);
        this._victoryLootTimer -= dt;
        this._victoryLootMinMs -= dt;
        this._victoryLootElapsed = (this._victoryLootElapsed || 0) + dt;

        const remaining = Math.max(0, this._victoryLootTimer);
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice
            && Math.floor(remaining / 1000) !== Math.floor((remaining + dt) / 1000)) {
            const secs = Math.ceil(remaining / 1000);
            if (secs > 0) {
                levelInfoManager.showLootNotice('COLLECT RESOURCES — ' + secs + 's');
            }
        }

        let resourceCount = 0;
        if (typeof pickupManager !== 'undefined' && pickupManager.pickups) {
            for (let i = 0; i < pickupManager.pickups.length; i++) {
                if (!pickupManager.pickups[i].powerUp) resourceCount++;
            }
        }
        const noPickups = resourceCount === 0;
        const minElapsed = this._victoryLootMinMs <= 0;

        // If the count has not dropped for a bit, bank leftovers and finish —
        // stranded / cargo-capped drops must not hold the victory screen.
        if (resourceCount === this._victoryLootLastCount) {
            this._victoryLootIdleMs = (this._victoryLootIdleMs || 0) + dt;
        } else {
            this._victoryLootIdleMs = 0;
            this._victoryLootLastCount = resourceCount;
        }
        if (!noPickups && this._victoryLootElapsed >= 900 && this._victoryLootIdleMs >= 700) {
            if (typeof pickupManager !== 'undefined' && pickupManager.collectAll) {
                // Only vacuum resources; leave power-ups alone.
                for (let i = pickupManager.pickups.length - 1; i >= 0; i--) {
                    const p = pickupManager.pickups[i];
                    if (p.powerUp) continue;
                    pickupManager.collectOne(p);
                    pickupManager.pickups.splice(i, 1);
                }
            }
            this.finalizeVictory();
            return;
        }

        // Done as soon as the field is clear (tiny min delay for juice).
        // Timer is only a hard safety net.
        if ((noPickups && minElapsed) || this._victoryLootTimer <= 0) {
            this.finalizeVictory();
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
                        if (currentLevel.isBoss
                            && typeof factionManager !== 'undefined'
                            && factionManager.recordMissionVictory) {
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
            if (typeof VFGameOverWreck !== 'undefined') VFGameOverWreck.start(gameOverOverlay);
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
            this.persistEndScreen('gameover', { endLoot: lost || {} });
        }
    },

    /** Faction wording + lost-resources list on the death screen. */
    applyGameOverFaction(overlay, lost) {
        const faction = String(document.documentElement.dataset.faction || 'terran').toLowerCase();
        const lines = {
            terran: ['GAME OVER', 'Mission Failed', 'HULL BREACH · CREW EVACUATED'],
            kronax: ['DISHONOR', 'The blade was broken', 'THE CLAN WILL FORGE ANOTHER'],
            voidborn: ['DISSOLVED', 'The void reclaims you', 'THE SHELL RETURNS TO SILENCE'],
            pirate: ['SUNK', 'Ship scuttled, loot lost', 'DEAD MEN TELL NO TALES'],
            machine: ['SYSTEM FAILURE', 'Unit terminated', 'CHASSIS 0x00 · REBOOT PENDING']
        };
        const pick = lines[faction] || lines.terran;
        // Same markup as the victory screen (index.html #gameOver).
        const content = overlay.querySelector('.victory-content');
        if (!content) return;
        const h = content.querySelector('.victory-title');
        const p = content.querySelector('.victory-subtitle');
        if (h) h.textContent = pick[0];
        if (p) p.textContent = pick[1];
        const ep = content.querySelector('.game-over-epitaph');
        if (ep) ep.textContent = pick[2] || '';
        overlay.dataset.faction = faction;
        if (this.applyOutcomeStepper) this.applyOutcomeStepper(content.querySelector('.victory-header'), 'lost');
        const list = content.querySelector('.game-over-loss .victory-loot-list');
        if (list) {
            const ids = Object.keys(lost || {}).filter((id) => lost[id] > 0);
            list.innerHTML = ids.length && this.renderVictoryLootHtml
                ? this.renderVictoryLootHtml(lost).replace(/class="victory-loot-amount">/g, 'class="victory-loot-amount">−')
                : '<div class="victory-loot-empty">NOTHING LOST</div>';
        }
        if (this.applyVictoryPixelIcons) this.applyVictoryPixelIcons(overlay);
        // Hover moves the keyboard selection too, so only one button is lit.
        if (!overlay.dataset.bound) {
            overlay.dataset.bound = '1';
            overlay.querySelectorAll('.game-over-button').forEach((button) => {
                button.addEventListener('mouseenter', () => {
                    if (typeof uiManager === 'undefined') return;
                    uiManager.gameOverMenuIndex = parseInt(button.dataset.index, 10) || 0;
                    uiManager.updateGameOverMenuDisplay();
                });
            });
        }
        if (typeof uiManager !== 'undefined') {
            uiManager.gameOverMenuIndex = 0;
            uiManager.updateGameOverMenuDisplay();
        }
    },

    hideGameOverOverlay() {
        const gameOverOverlay = document.getElementById('gameOver');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
        if (typeof VFGameOverWreck !== 'undefined') VFGameOverWreck.stop();
    },
});
