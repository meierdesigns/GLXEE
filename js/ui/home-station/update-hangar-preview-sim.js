"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    updateHangarPreviewSim(dtMs) {
        const sim = this._hangarPreviewSim;
        const canvas = this._hangarPreviewCanvas;
        if (!sim || !canvas) return;
        if (this._hangarPreviewShipId !== this.hangarShipId) {
            this.resetHangarPreviewSim();
            return;
        }

        const frameScale = dtMs / 16.67;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const cfg = (typeof shipConfigManager !== 'undefined')
            ? shipConfigManager.getConfig(shipId)
            : null;
        // Box the ship with the layout-applied model's proportions: the ship
        // is drawn with a uniform fit, but shots map mounts with separate
        // X/Y scales, so a box of another aspect put shots off their slots.
        const size = this.hangarCloseupSize(this.getHangarPreviewModel(shipId), canvas.width, canvas.height);
        const p = sim.player;
        p.width = size.width;
        p.height = size.height;

        sim.phase += dtMs * 0.0035;
        sim.modeTimer -= dtMs;
        if (sim.modeTimer <= 0) {
            sim.mode = sim.mode === 'fly' ? 'shoot' : 'fly';
            sim.modeTimer = sim.mode === 'shoot' ? 1600 + Math.random() * 900 : 2200 + Math.random() * 1400;
            if (sim.mode === 'shoot') {
                sim.burstLeft = 3 + Math.floor(Math.random() * 3);
                sim.burstGap = 0;
            }
        }

        const speed = Math.max(0.4, Number((cfg && cfg.speed) || model.speed || 4) * 0.22);
        const margin = Math.max(12, (canvas.width - size.width) * 0.18);
        const baseX = (canvas.width - size.width) / 2;
        const sway = Math.sin(sim.phase) * Math.min(28, canvas.width * 0.08);
        if (sim.mode === 'fly') {
            // Ease towards the sway path: coming out of 'shoot' the ship is
            // off the path, and snapping onto it made the ship jump.
            const target = baseX + sway + Math.sin(sim.phase * 0.55) * 10;
            p.x += (target - p.x) * Math.min(1, 0.06 * frameScale);
            p.dir = Math.cos(sim.phase) >= 0 ? 1 : -1;
        } else {
            p.x += p.dir * speed * 0.35 * frameScale;
            if (p.x <= margin || p.x + p.width >= canvas.width - margin) {
                p.dir *= -1;
                p.x = Math.max(margin, Math.min(canvas.width - margin - p.width, p.x));
            }
        }
        p.x = Math.max(8, Math.min(canvas.width - p.width - 8, p.x));
        p.y = canvas.height * 0.68 + Math.sin(sim.phase * 1.35) * 10;

        // Engine thrust particles (flying feel)
        if (Math.random() < 0.55) {
            sim.thrust.push({
                x: p.x + p.width * (0.35 + Math.random() * 0.3),
                y: p.y + p.height - 2,
                vy: 1.2 + Math.random() * 1.6,
                life: 280 + Math.random() * 220,
                w: 2 + Math.floor(Math.random() * 2)
            });
        }
        sim.thrust = sim.thrust.filter((t) => {
            t.y += t.vy * frameScale;
            t.life -= dtMs;
            return t.life > 0 && t.y < canvas.height + 8;
        });

        // Shooting — the game's own per-mount weapon logic (cooldowns,
        // mount positions, bullet shapes), scaled up to the close-up size.
        const fireModel = this.getHangarPreviewModel(shipId);
        const energy = this.syncHangarPreviewEnergy(sim, fireModel, shipId);
        const dt = dtMs / 1000;
        if (energy.max > 0) {
            let net = energy.regen;
            if (sim.energy > 0) net -= energy.idleDraw;
            sim.energy = Math.max(0, Math.min(energy.max, sim.energy + net * dt));
        }
        sim.energyGhost = Math.max(sim.energy, (sim.energyGhost || 0) - energy.max * 0.35 * dt);

        if (sim.mode !== 'shoot') {
            sim.shootAcc += dtMs;
            if (sim.shootAcc >= sim.nextBurst) {
                sim.shootAcc = 0;
                sim.nextBurst = 1400 + Math.random() * 1600;
                sim.mode = 'shoot';
                sim.modeTimer = 1200 + Math.random() * 900;
            }
        }
        // Shots keep their in-game size relative to the ship: preview px per
        // layout unit ÷ in-game px per layout unit.
        const unitScale = typeof PLAYER_UNIT_SCALE !== 'undefined' ? PLAYER_UNIT_SCALE : 0.78;
        const k = (p.width / Math.max(1, fireModel.width || 36)) / unitScale;
        const bm = this.getHangarPreviewBulletManager(sim, fireModel);
        const canFire = energy.max <= 0 || sim.energy >= energy.shotCost;
        const demoKey = this.stepHangarPreviewDemoKey(sim, dtMs);
        // No weapon slotted → nothing to fire (no default-laser fallback).
        if (demoKey && canFire && this.hangarPreviewHasWeapons(shipId)) {
            let fired = false;
            if (bm && fireModel.weaponConfig) {
                // Same routing as in game: the ALL key fires every slot.
                const allKey = this.hangarPreviewAllKey(shipId);
                // shotScale sizes shots to the close-up before they are
                // fitted to the (already close-up sized) gun barrels.
                fired = bm.shootWithShipWeapon(p, Date.now(), {
                    fireKey: demoKey === allKey ? 'all' : demoKey,
                    shotScale: k
                });
            } else {
                sim.burstGap -= dtMs;
                if (sim.burstGap <= 0) {
                    sim.burstGap = Math.max(70, Number((cfg && cfg.weaponCooldown) || model.weaponCooldown || 300));
                    bm.bullets.push({
                        x: p.x + p.width / 2 - 1.5, y: p.y - 4,
                        width: 3 * k, height: 12 * k, speed: 6 * k,
                        type: (cfg && cfg.defaultWeapon) || model.defaultWeapon || 'laser', isPlayer: true
                    });
                    fired = true;
                }
            }
            if (fired && energy.max > 0) sim.energy = Math.max(0, sim.energy - energy.shotCost);
        }

        // Target enemy at the top: drifts side to side, flashes when hit.
        const en = sim.enemy;
        if (en) {
            // Box with the real model's aspect so the uniform fit fills it.
            if (!en.aspect) {
                const vis = typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual
                    ? factionShipStyles.resolveFactionShipVisual({ faction: en.faction, enemyClass: en.enemyClass,
                        tier: en.tier, level: en.level, typeId: en.type }) : null;
                const m = vis && vis.model;
                en.aspect = m && m.width && m.height ? m.width / m.height : 1;
            }
            en.width = Math.round(p.width * 0.75);
            en.height = Math.round(en.width / en.aspect);
            en.x = (canvas.width - en.width) / 2 + Math.sin(sim.phase * 0.4) * Math.min(60, canvas.width * 0.2);
            en.y = canvas.height * 0.12 + Math.sin(sim.phase * 0.9) * 6;
            en.hitFlash = Math.max(0, (en.hitFlash || 0) - dtMs);
            en.sinceHit += dtMs;
            if (en.respawn > 0) {
                en.respawn -= dtMs;
                if (en.respawn <= 0) { en.health = en.maxHealth; en.shield = en.shieldMax; }
            } else if (en.sinceHit > 2000) {
                // Shield recharges after 2 s without a hit.
                en.shield = Math.min(en.shieldMax, en.shield + en.shieldMax * 0.5 * dt);
            }
        }
        const texts = sim.damageTexts || (sim.damageTexts = []);
        sim.damageTexts = texts.filter((t) => {
            t.y -= 0.6 * frameScale;
            t.life -= dtMs;
            return t.life > 0;
        });
        bm.bullets = bm.bullets.filter((b) => {
            if (en && en.respawn <= 0 && b.x + b.width > en.x && b.x < en.x + en.width
                && b.y < en.y + en.height && b.y + b.height > en.y) {
                const dmg = Math.max(1, Math.round(Number(b.damage) || 10));
                const absorbed = Math.min(en.shield, dmg);
                en.shield -= absorbed;
                en.health = Math.max(0, en.health - (dmg - absorbed));
                en.hitFlash = 120;
                en.sinceHit = 0;
                sim.damageTexts.push({
                    x: b.x + b.width / 2 + (Math.random() - 0.5) * 10, y: en.y + en.height * 0.4,
                    text: String(dmg), shield: absorbed >= dmg, life: 700
                });
                if (en.health <= 0) en.respawn = 900;
                return false;
            }
            if (b.type === 'wave_beam' && b.waveAmp) {
                b.wavePhase = (b.wavePhase || 0) + 0.25 * frameScale;
                b.x += Math.sin(b.wavePhase) * b.waveAmp * k * 0.5 * frameScale;
                b.y -= b.speed * frameScale;
            } else if (b.angle !== undefined) {
                b.x += Math.sin(b.angle) * b.speed * frameScale;
                b.y -= Math.cos(b.angle) * b.speed * frameScale;
            } else {
                b.y -= b.speed * frameScale;
            }
            return b.y + b.height > 0 && b.x > -20 && b.x < canvas.width + 20;
        });
    },

    /**
     * Recharge on the weapon art after each shot: the weapon drops dark and
     * refills with its colour from the base up to the muzzle in pixel steps
     * (pulsing, edge flashes per step); a white blink when ready. Drawn 'source-atop' on the
     * ship-only buffer, so only the weapon's own pixels change.
     */
    drawHangarPreviewRecharge(bctx, player, bm) {
        const shots = bm && bm.lastShots;
        const model = bm && bm.currentShipModel;
        const layout = model && model.layout;
        if (!shots || !layout || !player) return;
        const now = performance.now();
        // Same uniform fit + centring as drawMuzzleFlashes / renderPlayerShip.
        const lw = Math.max(1, layout.width || player.width);
        const lh = Math.max(1, layout.height || player.height);
        const mw = Math.max(1, model.width || lw);
        const mh = Math.max(1, model.height || lh);
        const fit = Math.max(0.25, Math.min(player.width / mw, player.height / mh));
        const sx = fit * (mw / lw);
        const sy = fit * (mh / lh);
        const px0 = player.x - (mw * fit - player.width) / 2;
        const py0 = player.y - (mh * fit - player.height) / 2;
        bctx.save();
        bctx.globalCompositeOperation = 'source-atop';
        Object.keys(shots).forEach((key) => {
            const s = shots[key];
            const m = s.muzzle;
            if (!m) return;
            const w = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon
                ? weaponConfigManager.getWeapon(s.id) : null;
            // Real cooldown, but never shorter than readable.
            const dur = Math.max(450, Number(w && w.cooldown) || 300);
            const age = now - s.t;
            if (age > dur + 160) { delete shots[key]; return; }
            const color = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor
                && weaponConfigManager.getWeaponUiColor(s.id)) || '#ffffff';
            const x = Math.round(px0 + (m.lx - m.lw / 2) * sx) - 2;
            const top = Math.round(py0 + m.ly * sy) - 2;
            const bot = Math.round(py0 + (m.by != null ? m.by : m.ly + m.lh * 2.4) * sy) + 2;
            const bw = Math.round(m.lw * sx) + 4;
            const bh = Math.max(2, bot - top);
            if (age > dur) {
                // Ready: white blink that shrinks from the muzzle end down.
                const k = (age - dur) / 160;
                bctx.globalAlpha = 0.85 * (1 - k);
                bctx.fillStyle = '#ffffff';
                bctx.fillRect(x, top, bw, Math.max(2, Math.round(bh * (1 - k))));
                return;
            }
            const r = age / dur;
            // Refill in 6 visible pixel steps (base → muzzle), not a smooth slide.
            const STEPS = 6;
            const step = Math.min(STEPS, Math.floor(r * STEPS) + 1);
            const filled = Math.round(bh * step / STEPS);
            // Empty part: dark, fading out as the charge rises.
            bctx.globalAlpha = 0.75 - 0.35 * r;
            bctx.fillStyle = '#05060a';
            bctx.fillRect(x, top, bw, bh - filled);
            // Charged part: weapon colour, pulsing faster as it fills.
            const pulse = 0.5 + 0.5 * Math.sin(now / (120 - 70 * r));
            bctx.globalAlpha = 0.3 + 0.25 * r + 0.15 * pulse;
            bctx.fillStyle = color;
            bctx.fillRect(x, bot - filled, bw, filled);
            // Step edge: bright line, flashes on each new step.
            const stepAge = (r * STEPS) % 1;
            bctx.globalAlpha = stepAge < 0.25 ? 1 : 0.7;
            bctx.fillStyle = stepAge < 0.25 ? '#ffffff' : color;
            bctx.fillRect(x, bot - filled, bw, Math.max(2, Math.round(bh / 12)));
        });
        bctx.restore();
    },

    /** Ship model with the current hangar layout applied (what the game flies). */
    getHangarPreviewModel(shipId) {
        let model = this.getHangarShipModel(shipId);
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
            model = Object.assign({}, model);
            shipLoadoutManager.applyLayoutToModel(model, shipId);
        }
        return model;
    },

    /** Detached BulletManager so the preview never touches the live game's bullets. */
    getHangarPreviewBulletManager(sim, model) {
        if (!sim.bm) {
            const bm = (typeof BulletManager !== 'undefined')
                ? Object.create(BulletManager.prototype)
                : {};
            bm.bullets = [];
            bm.enemyBullets = [];
            bm.weaponCooldowns = {};
            bm.muzzleFlashes = {};
            bm.lastShotTime = 0;
            bm.currentWeapon = model.defaultWeapon || 'laser';
            sim.bm = bm;
        }
        sim.bm.currentShipModel = model;
        return sim.bm;
    },

    /** Same energy stats the player gets in-game (see PlayerManager.setShipModel). */
    syncHangarPreviewEnergy(sim, model, shipId) {
        let e = { max: 0, regen: 0, idleDraw: 0, shotCost: 0 };
        if (model.energyStats || model.hasEnergyCore != null) {
            e = {
                max: Math.max(0, Math.round(Number(model.maxEnergy) || 0)),
                regen: Math.max(0, Number(model.energyRegen) || 0),
                idleDraw: Math.max(0, Number(model.energyIdleDraw) || 0),
                shotCost: Math.max(0, Number(model.shotEnergyCost) || 0)
            };
        } else if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.computeEnergyStats) {
            const loadout = model.loadout || (shipLoadoutManager.getLoadout ? shipLoadoutManager.getLoadout(shipId) : null) || {
                weapons: model.availableWeapons || [], defenses: [], abilities: model.abilities || [], energy: model.energy || []
            };
            const es = shipLoadoutManager.computeEnergyStats(loadout) || {};
            e = {
                max: Math.max(0, Number(es.maxEnergy) || 0),
                regen: Math.max(0, Number(es.regen) || 0),
                idleDraw: Math.max(0, Number(es.idleDraw) || 0),
                shotCost: Math.max(0, Number(es.shotCost) || 0)
            };
        }
        if (sim.energyMax !== e.max) {
            sim.energyMax = e.max;
            sim.energy = e.max;
            sim.energyGhost = e.max;
        }
        sim.energyStats = e;
        return e;
    },

    /**
     * Demo trigger for the preview: holds A, S, D, then SPACE in turn so you
     * can see which shots each key fires. Returns the held key or null.
     */
    stepHangarPreviewDemoKey(sim, dtMs) {
        const KEYS = ['a', 's', 'd', 'space'];
        const HOLD = 1100;
        const GAP = 350;
        if (sim.demoIdx == null) { sim.demoIdx = 0; sim.demoT = 0; }
        sim.demoT += dtMs;
        if (sim.demoT >= HOLD + GAP) {
            sim.demoT = 0;
            sim.demoIdx = (sim.demoIdx + 1) % KEYS.length;
        }
        sim.demoKey = sim.demoT < HOLD ? KEYS[sim.demoIdx] : null;
        return sim.demoKey;
    },

    hangarPreviewHasWeapons(shipId) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getLoadout) return true;
        const L = shipLoadoutManager.getLoadout(shipId) || {};
        return (L.weaponSlots || L.weapons || []).some(Boolean);
    },

    hangarPreviewAllKey(shipId) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getAllFireKey) return 'space';
        return shipLoadoutManager.getAllFireKey(shipLoadoutManager.getLoadout(shipId));
    },

    /**
     * Keys that fire something: the ALL key, plus each key with at least one
     * filled weapon slot on it (unassigned slots fire on SPACE).
     */
    hangarPreviewUsedKeys(shipId) {
        const used = {};
        if (!this.hangarPreviewHasWeapons(shipId)) return used;
        used[this.hangarPreviewAllKey(shipId)] = true;
        if (typeof shipLoadoutManager === 'undefined') return used;
        const L = shipLoadoutManager.getLoadout(shipId);
        const slots = (L.weaponSlots || L.weapons || []);
        slots.forEach((id, idx) => {
            if (!id) return;
            used[shipLoadoutManager.getWeaponFireKey(L, idx)] = true;
        });
        return used;
    },

    /** Key caps under the energy bar; the demo's held key lights up. */
    drawHangarPreviewKeys(ctx, w, top, sim, accent, shipId) {
        const used = this.hangarPreviewUsedKeys(shipId);
        const keys = [['a', 'A'], ['s', 'S'], ['d', 'D'], ['space', 'SPACE']];
        const pad = 10;
        const gap = 6;
        const capH = 22;
        // Row 1: A S D side by side; row 2: SPACE across the full width.
        const unit = (w - pad * 2 - gap * 2) / 3;
        ctx.save();
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        keys.forEach(([id, label], i) => {
            const isSpace = id === 'space';
            const cw = Math.round(isSpace ? w - pad * 2 : unit);
            const x = isSpace ? pad : Math.round(pad + i * (unit + gap));
            const y = isSpace ? top + capH + gap : top;
            const on = sim.demoKey === id;
            const live = !!used[id];
            ctx.globalAlpha = live ? 1 : 0.3;
            if (on) {
                ctx.fillStyle = accent;
                ctx.fillRect(x, y + 2, cw, capH);
                ctx.fillStyle = '#050508';
            } else {
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, cw - 2, capH - 2);
                // Key "depth": thicker bottom edge unless pressed.
                ctx.fillStyle = accent;
                ctx.fillRect(x, y + capH - 2, cw, 3);
            }
            ctx.fillText(label, x + cw / 2, y + capH / 2 + (on ? 2 : 0));
        });
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        ctx.restore();
    },

    drawHangarPreviewEnergyBar(ctx, w, h, sim, accent) {
        const e = sim.energyStats;
        if (!e) return;
        const pad = 10;
        const barH = 10;
        const keysH = 60; // two rows of key caps
        const y = h - pad - keysH - barH;
        this.drawHangarPreviewKeys(ctx, w, h - pad - 54, sim, accent, this.hangarShipId || 'player_scrap');
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        if (e.max <= 0) {
            ctx.fillText('ENERGY  NO CORE', pad, y - 6);
            ctx.globalAlpha = 1;
            return;
        }
        const r = Math.max(0, Math.min(1, sim.energy / e.max));
        const g = Math.max(0, Math.min(1, (sim.energyGhost || 0) / e.max));
        ctx.fillText('ENERGY ' + Math.round(sim.energy) + '/' + Math.round(e.max), pad, y - 24);
        ctx.globalAlpha = 0.6;
        ctx.font = '13px monospace';
        const net = e.regen - e.idleDraw;
        ctx.fillText('-' + (+e.shotCost.toFixed(1)) + '/SHOT  ' + (net >= 0 ? '+' : '') + (+net.toFixed(1)) + '/S', pad, y - 6);
        const bw = w - pad * 2;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(pad, y, bw, barH);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ff4040';
        ctx.fillRect(pad, y, Math.round(bw * g), barH);
        ctx.globalAlpha = 1;
        ctx.fillStyle = r < 0.2 ? '#ff4040' : accent;
        ctx.fillRect(pad, y, Math.round(bw * r), barH);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.8;
        ctx.strokeRect(pad + 0.5, y + 0.5, bw - 1, barH - 1);
        ctx.globalAlpha = 1;
    },

    drawHangarPreview() {
        const ctx = this._hangarPreviewCtx;
        const canvas = this._hangarPreviewCanvas;
        const sim = this._hangarPreviewSim;
        if (!ctx || !canvas || !sim) return;

        const w = canvas.width;
        const h = canvas.height;
        const accent = this.getHangarPreviewAccent();
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarPreviewModel(shipId);

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, w, h);

        // Starfield — vertical scroll only (matches playfield motion cues)
        ctx.fillStyle = accent;
        for (let i = 0; i < 48; i++) {
            const alpha = 0.18 + (i % 5) * 0.08;
            ctx.globalAlpha = alpha;
            const sx = (i * 53) % w;
            const sy = (i * 79 + sim.phase * 36) % h;
            ctx.fillRect(sx, sy, 1 + (i % 3 === 0 ? 1 : 0), 1);
        }
        ctx.globalAlpha = 1;

        // Soft vignette ring
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.22;
        ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        ctx.globalAlpha = 1;

        // Right-drag pan (bindHangarPreviewPan): moves the scene, not the HUD text.
        ctx.save();
        ctx.translate(Math.round(this._hangarPreviewPanX || 0), Math.round(this._hangarPreviewPanY || 0));

        // Thrust
        sim.thrust.forEach((t) => {
            ctx.globalAlpha = Math.max(0.15, t.life / 500);
            ctx.fillStyle = accent;
            ctx.fillRect(t.x, t.y, t.w, t.w + 2);
        });
        ctx.globalAlpha = 1;

        const en = sim.enemy;
        if (en && en.respawn <= 0 && typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            graphicsManager.renderEnemyShip(ctx, en, 1);
            if (en.hitFlash > 0) {
                // Flash only the ship's pixels, not its box.
                if (!this._hangarEnemyBuf) this._hangarEnemyBuf = document.createElement('canvas');
                const eb = this._hangarEnemyBuf;
                eb.width = Math.max(1, en.width + 8);
                eb.height = Math.max(1, en.height + 8);
                const ectx = eb.getContext('2d');
                ectx.imageSmoothingEnabled = false;
                graphicsManager.renderEnemyShip(ectx, Object.assign({}, en, { x: 4, y: 4 }), 1);
                ectx.globalCompositeOperation = 'source-atop';
                ectx.fillStyle = '#ffffff';
                ectx.fillRect(0, 0, eb.width, eb.height);
                ctx.globalAlpha = 0.6 * en.hitFlash / 120;
                ctx.drawImage(eb, Math.round(en.x) - 4, Math.round(en.y) - 4);
                ctx.globalAlpha = 1;
            }
            // Shield bar on top, health bar below it, just above the ship.
            const bw = Math.max(30, en.width);
            const bx = Math.round(en.x + (en.width - bw) / 2);
            const bar = (y, frac, color) => {
                ctx.fillStyle = '#05060a';
                ctx.fillRect(bx - 1, y - 1, bw + 2, 6);
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fillRect(bx, y, bw, 4);
                ctx.fillStyle = color;
                ctx.fillRect(bx, y, Math.round(bw * Math.max(0, Math.min(1, frac))), 4);
            };
            const top = Math.round(en.y) - 16;
            if (en.shieldMax > 0) bar(top, en.shield / en.shieldMax, '#4ad8ff');
            bar(top + 7, en.health / en.maxHealth, '#ff4d4d');
        }
        (sim.damageTexts || []).forEach((t) => {
            ctx.globalAlpha = Math.min(1, t.life / 300);
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#05060a';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.shield ? '#4ad8ff' : '#ffd24a';
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
        });

        // Bullets — same renderer as in-game shots
        const bullets = (sim.bm && sim.bm.bullets) || [];
        bullets.forEach((b) => {
            if (typeof renderManager !== 'undefined' && renderManager.drawBullet) {
                renderManager.drawBullet(ctx, b, null);
                return;
            }
            ctx.fillStyle = accent;
            ctx.fillRect(b.x, b.y, b.width, b.height);
        });
        ctx.globalAlpha = 1;

        const p = sim.player;
        const recharging = !!(sim.bm && sim.bm.lastShots && Object.keys(sim.bm.lastShots).length);
        if (!recharging && typeof graphicsManager !== 'undefined' && graphicsManager.renderPlayerShip) {
            // Nothing recharging: draw straight to the preview (no extra buffer pass).
            const prev = graphicsManager.currentPlayerModel;
            graphicsManager.currentPlayerModel = model;
            graphicsManager.renderPlayerShip(ctx, p, 1);
            graphicsManager.currentPlayerModel = prev;
            if (sim.bm && sim.bm.drawMuzzleFlashes) sim.bm.drawMuzzleFlashes(ctx, p);
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.renderPlayerShip) {
            // Exactly the in-game path (colour overlay, thruster glow, fit),
            // into a transparent buffer so the recharge tint can be masked to
            // the weapon pixels.
            if (!this._hangarPreviewShipBuf) this._hangarPreviewShipBuf = document.createElement('canvas');
            const buf = this._hangarPreviewShipBuf;
            if (buf.width !== w) buf.width = w;
            if (buf.height !== h) buf.height = h;
            const bctx = buf.getContext('2d');
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.clearRect(0, 0, w, h);
            bctx.imageSmoothingEnabled = false;
            const prev = graphicsManager.currentPlayerModel;
            graphicsManager.currentPlayerModel = model;
            graphicsManager.renderPlayerShip(bctx, p, 1);
            graphicsManager.currentPlayerModel = prev;
            this.drawHangarPreviewRecharge(bctx, p, sim.bm);
            ctx.drawImage(buf, 0, 0);
            if (sim.bm && sim.bm.drawMuzzleFlashes) sim.bm.drawMuzzleFlashes(ctx, p);
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
            const scale = Math.min(p.width / (model.width || 20), p.height / (model.height || 16));
            graphicsManager.shipAssetLoader.renderShip(ctx, model, p.x, p.y, scale, null, 0, {
                showThrusterGlow: true,
                allowColorMountSprites: true
            });
        } else if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, p.width);
            tmp.height = Math.max(1, p.height);
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, Math.round(p.x), Math.round(p.y), p.width, p.height);
        } else {
            ctx.fillStyle = accent;
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.restore();

        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.shipName(shipId), 10, 22);
        ctx.globalAlpha = 0.55;
        ctx.font = '13px monospace';
        const allKey = this.hangarPreviewAllKey(shipId);
        const keyName = (k) => (k === 'space' ? 'SPACE' : k.toUpperCase());
        ctx.fillText(sim.demoKey ? 'FIRE · ' + keyName(sim.demoKey) + (sim.demoKey === allKey ? ' (ALL)' : '') : 'FLY', 10, 40);
        ctx.globalAlpha = 1;

        this.drawHangarPreviewEnergyBar(ctx, w, h, sim, accent);
    },

    captureFlashTarget(btn) {
        if (!btn || !btn.getAttribute) return null;
        const attrs = [
            'data-upgrade-node', 'data-upgrade', 'data-frame-up', 'data-area-up', 'data-mod-up',
            'data-travel', 'data-unlock', 'data-buy', 'data-buy-bp', 'data-buy-part',
            'data-buy-portal', 'data-buy-style', 'data-sell-ship', 'data-sell-bp',
            'data-sell-part', 'data-sell-style', 'data-craft', 'data-activate-ship', 'data-toggle-mod',
            'data-hangar-slot-set', 'data-fire-mode', 'id'
        ];
        for (let i = 0; i < attrs.length; i++) {
            const a = attrs[i];
            if (!btn.hasAttribute(a)) continue;
            const out = { attr: a, value: btn.getAttribute(a), ok: false };
            if (a === 'data-toggle-mod') out.modId = btn.getAttribute('data-mod-id');
            if (a === 'data-hangar-slot-set') {
                out.modId = btn.getAttribute('data-mod-id');
                out.slotIndex = btn.getAttribute('data-slot-index');
            }
            return out;
        }
        return null;
    },

    flashResult(el, ok) {
        if (!el) return;
        el.classList.remove('hs-fx-ok', 'hs-fx-fail');
        void el.offsetWidth;
        el.classList.add(ok ? 'hs-fx-ok' : 'hs-fx-fail');
        const status = document.getElementById('hsStatusToast');
        if (status) {
            status.classList.remove('hs-status-ok', 'hs-status-fail');
            void status.offsetWidth;
            status.classList.add(ok ? 'hs-status-ok' : 'hs-status-fail');
        }
        if (this._fxClearTimer) clearTimeout(this._fxClearTimer);
        this._fxClearTimer = setTimeout(() => {
            el.classList.remove('hs-fx-ok', 'hs-fx-fail');
            if (status) status.classList.remove('hs-status-ok', 'hs-status-fail');
            this._fxClearTimer = null;
        }, 520);
    },

    applyPendingFlash() {
        const p = this._pendingFlash;
        this._pendingFlash = null;
        if (!p || !this.overlay) return;
        let el = null;
        if (p.attr === 'id') {
            el = this.overlay.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(p.value) : p.value));
        } else {
            const nodes = this.overlay.querySelectorAll('[' + p.attr + ']');
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n.getAttribute(p.attr) !== p.value) continue;
                if (p.attr === 'data-toggle-mod' && p.modId && n.getAttribute('data-mod-id') !== p.modId) continue;
                if (p.attr === 'data-hangar-slot-set') {
                    if (p.modId != null && n.getAttribute('data-mod-id') !== p.modId) continue;
                    if (p.slotIndex != null && n.getAttribute('data-slot-index') !== String(p.slotIndex)) continue;
                }
                el = n;
                break;
            }
        }
        if (el) this.flashResult(el, !!p.ok);
    },

    setStatus(msg, opts) {
        this.statusMsg = String(msg || '');
        if (opts && opts.refresh === false) {
            if (this.statusMsg) this.showStatusToast(this.statusMsg);
            this.statusMsg = '';
            return;
        }
        this.createUI();
    },

    /**
     * Temporary toast at the bottom centre, in the station UI style. Lives on
     * <body> so overlay re-renders don't cut it short; fades out on its own.
     */
    showStatusToast(msg) {
        const text = String(msg || '').trim();
        if (!text) return;
        let el = document.getElementById('hsStatusToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'hsStatusToast';
            el.className = 'hs-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.remove('is-visible', 'hs-status-ok', 'hs-status-fail');
        void el.offsetWidth;
        el.classList.add('is-visible');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        // Longer messages stay a little longer.
        const ms = Math.min(6000, 2600 + text.length * 30);
        this._toastTimer = setTimeout(() => {
            el.classList.remove('is-visible');
            this._toastTimer = null;
        }, ms);
    },
});
