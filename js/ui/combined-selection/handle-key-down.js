"use strict";

// CombinedSelectionManager methods, split from combined-selection.js.
extendClass(CombinedSelectionManager, {
    // Handle keyboard input
    handleKeyDown(event) {
        if (!this.isVisible) return;

        switch (event.key) {
            case 'Tab':
                event.preventDefault();
                if (this.overlay && this.overlay.querySelector('.tab-button')) {
                    this.switchTab(this.currentSelection === 'level' ? 'ship' : 'level');
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.navigateUp();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.navigateDown();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.navigateLeft();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.navigateRight();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.startGame();
                break;
            case 'Escape':
                event.preventDefault();
                this.cancelSelection();
                break;
        }
    },

    // Navigation methods
    navigateUp() {
        if (this.currentSelection === 'level') {
            let newIndex = this.selectedLevelIndex - 1;
            while (newIndex >= 0 && !this.levels[newIndex].unlocked) {
                newIndex--;
            }
            if (newIndex >= 0) {
                this.selectedLevelIndex = newIndex;
                this.updateSelection();
            }
        }
    },

    navigateDown() {
        if (this.currentSelection === 'level') {
            let newIndex = this.selectedLevelIndex + 1;
            while (newIndex < this.levels.length && !this.levels[newIndex].unlocked) {
                newIndex++;
            }
            if (newIndex < this.levels.length) {
                this.selectedLevelIndex = newIndex;
                this.updateSelection();
            }
        }
    },

    navigateLeft() {
        if (this.currentSelection === 'ship') {
            this.selectedShipIndex = Math.max(0, this.selectedShipIndex - 1);
            this.updateSelection();
        } else if (this.currentSelection === 'level') {
            this.selectedLevelIndex = Math.max(0, this.selectedLevelIndex - 1);
            this.updateSelection();
        }
    },

    navigateRight() {
        if (this.currentSelection === 'ship') {
            this.selectedShipIndex = Math.min(this.playerShips.length - 1, this.selectedShipIndex + 1);
            this.updateSelection();
        } else if (this.currentSelection === 'level') {
            this.selectedLevelIndex = Math.min(this.levels.length - 1, this.selectedLevelIndex + 1);
            this.updateSelection();
        }
    },

    // Update selection visual
    updateSelection() {
        if (this.currentSelection === 'level') {
            // Update level belt items
            const levelBeltItems = this.overlay.querySelectorAll('.level-belt-item');
            levelBeltItems.forEach((item, index) => {
                item.classList.toggle('selected', index === this.selectedLevelIndex);
            });
            
            // Update level details
            this.updateLevelDetails();
        } else {
            // Update ship belt items
            const shipBeltItems = this.overlay.querySelectorAll('.ship-belt-item');
            shipBeltItems.forEach((item, index) => {
                item.classList.toggle('selected', index === this.selectedShipIndex);
            });
            
            // Update ship details
            this.updateShipDetails();
        }
        this.updateSummary();
    },

    // Update level details display
    updateLevelDetails() {
        if (!this.overlay) return;
        
        const selectedLevel = this.levels[this.selectedLevelIndex];
        if (!selectedLevel) return;
        
        // Update level name
        const levelNameElement = this.overlay.querySelector('.level-name-large');
        if (levelNameElement) {
            levelNameElement.textContent = selectedLevel.name;
            if (!selectedLevel.unlocked) {
                levelNameElement.style.opacity = '0.5';
                levelNameElement.style.color = 'var(--current-text-secondary)';
            } else {
                levelNameElement.style.opacity = '1';
                levelNameElement.style.color = 'var(--current-text)';
            }
        }
        
        // Update level description
        const levelDescriptionElement = this.overlay.querySelector('.level-description-large');
        if (levelDescriptionElement) {
            if (!selectedLevel.unlocked) {
                levelDescriptionElement.textContent = '🔒 Level locked — complete previous levels first';
                levelDescriptionElement.style.opacity = '0.5';
                levelDescriptionElement.style.color = 'var(--current-text-secondary)';
            } else {
                levelDescriptionElement.textContent = selectedLevel.description;
                levelDescriptionElement.style.opacity = '1';
                levelDescriptionElement.style.color = 'var(--current-text-secondary)';
            }
        }
        
        // Update level stats
        const statElements = this.overlay.querySelectorAll('.level-stats-detailed .stat-value');
        if (statElements.length >= 4) {
            if (!selectedLevel.unlocked) {
                statElements[0].textContent = '???';
                statElements[1].textContent = '???';
                statElements[2].textContent = '???';
                statElements[3].textContent = '???';
                statElements.forEach(el => {
                    el.style.opacity = '0.5';
                    el.style.color = 'var(--current-text-secondary)';
                });
            } else {
                statElements[0].textContent = selectedLevel.difficulty || '';
                statElements[1].textContent = selectedLevel.enemyCount || 0;
                statElements[2].textContent = selectedLevel.obstacleCount || 0;
                statElements[3].textContent = selectedLevel.reward || 'XP';
                statElements.forEach(el => {
                    el.style.opacity = '1';
                    el.style.color = 'var(--current-text)';
                });
            }
        }
        
        // Update locked indicator
        const lockedIndicator = this.overlay.querySelector('.locked-indicator-large');
        if (lockedIndicator) {
            lockedIndicator.style.display = !selectedLevel.unlocked ? 'block' : 'none';
        }
        
        // Update large canvas
        const largeCanvas = this.overlay.querySelector('.level-large-canvas');
        if (largeCanvas) {
            this.renderLevelPreview(largeCanvas, selectedLevel, 1.5);
        }
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
