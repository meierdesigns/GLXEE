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
        // Create lighting effects for each bullet
        bullets.forEach(bullet => {
            if (bullet.lightRadius && bullet.lightIntensity) {
                this.renderBulletLight(ctx, bullet, obstacles, player, enemy);
            }
        });
    }

    renderBulletLight(ctx, bullet, obstacles, player, enemy) {
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        
        // Soft point light — keep radius small so shots don't look like slabs
        const radius = Math.min(24, bullet.lightRadius || 14);
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
        
        // Illuminate nearby obstacles
        obstacles.forEach(obstacle => {
            const distance = this.getDistance(bulletCenterX, bulletCenterY, 
                obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
            
            if (distance < radius) {
                this.illuminateObject(ctx, obstacle, bullet, distance, radius);
            }
        });
        
        // Illuminate player if nearby
        if (player) {
            const distance = this.getDistance(bulletCenterX, bulletCenterY,
                player.x + player.width / 2, player.y + player.height / 2);
            
            if (distance < radius) {
                this.illuminateObject(ctx, player, bullet, distance, radius);
            }
        }
        
        // Illuminate enemy if nearby
        if (enemy) {
            const distance = this.getDistance(bulletCenterX, bulletCenterY,
                enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            
            if (distance < radius) {
                this.illuminateObject(ctx, enemy, bullet, distance, radius);
            }
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

