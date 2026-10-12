"use strict";

// Improved Color System
class ImprovedColorSystem {
    constructor() {
        this.palettes = {};
        this.currentPalette = null;
        this.customColors = {};
        this.colorHistory = [];
        this.favorites = [];
        this.init();
    }

    init() {
        console.log('🎨 === IMPROVED COLOR SYSTEM ===');
        this.initializePalettes();
        this.setupEventListeners();
        this.loadUserPreferences();
        console.log('✅ Improved color system initialized');
    }

    initializePalettes() {
        console.log('\n🎨 Initializing Color Palettes...');
        
        this.palettes = {
            grayscale: {
                name: 'Grayscale',
                description: 'Classic black and white theme',
                colors: {
                    primary: '#808080',
                    secondary: '#606060',
                    accent: '#808080',
                    background: '#0a0a0a',
                    backgroundLight: '#1a1a1a',
                    surface: '#2a2a2a',
                    border: '#404040',
                    text: '#e0e0e0',
                    textSecondary: '#a0a0a0',
                    textDim: '#808080'
                },
                hsl: { hue: 0, saturation: 0, lightness: 50 }
            },
            warm: {
                name: 'Warm',
                description: 'Warm orange and red tones',
                colors: {
                    primary: '#ff6b35',
                    secondary: '#d63031',
                    accent: '#fdcb6e',
                    background: '#2d1b1b',
                    backgroundLight: '#3d2b2b',
                    surface: '#4d3b3b',
                    border: '#6d4b4b',
                    text: '#ffe0d0',
                    textSecondary: '#ffb0a0',
                    textDim: '#ff8080'
                },
                hsl: { hue: 15, saturation: 80, lightness: 60 }
            },
            cool: {
                name: 'Cool',
                description: 'Cool blue and cyan tones',
                colors: {
                    primary: '#0984e3',
                    secondary: '#00b894',
                    accent: '#74b9ff',
                    background: '#1b2d3d',
                    backgroundLight: '#2b3d4d',
                    surface: '#3b4d5d',
                    border: '#4b5d6d',
                    text: '#d0e0ff',
                    textSecondary: '#a0c0ff',
                    textDim: '#80a0ff'
                },
                hsl: { hue: 200, saturation: 80, lightness: 50 }
            },
            vibrant: {
                name: 'Vibrant',
                description: 'Bright and colorful theme',
                colors: {
                    primary: '#e84393',
                    secondary: '#fd79a8',
                    accent: '#fdcb6e',
                    background: '#2d1b2d',
                    backgroundLight: '#3d2b3d',
                    surface: '#4d3b4d',
                    border: '#6d4b6d',
                    text: '#ffe0ff',
                    textSecondary: '#ffb0ff',
                    textDim: '#ff80ff'
                },
                hsl: { hue: 320, saturation: 80, lightness: 60 }
            },
            retro: {
                name: 'Retro',
                description: '80s retro gaming colors',
                colors: {
                    primary: '#00ff41',
                    secondary: '#ff0080',
                    accent: '#00ffff',
                    background: '#0a0a0a',
                    backgroundLight: '#1a1a1a',
                    surface: '#2a2a2a',
                    border: '#404040',
                    text: '#00ff41',
                    textSecondary: '#80ff80',
                    textDim: '#40ff40'
                },
                hsl: { hue: 120, saturation: 100, lightness: 50 }
            },
            minimal: {
                name: 'Minimal',
                description: 'Clean and minimal design',
                colors: {
                    primary: '#636e72',
                    secondary: '#2d3436',
                    accent: '#74b9ff',
                    background: '#ffffff',
                    backgroundLight: '#f8f9fa',
                    surface: '#e9ecef',
                    border: '#dee2e6',
                    text: '#2d3436',
                    textSecondary: '#636e72',
                    textDim: '#b2bec3'
                },
                hsl: { hue: 200, saturation: 20, lightness: 50 }
            }
        };
        
        // Set default palette
        this.currentPalette = 'grayscale';
        
        console.log(`✅ ${Object.keys(this.palettes).length} color palettes initialized`);
    }

    setupEventListeners() {
        console.log('\n🎯 Setting up Event Listeners...');
        
        // Listen for palette changes
        document.addEventListener('palettechange', (event) => {
            this.applyPalette(event.detail.paletteId);
        });
        
        // Listen for custom color changes
        document.addEventListener('customcolorchange', (event) => {
            this.applyCustomColor(event.detail.colorType, event.detail.color);
        });
        
        console.log('✅ Event listeners setup complete');
    }

    loadUserPreferences() {
        console.log('\n💾 Loading User Preferences...');
        
        try {
            const savedPalette = localStorage.getItem('colorPalette');
            const savedFavorites = localStorage.getItem('colorFavorites');
            const savedHistory = localStorage.getItem('colorHistory');
            
            if (savedPalette && this.palettes[savedPalette]) {
                this.currentPalette = savedPalette;
            }
            
            if (savedFavorites) {
                this.favorites = JSON.parse(savedFavorites);
            }
            
            if (savedHistory) {
                this.colorHistory = JSON.parse(savedHistory);
            }
            
            console.log('✅ User preferences loaded');
        } catch (error) {
            console.log('⚠️ Could not load user preferences:', error);
        }
    }

