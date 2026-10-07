"use strict";

// ObstacleManager methods, split from obstacles.js.
const FRAGMENT_MIN_PARENT = 16; // px: smaller rocks only burst into debris
const FRAGMENT_MIN_SIZE = 10;   // px: smallest collidable chunk
const DEBRIS_MAX = 260;

extendClass(ObstacleManager, {
    /**
     * Visual-only burst: pixel chips in the rock's own colours fly out,
     * spin down and fade, plus a short flash. No collision.
     */
    spawnDebris(o) {
        if (!this.debris) this.debris = [];
        const colors = this.debrisColors(o);
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        const size = Math.max(o.width, o.height);
        // Big rocks: many fine chips. Small ones keep a few chunkier flecks.
        const fine = size >= 14;
        const n = Math.min(fine ? 64 : 28, Math.round((fine ? 12 : 6) + size * (fine ? 1.55 : 0.7)));
        const cell = this.terrainCell ? this.terrainCell() : 2.5;
        const grit = fine ? Math.max(1, cell * 0.5) : cell;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 0.4 + Math.random() * (1.2 + size * 0.03);
            const roll = Math.random();
            let s;
            if (fine) {
                s = roll < 0.68 ? grit : roll < 0.92 ? cell : cell * 1.25;
            } else {
                s = cell * (roll < 0.25 ? 2 : 1);
            }
            this.debris.push({
                x: cx + (Math.random() - 0.5) * o.width * 0.6,
                y: cy + (Math.random() - 0.5) * o.height * 0.6,
                vx: Math.cos(a) * sp + (o.horizontalSpeed || 0) * 0.5,
                vy: Math.sin(a) * sp + (o.verticalSpeed || 0) * 0.5,
                s: s,
                c: colors[Math.floor(Math.random() * colors.length)],
                life: 0,
                ttl: 350 + Math.random() * 450
            });
        }
        // Hot core flash: a few bright chips that die fast.
        const hotN = fine ? 10 : 6;
        for (let i = 0; i < hotN; i++) {
            const a = Math.random() * Math.PI * 2;
            this.debris.push({ x: cx, y: cy, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2,
                s: grit, c: i % 2 ? '#ffe9a8' : '#ffffff', life: 0, ttl: 160 + Math.random() * 120 });
        }
        this.flashes = this.flashes || [];
        this.flashes.push({ x: cx, y: cy, r: size * (fine ? 0.7 : 0.9), life: 0, ttl: 140 });
        if (this.debris.length > DEBRIS_MAX) this.debris.splice(0, this.debris.length - DEBRIS_MAX);
    },

    /** Opaque, non-outline colours from the rock's baked art (fallback grey). */
    debrisColors(o) {
        const img = o && o._hiRes;
        const out = [];
        try {
            if (img && img.getContext) {
                const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
                for (let i = 0; i < d.length && out.length < 12; i += 4 * 3) {
                    if (d[i + 3] < 200) continue;
                    if (d[i] + d[i + 1] + d[i + 2] < 60) continue; // skip the dark outline
                    out.push('rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')');
                }
            }
        } catch (e) { /* ignore */ }
        return out.length ? out : ['#9aa0a8', '#6e737b', '#c8ccd2'];
    },

    updateDebris(deltaTime) {
        const dt = Math.max(0, Number(deltaTime) || 16.67);
        const f = Math.min(3, dt / 16.67);
        const list = this.debris || [];
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.life += dt;
            if (p.life >= p.ttl) { list.splice(i, 1); continue; }
            p.x += p.vx * f;
            p.y += p.vy * f;
            p.vx *= Math.pow(0.93, f);
            p.vy *= Math.pow(0.93, f);
        }
        const fl = this.flashes || [];
        for (let i = fl.length - 1; i >= 0; i--) {
            fl[i].life += dt;
            if (fl[i].life >= fl[i].ttl) fl.splice(i, 1);
        }
    },

    renderDebris(ctx) {
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        const fl = this.flashes || [];
        if (fl.length) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.globalCompositeOperation = 'lighter';
            fl.forEach((f) => {
                const t = f.life / f.ttl;
                const alpha = (1 - t) * 0.55;
                let r = f.r * (0.6 + t * 0.8);
                if (cell) r = Math.max(cell, Math.round(r / cell) * cell);
                // Pixel "disc": two crossed boxes, no smooth gradient.
                if (cv && cv.fill) {
                    cv.fill(ctx, f.x - r, f.y - r * 0.5, r * 2, r, '#ffd98a', alpha);
                    cv.fill(ctx, f.x - r * 0.5, f.y - r, r, r * 2, '#ffd98a', alpha);
                } else {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#ffd98a';
                    ctx.fillRect(Math.round(f.x - r), Math.round(f.y - r * 0.5), Math.round(r * 2), Math.round(r));
                    ctx.fillRect(Math.round(f.x - r * 0.5), Math.round(f.y - r), Math.round(r), Math.round(r * 2));
                }
            });
            ctx.restore();
        }
        const list = this.debris || [];
        if (!list.length) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        list.forEach((p) => {
            const t = p.life / p.ttl;
            const alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
            let s = Math.max(1, p.s);
            let px = p.x;
            let py = p.y;
            if (cell) {
                // Keep sub-cell grit for big-rock bursts; only inflate chunkier chips.
                const step = s < cell ? Math.max(1, cell * 0.5) : cell;
                s = Math.max(step, Math.round(s / step) * step);
                px = Math.round(px / step) * step;
                py = Math.round(py / step) * step;
            }
            if (cv && cv.fill) cv.fill(ctx, px, py, s, s, p.c, alpha);
            else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.c;
                ctx.fillRect(Math.round(px), Math.round(py), s, s);
            }
        });
        ctx.restore();
    },


    removeObstacle(index) {
        const obstacle = this.obstacles[index];
        if (obstacle && obstacle.isCrate) {
            this.spawnDebris(obstacle);
            if (typeof pickupManager !== 'undefined' && pickupManager.spawnPowerUp) pickupManager.spawnPowerUp(obstacle);
            this.obstacles.splice(index, 1);
            return;
        }
        if (obstacle && !obstacle.isFog) {
            this.spawnDebris(obstacle);
            // Only big rocks split into real (collidable) chunks; small ones
            // just burst into debris instead of littering the field.
            if (obstacle.fragmentOnDestroy && obstacle.fragmentCount > 0
                && Math.min(obstacle.width, obstacle.height) >= FRAGMENT_MIN_PARENT) {
                this.spawnFragments(obstacle);
            }
        }
        if (obstacle && !obstacle.isFog && typeof explosionSystem !== 'undefined' && obstacle._skipDestroyFx !== true) {
            // Destroy FX is usually played by collisions; only play if explicitly requested
        }
        if (obstacle && typeof pickupManager !== 'undefined' && pickupManager.spawnFromObstacle) {
            pickupManager.spawnFromObstacle(obstacle);
        }
        this.obstacles.splice(index, 1);
    },

    spawnFragments(parent) {
        const count = Math.max(1, Math.min(4, parent.fragmentCount || 2));
        const ratio = Math.max(0.5, parent.fragmentSizeRatio != null ? parent.fragmentSizeRatio : 0.5);
        // Chunks stay big enough to read as rocks on the coarse art grid.
        const fw = Math.max(FRAGMENT_MIN_SIZE, Math.round(parent.width * ratio));
        const fh = Math.max(FRAGMENT_MIN_SIZE, Math.round(parent.height * ratio));
        const generation = (parent.fragmentGeneration || 0) + 1;
        const maxDepth = parent.fragmentDepth != null ? parent.fragmentDepth : 0;
        const canCascade = generation <= maxDepth;
        const childChance = parent.childFragmentChance != null ? parent.childFragmentChance : 0;
        const hardCap = 24;
        let spawned = 0;

        for (let i = 0; i < count; i++) {
            if (spawned >= hardCap) break;
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
            const speed = 0.6 + Math.random() * 0.8;
            const willFragment = canCascade && Math.random() < childChance;
            const isCrystal = parent.kind === 'crystal' || parent.opticalMode === 'prism'
                || parent.opticalMode === 'mirror' || parent.opticalMode === 'kaleidoscope';
            this.obstacles.push({
                x: parent.x + parent.width / 2 - fw / 2,
                y: parent.y + parent.height / 2 - fh / 2,
                width: fw,
                height: fh,
                horizontalSpeed: Math.cos(angle) * speed + (parent.horizontalSpeed || 0) * 0.4,
                verticalSpeed: Math.sin(angle) * speed + (parent.verticalSpeed || 0) * 0.4,
                rotation: 0,
                rotationSpeed: 0,
                type: isCrystal ? 'crystal_shard' : 'small_asteroid',
                kind: isCrystal ? 'crystal' : 'asteroid',
                cluster: parent.cluster || 'alpha',
                color: parent.color,
                health: Math.max(1, parent.fragmentHealth || 1),
                maxHealth: Math.max(1, parent.fragmentHealth || 1),
                isDestructible: true,
                reflectsShots: false,
                isFog: false,
                fragmentOnDestroy: willFragment,
                fragmentCount: willFragment ? Math.max(2, Math.round((parent.fragmentCount || 3) * 0.7)) : 0,
                fragmentDepth: parent.fragmentDepth || 0,
                fragmentSizeRatio: Math.max(0.25, ratio * 0.85),
                fragmentDamage: Math.max(1, Math.round((parent.fragmentDamage || 8) * 0.7)),
                fragmentHealth: 1,
                childFragmentChance: Math.max(0, (parent.childFragmentChance || 0) * 0.7),
                collisionDamage: Math.max(1, parent.fragmentDamage != null ? parent.fragmentDamage : 8),
                opticalMode: isCrystal
                    ? (parent.opticalMode === 'kaleidoscope' ? 'prism' : (parent.opticalMode || 'none'))
                    : 'none',
                prismSplitCount: Math.max(2, (parent.prismSplitCount || 3) - 1),
                prismAngleDeg: parent.prismAngleDeg || 25,
                explosionId: parent.explosionId || (isCrystal ? 'crystal_shatter' : 'asteroid_burst'),
                fragmentGeneration: generation,
                sprite: isCrystal ? 'crystal' : 'obstacleSmall',
                opacity: 1,
                lightIntensity: isCrystal ? 0.3 : 0,
                lightColor: isCrystal ? 'var(--color-highlight)' : null,
                wallDepth: parent.wallDepth || (Math.random() < 0.55 ? 'under' : 'over')
            });
            spawned++;
        }
    },

    getFogObstacles() {
        return this.obstacles.filter((o) => o && o.isFog);
    },

    reset() {
        this.obstacles.length = 0;
        this.debris = [];
        this.flashes = [];
        this.runTime = 0;
        this.scrollDistance = 0;
        this.terrainOffset = 0;
        this.crateTimer = null;
    },
});
