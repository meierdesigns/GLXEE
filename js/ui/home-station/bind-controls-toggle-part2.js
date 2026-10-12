"use strict";

// HomeStationUI members, continued from bind-controls-toggle.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
    bindKeyNav() {
        this._keyHandler = (e) => {
            if (!this.isVisible) return;
            // Embedded WIKI viewer owns the keyboard (its own ↑↓ / ESC).
            if (this._embeddedViewer) return;
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
            // SPACE with the map on screen jumps straight into it, skipping
            // the nav rows (ENTER still steps through them one level at a time).
            if (playMapMounted && !playMapActive && e.key === ' ' && !this._resBuyModal) {
                e.preventDefault();
                e.stopPropagation();
                this.enterPlayMap();
                return;
            }
            // ENTER / SPACE in a nav row goes exactly one level deeper
            // (area row → its sub-nav → content / map / menu section).
            if ((e.key === 'Enter' || e.key === ' ') && !playMapActive && !this._resBuyModal
                && this.enterOneNavLevel()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (playMapMounted && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                e.stopPropagation();
                if (!playMapActive) {
                    this.enterPlayMap();
                    return;
                }
                // First press focuses the start button, the next one starts.
                galaxyMapManager.confirmKey();
                return;
            }
            if (playMapActive) {
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (galaxyMapManager.hasActionFocus()) {
                        galaxyMapManager.clearActionFocus();
                        return;
                    }
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
                    this.statusMsg = startScreenManager.devMode
                        ? 'DEV MODE ON — COMPONENTS + LAYOUT UNLOCKED' : 'DEV MODE OFF';
                    // Leaving dev mode keeps an open dev tab open; it vanishes
                    // from the rows once you navigate away.
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
                // Esc climbs exactly one level, decided by what is focused (the
                // stored nav level can be stale after mouse use).
                if (this.escapeOneNavLevel()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                // Esc only climbs nav levels: content → section → sub-nav → area row.
                if (this.isContentNavActive()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.exitTabContent();
                    return;
                }
                // In the area sub-nav row: ESC climbs to the area row first.
                if (this.getFocusedNavRow() === 'subnav') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.focusNavRow('area');
                    return;
                }
                // On tab bar: ESC swaps the left (game) tab row for the right
                // (menu) tab row and back — nothing else.
                e.preventDefault();
                if (this.isMenuRowTab()) {
                    const back = this._lastGameTab || 'station';
                    if (this.tab === 'menu') this.unmountMenuTab();
                    else this.unmountComponentsTab();
                    this._menuOpts = null;
                    this._prevTab = null;
                    this._menuArmed = false;
                    this.statusMsg = '';
                    this.focusIndex = 0;
                    this.tab = back;
                    this.persistTab();
                    this.createUI();
                } else {
                    // Top of the hierarchy: ESC in the area row opens the menu
                    // (its tabs appear as the sub-nav row below the areas).
                    if (this.getFocusedNavRow() !== 'area') {
                        this._navLevel = 'tabs';
                        if (!this.focusNavRow || !this.focusNavRow('area')) this.focusActiveTab();
                        return;
                    }
                    this._lastGameTab = this.tab;
                    this.openMainMenuOverlay({ force: true });
                    return;
                }
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
                // Area row ↔ sub-nav row ↔ content (see handleNavRowArrow).
                if (!this._resBuyModal && level === 'tabs' && this.handleNavRowArrow(e.key)) return;
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
                // Section tabs (e.g. RESOURCES / PARTS / PORTALS): ↓ into the
                // content, ↑ back up to the tab rows.
                if (!this._resBuyModal && level === 'sub' && e.key === 'ArrowDown') {
                    if (this.tab !== 'play') this.enterTabContent();
                    return;
                }
                if (!this._resBuyModal && level === 'sub' && e.key === 'ArrowUp') {
                    this.exitTabContent();
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
                    if (level === 'tabs' && focused && focused.hasAttribute && focused.hasAttribute('data-open-menu')) {
                        this.openMainMenuOverlay(this.menuButtonOpts(focused));
                        return;
                    }
                    if (focused && focused.hasAttribute && focused.hasAttribute('data-play-launch')) {
                        this.launchPlay();
                        return;
                    }
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
