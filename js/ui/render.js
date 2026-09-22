"use strict";

// Rendering management
class RenderManager {
    constructor() {
        // Empty constructor
    }

    /** Canvas cannot use CSS variables — resolve to hex/rgb. */
    resolveCss(color, fallback) {
        const fb = fallback || '#ffffff';
        if (!color || typeof color !== 'string') return fb;
        if (color.indexOf('var(') === -1) {
            if (color.charAt(0) === '#' || color.indexOf('rgb') === 0) return color;
            return fb;
        }
        try {
            if (typeof graphicsManager !== 'undefined' && graphicsManager.colorPalette && graphicsManager.colorPalette.resolveCssColor) {
                const v = graphicsManager.colorPalette.resolveCssColor(color);
                if (v && v.indexOf('var(') === -1) return v;
            } else if (typeof colorPalette !== 'undefined' && colorPalette.resolveCssColor) {
                const v = colorPalette.resolveCssColor(color);
                if (v && v.indexOf('var(') === -1) return v;
            }
            const match = color.match(/var\(\s*(--[^),\s]+)/);
            if (match) {
                const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                if (value) return value;
            }
        } catch (e) { /* ignore */ }
        return fb;
    }

    themeColor(names, fallback) {
        const list = Array.isArray(names) ? names : [names];
        try {
            const root = getComputedStyle(document.documentElement);
            for (let i = 0; i < list.length; i++) {
                const v = root.getPropertyValue(list[i]).trim();
                if (v && v.indexOf('var(') === -1) return v;
            }
        } catch (e) { /* ignore */ }
        return fallback || '#ffffff';
    }

    setPlayfieldSize(width, height) {
        const w = Math.max(80, Math.round(Number(width) || 240));
        const h = Math.max(100, Math.round(Number(height) || 300));
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = false;
    }

    render(ctx = null, width = null, height = null) {
        // Get canvas context if not provided
        if (!ctx) {
            const canvas = document.getElementById('gameCanvas');
            if (!canvas) {
                console.warn('Game canvas not found');
                return;
            }
            ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn('Could not get 2D context');
                return;
            }
        }
        
        // Get dimensions if not provided
        if (!width) width = ctx.canvas.width;
        if (!height) height = ctx.canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Render parallax background first
        if (typeof parallaxManager !== 'undefined' && ctx) {
            parallaxManager.render(ctx);
        }
        
        const player = playerManager.getPosition();
        const fogList = (typeof obstacleManager !== 'undefined' && obstacleManager.getFogObstacles)
            ? obstacleManager.getFogObstacles()
            : ((obstacleManager.getObstacles && obstacleManager.getObstacles()) || []).filter((o) => o && o.isFog);

        // Fog / nebula first (always drawn)
        fogList.forEach((fog) => this.drawObstacleSprite(ctx, fog));

        // Enemies (hidden when fog blocks LoS to player)
        const enemy = enemyManager.getEnemy();
        if (enemy && !this.isOccludedByFog(player, enemy, fogList)) {
            if (enemyManager.isExploding()) {
                // Rings/particles come from explosionSystem.play in startExplosion
                if (typeof explosionSystem === 'undefined') {
                    this.drawExplosion(ctx, enemy.x, enemy.y, enemy.width, enemy.height);
                }
            } else {
                graphicsManager.renderEnemyShip(ctx, enemy, 1);
                if (enemyManager.shieldMax > 0 && enemyManager.shield > 0
                    && graphicsManager.drawShieldHull) {
                    const threat = this.getShieldThreatProximity(enemy, { mode: 'enemy' });
                    if (threat > 0.01) {
                        const strength = enemyManager.shield / enemyManager.shieldMax;
                        graphicsManager.drawShieldHull(
                            ctx,
                            enemy,
                            threat * (0.45 + 0.55 * strength),
                            true,
                            graphicsManager.currentEnemyModel
                        );
                    }
                }
            }
        }

