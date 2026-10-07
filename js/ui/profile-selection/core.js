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
    getFactionEmblemHtml(id, size = 16, detail) {
        if (typeof iconRenderer === 'undefined' || typeof factionShipStyles === 'undefined') return '';
        const base = factionShipStyles.emblemCamelKey ? factionShipStyles.emblemCamelKey(id) : null;
        if (!base) return '';
        // Finer (Scale2x) art for large emblems, or when the caller says the
        // emblem is magnified (`detail`, e.g. the galaxy map zoom).
        const mag = Math.max(1, Number(detail) || 1) * size / 16;
        const key = base + (mag >= 3 ? '@4x' : (mag >= 1.5 ? '@2x' : ''));
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
        if (typeof menuStateManager !== 'undefined' && this.mode === 'create') menuStateManager.save({ pfaction: id });
        const box = this.overlay.querySelector('.profile-selection-name-mode');
        this.applyFactionVars(box, id);
        const emblem = this.overlay.querySelector('.profile-faction-preview-emblem');
        if (emblem) emblem.innerHTML = this.getFactionEmblemHtml(id, 48);
        const name = this.overlay.querySelector('.profile-faction-preview-name');
        if (name) name.textContent = this.getFactionLabel(id);
        const meta = typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta
            ? planetConfigManager.getFactionMeta(id)
            : null;
        const hero = meta && meta.hero;
        const trait = this.overlay.querySelector('.profile-faction-preview-trait');
        if (trait) trait.textContent = meta && meta.traits.length ? meta.traits.join(' · ').toUpperCase() : '';
        const loreEl = this.overlay.querySelector('.profile-faction-lore-text');
        if (loreEl) this.renderFactionLore(loreEl, meta);
        const heroEl = this.overlay.querySelector('.profile-faction-preview-hero');
        if (heroEl) {
            heroEl.textContent = hero ? `HERO · ${hero.name}` : '';
            heroEl.title = hero ? `${hero.title} — ${hero.lore}` : '';
        }
        this.renderFactionFacts(id, meta);
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

    /**
     * Lore as structure: the short summary as a lead line, the long text
     * split into paragraphs of ~2 sentences, the hero's title as a footer.
     */
    renderFactionLore(el, meta) {
        el.textContent = '';
        if (!meta) return;
        const add = (cls, text) => {
            const p = document.createElement('p');
            p.className = cls;
            p.textContent = text;
            el.appendChild(p);
        };
        if (meta.lore && meta.lore !== meta.loreLong) add('profile-faction-lore-lead', meta.lore);
        const sentences = String(meta.loreLong || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [];
        for (let i = 0; i < sentences.length; i += 2) {
            add('profile-faction-lore-para', sentences.slice(i, i + 2).join('').trim());
        }
        if (meta.hero && meta.hero.title) {
            add('profile-faction-lore-hero', `${meta.hero.name} — ${meta.hero.title}`);
        }
    }

    /** Home galaxy, playstyle and preferred weapon (what new ships start with). */
    renderFactionFacts(id, meta) {
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const accent = this.getFactionColor(id);
        const fill = (fact, iconHtml, value, note) => {
            const box = this.overlay.querySelector(`.profile-faction-fact[data-fact="${fact}"]`);
            if (!box) return;
            box.querySelector('.profile-faction-fact-icon').innerHTML = iconHtml || '';
            box.querySelector('.profile-faction-fact-value').textContent = value || '—';
            const n = box.querySelector('.profile-faction-fact-note');
            if (n) n.textContent = note || '';
        };
        const galaxy = String((meta && meta.homeGalaxy) || '');
        const galaxyKey = { milky_way: 'galaxyMilkyWay', andromeda: 'galaxyAndromeda' }[galaxy] || 'galaxyDefault';
        fill('home', ir ? ir.imgHtml(galaxyKey, 40, '', accent, false) : '', galaxy.replace(/_/g, ' ').toUpperCase());

        const styleKey = { terran: 'statShield', kronax: 'statDamage', voidborn: 'statSpeed',
            pirate: 'resScrap', machine: 'statEnergy' }[id] || 'statWeapon';
        fill('style', ir ? ir.imgHtml(styleKey, 40, '', accent, false) : '', meta && meta.playstyle);

        const ids = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons
            ? factionShipStyles.getFactionDefaultWeapons(id) : [];
        const wid = ids[0] || 'laser';
        const w = typeof weaponConfigManager !== 'undefined' ? weaponConfigManager.getWeapon(wid) : null;
        const name = String((w && w.name) || wid).toUpperCase();
        const stats = w ? ` · DMG ${w.damage} · ${(1000 / Math.max(1, w.cooldown)).toFixed(1)}/S` : '';
        const allies = typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionAllies
            ? planetConfigManager.getFactionAllies(id) : [];
        const alliesBox = this.overlay.querySelector('.profile-faction-fact[data-fact="allies"]');
        fill('allies', ir ? ir.imgHtml('menuFactions', 40, '', accent, false) : '',
            allies.length ? allies.map((a) => this.getFactionLabel(a)).join(' · ') : 'NONE',
            allies.length ? 'Fight side by side — their ships never attack each other.' : 'Stands alone against every other faction.');
        if (alliesBox && allies.length) {
            const v = alliesBox.querySelector('.profile-faction-fact-value');
            v.innerHTML = allies.map((a) =>
                `<span class="profile-faction-ally" style="color:${this.getFactionColor(a)}">` +
                `${this.getFactionEmblemHtml(a, 24)}${this.getFactionLabel(a)}</span>`).join('');
        }
        fill('weapon', ir && ir.weaponImgHtml ? ir.weaponImgHtml(wid, 40, '', false) : '',
            name + stats, meta && meta.weaponNote);
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
        // The screen bezel follows the faction while it is being chosen.
        const bz = document.getElementById('vf-bezel');
        if (bz && box.classList.contains('profile-selection-name-mode')) {
            bz.setAttribute('data-faction', id);
            bz.setAttribute('data-preview', '1');
            bz.style.setProperty('--retro-ink', accent);
            bz.style.setProperty('--color-primary', accent);
            const crest = bz.querySelector('.vf-pilot-crest');
            if (crest) crest.setAttribute('data-f', id);
        }
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
            const model = Object.assign({}, shipConfigManager.getMergedModel(shipId), { id: shipId, faction: id, factionPreview: true });
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
            this.pendingFaction = this.getFactionIds()[0];
        }
        this.createUI();
        // Embedded in the station menu, the station persists its own tab.
        const inStation = typeof homeStationUI !== 'undefined' && homeStationUI.isVisible;
        if (typeof menuStateManager !== 'undefined' && !inStation) {
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
        this.host = null;
    }

    getProfiles() {
        if (typeof profileManager !== 'undefined') {
            return profileManager.getProfiles();
        }
        return [];
    }

    createUI() {
        // Remember where the pilot flow is, so a refresh returns to it (menu-state/restore.js).
        const inStationUi = typeof homeStationUI !== 'undefined' && homeStationUI.isVisible;
        if (typeof menuStateManager !== 'undefined' && !inStationUi && this.isVisible) {
            menuStateManager.save({
                pmode: this.mode, pstep: this.createStep || null,
                pfaction: this.pendingFaction || null, pcreateOnly: !!this._createOnly
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
            this.overlay.innerHTML = html;
            for (let i = keep.length - 1; i >= 0; i--) {
                this.overlay.insertBefore(keep[i], this.overlay.firstChild);
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
                    ${profiles.length ? `<button class="action-button secondary" id="psDelete">${ProfileSelectionManager.btnIconHtml('delete')}DELETE</button>
                    <button class="action-button secondary" id="psRename">${ProfileSelectionManager.btnIconHtml('rename')}RENAME</button>` : ''}
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
    }

    /**
     * Create flow is two steps: 1) pick a faction (← → cycle, ENTER confirm),
     * 2) name the pilot (defaults to the faction hero). Rename skips step 1.
     */
    /**
     * Start options for a new pilot: start galaxy (defaults to the faction's
     * home galaxy) and a starter kit. Difficulty is a global setting. Applied in saveName().
     */
    renderStartOptionsHtml() {
        const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
            ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
        const home = (meta && meta.homeGalaxy) || 'milky_way';
        const galaxies = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds)
            ? planetConfigManager.getGalaxyIds() : ['milky_way'];
        if (!this._startOpts || this._startOpts.faction !== this.pendingFaction) {
            this._startOpts = {
                faction: this.pendingFaction,
                galaxy: home,
                kit: 'balanced'
            };
        }
        const o = this._startOpts;
        const kits = [
            ['balanced', 'BALANCED', 'Standard start'],
            ['credits', 'CREDITS', '+200 CR'],
            ['salvage', 'SALVAGE', '+120 scrap, +40 ore, +15 crystal'],
            ['gunsmith', 'GUNSMITH', '+1 weapon slot on your ship']
        ];
        const rk = (id) => (typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey) ? homeStationUI.resourceIconKey(id) : null;
        const kitKey = { balanced: 'menuShips', credits: rk('credits'), salvage: rk('scrap'), gunsmith: 'hsCraft' };
        const kitIcon = (v) => (kitKey[v] && typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml)
            ? `<span class="profile-kit-icon">${iconRenderer.imgHtml(kitKey[v], 24, 'hs-pixel')}</span>` : '';
        const chip = (group, value, label, tip) =>
            `<button type="button" class="profile-start-chip${o[group] === value ? ' selected' : ''}" data-start-opt="${group}"` +
            ` data-value="${value}" aria-pressed="${o[group] === value}" tabindex="-1"${tip ? ` title="${tip}"` : ''}>${group === 'kit' ? kitIcon(value) : ''}${label}</button>`;
        const galaxyName = (gid) => {
            const g = planetConfigManager.getGalaxy ? planetConfigManager.getGalaxy(gid) : null;
            return String((g && g.name) || gid).toUpperCase();
        };
        return `
            <div class="profile-start-options">
                <div class="profile-start-row" data-start-row="galaxy">
                    <span class="profile-start-label">START GALAXY</span>
                    <div class="profile-start-galaxy" id="psStartGalaxy">${this.renderStartGalaxyCardHtml(o.galaxy, home)}</div>
                </div>
                <div class="profile-start-row" data-start-row="kit">
                    <span class="profile-start-label">STARTER KIT</span>
                    <div class="profile-start-kit-card">
                        <div class="profile-start-chips">${kits.map(([v, l, t]) => chip('kit', v, l, t)).join('')}</div>
                        <div class="profile-start-kit-effect" id="psKitEffect">${(kits.find(([v]) => v === o.kit) || kits[0])[2].toUpperCase()}</div>
                    </div>
                </div>
            </div>`;
    }

    /**
     * NEW GALAXY modal (over the pilot screen): name, ruler, held/contested,
     * planet count and difficulty. CREATE generates it and selects it as
     * the start galaxy. Rows: ↑/↓ move, ←/→ change, ENTER create, ESC close.
     */
    generateStartGalaxy() {
        const box = this.overlay && this.overlay.querySelector('#psStartGalaxy');
        if (!box || !this._startOpts) return;
        this.openNewGalaxyModal({
            host: this.overlay.querySelector('.profile-selection-content') || this.overlay,
            onCreate: (g) => {
                this._startOpts.galaxy = g.id;
                const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
                box.innerHTML = this.renderStartGalaxyCardHtml(g.id, (meta && meta.homeGalaxy) || 'milky_way');
            }
        });
    }

    /** NEW GALAXY modal in opts.host; opts.onCreate(galaxy) after CREATE. Also used by the galaxy viewer. */
    openNewGalaxyModal(opts) {
        if (!planetConfigManager.generateGalaxy || this._galaxyModal) return;
        const factions = this.getFactionIds();
        const tiers = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'];
        const counts = [5, 7, 9, 12];
        const st = {
            name: planetConfigManager.randomGalaxyName(),
            faction: factions[Math.floor(Math.random() * factions.length)],
            control: 'held',
            planetCount: 7,
            sunCount: 1,
            difficultyTier: 1,
            rivals: [],
            seed: Math.floor(Math.random() * 1e9)
        };
        const groups = {
            faction: factions.map((f) => [f, String(f).toUpperCase(), this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, 16) : '']),
            control: [['held', 'HELD', ''], ['contested', 'CONTESTED', '']],
            planetCount: counts.map((n) => [n, String(n), '']),
            sunCount: [1, 2, 3].map((n) => [n, String(n), '']),
            difficultyTier: tiers.map((t, i) => [i, t, ''])
        };
        const labels = { faction: 'RULER', control: 'CONTROL', planetCount: 'PLANETS', sunCount: 'SUNS', difficultyTier: 'DIFFICULTY' };
        const rows = ['name', 'faction', 'control', 'planetCount', 'sunCount', 'difficultyTier', 'buttons'];
        const modal = document.createElement('div');
        modal.className = 'profile-galaxy-modal';
        modal.innerHTML = `
            <div class="profile-galaxy-modal-box" role="dialog" aria-label="New galaxy">
                <h3 class="profile-galaxy-modal-title">NEW GALAXY</h3>
                <div class="profile-galaxy-modal-body">
                <div class="profile-galaxy-modal-form">
                <div class="profile-start-row" data-gm-row="name">
                    <span class="profile-start-label">NAME</span>
                    <div class="profile-galaxy-modal-name">
                        <input type="text" class="profile-galaxy-modal-input" maxlength="24" value="${st.name}">
                        <button type="button" class="profile-start-chip" data-gm-reroll tabindex="-1" title="Random name">↻</button>
                    </div>
                </div>
                ${Object.keys(groups).map((g) => `
                <div class="profile-start-row" data-gm-row="${g}">
                    <span class="profile-start-label">${labels[g]}</span>
                    <div class="profile-start-chips">${groups[g].map(([v, l, icon]) =>
                        `<button type="button" class="profile-start-chip${st[g] === v ? ' selected' : ''}" data-gm-opt="${g}" data-value="${v}" tabindex="-1">${icon}${l}</button>`).join('')}</div>
                </div>`).join('')}
                </div>
                <div class="profile-galaxy-modal-preview" data-gm-preview></div>
                </div>
                <div class="profile-galaxy-modal-buttons" data-gm-row="buttons">
                    <button type="button" class="profile-start-chip" data-gm-cancel tabindex="-1">CANCEL</button>
                    <button type="button" class="profile-start-chip" data-gm-create tabindex="-1">CREATE</button>
                </div>
            </div>`;
        ((opts && opts.host) || document.body).appendChild(modal);
        this._galaxyModal = modal;
        const input = modal.querySelector('.profile-galaxy-modal-input');
        const actions = [modal.querySelector('[data-gm-cancel]'), modal.querySelector('[data-gm-create]')];
        let row = 0;
        let btn = 1;
        const preview = modal.querySelector('[data-gm-preview]');
        const refresh = () => { preview.innerHTML = this.renderNewGalaxyPreviewHtml(st, input.value, tiers); };
        const setOpt = (g, v) => {
            st[g] = v;
            // Contested: pick the rivals now so the preview shows who fights.
            if (g === 'faction' || g === 'control') {
                st.rivals = st.control === 'contested' ? planetConfigManager.pickGalaxyRivals(st.faction) : [];
            }
            if (g === 'planetCount') st.seed = Math.floor(Math.random() * 1e9);
            modal.querySelectorAll(`[data-gm-opt="${g}"]`).forEach((b) =>
                b.classList.toggle('selected', String(v) === b.getAttribute('data-value')));
            refresh();
        };
        const sync = () => {
            modal.querySelectorAll('[data-gm-row]').forEach((r) =>
                r.classList.toggle('nav-row-active', r.getAttribute('data-gm-row') === rows[row]));
            actions.forEach((b, i) => b.classList.toggle('selected', rows[row] === 'buttons' && i === btn));
            if (rows[row] === 'name') input.focus(); else input.blur();
        };
        const close = () => {
            window.removeEventListener('keydown', onKey, true);
            modal.remove();
            this._galaxyModal = null;
        };
        const create = () => {
            const g = planetConfigManager.generateGalaxy(Object.assign({}, st, { name: input.value }));
            close();
            if (opts && opts.onCreate) opts.onCreate(g);
        };
        const onKey = (e) => {
            // Screen rebuilt underneath: drop the stale modal.
            if (!modal.isConnected) { close(); return; }
            // The modal owns the keyboard while open.
            e.stopImmediatePropagation();
            const id = rows[row];
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (id === 'buttons' && btn === 0) close(); else create();
                return;
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                row = Math.max(0, Math.min(rows.length - 1, row + (e.key === 'ArrowDown' ? 1 : -1)));
                sync();
                return;
            }
            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && id !== 'name') {
                e.preventDefault();
                const d = e.key === 'ArrowLeft' ? -1 : 1;
                if (id === 'buttons') { btn = (btn + d + 2) % 2; sync(); return; }
                const vals = groups[id].map((o) => o[0]);
                const i = vals.indexOf(st[id]);
                setOpt(id, vals[(i + d + vals.length) % vals.length]);
            }
        };
        window.addEventListener('keydown', onKey, true);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { close(); return; }
            const opt = e.target.closest('[data-gm-opt]');
            if (opt) {
                const g = opt.getAttribute('data-gm-opt');
                const raw = opt.getAttribute('data-value');
                setOpt(g, typeof st[g] === 'number' ? Number(raw) : raw);
                const r = rows.indexOf(g);
                if (r >= 0) { row = r; sync(); }
            } else if (e.target.closest('[data-gm-reroll]')) {
                input.value = planetConfigManager.randomGalaxyName();
                st.seed = Math.floor(Math.random() * 1e9);
                refresh();
            } else if (e.target.closest('[data-gm-create]')) {
                create();
            } else if (e.target.closest('[data-gm-cancel]')) {
                close();
            }
        });
        input.addEventListener('input', refresh);
        sync();
        refresh();
        input.select();
    }

    /**
     * Sketch of the galaxy about to be created: planets in their ruler's
     * colour (contested ones split with a rival), lanes, a sun and the
     * difficulty ramp. The real layout is charted on first visit.
     */
    renderNewGalaxyPreviewHtml(st, name, tiers) {
        const pcm = planetConfigManager;
        const color = (f) => (pcm.getFactionPlanetTheme(f).baseColor || '#888');
        let s = (st.seed >>> 0) || 1;
        const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        const W = 320;
        const H = 200;
        const P = 26;
        const n = st.planetCount;
        const pts = [];
        for (let i = 0; i < n; i++) {
            let best = null;
            for (let k = 0; k < 12; k++) {
                const c = { x: P + rnd() * (W - P * 2), y: P + rnd() * (H - P * 2) };
                const d = pts.reduce((m, p) => Math.min(m, Math.hypot(p.x - c.x, p.y - c.y)), 1e9);
                if (!best || d > best.d) best = Object.assign(c, { d });
            }
            pts.push(best);
        }
        // Lanes: each planet links to its nearest earlier planet (a tree).
        let edges = '';
        for (let i = 1; i < n; i++) {
            let j = 0;
            for (let k = 1; k < i; k++) {
                if (Math.hypot(pts[k].x - pts[i].x, pts[k].y - pts[i].y) < Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y)) j = k;
            }
            edges += `<line x1="${pts[i].x | 0}" y1="${pts[i].y | 0}" x2="${pts[j].x | 0}" y2="${pts[j].y | 0}"/>`;
        }
        const rivals = st.control === 'contested' ? (st.rivals || []) : [];
        const planets = pts.map((p, i) => {
            const tier = Math.min(tiers.length - 1, st.difficultyTier + Math.floor(i / 2));
            const r = i === 0 ? 9 : 6 + Math.floor(rnd() * 3);
            const rival = rivals.length && i > 0 && i % 2 === 0 ? rivals[(i / 2) % rivals.length | 0] : null;
            const x = p.x | 0;
            const y = p.y | 0;
            return `<g><title>${tiers[tier]}${rival ? ' · ' + rival.toUpperCase() : ''}</title>` +
                `<circle cx="${x}" cy="${y}" r="${r}" fill="${color(st.faction)}"/>` +
                (rival ? `<path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z" fill="${color(rival)}"/>` : '') +
                `<rect x="${x - 3}" y="${y + r + 3}" width="${(tier + 1) * 3}" height="2" class="tier"/>` +
                (i === 0 ? `<path class="start" d="M${x - r - 4} ${y - r - 4}h5v2h-3v3h-2zM${x + r + 4} ${y - r - 4}h-5v2h3v3h2zM${x - r - 4} ${y + r + 4}h5v-2h-3v-3h-2zM${x + r + 4} ${y + r + 4}h-5v-2h3v-3h2z"/>` : '') +
                `</g>`;
        }).join('');
        // Suns on the map edge, spread so they don't overlap.
        const sunKinds = ['#ffb347', '#ff9a3d', '#cfe8ff', '#ff6a4a'];
        const sunSpots = [{ x: 0, y: 0.3 }, { x: W, y: 0.7 }, { x: 0.5, y: 0 }, { x: 0, y: 0.8 }, { x: W, y: 0.2 }, { x: 0.5, y: 1 }];
        const sunOff = Math.floor(rnd() * sunSpots.length);
        const suns = [];
        for (let i = 0; i < (st.sunCount || 1); i++) {
            const sp = sunSpots[(sunOff + i * 2) % sunSpots.length];
            suns.push({
                x: sp.x <= 1 && sp.x > 0 ? sp.x * W : sp.x,
                y: sp.y * H,
                c: sunKinds[Math.floor(rnd() * sunKinds.length)],
                r: 26 + Math.floor(rnd() * 16)
            });
        }
        const emblem = (f) => (this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, 16) : '');
        const last = Math.min(tiers.length - 1, st.difficultyTier + Math.floor((n - 1) / 2));
        return `
            <svg class="profile-galaxy-modal-map" viewBox="0 0 ${W} ${H}" aria-hidden="true" style="--gm-color:${color(st.faction)}">
                ${suns.map((u) => `<circle cx="${u.x | 0}" cy="${u.y | 0}" r="${u.r * 1.8 | 0}" fill="${u.c}" opacity="0.12"/>` +
                    `<circle cx="${u.x | 0}" cy="${u.y | 0}" r="${u.r}" fill="${u.c}" opacity="0.85"/>`).join('')}
                <g class="lanes">${edges}</g>${planets}
            </svg>
            <div class="profile-galaxy-modal-sum">
                <strong>${String(name || '').trim().toUpperCase() || '—'}</strong>
                <span>${emblem(st.faction)}${st.faction.toUpperCase()} · ${rivals.length ? 'CONTESTED' : 'HELD'}</span>
                ${rivals.length ? `<span class="vs">VS ${rivals.map((f) => emblem(f) + f.toUpperCase()).join(' · ')}</span>` : ''}
                <span>${n} PLANETS · ${st.sunCount || 1} SUN${(st.sunCount || 1) > 1 ? 'S' : ''} · ${tiers[st.difficultyTier]}${last !== st.difficultyTier ? ' → ' + tiers[last] : ''}</span>
            </div>`;
    }

    /**
     * Galaxy dropdown under the card's name: every galaxy with its ruler's
     * emblem in front (plus small rival emblems when contested).
     */
    toggleStartGalaxyList(box) {
        const open = box.querySelector('.profile-start-galaxy-list');
        if (open) { open.remove(); return; }
        const pcm = planetConfigManager;
        const meta = pcm.getFactionMeta ? pcm.getFactionMeta(this.pendingFaction) : null;
        const home = (meta && meta.homeGalaxy) || 'milky_way';
        const emblem = (f, size) => (f && this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, size) : '');
        const items = pcm.getGalaxyIds().map((gid) => {
            const g = pcm.getGalaxy(gid);
            const c = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
            const ruler = (c && c.main) || (g && g.faction);
            const rivals = c && c.control === 'contested' ? c.rivals : [];
            const sel = gid === this._startOpts.galaxy;
            return `<li role="option" aria-selected="${sel}" class="${sel ? 'selected' : ''}" data-galaxy-id="${gid}"` +
                ` title="${String(ruler || '').toUpperCase()}${rivals.length ? ' · CONTESTED' : ''}">` +
                `<span class="ruler">${emblem(ruler, 20)}</span>` +
                `<span class="name">${String((g && g.name) || gid).toUpperCase()}${gid === home ? ' ★' : ''}</span>` +
                (rivals.length ? `<span class="rivals">${rivals.map((f) => emblem(f, 12)).join('')}</span>` : '') +
                `</li>`;
        }).join('');
        const list = document.createElement('ul');
        list.className = 'profile-start-galaxy-list';
        list.setAttribute('role', 'listbox');
        list.innerHTML = items;
        const info = box.querySelector('.profile-start-galaxy-info');
        info.appendChild(list);
        const sel = list.querySelector('.selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
        // Close on any click outside the list.
        const away = (e) => {
            if (!list.isConnected) { document.removeEventListener('mousedown', away, true); return; }
            if (!e.target.closest('.profile-start-galaxy-list, [data-galaxy-pick]')) {
                list.remove();
                document.removeEventListener('mousedown', away, true);
            }
        };
        document.addEventListener('mousedown', away, true);
    }

    /** Start galaxy card: ‹ mini map · name · ruler · planets › (cycled with the arrows). */
    renderStartGalaxyCardHtml(gid, home) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const g = pcm && pcm.getGalaxy ? pcm.getGalaxy(gid) : null;
        const name = String((g && g.name) || gid).toUpperCase();
        let map = (pcm && pcm.getGalaxyMap && pcm.getGalaxyMap(gid)) || {};
        // Uncharted galaxy: chart its arrival sector now (galaxy maps are
        // shared, and generation is idempotent), so the preview shows the real
        // layout the pilot will start on.
        if (!(map.nodes && map.nodes.length) && pcm && pcm.ensureGalaxyArrivalContent) {
            try {
                pcm.ensureGalaxyArrivalContent(gid, 'start|' + gid, { firstVisit: false });
                map = pcm.getGalaxyMap(gid) || map;
            } catch (e) { /* keep the spiral placeholder */ }
        }
        const nodes = map.nodes || [];
        const color = (g && g.baseColor) || 'var(--faction-accent, var(--color-primary))';
        const W = 560;
        const H = 220;
        const P = 20;
        const pos = {};
        nodes.forEach((n) => { pos[n.planetId] = { x: P + n.x * (W - P * 2), y: P + n.y * (H - P * 2) }; });
        const edges = (map.edges || []).map((e) => {
            const a = pos[e[0]];
            const b = pos[e[1]];
            if (!a || !b) return '';
            // Dotted pixel lane instead of a hairline.
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            let d = '';
            for (let t = 14; t < len - 14; t += 6) {
                const x = Math.round(a.x + (b.x - a.x) * t / len);
                const y = Math.round(a.y + (b.y - a.y) * t / len);
                d += `M${x - 1} ${y - 1}h2v2h-2z`;
            }
            return `<path d="${d}"/>`;
        }).join('');
        // Seeded backdrop: star field + nebula dust in the galaxy colour.
        let seed = 0;
        for (const ch of String(gid)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
        let stars = '';
        for (let i = 0; i < 110; i++) {
            const sz = rnd() < 0.12 ? 2 : 1;
            stars += `<rect x="${Math.floor(rnd() * W)}" y="${Math.floor(rnd() * H)}" width="${sz}" height="${sz}" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`;
        }
        let dust = '';
        for (let c = 0; c < 4; c++) {
            const cx = rnd() * W;
            const cy = rnd() * H;
            const rr = 30 + rnd() * 50;
            for (let i = 0; i < 70; i++) {
                const a = rnd() * Math.PI * 2;
                const d = Math.pow(rnd(), 0.7) * rr;
                const x = Math.floor((cx + Math.cos(a) * d * 1.6) / 4) * 4;
                const y = Math.floor((cy + Math.sin(a) * d) / 4) * 4;
                dust += `<rect x="${x}" y="${y}" width="4" height="4" opacity="${(0.05 + (1 - d / rr) * 0.18).toFixed(2)}"/>`;
            }
        }
        // Uncharted galaxy (no map until its first visit): a pixel spiral
        // in the galaxy colour stands in for the real layout.
        let spiral = '';
        if (!nodes.length) {
            const cx = W / 2;
            const cy = H / 2;
            for (let arm = 0; arm < 2; arm++) {
                for (let i = 0; i < 26; i++) {
                    const t = i / 26;
                    const ang = arm * Math.PI + t * Math.PI * 2.4;
                    const rad = 6 + t * (H * 0.46);
                    const x = Math.round(cx + Math.cos(ang) * rad * 1.9);
                    const y = Math.round(cy + Math.sin(ang) * rad * 0.8);
                    const sz = t < 0.25 ? 4 : (t < 0.7 ? 3 : 2);
                    spiral += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" opacity="${(1 - t * 0.7).toFixed(2)}"/>`;
                }
            }
            spiral += `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" class="is-start"/>`;
        }
        const gm = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml ? galaxyMapManager : null;
        const dots = nodes.map((n) => {
            const q = pos[n.planetId];
            const start = n.planetId === map.startPlanetId;
            const sz = start ? 34 : 26;
            // Start planet: pixel corner brackets.
            const b = sz / 2 + 4;
            const br = start ? `<path class="start-bracket" d="M${q.x - b} ${q.y - b}h6v2h-4v4h-2zM${q.x + b} ${q.y - b}h-6v2h4v4h2zM${q.x - b} ${q.y + b}h6v-2h-4v-4h-2zM${q.x + b} ${q.y + b}h-6v-2h4v-4h2z"/>` : '';
            const icon = gm
                ? `<foreignObject x="${q.x - sz / 2}" y="${q.y - sz / 2}" width="${sz}" height="${sz}"><div xmlns="http://www.w3.org/1999/xhtml" class="profile-start-planet">${gm.planetIconHtml(n.planetId, sz, true)}</div></foreignObject>`
                : `<rect x="${q.x - 4}" y="${q.y - 4}" width="8" height="8"${start ? ' class="is-start"' : ''}/>`;
            return icon + br;
        }).join('');
        const control = pcm && pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
        const ruler = control && control.main;
        const crest = ruler && this.getFactionEmblemHtml ? this.getFactionEmblemHtml(ruler, 48) : '';
        const state = control ? (control.control === 'contested' ? 'CONTESTED' : 'HELD') : '';
        return `
            <button type="button" class="profile-start-galaxy-nav" data-galaxy-step="-1" tabindex="-1" aria-label="Previous galaxy">‹</button>
            <svg class="profile-start-galaxy-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="--galaxy-color:${color}" shape-rendering="crispEdges" aria-hidden="true">
                <g class="dust">${dust}</g><g class="stars">${stars}</g>
                <g class="suns">${nodes.length && pcm.getGalaxySuns ? pcm.getGalaxySuns(gid).map((sun) => {
                    const sx = Math.round(P + sun.x * (W - P * 2));
                    const sy = Math.round(P + sun.y * (H - P * 2));
                    const sr = Math.max(10, Math.round(sun.r * W * 0.55));
                    return `<rect x="${sx - sr * 2}" y="${sy - sr * 2}" width="${sr * 4}" height="${sr * 4}" rx="${sr * 2}" fill="${sun.glow}" opacity="0.18"/>` +
                        `<rect x="${sx - sr}" y="${sy - sr}" width="${sr * 2}" height="${sr * 2}" rx="${sr}" fill="${sun.color}"/>`;
                }).join('') : ''}</g>
                <g class="edges">${edges}</g><g class="dots">${dots}${spiral}</g>
            </svg>
            <div class="profile-start-galaxy-info">
                <button type="button" class="profile-start-galaxy-pick" data-galaxy-pick tabindex="-1" aria-haspopup="listbox" title="Choose a galaxy">
                    ${crest ? `<span class="profile-start-galaxy-crest" title="${String(ruler).toUpperCase()}">${crest}</span>` : ''}<strong class="profile-start-galaxy-name">${name}</strong><span class="profile-start-galaxy-caret">▾</span>
                </button>
                ${gid === home ? '<span class="profile-start-galaxy-home" title="Faction home galaxy">★ HOME</span>' : ''}
                ${ruler ? `<span class="profile-start-galaxy-ruler"><span>${String(ruler).toUpperCase()} · ${state}</span></span>` : ''}
                <span class="profile-start-galaxy-meta">${nodes.length
                    ? nodes.length + ' PLANETS · START ' + String(map.startPlanetId || '—').toUpperCase()
                    : 'UNCHARTED · ARRIVAL SECTOR CHARTED ON START'}</span>
                <button type="button" class="profile-start-galaxy-new" data-galaxy-new tabindex="-1" title="Create a new galaxy (N)">+ NEW GALAXY</button>
            </div>
            <button type="button" class="profile-start-galaxy-nav" data-galaxy-step="1" tabindex="-1" aria-label="Next galaxy">›</button>`;
    }

    /** Preferred weapon of the pending faction as an icon + name (name step). */
    renderPreferredWeaponHtml() {
        const ids = (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons)
            ? factionShipStyles.getFactionDefaultWeapons(this.pendingFaction) : ['laser'];
        const id = ids[0] || 'laser';
        const w = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon ? weaponConfigManager.getWeapon(id) : null;
        const icon = typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml
            ? iconRenderer.weaponImgHtml(id, 32, 'profile-weapon-icon-img') : '';
        return `<span class="profile-faction-preview-weapon" title="Preferred weapon">` +
            `<span class="profile-faction-preview-weapon-icon">${icon}</span>` +
            `<span>${String((w && w.name) || id).toUpperCase()}</span></span>`;
    }

    renderNameMode(setHtml, reuse, profiles) {
        const create = this.mode === 'create';
        const step = create ? (this.createStep || 'faction') : 'name';
        const pickFaction = create && step === 'faction';
        const title = !create ? 'RENAME PROFILE' : (pickFaction ? 'CHOOSE FACTION' : 'NAME YOUR PILOT');
        const swatchesHtml = pickFaction ? `
            <div class="profile-faction-picker">
                <div class="profile-faction-picker-label">← FACTION →</div>
                <div class="profile-faction-swatches">
                    ${this.getFactionIds().map((id) => `
                        <button type="button" class="profile-faction-swatch${id === this.pendingFaction ? ' selected' : ''}"
                            data-faction="${id}" title="${this.getFactionLabel(id)}" tabindex="-1"
                            style="--faction-color: ${this.getFactionColor(id)}">
                            <span class="profile-faction-swatch-emblem">${this.getFactionEmblemHtml(id, 48)}</span>
                            <span class="profile-faction-swatch-label">${this.getFactionLabel(id)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>` : '';
        const previewHtml = create ? `
            <div class="profile-faction-info-row">
            <div class="profile-faction-preview">
                <canvas class="profile-faction-ship" width="200" height="140" aria-label="Faction ship preview"></canvas>
                <div class="profile-faction-preview-text">
                    <span class="profile-faction-preview-emblem"></span>
                    <strong class="profile-faction-preview-name"></strong>
                    <small class="profile-faction-preview-trait"></small>
                    <small class="profile-faction-preview-hero"></small>
                    ${create && !pickFaction ? this.renderPreferredWeaponHtml() : ''}
                </div>
            </div>
            <div class="profile-faction-lore" role="note">
                <div class="profile-faction-lore-label">ⓘ LORE</div>
                <div class="profile-faction-lore-text"></div>
            </div>
            </div>
            <div class="profile-faction-facts">
                <div class="profile-faction-fact" data-fact="home">
                    <span class="profile-faction-fact-icon"></span>
                    <div class="profile-faction-fact-body">
                        <div class="profile-faction-fact-label">HOME GALAXY</div>
                        <div class="profile-faction-fact-value"></div>
                    </div>
                </div>
                <div class="profile-faction-fact" data-fact="style">
                    <span class="profile-faction-fact-icon"></span>
                    <div class="profile-faction-fact-body">
                        <div class="profile-faction-fact-label">PLAYSTYLE</div>
                        <div class="profile-faction-fact-value"></div>
                    </div>
                </div>
                <div class="profile-faction-fact" data-fact="weapon">
                    <span class="profile-faction-fact-icon"></span>
                    <div class="profile-faction-fact-body">
                        <div class="profile-faction-fact-label">PREFERRED WEAPON</div>
                        <div class="profile-faction-fact-value"></div>
                        <div class="profile-faction-fact-note"></div>
                    </div>
                </div>
                <div class="profile-faction-fact" data-fact="allies">
                    <span class="profile-faction-fact-icon"></span>
                    <div class="profile-faction-fact-body">
                        <div class="profile-faction-fact-label">ALLIES</div>
                        <div class="profile-faction-fact-value"></div>
                        <div class="profile-faction-fact-note"></div>
                    </div>
                </div>
            </div>` : '';
        const inputHtml = pickFaction ? ''
            : '<input type="text" class="profile-name-input" id="profileNameInput" maxlength="16" placeholder="NAME" autocomplete="off" spellcheck="false"/>';
        const btnIcon = (kind) => ProfileSelectionManager.btnIconHtml(kind);
        const primary = pickFaction ? 'NEXT' : 'SAVE';
        const secondary = create && !pickFaction ? 'BACK' : 'CANCEL';
        const hint = pickFaction ? '← → Faction | ENTER Confirm | ESC Cancel'
            : (create ? '↑ ↓ Row | ← → Change | ENTER Save | ESC Back' : 'ENTER Save | ESC Cancel');
        setHtml(`
            <div class="profile-selection-content profile-selection-floating profile-selection-name-mode${create && !pickFaction ? ' is-name-step' : ''}">
                <h2 class="profile-selection-title">${title}</h2>
                ${pickFaction ? '' : inputHtml}
                ${create && !pickFaction ? this.renderStartOptionsHtml() : ''}
                ${swatchesHtml}
                ${previewHtml}
                <div class="profile-selection-actions">
                    <button class="action-button secondary" id="psCancelMode">${btnIcon(secondary === 'BACK' ? 'back' : 'cancel')}${secondary}</button>
                    <button class="action-button" id="psSave">${btnIcon(pickFaction ? 'next' : 'save')}${primary}</button>
                </div>
                <div class="profile-selection-instructions"><p>${hint}</p></div>
            </div>
        `);
        if (!reuse) (this.host || document.body).appendChild(this.overlay);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        const input = this.overlay.querySelector('#profileNameInput');
        if (input && this.mode === 'rename' && profiles[this.selectedIndex]) {
            input.value = profiles[this.selectedIndex].name;
        }
        if (create) this.applyPendingFactionLook();
        const saveBtn = this.overlay.querySelector('#psSave');
        const cancelBtn = this.overlay.querySelector('#psCancelMode');
        // Start galaxy card: arrows cycle through the galaxies in place.
        const galaxyBox = this.overlay.querySelector('#psStartGalaxy');
        if (galaxyBox) {
            galaxyBox.addEventListener('click', (e) => {
                if (e.target.closest('[data-galaxy-new]')) {
                    this.generateStartGalaxy();
                    return;
                }
                if (e.target.closest('[data-galaxy-pick]')) {
                    this.toggleStartGalaxyList(galaxyBox);
                    return;
                }
                const item = e.target.closest('[data-galaxy-id]');
                const nav = e.target.closest('[data-galaxy-step]');
                if (!item && !nav) return;
                if (item) {
                    this._startOpts.galaxy = item.getAttribute('data-galaxy-id');
                } else {
                    const ids = planetConfigManager.getGalaxyIds();
                    const i = ids.indexOf(this._startOpts.galaxy);
                    const step = Number(nav.getAttribute('data-galaxy-step')) || 1;
                    this._startOpts.galaxy = ids[(((i < 0 ? 0 : i) + step) % ids.length + ids.length) % ids.length];
                }
                const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
                galaxyBox.innerHTML = this.renderStartGalaxyCardHtml(this._startOpts.galaxy, (meta && meta.homeGalaxy) || 'milky_way');
            });
        }
        // Start options (galaxy / kit): toggle in place so the
        // typed name is kept.
        this.overlay.querySelectorAll('[data-start-opt]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const group = btn.getAttribute('data-start-opt');
                this._startOpts[group] = btn.getAttribute('data-value');
                this.overlay.querySelectorAll(`[data-start-opt="${group}"]`).forEach((b) => {
                    const on = b === btn;
                    b.classList.toggle('selected', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                const effect = group === 'kit' && this.overlay.querySelector('#psKitEffect');
                if (effect) effect.textContent = String(btn.getAttribute('title') || '').toUpperCase();
            });
        });

        const pickIndex = (i) => {
            const ids = this.getFactionIds();
            const n = ids.length;
            this.pendingFaction = ids[((i % n) + n) % n];
            this.overlay.querySelectorAll('.profile-faction-swatch').forEach((el) => {
                el.classList.toggle('selected', el.dataset.faction === this.pendingFaction);
            });
            this.applyPendingFactionLook();
        };
        const confirm = () => {
            if (pickFaction) {
                this.createStep = 'name';
                this.createUI();
            } else {
                this.saveName();
            }
        };
        const cancel = () => {
            if (create && !pickFaction) {
                this.createStep = 'faction';
            } else if (create && (this._createOnly || !this.getProfiles().length)) {
                // Nothing to go back to: leave (back to the start menu).
                this.close();
                return;
            } else {
                this.mode = 'list';
            }
            this.createUI();
        };
        this.overlay.querySelectorAll('.profile-faction-swatch').forEach((btn) => {
            btn.addEventListener('click', () => pickIndex(this.getFactionIds().indexOf(btn.dataset.faction)));
            btn.addEventListener('dblclick', confirm);
        });
        saveBtn.addEventListener('click', confirm);
        cancelBtn.addEventListener('click', cancel);

        // Focus rows. Faction step: [swatches, buttons]. Name step (create):
        // [name, galaxy, kit, buttons]. Rename: [name, buttons].
        // ←/→: swatches cycle factions, option rows change their value,
        // buttons move between buttons, the name input moves the caret.
        const rows = pickFaction ? ['faction', 'buttons']
            : (create ? ['name', 'galaxy', 'kit', 'buttons'] : ['name', 'buttons']);
        let row = 0;
        let btnIdx = 0;
        const buttons = [saveBtn, cancelBtn];
        const rowId = () => rows[row];
        const syncFocus = () => {
            const id = rowId();
            buttons.forEach((b, i) => b.classList.toggle('nav-focused', id === 'buttons' && i === btnIdx));
            const swatchRow = this.overlay.querySelector('.profile-faction-swatches');
            if (swatchRow) swatchRow.classList.toggle('nav-row-active', id === 'faction');
            this.overlay.querySelectorAll('[data-start-row]').forEach((el) => {
                el.classList.toggle('nav-row-active', el.getAttribute('data-start-row') === id);
            });
            if (id === 'buttons') buttons[btnIdx].focus();
            else if (id === 'name' && input) input.focus();
            else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        };
        const stepOption = (group, d) => {
            if (group === 'galaxy') {
                const nav = this.overlay.querySelector(`[data-galaxy-step="${d}"]`);
                if (nav) nav.click();
                return;
            }
            const chips = Array.from(this.overlay.querySelectorAll(`[data-start-opt="${group}"]`));
            if (!chips.length) return;
            const cur = chips.findIndex((c) => c.classList.contains('selected'));
            chips[((cur < 0 ? 0 : cur) + d + chips.length) % chips.length].click();
        };
        syncFocus();
        if (input) input.select();

        this._keyHandler = (e) => {
            if (!this.isVisible) return;
            const key = e.key;
            const id = rowId();
            if (key === 'ArrowLeft' || key === 'ArrowRight') {
                const d = key === 'ArrowLeft' ? -1 : 1;
                if (id === 'faction') {
                    e.preventDefault();
                    pickIndex(this.getFactionIds().indexOf(this.pendingFaction) + d);
                } else if (id === 'buttons') {
                    e.preventDefault();
                    btnIdx = (btnIdx + d + buttons.length) % buttons.length;
                    syncFocus();
                } else if (id === 'galaxy' || id === 'kit') {
                    e.preventDefault();
                    stepOption(id, d);
                }
                return;
            }
            if ((key === 'n' || key === 'N') && rowId() === 'galaxy' && document.activeElement !== input) {
                e.preventDefault();
                this.generateStartGalaxy();
                return;
            }
            if (key === 'ArrowUp' || key === 'ArrowDown') {
                e.preventDefault();
                row = Math.max(0, Math.min(rows.length - 1, row + (key === 'ArrowDown' ? 1 : -1)));
                syncFocus();
                return;
            }
            // Space confirms like Enter, except while typing the pilot name.
            if (key === 'Enter' || (key === ' ' && document.activeElement !== input)) {
                e.preventDefault();
                if (id === 'buttons' && btnIdx === 1) cancel();
                else confirm();
            } else if (key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
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
            const clearedIds = (gp.clearedPlanetIds || []).map((x) => String(x).toLowerCase());
            const unlockedIds = (gp.unlockedPlanetIds || []).map((x) => String(x).toLowerCase());
            const cleared = clearedIds.length;
            // Current planet = where THIS pilot stands in the galaxy: the planet being
            // played (stages started, not cleared), else the newest unlocked one not yet
            // cleared (the pilot's own start planet at first), else the last cleared one.
            // Falls back to the galaxy's shared start planet if the pilot never entered it.
            let currentPlanetId = null;
            const open = unlockedIds.filter((id) => clearedIds.indexOf(id) === -1);
            const stages = gp.stages || {};
            const started = (id) => {
                const st = stages[id] || stages[String(id).toUpperCase()] || {};
                return (Number(st.highestStage) || 0) > 0;
            };
            currentPlanetId = open.slice().reverse().find(started)
                || open[open.length - 1]
                || clearedIds[clearedIds.length - 1]
                || null;
            if (!currentPlanetId && typeof planetConfigManager !== 'undefined') {
                const map = planetConfigManager.getGalaxyMap && planetConfigManager.getGalaxyMap(gid);
                const g = planetConfigManager.getGalaxy && planetConfigManager.getGalaxy(gid);
                currentPlanetId = (map && (map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId)))
                    || (g && g.planetIds && g.planetIds[0]) || null;
                if (currentPlanetId) currentPlanetId = String(currentPlanetId).toLowerCase();
            }
            // Visited = this pilot has been there. Unvisited galaxies have no active planet.
            const visited = (typeof profileManager !== 'undefined' && profileManager.hasDiscoveredGalaxy
                ? profileManager.hasDiscoveredGalaxy(gid, profile) : false) || unlockedIds.length > 0 || cleared > 0;
            if (!visited) currentPlanetId = null;
            // One slot per planet of the map, in map order: cleared / open / locked.
            let slots = [];
            const gmap = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyMap ? planetConfigManager.getGalaxyMap(gid) : null;
            if (visited && gmap && gmap.nodes && gmap.nodes.length) {
                const accentOf = (fid) => {
                    const st = fid && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(fid) : null;
                    return (st && st.accent) || '';
                };
                const ctl0 = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyControl ? planetConfigManager.getGalaxyControl(gid) : null;
                slots = gmap.nodes.map((n) => {
                    const pid = String(n.planetId).toLowerCase();
                    const isStart = String(gmap.startPlanetId || '').toLowerCase() === pid;
                    const state = clearedIds.indexOf(pid) !== -1 ? 'cleared' : ((unlockedIds.indexOf(pid) !== -1 || isStart) ? 'open' : 'locked');
                    // The faction that rules this very planet (conquests included), else its native one, else the galaxy's ruler.
                    let owner = null;
                    try {
                        owner = (typeof factionManager !== 'undefined' && factionManager.getPlanetOwner ? factionManager.getPlanetOwner(pid) : null)
                            || ((planetConfigManager.getPlanetFactions ? planetConfigManager.getPlanetFactions(pid) : [])[0])
                            || (ctl0 && ctl0.main) || null;
                    } catch (e) { /* ignore */ }
                    return { state: state, faction: owner, color: accentOf(owner) };
                });
            }
            // Ruling faction's colour for the slots.
            let color = '';
            try {
                const ctl = typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyControl ? planetConfigManager.getGalaxyControl(gid) : null;
                const st = ctl && ctl.main && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(ctl.main) : null;
                color = (st && st.accent) || '';
            } catch (e) { /* ignore */ }
            return {
                id: gid,
                name: this.galaxyName(gid),
                cleared,
                total,
                currentPlanetId,
                visited,
                slots,
                color,
                label: `${cleared}/${total || '?'}`
            };
        });
    }
}

// Pixel glyphs before the profile dialog button labels (currentColor, 12×12).
ProfileSelectionManager.btnIconHtml = function (kind) {
    const paths = {
        next: 'M1 4h6V2h1v1h1v1h1v1h1v1h-1v1H9v1H8v1H7V7H1z',
        back: 'M11 4H5V2H4v1H3v1H2v1H1v1h1v1h1v1h1v1h1V7h6z',
        cancel: 'M1 1h2v1h1v1h1v1h2V3h1V2h1V1h2v2h-1v1h-1v1H8v2h1v1h1v1h1v2H9v-1H8v-1H7v-1H5v1H4v1H3v1H1V9h1V8h1V7h1V5H3V4H2V3H1z',
        save: 'M1 6h2v1h1v1h1V7h1V6h1V5h1V4h1V3h1V2h2v2h-1v1H9v1H8v1H7v1H6v1H5v1H3V9H2V8H1z',
        create: 'M5 1h2v4h4v2H7v4H5V7H1V5h4z',
        upload: 'M5 1h2v1h1v1h1v1h1v1H8v5H4V6H2V5h1V4h1V3h1z',
        download: 'M5 11h2v-1h1v-1h1v-1h1v-1H8V1H4v4H2v1h1v1h1v1h1z',
        rename: 'M8 1h2v1h1v2h-1v1H9v1H8v1H7v1H6v1H5v1H4v1H1V8h1V7h1V6h1V5h1V4h1V3h1V2h1z',
        delete: 'M4 1h4v1h3v2H1V2h3zM2 5h8v6H2zM4 6v4h1V6zm3 0v4h1V6z'
    };
    return `<svg class="ps-btn-icon" viewBox="0 0 12 12" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${paths[kind] || paths.next}"/></svg>`;
};
