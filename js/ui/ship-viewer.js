"use strict";

/**
 * Ship Viewer — browse player ships; open Ship Editor from here.
 * Open: Start menu → SHIPS
 */
class ShipViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.ships = [];
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

    getShipList() {
        if (typeof shipConfigManager === 'undefined') {
            return [
                { id: 'player', name: 'STARFIGHTER', description: '', maxHealth: 80, armor: 15, damage: 25, speed: 5, weapon: 'laser' },
                { id: 'player_interceptor', name: 'INTERCEPTOR', description: '', maxHealth: 60, armor: 8, damage: 18, speed: 6, weapon: 'rapid' },
                { id: 'player_heavy', name: 'HEAVY FIGHTER', description: '', maxHealth: 150, armor: 40, damage: 45, speed: 2.5, weapon: 'spread' },
                { id: 'player_assault', name: 'ASSAULT', description: '', maxHealth: 120, armor: 25, damage: 35, speed: 3.5, weapon: 'laser' }
            ];
        }
        let ids = shipConfigManager.getTypeIds();
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const allowed = {};
            profileManager.getDiscovered('ships').forEach((id) => { allowed[id] = true; });
            profileManager.getOwnedShipIds().forEach((id) => { allowed[id] = true; });
            ids = ids.filter((id) => !!allowed[id]);
        }
        return ids.map((id) => {
            const cfg = shipConfigManager.getConfig(id);
            return {
                id: id,
                name: shipConfigManager.getDisplayName(id) || (cfg && cfg.name) || id,
                description: (cfg && cfg.description) || '',
                maxHealth: (cfg && cfg.maxHealth) || 0,
                armor: (cfg && cfg.armor) || 0,
                damage: (cfg && cfg.damage) || 0,
                speed: (cfg && cfg.speed) || 0,
                weapon: (cfg && cfg.defaultWeapon) || '—',
                weaponCooldown: (cfg && cfg.weaponCooldown) || 300,
                weaponSpeed: (cfg && cfg.weaponSpeed) || 8,
                custom: !!(cfg && cfg.custom)
            };
        });
    }

    getShipModel(typeId) {
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
            const model = shipConfigManager.getMergedModel(typeId);
            if (model) return model;
        }
        return {
            name: typeId,
            type: 'player',
            modelClass: 'starfighter',
            width: 20,
            height: 16,
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

    paintShipIcon(canvas, typeId) {
        if (!canvas) return;
        const ship = this.getShipModel(typeId);
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            shipRenderer.renderShipPreview(canvas, ship, 1);
        }
        const spriteName = typeof shipRenderer !== 'undefined' && shipRenderer.getSpriteNameForShip
            ? shipRenderer.getSpriteNameForShip(ship)
            : null;
        if (spriteName) canvas.setAttribute('data-ag-key', spriteName);
        else if (typeId) canvas.setAttribute('data-ag-key', String(typeId));
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
        }
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.ships = this.getShipList();
        if (!this.ships.length) return;
        const preferId = options && options.shipId;
        if (preferId) {
            const idx = this.ships.findIndex((s) => s.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.ships.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('ship-viewer', {
                shipId: this.ships[this.selectedIndex].id
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
                <h2 class="content-viewer-title">SHIPS</h2>
                <div class="content-viewer-body has-preview" id="svViewerBody">
                    <aside class="content-viewer-list" id="svList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ship list"></div>
                    <div class="content-viewer-detail" id="svDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="svPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="svZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="svZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="svZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="svZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="svPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="svPreviewViewport">
                            <canvas id="svPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="svNew">NEW</button>
                    <button type="button" class="pe-btn pe-primary" id="svEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="svEditGfx">EDIT GFX</button>
                    <button type="button" class="pe-btn" id="svDelete">DELETE</button>
                    <button type="button" class="pe-btn" id="svClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">↑↓ Navigate • N New • E Edit • DEL Delete • ESC Close</div>
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

        this.overlay.querySelector('#svNew').addEventListener('click', () => this.createNew());
        this.overlay.querySelector('#svEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#svEditGfx').addEventListener('click', () => this.openGfxEditor());
        this.overlay.querySelector('#svDelete').addEventListener('click', () => this.deleteSelected());
        this.overlay.querySelector('#svClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const s = this.ships[this.selectedIndex];
                return !!(s && profileManager.isDiscovered('ships', s.id));
            },
            toggleKnown: () => {
                const s = this.ships[this.selectedIndex];
                if (s) profileManager.toggleDiscovered('ships', s.id);
            },
            owned: () => {
                const s = this.ships[this.selectedIndex];
                return !!(s && profileManager.ownsShip(s.id));
            },
            toggleOwned: () => {
                const s = this.ships[this.selectedIndex];
                if (s) profileManager.toggleOwnedShip(s.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#svViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'svPanelWidths',
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
        this.previewCanvas = overlay.querySelector('#svPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#svZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#svZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#svZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#svPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#svPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#svPreviewViewport');
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
        const wrap = this.overlay && this.overlay.querySelector('#svPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#svZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#svPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#svPreviewViewport');
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
        const loop = (ts) => {
            if (!this.visible) return;
            if (!this.previewLastTs) this.previewLastTs = ts;
            const dt = Math.min(50, ts - this.previewLastTs);
            this.previewLastTs = ts;
            this.updatePreviewSim(dt);
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
        const s = this.ships[this.selectedIndex];
        const model = this.getShipModel(s ? s.id : 'player');
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        this.previewSim = {
            player: {
                x: 100 - shipW / 2,
                y: 250,
                width: shipW,
                height: shipH,
                dir: 1
            },
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const s = this.ships[this.selectedIndex];
        if (!sim || !s) return;
        const frameScale = dtMs / 16.67;
        const model = this.getShipModel(s.id);
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        const p = sim.player;
        p.width = shipW;
        p.height = shipH;
        const speed = Math.max(0.5, Number(s.speed) || 4) * 0.35;
        p.x += p.dir * speed * frameScale;
        if (p.x <= 8 || p.x + p.width >= 192) {
            p.dir *= -1;
            p.x = Math.max(8, Math.min(192 - p.width, p.x));
        }
        p.y = 250 + Math.sin(sim.starPhase * 1.5) * 3;
        sim.starPhase += dtMs * 0.004;

        sim.shootAcc += dtMs;
        const cooldown = Math.max(80, Number(s.weaponCooldown) || 300);
        if (sim.shootAcc >= cooldown) {
            sim.shootAcc = 0;
            const bulletSpeed = Math.max(2, Number(s.weaponSpeed) || 8);
            sim.bullets.push({
                x: p.x + p.width / 2 - 1,
                y: p.y - 4,
                vy: -bulletSpeed,
                life: 1200
            });
        }
        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y > -10;
        });
    }

    drawPreview() {
        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        const sim = this.previewSim;
        const s = this.ships[this.selectedIndex];
        if (!ctx || !canvas || !sim || !s) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,140,40,0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 47 + sim.starPhase * 20) % w;
            const sy = (i * 73 + sim.starPhase * 8) % h;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.strokeStyle = 'rgba(255,140,40,0.15)';
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        sim.bullets.forEach((b) => {
            ctx.fillStyle = '#ffaa44';
            ctx.fillRect(b.x, b.y, 2, 6);
        });

        const model = this.getShipModel(s.id);
        const p = sim.player;
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, p.width);
            tmp.height = Math.max(1, p.height);
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, p.x, p.y, p.width, p.height);
        } else {
            ctx.fillStyle = '#ff8c28';
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.fillStyle = 'rgba(255,140,40,0.85)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(s.name || 'SHIP', 8, 14);
        ctx.fillText(`SPD ${s.speed}`, 8, 28);
        ctx.fillText(`HP ${s.maxHealth}`, 8, 42);
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#svList');
        if (!list) return;
        list.innerHTML = '';
        this.ships.forEach((ship, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            btn.innerHTML =
                `<canvas class="cv-icon cv-ship-icon" width="32" height="32" data-ship="${ship.id}"></canvas>` +
                `<span class="cv-item-label">${ship.name}${ship.custom ? ' *' : ''}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? devProfileToggles.badgesHtml({
                        known: profileManager.isDiscovered('ships', ship.id),
                        owned: profileManager.ownsShip(ship.id)
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
            this.paintShipIcon(canvas, ship.id);
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        this.updateDeleteButton();
    }

    statIconHtml(key, size) {
        const px = size || 16;
        if (typeof iconRenderer !== 'undefined') {
            const html = iconRenderer.imgHtml(key, px, 'cv-stat-icon-img');
            if (html) return html;
        }
        return '';
    }

    weaponIconKey(weapon) {
        const w = String(weapon || '').toLowerCase();
        const map = {
            laser: 'shotLaser',
            rapid: 'shotRapid',
            spread: 'shotSpread',
            plasma: 'shotPlasma',
            missile: 'shotMissile',
            ion: 'shotIon',
            wave: 'shotWave',
            burst: 'shotBurst',
            pierce: 'shotPierce',
            nova: 'shotNova'
        };
        return map[w] || 'statWeapon';
    }

    statRowHtml(iconKey, label, value, extraClass, valueClass) {
        const icon = this.statIconHtml(iconKey, 16);
        const cls = extraClass ? ` ${extraClass}` : '';
        const vCls = valueClass ? ` ${valueClass}` : '';
        return `<div class="stat-row${cls}">` +
            `<span class="stat-label"><span class="cv-stat-icon">${icon}</span>${label}</span>` +
            `<span class="stat-value${vCls}">${value}</span>` +
            `</div>`;
    }

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#svDetail');
        const s = this.ships[this.selectedIndex];
        if (!root || !s) return;
        const cfg = typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(s.id) : null;
        const abilities = (cfg && cfg.abilities) || [];
        const abilityChips = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.formatAbilityChipsHtml(abilities)
            : (abilities.length ? abilities.join(', ') : '—');
        const weaponKey = this.weaponIconKey(s.weapon);
        root.innerHTML = `
            <div class="content-viewer-hero cv-ship-hero">
                <canvas class="cv-ship-preview" width="64" height="64" id="svHeroCanvas"></canvas>
                <div class="cv-ship-hero-text">
                    <h3 class="content-viewer-name">${s.name}</h3>
                    <p class="content-viewer-desc">${s.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats cv-stat-clusters">
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Defense</div>
                    ${this.statRowHtml('statHealth', 'Health', s.maxHealth)}
                    ${this.statRowHtml('statArmor', 'Armor', s.armor)}
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Combat</div>
                    ${this.statRowHtml('statDamage', 'Damage', s.damage)}
                    ${this.statRowHtml(weaponKey, 'Weapon', String(s.weapon || '—').toUpperCase())}
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Mobility</div>
                    ${this.statRowHtml('statSpeed', 'Speed', s.speed)}
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Abilities</div>
                    ${this.statRowHtml('statAbilities', 'Abilities', abilityChips, 'stat-row-abilities', 'cv-ability-chips')}
                </div>
            </div>
        `;
        const hero = root.querySelector('#svHeroCanvas');
        this.paintShipIcon(hero, s.id);
        this.updateDeleteButton();
        if (this._devToggles) this._devToggles.refresh();
    }

    updateDeleteButton() {
        const btn = this.overlay && this.overlay.querySelector('#svDelete');
        const s = this.ships[this.selectedIndex];
        if (!btn) return;
        btn.disabled = !(s && s.custom);
        btn.style.opacity = btn.disabled ? '0.4' : '1';
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const s = this.ships[this.selectedIndex];
            menuStateManager.setScreen('ship-viewer', { shipId: s ? s.id : 'player' });
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
                this.selectedIndex = Math.min(this.ships.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                this.createNew();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.deleteSelected();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    createNew() {
        if (typeof shipConfigManager === 'undefined') return;
        const current = this.ships[this.selectedIndex];
        const ship = shipConfigManager.createShip({
            baseId: current ? current.id : 'player',
            name: 'New Ship'
        });
        this.ships = this.getShipList();
        const idx = this.ships.findIndex((s) => s.id === ship.id);
        this.selectedIndex = idx >= 0 ? idx : this.ships.length - 1;
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
        this.openEditor();
    }

    deleteSelected() {
        const ship = this.ships[this.selectedIndex];
        if (!ship || !ship.custom || typeof shipConfigManager === 'undefined') return;
        shipConfigManager.deleteShip(ship.id);
        this.ships = this.getShipList();
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.ships.length - 1));
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
    }

    openEditor() {
        const ship = this.ships[this.selectedIndex];
        if (!ship || typeof shipEditorUI === 'undefined') return;
        this.hide();
        shipEditorUI.show(ship.id, undefined, false, { returnTo: 'ship-viewer' });
    }

    openGfxEditor() {
        const ship = this.ships[this.selectedIndex];
        if (!ship || typeof componentEditorUI === 'undefined') return;
        let type = 'ship';
        let id = ship.id;
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(ship.id)
                || assetGenRegistry.findByKey(String(ship.id).replace(/_/g, '-'));
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
            returnTo: 'ship-viewer',
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
                focusExplore: 'ships',
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

const shipViewerUI = new ShipViewerUI();
