"use strict";

// RenderManager methods, split from render.js.
extendClass(RenderManager, {
    drawCrystalObstacle(ctx, obstacle) {
        const x = obstacle.x;
        const y = obstacle.y;
        const w = obstacle.width;
        const h = obstacle.height;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const mode = obstacle.opticalMode || 'prism';
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
        const rot = (obstacle.rotation || 0) + (mode === 'kaleidoscope' ? t * 0.4 : t * 0.15);

        const c0 = this.themeColor(['--color-highlight', '--color-text'], '#e8ffff');
        const c1 = this.themeColor(['--color-accent', '--color-secondary'], '#88ddff');
        const c2 = this.themeColor(['--color-primary', '--color-particle'], '#aaffee');
        const c3 = this.themeColor(['--color-explosion', '--color-warning'], '#ffcc88');

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);

        const facets = mode === 'kaleidoscope' ? 6 : (mode === 'prism' ? 5 : 4);
        const rx = w * 0.48;
        const ry = h * 0.48;

        // Base crystal body
        ctx.beginPath();
        for (let i = 0; i < facets; i++) {
            const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const px = Math.cos(a) * rx;
            const py = Math.sin(a) * ry;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = c1;
        ctx.globalAlpha = 0.55;
        ctx.fill();

        // Facet wedges
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < facets; i++) {
            const a0 = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const a1 = (Math.PI * 2 * (i + 1)) / facets - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a0) * rx, Math.sin(a0) * ry);
            ctx.lineTo(Math.cos(a1) * rx, Math.sin(a1) * ry);
            ctx.closePath();
            const palette = [c0, c1, c2, c3];
            ctx.fillStyle = palette[i % palette.length];
            ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3 + i);
            ctx.fill();
        }

        // Mirror glint
        if (mode === 'mirror' || mode === 'kaleidoscope') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = c0;
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-rx * 0.6, -ry * 0.2);
            ctx.lineTo(rx * 0.5, ry * 0.15);
            ctx.stroke();
        }

        // Outer edge
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = c0;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < facets; i++) {
            const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const px = Math.cos(a) * rx;
            const py = Math.sin(a) * ry;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Core spark
        ctx.fillStyle = c0;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
    },

    /** True if fog sits on the line of sight from player to entity. */
    isOccludedByFog(player, entity, fogList) {
        if (!player || !entity || !fogList || !fogList.length) return false;
        const ax = player.x + (player.width || 0) / 2;
        const ay = player.y + (player.height || 0) / 2;
        const bx = entity.x + (entity.width || 0) / 2;
        const by = entity.y + (entity.height || 0) / 2;
        for (let i = 0; i < fogList.length; i++) {
            const fog = fogList[i];
            if (!fog || fog === entity) continue;
            if (!this.segmentIntersectsAabb(ax, ay, bx, by, fog)) continue;
            const fogCx = fog.x + fog.width / 2;
            const fogCy = fog.y + fog.height / 2;
            const dFog = (fogCx - ax) * (fogCx - ax) + (fogCy - ay) * (fogCy - ay);
            const dEnt = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
            if (dFog < dEnt - 4) return true;
        }
        return false;
    },

    segmentIntersectsAabb(x1, y1, x2, y2, box) {
        const minX = box.x;
        const minY = box.y;
        const maxX = box.x + box.width;
        const maxY = box.y + box.height;
        let t0 = 0;
        let t1 = 1;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const clips = [
            [-dx, x1 - minX],
            [dx, maxX - x1],
            [-dy, y1 - minY],
            [dy, maxY - y1]
        ];
        for (let i = 0; i < 4; i++) {
            const p = clips[i][0];
            const q = clips[i][1];
            if (p === 0) {
                if (q < 0) return false;
                continue;
            }
            const r = q / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
        return t0 <= t1;
    },

    // Calculate bullet lighting based on proximity to elements
    calculateBulletLighting(bullet) {
        let maxIntensity = 0;
        let lightingColor = 'var(--current-text)';

        // Check proximity to enemy
        const enemy = enemyManager.getEnemy();
        if (enemy) {
            const distance = this.calculateDistance(bullet, enemy);
            if (distance < 40) { // Within 40 pixels
                const intensity = Math.max(0, (40 - distance) / 40) * 0.8;
                if (intensity > maxIntensity) {
                    maxIntensity = intensity;
                    lightingColor = this.getCurrentColorProfile();
                }
            }
        }

        // Check proximity to obstacles
        obstacleManager.getObstacles().forEach(obstacle => {
            const distance = this.calculateDistance(bullet, obstacle);
            if (distance < 30) { // Within 30 pixels
                const intensity = Math.max(0, (30 - distance) / 30) * 0.6;
                if (intensity > maxIntensity) {
                    maxIntensity = intensity;
                    lightingColor = this.getCurrentColorProfile();
                }
            }
        });

        // Check proximity to player
        const player = playerManager.getPosition();
        if (player) {
            const distance = this.calculateDistance(bullet, player);
            if (distance < 35) { // Within 35 pixels
                const intensity = Math.max(0, (35 - distance) / 35) * 0.7;
                if (intensity > maxIntensity) {
                    maxIntensity = intensity;
                    lightingColor = this.getCurrentColorProfile();
                }
            }
        }

        return {
            intensity: maxIntensity,
            color: lightingColor
        };
    },

    // Calculate distance between two objects
    calculateDistance(obj1, obj2) {
        const dx = (obj1.x + obj1.width / 2) - (obj2.x + obj2.width / 2);
        const dy = (obj1.y + obj1.height / 2) - (obj2.y + obj2.height / 2);
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * How strongly the shield should show (0..1) based on nearby threats.
     * Soft ease-in: faint at range, full when close.
     * Default (player): enemy shots, reflected shots, obstacles.
     */
    getShieldThreatProximity(entity, options) {
        if (!entity) return 0;
        const opts = options || {};
        const radius = opts.radius != null ? opts.radius : 72;
        const mode = opts.mode || 'player';
        let best = 0;
        const consider = (obj) => {
            if (!obj) return;
            const d = this.calculateDistance(entity, obj);
            if (d >= radius) return;
            const t = 1 - (d / radius);
            // Smoothstep ease-in for a soft fade
            const fade = t * t * (3 - 2 * t);
            if (fade > best) best = fade;
        };

        if (typeof bulletManager !== 'undefined') {
            if (mode === 'player') {
                if (bulletManager.getEnemyBullets) {
                    bulletManager.getEnemyBullets().forEach(consider);
                }
                if (bulletManager.getBullets) {
                    bulletManager.getBullets().forEach((b) => {
                        if (b && b.reflected) consider(b);
                    });
                }
            } else if (mode === 'enemy') {
                if (bulletManager.getBullets) {
                    bulletManager.getBullets().forEach(consider);
                }
                if (bulletManager.getEnemyBullets) {
                    bulletManager.getEnemyBullets().forEach((b) => {
                        if (b && b.reflected) consider(b);
                    });
                }
            }
        }

        if (opts.obstacles !== false
            && typeof obstacleManager !== 'undefined'
            && obstacleManager.getObstacles) {
            obstacleManager.getObstacles().forEach((o) => {
                if (o && o.isFog) return;
                consider(o);
            });
        }
        return best;
    },

    // Get current color profile from color manager
    getCurrentColorProfile() {
        if (typeof colorManager !== 'undefined') {
            return colorManager.getCurrentOverlayColor();
        }
        return 'var(--current-text)'; // Default white
    },
});
