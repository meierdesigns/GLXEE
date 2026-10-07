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
        const scaleSlider = this.overlay.querySelector('#hsFrameUiScale');
        const scaleValue = this.overlay.querySelector('#hsFrameUiScaleValue');
        if (scaleSlider && typeof uiAppearanceManager !== 'undefined') {
            scaleSlider.addEventListener('input', () => {
                uiAppearanceManager.setUiScale(scaleSlider.value);
                if (scaleValue) scaleValue.textContent = `${uiAppearanceManager.uiScale}%`;
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

    /** Open options of a top-bar menu button (PROFILES opens the menu on its page). */
    menuButtonOpts(el) {
        const tab = el && el.getAttribute && el.getAttribute('data-menu-open-tab');
        return tab ? { force: true, tab: tab } : { force: true };
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
        if (!el) return;
        // Reachable but not usable (e.g. BUY you can't afford): clear deny.
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
            this.denyFocused(el);
            return;
        }
        el.click();
    },

    /** Deny feedback: shake + red flash on the element, reason toast, low beep. */
    denyFocused(el) {
        el.classList.remove('hs-deny');
        void el.offsetWidth;
        el.classList.add('hs-deny');
        setTimeout(() => el.classList.remove('hs-deny'), 450);
        const reason = el.getAttribute('data-deny-reason') || el.getAttribute('title') || 'NOT AVAILABLE';
        if (this.showStatusToast) {
            this.showStatusToast(String(reason).toUpperCase());
            const toast = document.getElementById('hsStatusToast');
            if (toast) toast.classList.add('hs-status-fail');
        }
        if (typeof soundManager !== 'undefined' && soundManager.createBeep) {
            soundManager.createBeep(140, 0.12, 'square', 0.25);
        }
    },

    isMainTabChrome(el) {
        // The MENU area button has no data-tab but is tab-row chrome too
        // (otherwise ↓ into content landed on it as the "first content" item).
        // PLAY launch too: it has no data-tab, but must never count as content.
        return !!(el && el.hasAttribute && (el.hasAttribute('data-tab') || el.hasAttribute('data-open-menu') ||
            el.hasAttribute('data-play-launch')));
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
        if (!zone.length) {
            // Content with nothing focusable (e.g. the TRAVEL list): ↑ still
            // climbs one level (to the section tabs / sub-nav row).
            if (direction === 'up' && this.getNavLevel() !== 'tabs') {
                if (!this.escapeOneNavLevel()) this.exitTabContent();
            }
            return;
        }

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
            // Nothing above at the top edge of the content: one level up
            // (content → section tabs → sub-nav → area row).
            if (direction === 'up' && this.getNavLevel() !== 'tabs') this.exitTabContent();
            return;
        }

        const delta = (direction === 'up' || direction === 'left') ? -1 : 1;
        if (direction === 'up' && zoneIdx === 0 && this.getNavLevel() !== 'tabs') {
            this.exitTabContent();
            return;
        }
        const nextZone = Math.max(0, Math.min(zone.length - 1, zoneIdx + delta));
        this.focusIndex = all.indexOf(zone[nextZone]);
        this.refreshFocus();
        this.scrollFocusedIntoView();
        this.syncNavHint();
    },

    /**
     * ESC one level up from the focused element: content → section tabs
     * (or sub-nav) → sub-nav → area row. Returns false when already at the
     * area row (or nothing is focused), so the caller's fallbacks run.
     */
    escapeOneNavLevel() {
        const el = this.getFocusables()[this.focusIndex];
        if (!el || this.tab === 'menu') return false;
        const row = this.getFocusedNavRow();
        const hasSubnav = !!(this.overlay && this.overlay.querySelector('.hs-subnav-tab'));
        // In the content but nothing there could take the focus (e.g. the
        // TRAVEL list has no buttons), so the focus still sits on a tab: ESC
        // leaves the content — to the section tabs, else the sub-nav row.
        if (this.getNavLevel() === 'content' && row) {
            if (this.hasSubTabs && this.hasSubTabs() && this.focusActiveSubTab) {
                this._navLevel = 'sub';
                this.focusActiveSubTab();
                this.syncNavHint && this.syncNavHint();
                return true;
            }
            return hasSubnav ? this.focusNavRow('subnav') : this.focusNavRow('area');
        }
        if (row === 'area') return false;
        if (row === 'subnav') return this.focusNavRow('area');
        if (this.isSubTabEl && this.isSubTabEl(el)) {
            // Section tab → the area's sub-nav row.
            return hasSubnav ? this.focusNavRow('subnav') : this.focusNavRow('area');
        }
        if (this.isContentFocusable && this.isContentFocusable(el)) {
            // Content → its section tabs if the tab has them, else the sub-nav.
            if (this.hasSubTabs && this.hasSubTabs() && this.focusActiveSubTab) {
                this._navLevel = 'sub';
                this.focusActiveSubTab();
                this.syncNavHint && this.syncNavHint();
                return true;
            }
            return hasSubnav ? this.focusNavRow('subnav') : this.focusNavRow('area');
        }
        return false;
    },

    /**
     * ENTER one level down from the focused nav row. Area row: open that
     * area (MENU opens the menu), then focus its sub-nav row. Sub-nav: a not
     * yet active tab is selected (focus stays); the active one goes into its
     * content (PLAY → galaxy map, menu → menu section). False = not in a row.
     */
    enterOneNavLevel() {
        const el = this.getFocusables()[this.focusIndex];
        if (el && el.hasAttribute('data-play-launch')) {
            this.launchPlay();
            return true;
        }
        const row = this.getFocusedNavRow();
        if (!el || !row) return false;
        const hasSubnav = () => !!(this.overlay && this.overlay.querySelector('.hs-subnav-tab'));
        if (row === 'area') {
            if (el.hasAttribute('data-open-menu')) {
                if (!this.isMenuRowTab() || el.hasAttribute('data-menu-open-tab')) {
                    if (!this.isMenuRowTab()) this._lastGameTab = this.tab;
                    this.openMainMenuOverlay(this.menuButtonOpts(el));
                }
            } else if (!el.classList.contains('active')) {
                el.click();
            }
            if (hasSubnav()) return this.focusNavRow('subnav') || true;
            if (this.tab !== 'play') this.enterTabContent();
            return true;
        }
        // Sub-nav row.
        if (!el.classList.contains('active')) {
            el.click();
            this.focusNavRow('subnav');
            return true;
        }
        if (this.tab === 'play') return this.enterPlayMap() || true;
        if (this.tab === 'menu') {
            this.enterMenuContent();
            return true;
        }
        this.enterTabContent();
        return true;
    },

    /** 'area' (top area buttons), 'subnav' (area sub-tabs) or null for the focused element. */
    getFocusedNavRow() {
        const el = this.getFocusables()[this.focusIndex];
        if (!el || !el.classList) return null;
        if (el.classList.contains('hs-subnav-tab')) return 'subnav';
        if (el.classList.contains('hs-area-btn')) return 'area';
        return null;
    },

    /** Focus the active (or first) button of a nav row. */
    focusNavRow(row) {
        if (!this.overlay) return false;
        const sel = row === 'subnav' ? '.hs-subnav-tab' : '.hs-area-btn';
        const els = Array.from(this.overlay.querySelectorAll(sel));
        const target = els.find((el) => el.classList.contains('active')) || els[0];
        const list = this.getFocusables();
        const i = target ? list.indexOf(target) : -1;
        if (i < 0) return false;
        this._navLevel = 'tabs';
        this.focusIndex = i;
        this.refreshFocus();
        this.syncNavHint && this.syncNavHint();
        return true;
    },

    /**
     * Arrows between the two tab rows. Area row: ←/→ switch area, ↓ into
     * its sub-nav. Sub-nav: ←/→ switch sub-tab (focus stays in the row),
     * ↑ back to the area row, ↓ into the content. Returns true if handled.
     */
    handleNavRowArrow(key) {
        const focusedEl = this.getFocusables()[this.focusIndex];
        // PLAY launch sits left of the area row: → goes back into that row.
        if (focusedEl && focusedEl.hasAttribute && focusedEl.hasAttribute('data-play-launch')) {
            if (key === 'ArrowRight') {
                // → opens HOME BASE right away (like switching areas).
                const first = this.overlay.querySelector('.hs-area-btn[data-tab]');
                if (first) first.click();
                return this.focusNavRow('area');
            }
            return key === 'ArrowLeft' || key === 'ArrowUp';
        }
        // Logout sits in the wallet card right of the area row: ← goes back.
        if (focusedEl && focusedEl.id === 'hsLogout') {
            if (key === 'ArrowLeft') return this.focusNavRow('area');
            return key === 'ArrowRight' || key === 'ArrowUp';
        }
        const row = this.getFocusedNavRow();
        if (!row) return false;
        const hasSub = !!(this.overlay && this.overlay.querySelector('.hs-subnav-tab'));
        if (row === 'area') {
            const focused = this.getFocusables()[this.focusIndex];
            const isMenuBtn = !!(focused && focused.hasAttribute('data-open-menu'));
            if (key === 'ArrowDown') {
                // MENU button: ↓ opens the menu (same as ENTER / ESC).
                if (isMenuBtn) {
                    this.openMainMenuOverlay(this.menuButtonOpts(focused));
                    return true;
                }
                if (hasSub) return this.focusNavRow('subnav');
                // The galaxy map (PLAY) is only entered with ENTER / SPACE.
                if (this.tab !== 'play') this.enterTabContent();
                return true;
            }
            if (key === 'ArrowLeft' || key === 'ArrowRight') {
                // Walk every area button from the focused one (MENU included):
                // a real area switches right away, MENU is only focused.
                const btns = Array.from(this.overlay.querySelectorAll('.hs-area-btn'));
                const cur = Math.max(0, btns.indexOf(focused));
                // → from the last area (MENU) steps onto the logout button.
                if (key === 'ArrowRight' && cur === btns.length - 1) {
                    const out = this.overlay.querySelector('#hsLogout');
                    const i = out ? this.getFocusables().indexOf(out) : -1;
                    if (i >= 0) {
                        this._navLevel = 'tabs';
                        this.focusIndex = i;
                        this.refreshFocus();
                        this.syncNavHint && this.syncNavHint();
                        return true;
                    }
                }
                // ← from the first area (HOME BASE) steps onto the PLAY launch.
                if (key === 'ArrowLeft' && cur === 0) {
                    // Focusing PLAY opens the play section (map not entered yet).
                    if (this.tab !== 'play' || this._travelModal) {
                        if (this.tab === 'menu') {
                            this.unmountMenuTab();
                            this._menuOpts = null;
                            this._prevTab = null;
                        }
                        this.tab = 'play';
                        this._travelModal = false;
                        this.statusMsg = '';
                        this.persistTab();
                        this.createUI();
                    }
                    const play = this.overlay.querySelector('[data-play-launch]');
                    const i = play ? this.getFocusables().indexOf(play) : -1;
                    if (i >= 0) {
                        this._navLevel = 'tabs';
                        this.focusIndex = i;
                        this.refreshFocus();
                        this.syncNavHint && this.syncNavHint();
                        return true;
                    }
                }
                const next = btns[(cur + (key === 'ArrowLeft' ? -1 : 1) + btns.length) % btns.length];
                if (!next) return true;
                if (next.hasAttribute('data-tab')) {
                    next.click();
                    this.focusNavRow('area');
                } else if (next.hasAttribute('data-open-menu')) {
                    // MENU is an area like the others: switching to it opens
                    // the menu, its tabs appear in the second row.
                    if (!this.isMenuRowTab() || next.hasAttribute('data-menu-open-tab')) {
                        if (!this.isMenuRowTab()) this._lastGameTab = this.tab;
                        this.openMainMenuOverlay(this.menuButtonOpts(next));
                    }
                    this.focusNavRow('area');
                }
                return true;
            }
            return key === 'ArrowUp';
        }
        // subnav
        if (key === 'ArrowUp') return this.focusNavRow('area');
        if (key === 'ArrowDown') {
            // Menu section (profiles / settings / …): hand keys to the menu.
            if (this.tab === 'menu') {
                this.enterMenuContent();
                return true;
            }
            // The galaxy map (PLAY) is only entered with ENTER / SPACE.
            if (this.tab !== 'play') this.enterTabContent();
            return true;
        }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const subs = Array.from(this.overlay.querySelectorAll('.hs-subnav-tab'));
            const cur = subs.findIndex((el) => el.classList.contains('active'));
            const next = subs[((cur < 0 ? 0 : cur) + (key === 'ArrowLeft' ? -1 : 1) + subs.length) % subs.length];
            if (next) {
                next.click();
                this.focusNavRow('subnav');
            }
            return true;
        }
        return false;
    },

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
