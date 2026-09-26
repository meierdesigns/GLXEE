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

        this.updateEnemyHealthBars();
    }

    updatePlayerShipIcon() {
        const canvas = document.getElementById('playerShipIcon');
        if (!canvas || typeof playerManager === 'undefined') return;
        const model = playerManager.getCurrentShipModel ? playerManager.getCurrentShipModel() : null;
        const key = model ? (model.id || model.type || model.name || 'player') : '';
        if (key === this._playerShipIconKey) return;
        this._playerShipIconKey = key;
        this.renderHealthShipIcon(canvas, model);
    }

    updatePlayerStatIcons() {
        if (typeof iconRenderer === 'undefined') return;
        const tint = (iconRenderer.getThemeTint && iconRenderer.getThemeTint()) || '#ffffff';
        const key = String(tint);
        if (key === this._playerStatIconKey) return;
        this._playerStatIconKey = key;
        const energy = document.getElementById('playerEnergyIcon');
        const shield = document.getElementById('playerShieldIcon');
        if (energy) iconRenderer.drawToCanvas(energy, 'statEnergy', tint);
        if (shield) iconRenderer.drawToCanvas(shield, 'statShield', tint);
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
                const type = enemyManager.currentShipType || 'enemyBasic';
                const faction = this.resolveEnemyFaction(
                    type,
                    enemyManager.enemy.faction
                );
                list.push({
                    key: 'champion',
                    type: type,
                    model: enemyManager.currentEnemyModel || null,
                    health: hp,
                    maxHealth: maxHp,
                    factionId: faction.id,
                    factionLabel: faction.label
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
                factionId: faction.id,
                factionLabel: faction.label
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
        const keys = enemies.map((e) => e.key + ':' + (e.factionId || '')).join('|');
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
                row.appendChild(head);
                row.appendChild(main);
                container.appendChild(row);
                icon.setAttribute('data-ui-tip', String(tipName).replace(/_/g, ' ').toUpperCase());
                this.renderHealthShipIcon(icon, model);
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
        }
    }

    renderHealthShipIcon(canvas, shipModel) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!shipModel) return;

        if (typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
            shipRenderer.renderShipPreview(canvas, shipModel, 1);
            return;
        }

        const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader)
            || (typeof shipAssetLoader !== 'undefined' ? shipAssetLoader : null);
        if (loader && loader.renderShip) {
            const shipW = shipModel.width || 16;
            const shipH = shipModel.height || 12;
            const fit = Math.min(canvas.width / shipW, canvas.height / shipH);
            const rw = shipW * fit;
            const rh = shipH * fit;
            const ox = (canvas.width - rw) / 2;
            const oy = (canvas.height - rh) / 2;
            loader.renderShip(ctx, shipModel, ox, oy, fit, null, 0);
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
