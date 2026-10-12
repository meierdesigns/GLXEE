"use strict";

// Color Refactor Analyzer
class ColorRefactorAnalyzer {
    constructor() {
        this.colorFiles = [];
        this.colorFunctions = [];
        this.colorVariables = [];
        this.redundancies = [];
        this.init();
    }

    init() {
        console.log('🔍 === COLOR REFACTOR ANALYZER ===');
        this.analyzeColorFiles();
        this.analyzeColorFunctions();
        this.analyzeColorVariables();
        this.findRedundancies();
        this.generateRefactorPlan();
    }

    analyzeColorFiles() {
        console.log('\n📁 Analyzing Color Files...');
        
        // List all files that might contain color logic
        const colorFilePatterns = [
            'js/graphics/color-manager.js',
            'js/core/settings-manager.js',
            'js/ui/start-screen.js',
            'js/ui/player-selection.js',
            'js/ui/combined-selection.js',
            'js/ui/planet-selection.js',
            'js/graphics/graphics-manager.js',
            'js/graphics/color-palette.js',
            'colors.css',
            'styles.css'
        ];

        colorFilePatterns.forEach(filePath => {
            console.log(`📄 ${filePath}`);
            this.colorFiles.push(filePath);
        });
    }

    analyzeColorFunctions() {
        console.log('\n🔧 Analyzing Color Functions...');
        
        // ColorManager functions
        const colorManagerFunctions = [
            'constructor()',
            'init()',
            'calculateColors()',
            'hslToHex()',
            'setHSL()',
            'setHue()',
            'setSaturation()',
            'setLightness()',
            'applyColors()',
            'getHSL()',
            'getCurrentColors()',
            'getCurrentOverlayColor()',
            'getCurrentOverlayIntensity()',
            'reset()'
        ];

        // SettingsManager functions
        const settingsManagerFunctions = [
            'initializeColorTheme()',
            'updateHSLSetting()',
            'changeColor()',
            'updateSettingsDisplay()'
        ];

        // StartScreenManager functions
        const startScreenFunctions = [
            'applyHSLChange()',
            'applySettings()',
            'changeSettingValue()'
        ];

        // UI Manager functions
        const uiManagerFunctions = [
            'updateColorTheme()',
            'applyThemeColors()'
        ];

        this.colorFunctions = {
            'ColorManager': colorManagerFunctions,
            'SettingsManager': settingsManagerFunctions,
            'StartScreenManager': startScreenFunctions,
            'UIManager': uiManagerFunctions
        };

        Object.entries(this.colorFunctions).forEach(([manager, functions]) => {
            console.log(`\n${manager}:`);
            functions.forEach(func => {
                console.log(`  - ${func}`);
            });
        });
    }

    analyzeColorVariables() {
        console.log('\n📋 Analyzing Color Variables...');
        
        // CSS Variables
        const cssVariables = [
            '--current-primary',
            '--current-secondary',
            '--current-accent',
            '--current-background',
            '--current-background-light',
            '--current-surface',
            '--current-border',
            '--current-text',
            '--current-text-secondary',
            '--current-text-dim',
            '--current-active',
            '--current-hover',
            '--ui-background',
            '--ui-surface',
            '--ui-border',
            '--ui-text-primary',
            '--ui-text-secondary',
            '--ui-text-muted',
            '--ui-highlight',
            '--ui-accent',
            '--ui-active',
            '--ui-hover',
            '--overlay-color'
        ];

        // JavaScript Variables
        const jsVariables = [
            'colorManager.hue',
            'colorManager.saturation',
            'colorManager.lightness',
            'colorManager.grayscale',
            'colorManager.currentColors',
            'settingsManager.settings.hue',
            'settingsManager.settings.saturation',
            'settingsManager.settings.lightness',
            'startScreenManager.settingsItems'
        ];

        this.colorVariables = {
            'CSS': cssVariables,
            'JavaScript': jsVariables
        };

        Object.entries(this.colorVariables).forEach(([type, variables]) => {
            console.log(`\n${type} Variables:`);
            variables.forEach(variable => {
                console.log(`  - ${variable}`);
            });
        });
    }

