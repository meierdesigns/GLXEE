"use strict";

// PlayerSelectionManager methods, split from player-selection.js.
extendClass(PlayerSelectionManager, {
    // Create player selection UI
    createPlayerSelectionUI() {

        // Remove existing overlay
        if (this.overlay) {
            this.overlay.remove();
        }

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'player-selection-overlay';
        this.overlay.innerHTML = `
            <div class="player-selection-content">
                <h2 class="player-selection-title">SELECT YOUR SHIP</h2>
                <!-- Horizontal Ship Belt -->
                <div class="ship-belt-container">
                    <div class="ship-belt">
                        ${this.playerShips.map((ship, index) => `
                            <div class="ship-belt-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
                                <canvas class="ship-belt-canvas" width="70" height="50" data-ship="${ship.name}"></canvas>
                                <span class="ship-belt-label">${ship.name || ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Ship Details -->
                <div class="ship-details-container">
                    <div class="ship-preview-large">
                        <canvas class="ship-large-canvas" width="300" height="200" data-ship="${this.playerShips[this.selectedIndex]?.name || ''}"></canvas>
                    </div>
                    <div class="ship-info-detailed">
                        <h3 class="ship-name-large">${this.playerShips[this.selectedIndex]?.name || ''}</h3>
                        <p class="ship-description-large">${this.playerShips[this.selectedIndex]?.description || ''}</p>

                        <div class="ship-stats-detailed">
                            <div class="stat-row">
                                <span class="stat-label">Speed:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.speed || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Health:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.maxHealth || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Armor:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.armor || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Damage:</span>
                                <span class="stat-value">${this.playerShips[this.selectedIndex]?.damage || 0}</span>
                            </div>
                        </div>

                        <div class="ship-weapons">
                            <h4 class="weapons-title">Weapons:</h4>
                            <div class="weapons-list">
                                ${(this.playerShips[this.selectedIndex]?.weapons || []).map(weapon => `
                                    <span class="weapon-item">${weapon}</span>
                                `).join('')}
                            </div>
                        </div>

                        <div class="ship-abilities">
                            <h4 class="abilities-title">Special Abilities:</h4>
                            <div class="abilities-list">
                                ${(this.playerShips[this.selectedIndex]?.specialAbilities || []).map(ability => `
                                    <span class="ability-item">${ability}</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="player-selection-instructions">
                    <p>LEFT/RIGHT ARROW: Navigate • SPACEBAR: Select • ESC: Cancel</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Render ship previews
        this.renderShipPreviews();

        // Add event listeners
        this.addEventListeners();
    },

    // Render ship previews on canvases
    renderShipPreviews() {
        // Render belt canvases
        const beltCanvases = this.overlay.querySelectorAll('.ship-belt-canvas');
        beltCanvases.forEach((canvas, index) => {
            const ship = this.playerShips[index];
            if (ship) {
                // Ensure canvas is transparent
                canvas.style.backgroundColor = 'transparent';
                this.renderShipPreview(canvas, ship, 1.5); // Scaled for belt
            }
        });

        // Render large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            const ship = this.playerShips[this.selectedIndex];
            if (ship) {
                // Ensure canvas is transparent
                largeCanvas.style.backgroundColor = 'transparent';
                this.renderShipPreview(largeCanvas, ship, 2.0); // Larger scale for preview
            }
        }
    },

    // Render individual ship preview
    renderShipPreview(canvas, ship, scale = 3) {
        if (typeof shipRenderer !== 'undefined') {
            shipRenderer.renderShipPreview(canvas, ship, scale);
        } else {
            console.warn('ShipRenderer not available, using fallback rendering');
        }
    },

    // Add event listeners
    addEventListeners() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => this.handleKeyDown(e);

        this.overlay.querySelectorAll('.ship-belt-item').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.selectedIndex = index;
                this.updateSelection();
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.selectedIndex = index;
                this.selectShip();
            });
        });

        document.addEventListener('keydown', this._keyHandler);

        // Listen for color changes to refresh ship previews
        if (typeof colorManager !== 'undefined' && !this._colorHooked) {
            this._colorHooked = true;
            const originalApplyColors = colorManager.applyColors.bind(colorManager);
            colorManager.applyColors = () => {
                originalApplyColors();
                if (this.isVisible) {
                    this.renderShipPreviews();
                }
            };
        }
    },

    // Handle keyboard input
    handleKeyDown(event) {
        if (!this.isVisible) return;

        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.updateSelection();
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.playerShips.length - 1, this.selectedIndex + 1);
                this.updateSelection();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.selectShip();
                break;
            case 'Escape':
                event.preventDefault();
                this.cancelSelection();
                break;
        }
    },

    // Update selection visual
    updateSelection() {
        // Update belt items
        const beltItems = this.overlay.querySelectorAll('.ship-belt-item');
        beltItems.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });

        // Update ship details
        this.updateShipDetails();
    },

    // Get detailed abilities for a ship
    getDetailedAbilities(ship) {
        if (!ship || !ship.abilities) return '';

        // Try to get abilities from ability manager if available
        if (typeof abilityManager !== 'undefined') {
            const abilityDescriptions = abilityManager.getAbilityDescriptions(ship.abilities);
            return abilityDescriptions.map(ability => `
                <div class="ability-detailed">
                    <div class="ability-tier">Tier ${ability.tier}</div>
                    <div class="ability-header">
                        <span class="ability-icon">${typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.resolveIconHtml(ability.icon, 20, 'cv-ability-icon-img') : ability.icon}</span>
                        <span class="ability-name">${ability.name}</span>
                        <span class="ability-type ${ability.type}">${ability.type}</span>
                    </div>
                    <div class="ability-description">${ability.description}</div>
                    <div class="ability-effects">
                        ${this.getAbilityEffects(ability)}
                    </div>
                </div>
            `).join('');
        }

        // Fallback to simple display
        return ship.abilities.map(ability => `
            <span class="ability-item">${ability}</span>
        `).join('');
    },

    // Get ability effects for display
    getAbilityEffects(ability) {
        if (!ability.effects) return '';

        const effects = [];
        for (const [key, value] of Object.entries(ability.effects)) {
            if (typeof value === 'number') {
                let displayValue = value;
                let label = key.replace(/([A-Z])/g, ' $1').replace(/Modifier$/, '').trim();

                if (key.includes('Modifier')) {
                    displayValue = `${Math.round((value - 1) * 100)}%`;
                    if (value > 1) displayValue = '+' + displayValue;
                } else if (key.includes('Chance') || key.includes('Resistance')) {
                    displayValue = `${Math.round(value * 100)}%`;
                } else {
                    displayValue = value.toString();
                }

                effects.push(`
                    <div class="ability-effect">
                        <div class="ability-effect-label">${label}</div>
                        <div class="ability-effect-value">${displayValue}</div>
                    </div>
                `);
            }
        }

        return effects.join('');
    },
});
