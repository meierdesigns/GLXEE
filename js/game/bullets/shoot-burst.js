"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
    shootBurst(playerPosition, config) {
        const bulletCount = config.bulletCount || 5;
        const spreadAngle = config.spreadAngle || 0.45;
        for (let i = 0; i < bulletCount; i++) {
            if (this.bullets.length >= 8) break;
            const angle = (i - (bulletCount - 1) / 2) * spreadAngle;
            this.bullets.push({
                x: playerPosition.x + playerPosition.width / 2 - 1.5,
                y: playerPosition.y,
                width: config.width || 3,
                height: config.height || 8,
                speed: config.speed || 9,
                damage: config.damage || 5,
                angle: angle,
                color: '#808080',
                type: 'burst_shot',
                lightRadius: 12,
                lightIntensity: 0.85,
                lightColor: '#808080'
            });
        }
    },

    /**
     * Claw Beam: two lances from the outer edges of the mount, angled inwards
     * so they cross a short way ahead (a pincer), then fan out again. Laser
     * by contrast is one straight centred beam.
     */
    shootClawBeam(playerPosition, config) {
        const w = config.width || 3;
        const h = config.height || 14;
        const speed = config.speed || 13;
        // Lances start this far apart and meet ~5 bullet-lengths ahead.
        const half = Math.max(4, (config.bulletSpacing || 6) + playerPosition.width * 0.25);
        const meet = h * 5;
        const angle = Math.atan2(half, meet);
        [-1, 1].forEach((side) => {
            this.bullets.push({
                x: playerPosition.x + playerPosition.width / 2 + side * half - w / 2,
                y: playerPosition.y,
                width: w,
                height: h,
                speed: speed,
                damage: config.damage || 11,
                // Negative side (left) steers right and vice versa.
                angle: -side * angle,
                color: '#808080',
                type: 'pierce_beam',
                charged: !!config._charged,
                lightRadius: config.lightRadius || 40,
                lightIntensity: config.lightIntensity || 1.1,
                lightColor: '#808080'
            });
        });
    },

    shootPierce(playerPosition, config) {
        this.bullets.push({
            x: playerPosition.x + playerPosition.width / 2 - (config.width || 2) / 2,
            y: playerPosition.y,
            width: config.width || 2,
            height: config.height || 18,
            speed: config.speed || 16,
            damage: config.damage || 14,
            color: '#808080',
            type: 'pierce_beam',
            pierce: true,
            lightRadius: 20,
            lightIntensity: 1.3,
            lightColor: '#808080'
        });
    },

    shootNova(playerPosition, config) {
        const bulletCount = config.bulletCount || 5;
        const spreadAngle = config.spreadAngle || 0.55;
        for (let i = 0; i < bulletCount; i++) {
            if (this.bullets.length >= 8) break;
            const angle = (i - (bulletCount - 1) / 2) * spreadAngle;
            this.bullets.push({
                x: playerPosition.x + playerPosition.width / 2 - 2,
                y: playerPosition.y,
                width: config.width || 4,
                height: config.height || 8,
                speed: config.speed || 7,
                damage: config.damage || 6,
                angle: angle,
                color: '#808080',
                type: 'nova_shot',
                lightRadius: 22,
                lightIntensity: 1.4,
                lightColor: '#808080'
            });
        }
    },

    /**
     * Share of the gun's width that is barrel, per weapon (from the gun art):
     * shots come out of the barrel, so their width follows it.
     */
    getBarrelFraction(weaponId) {
        return ({
            laser: 0.25, laser_twin: 0.14, railgun: 0.25, spread: 0.2, rapid: 0.14,
            burst: 0.25, plasma: 0.5, claw_beam: 0.2, spike_burst: 0.2, ion: 0.25,
            wave: 0.4, nova: 0.4, missile: 0.3, pierce: 0.2
        })[String(weaponId || '')] || 0.3;
    },

    /**
     * Resize bullets added since `from` so their width matches the barrel of
     * a gun `gunWidth` wide (proportions kept, centre kept). Shots only
     * shrink to the barrel; `maxGrow` (> 1, from a bigger slot size) lets
     * them grow up to that factor of their base size, never past the barrel.
     */
    fitBulletsToBarrel(list, from, gunWidth, weaponId, maxGrow) {
        if (!(gunWidth > 0)) return;
        // Floor at 2 px so Settings → Shot Size still has room to scale up/down.
        const target = Math.max(2, gunWidth * this.getBarrelFraction(weaponId));
        const grow = Math.max(1, Number(maxGrow) || 1);
        for (let i = from; i < list.length; i++) {
            const b = list[i];
            const bw = b.width != null ? b.width : b.w;
            if (!(bw > 0)) continue;
            const s = Math.max(0.3, Math.min(grow, target / bw));
            if (s === 1) continue;
            const cx = b.x + bw / 2;
            const nw = Math.max(1, bw * s);
            if (b.width != null) {
                b.width = nw;
                b.height = Math.max(3, (b.height || 8) * s);
            } else {
                b.w = nw;
                b.h = Math.max(3, (b.h || 8) * s);
            }
            b.x = cx - nw / 2;
        }
    },

    /** Apply Settings → Shot Size (player / enemy / boss) to new bullets. */
    applyShotSizeSetting(list, from, kind) {
        if (!list || !(from >= 0)) return;
        const mul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSizeMul)
            ? uiAppearanceManager.getShotSizeMul(kind || 'enemy') : 1;
        if (!(mul > 0) || Math.abs(mul - 1) < 0.01) return;
        for (let i = from; i < list.length; i++) {
            const b = list[i];
            if (!b) continue;
            const bw = b.width != null ? b.width : b.w;
            const bh = b.height != null ? b.height : b.h;
            if (!(bw > 0)) continue;
            const cx = b.x + bw / 2;
            const nw = Math.max(1, Math.round(bw * mul * 100) / 100);
            const nh = Math.max(3, Math.round((bh || 8) * mul * 100) / 100);
            if (b.width != null) {
                b.width = nw;
                b.height = nh;
            } else {
                b.w = nw;
                b.h = nh;
            }
            b.x = cx - nw / 2;
            if (b.lightRadius) b.lightRadius = Math.max(6, b.lightRadius * Math.sqrt(mul));
        }
    },

    /** Weapon an enemy carries (drawn on its hull and fired). */
    getEnemyWeaponId(enemy) {
        if (enemy && enemy.weaponId) return enemy.weaponId;
        const m = (typeof enemyManager !== 'undefined' && enemyManager.currentEnemyModel) || null;
        return (m && m.weaponConfig && m.defaultWeapon) || 'laser';
    },

    /**
     * Enemy gun width in game px, by the weapon's size class on the same scale
     * as player guns (an S mount is ~3 px on the player ship): S 3, M 4.5, L 6.
     */
    getEnemyGunWidth(enemy) {
        const id = this.getEnemyWeaponId(enemy);
        const lv = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getPartSizeLevel)
            ? shipLoadoutManager.getPartSizeLevel('weapon', id) : 0;
        const cs = (typeof game !== 'undefined' && game && game.contentScale) ? Number(game.contentScale) || 1 : 1;
        const base = [3, 4.5, 6][Math.max(0, Math.min(2, lv))] * cs;
        // Side craft use the same visual scale as their hull. This keeps guns
        // and shots from reading larger than the ship carrying them.
        const scale = enemy && enemy.weaponScale != null
            ? Math.max(0.45, Math.min(1, Number(enemy.weaponScale) || 1)) : 1;
        return base * scale;
    },

    enemyShoot(enemy) {
        const currentTime = Date.now();

        // Check cooldown - prevent shooting too frequently
        if (currentTime - this.lastEnemyShotTime < this.enemyShotCooldown) {
            return;
        }

        // Check maximum enemy bullets on screen
        if (this.enemyBullets.length >= this.maxEnemyBullets) {
            return;
        }

        // Get enemy ship model for weapon configuration
        let enemyModel = null;
        if (typeof enemyManager !== 'undefined' && enemyManager.currentEnemyModel) {
            enemyModel = enemyManager.currentEnemyModel;
        }

        // The weapon this enemy carries (drawn on its hull), else the model's.
        let weaponId = this.getEnemyWeaponId(enemy);
        const hasCfg = (enemyModel && enemyModel.weaponConfig && enemyModel.weaponConfig[weaponId])
            || (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getDefaultsForShip);
        if (hasCfg) {
            this.enemyShootWithWeapon(enemy, enemyModel, weaponId);
        } else {
            // Fallback to default enemy weapon
            const before = this.enemyBullets.length;
            this.enemyShootDefault(enemy);
            this.fitBulletsToBarrel(this.enemyBullets, before, this.getEnemyGunWidth(enemy), weaponId);
            this.applyShotSizeSetting(this.enemyBullets, before,
                enemy && enemy.isBoss ? 'boss' : 'enemy');
        }

        if (typeof soundManager !== 'undefined') {
            soundManager.playEnemyShoot(weaponId);
        }

        if (typeof profileManager !== 'undefined' && profileManager.discover) {
            profileManager.discover('weapons', weaponId);
            if (enemy && enemy.type && profileManager.discoverEnemyContents) {
                profileManager.discoverEnemyContents(enemy.type);
            }
        }

        // Update last shot time
        this.lastEnemyShotTime = currentTime;
    },

    enemyShootWithWeapon(enemy, enemyModel, weaponId) {
        const defaultWeapon = weaponId || (enemyModel && enemyModel.defaultWeapon) || 'laser';
        // The model's tuning for this weapon, else the weapon's own defaults.
        const weaponConfig = (enemyModel && enemyModel.weaponConfig && enemyModel.weaponConfig[defaultWeapon])
            || (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getDefaultsForShip
                ? weaponConfigManager.getDefaultsForShip(defaultWeapon) : null);

        if (!weaponConfig) {
            this.enemyShootDefault(enemy);
            return;
        }

        const cfg = Object.assign({}, weaponConfig);
        const sideScale = enemy && enemy.weaponScale != null
            ? Math.max(0.45, Math.min(1, Number(enemy.weaponScale) || 1)) : 1;
        if (enemy && enemy.isSideEnemy) {
            if (cfg.width != null) cfg.width *= sideScale;
            if (cfg.height != null) cfg.height *= sideScale;
        }
        // Side craft hit at half strength: escorts pressure, the champion is the threat.
        const damageMul = (enemy && enemy.damageMul != null ? enemy.damageMul : 1)
            * (enemy && enemy.isSideEnemy ? 0.5 : 1);
        if (cfg.damage != null) cfg.damage = Math.max(1, Math.round(Number(cfg.damage) * damageMul));
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
            weaponConfigManager.clampWeaponShot(cfg);
        }
        const before = this.enemyBullets.length;
        this.fireWeaponByType(defaultWeapon, enemy, cfg, true);
        // Tag with the weapon: drawn in its type colour and shape, like player shots.
        for (let i = before; i < this.enemyBullets.length; i++) {
            this.enemyBullets[i].weaponId = defaultWeapon;
            this.enemyBullets[i].isEnemyShot = true;
        }
        this.fitBulletsToBarrel(this.enemyBullets, before, this.getEnemyGunWidth(enemy), defaultWeapon);
        this.applyShotSizeSetting(this.enemyBullets, before,
            enemy && enemy.isBoss ? 'boss' : 'enemy');
    },

    enemyShootDefault(enemy) {
        const bullet = {
            x: enemy.x + enemy.width / 2 - 1.5,
            y: enemy.y + enemy.height,
            width: 2,
            height: enemy && enemy.isSideEnemy ? Math.max(3, 8 * (enemy.weaponScale || 1)) : 8,
            speed: 2.5,
            damage: Math.max(1, Math.round(8 * (
                enemy && enemy.damageMul != null ? enemy.damageMul : 1
            ) * (enemy && enemy.isSideEnemy ? 0.5 : 1))),
            color: '#808080', // Grayscale base - will be colored by render system
            type: 'enemy_laser',
            // Lighting properties
            lightRadius: 14,
            lightIntensity: 1.0,
            lightColor: '#808080' // Grayscale base
        };
        this.enemyBullets.push(bullet);
    },

    enemyShootLaser(enemy, config) {
        // Shot size from the weapon config, like the player's shots.
        const bw = config.width || 2;
        const bullet = {
            x: enemy.x + enemy.width / 2 - bw / 2,
            y: enemy.y + enemy.height,
            width: bw,
            height: config.height || 8,
            speed: config.speed,
            damage: config.damage,
            color: '#808080', // Grayscale base - will be colored by render system
            type: 'enemy_laser',
            // Lighting properties
            lightRadius: 18,
            lightIntensity: 1.2,
            lightColor: '#808080' // Grayscale base
        };
        this.enemyBullets.push(bullet);
    },

    enemyShootSpread(enemy, config) {
        // Limit spread shots to maximum 2 bullets to stay within 3 total limit
        const bulletCount = Math.min(config.bulletCount || 3, 2);
        const spreadAngle = config.spreadAngle || 0.3;
        const angles = [];

        // Calculate spread angles
        for (let i = 0; i < bulletCount; i++) {
            const angle = (i - (bulletCount - 1) / 2) * spreadAngle;
            angles.push(angle);
        }

        angles.forEach(angle => {
            const bw = config.width || 2;
            const bullet = {
                x: enemy.x + enemy.width / 2 - bw / 2,
                y: enemy.y + enemy.height,
                width: bw,
                height: config.height || 8,
                speed: config.speed,
                damage: config.damage,
                angle: angle,
                color: '#808080', // Grayscale base - will be colored by render system
                type: 'enemy_spread',
                // Lighting properties
                lightRadius: 14,
                lightIntensity: 1.0,
                lightColor: '#808080' // Grayscale base
            };
            this.enemyBullets.push(bullet);
        });
    },

    enemyShootRapid(enemy, config) {
        // Limit rapid shots to maximum 2 bullets to stay within 3 total limit
        const bulletCount = Math.min(config.bulletCount || 2, 2);

        for (let i = 0; i < bulletCount; i++) {
            const bw = config.width || 2;
            const bullet = {
                x: enemy.x + enemy.width / 2 - bw / 2 + (i - (bulletCount - 1) / 2) * (bw + 1),
                y: enemy.y + enemy.height,
                width: bw,
                height: config.height || 8,
                speed: config.speed,
                damage: config.damage,
                color: '#808080', // Grayscale base - will be colored by render system
                type: 'enemy_rapid',
                // Lighting properties
                lightRadius: 12,
                lightIntensity: 0.9,
                lightColor: '#808080' // Grayscale base
            };
            this.enemyBullets.push(bullet);
        }
    },

    enemyShootPlasma(enemy, config) {
        const bullet = {
            x: enemy.x + enemy.width / 2 - (config.width || 4) / 2,
            y: enemy.y + enemy.height,
            width: config.width || 4,
            height: config.height || 8,
            speed: config.speed,
            damage: config.damage,
            color: '#808080', // Grayscale base - will be colored by render system
            type: 'enemy_plasma',
            // Lighting properties
            lightRadius: 22,
            lightIntensity: 1.5,
            lightColor: '#808080' // Grayscale base
        };
        this.enemyBullets.push(bullet);
    },

    getBullets() {
        return this.bullets;
    },

    getEnemyBullets() {
        return this.enemyBullets;
    },

    removeBullet(index) {
        this.bullets.splice(index, 1);
    },

    removeEnemyBullet(index) {
        this.enemyBullets.splice(index, 1);
    },

    switchShotType() {
        return this.switchWeapon();
    },

    getCurrentShotType() {
        if (this.currentShipModel && this.currentWeapon) {
            return this.currentWeapon;
        }
        return this.shotTypes[this.shotType];
    },

    getCurrentWeapon() {
        return this.currentWeapon;
    },

    getAvailableWeapons() {
        if (this.currentShipModel && this.currentShipModel.availableWeapons) {
            return this.currentShipModel.availableWeapons;
        }
        return this.shotTypes;
    },
});
