"use strict";

// FactionViewerUI methods, split from faction-viewer.js.
extendClass(FactionViewerUI, {
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
    },

    setPreviewZoom(zoom) {
        this.previewZoom = Math.min(3, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    },

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    },

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
    },

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
    },

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewLastTs = 0;
    },

    cleanupPreviewControls() {
        if (this._previewCleanup) {
            this._previewCleanup();
            this._previewCleanup = null;
        }
    },

    resetPreviewSim() {
        this.previewSim = { phase: 0, rings: [] };
        this.previewLastTs = 0;
    },

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
    },

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
    },

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
    },
});
