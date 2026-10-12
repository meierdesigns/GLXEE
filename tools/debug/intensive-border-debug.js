"use strict";

// Intensive Border Debug System
class IntensiveBorderDebugger {
    constructor() {
        this.borderIssues = [];
        this.init();
    }

    init() {
        console.log('🔍 === INTENSIVE BORDER DEBUG ===');
        this.runAllBorderTests();
        this.displayBorderResults();
    }

    runAllBorderTests() {
        this.testAllBorderColors();
        this.testAllBoxShadows();
        this.testStartScreenBorders();
        this.testSettingsBorders();
        this.testMenuBorders();
        this.testButtonBorders();
    }

    testAllBorderColors() {
        console.log('\n🎯 Testing ALL Border Colors...');
        
        const borderSelectors = [
            '.start-screen-content',
            '.game-info-panel',
            '.victory-content',
            '.victory-button',
            '.game-over-content',
            '.game-over-button',
            '.pause-overlay',
            '.settings-overlay',
            '.planet-selection-content',
            '.planet-item',
            '.planet-card',
            '.combined-selection-content',
            '.tab-button',
            '.level-item',
            '.ship-item',
            '.player-selection-content',
            '.ship-belt-item',
            '.level-belt-item',
            '.ability-detailed',
            '.menu-item'
        ];

        borderSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                const computedStyle = getComputedStyle(element);
                const borderColor = computedStyle.borderColor;
                const borderTopColor = computedStyle.borderTopColor;
                const borderRightColor = computedStyle.borderRightColor;
                const borderBottomColor = computedStyle.borderBottomColor;
                const borderLeftColor = computedStyle.borderLeftColor;
                
                const isGrayscale = this.isGrayscaleColor(borderColor);
                const status = isGrayscale ? '✅' : '❌';
                
                console.log(`${status} ${selector}[${index}]: border-color=${borderColor} ${isGrayscale ? '(grayscale)' : '(COLORED)'}`);
                
                if (!isGrayscale) {
                    this.borderIssues.push({
                        selector: selector,
                        element: element,
                        property: 'border-color',
                        value: borderColor,
                        issue: 'Not grayscale'
                    });
                }

                // Check individual border sides
                [
                    { prop: 'border-top-color', value: borderTopColor },
                    { prop: 'border-right-color', value: borderRightColor },
                    { prop: 'border-bottom-color', value: borderBottomColor },
                    { prop: 'border-left-color', value: borderLeftColor }
                ].forEach(border => {
                    if (border.value !== borderColor) {
                        const sideGrayscale = this.isGrayscaleColor(border.value);
                        const sideStatus = sideGrayscale ? '✅' : '❌';
                        console.log(`  ${sideStatus} ${border.prop}: ${border.value} ${sideGrayscale ? '(grayscale)' : '(COLORED)'}`);
                        
                        if (!sideGrayscale) {
                            this.borderIssues.push({
                                selector: selector,
                                element: element,
                                property: border.prop,
                                value: border.value,
                                issue: 'Not grayscale'
                            });
                        }
                    }
                });
            });
        });
    }

    testAllBoxShadows() {
        console.log('\n✨ Testing ALL Box Shadows...');
        
        const shadowSelectors = [
            '.victory-button',
            '.victory-button:hover',
            '.victory-button.selected',
            '.game-over-button:hover',
            '.game-over-button.selected',
            '.pause-button:hover',
            '.pause-button.selected',
            '.toggle-button:hover',
            '.planet-item:hover',
            '.planet-item.selected',
            '.tab-button:hover',
            '.tab-button.active',
            '.level-item:hover',
            '.level-item.selected',
            '.ship-item:hover',
            '.ship-item.selected',
            '.ship-belt-item:hover',
            '.ship-belt-item.selected',
            '.level-belt-item:hover',
            '.level-belt-item.selected'
        ];

        shadowSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector.replace(':hover', '').replace('.selected', '').replace('.active', ''));
            elements.forEach((element, index) => {
                const computedStyle = getComputedStyle(element);
                const boxShadow = computedStyle.boxShadow;
                
                if (boxShadow && boxShadow !== 'none') {
                    // Extract colors from box-shadow
                    const shadowColors = this.extractColorsFromBoxShadow(boxShadow);
                    shadowColors.forEach(color => {
                        const isGrayscale = this.isGrayscaleColor(color);
                        const status = isGrayscale ? '✅' : '❌';
                        console.log(`${status} ${selector}[${index}]: box-shadow color=${color} ${isGrayscale ? '(grayscale)' : '(COLORED)'}`);
                        
                        if (!isGrayscale) {
                            this.borderIssues.push({
                                selector: selector,
                                element: element,
                                property: 'box-shadow',
                                value: color,
                                issue: 'Shadow color not grayscale'
                            });
                        }
                    });
                }
            });
        });
    }

    testStartScreenBorders() {
        console.log('\n🏠 Testing Start Screen Borders...');
        
        const startScreen = document.querySelector('.start-screen');
        if (startScreen) {
            const content = startScreen.querySelector('.start-screen-content');
            if (content) {
                const computedStyle = getComputedStyle(content);
                const borderColor = computedStyle.borderColor;
                const backgroundColor = computedStyle.backgroundColor;
                
                console.log(`Start Screen Content:`);
                console.log(`  Border: ${borderColor} ${this.isGrayscaleColor(borderColor) ? '(grayscale)' : '(COLORED)'}`);
                console.log(`  Background: ${backgroundColor} ${this.isGrayscaleColor(backgroundColor) ? '(grayscale)' : '(COLORED)'}`);
                
                if (!this.isGrayscaleColor(borderColor)) {
                    this.borderIssues.push({
                        selector: '.start-screen-content',
                        element: content,
                        property: 'border-color',
                        value: borderColor,
                        issue: 'Start screen border not grayscale'
                    });
                }
            }
        }
    }

    testSettingsBorders() {
        console.log('\n⚙️ Testing Settings Borders...');
        
        const settingsOverlay = document.querySelector('.settings-overlay');
        if (settingsOverlay) {
            const computedStyle = getComputedStyle(settingsOverlay);
            const borderColor = computedStyle.borderColor;
            const backgroundColor = computedStyle.backgroundColor;
            const boxShadow = computedStyle.boxShadow;
            
            console.log(`Settings Overlay:`);
            console.log(`  Border: ${borderColor} ${this.isGrayscaleColor(borderColor) ? '(grayscale)' : '(COLORED)'}`);
            console.log(`  Background: ${backgroundColor} ${this.isGrayscaleColor(backgroundColor) ? '(grayscale)' : '(COLORED)'}`);
            console.log(`  Box Shadow: ${boxShadow}`);
            
            if (!this.isGrayscaleColor(borderColor)) {
                this.borderIssues.push({
                    selector: '.settings-overlay',
                    element: settingsOverlay,
                    property: 'border-color',
                    value: borderColor,
                    issue: 'Settings border not grayscale'
                });
            }
        }
    }

    testMenuBorders() {
        console.log('\n📋 Testing Menu Item Borders...');
        
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach((item, index) => {
            const computedStyle = getComputedStyle(item);
            const borderColor = computedStyle.borderColor;
            const backgroundColor = computedStyle.backgroundColor;
            
            console.log(`Menu Item ${index}:`);
            console.log(`  Border: ${borderColor} ${this.isGrayscaleColor(borderColor) ? '(grayscale)' : '(COLORED)'}`);
            console.log(`  Background: ${backgroundColor} ${this.isGrayscaleColor(backgroundColor) ? '(grayscale)' : '(COLORED)'}`);
            
            if (!this.isGrayscaleColor(borderColor)) {
                this.borderIssues.push({
                    selector: '.menu-item',
                    element: item,
                    property: 'border-color',
                    value: borderColor,
                    issue: 'Menu item border not grayscale'
                });
            }
        });
    }

    testButtonBorders() {
        console.log('\n🔘 Testing Button Borders...');
        
        const buttons = document.querySelectorAll('button, .victory-button, .game-over-button, .pause-button, .toggle-button');
        buttons.forEach((button, index) => {
            const computedStyle = getComputedStyle(button);
            const borderColor = computedStyle.borderColor;
            const backgroundColor = computedStyle.backgroundColor;
            const boxShadow = computedStyle.boxShadow;
            
            console.log(`Button ${index} (${button.className}):`);
            console.log(`  Border: ${borderColor} ${this.isGrayscaleColor(borderColor) ? '(grayscale)' : '(COLORED)'}`);
            console.log(`  Background: ${backgroundColor} ${this.isGrayscaleColor(backgroundColor) ? '(grayscale)' : '(COLORED)'}`);
            
            if (boxShadow && boxShadow !== 'none') {
                const shadowColors = this.extractColorsFromBoxShadow(boxShadow);
                shadowColors.forEach(color => {
                    console.log(`  Shadow Color: ${color} ${this.isGrayscaleColor(color) ? '(grayscale)' : '(COLORED)'}`);
                });
            }
            
            if (!this.isGrayscaleColor(borderColor)) {
                this.borderIssues.push({
                    selector: button.className || 'button',
                    element: button,
                    property: 'border-color',
                    value: borderColor,
                    issue: 'Button border not grayscale'
                });
            }
        });
    }

    extractColorsFromBoxShadow(boxShadow) {
        const colors = [];
        // Match RGB/RGBA colors in box-shadow
        const rgbMatches = boxShadow.match(/rgba?\([^)]+\)/g);
        if (rgbMatches) {
            colors.push(...rgbMatches);
        }
        
        // Match hex colors in box-shadow (less common but possible)
        const hexMatches = boxShadow.match(/#[0-9a-fA-F]{3,6}/g);
        if (hexMatches) {
            colors.push(...hexMatches);
        }
        
        return colors;
    }

    isGrayscaleColor(color) {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color === 'none') {
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

    displayBorderResults() {
        console.log('\n📊 === INTENSIVE BORDER DEBUG SUMMARY ===');
        
        if (this.borderIssues.length === 0) {
            console.log('✅ ALL BORDERS ARE GRAYSCALE!');
        } else {
            console.log(`❌ FOUND ${this.borderIssues.length} BORDER ISSUES:`);
            
            this.borderIssues.forEach((issue, index) => {
                console.log(`\n${index + 1}. ${issue.selector}`);
                console.log(`   Property: ${issue.property}`);
                console.log(`   Value: ${issue.value}`);
                console.log(`   Issue: ${issue.issue}`);
                
                // Try to identify the CSS rule
                if (issue.element) {
                    const rect = issue.element.getBoundingClientRect();
                    console.log(`   Element position: x=${Math.round(rect.x)}, y=${Math.round(rect.y)}, w=${Math.round(rect.width)}, h=${Math.round(rect.height)}`);
                }
            });
            
            console.log('\n💡 BORDER FIX RECOMMENDATIONS:');
            console.log('1. Search for hardcoded colors in CSS');
            console.log('2. Replace with --current-border or --ui-border variables');
            console.log('3. Check for !important rules overriding colors');
            console.log('4. Verify CSS variable values are grayscale');
            console.log('5. Check for inline styles setting colors');
        }
        
        // Group issues by property
        const byProperty = {};
        this.borderIssues.forEach(issue => {
            if (!byProperty[issue.property]) {
                byProperty[issue.property] = [];
            }
            byProperty[issue.property].push(issue);
        });
        
        console.log('\n📈 ISSUES BY PROPERTY:');
        Object.entries(byProperty).forEach(([property, issues]) => {
            console.log(`  ${property}: ${issues.length} issues`);
        });
    }
}

// Auto-run intensive border debugger
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new IntensiveBorderDebugger();
        }, 2000); // Wait 2 seconds for everything to load
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.IntensiveBorderDebugger = IntensiveBorderDebugger;
    window.runIntensiveBorderDebug = () => new IntensiveBorderDebugger();
}
