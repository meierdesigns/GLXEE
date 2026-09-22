"use strict";

/**
 * Home Station — wallet, cargo teleport, blueprints unlock/craft, ship shop.
 */
class HomeStationUI {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this._keyHandler = null;
        this._mouseMoveHandler = null;
        this.onClose = null;
        this.tab = 'station'; // station | upgrade | hangar | components | shop | craft | travel | explorations | play
        this.upgradeSubTab = 'station'; // station | ships | modules
        this.shopCategory = 'ships'; // ships | blueprints | parts | portals | resources
        this.shopFilter = 'all';
        this.shopSort = 'name'; // name | cost | tier
        this.shopResourceQty = 1;
        this._shopPrefs = this.loadShopPrefs();
        this.statusMsg = '';
        this.focusIndex = 0;
        this.hangarShipId = null;
        this._prevTab = null;
        this._menuOpts = null;
        this._pendingFlash = null;
        this._fxClearTimer = null;
        this._hangarPreviewAnimId = null;
        this._hangarPreviewLastTs = 0;
        this._hangarPreviewSim = null;
        this._hangarPreviewCanvas = null;
        this._hangarPreviewCtx = null;
        this._hangarPreviewShipId = null;
        this._hangarPreviewZoom = 1;
        this._hangarPreviewWheelBound = null;
        this._hangarWingDragCleanup = null;
        this._hangarWingDragState = null;
        this._hangarLiveDrawRaf = 0;
        this._hangarSegmentHover = null;
        this._hangarSelectedModule = null;
        this._hangarPanelResize = null;
        this._hangarLeftCollapsed = false;
        this._hangarRightCollapsed = false;
        try {
            const raw = localStorage.getItem('vf_hs_hangar_sidebar_prefs_v1');
            const prefs = raw ? JSON.parse(raw) : null;
            if (prefs && typeof prefs === 'object') {
                this._hangarLeftCollapsed = prefs.left === true;
                this._hangarRightCollapsed = prefs.right === true;
            }
        } catch (e) { /* ignore */ }
        this._tabs = ['station', 'play', 'upgrade', 'hangar', 'components', 'shop', 'craft', 'travel', 'explorations'];
        this._upgradeSubTabs = ['station', 'ships', 'modules'];
        this.selectedUpgradeNode = null;
        this._upgTipHost = null;
        this._upgTipBtn = null;
        this._upgTipRaf = 0;
        this._resBuyModal = null;
        this._navLevel = 'tabs'; // tabs | sub | content
        this._upgradeSubMeta = {
            station: { label: 'STATION', icon: 'hsStation' },
            ships: { label: 'SHIPS', icon: 'hsShip' },
            modules: { label: 'MODULES', icon: 'hsCraft' }
        };
        this._shopCategories = ['ships', 'blueprints', 'parts', 'portals', 'resources'];
        this._shopCatMeta = {
            ships: { label: 'SHIPS', icon: 'hsShip' },
            blueprints: { label: 'BLUEPRINTS', icon: 'hsBlueprint' },
            parts: { label: 'PARTS', icon: 'hsCraft' },
            portals: { label: 'PORTALS', icon: 'galaxyMilkyWay' },
            resources: { label: 'RESOURCES', icon: 'hsStores' }
        };
        this._resourceBagFilters = [
            { id: 'station', label: 'STATION', icon: 'hsStores' },
            { id: 'cargo', label: 'CARGO', icon: 'hsCargo' }
        ];
        this._resourceQtyOptions = [1, 5, 10, 'all'];
        this._shipClassFilters = [
            { id: 'all', label: 'ALL' },
            { id: 'starfighter', label: 'STARFIGHTER' },
            { id: 'interceptor', label: 'INTERCEPTOR' },
            { id: 'heavy_fighter', label: 'HEAVY' },
            { id: 'assault', label: 'ASSAULT' }
        ];
        this._partTypeFilters = [
            { id: 'all', label: 'ALL' },
            { id: 'weapon', label: 'WEAPONS' },
            { id: 'defense', label: 'DEFENSE' },
            { id: 'ability', label: 'ABILITY' },
            { id: 'energy', label: 'ENERGY' }
        ];
        this._shopSortOptions = [
            { id: 'name', label: 'NAME' },
            { id: 'cost', label: 'COST' },
            { id: 'tier', label: 'TIER' }
        ];
        this._tabMeta = {
            station: { label: 'STATION', icon: 'hsStation' },
            upgrade: { label: 'UPGRADE', icon: 'hsUpgrade' },
            hangar: { label: 'HANGAR', icon: 'hsHangar' },
            components: { label: 'COMPONENTS', icon: 'hsComponents' },
            shop: { label: 'SHOP', icon: 'hsShop' },
            craft: { label: 'CRAFT', icon: 'hsCraft' },
            travel: { label: 'TRAVEL', icon: 'hsTeleport' },
            explorations: { label: 'EXPLORATIONS', icon: 'hsExplore' },
            play: { label: 'PLAY', icon: 'menuStart' }
        };
        this._exploreClusters = [
            {
                id: 'archive',
                label: 'ARCHIVE',
                items: [
                    { id: 'SHIPS', icon: 'menuShips', open: 'ships' },
                    { id: 'PLANETS', icon: 'menuPlanets', open: 'planets' },
                    { id: 'ENEMIES', icon: 'menuEnemies', open: 'enemies' },
                    { id: 'FACTIONS', icon: 'menuPeoples', open: 'factions' },
                    { id: 'EVENTS', icon: 'menuAbilities', open: 'events' }
                ]
            },
            {
                id: 'arsenal',
                label: 'ARSENAL',
                items: [
                    { id: 'WEAPONS', icon: 'menuWeapons', open: 'weapons' },
                    { id: 'ABILITIES', icon: 'menuAbilities', open: 'abilities' },
                    { id: 'DEFENSE SYSTEMS', icon: 'menuDefense', open: 'defenses' },
                    { id: 'EXPLOSIONS', icon: 'menuAbilities', open: 'explosions' },
                    { id: 'COMPONENTS', icon: 'hsComponents', open: 'components' }
                ]
            }
        ];
    }

    iconHtml(iconKey, size, className, tipLabel) {
        if (typeof iconRenderer !== 'undefined' && iconKey) {
            let tint = null;
            const resId = (typeof economyConfig !== 'undefined' && economyConfig.resourceIdFromIconKey)
                ? economyConfig.resourceIdFromIconKey(iconKey)
                : null;
            if (resId && typeof economyConfig !== 'undefined' && economyConfig.getResourceColor) {
                tint = economyConfig.getResourceColor(resId);
            } else if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getSecondBaseColor) {
                tint = colorPaletteSystem.getSecondBaseColor();
            } else {
                try {
                    const v = getComputedStyle(document.documentElement)
                        .getPropertyValue('--color-second-basecolor').trim();
                    if (v && v.charAt(0) === '#') tint = v;
                } catch (e) { /* ignore */ }
            }
            return iconRenderer.imgHtml(iconKey, size || 32, className || 'hs-pixel', tint, tipLabel);
        }
        return '';
    }

    menuButtonHtml() {
        return '<span class="hs-menu-glyph" aria-hidden="true">≡</span>';
    }

    renderMenuTabs() {
        if (typeof startScreenManager === 'undefined') return '';
        const isMenu = this.tab === 'menu';
        const activeTab = isMenu ? startScreenManager.embeddedMenuTab : null;
        return startScreenManager.embeddedMenuTabs.map((tab) => {
            const active = activeTab === tab.id;
            const icon = tab.icon ? this.iconHtml(tab.icon, 24, 'hs-pixel') : '';
            return `
            <button type="button" class="hs-menu-tab-btn${active ? ' active' : ''}" data-menu-tab="${tab.id}" title="${tab.label}" data-nav-item>
                <span class="hs-menu-tab-icon">${icon}</span>
                ${active ? `<span class="hs-menu-tab-label">${tab.label}</span>` : ''}
            </button>`;
        }).join('');
    }

    tabIconHtml(iconKey) {
        return this.iconHtml(iconKey, 32, 'hs-tab-pixel');
    }

    resourceIconKey(id) {
        const map = {
            credits: 'menuCredits',
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        return map[id] || 'resScrap';
    }

    panelTitle(iconKey, label) {
        return `<h3 class="hs-panel-title">` +
            `<span class="hs-panel-icon">${this.iconHtml(iconKey, 32, 'hs-pixel')}</span>` +
            `<span class="hs-panel-label">${label}</span>` +
            `<span class="hs-panel-scan" aria-hidden="true"></span>` +
            `</h3>`;
    }

    renderTabs() {
        return this._tabs.filter((id) => id !== 'station').map((id) => {
            const meta = this._tabMeta[id] || { label: id.toUpperCase(), icon: '' };
            const active = this.tab === id;
            const playClass = id === 'play' ? ' hs-tab-play' : '';
            return `<button type="button" class="hs-tab${playClass} ${active ? 'active' : ''}" data-tab="${id}" data-nav-item title="${meta.label}">` +
                `<span class="hs-tab-icon">${this.tabIconHtml(meta.icon)}</span>` +
                `<span class="hs-tab-label">${meta.label}</span>` +
                `</button>`;
        }).join('');
    }

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
        this.shopCategory = this._shopCategories.includes(savedShopCat) ? savedShopCat : 'ships';
        this.applyShopPrefsForCategory(this.shopCategory, {
            filter: opts.shopFilter != null ? opts.shopFilter : savedState.shopFilter,
            sort: opts.shopSort != null ? opts.shopSort : savedState.shopSort,
            qty: opts.shopResourceQty != null ? opts.shopResourceQty : savedState.shopResourceQty
        });
        this.statusMsg = '';
        this.focusIndex = 0;
        this._focusExplore = opts.focusExplore || null;
        this.createUI();
        if (typeof soundManager !== 'undefined' && soundManager.startMenuMusic) {
            soundManager.startMenuMusic();
        }
        if (typeof menuStateManager !== 'undefined' && !opts.skipPersist) {
            this.persistTab();
        }
    }

    persistTab() {
        if (typeof menuStateManager === 'undefined') return;
        const tab = this.tab === 'menu'
            ? ((this._prevTab && this._prevTab !== 'menu') ? this._prevTab : 'station')
            : this.tab;
        this.captureShopPrefs();
        const extra = {
            tab: tab,
            shopCategory: this.shopCategory,
            shopFilter: this.shopFilter,
            shopSort: this.shopSort,
            shopResourceQty: this.shopResourceQty
        };
        if (typeof componentEditorUI !== 'undefined' && componentEditorUI.typeId) {
            extra.componentType = componentEditorUI.typeId;
            extra.componentId = componentEditorUI.selectedId || null;
        }
        menuStateManager.setScreen('home-station', extra);
    }

    loadShopPrefs() {
        try {
            const raw = localStorage.getItem('vf_hs_shop_prefs_v1');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    saveShopPrefs() {
        try {
            localStorage.setItem('vf_hs_shop_prefs_v1', JSON.stringify(this._shopPrefs || {}));
        } catch (e) {
            /* ignore */
        }
    }

    captureShopPrefs(category) {
        const cat = category || this.shopCategory || 'ships';
        if (!this._shopPrefs || typeof this._shopPrefs !== 'object') this._shopPrefs = {};
        this._shopPrefs[cat] = {
            filter: this.shopFilter,
            sort: this.shopSort,
            qty: this.shopResourceQty
        };
        this.saveShopPrefs();
    }

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
    }

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
    }

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
    }

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
    }

    logout() {
        this.closeMenuTab(true);
        this.hide();
        if (typeof profileManager !== 'undefined') profileManager.logout();
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show({ forceMenu: true });
        }
    }

    openMainMenuOverlay(opts) {
        const o = opts || {};
        if (typeof startScreenManager === 'undefined') return;
        const hasProfile = typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();

        // Without profile: full start menu (not embedded in station).
        if (!hasProfile) {
            this.closeMenuTab(true);
            if (startScreenManager.isOverlayOpen()) {
                startScreenManager.hideOverlay();
            }
            this.hide();
            startScreenManager.show({
                forceMenu: true,
                showSettings: !!o.showSettings,
                showCredits: !!o.showCredits,
                skipPersist: !!o.skipPersist
            });
            return;
        }

        // With profile: menu is a tab inside the station modal (no separate overlay BG).
        if (this.tab === 'menu' && !o.force && !o.showSettings && !o.showCredits && !o.tab) {
            this.closeMenuTab();
            return;
        }
        if (this.tab === 'menu' && !o.force && o.tab && typeof startScreenManager !== 'undefined') {
            startScreenManager.setEmbeddedMenuTab(o.tab);
            return;
        }
        if (this.tab !== 'menu') {
            this._prevTab = this.tab;
        }
        this.tab = 'menu';
        this._menuOpts = {
            tab: o.tab || null,
            showSettings: !!o.showSettings,
            showCredits: !!o.showCredits,
            resetPanels: !(o.showSettings || o.showCredits || o.tab),
            skipPersist: !!o.skipPersist
        };
        this.statusMsg = '';
        this.createUI();
    }

    closeMenuTab(silent) {
        const wasMenu = this.tab === 'menu';
        this.unmountMenuTab();
        this._menuOpts = null;
        if (!wasMenu && silent) return;
        if (wasMenu) {
            this.tab = (this._prevTab && this._prevTab !== 'menu') ? this._prevTab : 'station';
        }
        this._prevTab = null;
        if (!silent && wasMenu && this.isVisible) {
            this.createUI();
        }
    }

    mountMenuTab(opts) {
        const host = this.overlay && this.overlay.querySelector('#hsMenuHost');
        if (!host || typeof startScreenManager === 'undefined') return;
        const o = opts || this._menuOpts || {};
        startScreenManager.showEmbedded({
            host: host,
            tab: o.tab || null,
            showSettings: !!o.showSettings,
            showCredits: !!o.showCredits,
            resetPanels: o.resetPanels !== false && !(o.showSettings || o.showCredits || o.tab),
            skipPersist: !!o.skipPersist
        });
    }

    unmountMenuTab() {
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hideEmbedded();
        }
    }

    renderComponentsTab() {
        return `<div class="hs-section hs-panel hs-components-root">` +
            `${this.panelTitle('hsComponents', 'COMPONENTS')}` +
            `<div class="hs-components-host" id="hsComponentsHost"></div>` +
            `</div>`;
    }

    mountComponentsTab(opts) {
        const host = this.overlay && this.overlay.querySelector('#hsComponentsHost');
        if (!host || typeof componentEditorUI === 'undefined') return;
        const o = Object.assign({}, opts || {});
        if (!o.type && !o.id && typeof menuStateManager !== 'undefined') {
            const s = menuStateManager.get();
            if (s && s.componentType) o.type = s.componentType;
            if (s && s.componentId) o.id = s.componentId;
        }
        componentEditorUI.mount(host, o);
    }

    unmountComponentsTab() {
        if (typeof componentEditorUI !== 'undefined' && componentEditorUI.embedded) {
            componentEditorUI.unmount();
        }
    }

    openComponentEditorForModule(kind, modId) {
        let type = 'mount';
        let id = null;
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.resolveModuleShipSprite) {
            id = shipLoadoutManager.resolveModuleShipSprite({ kind: kind, id: modId });
        }
        if (!id) id = 'mount_' + String(modId || '');
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(id);
            if (hit) {
                type = hit.type;
                id = hit.id;
            }
        }
        if (typeof componentEditorUI === 'undefined') return;
        const stationOnClose = this.onClose;
        this.show({
            tab: 'components',
            onClose: stationOnClose
        });
        // Remount with selection after UI rebuild
        requestAnimationFrame(() => {
            if (typeof componentEditorUI !== 'undefined') {
                componentEditorUI.typeId = type;
                componentEditorUI.selectedId = id;
                if (componentEditorUI.root) componentEditorUI.refreshAll();
            }
        });
    }

    closeMainMenuOverlay() {
        this.unmountMenuTab();
        if (typeof startScreenManager !== 'undefined' && startScreenManager.isOverlayOpen()) {
            startScreenManager.hideOverlay();
        }
    }

    getProfile() {
        if (typeof profileManager === 'undefined') return null;
        const p = profileManager.getActiveProfile();
        if (p) profileManager.ensureEconomyDefaults(p);
        return p;
    }

    shipName(id) {
        if (typeof shipConfigManager !== 'undefined') {
            return shipConfigManager.getDisplayName(id);
        }
        return String(id || '').toUpperCase();
    }

    formatBagMap(map) {
        if (typeof economyConfig !== 'undefined') {
            return economyConfig.formatCost(map);
        }
        return Object.keys(map || {}).map((k) => (map[k] + ' ' + k)).join(' + ') || '—';
    }

    costTotal(map) {
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const weights = { scrap: 1, ore: 2, crystal: 3, voltex: 4 };
        let sum = Math.max(0, Math.round(Number((map && map.credits) || 0)));
        sum += ids.reduce((acc, id) => {
            const n = (map && map[id]) || 0;
            return acc + n * (weights[id] || 1);
        }, 0);
        return sum;
    }

    canAffordCredits(costMap, profile) {
        const need = Math.max(0, Math.round(Number((costMap && costMap.credits) || 0)));
        if (need <= 0) return true;
        if (typeof profileManager !== 'undefined' && profileManager.canAffordCredits) {
            return profileManager.canAffordCredits(need, profile);
        }
        return Math.max(0, Math.round(Number((profile && profile.credits) || 0))) >= need;
    }

    canAffordCost(wallet, costMap, profile) {
        const c = costMap || {};
        if (c.credits) {
            if (!this.canAffordCredits(c, profile || this.getProfile())) return false;
        }
        const materials = Object.assign({}, c);
        delete materials.credits;
        if (!Object.keys(materials).length) return true;
        if (typeof economyConfig !== 'undefined') {
            return economyConfig.canAfford(wallet, materials);
        }
        const w = wallet || {};
        return Object.keys(materials).every((id) => (w[id] || 0) >= (materials[id] || 0));
    }

    renderCostGrid(costMap, wallet, profile) {
        const cells = [];
        const creditNeed = Math.max(0, Math.round(Number((costMap && costMap.credits) || 0)));
        if (creditNeed > 0) {
            const have = (typeof profileManager !== 'undefined' && profileManager.getCredits)
                ? profileManager.getCredits(profile || this.getProfile())
                : Math.max(0, Math.round(Number(((profile || this.getProfile()) || {}).credits) || 0));
            const short = have < creditNeed;
            const missing = short ? (creditNeed - have) : 0;
            cells.push(
                `<span class="hs-cost-cell hs-res-credits${short ? ' hs-cost-short' : ''}" title="${short ? ('NEED ' + missing) : 'CREDITS'}">` +
                `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey('credits'), 20, 'hs-pixel hs-pixel-20')}</span>` +
                `<span class="hs-cost-amt"${short ? ` data-need="−${missing}"` : ''}>${creditNeed}</span>` +
                `</span>`
            );
        }
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const hasMaterials = ids.some((id) => ((costMap && costMap[id]) || 0) > 0);
        if (hasMaterials || creditNeed <= 0) {
            ids.forEach((id) => {
                const n = (costMap && costMap[id]) || 0;
                const have = (wallet && wallet[id]) || 0;
                const empty = n <= 0;
                const short = !empty && have < n;
                const missing = short ? (n - have) : 0;
                const classes = [
                    'hs-cost-cell',
                    'hs-res-' + id,
                    empty ? 'hs-cost-empty' : '',
                    short ? 'hs-cost-short' : ''
                ].filter(Boolean).join(' ');
                const amt = empty ? '—' : String(n);
                const title = empty
                    ? String(id).toUpperCase()
                    : (short ? `NEED ${missing}` : String(id).toUpperCase());
                const needAttr = short ? ` data-need="−${missing}"` : '';
                cells.push(
                    `<span class="${classes}" title="${title}">` +
                    `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey(id), 20, 'hs-pixel hs-pixel-20')}</span>` +
                    `<span class="hs-cost-amt"${needAttr}>${amt}</span>` +
                    `</span>`
                );
            });
        }
        return `<span class="hs-cost-grid">${cells.join('')}</span>`;
    }

    getMissingMaterials(wallet, costMap) {
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const w = wallet || {};
        const c = costMap || {};
        const rows = [];
        ids.forEach((id) => {
            const need = Math.max(0, Math.round(Number(c[id]) || 0));
            if (need <= 0) return;
            const have = Math.max(0, Math.round(Number(w[id]) || 0));
            if (have >= need) return;
            const gap = need - have;
            const buy = (typeof economyConfig !== 'undefined')
                ? economyConfig.getResourceBuyCost(id, gap)
                : null;
            rows.push({
                id: id,
                need: need,
                have: have,
                gap: gap,
                credits: buy ? Math.max(0, buy.credits || 0) : 0
            });
        });
        return rows;
    }

    openResourceBuyModal(opts) {
        const o = opts || {};
        this._resBuyModal = {
            title: String(o.title || 'NEED RESOURCES'),
            cost: Object.assign({}, o.cost || {}),
            action: o.action || null
        };
        this.focusIndex = 0;
        this.createUI();
    }

    closeResourceBuyModal() {
        this._resBuyModal = null;
        this.focusIndex = 0;
        this.createUI();
    }

    renderResourceBuyModal(profile) {
        const modal = this._resBuyModal;
        if (!modal) return '';
        const wallet = (profile && profile.resources) || {};
        const missing = this.getMissingMaterials(wallet, modal.cost);
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const totalCredits = missing.reduce((sum, r) => sum + (r.credits || 0), 0);
        const canBuyAll = missing.length > 0 && credits >= totalCredits;
        const canAffordUpgrade = missing.length === 0 && this.canAffordCost(wallet, modal.cost, profile);
        const rows = missing.length
            ? missing.map((r) => {
                const affordOne = credits >= r.credits;
                return `<div class="hs-res-buy-row">` +
                    `<span class="hs-res-buy-name">` +
                    `<span class="hs-chip-icon">${this.iconHtml(this.resourceIconKey(r.id), 32, 'hs-pixel')}</span>` +
                    `<span class="hs-line-text">` +
                    `<strong>${(typeof economyConfig !== 'undefined') ? economyConfig.getResourceLabel(r.id) : String(r.id).toUpperCase()}</strong>` +
                    `<span class="hs-line-meta">HAVE ${r.have} · NEED ${r.need} · BUY ${r.gap}</span>` +
                    `</span></span>` +
                    `<span class="hs-cost-grid hs-res-buy-grid">` +
                    `<span class="hs-cost-cell hs-res-credits${affordOne ? '' : ' hs-cost-short'}">` +
                    `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey('credits'), 20, 'hs-pixel hs-pixel-20')}</span>` +
                    `<span class="hs-cost-amt">${r.credits}</span>` +
                    `</span></span>` +
                    `<button type="button" class="action-button hs-line-action" data-res-buy-one="${r.id}" data-nav-item ${affordOne ? '' : 'disabled'}>BUY</button>` +
                    `</div>`;
            }).join('')
            : `<p class="hs-muted hs-res-buy-ok">MATERIALS READY</p>`;
        let primary = '';
        if (canAffordUpgrade && modal.action) {
            primary = `<button type="button" class="action-button" data-res-buy-finish data-nav-item>UPGRADE NOW</button>`;
        } else if (missing.length) {
            primary = `<button type="button" class="action-button" data-res-buy-all data-nav-item ${canBuyAll ? '' : 'disabled'}>` +
                `BUY ALL · ${totalCredits} CR</button>`;
        }
        return `<div class="hs-res-buy-modal" role="dialog" aria-modal="true" aria-label="Buy resources">` +
            `<div class="hs-res-buy-dialog">` +
            `<div class="hs-res-buy-head">` +
            `<h3>NEED RESOURCES</h3>` +
            `<p class="hs-res-buy-sub">${modal.title}</p>` +
            `</div>` +
            `<div class="hs-res-buy-cost">${this.renderCostGrid(modal.cost, wallet, profile)}</div>` +
            `<div class="hs-res-buy-list">${rows}</div>` +
            `<p class="hs-res-buy-wallet">CREDITS · ${credits}</p>` +
            `<div class="hs-res-buy-actions">` +
            `<button type="button" class="action-button hs-res-buy-close" data-res-buy-close data-nav-item>CLOSE</button>` +
            primary +
            `</div></div></div>`;
    }

    buyMissingResources(all) {
        const modal = this._resBuyModal;
        if (!modal || typeof profileManager === 'undefined') {
            return { ok: false, reason: 'NO MODAL' };
        }
        const profile = this.getProfile();
        const missing = this.getMissingMaterials((profile && profile.resources) || {}, modal.cost);
        if (!missing.length) return { ok: true, bought: 0 };
        const targets = all ? missing : missing.slice(0, 1);
        let bought = 0;
        let lastFail = null;
        for (let i = 0; i < targets.length; i++) {
            const row = targets[i];
            const res = profileManager.buyShopResource(row.id, row.gap, 'station');
            if (!res.ok) {
                lastFail = res;
                break;
            }
            bought += res.amount || row.gap;
        }
        if (bought <= 0) {
            return { ok: false, reason: (lastFail && lastFail.reason) || 'FAILED' };
        }
        return { ok: true, bought: bought, partial: !!lastFail, reason: lastFail && lastFail.reason };
    }

    finishResourceBuyAction() {
        const modal = this._resBuyModal;
        if (!modal || !modal.action || typeof profileManager === 'undefined') {
            return { ok: false, reason: 'NO ACTION' };
        }
        const act = modal.action;
        if (act.type === 'station-upgrade') {
            return profileManager.buyStationUpgrade(act.id);
        }
        if (act.type === 'frame-upgrade') {
            return profileManager.purchaseShipFrameUpgrade(act.id);
        }
        if (act.type === 'module-upgrade') {
            return profileManager.purchaseModuleUpgrade(act.cat, act.track);
        }
        if (act.type === 'craft') {
            return profileManager.craftShip(act.id);
        }
        return { ok: false, reason: 'UNKNOWN' };
    }

    bindResourceBuyModalEvents() {
        if (!this.overlay || !this._resBuyModal) return;
        const modal = this.overlay.querySelector('.hs-res-buy-modal');
        if (!modal) return;

        const closeBtn = modal.querySelector('[data-res-buy-close]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeResourceBuyModal());
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeResourceBuyModal();
        });

        modal.querySelectorAll('[data-res-buy-one]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-res-buy-one');
                const profile = this.getProfile();
                const missing = this.getMissingMaterials((profile && profile.resources) || {}, this._resBuyModal.cost);
                const row = missing.find((r) => r.id === id);
                if (!row || typeof profileManager === 'undefined') return;
                const res = profileManager.buyShopResource(id, row.gap, 'station');
                if (res.ok) {
                    this.statusMsg = 'BOUGHT ' + res.amount + ' ' + String(id).toUpperCase();
                    this.focusIndex = 0;
                    this.createUI();
                } else {
                    this.statusMsg = res.reason || 'BUY FAILED';
                    this.createUI();
                }
            });
        });

        const buyAll = modal.querySelector('[data-res-buy-all]');
        if (buyAll) {
            buyAll.addEventListener('click', () => {
                const res = this.buyMissingResources(true);
                if (res.ok) {
                    this.statusMsg = res.partial
                        ? ('BOUGHT PARTIAL · ' + (res.reason || 'CHECK CREDITS'))
                        : ('BOUGHT ' + res.bought + ' MATERIALS');
                    this.focusIndex = 0;
                    this.createUI();
                } else {
                    this.statusMsg = res.reason || 'BUY FAILED';
                    this.createUI();
                }
            });
        }

        const finish = modal.querySelector('[data-res-buy-finish]');
        if (finish) {
            finish.addEventListener('click', () => {
                const res = this.finishResourceBuyAction();
                const act = this._resBuyModal && this._resBuyModal.action;
                if (res.ok) {
                    this._resBuyModal = null;
                    let msg = 'UPGRADED';
                    if (act && act.type === 'station-upgrade') {
                        const node = (typeof economyConfig !== 'undefined')
                            ? economyConfig.getStationUpgradeNode(act.id)
                            : null;
                        msg = 'UPGRADED: ' + (node ? node.label : String(act.id).toUpperCase()) + ' L' + res.level;
                    } else if (act && act.type === 'craft') {
                        msg = 'CRAFTED: ' + this.shipName(act.id);
                    } else if (act && act.type === 'frame-upgrade') {
                        msg = 'FRAME UPGRADED: ' + this.shipName(act.id) + ' L' + res.level;
                    } else if (act && act.type === 'module-upgrade') {
                        msg = 'MODULE UPGRADE L' + res.level;
                    }
                    this.statusMsg = msg;
                    this.focusIndex = 0;
                    this.createUI();
                } else if (res.reason === 'RESOURCES') {
                    this.statusMsg = 'STILL NEED RESOURCES';
                    this.createUI();
                } else {
                    this.statusMsg = res.reason || 'FAILED';
                    this.createUI();
                }
            });
        }
    }

    shipModelClass(id, cfg) {
        if (cfg && cfg.modelClass) return String(cfg.modelClass).toLowerCase();
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.modelClassById) {
            return String(shipConfigManager.modelClassById[id] || '').toLowerCase();
        }
        return '';
    }

    shipClassLabel(modelClass) {
        const map = {
            starfighter: 'STARFIGHTER',
            interceptor: 'INTERCEPTOR',
            heavy_fighter: 'HEAVY',
            assault: 'ASSAULT'
        };
        return map[modelClass] || String(modelClass || 'SHIP').toUpperCase();
    }

    resetShopControlsIfNeeded(prevCategory) {
        if (!prevCategory || prevCategory === this.shopCategory) return;
        this.captureShopPrefs(prevCategory);
        this.applyShopPrefsForCategory(this.shopCategory);
    }

    getShopFaction(profile) {
        if (typeof profileManager !== 'undefined' && profileManager.getShopFaction) {
            return profileManager.getShopFaction(profile || this.getProfile());
        }
        return 'terran';
    }

    getPortalFactionFilters(profile) {
        const filters = [{ id: 'all', label: 'ALL', icon: 'menuPeoples' }];
        const seen = {};
        const p = profile || this.getProfile();
        const discovered = (typeof profileManager !== 'undefined' && profileManager.getDiscoveredFactions)
            ? profileManager.getDiscoveredFactions(p)
            : ['terran'];
        const known = {};
        discovered.forEach((fid) => { known[String(fid).toLowerCase()] = 1; });

        const ids = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyIds()
            : ['milky_way', 'andromeda'];
        ids.forEach((gid) => {
            const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
                ? planetConfigManager.getGalaxyFaction(gid)
                : '';
            const id = String(faction || '').toLowerCase();
            if (!id || seen[id]) return;
            if (!known[id]) return;
            seen[id] = 1;
            const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
                ? planetConfigManager.getFactionMeta(id)
                : { label: id.toUpperCase(), icon: null };
            filters.push({
                id: id,
                label: meta.label || id.toUpperCase(),
                icon: meta.icon || null
            });
        });
        return filters;
    }

    renderShopToolbar() {
        const isParts = this.shopCategory === 'parts';
        const isPortals = this.shopCategory === 'portals';
        const isResources = this.shopCategory === 'resources';
        const filters = isResources
            ? this._resourceBagFilters
            : (isPortals
                ? this.getPortalFactionFilters()
                : (isParts ? this._partTypeFilters : this._shipClassFilters));
        const validFilters = filters.map((f) => f.id);
        if (validFilters.indexOf(this.shopFilter) === -1) {
            this.shopFilter = isResources ? 'station' : 'all';
        }
        if (!this._shopSortOptions.some((s) => s.id === this.shopSort)) this.shopSort = 'name';
        if (this._resourceQtyOptions.indexOf(this.shopResourceQty) === -1) this.shopResourceQty = 1;

        const filterBtns = filters.map((f) => {
            const active = this.shopFilter === f.id ? ' active' : '';
            const icon = ((isPortals || isResources) && f.icon)
                ? `<span class="hs-shop-ctrl-icon">${this.iconHtml(f.icon, 20, 'hs-pixel hs-pixel-20')}</span>`
                : '';
            return `<button type="button" class="hs-shop-ctrl${active}" data-shop-filter="${f.id}" data-nav-item>` +
                `${icon}<span>${f.label}</span></button>`;
        }).join('');

        const sortBtns = this._shopSortOptions.map((s) => {
            const active = this.shopSort === s.id ? ' active' : '';
            let label = s.label;
            if (isParts && s.id === 'tier') label = 'TYPE';
            if (isPortals && s.id === 'tier') label = 'WARP';
            if (isResources && s.id === 'tier') label = 'STOCK';
            if (isResources && s.id === 'cost') label = 'PRICE';
            return `<button type="button" class="hs-shop-ctrl${active}" data-shop-sort="${s.id}" data-nav-item>${label}</button>`;
        }).join('');

        let qtyGroup = '';
        if (isResources) {
            const qtyBtns = this._resourceQtyOptions.map((q) => {
                const active = this.shopResourceQty === q ? ' active' : '';
                const label = q === 'all' ? 'ALL' : ('×' + q);
                return `<button type="button" class="hs-shop-ctrl${active}" data-shop-qty="${q}" data-nav-item>${label}</button>`;
            }).join('');
            qtyGroup = `<div class="hs-shop-ctrl-group">` +
                `<span class="hs-shop-ctrl-label">QTY</span>` +
                `<div class="hs-shop-ctrl-row">${qtyBtns}</div>` +
                `</div>`;
        }

        let loreHint = '';
        if (isPortals && this.shopFilter && this.shopFilter !== 'all'
            && typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta) {
            const meta = planetConfigManager.getFactionMeta(this.shopFilter);
            loreHint = `<p class="hs-muted hs-hint hs-faction-lore">` +
                `<span class="hs-shop-ctrl-icon">${this.iconHtml(meta.icon, 20, 'hs-pixel hs-pixel-20')}</span>` +
                `<strong>${meta.label}</strong> — ${meta.lore}</p>`;
        }

        return `<div class="hs-shop-toolbar">` +
            `<div class="hs-shop-ctrl-group">` +
            `<span class="hs-shop-ctrl-label">${isResources ? 'BAG' : 'FILTER'}</span>` +
            `<div class="hs-shop-ctrl-row">${filterBtns}</div>` +
            `</div>` +
            qtyGroup +
            `<div class="hs-shop-ctrl-group">` +
            `<span class="hs-shop-ctrl-label">SORT</span>` +
            `<div class="hs-shop-ctrl-row">${sortBtns}</div>` +
            `</div>` +
            `</div>${loreHint}`;
    }

    renderShopCostHeader() {
        return `<div class="hs-shop-line hs-shop-head">` +
            `<span class="hs-line-name"><span class="hs-line-meta">ITEM</span></span>` +
            `<span class="hs-cost-grid">` +
            `<span class="hs-cost-cell hs-cost-head hs-res-credits" title="CREDITS">` +
            `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey('credits'), 20, 'hs-pixel hs-pixel-20')}</span>` +
            `<span class="hs-cost-label">CREDITS</span>` +
            `</span></span>` +
            `<span class="hs-line-action">BUY</span>` +
            `</div>`;
    }

    sortShopEntries(entries) {
        const mode = this.shopSort || 'name';
        const list = entries.slice();
        list.sort((a, b) => {
            if (mode === 'cost') {
                const d = (a.costTotal || 0) - (b.costTotal || 0);
                if (d !== 0) return d;
            } else if (mode === 'tier') {
                const d = (a.tier || 0) - (b.tier || 0);
                if (d !== 0) return d;
                if (a.kind && b.kind && a.kind !== b.kind) {
                    return a.kind < b.kind ? -1 : 1;
                }
            }
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
        return list;
    }

    getFocusables() {
        if (this._resBuyModal && this.overlay) {
            const modal = this.overlay.querySelector('.hs-res-buy-modal');
            if (modal) {
                return Array.prototype.slice.call(
                    modal.querySelectorAll('[data-nav-item]:not([disabled])')
                );
            }
        }
        if (typeof menuNavHelper !== 'undefined') {
            return menuNavHelper.collectFocusables(this.overlay);
        }
        if (!this.overlay) return [];
        return Array.prototype.slice.call(this.overlay.querySelectorAll('button.action-button:not([disabled])'));
    }

    refreshFocus() {
        const list = this.getFocusables();
        if (typeof menuNavHelper !== 'undefined') {
            this.focusIndex = menuNavHelper.applyFocus(list, this.focusIndex);
        } else {
            this.focusIndex = Math.max(0, Math.min(list.length - 1, this.focusIndex));
            list.forEach((el, i) => el.classList.toggle('nav-focused', i === this.focusIndex));
        }
        const focused = list[this.focusIndex];
        if (focused && focused.classList && focused.classList.contains('hs-upg-node')) {
            this.showUpgradeTip(focused);
        } else if (this._upgTipBtn) {
            this.hideUpgradeTip();
        }
    }

    captureScrollState() {
        if (!this.overlay) return null;
        const body = this.overlay.querySelector('.hs-body');
        const tree = this.overlay.querySelector('.hs-upg-tree-scroll');
        return {
            bodyTop: body ? body.scrollTop : 0,
            bodyLeft: body ? body.scrollLeft : 0,
            treeTop: tree ? tree.scrollTop : 0,
            treeLeft: tree ? tree.scrollLeft : 0
        };
    }

    restoreScrollState(state) {
        if (!state || !this.overlay) return;
        const apply = () => {
            const body = this.overlay.querySelector('.hs-body');
            const tree = this.overlay.querySelector('.hs-upg-tree-scroll');
            if (body) {
                body.scrollTop = state.bodyTop;
                body.scrollLeft = state.bodyLeft;
            }
            if (tree) {
                tree.scrollTop = state.treeTop;
                tree.scrollLeft = state.treeLeft;
            }
        };
        apply();
        requestAnimationFrame(apply);
    }

    /** Keep parallax BG layers alive across content rebuilds (enables crossfade). */
    setOverlayHtml(html) {
        if (!this.overlay) return;
        this.hideUpgradeTip();
        const keep = Array.from(this.overlay.querySelectorAll(
            ':scope > .vf-bg-parallax-base, :scope > .vf-bg-parallax-glow'
        ));
        this.overlay.innerHTML = html;
        for (let i = keep.length - 1; i >= 0; i--) {
            this.overlay.insertBefore(keep[i], this.overlay.firstChild);
        }
    }

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
            body = this.renderHangarTab(profile);
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
        this.setOverlayHtml(`
            <div class="profile-selection-content home-station-content hs-nav-tabs${this.tab === 'station' ? ' hs-mode-station' : ''}${isPlay ? ' hs-mode-play' : ''}${isMenu ? ' hs-mode-menu' : ''}${isComp ? ' hs-mode-components' : ''}">
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
            this.setupHangarPanelResize();
            this.startHangarPreview();
            this.drawHangarBay();
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
    }

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
    }

    launchPlay() {
        this.tab = 'play';
        this.statusMsg = '';
        this.focusIndex = 0;
        this.persistTab();
        this.createUI();
    }

    renderPlayTab(profile) {
        return `<div class="hs-play-shell" id="hsPlayMount" data-nav-section="play"></div>`;
    }

    mountPlayTab() {
        const mount = this.overlay && this.overlay.querySelector('#hsPlayMount');
        if (!mount || typeof galaxyMapManager === 'undefined') return;
        const profile = this.getProfile();
        const galaxyId = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : 'milky_way';
        galaxyMapManager.show({
            galaxyId: galaxyId,
            mount: mount,
            onConfirm: (planet) => this.startMission(planet),
            onBack: () => {
                this.exitPlayMap();
                this.tab = 'station';
                this.statusMsg = '';
                this.persistTab();
                this.createUI();
            },
            onEscape: () => {
                this.exitPlayMap();
            },
            onExplored: () => {}
        });
        this.syncPlayHint();
    }

    getActivePlayShipId() {
        if (typeof profileManager !== 'undefined' && profileManager.getActiveShipId) {
            const id = profileManager.getActiveShipId();
            if (id) return id;
        }
        return this.hangarShipId || 'player_scrap';
    }

    startMission(planet) {
        if (!planet) return;
        const shipId = this.getActivePlayShipId();
        const ship = this.getHangarShipModel(shipId);
        if (ship && !ship.id) ship.id = shipId;
        if (ship && !ship.type) ship.type = shipId;

        const planetId = String(planet.planetId || planet.id || '').toLowerCase();
        let levelId = String(planet.levelId || '').toLowerCase();
        if (!levelId && planetId) {
            if (planet.startMode === 'start') {
                levelId = `${planetId}-1`;
            } else if (typeof profileManager !== 'undefined' && profileManager.getResumeLevelId) {
                levelId = profileManager.getResumeLevelId(planetId) || `${planetId}-1`;
            } else {
                levelId = planetId;
            }
        }
        const level = {
            id: levelId,
            name: planet.name || String(planet.planetId || planet.id || '').toUpperCase(),
            difficulty: planet.difficulty || '',
            unlocked: planet.unlocked !== false,
            description: planet.description || '',
            enemyCount: planet.enemyCount || 0,
            obstacleCount: planet.obstacleCount || 0,
            reward: planet.reward || 'XP',
            galaxyId: planet.galaxyId || null
        };
        if (!planetId) {
            this.setStatus('NO PLANET SELECTED');
            return;
        }
        if (level.unlocked === false) {
            this.setStatus('PLANET LOCKED');
            return;
        }

        if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
            profileManager.setActiveShip(shipId);
        }
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setPlayerShipModel(ship);
        }

        this.hide();

        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.startGameWithLevelAndShip(level, ship);
        }
    }

    isPlayMapActive() {
        return !!(typeof galaxyMapManager !== 'undefined' &&
            galaxyMapManager.isVisible &&
            galaxyMapManager._mountEl &&
            galaxyMapManager.isInputActive());
    }

    enterPlayMap() {
        if (typeof galaxyMapManager === 'undefined' || !galaxyMapManager.isVisible) return false;
        this._navLevel = 'content';
        galaxyMapManager.armInput();
        this.syncNavHint();
        return true;
    }

    exitPlayMap() {
        if (typeof galaxyMapManager === 'undefined') return false;
        if (!galaxyMapManager.isVisible || !galaxyMapManager._mountEl) return false;
        const wasActive = galaxyMapManager.isInputActive();
        galaxyMapManager.disarmInput();
        this._navLevel = 'tabs';
        this.focusActiveTab();
        this.syncNavHint();
        return wasActive || true;
    }

    isMenuChrome(el) {
        return !!(el && (el.id === 'hsMenu' ||
            (el.classList && el.classList.contains('hs-menu-btn'))));
    }

    isTabChromeFocused() {
        const list = this.getFocusables();
        const el = list[this.focusIndex];
        if (!el) return false;
        if (this.isMainTabChrome(el)) return true;
        if (this.isMenuChrome(el)) return true;
        return false;
    }

    hasSubTabs() {
        return this.tab === 'shop' || this.tab === 'upgrade';
    }

    isSubTabEl(el) {
        if (!el || !el.hasAttribute) return false;
        return el.hasAttribute('data-shop-cat') || el.hasAttribute('data-upgrade-sub');
    }

    isContentFocusable(el) {
        if (!el) return false;
        if (this.isMainTabChrome(el) || this.isMenuChrome(el) || this.isSubTabEl(el)) return false;
        return true;
    }

    getNavLevel() {
        if (this.tab === 'play' && this.isPlayMapActive()) return 'content';
        return this._navLevel || 'tabs';
    }

    isContentNavActive() {
        return this.getNavLevel() !== 'tabs';
    }

    getZoneFocusables() {
        const all = this.getFocusables();
        const level = this.getNavLevel();
        if (level === 'tabs') {
            return all.filter((el) => this.isMainTabChrome(el) || this.isMenuChrome(el));
        }
        if (level === 'sub') {
            return all.filter((el) => this.isSubTabEl(el));
        }
        return all.filter((el) => this.isContentFocusable(el));
    }

    setFocusEl(el) {
        const list = this.getFocusables();
        const idx = el ? list.indexOf(el) : -1;
        if (idx < 0) return false;
        this.focusIndex = (typeof menuNavHelper !== 'undefined')
            ? menuNavHelper.applyFocus(list, idx)
            : idx;
        this.refreshFocus();
        this.scrollFocusedIntoView();
        return true;
    }

    focusActiveSubTab() {
        if (!this.overlay || !this.hasSubTabs()) return false;
        const active = this.overlay.querySelector('.hs-shop-cats .hs-shop-cat.active') ||
            this.overlay.querySelector('[data-shop-cat].active, [data-upgrade-sub].active');
        if (!this.setFocusEl(active)) {
            const first = this.overlay.querySelector('.hs-shop-cats [data-nav-item]');
            return this.setFocusEl(first);
        }
        return true;
    }

    findFirstContentFocusable(list) {
        if (!list || !list.length) return -1;
        for (let i = 0; i < list.length; i++) {
            if (this.isContentFocusable(list[i])) return i;
        }
        return -1;
    }

    restoreNavFocus() {
        const level = this._navLevel || 'tabs';
        if (level === 'sub' && this.hasSubTabs()) {
            this._navLevel = 'sub';
            this.focusActiveSubTab();
            return;
        }
        if (level === 'content' && this.tab !== 'menu') {
            this._navLevel = 'content';
            const list = this.getFocusables();
            const idx = this.findFirstContentFocusable(list);
            if (idx >= 0) {
                this.focusIndex = (typeof menuNavHelper !== 'undefined')
                    ? menuNavHelper.applyFocus(list, idx)
                    : idx;
                this.refreshFocus();
                return;
            }
        }
        this._navLevel = 'tabs';
        this.focusActiveTab();
    }

    enterSubTabs() {
        if (!this.hasSubTabs()) return false;
        this._navLevel = 'sub';
        this.focusActiveSubTab();
        this.syncNavHint();
        return true;
    }

    enterTabContent() {
        if (this.tab === 'play') return this.enterPlayMap();
        if (this.tab === 'menu') return false;
        if (this.getNavLevel() === 'tabs' && this.hasSubTabs()) {
            return this.enterSubTabs();
        }
        const list = this.getFocusables();
        const bodyIdx = this.findFirstContentFocusable(list);
        this._navLevel = 'content';
        if (bodyIdx >= 0) {
            this.focusIndex = (typeof menuNavHelper !== 'undefined')
                ? menuNavHelper.applyFocus(list, bodyIdx)
                : bodyIdx;
            this.refreshFocus();
            this.scrollFocusedIntoView();
        } else {
            this.refreshFocus();
        }
        this.syncNavHint();
        return true;
    }

    exitTabContent() {
        if (this.tab === 'play' && this.isPlayMapActive()) {
            return this.exitPlayMap();
        }
        const level = this.getNavLevel();
        if (level === 'content' && this.hasSubTabs()) {
            this._navLevel = 'sub';
            this.focusActiveSubTab();
            this.syncNavHint();
            return true;
        }
        if (level === 'content' || level === 'sub') {
            this._navLevel = 'tabs';
            this.focusActiveTab();
            this.syncNavHint();
            return true;
        }
        return false;
    }

    switchSubTab(dir) {
        if (this.tab === 'shop') {
            const ids = this._shopCategories;
            const idx = ids.indexOf(this.shopCategory);
            const next = ids[(idx + dir + ids.length) % ids.length];
            const prev = this.shopCategory;
            this.shopCategory = next;
            this.resetShopControlsIfNeeded(prev);
            this.statusMsg = '';
            this._navLevel = 'sub';
            this.persistTab();
            this.createUI();
            return true;
        }
        if (this.tab === 'upgrade') {
            const ids = this._upgradeSubTabs;
            const idx = ids.indexOf(this.upgradeSubTab);
            const next = ids[(idx + dir + ids.length) % ids.length];
            this.upgradeSubTab = next;
            this._resBuyModal = null;
            this.statusMsg = '';
            this._navLevel = 'sub';
            this.createUI();
            return true;
        }
        return false;
    }

    syncNavHint() {
        this.syncNavZone();
        if (!this.overlay || this.tab === 'menu') return;
        const hint = this.overlay.querySelector('.hs-footer .profile-selection-instructions p');
        if (!hint) return;
        const level = this.getNavLevel();
        if (this.tab === 'play') {
            if (this.isPlayMapActive()) {
                hint.textContent = '[MAP] ARROWS Planets | ENTER Start Mission | ESC Back to Tabs';
            } else {
                hint.textContent = '[TABS] ←→ Switch | ENTER Enter Map | ESC Menu';
            }
            return;
        }
        if (level === 'sub') {
            hint.textContent = '[SECTION] ←→ Switch | ENTER Enter Content | ESC Back to Tabs';
            return;
        }
        if (level === 'content') {
            const back = this.hasSubTabs() ? 'ESC Back to Section' : 'ESC Back to Tabs';
            if (this.tab === 'components') {
                hint.textContent = `[CONTENT] ↑↓←→ Navigate | GENERATE / ACCEPT | ${back}`;
            } else {
                hint.textContent = `[CONTENT] ↑↓←→ Navigate | ENTER Select | ${back}`;
            }
            return;
        }
        const enterLabel = this.hasSubTabs() ? 'ENTER Sections' : 'ENTER Enter Tab';
        hint.textContent = `[TABS] ←→ Switch | ${enterLabel} | ESC Menu`;
    }

    syncNavZone() {
        if (!this.overlay) return;
        const root = this.overlay.querySelector('.home-station-content');
        if (!root) return;
        root.classList.remove('hs-nav-tabs', 'hs-nav-sub', 'hs-nav-content', 'hs-nav-menu');
        if (this.tab === 'menu') {
            root.classList.add('hs-nav-menu');
            return;
        }
        const level = this.getNavLevel();
        if (level === 'sub') root.classList.add('hs-nav-sub');
        else if (level === 'content') root.classList.add('hs-nav-content');
        else root.classList.add('hs-nav-tabs');
    }

    syncPlayHint() {
        this.syncNavHint();
    }

    unmountPlayTab() {
        if (typeof galaxyMapManager === 'undefined') return;
        if (galaxyMapManager.isVisible && galaxyMapManager._mountEl) {
            galaxyMapManager.hide();
        }
    }

    focusActiveTab() {
        const list = this.getFocusables();
        const active = this.overlay && (
            this.overlay.querySelector('.hs-tab.active') ||
            this.overlay.querySelector('.hs-home-btn.active')
        );
        const idx = active ? list.indexOf(active) : -1;
        if (idx >= 0) this.focusIndex = idx;
        this.refreshFocus();
    }

    renderResourceList(map, bagKind) {
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map || {});
        const profile = this.getProfile();
        const stats = (typeof profileManager !== 'undefined' && profile)
            ? profileManager.getStationStats(profile)
            : { resourceCap: 80, cargoCap: 40 };
        const cap = bagKind === 'cargo' ? stats.cargoCap : stats.resourceCap;
        const parts = ids.map((id) => {
            const n = (map && map[id]) || 0;
            const label = (typeof economyConfig !== 'undefined')
                ? economyConfig.getResourceLabel(id)
                : id.toUpperCase();
            const empty = n <= 0 ? ' hs-res-empty' : '';
            const full = n >= cap ? ' hs-res-full' : '';
            return `<span class="hs-chip hs-res-chip hs-res-${id}${empty}${full}">` +
                `<span class="hs-chip-icon">${this.iconHtml(this.resourceIconKey(id), 32, 'hs-pixel')}</span>` +
                `<span class="hs-chip-meta">` +
                `<span class="hs-chip-label">${label}</span>` +
                `<span class="hs-chip-value">${n}<span class="hs-chip-cap">/${cap}</span></span>` +
                `</span>` +
                `</span>`;
        });
        return parts.join('') || '<span class="hs-muted hs-empty-slot">EMPTY</span>';
    }

    formatUpgradeEffect(node, level) {
        if (!node || typeof node.effect !== 'function' || level <= 0) return '—';
        const bonus = node.effect(level) || {};
        const parts = [];
        if (bonus.resourceCap) parts.push('+' + bonus.resourceCap + ' STORE');
        if (bonus.cargoCap) parts.push('+' + bonus.cargoCap + ' CARGO');
        if (bonus.shipSlots) parts.push('+' + bonus.shipSlots + ' SHIP SLOT' + (bonus.shipSlots > 1 ? 'S' : ''));
        if (bonus.craftDiscount) parts.push('-' + Math.round(bonus.craftDiscount * 100) + '% CRAFT');
        if (bonus.dropBonus) parts.push('+' + Math.round(bonus.dropBonus * 1000) / 10 + '% BP DROP');
        if (bonus.impulseDrive) parts.push('IMPULSE READY');
        if (bonus.warpDrive) parts.push('WARP ' + bonus.warpDrive);
        if (bonus.exploreBudget) parts.push('+' + bonus.exploreBudget + ' EXPLORE');
        return parts.join(' · ') || 'ACTIVE';
    }

    buildUpgradeSlotBadges(level, maxLevel) {
        const max = Math.max(1, Math.round(Number(maxLevel) || 1));
        const filled = Math.max(0, Math.min(max, Math.round(Number(level) || 0)));
        const slots = [];
        for (let i = 0; i < max; i++) {
            slots.push(`<span class="hs-upg-slot${i < filled ? ' filled' : ''}"></span>`);
        }
        return `<span class="hs-upg-slots" aria-hidden="true">${slots.join('')}</span>`;
    }

    renderUpgradeSubTabs() {
        return this._upgradeSubTabs.map((id) => {
            const meta = this._upgradeSubMeta[id] || { label: id.toUpperCase() };
            const active = this.upgradeSubTab === id;
            return `<button type="button" class="hs-shop-cat ${active ? 'active' : ''}" data-upgrade-sub="${id}" data-nav-item>` +
                `<span class="hs-chip-icon">${this.iconHtml(meta.icon, 32, 'hs-pixel')}</span>` +
                `<span>${meta.label}</span></button>`;
        }).join('');
    }

    buildUpgradeTooltip(node, level, maxed, locked, check, cost, tipBelow) {
        const price = cost ? this.formatBagMap(cost) : '';
        let statusLine = '';
        if (maxed) {
            statusLine = '<div class="hs-upg-tip-row">STATUS · MAX</div>';
        } else if (locked) {
            const req = economyConfig.getStationUpgradeNode(node.requires);
            const reqName = req ? req.label : String(node.requires || '').toUpperCase();
            statusLine = `<div class="hs-upg-tip-row">REQ · ${reqName} ${node.requireLevel || 1}</div>`;
        } else if (check && check.ok) {
            statusLine = `<div class="hs-upg-tip-row hs-upg-tip-ok">UPGRADE · ${price}</div>`;
        } else {
            statusLine = `<div class="hs-upg-tip-row">NEED · ${price || (check && check.reason) || '—'}</div>`;
        }
        return `<div class="hs-upg-tip${tipBelow ? ' below' : ''}" role="tooltip">` +
            `<div class="hs-upg-tip-title">${node.label} · ${level}/${node.maxLevel}</div>` +
            `<div class="hs-upg-tip-desc">${node.desc || ''}</div>` +
            `<div class="hs-upg-tip-row">${level > 0 ? 'NOW · ' + this.formatUpgradeEffect(node, level) : 'NOT BUILT'}</div>` +
            (!maxed ? `<div class="hs-upg-tip-row">NEXT · ${this.formatUpgradeEffect(node, level + 1)}</div>` : '') +
            statusLine +
            `</div>`;
    }

    ensureUpgradeTipHost() {
        if (this._upgTipHost && this._upgTipHost.isConnected) return this._upgTipHost;
        const el = document.createElement('div');
        el.className = 'hs-upg-tip hs-upg-tip-float';
        el.setAttribute('role', 'tooltip');
        el.hidden = true;
        document.body.appendChild(el);
        this._upgTipHost = el;
        return el;
    }

    showUpgradeTip(btn) {
        if (!btn || !btn.isConnected) {
            this.hideUpgradeTip();
            return;
        }
        const source = btn.querySelector('.hs-upg-tip');
        if (!source) {
            this.hideUpgradeTip();
            return;
        }
        const host = this.ensureUpgradeTipHost();
        this._upgTipBtn = btn;
        host.innerHTML = source.innerHTML;
        host.hidden = false;
        host.classList.add('visible');
        host.classList.remove('below');
        if (this._upgTipRaf) cancelAnimationFrame(this._upgTipRaf);
        this._upgTipRaf = requestAnimationFrame(() => {
            this._upgTipRaf = 0;
            if (this._upgTipBtn !== btn || !btn.isConnected) return;
            this.positionUpgradeTip(btn, host);
        });
    }

    positionUpgradeTip(btn, host) {
        if (!btn || !host || !btn.isConnected) {
            this.hideUpgradeTip();
            return;
        }
        const r = btn.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
            this.hideUpgradeTip();
            return;
        }
        const tw = host.offsetWidth;
        const th = host.offsetHeight;
        let left = r.left + (r.width / 2) - (tw / 2);
        let top = r.top - th - 12;
        host.classList.remove('below');
        if (top < 8) {
            top = r.bottom + 12;
            host.classList.add('below');
        }
        left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
        if (top + th > window.innerHeight - 8 && !host.classList.contains('below')) {
            top = Math.max(8, window.innerHeight - th - 8);
        }
        host.style.left = Math.round(left) + 'px';
        host.style.top = Math.round(top) + 'px';
    }

    hideUpgradeTip() {
        this._upgTipBtn = null;
        if (this._upgTipRaf) {
            cancelAnimationFrame(this._upgTipRaf);
            this._upgTipRaf = 0;
        }
        if (!this._upgTipHost) return;
        this._upgTipHost.classList.remove('visible', 'below');
        this._upgTipHost.hidden = true;
        this._upgTipHost.innerHTML = '';
        this._upgTipHost.style.left = '';
        this._upgTipHost.style.top = '';
    }

    bindUpgradeTipEvents() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-upg-node').forEach((btn) => {
            btn.addEventListener('pointerenter', () => this.showUpgradeTip(btn));
            btn.addEventListener('pointerleave', () => {
                if (this._upgTipBtn === btn) this.hideUpgradeTip();
            });
            btn.addEventListener('focus', () => this.showUpgradeTip(btn));
            btn.addEventListener('blur', () => {
                if (this._upgTipBtn === btn) this.hideUpgradeTip();
            });
        });
        const scroll = this.overlay.querySelector('.hs-upg-tree-scroll');
        if (scroll) {
            scroll.addEventListener('scroll', () => {
                if (!this._upgTipBtn) return;
                this.positionUpgradeTip(this._upgTipBtn, this.ensureUpgradeTipHost());
            }, { passive: true });

            let pan = null;
            scroll.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
            scroll.addEventListener('pointerdown', (e) => {
                if (e.button !== 2) return;
                pan = {
                    x: e.clientX,
                    y: e.clientY,
                    left: scroll.scrollLeft,
                    top: scroll.scrollTop
                };
                scroll.classList.add('is-panning');
                scroll.setPointerCapture(e.pointerId);
                e.preventDefault();
            });
            scroll.addEventListener('pointermove', (e) => {
                if (!pan) return;
                scroll.scrollLeft = pan.left - (e.clientX - pan.x);
                scroll.scrollTop = pan.top - (e.clientY - pan.y);
                e.preventDefault();
            });
            const stopPan = (e) => {
                if (!pan) return;
                pan = null;
                scroll.classList.remove('is-panning');
                if (e && scroll.hasPointerCapture(e.pointerId)) {
                    scroll.releasePointerCapture(e.pointerId);
                }
            };
            scroll.addEventListener('pointerup', stopPan);
            scroll.addEventListener('pointercancel', stopPan);
        }
    }

    renderStationUpgradeTree(profile) {
        if (typeof economyConfig === 'undefined' || typeof profileManager === 'undefined') {
            return `<p class="hs-muted">Upgrade system unavailable.</p>`;
        }
        const stats = profileManager.getStationStats(profile);
        const order = economyConfig.stationUpgradeOrder || [];
        const nodes = [];
        const byId = {};
        const pos = {};
        let maxX = 0;
        let maxY = 0;
        order.forEach((id) => {
            const node = economyConfig.getStationUpgradeNode(id);
            if (!node) return;
            nodes.push(node);
            byId[node.id] = node;
            const tx = Number(node.treeX != null ? node.treeX : ((node.treeCol || 0) + 0.5) * 20);
            const ty = Number(node.treeY != null ? node.treeY : ((node.treeRow || 0) + 0.5) * 20);
            pos[node.id] = { tx, ty };
            maxX = Math.max(maxX, tx);
            maxY = Math.max(maxY, ty);
        });
        const nodeSize = 76;
        const half = nodeSize / 2;
        const padX = 56;
        const padY = 56;
        const scaleX = 12.4;
        const scaleY = 10.2;
        const treeW = Math.ceil(padX * 2 + maxX * scaleX + nodeSize);
        const treeH = Math.ceil(padY * 2 + maxY * scaleY + nodeSize);

        const centerOf = (node) => {
            const p = pos[node.id] || { tx: 0, ty: 0 };
            return {
                x: Math.round(padX + p.tx * scaleX),
                y: Math.round(padY + p.ty * scaleY)
            };
        };

        const kidsByParent = {};
        nodes.forEach((n) => {
            if (!n.requires || !byId[n.requires]) return;
            if (!kidsByParent[n.requires]) kidsByParent[n.requires] = [];
            kidsByParent[n.requires].push(n);
        });

        const linkParts = [];
        Object.keys(kidsByParent).forEach((pid) => {
            const parent = byId[pid];
            const kids = kidsByParent[pid];
            const a = centerOf(parent);
            const parentBottom = a.y + half;
            let minChildTop = Infinity;
            kids.forEach((k) => {
                minChildTop = Math.min(minChildTop, centerOf(k).y - half);
            });
            const gap = Math.max(12, Math.min(28, (minChildTop - parentBottom) * 0.4));
            const busY = parentBottom + gap;
            kids.forEach((k) => {
                const b = centerOf(k);
                const childLit = profileManager.getStationUpgradeLevel(k.requires, profile) >= (k.requireLevel || 1)
                    ? ' lit'
                    : '';
                const x1 = a.x;
                const y1 = parentBottom;
                const x2 = b.x;
                const y2 = b.y - half;
                const dx = Math.abs(x2 - x1);
                let d;
                if (dx < 6) {
                    d = `M ${Math.round(x1)} ${Math.round(y1)} L ${Math.round(x2)} ${Math.round(y2)}`;
                } else {
                    // Hard right-angle bus (no curves) for retro pixel look
                    d = `M ${Math.round(x1)} ${Math.round(y1)}` +
                        ` L ${Math.round(x1)} ${Math.round(busY)}` +
                        ` L ${Math.round(x2)} ${Math.round(busY)}` +
                        ` L ${Math.round(x2)} ${Math.round(y2)}`;
                }
                linkParts.push(
                    `<path class="hs-upg-link${childLit}" d="${d}" fill="none"/>`
                );
            });
        });

        const selectedId = this.selectedUpgradeNode && byId[this.selectedUpgradeNode]
            ? this.selectedUpgradeNode
            : (nodes[0] && nodes[0].id);

        const nodeButtons = nodes.map((node) => {
            const level = profileManager.getStationUpgradeLevel(node.id, profile);
            const maxed = level >= node.maxLevel;
            const check = profileManager.canUnlockStationUpgrade(node.id, profile);
            const locked = !maxed && check.reason === 'LOCKED';
            const cost = !maxed
                ? economyConfig.getStationUpgradeCost(node.id, level + 1)
                : null;
            let stateClass = 'hs-upg-node';
            if (maxed) stateClass += ' maxed';
            else if (locked) stateClass += ' locked';
            else if (check.ok) stateClass += ' available';
            else stateClass += ' blocked';
            if (node.id === selectedId) stateClass += ' selected';

            const c = centerOf(node);
            const left = c.x - half;
            const top = c.y - half;
            const canBuy = !maxed && !locked && check.ok;
            const tip = this.buildUpgradeTooltip(node, level, maxed, locked, check, cost, false);

            return `<button type="button" class="${stateClass}" style="left:${left}px;top:${top}px;width:${nodeSize}px;height:${nodeSize}px"` +
                ` data-nav-item data-upgrade-node="${node.id}"` +
                (canBuy ? ` data-upgrade="${node.id}"` : '') +
                ` aria-label="${node.label} ${level}/${node.maxLevel}">` +
                `<span class="hs-upg-face" aria-hidden="true"></span>` +
                `<span class="hs-upg-icon">${this.iconHtml(node.icon || 'hsUpgrade', 40, 'hs-pixel')}</span>` +
                this.buildUpgradeSlotBadges(level, node.maxLevel) +
                tip +
                `</button>`;
        }).join('');

        const sel = byId[selectedId];
        let dock = '';
        if (sel) {
            const level = profileManager.getStationUpgradeLevel(sel.id, profile);
            const maxed = level >= sel.maxLevel;
            const check = profileManager.canUnlockStationUpgrade(sel.id, profile);
            const locked = !maxed && check.reason === 'LOCKED';
            const cost = !maxed ? economyConfig.getStationUpgradeCost(sel.id, level + 1) : null;
            dock = `<div class="hs-upg-dock">${this.buildUpgradeTooltip(sel, level, maxed, locked, check, cost, false)
                .replace('hs-upg-tip', 'hs-upg-dock-body')
                .replace(' role="tooltip"', '')}</div>`;
        }

        const summaryChip = (icon, label, value) =>
            `<span class="hs-chip">` +
            `<span class="hs-chip-icon">${this.iconHtml(icon, 32, 'hs-pixel')}</span>` +
            `<span class="hs-chip-meta">` +
            `<span class="hs-chip-label">${label}</span>` +
            `<span class="hs-chip-value">${value}</span>` +
            `</span>` +
            `</span>`;

        const summary =
            `<div class="hs-upg-stats">` +
            summaryChip('hsStores', 'STORE', stats.resourceCap) +
            summaryChip('hsCargo', 'CARGO', stats.cargoCap) +
            summaryChip('hsShip', 'SHIPS', stats.shipSlots) +
            summaryChip('hsCraft', 'CRAFT', `-${Math.round((stats.craftDiscount || 0) * 100)}%`) +
            summaryChip('hsBlueprint', 'BP DROP', `+${Math.round((stats.dropBonus || 0) * 1000) / 10}%`) +
            summaryChip('hsUpgrade', 'WARP', 'L' + (stats.warpDrive || 0)) +
            `</div>`;

        return summary +
            `<div class="hs-upg-tree-scroll">` +
            `<div class="hs-upg-tree" style="width:${treeW}px;height:${treeH}px">` +
            `<svg class="hs-upg-links" width="${treeW}" height="${treeH}" viewBox="0 0 ${treeW} ${treeH}" shape-rendering="crispEdges" aria-hidden="true">${linkParts.join('')}</svg>` +
            nodeButtons +
            `</div></div>` +
            dock;
    }

    renderShipFrameUpgrades(profile) {
        const owned = profile.ownedShipIds || [];
        if (!owned.length) {
            return '<p class="hs-muted hs-empty-slot">NO SHIPS OWNED</p>';
        }
        const wallet = profile.resources || {};
        const max = (typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 9) : 9;
        return owned.map((id) => {
            const level = profileManager.getShipFrameLevel(id, profile);
            const check = profileManager.canPurchaseShipFrameUpgrade(id, profile);
            const caps = (typeof shipLoadoutManager !== 'undefined')
                ? shipLoadoutManager.getSlotCaps(id, this.shipModelClass(id, typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(id) : null) || 'starfighter')
                : { weapons: 1, defenses: 1, abilities: 1 };
            const cost = !check.ok && check.cost
                ? check.cost
                : (check.ok ? check.cost : (economyConfig.getShipFrameUpgradeCost(level + 1)));
            const maxed = level >= max;
            let action = '';
            if (maxed) {
                action = '<span class="hs-muted hs-line-action">MAX</span>';
            } else {
                action = `<button class="action-button hs-line-action" data-frame-up="${id}" ${check.ok ? '' : 'disabled'}>` +
                    `FRAME L${level + 1}` +
                    `</button>`;
            }
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${this.shipName(id)}</strong>` +
                `<span class="hs-line-meta">FRAME L${level}/${max} · SLOTS W${caps.weapons}/D${caps.defenses}/A${caps.abilities}</span>` +
                `</span></span>` +
                (cost && !maxed ? this.renderCostGrid(cost, wallet) : '<span></span>') +
                action +
                `</div>`;
        }).join('');
    }

    renderModuleTypeUpgrades(profile) {
        if (typeof economyConfig === 'undefined' || !economyConfig.moduleUpgradeDefs) {
            return '<p class="hs-muted">Module upgrades unavailable.</p>';
        }
        const wallet = profile.resources || {};
        const defs = economyConfig.moduleUpgradeDefs;
        const sections = Object.keys(defs).map((cat) => {
            const tracks = Object.keys(defs[cat]).map((track) => {
                const meta = defs[cat][track];
                const level = profileManager.getModuleUpgradeLevel(cat, track, profile);
                const check = profileManager.canPurchaseModuleUpgrade(cat, track, profile);
                const maxed = level >= meta.maxLevel;
                const cost = check.cost || economyConfig.getModuleUpgradeCost(cat, track, level + 1);
                let action = '';
                if (maxed) {
                    action = '<span class="hs-muted hs-line-action">MAX</span>';
                } else {
                    action = `<button class="action-button hs-line-action" data-mod-up="${cat}:${track}" ${check.ok ? '' : 'disabled'}>` +
                        `UPGRADE` +
                        `</button>`;
                }
                const icon = cat === 'weapons' ? 'statWeapon'
                    : (cat === 'defenses' ? 'statArmor'
                        : (cat === 'charge' ? 'statDamage'
                            : (cat === 'energy' ? 'ability_energy_shield'
                                : (cat === 'collector' ? 'hsCargo' : 'statAbilities'))));
                return `<div class="hs-line hs-shop-line">` +
                    `<span class="hs-line-name">` +
                    `<span class="hs-chip-icon">${this.iconHtml(icon, 32, 'hs-pixel')}</span>` +
                    `<span class="hs-line-text">` +
                    `<strong>${meta.label}</strong>` +
                    `<span class="hs-line-meta">${meta.desc} · L${level}/${meta.maxLevel}</span>` +
                    `</span></span>` +
                    (cost && !maxed ? this.renderCostGrid(cost, wallet) : '<span></span>') +
                    action +
                    `</div>`;
            }).join('');
            const titleIcon = cat === 'weapons' ? 'statWeapon'
                : (cat === 'defenses' ? 'statArmor'
                    : (cat === 'charge' ? 'statDamage'
                        : (cat === 'collector' ? 'hsCargo'
                            : (cat === 'energy' ? 'ability_energy_shield' : 'statAbilities'))));
            return `<div class="hs-panel" style="margin-bottom:12px">` +
                `${this.panelTitle(titleIcon, cat.toUpperCase())}` +
                tracks +
                `</div>`;
        }).join('');
        return sections;
    }

    renderUpgradeTab(profile) {
        if (typeof economyConfig === 'undefined' || typeof profileManager === 'undefined') {
            return `<div class="hs-section hs-panel">${this.panelTitle('hsUpgrade', 'UPGRADES')}` +
                `<p class="hs-muted">Upgrade system unavailable.</p></div>`;
        }
        let inner = '';
        let title = 'STATION UPGRADE TREE';
        let hint = 'Spend station resources to expand capacity, hangar slots, drives and station systems.';
        if (this.upgradeSubTab === 'ships') {
            title = 'SHIP FRAME UPGRADES';
            hint = 'Upgrade owned mainframes for more weapon / defense / ability slots and hull stats.';
            inner = this.renderShipFrameUpgrades(profile);
        } else if (this.upgradeSubTab === 'modules') {
            title = 'MODULE TYPE UPGRADES';
            hint = 'Global bonuses for weapons, defenses, abilities — and charge systems (after buying charge parts).';
            inner = this.renderModuleTypeUpgrades(profile);
        } else {
            inner = this.renderStationUpgradeTree(profile);
        }

        return `<div class="hs-section hs-panel hs-upgrade-root">` +
            `<div class="hs-shop-cats">${this.renderUpgradeSubTabs()}</div>` +
            `${this.panelTitle('hsUpgrade', title)}` +
            `<p class="hs-muted hs-hint">${hint}</p>` +
            `<div class="hs-tab-fill">${inner}</div>` +
            `</div>`;
    }

    renderTravelTab(profile) {
        const current = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : 'milky_way';
        const levels = (typeof profileManager !== 'undefined')
            ? profileManager.getStationUpgradeLevels(profile)
            : {};
        const ids = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyIds()
            : ['milky_way', 'andromeda'];
        const cards = ids.map((gid) => {
            const g = (typeof planetConfigManager !== 'undefined')
                ? planetConfigManager.getGalaxy(gid)
                : { id: gid, name: gid.toUpperCase() };
            const travel = (typeof profileManager !== 'undefined')
                ? profileManager.canTravelToGalaxy(gid, profile)
                : { ok: gid === 'milky_way' };
            const here = gid === current;
            const req = (typeof economyConfig !== 'undefined')
                ? economyConfig.getGalaxyWarpRequirement(gid)
                : 0;
            const planetCount = (g.planetIds && g.planetIds.length) || 0;
            const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
                ? planetConfigManager.getGalaxyFaction(gid)
                : ((g && g.faction) || '');
            const factionLabel = faction ? (' · FACTION ' + String(faction).toUpperCase()) : '';
            let action = '';
            if (here) {
                action = '<span class="hs-muted hs-line-action">CURRENT</span>';
            } else if (!travel.ok) {
                action = `<span class="hs-muted hs-line-action">NEED WARP L${req} OR PORTAL</span>`;
            } else {
                action = `<button class="action-button hs-line-action" data-travel="${gid}">TRAVEL HERE</button>`;
            }
            return `<div class="hs-line hs-shop-line ${here ? 'hs-travel-here' : ''} ${!travel.ok ? 'locked' : ''}">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsStation', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${(g && g.name) || gid.toUpperCase()}</strong>` +
                `<span class="hs-line-meta">${planetCount} PLANETS · WARP REQ L${req}${factionLabel}` +
                (here ? ' · HOME' : '') +
                `</span>` +
                `</span></span>` +
                action +
                `</div>`;
        }).join('');

        return `<div class="hs-section hs-panel">` +
            `${this.panelTitle('hsTravel', 'GALAXY TRAVEL')}` +
            `<p class="hs-muted hs-hint">Move the home station between galaxies. First travel into a foreign galaxy charts faction-matched planets and icons immediately. START only shows planets in the current galaxy. Unlock destinations with WARP DRIVE or buy a PORTAL in the shop.</p>` +
            `<p class="hs-line">CURRENT: <strong>${String(current).replace(/_/g, ' ').toUpperCase()}</strong> · WARP L${levels.warp_drive || 0}</p>` +
            `<div class="hs-tab-fill">${cards}</div>` +
            `</div>`;
    }

    isExploreItemVisible(itemId) {
        if (typeof startScreenManager !== 'undefined') {
            return startScreenManager.isExploreItemVisible(itemId);
        }
        return true;
    }

    renderExplorationsTab(profile) {
        const clusters = this._exploreClusters.map((cluster) => {
            const items = cluster.items.filter((entry) => this.isExploreItemVisible(entry.id));
            return { id: cluster.id, label: cluster.label, items: items };
        }).filter((cluster) => cluster.items.length > 0);

        if (!clusters.length) {
            return `<div class="hs-section hs-panel hs-explore-root">` +
                `${this.panelTitle('hsExplore', 'EXPLORATIONS')}` +
                `<div class="hs-tab-fill">` +
                `<p class="hs-muted hs-hint">No archive or arsenal entries unlocked yet. Discover ships, planets, enemies and gear in missions.</p>` +
                `</div></div>`;
        }

        const groups = clusters.map((cluster) => {
            const rows = cluster.items.map((entry) => {
                return `<button type="button" class="action-button hs-explore-item" data-explore="${entry.open}" data-nav-item>` +
                    `<span class="hs-chip-icon">${this.iconHtml(entry.icon, 32, 'hs-pixel')}</span>` +
                    `<span class="hs-explore-label">${entry.id}</span>` +
                    `</button>`;
            }).join('');
            return `<div class="hs-explore-cluster" data-cluster="${cluster.id}">` +
                `<div class="hs-explore-cluster-title">${cluster.label}</div>` +
                `<div class="hs-explore-cluster-items">${rows}</div>` +
                `</div>`;
        }).join('');

        return `<div class="hs-section hs-panel hs-explore-root">` +
            `${this.panelTitle('hsExplore', 'EXPLORATIONS')}` +
            `<p class="hs-muted hs-hint">Browse discovered ships, worlds, foes, peoples, events, equipment and components.</p>` +
            `<div class="hs-tab-fill hs-explore-grid">${groups}</div>` +
            `</div>`;
    }

    openExploration(kind) {
        const stationOnClose = this.onClose;
        const returnToExplorations = () => {
            this.show({
                tab: 'explorations',
                onClose: stationOnClose,
                focusExplore: kind
            });
        };
        if (kind === 'components') {
            this.show({
                tab: 'components',
                onClose: stationOnClose
            });
            return;
        }
        const openers = {
            ships: () => typeof shipViewerUI !== 'undefined' && shipViewerUI.show({ onClose: returnToExplorations }),
            planets: () => typeof planetViewerUI !== 'undefined' && planetViewerUI.show({ onClose: returnToExplorations }),
            enemies: () => typeof enemyViewerUI !== 'undefined' && enemyViewerUI.show({ onClose: returnToExplorations }),
            factions: () => typeof factionViewerUI !== 'undefined' && factionViewerUI.show({ onClose: returnToExplorations }),
            events: () => typeof eventViewerUI !== 'undefined' && eventViewerUI.show({ onClose: returnToExplorations }),
            weapons: () => typeof weaponViewerUI !== 'undefined' && weaponViewerUI.show({ onClose: returnToExplorations }),
            abilities: () => typeof abilityViewerUI !== 'undefined' && abilityViewerUI.show({ onClose: returnToExplorations }),
            defenses: () => typeof defenseViewerUI !== 'undefined' && defenseViewerUI.show({ onClose: returnToExplorations }),
            explosions: () => typeof explosionViewerUI !== 'undefined' && explosionViewerUI.show({ onClose: returnToExplorations })
        };
        const open = openers[kind];
        if (!open) return;
        this.tab = 'explorations';
        this.persistTab();
        this.hide();
        open();
    }

    renderCreditsBar(map, profile) {
        const p = profile || this.getProfile();
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(p)
            : Math.max(0, Math.round(Number((p && p.credits) || 0)));
        const creditChip = `<span class="hs-credit hs-res-credits${credits <= 0 ? ' hs-res-empty' : ''}">` +
            `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey('credits'), 16, 'hs-pixel hs-pixel-16')}</span>` +
            `<span class="hs-credit-amount">${credits}</span>` +
            `</span>`;
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map || {});
        const parts = ids.map((id) => {
            const n = (map && map[id]) || 0;
            const empty = n <= 0 ? ' hs-res-empty' : '';
            return `<span class="hs-credit hs-res-${id}${empty}">` +
                `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey(id), 16, 'hs-pixel hs-pixel-16')}</span>` +
                `<span class="hs-credit-amount">${n}</span>` +
                `</span>`;
        });
        return creditChip + (parts.join('') || '');
    }

    /** Larger wallet strip used inside SHOP (above category tabs). */
    renderShopWalletBar(profile) {
        const map = (profile && profile.resources) || {};
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const chip = (id, amount, iconId) => {
            const n = Math.max(0, Math.round(Number(amount) || 0));
            const empty = n <= 0 ? ' hs-res-empty' : '';
            return `<span class="hs-shop-wallet-item hs-res-${id}${empty}">` +
                `<span class="hs-shop-wallet-icon">${this.iconHtml(this.resourceIconKey(iconId || id), 32, 'hs-pixel hs-pixel-32')}</span>` +
                `<span class="hs-shop-wallet-meta">` +
                `<span class="hs-shop-wallet-label">${String(id).toUpperCase()}</span>` +
                `<span class="hs-shop-wallet-amount">${n}</span>` +
                `</span></span>`;
        };
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map);
        const mats = ids.map((id) => chip(id, map[id], id)).join('');
        return `<div class="hs-shop-wallet" aria-label="Resources">` +
            chip('credits', credits, 'credits') +
            mats +
            `</div>`;
    }

    renderBlueprintList(map) {
        const keys = Object.keys(map || {}).filter((k) => (map[k] || 0) > 0);
        if (!keys.length) return '<span class="hs-muted hs-empty-slot">NONE</span>';
        return keys.map((id) =>
            `<span class="hs-chip hs-chip-bp">` +
            `<span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
            `<span class="hs-chip-text">${this.shipName(id)} ×${map[id]}</span>` +
            `</span>`
        ).join('');
    }

    renderPartsList(profile) {
        const weapons = Object.keys((profile.parts && profile.parts.weapons) || {})
            .filter((id) => (profile.parts.weapons[id] || 0) > 0);
        const defenses = Object.keys((profile.parts && profile.parts.defenses) || {})
            .filter((id) => (profile.parts.defenses[id] || 0) > 0);
        const abilities = Object.keys((profile.parts && profile.parts.abilities) || {})
            .filter((id) => (profile.parts.abilities[id] || 0) > 0);
        if (!weapons.length && !defenses.length && !abilities.length) {
            return '<span class="hs-muted hs-empty-slot">NONE</span>';
        }
        const chips = [];
        weapons.forEach((id) => {
            const name = (typeof weaponConfigManager !== 'undefined')
                ? String(weaponConfigManager.getWeapon(id).name || id).toUpperCase()
                : id.toUpperCase();
            chips.push(
                `<span class="hs-chip hs-chip-part">` +
                `<span class="hs-chip-icon">${this.iconHtml('statWeapon', 32, 'hs-pixel')}</span>` +
                `<span class="hs-chip-text">WPN ${name} ×${profile.parts.weapons[id]}</span>` +
                `</span>`
            );
        });
        defenses.forEach((id) => {
            const name = (typeof abilityConfigManager !== 'undefined')
                ? String(abilityConfigManager.getDisplayName(id) || id).toUpperCase()
                : id.toUpperCase();
            chips.push(
                `<span class="hs-chip hs-chip-part">` +
                `<span class="hs-chip-icon">${this.iconHtml('statArmor', 32, 'hs-pixel')}</span>` +
                `<span class="hs-chip-text">DEF ${name} ×${profile.parts.defenses[id]}</span>` +
                `</span>`
            );
        });
        abilities.forEach((id) => {
            const name = (typeof abilityConfigManager !== 'undefined')
                ? String(abilityConfigManager.getDisplayName(id) || id).toUpperCase()
                : id.toUpperCase();
            chips.push(
                `<span class="hs-chip hs-chip-part">` +
                `<span class="hs-chip-icon">${this.iconHtml('statAbilities', 32, 'hs-pixel')}</span>` +
                `<span class="hs-chip-text">ABL ${name} ×${profile.parts.abilities[id]}</span>` +
                `</span>`
            );
        });
        return chips.join('');
    }

    renderUnlockList(profile) {
        const keys = Object.keys(profile.blueprints || {}).filter((k) => (profile.blueprints[k] || 0) > 0);
        if (!keys.length) {
            return '<p class="hs-muted hs-hint">Buy blueprints in the shop or collect drops.</p>';
        }
        return `<div class="hs-actions-col">${keys.map((id) => {
            const unlocked = profile.unlockedShopIds.indexOf(id) !== -1;
            if (unlocked) {
                return `<div class="hs-line hs-line-ok">` +
                    `<span class="hs-chip-icon">${this.iconHtml('hsShop', 32, 'hs-pixel')}</span>` +
                    `<span>${this.shipName(id)} — SHOP UNLOCKED</span>` +
                    `</div>`;
            }
            return `<button class="action-button" data-unlock="${id}">` +
                `<span class="hs-btn-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
                `<span>UNLOCK LISTING: ${this.shipName(id)}</span>` +
                `</button>`;
        }).join('')}</div>`;
    }

    renderShopCategoryTabs() {
        return this._shopCategories.map((id) => {
            const meta = this._shopCatMeta[id] || { label: id.toUpperCase() };
            const active = this.shopCategory === id;
            return `<button type="button" class="hs-shop-cat ${active ? 'active' : ''}" data-shop-cat="${id}" data-nav-item>` +
                `<span class="hs-chip-icon">${this.iconHtml(meta.icon, 32, 'hs-pixel')}</span>` +
                `<span>${meta.label}</span></button>`;
        }).join('');
    }

    catalogShipIds() {
        const starter = (typeof economyConfig !== 'undefined')
            ? economyConfig.starterShipId
            : 'player_scrap';
        const profile = this.getProfile();
        const shopFaction = this.getShopFaction(profile);
        if (typeof shipConfigManager === 'undefined') {
            return ['player', 'player_interceptor', 'player_assault', 'player_heavy'];
        }
        return shipConfigManager.getTypeIds().filter((id) => {
            if (id === starter) return false;
            const cfg = shipConfigManager.getConfig(id);
            if (!cfg || cfg.custom) return false;
            if (typeof profileManager !== 'undefined' && profileManager.isShopFactionMatch) {
                return profileManager.isShopFactionMatch(cfg.faction, shopFaction);
            }
            return !cfg.faction || cfg.faction === shopFaction;
        });
    }

    catalogPartListings() {
        const list = [];
        const profile = this.getProfile();
        const shopFaction = this.getShopFaction(profile);
        const matchFaction = (item) => {
            if (typeof profileManager !== 'undefined' && profileManager.isShopFactionMatch) {
                return profileManager.isShopFactionMatch(item && item.faction, shopFaction);
            }
            const f = item && item.faction ? String(item.faction).toLowerCase() : '';
            return !f || f === shopFaction;
        };
        if (typeof weaponConfigManager !== 'undefined') {
            weaponConfigManager.getIds().forEach((id) => {
                const w = weaponConfigManager.getWeapon(id);
                if (!matchFaction(w)) return;
                list.push({
                    kind: 'weapon',
                    id: id,
                    name: String((w && w.name) || id).toUpperCase(),
                    item: w
                });
            });
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const byCluster = abilityConfigManager.getIdsByCluster();
            (byCluster.defense || []).forEach((id) => {
                const a = abilityConfigManager.getAbility(id);
                if (!matchFaction(a)) return;
                list.push({
                    kind: 'defense',
                    id: id,
                    name: String((a && a.name) || id).toUpperCase(),
                    item: a
                });
            });
            ['mobility', 'offense', 'combat', 'core', 'other'].forEach((cluster) => {
                (byCluster[cluster] || []).forEach((id) => {
                    const a = abilityConfigManager.getAbility(id);
                    if (!a || a.cluster === 'defense') return;
                    if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                        && shipLoadoutManager.isEnergyId(id)) {
                        return;
                    }
                    // Shop only charge upgrades + Kronax spike drive; skip ship-default fluff
                    const shopIds = {
                        charge_shot: 1,
                        overcharge_core: 1,
                        charge_drive: 1,
                        drive_charge_dampen: 1,
                        spike_drive: 1
                    };
                    if (!shopIds[id]) return;
                    if (!matchFaction(a)) return;
                    list.push({
                        kind: 'ability',
                        id: id,
                        name: String((a && a.name) || id).toUpperCase(),
                        item: a
                    });
                });
            });
            const energyCore = abilityConfigManager.getAbility('energy_core');
            if (energyCore && matchFaction(energyCore)) {
                list.push({
                    kind: 'energy',
                    id: 'energy_core',
                    name: String(energyCore.name || 'ENERGY CORE').toUpperCase(),
                    item: energyCore
                });
            }
        }
        return list;
    }

    renderShopShipRows(profile) {
        const wallet = profile.resources || {};
        let entries = this.catalogShipIds().map((id) => {
            const cfg = (typeof shipConfigManager !== 'undefined')
                ? shipConfigManager.getConfig(id)
                : null;
            const modelClass = this.shipModelClass(id, cfg);
            const cost = (typeof economyConfig !== 'undefined')
                ? economyConfig.getShopCost(cfg)
                : { scrap: 120 };
            return {
                id: id,
                name: this.shipName(id),
                modelClass: modelClass,
                tier: (cfg && cfg.tier != null) ? Number(cfg.tier) : 1,
                cost: cost,
                costTotal: this.costTotal(cost),
                owned: profile.ownedShipIds.indexOf(id) !== -1
            };
        });
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.modelClass === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        if (!entries.length) {
            return '<p class="hs-muted hs-empty-slot">NO SHIPS MATCH FILTER</p>';
        }
        return entries.map((e) => {
            const afford = this.canAffordCost(wallet, e.cost, profile);
            const action = e.owned
                ? '<span class="hs-muted hs-line-action">OWNED</span>'
                : `<button class="action-button hs-line-action" data-buy="${e.id}" ${afford ? '' : 'disabled'}>BUY</button>`;
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${e.name}</strong>` +
                `<span class="hs-line-meta">${this.shipClassLabel(e.modelClass)} · T${e.tier}</span>` +
                `</span></span>` +
                `${this.renderCostGrid(e.cost, wallet, profile)}${action}</div>`;
        }).join('');
    }

    renderShopBlueprintRows(profile) {
        const wallet = profile.resources || {};
        let entries = this.catalogShipIds().map((id) => {
            const cfg = (typeof shipConfigManager !== 'undefined')
                ? shipConfigManager.getConfig(id)
                : null;
            const modelClass = this.shipModelClass(id, cfg);
            const cost = (typeof economyConfig !== 'undefined')
                ? economyConfig.getBlueprintCost(cfg)
                : { scrap: 60 };
            const count = profile.blueprints[id] || 0;
            return {
                id: id,
                name: this.shipName(id),
                modelClass: modelClass,
                tier: (cfg && cfg.tier != null) ? Number(cfg.tier) : 1,
                cost: cost,
                costTotal: this.costTotal(cost),
                count: count
            };
        });
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.modelClass === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        if (!entries.length) {
            return '<p class="hs-muted hs-empty-slot">NO BLUEPRINTS MATCH FILTER</p>';
        }
        return entries.map((e) => {
            const stock = e.count > 0 ? ` ×${e.count}` : '';
            const afford = this.canAffordCost(wallet, e.cost, profile);
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>BP: ${e.name}${stock}</strong>` +
                `<span class="hs-line-meta">${this.shipClassLabel(e.modelClass)} · T${e.tier}</span>` +
                `</span></span>` +
                `${this.renderCostGrid(e.cost, wallet, profile)}` +
                `<button class="action-button hs-line-action" data-buy-bp="${e.id}" ${afford ? '' : 'disabled'}>BUY</button></div>`;
        }).join('');
    }

    renderShopPartRows(profile) {
        const wallet = profile.resources || {};
        let entries = this.catalogPartListings().map((entry) => {
            const cost = (typeof economyConfig !== 'undefined')
                ? economyConfig.getPartCost(entry.kind, entry.item)
                : { scrap: 100 };
            const count = (typeof profileManager !== 'undefined')
                ? profileManager.getPartCount(entry.kind, entry.id, profile)
                : 0;
            const tier = entry.kind === 'weapon'
                ? Math.max(1, Math.round(Number((entry.item && entry.item.damage) || 10) / 12))
                : Math.max(1, Math.round(Number((entry.item && entry.item.tier) || 1)));
            return {
                kind: entry.kind,
                id: entry.id,
                name: entry.name,
                tier: tier,
                cost: cost,
                costTotal: this.costTotal(cost),
                count: count
            };
        });
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.kind === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        if (!entries.length) {
            return '<p class="hs-muted hs-empty-slot">NO PARTS MATCH FILTER</p>';
        }
        return entries.map((e) => {
            const stock = e.count > 0 ? ` ×${e.count}` : '';
            const afford = this.canAffordCost(wallet, e.cost, profile);
            const tag = e.kind === 'weapon' ? 'WEAPON'
                : (e.kind === 'ability' ? 'ABILITY'
                    : (e.kind === 'energy' ? 'ENERGY' : 'DEFENSE'));
            const icon = e.kind === 'weapon' ? 'statWeapon'
                : (e.kind === 'ability' ? 'statAbilities'
                    : (e.kind === 'energy' ? 'ability_energy_shield' : 'statArmor'));
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml(icon, 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${e.name}${stock}</strong>` +
                `<span class="hs-line-meta">${tag} · T${e.tier}</span>` +
                `</span></span>` +
                `${this.renderCostGrid(e.cost, wallet, profile)}` +
                `<button class="action-button hs-line-action" data-buy-part="${e.kind}:${e.id}" ${afford ? '' : 'disabled'}>BUY</button></div>`;
        }).join('');
    }

    renderShopPortalRows(profile) {
        const wallet = profile.resources || {};
        const discovered = {};
        ((typeof profileManager !== 'undefined' && profileManager.getDiscoveredFactions)
            ? profileManager.getDiscoveredFactions(profile)
            : ['terran']).forEach((fid) => {
            discovered[String(fid).toLowerCase()] = 1;
        });
        const ids = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyIds()
            : ['milky_way', 'andromeda'];
        let entries = ids.map((gid) => {
            const g = (typeof planetConfigManager !== 'undefined')
                ? planetConfigManager.getGalaxy(gid)
                : { id: gid, name: String(gid).replace(/_/g, ' ').toUpperCase() };
            const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
                ? planetConfigManager.getGalaxyFaction(gid)
                : ((g && g.faction) || '');
            const factionId = String(faction || '').toLowerCase();
            if (factionId && !discovered[factionId]) return null;
            const cost = (typeof economyConfig !== 'undefined' && economyConfig.getPortalCost)
                ? economyConfig.getPortalCost(gid)
                : null;
            if (!cost) return null;
            const tier = (typeof economyConfig !== 'undefined' && economyConfig.getPortalTier)
                ? economyConfig.getPortalTier(gid)
                : 1;
            const owned = (typeof profileManager !== 'undefined')
                ? profileManager.ownsPortal(gid, profile)
                : false;
            const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
                ? planetConfigManager.getFactionMeta(factionId)
                : { label: factionId.toUpperCase(), icon: 'galaxyDefault', lore: '' };
            return {
                id: gid,
                name: String((g && g.name) || gid).replace(/_/g, ' ').toUpperCase(),
                faction: factionId,
                factionLabel: meta.label || factionId.toUpperCase(),
                factionIcon: meta.icon || 'galaxyDefault',
                lore: meta.lore || '',
                tier: tier,
                cost: cost,
                costTotal: this.costTotal(cost),
                owned: owned
            };
        }).filter(Boolean);

        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.faction === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        if (!entries.length) {
            return '<p class="hs-muted hs-empty-slot">NO PORTALS — MEET NEW FACTIONS IN COMBAT TO UNLOCK</p>';
        }
        return entries.map((e) => {
            const afford = this.canAffordCost(wallet, e.cost, profile);
            const action = e.owned
                ? '<span class="hs-muted hs-line-action">OWNED</span>'
                : `<button class="action-button hs-line-action" data-buy-portal="${e.id}" ${afford ? '' : 'disabled'}>BUY</button>`;
            const galaxyIcon = e.id === 'andromeda' ? 'galaxyAndromeda'
                : (e.id === 'milky_way' ? 'galaxyMilkyWay' : 'galaxyDefault');
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml(galaxyIcon, 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>PORTAL: ${e.name}</strong>` +
                `<span class="hs-line-meta">` +
                `<span class="hs-shop-ctrl-icon">${this.iconHtml(e.factionIcon, 20, 'hs-pixel hs-pixel-20')}</span>` +
                `${e.factionLabel} · WARP L${e.tier}</span>` +
                (e.lore ? `<span class="hs-line-lore">${e.lore}</span>` : '') +
                `</span></span>` +
                `${this.renderCostGrid(e.cost, wallet, profile)}${action}</div>`;
        }).join('');
    }

    renderShopResourceHeader() {
        return `<div class="hs-shop-line hs-shop-head hs-shop-res-line">` +
            `<span class="hs-line-name"><span class="hs-line-meta">RESOURCE</span></span>` +
            `<span class="hs-res-stock-col"><span class="hs-line-meta">STOCK</span></span>` +
            `<span class="hs-cost-grid">` +
            `<span class="hs-cost-cell hs-cost-head hs-res-credits" title="BUY PRICE">` +
            `<span class="hs-cost-label">BUY</span></span>` +
            `<span class="hs-cost-cell hs-cost-head hs-res-credits" title="SELL PAYOUT">` +
            `<span class="hs-cost-label">SELL</span></span>` +
            `</span>` +
            `<span class="hs-line-action"><span class="hs-line-meta">TRADE</span></span>` +
            `</div>`;
    }

    resolveResourceTradeQty(profile, resourceId, bag, mode) {
        const stockMap = bag === 'cargo'
            ? ((profile.cargo && profile.cargo.resources) || {})
            : (profile.resources || {});
        const stock = Math.max(0, Math.round(Number(stockMap[resourceId]) || 0));
        const selected = this.shopResourceQty;
        if (selected !== 'all') {
            return Math.max(1, Math.round(Number(selected) || 1));
        }
        if (mode === 'sell') {
            return Math.max(0, stock);
        }
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const cap = (typeof profileManager !== 'undefined' && profileManager.getResourceBagCap)
            ? profileManager.getResourceBagCap(bag, profile)
            : 80;
        const room = Math.max(0, cap - stock);
        if (room < 1 || typeof economyConfig === 'undefined') return 0;
        const unitCost = economyConfig.getResourceBuyCost(resourceId, 1);
        const creditsPer = unitCost ? Math.max(1, unitCost.credits || 1) : 1;
        const afford = Math.floor(credits / creditsPer);
        return Math.max(0, Math.min(room, afford));
    }

    renderShopResourceRows(profile) {
        const bag = this.shopFilter === 'cargo' ? 'cargo' : 'station';
        const qtyMode = this.shopResourceQty || 1;
        const bagMap = bag === 'cargo'
            ? ((profile.cargo && profile.cargo.resources) || {})
            : (profile.resources || {});
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        let entries = ids.map((id) => {
            const tradeable = (typeof economyConfig !== 'undefined')
                ? economyConfig.isResourceTradeable(id)
                : true;
            const stock = Math.max(0, Math.round(Number(bagMap[id]) || 0));
            let buyQty = tradeable ? this.resolveResourceTradeQty(profile, id, bag, 'buy') : 0;
            let sellQty = tradeable ? this.resolveResourceTradeQty(profile, id, bag, 'sell') : 0;
            if (qtyMode !== 'all') {
                buyQty = Math.max(1, buyQty);
                sellQty = Math.max(1, sellQty);
            }
            const buyCost = tradeable && buyQty > 0 && typeof economyConfig !== 'undefined'
                ? economyConfig.getResourceBuyCost(id, buyQty)
                : null;
            const sellPay = tradeable && sellQty > 0 && typeof economyConfig !== 'undefined'
                ? economyConfig.getResourceSellPayout(id, sellQty)
                : null;
            return {
                id: id,
                name: (typeof economyConfig !== 'undefined')
                    ? economyConfig.getResourceLabel(id)
                    : String(id).toUpperCase(),
                tradeable: tradeable,
                stock: stock,
                tier: stock,
                buyQty: buyQty,
                sellQty: sellQty,
                cost: buyCost || {},
                costTotal: buyCost ? this.costTotal(buyCost) : 0,
                buyCost: buyCost,
                sellPay: sellPay
            };
        });
        if (this.shopSort === 'cost') {
            entries.sort((a, b) => (a.costTotal || 0) - (b.costTotal || 0) || a.name.localeCompare(b.name));
        } else if (this.shopSort === 'tier') {
            entries.sort((a, b) => (b.stock || 0) - (a.stock || 0) || a.name.localeCompare(b.name));
        } else {
            entries.sort((a, b) => a.name.localeCompare(b.name));
        }
        const qtyLabel = qtyMode === 'all' ? 'ALL' : ('×' + qtyMode);
        return entries.map((e) => {
            const afford = e.buyCost ? this.canAffordCredits(e.buyCost, profile) : false;
            const canSell = e.stock >= 1 && e.sellQty > 0;
            const buyHtml = e.buyCost
                ? `<span class="hs-cost-grid hs-res-buy-grid">` +
                    `<span class="hs-cost-cell hs-res-credits${credits < (e.buyCost.credits || 0) ? ' hs-cost-short' : ''}">` +
                    `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey('credits'), 20, 'hs-pixel hs-pixel-20')}</span>` +
                    `<span class="hs-cost-amt">${e.buyCost.credits || 0}</span>` +
                    `</span></span>`
                : '<span class="hs-muted">—</span>';
            const sellHtml = e.sellPay
                ? `<span class="hs-cost-grid hs-res-sell-grid">` +
                    `<span class="hs-cost-cell hs-res-credits">` +
                    `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey('credits'), 20, 'hs-pixel hs-pixel-20')}</span>` +
                    `<span class="hs-cost-amt">+${e.sellPay.credits || 0}</span>` +
                    `</span></span>`
                : '<span class="hs-muted">—</span>';
            const metaQty = qtyMode === 'all'
                ? (`ALL · buy ${e.buyQty} / sell ${e.sellQty}`)
                : (qtyLabel + ' · ' + bag.toUpperCase());
            return `<div class="hs-line hs-shop-line hs-shop-res-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml(this.resourceIconKey(e.id), 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${e.name}</strong>` +
                `<span class="hs-line-meta">${metaQty}</span>` +
                `</span></span>` +
                `<span class="hs-res-stock-col hs-res-stock">${e.stock}</span>` +
                `<span class="hs-res-price-pair">` +
                `<span class="hs-res-price-buy">${buyHtml}</span>` +
                `<span class="hs-res-price-sell">${sellHtml}</span>` +
                `</span>` +
                `<span class="hs-line-actions">` +
                `<button class="action-button hs-line-action" data-buy-res="${e.id}" ${afford ? '' : 'disabled'}>BUY</button>` +
                `<button class="action-button hs-line-action hs-sell-btn" data-sell-res="${e.id}" ${canSell ? '' : 'disabled'}>SELL</button>` +
                `</span></div>`;
        }).join('');
    }

    renderShopTab(profile) {
        let rows = '';
        let title = 'SHIP SHOP';
        let titleIcon = 'hsShop';
        if (this.shopCategory === 'blueprints') {
            title = 'BLUEPRINT SHOP';
            titleIcon = 'hsBlueprint';
            rows = this.renderShopBlueprintRows(profile);
        } else if (this.shopCategory === 'parts') {
            title = 'PARTS SHOP';
            titleIcon = 'hsCraft';
            rows = this.renderShopPartRows(profile);
        } else if (this.shopCategory === 'portals') {
            title = 'PORTALS SHOP';
            titleIcon = 'galaxyMilkyWay';
            rows = this.renderShopPortalRows(profile);
        } else if (this.shopCategory === 'resources') {
            title = 'RESOURCE MARKET';
            titleIcon = 'hsStores';
            rows = this.renderShopResourceRows(profile);
        } else {
            rows = this.renderShopShipRows(profile);
        }
        const shopFaction = this.getShopFaction(profile).toUpperCase();
        const galaxyId = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : 'milky_way';
        const galaxyName = String(galaxyId).replace(/_/g, ' ').toUpperCase();
        let stockHint = '';
        if (this.shopCategory === 'portals') {
            stockHint = `<p class="hs-muted hs-hint">Buy portals only for factions you have already met in combat. Filter by discovered faction.</p>`;
        } else if (this.shopCategory === 'resources') {
            stockHint = `<p class="hs-muted hs-hint">CREDITS = money (uncapped). SCRAP / ORE / CRYSTAL / VOLTEX = materials. Buy &amp; sell materials for credits from STATION or CARGO.</p>`;
        } else {
            stockHint = `<p class="hs-muted hs-hint">Station stock for ${galaxyName} · FACTION ${shopFaction}. Travel to change available ships and parts.</p>`;
        }
        const head = this.shopCategory === 'resources'
            ? this.renderShopResourceHeader()
            : this.renderShopCostHeader();
        return `<div class="hs-section hs-panel hs-shop-root">` +
            `${this.renderShopWalletBar(profile)}` +
            `<div class="hs-shop-cats">${this.renderShopCategoryTabs()}</div>` +
            `${this.panelTitle(titleIcon, title)}` +
            `${stockHint}` +
            `${this.renderShopToolbar()}` +
            `<div class="hs-tab-fill hs-shop-list">` +
            `${head}` +
            `${rows || '<p class="hs-muted hs-empty-slot">EMPTY</p>'}` +
            `</div></div>`;
    }

    renderCraftTab(profile) {
        const keys = Object.keys(profile.blueprints || {}).filter((k) => (profile.blueprints[k] || 0) > 0);
        if (!keys.length) {
            return `<div class="hs-section hs-panel">${this.panelTitle('hsCraft', 'CRAFT')}` +
                `<div class="hs-tab-fill"><p class="hs-muted hs-hint">No blueprints in station. Collect drops in missions and teleport cargo.</p></div></div>`;
        }
        const rows = keys.map((id) => {
            if (profile.ownedShipIds.indexOf(id) !== -1) {
                return `<div class="hs-line hs-shop-line">` +
                    `<span class="hs-line-name"><span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
                    `<strong>${this.shipName(id)}</strong></span>` +
                    `<span class="hs-muted">OWNED</span></div>`;
            }
            const cfg = shipConfigManager.getConfig(id);
            const cost = (typeof profileManager !== 'undefined' && profileManager.getDiscountedCraftCost)
                ? profileManager.getDiscountedCraftCost(cfg, profile)
                : economyConfig.getCraftCost(cfg);
            const afford = this.canAffordCost(profile.resources, cost);
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name"><span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
                `<strong>${this.shipName(id)}</strong> ×${profile.blueprints[id]}</span>` +
                `${this.renderCostGrid(cost, profile.resources)}` +
                `<button class="action-button hs-line-action" data-craft="${id}" ${afford ? '' : 'disabled'}>` +
                `<span class="hs-btn-icon">${this.iconHtml('hsCraft', 32, 'hs-pixel')}</span>` +
                `<span>CRAFT</span></button></div>`;
        });
        return `<div class="hs-section hs-panel">${this.panelTitle('hsCraft', 'CRAFT FROM BLUEPRINT')}` +
            `<div class="hs-tab-fill">${rows.join('')}</div></div>`;
    }

    hangarModuleIconKey(kind, id) {
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.resolveModuleIcon) {
            const key = shipLoadoutManager.resolveModuleIcon({ kind: kind, id: id });
            if (key) return key;
        }
        if (kind === 'weapon') {
            const wid = String(id || 'laser');
            return 'shot' + wid.charAt(0).toUpperCase() + wid.slice(1);
        }
        if (kind === 'energy') return 'ability_energy_shield';
        return 'ability_' + String(id || '');
    }

    hangarModuleLabel(id) {
        return String(id || 'EMPTY').replace(/_/g, ' ').toUpperCase();
    }

    /**
     * A second, independent dropdown per slot for choosing the module's
     * visual skin — deliberately separate from the weapon/module select
     * above, so re-skinning a component never changes its stats.
     */
    renderHangarSlotSkinDropdown(slot, kind, current) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getAvailableSkins) return '';
        const skins = shipLoadoutManager.getAvailableSkins(kind);
        if (!skins || skins.length <= 1) return '';
        const activeSkin = shipLoadoutManager.getModuleSkin
            ? shipLoadoutManager.getModuleSkin(this.hangarShipId, kind, current, slot.face)
            : 'default';
        return `<label class="hs-hangar-slot-select-wrap hs-hangar-slot-skin-wrap">` +
            `<span class="hs-hangar-slot-skin-label">SKIN</span>` +
            `<select class="hs-hangar-slot-select hs-hangar-slot-skin-select" data-hangar-slot-skin="${kind}" data-slot-index="${slot.index}" data-mod-face="${slot.face || ''}" aria-label="Skin">` +
            skins.map((s) => `<option value="${s.id}" ${s.id === activeSkin ? 'selected' : ''}>${s.label}</option>`).join('') +
            `</select>` +
            `</label>`;
    }

    renderHangarSlotDropdown(slot, inventory, equippedByKind) {
        const kind = slot.kind;
        const poolKey = kind === 'weapon' ? 'weapons'
            : (kind === 'defense' ? 'defenses'
                : (kind === 'energy' ? 'energy' : 'abilities'));
        const pool = (inventory && inventory[poolKey]) ? inventory[poolKey].slice() : [];
        const equipped = equippedByKind[kind] || {};
        const current = slot.id || '';
        const installBlocked = (id) => {
            if (!id || id === current) return null;
            if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.canInstallModule) return null;
            const check = shipLoadoutManager.canInstallModule(this.hangarShipId, kind, id);
            if (check.ok || check.removing || check.reason === 'FULL') return null;
            return check.reason || 'BLOCKED';
        };
        const options = [`<option value="">EMPTY</option>`].concat(pool.map((id) => {
            const usedElsewhere = !!(equipped[id] && id !== current);
            const blocked = installBlocked(id);
            const label = this.hangarModuleLabel(id)
                + (blocked === 'NEED_CHARGE_SHOT' ? ' · NEED CHARGE SHOT'
                    : (blocked === 'NEED_CHARGE_DRIVE' ? ' · NEED CHARGE DRIVE'
                        : (usedElsewhere ? ' · EQUIPPED' : '')));
            return `<option value="${id}" ${id === current ? 'selected' : ''}${blocked ? ' disabled' : ''}>${label}</option>`;
        }));
        const iconKey = current
            ? this.hangarModuleIconKey(kind, current)
            : (kind === 'weapon' ? 'statWeapon'
                : (kind === 'defense' ? 'statArmor'
                    : (kind === 'energy' ? 'ability_energy_shield' : 'statAbilities')));
        const mark = current ? '●' : '+';
        const name = current ? this.hangarModuleLabel(current) : 'EMPTY';
        const open = (this._hangarOpenSlot
            && this._hangarOpenSlot.kind === kind
            && Number(this._hangarOpenSlot.index) === Number(slot.index)) ? ' is-open' : '';
        const pinX = Math.round((slot.nx != null ? slot.nx : 0.5) * 1000) / 1000;
        const pinY = Math.round((slot.ny != null ? slot.ny : 0.5) * 1000) / 1000;
        const railI = slot.railIndex != null ? slot.railIndex : 0;
        const railN = Math.max(1, slot.railCount != null ? slot.railCount : 1);
        const side = slot.side === 'left' ? 'left' : 'right';
        return `<div class="hs-hangar-slot${slot.empty ? ' is-empty' : ''}${open}" data-slot-kind="${kind}" data-slot-index="${slot.index}" data-slot-side="${side}" style="--pin-x:${pinX};--pin-y:${pinY};--rail-i:${railI};--rail-n:${railN};">` +
            `<button type="button" class="hs-hangar-slot-pin" data-hangar-slot-toggle="${kind}" data-slot-index="${slot.index}" data-mod-id="${current}" data-mod-face="${slot.face || ''}" title="${slot.label}">` +
            `<span class="hs-hangar-slot-dot"></span>` +
            `</button>` +
            `<div class="hs-hangar-slot-card">` +
            `<button type="button" class="hs-hangar-slot-btn" data-nav-item data-hangar-slot-toggle="${kind}" data-slot-index="${slot.index}">` +
            `<span class="hs-btn-icon">${this.iconHtml(iconKey, 20, 'hs-pixel hs-pixel-20')}</span>` +
            `<span class="hs-hangar-slot-meta">` +
            `<span class="hs-hangar-slot-kind">${slot.label}</span>` +
            `<span class="hs-hangar-slot-name"><span class="hs-hangar-slot-mark">${mark}</span> ${name}</span>` +
            `</span>` +
            `<span class="hs-hangar-slot-caret">▾</span>` +
            `</button>` +
            `<div class="hs-hangar-slot-menu" role="listbox">` +
            `<label class="hs-hangar-slot-select-wrap">` +
            `<select class="hs-hangar-slot-select" data-hangar-slot-select="${kind}" data-slot-index="${slot.index}" aria-label="${slot.label}">` +
            options.join('') +
            `</select>` +
            `</label>` +
            (current ? this.renderHangarSlotSkinDropdown(slot, kind, current) : '') +
            `<div class="hs-hangar-slot-options">` +
            `<button type="button" class="hs-hangar-slot-option${current ? '' : ' is-active'}" data-hangar-slot-set="${kind}" data-slot-index="${slot.index}" data-mod-id="">` +
            `<span class="hs-hangar-slot-mark">○</span><span>EMPTY</span></button>` +
            pool.map((id) => {
                const on = id === current;
                const usedElsewhere = !!(equipped[id] && !on);
                const blocked = installBlocked(id);
                const disabled = blocked ? ' disabled' : '';
                const blockedCls = blocked ? ' is-blocked' : '';
                return `<button type="button" class="hs-hangar-slot-option${on ? ' is-active' : ''}${usedElsewhere ? ' is-used' : ''}${blockedCls}" data-hangar-slot-set="${kind}" data-slot-index="${slot.index}" data-mod-id="${id}"${disabled}>` +
                    `<span class="hs-btn-icon">${this.iconHtml(this.hangarModuleIconKey(kind, id), 18, 'hs-pixel hs-pixel-18')}</span>` +
                    `<span>${this.hangarModuleLabel(id)}${blocked === 'NEED_CHARGE_SHOT' ? ' · NEED CS' : (blocked === 'NEED_CHARGE_DRIVE' ? ' · NEED CD' : '')}</span>` +
                    `<span class="hs-hangar-slot-mark">${on ? '●' : (blocked ? '✕' : (usedElsewhere ? '◇' : '○'))}</span>` +
                    `</button>`;
            }).join('') +
            `</div></div></div></div>`;
    }

    renderHangarTab(profile) {
        const owned = profile.ownedShipIds || [];
        if (!owned.length) {
            return `<div class="hs-section"><h3>HANGAR</h3><p class="hs-muted">No ships owned.</p></div>`;
        }
        if (!this.hangarShipId || owned.indexOf(this.hangarShipId) === -1) {
            this.hangarShipId = profile.activeShipId || owned[0];
        }
        const shipId = this.hangarShipId;
        const modelClass = this.shipModelClass(
            shipId,
            typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(shipId) : null
        ) || 'starfighter';
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId)
            : null;
        const loadout = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getLoadout(shipId)
            : { weapons: [], defenses: [], abilities: [], energy: [] };
        const inventory = (typeof shipLoadoutManager !== 'undefined')
            ? shipLoadoutManager.getInventory(shipId)
            : loadout;
        const hangarSlots = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.buildHangarSlots)
            ? shipLoadoutManager.buildHangarSlots(shipId, modelClass, merged)
            : { slots: [], caps: { weapons: 2, defenses: 1, abilities: 1, energy: 1 }, layout: { width: 0, height: 0 }, width: 0, height: 0 };
        const caps = hangarSlots.caps || { weapons: 2, defenses: 1, abilities: 1, energy: 1 };
        const layout = hangarSlots.layout || { width: hangarSlots.width || 0, height: hangarSlots.height || 0 };
        const frameLevel = (typeof profileManager !== 'undefined')
            ? profileManager.getShipFrameLevel(shipId, profile)
            : 0;
        const frameMax = (typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 9) : 9;
        const frameCheck = (typeof profileManager !== 'undefined' && profileManager.canPurchaseShipFrameUpgrade)
            ? profileManager.canPurchaseShipFrameUpgrade(shipId, profile)
            : { ok: false };
        const frameCost = !frameCheck.ok && frameCheck.cost
            ? frameCheck.cost
            : (frameCheck.ok
                ? frameCheck.cost
                : ((typeof economyConfig !== 'undefined' && economyConfig.getShipFrameUpgradeCost)
                    ? economyConfig.getShipFrameUpgradeCost(frameLevel + 1)
                    : null));
        const frameMaxed = frameLevel >= frameMax;

        const shipButtons = owned.map((id) => {
            const active = id === shipId ? ' active' : '';
            const selected = id === profile.activeShipId ? ' ★' : '';
            return `<button type="button" class="action-button hs-hangar-ship${active}" data-hangar-ship="${id}">` +
                `<span class="hs-btn-icon">${this.iconHtml('hsShip', 24, 'hs-pixel hs-pixel-24')}</span>` +
                `<span>${this.shipName(id)}${selected}</span></button>`;
        }).join('');

        const powerBudget = (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.computePowerBudget)
            ? shipLoadoutManager.computePowerBudget(loadout)
            : { gen: 0, idleDraw: 0, net: 0 };
        const netSign = powerBudget.net >= 0 ? '+' : '';
        const powerLine = `POWER · GEN ${powerBudget.gen}/s · IDLE DRAW ${powerBudget.idleDraw}/s · NET ${netSign}${powerBudget.net}/s`;

        const fireMode = (loadout.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        const ownsChargeShot = (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.ownsChargePart)
            ? shipLoadoutManager.ownsChargePart('ability', 'charge_shot')
            : (inventory.abilities || []).indexOf('charge_shot') !== -1;

        const equippedByKind = {
            weapon: {},
            defense: {},
            ability: {},
            energy: {}
        };
        (loadout.weapons || []).forEach((id) => { equippedByKind.weapon[id] = true; });
        (loadout.defenses || []).forEach((id) => { equippedByKind.defense[id] = true; });
        (loadout.abilities || []).forEach((id) => { equippedByKind.ability[id] = true; });
        (loadout.energy || []).forEach((id) => { equippedByKind.energy[id] = true; });

        const slots = (hangarSlots.slots || []).slice();
        // Force even left/right rail fill so every slot card is visible
        slots.forEach((slot, i) => {
            slot.side = (i % 2 === 0) ? 'left' : 'right';
        });
        const leftSlots = [];
        const rightSlots = [];
        slots.forEach((slot) => {
            if (slot.side === 'left') leftSlots.push(slot);
            else rightSlots.push(slot);
        });
        // Stable vertical order: weapons → defenses → energy → abilities
        const kindOrder = { weapon: 0, defense: 1, energy: 2, ability: 3 };
        const sortRail = (arr) => arr.sort((a, b) => {
            const ka = kindOrder[a.kind] != null ? kindOrder[a.kind] : 9;
            const kb = kindOrder[b.kind] != null ? kindOrder[b.kind] : 9;
            if (ka !== kb) return ka - kb;
            return (a.index || 0) - (b.index || 0);
        });
        sortRail(leftSlots);
        sortRail(rightSlots);
        leftSlots.forEach((slot, i) => {
            slot.railIndex = i;
            slot.railCount = leftSlots.length;
            slot.side = 'left';
        });
        rightSlots.forEach((slot, i) => {
            slot.railIndex = i;
            slot.railCount = rightSlots.length;
            slot.side = 'right';
        });

        const slotHtml = slots.map((slot) =>
            this.renderHangarSlotDropdown(slot, inventory, equippedByKind)
        ).join('');

        const filledSlots = (hangarSlots.slots || []).filter((s) => s && !s.empty).length;
        const totalSlots = (hangarSlots.slots || []).length;

        return `
            <div class="hs-section hs-panel hs-hangar-root">
                <h3 class="hs-panel-title">
                    <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                    <span class="hs-panel-label">HANGAR — OPEN BAY</span>
                    <span class="hs-panel-scan" aria-hidden="true"></span>
                    <span class="hs-hangar-sidebar-actions">
                        <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="left"
                            aria-label="${this._hangarLeftCollapsed ? 'Expand' : 'Collapse'} ship list"
                            aria-expanded="${!this._hangarLeftCollapsed}">${this._hangarLeftCollapsed ? '›' : '‹'}</button>
                        <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="right"
                            aria-label="${this._hangarRightCollapsed ? 'Expand' : 'Collapse'} live preview"
                            aria-expanded="${!this._hangarRightCollapsed}">${this._hangarRightCollapsed ? '‹' : '›'}</button>
                    </span>
                </h3>
                <div class="hs-hangar-split${this._hangarLeftCollapsed ? ' hs-hangar-left-collapsed' : ''}${this._hangarRightCollapsed ? ' hs-hangar-right-collapsed' : ''}">
                    <aside class="hs-hangar-list hs-panel">
                        <h3 class="hs-panel-title">
                            <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                            <span class="hs-panel-label">SHIPS</span>
                            <span class="hs-panel-scan" aria-hidden="true"></span>
                            <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="left"
                                aria-label="${this._hangarLeftCollapsed ? 'Expand' : 'Collapse'} ship list"
                                aria-expanded="${!this._hangarLeftCollapsed}">${this._hangarLeftCollapsed ? '›' : '‹'}</button>
                        </h3>
                        <div class="hs-actions-col hs-hangar-ships">${shipButtons}</div>
                    </aside>
                    <div class="pe-resize-handle" data-resize="left" title="Resize ship list"></div>
                    <div class="hs-hangar-detail">
                        <div class="hs-hangar-detail-head hs-panel">
                            <div class="hs-hangar-selected">
                                <span class="hs-chip-icon">${this.iconHtml('hsShip', 24, 'hs-pixel hs-pixel-24')}</span>
                                <strong>${this.shipName(shipId)}</strong>
                                ${shipId === profile.activeShipId ? '<span class="hs-hangar-active-tag">★ ACTIVE</span>' : ''}
                            </div>
                            <p class="hs-hangar-meta">SIZE ${layout.width}×${layout.height} · FRAME L${frameLevel}/${frameMax} · SLOTS ${filledSlots}/${totalSlots} · W ${loadout.weapons.length}/${caps.weapons} · D ${loadout.defenses.length}/${caps.defenses} · A ${loadout.abilities.length}/${caps.abilities} · E ${(loadout.energy || []).length}/${caps.energy || 1}</p>
                            <p class="hs-hangar-meta hs-muted">${powerLine}</p>
                            <div class="hs-hangar-head-bar">
                                <div class="hs-hangar-frame-up">
                                    ${frameMaxed
                                        ? '<span class="hs-muted hs-line-action">FRAME MAX</span>'
                                        : ((frameCost ? this.renderCostGrid(frameCost, profile.resources || {}) : '') +
                                            `<button type="button" class="action-button hs-line-action" data-frame-up="${shipId}" ${frameCheck.ok ? '' : 'disabled'}>` +
                                            `FRAME → L${frameLevel + 1}</button>`)}
                                </div>
                                <div class="hs-hangar-fire-inline">
                                    <button type="button" class="action-button hs-mod ${fireMode === 'auto' ? 'equipped' : ''}" data-fire-mode="auto">AUTO</button>
                                    <button type="button" class="action-button hs-mod ${fireMode === 'charge' ? 'equipped' : ''}" data-fire-mode="charge" ${ownsChargeShot ? '' : 'disabled'}>CHARGE${ownsChargeShot ? '' : ' · SHOP'}</button>
                                </div>
                                <button type="button" class="action-button hs-activate-ship" data-activate-ship="${shipId}">SET ACTIVE</button>
                            </div>
                        </div>
                        <div class="hs-hangar-bay hs-panel">
                            <div class="hs-hangar-bay-stage" id="hsHangarBayStage">
                                <canvas id="hsHangarBayCanvas" class="hs-hangar-bay-canvas" width="420" height="320" aria-label="Open hangar ship"></canvas>
                                <div class="hs-hangar-slot-layer" id="hsHangarSlotLayer">
                                    ${slotHtml}
                                </div>
                            </div>
                            <div class="hs-hangar-module-scale" id="hsHangarModuleScale" hidden>
                                <label class="hs-hangar-zoom-label" for="hsHangarModuleScaleSlider">SCALE</label>
                                <input type="range" id="hsHangarModuleScaleSlider" class="hs-hangar-zoom-slider"
                                    min="25" max="600" step="5" value="100"
                                    title="Module scale" aria-label="Module scale">
                                <span class="pe-zoom-label" id="hsHangarModuleScaleLabel">100%</span>
                            </div>
                            <p class="hs-muted hs-hangar-bay-hint">DRAG MODULES WITHIN THEIR COMPONENT · CLICK A SLOT TO EQUIP</p>
                        </div>
                    </div>
                    <div class="pe-resize-handle" data-resize="right" title="Resize preview"></div>
                    <aside class="hs-hangar-preview hs-panel">
                        <h3 class="hs-panel-title">
                            <span class="hs-panel-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>
                            <span class="hs-panel-label">LIVE PREVIEW</span>
                            <span class="hs-panel-scan" aria-hidden="true"></span>
                            <button type="button" class="hs-sidebar-toggle" data-hangar-sidebar="right"
                                aria-label="${this._hangarRightCollapsed ? 'Expand' : 'Collapse'} live preview"
                                aria-expanded="${!this._hangarRightCollapsed}">${this._hangarRightCollapsed ? '‹' : '›'}</button>
                        </h3>
                        <div class="hs-hangar-preview-toolbar" id="hsHangarZoomBar">
                            <label class="hs-hangar-zoom-label" for="hsHangarZoom">ZOOM</label>
                            <input type="range" id="hsHangarZoom" class="hs-hangar-zoom-slider"
                                min="50" max="300" step="5" value="${Math.round((this._hangarPreviewZoom || 1) * 100)}"
                                title="Preview zoom" aria-label="Preview zoom">
                            <span class="pe-zoom-label" id="hsHangarZoomLabel">${Math.round((this._hangarPreviewZoom || 1) * 100)}%</span>
                        </div>
                        <button type="button" class="hs-hangar-preview-hit" id="hsOpenTestArea"
                            title="Open test area" aria-label="Open hangar test area">
                            <div class="hs-hangar-preview-viewport" id="hsHangarPreviewViewport">
                                <canvas id="hsHangarPreview" class="hs-hangar-preview-canvas" width="240" height="360" aria-label="Ship live preview"></canvas>
                            </div>
                            <p class="hs-muted hs-hangar-preview-caption">CLICK · TEST AREA · SCROLL ZOOM</p>
                        </button>
                    </aside>
                </div>
            </div>`;
    }

    getHangarShipModel(shipId) {
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel) {
            const model = shipConfigManager.getMergedModel(shipId);
            if (model) return model;
        }
        return {
            name: shipId,
            type: 'player',
            modelClass: 'starfighter',
            width: 20,
            height: 16,
            speed: 4,
            weaponSpeed: 8,
            weaponCooldown: 300,
            defaultWeapon: 'laser',
            sprite: [
                [0, 0, 1, 1, 0, 0],
                [0, 1, 2, 2, 1, 0],
                [1, 2, 3, 3, 2, 1],
                [0, 1, 2, 2, 1, 0]
            ],
            colors: {
                0: 'transparent',
                1: 'var(--current-text-secondary)',
                2: 'var(--current-text)',
                3: 'var(--current-text)'
            }
        };
    }

    drawHangarBay() {
        if (!this.overlay) return;
        const canvas = this.overlay.querySelector('#hsHangarBayCanvas');
        if (!canvas) return;
        const stage = this.overlay.querySelector('#hsHangarBayStage');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cssW = Math.max(280, Math.floor((stage && stage.clientWidth) || 420));
        const cssH = Math.max(220, Math.floor((stage && stage.clientHeight) || 320));
        if (canvas.width !== cssW || canvas.height !== cssH) {
            canvas.width = cssW;
            canvas.height = cssH;
        }

        const shipId = this.hangarShipId || 'player_scrap';
        let model = this.getHangarShipModel(shipId);
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
            model = Object.assign({}, model);
            if (model.sprite) model.sprite = model.sprite;
            if (model.colors) model.colors = model.colors;
            shipLoadoutManager.applyLayoutToModel(model, shipId);
        }

        const accent = this.getHangarPreviewAccent();
        const w = canvas.width;
        const h = canvas.height;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, w, h);

        // Dock grid
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.12;
        const grid = 16;
        for (let x = 0; x <= w; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, h);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(w, y + 0.5);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const mw = Math.max(8, model.width || 20);
        const mh = Math.max(8, model.height || 16);
        // Leave side gutters for slot cards; ship stays centered and clickable
        const padX = Math.max(150, Math.floor(w * 0.28));
        const padY = Math.max(28, Math.floor(h * 0.1));
        const scale = Math.max(2, Math.min(
            Math.floor((w - padX * 2) / mw),
            Math.floor((h - padY * 2) / mh),
            10
        ));
        const sw = mw * scale;
        const sh = mh * scale;
        const ox = Math.floor((w - sw) / 2);
        const oy = Math.floor((h - sh) / 2);
        // Cache the current ship-bbox geometry so the HTML slot-pin buttons
        // (which sit on top of the canvas and intercept its pointer events)
        // can convert their own drag deltas into the same layout-unit space
        // the canvas drag code uses, without recomputing the model/layout.
        this._hangarLastOx = ox;
        this._hangarLastOy = oy;
        this._hangarLastScale = scale;
        this._hangarLastModel = model;

        // Soft pedestal
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(ox - 10, oy + sh - 4, sw + 20, 10);
        ctx.globalAlpha = 1;

        try {
            if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader
                && graphicsManager.shipAssetLoader.renderShip) {
                graphicsManager.shipAssetLoader.renderShip(
                    ctx, model, ox, oy, scale, null, 0,
                    {
                        showThrusterGlow: true,
                        allowColorMountSprites: true
                    }
                );
            } else if (typeof shipRenderer !== 'undefined') {
                if (shipRenderer.init) shipRenderer.init();
                const tmp = document.createElement('canvas');
                tmp.width = Math.max(1, sw);
                tmp.height = Math.max(1, sh);
                shipRenderer.renderShipPreview(tmp, model, 1);
                ctx.drawImage(tmp, ox, oy, sw, sh);
            } else {
                ctx.fillStyle = accent;
                ctx.fillRect(ox, oy, sw, sh);
            }
        } catch (e) {
            ctx.fillStyle = accent;
            ctx.fillRect(ox, oy, sw, sh);
        }

        // Keep slot layer aligned to the same ship bbox used for rendering
        const layer = this.overlay.querySelector('#hsHangarSlotLayer');
        if (layer) {
            layer.style.setProperty('--bay-ship-left', ox + 'px');
            layer.style.setProperty('--bay-ship-top', oy + 'px');
            layer.style.setProperty('--bay-ship-w', sw + 'px');
            layer.style.setProperty('--bay-ship-h', sh + 'px');
        }
        this.updateHangarSlotPins(model);
        this.syncHangarModuleScaleUi();
        this.drawHangarSegmentHover(canvas, model, ox, oy, scale);
        this.bindHangarWingDrag(canvas, model, ox, oy, scale);
    }

    syncHangarModuleScaleUi() {
        if (!this.overlay) return;
        const bar = this.overlay.querySelector('#hsHangarModuleScale');
        const slider = this.overlay.querySelector('#hsHangarModuleScaleSlider');
        const label = this.overlay.querySelector('#hsHangarModuleScaleLabel');
        if (!bar || !slider) return;
        const selected = this._hangarSelectedModule;
        if (!selected || !selected.id) {
            bar.hidden = true;
            return;
        }
        let scale = 1;
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getModuleScale) {
            scale = shipLoadoutManager.getModuleScale(
                this.hangarShipId,
                selected.kind,
                selected.id
            );
        }
        const pct = Math.round(Math.max(0.25, Math.min(6, scale)) * 100);
        bar.hidden = false;
        if (Number(slider.value) !== pct) slider.value = String(pct);
        if (label) label.textContent = pct + '%';
    }

    /**
     * Live-sync pink slot pins to the current module layout without rebuilding
     * the hangar DOM (keeps open dropdowns while dragging).
     */
    updateHangarSlotPins(model) {
        if (!this.overlay) return;
        const layer = this.overlay.querySelector('#hsHangarSlotLayer');
        if (!layer || typeof shipLoadoutManager === 'undefined'
            || !shipLoadoutManager.buildHangarSlots) return;
        const shipId = this.hangarShipId || 'player_scrap';
        let merged = model;
        if (!merged || !merged.layout) {
            merged = this.getHangarShipModel(shipId);
            if (shipLoadoutManager.applyLayoutToModel) {
                merged = Object.assign({}, merged);
                shipLoadoutManager.applyLayoutToModel(merged, shipId);
            }
        }
        const hangarSlots = shipLoadoutManager.buildHangarSlots(
            shipId,
            merged && merged.modelClass,
            merged
        );
        const slots = (hangarSlots && hangarSlots.slots) || [];
        slots.forEach((slot) => {
            const el = layer.querySelector(
                `.hs-hangar-slot[data-slot-kind="${slot.kind}"][data-slot-index="${slot.index}"]`
            );
            if (!el) return;
            const pinX = Math.round((slot.nx != null ? slot.nx : 0.5) * 1000) / 1000;
            const pinY = Math.round((slot.ny != null ? slot.ny : 0.5) * 1000) / 1000;
            el.style.setProperty('--pin-x', String(pinX));
            el.style.setProperty('--pin-y', String(pinY));
            if (slot.side === 'left' || slot.side === 'right') {
                el.setAttribute('data-slot-side', slot.side);
            }
        });
    }

    drawHangarSegmentHover(canvas, model, ox, oy, scale) {
        const hoverState = this._hangarSegmentHover;
        const selectedModule = this._hangarSelectedModule;
        if (!canvas || !model || (!hoverState && !selectedModule)) return;
        const hover = hoverState || { segment: null, edge: null };
        const ctx = canvas.getContext('2d');
        if (!ctx || !model.layout) return;
        const segments = model.layout.segments || [];
        const selected = segments.filter((seg) => {
            if (hover.segment === 'wing') {
                return seg.id === 'wingLeft' || seg.id === 'wingRight';
            }
            return seg.id === hover.segment;
        });
        if (!selected.length && !selectedModule) return;
        const accent = this.getHangarPreviewAccent();
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = accent;
        selected.forEach((seg) => {
            ctx.fillRect(
                Math.round(ox + seg.x * scale),
                Math.round(oy + seg.y * scale),
                Math.max(1, Math.round(seg.width * scale)),
                Math.max(1, Math.round(seg.height * scale))
            );
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        selected.forEach((seg) => {
            const left = Math.round(ox + seg.x * scale);
            const top = Math.round(oy + seg.y * scale);
            const right = Math.round(ox + (seg.x + seg.width) * scale);
            const bottom = Math.round(oy + (seg.y + seg.height) * scale);
            const corner = Math.max(4, Math.min(14, (right - left) * 0.24, (bottom - top) * 0.24));
            ctx.beginPath();
            ctx.moveTo(left, top + corner);
            ctx.lineTo(left, top);
            ctx.lineTo(left + corner, top);
            ctx.moveTo(right - corner, top);
            ctx.lineTo(right, top);
            ctx.lineTo(right, top + corner);
            ctx.moveTo(left, bottom - corner);
            ctx.lineTo(left, bottom);
            ctx.lineTo(left + corner, bottom);
            ctx.moveTo(right - corner, bottom);
            ctx.lineTo(right, bottom);
            ctx.lineTo(right, bottom - corner);
            ctx.stroke();
            // Corner drag zones get their own filled hover marker — distinct
            // from a plain edge hover — so the diagonal resize handle is
            // clearly discoverable, not just implied by the cursor shape.
            if (hover.edge && hover.edge.indexOf('-') !== -1) {
                const cx = hover.edge.indexOf('right') !== -1 ? right : left;
                const cy = hover.edge.indexOf('bottom') !== -1 ? bottom : top;
                const r = Math.max(3, Math.min(7, corner * 0.5));
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        if (selectedModule && model.layout.modules) {
            const mod = model.layout.modules.find((item) =>
                item.kind === selectedModule.kind && item.id === selectedModule.id
            );
            if (mod) {
                const left = Math.round(ox + mod.x * scale);
                const top = Math.round(oy + mod.y * scale);
                const right = Math.round(ox + (mod.x + mod.width) * scale);
                const bottom = Math.round(oy + (mod.y + mod.height) * scale);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(left, top, Math.max(2, right - left), Math.max(2, bottom - top));
            }
        }
        if (selected.length) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = accent;
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            const axisLabel = (edge) => {
                const hasX = edge.indexOf('left') !== -1 || edge.indexOf('right') !== -1;
                const hasY = edge.indexOf('top') !== -1 || edge.indexOf('bottom') !== -1;
                if (hasX && hasY) return 'WIDTH ↔ HEIGHT ↕';
                return hasX ? 'WIDTH ↔' : 'HEIGHT ↕';
            };
            const label = hover.edge
                ? 'DRAG ' + (hover.edge.indexOf('-') !== -1 ? 'CORNER' : 'EDGE') + ' · '
                    + hover.segment.toUpperCase() + ' · ' + axisLabel(hover.edge)
                : (hover.segment === 'center'
                    ? 'DRAG CENTER · MOVE · FRONT ↕ BACK'
                    : 'DRAG CENTER · MOVE ' + hover.segment.toUpperCase());
            const first = selected[0];
            const lx = ox + first.x * scale;
            const ly = Math.max(14, oy + first.y * scale - 7);
            ctx.fillText(label, Math.max(4, lx), ly);
        }
        ctx.restore();
    }

    bindHangarWingDrag(canvas, model, ox, oy, scale) {
        if (!canvas || !model || !model.layout || typeof shipLoadoutManager === 'undefined'
            || !shipLoadoutManager.setWingOffset
            || !shipLoadoutManager.setModuleOffset) return;
        if (this._hangarWingDragCleanup) this._hangarWingDragCleanup();

        const core = model.layout.core || {
            x: 0,
            y: 0,
            width: model.coreWidth || model.width || 1,
            height: model.coreHeight || model.height || 1
        };
        const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
        let drag = this._hangarWingDragState || null;
        const layoutPoint = (e) => {
            const rect = canvas.getBoundingClientRect();
            const px = (e.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
            const py = (e.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
            return {
                lx: (px - ox) / Math.max(1, scale),
                ly: (py - oy) / Math.max(1, scale)
            };
        };
        const moduleHit = (e) => {
            const pt = layoutPoint(e);
            const modules = model.layout.modules || [];
            // Topmost module wins (later in draw order).
            for (let i = modules.length - 1; i >= 0; i--) {
                const mod = modules[i];
                if (pt.lx >= mod.x && pt.lx <= mod.x + mod.width
                    && pt.ly >= mod.y && pt.ly <= mod.y + mod.height) {
                    return mod;
                }
            }
            return null;
        };
        // Edge zone width as a fraction of the segment's own size: dragging
        // inside this band resizes that axis; the middle band moves instead.
        const EDGE_FRAC = 0.3;
        const wingHit = (e) => {
            const pt = layoutPoint(e);
            const segments = (model.layout.segments || []).filter((seg) =>
                ['front', 'center', 'back', 'wingLeft', 'wingRight'].indexOf(seg.id) !== -1
            );
            // Prefer exact segment frames — no soft fallback bands that create
            // oversized empty hit areas around the ship.
            const hit = segments.find((seg) =>
                pt.lx >= seg.x && pt.lx <= seg.x + seg.width
                && pt.ly >= seg.y && pt.ly <= seg.y + seg.height
            );
            if (!hit) return null;
            const marginX = Math.max(1.5, hit.width * EDGE_FRAC);
            const marginY = Math.max(1.5, hit.height * EDGE_FRAC);
            const distLeft = pt.lx - hit.x;
            const distRight = (hit.x + hit.width) - pt.lx;
            const distTop = pt.ly - hit.y;
            const distBottom = (hit.y + hit.height) - pt.ly;
            // Resolve each axis independently first, then combine — a point
            // inside both an X edge band and a Y edge band is a corner (both
            // axes resize together), not just whichever axis is closest.
            let xEdge = null;
            if (distLeft <= marginX && distRight <= marginX) xEdge = distLeft <= distRight ? 'left' : 'right';
            else if (distLeft <= marginX) xEdge = 'left';
            else if (distRight <= marginX) xEdge = 'right';
            let yEdge = null;
            if (distTop <= marginY && distBottom <= marginY) yEdge = distTop <= distBottom ? 'top' : 'bottom';
            else if (distTop <= marginY) yEdge = 'top';
            else if (distBottom <= marginY) yEdge = 'bottom';
            const edge = (xEdge && yEdge) ? (yEdge + '-' + xEdge) : (xEdge || yEdge || null);
            return {
                segment: hit.id === 'wingLeft' || hit.id === 'wingRight' ? 'wing' : hit.id,
                left: hit.id === 'wingLeft',
                right: hit.id === 'wingRight',
                width: hit.width,
                height: hit.height,
                edge: edge
            };
        };
        const cursorForHit = (hit) => {
            if (!hit) return 'grab';
            switch (hit.edge) {
                case 'left':
                case 'right':
                    return 'ew-resize';
                case 'top':
                case 'bottom':
                    return 'ns-resize';
                case 'top-left':
                case 'bottom-right':
                    return 'nwse-resize';
                case 'top-right':
                case 'bottom-left':
                    return 'nesw-resize';
                default:
                    return 'move';
            }
        };
        let lastPointerEvent = null;
        const updateHover = (e) => {
            lastPointerEvent = { clientX: e.clientX, clientY: e.clientY };
            if (moduleHit(e)) {
                canvas.style.cursor = 'move';
                if (this._hangarSegmentHover) {
                    this._hangarSegmentHover = null;
                    this.drawHangarBay();
                }
                return;
            }
            const hit = wingHit(e);
            canvas.style.cursor = cursorForHit(hit);
            const next = hit ? { segment: hit.segment, edge: hit.edge } : null;
            const prev = this._hangarSegmentHover;
            if ((prev && next && prev.segment === next.segment && prev.edge === next.edge)
                || (!prev && !next)) {
                return;
            }
            this._hangarSegmentHover = next;
            this.drawHangarBay();
        };
        const down = (e) => {
            if (e.button !== 0) return;
            const module = moduleHit(e);
            if (module && shipLoadoutManager.setModuleOffset) {
                // A single drag both selects and moves the module now — a
                // release without real movement still counts as "select" so
                // clicking to highlight a module still works.
                const moduleOffsetKey = shipLoadoutManager.moduleOffsetKey
                    ? shipLoadoutManager.moduleOffsetKey(module.id, module.face)
                    : module.id;
                const stored = loadout.moduleOffsets
                    && loadout.moduleOffsets[module.kind]
                    && (loadout.moduleOffsets[module.kind][moduleOffsetKey]
                        || loadout.moduleOffsets[module.kind][module.id]);
                const segmentId = module.mountSegment === 'wing'
                    ? (module.face === 'left' ? 'wingLeft' : 'wingRight')
                    : module.mountSegment;
                const segment = (model.layout.segments || []).find((seg) => seg.id === segmentId);
                drag = {
                    startX: e.clientX,
                    startY: e.clientY,
                    moved: false,
                    startModuleOffsetX: stored ? Number(stored.x) || 0 : 0,
                    startModuleOffsetY: stored ? Number(stored.y) || 0 : 0,
                    module: module,
                    segmentWidth: Math.max(1, segment ? segment.width : module.width || 1),
                    segmentHeight: Math.max(1, segment ? segment.height : module.height || 1)
                };
                this._hangarSelectedModule = { kind: module.kind, id: module.id };
                this._hangarSegmentHover = null;
                this._hangarWingDragState = drag;
                canvas.classList.add('is-module-dragging');
                canvas.setPointerCapture(e.pointerId);
                e.preventDefault();
                return;
            }
            const hit = wingHit(e);
            if (!hit) {
                if (this._hangarSelectedModule) {
                    this._hangarSelectedModule = null;
                    this.drawHangarBay();
                }
                return;
            }
            const segmentId = hit.segment === 'wing' ? 'wing' : hit.segment;
            const segmentScale = (loadout.segmentScale && loadout.segmentScale[segmentId])
                || { x: 1, y: 1 };
            const segmentOffset = (loadout.segmentOffset && loadout.segmentOffset[segmentId])
                || { x: 0, y: 0 };
            drag = {
                startX: e.clientX,
                startY: e.clientY,
                startOffsetX: Number(loadout.wingOffsetX) || 0,
                startOffsetY: Number(loadout.wingOffsetY) || 0,
                startSegmentOffsetX: Number(segmentOffset.x) || 0,
                startSegmentOffsetY: Number(segmentOffset.y) || 0,
                startScaleX: Number(segmentScale.x) || 1,
                startScaleY: Number(segmentScale.y) || 1,
                segment: segmentId,
                edge: hit.edge,
                side: hit.left ? 'left' : 'right',
                frameWidth: Math.max(1, hit.width || core.width || 1),
                frameHeight: Math.max(1, hit.height || core.height || 1)
            };
            this._hangarSelectedModule = null;
            this._hangarWingDragState = drag;
            canvas.classList.add(hit.edge ? 'is-wing-scaling' : 'is-wing-dragging');
            canvas.style.cursor = cursorForHit(hit);
            canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
        };
        const applyDrag = (e) => {
            if (!drag) return;
            const rect = canvas.getBoundingClientRect();
            const sx = canvas.width / Math.max(1, rect.width);
            const sy = canvas.height / Math.max(1, rect.height);
            const dx = (e.clientX - drag.startX) * sx / Math.max(1, scale);
            const dy = (e.clientY - drag.startY) * sy / Math.max(1, scale);
            if (drag.module) {
                if (!drag.moved && (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3)) {
                    drag.moved = true;
                }
                shipLoadoutManager.setModuleOffset(
                    this.hangarShipId,
                    drag.module.kind,
                    drag.module.id,
                    drag.startModuleOffsetX + dx / Math.max(1, drag.segmentWidth),
                    drag.startModuleOffsetY + dy / Math.max(1, drag.segmentHeight),
                    drag.module.face
                );
            } else if (drag.segment === 'wing') {
                const outward = drag.side === 'left' ? -dx : dx;
                const edge = drag.edge;
                if (edge) {
                    // Corner edges (e.g. "top-left") contain both an X and a Y
                    // token, so both axes resize together from one drag.
                    const hasX = edge.indexOf('left') !== -1 || edge.indexOf('right') !== -1;
                    const hasY = edge.indexOf('top') !== -1 || edge.indexOf('bottom') !== -1;
                    const heightSign = edge.indexOf('bottom') !== -1 ? 1 : (edge.indexOf('top') !== -1 ? -1 : 0);
                    shipLoadoutManager.setSegmentScale(
                        this.hangarShipId,
                        'wing',
                        drag.startScaleX + (hasX ? outward : 0) / Math.max(1, drag.frameWidth),
                        drag.startScaleY + (hasY ? heightSign * dy : 0) / Math.max(1, drag.frameHeight)
                    );
                } else {
                    shipLoadoutManager.setWingOffset(
                        this.hangarShipId,
                        drag.startOffsetX + outward / Math.max(1, core.width),
                        drag.startOffsetY + dy / Math.max(1, core.height)
                    );
                }
            } else if (drag.edge) {
                const edge = drag.edge;
                const widthSign = edge.indexOf('right') !== -1 ? 1 : (edge.indexOf('left') !== -1 ? -1 : 0);
                const heightSign = edge.indexOf('bottom') !== -1 ? 1 : (edge.indexOf('top') !== -1 ? -1 : 0);
                shipLoadoutManager.setSegmentScale(
                    this.hangarShipId,
                    drag.segment,
                    drag.startScaleX + (widthSign * dx) / Math.max(1, drag.frameWidth || core.width),
                    drag.startScaleY + (heightSign * dy) / Math.max(1, drag.frameHeight || core.height)
                );
            } else {
                shipLoadoutManager.setSegmentOffset(
                    this.hangarShipId,
                    drag.segment,
                    0,
                    drag.startSegmentOffsetY + dy / Math.max(1, core.height)
                );
            }
            this._hangarWingDragState = drag;
            if (!this._hangarLiveDrawRaf) {
                this._hangarLiveDrawRaf = requestAnimationFrame(() => {
                    this._hangarLiveDrawRaf = 0;
                    if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
                });
            }
        };
        const move = (e) => {
            if (drag) {
                applyDrag(e);
            } else {
                updateHover(e);
            }
        };
        const up = (e) => {
            if (!drag) return;
            const movingModule = !!drag.module;
            applyDrag(e);
            drag = null;
            this._hangarWingDragState = null;
            if (this._hangarLiveDrawRaf) {
                cancelAnimationFrame(this._hangarLiveDrawRaf);
                this._hangarLiveDrawRaf = 0;
            }
            canvas.classList.remove('is-wing-dragging');
            canvas.classList.remove('is-wing-scaling');
            canvas.classList.remove('is-module-dragging');
            if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
            // Keep the side dropdown open while an individual module moves.
            // Still refresh canvas + pink pins without rebuilding the hangar DOM.
            if (movingModule) this.drawHangarBay();
            else this.createUI();
        };
        const cancel = () => {
            drag = null;
            this._hangarWingDragState = null;
            canvas.classList.remove('is-wing-dragging');
            canvas.classList.remove('is-wing-scaling');
            canvas.classList.remove('is-module-dragging');
        };
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', cancel);
        canvas.title = 'Mitte ziehen: verschieben · Rand ziehen: in Zugrichtung skalieren';
        canvas.style.cursor = 'grab';
        this._hangarWingDragCleanup = () => {
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', cancel);
            canvas.classList.remove('is-wing-dragging');
            canvas.classList.remove('is-wing-scaling');
            canvas.classList.remove('is-module-dragging');
            this._hangarWingDragCleanup = null;
        };
    }

    applyHangarSlotChoice(kind, slotIndex, moduleId, sourceEl) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.setSlotModule) return;
        const res = shipLoadoutManager.setSlotModule(this.hangarShipId, kind, slotIndex, moduleId);
        if (!res.ok) {
            let msg = 'SLOT UPDATE FAILED';
            if (res.reason === 'NEED_WEAPON') msg = 'NEED AT LEAST ONE WEAPON';
            if (res.reason === 'NEED_CHARGE_SHOT') msg = 'NEED CHARGE SHOT FIRST';
            if (res.reason === 'NEED_CHARGE_DRIVE') msg = 'NEED CHARGE DRIVE FIRST';
            if (res.reason === 'NO_SLOT') msg = 'NO SLOT';
            if (sourceEl) this.playButtonResult(sourceEl, false, msg);
            else this.statusMsg = msg;
            return;
        }
        if (typeof shipConfigManager !== 'undefined') {
            const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                ? profileManager.getActiveProfile().activeShipId
                : this.hangarShipId;
            if (active === this.hangarShipId) {
                shipConfigManager.applyToRuntime(this.hangarShipId);
            }
        }
        this._hangarOpenSlot = null;
        const label = moduleId
            ? (this.hangarModuleLabel(moduleId) + ' EQUIPPED')
            : 'SLOT CLEARED';
        if (sourceEl) this.playButtonResult(sourceEl, true, label);
        else {
            this.statusMsg = label;
            this.createUI();
        }
    }

    bindHangarSlotEvents() {
        if (!this.overlay) return;
        this.bindHangarModuleScale();
        this.bindHangarSlotPinDrag();

        this.overlay.querySelectorAll('[data-hangar-slot-toggle]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                if (btn._hsJustDragged) {
                    btn._hsJustDragged = false;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const kind = btn.getAttribute('data-hangar-slot-toggle');
                const index = Number(btn.getAttribute('data-slot-index') || 0);
                const same = this._hangarOpenSlot
                    && this._hangarOpenSlot.kind === kind
                    && Number(this._hangarOpenSlot.index) === index;
                this._hangarOpenSlot = same ? null : { kind: kind, index: index };
                this.overlay.querySelectorAll('.hs-hangar-slot').forEach((el) => {
                    const open = el.getAttribute('data-slot-kind') === kind
                        && Number(el.getAttribute('data-slot-index')) === index
                        && !same;
                    el.classList.toggle('is-open', open);
                });
            });
        });

        this.overlay.querySelectorAll('[data-hangar-slot-set]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const kind = btn.getAttribute('data-hangar-slot-set');
                const index = Number(btn.getAttribute('data-slot-index') || 0);
                const modId = btn.getAttribute('data-mod-id') || '';
                this.applyHangarSlotChoice(kind, index, modId, btn);
            });
        });

        this.overlay.querySelectorAll('[data-hangar-slot-select]').forEach((sel) => {
            sel.addEventListener('change', () => {
                const kind = sel.getAttribute('data-hangar-slot-select');
                const index = Number(sel.getAttribute('data-slot-index') || 0);
                this.applyHangarSlotChoice(kind, index, sel.value || '', sel);
            });
            sel.addEventListener('click', (e) => e.stopPropagation());
        });

        this.overlay.querySelectorAll('[data-hangar-slot-skin]').forEach((sel) => {
            sel.addEventListener('change', () => {
                if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.setModuleSkin) return;
                const kind = sel.getAttribute('data-hangar-slot-skin');
                const face = sel.getAttribute('data-mod-face') || '';
                const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
                const key = shipLoadoutManager.kindToLoadoutKey(kind);
                const modId = (loadout[key] || [])[Number(sel.getAttribute('data-slot-index') || 0)];
                if (!modId) return;
                shipLoadoutManager.setModuleSkin(this.hangarShipId, kind, modId, face, sel.value || 'default');
                this.drawHangarBay();
            });
            sel.addEventListener('click', (e) => e.stopPropagation());
        });

        if (!this._hangarSlotOutsideBound) {
            this._hangarSlotOutsideBound = (e) => {
                if (!this.isVisible || this.tab !== 'hangar' || !this._hangarOpenSlot) return;
                if (e.target && e.target.closest && e.target.closest('.hs-hangar-slot')) return;
                this._hangarOpenSlot = null;
                if (this.overlay) {
                    this.overlay.querySelectorAll('.hs-hangar-slot.is-open')
                        .forEach((el) => el.classList.remove('is-open'));
                }
            };
            document.addEventListener('click', this._hangarSlotOutsideBound);
        }

        const stage = this.overlay.querySelector('#hsHangarBayStage');
        if (stage && typeof ResizeObserver !== 'undefined') {
            if (this._hangarBayResizeObs) {
                this._hangarBayResizeObs.disconnect();
                this._hangarBayResizeObs = null;
            }
            this._hangarBayResizeObs = new ResizeObserver(() => {
                if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
            });
            this._hangarBayResizeObs.observe(stage);
        }

        // Redraw bay after layout settles (stage may start at 0 height)
        requestAnimationFrame(() => {
            this.drawHangarBay();
            requestAnimationFrame(() => this.drawHangarBay());
        });
    }

    /**
     * The .hs-hangar-slot-pin buttons sit on top of the hangar-bay canvas
     * (pointer-events: auto, so they can be clicked to open the loadout
     * dropdown) and therefore intercept every pointerdown on a module icon
     * before the canvas's own moduleHit/drag code ever sees it — dragging a
     * module was effectively impossible. This gives each pin its own
     * pointer-drag: a plain click still opens the dropdown, but a real drag
     * moves the module, using the same ox/oy/scale/model cached by
     * drawHangarBay() so both systems agree on where the module actually is.
     */
    bindHangarSlotPinDrag() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-hangar-slot-pin').forEach((pin) => {
            if (pin.dataset.dragBound === '1') return;
            pin.dataset.dragBound = '1';
            let drag = null;
            pin.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const kind = pin.getAttribute('data-hangar-slot-toggle');
                const modId = pin.getAttribute('data-mod-id') || '';
                const modFace = pin.getAttribute('data-mod-face') || '';
                if (!kind || typeof shipLoadoutManager === 'undefined') return;
                const model = this._hangarLastModel;
                if (!model || !model.layout) return;
                if (!modId) {
                    // Empty slot — nothing to look up in layout.modules, so
                    // drag a standalone per-slot anchor instead of a module
                    // offset (see setEmptySlotAnchor / slotAnchors).
                    if (!shipLoadoutManager.setEmptySlotAnchor) return;
                    const container = pin.closest('.hs-hangar-slot');
                    const index = Number(pin.getAttribute('data-slot-index') || 0);
                    const startNx = container
                        ? parseFloat(container.style.getPropertyValue('--pin-x')) || 0.5
                        : 0.5;
                    const startNy = container
                        ? parseFloat(container.style.getPropertyValue('--pin-y')) || 0.5
                        : 0.5;
                    drag = {
                        emptySlot: true,
                        startX: e.clientX,
                        startY: e.clientY,
                        moved: false,
                        kind: kind,
                        index: index,
                        startNx: startNx,
                        startNy: startNy,
                        mw: Math.max(8, model.width || 20),
                        mh: Math.max(8, model.height || 16)
                    };
                    pin.setPointerCapture(e.pointerId);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (!shipLoadoutManager.setModuleOffset) return;
                // Two equipped modules can share the same id (e.g. the same
                // weapon in both weapon slots) — match by face too, or
                // dragging slot 2 would grab slot 1's module instead.
                const modules = model.layout.modules || [];
                const mod = modules.find((m) => m.kind === kind && m.id === modId && m.face === modFace)
                    || modules.find((m) => m.kind === kind && m.id === modId);
                if (!mod) return;
                const segmentId = mod.mountSegment === 'wing'
                    ? (mod.face === 'left' ? 'wingLeft' : 'wingRight')
                    : mod.mountSegment;
                const segment = (model.layout.segments || []).find((seg) => seg.id === segmentId);
                const loadout = shipLoadoutManager.getLoadout(this.hangarShipId);
                const offsetKey = shipLoadoutManager.moduleOffsetKey
                    ? shipLoadoutManager.moduleOffsetKey(modId, mod.face)
                    : modId;
                const stored = loadout.moduleOffsets
                    && loadout.moduleOffsets[kind]
                    && (loadout.moduleOffsets[kind][offsetKey] || loadout.moduleOffsets[kind][modId]);
                drag = {
                    startX: e.clientX,
                    startY: e.clientY,
                    moved: false,
                    kind: kind,
                    modId: modId,
                    modFace: mod.face,
                    startOffsetX: stored ? Number(stored.x) || 0 : 0,
                    startOffsetY: stored ? Number(stored.y) || 0 : 0,
                    segmentWidth: Math.max(1, segment ? segment.width : mod.width || 1),
                    segmentHeight: Math.max(1, segment ? segment.height : mod.height || 1)
                };
                this._hangarSelectedModule = { kind: kind, id: modId };
                pin.setPointerCapture(e.pointerId);
                e.preventDefault();
                e.stopPropagation();
            });
            pin.addEventListener('pointermove', (e) => {
                if (!drag) return;
                const canvas = this.overlay && this.overlay.querySelector('#hsHangarBayCanvas');
                const scale = this._hangarLastScale || 1;
                let sx = 1;
                let sy = 1;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    sx = canvas.width / Math.max(1, rect.width);
                    sy = canvas.height / Math.max(1, rect.height);
                }
                if (!drag.moved && (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3)) {
                    drag.moved = true;
                    pin._hsJustDragged = true;
                }
                if (drag.emptySlot) {
                    const dxCanvas = (e.clientX - drag.startX) * sx;
                    const dyCanvas = (e.clientY - drag.startY) * sy;
                    const sw = Math.max(1, drag.mw * scale);
                    const sh = Math.max(1, drag.mh * scale);
                    shipLoadoutManager.setEmptySlotAnchor(
                        this.hangarShipId,
                        drag.kind,
                        drag.index,
                        drag.startNx + dxCanvas / sw,
                        drag.startNy + dyCanvas / sh
                    );
                } else {
                    const dx = (e.clientX - drag.startX) * sx / Math.max(1, scale);
                    const dy = (e.clientY - drag.startY) * sy / Math.max(1, scale);
                    shipLoadoutManager.setModuleOffset(
                        this.hangarShipId,
                        drag.kind,
                        drag.modId,
                        drag.startOffsetX + dx / Math.max(1, drag.segmentWidth),
                        drag.startOffsetY + dy / Math.max(1, drag.segmentHeight),
                        drag.modFace
                    );
                }
                if (!this._hangarLiveDrawRaf) {
                    this._hangarLiveDrawRaf = requestAnimationFrame(() => {
                        this._hangarLiveDrawRaf = 0;
                        if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
                    });
                }
                e.preventDefault();
            });
            const end = (e) => {
                if (!drag) return;
                drag = null;
                if (pin.hasPointerCapture && pin.hasPointerCapture(e.pointerId)) {
                    pin.releasePointerCapture(e.pointerId);
                }
                this.drawHangarBay();
            };
            pin.addEventListener('pointerup', end);
            pin.addEventListener('pointercancel', end);
        });
    }

    getHangarPreviewAccent() {
        const root = getComputedStyle(document.documentElement);
        return (root.getPropertyValue('--color-primary') || root.getPropertyValue('--current-primary') || '#b44dff').trim() || '#b44dff';
    }

    hangarCloseupSize(model, canvasW, canvasH) {
        const mw = Math.max(8, model.width || 20);
        const mh = Math.max(8, model.height || 16);
        // Same pixel density as gameplay (2.25), mild close-up — not frame-filling
        const ingameScale = 2.25;
        const closeupZoom = 1.65;
        const userZoom = Math.max(0.5, Math.min(3, this._hangarPreviewZoom || 1));
        let scale = ingameScale * closeupZoom;
        const maxFit = Math.min((canvasW * 0.44) / mw, (canvasH * 0.38) / mh);
        scale = Math.min(scale, maxFit);
        scale = Math.max(ingameScale, scale);
        scale *= userZoom;
        return {
            width: Math.max(1, Math.round(mw * scale)),
            height: Math.max(1, Math.round(mh * scale))
        };
    }

    setHangarPreviewZoom(zoom, syncUi = true) {
        const next = Math.max(0.5, Math.min(3, Math.round(Number(zoom) * 100) / 100));
        if (!isFinite(next)) return;
        this._hangarPreviewZoom = next;
        if (syncUi && this.overlay) {
            const slider = this.overlay.querySelector('#hsHangarZoom');
            const label = this.overlay.querySelector('#hsHangarZoomLabel');
            const pct = Math.round(next * 100);
            if (slider && Number(slider.value) !== pct) slider.value = String(pct);
            if (label) label.textContent = `${pct}%`;
        }
        this.applyHangarPreviewZoomSize();
    }

    applyHangarPreviewZoomSize() {
        const canvas = this._hangarPreviewCanvas;
        const sim = this._hangarPreviewSim;
        if (!canvas || !sim || !sim.player) return;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const size = this.hangarCloseupSize(model, canvas.width, canvas.height);
        const cx = sim.player.x + sim.player.width / 2;
        const cy = sim.player.y + sim.player.height / 2;
        sim.player.width = size.width;
        sim.player.height = size.height;
        sim.player.x = cx - size.width / 2;
        sim.player.y = cy - size.height / 2;
    }

    bindHangarModuleScale() {
        if (!this.overlay) return;
        const bar = this.overlay.querySelector('#hsHangarModuleScale');
        const slider = this.overlay.querySelector('#hsHangarModuleScaleSlider');
        if (!slider || slider.dataset.bound === '1') return;
        slider.dataset.bound = '1';
        const apply = () => {
            const selected = this._hangarSelectedModule;
            if (!selected || !selected.id
                || typeof shipLoadoutManager === 'undefined'
                || !shipLoadoutManager.setModuleScale) return;
            const scale = Math.max(0.25, Math.min(6, Number(slider.value) / 100));
            shipLoadoutManager.setModuleScale(
                this.hangarShipId,
                selected.kind,
                selected.id,
                scale
            );
            const label = this.overlay.querySelector('#hsHangarModuleScaleLabel');
            if (label) label.textContent = Math.round(scale * 100) + '%';
            this.drawHangarBay();
        };
        slider.addEventListener('input', apply);
        slider.addEventListener('change', apply);
        ['click', 'mousedown', 'pointerdown'].forEach((ev) => {
            slider.addEventListener(ev, (e) => e.stopPropagation());
            if (bar) bar.addEventListener(ev, (e) => e.stopPropagation());
        });
        this.syncHangarModuleScaleUi();
    }

    bindHangarPreviewZoom() {
        if (!this.overlay) return;
        const slider = this.overlay.querySelector('#hsHangarZoom');
        const viewport = this.overlay.querySelector('#hsHangarPreviewViewport');
        if (slider) {
            slider.addEventListener('input', () => {
                this.setHangarPreviewZoom(Number(slider.value) / 100, false);
                const label = this.overlay.querySelector('#hsHangarZoomLabel');
                if (label) label.textContent = `${Math.round((this._hangarPreviewZoom || 1) * 100)}%`;
            });
            slider.addEventListener('click', (e) => e.stopPropagation());
            slider.addEventListener('mousedown', (e) => e.stopPropagation());
            slider.addEventListener('pointerdown', (e) => e.stopPropagation());
        }
        const zoomBar = this.overlay.querySelector('#hsHangarZoomBar');
        if (zoomBar) {
            zoomBar.addEventListener('click', (e) => e.stopPropagation());
        }
        if (viewport) {
            if (this._hangarPreviewWheelBound) {
                viewport.removeEventListener('wheel', this._hangarPreviewWheelBound);
            }
            this._hangarPreviewWheelBound = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const step = e.deltaY < 0 ? 0.1 : -0.1;
                this.setHangarPreviewZoom((this._hangarPreviewZoom || 1) + step);
            };
            viewport.addEventListener('wheel', this._hangarPreviewWheelBound, { passive: false });
        }
        this.setHangarPreviewZoom(this._hangarPreviewZoom || 1);
    }

    resetHangarPreviewSim() {
        const canvas = this._hangarPreviewCanvas;
        if (!canvas) return;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const size = this.hangarCloseupSize(model, canvas.width, canvas.height);
        this._hangarPreviewShipId = shipId;
        this._hangarPreviewSim = {
            player: {
                x: (canvas.width - size.width) / 2,
                y: canvas.height * 0.42,
                width: size.width,
                height: size.height,
                dir: 1
            },
            bullets: [],
            thrust: [],
            phase: 0,
            shootAcc: 0,
            burstLeft: 0,
            burstGap: 0,
            nextBurst: 900,
            mode: 'fly',
            modeTimer: 1800
        };
        this._hangarPreviewLastTs = 0;
    }

    destroyHangarPanelResize() {
        if (this._hangarPanelResize) {
            this._hangarPanelResize.destroy();
            this._hangarPanelResize = null;
        }
    }

    setupHangarPanelResize() {
        this.destroyHangarPanelResize();
        if (!this.overlay || typeof setupPanelResize !== 'function') return;
        const body = this.overlay.querySelector('.hs-hangar-split');
        if (!body) return;
        this._hangarPanelResize = setupPanelResize({
            body,
            root: body,
            storageKey: 'hsHangarPanelWidths',
            leftVar: '--hs-hangar-left-w',
            rightVar: '--hs-hangar-right-w',
            defaults: { left: 160, right: 220 },
            mins: { left: 110, right: 160, center: 240 }
        });
    }

    toggleHangarSidebar(side) {
        if (side === 'left') {
            this._hangarLeftCollapsed = !this._hangarLeftCollapsed;
        } else if (side === 'right') {
            this._hangarRightCollapsed = !this._hangarRightCollapsed;
        }
        try {
            localStorage.setItem('vf_hs_hangar_sidebar_prefs_v1', JSON.stringify({
                left: this._hangarLeftCollapsed,
                right: this._hangarRightCollapsed
            }));
        } catch (e) { /* ignore */ }
        this.createUI();
    }

    startHangarPreview() {
        this.stopHangarPreview();
        if (!this.overlay) return;
        const canvas = this.overlay.querySelector('#hsHangarPreview');
        if (!canvas) return;
        this._hangarPreviewCanvas = canvas;
        this._hangarPreviewCtx = canvas.getContext('2d');
        this.resetHangarPreviewSim();
        this.bindHangarPreviewZoom();
        const loop = (ts) => {
            if (!this.isVisible || this.tab !== 'hangar') return;
            if (!this._hangarPreviewLastTs) this._hangarPreviewLastTs = ts;
            const dt = Math.min(50, ts - this._hangarPreviewLastTs);
            this._hangarPreviewLastTs = ts;
            this.updateHangarPreviewSim(dt);
            this.drawHangarPreview();
            this._hangarPreviewAnimId = requestAnimationFrame(loop);
        };
        this._hangarPreviewAnimId = requestAnimationFrame(loop);
    }

    stopHangarPreview() {
        if (this._hangarPreviewWheelBound) {
            const viewport = this.overlay && this.overlay.querySelector('#hsHangarPreviewViewport');
            if (viewport) viewport.removeEventListener('wheel', this._hangarPreviewWheelBound);
            this._hangarPreviewWheelBound = null;
        }
        if (this._hangarPreviewAnimId) {
            cancelAnimationFrame(this._hangarPreviewAnimId);
            this._hangarPreviewAnimId = null;
        }
        this._hangarPreviewLastTs = 0;
        this._hangarPreviewSim = null;
        this._hangarPreviewCanvas = null;
        this._hangarPreviewCtx = null;
        this._hangarPreviewShipId = null;
    }

    updateHangarPreviewSim(dtMs) {
        const sim = this._hangarPreviewSim;
        const canvas = this._hangarPreviewCanvas;
        if (!sim || !canvas) return;
        if (this._hangarPreviewShipId !== this.hangarShipId) {
            this.resetHangarPreviewSim();
            return;
        }

        const frameScale = dtMs / 16.67;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const cfg = (typeof shipConfigManager !== 'undefined')
            ? shipConfigManager.getConfig(shipId)
            : null;
        const size = this.hangarCloseupSize(model, canvas.width, canvas.height);
        const p = sim.player;
        p.width = size.width;
        p.height = size.height;

        sim.phase += dtMs * 0.0035;
        sim.modeTimer -= dtMs;
        if (sim.modeTimer <= 0) {
            sim.mode = sim.mode === 'fly' ? 'shoot' : 'fly';
            sim.modeTimer = sim.mode === 'shoot' ? 1600 + Math.random() * 900 : 2200 + Math.random() * 1400;
            if (sim.mode === 'shoot') {
                sim.burstLeft = 3 + Math.floor(Math.random() * 3);
                sim.burstGap = 0;
            }
        }

        const speed = Math.max(0.4, Number((cfg && cfg.speed) || model.speed || 4) * 0.22);
        const margin = Math.max(12, (canvas.width - size.width) * 0.18);
        const baseX = (canvas.width - size.width) / 2;
        const sway = Math.sin(sim.phase) * Math.min(28, canvas.width * 0.08);
        if (sim.mode === 'fly') {
            p.x = baseX + sway + Math.sin(sim.phase * 0.55) * 10;
            p.dir = Math.cos(sim.phase) >= 0 ? 1 : -1;
        } else {
            p.x += p.dir * speed * 0.35 * frameScale;
            if (p.x <= margin || p.x + p.width >= canvas.width - margin) {
                p.dir *= -1;
                p.x = Math.max(margin, Math.min(canvas.width - margin - p.width, p.x));
            }
        }
        p.x = Math.max(8, Math.min(canvas.width - p.width - 8, p.x));
        p.y = canvas.height * 0.40 + Math.sin(sim.phase * 1.35) * 10;

        // Engine thrust particles (flying feel)
        if (Math.random() < 0.55) {
            sim.thrust.push({
                x: p.x + p.width * (0.35 + Math.random() * 0.3),
                y: p.y + p.height - 2,
                vy: 1.2 + Math.random() * 1.6,
                life: 280 + Math.random() * 220,
                w: 2 + Math.floor(Math.random() * 2)
            });
        }
        sim.thrust = sim.thrust.filter((t) => {
            t.y += t.vy * frameScale;
            t.life -= dtMs;
            return t.life > 0 && t.y < canvas.height + 8;
        });

        // Intermittent shooting bursts
        const cooldown = Math.max(70, Number((cfg && cfg.weaponCooldown) || model.weaponCooldown || 300));
        const bulletSpeed = Math.max(2.5, Number((cfg && cfg.weaponSpeed) || model.weaponSpeed || 8) * 0.85);
        if (sim.mode === 'shoot' && sim.burstLeft > 0) {
            sim.burstGap -= dtMs;
            if (sim.burstGap <= 0) {
                sim.burstGap = Math.min(160, cooldown * 0.45);
                sim.burstLeft -= 1;
                sim.bullets.push({
                    x: p.x + p.width / 2 - 1,
                    y: p.y - 4,
                    vy: -bulletSpeed,
                    life: 1400,
                    w: 2,
                    h: 6
                });
            }
        } else {
            sim.shootAcc += dtMs;
            if (sim.shootAcc >= sim.nextBurst) {
                sim.shootAcc = 0;
                sim.nextBurst = 1400 + Math.random() * 1600;
                sim.burstLeft = 2 + Math.floor(Math.random() * 3);
                sim.burstGap = 0;
                sim.mode = 'shoot';
                sim.modeTimer = 900 + sim.burstLeft * 120;
            }
        }

        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y > -16;
        });
    }

    drawHangarPreview() {
        const ctx = this._hangarPreviewCtx;
        const canvas = this._hangarPreviewCanvas;
        const sim = this._hangarPreviewSim;
        if (!ctx || !canvas || !sim) return;

        const w = canvas.width;
        const h = canvas.height;
        const accent = this.getHangarPreviewAccent();
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, w, h);

        // Starfield — vertical scroll only (matches playfield motion cues)
        ctx.fillStyle = accent;
        for (let i = 0; i < 48; i++) {
            const alpha = 0.18 + (i % 5) * 0.08;
            ctx.globalAlpha = alpha;
            const sx = (i * 53) % w;
            const sy = (i * 79 + sim.phase * 36) % h;
            ctx.fillRect(sx, sy, 1 + (i % 3 === 0 ? 1 : 0), 1);
        }
        ctx.globalAlpha = 1;

        // Soft vignette ring
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.22;
        ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        ctx.globalAlpha = 1;

        // Thrust
        sim.thrust.forEach((t) => {
            ctx.globalAlpha = Math.max(0.15, t.life / 500);
            ctx.fillStyle = accent;
            ctx.fillRect(t.x, t.y, t.w, t.w + 2);
        });
        ctx.globalAlpha = 1;

        // Bullets
        sim.bullets.forEach((b) => {
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.95;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.globalAlpha = 0.35;
            ctx.fillRect(b.x - 1, b.y + 2, b.w + 2, b.h - 2);
        });
        ctx.globalAlpha = 1;

        const p = sim.player;
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, p.width);
            tmp.height = Math.max(1, p.height);
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, Math.round(p.x), Math.round(p.y), p.width, p.height);
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
            const scale = Math.min(p.width / (model.width || 20), p.height / (model.height || 16));
            graphicsManager.shipAssetLoader.renderShip(ctx, model, p.x, p.y, scale, accent, 0.15);
        } else {
            ctx.fillStyle = accent;
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.shipName(shipId), 10, 16);
        ctx.globalAlpha = 0.55;
        ctx.fillText(sim.mode === 'shoot' ? 'FIRE' : 'FLY', 10, 30);
        ctx.globalAlpha = 1;
    }

    captureFlashTarget(btn) {
        if (!btn || !btn.getAttribute) return null;
        const attrs = [
            'data-upgrade-node', 'data-upgrade', 'data-frame-up', 'data-mod-up',
            'data-travel', 'data-unlock', 'data-buy', 'data-buy-bp', 'data-buy-part',
            'data-buy-portal', 'data-craft', 'data-activate-ship', 'data-toggle-mod',
            'data-hangar-slot-set', 'data-fire-mode', 'id'
        ];
        for (let i = 0; i < attrs.length; i++) {
            const a = attrs[i];
            if (!btn.hasAttribute(a)) continue;
            const out = { attr: a, value: btn.getAttribute(a), ok: false };
            if (a === 'data-toggle-mod') out.modId = btn.getAttribute('data-mod-id');
            if (a === 'data-hangar-slot-set') {
                out.modId = btn.getAttribute('data-mod-id');
                out.slotIndex = btn.getAttribute('data-slot-index');
            }
            return out;
        }
        return null;
    }

    flashResult(el, ok) {
        if (!el) return;
        el.classList.remove('hs-fx-ok', 'hs-fx-fail');
        void el.offsetWidth;
        el.classList.add(ok ? 'hs-fx-ok' : 'hs-fx-fail');
        const status = this.overlay && this.overlay.querySelector('.hs-status');
        if (status) {
            status.classList.remove('hs-status-ok', 'hs-status-fail');
            void status.offsetWidth;
            status.classList.add(ok ? 'hs-status-ok' : 'hs-status-fail');
        }
        if (this._fxClearTimer) clearTimeout(this._fxClearTimer);
        this._fxClearTimer = setTimeout(() => {
            el.classList.remove('hs-fx-ok', 'hs-fx-fail');
            if (status) status.classList.remove('hs-status-ok', 'hs-status-fail');
            this._fxClearTimer = null;
        }, 520);
    }

    applyPendingFlash() {
        const p = this._pendingFlash;
        this._pendingFlash = null;
        if (!p || !this.overlay) return;
        let el = null;
        if (p.attr === 'id') {
            el = this.overlay.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(p.value) : p.value));
        } else {
            const nodes = this.overlay.querySelectorAll('[' + p.attr + ']');
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n.getAttribute(p.attr) !== p.value) continue;
                if (p.attr === 'data-toggle-mod' && p.modId && n.getAttribute('data-mod-id') !== p.modId) continue;
                if (p.attr === 'data-hangar-slot-set') {
                    if (p.modId != null && n.getAttribute('data-mod-id') !== p.modId) continue;
                    if (p.slotIndex != null && n.getAttribute('data-slot-index') !== String(p.slotIndex)) continue;
                }
                el = n;
                break;
            }
        }
        if (el) this.flashResult(el, !!p.ok);
    }

    setStatus(msg, opts) {
        this.statusMsg = String(msg || '');
        if (opts && opts.refresh === false && this.overlay) {
            const status = this.overlay.querySelector('.hs-status');
            if (status) {
                status.textContent = this.statusMsg || '\u00A0';
                status.classList.toggle('is-empty', !this.statusMsg);
            }
            return;
        }
        this.createUI();
    }

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
    }

    playButtonResult(btn, ok, msg) {
        const target = this.captureFlashTarget(btn);
        if (target) {
            target.ok = !!ok;
            this._pendingFlash = target;
        }
        this.setStatus(msg);
    }

    switchTab(dir) {
        const idx = this._tabs.indexOf(this.tab);
        const next = (idx + dir + this._tabs.length) % this._tabs.length;
        this.tab = this._tabs[next];
        this.statusMsg = '';
        this.focusIndex = 0;
        this._navLevel = 'tabs';
        this.persistTab();
        this.createUI();
    }

    activateFocused() {
        const list = this.getFocusables();
        const el = list[this.focusIndex];
        if (el) el.click();
    }

    isMainTabChrome(el) {
        return !!(el && el.hasAttribute && el.hasAttribute('data-tab'));
    }

    findFirstBodyFocusable(list) {
        return this.findFirstContentFocusable(list);
    }

    scrollFocusedIntoView() {
        const list = this.getFocusables();
        const el = list[this.focusIndex];
        if (!el || typeof el.scrollIntoView !== 'function') return;
        try {
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch (err) {
            el.scrollIntoView();
        }
    }

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
    }

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
                if (e.key === 'Escape') {
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
            if (e.key === 'Escape') {
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
    }

    bindEvents() {
        const menu = this.overlay.querySelector('#hsMenu');
        if (menu) menu.addEventListener('click', () => this.openMainMenuOverlay());
        this.overlay.querySelectorAll('[data-menu-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.openMainMenuOverlay({ tab: btn.getAttribute('data-menu-tab') });
            });
        });
        const logout = this.overlay.querySelector('#hsLogout');
        if (logout) logout.addEventListener('click', () => this.logout());
        const root = this.overlay.querySelector('.home-station-content');
        if (root) {
            const activatePointerMode = () => {
                root.classList.add('hs-pointer-mode');
            };
            root.addEventListener('pointermove', activatePointerMode);
            root.addEventListener('pointerenter', activatePointerMode);
            root.addEventListener('mousemove', activatePointerMode);
        }

        this.bindResourceBuyModalEvents();

        this.overlay.querySelectorAll('[data-tab]').forEach((btn) => {
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

        this.overlay.querySelectorAll('[data-explore]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.openExploration(btn.getAttribute('data-explore'));
            });
        });

        this.overlay.querySelectorAll('[data-shop-cat]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const prev = this.shopCategory;
                this.shopCategory = btn.getAttribute('data-shop-cat') || 'ships';
                this.resetShopControlsIfNeeded(prev);
                this.statusMsg = '';
                this.focusIndex = 0;
                this._navLevel = 'sub';
                this.persistTab();
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-upgrade-sub]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.upgradeSubTab = btn.getAttribute('data-upgrade-sub') || 'station';
                this._resBuyModal = null;
                this.statusMsg = '';
                this.focusIndex = 0;
                this._navLevel = 'sub';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-frame-up]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-frame-up');
                const res = profileManager.purchaseShipFrameUpgrade(id);
                if (res.ok) {
                    this.playButtonResult(btn, true, 'FRAME UPGRADED: ' + this.shipName(id) + ' L' + res.level);
                } else if (res.reason === 'RESOURCES') {
                    this.openResourceBuyModal({
                        title: this.shipName(id) + ' · FRAME L' + (res.nextLevel || ''),
                        cost: res.cost,
                        action: { type: 'frame-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-mod-up]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-mod-up') || '';
                const sep = raw.indexOf(':');
                const cat = sep === -1 ? '' : raw.slice(0, sep);
                const track = sep === -1 ? raw : raw.slice(sep + 1);
                const res = profileManager.purchaseModuleUpgrade(cat, track);
                if (res.ok) {
                    this.playButtonResult(btn, true, 'MODULE UPGRADE: ' + cat.toUpperCase() + '/' + track.toUpperCase() + ' L' + res.level);
                } else if (res.reason === 'RESOURCES') {
                    const meta = (typeof economyConfig !== 'undefined' &&
                        economyConfig.moduleUpgradeDefs &&
                        economyConfig.moduleUpgradeDefs[cat] &&
                        economyConfig.moduleUpgradeDefs[cat][track])
                        ? economyConfig.moduleUpgradeDefs[cat][track]
                        : null;
                    this.openResourceBuyModal({
                        title: ((meta && meta.label) || (cat + '/' + track)).toUpperCase() +
                            (res.nextLevel ? (' · L' + res.nextLevel) : ''),
                        cost: res.cost,
                        action: { type: 'module-upgrade', cat: cat, track: track }
                    });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-travel]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-travel');
                const res = profileManager.travelToGalaxy(gid);
                if (res.ok) {
                    const name = String(gid).replace(/_/g, ' ').toUpperCase();
                    const factionTag = res.faction ? (' · ' + String(res.faction).toUpperCase()) : '';
                    const seeded = res.seeded
                        ? (' · ' + ((res.planetIds && res.planetIds.length) || 0) + ' PLANETS CHARTED')
                        : '';
                    this.playButtonResult(btn, true, 'TRAVELLED TO ' + name + factionTag + seeded);
                } else if (res.reason === 'DRIVE') {
                    this.playButtonResult(btn, false, 'NEED WARP L' + (res.requireWarp || 1) + ' OR BUY PORTAL');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-shop-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.shopFilter = btn.getAttribute('data-shop-filter') || 'all';
                this.captureShopPrefs();
                this.persistTab();
                this.statusMsg = '';
                if (this._navLevel !== 'tabs') this._navLevel = 'content';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-shop-sort]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.shopSort = btn.getAttribute('data-shop-sort') || 'name';
                this.captureShopPrefs();
                this.persistTab();
                this.statusMsg = '';
                if (this._navLevel !== 'tabs') this._navLevel = 'content';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-shop-qty]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-shop-qty') || '1';
                const q = raw === 'all' ? 'all' : Math.round(Number(raw) || 1);
                this.shopResourceQty = this._resourceQtyOptions.indexOf(q) !== -1 ? q : 1;
                this.captureShopPrefs();
                this.persistTab();
                this.statusMsg = '';
                if (this._navLevel !== 'tabs') this._navLevel = 'content';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-buy-res]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy-res');
                const bag = this.shopFilter === 'cargo' ? 'cargo' : 'station';
                const profile = this.getProfile();
                const qty = this.resolveResourceTradeQty(profile, id, bag, 'buy');
                if (qty < 1) {
                    this.playButtonResult(btn, false, 'NO ROOM OR CREDITS');
                    return;
                }
                const res = profileManager.buyShopResource(id, qty, bag);
                if (res.ok) {
                    const label = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getResourceLabel(id)
                        : String(id).toUpperCase();
                    this.playButtonResult(btn, true, 'BOUGHT ' + res.amount + ' ' + label + ' → ' + bag.toUpperCase());
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-sell-res]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-sell-res');
                const bag = this.shopFilter === 'cargo' ? 'cargo' : 'station';
                const profile = this.getProfile();
                const qty = this.resolveResourceTradeQty(profile, id, bag, 'sell');
                if (qty < 1) {
                    this.playButtonResult(btn, false, 'EMPTY');
                    return;
                }
                const res = profileManager.sellShopResource(id, qty, bag);
                if (res.ok) {
                    const label = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getResourceLabel(id)
                        : String(id).toUpperCase();
                    const cred = (res.payout && res.payout.credits) || 0;
                    this.playButtonResult(btn, true, 'SOLD ' + res.amount + ' ' + label + ' · +' + cred + ' CREDITS');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        const teleport = this.overlay.querySelector('#hsTeleport');
        if (teleport) {
            teleport.addEventListener('click', () => {
                if (typeof profileManager === 'undefined') return;
                if (!profileManager.hasCargo()) {
                    this.playButtonResult(teleport, false, 'CARGO EMPTY');
                    return;
                }
                const moved = profileManager.teleportCargoToStation();
                if (!moved) {
                    this.playButtonResult(teleport, false, 'STATION FULL — UPGRADE STORAGE');
                    return;
                }
                if (profileManager.hasCargo()) {
                    this.playButtonResult(teleport, true, 'PARTIAL TELEPORT — STORAGE FULL');
                } else {
                    this.playButtonResult(teleport, true, 'CARGO TELEPORTED TO STATION');
                }
            });
        }

        this.overlay.querySelectorAll('[data-upgrade-node]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                const id = btn.getAttribute('data-upgrade-node');
                this.selectedUpgradeNode = id;
                if (btn.hasAttribute('data-upgrade')) {
                    return;
                }
                ev.preventDefault();
                const node = (typeof economyConfig !== 'undefined')
                    ? economyConfig.getStationUpgradeNode(id)
                    : null;
                if (!node) return;
                const profile = this.getProfile();
                const level = profileManager.getStationUpgradeLevel(id, profile);
                if (level >= node.maxLevel) {
                    this.playButtonResult(btn, true, node.label + ' · MAX');
                    return;
                }
                const check = profileManager.canUnlockStationUpgrade(id, profile);
                if (check.reason === 'LOCKED') {
                    const req = economyConfig.getStationUpgradeNode(node.requires);
                    const reqName = req ? req.label : String(node.requires || '').toUpperCase();
                    this.playButtonResult(btn, false, 'REQ ' + reqName + ' L' + (node.requireLevel || 1));
                } else if (check.reason === 'RESOURCES') {
                    const cost = check.cost || economyConfig.getStationUpgradeCost(id, level + 1);
                    this.openResourceBuyModal({
                        title: node.label + ' · L' + (level + 1),
                        cost: cost,
                        action: { type: 'station-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, check.reason || node.label);
                }
            });
        });
        this.bindUpgradeTipEvents();

        this.overlay.querySelectorAll('[data-upgrade]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-upgrade');
                this.selectedUpgradeNode = id;
                const res = profileManager.buyStationUpgrade(id);
                if (res.ok) {
                    const node = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeNode(id)
                        : null;
                    const label = node ? node.label : String(id || '').toUpperCase();
                    this.playButtonResult(btn, true, 'UPGRADED: ' + label + ' L' + res.level);
                } else if (res.reason === 'RESOURCES') {
                    const profile = this.getProfile();
                    const node = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeNode(id)
                        : null;
                    const level = profileManager.getStationUpgradeLevel(id, profile);
                    const cost = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeCost(id, level + 1)
                        : null;
                    this.openResourceBuyModal({
                        title: (node ? node.label : String(id || '').toUpperCase()) + ' · L' + (level + 1),
                        cost: cost,
                        action: { type: 'station-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-unlock]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-unlock');
                const res = profileManager.unlockShopItem(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('UNLOCKED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy');
                const res = profileManager.buyShip(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('PURCHASED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-bp]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy-bp');
                const res = profileManager.buyBlueprint(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('BLUEPRINT: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-part]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-buy-part') || '';
                const sep = raw.indexOf(':');
                const kind = sep === -1 ? '' : raw.slice(0, sep);
                const id = sep === -1 ? raw : raw.slice(sep + 1);
                const res = profileManager.buyPart(kind, id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('PART: ' + id.toUpperCase()) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-portal]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-buy-portal');
                const res = profileManager.buyPortal(gid);
                if (res.ok) {
                    const name = String(gid).replace(/_/g, ' ').toUpperCase();
                    this.playButtonResult(btn, true, 'PORTAL UNLOCKED: ' + name);
                } else if (res.reason === 'UNKNOWN FACTION') {
                    this.playButtonResult(btn, false, 'MEET THIS FACTION IN COMBAT FIRST');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-craft]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-craft');
                const res = profileManager.craftShip(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('CRAFTED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-hangar-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.hangarShipId = btn.getAttribute('data-hangar-ship');
                this.statusMsg = '';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-hangar-sidebar]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.toggleHangarSidebar(btn.getAttribute('data-hangar-sidebar'));
            });
        });

        this.overlay.querySelectorAll('[data-activate-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-activate-ship');
                if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
                    profileManager.setActiveShip(id);
                } else if (typeof profileManager !== 'undefined') {
                    const p = profileManager.getActiveProfile();
                    if (p) {
                        p.activeShipId = id;
                        profileManager.save();
                    }
                }
                if (typeof shipConfigManager !== 'undefined') {
                    shipConfigManager.applyToRuntime(id);
                }
                this.playButtonResult(btn, true, 'ACTIVE: ' + this.shipName(id));
            });
        });

        this.overlay.querySelectorAll('[data-toggle-mod]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const kind = btn.getAttribute('data-toggle-mod');
                const modId = btn.getAttribute('data-mod-id');
                if (e.altKey || e.shiftKey) {
                    e.preventDefault();
                    this.openComponentEditorForModule(kind, modId);
                    return;
                }
                if (typeof shipLoadoutManager === 'undefined') return;
                const check = shipLoadoutManager.canInstallModule(this.hangarShipId, kind, modId);
                if (!check.ok && !check.removing) {
                    let msg = 'SLOT FULL — UPGRADE FRAME';
                    if (check.reason === 'NEED_CHARGE_SHOT') msg = 'NEED CHARGE SHOT FIRST';
                    if (check.reason === 'NEED_CHARGE_DRIVE') msg = 'NEED CHARGE DRIVE FIRST';
                    this.playButtonResult(btn, false, msg);
                    return;
                }
                shipLoadoutManager.toggleModule(this.hangarShipId, kind, modId);
                if (typeof shipConfigManager !== 'undefined') {
                    const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                        ? profileManager.getActiveProfile().activeShipId
                        : this.hangarShipId;
                    if (active === this.hangarShipId) {
                        shipConfigManager.applyToRuntime(this.hangarShipId);
                    }
                }
                const L = shipLoadoutManager.getLoadout(this.hangarShipId);
                const n = shipLoadoutManager.moduleCount(L);
                this.playButtonResult(btn, true, 'LOADOUT UPDATED · ' + n + ' MODULES');
            });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const kind = btn.getAttribute('data-toggle-mod');
                const modId = btn.getAttribute('data-mod-id');
                this.openComponentEditorForModule(kind, modId);
            });
        });

        this.overlay.querySelectorAll('[data-fire-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-fire-mode');
                if (typeof shipLoadoutManager === 'undefined') return;
                if (mode === 'charge' && !shipLoadoutManager.ownsChargePart('ability', 'charge_shot')) {
                    this.playButtonResult(btn, false, 'BUY CHARGE SHOT IN PARTS SHOP');
                    return;
                }
                const before = shipLoadoutManager.getLoadout(this.hangarShipId);
                shipLoadoutManager.setFireMode(this.hangarShipId, mode);
                const after = shipLoadoutManager.getLoadout(this.hangarShipId);
                if (mode === 'charge' && (after.abilities || []).indexOf('charge_shot') === -1) {
                    this.playButtonResult(btn, false, 'NO ABILITY SLOT — UPGRADE FRAME');
                    return;
                }
                if (typeof shipConfigManager !== 'undefined') {
                    const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                        ? profileManager.getActiveProfile().activeShipId
                        : this.hangarShipId;
                    if (active === this.hangarShipId) {
                        shipConfigManager.applyToRuntime(this.hangarShipId);
                    }
                }
                if (typeof bulletManager !== 'undefined' && bulletManager.setFireMode) {
                    bulletManager.setFireMode(after.fireMode || 'auto');
                }
                if (typeof chargeSystem !== 'undefined' && typeof shipConfigManager !== 'undefined') {
                    const model = shipConfigManager.getMergedModel(this.hangarShipId);
                    if (model) chargeSystem.syncFromShipModel(model);
                }
                void before;
                this.playButtonResult(btn, true, 'FIRE MODE: ' + String(after.fireMode || 'auto').toUpperCase());
            });
        });

        const openTest = this.overlay.querySelector('#hsOpenTestArea');
        if (openTest) {
            openTest.addEventListener('click', () => this.openHangarTestArea());
        }

        this.bindKeyNav();
    }
}

const homeStationUI = new HomeStationUI();
window.homeStationUI = homeStationUI;
