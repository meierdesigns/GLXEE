"use strict";

/**
 * Ship Editor — stats, weapons, abilities, live preview.
 * Open: Ships viewer → EDIT / NEW, or Ctrl+Shift+S
 */
class ShipEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedType = 'player';
        this.activeTab = 'stats';
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewBaseWidth = 200;
        this.previewBaseHeight = 300;
        this.previewBackingScale = 1;
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
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
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
        if (document.getElementById('shipEditorOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'shipEditorOverlay';
        overlay.className = 'planet-editor-overlay ship-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>SHIP EDITOR</h2>
                    <div class="planet-editor-selected" id="seSelectedLabel"></div>
                </div>
                <div class="planet-editor-tabs" id="seTabs">
                    <button type="button" data-tab="stats" class="pe-tab active">STATS</button>
                    <button type="button" data-tab="weapons" class="pe-tab">WEAPONS</button>
                    <button type="button" data-tab="abilities" class="pe-tab">ABILITIES</button>
                    <button type="button" data-tab="graphics" class="pe-tab">GRAPHICS</button>
                </div>
                <div class="planet-editor-body" id="seEditorBody">
                    <aside class="planet-editor-sidebar" id="seSidebar">
                        <div class="pe-sidebar-title">SHIPS</div>
                        <div class="pe-tree" id="seTypeSelect"></div>
                    </aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ship list"></div>
                    <div class="planet-editor-controls" id="seControls"></div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <div class="planet-editor-preview-wrap" id="sePreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="seZoomOut" title="Zoom out">−</button>
                            <span class="pe-zoom-label" id="seZoomLabel">100%</span>
                            <button type="button" class="pe-btn pe-preview-btn" id="seZoomIn" title="Zoom in">+</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="seZoomReset" title="Reset zoom">1:1</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="sePreviewFullscreen" title="Fullscreen">FULL</button>
                            <button type="button" class="pe-btn pe-preview-btn" id="seRerollShape" title="Generate new part shapes">REROLL SHAPE</button>
                        </div>
                        <div class="pe-preview-viewport" id="sePreviewViewport">
                            <canvas id="sePreview" width="200" height="300"></canvas>
                        </div>
                        <div class="pe-preview-label">LIVE PREVIEW</div>
                    </div>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="seNew">NEW</button>
                    <button type="button" class="pe-btn" id="seReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="seSave">SAVE</button>
                    <button type="button" class="pe-btn" id="seClose">CLOSE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#seTabs').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            this.activeTab = btn.dataset.tab;
            this.renderTabs();
            this.renderControls();
            this.persistMenuState();
        });
        overlay.querySelector('#seSave').addEventListener('click', () => this.save());
        overlay.querySelector('#seReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#seNew').addEventListener('click', () => this.createNew());
        overlay.querySelector('#seClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#seZoomOut').addEventListener('click', () => this.setPreviewZoom(this.previewZoom - 0.25));
        overlay.querySelector('#seZoomIn').addEventListener('click', () => this.setPreviewZoom(this.previewZoom + 0.25));
        overlay.querySelector('#seZoomReset').addEventListener('click', () => {
            this.previewPanX = 0;
            this.previewPanY = 0;
            this.setPreviewZoom(1);
        });
        overlay.querySelector('#sePreviewFullscreen').addEventListener('click', () => {
            this.setPreviewFullscreen(!this.previewFullscreen);
        });
        overlay.querySelector('#seRerollShape').addEventListener('click', () => this.rerollHullShape());

        const viewport = overlay.querySelector('#sePreviewViewport');
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
            const vp = document.getElementById('sePreviewViewport');
            if (vp) vp.classList.remove('pe-panning');
        };
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2 || this.previewPanning) endPan();
        });
        window.addEventListener('blur', endPan);
        window.addEventListener('resize', () => {
            if (this.visible) this.applyPreviewView();
        });

        this.previewCanvas = overlay.querySelector('#sePreview');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.setupPanelResize(overlay);
        this.applyPreviewView();
    }

    setupPanelResize(overlay) {
        const body = overlay.querySelector('#seEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        this._panelResize = setupPanelResize({
            body,
            root: overlay,
            storageKey: 'sePanelWidths',
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

    /** Picks a new random per-part shape combination for the ship being edited. */
    rerollHullShape() {
        if (typeof profileManager === 'undefined' || !profileManager.setHullShapeSeed) return;
        const shipId = this.selectedType;
        if (!shipId) return;
        const seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        profileManager.setHullShapeSeed(shipId, seed);
        // Animation loop repaints every frame; no forced redraw needed.
    }

    applyPreviewView() {
        const wrap = document.getElementById('sePreviewWrap');
        const label = document.getElementById('seZoomLabel');
        const fsBtn = document.getElementById('sePreviewFullscreen');
        const viewport = document.getElementById('sePreviewViewport');
        if (wrap) wrap.classList.toggle('pe-preview-fs', this.previewFullscreen);
        if (label) label.textContent = `${Math.round(this.previewZoom * 100)}%`;
        if (fsBtn) fsBtn.textContent = this.previewFullscreen ? 'EXIT' : 'FULL';
        if (this.previewCanvas && viewport) {
            const pad = 8;
            const availW = Math.max(140, viewport.clientWidth - pad);
            const availH = Math.max(200, viewport.clientHeight - pad);
            const aspect = this.previewBaseWidth / this.previewBaseHeight;
            let fitW = availW;
            let fitH = fitW / aspect;
            if (fitH > availH) {
                fitH = availH;
                fitW = fitH * aspect;
            }
            const cssW = fitW * this.previewZoom;
            const cssH = fitH * this.previewZoom;
            const dpr = window.devicePixelRatio || 1;
            // Bake zoom into the canvas backing store so pixel art is regenerated
            // crisp at the target resolution instead of CSS-stretching a fixed bitmap.
            this.previewBackingScale = (cssW * dpr) / this.previewBaseWidth;
            const backingW = Math.max(1, Math.round(this.previewBaseWidth * this.previewBackingScale));
            const backingH = Math.max(1, Math.round(this.previewBaseHeight * this.previewBackingScale));
            if (this.previewCanvas.width !== backingW || this.previewCanvas.height !== backingH) {
                this.previewCanvas.width = backingW;
                this.previewCanvas.height = backingH;
            }
            this.previewCanvas.style.width = `${Math.round(cssW)}px`;
            this.previewCanvas.style.height = `${Math.round(cssH)}px`;
            this.previewCanvas.style.transform = `translate(${this.previewPanX}px, ${this.previewPanY}px)`;
        }
    }

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('ship-editor', {
                shipId: this.selectedType,
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
        if (tab) this.activeTab = tab;
        if (options && options.returnTo) this.returnTo = options.returnTo;
        else if (!fromRestore) this.returnTo = null;
        this.loadDraft();
        this.visible = true;
        document.getElementById('shipEditorOverlay').classList.remove('hidden');
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
            menuStateManager.setScreen('ship-editor', {
                shipId: this.selectedType,
                tab: this.activeTab,
                returnTo: this.returnTo
            });
        }
    }

    hide() {
        this.visible = false;
        this.setPreviewFullscreen(false);
        const el = document.getElementById('shipEditorOverlay');
        if (el) el.classList.add('hidden');
        this.stopPreview();
        const backTo = this.returnTo;
        this.returnTo = null;
        if (backTo === 'ship-viewer' && typeof shipViewerUI !== 'undefined') {
            shipViewerUI.show({ shipId: this.selectedType });
            return;
        }
        if (typeof menuStateManager !== 'undefined') {
            const container = document.querySelector('.game-container');
            const inGame = container && container.style.display !== 'none';
            menuStateManager.setScreen(inGame ? 'ingame' : 'start');
        }
    }

    loadDraft() {
        if (typeof shipConfigManager === 'undefined') {
            this.draft = {
                id: this.selectedType,
                name: this.selectedType,
                description: '',
                modelClass: 'starfighter',
                speed: 4,
                maxHealth: 100,
                armor: 15,
                damage: 25,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'laser',
                availableWeapons: ['laser'],
                weaponDamage: 10,
                weaponSpeed: 8,
                weaponCooldown: 300,
                abilities: [],
                tier: 1,
                cost: 0
            };
            return;
        }
        this.draft = JSON.parse(JSON.stringify(shipConfigManager.getConfig(this.selectedType)));
    }

    createNew() {
        if (typeof shipConfigManager === 'undefined') return;
        const ship = shipConfigManager.createShip({
            baseId: this.selectedType,
            name: 'New Ship'
        });
        this.selectedType = ship.id;
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        this.resetPreviewSim();
        this.persistMenuState();
    }

    renderTypeSelect() {
        const root = document.getElementById('seTypeSelect');
        const label = document.getElementById('seSelectedLabel');
        if (!root) return;
        root.innerHTML = '';
        const types = typeof shipConfigManager !== 'undefined'
            ? shipConfigManager.getTypeIds()
            : ['player', 'player_interceptor', 'player_heavy', 'player_assault'];
        types.forEach((id) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-planet-btn' + (id === this.selectedType ? ' active' : '');
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.textContent = typeof shipConfigManager !== 'undefined'
                ? shipConfigManager.getDisplayName(id)
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
        if (label) {
            const name = typeof shipConfigManager !== 'undefined'
                ? shipConfigManager.getDisplayName(this.selectedType)
                : this.selectedType;
            label.textContent = name || this.selectedType;
        }
    }

    renderTabs() {
        const tabs = document.querySelectorAll('#seTabs .pe-tab');
        tabs.forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === this.activeTab);
        });
    }

    renderControls() {
        const root = document.getElementById('seControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        if (this.activeTab === 'stats') this.renderStatsTab(root);
        else if (this.activeTab === 'weapons') this.renderWeaponsTab(root);
        else if (this.activeTab === 'abilities') this.renderAbilitiesTab(root);
        else this.renderGraphicsTab(root);
    }

    renderStatsTab(root) {
        root.appendChild(this.makeTextInput('Name', this.draft.name || '', (v) => {
            this.draft.name = v;
        }));
        root.appendChild(this.makeTextInput('Description', this.draft.description || '', (v) => {
            this.draft.description = v;
        }));
        const modelClasses = ['starfighter', 'interceptor', 'heavy_fighter', 'assault'];
        root.appendChild(this.makeSelect('Model class', this.draft.modelClass || 'starfighter', modelClasses, (v) => {
            this.draft.modelClass = v;
            this.resetPreviewSim();
        }));
        root.appendChild(this.makeSlider('Max health', this.draft.maxHealth, 20, 400, 5, (v) => {
            this.draft.maxHealth = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Armor', this.draft.armor, 0, 100, 1, (v) => {
            this.draft.armor = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Damage', this.draft.damage, 1, 100, 1, (v) => {
            this.draft.damage = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Speed', this.draft.speed, 0.5, 10, 0.1, (v) => {
            this.draft.speed = v;
        }));
        root.appendChild(this.makeSlider('Min Y', this.draft.minY, 100, 280, 1, (v) => {
            this.draft.minY = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Max Y', this.draft.maxY, 150, 320, 1, (v) => {
            this.draft.maxY = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Tier', this.draft.tier, 1, 5, 1, (v) => {
            this.draft.tier = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Cost', this.draft.cost, 0, 500, 5, (v) => {
            this.draft.cost = Math.round(v);
        }));
    }

    renderWeaponsTab(root) {
        const weapons = typeof shipConfigManager !== 'undefined'
            ? shipConfigManager.availableWeapons
            : ['laser', 'plasma', 'spread', 'rapid'];

        root.appendChild(this.makeSelect('Default weapon', this.draft.defaultWeapon || 'laser', weapons, (v) => {
            this.draft.defaultWeapon = v;
            if (this.draft.availableWeapons.indexOf(v) === -1) {
                this.draft.availableWeapons.push(v);
                this.renderControls();
            }
        }));

        const listTitle = document.createElement('div');
        listTitle.className = 'pe-row';
        listTitle.innerHTML = '<label>Available weapons</label>';
        root.appendChild(listTitle);

        weapons.forEach((w) => {
            const on = this.draft.availableWeapons.indexOf(w) !== -1;
            root.appendChild(this.makeCheckbox(w.toUpperCase(), on, (checked) => {
                if (checked) {
                    if (this.draft.availableWeapons.indexOf(w) === -1) {
                        this.draft.availableWeapons.push(w);
                    }
                } else {
                    this.draft.availableWeapons = this.draft.availableWeapons.filter((x) => x !== w);
                    if (!this.draft.availableWeapons.length) {
                        this.draft.availableWeapons = [this.draft.defaultWeapon || 'laser'];
                    }
                    if (this.draft.availableWeapons.indexOf(this.draft.defaultWeapon) === -1) {
                        this.draft.defaultWeapon = this.draft.availableWeapons[0];
                    }
                }
                this.renderControls();
            }));
        });

        root.appendChild(this.makeSlider('Weapon damage', this.draft.weaponDamage, 1, 60, 1, (v) => {
            this.draft.weaponDamage = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Weapon speed', this.draft.weaponSpeed, 1, 20, 0.5, (v) => {
            this.draft.weaponSpeed = v;
        }));
        root.appendChild(this.makeSlider('Weapon cooldown (ms)', this.draft.weaponCooldown, 50, 2000, 10, (v) => {
            this.draft.weaponCooldown = Math.round(v);
        }));
    }

    renderGraphicsTab(root) {
        const wing = Object.assign(
            { x: 0.02, y: 0.30, w: 0.24, h: 0.40 },
            this.draft.segmentUv && this.draft.segmentUv.wing
        );
        const setWing = (key, value) => {
            this.draft.segmentUv = Object.assign({}, this.draft.segmentUv || {}, {
                wing: Object.assign({}, wing, { [key]: value })
            });
            this.resetPreviewSim();
        };
        root.appendChild(this.makeSlider('Wing crop X', wing.x, 0, 0.9, 0.01, (v) => setWing('x', v)));
        root.appendChild(this.makeSlider('Wing crop Y', wing.y, 0, 0.9, 0.01, (v) => setWing('y', v)));
        root.appendChild(this.makeSlider('Wing crop width', wing.w, 0.05, 1, 0.01, (v) => setWing('w', v)));
        root.appendChild(this.makeSlider('Wing crop height', wing.h, 0.05, 1, 0.01, (v) => setWing('h', v)));
        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'Crop the wing from the ship graphic set. Smaller width/height removes fuselage pixels.';
        root.appendChild(hint);
    }

    getAbilityMeta(id) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.getMeta(id);
        }
        return { icon: '◆', cluster: 'other', name: id };
    }

    getSharedAbilityIds() {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.getIds();
        }
        if (typeof shipConfigManager !== 'undefined') {
            return shipConfigManager.availableAbilities || [];
        }
        return [];
    }

    renderAbilitiesTab(root) {
        const abilities = this.getSharedAbilityIds();
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
                    if (!Array.isArray(this.draft.abilities)) this.draft.abilities = [];
                    if (checked) {
                        if (this.draft.abilities.indexOf(a) === -1) this.draft.abilities.push(a);
                    } else {
                        this.draft.abilities = this.draft.abilities.filter((x) => x !== a);
                    }
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
        options.forEach((opt) => {
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
        if (typeof shipConfigManager === 'undefined' || !this.draft) return;
        shipConfigManager.setConfig(this.selectedType, this.draft);
        shipConfigManager.applyToRuntime(this.selectedType);
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        const header = document.querySelector('#shipEditorOverlay .planet-editor-header h2');
        if (header) {
            const prev = header.textContent;
            header.textContent = 'SAVED';
            setTimeout(() => { header.textContent = prev || 'SHIP EDITOR'; }, 700);
        }
    }

    reset() {
        if (typeof shipConfigManager === 'undefined') return;
        shipConfigManager.resetConfig(this.selectedType);
        this.loadDraft();
        this.renderControls();
        this.resetPreviewSim();
    }

    startPreview() {
        this.stopPreview();
        this.previewLastTs = 0;
        if (!this.previewSim) this.resetPreviewSim();
        const loop = (ts) => {
            if (!this.visible) return;
            if (!this.previewLastTs) this.previewLastTs = ts;
            const dt = Math.min(50, ts - this.previewLastTs);
            this.previewLastTs = ts;
            this.updatePreviewSim(dt);
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
        let base = null;
        if (typeof shipConfigManager !== 'undefined') {
            base = shipConfigManager.getBaseModel(this.selectedType);
            if (this.draft && this.draft.modelClass && base) {
                const classMap = {
                    starfighter: 'player',
                    interceptor: 'player_interceptor',
                    heavy_fighter: 'player_heavy',
                    assault: 'player_assault'
                };
                const key = classMap[this.draft.modelClass];
                if (key && typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
                    const alt = graphicsManager.shipAssetLoader.getShip(key);
                    if (alt) base = alt;
                }
            }
        }
        return Object.assign({}, base || {
            width: 20,
            height: 16,
            type: 'player',
            modelClass: 'starfighter',
            sprite: null
        }, {
            id: this.selectedType,
            name: this.draft && this.draft.name,
            speed: this.draft && this.draft.speed,
            maxHealth: this.draft && this.draft.maxHealth,
            armor: this.draft && this.draft.armor,
            damage: this.draft && this.draft.damage,
            modelClass: this.draft && this.draft.modelClass
        });
    }

    resetPreviewSim() {
        const w = 200;
        const h = 300;
        const model = this.getPreviewModel();
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        this.previewSim = {
            player: {
                x: w / 2 - shipW / 2,
                y: h - 50,
                width: shipW,
                height: shipH,
                vx: 1.2,
                dir: 1
            },
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    }

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const d = this.draft;
        if (!sim || !d) return;
        const frameScale = dtMs / 16.67;
        const model = this.getPreviewModel();
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        const p = sim.player;
        p.width = shipW;
        p.height = shipH;
        const speed = Math.max(0.5, Number(d.speed) || 4) * 0.35;
        p.x += p.dir * speed * frameScale;
        if (p.x <= 8 || p.x + p.width >= 192) {
            p.dir *= -1;
            p.x = Math.max(8, Math.min(192 - p.width, p.x));
        }
        p.y = 300 - 50 + Math.sin(sim.starPhase * 1.5) * 3;
        sim.starPhase += dtMs * 0.004;

        sim.shootAcc += dtMs;
        const cooldown = Math.max(80, Number(d.weaponCooldown) || 300);
        if (sim.shootAcc >= cooldown) {
            sim.shootAcc = 0;
            const bulletSpeed = Math.max(2, Number(d.weaponSpeed) || 8);
            sim.bullets.push({
                x: p.x + p.width / 2 - 1,
                y: p.y - 4,
                vy: -bulletSpeed,
                life: 1200
            });
        }
        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y > -10;
        });
    }

    drawPreview() {
        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        const sim = this.previewSim;
        if (!ctx || !canvas || !sim) return;
        const w = this.previewBaseWidth;
        const h = this.previewBaseHeight;
        const backingScale = this.previewBackingScale || 1;
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        ctx.scale(backingScale, backingScale);
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,140,40,0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 47 + sim.starPhase * 20) % w;
            const sy = (i * 73 + sim.starPhase * 8) % h;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.strokeStyle = 'rgba(255,140,40,0.15)';
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        sim.bullets.forEach((b) => {
            ctx.fillStyle = '#ffaa44';
            ctx.fillRect(b.x, b.y, 2, 6);
        });

        const model = this.getPreviewModel();
        const p = sim.player;
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            // Size the offscreen ship canvas to the actual backing-store density
            // (not the fixed logical p.width/height) so the hull/module pixels
            // regenerate crisp at the current zoom instead of being upscaled.
            tmp.width = Math.max(1, Math.round(p.width * backingScale));
            tmp.height = Math.max(1, Math.round(p.height * backingScale));
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, p.x, p.y, p.width, p.height);
        } else if (model.sprite) {
            const scale = Math.max(1, Math.floor(p.width / (model.width || 20)));
            for (let row = 0; row < model.sprite.length; row++) {
                for (let col = 0; col < model.sprite[row].length; col++) {
                    const pixel = model.sprite[row][col];
                    if (!pixel) continue;
                    ctx.fillStyle = (model.colors && model.colors[pixel]) || '#ccc';
                    ctx.fillRect(p.x + col * scale, p.y + row * scale, scale, scale);
                }
            }
        } else {
            ctx.fillStyle = '#ff8c28';
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.fillStyle = 'rgba(255,140,40,0.85)';
        ctx.font = '10px monospace';
        ctx.fillText((this.draft && this.draft.name) || 'SHIP', 8, 14);
        ctx.fillText(`SPD ${this.draft ? this.draft.speed : 0}`, 8, 28);
        ctx.fillText(`HP ${this.draft ? this.draft.maxHealth : 0}`, 8, 42);
        ctx.restore();
    }
}

const shipEditorUI = new ShipEditorUI();
