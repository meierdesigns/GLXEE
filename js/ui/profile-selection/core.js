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
}
