"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    drawPatternThumbnail(canvas, patternId, color) {
        if (!canvas || !patternId) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (typeof parallaxManager === 'undefined' || !parallaxManager.drawLayerPattern) {
            ctx.fillStyle = color || '#808080';
            ctx.fillRect(4, 4, w - 8, h - 8);
            return;
        }

        ctx.save();
        ctx.scale(w / 400, h / 600);
        const fakeLayer = {
            pattern: patternId,
            y: 0,
            color: color || '#808080',
            colorSource: 'custom',
            opacity: 1,
            visible: true
        };
        ctx.globalAlpha = 0.85;
        parallaxManager.drawLayerPattern(ctx, fakeLayer, 0);
        ctx.restore();
    },

    halveAllLayerOpacity() {
        (this.draft.backgroundLayers || []).forEach(layer => {
            layer.opacity = Math.max(0, (layer.opacity != null ? layer.opacity : 0.15) * 0.5);
        });
        this.renderControls();
    },

    save() {
        if (typeof planetConfigManager === 'undefined' || !this.draft) return;
        this.syncObstacleTypesFromDraft();
        planetConfigManager.setConfig(this.selectedPlanet, this.draft);
        if (typeof planetConfigManager.saveGalaxies === 'function') {
            planetConfigManager.saveGalaxies();
        }
        this.loadDraft();
        this.flashStatus('Saved');
    },

    reset() {
        if (typeof planetConfigManager === 'undefined') return;
        if (this.galaxyColorBaseline) {
            const { galaxyId, baseColor } = this.galaxyColorBaseline;
            planetConfigManager.setGalaxyBaseColor(galaxyId, baseColor, { persist: false });
        }
        planetConfigManager.resetPlanet(this.selectedPlanet);
        this.loadDraft();
        this.renderControls();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.applyForPlanet(this.selectedPlanet, null);
        }
        this.flashStatus('Reset');
    },

    flashStatus(msg) {
        const header = document.querySelector('.planet-editor-header h2');
        if (!header) return;
        const prev = header.textContent;
        header.textContent = msg.toUpperCase();
        setTimeout(() => { header.textContent = prev; }, 700);
    },

    startPreview() {
        this.stopPreview();
        if (this.previewCanvas) {
            this.syncPreviewPlayfield();
            if (!this.previewCtx) {
                this.previewCtx = this.previewCanvas.getContext('2d');
            }
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
        const viewport = document.getElementById('pePreviewViewport');
        if (viewport && typeof ResizeObserver !== 'undefined') {
            if (this._previewResizeObs) this._previewResizeObs.disconnect();
            this._previewResizeObs = new ResizeObserver(() => {
                if (this.visible) this.applyPreviewView();
            });
            this._previewResizeObs.observe(viewport);
        }
        this.applyPreviewView();
        let lastTs = 0;
        const tick = (ts) => {
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
        if (this._previewResizeObs) {
            this._previewResizeObs.disconnect();
            this._previewResizeObs = null;
        }
        this.previewObstacles = [];
        this.previewObstacleSpawnAcc = 0;
    },

    drawPreview() {
        if (!this.previewCtx || !this.draft) return;
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const t = performance.now() / 1000;
        const canDraw = typeof parallaxManager !== 'undefined' && parallaxManager.drawLayerPattern;

        // Draw like in-game: parallax patterns are authored in 400×600 space and
        // clipped to the 240×300 playfield (no squash-to-fit).
        (this.draft.backgroundLayers || []).forEach((layer) => {
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

        this.drawObstaclePreviews(ctx, w, h);
        this.drawSideEnemyPreviews(ctx, w, h);
        ctx.globalAlpha = 1;
    },

    pickPreviewObstacleDef() {
        const defs = (this.draft && this.draft.obstacles) || [];
        if (!defs.length) return null;
        let total = 0;
        defs.forEach((d) => { total += Math.max(1, d.weight || 1); });
        let r = Math.random() * total;
        for (let i = 0; i < defs.length; i++) {
            r -= Math.max(1, defs[i].weight || 1);
            if (r <= 0) return defs[i];
        }
        return defs[defs.length - 1];
    },

    spawnPreviewObstacle(w, h) {
        const def = this.pickPreviewObstacleDef();
        if (!def) return;
        let obs;
        if (typeof obstacleManager !== 'undefined' && obstacleManager.createObstacleFromDef) {
            const direction = def.direction || 'ltr';
            const origin = obstacleManager.spawnOriginForDirection
                ? obstacleManager.spawnOriginForDirection(direction, def.width, def.height, { width: w, height: h })
                : { x: -def.width, y: Math.random() * Math.max(1, h - (def.height || 18)) };
            obs = obstacleManager.createObstacleFromDef(def, { x: origin.x, y: origin.y });
        } else {
            const speeds = { horizontalSpeed: def.speed || 0.8, verticalSpeed: (def.speed || 0.8) * 0.3 };
            obs = {
                x: - (def.width || 18),
                y: Math.random() * Math.max(1, h - (def.height || 18)),
                width: def.width || 18,
                height: def.height || 18,
                horizontalSpeed: speeds.horizontalSpeed,
                verticalSpeed: speeds.verticalSpeed,
                type: def.type,
                kind: def.kind,
                isFog: def.kind === 'fog',
                reflectsShots: !!def.reflectsShots,
                sprite: def.sprite,
                opacity: def.opacity != null ? def.opacity : 1
            };
        }
        this.previewObstacles.push(obs);
    },

    spawnPreviewClusterWave(w, h) {
        const defs = (this.draft && this.draft.obstacles) || [];
        if (!defs.length) return;
        const clusters = {};
        defs.forEach((d) => {
            const c = d.cluster || 'alpha';
            if (!clusters[c]) clusters[c] = [];
            clusters[c].push(d);
        });
        const keys = Object.keys(clusters);
        const clusterId = keys[Math.floor(Math.random() * keys.length)];
        const members = clusters[clusterId];
        const lead = members[0];
        members.forEach((def, i) => {
            this.spawnPreviewObstacle(w, h);
            const o = this.previewObstacles[this.previewObstacles.length - 1];
            if (!o) return;
            const col = i % 3;
            const row = Math.floor(i / 3);
            o.x = 10 + col * ((def.width || 18) * 0.95);
            o.y = Math.max(0, Math.min(h - (def.height || 18),
                (lead ? (o.y) : h * 0.3) + row * ((def.height || 18) * 0.95)));
            if (typeof obstacleManager !== 'undefined' && obstacleManager.directionToSpeed) {
                const sp = obstacleManager.directionToSpeed(def.direction || 'ltr', def.speed);
                o.horizontalSpeed = sp.horizontalSpeed;
                o.verticalSpeed = sp.verticalSpeed;
            }
        });
    },
});
