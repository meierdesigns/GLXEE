"use strict";

// Comprehensive Color Debug System
class ColorDebugger {
    constructor() {
        this.debugResults = [];
        this.init();
    }

    init() {
        console.log('🔍 === COMPREHENSIVE COLOR DEBUG ===');
        this.runAllTests();
        this.displayResults();
    }

    runAllTests() {
        this.testCSSVariables();
        this.testColorManager();
        this.testHSLValues();
        this.testElementStyles();
        this.testOverridePriority();
    }

    testCSSVariables() {
        console.log('\n📋 Testing CSS Variables...');
        
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        const variables = [
            '--current-primary',
            '--current-secondary', 
            '--current-accent',
            '--current-background',
            '--current-background-light',
            '--current-surface',
            '--current-border',
            '--current-text',
            '--current-text-secondary',
            '--ui-background',
            '--ui-surface',
            '--ui-border',
            '--ui-text-primary',
            '--ui-text-secondary'
        ];

        variables.forEach(varName => {
            const value = computedStyle.getPropertyValue(varName).trim();
            const isGrayscale = this.isGrayscaleColor(value);
            const status = isGrayscale ? '✅' : '❌';
            
            console.log(`${status} ${varName}: ${value} ${isGrayscale ? '(grayscale)' : '(COLORED)'}`);
            
            this.debugResults.push({
                type: 'css-variable',
                name: varName,
                value: value,
                isGrayscale: isGrayscale,
                status: isGrayscale ? 'ok' : 'error'
            });
        });
    }

    testColorManager() {
        console.log('\n🎨 Testing ColorManager...');
        
        if (typeof colorManager !== 'undefined') {
            const hsl = colorManager.getHSL();
            const colors = colorManager.getCurrentColors();
            
            console.log(`HSL Values: H=${hsl.hue}, S=${hsl.saturation}, L=${hsl.lightness}`);
            console.log(`Saturation is ${hsl.saturation === 0 ? '0 (grayscale)' : `${hsl.saturation} (colored)`}`);
            
            Object.entries(colors).forEach(([key, value]) => {
                const isGrayscale = this.isGrayscaleColor(value);
                const status = isGrayscale ? '✅' : '❌';
                console.log(`${status} ${key}: ${value} ${isGrayscale ? '(grayscale)' : '(COLORED)'}`);
                
                this.debugResults.push({
                    type: 'color-manager',
                    name: key,
                    value: value,
                    isGrayscale: isGrayscale,
                    status: isGrayscale ? 'ok' : 'error'
                });
            });
        } else {
            console.log('❌ ColorManager not found!');
            this.debugResults.push({
                type: 'color-manager',
                name: 'manager',
                value: 'undefined',
                isGrayscale: false,
                status: 'error'
            });
        }
    }

    testHSLValues() {
        console.log('\n🌈 Testing HSL Calculations...');
        
        if (typeof colorManager !== 'undefined') {
            // Test HSL to Hex conversion
            const testValues = [
                { h: 0, s: 0, l: 50, expected: 'grayscale' },
                { h: 180, s: 0, l: 50, expected: 'grayscale' },
                { h: 0, s: 70, l: 50, expected: 'colored' },
                { h: 180, s: 70, l: 50, expected: 'colored' }
            ];

            testValues.forEach(test => {
                const hex = colorManager.hslToHex(test.h, test.s, test.l);
                const isGrayscale = this.isGrayscaleColor(hex);
                const matches = (test.expected === 'grayscale') === isGrayscale;
                const status = matches ? '✅' : '❌';
                
                console.log(`${status} HSL(${test.h}, ${test.s}, ${test.l}) = ${hex} (${isGrayscale ? 'grayscale' : 'colored'}) - Expected: ${test.expected}`);
                
                this.debugResults.push({
                    type: 'hsl-calculation',
                    name: `HSL(${test.h},${test.s},${test.l})`,
                    value: hex,
                    isGrayscale: isGrayscale,
                    status: matches ? 'ok' : 'error'
                });
            });
        }
    }

