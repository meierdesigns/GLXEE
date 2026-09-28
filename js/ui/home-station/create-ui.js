"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    createUI() {
        // A trading-post visit ends as soon as another tab is shown.
        if (this.tab !== 'shop' && this.visitPostId) {
            this.visitPostId = null;
            if (this._shopCategoryBeforeDock) this.shopCategory = this._shopCategoryBeforeDock;
            this._shopCategoryBeforeDock = null;
        }
        this.stopHangarPreview();
        const scrollState = this.captureScrollState();
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        const profile = this.getProfile();
        const reuse = !!this.overlay && this.overlay.isConnected;
        if (!reuse) {
            if (this.overlay) this.overlay.remove();
            this.overlay = document.createElement('div');
            this.overlay.className = 'profile-selection-overlay home-station-overlay';
        } else {
            this.overlay.className = 'profile-selection-overlay home-station-overlay';
        }
        this.overlay.dataset.hsTab = this.tab || 'station';
        this.applyFactionTheme();

        if (!profile) {
            this.overlay.dataset.hsTab = 'station';
            this.setOverlayHtml(`
                <div class="profile-selection-content home-station-content">
                    <div class="hs-header">
                        <div class="hs-topbar">
                            <span class="hs-home-label">HOME STATION</span>
                            <span class="hs-topbar-spacer"></span>
                            <div class="hs-topbar-actions">
                                <button type="button" class="hs-menu-btn" id="hsMenu" aria-label="Menu" title="Menu" data-nav-item>${this.menuButtonHtml()}</button>
                            </div>
                        </div>
                    </div>
                    <p class="hs-empty">NO ACTIVE PROFILE</p>
                    <div class="profile-selection-instructions"><p>ESC Menu</p></div>
                </div>`);
            if (!reuse) document.body.appendChild(this.overlay);
            this.overlay.querySelector('#hsMenu').addEventListener('click', () => this.openMainMenuOverlay());
            this.bindKeyNav();
            this.refreshFocus();
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
            return;
        }

        const walletHtml = this.renderResourceList(profile.resources, 'station');
        const stationBpHtml = this.renderBlueprintList(profile.blueprints);
        const stats = (typeof profileManager !== 'undefined')
            ? profileManager.getStationStats(profile)
            : { shipSlots: 2 };
        const owned = profile.ownedShipIds || [];
        const ownedHtml = owned.length
            ? this.shipTableHtml(owned.map((id) => this.renderShipTableRow(id, 'hs-ship-thumb-owned', '',
                (id === profile.activeShipId
                    ? `<span class="hs-ship-icon-btn is-active" data-ui-tip="ACTIVE SHIP">★</span>`
                    : `<button type="button" class="action-button hs-ship-icon-btn" data-select-ship="${id}" data-nav-item data-ui-tip="SET ACTIVE" aria-label="Set active">` +
                      `${this.iconHtml('menuStart', 20, 'hs-pixel hs-pixel-20', false)}</button>`) +
                `<button type="button" class="action-button hs-ship-icon-btn" data-open-hangar="${id}" data-nav-item data-ui-tip="OPEN IN HANGAR" aria-label="Open in hangar">` +
                `${this.iconHtml('hsHangar', 20, 'hs-pixel hs-pixel-20', false)}</button>`
            )).join(''), true)
            : '<span class="hs-muted hs-empty-slot">NONE</span>';
        const slotsLabel = `${owned.length}/${stats.shipSlots}`;

        let body = '';
        if (this.tab === 'menu') {
            body = `<div class="hs-menu-host" id="hsMenuHost"></div>`;
        } else if (this.tab === 'shop') {
            body = this.renderShopTab(profile);
        } else if (this.tab === 'missions') {
            body = this.renderMissionsTab(profile);
        } else if (this.tab === 'craft') {
            body = this.renderCraftTab(profile);
        } else if (this.tab === 'hangar') {
            // Use new HangarUI module — DISABLED TEMPORARILY
            // if (this.hangarUI) {
            //     const owned = profile.ownedShipIds || [];
            //     if (!owned.length) {
            //         body = `<div class="hs-section"><h3>HANGAR</h3><p class="hs-muted">No ships owned.</p></div>`;
            //     } else {
            //         if (!this.hangarShipId || owned.indexOf(this.hangarShipId) === -1) {
            //             this.hangarShipId = profile.activeShipId || owned[0];
            //         }
            //         this.hangarUI.setShip(this.hangarShipId);
            //         body = this.hangarUI.render();
            //     }
            // } else {
                body = this.renderHangarTab(profile);
            // }
        } else if (this.tab === 'components') {
            body = this.renderComponentsTab(profile);
        } else if (this.tab === 'upgrade') {
            body = this.renderUpgradeTab(profile);
        } else if (this.tab === 'travel') {
            body = this.renderTravelTab(profile);
        } else if (this.tab === 'explorations') {
            body = this.renderExplorationsTab(profile);
        } else if (this.tab === 'factions') {
            body = this.renderFactionsTab(profile);
        } else if (this.tab === 'ftrade') {
            body = this.renderFactionTradeTab(profile);
        } else if (this.tab === 'fcontracts') {
            body = this.renderFactionContractsTab(profile);
        } else if (this.tab === 'play') {
            body = this.renderPlayTab(profile);
        } else {
            body = `
                <div class="hs-station-grid">
                    <div class="hs-station-cover" aria-label="Home station">
                        <div class="hs-station-cover-image"></div>
                        <div class="hs-station-cover-faction" aria-hidden="true"></div>
                        <div class="hs-station-cover-scanline"></div>
                        <div class="hs-station-cover-crest" aria-hidden="true">${this.factionCrestHtml(profile, 'banner')}</div>
                        <div class="hs-station-cover-caption">
                            <span class="hs-station-cover-kicker">HOME STATION // STORAGE</span>
                            <strong>STATION STORAGE</strong>
                        </div>
                    </div>
                    <div class="hs-panel hs-panel-stores">
                        ${this.panelTitle('hsStores', 'STATION STORES')}
                        <div class="hs-row hs-res-grid">${walletHtml}</div>
                    </div>
                    <div class="hs-panel hs-panel-bp">
                        ${this.panelTitle('hsBlueprint', 'BLUEPRINTS')}
                        <div class="hs-row hs-bp">${stationBpHtml}</div>
                        ${this.renderUnlockList(profile)}
                    </div>
                    <div class="hs-panel-stack">
                        <div class="hs-panel hs-panel-ships">
                            ${this.panelTitle('hsShip', 'OWNED SHIPS · ' + slotsLabel)}
                            <div class="hs-row hs-ship-row">${ownedHtml}</div>
                        </div>
                        <div class="hs-panel hs-panel-parts">
                            ${this.panelTitle('hsCraft', 'PARTS')}
                            <div class="hs-row">${this.renderPartsList(profile)}</div>
                        </div>
                    </div>
                </div>`;
        }

        const isPlay = this.tab === 'play';
        const isMenu = this.tab === 'menu';
        const bodyClass = isPlay
            ? 'hs-body hs-body-play'
            : (isMenu
                ? 'hs-body hs-body-menu'
                : (this.tab === 'components' ? 'hs-body hs-body-components' : 'hs-body'));
        let footerHint = '[TABS] ←→ Switch | ENTER Enter Tab | ESC Menu';
        if (isPlay) footerHint = '[TABS] ←→ Switch | ENTER Enter Map | ESC Menu';
        if (isMenu) footerHint = '← → Menu Tabs | ↑ ↓ Navigate | ENTER Select | ESC Back';
        if (this.tab === 'components') footerHint = '[TABS] ←→ Switch | ENTER Enter Tab | ESC Menu';

        this.unmountMenuTab();
        this.unmountPlayTab();
        this.unmountComponentsTab();
        const isComp = this.tab === 'components';
        // Tabs with no separate "tabs vs content" browsing step land directly on
        // interactive content (mouse clicks work regardless of nav level), so they
        // must never sit dimmed at the default .hs-nav-tabs opacity like station.
        const undimmedTabs = ['hangar', 'shop', 'upgrade', 'missions', 'craft', 'travel', 'explorations', 'factions', 'ftrade', 'fcontracts'];
        const modeClass = undimmedTabs.indexOf(this.tab) !== -1 ? ` hs-mode-${this.tab}` : '';
        this.setOverlayHtml(`
            <div class="profile-selection-content home-station-content hs-nav-tabs${this.tab === 'station' ? ' hs-mode-station' : ''}${isPlay ? ' hs-mode-play' : ''}${isMenu ? ' hs-mode-menu' : ''}${isComp ? ' hs-mode-components' : ''}${modeClass}">
                <div class="hs-header hs-header-split">
                    <div class="hs-pilot-card">
                        <span class="hs-pilot-crest" aria-hidden="true">${this.factionCrestHtml(profile, 'card')}</span>
                        <div class="hs-pilot-info">
                            <p class="hs-profile hs-pilot-name">${profile.name}</p>
                            <div class="hs-pilot-res">${this.renderCreditsBar(profile.resources, profile)}</div>
                        </div>
                    </div>
                    <div class="hs-header-main">
                        <div class="hs-topbar">
                            <div class="hs-tabs">
                                ${this.isMenuRowTab() ? this.renderMenuTabs() : this.renderTabs()}
                            </div>
                            <div class="hs-topbar-actions">
                                <button type="button" class="hs-logout-btn" id="hsLogout" aria-label="Logout" data-nav-item>
                                    <span class="hs-logout-icon" aria-hidden="true">${this.iconHtml('hsLogout', 32, 'hs-tab-pixel', false)}</span>
                                </button>
                            </div>
                        </div>
                        ${this.renderAreaSubnav()}
                    </div>
                </div>
                <div class="${bodyClass}">${body}</div>
                <div class="hs-footer ui-controls-hint">
                    <div class="profile-selection-instructions"><p>${footerHint}</p></div>
                    <button type="button" class="ui-controls-hide-btn" id="hsHideControls" title="Hide controls (Shift+H)" aria-label="Hide controls">HIDE</button>
                </div>
                <button type="button" class="ui-controls-show-btn" id="hsShowControls" title="Show controls (Shift+H)" aria-label="Show controls">?</button>
                ${this.renderResourceBuyModal(profile)}
            </div>`);
        if (!reuse) {
            this.overlay.classList.add('vf-menu-enter');
            document.body.appendChild(this.overlay);
        }
        this.bindEvents();
        this.bindControlsToggle();
        // MENU area button = same as pressing ESC.
        const menuBtn = this.overlay.querySelector('[data-open-menu]');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openMainMenuOverlay({ force: true });
            });
        }
        // Status messages show once as a toast (bottom centre), not as a line
        // under the tabs; consume it so re-renders don't repeat it.
        if (this.statusMsg) {
            this.showStatusToast(this.statusMsg);
            this.statusMsg = '';
        }
        if (['factions', 'ftrade', 'fcontracts'].indexOf(this.tab) !== -1) this.bindFactionEvents();
        this.restoreNavFocus();
        if (this._focusExplore) {
            this.focusExploreItem(this._focusExplore);
            this._focusExplore = null;
        }
        this.syncNavHint();
        this.restoreScrollState(scrollState);
        this.applyPendingFlash();
        if (this.tab === 'hangar') {
            // Bind new HangarUI events — DISABLED TEMPORARILY
            // this._bindHangarEvents();
            this.setupHangarPanelResize();
            this.startHangarPreview();
            this.drawHangarBay();
            this.renderAllComponentTrees();
            this.bindComponentTreeEvents();
            this.bindHangarSlotEvents();
            this.bindHangarPartsGrid();
        } else {
            this.destroyHangarPanelResize();
            this._hangarOpenSlot = null;
            if (this._hangarBayResizeObs) {
                this._hangarBayResizeObs.disconnect();
                this._hangarBayResizeObs = null;
            }
        }
        if (this.tab === 'missions') this.bindMissionEvents();
        if (this.tab === 'play') {
            this.mountPlayTab();
        }
        if (this.tab === 'menu') {
            this.mountMenuTab(this._menuOpts);
        }
        if (this.tab === 'components') {
            this.mountComponentsTab();
        }
        this.scheduleShipThumbs();
        this.bindShipSelectButtons();
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
    },

    /**
     * Ship thumbs need graphicsManager.shipAssetLoader, which loads async and
     * may still be missing (or its part images still decoding) on first render.
     * Draw now and redraw a few times until the loader is ready.
     */
    scheduleShipThumbs() {
        clearTimeout(this._shipThumbTimer);
        let tries = 0;
        const run = () => {
            this.drawAreaThumbs();
            const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
            const ready = !!(loader && loader.loaded);
            tries += 1;
            if (tries < (ready ? 3 : 40)) this._shipThumbTimer = setTimeout(run, ready ? 400 : 250);
        };
        run();
    },

    /** SELECT buttons in the owned-ships table: make that ship the active one. */
    bindShipSelectButtons() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('[data-select-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-select-ship');
                if (typeof profileManager === 'undefined') return;
                if (profileManager.setActiveShip) {
                    profileManager.setActiveShip(id);
                } else {
                    const p = profileManager.getActiveProfile();
                    if (!p) return;
                    p.activeShipId = id;
                    profileManager.save();
                }
                if (typeof shipConfigManager !== 'undefined') shipConfigManager.applyToRuntime(id);
                this.statusMsg = 'ACTIVE: ' + this.shipName(id);
                this.createUI();
            });
        });
        this.overlay.querySelectorAll('[data-open-hangar]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (this.tab === 'menu') {
                    this.unmountMenuTab();
                    this._menuOpts = null;
                    this._prevTab = null;
                }
                this.hangarShipId = btn.getAttribute('data-open-hangar');
                this.statusMsg = '';
                this.focusIndex = 0;
                this.tab = 'hangar';
                this.persistTab();
                this.createUI();
            });
        });
    },

    focusExploreItem(kind) {
        if (!kind || !this.overlay) return;
        const list = this.getFocusables();
        const btn = this.overlay.querySelector(`[data-explore="${kind}"]`);
        const idx = btn ? list.indexOf(btn) : -1;
        if (idx >= 0) {
            this._navLevel = 'content';
            this.focusIndex = idx;
            this.refreshFocus();
            this.syncNavHint();
        }
    },

    launchPlay() {
        this.tab = 'play';
        this.statusMsg = '';
        this.focusIndex = 0;
        this.persistTab();
        this.createUI();
    },

    renderPlayTab(profile) {
        return `<div class="hs-play-shell" id="hsPlayMount" data-nav-section="play"></div>`;
    },
});