        if (enemyManager.getSideEnemies) {
            enemyManager.getSideEnemies().forEach(side => {
                if (this.isOccludedByFog(player, side, fogList)) return;
                if (side.repairBeamActive && enemyManager.getEnemy && enemyManager.getEnemy()) {
                    const champ = enemyManager.getEnemy();
                    ctx.save();
                    ctx.strokeStyle = side.role === 'shieldBattery'
                        ? (getComputedStyle(document.documentElement).getPropertyValue('--current-secondary').trim() || '#6af')
                        : (getComputedStyle(document.documentElement).getPropertyValue('--current-accent').trim() || '#8f8');
                    ctx.globalAlpha = 0.55;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(side.x + side.width / 2, side.y + side.height / 2);
                    ctx.lineTo(champ.x + champ.width / 2, champ.y + champ.height / 2);
                    ctx.stroke();
                    ctx.restore();
                }
                ctx.save();
                ctx.globalAlpha = 0.9;
                if (graphicsManager.renderEnemyShip) {
                    graphicsManager.renderEnemyShip(ctx, side, 0.7);
                } else {
                    ctx.fillStyle = this.resolveCss('var(--current-accent)', '#ff8844');
                    ctx.fillRect(side.x, side.y, side.width, side.height);
                }
                ctx.restore();
            });
        }

        // Non-fog obstacles
        obstacleManager.getObstacles().forEach(obstacle => {
            if (obstacle.isFog) return;
            if (this.isOccludedByFog(player, obstacle, fogList)) return;
            this.drawObstacleSprite(ctx, obstacle);
        });

        if (typeof pickupManager !== 'undefined' && pickupManager.render) {
            pickupManager.render(ctx);
        }

        // Enemy bullets (occluded); player bullets always visible
        bulletManager.getEnemyBullets().forEach(bullet => {
            if (this.isOccludedByFog(player, bullet, fogList)) return;
            const lighting = this.calculateBulletLighting(bullet);
            this.drawBullet(ctx, bullet, lighting);
        });
        bulletManager.getBullets().forEach(bullet => {
            const lighting = this.calculateBulletLighting(bullet);
            this.drawBullet(ctx, bullet, lighting);
        });

