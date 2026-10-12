"use strict";

// StartScreenManager: settings menu items, part 1 of 2 (split out of core.js to keep files short).
extendClass(StartScreenManager, {
    settingsItemsPart1() {
        return [
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
                name: 'Vignette',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('vignette'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('vignette')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'vignette',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Noise',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('noise'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('noise')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'noise',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Flicker',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('flicker'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('flicker')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'flicker',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Bloom',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('bloom'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('bloom')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'bloom',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Bloom Spread',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('bloomSpread'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('bloomSpread')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'bloomSpread',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'Bloom Threshold',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('bloomThreshold'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('bloomThreshold')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'bloomThreshold',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'HDR',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('hdr'))
                    : '0',
                options: (typeof uiAppearanceManager !== 'undefined')
                    ? uiAppearanceManager.getFxOptions('hdr')
                    : ['OFF'],
                type: 'uiFx',
                fxKey: 'hdr',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            },
            {
                name: 'FX Scale',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('fxScale'))
                    : '100',
                type: 'uiFx',
                fxKey: 'fxScale',
                min: 25,
                max: 400,
                step: 5,
                suffix: '%'
            },
            {
                name: 'Scan Size',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('scanSize'))
                    : '100',
                type: 'uiFx',
                fxKey: 'scanSize',
                min: 25,
                max: 400,
                step: 5,
                suffix: '%'
            },
            {
                name: 'Scan Speed',
                value: (typeof uiAppearanceManager !== 'undefined')
                    ? String(uiAppearanceManager.getFxPercent('scanSpeed'))
                    : '100',
                type: 'uiFx',
                fxKey: 'scanSpeed',
                min: 0,
                max: 300,
                step: 5,
                suffix: '%'
            }
        ];
    },

    buildSettingsItems() {
        return [].concat(this.settingsItemsPart1(), this.settingsItemsPart2());
    },
});
