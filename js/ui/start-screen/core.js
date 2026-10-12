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
            { id: 'layout', label: 'LAYOUT', icon: 'menuSettings' },
            { id: 'credits', label: 'CREDITS', icon: 'menuCredits' }
        ];
        this.title = "GLXEE";
        this.subtitle = "...a MRDSN Production";
        this.menuClusters = [
            {
                id: 'play',
                label: '',
                items: [
                    { id: 'STATION', label: 'NEW PILOT', icon: 'menuNewPilot', primary: true, desc: 'Start a new game with a new pilot' }
                ]
            },
            {
                id: 'account',
                items: [
                    { id: 'PROFILES', label: 'LOAD', icon: 'menuLoad', desc: 'Continue with an existing pilot' },
                    { id: 'GALAXIES', icon: 'menuPlanets', desc: 'Browse and create galaxies' },
                    { id: 'SETTINGS', icon: 'menuSettings', desc: 'Display, audio and controls' }
                ]
            },
            {
                id: 'info',
                items: [
                    { id: 'CREDITS', icon: 'menuCredits', desc: 'Who made this game' }
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
        this.showProfiles = false;
        this.showSettings = false;
        this.showFontMenu = false;
        this.showLevels = false;
        this.showGalaxies = false;
        this.settingsIndex = 0;
        this.fontMenuIndex = 0;
        this.levelIndex = 0;
        this.themeDropdownOpen = false;
        this.settingsItems = this.buildSettingsItems();
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
}
