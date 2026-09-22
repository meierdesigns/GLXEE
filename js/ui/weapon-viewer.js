"use strict";

/**
 * Weapon Viewer — browse shot types / weapons.
 * Open: Start menu → WEAPONS
 */
class WeaponViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.weapons = [];
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

    getWeaponList() {
        if (typeof weaponConfigManager === 'undefined') return [];
        let ids = weaponConfigManager.getIds();
        const devMode = typeof startScreenManager !== 'undefined' && startScreenManager.devMode;
        if (!devMode && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const allowed = {};
            profileManager.getDiscovered('weapons').forEach((id) => { allowed[id] = true; });
            ids = ids.filter((id) => !!allowed[id]);
        }
        return ids.map((id) => {
            const w = weaponConfigManager.getWeapon(id);
            return Object.assign({}, w);
        });
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.weapons = this.getWeaponList();
        if (!this.weapons.length) return;
        const preferId = options && options.weaponId;
        if (preferId) {
            const idx = this.weapons.findIndex((w) => w.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.weapons.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('weapon-viewer', {
                weaponId: this.weapons[this.selectedIndex].id
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
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.resolveIconHtml(key, size || 16, 'cv-ability-icon-img', tipLabel);
        }
        return '◆';
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
                <h2 class="content-viewer-title">WEAPONS</h2>
                <div class="content-viewer-body has-preview" id="wvViewerBody">
                    <aside class="content-viewer-list" id="wvList"></aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize weapon list"></div>
                    <div class="content-viewer-detail" id="wvDetail"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="wvPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="wvZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="wvZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="wvZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="wvZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="wvPreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="wvPreviewViewport">
                            <canvas id="wvPreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="wvEditGfx">EDIT GFX</button>
                    <button type="button" class="pe-btn" id="wvClose">CLOSE</button>
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
        this.overlay.querySelector('#wvClose').addEventListener('click', () => this.close());
        this.overlay.querySelector('#wvEditGfx').addEventListener('click', () => this.openGfxEditor());
        this.mountDevToggles();
    }

    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const w = this.weapons[this.selectedIndex];
                return !!(w && profileManager.isDiscovered('weapons', w.id));
            },
            toggleKnown: () => {
                const w = this.weapons[this.selectedIndex];
                if (w) profileManager.toggleDiscovered('weapons', w.id);
            },
            owned: () => {
                const w = this.weapons[this.selectedIndex];
                return !!(w && profileManager.getPartCount('weapon', w.id) > 0);
            },
            toggleOwned: () => {
                const w = this.weapons[this.selectedIndex];
                if (w) profileManager.togglePartOwned('weapon', w.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    }

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#wvViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'wvPanelWidths',
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
        this.previewCanvas = overlay.querySelector('#wvPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#wvZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#wvZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#wvZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#wvPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#wvPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#wvPreviewViewport');
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
        const wrap = this.overlay && this.overlay.querySelector('#wvPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#wvZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#wvPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#wvPreviewViewport');
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
            shipX: 90,
            shipDir: 1,
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    }

    spawnWeaponBullets(w, ox, oy) {
        const sim = this.previewSim;
        if (!sim || !w) return;
        const count = Math.max(1, Number(w.bulletCount) || 1);
        const spread = Number(w.spreadAngle) || 0;
        const spacing = Number(w.bulletSpacing) || 4;
        const speed = Math.max(2, Number(w.speed) || 10);
        const bw = Math.max(1, Number(w.width) || 3);
        const bh = Math.max(2, Number(w.height) || 12);
        const waveAmp = Number(w.waveAmp) || 0;
        const type = String(w.bulletType || w.id || 'laser');

        for (let i = 0; i < count; i++) {
            let vx = 0;
            let vy = -speed;
            let x = ox - bw / 2;
            let y = oy;
            if (spread > 0 && count > 1) {
                const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
                const ang = t * spread * 2;
                vx = Math.sin(ang) * speed;
                vy = -Math.cos(ang) * speed;
            } else if (count > 1 && !spread) {
                x = ox - ((count - 1) * spacing) / 2 + i * spacing - bw / 2;
            }
            sim.bullets.push({
                x, y, vx, vy, bw, bh, waveAmp,
                life: 1600,
                type,
                phase: i * 0.7,
                plasma: type.includes('plasma') || type.includes('nova')
            });
        }
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const w = this.weapons[this.selectedIndex];
        if (!sim || !w) return;
        const frameScale = dtMs / 16.67;
        sim.starPhase += dtMs * 0.004;
        sim.shipX += sim.shipDir * 0.55 * frameScale;
        if (sim.shipX <= 40 || sim.shipX >= 140) {
            sim.shipDir *= -1;
            sim.shipX = Math.max(40, Math.min(140, sim.shipX));
        }

        sim.shootAcc += dtMs;
        const cooldown = Math.max(80, Number(w.cooldown) || 300);
        if (sim.shootAcc >= cooldown) {
            sim.shootAcc = 0;
            this.spawnWeaponBullets(w, sim.shipX + 10, 236);
        }

        sim.bullets = sim.bullets.filter((b) => {
            b.x += b.vx * frameScale;
            b.y += b.vy * frameScale;
            if (b.waveAmp) {
                b.x += Math.sin((sim.starPhase * 8) + b.phase) * b.waveAmp * frameScale;
            }
            b.life -= dtMs;
            return b.life > 0 && b.y > -20 && b.y < 320 && b.x > -20 && b.x < 220;
        });
    }

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const wpn = this.weapons[this.selectedIndex];
        if (!canvas || !ctx || !wpn) return;
        canvas.setAttribute('data-ag-type', 'weapon');
        canvas.setAttribute('data-ag-id', wpn.id);
        if (wpn.mountSprite) canvas.setAttribute('data-ag-key', wpn.mountSprite);
        else if (wpn.iconKey) canvas.setAttribute('data-ag-key', wpn.iconKey);
        else canvas.setAttribute('data-ag-key', wpn.id);

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;
        const tint = this.themeColor();

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.3)';
        for (let i = 0; i < 36; i++) {
            const sx = (i * 97) % w;
            const sy = (i * 53 + Math.floor(sim.starPhase * 20)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        for (const b of sim.bullets) {
            ctx.fillStyle = tint;
            if (b.plasma) {
                ctx.beginPath();
                ctx.arc(b.x + b.bw / 2, b.y + b.bh / 2, Math.max(b.bw, b.bh) / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(b.x, b.y, b.bw, b.bh);
            }
        }

        const sx = sim.shipX;
        const sy = 240;
        ctx.fillStyle = tint;
        ctx.fillRect(sx + 6, sy, 8, 14);
        ctx.fillRect(sx, sy + 8, 20, 6);
        ctx.fillRect(sx + 2, sy + 14, 4, 4);
        ctx.fillRect(sx + 14, sy + 14, 4, 4);

        if (typeof iconRenderer !== 'undefined' && wpn.iconKey) {
            const tmp = document.createElement('canvas');
            tmp.width = 32;
            tmp.height = 32;
            iconRenderer.drawToCanvas(tmp, wpn.iconKey, tint);
            ctx.drawImage(tmp, w / 2 - 16, 12, 32, 32);
        }

        ctx.fillStyle = tint;
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(wpn.name || wpn.id).toUpperCase(), w / 2, h - 34);
        ctx.font = '9px "Courier New", monospace';
        ctx.globalAlpha = 0.75;
        ctx.fillText(`DMG ${wpn.damage}  SPD ${wpn.speed}`, w / 2, h - 20);
        ctx.fillText(`CD ${wpn.cooldown}ms  ×${wpn.bulletCount || 1}`, w / 2, h - 8);
        ctx.globalAlpha = 1;
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#wvList');
        if (!list) return;
        list.innerHTML = '';
        this.weapons.forEach((weapon, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            btn.innerHTML =
                `<span class="cv-ability-icon cv-list-ability-icon">${this.iconHtml(weapon.iconKey, 32, weapon.name)}</span>` +
                `<span class="cv-item-label">${weapon.name}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? devProfileToggles.badgesHtml({
                        known: profileManager.isDiscovered('weapons', weapon.id),
                        owned: profileManager.getPartCount('weapon', weapon.id) > 0
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
        const root = this.overlay && this.overlay.querySelector('#wvDetail');
        const w = this.weapons[this.selectedIndex];
        if (!root || !w) return;
        const spread = Number(w.spreadAngle) || 0;
        const pierce = w.pierce ? 'yes' : 'no';
        root.innerHTML = `
            <div class="content-viewer-hero">
                <div class="cv-ability-hero-icon">${this.iconHtml(w.iconKey, 48, w.name)}</div>
                <div>
                    <h3 class="content-viewer-name">${w.name}</h3>
                    <p class="content-viewer-desc">${w.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats cv-stat-clusters cv-stat-clusters-plain">
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Combat</div>
                    <div class="stat-row"><span class="stat-label">Damage</span><span class="stat-value">${w.damage}</span></div>
                    <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-value">${w.speed}</span></div>
                    <div class="stat-row"><span class="stat-label">Cooldown</span><span class="stat-value">${w.cooldown}ms</span></div>
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Projectile</div>
                    <div class="stat-row"><span class="stat-label">Size</span><span class="stat-value">${w.width}×${w.height}</span></div>
                    <div class="stat-row"><span class="stat-label">Count</span><span class="stat-value">${w.bulletCount || 1}</span></div>
                    ${spread ? `<div class="stat-row"><span class="stat-label">Spread</span><span class="stat-value">${spread}</span></div>` : ''}
                    <div class="stat-row"><span class="stat-label">Pierce</span><span class="stat-value">${pierce}</span></div>
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Identity</div>
                    <div class="stat-row"><span class="stat-label">ID</span><span class="stat-value">${w.id}</span></div>
                    <div class="stat-row"><span class="stat-label">Type</span><span class="stat-value">${w.bulletType || '—'}</span></div>
                </div>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    }

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const w = this.weapons[this.selectedIndex];
            menuStateManager.setScreen('weapon-viewer', { weaponId: w ? w.id : 'laser' });
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
                this.selectedIndex = Math.min(this.weapons.length - 1, this.selectedIndex + 1);
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

    openGfxEditor() {
        const wpn = this.weapons[this.selectedIndex];
        if (!wpn || typeof componentEditorUI === 'undefined') return;
        let type = 'weapon';
        let id = wpn.id;
        const mountKey = wpn.mountSprite || null;
        if (mountKey && typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const mountHit = assetGenRegistry.findByKey(mountKey);
            if (mountHit) {
                type = mountHit.type;
                id = mountHit.id;
            }
        } else if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.get) {
            const hit = assetGenRegistry.get('weapon', wpn.id);
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
            returnTo: 'weapon-viewer',
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
                focusExplore: 'weapons',
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

const weaponViewerUI = new WeaponViewerUI();