    testElementStyles() {
        console.log('\n🎯 Testing Element Styles...');
        
        const elements = [
            { selector: 'body', name: 'Body' },
            { selector: '.start-screen', name: 'Start Screen' },
            { selector: '.start-screen-content', name: 'Start Screen Content' },
            { selector: '.menu-item.selected', name: 'Selected Menu Item' }
        ];

        elements.forEach(element => {
            const el = document.querySelector(element.selector);
            if (el) {
                const computedStyle = getComputedStyle(el);
                const backgroundColor = computedStyle.backgroundColor;
                const borderColor = computedStyle.borderColor;
                const color = computedStyle.color;
                
                console.log(`\n${element.name} (${element.selector}):`);
                console.log(`  Background: ${backgroundColor} ${this.isGrayscaleColor(backgroundColor) ? '(grayscale)' : '(COLORED)'}`);
                console.log(`  Border: ${borderColor} ${this.isGrayscaleColor(borderColor) ? '(grayscale)' : '(COLORED)'}`);
                console.log(`  Text: ${color} ${this.isGrayscaleColor(color) ? '(grayscale)' : '(COLORED)'}`);
                
                this.debugResults.push({
                    type: 'element-style',
                    name: element.name,
                    value: `bg:${backgroundColor}, border:${borderColor}, text:${color}`,
                    isGrayscale: this.isGrayscaleColor(backgroundColor) && this.isGrayscaleColor(borderColor),
                    status: this.isGrayscaleColor(backgroundColor) && this.isGrayscaleColor(borderColor) ? 'ok' : 'error'
                });
            } else {
                console.log(`❌ Element not found: ${element.selector}`);
            }
        });
    }

    testOverridePriority() {
        console.log('\n⚡ Testing CSS Override Priority...');
        
        // Check if there are any !important rules
        const styleSheets = document.styleSheets;
        let importantRules = 0;
        
        for (let i = 0; i < styleSheets.length; i++) {
            try {
                const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                for (let j = 0; j < rules.length; j++) {
                    const rule = rules[j];
                    if (rule.style && rule.style.cssText.includes('!important')) {
                        importantRules++;
                        if (rule.selectorText && rule.selectorText.includes('current')) {
                            console.log(`⚠️  Important rule found: ${rule.selectorText}`);
                        }
                    }
                }
            } catch (e) {
                // Cross-origin stylesheets can't be accessed
            }
        }
        
        console.log(`Found ${importantRules} rules with !important`);
        
        // Check body classes
        const bodyClasses = document.body.className;
        console.log(`Body classes: ${bodyClasses}`);
        
        // Check for theme classes
        const themeClasses = bodyClasses.match(/theme-\w+/g);
        if (themeClasses) {
            console.log(`⚠️  Theme classes found: ${themeClasses.join(', ')}`);
        }
        
        this.debugResults.push({
            type: 'override-priority',
            name: 'important-rules',
            value: importantRules.toString(),
            isGrayscale: importantRules === 0,
            status: importantRules === 0 ? 'ok' : 'warning'
        });
    }

    isGrayscaleColor(color) {
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
        console.log('\n📊 === DEBUG SUMMARY ===');
        
        const errors = this.debugResults.filter(r => r.status === 'error');
        const warnings = this.debugResults.filter(r => r.status === 'warning');
        const ok = this.debugResults.filter(r => r.status === 'ok');
        
        console.log(`✅ OK: ${ok.length}`);
        console.log(`⚠️  Warnings: ${warnings.length}`);
        console.log(`❌ Errors: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n❌ ERRORS FOUND:');
            errors.forEach(error => {
                console.log(`  ${error.type}: ${error.name} = ${error.value}`);
            });
        }
        
        if (warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            warnings.forEach(warning => {
                console.log(`  ${warning.type}: ${warning.name} = ${warning.value}`);
            });
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (errors.length > 0) {
            console.log('1. Fix CSS variable values to be grayscale');
            console.log('2. Check ColorManager initialization');
            console.log('3. Verify HSL calculations');
        }
        if (warnings.length > 0) {
            console.log('4. Remove !important rules that override colors');
            console.log('5. Check for theme classes on body');
        }
    }
}

// Auto-run debugger
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new ColorDebugger();
        }, 1000);
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ColorDebugger = ColorDebugger;
    window.runColorDebug = () => new ColorDebugger();
}
