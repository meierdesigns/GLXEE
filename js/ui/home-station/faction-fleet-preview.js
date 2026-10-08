"use strict";

// HomeStationUI methods: live fleet preview in the faction FLEET section.
// Faction ships hold formation at the top and fire down; incoming shots from
// below hit their shields (shield hull + bars), same renderers as in-game.
// Below them the pilot's own ship flies alone: it dodges the enemy fire and shoots back.
// The canvas is low-res and scaled up pixelated by CSS.
extendClass(HomeStationUI, {
    startFactionFleetPreview(factionId, shipClass) {
        this.stopFactionFleetPreview();
        const canvas = this.overlay && this.overlay.querySelector('[data-fleet-preview]');
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!canvas || !fss) return;
        const playerOnly = shipClass === 'player';
        const classes = playerOnly ? [] : (shipClass && shipClass !== 'all' ? [shipClass] : fss.classes.slice());
        const style = fss.getFactionStyle(factionId);
        const W = canvas.width;
        const wall = this.fleetPreviewWallWidth(W);
        const ships = classes.map((cls, i) => {
            const size = fss.displaySizeForClass(cls);
            const scale = classes.length === 1 ? 2.2 : 1;
            const w = Math.round(size.width * scale);
            const h = Math.round(size.height * scale);
            const slot = (W - 2 * wall) / classes.length;
            return {
                x: Math.max(wall + 2, Math.min(W - wall - 2 - w, Math.round(wall + slot * i + (slot - w) / 2))), y: 22, baseY: 22, width: w, height: h,
                type: 'spaceship', faction: factionId, enemyClass: cls, tier: 1, level: 1,
                maxHealth: 100, health: 100, shieldMax: 60, shield: 60,
                shieldFlash: 0, hitFlash: 0, fireAcc: 400 + i * 260, phase: i * 1.3,
                // Neutral livery: the preview shows the faction's own colours, not a random in-game paint job.
                _variant: { seed: 1, livery: 'plain', hue: 0, light: 1, sat: 1, paint: 'accent',
                    areas: ['back', 'wings', 'nose', 'center'].map((id) => ({ id, hue: 0, light: 1, sat: 1 })) }
            };
        });
        const sim = { ships, shots: [], incoming: [], sparks: [], inAcc: 0, style, env: this.buildFleetPreviewEnv(factionId, W, canvas.height), player: this.buildFleetPreviewPlayer(W, canvas.height, wall, factionId, playerOnly) };
        let last = 0;
        // Colour edits (sliders, save, reset) are picked up by the loop itself, whatever screen they come from.
        const sig = () => JSON.stringify(fss.getColorOverrides(factionId)) + JSON.stringify(fss.getSavedColorOverrides(factionId));
        let colorSig = sig();
        const loop = (ts) => {
            if (!canvas.isConnected) { this._fleetPreviewAnim = null; return; }
            try {
                const now = sig();
                if (now !== colorSig) {
                    colorSig = now;
                    fss.invalidateColorCaches();
                    sim.style = fss.getFactionStyle(factionId);
                    sim.env = this.buildFleetPreviewEnv(factionId, W, canvas.height);
                    const old = sim.player;
                    const np = this.buildFleetPreviewPlayer(W, canvas.height, wall, factionId, playerOnly);
                    if (old) Object.assign(old, { model: np.model });
                }
            } catch (e) { console.warn('fleet preview colours', e); }
            const dt = last ? Math.min(50, ts - last) : 16;
            last = ts;
            // A throwing frame must never stop the loop (that froze the preview).
            try { this.updateFactionFleetPreview(sim, dt, canvas); } catch (e) { console.warn('fleet preview update', e); }
            try { this.drawFactionFleetPreview(sim, canvas); } catch (e) { console.warn('fleet preview draw', e); }
            this._fleetPreviewAnim = requestAnimationFrame(loop);
        };
        this._fleetPreviewAnim = requestAnimationFrame(loop);
    },

    /** The pilot's active ship, small, at the bottom of the preview. */
    buildFleetPreviewPlayer(W, H, wall, factionId, large) {
        let shipId = 'player_scrap';
        try {
            const pr = typeof profileManager !== 'undefined' && profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
            if (pr && pr.activeShipId) shipId = pr.activeShipId;
        } catch (e) { /* default ship */ }
        let model = null;
        // The faction's own hull anatomy and palette (same as the profile-creation preview).
        try {
            model = Object.assign({}, this.getHangarShipModel(shipId), { id: shipId, faction: factionId, factionPreview: true });
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
                shipLoadoutManager.applyLayoutToModel(model, shipId);
            }
            model.faction = factionId;
        } catch (e) { model = null; }
        const mw = Math.max(1, (model && model.width) || 20);
        const mh = Math.max(1, (model && model.height) || 16);
        const k = large ? Math.min(4, 110 / mh) : Math.min(1.6, 30 / mh);
        const width = Math.round(mw * k), height = Math.round(mh * k);
        return {
            model, shipId, x: Math.round((W - width) / 2), y: large ? Math.round((H - height) / 2) : H - height - 4, width, height,
            vx: 0, fireAcc: 300, hitFlash: 0, wall, shots: []
        };
    },

    /** Autopilot: step away from enemy shots about to arrive, else line up under a ship; fire upward. */
    updateFleetPreviewPlayer(sim, dt, canvas) {
        const p = sim.player;
        if (!p) return;
        const W = canvas.width, H = canvas.height;
        const minX = p.wall + 2, maxX = W - p.wall - 2 - p.width;
        const cx = p.x + p.width / 2;
        let dodge = 0, worst = 1e9;
        sim.shots.forEach((b) => {
            const dy = p.y - (b.y + b.h);
            if (dy < -4 || dy > 90) return;
            const bx = b.x + b.w / 2;
            const off = bx - cx;
            const reach = p.width / 2 + 7;
            if (Math.abs(off) < reach && dy < worst) { worst = dy; dodge = off >= 0 ? -1 : 1; if (off === 0) dodge = cx > W / 2 ? -1 : 1; }
        });
        let want = 0;
        if (dodge) want = dodge * 0.22;
        else if (sim.ships.length) {
            const t = sim.ships[Math.floor(performance.now() / 2200) % sim.ships.length];
            const tx = t.x + t.width / 2;
            want = Math.abs(tx - cx) > 3 ? Math.sign(tx - cx) * 0.1 : 0;
        }
        p.vx += (want - p.vx) * Math.min(1, dt * 0.012);
        p.x = Math.max(minX, Math.min(maxX, p.x + p.vx * dt));
        if ((p.x <= minX && p.vx < 0) || (p.x >= maxX && p.vx > 0)) p.vx = 0;
        p.hitFlash = Math.max(0, p.hitFlash - dt);
        p.fireAcc -= dt;
        if (p.fireAcc <= 0) {
            p.fireAcc = 320;
            sim.incoming.push({ x: p.x + p.width / 2 - 1, y: p.y - 4, w: 2, h: 6, vy: -0.2 });
        }
        sim.shots = sim.shots.filter((b) => {
            const hit = b.x + b.w > p.x + 2 && b.x < p.x + p.width - 2 && b.y + b.h > p.y + 2 && b.y < p.y + p.height;
            if (hit) {
                p.hitFlash = 140;
                for (let i = 0; i < 3; i++) sim.sparks.push({ x: b.x, y: p.y, vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.06, life: 220, shield: false });
            }
            return !hit;
        });
    },

    fleetPreviewWallWidth(W) { return Math.round(W * 0.1); },

    /** Environment of the faction's home planet: palette + drifting rocks in its obstacle style. */
    buildFleetPreviewEnv(factionId, W, H) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const theme = (pcm && pcm.getFactionPlanetTheme ? pcm.getFactionPlanetTheme(factionId) : null) || {};
        const base = /^#[0-9a-f]{6}$/i.test(theme.baseColor || '') ? theme.baseColor : '#7a7f88';
        const style = theme.obstacleStyle || 'asteroid';
        const rocks = [];
        for (let i = 0; i < 7; i++) {
            const size = 8 + ((i * 5) % 4) * 4;
            const n = 7;
            const mask = [];
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) {
                    const dx = (c - (n - 1) / 2) / (n / 2), dy = (r - (n - 1) / 2) / (n / 2);
                    const d = Math.sqrt(dx * dx + dy * dy) + (((i * 31 + r * 17 + c * 13) % 7) - 3) * 0.06;
                    if (style === 'shield' ? (Math.abs(dx) + Math.abs(dy) < 1.05) : d < 0.95) mask.push([c, r, (r + c) % 3]);
                }
            }
            rocks.push({ x: Math.round(W * 0.1) + 6 + (i * 97) % Math.round(W * 0.8 - 12), y: (i * 53) % H, size, vy: 0.012 + (i % 3) * 0.008, mask, n });
        }
        return { base, style, rocks, wall: this.fleetPreviewWallWidth(W), accent: (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle(factionId).accent) || '#8B6914' };
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
            if (s.health <= s.maxHealth * 0.2 && s.shield <= 0) { s.health = s.maxHealth; s.shield = s.shieldMax; }
            s.shield = Math.min(s.shieldMax, s.shield + dt * 0.006);
            s.fireAcc -= dt;
            if (s.fireAcc <= 0) {
                s.fireAcc = 900 + Math.random() * 500;
                const bw = s.enemyClass === 'capital' || s.enemyClass === 'heavy' ? 3 : 2;
                sim.shots.push({ x: s.x + s.width / 2 - bw / 2, y: s.y + s.height, w: bw, h: 6, vy: 0.18 });
            }
        });
        this.updateFleetPreviewPlayer(sim, dt, canvas);
        sim.shots = sim.shots.filter((b) => { b.y += b.vy * dt; return b.y < H; });
        sim.incoming = sim.incoming.filter((b) => {
            const prevY = b.y;
            b.y += b.vy * dt;
            // Swept test: a fast step must not jump over a ship.
            const top = Math.min(prevY, b.y), bottom = Math.max(prevY, b.y) + b.h;
            const hit = sim.ships.find((s) => b.x + b.w > s.x && b.x < s.x + s.width && top < s.y + s.height && bottom > s.y);
            if (hit) {
                const dmg = 12;
                const absorbed = Math.min(hit.shield, dmg);
                hit.shield -= absorbed;
                // Preview ships never die (a health of 0 made the renderer drop them for a frame).
                hit.health = Math.max(hit.maxHealth * 0.15, hit.health - (dmg - absorbed));
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

    /** Physical side tubes (terrain flanks) so ship size can be judged against the environment. */
    drawFleetPreviewTubes(ctx, env, W, H, mix) {
        const ww = env.wall;
        const scroll = (performance.now() * 0.03) % 24;
        const shades = [mix(env.base, 0.25), mix(env.base, 0.55), mix(env.base, 0.95), mix(env.base, 0.55), mix(env.base, 0.3)];
        [0, 1].forEach((side) => {
            const x0 = side ? W - ww : 0;
            const band = ww / shades.length;
            shades.forEach((c, k) => {
                ctx.fillStyle = c;
                ctx.fillRect(Math.round(x0 + k * band), 0, Math.ceil(band), H);
            });
            // joints / rings sliding down the tube
            for (let y = -24 + scroll; y < H; y += 24) {
                ctx.fillStyle = mix(env.base, 0.18);
                ctx.fillRect(x0, Math.round(y), ww, 3);
                ctx.fillStyle = mix(env.base, 1.1);
                ctx.fillRect(x0, Math.round(y) + 3, ww, 1);
                ctx.fillStyle = env.accent;
                ctx.fillRect(Math.round(x0 + (side ? 3 : ww - 5)), Math.round(y) + 9, 2, 2);
            }
            // inner edge shadow
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(side ? x0 - 2 : x0 + ww, 0, 2, H);
        });
    },

    drawFactionFleetPreview(sim, canvas) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.imageSmoothingEnabled = false;
        const env = sim.env;
        const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        const mix = (h, k) => { const c = hexRgb(h); return `rgb(${Math.round(5 + (c[0] - 5) * k)},${Math.round(6 + (c[1] - 6) * k)},${Math.round(10 + (c[2] - 10) * k)})`; };
        if (env) {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, mix(env.base, 0.12));
            g.addColorStop(1, mix(env.base, 0.32));
            ctx.fillStyle = g;
        } else ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, W, H);
        // Scrolling star field for an in-game feel.
        const t = performance.now() * 0.02;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 73) % W;
            const sy = Math.floor((i * 131 + t * (1 + (i % 3))) % H);
            ctx.fillRect(sx, sy, 1, 1);
        }
        if (env) {
            const dtp = performance.now();
            env.rocks.forEach((rk) => {
                const y = ((rk.y + dtp * rk.vy) % (H + 40)) - 20;
                const cell = Math.max(1, Math.round(rk.size / rk.n));
                const ox = Math.round(rk.x - (rk.n * cell) / 2), oy = Math.round(y - (rk.n * cell) / 2);
                const shade = [mix(env.base, 0.85), mix(env.base, 0.6), mix(env.base, 0.4)];
                rk.mask.forEach((m) => { ctx.fillStyle = shade[m[2]]; ctx.fillRect(ox + m[0] * cell, oy + m[1] * cell, cell, cell); });
            });
        }
        if (env) this.drawFleetPreviewTubes(ctx, env, W, H, mix);
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
        const pl = sim.player;
        if (pl && pl.model && gm && gm.renderPlayerShip) {
            const prevModel = gm.currentPlayerModel;
            gm.currentPlayerModel = pl.model;
            // No GUI palette overlay: the hull shows the previewed faction's own colours.
            const cm = typeof colorManager !== 'undefined' ? colorManager : null;
            const saved = cm ? { c: cm.getCurrentOverlayColor, i: cm.getCurrentOverlayIntensity } : null;
            if (cm) {
                cm.getCurrentOverlayColor = () => null;
                cm.getCurrentOverlayIntensity = () => 0;
            }
            try { gm.renderPlayerShip(ctx, pl, 1); } catch (e) { pl.model = null; console.warn('fleet preview player', e); } finally {
                if (saved) { cm.getCurrentOverlayColor = saved.c; cm.getCurrentOverlayIntensity = saved.i; }
                gm.currentPlayerModel = prevModel;
            }
            if (pl.hitFlash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${0.35 * pl.hitFlash / 140})`;
                ctx.fillRect(Math.round(pl.x), Math.round(pl.y), pl.width, pl.height);
            }
        }
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
