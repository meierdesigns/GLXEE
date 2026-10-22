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
    /**
     * Side-view pixel art of a weapon on a 48×16 grid: the barrel comes from the weapon type,
     * the receiver shape and paint from the faction, glowing parts in the weapon's UI colour.
     */
    renderWeaponArt(weaponId, canvas, factionId) {
        if (!canvas || !canvas.getContext) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 48;
        canvas.height = 16;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 48, 16);
        const id = String(weaponId || 'laser').toLowerCase();
        const kind = ({ claw_beam: 'ion', spike_burst: 'spread', laser_twin: 'burst', railgun: 'pierce', normal: 'laser' })[id] || id;
        const faction = String(factionId || 'terran').toLowerCase();
        // body dark / mid / light, trim
        const pal = ({
            terran: ['#2a3442', '#53657c', '#9fb3c8', '#e0c060'],
            kronax: ['#3a1612', '#7a2e1e', '#c0643a', '#e8b040'],
            voidborn: ['#1c1230', '#45306e', '#8a6cc8', '#5ff0d0'],
            pirate: ['#2e1d10', '#6a4424', '#a8743e', '#d8b048'],
            machine: ['#1a2020', '#3d4a4a', '#7c8e8a', '#7cff6a']
        })[faction] || ['#2a3442', '#53657c', '#9fb3c8', '#e0c060'];
        const [dk, md, lt, trim] = pal;
        const glow = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor
            && weaponConfigManager.getWeaponUiColor(weaponId)) || '#7fe8ff';
        const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
        // Barrel helper: a shaded horizontal tube.
        const tube = (x, y, w, h) => { r(x, y, w, h, md); r(x, y, w, 1, lt); r(x, y + h - 1, w, 1, dk); };

        // Receiver per faction.
        if (faction === 'kronax') {
            r(3, 4, 18, 9, dk); r(4, 5, 16, 7, md); r(4, 5, 16, 1, lt);
            r(6, 12, 4, 3, dk); r(14, 12, 6, 2, trim);           // grip + blade under the barrel
            r(2, 3, 2, 2, trim); r(20, 3, 2, 2, trim);           // spikes
        } else if (faction === 'voidborn') {
            r(5, 5, 15, 7, dk); r(4, 6, 17, 5, md); r(6, 5, 12, 1, lt);
            r(3, 7, 1, 3, md); r(8, 12, 3, 2, md);
            r(9, 7, 3, 3, trim);                                  // organic core
        } else if (faction === 'pirate') {
            r(1, 8, 8, 4, md); r(1, 8, 8, 1, lt); r(0, 9, 1, 3, dk); // wooden stock
            r(8, 5, 13, 7, dk); r(9, 6, 11, 5, md); r(9, 6, 11, 1, lt);
            r(11, 12, 3, 3, dk); r(12, 5, 1, 7, trim); r(17, 5, 1, 7, trim);
        } else if (faction === 'machine') {
            for (let i = 0; i < 3; i++) { r(3 + i * 6, 4, 5, 9, dk); r(4 + i * 6, 5, 3, 7, md); r(4 + i * 6, 5, 3, 1, lt); }
            r(5, 7, 1, 1, trim); r(11, 7, 1, 1, trim); r(17, 7, 1, 1, trim); // status LEDs
            r(9, 13, 4, 2, dk);
        } else {
            r(2, 7, 6, 4, md); r(2, 7, 6, 1, lt);                // stock
            r(7, 4, 15, 9, dk); r(8, 5, 13, 7, md); r(8, 5, 13, 1, lt);
            r(10, 12, 3, 3, dk); r(15, 7, 4, 2, trim);
        }

        // Barrel per weapon type, from x = 21 to the muzzle.
        if (kind === 'rapid') {
            r(21, 4, 4, 9, dk); r(22, 5, 2, 7, trim);            // drum
            [5, 8, 11].forEach((y) => { tube(25, y - 1, 18, 2); r(43, y - 1, 1, 2, glow); });
        } else if (kind === 'spread') {
            tube(21, 6, 10, 5);
            r(31, 4, 11, 2, md); r(31, 7, 13, 3, md); r(31, 11, 11, 2, md);
            r(42, 4, 2, 2, glow); r(44, 7, 2, 3, glow); r(42, 11, 2, 2, glow);
        } else if (kind === 'plasma') {
            tube(21, 4, 20, 9);
            for (let x = 24; x < 38; x += 3) r(x, 5, 1, 7, glow); // coil
            r(41, 5, 3, 7, dk); r(44, 6, 2, 5, glow);
        } else if (kind === 'missile') {
            r(21, 3, 20, 11, dk); r(22, 4, 18, 9, md); r(22, 4, 18, 1, lt);
            [5, 9].forEach((y) => { r(40, y, 4, 3, dk); r(44, y, 2, 3, glow); r(36, y + 1, 4, 1, trim); });
        } else if (kind === 'ion') {
            tube(21, 6, 14, 5);
            r(35, 3, 9, 2, md); r(35, 12, 9, 2, md); r(35, 5, 2, 7, dk); // prongs
            r(38, 6, 1, 1, glow); r(40, 8, 1, 1, glow); r(42, 9, 1, 1, glow); r(39, 10, 1, 1, glow); r(44, 7, 1, 3, glow);
        } else if (kind === 'wave') {
            tube(21, 6, 13, 5);
            r(34, 3, 2, 11, md); r(36, 2, 2, 13, lt); r(38, 4, 1, 9, glow); r(40, 6, 1, 5, glow); r(42, 7, 1, 3, glow);
        } else if (kind === 'burst') {
            tube(21, 4, 21, 3); tube(21, 9, 21, 3); r(28, 7, 3, 2, dk);
            r(42, 4, 2, 3, glow); r(42, 9, 2, 3, glow);
        } else if (kind === 'pierce') {
            r(21, 4, 25, 2, lt); r(21, 11, 25, 2, lt); r(21, 6, 25, 1, dk); r(21, 10, 25, 1, dk);
            r(22, 7, 23, 3, glow); for (let x = 25; x < 44; x += 5) r(x, 4, 1, 9, trim);
        } else if (kind === 'nova') {
            tube(21, 6, 9, 5);
            r(31, 3, 11, 11, dk); r(32, 4, 9, 9, md); r(34, 5, 5, 7, glow); r(33, 7, 7, 3, glow); r(35, 6, 2, 2, '#ffffff');
            r(42, 7, 3, 3, md);
        } else {
            tube(21, 6, 22, 4); r(30, 5, 6, 6, dk); r(31, 6, 4, 4, trim);
            r(43, 6, 2, 4, md); r(45, 7, 2, 2, glow);
        }
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
            const pct = (st.ready * 100).toFixed(1) + '%';
            const title = st.noEnergy
                ? 'NOT ENOUGH ENERGY'
                : (st.reloading ? ('RELOAD ' + Math.round(st.ready * 100) + '%') : '');
            // Skip identical DOM writes — this runs every combat frame.
            if (card._vfHudDim !== dim) { card._vfHudDim = dim; card.classList.toggle('is-dim', dim); }
            if (card._vfHudRel !== st.reloading) { card._vfHudRel = st.reloading; card.classList.toggle('is-reloading', st.reloading); }
            if (card._vfHudNoE !== st.noEnergy) { card._vfHudNoE = st.noEnergy; card.classList.toggle('is-no-energy', st.noEnergy); }
            if (card._vfHudPct !== pct) { card._vfHudPct = pct; card.style.setProperty('--reload-pct', pct); }
            if (card._vfHudTitle !== title) { card._vfHudTitle = title; card.title = title; }
            // Charge cells: reload progress, or the hold-to-charge level on the active weapon.
            const charging = !!(this.isCharging && card.classList.contains('is-active'));
            const lvl = charging ? Math.max(0, Math.min(1, this.chargeLevel || 0)) : st.ready;
            const lit = Math.floor(lvl * 5 + 1e-6);
            if (card._vfHudChg !== charging) { card._vfHudChg = charging; card.classList.toggle('is-charging', charging); }
            if (card._vfHudPips !== lit) {
                card._vfHudPips = lit;
                const cells = card.querySelectorAll('.weapon-card-pips > i');
                for (let i = 0; i < cells.length; i++) cells[i].classList.toggle('is-on', i < lit);
            }
        });
    },
    /** Vertical list of equipped weapons as cards (name + side-view weapon art; stats on hover). */
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
        const idSig = ids.join('|') + '@' + mode + '@' + (this.getShipFactionId() || '');
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
            canvas.width = 48;
            canvas.height = 16;
            canvas.className = 'weapon-card-art';
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

            const art = document.createElement('div');
            art.className = 'weapon-card-artbox';
            art.appendChild(canvas);
            // Charge cells on the receiver: they light up one by one as the weapon reloads / charges.
            const pips = document.createElement('div');
            pips.className = 'weapon-card-pips';
            for (let p = 0; p < 5; p++) pips.appendChild(document.createElement('i'));
            art.appendChild(pips);

            // Name, then the weapon art; stats only on hover.
            body.appendChild(label);
            body.appendChild(art);
            body.appendChild(stats);
            card.appendChild(fill);
            card.appendChild(body);
            list.appendChild(card);
            this.renderWeaponArt(id, canvas, this.getShipFactionId());
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
        // FREEZE trap (power-crates.js): guns are locked too.
        if (typeof pickupManager !== 'undefined' && pickupManager.isFrozen && pickupManager.isFrozen()) return false;
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
});
