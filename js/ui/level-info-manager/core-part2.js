"use strict";

// LevelInfoManager members, continued from core.js (kept under ~500 lines per file).
extendClass(LevelInfoManager, {
    renderBody() {
        if (!this.body) return;
        const d = this.levelData;
        const obj = this.getObjectiveBits();
        const daily = this.getDailyBits();
        const weaponId = (typeof bulletManager !== 'undefined' && bulletManager.currentWeapon)
            ? bulletManager.currentWeapon
            : (d.currentWeapon || 'laser');
        const nameOf = (id) => ((typeof iconRenderer !== 'undefined' && iconRenderer.weaponIconInfo)
            ? iconRenderer.weaponIconInfo(id).name
            : String(id).toUpperCase());
        // Every weapon fitted in the hangar, not just the one currently selected.
        const sm = typeof bulletManager !== 'undefined' ? bulletManager.currentShipModel : null;
        const fitted = (sm && sm.loadout && Array.isArray(sm.loadout.weapons) && sm.loadout.weapons.length)
            ? sm.loadout.weapons.filter((w, i, a) => w && a.indexOf(w) === i)
            : [weaponId];
        const weaponName = fitted.map(nameOf).join(' · ');

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
    },
});
