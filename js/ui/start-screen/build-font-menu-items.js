"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    buildFontMenuItems() {
        const ua = (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager : null;
        return [
            {
                name: 'Family',
                value: ua ? ua.font : 'COURIER',
                options: ua ? ua.getFontOptions() : ['COURIER', 'MONO', 'SYSTEM', 'SERIF'],
                type: 'font'
            },
            {
                name: 'H1',
                value: ua ? ua.fontSizes.h1 : '28',
                options: ua ? ua.getFontSizeOptions('h1') : ['20', '24', '28', '32', '36', '40', '48'],
                type: 'fontSize',
                sizeKey: 'h1'
            },
            {
                name: 'H2 Labels',
                value: ua ? ua.fontSizes.h2 : '14',
                options: ua ? ua.getFontSizeOptions('h2') : ['10', '11', '12', '14', '16', '18', '20', '24'],
                type: 'fontSize',
                sizeKey: 'h2'
            },
            {
                name: 'Text',
                value: ua ? ua.fontSizes.text : '12',
                options: ua ? ua.getFontSizeOptions('text') : ['8', '9', '10', '11', '12', '14', '16', '18'],
                type: 'fontSize',
                sizeKey: 'text'
            }
        ];
    },

    getGlobalLookValue(key, fallback) {
        if (typeof colorPaletteSystem === 'undefined' || !colorPaletteSystem.getGlobalLook) {
            return String(fallback);
        }
        const look = colorPaletteSystem.getGlobalLook();
        return String(look[key] == null ? fallback : Math.round(look[key]));
    },

    syncFontMenuItems() {
        this.fontMenuItems = this.buildFontMenuItems();
    },

    loadDevMode() {
        try {
            return localStorage.getItem(this.devModeStorageKey) === 'true';
        } catch (e) {
            return false;
        }
    },

    saveDevMode() {
        try {
            localStorage.setItem(this.devModeStorageKey, this.devMode ? 'true' : 'false');
        } catch (e) { /* ignore */ }
    },

    toggleDevMode() {
        this.devMode = !this.devMode;
        this.saveDevMode();
        this.rebuildVisibleMenu();
        if (this.selectedIndex >= this.menuItems.length) {
            this.selectedIndex = Math.max(0, this.menuItems.length - 1);
        }
        this.createStartScreenUI();
    },

    isMenuItemVisible(itemId) {
        // Already inside the station modal — STATION entry is redundant.
        if (itemId === 'STATION') {
            return !(this.embeddedMode || this.overlayMode);
        }
        if (itemId === 'SETTINGS' || itemId === 'ASSETS' || itemId === 'CREDITS') {
            return true;
        }
        if (this.devMode) return true;

        const hasProfile = typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
        if (itemId === 'PROFILES') {
            return hasProfile;
        }
        return false;
    },

    isExploreItemVisible(itemId) {
        if (this.devMode) return true;
        if (typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) return false;
        if (itemId === 'SHIPS') return profileManager.hasDiscovered('ships');
        if (itemId === 'PLANETS') return profileManager.hasDiscovered('planets');
        if (itemId === 'ENEMIES') return profileManager.hasDiscovered('enemies');
        if (itemId === 'FACTIONS') return profileManager.hasDiscovered('factions');
        if (itemId === 'EVENTS') return profileManager.hasDiscovered('events');
        if (itemId === 'WEAPONS') return profileManager.hasDiscovered('weapons');
        if (itemId === 'ABILITIES') return profileManager.hasDiscovered('abilities');
        if (itemId === 'DEFENSE SYSTEMS') return profileManager.hasDiscovered('defenses');
        if (itemId === 'COMPONENTS') {
            return profileManager.hasDiscovered('weapons')
                || profileManager.hasDiscovered('abilities')
                || profileManager.hasDiscovered('defenses');
        }
        return false;
    },

    rebuildVisibleMenu() {
        this.visibleMenuClusters = this.menuClusters.map((cluster) => {
            const items = cluster.items.filter((entry) => this.isMenuItemVisible(entry.id));
            return { id: cluster.id, label: cluster.label, items: items };
        }).filter((cluster) => cluster.items.length > 0);

        this.menuItems = this.visibleMenuClusters.reduce((acc, cluster) => {
            return acc.concat(cluster.items.map((item) => item.id));
        }, []);
    },

    get planets() {
        if (typeof planetSelectionManager !== 'undefined') {
            return planetSelectionManager.planets;
        }
        return [];
    },

    hasActiveProfile() {
        return typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
    },

    /** Hub after leave/quit: Station when profile loaded, else start menu. */
    returnToHub(options) {
        const opts = options || {};
        if (this.hasActiveProfile() && typeof homeStationUI !== 'undefined') {
            this.hide();
            homeStationUI.show(opts);
            return;
        }
        this.show(Object.assign({}, opts, { forceMenu: true }));
    },

    isOverlayOpen() {
        return !!(this.overlayMode && this.visible && this.overlayEl);
    },

    isEmbeddedOpen() {
        return !!(this.embeddedMode && this.visible && this.embeddedHost);
    },

    isStationMenuContext() {
        return this.isOverlayOpen() || this.isEmbeddedOpen();
    },

    getUIHost() {
        if (this.embeddedMode && this.embeddedHost) {
            return this.embeddedHost;
        }
        if (this.overlayMode && this.overlayEl) {
            return this.overlayEl.querySelector('.hs-main-menu-host') || this.overlayEl;
        }
        return document.getElementById('startScreen');
    },

    show(options) {
        const opts = options || {};

        if (opts.asOverlay) {
            // With profile: embed menu as station tab (no separate overlay BG).
            if (!this.hasActiveProfile()) {
                this.show(Object.assign({}, opts, { asOverlay: false, forceMenu: true }));
                return;
            }
            if (typeof homeStationUI !== 'undefined') {
                if (!homeStationUI.isVisible) {
                    homeStationUI.show({
                        skipPersist: opts.skipPersist,
                        tab: opts.tab,
                        shopCategory: opts.shopCategory
                    });
                }
                homeStationUI.openMainMenuOverlay({
                    force: true,
                    showSettings: !!opts.showSettings,
                    showCredits: !!opts.showCredits,
                    skipPersist: !!opts.skipPersist
                });
                return;
            }
            this.showOverlay(opts);
            return;
        }

        // Profile loaded → Station is the hub; fullscreen start menu only without profile.
        if (!opts.forceMenu && this.hasActiveProfile() && typeof homeStationUI !== 'undefined') {
            this.hide();
            const startScreen = document.getElementById('startScreen');
            if (startScreen) startScreen.classList.add('hidden');
            homeStationUI.show({
                skipPersist: opts.skipPersist,
                tab: opts.tab,
                shopCategory: opts.shopCategory,
                onClose: opts.onClose
            });
            return;
        }

        this.hideEmbedded();
        this.teardownOverlay();
        this.overlayMode = false;
        this.visible = true;
        this.rebuildVisibleMenu();
        // Restore menu theme before baking icon data-URLs (context theme may still be active after gameplay)
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.restoreAppTheme();
            if (this.settingsItems && this.settingsItems[0] && this.settingsItems[0].type === 'palette') {
                this.settingsItems[0].value = themeContextManager.getAppTheme();
            }
            this.syncSecondBaseSettingValue();
        }
        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.remove('hidden');
        this.createStartScreenUI();
        if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
            soundManager.startMenuMusic();
        }
        const skipPersist = opts.skipPersist;
        if (!skipPersist && typeof menuStateManager !== 'undefined') {
            if (this.showSettings) menuStateManager.setScreen('settings');
            else if (this.showCredits) menuStateManager.setScreen('credits');
            else menuStateManager.setScreen('start');
        }
    },
});
