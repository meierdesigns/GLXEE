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
}
