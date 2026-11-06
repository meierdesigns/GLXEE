"use strict";

/**
 * Particle System for hit effects and visual enhancements.
 * Objects are pooled so long fights don't churn GC on every hit.
 */
const PARTICLE_POOL_MAX = 640;
const SHIELD_HIT_OPTS = {
    speed: 1.9,
    life: 12,
    size: 1.35,
    drag: 0.82,
    gravity: -0.015,
    kind: 'energy',
    fadeOut: true,
    colors: ['#e8f8ff', '#9fdcff', '#6ec8e8', '#ffffff', '#b8ecff']
};
const SCRAP_HIT_OPTS = {
    speed: 2.1,
    life: 14,
    size: 1.55,
    drag: 0.86,
    gravity: 0.14,
    kind: 'scrap',
    fadeOut: true,
    colors: ['#8a9098', '#c4c8ce', '#5a6068', '#a89878', '#d0d4d8', '#6e6460']
};
const FALLBACK_HIT_COLORS = ['#ffffff', '#ffe8cc', '#ffcc66', '#ffaa44', '#ffeeaa'];

class ParticleSystem {
    constructor() {
        this.particles = [];
        this._pool = [];
        this._themeColors = null;
        this._themeAt = 0;
    }

    /**
     * Hard safety cap only in explicit PERFORMANCE MODE.
     * Default stays uncapped enough for full explosion quality.
     */
    maxParticles() {
        try {
            if (document.documentElement.hasAttribute('data-vf-performance')) return 96;
        } catch (e) { /* ignore */ }
        return 480;
    }

    _acquire() {
        const p = this._pool.pop();
        return p || {
            x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
            size: 1, w: 1, h: 1, drag: 0.88, gravity: 0.1,
            kind: 'spark', fadeOut: false, color: '#ffffff'
        };
    }

    _release(p) {
        if (!p) return;
        if (this._pool.length < PARTICLE_POOL_MAX) this._pool.push(p);
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
            const p = this._acquire();
            p.x = x + (Math.random() - 0.5) * 2;
            p.y = y + (Math.random() - 0.5) * 2;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.life = life;
            p.maxLife = life;
            p.size = size;
            p.w = kind === 'scrap' ? size * (0.6 + Math.random() * 1.4) : size;
            p.h = kind === 'scrap' ? size * (0.4 + Math.random() * 0.9) : size;
            p.drag = drag;
            p.gravity = gravity;
            p.kind = kind;
            p.fadeOut = fadeOut;
            p.color = color || this.getRandomHitColor();
            this.particles.push(p);
        }
    }

    /** Short cyan energy flecks when a shield absorbs a hit. */
    createShieldHitParticles(x, y, count = 7) {
        this.createHitParticles(x, y, count, SHIELD_HIT_OPTS);
    }

    /** Tiny scrap chips when hull armor takes the hit. */
    createScrapHitParticles(x, y, count = 6) {
        this.createHitParticles(x, y, count, SCRAP_HIT_OPTS);
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
        const now = (typeof performance !== 'undefined') ? performance.now() : 0;
        if (!this._themeColors || (now - this._themeAt) > 250) {
            try {
                const next = [];
                const names = [
                    '--color-highlight', '--color-text', '--color-particle',
                    '--color-explosion', '--color-secondary', '--current-text'
                ];
                for (let i = 0; i < names.length; i++) {
                    const c = vfCssVar(names[i]);
                    if (c && c.indexOf('var(') === -1) next.push(c);
                }
                this._themeColors = next.length ? next : FALLBACK_HIT_COLORS;
            } catch (e) {
                this._themeColors = FALLBACK_HIT_COLORS;
            }
            this._themeAt = now;
        }
        const colors = this._themeColors;
        return colors[(Math.random() * colors.length) | 0];
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
                this._release(list.pop());
            }
        }
    }

    render(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        const list = this.particles;
        for (let i = 0; i < list.length; i++) {
            const particle = list[i];
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
        const list = this.particles;
        for (let i = 0; i < list.length; i++) this._release(list[i]);
        list.length = 0;
    }
}
