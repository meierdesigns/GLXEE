"use strict";

/**
 * Runtime explosion player — particles + timed ring bursts from presets,
 * plus hull voxel debris sampled from the dying ship silhouette.
 */
// Velocity kept per frame by explosion particles: max spread ≈ speed / (1 − drag).
const EXPLOSION_PARTICLE_DRAG = 0.86;
// Largest ring base size in playfield pixels.
const EXPLOSION_MAX_BASE = 22;
const SHIP_VOXEL_DEBRIS_MAX = 120;

class ExplosionSystem {
    constructor() {
        this.active = [];
        this.voxels = [];
        this._sampleCanvas = null;
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

    isVoxelStyle() {
        return typeof uiAppearanceManager !== 'undefined'
            && String(uiAppearanceManager.shipRenderStyle || '').toUpperCase() === 'VOXEL';
    }

    play(presetId, x, y, options) {
        const opts = options || {};
        const preset = this.resolvePreset(presetId || 'default');
        const scale = opts.scale != null ? Number(opts.scale) : 1;
        // Optional: keep flecks fine while spread/rings still scale up (big rocks).
        const pSizeMul = opts.particleSizeScale != null ? Number(opts.particleSizeScale) : scale;
        const silent = !!opts.silent;

        if (typeof graphicsManager !== 'undefined' && graphicsManager.particleSystem) {
            const colors = preset.colors && preset.colors.length ? preset.colors : null;
            graphicsManager.particleSystem.createHitParticles(x, y, Math.round(preset.particleCount * scale), {
                speed: preset.particleSpeed * scale,
                life: preset.particleLife,
                size: preset.particleSize * pSizeMul,
                colors: colors,
                drag: EXPLOSION_PARTICLE_DRAG
            });
            if (preset.colors && preset.colors.length > 1) {
                graphicsManager.particleSystem.createHitParticles(
                    x, y,
                    Math.max(4, Math.round(preset.particleCount * 0.45 * scale)),
                    {
                        speed: preset.particleSpeed * 0.85 * scale,
                        life: Math.round(preset.particleLife * 0.8),
                        size: preset.particleSize * 0.9 * pSizeMul,
                        colors: [preset.colors[1]],
                        drag: EXPLOSION_PARTICLE_DRAG
                    }
                );
            }
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(x, y, preset.particleCount, (preset.colors && preset.colors[0]) || null);
        }

        if (preset.rings > 0) {
            const bw = opts.width != null ? opts.width : 14;
            const bh = opts.height != null ? opts.height : 14;
            // Large sources: denser ring stepping so the burst isn't blocky.
            const fineRing = Math.max(bw, bh) >= 16;
            this.active.push({
                x: x,
                y: y,
                width: bw,
                height: bh,
                timer: 0,
                duration: preset.ringDurationMs,
                rings: fineRing ? Math.max(preset.rings, preset.rings + 1) : preset.rings,
                ringScale: preset.ringScale * scale,
                sparkles: fineRing
                    ? Math.round(preset.sparkles * (1.2 + Math.min(1.2, Math.max(bw, bh) / 28)))
                    : preset.sparkles,
                colors: preset.colors ? preset.colors.slice() : [],
                presetId: preset.id,
                fineRing: fineRing
            });
        }

        if (opts.ship) {
            this.spawnShipVoxels(opts.ship, {
                scale: scale,
                power: opts.voxelPower != null ? opts.voxelPower : 1
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

    /**
     * Sample the ship's rendered silhouette into flying voxel chips.
     * VOXEL style: denser grid, larger chunks, longer tumble.
     */
    spawnShipVoxels(ship, options) {
        if (!ship) return;
        const opts = options || {};
        const samples = this.sampleShipPixels(ship);
        if (!samples.length) return;

        const voxel = this.isVoxelStyle();
        const power = opts.power != null ? Number(opts.power) : 1;
        const ox = ship.x || 0;
        const oy = ship.y || 0;
        const cx = ox + (ship.width || 0) / 2;
        const cy = oy + (ship.height || 0) / 2;
        const shared = (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell)
            ? renderManager.getCombatVoxelCell()
            : null;
        const cell = (shared != null && shared > 0)
            ? shared
            : (voxel ? Math.max(2, samples.step || 2) : Math.max(2, (samples.step || 3)));
        const max = voxel ? SHIP_VOXEL_DEBRIS_MAX : Math.floor(SHIP_VOXEL_DEBRIS_MAX * 0.55);
        const stride = Math.max(1, Math.ceil(samples.length / max));

        for (let i = 0; i < samples.length; i += stride) {
            const p = samples[i];
            const wx = ox + p.x + cell * 0.5;
            const wy = oy + p.y + cell * 0.5;
            const dx = wx - cx;
            const dy = wy - cy;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            const burst = (voxel ? 1.6 : 1.1) * power * (0.55 + Math.random() * 1.1);
            const tang = (Math.random() - 0.5) * (voxel ? 2.2 : 1.2) * power;
            // Always one lattice cell — no double-size chunks in VOXEL combat.
            this.voxels.push({
                x: wx,
                y: wy,
                vx: nx * burst + (-ny) * tang * 0.35,
                vy: ny * burst + nx * tang * 0.35 - (voxel ? 0.15 : 0),
                rot: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * (voxel ? 0.35 : 0.18),
                s: cell,
                c: p.c,
                life: 0,
                ttl: (voxel ? 700 : 480) + Math.random() * (voxel ? 900 : 520),
                delay: voxel ? Math.min(220, dist * 2.2 + Math.random() * 80) : Math.random() * 40,
                g: voxel ? 0.012 + Math.random() * 0.02 : 0.006
            });
        }

        // Hot core chips — bright voxels from the blast centre.
        const hotN = voxel ? 10 : 5;
        for (let i = 0; i < hotN; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = (voxel ? 2.4 : 1.6) * power * (0.7 + Math.random());
            this.voxels.push({
                x: cx,
                y: cy,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                rot: 0,
                spin: (Math.random() - 0.5) * 0.4,
                s: cell,
                c: i % 2 ? '#ffe9a8' : '#ffffff',
                life: 0,
                ttl: 180 + Math.random() * 160,
                delay: 0,
                g: 0.004
            });
        }

        if (this.voxels.length > SHIP_VOXEL_DEBRIS_MAX * 1.5) {
            this.voxels.splice(0, this.voxels.length - Math.floor(SHIP_VOXEL_DEBRIS_MAX * 1.5));
        }
    }

    /** Render ship to an offscreen canvas and return solid pixel samples. */
    sampleShipPixels(ship) {
        const w = Math.max(4, Math.min(96, Math.ceil(ship.width || 16)));
        const h = Math.max(4, Math.min(96, Math.ceil(ship.height || 16)));
        const voxel = this.isVoxelStyle();
        const shared = (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell)
            ? renderManager.getCombatVoxelCell()
            : null;
        const step = Math.max(1, Math.round(
            (shared != null && shared > 0) ? shared : (voxel ? 2 : 3)
        ));
        if (!this._sampleCanvas) this._sampleCanvas = document.createElement('canvas');
        const canvas = this._sampleCanvas;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        const ghost = Object.assign({}, ship, { x: 0, y: 0, width: w, height: h });
        try {
            if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
                graphicsManager.renderEnemyShip(ctx, ghost, 1);
            } else if (typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
                shipRenderer.renderShipPreview(canvas, ghost, 1);
            } else {
                return [];
            }
        } catch (e) {
            return [];
        }

        let data;
        try {
            data = ctx.getImageData(0, 0, w, h).data;
        } catch (e) {
            return [];
        }

        const out = [];
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const i = (y * w + x) * 4;
                const a = data[i + 3];
                if (a < 160) continue;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (r + g + b < 40) continue;
                out.push({
                    x: x,
                    y: y,
                    c: 'rgb(' + r + ',' + g + ',' + b + ')'
                });
            }
        }
        out.step = step;
        return out;
    }

    update(deltaTime) {
        const dt = deltaTime || 16;
        for (let i = this.active.length - 1; i >= 0; i--) {
            this.active[i].timer += dt;
            if (this.active[i].timer >= this.active[i].duration) {
                this.active.splice(i, 1);
            }
        }

        const f = Math.min(3, dt / 16.67);
        const list = this.voxels;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.life += dt;
            if (p.life < (p.delay || 0)) continue;
            if (p.life >= p.ttl) {
                list.splice(i, 1);
                continue;
            }
            p.vy += (p.g || 0) * f;
            p.x += p.vx * f;
            p.y += p.vy * f;
            p.vx *= Math.pow(0.965, f);
            p.vy *= Math.pow(0.965, f);
            p.rot += (p.spin || 0) * f;
            p.spin *= Math.pow(0.98, f);
        }
    }

    render(ctx) {
        if (!ctx) return;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        if (this.voxels.length) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            for (let i = 0; i < this.voxels.length; i++) {
                const p = this.voxels[i];
                if (p.life < (p.delay || 0)) continue;
                const t = p.life / Math.max(1, p.ttl);
                const alpha = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
                const s = cell
                    ? Math.max(cell, Math.round(Math.max(1, p.s) / cell) * cell)
                    : Math.max(1, Math.round(p.s));
                // VOXEL: no rotation — keep axis-aligned lattice blocks.
                if (!cell && (Math.abs(p.spin) > 0.02 || Math.abs(p.rot) > 0.05)) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.c;
                    ctx.save();
                    ctx.translate(Math.round(p.x), Math.round(p.y));
                    ctx.rotate(p.rot);
                    ctx.fillRect(-Math.floor(s / 2), -Math.floor(s / 2), s, s);
                    ctx.restore();
                } else if (cv && cv.fill) {
                    const px = cell ? Math.round((p.x - s / 2) / cell) * cell : Math.round(p.x - s / 2);
                    const py = cell ? Math.round((p.y - s / 2) / cell) * cell : Math.round(p.y - s / 2);
                    cv.fill(ctx, px, py, s, s, p.c, alpha);
                } else {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.c;
                    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
                }
            }
            ctx.restore();
        }
        if (!this.active.length) return;
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
        // Capped so big ships don't fill half the playfield; the ring grows
        // to ~1.5× its base instead of 2.5×.
        const baseSize = Math.max(8, Math.min(EXPLOSION_MAX_BASE,
            (burst.width + burst.height) * 0.5 * burst.ringScale));
        const explosionSize = baseSize * (0.5 + progress);
        const centerX = burst.x;
        const centerY = burst.y;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        // Fine bursts (large obstacles): half-cell pixels + tighter ring step.
        const fine = !!burst.fineRing;
        const pixelSize = fine
            ? Math.max(1, cell ? cell * 0.5 : 1.5)
            : (cell || (baseSize < 20 ? 2 : 3));
        const snap = fine && cell ? Math.max(1, cell * 0.5) : (cell || 1);
        const explosionRadius = Math.floor(explosionSize / pixelSize);
        const angleStep = fine ? 0.12 : 0.2;

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
            for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
                let pixelX = centerX + Math.cos(angle) * ringRadius * pixelSize;
                let pixelY = centerY + Math.sin(angle) * ringRadius * pixelSize;
                if (cell || fine) {
                    pixelX = Math.round(pixelX / snap) * snap;
                    pixelY = Math.round(pixelY / snap) * snap;
                } else {
                    pixelX = Math.floor(pixelX);
                    pixelY = Math.floor(pixelY);
                }
                if (cv && cv.fill) cv.fill(ctx, pixelX, pixelY, pixelSize, pixelSize, colors[ring % colors.length], null);
                else ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
        }

        ctx.globalAlpha = 1;
        const sparkleCount = burst.sparkles || 0;
        for (let i = 0; i < sparkleCount; i++) {
            let sparkleX = centerX + (Math.random() - 0.5) * explosionSize;
            let sparkleY = centerY + (Math.random() - 0.5) * explosionSize;
            if (cell || fine) {
                sparkleX = Math.round(sparkleX / snap) * snap;
                sparkleY = Math.round(sparkleY / snap) * snap;
            } else {
                sparkleX = Math.floor(sparkleX);
                sparkleY = Math.floor(sparkleY);
            }
            const sc = i % 2 ? colors[0] : colors[1];
            if (cv && cv.fill) cv.fill(ctx, sparkleX, sparkleY, pixelSize, pixelSize, sc, 1);
            else {
                ctx.fillStyle = sc;
                ctx.fillRect(sparkleX, sparkleY, pixelSize, pixelSize);
            }
        }

        if (progress < 0.35) {
            const core = fine ? pixelSize : pixelSize;
            if (cv && cv.fill) {
                cv.fill(ctx, centerX - core, centerY - core, core * 2, core * 2, colors[0], 1);
            } else {
                ctx.fillStyle = colors[0];
                ctx.fillRect(centerX - core, centerY - core, core * 2, core * 2);
            }
        }
        ctx.restore();
    }

    clear() {
        this.active.length = 0;
        this.voxels.length = 0;
    }
}

const explosionSystem = new ExplosionSystem();
