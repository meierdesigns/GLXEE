"use strict";

// RenderManager methods, split from render.js.
extendClass(RenderManager, {
    // Draw bullet with weapon color and proximity lighting
    drawBullet(ctx, bullet, lighting) {
        ctx.save();

        let bulletColor = this.resolveCss(this.getBulletColor(bullet), '#ffffff');

        // Bonus (charged / beat) shots: same size, brighter colour.
        if (bullet.bonusGlow > 0) {
            bulletColor = this.blendColors(bulletColor, '#ffffff', 0.25 + 0.45 * bullet.bonusGlow);
        }

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

        // Shots that know their weapon get its shape, so the type reads at a glance.
        if (bullet.weaponId) {
            this.drawTypedBullet(ctx, bullet, bulletColor, x, y, w, h);
            ctx.restore();
            return;
        }

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

    /**
     * Per-weapon shot silhouette inside the bullet's w×h box, in the weapon's
     * colour with a white-hot core. The leading end faces the travel
     * direction (up for the player, down for enemies).
     */
    drawTypedBullet(ctx, bullet, color, x, y, w, h) {
        const id = String(bullet.weaponId);
        const down = !!(bullet.isEnemyShot || String(bullet.type || '').indexOf('enemy') === 0);
        const cx = x + w / 2;
        const lead = down ? y + h : y;           // tip end
        const dir = down ? 1 : -1;               // towards the tip
        const hot = '#ffffff';
        const rect = (rx, ry, rw, rh, c, a) => {
            ctx.globalAlpha = a == null ? 1 : a;
            ctx.fillStyle = c;
            ctx.fillRect(Math.round(rx), Math.round(ry), Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh)));
        };
        // Every shape stays inside the shot's own w×h box, so the drawn
        // shot is as big as the shot (which is sized to its gun's barrel).
        // Soft halo only on wide shots — on thin ones it tripled the width.
        if (w >= 3) rect(x - 1, y - 1, w + 2, h + 2, color, 0.3);
        const tipY = (len) => (down ? lead - len : lead);
        switch (id) {
            case 'plasma':
            case 'nova': {
                // Orb: round body, bright centre (nova adds star spikes).
                const r = Math.max(1, Math.min(w, h) / 2);
                const cy = y + h / 2;
                rect(cx - r, cy - r / 2, r * 2, r, color);
                rect(cx - r / 2, cy - r, r, r * 2, color);
                rect(cx - r / 3, cy - r / 3, r / 1.5, r / 1.5, hot);
                if (id === 'nova') {
                    rect(cx - 0.5, cy - r - 2, 1, r * 2 + 4, color, 0.8);
                    rect(cx - r - 2, cy - 0.5, r * 2 + 4, 1, color, 0.8);
                }
                break;
            }
            case 'missile': {
                // Body + nose + flickering exhaust at the tail.
                const bw = w;
                const tl = Math.max(1, Math.round(h / 4));
                rect(cx - bw / 2, y, bw, h - tl, color);
                rect(cx - bw / 4, tipY(1), bw / 2, 1, hot);
                const tail = down ? y : y + h - tl;
                rect(cx - bw / 4, tail, bw / 2, tl, '#ffb03d', 0.5 + 0.5 * Math.random());
                break;
            }
            case 'wave': {
                // Sine wiggle: offset segments down the length.
                const seg = Math.max(2, Math.round(h / 4));
                for (let i = 0; i < h; i += seg) {
                    const ww = Math.max(1, w / 2);
                    const off = Math.sin((i / h) * Math.PI * 2 + (bullet.wavePhase || 0)) * (w - ww) / 2;
                    rect(cx - ww / 2 + off, y + i, ww, seg, color);
                }
                rect(cx - 0.5, tipY(2), 1, 2, hot);
                break;
            }
            case 'ion': {
                // Core with bright ring bands.
                rect(cx - w / 2, y, w, h, color, 0.8);
                for (let i = 1; i < h - 1; i += 3) rect(cx - w / 2, y + i, w, 1, hot, 0.85);
                break;
            }
            case 'spread':
            case 'spike_burst': {
                // Diamond / arrowhead pointing along travel.
                const half = Math.max(0.5, w / 2);
                const len = h;
                for (let i = 0; i < len; i++) {
                    const t = i / len;
                    const ww = Math.max(1, half * 2 * (t < 0.4 ? t / 0.4 : (1 - t) / 0.6));
                    const ry = down ? lead - 1 - i : lead + i;
                    rect(cx - ww / 2, ry, ww, 1, color);
                }
                rect(cx - 0.5, tipY(2), 1, 2, hot);
                break;
            }
            case 'rapid':
            case 'burst': {
                // Short dashes in a row.
                const seg = Math.max(2, Math.round(h / 3));
                for (let i = 0; i < h; i += seg + 1) rect(cx - w / 2, y + i, w, seg, color);
                rect(cx - w / 4, tipY(2), w / 2, 2, hot);
                break;
            }
            case 'pierce':
            case 'railgun': {
                // Thin needle with a long bright tip.
                const nw = Math.max(1, w - 1);
                rect(cx - nw / 2, y, nw, h, color);
                rect(cx - 0.5, tipY(Math.max(1, h / 2)), 1, Math.max(1, h / 2), hot);
                break;
            }
            case 'claw_beam': {
                // Two prongs with a beam between them.
                rect(x, y, 1, h, color);
                rect(x + w - 1, y, 1, h, color);
                rect(cx - Math.max(0.5, w / 4), y, Math.max(1, w / 2), h, hot, 0.9);
                break;
            }
            default: {
                // Laser: solid beam with a hot core line.
                rect(x, y, w, h, color);
                if (w >= 2) rect(cx - Math.max(0.5, w / 4), y + 1, Math.max(1, w / 2), Math.max(1, h - 2), hot, 0.85);
                else rect(x, tipY(2), w, 2, hot);
            }
        }
        ctx.globalAlpha = 1;
    },

    // Get bullet color based on type and current color scheme
    getBulletColor(bullet) {
        // Shots tagged with a weapon (player and enemy) take its type colour (same as its icon).
        if (bullet.weaponId && typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor) {
            const typeColor = weaponConfigManager.getWeaponUiColor(bullet.weaponId);
            if (typeColor) return typeColor;
        }
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
        if (typeof iconRenderer !== 'undefined' && iconRenderer.drawWeapon) {
            iconRenderer.drawWeapon(ctx, currentType, 400 - 32 - 10, 10, 32);
            return;
        }
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
