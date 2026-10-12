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

    /** True when `key` ('space' | 'a' | 's' | 'd') is the ship's fire-all key. */
    arenaKeyIsAll(key) {
        const m = this.getArenaFireModel ? this.getArenaFireModel() : null;
        return ((m && m.loadout && m.loadout.allFireKey) || 'space') === key;
    },

    /** Weapon ids fired by a key: all equipped for the ALL key, else the slots assigned to it. */
    arenaKeyWeapons(key) {
        const m = this.getArenaFireModel ? this.getArenaFireModel() : null;
        const L = m && m.loadout;
        if (!L) return [];
        const slots = (L.weaponSlots && L.weaponSlots.length ? L.weaponSlots : L.weapons) || [];
        const keys = L.weaponKeys || {};
        if (this.arenaKeyIsAll(key)) return slots.filter(Boolean);
        return slots.filter((id, i) => id && (keys[String(i)] || 'space') === key);
    },

    /** Bottom strip: HULL / SHIELD / ENERGY bars, then A S D and SPACE key caps. */
    drawHud(ctx, p, accent) {
        const W = this.W;
        const top = this.H - this.HUD_H;
        const pad = 6;
        ctx.save();
        ctx.fillStyle = 'rgba(5,5,8,0.85)';
        ctx.fillRect(0, top, W, this.HUD_H);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(0, top, W, 1);
        ctx.globalAlpha = 1;
        const bars = [
            ['HULL', p.maxHealth > 0 ? p.health / p.maxHealth : 0, '#88ff88', p.maxHealth > 0],
            ['SHLD', p.shieldMax > 0 ? p.shield / p.shieldMax : 0, accent, p.shieldMax > 0],
            ['ENRG', p.maxEnergy > 0 ? p.energy / p.maxEnergy : 0, '#ffd23d', p.maxEnergy > 0]
        ];
        ctx.font = 'bold 7px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        const labelW = 24;
        bars.forEach(([label, ratio, color, has], i) => {
            const y = top + 5 + i * 8;
            ctx.globalAlpha = has ? 1 : 0.35;
            ctx.fillStyle = color;
            ctx.fillText(label, pad, y + 2);
            const bx = pad + labelW;
            const bw = W - bx - pad;
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(bx, y, bw, 4);
            ctx.fillStyle = color;
            ctx.fillRect(bx, y, Math.round(bw * Math.max(0, Math.min(1, ratio))), 4);
        });
        ctx.globalAlpha = 1;
        // Keys: A S D on one row, SPACE on its own row; lit while held.
        const held = (k) => (k === 'space' ? (this.keyDown(' ') || this.keyDown('Space')) : this.keyDown(k));
        const capH = 11;
        const gap = 4;
        const keysTop = top + 30;
        const unit = (W - pad * 2 - gap * 2) / 3;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        [['a', 'A'], ['s', 'S'], ['d', 'D'], ['space', 'SPACE']].forEach(([id, label], i) => {
            const isSpace = id === 'space';
            const x = isSpace ? pad : Math.round(pad + i * (unit + gap));
            const y = isSpace ? keysTop + capH + gap : keysTop;
            const cw = Math.round(isSpace ? W - pad * 2 : unit);
            const on = held(id);
            if (on) {
                ctx.fillStyle = accent;
                ctx.fillRect(x, y + 1, cw, capH);
                ctx.fillStyle = '#050508';
            } else {
                ctx.strokeStyle = accent;
                ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, capH - 1);
                ctx.fillStyle = accent;
                ctx.fillRect(x, y + capH - 1, cw, 2);
            }
            ctx.fillText(label, x + cw / 2, y + capH / 2 + (on ? 1.5 : 0));
            // Icons of the weapons this key fires (ALL = every equipped gun).
            const ids = this.arenaKeyWeapons(id);
            const ic = capH - 3;
            ids.slice(0, 4).forEach((wid, j) => {
                if (typeof iconRenderer === 'undefined' || !iconRenderer.drawWeapon) return;
                iconRenderer.drawWeapon(ctx, wid, x + 2 + j * (ic + 1), y + 1.5 + (on ? 1 : 0), ic);
            });
            if (this.arenaKeyIsAll(id)) {
                ctx.textAlign = 'right';
                ctx.fillText('ALL', x + cw - 3, y + capH / 2 + (on ? 1.5 : 0));
                ctx.textAlign = 'center';
            }
        });
        ctx.restore();
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

        // Player shots in their weapon type's colour (same renderer as in game).
        sim.bullets.forEach((b) => {
            if (b.weaponId && typeof renderManager !== 'undefined' && renderManager.drawBullet) {
                renderManager.drawBullet(ctx, { x: b.x, y: b.y, width: b.w, height: b.h, type: b.type, weaponId: b.weaponId }, null);
                return;
            }
            ctx.fillStyle = accent;
            ctx.fillRect(b.x, b.y, b.w, b.h);
        });
        // Enemy shots in their weapon's colour and shape (same renderer as in game).
        sim.enemyBullets.forEach((b) => {
            if (b.weaponId && typeof renderManager !== 'undefined' && renderManager.drawBullet) {
                renderManager.drawBullet(ctx, { x: b.x, y: b.y, width: b.w, height: b.h, weaponId: b.weaponId, isEnemyShot: true }, null);
                return;
            }
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
            // Same layout model the shots come from, so muzzles line up.
            this.drawShip(ctx, this.getArenaFireModel() || p.model, p, false);
            // Muzzle flashes from the arena's own bullet manager (same as in game).
            if (this._arenaBm && this._arenaBm.drawMuzzleFlashes && this._arenaBm.currentShipModel) {
                this._arenaBm.drawMuzzleFlashes(ctx, p);
            }
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

        this.drawHud(ctx, p, accent);

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
