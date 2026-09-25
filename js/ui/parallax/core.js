"use strict";

// Parallax background system
class ParallaxManager {
    constructor() {
        this.layers = [];
        this.scrollSpeed = 0.5;
        this.currentPlanet = 'mars'; // Default planet
        this.starsEnabled = true;
        this.starsOpacity = 0.35;
        this.globalLayerOpacity = 1;
    }

    init() {
        this.createLayers();
    }

    setPlanet(planet) {
        this.currentPlanet = planet;
        if (typeof planetConfigManager !== 'undefined') {
            planetConfigManager.applyToRuntime(planet);
            return;
        }
        this.createLayers();
    }

    setBackground(background) {
        // Alias for setPlanet to maintain compatibility
        this.setPlanet(background);
    }

    applyPlanetConfig(cfg) {
        if (!cfg) return;
        this.currentPlanet = cfg.id || this.currentPlanet;
        this.starsEnabled = cfg.starsEnabled !== false;
        this.starsOpacity = cfg.starsOpacity != null ? cfg.starsOpacity : 0.35;
        const sourceLayers = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getResolvedLayers(this.currentPlanet)
            : (cfg.backgroundLayers || []);
        this.layers = sourceLayers.map(layer => ({
            y: 0,
            speed: layer.speed,
            color: layer.color,
            height: layer.height || 300,
            pattern: layer.pattern,
            opacity: layer.opacity != null ? layer.opacity : 0.15,
            scale: layer.scale != null ? layer.scale : 1,
            visible: layer.visible !== false,
            colorSource: layer.colorSource || 'primary'
        }));
        if (this.horizontalOffset == null) this.horizontalOffset = 0;
        if (this.horizontalSpeed == null) this.horizontalSpeed = 0.05;
        if (!this.flyingStars) this.flyingStars = [];
        if (this.starSpawnTimer == null) this.starSpawnTimer = 0;
        if (this.starSpawnInterval == null) this.starSpawnInterval = 2000;
    }

    setLayerOpacity(index, opacity) {
        if (this.layers[index]) {
            this.layers[index].opacity = Math.max(0, Math.min(1, Number(opacity)));
        }
    }

    setLayerVisible(index, visible) {
        if (this.layers[index]) {
            this.layers[index].visible = !!visible;
        }
    }

    setGlobalLayerOpacity(opacity) {
        this.globalLayerOpacity = Math.max(0, Math.min(1, Number(opacity)));
    }

    createLayers() {
        if (typeof planetConfigManager !== 'undefined') {
            this.applyPlanetConfig(planetConfigManager.getConfig(this.currentPlanet));
            return;
        }

        this.layers = this.getPlanetLayers(this.currentPlanet);
        this.horizontalOffset = 0;
        this.horizontalSpeed = 0.05;
        this.flyingStars = [];
        this.starSpawnTimer = 0;
        this.starSpawnInterval = 2000;
    }

    getPlanetLayers(planet) {
        if (typeof planetConfigManager !== 'undefined') {
            return planetConfigManager.getResolvedLayers(planet);
        }

        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--current-primary').trim() || '#808080';
        const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--current-secondary').trim() || '#606060';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--current-accent').trim() || '#808080';
        const soft = (color, opacity) => ({ y: 0, speed: 0.2, color, height: 300, opacity, visible: true });

        switch (planet) {
            case 'mars':
                return [
                    Object.assign(soft(primaryColor, 0.18), { speed: 0.2, pattern: 'mars_surface' }),
                    Object.assign(soft(secondaryColor, 0.12), { speed: 0.4, pattern: 'mars_dust' }),
                    Object.assign(soft(accentColor, 0.08), { speed: 0.6, pattern: 'mars_sky' })
                ];
            case 'jupiter':
                return [
                    Object.assign(soft(primaryColor, 0.16), { speed: 0.2, pattern: 'jupiter_bands' }),
                    Object.assign(soft(secondaryColor, 0.12), { speed: 0.4, pattern: 'jupiter_storms' }),
                    Object.assign(soft(accentColor, 0.08), { speed: 0.6, pattern: 'jupiter_atmosphere' })
                ];
            case 'saturn':
                return [
                    Object.assign(soft(secondaryColor, 0.16), { speed: 0.2, pattern: 'saturn_rings' }),
                    Object.assign(soft(primaryColor, 0.12), { speed: 0.4, pattern: 'saturn_clouds' }),
                    Object.assign(soft(accentColor, 0.08), { speed: 0.6, pattern: 'saturn_sky' })
                ];
            case 'neptune':
                return [
                    Object.assign(soft(primaryColor, 0.15), { speed: 0.2, pattern: 'neptune_deep' }),
                    Object.assign(soft(secondaryColor, 0.11), { speed: 0.4, pattern: 'neptune_storms' }),
                    Object.assign(soft(accentColor, 0.08), { speed: 0.6, pattern: 'neptune_ice' })
                ];
            default:
                return [
                    Object.assign(soft(primaryColor, 0.12), { speed: 0.2, pattern: 'grid' }),
                    Object.assign(soft(secondaryColor, 0.1), { speed: 0.4, pattern: 'dots' }),
                    Object.assign(soft(accentColor, 0.07), { speed: 0.6, pattern: 'lines' })
                ];
        }
    }

