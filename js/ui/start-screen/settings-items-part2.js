"use strict";

// StartScreenManager: settings menu items, part 2 of 2 (split out of core.js to keep files short).
extendClass(StartScreenManager, {
    settingsItemsPart2() {
        return [
            {
                name: 'Scan Warp',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('scanWarp'))
                    : '0',
                type: 'uiFx',
                fxKey: 'scanWarp',
                min: 0,
                max: 100,
                step: 5,
                suffix: '%'
            },
            {
                name: 'Select Pulse',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('arcade')
                    : 'OFF',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('arcade')
                    : ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'arcade'
            },
            {
                name: 'GUI Voxel',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('guiVoxel') : 'ON',
                options: ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'guiVoxel'
            },
            {
                name: 'Pixel Size',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('pixelSize') : 'OFF',
                options: ['OFF', '1', '2', '3', '4', '5', '6', '7', '8'],
                type: 'uiFx',
                fxKey: 'pixelSize',
                tip: 'One global pixel size (screen px) for every art pixel: combat, maps, previews, editors — 1 is sharpest'
            },
            {
                name: 'Frame Pixel',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('framePx') : 'OFF',
                options: ['OFF', '3', '5', '7', '9', '13', '17'],
                type: 'uiFx',
                fxKey: 'framePx'
            },
            {
                name: 'Frame Round',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('frameRound') : '3',
                options: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
                type: 'uiFx',
                fxKey: 'frameRound'
            },
            {
                name: 'GUI Cell',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('gvCell') : 'AUTO',
                options: ['AUTO', '1', '2', '3', '4', '5', '6', '7', '8'],
                type: 'uiFx',
                fxKey: 'gvCell'
            },
            {
                name: 'GUI Lines',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('gvLines') : 'ON',
                options: ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'gvLines'
            },
            {
                name: 'GUI Corners',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('gvCorners') : 'ON',
                options: ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'gvCorners'
            },
            {
                name: 'GUI Text',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('gvText') : 'ON',
                options: ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'gvText'
            },
            {
                name: 'GUI Images',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('gvImages') : 'ON',
                options: ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'gvImages'
            },
            {
                name: 'GUI SVG',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('gvSvg') : 'ON',
                options: ['OFF', 'ON'],
                type: 'uiFx',
                fxKey: 'gvSvg'
            },
            {
                name: 'FX Area',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxValue('fxArea') : 'ALL',
                options: ['SCREEN', 'FRAME', 'ALL'],
                type: 'uiFx',
                fxKey: 'fxArea'
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
                name: 'Sound Code',
                value: (typeof startupSound !== 'undefined' && startupSound.toCode)
                    ? startupSound.toCode()
                    : '',
                type: 'soundCode'
            },
            {
                name: 'BG Mouse Follow',
                type: 'bgParallax',
                value: (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.getIntensity)
                    ? String(VFBgMouseParallax.getIntensity()).toUpperCase() : 'NORMAL',
                options: (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.getIntensityOptions)
                    ? VFBgMouseParallax.getIntensityOptions() : ['OFF', 'LOW', 'NORMAL', 'HIGH']
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
                name: 'Startup Sound',
                value: 'EDIT ›',
                type: 'action',
                action: 'startupSound'
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
    },
});
