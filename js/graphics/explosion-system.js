"use strict";

/**
 * Runtime explosion player — particles + timed ring bursts from presets.
 */
class ExplosionSystem {
    constructor() {
        this.active = [];
    }

    resolvePreset(presetId) {
        if (typeof explosionConfigManager !== 'undefined') {
            return explosionConfigManager.getPreset(presetId);
        }
        return {
            id: 'default',
            name: 'Default',
            particleCount: 14,
            particleSpeed: 2.5,
            particleLife: 40,
            particleSize: 2,
            colors: ['var(--color-explosion)', 'var(--color-highlight)'],
            rings: 2,
            ringDurationMs: 600,
            ringScale: 1,
            sparkles: 6,
            sound: 'explosion',
            screenShake: 0
        };
    }

    play(presetId, x, y, options) {
        const opts = options || {};
        const preset = this.resolvePreset(presetId || 'default');
        const scale = opts.scale != null ? Number(opts.scale) : 1;
        const silent = !!opts.silent;

        if (typeof graphicsManager !== 'undefined' && graphicsManager.particleSystem) {
            const colors = preset.colors && preset.colors.length ? preset.colors : null;
            graphicsManager.particleSystem.createHitParticles(x, y, Math.round(preset.particleCount * scale), {
                speed: preset.particleSpeed * scale,
                life: preset.particleLife,
                size: preset.particleSize * scale,
                colors: colors
            });
            if (preset.colors && preset.colors.length > 1) {
                graphicsManager.particleSystem.createHitParticles(
                    x, y,
                    Math.max(4, Math.round(preset.particleCount * 0.45 * scale)),
                    {
                        speed: preset.particleSpeed * 0.85 * scale,
                        life: Math.round(preset.particleLife * 0.8),
                        size: preset.particleSize * 0.9 * scale,
                        colors: [preset.colors[1]]
                    }
                );
            }
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(x, y, preset.particleCount, (preset.colors && preset.colors[0]) || null);
        }

        if (preset.rings > 0) {
            this.active.push({
                x: x,
                y: y,
                width: opts.width != null ? opts.width : 24,
                height: opts.height != null ? opts.height : 24,
                timer: 0,
                duration: preset.ringDurationMs,
                rings: preset.rings,
                ringScale: preset.ringScale * scale,
                sparkles: preset.sparkles,
                colors: preset.colors ? preset.colors.slice() : [],
                presetId: preset.id
            });
        }

        if (!silent && preset.sound && preset.sound !== 'none' && typeof soundManager !== 'undefined') {
            if (preset.sound === 'kill' && soundManager.playKill) soundManager.playKill();
            else if (preset.sound === 'hit' && soundManager.playHit) soundManager.playHit();
            else if (soundManager.playExplosion) soundManager.playExplosion(0.85);
        }

        // screenShake reserved — no shake system yet
        return preset;
    }

    update(deltaTime) {
        const dt = deltaTime || 16;
        for (let i = this.active.length - 1; i >= 0; i--) {
            this.active[i].timer += dt;
            if (this.active[i].timer >= this.active[i].duration) {
                this.active.splice(i, 1);
            }
        }
    }

    render(ctx) {
        if (!ctx || !this.active.length) return;
        for (let i = 0; i < this.active.length; i++) {
            this.drawBurst(ctx, this.active[i]);
        }
    }

    themeColor(vars, fallback) {
        try {
            const root = getComputedStyle(document.documentElement);
            for (let i = 0; i < vars.length; i++) {
                const v = root.getPropertyValue(vars[i]).trim();
                if (v) return v;
            }
        } catch (e) { /* ignore */ }
        return fallback;
    }

    resolveColor(color, fallback) {
        if (!color) return fallback;
        if (typeof color === 'string' && color.indexOf('var(') === -1) return color;
        try {
            const match = String(color).match(/var\(\s*(--[^)\s]+)/);
            if (match) {
                const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                if (value) return value;
            }
        } catch (e) { /* ignore */ }
        return fallback;
    }

    drawBurst(ctx, burst) {
        const progress = Math.min(1, burst.timer / Math.max(1, burst.duration));
        const baseSize = (burst.width + burst.height) * 0.5 * burst.ringScale;
        const explosionSize = baseSize * (0.5 + progress * 2);
        const centerX = burst.x;
        const centerY = burst.y;
        const pixelSize = 4;
        const explosionRadius = Math.floor(explosionSize / pixelSize);

        const fallbacks = [
            this.themeColor(['--color-highlight', '--color-text'], '#ffffff'),
            this.themeColor(['--color-explosion', '--color-particle'], '#ff8844'),
            this.themeColor(['--color-secondary', '--color-accent'], '#ffaa66')
        ];
        const colors = (burst.colors || []).map((c, i) => this.resolveColor(c, fallbacks[i % fallbacks.length]));
        while (colors.length < 3) colors.push(fallbacks[colors.length]);

        ctx.save();
        const ringCount = Math.max(1, burst.rings || 1);
        for (let ring = 0; ring < ringCount; ring++) {
            const ringRadius = Math.floor(explosionRadius * (0.3 + ring * 0.3));
            const alpha = 1 - progress - (ring * 0.2);
            if (alpha <= 0) continue;
            ctx.globalAlpha = Math.max(0.35, Math.min(1, alpha));
            ctx.fillStyle = colors[ring % colors.length];
            for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
                const pixelX = Math.floor(centerX + Math.cos(angle) * ringRadius * pixelSize);
                const pixelY = Math.floor(centerY + Math.sin(angle) * ringRadius * pixelSize);
                ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
        }

        ctx.globalAlpha = 1;
        const sparkleCount = burst.sparkles || 0;
        for (let i = 0; i < sparkleCount; i++) {
            const sparkleX = Math.floor(centerX + (Math.random() - 0.5) * explosionSize);
            const sparkleY = Math.floor(centerY + (Math.random() - 0.5) * explosionSize);
            ctx.fillStyle = i % 2 ? colors[0] : colors[1];
            ctx.fillRect(sparkleX, sparkleY, pixelSize, pixelSize);
        }

        if (progress < 0.35) {
            ctx.fillStyle = colors[0];
            ctx.fillRect(centerX - pixelSize, centerY - pixelSize, pixelSize * 2, pixelSize * 2);
        }
        ctx.restore();
    }

    clear() {
        this.active.length = 0;
    }
}

const explosionSystem = new ExplosionSystem();
