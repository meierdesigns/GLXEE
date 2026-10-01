"use strict";

const STAT_HIGHLIGHT_MS = 4000; // how long an improved stat stays lit
const STAT_ICON_KEYS = {
    hp: 'statHealth', shield: 'statShield', energy: 'statEnergy',
    speed: 'statSpeed', armor: 'statArmor', dmg: 'statDamage'
};

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
        // New run: the loadout is the baseline, not an upgrade.
        this._statPrev = {};
        this._statFx = {};
        this.showPanel();
        this.startUpdateLoop();
        this.updateDisplay();
    }

    updateLevelData(levelData) {
        this.levelData = levelData;
        this.updateDisplay();
    }

    /** Loot chip: the resource's own icon with the collected count. */
    lootChipHtml(r) {
        const key = (typeof economyConfig !== 'undefined' && economyConfig.getResourceIconKey)
            ? economyConfig.getResourceIconKey(r.id)
            : 'hsCargo';
        const tip = `${String(r.name || r.id).toUpperCase()} ×${r.amount}`.replace(/"/g, '&quot;');
        // Tinted in the resource's own colour (same as pickups / station).
        const tint = (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor)
            ? economyConfig.getResourceColor(r.id) : undefined;
        const icon = (typeof iconRenderer !== 'undefined' && iconRenderer && iconRenderer.imgHtml)
            ? iconRenderer.imgHtml(key || 'hsCargo', 32, 'gi-icon', tint, tip) : '';
        const empty = !(Number(r.amount) > 0) ? ' gi-chip-empty' : '';
        return `<span class="gi-chip gi-chip-loot${empty}" title="${tip}" style="--loot-color:${tint || 'currentColor'}">` +
            icon +
            `<span class="gi-chip-label gi-chip-count">${r.amount}</span>` +
            `</span>`;
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

    /** Current player ship stats (label, key, numeric value, display text). */
    playerStatList() {
        const pm = typeof playerManager !== 'undefined' ? playerManager : null;
        const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        const ps = typeof pickupManager !== 'undefined' && pickupManager.getPowerShot ? pickupManager.getPowerShot() : null;
        const dmg = ps ? ps.damage : 1;
        const list = [
            { key: 'hp', label: 'HULL', value: num(pm && pm.maxHealth) },
            { key: 'shield', label: 'SHIELD', value: num(pm && pm.shieldMax) },
            { key: 'energy', label: 'ENERGY', value: num(pm && pm.maxEnergy) },
            { key: 'speed', label: 'SPEED', value: num(pm && pm.player && pm.player.speed), digits: 1 },
            { key: 'armor', label: 'ARMOR', value: num(pm && pm.armor) },
            { key: 'dmg', label: 'DMG', value: dmg, text: '×' + dmg.toFixed(1) }
        ];
        list.forEach((st) => {
            if (!st.text) st.text = st.digits ? st.value.toFixed(st.digits) : String(Math.round(st.value));
        });
        return list;
    }

    /**
     * Compare with the last snapshot: a stat that went up (upgrade, power-up)
     * gets a highlight with its delta for a few seconds; down = warning tint.
     */
    trackPlayerStats() {
        const now = Date.now();
        const list = this.playerStatList();
        this._statPrev = this._statPrev || {};
        this._statFx = this._statFx || {};
        list.forEach((st) => {
            const prev = this._statPrev[st.key];
            if (prev != null && Math.abs(st.value - prev) > 1e-6) {
                const delta = st.value - prev;
                this._statFx[st.key] = { dir: delta > 0 ? 'up' : 'down', delta, until: now + STAT_HIGHLIGHT_MS };
            }
            this._statPrev[st.key] = st.value;
            const fx = this._statFx[st.key];
            st.fx = fx && fx.until > now ? fx : null;
        });
        // The weapon box shares the damage highlight (power shot etc.).
        const wi = document.getElementById('weaponInfo');
        const box = wi && (wi.closest('.weapon-selection') || wi.parentElement);
        if (box) {
            const dmgFx = list.find((st) => st.key === 'dmg');
            box.classList.toggle('gi-weapon-boosted', dmgFx.value > 1);
            box.classList.toggle('gi-weapon-flash', !!(dmgFx.fx && dmgFx.fx.dir === 'up'));
        }
        return list;
    }

    statMetricHtml(st) {
        const fx = st.fx;
        const cls = fx ? ' gi-stat-' + fx.dir : '';
        const d = fx ? Math.abs(fx.delta) : 0;
        const dTxt = fx ? `<span class="gi-stat-delta">${fx.dir === 'up' ? '▲' : '▼'}${st.key === 'dmg' ? d.toFixed(1) : (st.digits ? d.toFixed(st.digits) : Math.round(d))}</span>` : '';
        return `<div class="gi-metric gi-stat${cls}" data-stat="${st.key}">` +
            `<span class="gi-metric-label gi-stat-icon">${this.iconHtml(STAT_ICON_KEYS[st.key], 24, st.label) || st.label}</span>` +
            `<span class="gi-metric-value">${st.text}${dTxt}</span>` +
            `</div>`;
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

    /** Every slotted weapon as a chip; they breathe while a temporary boost is active. */
    weaponChipsHtml() {
        const weapons = this.collectEquippedWeapons ? this.collectEquippedWeapons() : [];
        if (!weapons.length) return '';
        const boosted = typeof pickupManager !== 'undefined' && pickupManager.getPowerShot
            && !!pickupManager.getPowerShot();
        const iconKey = (id) => (typeof bulletManager !== 'undefined' && bulletManager.getWeaponIconKey)
            ? bulletManager.getWeaponIconKey(id)
            : this.weaponIconKey(id);
        // The body re-renders every second: offset by wall-clock so the breath keeps its phase.
        const phase = boosted ? ` style="--gi-breath-delay:-${Date.now() % 1600}ms"` : '';
        const chips = weapons.map((w) => {
            const name = String(w.name || w.id).toUpperCase();
            const tip = (name + (w.count > 1 ? ` ×${w.count}` : '')).replace(/"/g, '&quot;');
            return `<span class="gi-chip gi-chip-weapon${boosted ? ' gi-chip-boosted' : ''}" title="${tip}"${phase}>` +
                this.iconHtml(iconKey(w.id), 24, name) +
                `<span class="gi-chip-label">${w.count > 1 ? '×' + w.count : name}</span>` +
                `</span>`;
        }).join('');
        return `<div class="gi-weapon-chips">${chips}</div>`;
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
            this.rowHtml(weaponKey, 'WEAPON', String(weaponName), 'giCurrentWeapon') +
            this.weaponChipsHtml()
        );

        const missionRows =
            this.rowHtml('menuStart', obj.label.replace(/:$/, ''), String(obj.progress).toUpperCase(), 'objectiveHudValue') +
            this.rowHtml('hsUpgrade', 'DAILY', daily.active ? daily.progress : '—', 'dailyHudValue');
        const mission = this.clusterHtml('MISSION', missionRows);

        // Player ship stats; anything an upgrade improves lights up.
        const stats = this.trackPlayerStats();
        const combat = this.clusterHtml('SHIP',
            `<div class="gi-metrics gi-metrics-2x2">` +
            stats.map((st) => this.statMetricHtml(st)).join('') +
            `</div>`,
            'gi-cluster-combat'
        );

        // Only this run's real content: planet obstacles, equipped weapons.
        const resources = d.resources || [];
        const resourceChips = resources.map((r) => this.lootChipHtml(r)).join('');

        const chipRow = (label, chips) => chips
            ? `<div class="gi-chip-row"><span class="gi-chip-row-label">${label}</span>` +
                `<div class="gi-chips">${chips}</div></div>`
            : '';
        const field = this.clusterHtml('FIELD',
            chipRow('LOOT', resourceChips),
            'gi-cluster-field'
        );

        this.body.innerHTML = session + loadout + mission + combat + field;
    }
}