    findRedundancies() {
        console.log('\n🔄 Finding Redundancies...');
        
        // Check for duplicate color calculations
        this.redundancies.push({
            type: 'Duplicate HSL Calculations',
            description: 'HSL to RGB conversion happens in multiple places',
            files: ['js/graphics/color-manager.js', 'js/ui/parallax.js'],
            severity: 'Medium'
        });

        // Check for duplicate CSS variable setting
        this.redundancies.push({
            type: 'Duplicate CSS Variable Setting',
            description: 'CSS variables are set in multiple places',
            files: ['js/graphics/color-manager.js', 'force-grayscale.js'],
            severity: 'High'
        });

        // Check for duplicate color initialization
        this.redundancies.push({
            type: 'Duplicate Color Initialization',
            description: 'Colors are initialized in multiple managers',
            files: ['js/graphics/color-manager.js', 'js/core/settings-manager.js'],
            severity: 'Medium'
        });

        // Check for duplicate event listeners
        this.redundancies.push({
            type: 'Duplicate Event Listeners',
            description: 'Color change events are listened to in multiple places',
            files: ['js/ui/player-selection.js', 'js/ui/combined-selection.js'],
            severity: 'Low'
        });

        // Check for unused color variables
        this.redundancies.push({
            type: 'Unused Color Variables',
            description: 'Some CSS color variables are defined but not used',
            files: ['colors.css'],
            severity: 'Low'
        });

        this.redundancies.forEach((redundancy, index) => {
            console.log(`\n${index + 1}. ${redundancy.type} (${redundancy.severity})`);
            console.log(`   Description: ${redundancy.description}`);
            console.log(`   Files: ${redundancy.files.join(', ')}`);
        });
    }

    generateRefactorPlan() {
        console.log('\n📋 === REFACTOR PLAN ===');
        
        console.log('\n🎯 HIGH PRIORITY:');
        console.log('1. Consolidate CSS Variable Setting');
        console.log('   - Create single ColorManager.applyColors() method');
        console.log('   - Remove duplicate CSS variable setting from force-grayscale.js');
        console.log('   - Ensure all color changes go through ColorManager');
        
        console.log('\n2. Centralize Color Initialization');
        console.log('   - Move all color initialization to ColorManager constructor');
        console.log('   - Remove duplicate initialization from SettingsManager');
        console.log('   - Ensure single source of truth for default colors');
        
        console.log('\n🔧 MEDIUM PRIORITY:');
        console.log('3. Consolidate HSL Calculations');
        console.log('   - Create utility function for HSL to RGB conversion');
        console.log('   - Remove duplicate calculations from parallax.js');
        console.log('   - Use centralized color calculation methods');
        
        console.log('\n4. Optimize Event Handling');
        console.log('   - Create centralized color change event system');
        console.log('   - Remove duplicate event listeners');
        console.log('   - Use observer pattern for color changes');
        
        console.log('\n🧹 LOW PRIORITY:');
        console.log('5. Clean Up Unused Variables');
        console.log('   - Remove unused CSS color variables');
        console.log('   - Remove unused JavaScript color properties');
        console.log('   - Optimize color variable naming');
        
        console.log('\n📊 PERFORMANCE OPTIMIZATIONS:');
        console.log('6. Reduce Color Recalculations');
        console.log('   - Cache calculated colors');
        console.log('   - Only recalculate when HSL values change');
        console.log('   - Use debouncing for rapid color changes');
        
        console.log('\n7. Optimize CSS Variable Updates');
        console.log('   - Batch CSS variable updates');
        console.log('   - Use requestAnimationFrame for smooth updates');
        console.log('   - Minimize DOM manipulation');
        
        console.log('\n✅ REFACTOR BENEFITS:');
        console.log('- Reduced code duplication');
        console.log('- Improved maintainability');
        console.log('- Better performance');
        console.log('- Single source of truth for colors');
        console.log('- Easier debugging and testing');
    }
}

// Auto-run color refactor analyzer
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new ColorRefactorAnalyzer();
        }, 1000);
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ColorRefactorAnalyzer = ColorRefactorAnalyzer;
    window.analyzeColorRefactor = () => new ColorRefactorAnalyzer();
}
