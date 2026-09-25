"use strict";

// HangarTestArena methods, split from hangar-test-arena.js.
extendClass(HangarTestArena, {
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
    },

    nextEnemyRespawnMs() {
        let min = 0;
        Object.keys(this._enemyRespawns).forEach((id) => {
            const v = this._enemyRespawns[id];
            if (v > 0 && (min === 0 || v < min)) min = v;
        });
        return min;
    },

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
    },

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
    },

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
    },

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
    },

    queueEnemyRespawn(enemyId) {
        if (!enemyId || !this._selectedEnemies[enemyId]) return;
        this._enemyRespawns[enemyId] = this.RESPAWN_MS;
    },

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
    },

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
    },
});
