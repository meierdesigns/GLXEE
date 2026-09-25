"use strict";

// AbilityViewerUI methods, split from ability-viewer.js.
extendClass(AbilityViewerUI, {
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
            pulses: [],
            particles: [],
            pulseAcc: 0
        };
        this.previewLastTs = 0;
    },

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
    },

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
    },

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
    },
});
