"use strict";

// PlanetViewerUI methods, split from planet-viewer.js.
extendClass(PlanetViewerUI, {
    mountDevToggles() {
        this._devToggles = null;
        if (typeof devProfileToggles === 'undefined' || !devProfileToggles.active()) return;
        const footer = this.overlay.querySelector('.content-viewer-footer');
        const hint = this.overlay.querySelector('.content-viewer-hint');
        this._devToggles = devProfileToggles.mount(footer, hint, {
            known: () => {
                const p = this.planets[this.selectedIndex];
                return !!(p && profileManager.isDiscovered('planets', p.id));
            },
            toggleKnown: () => {
                const p = this.planets[this.selectedIndex];
                if (p) profileManager.toggleDiscovered('planets', p.id);
            },
            visited: () => {
                const p = this.planets[this.selectedIndex];
                return !!(p && this.planetProgressFlags(p).visited);
            },
            toggleVisited: () => {
                const p = this.planets[this.selectedIndex];
                if (p) profileManager.togglePlanetVisited(p.id);
            },
            cleared: () => {
                const p = this.planets[this.selectedIndex];
                return !!(p && this.planetProgressFlags(p).cleared);
            },
            toggleCleared: () => {
                const p = this.planets[this.selectedIndex];
                if (p) profileManager.togglePlanetCleared(p.id);
            },
            onChange: () => {
                this.renderList();
                this.renderDetail();
                if (this._devToggles) this._devToggles.refresh();
            }
        });
    },

    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#pvViewerBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'pvPanelWidths',
            defaults: { left: 220, right: 260 },
            mins: { left: 140, right: 180, center: 200 },
            leftVar: '--cv-left-w',
            rightVar: '--cv-right-w',
            onChange: () => {
                if (this.visible) this.applyPreviewView();
            }
        });
    },

    bindPreviewControls() {
        const overlay = this.overlay;
        this.previewCanvas = overlay.querySelector('#pvPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#pvZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#pvZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#pvZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#pvPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#pvPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#pvPreviewViewport');
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
    },

    setPreviewZoom(zoom) {
        this.previewZoom = Math.min(4, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    },

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    },

    applyPreviewView() {
        const wrap = this.overlay && this.overlay.querySelector('#pvPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#pvZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#pvPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#pvPreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewCanvas.width / this.previewCanvas.height || 0.8;
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
    },

    startPreview() {
        this.stopPreview();
        if (this.previewCanvas) {
            this.previewCanvas.width = 240;
            this.previewCanvas.height = 300;
            this.previewCtx = this.previewCanvas.getContext('2d');
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        this._previewCfgId = null;
        let lastTs = 0;
        const tick = (ts) => {
            if (!this.visible) return;
            if (!lastTs) lastTs = ts;
            const dt = Math.min(50, ts - lastTs);
            lastTs = ts;
            this.updatePreviewObstacles(dt);
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(tick);
        };
        this.previewAnimId = requestAnimationFrame(tick);
    },

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
    },

    cleanupPreviewControls() {
        if (this._previewCleanup) {
            this._previewCleanup();
            this._previewCleanup = null;
        }
    },

    drawPreview() {
        if (!this.previewCtx || !this.previewCanvas) return;
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const cfg = this.getSelectedConfig();
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (!cfg) {
            ctx.fillStyle = '#888';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NO DATA', w / 2, h / 2);
            return;
        }

        const t = performance.now() / 1000;
        const canDraw = typeof parallaxManager !== 'undefined' && parallaxManager.drawLayerPattern;
        const layers = cfg.backgroundLayers || [];

        layers.forEach((layer) => {
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

        this.drawObstaclePreviews(ctx);
        this.drawSideEnemyPreviews(ctx, w, h, cfg.enemies || cfg.sideEnemies || []);

        const p = this.planets[this.selectedIndex];
        ctx.globalAlpha = 1;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--current-text').trim() || '#e8a040';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText((p && p.name) || 'PLANET', 8, 14);
    },
});
