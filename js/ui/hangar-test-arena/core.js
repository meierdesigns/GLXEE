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
}
