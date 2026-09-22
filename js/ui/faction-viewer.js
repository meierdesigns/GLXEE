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

    bindPreviewControls() {
        const overlay = this.overlay;
        this.previewCanvas = overlay.querySelector('#fvPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#fvZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#fvZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#fvZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#fvPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#fvPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#fvPreviewViewport');
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

    applyPreviewView() {
        const wrap = this.overlay && this.overlay.querySelector('#fvPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#fvZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#fvPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#fvPreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewCanvas.width / this.previewCanvas.height || (2 / 3);
            let fitW = availW;
            let fitH = fitW / aspect;
            if (fitH > availH) {
                fitH = availH;
                fitW = fitH * aspect;
            }
            this.previewCanvas.style.width = `${Math.round(fitW)}px`;
            this.previewCanvas.style.height = `${Math.round(fitH)}px`;
            this.previewCanvas.style.transform =
                `translate(${this.previewPanX}px, ${this.previewPanY}px) scale(${this.previewZoom})`;
        }
    }

    startPreview() {
        this.stopPreview();
        this.previewLastTs = 0;
        if (!this.previewSim) this.resetPreviewSim();
        const loop = () => {
            if (!this.visible) return;
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(loop);
        };
        this.previewAnimId = requestAnimationFrame(loop);
    }

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewLastTs = 0;
    }

    cleanupPreviewControls() {
        if (this._previewCleanup) {
            this._previewCleanup();
            this._previewCleanup = null;
        }
    }

    resetPreviewSim() {
        this.previewSim = { phase: 0, rings: [] };
        this.previewLastTs = 0;
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        if (!sim) return;
        sim.phase += dtMs * 0.003;
        if (!sim.rings.length || sim.rings[sim.rings.length - 1].life < 700) {
            if ((sim._acc = (sim._acc || 0) + dtMs) >= 900) {
                sim._acc = 0;
                sim.rings.push({ r: 18, life: 1400, max: 1400 });
            }
        }
        sim.rings = sim.rings.filter((r) => {
            r.r += dtMs * 0.04;
            r.life -= dtMs;
            return r.life > 0;
        });
    }

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const f = this.factions[this.selectedIndex];
        if (!canvas || !ctx || !f) return;

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const tint = this.themeColor();
        const accent = this.factionAccent(f);
        const sim = this.previewSim;

        ctx.fillStyle = '#050805';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h * 0.42;

        sim.rings.forEach((r) => {
            const a = Math.max(0, r.life / r.max) * 0.45;
            ctx.strokeStyle = accent;
            ctx.globalAlpha = a;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r.r, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        const pulse = 0.85 + Math.sin(sim.phase) * 0.15;
        ctx.save();
        ctx.translate(cx, cy - 28);
        ctx.scale(pulse, pulse);
        if (typeof iconRenderer !== 'undefined' && iconRenderer.drawToCanvas) {
            const tmp = document.createElement('canvas');
            tmp.width = 64;
            tmp.height = 64;
            iconRenderer.drawToCanvas(tmp, f.icon, tint);
            ctx.drawImage(tmp, -32, -32, 64, 64);
        }
        ctx.restore();

        // Sample fleet row: one ship per enemyClass
        const classes = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classes)
            ? factionShipStyles.classes
            : ['scout', 'assault', 'heavy', 'elite', 'capital'];
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            const rowY = h * 0.68;
            const slotW = (w - 24) / classes.length;
            classes.forEach((cls, i) => {
                const sx = 12 + slotW * i + slotW * 0.5 - 8;
                graphicsManager.renderEnemyShip(ctx, {
                    x: sx,
                    y: rowY,
                    width: 16,
                    height: 12,
                    faction: f.id,
                    enemyClass: cls,
                    tier: (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
                        ? factionShipStyles.classTier[cls]
                        : (i + 1),
                    type: 'enemyBasic'
                }, 0.55);
            });
        }

        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.globalAlpha = 1;

        ctx.fillStyle = tint;
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(f.label || f.id).toUpperCase(), cx, h - 48);
        ctx.font = '9px "Courier New", monospace';
        ctx.globalAlpha = 0.75;
        ctx.fillText(this.resolveGalaxyName(f.homeGalaxy), cx, h - 32);
        ctx.fillText('FACTION ARCHIVE', cx, h - 16);
        ctx.globalAlpha = 1;
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#fvList');
        if (!list) return;
        list.innerHTML = '';
        this.factions.forEach((faction, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            const emblemKey = (typeof factionShipStyles !== 'undefined' && factionShipStyles.emblemKey)
                ? factionShipStyles.emblemKey(faction.id)
                : ('faction-' + faction.id);
            btn.setAttribute('data-ag-type', 'faction');
            btn.setAttribute('data-ag-id', emblemKey);
            btn.setAttribute('data-ag-key', emblemKey);
            btn.innerHTML =
                `<span class="cv-ability-icon cv-list-ability-icon" data-icon="${faction.icon}" data-ag-key="${emblemKey}">${this.iconHtml(faction.icon, 32, faction.label || faction.id)}</span>` +
                `<span class="cv-item-label">${faction.label}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? devProfileToggles.badgesHtml({
                        known: profileManager.hasDiscoveredFaction(faction.id)
                    })
                    : '') +
                `</span>`;
            btn.addEventListener('click', () => {
                this.selectedIndex = index;
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
            });
            list.appendChild(btn);
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#fvDetail');
        const f = this.factions[this.selectedIndex];
        if (!root || !f) return;
        const traits = (f.traits || []).map((t) => String(t).toUpperCase()).join(' · ') || '—';
        const lore = f.loreLong || f.lore || 'No archive entry.';
        const enemyCount = this.countRelatedEnemies(f.id);
        const planetCount = this.countRelatedPlanets(f.id);
        const emblemKey = (typeof factionShipStyles !== 'undefined' && factionShipStyles.emblemKey)
            ? factionShipStyles.emblemKey(f.id)
            : ('faction-' + f.id);
        const classes = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classes)
            ? factionShipStyles.classes
            : ['scout', 'assault', 'heavy', 'elite', 'capital'];
        const fleetHtml = classes.map((cls) => {
            const shipKey = (typeof factionShipStyles !== 'undefined' && factionShipStyles.spriteKey)
                ? factionShipStyles.spriteKey(f.id, cls)
                : ('enemy-' + f.id + '-' + cls);
            return `<button type="button" class="pe-btn fv-fleet-chip" data-ag-type="factionShip" data-ag-id="${shipKey}" data-ag-key="${shipKey}" title="${shipKey}">${String(cls).toUpperCase()}</button>`;
        }).join('');
        root.innerHTML = `
            <div class="content-viewer-hero" data-ag-type="faction" data-ag-id="${emblemKey}" data-ag-key="${emblemKey}">
                <div class="cv-ability-hero-icon" data-icon="${f.icon}" data-ag-key="${emblemKey}">${this.iconHtml(f.icon, 64, f.label || f.id)}</div>
                <div>
                    <h3 class="content-viewer-name">${f.label}</h3>
                    <p class="content-viewer-desc">${f.lore || ''}</p>
                </div>
            </div>
            <div class="content-viewer-stats cv-stat-clusters cv-stat-clusters-plain">
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Identity</div>
                    <div class="stat-row"><span class="stat-label">Faction</span><span class="stat-value">${f.label}</span></div>
                    <div class="stat-row"><span class="stat-label">Home</span><span class="stat-value">${this.resolveGalaxyName(f.homeGalaxy)}</span></div>
                    <div class="stat-row"><span class="stat-label">Traits</span><span class="stat-value">${traits}</span></div>
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Archive Links</div>
                    <div class="stat-row"><span class="stat-label">Enemy types</span><span class="stat-value">${enemyCount}</span></div>
                    <div class="stat-row"><span class="stat-label">Planet tags</span><span class="stat-value">${planetCount}</span></div>
                    <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${f.id}</span></div>
                </div>
            </div>
            <div class="cv-stat-cluster">
                <div class="cv-stat-cluster-title">Fleet Classes · hover+# generate</div>
                <div class="fv-fleet-row">${fleetHtml}</div>
            </div>
            <div class="cv-stat-cluster fv-lore-block">
                <div class="cv-stat-cluster-title">Lore</div>
                <p class="content-viewer-desc fv-lore-text">${lore}</p>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const f = this.factions[this.selectedIndex];
            menuStateManager.setScreen('faction-viewer', { factionId: f ? f.id : 'terran' });
        }
    }

    handleKeyDown(e) {
        if (!this.visible) return;
        if (this._devToggles && this._devToggles.handleKey(e)) return;
        if (e.key === 'Escape' && this.previewFullscreen) {
            e.preventDefault();
            this.setPreviewFullscreen(false);
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.selectedIndex = Math.min(this.factions.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    close() {
        this.hide();
        const container = document.querySelector('.game-container');
        const inGame = container && container.style.display !== 'none';
        if (inGame) {
            if (typeof menuStateManager !== 'undefined') menuStateManager.setScreen('ingame');
            return;
        }
        if (this.onClose) {
            const cb = this.onClose;
            this.onClose = null;
            cb();
            return;
        }
        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'explorations',
                focusExplore: 'factions',
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') startScreenManager.show();
                }
            });
        } else if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        } else if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
    }
}

const factionViewerUI = new FactionViewerUI();
