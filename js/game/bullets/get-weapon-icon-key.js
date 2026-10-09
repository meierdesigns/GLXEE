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
            const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
            const cell = cv && cv.cell ? cv.cell() : null;
            const fill = (rx, ry, rw, rh, c, a) => {
                if (cv && cv.fill) cv.fill(ctx, rx, ry, rw, rh, c, a);
                else {
                    ctx.globalAlpha = a == null ? 1 : a;
                    ctx.fillStyle = c;
                    ctx.fillRect(Math.round(rx), Math.round(ry), Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh)));
                }
            };
            let x = player.x + f.muzzle.lx * sx;
            let y = player.y + f.muzzle.ly * sy;
            if (cell) {
                x = Math.round(x / cell) * cell;
                y = Math.round(y / cell) * cell;
            } else {
                x = Math.round(x);
                y = Math.round(y);
            }
            // Sized for readability at game scale (was 2–3 px and easy to miss).
            const w = Math.max(4, f.muzzle.lw * sx);
            // Capped relative to the ship so large previews don't blow it up.
            const sMax = Math.max(3, Math.round(player.width * 0.07 * (f.charged ? 1.6 : 1)));
            let s = Math.min(sMax, Math.max(3, Math.round(w * 1.1 * (f.charged ? 1.6 : 1) * (0.6 + 0.4 * k))));
            let px = Math.max(2, Math.round(s / 3));
            if (cell) {
                s = Math.max(cell, Math.round(s / cell) * cell);
                px = Math.max(cell, Math.round(px / cell) * cell);
            }
            // Soft glow behind the shape — skipped in VOXEL.
            if (!cell) {
                ctx.globalAlpha = k * 0.25;
                ctx.fillStyle = color;
                ctx.fillRect(x - s * 0.7, y - s, s * 1.4, s * 1.4);
            }
            const fam = String(f.id);
            if (fam === 'spread' || fam === 'spike_burst' || fam === 'claw_beam') {
                [-1, 0, 1].forEach((d) => fill(x + d * s - px / 2, y - s - Math.abs(d) * px, px, s, color, k));
            } else if (fam === 'ion') {
                const gap = Math.max(px + (cell || 1), Math.round(s * 0.6));
                [-1, 0, 1].forEach((d) => fill(x + d * gap - px / 2, y - s * 1.8, px, s * 1.8, color, k));
                fill(x - gap - px / 2, y - px / 2, gap * 2 + px, px, color, k);
            } else if (fam === 'plasma' || fam === 'nova' || fam === 'wave') {
                fill(x - s, y - px, s * 2, px * 2, color, k);
                fill(x - px, y - s, px * 2, s * 2, color, k);
                fill(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4, color, k);
            } else if (fam === 'missile') {
                fill(x - s * 0.6, y, s * 1.2, s * 1.4, color, k);
            } else {
                fill(x - px / 2, y - s * 2, px, s * 2, color, k);
                fill(x - s * 0.6, y - px / 2, s * 1.2, px, color, k);
            }
            fill(x - px / 2, y - px / 2, px, px, '#ffffff', k * 0.9);
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

    renderWeaponIcon(weaponType, canvas) {
        const el = canvas || document.getElementById('weaponIcon');
        if (!el) return;
        const key = this.getWeaponIconKey(weaponType);
        if (typeof iconRenderer !== 'undefined' && iconRenderer.drawWeaponToCanvas) {
            iconRenderer.drawWeaponToCanvas(el, weaponType);
            return;
        }
        if (typeof iconRenderer !== 'undefined') {
            let tint = null;
            try {
                tint = getComputedStyle(document.documentElement).getPropertyValue('--current-primary').trim() || null;
            } catch (e) { /* ignore */ }
            iconRenderer.drawToCanvas(el, key, tint || '#00FFCC');
            return;
        }
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.fillStyle = '#00FFCC';
        ctx.fillRect(6, 6, 4, 4);
    },

    weaponConfigFor(weaponId) {
        const id = weaponId || this.currentWeapon;
        if (this.currentShipModel && this.currentShipModel.weaponConfig
            && this.currentShipModel.weaponConfig[id]) {
            return this.currentShipModel.weaponConfig[id];
        }
        if (typeof weaponConfigManager !== 'undefined') {
            if (weaponConfigManager.getDefaultsForShip) {
                const d = weaponConfigManager.getDefaultsForShip(id);
                if (d) return d;
            }
            if (weaponConfigManager.getWeapon) {
                const w = weaponConfigManager.getWeapon(id);
                if (w) return w;
            }
        }
        return null;
    },

    weaponStatsHtml(weaponId) {
        const mode = this.getFireMode ? this.getFireMode() : 'auto';
        const modeLabel = mode === 'charge' ? 'CHARGE' : 'AUTO';
        const cfg = this.weaponConfigFor(weaponId);
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const ic = (key) => (ir && ir.imgHtml)
            ? ir.imgHtml(key, 14, 'wi-icon', undefined, false)
            : '';
        if (!cfg) {
            return `<span class="wi-part"><span class="wi-val">${modeLabel}</span></span>`;
        }
        const modeKey = mode === 'charge' ? 'statEnergy' : 'navCrosshair';
        return `<span class="wi-part" title="DAMAGE">${ic('statDamage')}<span class="wi-val">${cfg.damage}</span></span>` +
            `<span class="wi-sep" aria-hidden="true">·</span>` +
            `<span class="wi-part" title="${modeLabel}">${ic(modeKey)}<span class="wi-val">${modeLabel}</span></span>` +
            `<span class="wi-sep" aria-hidden="true">·</span>` +
            `<span class="wi-part" title="COOLDOWN ${cfg.cooldown}ms">${ic('navClock')}<span class="wi-val">${cfg.cooldown}</span></span>`;
    },

    /** Effective cooldown ms for a weapon (same multipliers as shooting). */
    effectiveCooldownMs(weaponId) {
        const cfg = this.weaponConfigFor(weaponId);
        if (!cfg) return 300;
        const jammerMul = (typeof enemyManager !== 'undefined' && enemyManager.getJammerCooldownMul)
            ? enemyManager.getJammerCooldownMul()
            : 1;
        const abilityRate = Number(this.currentShipModel && this.currentShipModel.abilityFireRateMul) || 1;
        let cooldown = Number(cfg.cooldown) || 300;
        cooldown = cooldown * jammerMul / Math.max(0.05, abilityRate);
        if (typeof pickupManager !== 'undefined' && pickupManager.getFireRateMul) {
            cooldown *= pickupManager.getFireRateMul();
        }
        return Math.max(1, cooldown);
    },

    /** Mount cooldown keys for a weapon id (mirrors getWeaponFirePositions keys). */
    weaponMountKeys(weaponId) {
        const id = String(weaponId || '');
        if (!id) return [];
        const model = this.currentShipModel;
        const layout = model && model.layout;
        const modules = layout && Array.isArray(layout.modules)
            ? layout.modules.filter((m) => m && m.kind === 'weapon' && String(m.id) === id)
            : [];
        if (!modules.length) return [id];
        return modules.map((m) => String(m.id || '') + '@' + String(m.face || 'up')
            + (m.slotIndex != null ? '#' + m.slotIndex : '') + (m.side ? ':' + m.side : ''));
    },

    /**
     * Ready fraction 0→1 (reload fill), energy cost, and flags for HUD dimming.
     * Uses the slowest mount of that weapon type.
     */
    getWeaponHudState(weaponId, nowMs) {
        const now = nowMs != null ? nowMs : Date.now();
        const cd = this.effectiveCooldownMs(weaponId);
        const keys = this.weaponMountKeys(weaponId);
        const clocks = this.weaponCooldowns || {};
        let ready = 1;
        keys.forEach((key) => {
            const last = clocks[key] || 0;
            const elapsed = now - last;
            const frac = last <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / cd));
            if (frac < ready) ready = frac;
        });
        const cfg = this.weaponConfigFor(weaponId);
        let energyCost = cfg && cfg.energyCost != null ? Math.max(0, Number(cfg.energyCost) || 0) : 0;
        if (!energyCost && typeof playerManager !== 'undefined' && playerManager.getShotEnergyCost) {
            energyCost = playerManager.getShotEnergyCost();
        }
        let energy = Infinity;
        if (typeof playerManager !== 'undefined') {
            if (playerManager.isSystemsOnline && !playerManager.isSystemsOnline()) energy = 0;
            else if (playerManager.getEnergy) energy = playerManager.getEnergy();
        }
        const noEnergy = energyCost > 0 && energy + 1e-6 < energyCost;
        const reloading = ready < 0.999;
        return { ready: ready, reloading: reloading, noEnergy: noEnergy, energyCost: energyCost };
    },

    /** Dim cards + drive reload fill (--reload-pct) without rebuilding the list. */
    updateWeaponHudState() {
        const list = document.getElementById('weaponList');
        if (!list) return;
        const now = Date.now();
        list.querySelectorAll('.weapon-card').forEach((card) => {
            const id = card.dataset.weapon;
            if (!id) return;
            const st = this.getWeaponHudState(id, now);
            const dim = st.reloading || st.noEnergy;
            card.classList.toggle('is-dim', dim);
            card.classList.toggle('is-reloading', st.reloading);
            card.classList.toggle('is-no-energy', st.noEnergy);
            card.style.setProperty('--reload-pct', (st.ready * 100).toFixed(1) + '%');
            card.title = st.noEnergy
                ? 'NOT ENOUGH ENERGY'
                : (st.reloading ? ('RELOAD ' + Math.round(st.ready * 100) + '%') : '');
        });
    },

    /** Vertical list of equipped weapons as unified cards (icon + name + stats). */
    renderWeaponList() {
        const list = document.getElementById('weaponList');
        if (!list) return;
        let ids = [];
        if (this.currentShipModel && Array.isArray(this.currentShipModel.availableWeapons)
            && this.currentShipModel.availableWeapons.length) {
            ids = this.currentShipModel.availableWeapons.slice();
        } else if (typeof levelInfoManager !== 'undefined' && levelInfoManager.collectEquippedWeapons) {
            ids = levelInfoManager.collectEquippedWeapons().map((w) => w.id);
        }
        if (!ids.length) {
            ids = [this.currentWeapon || (this.shotTypes && this.shotTypes[this.shotType]) || 'laser'];
        }
        const seen = {};
        ids = ids.filter((id) => id && !seen[id] && (seen[id] = true));
        const active = String(this.currentWeapon || ids[0] || '').toLowerCase();
        const mode = this.getFireMode ? this.getFireMode() : 'auto';
        const idSig = ids.join('|') + '@' + mode;
        if (idSig === this._weaponListIdSig && list.childElementCount === ids.length) {
            list.querySelectorAll('.weapon-card').forEach((card) => {
                const on = String(card.dataset.weapon || '').toLowerCase() === active;
                card.classList.toggle('is-active', on);
                const stats = card.querySelector('.weapon-card-stats');
                if (stats) {
                    if (on) stats.id = 'weaponInfo';
                    else stats.removeAttribute('id');
                    if (!this.isCharging) stats.innerHTML = this.weaponStatsHtml(card.dataset.weapon);
                }
            });
            this.updateWeaponHudState();
            return;
        }
        this._weaponListIdSig = idSig;
        list.innerHTML = '';
        ids.forEach((id) => {
            const name = (typeof iconRenderer !== 'undefined' && iconRenderer.weaponIconInfo)
                ? iconRenderer.weaponIconInfo(id).name
                : String(id).toUpperCase();
            const on = String(id).toLowerCase() === active;
            const card = document.createElement('div');
            card.className = 'weapon-card' + (on ? ' is-active' : '');
            card.dataset.weapon = id;

            const fill = document.createElement('div');
            fill.className = 'weapon-card-reload';
            fill.setAttribute('aria-hidden', 'true');

            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            canvas.className = 'weapon-card-icon';
            canvas.setAttribute('aria-hidden', 'true');

            const body = document.createElement('div');
            body.className = 'weapon-card-body';
            const label = document.createElement('span');
            label.className = 'weapon-card-name';
            label.textContent = String(name).toUpperCase();
            const stats = document.createElement('div');
            stats.className = 'weapon-card-stats';
            if (on) stats.id = 'weaponInfo';
            stats.innerHTML = this.weaponStatsHtml(id);

            body.appendChild(label);
            body.appendChild(stats);
            card.appendChild(fill);
            card.appendChild(canvas);
            card.appendChild(body);
            list.appendChild(card);
            this.renderWeaponIcon(id, canvas);
        });
        this.updateWeaponHudState();
    },

    updateWeaponDisplay() {
        const weaponElement = document.getElementById('currentWeapon');
        this.renderWeaponList();

        if (this.currentShipModel && this.currentShipModel.availableWeapons) {
            if (weaponElement) weaponElement.textContent = this.currentWeapon.toUpperCase();
            this.renderWeaponIcon(this.currentWeapon);
        } else {
            const currentShotType = this.shotTypes[this.shotType];
            if (weaponElement) weaponElement.textContent = currentShotType.toUpperCase();
            this.renderWeaponIcon(currentShotType);
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
            // Shot size: slot class (S/M/L) × Settings → Player Shots.
            // Applied after spawn so clampBulletSize cannot crush the setting.
            const shotScale = Number(opts.shotScale) || 1;
            const appearanceMul = (typeof uiAppearanceManager !== 'undefined'
                && uiAppearanceManager.getShotSizeMul)
                ? uiAppearanceManager.getShotSizeMul('player') : 1;
            const sizeMul = ([0.6, 1, 1.5][slot.sizeLevel != null ? slot.sizeLevel : 1] || 1)
                * (powerShot ? powerShot.size : 1)
                * appearanceMul;
            for (let i = firstNew; i < this.bullets.length; i++) {
                const b = this.bullets[i];
                b.weaponId = slot.id;
                // 0..1 brightness boost from the charge / beat bonus.
                if (powerShot) b.bonusGlow = Math.max(b.bonusGlow || 0, 0.8);
                if (cfg._charged) b.bonusGlow = Math.max(0, Math.min(1, ((cfg._chargeMult || 1) - 1) / 0.75));
                const cx = b.x + (b.width || 0) / 2;
                // Keep fractional sizes so S→XXL stays visible (not snapped to 1–3).
                b.width = Math.max(1, (b.width || 2) * sizeMul) * shotScale;
                b.height = Math.max(3, (b.height || 8) * sizeMul) * shotScale;
                if (shotScale !== 1) b.speed = (b.speed || 6) * shotScale;
                if (b.lightRadius) b.lightRadius = Math.max(6, b.lightRadius * Math.sqrt(Math.max(0.3, appearanceMul)));
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
