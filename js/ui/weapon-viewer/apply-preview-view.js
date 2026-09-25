"use strict";

// WeaponViewerUI methods, split from weapon-viewer.js.
extendClass(WeaponViewerUI, {
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
            shipX: 90,
            shipDir: 1,
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    },

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
    },

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
    },

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
    },

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
    },

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
    },
});
