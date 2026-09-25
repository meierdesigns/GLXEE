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
}
