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
        const baseSpeed = opts && opts.speed != null ? Number(opts.speed) : 1.35;
        const baseLife = opts && opts.life != null ? Number(opts.life) : 22;
        const baseSize = opts && opts.size != null ? Number(opts.size) : 1.4;
        const colorList = opts && Array.isArray(opts.colors) ? opts.colors : null;
        // Per-frame velocity damping (1 = none): bounds how far a burst spreads.
        const drag = opts && opts.drag != null ? Math.max(0.5, Math.min(1, Number(opts.drag))) : 0.88;
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
            const match = String(color).match(/var\(\s*(--[^)\s]+)/);
            if (match) {
                const value = vfCssVar(match[1]);
                if (value) return value;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    getRandomHitColor() {
        try {
            const fromTheme = [
                vfCssVar('--color-highlight'),
                vfCssVar('--color-text'),
                vfCssVar('--color-particle'),
                vfCssVar('--color-explosion'),
                vfCssVar('--color-secondary'),
                vfCssVar('--current-text')
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
        ctx.imageSmoothingEnabled = false;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        for (const particle of this.particles) {
            const alpha = Math.max(0.4, particle.life / particle.maxLife);
            // VOXEL: default one lattice cell; fine flecks (size < cell) use half-cell.
            let s;
            let snap = cell;
            if (cell) {
                if (particle.size > 0 && particle.size < cell * 0.85) {
                    snap = Math.max(1, cell * 0.5);
                    s = snap;
                } else {
                    s = cell;
                }
            } else {
                s = Math.max(2, Math.ceil(particle.size));
            }
            const px = cell ? Math.round((particle.x - s / 2) / snap) * snap : Math.floor(particle.x - s / 2);
            const py = cell ? Math.round((particle.y - s / 2) / snap) * snap : Math.floor(particle.y - s / 2);
            if (!cell) {
                ctx.globalAlpha = alpha * 0.5;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
            }
            if (cv && cv.fill) {
                cv.fill(ctx, px, py, s, s, particle.color, alpha);
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = particle.color;
                ctx.fillRect(px, py, s, s);
            }
        }
        ctx.restore();
    }

    clear() {
        this.particles = [];
    }
}
