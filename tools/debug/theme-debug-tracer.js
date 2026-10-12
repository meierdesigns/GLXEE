"use strict";

// Theme Debug Tracer
class ThemeDebugTracer {
    constructor() {
        this.functionCalls = [];
        this.colorSources = [];
        this.themeOverrides = [];
        this.init();
    }

    init() {
        console.log('🔍 === THEME DEBUG TRACER ===');
        this.traceColorFunctions();
        this.traceThemeApplication();
        this.findColorSources();
        this.identifyOverrides();
        this.generateDebugReport();
    }

    traceColorFunctions() {
        console.log('\n🔧 Tracing Color Functions...');
        
        // Trace ColorManager functions
        if (typeof colorManager !== 'undefined') {
            this.traceColorManager();
        } else {
            console.log('❌ ColorManager not found');
        }
        
        // Trace SettingsManager functions
        if (typeof settingsManager !== 'undefined') {
            this.traceSettingsManager();
        } else {
            console.log('❌ SettingsManager not found');
        }
        
        // Trace StartScreenManager functions
        if (typeof startScreenManager !== 'undefined') {
            this.traceStartScreenManager();
        } else {
            console.log('❌ StartScreenManager not found');
        }
        
        // Trace ImprovedColorSystem functions
        if (typeof window.improvedColorSystem !== 'undefined') {
            this.traceImprovedColorSystem();
        } else {
            console.log('❌ ImprovedColorSystem not found');
        }
    }

    traceColorManager() {
        console.log('\n🎨 Tracing ColorManager...');
        
        const originalMethods = {
            setHSL: colorManager.setHSL.bind(colorManager),
            applyColors: colorManager.applyColors.bind(colorManager),
            calculateColors: colorManager.calculateColors.bind(colorManager)
        };
        
        // Override setHSL to trace calls
        colorManager.setHSL = (hue, saturation, lightness) => {
            console.log(`🔧 ColorManager.setHSL(${hue}, ${saturation}, ${lightness}) called`);
            this.functionCalls.push({
                function: 'ColorManager.setHSL',
                args: [hue, saturation, lightness],
                timestamp: Date.now(),
                source: this.getCallerInfo()
            });
            return originalMethods.setHSL(hue, saturation, lightness);
        };
        
        // Override applyColors to trace calls
        colorManager.applyColors = () => {
            console.log(`🔧 ColorManager.applyColors() called`);
            this.functionCalls.push({
                function: 'ColorManager.applyColors',
                args: [],
                timestamp: Date.now(),
                source: this.getCallerInfo()
            });
            return originalMethods.applyColors();
        };
        
        // Override calculateColors to trace calls
        colorManager.calculateColors = () => {
            console.log(`🔧 ColorManager.calculateColors() called`);
            this.functionCalls.push({
                function: 'ColorManager.calculateColors',
                args: [],
                timestamp: Date.now(),
                source: this.getCallerInfo()
            });
            return originalMethods.calculateColors();
        };
        
        console.log('✅ ColorManager tracing active');
    }

    traceSettingsManager() {
        console.log('\n⚙️ Tracing SettingsManager...');
        
        if (settingsManager.updateHSLSetting) {
            const originalUpdateHSLSetting = settingsManager.updateHSLSetting.bind(settingsManager);
            
            settingsManager.updateHSLSetting = (hue, saturation, lightness) => {
                console.log(`🔧 SettingsManager.updateHSLSetting(${hue}, ${saturation}, ${lightness}) called`);
                this.functionCalls.push({
                    function: 'SettingsManager.updateHSLSetting',
                    args: [hue, saturation, lightness],
                    timestamp: Date.now(),
                    source: this.getCallerInfo()
                });
                return originalUpdateHSLSetting(hue, saturation, lightness);
            };
        }
        
        if (settingsManager.changeColor) {
            const originalChangeColor = settingsManager.changeColor.bind(settingsManager);
            
            settingsManager.changeColor = () => {
                console.log(`🔧 SettingsManager.changeColor() called`);
                this.functionCalls.push({
                    function: 'SettingsManager.changeColor',
                    args: [],
                    timestamp: Date.now(),
                    source: this.getCallerInfo()
                });
                return originalChangeColor();
            };
        }
        
        console.log('✅ SettingsManager tracing active');
    }

