"use strict";

/**
 * Profile create / select / rename / delete overlay.
 */
class ProfileSelectionManager {
    constructor() {
        this.isVisible = false;
        this.selectedIndex = 0;
        this.overlay = null;
        this._keyHandler = null;
        this.onClose = null;
        this.mode = 'list'; // list | create | rename
        this.pendingFaction = this.getFactionIds()[0];
    }

    getFactionIds() {
        if (typeof factionManager !== 'undefined' && factionManager.getFactionIds) {
            return factionManager.getFactionIds();
        }
        return ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
    }

    getFactionLabel(id) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta) {
            const meta = planetConfigManager.getFactionMeta(id);
            if (meta && meta.label) return meta.label;
        }
        return String(id || '').toUpperCase();
    }

    getFactionColor(id) {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor) {
            return factionShipStyles.getFactionColor(id);
        }
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme) {
            const theme = planetConfigManager.getFactionPlanetTheme(id);
            if (theme && theme.baseColor) return theme.baseColor;
        }
        return '#888888';
    }

    show(options) {
        this.isVisible = true;
        this.onClose = options && options.onClose;
        this.mode = 'list';
        this.selectedIndex = 0;
        const profiles = this.getProfiles();
        if (typeof profileManager !== 'undefined' && profileManager.activeProfileId) {
            const idx = profiles.findIndex(p => p.id === profileManager.activeProfileId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.createUI();
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('profiles');
        }
    }

    hide() {
        this.isVisible = false;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    getProfiles() {
        if (typeof profileManager !== 'undefined') {
            return profileManager.getProfiles();
        }
        return [];
    }

    createUI() {
        const profiles = this.getProfiles();
        const activeId = typeof profileManager !== 'undefined' ? profileManager.activeProfileId : null;
        const reuse = !!this.overlay && this.overlay.isConnected;

        if (!reuse) {
            if (this.overlay) this.overlay.remove();
            this.overlay = document.createElement('div');
            this.overlay.className = 'profile-selection-overlay';
        } else if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        const setHtml = (html) => {
            const keep = Array.from(this.overlay.querySelectorAll(
                ':scope > .vf-bg-parallax-base, :scope > .vf-bg-parallax-glow'
            ));
            this.overlay.innerHTML = html;
            for (let i = keep.length - 1; i >= 0; i--) {
                this.overlay.insertBefore(keep[i], this.overlay.firstChild);
            }
        };

        if (this.mode === 'create' || this.mode === 'rename') {
            const title = this.mode === 'create' ? 'NEW PROFILE' : 'RENAME PROFILE';
            const factionPickerHtml = this.mode === 'create' ? `
                <div class="profile-faction-picker">
                    <div class="profile-faction-picker-label">FACTION</div>
                    <div class="profile-faction-swatches">
                        ${this.getFactionIds().map((id) => `
                            <button type="button" class="profile-faction-swatch${id === this.pendingFaction ? ' selected' : ''}"
                                data-faction="${id}" title="${this.getFactionLabel(id)}"
                                style="--faction-color: ${this.getFactionColor(id)}">
                                <span class="profile-faction-swatch-dot"></span>
                                <span class="profile-faction-swatch-label">${this.getFactionLabel(id)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : '';
            setHtml(`
                <div class="profile-selection-content profile-selection-floating profile-selection-name-mode">
                    <h2 class="profile-selection-title">${title}</h2>
                    <input type="text" class="profile-name-input" id="profileNameInput" maxlength="16" placeholder="NAME" autocomplete="off" spellcheck="false"/>
                    ${factionPickerHtml}
                    <div class="profile-selection-actions">
                        <button class="action-button" id="psSave">SAVE</button>
                        <button class="action-button secondary" id="psCancelMode">CANCEL</button>
                    </div>
                    <div class="profile-selection-instructions"><p>ENTER Save | ESC Cancel</p></div>
                </div>
            `);
            if (!reuse) document.body.appendChild(this.overlay);
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
            const input = this.overlay.querySelector('#profileNameInput');
            if (this.mode === 'rename' && profiles[this.selectedIndex]) {
                input.value = profiles[this.selectedIndex].name;
            }
            input.focus();
            this.overlay.querySelectorAll('.profile-faction-swatch').forEach((btn) => {
                btn.addEventListener('click', () => {
                    this.pendingFaction = btn.dataset.faction;
                    this.overlay.querySelectorAll('.profile-faction-swatch').forEach((el) => {
                        el.classList.toggle('selected', el.dataset.faction === this.pendingFaction);
                    });
                });
            });
            this.overlay.querySelector('#psSave').addEventListener('click', () => this.saveName());
            this.overlay.querySelector('#psCancelMode').addEventListener('click', () => {
                this.mode = 'list';
                this.createUI();
            });
            this._keyHandler = (e) => {
                if (!this.isVisible) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveName();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.mode = 'list';
                    this.createUI();
                }
            };
            document.addEventListener('keydown', this._keyHandler);
            return;
        }

        const selected = profiles[this.selectedIndex] || null;
        setHtml(`
            <div class="profile-selection-content profile-selection-floating">
                <h2 class="profile-selection-title">PROFILES</h2>
                <div class="profile-selection-body">
                    <div class="profile-list">
                        ${profiles.length ? profiles.map((p, i) => `
                            <div class="profile-list-item ${i === this.selectedIndex ? 'selected' : ''} ${p.id === activeId ? 'active' : ''}" data-index="${i}">
                                <span class="profile-list-name">${p.name}</span>
                                ${p.id === activeId ? '<span class="profile-list-badge">ACTIVE</span>' : ''}
                            </div>
                        `).join('') : '<div class="profile-list-empty">NO PROFILES — CREATE ONE</div>'}
                    </div>
                    <div class="profile-details" id="profileDetails">
                        ${this.renderProfileDetails(selected)}
                    </div>
                </div>
                <div class="profile-selection-actions">
                    <button class="action-button" id="psSelect">SELECT</button>
                    <button class="action-button" id="psCreate">CREATE</button>
                    <button class="action-button secondary" id="psRename">RENAME</button>
                    <button class="action-button secondary" id="psDelete">DELETE</button>
                    <button class="action-button secondary" id="psBack">BACK</button>
                </div>
                <div class="profile-selection-instructions">
                    <p>↑ ↓ Profiles | ← → Actions | ENTER Select | ESC Back</p>
                </div>
            </div>
        `);
        if (!reuse) document.body.appendChild(this.overlay);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.bindListEvents();
    }

    shipName(id) {
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getDisplayName) {
            return shipConfigManager.getDisplayName(id);
        }
        return String(id || '').replace(/^player_/, '').replace(/_/g, ' ').toUpperCase();
    }

    galaxyName(gid) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy) {
            const g = planetConfigManager.getGalaxy(gid);
            if (g && g.name) return String(g.name).toUpperCase();
        }
        return String(gid || 'UNKNOWN').replace(/_/g, ' ').toUpperCase();
    }

    resourceLabel(id) {
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel) {
            return economyConfig.getResourceLabel(id);
        }
        return String(id || '').toUpperCase();
    }

    getProfileProgressSummary(profile) {
        if (!profile) return [];
        if (typeof profileManager !== 'undefined') {
            profileManager.ensureEconomyDefaults(profile);
        }
        const galaxies = (profile.progress && profile.progress.galaxies) || {};
        let ids = [];
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds) {
            ids = planetConfigManager.getGalaxyIds().slice();
        }
        if (!ids.length) {
            ids = Object.keys(galaxies);
        }
        if (!ids.length) ids = ['milky_way'];

        return ids.map((gid) => {
            const gp = galaxies[gid] || { clearedPlanetIds: [], unlockedPlanetIds: [] };
            let total = 0;
            if (typeof planetConfigManager !== 'undefined') {
                const g = planetConfigManager.getGalaxy(gid);
                total = (g && g.planetIds) ? g.planetIds.length : 0;
                const map = planetConfigManager.getGalaxyMap && planetConfigManager.getGalaxyMap(gid);
                if (map && map.nodes && map.nodes.length) total = map.nodes.length;
            }
            const cleared = (gp.clearedPlanetIds || []).length;
            return {
                id: gid,
                name: this.galaxyName(gid),
                cleared,
                total,
                label: `${cleared}/${total || '?'}`
            };
        });
    }

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
            <div class="profile-details-header">${profile.name}</div>
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
    }

    refreshDetails() {
        const pane = this.overlay && this.overlay.querySelector('#profileDetails');
        if (!pane) return;
        const profiles = this.getProfiles();
        pane.innerHTML = this.renderProfileDetails(profiles[this.selectedIndex] || null);
    }

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
            } else if (e.key === 'Enter') {
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
    }

    getActionButtons() {
        if (!this.overlay) return [];
        return Array.prototype.slice.call(
            this.overlay.querySelectorAll('.profile-selection-actions .action-button:not([disabled])')
        );
    }

    refreshActionFocus() {
        const actions = this.getActionButtons();
        if (!actions.length) return;
        this.actionFocusIndex = Math.max(0, Math.min(actions.length - 1, this.actionFocusIndex || 0));
        actions.forEach((el, i) => el.classList.toggle('nav-focused', i === this.actionFocusIndex));
    }

    moveActionFocus(dir) {
        const actions = this.getActionButtons();
        if (!actions.length) return;
        this.actionFocusIndex = (this.actionFocusIndex + dir + actions.length) % actions.length;
        this.refreshActionFocus();
    }

    selectIndex(index) {
        const profiles = this.getProfiles();
        if (!profiles.length) return;
        this.selectedIndex = Math.max(0, Math.min(profiles.length - 1, index));
        this.overlay.querySelectorAll('.profile-list-item').forEach((el, i) => {
            el.classList.toggle('selected', i === this.selectedIndex);
        });
        this.refreshDetails();
    }

    saveName() {
        const input = this.overlay.querySelector('#profileNameInput');
        const name = input ? input.value : '';
        if (typeof profileManager === 'undefined') return;
        if (this.mode === 'create') {
            const p = profileManager.create(name, this.pendingFaction);
            if (!p) return;
            profileManager.setActive(p.id);
            profileManager.ensureEconomyDefaults(p);
            this.mode = 'list';
            this.createUI();
            const hint = this.overlay.querySelector('.profile-list-empty') || this.overlay.querySelector('.profile-selection-instructions');
            if (this.overlay) {
                let note = this.overlay.querySelector('.hs-create-note');
                if (!note) {
                    note = document.createElement('p');
                    note.className = 'hs-create-note hs-status';
                    note.style.textAlign = 'center';
                    const content = this.overlay.querySelector('.profile-selection-content');
                    if (content) content.insertBefore(note, content.querySelector('.profile-selection-actions'));
                }
                note.textContent = 'SCRAP FIGHTER READY — OPEN STATION FOR SHOP';
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
    }

    activateSelected() {
        const profiles = this.getProfiles();
        if (!profiles.length) {
            this.mode = 'create';
            this.pendingFaction = this.getFactionIds()[0];
            this.createUI();
            return;
        }
        const p = profiles[this.selectedIndex];
        if (!p || typeof profileManager === 'undefined') return;
        profileManager.setActive(p.id);
        this.close();
    }

    deleteSelected() {
        const profiles = this.getProfiles();
        const p = profiles[this.selectedIndex];
        if (!p || typeof profileManager === 'undefined') return;
        if (!window.confirm(`Delete profile "${p.name}"?`)) return;
        profileManager.delete(p.id);
        this.selectedIndex = 0;
        this.createUI();
    }

    close() {
        const cb = this.onClose;
        this.hide();
        if (typeof cb === 'function') cb();
    }
}

const profileSelectionManager = new ProfileSelectionManager();
window.profileSelectionManager = profileSelectionManager;
