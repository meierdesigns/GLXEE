"use strict";

/**
 * Particle System for hit effects and visual enhancements
 */
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createHitParticles(x, y, count = 8, colorOrOpts = null) {
        let opts = null;
        let singleColor = null;
        if (colorOrOpts && typeof colorOrOpts === 'object' && !Array.isArray(colorOrOpts)) {
            opts = colorOrOpts;
        } else if (colorOrOpts) {
            singleColor = colorOrOpts;
        }
        const baseSpeed = opts && opts.speed != null ? Number(opts.speed) : 2.5;
        const baseLife = opts && opts.life != null ? Number(opts.life) : 40;
        const baseSize = opts && opts.size != null ? Number(opts.size) : 2;
        const colorList = opts && Array.isArray(opts.colors) ? opts.colors : null;
        // Per-frame velocity damping (1 = none): bounds how far a burst spreads.
        const drag = opts && opts.drag != null ? Math.max(0.5, Math.min(1, Number(opts.drag))) : 1;
        const n = Math.max(0, Math.round(count));

        for (let i = 0; i < n; i++) {
            const angle = (Math.PI * 2 * i) / Math.max(1, n) + Math.random() * 0.35;
            const speed = baseSpeed + Math.random() * baseSpeed * 0.8;
            const life = baseLife * (0.75 + Math.random() * 0.5);
            let color = null;
            if (colorList && colorList.length) {
                color = this.resolveColor(colorList[i % colorList.length]);
            } else if (singleColor) {
                color = this.resolveColor(singleColor);
            }

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life,
                maxLife: life,
                size: baseSize * (0.7 + Math.random() * 0.8),
                drag: drag,
                color: color || this.getRandomHitColor()
            });
        }
    }

    resolveColor(color) {
        if (!color) return null;
        if (typeof color === 'string' && color.indexOf('var(') === -1) {
            return color;
        }
        try {
            const root = getComputedStyle(document.documentElement);
            const match = String(color).match(/var\(\s*(--[^)\s]+)/);
            if (match) {
                const value = root.getPropertyValue(match[1]).trim();
                if (value) return value;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    getRandomHitColor() {
        try {
            const root = getComputedStyle(document.documentElement);
            const fromTheme = [
                root.getPropertyValue('--color-highlight').trim(),
                root.getPropertyValue('--color-text').trim(),
                root.getPropertyValue('--color-particle').trim(),
                root.getPropertyValue('--color-explosion').trim(),
                root.getPropertyValue('--color-secondary').trim(),
                root.getPropertyValue('--current-text').trim()
            ].filter(c => c && c.indexOf('var(') === -1);
            if (fromTheme.length) {
                return fromTheme[Math.floor(Math.random() * fromTheme.length)];
            }
        } catch (e) { /* ignore */ }
        const colors = ['#ffffff', '#ffe8cc', '#ffcc66', '#ffaa44', '#ffeeaa'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            particle.x += particle.vx;
            particle.y += particle.vy;
            if (particle.drag && particle.drag < 1) {
                particle.vx *= particle.drag;
                particle.vy *= particle.drag;
            }

            particle.vy += 0.1;
            particle.vx *= 0.98;

            particle.life--;

            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        ctx.save();
        for (const particle of this.particles) {
            const alpha = Math.max(0.4, particle.life / particle.maxLife);
            const s = Math.max(2, Math.ceil(particle.size));
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(
                Math.floor(particle.x - s / 2) - 1,
                Math.floor(particle.y - s / 2) - 1,
                s + 2,
                s + 2
            );
            ctx.globalAlpha = alpha;
            ctx.fillStyle = particle.color;
            ctx.fillRect(
                Math.floor(particle.x - s / 2),
                Math.floor(particle.y - s / 2),
                s,
                s
            );
        }
        ctx.restore();
    }

    clear() {
        this.particles = [];
    }
}
