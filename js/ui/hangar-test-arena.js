"use strict";

/**
 * Hangar Test Arena — interactive flight / damage / defense sandbox.
 * Opened from hangar LIVE PREVIEW. Enemies limited to discovered types.
 */
class HangarTestArena {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this.shipId = 'player_scrap';
        this.onClose = null;
        this._animId = null;
        this._lastTs = 0;
        this._keys = Object.create(null);
        this._keyDown = null;
        this._keyUp = null;
        this._selectedEnemies = {};
        this._enemyRespawns = {};
        this._stats = { damageDealt: 0, damageTaken: 0, kills: 0, shots: 0 };
        this._elapsed = 0;
        this._respawnMs = 0;
        this._layoutMode = 'fullscreen';
        this.sim = null;
        this.canvas = null;
        this.ctx = null;
        // Match main playfield (gameStateManager: 240×300)
        this.W = 240;
        this.H = 300;
        this.SHIP_DRAW_SCALE = 1;
        this.ENEMY_HIT_SCALE = 1;
        this.RESPAWN_MS = 2000;
    }

    show(options) {
        const opts = options || {};
        this.shipId = opts.shipId || 'player_scrap';
        this.onClose = opts.onClose || null;
        this.isVisible = true;
        this._stats = { damageDealt: 0, damageTaken: 0, kills: 0, shots: 0 };
        this._elapsed = 0;
        this._respawnMs = 0;
        this._enemyRespawns = {};
        this._selectedEnemies = {};
        const discovered = this.getDiscoveredEnemies();
        if (discovered.length) {
            this._selectedEnemies[discovered[0].id] = true;
        }
        this.createUI();
        this.resetSim();
        this.syncEnemiesFromSelection();
        this.bindInput();
        this.startLoop();
    }

    hide() {
        this.isVisible = false;
        this.stopLoop();
        this.unbindInput();
        this.sim = null;
        this.canvas = null;
        this.ctx = null;
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    close() {
        const cb = this.onClose;
        this.hide();
        if (typeof cb === 'function') cb();
    }

    getDiscoveredEnemies() {
        let ids = [];
        if (typeof profileManager !== 'undefined' && profileManager.getDiscovered) {
            ids = profileManager.getDiscovered('enemies') || [];
        }
        return ids.map((id) => {
            const cfg = (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getConfig)
                ? enemyConfigManager.getConfig(id)
                : null;
            const name = (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDisplayName)
                ? enemyConfigManager.getDisplayName(id)
                : (cfg && cfg.name) || id;
            return {
                id,
                name: name || id,
                maxHealth: (cfg && cfg.maxHealth) || 100,
                armor: (cfg && cfg.armor) || 0,
                shieldMax: (cfg && cfg.shieldMax) || 0,
                damage: (cfg && (cfg.weaponDamage || cfg.damage)) || 10,
                speed: (cfg && cfg.speed) || 1.5,
                verticalSpeed: (cfg && cfg.verticalSpeed) || 0.35,
                shootInterval: (cfg && (cfg.weaponCooldown || cfg.shootInterval)) || 1200,
                weaponSpeed: (cfg && cfg.weaponSpeed) || 5,
                defenseMechanisms: (cfg && (cfg.defenseMechanisms || cfg.abilities)) || [],
                damageReduction: (cfg && cfg.damageReduction) || 0,
                reflectChance: (cfg && cfg.reflectChance) || 0,
                shieldRegen: (cfg && cfg.shieldRegen) || 0
            };
        });
    }

    getShipStats() {
        const shipId = this.shipId;
        const model = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId)
            : null;
        const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig)
            ? shipConfigManager.getConfig(shipId)
            : null;
        const loadout = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getLoadout)
            ? shipLoadoutManager.getLoadout(shipId)
            : { weapons: [], defenses: [], abilities: [], energy: [], fireMode: 'auto' };

        const defenses = (loadout.defenses || []).concat(loadout.abilities || []);
        const defStats = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.computeDefenseStats)
            ? shipLoadoutManager.computeDefenseStats(defenses)
            : { shieldMax: 0, shieldRegen: 0, damageReduction: 0, reflectChance: 0, mechs: defenses.slice() };
        const mechs = defStats.mechs;
        const chargeStats = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.computeChargeStats)
            ? shipLoadoutManager.computeChargeStats(defenses)
            : null;
        const energyStats = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.computeEnergyStats)
            ? shipLoadoutManager.computeEnergyStats(loadout)
            : { maxEnergy: 0, regen: 0, idleDraw: 0, shotCost: 4, chargePerSec: 12, shieldAbsorbPerDmg: 0.5, boostPerSec: 0, boostSpeedMul: 1 };
        const fireMode = (loadout.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto';

        const layout = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getLayout)
            ? shipLoadoutManager.getLayout(shipId)
            : null;
        const w = (layout && layout.width) || (model && model.width) || 20;
        const h = (layout && layout.height) || (model && model.height) || 16;

        // Weapon feel from loadout / weapon config (same source as bulletManager)
        let weaponDamage = Number((cfg && cfg.weaponDamage) || (model && model.damage) || 10);
        let weaponSpeed = Number((cfg && cfg.weaponSpeed) || 8);
        let weaponCooldown = Number((cfg && cfg.weaponCooldown) || 300);
        let bulletW = 3;
        let bulletH = 12;
        const weaponId = (loadout.weapons && loadout.weapons[0])
            || (cfg && cfg.defaultWeapon)
            || (model && model.defaultWeapon)
            || 'laser';
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getConfig) {
            const wc = weaponConfigManager.getConfig(weaponId);
            if (wc) {
                if (wc.damage != null) weaponDamage = Number(wc.damage);
                if (wc.speed != null) weaponSpeed = Number(wc.speed);
                if (wc.cooldown != null) weaponCooldown = Number(wc.cooldown);
                if (wc.width != null) bulletW = Number(wc.width);
                if (wc.height != null) bulletH = Number(wc.height);
            }
        }

        return {
            model: model || { width: w, height: h, name: shipId, type: 'player', id: shipId },
            // In-game: collision box = model size, draw scale 1 (see render.js)
            width: Math.max(8, Math.round(w)),
            height: Math.max(8, Math.round(h)),
            speed: Number((cfg && cfg.speed) || (model && model.speed) || 4),
            maxHealth: Number((cfg && cfg.maxHealth) || (model && model.maxHealth) || 100),
            armor: Number((cfg && cfg.armor) || (model && model.armor) || 0),
            weaponDamage,
            weaponSpeed,
            weaponCooldown,
            bulletW,
            bulletH,
            weaponId,
            fireMode: fireMode,
            chargeStats: chargeStats,
            shieldMax: defStats.shieldMax,
            shieldRegen: defStats.shieldRegen,
            defenseMechanisms: mechs,
            damageReduction: defStats.damageReduction,
            reflectChance: defStats.reflectChance,
            energyStats: energyStats
        };
    }

    createUI() {
        if (this.overlay) this.overlay.remove();
        const enemies = this.getDiscoveredEnemies();
        const enemyList = enemies.length
            ? enemies.map((e) => {
                const on = !!this._selectedEnemies[e.id];
                return `<label class="hta-enemy ${on ? 'on' : ''}">` +
                    `<input type="checkbox" data-hta-enemy="${e.id}" ${on ? 'checked' : ''}/>` +
                    `<span class="hta-enemy-name">${e.name}</span>` +
                    `<span class="hta-enemy-meta">HP ${e.maxHealth}` +
                    `${e.shieldMax ? ' · SH ' + e.shieldMax : ''}</span>` +
                    `</label>`;
            }).join('')
            : '<p class="hta-muted">NO ENEMIES DISCOVERED YET — PLAY A LEVEL FIRST</p>';

        this.overlay = document.createElement('div');
        this.overlay.className = 'hta-overlay';
        this.overlay.innerHTML = `
            <div class="hta-panel">
                <header class="hta-head">
                    <h2 class="hta-title">TEST AREA</h2>
                    <p class="hta-sub">LIVE LEVEL PREVIEW</p>
                    <button type="button" class="action-button secondary" id="htaToggleLayout">MODAL</button>
                    <button type="button" class="action-button secondary hta-close" id="htaClose">CLOSE</button>
                </header>
                <div class="hta-body">
                    <aside class="hta-side">
                        <h3 class="hta-side-title">ENEMY</h3>
                        <div class="hta-enemy-list">${enemyList}</div>
                        <p class="hta-hint">SELECT TO SWAP · AUTO RESPAWN 2s</p>
                        <div class="hta-stats" id="htaStats"></div>
                        <p class="hta-hint">WASD / ARROWS MOVE · SPACE FIRE · ESC CLOSE</p>
                    </aside>
                    <div class="hta-stage">
                        <canvas id="htaCanvas" class="hta-canvas" width="${this.W}" height="${this.H}"
                            aria-label="Hangar test arena"></canvas>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(this.overlay);
        this.applyLayoutMode();

        this.canvas = this.overlay.querySelector('#htaCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.renderStats();

        this.overlay.querySelector('#htaClose').addEventListener('click', () => this.close());
        const layoutBtn = this.overlay.querySelector('#htaToggleLayout');
        if (layoutBtn) {
            layoutBtn.addEventListener('click', () => this.toggleLayoutMode());
        }
        this.overlay.querySelectorAll('[data-hta-enemy]').forEach((input) => {
            input.addEventListener('change', () => {
                const id = input.getAttribute('data-hta-enemy');
                this._selectedEnemies[id] = !!input.checked;
                const lab = input.closest('.hta-enemy');
                if (lab) lab.classList.toggle('on', !!input.checked);
                this.syncEnemiesFromSelection();
            });
        });
    }

    applyLayoutMode() {
        if (!this.overlay) return;
        const fullscreen = this._layoutMode !== 'modal';
        this.overlay.classList.toggle('hta-fullscreen', fullscreen);
        this.overlay.classList.toggle('hta-modal', !fullscreen);
        const btn = this.overlay.querySelector('#htaToggleLayout');
        if (btn) btn.textContent = fullscreen ? 'MODAL' : 'FULLSCREEN';
    }

    toggleLayoutMode() {
        this._layoutMode = this._layoutMode === 'fullscreen' ? 'modal' : 'fullscreen';
        this.applyLayoutMode();
    }

    renderStats() {
        const el = this.overlay && this.overlay.querySelector('#htaStats');
        if (!el || !this.sim) return;
        const p = this.sim.player;
        const sec = Math.max(0.001, this._elapsed / 1000);
        const dps = (this._stats.damageDealt / sec).toFixed(1);
        el.innerHTML =
            `<div class="hta-stat-row"><span>HP</span><strong>${this._respawnMs > 0 ? 0 : Math.ceil(p.health)} / ${p.maxHealth}</strong></div>` +
            `<div class="hta-stat-row"><span>SHIELD</span><strong>${this._respawnMs > 0 ? 0 : Math.ceil(p.shield)} / ${p.shieldMax}</strong></div>` +
            `<div class="hta-stat-row"><span>ENERGY</span><strong>${this._respawnMs > 0 ? 0 : Math.ceil(p.energy || 0)} / ${p.maxEnergy || 0}</strong></div>` +
            `<div class="hta-stat-row"><span>ARMOR</span><strong>${p.armor}</strong></div>` +
            `<div class="hta-stat-row"><span>DMG OUT</span><strong>${Math.round(this._stats.damageDealt)}</strong></div>` +
            `<div class="hta-stat-row"><span>DPS</span><strong>${dps}</strong></div>` +
            `<div class="hta-stat-row"><span>DMG IN</span><strong>${Math.round(this._stats.damageTaken)}</strong></div>` +
            `<div class="hta-stat-row"><span>KILLS</span><strong>${this._stats.kills}</strong></div>` +
            (this._respawnMs > 0
                ? `<div class="hta-stat-row"><span>P RESPAWN</span><strong>${(this._respawnMs / 1000).toFixed(1)}s</strong></div>`
                : '') +
            (this.nextEnemyRespawnMs() > 0
                ? `<div class="hta-stat-row"><span>E RESPAWN</span><strong>${(this.nextEnemyRespawnMs() / 1000).toFixed(1)}s</strong></div>`
                : '');
    }

    nextEnemyRespawnMs() {
        let min = 0;
        Object.keys(this._enemyRespawns).forEach((id) => {
            const v = this._enemyRespawns[id];
            if (v > 0 && (min === 0 || v < min)) min = v;
        });
        return min;
    }

    resetSim() {
        const stats = this.getShipStats();
        const pw = stats.width;
        const ph = stats.height;
        this.sim = {
            player: {
                x: (this.W - pw) / 2,
                y: this.H - ph - 24,
                width: pw,
                height: ph,
                speed: stats.speed,
                health: stats.maxHealth,
                maxHealth: stats.maxHealth,
                armor: stats.armor,
                shield: stats.shieldMax,
                shieldMax: stats.shieldMax,
                shieldRegen: stats.shieldRegen,
                defenseMechanisms: stats.defenseMechanisms.slice(),
                damageReduction: stats.damageReduction,
                reflectChance: stats.reflectChance,
                weaponDamage: stats.weaponDamage,
                weaponSpeed: stats.weaponSpeed,
                weaponCooldown: stats.weaponCooldown,
                bulletW: stats.bulletW,
                bulletH: stats.bulletH,
                weaponId: stats.weaponId,
                fireMode: stats.fireMode,
                chargeStats: stats.chargeStats,
                cooldown: 0,
                charge: 0,
                charging: false,
                driveCharge: 0,
                driveCharging: false,
                driveBurstMs: 0,
                driveBurstLevel: 0,
                energy: (stats.energyStats && stats.energyStats.maxEnergy) || 0,
                maxEnergy: (stats.energyStats && stats.energyStats.maxEnergy) || 0,
                energyRegen: (stats.energyStats && stats.energyStats.regen) || 0,
                energyIdleDraw: (stats.energyStats && stats.energyStats.idleDraw) || 0,
                shotEnergyCost: (stats.energyStats && stats.energyStats.shotCost) || 0,
                chargeEnergyPerSec: (stats.energyStats && stats.energyStats.chargePerSec) || 0,
                shieldAbsorbEnergyPerDmg: (stats.energyStats && stats.energyStats.shieldAbsorbPerDmg) || 0.5,
                boostEnergyPerSec: (stats.energyStats && stats.energyStats.boostPerSec) || 0,
                energyStats: stats.energyStats,
                model: stats.model,
                invuln: 0
            },
            enemies: [],
            bullets: [],
            enemyBullets: [],
            hits: [],
            phase: 0
        };
        this._stats = { damageDealt: 0, damageTaken: 0, kills: 0, shots: 0 };
        this._elapsed = 0;
        this._respawnMs = 0;
        this._enemyRespawns = {};
        this.renderStats();
    }

    resetPlayerOnly() {
        if (!this.sim) return;
        const stats = this.getShipStats();
        const p = this.sim.player;
        p.health = stats.maxHealth;
        p.maxHealth = stats.maxHealth;
        p.armor = stats.armor;
        p.shield = stats.shieldMax;
        p.shieldMax = stats.shieldMax;
        p.shieldRegen = stats.shieldRegen;
        p.defenseMechanisms = stats.defenseMechanisms.slice();
        p.damageReduction = stats.damageReduction;
        p.reflectChance = stats.reflectChance;
        p.weaponDamage = stats.weaponDamage;
        p.weaponSpeed = stats.weaponSpeed;
        p.weaponCooldown = stats.weaponCooldown;
        p.bulletW = stats.bulletW;
        p.bulletH = stats.bulletH;
        p.weaponId = stats.weaponId;
        p.fireMode = stats.fireMode;
        p.chargeStats = stats.chargeStats;
        p.cooldown = 0;
        p.charge = 0;
        p.charging = false;
        p.driveCharge = 0;
        p.driveCharging = false;
        p.driveBurstMs = 0;
        p.driveBurstLevel = 0;
        p.energy = (stats.energyStats && stats.energyStats.maxEnergy) || 0;
        p.maxEnergy = (stats.energyStats && stats.energyStats.maxEnergy) || 0;
        p.energyRegen = (stats.energyStats && stats.energyStats.regen) || 0;
        p.energyIdleDraw = (stats.energyStats && stats.energyStats.idleDraw) || 0;
        p.shotEnergyCost = (stats.energyStats && stats.energyStats.shotCost) || 0;
        p.chargeEnergyPerSec = (stats.energyStats && stats.energyStats.chargePerSec) || 0;
        p.shieldAbsorbEnergyPerDmg = (stats.energyStats && stats.energyStats.shieldAbsorbPerDmg) || 0.5;
        p.boostEnergyPerSec = (stats.energyStats && stats.energyStats.boostPerSec) || 0;
        p.energyStats = stats.energyStats;
        p.invuln = 1500;
        p.x = (this.W - p.width) / 2;
        p.y = this.H - p.height - 24;
        this._respawnMs = 0;
        if (this.sim) {
            this.sim.enemyBullets = [];
            this.sim.bullets = [];
        }
        this.renderStats();
    }

    beginRespawn() {
        if (!this.sim || this._respawnMs > 0) return;
        const p = this.sim.player;
        p.health = 0;
        p.charging = false;
        p.charge = 0;
        this._respawnMs = this.RESPAWN_MS;
        this.sim.enemyBullets = [];
        this.sim.bullets = [];
        this.renderStats();
    }

    syncEnemiesFromSelection() {
        if (!this.sim) return;
        const selected = Object.keys(this._selectedEnemies).filter((id) => this._selectedEnemies[id]);
        this.sim.enemies = this.sim.enemies.filter((e) => selected.indexOf(e.id) !== -1);
        Object.keys(this._enemyRespawns).forEach((id) => {
            if (selected.indexOf(id) === -1) delete this._enemyRespawns[id];
        });
        selected.forEach((id) => {
            const alive = this.sim.enemies.some((e) => e.id === id);
            const pending = this._enemyRespawns[id] > 0;
            if (!alive && !pending) this.spawnEnemyById(id);
        });
    }

    queueEnemyRespawn(enemyId) {
        if (!enemyId || !this._selectedEnemies[enemyId]) return;
        this._enemyRespawns[enemyId] = this.RESPAWN_MS;
    }

    updateEnemyRespawns(dtMs) {
        const ids = Object.keys(this._enemyRespawns);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            this._enemyRespawns[id] -= dtMs;
            if (this._enemyRespawns[id] <= 0) {
                delete this._enemyRespawns[id];
                if (this._selectedEnemies[id] && this.sim && !this.sim.enemies.some((e) => e.id === id)) {
                    this.spawnEnemyById(id);
                }
            }
        }
    }

    spawnEnemyById(enemyId) {
        if (!this.sim || !enemyId) return;
        const def = this.getDiscoveredEnemies().find((e) => e.id === enemyId);
        if (!def) return;
        if (this.sim.enemies.some((e) => e.id === enemyId)) return;
        delete this._enemyRespawns[enemyId];

        const model = (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getMergedModel)
            ? enemyConfigManager.getMergedModel(def.id)
            : null;
        // Match enemies.js spawn: hitbox = model size, draw scale 1
        const mw = Math.max(8, Math.round(((model && model.width) || 16) * this.ENEMY_HIT_SCALE));
        const mh = Math.max(8, Math.round(((model && model.height) || 12) * this.ENEMY_HIT_SCALE));
        const selectedCount = Object.keys(this._selectedEnemies).filter((id) => this._selectedEnemies[id]).length;
        const slot = this.sim.enemies.length;
        const speed = Math.max(0.25, Number(def.speed) || 0.4);
        const vSpeed = Math.max(0.05, Number(def.verticalSpeed) || 0.25);
        let x;
        let y;
        if (selectedCount <= 1) {
            x = (this.W - mw) / 2;
            y = 36;
        } else {
            const col = slot % 3;
            const row = Math.floor(slot / 3);
            x = 16 + col * ((this.W - 32) / 3) + ((this.W - 32) / 6) - mw / 2;
            y = 28 + row * (mh + 14);
        }
        this.sim.enemies.push({
            id: def.id,
            name: def.name,
            type: def.id,
            x,
            y,
            width: mw,
            height: mh,
            health: def.maxHealth,
            maxHealth: def.maxHealth,
            armor: def.armor,
            shield: def.shieldMax,
            shieldMax: def.shieldMax,
            shieldRegen: def.shieldRegen || 0,
            defenseMechanisms: (def.defenseMechanisms || []).slice(),
            damageReduction: def.damageReduction || 0,
            reflectChance: def.reflectChance || 0,
            damage: def.damage,
            speed: speed * (Math.random() < 0.5 ? -1 : 1),
            verticalSpeed: vSpeed * (Math.random() < 0.5 ? -1 : 1),
            minY: 8,
            maxY: Math.max(40, this.H * 0.38 - mh),
            shootInterval: def.shootInterval,
            weaponSpeed: Math.max(2, Number(def.weaponSpeed) || 2.5),
            shootAcc: 400 + Math.random() * 600,
            model
        });
    }

    applyDefense(target, rawDamage) {
        const isPlayer = !!(this.sim && target === this.sim.player);
        const online = isPlayer && (target.maxEnergy || 0) > 0 && (target.energy || 0) > 0;
        const costPer = Math.max(0.01, Number(target.shieldAbsorbEnergyPerDmg) || 0.5);
        const maxAbs = (isPlayer && online) ? (target.energy / costPer) : (isPlayer ? 0 : Infinity);
        const savedShield = target.shield || 0;
        const usable = isPlayer ? Math.min(savedShield, maxAbs === Infinity ? savedShield : maxAbs) : savedShield;
        const proxy = Object.assign({}, target, { shield: usable });

        let rem;
        if (typeof enemyManager !== 'undefined' && enemyManager.applyDefenseToDamage) {
            rem = enemyManager.applyDefenseToDamage(proxy, rawDamage);
        } else {
            let dmg = Number(rawDamage) || 0;
            if (dmg <= 0) return 0;
            const mechs = proxy.defenseMechanisms || [];
            const reflect = (proxy.reflectChance || 0) / 100;
            if (reflect > 0 && Math.random() < reflect) return 0;
            let reduction = (proxy.damageReduction || 0) / 100;
            if (mechs.indexOf('massive_armor') !== -1) reduction = Math.min(0.75, reduction + 0.1);
            else if (mechs.indexOf('heavy_armor') !== -1) reduction = Math.min(0.75, reduction + 0.05);
            if (mechs.indexOf('adaptive_shield') !== -1) reduction = Math.min(0.75, reduction + 0.05);
            dmg *= (1 - Math.max(0, Math.min(0.75, reduction)));
            if (proxy.armor > 0) {
                const mitigation = Math.min(0.65, proxy.armor / (proxy.armor + 100));
                dmg *= (1 - mitigation);
            }
            dmg = Math.max(Math.max(1, Number(rawDamage) * 0.2), dmg);
            if (proxy.shield > 0) {
                const absorbed = Math.min(proxy.shield, dmg);
                proxy.shield -= absorbed;
                dmg -= absorbed;
            }
            rem = Math.max(0, dmg);
        }
        const used = Math.max(0, usable - (proxy.shield || 0));
        target.shield = savedShield - used;
        if (isPlayer && used > 0) {
            target.energy = Math.max(0, (target.energy || 0) - used * costPer);
        }
        return rem;
    }

    bindInput() {
        this.unbindInput();
        this._keyDown = (e) => {
            if (!this.isVisible) return;
            this._keys[e.key] = true;
            if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this._keys['Shift'] = true;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close();
                return;
            }
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
            }
        };
        this._keyUp = (e) => {
            if (!this.isVisible) return;
            this._keys[e.key] = false;
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (this.sim && this.sim.player.fireMode === 'charge' && this.sim.player.charging) {
                    this.releaseChargeShot();
                }
            }
            if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this._keys['Shift'] = false;
                if (this.sim && this.sim.player.driveCharging) {
                    this.releaseDriveCharge();
                }
            }
        };
        document.addEventListener('keydown', this._keyDown, true);
        document.addEventListener('keyup', this._keyUp, true);
    }

    unbindInput() {
        if (this._keyDown) {
            document.removeEventListener('keydown', this._keyDown, true);
            this._keyDown = null;
        }
        if (this._keyUp) {
            document.removeEventListener('keyup', this._keyUp, true);
            this._keyUp = null;
        }
        this._keys = Object.create(null);
    }

    startLoop() {
        this.stopLoop();
        this._lastTs = 0;
        const loop = (ts) => {
            if (!this.isVisible) return;
            if (!this._lastTs) this._lastTs = ts;
            const dt = Math.min(50, ts - this._lastTs);
            this._lastTs = ts;
            this.update(dt);
            this.draw();
            if (!this._statsAcc) this._statsAcc = 0;
            this._statsAcc += dt;
            if (this._statsAcc >= 200) {
                this._statsAcc = 0;
                this.renderStats();
            }
            this._animId = requestAnimationFrame(loop);
        };
        this._animId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
        this._lastTs = 0;
    }

    keyDown(name) {
        return !!(this._keys[name] || this._keys[name.toLowerCase()] || this._keys[name.toUpperCase()]);
    }

    releaseChargeShot() {
        const sim = this.sim;
        if (!sim) return;
        const p = sim.player;
        const cs = p.chargeStats || {};
        const maxMs = cs.maxChargeMs || 900;
        const minM = cs.minChargeMult || 1;
        const maxM = cs.maxChargeMult || 2.75;
        const t = Math.min(1, p.charge / maxMs);
        let mult = minM + (maxM - minM) * t;
        if (cs.shieldDivert) mult += (cs.divertShotBonus || 0) * t;
        p.charging = false;
        p.charge = 0;
        p.cooldown = p.weaponCooldown;
        const shotCost = p.shotEnergyCost || 0;
        if ((p.maxEnergy || 0) > 0 && (p.energy || 0) < shotCost) return;
        if (shotCost > 0) p.energy -= shotCost;
        const dmg = p.weaponDamage * mult;
        this.fireBullet(p, dmg, true);
    }

    releaseDriveCharge() {
        const sim = this.sim;
        if (!sim) return;
        const p = sim.player;
        p.driveCharging = false;
        p.driveCharge = 0;
        p.driveBurstMs = 0;
        p.driveBurstLevel = 0;
    }

    fireBullet(p, damage, charged) {
        const sim = this.sim;
        if (!sim) return;
        this._stats.shots += 1;
        const bw = charged ? Math.max(2, Math.round((p.bulletW || 2) * 1.25)) : (p.bulletW || 2);
        const bh = charged ? Math.max(8, Math.round((p.bulletH || 8) * 1.15)) : (p.bulletH || 8);
        const spd = p.weaponSpeed * (charged ? 1.15 : 1);
        sim.bullets.push({
            x: p.x + p.width / 2 - bw / 2,
            y: p.y,
            speed: spd,
            w: bw,
            h: bh,
            damage: damage,
            life: 2000
        });
    }

    update(dtMs) {
        const sim = this.sim;
        if (!sim) return;
        const frame = dtMs / 16.67;
        this._elapsed += dtMs;
        sim.phase += dtMs * 0.003;
        const p = sim.player;

        this.updateEnemyRespawns(dtMs);

        if (this._respawnMs > 0) {
            this._respawnMs -= dtMs;
            if (this._respawnMs <= 0) {
                this._respawnMs = 0;
                this.resetPlayerOnly();
            }
            this.updateEnemies(dtMs, frame, false);
            sim.bullets = [];
            sim.enemyBullets = [];
            sim.hits = sim.hits.filter((h) => {
                h.life -= dtMs;
                h.y -= 0.4 * frame;
                return h.life > 0;
            });
            return;
        }

        // Movement with Shift boost (energy-powered)
        const cs = p.chargeStats || {};
        const es = p.energyStats || {};
        const powered = (p.maxEnergy || 0) > 0 && (p.energy || 0) > 0;

        // Energy net regen
        if ((p.maxEnergy || 0) > 0) {
            let net = p.energyRegen || 0;
            if ((p.energy || 0) > 0) net -= (p.energyIdleDraw || 0);
            p.energy = Math.max(0, Math.min(p.maxEnergy, p.energy + net * (dtMs / 1000)));
        }

        const shift = this.keyDown('Shift') || this.keyDown('ShiftLeft') || this.keyDown('ShiftRight');
        let moveMul = 1;
        if (cs.driveCharge && shift && powered) {
            p.driveCharging = true;
            moveMul = cs.driveBoostMul || es.boostSpeedMul || 1.55;
            const drain = p.boostEnergyPerSec || cs.driveBoostDrainPerSec || 22;
            p.energy = Math.max(0, p.energy - drain * (dtMs / 1000));
            if (p.energy <= 0) p.driveCharging = false;
        } else {
            p.driveCharging = false;
        }
        const moveSpeed = p.speed * frame * moveMul;
        if (this.keyDown('ArrowLeft') || this.keyDown('a')) p.x -= moveSpeed;
        if (this.keyDown('ArrowRight') || this.keyDown('d')) p.x += moveSpeed;
        if (this.keyDown('ArrowUp') || this.keyDown('w')) p.y -= moveSpeed;
        if (this.keyDown('ArrowDown') || this.keyDown('s')) p.y += moveSpeed;

        const minY = this.H * 0.33;
        p.x = Math.max(0, Math.min(this.W - p.width, p.x));
        p.y = Math.max(minY, Math.min(this.H - p.height, p.y));

        if (p.invuln > 0) p.invuln -= dtMs;

        const diverting = !!(p.charging && cs.shieldDivert);
        if (!diverting && p.shieldMax > 0 && p.shieldRegen > 0 && p.shield < p.shieldMax) {
            p.shield = Math.min(p.shieldMax, p.shield + p.shieldRegen * (dtMs / 1000));
        }

        p.cooldown = Math.max(0, p.cooldown - dtMs);
        const space = this.keyDown(' ') || this.keyDown('Space');
        const systemsOnline = (p.maxEnergy || 0) > 0 && (p.energy || 0) > 0;
        if (p.fireMode === 'charge') {
            if (space && p.cooldown <= 0 && systemsOnline) {
                p.charging = true;
                const maxMs = cs.maxChargeMs || 900;
                p.charge = Math.min(maxMs, p.charge + dtMs);
                const chargeDrain = (p.chargeEnergyPerSec || 12) * (dtMs / 1000);
                p.energy = Math.max(0, p.energy - chargeDrain);
                if (p.energy <= 0) {
                    if (p.charge > 0.05 * maxMs) this.releaseChargeShot();
                    else {
                        p.charging = false;
                        p.charge = 0;
                    }
                }
                const level = Math.min(1, p.charge / maxMs);
                if (cs.shieldSync && cs.shieldFillPerSec > 0 && p.shieldMax > 0) {
                    p.shield = Math.min(p.shieldMax, p.shield + cs.shieldFillPerSec * level * (dtMs / 1000));
                }
                if (cs.shieldDivert) p.shield = 0;
            } else if (!space && p.charging) {
                this.releaseChargeShot();
            }
        } else if (space && p.cooldown <= 0 && systemsOnline) {
            const shotCost = p.shotEnergyCost || 0;
            if (shotCost <= 0 || p.energy >= shotCost) {
                if (shotCost > 0) p.energy -= shotCost;
                p.cooldown = p.weaponCooldown;
                this.fireBullet(p, p.weaponDamage, false);
            }
        }

        this.updateEnemies(dtMs, frame, true);

        // Player bullets — straight up (same as bulletManager default path)
        sim.bullets = sim.bullets.filter((b) => {
            b.y -= b.speed * frame;
            b.life -= dtMs;
            if (b.life <= 0 || b.y + b.h < 0 || b.x < 0 || b.x > this.W) return false;
            for (let i = sim.enemies.length - 1; i >= 0; i--) {
                const e = sim.enemies[i];
                if (this.hit(b, e)) {
                    const before = e.health + e.shield;
                    const rem = this.applyDefense(e, b.damage);
                    e.health -= rem;
                    const dealt = Math.max(0, before - (e.health + e.shield));
                    this._stats.damageDealt += dealt;
                    sim.hits.push({ x: e.x + e.width / 2, y: e.y + e.height / 2, life: 220, dmg: Math.round(dealt) });
                    if (e.health <= 0) {
                        this._stats.kills += 1;
                        const deadId = e.id;
                        sim.enemies.splice(i, 1);
                        this.queueEnemyRespawn(deadId);
                    }
                    return false;
                }
            }
            return true;
        });

        // Enemy bullets — straight down
        sim.enemyBullets = sim.enemyBullets.filter((b) => {
            b.y += b.speed * frame;
            b.life -= dtMs;
            if (b.life <= 0 || b.y > this.H || b.x < 0 || b.x > this.W) return false;
            if (p.invuln <= 0 && this.hit(b, p)) {
                const before = p.health + p.shield;
                const rem = this.applyDefense(p, b.damage);
                p.health = Math.max(0, p.health - rem);
                this._stats.damageTaken += Math.max(0, before - (p.health + p.shield));
                p.invuln = 400;
                if (p.charging && p.chargeStats && p.chargeStats.shieldSync) {
                    p.charge = 0;
                }
                sim.hits.push({ x: p.x + p.width / 2, y: p.y + p.height / 2, life: 220, dmg: Math.round(rem) });
                if (p.health <= 0) {
                    this.beginRespawn();
                }
                return false;
            }
            return true;
        });

        sim.hits = sim.hits.filter((h) => {
            h.life -= dtMs;
            h.y -= 0.4 * frame;
            return h.life > 0;
        });
    }

    updateEnemies(dtMs, frame, allowShoot) {
        const sim = this.sim;
        if (!sim) return;
        sim.enemies.forEach((e) => {
            // Match enemyManager: axis bounce with speed / verticalSpeed
            e.x += e.speed * frame;
            e.y += e.verticalSpeed * frame;
            if (e.x <= 0) {
                e.x = 0;
                e.speed = Math.abs(e.speed);
            } else if (e.x >= this.W - e.width) {
                e.x = this.W - e.width;
                e.speed = -Math.abs(e.speed);
            }
            if (e.y <= e.minY) {
                e.y = e.minY;
                e.verticalSpeed = Math.abs(e.verticalSpeed);
            } else if (e.y >= e.maxY) {
                e.y = e.maxY;
                e.verticalSpeed = -Math.abs(e.verticalSpeed);
            }
            if (e.shieldMax > 0 && e.shieldRegen > 0 && e.shield < e.shieldMax) {
                e.shield = Math.min(e.shieldMax, e.shield + e.shieldRegen * (dtMs / 1000));
            }
            if (!allowShoot) return;
            e.shootAcc -= dtMs;
            if (e.shootAcc <= 0) {
                e.shootAcc = e.shootInterval;
                const bw = 3;
                const bh = 12;
                sim.enemyBullets.push({
                    x: e.x + e.width / 2 - bw / 2,
                    y: e.y + e.height,
                    speed: Math.max(2.5, Number(e.weaponSpeed) || 2.5),
                    w: bw,
                    h: bh,
                    damage: e.damage,
                    life: 2500
                });
            }
        });
    }

    hit(a, b) {
        return a.x < b.x + b.width && a.x + a.w > b.x && a.y < b.y + b.height && a.y + a.h > b.y;
    }

    drawShip(ctx, model, entity, flip) {
        if (typeof graphicsManager !== 'undefined') {
            if (flip && graphicsManager.renderEnemyShip) {
                const prev = graphicsManager.currentEnemyModel;
                if (model) graphicsManager.currentEnemyModel = model;
                graphicsManager.renderEnemyShip(ctx, entity, this.SHIP_DRAW_SCALE);
                graphicsManager.currentEnemyModel = prev;
                return;
            }
            if (!flip && graphicsManager.renderPlayerShip) {
                const prev = graphicsManager.currentPlayerModel;
                if (model) graphicsManager.currentPlayerModel = model;
                graphicsManager.renderPlayerShip(ctx, entity, this.SHIP_DRAW_SCALE);
                graphicsManager.currentPlayerModel = prev;
                return;
            }
        }
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, entity.width);
            tmp.height = Math.max(1, entity.height);
            const m = model ? Object.assign({}, model) : { width: entity.width, height: entity.height };
            if (flip) m.forceEnemyOrientation = true;
            shipRenderer.renderShipPreview(tmp, m, 1);
            ctx.drawImage(tmp, Math.round(entity.x), Math.round(entity.y), entity.width, entity.height);
            return;
        }
        ctx.fillStyle = flip ? '#ff6688' : '#b44dff';
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
    }

    drawBar(ctx, x, y, w, ratio, color) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, Math.max(0, w * Math.min(1, ratio)), 3);
    }

    drawShieldHull(ctx, model, entity, flip, ratio, opts) {
        if (!(ratio > 0)) return;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.drawShieldHull) {
            graphicsManager.drawShieldHull(ctx, entity, ratio, flip, model, opts || null);
            return;
        }
        // Fallback: thin box if graphics manager unavailable
        ctx.strokeStyle = 'rgba(100,200,255,' + (0.35 + 0.4 * Math.min(1, ratio || 0)) + ')';
        ctx.strokeRect(entity.x - 2, entity.y - 2, entity.width + 4, entity.height + 4);
    }

    /** 0..1 — soft proximity fade for shield outline. */
    getShieldThreatProximity(entity, mode) {
        if (!entity || !this.sim) return 0;
        const radius = 72;
        let best = 0;
        const consider = (obj) => {
            if (!obj) return;
            const ox = (obj.x != null ? obj.x : 0) + ((obj.width != null ? obj.width : obj.w) || 0) / 2;
            const oy = (obj.y != null ? obj.y : 0) + ((obj.height != null ? obj.height : obj.h) || 0) / 2;
            const ex = entity.x + entity.width / 2;
            const ey = entity.y + entity.height / 2;
            const d = Math.sqrt((ox - ex) * (ox - ex) + (oy - ey) * (oy - ey));
            if (d >= radius) return;
            const t = 1 - (d / radius);
            const fade = t * t * (3 - 2 * t);
            if (fade > best) best = fade;
        };
        if (mode === 'enemy') {
            this.sim.bullets.forEach(consider);
            this.sim.enemyBullets.forEach((b) => { if (b.reflected) consider(b); });
        } else {
            this.sim.enemyBullets.forEach(consider);
            this.sim.bullets.forEach((b) => { if (b.reflected) consider(b); });
        }
        return best;
    }

    draw() {
        const ctx = this.ctx;
        const sim = this.sim;
        if (!ctx || !sim) return;
        const accent = (getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '#b44dff').trim() || '#b44dff';
        const bg = (getComputedStyle(document.documentElement).getPropertyValue('--current-background')
            || getComputedStyle(document.documentElement).getPropertyValue('--color-background')
            || '#0a0a0a').trim() || '#0a0a0a';
        const W = this.W;
        const H = this.H;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Match main playfield star scroll
        ctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue('--current-text') || '#e0e0e0').trim() || '#e0e0e0';
        for (let i = 0; i < 50; i++) {
            ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
            const sx = (i * 7) % W;
            const sy = ((i * 11) + sim.phase * 40) % H;
            ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1;

        sim.bullets.forEach((b) => {
            ctx.fillStyle = accent;
            ctx.fillRect(b.x, b.y, b.w, b.h);
        });
        sim.enemyBullets.forEach((b) => {
            ctx.fillStyle = '#ff5577';
            ctx.fillRect(b.x, b.y, b.w, b.h);
        });

        sim.enemies.forEach((e) => {
            this.drawShip(ctx, e.model, e, true);
            this.drawBar(ctx, e.x, e.y - 6, e.width, e.health / e.maxHealth, '#ff6677');
            if (e.shieldMax > 0) {
                this.drawBar(ctx, e.x, e.y - 3, e.width, e.shield / e.shieldMax, accent);
                const threat = this.getShieldThreatProximity(e, 'enemy');
                if (threat > 0.01) {
                    const strength = e.shield / e.shieldMax;
                    this.drawShieldHull(ctx, e.model, e, true, threat * (0.45 + 0.55 * strength));
                }
            }
        });

        const p = sim.player;
        if (this._respawnMs <= 0) {
            if (p.invuln > 0 && Math.floor(p.invuln / 60) % 2 === 0) {
                ctx.globalAlpha = 0.45;
            }
            this.drawShip(ctx, p.model, p, false);
            ctx.globalAlpha = 1;
            this.drawBar(ctx, p.x, p.y + p.height + 2, p.width, p.health / p.maxHealth, '#88ff88');
            if (p.shieldMax > 0) {
                this.drawBar(ctx, p.x, p.y + p.height + 5, p.width, p.shield / p.shieldMax, accent);
                const threat = this.getShieldThreatProximity(p, 'player');
                const cs = p.chargeStats || {};
                const maxMs = cs.maxChargeMs || 900;
                const level = p.charging ? Math.min(1, p.charge / maxMs) : 0;
                const syncVis = !!(p.charging && cs.shieldSync && p.shield > 0);
                if (threat > 0.01 || syncVis) {
                    const strength = p.shield / p.shieldMax;
                    const pulseSpeed = 2 + level * 6;
                    const pulse = syncVis
                        ? (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(Date.now() / 1000 * pulseSpeed * Math.PI * 2)))
                        : 1;
                    const thick = syncVis ? (2 + Math.round(level * 3)) : 2;
                    const base = syncVis
                        ? Math.max(threat, 0.35 + 0.55 * level)
                        : threat;
                    this.drawShieldHull(
                        ctx, p.model, p, false,
                        base * (0.45 + 0.55 * strength),
                        syncVis ? { thick: thick, pulse: pulse } : null
                    );
                }
            }
            if (p.charging && p.charge > 0) {
                const maxMs = (p.chargeStats && p.chargeStats.maxChargeMs) || 900;
                const r = Math.min(1, p.charge / maxMs);
                ctx.fillStyle = accent;
                ctx.globalAlpha = 0.35 + r * 0.5;
                ctx.fillRect(p.x + p.width / 2 - 1, p.y - 12 - r * 10, 2, 8 + r * 10);
                ctx.globalAlpha = 1;
            }
        }

        sim.hits.forEach((h) => {
            ctx.globalAlpha = Math.max(0.2, h.life / 220);
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('-' + h.dmg, h.x, h.y);
        });
        ctx.globalAlpha = 1;
    }
}

const hangarTestArena = new HangarTestArena();
window.hangarTestArena = hangarTestArena;
