"use strict";

// ProfileSelectionManager methods, split from profile-selection.js.
extendClass(ProfileSelectionManager, {
    renderProfileDetails(profile) {
        if (!profile) {
            return '<div class="profile-details-empty">SELECT OR CREATE A PROFILE</div>';
        }
        if (typeof profileManager !== 'undefined') {
            profileManager.ensureEconomyDefaults(profile);
        }

        const stationGid = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : ((profile.homeStation && profile.homeStation.currentGalaxyId) || 'milky_way');
        const progressRows = this.getProfileProgressSummary(profile);
        const clearedTotal = progressRows.reduce((s, r) => s + r.cleared, 0);
        const planetTotal = progressRows.reduce((s, r) => s + (r.total || 0), 0);

        const resIds = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const resources = profile.resources || {};
        const ships = profile.ownedShipIds || [];
        const activeShip = profile.activeShipId;

        return `
            <div class="profile-details-header">
                <span class="profile-details-emblem">${this.getFactionEmblemHtml(profile.faction || 'pirate', 32)}</span>
                <span class="profile-details-title">
                    ${profile.name}
                    <small>${this.getFactionLabel(profile.faction || 'pirate')}</small>
                </span>
            </div>
            <div class="profile-details-section">
                <div class="profile-details-label">STATION</div>
                <div class="profile-details-value">${this.galaxyName(stationGid)}</div>
            </div>
            <div class="profile-details-section">
                <div class="profile-details-label">PROGRESS</div>
                <div class="profile-details-value">${clearedTotal}/${planetTotal || '?'} PLANETS</div>
                <div class="profile-details-list">
                    ${progressRows.map((r) => `
                        <div class="profile-details-row ${r.id === stationGid ? 'is-station' : ''}">
                            <span>${r.name}</span>
                            <span>${r.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="profile-details-section">
                <div class="profile-details-label">RESOURCES</div>
                <div class="profile-details-list profile-details-resources">
                    ${resIds.map((id) => `
                        <div class="profile-details-row hs-res-${id}">
                            <span>${this.resourceLabel(id)}</span>
                            <span>${resources[id] || 0}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="profile-details-section">
                <div class="profile-details-label">SHIPS</div>
                <div class="profile-details-list">
                    ${ships.length ? ships.map((id) => `
                        <div class="profile-details-row ${id === activeShip ? 'is-active' : ''}">
                            <span>${this.shipName(id)}</span>
                            <span>${id === activeShip ? 'ACTIVE' : ''}</span>
                        </div>
                    `).join('') : '<div class="profile-details-row"><span>NONE</span></div>'}
                </div>
            </div>
        `;
    },

    refreshDetails() {
        const pane = this.overlay && this.overlay.querySelector('#profileDetails');
        if (!pane) return;
        const profiles = this.getProfiles();
        const selected = profiles[this.selectedIndex] || null;
        pane.innerHTML = this.renderProfileDetails(selected);
        // The dialog takes the selected profile's faction look and shape.
        const box = this.overlay.querySelector('.profile-selection-content');
        if (box && selected && this.applyFactionVars) this.applyFactionVars(box, selected.faction || 'pirate');
    },

    bindListEvents() {
        this.overlay.querySelectorAll('.profile-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index, 10);
                if (!Number.isNaN(idx)) this.selectIndex(idx);
            });
            item.addEventListener('dblclick', () => {
                const idx = parseInt(item.dataset.index, 10);
                if (!Number.isNaN(idx)) {
                    this.selectIndex(idx);
                    this.activateSelected();
                }
            });
        });

        const bind = (id, fn) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.addEventListener('click', fn);
        };
        bind('psSelect', () => this.activateSelected());
        bind('psCreate', () => {
            this.mode = 'create';
            this.createStep = 'faction';
            this._heroDefaultName = '';
            this.pendingFaction = this.getFactionIds()[0];
            this.createUI();
        });
        bind('psRename', () => {
            if (!this.getProfiles().length) return;
            this.mode = 'rename';
            this.createUI();
        });
        bind('psDelete', () => this.deleteSelected());
        bind('psBack', () => this.close());

        this.actionFocusIndex = 0;
        this.refreshActionFocus();
        // Mouse and keyboard share one focus: hovering an action moves it.
        this.getActionButtons().forEach((btn, i) => {
            btn.addEventListener('mouseenter', () => {
                this.actionFocusIndex = i;
                this.refreshActionFocus();
            });
        });
        const selectedItem = this.overlay.querySelector('.profile-list-item.selected');
        if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest' });

        this._keyHandler = (e) => {
            if (!this.isVisible || this.mode !== 'list') return;
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectIndex(Math.max(0, this.selectedIndex - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectIndex(Math.min(this.getProfiles().length - 1, this.selectedIndex + 1));
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.moveActionFocus(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.moveActionFocus(1);
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Space confirms like Enter (keyboard/gamepad-style menus).
                e.preventDefault();
                const actions = this.getActionButtons();
                if (actions[this.actionFocusIndex]) {
                    actions[this.actionFocusIndex].click();
                } else {
                    this.activateSelected();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    },

    getActionButtons() {
        if (!this.overlay) return [];
        return Array.prototype.slice.call(
            this.overlay.querySelectorAll('.profile-selection-actions .action-button:not([disabled])')
        );
    },

    refreshActionFocus() {
        const actions = this.getActionButtons();
        if (!actions.length) return;
        this.actionFocusIndex = Math.max(0, Math.min(actions.length - 1, this.actionFocusIndex || 0));
        actions.forEach((el, i) => el.classList.toggle('nav-focused', i === this.actionFocusIndex));
    },

    moveActionFocus(dir) {
        const actions = this.getActionButtons();
        if (!actions.length) return;
        this.actionFocusIndex = (this.actionFocusIndex + dir + actions.length) % actions.length;
        this.refreshActionFocus();
    },

    selectIndex(index) {
        const profiles = this.getProfiles();
        if (!profiles.length) return;
        this.selectedIndex = Math.max(0, Math.min(profiles.length - 1, index));
        this.overlay.querySelectorAll('.profile-list-item').forEach((el, i) => {
            el.classList.toggle('selected', i === this.selectedIndex);
            if (i === this.selectedIndex) el.scrollIntoView({ block: 'nearest' });
        });
        this.refreshDetails();
    },

    /** Apply the name step's start options to a freshly created profile. */
    applyStartOptions(p) {
        const o = this._startOpts || {};
        if (!p) return;
        // Start galaxy: current station galaxy, discovered, ship at its start planet.
        const gid = String(o.galaxy || '').toLowerCase();
        if (gid && typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy && planetConfigManager.getGalaxy(gid)) {
            p.homeStation.currentGalaxyId = gid;
            // Uncharted galaxies get their arrival sector now (same as the
            // first teleport there): planets + an unlocked start planet.
            let map = planetConfigManager.getGalaxyMap(gid) || {};
            if (!(map.nodes && map.nodes.length) && planetConfigManager.ensureGalaxyArrivalContent) {
                const arrival = planetConfigManager.ensureGalaxyArrivalContent(gid, String(p.id) + '|' + gid, { firstVisit: true });
                if (arrival && arrival.faction && profileManager.discoverFaction) profileManager.discoverFaction(arrival.faction);
                map = planetConfigManager.getGalaxyMap(gid) || {};
            }
            const startId = map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId);
            if (startId) {
                if (profileManager.ensureGalaxyProgress) profileManager.ensureGalaxyProgress(p, gid);
                if (profileManager.unlockPlanet) profileManager.unlockPlanet(startId);
            }
            if (profileManager.discoverGalaxy) profileManager.discoverGalaxy(gid);
            // Home galaxy start: it is under attack (invasion-scenario.js).
            const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(p.faction) : null;
            if (meta && meta.homeGalaxy === gid && profileManager.startInvasionScenario) {
                profileManager.startInvasionScenario(p, gid);
            }
            const start = map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId);
            if (start && profileManager.setShipLocation) {
                profileManager._suppressHoldingTick = true;
                profileManager.setShipLocation(gid, 'planet', start);
                profileManager._suppressHoldingTick = false;
            }
        }
        // Difficulty: the game-wide setting, remembered on the profile too.
        if (o.difficulty && typeof difficultyConfigManager !== 'undefined' && difficultyConfigManager.setDifficulty) {
            difficultyConfigManager.setDifficulty(o.difficulty);
            p.difficulty = o.difficulty;
        }
        // Starter kit.
        if (!p.resources || typeof p.resources !== 'object') p.resources = {};
        const addRes = (id, n) => { p.resources[id] = (Number(p.resources[id]) || 0) + n; };
        if (o.kit === 'credits') p.credits = (Number(p.credits) || 0) + 200;
        if (o.kit === 'salvage') { addRes('scrap', 120); addRes('ore', 40); addRes('crystal', 15); }
        if (o.kit === 'gunsmith') {
            const ship = p.activeShipId;
            if (!p.shipUpgrades[ship]) p.shipUpgrades[ship] = { frameLevel: 0 };
            p.shipUpgrades[ship].weaponSlotsBought = (Number(p.shipUpgrades[ship].weaponSlotsBought) || 0) + 1;
        }
        p.startKit = o.kit || 'balanced';
        profileManager.save();
    },

    saveName() {
        const input = this.overlay.querySelector('#profileNameInput');
        const name = input ? input.value : '';
        if (typeof profileManager === 'undefined') return;
        if (this.mode === 'create') {
            const p = profileManager.create(name, this.pendingFaction);
            if (!p) return;
            profileManager.setActive(p.id);
            profileManager.ensureEconomyDefaults(p);
            this.applyStartOptions(p);
            this.hide();
            if (typeof homeStationUI !== 'undefined') {
                homeStationUI.show({
                    tab: 'hangar',
                    onClose: this.onClose
                });
            } else if (typeof this.onClose === 'function') {
                this.onClose();
            }
            return;
        } else if (this.mode === 'rename') {
            const profiles = this.getProfiles();
            const target = profiles[this.selectedIndex];
            if (!target) return;
            profileManager.rename(target.id, name);
        }
        this.mode = 'list';
        this.createUI();
    },

    activateSelected() {
        const profiles = this.getProfiles();
        if (!profiles.length) {
            this.mode = 'create';
            this.createStep = 'faction';
            this._heroDefaultName = '';
            this.pendingFaction = this.getFactionIds()[0];
            this.createUI();
            return;
        }
        const p = profiles[this.selectedIndex];
        if (!p || typeof profileManager === 'undefined') return;
        profileManager.setActive(p.id);
        this.close();
    },

    async deleteSelected() {
        const profiles = this.getProfiles();
        const p = profiles[this.selectedIndex];
        if (!p || typeof profileManager === 'undefined') return;
        if (!(await uiDialog.confirm(`Delete profile "${p.name}"?`, { okLabel: 'DELETE', danger: true }))) return;
        if (!this.isVisible) return;
        profileManager.delete(p.id);
        this.selectedIndex = 0;
        this.createUI();
    },

    close() {
        const cb = this.onClose;
        this.hide();
        if (typeof cb === 'function') cb();
    },
});
