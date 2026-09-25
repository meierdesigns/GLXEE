"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    updatePreviewObstacles(dtMs) {
        if (!this.draft || !this.previewCanvas) return;
        const defs = this.draft.obstacles || [];
        if (!defs.length) {
            this.previewObstacles = [];
            this.previewObstacleSpawnAcc = 0;
            return;
        }

        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;
        const frames = dtMs / 16.67;

        const interval = Math.max(400, this.draft.obstacleSpawnRate || 2000);
        this.previewObstacleSpawnAcc += dtMs;
        while (this.previewObstacleSpawnAcc >= interval) {
            this.previewObstacleSpawnAcc -= interval;
            if (Math.random() < 0.6) this.spawnPreviewClusterWave(w, h);
            else this.spawnPreviewObstacle(w, h);
        }
        if (this.previewObstacles.length === 0) {
            this.spawnPreviewClusterWave(w, h);
            this.previewObstacles.forEach((o) => {
                o.x = Math.random() * w * 0.6;
            });
        }

        const margin = 40;
        this.previewObstacles = this.previewObstacles.filter((o) => {
            o.x += o.horizontalSpeed * frames;
            o.y += o.verticalSpeed * frames;
            return o.x < w + margin && o.y < h + margin && o.x > -margin && o.y > -margin;
        });
    },

    drawObstaclePreviews(ctx, w, h) {
        const list = this.previewObstacles || [];
        if (!list.length) return;

        // Fog first, then solid obstacles (preview has no player LoS occlusion needed beyond draw order)
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

    drawSideEnemyPreviews(ctx, w, h) {
        const enemies = this.draft.enemies || this.draft.sideEnemies || [];
        if (!enemies.length) return;

        enemies.slice(0, 4).forEach((entry, i) => {
            const shipW = 18;
            const shipH = 14;
            const x = w - shipW - 8;
            const y = 16 + i * 36;
            ctx.save();
            ctx.globalAlpha = 0.9;
            if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
                graphicsManager.renderEnemyShip(ctx, {
                    x, y, width: shipW, height: shipH, type: entry.type
                }, 0.85);
            } else {
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--current-accent').trim() || '#999';
                ctx.fillRect(x, y, shipW, shipH);
            }
            if (entry.champion) {
                ctx.strokeStyle = '#c45c26';
                ctx.lineWidth = 1;
                ctx.strokeRect(x - 2, y - 2, shipW + 4, shipH + 4);
            }
            ctx.restore();
            ctx.fillStyle = '#888';
            ctx.font = '8px Courier New, monospace';
            ctx.textAlign = 'right';
            const label = [
                entry.champion ? '★' : '',
                entry.type || 'enemy',
                entry.faction ? '[' + entry.faction + ']' : '',
                entry.enemyClass || '',
                '#' + (entry.cluster || 'alpha'),
                '@' + (entry.spawnAt != null ? entry.spawnAt : 0) + 's'
            ].filter(Boolean).join(' ');
            ctx.fillText(label, x - 4, y + 10);
        });
    },
});
