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

    switchTab(dir) {
        const idx = this._tabs.indexOf(this.tab);
        const next = (idx + dir + this._tabs.length) % this._tabs.length;
        this.tab = this._tabs[next];
        this.statusMsg = '';
        this.focusIndex = 0;
        this._navLevel = 'tabs';
        this.persistTab();
        this.createUI();
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
            if (this.overlay) {
                const root = this.overlay.querySelector('.home-station-content');
                if (root) root.classList.remove('hs-pointer-mode');
            }
            // Main menu (embedded tab or legacy overlay) owns keyboard while open.
            if (typeof startScreenManager !== 'undefined' &&
                (startScreenManager.isOverlayOpen() || startScreenManager.isEmbeddedOpen())) {
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
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                    e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    return;
                }
            }
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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
                // On tab bar: open menu tab
                e.preventDefault();
                this.openMainMenuOverlay();
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