    saveUserPreferences() {
        console.log('\n💾 Saving User Preferences...');
        
        try {
            localStorage.setItem('colorPalette', this.currentPalette);
            localStorage.setItem('colorFavorites', JSON.stringify(this.favorites));
            localStorage.setItem('colorHistory', JSON.stringify(this.colorHistory));
            
            console.log('✅ User preferences saved');
        } catch (error) {
            console.log('⚠️ Could not save user preferences:', error);
        }
    }

    applyPalette(paletteId) {
        console.log(`\n🎨 Applying palette: ${paletteId}`);
        
        if (!this.palettes[paletteId]) {
            console.log(`❌ Palette ${paletteId} not found`);
            return;
        }
        
        this.currentPalette = paletteId;
        const palette = this.palettes[paletteId];
        
        // Apply colors to CSS variables
        this.applyColors(palette.colors);
        
        // Update ColorManager if available
        if (typeof colorManager !== 'undefined') {
            colorManager.setHSL(palette.hsl.hue, palette.hsl.saturation, palette.hsl.lightness);
        }
        
        // Add to history
        this.addToHistory(paletteId);
        
        // Save preferences
        this.saveUserPreferences();
        
        console.log(`✅ Palette ${paletteId} applied`);
    }

    applyCustomColor(colorType, color) {
        console.log(`\n🎨 Applying custom color: ${colorType} = ${color}`);
        
        if (!this.customColors[this.currentPalette]) {
            this.customColors[this.currentPalette] = {};
        }
        
        this.customColors[this.currentPalette][colorType] = color;
        
        // Apply the custom color
        const colors = { ...this.palettes[this.currentPalette].colors };
        colors[colorType] = color;
        
        this.applyColors(colors);
        
        console.log(`✅ Custom color applied: ${colorType} = ${color}`);
    }

    applyColors(colors) {
        console.log('\n🎨 Applying colors to CSS variables...');
        
        const root = document.documentElement;
        
        // Apply all colors at once for better performance
        const cssVars = {
            '--current-primary': colors.primary,
            '--current-secondary': colors.secondary,
            '--current-accent': colors.accent,
            '--current-background': colors.background,
            '--current-background-light': colors.backgroundLight,
            '--current-surface': colors.surface,
            '--current-border': colors.border,
            '--current-text': colors.text,
            '--current-text-secondary': colors.textSecondary,
            '--current-text-dim': colors.textDim,
            '--current-active': colors.border,
            '--current-hover': colors.surface,
            '--overlay-color': colors.primary
        };
        
        // Batch update CSS variables
        Object.entries(cssVars).forEach(([varName, value]) => {
            root.style.setProperty(varName, value);
        });
        
        // Update body background
        document.body.style.background = colors.background;
        
        // Remove old theme classes
        document.body.classList.remove('theme-teal', 'theme-green', 'theme-blue', 'theme-red', 'theme-purple', 'theme-orange', 'theme-pink', 'theme-yellow');
        
        console.log('✅ Colors applied to CSS variables');
    }

    addToHistory(paletteId) {
        // Add to history (keep last 10)
        this.colorHistory.unshift(paletteId);
        this.colorHistory = this.colorHistory.slice(0, 10);
    }

    addToFavorites(paletteId) {
        if (!this.favorites.includes(paletteId)) {
            this.favorites.push(paletteId);
            this.saveUserPreferences();
        }
    }

    removeFromFavorites(paletteId) {
        const index = this.favorites.indexOf(paletteId);
        if (index > -1) {
            this.favorites.splice(index, 1);
            this.saveUserPreferences();
        }
    }

    createPaletteSelector() {
        console.log('\n🎨 Creating Palette Selector...');
        
        const selector = document.createElement('div');
        selector.className = 'palette-selector';
        selector.innerHTML = `
            <div class="palette-grid">
                ${Object.entries(this.palettes).map(([id, palette]) => `
                    <div class="palette-item ${id === this.currentPalette ? 'active' : ''}" data-palette="${id}">
                        <div class="palette-preview">
                            <div class="color-swatch primary" style="background: ${palette.colors.primary}"></div>
                            <div class="color-swatch secondary" style="background: ${palette.colors.secondary}"></div>
                            <div class="color-swatch accent" style="background: ${palette.colors.accent}"></div>
                        </div>
                        <div class="palette-name">${palette.name}</div>
                        <div class="palette-description">${palette.description}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add click handlers
        selector.querySelectorAll('.palette-item').forEach(item => {
            item.addEventListener('click', () => {
                const paletteId = item.dataset.palette;
                this.applyPalette(paletteId);
                
                // Update active state
                selector.querySelectorAll('.palette-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
        
        console.log('✅ Palette selector created');
        return selector;
    }

    getCurrentPalette() {
        return this.palettes[this.currentPalette];
    }

    getAvailablePalettes() {
        return Object.keys(this.palettes);
    }

    getColorHistory() {
        return this.colorHistory;
    }

    getFavorites() {
        return this.favorites;
    }
}

// Auto-run improved color system
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.improvedColorSystem = new ImprovedColorSystem();
        }, 1000);
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ImprovedColorSystem = ImprovedColorSystem;
    window.createImprovedColorSystem = () => new ImprovedColorSystem();
}
