"use strict";

// RenderManager methods, split from render.js.
extendClass(RenderManager, {
    // Draw bullet with weapon color and proximity lighting
    drawBullet(ctx, bullet, lighting) {
        ctx.save();

        let bulletColor = this.resolveCss(this.getBulletColor(bullet), '#ffffff');

        if (lighting && lighting.intensity > 0 && lighting.color) {
            bulletColor = this.blendColors(
                bulletColor,
                this.resolveCss(lighting.color, bulletColor),
                lighting.intensity
            );
        }

        const x = Math.floor(bullet.x);
        const y = Math.floor(bullet.y);
        const w = Math.max(1, Math.ceil(bullet.width));
        const h = Math.max(1, Math.ceil(bullet.height));

        // Outer glow then bright core — keep glow thin so shots stay small
        const glow = this.themeColor(['--color-highlight', '--color-text', '--current-text'], '#ffffff');
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = glow;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = bulletColor;
        ctx.fillRect(x, y, w, h);
        if (w >= 2 && h >= 3) {
            ctx.fillStyle = glow;
            ctx.fillRect(x + Math.floor(w / 4), y + 1, Math.max(1, Math.ceil(w / 2)), Math.max(1, h - 2));
        }

        ctx.restore();
    },

    // Get bullet color based on type and current color scheme
    getBulletColor(bullet) {
        const isLaserType = bullet.type && (
            bullet.type.includes('laser') ||
            bullet.type.includes('beam') ||
            bullet.type.includes('spread') ||
            bullet.type.includes('rapid') ||
            bullet.type.includes('plasma') ||
            bullet.type.includes('missile') ||
            bullet.type.includes('ion') ||
            bullet.type.includes('wave') ||
            bullet.type.includes('burst') ||
            bullet.type.includes('pierce') ||
            bullet.type.includes('nova') ||
            bullet.type.includes('shot')
        );
        
        if (isLaserType) {
            return this.getLaserColor(bullet);
        }
        
        return this.resolveCss(bullet.color || 'var(--color-bullet)', this.themeColor(['--color-bullet', '--color-highlight'], '#ffffff'));
    },

    // Get laser color with applied color scheme
    getLaserColor(bullet) {
        const schemeColor = this.themeColor(
            ['--color-bullet', '--color-highlight', '--color-primary', '--color-basecolor'],
            '#ffffff'
        );
        
        let intensity = 0.95;
        if (bullet.type) {
            if (bullet.type.includes('plasma') || bullet.type.includes('nova')) {
                intensity = 1.0;
            } else if (bullet.type.includes('missile') || bullet.type.includes('pierce')) {
                intensity = 0.98;
            } else if (bullet.type.includes('rapid') || bullet.type.includes('burst')) {
                intensity = 0.9;
            } else if (bullet.type.includes('spread') || bullet.type.includes('wave') || bullet.type.includes('ion')) {
                intensity = 0.92;
            }
        }
        
        return this.applyColorSchemeToGrayscale(schemeColor, intensity);
    },

    // Apply color scheme to grayscale base — keep FX bright (old 128*intensity crushed bullets)
    applyColorSchemeToGrayscale(schemeColor, intensity = 0.95) {
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 255, g: 255, b: 255 };
        };
        
        const rgbToHex = (r, g, b) => {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };
        
        const schemeRgb = hexToRgb(this.resolveCss(schemeColor, '#ffffff'));
        const t = Math.max(0.55, Math.min(1, intensity));
        // High luminance floor so projectiles read against dark/tinted playfields
        const lum = Math.floor(200 + 55 * t);
        const finalR = Math.min(255, Math.floor(lum * schemeRgb.r / 255));
        const finalG = Math.min(255, Math.floor(lum * schemeRgb.g / 255));
        const finalB = Math.min(255, Math.floor(lum * schemeRgb.b / 255));
        
        return rgbToHex(finalR, finalG, finalB);
    },

    // Blend two colors with intensity
    blendColors(color1, color2, intensity) {
        if (!color1 || !color2 || typeof color1 !== 'string' || typeof color2 !== 'string') {
            return color1 || color2 || '#ffffff';
        }
        const a = this.resolveCss(color1, '#ffffff');
        const b = this.resolveCss(color2, '#ffffff');
        if (!a.startsWith('#') || !b.startsWith('#')) return a;
        
        const r1 = parseInt(a.substr(1, 2), 16) || 255;
        const g1 = parseInt(a.substr(3, 2), 16) || 255;
        const b1 = parseInt(a.substr(5, 2), 16) || 255;
        
        const r2 = parseInt(b.substr(1, 2), 16) || 255;
        const g2 = parseInt(b.substr(3, 2), 16) || 255;
        const b2 = parseInt(b.substr(5, 2), 16) || 255;
        
        const r = Math.round(r1 + (r2 - r1) * intensity);
        const g = Math.round(g1 + (g2 - g1) * intensity);
        const bl = Math.round(b1 + (b2 - b1) * intensity);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
    },

    drawHealthBar(ctx, x, y, width, health, maxHealth, color) {
        const barWidth = width;
        const barHeight = 4;
        const healthPercent = health / maxHealth;
        
        ctx.fillStyle = this.resolveCss('var(--current-background)', '#0a0a0a');
        ctx.fillRect(x, y, barWidth, barHeight);
        
        ctx.fillStyle = this.resolveCss(color || 'var(--color-highlight)', this.themeColor(['--color-highlight', '--color-primary'], '#ffaa44'));
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        ctx.strokeStyle = this.resolveCss('var(--current-border)', '#808080');
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    },

    drawExplosion(ctx, x, y, width, height) {
        const explosionProgress = enemyManager.explosionTimer / enemyManager.explosionDuration;
        const explosionSize = (width + height) * (0.5 + explosionProgress * 2);
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        const pixelSize = 4;
        const explosionRadius = Math.floor(explosionSize / pixelSize);
        const c0 = this.themeColor(['--color-highlight', '--color-text', '--current-text'], '#ffffff');
        const c1 = this.themeColor(['--color-explosion', '--color-particle', '--color-primary'], '#ff8844');
        const c2 = this.themeColor(['--color-secondary', '--color-accent'], '#ffaa66');
        
        for (let ring = 0; ring < 3; ring++) {
            const ringRadius = Math.floor(explosionRadius * (0.3 + ring * 0.3));
            const alpha = 1 - explosionProgress - (ring * 0.2);
            
            if (alpha <= 0) continue;
            
            let color = c1;
            if (ring === 0) color = c0;
            else if (ring === 2) color = c2;
            
            ctx.globalAlpha = Math.max(0.35, Math.min(1, alpha));
            ctx.fillStyle = color;
            
            for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
                const pixelX = Math.floor(centerX + Math.cos(angle) * ringRadius * pixelSize);
                const pixelY = Math.floor(centerY + Math.sin(angle) * ringRadius * pixelSize);
                ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
        }
        
        ctx.globalAlpha = 1;
        for (let i = 0; i < 8; i++) {
            const sparkleX = Math.floor(centerX + (Math.random() - 0.5) * explosionSize);
            const sparkleY = Math.floor(centerY + (Math.random() - 0.5) * explosionSize);
            ctx.fillStyle = i % 2 ? c0 : c1;
            ctx.fillRect(sparkleX, sparkleY, pixelSize, pixelSize);
        }
        
        if (explosionProgress < 0.35) {
            ctx.fillStyle = c0;
            ctx.fillRect(centerX - pixelSize, centerY - pixelSize, pixelSize * 2, pixelSize * 2);
        }
    },

    drawShotTypeIcon(ctx) {
        const currentType = bulletManager.getCurrentShotType();
        let iconName = 'shotLaser';
        if (typeof bulletManager.getWeaponIconKey === 'function') {
            iconName = bulletManager.getWeaponIconKey(currentType);
        } else {
            const legacy = {
                normal: 'shotNormal',
                laser: 'shotLaser',
                spread: 'shotSpread',
                rapid: 'shotRapid',
                plasma: 'shotPlasma'
            };
            iconName = legacy[currentType] || 'shotLaser';
        }

        const sprite = graphicsManager.getSprite(iconName) || graphicsManager.getSprite('shotNormal');
        if (sprite) {
            const iconSize = 32;
            const x = 400 - iconSize - 10;
            const y = 10;
            graphicsManager.drawSprite(ctx, sprite, x, y, iconSize, iconSize);
        }
    },
});
