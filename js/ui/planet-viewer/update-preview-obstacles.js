"use strict";

// PlanetViewerUI methods, split from planet-viewer.js.
extendClass(PlanetViewerUI, {
    updatePreviewObstacles(dtMs) {
        if (!this.previewCanvas) return;
        const cfg = this.getSelectedConfig();
        const defs = (cfg && cfg.obstacles) || [];
        const cfgId = cfg && cfg.id;
        if (cfgId !== this._previewCfgId) {
            this._previewCfgId = cfgId;
            this.previewObstacles = [];
            this.previewObstacleSpawnAcc = 0;
        }
        if (!defs.length) {
            this.previewObstacles = [];
            return;
        }
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const frames = dtMs / 16.67;
        const interval = Math.max(400, (cfg && cfg.obstacleSpawnRate) || 2000);
        this.previewObstacleSpawnAcc += dtMs;
        while (this.previewObstacleSpawnAcc >= interval) {
            this.previewObstacleSpawnAcc -= interval;
            this.spawnPreviewObstacle(defs, w, h);
        }
        if (this.previewObstacles.length === 0) {
            for (let i = 0; i < Math.min(3, defs.length); i++) {
                this.spawnPreviewObstacle(defs, w, h);
                const o = this.previewObstacles[this.previewObstacles.length - 1];
                if (o) o.x = Math.random() * w * 0.7;
            }
        }
        const margin = 40;
        this.previewObstacles = this.previewObstacles.filter((o) => {
            o.x += o.horizontalSpeed * frames;
            o.y += o.verticalSpeed * frames;
            return o.x < w + margin && o.y < h + margin && o.x > -margin && o.y > -margin;
        });
    },

    spawnPreviewObstacle(defs, w, h) {
        if (!defs || !defs.length) return;
        let total = 0;
        defs.forEach((d) => { total += Math.max(1, d.weight || 1); });
        let r = Math.random() * total;
        let def = defs[0];
        for (let i = 0; i < defs.length; i++) {
            r -= Math.max(1, defs[i].weight || 1);
            if (r <= 0) { def = defs[i]; break; }
        }
        if (typeof obstacleManager !== 'undefined' && obstacleManager.createObstacleFromDef) {
            const origin = obstacleManager.spawnOriginForDirection
                ? obstacleManager.spawnOriginForDirection(def.direction || 'ltr', def.width, def.height, { width: w, height: h })
                : { x: -(def.width || 18), y: Math.random() * Math.max(1, h - (def.height || 18)) };
            this.previewObstacles.push(obstacleManager.createObstacleFromDef(def, { x: origin.x, y: origin.y }));
            return;
        }
        const size = { width: def.width || 18, height: def.height || 18 };
        const horizontalSpeed = def.speed != null ? def.speed : 0.8;
        this.previewObstacles.push({
            x: -size.width,
            y: Math.random() * Math.max(1, h - size.height),
            width: size.width,
            height: size.height,
            horizontalSpeed,
            verticalSpeed: horizontalSpeed * 0.3,
            type: def.type,
            kind: def.kind,
            isFog: def.kind === 'fog',
            reflectsShots: !!def.reflectsShots,
            sprite: def.sprite,
            opacity: def.opacity != null ? def.opacity : 1,
            opticalMode: def.opticalMode || 'none',
            rotation: 0
        });
    },

    drawObstaclePreviews(ctx) {
        const list = this.previewObstacles || [];
        const fogs = list.filter((o) => o.isFog);
        const solids = list.filter((o) => !o.isFog);
        [...fogs, ...solids].forEach((obstacle) => {
            if (typeof renderManager !== 'undefined' && renderManager.drawObstacleSprite) {
                renderManager.drawObstacleSprite(ctx, obstacle);
                return;
            }
            const spriteName = obstacle.sprite
                || (obstacle.isFog ? 'fog' : (obstacle.reflectsShots ? 'shield' : 'obstacle'));
            const alpha = obstacle.opacity != null ? obstacle.opacity : 1;
            if (typeof graphicsManager !== 'undefined' && graphicsManager.drawSprite && graphicsManager.getSprite) {
                const sprite = graphicsManager.getSprite(spriteName)
                    || graphicsManager.getSprite(obstacle.reflectsShots ? 'shield' : 'obstacle');
                if (sprite) {
                    ctx.save();
                    if (alpha < 1) ctx.globalAlpha = alpha;
                    graphicsManager.drawSprite(
                        ctx, sprite,
                        obstacle.x, obstacle.y, obstacle.width, obstacle.height,
                        0, 'var(--current-text-secondary)'
                    );
                    ctx.restore();
                    return;
                }
            }
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = obstacle.isFog ? 'rgba(120,140,180,0.5)' : (obstacle.reflectsShots ? '#7a9aaa' : '#6a6a6a');
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.restore();
        });
    },

    drawSideEnemyPreviews(ctx, w, h, enemies) {
        if (!enemies.length) return;
        enemies.slice(0, 4).forEach((entry, i) => {
            const x = w - 48;
            const y = 28 + i * 48;
            ctx.save();
            ctx.globalAlpha = 0.9;
            if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
                graphicsManager.renderEnemyShip(ctx, {
                    x, y, width: 24, height: 18, type: entry.type
                }, 0.85);
            } else {
                ctx.fillStyle = '#999';
                ctx.fillRect(x, y, 24, 18);
            }
            if (entry.champion) {
                ctx.strokeStyle = '#c45c26';
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 2, y - 2, 28, 22);
            }
            ctx.restore();
        });
    },

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#pvList');
        if (!list) return;
        list.innerHTML = '';

        this.systems.forEach((sys) => {
            const group = document.createElement('div');
            group.className = 'cv-system-group';

            const head = document.createElement('div');
            head.className = 'cv-system-label';
            head.textContent = sys.name || 'SYSTEM';
            group.appendChild(head);

            if (!sys.planets.length) {
                const empty = document.createElement('div');
                empty.className = 'cv-system-empty';
                empty.textContent = '—';
                group.appendChild(empty);
            } else {
                sys.planets.forEach((planet) => {
                    const flatIndex = this.planets.findIndex((p) => p.id === planet.id);
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'content-viewer-item' + (flatIndex === this.selectedIndex ? ' selected' : '');
                    btn.innerHTML =
                        this.planetIconHtml(planet.id, 32) +
                        `<span class="cv-item-label">${planet.name}` +
                        (typeof devProfileToggles !== 'undefined' && devProfileToggles.active()
                            ? devProfileToggles.badgesHtml(this.planetProgressFlags(planet))
                            : '') +
                        `</span>`;
                    btn.addEventListener('click', () => {
                        this.selectedIndex = flatIndex;
                        this.renderList();
                        this.renderDetail();
                        this.persist();
                    });
                    group.appendChild(btn);
                });
            }
            list.appendChild(group);
        });
        const selected = list.querySelector('.content-viewer-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    },

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#pvDetail');
        const p = this.planets[this.selectedIndex];
        if (!root || !p) return;

        const stageRows = (p.stages && p.stages.length)
            ? p.stages.map((s) => {
                const label = s.key === 'boss' ? 'BOSS' : `STAGE ${s.key}`;
                return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${s.enemies} enemies</span></div>`;
            }).join('')
            : '<div class="stat-row"><span class="stat-label">Stages</span><span class="stat-value">—</span></div>';

        const systemsHtml = this.systems.map((sys) => {
            const active = sys.id === p.galaxyId || sys.name === p.galaxy;
            const count = sys.planets.length;
            return `<span class="cv-system-chip${active ? ' active' : ''}">${sys.name} (${count})</span>`;
        }).join('');

        root.innerHTML = `
            <div class="content-viewer-hero">
                ${this.planetIconHtml(p.id, 48)}
                <div>
                    <h3 class="content-viewer-name">${p.name}</h3>
                    <p class="content-viewer-desc">${p.description || 'No description.'}</p>
                </div>
            </div>
            <div class="cv-systems-row">
                <div class="cv-systems-title">SYSTEMS</div>
                <div class="cv-systems-chips">${systemsHtml || '—'}</div>
            </div>
            <div class="content-viewer-stats">
                <div class="stat-row"><span class="stat-label">Galaxy</span><span class="stat-value">${p.galaxy || '—'}</span></div>
                <div class="stat-row"><span class="stat-label">Factions</span><span class="stat-value">${(p.factions && p.factions.length) ? p.factions.join(', ') : 'ALL'}</span></div>
                <div class="stat-row"><span class="stat-label">Difficulty</span><span class="stat-value">${p.difficulty || '—'}</span></div>
                <div class="stat-row"><span class="stat-label">BG Layers</span><span class="stat-value">${p.layerCount}</span></div>
                <div class="stat-row"><span class="stat-label">Enemies</span><span class="stat-value">${p.enemyCount}</span></div>
            </div>
            <div class="cv-stages-block">
                <div class="cv-systems-title">STAGES</div>
                <div class="content-viewer-stats">${stageRows}</div>
            </div>
        `;
        if (this._devToggles) this._devToggles.refresh();
    },

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const p = this.planets[this.selectedIndex];
            menuStateManager.setScreen('planet-viewer', { planet: p ? p.id : 'mars' });
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
                this.persist();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.selectedIndex = Math.min(this.planets.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
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
});
