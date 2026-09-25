"use strict";

// CombinedSelectionManager methods, split from combined-selection.js.
extendClass(CombinedSelectionManager, {
    // Update ship details display
    updateShipDetails() {
        if (!this.overlay) return;
        
        const selectedShip = this.playerShips[this.selectedShipIndex];
        if (!selectedShip) return;
        
        // Update large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            largeCanvas.dataset.ship = selectedShip.name;
            this.renderShipPreview(largeCanvas, selectedShip, 1.5);
        }
        
        // Update ship info
        const nameElement = this.overlay.querySelector('.ship-name-large');
        if (nameElement) nameElement.textContent = selectedShip.name;
        
        const descElement = this.overlay.querySelector('.ship-description-large');
        if (descElement) descElement.textContent = selectedShip.description;
        
        // Update stats
        const statRows = this.overlay.querySelectorAll('.stat-row');
        if (statRows.length >= 4) {
            statRows[0].querySelector('.stat-value').textContent = selectedShip.speed;
            statRows[1].querySelector('.stat-value').textContent = selectedShip.maxHealth;
            statRows[2].querySelector('.stat-value').textContent = selectedShip.armor;
            statRows[3].querySelector('.stat-value').textContent = selectedShip.damage;
        }
        
        // Update weapons
        const weaponsList = this.overlay.querySelector('.weapons-list');
        if (weaponsList && selectedShip.weapons) {
            weaponsList.innerHTML = selectedShip.weapons.map(weapon => 
                `<span class="weapon-item">${weapon}</span>`
            ).join('');
        }
        
        // Update abilities
        const abilitiesList = this.overlay.querySelector('.abilities-detailed-list');
        if (abilitiesList) {
            abilitiesList.innerHTML = this.getDetailedAbilities(selectedShip);
        }
    },

    // Update summary display
    updateSummary() {
        const selectedLevel = this.overlay.querySelector('.selected-level');
        const selectedShip = this.overlay.querySelector('.selected-ship');
        
        if (selectedLevel) {
            const name = this.selectedPlanet
                ? this.selectedPlanet.name
                : (this.levels[this.selectedLevelIndex]?.name || 'None');
            selectedLevel.innerHTML = `<strong>Planet:</strong> ${name}`;
        }
        if (selectedShip) {
            selectedShip.innerHTML = `<strong>Ship:</strong> ${this.playerShips[this.selectedShipIndex]?.name || 'None'}`;
        }
    },

    // Start game with selected level and ship
    startGame() {
        const selectedLevel = this.selectedPlanet || this.levels[this.selectedLevelIndex];
        const selectedShip = this.playerShips[this.selectedShipIndex];
        
        if (!selectedLevel || !selectedShip) {
            console.error('Missing level or ship selection');
            return;
        }
        
        if (selectedLevel.unlocked === false) {
            this.showLockedMessage();
            return;
        }

        if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
            profileManager.setActiveShip(selectedShip.id || selectedShip.type);
        }
        
        this.hide();

        if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
            homeStationUI.hide();
        }
        
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(selectedShip);
        }
        
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.startGameWithLevelAndShip(selectedLevel, selectedShip);
        }
    },

    // Cancel selection — from ship UI go back to map; else main menu
    cancelSelection() {
        const galaxyId = this.selectedGalaxyId;
        this.hide();

        if (galaxyId && typeof homeStationUI !== 'undefined' && homeStationUI) {
            homeStationUI.show({ tab: 'play' });
            return;
        }

        if (galaxyId && typeof galaxyMapManager !== 'undefined') {
            galaxyMapManager.show({
                galaxyId: galaxyId,
                onConfirm: (planet) => this.openShipSelection(planet),
                onBack: () => {
                    this.selectedGalaxyId = null;
                    this.selectedPlanet = null;
                    this.cancelToMenu();
                }
            });
            return;
        }

        this.cancelToMenu();
    },

    cancelToMenu() {
        this.selectedGalaxyId = null;
        this.selectedPlanet = null;
        this.hide();
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        }
    },

    // Show locked level message
    showLockedMessage() {
        // Create temporary message overlay
        const messageOverlay = document.createElement('div');
        messageOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: var(--enemy-color);
            padding: 20px 30px;
            border-radius: 10px;
            border: 2px solid var(--enemy-color);
            font-family: 'Courier New', monospace;
            font-size: var(--font-h2);
            font-weight: bold;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
        `;
        messageOverlay.textContent = '🔒 Level locked! Complete previous levels first.';
        
        document.body.appendChild(messageOverlay);
        
        // Remove message after 2 seconds
        setTimeout(() => {
            if (messageOverlay.parentNode) {
                messageOverlay.parentNode.removeChild(messageOverlay);
            }
        }, 2000);
    },
});
