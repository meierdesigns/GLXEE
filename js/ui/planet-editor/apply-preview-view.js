"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
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
    },

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('planet-editor', {
                planet: this.selectedPlanet,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    },

    toggle() {
        if (this.visible) this.requestClose();
        else this.show();
    },

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
    },

    requestClose() {
        this.withUnsavedCheck(() => this.hide());
    },

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
    },

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
    },

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
    },

    normalizeGalaxyColorValue(value) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.normalizeGalaxyBaseColor) {
            return planetConfigManager.normalizeGalaxyBaseColor(value);
        }
        return value == null || value === '' ? null : String(value).toUpperCase();
    },

    isGalaxyColorDirty() {
        if (!this.galaxyColorBaseline || typeof planetConfigManager === 'undefined') return false;
        const galaxyId = (this.draft && this.draft.galaxyId)
            || planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
        if (galaxyId !== this.galaxyColorBaseline.galaxyId) return false;
        const galaxy = planetConfigManager.getGalaxy(galaxyId);
        const current = galaxy ? (galaxy.baseColor || null) : null;
        return this.normalizeGalaxyColorValue(current)
            !== this.normalizeGalaxyColorValue(this.galaxyColorBaseline.baseColor);
    },

    isDraftDirty() {
        if (!this.draft || this.draftBaseline == null) return false;
        return JSON.stringify(this.draft) !== this.draftBaseline;
    },

    isDirty() {
        return this.isDraftDirty() || this.isGalaxyColorDirty();
    },

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
    },

    withUnsavedCheck(next) {
        if (typeof next !== 'function') return;
        if (this.unsavedDialog) return;
        if (!this.isDirty()) {
            next();
            return;
        }
        this.openUnsavedDialog(next);
    },

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
    },

    resolveUnsavedDialog(action) {
        if (!this.unsavedDialog) return;
        const { onContinue } = this.unsavedDialog;
        this.closeUnsavedDialog();
        if (action === 'save') this.save();
        else this.discardChanges();
        if (typeof onContinue === 'function') onContinue();
    },

    closeUnsavedDialog() {
        if (!this.unsavedDialog) return;
        if (this.unsavedDialog.modal && this.unsavedDialog.modal.parentNode) {
            this.unsavedDialog.modal.remove();
        }
        this.unsavedDialog = null;
        return true;
    },

    selectPlanet(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id || id === this.selectedPlanet) return;
        this.withUnsavedCheck(() => this.selectPlanetNow(id));
    },
});
