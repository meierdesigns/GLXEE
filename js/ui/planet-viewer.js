"use strict";

/**
 * Planet Viewer — browse planets by galaxy/system; open Planet Editor from here.
 * Open: Start menu → PLANETS, Pause → PLANETS
 */
class PlanetViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.planets = [];
        this.systems = [];
        this.overlay = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewZoom = 1;
        this.previewFullscreen = false;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewPanning = false;
        this.previewPanLastX = 0;
        this.previewPanLastY = 0;
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        this._previewCfgId = null;
        this._keyHandler = (e) => this.handleKeyDown(e);
    }

    getPlanetData(id) {
        if (typeof planetConfigManager === 'undefined') {
            return {
                id: id,
                name: String(id).toUpperCase(),
                difficulty: '',
                description: '',
                galaxy: '',
                galaxyId: '',
                enemyCount: 0,
                layerCount: 0,
                stages: []
            };
        }
        const cfg = planetConfigManager.getConfig(id);
        const gid = planetConfigManager.getPlanetGalaxyId(id);
        const galaxy = planetConfigManager.getGalaxy(gid);
        const stages = cfg && cfg.stages
            ? Object.keys(cfg.stages).map((key) => {
                const stage = cfg.stages[key] || {};
                const enemies = Array.isArray(stage.enemies) ? stage.enemies.length : 0;
                return { key: key, enemies: enemies };
            })
            : [];
        return {
            id: id,
            name: (cfg && cfg.name) || id.toUpperCase(),
            difficulty: (cfg && cfg.difficulty) || '',
            description: (cfg && cfg.description) || '',
            galaxy: galaxy ? galaxy.name : '',
            galaxyId: gid || '',
            factions: (cfg && Array.isArray(cfg.factions)) ? cfg.factions.slice() : [],
            enemyCount: (cfg && cfg.enemies && cfg.enemies.length) || 0,
            layerCount: (cfg && cfg.backgroundLayers && cfg.backgroundLayers.length) || 0,
            stages: stages
        };
    }

    getSelectedConfig() {
        const p = this.planets[this.selectedIndex];
        if (!p || typeof planetConfigManager === 'undefined') return null;
        return planetConfigManager.getConfig(p.id) || null;
    }

    isPlanetVisible(galaxyId, planetId) {
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) {
            return true;
        }
        if (typeof profileManager === 'undefined' || !profileManager.getActiveProfile()) {
            return true;
        }
        const gid = galaxyId || (typeof planetConfigManager !== 'undefined'
            ? planetConfigManager.getPlanetGalaxyId(planetId)
            : null);
        if (!gid) return true;
        return profileManager.isPlanetUnlocked(gid, planetId)
            || profileManager.isPlanetCleared(gid, planetId);
    }

    buildSystems() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyTree) {
            const tree = planetConfigManager.getGalaxyTree();
            this.systems = tree.map((g) => ({
                id: g.id,
                name: g.name,
                planets: (g.planets || [])
                    .filter((p) => this.isPlanetVisible(g.id, p.id))
                    .map((p) => this.getPlanetData(p.id))
            })).filter((sys) => sys.planets.length > 0);
        } else {
            const ids = ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
            this.systems = [{
                id: 'milky_way',
                name: 'MILKY WAY',
                planets: ids
                    .filter((id) => this.isPlanetVisible('milky_way', id))
                    .map((id) => this.getPlanetData(id))
            }].filter((sys) => sys.planets.length > 0);
        }
        this.planets = [];
        this.systems.forEach((sys) => {
            sys.planets.forEach((p) => this.planets.push(p));
        });
    }

    planetIconHtml(planetId, size) {
        const sid = String(planetId || 'mars').toLowerCase();
        const px = size || 32;
        if (typeof planetSVGManager !== 'undefined') {
            if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                planetSVGManager.init();
            }
            let svg = planetSVGManager.getPlanetSVG(sid);
            if (svg) {
                const uid = 'pv_' + sid + '_' + Math.random().toString(36).slice(2, 7);
                svg = svg
                    .replace(/id="([^"]+)"/g, (m, id) => `id="${uid}_${id}"`)
                    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${uid}_${id})`)
                    .replace(/width="\d+"/, `width="${px}"`)
                    .replace(/height="\d+"/, `height="${px}"`);
                return `<span class="cv-icon cv-planet-icon">${svg}</span>`;
            }
        }
        return `<span class="cv-icon cv-planet-fallback" data-planet="${sid}" style="width:${px}px;height:${px}px"></span>`;
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.buildSystems();
        if (!this.planets.length) return;
        const preferId = options && options.planetId;
        if (preferId) {
            const idx = this.planets.findIndex((p) => p.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.planets.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('planet-viewer', {
                planet: this.planets[this.selectedIndex].id
            });
        }
    }

    hide() {
        this.visible = false;
        this.stopPreview();
        this.cleanupPreviewControls();
        this.setPreviewFullscreen(false);
        document.removeEventListener('keydown', this._keyHandler);
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.previewCanvas = null;
        this.previewCtx = null;
    }

    createUI() {
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        if (this.overlay) this.overlay.remove();

        this.overlay = document.createElement('div');
        this.overlay.className = 'content-viewer-overlay';
        this.overlay.innerHTML = `
            <div class="content-viewer-panel">
                <h2 class="content-viewer-title">PLANETS</h2>
                <div class="content-viewer-body has-preview" id="pvViewerBody">
                    <aside class="content-viewer-list" id="pvList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize planet list"></div>
                    <div class="content-viewer-detail" id="pvDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="pvPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="pvZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="pvZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="pvZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="pvZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="pvPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="pvPreviewViewport">
                            <canvas id="pvPreview" width="240" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn pe-primary" id="pvEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="pvClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">↑↓ Navigate • E Edit • ESC Close</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }

        this.bindPreviewControls();
        this.setupPanelResize();
        this.renderList();
        this.renderDetail();
        this.startPreview();

        this.overlay.querySelector('#pvEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#pvClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    planetProgressFlags(planet) {
        if (!planet || typeof profileManager === 'undefined') {
            return { known: false, visited: false, cleared: false };
        }
        const gid = planet.galaxyId || (typeof planetConfigManager !== 'undefined'
            ? planetConfigManager.getPlanetGalaxyId(planet.id)
            : null);
        return {
            known: profileManager.isDiscovered('planets', planet.id),
            visited: !!(gid && (profileManager.isPlanetUnlocked(gid, planet.id)
                || profileManager.isPlanetCleared(gid, planet.id))),
            cleared: !!(gid && profileManager.isPlanetCleared(gid, planet.id))
        };
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const p = this.planets[this.selectedIndex];
                return !!(p && profileManager.isDiscovered('planets', p.id));
            },
            toggleKnown: () => {
                const p = this.planets[this.selectedIndex];
                if (p) profileManager.toggleDiscovered('planets', p.id);
            },
            visited: () => {
                const p = this.planets[this.selectedIndex];
                return !!(p && this.planetProgressFlags(p).visited);
            },
            toggleVisited: () => {
                const p = this.planets[this.selectedIndex];
                if (p) profileManager.togglePlanetVisited(p.id);
            },
            cleared: () => {
                const p = this.planets[this.selectedIndex];
                return !!(p && this.planetProgressFlags(p).cleared);
            },
            toggleCleared: () => {
                const p = this.planets[this.selectedIndex];
                if (p) profileManager.togglePlanetCleared(p.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#pvViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'pvPanelWidths',
            defaults: { left: 220, right: 260 },
            mins: { left: 140, right: 180, center: 200 },
            leftVar: '--cv-left-w',
            rightVar: '--cv-right-w',
            onChange: () => {
                if (this.visible) this.applyPreviewView();
            }
        });
    }

    bindPreviewControls() {
        const overlay = this.overlay;
        this.previewCanvas = overlay.querySelector('#pvPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#pvZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#pvZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#pvZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#pvPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#pvPreviewViewport');
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.setPreviewZoom(this.previewZoom + (e.deltaY < 0 ? 0.1 : -0.1));
        }, { passive: false });
        viewport.addEventListener('contextmenu', (e) => e.preventDefault());
        viewport.addEventListener('mousedown', (e) => {
            if (e.button !== 2) return;
            e.preventDefault();
            this.previewPanning = true;
            this.previewPanLastX = e.clientX;
            this.previewPanLastY = e.clientY;
            viewport.classList.add('pe-panning');
        });
        const onMove = (e) => {
            if (!this.previewPanning || !this.visible) return;
            this.previewPanX += e.clientX - this.previewPanLastX;
            this.previewPanY += e.clientY - this.previewPanLastY;
            this.previewPanLastX = e.clientX;
            this.previewPanLastY = e.clientY;
            this.applyPreviewView();
        };
        const endPan = () => {
            if (!this.previewPanning) return;
            this.previewPanning = false;
            const vp = this.overlay && this.overlay.querySelector('#pvPreviewViewport');
            if (vp) vp.classList.remove('pe-panning');
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', endPan);
        this._previewCleanup = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', endPan);
        };
        this.applyPreviewView();
        requestAnimationFrame(() => this.applyPreviewView());
    }

    setPreviewZoom(zoom) {
        this.previewZoom = Math.min(4, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    }

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    }

    applyPreviewView() {
        const wrap = this.overlay && this.overlay.querySelector('#pvPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#pvZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#pvPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#pvPreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewCanvas.width / this.previewCanvas.height || 0.8;
            let fitW = availW;
            let fitH = fitW / aspect;
            if (fitH > availH) {
                fitH = availH;
                fitW = fitH * aspect;
            }
            this.previewCanvas.style.width = `${Math.round(fitW)}px`;
            this.previewCanvas.style.height = `${Math.round(fitH)}px`;
            this.previewCanvas.style.transform =
                `translate(${this.previewPanX}px, ${this.previewPanY}px) scale(${this.previewZoom})`;
        }
    }

    startPreview() {
        this.stopPreview();
        if (this.previewCanvas) {
            this.previewCanvas.width = 240;
            this.previewCanvas.height = 300;
            this.previewCtx = this.previewCanvas.getContext('2d');
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        this._previewCfgId = null;
        let lastTs = 0;
        const tick = (ts) => {
            if (!this.visible) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min(50, ts - lastTs);
            lastTs = ts;
            this.updatePreviewObstacles(dt);
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(tick);
        };
        this.previewAnimId = requestAnimationFrame(tick);
    }

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
    }

    cleanupPreviewControls() {
        if (this._previewCleanup) {
            this._previewCleanup();
            this._previewCleanup = null;
        }
    }

    drawPreview() {
        if (!this.previewCtx || !this.previewCanvas) return;
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const cfg = this.getSelectedConfig();
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (!cfg) {
            ctx.fillStyle = '#888';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NO DATA', w / 2, h / 2);
            return;
        }

        const t = performance.now() / 1000;
        const canDraw = typeof parallaxManager !== 'undefined' && parallaxManager.drawLayerPattern;
        const layers = cfg.backgroundLayers || [];

        layers.forEach((layer) => {
            if (layer.visible === false) return;
            const opacity = layer.opacity != null ? layer.opacity : 0.15;
            if (opacity <= 0) return;

            let color = '#808080';
            if (typeof planetConfigManager !== 'undefined') {
                color = planetConfigManager.resolveLayerColor(layer);
            }

            ctx.save();
            ctx.globalAlpha = opacity;
            if (canDraw) {
                const speed = layer.speed || 0.3;
                const fakeLayer = {
                    pattern: layer.pattern,
                    y: (t * speed * 40) % 600,
                    color,
                    colorSource: 'custom',
                    opacity: 1,
                    scale: layer.scale != null ? layer.scale : 1,
                    visible: true
                };
                parallaxManager.drawLayerPattern(ctx, fakeLayer, 0);
            } else {
                ctx.fillStyle = color;
                const speed = layer.speed || 0.3;
                const offset = (t * speed * 40) % 40;
                const step = layer.pattern && layer.pattern.includes('sky') ? 16 : 10;
                for (let x = 0; x < w; x += step) {
                    for (let y = -40; y < h + 40; y += step) {
                        if (((Math.floor(x / step) + Math.floor((y + offset) / step)) % 3) === 0) {
                            ctx.fillRect(x, Math.floor(y + offset) % h, 3, 3);
                        }
                    }
                }
            }
            ctx.restore();
        });

        this.drawObstaclePreviews(ctx);
        this.drawSideEnemyPreviews(ctx, w, h, cfg.enemies || cfg.sideEnemies || []);

        const p = this.planets[this.selectedIndex];
        ctx.globalAlpha = 1;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--current-text').trim() || '#e8a040';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText((p && p.name) || 'PLANET', 8, 14);
    }

    updatePreviewObstacles(dtMs) {
        if (!this.previewCanvas) return;
        const cfg = this.getSelectedConfig();
        const defs = (cfg && cfg.obstacles) || [];
        const cfgId = cfg && cfg.id;
        if (cfgId !== this._previewCfgId) {
            this._previewCfgId = cfgId;
            this.previewObstacles = [];
            this.previewObstacleSpawnAcc = 0;
        }
        if (!defs.length) {
            this.previewObstacles = [];
            return;
        }
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const frames = dtMs / 16.67;
        const interval = Math.max(400, (cfg && cfg.obstacleSpawnRate) || 2000);
        this.previewObstacleSpawnAcc += dtMs;
        while (this.previewObstacleSpawnAcc >= interval) {
            this.previewObstacleSpawnAcc -= interval;
            this.spawnPreviewObstacle(defs, w, h);
        }
        if (this.previewObstacles.length === 0) {
            for (let i = 0; i < Math.min(3, defs.length); i++) {
                this.spawnPreviewObstacle(defs, w, h);
                const o = this.previewObstacles[this.previewObstacles.length - 1];
                if (o) o.x = Math.random() * w * 0.7;
            }
        }
        const margin = 40;
        this.previewObstacles = this.previewObstacles.filter((o) => {
            o.x += o.horizontalSpeed * frames;
            o.y += o.verticalSpeed * frames;
            return o.x < w + margin && o.y < h + margin && o.x > -margin && o.y > -margin;
        });
    }

    spawnPreviewObstacle(defs, w, h) {
        if (!defs || !defs.length) return;
        let total = 0;
        defs.forEach((d) => { total += Math.max(1, d.weight || 1); });
        let r = Math.random() * total;
        let def = defs[0];
        for (let i = 0; i < defs.length; i++) {
            r -= Math.max(1, defs[i].weight || 1);
            if (r <= 0) { def = defs[i]; break; }
        }
        if (typeof obstacleManager !== 'undefined' && obstacleManager.createObstacleFromDef) {
            const origin = obstacleManager.spawnOriginForDirection
                ? obstacleManager.spawnOriginForDirection(def.direction || 'ltr', def.width, def.height, { width: w, height: h })
                : { x: -(def.width || 18), y: Math.random() * Math.max(1, h - (def.height || 18)) };
            this.previewObstacles.push(obstacleManager.createObstacleFromDef(def, { x: origin.x, y: origin.y }));
            return;
        }
        const size = { width: def.width || 18, height: def.height || 18 };
        const horizontalSpeed = def.speed != null ? def.speed : 0.8;
        this.previewObstacles.push({
            x: -size.width,
            y: Math.random() * Math.max(1, h - size.height),
            width: size.width,
            height: size.height,
            horizontalSpeed,
            verticalSpeed: horizontalSpeed * 0.3,
            type: def.type,
            kind: def.kind,
            isFog: def.kind === 'fog',
            reflectsShots: !!def.reflectsShots,
            sprite: def.sprite,
            opacity: def.opacity != null ? def.opacity : 1,
            opticalMode: def.opticalMode || 'none',
            rotation: 0
        });
    }

    drawObstaclePreviews(ctx) {
        const list = this.previewObstacles || [];
        const fogs = list.filter((o) => o.isFog);
        const solids = list.filter((o) => !o.isFog);
        [...fogs, ...solids].forEach((obstacle) => {
            if (typeof renderManager !== 'undefined' && renderManager.drawObstacleSprite) {
                renderManager.drawObstacleSprite(ctx, obstacle);
                return;
            }
            const spriteName = obstacle.sprite
                || (obstacle.isFog ? 'fog' : (obstacle.reflectsShots ? 'shield' : 'obstacle'));
            const alpha = obstacle.opacity != null ? obstacle.opacity : 1;
            if (typeof graphicsManager !== 'undefined' && graphicsManager.drawSprite && graphicsManager.getSprite) {
                const sprite = graphicsManager.getSprite(spriteName)
                    || graphicsManager.getSprite(obstacle.reflectsShots ? 'shield' : 'obstacle');
                if (sprite) {
                    ctx.save();
                    if (alpha < 1) ctx.globalAlpha = alpha;
                    graphicsManager.drawSprite(
                        ctx, sprite,
                        obstacle.x, obstacle.y, obstacle.width, obstacle.height,
                        0, 'var(--current-text-secondary)'
                    );
                    ctx.restore();
                    return;
                }
            }
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = obstacle.isFog ? 'rgba(120,140,180,0.5)' : (obstacle.reflectsShots ? '#7a9aaa' : '#6a6a6a');
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.restore();
        });
    }

    drawSideEnemyPreviews(ctx, w, h, enemies) {
        if (!enemies.length) return;
        enemies.slice(0, 4).forEach((entry, i) => {
            const x = w - 48;
            const y = 28 + i * 48;
            ctx.save();
            ctx.globalAlpha = 0.9;
            if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
                graphicsManager.renderEnemyShip(ctx, {
                    x, y, width: 24, height: 18, type: entry.type
                }, 0.85);
            } else {
                ctx.fillStyle = '#999';
                ctx.fillRect(x, y, 24, 18);
            }
            if (entry.champion) {
                ctx.strokeStyle = '#c45c26';
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 2, y - 2, 28, 22);
            }
            ctx.restore();
        });
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#pvList');
        if (!list) return;
        list.innerHTML = '';

        this.systems.forEach((sys) => {
            const group = document.createElement('div');
            group.className = 'cv-system-group';

            const head = document.createElement('div');
            head.className = 'cv-system-label';
            head.textContent = sys.name || 'SYSTEM';
            group.appendChild(head);

            if (!sys.planets.length) {
                const empty = document.createElement('div');
                empty.className = 'cv-system-empty';
                empty.textContent = '—';
                group.appendChild(empty);
            } else {
                sys.planets.forEach((planet) => {
                    const flatIndex = this.planets.findIndex((p) => p.id === planet.id);
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'content-viewer-item' + (flatIndex === this.selectedIndex ? ' selected' : '');
                    btn.innerHTML =
                        this.planetIconHtml(planet.id, 32) +
                        `<span class="cv-item-label">${planet.name}` +
                        (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                            ? devProfileToggles.badgesHtml(this.planetProgressFlags(planet))
                            : '') +
                        `</span>`;
                    btn.addEventListener('click', () => {
                        this.selectedIndex = flatIndex;
                        this.renderList();
                        this.renderDetail();
                        this.persist();
                    });
                    group.appendChild(btn);
                });
            }
            list.appendChild(group);
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#pvDetail');
        const p = this.planets[this.selectedIndex];
        if (!root || !p) return;

        const stageRows = (p.stages && p.stages.length)
            ? p.stages.map((s) => {
                const label = s.key === 'boss' ? 'BOSS' : `STAGE ${s.key}`;
                return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${s.enemies} enemies</span></div>`;
            }).join('')
            : '<div class="stat-row"><span class="stat-label">Stages</span><span class="stat-value">—</span></div>';

        const systemsHtml = this.systems.map((sys) => {
            const active = sys.id === p.galaxyId || sys.name === p.galaxy;
            const count = sys.planets.length;
            return `<span class="cv-system-chip${active ? ' active' : ''}">${sys.name} (${count})</span>`;
        }).join('');

        root.innerHTML = `
            <div class="content-viewer-hero">
                ${this.planetIconHtml(p.id, 48)}
                <div>
                    <h3 class="content-viewer-name">${p.name}</h3>
                    <p class="content-viewer-desc">${p.description || 'No description.'}</p>
                </div>
            </div>
            <div class="cv-systems-row">
                <div class="cv-systems-title">SYSTEMS</div>
                <div class="cv-systems-chips">${systemsHtml || '—'}</div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">Galaxy</span><span class="stat-value">${p.galaxy || '—'}</span></div>
                <div class="stat-row"><span class="stat-label">Factions</span><span class="stat-value">${(p.factions && p.factions.length) ? p.factions.join(', ') : 'ALL'}</span></div>
                <div class="stat-row"><span class="stat-label">Difficulty</span><span class="stat-value">${p.difficulty || '—'}</span></div>
                <div class="stat-row"><span class="stat-label">BG Layers</span><span class="stat-value">${p.layerCount}</span></div>
                <div class="stat-row"><span class="stat-label">Enemies</span><span class="stat-value">${p.enemyCount}</span></div>
            </div>
            <div class="cv-stages-block">
                <div class="cv-systems-title">STAGES</div>
                <div class="content-viewer-stats">${stageRows}</div>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const p = this.planets[this.selectedIndex];
            menuStateManager.setScreen('planet-viewer', { planet: p ? p.id : 'mars' });
        }
    }

    handleKeyDown(e) {
        if (!this.visible) return;
        if (this._devToggles && this._devToggles.handleKey(e)) return;
        if (e.key === 'Escape' && this.previewFullscreen) {
            e.preventDefault();
            this.setPreviewFullscreen(false);
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.renderList();
                this.renderDetail();
                this.persist();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.selectedIndex = Math.min(this.planets.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.persist();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    openEditor() {
        const p = this.planets[this.selectedIndex];
        if (!p || typeof planetEditorUI === 'undefined') return;
        this.hide();
        planetEditorUI.show(p.id, undefined, false, { returnTo: 'planet-viewer' });
    }

    close() {
        this.hide();
        const container = document.querySelector('.game-container');
        const inGame = container && container.style.display !== 'none';
        if (inGame) {
            if (typeof menuStateManager !== 'undefined') menuStateManager.setScreen('ingame');
            return;
        }
        if (this.onClose) {
            const cb = this.onClose;
            this.onClose = null;
            cb();
            return;
        }
        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'explorations',
                focusExplore: 'planets',
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') startScreenManager.show();
                }
            });
        } else if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        } else if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
    }
}

const planetViewerUI = new PlanetViewerUI();
