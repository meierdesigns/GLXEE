"use strict";

/**
 * Performance Optimizer for Color System
 * Optimiert die Performance des Farbsystems
 */
class PerformanceOptimizer {
    constructor() {
        this.colorCache = new Map();
        this.batchUpdates = [];
        this.updateTimer = null;
        this.debounceDelay = 16; // ~60fps
        this.maxCacheSize = 100;
        this.init();
    }

    init() {
        this.setupOptimizations();
    }

    setupOptimizations() {
        // Optimize CSS variable updates
        this.optimizeCSSUpdates();
        
        // Setup color caching
        this.setupColorCaching();
        
        // Setup batch processing
        this.setupBatchProcessing();
    }

    optimizeCSSUpdates() {
        // Override the original applyPalette method for better performance
        if (typeof colorPaletteSystem !== 'undefined') {
            const originalApplyPalette = colorPaletteSystem.applyPalette.bind(colorPaletteSystem);
            
            colorPaletteSystem.applyPalette = (paletteId, options) => {
                if (!colorPaletteSystem.palettes[paletteId]) {
                    paletteId = 'grayscale';
                }

                const persist = !options || options.persist !== false;

                colorPaletteSystem.currentPalette = paletteId;
                if (persist && typeof colorPaletteSystem.saveCachedPalette === 'function') {
                    colorPaletteSystem.saveCachedPalette(paletteId);
                }

                // Always apply via original (sets --color-basecolor + re-expands).
                // Do not short-circuit with CSS cache — stale --color-basecolor breaks editor chrome.
                originalApplyPalette(paletteId, { persist: false });
                this.cachePaletteColors(paletteId);
            };
        }
    }

    setupColorCaching() {
        // Cache color calculations
        this.colorCache = new Map();
        
        // Pre-cache all palettes
        if (typeof colorPaletteSystem !== 'undefined') {
            Object.keys(colorPaletteSystem.palettes).forEach(paletteId => {
                this.preCachePalette(paletteId);
            });
        }
    }

    preCachePalette(paletteId) {
        const palette = colorPaletteSystem.palettes[paletteId];
        if (!palette) return;

        const baseColor = palette.baseColor || palette.primary;
        const cachedColors = {
            // Core Colors
            '--color-primary': palette.primary,
            '--color-secondary': palette.secondary,
            '--color-accent': palette.accent,
            '--color-basecolor': baseColor,
            '--color-second-basecolor': palette.secondBaseColor || '#FFFFFF',
            
            // Backgrounds
            '--color-background': palette.background,
            '--color-background-light': palette.backgroundLight,
            '--color-surface': palette.surface,
            
            // Borders
            '--color-border': palette.border,
            '--color-outline': palette.outline || palette.border,
            
            // Text
            '--color-text': palette.text,
            '--color-text-secondary': palette.textSecondary,
            '--color-text-muted': palette.textMuted || palette.textSecondary,
            '--color-text-disabled': palette.textDisabled || palette.textMuted,
            
            // Interactive States
            '--color-hover': palette.hover,
            '--color-active': palette.active,
            '--color-focus': palette.focus || palette.active,
            '--color-selected': palette.selected || palette.primary,
            '--color-disabled': palette.disabled || palette.textDisabled,
            
            // Game Elements
            '--color-player': palette.player || palette.text,
            '--color-enemy': palette.enemy || palette.textSecondary,
            '--color-bullet': palette.bullet || palette.primary,
            '--color-powerup': palette.powerup || palette.primary,
            '--color-obstacle': palette.obstacle || palette.border,
            
            // Status Colors
            '--color-success': palette.success || palette.primary,
            '--color-warning': palette.warning || palette.secondary,
            '--color-error': palette.error || palette.border,
            '--color-info': palette.info || palette.textSecondary,
            
            // Effects
            '--color-explosion': palette.explosion || palette.primary,
            '--color-particle': palette.particle || palette.secondary,
            '--color-glow': palette.glow || palette.border,
            '--color-shadow': palette.shadow || '#202020',
            '--color-highlight': palette.highlight || palette.textSecondary,
            
            // Overlay
            '--overlay-color': baseColor,

            // Legacy --current-* mirrors
            '--current-primary': palette.primary,
            '--current-secondary': palette.secondary,
            '--current-accent': palette.accent,
            '--current-background': palette.background,
            '--current-background-light': palette.backgroundLight,
            '--current-surface': palette.surface,
            '--current-border': palette.border,
            '--current-text': palette.text,
            '--current-text-secondary': palette.textSecondary,
            '--current-text-dim': palette.textMuted || palette.textSecondary,
            '--current-active': palette.active,
            '--current-hover': palette.hover
        };

        this.colorCache.set(paletteId, cachedColors);
    }

    applyCachedColors(cachedColors) {
        const root = document.documentElement;
        
        // Batch all CSS variable updates
        Object.entries(cachedColors).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
        
        // Update body background
        document.body.style.background = cachedColors['--color-background'];
        
    }

    cachePaletteColors(paletteId) {
        const palette = colorPaletteSystem.palettes[paletteId];
        if (!palette) return;

        // Create cached version
        this.preCachePalette(paletteId);
        
        // Cleanup cache if too large
        if (this.colorCache.size > this.maxCacheSize) {
            const firstKey = this.colorCache.keys().next().value;
            this.colorCache.delete(firstKey);
        }
    }

    setupBatchProcessing() {
        // Batch DOM updates for better performance
        this.batchUpdates = [];
        this.updateTimer = null;
    }

    batchUpdate(updateFunction) {
        this.batchUpdates.push(updateFunction);
        
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
            this.processBatchUpdates();
        }, this.debounceDelay);
    }

    processBatchUpdates() {
        // Process all batched updates
        this.batchUpdates.forEach(update => {
            try {
                update();
            } catch (error) {
                console.warn('Batch update error:', error);
            }
        });
        
        // Clear batch
        this.batchUpdates = [];
        this.updateTimer = null;
    }

    // Performance monitoring
    measurePerformance(operation, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        return result;
    }

    // Memory optimization
    optimizeMemory() {
        // Clear old cache entries
        if (this.colorCache.size > this.maxCacheSize) {
            const entries = Array.from(this.colorCache.entries());
            const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
            toRemove.forEach(([key]) => this.colorCache.delete(key));
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    // Get performance stats
    getStats() {
        return {
            cacheSize: this.colorCache.size,
            maxCacheSize: this.maxCacheSize,
            batchUpdates: this.batchUpdates.length,
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        };
    }

    // Cleanup
    destroy() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        this.colorCache.clear();
        this.batchUpdates = [];
    }
}

// Create global instance
let performanceOptimizer = new PerformanceOptimizer();
