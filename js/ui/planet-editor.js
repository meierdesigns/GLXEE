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

    applyPreviewView() {
        const wrap = document.getElementById('pePreviewWrap');
        const label = document.getElementById('peZoomLabel');
        const fsBtn = document.getElementById('pePreviewFullscreen');
        const viewport = document.getElementById('pePreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            // Match playfield aspect (240×300 → 0.8), fill panel proportionally
            const aspect = this.previewCanvas.width / this.previewCanvas.height || 0.8;
            let fitW = availW;
            let fitH = fitW / aspect;
            if (fitH > availH) {
                fitH = availH;
                fitW = fitH * aspect;
            }
            this.previewCanvas.style.width = `${Math.round(fitW)}px`;
            this.previewCanvas.style.height = `${Math.round(fitH)}px`;
            this.previewCanvas.style.transform = `translate(${this.previewPanX}px, ${this.previewPanY}px) scale(${this.previewZoom})`;
        }
    }

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('planet-editor', {
                planet: this.selectedPlanet,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    }

    toggle() {
        if (this.visible) this.requestClose();
        else this.show();
    }

    show(planetId, tab, fromRestore, options) {
        this.ensureOverlay();
        if (planetId) this.selectedPlanet = String(planetId).toLowerCase();
        else if (typeof parallaxManager !== 'undefined' && parallaxManager.currentPlanet) {
            this.selectedPlanet = parallaxManager.currentPlanet;
        }
        if (tab) this.activeTab = tab;
        if (options && options.returnTo) this.returnTo = options.returnTo;
        else if (!fromRestore) this.returnTo = null;
        this.loadDraft();
        this.visible = true;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.syncAvailableEnemyTypes) {
            planetConfigManager.syncAvailableEnemyTypes();
        }
        document.getElementById('planetEditorOverlay').classList.remove('hidden');
        this.renderPlanetTree();
        this.renderTabs();
        this.renderControls();
        this.applyPreviewView();
        requestAnimationFrame(() => this.applyPreviewView());
        this.startPreview();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.applyForPlanet(this.selectedPlanet, null);
        }
        if (!fromRestore && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('planet-editor', {
                planet: this.selectedPlanet,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    }

    requestClose() {
        this.withUnsavedCheck(() => this.hide());
    }

    hide() {
        this.closeUnsavedDialog();
        this.visible = false;
        this.closePatternEditor();
        this.closePatternModal();
        this.setPreviewFullscreen(false);
        const el = document.getElementById('planetEditorOverlay');
        if (el) el.classList.add('hidden');
        this.stopPreview();
        if (typeof themeContextManager !== 'undefined') {
            const container = document.querySelector('.game-container');
            const inGame = container && container.style.display !== 'none';
            if (inGame && typeof coreLevelManager !== 'undefined' && coreLevelManager.getCurrentLevel) {
                themeContextManager.applyForLevel(coreLevelManager.getCurrentLevel());
            } else {
                themeContextManager.restoreAppTheme();
            }
        }
        const backTo = this.returnTo;
        this.returnTo = null;
        if (backTo === 'planet-viewer' && typeof planetViewerUI !== 'undefined') {
            planetViewerUI.show({ planetId: this.selectedPlanet });
            return;
        }
        if (typeof menuStateManager !== 'undefined') {
            const container = document.querySelector('.game-container');
            const inGame = container && container.style.display !== 'none';
            menuStateManager.setScreen(inGame ? 'ingame' : 'start');
        }
    }

    loadDraft() {
        if (typeof planetConfigManager === 'undefined') {
            this.draft = {
                id: this.selectedPlanet,
                backgroundLayers: [],
                obstacles: [],
                obstacleTypes: [],
                enemies: [],
                objective: { type: 'hunt' },
                stages: {},
                dailies: {},
                graphics: {},
                levelWidth: 240,
                levelHeight: 300,
                viewZoom: 1
            };
            this.expandedLayerIndex = 0;
            this.previewObstacles = [];
            this.previewObstacleSpawnAcc = 0;
            this.draftBaseline = JSON.stringify(this.draft);
            this.captureGalaxyColorBaseline();
            return;
        }
        const cfg = planetConfigManager.getConfig(this.selectedPlanet);
        this.draft = JSON.parse(JSON.stringify(cfg));
        const count = (this.draft.backgroundLayers || []).length;
        this.expandedLayerIndex = count > 0 ? 0 : null;
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        this.draftBaseline = JSON.stringify(this.draft);
        this.captureGalaxyColorBaseline();
        this.syncPreviewPlayfield();
    }

    captureGalaxyColorBaseline() {
        if (typeof planetConfigManager === 'undefined') {
            this.galaxyColorBaseline = null;
            return;
        }
        const galaxyId = (this.draft && this.draft.galaxyId)
            || planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
        const galaxy = planetConfigManager.getGalaxy(galaxyId);
        if (galaxy) planetConfigManager.migrateGalaxyThemeToBaseColor(galaxy);
        this.galaxyColorBaseline = {
            galaxyId,
            baseColor: galaxy ? (galaxy.baseColor || null) : null
        };
    }

    normalizeGalaxyColorValue(value) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.normalizeGalaxyBaseColor) {
            return planetConfigManager.normalizeGalaxyBaseColor(value);
        }
        return value == null || value === '' ? null : String(value).toUpperCase();
    }

    isGalaxyColorDirty() {
        if (!this.galaxyColorBaseline || typeof planetConfigManager === 'undefined') return false;
        const galaxyId = (this.draft && this.draft.galaxyId)
            || planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
        if (galaxyId !== this.galaxyColorBaseline.galaxyId) return false;
        const galaxy = planetConfigManager.getGalaxy(galaxyId);
        const current = galaxy ? (galaxy.baseColor || null) : null;
        return this.normalizeGalaxyColorValue(current)
            !== this.normalizeGalaxyColorValue(this.galaxyColorBaseline.baseColor);
    }

    isDraftDirty() {
        if (!this.draft || this.draftBaseline == null) return false;
        return JSON.stringify(this.draft) !== this.draftBaseline;
    }

    isDirty() {
        return this.isDraftDirty() || this.isGalaxyColorDirty();
    }

    discardChanges() {
        if (typeof planetConfigManager !== 'undefined' && this.galaxyColorBaseline) {
            const { galaxyId, baseColor } = this.galaxyColorBaseline;
            planetConfigManager.setGalaxyBaseColor(galaxyId, baseColor, { persist: false });
        }
        this.loadDraft();
        if (this.visible) {
            this.renderPlanetTree();
            this.renderControls();
            if (typeof themeContextManager !== 'undefined') {
                themeContextManager.applyForPlanet(this.selectedPlanet, null);
            }
        }
    }

    withUnsavedCheck(next) {
        if (typeof next !== 'function') return;
        if (this.unsavedDialog) return;
        if (!this.isDirty()) {
            next();
            return;
        }
        this.openUnsavedDialog(next);
    }

    openUnsavedDialog(onContinue) {
        this.closeUnsavedDialog();
        const overlay = document.getElementById('planetEditorOverlay');
        if (!overlay) {
            onContinue();
            return;
        }
        const modal = document.createElement('div');
        modal.id = 'peUnsavedModal';
        modal.className = 'pe-unsaved-modal';
        modal.innerHTML = `
            <div class="pe-unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="peUnsavedTitle">
                <h3 id="peUnsavedTitle">Unsaved changes</h3>
                <p class="pe-hint">Color / edits are previewed but not saved. Save or discard?</p>
                <div class="pe-unsaved-actions">
                    <button type="button" class="pe-btn pe-primary" data-unsaved="save">SAVE (Enter)</button>
                    <button type="button" class="pe-btn" data-unsaved="discard">DISCARD (Esc)</button>
                </div>
            </div>
        `;
        modal.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-unsaved]');
            if (!btn) return;
            this.resolveUnsavedDialog(btn.getAttribute('data-unsaved'));
        });
        overlay.appendChild(modal);
        this.unsavedDialog = { modal, onContinue };
        const saveBtn = modal.querySelector('[data-unsaved="save"]');
        if (saveBtn) saveBtn.focus();
    }

    resolveUnsavedDialog(action) {
        if (!this.unsavedDialog) return;
        const { onContinue } = this.unsavedDialog;
        this.closeUnsavedDialog();
        if (action === 'save') this.save();
        else this.discardChanges();
        if (typeof onContinue === 'function') onContinue();
    }

    closeUnsavedDialog() {
        if (!this.unsavedDialog) return;
        if (this.unsavedDialog.modal && this.unsavedDialog.modal.parentNode) {
            this.unsavedDialog.modal.remove();
        }
        this.unsavedDialog = null;
        return true;
    }

    selectPlanet(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id || id === this.selectedPlanet) return;
        this.withUnsavedCheck(() => this.selectPlanetNow(id));
    }

    selectPlanetNow(planetId) {
        this.selectedPlanet = planetId;
        const gid = typeof planetConfigManager !== 'undefined'
            ? planetConfigManager.getPlanetGalaxyId(planetId)
            : null;
        if (gid) this.expandedGalaxies[gid] = true;
        this.loadDraft();
        this.renderPlanetTree();
        this.renderControls();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.applyForPlanet(this.selectedPlanet, null);
        }
        this.persistMenuState();
    }

    addPlanetToGalaxy(galaxyId) {
        if (typeof planetConfigManager === 'undefined') return;
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid || !planetConfigManager.getGalaxy(gid)) return;
        // Blank planet: no prompt (blocked in some embeds), empty enemies/layers.
        const name = planetConfigManager.nextBlankPlanetName
            ? planetConfigManager.nextBlankPlanetName(gid)
            : 'NEW PLANET';
        const cfg = planetConfigManager.addPlanet({
            name,
            galaxyId: gid,
            blank: true,
            enemies: [],
            sideEnemies: [],
            backgroundLayers: [],
            obstacleTypes: [],
            obstacles: [],
            stages: {}
        });
        if (!cfg) return;
        this.expandedGalaxies[gid] = true;
        this.selectedPlanet = cfg.id;
        this.loadDraft();
        this.renderPlanetTree();
        this.renderControls();
        this.persistMenuState();
    }

    deletePlanetFromTree(planetId) {
        if (typeof planetConfigManager === 'undefined') return;
        const id = String(planetId || '').toLowerCase();
        if (!id) return;
        if (planetConfigManager.isBuiltinPlanet(id)) return;
        const cfg = planetConfigManager.getConfig(id);
        const label = (cfg && cfg.name) || id.toUpperCase();
        if (!window.confirm(`Delete planet "${label}"?`)) return;
        const galaxyId = planetConfigManager.getPlanetGalaxyId
            ? planetConfigManager.getPlanetGalaxyId(id)
            : (cfg && cfg.galaxyId);
        if (!planetConfigManager.deletePlanet(id)) return;

        if (this.selectedPlanet === id) {
            const tree = planetConfigManager.getGalaxyTree();
            let next = null;
            if (galaxyId) {
                const g = tree.find(t => t.id === galaxyId);
                if (g && g.planets.length) next = g.planets[0].id;
            }
            if (!next) {
                for (let i = 0; i < tree.length; i++) {
                    if (tree[i].planets && tree[i].planets.length) {
                        next = tree[i].planets[0].id;
                        break;
                    }
                }
            }
            this.selectedPlanet = next || 'mars';
            this.loadDraft();
            this.renderControls();
            if (typeof themeContextManager !== 'undefined') {
                themeContextManager.applyForPlanet(this.selectedPlanet, null);
            }
        }
        this.renderPlanetTree();
        this.persistMenuState();
    }

    renderPlanetTree() {
        const tree = document.getElementById('pePlanetTree');
        const label = document.getElementById('peSelectedLabel');
        if (!tree || typeof planetConfigManager === 'undefined') return;

        const galaxyTree = planetConfigManager.getGalaxyTree();
        const selectedCfg = planetConfigManager.getConfig(this.selectedPlanet);
        if (label) {
            const gName = (() => {
                const gid = planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
                const g = planetConfigManager.getGalaxy(gid);
                return g ? g.name : '';
            })();
            label.textContent = gName
                ? `${gName} / ${(selectedCfg && selectedCfg.name) || this.selectedPlanet.toUpperCase()}`
                : ((selectedCfg && selectedCfg.name) || this.selectedPlanet.toUpperCase());
        }

        tree.innerHTML = '';
        galaxyTree.forEach(galaxy => {
            const open = this.expandedGalaxies[galaxy.id] !== false;
            const group = document.createElement('div');
            group.className = 'pe-tree-galaxy' + (open ? ' open' : '');

            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'pe-tree-galaxy-btn';
            head.setAttribute('data-galaxy-toggle', galaxy.id);
            head.innerHTML =
                `<span class="pe-tree-caret">${open ? '▾' : '▸'}</span>` +
                `<span class="pe-tree-galaxy-name">${galaxy.name}</span>` +
                `<span class="pe-tree-count">${galaxy.planets.length}</span>`;
            group.appendChild(head);

            const list = document.createElement('div');
            list.className = 'pe-tree-planets';
            if (!open) list.hidden = true;

            if (!galaxy.planets.length) {
                const empty = document.createElement('div');
                empty.className = 'pe-tree-empty';
                empty.textContent = '— empty —';
                list.appendChild(empty);
            } else {
                galaxy.planets.forEach(planet => {
                    const row = document.createElement('div');
                    row.className = 'pe-tree-planet-row' +
                        (planet.id === this.selectedPlanet ? ' active' : '');

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'pe-tree-planet' + (planet.id === this.selectedPlanet ? ' active' : '');
                    btn.setAttribute('data-planet-id', planet.id);
                    btn.innerHTML =
                        `<span class="pe-tree-planet-name">${planet.name}</span>` +
                        (planet.difficulty
                            ? `<span class="pe-tree-planet-diff">${planet.difficulty}</span>`
                            : '');
                    row.appendChild(btn);

                    if (!planetConfigManager.isBuiltinPlanet(planet.id)) {
                        const delBtn = document.createElement('button');
                        delBtn.type = 'button';
                        delBtn.className = 'pe-tree-planet-delete';
                        delBtn.setAttribute('data-delete-planet', planet.id);
                        delBtn.title = 'Delete planet';
                        delBtn.textContent = '✕';
                        row.appendChild(delBtn);
                    }

                    list.appendChild(row);
                });
            }

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'pe-tree-add-planet';
            addBtn.setAttribute('data-add-planet', galaxy.id);
            addBtn.textContent = '+ PLANET';
            list.appendChild(addBtn);

            group.appendChild(list);
            tree.appendChild(group);
        });
    }

    renderTabs() {
        document.querySelectorAll('#peTabs .pe-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === this.activeTab);
        });
    }

    renderControls() {
        const root = document.getElementById('peControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        if (this.activeTab === 'background') this.renderBackgroundTab(root);
        else if (this.activeTab === 'level') this.renderLevelTab(root);
        else if (this.activeTab === 'obstacles') this.renderObstaclesTab(root);
        else if (this.activeTab === 'enemies') this.renderEnemiesTab(root);
        else if (this.activeTab === 'objectives') this.renderObjectivesTab(root);
        else if (this.activeTab === 'graphics') this.renderGraphicsTab(root);
    }

    renderBackgroundTab(root) {
        const starsRow = document.createElement('div');
        starsRow.className = 'pe-row';
        starsRow.innerHTML = `<label>Stars</label>`;
        const starsToggle = document.createElement('input');
        starsToggle.type = 'checkbox';
        starsToggle.checked = this.draft.starsEnabled !== false;
        starsToggle.addEventListener('change', () => {
            this.draft.starsEnabled = starsToggle.checked;
        });
        starsRow.appendChild(starsToggle);
        root.appendChild(starsRow);

        const starsOp = this.makeSlider('Stars opacity', this.draft.starsOpacity != null ? this.draft.starsOpacity : 0.35, 0, 1, 0.01, (v) => {
            this.draft.starsOpacity = v;
        });
        root.appendChild(starsOp);

        const layerList = document.createElement('div');
        layerList.className = 'pe-layer-list';

        (this.draft.backgroundLayers || []).forEach((layer, index) => {
            const collapsed = this.expandedLayerIndex !== index;
            const card = document.createElement('div');
            card.className = 'pe-layer-card' + (collapsed ? ' pe-layer-collapsed' : '');

            const header = document.createElement('div');
            header.className = 'pe-layer-header';

            const expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.className = 'pe-layer-expand';
            expandBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

            const toggle = document.createElement('span');
            toggle.className = 'pe-layer-toggle';
            toggle.textContent = collapsed ? '+' : '−';

            const title = document.createElement('span');
            title.className = 'pe-layer-title';
            title.textContent = `Layer ${index + 1}`;

            const summary = document.createElement('span');
            summary.className = 'pe-layer-summary';
            summary.textContent = layer.pattern || '—';

            expandBtn.appendChild(toggle);
            expandBtn.appendChild(title);
            expandBtn.appendChild(summary);
            expandBtn.addEventListener('click', () => {
                this.expandedLayerIndex = this.expandedLayerIndex === index ? null : index;
                this.renderControls();
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'pe-layer-delete';
            delBtn.title = 'Delete layer';
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.draft.backgroundLayers.splice(index, 1);
                const count = this.draft.backgroundLayers.length;
                if (count === 0) {
                    this.expandedLayerIndex = null;
                } else if (this.expandedLayerIndex === index) {
                    this.expandedLayerIndex = Math.min(index, count - 1);
                } else if (this.expandedLayerIndex != null && this.expandedLayerIndex > index) {
                    this.expandedLayerIndex -= 1;
                }
                this.renderControls();
            });

            header.appendChild(expandBtn);
            header.appendChild(delBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'pe-layer-body';

            const vis = document.createElement('label');
            vis.className = 'pe-inline';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = layer.visible !== false;
            cb.addEventListener('change', () => { layer.visible = cb.checked; });
            vis.appendChild(cb);
            vis.appendChild(document.createTextNode(' Visible'));
            body.appendChild(vis);

            body.appendChild(this.makePatternPicker(layer));

            body.appendChild(this.makeSlider('Opacity', layer.opacity != null ? layer.opacity : 0.15, 0, 1, 0.01, (v) => {
                layer.opacity = v;
            }));

            body.appendChild(this.makeSlider('Scale', layer.scale != null ? layer.scale : 1, 0.25, 3, 0.05, (v) => {
                layer.scale = v;
            }));

            body.appendChild(this.makeSlider('Speed', layer.speed != null ? layer.speed : 0.3, 0, 2, 0.05, (v) => {
                layer.speed = v;
            }));

            body.appendChild(this.makeSelect('Color', layer.colorSource || 'primary', planetConfigManager.colorSources, (v) => {
                layer.colorSource = v;
                this.renderControls();
            }));

            card.appendChild(body);
            layerList.appendChild(card);
        });

        root.appendChild(layerList);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'pe-btn';
        addBtn.textContent = '+ LAYER';
        addBtn.addEventListener('click', () => {
            this.draft.backgroundLayers.push({
                pattern: 'dots', speed: 0.3, opacity: 0.1, scale: 1, visible: true, colorSource: 'accent'
            });
            this.expandedLayerIndex = this.draft.backgroundLayers.length - 1;
            this.renderControls();
        });
        root.appendChild(addBtn);
    }

    renderLevelTab(root) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const minW = (pcm && pcm.minLevelWidth) || 160;
        const maxW = (pcm && pcm.maxLevelWidth) || 960;
        const minH = (pcm && pcm.minLevelHeight) || 200;
        const maxH = (pcm && pcm.maxLevelHeight) || 1200;
        const minZ = (pcm && pcm.minViewZoom) || 0.5;
        const maxZ = (pcm && pcm.maxViewZoom) || 3;
        const defW = (pcm && pcm.defaultLevelWidth) || 240;
        const defH = (pcm && pcm.defaultLevelHeight) || 300;
        const defZ = (pcm && pcm.defaultViewZoom) || 1;

        const hint = document.createElement('div');
        hint.className = 'pe-hint';
        hint.textContent = 'Map size = full playfield (always fully visible; larger map = automatic zoom-out). Content scale stays fixed for the whole mission (ships / multi-part bosses / obstacles).';
        root.appendChild(hint);

        root.appendChild(this.makeSlider(
            'Map width',
            this.draft.levelWidth != null ? this.draft.levelWidth : defW,
            minW, maxW, 10,
            (v) => {
                this.draft.levelWidth = Math.round(v);
                this.syncPreviewPlayfield();
            },
            true
        ));

        root.appendChild(this.makeSlider(
            'Map height',
            this.draft.levelHeight != null ? this.draft.levelHeight : defH,
            minH, maxH, 10,
            (v) => {
                this.draft.levelHeight = Math.round(v);
                this.syncPreviewPlayfield();
            },
            true
        ));

        root.appendChild(this.makeSlider(
            'Content scale',
            this.draft.viewZoom != null ? this.draft.viewZoom : defZ,
            minZ, maxZ, 0.05,
            (v) => {
                this.draft.viewZoom = Math.round(v * 100) / 100;
            }
        ));

        const scaleHint = document.createElement('div');
        scaleHint.className = 'pe-hint';
        scaleHint.textContent = 'Content scale enlarges ships, bosses and obstacles in world units. It does not change mid-fight and does not crop the map.';
        root.appendChild(scaleHint);

        const presets = document.createElement('div');
        presets.className = 'pe-row';
        presets.style.gap = '8px';
        presets.style.flexWrap = 'wrap';

        const makePreset = (label, w, h, z) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-btn';
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.draft.levelWidth = w;
                this.draft.levelHeight = h;
                this.draft.viewZoom = z;
                this.syncPreviewPlayfield();
                this.renderControls();
            });
            return btn;
        };

        presets.appendChild(makePreset('DEFAULT 240×300', defW, defH, 1));
        presets.appendChild(makePreset('WIDE 320×360', 320, 360, 1));
        presets.appendChild(makePreset('LARGE 480×600', 480, 600, 1));
        presets.appendChild(makePreset('BOSS ARENA 640×800', 640, 800, 1.25));
        root.appendChild(presets);

        const sizeLabel = document.createElement('div');
        sizeLabel.className = 'pe-hint';
        sizeLabel.style.marginTop = '8px';
        const lw = this.draft.levelWidth != null ? this.draft.levelWidth : defW;
        const lh = this.draft.levelHeight != null ? this.draft.levelHeight : defH;
        const vz = this.draft.viewZoom != null ? this.draft.viewZoom : defZ;
        const fitPct = Math.round((defW / Math.max(lw, 1)) * 100);
        sizeLabel.textContent = `Map ${lw}×${lh} · content ×${vz.toFixed(2)} · auto fit ~${fitPct}% vs default (whole map visible)`;
        root.appendChild(sizeLabel);
    }

    syncPreviewPlayfield() {
        if (!this.previewCanvas || !this.draft) return;
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const w = pcm && pcm.normalizeLevelWidth
            ? pcm.normalizeLevelWidth(this.draft.levelWidth)
            : Math.max(160, Math.min(960, Math.round(this.draft.levelWidth || 240)));
        const h = pcm && pcm.normalizeLevelHeight
            ? pcm.normalizeLevelHeight(this.draft.levelHeight)
            : Math.max(200, Math.min(1200, Math.round(this.draft.levelHeight || 300)));
        if (this.previewCanvas.width !== w || this.previewCanvas.height !== h) {
            this.previewCanvas.width = w;
            this.previewCanvas.height = h;
            this.previewCtx = this.previewCanvas.getContext('2d');
            if (this.previewCtx) this.previewCtx.imageSmoothingEnabled = false;
            this.previewObstacles = [];
        }
        this.applyPreviewView();
    }

    renderObstaclesTab(root) {
        const pcm = planetConfigManager;
        if (!Array.isArray(this.draft.obstacles)) {
            this.draft.obstacles = (this.draft.obstacleTypes || []).map((t, i) =>
                pcm.normalizeObstacleEntry
                    ? pcm.normalizeObstacleEntry(Object.assign({ type: t }, pcm.defaultsFromLegacyObstacleType(t)), i)
                    : { id: 'o' + (i + 1), type: t, kind: 'asteroid', cluster: 'alpha' }
            );
        }
        if (!this.obstacleFilterCluster) this.obstacleFilterCluster = '(all)';
        if (!this.obstacleFilterKind) this.obstacleFilterKind = '(all)';
        if (!this.obstacleGroupBy) this.obstacleGroupBy = 'cluster';

        root.appendChild(this.makeSlider(
            'Spawn interval (ms)',
            this.draft.obstacleSpawnRate || 2000,
            400, 6000, 100,
            (v) => { this.draft.obstacleSpawnRate = Math.round(v); },
            true
        ));

        const clusters = (pcm.availableClusters || []).slice();
        const kinds = pcm.availableObstacleKinds || ['asteroid', 'shield', 'fog'];
        const directions = pcm.availableObstacleDirections || ['ltr', 'rtl', 'ttb', 'btt', 'diag_dr', 'diag_ur'];
        const sprites = pcm.availableObstacleSprites || ['obstacle', 'shield', 'obstacleSmall', 'obstacleMedium', 'obstacleLarge', 'fog'];

        root.appendChild(this.makeSelect(
            'Group by',
            this.obstacleGroupBy,
            ['cluster', 'kind', 'none'],
            (v) => { this.obstacleGroupBy = v; this.renderControls(); }
        ));
        root.appendChild(this.makeSelect(
            'Filter cluster',
            this.obstacleFilterCluster,
            ['(all)'].concat(clusters),
            (v) => { this.obstacleFilterCluster = v; this.renderControls(); }
        ));
        root.appendChild(this.makeSelect(
            'Filter kind',
            this.obstacleFilterKind,
            ['(all)'].concat(kinds),
            (v) => { this.obstacleFilterKind = v; this.renderControls(); }
        ));

        const hint = document.createElement('div');
        hint.className = 'pe-hint';
        hint.textContent = 'Same cluster spawns as one wave. Fog blocks LoS to the player ship.';
        root.appendChild(hint);

        const toolbar = document.createElement('div');
        toolbar.className = 'pe-row';
        toolbar.style.gap = '8px';
        toolbar.style.flexWrap = 'wrap';

        const addClusterBtn = document.createElement('button');
        addClusterBtn.type = 'button';
        addClusterBtn.className = 'pe-btn';
        addClusterBtn.textContent = '+ CLUSTER';
        addClusterBtn.addEventListener('click', () => {
            const name = window.prompt('New cluster name (e.g. nebula_west)');
            if (!name) return;
            const id = pcm.addCluster ? pcm.addCluster(name) : null;
            if (id) {
                this.obstacleFilterCluster = id;
                this.renderControls();
            }
        });
        toolbar.appendChild(addClusterBtn);
        root.appendChild(toolbar);

        const list = this.draft.obstacles;
        const filtered = [];
        list.forEach((entry, index) => {
            if (this.obstacleFilterCluster !== '(all)' && entry.cluster !== this.obstacleFilterCluster) return;
            if (this.obstacleFilterKind !== '(all)' && entry.kind !== this.obstacleFilterKind) return;
            filtered.push({ entry, index });
        });

        const groups = {};
        filtered.forEach((item) => {
            let key = 'all';
            if (this.obstacleGroupBy === 'cluster') key = item.entry.cluster || 'unknown';
            else if (this.obstacleGroupBy === 'kind') key = item.entry.kind || 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        Object.keys(groups).forEach((groupKey) => {
            if (this.obstacleGroupBy !== 'none') {
                const header = document.createElement('div');
                header.className = 'pe-hint';
                header.style.marginTop = '10px';
                header.style.fontWeight = 'bold';
                const prefix = this.obstacleGroupBy === 'cluster' ? 'CLUSTER' : 'KIND';
                header.textContent = `${prefix}: ${String(groupKey).toUpperCase()} (${groups[groupKey].length})`;
                root.appendChild(header);
            }

            groups[groupKey].forEach(({ entry, index }) => {
                const card = document.createElement('div');
                card.className = 'pe-layer-card';

                const idLabel = document.createElement('div');
                idLabel.className = 'pe-hint';
                idLabel.textContent = 'id: ' + (entry.id || ('o' + (index + 1)));
                card.appendChild(idLabel);

                card.appendChild(this.makeSelect('Kind', entry.kind || 'asteroid', kinds, (v) => {
                    entry.kind = v;
                    if (v === 'fog') {
                        entry.sprite = 'fog';
                        entry.destructible = false;
                        entry.reflectsShots = false;
                        entry.fragmentOnDestroy = false;
                        entry.opticalMode = 'none';
                        entry.opacity = entry.opacity < 1 ? entry.opacity : 0.4;
                        if (entry.width < 30) { entry.width = 48; entry.height = 36; }
                    } else if (v === 'shield') {
                        entry.sprite = 'shield';
                        entry.reflectsShots = true;
                        entry.destructible = false;
                        entry.opticalMode = 'none';
                        entry.opacity = 1;
                        entry.explosionId = entry.explosionId || 'small_pop';
                    } else if (v === 'crystal') {
                        entry.sprite = 'crystal';
                        entry.reflectsShots = false;
                        entry.destructible = true;
                        entry.opticalMode = entry.opticalMode && entry.opticalMode !== 'none' ? entry.opticalMode : 'prism';
                        entry.fragmentOnDestroy = true;
                        if (!entry.fragmentCount) entry.fragmentCount = 4;
                        if (entry.fragmentDepth == null) entry.fragmentDepth = 1;
                        if (entry.childFragmentChance == null) entry.childFragmentChance = 0.45;
                        entry.explosionId = 'crystal_shatter';
                        entry.opacity = 1;
                    } else {
                        entry.sprite = entry.sprite === 'fog' || entry.sprite === 'shield' || entry.sprite === 'crystal' ? 'obstacle' : entry.sprite;
                        entry.destructible = true;
                        entry.reflectsShots = false;
                        entry.opticalMode = 'none';
                        entry.opacity = 1;
                        entry.explosionId = entry.explosionId || 'asteroid_burst';
                    }
                    this.syncObstacleTypesFromDraft();
                    this.previewObstacles = [];
                    this.renderControls();
                }));

                const clusterOpts = clusters.indexOf(entry.cluster) === -1 && entry.cluster
                    ? clusters.concat([entry.cluster])
                    : clusters;
                card.appendChild(this.makeSelect('Cluster', entry.cluster || clusterOpts[0], clusterOpts, (v) => {
                    entry.cluster = v;
                    this.renderControls();
                }));

                card.appendChild(this.makeSelect('Direction', entry.direction || 'ltr', directions, (v) => {
                    entry.direction = v;
                }));

                card.appendChild(this.makeSlider('Speed', entry.speed != null ? entry.speed : 0.8, 0.1, 3, 0.05, (v) => {
                    entry.speed = Math.round(v * 100) / 100;
                }));

                card.appendChild(this.makeSlider('Width', entry.width != null ? entry.width : 18, 6, 200, 1, (v) => {
                    entry.width = Math.round(v);
                }, true));

                card.appendChild(this.makeSlider('Height', entry.height != null ? entry.height : 18, 6, 200, 1, (v) => {
                    entry.height = Math.round(v);
                }, true));

                card.appendChild(this.makeSlider('Weight', entry.weight != null ? entry.weight : 1, 1, 10, 1, (v) => {
                    entry.weight = Math.round(v);
                }, true));

                if (entry.kind !== 'fog') {
                    card.appendChild(this.makeCheckbox('Destructible', !!entry.destructible, (checked) => {
                        entry.destructible = checked;
                    }));
                    card.appendChild(this.makeCheckbox('Reflects shots', !!entry.reflectsShots, (checked) => {
                        entry.reflectsShots = checked;
                    }));
                    card.appendChild(this.makeSlider('Health', entry.health != null ? entry.health : 1, 1, 10, 1, (v) => {
                        entry.health = Math.round(v);
                    }, true));
                    card.appendChild(this.makeCheckbox('Fragment on destroy', !!entry.fragmentOnDestroy, (checked) => {
                        entry.fragmentOnDestroy = checked;
                        if (checked && !entry.fragmentCount) entry.fragmentCount = 3;
                        this.renderControls();
                    }));
                    if (entry.fragmentOnDestroy) {
                        card.appendChild(this.makeSlider('Fragment count', entry.fragmentCount != null ? entry.fragmentCount : 3, 1, 12, 1, (v) => {
                            entry.fragmentCount = Math.round(v);
                        }, true));
                        card.appendChild(this.makeSlider('Fragment depth', entry.fragmentDepth != null ? entry.fragmentDepth : 0, 0, 3, 1, (v) => {
                            entry.fragmentDepth = Math.round(v);
                        }, true));
                        card.appendChild(this.makeSlider('Size ratio', entry.fragmentSizeRatio != null ? entry.fragmentSizeRatio : 0.45, 0.2, 0.8, 0.05, (v) => {
                            entry.fragmentSizeRatio = Math.round(v * 100) / 100;
                        }));
                        card.appendChild(this.makeSlider('Fragment dmg', entry.fragmentDamage != null ? entry.fragmentDamage : 8, 1, 40, 1, (v) => {
                            entry.fragmentDamage = Math.round(v);
                        }, true));
                        card.appendChild(this.makeSlider('Fragment HP', entry.fragmentHealth != null ? entry.fragmentHealth : 1, 1, 5, 1, (v) => {
                            entry.fragmentHealth = Math.round(v);
                        }, true));
                        card.appendChild(this.makeSlider('Child chance', entry.childFragmentChance != null ? entry.childFragmentChance : 0, 0, 1, 0.05, (v) => {
                            entry.childFragmentChance = Math.round(v * 100) / 100;
                        }));
                    }
                    card.appendChild(this.makeSlider('Collision dmg', entry.collisionDamage != null ? entry.collisionDamage : 15, 1, 50, 1, (v) => {
                        entry.collisionDamage = Math.round(v);
                    }, true));
                    const opticalModes = pcm.availableOpticalModes || ['none', 'mirror', 'prism', 'kaleidoscope'];
                    card.appendChild(this.makeSelect('Optical', entry.opticalMode || 'none', opticalModes, (v) => {
                        entry.opticalMode = v;
                        if (v !== 'none' && entry.kind !== 'crystal') {
                            // keep kind; optical can apply to any solid
                        }
                        this.renderControls();
                    }));
                    if (entry.opticalMode === 'prism' || entry.opticalMode === 'kaleidoscope') {
                        card.appendChild(this.makeSlider('Prism splits', entry.prismSplitCount != null ? entry.prismSplitCount : 3, 2, 4, 1, (v) => {
                            entry.prismSplitCount = Math.round(v);
                        }, true));
                        card.appendChild(this.makeSlider('Prism angle', entry.prismAngleDeg != null ? entry.prismAngleDeg : 25, 5, 60, 1, (v) => {
                            entry.prismAngleDeg = Math.round(v);
                        }, true));
                    }
                    const explosionIds = (typeof explosionConfigManager !== 'undefined')
                        ? explosionConfigManager.getIds()
                        : ['default', 'asteroid_burst', 'crystal_shatter', 'small_pop', 'plasma_bloom'];
                    card.appendChild(this.makeSelect('Explosion', entry.explosionId || 'asteroid_burst', explosionIds, (v) => {
                        entry.explosionId = v;
                    }));
                }

                const spriteOpts = entry.kind === 'fog' ? ['fog'] : sprites.filter((s) => s !== 'fog' || entry.kind === 'fog');
                card.appendChild(this.makeSelect('Sprite', entry.sprite || spriteOpts[0], spriteOpts, (v) => {
                    entry.sprite = v;
                }));

                card.appendChild(this.makeSlider('Opacity', entry.opacity != null ? entry.opacity : 1, 0.1, 1, 0.05, (v) => {
                    entry.opacity = Math.round(v * 100) / 100;
                }));

                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'pe-btn';
                del.textContent = 'REMOVE';
                del.addEventListener('click', () => {
                    list.splice(index, 1);
                    this.syncObstacleTypesFromDraft();
                    this.previewObstacles = [];
                    this.renderControls();
                });
                card.appendChild(del);
                root.appendChild(card);
            });
        });

        const addRow = document.createElement('div');
        addRow.className = 'pe-row';
        addRow.style.gap = '8px';
        addRow.style.flexWrap = 'wrap';

        const addAst = document.createElement('button');
        addAst.type = 'button';
        addAst.className = 'pe-btn';
        addAst.textContent = '+ ASTEROID';
        addAst.addEventListener('click', () => this.addObstacleEntry('asteroid'));
        addRow.appendChild(addAst);

        const addShield = document.createElement('button');
        addShield.type = 'button';
        addShield.className = 'pe-btn';
        addShield.textContent = '+ SHIELD';
        addShield.addEventListener('click', () => this.addObstacleEntry('shield'));
        addRow.appendChild(addShield);

        const addCrystal = document.createElement('button');
        addCrystal.type = 'button';
        addCrystal.className = 'pe-btn';
        addCrystal.textContent = '+ CRYSTAL';
        addCrystal.addEventListener('click', () => this.addObstacleEntry('crystal'));
        addRow.appendChild(addCrystal);

        const addFog = document.createElement('button');
        addFog.type = 'button';
        addFog.className = 'pe-btn';
        addFog.textContent = '+ FOG / CLOUD';
        addFog.addEventListener('click', () => this.addObstacleEntry('fog'));
        addRow.appendChild(addFog);

        root.appendChild(addRow);
    }

    addObstacleEntry(kind) {
        if (!Array.isArray(this.draft.obstacles)) this.draft.obstacles = [];
        const pcm = planetConfigManager;
        const cluster = this.obstacleFilterCluster !== '(all)'
            ? this.obstacleFilterCluster
            : ((pcm.availableClusters && pcm.availableClusters[0]) || 'alpha');
        let seed = { kind: kind || 'asteroid', cluster };
        if (kind === 'fog') {
            seed = Object.assign(seed, {
                width: 48, height: 36, sprite: 'fog', opacity: 0.4,
                destructible: false, reflectsShots: false, fragmentOnDestroy: false,
                direction: 'ltr', speed: 0.5, type: 'fog'
            });
        } else if (kind === 'shield') {
            seed = Object.assign(seed, {
                width: 18, height: 18, sprite: 'shield', opacity: 1,
                destructible: false, reflectsShots: true, health: 1, type: 'medium_shield',
                explosionId: 'small_pop', opticalMode: 'none'
            });
        } else if (kind === 'crystal') {
            seed = Object.assign(seed, {
                width: 16, height: 20, sprite: 'crystal', opacity: 1,
                destructible: true, reflectsShots: false, health: 3,
                fragmentOnDestroy: true, fragmentCount: 4, fragmentDepth: 1,
                childFragmentChance: 0.45, fragmentDamage: 10, collisionDamage: 18,
                opticalMode: 'prism', prismSplitCount: 3, prismAngleDeg: 25,
                explosionId: 'crystal_shatter', type: 'crystal'
            });
        } else {
            seed = Object.assign(seed, {
                width: 18, height: 18, sprite: 'obstacle', opacity: 1,
                destructible: true, reflectsShots: false, health: 2,
                fragmentOnDestroy: false, type: 'medium_asteroid',
                explosionId: 'asteroid_burst', opticalMode: 'none'
            });
        }
        const entry = pcm.normalizeObstacleEntry
            ? pcm.normalizeObstacleEntry(seed, this.draft.obstacles.length)
            : seed;
        this.draft.obstacles.push(entry);
        this.syncObstacleTypesFromDraft();
        this.previewObstacles = [];
        this.renderControls();
    }

    syncObstacleTypesFromDraft() {
        if (!this.draft) return;
        const types = [];
        (this.draft.obstacles || []).forEach((o) => {
            if (o && o.type && types.indexOf(o.type) === -1) types.push(o.type);
        });
        this.draft.obstacleTypes = types;
    }

    getEditorEnemyList() {
        if (this.objectiveScope === 'stage') {
            if (!this.draft.stages) this.draft.stages = {};
            if (!this.draft.stages[this.objectiveStageKey]) {
                this.draft.stages[this.objectiveStageKey] = {};
            }
            const stage = this.draft.stages[this.objectiveStageKey];
            if (!Array.isArray(stage.enemies)) {
                stage.enemies = JSON.parse(JSON.stringify(this.draft.enemies || []));
            }
            return stage.enemies;
        }
        if (!Array.isArray(this.draft.enemies)) this.draft.enemies = [];
        return this.draft.enemies;
    }

    getEditorObjective() {
        if (this.objectiveScope === 'stage') {
            if (!this.draft.stages) this.draft.stages = {};
            if (!this.draft.stages[this.objectiveStageKey]) {
                this.draft.stages[this.objectiveStageKey] = {};
            }
            const stage = this.draft.stages[this.objectiveStageKey];
            if (!stage.objective) {
                stage.objective = Object.assign({}, this.draft.objective || { type: 'hunt' });
            }
            return stage.objective;
        }
        if (!this.draft.objective) this.draft.objective = { type: 'hunt' };
        return this.draft.objective;
    }

    renderEnemiesTab(root) {
        if (this.objectiveScope == null) this.objectiveScope = 'planet';
        if (!this.objectiveStageKey) this.objectiveStageKey = '1';
        if (!this.enemyGroupBy) this.enemyGroupBy = 'faction';
        if (!this.enemyFilterFaction) this.enemyFilterFaction = '(all)';
        if (!this.enemyFilterClass) this.enemyFilterClass = '(all)';
        if (!this.enemyFilterCluster) this.enemyFilterCluster = '(all)';

        const pcm = planetConfigManager;
        const factions = pcm.availableFactions || [];
        const classes = pcm.availableEnemyClasses || [];
        const clusters = pcm.availableClusters || [];
        const planetFactions = Array.isArray(this.draft.factions) && this.draft.factions.length
            ? this.draft.factions.slice()
            : factions.slice();

        const scopeRow = document.createElement('div');
        scopeRow.className = 'pe-row';
        scopeRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'List scope' }));
        const scopeSelect = document.createElement('select');
        [['planet', 'Planet default'], ['stage', 'Stage override']].forEach(([v, label]) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = label;
            if (this.objectiveScope === v) opt.selected = true;
            scopeSelect.appendChild(opt);
        });
        scopeSelect.addEventListener('change', () => {
            this.objectiveScope = scopeSelect.value;
            this.renderControls();
        });
        scopeRow.appendChild(scopeSelect);
        root.appendChild(scopeRow);

        if (this.objectiveScope === 'stage') {
            root.appendChild(this.makeSelect('Stage', this.objectiveStageKey, ['1', '2', '3', 'boss'], (v) => {
                this.objectiveStageKey = v;
                this.renderControls();
            }));
        }

        root.appendChild(this.makeSelect(
            'Group by',
            this.enemyGroupBy,
            ['faction', 'enemyClass', 'cluster', 'type', 'none'],
            (v) => {
                this.enemyGroupBy = v;
                this.renderControls();
            }
        ));

        root.appendChild(this.makeSelect(
            'Filter faction',
            this.enemyFilterFaction,
            ['(all)'].concat(planetFactions.length ? planetFactions : factions),
            (v) => {
                this.enemyFilterFaction = v;
                this.renderControls();
            }
        ));
        root.appendChild(this.makeSelect(
            'Filter class',
            this.enemyFilterClass,
            ['(all)'].concat(classes),
            (v) => {
                this.enemyFilterClass = v;
                this.renderControls();
            }
        ));
        root.appendChild(this.makeSelect(
            'Filter cluster',
            this.enemyFilterCluster,
            ['(all)'].concat(clusters),
            (v) => {
                this.enemyFilterCluster = v;
                this.renderControls();
            }
        ));

        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'Assign Faction, Class, Cluster. Same cluster spawns as one wave at the earliest spawnAt. Planet factions are set in GRAPHICS.';
        root.appendChild(hint);

        const list = this.getEditorEnemyList();
        const indexed = list.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
            if (this.enemyFilterFaction !== '(all)' && entry.faction !== this.enemyFilterFaction) return false;
            if (this.enemyFilterClass !== '(all)' && entry.enemyClass !== this.enemyFilterClass) return false;
            if (this.enemyFilterCluster !== '(all)' && entry.cluster !== this.enemyFilterCluster) return false;
            return true;
        });

        const groups = {};
        indexed.forEach(item => {
            let key = 'ALL';
            if (this.enemyGroupBy === 'faction') key = item.entry.faction || 'unknown';
            else if (this.enemyGroupBy === 'enemyClass') key = item.entry.enemyClass || 'unknown';
            else if (this.enemyGroupBy === 'cluster') key = item.entry.cluster || 'unknown';
            else if (this.enemyGroupBy === 'type') key = item.entry.type || 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        const groupKeys = Object.keys(groups).sort();
        groupKeys.forEach(groupKey => {
            if (this.enemyGroupBy !== 'none') {
                const header = document.createElement('div');
                header.className = 'pe-hint';
                header.style.marginTop = '10px';
                header.style.fontWeight = 'bold';
                const prefix = this.enemyGroupBy === 'faction' ? 'FACTION'
                    : this.enemyGroupBy === 'enemyClass' ? 'KLASSE'
                    : this.enemyGroupBy === 'cluster' ? 'CLUSTER'
                    : this.enemyGroupBy === 'type' ? 'TYPE' : '';
                header.textContent = `${prefix}: ${String(groupKey).toUpperCase()} (${groups[groupKey].length})`;
                root.appendChild(header);
            }

            groups[groupKey].forEach(({ entry, index }) => {
                const card = document.createElement('div');
                card.className = 'pe-layer-card';

                const idLabel = document.createElement('div');
                idLabel.className = 'pe-hint';
                idLabel.textContent = 'id: ' + (entry.id || ('e' + (index + 1)));
                card.appendChild(idLabel);

                const typeOpts = pcm.getAvailableEnemyTypesForPlanet
                    ? pcm.getAvailableEnemyTypesForPlanet(this.selectedPlanet)
                    : pcm.availableEnemyTypes;
                const shipTypes = typeOpts.indexOf(entry.type) === -1
                    ? typeOpts.concat([entry.type])
                    : typeOpts;
                card.appendChild(this.makeSelect('Ship type', entry.type, shipTypes, (v) => {
                    entry.type = v;
                    const tax = pcm.taxonomyForType ? pcm.taxonomyForType(v) : null;
                    if (tax) {
                        entry.faction = tax.faction;
                        entry.enemyClass = tax.enemyClass;
                    }
                    if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getConfig) {
                        const ecfg = enemyConfigManager.getConfig(v);
                        if (ecfg && ecfg.factions && ecfg.factions.length) {
                            entry.faction = ecfg.factions[0];
                        }
                    }
                    this.renderControls();
                }));

                const factionOpts = planetFactions.indexOf(entry.faction) === -1 && entry.faction
                    ? planetFactions.concat([entry.faction])
                    : planetFactions;
                card.appendChild(this.makeSelect('Faction', entry.faction || factionOpts[0] || factions[0], factionOpts, (v) => {
                    entry.faction = v;
                    this.renderControls();
                }));

                card.appendChild(this.makeSelect('Class', entry.enemyClass || classes[0], classes, (v) => {
                    entry.enemyClass = v;
                    this.renderControls();
                }));

                card.appendChild(this.makeSelect('Cluster', entry.cluster || clusters[0], clusters, (v) => {
                    entry.cluster = v;
                    this.renderControls();
                }));

                const champRow = document.createElement('div');
                champRow.className = 'pe-row';
                champRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'Champion' }));
                const champCb = document.createElement('input');
                champCb.type = 'checkbox';
                champCb.checked = !!entry.champion;
                champCb.addEventListener('change', () => {
                    entry.champion = champCb.checked;
                    if (entry.champion && (!entry.level || entry.level < 2)) entry.level = 2;
                    this.renderControls();
                });
                champRow.appendChild(champCb);
                card.appendChild(champRow);

                card.appendChild(this.makeSlider('Level', entry.level != null ? entry.level : 1, 1, 10, 1, (v) => {
                    entry.level = Math.round(v);
                }, true));

                card.appendChild(this.makeSlider('Spawn at (s)', entry.spawnAt != null ? entry.spawnAt : 0, 0, 180, 1, (v) => {
                    entry.spawnAt = Math.round(v);
                }, true));

                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'pe-btn';
                del.textContent = 'REMOVE';
                del.addEventListener('click', () => {
                    list.splice(index, 1);
                    this.renderControls();
                });
                card.appendChild(del);
                root.appendChild(card);
            });
        });

        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'pe-btn';
        add.textContent = '+ ENEMY';
        add.addEventListener('click', () => {
            const id = pcm.nextEnemyId ? pcm.nextEnemyId('e') : ('e' + Date.now());
            const tax = pcm.taxonomyForType ? pcm.taxonomyForType('enemyBasic') : { faction: 'pirate', enemyClass: 'scout' };
            list.push({
                id: id,
                type: 'enemyBasic',
                faction: this.enemyFilterFaction !== '(all)' ? this.enemyFilterFaction : tax.faction,
                enemyClass: this.enemyFilterClass !== '(all)' ? this.enemyFilterClass : tax.enemyClass,
                cluster: this.enemyFilterCluster !== '(all)' ? this.enemyFilterCluster : 'alpha',
                champion: false,
                level: 1,
                spawnAt: list.length * 8
            });
            this.renderControls();
        });
        root.appendChild(add);
    }

    renderObjectivesTab(root) {
        if (this.objectiveScope == null) this.objectiveScope = 'planet';
        if (!this.objectiveStageKey) this.objectiveStageKey = '1';

        const scopeRow = document.createElement('div');
        scopeRow.className = 'pe-row';
        scopeRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'Objective scope' }));
        const scopeSelect = document.createElement('select');
        [['planet', 'Planet overall'], ['stage', 'Stage']].forEach(([v, label]) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = label;
            if (this.objectiveScope === v) opt.selected = true;
            scopeSelect.appendChild(opt);
        });
        scopeSelect.addEventListener('change', () => {
            this.objectiveScope = scopeSelect.value;
            this.renderControls();
        });
        scopeRow.appendChild(scopeSelect);
        root.appendChild(scopeRow);

        if (this.objectiveScope === 'stage') {
            root.appendChild(this.makeSelect('Stage', this.objectiveStageKey, ['1', '2', '3', 'boss'], (v) => {
                this.objectiveStageKey = v;
                this.renderControls();
            }));
        }

        const objective = this.getEditorObjective();
        const enemies = this.objectiveScope === 'stage'
            ? this.getEditorEnemyList()
            : (this.draft.enemies || []);

        root.appendChild(this.makeSelect(
            'Type',
            objective.type || 'hunt',
            ['hunt', 'killCount', 'surviveCount', 'surviveTime'],
            (v) => {
                objective.type = v;
                this.renderControls();
            }
        ));

        if (objective.type === 'hunt') {
            const ids = enemies.map(e => e.id);
            if (!ids.length) ids.push('(add enemies first)');
            root.appendChild(this.makeSelect(
                'Target enemy id',
                objective.targetEnemyId || ids[0],
                ids,
                (v) => { objective.targetEnemyId = v; }
            ));
        } else if (objective.type === 'killCount') {
            root.appendChild(this.makeSlider('Kill count', objective.count != null ? objective.count : 5, 1, 50, 1, (v) => {
                objective.count = Math.round(v);
            }, true));
            const typeOpts = ['(any)'].concat(planetConfigManager.availableEnemyTypes);
            root.appendChild(this.makeSelect(
                'Enemy type filter',
                objective.enemyType || '(any)',
                typeOpts,
                (v) => {
                    if (v === '(any)') delete objective.enemyType;
                    else objective.enemyType = v;
                }
            ));
            root.appendChild(this.makeSelect(
                'Faction filter',
                objective.faction || '(any)',
                ['(any)'].concat(planetConfigManager.availableFactions || []),
                (v) => {
                    if (v === '(any)') delete objective.faction;
                    else objective.faction = v;
                }
            ));
            root.appendChild(this.makeSelect(
                'Class filter',
                objective.enemyClass || '(any)',
                ['(any)'].concat(planetConfigManager.availableEnemyClasses || []),
                (v) => {
                    if (v === '(any)') delete objective.enemyClass;
                    else objective.enemyClass = v;
                }
            ));
            root.appendChild(this.makeSelect(
                'Cluster filter',
                objective.cluster || '(any)',
                ['(any)'].concat(planetConfigManager.availableClusters || []),
                (v) => {
                    if (v === '(any)') delete objective.cluster;
                    else objective.cluster = v;
                }
            ));
        } else if (objective.type === 'surviveCount') {
            root.appendChild(this.makeSlider('Survive spawns', objective.count != null ? objective.count : 5, 1, 50, 1, (v) => {
                objective.count = Math.round(v);
            }, true));
        } else if (objective.type === 'surviveTime') {
            root.appendChild(this.makeSlider('Survive seconds', objective.seconds != null ? objective.seconds : 60, 5, 300, 5, (v) => {
                objective.seconds = Math.round(v);
            }, true));
        }

        const dailyHead = document.createElement('h3');
        dailyHead.className = 'pe-hint';
        dailyHead.textContent = 'DAILIES';
        dailyHead.style.marginTop = '16px';
        root.appendChild(dailyHead);

        if (!this.draft.dailies) {
            this.draft.dailies = { enabled: false, enemyType: 'enemyBasic', killCountPerDay: 5, requiredDays: 3 };
        }
        const d = this.draft.dailies;

        const enRow = document.createElement('div');
        enRow.className = 'pe-row';
        enRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'Enabled' }));
        const enCb = document.createElement('input');
        enCb.type = 'checkbox';
        enCb.checked = d.enabled !== false;
        enCb.addEventListener('change', () => { d.enabled = enCb.checked; });
        enRow.appendChild(enCb);
        root.appendChild(enRow);

        root.appendChild(this.makeSelect('Kill type', d.enemyType || 'enemyBasic', planetConfigManager.availableEnemyTypes, (v) => {
            d.enemyType = v;
        }));
        root.appendChild(this.makeSelect(
            'Faction filter',
            d.faction || '(any)',
            ['(any)'].concat(planetConfigManager.availableFactions || []),
            (v) => {
                if (v === '(any)') d.faction = null;
                else d.faction = v;
            }
        ));
        root.appendChild(this.makeSelect(
            'Class filter',
            d.enemyClass || '(any)',
            ['(any)'].concat(planetConfigManager.availableEnemyClasses || []),
            (v) => {
                if (v === '(any)') d.enemyClass = null;
                else d.enemyClass = v;
            }
        ));
        root.appendChild(this.makeSlider('Kills per day', d.killCountPerDay != null ? d.killCountPerDay : 5, 1, 30, 1, (v) => {
            d.killCountPerDay = Math.round(v);
        }, true));
        root.appendChild(this.makeSlider('Required days', d.requiredDays != null ? d.requiredDays : 3, 1, 30, 1, (v) => {
            d.requiredDays = Math.round(v);
        }, true));

        const resHead = document.createElement('h3');
        resHead.className = 'pe-hint';
        resHead.textContent = 'RESOURCES (MISSION LOOT)';
        resHead.style.marginTop = '16px';
        root.appendChild(resHead);

        if (!Array.isArray(this.draft.resources)) {
            this.draft.resources = [];
        }
        const resourceIds = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];

        this.draft.resources.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'pe-row pe-resource-row';
            row.style.flexWrap = 'wrap';
            row.style.gap = '6px';
            row.style.marginBottom = '8px';

            const idSel = document.createElement('select');
            resourceIds.forEach((rid) => {
                const opt = document.createElement('option');
                opt.value = rid;
                opt.textContent = (typeof economyConfig !== 'undefined')
                    ? economyConfig.getResourceLabel(rid)
                    : rid.toUpperCase();
                if (entry.id === rid) opt.selected = true;
                idSel.appendChild(opt);
            });
            idSel.addEventListener('change', () => {
                entry.id = idSel.value;
            });
            row.appendChild(idSel);

            const minLab = document.createElement('label');
            minLab.textContent = 'min';
            const minIn = document.createElement('input');
            minIn.type = 'number';
            minIn.min = '0';
            minIn.value = entry.min != null ? entry.min : 1;
            minIn.style.width = '48px';
            minIn.addEventListener('change', () => {
                entry.min = Math.max(0, parseInt(minIn.value, 10) || 0);
            });
            row.appendChild(minLab);
            row.appendChild(minIn);

            const maxLab = document.createElement('label');
            maxLab.textContent = 'max';
            const maxIn = document.createElement('input');
            maxIn.type = 'number';
            maxIn.min = '0';
            maxIn.value = entry.max != null ? entry.max : 2;
            maxIn.style.width = '48px';
            maxIn.addEventListener('change', () => {
                entry.max = Math.max(0, parseInt(maxIn.value, 10) || 0);
            });
            row.appendChild(maxLab);
            row.appendChild(maxIn);

            const rem = document.createElement('button');
            rem.className = 'action-button secondary';
            rem.type = 'button';
            rem.textContent = '×';
            rem.addEventListener('click', () => {
                this.draft.resources.splice(index, 1);
                this.renderControls();
            });
            row.appendChild(rem);
            root.appendChild(row);
        });

        const addRes = document.createElement('button');
        addRes.className = 'action-button';
        addRes.type = 'button';
        addRes.textContent = 'ADD RESOURCE';
        addRes.addEventListener('click', () => {
            this.draft.resources.push({ id: resourceIds[0], weight: 1, min: 1, max: 3 });
            this.renderControls();
        });
        root.appendChild(addRes);
    }

    renderSideEnemiesTab(root) {
        this.renderEnemiesTab(root);
    }

    renderGraphicsTab(root) {
        if (!this.draft.graphics) this.draft.graphics = {};

        const themeIds = ['inherit'].concat(
            (typeof themeContextManager !== 'undefined')
                ? themeContextManager.presetIds.slice()
                : ['grayscale', 'retro', 'neon', 'ocean', 'fire', 'purple', 'forest', 'sunset']
        );

        const galaxyId = this.draft.galaxyId || planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
        const galaxy = planetConfigManager.getGalaxy(galaxyId);
        if (galaxy) planetConfigManager.migrateGalaxyThemeToBaseColor(galaxy);
        const galaxyBase = (galaxy && galaxy.baseColor) || '#808080';
        const galaxyHasBase = !!(galaxy && galaxy.baseColor);

        root.appendChild(this.makeColor(
            'Galaxy base color',
            galaxyBase,
            (v) => {
                planetConfigManager.setGalaxyBaseColor(galaxyId, v, { persist: false });
                if (typeof themeContextManager !== 'undefined') {
                    themeContextManager.applyForPlanet(this.selectedPlanet, null);
                }
            },
            {
                clearable: true,
                cleared: !galaxyHasBase,
                onClear: () => {
                    planetConfigManager.setGalaxyBaseColor(galaxyId, null, { persist: false });
                    if (typeof themeContextManager !== 'undefined') {
                        themeContextManager.applyForPlanet(this.selectedPlanet, null);
                    }
                    this.renderControls();
                }
            }
        ));

        root.appendChild(this.makeSelect(
            'Planet theme',
            this.draft.theme || 'inherit',
            themeIds,
            (v) => {
                this.draft.theme = (v === 'inherit') ? null : v;
                if (typeof themeContextManager !== 'undefined') {
                    themeContextManager.applyForPlanet(this.selectedPlanet, null);
                }
            }
        ));

        const stageKeys = ['1', '2', '3', 'boss'];
        if (!this.draft.stages) this.draft.stages = {};
        stageKeys.forEach((key) => {
            const stage = this.draft.stages[key] || {};
            const current = stage.theme || 'inherit';
            root.appendChild(this.makeSelect(
                `Stage ${key} theme`,
                current,
                themeIds,
                (v) => {
                    if (!this.draft.stages[key]) this.draft.stages[key] = {};
                    if (v === 'inherit') {
                        delete this.draft.stages[key].theme;
                    } else {
                        this.draft.stages[key].theme = v;
                    }
                }
            ));
        });

        root.appendChild(this.makeSelect(
            'Obstacle style',
            this.draft.graphics.obstacleStyle || 'asteroid',
            ['asteroid', 'shield', 'mixed'],
            (v) => { this.draft.graphics.obstacleStyle = v; }
        ));

        root.appendChild(this.makeText(
            'YouTube soundtrack',
            this.draft.soundtrackUrl || '',
            (v) => { this.draft.soundtrackUrl = String(v || '').trim(); },
            'https://youtu.be/… or video id'
        ));
        const ytHint = document.createElement('p');
        ytHint.className = 'pe-hint';
        ytHint.textContent = 'Optional YouTube URL as planet BGM. Empty = procedural ambient. Video must allow embedding.';
        root.appendChild(ytHint);

        root.appendChild(this.makeSlider(
            'Soundtrack BPM',
            this.draft.soundtrackBpm != null ? this.draft.soundtrackBpm : 120,
            60,
            220,
            1,
            (v) => { this.draft.soundtrackBpm = Math.round(Number(v)); },
            true
        ));
        const bpmHint = document.createElement('p');
        bpmHint.className = 'pe-hint';
        bpmHint.textContent = 'Beat sync for enemy movement and power shots. Match this to the YouTube track tempo.';
        root.appendChild(bpmHint);

        if (!Array.isArray(this.draft.factions)) this.draft.factions = [];
        const factionHint = document.createElement('p');
        factionHint.className = 'pe-hint';
        factionHint.textContent = 'Factions on this planet. Empty = all factions allowed. Enemy ship types and spawn factions are filtered by this list.';
        root.appendChild(factionHint);
        root.appendChild(this.makeMultiCheck(
            'Factions',
            planetConfigManager.availableFactions || [],
            this.draft.factions,
            (next) => { this.draft.factions = next; }
        ));

        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'Theme priority: Stage → Planet → Galaxy → App Theme (Settings). Inherit skips that level.';
        root.appendChild(hint);

        const hint2 = document.createElement('p');
        hint2.className = 'pe-hint';
        hint2.textContent = 'Enemy ships, champions and spawn times are configured in the ENEMIES tab.';
        root.appendChild(hint2);

        const comfyRow = document.createElement('div');
        comfyRow.className = 'pe-row';
        const comfyLabel = document.createElement('label');
        comfyLabel.textContent = 'Pixel assets';
        const comfyBtn = document.createElement('button');
        comfyBtn.type = 'button';
        comfyBtn.className = 'pe-btn pe-primary';
        comfyBtn.textContent = 'COMFYUI';
        comfyBtn.title = 'Open ComfyUI pixel renderer (npm run comfy → :8188)';
        comfyBtn.addEventListener('click', () => {
            window.open('http://127.0.0.1:8188', '_blank', 'noopener');
        });
        comfyRow.appendChild(comfyLabel);
        comfyRow.appendChild(comfyBtn);
        root.appendChild(comfyRow);

        const comfyHint = document.createElement('p');
        comfyHint.className = 'pe-hint';
        comfyHint.textContent = 'Start: npm run comfy · UI: http://127.0.0.1:8188 · Workflow: VF Pixel Sprite · Output: assets/_generated/';
        root.appendChild(comfyHint);
    }

    makeSlider(labelText, value, min, max, step, onChange, integer) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-slider-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const val = document.createElement('span');
        val.className = 'pe-val';
        val.textContent = integer ? String(Math.round(value)) : Number(value).toFixed(2);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('input', () => {
            const v = Number(input.value);
            val.textContent = integer ? String(Math.round(v)) : v.toFixed(2);
            onChange(v);
        });
        row.appendChild(label);
        row.appendChild(val);
        row.appendChild(input);
        return row;
    }

    makeSelect(labelText, value, options, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === value) o.selected = true;
            select.appendChild(o);
        });
        select.addEventListener('change', () => onChange(select.value));
        row.appendChild(label);
        row.appendChild(select);
        return row;
    }

    makeText(labelText, value, onChange, placeholder) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-text-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'url';
        input.value = value || '';
        if (placeholder) input.placeholder = placeholder;
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.addEventListener('change', () => onChange(input.value));
        input.addEventListener('blur', () => onChange(input.value));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    }

    makeColor(labelText, value, onChange, options) {
        const opts = options || {};
        const row = document.createElement('div');
        row.className = 'pe-row pe-color-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'color';
        const hex = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex)
            ? colorPaletteSystem.normalizeHex(value || '#808080')
            : (value || '#808080');
        input.value = hex;
        input.disabled = !!opts.cleared;
        const hexEl = document.createElement('span');
        hexEl.className = 'pe-hex';
        hexEl.textContent = opts.cleared ? 'inherit' : input.value;
        input.addEventListener('input', () => {
            hexEl.textContent = input.value;
            onChange(input.value);
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(hexEl);
        if (opts.clearable) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'pe-btn pe-color-clear';
            clearBtn.textContent = opts.cleared ? 'SET' : 'INHERIT';
            clearBtn.addEventListener('click', () => {
                if (opts.cleared) {
                    input.disabled = false;
                    onChange(input.value);
                    if (typeof this.renderControls === 'function') this.renderControls();
                } else if (typeof opts.onClear === 'function') {
                    opts.onClear();
                }
            });
            row.appendChild(clearBtn);
        }
        return row;
    }

    makeCheckbox(labelText, checked, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-row-check';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    }

    makeMultiCheck(labelText, options, selected, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'pe-ability-group';
        const title = document.createElement('div');
        title.className = 'pe-ability-group-title';
        title.textContent = labelText;
        wrap.appendChild(title);
        const state = Array.isArray(selected) ? selected.slice() : [];
        (options || []).forEach((opt) => {
            const on = state.indexOf(opt) !== -1;
            wrap.appendChild(this.makeCheckbox(opt, on, (checked) => {
                const idx = state.indexOf(opt);
                if (checked && idx === -1) state.push(opt);
                if (!checked && idx !== -1) state.splice(idx, 1);
                onChange(state.slice());
            }));
        });
        return wrap;
    }

    makePatternPicker(layer) {
        const wrap = document.createElement('div');
        wrap.className = 'pe-pattern-picker';

        const label = document.createElement('label');
        label.textContent = 'Pattern';
        wrap.appendChild(label);

        const current = document.createElement('button');
        current.type = 'button';
        current.className = 'pe-pattern-current';
        current.title = 'Choose pattern';

        const currentCanvas = document.createElement('canvas');
        currentCanvas.width = 72;
        currentCanvas.height = 108;
        currentCanvas.className = 'pe-pattern-thumb';

        const currentName = document.createElement('span');
        currentName.className = 'pe-pattern-name';
        currentName.textContent = layer.pattern || '—';

        const hint = document.createElement('span');
        hint.className = 'pe-pattern-open-hint';
        hint.textContent = '▸';

        current.appendChild(currentCanvas);
        current.appendChild(currentName);
        current.appendChild(hint);
        current.addEventListener('click', () => this.openPatternModal(layer, currentCanvas, currentName));
        wrap.appendChild(current);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'pe-btn pe-pattern-edit-btn';
        editBtn.textContent = 'EDIT PATTERN';
        editBtn.addEventListener('click', () => {
            this.openPatternEditor(layer.pattern || 'grid', layer, currentCanvas, currentName);
        });
        wrap.appendChild(editBtn);

        const color = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.resolveLayerColor(layer)
            : '#808080';
        this.drawPatternThumbnail(currentCanvas, layer.pattern, color);

        return wrap;
    }

    openPatternModal(layer, currentCanvas, currentName) {
        this.closePatternModal();
        this.patternModalLayer = layer;

        const modal = document.createElement('div');
        modal.id = 'pePatternModal';
        modal.className = 'pe-pattern-modal';

        const dialog = document.createElement('div');
        dialog.className = 'pe-pattern-modal-dialog';

        const head = document.createElement('div');
        head.className = 'pe-pattern-modal-header';
        const title = document.createElement('h3');
        title.textContent = 'SELECT PATTERN';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pe-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.closePatternModal());
        head.appendChild(title);
        head.appendChild(closeBtn);

        const grid = document.createElement('div');
        grid.className = 'pe-pattern-grid pe-pattern-grid-modal';

        const patterns = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getAllPatternIds()
            : [];

        const color = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.resolveLayerColor(layer)
            : '#808080';

        const applyPattern = (patternId) => {
            layer.pattern = patternId;
            if (currentName) currentName.textContent = patternId;
            if (currentCanvas) this.drawPatternThumbnail(currentCanvas, patternId, color);
            const summary = currentCanvas && currentCanvas.closest('.pe-layer-card');
            if (summary) {
                const summaryEl = summary.querySelector('.pe-layer-summary');
                if (summaryEl) summaryEl.textContent = patternId;
            }
            this.closePatternModal();
        };

        patterns.forEach(patternId => {
            const item = document.createElement('div');
            item.className = 'pe-pattern-item-wrap' + (patternId === layer.pattern ? ' active' : '');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-pattern-item' + (patternId === layer.pattern ? ' active' : '');
            btn.title = patternId;

            const thumb = document.createElement('canvas');
            thumb.width = 56;
            thumb.height = 84;
            thumb.className = 'pe-pattern-thumb';
            this.drawPatternThumbnail(thumb, patternId, color);

            const name = document.createElement('span');
            name.textContent = patternId;
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.hasCustomPattern(patternId)) {
                name.textContent += ' ✎';
            }

            btn.appendChild(thumb);
            btn.appendChild(name);
            btn.addEventListener('click', () => applyPattern(patternId));

            const editMini = document.createElement('button');
            editMini.type = 'button';
            editMini.className = 'pe-btn pe-pattern-item-edit';
            editMini.title = 'Edit pattern';
            editMini.textContent = '✎';
            editMini.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePatternModal();
                this.openPatternEditor(patternId, layer, currentCanvas, currentName);
            });

            item.appendChild(btn);
            item.appendChild(editMini);
            grid.appendChild(item);
        });

        const foot = document.createElement('div');
        foot.className = 'pe-pattern-modal-footer';
        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'pe-btn pe-primary';
        newBtn.textContent = '+ NEW PATTERN';
        newBtn.addEventListener('click', () => {
            if (typeof planetConfigManager === 'undefined') return;
            const id = planetConfigManager.nextCustomPatternId();
            planetConfigManager.setCustomPattern(id, planetConfigManager.createBlankPattern(id, id));
            this.closePatternModal();
            this.openPatternEditor(id, layer, currentCanvas, currentName);
        });
        foot.appendChild(newBtn);

        dialog.appendChild(head);
        dialog.appendChild(grid);
        dialog.appendChild(foot);
        modal.appendChild(dialog);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePatternModal();
        });

        const overlay = document.getElementById('planetEditorOverlay');
        if (overlay) overlay.appendChild(modal);
        else document.body.appendChild(modal);
    }

    closePatternModal() {
        const modal = document.getElementById('pePatternModal');
        if (!modal) {
            this.patternModalLayer = null;
            return false;
        }
        modal.remove();
        this.patternModalLayer = null;
        return true;
    }

    sampleBuiltinPattern(patternId) {
        const tw = (typeof planetConfigManager !== 'undefined') ? planetConfigManager.defaultTileSize : 16;
        const th = tw;
        const cell = (typeof planetConfigManager !== 'undefined') ? planetConfigManager.defaultCellSize : 4;
        const cells = new Array(tw * th).fill(0);

        if (typeof parallaxManager === 'undefined' || !parallaxManager.drawLayerPattern) {
            return { id: patternId, name: patternId, width: tw, height: th, cellSize: cell, cells };
        }

        const off = document.createElement('canvas');
        off.width = 400;
        off.height = 600;
        const ctx = off.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 400, 600);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;

        const prev = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.customPatterns[patternId]
            : null;
        if (prev && typeof planetConfigManager !== 'undefined') {
            delete planetConfigManager.customPatterns[patternId];
        }

        parallaxManager.drawLayerPattern(ctx, {
            pattern: patternId,
            y: 0,
            color: '#ffffff',
            colorSource: 'custom',
            opacity: 1,
            scale: 1,
            visible: true
        }, 0);

        if (prev && typeof planetConfigManager !== 'undefined') {
            planetConfigManager.customPatterns[patternId] = prev;
        }

        const region = Math.min(400, tw * cell);
        const regionH = Math.min(600, th * cell);
        for (let cy = 0; cy < th; cy++) {
            for (let cx = 0; cx < tw; cx++) {
                const px = Math.min(region - 1, Math.floor(cx * cell + cell / 2));
                const py = Math.min(regionH - 1, Math.floor(cy * cell + cell / 2));
                const d = ctx.getImageData(px, py, 1, 1).data;
                cells[cy * tw + cx] = (d[0] + d[1] + d[2] > 40) ? 1 : 0;
            }
        }

        return { id: patternId, name: patternId, width: tw, height: th, cellSize: cell, cells };
    }

    openPatternEditor(patternId, layer, currentCanvas, currentName) {
        this.closePatternEditor();
        if (typeof planetConfigManager === 'undefined') return;

        let draft;
        if (planetConfigManager.hasCustomPattern(patternId)) {
            draft = JSON.parse(JSON.stringify(planetConfigManager.getCustomPattern(patternId)));
        } else if (planetConfigManager.isBuiltinPattern(patternId)) {
            draft = this.sampleBuiltinPattern(patternId);
        } else {
            draft = planetConfigManager.createBlankPattern(patternId, patternId);
        }

        const paintValue = { current: 1 };
        const painting = { active: false };

        const modal = document.createElement('div');
        modal.id = 'pePatternEditor';
        modal.className = 'pe-pattern-editor-modal';

        const dialog = document.createElement('div');
        dialog.className = 'pe-pattern-editor-dialog';

        const head = document.createElement('div');
        head.className = 'pe-pattern-modal-header';
        const title = document.createElement('h3');
        title.textContent = 'PATTERN EDITOR';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pe-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.closePatternEditor());
        head.appendChild(title);
        head.appendChild(closeBtn);

        const idRow = document.createElement('div');
        idRow.className = 'pe-row';
        const idLabel = document.createElement('label');
        idLabel.textContent = 'ID';
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.className = 'pe-text-input';
        idInput.value = draft.id;
        idInput.readOnly = planetConfigManager.isBuiltinPattern(patternId);
        idRow.appendChild(idLabel);
        idRow.appendChild(idInput);

        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'pe-pattern-editor-canvas-wrap';
        const canvas = document.createElement('canvas');
        canvas.className = 'pe-pattern-editor-canvas';
        canvasWrap.appendChild(canvas);

        const redraw = () => {
            const scale = Math.max(12, Math.floor(280 / Math.max(draft.width, draft.height)));
            canvas.width = draft.width * scale;
            canvas.height = draft.height * scale;
            const ctx = canvas.getContext('2d');
            const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
            const fg = (layer && typeof planetConfigManager !== 'undefined')
                ? planetConfigManager.resolveLayerColor(layer)
                : (getComputedStyle(document.documentElement).getPropertyValue('--current-primary').trim() || '#e07028');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (let y = 0; y < draft.height; y++) {
                for (let x = 0; x < draft.width; x++) {
                    if (draft.cells[y * draft.width + x]) {
                        ctx.fillStyle = fg;
                        ctx.fillRect(x * scale, y * scale, scale, scale);
                    }
                    ctx.strokeStyle = 'rgba(80,60,40,0.45)';
                    ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
                }
            }
        };

        const paintAt = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cellScale = canvas.width / draft.width;
            const x = Math.floor(((clientX - rect.left) * scaleX) / cellScale);
            const y = Math.floor(((clientY - rect.top) * scaleY) / cellScale);
            if (x < 0 || y < 0 || x >= draft.width || y >= draft.height) return;
            draft.cells[y * draft.width + x] = paintValue.current;
            redraw();
        };

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            painting.active = true;
            paintValue.current = e.button === 2 ? 0 : 1;
            paintAt(e.clientX, e.clientY);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (!painting.active) return;
            paintAt(e.clientX, e.clientY);
        });
        const onUp = () => { painting.active = false; };
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        const tools = document.createElement('div');
        tools.className = 'pe-pattern-editor-tools';

        const paintBtn = document.createElement('button');
        paintBtn.type = 'button';
        paintBtn.className = 'pe-btn pe-primary';
        paintBtn.textContent = 'PAINT';
        paintBtn.addEventListener('click', () => { paintValue.current = 1; });

        const eraseBtn = document.createElement('button');
        eraseBtn.type = 'button';
        eraseBtn.className = 'pe-btn';
        eraseBtn.textContent = 'ERASE';
        eraseBtn.addEventListener('click', () => { paintValue.current = 0; });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'pe-btn';
        clearBtn.textContent = 'CLEAR';
        clearBtn.addEventListener('click', () => {
            draft.cells = draft.cells.map(() => 0);
            redraw();
        });

        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.className = 'pe-btn';
        fillBtn.textContent = 'FILL';
        fillBtn.addEventListener('click', () => {
            draft.cells = draft.cells.map(() => 1);
            redraw();
        });

        const resampleBtn = document.createElement('button');
        resampleBtn.type = 'button';
        resampleBtn.className = 'pe-btn';
        resampleBtn.textContent = 'RESAMPLE';
        resampleBtn.title = 'Sample from built-in procedural pattern';
        resampleBtn.disabled = !planetConfigManager.isBuiltinPattern(patternId);
        resampleBtn.addEventListener('click', () => {
            const sampled = this.sampleBuiltinPattern(patternId);
            draft.width = sampled.width;
            draft.height = sampled.height;
            draft.cellSize = sampled.cellSize;
            draft.cells = sampled.cells.slice();
            draft.id = sampled.id;
            draft.name = sampled.name;
            idInput.value = draft.id;
            redraw();
        });

        tools.appendChild(paintBtn);
        tools.appendChild(eraseBtn);
        tools.appendChild(clearBtn);
        tools.appendChild(fillBtn);
        tools.appendChild(resampleBtn);

        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'LMB paint · RMB erase · tile repeats in preview';

        const actions = document.createElement('div');
        actions.className = 'pe-pattern-editor-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'pe-btn pe-primary';
        saveBtn.textContent = 'SAVE';
        saveBtn.addEventListener('click', () => {
            let saveId = String(idInput.value || '').trim().replace(/\s+/g, '_').toLowerCase();
            if (!saveId) saveId = patternId;
            if (!planetConfigManager.isBuiltinPattern(patternId) && saveId !== patternId) {
                if (planetConfigManager.hasCustomPattern(saveId) || planetConfigManager.isBuiltinPattern(saveId)) {
                    saveId = planetConfigManager.nextCustomPatternId();
                }
                if (planetConfigManager.hasCustomPattern(patternId)) {
                    planetConfigManager.deleteCustomPattern(patternId);
                }
            }
            draft.id = saveId;
            draft.name = saveId;
            planetConfigManager.setCustomPattern(saveId, draft);
            if (layer) {
                layer.pattern = saveId;
                if (currentName) currentName.textContent = saveId;
                if (currentCanvas) {
                    const color = planetConfigManager.resolveLayerColor(layer);
                    this.drawPatternThumbnail(currentCanvas, saveId, color);
                }
                const card = currentCanvas && currentCanvas.closest('.pe-layer-card');
                if (card) {
                    const summaryEl = card.querySelector('.pe-layer-summary');
                    if (summaryEl) summaryEl.textContent = saveId;
                }
            }
            this.closePatternEditor();
            this.renderControls();
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'pe-btn';
        delBtn.textContent = planetConfigManager.isBuiltinPattern(patternId) ? 'RESET' : 'DELETE';
        delBtn.addEventListener('click', () => {
            if (planetConfigManager.hasCustomPattern(patternId)) {
                planetConfigManager.deleteCustomPattern(patternId);
            }
            if (layer && !planetConfigManager.isBuiltinPattern(patternId)) {
                layer.pattern = 'grid';
            }
            this.closePatternEditor();
            this.renderControls();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'pe-btn';
        cancelBtn.textContent = 'CANCEL';
        cancelBtn.addEventListener('click', () => this.closePatternEditor());

        actions.appendChild(saveBtn);
        actions.appendChild(delBtn);
        actions.appendChild(cancelBtn);

        dialog.appendChild(head);
        dialog.appendChild(idRow);
        dialog.appendChild(canvasWrap);
        dialog.appendChild(tools);
        dialog.appendChild(hint);
        dialog.appendChild(actions);
        modal.appendChild(dialog);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePatternEditor();
        });

        const overlay = document.getElementById('planetEditorOverlay');
        if (overlay) overlay.appendChild(modal);
        else document.body.appendChild(modal);

        this.patternEditor = { patternId, draft, onUp };
        redraw();
    }

    closePatternEditor() {
        const modal = document.getElementById('pePatternEditor');
        if (!modal) {
            if (this.patternEditor && this.patternEditor.onUp) {
                window.removeEventListener('mouseup', this.patternEditor.onUp);
            }
            this.patternEditor = null;
            return false;
        }
        if (this.patternEditor && this.patternEditor.onUp) {
            window.removeEventListener('mouseup', this.patternEditor.onUp);
        }
        modal.remove();
        this.patternEditor = null;
        return true;
    }

    drawPatternThumbnail(canvas, patternId, color) {
        if (!canvas || !patternId) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (typeof parallaxManager === 'undefined' || !parallaxManager.drawLayerPattern) {
            ctx.fillStyle = color || '#808080';
            ctx.fillRect(4, 4, w - 8, h - 8);
            return;
        }

        ctx.save();
        ctx.scale(w / 400, h / 600);
        const fakeLayer = {
            pattern: patternId,
            y: 0,
            color: color || '#808080',
            colorSource: 'custom',
            opacity: 1,
            visible: true
        };
        ctx.globalAlpha = 0.85;
        parallaxManager.drawLayerPattern(ctx, fakeLayer, 0);
        ctx.restore();
    }

    halveAllLayerOpacity() {
        (this.draft.backgroundLayers || []).forEach(layer => {
            layer.opacity = Math.max(0, (layer.opacity != null ? layer.opacity : 0.15) * 0.5);
        });
        this.renderControls();
    }

    save() {
        if (typeof planetConfigManager === 'undefined' || !this.draft) return;
        this.syncObstacleTypesFromDraft();
        planetConfigManager.setConfig(this.selectedPlanet, this.draft);
        if (typeof planetConfigManager.saveGalaxies === 'function') {
            planetConfigManager.saveGalaxies();
        }
        this.loadDraft();
        this.flashStatus('Saved');
    }

    reset() {
        if (typeof planetConfigManager === 'undefined') return;
        if (this.galaxyColorBaseline) {
            const { galaxyId, baseColor } = this.galaxyColorBaseline;
            planetConfigManager.setGalaxyBaseColor(galaxyId, baseColor, { persist: false });
        }
        planetConfigManager.resetPlanet(this.selectedPlanet);
        this.loadDraft();
        this.renderControls();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.applyForPlanet(this.selectedPlanet, null);
        }
        this.flashStatus('Reset');
    }

    flashStatus(msg) {
        const header = document.querySelector('.planet-editor-header h2');
        if (!header) return;
        const prev = header.textContent;
        header.textContent = msg.toUpperCase();
        setTimeout(() => { header.textContent = prev; }, 700);
    }

    startPreview() {
        this.stopPreview();
        if (this.previewCanvas) {
            this.syncPreviewPlayfield();
            if (!this.previewCtx) {
                this.previewCtx = this.previewCanvas.getContext('2d');
            }
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        const viewport = document.getElementById('pePreviewViewport');
        if (viewport && typeof ResizeObserver !== 'undefined') {
            if (this._previewResizeObs) this._previewResizeObs.disconnect();
            this._previewResizeObs = new ResizeObserver(() => {
                if (this.visible) this.applyPreviewView();
            });
            this._previewResizeObs.observe(viewport);
        }
        this.applyPreviewView();
        let lastTs = 0;
        const tick = (ts) => {
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
        if (this._previewResizeObs) {
            this._previewResizeObs.disconnect();
            this._previewResizeObs = null;
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
    }

    drawPreview() {
        if (!this.previewCtx || !this.draft) return;
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const t = performance.now() / 1000;
        const canDraw = typeof parallaxManager !== 'undefined' && parallaxManager.drawLayerPattern;

        // Draw like in-game: parallax patterns are authored in 400×600 space and
        // clipped to the 240×300 playfield (no squash-to-fit).
        (this.draft.backgroundLayers || []).forEach((layer) => {
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

        this.drawObstaclePreviews(ctx, w, h);
        this.drawSideEnemyPreviews(ctx, w, h);
        ctx.globalAlpha = 1;
    }

    pickPreviewObstacleDef() {
        const defs = (this.draft && this.draft.obstacles) || [];
        if (!defs.length) return null;
        let total = 0;
        defs.forEach((d) => { total += Math.max(1, d.weight || 1); });
        let r = Math.random() * total;
        for (let i = 0; i < defs.length; i++) {
            r -= Math.max(1, defs[i].weight || 1);
            if (r <= 0) return defs[i];
        }
        return defs[defs.length - 1];
    }

    spawnPreviewObstacle(w, h) {
        const def = this.pickPreviewObstacleDef();
        if (!def) return;
        let obs;
        if (typeof obstacleManager !== 'undefined' && obstacleManager.createObstacleFromDef) {
            const direction = def.direction || 'ltr';
            const origin = obstacleManager.spawnOriginForDirection
                ? obstacleManager.spawnOriginForDirection(direction, def.width, def.height, { width: w, height: h })
                : { x: -def.width, y: Math.random() * Math.max(1, h - (def.height || 18)) };
            obs = obstacleManager.createObstacleFromDef(def, { x: origin.x, y: origin.y });
        } else {
            const speeds = { horizontalSpeed: def.speed || 0.8, verticalSpeed: (def.speed || 0.8) * 0.3 };
            obs = {
                x: - (def.width || 18),
                y: Math.random() * Math.max(1, h - (def.height || 18)),
                width: def.width || 18,
                height: def.height || 18,
                horizontalSpeed: speeds.horizontalSpeed,
                verticalSpeed: speeds.verticalSpeed,
                type: def.type,
                kind: def.kind,
                isFog: def.kind === 'fog',
                reflectsShots: !!def.reflectsShots,
                sprite: def.sprite,
                opacity: def.opacity != null ? def.opacity : 1
            };
        }
        this.previewObstacles.push(obs);
    }

    spawnPreviewClusterWave(w, h) {
        const defs = (this.draft && this.draft.obstacles) || [];
        if (!defs.length) return;
        const clusters = {};
        defs.forEach((d) => {
            const c = d.cluster || 'alpha';
            if (!clusters[c]) clusters[c] = [];
            clusters[c].push(d);
        });
        const keys = Object.keys(clusters);
        const clusterId = keys[Math.floor(Math.random() * keys.length)];
        const members = clusters[clusterId];
        const lead = members[0];
        members.forEach((def, i) => {
            this.spawnPreviewObstacle(w, h);
            const o = this.previewObstacles[this.previewObstacles.length - 1];
            if (!o) return;
            const col = i % 3;
            const row = Math.floor(i / 3);
            o.x = 10 + col * ((def.width || 18) * 0.95);
            o.y = Math.max(0, Math.min(h - (def.height || 18),
                (lead ? (o.y) : h * 0.3) + row * ((def.height || 18) * 0.95)));
            if (typeof obstacleManager !== 'undefined' && obstacleManager.directionToSpeed) {
                const sp = obstacleManager.directionToSpeed(def.direction || 'ltr', def.speed);
                o.horizontalSpeed = sp.horizontalSpeed;
                o.verticalSpeed = sp.verticalSpeed;
            }
        });
    }

    updatePreviewObstacles(dtMs) {
        if (!this.draft || !this.previewCanvas) return;
        const defs = this.draft.obstacles || [];
        if (!defs.length) {
            this.previewObstacles = [];
            this.previewObstacleSpawnAcc = 0;
            return;
        }

        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const frames = dtMs / 16.67;

        const interval = Math.max(400, this.draft.obstacleSpawnRate || 2000);
        this.previewObstacleSpawnAcc += dtMs;
        while (this.previewObstacleSpawnAcc >= interval) {
            this.previewObstacleSpawnAcc -= interval;
            if (Math.random() < 0.6) this.spawnPreviewClusterWave(w, h);
            else this.spawnPreviewObstacle(w, h);
        }
        if (this.previewObstacles.length === 0) {
            this.spawnPreviewClusterWave(w, h);
            this.previewObstacles.forEach((o) => {
                o.x = Math.random() * w * 0.6;
            });
        }

        const margin = 40;
        this.previewObstacles = this.previewObstacles.filter((o) => {
            o.x += o.horizontalSpeed * frames;
            o.y += o.verticalSpeed * frames;
            return o.x < w + margin && o.y < h + margin && o.x > -margin && o.y > -margin;
        });
    }

    drawObstaclePreviews(ctx, w, h) {
        const list = this.previewObstacles || [];
        if (!list.length) return;

        // Fog first, then solid obstacles (preview has no player LoS occlusion needed beyond draw order)
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

    drawSideEnemyPreviews(ctx, w, h) {
        const enemies = this.draft.enemies || this.draft.sideEnemies || [];
        if (!enemies.length) return;

        enemies.slice(0, 4).forEach((entry, i) => {
            const shipW = 18;
            const shipH = 14;
            const x = w - shipW - 8;
            const y = 16 + i * 36;
            ctx.save();
            ctx.globalAlpha = 0.9;
            if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
                graphicsManager.renderEnemyShip(ctx, {
                    x, y, width: shipW, height: shipH, type: entry.type
                }, 0.85);
            } else {
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--current-accent').trim() || '#999';
                ctx.fillRect(x, y, shipW, shipH);
            }
            if (entry.champion) {
                ctx.strokeStyle = '#c45c26';
                ctx.lineWidth = 1;
                ctx.strokeRect(x - 2, y - 2, shipW + 4, shipH + 4);
            }
            ctx.restore();
            ctx.fillStyle = '#888';
            ctx.font = '8px Courier New, monospace';
            ctx.textAlign = 'right';
            const label = [
                entry.champion ? '★' : '',
                entry.type || 'enemy',
                entry.faction ? '[' + entry.faction + ']' : '',
                entry.enemyClass || '',
                '#' + (entry.cluster || 'alpha'),
                '@' + (entry.spawnAt != null ? entry.spawnAt : 0) + 's'
            ].filter(Boolean).join(' ');
            ctx.fillText(label, x - 4, y + 10);
        });
    }
}

const planetEditorUI = new PlanetEditorUI();
