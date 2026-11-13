"use strict";

/**
 * First-run onboarding: Faction homeworld → Pilot → Callsign → Scrap Fighter.
 */
class OnboardingManager {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this._keyHandler = null;
        this.step = 'story'; // story | pilot | name | scrap
        this.onComplete = null;
        this._pendingName = '';
        this._pendingFaction = 'terran';
        this._pilotLook = null;
        this._pilotLookKey = 'skin';
        this._heroPlanet = null;
        this._ppTimer = 0;
    }

    show(options) {
        this.isVisible = true;
        this.onComplete = options && options.onComplete;
        this.step = 'story';
        this._pendingName = '';
        this._pilotLook = null;
        this._pilotLookKey = 'skin';
        this._pendingFaction = (typeof factionManager !== 'undefined' && factionManager.getFactionIds)
            ? factionManager.getFactionIds()[0]
            : 'terran';
        this.createUI();
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('onboarding');
        }
    }

    hide() {
        this.isVisible = false;
        clearTimeout(this._ppTimer);
        this._ppTimer = 0;
        this.stopHomePlanet();
        if (typeof profileSelectionManager !== 'undefined'
            && profileSelectionManager.overlay === this.overlay) {
            profileSelectionManager.overlay = null;
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    finish() {
        const cb = this.onComplete;
        this.hide();
        if (typeof cb === 'function') cb();
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
        return '#888888';
    }

    getFactionMeta(id) {
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta) {
            return planetConfigManager.getFactionMeta(id);
        }
        return null;
    }

    getFactionEmblemHtml(id, size = 48) {
        if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml) {
            return profileSelectionManager.getFactionEmblemHtml(id, size);
        }
        if (typeof iconRenderer === 'undefined' || typeof factionShipStyles === 'undefined') return '';
        const base = factionShipStyles.emblemCamelKey ? factionShipStyles.emblemCamelKey(id) : null;
        if (!base) return '';
        let key = base;
        if (typeof IconSprites !== 'undefined' && IconSprites[base + 'Hi'] && size >= 24) {
            key = base + (size >= 96 ? '@4x' : '@2x');
        } else if (typeof iconRenderer.detailKey === 'function') {
            key = iconRenderer.detailKey(base, size);
        }
        const style = factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(id) : null;
        return iconRenderer.imgHtml(key, size, 'profile-faction-emblem-img', style && style.accent, this.getFactionLabel(id));
    }

    factionSwatchesHtml() {
        return `
            <div class="profile-faction-picker onboarding-faction-picker">
                <div class="profile-faction-picker-label">CHOOSE YOUR FACTION</div>
                <div class="profile-faction-swatches">
                    ${this.getFactionIds().map((id) => `
                        <button type="button" class="profile-faction-swatch${id === this._pendingFaction ? ' selected' : ''}"
                            data-faction="${id}" title="${this.getFactionLabel(id)}"
                            style="--faction-color: ${this.getFactionColor(id)}">
                            <span class="profile-faction-swatch-emblem">${this.getFactionEmblemHtml(id, 48)}</span>
                            <span class="profile-faction-swatch-label">${this.getFactionLabel(id)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>`;
    }

    factionPreviewHtml() {
        return `
            <div class="profile-faction-info-row onboarding-faction-preview">
                <div class="onboarding-faction-dossier onboarding-preview-card" role="note">
                    <div class="profile-faction-lore-text onboarding-dossier-lore"></div>
                    <div class="profile-faction-focus" data-faction-focus aria-label="Faction focus"></div>
                </div>
            </div>`;
    }

    stepIconHtml(key) {
        if (typeof ProfileSelectionManager !== 'undefined' && ProfileSelectionManager.stepIconHtml) {
            return ProfileSelectionManager.stepIconHtml(key);
        }
        const paths = {
            faction: 'M2 1h8v6H9v1H8v1H7v1H5V9H4V8H3V7H2zM5 3v3h2V3z',
            pilot: 'M4 1h4v1h1v3H8v1H4V5H3V2h1zM2 8h8v1h1v2H1V9h1z',
            name: 'M5 1h2v2h2v1h2v4h-2v1H7v2H5v-2H3V9H1V4h2V3h2zM5 5v2h2V5z'
        };
        return `<svg class="profile-stepper-icon" viewBox="0 0 12 12" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${paths[key] || paths.faction}"/></svg>`;
    }

    steps() {
        return [
            ['story', 'faction', 'FACTION'],
            ['pilot', 'pilot', 'PILOT'],
            ['name', 'name', 'CALLSIGN'],
            ['scrap', 'name', 'SHIP']
        ];
    }

    stepIndex(id) {
        const idx = this.steps().findIndex(([stepId]) => stepId === (id || this.step));
        return Math.max(0, idx);
    }

    stepperHtml() {
        const steps = this.steps();
        const idx = this.stepIndex();
        return `<ol class="profile-stepper onboarding-stepper" aria-label="Step ${idx + 1} of ${steps.length}">${steps.map(([id, icon, label], i) => `
            <li class="profile-stepper-step${i < idx ? ' is-done' : ''}${i === idx ? ' is-current' : ''}"${i === idx ? ' aria-current="step"' : ''}>
                ${i < idx
                    ? `<button type="button" class="profile-stepper-btn" data-step-go="${id}" title="Back to ${label}">`
                    : '<span class="profile-stepper-btn">'}
                    <span class="profile-stepper-dot">${this.stepIconHtml(icon)}</span>
                    <span class="profile-stepper-label">${label}</span>
                ${i < idx ? '</button>' : '</span>'}
            </li>`).join('')}</ol>`;
    }

    barHtml(primaryLabel, hint, showBack) {
        const back = showBack
            ? '<button class="action-button secondary" id="obBack">BACK</button>'
            : '';
        return `
            <div class="profile-selection-bar onboarding-bar">
                <div class="profile-selection-actions">
                    ${back}
                    <button class="action-button" id="obNext">${primaryLabel}</button>
                </div>
                <div class="profile-selection-instructions"><p>${hint}</p></div>
            </div>`;
    }

    ensurePilotLook() {
        if (typeof heroPortrait === 'undefined') return null;
        if (!this._pilotLook || this._pilotLook.faction !== this._pendingFaction) {
            this._pilotLook = heroPortrait.randomLook(this._pendingFaction);
            this._pilotLookKey = 'skin';
        }
        this._pilotLook = heroPortrait.normalize(this._pilotLook);
        const keys = heroPortrait.keysFor(this._pilotLook) || [];
        if (keys.indexOf(this._pilotLookKey) < 0) this._pilotLookKey = keys[0] || 'skin';
        return this._pilotLook;
    }

    pilotAccent() {
        return this.getFactionColor(this._pendingFaction);
    }

    pilotHtml() {
        const look = this.ensurePilotLook();
        if (!look || typeof heroPortrait === 'undefined') {
            return '<p class="onboarding-hint">PILOT LOOK UNAVAILABLE</p>';
        }
        const psm = typeof profileSelectionManager !== 'undefined' ? profileSelectionManager : null;
        if (psm && psm.renderPilotRowHtml) {
            psm.pendingFaction = this._pendingFaction;
            psm._startOpts = Object.assign({}, psm._startOpts || {}, {
                faction: this._pendingFaction,
                look: this._pilotLook,
                lookKey: this._pilotLookKey
            });
            return `<div class="profile-start-options onboarding-pilot-options">${psm.renderPilotRowHtml()}</div>`;
        }
        return `
            <div class="profile-start-options onboarding-pilot-options">
                <div class="profile-start-row" data-start-row="pilot">
                    <span class="profile-start-label">PILOT</span>
                    <div class="profile-pilot-card">
                        <div class="profile-pilot-side">
                            <div class="profile-pilot-portrait" id="psPortrait">${heroPortrait.html(look, this.pilotAccent())}</div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    createUI() {
        if (this.overlay) this.overlay.remove();
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.stopHomePlanet();

        this.overlay = document.createElement('div');
        this.overlay.className = 'profile-selection-overlay onboarding-overlay';

        let body = '';
        let bar = '';
        if (this.step === 'story') {
            body = `
                <div class="profile-selection-content onboarding-content onboarding-homeworld-site">
                    <div class="onboarding-homeworld-main onboarding-panel">
                        <h2 class="profile-selection-title">CHOOSE FACTION</h2>
                        ${this.factionSwatchesHtml()}
                        ${this.factionPreviewHtml()}
                    </div>
                    <aside class="onboarding-homeworld-stage onboarding-panel" aria-label="Faction homeworld">
                        <div class="onboarding-homeworld-label"></div>
                    </aside>
                </div>`;
            bar = this.barHtml('CONTINUE', '← → Faction | ENTER Continue', false);
        } else if (this.step === 'pilot') {
            body = `
                <div class="profile-selection-content onboarding-content onboarding-panel onboarding-pilot-panel profile-selection-name-mode is-name-step is-pilot-step">
                    <h2 class="profile-selection-title">CREATE YOUR PILOT</h2>
                    <p class="onboarding-hint">PICK A FACE · R RANDOMIZE</p>
                    ${this.pilotHtml()}
                </div>`;
            bar = this.barHtml('CONTINUE', '↑ ↓ Feature | ← → Change | R Randomize | ENTER Continue | ESC Back', true);
        } else if (this.step === 'name') {
            const psm = this.syncPilotToPsm();
            const crest = this.ensurePilotLook() && typeof heroPortrait !== 'undefined'
                ? `<span class="profile-name-crest onboarding-name-portrait" id="obNamePortrait">${heroPortrait.html(this._pilotLook, this.pilotAccent())}</span>`
                : `<span class="profile-name-crest">${this.getFactionEmblemHtml(this._pendingFaction, 48)}</span>`;
            const kitCol = (psm && psm.renderKitListHtml) ? psm.renderKitListHtml() : '';
            const loadout = (psm && psm.renderLoadoutHtml) ? psm.renderLoadoutHtml() : '';
            const kitInfo = (psm && psm.renderKitInfoHtml) ? psm.renderKitInfoHtml() : '';
            body = `
                <div class="profile-selection-content onboarding-content onboarding-panel onboarding-name-panel profile-selection-name-mode is-name-step">
                    <h2 class="profile-selection-title">PILOT CALLSIGN</h2>
                    <p class="onboarding-hint">ENTER YOUR NAME · PICK A START PROFILE</p>
                    <div class="profile-name-row onboarding-name-row">
                        ${crest}
                        <input type="text" class="profile-name-input" id="obNameInput" maxlength="16" placeholder="NAME" autocomplete="off" spellcheck="false"/>
                    </div>
                    <div class="profile-start-main onboarding-pilot-kit-main">
                        ${kitCol}
                        <div class="profile-faction-preview">
                            <div class="profile-faction-ship-wrap">
                                <canvas class="profile-faction-ship" width="320" height="224" aria-label="Starter hull preview"></canvas>
                            </div>
                            <div class="profile-kit-ship"></div>
                            <div class="profile-loadout">${loadout}</div>
                            <div class="profile-kit-info">${kitInfo}</div>
                        </div>
                    </div>
                </div>`;
            bar = this.barHtml('CONFIRM', '↑ ↓ Profile | ENTER Confirm | ESC Back', true);
        } else {
            body = `
                <div class="profile-selection-content onboarding-content onboarding-panel onboarding-ship-panel">
                    <h2 class="profile-selection-title">SHIP ASSEMBLY</h2>
                    <p class="onboarding-hint">YOUR STARTER HULL · OPEN THE HANGAR TO FIT MODULES</p>
                    <div class="onboarding-ship-wrap">
                        <canvas class="profile-faction-ship onboarding-ship-canvas" width="320" height="224" aria-label="Starter hull preview"></canvas>
                    </div>
                    <div class="profile-kit-ship"></div>
                    <p class="hs-status">READY FOR HANGAR</p>
                </div>`;
            bar = this.barHtml('OPEN HANGAR', 'ENTER Continue | ESC Back', true);
        }

        this.overlay.innerHTML = `${this.stepperHtml()}${body}${bar}`;

        document.body.appendChild(this.overlay);
        this.applyFactionSurface(this._pendingFaction);
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.bindStep();
    }

    applyFactionSurface(id) {
        if (document.documentElement.getAttribute('data-pf') !== id) {
            document.documentElement.setAttribute('data-pf', id);
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
            if (window.vfRepaintBackdrops) window.vfRepaintBackdrops();
        }
        const color = this.getFactionColor(id);
        if (this.overlay) {
            this.overlay.style.setProperty('--faction-color', color);
            this.overlay.style.setProperty('--faction-accent', color);
        }
        const box = this.overlay && this.overlay.querySelector('.onboarding-content');
        if (box) {
            box.style.setProperty('--faction-color', color);
            box.style.setProperty('--faction-accent', color);
            box.dataset.faction = id;
        }
    }

    bindFactionPicker() {
        this.overlay.querySelectorAll('.profile-faction-swatch').forEach((button) => {
            button.addEventListener('click', () => {
                this.setFaction(button.dataset.faction);
            });
        });
    }

    setFaction(id) {
        if (!id || id === this._pendingFaction) {
            this.refreshFactionPreview();
            return;
        }
        this._pendingFaction = id;
        this._pilotLook = null;
        this.overlay.querySelectorAll('.profile-faction-swatch').forEach((item) => {
            item.classList.toggle('selected', item.dataset.faction === id);
        });
        this.applyFactionSurface(id);
        this.refreshFactionPreview();
        this.startHomePlanet();
    }

    syncPilotToPsm() {
        const psm = typeof profileSelectionManager !== 'undefined' ? profileSelectionManager : null;
        if (!psm) return null;
        this.ensurePilotLook();
        // Treat as create-wizard so kit/inventory + ship preview use start-hull paths.
        psm.mode = 'create';
        psm.pendingFaction = this._pendingFaction;
        psm._startOpts = Object.assign({}, psm._startOpts || {}, {
            faction: this._pendingFaction,
            look: this._pilotLook,
            lookKey: this._pilotLookKey
        });
        if (!psm._startOpts.areas) psm._startOpts.areas = {};
        psm.overlay = this.overlay;
        return psm;
    }

    refreshPilotUi() {
        const psm = this.syncPilotToPsm();
        if (psm && psm.refreshPilotRow) {
            psm.refreshPilotRow();
            this._pilotLook = psm._startOpts && psm._startOpts.look
                ? Object.assign({}, psm._startOpts.look)
                : this._pilotLook;
            this._pilotLookKey = (psm._startOpts && psm._startOpts.lookKey) || this._pilotLookKey;
            return;
        }
        const box = this.overlay && this.overlay.querySelector('#psPortrait');
        if (box && this._pilotLook && typeof heroPortrait !== 'undefined') {
            box.innerHTML = heroPortrait.html(this._pilotLook, this.pilotAccent());
        }
    }

    bindPilotControls() {
        const psm = this.syncPilotToPsm();
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.pp-ctl').forEach((el) => {
            const k = el.getAttribute('data-pp-key');
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-pp-slider]')) return;
                this._pilotLookKey = k;
                if (psm && psm._startOpts) psm._startOpts.lookKey = k;
                this.refreshPilotUi();
            });
            const sl = el.querySelector('.pp-slider');
            if (!sl) return;
            sl.addEventListener('change', () => {
                clearTimeout(this._ppTimer);
                this._ppTimer = 0;
                this.refreshPilotUi();
            });
            sl.addEventListener('input', () => {
                this._pilotLookKey = k;
                this._pilotLook = Object.assign({}, this.ensurePilotLook(), { [k]: Number(sl.value) });
                if (psm && psm._startOpts) {
                    psm._startOpts.lookKey = k;
                    psm._startOpts.look = this._pilotLook;
                }
                const val = el.querySelector('.pp-val');
                if (val && typeof heroPortrait !== 'undefined') {
                    val.textContent = heroPortrait.valueName(k, this._pilotLook[k], this._pilotLook);
                }
                if (this._ppTimer) return;
                this._ppTimer = setTimeout(() => {
                    this._ppTimer = 0;
                    this.refreshPilotUi();
                }, 90);
            });
        });
        this.overlay.querySelectorAll('[data-pp-pick]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this._pilotLookKey = 'v';
                this._pilotLook = Object.assign({}, this.ensurePilotLook(), {
                    v: Number(btn.getAttribute('data-pp-pick'))
                });
                if (psm && psm._startOpts) {
                    psm._startOpts.lookKey = 'v';
                    psm._startOpts.look = this._pilotLook;
                }
                this.refreshPilotUi();
            });
        });
        if (psm && psm.ensurePilotPicksFit) psm.ensurePilotPicksFit();
    }

    goTo(step) {
        const allowed = this.steps().map(([id]) => id);
        if (allowed.indexOf(step) < 0) return;
        if (this.stepIndex(step) > this.stepIndex()) return;
        this.step = step;
        this.createUI();
    }

    goBack() {
        const idx = this.stepIndex();
        if (idx <= 0) return;
        this.step = this.steps()[idx - 1][0];
        this.createUI();
    }

    refreshFactionPreview() {
        if (!this.overlay || this.step !== 'story') return;
        const id = this._pendingFaction;
        const meta = this.getFactionMeta(id);
        const lead = (meta && meta.lore) || '';
        // Lore lives under the faction title on the right stage — not in the left dossier.
        const loreEl = this.overlay.querySelector('.profile-faction-lore-text');
        if (loreEl) loreEl.innerHTML = '';
        const focusEl = this.overlay.querySelector('[data-faction-focus]');
        if (focusEl && typeof ProfileSelectionManager !== 'undefined' && ProfileSelectionManager.prototype.buildFactionFocusHtml) {
            focusEl.innerHTML = ProfileSelectionManager.prototype.buildFactionFocusHtml.call(
                ProfileSelectionManager.prototype, id, meta);
        }
        const homeLabel = this.overlay.querySelector('.onboarding-homeworld-label');
        if (homeLabel) {
            const galaxy = String((meta && meta.homeGalaxy) || '').replace(/_/g, ' ').toUpperCase();
            const name = this.getFactionLabel(id);
            const sub = galaxy ? `HOMEWORLD · ${galaxy}` : 'HOMEWORLD';
            const lore = lead || (name + ' fleets hold this homeworld.');
            // Crest + name on the right stage; lore directly under the title.
            homeLabel.innerHTML =
                `<span class="onboarding-homeworld-crest">${this.getFactionEmblemHtml(id, 160)}</span>` +
                `<span class="onboarding-homeworld-title">` +
                `<b class="onboarding-homeworld-name">${name}</b>` +
                `<small class="onboarding-homeworld-sub">${sub}</small>` +
                `<p class="onboarding-homeworld-lore">${lore}</p>` +
                `</span>`;
        }
        if (this._heroPlanet) this._heroPlanet.setFaction(id);
    }

    stopHomePlanet() {
        if (this._heroPlanet && this._heroPlanet.unmount) {
            this._heroPlanet.unmount();
        }
        this._heroPlanet = null;
    }

    startHomePlanet() {
        if (!this.overlay || this.step !== 'story') return;
        const stage = this.overlay.querySelector('.onboarding-homeworld-stage');
        if (!stage) return;
        if (typeof HeroPlanetBackdrop === 'undefined') {
            // Profiles chunk may still be loading — retry briefly.
            clearTimeout(this._planetRetry);
            this._planetRetry = setTimeout(() => {
                if (this.overlay && this.step === 'story') this.startHomePlanet();
            }, 200);
            return;
        }
        if (!this._heroPlanet) this._heroPlanet = new HeroPlanetBackdrop();
        if (this._heroPlanet.setLayout) this._heroPlanet.setLayout('stage');
        this._heroPlanet.setFaction(this._pendingFaction);
        this._heroPlanet.mount(stage);
        stage.classList.add('has-hero-planet');
    }

    bindStep() {
        const next = this.overlay.querySelector('#obNext');
        if (next) next.addEventListener('click', () => this.advance());
        const back = this.overlay.querySelector('#obBack');
        if (back) back.addEventListener('click', () => this.goBack());
        this.overlay.querySelectorAll('[data-step-go]').forEach((btn) => {
            btn.addEventListener('click', () => this.goTo(btn.getAttribute('data-step-go')));
        });

        if (this.step === 'story') {
            this.bindFactionPicker();
            this.startHomePlanet();
            // Wait a frame so the preview canvas has layout before the first paint.
            requestAnimationFrame(() => {
                if (!this.overlay || this.step !== 'story') return;
                this.refreshFactionPreview();
                this.startHomePlanet();
                requestAnimationFrame(() => {
                    if (this.overlay && this.step === 'story') this.refreshFactionPreview();
                });
            });
        }

        if (this.step === 'pilot') {
            this.bindPilotControls();
        }

        if (this.step === 'name') {
            const input = this.overlay.querySelector('#obNameInput');
            if (input) {
                input.focus();
                if (this._pendingName) input.value = this._pendingName;
                const meta = this.getFactionMeta(this._pendingFaction);
                if (meta && meta.hero && meta.hero.name && !input.value) {
                    input.placeholder = meta.hero.name.slice(0, 16);
                }
            }
            this.bindPilotKit();
        }

        if (this.step === 'scrap') {
            this.bindShipPreview();
        }

        this._keyHandler = (e) => {
            if (!this.isVisible) return;
            // Start screen is hidden during onboarding and the editors bundle (global
            // Shift+C) may not be loaded yet — handle DevMode here like the profile overlay.
            if (e.shiftKey && (e.key === 'c' || e.key === 'C')) {
                const tag = e.target && e.target.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA' && typeof startScreenManager !== 'undefined') {
                    if (e.repeat) return;
                    e.preventDefault();
                    startScreenManager.toggleDevMode();
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                if (this.stepIndex() > 0) this.goBack();
                return;
            }
            if (this.step === 'story' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                const ids = this.getFactionIds();
                const i = Math.max(0, ids.indexOf(this._pendingFaction));
                const nextId = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
                this.setFaction(nextId);
                return;
            }
            if (this.step === 'pilot') {
                const psm = this.syncPilotToPsm();
                if ((e.key === 'r' || e.key === 'R') && !(e.target && e.target.tagName === 'INPUT')) {
                    e.preventDefault();
                    if (psm && psm.randomizePilotLook) {
                        psm.randomizePilotLook();
                        this._pilotLook = psm._startOpts && psm._startOpts.look
                            ? Object.assign({}, psm._startOpts.look)
                            : this._pilotLook;
                    } else if (typeof heroPortrait !== 'undefined') {
                        this._pilotLook = heroPortrait.randomLook(this._pendingFaction);
                        this.refreshPilotUi();
                    }
                    return;
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const d = e.key === 'ArrowRight' ? 1 : -1;
                    if (psm && psm.stepPilotLook) {
                        psm.stepPilotLook(this._pilotLookKey, d);
                        this._pilotLook = psm._startOpts && psm._startOpts.look
                            ? Object.assign({}, psm._startOpts.look)
                            : this._pilotLook;
                        this._pilotLookKey = (psm._startOpts && psm._startOpts.lookKey) || this._pilotLookKey;
                    } else if (typeof heroPortrait !== 'undefined') {
                        this._pilotLook = heroPortrait.cycle(this.ensurePilotLook(), this._pilotLookKey, d);
                        this.refreshPilotUi();
                    }
                    return;
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const keys = (typeof heroPortrait !== 'undefined' && heroPortrait.keysFor)
                        ? heroPortrait.keysFor(this.ensurePilotLook())
                        : [];
                    if (!keys.length) return;
                    const i = Math.max(0, keys.indexOf(this._pilotLookKey));
                    this._pilotLookKey = keys[(i + (e.key === 'ArrowDown' ? 1 : keys.length - 1)) % keys.length];
                    if (psm && psm._startOpts) psm._startOpts.lookKey = this._pilotLookKey;
                    this.refreshPilotUi();
                    return;
                }
            }
            if (this.step === 'name' && e.target && e.target.id === 'obNameInput') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.advance();
                }
                return;
            }
            if (this.step === 'name' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                && !(e.target && e.target.id === 'obNameInput')) {
                e.preventDefault();
                const chips = Array.from(this.overlay.querySelectorAll('[data-start-opt="kit"]'));
                if (!chips.length) return;
                const cur = chips.findIndex((b) => b.classList.contains('selected'));
                const next = chips[(Math.max(0, cur) + (e.key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length];
                if (next) next.click();
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.advance();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    advance() {
        if (this.step === 'story') {
            this.step = 'pilot';
            this.createUI();
            return;
        }
        if (this.step === 'pilot') {
            this.ensurePilotLook();
            this.step = 'name';
            this.createUI();
            return;
        }
        if (this.step === 'name') {
            const input = this.overlay.querySelector('#obNameInput');
            const name = input ? input.value : '';
            if (typeof profileManager === 'undefined') return;
            let p = profileManager.getActiveProfile && profileManager.getActiveProfile();
            const already = p && this._pendingName && p.name === String(name || '').trim().toUpperCase().slice(0, 16)
                && p.faction === this._pendingFaction;
            if (!already) {
                p = profileManager.create(name, this._pendingFaction);
            }
            if (!p) {
                if (input) {
                    input.classList.add('nav-focused');
                    input.focus();
                }
                return;
            }
            profileManager.setActive(p.id);
            if (this._pilotLook) {
                p.portrait = Object.assign({}, this._pilotLook);
            }
            const psm = this.syncPilotToPsm();
            if (psm && psm.applyStartOptions) {
                try { psm.applyStartOptions(p); } catch (e) { /* continue */ }
            }
            if (profileManager.save) profileManager.save();
            this._pendingName = p.name;
            this.step = 'scrap';
            this.createUI();
            return;
        }
        this.hide();
        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'hangar',
                onClose: this.onComplete
            });
            return;
        }
        if (typeof this.onComplete === 'function') this.onComplete();
    }

    /** START PROFILE + inventory under the callsign (pilot) step. */
    bindPilotKit() {
        const psm = this.syncPilotToPsm();
        if (!psm || !this.overlay) return;
        if (!psm._startOpts) psm._startOpts = {};
        psm._startOpts.faction = this._pendingFaction;
        psm.pendingFaction = this._pendingFaction;
        if (psm.currentKit) psm.currentKit();
        this.overlay.querySelectorAll('[data-start-opt="kit"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                psm._startOpts.kit = btn.getAttribute('data-value');
                psm._startOpts.ship = psm.kitShipId ? psm.kitShipId(psm._startOpts.kit) : psm._startOpts.ship;
                psm._startOpts.storyPathId = null;
                this.overlay.querySelectorAll('[data-start-opt="kit"]').forEach((b) => {
                    const on = b === btn;
                    b.classList.toggle('selected', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                const loadout = this.overlay.querySelector('.profile-loadout');
                if (loadout && psm.renderLoadoutHtml) loadout.innerHTML = psm.renderLoadoutHtml();
                const kitInfo = this.overlay.querySelector('.profile-kit-info');
                if (kitInfo && psm.renderKitInfoHtml) kitInfo.innerHTML = psm.renderKitInfoHtml();
                if (psm.renderFactionShipPreview) psm.renderFactionShipPreview(this._pendingFaction);
                if (psm.renderKitShipInfo) psm.renderKitShipInfo();
            });
        });
        if (psm.renderFactionShipPreview) psm.renderFactionShipPreview(this._pendingFaction);
        if (psm.renderKitShipInfo) psm.renderKitShipInfo();
    }

    /** Ship step: preview the kit hull already chosen with the pilot. */
    bindShipPreview() {
        const psm = this.syncPilotToPsm();
        if (!psm || !this.overlay) return;
        if (psm.renderFactionShipPreview) psm.renderFactionShipPreview(this._pendingFaction);
        if (psm.renderKitShipInfo) psm.renderKitShipInfo();
    }
}

const onboardingManager = new OnboardingManager();
window.onboardingManager = onboardingManager;
