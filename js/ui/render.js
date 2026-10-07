"use strict";

// RenderManager is defined in render/core.js and extended by the other files in render/,
// which index.html loads before this file.
// Global render manager instance
const renderManager = new RenderManager();

/** Shared VOXEL lattice helpers for any combat draw path (bullets, FX, loot…). */
window.combatVoxels = {
    cell() {
        return (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell)
            ? renderManager.getCombatVoxelCell()
            : null;
    },
    active() {
        const c = this.cell();
        return c != null && c > 0;
    },
    snap(v) {
        const c = this.cell();
        if (c == null || !(c > 0)) {
            return (typeof renderManager !== 'undefined' && renderManager.snapCombat)
                ? renderManager.snapCombat(v)
                : Math.round(v);
        }
        return Math.round(Number(v) / c) * c;
    },
    size(s) {
        const c = this.cell();
        if (c == null || !(c > 0)) {
            return (typeof renderManager !== 'undefined' && renderManager.quantizeCombatSize)
                ? renderManager.quantizeCombatSize(s)
                : Math.max(1, Math.round(s));
        }
        return Math.max(c, Math.round(Number(s) / c) * c);
    },
    /** Game-Boy style: accumulate float delta into whole-cell steps. */
    stepMove(entity, dx, dy) {
        if (!entity) return;
        const c = this.cell();
        if (c == null || !(c > 0)) {
            entity.x = (entity.x || 0) + (dx || 0);
            entity.y = (entity.y || 0) + (dy || 0);
            return;
        }
        entity._vxAcc = (entity._vxAcc || 0) + (Number(dx) || 0);
        entity._vyAcc = (entity._vyAcc || 0) + (Number(dy) || 0);
        const sx = (entity._vxAcc / c) | 0;
        if (sx) {
            entity.x = (entity.x || 0) + sx * c;
            entity._vxAcc -= sx * c;
        }
        const sy = (entity._vyAcc / c) | 0;
        if (sy) {
            entity.y = (entity.y || 0) + sy * c;
            entity._vyAcc -= sy * c;
        }
        entity.x = Math.round((entity.x || 0) / c) * c;
        entity.y = Math.round((entity.y || 0) / c) * c;
    },
    snapEntity(entity, c) {
        if (!entity) return;
        const unit = c != null ? c : this.cell();
        if (unit == null || !(unit > 0)) return;
        const x = entity.x || 0;
        const y = entity.y || 0;
        const sx = Math.round(x / unit) * unit;
        const sy = Math.round(y / unit) * unit;
        if (sx !== x) entity.x = sx;
        if (sy !== y) entity.y = sy;
    },
    snapWorld() {
        const c = this.cell();
        if (c == null || !(c > 0)) return;
        const snap = (e) => this.snapEntity(e, c);
        if (typeof playerManager !== 'undefined' && playerManager.player) snap(playerManager.player);
        if (typeof enemyManager !== 'undefined') {
            if (enemyManager.enemy) snap(enemyManager.enemy);
            const sides = enemyManager.sideEnemies;
            if (sides) for (let i = 0; i < sides.length; i++) snap(sides[i]);
        }
        if (typeof bulletManager !== 'undefined') {
            const pb = bulletManager.bullets;
            const eb = bulletManager.enemyBullets;
            if (pb) for (let i = 0; i < pb.length; i++) snap(pb[i]);
            if (eb) for (let i = 0; i < eb.length; i++) snap(eb[i]);
        }
        if (typeof obstacleManager !== 'undefined') {
            const obs = obstacleManager.obstacles;
            if (obs) for (let i = 0; i < obs.length; i++) snap(obs[i]);
            // Do NOT snap terrainOffset — sub-cell scroll drives the BG;
            // rounding it to the lattice freezes the canyon when cell > speed.
        }
        if (typeof pickupManager !== 'undefined' && pickupManager.pickups) {
            const drops = pickupManager.pickups;
            for (let i = 0; i < drops.length; i++) snap(drops[i]);
        }
        if (typeof particleSystem !== 'undefined' && particleSystem.particles) {
            const ps = particleSystem.particles;
            for (let i = 0; i < ps.length; i++) snap(ps[i]);
        }
        if (typeof explosionSystem !== 'undefined' && explosionSystem.voxels) {
            const vx = explosionSystem.voxels;
            for (let i = 0; i < vx.length; i++) snap(vx[i]);
        }
    },
    fill(ctx, x, y, w, h, color, alpha) {
        if (typeof renderManager !== 'undefined' && renderManager.fillCombatRect) {
            renderManager.fillCombatRect(ctx, x, y, w, h, color, alpha);
            return;
        }
        if (alpha != null) ctx.globalAlpha = alpha;
        if (color != null) ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
};
