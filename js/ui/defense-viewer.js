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

    applyPreviewView() {
        const wrap = this.overlay && this.overlay.querySelector('#dvPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#dvZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#dvPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#dvPreviewViewport');
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
        this.previewSim = {
            phase: 0,
            shipX: 90,
            shipDir: 1,
            hits: [],
            shield: 1,
            hitAcc: 0
        };
        this.previewLastTs = 0;
    }

    isShieldSystem(id) {
        return String(id || '').includes('shield');
    }

    isArmorSystem(id) {
        return String(id || '').includes('armor');
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const item = this.items[this.selectedIndex];
        if (!sim || !item) return;
        const frameScale = dtMs / 16.67;
        sim.phase += dtMs * 0.004;
        sim.shipX += sim.shipDir * 0.4 * frameScale;
        if (sim.shipX <= 50 || sim.shipX >= 130) {
            sim.shipDir *= -1;
            sim.shipX = Math.max(50, Math.min(130, sim.shipX));
        }

        if (this.isShieldSystem(item.id) && item.id.includes('regen')) {
            sim.shield = Math.min(1, sim.shield + dtMs * 0.00035);
        }

        sim.hitAcc += dtMs;
        if (sim.hitAcc >= 900) {
            sim.hitAcc = 0;
            const fromLeft = Math.random() > 0.5;
            sim.hits.push({
                x: fromLeft ? -8 : 208,
                y: 40 + Math.random() * 80,
                vx: fromLeft ? 2.4 : -2.4,
                vy: 1.6,
                life: 1400
            });
        }

        const cx = sim.shipX + 10;
        const cy = 160;
        const absorbR = this.isArmorSystem(item.id)
            ? (item.id.includes('massive') ? 20 : 16)
            : (22 + (item.tier || 1) * 2);

        sim.hits = sim.hits.filter((b) => {
            b.x += b.vx * frameScale;
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            const dx = b.x - cx;
            const dy = b.y - cy;
            if (dx * dx + dy * dy < absorbR * absorbR) {
                if (this.isShieldSystem(item.id)) {
                    sim.shield = Math.max(0.15, sim.shield - 0.18);
                }
                b.life = 0;
                sim.hits.push({
                    x: b.x,
                    y: b.y,
                    vx: 0,
                    vy: 0,
                    life: 280,
                    spark: true
                });
            }
            return b.life > 0 && b.y < 310;
        });
    }

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const item = this.items[this.selectedIndex];
        if (!canvas || !ctx || !item) return;
        canvas.setAttribute('data-ag-type', 'ability');
        canvas.setAttribute('data-ag-id', item.id);
        if (item.mountSprite) canvas.setAttribute('data-ag-key', item.mountSprite);
        else if (item.icon) canvas.setAttribute('data-ag-key', item.icon);
        else canvas.setAttribute('data-ag-key', item.id);

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;
        const tint = this.themeColor();
        const cx = sim.shipX + 10;
        const cy = 160;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.28)';
        for (let i = 0; i < 32; i++) {
            const sx = (i * 91) % w;
            const sy = (i * 57 + Math.floor(sim.phase * 16)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        for (const b of sim.hits) {
            if (b.spark) {
                ctx.fillStyle = tint;
                ctx.globalAlpha = Math.max(0, b.life / 280);
                ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
                ctx.globalAlpha = 1;
            } else {
                ctx.fillStyle = '#c04020';
                ctx.fillRect(b.x, b.y, 3, 6);
            }
        }

        if (this.isArmorSystem(item.id)) {
            const thick = item.id.includes('massive') ? 4 : 2;
            ctx.strokeStyle = tint;
            ctx.lineWidth = thick;
            ctx.globalAlpha = 0.7;
            ctx.strokeRect(cx - 14 - thick, cy - 12 - thick, 28 + thick * 2, 28 + thick * 2);
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }

        if (this.isShieldSystem(item.id)) {
            const baseR = 20 + (item.tier || 1) * 2;
            const pulse = Math.sin(sim.phase * 4) * 2;
            ctx.strokeStyle = tint;
            ctx.globalAlpha = 0.35 + sim.shield * 0.45;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR + pulse, 0, Math.PI * 2);
            ctx.stroke();
            if (item.id.includes('adaptive')) {
                ctx.globalAlpha = 0.25;
                ctx.beginPath();
                ctx.arc(cx, cy, baseR + 6 + pulse, sim.phase, sim.phase + Math.PI);
                ctx.stroke();
            }
            if (item.id.includes('regen')) {
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(cx, cy, baseR - 3, -Math.PI / 2, -Math.PI / 2 + sim.shield * Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = tint;
        ctx.fillRect(cx - 4, cy - 8, 8, 14);
        ctx.fillRect(cx - 10, cy, 20, 6);
        ctx.fillRect(cx - 8, cy + 6, 4, 4);
        ctx.fillRect(cx + 4, cy + 6, 4, 4);

        if (typeof iconRenderer !== 'undefined' && item.icon) {
            const tmp = document.createElement('canvas');
            tmp.width = 40;
            tmp.height = 40;
            iconRenderer.drawToCanvas(tmp, item.icon, tint);
            ctx.drawImage(tmp, w / 2 - 20, 24, 40, 40);
        }

        ctx.fillStyle = tint;
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(item.name || item.id).toUpperCase(), w / 2, h - 34);
        ctx.font = '9px "Courier New", monospace';
        ctx.globalAlpha = 0.75;
        ctx.fillText(`TIER ${item.tier}  ${String(item.type || '').toUpperCase()}`, w / 2, h - 20);
        ctx.fillText(item.uiDescription || 'DEFENSE', w / 2, h - 8);
        ctx.globalAlpha = 1;
    }

    iconHtml(icon, size, tipLabel) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.resolveIconHtml(icon, size || 16, 'cv-ability-icon-img', tipLabel);
        }
        return icon || '◆';
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#dvList');
        if (!list) return;
        list.innerHTML = '';
        this.items.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            btn.innerHTML =
                `<span class="cv-ability-icon cv-list-ability-icon">${this.iconHtml(item.icon, 16, item.name)}</span>` +
                `<span class="cv-item-label">${item.name}${item.custom ? ' *' : ''}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? devProfileToggles.badgesHtml({
                        known: profileManager.isDiscovered('defenses', item.id),
                        owned: profileManager.getPartCount('defense', item.id) > 0
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
        const root = this.overlay && this.overlay.querySelector('#dvDetail');
        const a = this.items[this.selectedIndex];
        if (!root || !a) return;
        root.innerHTML = `
            <div class="content-viewer-hero">
                <div class="cv-ability-hero-icon">${this.iconHtml(a.icon, 48, a.name)}</div>
                <div>
                    <h3 class="content-viewer-name">${a.name}</h3>
                    <p class="content-viewer-desc">${a.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">System</span><span class="stat-value">DEFENSE</span></div>
                <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value">${String(a.type || '—').toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Tier</span><span class="stat-value">${a.tier}</span></div>
                <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${a.id}</span></div>
                <div class="stat-row"><span class="stat-label">Summary</span><span class="stat-value">${a.uiDescription || '—'}</span></div>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const a = this.items[this.selectedIndex];
            menuStateManager.setScreen('defense-viewer', { defenseId: a ? a.id : 'heavy_armor' });
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
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    openEditor() {
        const item = this.items[this.selectedIndex];
        if (!item || typeof abilityEditorUI === 'undefined') return;
        this.hide();
        abilityEditorUI.show(item.id, false, { returnTo: 'defense-viewer' });
    }

    openGfxEditor() {
        const item = this.items[this.selectedIndex];
        if (!item || typeof componentEditorUI === 'undefined') return;
        let type = 'mount';
        let id = item.mountSprite || ('mount_' + item.id);
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(id) || assetGenRegistry.get('ability', item.id);
            if (hit) {
                type = hit.type;
                id = hit.id;
            }
        }
        const returnCb = this.onClose;
        this.hide();
        componentEditorUI.open({
            type: type,
            id: id,
            returnTo: 'defense-viewer',
            onClose: () => {
                this.show({ onClose: returnCb });
            }
        });
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
                focusExplore: 'defenses',
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

const defenseViewerUI = new DefenseViewerUI();
