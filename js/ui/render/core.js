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
        const k = this.getRenderScale();
        if (canvas.width !== w * k) canvas.width = w * k;
        if (canvas.height !== h * k) canvas.height = h * k;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = false;
    }

    /**
     * Backing-store supersampling of the playfield. Game logic stays in the
     * logical playfield units (e.g. 240×300); the canvas holds k× as many
     * pixels and every frame draws through a k× transform, so ships can be
     * voxelised finer than one logical pixel.
     */
    getRenderScale() {
        const k = Number(window.PLAYFIELD_RENDER_SCALE);
        return Number.isFinite(k) && k >= 1 ? Math.round(k) : 4;
    }

    /** Planet background strength in combat (window.PLAYFIELD_BG_OPACITY). */
    getCombatBackdropOpacity() {
        const v = Number(window.PLAYFIELD_BG_OPACITY);
        return Number.isFinite(v) && v >= 0 ? Math.min(1, v) : 0.4;
    }

    /** Voxel density for ships in combat, relative to the hangar default. */
    getCombatVoxelDetail() {
        const d = Number(window.PLAYFIELD_VOXEL_DETAIL);
        return Number.isFinite(d) && d > 0 ? d : 0.5;
    }

    render(ctx = null, width = null, height = null) {
        const canvas = ctx ? ctx.canvas : document.getElementById('gameCanvas');
        const isPlayfield = canvas && canvas.id === 'gameCanvas';
        if (!isPlayfield) return this.renderFrame(ctx, width, height);
        // Logical playfield size; the backing store is k× that.
        const k = this.getRenderScale();
        const lw = Math.round((typeof game !== 'undefined' && game && game.internalWidth) || canvas.width / k);
        const lh = Math.round((typeof game !== 'undefined' && game && game.internalHeight) || canvas.height / k);
        if (canvas.width !== lw * k || canvas.height !== lh * k) {
            canvas.width = lw * k;
            canvas.height = lh * k;
        }
        const c = ctx || canvas.getContext('2d');
        if (!c) return;
        c.setTransform(k, 0, 0, k, 0, 0);
        c.imageSmoothingEnabled = false;
        const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) || null;
        const prevScale = loader ? loader.deviceScale : null;
        const prevDetail = loader ? loader.voxelDetail : null;
        if (loader) {
            loader.deviceScale = k;
            loader.voxelDetail = this.getCombatVoxelDetail();
        }
        try {
            return this.renderFrame(c, width || lw, height || lh);
        } finally {
            if (loader) {
                loader.deviceScale = prevScale;
                loader.voxelDetail = prevDetail;
            }
        }
    }

    /**
     * The mission's planet looms at the bottom of the playfield — the fight
     * happens in its orbit. Uses the same pixel planet as the galaxy map,
     * baked once to an image per planet and drawn unsmoothed behind combat.
     */
    getOrbitPlanetImage(planetId) {
        const id = String(planetId || '').toLowerCase().split('-')[0];
        if (!id || typeof planetSVGManager === 'undefined') return null;
        this._orbitPlanetCache = this._orbitPlanetCache || {};
        const cached = this._orbitPlanetCache[id];
        if (cached) return cached.ready ? cached.img : null;
        if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
            planetSVGManager.init();
        }
        let svg = planetSVGManager.getPlanetSVGDetailed
            ? planetSVGManager.getPlanetSVGDetailed(id, 4)
            : planetSVGManager.getPlanetSVG(id);
        const entry = { img: new Image(), ready: false };
        this._orbitPlanetCache[id] = entry;
        if (!svg) return null;
        if (svg.indexOf('xmlns=') === -1) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg', '<svg width="256" height="256"');
        entry.img.onload = () => { entry.ready = true; };
        entry.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        return null;
    }

    drawOrbitPlanet(ctx, width, height) {
        const planetId = (typeof parallaxManager !== 'undefined' && parallaxManager.currentPlanet)
            || (typeof enemyManager !== 'undefined' && enemyManager.levelMods && enemyManager.levelMods.planetId);
        // Deep-space fights (pirate ambushes etc.) have no planet below them.
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.isEncounterPlanet
            && planetConfigManager.isEncounterPlanet(String(planetId || '').split('-')[0])) return;
        const img = this.getOrbitPlanetImage(planetId);
        if (!img) return;
        const w = width || 240;
        const h = height || 300;
        const d = Math.round(w * 1.3);
        // Random placement per visit + a slow drift in a random direction.
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        const lvl = typeof coreLevelManager !== 'undefined' && coreLevelManager.getCurrentLevel
            ? coreLevelManager.getCurrentLevel() : null;
        const placementKey = String(planetId) + '|' + (lvl ? (lvl.id || lvl.stageKey || lvl.stage || '') : '');
        if (!this._orbitPlacement || this._orbitPlacement.key !== placementKey) {
            const ang = Math.random() * Math.PI * 2;
            const drifts = Math.random() < 0.6;
            this._orbitPlacement = {
                key: placementKey,
                start: now,
                cx: 0.2 + Math.random() * 0.6,      // horizontal centre, fraction of width
                show: 0.12 + Math.random() * 0.18,  // visible part of the disc
                vx: drifts ? Math.cos(ang) * 0.6 : 0, // px per second
                vy: drifts ? Math.abs(Math.sin(ang)) * -0.15 : 0
            };
        }
        const pl = this._orbitPlacement;
        const t = now - pl.start;
        const maxShift = w * 0.12;
        const clamp = (v) => Math.max(-maxShift, Math.min(maxShift, v));
        const x = Math.round(w * pl.cx - d / 2 + clamp(pl.vx * t) + Math.sin(now / 40) * 4);
        const y = Math.round(h - d * pl.show + clamp(pl.vy * t)); // only the limb shows, below the player
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Kept faint: it is scenery, not something to read during a fight.
        ctx.globalAlpha = this.getCombatBackdropOpacity() * 0.45;
        ctx.drawImage(img, x, y, d, d);
        // Night-side veil toward the top so ships stay readable.
        const g = ctx.createLinearGradient(0, y, 0, y + d * 0.3);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = g;
        ctx.fillRect(x, y, d, d * 0.3);
        ctx.restore();
    }

    renderFrame(ctx = null, width = null, height = null) {
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
            // Planet backdrop sits well behind the action in combat so ships
            // and shots read clearly (editors/previews keep full strength).
            const prevBg = parallaxManager.globalLayerOpacity;
            parallaxManager.globalLayerOpacity = (prevBg != null ? prevBg : 1) * this.getCombatBackdropOpacity();
            try {
                parallaxManager.render(ctx);
            } finally {
                parallaxManager.globalLayerOpacity = prevBg;
            }
            this.drawOrbitPlanet(ctx, width, height);
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
