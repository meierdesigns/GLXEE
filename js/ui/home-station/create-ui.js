"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    createUI() {
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
        const cargoResHtml = this.renderResourceList(profile.cargo.resources, 'cargo');
        const cargoBpHtml = this.renderBlueprintList(profile.cargo.blueprints);
        const stationBpHtml = this.renderBlueprintList(profile.blueprints);
        const stats = (typeof profileManager !== 'undefined')
            ? profileManager.getStationStats(profile)
            : { shipSlots: 2 };
        const owned = profile.ownedShipIds || [];
        const ownedHtml = owned.map((id) =>
            `<span class="hs-chip hs-chip-ship">` +
            `<span class="hs-chip-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>` +
            `<span class="hs-chip-text">${this.shipName(id)}</span>` +
            `</span>`
        ).join('') || '<span class="hs-muted hs-empty-slot">NONE</span>';
        const slotsLabel = `${owned.length}/${stats.shipSlots}`;

        let body = '';
        if (this.tab === 'menu') {
            body = `<div class="hs-menu-host" id="hsMenuHost"></div>`;
        } else if (this.tab === 'shop') {
            body = this.renderShopTab(profile);
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
        } else if (this.tab === 'play') {
            body = this.renderPlayTab(profile);
        } else {
            body = `
                <div class="hs-station-grid">
                    <div class="hs-station-cover" aria-label="Home station">
                        <div class="hs-station-cover-image"></div>
                        <div class="hs-station-cover-faction" aria-hidden="true"></div>
                        <div class="hs-station-cover-scanline"></div>
                        <div class="hs-station-cover-caption">
                            <span class="hs-station-cover-kicker">HOME STATION // DOCK 01</span>
                            <strong>WELCOME ABOARD</strong>
                        </div>
                    </div>
                    <div class="hs-panel hs-panel-stores">
                        ${this.panelTitle('hsStores', 'STATION STORES')}
                        <div class="hs-row hs-res-grid">${walletHtml}</div>
                    </div>
                    <div class="hs-panel hs-panel-cargo">
                        ${this.panelTitle('hsCargo', 'MISSION CARGO')}
                        <div class="hs-row hs-res-grid">${cargoResHtml}</div>
                        <div class="hs-row hs-bp">${cargoBpHtml}</div>
                        <button class="action-button hs-panel-action hs-teleport" id="hsTeleport" ${profileManager.hasCargo() ? '' : 'disabled'}>` +
                            `<span class="hs-btn-icon">${this.iconHtml('hsTeleport', 32, 'hs-pixel')}</span>` +
                            `<span>TELEPORT CARGO</span>` +
                        `</button>
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

        const creditsBar = `<div class="hs-credits-bar">${this.renderCreditsBar(profile.resources, profile)}</div>`;
        const statusClass = this.statusMsg ? 'hs-status' : 'hs-status is-empty';
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
        const hideHeaderCredits = isPlay || isMenu || this.tab === 'shop';
        // Tabs with no separate "tabs vs content" browsing step land directly on
        // interactive content (mouse clicks work regardless of nav level), so they
        // must never sit dimmed at the default .hs-nav-tabs opacity like station.
        const undimmedTabs = ['hangar', 'shop', 'upgrade', 'craft', 'travel', 'explorations'];
        const modeClass = undimmedTabs.indexOf(this.tab) !== -1 ? ` hs-mode-${this.tab}` : '';
        this.setOverlayHtml(`
            <div class="profile-selection-content home-station-content hs-nav-tabs${this.tab === 'station' ? ' hs-mode-station' : ''}${isPlay ? ' hs-mode-play' : ''}${isMenu ? ' hs-mode-menu' : ''}${isComp ? ' hs-mode-components' : ''}${modeClass}">
                <div class="hs-header">
                    <div class="hs-topbar">
                        <div class="hs-tabs">
                            <button type="button" class="hs-home-btn ${this.tab === 'station' ? 'active' : ''}" data-tab="station" data-nav-item title="Home Station">
                                <span class="hs-home-icon">${this.iconHtml('hsStation', 32, 'hs-pixel hs-pixel-32')}</span>
                                <span class="hs-home-text">HOME STATION</span>
                            </button>
                            ${this.renderTabs()}
                        </div>
                        <p class="hs-profile"><span class="hs-profile-tag">PILOT</span> ${profile.name}</p>
                        <div class="hs-topbar-actions">
                            ${this.renderMenuTabs()}
                            <button type="button" class="hs-logout-btn" id="hsLogout" aria-label="Logout" title="Logout" data-nav-item>
                                <span class="hs-logout-icon" aria-hidden="true">&#9211;</span>
                                <span class="hs-logout-label">LOGOUT</span>
                            </button>
                        </div>
                    </div>
                    ${hideHeaderCredits ? '' : creditsBar}
                    ${isPlay || isMenu ? '' : `<p class="${statusClass}">${this.statusMsg || '\u00A0'}</p>`}
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
        } else {
            this.destroyHangarPanelResize();
            this._hangarOpenSlot = null;
            if (this._hangarBayResizeObs) {
                this._hangarBayResizeObs.disconnect();
                this._hangarBayResizeObs = null;
            }
        }
        if (this.tab === 'play') {
            this.mountPlayTab();
        }
        if (this.tab === 'menu') {
            this.mountMenuTab(this._menuOpts);
        }
        if (this.tab === 'components') {
            this.mountComponentsTab();
        }
        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
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
