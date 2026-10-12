"use strict";

// Comprehensive Color Debug System
class ComprehensiveColorDebugger {
    constructor() {
        this.issues = [];
        this.init();
    }

    init() {
        console.log('🔍 === COMPREHENSIVE COLOR DEBUG ===');
        this.checkColorManager();
        this.checkCSSVariables();
        this.checkAllElements();
        this.checkInlineStyles();
        this.checkCSSFiles();
        this.displayResults();
    }

    checkColorManager() {
        console.log('\n🎨 Checking ColorManager...');
        
        if (typeof colorManager === 'undefined') {
            console.log('❌ ColorManager is not defined!');
            this.issues.push('ColorManager not defined');
            return;
        }
        
        console.log('✅ ColorManager found');
        const hsl = colorManager.getHSL();
        console.log(`HSL: H=${hsl.hue}, S=${hsl.saturation}, L=${hsl.lightness}`);
        
        if (hsl.saturation !== 0) {
            console.log('❌ Saturation is not 0 - should be grayscale!');
            this.issues.push(`Saturation is ${hsl.saturation}, should be 0 for grayscale`);
        }
        
        const colors = colorManager.getCurrentColors();
        console.log('Current colors:', colors);
        
        // Check if colors are grayscale
        Object.entries(colors).forEach(([key, value]) => {
            if (!this.isGrayscale(value)) {
                console.log(`❌ ${key} is not grayscale: ${value}`);
                this.issues.push(`${key} color is not grayscale: ${value}`);
            }
        });
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
            '--current-active',
            '--current-hover',
            '--ui-background',
            '--ui-surface',
            '--ui-border',
            '--ui-text-primary',
            '--ui-text-secondary',
            '--ui-active',
            '--ui-hover'
        ];