        // Player + HUD on top (always visible)
        if (player) {
            graphicsManager.renderPlayerShip(ctx, player, 1);
            if (playerManager.shieldMax > 0 && playerManager.shield > 0
                && graphicsManager.drawShieldHull) {
                const threat = this.getShieldThreatProximity(player);
                const chargeVis = (typeof chargeSystem !== 'undefined')
                    ? chargeSystem.getShieldChargeVisual()
                    : { active: false, thick: 2, pulse: 1 };
                const forceShow = chargeVis.active;
                if (threat > 0.01 || forceShow) {
                    const strength = playerManager.shield / playerManager.shieldMax;
                    const base = forceShow
                        ? Math.max(threat, 0.35 + 0.55 * (chargeVis.level || 0))
                        : threat;
                    graphicsManager.drawShieldHull(
                        ctx,
                        player,
                        base * (0.45 + 0.55 * strength),
                        false,
                        playerManager.getCurrentShipModel(),
                        forceShow ? { thick: chargeVis.thick, pulse: chargeVis.pulse } : null
                    );
                }
            }
        }
        this.drawShotTypeIcon(ctx);

        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderParticles) {
            graphicsManager.renderParticles(ctx);
        }
        if (typeof explosionSystem !== 'undefined' && explosionSystem.render) {
            explosionSystem.render(ctx);
        }
    }

    drawObstacleSprite(ctx, obstacle) {
        if (!obstacle || typeof graphicsManager === 'undefined') return;
        const spriteName = obstacle.sprite
            || (obstacle.isFog ? 'fog'
                : (obstacle.kind === 'crystal' || obstacle.opticalMode === 'mirror'
                    || obstacle.opticalMode === 'prism' || obstacle.opticalMode === 'kaleidoscope')
                    ? 'crystal'
                    : (obstacle.reflectsShots ? 'shield' : 'obstacle'));
        const lightingIntensity = obstacle.lightIntensity || 0;
        const lightingColor = obstacle.lightColor || 'var(--current-text-secondary)';
        const sprite = graphicsManager.getSprite(spriteName)
            || graphicsManager.getSprite(obstacle.reflectsShots ? 'shield' : 'obstacle');
        const alpha = obstacle.opacity != null ? obstacle.opacity : 1;
        ctx.save();
        if (alpha < 1) ctx.globalAlpha = alpha;
        if (sprite && spriteName !== 'crystal') {
            graphicsManager.drawSprite(
                ctx, sprite,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height,
                lightingIntensity, lightingColor
            );
        } else if (spriteName === 'crystal' || obstacle.kind === 'crystal'
            || obstacle.opticalMode === 'mirror' || obstacle.opticalMode === 'prism'
            || obstacle.opticalMode === 'kaleidoscope') {
            this.drawCrystalObstacle(ctx, obstacle);
        } else if (sprite) {
            graphicsManager.drawSprite(
                ctx, sprite,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height,
                lightingIntensity, lightingColor
            );
        }
        ctx.restore();
    }

    drawCrystalObstacle(ctx, obstacle) {
        const x = obstacle.x;
        const y = obstacle.y;
        const w = obstacle.width;
        const h = obstacle.height;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const mode = obstacle.opticalMode || 'prism';
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
        const rot = (obstacle.rotation || 0) + (mode === 'kaleidoscope' ? t * 0.4 : t * 0.15);

        const c0 = this.themeColor(['--color-highlight', '--color-text'], '#e8ffff');
        const c1 = this.themeColor(['--color-accent', '--color-secondary'], '#88ddff');
        const c2 = this.themeColor(['--color-primary', '--color-particle'], '#aaffee');
        const c3 = this.themeColor(['--color-explosion', '--color-warning'], '#ffcc88');

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);

        const facets = mode === 'kaleidoscope' ? 6 : (mode === 'prism' ? 5 : 4);
        const rx = w * 0.48;
        const ry = h * 0.48;

        // Base crystal body
        ctx.beginPath();
        for (let i = 0; i < facets; i++) {
            const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const px = Math.cos(a) * rx;
            const py = Math.sin(a) * ry;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = c1;
        ctx.globalAlpha = 0.55;
        ctx.fill();

        // Facet wedges
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < facets; i++) {
            const a0 = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const a1 = (Math.PI * 2 * (i + 1)) / facets - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a0) * rx, Math.sin(a0) * ry);
            ctx.lineTo(Math.cos(a1) * rx, Math.sin(a1) * ry);
            ctx.closePath();
            const palette = [c0, c1, c2, c3];
            ctx.fillStyle = palette[i % palette.length];
            ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3 + i);
            ctx.fill();
        }

        // Mirror glint
        if (mode === 'mirror' || mode === 'kaleidoscope') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = c0;
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-rx * 0.6, -ry * 0.2);
            ctx.lineTo(rx * 0.5, ry * 0.15);
            ctx.stroke();
        }

        // Outer edge
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = c0;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < facets; i++) {
            const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const px = Math.cos(a) * rx;
            const py = Math.sin(a) * ry;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Core spark
        ctx.fillStyle = c0;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
    }

    /** True if fog sits on the line of sight from player to entity. */
    isOccludedByFog(player, entity, fogList) {
        if (!player || !entity || !fogList || !fogList.length) return false;
        const ax = player.x + (player.width || 0) / 2;
        const ay = player.y + (player.height || 0) / 2;
        const bx = entity.x + (entity.width || 0) / 2;
        const by = entity.y + (entity.height || 0) / 2;
        for (let i = 0; i < fogList.length; i++) {
            const fog = fogList[i];
            if (!fog || fog === entity) continue;
            if (!this.segmentIntersectsAabb(ax, ay, bx, by, fog)) continue;
            const fogCx = fog.x + fog.width / 2;
            const fogCy = fog.y + fog.height / 2;
            const dFog = (fogCx - ax) * (fogCx - ax) + (fogCy - ay) * (fogCy - ay);
            const dEnt = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
            if (dFog < dEnt - 4) return true;
        }
        return false;
    }

    segmentIntersectsAabb(x1, y1, x2, y2, box) {
        const minX = box.x;
        const minY = box.y;
        const maxX = box.x + box.width;
        const maxY = box.y + box.height;
        let t0 = 0;
        let t1 = 1;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const clips = [
            [-dx, x1 - minX],
            [dx, maxX - x1],
            [-dy, y1 - minY],
            [dy, maxY - y1]
        ];
        for (let i = 0; i < 4; i++) {
            const p = clips[i][0];
            const q = clips[i][1];
            if (p === 0) {
                if (q < 0) return false;
                continue;
            }
            const r = q / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
        return t0 <= t1;
    }

    // Calculate bullet lighting based on proximity to elements
    calculateBulletLighting(bullet) {
        let maxIntensity = 0;
        let lightingColor = 'var(--current-text)';
        
        // Check proximity to enemy
        const enemy = enemyManager.getEnemy();
        if (enemy) {
            const distance = this.calculateDistance(bullet, enemy);
            if (distance < 40) { // Within 40 pixels
                const intensity = Math.max(0, (40 - distance) / 40) * 0.8;
                if (intensity > maxIntensity) {
                    maxIntensity = intensity;
                    lightingColor = this.getCurrentColorProfile();
                }
            }
        }
        
        // Check proximity to obstacles
        obstacleManager.getObstacles().forEach(obstacle => {
            const distance = this.calculateDistance(bullet, obstacle);
            if (distance < 30) { // Within 30 pixels
                const intensity = Math.max(0, (30 - distance) / 30) * 0.6;
                if (intensity > maxIntensity) {
                    maxIntensity = intensity;
                    lightingColor = this.getCurrentColorProfile();
                }
            }
        });
        
        // Check proximity to player
        const player = playerManager.getPosition();
        if (player) {
            const distance = this.calculateDistance(bullet, player);
            if (distance < 35) { // Within 35 pixels
                const intensity = Math.max(0, (35 - distance) / 35) * 0.7;
                if (intensity > maxIntensity) {
                    maxIntensity = intensity;
                    lightingColor = this.getCurrentColorProfile();
                }
            }
        }
        
        return {
            intensity: maxIntensity,
            color: lightingColor
        };
    }
    
    // Calculate distance between two objects
    calculateDistance(obj1, obj2) {
        const dx = (obj1.x + obj1.width / 2) - (obj2.x + obj2.width / 2);
        const dy = (obj1.y + obj1.height / 2) - (obj2.y + obj2.height / 2);
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * How strongly the shield should show (0..1) based on nearby threats.
     * Soft ease-in: faint at range, full when close.
     * Default (player): enemy shots, reflected shots, obstacles.
     */
    getShieldThreatProximity(entity, options) {
        if (!entity) return 0;
        const opts = options || {};
        const radius = opts.radius != null ? opts.radius : 72;
        const mode = opts.mode || 'player';
        let best = 0;
        const consider = (obj) => {
            if (!obj) return;
            const d = this.calculateDistance(entity, obj);
            if (d >= radius) return;
            const t = 1 - (d / radius);
            // Smoothstep ease-in for a soft fade
            const fade = t * t * (3 - 2 * t);
            if (fade > best) best = fade;
        };

        if (typeof bulletManager !== 'undefined') {
            if (mode === 'player') {
                if (bulletManager.getEnemyBullets) {
                    bulletManager.getEnemyBullets().forEach(consider);
                }
                if (bulletManager.getBullets) {
                    bulletManager.getBullets().forEach((b) => {
                        if (b && b.reflected) consider(b);
                    });
                }
            } else if (mode === 'enemy') {
                if (bulletManager.getBullets) {
                    bulletManager.getBullets().forEach(consider);
                }
                if (bulletManager.getEnemyBullets) {
                    bulletManager.getEnemyBullets().forEach((b) => {
                        if (b && b.reflected) consider(b);
                    });
                }
            }
        }

        if (opts.obstacles !== false
            && typeof obstacleManager !== 'undefined'
            && obstacleManager.getObstacles) {
            obstacleManager.getObstacles().forEach((o) => {
                if (o && o.isFog) return;
                consider(o);
            });
        }
        return best;
    }
    
    // Get current color profile from color manager
    getCurrentColorProfile() {
        if (typeof colorManager !== 'undefined') {
            return colorManager.getCurrentOverlayColor();
        }
        return 'var(--current-text)'; // Default white
    }
    
    // Draw bullet with weapon color and proximity lighting
    drawBullet(ctx, bullet, lighting) {
        ctx.save();

        let bulletColor = this.resolveCss(this.getBulletColor(bullet), '#ffffff');

        if (lighting && lighting.intensity > 0 && lighting.color) {
            bulletColor = this.blendColors(
                bulletColor,
                this.resolveCss(lighting.color, bulletColor),
                lighting.intensity
            );
        }

        const x = Math.floor(bullet.x);
        const y = Math.floor(bullet.y);
        const w = Math.max(1, Math.ceil(bullet.width));
        const h = Math.max(1, Math.ceil(bullet.height));

        // Outer glow then bright core — keep glow thin so shots stay small
        const glow = this.themeColor(['--color-highlight', '--color-text', '--current-text'], '#ffffff');
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = glow;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = bulletColor;
        ctx.fillRect(x, y, w, h);
        if (w >= 2 && h >= 3) {
            ctx.fillStyle = glow;
            ctx.fillRect(x + Math.floor(w / 4), y + 1, Math.max(1, Math.ceil(w / 2)), Math.max(1, h - 2));
        }

        ctx.restore();
    }
    
    // Get bullet color based on type and current color scheme
    getBulletColor(bullet) {
        const isLaserType = bullet.type && (
            bullet.type.includes('laser') ||
            bullet.type.includes('beam') ||
            bullet.type.includes('spread') ||
            bullet.type.includes('rapid') ||
            bullet.type.includes('plasma') ||
            bullet.type.includes('missile') ||
            bullet.type.includes('ion') ||
            bullet.type.includes('wave') ||
            bullet.type.includes('burst') ||
            bullet.type.includes('pierce') ||
            bullet.type.includes('nova') ||
            bullet.type.includes('shot')
        );
        
        if (isLaserType) {
            return this.getLaserColor(bullet);
        }
        
        return this.resolveCss(bullet.color || 'var(--color-bullet)', this.themeColor(['--color-bullet', '--color-highlight'], '#ffffff'));
    }
    
    // Get laser color with applied color scheme
    getLaserColor(bullet) {
        const schemeColor = this.themeColor(
            ['--color-bullet', '--color-highlight', '--color-primary', '--color-basecolor'],
            '#ffffff'
        );
        
        let intensity = 0.95;
        if (bullet.type) {
            if (bullet.type.includes('plasma') || bullet.type.includes('nova')) {
                intensity = 1.0;
            } else if (bullet.type.includes('missile') || bullet.type.includes('pierce')) {
                intensity = 0.98;
            } else if (bullet.type.includes('rapid') || bullet.type.includes('burst')) {
                intensity = 0.9;
            } else if (bullet.type.includes('spread') || bullet.type.includes('wave') || bullet.type.includes('ion')) {
                intensity = 0.92;
            }
        }
        
        return this.applyColorSchemeToGrayscale(schemeColor, intensity);
    }
    
    // Apply color scheme to grayscale base — keep FX bright (old 128*intensity crushed bullets)
    applyColorSchemeToGrayscale(schemeColor, intensity = 0.95) {
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 255, g: 255, b: 255 };
        };
        
        const rgbToHex = (r, g, b) => {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };
        
        const schemeRgb = hexToRgb(this.resolveCss(schemeColor, '#ffffff'));
        const t = Math.max(0.55, Math.min(1, intensity));
        // High luminance floor so projectiles read against dark/tinted playfields
        const lum = Math.floor(200 + 55 * t);
        const finalR = Math.min(255, Math.floor(lum * schemeRgb.r / 255));
        const finalG = Math.min(255, Math.floor(lum * schemeRgb.g / 255));
        const finalB = Math.min(255, Math.floor(lum * schemeRgb.b / 255));
        
        return rgbToHex(finalR, finalG, finalB);
    }
    
    // Blend two colors with intensity
    blendColors(color1, color2, intensity) {
        if (!color1 || !color2 || typeof color1 !== 'string' || typeof color2 !== 'string') {
            return color1 || color2 || '#ffffff';
        }
        const a = this.resolveCss(color1, '#ffffff');
        const b = this.resolveCss(color2, '#ffffff');
        if (!a.startsWith('#') || !b.startsWith('#')) return a;
        
        const r1 = parseInt(a.substr(1, 2), 16) || 255;
        const g1 = parseInt(a.substr(3, 2), 16) || 255;
        const b1 = parseInt(a.substr(5, 2), 16) || 255;
        
        const r2 = parseInt(b.substr(1, 2), 16) || 255;
        const g2 = parseInt(b.substr(3, 2), 16) || 255;
        const b2 = parseInt(b.substr(5, 2), 16) || 255;
        
        const r = Math.round(r1 + (r2 - r1) * intensity);
        const g = Math.round(g1 + (g2 - g1) * intensity);
        const bl = Math.round(b1 + (b2 - b1) * intensity);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
    }

    drawHealthBar(ctx, x, y, width, health, maxHealth, color) {
        const barWidth = width;
        const barHeight = 4;
        const healthPercent = health / maxHealth;
        
        ctx.fillStyle = this.resolveCss('var(--current-background)', '#0a0a0a');
        ctx.fillRect(x, y, barWidth, barHeight);
        
        ctx.fillStyle = this.resolveCss(color || 'var(--color-highlight)', this.themeColor(['--color-highlight', '--color-primary'], '#ffaa44'));
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        ctx.strokeStyle = this.resolveCss('var(--current-border)', '#808080');
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }

    drawExplosion(ctx, x, y, width, height) {
        const explosionProgress = enemyManager.explosionTimer / enemyManager.explosionDuration;
        const explosionSize = (width + height) * (0.5 + explosionProgress * 2);
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        const pixelSize = 4;
        const explosionRadius = Math.floor(explosionSize / pixelSize);
        const c0 = this.themeColor(['--color-highlight', '--color-text', '--current-text'], '#ffffff');
        const c1 = this.themeColor(['--color-explosion', '--color-particle', '--color-primary'], '#ff8844');
        const c2 = this.themeColor(['--color-secondary', '--color-accent'], '#ffaa66');
        
        for (let ring = 0; ring < 3; ring++) {
            const ringRadius = Math.floor(explosionRadius * (0.3 + ring * 0.3));
            const alpha = 1 - explosionProgress - (ring * 0.2);
            
            if (alpha <= 0) continue;
            
            let color = c1;
            if (ring === 0) color = c0;
            else if (ring === 2) color = c2;
            
            ctx.globalAlpha = Math.max(0.35, Math.min(1, alpha));
            ctx.fillStyle = color;
            
            for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
                const pixelX = Math.floor(centerX + Math.cos(angle) * ringRadius * pixelSize);
                const pixelY = Math.floor(centerY + Math.sin(angle) * ringRadius * pixelSize);
                ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
        }
        
        ctx.globalAlpha = 1;
        for (let i = 0; i < 8; i++) {
            const sparkleX = Math.floor(centerX + (Math.random() - 0.5) * explosionSize);
            const sparkleY = Math.floor(centerY + (Math.random() - 0.5) * explosionSize);
            ctx.fillStyle = i % 2 ? c0 : c1;
            ctx.fillRect(sparkleX, sparkleY, pixelSize, pixelSize);
        }
        
        if (explosionProgress < 0.35) {
            ctx.fillStyle = c0;
            ctx.fillRect(centerX - pixelSize, centerY - pixelSize, pixelSize * 2, pixelSize * 2);
        }
    }

    drawShotTypeIcon(ctx) {
        const currentType = bulletManager.getCurrentShotType();
        let iconName = 'shotLaser';
        if (typeof bulletManager.getWeaponIconKey === 'function') {
            iconName = bulletManager.getWeaponIconKey(currentType);
        } else {
            const legacy = {
                normal: 'shotNormal',
                laser: 'shotLaser',
                spread: 'shotSpread',
                rapid: 'shotRapid',
                plasma: 'shotPlasma'
            };
            iconName = legacy[currentType] || 'shotLaser';
        }

        const sprite = graphicsManager.getSprite(iconName) || graphicsManager.getSprite('shotNormal');
        if (sprite) {
            const iconSize = 32;
            const x = 400 - iconSize - 10;
            const y = 10;
            graphicsManager.drawSprite(ctx, sprite, x, y, iconSize, iconSize);
        }
    }
}

// Global render manager instance
const renderManager = new RenderManager();
