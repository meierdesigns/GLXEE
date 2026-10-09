"use strict";

/**
 * Enemy Editor — stats, behavior, weapons, armor, live preview.
 * Open: Enemies viewer → EDIT, or Ctrl+Shift+E
 */
class EnemyEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedType = 'enemyBasic';
        this.activeTab = 'stats';
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewBaseWidth = 360;
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

    previewPlayfieldSize() {
        let w = 360;
        let h = 300;
        try {
            const root = getComputedStyle(document.documentElement);
            const cw = parseFloat(root.getPropertyValue('--map-w'));
            const ch = parseFloat(root.getPropertyValue('--map-h'));
            if (Number.isFinite(cw) && cw > 0) w = Math.round(cw);
            if (Number.isFinite(ch) && ch > 0) h = Math.round(ch);
        } catch (_) { /* keep defaults */ }
        if (typeof game !== 'undefined' && game) {
            const gw = game.internalWidth || game.baseWidth || game.width;
            const gh = game.internalHeight || game.baseHeight || game.height;
            if (Number.isFinite(gw) && gw > 0) w = Math.round(gw);
            if (Number.isFinite(gh) && gh > 0) h = Math.round(gh);
        }
        this.previewBaseWidth = w;
        this.previewBaseHeight = h;
        return { w, h };
    }

    init() {
        this.ensureOverlay();
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
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
        if (document.getElementById('enemyEditorOverlay')) {
            const tabs = document.getElementById('eeTabs');
            if (tabs && !tabs.querySelector('[data-tab="armor"]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-tab';
                btn.dataset.tab = 'armor';
                btn.textContent = 'ARMOR';
                tabs.appendChild(btn);
            }
            if (tabs && !tabs.querySelector('[data-tab="abilities"]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-tab';
                btn.dataset.tab = 'abilities';
                btn.textContent = 'ABILITIES';
                tabs.appendChild(btn);
            }
            if (tabs && !tabs.querySelector('[data-tab="deploy"]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-tab';
                btn.dataset.tab = 'deploy';
                btn.textContent = 'DEPLOY';
                tabs.appendChild(btn);
            }
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'enemyEditorOverlay';
        overlay.className = 'planet-editor-overlay enemy-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>ENEMY EDITOR</h2>
                    <div class="planet-editor-selected" id="eeSelectedLabel"></div>
                </div>
                <div class="planet-editor-tabs" id="eeTabs">
                    <button type="button" data-tab="stats" class="pe-tab active">STATS</button>
                    <button type="button" data-tab="behavior" class="pe-tab">BEHAVIOR</button>
                    <button type="button" data-tab="weapons" class="pe-tab">WEAPONS</button>
                    <button type="button" data-tab="armor" class="pe-tab">ARMOR</button>
                    <button type="button" data-tab="abilities" class="pe-tab">ABILITIES</button>
                    <button type="button" data-tab="deploy" class="pe-tab">DEPLOY</button>
                </div>
                <div class="planet-editor-body" id="eeEditorBody">
                    <aside class="planet-editor-sidebar" id="eeSidebar">
                        <div class="pe-sidebar-title">ENEMIES</div>
                        <div class="pe-tree" id="eeTypeSelect"></div>
                    </aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize enemy list"></div>
                    <div class="planet-editor-controls" id="eeControls"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <div class="planet-editor-preview-wrap" id="eePreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="eeZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="eeZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="eeZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="eeZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="eePreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="eePreviewViewport">
                            <canvas id="eePreview" width="360" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">LIVE PREVIEW</div>
                    </div>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="eeReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="eeSave">SAVE</button>
                    <button type="button" class="pe-btn" id="eeClose">CLOSE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#eeTabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            this.activeTab = btn.dataset.tab;
            this.renderTabs();
            this.renderControls();
            this.persistMenuState();
        });
        overlay.querySelector('#eeSave').addEventListener('click', () => this.save());
        overlay.querySelector('#eeReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#eeClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#eeZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#eeZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#eeZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#eePreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#eePreviewViewport');
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
            const dx = vfPanDelta(this.previewCanvas, e.clientX - this.previewPanLastX);
            const dy = vfPanDelta(this.previewCanvas, e.clientY - this.previewPanLastY);
            this.previewPanLastX = e.clientX;
            this.previewPanLastY = e.clientY;
            this.previewPanX += dx;
            this.previewPanY += dy;
            this.applyPreviewView();
        });
        const endPan = () => {
            if (!this.previewPanning) return;
            this.previewPanning = false;
            const vp = document.getElementById('eePreviewViewport');
            if (vp) vp.classList.remove('pe-panning');
        };
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 || this.previewPanning) endPan();
        });
        window.addEventListener('blur', endPan);
        window.addEventListener('resize', () => {
            if (this.visible) this.applyPreviewView();
        });

        this.previewCanvas = overlay.querySelector('#eePreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.setupPanelResize(overlay);
        this.applyPreviewView();
    }

    setupPanelResize(overlay) {
        const body = overlay.querySelector('#eeEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: overlay,
            storageKey: 'eePanelWidths',
            defaults: { left: 200, right: 360 },
            mins: { left: 140, right: 220, center: 200 },
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

    applyPreviewView() {
        const wrap = document.getElementById('eePreviewWrap');
        const label = document.getElementById('eeZoomLabel');
        const fsBtn = document.getElementById('eePreviewFullscreen');
        const viewport = document.getElementById('eePreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            this.previewPlayfieldSize();
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
            menuStateManager.setScreen('enemy-editor', {
                enemyType: this.selectedType,
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
