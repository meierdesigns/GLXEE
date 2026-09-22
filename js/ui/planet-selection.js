"use strict";

// Planet selection system
class PlanetSelectionManager {
    constructor() {
        this.selectedShip = null; // Store selected ship from player selection
        this.planets = [
            {
                id: 1,
                name: "MARS",
                difficulty: "EASY",
                color: "var(--current-text-secondary)",
                description: "3 stages + boss chamber",
                unlocked: true
            },
            {
                id: 2,
                name: "JUPITER",
                difficulty: "MEDIUM",
                color: "var(--current-text-secondary)",
                description: "3 stages + boss chamber",
                unlocked: true
            },
            {
                id: 3,
                name: "SATURN",
                difficulty: "HARD",
                color: "var(--current-text-secondary)",
                description: "3 stages + boss chamber",
                unlocked: true
            },
            {
                id: 4,
                name: "NEPTUNE",
                difficulty: "EXPERT",
                color: "var(--current-text-secondary)",
                description: "3 stages + boss chamber",
                unlocked: true
            }
        ];
        this.selectedPlanet = 0;
        this.isVisible = false;
        this.isFirstSelection = true;
    }

    show() {
        this.isVisible = true;
        this.isFirstSelection = true; // Reset for immediate first selection
        this.createPlanetSelectionUI();
    }

    hide() {
        this.isVisible = false;
        this.removePlanetSelectionUI();
    }
    
    setSelectedShip(ship) {
        this.selectedShip = ship;
    }

    createPlanetSelectionUI() {
        // Initialize planet SVGs
        if (typeof planetSVGManager !== 'undefined') {
            planetSVGManager.init();
        }
        
        // Create planet selection overlay
        const overlay = document.createElement('div');
        overlay.id = 'planetSelection';
        overlay.className = 'planet-selection-overlay';
        
        const content = document.createElement('div');
        content.className = 'planet-selection-content';
        
        const title = document.createElement('h2');
        title.textContent = 'SELECT PLANET';
        title.className = 'planet-selection-title';
        
        // Create horizontal belt container
        const beltContainer = document.createElement('div');
        beltContainer.className = 'planet-belt-container';
        
        const planetBelt = document.createElement('div');
        planetBelt.className = 'planet-belt';
        planetBelt.id = 'planetBelt';
        
        // Create planet items for the belt
        this.planets.forEach((planet, index) => {
            const planetItem = document.createElement('div');
            planetItem.className = `planet-item ${planet.unlocked ? 'unlocked' : 'locked'}`;
            planetItem.dataset.planetIndex = index;
            
            // Add planet SVG
            const planetImage = document.createElement('div');
            planetImage.className = 'planet-image';
            planetImage.innerHTML = planetSVGManager.getPlanetSVG(planet.name);
            
            const planetName = document.createElement('div');
            planetName.className = 'planet-name';
            planetName.textContent = planet.name;
            planetName.style.color = planet.color;
            
            const planetDifficulty = document.createElement('div');
            planetDifficulty.className = 'planet-difficulty';
            planetDifficulty.textContent = planet.difficulty;
            
            if (planet.unlocked) {
                planetItem.addEventListener('click', () => this.selectPlanet(index));
            }
            
            planetItem.appendChild(planetImage);
            planetItem.appendChild(planetName);
            planetItem.appendChild(planetDifficulty);
            planetBelt.appendChild(planetItem);
        });
        
        beltContainer.appendChild(planetBelt);
        
        const instructions = document.createElement('div');
        instructions.className = 'planet-instructions';
        instructions.textContent = '← → Navigate • ENTER Start Game • ESC Return';
        
        content.appendChild(title);
        content.appendChild(beltContainer);
        content.appendChild(instructions);
        overlay.appendChild(content);
        
        document.body.appendChild(overlay);
        
        // Update selection display
        this.updateSelection();
    }

    removePlanetSelectionUI() {
        const overlay = document.getElementById('planetSelection');
        if (overlay) {
            overlay.remove();
        }
    }

    handleKeyDown(event) {
        if (!this.isVisible) return;
        
        
        switch (event.key) {
            case 'Escape':
                this.hide();
                // Return to ship selection instead of main menu
                if (typeof playerSelectionManager !== 'undefined') {
                    playerSelectionManager.show();
                } else if (typeof startScreenManager !== 'undefined') {
                    startScreenManager.show();
                }
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                this.selectedPlanet = Math.max(0, this.selectedPlanet - 1);
                this.updateSelection();
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                this.selectedPlanet = Math.min(this.planets.length - 1, this.selectedPlanet + 1);
                this.updateSelection();
                break;
            case 'Enter':
            case ' ':
                if (this.planets[this.selectedPlanet].unlocked) {
                    this.selectPlanet(this.selectedPlanet);
                }
                break;
        }
    }

    updateSelection() {
        const items = document.querySelectorAll('.planet-item');
        items.forEach((item, index) => {
            if (index === this.selectedPlanet) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Simple immediate scroll - no complex calculations
        this.scrollToSelected();
    }
    
    scrollToSelected() {
        const belt = document.getElementById('planetBelt');
        if (!belt) return;
        
        // Calculate simple scroll position based on selected index
        const itemWidth = 120; // Fixed item width
        const containerWidth = 200; // Fixed container width
        const scrollPosition = (this.selectedPlanet * itemWidth) - (containerWidth / 2) + (itemWidth / 2);
        
        // Apply position immediately without transitions
        belt.style.transition = 'none';
        belt.style.transform = `translateX(-${scrollPosition}px)`;
    }
    

    selectPlanet(planetIndex) {
        const planet = this.planets[planetIndex];
        if (!planet.unlocked) return;
        
        // Unlock next planet
        if (planetIndex < this.planets.length - 1) {
            this.planets[planetIndex + 1].unlocked = true;
        }
        
        this.hide();
        
        // Start game with selected planet
        this.startPlanetGame(planet);
    }
    
    startPlanetGame(planet) {
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        }

        if (this.selectedShip && typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(this.selectedShip);
        }

        const levelId = (typeof profileManager !== 'undefined' && profileManager.getResumeLevelId)
            ? (profileManager.getResumeLevelId(planet.name.toLowerCase()) || planet.name.toLowerCase())
            : planet.name.toLowerCase();

        if (typeof game !== 'undefined' && typeof game.startGame === 'function') {
            const gameOver = document.getElementById('gameOver');
            if (gameOver) {
                gameOver.classList.add('hidden');
            }
            game.startGame(levelId);
        } else {
            console.error('GameCore startGame not available for planet:', levelId);
        }
    }
    
    // Unlock next level after winning
    unlockNextLevel(currentLevelId = 1) {
        // Unlock the next level after the current one
        const nextLevelId = currentLevelId + 1;
        
        if (nextLevelId <= this.planets.length) {
            const planetIndex = nextLevelId - 1; // Convert to 0-based index
            this.planets[planetIndex].unlocked = true;
        }
    }
    
    // Unlock specific level
    unlockLevel(levelId) {
        if (levelId > 0 && levelId <= this.planets.length) {
            const planetIndex = levelId - 1; // Convert to 0-based index
            this.planets[planetIndex].unlocked = true;
        }
    }

}

// Global planet selection manager instance
const planetSelectionManager = new PlanetSelectionManager();