    traceStartScreenManager() {
        console.log('\n🖥️ Tracing StartScreenManager...');
        
        if (startScreenManager.applyHSLChange) {
            const originalApplyHSLChange = startScreenManager.applyHSLChange.bind(startScreenManager);
            
            startScreenManager.applyHSLChange = () => {
                console.log(`🔧 StartScreenManager.applyHSLChange() called`);
                this.functionCalls.push({
                    function: 'StartScreenManager.applyHSLChange',
                    args: [],
                    timestamp: Date.now(),
                    source: this.getCallerInfo()
                });
                return originalApplyHSLChange();
            };
        }
        
        if (startScreenManager.applySettings) {
            const originalApplySettings = startScreenManager.applySettings.bind(startScreenManager);
            
            startScreenManager.applySettings = () => {
                console.log(`🔧 StartScreenManager.applySettings() called`);
                this.functionCalls.push({
                    function: 'StartScreenManager.applySettings',
                    args: [],
                    timestamp: Date.now(),
                    source: this.getCallerInfo()
                });
                return originalApplySettings();
            };
        }
        
        console.log('✅ StartScreenManager tracing active');
    }

    traceImprovedColorSystem() {
        console.log('\n🎨 Tracing ImprovedColorSystem...');
        
        if (window.improvedColorSystem.applyPalette) {
            const originalApplyPalette = window.improvedColorSystem.applyPalette.bind(window.improvedColorSystem);
            
            window.improvedColorSystem.applyPalette = (paletteId) => {
                console.log(`🔧 ImprovedColorSystem.applyPalette(${paletteId}) called`);
                this.functionCalls.push({
                    function: 'ImprovedColorSystem.applyPalette',
                    args: [paletteId],
                    timestamp: Date.now(),
                    source: this.getCallerInfo()
                });
                return originalApplyPalette(paletteId);
            };
        }
        
        if (window.improvedColorSystem.applyColors) {
            const originalApplyColors = window.improvedColorSystem.applyColors.bind(window.improvedColorSystem);
            
            window.improvedColorSystem.applyColors = (colors) => {
                console.log(`🔧 ImprovedColorSystem.applyColors() called`);
                this.functionCalls.push({
                    function: 'ImprovedColorSystem.applyColors',
                    args: [colors],
                    timestamp: Date.now(),
                    source: this.getCallerInfo()
                });
                return originalApplyColors(colors);
            };
        }
        
        console.log('✅ ImprovedColorSystem tracing active');
    }

