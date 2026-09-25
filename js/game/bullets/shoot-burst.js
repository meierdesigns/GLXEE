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

        let weaponId = 'laser';
        // Use ship-specific weapon if available
        if (enemyModel && enemyModel.weaponConfig) {
            weaponId = enemyModel.defaultWeapon || 'laser';
            this.enemyShootWithWeapon(enemy, enemyModel);
        } else {
            // Fallback to default enemy weapon
            this.enemyShootDefault(enemy);
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

    enemyShootWithWeapon(enemy, enemyModel) {
        const defaultWeapon = enemyModel.defaultWeapon || 'laser';
        const weaponConfig = enemyModel.weaponConfig[defaultWeapon];

        if (!weaponConfig) {
            this.enemyShootDefault(enemy);
            return;
        }

        const cfg = Object.assign({}, weaponConfig);
        const damageMul = enemy && enemy.damageMul != null ? enemy.damageMul : 1;
        if (cfg.damage != null) cfg.damage = Math.max(1, Math.round(Number(cfg.damage) * damageMul));
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
            weaponConfigManager.clampWeaponShot(cfg);
        }
        this.fireWeaponByType(defaultWeapon, enemy, cfg, true);
    },

    enemyShootDefault(enemy) {
        const bullet = {
            x: enemy.x + enemy.width / 2 - 1.5,
            y: enemy.y + enemy.height,
            width: 2,
            height: 8,
            speed: 2.5,
            damage: Math.max(1, Math.round(8 * (
                enemy && enemy.damageMul != null ? enemy.damageMul : 1
            ))),
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
        const bullet = {
            x: enemy.x + enemy.width / 2 - 1.5,
            y: enemy.y + enemy.height,
            width: 2,
            height: 8,
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
            const bullet = {
                x: enemy.x + enemy.width / 2 - 1.5,
                y: enemy.y + enemy.height,
                width: 2,
                height: 8,
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
            const bullet = {
                x: enemy.x + enemy.width / 2 - 1.5 + (i * 3),
                y: enemy.y + enemy.height,
                width: 2,
                height: 8,
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
