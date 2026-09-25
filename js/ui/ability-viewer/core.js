"use strict";

/**
 * Ability Viewer — browse shared abilities; open Ability Editor from here.
 * Open: Start menu → ABILITIES
 */
class AbilityViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.abilities = [];
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
    }

    getAbilityList() {
        if (typeof abilityConfigManager === 'undefined') return [];
        const grouped = abilityConfigManager.getIdsByCluster();
        const list = [];
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        const allowed = {};
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            profileManager.getDiscovered('abilities').forEach((id) => { allowed[id] = true; });
        }
        const filterDiscovery = !devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
        abilityConfigManager.clusterOrder.forEach((cluster) => {
            const ids = grouped[cluster.id] || [];
            ids.forEach((id) => {
                if (filterDiscovery && !allowed[id]) return;
                const a = abilityConfigManager.getAbility(id);
                list.push({
                    id: a.id,
                    name: a.name,
                    description: a.description,
                    icon: a.icon,
                    cluster: a.cluster,
                    clusterLabel: abilityConfigManager.getClusterLabel(a.cluster),
                    type: a.type,
                    tier: a.tier,
                    uiDescription: a.uiDescription,
                    custom: !!a.custom
                });
            });
        });
        return list;
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.abilities = this.getAbilityList();
        if (!this.abilities.length) return;
        const preferId = options && options.abilityId;
        if (preferId) {
            const idx = this.abilities.findIndex((a) => a.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.abilities.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('ability-viewer', {
                abilityId: this.abilities[this.selectedIndex].id
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

    themeColor() {
        if (typeof iconRenderer !== 'undefined' && iconRenderer.getThemeTint) {
            return iconRenderer.getThemeTint() || '#80ff80';
        }
        return '#80ff80';
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
                <h2 class="content-viewer-title">ABILITIES</h2>
                <div class="content-viewer-body has-preview" id="avViewerBody">
                    <aside class="content-viewer-list" id="avList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ability list"></div>
                    <div class="content-viewer-detail" id="avDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="avPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="avZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="avZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="avZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="avZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="avPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="avPreviewViewport">
                            <canvas id="avPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="avNew">NEW</button>
                    <button type="button" class="pe-btn pe-primary" id="avEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="avEditGfx">EDIT GFX</button>
                    <button type="button" class="pe-btn" id="avDelete">DELETE</button>
                    <button type="button" class="pe-btn" id="avClose">CLOSE</button>
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

        this.overlay.querySelector('#avNew').addEventListener('click', () => this.createNew());
        this.overlay.querySelector('#avEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#avEditGfx').addEventListener('click', () => this.openGfxEditor());
        this.overlay.querySelector('#avDelete').addEventListener('click', () => this.deleteSelected());
        this.overlay.querySelector('#avClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const a = this.abilities[this.selectedIndex];
                return !!(a && profileManager.isDiscovered('abilities', a.id));
            },
            toggleKnown: () => {
                const a = this.abilities[this.selectedIndex];
                if (a) profileManager.toggleDiscovered('abilities', a.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#avViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'avPanelWidths',
            defaults: { left: 240, right: 260 },
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
        this.previewCanvas = overlay.querySelector('#avPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#avZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#avZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#avZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#avPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#avPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#avPreviewViewport');
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
}
