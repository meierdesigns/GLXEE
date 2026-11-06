"use strict";

// UIManager methods, split from ui-manager.js.
extendClass(UIManager, {
    updateGameOverMenuDisplay() {
        // Same lit-block selection as the victory buttons (no text arrow: icon + label stay intact).
        const buttons = document.querySelectorAll('#gameOver .game-over-button');
        let focused = null;
        buttons.forEach((button, index) => {
            const on = index === this.gameOverMenuIndex;
            button.classList.toggle('selected', on);
            button.classList.toggle('nav-focused', on);
            if (on) focused = button;
        });
        if (focused && typeof gamepadCursor !== 'undefined' && gamepadCursor.follow) {
            gamepadCursor.follow(focused);
        }
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

        // Shop overlay owns keys / gamepad while open (arrows, Enter, Escape).
        if (typeof inStageShop !== 'undefined' && inStageShop.isOpen) {
            if (typeof inStageShop.handleInput === 'function') {
                inStageShop.handleInput(event);
            } else if (event.key === 'Escape' || event.key === 'e' || event.key === 'E') {
                if (!event.repeat) inStageShop.close();
            }
            return;
        }

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
                if (typeof inStageShop !== 'undefined' && inStageShop.refundPending) {
                    inStageShop.refundPending();
                }
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

        let focused = null;
        buttons.forEach((button, index) => {
            const on = index === this.victoryMenuIndex;
            button.classList.toggle('selected', on);
            button.classList.toggle('nav-focused', on);
            if (on) focused = button;
        });
        // Keep the gamepad HUD frame locked to the lit button so it cannot
        // freeze as a ghost over the planet / stats when the target rebuilds.
        if (focused && typeof gamepadCursor !== 'undefined' && gamepadCursor.follow) {
            gamepadCursor.follow(focused);
        }
    },

    runVictoryAction(action) {
        switch (action) {
            case 'nextLevel':
                if (typeof game !== 'undefined') {
                    game.nextLevel();
                }
                break;
            case 'shop':
                if (typeof inStageShop !== 'undefined' && inStageShop.showFromVictory) {
                    inStageShop.showFromVictory();
                }
                break;
            case 'restartGame':
                if (typeof game !== 'undefined') {
                    game.restartGame();
                }
                break;
            case 'levelSelection':
                if (typeof inStageShop !== 'undefined' && inStageShop.refundPending) {
                    inStageShop.refundPending();
                }
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
