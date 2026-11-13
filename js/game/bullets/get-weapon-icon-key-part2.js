"use strict";

// BulletManager members, continued from get-weapon-icon-key.js (kept under ~500 lines per file).
extendClass(BulletManager, {
    shootWithShipWeapon(playerPosition, currentTime, options) {
        const opts = options || {};
        let maxBullets = 18; // Shared cap across all weapon mounts on the ship
        if (typeof game !== 'undefined' && game.cheatSystem && game.cheatSystem.cheats && game.cheatSystem.cheats.infiniteAmmo) {
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
            // The ALL key (default Space) fires every slot; any other key fires
            // only the slots assigned to it. Calls without a key fire all.
            const slotKeys = slot.keys || ['space'];
            if (opts.fireKey && opts.fireKey !== 'all') {
                if (slotKeys.indexOf(opts.fireKey) === -1) return;
            } else if (opts.fireKey === 'all' && slotKeys.indexOf('space') === -1
                && (((this.currentShipModel.loadout || {}).allFireKey) || 'space') === 'space') {
                return;
            }
            // Weapons slotted later aren't in the ship's own weaponConfig
            // (built from its stock weapons): use the weapon's defaults.
            const weaponConfig = this.currentShipModel.weaponConfig[slot.id]
                || (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getDefaultsForShip
                    ? weaponConfigManager.getDefaultsForShip(slot.id) : null);
            if (!weaponConfig) return;
            // Ability effects (ability-stats.js): higher fire rate = shorter cooldown.
            const abilityRate = Number(this.currentShipModel.abilityFireRateMul) || 1;
            let cooldown = weaponConfig.cooldown * jammerMul / abilityRate;
            // RAPID FIRE power-up (power-crates.js).
            if (typeof pickupManager !== 'undefined' && pickupManager.getFireRateMul) cooldown *= pickupManager.getFireRateMul();
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
            // Hull class: weapons the ship type is built around hit harder.
            const classMul = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getShipClassWeaponMul
                ? weaponConfigManager.getShipClassWeaponMul(this.currentShipModel.modelClass, slot.id) : 1;
            // Faction: each faction fights best with one weapon family.
            const factionMul = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getFactionWeaponMul
                ? weaponConfigManager.getFactionWeaponMul(this.getShipFactionId(), slot.id) : 1;
            const abilityDmg = Number(this.currentShipModel.abilityDamageMul) || 1;
            // Temporary power-up from supply crates.
            const powerShot = (typeof pickupManager !== 'undefined' && pickupManager.getPowerShot)
                ? pickupManager.getPowerShot() : null;
            const powerMul = powerShot ? powerShot.damage : 1;
            cfg.damage = Math.max(1, Math.round((cfg.damage || 10) * mountMul * classMul * factionMul * abilityDmg * powerMul));
            if (opts.chargeMult && opts.chargeMult > 1) {
                const cm = Math.min(1.75, opts.chargeMult);
                cfg.damage = Math.round((cfg.damage || 10) * opts.chargeMult);
                cfg.speed = (cfg.speed || 6) * (1 + (cm - 1) * 0.15);
                // Bonus shots keep their size; they are drawn brighter instead
                // (bullet.bonusGlow, see drawBullet).
                cfg._charged = true;
                cfg._chargeMult = opts.chargeMult;
            }
            if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.clampWeaponShot) {
                weaponConfigManager.clampWeaponShot(cfg);
            }
            const firstNew = this.bullets.length;
            this.fireWeaponByType(slot.id, slot.position, cfg, false);
            // Same size path as enemy shots: fit to the drawn gun barrel, then
            // Settings → Player Shots. Mount frame × WEAPON_DRAW_SCALE (1.4) is
            // the on-screen gun width; slot S/M/L is already in the mount size.
            const shotScale = Number(opts.shotScale) || 1;
            const gunW = Math.max(1, (slot.position && slot.position.width) || 4) * 1.4;
            this.fitBulletsToBarrel(this.bullets, firstNew, gunW, slot.id);
            this.applyShotSizeSetting(this.bullets, firstNew, 'player');
            const powerSize = powerShot ? powerShot.size : 1;
            for (let i = firstNew; i < this.bullets.length; i++) {
                const b = this.bullets[i];
                b.weaponId = slot.id;
                // Only weapons with EQUIPMENT → REFLECT purchased clash with enemy fire.
                b.reflectiveShots = !!cfg.reflectiveShots;
                // Spread-family CHAIN unlock: hits temporarily slow the target.
                b.chainSlow = !!cfg.chainSlow;
                // 0..1 brightness boost from the charge / beat bonus.
                if (powerShot) b.bonusGlow = Math.max(b.bonusGlow || 0, 0.8);
                if (cfg._charged) b.bonusGlow = Math.max(0, Math.min(1, ((cfg._chargeMult || 1) - 1) / 0.75));
                if (powerSize !== 1) {
                    const cx = b.x + (b.width || 0) / 2;
                    b.width = Math.max(1, (b.width || 2) * powerSize);
                    b.height = Math.max(3, (b.height || 8) * powerSize);
                    b.x = cx - b.width / 2;
                }
                // Hangar close-up: mount width is already zoomed, so only speed
                // needs shotScale (size comes from barrel fit).
                if (shotScale !== 1) b.speed = (b.speed || 6) * shotScale;
            }
            if (slot.muzzle) this.addMuzzleFlash(slot, cfg);
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
                case 'spike_burst':
                    this.enemyShootSpread(position, Object.assign({
                        bulletCount: id === 'nova' ? 5 : (id === 'spike_burst' ? 4 : (id === 'burst' ? 2 : 2)),
                        spreadAngle: id === 'nova' ? 0.5 : (id === 'spike_burst' ? 0.45 : (id === 'burst' ? 0.4 : 0.3))
                    }, cfg));
                    break;
                case 'rapid':
                case 'ion':
                case 'laser_twin':
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
                case 'railgun':
                case 'claw_beam':
                    this.enemyShootLaser(position, Object.assign({ width: 2, height: 10 }, cfg));
                    break;
                default:
                    this.enemyShootLaser(position, cfg);
            }
            return;
        }
        switch (id) {
            case 'claw_beam':
                this.shootClawBeam(position, cfg);
                break;
            case 'spread':
                this.shootSpreadWeapon(position, cfg);
                break;
            case 'rapid':
            case 'laser_twin':
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
            case 'spike_burst':
                this.shootBurst(position, cfg);
                break;
            case 'pierce':
            case 'railgun':
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
