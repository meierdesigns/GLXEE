"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    createUI() {
        // Restore the hangar inventory-panel toggle before the first render/draw, not on
        // DOMContentLoaded (too late: it raced createUI()'s own first call on refresh, so
        // drawHangarBay() fit the ship as if the panel were closed even though it reopened).
        if (!this._bayInvRestored) {
            this._bayInvRestored = true;
            try {
                if (localStorage.getItem('vf_hs_bay_inv') === '1') this._bayInv = true;
                const fl = localStorage.getItem('vf_hs_bay_inv_filter');
                if (fl) this._bayInvFilter = fl;
            } catch (err) { /* ignore */ }
        }
        // The TRAVEL tab is a page listing the galaxies; the planet map still opens its own travel modal.
        if (this._travelKey) {
            document.removeEventListener('keydown', this._travelKey, true);
            this._travelKey = null;
        }
        if (this.tab !== 'play') this._travelModal = false;
        // A rebuild replaces the body, so an embedded WIKI viewer ends here.
        if (this._embeddedViewer) this.closeEmbeddedViewer();
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
            this._hsShellReady = false;
        } else {
            this.overlay.className = 'profile-selection-overlay home-station-overlay';
        }
        this.overlay.dataset.hsTab = this.tab || 'station';
        this.applyFactionTheme();

        // Soft tab switch: keep header/shell, only swap .hs-body (H10 — full setOverlayHtml was ~70–100ms).
        if (profile && this._hsShellReady && this._trySoftTabSwitch(profile, scrollState)) {
            return;
        }

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

        const built = this._buildTabBody(profile);
        const { body, bodyClass, isPlay, isMenu, hideTabsForTutorial } = built;

        this.unmountMenuTab();
        this.unmountPlayTab();
        this.unmountComponentsTab();
        const isComp = this.tab === 'components';
        // Tabs with no separate "tabs vs content" browsing step land directly on
        // interactive content (mouse clicks work regardless of nav level), so they
        // must never sit dimmed at the default .hs-nav-tabs opacity like station.
        const undimmedTabs = ['hangar', 'shop', 'upgrade', 'missions', 'craft', 'travel', 'explorations', 'factions', 'ffleet', 'ftrade', 'fcontracts'];
        const modeClass = undimmedTabs.indexOf(this.tab) !== -1 ? ` hs-mode-${this.tab}` : '';
        this.setOverlayHtml(`
            <div class="vf-browser-shell">
              <div class="profile-selection-content home-station-content hs-nav-tabs${this.tab === 'station' ? ' hs-mode-station' : ''}${isPlay ? ' hs-mode-play' : ''}${isMenu || this.isMenuRowTab() ? ' hs-mode-menu' : ''}${isComp ? ' hs-mode-components' : ''}${modeClass}">
                <div class="hs-header hs-header-split">
                    <div class="hs-pilot-card">
                        <span class="hs-pilot-crest" aria-hidden="true">${this.factionCrestHtml(profile, 'card')}</span>
                        <div class="hs-pilot-info">
                            <p class="hs-profile hs-pilot-name">${profile.name}</p>
                        </div>
                    </div>
                    ${this.renderPlayLaunch()}
                    <div class="hs-header-main">
                        <div class="hs-topbar">
                            <div class="hs-tabs${hideTabsForTutorial ? ' hs-tabs-hidden' : ''}">
                                ${hideTabsForTutorial ? '' : this.renderTabs()}
                            </div>
                        </div>
                    </div>
                    ${this.renderMissionButton()}
                    <!-- Planet-map progress (filled by the embedded galaxy map): own card left of the wallet. -->
                    <div class="hs-progress-card" id="hsMapProgress" hidden></div>
                    <!-- Wallet card right of both navbars: resources + logout. -->
                    <div class="hs-wallet-card">
                        <div class="hs-wallet-res hs-pilot-res">${this.renderCreditsBar(profile.resources, profile)}</div>
                        ${typeof vfFullscreen !== 'undefined' ? vfFullscreen.buttonHtml('hs-logout-btn hs-fullscreen-btn', 'hsFullscreen') : ''}
                        <button type="button" class="hs-logout-btn" id="hsLogout" aria-label="Logout" data-nav-item>
                            <span class="hs-logout-icon" aria-hidden="true">${this.iconHtml('hsLogout', 32, 'hs-tab-pixel', false)}</span>
                        </button>
                    </div>
                </div>
                <!-- Sub-nav opens the content area, under the active index-card tab. -->
                ${this.renderAreaSubnav()}
                <div class="${bodyClass}">${body}</div>
                ${this.renderResourceBuyModal(profile)}
              </div>
            </div>
            <label class="hs-frame-ui-scale" for="hsFrameUiScale">
                <span>GUI</span>
                <input type="range" id="hsFrameUiScale" min="50" max="125" step="5" value="${typeof uiAppearanceManager !== 'undefined' ? uiAppearanceManager.uiScale : '75'}" aria-label="GUI scale">
                <output id="hsFrameUiScaleValue">${typeof uiAppearanceManager !== 'undefined' ? uiAppearanceManager.uiScale : '75'}%</output>
            </label>`);
        if (!reuse) {
            this.overlay.classList.add('vf-menu-enter');
            document.body.appendChild(this.overlay);
        }
        this._softBodyCache = null;
        this._softBodyTab = null;
        this._finishTabMount(scrollState, { bindChrome: true });
        this._hsShellReady = true;
        this._softBodyTab = this.tab;
        this._syncTabsUnlockReveal(this.overlay.querySelector('.hs-tabs'), hideTabsForTutorial);
    },

    /** First-planet unlock: when the nav tabs flip from hidden to shown, play a reveal animation. */
    _syncTabsUnlockReveal(tabsWrap, hideTabsForTutorial) {
        if (!tabsWrap) return;
        if (!this._hsTabsRevealInit) {
            this._hsTabsRevealInit = true;
            this._hsTabsWereHidden = !!hideTabsForTutorial;
            return;
        }
        if (!hideTabsForTutorial && this._hsTabsWereHidden) {
            if (!tabsWrap.firstElementChild) tabsWrap.innerHTML = this.renderTabs();
            tabsWrap.classList.add('hs-tabs-reveal');
            tabsWrap.addEventListener('animationend', () => tabsWrap.classList.remove('hs-tabs-reveal'), { once: true });
        }
        this._hsTabsWereHidden = !!hideTabsForTutorial;
    },

    /** Build tab body HTML + chrome flags shared by hard and soft createUI paths. */
    _buildTabBody(profile) {
        const walletHtml = this.renderResourceList(profile.resources, 'station');
        const stationBpHtml = this.renderBlueprintList(profile);
        const stats = (typeof profileManager !== 'undefined')
            ? profileManager.getStationStats(profile)
            : { shipSlots: 2 };
        const owned = profile.ownedShipIds || [];
        const ownedHtml = owned.length
            ? this.shipTableHtml(owned.map((id) => this.renderShipTableRow(id, 'hs-ship-thumb-owned', '',
                (id === profile.activeShipId
                    ? `<span class="hs-ship-icon-btn is-active" data-ui-tip="ACTIVE SHIP">${this.iconHtml('hsStar', 20, 'hs-pixel hs-pixel-20', false)}</span>`
                    : `<button type="button" class="action-button hs-ship-icon-btn" data-select-ship="${id}" data-nav-item data-ui-tip="SET ACTIVE" aria-label="Set active">` +
                      `${this.iconHtml('menuStart', 20, 'hs-pixel hs-pixel-20', false)}</button>`) +
                `<button type="button" class="action-button hs-ship-icon-btn" data-open-hangar="${id}" data-nav-item data-ui-tip="OPEN IN HANGAR" aria-label="Open in hangar">` +
                `${this.iconHtml('hsHangar', 20, 'hs-pixel hs-pixel-20', false)}</button>`
            )).join(''), true)
            : this.emptyHtml('hsShip', 'NO SHIPS OWNED');
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
            body = this.renderHangarTab(profile);
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
        } else if (this.tab === 'ffleet') {
            body = this.renderFactionFleetTab(profile);
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

        let hideTabsForTutorial = false;
        if (typeof profileManager !== 'undefined' && profileManager.hasClearedFirstPlanet) {
            hideTabsForTutorial = !profileManager.hasClearedFirstPlanet(profile);
        }
        const isPlay = this.tab === 'play';
        const isMenu = this.tab === 'menu';
        const bodyClass = isPlay
            ? 'hs-body hs-body-play'
            : (isMenu
                ? 'hs-body hs-body-menu'
                : (this.tab === 'components' ? 'hs-body hs-body-components' : 'hs-body'));
        return { body, bodyClass, isPlay, isMenu, hideTabsForTutorial };
    },

    /**
     * Soft tab switch: keep shell/header, swap .hs-body + tab/subnav chrome only.
     * Avoids full setOverlayHtml (~70–100ms) on every LAUNCH↔STATION↔HANGAR hop.
     */
    _softBodyFingerprint(profile) {
        if (!profile) return '';
        const res = profile.resources || {};
        return [
            this.tab,
            profile.activeShipId || '',
            profile.credits != null ? profile.credits : (res.credits || 0),
            (profile.ownedShipIds || []).length,
            this.upgradeSubTab || '',
            this.shopCategory || '',
            this.visitPostId || '',
            this.hangarShipId || ''
        ].join('|');
    },

    _parkSoftBody(bodyEl, leavingTab) {
        if (!bodyEl || !leavingTab || leavingTab === 'play' || leavingTab === 'menu' || leavingTab === 'components') return;
        if (!this._softBodyCache) this._softBodyCache = Object.create(null);
        const frag = document.createDocumentFragment();
        while (bodyEl.firstChild) frag.appendChild(bodyEl.firstChild);
        this._softBodyCache[leavingTab] = {
            frag,
            className: bodyEl.className,
            fp: this._softBodyParkFp || ''
        };
    },

    _restoreSoftBody(bodyEl, profile) {
        const cache = this._softBodyCache && this._softBodyCache[this.tab];
        if (!cache) return false;
        const fp = this._softBodyFingerprint(profile);
        if (cache.fp && cache.fp !== fp) {
            delete this._softBodyCache[this.tab];
            return false;
        }
        bodyEl.className = cache.className;
        bodyEl.appendChild(cache.frag);
        delete this._softBodyCache[this.tab];
        return true;
    },

    _trySoftTabSwitch(profile, scrollState) {
        // syncNavZone swaps hs-nav-tabs/sub/content — do not require hs-nav-tabs.
        const content = this.overlay && (
            this.overlay.querySelector('.vf-browser-shell .home-station-content')
            || this.overlay.querySelector('.home-station-content')
        );
        if (!content) return false;
        const bodyEl = Array.from(content.children).find((el) => el.classList && el.classList.contains('hs-body'));
        if (!bodyEl) return false;

        const leavingTab = this._softBodyTab || null;
        // Fingerprint uses this.tab — compute for the tab we are parking.
        if (leavingTab && leavingTab !== 'play' && leavingTab !== 'menu' && leavingTab !== 'components') {
            const cur = this.tab;
            this.tab = leavingTab;
            this._softBodyParkFp = this._softBodyFingerprint(profile);
            this.tab = cur;
        } else {
            this._softBodyParkFp = '';
        }

        this.unmountMenuTab();
        this.unmountPlayTab();
        this.unmountComponentsTab();
        // Same-tab rerender (e.g. hangar SHIPS/PARTS/SLOTS): never restore the stale
        // parked DOM, rebuild the body so the new state shows.
        if (leavingTab === this.tab) {
            if (this._softBodyCache) delete this._softBodyCache[this.tab];
        } else {
            // Park leaving body DOM (keeps listeners) before wiping.
            this._parkSoftBody(bodyEl, leavingTab);
        }

        const cacheHit = this._restoreSoftBody(bodyEl, profile);
        let hideTabsForTutorial = false;
        if (typeof profileManager !== 'undefined' && profileManager.hasClearedFirstPlanet) {
            hideTabsForTutorial = !profileManager.hasClearedFirstPlanet(profile);
        }
        const isPlay = this.tab === 'play';
        const isMenu = this.tab === 'menu';
        const isComp = this.tab === 'components';
        if (!cacheHit) {
            const built = this._buildTabBody(profile);
            const { body, bodyClass } = built;
            hideTabsForTutorial = built.hideTabsForTutorial;
            bodyEl.className = bodyClass;
            bodyEl.innerHTML = body;
        }
        const undimmedTabs = ['hangar', 'shop', 'upgrade', 'missions', 'craft', 'travel', 'explorations', 'factions', 'ffleet', 'ftrade', 'fcontracts'];

        Array.from(content.classList).filter((c) => c.indexOf('hs-mode-') === 0).forEach((c) => content.classList.remove(c));
        if (this.tab === 'station') content.classList.add('hs-mode-station');
        if (isPlay) content.classList.add('hs-mode-play');
        if (isMenu || this.isMenuRowTab()) content.classList.add('hs-mode-menu');
        if (isComp) content.classList.add('hs-mode-components');
        if (undimmedTabs.indexOf(this.tab) !== -1) content.classList.add('hs-mode-' + this.tab);

        const tabsWrap = content.querySelector('.hs-tabs');
        if (tabsWrap) tabsWrap.classList.toggle('hs-tabs-hidden', !!hideTabsForTutorial);
        this._syncTabsUnlockReveal(tabsWrap, hideTabsForTutorial);

        // Sync active classes in place — full renderTabs()/subnav rebuild was costly.
        const subRebound = this._syncSoftNavChrome(content, bodyEl, hideTabsForTutorial);

        const playBtn = content.querySelector('[data-play-launch]');
        if (playBtn) {
            playBtn.classList.toggle('active', this.tab === 'play');
            playBtn.classList.toggle('holo-on', this.holoJustOn('play', this.tab === 'play'));
        }

        // Fresh body needs binds; cache hit already has listeners on parked nodes.
        if (!cacheHit) this._bindSoftBodyChrome(bodyEl);
        if (subRebound) {
            const sub = content.querySelector(':scope > .hs-subnav');
            if (sub) this._bindSoftTabButtons(sub);
        }
        this._finishTabMount(scrollState, { bindChrome: false, soft: true, bodyCached: cacheHit });
        this._softBodyTab = this.tab;

        return true;
    },

    /** Update area/subnav active state; rebuild subnav only when the area changes. */
    _syncSoftNavChrome(content, bodyEl, hideTabsForTutorial) {
        if (hideTabsForTutorial) return false;
        const activeArea = this.getTabArea(this.tab);
        const areaId = activeArea ? activeArea.id
            : (this.isMenuRowTab() ? 'menu' : (this.tab === 'play' ? 'play' : null));

        content.querySelectorAll('.hs-area-btn[data-area]').forEach((btn) => {
            const on = !!(activeArea && btn.getAttribute('data-area') === activeArea.id);
            btn.classList.toggle('active', on);
            btn.classList.remove('hs-anim-activate', 'holo-on', 'hs-anim-from-left', 'hs-anim-from-right');
        });
        content.querySelectorAll('.hs-home-btn[data-tab="station"]').forEach((btn) => {
            btn.classList.toggle('active', this.tab === 'station');
        });

        const areaChanged = this._softAreaId !== areaId;
        this._softAreaId = areaId;
        if (!areaChanged) {
            content.querySelectorAll('.hs-subnav [data-tab]').forEach((btn) => {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === this.tab);
            });
            return false;
        }

        content.querySelectorAll(':scope > .hs-subnav').forEach((el) => el.remove());
        const subHtml = this.renderAreaSubnav();
        if (subHtml) {
            const tmp = document.createElement('div');
            tmp.innerHTML = subHtml;
            const subEl = tmp.firstElementChild;
            if (subEl) content.insertBefore(subEl, bodyEl);
        }
        return true;
    },

    _bindSoftTabButtons(scope) {
        if (!scope) return;
        scope.querySelectorAll('[data-tab]').forEach((btn) => {
            if (btn.dataset.vfSoftBound === '1') return;
            btn.dataset.vfSoftBound = '1';
            btn.addEventListener('click', () => {
                const next = btn.getAttribute('data-tab') || 'station';
                if (this.tab === 'menu' && next !== 'menu') {
                    this.unmountMenuTab();
                    this._menuOpts = null;
                    this._prevTab = null;
                }
                this.tab = next;
                this._resBuyModal = null;
                this.statusMsg = '';
                this.focusIndex = 0;
                this._navLevel = 'tabs';
                this.persistTab();
                this.createUI();
            });
        });
        // Menu sub-nav (SETTINGS / LAYOUT / CREDITS …) is rebuilt on a soft switch too.
        scope.querySelectorAll('[data-menu-tab]').forEach((btn) => {
            if (btn.dataset.vfSoftBound === '1') return;
            btn.dataset.vfSoftBound = '1';
            btn.addEventListener('click', () => {
                this.openMainMenuOverlay({ tab: btn.getAttribute('data-menu-tab') });
            });
        });
    },

    _bindSoftBodyChrome(bodyEl) {
        if (!bodyEl) return;
        bodyEl.querySelectorAll('[data-explore]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.openExploration(btn.getAttribute('data-explore'));
            });
        });
        bodyEl.querySelectorAll('[data-tab]').forEach((btn) => {
            if (btn.dataset.vfSoftBound === '1') return;
            btn.dataset.vfSoftBound = '1';
            btn.addEventListener('click', () => {
                this.tab = btn.getAttribute('data-tab') || 'station';
                this._resBuyModal = null;
                this.statusMsg = '';
                this.focusIndex = 0;
                this._navLevel = 'tabs';
                this.persistTab();
                this.createUI();
            });
        });
    },

    /** Shared post-body mount: hangar/play/menu + focus/scroll. */
    _finishTabMount(scrollState, opts) {
        const soft = !!(opts && opts.soft);
        const bindChrome = !!(opts && opts.bindChrome);
        if (bindChrome) {
            this.bindEvents();
            const playBtn = this.overlay.querySelector('.hs-header-split > [data-play-launch]');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.launchPlay();
                });
            }
            this.bindMissionButton();
            this.bindControlsToggle();
            this.bindStationColumnResize();
            this.syncTopbarResLayout();
            this.overlay.querySelectorAll('[data-open-menu]').forEach((menuBtn) => {
                menuBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openMainMenuOverlay(this.menuButtonOpts(menuBtn));
                });
            });
        } else {
            // Soft path: only bind handlers the active tab's body needs.
            // Cached body DOM already has listeners from the prior visit.
            const t = this.tab;
            if (!(opts && opts.bodyCached)) {
                if (t === 'shop' || t === 'upgrade' || t === 'craft' || t === 'travel') this.bindShopEvents();
                // The station upgrade tree lives on the UPGRADE tab: its nodes need these handlers (tooltips, select, buy).
                if (t === 'station' || t === 'shop' || t === 'craft' || t === 'upgrade') this.bindStationEvents();
                if (t === 'hangar') this.bindHangarTabEvents();
            }
            this.bindKeyNav();
        }
        this.moveHangarBayTools();
        if (this.statusMsg) {
            this.showStatusToast(this.statusMsg);
            this.statusMsg = '';
        }
        if (['factions', 'ffleet', 'ftrade', 'fcontracts'].indexOf(this.tab) !== -1) this.bindFactionEvents();
        this.restoreScrollState(scrollState);
        this.applyPendingFlash();
        // Soft: defer focus walk + hint (was ~15–22ms) so body paints first.
        if (soft) {
            requestAnimationFrame(() => {
                this.restoreNavFocus();
                if (this._focusExplore) {
                    this.focusExploreItem(this._focusExplore);
                    this._focusExplore = null;
                }
                this.syncNavHint();
            });
        } else {
            this.restoreNavFocus();
            if (this._focusExplore) {
                this.focusExploreItem(this._focusExplore);
                this._focusExplore = null;
            }
            this.syncNavHint();
        }
        if (this.tab === 'hangar') {
            this.setupHangarPanelResize();
            // Soft: hangar canvas draw was ~30–65ms on the click path.
            // Left-panel tabs (SHIPS / PARTS / SLOTS) bind right away so they
            // work even when the deferred frame is late or the draw throws.
            if (soft) {
                this.bindHangarPartsGrid();
                requestAnimationFrame(() => {
                    this.startHangarPreview();
                    this.drawHangarBay();
                    this.bindHangarSlotEvents();
                });
            } else {
                this.startHangarPreview();
                this.drawHangarBay();
                this.bindHangarSlotEvents();
                this.bindHangarPartsGrid();
            }
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
        if (this.tab === 'menu') this.mountMenuTab(this._menuOpts);
        if (this.tab === 'components') this.mountComponentsTab();
        // Soft: defer ship thumbs + skip parallax (shell/bg unchanged) so the tab paints first.
        if (soft && this.tab === 'play') {
            /* play body has no ship thumbs */
        } else if (soft) {
            requestAnimationFrame(() => {
                this.scheduleShipThumbs();
                this.bindShipSelectButtons();
            });
        } else {
            this.scheduleShipThumbs();
            this.bindShipSelectButtons();
            if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
                VFBgMouseParallax.refresh();
            }
        }
        if (soft) {
            requestAnimationFrame(() => this.syncTabDrop());
        } else {
            this.syncTabDrop();
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
        if (this.tab === 'menu') {
            this.unmountMenuTab();
            this._menuOpts = null;
            this._prevTab = null;
        }
        this.tab = 'play';
        this._navLevel = 'tabs';
        this._travelModal = false;
        this.statusMsg = '';
        this.focusIndex = 0;
        this.persistTab();
        this.createUI();
        requestAnimationFrame(() => this.enterPlayMap());
    },

    renderPlayTab(profile) {
        return `<div class="hs-play-shell" id="hsPlayMount" data-nav-section="play"></div>`;
    },

    /**
     * Top bar too narrow for tabs + resources: the numbers first fold into a
     * compact grid, and only when that still doesn't fit move to their own
     * strip above the nav bar instead of squeezing the tabs.
     */
    /**
     * Index-card tabs: the active main tab's body runs down into the sub-nav.
     * CSS needs the exact gap between the two (--hs-tab-drop) so the tab's
     * side lines meet the sub-nav's border and cover it just under the tab.
     */
    syncTabDrop() {
        // The tab rows clip overflow, so the bridge between the active main
        // tab and the sub-nav is its own element on the station window.
        const measure = () => {
            const root = this.overlay && this.overlay.querySelector('.home-station-content');
            if (!root || !root.isConnected) return;
            let bridge = root.querySelector(':scope > .hs-tab-bridge');
            const btn = root.querySelector('.hs-area-btn.active');
            let sub = root.querySelector('.hs-subnav');
            // No sub-nav (e.g. PROFILES): the card opens into the body box.
            const bodyBox = sub ? null : (root.querySelector('.hs-body .start-screen-content-embedded, .hs-body .hs-components-root') || root.querySelector('.hs-body'));
            if (!sub && bodyBox) sub = bodyBox;
            if (!btn || !sub) {
                if (bridge) bridge.remove();
                return;
            }
            if (!bridge) {
                bridge = document.createElement('div');
                bridge.className = 'hs-tab-bridge';
                bridge.setAttribute('aria-hidden', 'true');
                root.appendChild(bridge);
            }
            bridge.classList.toggle('is-body-bridge', !!bodyBox);
            const r = root.getBoundingClientRect();
            const b = btn.getBoundingClientRect();
            const s = sub.getBoundingClientRect();
            // From the tab's top edge to 2 px into the sub-nav (over its top
            // line): one outline for tab + bridge; only the part below the
            // tab is filled, the tab itself stays visible through it.
            // Breathing room between the tab's label and its outline.
            const pad = 0;
            // Rects are visual px; the bridge lives in zoomed CSS px.
            const z = window.vfEffectiveZoom ? window.vfEffectiveZoom(root) : 1;
            const top = (b.top - r.top) / z - pad;
            bridge.style.setProperty('--tab-h', Math.round(b.height / z + pad) + 'px');
            bridge.style.left = Math.round((b.left - r.left) / z - pad) + 'px';
            bridge.style.width = Math.round(b.width / z + 2 * pad) + 'px';
            bridge.style.top = Math.round(top) + 'px';
            bridge.style.height = Math.max(0, Math.round((s.top - r.top) / z + 2 - top)) + 'px';
            // Sub-nav top line has a gap right under the active tab.
            if (bodyBox) return;
            sub.style.setProperty('--hs-gap-l', Math.round((b.left - s.left) / z + 2) + 'px');
            sub.style.setProperty('--hs-gap-r', Math.round((b.right - s.left) / z - 2) + 'px');
        };
        measure();
        requestAnimationFrame(measure);
        if (!this._tabDropResizeBound) {
            this._tabDropResizeBound = true;
            window.addEventListener('resize', () => requestAnimationFrame(measure));
        }
    },

    syncTopbarResLayout() {
        const bar = this.overlay && this.overlay.querySelector('.hs-topbar');
        if (!bar || !bar.querySelector('.hs-topbar-res')) return;
        const check = () => {
            if (!bar.isConnected) return;
            // 1) one row  2) compact grid (2 rows) beside the tabs  3) own strip above.
            bar.classList.remove('is-res-stacked', 'is-res-grid');
            const tabs = bar.querySelector('.hs-tabs');
            const tight = () => bar.scrollWidth > bar.clientWidth + 1
                || !!(tabs && tabs.scrollWidth > tabs.clientWidth + 1);
            if (!tight()) return;
            bar.classList.add('is-res-grid');
            if (!tight()) return;
            bar.classList.remove('is-res-grid');
            bar.classList.add('is-res-stacked');
        };
        check();
        requestAnimationFrame(check);
        if (this._topbarResObserver) this._topbarResObserver.disconnect();
        if (typeof ResizeObserver !== 'undefined') {
            // React to width changes only: the layout switch itself changes
            // the height, which must not re-trigger the check (feedback loop).
            let busy = false;
            let lastW = -1;
            this._topbarResObserver = new ResizeObserver((entries) => {
                const w = Math.round(entries[0] && entries[0].contentRect ? entries[0].contentRect.width : 0);
                if (busy || w === lastW) return;
                lastW = w;
                busy = true;
                requestAnimationFrame(() => { check(); busy = false; });
            });
            this._topbarResObserver.observe(bar.parentElement || bar);
        }
    },
});

