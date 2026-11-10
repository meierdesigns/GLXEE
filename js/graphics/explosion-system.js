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
const EXPLOSION_VOXEL_POOL_MAX = 220;
const EXPLOSION_BURST_POOL_MAX = 40;

class ExplosionSystem {
    constructor() {
        this.active = [];
        this.voxels = [];
        this._voxelPool = [];
        this._burstPool = [];
        this._sampleCanvas = null;
        this._sampleBuf = [];
        this._sampleFree = [];
    }

    _acquireVoxel() {
        return this._voxelPool.pop() || {
            x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0,
            s: 1, c: '#fff', life: 0, ttl: 1, delay: 0, g: 0
        };
    }

    _releaseVoxel(p) {
        if (!p) return;
        if (this._voxelPool.length < EXPLOSION_VOXEL_POOL_MAX) this._voxelPool.push(p);
    }

    _acquireBurst() {
        const b = this._burstPool.pop();
        if (b) {
            if (!b.colors) b.colors = [];
            else b.colors.length = 0;
            return b;
        }
        return {
            x: 0, y: 0, width: 14, height: 14, timer: 0, duration: 600,
            rings: 2, ringScale: 1, sparkles: 6, colors: [],
            presetId: 'default', fineRing: false
        };
    }

    _releaseBurst(b) {
        if (!b) return;
        if (b.colors) b.colors.length = 0;
        if (this._burstPool.length < EXPLOSION_BURST_POOL_MAX) this._burstPool.push(b);
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
            // Soft cap so stacked kills in a long fight can't grow the ring list forever.
            if (this.active.length >= 28) {
                const drop = this.active.length - 24;
                for (let i = 0; i < drop; i++) this._releaseBurst(this.active[i]);
                this.active.splice(0, drop);
            }
            const burst = this._acquireBurst();
            burst.x = x;
            burst.y = y;
            burst.width = bw;
            burst.height = bh;
            burst.timer = 0;
            burst.duration = preset.ringDurationMs;
            burst.rings = fineRing ? Math.max(preset.rings, preset.rings + 1) : preset.rings;
            burst.ringScale = preset.ringScale * scale;
            burst.sparkles = fineRing
                ? Math.round(preset.sparkles * (1.2 + Math.min(1.2, Math.max(bw, bh) / 28)))
                : preset.sparkles;
            if (preset.colors) {
                for (let ci = 0; ci < preset.colors.length; ci++) burst.colors.push(preset.colors[ci]);
            }
            burst.presetId = preset.id;
            burst.fineRing = fineRing;
            this.active.push(burst);
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

        // Small obstacles get steered / flung by the blast wave.
        if (typeof obstacleManager !== 'undefined' && obstacleManager.blastSteerObstacles) {
            const bw = opts.width != null ? Number(opts.width) : 14;
            const bh = opts.height != null ? Number(opts.height) : 14;
            const size = Math.max(bw, bh, 10);
            const radius = Math.max(26, size * 1.85 * Math.max(0.55, scale));
            const force = Math.max(0.7, 1.15 * Math.max(0.55, scale) * (size >= 20 ? 1.25 : 1));
            obstacleManager.blastSteerObstacles(x, y, radius, force, opts.sourceObstacle || null);
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
            const vox = this._acquireVoxel();
            vox.x = wx;
            vox.y = wy;
            vox.vx = nx * burst + (-ny) * tang * 0.35;
            vox.vy = ny * burst + nx * tang * 0.35 - (voxel ? 0.15 : 0);
            vox.rot = Math.random() * Math.PI * 2;
            vox.spin = (Math.random() - 0.5) * (voxel ? 0.35 : 0.18);
            vox.s = cell;
            vox.c = p.c;
            vox.life = 0;
            vox.ttl = (voxel ? 700 : 480) + Math.random() * (voxel ? 900 : 520);
            vox.delay = voxel ? Math.min(220, dist * 2.2 + Math.random() * 80) : Math.random() * 40;
            vox.g = voxel ? 0.012 + Math.random() * 0.02 : 0.006;
            this.voxels.push(vox);
        }

        // Hot core chips — bright voxels from the blast centre.
        const hotN = voxel ? 10 : 5;
        for (let i = 0; i < hotN; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = (voxel ? 2.4 : 1.6) * power * (0.7 + Math.random());
            const vox = this._acquireVoxel();
            vox.x = cx;
            vox.y = cy;
            vox.vx = Math.cos(a) * sp;
            vox.vy = Math.sin(a) * sp;
            vox.rot = 0;
            vox.spin = (Math.random() - 0.5) * 0.4;
            vox.s = cell;
            vox.c = i % 2 ? '#ffe9a8' : '#ffffff';
            vox.life = 0;
            vox.ttl = 180 + Math.random() * 160;
            vox.delay = 0;
            vox.g = 0.004;
            this.voxels.push(vox);
        }

        const cap = Math.floor(SHIP_VOXEL_DEBRIS_MAX * 1.5);
        if (this.voxels.length > cap) {
            const drop = this.voxels.length - cap;
            for (let i = 0; i < drop; i++) this._releaseVoxel(this.voxels[i]);
            this.voxels.splice(0, drop);
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

        const out = this._sampleBuf;
        const free = this._sampleFree;
        while (out.length) free.push(out.pop());
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const i = (y * w + x) * 4;
                const a = data[i + 3];
                if (a < 160) continue;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (r + g + b < 40) continue;
                const pt = free.pop() || { x: 0, y: 0, c: '' };
                pt.x = x;
                pt.y = y;
                pt.c = 'rgb(' + r + ',' + g + ',' + b + ')';
                out.push(pt);
            }
        }
        out.step = step;
        return out;
    }

    update(deltaTime) {
        const dt = deltaTime || 16;
        const rings = this.active;
        for (let i = rings.length - 1; i >= 0; i--) {
            rings[i].timer += dt;
            if (rings[i].timer >= rings[i].duration) {
                const last = rings.length - 1;
                if (i !== last) rings[i] = rings[last];
                this._releaseBurst(rings.pop());
            }
        }

        const f = Math.min(3, dt / 16.67);
        // One drag factor per frame (same as Math.pow per particle; identical motion).
        const dragV = f === 1 ? 0.95 : Math.pow(0.95, f);
        const dragS = f === 1 ? 0.98 : Math.pow(0.98, f);
        const list = this.voxels;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.life += dt;
            if (p.life < (p.delay || 0)) continue;
            if (p.life >= p.ttl) {
                const last = list.length - 1;
                if (i !== last) list[i] = list[last];
                this._releaseVoxel(list.pop());
                continue;
            }
            p.vy += (p.g || 0) * f;
            p.x += p.vx * f;
            p.y += p.vy * f;
            p.vx *= dragV;
            p.vy *= dragV;
            p.rot += (p.spin || 0) * f;
            p.spin *= dragS;
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
                const alpha = Math.pow(Math.max(0, 1 - t), 1.4);
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
            for (let i = 0; i < vars.length; i++) {
                const v = vfCssVar(vars[i]);
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
                const value = vfCssVar(match[1]);
                if (value) return value;
            }
        } catch (e) { /* ignore */ }
        return fallback;
    }

    /** Relative ring pixel offsets for a given radius/step — same points every burst. */
    ringOffsets(ringRadius, angleStep, pixelSize) {
        if (!this._ringOff) this._ringOff = Object.create(null);
        // Quantise floats so fine-ring sizes don't mint unbounded cache keys.
        const key = ringRadius + ':' + angleStep + ':' + Math.round(pixelSize * 100);
        let pts = this._ringOff[key];
        if (pts) return pts;
        const keys = Object.keys(this._ringOff);
        if (keys.length > 96) {
            this._ringOff = Object.create(null);
        }
        pts = [];
        for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
            pts.push(
                Math.cos(angle) * ringRadius * pixelSize,
                Math.sin(angle) * ringRadius * pixelSize
            );
        }
        this._ringOff[key] = pts;
        return pts;
    }

    drawBurst(ctx, burst) {
        const progress = Math.min(1, burst.timer / Math.max(1, burst.duration));
        // Capped so big ships don't fill half the playfield; the ring grows
        // to ~1.5× its base instead of 2.5×.
        const baseSize = Math.max(8, Math.min(EXPLOSION_MAX_BASE,
            (burst.width + burst.height) * 0.5 * burst.ringScale));
        const ease = 1 - Math.pow(1 - progress, 2.2);
        const fade = Math.pow(1 - progress, 1.6);
        const explosionSize = baseSize * (0.5 + ease);
        const centerX = burst.x;
        const centerY = burst.y;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        // Fine bursts (large obstacles): half-cell pixels + tighter ring step.
        const fine = !!burst.fineRing;
        // Floor brush size: Global Pixel Size 1/2 makes combat cells << 1 and would
        // explode ring/sparkle fill cost without changing the on-screen look much.
        const brushFloor = 1;
        const pixelSize = fine
            ? Math.max(brushFloor, cell ? cell * 0.5 : 1.5)
            : Math.max(brushFloor, cell || (baseSize < 20 ? 2 : 3));
        const snap = fine && cell ? Math.max(brushFloor, cell * 0.5) : Math.max(brushFloor, cell || 1);
        const explosionRadius = Math.min(48, Math.floor(explosionSize / pixelSize));
        const angleStep = fine ? 0.12 : 0.2;

        // Theme colours once per burst frame, not per ring pixel.
        const now = (typeof performance !== 'undefined') ? performance.now() : 0;
        if (!this._burstColorAt || (now - this._burstColorAt) > 32) {
            this._burstFallbacks = [
                this.themeColor(['--color-highlight', '--color-text'], '#ffffff'),
                this.themeColor(['--color-explosion', '--color-particle'], '#ff8844'),
                this.themeColor(['--color-secondary', '--color-accent'], '#ffaa66')
            ];
            this._burstColorAt = now;
        }
        const fallbacks = this._burstFallbacks;
        const colors = (burst.colors || []).map((c, i) => this.resolveColor(c, fallbacks[i % fallbacks.length]));
        while (colors.length < 3) colors.push(fallbacks[colors.length]);

        ctx.save();
        const ringCount = Math.max(1, burst.rings || 1);
        const doSnap = !!(cell || fine);
        for (let ring = 0; ring < ringCount; ring++) {
            const ringRadius = Math.floor(explosionRadius * (0.3 + ring * 0.3));
            const alpha = fade * (1 - ring * 0.25);
            if (alpha <= 0.02) continue;
            const a = Math.min(1, alpha);
            const col = colors[ring % colors.length];
            ctx.globalAlpha = a;
            ctx.fillStyle = col;
            const pts = this.ringOffsets(ringRadius, angleStep, pixelSize);
            for (let i = 0; i < pts.length; i += 2) {
                let pixelX = centerX + pts[i];
                let pixelY = centerY + pts[i + 1];
                if (doSnap) {
                    pixelX = Math.round(pixelX / snap) * snap;
                    pixelY = Math.round(pixelY / snap) * snap;
                } else {
                    pixelX = Math.floor(pixelX);
                    pixelY = Math.floor(pixelY);
                }
                if (cv && cv.fill) cv.fill(ctx, pixelX, pixelY, pixelSize, pixelSize, col, a);
                else ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
        }

        ctx.globalAlpha = 1;
        const sparkleCount = Math.round((burst.sparkles || 0) * fade);
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
            if (cv && cv.fill) cv.fill(ctx, sparkleX, sparkleY, pixelSize, pixelSize, sc, Math.max(0.1, fade));
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
        for (let i = 0; i < this.active.length; i++) this._releaseBurst(this.active[i]);
        this.active.length = 0;
        for (let i = 0; i < this.voxels.length; i++) this._releaseVoxel(this.voxels[i]);
        this.voxels.length = 0;
        if (this._sampleBuf) {
            while (this._sampleBuf.length) this._sampleFree.push(this._sampleBuf.pop());
        }
    }
}

const explosionSystem = new ExplosionSystem();
