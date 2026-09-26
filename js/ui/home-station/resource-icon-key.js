"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    resourceIconKey(id) {
        const map = {
            credits: 'menuCredits',
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        return map[id] || 'resScrap';
    },

    panelTitle(iconKey, label) {
        return `<h3 class="hs-panel-title">` +
            `<span class="hs-panel-icon">${this.iconHtml(iconKey, 32, 'hs-pixel')}</span>` +
            `<span class="hs-panel-label">${label}</span>` +
            `<span class="hs-panel-scan" aria-hidden="true"></span>` +
            `</h3>`;
    },

    renderTabs() {
        const mainTabs = this._tabs.filter((id) => this._menuOnlyTabs.indexOf(id) === -1);
        const order = (typeof MENU_ORDER !== 'undefined') ? MENU_ORDER.main.slice() : mainTabs;
        if (order.indexOf('station') === -1) order.unshift('station');
        // data-order-index points into MENU_ORDER.main so dev-mode dragging can
        // move tabs and '|' dividers alike.
        const items = [];
        order.forEach((id, i) => {
            if (id === '|' || mainTabs.indexOf(id) !== -1) items.push({ id: id, i: i });
        });
        return items.map(({ id, i }) => {
            if (id === '|') {
                return `<span class="hs-tab-divider" data-order-index="${i}" aria-hidden="true"></span>`;
            }
            const active = this.tab === id;
            if (id === 'station') {
                return `<button type="button" class="hs-home-btn ${active ? 'active' : ''}" data-tab="station" data-order-index="${i}" data-nav-item title="Home Station">` +
                    `<span class="hs-home-icon">${this.iconHtml('hsStation', 32, 'hs-pixel hs-pixel-32')}</span>` +
                    `<span class="hs-home-text">HOME STATION</span>` +
                    `</button>`;
            }
            const meta = this._tabMeta[id] || { label: id.toUpperCase(), icon: '' };
            const playClass = id === 'play' ? ' hs-tab-play' : '';
            return `<button type="button" class="hs-tab${playClass} ${active ? 'active' : ''}" data-tab="${id}" data-order-index="${i}" data-nav-item title="${meta.label}">` +
                `<span class="hs-tab-icon">${this.tabIconHtml(meta.icon)}</span>` +
                `<span class="hs-tab-label">${meta.label}</span>` +
                `</button>`;
        }).join('');
    },

    show(options) {
        if (typeof profileManager !== 'undefined' && !profileManager.hasActiveProfile()) {
            if (typeof profileSelectionManager !== 'undefined') {
                profileSelectionManager.show({
                    onClose: () => {
                        if (profileManager.hasActiveProfile()) {
                            this.show(options);
                        } else if (typeof startScreenManager !== 'undefined') {
                            startScreenManager.show();
                        }
                    }
                });
            }
            return;
        }
        // In-game pause settings must not sit on top of station menus
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) settingsOverlay.classList.add('hidden');
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) pauseOverlay.classList.add('hidden');
        this.isVisible = true;
        this.onClose = options && options.onClose;
        if (this._mouseMoveHandler) {
            document.removeEventListener('mousemove', this._mouseMoveHandler);
        }
        this._mouseMoveHandler = () => {
            if (!this.isVisible || !this.overlay) return;
            const root = this.overlay.querySelector('.home-station-content');
            if (root) root.classList.add('hs-pointer-mode');
        };
        document.addEventListener('mousemove', this._mouseMoveHandler);
        const opts = options || {};
        const savedTab = opts.tab || (typeof menuStateManager !== 'undefined' && menuStateManager.get().tab);
        const savedState = (typeof menuStateManager !== 'undefined') ? menuStateManager.get() : {};
        const savedShopCat = opts.shopCategory || savedState.shopCategory;
        this.tab = this._tabs.includes(savedTab) ? savedTab : 'station';
        this.shopCategory = this._shopCategories.includes(savedShopCat) ? savedShopCat : 'resources';
        this.ensureShopCategory();
        const savedUpgradeSub = opts.upgradeSubTab || savedState.upgradeSubTab;
        this.upgradeSubTab = this._upgradeSubTabs.includes(savedUpgradeSub) ? savedUpgradeSub : 'station';
        this.applyShopPrefsForCategory(this.shopCategory, {
            filter: opts.shopFilter != null ? opts.shopFilter : savedState.shopFilter,
            sort: opts.shopSort != null ? opts.shopSort : savedState.shopSort,
            qty: opts.shopResourceQty != null ? opts.shopResourceQty : savedState.shopResourceQty
        });
        this.statusMsg = '';
        this.focusIndex = 0;
        this._focusExplore = opts.focusExplore || null;
        const savedMenuTab = opts.menuTab !== undefined ? opts.menuTab : (!opts.tab && savedState.menuTab);
        // Mission cargo lands in the station automatically; this also pulls
        // in anything left over from a run that hit the storage cap.
        if (typeof profileManager !== 'undefined' && profileManager.hasCargo && profileManager.hasCargo()) {
            profileManager.teleportCargoToStation();
        }
        this.createUI();
        if (savedMenuTab && typeof startScreenManager !== 'undefined'
            && startScreenManager.embeddedMenuTabs.some((t) => t.id === savedMenuTab)) {
            this.openMainMenuOverlay({ tab: savedMenuTab, skipPersist: true });
        }
        if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
            soundManager.startMenuMusic();
        }
        if (typeof menuStateManager !== 'undefined' && !opts.skipPersist) {
            this.persistTab();
        }
    },

    persistTab() {
        if (typeof menuStateManager === 'undefined') return;
        const tab = this.tab === 'menu'
            ? ((this._prevTab && this._prevTab !== 'menu') ? this._prevTab : 'station')
            : this.tab;
        this.captureShopPrefs();
        const extra = {
            tab: tab,
            // Open ESC-menu tab (profiles/settings/…) restored on reload.
            menuTab: (this.tab === 'menu' && typeof startScreenManager !== 'undefined')
                ? startScreenManager.embeddedMenuTab : null,
            shopCategory: this.shopCategory,
            upgradeSubTab: this.upgradeSubTab,
            shopFilter: this.shopFilter,
            shopSort: this.shopSort,
            shopResourceQty: this.shopResourceQty
        };
        if (typeof componentEditorUI !== 'undefined' && componentEditorUI.typeId) {
            extra.componentType = componentEditorUI.typeId;
            extra.componentId = componentEditorUI.selectedId || null;
        }
        menuStateManager.setScreen('home-station', extra);
    },

    loadShopPrefs() {
        try {
            const raw = localStorage.getItem('vf_hs_shop_prefs_v1');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            return {};
        }
    },

    saveShopPrefs() {
        try {
            localStorage.setItem('vf_hs_shop_prefs_v1', JSON.stringify(this._shopPrefs || {}));
        } catch (e) {
            /* ignore */
        }
    },

    captureShopPrefs(category) {
        const cat = category || this.shopCategory || 'ships';
        if (!this._shopPrefs || typeof this._shopPrefs !== 'object') this._shopPrefs = {};
        this._shopPrefs[cat] = {
            filter: this.shopFilter,
            sort: this.shopSort,
            qty: this.shopResourceQty
        };
        this.saveShopPrefs();
    },

    applyShopPrefsForCategory(category, override) {
        const cat = category || 'ships';
        const cached = (this._shopPrefs && this._shopPrefs[cat]) || {};
        const o = override || {};
        const defaultFilter = cat === 'resources' ? 'station' : 'all';
        this.shopFilter = (o.filter != null && o.filter !== '')
            ? o.filter
            : (cached.filter != null ? cached.filter : defaultFilter);
        this.shopSort = (o.sort != null && o.sort !== '')
            ? o.sort
            : (cached.sort != null ? cached.sort : 'name');
        const qtyRaw = (o.qty != null) ? o.qty : cached.qty;
        if (qtyRaw === 'all') this.shopResourceQty = 'all';
        else {
            const n = Math.round(Number(qtyRaw));
            this.shopResourceQty = (this._resourceQtyOptions && this._resourceQtyOptions.indexOf(n) !== -1)
                ? n
                : 1;
        }
    },

    hide() {
        this.isVisible = false;
        this.hideUpgradeTip();
        if (this._upgTipHost) {
            this._upgTipHost.remove();
            this._upgTipHost = null;
        }
        this.closeMenuTab(true);
        this.closeMainMenuOverlay();
        this.destroyHangarPanelResize();
        this.stopHangarPreview();
        // Cleanup HangarUI
        if (this.hangarUI) {
            this.hangarUI.destroy();
        }
        this.unmountPlayTab();
        if (typeof hangarTestArena !== 'undefined' && hangarTestArena.isVisible) {
            hangarTestArena.hide();
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this._mouseMoveHandler) {
            document.removeEventListener('mousemove', this._mouseMoveHandler);
            this._mouseMoveHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    },

    openHangarTestArea() {
        if (typeof hangarTestArena === 'undefined') return;
        this.stopHangarPreview();
        hangarTestArena.show({
            shipId: this.hangarShipId || 'player_scrap',
            onClose: () => {
                if (this.isVisible && this.tab === 'hangar') {
                    this.startHangarPreview();
                }
            }
        });
    },

    close() {
        if (typeof startScreenManager !== 'undefined' && startScreenManager.isOverlayOpen()) {
            startScreenManager.hideOverlay();
            return;
        }
        const hasProfile = typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();
        // Station is the hub while a profile is loaded — keep it open.
        if (hasProfile) return;

        const cb = this.onClose;
        this.onClose = null;
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
        if (typeof cb === 'function') {
            cb();
        } else if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show({ forceMenu: true });
        }
        this.hide();
    },

    logout() {
        this.closeMenuTab(true);
        this.hide();
        if (typeof profileManager !== 'undefined') profileManager.logout();
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show({ forceMenu: true });
        }
    },
});
