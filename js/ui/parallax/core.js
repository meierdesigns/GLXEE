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
        if (this.starSpawnTimer == null) this.starSpawnTimer = 0;
        if (this.starSpawnInterval == null) this.starSpawnInterval = 120;
        if (!this.flyingStars || !this.flyingStars.length) this.seedFlyingStars();
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
        this.starSpawnTimer = 0;
        this.starSpawnInterval = 120;
        this.seedFlyingStars();
    }

    /** Theme CSS variable, cached ~250ms: getComputedStyle() on every frame forces a style recalc. */
    envVar(name) {
        const now = performance.now();
        const c = this._envCache || (this._envCache = {});
        const hit = c[name];
        if (hit && now - hit.t < 250) return hit.v;
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        c[name] = { v: v, t: now };
        return v;
    }

    getPlanetLayers(planet) {
        if (typeof planetConfigManager !== 'undefined') {
            return planetConfigManager.getResolvedLayers(planet);
        }

        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--env-primary').trim() || '#808080';
        const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--env-secondary').trim() || '#606060';
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--env-accent').trim() || '#808080';
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
        const frameScale = Math.min(3, Math.max(0, Number(deltaTime) || 16.67) / 16.67);
        // Never hard-reset scroll offsets: draws use modulo, and resets at
        // layer.height (often 300) or horizontalOffset=400 jumped while patterns
        // wrap at 600 / factor*offset (0.1/0.2).
        // Boss arenas hold still; regular stages scroll towards the player.
        const scrolling = typeof obstacleManager === 'undefined' || !obstacleManager.isScrollStage
            || obstacleManager.isScrollStage();
        if (scrolling) {
            // Transit backtrack runs the background in reverse (obstacleManager.levelScrollMul).
            const mul = typeof obstacleManager !== 'undefined' && obstacleManager.levelScrollMul
                ? obstacleManager.levelScrollMul() : 1;
            this.layers.forEach(layer => {
                // Kept >= 0: the pattern draws wrap with %, which breaks on negatives.
                layer.y = Math.max(0, layer.y + layer.speed * frameScale * mul);
            });
        }
        this.horizontalOffset += this.horizontalSpeed * frameScale;
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
        const backgroundColor = this.envVar('--env-background');
        ctx.fillStyle = backgroundColor || '#0a0a0a';
        // Logical playfield (transform already supersamples). Using backing width
        // here filled k² more user-space pixels that the clip immediately discarded.
        const cw = (typeof game !== 'undefined' && game && game.internalWidth) || 240;
        const ch = (typeof game !== 'undefined' && game && game.internalHeight) || 300;
        // Stars keep the prior spawn box (backing px as user units) so density on
        // screen matches the pre-bake look.
        const starW = (ctx.canvas && ctx.canvas.width) || cw;
        const starH = (ctx.canvas && ctx.canvas.height) || ch;
        this._starFieldW = starW;
        this._starFieldH = starH;
        ctx.fillRect(0, 0, cw, ch);

        // When the stage is frozen (boss / non-scroll), reuse a baked layer plate.
        const scrolling = typeof obstacleManager === 'undefined' || !obstacleManager.isScrollStage
            || obstacleManager.isScrollStage();
        let layerKey = backgroundColor + '|' + (this.globalLayerOpacity != null ? this.globalLayerOpacity : 1);
        for (let i = 0; i < this.layers.length; i++) {
            const L = this.layers[i];
            layerKey += '|' + (L.pattern || '') + ':' + (L.y || 0) + ':' + (L.color || '') + ':' + (L.visible === false ? 0 : 1);
        }
        layerKey += '|h' + (this.horizontalOffset || 0);

        const drawLayers = (target) => {
            for (let index = 0; index < this.layers.length; index++) {
                const layer = this.layers[index];
                if (layer.visible === false) continue;
                const opacity = (layer.opacity != null ? layer.opacity : 0.15) * (this.globalLayerOpacity != null ? this.globalLayerOpacity : 1);
                if (opacity <= 0) continue;
                target.save();
                target.globalAlpha = Math.max(0, Math.min(1, opacity));
                this.drawLayerPattern(target, layer, index);
                target.restore();
            }
        };

        if (!scrolling && this._frozenLayerKey === layerKey && this._frozenLayerCanvas) {
            ctx.drawImage(this._frozenLayerCanvas, 0, 0);
        } else {
            if (!scrolling) {
                if (!this._frozenLayerCanvas
                    || this._frozenLayerCanvas.width !== cw
                    || this._frozenLayerCanvas.height !== ch) {
                    this._frozenLayerCanvas = document.createElement('canvas');
                    this._frozenLayerCanvas.width = cw;
                    this._frozenLayerCanvas.height = ch;
                }
                const fx = this._frozenLayerCanvas.getContext('2d');
                if (fx) {
                    fx.setTransform(1, 0, 0, 1, 0, 0);
                    fx.imageSmoothingEnabled = false;
                    fx.clearRect(0, 0, cw, ch);
                    fx.fillStyle = backgroundColor || '#0a0a0a';
                    fx.fillRect(0, 0, cw, ch);
                    drawLayers(fx);
                    this._frozenLayerKey = layerKey;
                    ctx.drawImage(this._frozenLayerCanvas, 0, 0);
                } else {
                    drawLayers(ctx);
                }
            } else {
                this._frozenLayerKey = '';
                drawLayers(ctx);
            }
        }

        // Draw flying stars
        if (this.starsEnabled !== false) {
            this.drawFlyingStars(ctx);
        }

        this.renderBossIntensity(ctx, cw, ch);
    }

    /**
     * Boss arenas hold still (see update()), so they need their own visual
     * drama: a phase-tinted vignette + slow pulse layered over the frozen
     * background, ramping up as the boss loses health (phase 1→3).
     */
    renderBossIntensity(ctx, cw, ch) {
        const em = typeof enemyManager !== 'undefined' ? enemyManager : null;
        const e = em && em.enemy;
        if (!e || !e.isBoss || em.exploding) return;
        const phase = e.bossPhase || 1;
        const col = ['#5a1018', '#7a2a10', '#7a0a3a'][Math.max(0, phase - 1)];
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / (600 - phase * 120));
        const baseAlpha = 0.08 + phase * 0.06;
        const alpha = baseAlpha + pulse * 0.04;
        ctx.save();
        // Same radial falloff every frame for a given size/phase — rebuild only on change.
        if (!this._bossGrad || this._bossGradW !== cw || this._bossGradH !== ch || this._bossGradPhase !== phase) {
            const grad = ctx.createRadialGradient(
                cw / 2, ch * 0.4, Math.min(cw, ch) * 0.2,
                cw / 2, ch * 0.4, Math.max(cw, ch) * 0.75
            );
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, col);
            this._bossGrad = grad;
            this._bossGradW = cw;
            this._bossGradH = ch;
            this._bossGradPhase = phase;
        }
        ctx.globalAlpha = Math.max(0, Math.min(0.55, alpha));
        ctx.fillStyle = this._bossGrad;
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
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
                    this.drawGrid(ctx, layer, index);
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
