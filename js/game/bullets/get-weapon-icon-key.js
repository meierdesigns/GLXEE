"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
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
    },

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
    },

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
    },

    updateChargeHud() {
        const infoElement = document.getElementById('weaponInfo');
        if (!infoElement || !this.isCharging) return;
        const pct = Math.round(this.chargeLevel * 100);
        const bars = Math.max(1, Math.round(this.chargeLevel * 10));
        infoElement.textContent = `CHARGE ${pct}% [${'#'.repeat(bars)}${'-'.repeat(10 - bars)}] ×${this.getChargeMultiplier().toFixed(1)}`;
    },

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
    },

    shootWithShipWeapon(playerPosition, currentTime, options) {
        const opts = options || {};
        let maxBullets = 6; // Increased for multi-weapon systems
        if (typeof game !== 'undefined' && game.cheats && game.cheats.infiniteAmmo) {
            maxBullets = 999;
        }

        const jammerMul = (typeof enemyManager !== 'undefined' && enemyManager.getJammerCooldownMul)
            ? enemyManager.getJammerCooldownMul()
            : 1;

        // Every equipped weapon fires simultaneously from its own mount,
        // each gated by its own cooldown clock — a twin-cannon loadout
        // fires both guns independently rather than cycling one at a time.
        let firedAny = false;
        this.getWeaponFirePositions(playerPosition).forEach((slot) => {
            const weaponConfig = this.currentShipModel.weaponConfig[slot.id];
            if (!weaponConfig) return;
            let cooldown = weaponConfig.cooldown * jammerMul;
            if (opts.cooldownMul && opts.cooldownMul > 0 && opts.cooldownMul < 1) {
                cooldown *= opts.cooldownMul;
            }
            const lastFired = this.weaponCooldowns[slot.key] || 0;
            if (currentTime - lastFired < cooldown) return;
            if (this.bullets.length >= maxBullets) return;

            this.weaponCooldowns[slot.key] = currentTime;
            this.lastShotTime = currentTime;

            const cfg = Object.assign({}, weaponConfig);
            // Mount strength: a nose weapon is one concentrated gun (+25%);
            // a wing weapon is split across both wings and weaker: 45% per
            // side (90% for the pair) — the nose gun always hits hardest.
            const mountMul = slot.mount === 'wing' ? 0.45 : 1.25;
            cfg.damage = Math.max(1, Math.round((cfg.damage || 10) * mountMul));
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
            this.fireWeaponByType(slot.id, slot.position, cfg, false);
            firedAny = true;
        });
        return firedAny;
    },

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
    },
});
