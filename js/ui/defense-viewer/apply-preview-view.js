"use strict";

// DefenseViewerUI methods, split from defense-viewer.js.
extendClass(DefenseViewerUI, {
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
        this.previewSim = {
            phase: 0,
            shipX: 90,
            shipDir: 1,
            hits: [],
            shield: 1,
            hitAcc: 0
        };
        this.previewLastTs = 0;
    },

    isShieldSystem(id) {
        return String(id || '').includes('shield');
    },

    isArmorSystem(id) {
        return String(id || '').includes('armor');
    },

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
    },

    iconHtml(icon, size, tipLabel) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.resolveIconHtml(icon, size || 16, 'cv-ability-icon-img', tipLabel);
        }
        return icon || '◆';
    },

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
    },
});
