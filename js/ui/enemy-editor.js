"use strict";

/**
 * Enemy Editor — stats, behavior, weapons, armor, live preview.
 * Open: Enemies viewer → EDIT, or Ctrl+Shift+E
 */
class EnemyEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedType = 'enemyBasic';
        this.activeTab = 'stats';
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewZoom = 1;
        this.previewFullscreen = false;
        this.previewPanX = 0;
        this.previewPanY = 0;
        this.previewPanning = false;
        this.previewPanLastX = 0;
        this.previewPanLastY = 0;
        this.previewSim = null;
        this.previewLastTs = 0;
        this.draft = null;
        this.init();
    }

    init() {
        this.ensureOverlay();
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.visible) {
                if (this.previewFullscreen) {
                    e.preventDefault();
                    this.setPreviewFullscreen(false);
                    return;
                }
                this.hide();
            }
        });
    }

    ensureOverlay() {
        if (document.getElementById('enemyEditorOverlay')) {
            const tabs = document.getElementById('eeTabs');
            if (tabs && !tabs.querySelector('[data-tab="armor"]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-tab';
                btn.dataset.tab = 'armor';
                btn.textContent = 'ARMOR';
                tabs.appendChild(btn);
            }
            if (tabs && !tabs.querySelector('[data-tab="abilities"]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-tab';
                btn.dataset.tab = 'abilities';
                btn.textContent = 'ABILITIES';
                tabs.appendChild(btn);
            }
            if (tabs && !tabs.querySelector('[data-tab="deploy"]')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pe-tab';
                btn.dataset.tab = 'deploy';
                btn.textContent = 'DEPLOY';
                tabs.appendChild(btn);
            }
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'enemyEditorOverlay';
        overlay.className = 'planet-editor-overlay enemy-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>ENEMY EDITOR</h2>
                    <div class="planet-editor-selected" id="eeSelectedLabel"></div>
                </div>
                <div class="planet-editor-tabs" id="eeTabs">
                    <button type="button" data-tab="stats" class="pe-tab active">STATS</button>
                    <button type="button" data-tab="behavior" class="pe-tab">BEHAVIOR</button>
                    <button type="button" data-tab="weapons" class="pe-tab">WEAPONS</button>
                    <button type="button" data-tab="armor" class="pe-tab">ARMOR</button>
                    <button type="button" data-tab="abilities" class="pe-tab">ABILITIES</button>
                    <button type="button" data-tab="deploy" class="pe-tab">DEPLOY</button>
                </div>
                <div class="planet-editor-body" id="eeEditorBody">
                    <aside class="planet-editor-sidebar" id="eeSidebar">
                        <div class="pe-sidebar-title">ENEMIES</div>
                        <div class="pe-tree" id="eeTypeSelect"></div>
                    </aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize enemy list"></div>
                    <div class="planet-editor-controls" id="eeControls"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <div class="planet-editor-preview-wrap" id="eePreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="eeZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="eeZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="eeZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="eeZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="eePreviewFullscreen" title="Fullscreen">FULL</button>
                        </div>
                        <div class="pe-preview-viewport" id="eePreviewViewport">
                            <canvas id="eePreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">LIVE PREVIEW</div>
                    </div>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="eeReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="eeSave">SAVE</button>
                    <button type="button" class="pe-btn" id="eeClose">CLOSE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#eeTabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            this.activeTab = btn.dataset.tab;
            this.renderTabs();
            this.renderControls();
            this.persistMenuState();
        });
        overlay.querySelector('#eeSave').addEventListener('click', () => this.save());
        overlay.querySelector('#eeReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#eeClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#eeZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#eeZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#eeZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#eePreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });

        const viewport = overlay.querySelector('#eePreviewViewport');
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = e.deltaY < 0 ? 0.1 : -0.1;
            this.setPreviewZoom(this.previewZoom + step);
        }, { passive: false });
        viewport.addEventListener('contextmenu', (e) => e.preventDefault());
        viewport.addEventListener('mousedown', (e) => {
            if (e.button !== 2) return;
            e.preventDefault();
            this.previewPanning = true;
            this.previewPanLastX = e.clientX;
            this.previewPanLastY = e.clientY;
            viewport.classList.add('pe-panning');
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.previewPanning) return;
            const dx = e.clientX - this.previewPanLastX;
            const dy = e.clientY - this.previewPanLastY;
            this.previewPanLastX = e.clientX;
            this.previewPanLastY = e.clientY;
            this.previewPanX += dx;
            this.previewPanY += dy;
            this.applyPreviewView();
        });
        const endPan = () => {
            if (!this.previewPanning) return;
            this.previewPanning = false;
            const vp = document.getElementById('eePreviewViewport');
            if (vp) vp.classList.remove('pe-panning');
        };
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 || this.previewPanning) endPan();
        });
        window.addEventListener('blur', endPan);
        window.addEventListener('resize', () => {
            if (this.visible) this.applyPreviewView();
        });

        this.previewCanvas = overlay.querySelector('#eePreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.setupPanelResize(overlay);
        this.applyPreviewView();
    }

    setupPanelResize(overlay) {
        const body = overlay.querySelector('#eeEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: overlay,
            storageKey: 'eePanelWidths',
            defaults: { left: 200, right: 280 },
            mins: { left: 140, right: 180, center: 200 },
            onChange: () => {
                if (this.visible) this.applyPreviewView();
            }
        });
    }

    setPreviewZoom(zoom) {
        this.previewZoom = Math.min(3, Math.max(0.5, Math.round(zoom * 100) / 100));
        this.applyPreviewView();
    }

    setPreviewFullscreen(on) {
        this.previewFullscreen = !!on;
        requestAnimationFrame(() => this.applyPreviewView());
    }

    applyPreviewView() {
        const wrap = document.getElementById('eePreviewWrap');
        const label = document.getElementById('eeZoomLabel');
        const fsBtn = document.getElementById('eePreviewFullscreen');
        const viewport = document.getElementById('eePreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewCanvas.width / this.previewCanvas.height;
            let fitW = availW;
            let fitH = fitW / aspect;
            if (fitH > availH) {
                fitH = availH;
                fitW = fitH * aspect;
            }
            this.previewCanvas.style.width = `${Math.round(fitW)}px`;
            this.previewCanvas.style.height = `${Math.round(fitH)}px`;
            this.previewCanvas.style.transform = `translate(${this.previewPanX}px, ${this.previewPanY}px) scale(${this.previewZoom})`;
        }
    }

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('enemy-editor', {
                enemyType: this.selectedType,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    }

    toggle() {
        if (this.visible) this.hide();
        else this.show();
    }

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
    }

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
    }

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
    }

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
    }

    renderTabs() {
        const tabs = document.querySelectorAll('#eeTabs .pe-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === this.activeTab);
        });
    }

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
    }

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
    }

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
    }

    makeMultiCheck(labelText, options, selected, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'pe-ability-group';
        const title = document.createElement('div');
        title.className = 'pe-ability-group-title';
        title.textContent = labelText;
        wrap.appendChild(title);
        const state = Array.isArray(selected) ? selected.slice() : [];
        options.forEach((opt) => {
            const on = state.indexOf(opt) !== -1;
            wrap.appendChild(this.makeCheckbox(opt, on, (checked) => {
                const idx = state.indexOf(opt);
                if (checked && idx === -1) state.push(opt);
                if (!checked && idx !== -1) state.splice(idx, 1);
                onChange(state.slice());
            }));
        });
        return wrap;
    }

    renderBehaviorTab(root) {
        root.appendChild(this.makeSlider('Shoot interval (ms)', this.draft.shootInterval, 200, 5000, 50, (v) => {
            this.draft.shootInterval = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Evasion cooldown (ms)', this.draft.evasionCooldown, 500, 12000, 100, (v) => {
            this.draft.evasionCooldown = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Evasion duration (ms)', this.draft.evasionDuration, 200, 4000, 50, (v) => {
            this.draft.evasionDuration = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Evasion speed', this.draft.evasionSpeed, 0.1, 8, 0.1, (v) => {
            this.draft.evasionSpeed = v;
        }));
        root.appendChild(this.makeSlider('Evasion chance', this.draft.evasionChance, 0, 1, 0.05, (v) => {
            this.draft.evasionChance = v;
        }));
        root.appendChild(this.makeSlider('Player prediction', this.draft.predictionSkill, 0, 1, 0.05, (v) => {
            this.draft.predictionSkill = v;
        }));
        root.appendChild(this.makeSlider('Min Y', this.draft.minY, 0, 150, 1, (v) => {
            this.draft.minY = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Max Y', this.draft.maxY, 40, 250, 1, (v) => {
            this.draft.maxY = Math.round(v);
        }));
    }

    renderWeaponsTab(root) {
        const weapons = typeof enemyConfigManager !== 'undefined'
            ? enemyConfigManager.availableWeapons
            : ['laser', 'plasma', 'spread', 'rapid'];
        root.appendChild(this.makeSelect('Default weapon', this.draft.defaultWeapon || 'laser', weapons, (v) => {
            this.draft.defaultWeapon = v;
        }));
        root.appendChild(this.makeSlider('Weapon damage', this.draft.weaponDamage, 1, 60, 1, (v) => {
            this.draft.weaponDamage = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Weapon speed', this.draft.weaponSpeed, 1, 12, 0.5, (v) => {
            this.draft.weaponSpeed = v;
        }));
        root.appendChild(this.makeSlider('Weapon cooldown (ms)', this.draft.weaponCooldown, 100, 4000, 50, (v) => {
            this.draft.weaponCooldown = Math.round(v);
        }));
    }

    renderArmorTab(root) {
        if (!Array.isArray(this.draft.defenseMechanisms)) {
            this.draft.defenseMechanisms = [];
        }
        if (this.draft.shieldMax == null) this.draft.shieldMax = 0;
        if (this.draft.shieldRegen == null) this.draft.shieldRegen = 0;
        if (this.draft.damageReduction == null) this.draft.damageReduction = 0;
        if (this.draft.reflectChance == null) this.draft.reflectChance = 0;

        root.appendChild(this.makeSlider('Armor', this.draft.armor, 0, 120, 1, (v) => {
            this.draft.armor = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Shield capacity', this.draft.shieldMax, 0, 300, 5, (v) => {
            this.draft.shieldMax = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Shield regen /s', this.draft.shieldRegen, 0, 40, 0.5, (v) => {
            this.draft.shieldRegen = v;
        }));
        root.appendChild(this.makeSlider('Damage reduction %', this.draft.damageReduction, 0, 80, 1, (v) => {
            this.draft.damageReduction = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Reflect chance %', this.draft.reflectChance, 0, 100, 1, (v) => {
            this.draft.reflectChance = Math.round(v);
        }));
    }

    syncEnemyAbilities(list) {
        this.draft.abilities = list.slice();
        this.draft.defenseMechanisms = list.slice();
    }

    getAbilityMeta(id) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.getMeta(id);
        }
        return { icon: '◆', cluster: 'other', name: id };
    }

    renderAbilitiesTab(root) {
        if (!Array.isArray(this.draft.abilities)) {
            this.draft.abilities = (this.draft.defenseMechanisms || []).slice();
        }
        const abilities = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.getIds()
            : (typeof enemyConfigManager !== 'undefined'
                ? enemyConfigManager.availableAbilities
                : []);
        const current = this.draft.abilities || [];
        const clusterOrder = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.clusterOrder
            : [
                { id: 'core', label: 'CORE' },
                { id: 'mobility', label: 'MOBILITY' },
                { id: 'offense', label: 'OFFENSE' },
                { id: 'defense', label: 'DEFENSE' },
                { id: 'combat', label: 'COMBAT' },
                { id: 'other', label: 'OTHER' }
            ];
        const grouped = {};
        abilities.forEach((a) => {
            const cluster = this.getAbilityMeta(a).cluster;
            if (!grouped[cluster]) grouped[cluster] = [];
            grouped[cluster].push(a);
        });

        const hint = document.createElement('div');
        hint.className = 'pe-row';
        hint.innerHTML = '<label>Shared ability pool (same as player ships)</label>';
        root.appendChild(hint);

        clusterOrder.forEach((cluster) => {
            const list = grouped[cluster.id];
            if (!list || !list.length) return;

            const group = document.createElement('div');
            group.className = 'pe-ability-group';
            const title = document.createElement('div');
            title.className = 'pe-ability-group-title';
            title.textContent = cluster.label;
            group.appendChild(title);

            list.forEach((a) => {
                const on = current.indexOf(a) !== -1;
                const meta = this.getAbilityMeta(a);
                const label = meta.name || a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                group.appendChild(this.makeCheckbox(label, on, (checked) => {
                    const next = (this.draft.abilities || []).slice();
                    if (checked) {
                        if (next.indexOf(a) === -1) next.push(a);
                    } else {
                        const idx = next.indexOf(a);
                        if (idx !== -1) next.splice(idx, 1);
                    }
                    this.syncEnemyAbilities(next);
                }, meta.icon));
            });

            root.appendChild(group);
        });
    }

    makeSlider(labelText, value, min, max, step, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const val = document.createElement('span');
        val.className = 'pe-val';
        const format = (v) => (step < 1 ? Number(v).toFixed(2) : String(Math.round(v)));
        val.textContent = format(value);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('input', () => {
            const v = Number(input.value);
            val.textContent = format(v);
            onChange(v);
        });
        row.appendChild(label);
        row.appendChild(val);
        row.appendChild(input);
        return row;
    }

    makeSelect(labelText, value, options, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === value) o.selected = true;
            select.appendChild(o);
        });
        select.addEventListener('change', () => onChange(select.value));
        row.appendChild(label);
        row.appendChild(select);
        return row;
    }

    makeTextInput(labelText, value, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.className = 'pe-text-input';
        input.addEventListener('input', () => onChange(input.value));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    }

    makeCheckbox(labelText, checked, onChange, icon) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-row-check';
        const label = document.createElement('label');
        if (icon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'pe-ability-icon';
            if (typeof abilityConfigManager !== 'undefined' && String(icon).indexOf('ability_') === 0) {
                iconEl.innerHTML = abilityConfigManager.resolveIconHtml(icon, 16, 'cv-ability-icon-img');
            } else {
                iconEl.textContent = icon;
            }
            label.appendChild(iconEl);
            label.appendChild(document.createTextNode(labelText));
        } else {
            label.textContent = labelText;
        }
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    }

    save() {
        if (typeof enemyConfigManager === 'undefined' || !this.draft) return;
        if (Array.isArray(this.draft.abilities)) {
            this.draft.defenseMechanisms = this.draft.abilities.slice();
        } else if (Array.isArray(this.draft.defenseMechanisms)) {
            this.draft.abilities = this.draft.defenseMechanisms.slice();
        }
        enemyConfigManager.setConfig(this.selectedType, this.draft);
        enemyConfigManager.applyToRuntime(this.selectedType);
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        const header = document.querySelector('#enemyEditorOverlay .planet-editor-header h2');
        if (header) {
            const prev = header.textContent;
            header.textContent = 'SAVED';
            setTimeout(() => { header.textContent = prev || 'ENEMY EDITOR'; }, 700);
        }
    }

    reset() {
        if (typeof enemyConfigManager === 'undefined') return;
        enemyConfigManager.resetConfig(this.selectedType);
        this.loadDraft();
        this.renderControls();
    }

    startPreview() {
        this.stopPreview();
        this.previewLastTs = 0;
        if (!this.previewSim) this.resetPreviewSim();
        const loop = () => {
            if (!this.visible) return;
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(loop);
        };
        this.previewAnimId = requestAnimationFrame(loop);
    }

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewLastTs = 0;
    }

    getPreviewModel() {
        const hullId = (this.draft && this.draft.hullId)
            || (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getHullId
                ? enemyConfigManager.getHullId(this.selectedType)
                : this.selectedType);
        let base = null;
        if (typeof graphicsManager !== 'undefined') {
            if (graphicsManager.shipAssetLoader && graphicsManager.shipAssetLoader.isLoaded()) {
                base = graphicsManager.shipAssetLoader.getShip(hullId);
            } else if (graphicsManager.shipModels) {
                base = graphicsManager.shipModels.getShipModel(hullId);
            }
        }
        const model = Object.assign({}, base || {
            width: 18,
            height: 14,
            sprite: null
        }, this.draft || {});
        model.forceEnemyOrientation = true;
        return model;
    }

    resetPreviewSim() {
        const w = 200;
        const h = 300;
        const model = this.getPreviewModel();
        const shipW = Math.max(8, Math.round(model.width || 18));
        const shipH = Math.max(8, Math.round(model.height || 14));
        const minY = Number(this.draft && this.draft.minY != null ? this.draft.minY : 25);
        const maxY = Number(this.draft && this.draft.maxY != null ? this.draft.maxY : 100);
        this.previewSim = {
            enemy: {
                x: w / 2 - shipW / 2,
                y: minY,
                width: shipW,
                height: shipH,
                speed: Number(this.draft && this.draft.speed != null ? this.draft.speed : 1),
                verticalSpeed: Number(this.draft && this.draft.verticalSpeed != null ? this.draft.verticalSpeed : 0.3),
                minY,
                maxY
            },
            player: {
                x: w / 2 - 12,
                y: h - 36,
                width: 24,
                height: 20,
                vx: 0
            },
            enemyBullets: [],
            playerBullets: [],
            enemyShootAcc: 0,
            playerShootAcc: 400,
            evasionTimer: Number(this.draft && this.draft.evasionCooldown != null ? this.draft.evasionCooldown : 2000),
            isEvading: false,
            hitFlash: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    }

    syncPreviewEnemyFromDraft() {
        const sim = this.previewSim;
        const d = this.draft;
        if (!sim || !d) return;
        const model = this.getPreviewModel();
        const shipW = Math.max(8, Math.round(model.width || 18));
        const shipH = Math.max(8, Math.round(model.height || 14));
        const e = sim.enemy;
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height / 2;
        e.width = shipW;
        e.height = shipH;
        e.x = cx - shipW / 2;
        e.y = cy - shipH / 2;
        const signX = e.speed >= 0 ? 1 : -1;
        const signY = e.verticalSpeed >= 0 ? 1 : -1;
        e.speed = signX * Math.abs(Number(d.speed));
        e.verticalSpeed = signY * Math.abs(Number(d.verticalSpeed));
        e.minY = Number(d.minY);
        e.maxY = Number(d.maxY);
        e.y = Math.max(e.minY, Math.min(e.maxY, e.y));
        e.x = Math.max(0, Math.min(200 - e.width, e.x));
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const d = this.draft;
        if (!sim || !d) return;

        this.syncPreviewEnemyFromDraft();
        const e = sim.enemy;
        const p = sim.player;
        const frameScale = dtMs / 16.67;

        // --- Invisible player AI: track enemy + wander slightly ---
        const targetX = e.x + e.width / 2 - p.width / 2;
        const track = (targetX - p.x) * 0.04 * frameScale;
        p.vx = p.vx * 0.85 + track + Math.sin(sim.starPhase * 0.7) * 0.15;
        p.x += p.vx;
        p.x = Math.max(4, Math.min(200 - p.width - 4, p.x));
        p.y = 300 - 36 + Math.sin(sim.starPhase * 1.2) * 2;

        // Player shoots at enemy
        sim.playerShootAcc += dtMs;
        const playerInterval = 520;
        if (sim.playerShootAcc >= playerInterval) {
            sim.playerShootAcc = 0;
            const aimX = e.x + e.width / 2 + (Math.random() - 0.5) * 10;
            sim.playerBullets.push({
                x: p.x + p.width / 2 - 1.5,
                y: p.y,
                width: 3,
                height: 10,
                vx: (aimX - (p.x + p.width / 2)) * 0.02,
                speed: 4.2,
                color: '#e07028'
            });
        }

        // --- Enemy patrol ---
        if (!sim.isEvading) {
            e.x += e.speed * frameScale;
            e.y += e.verticalSpeed * frameScale;
            if (e.x <= 0) {
                e.x = 0;
                e.speed = Math.abs(e.speed);
            } else if (e.x >= 200 - e.width) {
                e.x = 200 - e.width;
                e.speed = -Math.abs(e.speed);
            }
            if (e.y <= e.minY) {
                e.y = e.minY;
                e.verticalSpeed = Math.abs(e.verticalSpeed);
            } else if (e.y >= e.maxY) {
                e.y = e.maxY;
                e.verticalSpeed = -Math.abs(e.verticalSpeed);
            }
        }

        // --- Evasion vs player bullets ---
        const evasionCooldown = Number(d.evasionCooldown) || 2000;
        const evasionDuration = Number(d.evasionDuration) || 800;
        const evasionSpeed = Number(d.evasionSpeed) || 2;
        sim.evasionTimer += dtMs;

        if (!sim.isEvading && sim.evasionTimer >= evasionCooldown) {
            for (const b of sim.playerBullets) {
                const dx = (b.x + b.width / 2) - (e.x + e.width / 2);
                const dy = (b.y + b.height / 2) - (e.y + e.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) < 90) {
                    sim.isEvading = true;
                    sim.evasionTimer = 0;
                    break;
                }
            }
        }

        if (sim.isEvading) {
            if (sim.evasionTimer >= evasionDuration) {
                sim.isEvading = false;
                sim.evasionTimer = 0;
            } else if (sim.playerBullets.length) {
                let closest = sim.playerBullets[0];
                let closestDist = Infinity;
                const ecx = e.x + e.width / 2;
                const ecy = e.y + e.height / 2;
                for (const b of sim.playerBullets) {
                    const dx = (b.x + b.width / 2) - ecx;
                    const dy = (b.y + b.height / 2) - ecy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = b;
                    }
                }
                const bcx = closest.x + closest.width / 2;
                const bcy = closest.y + closest.height / 2;
                let edx = ecx - bcx;
                let edy = ecy - bcy;
                const mag = Math.sqrt(edx * edx + edy * edy) || 1;
                const strength = Math.max(0.6, 1.0 - closestDist / 100);
                e.x += (edx / mag) * evasionSpeed * strength * frameScale;
                e.y += (edy / mag) * evasionSpeed * strength * frameScale;
                e.x = Math.max(0, Math.min(200 - e.width, e.x));
                e.y = Math.max(e.minY, Math.min(e.maxY, e.y));
            }
        }

        // --- Enemy shooting ---
        sim.enemyShootAcc += dtMs;
        const shootInterval = Math.max(200, Number(d.shootInterval) || 1200);
        if (sim.enemyShootAcc >= shootInterval) {
            sim.enemyShootAcc = 0;
            this.spawnPreviewEnemyShot(sim, d);
        }

        // --- Move bullets ---
        for (let i = sim.playerBullets.length - 1; i >= 0; i--) {
            const b = sim.playerBullets[i];
            b.x += (b.vx || 0) * frameScale;
            b.y -= b.speed * frameScale;
            if (b.y + b.height < 0 || b.x < -20 || b.x > 220) {
                sim.playerBullets.splice(i, 1);
                continue;
            }
            if (this.rectsOverlap(b, e)) {
                sim.playerBullets.splice(i, 1);
                sim.hitFlash = 180;
            }
        }

        for (let i = sim.enemyBullets.length - 1; i >= 0; i--) {
            const b = sim.enemyBullets[i];
            if (b.angle != null) {
                b.x += Math.sin(b.angle) * b.speed * frameScale;
                b.y += Math.cos(b.angle) * b.speed * frameScale;
            } else {
                b.x += (b.vx || 0) * frameScale;
                b.y += b.speed * frameScale;
            }
            if (b.y > 310 || b.x < -30 || b.x > 230) {
                sim.enemyBullets.splice(i, 1);
                continue;
            }
            // Invisible player still "blocks"/absorbs shots for feedback
            if (this.rectsOverlap(b, p)) {
                sim.enemyBullets.splice(i, 1);
            }
        }

        if (sim.hitFlash > 0) sim.hitFlash = Math.max(0, sim.hitFlash - dtMs);
        sim.starPhase += 0.04 * frameScale;
    }

    spawnPreviewEnemyShot(sim, d) {
        const e = sim.enemy;
        const p = sim.player;
        const weapon = String(d.defaultWeapon || 'laser');
        const speed = Number(d.weaponSpeed) || 5;
        const damage = Number(d.weaponDamage) || 6;
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height;
        const aimDx = (p.x + p.width / 2) - cx;
        const aimVx = Math.max(-1.2, Math.min(1.2, aimDx * 0.015));

        const push = (bullet) => {
            if (sim.enemyBullets.length < 8) sim.enemyBullets.push(bullet);
        };

        if (weapon === 'spread') {
            [-0.35, 0, 0.35].forEach((angle) => {
                push({
                    x: cx - 1.5,
                    y: cy,
                    width: 3,
                    height: 10,
                    speed,
                    damage,
                    angle,
                    color: '#c05050',
                    type: 'enemy_spread'
                });
            });
        } else if (weapon === 'rapid') {
            push({
                x: cx - 1,
                y: cy,
                width: 2,
                height: 8,
                speed: speed * 1.25,
                vx: aimVx,
                damage,
                color: '#e09040',
                type: 'enemy_rapid'
            });
        } else if (weapon === 'plasma') {
            push({
                x: cx - 3,
                y: cy,
                width: 6,
                height: 6,
                speed: speed * 0.85,
                vx: aimVx * 0.6,
                damage,
                color: '#70c0e0',
                type: 'enemy_plasma'
            });
        } else {
            push({
                x: cx - 1.5,
                y: cy,
                width: 3,
                height: 12,
                speed,
                vx: aimVx,
                damage,
                color: '#a0a0a0',
                type: 'enemy_laser'
            });
        }
    }

    rectsOverlap(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x &&
            a.y < b.y + b.height && a.y + a.height > b.y;
    }

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        if (!canvas || !ctx || !this.draft) return;

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 97) % w;
            const sy = (i * 53 + Math.floor(sim.starPhase * 20)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        // Enemy bullets
        for (const b of sim.enemyBullets) {
            ctx.fillStyle = b.color || '#c06040';
            if (b.type === 'enemy_plasma') {
                ctx.beginPath();
                ctx.arc(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(b.x, b.y, b.width, b.height);
            }
        }

        // Player bullets (visible — player ship is not)
        for (const b of sim.playerBullets) {
            ctx.fillStyle = b.color || '#e07028';
            ctx.fillRect(b.x, b.y, b.width, b.height);
        }

        const model = this.getPreviewModel();
        const e = sim.enemy;
        let rendered = false;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            const prev = graphicsManager.currentEnemyModel;
            graphicsManager.currentEnemyModel = model;
            try {
                if (sim.hitFlash > 0) {
                    ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(sim.hitFlash * 0.08));
                }
                graphicsManager.renderEnemyShip(ctx, {
                    x: e.x,
                    y: e.y,
                    width: e.width,
                    height: e.height,
                    type: this.selectedType
                }, 1);
                rendered = true;
            } finally {
                ctx.globalAlpha = 1;
                graphicsManager.currentEnemyModel = prev;
            }
        }
        if (!rendered) {
            if (model.sprite) this.drawPixelSprite(ctx, model, e.x, e.y, 1);
            else {
                ctx.fillStyle = sim.hitFlash > 0 ? '#fff' : '#e07028';
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
        }

        // Evasion indicator ring
        if (sim.isEvading) {
            ctx.strokeStyle = 'rgba(224, 112, 40, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(e.x + e.width / 2, e.y + e.height / 2, Math.max(e.width, e.height) * 0.85, 0, Math.PI * 2);
            ctx.stroke();
        }

        // HUD
        ctx.fillStyle = '#e07028';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(this.draft.name || this.selectedType).toUpperCase(), w / 2, h - 46);
        ctx.fillStyle = '#b09070';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(`HP ${this.draft.maxHealth}  SPD ${Number(this.draft.speed).toFixed(2)}`, w / 2, h - 32);
        ctx.fillText(`ARM ${this.draft.armor}  SHD ${this.draft.shieldMax || 0}  DMG ${this.draft.damage}`, w / 2, h - 20);
        const evadeTag = sim.isEvading ? ' EVADE' : '';
        ctx.fillText(`SHOT ${this.draft.shootInterval}ms  ${String(this.draft.defaultWeapon || '').toUpperCase()}${evadeTag}`, w / 2, h - 8);
    }

    drawPixelSprite(ctx, model, x, y, scale) {
        const sprite = model.sprite;
        if (!sprite || !sprite.length) return;
        const colors = model.colors || {
            0: 'transparent',
            1: '#404040',
            2: '#808080',
            3: '#C0C0C0'
        };
        const rows = sprite.length;
        const cols = sprite[0].length;
        const pw = (model.width * scale) / cols;
        const ph = (model.height * scale) / rows;
        ctx.save();
        // Flip vertically like enemies
        ctx.translate(x + (model.width * scale) / 2, y + (model.height * scale) / 2);
        ctx.scale(1, -1);
        ctx.translate(-(model.width * scale) / 2, -(model.height * scale) / 2);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = sprite[r][c];
                if (!v) continue;
                let color = colors[v] || '#888';
                if (typeof color === 'string' && color.indexOf('var(') === 0) {
                    color = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#e07028';
                }
                ctx.fillStyle = color;
                ctx.fillRect(c * pw, r * ph, Math.ceil(pw), Math.ceil(ph));
            }
        }
        ctx.restore();
    }
}

const enemyEditorUI = new EnemyEditorUI();
