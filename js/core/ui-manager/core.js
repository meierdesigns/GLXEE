"use strict";

// UI management and menu handling
class UIManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.pauseMenuIndex = 0;
        this.pauseMenuItems = ['RESUME', 'SETTINGS', 'QUIT'];
        this.gameOverMenuIndex = 0;
        this.gameOverMenuItems = ['restart', 'mainMenu'];
        this.victoryMenuIndex = 0;
        this.victoryMenuItems = ['nextLevel', 'restartGame', 'levelSelection'];
        this._enemyBarKeys = '';
        this._playerShipIconKey = '';
        this._playerStatIconKey = '';
    }

    updateUI() {
        if (typeof playerManager !== 'undefined') {
            // Update player health bar via --health-width (used by .health-fill::before)
            const maxHp = playerManager.getMaxHealth() || 1;
            const playerHealthPercent = Math.max(0, Math.min(100, (playerManager.getHealth() / maxHp) * 100));
            const playerHealthBar = document.getElementById('playerHealthBar');
            if (playerHealthBar) {
                playerHealthBar.style.setProperty('--health-width', `${playerHealthPercent}%`);
            }

            const maxEnergy = playerManager.getMaxEnergy ? (playerManager.getMaxEnergy() || 1) : 1;
            const energy = playerManager.getEnergy ? playerManager.getEnergy() : 0;
            const energyPercent = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
            const playerEnergyBar = document.getElementById('playerEnergyBar');
            if (playerEnergyBar) {
                playerEnergyBar.style.setProperty('--health-width', `${energyPercent}%`);
            }

            const maxShield = playerManager.getShieldMax ? (playerManager.getShieldMax() || 0) : 0;
            const shield = playerManager.getShield ? playerManager.getShield() : 0;
            const shieldPercent = maxShield > 0
                ? Math.max(0, Math.min(100, (shield / maxShield) * 100))
                : 0;
            const playerShieldBar = document.getElementById('playerShieldBar');
            if (playerShieldBar) {
                playerShieldBar.style.setProperty('--health-width', `${shieldPercent}%`);
            }

            this.updatePlayerShipIcon();
            this.updatePlayerStatIcons();
        }

        if (typeof bulletManager !== 'undefined' && bulletManager.updateWeaponHudState) {
            bulletManager.updateWeaponHudState();
        }

        this.updateEnemyHealthBars();
    }

    updatePlayerShipIcon() {
        const canvas = document.getElementById('playerShipIcon');
        if (!canvas || typeof playerManager === 'undefined') return;
        const model = playerManager.getCurrentShipModel ? playerManager.getCurrentShipModel() : null;
        const key = (model ? (model.id || model.type || model.name || 'player') : '') + '|48nn';
        if (key === this._playerShipIconKey) return;
        this._playerShipIconKey = key;
        this.renderHealthShipIcon(canvas, model);
    }

    updatePlayerStatIcons() {
        if (typeof iconRenderer === 'undefined') return;
        const res = (id) => (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor)
            ? economyConfig.getResourceColor(id)
            : null;
        const energyTint = res('voltex') || '#c86ef0';
        const shieldTint = res('crystal') || '#6ec8e8';
        const key = energyTint + '|' + shieldTint + '|16raw';
        if (key === this._playerStatIconKey) return;
        this._playerStatIconKey = key;
        const energy = document.getElementById('playerEnergyIcon');
        const shield = document.getElementById('playerShieldIcon');
        // Native 16px sprite + CSS 3× pixelated — skip Scale2x/@4x (looks muddy).
        const paint = (el, iconKey, tint) => {
            if (!el) return;
            if (el.width !== 16) el.width = 16;
            if (el.height !== 16) el.height = 16;
            iconRenderer.drawToCanvas(el, iconKey, tint, false, false, false);
        };
        paint(energy, 'statEnergy', energyTint);
        paint(shield, 'statShield', shieldTint);
    }

    resolveEnemyFaction(type, factionId) {
        let id = factionId;
        if (!id && typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
            id = enemyConfigManager.getDefaultFaction(type);
        }
        id = String(id || 'pirate').toLowerCase();
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta) {
            return planetConfigManager.getFactionMeta(id);
        }
        return { id: id, label: id.toUpperCase() };
    }

    collectActiveEnemies() {
        const list = [];
        if (typeof enemyManager === 'undefined') return list;

        if (enemyManager.enemy && !enemyManager.exploding) {
            const maxHp = enemyManager.getMaxHealth() || 1;
            const hp = enemyManager.getHealth();
            if (hp > 0) {
                const e = enemyManager.enemy;
                const type = enemyManager.currentShipType || e.type || 'enemyBasic';
                const faction = this.resolveEnemyFaction(type, e.faction);
                list.push({
                    key: 'champion',
                    type: type,
                    model: enemyManager.currentEnemyModel || null,
                    health: hp,
                    maxHealth: maxHp,
                    shield: enemyManager.shield || 0,
                    shieldMax: enemyManager.shieldMax || 0,
                    shieldRegen: enemyManager.shieldRegen || 0,
                    factionId: faction.id,
                    factionLabel: faction.label,
                    faction: e.faction || faction.id,
                    enemyClass: e.enemyClass || null,
                    tier: e.tier != null ? e.tier : e.level,
                    width: e.width || 0,
                    height: e.height || 0,
                    level: e.level
                });
            }
        }

        const sides = enemyManager.getSideEnemies ? enemyManager.getSideEnemies() : [];
        for (let i = 0; i < sides.length; i++) {
            const side = sides[i];
            if (!side || side.health <= 0) continue;
            const type = side.type || 'enemyBasic';
            const faction = this.resolveEnemyFaction(type, side.faction);
            list.push({
                key: 'side_' + (side.entryId || i),
                type: type,
                model: null,
                health: side.health,
                maxHealth: side.maxHealth || side.health || 1,
                shield: side.shield || 0,
                shieldMax: side.shieldMax || 0,
                shieldRegen: side.shieldRegen || 0,
                factionId: faction.id,
                factionLabel: faction.label,
                faction: side.faction || faction.id,
                enemyClass: side.enemyClass || null,
                tier: side.tier != null ? side.tier : side.level,
                width: side.width || 0,
                height: side.height || 0,
                level: side.level
            });
        }
        return list;
    }

    enemyHudLayout(count) {
        const n = Math.max(0, count | 0);
        if (n <= 0) {
            return { rows: 1, cols: 1, barH: 16, iconSize: 22 };
        }
        // Right sidebar: fill height; larger bars/icons when few enemies
        if (n <= 2) return { rows: n, cols: 1, barH: 18, iconSize: 24 };
        if (n <= 4) return { rows: n, cols: 1, barH: 14, iconSize: 20 };
        if (n <= 6) return { rows: n, cols: 1, barH: 12, iconSize: 18 };
        return {
            rows: n,
            cols: 1,
            barH: Math.max(8, Math.min(12, Math.round(72 / n))),
            iconSize: 16
        };
    }

    updateEnemyHealthBars() {
        const container = document.getElementById('enemyHealthBars');
        if (!container) return;

        const enemies = this.collectActiveEnemies();
        const keys = enemies.map((e) =>
            e.key + ':' + (e.factionId || '') + ':' + (e.type || '') + ':' +
            (e.enemyClass || '') + ':' + (e.tier != null ? e.tier : '') + ':' +
            (e.width || '') + 'x' + (e.height || '') + ':' + (e.shieldMax > 0 ? 's' : '')
        ).join('|');
        const layout = this.enemyHudLayout(Math.max(enemies.length, 1));

        container.style.setProperty('--enemy-bar-h', layout.barH + 'px');
        container.style.setProperty('--enemy-icon-size', layout.iconSize + 'px');
        container.dataset.enemyCount = String(enemies.length);

        if (keys !== this._enemyBarKeys) {
            this._enemyBarKeys = keys;
            container.innerHTML = '';
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                const row = document.createElement('div');
                const isChampion = enemy.key === 'champion';
                row.className = 'health-bar enemy-health' + (isChampion ? ' is-champion' : ' is-side');
                row.dataset.enemyKey = enemy.key;
                row.dataset.faction = enemy.factionId || '';

                const factionEl = document.createElement('div');
                factionEl.className = 'enemy-faction';
                factionEl.textContent = enemy.factionLabel || 'UNKNOWN';

                const main = document.createElement('div');
                main.className = 'enemy-health-main';

                // Readable enemy portrait: big for the champion, rendered at
                // 2× so the pixel ship stays crisp in its framed box.
                const iconSize = isChampion ? 44 : 32;
                const icon = document.createElement('canvas');
                icon.className = 'health-ship-icon ui-icon-tip';
                icon.width = iconSize * 2;
                icon.height = iconSize * 2;
                icon.style.width = iconSize + 'px';
                icon.style.height = iconSize + 'px';
                icon.setAttribute('aria-hidden', 'true');

                const model = enemy.model
                    || (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getMergedModel
                        ? enemyConfigManager.getMergedModel(enemy.type)
                        : null);
                const tipName = (model && (model.name || model.id || model.type))
                    || enemy.type
                    || enemy.factionLabel
                    || 'ENEMY';

                const text = document.createElement('div');
                text.className = 'enemy-text';
                const nameEl = document.createElement('div');
                nameEl.className = 'enemy-name';
                nameEl.textContent = (isChampion ? 'BOSS · ' : '') + String(tipName).replace(/_/g, ' ').toUpperCase();
                text.appendChild(factionEl);
                text.appendChild(nameEl);

                const head = document.createElement('div');
                head.className = 'enemy-head';
                head.appendChild(icon);
                head.appendChild(text);

                const fill = document.createElement('div');
                fill.className = 'health-fill';
                fill.dataset.enemyKey = enemy.key;
                const hpText = document.createElement('span');
                hpText.className = 'enemy-hp-text';
                fill.appendChild(hpText);

                main.appendChild(fill);
                {
                    // Always show the shield row so unshielded ships read as such.
                    const sh = document.createElement('div');
                    sh.className = 'enemy-shield-fill';
                    const shText = document.createElement('span');
                    shText.className = 'enemy-shield-text';
                    sh.appendChild(shText);
                    main.appendChild(sh);
                }
                row.appendChild(head);
                row.appendChild(main);
                container.appendChild(row);
                icon.setAttribute('data-ui-tip', String(tipName).replace(/_/g, ' ').toUpperCase());
                this.renderEnemyHealthIcon(icon, enemy);
            }
        }

        const fills = container.querySelectorAll('.health-fill');
        for (let i = 0; i < fills.length; i++) {
            const fill = fills[i];
            const enemy = enemies[i];
            if (!enemy) continue;
            const pct = Math.max(0, Math.min(100, (enemy.health / (enemy.maxHealth || 1)) * 100));
            fill.style.setProperty('--health-width', pct + '%');
            const hpText = fill.querySelector('.enemy-hp-text');
            if (hpText) hpText.textContent = Math.max(0, Math.ceil(enemy.health)) + ' / ' + Math.ceil(enemy.maxHealth || 0);
            // Shield: level + a pulsing charge state while it refills.
            const sh = fill.parentNode && fill.parentNode.querySelector('.enemy-shield-fill');
            if (sh && !(enemy.shieldMax > 0)) {
                sh.classList.add('is-none');
                sh.style.setProperty('--shield-width', '0%');
                const t = sh.querySelector('.enemy-shield-text');
                if (t) t.textContent = 'NO SHIELD';
            } else if (sh) {
                const sp = Math.max(0, Math.min(100, (enemy.shield / enemy.shieldMax) * 100));
                const prev = Number(sh.dataset.prev || sp);
                sh.style.setProperty('--shield-width', sp + '%');
                sh.classList.toggle('is-charging', sp < 100 && sp > prev);
                sh.classList.toggle('is-down', sp <= 0);
                sh.dataset.prev = String(sp);
                const t = sh.querySelector('.enemy-shield-text');
                if (t) t.textContent = sp <= 0 ? 'SHIELD DOWN' : 'SH ' + Math.ceil(enemy.shield) + ' / ' + Math.ceil(enemy.shieldMax) +
                    (enemy.shieldRegen > 0 ? '  +' + (Math.round(enemy.shieldRegen * 10) / 10) + '/S' : '');
            }
        }
    }

    /** HUD portrait for a live enemy — same faction visual path as the playfield. */
    renderEnemyHealthIcon(canvas, enemy) {
        if (!canvas || !enemy) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pad = 4;
        const boxW = Math.max(8, canvas.width - pad * 2);
        const boxH = Math.max(8, canvas.height - pad * 2);
        // Keep the live footprint aspect so capitals don't look like scouts.
        let ew = Number(enemy.width) || 0;
        let eh = Number(enemy.height) || 0;
        if (!(ew > 0 && eh > 0) && enemy.model) {
            ew = enemy.model.width || 18;
            eh = enemy.model.height || 14;
        }
        if (!(ew > 0 && eh > 0)) {
            ew = 18;
            eh = 14;
        }
        const fit = Math.min(boxW / ew, boxH / eh);
        const dw = Math.max(8, Math.round(ew * fit));
        const dh = Math.max(8, Math.round(eh * fit));
        const dx = Math.floor((canvas.width - dw) / 2);
        const dy = Math.floor((canvas.height - dh) / 2);

        const ghost = {
            x: dx,
            y: dy,
            width: dw,
            height: dh,
            type: enemy.type,
            faction: enemy.faction || enemy.factionId,
            enemyClass: enemy.enemyClass,
            tier: enemy.tier,
            level: enemy.level
        };

        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            const prev = graphicsManager.currentEnemyModel;
            if (enemy.model) graphicsManager.currentEnemyModel = enemy.model;
            try {
                graphicsManager.renderEnemyShip(ctx, ghost, 1);
            } finally {
                graphicsManager.currentEnemyModel = prev;
            }
            return;
        }
        this.renderHealthShipIcon(canvas, enemy.model);
    }

    renderHealthShipIcon(canvas, shipModel) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Player HUD icon: 48×48 1:1. Enemy portraits keep their own backing size.
        if (canvas.id === 'playerShipIcon') {
            if (canvas.width !== 48) canvas.width = 48;
            if (canvas.height !== 48) canvas.height = 48;
        }
        ctx.imageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'low';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!shipModel) return;

        const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader)
            || (typeof shipAssetLoader !== 'undefined' ? shipAssetLoader : null);
        if (loader && loader.renderShip) {
            const shipW = shipModel.width || 16;
            const shipH = shipModel.height || 12;
            const fit = Math.max(1, Math.floor(Math.min(canvas.width / shipW, canvas.height / shipH)));
            const rw = shipW * fit;
            const rh = shipH * fit;
            const ox = Math.floor((canvas.width - rw) / 2);
            const oy = Math.floor((canvas.height - rh) / 2);
            loader.renderShip(ctx, shipModel, ox, oy, fit, null, 0);
            return;
        }

        if (typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
            shipRenderer.renderShipPreview(canvas, shipModel, 1);
        }
    }

    updateShotTypeDisplay(shotType) {
        const shotTypeElement = document.getElementById('shotType');
        if (shotTypeElement) {
            shotTypeElement.textContent = shotType.toUpperCase();
        }
    }

    handleGameOverInput(event) {
        event.preventDefault();

        switch (event.key) {
            case 'ArrowUp':
                this.gameOverMenuIndex = (this.gameOverMenuIndex - 1 + this.gameOverMenuItems.length) % this.gameOverMenuItems.length;
                this.updateGameOverMenuDisplay();
                break;
            case 'ArrowDown':
                this.gameOverMenuIndex = (this.gameOverMenuIndex + 1) % this.gameOverMenuItems.length;
                this.updateGameOverMenuDisplay();
                break;
            case 'Enter':
            case ' ':
                this.selectGameOverOption();
                break;
            case 'Escape':
                if (typeof game !== 'undefined') {
                    game.showLevelSelection();
                }
                break;
        }
    }
}
