"use strict";

// Menu Color Debug System
class MenuColorDebugger {
    constructor() {
        this.menuElements = [];
        this.cssVariables = {};
        this.functions = [];
        this.init();
    }

    init() {
        console.log('🎨 === MENU COLOR DEBUG ===');
        this.checkCSSVariables();
        this.findMenuElements();
        this.analyzeMenuColors();
        this.findColorFunctions();
        this.displayResults();
    }

    checkCSSVariables() {
        console.log('\n📋 Checking CSS Variables...');
        
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        const cssVars = [
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
            '--ui-background',
            '--ui-surface',
            '--ui-border',
            '--ui-text-primary',
            '--ui-text-secondary',
            '--ui-text-muted',
            '--ui-highlight',
            '--ui-accent'
        ];

        cssVars.forEach(varName => {
            const value = computedStyle.getPropertyValue(varName).trim();
            this.cssVariables[varName] = value;
            console.log(`✅ ${varName}: ${value}`);
        });
    }

    findMenuElements() {
        console.log('\n🔍 Finding Menu Elements...');
        
        const menuSelectors = [
            '#startScreen',
            '.start-screen',
            '.start-screen-content',
            '.start-screen-overlay',
            '.start-screen-title',
            '.start-screen-subtitle',
            '.start-screen-menu',
            '.menu-item',
            '.settings-overlay',
            '.victory-content',
            '.game-over-content',
            '.pause-overlay',
            '.planet-selection-content',
            '.player-selection-content',
            '.combined-selection-content'
        ];

        menuSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                const computedStyle = getComputedStyle(element);
                const backgroundColor = computedStyle.backgroundColor;
                const borderColor = computedStyle.borderColor;
                const color = computedStyle.color;
                const boxShadow = computedStyle.boxShadow;
                
                this.menuElements.push({
                    selector: selector,
                    element: element,
                    index: index,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    color: color,
                    boxShadow: boxShadow,
                    visible: element.offsetWidth > 0 && element.offsetHeight > 0
                });
                
                console.log(`📦 ${selector}[${index}]:`);
                console.log(`   Background: ${backgroundColor}`);
                console.log(`   Border: ${borderColor}`);
                console.log(`   Text: ${color}`);
                console.log(`   Shadow: ${boxShadow}`);
                console.log(`   Visible: ${element.offsetWidth > 0 && element.offsetHeight > 0}`);
            });
        });
    }

    analyzeMenuColors() {
        console.log('\n🎯 Analyzing Menu Colors...');
        
        this.menuElements.forEach(menu => {
            if (menu.visible) {
                console.log(`\n🔍 ${menu.selector}[${menu.index}] Analysis:`);
                
                // Check if colors match CSS variables
                const bgMatches = this.checkColorMatch(menu.backgroundColor, 'background');
                const borderMatches = this.checkColorMatch(menu.borderColor, 'border');
                const textMatches = this.checkColorMatch(menu.color, 'text');
                
                console.log(`   Background matches CSS vars: ${bgMatches ? '✅' : '❌'}`);
                console.log(`   Border matches CSS vars: ${borderMatches ? '✅' : '❌'}`);
                console.log(`   Text matches CSS vars: ${textMatches ? '✅' : '❌'}`);
                
                // Check for hardcoded colors
                if (this.isHardcodedColor(menu.backgroundColor)) {
                    console.log(`   ⚠️ Hardcoded background color detected: ${menu.backgroundColor}`);
                }
                if (this.isHardcodedColor(menu.borderColor)) {
                    console.log(`   ⚠️ Hardcoded border color detected: ${menu.borderColor}`);
                }
                if (this.isHardcodedColor(menu.color)) {
                    console.log(`   ⚠️ Hardcoded text color detected: ${menu.color}`);
                }
            }
        });
    }

    checkColorMatch(computedColor, type) {
        if (!computedColor || computedColor === 'transparent' || computedColor === 'rgba(0, 0, 0, 0)') {
            return true; // Transparent is OK
        }
        
        // Convert computed color to hex for comparison
        const hexColor = this.rgbToHex(computedColor);
        if (!hexColor) return false;
        
        // Check against relevant CSS variables
        const relevantVars = this.getRelevantVars(type);
        return relevantVars.some(varName => {
            const varValue = this.cssVariables[varName];
            return varValue && varValue.toLowerCase() === hexColor.toLowerCase();
        });
    }

    getRelevantVars(type) {
        switch (type) {
            case 'background':
                return ['--current-background', '--current-background-light', '--current-surface', '--ui-background', '--ui-surface'];
            case 'border':
                return ['--current-border', '--ui-border'];
            case 'text':
                return ['--current-text', '--current-text-secondary', '--current-text-dim', '--ui-text-primary', '--ui-text-secondary'];
            default:
                return [];
        }
    }

    isHardcodedColor(color) {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
            return false;
        }
        
        // Check if it's a CSS variable
        if (color.startsWith('var(')) {
            return false;
        }
        
        // Check if it's a hardcoded hex/rgb color
        return color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl');
    }

    rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return null;
        
        if (rgb.startsWith('#')) {
            return rgb;
        }
        
        const matches = rgb.match(/\d+/g);
        if (matches && matches.length >= 3) {
            const r = parseInt(matches[0]).toString(16).padStart(2, '0');
            const g = parseInt(matches[1]).toString(16).padStart(2, '0');
            const b = parseInt(matches[2]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
        
        return null;
    }

    findColorFunctions() {
        console.log('\n🔧 Finding Color Functions...');
        
        // Check for ColorManager
        if (typeof colorManager !== 'undefined') {
            console.log('✅ ColorManager found');
            console.log(`   HSL: H=${colorManager.hue}, S=${colorManager.saturation}, L=${colorManager.lightness}`);
            console.log(`   Current Colors:`, colorManager.getCurrentColors());
        } else {
            console.log('❌ ColorManager not found');
        }
        
        // Check for SettingsManager
        if (typeof settingsManager !== 'undefined') {
            console.log('✅ SettingsManager found');
            console.log(`   HSL Settings:`, settingsManager.settings);
        } else {
            console.log('❌ SettingsManager not found');
        }
        
        // Check for StartScreenManager
        if (typeof startScreenManager !== 'undefined') {
            console.log('✅ StartScreenManager found');
        } else {
            console.log('❌ StartScreenManager not found');
        }
        
        // Check for UIManager
        if (typeof uiManager !== 'undefined') {
            console.log('✅ UIManager found');
        } else {
            console.log('❌ UIManager not found');
        }
    }

    displayResults() {
        console.log('\n📊 === MENU COLOR DEBUG SUMMARY ===');
        
        const visibleMenus = this.menuElements.filter(menu => menu.visible);
        console.log(`Found ${visibleMenus.length} visible menu elements`);
        
        const hardcodedColors = this.menuElements.filter(menu => 
            this.isHardcodedColor(menu.backgroundColor) || 
            this.isHardcodedColor(menu.borderColor) || 
            this.isHardcodedColor(menu.color)
        );
        
        if (hardcodedColors.length === 0) {
            console.log('✅ No hardcoded colors found in menu elements');
        } else {
            console.log(`❌ Found ${hardcodedColors.length} menu elements with hardcoded colors:`);
            hardcodedColors.forEach(menu => {
                console.log(`   ${menu.selector}[${menu.index}]`);
                if (this.isHardcodedColor(menu.backgroundColor)) {
                    console.log(`     Background: ${menu.backgroundColor}`);
                }
                if (this.isHardcodedColor(menu.borderColor)) {
                    console.log(`     Border: ${menu.borderColor}`);
                }
                if (this.isHardcodedColor(menu.color)) {
                    console.log(`     Text: ${menu.color}`);
                }
            });
        }
        
        console.log('\n💡 CSS FILES THAT INFLUENCE MENU COLORS:');
        console.log('1. styles.css - Main CSS rules for menu elements');
        console.log('2. colors.css - CSS variable definitions');
        console.log('3. Individual color CSS files (if loaded)');
        
        console.log('\n💡 FUNCTIONS THAT INFLUENCE MENU COLORS:');
        console.log('1. ColorManager.applyColors() - Sets CSS variables');
        console.log('2. ColorManager.calculateColors() - Calculates colors from HSL');
        console.log('3. SettingsManager.updateHSLSetting() - Updates HSL values');
        console.log('4. StartScreenManager.applyHSLChange() - Applies HSL changes');
        console.log('5. UIManager methods - May set inline styles');
        
        console.log('\n🔧 DEBUGGING RECOMMENDATIONS:');
        console.log('1. Check if ColorManager is properly initialized');
        console.log('2. Verify CSS variables are set correctly');
        console.log('3. Look for inline styles overriding CSS variables');
        console.log('4. Check for !important rules in CSS');
        console.log('5. Verify HSL values are correct (should be 0,0,50 for grayscale)');
    }
}

// Auto-run menu color debugger
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new MenuColorDebugger();
        }, 2000); // Wait 2 seconds for everything to load
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.MenuColorDebugger = MenuColorDebugger;
    window.runMenuColorDebug = () => new MenuColorDebugger();
}
