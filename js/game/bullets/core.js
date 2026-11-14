"use strict";

// Bullet management
const BULLET_POOL_MAX = 96;

class BulletManager {
    constructor() {
        this.bullets = [];
        this.enemyBullets = [];
        this._bulletPool = [];
        this.shotType = 0;
        this.shotTypes = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getIds()
            : ['laser', 'spread', 'rapid', 'plasma', 'missile', 'ion', 'wave', 'burst', 'pierce', 'nova'];
        this.currentShipModel = null;
        this.currentWeapon = 'laser';
        this.tempWeapon = null; // { shotsLeft, previousWeapon, previousShotType } while an in-stage shop weapon is equipped
        this.weaponCooldowns = {};
        this.lastShotTime = 0;
        this.maxEnemyBullets = 3; // Maximum enemy bullets on screen
        this.lastEnemyShotTime = 0;
        this.enemyShotCooldown = 800; // Minimum time between enemy shots (ms)
        this.fireMode = 'auto'; // 'auto' | 'charge'
        this.chargeLevel = 0; // 0..1 while holding space in charge mode
        this.isCharging = false;
        this.chargeStartTime = 0;
        this.maxChargeMs = 900;
        this.minChargeMult = 1;
        this.maxChargeMult = 2.75;
        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.syncFromShipModel(null);
        }
    }

    /**
     * Reuse a spent bullet object. Optional fields are cleared so a recycled
     * missile/wave slot can't keep pierce/angle/boss flags from a prior shot.
     */
    acquireBullet() {
        const b = this._bulletPool.pop();
        if (!b) return {};
        b.angle = undefined;
        b.waveAmp = undefined;
        b.wavePhase = undefined;
        b.pierce = undefined;
        b.charged = undefined;
        b.isBossShot = undefined;
        b.isEnemyShot = undefined;
        b.bonusGlow = undefined;
        b._powerShot = undefined;
        b._ignoreObstacle = undefined;
        b._reflectCount = undefined;
        b._isShot = undefined;
        b._sweepDx = 0;
        b._sweepDy = 0;
        b._vxAcc = 0;
        b._vyAcc = 0;
        b._snapTrueX = undefined;
        b._snapTrueY = undefined;
        b._snapLastX = undefined;
        b._snapLastY = undefined;
        b._terrainRow = undefined;
        b.lightRadius = undefined;
        b.lightIntensity = undefined;
        b.lightColor = undefined;
        b.weaponId = undefined;
        b.type = undefined;
        b.speed = undefined;
        b.reflected = undefined;
        b.chainSlow = undefined;
        b.reflectiveShots = undefined;
        b.wavePhase = undefined;
        b._spawnAt = undefined;
        b._stall = undefined;
        b._still = undefined;
        b._radial = undefined;
        b.moveSpeed = undefined;
        b.vx = undefined;
        b.vy = undefined;
        return b;
    }

    releaseBullet(b) {
        if (!b || this._bulletPool.length >= BULLET_POOL_MAX) return;
        // Never pool a shell that is still live on either combat list —
        // scrubDualMembership used to do that, and the next spawn overwrote
        // mid-flight player shots (same object in both arrays).
        if (this.bullets.indexOf(b) !== -1 || this.enemyBullets.indexOf(b) !== -1) return;
        this._bulletPool.push(b);
    }

    /** Keep projectile AABB tiny so tall lasers cannot hit a full screen early. */
    clampLiveShotSize(bullet) {
        if (!bullet) return bullet;
        const bw = bullet.width != null ? bullet.width : bullet.w;
        const bh = bullet.height != null ? bullet.height : bullet.h;
        const powered = !!(bullet._powerShot || (bullet.bonusGlow != null && bullet.bonusGlow >= 0.85));
        const maxW = powered ? 6 : 4;
        const maxH = powered ? 22 : 16;
        const cx = Number(bullet.x) + (Number(bw) || 0) / 2;
        const nw = Math.max(1, Math.min(maxW, Number(bw) || 2));
        const nh = Math.max(3, Math.min(maxH, Number(bh) || 8));
        if (bullet.width != null) {
            bullet.width = nw;
            bullet.height = nh;
        } else {
            bullet.w = nw;
            bullet.h = nh;
        }
        if (Number.isFinite(cx)) bullet.x = cx - nw / 2;
        return bullet;
    }

    /**
     * Push a shot onto `list`. Prefer pooled shells: if the pool is empty the
     * `fields` object itself becomes the live bullet (no second alloc); later
     * shots copy into recycled shells so long fights stop growing.
     */
    pushBullet(list, fields) {
        // Never insert a live reference that already sits on either combat list —
        // dual membership let enemy step flip vy and rear autofire shots died.
        let src = fields;
        if (src && (this.bullets.indexOf(src) !== -1 || this.enemyBullets.indexOf(src) !== -1)) {
            src = Object.assign({}, fields);
        }
        let b = null;
        while (this._bulletPool.length) {
            const cand = this._bulletPool.pop();
            if (!cand) continue;
            // Stale pool entry still referenced by a live list — skip it.
            if (this.bullets.indexOf(cand) !== -1 || this.enemyBullets.indexOf(cand) !== -1) continue;
            b = cand;
            break;
        }
        if (!b) {
            list.push(src);
            this.normalizeBulletMotion(src, src);
            this.clampLiveShotSize(src);
            return src;
        }
        b.angle = undefined;
        b.waveAmp = undefined;
        b.wavePhase = undefined;
        b.pierce = undefined;
        b.charged = undefined;
        b.isBossShot = undefined;
        b.isEnemyShot = undefined;
        b.bonusGlow = undefined;
        b._powerShot = undefined;
        b._ignoreObstacle = undefined;
        b._reflectCount = undefined;
        b._isShot = undefined;
        b._sweepDx = 0;
        b._sweepDy = 0;
        b._vxAcc = 0;
        b._vyAcc = 0;
        b._snapTrueX = undefined;
        b._snapTrueY = undefined;
        b._snapLastX = undefined;
        b._snapLastY = undefined;
        b._terrainRow = undefined;
        b.weaponId = undefined;
        b.type = undefined;
        b.speed = undefined;
        b.reflected = undefined;
        b.chainSlow = undefined;
        b.reflectiveShots = undefined;
        b.wavePhase = undefined;
        b._spawnAt = undefined;
        b._stall = undefined;
        b._still = undefined;
        b._radial = undefined;
        b.moveSpeed = undefined;
        b.vx = undefined;
        b.vy = undefined;
        for (const k in src) {
            if (Object.prototype.hasOwnProperty.call(src, k)) b[k] = src[k];
        }
        list.push(b);
        this.normalizeBulletMotion(b, src);
        this.clampLiveShotSize(b);
        return b;
    }

    /** Drop any shot that somehow landed on both team lists. */
    scrubDualMembership() {
        const p = this.bullets;
        const e = this.enemyBullets;
        if (!p || !e || !p.length || !e.length) return;
        for (let i = p.length - 1; i >= 0; i--) {
            const b = p[i];
            if (!b) continue;
            const ei = e.indexOf(b);
            if (ei === -1) continue;
            // Keep the team that matches travel direction. Detach only — never
            // releaseBullet here (the kept list still owns this object).
            // Stalled/zero/NaN vy: trust isEnemyShot so enemy shells stay enemy.
            const vy = Number(b.vy);
            const keepEnemy = b.isEnemyShot
                ? !(Number.isFinite(vy) && vy < 0)
                : (Number.isFinite(vy) && vy > 0);
            if (keepEnemy) {
                this.detachBullet(p, i);
                b.isEnemyShot = true;
            } else {
                this.detachBullet(e, ei);
                b.isEnemyShot = false;
            }
        }
    }

    /**
     * Lock a concrete velocity (vx/vy) once. Flight never re-derives from angle
     * mid-air — that caused frozen / reversed / mid-lane vanishing beams.
     */
    normalizeBulletMotion(bullet, fields) {
        if (!bullet) return bullet;
        const hint = fields && Number(fields.speed);
        let s = Number(bullet.moveSpeed);
        if (!(s > 0)) s = Number(bullet.speed);
        if (!Number.isFinite(s) || s === 0) {
            s = (Number.isFinite(hint) && hint !== 0) ? Math.abs(hint)
                : (bullet.isEnemyShot ? 5 : 6);
        } else {
            s = Math.abs(s);
        }
        s = Math.max(0.5, Math.min(24, s));
        bullet.moveSpeed = s;
        bullet.speed = s;

        let vx = Number(bullet.vx);
        let vy = Number(bullet.vy);
        const hasVel = Number.isFinite(vx) && Number.isFinite(vy) && Math.hypot(vx, vy) > 0.01;
        if (!hasVel) {
            const upward = !bullet.isEnemyShot;
            if (bullet.type === 'wave_beam' && bullet.waveAmp) {
                vx = 0;
                vy = upward ? -s : s;
            } else if (bullet.angle !== undefined && Number.isFinite(Number(bullet.angle))) {
                const a = Number(bullet.angle);
                vx = Math.sin(a) * s;
                vy = (upward ? -Math.cos(a) : Math.cos(a)) * s;
            } else {
                vx = 0;
                vy = upward ? -s : s;
            }
        }
        // Own-team primary axis must dominate (no sideways-parked lasers).
        // Radial nova rings intentionally fly every direction — leave them alone.
        const radial = !!(bullet._radial || bullet.type === 'nova_shot');
        const forward = bullet.isEnemyShot ? 1 : -1;
        if (!radial && (Math.abs(vy) < s * 0.55 || Math.sign(vy || forward) !== Math.sign(forward))) {
            const lat = Number.isFinite(vx) ? Math.max(-s * 0.75, Math.min(s * 0.75, vx)) : 0;
            const rem = Math.sqrt(Math.max(0.01, s * s - lat * lat));
            vx = lat;
            vy = forward * rem;
            bullet.angle = undefined;
        }
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.x = Number(bullet.x) || 0;
        bullet.y = Number(bullet.y) || 0;
        bullet._isShot = true;
        return bullet;
    }

    /** @deprecated alias — keep call sites working */
    stabilizeBulletSpeed(bullet, fields) {
        return this.normalizeBulletMotion(bullet, fields);
    }

    getBulletMoveSpeed(bullet, fallback) {
        if (!bullet) return fallback || 6;
        const locked = Number(bullet.moveSpeed);
        if (Number.isFinite(locked) && locked > 0) return locked;
        const s = Number(bullet.speed);
        if (Number.isFinite(s) && s !== 0) return Math.abs(s);
        const v = Math.hypot(Number(bullet.vx) || 0, Number(bullet.vy) || 0);
        if (v > 0) return v;
        return fallback || (bullet.isEnemyShot ? 5 : 6);
    }

    /**
     * One frame of travel from locked vx/vy. Wave sway is additive on X only.
     */
    computeBulletStep(bullet, spd, speedMultiplier, upward) {
        // Lock vx/vy once at spawn — re-normalizing every frame made some
        // beams drift faster/slower than others in the same stream.
        const hasVel = Number.isFinite(bullet.vx) && Number.isFinite(bullet.vy)
            && Math.hypot(bullet.vx, bullet.vy) > 0.01;
        if (!hasVel) this.normalizeBulletMotion(bullet, { speed: spd });
        const smRaw = Number(speedMultiplier);
        const sm = Number.isFinite(smRaw) ? Math.max(0.05, smRaw) : 1;
        let bdx = Number(bullet.vx) * sm;
        let bdy = Number(bullet.vy) * sm;
        if (bullet.type === 'wave_beam' && bullet.waveAmp) {
            bullet.wavePhase = (bullet.wavePhase || 0) + 0.25 * sm;
            bdx += Math.sin(bullet.wavePhase) * Number(bullet.waveAmp) * sm;
        }
        const radial = !!(bullet._radial || bullet.type === 'nova_shot');
        const forward = upward ? -1 : 1;
        if (!radial && (Math.abs(bdy) < 0.05 || Math.sign(bdy) !== Math.sign(forward))) {
            const s = Math.max(0.5, Number(spd) || 6) * sm;
            bdx = 0;
            bdy = forward * s;
            bullet.vx = 0;
            bullet.vy = forward * Math.max(0.5, Number(spd) || 6);
        }
        return { bdx, bdy };
    }

    /** Leading tip of a shot (collision / terrain sample point). */
    shotTip(bullet) {
        const w = Math.max(1, Number(bullet.width != null ? bullet.width : bullet.w) || 1);
        const h = Math.max(1, Number(bullet.height != null ? bullet.height : bullet.h) || 1);
        const down = !!bullet.isEnemyShot;
        return {
            x: Number(bullet.x) + w / 2,
            y: down ? Number(bullet.y) + h : Number(bullet.y)
        };
    }

    /**
     * Player shots move up: the muzzle point is the trail end (bottom of the AABB),
     * not the leading tip. Spawning at muzzle Y put most of the bullet inside the hull.
     */
    playerShotY(muzzleY, height) {
        const h = Math.max(1, Number(height) || 8);
        return (Number(muzzleY) || 0) - h;
    }

    tagPlayerShotAtMuzzle(bullet, muzzleY) {
        if (!bullet) return bullet;
        bullet.isEnemyShot = false;
        bullet._spawnAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (muzzleY != null && Number.isFinite(Number(muzzleY))) {
            const h = bullet.height != null ? bullet.height : bullet.h;
            bullet.y = this.playerShotY(muzzleY, h);
        }
        return bullet;
    }

    spawnPlayerBullet(fields, muzzleY) {
        const fieldsWithTag = Object.assign({}, fields, { _isShot: true, isEnemyShot: false });
        return this.tagPlayerShotAtMuzzle(this.pushBullet(this.bullets, fieldsWithTag), muzzleY);
    }

    bulletOverlapsFootprint(bullet, rect) {
        if (!bullet || !rect) return false;
        const bw = bullet.width != null ? bullet.width : (bullet.w || 0);
        const bh = bullet.height != null ? bullet.height : (bullet.h || 0);
        const pad = 1;
        return bullet.x < rect.x + rect.width + pad
            && bullet.x + bw > rect.x - pad
            && bullet.y < rect.y + rect.height + pad
            && bullet.y + bh > rect.y - pad;
    }

    /** Brief spawn grace while a shot still overlaps the player footprint. */
    beginCollisionFrame(player) {
        this._spawnBlockPlayer = player || null;
    }

    playerShotSpawnBlocked(bullet) {
        if (!bullet || bullet.isEnemyShot) return false;
        if (!bullet._spawnAt) return false;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now - bullet._spawnAt > 220) return false;
        let p = this._spawnBlockPlayer;
        if (!p && typeof playerManager !== 'undefined' && playerManager.getPosition) {
            p = playerManager.getPosition();
        }
        if (!p) return false;
        return this.bulletOverlapsFootprint(bullet, p);
    }

    cullBulletAt(i, list) {
        const last = list.length - 1;
        if (i !== last) list[i] = list[last];
        this.releaseBullet(list.pop());
    }

    /** In-stage shop purchase: fires `weaponId` for `shots` shots, then reverts to whatever was equipped before. */
    equipTemporaryWeapon(weaponId, shots) {
        if (!this.shotTypes.includes(weaponId)) return false;
        if (!this.tempWeapon) {
            this.tempWeapon = { previousWeapon: this.currentWeapon, previousShotType: this.shotType };
        }
        this.tempWeapon.shotsLeft = Math.max(1, Math.round(Number(shots) || 1));
        this.currentWeapon = weaponId;
        this.shotType = this.shotTypes.indexOf(weaponId);
        return true;
    }

    /** One shot was just fired while a temporary weapon is active; reverts once shots run out. */
    consumeTemporaryShot() {
        const t = this.tempWeapon;
        if (!t) return;
        t.shotsLeft -= 1;
        if (t.shotsLeft <= 0) {
            this.currentWeapon = t.previousWeapon;
            this.shotType = t.previousShotType;
            this.tempWeapon = null;
        }
    }

    clearTemporaryWeapon() {
        const t = this.tempWeapon;
        if (!t) return;
        this.currentWeapon = t.previousWeapon;
        this.shotType = t.previousShotType;
        this.tempWeapon = null;
    }

    getFireMode() {
        if (typeof chargeSystem !== 'undefined') {
            return chargeSystem.getFireMode();
        }
        if (this.currentShipModel && this.currentShipModel.fireMode) {
            return this.currentShipModel.fireMode === 'charge' ? 'charge' : 'auto';
        }
        return this.fireMode === 'charge' ? 'charge' : 'auto';
    }

    setFireMode(mode) {
        this.fireMode = (mode === 'charge') ? 'charge' : 'auto';
        if (this.currentShipModel) {
            this.currentShipModel.fireMode = this.fireMode;
        }
        this.resetCharge();
    }

    resetCharge() {
        this.chargeLevel = 0;
        this.isCharging = false;
        this.chargeStartTime = 0;
        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.resetWeaponCharge();
        }
        // Restore unified card stats after CHARGE overlay text.
        if (typeof this.weaponStatsHtml === 'function') {
            const info = document.getElementById('weaponInfo');
            const card = info && info.closest('.weapon-card');
            if (info && card) info.innerHTML = this.weaponStatsHtml(card.dataset.weapon);
        }
    }

    beginCharge() {
        if (typeof playerManager !== 'undefined' && playerManager.isSystemsOnline
            && !playerManager.isSystemsOnline()) {
            return false;
        }
        if (typeof chargeSystem !== 'undefined') {
            if (!chargeSystem.beginWeaponCharge()) return false;
            this.isCharging = true;
            this.chargeStartTime = Date.now();
            this.chargeLevel = 0;
            return true;
        }
        this.isCharging = true;
        this.chargeStartTime = Date.now();
        this.chargeLevel = 0;
        return true;
    }

    updateCharge() {
        if (typeof chargeSystem !== 'undefined') {
            this.chargeLevel = chargeSystem.updateWeaponCharge();
            this.isCharging = chargeSystem.isWeaponCharging();
            return this.chargeLevel;
        }
        if (!this.isCharging) return 0;
        const elapsed = Date.now() - this.chargeStartTime;
        this.chargeLevel = Math.min(1, elapsed / this.maxChargeMs);
        return this.chargeLevel;
    }

    getChargeMultiplier() {
        if (typeof chargeSystem !== 'undefined' && chargeSystem.isWeaponCharging()) {
            return chargeSystem.getShotChargeMult();
        }
        const t = this.chargeLevel;
        return this.minChargeMult + (this.maxChargeMult - this.minChargeMult) * t;
    }

    /** 'all' when this key is the ship's fire-all key, else the key itself. */
    fireGroupFor(key) {
        const L = this.currentShipModel && this.currentShipModel.loadout;
        const allKey = (L && L.allFireKey) || 'space';
        return key === allKey ? 'all' : key;
    }

    releaseChargeShot(playerPosition) {
        if (typeof chargeSystem !== 'undefined') {
            if (!chargeSystem.isWeaponCharging()) return false;
            const mult = chargeSystem.releaseWeaponCharge();
            this.resetCharge();
            return this.shoot(playerPosition, { chargeMult: mult, fireKey: this.fireGroupFor('space') });
        }
        if (!this.isCharging) return false;
        this.updateCharge();
        const mult = this.getChargeMultiplier();
        this.resetCharge();
        return this.shoot(playerPosition, { chargeMult: mult, fireKey: this.fireGroupFor('space') });
    }

    update(deltaTime = 16.67, keys = null) { // Default to ~60 FPS if no deltaTime provided
        // Calculate frame-rate independent speed multiplier
        const baseSpeedMultiplier = deltaTime / 16.67; // 16.67ms = 60 FPS baseline
        const speedMultiplier = baseSpeedMultiplier;

        // Autofire / charge while space held
        if (keys && typeof playerManager !== 'undefined') {
            const spaceHeld = !!(keys[' '] || keys['Space']);
            const mode = this.getFireMode();
            // A / S / D fire their assigned slots — or every weapon when that
            // key is the ALL key (hangar slot bar).
            ['a', 's', 'd'].forEach((k) => {
                if (keys[k] || keys[k.toUpperCase()]) this.shoot(playerManager.getPosition(), { fireKey: this.fireGroupFor(k) });
            });
            if (mode === 'auto' && spaceHeld) {
                this.shoot(playerManager.getPosition(), { fireKey: this.fireGroupFor('space') });
            } else if (mode === 'charge' && spaceHeld && this.isCharging) {
                this.updateCharge();
                const chargeDrain = playerManager.getChargeEnergyPerSec
                    ? playerManager.getChargeEnergyPerSec()
                    : 12;
                if (chargeDrain > 0) {
                    const cost = chargeDrain * (deltaTime / 1000);
                    if (!playerManager.spendEnergy(cost)) {
                        // Out of power — release weak shot or cancel
                        if (this.chargeLevel > 0.05) {
                            this.releaseChargeShot(playerManager.getPosition());
                        } else {
                            this.resetCharge();
                        }
                    }
                }
                this.updateChargeHud();
            }
        }

        // Shot speed settings (SIZES overlay), percent of each weapon's own speed.
        const ui = typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSpeedMul ? uiAppearanceManager : null;
        const playerSpeed = ui ? ui.getShotSpeedMul('player') : 1;
        const enemySpeed = ui ? ui.getShotSpeedMul('enemy') : 1;
        const bossSpeed = ui ? ui.getShotSpeedMul('boss') : 1;

        if (typeof playerManager !== 'undefined' && playerManager.getPosition) {
            this.beginCollisionFrame(playerManager.getPosition());
        }

        const canvasWidth = (typeof game !== 'undefined' && game.internalWidth) ? game.internalWidth : 200;
        const canvasHeight = (typeof game !== 'undefined' && game.internalHeight) ? game.internalHeight : 300;

        this.scrubDualMembership();

        const stepList = (list, speedMulFor, upward) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const bullet = list[i];
                if (!bullet) {
                    this.cullBulletAt(i, list);
                    continue;
                }
                bullet.isEnemyShot = !upward;
                this.clampLiveShotSize(bullet);
                const spd = this.getBulletMoveSpeed(bullet, upward ? 6 : 5);
                const mul = speedMulFor(bullet);
                const frameMul = baseSpeedMultiplier * mul;
                // Hard lock: never park mid-air (zero/wrong-axis velocity).
                // Radial nova pellets keep their ring direction.
                const radial = !!(bullet._radial || bullet.type === 'nova_shot');
                const forward = upward ? -1 : 1;
                if (!radial && (!Number.isFinite(bullet.vx) || !Number.isFinite(bullet.vy)
                    || Math.abs(bullet.vy) < spd * 0.35
                    || Math.sign(bullet.vy || forward) !== Math.sign(forward))) {
                    bullet.angle = undefined;
                    bullet.vx = 0;
                    bullet.vy = forward * spd;
                    bullet.moveSpeed = spd;
                    bullet.speed = spd;
                }
                const step = this.computeBulletStep(bullet, spd, frameMul, upward);
                const px0 = bullet.x;
                const py0 = bullet.y;
                let bdx = step.bdx;
                let bdy = step.bdy;
                if (!radial && Math.abs(bdy) < 0.2 * frameMul) {
                    bdx = 0;
                    bdy = forward * spd * frameMul;
                    bullet.vx = 0;
                    bullet.vy = forward * spd;
                }
                bullet.x = px0 + bdx;
                bullet.y = py0 + bdy;
                bullet._sweepDx = bullet.x - px0;
                bullet._sweepDy = bullet.y - py0;

                const bw = bullet.width || 0;
                const bh = bullet.height || 0;
                // Radial shots leave in every direction — cull all screen edges.
                const offY = radial
                    ? (bullet.y + bh < -2 || bullet.y > canvasHeight + 2)
                    : (upward ? (bullet.y + bh < -2) : (bullet.y > canvasHeight + 2 || bullet.y + bh < -2));
                const off = !Number.isFinite(bullet.x) || !Number.isFinite(bullet.y)
                    || bullet.x + bw < -4
                    || bullet.x > canvasWidth + 4
                    || offY;
                if (off) {
                    this.cullBulletAt(i, list);
                }
            }
        };

        stepList(this.bullets, () => playerSpeed, true);
        stepList(this.enemyBullets, (b) => (b && b.isBossShot ? bossSpeed : enemySpeed), false);
    }

    setShipModel(shipModel) {
        // Re-applying the same hull (late asset swap, loadout refresh) must not
        // reset the weapon the player picked.
        const prev = this.currentShipModel;
        const keepWeapon = (prev && shipModel && (prev === shipModel
            || (prev.id != null && prev.id === shipModel.id)))
            ? this.currentWeapon : null;
        this.currentShipModel = shipModel;
        if (shipModel) {
            // Ensure every equipped weapon has a config entry (loadout can add
            // guns that aren't on the stock hull's weaponConfig map).
            shipModel.weaponConfig = shipModel.weaponConfig || {};
            const ids = Array.isArray(shipModel.availableWeapons) && shipModel.availableWeapons.length
                ? shipModel.availableWeapons
                : ((shipModel.layout && shipModel.layout.loadout && shipModel.layout.loadout.weapons) || ['laser']);
            shipModel.availableWeapons = ids.slice();
            ids.forEach((id) => {
                if (shipModel.weaponConfig[id]) return;
                const fromReg = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getDefaultsForShip)
                    ? weaponConfigManager.getDefaultsForShip(id) : null;
                if (fromReg) shipModel.weaponConfig[id] = Object.assign({}, fromReg);
            });
            if (keepWeapon && ids.indexOf(keepWeapon) !== -1) {
                this.currentWeapon = keepWeapon;
                shipModel.defaultWeapon = shipModel.defaultWeapon || keepWeapon;
            } else if (shipModel.defaultWeapon && ids.indexOf(shipModel.defaultWeapon) !== -1) {
                // Stock hull default only when it is actually fitted.
                this.currentWeapon = shipModel.defaultWeapon;
            } else {
                this.currentWeapon = ids[0] || 'laser';
                shipModel.defaultWeapon = this.currentWeapon;
            }
        }
        // Per-slot cooldowns (keyed by mount, not weapon id — two equipped
        // weapons of the same type still fire on independent clocks).
        this.weaponCooldowns = {};
        if (typeof chargeSystem !== 'undefined') {
            chargeSystem.syncFromShipModel(shipModel);
            this.fireMode = chargeSystem.getFireMode();
            if (shipModel) shipModel.fireMode = this.fireMode;
            this.maxChargeMs = chargeSystem.stats.maxChargeMs;
            this.maxChargeMult = chargeSystem.stats.maxChargeMult;
            this.minChargeMult = chargeSystem.stats.minChargeMult;
        } else if (shipModel && shipModel.fireMode) {
            this.fireMode = shipModel.fireMode === 'charge' ? 'charge' : 'auto';
        } else if (typeof shipLoadoutManager !== 'undefined' && shipModel && shipModel.id) {
            this.fireMode = shipLoadoutManager.getFireMode(shipModel.id);
        }
        this.resetCharge();
        this._firePosCache = null;
        this._firePosFrame = -1;
        this._firePosSig = '';
        // Update weapon display
        this.updateWeaponDisplay();
    }

    /**
     * Every equipped weapon module's fire origin, in playerPosition's
     * screen space — one entry per physical mount, so two of the same
     * weapon type in different slots still fire from their own spot.
     * Falls back to the ship's bounding-box center when there's no
     * modular layout (legacy/non-modular ship models).
     */
    getWeaponFirePositions(playerPosition) {
        const fc = (typeof game !== 'undefined' && game.gameState)
            ? game.gameState.frameCount
            : -1;
        const sig = [playerPosition.x, playerPosition.y, playerPosition.width, playerPosition.height].join('|');
        if (this._firePosCache && this._firePosFrame === fc && this._firePosSig === sig) {
            return this._firePosCache;
        }
        const model = this.currentShipModel;
        const layout = model && model.layout;
        const weaponModules = layout && Array.isArray(layout.modules)
            ? layout.modules.filter((m) => m && m.kind === 'weapon')
            : [];
        if (!weaponModules.length) {
            const lone = [{ id: this.currentWeapon, key: this.currentWeapon, position: playerPosition }];
            this._firePosFrame = fc;
            this._firePosSig = sig;
            this._firePosCache = lone;
            return lone;
        }
        const lw = Math.max(1, layout.width || playerPosition.width);
        const lh = Math.max(1, layout.height || playerPosition.height);
        // Same fit as GraphicsManager.renderPlayerShip: one uniform scale,
        // ship centred in the footprint. Separate x / y scales stretched the
        // mounts away from where the guns are drawn.
        const mw = Math.max(1, model.width || lw);
        const mh = Math.max(1, model.height || lh);
        const fit = Math.min(playerPosition.width / mw, playerPosition.height / mh);
        const drawScale = Math.max(0.25, fit);
        const scaleX = drawScale * (mw / lw);
        const scaleY = drawScale * (mh / lh);
        playerPosition = {
            x: playerPosition.x - (mw * drawScale - playerPosition.width) / 2,
            y: playerPosition.y - (mh * drawScale - playerPosition.height) / 2,
            width: playerPosition.width,
            height: playerPosition.height
        };
        const muzzleUp = () => 1.4;
        const fireKeys = (model.loadout && model.loadout.weaponKeys) || {};
        const slots = weaponModules.map((m) => ({
            id: m.id,
            // Trigger of this slot: 'space' (default) or 'a' / 's' / 'd'.
            fireKey: (m.slotIndex != null && fireKeys[String(m.slotIndex)]) || 'space',
            // Every key that fires this slot (SPACE / A / S / D, any combination).
            keys: m.slotIndex != null && typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getWeaponKeySet
                ? shipLoadoutManager.getWeaponKeySet(model.loadout, m.slotIndex) : ['space'],
            // Split halves (wings, or a nose/core pair) are the weaker mount.
            mount: (m.mountSegment === 'wing' || m.split) ? 'wing' : 'front',
            key: String(m.id || '') + '@' + String(m.face || 'up')
                + (m.slotIndex != null ? '#' + m.slotIndex : '') + (m.side ? ':' + m.side : ''),
            // Muzzle in layout units (top centre of the mount) for the flash.
            // Slot size factor (bigger slot → bigger gun and shots).
            sizeScale: m.slotSizeScale || 1,
            // Slot size class (0 S, 1 M, 2 L) — sets the shot size.
            sizeLevel: (m.slotIndex != null && typeof shipLoadoutManager !== 'undefined'
                && shipLoadoutManager.getSlotSizeLevel && model.id)
                ? shipLoadoutManager.getSlotSizeLevel(model.id, 'weapon', m.slotIndex) : 1,
            muzzle: { lx: m.x + (m.width || 0) / 2, ly: m.y - (m.height || 0) * muzzleUp(m), lw: m.width || 4, lh: m.height || 4, by: m.y + (m.height || 0) },
            position: {
                x: playerPosition.x + m.x * scaleX,
                // Weapon art is drawn taller than its frame, seated on the base
                // (ShipAssetLoader.WEAPON_DRAW_SCALE y − 1 frames above the mount).
                y: playerPosition.y + (m.y - (m.height || 0) * muzzleUp(m)) * scaleY,
                width: Math.max(1, (m.width || 0) * scaleX),
                height: Math.max(1, (m.height || 0) * scaleY)
            }
        }));
        this._firePosFrame = fc;
        this._firePosSig = sig;
        this._firePosCache = slots;
        return slots;
    }

    switchWeapon(direction) {
        const step = direction < 0 ? -1 : 1;
        if (!this.currentShipModel || !this.currentShipModel.availableWeapons) {
            // Fallback to old system
            const n = this.shotTypes.length || 1;
            this.shotType = (this.shotType + step + n) % n;
            this.updateWeaponDisplay();
            const fallback = this.shotTypes[this.shotType];
            return fallback;
        }

        const list = this.currentShipModel.availableWeapons;
        const n = list.length || 1;
        const currentIndex = list.indexOf(this.currentWeapon);
        const nextIndex = ((currentIndex < 0 ? 0 : currentIndex) + step + n) % n;
        this.currentWeapon = list[nextIndex];
        this.updateWeaponDisplay();
        return this.currentWeapon;
    }
}
