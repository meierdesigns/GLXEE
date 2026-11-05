"use strict";

/**
 * Lighting system for dynamic visual effects
 */
class LightingSystem {
    constructor() {
        // Empty constructor
    }

    // Lighting system for bullets
    renderLighting(ctx, bullets, obstacles, player, enemy) {
        if (!bullets || !bullets.length) return;
        for (let i = 0; i < bullets.length; i++) {
            const bullet = bullets[i];
            if (bullet && bullet.lightRadius && bullet.lightIntensity) {
                this.renderBulletLight(ctx, bullet, obstacles, player, enemy);
            }
        }
    }

    renderBulletLight(ctx, bullet, obstacles, player, enemy) {
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        
        // Soft point light — keep radius small so shots don't look like slabs
        const radius = Math.min(24, bullet.lightRadius || 14);
        const radius2 = radius * radius;
        const gradient = ctx.createRadialGradient(
            bulletCenterX, bulletCenterY, 0,
            bulletCenterX, bulletCenterY, radius
        );
        
        // Light falloff
        const inten = Math.min(0.55, bullet.lightIntensity || 0.4);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${inten})`);
        gradient.addColorStop(0.35, `rgba(255, 255, 255, ${inten * 0.35})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        // Apply lighting to nearby objects
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = gradient;
        ctx.fillRect(
            bulletCenterX - radius,
            bulletCenterY - radius,
            radius * 2,
            radius * 2
        );
        ctx.restore();

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
                if (distance >= 0) this.illuminateObject(ctx, obstacle, bullet, distance, radius);
            }
        }
        
        if (player) {
            const distance = near(player.x + player.width / 2, player.y + player.height / 2);
            if (distance >= 0) this.illuminateObject(ctx, player, bullet, distance, radius);
        }
        
        if (enemy) {
            const distance = near(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            if (distance >= 0) this.illuminateObject(ctx, enemy, bullet, distance, radius);
        }
    }

    illuminateObject(ctx, object, bullet, distance, radius) {
        const r = radius || Math.min(24, bullet.lightRadius || 14);
        const intensity = Math.max(0, 1 - (distance / r));
        const illumination = intensity * Math.min(0.55, bullet.lightIntensity || 0.4) * 0.2;
        
        if (illumination > 0.08) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = `rgba(255, 255, 255, ${illumination})`;
            ctx.fillRect(object.x, object.y, object.width, object.height);
            ctx.restore();
        }
    }

    getDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
}

