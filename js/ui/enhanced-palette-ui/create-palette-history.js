"use strict";

// EnhancedPaletteUI methods, split from enhanced-palette-ui.js.
extendClass(EnhancedPaletteUI, {
    createPaletteHistory() {
        const history = document.createElement('div');
        history.className = 'palette-history';
        history.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: var(--color-background);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--spacing-sm);
            box-shadow: var(--shadow-lg);
            z-index: var(--z-fixed);
            display: flex;
            gap: var(--spacing-xs);
            max-width: 300px;
            overflow-x: auto;
        `;

        this.paletteHistory.forEach(paletteId => {
            const palette = colorPaletteSystem.palettes[paletteId];
            if (palette) {
                const historyItem = document.createElement('button');
                historyItem.className = 'palette-history-item';
                historyItem.style.cssText = `
                    width: 24px;
                    height: 24px;
                    background: ${palette.primary};
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: var(--transition-fast);
                `;
                historyItem.title = palette.name;
                historyItem.addEventListener('click', () => {
                    this.quickSwitchPalette(paletteId);
                });
                historyItem.addEventListener('mouseenter', () => {
                    historyItem.style.transform = 'scale(1.1)';
                });
                historyItem.addEventListener('mouseleave', () => {
                    historyItem.style.transform = 'scale(1)';
                });
                history.appendChild(historyItem);
            }
        });

        return history;
    },

    createKeyboardShortcuts() {
        const shortcuts = document.createElement('div');
        shortcuts.className = 'keyboard-shortcuts';
        shortcuts.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--color-background);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--spacing-sm);
            box-shadow: var(--shadow-lg);
            z-index: var(--z-fixed);
            font-size: var(--font-size-xs);
            color: var(--color-text-secondary);
            max-width: 200px;
        `;

        shortcuts.innerHTML = `
            <div style="font-weight: var(--font-weight-bold); margin-bottom: var(--spacing-xs);">Shortcuts:</div>
            <div>Ctrl+1-8: Quick switch</div>
            <div>Ctrl+R: Random</div>
            <div>Ctrl+F: Favorite</div>
        `;

        return shortcuts;
    },

    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('paletteUI_preferences');
            if (saved) {
                const prefs = JSON.parse(saved);
                this.paletteHistory = prefs.history || [];
                this.favoritePalettes = new Set(prefs.favorites || []);
            }
        } catch (error) {
            console.warn('Could not load palette UI preferences:', error);
        }
    },

    saveUserPreferences() {
        try {
            const prefs = {
                history: this.paletteHistory,
                favorites: Array.from(this.favoritePalettes)
            };
            localStorage.setItem('paletteUI_preferences', JSON.stringify(prefs));
        } catch (error) {
            console.warn('Could not save palette UI preferences:', error);
        }
    },

    showEnhancedUI() {
        // Remove existing UI
        this.hideEnhancedUI();

        // Add history
        const history = this.createPaletteHistory();
        document.body.appendChild(history);

        // Add shortcuts
        const shortcuts = this.createKeyboardShortcuts();
        document.body.appendChild(shortcuts);

        // Enhance buttons
        this.enhancePaletteButtons();
    },

    hideEnhancedUI() {
        const existing = document.querySelectorAll('.palette-history, .keyboard-shortcuts');
        existing.forEach(el => el.remove());
    },
});
