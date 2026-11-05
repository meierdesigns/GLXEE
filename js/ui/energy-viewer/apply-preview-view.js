"use strict";

// EnergyViewerUI methods, split from energy-viewer.js.
extendClass(EnergyViewerUI, {
    applyPreviewView() {
        const wrap = this.overlay && this.overlay.querySelector('#evPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#evZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#evPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#evPreviewViewport');
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
        this.previewSim = { phase: 0, pulse: 0 };
        this.previewLastTs = 0;
    },

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        if (!sim) return;
        sim.phase += dtMs * 0.003;
        sim.pulse = 0.5 + Math.sin(sim.phase * 3) * 0.5;
    },

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
        const cx = w / 2;
        const cy = 150;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.28)';
        for (let i = 0; i < 32; i++) {
            const sx = (i * 91) % w;
            const sy = (i * 57 + Math.floor(sim.phase * 16)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        // Power-core pulse: a few expanding rings instead of the shield/armor hit sim the other
        // viewers use — this item isn't absorbing hits, it's radiating power to the rest of the ship.
        for (let r = 0; r < 3; r++) {
            const ringPhase = (sim.phase * 1.2 + r / 3) % 1;
            ctx.strokeStyle = tint;
            ctx.globalAlpha = Math.max(0, 0.5 - ringPhase * 0.5);
            ctx.beginPath();
            ctx.arc(cx, cy, 14 + ringPhase * 34, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        if (typeof iconRenderer !== 'undefined' && item.icon) {
            const tmp = document.createElement('canvas');
            tmp.width = 40;
            tmp.height = 40;
            iconRenderer.drawToCanvas(tmp, item.icon, tint);
            ctx.globalAlpha = 0.75 + sim.pulse * 0.25;
            ctx.drawImage(tmp, cx - 20, cy - 20, 40, 40);
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = tint;
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(item.name || item.id).toUpperCase(), w / 2, h - 34);
        ctx.font = '9px "Courier New", monospace';
        ctx.globalAlpha = 0.75;
        ctx.fillText(`TIER ${item.tier}  ${String(item.type || '').toUpperCase()}`, w / 2, h - 20);
        ctx.fillText(item.uiDescription || 'ENERGY', w / 2, h - 8);
        ctx.globalAlpha = 1;
    },

    iconHtml(icon, size, tipLabel) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.resolveIconHtml(icon, size || 16, 'cv-ability-icon-img', tipLabel);
        }
        return icon || '◆';
    },

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#evList');
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
                        known: profileManager.isDiscovered('energy', item.id),
                        owned: profileManager.getPartCount('energy', item.id) > 0
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
