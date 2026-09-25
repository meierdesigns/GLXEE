"use strict";

// HangarTestArena methods, split from hangar-test-arena.js.
extendClass(HangarTestArena, {
    applyDefense(target, rawDamage) {
        const isPlayer = !!(this.sim && target === this.sim.player);
        const online = isPlayer && (target.maxEnergy || 0) > 0 && (target.energy || 0) > 0;
        const costPer = Math.max(0.01, Number(target.shieldAbsorbEnergyPerDmg) || 0.5);
        const maxAbs = (isPlayer && online) ? (target.energy / costPer) : (isPlayer ? 0 : Infinity);
        const savedShield = target.shield || 0;
        const usable = isPlayer ? Math.min(savedShield, maxAbs === Infinity ? savedShield : maxAbs) : savedShield;
        const proxy = Object.assign({}, target, { shield: usable });

        let rem;
        if (typeof enemyManager !== 'undefined' && enemyManager.applyDefenseToDamage) {
            rem = enemyManager.applyDefenseToDamage(proxy, rawDamage);
        } else {
            let dmg = Number(rawDamage) || 0;
            if (dmg <= 0) return 0;
            const mechs = proxy.defenseMechanisms || [];
            const reflect = (proxy.reflectChance || 0) / 100;
            if (reflect > 0 && Math.random() < reflect) return 0;
            let reduction = (proxy.damageReduction || 0) / 100;
            if (mechs.indexOf('massive_armor') !== -1) reduction = Math.min(0.75, reduction + 0.1);
            else if (mechs.indexOf('heavy_armor') !== -1) reduction = Math.min(0.75, reduction + 0.05);
            if (mechs.indexOf('adaptive_shield') !== -1) reduction = Math.min(0.75, reduction + 0.05);
            dmg *= (1 - Math.max(0, Math.min(0.75, reduction)));
            if (proxy.armor > 0) {
                const mitigation = Math.min(0.65, proxy.armor / (proxy.armor + 100));
                dmg *= (1 - mitigation);
            }
            dmg = Math.max(Math.max(1, Number(rawDamage) * 0.2), dmg);
            if (proxy.shield > 0) {
                const absorbed = Math.min(proxy.shield, dmg);
                proxy.shield -= absorbed;
                dmg -= absorbed;
            }
            rem = Math.max(0, dmg);
        }
        const used = Math.max(0, usable - (proxy.shield || 0));
        target.shield = savedShield - used;
        if (isPlayer && used > 0) {
            target.energy = Math.max(0, (target.energy || 0) - used * costPer);
        }
        return rem;
    },

    bindInput() {
        this.unbindInput();
        this._keyDown = (e) => {
            if (!this.isVisible) return;
            this._keys[e.key] = true;
            if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this._keys['Shift'] = true;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close();
                return;
            }
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
            }
        };
        this._keyUp = (e) => {
            if (!this.isVisible) return;
            this._keys[e.key] = false;
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (this.sim && this.sim.player.fireMode === 'charge' && this.sim.player.charging) {
                    this.releaseChargeShot();
                }
            }
            if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this._keys['Shift'] = false;
                if (this.sim && this.sim.player.driveCharging) {
                    this.releaseDriveCharge();
                }
            }
        };
        document.addEventListener('keydown', this._keyDown, true);
        document.addEventListener('keyup', this._keyUp, true);
    },

    unbindInput() {
        if (this._keyDown) {
            document.removeEventListener('keydown', this._keyDown, true);
            this._keyDown = null;
        }
        if (this._keyUp) {
            document.removeEventListener('keyup', this._keyUp, true);
            this._keyUp = null;
        }
        this._keys = Object.create(null);
    },

    startLoop() {
        this.stopLoop();
        this._lastTs = 0;
        const loop = (ts) => {
            if (!this.isVisible) return;
            if (!this._lastTs) this._lastTs = ts;
            const dt = Math.min(50, ts - this._lastTs);
            this._lastTs = ts;
            this.update(dt);
            this.draw();
            if (!this._statsAcc) this._statsAcc = 0;
            this._statsAcc += dt;
            if (this._statsAcc >= 200) {
                this._statsAcc = 0;
                this.renderStats();
            }
            this._animId = requestAnimationFrame(loop);
        };
        this._animId = requestAnimationFrame(loop);
    },

    stopLoop() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
        this._lastTs = 0;
    },

    keyDown(name) {
        return !!(this._keys[name] || this._keys[name.toLowerCase()] || this._keys[name.toUpperCase()]);
    },

    releaseChargeShot() {
        const sim = this.sim;
        if (!sim) return;
        const p = sim.player;
        const cs = p.chargeStats || {};
        const maxMs = cs.maxChargeMs || 900;
        const minM = cs.minChargeMult || 1;
        const maxM = cs.maxChargeMult || 2.75;
        const t = Math.min(1, p.charge / maxMs);
        let mult = minM + (maxM - minM) * t;
        if (cs.shieldDivert) mult += (cs.divertShotBonus || 0) * t;
        p.charging = false;
        p.charge = 0;
        p.cooldown = p.weaponCooldown;
        const shotCost = p.shotEnergyCost || 0;
        if ((p.maxEnergy || 0) > 0 && (p.energy || 0) < shotCost) return;
        if (shotCost > 0) p.energy -= shotCost;
        const dmg = p.weaponDamage * mult;
        this.fireBullet(p, dmg, true);
    },

    releaseDriveCharge() {
        const sim = this.sim;
        if (!sim) return;
        const p = sim.player;
        p.driveCharging = false;
        p.driveCharge = 0;
        p.driveBurstMs = 0;
        p.driveBurstLevel = 0;
    },

    fireBullet(p, damage, charged) {
        const sim = this.sim;
        if (!sim) return;
        this._stats.shots += 1;
        const bw = charged ? Math.max(2, Math.round((p.bulletW || 2) * 1.25)) : (p.bulletW || 2);
        const bh = charged ? Math.max(8, Math.round((p.bulletH || 8) * 1.15)) : (p.bulletH || 8);
        const spd = p.weaponSpeed * (charged ? 1.15 : 1);
        sim.bullets.push({
            x: p.x + p.width / 2 - bw / 2,
            y: p.y,
            speed: spd,
            w: bw,
            h: bh,
            damage: damage,
            life: 2000
        });
    },
});
