"use strict";

/**
 * Planet Viewer — browse planets by galaxy/system; open Planet Editor from here.
 * Open: Start menu → PLANETS, Pause → PLANETS
 */
class PlanetViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.planets = [];
        this.systems = [];
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
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        this._previewCfgId = null;
        this._keyHandler = (e) => this.handleKeyDown(e);
    }

    getPlanetData(id) {
        if (typeof planetConfigManager === 'undefined') {
            return {
                id: id,
                name: String(id).toUpperCase(),
                difficulty: '',
                description: '',
                galaxy: '',
                galaxyId: '',
                enemyCount: 0,
                layerCount: 0,
                stages: []
            };
        }
        const cfg = planetConfigManager.getConfig(id);
        const gid = planetConfigManager.getPlanetGalaxyId(id);
        const galaxy = planetConfigManager.getGalaxy(gid);
        const stages = cfg && cfg.stages
            ? Object.keys(cfg.stages).map((key) => {
                const stage = cfg.stages[key] || {};
                const enemies = Array.isArray(stage.enemies) ? stage.enemies.length : 0;
                return { key: key, enemies: enemies };
            })
            : [];
        return {
            id: id,
            name: (cfg && cfg.name) || id.toUpperCase(),
            difficulty: (cfg && cfg.difficulty) || '',
            description: (cfg && cfg.description) || '',
            galaxy: galaxy ? galaxy.name : '',
            galaxyId: gid || '',
            factions: (cfg && Array.isArray(cfg.factions)) ? cfg.factions.slice() : [],
            enemyCount: (cfg && cfg.enemies && cfg.enemies.length) || 0,
            layerCount: (cfg && cfg.backgroundLayers && cfg.backgroundLayers.length) || 0,
            stages: stages
        };
    }

    getSelectedConfig() {
        const p = this.planets[this.selectedIndex];
        if (!p || typeof planetConfigManager === 'undefined') return null;
        return planetConfigManager.getConfig(p.id) || null;
    }

    isPlanetVisible(galaxyId, planetId) {
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) {
            return true;
        }
        if (typeof profileManager === 'undefined' || !profileManager.getActiveProfile()) {
            return true;
        }
        const gid = galaxyId || (typeof planetConfigManager !== 'undefined'
            ? planetConfigManager.getPlanetGalaxyId(planetId)
            : null);
        if (!gid) return true;
        return profileManager.isPlanetUnlocked(gid, planetId)
            || profileManager.isPlanetCleared(gid, planetId);
    }

    buildSystems() {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyTree) {
            const tree = planetConfigManager.getGalaxyTree();
            this.systems = tree.map((g) => ({
                id: g.id,
                name: g.name,
                planets: (g.planets || [])
                    .filter((p) => this.isPlanetVisible(g.id, p.id))
                    .map((p) => this.getPlanetData(p.id))
            })).filter((sys) => sys.planets.length > 0);
        } else {
            const ids = ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
            this.systems = [{
                id: 'milky_way',
                name: 'MILKY WAY',
                planets: ids
                    .filter((id) => this.isPlanetVisible('milky_way', id))
                    .map((id) => this.getPlanetData(id))
            }].filter((sys) => sys.planets.length > 0);
        }
        this.planets = [];
        this.systems.forEach((sys) => {
            sys.planets.forEach((p) => this.planets.push(p));
        });
    }

    planetIconHtml(planetId, size) {
        const sid = String(planetId || 'mars').toLowerCase();
        const px = size || 32;
        if (typeof planetSVGManager !== 'undefined') {
            if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                planetSVGManager.init();
            }
            let svg = planetSVGManager.getPlanetSVG(sid);
            if (svg) {
                const uid = 'pv_' + sid + '_' + Math.random().toString(36).slice(2, 7);
                svg = svg
                    .replace(/id="([^"]+)"/g, (m, id) => `id="${uid}_${id}"`)
                    .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${uid}_${id})`)
                    .replace(/width="\d+"/, `width="${px}"`)
                    .replace(/height="\d+"/, `height="${px}"`);
                return `<span class="cv-icon cv-planet-icon">${svg}</span>`;
            }
        }
        return `<span class="cv-icon cv-planet-fallback" data-planet="${sid}" style="width:${px}px;height:${px}px"></span>`;
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.buildSystems();
        if (!this.planets.length) return;
        const preferId = options && options.planetId;
        if (preferId) {
            const idx = this.planets.findIndex((p) => p.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.planets.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('planet-viewer', {
                planet: this.planets[this.selectedIndex].id
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
                <h2 class="content-viewer-title">PLANETS</h2>
                <div class="content-viewer-body has-preview" id="pvViewerBody">
                    <aside class="content-viewer-list" id="pvList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize planet list"></div>
                    <div class="content-viewer-detail" id="pvDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="pvPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="pvZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="pvZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="pvZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="pvZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="pvPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="pvPreviewViewport">
                            <canvas id="pvPreview" width="240" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn pe-primary" id="pvEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="pvClose">CLOSE</button>
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
        this.startPreview();

        this.overlay.querySelector('#pvEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#pvClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    planetProgressFlags(planet) {
        if (!planet || typeof profileManager === 'undefined') {
            return { known: false, visited: false, cleared: false };
        }
        const gid = planet.galaxyId || (typeof planetConfigManager !== 'undefined'
            ? planetConfigManager.getPlanetGalaxyId(planet.id)
            : null);
        return {
            known: profileManager.isDiscovered('planets', planet.id),
            visited: !!(gid && (profileManager.isPlanetUnlocked(gid, planet.id)
                || profileManager.isPlanetCleared(gid, planet.id))),
            cleared: !!(gid && profileManager.isPlanetCleared(gid, planet.id))
        };
    }
}
