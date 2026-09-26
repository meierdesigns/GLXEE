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
        this.shopCategory = 'resources'; // resources | ships | blueprints | parts | portals | styles
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
        this._hangarSelectedConnection = null;
        this._hangarShowGuides = true;
        this._hangarCardOffsets = {};
        this._hangarCardDragState = null;
        this._hangarPanelResize = null;
        this._hangarLeftCollapsed = false;
        this._hangarRightCollapsed = false;
        // Hangar left sidebar view (AREAS | PARTS), remembered across reloads.
        this._hangarLeftView = 'areas';
        try {
            if (localStorage.getItem('vf_hs_hangar_left_view') === 'parts') this._hangarLeftView = 'parts';
        } catch (e) { /* ignore */ }
        try {
            const raw = localStorage.getItem('vf_hs_hangar_sidebar_prefs_v1');
            const prefs = raw ? JSON.parse(raw) : null;
            if (prefs && typeof prefs === 'object') {
                this._hangarLeftCollapsed = prefs.left === true;
                this._hangarRightCollapsed = prefs.right === true;
            }
        } catch (e) { /* ignore */ }
        this.applyMenuOrder();
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
        this._shopCategories = ['resources', 'ships', 'blueprints', 'parts', 'portals', 'styles'];
        this._shopCatMeta = {
            ships: { label: 'SHIPS', icon: 'hsShip' },
            blueprints: { label: 'BLUEPRINTS', icon: 'hsBlueprint' },
            parts: { label: 'PARTS', icon: 'hsCraft' },
            portals: { label: 'PORTALS', icon: 'galaxyMilkyWay' },
            resources: { label: 'RESOURCES', icon: 'hsStores' },
            styles: { label: 'STYLES', icon: 'hsShip' }
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
        // Initialize HangarUI module — DISABLED TEMPORARILY for debugging
        // if (typeof HangarUI !== 'undefined') {
        //     this.hangarUI = new HangarUI(this);
        // }
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

    iconHtml(iconKey, size, className, tipLabel, tintOverride) {
        if (typeof iconRenderer !== 'undefined' && iconKey) {
            let tint = tintOverride || null;
            if (!tint) {
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
            }
            return iconRenderer.imgHtml(iconKey, size || 32, className || 'hs-pixel', tint, tipLabel);
        }
        return '';
    }

    /**
     * Full faction visual style (hull/edge/accent/silhouette) for the
     * current profile — drives both hangar loadout icon tinting and the
     * station screen's faction identity so the whole station reads in the
     * player's faction palette, not just the ship preview.
     */
    currentFactionStyle() {
        try {
            const profile = (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile
                && profileManager.hasActiveProfile()) ? profileManager.getActiveProfile() : null;
            const factionId = (profile && profile.faction) || 'terran';
            if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
                return factionShipStyles.getFactionStyle(factionId);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    /**
     * Accent color of the current profile's faction — used to tint the
     * hangar loadout icons so equipped components read in the same palette
     * as the ship's own hull instead of one flat neutral theme color.
     */
    hangarFactionAccent() {
        const style = this.currentFactionStyle();
        return (style && style.accent) || null;
    }

    /** Stamp the overlay root with the active faction's id + colors so CSS
     * can reskin station chrome (cover art tint, panel accents, patterns)
     * without touching the player's own UI theme palette. */
    applyFactionTheme() {
        if (!this.overlay) return;
        const style = this.currentFactionStyle();
        if (!style) {
            delete this.overlay.dataset.hsFaction;
            return;
        }
        const hull = style.hull || '#7a8490';
        const edge = style.edge || '#2a3038';
        const accent = style.accent || '#c8d0d8';
        this.overlay.dataset.hsFaction = style.id || 'terran';
        this.overlay.style.setProperty('--faction-hull', hull);
        this.overlay.style.setProperty('--faction-edge', edge);
        this.overlay.style.setProperty('--faction-accent', accent);
        // Repoint the overlay's own chrome palette at the faction. The station
        // chrome reads --color-* everywhere, so overriding those here (and only
        // here) recolours the whole modal without touching the player's chosen
        // UI theme anywhere else.
        const set = (name, value) => this.overlay.style.setProperty(name, value);
        set('--color-primary', accent);
        set('--color-secondary', hull);
        set('--color-accent', this.shiftHex(accent, 26));
        set('--color-border', this.shiftHex(hull, -18));
        set('--color-outline', this.shiftHex(edge, 24));
        set('--color-selected', accent);
        set('--color-active', this.shiftHex(accent, 18));
        set('--color-focus', this.shiftHex(accent, 18));
        set('--color-hover', this.shiftHex(hull, 34));
        // Same identity on the document root, so the in-game HUD keeps it
        // after the station overlay closes.
        if (factionShipStyles.applyDocumentFactionTheme) {
            factionShipStyles.applyDocumentFactionTheme(style.id);
        }
    }

    /** Lighten (positive) or darken (negative) a #rrggbb colour by `amount`. */
    shiftHex(hex, amount) {
        if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
        const n = parseInt(hex.slice(1), 16);
        const clamp = (v) => Math.max(0, Math.min(255, v + amount));
        const r = clamp((n >> 16) & 255);
        const g = clamp((n >> 8) & 255);
        const b = clamp(n & 255);
        return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    /** The pilot's faction emblem, tinted in the faction accent. */
    factionEmblemHtml(profile, size) {
        if (typeof iconRenderer === 'undefined' || typeof factionShipStyles === 'undefined') return '';
        const id = factionShipStyles.normalizeFaction(
            (profile && profile.faction) || factionShipStyles.resolveActiveFaction());
        const key = factionShipStyles.emblemCamelKey(id);
        const style = factionShipStyles.getFactionStyle(id);
        const label = id.charAt(0).toUpperCase() + id.slice(1);
        return iconRenderer.imgHtml(key, size, 'hs-faction-emblem', style && style.accent, label);
    }

    /**
     * Faction emblem framed in a pixel shield crest (station modal).
     * Sizes and outline come from the --crest-* variables in styles.css;
     * `place` picks the size variable (topbar | banner).
     */
    factionCrestHtml(profile, place) {
        // Rendered large and scaled down by CSS so any --crest-* size stays sharp.
        return `<span class="hs-crest hs-crest-${place}">` +
            `<span class="hs-crest-field">${this.factionEmblemHtml(profile, 128)}</span>` +
            `</span>`;
    }

    menuButtonHtml() {
        return '<span class="hs-menu-glyph" aria-hidden="true">≡</span>';
    }

    renderMenuTabs() {
        if (typeof startScreenManager === 'undefined') return '';
        const isMenu = this.tab === 'menu';
        const activeTab = isMenu
            ? startScreenManager.embeddedMenuTab
            : (this._menuOnlyTabs.indexOf(this.tab) !== -1 ? this.tab : null);
        return this.getMenuRowTabs().map((tab) => {
            const active = activeTab === tab.id;
            const icon = tab.icon ? this.iconHtml(tab.icon, 24, 'hs-pixel') : '';
            return `
            <button type="button" class="hs-menu-tab-btn${active ? ' active' : ''}" data-menu-tab="${tab.id}" title="${tab.label}" data-nav-item>
                <span class="hs-menu-tab-icon">${icon}</span>
                ${active ? `<span class="hs-menu-tab-label">${tab.label}</span>` : ''}
            </button>`;
        }).join('');
    }

    /** Build the tab rows from MENU_ORDER (js/ui/menu-order.js). */
    applyMenuOrder() {
        const stationTabs = ['play', 'travel', 'explorations', 'upgrade', 'hangar', 'components', 'craft', 'shop'];
        const order = (typeof MENU_ORDER !== 'undefined') ? MENU_ORDER : { main: stationTabs, esc: [] };
        const isStationTab = (id) => stationTabs.indexOf(id) !== -1;
        // Tabs reachable from the ESC/menu tab row instead of the main row.
        this._menuOnlyTabs = order.esc.filter(isStationTab);
        const main = order.main.filter((id) => id === 'station' || isStationTab(id));
        if (main.indexOf('station') === -1) main.unshift('station');
        this._tabs = main.concat(this._menuOnlyTabs);
    }

    /** Menu tab row: embedded start-menu tabs plus station menu-only tabs. */
    getMenuRowTabs() {
        const base = (typeof startScreenManager !== 'undefined' && startScreenManager.embeddedMenuTabs) || [];
        const extra = this._menuOnlyTabs.map((id) => {
            const meta = this._tabMeta[id] || { label: id.toUpperCase(), icon: '' };
            return { id: id, label: meta.label, icon: meta.icon };
        });
        const all = base.concat(extra);
        if (typeof MENU_ORDER === 'undefined') return all;
        const rank = (t) => {
            const i = MENU_ORDER.esc.indexOf(t.id);
            return i === -1 ? MENU_ORDER.esc.length : i;
        };
        return all.sort((a, b) => rank(a) - rank(b));
    }

    /**
     * Shop categories on offer right now: a docked trading post shows its own
     * specialty; the home station starts with resources only and gains the
     * categories of every trader unlocked by docking (dev mode: everything).
     */
    getAvailableShopCategories() {
        const post = this.getVisitedTradingPost && this.getVisitedTradingPost();
        let cats;
        if (post) {
            cats = post.categories || ['resources', 'parts'];
        } else if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) {
            cats = this._shopCategories.slice();
        } else if (typeof profileManager !== 'undefined' && profileManager.getUnlockedShopCategories) {
            cats = profileManager.getUnlockedShopCategories();
        } else {
            cats = ['resources'];
        }
        return this._shopCategories.filter((id) => cats.indexOf(id) !== -1);
    }

    /** Keep shopCategory on an available category. */
    ensureShopCategory() {
        const cats = this.getAvailableShopCategories();
        if (cats.indexOf(this.shopCategory) === -1) this.shopCategory = cats[0] || 'resources';
        return this.shopCategory;
    }

    tabIconHtml(iconKey) {
        return this.iconHtml(this.tabIconKey(iconKey), 32, 'hs-tab-pixel', this.tabMetaLabel(iconKey));
    }

    tabMetaLabel(iconKey) {
        const meta = Object.values(this._tabMeta || {}).find((m) => m.icon === iconKey);
        return meta ? meta.label : undefined;
    }

    /**
     * Tab icons share one 16×16 grid but were drawn off-centre and with grey
     * fringe pixels, so they read as different sizes and blurry once tinted.
     * Derive a clean variant: drop the fringe (below 10), crop to the shape
     * and centre it. Cached as IconSprites['<key>__tab'].
     */
    tabIconKey(iconKey) {
        if (typeof IconSprites === 'undefined' || !IconSprites || !IconSprites[iconKey]) return iconKey;
        const outKey = iconKey + '__tab';
        if (IconSprites[outKey]) return outKey;
        const src = IconSprites[iconKey];
        const rows = src.length;
        const cols = src[0].length;
        let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
        const clean = src.map((row, y) => row.map((v, x) => {
            if (v < 10) return 0;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x);
            y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            return 15;
        }));
        if (x1 < 0) return iconKey;
        const dx = Math.floor((cols - (x1 - x0 + 1)) / 2) - x0;
        const dy = Math.floor((rows - (y1 - y0 + 1)) / 2) - y0;
        const out = [];
        for (let y = 0; y < rows; y++) {
            out[y] = [];
            for (let x = 0; x < cols; x++) {
                const sy = y - dy, sx = x - dx;
                out[y][x] = (sy >= 0 && sy < rows && sx >= 0 && sx < cols) ? clean[sy][sx] : 0;
            }
        }
        IconSprites[outKey] = out;
        return outKey;
    }
}
