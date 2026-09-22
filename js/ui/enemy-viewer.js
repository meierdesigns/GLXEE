"use strict";

/**
 * Enemy Viewer — browse enemy types with ship icons; open Enemy Editor from here.
 * Open: Start menu → ENEMIES, Pause → ENEMIES
 */
class EnemyViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.enemies = [];
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
        this.previewSim = null;
        this.previewLastTs = 0;
        this._keyHandler = (e) => this.handleKeyDown(e);
        this._onAssetsReady = () => {
            if (this.visible) {
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('vf-sprites-loaded', this._onAssetsReady);
            window.addEventListener('vf-ships-loaded', this._onAssetsReady);
        }
    }

    getEnemyList() {
        if (typeof enemyConfigManager === 'undefined') {
            return [
                { id: 'enemyBasic', name: 'BASIC', description: '', factions: ['pirate'], primaryFaction: 'pirate', maxHealth: 100, armor: 15, damage: 25, speed: 1.5, weapon: 'laser', shootInterval: 1200, verticalSpeed: 0.3, minY: 25, maxY: 100 },
                { id: 'enemyFast', name: 'FAST', description: '', factions: ['kronax'], primaryFaction: 'kronax', maxHealth: 80, armor: 8, damage: 20, speed: 2.75, weapon: 'laser', shootInterval: 900, verticalSpeed: 0.4, minY: 25, maxY: 100 },
                { id: 'enemyHeavy', name: 'HEAVY', description: '', factions: ['machine'], primaryFaction: 'machine', maxHealth: 180, armor: 35, damage: 40, speed: 1.0, weapon: 'plasma', shootInterval: 1500, verticalSpeed: 0.2, minY: 25, maxY: 100 },
                { id: 'enemyBoss', name: 'BOSS', description: '', factions: ['voidborn'], primaryFaction: 'voidborn', maxHealth: 400, armor: 50, damage: 60, speed: 0.4, weapon: 'plasma', shootInterval: 800, verticalSpeed: 0.15, minY: 20, maxY: 80 }
            ];
        }
        const factionOrder = typeof enemyConfigManager.getFactionOptions === 'function'
            ? enemyConfigManager.getFactionOptions()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        let typeIds = enemyConfigManager.getTypeIds();
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const allowed = {};
            profileManager.getDiscovered('enemies').forEach((id) => { allowed[id] = true; });
            typeIds = typeIds.filter((id) => !!allowed[id]);
        }
        const list = typeIds.map((id) => {
            const cfg = enemyConfigManager.getConfig(id);
            const factions = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
                ? cfg.factions.slice()
                : [enemyConfigManager.getDefaultFaction
                    ? enemyConfigManager.getDefaultFaction(id)
                    : 'pirate'];
            return {
                id: id,
                name: enemyConfigManager.getDisplayName(id) || (cfg && cfg.name) || id,
                description: (cfg && cfg.description) || '',
                factions: factions,
                primaryFaction: factions[0] || 'unassigned',
                maxHealth: (cfg && cfg.maxHealth) || 0,
                armor: (cfg && cfg.armor) || 0,
                damage: (cfg && cfg.damage) || 0,
                speed: (cfg && cfg.speed) || 0,
                weapon: (cfg && cfg.defaultWeapon) || '—',
                shootInterval: (cfg && cfg.shootInterval) || 1200,
                verticalSpeed: (cfg && cfg.verticalSpeed) || 0.3,
                minY: (cfg && cfg.minY != null) ? cfg.minY : 25,
                maxY: (cfg && cfg.maxY != null) ? cfg.maxY : 100,
                shieldMax: (cfg && cfg.shieldMax) || 0
            };
        });
        list.sort((a, b) => {
            const ai = factionOrder.indexOf(a.primaryFaction);
            const bi = factionOrder.indexOf(b.primaryFaction);
            const ao = ai === -1 ? 999 : ai;
            const bo = bi === -1 ? 999 : bi;
            if (ao !== bo) return ao - bo;
            return String(a.name).localeCompare(String(b.name));
        });
        return list;
    }

    /**
     * Expand enemies into faction clusters (multi-faction enemies appear in each group).
     * Returns [{ faction, enemies: [{ enemy, index }] }]
     */
    getFactionClusters() {
        const factionOrder = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getFactionOptions
            ? enemyConfigManager.getFactionOptions()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        const buckets = {};
        this.enemies.forEach((enemy, index) => {
            const factions = (enemy.factions && enemy.factions.length)
                ? enemy.factions
                : [enemy.primaryFaction || 'unassigned'];
            factions.forEach((f) => {
                const key = f || 'unassigned';
                if (!buckets[key]) buckets[key] = [];
                buckets[key].push({ enemy, index });
            });
        });
        const keys = Object.keys(buckets).sort((a, b) => {
            const ai = factionOrder.indexOf(a);
            const bi = factionOrder.indexOf(b);
            const ao = ai === -1 ? 999 : ai;
            const bo = bi === -1 ? 999 : bi;
            if (ao !== bo) return ao - bo;
            return a.localeCompare(b);
        });
        return keys.map((faction) => ({ faction, enemies: buckets[faction] }));
    }

    getShipModel(typeId) {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({ typeId: typeId });
            if (visual && visual.model) return visual.model;
        }
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getBaseModel) {
            const model = enemyConfigManager.getBaseModel(typeId);
            if (model) return model;
        }
        return {
            name: typeId,
            type: 'enemy',
            modelClass: 'fighter',
            width: 16,
            height: 12,
            sprite: [
                [0, 0, 1, 1, 0, 0],
                [0, 1, 2, 2, 1, 0],
                [1, 2, 3, 3, 2, 1],
                [0, 1, 2, 2, 1, 0]
            ],
            colors: {
                0: 'transparent',
                1: 'var(--current-text-secondary)',
                2: 'var(--current-text)',
                3: 'var(--current-text)'
            }
        };
    }

    resolvePreviewFaction(enemy) {
        if (!enemy) return 'pirate';
        if (enemy.primaryFaction) return enemy.primaryFaction;
        if (enemy.factions && enemy.factions.length) return enemy.factions[0];
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            return planetConfigManager.taxonomyForType(enemy.id).faction || 'pirate';
        }
        return 'pirate';
    }

    resolvePreviewClass(enemy) {
        if (!enemy) return 'assault';
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            return planetConfigManager.taxonomyForType(enemy.id).enemyClass || 'assault';
        }
        return 'assault';
    }

    paintShipIcon(canvas, typeId) {
        if (!canvas) return;
        const enemy = this.enemies.find((e) => e.id === typeId);
        const faction = this.resolvePreviewFaction(enemy);
        const enemyClass = this.resolvePreviewClass(enemy);
        let ship = this.getShipModel(typeId);
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            const visual = factionShipStyles.resolveFactionShipVisual({
                faction: faction,
                enemyClass: enemyClass,
                typeId: typeId
            });
            if (visual && visual.model) ship = visual.model;
            canvas.setAttribute('data-ag-type', 'factionShip');
            canvas.setAttribute('data-ag-id', visual.spriteKey);
            canvas.setAttribute('data-ag-key', visual.spriteKey);
        } else {
            if (typeof shipRenderer !== 'undefined') {
                if (shipRenderer.init) shipRenderer.init();
                shipRenderer.renderShipPreview(canvas, ship, 1);
            }
            const spriteName = typeof shipRenderer !== 'undefined' && shipRenderer.getSpriteNameForShip
                ? shipRenderer.getSpriteNameForShip(ship)
                : null;
            if (spriteName) canvas.setAttribute('data-ag-key', spriteName);
            else if (typeId) canvas.setAttribute('data-ag-key', String(typeId));
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / 30, canvas.height / 24) * 0.85;
                graphicsManager.renderEnemyShip(ctx, {
                    x: (canvas.width - 16) / 2,
                    y: (canvas.height - 12) / 2,
                    width: 16,
                    height: 12,
                    type: typeId,
                    faction: faction,
                    enemyClass: enemyClass,
                    tier: (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
                        ? factionShipStyles.classTier[enemyClass]
                        : 2
                }, scale);
            }
        } else if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            shipRenderer.renderShipPreview(canvas, ship, 1);
        }
        const spriteName = ship && ship.factionSpriteKey;
        const hasSprite = typeof spriteLoader !== 'undefined' && spriteName && spriteLoader.getSprite(spriteName);
        const shipsReady = typeof graphicsManager !== 'undefined'
            && graphicsManager.shipAssetLoader
            && graphicsManager.shipAssetLoader.isLoaded();
        if ((!hasSprite || !shipsReady) && !canvas.dataset.vfRetryBound) {
            canvas.dataset.vfRetryBound = '1';
            const retry = () => {
                if (!canvas.isConnected || !this.visible) return;
                this.paintShipIcon(canvas, typeId);
            };
            window.addEventListener('vf-sprites-loaded', retry, { once: true });
            window.addEventListener('vf-ships-loaded', retry, { once: true });
            window.addEventListener('vf-asset-accepted', retry, { once: true });
        }
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.enemies = this.getEnemyList();
        if (!this.enemies.length) return;
        const preferId = options && options.enemyType;
        if (preferId) {
            const idx = this.enemies.findIndex((e) => e.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.enemies.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('enemy-viewer', {
                enemyType: this.enemies[this.selectedIndex].id
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
        this.previewSim = null;
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
                <h2 class="content-viewer-title">ENEMIES</h2>
                <div class="content-viewer-body has-preview" id="evViewerBody">
                    <aside class="content-viewer-list" id="evList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize enemy list"></div>
                    <div class="content-viewer-detail" id="evDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="evPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="evZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="evZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="evZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="evZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="evPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="evPreviewViewport">
                            <canvas id="evPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn pe-primary" id="evEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="evEditGfx">EDIT GFX</button>
                    <button type="button" class="pe-btn" id="evClose">CLOSE</button>
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
        this.resetPreviewSim();
        this.startPreview();

        this.overlay.querySelector('#evEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#evEditGfx').addEventListener('click', () => this.openGfxEditor());
        this.overlay.querySelector('#evClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const e = this.enemies[this.selectedIndex];
                return !!(e && profileManager.isDiscovered('enemies', e.id));
            },
            toggleKnown: () => {
                const e = this.enemies[this.selectedIndex];
                if (e) profileManager.toggleDiscovered('enemies', e.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#evViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'evPanelWidths',
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
        this.previewCanvas = overlay.querySelector('#evPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#evZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#evZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#evZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#evPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#evPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#evPreviewViewport');
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
        this.previewZoom = Math.min(3, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    }

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    }

    applyPreviewView() {
        const wrap = this.overlay && this.overlay.querySelector('#evPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#evZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#evPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#evPreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewCanvas.width / this.previewCanvas.height || (2 / 3);
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
        this.previewLastTs = 0;
        if (!this.previewSim) this.resetPreviewSim();
        const loop = () => {
            if (!this.visible) return;
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(loop);
        };
        this.previewAnimId = requestAnimationFrame(loop);
    }

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewLastTs = 0;
    }

    cleanupPreviewControls() {
        if (this._previewCleanup) {
            this._previewCleanup();
            this._previewCleanup = null;
        }
    }

    resetPreviewSim() {
        const e = this.enemies[this.selectedIndex];
        const model = this.getShipModel(e ? e.id : 'enemyBasic');
        const shipW = Math.max(8, Math.round(model.width || 18));
        const shipH = Math.max(8, Math.round(model.height || 14));
        const minY = Number(e && e.minY != null ? e.minY : 25);
        const maxY = Number(e && e.maxY != null ? e.maxY : 100);
        this.previewSim = {
            enemy: {
                x: 100 - shipW / 2,
                y: minY,
                width: shipW,
                height: shipH,
                speed: Number(e && e.speed != null ? e.speed : 1),
                verticalSpeed: Number(e && e.verticalSpeed != null ? e.verticalSpeed : 0.3),
                minY,
                maxY
            },
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const cfg = this.enemies[this.selectedIndex];
        if (!sim || !cfg) return;
        const frameScale = dtMs / 16.67;
        const model = this.getShipModel(cfg.id);
        const en = sim.enemy;
        en.width = Math.max(8, Math.round(model.width || 18));
        en.height = Math.max(8, Math.round(model.height || 14));
        en.speed = Number(cfg.speed) || 1;
        en.verticalSpeed = Number(cfg.verticalSpeed) || 0.3;
        en.minY = Number(cfg.minY != null ? cfg.minY : 25);
        en.maxY = Number(cfg.maxY != null ? cfg.maxY : 100);

        en.x += en.speed * frameScale * (en._dirX || 1);
        if (en.x <= 4 || en.x + en.width >= 196) {
            en._dirX = -(en._dirX || 1);
            en.x = Math.max(4, Math.min(196 - en.width, en.x));
        }
        en.y += en.verticalSpeed * frameScale * (en._dirY || 1);
        if (en.y <= en.minY || en.y >= en.maxY) {
            en._dirY = -(en._dirY || 1);
            en.y = Math.max(en.minY, Math.min(en.maxY, en.y));
        }

        sim.starPhase += dtMs * 0.004;
        sim.shootAcc += dtMs;
        const interval = Math.max(200, Number(cfg.shootInterval) || 1200);
        if (sim.shootAcc >= interval) {
            sim.shootAcc = 0;
            sim.bullets.push({
                x: en.x + en.width / 2 - 1,
                y: en.y + en.height,
                vy: 2.5,
                life: 1400,
                plasma: String(cfg.weapon || '').toLowerCase().includes('plasma')
            });
        }
        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y < 310;
        });
    }

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const cfg = this.enemies[this.selectedIndex];
        if (!canvas || !ctx || !cfg) return;

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 97) % w;
            const sy = (i * 53 + Math.floor(sim.starPhase * 20)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        for (const b of sim.bullets) {
            ctx.fillStyle = b.plasma ? '#c06040' : '#e07028';
            if (b.plasma) {
                ctx.beginPath();
                ctx.arc(b.x + 1, b.y + 2, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(b.x, b.y, 2, 6);
            }
        }

        const model = this.getShipModel(cfg.id);
        const e = sim.enemy;
        let rendered = false;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            try {
                graphicsManager.renderEnemyShip(ctx, {
                    x: e.x,
                    y: e.y,
                    width: e.width,
                    height: e.height,
                    type: cfg.id,
                    faction: this.resolvePreviewFaction(cfg),
                    enemyClass: this.resolvePreviewClass(cfg),
                    tier: (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
                        ? factionShipStyles.classTier[this.resolvePreviewClass(cfg)]
                        : 2
                }, 1);
                rendered = true;
            } catch (err) {
                rendered = false;
            }
        }
        if (!rendered) {
            if (typeof shipRenderer !== 'undefined') {
                if (shipRenderer.init) shipRenderer.init();
                const tmp = document.createElement('canvas');
                tmp.width = Math.max(1, e.width);
                tmp.height = Math.max(1, e.height);
                shipRenderer.renderShipPreview(tmp, model, 1);
                ctx.drawImage(tmp, e.x, e.y, e.width, e.height);
            } else {
                ctx.fillStyle = '#e07028';
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
        }

        ctx.fillStyle = '#e07028';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(cfg.name || cfg.id).toUpperCase(), w / 2, h - 34);
        ctx.fillStyle = '#b09070';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(`HP ${cfg.maxHealth}  SPD ${Number(cfg.speed).toFixed(2)}`, w / 2, h - 20);
        ctx.fillText(`ARM ${cfg.armor}  DMG ${cfg.damage}`, w / 2, h - 8);
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#evList');
        if (!list) return;
        list.innerHTML = '';
        const clusters = this.getFactionClusters();
        clusters.forEach((cluster) => {
            const header = document.createElement('div');
            header.className = 'content-viewer-group';
            header.textContent = 'FACTION: ' + String(cluster.faction).toUpperCase();
            list.appendChild(header);
            cluster.enemies.forEach(({ enemy, index }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
                btn.innerHTML =
                    `<canvas class="cv-icon cv-ship-icon" width="32" height="32" data-enemy="${enemy.id}"></canvas>` +
                    `<span class="cv-item-label">${enemy.name}` +
                    (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                        ? devProfileToggles.badgesHtml({
                            known: profileManager.isDiscovered('enemies', enemy.id)
                        })
                        : '') +
                    `</span>`;
                btn.addEventListener('click', () => {
                    this.selectedIndex = index;
                    this.renderList();
                    this.renderDetail();
                    this.resetPreviewSim();
                    this.persist();
                });
                list.appendChild(btn);
                const canvas = btn.querySelector('canvas');
                this.paintShipIcon(canvas, enemy.id);
            });
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#evDetail');
        const e = this.enemies[this.selectedIndex];
        if (!root || !e) return;
        const cfg = typeof enemyConfigManager !== 'undefined' ? enemyConfigManager.getConfig(e.id) : null;
        const abilities = (cfg && (cfg.abilities || cfg.defenseMechanisms)) || [];
        root.innerHTML = `
            <div class="content-viewer-hero">
                <canvas class="cv-ship-preview" width="32" height="32" id="evHeroCanvas"></canvas>
                <div>
                    <h3 class="content-viewer-name">${e.name}</h3>
                    <p class="content-viewer-desc">${e.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">Hull</span><span class="stat-value">${(cfg && cfg.hullId) ? String(cfg.hullId).toUpperCase() : String(e.id).toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Factions</span><span class="stat-value">${(cfg && cfg.factions && cfg.factions.length) ? cfg.factions.join(', ') : '—'}</span></div>
                <div class="stat-row"><span class="stat-label">Class</span><span class="stat-value">${String(this.resolvePreviewClass(e)).toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Galaxies</span><span class="stat-value">${(cfg && cfg.galaxyIds && cfg.galaxyIds.length) ? cfg.galaxyIds.join(', ') : 'ALL'}</span></div>
                <div class="stat-row"><span class="stat-label">Planets</span><span class="stat-value">${(cfg && cfg.planetIds && cfg.planetIds.length) ? cfg.planetIds.join(', ') : 'ALL'}</span></div>
                <div class="stat-row"><span class="stat-label">Health</span><span class="stat-value">${e.maxHealth}</span></div>
                <div class="stat-row"><span class="stat-label">Armor</span><span class="stat-value">${e.armor}</span></div>
                <div class="stat-row"><span class="stat-label">Damage</span><span class="stat-value">${e.damage}</span></div>
                <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-value">${e.speed}</span></div>
                <div class="stat-row"><span class="stat-label">Weapon</span><span class="stat-value">${String(e.weapon || '—').toUpperCase()}</span></div>
                <div class="stat-row stat-row-abilities"><span class="stat-label">Abilities</span><span class="stat-value cv-ability-chips">${
                    typeof abilityConfigManager !== 'undefined'
                        ? abilityConfigManager.formatAbilityChipsHtml(abilities)
                        : (abilities.length ? abilities.join(', ') : '—')
                }</span></div>
            </div>
        `;
        const hero = root.querySelector('#evHeroCanvas');
        this.paintShipIcon(hero, e.id);
        if (this._devToggles) this._devToggles.refresh();
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const e = this.enemies[this.selectedIndex];
            menuStateManager.setScreen('enemy-viewer', { enemyType: e ? e.id : 'enemyBasic' });
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
                this.resetPreviewSim();
                this.persist();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.selectedIndex = Math.min(this.enemies.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
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
        const enemy = this.enemies[this.selectedIndex];
        if (!enemy || typeof enemyEditorUI === 'undefined') return;
        this.hide();
        enemyEditorUI.show(enemy.id, undefined, false, { returnTo: 'enemy-viewer' });
    }

    openGfxEditor() {
        const enemy = this.enemies[this.selectedIndex];
        if (!enemy || typeof componentEditorUI === 'undefined') return;
        let type = 'enemy';
        let id = enemy.id;
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(enemy.id)
                || assetGenRegistry.findByKey('enemy-' + String(enemy.id).replace(/^enemy[-_]?/, ''));
            if (hit) {
                type = hit.type;
                id = hit.id;
            }
        }
        const returnCb = this.onClose;
        this.hide();
        componentEditorUI.open({
            type: type,
            id: id,
            returnTo: 'enemy-viewer',
            onClose: () => {
                this.show({ onClose: returnCb });
            }
        });
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
                focusExplore: 'enemies',
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

const enemyViewerUI = new EnemyViewerUI();
