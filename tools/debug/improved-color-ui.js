"use strict";

// Improved Color UI System
class ImprovedColorUI {
    constructor() {
        this.colorSystem = null;
        this.uiElements = {};
        this.init();
    }

    init() {
        console.log('🎨 === IMPROVED COLOR UI ===');
        this.waitForColorSystem();
    }

    waitForColorSystem() {
        if (typeof window.improvedColorSystem !== 'undefined') {
            this.colorSystem = window.improvedColorSystem;
            this.createImprovedUI();
        } else {
            setTimeout(() => this.waitForColorSystem(), 100);
        }
    }

    createImprovedUI() {
        console.log('\n🎨 Creating Improved Color UI...');
        
        this.createPaletteSelector();
        this.createHSLSliders();
        this.createColorPreview();
        this.createColorHistory();
        this.createFavorites();
        
        console.log('✅ Improved color UI created');
    }

    createPaletteSelector() {
        console.log('\n🎨 Creating Palette Selector...');
        
        const selector = document.createElement('div');
        selector.className = 'improved-color-selector';
        selector.innerHTML = `
            <div class="color-section">
                <h3>Color Themes</h3>
                <div class="palette-grid">
                    ${Object.entries(this.colorSystem.palettes).map(([id, palette]) => `
                        <div class="palette-card ${id === this.colorSystem.currentPalette ? 'active' : ''}" data-palette="${id}">
                            <div class="palette-preview">
                                <div class="color-swatch primary" style="background: ${palette.colors.primary}"></div>
                                <div class="color-swatch secondary" style="background: ${palette.colors.secondary}"></div>
                                <div class="color-swatch accent" style="background: ${palette.colors.accent}"></div>
                                <div class="color-swatch background" style="background: ${palette.colors.background}"></div>
                            </div>
                            <div class="palette-info">
                                <div class="palette-name">${palette.name}</div>
                                <div class="palette-description">${palette.description}</div>
                            </div>
                            <div class="palette-actions">
                                <button class="btn-favorite" data-palette="${id}" title="Add to favorites">⭐</button>
                                <button class="btn-apply" data-palette="${id}" title="Apply theme">Apply</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add event listeners
        selector.querySelectorAll('.palette-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-favorite') || e.target.classList.contains('btn-apply')) {
                    return; // Let button handlers deal with this
                }
                
