"use strict";

// PlayerSelectionManager methods, split from player-selection.js.
extendClass(PlayerSelectionManager, {
    // Update ship details display
    updateShipDetails() {
        if (!this.overlay) return;
        
        const selectedShip = this.playerShips[this.selectedIndex];
        if (!selectedShip) return;
        
        // Update large canvas
        const largeCanvas = this.overlay.querySelector('.ship-large-canvas');
        if (largeCanvas) {
            largeCanvas.dataset.ship = selectedShip.name;
            // Ensure canvas is transparent
            largeCanvas.style.backgroundColor = 'transparent';
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
        const abilitiesList = this.overlay.querySelector('.abilities-list');
        if (abilitiesList) {
            abilitiesList.innerHTML = this.getDetailedAbilities(selectedShip);
        }
    },

    // Select current ship
    selectShip() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.playerShips.length) {
            this.selectedShip = this.playerShips[this.selectedIndex];

            if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
                profileManager.setActiveShip(this.selectedShip.id || this.selectedShip.type);
            }
            
            // Hide selection screen
            this.hide();
            
            // Go to level selection after ship selection
            if (typeof planetSelectionManager !== 'undefined') {
                // Pass the selected ship to planet selection
                planetSelectionManager.setSelectedShip(this.selectedShip);
                planetSelectionManager.show();
            } else {
                console.error('planetSelectionManager not available');
            }
        } else {
            console.error('Invalid selectedIndex:', this.selectedIndex);
        }
    },

    // Cancel selection
    cancelSelection() {
        this.hide();
        
        // Return to main menu
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        }
    },

    // Get selected ship
    getSelectedShip() {
        return this.selectedShip;
    },
});
