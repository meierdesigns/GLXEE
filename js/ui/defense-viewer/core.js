"use strict";

/**
 * Defense Systems Viewer — browse defense-cluster abilities / mechanisms.
 * Open: Start menu → DEFENSE SYSTEMS
 */
class DefenseViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.items = [];
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

    getDefenseList() {
        if (typeof abilityConfigManager === 'undefined') return [];
        const list = [];
        const grouped = abilityConfigManager.getIdsByCluster();
        const ids = grouped.defense || [];
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        const allowed = {};
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            profileManager.getDiscovered('defenses').forEach((id) => { allowed[id] = true; });
        }
        const filterDiscovery = !devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
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
        return list;
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.items = this.getDefenseList();
        if (!this.items.length) return;
        const preferId = options && options.defenseId;
        if (preferId) {
            const idx = this.items.findIndex((a) => a.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.items.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('defense-viewer', {
                defenseId: this.items[this.selectedIndex].id
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
                <h2 class="content-viewer-title">DEFENSE SYSTEMS</h2>
                <div class="content-viewer-body has-preview" id="dvViewerBody">
                    <aside class="content-viewer-list" id="dvList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize defense list"></div>
                    <div class="content-viewer-detail" id="dvDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="dvPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="dvZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="dvZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="dvZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="dvZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="dvPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="dvPreviewViewport">
                            <canvas id="dvPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn pe-primary" id="dvEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="dvEditGfx">EDIT GFX</button>
                    <button type="button" class="pe-btn" id="dvClose">CLOSE</button>
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

        this.overlay.querySelector('#dvEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#dvEditGfx').addEventListener('click', () => this.openGfxEditor());
        this.overlay.querySelector('#dvClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const a = this.items[this.selectedIndex];
                return !!(a && profileManager.isDiscovered('defenses', a.id));
            },
            toggleKnown: () => {
                const a = this.items[this.selectedIndex];
                if (a) profileManager.toggleDiscovered('defenses', a.id);
            },
            owned: () => {
                const a = this.items[this.selectedIndex];
                return !!(a && profileManager.getPartCount('defense', a.id) > 0);
            },
            toggleOwned: () => {
                const a = this.items[this.selectedIndex];
                if (a) profileManager.togglePartOwned('defense', a.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#dvViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'dvPanelWidths',
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
        this.previewCanvas = overlay.querySelector('#dvPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#dvZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#dvZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#dvZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#dvPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#dvPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#dvPreviewViewport');
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