                const paletteId = card.dataset.palette;
                this.applyPalette(paletteId);
            });
        });
        
        selector.querySelectorAll('.btn-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const paletteId = btn.dataset.palette;
                this.applyPalette(paletteId);
            });
        });
        
        selector.querySelectorAll('.btn-favorite').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const paletteId = btn.dataset.palette;
                this.toggleFavorite(paletteId);
            });
        });
        
        this.uiElements.paletteSelector = selector;
    }

    createHSLSliders() {
        console.log('\n🎨 Creating HSL Sliders...');
        
        const sliders = document.createElement('div');
        sliders.className = 'hsl-sliders';
        sliders.innerHTML = `
            <div class="color-section">
                <h3>Fine Tuning</h3>
                <div class="slider-group">
                    <div class="slider-item">
                        <label>Hue: <span class="value">0</span>°</label>
                        <input type="range" class="hue-slider" min="0" max="360" value="0">
                    </div>
                    <div class="slider-item">
                        <label>Saturation: <span class="value">0</span>%</label>
                        <input type="range" class="saturation-slider" min="0" max="100" value="0">
                    </div>
                    <div class="slider-item">
                        <label>Lightness: <span class="value">50</span>%</label>
                        <input type="range" class="lightness-slider" min="0" max="100" value="50">
                    </div>
                </div>
                <div class="slider-actions">
                    <button class="btn-reset">Reset to Theme</button>
                    <button class="btn-save">Save Custom</button>
                </div>
            </div>
        `;
        
        // Add slider event listeners
        const hueSlider = sliders.querySelector('.hue-slider');
        const saturationSlider = sliders.querySelector('.saturation-slider');
        const lightnessSlider = sliders.querySelector('.lightness-slider');
        
        const updateHSL = () => {
            const hue = parseInt(hueSlider.value);
            const saturation = parseInt(saturationSlider.value);
            const lightness = parseInt(lightnessSlider.value);
            
            // Update value displays
            sliders.querySelector('.hue-slider').parentElement.querySelector('.value').textContent = hue;
            sliders.querySelector('.saturation-slider').parentElement.querySelector('.value').textContent = saturation;
            sliders.querySelector('.lightness-slider').parentElement.querySelector('.value').textContent = lightness;
            
            // Apply HSL changes
            if (typeof colorManager !== 'undefined') {
                colorManager.setHSL(hue, saturation, lightness);
            }
        };
        
        hueSlider.addEventListener('input', updateHSL);
        saturationSlider.addEventListener('input', updateHSL);
        lightnessSlider.addEventListener('input', updateHSL);
        
        // Reset button
        sliders.querySelector('.btn-reset').addEventListener('click', () => {
            const currentPalette = this.colorSystem.getCurrentPalette();
            hueSlider.value = currentPalette.hsl.hue;
            saturationSlider.value = currentPalette.hsl.saturation;
            lightnessSlider.value = currentPalette.hsl.lightness;
            updateHSL();
        });
        
        // Save button
        sliders.querySelector('.btn-save').addEventListener('click', () => {
            const hue = parseInt(hueSlider.value);
            const saturation = parseInt(saturationSlider.value);
            const lightness = parseInt(lightnessSlider.value);
            
            // Create custom palette
            const customPalette = {
                name: 'Custom',
                description: 'User customized theme',
                colors: this.colorSystem.getCurrentPalette().colors,
                hsl: { hue, saturation, lightness }
            };
            
            // Add to palettes
            this.colorSystem.palettes.custom = customPalette;
            this.colorSystem.currentPalette = 'custom';
            
            console.log('✅ Custom palette saved');
        });
        
        this.uiElements.hslSliders = sliders;
    }

    createColorPreview() {
        console.log('\n🎨 Creating Color Preview...');
        
        const preview = document.createElement('div');
        preview.className = 'color-preview';
        preview.innerHTML = `
            <div class="color-section">
                <h3>Preview</h3>
                <div class="preview-container">
                    <div class="preview-element primary" style="background: var(--current-primary)">
                        <span>Primary</span>
                    </div>
                    <div class="preview-element secondary" style="background: var(--current-secondary)">
                        <span>Secondary</span>
                    </div>
                    <div class="preview-element accent" style="background: var(--current-accent)">
                        <span>Accent</span>
                    </div>
                    <div class="preview-element background" style="background: var(--current-background)">
                        <span>Background</span>
                    </div>
                    <div class="preview-element surface" style="background: var(--current-surface)">
                        <span>Surface</span>
                    </div>
                    <div class="preview-element border" style="border: 2px solid var(--current-border)">
                        <span>Border</span>
                    </div>
                </div>
            </div>
        `;
        
        this.uiElements.colorPreview = preview;
    }

    createColorHistory() {
        console.log('\n🎨 Creating Color History...');
        
        const history = document.createElement('div');
        history.className = 'color-history';
        history.innerHTML = `
            <div class="color-section">
                <h3>Recent Colors</h3>
                <div class="history-list">
                    <div class="history-item">No recent colors</div>
                </div>
            </div>
        `;
        
        this.uiElements.colorHistory = history;
    }

    createFavorites() {
        console.log('\n🎨 Creating Favorites...');
        
        const favorites = document.createElement('div');
        favorites.className = 'color-favorites';
        favorites.innerHTML = `
            <div class="color-section">
                <h3>Favorites</h3>
                <div class="favorites-list">
                    <div class="favorite-item">No favorites yet</div>
                </div>
            </div>
        `;
        
        this.uiElements.favorites = favorites;
    }

    applyPalette(paletteId) {
        console.log(`\n🎨 Applying palette: ${paletteId}`);
        
        this.colorSystem.applyPalette(paletteId);
        
        // Update UI
        this.updatePaletteSelector(paletteId);
        this.updateHSLSliders();
        this.updateColorPreview();
    }

    updatePaletteSelector(activePaletteId) {
        const selector = this.uiElements.paletteSelector;
        selector.querySelectorAll('.palette-card').forEach(card => {
            card.classList.toggle('active', card.dataset.palette === activePaletteId);
        });
    }

    updateHSLSliders() {
        const currentPalette = this.colorSystem.getCurrentPalette();
        const sliders = this.uiElements.hslSliders;
        
        sliders.querySelector('.hue-slider').value = currentPalette.hsl.hue;
        sliders.querySelector('.saturation-slider').value = currentPalette.hsl.saturation;
        sliders.querySelector('.lightness-slider').value = currentPalette.hsl.lightness;
        
        // Update value displays
        sliders.querySelector('.hue-slider').parentElement.querySelector('.value').textContent = currentPalette.hsl.hue;
        sliders.querySelector('.saturation-slider').parentElement.querySelector('.value').textContent = currentPalette.hsl.saturation;
        sliders.querySelector('.lightness-slider').parentElement.querySelector('.value').textContent = currentPalette.hsl.lightness;
    }

    updateColorPreview() {
        // Color preview updates automatically via CSS variables
        console.log('✅ Color preview updated');
    }

    toggleFavorite(paletteId) {
        const favorites = this.colorSystem.getFavorites();
        const isFavorite = favorites.includes(paletteId);
        
        if (isFavorite) {
            this.colorSystem.removeFromFavorites(paletteId);
        } else {
            this.colorSystem.addToFavorites(paletteId);
        }
        
        // Update UI
        this.updateFavorites();
    }

    updateFavorites() {
        const favorites = this.colorSystem.getFavorites();
        const favoritesList = this.uiElements.favorites.querySelector('.favorites-list');
        
        if (favorites.length === 0) {
            favoritesList.innerHTML = '<div class="favorite-item">No favorites yet</div>';
        } else {
            favoritesList.innerHTML = favorites.map(paletteId => {
                const palette = this.colorSystem.palettes[paletteId];
                return `
                    <div class="favorite-item" data-palette="${paletteId}">
                        <div class="favorite-preview">
                            <div class="color-swatch" style="background: ${palette.colors.primary}"></div>
                        </div>
                        <div class="favorite-name">${palette.name}</div>
                        <button class="btn-remove" data-palette="${paletteId}">×</button>
                    </div>
                `;
            }).join('');
            
            // Add event listeners
            favoritesList.querySelectorAll('.favorite-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('btn-remove')) {
                        return; // Let button handler deal with this
                    }
                    
                    const paletteId = item.dataset.palette;
                    this.applyPalette(paletteId);
                });
            });
            
            favoritesList.querySelectorAll('.btn-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const paletteId = btn.dataset.palette;
                    this.toggleFavorite(paletteId);
                });
            });
        }
    }

    getUI() {
        const container = document.createElement('div');
        container.className = 'improved-color-ui';
        container.appendChild(this.uiElements.paletteSelector);
        container.appendChild(this.uiElements.hslSliders);
        container.appendChild(this.uiElements.colorPreview);
        container.appendChild(this.uiElements.colorHistory);
        container.appendChild(this.uiElements.favorites);
        
        return container;
    }
}

// Auto-run improved color UI
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.improvedColorUI = new ImprovedColorUI();
        }, 1500);
    });
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ImprovedColorUI = ImprovedColorUI;
    window.createImprovedColorUI = () => new ImprovedColorUI();
}
