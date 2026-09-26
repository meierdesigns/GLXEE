"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    bindControlsToggle() {
        if (!this.overlay) return;
        const hideBtn = this.overlay.querySelector('#hsHideControls');
        const showBtn = this.overlay.querySelector('#hsShowControls');
        if (hideBtn) {
            hideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof uiAppearanceManager !== 'undefined') {
                    uiAppearanceManager.setControlsHints('OFF');
                }
            });
        }
        if (showBtn) {
            showBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof uiAppearanceManager !== 'undefined') {
                    uiAppearanceManager.setControlsHints('ON');
                }
            });
        }
    },

    playButtonResult(btn, ok, msg) {
        const target = this.captureFlashTarget(btn);
        if (target) {
            target.ok = !!ok;
            this._pendingFlash = target;
        }
        this.setStatus(msg);
    },

    /**
     * Two tab groups: game tabs (left) and menu tabs (right: profiles,
     * settings, assets, credits). ←/→ stay inside the current group;
     * ESC on the tab row toggles between the groups.
     */
    getTabCycle() {
        if (this.isMenuRowTab()) {
            return this.getMenuRowTabs().map((t) => 'menu:' + t.id).concat(['logout']);
        }
        return this._tabs.filter((id) => this._menuOnlyTabs.indexOf(id) === -1);
    },

    /** True while the menu tab row owns ←/→ (menu or a menu-only tab). */
    isMenuRowTab() {
        return this.tab === 'menu' || this._menuOnlyTabs.indexOf(this.tab) !== -1;
    },

    currentTabKey() {
        const list = this.getFocusables();
        const focused = list[this.focusIndex];
        if (focused && focused.id === 'hsLogout') return 'logout';
        if (this.tab === 'menu' && typeof startScreenManager !== 'undefined') {
            return 'menu:' + startScreenManager.embeddedMenuTab;
        }
        if (this._menuOnlyTabs.indexOf(this.tab) !== -1) return 'menu:' + this.tab;
        return this.tab;
    },

    switchTab(dir) {
        const cycle = this.getTabCycle();
        let idx = cycle.indexOf(this.currentTabKey());
        if (idx < 0) idx = 0;
        const nextKey = cycle[(idx + dir + cycle.length) % cycle.length];
        if (nextKey === 'logout') {
            // Logout is a tab-row stop, not a tab: just move focus onto it.
            const list = this.getFocusables();
            const btn = this.overlay && this.overlay.querySelector('#hsLogout');
            const i = btn ? list.indexOf(btn) : -1;
            if (i >= 0) {
                this.focusIndex = i;
                this.refreshFocus();
            }
            return;
        }
        this.statusMsg = '';
        this.focusIndex = 0;
        this._navLevel = 'tabs';
        this._menuArmed = false;
        if (nextKey.indexOf('menu:') === 0 && this._menuOnlyTabs.indexOf(nextKey.slice(5)) !== -1) {
            this.openMenuOnlyTab(nextKey.slice(5));
            return;
        }
        if (nextKey.indexOf('menu:') === 0) {
            // Show the menu tab but stay in the tab row — ENTER goes inside.
            const menuTab = nextKey.slice(5);
            if (this._menuOnlyTabs.indexOf(this.tab) !== -1) this.unmountComponentsTab();
            if (this.tab !== 'menu') this._prevTab = this.tab;
            this.tab = 'menu';
            if (typeof startScreenManager !== 'undefined') startScreenManager.embeddedMenuTab = menuTab;
            this._menuOpts = { tab: menuTab, showSettings: false, showCredits: false, resetPanels: false };
            this.createUI();
            this.focusActiveTab();
            return;
        }
        if (this.tab === 'menu') {
            this.unmountMenuTab();
            this._menuOpts = null;
            this._prevTab = null;
        }
        this.tab = nextKey;
        this.persistTab();
        this.createUI();
    },

    /** ENTER/SPACE on the menu tab: hand keyboard to the embedded menu. */
    enterMenuContent() {
        this._menuArmed = true;
        this._navLevel = 'content';
        const list = this.getFocusables();
        list.forEach((el) => el.classList.remove('nav-focused'));
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (typeof startScreenManager !== 'undefined') {
            if (startScreenManager.showSettings) {
                if (startScreenManager.updateMenuSelection) startScreenManager.updateMenuSelection();
            } else if (startScreenManager.focusEmbeddedButtons) {
                // Assets / profiles / credits: land on the first button.
                startScreenManager.focusEmbeddedButtons();
            }
        }
        this.syncNavHint && this.syncNavHint();
    },

    /** ESC inside the embedded menu: back up to the tab row. */
    exitMenuContent() {
        this._menuArmed = false;
        this._navLevel = 'tabs';
        this.focusActiveTab();
        this.syncNavHint && this.syncNavHint();
    },

    activateFocused() {
        const list = this.getFocusables();
        const el = list[this.focusIndex];
        if (el) el.click();
    },

    isMainTabChrome(el) {
        return !!(el && el.hasAttribute && el.hasAttribute('data-tab'));
    },

    findFirstBodyFocusable(list) {
        return this.findFirstContentFocusable(list);
    },

    scrollFocusedIntoView() {
        const list = this.getFocusables();
        const el = list[this.focusIndex];
        if (!el || typeof el.scrollIntoView !== 'function') return;
        try {
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch (err) {
            el.scrollIntoView();
        }
    },

    moveStationFocus(direction) {
        const all = this.getFocusables();
        if (!all.length) return;
        const zone = this.getZoneFocusables();
        if (!zone.length) return;

        const focused = all[this.focusIndex];
        let zoneIdx = zone.indexOf(focused);
        if (zoneIdx < 0) zoneIdx = 0;

        if (typeof menuNavHelper !== 'undefined' && menuNavHelper.moveFocusSpatial) {
            const nextZone = menuNavHelper.moveFocusSpatial(zone, zoneIdx, direction);
            if (nextZone !== zoneIdx) {
                this.focusIndex = all.indexOf(zone[nextZone]);
                this.refreshFocus();
                this.scrollFocusedIntoView();
                this.syncNavHint();
                return;
            }
            return;
        }

        const delta = (direction === 'up' || direction === 'left') ? -1 : 1;
        const nextZone = Math.max(0, Math.min(zone.length - 1, zoneIdx + delta));
        this.focusIndex = all.indexOf(zone[nextZone]);
        this.refreshFocus();
        this.scrollFocusedIntoView();
        this.syncNavHint();
    },

    bindKeyNav() {
        this._keyHandler = (e) => {
            if (!this.isVisible) return;
            if (typeof hangarTestArena !== 'undefined' && hangarTestArena.isVisible) return;
            // Profile overlay on top of the station owns the keyboard.
            if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.isVisible) return;
            if (this.overlay) {
                const root = this.overlay.querySelector('.home-station-content');
                if (root) root.classList.remove('hs-pointer-mode');
            }
            // Main menu (embedded tab or legacy overlay) owns keyboard while open.
            // Embedded menu only owns the keys after ENTER/SPACE entered it;
            // until then its tabs sit in the station tab row like any other tab.
            if (typeof startScreenManager !== 'undefined' &&
                (startScreenManager.isOverlayOpen() ||
                    (startScreenManager.isEmbeddedOpen() && this._menuArmed))) {
                return;
            }
            const playMapMounted = this.tab === 'play' &&
                typeof galaxyMapManager !== 'undefined' &&
                galaxyMapManager.isVisible &&
                galaxyMapManager._mountEl;
            const playMapActive = playMapMounted && this.isPlayMapActive();
            if (playMapMounted && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                e.stopPropagation();
                if (!playMapActive) {
                    this.enterPlayMap();
                    return;
                }
                galaxyMapManager.confirm('resume');
                return;
            }
            if (playMapActive) {
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.exitPlayMap();
                    return;
                }
                // Arrows move the map cursor; D docks at a trading post —
                // both handled by the galaxy map's own key handler.
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                    e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                    e.key === 'd' || e.key === 'D') {
                    return;
                }
            }
            const tag = e.target && e.target.tagName;
            if (typeof menuNavHelper !== 'undefined' && menuNavHelper.isTextEntry) {
                if (menuNavHelper.isTextEntry(e.target)) return;
                // Sliders keep ←/→ for their value; ↑/↓ still move focus.
                if (tag === 'INPUT' && e.target.type === 'range' &&
                    !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
            } else if (tag === 'INPUT' || tag === 'TEXTAREA') {
                return;
            }

            if (e.shiftKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                if (typeof startScreenManager !== 'undefined') {
                    startScreenManager.toggleDevMode();
                    this.statusMsg = startScreenManager.devMode ? 'DEV MODE ON' : 'DEV MODE OFF';
                    this.createUI();
                }
                return;
            }
            if (e.shiftKey && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                if (typeof uiAppearanceManager !== 'undefined') {
                    uiAppearanceManager.toggleControlsHints();
                }
                return;
            }
            if (e.key === 'Escape' || e.key === 'Backspace') {
                if (this._resBuyModal) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeResourceBuyModal();
                    return;
                }
                // Component editor ship preview fullscreen — close preview only
                if (typeof componentEditorUI !== 'undefined' && componentEditorUI._previewFs) {
                    e.preventDefault();
                    e.stopPropagation();
                    componentEditorUI.leavePreviewFullscreen();
                    return;
                }
                // Esc climbs nav levels: content → section → tabs → menu
                if (this.isContentNavActive()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.exitTabContent();
                    return;
                }
                // On tab bar: ESC toggles game tabs ↔ menu tabs
                e.preventDefault();
                this.openMainMenuOverlay();
                this._navLevel = 'tabs';
                this.focusActiveTab();
                return;
            }
            // Shift+Enter skips the section level and jumps straight into content.
            if (e.shiftKey && (e.key === 'Enter' || e.key === ' ') &&
                !this._resBuyModal && this.tab !== 'play' && this.tab !== 'menu' &&
                this.getNavLevel() !== 'content') {
                e.preventDefault();
                this._navLevel = 'sub';
                this.enterTabContent();
                return;
            }
            // Shift+←/→ always cycle main tabs (except resource-buy modal).
            if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                if (this._resBuyModal) {
                    e.preventDefault();
                    return;
                }
                e.preventDefault();
                this._navLevel = 'tabs';
                this.switchTab(e.key === 'ArrowLeft' ? -1 : 1);
                return;
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const level = this.getNavLevel();
                // Main tabs: ←/→ switch sections
                if (!this._resBuyModal && level === 'tabs' &&
                    (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                    this.switchTab(e.key === 'ArrowLeft' ? -1 : 1);
                    return;
                }
                // Sub-tabs: ←/→ switch shop/upgrade categories
                if (!this._resBuyModal && level === 'sub' &&
                    (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                    this.switchSubTab(e.key === 'ArrowLeft' ? -1 : 1);
                    return;
                }
                const dir = e.key === 'ArrowLeft' ? 'left'
                    : e.key === 'ArrowRight' ? 'right'
                        : e.key === 'ArrowUp' ? 'up' : 'down';
                this.moveStationFocus(dir);
                return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                const level = this.getNavLevel();
                // Tab bar / section tabs: Enter goes one level deeper
                if (!this._resBuyModal && (level === 'tabs' || level === 'sub')) {
                    e.preventDefault();
                    const list = this.getFocusables();
                    const focused = list[this.focusIndex];
                    const menuTabId = focused && focused.getAttribute && focused.getAttribute('data-menu-tab');
                    const shownMenuTab = (this.tab === 'menu' && typeof startScreenManager !== 'undefined')
                        ? startScreenManager.embeddedMenuTab : null;
                    // Menu tab row: ENTER goes into the shown section (unless a
                    // different, not-yet-shown menu tab is focused).
                    if (level === 'tabs' && focused && focused.id === 'hsLogout') {
                        this.logout();
                        return;
                    }
                    if (level === 'tabs' && menuTabId && menuTabId === this.tab) {
                        this.enterTabContent();
                        return;
                    }
                    if (level === 'tabs' && this.tab === 'menu' && (!menuTabId || menuTabId === shownMenuTab)) {
                        this.enterMenuContent();
                        return;
                    }
                    if (level === 'tabs' && menuTabId) {
                        this.openMainMenuOverlay({ tab: menuTabId });
                        this.focusActiveTab();
                        return;
                    }
                    if (level === 'tabs' && this.isMenuChrome(focused)) {
                        this.openMainMenuOverlay();
                        return;
                    }
                    if (level === 'sub') {
                        if (focused && this.isSubTabEl(focused) &&
                            !focused.classList.contains('active')) {
                            this.activateFocused();
                            return;
                        }
                    }
                    this.enterTabContent();
                    return;
                }
                if (this.tab === 'play' && !playMapActive) {
                    e.preventDefault();
                    this.enterPlayMap();
                    return;
                }
                e.preventDefault();
                this.activateFocused();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    },

    bindEvents() {
        this.bindNavigationEvents();
        this.bindShopEvents();
        this.bindStationEvents();
        this.bindHangarTabEvents();
        this.bindKeyNav();
    },
});
