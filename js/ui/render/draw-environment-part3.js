"use strict";

// RenderManager members, continued from draw-environment.js (kept under ~500 lines per file).
extendClass(RenderManager, {
    /**
     * Sparse faction doctrine marks on top of the planet floor: growth pores,
     * rivets, claw scores or scrap welds — never a full replacement pattern.
     */
    terrainFactionTint(env, pal, cx, wr, col, n) {
        const style = (env && env.style) || 'asteroid';
        const g = pal.ground;
        switch (style) {
            case 'organic': { // Voidborn: glowing pores and soft tissue blotches
                const h = this.envHash(cx * 3 + 11, wr * 3 + 7);
                if (h < 0.04) return pal.accent;
                if (h < 0.09 && n > 0.55) return g[0];
                return col;
            }
            case 'tech': { // Machine: sparse rivets / scuffs — no cable grid
                const h = this.envHash(cx, wr + 19);
                if (h < 0.022) return pal.accent;
                if (h < 0.045 && n > 0.6) return g[1];
                return col;
            }
            case 'spike': { // Kronax: short claw nicks, not diagonal rails
                const h = this.envHash(cx, wr + 41);
                if (h < 0.028) return pal.craterPit;
                if (h < 0.05) return g[0];
                return col;
            }
            case 'scrap': { // Pirate: irregular weld patches
                const h = this.envHash(cx, wr + 7);
                if (h < 0.04) return pal.accent;
                if (h > 0.94) return g[3];
                return col;
            }
            default: { // Terran / rock: sparse survey stakes
                if (this.envHash(cx, wr + 53) < 0.012) return pal.accent;
                return col;
            }
        }
    },
    drawAnimatedFog(ctx, o) {
        const W = this._fieldW || 240;
        const shared = (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell)
            ? renderManager.getCombatVoxelCell()
            : null;
        const cell = (shared != null && shared > 0) ? shared : this.planetPixelSize(W);
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        if (o._fogSeed == null) o._fogSeed = Math.random() * 1000;
        const seed = o._fogSeed;
        // Structure scale per cloud: 0 = broad soft banks, 1 = fine wisps.
        if (o._fogFine == null) o._fogFine = o.fogFineness != null ? o.fogFineness : Math.random();
        const fine = o._fogFine;
        const fq = 1 + fine * 1.6; // noise frequency multiplier
        const base = this.resolveCss ? this.resolveCss(o.color, '#8fa3b8') : (o.color || '#8fa3b8');
        const light = this.shadeColor(base, 0.45);
        const dark = this.shadeColor(base, -0.25);
        // Breathing: the cloud swells and shrinks a little.
        const pad = Math.max(o.width, o.height) * 0.15;
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        const hw = o.width / 2 + pad;
        const hh = o.height / 2 + pad;
        // Cells sit on the fixed world grid (like the terrain), so the cloud
        // glides across it instead of the grid jumping with the cloud; each
        // cell covers whole screen pixels, so there are no seams.
        const gx0 = Math.floor((cx - hw) / cell);
        const gx1 = Math.ceil((cx + hw) / cell);
        const gy0 = Math.floor((cy - hh) / cell);
        const gy1 = Math.ceil((cy + hh) / cell);
        const breathe = 1 + Math.sin(t * 0.9 + seed) * 0.06;
        const alphaMul = o.opacity != null ? o.opacity : 1;
        const fills = [[], [], []];
        for (let gy = gy0; gy < gy1; gy++) {
            for (let gx = gx0; gx < gx1; gx++) {
                // Position relative to the cloud (moves with it, smoothly).
                const lx = (gx + 0.5) * cell - cx;
                const ly = (gy + 0.5) * cell - cy;
                const nx = lx / hw;
                const ny = ly / hh;
                const a = Math.atan2(ny, nx);
                const edge = (0.8 + 0.1 * Math.sin(a * 3 + t * 0.6 + seed)
                    + 0.05 * Math.sin(a * 5 - t * 0.9 + seed * 2)) * breathe;
                const rad = Math.hypot(nx, ny) / edge;
                if (rad >= 1.1) continue;
                // Noise in cloud space (cell units): three slow layers drifting apart.
                const sx = lx / cell, sy = ly / cell;
                const n1 = this.envNoise(sx * 0.9 * fq + t * 1.2 + seed, sy * 0.9 * fq + t * 0.4);
                const n2 = this.envNoise(sx * 1.4 * fq - t * 0.9 + seed * 3, sy * 1.4 * fq - t * 0.7 + 40);
                const n3 = this.envNoise(sx * 0.5 + t * 0.3 + 90, sy * 0.5 - t * 0.5 + seed);
                // Fine detail: stretched, fast streaks that split thick areas
                // into threads (weighted by the cloud's fineness).
                const n4 = this.envNoise(sx * 3.2 * fq + t * 2 + seed * 7, sy * 1.6 * fq - t * 0.8 + 13);
                // Patchy: a slow mask carves drifting gaps, so only a few
                // pockets get thick and the rest is thin haze or open.
                const holes = this.envNoise(sx * 0.35 - t * 0.25 + seed * 5, sy * 0.35 + t * 0.2 + 7);
                const body = n1 * 0.45 + n2 * 0.3 + n3 * 0.25;
                const detail = 1 - fine * 0.7 + fine * 0.7 * (n4 * 1.6 - 0.3);
                const d = body * detail * (1.1 - rad) * 1.6
                    * Math.max(0, (holes - 0.25) * 1.8);
                if (d < FOG_MIN_DENSITY) continue;
                fills[d > 0.8 ? 2 : d > 0.5 ? 1 : 0].push(gx, gy);
            }
        }
        // Batched per density step: one fillStyle/alpha change each.
        const colors = [dark, base, light];
        const alphas = [0.14, 0.26, 0.42];
        ctx.save();
        for (let k = 0; k < 3; k++) {
            const f = fills[k];
            if (!f.length) continue;
            ctx.globalAlpha = alphaMul * alphas[k];
            ctx.fillStyle = colors[k];
            ctx.beginPath();
            for (let i = 0; i < f.length; i += 2) {
                const px = Math.round(f[i] * cell);
                const py = Math.round(f[i + 1] * cell);
                ctx.rect(px, py, Math.round((f[i] + 1) * cell) - px, Math.round((f[i + 1] + 1) * cell) - py);
            }
            ctx.fill();
        }
        ctx.restore();
    },
});
