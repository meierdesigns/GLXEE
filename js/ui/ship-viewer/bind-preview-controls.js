"use strict";

// ShipViewerUI methods, split from ship-viewer.js.
extendClass(ShipViewerUI, {
    bindPreviewControls() {
        const overlay = this.overlay;
        this.previewCanvas = overlay.querySelector('#svPreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewFullscreen = false;

        overlay.querySelector('#svZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#svZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#svZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#svPreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#svPreviewViewport');
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
            const vp = this.overlay && this.overlay.querySelector('#svPreviewViewport');
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
        const wrap = this.overlay && this.overlay.querySelector('#svPreviewWrap');
        const label = this.overlay && this.overlay.querySelector('#svZoomLabel');
        const fsBtn = this.overlay && this.overlay.querySelector('#svPreviewFullscreen');
        const viewport = this.overlay && this.overlay.querySelector('#svPreviewViewport');
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
        const loop = (ts) => {
            if (!this.visible) return;
            if (!this.previewLastTs) this.previewLastTs = ts;
            const dt = Math.min(50, ts - this.previewLastTs);
            this.previewLastTs = ts;
            this.updatePreviewSim(dt);
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
        const s = this.ships[this.selectedIndex];
        const model = this.getShipModel(s ? s.id : 'player');
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        this.previewSim = {
            player: {
                x: 100 - shipW / 2,
                y: 250,
                width: shipW,
                height: shipH,
                dir: 1
            },
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    },

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const s = this.ships[this.selectedIndex];
        if (!sim || !s) return;
        const frameScale = dtMs / 16.67;
        const model = this.getShipModel(s.id);
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        const p = sim.player;
        p.width = shipW;
        p.height = shipH;
        const speed = Math.max(0.5, Number(s.speed) || 4) * 0.35;
        p.x += p.dir * speed * frameScale;
        if (p.x <= 8 || p.x + p.width >= 192) {
            p.dir *= -1;
            p.x = Math.max(8, Math.min(192 - p.width, p.x));
        }
        p.y = 250 + Math.sin(sim.starPhase * 1.5) * 3;
        sim.starPhase += dtMs * 0.004;

        sim.shootAcc += dtMs;
        const cooldown = Math.max(80, Number(s.weaponCooldown) || 300);
        if (sim.shootAcc >= cooldown) {
            sim.shootAcc = 0;
            const bulletSpeed = Math.max(2, Number(s.weaponSpeed) || 8);
            sim.bullets.push({
                x: p.x + p.width / 2 - 1,
                y: p.y - 4,
                vy: -bulletSpeed,
                life: 1200
            });
        }
        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y > -10;
        });
    },

    drawPreview() {
        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        const sim = this.previewSim;
        const s = this.ships[this.selectedIndex];
        if (!ctx || !canvas || !sim || !s) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,140,40,0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 47 + sim.starPhase * 20) % w;
            const sy = (i * 73 + sim.starPhase * 8) % h;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.strokeStyle = 'rgba(255,140,40,0.15)';
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        sim.bullets.forEach((b) => {
            ctx.fillStyle = '#ffaa44';
            ctx.fillRect(b.x, b.y, 2, 6);
        });

        const model = this.getShipModel(s.id);
        const p = sim.player;
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, p.width);
            tmp.height = Math.max(1, p.height);
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, p.x, p.y, p.width, p.height);
        } else {
            ctx.fillStyle = '#ff8c28';
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.fillStyle = 'rgba(255,140,40,0.85)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(s.name || 'SHIP', 8, 14);
        ctx.fillText(`SPD ${s.speed}`, 8, 28);
        ctx.fillText(`HP ${s.maxHealth}`, 8, 42);
    },

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#svList');
        if (!list) return;
        list.innerHTML = '';
        this.ships.forEach((ship, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
            btn.innerHTML =
                `<canvas class="cv-icon cv-ship-icon" width="32" height="32" data-ship="${ship.id}"></canvas>` +
                `<span class="cv-item-label">${ship.name}${ship.custom ? ' *' : ''}` +
                (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                    ? devProfileToggles.badgesHtml({
                        known: profileManager.isDiscovered('ships', ship.id),
                        owned: profileManager.ownsShip(ship.id)
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
            const canvas = btn.querySelector('canvas');
            this.paintShipIcon(canvas, ship.id);
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        this.updateDeleteButton();
    },
});
