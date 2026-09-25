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
                id: 'play',
                label: '',
                items: [
                    { id: 'STATION', label: 'START', icon: 'hsStation', primary: true }
                ]
            },
            {
                id: 'account',
                label: 'ACCOUNT',
                items: [
                    { id: 'PROFILES', icon: 'menuProfiles' },
                    { id: 'SETTINGS', icon: 'menuSettings' }
                ]
            },
            {
                id: 'info',
                label: 'INFO',
                items: [
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
        this.themeDropdownOpen = false;
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
                name: 'Ship Render',
                value: (typeof uiAppearanceManager !== 'undefined') ? uiAppearanceManager.shipRenderStyle : 'FLAT',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getShipRenderStyleOptions()
                    : ['FLAT', 'VOXEL'],
                type: 'shipRenderStyle'
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
}
