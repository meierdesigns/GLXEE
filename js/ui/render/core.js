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
}
