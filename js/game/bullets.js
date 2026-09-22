"use strict";

// Bullet management
class BulletManager {
    constructor() {
        this.bullets = [];
        this.enemyBullets = [];
        this.shotType = 0;
        this.shotTypes = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getIds()
            : ['laser', 'spread', 'rapid', 'plasma', 'missile', 'ion', 'wave', 'burst', 'pierce', 'nova'];
        this.currentShipModel = null;
        this.currentWeapon = 'laser';
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

    releaseChargeShot(playerPosition) {
        if (typeof chargeSystem !== 'undefined') {
            if (!chargeSystem.isWeaponCharging()) return false;
            const mult = chargeSystem.releaseWeaponCharge();
            this.resetCharge();
            return this.shoot(playerPosition, { chargeMult: mult });
        }
        if (!this.isCharging) return false;
        this.updateCharge();
        const mult = this.getChargeMultiplier();
        this.resetCharge();
        return this.shoot(playerPosition, { chargeMult: mult });
    }

    update(deltaTime = 16.67, keys = null) { // Default to ~60 FPS if no deltaTime provided
        // Calculate frame-rate independent speed multiplier
        const speedMultiplier = deltaTime / 16.67; // 16.67ms = 60 FPS baseline

        // Autofire / charge while space held
        if (keys && typeof playerManager !== 'undefined') {
            const spaceHeld = !!(keys[' '] || keys['Space']);
            const mode = this.getFireMode();
            if (mode === 'auto' && spaceHeld) {
                this.shoot(playerManager.getPosition());
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
        
        // Update player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
        // Handle angled bullets (spread shot) and wave sway
            if (bullet.type === 'wave_beam' && bullet.waveAmp) {
                bullet.wavePhase = (bullet.wavePhase || 0) + 0.25 * speedMultiplier;
                bullet.x += Math.sin(bullet.wavePhase) * bullet.waveAmp * speedMultiplier;
                bullet.y -= bullet.speed * speedMultiplier;
            } else if (bullet.angle !== undefined) {
                bullet.x += Math.sin(bullet.angle) * bullet.speed * speedMultiplier;
                bullet.y -= Math.cos(bullet.angle) * bullet.speed * speedMultiplier;
            } else {
                bullet.y -= bullet.speed * speedMultiplier;
            }
            
            // Remove bullets that are off screen
            // Get canvas width from game if available
            const canvasWidth = (typeof game !== 'undefined' && game.internalWidth) ? game.internalWidth : 200;
            if (bullet.y < 0 || bullet.x < 0 || bullet.x > canvasWidth) {
                this.bullets.splice(i, 1);
            }
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            
            // Handle angled enemy bullets (after reflection)
            if (bullet.angle !== undefined) {
                bullet.x += Math.sin(bullet.angle) * bullet.speed * speedMultiplier;
                bullet.y += Math.cos(bullet.angle) * bullet.speed * speedMultiplier;
            } else {
                bullet.y += bullet.speed * speedMultiplier;
            }
            
            // Remove bullets that are off screen
            // Get canvas dimensions from game if available
            const canvasWidth = (typeof game !== 'undefined' && game.internalWidth) ? game.internalWidth : 200;
            const canvasHeight = (typeof game !== 'undefined' && game.internalHeight) ? game.internalHeight : 300;
            if (bullet.y > canvasHeight || bullet.x < 0 || bullet.x > canvasWidth) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    setShipModel(shipModel) {
        this.currentShipModel = shipModel;
        if (shipModel && shipModel.defaultWeapon) {
            this.currentWeapon = shipModel.defaultWeapon;
        }
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
        // Initialize weapon cooldowns
        if (shipModel && shipModel.weaponConfig) {
            Object.keys(shipModel.weaponConfig).forEach(weapon => {
                this.weaponCooldowns[weapon] = 0;
            });
        }
        // Update weapon display
        this.updateWeaponDisplay();
    }

    switchWeapon() {
        if (!this.currentShipModel || !this.currentShipModel.availableWeapons) {
            // Fallback to old system
            this.shotType = (this.shotType + 1) % this.shotTypes.length;
            this.updateWeaponDisplay();
            const fallback = this.shotTypes[this.shotType];
            return fallback;
        }
        
        const currentIndex = this.currentShipModel.availableWeapons.indexOf(this.currentWeapon);
        const nextIndex = (currentIndex + 1) % this.currentShipModel.availableWeapons.length;
        this.currentWeapon = this.currentShipModel.availableWeapons[nextIndex];
        this.updateWeaponDisplay();
        return this.currentWeapon;
    }
    
    getWeaponIconKey(weaponType) {
        const map = {
            normal: 'shotLaser',
            laser: 'shotLaser',
            spread: 'shotSpread',
            rapid: 'shotRapid',
            plasma: 'shotPlasma',
            missile: 'shotMissile',
            ion: 'shotIon',
            wave: 'shotWave',
            burst: 'shotBurst',
            pierce: 'shotPierce',
            nova: 'shotNova'
        };
        if (typeof weaponConfigManager !== 'undefined') {
            const w = weaponConfigManager.getWeapon(weaponType);
            if (w && w.iconKey) return w.iconKey;
        }
        return map[weaponType] || 'shotLaser';
    }

    renderWeaponIcon(weaponType) {
        const canvas = document.getElementById('weaponIcon');
        if (!canvas) return;
        const key = this.getWeaponIconKey(weaponType);
        if (typeof iconRenderer !== 'undefined') {
            let tint = null;
            try {
                tint = getComputedStyle(document.documentElement).getPropertyValue('--current-primary').trim() || null;
            } catch (e) { /* ignore */ }
            iconRenderer.drawToCanvas(canvas, key, tint || '#00FFCC');
            return;
        }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00FFCC';
        ctx.fillRect(6, 6, 4, 4);
    }

    updateWeaponDisplay() {
        const weaponElement = document.getElementById('currentWeapon');
        const infoElement = document.getElementById('weaponInfo');
        const mode = this.getFireMode();
        const modeLabel = mode === 'charge' ? 'CHARGE' : 'AUTO';
        
        if (weaponElement) {
            if (this.currentShipModel && this.currentShipModel.availableWeapons) {
                weaponElement.textContent = this.currentWeapon.toUpperCase();
                this.renderWeaponIcon(this.currentWeapon);
                
                // Update weapon info
                if (infoElement) {
                    const weaponConfig = this.currentShipModel.weaponConfig[this.currentWeapon];
                    if (weaponConfig) {
                        infoElement.innerHTML =
                            `<span class="wi-part">DMG: ${weaponConfig.damage}</span>` +
                            `<span class="wi-part">${modeLabel}</span>` +
                            `<span class="wi-part">CD: ${weaponConfig.cooldown}ms</span>`;
                    } else {
                        infoElement.textContent = mode === 'charge'
                            ? 'Hold SPACE to charge, release to fire'
                            : 'Hold SPACE for autofire';
                    }
                }
            } else {
                // Legacy system
                const currentShotType = this.shotTypes[this.shotType];
                weaponElement.textContent = currentShotType.toUpperCase();
                this.renderWeaponIcon(currentShotType);
                if (infoElement) {
                    infoElement.textContent = mode === 'charge'
                        ? 'Hold SPACE to charge, release to fire'
                        : 'Hold SPACE for autofire';
                }
            }
        }
    }

    updateChargeHud() {
        const infoElement = document.getElementById('weaponInfo');
        if (!infoElement || !this.isCharging) return;
        const pct = Math.round(this.chargeLevel * 100);
        const bars = Math.max(1, Math.round(this.chargeLevel * 10));
        infoElement.textContent = `CHARGE ${pct}% [${'#'.repeat(bars)}${'-'.repeat(10 - bars)}] ×${this.getChargeMultiplier().toFixed(1)}`;
    }

    shoot(playerPosition, options) {
        const opts = Object.assign({}, options || {});
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
            const beatOpts = beatSyncManager.getShotOptions();
            if (beatOpts.beatPower) {
                const existing = opts.chargeMult != null ? opts.chargeMult : 1;
                opts.chargeMult = Math.max(existing, beatOpts.chargeMult || 1);
                opts.beatPower = true;
                if (beatOpts.cooldownMul) opts.cooldownMul = beatOpts.cooldownMul;
            }
        }
        const currentTime = Date.now();
        let shotFired = false;

        if (typeof playerManager !== 'undefined') {
            if (playerManager.isSystemsOnline && !playerManager.isSystemsOnline()) {
                return false;
            }
            const shotCost = playerManager.getShotEnergyCost
                ? playerManager.getShotEnergyCost()
                : 0;
            if (shotCost > 0 && !playerManager.spendEnergy(shotCost)) {
                return false;
            }
        }
        
        // Use ship-specific weapon system if available
        if (this.currentShipModel && this.currentShipModel.weaponConfig) {
            shotFired = this.shootWithShipWeapon(playerPosition, currentTime, opts);
        } else {
            // Fallback to old system
            shotFired = this.shootWithLegacySystem(playerPosition, opts);
        }

        // Refund energy if shot failed after spend
        if (!shotFired && typeof playerManager !== 'undefined' && playerManager.getShotEnergyCost) {
            const shotCost = playerManager.getShotEnergyCost();
            if (shotCost > 0 && playerManager.maxEnergy > 0) {
                playerManager.energy = Math.min(
                    playerManager.maxEnergy,
                    playerManager.energy + shotCost
                );
            }
        }
        
        // Play shooting sound only if a shot was actually fired
        if (shotFired && typeof soundManager !== 'undefined') {
            soundManager.playWeaponShoot(this.currentWeapon || 'laser');
            if (opts.beatPower && soundManager.createBeep) {
                soundManager.createBeep(1400, 0.04, 'square', 0.35);
            }
        }
        return !!shotFired;
    }

    shootWithShipWeapon(playerPosition, currentTime, options) {
        const opts = options || {};
        const weaponConfig = this.currentShipModel.weaponConfig[this.currentWeapon];
        if (!weaponConfig) return false;
        
        // Check cooldown
        let cooldown = weaponConfig.cooldown;
        if (typeof enemyManager !== 'undefined' && enemyManager.getJammerCooldownMul) {
            cooldown *= enemyManager.getJammerCooldownMul();
        }
        if (opts.cooldownMul && opts.cooldownMul > 0 && opts.cooldownMul < 1) {
            cooldown *= opts.cooldownMul;
        }
        if (currentTime - this.lastShotTime < cooldown) {
            return false;
        }
        
        let maxBullets = 6; // Increased for multi-weapon systems
        
        // Check for infinite ammo cheat
        if (typeof game !== 'undefined' && game.cheats && game.cheats.infiniteAmmo) {
            maxBullets = 999;
        }
        
        // Check if we can shoot based on current bullet count
        if (this.bullets.length >= maxBullets) {
            return false;
        }
        
        this.lastShotTime = currentTime;
        
        const cfg = Object.assign({}, weaponConfig);
        if (opts.chargeMult && opts.chargeMult > 1) {
            const cm = Math.min(1.75, opts.chargeMult);
            cfg.damage = Math.round((cfg.damage || 10) * opts.chargeMult);
            cfg.speed = (cfg.speed || 6) * (1 + (cm - 1) * 0.15);
            cfg.width = Math.max(cfg.width || 2, Math.round(2 * cm));
            cfg.height = Math.max(cfg.height || 8, Math.round(8 * (1 + (cm - 1) * 0.25)));
            cfg._charged = true;
            cfg._chargeMult = opts.chargeMult;
        }
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
            weaponConfigManager.clampWeaponShot(cfg);
        }
        this.fireWeaponByType(this.currentWeapon, playerPosition, cfg, false);
        return true;
    }

    fireWeaponByType(weaponId, position, config, isEnemy) {
        const id = String(weaponId || 'laser');
        let cfg = config || (typeof weaponConfigManager !== 'undefined'
            ? weaponConfigManager.getDefaultsForShip(id)
            : {});
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
            cfg = weaponConfigManager.clampWeaponShot(Object.assign({}, cfg));
        }
        if (isEnemy) {
            switch (id) {
                case 'spread':
                case 'burst':
                case 'nova':
                    this.enemyShootSpread(position, Object.assign({
                        bulletCount: id === 'nova' ? 5 : (id === 'burst' ? 2 : 2),
                        spreadAngle: id === 'nova' ? 0.5 : (id === 'burst' ? 0.4 : 0.3)
                    }, cfg));
                    break;
                case 'rapid':
                case 'ion':
                    this.enemyShootRapid(position, Object.assign({ bulletCount: 2 }, cfg));
                    break;
                case 'plasma':
                case 'missile':
                    this.enemyShootPlasma(position, cfg);
                    break;
                case 'wave':
                    this.enemyShootLaser(position, Object.assign({}, cfg, { typeHint: 'enemy_wave' }));
                    break;
                case 'pierce':
                    this.enemyShootLaser(position, Object.assign({}, cfg, { width: 2, height: 10 }));
                    break;
                default:
                    this.enemyShootLaser(position, cfg);
            }
            return;
        }
        switch (id) {
            case 'spread':
                this.shootSpreadWeapon(position, cfg);
                break;
            case 'rapid':
                this.shootRapidWeapon(position, cfg);
                break;
            case 'plasma':
                this.shootPlasma(position, cfg);
                break;
            case 'missile':
                this.shootMissile(position, cfg);
                break;
            case 'ion':
                this.shootIon(position, cfg);
                break;
            case 'wave':
                this.shootWave(position, cfg);
                break;
            case 'burst':
                this.shootBurst(position, cfg);
                break;
            case 'pierce':
                this.shootPierce(position, cfg);
                break;
            case 'nova':
                this.shootNova(position, cfg);
                break;
            case 'laser':
            default:
                this.shootLaser(position, cfg);
                break;
        }
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }
    
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
    }
    
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
    }
    
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
    }
    
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
    }
    
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
    }
    
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
    }

    getBullets() {
        return this.bullets;
    }

    getEnemyBullets() {
        return this.enemyBullets;
    }

    removeBullet(index) {
        this.bullets.splice(index, 1);
    }

    removeEnemyBullet(index) {
        this.enemyBullets.splice(index, 1);
    }

    switchShotType() {
        return this.switchWeapon();
    }

    getCurrentShotType() {
        if (this.currentShipModel && this.currentWeapon) {
            return this.currentWeapon;
        }
        return this.shotTypes[this.shotType];
    }

    getCurrentWeapon() {
        return this.currentWeapon;
    }

    getAvailableWeapons() {
        if (this.currentShipModel && this.currentShipModel.availableWeapons) {
            return this.currentShipModel.availableWeapons;
        }
        return this.shotTypes;
    }

    reset() {
        this.bullets.length = 0;
        this.enemyBullets.length = 0;
        this.shotType = 0;
        this.resetCharge();
        // Reset weapon display
        this.updateWeaponDisplay();
    }
}

// Global bullet manager instance
const bulletManager = new BulletManager();

// Make sure it's available globally
window.bulletManager = bulletManager;
