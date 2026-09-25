"use strict";

/**
 * Faction Viewer — archive lore + emblems for discovered peoples.
 * Open: Explorations → ARCHIVE → FACTIONS
 */
class FactionViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.factions = [];
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

    getFactionList() {
        const all = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionList)
            ? planetConfigManager.getFactionList()
            : [
                { id: 'terran', label: 'TERRAN', icon: 'factionTerran', lore: '', loreLong: '', traits: [], homeGalaxy: 'milky_way' }
            ];
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        if (devMode || typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) {
            return all.slice();
        }
        const allowed = {};
        profileManager.getDiscoveredFactions().forEach((id) => {
            allowed[String(id).toLowerCase()] = true;
        });
        return all.filter((f) => !!allowed[String(f.id).toLowerCase()]);
    }

    resolveGalaxyName(galaxyId) {
        if (!galaxyId || typeof planetConfigManager === 'undefined') return '—';
        const g = planetConfigManager.getGalaxy(galaxyId);
        return (g && g.name) ? String(g.name).toUpperCase() : String(galaxyId).replace(/_/g, ' ').toUpperCase();
    }

    countRelatedEnemies(factionId) {
        const id = String(factionId || '').toLowerCase();
        if (!id || typeof enemyConfigManager === 'undefined') return 0;
        let n = 0;
        (enemyConfigManager.getTypeIds() || []).forEach((typeId) => {
            const cfg = enemyConfigManager.getConfig(typeId);
            const list = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
                ? cfg.factions
                : (enemyConfigManager.getDefaultFaction
                    ? [enemyConfigManager.getDefaultFaction(typeId)]
                    : []);
            if (list.some((f) => String(f).toLowerCase() === id)) n += 1;
        });
        return n;
    }

    countRelatedPlanets(factionId) {
        const id = String(factionId || '').toLowerCase();
        if (!id || typeof planetConfigManager === 'undefined') return 0;
        let n = 0;
        const ids = planetConfigManager.getPlanetIds
            ? planetConfigManager.getPlanetIds()
            : Object.keys(planetConfigManager.configs || {});
        (ids || []).forEach((pid) => {
            const cfg = planetConfigManager.getConfig
                ? planetConfigManager.getConfig(pid)
                : (planetConfigManager.configs && planetConfigManager.configs[pid]);
            const list = (cfg && Array.isArray(cfg.factions)) ? cfg.factions : [];
            if (list.some((f) => String(f).toLowerCase() === id)) n += 1;
        });
        return n;
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.factions = this.getFactionList();
        if (!this.factions.length) return;
        const preferId = options && options.factionId;
        if (preferId) {
            const idx = this.factions.findIndex((f) => f.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.factions.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('faction-viewer', {
                factionId: this.factions[this.selectedIndex].id
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

    iconHtml(key, size, tipLabel) {
        if (typeof iconRenderer !== 'undefined') {
            const html = iconRenderer.imgHtml(key, size || 16, 'cv-ability-icon-img', undefined, tipLabel);
            if (html) return html;
        }
        return '◆';
    }

    themeColor() {
        if (typeof iconRenderer !== 'undefined' && iconRenderer.getThemeTint) {
            return iconRenderer.getThemeTint() || '#80ff80';
        }
        return '#80ff80';
    }

    factionAccent(faction) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme) {
            const theme = planetConfigManager.getFactionPlanetTheme(faction && faction.id);
            if (theme && theme.baseColor) return theme.baseColor;
        }
        return this.themeColor();
    }

    createUI() {
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        if (this.overlay) this.overlay.remove();

        this.overlay = document.createElement('div');
        this.overlay.className = 'content-viewer-overlay fv-viewer';
        this.overlay.innerHTML = `
            <div class="content-viewer-panel">
                <h2 class="content-viewer-title">FACTIONS</h2>
                <div class="content-viewer-body has-preview" id="fvViewerBody">
                    <aside class="content-viewer-list" id="fvList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize faction list"></div>
                    <div class="content-viewer-detail" id="fvDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="fvPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="fvZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="fvZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="fvZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="fvZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="fvPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="fvPreviewViewport">
                            <canvas id="fvPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">EMBLEM · FLEET</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="fvClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">↑↓ Navigate • ESC Close</div>
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

        this.overlay.querySelector('#fvClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const f = this.factions[this.selectedIndex];
                return !!(f && profileManager.hasDiscoveredFaction(f.id));
            },
            toggleKnown: () => {
                const f = this.factions[this.selectedIndex];
                if (!f || f.id === 'terran') return;
                if (profileManager.hasDiscoveredFaction(f.id)) {
                    profileManager.undiscover('factions', f.id);
                } else {
                    profileManager.discoverFaction(f.id);
                }
            },
            onChange: () => {
                this.factions = this.getFactionList();
                this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.factions.length - 1));
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#fvViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'fvPanelWidths',
            defaults: { left: 280, right: 260 },
            mins: { left: 180, right: 180, center: 200 },
            leftVar: '--cv-left-w',
            rightVar: '--cv-right-w',
            onChange: () => {
                if (this.visible) this.applyPreviewView();
            }
        });
    }
}
