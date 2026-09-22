"use strict";

/**
 * Level Info Panel Manager
 * Displays real-time information about the current level
 */
class LevelInfoManager {
    constructor() {
        this.panel = null;
        this.body = null;
        this.levelData = null;
        this.updateInterval = null;
        this.stats = {
            score: 0,
            enemiesKilled: 0,
            startTime: null,
            levelTime: 0
        };
        this._timeString = '00:00';
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializePanel());
        } else {
            this.initializePanel();
        }
    }

    initializePanel() {
        this.panel = document.getElementById('gameInfoPanel');
        if (!this.panel) {
            console.error('Level info panel not found');
            return;
        }
        this.body = document.getElementById('giBody') || this.panel;
        this.panel.style.display = 'flex';
        this.startUpdateLoop();
        this.updateLevelData(this.collectLevelData());
    }

    showPanel() {
        if (this.panel) {
            this.panel.style.display = 'flex';
        }
    }

    hidePanel() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.stopUpdateLoop();
        }
    }

    /** Show HUD + refresh content without starting the combat clock. */
    prepareForCombat() {
        this.showPanel();
        this.startUpdateLoop();
        this.updateDisplay();
    }

    updateLevelData(levelData) {
        this.levelData = levelData;
        this.updateDisplay();
    }

    iconHtml(key, size, tipLabel) {
        if (typeof iconRenderer !== 'undefined' && iconRenderer && iconRenderer.imgHtml) {
            return iconRenderer.imgHtml(key, size || 32, 'gi-icon', undefined, tipLabel);
        }
        return '';
    }

    weaponIconKey(name) {
        const w = String(name || '').toLowerCase().replace(/[\s_-]+/g, '');
        const map = {
            laser: 'shotLaser',
            normal: 'shotLaser',
            spread: 'shotSpread',
            spreadshot: 'shotSpread',
            rapid: 'shotRapid',
            rapidfire: 'shotRapid',
            plasma: 'shotPlasma',
            missile: 'shotMissile',
            ion: 'shotIon',
            wave: 'shotWave',
            burst: 'shotBurst',
            pierce: 'shotPierce',
            nova: 'shotNova'
        };
        return map[w] || 'statWeapon';
    }

    rowHtml(iconKey, label, valueHtml, valueId) {
        const idAttr = valueId ? ` id="${valueId}"` : '';
        const tip = String(valueHtml || '').replace(/"/g, '&quot;');
        return `<div class="gi-row">` +
            `<span class="gi-row-icon">${this.iconHtml(iconKey, 24, label)}</span>` +
            `<span class="gi-row-text">` +
            `<span class="gi-row-label">${label}</span>` +
            `<span class="gi-row-value" title="${tip}"${idAttr}>${valueHtml}</span>` +
            `</span></div>`;
    }

    metricHtml(label, valueHtml, valueId) {
        const idAttr = valueId ? ` id="${valueId}"` : '';
        return `<div class="gi-metric">` +
            `<span class="gi-metric-label">${label}</span>` +
            `<span class="gi-metric-value"${idAttr}>${valueHtml}</span>` +
            `</div>`;
    }

    chipHtml(iconKey, title) {
        const full = String(title || '').toUpperCase();
        const short = full
            .replace(/\bSHOT\b/g, '')
            .replace(/\bFIRE\b/g, '')
            .replace(/\s+/g, ' ')
            .trim() || full;
        const tip = full.replace(/"/g, '&quot;');
        return `<span class="gi-chip" title="${tip}">` +
            `${this.iconHtml(iconKey, 24, full)}` +
            `<span class="gi-chip-label">${short}</span>` +
            `</span>`;
    }

    clusterHtml(title, rowsHtml, extraClass) {
        const cls = extraClass ? ` gi-cluster ${extraClass}` : ' gi-cluster';
        return `<section class="${cls.trim()}">` +
            `<h4 class="gi-cluster-title">${title}</h4>` +
            `<div class="gi-cluster-body">${rowsHtml}</div>` +
            `</section>`;
    }

    updateDisplay() {
        if (!this.levelData || !this.panel) return;

        this.updateElement('levelName', this.levelData.name || 'UNKNOWN');
        this.updateElement('levelDifficulty', this.levelData.difficulty || 'NORMAL');
        this.updatePlanetIcon();
        this.renderBody();
    }

    resolvePlanetId() {
        const raw = (this.levelData && (this.levelData.planetId || this.levelData.background || this.levelData.name)) || 'mars';
        const sid = String(raw).toLowerCase().split(/[\s—–-]/)[0];
        return sid || 'mars';
    }

    updatePlanetIcon() {
        try {
            const host = document.getElementById('levelPlanet');
            if (!host) return;
            const sid = this.resolvePlanetId();
            if (host.dataset.planetId === sid && host.innerHTML) return;

            let svg = '';
            if (typeof planetSVGManager !== 'undefined') {
                if (!planetSVGManager.planets || !Object.keys(planetSVGManager.planets).length) {
                    planetSVGManager.init();
                }
                svg = planetSVGManager.getPlanetSVG(sid) || '';
            }

            if (svg) {
                host.innerHTML = svg;
            } else {
                host.innerHTML = `<span class="game-info-planet-fallback" data-planet="${sid}"></span>`;
            }
            host.dataset.planetId = sid;
        } catch (e) {
            // Never let HUD planet updates crash the game loop
        }
    }

    getObjectiveBits() {
        let label = 'OBJECTIVE';
        let progress = '—';
        if (typeof objectiveManager !== 'undefined') {
            label = objectiveManager.label || label;
            progress = objectiveManager.getProgressText
                ? (objectiveManager.getProgressText() || '—')
                : '—';
        }
        return { label, progress };
    }

    getDailyBits() {
        let active = false;
        let progress = '—';
        let enemyType = '';
        if (typeof dailyTracker === 'undefined') return { active, progress, enemyType };

        const pid = (this.levelData && (this.levelData.planetId || this.levelData.background)) || 'mars';
        const status = dailyTracker.getStatus(pid);
        if (status && status.active) {
            active = true;
            enemyType = status.enemyType || '';
            progress = `${status.todayKills}/${status.killCountPerDay}` +
                (enemyType ? ` ${enemyType}` : '') +
                ` · ${status.completedDays}/${status.requiredDays}d`;
        }
        return { active, progress, enemyType };
    }

    renderBody() {
        if (!this.body) return;
        const d = this.levelData;
        const obj = this.getObjectiveBits();
        const daily = this.getDailyBits();
        const weaponName = d.currentWeapon || 'Laser';
        const weaponKey = this.weaponIconKey(weaponName);

        const session = this.clusterHtml('SESSION',
            `<div class="gi-metrics">` +
            this.metricHtml('SCORE', String(this.stats.score), 'currentScore') +
            this.metricHtml('TIME', this._timeString, 'levelTime') +
            this.metricHtml('KILLS', String(this.stats.enemiesKilled), 'enemiesKilled') +
            `</div>`,
            'gi-cluster-session'
        );

        const loadout = this.clusterHtml('LOADOUT',
            this.rowHtml('menuEnemies', 'ENEMY', String(d.enemyType || '—').toUpperCase(), 'enemyType') +
            this.rowHtml('hsShip', 'SHIP', String(d.playerShipType || '—'), 'playerShipType') +
            this.rowHtml(weaponKey, 'WEAPON', String(weaponName), 'giCurrentWeapon')
        );

        const missionRows =
            this.rowHtml('menuStart', obj.label.replace(/:$/, ''), String(obj.progress).toUpperCase(), 'objectiveHudValue') +
            this.rowHtml('hsUpgrade', 'DAILY', daily.active ? daily.progress : '—', 'dailyHudValue');
        const mission = this.clusterHtml('MISSION', missionRows);

        const combat = this.clusterHtml('COMBAT',
            `<div class="gi-metrics gi-metrics-2x2">` +
            this.metricHtml('E.SPD', d.enemySpeed || '0.8') +
            this.metricHtml('E.HP', d.enemyHealth || '100') +
            this.metricHtml('P.SPD', d.playerSpeed || '1.0') +
            this.metricHtml('P.HP', d.playerMaxHealth || '100') +
            `</div>`,
            'gi-cluster-combat'
        );

        const obstacles = (d.obstacles && d.obstacles.length)
            ? d.obstacles
            : [{ name: 'Asteroid' }, { name: 'Shield' }];
        const obstacleChips = obstacles.map((o) => {
            const name = (o && o.name) || 'Obstacle';
            const key = /shield/i.test(name) ? 'menuDefense' : 'hsCargo';
            return this.chipHtml(key, name);
        }).join('');

        const weapons = (d.weapons && d.weapons.length)
            ? d.weapons
            : [{ name: 'Laser' }, { name: 'Spread Shot' }, { name: 'Rapid Fire' }];
        const weaponChips = weapons.map((w) => {
            const name = (w && w.name) || 'Weapon';
            return this.chipHtml(this.weaponIconKey(name), name);
        }).join('');

        const field = this.clusterHtml('FIELD',
            this.rowHtml('hsCargo', 'SPAWN', `${d.obstacleSpawnRate || 3000}ms`) +
            `<div class="gi-chip-row"><span class="gi-chip-row-label">OBS</span>` +
            `<div class="gi-chips">${obstacleChips}</div></div>` +
            `<div class="gi-chip-row"><span class="gi-chip-row-label">WPN</span>` +
            `<div class="gi-chips">${weaponChips}</div></div>`,
            'gi-cluster-field'
        );

        this.body.innerHTML = session + loadout + mission + combat + field;
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateStats(stats) {
        this.stats = { ...this.stats, ...stats };
        this.updateElement('currentScore', this.stats.score);
        this.updateElement('enemiesKilled', this.stats.enemiesKilled);
    }

    startLevel() {
        this.stats.startTime = Date.now();
        this.stats.levelTime = 0;
        this._timeString = '00:00';
        this.prepareForCombat();
        this.updateElement('levelTime', this._timeString);
    }

    endLevel() {
        this.stopUpdateLoop();
        // Keep the panel mounted during game-over / transition so the next
        // mission start does not flash an empty vitals-only HUD.
    }

    startUpdateLoop() {
        this.stopUpdateLoop();
        this.updateInterval = setInterval(() => {
            if (typeof game !== 'undefined' && typeof game.score === 'number') {
                this.stats.score = game.score;
                this.updateElement('currentScore', this.stats.score);
            }
            if (this.stats.startTime) {
                this.stats.levelTime = Math.floor((Date.now() - this.stats.startTime) / 1000);
                const minutes = Math.floor(this.stats.levelTime / 60);
                const seconds = this.stats.levelTime % 60;
                this._timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                this.updateElement('levelTime', this._timeString);
            }
            if (typeof objectiveManager !== 'undefined' || typeof dailyTracker !== 'undefined') {
                const objVal = document.getElementById('objectiveHudValue');
                const dailyVal = document.getElementById('dailyHudValue');
                if (objVal) {
                    const obj = this.getObjectiveBits();
                    objVal.textContent = String(obj.progress).toUpperCase();
                }
                if (dailyVal) {
                    const daily = this.getDailyBits();
                    dailyVal.textContent = daily.active ? daily.progress : '—';
                }
            }
        }, 1000);
    }

    stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    collectLevelData() {
        const levelData = {
            name: 'MARS — STAGE 1/3',
            difficulty: 'EASY',
            enemyType: 'enemyBasic',
            enemySpeed: '0.8',
            enemyHealth: '100',
            enemyCount: '5',
            obstacles: [
                { name: 'Asteroid', count: 3 },
                { name: 'Shield', count: 1 }
            ],
            obstacleSpawnRate: 1000,
            playerShipType: 'Starfighter',
            playerSpeed: '1.0',
            playerMaxHealth: '100',
            currentWeapon: 'Laser',
            weapons: [
                { name: 'Laser', damage: 10 },
                { name: 'Spread Shot', damage: 8 },
                { name: 'Rapid Fire', damage: 6 }
            ]
        };

        const coreLM = (typeof game !== 'undefined' && (game.coreLevelManager || game.levelManager))
            || (typeof gameCore !== 'undefined' && (gameCore.coreLevelManager || gameCore.levelManager))
            || null;
        const current = coreLM && coreLM.getCurrentLevel ? coreLM.getCurrentLevel() : null;
        if (current) {
            levelData.name = current.name || levelData.name;
            levelData.difficulty = current.difficulty || levelData.difficulty;
            levelData.enemyType = current.enemyType || levelData.enemyType;
            levelData.enemySpeed = current.enemySpeed != null ? String(current.enemySpeed) : levelData.enemySpeed;
            levelData.enemyHealth = current.enemyHealth != null ? String(current.enemyHealth) : levelData.enemyHealth;
            levelData.enemyCount = current.enemyCount != null ? String(current.enemyCount) : levelData.enemyCount;
            levelData.obstacles = current.obstacles || levelData.obstacles;
            levelData.obstacleSpawnRate = current.obstacleSpawnRate || levelData.obstacleSpawnRate;
            levelData.stageLabel = current.stageLabel || '';
            levelData.isBoss = !!current.isBoss;
            levelData.planetId = current.planetId || levelData.planetId;
            levelData.objective = current.objective || null;
            if (current.weapons) levelData.weapons = current.weapons;
        }

        if (typeof enemyManager !== 'undefined' && enemyManager.getEnemy()) {
            const enemy = enemyManager.getEnemy();
            levelData.enemySpeed = enemy.speed?.toFixed(1) || levelData.enemySpeed;
            levelData.enemyHealth = enemyManager.maxHealth || levelData.enemyHealth;
        }

        if (typeof playerManager !== 'undefined') {
            levelData.playerSpeed = playerManager.player?.speed?.toFixed(1) || '1.0';
            levelData.playerMaxHealth = playerManager.maxHealth || '100';
        }

        if (typeof obstacleManager !== 'undefined') {
            levelData.obstacleSpawnRate = obstacleManager.spawnInterval || levelData.obstacleSpawnRate;
        }

        if (typeof game !== 'undefined' && game.gameState) {
            levelData.obstacleSpawnRate = game.gameState.obstacleSpawnInterval || levelData.obstacleSpawnRate;
        }

        if (typeof graphicsManager !== 'undefined' && graphicsManager.currentPlayerModel) {
            levelData.playerShipType = graphicsManager.currentPlayerModel.name || 'Starfighter';
        }

        if (typeof game !== 'undefined' && game.currentWeaponName) {
            levelData.currentWeapon = game.currentWeaponName;
        } else {
            const weaponLabel = document.querySelector('.weapon-display #currentWeapon');
            if (weaponLabel && weaponLabel.textContent) {
                levelData.currentWeapon = weaponLabel.textContent.trim();
            }
        }

        return levelData;
    }

    showLootNotice(text) {
        const msg = String(text || '').trim();
        if (!msg) return;
        let el = document.getElementById('vfLootNotice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'vfLootNotice';
            el.style.cssText = [
                'position:fixed',
                'top:12%',
                'left:50%',
                'transform:translateX(-50%)',
                'z-index:9999',
                'padding:8px 14px',
                'background:rgba(0,0,0,0.75)',
                'color:#b8f0c0',
                'font-family:monospace',
                'font-size:var(--font-text)',
                'letter-spacing:0.04em',
                'pointer-events:none',
                'border:1px solid rgba(184,240,192,0.4)'
            ].join(';');
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(this._lootNoticeTimer);
        this._lootNoticeTimer = setTimeout(() => {
            if (el) el.style.opacity = '0';
        }, 2800);
    }

    showEventAnnounce(text, options) {
        const msg = String(text || '').trim();
        if (!msg) return;
        const opts = options || {};
        const accent = opts.accent || '#e8c060';
        const holdMs = Math.max(800, Math.round(Number(opts.holdMs != null ? opts.holdMs : 2200)));
        let el = document.getElementById('vfEventAnnounce');
        if (!el) {
            el = document.createElement('div');
            el.id = 'vfEventAnnounce';
            el.className = 'vf-event-announce';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.borderColor = accent;
        el.style.color = accent;
        el.style.opacity = '1';
        el.classList.add('vf-event-announce-pulse');
        clearTimeout(this._eventAnnounceTimer);
        this._eventAnnounceTimer = setTimeout(() => {
            if (el) {
                el.style.opacity = '0';
                el.classList.remove('vf-event-announce-pulse');
            }
        }, holdMs);
    }
}

// Global instance
let levelInfoManager = new LevelInfoManager();