    update(deltaTime) {
        // Never hard-reset scroll offsets: draws use modulo, and resets at
        // layer.height (often 300) or horizontalOffset=400 jumped while patterns
        // wrap at 600 / factor*offset (0.1/0.2).
        this.layers.forEach(layer => {
            layer.y += layer.speed;
        });
        this.horizontalOffset += this.horizontalSpeed;
        this.updateFlyingStars(deltaTime);
    }

    render(ctx) {
        // Check if ctx is valid
        if (!ctx) {
            console.warn('ParallaxManager.render: ctx is undefined');
            return;
        }
        
        
        // Set pixelated rendering first
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // Fill base background with theme color
        const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim();
        ctx.fillStyle = backgroundColor || '#0a0a0a';
        const cw = (ctx.canvas && ctx.canvas.width) || 240;
        const ch = (ctx.canvas && ctx.canvas.height) || 300;
        ctx.fillRect(0, 0, cw, ch);
        
        // Render parallax background layers (respect visibility + opacity)
        this.layers.forEach((layer, index) => {
            if (layer.visible === false) return;
            const opacity = (layer.opacity != null ? layer.opacity : 0.15) * (this.globalLayerOpacity != null ? this.globalLayerOpacity : 1);
            if (opacity <= 0) return;
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
            this.drawLayerPattern(ctx, layer, index);
            ctx.restore();
        });

        // Draw flying stars
        if (this.starsEnabled !== false) {
            this.drawFlyingStars(ctx);
        }
    }

    drawLayerPattern(ctx, layer, index) {
        // Refresh theme color if layer uses a color source
        if (typeof planetConfigManager !== 'undefined' && layer.colorSource && layer.colorSource !== 'custom') {
            layer.color = planetConfigManager.resolveLayerColor(layer);
        }
        const layerColor = layer.color || '#808080';
        ctx.fillStyle = layerColor;

        const scale = (layer.scale != null && Number(layer.scale) > 0) ? Number(layer.scale) : 1;
        const drawContent = () => {
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.hasCustomPattern(layer.pattern)) {
                this.drawCustomTile(ctx, layer, planetConfigManager.getCustomPattern(layer.pattern));
                return;
            }
            switch (layer.pattern) {
                case 'grid':
                    this.drawGrid(ctx, layer);
                    break;
                case 'dots':
                    this.drawDots(ctx, layer);
                    break;
                case 'lines':
                    this.drawLines(ctx, layer);
                    break;
                case 'mars_surface':
                    this.drawMarsSurface(ctx, layer);
                    break;
                case 'mars_dust':
                    this.drawMarsDust(ctx, layer);
                    break;
                case 'mars_sky':
                    this.drawMarsSky(ctx, layer);
                    break;
                case 'jupiter_bands':
                    this.drawJupiterBands(ctx, layer);
                    break;
                case 'jupiter_storms':
                    this.drawJupiterStorms(ctx, layer);
                    break;
                case 'jupiter_atmosphere':
                    this.drawJupiterAtmosphere(ctx, layer);
                    break;
                case 'saturn_rings':
                    this.drawSaturnRings(ctx, layer);
                    break;
                case 'saturn_clouds':
                    this.drawSaturnClouds(ctx, layer);
                    break;
                case 'saturn_sky':
                    this.drawSaturnSky(ctx, layer);
                    break;
                case 'neptune_deep':
                    this.drawNeptuneDeep(ctx, layer);
                    break;
                case 'neptune_storms':
                    this.drawNeptuneStorms(ctx, layer);
                    break;
                case 'neptune_ice':
                    this.drawNeptuneIce(ctx, layer);
                    break;
            }
        };

        if (scale === 1) {
            drawContent();
            return;
        }

        const w = 400;
        const h = 600;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);

        const extent = scale < 1 ? Math.ceil(1 / scale) : 0;
        for (let oy = -extent; oy <= extent; oy++) {
            for (let ox = -extent; ox <= extent; ox++) {
                if (ox === 0 && oy === 0) {
                    drawContent();
                } else {
                    ctx.save();
                    ctx.translate(ox * w, oy * h);
                    drawContent();
                    ctx.restore();
                }
            }
        }
        ctx.restore();
    }
}
