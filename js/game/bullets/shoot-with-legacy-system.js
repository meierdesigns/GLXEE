"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
    shootWithLegacySystem(playerPosition, options) {
        const opts = options || {};
        const currentType = this.shotTypes[this.shotType];
        let maxBullets = 4;
        
        // Check for infinite ammo cheat
        if (typeof game !== 'undefined' && game.cheats && game.cheats.infiniteAmmo) {
            maxBullets = 999;
        }
        
        // Check if we can shoot based on current bullet count
        if (this.bullets.length >= maxBullets) {
            return false;
        }

        const chargeMult = opts.chargeMult || 1;
        
        switch (currentType) {
            case 'normal':
            case 'laser':
                this.shootNormal(playerPosition, chargeMult);
                break;
            case 'spread':
                this.shootSpread(playerPosition);
                break;
            case 'rapid':
                this.shootRapid(playerPosition);
                break;
            default:
                this.fireWeaponByType(currentType, playerPosition, {
                    damage: Math.round(10 * chargeMult),
                    speed: 6,
                    _charged: chargeMult > 1,
                    _chargeMult: chargeMult
                }, false);
                break;
        }
        
        return true; // Shot was fired successfully
    },

    shootNormal(playerPosition, chargeMult) {
        const mult = chargeMult || 1;
        const bullet = {
            x: playerPosition.x + playerPosition.width / 2 - 1.5,
            y: playerPosition.y,
            width: Math.max(2, Math.round(2 * Math.min(1.75, mult))),
            height: Math.max(8, Math.round(8 * (1 + (Math.min(1.75, mult) - 1) * 0.25))),
            speed: 6 * (1 + (mult - 1) * 0.15),
            damage: Math.round(10 * mult),
            color: '#808080', // Grayscale base - will be colored by render system
            type: 'laser_beam',
            charged: mult > 1,
            // Lighting properties
            lightRadius: 18 * (0.8 + mult * 0.2),
            lightIntensity: 1.2 * mult,
            lightColor: '#808080' // Grayscale base
        };
        this.bullets.push(bullet);
    },

    shootSpread(playerPosition) {
        // Shoot 3 bullets in spread pattern (but respect bullet limit)
        const angles = [-0.3, 0, 0.3];
        const maxBullets = 4;
        
        angles.forEach(angle => {
            if (this.bullets.length < maxBullets) {
                const bullet = {
                    x: playerPosition.x + playerPosition.width / 2 - 1.5,
                    y: playerPosition.y,
                    width: 2,
                    height: 8,
                    speed: 5,
                    damage: 8,
                    angle: angle,
                    color: '#808080', // Grayscale base - will be colored by render system
                    type: 'spread_beam',
                    // Lighting properties
                    lightRadius: 14,
                    lightIntensity: 1.0,
                    lightColor: '#808080' // Grayscale base
                };
                this.bullets.push(bullet);
            }
        });
    },

    shootRapid(playerPosition) {
        // Shoot 2 bullets rapidly (but respect bullet limit)
        const maxBullets = 4;
        
        for (let i = 0; i < 2; i++) {
            if (this.bullets.length < maxBullets) {
                const bullet = {
                    x: playerPosition.x + playerPosition.width / 2 - 1.5 + (i * 4),
                    y: playerPosition.y,
                    width: 2,
                    height: 8,
                    speed: 7,
                    damage: 6,
                    color: '#808080', // Grayscale base - will be colored by render system
                    type: 'rapid_beam',
                    // Lighting properties
                    lightRadius: 12,
                    lightIntensity: 0.9,
                    lightColor: '#808080' // Grayscale base
                };
                this.bullets.push(bullet);
            }
        }
    },

    // New ship-specific weapon methods
    shootLaser(playerPosition, config) {
        const charged = !!(config && config._charged);
        const mult = (config && config._chargeMult) || 1;
        const w = (config && config.width) || 3;
        const h = (config && config.height) || 12;
        const bullet = {
            x: playerPosition.x + playerPosition.width / 2 - w / 2,
            y: playerPosition.y,
            width: w,
            height: h,
            speed: config.speed,
            damage: config.damage,
            color: '#808080', // Grayscale base - will be colored by render system
            type: 'laser_beam',
            charged: charged,
            // Lighting properties
            lightRadius: 18 * (0.8 + mult * 0.2),
            lightIntensity: 1.2 * Math.max(1, mult * 0.85),
            lightColor: '#808080' // Grayscale base
        };
        this.bullets.push(bullet);
    },

    shootSpreadWeapon(playerPosition, config) {
        const bulletCount = config.bulletCount || 3;
        const spreadAngle = config.spreadAngle || 0.3;
        const angles = [];
        
        // Calculate spread angles
        for (let i = 0; i < bulletCount; i++) {
            const angle = (i - (bulletCount - 1) / 2) * spreadAngle;
            angles.push(angle);
        }
        
        angles.forEach(angle => {
            if (this.bullets.length < 6) { // Max bullets for spread
                const bullet = {
                    x: playerPosition.x + playerPosition.width / 2 - 1.5,
                    y: playerPosition.y,
                    width: 2,
                    height: 8,
                    speed: config.speed,
                    damage: config.damage,
                    angle: angle,
                    color: '#808080', // Grayscale base - will be colored by render system
                    type: 'spread_beam',
                    // Lighting properties
                    lightRadius: 14,
                    lightIntensity: 1.0,
                    lightColor: '#808080' // Grayscale base
                };
                this.bullets.push(bullet);
            }
        });
    },

    shootRapidWeapon(playerPosition, config) {
        const bulletCount = config.bulletCount || 2;
        
        for (let i = 0; i < bulletCount; i++) {
            if (this.bullets.length < 6) {
                const bullet = {
                    x: playerPosition.x + playerPosition.width / 2 - 1.5 + (i * 3),
                    y: playerPosition.y,
                    width: 2,
                    height: 8,
                    speed: config.speed,
                    damage: config.damage,
                    color: '#808080', // Grayscale base - will be colored by render system
                    type: 'rapid_beam',
                    // Lighting properties
                    lightRadius: 12,
                    lightIntensity: 0.9,
                    lightColor: '#808080' // Grayscale base
                };
                this.bullets.push(bullet);
            }
        }
    },

    shootPlasma(playerPosition, config) {
        const bullet = {
            x: playerPosition.x + playerPosition.width / 2 - (config.width || 4) / 2,
            y: playerPosition.y,
            width: config.width || 4,
            height: config.height || 8,
            speed: config.speed,
            damage: config.damage,
            color: '#808080',
            type: 'plasma_beam',
            lightRadius: 22,
            lightIntensity: 1.5,
            lightColor: '#808080'
        };
        this.bullets.push(bullet);
    },

    shootMissile(playerPosition, config) {
        const bullet = {
            x: playerPosition.x + playerPosition.width / 2 - (config.width || 5) / 2,
            y: playerPosition.y,
            width: config.width || 5,
            height: config.height || 14,
            speed: config.speed || 4,
            damage: config.damage || 28,
            color: '#808080',
            type: 'missile_shot',
            lightRadius: 16,
            lightIntensity: 1.1,
            lightColor: '#808080'
        };
        this.bullets.push(bullet);
    },

    shootIon(playerPosition, config) {
        const count = config.bulletCount || 3;
        const spacing = config.bulletSpacing || 5;
        const start = playerPosition.x + playerPosition.width / 2 - ((count - 1) * spacing) / 2 - 1.5;
        for (let i = 0; i < count; i++) {
            if (this.bullets.length >= 8) break;
            this.bullets.push({
                x: start + i * spacing,
                y: playerPosition.y,
                width: config.width || 3,
                height: config.height || 10,
                speed: config.speed || 11,
                damage: config.damage || 7,
                color: '#808080',
                type: 'ion_beam',
                lightRadius: 14,
                lightIntensity: 1.0,
                lightColor: '#808080'
            });
        }
    },

    shootWave(playerPosition, config) {
        this.bullets.push({
            x: playerPosition.x + playerPosition.width / 2 - (config.width || 4) / 2,
            y: playerPosition.y,
            width: config.width || 4,
            height: config.height || 10,
            speed: config.speed || 8,
            damage: config.damage || 9,
            color: '#808080',
            type: 'wave_beam',
            waveAmp: config.waveAmp || 1.2,
            wavePhase: 0,
            lightRadius: 18,
            lightIntensity: 1.1,
            lightColor: '#808080'
        });
    },
});
