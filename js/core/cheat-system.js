"use strict";

// Cheat system and level selection
class CheatSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.cheatSequence = '';
        this.cheatMenuVisible = false;
        this.cheatMenuIndex = 0;
        this.cheatMenuItems = ['GOD MODE', 'INFINITE AMMO', 'FAST FIRE', 'SLOW MOTION', 'INSTANT KILL', 'SHIP SELECT', 'LEVEL SELECT', 'CLOSE'];
        this.cheats = {
            godMode: false,
            infiniteAmmo: false,
            fastFire: false,
            slowMotion: false,
            instantKill: false,
            shipSelect: false,
            levelSelect: false
        };
        this.wasStartScreenVisible = false;
        this.levelSelectVisible = false;
        this.levelSelectIndex = 0;
        this.availableLevels = [];
        this.initializeCheatLevels();
    }
    
    initializeCheatLevels() {
        // Initialize cheat levels from level manager (all unlocked)
        if (typeof levelManager !== 'undefined') {
            const allLevels = levelManager.getAllLevels();
            this.availableLevels = allLevels.map((level, index) => ({
                id: level.name === 'MARS' ? 1 : 
                    level.name === 'JUPITER' ? 2 :
                    level.name === 'SATURN' ? 3 :
                    level.name === 'NEPTUNE' ? 4 :
                    level.name === 'PLUTO' ? 5 : index + 1,
                name: level.name,
                difficulty: level.difficulty,
                unlocked: true // All levels unlocked in cheat mode
            }));
        } else {
            // Fallback if level manager is not available
            this.availableLevels = [
                { id: 1, name: "MARS", difficulty: "EASY", unlocked: true },
                { id: 2, name: "JUPITER", difficulty: "MEDIUM", unlocked: true },
                { id: 3, name: "SATURN", difficulty: "HARD", unlocked: true },
                { id: 4, name: "NEPTUNE", difficulty: "EXTREME", unlocked: true },
                { id: 5, name: "PLUTO", difficulty: "NIGHTMARE", unlocked: true }
            ];
        }
    }
    
    detectCheatSequence(key) {
        // Add key to sequence
        this.cheatSequence += key.toLowerCase();
        
        // Keep only last 2 characters
        if (this.cheatSequence.length > 2) {
            this.cheatSequence = this.cheatSequence.slice(-2);
        }
        
        // Check for "op" cheat
        if (this.cheatSequence === 'op') {
            this.showCheatMenu();
            this.cheatSequence = ''; // Reset sequence
        }
    }
    
    showCheatMenu() {
        this.cheatMenuVisible = true;
        this.cheatMenuIndex = 0;
        this.updateCheatMenuDisplay();
        
        // Remember if start screen was visible and hide it
        this.wasStartScreenVisible = false;
        if (typeof startScreenManager !== 'undefined' && startScreenManager.isVisible()) {
            this.wasStartScreenVisible = true;
            startScreenManager.hide();
        }
        
        // Play cheat sound if available
        if (typeof soundManager !== 'undefined') {
            soundManager.playPowerUp();
        }
    }
    
    hideCheatMenu() {
        this.cheatMenuVisible = false;
        
        // Show start screen if it was visible before
        if (this.wasStartScreenVisible && typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        }
    }
    
    handleCheatMenuInput(key) {
        switch (key) {
            case 'Escape':
                this.hideCheatMenu();
                break;
            case 'ArrowUp':
                this.cheatMenuIndex = (this.cheatMenuIndex - 1 + this.cheatMenuItems.length) % this.cheatMenuItems.length;
                this.updateCheatMenuDisplay();
                break;
            case 'ArrowDown':
                this.cheatMenuIndex = (this.cheatMenuIndex + 1) % this.cheatMenuItems.length;
                this.updateCheatMenuDisplay();
                break;
            case 'Enter':
            case ' ':
                this.selectCheatMenuItem();
                break;
        }
    }
    
    updateCheatMenuDisplay() {
        // This will be rendered on canvas, no DOM manipulation needed
    }
    
    selectCheatMenuItem() {
        const selectedItem = this.cheatMenuItems[this.cheatMenuIndex];
        
        switch (selectedItem) {
            case 'GOD MODE':
                this.cheats.godMode = !this.cheats.godMode;
                break;
            case 'INFINITE AMMO':
                this.cheats.infiniteAmmo = !this.cheats.infiniteAmmo;
                break;
            case 'FAST FIRE':
                this.cheats.fastFire = !this.cheats.fastFire;
                break;
            case 'SLOW MOTION':
                this.cheats.slowMotion = !this.cheats.slowMotion;
                break;
            case 'INSTANT KILL':
                this.cheats.instantKill = !this.cheats.instantKill;
                break;
            case 'SHIP SELECT':
                this.cheats.shipSelect = !this.cheats.shipSelect;
                break;
            case 'LEVEL SELECT':
                this.showLevelSelect();
                break;
            case 'CLOSE':
                this.hideCheatMenu();
                break;
        }
        
        // Play sound for cheat activation
        if (typeof soundManager !== 'undefined') {
            soundManager.playPowerUp();
        }
    }
    
    showLevelSelect() {
        this.levelSelectVisible = true;
        this.levelSelectIndex = 0;
        this.hideCheatMenu();
    }
    
    hideLevelSelect() {
        this.levelSelectVisible = false;
        this.showCheatMenu();
    }
    
    handleLevelSelectInput(key) {
        switch (key) {
            case 'Escape':
                this.hideLevelSelect();
                break;
            case 'ArrowUp':
                this.levelSelectIndex = (this.levelSelectIndex - 1 + this.availableLevels.length) % this.availableLevels.length;
                break;
            case 'ArrowDown':
                this.levelSelectIndex = (this.levelSelectIndex + 1) % this.availableLevels.length;
                break;
            case 'Enter':
            case ' ':
                this.selectLevel();
                break;
        }
    }
    
    selectLevel() {
        const selectedLevel = this.availableLevels[this.levelSelectIndex];
        if (typeof game !== 'undefined') {
            game.startGame(selectedLevel);
        }
    }
    
    getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 'EASY': return 'var(--status-success)';
            case 'MEDIUM': return 'var(--status-warning)';
            case 'HARD': return 'var(--status-warning)';
            case 'EXTREME': return 'var(--status-error)';
            case 'NIGHTMARE': return 'var(--current-accent)';
            default: return 'var(--current-text)';
        }
    }
}