// Mission icon right of the navbar (all sections): the invasion / mission text only shows as a hover tooltip.
extendClass(HomeStationUI, {
    renderMissionButton() {
        const gm = typeof galaxyMapManager !== 'undefined' ? galaxyMapManager : null;
        const info = gm && gm.getSituationInfo ? gm.getSituationInfo() : null;
        const sit = info && info.sit;
        const calm = !sit || sit.kind === 'NO ACTIVE MISSION';
        const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
        const who = sit && sit.attacker ? String(sit.attacker).toUpperCase() : '';
        const head = !sit ? 'NO ACTIVE MISSION'
            : (sit.kind === 'INVASION' || sit.kind === 'ALLY UNDER ATTACK') ? `${who} ATTACKS ${sit.planet}`
            : (sit.kind === 'ACTIVE MISSION') ? `${sit.mission} · ${sit.planet}` : sit.kind;
        const tip = esc(sit ? head + ' — ' + sit.objective : 'NO ACTIVE MISSION — TAKE ONE AT THE HANGAR MISSION BOARD');
        const accent = info && info.accent ? info.accent : 'var(--color-primary)';
        return `<button type="button" class="hs-logout-btn hs-mission-btn${calm ? ' is-calm' : ''}" id="hsMissionBtn" style="--mission-accent:${accent}" ` +
            `data-ui-tip="${tip}" aria-label="Mission" data-nav-item>` +
            `<span class="hs-logout-icon" aria-hidden="true">${this.iconHtml('navScroll', 32, 'hs-tab-pixel', false)}</span></button>`;
    },
    bindMissionButton() {
        const btn = this.overlay && this.overlay.querySelector('#hsMissionBtn');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const gm = typeof galaxyMapManager !== 'undefined' ? galaxyMapManager : null;
            const info = gm && gm.getSituationInfo ? gm.getSituationInfo() : null;
            if (info && info.sit && gm.openSituationModal) gm.openSituationModal(info.sit);
        });
    }
});
