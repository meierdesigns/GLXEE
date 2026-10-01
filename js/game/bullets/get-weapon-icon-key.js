"use strict";

// BulletManager methods, split from bullets.js.
extendClass(BulletManager, {
    /** Remember a mount's shot so drawMuzzleFlashes can light it for a few frames. */
    addMuzzleFlash(slot, cfg) {
        if (!this.muzzleFlashes) this.muzzleFlashes = {};
        this.muzzleFlashes[slot.key] = {
            t: performance.now(),
            id: slot.id,
            muzzle: slot.muzzle,
            charged: !!(cfg && cfg._charged)
        };
        // Last shot per mount, kept past the flash (hangar preview recharge).
        if (!this.lastShots) this.lastShots = {};
        this.lastShots[slot.key] = { t: performance.now(), id: slot.id, muzzle: slot.muzzle };
    },

    /**
     * Muzzle flash + short barrel streak per weapon mount, in the weapon's UI
     * colour and a per-family shape. Drawn over the player ship, positioned
     * like getWeaponFirePositions so it lines up with the bullets.
     */
    drawMuzzleFlashes(ctx, player) {
        const flashes = this.muzzleFlashes;
        const layout = this.currentShipModel && this.currentShipModel.layout;
        if (!flashes || !layout || !player) return;
        const now = performance.now();
        // Same uniform fit + centring as renderPlayerShip / getWeaponFirePositions.
        const lw = Math.max(1, layout.width || player.width);
        const lh = Math.max(1, layout.height || player.height);
        const mw = Math.max(1, this.currentShipModel.width || lw);
        const mh = Math.max(1, this.currentShipModel.height || lh);
        const fit = Math.max(0.25, Math.min(player.width / mw, player.height / mh));
        const sx = fit * (mw / lw);
        const sy = fit * (mh / lh);
        player = {
            x: player.x - (mw * fit - player.width) / 2,
            y: player.y - (mh * fit - player.height) / 2,
            width: player.width,
            height: player.height
        };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.imageSmoothingEnabled = false;
        Object.keys(flashes).forEach((key) => {
            const f = flashes[key];
            const DUR = f.charged ? 260 : 140;
            const age = now - f.t;
            if (age > DUR) { delete flashes[key]; return; }
            const k = 1 - age / DUR;
            const color = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor
                && weaponConfigManager.getWeaponUiColor(f.id)) || '#ffffff';
            const x = Math.round(player.x + f.muzzle.lx * sx);
            const y = Math.round(player.y + f.muzzle.ly * sy);
            // Sized for readability at game scale (was 2–3 px and easy to miss).
            const w = Math.max(4, f.muzzle.lw * sx);
            // Capped relative to the ship so large previews don't blow it up.
            const sMax = Math.max(3, Math.round(player.width * 0.07 * (f.charged ? 1.6 : 1)));
            const s = Math.min(sMax, Math.max(3, Math.round(w * 1.1 * (f.charged ? 1.6 : 1) * (0.6 + 0.4 * k))));
            const px = Math.max(2, Math.round(s / 3));
            // Soft glow behind the shape.
            ctx.globalAlpha = k * 0.25;
            ctx.fillStyle = color;
            ctx.fillRect(x - s * 0.7, y - s, s * 1.4, s * 1.4);
            ctx.globalAlpha = k;
            ctx.fillStyle = color;
            const fam = String(f.id);
            if (fam === 'spread' || fam === 'spike_burst' || fam === 'claw_beam') {
                // Fan of three sparks.
                [-1, 0, 1].forEach((d) => ctx.fillRect(x + d * s - px / 2, y - s - Math.abs(d) * px, px, s));
            } else if (fam === 'ion') {
                // Triple ion stream: three parallel streaks, one per bolt.
                const gap = Math.max(px + 1, Math.round(s * 0.6));
                [-1, 0, 1].forEach((d) => ctx.fillRect(x + d * gap - px / 2, y - s * 1.8, px, s * 1.8));
                ctx.fillRect(x - gap - px / 2, y - px / 2, gap * 2 + px, px);
            } else if (fam === 'plasma' || fam === 'nova' || fam === 'wave') {
                // Round bloom / ring.
                ctx.fillRect(x - s, y - px, s * 2, px * 2);
                ctx.fillRect(x - px, y - s, px * 2, s * 2);
                ctx.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4);
            } else if (fam === 'missile') {
                // Launch smoke puff going back down.
                ctx.fillRect(x - s * 0.6, y, s * 1.2, s * 1.4);
            } else {
                // Beam / kinetic: tall cross flash with a barrel streak.
                ctx.fillRect(x - px / 2, y - s * 2, px, s * 2);
                ctx.fillRect(x - s * 0.6, y - px / 2, s * 1.2, px);
            }
            // White-hot core.
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = k * 0.9;
            ctx.fillRect(x - px / 2, y - px / 2, px, px);
        });
        ctx.restore();
    },

    /** Faction whose weapon affinity applies: the ship's own, else the pilot's profile. */
    getShipFactionId() {
        const m = this.currentShipModel;
        if (m && m.faction) return m.faction;
        if (m && m.id && typeof shipConfigManager !== 'undefined') {
            const cfg = shipConfigManager.getConfig(m.id);
            if (cfg && cfg.faction) return cfg.faction;
        }
        const p = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile)
            ? profileManager.getActiveProfile() : null;
        return (p && p.faction) || null;
    },

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
        if (typeof iconRenderer !== 'undefined' && iconRenderer.drawWeaponToCanvas) {
            iconRenderer.drawWeaponToCanvas(canvas, weaponType);
            return;
        }
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
        } else if (!opts.fireKey || opts.fireKey === 'all' || opts.fireKey === 'space') {
            // Fallback to old system (no weapon slots, so Space only)
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

        if (shotFired && typeof playerManager !== 'undefined' && playerManager.registerShot) {
            playerManager.registerShot();
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
            // The ALL key (default Space) fires every slot; any other key fires
            // only the slots assigned to it. Calls without a key fire all.
            if (opts.fireKey && opts.fireKey !== 'all' && (slot.fireKey || 'space') !== opts.fireKey) return;
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
            // Tag shots with their weapon so they render in its type colour.
            // Shot size follows the slot size class: S 0.6×, M 1×, L 1.5× the
            // weapon's base shot (at least 1 × 3 px, so S stays visible).
            // Preview close-ups fire at a zoomed ship: shotScale scales size
            // and speed by that zoom on top.
            const shotScale = Number(opts.shotScale) || 1;
            const sizeMul = ([0.6, 1, 1.5][slot.sizeLevel != null ? slot.sizeLevel : 1] || 1)
                * (powerShot ? powerShot.size : 1);
            for (let i = firstNew; i < this.bullets.length; i++) {
                const b = this.bullets[i];
                b.weaponId = slot.id;
                // 0..1 brightness boost from the charge / beat bonus.
                if (powerShot) b.bonusGlow = Math.max(b.bonusGlow || 0, 0.8);
                if (cfg._charged) b.bonusGlow = Math.max(0, Math.min(1, ((cfg._chargeMult || 1) - 1) / 0.75));
                const cx = b.x + (b.width || 0) / 2;
                // Whole pixels, or drawing rounds S up to M's width.
                b.width = Math.max(1, Math.round((b.width || 2) * sizeMul)) * shotScale;
                b.height = Math.max(3, Math.round((b.height || 8) * sizeMul)) * shotScale;
                if (shotScale !== 1) b.speed = (b.speed || 6) * shotScale;
                b.x = cx - b.width / 2;
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
