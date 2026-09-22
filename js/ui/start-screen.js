"use strict";

class StartScreenManager {
    constructor() {
        this.visible = true;
        this.overlayMode = false;
        this.overlayEl = null;
        this.onOverlayClose = null;
        this.embeddedMode = false;
        this.embeddedHost = null;
        this.embeddedMenuTab = 'settings';
        this.embeddedMenuTabs = [
            { id: 'profiles', label: 'PROFILES', icon: 'menuProfiles' },
            { id: 'settings', label: 'SETTINGS', icon: 'menuSettings' },
            { id: 'assets', label: 'ASSETS', icon: 'menuAssets' },
            { id: 'credits', label: 'CREDITS', icon: 'menuCredits' }
        ];
        this.title = "GLXEE";
        this.subtitle = "Game Boy Edition";
        this.menuClusters = [
            {
                id: 'main',
                label: '',
                items: [
                    { id: 'STATION', icon: 'hsStation', primary: true },
                    { id: 'PROFILES', icon: 'menuProfiles' },
                    { id: 'SETTINGS', icon: 'menuSettings' },
                    { id: 'ASSETS', icon: 'menuAssets' },
                    { id: 'CREDITS', icon: 'menuCredits' }
                ]
            }
        ];
        this.devModeStorageKey = 'vf_dev_mode_v1';
        this.devMode = this.loadDevMode();
        this.visibleMenuClusters = [];
        this.rebuildVisibleMenu();
        this.menuIconById = {};
        this.menuClusters.forEach((cluster) => {
            cluster.items.forEach((item) => {
                this.menuIconById[item.id] = item.icon;
            });
        });
        this.selectedIndex = 0;
        this.blinkTimer = 0;
        this.blinkSpeed = 30; // frames
        this.showCredits = false;
        this.showSettings = false;
        this.showFontMenu = false;
        this.showLevels = false;
        this.settingsIndex = 0;
        this.fontMenuIndex = 0;
        this.levelIndex = 0;
        this.settingsItems = [
            { name: 'App Theme', value: 'grayscale', type: 'palette' },
            {
                name: '2nd Base',
                value: (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getSecondBaseColor)
                    ? colorPaletteSystem.getSecondBaseColor()
                    : '#FFFFFF',
                type: 'secondBase'
            },
            {
                name: 'Brightness',
                value: this.getGlobalLookValue('brightness', 50),
                type: 'globalLook',
                lookKey: 'brightness',
                suffix: '%',
                min: 0,
                max: 200,
                step: 5
            },
            {
                name: 'Contrast',
                value: this.getGlobalLookValue('contrast', 68),
                type: 'globalLook',
                lookKey: 'contrast',
                suffix: '%',
                min: 0,
                max: 200,
                step: 5
            },
            {
                name: 'Saturation',
                value: this.getGlobalLookValue('saturation', 100),
                type: 'globalLook',
                lookKey: 'saturation',
                suffix: '%',
                min: 0,
                max: 200,
                step: 5
            },
            {
                name: 'Grayscale',
                value: this.getGlobalLookValue('saturation', 100) === '0' ? 'ON' : 'OFF',
                options: ['OFF', 'ON'],
                type: 'grayscale'
            },
            {
                name: 'Line Weight',
                value: (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.borderWeight : 'NORMAL',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getBorderWeightOptions()
                    : ['THIN', 'NORMAL', 'THICK', 'HEAVY'],
                type: 'borderWeight'
            },
            {
                name: 'Indicator',
                value: (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.indicatorWeight : '2',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getIndicatorWeightOptions()
                    : ['1', '2', '3', '4', '5', '6'],
                type: 'indicatorWeight'
            },
            {
                name: 'Font',
                value: '›',
                type: 'fontMenu'
            },
            {
                name: 'BG Parallax',
                value: (typeof VFBgMouseParallax !== 'undefined')
                    ? VFBgMouseParallax.getIntensity()
                    : 'NORMAL',
                options: (typeof VFBgMouseParallax !== 'undefined')
                    ? VFBgMouseParallax.getIntensityOptions()
                    : ['OFF', 'LOW', 'NORMAL', 'HIGH'],
                type: 'bgParallax'
            },
            {
                name: 'Controls',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.controlsHints
                    : 'ON',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getControlsHintsOptions()
                    : ['ON', 'OFF'],
                type: 'controlsHints'
            },
            {
                name: 'UI Glow',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('glow')
                    : 'OFF',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('glow')
                    : ['OFF', 'LOW', 'MED', 'HIGH'],
                type: 'uiFx',
                fxKey: 'glow'
            },
            {
                name: 'Scanlines',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('scanlines')
                    : 'OFF',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('scanlines')
                    : ['OFF', 'LOW', 'MED', 'HIGH'],
                type: 'uiFx',
                fxKey: 'scanlines'
            },
            {
                name: 'CRT',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('crt')
                    : 'OFF',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('crt')
                    : ['OFF', 'LOW', 'MED', 'HIGH'],
                type: 'uiFx',
                fxKey: 'crt'
            },
            {
                name: 'Chroma',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('chroma')
                    : 'OFF',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('chroma')
                    : ['OFF', 'LOW', 'HIGH'],
                type: 'uiFx',
                fxKey: 'chroma'
            },
            {
                name: 'Arcade',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('arcade')
                    : 'OFF',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('arcade')
                    : ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'arcade'
            },
            { name: 'Volume', type: 'volume' },
            { name: 'Sound', value: 'ON', options: ['ON', 'OFF'] },
            { name: 'Music', value: 'ON', options: ['ON', 'OFF'] },
            {
                name: 'Menu Soundtrack',
                value: (typeof youtubeSoundtrackManager !== 'undefined')
                    ? (youtubeSoundtrackManager.getMenuUrl() || '')
                    : '',
                type: 'youtubeUrl'
            },
            {
                name: 'Difficulty',
                value: (typeof difficultyConfigManager !== 'undefined')
                    ? String(difficultyConfigManager.current || 'normal').toUpperCase()
                    : 'NORMAL',
                options: ['EASY', 'NORMAL', 'HARD']
            },
            {
                name: 'Combat Tuning',
                value: 'OPEN ›',
                type: 'action',
                action: 'difficultyEditor'
            },
            {
                name: 'Faction Command',
                value: 'OPEN ›',
                type: 'action',
                action: 'factionCommand'
            },
            {
                name: 'Asset Generator',
                value: 'OPEN ›',
                type: 'action',
                action: 'assetGen'
            },
            {
                name: 'Faction Emblems',
                value: 'OPEN ›',
                type: 'action',
                action: 'assetGenFaction'
            },
            {
                name: 'Faction Ships',
                value: 'OPEN ›',
                type: 'action',
                action: 'assetGenFactionShips'
            },
            {
                name: 'Bridge',
                value: '…',
                type: 'assetStatus'
            }
        ];
        this.fontMenuItems = this.buildFontMenuItems();
        
        // Planets are now managed by PlanetSelectionManager

        // Initialize from app theme (menus only)
        if (typeof themeContextManager !== 'undefined') {
            this.settingsItems[0].value = themeContextManager.getAppTheme();
            themeContextManager.restoreAppTheme();
        } else if (typeof colorManager !== 'undefined') {
            this.settingsItems[0].value = colorManager.getCurrentPalette();
        }
        if (typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.apply();
        }
    }

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
    }

    getGlobalLookValue(key, fallback) {
        if (typeof colorPaletteSystem === 'undefined' || !colorPaletteSystem.getGlobalLook) {
            return String(fallback);
        }
        const look = colorPaletteSystem.getGlobalLook();
        return String(look[key] == null ? fallback : Math.round(look[key]));
    }

    syncFontMenuItems() {
        this.fontMenuItems = this.buildFontMenuItems();
    }

    loadDevMode() {
        try {
            return localStorage.getItem(this.devModeStorageKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    saveDevMode() {
        try {
            localStorage.setItem(this.devModeStorageKey, this.devMode ? 'true' : 'false');
        } catch (e) { /* ignore */ }
    }

    toggleDevMode() {
        this.devMode = !this.devMode;
        this.saveDevMode();
        this.rebuildVisibleMenu();
        if (this.selectedIndex >= this.menuItems.length) {
            this.selectedIndex = Math.max(0, this.menuItems.length - 1);
        }
        this.createStartScreenUI();
    }

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
    }

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
    }

    rebuildVisibleMenu() {
        this.visibleMenuClusters = this.menuClusters.map((cluster) => {
            const items = cluster.items.filter((entry) => this.isMenuItemVisible(entry.id));
            return { id: cluster.id, label: cluster.label, items: items };
        }).filter((cluster) => cluster.items.length > 0);

        this.menuItems = this.visibleMenuClusters.reduce((acc, cluster) => {
            return acc.concat(cluster.items.map((item) => item.id));
        }, []);
    }

    get planets() {
        if (typeof planetSelectionManager !== 'undefined') {
            return planetSelectionManager.planets;
        }
        return [];
    }

    hasActiveProfile() {
        return typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
    }

    /** Hub after leave/quit: Station when profile loaded, else start menu. */
    returnToHub(options) {
        const opts = options || {};
        if (this.hasActiveProfile() && typeof homeStationUI !== 'undefined') {
            this.hide();
            homeStationUI.show(opts);
            return;
        }
        this.show(Object.assign({}, opts, { forceMenu: true }));
    }

    isOverlayOpen() {
        return !!(this.overlayMode && this.visible && this.overlayEl);
    }

    isEmbeddedOpen() {
        return !!(this.embeddedMode && this.visible && this.embeddedHost);
    }

    isStationMenuContext() {
        return this.isOverlayOpen() || this.isEmbeddedOpen();
    }

    getUIHost() {
        if (this.embeddedMode && this.embeddedHost) {
            return this.embeddedHost;
        }
        if (this.overlayMode && this.overlayEl) {
            return this.overlayEl.querySelector('.hs-main-menu-host') || this.overlayEl;
        }
        return document.getElementById('startScreen');
    }

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
    }

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
            if (this.showSettings) menuStateManager.setScreen('settings');
            else if (this.showCredits) menuStateManager.setScreen('credits');
            else if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                homeStationUI.persistTab();
            }
        }
    }

    showEmbedded(options) {
        const opts = options || {};
        this.teardownOverlay();
        this.overlayMode = false;
        this.embeddedMode = true;
        this.visible = true;
        this.embeddedHost = opts.host || null;
        if (!this.embeddedHost) return;

        if (opts.showSettings) this.embeddedMenuTab = 'settings';
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
            if (this.showSettings) menuStateManager.setScreen('settings');
            else if (this.showCredits) menuStateManager.setScreen('credits');
            else if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                homeStationUI.persistTab();
            }
        }
    }

    syncEmbeddedFlags() {
        this.showSettings = this.embeddedMode && this.embeddedMenuTab === 'settings';
        this.showCredits = this.embeddedMode && this.embeddedMenuTab === 'credits';
    }

    setEmbeddedMenuTab(tabId) {
        const ok = this.embeddedMenuTabs.some((t) => t.id === tabId);
        if (!ok) return;
        this.embeddedMenuTab = tabId;
        this.showFontMenu = false;
        this.syncEmbeddedFlags();
        this.createStartScreenUI();
        if (typeof menuStateManager !== 'undefined') {
            if (tabId === 'settings') menuStateManager.setScreen('settings');
            else if (tabId === 'credits') menuStateManager.setScreen('credits');
            else if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                homeStationUI.persistTab();
            }
        }
    }

    cycleEmbeddedMenuTab(dir) {
        const ids = this.embeddedMenuTabs.map((t) => t.id);
        const idx = ids.indexOf(this.embeddedMenuTab);
        const next = (idx + dir + ids.length) % ids.length;
        this.setEmbeddedMenuTab(ids[next]);
    }

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
    }

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
    }

    teardownOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
    }

    hide() {
        this.visible = false;
        this.hideEmbedded();
        this.teardownOverlay();
        this.overlayMode = false;
        this.onOverlayClose = null;
        this.removeStartScreenUI();
        const startScreen = document.getElementById('startScreen');
        if (startScreen) startScreen.classList.add('hidden');
    }

    createStartScreenUI() {
        const host = this.getUIHost();
        if (!host) {
            console.error('Start screen host not found');
            return;
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
    }
    
    createMainMenuUI(content) {
        this.rebuildVisibleMenu();
        if (this.selectedIndex >= this.menuItems.length) {
            this.selectedIndex = Math.max(0, this.menuItems.length - 1);
        }

        const title = document.createElement('h1');
        title.textContent = 'GLXEE';
        title.className = 'start-screen-title';
        
        const subtitle = document.createElement('p');
        subtitle.textContent = 'RETRO SPACE SHOOTER';
        subtitle.className = 'start-screen-subtitle';

        const profileLine = document.createElement('p');
        profileLine.className = 'start-screen-profile';
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const p = profileManager.getActiveProfile();
            profileLine.textContent = `PROFILE: ${p.name}`;
        } else {
            profileLine.textContent = 'PROFILE: NONE';
            profileLine.classList.add('no-profile');
        }

        const menu = document.createElement('div');
        menu.className = 'start-screen-menu start-screen-menu-clustered';

        let flatIndex = 0;
        this.visibleMenuClusters.forEach((cluster) => {
            const group = document.createElement('div');
            group.className = 'menu-cluster';
            group.dataset.cluster = cluster.id;

            if (cluster.label) {
                const header = document.createElement('div');
                header.className = 'menu-cluster-title';
                header.textContent = cluster.label;
                group.appendChild(header);
            }

            cluster.items.forEach((entry) => {
                const index = flatIndex;
                flatIndex += 1;
                const itemId = entry.id;
                const menuItem = document.createElement('div');
                const primaryClass = entry.primary ? ' menu-item-primary' : '';
                menuItem.className = `menu-item${primaryClass}${index === this.selectedIndex ? ' selected' : ''}`;
                menuItem.dataset.menuIndex = String(index);
                menuItem.dataset.cluster = cluster.id;

                const iconWrap = document.createElement('span');
                iconWrap.className = 'menu-item-icon';
                const iconKey = entry.icon || this.menuIconById[itemId];
                if (typeof iconRenderer !== 'undefined' && iconKey) {
                    iconWrap.innerHTML = iconRenderer.imgHtml(iconKey, 32, 'menu-pixel-icon');
                }

                const label = document.createElement('span');
                label.className = 'menu-item-label';
                label.textContent = itemId;

                menuItem.appendChild(iconWrap);
                menuItem.appendChild(label);
                menuItem.addEventListener('mouseenter', () => {
                    this.selectedIndex = index;
                    this.updateMenuSelection();
                });
                menuItem.addEventListener('click', () => {
                    this.selectedIndex = index;
                    this.updateMenuSelection();
                    this.selectMenuItem();
                });
                group.appendChild(menuItem);
            });

            menu.appendChild(group);
        });

        const instructions = this.buildControlsHint([
            'ARROW KEYS / MOUSE: Navigate',
            'SPACEBAR / CLICK: Select'
        ]);

        const footer = document.createElement('div');
        footer.className = 'start-screen-footer';
        if (this.devMode) {
            footer.innerHTML =
                '<span class="dev-mode-badge">DEV MODE ON</span>' +
                '<span class="dev-mode-hint">SHIFT+C TOGGLE</span>' +
                '<span class="dev-mode-hint-block">' +
                'ARCHIVE: K Know/Forget • B Build/Unbuild • V Visit/Unvisit • C Clear/Unclear' +
                '</span>';
        } else {
            footer.innerHTML = '<span class="dev-mode-hint">SHIFT+C DEV MODE</span>';
        }

        content.appendChild(title);
        content.appendChild(subtitle);
        content.appendChild(profileLine);
        content.appendChild(menu);
        content.appendChild(instructions);
        content.appendChild(this.buildControlsShowBtn());
        content.appendChild(footer);
    }

    createEmbeddedMenuUI(content) {
        this.syncEmbeddedFlags();

        const header = document.createElement('div');
        header.className = 'hs-menu-panel-header';

        const brand = document.createElement('div');
        brand.className = 'hs-menu-panel-brand';
        const title = document.createElement('h1');
        title.className = 'start-screen-title hs-menu-panel-title';
        title.textContent = 'GLXEE';
        const profileLine = document.createElement('p');
        profileLine.className = 'start-screen-profile hs-menu-panel-profile';
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const p = profileManager.getActiveProfile();
            profileLine.textContent = `PROFILE: ${p.name}`;
        } else {
            profileLine.textContent = 'PROFILE: NONE';
            profileLine.classList.add('no-profile');
        }
        brand.appendChild(title);
        brand.appendChild(profileLine);
        header.appendChild(brand);

        const tabs = document.createElement('div');
        tabs.className = 'hs-menu-panel-tabs';
        this.embeddedMenuTabs.forEach((tab) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'hs-menu-panel-tab' + (tab.id === this.embeddedMenuTab ? ' active' : '');
            btn.dataset.menuTab = tab.id;
            const iconWrap = document.createElement('span');
            iconWrap.className = 'hs-menu-panel-tab-icon';
            if (typeof iconRenderer !== 'undefined' && tab.icon) {
                iconWrap.innerHTML = iconRenderer.imgHtml(tab.icon, 28, 'menu-pixel-icon');
            }
            const label = document.createElement('span');
            label.className = 'hs-menu-panel-tab-label';
            label.textContent = tab.label;
            btn.appendChild(iconWrap);
            btn.appendChild(label);
            btn.addEventListener('click', () => this.setEmbeddedMenuTab(tab.id));
            tabs.appendChild(btn);
        });
        header.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'hs-menu-panel-body';
        if (this.embeddedMenuTab === 'profiles') {
            this.fillEmbeddedProfiles(body);
        } else if (this.embeddedMenuTab === 'settings') {
            this.createSettingsUI(body, { bare: true });
        } else if (this.embeddedMenuTab === 'assets') {
            this.fillEmbeddedAssets(body);
        } else {
            body.classList.add('hs-menu-panel-body-credits');
            this.fillEmbeddedCredits(body);
        }

        const footer = document.createElement('div');
        footer.className = 'start-screen-footer hs-menu-panel-footer';
        footer.innerHTML = this.devMode
            ? '<span class="dev-mode-badge">DEV MODE ON</span><span class="dev-mode-hint">SHIFT+C TOGGLE</span>'
            : '<span class="dev-mode-hint">SHIFT+C DEV MODE</span>';

        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(this.buildControlsShowBtn());
        content.appendChild(footer);
    }

    fillEmbeddedProfiles(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section';

        const heading = document.createElement('h2');
        heading.className = 'hs-menu-panel-section-title';
        heading.textContent = 'PROFILES';
        panel.appendChild(heading);

        const active = document.createElement('p');
        active.className = 'hs-menu-panel-copy';
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const p = profileManager.getActiveProfile();
            active.textContent = `Active pilot: ${p.name}`;
        } else {
            active.textContent = 'No profile loaded.';
        }
        panel.appendChild(active);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-button hs-menu-panel-action';
        btn.textContent = 'MANAGE PROFILES';
        btn.addEventListener('click', () => {
            if (typeof profileSelectionManager === 'undefined') return;
            this.hideEmbedded();
            profileSelectionManager.show({
                onClose: () => {
                    if (this.hasActiveProfile()) {
                        this.returnToHub();
                    } else {
                        this.show({ forceMenu: true });
                    }
                }
            });
        });
        panel.appendChild(btn);
        body.appendChild(panel);
    }

    fillEmbeddedAssets(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section';

        const heading = document.createElement('h2');
        heading.className = 'hs-menu-panel-section-title';
        heading.textContent = 'ASSETS';
        panel.appendChild(heading);

        const status = document.createElement('p');
        status.className = 'hs-menu-panel-copy';
        status.dataset.assetStatus = '1';
        status.textContent = 'Bridge: …';
        panel.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'hs-menu-panel-actions';

        const mk = (label, opts) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'action-button hs-menu-panel-action';
            b.textContent = label;
            b.addEventListener('click', () => this.openAssetGenerator(opts));
            return b;
        };
        actions.appendChild(mk('OPEN GENERATOR', { returnToSettings: true }));
        actions.appendChild(mk('FACTIONS', { typeId: 'faction', returnToSettings: true }));
        actions.appendChild(mk('FACTION SHIPS', { typeId: 'faction', returnToSettings: true }));
        panel.appendChild(actions);
        body.appendChild(panel);

        this.refreshAssetBridgeStatus().then(() => {
            const item = this.settingsItems.find((s) => s.type === 'assetStatus');
            if (item && status.isConnected) {
                status.textContent = `Bridge: ${item.value}`;
                status.classList.toggle('settings-asset-ready', item.value === 'READY');
                status.classList.toggle('settings-asset-warn', /BRIDGE/.test(item.value));
                status.classList.toggle('settings-asset-off', item.value === 'OFFLINE');
            }
        });
    }

    fillEmbeddedCredits(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section hs-menu-panel-credits';
        panel.innerHTML =
            '<h2 class="hs-menu-panel-section-title">CREDITS</h2>' +
            '<div class="hs-credits-crawl-stage" aria-hidden="false">' +
            '<div class="hs-credits-crawl">' +
            '<div class="hs-credits-crawl-text">' +
            '<div class="hs-credits-crawl-line hs-credits-crawl-role">CREATOR</div>' +
            '<div class="hs-credits-crawl-line">LANCE MEIER / MEIERDESIGNS</div>' +
            '<div class="hs-credits-crawl-line">GLXEE</div>' +
            '<div class="hs-credits-crawl-line">RETRO SPACE SHOOTER</div>' +
            '<div class="hs-credits-crawl-line">GAME BOY STYLE</div>' +
            '</div>' +
            '</div>' +
            '</div>';
        body.appendChild(panel);
    }

    getClusterNavMap() {
        return {
            main: { up: null, down: null, left: null, right: null }
        };
    }

    getClusterIndexRanges() {
        const ranges = {};
        let start = 0;
        this.visibleMenuClusters.forEach((cluster) => {
            const end = start + cluster.items.length - 1;
            ranges[cluster.id] = { start: start, end: end };
            start = end + 1;
        });
        return ranges;
    }

    jumpToCluster(targetClusterId, preferOffset) {
        const ranges = this.getClusterIndexRanges();
        const range = ranges[targetClusterId];
        if (!range) return false;
        const offset = preferOffset != null ? preferOffset : 0;
        this.selectedIndex = Math.min(range.end, range.start + Math.max(0, offset));
        this.updateMenuSelection();
        return true;
    }

    getSelectedClusterOffset() {
        const ranges = this.getClusterIndexRanges();
        const id = this.menuItems[this.selectedIndex];
        let clusterId = null;
        this.visibleMenuClusters.forEach((c) => {
            if (c.items.some((item) => item.id === id)) clusterId = c.id;
        });
        if (!clusterId || !ranges[clusterId]) return { clusterId: null, offset: 0 };
        return {
            clusterId: clusterId,
            offset: this.selectedIndex - ranges[clusterId].start
        };
    }

    getMainMenuItemElements() {
        const host = this.getUIHost();
        if (!host) return [];
        return Array.from(host.querySelectorAll('.start-screen-menu-clustered .menu-item'));
    }

    /**
     * Spatial arrow nav: pick nearest item in direction, prefer same row/column.
     */
    navigateMainMenuSpatially(direction) {
        const items = this.getMainMenuItemElements();
        if (!items.length) return false;
        const current = items.find((el) => Number(el.dataset.menuIndex) === this.selectedIndex)
            || items[this.selectedIndex];
        if (!current) return false;
        const curRect = current.getBoundingClientRect();
        const cx = curRect.left + curRect.width / 2;
        const cy = curRect.top + curRect.height / 2;

        let best = null;
        let bestScore = Infinity;
        items.forEach((el) => {
            const idx = Number(el.dataset.menuIndex);
            if (idx === this.selectedIndex || Number.isNaN(idx)) return;
            const r = el.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const rowSlop = Math.max(18, curRect.height * 0.75);
            const colSlop = Math.max(24, curRect.width * 0.6);

            let ok = false;
            let primary = 0;
            let secondary = 0;
            if (direction === 'up') {
                ok = dy < -4;
                primary = -dy;
                secondary = absDx;
                if (absDx <= colSlop) secondary *= 0.15;
            } else if (direction === 'down') {
                ok = dy > 4;
                primary = dy;
                secondary = absDx;
                if (absDx <= colSlop) secondary *= 0.15;
            } else if (direction === 'left') {
                ok = dx < -4;
                primary = -dx;
                secondary = absDy;
                if (absDy <= rowSlop) secondary *= 0.1;
            } else if (direction === 'right') {
                ok = dx > 4;
                primary = dx;
                secondary = absDy;
                if (absDy <= rowSlop) secondary *= 0.1;
            }
            if (!ok) return;
            const score = primary + secondary * 2.5;
            if (score < bestScore) {
                bestScore = score;
                best = idx;
            }
        });

        if (best == null) return false;
        this.selectedIndex = best;
        this.updateMenuSelection();
        return true;
    }
    
    createSettingsUI(content, opts) {
        const bare = !!(opts && opts.bare);
        if (typeof VFBgMouseParallax !== 'undefined') {
            const parallaxItem = this.settingsItems.find(item => item.type === 'bgParallax');
            if (parallaxItem) parallaxItem.value = VFBgMouseParallax.getIntensity();
        }
        if (typeof uiAppearanceManager !== 'undefined') {
            this.settingsItems.forEach((item) => {
                if (item.type === 'uiFx' && item.fxKey) {
                    item.value = uiAppearanceManager.getFxValue(item.fxKey);
                }
            });
        }
        this.syncControlsSettingFromAppearance();
        const ytItem = this.settingsItems.find((item) => item.type === 'youtubeUrl');
        if (ytItem && typeof youtubeSoundtrackManager !== 'undefined') {
            ytItem.value = youtubeSoundtrackManager.getMenuUrl() || '';
        }
        const difficultyItem = this.settingsItems.find((item) => item.name === 'Difficulty');
        if (difficultyItem && typeof difficultyConfigManager !== 'undefined') {
            difficultyItem.value = String(difficultyConfigManager.current || 'normal').toUpperCase();
        }
        const look = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getGlobalLook)
            ? colorPaletteSystem.getGlobalLook() : null;
        const brightness = this.settingsItems.find((item) => item.lookKey === 'brightness');
        const contrast = this.settingsItems.find((item) => item.lookKey === 'contrast');
        const saturation = this.settingsItems.find((item) => item.lookKey === 'saturation');
        const grayscale = this.settingsItems.find((item) => item.type === 'grayscale');
        if (look) {
            if (brightness) brightness.value = String(Math.round(look.brightness));
            if (contrast) contrast.value = String(Math.round(look.contrast));
            if (saturation) saturation.value = String(Math.round(look.saturation));
            if (grayscale) grayscale.value = look.saturation === 0 ? 'ON' : 'OFF';
        }

        if (!bare) {
            const title = document.createElement('h2');
            title.textContent = 'SETTINGS';
            title.className = 'start-screen-title';
            content.appendChild(title);
        }

        const panel = document.createElement('div');
        panel.className = 'settings-panel settings-panel-clustered';

        const left = document.createElement('div');
        left.className = 'settings-cluster';
        left.dataset.cluster = 'appearance';

        const right = document.createElement('div');
        right.className = 'settings-cluster';
        right.dataset.cluster = 'audio-game';

        const addSection = (parent, sectionId, sectionTitle, predicate) => {
            const items = this.settingsItems
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => predicate(item));
            if (!items.length) return;

            const sectionEl = document.createElement('section');
            sectionEl.className = 'settings-section';
            sectionEl.dataset.section = sectionId;

            const heading = document.createElement('h3');
            heading.className = 'settings-section-title';
            heading.textContent = sectionTitle;
            sectionEl.appendChild(heading);

            const list = document.createElement('div');
            list.className = 'settings-section-list';
            items.forEach(({ item, index }) => {
                list.appendChild(this.buildSettingsRow(item, index));
            });

            sectionEl.appendChild(list);
            parent.appendChild(sectionEl);
        };

        addSection(left, 'theme', 'THEME', (item) =>
            item.type === 'palette' || item.type === 'secondBase'
        );
        addSection(left, 'look', 'LOOK', (item) =>
            item.type === 'globalLook' || item.type === 'grayscale'
        );
        addSection(left, 'style', 'STYLE', (item) =>
            item.type === 'borderWeight' ||
            item.type === 'indicatorWeight' ||
            item.type === 'fontMenu' ||
            item.type === 'bgParallax' ||
            item.type === 'controlsHints'
        );
        addSection(left, 'fx', 'RETRO FX', (item) => item.type === 'uiFx');
        addSection(right, 'sound', 'SOUND', (item) =>
            item.type === 'volume' ||
            item.name === 'Sound' ||
            item.name === 'Music' ||
            item.type === 'youtubeUrl'
        );
        addSection(right, 'game', 'GAME', (item) =>
            item.name === 'Difficulty' || item.action === 'difficultyEditor'
                || item.action === 'factionCommand'
        );
        if (!bare) {
            addSection(right, 'assets', 'ASSETS', (item) =>
                (item.type === 'action' && item.action !== 'difficultyEditor'
                    && item.action !== 'factionCommand') || item.type === 'assetStatus'
            );
        }

        panel.appendChild(left);
        panel.appendChild(right);
        content.appendChild(panel);

        if (!bare) {
            const instructions = this.buildControlsHint([
                'ARROW KEYS / MOUSE: Navigate',
                'LEFT/RIGHT / CLICK: Change Value',
                'ASSETS: Open Generator (Comfy + Bridge)',
                'ESC: Back'
            ]);
            content.appendChild(instructions);
            content.appendChild(this.buildControlsShowBtn());
        }

        this.refreshAssetBridgeStatus();
    }

    buildSettingsRow(item, index) {
        const menuItem = document.createElement('div');
        menuItem.className = `menu-item settings-row ${index === this.settingsIndex ? 'selected' : ''}`;
        menuItem.dataset.settingsIndex = String(index);
        menuItem.style.textAlign = 'left';
        menuItem.addEventListener('mouseenter', () => {
            this.settingsIndex = index;
            this.updateMenuSelection();
        });

        if (item.type === 'palette') {
            menuItem.classList.add('settings-row-theme');
            this.buildThemeStrip(menuItem, item, index);
            return menuItem;
        }

        if (item.type === 'secondBase') {
            menuItem.classList.add('settings-row-second-base');
            this.buildSecondBaseRow(menuItem, item, index);
            return menuItem;
        }

        if (item.type === 'volume') {
            menuItem.classList.add('volume-settings-item', 'settings-row-volume');
            menuItem.appendChild(this.createVolumeControlsUI());
            return menuItem;
        }

        if (item.type === 'fontMenu') {
            const family = (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.font : 'COURIER';
            menuItem.innerHTML = '';
            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;
            const value = document.createElement('span');
            value.className = 'settings-row-value';
            value.dataset.settingsValue = String(index);
            value.textContent = `${family} ›`;
            menuItem.appendChild(label);
            menuItem.appendChild(value);
            menuItem.addEventListener('click', () => {
                this.settingsIndex = index;
                this.openFontMenu();
            });
            return menuItem;
        }

        if (item.type === 'action' || item.type === 'assetStatus') {
            menuItem.classList.add('settings-row-action');
            menuItem.innerHTML = '';
            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;
            const value = document.createElement('span');
            value.className = 'settings-row-value';
            value.dataset.settingsValue = String(index);
            value.textContent = item.value;
            if (item.type === 'assetStatus') {
                value.classList.add('settings-asset-status');
                value.dataset.assetStatus = '1';
            }
            menuItem.appendChild(label);
            menuItem.appendChild(value);
            menuItem.addEventListener('click', () => {
                this.settingsIndex = index;
                if (item.type === 'action') this.runSettingsAction(item);
                else this.refreshAssetBridgeStatus();
            });
            return menuItem;
        }

        if (item.type === 'youtubeUrl') {
            menuItem.classList.add('settings-row-youtube');
            menuItem.innerHTML = '';
            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;
            const input = document.createElement('input');
            input.type = 'url';
            input.className = 'settings-youtube-input';
            input.placeholder = 'YouTube URL / ID';
            input.spellcheck = false;
            input.autocomplete = 'off';
            input.value = item.value || '';
            input.dataset.settingsYoutube = String(index);
            const sync = () => {
                item.value = String(input.value || '').trim();
                if (typeof youtubeSoundtrackManager !== 'undefined') {
                    youtubeSoundtrackManager.setMenuUrl(item.value);
                }
                if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
                    soundManager.startMenuMusic();
                }
            };
            input.addEventListener('change', sync);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sync();
                    input.blur();
                }
                e.stopPropagation();
            });
            input.addEventListener('click', (e) => e.stopPropagation());
            menuItem.appendChild(label);
            menuItem.appendChild(input);
            menuItem.addEventListener('click', () => {
                this.settingsIndex = index;
                input.focus();
            });
            return menuItem;
        }

        if (item.type === 'globalLook') {
            menuItem.classList.add('settings-row-look');
            this.buildLookSliderRow(menuItem, item, index);
            return menuItem;
        }

        const suffix = item.suffix || (item.type === 'indicatorWeight' ? 'px' : '');
        const label = document.createElement('span');
        label.className = 'settings-row-label';
        label.textContent = item.name;

        const controls = document.createElement('div');
        controls.className = 'settings-row-controls';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'settings-cycle-btn';
        prevBtn.textContent = '‹';
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            this.changeSettingValue(-1);
        });

        const value = document.createElement('span');
        value.className = 'settings-row-value';
        value.dataset.settingsValue = String(index);
        value.textContent = `${item.value}${suffix}`;

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'settings-cycle-btn';
        nextBtn.textContent = '›';
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });

        controls.appendChild(prevBtn);
        controls.appendChild(value);
        controls.appendChild(nextBtn);
        menuItem.appendChild(label);
        menuItem.appendChild(controls);

        menuItem.addEventListener('click', (e) => {
            if (e.target.closest('.settings-cycle-btn')) return;
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });

        return menuItem;
    }

    syncLookSliderFill(slider, value, min, max) {
        if (!slider) return;
        const lo = Number(min);
        const hi = Number(max);
        const v = Number(value);
        const span = Math.max(1, hi - lo);
        const pct = Math.max(0, Math.min(100, ((v - lo) / span) * 100));
        slider.style.setProperty('--look-fill', `${pct}%`);
        slider.value = String(v);
    }

    buildLookSliderRow(menuItem, item, index) {
        const min = item.min != null ? item.min : 0;
        const max = item.max != null ? item.max : 200;
        const step = item.step != null ? item.step : 5;
        const suffix = item.suffix || '%';
        const numeric = Math.max(min, Math.min(max, Number(item.value) || 0));
        item.value = String(Math.round(numeric));

        const label = document.createElement('span');
        label.className = 'settings-row-label';
        label.textContent = item.name;

        const controls = document.createElement('div');
        controls.className = 'settings-row-controls settings-look-controls';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.className = 'settings-look-slider';
        slider.dataset.settingsLook = String(index);
        slider.setAttribute('aria-label', item.name);

        const value = document.createElement('span');
        value.className = 'settings-row-value';
        value.dataset.settingsValue = String(index);
        value.textContent = `${item.value}${suffix}`;

        this.syncLookSliderFill(slider, item.value, min, max);

        const applyLookValue = (raw) => {
            const next = Math.max(min, Math.min(max, Math.round(Number(raw))));
            item.value = String(next);
            value.textContent = `${item.value}${suffix}`;
            this.syncLookSliderFill(slider, next, min, max);
            if (item.lookKey === 'saturation') {
                const grayItem = this.settingsItems.find((i) => i.type === 'grayscale');
                if (grayItem) {
                    grayItem.value = item.value === '0' ? 'ON' : 'OFF';
                    this.refreshSettingsRow(this.settingsItems.indexOf(grayItem));
                }
            }
            this.applySettings();
        };

        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            applyLookValue(e.target.value);
            this.updateMenuSelection();
        });
        slider.addEventListener('click', (e) => e.stopPropagation());
        slider.addEventListener('mousedown', (e) => e.stopPropagation());
        slider.addEventListener('pointerdown', (e) => e.stopPropagation());

        controls.appendChild(slider);
        controls.appendChild(value);
        menuItem.appendChild(label);
        menuItem.appendChild(controls);

        menuItem.addEventListener('click', (e) => {
            if (e.target.closest('.settings-look-slider')) return;
            this.settingsIndex = index;
            this.updateMenuSelection();
        });
    }

    buildThemeStrip(menuItem, item, index) {
        const head = document.createElement('div');
        head.className = 'settings-theme-head';

        const paletteLabel = document.createElement('div');
        paletteLabel.className = 'settings-row-label';
        paletteLabel.textContent = item.name;
        head.appendChild(paletteLabel);

        const hint = document.createElement('div');
        hint.className = 'settings-hint type-text';
        hint.textContent = 'Menus & UI only';
        head.appendChild(hint);
        menuItem.appendChild(head);

        const list = document.createElement('div');
        list.className = 'theme-list';
        list.dataset.themeStrip = '1';

        const palettes = (typeof themeContextManager !== 'undefined')
            ? themeContextManager.getPresetOptions(false)
            : (colorManager ? colorManager.getPalettes() : []);

        palettes.forEach((palette) => {
            const paletteButton = document.createElement('button');
            paletteButton.type = 'button';
            paletteButton.className = 'theme-list-item' + (palette.id === item.value ? ' active' : '');
            paletteButton.dataset.paletteId = palette.id;
            paletteButton.title = palette.name;

            const swatch = document.createElement('span');
            swatch.className = 'theme-list-swatch';
            const baseHex = palette.baseColor || palette.primary;
            const secondHex = palette.secondBaseColor
                || (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.defaultSecondBaseColor)
                || '#FFFFFF';
            swatch.style.background = `linear-gradient(135deg, ${baseHex} 50%, ${secondHex} 50%)`;
            swatch.title = `Base ${baseHex} · 2nd ${secondHex}`;

            const name = document.createElement('span');
            name.className = 'theme-list-name';
            name.textContent = palette.name;

            paletteButton.appendChild(swatch);
            paletteButton.appendChild(name);

            paletteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.settingsIndex = index;
                item.value = palette.id;
                this.applyPaletteChange();
                this.syncThemeStripActive(list, palette.id, false);
                this.updateMenuSelection();
            });

            list.appendChild(paletteButton);
        });

        menuItem.appendChild(list);

        requestAnimationFrame(() => {
            this.syncThemeStripActive(list, item.value, true);
        });

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'theme-edit-btn';
        editBtn.textContent = 'THEME EDITOR';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openThemeEditor(item.value);
        });
        menuItem.appendChild(editBtn);
    }

    syncSecondBaseSettingValue() {
        const item = this.settingsItems && this.settingsItems.find((s) => s.type === 'secondBase');
        if (!item) return;
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getSecondBaseColor) {
            item.value = colorPaletteSystem.getSecondBaseColor();
        }
    }

    buildSecondBaseRow(menuItem, item, index) {
        this.syncSecondBaseSettingValue();

        const label = document.createElement('span');
        label.className = 'settings-row-label';
        label.textContent = item.name;

        const controls = document.createElement('div');
        controls.className = 'settings-row-controls settings-second-base-controls';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'settings-cycle-btn';
        prevBtn.textContent = '‹';
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            this.changeSettingValue(-1);
        });

        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'settings-second-base-swatch';
        swatch.dataset.color = this.toSettingsHex(item.value);
        swatch.style.backgroundColor = swatch.dataset.color;
        swatch.title = '2nd basecolor (text / icons)';
        swatch.setAttribute('aria-label', 'Pick 2nd basecolor');
        swatch.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.settingsIndex = index;
            if (typeof colorPickerOverlay === 'undefined' || !colorPickerOverlay.open) return;
            colorPickerOverlay.open(swatch.dataset.color || item.value, {
                anchor: swatch,
                onChange: (hex) => {
                    const next = this.toSettingsHex(hex);
                    item.value = next;
                    swatch.dataset.color = next;
                    swatch.style.backgroundColor = next;
                    this.applySecondBaseChange(next);
                    this.refreshSettingsRow(index);
                }
            });
        });

        const value = document.createElement('span');
        value.className = 'settings-row-value';
        value.dataset.settingsValue = String(index);
        value.textContent = this.toSettingsHex(item.value).toUpperCase();

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'settings-cycle-btn';
        nextBtn.textContent = '›';
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });

        controls.appendChild(prevBtn);
        controls.appendChild(swatch);
        controls.appendChild(value);
        controls.appendChild(nextBtn);
        menuItem.appendChild(label);
        menuItem.appendChild(controls);

        menuItem.addEventListener('click', (e) => {
            if (e.target.closest('.settings-cycle-btn') || e.target.closest('.settings-second-base-swatch')) return;
            this.settingsIndex = index;
            this.changeSettingValue(1);
        });
    }

    toSettingsHex(color) {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            return colorPaletteSystem.normalizeHex(color).toLowerCase();
        }
        if (!color || typeof color !== 'string') return '#ffffff';
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
        return '#ffffff';
    }

    applySecondBaseChange(hex) {
        if (typeof colorPaletteSystem === 'undefined' || !colorPaletteSystem.setSecondBaseColor) return;
        colorPaletteSystem.setSecondBaseColor(hex, { persist: true, apply: true });
        if (typeof colorManager !== 'undefined') {
            colorManager.currentColors = colorPaletteSystem.getCurrentColors();
            if (colorManager._syncOverlay) colorManager._syncOverlay(colorPaletteSystem.currentPalette);
        }
        if (typeof iconRenderer !== 'undefined' && iconRenderer.clearCache) {
            iconRenderer.clearCache();
        }
        if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible && homeStationUI.createUI) {
            try { homeStationUI.createUI(); } catch (e) { /* ignore */ }
        }
    }

    syncThemeStripActive(list, paletteId, scrollIntoView) {
        if (!list) return;
        const scrollTop = list.scrollTop;
        let active = null;
        list.querySelectorAll('.theme-list-item, .theme-strip-item').forEach((btn) => {
            const isActive = btn.dataset.paletteId === paletteId;
            btn.classList.toggle('active', isActive);
            if (isActive) active = btn;
        });
        if (scrollIntoView && active) {
            const target = active.offsetTop - (list.clientHeight / 2) + (active.offsetHeight / 2);
            list.scrollTop = Math.max(0, target);
        } else {
            list.scrollTop = scrollTop;
        }
    }

    refreshSettingsRow(index) {
        const item = this.settingsItems[index];
        if (!item) return;

        const startScreen = this.getUIHost();
        if (!startScreen) return;

        if (item.type === 'palette') {
            const list = startScreen.querySelector('.theme-list[data-theme-strip="1"], .theme-strip[data-theme-strip="1"]');
            this.syncThemeStripActive(list, item.value, true);
            this.syncSecondBaseSettingValue();
            const secondIdx = this.settingsItems.findIndex((s) => s.type === 'secondBase');
            if (secondIdx >= 0) this.refreshSettingsRow(secondIdx);
            return;
        }

        if (item.type === 'secondBase') {
            const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
            const hex = this.toSettingsHex(item.value).toUpperCase();
            if (valueEl) valueEl.textContent = hex;
            const swatch = startScreen.querySelector('.settings-second-base-swatch');
            if (swatch) {
                const hex = this.toSettingsHex(item.value);
                swatch.dataset.color = hex;
                swatch.style.backgroundColor = hex;
            }
            return;
        }

        if (item.type === 'fontMenu') {
            const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
            if (valueEl) {
                const family = (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.font : 'COURIER';
                valueEl.textContent = `${family} ›`;
            }
            return;
        }

        if (item.type === 'volume') return;
        if (item.type === 'youtubeUrl') {
            const input = startScreen.querySelector(`[data-settings-youtube="${index}"]`);
            if (input) input.value = item.value || '';
            return;
        }

        if (item.type === 'globalLook') {
            const min = item.min != null ? item.min : 0;
            const max = item.max != null ? item.max : 200;
            const suffix = item.suffix || '%';
            const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
            if (valueEl) valueEl.textContent = `${item.value}${suffix}`;
            const slider = startScreen.querySelector(`[data-settings-look="${index}"]`);
            this.syncLookSliderFill(slider, item.value, min, max);
            return;
        }

        const valueEl = startScreen.querySelector(`[data-settings-value="${index}"]`);
        if (valueEl) {
            const suffix = item.suffix || (item.type === 'indicatorWeight' ? 'px' : '');
            valueEl.textContent = `${item.value}${suffix}`;
            if (item.type === 'assetStatus') {
                valueEl.classList.toggle('settings-asset-ready', item.value === 'READY');
                valueEl.classList.toggle('settings-asset-warn', item.value === 'BRIDGE · NO COMFY');
                valueEl.classList.toggle('settings-asset-off', item.value === 'OFFLINE' || item.value === '…');
            }
        }
    }

    openFontMenu() {
        this.syncFontMenuItems();
        this.showFontMenu = true;
        this.fontMenuIndex = 0;
        this.createStartScreenUI();
    }

    createFontMenuUI(content) {
        this.syncFontMenuItems();

        const title = document.createElement('h2');
        title.textContent = 'FONT';
        title.className = 'start-screen-title type-h1';

        const preview = document.createElement('div');
        preview.className = 'font-menu-preview';
        preview.innerHTML = `
            <div class="type-h1">H1 TITLE</div>
            <div class="type-h2">H2 LABELS</div>
            <div class="type-text">Text sample body</div>
        `;

        const menu = document.createElement('div');
        menu.className = 'start-screen-menu settings-panel';

        this.fontMenuItems.forEach((item, index) => {
            const menuItem = document.createElement('div');
            menuItem.className = `menu-item settings-row ${index === this.fontMenuIndex ? 'selected' : ''}`;
            menuItem.dataset.fontIndex = String(index);
            menuItem.style.textAlign = 'left';

            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = item.name;

            const controls = document.createElement('div');
            controls.className = 'settings-row-controls';

            const prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'settings-cycle-btn';
            prevBtn.textContent = '‹';
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fontMenuIndex = index;
                this.changeFontMenuValue(-1);
            });

            const value = document.createElement('span');
            value.className = 'settings-row-value';
            value.dataset.fontValue = String(index);
            const suffix = item.type === 'fontSize' ? 'px' : '';
            value.textContent = `${item.value}${suffix}`;

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'settings-cycle-btn';
            nextBtn.textContent = '›';
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fontMenuIndex = index;
                this.changeFontMenuValue(1);
            });

            controls.appendChild(prevBtn);
            controls.appendChild(value);
            controls.appendChild(nextBtn);
            menuItem.appendChild(label);
            menuItem.appendChild(controls);

            menuItem.addEventListener('mouseenter', () => {
                this.fontMenuIndex = index;
                this.updateMenuSelection();
            });
            menuItem.addEventListener('click', (e) => {
                if (e.target.closest('.settings-cycle-btn')) return;
                this.fontMenuIndex = index;
                this.changeFontMenuValue(1);
            });
            menu.appendChild(menuItem);
        });

        const instructions = this.buildControlsHint([
            'ARROW KEYS / MOUSE: Navigate',
            'LEFT/RIGHT / CLICK: Change Value',
            'ESC: Back to Settings'
        ]);

        content.appendChild(title);
        content.appendChild(preview);
        content.appendChild(menu);
        content.appendChild(instructions);
        content.appendChild(this.buildControlsShowBtn());
    }
    
    // Legacy method - no longer needed with HSL system
    getColorValue(colorName) {
        console.warn('getColorValue is deprecated - use HSL system instead');
        return 'var(--current-primary)';
    }
    
    createCreditsUI(content) {
        const title = document.createElement('h2');
        title.textContent = 'CREDITS';
        title.className = 'start-screen-title';

        const stage = document.createElement('div');
        stage.className = 'hs-credits-crawl-stage hs-credits-crawl-stage-fullscreen';
        stage.innerHTML =
            '<div class="hs-credits-crawl">' +
            '<div class="hs-credits-crawl-text">' +
            '<div class="hs-credits-crawl-line hs-credits-crawl-role">CREATOR</div>' +
            '<div class="hs-credits-crawl-line">LANCE MEIER / MEIERDESIGNS</div>' +
            '<div class="hs-credits-crawl-line">GLXEE</div>' +
            '<div class="hs-credits-crawl-line">RETRO SPACE SHOOTER</div>' +
            '<div class="hs-credits-crawl-line">GAME BOY STYLE</div>' +
            '</div>' +
            '</div>';

        const backItem = document.createElement('div');
        backItem.className = 'menu-item selected hs-credits-crawl-back';
        backItem.textContent = 'CLICK OR ESC TO RETURN';
        backItem.addEventListener('click', () => this.handleEscape());

        content.appendChild(title);
        content.appendChild(stage);
        content.appendChild(backItem);
    }
    
    createLevelsUI(content) {
        const title = document.createElement('h2');
        title.textContent = 'LEVEL SELECTION';
        title.className = 'start-screen-title';
        
        const menu = document.createElement('div');
        menu.className = 'start-screen-menu';
        
        this.planets.forEach((planet, index) => {
            const menuItem = document.createElement('div');
            menuItem.className = `menu-item ${index === this.levelIndex ? 'selected' : ''} ${planet.unlocked ? '' : 'locked'}`;
            menuItem.textContent = `${planet.name} - ${planet.difficulty}`;
            if (planet.unlocked) {
                menuItem.addEventListener('mouseenter', () => {
                    this.levelIndex = index;
                    this.updateMenuSelection();
                });
                menuItem.addEventListener('click', () => {
                    this.levelIndex = index;
                    this.updateMenuSelection();
                    this.startGame(planet);
                });
            }
            menu.appendChild(menuItem);
        });
        
        const instructions = this.buildControlsHint([
            'ARROW KEYS / MOUSE: Navigate',
            'SPACEBAR / CLICK: Select',
            'ESC: Back'
        ]);
        
        content.appendChild(title);
        content.appendChild(menu);
        content.appendChild(instructions);
        content.appendChild(this.buildControlsShowBtn());
    }

    buildControlsHint(lines) {
        const wrap = document.createElement('div');
        wrap.className = 'ui-controls-hint start-screen-instructions';
        (lines || []).forEach((line) => {
            const p = document.createElement('p');
            p.textContent = line;
            wrap.appendChild(p);
        });
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'ui-controls-hide-btn';
        hideBtn.title = 'Hide controls (Shift+H)';
        hideBtn.setAttribute('aria-label', 'Hide controls');
        hideBtn.textContent = 'HIDE';
        hideBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.setControlsHintsVisible(false);
        });
        wrap.appendChild(hideBtn);
        return wrap;
    }

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
    }

    setControlsHintsVisible(visible) {
        if (typeof uiAppearanceManager === 'undefined') return;
        uiAppearanceManager.setControlsHints(visible ? 'ON' : 'OFF');
        this.syncControlsSettingFromAppearance();
    }

    syncControlsSettingFromAppearance() {
        const item = this.settingsItems && this.settingsItems.find((s) => s.type === 'controlsHints');
        if (item && typeof uiAppearanceManager !== 'undefined') {
            item.value = uiAppearanceManager.controlsHints;
        }
    }
    
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
    }

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
    }
    
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
    }

    isVisible() {
        return this.visible;
    }

    update(deltaTime) {
        if (this.visible) {
            this.blinkTimer++;
            if (this.blinkTimer >= this.blinkSpeed) {
                this.blinkTimer = 0;
            }
        }
    }

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
            'ArrowUp': () => this.handleArrowUp(),
            'ArrowDown': () => this.handleArrowDown(),
            'ArrowLeft': () => this.handleArrowLeft(),
            'ArrowRight': () => this.handleArrowRight(),
            'Enter': () => this.handleEnter(),
            ' ': () => this.handleEnter()
        };
        
        const handler = handlers[event.key];
        return handler ? handler() : false;
    }
    
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
    }
    
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
    }
    
    handleArrowDown() {
        if (this.showLevels) {
            this.levelIndex = Math.min(this.planets.length - 1, this.levelIndex + 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showFontMenu) {
            this.fontMenuIndex = Math.min(this.fontMenuItems.length - 1, this.fontMenuIndex + 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showSettings) {
            this.settingsIndex = Math.min(this.settingsItems.length - 1, this.settingsIndex + 1);
            this.updateMenuSelection();
            return true;
        } else if (this.showCredits) {
            return false;
        } else {
            if (this.navigateMainMenuSpatially('down')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const ranges = this.getClusterIndexRanges();
            if (cur.clusterId && ranges[cur.clusterId] && this.selectedIndex < ranges[cur.clusterId].end) {
                this.selectedIndex += 1;
                this.updateMenuSelection();
                return true;
            }
            const down = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].down : null;
            if (down) return this.jumpToCluster(down, cur.offset);
            this.selectedIndex = Math.min(this.menuItems.length - 1, this.selectedIndex + 1);
            this.updateMenuSelection();
            return true;
        }
    }
    
    handleArrowLeft() {
        if (this.showFontMenu) {
            this.changeFontMenuValue(-1);
            return true;
        }
        if (this.showSettings) {
            this.changeSettingValue(-1);
            return true;
        }
        if (!this.showCredits && !this.showLevels) {
            if (this.navigateMainMenuSpatially('left')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const left = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].left : null;
            if (left) return this.jumpToCluster(left, cur.offset);
        }
        return false;
    }
    
    handleArrowRight() {
        if (this.showFontMenu) {
            this.changeFontMenuValue(1);
            return true;
        }
        if (this.showSettings) {
            this.changeSettingValue(1);
            return true;
        }
        if (!this.showCredits && !this.showLevels) {
            if (this.navigateMainMenuSpatially('right')) return true;
            const cur = this.getSelectedClusterOffset();
            const map = this.getClusterNavMap();
            const right = cur.clusterId && map[cur.clusterId] ? map[cur.clusterId].right : null;
            if (right) return this.jumpToCluster(right, cur.offset);
        }
        return false;
    }
    
    handleEnter() {
        if (this.showLevels) {
            if (this.planets[this.levelIndex].unlocked) {
                this.startGame(this.planets[this.levelIndex]);
                return true;
            }
        } else if (this.showFontMenu) {
            this.changeFontMenuValue(1);
            return true;
        } else if (this.showSettings) {
            this.changeSettingValue(1);
            return true;
        } else if (this.embeddedMode) {
            if (this.embeddedMenuTab === 'assets') {
                this.openAssetGenerator({ returnToSettings: true });
                return true;
            }
            if (this.embeddedMenuTab === 'profiles' && typeof profileSelectionManager !== 'undefined') {
                this.hideEmbedded();
                profileSelectionManager.show({
                    onClose: () => {
                        if (this.hasActiveProfile()) this.returnToHub();
                        else this.show({ forceMenu: true });
                    }
                });
                return true;
            }
            return true;
        } else {
            this.selectMenuItem();
            return true;
        }
        return false;
    }
    
    changeSettingValue(direction) {
        const item = this.settingsItems[this.settingsIndex];
        if (!item) return;

        if (item.type === 'fontMenu') {
            this.openFontMenu();
            return;
        }

        if (item.type === 'action') {
            this.runSettingsAction(item);
            return;
        }

        if (item.type === 'assetStatus') {
            this.refreshAssetBridgeStatus();
            return;
        }

        if (item.type === 'volume') {
            return;
        }

        if (item.type === 'youtubeUrl') {
            return;
        }
        
        if (item.type === 'palette') {
            const palettes = (typeof themeContextManager !== 'undefined')
                ? themeContextManager.getPresetOptions(false)
                : (colorManager ? colorManager.getPalettes() : []);
            const currentIndex = palettes.findIndex(p => p.id === item.value);
            const newIndex = (currentIndex + direction + palettes.length) % palettes.length;
            item.value = palettes[newIndex].id;
            this.applyPaletteChange();
            this.refreshSettingsRow(this.settingsIndex);
            this.updateMenuSelection();
            return;
        }

        if (item.type === 'secondBase') {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.cycleSecondBaseColor) {
                item.value = colorPaletteSystem.cycleSecondBaseColor(direction, { persist: true, apply: true });
            }
            this.applySecondBaseChange(item.value);
            this.refreshSettingsRow(this.settingsIndex);
            this.updateMenuSelection();
            return;
        }

        if (item.type === 'globalLook') {
            const min = item.min != null ? item.min : 0;
            const max = item.max != null ? item.max : 200;
            const step = item.step != null ? item.step : 5;
            const next = Math.max(min, Math.min(max, (Number(item.value) || 0) + direction * step));
            item.value = String(Math.round(next));
            if (item.lookKey === 'saturation') {
                const grayItem = this.settingsItems.find((i) => i.type === 'grayscale');
                if (grayItem) {
                    grayItem.value = item.value === '0' ? 'ON' : 'OFF';
                    this.refreshSettingsRow(this.settingsItems.indexOf(grayItem));
                }
            }
            this.applySettings();
            this.refreshSettingsRow(this.settingsIndex);
            this.updateMenuSelection();
            return;
        }

        if (!item.options || !item.options.length) return;

        const currentIndex = item.options.indexOf(item.value);
        const newIndex = (currentIndex + direction + item.options.length) % item.options.length;
        item.value = item.options[newIndex];

        if (item.type === 'grayscale') {
            const satItem = this.settingsItems.find((i) => i.lookKey === 'saturation');
            if (satItem) {
                if (item.value === 'ON') {
                    this._preGrayscaleSaturation = satItem.value;
                    satItem.value = '0';
                } else {
                    const restored = this._preGrayscaleSaturation || satItem.value || '100';
                    satItem.value = restored === '0' ? '100' : restored;
                    this._preGrayscaleSaturation = null;
                }
                this.refreshSettingsRow(this.settingsItems.indexOf(satItem));
            }
        }

        this.applySettings();
        this.refreshSettingsRow(this.settingsIndex);
        this.updateMenuSelection();
    }

    runSettingsAction(item) {
        if (!item || !item.action) return;
        if (item.action === 'assetGen') {
            this.openAssetGenerator(null);
            return;
        }
        if (item.action === 'assetGenFaction') {
            this.openAssetGenerator({ typeId: 'faction' });
            return;
        }
        if (item.action === 'assetGenFactionShips') {
            this.openAssetGenerator({ typeId: 'faction' });
            return;
        }
        if (item.action === 'difficultyEditor') {
            if (typeof difficultyEditorUI !== 'undefined' && difficultyEditorUI.show) {
                difficultyEditorUI.show();
            }
            return;
        }
        if (item.action === 'factionCommand') {
            if (typeof factionCommandUI !== 'undefined' && factionCommandUI.show) {
                factionCommandUI.show();
            }
            return;
        }
    }

    openAssetGenerator(opts) {
        if (typeof assetGenUI === 'undefined' || !assetGenUI) {
            console.warn('Asset Generator UI not loaded');
            return;
        }
        const fromStationMenu = this.overlayMode || this.embeddedMode;
        if (this.overlayMode) {
            this.hideOverlay();
        }
        if (this.embeddedMode) {
            this.hideEmbedded();
        }
        const o = opts || {};
        const returnToSettings = o.returnToSettings !== false;
        if (o.typeId) {
            assetGenUI.show({ typeId: o.typeId, returnToSettings: returnToSettings });
            if (assetGenUI.setStatus) {
                const label = (o.typeId === 'faction' || o.typeId === 'factionShip')
                    ? 'FACTIONS'
                    : String(o.typeId).toUpperCase();
                assetGenUI.setStatus(
                    ((returnToSettings || fromStationMenu) ? 'From Settings · ' : 'From Menu · ') +
                    label + ' · Generate → Accept'
                );
            }
            return;
        }
        const focus = o.focusEntry
            ? Object.assign({}, o.focusEntry, { returnToSettings: returnToSettings })
            : { returnToSettings: returnToSettings };
        assetGenUI.show(focus);
    }

    async refreshAssetBridgeStatus() {
        const item = this.settingsItems.find((s) => s.type === 'assetStatus');
        if (!item) return;
        item.value = '…';
        this.refreshSettingsRow(this.settingsItems.indexOf(item));
        let text = 'OFFLINE';
        let ok = false;
        let comfy = false;
        try {
            if (typeof assetGenClient !== 'undefined' && assetGenClient.health) {
                const h = await assetGenClient.health();
                ok = !!(h && h.ok);
                comfy = !!(h && h.comfy);
                if (ok && comfy) text = 'READY';
                else if (ok) text = 'BRIDGE · NO COMFY';
                else text = 'OFFLINE';
            }
        } catch (e) {
            text = 'OFFLINE';
        }
        item.value = text;
        const idx = this.settingsItems.indexOf(item);
        this.refreshSettingsRow(idx);
        const el = document.querySelector('[data-asset-status="1"]');
        if (el) {
            el.classList.toggle('settings-asset-ready', ok && comfy);
            el.classList.toggle('settings-asset-warn', ok && !comfy);
            el.classList.toggle('settings-asset-off', !ok);
        }
    }

    createVolumeControlsUI() {
        const panel = document.createElement('div');
        panel.className = 'volume-controls';

        const levels = (typeof volumeControlsManager !== 'undefined')
            ? {
                master: Math.round(volumeControlsManager.getMasterVolume() * 100),
                sound: Math.round(volumeControlsManager.getSoundVolume() * 100),
                music: Math.round(volumeControlsManager.getMusicVolume() * 100)
            }
            : { master: 10, sound: 5, music: 20 };

        const rows = [
            { key: 'master', label: 'MASTER', setter: 'setMasterVolume' },
            { key: 'sound', label: 'SOUNDS', setter: 'setSoundVolume' },
            { key: 'music', label: 'MUSIC', setter: 'setMusicVolume' }
        ];

        rows.forEach((row) => {
            const control = document.createElement('div');
            control.className = 'volume-control';

            const label = document.createElement('label');
            label.textContent = `${row.label}:`;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.value = String(levels[row.key]);
            slider.className = 'volume-slider';
            slider.dataset.volume = row.key;
            slider.style.setProperty('--vol-fill', `${levels[row.key]}%`);

            const value = document.createElement('span');
            value.textContent = `${levels[row.key]}%`;
            value.dataset.volumeValue = row.key;

            slider.addEventListener('input', (e) => {
                e.stopPropagation();
                const pct = parseInt(e.target.value, 10);
                value.textContent = `${pct}%`;
                e.target.style.setProperty('--vol-fill', `${pct}%`);
                if (typeof volumeControlsManager !== 'undefined') {
                    volumeControlsManager[row.setter](pct / 100);
                }
            });
            slider.addEventListener('click', (e) => e.stopPropagation());
            slider.addEventListener('mousedown', (e) => e.stopPropagation());

            control.appendChild(label);
            control.appendChild(slider);
            control.appendChild(value);
            panel.appendChild(control);
        });

        return panel;
    }

    changeFontMenuValue(direction) {
        const item = this.fontMenuItems[this.fontMenuIndex];
        if (!item || !item.options) return;

        const currentIndex = item.options.indexOf(item.value);
        const newIndex = (currentIndex + direction + item.options.length) % item.options.length;
        item.value = item.options[newIndex];
        this.applyFontMenuSettings();
        this.refreshFontMenuRow(this.fontMenuIndex);
        this.updateMenuSelection();
    }

    refreshFontMenuRow(index) {
        const item = this.fontMenuItems[index];
        if (!item) return;
        const startScreen = this.getUIHost();
        if (!startScreen) return;
        const valueEl = startScreen.querySelector(`[data-font-value="${index}"]`);
        if (!valueEl) return;
        const suffix = item.type === 'fontSize' ? 'px' : '';
        valueEl.textContent = `${item.value}${suffix}`;
    }

    applyFontMenuSettings() {
        if (typeof uiAppearanceManager === 'undefined') return;

        const family = this.fontMenuItems.find(i => i.type === 'font');
        if (family) uiAppearanceManager.setFont(family.value);

        this.fontMenuItems.filter(i => i.type === 'fontSize').forEach((item) => {
            uiAppearanceManager.setFontSize(item.sizeKey, item.value);
        });
    }

    selectMenuItem() {
        const selectedItem = this.menuItems[this.selectedIndex];

        switch (selectedItem) {
            case 'PROFILES':
                if (typeof profileSelectionManager !== 'undefined') {
                    const reopen = this.isStationMenuContext();
                    if (this.embeddedMode) this.hideEmbedded();
                    else if (this.overlayMode) this.hideOverlay();
                    else this.hide();
                    profileSelectionManager.show({
                        onClose: () => {
                            if (reopen || this.hasActiveProfile()) {
                                this.returnToHub();
                            } else {
                                this.show({ forceMenu: true });
                            }
                        }
                    });
                }
                break;
            case 'STATION':
                if (this.embeddedMode) {
                    if (typeof homeStationUI !== 'undefined') {
                        homeStationUI.closeMenuTab();
                    } else {
                        this.hideEmbedded();
                    }
                    break;
                }
                if (this.overlayMode) {
                    this.hideOverlay();
                    break;
                }
                if (typeof profileManager !== 'undefined' && !profileManager.hasActiveProfile()) {
                    if (typeof onboardingManager !== 'undefined') {
                        onboardingManager.show({
                            onComplete: () => {
                                this.returnToHub();
                            }
                        });
                        this.hide();
                        break;
                    }
                    if (typeof profileSelectionManager !== 'undefined') {
                        profileSelectionManager.show({
                            onClose: () => this.returnToHub()
                        });
                        this.hide();
                        break;
                    }
                }
                if (typeof homeStationUI !== 'undefined') {
                    homeStationUI.show({
                        onClose: () => this.returnToHub()
                    });
                    this.hide();
                }
                break;
            case 'SETTINGS':
                this.showSettings = true;
                this.createStartScreenUI(); // Recreate UI for settings
                if (typeof menuStateManager !== 'undefined') {
                    menuStateManager.setScreen('settings');
                }
                break;
            case 'ASSETS':
                this.openAssetGenerator({ returnToSettings: false });
                break;
            case 'CREDITS':
                this.showCredits = true;
                this.createStartScreenUI(); // Recreate UI for credits
                if (typeof menuStateManager !== 'undefined') {
                    menuStateManager.setScreen('credits');
                }
                break;
        }
    }

    startGame(selectedPlanet = null) {
        this.hide();
        if (typeof soundManager !== 'undefined' && soundManager.stopMenuMusic) {
            soundManager.stopMenuMusic();
        }

        if (!selectedPlanet && typeof planetSelectionManager !== 'undefined') {
            selectedPlanet = planetSelectionManager.planets[planetSelectionManager.selectedPlanet];
        }

        const levelId = selectedPlanet
            ? selectedPlanet.name.toLowerCase()
            : 'mars';

        if (typeof game !== 'undefined' && typeof game.startGame === 'function') {
            game.startGame(levelId);
        } else {
            console.error('GameCore system not available');
        }
    }
    
    // Unlock next level after winning
    unlockNextLevel(currentLevelId = 1) {
        if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.unlockNextLevel(currentLevelId);
        }
    }
    
    // Unlock specific level
    unlockLevel(levelId) {
        if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.unlockLevel(levelId);
        }
    }

    applySettings() {
        const lookPatch = {};
        this.settingsItems.forEach((item) => {
            if (item.type === 'globalLook' && item.lookKey) {
                lookPatch[item.lookKey] = Number(item.value);
            }
        });
        const grayscaleSetting = this.settingsItems.find((item) => item.type === 'grayscale');
        if (grayscaleSetting) {
            lookPatch.saturation = grayscaleSetting.value === 'ON'
                ? 0
                : Number((this.settingsItems.find((item) => item.lookKey === 'saturation') || {}).value || 100);
        }
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
            colorPaletteSystem.setGlobalLook(lookPatch);
        }

        const soundSetting = this.settingsItems.find(item => item.name === 'Sound');
        if (soundSetting && typeof soundManager !== 'undefined') {
            soundManager.setSoundEnabled(soundSetting.value === 'ON');
        }
        
        const musicSetting = this.settingsItems.find(item => item.name === 'Music');
        if (musicSetting && typeof soundManager !== 'undefined') {
            soundManager.setMusicEnabled(musicSetting.value === 'ON');
        }

        const difficultySetting = this.settingsItems.find(item => item.name === 'Difficulty');
        if (difficultySetting) {
            const difficultyId = String(difficultySetting.value || 'normal').toLowerCase();
            if (typeof difficultyConfigManager !== 'undefined') {
                difficultyConfigManager.setDifficulty(difficultyId);
            }
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.difficulty = difficultyId;
                settingsManager.applyDifficultySettings();
                settingsManager.updateSettingsDisplay();
            }
        }

        const menuTrack = this.settingsItems.find(item => item.type === 'youtubeUrl');
        if (menuTrack && typeof youtubeSoundtrackManager !== 'undefined') {
            youtubeSoundtrackManager.setMenuUrl(menuTrack.value || '');
            if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
                soundManager.startMenuMusic();
            }
        }

        const borderSetting = this.settingsItems.find(item => item.type === 'borderWeight');
        if (borderSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setBorderWeight(borderSetting.value);
        }

        const indicatorSetting = this.settingsItems.find(item => item.type === 'indicatorWeight');
        if (indicatorSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setIndicatorWeight(indicatorSetting.value);
        }

        const parallaxSetting = this.settingsItems.find(item => item.type === 'bgParallax');
        if (parallaxSetting && typeof VFBgMouseParallax !== 'undefined') {
            VFBgMouseParallax.setIntensity(parallaxSetting.value);
        }

        const controlsSetting = this.settingsItems.find(item => item.type === 'controlsHints');
        if (controlsSetting && typeof uiAppearanceManager !== 'undefined') {
            uiAppearanceManager.setControlsHints(controlsSetting.value);
        }

        if (typeof uiAppearanceManager !== 'undefined') {
            this.settingsItems.forEach((item) => {
                if (item.type === 'uiFx' && item.fxKey) {
                    uiAppearanceManager.setFx(item.fxKey, item.value);
                }
            });
        }
    }

    applyPaletteChange() {
        const paletteSetting = this.settingsItems.find(item => item.name === 'App Theme' || item.name === 'Color Theme');
        
        if (paletteSetting) {
            const paletteId = paletteSetting.value;
            if (typeof themeContextManager !== 'undefined') {
                themeContextManager.setAppTheme(paletteId);
            } else if (typeof colorManager !== 'undefined') {
                colorManager.setPalette(paletteId, { persist: true, isAppTheme: true });
            }
            if (typeof iconRenderer !== 'undefined' && iconRenderer.clearCache) {
                iconRenderer.clearCache();
            }
            if (typeof settingsManager !== 'undefined') {
                settingsManager.settings.colorPalette = paletteId;
                settingsManager.updateSettingsDisplay();
            }
            this.syncSecondBaseSettingValue();
            const secondIdx = this.settingsItems.findIndex((s) => s.type === 'secondBase');
            if (secondIdx >= 0) this.refreshSettingsRow(secondIdx);
        }
    }

    openThemeEditor(paletteId) {
        if (typeof themeEditorUI === 'undefined') {
            console.warn('Theme editor not available');
            return;
        }
        this.showSettings = false;
        this.hide();
        themeEditorUI.show({
            paletteId: paletteId || (this.settingsItems[0] && this.settingsItems[0].value),
            returnToSettings: true
        });
    }
    
    // Legacy method - no longer needed with palette system
    loadColorCSS(colorName) {
        console.warn('loadColorCSS is deprecated - use palette system instead');
    }
    
    // Start game with selected level and ship
    startGameWithLevelAndShip(selectedLevel, selectedShip) {
        
        // Set the selected ship in graphics manager
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(selectedShip);
        } else {
            console.error('graphicsManager not available');
        }
        
        // Start the game with selected level
        this.startGameWithLevel(selectedLevel);
    }
    
    // Start game with specific level
    startGameWithLevel(level) {
        this.hide();
        if (typeof soundManager !== 'undefined' && soundManager.stopMenuMusic) {
            soundManager.stopMenuMusic();
        }

        let levelId = level.id && typeof level.id === 'string'
            ? level.id.toLowerCase()
            : level.name.toLowerCase();
        // Resume mid-planet progress when only a planet id was supplied
        if (levelId && levelId.indexOf('-') === -1
            && typeof profileManager !== 'undefined' && profileManager.getResumeLevelId) {
            levelId = profileManager.getResumeLevelId(levelId) || levelId;
        }

        if (typeof game !== 'undefined' && typeof game.startGame === 'function') {
            game.startGame(levelId);
        } else if (typeof planetSelectionManager !== 'undefined') {
            planetSelectionManager.startPlanetGame(level);
        } else {
            console.error('No game start system available');
        }
    }
    
    // Start game with selected ship
    startGameWithShip(selectedShip) {
        
        // Set the selected ship in graphics manager
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(selectedShip);
        } else {
            console.error('graphicsManager not available');
        }
        
        // Start the game
        this.startGame();
    }
    
    // Set player ship model in graphics manager
    setPlayerShipModel(shipModel) {
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(shipModel);
        }
    }
}

// Global instance
const startScreenManager = new StartScreenManager();