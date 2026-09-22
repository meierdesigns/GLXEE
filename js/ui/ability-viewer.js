"use strict";

/**
 * Ability Viewer — browse shared abilities; open Ability Editor from here.
 * Open: Start menu → ABILITIES
 */
class AbilityViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.abilities = [];
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

    getAbilityList() {
        if (typeof abilityConfigManager === 'undefined') return [];
        const grouped = abilityConfigManager.getIdsByCluster();
        const list = [];
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        const allowed = {};
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            profileManager.getDiscovered('abilities').forEach((id) => { allowed[id] = true; });
        }
        const filterDiscovery = !devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
        abilityConfigManager.clusterOrder.forEach((cluster) => {
            const ids = grouped[cluster.id] || [];
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
        });
        return list;
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.abilities = this.getAbilityList();
        if (!this.abilities.length) return;
        const preferId = options && options.abilityId;
        if (preferId) {
            const idx = this.abilities.findIndex((a) => a.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.abilities.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('ability-viewer', {
                abilityId: this.abilities[this.selectedIndex].id
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
                <h2 class="content-viewer-title">ABILITIES</h2>
                <div class="content-viewer-body has-preview" id="avViewerBody">
                    <aside class="content-viewer-list" id="avList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ability list"></div>
                    <div class="content-viewer-detail" id="avDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="avPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="avZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="avZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="avZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="avZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="avPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="avPreviewViewport">
                            <canvas id="avPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="avNew">NEW</button>
                    <button type="button" class="pe-btn pe-primary" id="avEdit">EDIT</button>
                    <button type="button" class="pe-btn" id="avEditGfx">EDIT GFX</button>
                    <button type="button" class="pe-btn" id="avDelete">DELETE</button>
                    <button type="button" class="pe-btn" id="avClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">↑↓ Navigate • N New • E Edit • DEL Delete • ESC Close</div>
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

        this.overlay.querySelector('#avNew').addEventListener('click', () => this.createNew());
        this.overlay.querySelector('#avEdit').addEventListener('click', () => this.openEditor());
        this.overlay.querySelector('#avEditGfx').addEventListener('click', () => this.openGfxEditor());
        this.overlay.querySelector('#avDelete').addEventListener('click', () => this.deleteSelected());
        this.overlay.querySelector('#avClose').addEventListener('click', () => this.close());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const a = this.abilities[this.selectedIndex];
                return !!(a && profileManager.isDiscovered('abilities', a.id));
            },
            toggleKnown: () => {
                const a = this.abilities[this.selectedIndex];
                if (a) profileManager.toggleDiscovered('abilities', a.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#avViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'avPanelWidths',
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
        this.previewCanvas = overlay.querySelector('#avPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#avZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#avZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#avZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#avPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#avPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#avPreviewViewport');
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
        const wrap = this.overlay && this.overlay.querySelector('#avPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#avZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#avPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#avPreviewViewport');
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
            pulses: [],
            particles: [],
            pulseAcc: 0
        };
        this.previewLastTs = 0;
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const a = this.abilities[this.selectedIndex];
        if (!sim || !a) return;
        const frameScale = dtMs / 16.67;
        sim.phase += dtMs * 0.004;
        const cluster = String(a.cluster || '');
        const speed = cluster === 'mobility' ? 1.4 : (cluster === 'offense' ? 0.7 : 0.45);
        sim.shipX += sim.shipDir * speed * frameScale;
        if (sim.shipX <= 36 || sim.shipX >= 144) {
            sim.shipDir *= -1;
            sim.shipX = Math.max(36, Math.min(144, sim.shipX));
        }

        sim.pulseAcc += dtMs;
        const interval = a.type === 'active' ? 700 : 1100;
        if (sim.pulseAcc >= interval) {
            sim.pulseAcc = 0;
            sim.pulses.push({ r: 8, life: 900, max: 900 });
            if (cluster === 'offense') {
                for (let i = 0; i < 4; i++) {
                    const ang = -Math.PI / 2 + (i - 1.5) * 0.22;
                    sim.particles.push({
                        x: sim.shipX + 10,
                        y: 150,
                        vx: Math.sin(ang) * 2.2,
                        vy: Math.cos(ang) * -3.2,
                        life: 900
                    });
                }
            }
        }

        sim.pulses = sim.pulses.filter((p) => {
            p.r += dtMs * 0.05;
            p.life -= dtMs;
            return p.life > 0;
        });
        sim.particles = sim.particles.filter((p) => {
            p.x += p.vx * frameScale;
            p.y += p.vy * frameScale;
            p.life -= dtMs;
            return p.life > 0;
        });
    }

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const a = this.abilities[this.selectedIndex];
        if (!canvas || !ctx || !a) return;
        canvas.setAttribute('data-ag-type', 'ability');
        canvas.setAttribute('data-ag-id', a.id);
        if (a.mountSprite) canvas.setAttribute('data-ag-key', a.mountSprite);
        else if (a.icon) canvas.setAttribute('data-ag-key', a.icon);
        else canvas.setAttribute('data-ag-key', a.id);

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;
        const tint = this.themeColor();
        const cluster = String(a.cluster || '');

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.28)';
        for (let i = 0; i < 32; i++) {
            const sx = (i * 89) % w;
            const sy = (i * 61 + Math.floor(sim.phase * 18)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        const cx = sim.shipX + 10;
        const cy = 150;

        for (const p of sim.pulses) {
            const alpha = Math.max(0, p.life / p.max);
            ctx.strokeStyle = tint;
            ctx.globalAlpha = alpha * 0.55;
            ctx.beginPath();
            ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (cluster === 'defense' || a.id.includes('shield') || a.id.includes('armor')) {
            const shieldR = 22 + Math.sin(sim.phase * 3) * 2 + (a.id.includes('massive') ? 6 : 0);
            ctx.strokeStyle = tint;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(cx, cy, shieldR, 0, Math.PI * 2);
            ctx.stroke();
            if (a.id.includes('regen')) {
                ctx.globalAlpha = 0.25 + Math.sin(sim.phase * 5) * 0.15;
                ctx.beginPath();
                ctx.arc(cx, cy, shieldR - 4, -Math.PI / 2, -Math.PI / 2 + (sim.phase % 1) * Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        if (cluster === 'mobility') {
            ctx.fillStyle = tint;
            ctx.globalAlpha = 0.35;
            for (let i = 1; i <= 4; i++) {
                ctx.fillRect(cx - 4 - sim.shipDir * i * 6, cy + 4, 4, 4);
            }
            ctx.globalAlpha = 1;
        }

        for (const p of sim.particles) {
            ctx.fillStyle = tint;
            ctx.globalAlpha = Math.max(0, p.life / 900);
            ctx.fillRect(p.x, p.y, 2, 6);
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = tint;
        ctx.fillRect(cx - 4, cy - 8, 8, 14);
        ctx.fillRect(cx - 10, cy, 20, 6);

        const iconKey = a.icon;
        if (typeof iconRenderer !== 'undefined' && iconKey) {
            const tmp = document.createElement('canvas');
            tmp.width = 48;
            tmp.height = 48;
            iconRenderer.drawToCanvas(tmp, iconKey, tint);
            if (tmp.width) ctx.drawImage(tmp, w / 2 - 24, 28, 48, 48);
        }

        ctx.fillStyle = tint;
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(a.name || a.id).toUpperCase(), w / 2, h - 34);
        ctx.font = '9px "Courier New", monospace';
        ctx.globalAlpha = 0.75;
        ctx.fillText(`${a.clusterLabel}  T${a.tier}`, w / 2, h - 20);
        ctx.fillText(String(a.type || '—').toUpperCase(), w / 2, h - 8);
        ctx.globalAlpha = 1;
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#avList');
        if (!list) return;
        list.innerHTML = '';
        let lastCluster = null;
        this.abilities.forEach((ability, index) => {
            if (ability.cluster !== lastCluster) {
                lastCluster = ability.cluster;
                const header = document.createElement('div');
                header.className = 'cv-list-group';
                header.textContent = ability.clusterLabel;
                list.appendChild(header);
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            btn.innerHTML =
                `<span class="cv-ability-icon cv-list-ability-icon">${typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.resolveIconHtml(ability.icon, 32, 'cv-ability-icon-img', ability.name) : ability.icon}</span>` +
                `<span class="cv-item-label">${ability.name}${ability.custom ? ' *' : ''}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? devProfileToggles.badgesHtml({
                        known: profileManager.isDiscovered('abilities', ability.id)
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
        this.updateDeleteButton();
    }

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#avDetail');
        const a = this.abilities[this.selectedIndex];
        if (!root || !a) return;
        root.innerHTML = `
            <div class="content-viewer-hero">
                <div class="cv-ability-hero-icon">${typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.resolveIconHtml(a.icon, 32, 'cv-ability-icon-img', a.name) : a.icon}</div>
                <div>
                    <h3 class="content-viewer-name">${a.name}</h3>
                    <p class="content-viewer-desc">${a.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">Cluster</span><span class="stat-value">${a.clusterLabel}</span></div>
                <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value">${String(a.type || '—').toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Tier</span><span class="stat-value">${a.tier}</span></div>
                <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${a.id}</span></div>
                <div class="stat-row"><span class="stat-label">Summary</span><span class="stat-value">${a.uiDescription || '—'}</span></div>
            </div>
        `;
        this.updateDeleteButton();
        if (this._devToggles) this._devToggles.refresh();
    }

    updateDeleteButton() {
        const btn = this.overlay && this.overlay.querySelector('#avDelete');
        const a = this.abilities[this.selectedIndex];
        if (!btn) return;
        btn.disabled = !(a && a.custom);
        btn.style.opacity = btn.disabled ? '0.4' : '1';
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const a = this.abilities[this.selectedIndex];
            menuStateManager.setScreen('ability-viewer', { abilityId: a ? a.id : 'player_control' });
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
                this.selectedIndex = Math.min(this.abilities.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                this.createNew();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.deleteSelected();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    createNew() {
        if (typeof abilityConfigManager === 'undefined') return;
        const ability = abilityConfigManager.createAbility({ name: 'New Ability' });
        this.abilities = this.getAbilityList();
        const idx = this.abilities.findIndex((a) => a.id === ability.id);
        this.selectedIndex = idx >= 0 ? idx : this.abilities.length - 1;
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
        this.openEditor();
    }

    deleteSelected() {
        const ability = this.abilities[this.selectedIndex];
        if (!ability || !ability.custom || typeof abilityConfigManager === 'undefined') return;
        abilityConfigManager.deleteAbility(ability.id);
        this.abilities = this.getAbilityList();
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.abilities.length - 1));
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
    }

    openEditor() {
        const ability = this.abilities[this.selectedIndex];
        if (!ability || typeof abilityEditorUI === 'undefined') return;
        this.hide();
        abilityEditorUI.show(ability.id, false, { returnTo: 'ability-viewer' });
    }

    openGfxEditor() {
        const ability = this.abilities[this.selectedIndex];
        if (!ability || typeof componentEditorUI === 'undefined') return;
        let type = 'ability';
        let id = ability.id;
        const mountKey = ability.mountSprite || null;
        if (mountKey && typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const mountHit = assetGenRegistry.findByKey(mountKey);
            if (mountHit) {
                type = mountHit.type;
                id = mountHit.id;
            }
        } else if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.get) {
            const hit = assetGenRegistry.get('ability', ability.id);
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
            returnTo: 'ability-viewer',
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
                focusExplore: 'abilities',
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

const abilityViewerUI = new AbilityViewerUI();
