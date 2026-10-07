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
                name: 'Voxel Size',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.voxelSize || '1') : '1',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getVoxelSizeOptions()
                    : ['1', '2', '3', '4'],
                type: 'voxelSize'
            },
            {
                name: 'Player Size',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('player'))) : '18',
                min: 6, max: 60, step: 1, suffix: 'px',
                type: 'playerSize'
            },
            {
                name: 'Scout Size',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('enemy', 'scout'))) : '36',
                min: 12, max: 200, step: 1, suffix: 'px',
                type: 'enemyClassSize',
                enemyClass: 'scout'
            },
            {
                name: 'Assault Size',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('enemy', 'assault'))) : '48',
                min: 12, max: 200, step: 1, suffix: 'px',
                type: 'enemyClassSize',
                enemyClass: 'assault'
            },
            {
                name: 'Heavy Size',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('enemy', 'heavy'))) : '58',
                min: 12, max: 200, step: 1, suffix: 'px',
                type: 'enemyClassSize',
                enemyClass: 'heavy'
            },
            {
                name: 'Elite Size',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('enemy', 'elite'))) : '70',
                min: 12, max: 200, step: 1, suffix: 'px',
                type: 'enemyClassSize',
                enemyClass: 'elite'
            },
            {
                name: 'Capital Size',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('enemy', 'capital'))) : '84',
                min: 12, max: 200, step: 1, suffix: 'px',
                type: 'enemyClassSize',
                enemyClass: 'capital'
            },
            {
                name: 'Player Shots',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('shot', 'player'))) : '4',
                min: 1, max: 40, step: 1, suffix: 'px',
                type: 'shotSize',
                shotKind: 'player'
            },
            {
                name: 'Enemy Shots',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('shot', 'enemy'))) : '4',
                min: 1, max: 40, step: 1, suffix: 'px',
                type: 'shotSize',
                shotKind: 'enemy'
            },
            {
                name: 'Boss Shots',
                value: (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSizePx)
                    ? String(Math.round(uiAppearanceManager.getSizePx('shot', 'boss'))) : '4',
                min: 1, max: 40, step: 1, suffix: 'px',
                type: 'shotSize',
                shotKind: 'boss'
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
                type: 'controlsHints',
                tip: 'Show or hide on-screen control hints (Shift+H)'
            },
            {
                name: 'UI Glow',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('glow'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('glow')
                    : ['OFF', 'LOW', 'MED', 'HIGH'],
                type: 'uiFx',
                fxKey: 'glow',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Scanlines',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('scanlines'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('scanlines')
                    : ['OFF', 'LOW', 'MED', 'HIGH'],
                type: 'uiFx',
                fxKey: 'scanlines',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'CRT',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('crt'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('crt')
                    : ['OFF', 'LOW', 'MED', 'HIGH'],
                type: 'uiFx',
                fxKey: 'crt',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Chroma',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('chroma'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('chroma')
                    : ['OFF', 'LOW', 'HIGH'],
                type: 'uiFx',
                fxKey: 'chroma',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
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
