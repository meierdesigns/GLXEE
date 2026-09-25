"use strict";

// CombinedSelectionManager methods, split from combined-selection.js.
extendClass(CombinedSelectionManager, {
    // Create combined selection UI
    createCombinedSelectionUI() {

        // Remove existing overlay
        if (this.overlay) {
            this.overlay.remove();
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'combined-selection-overlay';
        this.overlay.innerHTML = `
            <div class="combined-selection-content">
                <h2 class="combined-selection-title">SELECT LEVEL & SHIP</h2>

                <div class="selection-tabs">
                    <button class="tab-button ${this.currentSelection === 'level' ? 'active' : ''}" data-tab="level">
                        LEVEL SELECTION
                    </button>
                    <button class="tab-button ${this.currentSelection === 'ship' ? 'active' : ''}" data-tab="ship">
                        SHIP SELECTION
                    </button>
                </div>

                <div class="selection-content">
                    <div class="level-selection ${this.currentSelection === 'level' ? 'active' : ''}">
                        <!-- Horizontal Level Belt -->
                        <div class="level-belt-container">
                            <div class="level-belt">
                                ${this.levels.map((level, index) => `
                                    <div class="level-belt-item ${index === this.selectedLevelIndex ? 'selected' : ''} ${!level.unlocked ? 'locked' : ''}" data-index="${index}">
                                        <canvas class="level-belt-canvas" width="70" height="50" data-level="${level.name}"></canvas>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Level Details -->
                        <div class="level-details-container">
                            <div class="level-preview-large">
                                <canvas class="level-large-canvas" width="300" height="200" data-level="${this.levels[this.selectedLevelIndex]?.name || ''}"></canvas>
                            </div>
                            <div class="level-info-detailed">
                                <h3 class="level-name-large">${this.levels[this.selectedLevelIndex]?.name || ''}</h3>
                                <p class="level-description-large">${this.levels[this.selectedLevelIndex]?.description || ''}</p>

                                <div class="level-stats-detailed">
                                    <div class="stat-row">
                                        <span class="stat-label">Difficulty:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.difficulty || ''}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Enemies:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.enemyCount || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Obstacles:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.obstacleCount || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Reward:</span>
                                        <span class="stat-value">${this.levels[this.selectedLevelIndex]?.reward || 'XP'}</span>
                                    </div>
                                </div>

                                ${!this.levels[this.selectedLevelIndex]?.unlocked ? '<div class="locked-indicator-large">LEVEL LOCKED</div>' : ''}
                            </div>
                        </div>
                    </div>

                    <div class="ship-selection ${this.currentSelection === 'ship' ? 'active' : ''}">
                        <!-- Horizontal Ship Belt -->
                        <div class="ship-belt-container">
                            <div class="ship-belt">
                                ${this.playerShips.map((ship, index) => `
                                    <div class="ship-belt-item ${index === this.selectedShipIndex ? 'selected' : ''}" data-index="${index}">
                                        <canvas class="ship-belt-canvas" width="70" height="50" data-ship="${ship.name}"></canvas>
                                        <span class="ship-belt-label">${ship.name || ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Ship Details -->
                        <div class="ship-details-container">
                            <div class="ship-preview-large">
                                <canvas class="ship-large-canvas" width="300" height="200" data-ship="${this.playerShips[this.selectedShipIndex]?.name || ''}"></canvas>
                            </div>
                            <div class="ship-info-detailed">
                                <h3 class="ship-name-large">${this.playerShips[this.selectedShipIndex]?.name || ''}</h3>
                                <p class="ship-description-large">${this.playerShips[this.selectedShipIndex]?.description || ''}</p>

                                <div class="ship-stats-detailed">
                                    <div class="stat-row">
                                        <span class="stat-label">Speed:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.speed || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Health:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.maxHealth || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Armor:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.armor || 0}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Damage:</span>
                                        <span class="stat-value">${this.playerShips[this.selectedShipIndex]?.damage || 0}</span>
                                    </div>
                                </div>

                                <div class="ship-weapons">
                                    <h4 class="weapons-title">Weapons:</h4>
                                    <div class="weapons-list">
                                        ${(this.playerShips[this.selectedShipIndex]?.weapons || []).map(weapon => `
                                            <span class="weapon-item">${weapon}</span>
                                        `).join('')}
                                    </div>
                                </div>

                                <div class="ship-abilities">
                                    <h4 class="abilities-title">Special Abilities:</h4>
                                    <div class="abilities-detailed-list">
                                        ${this.getDetailedAbilities(this.playerShips[this.selectedShipIndex])}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="selection-summary">
                    <div class="selected-level">
                        <strong>Level:</strong> ${this.levels[this.selectedLevelIndex]?.name || 'None'}
                    </div>
                    <div class="selected-ship">
                        <strong>Ship:</strong> ${this.playerShips[this.selectedShipIndex]?.name || 'None'}
                    </div>
                </div>

                <div class="combined-selection-actions">
                    <button type="button" class="pe-btn pe-primary" id="csStart">START</button>
                    <button type="button" class="pe-btn" id="csCancel">CANCEL</button>
                </div>

                <div class="combined-selection-instructions">
                    <p>CLICK to select • TAB Level/Ship • ←→ Navigate • ENTER Start • ESC Cancel</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Render ship previews
        this.renderShipPreviews();

        // Add event listeners
        this.addEventListeners();

        // Render previews
        this.renderLevelPreviews();
        this.renderShipPreviews();
    },

    // Render level previews on canvases
    renderLevelPreviews() {

        // Render belt canvases
        const beltCanvases = this.overlay.querySelectorAll('.level-belt-canvas');
        beltCanvases.forEach((canvas, index) => {
            const level = this.levels[index];
            if (level) {
                this.renderLevelPreview(canvas, level, 1); // Full scale for belt
            }
        });

        // Render large canvas
        const largeCanvas = this.overlay.querySelector('.level-large-canvas');
        if (largeCanvas) {
            const level = this.levels[this.selectedLevelIndex];
            if (level) {
                this.renderLevelPreview(largeCanvas, level, 1.5); // Larger scale for preview
            }
        }
    },

    // Render ship previews on canvases
    renderShipPreviews() {
        // Render belt canvases
        const beltCanvases = this.overlay.querySelectorAll('.ship-belt-canvas');
        beltCanvases.forEach((canvas, index) => {
            const ship = this.playerShips[index];
            if (ship) {
                this.renderShipPreview(canvas, ship, 1); // Full scale for belt
            }
        });

        // Render large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            const ship = this.playerShips[this.selectedShipIndex];
            if (ship) {
                this.renderShipPreview(largeCanvas, ship, 1.5); // Larger scale for preview
            }
        }
    },
});
