"use strict";

// Art pixels per logical playfield pixel for baked obstacles.
const OBSTACLE_ART_DENSITY = 0.4; // 2.5 px cells: coarse, shared with the terrain

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
                const value = vfCssVar(match[1]);
                if (value) return value;
            }
        } catch (e) { /* ignore */ }
        return fb;
    }
    themeColor(names, fallback) {
        const list = Array.isArray(names) ? names : [names];
        try {
            for (let i = 0; i < list.length; i++) {
                const v = vfCssVar(list[i]);
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
        const bw = Math.max(1, Math.round(w * k)), bh = Math.max(1, Math.round(h * k));
        if (canvas.width !== bw) canvas.width = bw;
        if (canvas.height !== bh) canvas.height = bh;
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
        // Sticky for the whole combat frame — avoid getBoundingClientRect / voxel probes
        // on every fillCombatRect / particle call.
        const frame = (typeof game !== 'undefined' && game && game.gameState)
            ? game.gameState.frameCount
            : ((typeof performance !== 'undefined') ? (performance.now() | 0) : Date.now());
        if (this._scaleStickyFrame === frame && this._scaleFrameValue != null) {
            return this._scaleFrameValue;
        }
        // Global Pixel Size: one buffer pixel == P screen px, so every art pixel is equal.
        const gp = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx)
            ? uiAppearanceManager.getGlobalPixelPx() : 0;
        let scale;
        const lw = (typeof game !== 'undefined' && game && game.internalWidth) || 240;
        const lh = (typeof game !== 'undefined' && game && game.internalHeight) || 300;
        const budget = Number(window.PLAYFIELD_MAX_BACKING_PX);
        // ~240×300 @2× ≈ 288k; tighter default so CSS upscales instead of GPU fill.
        let maxPx = Number.isFinite(budget) && budget > 50000 ? budget : 200000;
        if (gp > 0) {
            // gp 1/2 push the densest backing (shown/(gp·lw)). Keep fill cheap via CSS
            // nearest-neighbor upscale — wall-clock stutter was paint/composite, not JS.
            if (gp <= 1) maxPx = Math.min(maxPx, 100000);
            else if (gp <= 2) maxPx = Math.min(maxPx, 140000);
            const cv = document.getElementById('gameCanvas');
            // Ancestors (body stage scale, GUI zoom) are CSS transforms: clientWidth ignores them,
            // so measure the on-screen width to make one art pixel == gp real screen px.
            let shown = cv && cv.clientWidth ? cv.clientWidth : lw;
            if (cv && cv.clientWidth) {
                // Reuse last measured width within ~250ms — layout thrash from bezel/FX
                // must not force a rect read on every new frameCount tick.
                const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
                if (this._shownWSticky != null && this._shownWAt && (now - this._shownWAt) < 250) {
                    shown = this._shownWSticky;
                } else {
                    const bw = cv.getBoundingClientRect().width;
                    if (bw > 1) shown = bw;
                    this._shownWSticky = shown;
                    this._shownWAt = now;
                }
            }
            // Keep fractional — rounding would make combat pixels ≠ Pixel Size.
            scale = Math.max(0.05, shown / (gp * lw));
            if ((lw * scale) * (lh * scale) > maxPx) {
                scale = Math.sqrt(maxPx / Math.max(1, lw * lh));
            }
        } else {
            const k = Number(window.PLAYFIELD_RENDER_SCALE);
            // Default 2× (was 4×): same voxel look via CSS upscale, far less GPU fill.
            scale = Number.isFinite(k) && k >= 1 ? Math.round(k) : 2;
            // VOXEL: larger cells already look blocky — less supersampling is enough
            // and cuts fill/transform cost hard (2× → 1× backing store).
            if (this.isVoxelCombat && this.isVoxelCombat()) {
                const cell = this.getCombatVoxelCell();
                if (cell >= 4) scale = Math.min(scale, 1);
                else if (cell >= 2) scale = Math.min(scale, 2);
            }
            // Pixel budget: runtime evidence showed ~1312×1200 (@4×) with only ~10ms of JS
            // work but ~15 FPS wall-clock — paint/composite of ~1.5MP dominated. Cap the
            // backing store so CSS can upscale crisp pixels instead.
            if (scale >= 1) {
                let s = Math.max(1, Math.round(scale));
                while (s > 1 && (lw * s) * (lh * s) > maxPx) s--;
                scale = s;
            } else if ((lw * Math.max(scale, 0.05)) * (lh * Math.max(scale, 0.05)) > maxPx) {
                scale = Math.sqrt(maxPx / Math.max(1, lw * lh));
            }
        }
        this._scaleStickyFrame = frame;
        this._scaleFrameValue = scale;
        return scale;
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
    /**
     * Shared logical voxel cell (px) for the whole playfield when Ship Render
     * is VOXEL — ships, modules, terrain, obstacles and debris all use this.
     * Returns null in FLAT mode so per-object sizing stays as before.
     */
    getCombatVoxelCell() {
        // Sticky for the whole frame — called once per bullet/particle/debris cell fill.
        const frame = (typeof game !== 'undefined' && game && game.gameState)
            ? game.gameState.frameCount
            : ((typeof performance !== 'undefined') ? (performance.now() | 0) : Date.now());
        if (this._voxelCellStickyFrame === frame && this._voxelCellFrameValue !== undefined) {
            return this._voxelCellFrameValue;
        }
        let result;
        if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx
            && uiAppearanceManager.getGlobalPixelPx() > 0) {
            result = 1 / this.getRenderScale();
        } else {
            const style = (typeof uiAppearanceManager !== 'undefined'
                && uiAppearanceManager.shipRenderStyle)
                ? String(uiAppearanceManager.shipRenderStyle).toUpperCase()
                : 'FLAT';
            if (style !== 'VOXEL') {
                result = null;
            } else if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getVoxelSize
                && Number.isFinite(Number(uiAppearanceManager.getVoxelSize()))
                && Number(uiAppearanceManager.getVoxelSize()) > 0) {
                // Prefer the settings value so every draw path shares one lattice.
                result = Number(uiAppearanceManager.getVoxelSize());
            } else {
                const c = Number(window.PLAYFIELD_VOXEL_CELL);
                result = Number.isFinite(c) && c > 0 ? c : 1;
            }
        }
        this._voxelCellStickyFrame = frame;
        this._voxelCellFrameValue = result;
        return result;
    }
    isVoxelCombat() {
        return this.getCombatVoxelCell() != null;
    }
    /** Snap a coordinate onto the shared combat voxel lattice. */
    snapCombat(v, cell) {
        const c = cell != null ? cell : this.getCombatVoxelCell();
        if (c == null || !(c > 0)) return Math.round(v);
        return Math.round(v / c) * c;
    }
    /** Quantize a size to whole lattice steps (min one cell). */
    quantizeCombatSize(s, cell) {
        const c = cell != null ? cell : this.getCombatVoxelCell();
        if (c == null || !(c > 0)) return Math.max(1, Math.round(s));
        return Math.max(c, Math.round(s / c) * c);
    }
    /**
     * Hard fill on the shared combat lattice (VOXEL) or rounded fillRect (FLAT).
     * Used by bullets, particles, explosions, pickups, debris — every playfield FX.
     */
    fillCombatRect(ctx, x, y, w, h, color, alpha) {
        if (!ctx) return;
        const cell = this.getCombatVoxelCell();
        if (alpha != null) ctx.globalAlpha = alpha;
        if (color != null) ctx.fillStyle = color;
        if (cell == null || !(cell > 0)) {
            ctx.fillRect(
                Math.round(x), Math.round(y),
                Math.max(1, Math.round(w)), Math.max(1, Math.round(h))
            );
            return;
        }
        const sx = Math.round(x / cell) * cell;
        const sy = Math.round(y / cell) * cell;
        const sw = Math.max(cell, Math.round(w / cell) * cell);
        const sh = Math.max(cell, Math.round(h / cell) * cell);
        ctx.fillRect(sx, sy, sw, sh);
    }
    render(ctx = null, width = null, height = null) {
        const canvas = ctx ? ctx.canvas : document.getElementById('gameCanvas');
        const isPlayfield = canvas && canvas.id === 'gameCanvas';
        if (!isPlayfield) return this.renderFrame(ctx, width, height);
        // Logical playfield size; the backing store is k× that.
        const k = this.getRenderScale();
        const lw = Math.round((typeof game !== 'undefined' && game && game.internalWidth) || canvas.width / k);
        const lh = Math.round((typeof game !== 'undefined' && game && game.internalHeight) || canvas.height / k);
        const bw = Math.max(1, Math.round(lw * k)), bh = Math.max(1, Math.round(lh * k));
        if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width = bw;
            canvas.height = bh;
            // Firefox: backing-store resize under transform:scale can leave a
            // stretched stale layer — toggle a compositor hint without sync layout.
            if (document.documentElement.getAttribute('data-vf-engine') === 'gecko') {
                canvas.classList.add('vf-gecko-resize');
                requestAnimationFrame(() => { canvas.classList.remove('vf-gecko-resize'); });
            }
        }
        const c = ctx || canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
        if (!c) return;
        c.setTransform(k, 0, 0, k, 0, 0);
        c.imageSmoothingEnabled = false;
        if (c.mozImageSmoothingEnabled !== undefined) c.mozImageSmoothingEnabled = false;
        if (c.webkitImageSmoothingEnabled !== undefined) c.webkitImageSmoothingEnabled = false;
        if (c.msImageSmoothingEnabled !== undefined) c.msImageSmoothingEnabled = false;
        // Theme contrast/sat/bri used to live as a CSS filter on #gameCanvas; on
        // Gecko that corrupts, so bake the same stack into the 2D context.
        const isGecko = document.documentElement.getAttribute('data-vf-engine') === 'gecko';
        const isVoxel = document.documentElement.getAttribute('data-vf-ship-render') === 'VOXEL';
        const prevFilter = c.filter;
        if (isGecko && !isVoxel) {
            try {
                const rootStyle = document.documentElement.style;
                const contrast = rootStyle.getPropertyValue('--theme-contrast-filter')
                    || vfCssVar('--theme-contrast-filter') || '1.15';
                const sat = rootStyle.getPropertyValue('--theme-saturation-filter')
                    || vfCssVar('--theme-saturation-filter') || '1';
                const bri = rootStyle.getPropertyValue('--theme-brightness-filter')
                    || vfCssVar('--theme-brightness-filter') || '1';
                const key = contrast + '|' + sat + '|' + bri;
                if (this._geckoFilterKey !== key) {
                    this._geckoFilterKey = key;
                    this._geckoFilter = 'contrast(' + String(contrast).trim()
                        + ') saturate(' + String(sat).trim()
                        + ') brightness(' + String(bri).trim() + ')';
                }
                // Only touch ctx.filter when the string actually changed (Gecko cost).
                if (c.filter !== this._geckoFilter) c.filter = this._geckoFilter;
            } catch (e) { /* keep none */ }
        }
        const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) || null;
        const prevScale = loader ? loader.deviceScale : null;
        const prevDetail = loader ? loader.voxelDetail : null;
        const prevGlobal = loader ? loader.globalVoxelCell : null;
        if (loader) {
            loader.deviceScale = k;
            loader.voxelDetail = this.getCombatVoxelDetail();
            // Global Pixel Size still snaps FX via getCombatVoxelCell, but must NOT force
            // FLAT ships onto the voxel fillRect path (gp 1/2 made every hull a GPU sink).
            const voxelShips = typeof uiAppearanceManager !== 'undefined'
                && String(uiAppearanceManager.shipRenderStyle || '').toUpperCase() === 'VOXEL';
            loader.globalVoxelCell = voxelShips ? this.getCombatVoxelCell() : null;
            if (voxelShips && k < 1) { loader.voxelDetail = 1; loader.globalVoxelCell = 1 / k; }
        }
        try {
            return this.renderFrame(c, width || lw, height || lh);
        } finally {
            if (isGecko) c.filter = prevFilter || 'none';
            if (loader) {
                loader.deviceScale = prevScale;
                loader.voxelDetail = prevDetail;
                loader.globalVoxelCell = prevGlobal;
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
        // Scrolling stages show the planet as the ground instead (drawScrollTerrain).
        if (typeof obstacleManager !== 'undefined' && obstacleManager.hasTerrain && obstacleManager.hasTerrain()) return;
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
        const cell = this.getCombatVoxelCell();
        let x = w * pl.cx - d / 2 + clamp(pl.vx * t) + Math.sin(now / 40) * 4;
        let y = h - d * pl.show + clamp(pl.vy * t); // only the limb shows, below the player
        let dd = d;
        if (cell) {
            x = Math.round(x / cell) * cell;
            y = Math.round(y / cell) * cell;
            dd = Math.max(cell, Math.round(d / cell) * cell);
        } else {
            x = Math.round(x);
            y = Math.round(y);
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Kept faint: it is scenery, not something to read during a fight.
        ctx.globalAlpha = this.getCombatBackdropOpacity() * 0.45;
        ctx.drawImage(img, x, y, dd, dd);
        ctx.restore();
        // Soft night veil only in FLAT — VOXEL keeps hard planet pixels.
        if (!cell) {
            const g = ctx.createLinearGradient(0, y, 0, y + dd * 0.3);
            g.addColorStop(0, 'rgba(0,0,0,0.55)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + dd / 2, y + dd / 2, dd / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = g;
            ctx.fillRect(x, y, dd, dd * 0.3);
            ctx.restore();
        }
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
            this._fieldW = width || 240; // scenery pixel sizes follow the planet
            this.drawOrbitPlanet(ctx, width, height);
            this.drawScrollTerrain(ctx, width, height);
        }

        const player = playerManager.getPosition();
        const fogList = (typeof obstacleManager !== 'undefined' && obstacleManager.getFogObstacles)
            ? obstacleManager.getFogObstacles()
            : ((obstacleManager.getObstacles && obstacleManager.getObstacles()) || []).filter((o) => o && o.isFog);

        // Obstacles tagged wallDepth:'under' sit under the canyon walls.
        this.drawSolidObstacles(ctx, fogList, player, 'under');
        if (this.drawScrollTerrainWalls) this.drawScrollTerrainWalls(ctx);

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
                if (enemy.isBoss && enemyManager.renderBossBar) enemyManager.renderBossBar(ctx, width);
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
                    const beamColor = side.role === 'shieldBattery'
                        ? (vfCssVar('--current-secondary') || '#6af')
                        : (vfCssVar('--current-accent') || '#8f8');
                    const x0 = side.x + side.width / 2;
                    const y0 = side.y + side.height / 2;
                    const x1 = champ.x + champ.width / 2;
                    const y1 = champ.y + champ.height / 2;
                    const cell = this.getCombatVoxelCell();
                    ctx.save();
                    if (cell) {
                        // VOXEL / GP lattice beam — cap steps so gp 1/2 (tiny cells) stay cheap.
                        const dx = x1 - x0;
                        const dy = y1 - y0;
                        const len = Math.hypot(dx, dy) || 1;
                        const brush = Math.max(cell, len / 64);
                        const steps = Math.max(1, Math.min(64, Math.floor(len / brush)));
                        for (let i = 0; i <= steps; i += 2) {
                            const t = i / steps;
                            this.fillCombatRect(
                                ctx, x0 + dx * t - brush / 2, y0 + dy * t - brush / 2,
                                brush, brush, beamColor, 0.7
                            );
                        }
                    } else {
                        ctx.strokeStyle = beamColor;
                        ctx.globalAlpha = 0.55;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(x0, y0);
                        ctx.lineTo(x1, y1);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                ctx.save();
                ctx.globalAlpha = 0.95;
                if (graphicsManager.renderEnemyShip) {
                    // Draw at footprint size (hit profile already ~75–80% of champion).
                    // Do not shrink again — a second scale made escorts look like flecks.
                    graphicsManager.renderEnemyShip(ctx, side, 1);
                } else {
                    ctx.fillStyle = this.resolveCss('var(--current-accent)', '#ff8844');
                    ctx.fillRect(side.x, side.y, side.width, side.height);
                }
                ctx.restore();
                if (side.shieldMax > 0 && side.shield > 0 && graphicsManager.drawShieldHull) {
                    const threat = this.getShieldThreatProximity(side, { mode: 'enemy' });
                    if (threat > 0.01) {
                        const strength = side.shield / side.shieldMax;
                        graphicsManager.drawShieldHull(
                            ctx,
                            side,
                            threat * (0.45 + 0.55 * strength),
                            true,
                            null
                        );
                    }
                }
            });
        }

        // Non-fog obstacles that sit on top of the canyon walls.
        this.drawSolidObstacles(ctx, fogList, player, 'over');
        if (obstacleManager.renderDebris) obstacleManager.renderDebris(ctx);

        if (typeof objectiveManager !== 'undefined' && objectiveManager.render) {
            objectiveManager.render(ctx);
        }

        if (typeof pickupManager !== 'undefined' && pickupManager.render) {
            pickupManager.render(ctx);
            if (pickupManager.drawPowerShotBar) pickupManager.drawPowerShotBar(ctx);
        }

        // Enemy bullets (occluded); player bullets always visible
        const enemyShots = bulletManager.getEnemyBullets();
        for (let bi = 0; bi < enemyShots.length; bi++) {
            const bullet = enemyShots[bi];
            if (this.isOccludedByFog(player, bullet, fogList)) continue;
            this.drawBullet(ctx, bullet, this.calculateBulletLighting(bullet));
        }
        const playerShots = bulletManager.getBullets();
        for (let bi = 0; bi < playerShots.length; bi++) {
            const bullet = playerShots[bi];
            this.drawBullet(ctx, bullet, this.calculateBulletLighting(bullet));
        }

        // Player + HUD on top (always visible)
        if (player) {
            // Flying into the sluice / warp ring: the ship shrinks and fades into the chamber.
            const enterFx = (typeof objectiveManager !== 'undefined' && objectiveManager.getEnterFx) ? objectiveManager.getEnterFx() : null;
            // Leaving the arrival hatch: the hatch rock hides the ship until it is out of the tube mouth.
            const occ = (typeof objectiveManager !== 'undefined' && objectiveManager.getArrivalOcclusion)
                ? objectiveManager.getArrivalOcclusion() : null;
            if (occ) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-10000, -10000, 20000, 10000 + occ.top);
                ctx.rect(occ.l, occ.top, occ.r - occ.l, occ.bottom - occ.top);
                ctx.clip();
            }
            // Spawn invincibility: fast blink so it reads as temporary immunity.
            const invulnBlink = (typeof playerManager !== 'undefined' && playerManager.invuln > 0
                && Math.floor(playerManager.invuln / 90) % 2 === 0) ? 0.35 : 1;
            if (enterFx) {
                const pcx = player.x + player.width / 2, pcy = player.y + player.height / 2;
                ctx.save();
                ctx.globalAlpha = enterFx.alpha * invulnBlink;
                ctx.translate(pcx, pcy);
                ctx.scale(enterFx.scale, enterFx.scale);
                ctx.translate(-pcx, -pcy);
                graphicsManager.renderPlayerShip(ctx, player, 1);
                ctx.restore();
            } else if (invulnBlink !== 1) {
                ctx.save();
                ctx.globalAlpha = invulnBlink;
                graphicsManager.renderPlayerShip(ctx, player, 1);
                ctx.restore();
            } else {
                graphicsManager.renderPlayerShip(ctx, player, 1);
            }
            if (occ) ctx.restore();
            if (bulletManager.drawMuzzleFlashes) bulletManager.drawMuzzleFlashes(ctx, player);
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
        // Pickup "+N" popups above the ship (drawn after it so the hull never covers them).
        if (typeof pickupManager !== 'undefined' && pickupManager.renderPopups) {
            pickupManager.renderPopups(ctx);
        }

        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderParticles) {
            graphicsManager.renderParticles(ctx);
        }
        if (typeof explosionSystem !== 'undefined' && explosionSystem.render) {
            explosionSystem.render(ctx);
        }
    }
}
