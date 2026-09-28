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
    getFactionEmblemHtml(id, size = 16) {
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
        this.mode = 'list';
        this.selectedIndex = 0;
        const profiles = this.getProfiles();
        if (typeof profileManager !== 'undefined' && profileManager.activeProfileId) {
            const idx = profiles.findIndex(p => p.id === profileManager.activeProfileId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        // No pilots yet: skip the empty list and open profile creation.
        if (!profiles.length) {
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
            this.renderNameMode(setHtml, reuse, profiles);
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
                                <span class="profile-list-emblem">${this.getFactionEmblemHtml(p.faction || 'pirate', 28)}</span>
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
                    ${profiles.length ? '<button class="action-button" id="psSelect">SELECT</button>' : ''}
                    <button class="action-button" id="psCreate">CREATE</button>
                    ${profiles.length ? `<button class="action-button secondary" id="psRename">RENAME</button>
                    <button class="action-button secondary" id="psDelete">DELETE</button>` : ''}
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

    /**
     * Create flow is two steps: 1) pick a faction (← → cycle, ENTER confirm),
     * 2) name the pilot (defaults to the faction hero). Rename skips step 1.
     */
    /**
     * Start options for a new pilot: start galaxy (defaults to the faction's
     * home galaxy), difficulty and a starter kit. Applied in saveName().
     */
    renderStartOptionsHtml() {
        const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
            ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
        const home = (meta && meta.homeGalaxy) || 'milky_way';
        const galaxies = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyIds)
            ? planetConfigManager.getGalaxyIds() : ['milky_way'];
        const diffs = (typeof difficultyConfigManager !== 'undefined' && difficultyConfigManager.profiles)
            ? Object.keys(difficultyConfigManager.profiles) : ['easy', 'normal', 'hard'];
        if (!this._startOpts || this._startOpts.faction !== this.pendingFaction) {
            this._startOpts = {
                faction: this.pendingFaction,
                galaxy: home,
                difficulty: (typeof difficultyConfigManager !== 'undefined' && difficultyConfigManager.current) || 'normal',
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
        const chip = (group, value, label, tip) =>
            `<button type="button" class="profile-start-chip${o[group] === value ? ' selected' : ''}" data-start-opt="${group}"` +
            ` data-value="${value}" aria-pressed="${o[group] === value}" tabindex="-1"${tip ? ` title="${tip}"` : ''}>${label}</button>`;
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
                <div class="profile-start-row" data-start-row="difficulty">
                    <span class="profile-start-label">DIFFICULTY</span>
                    <div class="profile-start-chips">${diffs.map((d) => chip('difficulty', d, d.toUpperCase())).join('')}</div>
                </div>
                <div class="profile-start-row" data-start-row="kit">
                    <span class="profile-start-label">STARTER KIT</span>
                    <div class="profile-start-chips">${kits.map(([v, l, t]) => chip('kit', v, l, t)).join('')}</div>
                </div>
            </div>`;
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
            return a && b ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>` : '';
        }).join('');
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
        const dots = nodes.map((n) => {
            const q = pos[n.planetId];
            const start = n.planetId === map.startPlanetId;
            const r = start ? 6 : 4;
            return `<rect x="${q.x - r}" y="${q.y - r}" width="${r * 2}" height="${r * 2}"${start ? ' class="is-start"' : ''}/>`;
        }).join('');
        const control = pcm && pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
        const ruler = control && control.main;
        const emblem = ruler && this.getFactionEmblemHtml ? this.getFactionEmblemHtml(ruler, 20) : '';
        const state = control ? (control.control === 'contested' ? 'CONTESTED' : 'HELD') : '';
        return `
            <button type="button" class="profile-start-galaxy-nav" data-galaxy-step="-1" tabindex="-1" aria-label="Previous galaxy">‹</button>
            <svg class="profile-start-galaxy-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="--galaxy-color:${color}" shape-rendering="crispEdges" aria-hidden="true">
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
                <strong class="profile-start-galaxy-name">${name}${gid === home ? ' <span class="profile-start-galaxy-home" title="Faction home galaxy">★ HOME</span>' : ''}</strong>
                ${ruler ? `<span class="profile-start-galaxy-ruler">${emblem}<span>${String(ruler).toUpperCase()} · ${state}</span></span>` : ''}
                <span class="profile-start-galaxy-meta">${nodes.length
                    ? nodes.length + ' PLANETS · START ' + String(map.startPlanetId || '—').toUpperCase()
                    : 'UNCHARTED · ARRIVAL SECTOR CHARTED ON START'}</span>
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
        const primary = pickFaction ? 'NEXT' : 'SAVE';
        const secondary = create && !pickFaction ? 'BACK' : 'CANCEL';
        const hint = pickFaction ? '← → Faction | ENTER Confirm | ESC Cancel'
            : (create ? '↑ ↓ Row | ← → Change | ENTER Save | ESC Back' : 'ENTER Save | ESC Cancel');
        setHtml(`
            <div class="profile-selection-content profile-selection-floating profile-selection-name-mode${create && !pickFaction ? ' is-name-step' : ''}">
                ${create ? `<div class="profile-modal-crest" style="--faction-color:${this.getFactionColor(this.pendingFaction)}" title="${this.getFactionLabel(this.pendingFaction)}">${this.getFactionEmblemHtml(this.pendingFaction, 56)}</div>` : ''}
                <h2 class="profile-selection-title">${title}</h2>
                ${pickFaction ? '' : inputHtml}
                ${create && !pickFaction ? this.renderStartOptionsHtml() : ''}
                ${swatchesHtml}
                ${previewHtml}
                <div class="profile-selection-actions">
                    <button class="action-button" id="psSave">${primary}</button>
                    <button class="action-button secondary" id="psCancelMode">${secondary}</button>
                </div>
                <div class="profile-selection-instructions"><p>${hint}</p></div>
            </div>
        `);
        if (!reuse) document.body.appendChild(this.overlay);
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
                const nav = e.target.closest('[data-galaxy-step]');
                if (!nav) return;
                const ids = planetConfigManager.getGalaxyIds();
                const i = ids.indexOf(this._startOpts.galaxy);
                const step = Number(nav.getAttribute('data-galaxy-step')) || 1;
                this._startOpts.galaxy = ids[(((i < 0 ? 0 : i) + step) % ids.length + ids.length) % ids.length];
                const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
                galaxyBox.innerHTML = this.renderStartGalaxyCardHtml(this._startOpts.galaxy, (meta && meta.homeGalaxy) || 'milky_way');
            });
        }
        // Start options (galaxy / difficulty / kit): toggle in place so the
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
            });
        });

        const pickIndex = (i) => {
            const ids = this.getFactionIds();
            const n = ids.length;
            this.pendingFaction = ids[((i % n) + n) % n];
            this.overlay.querySelectorAll('.profile-faction-swatch').forEach((el) => {
                el.classList.toggle('selected', el.dataset.faction === this.pendingFaction);
            });
            const crest = this.overlay.querySelector('.profile-modal-crest');
            if (crest) {
                crest.innerHTML = this.getFactionEmblemHtml(this.pendingFaction, 56);
                crest.style.setProperty('--faction-color', this.getFactionColor(this.pendingFaction));
                crest.title = this.getFactionLabel(this.pendingFaction);
            }
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
            } else if (create && !this.getProfiles().length) {
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
        // [name, galaxy, difficulty, kit, buttons]. Rename: [name, buttons].
        // ←/→: swatches cycle factions, option rows change their value,
        // buttons move between buttons, the name input moves the caret.
        const rows = pickFaction ? ['faction', 'buttons']
            : (create ? ['name', 'galaxy', 'difficulty', 'kit', 'buttons'] : ['name', 'buttons']);
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
                } else if (id === 'galaxy' || id === 'difficulty' || id === 'kit') {
                    e.preventDefault();
                    stepOption(id, d);
                }
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
