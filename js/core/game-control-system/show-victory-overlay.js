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
    },

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
                const index = parseInt(button.dataset.index, 10);
                if (typeof uiManager !== 'undefined' && !Number.isNaN(index)) {
                    uiManager.victoryMenuIndex = index;
                    uiManager.updateVictoryMenuDisplay();
                    uiManager.selectVictoryOption();
                }
            });
        });
    },

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
