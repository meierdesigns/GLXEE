"use strict";

// LevelInfoManager methods, split from level-info-manager.js.
extendClass(LevelInfoManager, {
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    },

    updateStats(stats) {
        this.stats = { ...this.stats, ...stats };
        this.updateElement('currentScore', this.stats.score);
        this.updateElement('enemiesKilled', this.stats.enemiesKilled);
    },

    startLevel() {
        this.stats.startTime = Date.now();
        this.stats.levelTime = 0;
        this._timeString = '00:00';
        this.prepareForCombat();
        this.updateElement('levelTime', this._timeString);
    },

    endLevel() {
        this.stopUpdateLoop();
        // Keep the panel mounted during game-over / transition so the next
        // mission start does not flash an empty vitals-only HUD.
    },

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
    },

    stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    },

    collectPlanetObstacles(planetId) {
        if (typeof planetConfigManager === 'undefined' || !planetId) return [];
        const cfg = planetConfigManager.getConfig(planetId);
        if (!cfg) return [];
        const types = (Array.isArray(cfg.obstacles) && cfg.obstacles.length)
            ? cfg.obstacles.map((o) => (o && (o.type || o.id)) || o)
            : (cfg.obstacleTypes || []);
        // One chip per obstacle kind (small/medium asteroid -> ASTEROID);
        // the sizes go into the chip tooltip.
        const kinds = {};
        const order = [];
        types.forEach((t) => {
            if (!t) return;
            const parts = String(t).toLowerCase().split('_');
            const kind = parts[parts.length - 1];
            const size = parts.slice(0, -1).join(' ');
            if (!kinds[kind]) { kinds[kind] = []; order.push(kind); }
            if (size && kinds[kind].indexOf(size) === -1) kinds[kind].push(size);
        });
        return order.map((kind) => ({
            name: kind.charAt(0).toUpperCase() + kind.slice(1),
            sizes: kinds[kind]
        }));
    },

    collectEquippedWeapons() {
        if (typeof shipLoadoutManager === 'undefined' || typeof profileManager === 'undefined'
            || !profileManager.getActiveShipId) return [];
        const ids = (shipLoadoutManager.getLoadout(profileManager.getActiveShipId()).weapons || []);
        const seen = {};
        return ids.filter((id) => id && !seen[id] && (seen[id] = true)).map((id) => {
            const w = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(id) : null;
            return { name: (w && w.name) || id, id: id, count: ids.filter((x) => x === id).length };
        });
    },

    collectLevelData() {
        const levelData = {
            name: 'MARS — STAGE 1/3',
            difficulty: 'EASY',
            enemyType: 'enemyBasic',
            enemySpeed: '0.8',
            enemyHealth: '100',
            enemyCount: '5',
            obstacles: [],
            obstacleSpawnRate: 1000,
            playerShipType: 'Starfighter',
            playerSpeed: '1.0',
            playerMaxHealth: '100',
            currentWeapon: 'Laser',
            weapons: []
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
        // FIELD shows only what this run really has: the planet's obstacle
        // types and the weapons equipped on the flying ship.
        levelData.obstacles = this.collectPlanetObstacles(levelData.planetId);
        levelData.weapons = this.collectEquippedWeapons();

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
    },

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
    },

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
    },
});