    traceThemeApplication() {
        console.log('\n🎯 Tracing Theme Application...');
        
        // Monitor CSS variable changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const element = mutation.target;
                    if (element === document.documentElement) {
                        console.log('🔧 CSS variables changed on document.documentElement');
                        this.traceCSSVariables();
                    }
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style']
        });
        
        console.log('✅ Theme application tracing active');
    }

    traceCSSVariables() {
        console.log('\n📋 Tracing CSS Variables...');
        
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
            '--overlay-color'
        ];
        
        cssVars.forEach(varName => {
            const value = computedStyle.getPropertyValue(varName).trim();
            console.log(`📋 ${varName}: ${value}`);
            
            this.colorSources.push({
                variable: varName,
                value: value,
                timestamp: Date.now(),
                source: 'CSS computed style'
            });
        });
    }

    findColorSources() {
        console.log('\n🔍 Finding Color Sources...');
        
        // Check for inline styles
        const elementsWithInlineStyles = document.querySelectorAll('[style*="color"], [style*="background"]');
        elementsWithInlineStyles.forEach((element, index) => {
            console.log(`🎨 Element ${index} has inline styles:`, element.style.cssText);
            this.colorSources.push({
                element: element.tagName,
                className: element.className,
                style: element.style.cssText,
                timestamp: Date.now(),
                source: 'Inline style'
            });
        });
        
        // Check for CSS classes
        const elementsWithColorClasses = document.querySelectorAll('.theme-teal, .theme-green, .theme-blue, .theme-red, .theme-purple, .theme-orange, .theme-pink, .theme-yellow');
        elementsWithColorClasses.forEach((element, index) => {
            console.log(`🎨 Element ${index} has theme class:`, element.className);
            this.themeOverrides.push({
                element: element.tagName,
                className: element.className,
                timestamp: Date.now(),
                source: 'Theme class'
            });
        });
        
        // Check for !important rules
        this.checkImportantRules();
    }

    checkImportantRules() {
        console.log('\n⚠️ Checking for !important rules...');
        
        try {
            const stylesheets = Array.from(document.styleSheets);
            stylesheets.forEach((sheet, index) => {
                try {
                    if (sheet.cssRules) {
                        for (let rule of sheet.cssRules) {
                            if (rule.style && rule.style.cssText.includes('!important')) {
                                console.log(`⚠️ !important rule found in stylesheet ${index}:`, rule.selectorText);
                                this.themeOverrides.push({
                                    stylesheet: index,
                                    selector: rule.selectorText,
                                    rule: rule.style.cssText,
                                    timestamp: Date.now(),
                                    source: '!important rule'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Cannot access stylesheet ${index}: ${e.message}`);
                }
            });
        } catch (error) {
            console.log('⚠️ Error checking stylesheets:', error);
        }
    }

    identifyOverrides() {
        console.log('\n🚨 Identifying Theme Overrides...');
        
        // Check for conflicting color systems
        if (typeof colorManager !== 'undefined' && typeof window.improvedColorSystem !== 'undefined') {
            console.log('⚠️ Multiple color systems detected: ColorManager and ImprovedColorSystem');
            this.themeOverrides.push({
                issue: 'Multiple color systems',
                systems: ['ColorManager', 'ImprovedColorSystem'],
                timestamp: Date.now(),
                source: 'System conflict'
            });
        }
        
        // Check for force-grayscale interference
        if (typeof window.ForceGrayscaleSystem !== 'undefined') {
            console.log('⚠️ ForceGrayscaleSystem detected - may override theme colors');
            this.themeOverrides.push({
                issue: 'ForceGrayscaleSystem interference',
                system: 'ForceGrayscaleSystem',
                timestamp: Date.now(),
                source: 'Force system'
            });
        }
        
        // Check for debug system interference
        const debugSystems = [
            'debug-colors.js',
            'intensive-border-debug.js',
            'menu-color-debug.js',
            'comprehensive-color-debug.js',
            'force-grayscale.js',
            'color-refactor-analyzer.js',
            'color-consolidator.js',
            'color-implementation-analyzer.js'
        ];
        
        debugSystems.forEach(script => {
            if (document.querySelector(`script[src*="${script}"]`)) {
                console.log(`⚠️ Debug system detected: ${script}`);
                this.themeOverrides.push({
                    issue: 'Debug system interference',
                    system: script,
                    timestamp: Date.now(),
                    source: 'Debug system'
                });
            }
        });
    }

    getCallerInfo() {
        try {
            const stack = new Error().stack;
            const lines = stack.split('\n');
            if (lines.length > 3) {
                return lines[3].trim();
            }
        } catch (e) {
            // Ignore
        }
        return 'Unknown';
    }

    generateDebugReport() {
        console.log('\n📊 === THEME DEBUG REPORT ===');
        
        console.log('\n🔧 Function Calls:');
        this.functionCalls.forEach((call, index) => {
            console.log(`${index + 1}. ${call.function}(${call.args.join(', ')})`);
            console.log(`   Source: ${call.source}`);
            console.log(`   Time: ${new Date(call.timestamp).toLocaleTimeString()}`);
        });
        
        console.log('\n🎨 Color Sources:');
        this.colorSources.forEach((source, index) => {
            console.log(`${index + 1}. ${source.variable || source.element}: ${source.value || source.style}`);
            console.log(`   Source: ${source.source}`);
        });
        
        console.log('\n🚨 Theme Overrides:');
        this.themeOverrides.forEach((override, index) => {
            console.log(`${index + 1}. ${override.issue || override.element}: ${override.className || override.selector}`);
            console.log(`   Source: ${override.source}`);
        });
        
        console.log('\n💡 Recommendations:');
        if (this.themeOverrides.length > 0) {
            console.log('1. Remove conflicting color systems');
            console.log('2. Check for !important rules');
            console.log('3. Remove theme classes from elements');
            console.log('4. Disable debug systems that interfere');
        } else {
            console.log('1. Check if color functions are being called');
            console.log('2. Verify CSS variables are being set');
            console.log('3. Check for JavaScript errors');
            console.log('4. Verify theme initialization');
        }
    }
}

// Auto-run theme debug tracer
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new ThemeDebugTracer();
        }, 2000);
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ThemeDebugTracer = ThemeDebugTracer;
    window.traceThemeDebug = () => new ThemeDebugTracer();
}
