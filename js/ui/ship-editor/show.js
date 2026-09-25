"use strict";

// ShipEditorUI methods, split from ship-editor.js.
extendClass(ShipEditorUI, {
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
    },

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
    },

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
    },

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
    },

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
    },

    renderTabs() {
        const tabs = document.querySelectorAll('#seTabs .pe-tab');
        tabs.forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === this.activeTab);
        });
    },

    renderControls() {
        const root = document.getElementById('seControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        if (this.activeTab === 'stats') this.renderStatsTab(root);
        else if (this.activeTab === 'weapons') this.renderWeaponsTab(root);
        else if (this.activeTab === 'abilities') this.renderAbilitiesTab(root);
        else this.renderGraphicsTab(root);
    },

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
    },

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
    },

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
    },

    getAbilityMeta(id) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.getMeta(id);
        }
        return { icon: '◆', cluster: 'other', name: id };
    },

    getSharedAbilityIds() {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.getIds();
        }
        if (typeof shipConfigManager !== 'undefined') {
            return shipConfigManager.availableAbilities || [];
        }
        return [];
    },
});
