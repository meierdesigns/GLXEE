"use strict";

// Force Grayscale System
class ForceGrayscaleSystem {
    constructor() {
        this.init();
    }

    init() {
        console.log('🔧 === FORCE GRAYSCALE SYSTEM ===');
        this.forceManagerInitialization();
        this.forceGrayscaleSettings();
        this.forceColorRefresh();
        this.monitorColorChanges();
    }

    forceManagerInitialization() {
        console.log('\n🚀 Forcing Manager Initialization...');
        
        // Force ColorManager initialization
        if (typeof colorManager === 'undefined') {
            console.log('❌ ColorManager not found, creating new instance...');
            if (typeof ColorManager !== 'undefined') {
                window.colorManager = new ColorManager();
                console.log('✅ ColorManager created');
            } else {
                console.log('❌ ColorManager class not available');
            }
        } else {
            console.log('✅ ColorManager already exists');
        }
        
        // Force SettingsManager initialization
        if (typeof settingsManager === 'undefined') {
            console.log('❌ SettingsManager not found globally');
            // Try to get from systemManager
            if (typeof systemManager !== 'undefined' && systemManager.getSubsystem) {
                window.settingsManager = systemManager.getSubsystem('settingsManager');
                console.log('✅ SettingsManager retrieved from systemManager');
            }
        } else {
            console.log('✅ SettingsManager already exists');
        }
        
        // Force StartScreenManager initialization
        if (typeof startScreenManager === 'undefined') {
            console.log('❌ StartScreenManager not found globally');
            if (typeof StartScreenManager !== 'undefined') {
                window.startScreenManager = new StartScreenManager();
                console.log('✅ StartScreenManager created');
            }
        } else {
            console.log('✅ StartScreenManager already exists');
        }
    }

    forceGrayscaleSettings() {
        console.log('\n🎨 Forcing Grayscale Settings...');
        
        // Force ColorManager to grayscale
        if (typeof colorManager !== 'undefined') {
            console.log('Setting ColorManager to grayscale...');
            colorManager.setHSL(0, 0, 50);
            console.log('✅ ColorManager set to H=0, S=0, L=50');
        }
        
        // Force SettingsManager to grayscale
        if (typeof settingsManager !== 'undefined') {
            console.log('Setting SettingsManager to grayscale...');
            settingsManager.updateHSLSetting(0, 0, 50);
            console.log('✅ SettingsManager set to H=0, S=0, L=50');
        }
        
        // Force StartScreenManager sliders to grayscale
        if (typeof startScreenManager !== 'undefined') {
            console.log('Setting StartScreenManager sliders to grayscale...');
            const hueItem = startScreenManager.settingsItems.find(item => item.name === 'Hue');
            const saturationItem = startScreenManager.settingsItems.find(item => item.name === 'Saturation');
            const lightnessItem = startScreenManager.settingsItems.find(item => item.name === 'Lightness');
            
            if (hueItem) hueItem.value = 0;
            if (saturationItem) saturationItem.value = 0;
            if (lightnessItem) lightnessItem.value = 50;
            
            startScreenManager.applyHSLChange();
            console.log('✅ StartScreenManager sliders set to grayscale');
        }
    }

    forceColorRefresh() {
        console.log('\n🔄 Forcing Color Refresh...');
        
        // Force apply colors
        if (typeof colorManager !== 'undefined') {
            colorManager.applyColors();
            console.log('✅ ColorManager.applyColors() called');
        }
        
        // Force CSS variable update
        this.forceSetCSSVariables();
        
        // Force body style update
        document.body.style.background = '#0a0a0a';
        document.body.style.color = '#e0e0e0';
        console.log('✅ Body styles forced to grayscale');
        
        // Force remove theme classes
        document.body.classList.remove('theme-teal', 'theme-green', 'theme-blue', 'theme-red', 'theme-purple', 'theme-orange', 'theme-pink', 'theme-yellow');
        console.log('✅ Theme classes removed');
    }

    forceSetCSSVariables() {
        console.log('\n📋 Forcing CSS Variables...');
        
        const root = document.documentElement;
        
        // Force grayscale CSS variables
        const grayscaleVars = {
            '--current-primary': '#808080',
            '--current-secondary': '#606060',
            '--current-accent': '#808080',
            '--current-background': '#0a0a0a',
            '--current-background-light': '#1a1a1a',
            '--current-surface': '#2a2a2a',
            '--current-border': '#404040',
            '--current-text': '#e0e0e0',
            '--current-text-secondary': '#a0a0a0',
            '--current-text-dim': '#808080',
            '--current-active': '#606060',
            '--current-hover': '#404040',
            '--ui-background': '#2a2a2a',
            '--ui-surface': '#1a1a1a',
            '--ui-border': '#404040',
            '--ui-text-primary': '#e0e0e0',
            '--ui-text-secondary': '#a0a0a0',
            '--ui-text-muted': '#666666',
            '--ui-highlight': '#808080',
            '--ui-accent': '#808080',
            '--ui-active': '#606060',
            '--ui-hover': '#404040',
            '--overlay-color': '#808080'
        };
        
        Object.entries(grayscaleVars).forEach(([varName, value]) => {
            root.style.setProperty(varName, value);
            console.log(`✅ ${varName}: ${value}`);
        });
        
        console.log('✅ All CSS variables forced to grayscale');
    }

    monitorColorChanges() {
        console.log('\n👁️ Setting up Color Monitoring...');
        
        // Monitor for any color changes and force them back to grayscale
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const element = mutation.target;
                    const style = element.style;
                    
                    // Check for non-grayscale colors
                    if (style.backgroundColor && !this.isGrayscale(style.backgroundColor)) {
                        console.log('⚠️ Non-grayscale background detected, forcing grayscale...');
                        this.forceColorRefresh();
                    }
                    
                    if (style.color && !this.isGrayscale(style.color)) {
                        console.log('⚠️ Non-grayscale text color detected, forcing grayscale...');
                        this.forceColorRefresh();
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['style', 'class']
        });
        
        console.log('✅ Color monitoring active');
        
        // Set up periodic refresh
        setInterval(() => {
            this.periodicRefresh();
        }, 5000); // Every 5 seconds
        
        console.log('✅ Periodic refresh active (every 5 seconds)');
    }

    periodicRefresh() {
        // Silently refresh colors every 5 seconds
        if (typeof colorManager !== 'undefined') {
            const hsl = colorManager.getHSL();
            if (hsl.saturation !== 0) {
                console.log('⚠️ Saturation drift detected, correcting...');
                colorManager.setHSL(0, 0, 50);
            }
        }
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
}

// Auto-run force grayscale system
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            new ForceGrayscaleSystem();
        }, 1000); // Run after 1 second
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ForceGrayscaleSystem = ForceGrayscaleSystem;
    window.forceGrayscale = () => new ForceGrayscaleSystem();
}
