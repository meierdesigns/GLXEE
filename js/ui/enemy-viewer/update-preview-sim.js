"use strict";

// EnemyViewerUI methods, split from enemy-viewer.js.
extendClass(EnemyViewerUI, {
    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const cfg = this.enemies[this.selectedIndex];
        if (!sim || !cfg) return;
        const frameScale = dtMs / 16.67;
        const model = this.getShipModel(cfg.id);
        const en = sim.enemy;
        en.width = Math.max(8, Math.round(model.width || 18));
        en.height = Math.max(8, Math.round(model.height || 14));
        en.speed = Number(cfg.speed) || 1;
        en.verticalSpeed = Number(cfg.verticalSpeed) || 0.3;
        en.minY = Number(cfg.minY != null ? cfg.minY : 25);
        en.maxY = Number(cfg.maxY != null ? cfg.maxY : 100);

        en.x += en.speed * frameScale * (en._dirX || 1);
        if (en.x <= 4 || en.x + en.width >= 196) {
            en._dirX = -(en._dirX || 1);
            en.x = Math.max(4, Math.min(196 - en.width, en.x));
        }
        en.y += en.verticalSpeed * frameScale * (en._dirY || 1);
        if (en.y <= en.minY || en.y >= en.maxY) {
            en._dirY = -(en._dirY || 1);
            en.y = Math.max(en.minY, Math.min(en.maxY, en.y));
        }

        sim.starPhase += dtMs * 0.004;
        sim.shootAcc += dtMs;
        const interval = Math.max(200, Number(cfg.shootInterval) || 1200);
        if (sim.shootAcc >= interval) {
            sim.shootAcc = 0;
            sim.bullets.push({
                x: en.x + en.width / 2 - 1,
                y: en.y + en.height,
                vy: 2.5,
                life: 1400,
                plasma: String(cfg.weapon || '').toLowerCase().includes('plasma')
            });
        }
        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y < 310;
        });
    },

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        const cfg = this.enemies[this.selectedIndex];
        if (!canvas || !ctx || !cfg) return;

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 97) % w;
            const sy = (i * 53 + Math.floor(sim.starPhase * 20)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        for (const b of sim.bullets) {
            ctx.fillStyle = b.plasma ? '#c06040' : '#e07028';
            if (b.plasma) {
                ctx.beginPath();
                ctx.arc(b.x + 1, b.y + 2, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(b.x, b.y, 2, 6);
            }
        }

        const model = this.getShipModel(cfg.id);
        const e = sim.enemy;
        let rendered = false;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            try {
                graphicsManager.renderEnemyShip(ctx, {
                    x: e.x,
                    y: e.y,
                    width: e.width,
                    height: e.height,
                    type: cfg.id,
                    faction: this.resolvePreviewFaction(cfg),
                    enemyClass: this.resolvePreviewClass(cfg),
                    tier: (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
                        ? factionShipStyles.classTier[this.resolvePreviewClass(cfg)]
                        : 2
                }, 1);
                rendered = true;
            } catch (err) {
                rendered = false;
            }
        }
        if (!rendered) {
            if (typeof shipRenderer !== 'undefined') {
                if (shipRenderer.init) shipRenderer.init();
                const tmp = document.createElement('canvas');
                tmp.width = Math.max(1, e.width);
                tmp.height = Math.max(1, e.height);
                shipRenderer.renderShipPreview(tmp, model, 1);
                ctx.drawImage(tmp, e.x, e.y, e.width, e.height);
            } else {
                ctx.fillStyle = '#e07028';
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
        }

        ctx.fillStyle = '#e07028';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(cfg.name || cfg.id).toUpperCase(), w / 2, h - 34);
        ctx.fillStyle = '#b09070';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(`HP ${cfg.maxHealth}  SPD ${Number(cfg.speed).toFixed(2)}`, w / 2, h - 20);
        ctx.fillText(`ARM ${cfg.armor}  DMG ${cfg.damage}`, w / 2, h - 8);
    },

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#evList');
        if (!list) return;
        list.innerHTML = '';
        const clusters = this.getFactionClusters();
        clusters.forEach((cluster) => {
            const header = document.createElement('div');
            header.className = 'content-viewer-group';
            header.textContent = 'FACTION: ' + String(cluster.faction).toUpperCase();
            list.appendChild(header);
            cluster.enemies.forEach(({ enemy, index }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'content-viewer-item' + (index === this.selectedIndex ? ' selected' : '');
                btn.innerHTML =
                    `<canvas class="cv-icon cv-ship-icon" width="32" height="32" data-enemy="${enemy.id}"></canvas>` +
                    `<span class="cv-item-label">${enemy.name}` +
                    (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                        ? devProfileToggles.badgesHtml({
                            known: profileManager.isDiscovered('enemies', enemy.id)
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
                this.paintShipIcon(canvas, enemy.id);
            });
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    },

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#evDetail');
        const e = this.enemies[this.selectedIndex];
        if (!root || !e) return;
        const cfg = typeof enemyConfigManager !== 'undefined' ? enemyConfigManager.getConfig(e.id) : null;
        const abilities = (cfg && (cfg.abilities || cfg.defenseMechanisms)) || [];
        root.innerHTML = `
            <div class="content-viewer-hero">
                <canvas class="cv-ship-preview" width="32" height="32" id="evHeroCanvas"></canvas>
                <div>
                    <h3 class="content-viewer-name">${e.name}</h3>
                    <p class="content-viewer-desc">${e.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">Hull</span><span class="stat-value">${(cfg && cfg.hullId) ? String(cfg.hullId).toUpperCase() : String(e.id).toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Factions</span><span class="stat-value">${(cfg && cfg.factions && cfg.factions.length) ? cfg.factions.join(', ') : '—'}</span></div>
                <div class="stat-row"><span class="stat-label">Class</span><span class="stat-value">${String(this.resolvePreviewClass(e)).toUpperCase()}</span></div>
                <div class="stat-row"><span class="stat-label">Galaxies</span><span class="stat-value">${(cfg && cfg.galaxyIds && cfg.galaxyIds.length) ? cfg.galaxyIds.join(', ') : 'ALL'}</span></div>
                <div class="stat-row"><span class="stat-label">Planets</span><span class="stat-value">${(cfg && cfg.planetIds && cfg.planetIds.length) ? cfg.planetIds.join(', ') : 'ALL'}</span></div>
                <div class="stat-row"><span class="stat-label">Health</span><span class="stat-value">${e.maxHealth}</span></div>
                <div class="stat-row"><span class="stat-label">Armor</span><span class="stat-value">${e.armor}</span></div>
                <div class="stat-row"><span class="stat-label">Damage</span><span class="stat-value">${e.damage}</span></div>
                <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-value">${e.speed}</span></div>
                <div class="stat-row"><span class="stat-label">Weapon</span><span class="stat-value">${String(e.weapon || '—').toUpperCase()}</span></div>
                <div class="stat-row stat-row-abilities"><span class="stat-label">Abilities</span><span class="stat-value cv-ability-chips">${
                    typeof abilityConfigManager !== 'undefined'
                        ? abilityConfigManager.formatAbilityChipsHtml(abilities)
                        : (abilities.length ? abilities.join(', ') : '—')
                }</span></div>
            </div>
        `;
        const hero = root.querySelector('#evHeroCanvas');
        this.paintShipIcon(hero, e.id);
        if (this._devToggles) this._devToggles.refresh();
    },

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const e = this.enemies[this.selectedIndex];
            menuStateManager.setScreen('enemy-viewer', { enemyType: e ? e.id : 'enemyBasic' });
        }
    },

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
                this.selectedIndex = Math.min(this.enemies.length - 1, this.selectedIndex + 1);
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
    },

    openEditor() {
        const enemy = this.enemies[this.selectedIndex];
        if (!enemy || typeof enemyEditorUI === 'undefined') return;
        this.hide();
        enemyEditorUI.show(enemy.id, undefined, false, { returnTo: 'enemy-viewer' });
    },
});
