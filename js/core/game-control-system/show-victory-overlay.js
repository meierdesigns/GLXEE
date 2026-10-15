"use strict";

// GameControlSystem methods, split from game-control-system.js.
extendClass(GameControlSystem, {
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
        // Template always has next + leave; ambush hides leave after paint.
        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuItems = ['nextLevel', 'levelSelection'];
        }
        const existingBtns = victoryOverlay
            ? victoryOverlay.querySelectorAll('.victory-button').length
            : 0;
        // Rebuild when missing, or when stale HTML still has PLAY AGAIN / a
        // third button while the menu only has next + leave (index mismatch
        // made "BOSS ROOM" fire planet select).
        const needsBuild = !victoryOverlay
            || !document.getElementById('victoryLootList')
            || existingBtns < 2
            || existingBtns > 2
            || !victoryOverlay.querySelector('.victory-button[data-action="nextLevel"]');
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
                            <button type="button" class="victory-button" data-index="0" data-action="nextLevel" id="victoryNextButton" tabindex="-1">
                                <span class="button-icon" data-icon="menuStart"></span>
                                <span class="button-text">NEXT STAGE</span>
                            </button>
                            <button type="button" class="victory-button" data-index="1" data-action="levelSelection" tabindex="-1">
                                <span class="button-icon" data-icon="menuPlanets"></span>
                                <span class="button-text">Leave Planet</span>
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
        this.applyVictoryFactionFlavor(victoryOverlay);
        this.applyVictoryPixelIcons(victoryOverlay);

        if (!victoryOverlay.dataset.bound) {
            this.bindVictoryButtons(victoryOverlay);
            victoryOverlay.dataset.bound = '1';
        }

        this.updateVictoryNextButton();
        this.cancelVictoryAutoReturn();

        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuIndex = 0;
            uiManager.updateVictoryMenuDisplay();
        }

        this.updateVictoryStats();
        if (this.applyOutcomeStepper) this.applyOutcomeStepper(victoryOverlay.querySelector('.victory-header'), 'won');

        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.persistEndScreen('victory', { endLoot: this.lastVictoryLoot || null });
    },

    /** Faction-specific victory wording; the look comes from html[data-faction]. */
    applyVictoryFactionFlavor(overlay) {
        const faction = String(document.documentElement.dataset.faction || 'terran').toLowerCase();
        const lines = {
            terran: ['VICTORY!', 'Mission Accomplished'],
            kronax: ['CONQUEST!', 'The blade prevails'],
            voidborn: ['ASCENSION', 'The void has fed'],
            pirate: ['PLUNDERED!', 'Loot secured, crew alive'],
            machine: ['OBJECTIVE COMPLETE', 'Efficiency: optimal']
        };
        const pick = lines[faction] || lines.terran;
        const title = overlay.querySelector('.victory-title');
        const sub = overlay.querySelector('.victory-subtitle');
        if (title) title.textContent = pick[0];
        if (sub) sub.textContent = pick[1];
        overlay.dataset.faction = faction;
    },

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
    },

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
    },

    applyVictoryPixelIcons(victoryOverlay) {
        if (!victoryOverlay) return;
        const defaults = {
            '0': 'menuStart',
            '1': 'menuPlanets'
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
    },

    /**
     * Last stage of a planet won → no next stage to offer: show the victory
     * screen briefly (with a countdown) and return to planet selection.
     * Any button pressed meanwhile wins; hiding the overlay cancels the timer.
     */
    getVictoryCurrentLevelId() {
        const level = this.coreLevelManager.getCurrentLevel();
        if (!level) return null;
        if (level.planetId && Number.isFinite(Number(level.stageIndex))) {
            return `${level.planetId}-${level.isBoss ? 'boss' : level.stageIndex}`;
        }
        return level.id || level.levelId || level.stageId || level.planetId || level.background || null;
    },

    scheduleAutoReturnIfPlanetCleared(overlay) {
        this.cancelVictoryAutoReturn();
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        const currentId = this.getVictoryCurrentLevelId();
        const meta = currentId && typeof this.coreLevelManager.getNextLevelMeta === 'function'
            ? this.coreLevelManager.getNextLevelMeta(currentId)
            : null;
        const cleared = !!(currentLevel && currentLevel.isBoss) || !meta || meta.kind === 'planet';
        if (!cleared) return;
        const label = overlay.querySelector('.victory-button[data-index="1"] .button-text');
        let left = 4;
        const tick = () => {
            if (label) label.textContent = `Leave Planet (${left})`;
            if (left <= 0) {
                this.cancelVictoryAutoReturn();
                if (label) label.textContent = 'Leave Planet';
                if (typeof game !== 'undefined' && game.showLevelSelection) game.showLevelSelection();
                return;
            }
            left -= 1;
            this._victoryAutoReturn = setTimeout(tick, 1000);
        };
        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuIndex = 1;
            uiManager.updateVictoryMenuDisplay();
        }
        tick();
    },

    cancelVictoryAutoReturn() {
        if (this._victoryAutoReturn) {
            clearTimeout(this._victoryAutoReturn);
            this._victoryAutoReturn = null;
        }
        const label = document.querySelector('#victoryOverlay .victory-button[data-index="1"] .button-text');
        if (label) label.textContent = 'Leave Planet';
    },

    updateVictoryNextButton() {
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        const hasInterruptedTravel = typeof galaxyMapManager !== 'undefined'
            && galaxyMapManager
            && galaxyMapManager._postAmbushFlight;
        const isAmbush = currentLevel && [
            currentLevel.id,
            currentLevel.levelId,
            currentLevel.stageId,
            currentLevel.planetId
        ].some((value) => String(value || '').toLowerCase().indexOf('ambush_') === 0);
        const currentId = this.getVictoryCurrentLevelId();
        const ambushVictory = !!hasInterruptedTravel || isAmbush
            || String(currentId || '').toLowerCase().indexOf('ambush_') === 0;
        const meta = currentId && typeof this.coreLevelManager.getNextLevelMeta === 'function'
            ? this.coreLevelManager.getNextLevelMeta(currentId)
            : null;

        const button = document.querySelector('#victoryOverlay .victory-button[data-index="0"] .button-text')
            || document.querySelector('#victoryNextButton .button-text');
        const bossVictory = !ambushVictory && !!(currentLevel && currentLevel.isBoss);
        const nextLabel = ambushVictory ? 'CONTINUE TRAVEL'
            : (bossVictory ? 'MAP SELECT' : (meta ? meta.label : 'CAMPAIGN COMPLETE'));
        if (button) button.textContent = nextLabel;

        const nextBtn = document.querySelector('#victoryOverlay .victory-button[data-index="0"]');
        if (nextBtn) {
            const canAdvance = !!meta || ambushVictory || !!(currentLevel && currentLevel.isBoss);
            nextBtn.disabled = !canAdvance;
            nextBtn.classList.toggle('disabled', !canAdvance);
            const isBossRoom = !ambushVictory && !bossVictory
                && !!(meta && (meta.kind === 'boss' || String(meta.label || '').toUpperCase() === 'BOSS ROOM'));
            const iconKey = isBossRoom ? 'navSkull' : 'menuStart';
            let iconEl = nextBtn.querySelector('.button-icon');
            if (!iconEl) {
                iconEl = document.createElement('span');
                iconEl.className = 'button-icon';
                nextBtn.insertBefore(iconEl, nextBtn.firstChild);
            }
            iconEl.dataset.icon = iconKey;
            if (typeof iconRenderer !== 'undefined') {
                iconEl.innerHTML = iconRenderer.imgHtml(iconKey, 20, 'victory-pixel-icon');
            }
        }

        // Ambush is mid-flight combat — no planet to leave; only continue travel.
        const leaveBtn = document.querySelector('#victoryOverlay .victory-button[data-action="levelSelection"]');
        if (leaveBtn) {
            leaveBtn.hidden = !!ambushVictory;
            leaveBtn.setAttribute('aria-hidden', ambushVictory ? 'true' : 'false');
        }
        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuItems = ambushVictory
                ? ['nextLevel']
                : ['nextLevel', 'levelSelection'];
            if (ambushVictory && uiManager.victoryMenuIndex > 0) {
                uiManager.victoryMenuIndex = 0;
            }
        }
    },

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
                event.stopPropagation();
                const action = button.dataset.action;
                const index = parseInt(button.dataset.index, 10);
                if (typeof uiManager === 'undefined') return;
                if (!Number.isNaN(index)) {
                    uiManager.victoryMenuIndex = index;
                    uiManager.updateVictoryMenuDisplay();
                }
                if (action && uiManager.runVictoryAction) {
                    uiManager.runVictoryAction(action);
                } else {
                    uiManager.selectVictoryOption();
                }
            });
        });
    },

    hideVictoryOverlay() {
        this.cancelVictoryAutoReturn();
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
    },

    hideAllOverlays() {
        this.hidePauseOverlay();
        this.hideGameOverOverlay();
        this.hideVictoryOverlay();

        // Hide settings overlay
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    },

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
    },

    updateLevelStats(stats) {
        const levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        if (levelInfoManager) {
            levelInfoManager.updateStats(stats);
        }
    },
});
