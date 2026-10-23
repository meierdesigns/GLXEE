"use strict";

// UI management and menu handling
const ENEMY_CARD_MAX = 2; // hero cards in the enemy sidebar (champion + toughest side craft)
const ENEMY_HIT_FACE_MS = 900; // pain / anger face after a hit
const ENEMY_DEAD_FACE_MS = 3000; // a defeated enemy's card lingers this long with the dead face

class UIManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.pauseMenuIndex = 0;
        this.pauseMenuItems = ['RESUME', 'SETTINGS', 'QUIT'];
        this.gameOverMenuIndex = 0;
        this.gameOverMenuItems = ['restart', 'mainMenu'];
        this.victoryMenuIndex = 0;
        this.victoryMenuItems = ['nextLevel', 'levelSelection'];
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
            if (playerHealthBar && this._uiHpPct !== playerHealthPercent) {
                this._uiHpPct = playerHealthPercent;
                playerHealthBar.style.setProperty('--health-width', `${playerHealthPercent}%`);
            }

            const maxEnergy = playerManager.getMaxEnergy ? (playerManager.getMaxEnergy() || 1) : 1;
            const energy = playerManager.getEnergy ? playerManager.getEnergy() : 0;
            const energyPercent = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
            const playerEnergyBar = document.getElementById('playerEnergyBar');
            if (playerEnergyBar && this._uiEnPct !== energyPercent) {
                this._uiEnPct = energyPercent;
                playerEnergyBar.style.setProperty('--health-width', `${energyPercent}%`);
            }

            const maxShield = playerManager.getShieldMax ? (playerManager.getShieldMax() || 0) : 0;
            const shield = playerManager.getShield ? playerManager.getShield() : 0;
            const shieldPercent = maxShield > 0
                ? Math.max(0, Math.min(100, (shield / maxShield) * 100))
                : 0;
            const playerShieldBar = document.getElementById('playerShieldBar');
            if (playerShieldBar && this._uiShPct !== shieldPercent) {
                this._uiShPct = shieldPercent;
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
            const e = enemyManager.enemy;
            // The stage's main enemy always gets a card, whatever its class; side craft only when elite / capital.
            if (hp > 0) {
                const type = enemyManager.currentShipType || e.type || 'enemyBasic';
                const faction = this.resolveEnemyFaction(type, e.faction);
                list.push({
                    key: 'champion',
                    isBoss: !!e.isBoss,
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
            if (!side || side.health <= 0 || !this.isCardClass(side.enemyClass)) continue;
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

    /** Elite / capital ships get a sidebar card; scout / assault / heavy are single-purpose craft without one. */
    isCardClass(enemyClass) {
        const c = String(enemyClass || '').toLowerCase();
        return c === 'elite' || c === 'capital';
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

        // Only the most important heroes get a card: the champion first, then the toughest side craft.
        const enemies = this.withDefeatedEnemies(this.collectActiveEnemies())
            .sort((a, b) => (b.key === 'champion') - (a.key === 'champion') || (b.maxHealth || 0) - (a.maxHealth || 0))
            .slice(0, ENEMY_CARD_MAX);
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
                container.appendChild(this.buildEnemyCard(enemies[i]));
            }
        }

        const cards = container.querySelectorAll('.enemy-card-v');
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const fill = card.querySelector('.health-fill');
            const enemy = enemies[i];
            if (!enemy || !fill) continue;
            this.updateEnemyFace(card, enemy);
            const pct = Math.max(0, Math.min(100, (enemy.health / (enemy.maxHealth || 1)) * 100));
            const hpLabel = Math.max(0, Math.ceil(enemy.health)) + ' / ' + Math.ceil(enemy.maxHealth || 0);
            if (fill._vfHpPct !== pct) {
                fill._vfHpPct = pct;
                fill.style.setProperty('--health-width', pct + '%');
            }
            const hpText = fill.querySelector('.enemy-hp-text');
            if (hpText && hpText._vfHpLabel !== hpLabel) {
                hpText._vfHpLabel = hpLabel;
                hpText.textContent = hpLabel;
                fill.title = 'HULL ' + hpLabel;
            }
            // Shield: level + a pulsing charge state while it refills.
            const sh = card.querySelector('.enemy-shield-fill');
            if (sh && !(enemy.shieldMax > 0)) {
                if (!sh.classList.contains('is-none')) sh.classList.add('is-none');
                if (sh._vfShPct !== 0) {
                    sh._vfShPct = 0;
                    sh.style.setProperty('--shield-width', '0%');
                }
                const t = sh.querySelector('.enemy-shield-text');
                if (t && t._vfShLabel !== 'NO SHIELD') { t._vfShLabel = 'NO SHIELD'; t.textContent = 'NO SHIELD'; }
            } else if (sh) {
                const sp = Math.max(0, Math.min(100, (enemy.shield / enemy.shieldMax) * 100));
                const prev = Number(sh.dataset.prev || sp);
                if (sh._vfShPct !== sp) {
                    sh._vfShPct = sp;
                    sh.style.setProperty('--shield-width', sp + '%');
                }
                sh.classList.toggle('is-charging', sp < 100 && sp > prev);
                sh.classList.toggle('is-down', sp <= 0);
                sh.dataset.prev = String(sp);
                const t = sh.querySelector('.enemy-shield-text');
                const shLabel = sp <= 0 ? 'SHIELD DOWN' : 'SH ' + Math.ceil(enemy.shield) + ' / ' + Math.ceil(enemy.shieldMax) +
                    (enemy.shieldRegen > 0 ? '  +' + (Math.round(enemy.shieldRegen * 10) / 10) + '/S' : '');
                if (t && t._vfShLabel !== shLabel) { t._vfShLabel = shLabel; t.textContent = shLabel; sh.title = shLabel; }
            }
        }
    }

    /**
     * A card whose enemy was just destroyed stays for a moment with the dead face instead of vanishing.
     * Defeated entries come back with health 0 and `defeated: true`.
     */
    withDefeatedEnemies(list) {
        const now = performance.now();
        const gone = this._enemyDefeated || (this._enemyDefeated = new Map());
        const live = new Set(list.map((e) => e.key));
        (this._enemyLast || []).forEach((e) => {
            if (!live.has(e.key) && !gone.has(e.key)) {
                gone.set(e.key, Object.assign({}, e, { health: 0, shield: 0, defeated: true, until: now + ENEMY_DEAD_FACE_MS }));
            }
        });
        this._enemyLast = list;
        const out = list.slice();
        gone.forEach((e, key) => {
            if (live.has(key) || now > e.until) gone.delete(key);
            else out.push(e);
        });
        return out;
    }

    /** Portrait expression: dead once defeated, pain on a hit (anger once the hull is low), calm otherwise. */
    updateEnemyFace(card, enemy) {
        const canvas = card.querySelector('canvas.vx-portrait');
        if (!canvas || typeof voxelPortrait === 'undefined' || !voxelPortrait.setState) return;
        const now = performance.now();
        const total = (enemy.health || 0) + (enemy.shield || 0);
        const hull = enemy.health / (enemy.maxHealth || 1);
        if (card._vfPrevHp != null && total < card._vfPrevHp - 0.01) {
            // Restart the flash/shake animation on every new hit.
            if (now >= (card._vfHitUntil || 0)) {
                card.classList.remove('face-hit');
                void card.offsetWidth;
                card.classList.add('face-hit');
            }
            card._vfHitUntil = now + ENEMY_HIT_FACE_MS;
        }
        card._vfPrevHp = total;
        const hit = now < (card._vfHitUntil || 0);
        if (!hit && card.classList.contains('face-hit')) card.classList.remove('face-hit');
        card.classList.toggle('face-dead', !!enemy.defeated);
        // Below half hull the pilot stays wounded; a hit shows anger (pain while still healthy).
        const base = hull < 0.5 ? 1 : 0;
        const state = enemy.defeated ? 2 : (hit ? (base ? 4 : 1) : base);
        voxelPortrait.setState(canvas, state);
    }

    /**
     * Portrait variant (0..15) for one enemy: picked once per enemy and kept, and different from the
     * faces already handed out in the same faction, so two cards never show the same pilot.
     */
    enemyFaceVariant(key, faction) {
        const faces = this._enemyFaces || (this._enemyFaces = new Map());
        const id = faction + ':' + key;
        if (faces.has(id)) return faces.get(id);
        const used = new Set();
        faces.forEach((v, k) => { if (k.indexOf(faction + ':') === 0) used.add(v); });
        let v = Math.floor(Math.random() * 16);
        for (let i = 0; i < 16 && used.has(v); i++) v = (v + 1) % 16;
        if (faces.size > 64) faces.clear();
        faces.set(id, v);
        return v;
    }

    /**
     * Sidebar card for a big enemy: portrait on top with the faction crest in its lower-right corner,
     * the name, then vertical hull + shield bars like the player's own vitals.
     */
    /** Hero = boss or elite / capital craft; everything else on a card is a plain line ship. */
    isHeroEnemy(enemy) {
        return !!(enemy && (enemy.isBoss || this.isCardClass(enemy.enemyClass)));
    }

    /** Faction rank of a hero: title + chevron count (elite 2, capital 3, boss 4). */
    enemyFactionRank(enemy, faction) {
        const tier = enemy.isBoss ? 2 : (String(enemy.enemyClass || '').toLowerCase() === 'capital' ? 1 : 0);
        const titles = {
            terran: ['LIEUTENANT', 'COMMANDER', 'ADMIRAL'],
            kronax: ['PACKLEADER', 'WARCHIEF', 'CLAWMASTER'],
            voidborn: ['HOLLOW', 'RINGWARDEN', 'ECHO'],
            pirate: ['FIRST MATE', 'CAPTAIN', 'WARLORD'],
            machine: ['NODE', 'OVERSEER', 'PRIME']
        };
        const list = titles[faction] || ['OFFICER', 'COMMANDER', 'WARLORD'];
        return { title: list[tier], pips: tier + 2 };
    }

    buildEnemyCard(enemy) {
        const isChampion = enemy.key === 'champion';
        const isHero = this.isHeroEnemy(enemy);
        const card = document.createElement('div');
        card.className = 'health-bar enemy-health enemy-card-v' + (isChampion ? ' is-champion' : ' is-side') + (enemy.isBoss ? ' is-boss' : '') + (isHero ? ' is-hero' : ' is-line');
        card.dataset.enemyKey = enemy.key;
        card.dataset.faction = enemy.factionId || '';

        const model = enemy.model
            || (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getMergedModel
                ? enemyConfigManager.getMergedModel(enemy.type) : null);
        const name = String((model && (model.name || model.id || model.type)) || enemy.type || enemy.factionLabel || 'ENEMY')
            .replace(/_/g, ' ').toUpperCase();
        const faction = String(enemy.faction || enemy.factionId || 'pirate').toLowerCase();
        const style = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle)
            ? factionShipStyles.getFactionStyle(faction) : null;
        const accent = (style && (style.accent || style.hull)) || null;

        const portrait = document.createElement('div');
        portrait.className = 'enemy-portrait';
        portrait.setAttribute('data-ui-tip', name);
        let face = '';
        try {
            // Line ships have no pilot portrait: their card shows the hull, so they never pass for a hero.
            if (isHero && typeof heroPortrait !== 'undefined' && heroPortrait.html) {
                face = heroPortrait.html({ faction: faction, v: this.enemyFaceVariant(enemy.key, faction) }, accent);
            }
        } catch (err) { face = ''; }
        if (face) {
            portrait.innerHTML = face;
        } else {
            // No portrait renderer: fall back to the ship icon.
            const icon = document.createElement('canvas');
            icon.className = 'health-ship-icon';
            icon.width = 88;
            icon.height = 88;
            portrait.appendChild(icon);
            this.renderEnemyHealthIcon(icon, enemy);
        }
        const crestHtml = (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml)
            ? profileSelectionManager.getFactionEmblemHtml(faction, 24) : '';
        if (crestHtml) {
            const crest = document.createElement('span');
            crest.className = 'enemy-crest';
            crest.innerHTML = crestHtml;
            portrait.appendChild(crest);
        }
        if (accent) card.style.setProperty('--enemy-accent', accent);
        if (isHero) {
            const rank = this.enemyFactionRank(enemy, faction);
            const rankEl = document.createElement('span');
            rankEl.className = 'enemy-rank';
            rankEl.innerHTML = '<span class="enemy-rank-pips">' + '<i></i>'.repeat(rank.pips) + '</span>' +
                '<span class="enemy-rank-title"></span>';
            rankEl.lastChild.textContent = rank.title;
            portrait.appendChild(rankEl);
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'enemy-name';
        const lineClass = String(enemy.enemyClass || 'line').toUpperCase();
        nameEl.textContent = (enemy.isBoss ? 'BOSS · ' : '') + (isHero ? '' : lineClass + ' · ') + name;

        const bars = document.createElement('div');
        bars.className = 'enemy-vbars';
        const hull = document.createElement('div');
        hull.className = 'enemy-vbar is-hull';
        const fill = document.createElement('div');
        fill.className = 'health-fill';
        fill.dataset.enemyKey = enemy.key;
        const hpText = document.createElement('span');
        hpText.className = 'enemy-hp-text';
        fill.appendChild(hpText);
        hull.appendChild(fill);
        const shield = document.createElement('div');
        shield.className = 'enemy-vbar is-shield';
        const sh = document.createElement('div');
        sh.className = 'enemy-shield-fill';
        const shText = document.createElement('span');
        shText.className = 'enemy-shield-text';
        sh.appendChild(shText);
        shield.appendChild(sh);
        bars.appendChild(hull);
        bars.appendChild(shield);

        card.appendChild(portrait);
        card.appendChild(nameEl);
        card.appendChild(bars);
        return card;
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
            case 'ArrowLeft':
                this.gameOverMenuIndex = (this.gameOverMenuIndex - 1 + this.gameOverMenuItems.length) % this.gameOverMenuItems.length;
                this.updateGameOverMenuDisplay();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
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
