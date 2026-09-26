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

    /** Faction emblem as a pixel icon, tinted in the faction accent. */
    getFactionEmblemHtml(id, size = 20) {
        if (typeof iconRenderer === 'undefined' || typeof factionShipStyles === 'undefined') return '';
        const key = factionShipStyles.emblemCamelKey ? factionShipStyles.emblemCamelKey(id) : null;
        if (!key) return '';
        const style = factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(id) : null;
        return iconRenderer.imgHtml(key, size, 'profile-faction-emblem-img', style && style.accent, this.getFactionLabel(id));
    }

    /**
     * Re-skin the dialog in the chosen faction's palette and show that
     * faction's ship, so picking a faction previews what the game becomes.
     */
    applyPendingFactionLook() {
        if (!this.overlay) return;
        const id = this.pendingFaction;
        const box = this.overlay.querySelector('.profile-selection-name-mode');
        this.applyFactionVars(box, id);
        const emblem = this.overlay.querySelector('.profile-faction-preview-emblem');
        if (emblem) emblem.innerHTML = this.getFactionEmblemHtml(id, 32);
        const name = this.overlay.querySelector('.profile-faction-preview-name');
        if (name) name.textContent = this.getFactionLabel(id);
        const meta = typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta
            ? planetConfigManager.getFactionMeta(id)
            : null;
        const hero = meta && meta.hero;
        const trait = this.overlay.querySelector('.profile-faction-preview-trait');
        if (trait) trait.textContent = meta && meta.traits.length ? meta.traits.join(' · ').toUpperCase() : '';
        const heroEl = this.overlay.querySelector('.profile-faction-preview-hero');
        if (heroEl) {
            heroEl.textContent = hero ? `HERO · ${hero.name}` : '';
            heroEl.title = hero ? `${hero.title} — ${hero.lore}` : '';
        }
        // The faction hero's name is the default pilot name. It follows the
        // faction choice until the player types a name of their own.
        const input = this.overlay.querySelector('#profileNameInput');
        if (input && hero && this.mode === 'create') {
            const untouched = !input.value || input.value === this._heroDefaultName;
            if (untouched) {
                input.value = hero.name.slice(0, 16);
                this._heroDefaultName = input.value;
                input.select();
            }
            input.placeholder = hero.name;
        }
        this.renderFactionShipPreview(id);
    }

    /** Faction palette + frame shape on one dialog box. */
    applyFactionVars(box, id) {
        const style = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle
            ? factionShipStyles.getFactionStyle(id)
            : null;
        if (!box || !style) return;
        const accent = style.accent || '#c8d0d8';
        const hull = style.hull || '#7a8490';
        box.style.setProperty('--color-primary', accent);
        box.style.setProperty('--color-secondary', hull);
        box.style.setProperty('--color-border', hull);
        box.style.setProperty('--color-accent', accent);
        box.style.setProperty('--faction-accent', accent);
        box.style.setProperty('--faction-hull', hull);
        box.style.setProperty('--faction-edge', style.edge || '#2a3038');
        // The dialog frame itself (border + glow) reads --ui-border.
        box.style.setProperty('--ui-border', accent);
        // Light "white" tone of this faction (text, interactables) — same rule
        // as the app-wide faction palette, scoped to this box.
        const light = (typeof themeContextManager !== 'undefined' && themeContextManager.lightenHex)
            ? themeContextManager.lightenHex(accent, 0.72) : '#ffffff';
        box.style.setProperty('--color-second-basecolor', light);
        box.style.setProperty('--color-text', light);
        box.style.setProperty('--color-text-secondary', (typeof themeContextManager !== 'undefined' && themeContextManager.lightenHex)
            ? themeContextManager.lightenHex(accent, 0.45) : light);
        box.dataset.faction = id;
    }

    /** Default player hull drawn in the faction's silhouette and colours. */
    renderFactionShipPreview(id) {
        const canvas = this.overlay && this.overlay.querySelector('.profile-faction-ship');
        const ctx = canvas && canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        if (!loader || typeof shipConfigManager === 'undefined' || !shipConfigManager.getMergedModel) return;
        try {
            const shipId = 'player_scrap';
            const model = Object.assign({}, shipConfigManager.getMergedModel(shipId), { id: shipId, faction: id });
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
                shipLoadoutManager.applyLayoutToModel(model, shipId);
            }
            model.faction = id;
            const mw = Math.max(1, model.width || 20);
            const mh = Math.max(1, model.height || 16);
            const scale = Math.max(1, Math.floor(Math.min((canvas.width - 16) / mw, (canvas.height - 16) / mh)));
            ctx.imageSmoothingEnabled = false;
            loader.renderShip(ctx, model, Math.floor((canvas.width - mw * scale) / 2),
                Math.floor((canvas.height - mh * scale) / 2), scale, null, 0, {});
        } catch (e) {
            /* preview is cosmetic */
        }
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
                                <span class="profile-faction-swatch-emblem">${this.getFactionEmblemHtml(id)}</span>
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
                    ${this.mode === 'create' ? `
                    <div class="profile-faction-preview">
                        <canvas class="profile-faction-ship" width="200" height="140" aria-label="Faction ship preview"></canvas>
                        <div class="profile-faction-preview-text">
                            <span class="profile-faction-preview-emblem"></span>
                            <strong class="profile-faction-preview-name"></strong>
                            <small class="profile-faction-preview-trait"></small>
                            <small class="profile-faction-preview-hero"></small>
                        </div>
                    </div>` : ''}
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
                    this.applyPendingFactionLook();
                });
            });
            if (this.mode === 'create') this.applyPendingFactionLook();
            this.overlay.querySelector('#psSave').addEventListener('click', () => this.saveName());
            this.overlay.querySelector('#psCancelMode').addEventListener('click', () => {
                this.mode = 'list';
                this.createUI();
            });
            // Arrow nav: name field ↔ faction swatches ↔ SAVE/CANCEL.
            // Focusing a swatch picks that faction so the preview follows.
            const navItems = () => {
                const root = this.overlay.querySelector('.profile-selection-content');
                return typeof menuNavHelper !== 'undefined' ? menuNavHelper.collectFocusables(root) : [];
            };
            const moveNav = (direction) => {
                const list = navItems();
                if (!list.length) return;
                let idx = list.indexOf(document.activeElement);
                if (idx < 0) idx = 0;
                const next = menuNavHelper.moveFocusSpatial(list, idx, direction);
                const el = list[next];
                if (el && el !== input) input.classList.remove('nav-focused');
                if (el && el.classList.contains('profile-faction-swatch') && el.dataset.faction !== this.pendingFaction) {
                    el.click();
                }
            };
            this._keyHandler = (e) => {
                if (!this.isVisible) return;
                const onInput = document.activeElement === input;
                const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
                if (dir && !(onInput && (dir === 'left' || dir === 'right'))) {
                    e.preventDefault();
                    moveNav(dir);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const cancel = this.overlay.querySelector('#psCancelMode');
                    if (document.activeElement === cancel) cancel.click();
                    else this.saveName();
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
            <div class="profile-selection-content profile-selection-floating" data-faction="${(selected && selected.faction) || (profiles[0] && profiles[0].faction) || 'pirate'}">
                <h2 class="profile-selection-title">PROFILES</h2>
                <div class="profile-selection-body">
                    <div class="profile-list">
                        ${profiles.length ? profiles.map((p, i) => `
                            <div class="profile-list-item ${i === this.selectedIndex ? 'selected' : ''} ${p.id === activeId ? 'active' : ''}" data-index="${i}">
                                <span class="profile-list-emblem">${this.getFactionEmblemHtml(p.faction || 'pirate', 18)}</span>
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
        {
            const listBox = this.overlay.querySelector('.profile-selection-content');
            const sel = profiles[this.selectedIndex] || profiles[0];
            if (listBox && sel) this.applyFactionVars(listBox, sel.faction || 'pirate');
        }
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
