"use strict";

/**
 * Particle System for hit effects and visual enhancements
 */
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    /** Soft cap from PERF / performance mode — keeps combat FPS stable. */
    maxParticles() {
        try {
            const root = document.documentElement;
            if (root.hasAttribute('data-vf-performance')) return 48;
            if (root.getAttribute('data-vf-perf-anim') === 'off') return 96;
            if (root.getAttribute('data-vf-perf-heavy') === 'off') return 140;
        } catch (e) { /* ignore */ }
        return 220;
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
        const gravity = opts && opts.gravity != null ? Number(opts.gravity) : 0.1;
        const kind = opts && opts.kind ? String(opts.kind) : 'spark';
        const fadeOut = !!(opts && opts.fadeOut);
        const cap = this.maxParticles();
        const room = Math.max(0, cap - this.particles.length);
        const n = Math.max(0, Math.min(room, Math.round(count)));
        if (n <= 0) return;

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

            const size = baseSize * (0.7 + Math.random() * 0.8);
            this.particles.push({
                x: x + (Math.random() - 0.5) * 2,
                y: y + (Math.random() - 0.5) * 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life,
                maxLife: life,
                size: size,
                w: kind === 'scrap' ? size * (0.6 + Math.random() * 1.4) : size,
                h: kind === 'scrap' ? size * (0.4 + Math.random() * 0.9) : size,
                drag: drag,
                gravity: gravity,
                kind: kind,
                fadeOut: fadeOut,
                color: color || this.getRandomHitColor()
            });
        }
    }

    /** Short cyan energy flecks when a shield absorbs a hit. */
    createShieldHitParticles(x, y, count = 7) {
        this.createHitParticles(x, y, count, {
            speed: 1.9,
            life: 12,
            size: 1.35,
            drag: 0.82,
            gravity: -0.015,
            kind: 'energy',
            fadeOut: true,
            colors: ['#e8f8ff', '#9fdcff', '#6ec8e8', '#ffffff', '#b8ecff']
        });
    }

    /** Tiny scrap chips when hull armor takes the hit. */
    createScrapHitParticles(x, y, count = 6) {
        this.createHitParticles(x, y, count, {
            speed: 2.1,
            life: 14,
            size: 1.55,
            drag: 0.86,
            gravity: 0.14,
            kind: 'scrap',
            fadeOut: true,
            colors: ['#8a9098', '#c4c8ce', '#5a6068', '#a89878', '#d0d4d8', '#6e6460']
        });
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
        const list = this.particles;
        for (let i = list.length - 1; i >= 0; i--) {
            const particle = list[i];

            particle.x += particle.vx;
            particle.y += particle.vy;
            if (particle.drag && particle.drag < 1) {
                particle.vx *= particle.drag;
                particle.vy *= particle.drag;
            }

            const g = particle.gravity != null ? particle.gravity : 0.1;
            particle.vy += g;
            particle.vx *= 0.98;

            particle.life--;

            if (particle.life <= 0) {
                const last = list.length - 1;
                if (i !== last) list[i] = list[last];
                list.pop();
            }
        }
    }

    render(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        for (const particle of this.particles) {
            const lifeT = particle.life / particle.maxLife;
            const alpha = particle.fadeOut
                ? Math.max(0, lifeT)
                : Math.max(0.4, lifeT);
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
                s = Math.max(1, Math.ceil(particle.size));
            }
            const isScrap = particle.kind === 'scrap';
            const pw = isScrap
                ? (cell ? Math.max(snap, Math.round((particle.w || s) / snap) * snap) : Math.max(1, Math.round(particle.w || s)))
                : s;
            const ph = isScrap
                ? (cell ? Math.max(snap, Math.round((particle.h || s) / snap) * snap) : Math.max(1, Math.round(particle.h || s)))
                : s;
            const px = cell
                ? Math.round((particle.x - pw / 2) / snap) * snap
                : Math.floor(particle.x - pw / 2);
            const py = cell
                ? Math.round((particle.y - ph / 2) / snap) * snap
                : Math.floor(particle.y - ph / 2);
            if (!cell && particle.kind === 'energy') {
                ctx.globalAlpha = alpha * 0.45;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
            } else if (!cell && !isScrap) {
                ctx.globalAlpha = alpha * 0.5;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
            }
            if (cv && cv.fill) {
                cv.fill(ctx, px, py, pw, ph, particle.color, alpha);
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = particle.color;
                ctx.fillRect(px, py, pw, ph);
            }
        }
        ctx.restore();
    }

    clear() {
        this.particles = [];
    }
}
