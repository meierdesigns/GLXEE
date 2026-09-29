"use strict";

// HangarTestArena methods, split from hangar-test-arena.js.
extendClass(HangarTestArena, {
    update(dtMs) {
        const sim = this.sim;
        if (!sim) return;
        const frame = dtMs / 16.67;
        this._elapsed += dtMs;
        sim.phase += dtMs * 0.003;
        const p = sim.player;

        this.updateEnemyRespawns(dtMs);

        if (this._respawnMs > 0) {
            this._respawnMs -= dtMs;
            if (this._respawnMs <= 0) {
                this._respawnMs = 0;
                this.resetPlayerOnly();
            }
            this.updateEnemies(dtMs, frame, false);
            sim.bullets = [];
            sim.enemyBullets = [];
            sim.hits = sim.hits.filter((h) => {
                h.life -= dtMs;
                h.y -= 0.4 * frame;
                return h.life > 0;
            });
            return;
        }

        // Movement with Shift boost (energy-powered)
        const cs = p.chargeStats || {};
        const es = p.energyStats || {};
        const powered = (p.maxEnergy || 0) > 0 && (p.energy || 0) > 0;

        // Energy net regen
        if ((p.maxEnergy || 0) > 0) {
            let net = p.energyRegen || 0;
            if ((p.energy || 0) > 0) net -= (p.energyIdleDraw || 0);
            p.energy = Math.max(0, Math.min(p.maxEnergy, p.energy + net * (dtMs / 1000)));
        }

        const shift = this.keyDown('Shift') || this.keyDown('ShiftLeft') || this.keyDown('ShiftRight');
        let moveMul = 1;
        if (cs.driveCharge && shift && powered) {
            p.driveCharging = true;
            moveMul = cs.driveBoostMul || es.boostSpeedMul || 1.55;
            const drain = p.boostEnergyPerSec || cs.driveBoostDrainPerSec || 32;
            p.energy = Math.max(0, p.energy - drain * (dtMs / 1000));
            if (p.energy <= 0) p.driveCharging = false;
        } else {
            p.driveCharging = false;
        }
        const moveSpeed = p.speed * frame * moveMul;
        // Arrows only: A / S / D are weapon fire keys.
        if (this.keyDown('ArrowLeft')) p.x -= moveSpeed;
        if (this.keyDown('ArrowRight')) p.x += moveSpeed;
        if (this.keyDown('ArrowUp')) p.y -= moveSpeed;
        if (this.keyDown('ArrowDown')) p.y += moveSpeed;

        const minY = this.H * 0.33;
        p.x = Math.max(0, Math.min(this.W - p.width, p.x));
        p.y = Math.max(minY, Math.min(this.H - (this.HUD_H || 0) - p.height, p.y));

        if (p.invuln > 0) p.invuln -= dtMs;

        const diverting = !!(p.charging && cs.shieldDivert);
        if (!diverting && p.shieldMax > 0 && p.shieldRegen > 0 && p.shield < p.shieldMax) {
            p.shield = Math.min(p.shieldMax, p.shield + p.shieldRegen * (dtMs / 1000));
        }

        p.cooldown = Math.max(0, p.cooldown - dtMs);
        // Charge mode still charges on Space; auto fire goes per key through
        // the game's own per-mount weapon logic (fireArenaKey).
        const space = this.keyDown(' ') || this.keyDown('Space');
        const systemsOnline = (p.maxEnergy || 0) > 0 && (p.energy || 0) > 0;
        if (p.fireMode === 'charge') {
            if (space && p.cooldown <= 0 && systemsOnline) {
                p.charging = true;
                const maxMs = cs.maxChargeMs || 900;
                p.charge = Math.min(maxMs, p.charge + dtMs);
                const chargeDrain = (p.chargeEnergyPerSec || 12) * (dtMs / 1000);
                p.energy = Math.max(0, p.energy - chargeDrain);
                if (p.energy <= 0) {
                    if (p.charge > 0.05 * maxMs) this.releaseChargeShot();
                    else {
                        p.charging = false;
                        p.charge = 0;
                    }
                }
                const level = Math.min(1, p.charge / maxMs);
                if (cs.shieldSync && cs.shieldFillPerSec > 0 && p.shieldMax > 0) {
                    p.shield = Math.min(p.shieldMax, p.shield + cs.shieldFillPerSec * level * (dtMs / 1000));
                }
                if (cs.shieldDivert) p.shield = 0;
            } else if (!space && p.charging) {
                this.releaseChargeShot();
            }
        } else if (systemsOnline) {
            ['space', 'a', 's', 'd'].forEach((k) => {
                const down = k === 'space' ? space : (this.keyDown(k) || this.keyDown(k.toUpperCase()));
                if (down) this.fireArenaKey(p, k);
            });
        }

        this.updateEnemies(dtMs, frame, true);

        // Player bullets — up, or along their angle (spread shots), like bulletManager
        sim.bullets = sim.bullets.filter((b) => {
            if (b.angle !== undefined) {
                b.x += Math.sin(b.angle) * b.speed * frame;
                b.y -= Math.cos(b.angle) * b.speed * frame;
            } else {
                b.y -= b.speed * frame;
            }
            b.life -= dtMs;
            if (b.life <= 0 || b.y + b.h < 0 || b.x < 0 || b.x > this.W) return false;
            for (let i = sim.enemies.length - 1; i >= 0; i--) {
                const e = sim.enemies[i];
                if (this.hit(b, e)) {
                    const before = e.health + e.shield;
                    const rem = this.applyDefense(e, b.damage);
                    e.health -= rem;
                    const dealt = Math.max(0, before - (e.health + e.shield));
                    this._stats.damageDealt += dealt;
                    sim.hits.push({ x: e.x + e.width / 2, y: e.y + e.height / 2, life: 220, dmg: Math.round(dealt) });
                    if (e.health <= 0) {
                        this._stats.kills += 1;
                        const deadId = e.id;
                        sim.enemies.splice(i, 1);
                        this.queueEnemyRespawn(deadId);
                    }
                    return false;
                }
            }
            return true;
        });

        // Enemy bullets — straight down
        sim.enemyBullets = sim.enemyBullets.filter((b) => {
            b.y += b.speed * frame;
            b.life -= dtMs;
            if (b.life <= 0 || b.y > this.H || b.x < 0 || b.x > this.W) return false;
            if (p.invuln <= 0 && this.hit(b, p)) {
                const before = p.health + p.shield;
                const rem = this.applyDefense(p, b.damage);
                p.health = Math.max(0, p.health - rem);
                this._stats.damageTaken += Math.max(0, before - (p.health + p.shield));
                p.invuln = 400;
                if (p.charging && p.chargeStats && p.chargeStats.shieldSync) {
                    p.charge = 0;
                }
                sim.hits.push({ x: p.x + p.width / 2, y: p.y + p.height / 2, life: 220, dmg: Math.round(rem) });
                if (p.health <= 0) {
                    this.beginRespawn();
                }
                return false;
            }
            return true;
        });

        sim.hits = sim.hits.filter((h) => {
            h.life -= dtMs;
            h.y -= 0.4 * frame;
            return h.life > 0;
        });
    },

    /** Ship model with the hangar layout applied — what the game flies (mount positions, weaponKeys). */
    getArenaFireModel() {
        const base = this.sim && this.sim.player && this.sim.player.model;
        if (!base) return null;
        if (!this._arenaFireModel || this._arenaFireModelBase !== base) {
            let m = Object.assign({}, base);
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
                shipLoadoutManager.applyLayoutToModel(m, this.shipId);
            }
            if (!m.weaponConfig && typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getDefaultsForShip) {
                m.weaponConfig = {};
                (m.availableWeapons || []).forEach((id) => { m.weaponConfig[id] = weaponConfigManager.getDefaultsForShip(id); });
            }
            this._arenaFireModel = m;
            this._arenaFireModelBase = base;
        }
        return this._arenaFireModel;
    },

    /** Detached BulletManager: per-mount cooldowns without touching the live game. */
    getArenaBulletManager() {
        if (!this._arenaBm) {
            const bm = (typeof BulletManager !== 'undefined') ? Object.create(BulletManager.prototype) : null;
            if (!bm) return null;
            bm.bullets = [];
            bm.enemyBullets = [];
            bm.weaponCooldowns = {};
            bm.muzzleFlashes = {};
            bm.lastShotTime = 0;
            this._arenaBm = bm;
        }
        return this._arenaBm;
    },

    /** Fire what `key` is bound to: every gun for the ALL key, else its assigned slots. */
    fireArenaKey(p, key) {
        const sim = this.sim;
        const model = this.getArenaFireModel();
        const bm = this.getArenaBulletManager();
        const allKey = (model && model.loadout && model.loadout.allFireKey) || 'space';
        const group = key === allKey ? 'all' : key;
        const shotCost = p.shotEnergyCost || 0;
        if ((p.maxEnergy || 0) > 0 && shotCost > 0 && p.energy < shotCost) return;
        if (!model || !bm || !model.weaponConfig) {
            // No weapon slots: the single centre gun on the ALL key.
            if (group !== 'all' || p.cooldown > 0) return;
            if (shotCost > 0) p.energy -= shotCost;
            p.cooldown = p.weaponCooldown;
            this.fireBullet(p, p.weaponDamage, false);
            return;
        }
        bm.currentShipModel = model;
        bm.currentWeapon = model.defaultWeapon || 'laser';
        bm.bullets = [];
        const fired = bm.shootWithShipWeapon(p, Date.now(), { fireKey: group });
        if (!fired) return;
        if (shotCost > 0) p.energy -= shotCost;
        bm.bullets.forEach((b) => {
            this._stats.shots += 1;
            sim.bullets.push({
                x: b.x,
                y: b.y,
                w: b.width,
                h: b.height,
                speed: b.speed,
                angle: b.angle,
                damage: b.damage != null ? b.damage : p.weaponDamage,
                type: b.type,
                weaponId: b.weaponId,
                life: 2000
            });
        });
        bm.bullets = [];
    },

    updateEnemies(dtMs, frame, allowShoot) {
        const sim = this.sim;
        if (!sim) return;
        sim.enemies.forEach((e) => {
            // Match enemyManager: axis bounce with speed / verticalSpeed
            e.x += e.speed * frame;
            e.y += e.verticalSpeed * frame;
            if (e.x <= 0) {
                e.x = 0;
                e.speed = Math.abs(e.speed);
            } else if (e.x >= this.W - e.width) {
                e.x = this.W - e.width;
                e.speed = -Math.abs(e.speed);
            }
            if (e.y <= e.minY) {
                e.y = e.minY;
                e.verticalSpeed = Math.abs(e.verticalSpeed);
            } else if (e.y >= e.maxY) {
                e.y = e.maxY;
                e.verticalSpeed = -Math.abs(e.verticalSpeed);
            }
            if (e.shieldMax > 0 && e.shieldRegen > 0 && e.shield < e.shieldMax) {
                e.shield = Math.min(e.shieldMax, e.shield + e.shieldRegen * (dtMs / 1000));
            }
            if (!allowShoot) return;
            e.shootAcc -= dtMs;
            if (e.shootAcc <= 0) {
                e.shootAcc = e.shootInterval;
                // Shot size of the enemy's weapon (same config as in game).
                const wid = e.weaponId || (e.model && e.model.defaultWeapon) || 'laser';
                const wc = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getDefaultsForShip)
                    ? weaponConfigManager.getDefaultsForShip(wid) : null;
                const bw = (wc && wc.width) || 2;
                const bh = (wc && wc.height) || 8;
                sim.enemyBullets.push({
                    x: e.x + e.width / 2 - bw / 2,
                    y: e.y + e.height,
                    speed: Math.max(2.5, Number(e.weaponSpeed) || 2.5),
                    w: bw,
                    h: bh,
                    damage: e.damage,
                    weaponId: wid,
                    life: 2500
                });
            }
        });
    },

    hit(a, b) {
        return a.x < b.x + b.width && a.x + a.w > b.x && a.y < b.y + b.height && a.y + a.h > b.y;
    },

    drawShip(ctx, model, entity, flip) {
        if (typeof graphicsManager !== 'undefined') {
            if (flip && graphicsManager.renderEnemyShip) {
                const prev = graphicsManager.currentEnemyModel;
                if (model) graphicsManager.currentEnemyModel = model;
                graphicsManager.renderEnemyShip(ctx, entity, this.SHIP_DRAW_SCALE);
                graphicsManager.currentEnemyModel = prev;
                return;
            }
            if (!flip && graphicsManager.renderPlayerShip) {
                const prev = graphicsManager.currentPlayerModel;
                if (model) graphicsManager.currentPlayerModel = model;
                graphicsManager.renderPlayerShip(ctx, entity, this.SHIP_DRAW_SCALE);
                graphicsManager.currentPlayerModel = prev;
                return;
            }
        }
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, entity.width);
            tmp.height = Math.max(1, entity.height);
            const m = model ? Object.assign({}, model) : { width: entity.width, height: entity.height };
            if (flip) m.forceEnemyOrientation = true;
            shipRenderer.renderShipPreview(tmp, m, 1);
            ctx.drawImage(tmp, Math.round(entity.x), Math.round(entity.y), entity.width, entity.height);
            return;
        }
        ctx.fillStyle = flip ? '#ff6688' : '#b44dff';
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
    },

    drawBar(ctx, x, y, w, ratio, color) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, Math.max(0, w * Math.min(1, ratio)), 3);
    },

    drawShieldHull(ctx, model, entity, flip, ratio, opts) {
        if (!(ratio > 0)) return;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.drawShieldHull) {
            graphicsManager.drawShieldHull(ctx, entity, ratio, flip, model, opts || null);
            return;
        }
        // Fallback: thin box if graphics manager unavailable
        ctx.strokeStyle = 'rgba(100,200,255,' + (0.35 + 0.4 * Math.min(1, ratio || 0)) + ')';
        ctx.strokeRect(entity.x - 2, entity.y - 2, entity.width + 4, entity.height + 4);
    },
});
