"use strict";

// UIManager methods, split from ui-manager.js.
extendClass(UIManager, {
    updateGameOverMenuDisplay() {
        // Same lit-block selection as the victory buttons (no text arrow: icon + label stay intact).
        const buttons = document.querySelectorAll('#gameOver .game-over-button');
        buttons.forEach((button, index) => {
            button.classList.toggle('selected', index === this.gameOverMenuIndex);
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
        if (typeof event.stopPropagation === 'function') event.stopPropagation();

        // Buttons sit side by side: every arrow steps through the visible ones.
        const count = this.getVictoryButtons().length || this.victoryMenuItems.length || 1;
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                this.victoryMenuIndex = (this.victoryMenuIndex - 1 + count) % count;
                this.updateVictoryMenuDisplay();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                this.victoryMenuIndex = (this.victoryMenuIndex + 1) % count;
                this.updateVictoryMenuDisplay();
                break;
            case 'Enter':
            case ' ':
                // Key-repeat while holding Enter must not open planet select
                // after BOSS ROOM already started the next fight.
                if (event.repeat) break;
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
        return Array.from(document.querySelectorAll('#victoryOverlay .victory-button'))
            .filter((button) => !button.hidden && button.getAttribute('aria-hidden') !== 'true');
    },

    updateVictoryMenuDisplay() {
        const buttons = this.getVictoryButtons();
        const count = buttons.length || this.victoryMenuItems.length || 1;

        // Ensure index is within valid range
        if (this.victoryMenuIndex < 0) {
            this.victoryMenuIndex = count - 1;
        } else if (this.victoryMenuIndex >= count) {
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

    runVictoryAction(action) {
        switch (action) {
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

    selectVictoryOption() {
        const buttons = this.getVictoryButtons();
        const button = buttons[this.victoryMenuIndex];
        const action = (button && button.dataset.action)
            || this.victoryMenuItems[this.victoryMenuIndex];
        this.runVictoryAction(action);
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
