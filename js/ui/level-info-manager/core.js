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
// How long the MISSION block stays in the HUD after a run starts.
const MISSION_HUD_SHOW_MS = 8000;

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
        this.under = document.getElementById('giUnderStage');
        this.loadoutSide = document.getElementById('giLoadoutSide');
        this.missionSide = document.getElementById('giMissionSide');
        this.panel.style.display = 'flex';
        this.startUpdateLoop();
        this.updateLevelData(this.collectLevelData());
    }

    showPanel() {
        if (this.panel) {
            this.panel.style.display = 'flex';
        }
        if (this.under) {
            this.under.hidden = false;
        }
        if (this.loadoutSide) {
            this.loadoutSide.hidden = false;
        }
        if (this.missionSide) {
            this.missionSide.hidden = false;
        }
    }

    hidePanel() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.stopUpdateLoop();
        }
        if (this.under) {
            this.under.hidden = true;
        }
        if (this.loadoutSide) {
            this.loadoutSide.hidden = true;
        }
        if (this.missionSide) {
            this.missionSide.hidden = true;
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

    /** Loot tile: same metric cell as SHIP stats (icon left, count right). */
    lootChipHtml(r) {
        const key = (typeof economyConfig !== 'undefined' && economyConfig.getResourceIconKey)
            ? economyConfig.getResourceIconKey(r.id)
            : 'hsCargo';
        const tip = `${String(r.name || r.id).toUpperCase()} ×${r.amount}`.replace(/"/g, '&quot;');
        const tint = (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor)
            ? economyConfig.getResourceColor(r.id) : undefined;
        const icon = (typeof iconRenderer !== 'undefined' && iconRenderer && iconRenderer.imgHtml)
            ? iconRenderer.imgHtml(key || 'hsCargo', 32, 'gi-icon', tint, tip) : '';
        const empty = !(Number(r.amount) > 0) ? ' gi-loot-empty' : '';
        return `<div class="gi-metric gi-loot${empty}" title="${tip}" style="--loot-color:${tint || 'currentColor'}">` +
            `<span class="gi-metric-label gi-stat-icon">${icon}</span>` +
            `<span class="gi-metric-value gi-loot-count">${r.amount}</span>` +
            `</div>`;
    }

    iconHtml(key, size, tipLabel) {
        if (typeof iconRenderer !== 'undefined' && iconRenderer && iconRenderer.imgHtml) {
            return iconRenderer.imgHtml(key, size || 32, 'gi-icon', undefined, tipLabel);
        }
        return '';
    }

    weaponIconKey(name) {
        if (typeof iconRenderer !== 'undefined' && iconRenderer.weaponIconInfo) {
            return iconRenderer.weaponIconInfo(name).key;
        }
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

    /** Loadout weapon glyph: correct shot sprite + per-weapon tint (not faction theme). */
    weaponIconHtml(weaponId, size, tipLabel) {
        if (typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
            return iconRenderer.weaponImgHtml(weaponId, size || 24, 'gi-icon', tipLabel);
        }
        return this.iconHtml(this.weaponIconKey(weaponId), size, tipLabel);
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

    /** Like rowHtml, but the icon is a tinted weapon shot sprite. */
    weaponRowHtml(weaponId, label, valueHtml, valueId) {
        const idAttr = valueId ? ` id="${valueId}"` : '';
        const tip = String(valueHtml || '').replace(/"/g, '&quot;');
        return `<div class="gi-row">` +
            `<span class="gi-row-icon">${this.weaponIconHtml(weaponId, 24, label)}</span>` +
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
            `<span class="gi-metric-label gi-stat-icon">${this.iconHtml(STAT_ICON_KEYS[st.key], 32, st.label) || st.label}</span>` +
            `<span class="gi-metric-value">${st.text}${dTxt}</span>` +
            `</div>`;
    }

    metricHtml(label, valueHtml, valueId, iconKey) {
        const idAttr = valueId ? ` id="${valueId}"` : '';
        const tip = String(label || '').toUpperCase();
        const labelHtml = iconKey
            ? `<span class="gi-metric-label gi-stat-icon">${this.iconHtml(iconKey, 24, tip) || tip}</span>`
            : `<span class="gi-metric-label">${tip}</span>`;
        return `<div class="gi-metric">` +
            labelHtml +
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

    /**
     * Extra weapon chips only when more than one gun is slotted (avoids
     * duplicating the WEAPON row for a single loadout).
     */
    weaponChipsHtml() {
        const weapons = this.collectEquippedWeapons ? this.collectEquippedWeapons() : [];
        if (weapons.length <= 1) return '';
        const boosted = typeof pickupManager !== 'undefined' && pickupManager.getPowerShot
            && !!pickupManager.getPowerShot();
        // The body re-renders every second: offset by wall-clock so the breath keeps its phase.
        const phase = boosted ? ` style="--gi-breath-delay:-${Date.now() % 1600}ms"` : '';
        const chips = weapons.map((w) => {
            const name = String(w.name || w.id).toUpperCase();
            const tip = (name + (w.count > 1 ? ` ×${w.count}` : '')).replace(/"/g, '&quot;');
            return `<span class="gi-chip gi-chip-weapon${boosted ? ' gi-chip-boosted' : ''}" title="${tip}"${phase}>` +
                this.weaponIconHtml(w.id, 24, name) +
                `<span class="gi-chip-label">${w.count > 1 ? '×' + w.count : name}</span>` +
                `</span>`;
        }).join('');
        return `<div class="gi-weapon-chips">${chips}</div>`;
    }

    /** Cluster header: icon when known, otherwise the text label. */
    clusterTitleHtml(title) {
        const tip = String(title || '').toUpperCase();
        // SESSION: no header icon/label — metrics speak for themselves.
        if (tip === 'SESSION') return '';
        const key = ({
            SHIP: 'hsShip',
            FIELD: 'hsCargo'
        })[tip];
        if (key) {
            return `<h4 class="gi-cluster-title gi-cluster-title-icon" title="${tip}">` +
                `${this.iconHtml(key, 32, tip)}</h4>`;
        }
        return `<h4 class="gi-cluster-title">${tip}</h4>`;
    }

    clusterHtml(title, rowsHtml, extraClass) {
        const tip = String(title || '').toUpperCase();
        const hasIcon = !!({
            SHIP: 1, FIELD: 1
        })[tip];
        const cls = ['gi-cluster', extraClass, hasIcon ? 'gi-cluster-iconed' : '']
            .filter(Boolean).join(' ');
        return `<section class="${cls}">` +
            this.clusterTitleHtml(title) +
            `<div class="gi-cluster-body">${rowsHtml}</div>` +
            `</section>`;
    }

    /** Clear mission card: target icon + action/target lines + status. */
    missionCardHtml(iconHtml, label, status, statusId) {
        const raw = String(label || 'OBJECTIVE').replace(/:$/, '').trim();
        const parts = raw.split(/\s+/);
        const action = parts.length > 1 ? parts[0] : 'OBJECTIVE';
        const target = parts.length > 1 ? parts.slice(1).join(' ') : raw;
        const tip = String(status || '').replace(/"/g, '&quot;');
        const idAttr = statusId ? ` id="${statusId}"` : '';
        return `<div class="gi-mission-card" title="${raw.replace(/"/g, '&quot;')}">` +
            `<span class="gi-mission-card-icon">${iconHtml}</span>` +
            `<div class="gi-mission-card-copy">` +
            `<span class="gi-mission-card-action">${action}</span>` +
            `<span class="gi-mission-card-target">${target}</span>` +
            `<span class="gi-mission-card-status" title="${tip}"${idAttr}>${status}</span>` +
            `</div></div>`;
    }

    /** Planet title + stage line (avoid cramming "NAME — STAGE" into one wrapping h3). */
    splitLevelTitle(d) {
        const data = d || {};
        let planet = String(data.planetName || '').trim();
        let stage = String(data.stageLabel || '').trim();
        const full = String(data.name || '').trim();
        if ((!planet || !stage) && full) {
            const parts = full.split(/\s*[—–-]\s*/);
            if (parts.length >= 2) {
                if (!planet) planet = parts[0].trim();
                if (!stage) stage = parts.slice(1).join(' — ').trim();
            } else if (!planet) {
                planet = full;
            }
        }
        return {
            planet: (planet || 'UNKNOWN').toUpperCase(),
            stage: stage ? stage.toUpperCase() : ''
        };
    }

    updateDisplay() {
        if (!this.levelData || !this.panel) return;

        const title = this.splitLevelTitle(this.levelData);
        this.updateElement('levelName', title.planet);
        const stageEl = document.getElementById('levelStage');
        if (stageEl) {
            stageEl.textContent = title.stage;
            stageEl.hidden = !title.stage;
        }
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

    /**
     * Small pixel icon of an enemy ship type (cached data URL). The model
     * loads async: until it is ready the generic enemy icon stands in.
     */
    enemyIconHtml(type, label) {
        const t = String(type || '');
        this._enemyIcons = this._enemyIcons || {};
        const url = t && this._enemyIcons[t];
        if (url) return `<img src="${url}" alt="" class="gi-icon gi-enemy-icon" title="${label || t}">`;
        if (t && url === undefined && typeof enemyManager !== 'undefined' && enemyManager.getEnemyShipModel
            && typeof shipRenderer !== 'undefined' && shipRenderer.renderShipPreview) {
            this._enemyIcons[t] = null; // pending
            enemyManager.getEnemyShipModel(t).then((model) => {
                if (!model) return;
                const c = document.createElement('canvas');
                c.width = 11;
                c.height = 15;
                shipRenderer.renderShipPreview(c, model, 1);
                this._enemyIcons[t] = c.toDataURL();
            }).catch(() => {});
        }
        return this.iconHtml('menuEnemies', 24, label || t);
    }

    /** Count goal row: only the target's icon and the count (no text label). */
    countRowHtml(iconHtml, label, value, valueId) {
        const idAttr = valueId ? ` id="${valueId}"` : '';
        return `<div class="gi-row gi-row-count" title="${String(label).replace(/"/g, '&quot;')}">` +
            `<span class="gi-row-icon">${iconHtml}</span>` +
            `<span class="gi-row-text"><span class="gi-row-value"${idAttr}>${value}</span></span></div>`;
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
                ` · ${status.completedDays}/${status.requiredDays}d`;
        }
        return { active, progress, enemyType };
    }

    renderBody() {
        if (!this.body) return;
        const d = this.levelData;
        const obj = this.getObjectiveBits();
        const daily = this.getDailyBits();
        const weaponId = (typeof bulletManager !== 'undefined' && bulletManager.currentWeapon)
            ? bulletManager.currentWeapon
            : (d.currentWeapon || 'laser');
        const weaponName = (typeof iconRenderer !== 'undefined' && iconRenderer.weaponIconInfo)
            ? iconRenderer.weaponIconInfo(weaponId).name
            : String(weaponId).toUpperCase();

        const session = this.clusterHtml('SESSION',
            `<div class="gi-metrics gi-metrics-session">` +
            this.metricHtml('SCORE', String(this.stats.score), 'currentScore', 'navTrophy') +
            this.metricHtml('TIME', this._timeString, 'levelTime', 'navClock') +
            this.metricHtml('KILLS', String(this.stats.enemiesKilled), 'enemiesKilled', 'navSkull') +
            `</div>`,
            'gi-cluster-session'
        );

        // Loadout lives in the right rail (top).
        const loadout = this.clusterHtml('LOADOUT',
            this.rowHtml('menuEnemies', 'ENEMY', String(d.enemyType || '—').toUpperCase(), 'enemyType') +
            this.rowHtml('hsShip', 'SHIP', String(d.playerShipType || '—'), 'playerShipType') +
            this.weaponRowHtml(weaponId, 'WEAPON', weaponName, 'giCurrentWeapon'),
            'gi-cluster-loadout'
        );

        // Mission: text title + one clear card (target icon, goal, status).
        const o = typeof objectiveManager !== 'undefined' ? objectiveManager.getObjective() : null;
        const missionLabel = obj.label.replace(/:$/, '');
        const missionProgress = String(obj.progress).toUpperCase();
        const huntTarget = o && o.type === 'hunt' && o.targetEnemyId && objectiveManager.enemies
            ? objectiveManager.enemies.find((e) => e && e.id === o.targetEnemyId)
            : null;
        const missionIcon = (o && o.type === 'killCount' && o.enemyType)
            ? this.enemyIconHtml(o.enemyType, missionLabel)
            : (huntTarget
                ? this.enemyIconHtml(huntTarget.type, missionLabel)
                : this.iconHtml('menuEnemies', 28, missionLabel));
        const objCard = this.missionCardHtml(missionIcon, missionLabel, missionProgress, 'objectiveHudValue');
        const dailyRow = daily.active
            ? this.countRowHtml(this.enemyIconHtml(daily.enemyType, 'DAILY ' + daily.enemyType), 'DAILY', daily.progress, 'dailyHudValue')
            : '';
        const mission = this.clusterHtml('MISSION', objCard + dailyRow, 'gi-cluster-mission');

        // Player ship stats; anything an upgrade improves lights up.
        const stats = this.trackPlayerStats();
        const combat = this.clusterHtml('SHIP',
            `<div class="gi-metrics gi-metrics-2x2">` +
            stats.map((st) => this.statMetricHtml(st)).join('') +
            `</div>`,
            'gi-cluster-combat'
        );

        // Field loot: same 1-row metric tiles as SHIP.
        const resources = d.resources || [];
        const field = this.clusterHtml('FIELD',
            `<div class="gi-metrics gi-metrics-2x2 gi-metrics-loot">` +
            resources.map((r) => this.lootChipHtml(r)).join('') +
            `</div>`,
            'gi-cluster-field'
        );

        this.body.innerHTML = session;
        if (this.loadoutSide) {
            this.loadoutSide.innerHTML = loadout;
            this.loadoutSide.hidden = false;
        }
        if (this.under) {
            this.under.innerHTML = combat + field;
            this.under.hidden = false;
        }
        if (this.missionSide) {
            this.missionSide.innerHTML = mission;
            this.missionSide.hidden = false;
        }
    }
}
