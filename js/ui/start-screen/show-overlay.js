"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    showOverlay(options) {
        const opts = options || {};
        this.hideEmbedded();
        this.overlayMode = true;
        this.visible = true;
        this.onOverlayClose = typeof opts.onOverlayClose === 'function' ? opts.onOverlayClose : null;
        if (opts.showSettings) this.showSettings = true;
        if (opts.showCredits) this.showCredits = true;
        if (opts.resetPanels) {
            this.showSettings = false;
            this.showCredits = false;
            this.showFontMenu = false;
            this.showLevels = false;
        }

        this.rebuildVisibleMenu();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
            if (this.settingsItems && this.settingsItems[0] && this.settingsItems[0].type === 'palette') {
                this.settingsItems[0].value = themeContextManager.getAppTheme();
            }
        }

        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.add('hidden');

        if (!this.overlayEl || !this.overlayEl.isConnected) {
            this.overlayEl = document.createElement('div');
            this.overlayEl.className = 'hs-main-menu-overlay';
            this.overlayEl.innerHTML = '<div class="hs-main-menu-host"></div>';
            this.overlayEl.addEventListener('click', (e) => {
                if (e.target === this.overlayEl) this.hideOverlay();
            });
            const mount = document.body;
            mount.appendChild(this.overlayEl);
        }

        this.createStartScreenUI();
        const skipPersist = opts.skipPersist;
        if (!skipPersist && typeof menuStateManager !== 'undefined') {
            if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) homeStationUI.persistTab();
            else if (this.showSettings) menuStateManager.setScreen('settings');
            else if (this.showCredits) menuStateManager.setScreen('credits');
            else if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                homeStationUI.persistTab();
            }
        }
    },

    showEmbedded(options) {
        const opts = options || {};
        this.teardownOverlay();
        this.overlayMode = false;
        this.embeddedMode = true;
        this.visible = true;
        this.embeddedHost = opts.host || null;
        if (!this.embeddedHost) return;

        if (opts.tab && this.embeddedMenuTabs.some((t) => t.id === opts.tab)) this.embeddedMenuTab = opts.tab;
        else if (opts.showSettings) this.embeddedMenuTab = 'settings';
        else if (opts.showCredits) this.embeddedMenuTab = 'credits';
        else if (opts.resetPanels || !this.embeddedMenuTab) this.embeddedMenuTab = 'settings';
        this.syncEmbeddedFlags();

        if (opts.resetPanels && !opts.showSettings && !opts.showCredits) {
            this.showFontMenu = false;
            this.showLevels = false;
        }

        this.rebuildVisibleMenu();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
            if (this.settingsItems && this.settingsItems[0] && this.settingsItems[0].type === 'palette') {
                this.settingsItems[0].value = themeContextManager.getAppTheme();
            }
        }

        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.add('hidden');

        this.createStartScreenUI();
        const skipPersist = opts.skipPersist;
        if (!skipPersist && typeof menuStateManager !== 'undefined') {
            // Inside the station the open menu tab is station state.
            if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) homeStationUI.persistTab();
            else if (this.showSettings) menuStateManager.setScreen('settings');
            else if (this.showCredits) menuStateManager.setScreen('credits');
        }
    },

    syncEmbeddedFlags() {
        this.showSettings = this.embeddedMode && this.embeddedMenuTab === 'settings';
        this.showCredits = this.embeddedMode && this.embeddedMenuTab === 'credits';
    },

    setEmbeddedMenuTab(tabId) {
        const ok = this.embeddedMenuTabs.some((t) => t.id === tabId);
        if (!ok) return;
        this.embeddedMenuTab = tabId;
        this.showFontMenu = false;
        this.syncEmbeddedFlags();
        this.createStartScreenUI();
        if (typeof menuStateManager !== 'undefined') {
            if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) homeStationUI.persistTab();
            else if (tabId === 'settings') menuStateManager.setScreen('settings');
            else if (tabId === 'credits') menuStateManager.setScreen('credits');
            else if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                homeStationUI.persistTab();
            }
        }
    },

    cycleEmbeddedMenuTab(dir) {
        const ids = this.embeddedMenuTabs.map((t) => t.id);
        const idx = ids.indexOf(this.embeddedMenuTab);
        const next = (idx + dir + ids.length) % ids.length;
        this.setEmbeddedMenuTab(ids[next]);
    },

    hideEmbedded() {
        if (!this.embeddedMode && !this.embeddedHost) {
            return;
        }
        this.embeddedMode = false;
        if (this.embeddedHost) {
            this.embeddedHost.innerHTML = '';
        }
        this.embeddedHost = null;
        if (!this.overlayMode) {
            this.visible = false;
            this.showSettings = false;
            this.showCredits = false;
            this.showFontMenu = false;
            this.showLevels = false;
        }
    },

    hideOverlay() {
        const cb = this.onOverlayClose;
        this.teardownOverlay();
        this.overlayMode = false;
        this.visible = false;
        this.showSettings = false;
        this.showCredits = false;
        this.showFontMenu = false;
        this.showLevels = false;
        this.onOverlayClose = null;
        if (typeof cb === 'function') cb();
        if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
            homeStationUI.persistTab();
        }
    },

    teardownOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
    },

    hide() {
        this.visible = false;
        this.hideEmbedded();
        this.teardownOverlay();
        this.overlayMode = false;
        this.onOverlayClose = null;
        this.removeStartScreenUI();
        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.add('hidden');
    },

    createStartScreenUI() {
        const host = this.getUIHost();
        if (!host) {
            console.error('Start screen host not found');
            return;
        }

        if (!this._settingsOutsideClickBound) {
            this._settingsOutsideClickBound = true;
            const startScreen = document.getElementById('startScreen');
            if (startScreen) {
                startScreen.addEventListener('click', (e) => {
                    if (e.target === startScreen && this.showSettings && !this.overlayMode && !this.embeddedMode) {
                        this.handleEscape();
                    }
                });
            }
        }

        if (this.overlayMode || this.embeddedMode) {
            host.innerHTML = '';
        } else {
            // Keep parallax BG layers across rebuilds (enables crossfade, avoids black flash)
            const keep = Array.from(host.querySelectorAll(
                ':scope > .vf-bg-parallax-base, :scope > .vf-bg-parallax-glow'
            ));
            host.innerHTML = '';
            for (let i = keep.length - 1; i >= 0; i--) {
                host.insertBefore(keep[i], host.firstChild);
            }
        }

        // Create content container
        const content = document.createElement('div');
        if (this.embeddedMode) {
            content.className = 'start-screen-content start-screen-content-overlay start-screen-content-embedded';
        } else {
            content.className = 'start-screen-content' +
                (this.overlayMode ? ' start-screen-content-overlay' : '');
        }

        if (this.embeddedMode) {
            if (this.showFontMenu) {
                this.createFontMenuUI(content);
            } else {
                this.createEmbeddedMenuUI(content);
            }
        } else if (this.showCredits) {
            this.createCreditsUI(content);
        } else if (this.showFontMenu) {
            this.createFontMenuUI(content);
        } else if (this.showSettings) {
            this.createSettingsUI(content);
        } else if (this.showLevels) {
            this.createLevelsUI(content);
        } else {
            this.createMainMenuUI(content);
        }

        host.appendChild(content);

        // Update menu selection
        this.updateMenuSelection();

        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
    },
});
