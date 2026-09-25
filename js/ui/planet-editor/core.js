"use strict";

/**
 * Planet Editor — multi-layer BG, obstacles, side enemies, graphics.
 * Open: Planets viewer → EDIT, or Ctrl+Shift+P
 */
class PlanetEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedPlanet = 'mars';
        this.activeTab = 'background';
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
        this.draft = null;
        this.draftBaseline = null;
        this.galaxyColorBaseline = null;
        this.unsavedDialog = null;
        this.expandedLayerIndex = 0;
        this.patternModalLayer = null;
        this.patternEditor = null;
        this.expandedGalaxies = { milky_way: true, andromeda: true };
        this.objectiveScope = 'planet';
        this.objectiveStageKey = '1';
        this.sidebarLeftW = 200;
        this.sidebarRightW = 280;
        this.resizingSide = null;
        this.init();
    }

    init() {
        this.ensureOverlay();
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                this.toggle();
            }
            if (!this.visible) return;
            if (this.unsavedDialog) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.resolveUnsavedDialog('save');
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.resolveUnsavedDialog('discard');
                    return;
                }
                return;
            }
            if (e.key === 'Escape') {
                if (this.closePatternEditor()) {
                    e.preventDefault();
                    return;
                }
                if (this.closePatternModal()) {
                    e.preventDefault();
                    return;
                }
                if (this.previewFullscreen) {
                    e.preventDefault();
                    this.setPreviewFullscreen(false);
                    return;
                }
                e.preventDefault();
                this.requestClose();
            }
        });
    }

    ensureOverlay() {
        if (document.getElementById('planetEditorOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'planetEditorOverlay';
        overlay.className = 'planet-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>PLANET EDITOR</h2>
                    <div class="planet-editor-selected" id="peSelectedLabel"></div>
                </div>
                <div class="planet-editor-tabs" id="peTabs">
                    <button type="button" data-tab="background" class="pe-tab active">BACKGROUND</button>
                    <button type="button" data-tab="level" class="pe-tab">LEVEL</button>
                    <button type="button" data-tab="obstacles" class="pe-tab">OBSTACLES</button>
                    <button type="button" data-tab="enemies" class="pe-tab">ENEMIES</button>
                    <button type="button" data-tab="objectives" class="pe-tab">OBJECTIVES</button>
                    <button type="button" data-tab="graphics" class="pe-tab">GRAPHICS</button>
                </div>
                <div class="planet-editor-body" id="peEditorBody">
                    <aside class="planet-editor-sidebar" id="peSidebar">
                        <div class="pe-sidebar-title">GALAXIES</div>
                        <div class="pe-tree" id="pePlanetTree"></div>
                    </aside>
                    <div class="pe-resize-handle" id="peResizeLeft" data-resize="left" title="Resize left sidebar"></div>
                    <div class="planet-editor-controls" id="peControls"></div>
                    <div class="pe-resize-handle" id="peResizeRight" data-resize="right" title="Resize right sidebar"></div>
                    <div class="planet-editor-preview-wrap" id="pePreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="peZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="peZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="peZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="peZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="pePreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="pePreviewViewport">
                            <canvas id="pePreview" width="240" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">LIVE PREVIEW</div>
                    </div>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="peApplyAllLayers">BG −50%</button>
                    <button type="button" class="pe-btn" id="peReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="peSave">SAVE</button>
                    <button type="button" class="pe-btn" id="peClose">CLOSE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const tree = overlay.querySelector('#pePlanetTree');
        tree.addEventListener('click', (e) => {
            const delBtn = e.target.closest('[data-delete-planet]');
            if (delBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.deletePlanetFromTree(delBtn.getAttribute('data-delete-planet'));
                return;
            }
            const addBtn = e.target.closest('[data-add-planet]');
            if (addBtn) {
                e.preventDefault();
                this.addPlanetToGalaxy(addBtn.getAttribute('data-add-planet'));
                return;
            }
            const toggle = e.target.closest('[data-galaxy-toggle]');
            if (toggle) {
                const gid = toggle.getAttribute('data-galaxy-toggle');
                this.expandedGalaxies[gid] = !this.expandedGalaxies[gid];
                this.renderPlanetTree();
                return;
            }
            const planetBtn = e.target.closest('[data-planet-id]');
            if (!planetBtn) return;
            this.selectPlanet(planetBtn.getAttribute('data-planet-id'));
        });

        overlay.querySelector('#peTabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            this.activeTab = btn.dataset.tab;
            this.renderTabs();
            this.renderControls();
            this.persistMenuState();
        });
        overlay.querySelector('#peSave').addEventListener('click', () => this.save());
        overlay.querySelector('#peReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#peClose').addEventListener('click', () => this.requestClose());
        overlay.querySelector('#peApplyAllLayers').addEventListener('click', () => this.halveAllLayerOpacity());
        overlay.querySelector('#peZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#peZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#peZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#pePreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#pePreviewViewport');
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
            const vp = document.getElementById('pePreviewViewport');
            if (vp) vp.classList.remove('pe-panning');
        };
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 || this.previewPanning) endPan();
        });
        window.addEventListener('blur', endPan);

        this.previewCanvas = overlay.querySelector('#pePreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.setupSidebarResize(overlay);
        this.applyPreviewView();
    }

    setupSidebarResize(overlay) {
        const body = overlay.querySelector('#peEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: overlay,
            storageKey: 'peSidebarWidths',
            defaults: { left: this.sidebarLeftW, right: this.sidebarRightW },
            mins: { left: 140, right: 180, center: 220 },
            onChange: (w) => {
                this.sidebarLeftW = w.left;
                this.sidebarRightW = w.right;
                if (this.visible) this.applyPreviewView();
            }
        });
    }

    applySidebarWidths() {
        if (this._panelResize) {
            this._panelResize.setWidths({ left: this.sidebarLeftW, right: this.sidebarRightW });
            return;
        }
        const body = document.getElementById('peEditorBody');
        if (!body) return;
        body.style.setProperty('--pe-left-w', `${this.sidebarLeftW}px`);
        body.style.setProperty('--pe-right-w', `${this.sidebarRightW}px`);
    }

    setPreviewZoom(zoom) {
        this.previewZoom = Math.min(4, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    }

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    }
}
