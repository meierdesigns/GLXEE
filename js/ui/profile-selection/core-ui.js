"use strict";

// ProfileSelectionManager members, continued from core.js: show / hide and the dialog markup.
extendClass(ProfileSelectionManager, {
    show(options) {
        this.isVisible = true;
        this.onClose = options && options.onClose;
        // Optional host element: render inline (e.g. inside the start-screen
        // terminal) instead of as a fullscreen overlay.
        const host = options && options.host;
        if (this.host !== host && this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.host = host || null;
        this.mode = 'list';
        this.selectedIndex = 0;
        const profiles = this.getProfiles();
        if (typeof profileManager !== 'undefined' && profileManager.activeProfileId) {
            const idx = profiles.findIndex(p => p.id === profileManager.activeProfileId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        // Opened for a new game (start menu START): creation only — cancel
        // leaves instead of falling back to the pilot list.
        this._createOnly = !!(options && options.create);
        // No pilots yet: skip the empty list and open profile creation.
        if (!profiles.length || this._createOnly) {
            this.mode = 'create';
            this.createStep = 'faction';
            this._heroDefaultName = '';
            this._pilotName = '';
            this.pendingFaction = this.getFactionIds()[0];
        }
        // Refresh inside the pilot flow: the very first build already is the saved step and faction (no default flash, no rebuild).
        const seed = this._restoreSeed; this._restoreSeed = null;
        if (seed && seed.pmode === 'create') {
            this.mode = 'create'; this._createOnly = !!seed.pcreateOnly;
            this.createStep = seed.pstep || 'faction';
            if (seed.pfaction && this.getFactionIds().indexOf(seed.pfaction) >= 0) this.pendingFaction = seed.pfaction;
            this._pilotName = seed.pname || '';
            if (seed.pstart) this._startOpts = seed.pstart;
        }
        this.createUI();
        // Embedded in the station menu, the station persists its own tab.
        const inStation = typeof homeStationUI !== 'undefined' && homeStationUI.isVisible;
        if (typeof menuStateManager !== 'undefined' && !inStation) {
            menuStateManager.setScreen('profiles');
        }
    },
    hide() {
        this.isVisible = false;
        if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-pf');
        if (typeof menuStateManager !== 'undefined') menuStateManager.save({ pmode: null, pstep: null, pstation: false });
        if (this._heroPlanetBackdrop) this._heroPlanetBackdrop.unmount();
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.host = null;
    },
    getProfiles() {
        if (typeof profileManager !== 'undefined') {
            return profileManager.getProfiles();
        }
        return [];
    },
    createUI() {
        window.vfWizardRestoring = false;
        // Remember where the pilot flow is, so a refresh returns to it (menu-state/restore.js).
        const inStationUi = typeof homeStationUI !== 'undefined' && homeStationUI.isVisible;
        if (typeof menuStateManager !== 'undefined' && this.isVisible) {
            menuStateManager.save({
                pmode: this.mode, pstep: this.createStep || null,
                pfaction: this.pendingFaction || null, pcreateOnly: !!this._createOnly,
                // Inside the station the create flow sits on top of the saved tab.
                pstation: inStationUi && this.mode === 'create',
                pname: this._pilotName || '', pstart: this._startOpts || null
            });
        }
        const profiles = this.getProfiles();
        const activeId = typeof profileManager !== 'undefined' ? profileManager.activeProfileId : null;
        const reuse = !!this.overlay && this.overlay.isConnected;

        if (!reuse) {
            if (this.overlay) this.overlay.remove();
            this.overlay = document.createElement('div');
            this.overlay.className = 'profile-selection-overlay' + (this.host ? ' is-inline' : '');
        } else if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        const setHtml = (html) => {
            const keep = Array.from(this.overlay.querySelectorAll(
                ':scope > .vf-bg-parallax-base, :scope > .vf-bg-parallax-glow'
            ));
            const ov = this.overlay;
            ov.innerHTML = html;
            for (let i = keep.length - 1; i >= 0; i--) {
                ov.insertBefore(keep[i], ov.firstChild);
            }
        };

        if (this.mode === 'create' || this.mode === 'rename') {
            this.renderNameMode(setHtml, reuse, profiles);
            return;
        }

        this._noVisibleProfile = false;
        this._factionFilter = null;
        const selected = profiles[this.selectedIndex] || null;
        setHtml(`
            <div class="profile-selection-content profile-selection-floating" data-faction="${(selected && selected.faction) || (profiles[0] && profiles[0].faction) || 'pirate'}">
                <h2 class="profile-selection-title">PROFILES</h2>
                <div class="profile-selection-body">
                    <div class="profile-list">
                        <div class="profile-faction-filter">
                            ${this.getFactionIds().slice(0, 5).map((id) => `
                                <button type="button" class="profile-faction-btn ${this._factionFilter === id ? 'is-active' : ''}" data-faction="${id}" title="${this.getFactionLabel(id)}">${this.getFactionEmblemHtml(id, 32)}</button>
                            `).join('')}
                        </div>
                        ${profiles.length ? profiles.map((p, i) => `
                            <div class="profile-list-item ${i === this.selectedIndex ? 'selected' : ''} ${p.id === activeId ? 'active' : ''}" data-index="${i}" data-faction="${p.faction || 'pirate'}"${this._factionFilter && (p.faction || 'pirate') !== this._factionFilter ? ' hidden' : ''}>
                                <span class="profile-list-emblem">${this.getFactionEmblemHtml(p.faction || 'pirate', 28)}</span>
                                <span class="profile-list-name">${p.name}</span>
                                ${p.id === activeId ? '<span class="profile-list-badge">ACTIVE</span>' : ''}
                            </div>
                        `).join('') : '<div class="profile-list-empty">NO PROFILES — CREATE ONE</div>'}
                        <div class="profile-list-empty profile-list-filter-empty" hidden>NO PROFILES FOR THIS FACTION</div>
                    </div>
                    <div class="profile-details" id="profileDetails">
                        ${this.renderProfileDetails(selected)}
                    </div>
                </div>
                <div class="profile-selection-actions">
                    <button class="action-button secondary" id="psBack">${ProfileSelectionManager.btnIconHtml('back')}BACK</button>
                    <button class="action-button" id="psCreate">${ProfileSelectionManager.btnIconHtml('create')}CREATE</button>
                    ${profiles.length ? `<button class="action-button" id="psSelect">${ProfileSelectionManager.btnIconHtml('next')}SELECT</button>` : ''}
                </div>
                <div class="profile-selection-instructions">
                    <p>↑ ↓ Profiles | ← → Actions | ENTER Select | ESC Back</p>
                </div>
            </div>
        `);
        {
            const listBox = this.overlay.querySelector('.profile-selection-content');
            const sel = profiles[this.selectedIndex] || profiles[0];
            if (listBox && sel) this.applyFactionVars(listBox, sel.faction || 'pirate');
        }
        if (!reuse) (this.host || document.body).appendChild(this.overlay);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.bindListEvents();
    },
    /**
     * Create flow is two steps: 1) pick a faction (← → cycle, ENTER confirm),
     * 2) name the pilot (defaults to the faction hero). Rename skips step 1.
     */
    /**
     * Start options for a new pilot: start galaxy (defaults to the faction's
     * home galaxy) and a starter kit. Difficulty is a global setting. Applied in saveName().
     */
    renderStartOptionsHtml(pilotOnly) {
        const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
            ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
        const home = (meta && meta.homeGalaxy) || 'milky_way';
        const galaxies = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds)
            ? planetConfigManager.getGalaxyIds() : ['milky_way'];
        if (!this._startOpts || this._startOpts.faction !== this.pendingFaction) {
            this._startOpts = {
                faction: this.pendingFaction,
                galaxy: home,
                kit: null,
                areas: { front: 0, center: 0, back: 0, wing: 0 },
                look: (typeof heroPortrait !== 'undefined') ? heroPortrait.randomLook(this.pendingFaction) : null,
                lookKey: 'skin'
            };
            if (this.savePilotState) this.savePilotState();
        }
        const o = this._startOpts;
        const galaxyName = (gid) => {
            const g = planetConfigManager.getGalaxy ? planetConfigManager.getGalaxy(gid) : null;
            return String((g && g.name) || gid).toUpperCase();
        };
        if (pilotOnly === 'none') return '';                                    // start-profile step: galaxy comes last
        if (pilotOnly) return `<div class="profile-start-options">${this.renderPilotRowHtml()}</div>`;
        return `
            <div class="profile-start-options">
                <div class="profile-start-row" data-start-row="galaxy">
                    <span class="profile-start-label">START GALAXY</span>
                    <div class="profile-start-galaxy has-side" id="psStartGalaxy">${this.renderStartGalaxyCardHtml(o.galaxy, home, GALAXY_MAP_H)}</div>
                </div>
            </div>`;
    },
});
