"use strict";

// EnemyEditorUI methods, split from enemy-editor.js.
extendClass(EnemyEditorUI, {
    show(typeId, tab, fromRestore, options) {
        this.ensureOverlay();
        if (typeId) this.selectedType = String(typeId);
        else if (typeof enemyManager !== 'undefined' && enemyManager.getShipType) {
            this.selectedType = enemyManager.getShipType() || 'enemyBasic';
        }
        if (tab) this.activeTab = tab;
        if (options && options.returnTo) this.returnTo = options.returnTo;
        else if (!fromRestore) this.returnTo = null;
        this.loadDraft();
        this.visible = true;
        document.getElementById('enemyEditorOverlay').classList.remove('hidden');
        this.renderTypeSelect();
        this.renderTabs();
        this.renderControls();
        this.resetPreviewSim();
        this.previewZoom = 1;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.applyPreviewView();
        requestAnimationFrame(() => this.applyPreviewView());
        this.startPreview();
        if (!fromRestore && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('enemy-editor', {
                enemyType: this.selectedType,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    },

    hide() {
        this.visible = false;
        this.setPreviewFullscreen(false);
        const el = document.getElementById('enemyEditorOverlay');
        if (el) el.classList.add('hidden');
        this.stopPreview();
        const backTo = this.returnTo;
        this.returnTo = null;
        if (backTo === 'enemy-viewer' && typeof enemyViewerUI !== 'undefined') {
            enemyViewerUI.show({ enemyType: this.selectedType });
            return;
        }
        if (typeof menuStateManager !== 'undefined') {
            const container = document.querySelector('.game-container');
            const inGame = container && container.style.display !== 'none';
            menuStateManager.setScreen(inGame ? 'ingame' : 'start');
        }
    },

    loadDraft() {
        if (typeof enemyConfigManager === 'undefined') {
            this.draft = {
                id: this.selectedType,
                name: this.selectedType,
                description: '',
                hullId: this.selectedType,
                factions: [],
                planetIds: [],
                galaxyIds: [],
                speed: 1,
                verticalSpeed: 0.3,
                maxHealth: 100,
                armor: 10,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                abilities: [],
                damage: 20,
                shootInterval: 1200,
                evasionCooldown: 3000,
                evasionDuration: 1000,
                evasionSpeed: 2,
                evasionChance: 1,
                predictionSkill: 0.35,
                minY: 25,
                maxY: 100,
                experienceValue: 100,
                defaultWeapon: 'laser',
                weaponDamage: 6,
                weaponSpeed: 5,
                weaponCooldown: 1200,
                explosionId: 'default'
            };
            return;
        }
        this.draft = JSON.parse(JSON.stringify(enemyConfigManager.getConfig(this.selectedType)));
    },

    renderTypeSelect() {
        const root = document.getElementById('eeTypeSelect');
        const label = document.getElementById('eeSelectedLabel');
        if (!root) return;
        root.innerHTML = '';
        const types = typeof enemyConfigManager !== 'undefined'
            ? enemyConfigManager.getTypeIds()
            : ['enemyBasic', 'enemyFast', 'enemyHeavy', 'enemyBoss'];
        const factionOrder = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getFactionOptions
            ? enemyConfigManager.getFactionOptions()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];

        const buckets = {};
        types.forEach((id) => {
            const cfg = typeof enemyConfigManager !== 'undefined'
                ? enemyConfigManager.getConfig(id)
                : null;
            const factions = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
                ? cfg.factions
                : [(typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction
                    ? enemyConfigManager.getDefaultFaction(id)
                    : 'pirate')];
            factions.forEach((f) => {
                const key = f || 'unassigned';
                if (!buckets[key]) buckets[key] = [];
                if (buckets[key].indexOf(id) === -1) buckets[key].push(id);
            });
        });

        const keys = Object.keys(buckets).sort((a, b) => {
            const ai = factionOrder.indexOf(a);
            const bi = factionOrder.indexOf(b);
            const ao = ai === -1 ? 999 : ai;
            const bo = bi === -1 ? 999 : bi;
            if (ao !== bo) return ao - bo;
            return a.localeCompare(b);
        });

        keys.forEach((faction) => {
            const header = document.createElement('div');
            header.className = 'pe-ability-group-title';
            header.style.marginTop = '8px';
            header.textContent = 'FACTION: ' + String(faction).toUpperCase();
            root.appendChild(header);

            buckets[faction].forEach((id) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-planet-btn' + (id === this.selectedType ? ' active' : '');
                btn.style.width = '100%';
                btn.style.textAlign = 'left';
                btn.textContent = typeof enemyConfigManager !== 'undefined'
                    ? enemyConfigManager.getDisplayName(id)
                    : id.toUpperCase();
                btn.addEventListener('click', () => {
                    this.selectedType = id;
                    this.loadDraft();
                    this.renderTypeSelect();
                    this.renderControls();
                    this.resetPreviewSim();
                    this.persistMenuState();
                });
                root.appendChild(btn);
            });
        });

        if (label) {
            const name = typeof enemyConfigManager !== 'undefined'
                ? enemyConfigManager.getDisplayName(this.selectedType)
                : this.selectedType;
            label.textContent = name || this.selectedType;
        }
    },

    renderTabs() {
        const tabs = document.querySelectorAll('#eeTabs .pe-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === this.activeTab);
        });
    },

    renderControls() {
        const root = document.getElementById('eeControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        if (this.activeTab === 'stats') this.renderStatsTab(root);
        else if (this.activeTab === 'behavior') this.renderBehaviorTab(root);
        else if (this.activeTab === 'weapons') this.renderWeaponsTab(root);
        else if (this.activeTab === 'abilities') this.renderAbilitiesTab(root);
        else if (this.activeTab === 'deploy') this.renderDeployTab(root);
        else this.renderArmorTab(root);
    },

    renderStatsTab(root) {
        root.appendChild(this.makeTextInput('Name', this.draft.name || '', (v) => {
            this.draft.name = v;
        }));
        root.appendChild(this.makeTextInput('Description', this.draft.description || '', (v) => {
            this.draft.description = v;
        }));
        const hullOpts = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getHullOptions
            ? enemyConfigManager.getHullOptions()
            : ['fighter', 'interceptor', 'cruiser', 'battleship', 'player', 'player_interceptor', 'player_heavy', 'player_assault'];
        root.appendChild(this.makeSelect('Ship hull', this.draft.hullId || this.selectedType, hullOpts, (v) => {
            this.draft.hullId = v;
            this.resetPreviewSim();
        }));
        root.appendChild(this.makeSlider('Max health', this.draft.maxHealth, 20, 800, 5, (v) => {
            this.draft.maxHealth = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Damage', this.draft.damage, 1, 150, 1, (v) => {
            this.draft.damage = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Speed', this.draft.speed, 0.1, 5, 0.05, (v) => {
            this.draft.speed = v;
        }));
        root.appendChild(this.makeSlider('Vertical speed', this.draft.verticalSpeed, 0.01, 2, 0.01, (v) => {
            this.draft.verticalSpeed = v;
        }));
        root.appendChild(this.makeSlider('XP value', this.draft.experienceValue, 10, 1000, 10, (v) => {
            this.draft.experienceValue = Math.round(v);
        }));
        const explosionIds = (typeof explosionConfigManager !== 'undefined')
            ? explosionConfigManager.getIds()
            : ['default', 'ship_death', 'small_pop', 'asteroid_burst', 'crystal_shatter', 'plasma_bloom'];
        root.appendChild(this.makeSelect('Explosion', this.draft.explosionId || 'default', explosionIds, (v) => {
            this.draft.explosionId = v;
        }));
    },

    renderDeployTab(root) {
        if (!Array.isArray(this.draft.factions)) this.draft.factions = [];
        if (!Array.isArray(this.draft.planetIds)) this.draft.planetIds = [];
        if (!Array.isArray(this.draft.galaxyIds)) this.draft.galaxyIds = [];

        const hint = document.createElement('div');
        hint.className = 'pe-row';
        hint.innerHTML = '<label>Empty planet/galaxy lists = appears everywhere. Factions = default races for this enemy.</label>';
        root.appendChild(hint);

        const factions = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getFactionOptions
            ? enemyConfigManager.getFactionOptions()
            : ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        root.appendChild(this.makeMultiCheck(
            'Factions',
            factions,
            this.draft.factions,
            (next) => { this.draft.factions = next; }
        ));

        const galaxies = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getGalaxyOptions
            ? enemyConfigManager.getGalaxyOptions()
            : ['milky_way', 'andromeda'];
        root.appendChild(this.makeMultiCheck(
            'Galaxies (empty = all)',
            galaxies,
            this.draft.galaxyIds,
            (next) => { this.draft.galaxyIds = next; }
        ));

        const planets = typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getPlanetOptions
            ? enemyConfigManager.getPlanetOptions()
            : ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
        root.appendChild(this.makeMultiCheck(
            'Planets (empty = all)',
            planets,
            this.draft.planetIds,
            (next) => { this.draft.planetIds = next; }
        ));
    },
});
