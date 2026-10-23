"use strict";

// ProfileSelectionManager members, continued from core.js (kept under ~500 lines per file).
extendClass(ProfileSelectionManager, {
    /** Inline dialog sits inside the terminal screen's padding: let the top/bottom bars bleed out to the screen edges. */
    fitWizardBars() {
        const ov = this.overlay;
        if (!ov || !ov.isConnected) return;
        const screen = this.host && this.host.closest('.start-screen-content, .start-screen');
        let l = 0;
        let r = 0;
        let t = 0;
        let b = 0;
        if (screen) {
            const o = ov.getBoundingClientRect();
            const s = screen.getBoundingClientRect();
            const k = ov.offsetWidth ? o.width / ov.offsetWidth : 1;   // stage scale
            l = Math.max(0, (o.left - s.left) / k);
            r = Math.max(0, (s.right - o.right) / k);
            t = Math.max(0, (o.top - s.top) / k);
            b = Math.max(0, (s.bottom - o.bottom) / k);
        }
        ov.style.setProperty('--ps-bleed-l', l + 'px');
        ov.style.setProperty('--ps-bleed-r', r + 'px');
        ov.style.setProperty('--ps-bleed-t', t + 'px');
        ov.style.setProperty('--ps-bleed-b', b + 'px');
        if (!this._bleedResize) {
            this._bleedResize = () => this.fitWizardBars();
            window.addEventListener('resize', this._bleedResize);
        }
    },
    renderNameMode(setHtml, reuse, profiles) {
        const create = this.mode === 'create';
        const step = create ? (this.createStep || 'faction') : 'name';
        const pickFaction = create && step === 'faction';
        const pilotStep = create && step === 'pilot';
        const galaxyStep = create && step === 'galaxy';
        const missionStep = create && step === 'mission';                    // last step: pick a story path offered by the start profile
        const startStep = create && !pickFaction && !pilotStep && !galaxyStep && !missionStep;
        const title = !create ? 'RENAME PROFILE' : (pickFaction ? 'CHOOSE FACTION' : (pilotStep ? 'CREATE YOUR PILOT' : (galaxyStep ? 'CHOOSE YOUR GALAXY' : (missionStep ? 'CHOOSE YOUR STORY' : 'START SETUP'))));
        // Wizard progress: faction -> pilot -> setup -> galaxy -> story (same order the NEXT/BACK buttons walk).
        const stepIdx = pickFaction ? 0 : (pilotStep ? 1 : (galaxyStep ? 3 : (missionStep ? 4 : 2)));
        const stepperHtml = create ? `<ol class="profile-stepper" aria-label="Step ${stepIdx + 1} of 5">${[['faction', 'FACTION'], ['pilot', 'PILOT'], ['name', 'SETUP'], ['galaxy', 'GALAXY'], ['mission', 'STORY']].map(([key, label], i) => `
            <li class="profile-stepper-step${i < stepIdx ? ' is-done' : ''}${i === stepIdx ? ' is-current' : ''}"${i === stepIdx ? ' aria-current="step"' : ''}>
                ${i < stepIdx ? `<button type="button" class="profile-stepper-btn" data-step-go="${key}" tabindex="-1" title="Back to ${label}">` : '<span class="profile-stepper-btn">'}
                <span class="profile-stepper-dot">${ProfileSelectionManager.stepIconHtml(key)}</span><span class="profile-stepper-label">${label}</span>
                ${i < stepIdx ? '</button>' : '</span>'}
            </li>`).join('')}</ol>` : '';
        // The faction bar belongs to the faction step; later steps only keep it for dev mode (quick faction switching).
        const showSwatches = create && (pickFaction || (typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode));
        const swatchesHtml = showSwatches ? `
            <div class="profile-faction-picker${pickFaction ? '' : ' is-compact'}">
                ${pickFaction ? '<div class="profile-faction-picker-label">← FACTION →</div>' : ''}
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
        const previewHtml = create && !galaxyStep ? `
            <div class="profile-faction-info-row">
            <div class="profile-faction-preview">
                <canvas class="profile-faction-ship" width="${startStep ? 320 : 200}" height="${startStep ? 224 : 140}" aria-label="Faction ship preview"></canvas>
                ${startStep ? '<div class="profile-kit-ship"></div>' : ''}
                ${startStep ? '' : `<div class="profile-faction-preview-text pfc" data-pfc>
                    <span class="profile-faction-preview-head pfc-head">
                        <span class="profile-faction-preview-emblem pfc-crest"></span>
                        <strong class="profile-faction-preview-name pfc-name"></strong>
                    </span>
                    ${pilotStep ? '' : '<small class="profile-faction-preview-trait pfc-traits"></small><small class="profile-faction-preview-hero pfc-hero"></small>'}
                    ${create && !pickFaction && !pilotStep ? this.renderPreferredWeaponHtml() : ''}
                </div>`}
                ${startStep ? `<div class="profile-loadout">${this.renderLoadoutHtml()}</div><div class="profile-kit-info">${this.renderKitInfoHtml()}</div>` : ''}
            </div>
            <div class="profile-faction-lore profile-faction-tabcard" role="note">
                <div class="profile-faction-tabs" role="tablist">
                    <button type="button" class="profile-faction-tab active" data-tab="lore" tabindex="-1">ⓘ LORE</button>
                    <button type="button" class="profile-faction-tab" data-tab="home" tabindex="-1">GALAXY</button>
                    <button type="button" class="profile-faction-tab" data-tab="style" tabindex="-1">STYLE</button>
                    <button type="button" class="profile-faction-tab" data-tab="weapon" tabindex="-1">WEAPON</button>
                    <button type="button" class="profile-faction-tab" data-tab="allies" tabindex="-1">ALLIES</button>
                </div>
                <div class="profile-faction-tabpanel active" data-panel="lore">
                    <div class="profile-faction-lore-text"></div>
                </div>
                ${[['home', 'HOME GALAXY', false], ['style', 'STYLE', false], ['weapon', 'PREFERRED WEAPON', true], ['allies', 'ALLIES', true]].map(([k, label, note]) => `
                <div class="profile-faction-tabpanel" data-panel="${k}">
                    <div class="profile-faction-fact" data-fact="${k}">
                        <span class="profile-faction-fact-icon"></span>
                        <div class="profile-faction-fact-body">
                            <div class="profile-faction-fact-label">${label}</div>
                            <div class="profile-faction-fact-value"></div>
                            ${note ? '<div class="profile-faction-fact-note"></div>' : ''}
                        </div>
                    </div>
                </div>`).join('')}
            </div>
            </div>` : '';
        const inputHtml = (pickFaction || startStep || galaxyStep || missionStep) ? ''
            : '<div class="profile-name-row">' + (pilotStep ? '<span class="profile-name-crest"></span>' : '') + '<input type="text" class="profile-name-input" id="profileNameInput" maxlength="16" placeholder="NAME" autocomplete="off" spellcheck="false"/>'
                + '<div class="profile-selection-actions profile-name-gen-wrap"><button type="button" class="action-button profile-name-gen" id="psGenName" title="Generate a name">GENERATE NAME</button></div></div>';
        const btnIcon = (kind) => ProfileSelectionManager.btnIconHtml(kind);
        const primary = (pickFaction || pilotStep || startStep || galaxyStep) ? 'NEXT' : (missionStep ? 'START' : 'SAVE');
        const secondary = create && !pickFaction ? 'BACK' : 'CANCEL';
        const hint = pickFaction ? '← → Faction | ENTER Confirm | ESC Cancel'
            : pilotStep ? '↑ ↓ Row | ← → Change | R Randomize | ENTER Next | ESC Back'
            : startStep ? '↑ ↓ Row | ← → Change | ENTER Next | ESC Back'
            : galaxyStep ? '← → Galaxy | N New galaxy | ENTER Next | ESC Back'
            : missionStep ? '↑ ↓ ← → Story | ENTER Start | ESC Back'
            : (create ? '↑ ↓ Row | ← → Change | ENTER Save | ESC Back' : 'ENTER Save | ESC Cancel');
        const missionHtml = missionStep ? this.renderMissionStepHtml() : '';
        setHtml(`
            ${stepperHtml}
            <div class="profile-selection-content profile-selection-floating profile-selection-name-mode${create && !pickFaction ? ' is-name-step' : ''}${pilotStep ? ' is-pilot-step' : ''}">
                ${pickFaction || startStep || missionStep ? '' : `<h2 class="profile-selection-title">${title}</h2>`}
                ${pickFaction || missionStep ? '' : swatchesHtml + inputHtml}
                ${create && !pickFaction && !missionStep ? this.renderStartOptionsHtml(pilotStep ? true : (startStep ? 'none' : false)) : ''}
                ${pickFaction ? swatchesHtml : ''}
                ${startStep ? `<div class="profile-start-main">${this.renderKitListHtml()}${previewHtml}</div>` : (missionStep ? missionHtml : previewHtml)}
            </div>
            <div class="profile-selection-bar"><div class="profile-selection-actions">
                <button class="action-button secondary" id="psCancelMode">${btnIcon(secondary === 'BACK' ? 'back' : 'cancel')}${secondary}</button>
                <button class="action-button" id="psSave">${btnIcon((pickFaction || pilotStep || startStep || galaxyStep) ? 'next' : 'save')}${primary}</button>
            </div>
            <div class="profile-selection-instructions"><p>${hint}</p></div></div>
        `);
        if (!reuse) (this.host || document.body).appendChild(this.overlay);
        this.fitWizardBars();
        requestAnimationFrame(() => this.fitWizardBars());
        if (pilotStep) this.ensurePilotPicksFit();
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        const input = this.overlay.querySelector('#profileNameInput');
        if (input && this.mode === 'rename' && profiles[this.selectedIndex]) {
            input.value = profiles[this.selectedIndex].name;
        }
        if (input && create && this._pilotName) input.value = this._pilotName;
        if (create) { this.applyPendingFactionLook(); this.warmFactionAssets(); }
        // Animated hero planet behind the faction card (faction-pick step only, for now).
        const heroPreviewEl = pickFaction ? this.overlay.querySelector('.profile-faction-preview') : null;
        if (heroPreviewEl && typeof HeroPlanetBackdrop !== 'undefined') {
            if (!this._heroPlanetBackdrop) this._heroPlanetBackdrop = new HeroPlanetBackdrop();
            this._heroPlanetBackdrop.setFaction(this.pendingFaction);
            this._heroPlanetBackdrop.mount(heroPreviewEl);
            heroPreviewEl.classList.add('has-hero-planet');
        } else if (this._heroPlanetBackdrop) {
            this._heroPlanetBackdrop.unmount();
        }
        if (input && create) {
            this._pilotName = input.value;
            input.addEventListener('input', () => { this._pilotName = input.value; this.savePilotState(); });
        }
        const genBtn = this.overlay.querySelector('#psGenName');
        if (genBtn && input) {
            genBtn.addEventListener('click', () => {
                input.value = this.generatePilotName(this.pendingFaction);
                this._pilotName = input.value;
                input.focus();
                input.select();
            });
        }
        const saveBtn = this.overlay.querySelector('#psSave');
        const cancelBtn = this.overlay.querySelector('#psCancelMode');
        // Start galaxy card: arrows cycle through the galaxies in place.
        const galaxyBox = this.overlay.querySelector('#psStartGalaxy');
        if (galaxyBox) {
            // Listener on the whole row: the prev/next arrows sit under the card, outside #psStartGalaxy.
            (galaxyBox.closest('[data-start-row="galaxy"]') || galaxyBox).addEventListener('click', (e) => {
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
                    const ids = this.getStartGalaxyIds(this.pendingFaction, this._startOpts.galaxy);
                    const i = ids.indexOf(this._startOpts.galaxy);
                    const step = Number(nav.getAttribute('data-galaxy-step')) || 1;
                    this._startOpts.galaxy = ids[(((i < 0 ? 0 : i) + step) % ids.length + ids.length) % ids.length];
                }
                this._startOpts.missionPlanetId = null;   // a different galaxy invalidates a previously chosen mission
                const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
                galaxyBox.innerHTML = this.renderStartGalaxyCardHtml(this._startOpts.galaxy, (meta && meta.homeGalaxy) || 'milky_way', GALAXY_MAP_H);
                const on = galaxyBox.querySelector('.profile-start-galaxy-side .selected');
                if (on) on.scrollIntoView({ block: 'nearest' });
            });
        }
        if (missionStep) this.bindMissionEvents();
        // Pilot portrait pickers.
        this.overlay.querySelectorAll('.pp-ctl').forEach((el) => {
            const k = el.getAttribute('data-pp-key');
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-pp-slider]')) return;
                this._startOpts.lookKey = k; this.refreshPilotRow();
            });
            const sl = el.querySelector('.pp-slider');
            if (sl) sl.addEventListener('change', () => { clearTimeout(this._ppTimer); this._ppTimer = 0; this.refreshPilotRow(); });
            if (sl) sl.addEventListener('input', () => {
                const o = this._startOpts;
                o.lookKey = k;
                o.look = Object.assign({}, o.look, { [k]: Number(sl.value) });
                this.savePilotState();
                const val = el.querySelector('.pp-val');
                if (val) val.textContent = heroPortrait.valueName(k, o.look[k], o.look);
                if (this._ppTimer) return;
                // Portrait redraw is heavy: coalesce to ~10/s while dragging.
                this._ppTimer = setTimeout(() => { this._ppTimer = 0; this.refreshPilotRow(); }, 90);
            });
        });
        this.overlay.querySelectorAll('[data-pp-pick]').forEach((b) => b.addEventListener('click', () => {
            const o = this._startOpts;
            o.lookKey = 'v';
            o.look = Object.assign({}, o.look, { v: Number(b.getAttribute('data-pp-pick')) });
            this.refreshPilotRow();
        }));
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
                if (group === 'kit') {                                                  // a start profile suggests its own hull; the SHIP row can override it afterwards
                    this._startOpts.ship = this.kitShipId(this._startOpts.kit);
                    this._startOpts.storyPathId = null;                                  // stories belong to the kit
                    this.overlay.querySelectorAll('[data-start-opt="ship"]').forEach((b) => {
                        const on = b.getAttribute('data-value') === this._startOpts.ship;
                        b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
                    });
                }
                const loadout = group === 'kit' && this.overlay.querySelector('.profile-loadout');
                if (loadout) loadout.innerHTML = this.renderLoadoutHtml();
                const kitInfo = group === 'kit' && this.overlay.querySelector('.profile-kit-info');
                if (kitInfo) kitInfo.innerHTML = this.renderKitInfoHtml();
                if (group === 'kit' || group === 'ship') { this.savePilotState && this.savePilotState(); this.renderFactionShipPreview(this.pendingFaction); }
            });
        });

        const loadoutEl = this.overlay.querySelector('.profile-loadout');
        // Hovering the ship preview outlines its weapon mounts.
        this.overlay.addEventListener('mouseover', (e) => { if (e.target.closest && e.target.closest('.profile-faction-ship')) this.highlightPreviewWeapon(true); });
        // WEAPONS slots in the sidebar: hovering one lights up its mount on the ship.
        this.overlay.addEventListener('mouseover', (e) => { const w = e.target.closest && e.target.closest('.pk-weapon[data-slot]'); if (w) this.highlightPreviewWeapon(true, Number(w.dataset.slot)); });
        this.overlay.addEventListener('mouseout', (e) => { const w = e.target.closest && e.target.closest('.pk-weapon[data-slot]'); if (w && !(e.relatedTarget && w.contains(e.relatedTarget))) this.highlightPreviewWeapon(false); });
        this.overlay.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.profile-faction-ship') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.profile-faction-ship'))) this.highlightPreviewWeapon(false); });
        if (loadoutEl) loadoutEl.addEventListener('click', (e) => {
            const b = e.target.closest('[data-area]');
            if (!b || b.disabled) return;
            const areas = this._startOpts.areas;
            const id = b.getAttribute('data-area');
            const used = Object.keys(areas).reduce((n, k) => n + areas[k], 0);
            const d = Number(b.getAttribute('data-d'));
            if (d > 0 && used >= this.startAreaBudget()) return;
            const kitBase = Number(((this.currentKit().bonus || {}).areas || {})[id]) || 0;
            areas[id] = Math.max(0, Math.min(2 - kitBase, (areas[id] || 0) + d));
            loadoutEl.innerHTML = this.renderLoadoutHtml();
        });

        const pickIndex = (i) => {
            const ids = this.getFactionIds();
            const n = ids.length;
            this.pendingFaction = ids[((i % n) + n) % n];
            this.overlay.querySelectorAll('.profile-faction-swatch').forEach((el) => {
                el.classList.toggle('selected', el.dataset.faction === this.pendingFaction);
            });
            // Start step: the kit list belongs to the faction, so rebuild the whole step once (no half-updated frames).
            if (startStep) { this.createUI(); return; }
            this.applyPendingFactionLook();
            if (this._heroPlanetBackdrop) this._heroPlanetBackdrop.setFaction(this.pendingFaction);
        };
        const confirm = () => {
            if (pickFaction || pilotStep || startStep || galaxyStep) {
                this.createStep = pickFaction ? 'pilot' : (pilotStep ? 'name' : (startStep ? 'galaxy' : 'mission'));
                this.createUI();
            } else {
                this.saveName();
            }
        };
        const cancel = () => {
            if (create && !pickFaction) {
                this.createStep = missionStep ? 'galaxy' : (galaxyStep ? 'name' : (pilotStep ? 'faction' : 'pilot'));
            } else if (create && (this._createOnly || !this.getProfiles().length)) {
                // Nothing to go back to: leave (back to the start menu).
                this.close();
                return;
            } else {
                this.mode = 'list';
            }
            this.createUI();
        };
        this.overlay.querySelectorAll('.profile-faction-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                this.overlay.querySelectorAll('.profile-faction-tab').forEach((t) => t.classList.toggle('active', t === tab));
                this.overlay.querySelectorAll('.profile-faction-tabpanel').forEach((p) =>
                    p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
                this.fitFactionText();
            });
        });
        this.overlay.querySelectorAll('.profile-faction-swatch').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (create && !pickFaction) {
                    // Changing the faction inside the wizard: same step, new faction look.
                    if (btn.dataset.faction === this.pendingFaction) return;
                    const keepName = input ? input.value : this._pilotName;
                    this.pendingFaction = btn.dataset.faction;
                    this._pilotName = keepName;
                    this.createUI();
                    return;
                }
                pickIndex(this.getFactionIds().indexOf(btn.dataset.faction));
            });
            btn.addEventListener('dblclick', confirm);
        });
        this.overlay.querySelectorAll('[data-step-go]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.createStep = btn.getAttribute('data-step-go');
                this.createUI();
            });
        });
        saveBtn.addEventListener('click', confirm);
        cancelBtn.addEventListener('click', cancel);

        // Focus rows. Faction step: [swatches, buttons]. Name step (create):
        // [name, galaxy, kit, buttons]. Rename: [name, buttons].
        // ←/→: swatches cycle factions, option rows change their value,
        // buttons move between buttons, the name input moves the caret.
        const rows = pickFaction ? ['faction', 'buttons']
            : (pilotStep ? ['name'].concat(this._startOpts && this._startOpts.look ? ['pilot'] : [], ['buttons'])
                : (startStep ? ['kit', 'buttons'] : (galaxyStep ? ['galaxy', 'buttons'] : (missionStep ? ['mission', 'buttons'] : ['name', 'buttons']))));
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
            if (group === 'mission') {
                const cards = Array.from(this.overlay.querySelectorAll('.profile-story-card'));
                if (!cards.length) return;
                const cur = cards.findIndex((c) => c.classList.contains('selected'));
                cards[((cur < 0 ? 0 : cur) + d + cards.length) % cards.length].click();
                return;
            }
            const chips = Array.from(this.overlay.querySelectorAll(`[data-start-opt="${group}"]`));
            if (!chips.length) return;
            const cur = chips.findIndex((c) => c.classList.contains('selected'));
            chips[((cur < 0 ? 0 : cur) + d + chips.length) % chips.length].click();
        };
        syncFocus();

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
                } else if (id === 'galaxy' || id === 'kit' || id === 'mission') {
                    e.preventDefault();
                    stepOption(id, d);
                } else if (id === 'pilot') {
                    e.preventDefault();
                    this.stepPilotLook(this._startOpts.lookKey, d);
                }
                return;
            }
            if ((key === 'n' || key === 'N' || key === 'r' || key === 'R') && id === 'pilot' && document.activeElement !== input) {
                e.preventDefault();
                this.randomizePilotLook();
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
    },
    shipName(id) {
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getDisplayName) {
            return shipConfigManager.getDisplayName(id);
        }
        return String(id || '').replace(/^player_/, '').replace(/_/g, ' ').toUpperCase();
    },
    galaxyName(gid) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy) {
            const g = planetConfigManager.getGalaxy(gid);
            if (g && g.name) return String(g.name).toUpperCase();
        }
        return String(gid || 'UNKNOWN').replace(/_/g, ' ').toUpperCase();
    },
    resourceLabel(id) {
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel) {
            return economyConfig.getResourceLabel(id);
        }
        return String(id || '').toUpperCase();
    },
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
    },
});

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
        delete: 'M4 1h4v1h3v2H1V2h3zM2 5h8v6H2zM4 6v4h1V6zm3 0v4h1V6z',
        dice: 'M1 1h10v10H1zM2 2v8h8V2zM3 3h2v2H3zM7 3h2v2H7zM5 5h2v2H5zM3 7h2v2H3zM7 7h2v2H7z'
    };
    return `<svg class="ps-btn-icon" viewBox="0 0 12 12" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${paths[kind] || paths.next}"/></svg>`;
};

// Wizard step glyphs (12×12, currentColor): shield, pilot, gear, planet, beacon.
ProfileSelectionManager.stepIconHtml = function (key) {
    const paths = {
        faction: 'M2 1h8v6H9v1H8v1H7v1H5V9H4V8H3V7H2zM5 3v3h2V3z',
        pilot: 'M4 1h4v1h1v3H8v1H4V5H3V2h1zM2 8h8v1h1v2H1V9h1z',
        name: 'M5 1h2v2h2v1h2v4h-2v1H7v2H5v-2H3V9H1V4h2V3h2zM5 5v2h2V5z',
        galaxy: 'M4 1h4v1h2v1h1v2h1v2h-1v2h-1v1H8v1H4v-1H2v-1H1V8H0V5h1V3h1V2h2zM4 4v4h4V4z',
        mission: 'M5 0h2v2h3v2h2v2h-2V4H8v2H6V4H4v2H2V6H0V4h2V2h3zM5 6h2v2h2v2H8v2H6v-2H4V8h2z'
    };
    return `<svg class="profile-stepper-icon" viewBox="0 0 12 12" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${paths[key]}"/></svg>`;
};