        cssVars.forEach(varName => {
            const value = computedStyle.getPropertyValue(varName).trim();
            console.log(`${varName}: ${value}`);
            
            if (!value) {
                console.log(`❌ ${varName} is empty!`);
                this.issues.push(`${varName} CSS variable is empty`);
            } else if (!this.isGrayscale(value)) {
                console.log(`❌ ${varName} is not grayscale: ${value}`);
                this.issues.push(`${varName} is not grayscale: ${value}`);
            }
        });
    }

    checkAllElements() {
        console.log('\n🔍 Checking All Elements...');
        
        // Check body
        const body = document.body;
        const bodyStyle = getComputedStyle(body);
        console.log('Body background:', bodyStyle.backgroundColor);
        console.log('Body color:', bodyStyle.color);
        
        if (!this.isGrayscale(bodyStyle.backgroundColor)) {
            console.log('❌ Body background is not grayscale!');
            this.issues.push(`Body background is not grayscale: ${bodyStyle.backgroundColor}`);
        }
        
        // Check start screen
        const startScreen = document.querySelector('#startScreen, .start-screen');
        if (startScreen) {
            const startStyle = getComputedStyle(startScreen);
            console.log('Start screen background:', startStyle.backgroundColor);
            console.log('Start screen color:', startStyle.color);
            
            if (!this.isGrayscale(startStyle.backgroundColor)) {
                console.log('❌ Start screen background is not grayscale!');
                this.issues.push(`Start screen background is not grayscale: ${startStyle.backgroundColor}`);
            }
        }
        
        // Check all menu items
        const menuItems = document.querySelectorAll('.menu-item, .start-screen-content, .settings-overlay, .victory-content');
        menuItems.forEach((item, index) => {
            const style = getComputedStyle(item);
            console.log(`Menu item ${index}:`);
            console.log(`  Background: ${style.backgroundColor}`);
            console.log(`  Color: ${style.color}`);
            console.log(`  Border: ${style.borderColor}`);
            
            if (!this.isGrayscale(style.backgroundColor) && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                console.log(`❌ Menu item ${index} background is not grayscale!`);
                this.issues.push(`Menu item ${index} background is not grayscale: ${style.backgroundColor}`);
            }
        });
    }

    checkInlineStyles() {
        console.log('\n🎯 Checking Inline Styles...');
        
        const allElements = document.querySelectorAll('*');
        let inlineStyleCount = 0;
        
        allElements.forEach((element, index) => {
            if (element.style.cssText) {
                inlineStyleCount++;
                console.log(`Element ${index} has inline styles:`, element.style.cssText);
                
                // Check for hardcoded colors in inline styles
                const cssText = element.style.cssText;
                if (cssText.includes('rgb(') || cssText.includes('#') || cssText.includes('hsl(')) {
                    console.log(`❌ Element ${index} has hardcoded colors in inline styles!`);
                    this.issues.push(`Element ${index} has hardcoded colors in inline styles: ${cssText}`);
                }
            }
        });
        
        console.log(`Found ${inlineStyleCount} elements with inline styles`);
    }

    checkCSSFiles() {
        console.log('\n📁 Checking CSS Files...');
        
        // Check if all CSS files are loaded
        const stylesheets = document.styleSheets;
        console.log(`Found ${stylesheets.length} stylesheets`);
        
        // Convert to array to avoid forEach issues
        const stylesheetArray = Array.from(stylesheets);
        stylesheetArray.forEach((sheet, index) => {
            try {
                console.log(`Stylesheet ${index}: ${sheet.href || 'inline'}`);
                
                // Check for !important rules
                if (sheet.cssRules) {
                    for (let rule of sheet.cssRules) {
                        if (rule.style && rule.style.cssText.includes('!important')) {
                            console.log(`⚠️ Found !important rule: ${rule.selectorText}`);
                            this.issues.push(`!important rule found: ${rule.selectorText}`);
                        }
                    }
                }
            } catch (e) {
                console.log(`⚠️ Cannot access stylesheet ${index}: ${e.message}`);
            }
        });
    }

    isGrayscale(color) {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
            return true;
        }
        
        // Convert to RGB
        let r, g, b;
        
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        } else if (color.startsWith('rgb')) {
            const matches = color.match(/\d+/g);
            if (matches) {
                r = parseInt(matches[0]);
                g = parseInt(matches[1]);
                b = parseInt(matches[2]);
            }
        } else {
            return false;
        }
        
        // Check if R, G, B are approximately equal (grayscale)
        const tolerance = 5;
        return Math.abs(r - g) <= tolerance && Math.abs(g - b) <= tolerance && Math.abs(r - b) <= tolerance;
    }

    displayResults() {
        console.log('\n📊 === COMPREHENSIVE COLOR DEBUG SUMMARY ===');
        
        if (this.issues.length === 0) {
            console.log('✅ NO COLOR ISSUES FOUND!');
        } else {
            console.log(`❌ FOUND ${this.issues.length} COLOR ISSUES:`);
            
            this.issues.forEach((issue, index) => {
                console.log(`\n${index + 1}. ${issue}`);
            });
            
            console.log('\n💡 RECOMMENDATIONS:');
            console.log('1. Check if ColorManager is properly initialized');
            console.log('2. Verify HSL values are set to 0,0,50 for grayscale');
            console.log('3. Look for hardcoded colors in CSS or JavaScript');
            console.log('4. Check for !important rules overriding colors');
            console.log('5. Verify CSS variables are being set correctly');
            console.log('6. Check for inline styles setting colors');
        }
        
        // Force color refresh
        console.log('\n🔄 Forcing color refresh...');
        if (typeof colorManager !== 'undefined') {
            colorManager.applyColors();
            console.log('✅ ColorManager.applyColors() called');
        }
        
        // Check if settings are correct
        if (typeof settingsManager !== 'undefined') {
            console.log('Settings HSL:', settingsManager.settings);
            if (settingsManager.settings.saturation !== 0) {
                console.log('❌ Settings saturation is not 0!');
                settingsManager.updateHSLSetting(0, 0, 50);
                console.log('✅ Settings updated to grayscale');
            }
        }
    }
}

// Auto-run comprehensive color debugger
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new ComprehensiveColorDebugger();
        }, 3000); // Wait 3 seconds for everything to load
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ComprehensiveColorDebugger = ComprehensiveColorDebugger;
    window.runComprehensiveColorDebug = () => new ComprehensiveColorDebugger();
}
