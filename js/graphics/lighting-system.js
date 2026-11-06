"use strict";

/**
 * Lighting system for dynamic visual effects.
 * Glow sprites are baked once per (radius, intensity) and reused — same look as
 * createRadialGradient every frame, without the per-bullet GPU/CPU cost.
 */
class LightingSystem {
    constructor() {
        /** @type {Object.<string, HTMLCanvasElement>} */
        this._glowCache = Object.create(null);
        this._glowCacheCount = 0;
    }

    /** Only mute lights in explicit performance mode — never thin quality by default. */
    lightingBudget() {
        try {
            if (document.documentElement.hasAttribute('data-vf-performance')) return 0;
        } catch (e) { /* ignore */ }
        return 32;
    }

    /**
     * Offscreen radial glow matching the previous gradient stops.
     * @param {number} radius
     * @param {number} inten 0..1
     */
    _glowSprite(radius, inten) {
        const r = Math.max(4, Math.min(32, Math.round(radius)));
        const iKey = Math.max(1, Math.min(55, Math.round(inten * 100)));
        const key = r + ':' + iKey;
        let c = this._glowCache[key];
        if (c) return c;
        // Bound cache so long sessions don't grow forever.
        if (this._glowCacheCount > 64) {
            this._glowCache = Object.create(null);
            this._glowCacheCount = 0;
        }
        const size = r * 2;
        c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const g = c.getContext('2d');
        if (!g) return null;
        const intenN = iKey / 100;
        const grd = g.createRadialGradient(r, r, 0, r, r, r);
        grd.addColorStop(0, 'rgba(255, 255, 255, ' + intenN + ')');
        grd.addColorStop(0.35, 'rgba(255, 255, 255, ' + (intenN * 0.35) + ')');
        grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, size, size);
        this._glowCache[key] = c;
        this._glowCacheCount++;
        return c;
    }

    // Lighting system for bullets
    renderLighting(ctx, bullets, obstacles, player, enemy) {
        if (!bullets || !bullets.length) return;
        const budget = this.lightingBudget();
        if (budget <= 0) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        let lit = 0;
        for (let i = bullets.length - 1; i >= 0 && lit < budget; i--) {
            const bullet = bullets[i];
            if (bullet && bullet.lightRadius && bullet.lightIntensity) {
                this.renderBulletLight(ctx, bullet, obstacles, player, enemy);
                lit++;
            }
        }

        ctx.restore();
    }

    renderBulletLight(ctx, bullet, obstacles, player, enemy) {
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;

        // Soft point light — keep radius small so shots don't look like slabs
        const radius = Math.min(24, bullet.lightRadius || 14);
        const radius2 = radius * radius;
        const inten = Math.min(0.55, bullet.lightIntensity || 0.4);

        const sprite = this._glowSprite(radius, inten);
        if (sprite) {
            ctx.drawImage(sprite, bulletCenterX - radius, bulletCenterY - radius);
        } else {
            const gradient = ctx.createRadialGradient(
                bulletCenterX, bulletCenterY, 0,
                bulletCenterX, bulletCenterY, radius
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, ' + inten + ')');
            gradient.addColorStop(0.35, 'rgba(255, 255, 255, ' + (inten * 0.35) + ')');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(
                bulletCenterX - radius,
                bulletCenterY - radius,
                radius * 2,
                radius * 2
            );
        }

        // Object illuminate (same thresholds as before).
        const near = (ox, oy) => {
            const dx = bulletCenterX - ox;
            const dy = bulletCenterY - oy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= radius2) return -1;
            return Math.sqrt(d2);
        };

        if (obstacles && obstacles.length) {
            for (let i = 0; i < obstacles.length; i++) {
                const obstacle = obstacles[i];
                if (!obstacle) continue;
                const distance = near(
                    obstacle.x + obstacle.width / 2,
                    obstacle.y + obstacle.height / 2
                );
                if (distance >= 0) this.illuminateObject(ctx, obstacle, bullet, distance, radius, inten);
            }
        }

        if (player) {
            const distance = near(player.x + player.width / 2, player.y + player.height / 2);
            if (distance >= 0) this.illuminateObject(ctx, player, bullet, distance, radius, inten);
        }

        if (enemy) {
            const distance = near(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            if (distance >= 0) this.illuminateObject(ctx, enemy, bullet, distance, radius, inten);
        }
    }

    illuminateObject(ctx, object, bullet, distance, radius, inten) {
        const r = radius || Math.min(24, bullet.lightRadius || 14);
        const intensity = Math.max(0, 1 - (distance / r));
        const base = inten != null ? inten : Math.min(0.55, bullet.lightIntensity || 0.4);
        const illumination = intensity * base * 0.2;

        if (illumination > 0.08) {
            // Already in screen composite from renderLighting — no nested save.
            ctx.fillStyle = 'rgba(255, 255, 255, ' + illumination + ')';
            ctx.fillRect(object.x, object.y, object.width, object.height);
        }
    }

    getDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
}
