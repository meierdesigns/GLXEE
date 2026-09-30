"use strict";

// HomeStationUI methods: live fleet preview in the faction FLEET section.
// Faction ships hold formation at the top and fire down; incoming shots from
// below hit their shields (shield hull + bars), same renderers as in-game.
// The canvas is low-res and scaled up pixelated by CSS.
extendClass(HomeStationUI, {
    startFactionFleetPreview(factionId, shipClass) {
        this.stopFactionFleetPreview();
        const canvas = this.overlay && this.overlay.querySelector('[data-fleet-preview]');
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!canvas || !fss) return;
        const classes = shipClass && shipClass !== 'all' ? [shipClass] : fss.classes.slice();
        const style = fss.getFactionStyle(factionId);
        const W = canvas.width;
        const ships = classes.map((cls, i) => {
            const size = fss.displaySizeForClass(cls);
            const scale = classes.length === 1 ? 2.2 : 1;
            const w = Math.round(size.width * scale);
            const h = Math.round(size.height * scale);
            const slot = W / classes.length;
            return {
                x: Math.round(slot * i + (slot - w) / 2), y: 36, baseY: 36, width: w, height: h,
                type: 'spaceship', faction: factionId, enemyClass: cls, tier: 1, level: 1,
                maxHealth: 100, health: 100, shieldMax: 60, shield: 60,
                shieldFlash: 0, hitFlash: 0, fireAcc: 400 + i * 260, phase: i * 1.3
            };
        });
        const sim = { ships, shots: [], incoming: [], sparks: [], inAcc: 0, style };
        let last = 0;
        const loop = (ts) => {
            if (!canvas.isConnected) { this._fleetPreviewAnim = null; return; }
            const dt = last ? Math.min(50, ts - last) : 16;
            last = ts;
            this.updateFactionFleetPreview(sim, dt, canvas);
            this.drawFactionFleetPreview(sim, canvas);
            this._fleetPreviewAnim = requestAnimationFrame(loop);
        };
        this._fleetPreviewAnim = requestAnimationFrame(loop);
    },

    stopFactionFleetPreview() {
        if (this._fleetPreviewAnim) cancelAnimationFrame(this._fleetPreviewAnim);
        this._fleetPreviewAnim = null;
    },

    updateFactionFleetPreview(sim, dt, canvas) {
        const H = canvas.height;
        sim.ships.forEach((s) => {
            s.phase += dt * 0.002;
            s.y = s.baseY + Math.sin(s.phase) * 3;
            s.hitFlash = Math.max(0, s.hitFlash - dt);
            s.shieldFlash = Math.max(0, s.shieldFlash - dt);
            if (s.health <= 0) { s.health = s.maxHealth; s.shield = s.shieldMax; }
            s.shield = Math.min(s.shieldMax, s.shield + dt * 0.006);
            s.fireAcc -= dt;
            if (s.fireAcc <= 0) {
                s.fireAcc = 900 + Math.random() * 500;
                const bw = s.enemyClass === 'capital' || s.enemyClass === 'heavy' ? 3 : 2;
                sim.shots.push({ x: s.x + s.width / 2 - bw / 2, y: s.y + s.height, w: bw, h: 6, vy: 0.18 });
            }
        });
        // Incoming player fire from below, aimed at a random ship.
        sim.inAcc -= dt;
        if (sim.inAcc <= 0 && sim.ships.length) {
            sim.inAcc = 500 + Math.random() * 500;
            const t = sim.ships[Math.floor(Math.random() * sim.ships.length)];
            sim.incoming.push({ x: t.x + t.width / 2 - 1 + (Math.random() - 0.5) * t.width * 0.4, y: H, w: 2, h: 6, vy: -0.3 });
        }
        sim.shots = sim.shots.filter((b) => { b.y += b.vy * dt; return b.y < H; });
        sim.incoming = sim.incoming.filter((b) => {
            b.y += b.vy * dt;
            const hit = sim.ships.find((s) => b.x + b.w > s.x && b.x < s.x + s.width && b.y < s.y + s.height && b.y + b.h > s.y);
            if (hit) {
                const dmg = 12;
                const absorbed = Math.min(hit.shield, dmg);
                hit.shield -= absorbed;
                hit.health = Math.max(0, hit.health - (dmg - absorbed));
                if (absorbed > 0) hit.shieldFlash = 400; else hit.hitFlash = 120;
                for (let i = 0; i < 4; i++) {
                    sim.sparks.push({ x: b.x, y: hit.y + hit.height, vx: (Math.random() - 0.5) * 0.12, vy: Math.random() * 0.08, life: 260, shield: absorbed > 0 });
                }
                return false;
            }
            return b.y > -10;
        });
        sim.sparks = sim.sparks.filter((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; return p.life > 0; });
    },

    drawFactionFleetPreview(sim, canvas) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, W, H);
        // Scrolling star field for an in-game feel.
        const t = performance.now() * 0.02;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 73) % W;
            const sy = Math.floor((i * 131 + t * (1 + (i % 3))) % H);
            ctx.fillRect(sx, sy, 1, 1);
        }
        const gm = typeof graphicsManager !== 'undefined' ? graphicsManager : null;
        const fss = factionShipStyles;
        sim.ships.forEach((s) => {
            if (gm && gm.renderEnemyShip) gm.renderEnemyShip(ctx, s, 1);
            if (s.hitFlash > 0 && gm && gm.renderEnemyShip) {
                // Flash only the ship's pixels, not its box.
                const eb = this._fleetFlashBuf || (this._fleetFlashBuf = document.createElement('canvas'));
                eb.width = s.width + 8;
                eb.height = s.height + 8;
                const ectx = eb.getContext('2d');
                ectx.imageSmoothingEnabled = false;
                gm.renderEnemyShip(ectx, Object.assign({}, s, { x: 4, y: 4 }), 1);
                ectx.globalCompositeOperation = 'source-atop';
                ectx.fillStyle = '#ffffff';
                ectx.fillRect(0, 0, eb.width, eb.height);
                ctx.globalAlpha = 0.6 * s.hitFlash / 120;
                ctx.drawImage(eb, Math.round(s.x) - 4, Math.round(s.y) - 4);
                ctx.globalAlpha = 1;
            }
            if (s.shieldFlash > 0 && gm && gm.drawShieldHull) {
                const vis = fss.resolveFactionShipVisual({ faction: s.faction, enemyClass: s.enemyClass, tier: s.tier });
                gm.drawShieldHull(ctx, s, Math.min(1, s.shieldFlash / 250), true, vis && vis.model);
            }
            const bw = Math.max(20, s.width);
            const bx = Math.round(s.x + (s.width - bw) / 2);
            const bar = (y, frac, color) => {
                ctx.fillStyle = '#05060a';
                ctx.fillRect(bx - 1, y - 1, bw + 2, 4);
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fillRect(bx, y, bw, 2);
                ctx.fillStyle = color;
                ctx.fillRect(bx, y, Math.round(bw * Math.max(0, Math.min(1, frac))), 2);
            };
            const top = Math.round(s.y) - 9;
            bar(top, s.shield / s.shieldMax, '#4ad8ff');
            bar(top + 4, s.health / s.maxHealth, '#ff4d4d');
        });
        const accent = sim.style.accent || '#ff7a4a';
        sim.shots.forEach((b) => {
            ctx.fillStyle = accent;
            ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(b.x), Math.round(b.y) + b.h - 2, b.w, 2);
        });
        sim.incoming.forEach((b) => {
            ctx.fillStyle = '#9ae8ff';
            ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h);
        });
        sim.sparks.forEach((p) => {
            ctx.globalAlpha = Math.min(1, p.life / 200);
            ctx.fillStyle = p.shield ? '#4ad8ff' : '#ffd24a';
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        });
        ctx.globalAlpha = 1;
    },
});
