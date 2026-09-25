"use strict";

// HangarTestArena methods, split from hangar-test-arena.js.
extendClass(HangarTestArena, {
    /** 0..1 — soft proximity fade for shield outline. */
    getShieldThreatProximity(entity, mode) {
        if (!entity || !this.sim) return 0;
        const radius = 72;
        let best = 0;
        const consider = (obj) => {
            if (!obj) return;
            const ox = (obj.x != null ? obj.x : 0) + ((obj.width != null ? obj.width : obj.w) || 0) / 2;
            const oy = (obj.y != null ? obj.y : 0) + ((obj.height != null ? obj.height : obj.h) || 0) / 2;
            const ex = entity.x + entity.width / 2;
            const ey = entity.y + entity.height / 2;
            const d = Math.sqrt((ox - ex) * (ox - ex) + (oy - ey) * (oy - ey));
            if (d >= radius) return;
            const t = 1 - (d / radius);
            const fade = t * t * (3 - 2 * t);
            if (fade > best) best = fade;
        };
        if (mode === 'enemy') {
            this.sim.bullets.forEach(consider);
            this.sim.enemyBullets.forEach((b) => { if (b.reflected) consider(b); });
        } else {
            this.sim.enemyBullets.forEach(consider);
            this.sim.bullets.forEach((b) => { if (b.reflected) consider(b); });
        }
        return best;
    },

    draw() {
        const ctx = this.ctx;
        const sim = this.sim;
        if (!ctx || !sim) return;
        const accent = (getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '#b44dff').trim() || '#b44dff';
        const bg = (getComputedStyle(document.documentElement).getPropertyValue('--current-background')
            || getComputedStyle(document.documentElement).getPropertyValue('--color-background')
            || '#0a0a0a').trim() || '#0a0a0a';
        const W = this.W;
        const H = this.H;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Match main playfield star scroll
        ctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue('--current-text') || '#e0e0e0').trim() || '#e0e0e0';
        for (let i = 0; i < 50; i++) {
            ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
            const sx = (i * 7) % W;
            const sy = ((i * 11) + sim.phase * 40) % H;
            ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1;

        sim.bullets.forEach((b) => {
            ctx.fillStyle = accent;
            ctx.fillRect(b.x, b.y, b.w, b.h);
        });
        sim.enemyBullets.forEach((b) => {
            ctx.fillStyle = '#ff5577';
            ctx.fillRect(b.x, b.y, b.w, b.h);
        });

        sim.enemies.forEach((e) => {
            this.drawShip(ctx, e.model, e, true);
            this.drawBar(ctx, e.x, e.y - 6, e.width, e.health / e.maxHealth, '#ff6677');
            if (e.shieldMax > 0) {
                this.drawBar(ctx, e.x, e.y - 3, e.width, e.shield / e.shieldMax, accent);
                const threat = this.getShieldThreatProximity(e, 'enemy');
                if (threat > 0.01) {
                    const strength = e.shield / e.shieldMax;
                    this.drawShieldHull(ctx, e.model, e, true, threat * (0.45 + 0.55 * strength));
                }
            }
        });

        const p = sim.player;
        if (this._respawnMs <= 0) {
            if (p.invuln > 0 && Math.floor(p.invuln / 60) % 2 === 0) {
                ctx.globalAlpha = 0.45;
            }
            this.drawShip(ctx, p.model, p, false);
            ctx.globalAlpha = 1;
            this.drawBar(ctx, p.x, p.y + p.height + 2, p.width, p.health / p.maxHealth, '#88ff88');
            if (p.shieldMax > 0) {
                this.drawBar(ctx, p.x, p.y + p.height + 5, p.width, p.shield / p.shieldMax, accent);
                const threat = this.getShieldThreatProximity(p, 'player');
                const cs = p.chargeStats || {};
                const maxMs = cs.maxChargeMs || 900;
                const level = p.charging ? Math.min(1, p.charge / maxMs) : 0;
                const syncVis = !!(p.charging && cs.shieldSync && p.shield > 0);
                if (threat > 0.01 || syncVis) {
                    const strength = p.shield / p.shieldMax;
                    const pulseSpeed = 2 + level * 6;
                    const pulse = syncVis
                        ? (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(Date.now() / 1000 * pulseSpeed * Math.PI * 2)))
                        : 1;
                    const thick = syncVis ? (2 + Math.round(level * 3)) : 2;
                    const base = syncVis
                        ? Math.max(threat, 0.35 + 0.55 * level)
                        : threat;
                    this.drawShieldHull(
                        ctx, p.model, p, false,
                        base * (0.45 + 0.55 * strength),
                        syncVis ? { thick: thick, pulse: pulse } : null
                    );
                }
            }
            if (p.charging && p.charge > 0) {
                const maxMs = (p.chargeStats && p.chargeStats.maxChargeMs) || 900;
                const r = Math.min(1, p.charge / maxMs);
                ctx.fillStyle = accent;
                ctx.globalAlpha = 0.35 + r * 0.5;
                ctx.fillRect(p.x + p.width / 2 - 1, p.y - 12 - r * 10, 2, 8 + r * 10);
                ctx.globalAlpha = 1;
            }
        }

        sim.hits.forEach((h) => {
            ctx.globalAlpha = Math.max(0.2, h.life / 220);
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('-' + h.dmg, h.x, h.y);
        });
        ctx.globalAlpha = 1;
    },
});
