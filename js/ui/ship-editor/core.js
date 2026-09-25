"use strict";

/**
 * Ship Editor — stats, weapons, abilities, live preview.
 * Open: Ships viewer → EDIT / NEW, or Ctrl+Shift+S
 */
class ShipEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedType = 'player';
        this.activeTab = 'stats';
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewBaseWidth = 200;
        this.previewBaseHeight = 300;
        this.previewBackingScale = 1;
        this.previewZoom = 1;
        this.previewFullscreen = false;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewPanning = false;
        this.previewPanLastX = 0;
        this.previewPanLastY = 0;
        this.previewSim = null;
        this.previewLastTs = 0;
        this.draft = null;
        this.init();
    }

    init() {
        this.ensureOverlay();
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.visible) {
                if (this.previewFullscreen) {
                    e.preventDefault();
                    this.setPreviewFullscreen(false);
                    return;
                }
                this.hide();
            }
        });
    }

    ensureOverlay() {
        if (document.getElementById('shipEditorOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'shipEditorOverlay';
        overlay.className = 'planet-editor-overlay ship-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>SHIP EDITOR</h2>
                    <div class="planet-editor-selected" id="seSelectedLabel"></div>
                </div>
                <div class="planet-editor-tabs" id="seTabs">
                    <button type="button" data-tab="stats" class="pe-tab active">STATS</button>
                    <button type="button" data-tab="weapons" class="pe-tab">WEAPONS</button>
                    <button type="button" data-tab="abilities" class="pe-tab">ABILITIES</button>
                    <button type="button" data-tab="graphics" class="pe-tab">GRAPHICS</button>
                </div>
                <div class="planet-editor-body" id="seEditorBody">
                    <aside class="planet-editor-sidebar" id="seSidebar">
                        <div class="pe-sidebar-title">SHIPS</div>
                        <div class="pe-tree" id="seTypeSelect"></div>
                    </aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ship list"></div>
                    <div class="planet-editor-controls" id="seControls"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <div class="planet-editor-preview-wrap" id="sePreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="seZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="seZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="seZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="seZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="sePreviewFullscreen" title="Fullscreen">FULL</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="seRerollShape" title="Generate new part shapes">REROLL SHAPE</button>
                        </div>
                        <div class="pe-preview-viewport" id="sePreviewViewport">
                            <canvas id="sePreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">LIVE PREVIEW</div>
                    </div>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="seNew">NEW</button>
                    <button type="button" class="pe-btn" id="seReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="seSave">SAVE</button>
                    <button type="button" class="pe-btn" id="seClose">CLOSE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#seTabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            this.activeTab = btn.dataset.tab;
            this.renderTabs();
            this.renderControls();
            this.persistMenuState();
        });
        overlay.querySelector('#seSave').addEventListener('click', () => this.save());
        overlay.querySelector('#seReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#seNew').addEventListener('click', () => this.createNew());
        overlay.querySelector('#seClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#seZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#seZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#seZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#sePreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });
        overlay.querySelector('#seRerollShape').addEventListener('click', () => this.rerollHullShape());

        const viewport = overlay.querySelector('#sePreviewViewport');
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = e.deltaY < 0 ? 0.1 : -0.1;
            this.setPreviewZoom(this.previewZoom + step);
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
        window.addEventListener('mousemove', (e) => {
            if (!this.previewPanning) return;
            const dx = e.clientX - this.previewPanLastX;
            const dy = e.clientY - this.previewPanLastY;
            this.previewPanLastX = e.clientX;
            this.previewPanLastY = e.clientY;
            this.previewPanX += dx;
            this.previewPanY += dy;
            this.applyPreviewView();
        });
        const endPan = () => {
            if (!this.previewPanning) return;
            this.previewPanning = false;
            const vp = document.getElementById('sePreviewViewport');
            if (vp) vp.classList.remove('pe-panning');
        };
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 || this.previewPanning) endPan();
        });
        window.addEventListener('blur', endPan);
        window.addEventListener('resize', () => {
            if (this.visible) this.applyPreviewView();
        });

        this.previewCanvas = overlay.querySelector('#sePreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.setupPanelResize(overlay);
        this.applyPreviewView();
    }

    setupPanelResize(overlay) {
        const body = overlay.querySelector('#seEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: overlay,
            storageKey: 'sePanelWidths',
            defaults: { left: 200, right: 280 },
            mins: { left: 140, right: 180, center: 200 },
            onChange: () => {
                if (this.visible) this.applyPreviewView();
            }
        });
    }

    setPreviewZoom(zoom) {
        this.previewZoom = Math.min(3, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    }

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    }

    /** Picks a new random per-part shape combination for the ship being edited. */
    rerollHullShape() {
        if (typeof profileManager === 'undefined' || !profileManager.setHullShapeSeed) return;
        const shipId = this.selectedType;
        if (!shipId) return;
        const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        profileManager.setHullShapeSeed(shipId, seed);
        // Animation loop repaints every frame; no forced redraw needed.
    }

    applyPreviewView() {
        const wrap = document.getElementById('sePreviewWrap');
        const label = document.getElementById('seZoomLabel');
        const fsBtn = document.getElementById('sePreviewFullscreen');
        const viewport = document.getElementById('sePreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewBaseWidth / this.previewBaseHeight;
            let fitW = availW;
            let fitH = fitW / aspect;
            if (fitH > availH) {
                fitH = availH;
                fitW = fitH * aspect;
            }
            const cssW = fitW * this.previewZoom;
            const cssH = fitH * this.previewZoom;
            const dpr = window.devicePixelRatio || 1;
            // Bake zoom into the canvas backing store so pixel art is regenerated
            // crisp at the target resolution instead of CSS-stretching a fixed bitmap.
            this.previewBackingScale = (cssW * dpr) / this.previewBaseWidth;
            const backingW = Math.max(1, Math.round(this.previewBaseWidth * this.previewBackingScale));
            const backingH = Math.max(1, Math.round(this.previewBaseHeight * this.previewBackingScale));
            if (this.previewCanvas.width !== backingW || this.previewCanvas.height !== backingH) {
                this.previewCanvas.width = backingW;
                this.previewCanvas.height = backingH;
            }
            this.previewCanvas.style.width = `${Math.round(cssW)}px`;
            this.previewCanvas.style.height = `${Math.round(cssH)}px`;
            this.previewCanvas.style.transform = `translate(${this.previewPanX}px, ${this.previewPanY}px)`;
        }
    }

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('ship-editor', {
                shipId: this.selectedType,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    }

    toggle() {
        if (this.visible) this.hide();
        else this.show();
    }
}
