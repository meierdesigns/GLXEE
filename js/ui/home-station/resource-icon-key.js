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

    /** The MENU_AREAS entry that holds a tab, or null. */
    getTabArea(tabId) {
        if (typeof MENU_AREAS === 'undefined') return null;
        return MENU_AREAS.find((area) => area.tabs.indexOf(tabId) !== -1) || null;
    },

    renderTabs() {
        if (typeof MENU_AREAS !== 'undefined') return this.renderAreaTabs();
        return this.renderOrderedTabs();
    },

    /** Coarse area buttons; the active area expands into its icon tabs. */
    renderAreaTabs() {
        const mainTabs = this._tabs.filter((id) => this._menuOnlyTabs.indexOf(id) === -1);
        const activeArea = this.getTabArea(this.tab);
        if (!this._areaLastTab) this._areaLastTab = {};
        if (activeArea) this._areaLastTab[activeArea.id] = this.tab;
        // The header is rebuilt on every switch, so CSS transitions can't run:
        // mark what just changed and let keyframes animate it (read again by
        // renderAreaSubnav, which renders right after this).
        const prev = this._navAnimPrev || null;
        const areaIdx = MENU_AREAS.indexOf(activeArea);
        const tabIdx = activeArea ? activeArea.tabs.indexOf(this.tab) : -1;
        this._navAnim = {
            area: !!prev && prev.area !== areaIdx,
            tab: !!prev && prev.tab !== this.tab,
            dir: !prev ? 0 : (prev.area !== areaIdx ? Math.sign(areaIdx - prev.area) : Math.sign(tabIdx - prev.tabIdx))
        };
        this._navAnimPrev = { area: areaIdx, tab: this.tab, tabIdx: tabIdx };
        const anim = this._navAnim;
        const dirClass = anim.dir < 0 ? ' hs-anim-from-right' : ' hs-anim-from-left';
        const areaOrder = getAreaOrder();
        const onProfiles = this.tab === 'menu' && typeof startScreenManager !== 'undefined' && startScreenManager.embeddedMenuTab === 'profiles';
        const profilesBtn = (oi) => `<button type="button" class="hs-tab hs-area-btn${onProfiles ? ' active' : ''}${this.holoJustOn('profiles', onProfiles) ? ' holo-on' : ''}" data-open-menu="1" data-menu-open-tab="profiles" data-area-order-index="${oi}" data-nav-item title="${this.menuLabelFor('area:profiles', 'PROFILES')}">` +
            this.areaDecoHtml('profiles') +
            `<span class="hs-tab-icon">${this.tabIconHtml(this.menuIconFor('area:profiles', 'menuProfiles'))}</span>` +
            `<span class="hs-tab-label">${this.menuLabelFor('area:profiles', 'PROFILES')}</span>` +
            `</button>`;
        const menuOn = this.isMenuRowTab() && !onProfiles;
        const menuBtn = (oi) => `<button type="button" class="hs-tab hs-area-btn${menuOn ? ' active' : ''}${this.holoJustOn('menu', menuOn) ? ' holo-on' : ''}" data-open-menu="1" data-area-order-index="${oi}" data-nav-item title="MENU (ESC)">` +
            this.areaDecoHtml('menu') +
            `<span class="hs-tab-icon">${this.navIconHtml('menu', 'menuSettings')}</span>` +
            `<span class="hs-tab-label">MENU</span>` +
            `</button>`;
        return areaOrder.map((entry, oi) => {
            if (entry === '|') return `<span class="hs-tab-divider" data-area-order-index="${oi}" aria-hidden="true"></span>`;
            if (entry === 'profiles') return profilesBtn(oi);
            if (entry === 'menu') return menuBtn(oi);
            const area = MENU_AREAS.find((a) => a.id === entry);
            if (!area) return '';
            const areaLabel = this.menuLabelFor('area:' + area.id, area.label);
            const tabs = area.tabs.filter((id) => mainTabs.indexOf(id) !== -1);
            if (!tabs.length) return '';
            const active = activeArea === area;
            // Last used sub-tab of the area — except PLAY (the map is never
            // entered just by switching areas) — else the area's default.
            const last = this._areaLastTab[area.id];
            // TRAVEL is only a modal over the map: never the landing tab.
            const modal = (id) => id === 'play' || id === 'travel';
            const pages = tabs.filter((id) => !modal(id));
            const fallback = area.defaultTab && pages.indexOf(area.defaultTab) !== -1 ? area.defaultTab : (pages[0] || tabs[0]);
            const target = tabs.indexOf(last) !== -1 && !modal(last) ? last : fallback;
            // Reuse .hs-tab so the area buttons get the faction chrome of the
            // station tabs.
            return `<button type="button" class="hs-tab hs-area-btn${active ? ' active' : ''}${active && anim.area ? ' hs-anim-activate holo-on' + dirClass : ''}" data-tab="${target}" data-area="${area.id}" data-area-order-index="${oi}" data-nav-item title="${areaLabel}">` +
                this.areaDecoHtml(area.id) +
                `<span class="hs-tab-icon">${this.navIconHtml(area.id, this.menuIconFor('area:' + area.id, area.icon))}</span>` +
                `<span class="hs-tab-label">${areaLabel}</span>` +
                `</button>`;
        }).join('');
    },

    /** WIKI sub-nav: one tab per archive category; opens its viewer. */
    renderExploreSubnav() {
        const items = (this._exploreClusters || []).reduce((acc, c) => acc.concat(c.items), []);
        const tabs = items.map((entry) => {
            const empty = !this.isExploreItemVisible(entry.id);
            const count = this.getExploreItemCount(entry.id);
            const tip = count == null ? entry.id : `${entry.id} (${count})`;
            const on = this._embeddedViewerKind === entry.open;
            return `<button type="button" class="hs-tab hs-subnav-tab hs-explore-subtab${on ? ' active' : ''}${empty ? ' is-empty' : ''}" data-explore="${entry.open}" data-nav-item title="${tip}"${empty ? ' disabled' : ''}>` +
                `<span class="hs-tab-icon">${this.tabIconHtml(entry.icon)}</span>` +
                `<span class="hs-tab-label">${entry.id}</span>` +
                `</button>`;
        }).join('');
        return `<nav class="hs-subnav hs-subnav-explore" aria-label="WIKI">${tabs}</nav>`;
    },

    /** Sub navbar under the top bar: the tabs of the active area. */
    renderAreaSubnav() {
        if (typeof MENU_AREAS === 'undefined') return '';
        // Menu: its tabs (profiles / settings / …) are the sub-nav row under
        // the normal area row, like any other area.
        if (this.isMenuRowTab()) {
            // PROFILES stands on its own: no SETTINGS / CREDITS row under it.
            if (this.tab === 'profiles' || (this.tab === 'menu' && typeof startScreenManager !== 'undefined' && startScreenManager.embeddedMenuTab === 'profiles')) return '';
            return `<nav class="hs-subnav hs-subnav-menu" aria-label="MENU">${this.renderMenuTabs()}</nav>`;
        }
        const area = this.getTabArea(this.tab);
        const mainTabs = this._tabs.filter((id) => this._menuOnlyTabs.indexOf(id) === -1);
        // PLAY lives in the big launch button left of the navbars.
        const tabs = area ? area.tabs.filter((id) => id !== 'play' && mainTabs.indexOf(id) !== -1 && this.isDevTabVisible(id)) : [];
        if (tabs.length < 2) {
            // WIKI: its archive categories are the sub-nav tabs.
            return this.tab === 'explorations' ? this.renderExploreSubnav() : '';
        }
        const anim = this._navAnim || {};
        const dirClass = anim.dir < 0 ? ' hs-anim-from-right' : ' hs-anim-from-left';
        const items = tabs.map((id) => {
            const meta = this._tabMeta[id] || { label: id.toUpperCase(), icon: '' };
            const on = this.tab === id;
            // Sub-tab names that would repeat their area's name.
            const label = this.menuLabelFor(id, id === 'station' ? 'STORAGE' : (id === 'hangar' ? 'SHIPYARD' : meta.label));
            const pop = on && anim.tab && !anim.area ? ' hs-anim-activate' + dirClass : '';
            return `<button type="button" class="hs-tab hs-subnav-tab ${on ? 'active' : ''}${pop}" data-tab="${id}" data-nav-item title="${label}">` +
                `<span class="hs-tab-icon">${this.tabIconHtml(this.menuIconFor(id, id === 'station' ? 'hsStores' : meta.icon))}</span>` +
                `<span class="hs-tab-label">${label}</span>` +
                `</button>`;
        }).join('');
        return `<nav class="hs-subnav${anim.area ? ' hs-subnav-enter' : ''}" aria-label="${this.menuLabelFor('area:' + area.id, area.label)}">${items}</nav>`;
    },

    /**
     * Background icons of a main nav card (like PLAY's planets): tinted and
     * pushed out at rest, pulled in and in colour on hover / focus.
     */
    areaDecoHtml(areaId) {
        const res = (id) => this.resourceIconKey(id);
        const sets = {
            station: ['hsStation', 'hsShop', res('ore'), res('crystal')],
            hangar: ['hsShip', 'hsCraft', 'statWeapon', 'statArmor'],
            factions: ['menuPeoples', 'hsShip', 'statAbilities', 'statWeapon'],
            explore: ['hsExplore', 'hsBlueprint', 'statEnergy', res('voltex')],
            profiles: ['menuProfiles', 'menuLoad', 'menuNewPilot', 'hsShip'],
            menu: ['menuSettings', 'menuCredits', 'hsLogout', 'hsComponents']
        };
        const keys = sets[areaId] || [];
        const items = keys.map((k, i) =>
            `<span class="hs-area-deco-item hs-area-deco-${i}">${this.iconHtml(k, 24, 'hs-area-deco-img', false)}</span>`).join('');
        return items ? `<span class="hs-area-deco" aria-hidden="true">${items}</span>` : '';
    },

    /** Big PLAY button left of both navbars (and in the main menu panel): planet miniatures + play icon. */
    /** True only on the render where `key` turns on, so re-renders (hover/focus) don't replay the power-on flicker. */
    holoJustOn(key, on) {
        this._holoPrev = this._holoPrev || {};
        const was = !!this._holoPrev[key];
        this._holoPrev[key] = !!on;
        return !!on && !was;
    },

    renderPlayLaunch() {
        const ids = (typeof planetSVGManager !== 'undefined') ? ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'] : [];
        const planets = ids.map((id, i) => {
            const svg = planetSVGManager.getPlanetSVG(id);
            return svg ? `<span class="hs-play-launch-planet hs-play-launch-planet-${i}">${svg}</span>` : '';
        }).join('');
        const tint = this.factionTintFilter();
        const label = this.menuLabelFor('play', 'PLAY');
        return `<button type="button" class="hs-play-launch${this.tab === 'play' ? ' active' : ''}${this.holoJustOn('play', this.tab === 'play') ? ' holo-on' : ''}" data-play-launch data-nav-item title="${label}">` +
            (tint ? this.factionTintSvg(tint) : '') +
            `<span class="hs-play-launch-planets" aria-hidden="true">${planets}</span>` +
            `<span class="hs-play-launch-icon" aria-hidden="true"></span>` +
            `<span class="hs-play-launch-label">${label}</span>` +
            `</button>`;
    },

    /** The GUI's faction colour (--color-primary) as [r, g, b] in 0..1, or ''. */
    factionTintFilter() {
        // Read the variable from the root (set by the palette system; the
        // overlay may not be in the DOM yet) and let a canvas normalise any
        // CSS colour format to #rrggbb.
        let rgb = null;
        try {
            const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
            if (!raw) return '';
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillStyle = raw;
            const hex = String(ctx.fillStyle);
            const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
            rgb = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
                : (hex.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
        } catch (e) { return ''; }
        if (!rgb || rgb.length < 3) return '';
        return rgb.map((v) => v / 255);
    },

    /**
     * Inline SVG filter #hsPlayTint: maps each pixel's luminance onto the
     * exact faction colour (brightest planet pixels = the colour itself).
     */
    factionTintSvg(rgb) {
        const k = 1.8;
        const row = (c) => [0.2126, 0.7152, 0.0722].map((w) => (w * c * k).toFixed(4)).join(' ') + ' 0 0';
        const values = `${row(rgb[0])} ${row(rgb[1])} ${row(rgb[2])} 0 0 0 1 0`;
        return `<svg class="hs-play-launch-filter" width="0" height="0" aria-hidden="true" focusable="false">` +
            `<filter id="hsPlayTint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${values}"/></filter></svg>`;
    },

    renderOrderedTabs() {
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
            const label = this.menuLabelFor(id, meta.label);
            return `<button type="button" class="hs-tab${playClass} ${active ? 'active' : ''}" data-tab="${id}" data-order-index="${i}" data-nav-item title="${label}">` +
                `<span class="hs-tab-icon">${this.tabIconHtml(this.menuIconFor(id, meta.icon))}</span>` +
                `<span class="hs-tab-label">${label}</span>` +
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
        // TRAVEL is a modal over PLAY: a reload never reopens it.
        const restored = savedTab === 'travel' ? 'play' : savedTab;
        // PLAY sits in the main menu, not in an area's tab row.
        this.tab = (restored === 'play' || this._tabs.includes(restored)) ? restored : 'station';
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
            : (this.tab === 'travel' ? 'play' : this.tab);
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

// The power-on flicker is a one-shot: drop its class when it ends so no later
// style change (hover, focus, mouse out) can replay it.
document.addEventListener('animationend', (e) => {
    if (e.animationName !== 'hs-holo-on') return;
    const host = e.target && e.target.closest ? e.target.closest('.holo-on') : null;
    if (host) host.classList.remove('holo-on');
}, true);
