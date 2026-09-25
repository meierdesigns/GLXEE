"use strict";

// UIManager methods, split from ui-manager.js.
extendClass(UIManager, {
    updateGameOverMenuDisplay() {
        const buttons = document.querySelectorAll('.game-over-button');
        buttons.forEach((button, index) => {
            if (index === this.gameOverMenuIndex) {
                button.classList.add('selected');
                // Show arrow indicator
                if (!button.textContent.includes('▶')) {
                    button.textContent = '▶ ' + button.textContent;
                }
            } else {
                button.classList.remove('selected');
                // Hide arrow indicator
                button.textContent = button.textContent.replace('▶ ', '');
            }
        });
    },

    selectGameOverOption() {
        const selectedOption = this.gameOverMenuItems[this.gameOverMenuIndex];
        
        switch (selectedOption) {
            case 'restart':
                if (typeof game !== 'undefined') {
                    game.restartGame();
                }
                break;
            case 'mainMenu':
                if (typeof game !== 'undefined') {
                    game.showLevelSelection();
                }
                break;
        }
    },

    handleVictoryInput(event) {
        event.preventDefault();
        
        
        switch (event.key) {
            case 'ArrowUp':
                this.victoryMenuIndex = (this.victoryMenuIndex - 1 + this.victoryMenuItems.length) % this.victoryMenuItems.length;
                this.updateVictoryMenuDisplay();
                break;
            case 'ArrowDown':
                this.victoryMenuIndex = (this.victoryMenuIndex + 1) % this.victoryMenuItems.length;
                this.updateVictoryMenuDisplay();
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                // Ignore horizontal navigation - only vertical selection
                break;
            case 'Enter':
            case ' ':
                this.selectVictoryOption();
                break;
            case 'Escape':
                if (typeof game !== 'undefined') {
                    game.showLevelSelection();
                }
                break;
        }
    },

    getVictoryButtons() {
        return document.querySelectorAll('#victoryOverlay .victory-button');
    },

    updateVictoryMenuDisplay() {
        const buttons = this.getVictoryButtons();

        // Ensure index is within valid range
        if (this.victoryMenuIndex < 0) {
            this.victoryMenuIndex = this.victoryMenuItems.length - 1;
        } else if (this.victoryMenuIndex >= this.victoryMenuItems.length) {
            this.victoryMenuIndex = 0;
        }
        
        buttons.forEach((button, index) => {
            if (index === this.victoryMenuIndex) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
        });
    },

    selectVictoryOption() {
        const selectedOption = this.victoryMenuItems[this.victoryMenuIndex];
        
        switch (selectedOption) {
            case 'nextLevel':
                if (typeof game !== 'undefined') {
                    game.nextLevel();
                }
                break;
            case 'restartGame':
                if (typeof game !== 'undefined') {
                    game.restartGame();
                }
                break;
            case 'levelSelection':
                if (typeof game !== 'undefined') {
                    game.showLevelSelection();
                }
                break;
            default:
        }
    },

    updatePauseMenuDisplay() {
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (!pauseOverlay) return;

        const menuItems = pauseOverlay.querySelectorAll('.pause-button');
        menuItems.forEach((item, index) => {
            const label = item.dataset.label || item.textContent.replace(/^▶\s*/, '').trim();
            item.dataset.label = label;
            if (index === this.pauseMenuIndex) {
                item.classList.add('selected');
                item.textContent = '▶ ' + label;
            } else {
                item.classList.remove('selected');
                item.textContent = label;
            }
        });
    },

    selectPauseMenuItem() {
        const selectedItem = this.pauseMenuItems[this.pauseMenuIndex];
        
        switch (selectedItem) {
            case 'RESUME':
                if (typeof game !== 'undefined') {
                    game.resumeGame();
                }
                break;
            case 'SETTINGS':
                if (typeof settingsManager !== 'undefined') {
                    settingsManager.showSettings();
                }
                break;
            case 'QUIT':
                if (typeof game !== 'undefined') {
                    game.showLevelSelection();
                }
                break;
        }
    },
});
