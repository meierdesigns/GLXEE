"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    buildControlsShowBtn() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-controls-show-btn';
        btn.title = 'Show controls (Shift+H)';
        btn.setAttribute('aria-label', 'Show controls');
        btn.textContent = '?';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.setControlsHintsVisible(true);
        });
        return btn;
    },

    setControlsHintsVisible(visible) {
        if (typeof uiAppearanceManager === 'undefined') return;
        uiAppearanceManager.setControlsHints(visible ? 'ON' : 'OFF');
        this.syncControlsSettingFromAppearance();
    },

    syncControlsSettingFromAppearance() {
        const item = this.settingsItems && this.settingsItems.find((s) => s.type === 'controlsHints');
        if (item && typeof uiAppearanceManager !== 'undefined') {
            item.value = uiAppearanceManager.controlsHints;
        }
    },

    updateMenuSelection() {
        const startScreen = this.getUIHost();
        const scope = startScreen || document;
        let currentIndex = 0;

        if (this.showSettings || this.showFontMenu) {
            currentIndex = this.showFontMenu ? this.fontMenuIndex : this.settingsIndex;
        } else if (this.showLevels) {
            currentIndex = this.levelIndex;
        } else {
            currentIndex = this.selectedIndex;
        }

        if (this.showSettings) {
            scope.querySelectorAll('.settings-row[data-settings-index]').forEach((item) => {
                const idx = Number(item.dataset.settingsIndex);
                item.classList.toggle('selected', idx === currentIndex);
            });
            scope.querySelectorAll('.settings-cluster').forEach((cluster) => {
                cluster.classList.toggle('active', !!cluster.querySelector('.settings-row.selected'));
            });
            this.ensureSettingsRowVisible(scope);
            return;
        }

        if (this.showFontMenu) {
            scope.querySelectorAll('.settings-row[data-font-index]').forEach((item) => {
                const idx = Number(item.dataset.fontIndex);
                item.classList.toggle('selected', idx === currentIndex);
            });
            this.ensureSettingsRowVisible(scope);
            return;
        }

        const menuItems = scope.querySelectorAll('.menu-item');
        const clustered = scope.querySelector('.start-screen-menu-clustered');
        if (clustered && !this.showLevels) {
            clustered.querySelectorAll('.menu-item').forEach((item) => {
                const idx = Number(item.dataset.menuIndex);
                item.classList.toggle('selected', idx === currentIndex);
            });
        } else {
            menuItems.forEach((item, index) => {
                item.classList.toggle('selected', index === currentIndex);
            });
        }

        const clusters = scope.querySelectorAll('.menu-cluster');
        clusters.forEach((cluster) => {
            const hasSelected = !!cluster.querySelector('.menu-item.selected');
            cluster.classList.toggle('active', hasSelected);
        });
    },

    ensureSettingsRowVisible(scope) {
        const panel = scope.querySelector('.settings-panel');
        const selected = scope.querySelector('.settings-row.selected');
        if (!panel || !selected) return;

        const panelRect = panel.getBoundingClientRect();
        const rowRect = selected.getBoundingClientRect();
        if (rowRect.top < panelRect.top) {
            panel.scrollTop -= (panelRect.top - rowRect.top);
        } else if (rowRect.bottom > panelRect.bottom) {
            panel.scrollTop += (rowRect.bottom - panelRect.bottom);
        }
    },

    removeStartScreenUI() {
        this.teardownOverlay();
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
            // Keep parallax BG layers so handoff fades still have a source frame.
            const keep = Array.from(startScreen.querySelectorAll(
                ':scope > .vf-bg-parallax-base, :scope > .vf-bg-parallax-glow'
            ));
            startScreen.innerHTML = '';
            for (let i = keep.length - 1; i >= 0; i--) {
                startScreen.insertBefore(keep[i], startScreen.firstChild);
            }
        }

        // Show game canvas again
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.style.display = 'block';
        }
    },

    isVisible() {
        return this.visible;
    },

    update(deltaTime) {
        if (this.visible) {
            this.blinkTimer++;
            if (this.blinkTimer >= this.blinkSpeed) {
                this.blinkTimer = 0;
            }
        }
    },

    // All rendering is now HTML-based, no canvas rendering needed

    handleKeyDown(event) {
        if (!this.visible) return false;

        if (!this.showCredits && !this.showLevels && !this.showFontMenu &&
            !(this.showSettings && !this.embeddedMode) &&
            event.shiftKey && (event.key === 'c' || event.key === 'C')) {
            event.preventDefault();
            this.toggleDevMode();
            return true;
        }

        if (this.embeddedMode && !this.showFontMenu &&
            event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            this.cycleEmbeddedMenuTab(event.key === 'ArrowLeft' ? -1 : 1);
            return true;
        }

        if (this.embeddedMode && !this.showFontMenu && !this.showSettings &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            this.cycleEmbeddedMenuTab(event.key === 'ArrowLeft' ? -1 : 1);
            return true;
        }

        if (event.shiftKey && (event.key === 'h' || event.key === 'H')) {
            event.preventDefault();
            if (typeof uiAppearanceManager !== 'undefined') {
                uiAppearanceManager.toggleControlsHints();
                this.syncControlsSettingFromAppearance();
                if (this.showSettings || this.embeddedMode) this.createStartScreenUI();
            }
            return true;
        }

        const handlers = {
            'Escape': () => this.handleEscape(),
            'Backspace': () => this.handleEscape(),
            'ArrowUp': () => this.handleArrowUp(),
            'ArrowDown': () => this.handleArrowDown(),
            'ArrowLeft': () => this.handleArrowLeft(),
            'ArrowRight': () => this.handleArrowRight(),
            'Enter': () => this.handleEnter(),
            ' ': () => this.handleEnter()
        };

        const handler = handlers[event.key];
        return handler ? handler() : false;
    },

    handleEscape() {
        if (this.showFontMenu) {
            this.showFontMenu = false;
            this.createStartScreenUI();
            if (typeof menuStateManager !== 'undefined') {
                menuStateManager.setScreen('settings');
            }
            return true;
        }
        if (this.embeddedMode) {
            if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                homeStationUI.closeMenuTab();
            } else {
                this.hideEmbedded();
            }
            return true;
        }
        if (this.showCredits || this.showLevels || this.showSettings) {
            this.showCredits = false;
            this.showLevels = false;
            this.showSettings = false;
            this.showFontMenu = false;
            this.themeDropdownOpen = false;
            this.createStartScreenUI();
            if (typeof menuStateManager !== 'undefined') {
                menuStateManager.setScreen('start');
            }
            return true;
        }
        if (this.overlayMode) {
            this.hideOverlay();
            return true;
        }
        return false;
    },

    handleArrowUp() {
        if (this.showLevels) {
            this.levelIndex = Math.max(0, this.levelIndex - 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showFontMenu) {
            this.fontMenuIndex = Math.max(0, this.fontMenuIndex - 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showSettings) {
            this.settingsIndex = Math.max(0, this.settingsIndex - 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showCredits) {
            return false;
        } else {
            if (this.navigateMainMenuSpatially('up')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const ranges = this.getClusterIndexRanges();
            if (cur.clusterId && ranges[cur.clusterId] && this.selectedIndex > ranges[cur.clusterId].start) {
                this.selectedIndex -= 1;
                this.updateMenuSelection();
                return true;
            }
            const up = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].up : null;
            if (up) return this.jumpToCluster(up, cur.offset);
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateMenuSelection();
            return true;
        }
    },
});
