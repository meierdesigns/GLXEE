"use strict";

// HomeStationUI methods: docking at a galaxy trading post. Dock opens a
// fullscreen victory-trader modal (#vf-trading-post-shop) over the play map —
// portrait, wallet, stock grids, ship/station bags, detail pane, per-category
// skins. The first dock unlocks the trader for the home station shop. UNDOCK /
// Escape closes the modal.
extendClass(HomeStationUI, {
    TPS_CELL_PX: 48,
    TPS_GAP_PX: 2,
    TPS_STOCK_COLS: 6,
    TPS_CELL_MIN_PX: 32,
    TPS_CELL_MAX_PX: 120,

    /** This post's vendor bag — wealth + seed decide cols/rows for multi-slot stock. */
    tradingPostStockBag() {
        const post = this.getVisitedTradingPost && this.getVisitedTradingPost();
        if (post && typeof profileManager !== 'undefined' && profileManager.getTradingPostStockGrid) {
            return profileManager.getTradingPostStockGrid(post);
        }
        return { cols: this.TPS_STOCK_COLS, rows: 3, minRows: 2 };
    },

    /** Keep the docked shop panel filling the glass host (1:1 CSS, no shrink zoom). */
    fitTradingPostPanel(host) {
        if (!host) return;
        const panel = host.querySelector('.vf-iss-panel');
        if (!panel) return;
        panel.style.width = '100%';
        panel.style.height = '100%';
        panel.style.zoom = '';
        panel.style.transform = '';
    },

    getVisitedTradingPost() {
        if (!this.visitPostId || !this._tpsModalOpen || typeof profileManager === 'undefined') return null;
        const post = profileManager.getTradingPost(this.visitPostId);
        return post && profileManager.isTradingPostUnlocked(post) ? post : null;
    },

    openTradingPost(post) {
        if (!post) return;
        this.visitPostId = post.id;
        this._shopCategoryBeforeDock = this.shopCategory;
        const cats = post.categories || ['resources', 'parts'];
        // Open on the trader's specialty rather than the shared resource market.
        this.shopCategory = cats.find((c) => c !== 'resources') || 'resources';
        const isNew = typeof profileManager !== 'undefined' && profileManager.unlockTrader
            && profileManager.unlockTrader(post.id);
        this.shopFilter = 'all';
        this._tpsModalOpen = true;
        this._tpsFitCellPx = null;
        this._tpsFittingLock = false;
        this.mountTradingPostModal();
        const msg = 'DOCKED AT ' + post.name + (isNew ? ' · TRADER UNLOCKED AT HOME STATION' : '');
        if (this.showStatusToast) this.showStatusToast(msg);
        else this.statusMsg = msg;
    },

    undockTradingPost() {
        this.closeTradingPostModal();
        this.visitPostId = null;
        if (this._shopCategoryBeforeDock) this.shopCategory = this._shopCategoryBeforeDock;
        this._shopCategoryBeforeDock = null;
        this.statusMsg = '';
    },

    closeTradingPostModal() {
        this._tpsModalOpen = false;
        this._tpsFitCellPx = null;
        this._tpsFittingLock = false;
        if (this._tpsKeyHandler) {
            document.removeEventListener('keydown', this._tpsKeyHandler, true);
            this._tpsKeyHandler = null;
        }
        if (this._tpsOverlayPrev != null) {
            this.overlay = this._tpsOverlayPrev;
            this._tpsOverlayPrev = null;
        }
        const el = document.getElementById('vf-trading-post-shop');
        if (el) el.remove();
    },

    /** Fullscreen trader modal — same chrome as the victory in-stage shop. */
    mountTradingPostModal() {
        if (!this.visitPostId || typeof profileManager === 'undefined') return;
        const post = profileManager.getTradingPost(this.visitPostId);
        if (!post || !profileManager.isTradingPostUnlocked(post)) {
            this.undockTradingPost();
            return;
        }
        this._tpsModalOpen = true;
        const profile = this.getProfile();
        let el = document.getElementById('vf-trading-post-shop');
        if (!el) {
            el = document.createElement('div');
            el.id = 'vf-trading-post-shop';
            el.className = 'hs-tps vf-iss';
            el.setAttribute('role', 'presentation');
            document.body.appendChild(el);
        }
        el.innerHTML = this.renderTradingPostShop(profile, post);
        el.dataset.faction = String(post.faction || 'terran').toLowerCase();
        el.dataset.tpsCat = this.shopCategory || 'parts';
        this.applyTradingPostTheme(el);
        this.fitTradingPostPanel(el);
        if (typeof voxelPortrait !== 'undefined' && voxelPortrait.scan) {
            voxelPortrait.scan(el);
        }
        if (this.shopCategory === 'styles' && this.renderStyleThumbs) {
            this.renderStyleThumbs(el);
        }
        this.bindTradingPostModalEvents(el);
        this.bindTradingPostDetailHover(el);
        if (!this._tpsFittingLock) {
            requestAnimationFrame(() => {
                if (!this._tpsModalOpen) return;
                const host = document.getElementById('vf-trading-post-shop');
                if (host) this.fitTradingPostBagsToSpace(host);
            });
        }
        if (!this._tpsKeyHandler) {
            this._tpsKeyHandler = (e) => {
                if (!this._tpsModalOpen) return;
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.undockTradingPost();
                }
            };
            document.addEventListener('keydown', this._tpsKeyHandler, true);
        }
    },

    bindTradingPostModalEvents(root) {
        if (!root) return;
        const undock = root.querySelector('#hsUndock');
        if (undock) undock.addEventListener('click', () => this.undockTradingPost());
        root.querySelectorAll('[data-shop-cat]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const prev = this.shopCategory;
                this.shopCategory = btn.getAttribute('data-shop-cat') || 'ships';
                if (this.resetShopControlsIfNeeded) this.resetShopControlsIfNeeded(prev);
                this.mountTradingPostModal();
            });
        });
        // Point overlay at the modal so buy / bag-drag handlers resolve here.
        // createUI restores the home-station overlay first, then remounts.
        if (this.overlay && this.overlay.id !== 'vf-trading-post-shop') {
            this._tpsOverlayPrev = this.overlay;
        }
        this.overlay = root;
        if (this.bindStationEvents) this.bindStationEvents();
        if (this.bindShopStyleEvents) this.bindShopStyleEvents();
        if (this.bindShopSellEvents) this.bindShopSellEvents();
    },

    /** Restore the home-station overlay before createUI rebuilds the shell. */
    restoreTradingPostHomeOverlay() {
        if (this._tpsOverlayPrev) {
            this.overlay = this._tpsOverlayPrev;
            this._tpsOverlayPrev = null;
        }
    },

    /** Parts hint while docked: where the post is and whose stock it carries. */
    renderTradingPostHint(post) {
        const stock = profileManager.getTradingPostStock(post);
        const factions = [];
        stock.forEach((e) => {
            const f = (e.faction || 'neutral').toUpperCase();
            if (factions.indexOf(f) === -1) factions.push(f);
        });
        const planet = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig)
            ? planetConfigManager.getConfig(post.planetId)
            : null;
        const where = String((planet && planet.name) || post.planetId).toUpperCase();
        return `<p class="hs-muted hs-hint">Orbiting ${where}. Stock from ${factions.join(' · ')} — parts are refitted in your faction colours and mix freely on any ship.</p>`;
    },

    /** Kept for bindShopEvents no-op when the modal is not inside the HS overlay. */
    bindTradingPostEvents() {
        /* modal binds via bindTradingPostModalEvents */
    },

    /** Victory-trader chrome for a docked post (faction skin + category skin). */
    renderTradingPostShop(profile, post) {
        this.ensureShopCategory();
        const cat = this.shopCategory || 'parts';
        const faction = String((post && post.faction) || 'terran').toLowerCase();
        const factionLabel = faction.toUpperCase();
        const catMeta = this._shopCatMeta[cat] || { label: String(cat).toUpperCase(), icon: 'hsShop' };
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const variant = this.tradingPostPortraitVariant(post);
        return `<div class="vf-iss-panel" data-faction="${faction}" data-tps-cat="${cat}" role="dialog" aria-modal="true" aria-label="${post.name} shop">` +
            `<header class="vf-iss-head">` +
            `<div class="vf-iss-trader">` +
            `<div class="vf-iss-portrait">${this.tradingPostPortraitHtml(faction, variant)}</div>` +
            `<div class="vf-iss-trader-meta">` +
            `<div class="vf-iss-trader-title">${String(post.name || 'TRADER').toUpperCase()}</div>` +
            `<div class="vf-iss-trader-sub">${factionLabel} · ${catMeta.label} BAY</div>` +
            `<div class="vf-iss-trader-cash">${credits}c ON HAND</div>` +
            `</div></div>` +
            `<button type="button" class="vf-iss-close" id="hsUndock" data-nav-item tabindex="-1">UNDOCK [ESC]</button>` +
            `</header>` +
            this.renderTradingPostWallet(profile) +
            `<div class="hs-tps-cats vf-iss-note">${this.renderTradingPostCategoryTabs()}</div>` +
            `<div class="vf-iss-note vf-iss-hint">${this.renderTradingPostCatHint(cat)}</div>` +
            `<div class="vf-iss-body">` +
            `<div class="vf-iss-main">` +
            `<section class="vf-iss-col vf-iss-stock hs-tps-stock is-cat-${cat}">` +
            `<h3 class="vf-iss-col-title">STOCK · ${catMeta.label}</h3>` +
            this.renderTradingPostStock(profile, cat) +
            `</section>` +
            (cat === 'portals'
                ? this.renderTradingPostPortalInventory(profile)
                : this.renderTradingPostBags(profile)) +
            `</div>` +
            this.renderTradingPostDetailShell() +
            `</div>` +
            `</div>`;
    },

    renderTradingPostCatHint(cat) {
        if (cat === 'portals') {
            return 'CLICK stock to BUY · portal goes to INVENTORY · install in STATION → TRAVEL';
        }
        return 'CLICK stock to buy · bag cells drag between SHIP / STATION';
    },

    tradingPostPortraitVariant(post) {
        const seed = String((post && post.id) || 'post');
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
        return Math.abs(hash) % 16;
    },

    tradingPostPortraitHtml(faction, variant) {
        if (typeof voxelPortrait !== 'undefined' && voxelPortrait.canvasHtml) {
            return voxelPortrait.canvasHtml({ faction: faction, v: variant }, null, { state: 0 });
        }
        return `<canvas class="vf-iss-face-fallback" width="96" height="96" aria-hidden="true"></canvas>`;
    },

    /** Paint trader faction colours onto the docked shop root (same as victory shop). */
    applyTradingPostTheme(root) {
        if (!root) return;
        const id = String(root.getAttribute('data-faction') || 'terran').toLowerCase();
        root.dataset.faction = id;
        let style = null;
        if (typeof factionShipStyles !== 'undefined') {
            if (factionShipStyles.getFactionStyle) style = factionShipStyles.getFactionStyle(id);
            else if (factionShipStyles.getDefaultFactionStyle) style = factionShipStyles.getDefaultFactionStyle(id);
        }
        const hull = (style && style.hull) || '#3A6EA5';
        const edge = (style && style.edge) || '#1a2a3a';
        const accent = (style && style.accent)
            || (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor
                ? factionShipStyles.getFactionColor(id) : null)
            || '#7ec8ff';
        const set = (k, v) => {
            root.style.setProperty(k, v);
            const panel = root.querySelector('.vf-iss-panel');
            if (panel) panel.style.setProperty(k, v);
        };
        set('--faction-hull', hull);
        set('--faction-edge', edge);
        set('--faction-accent', accent);
        set('--color-primary', accent);
        set('--color-secondary', hull);
        set('--color-border', edge);
        set('--iss-accent', accent);
        set('--iss-hull', hull);
        set('--iss-edge', edge);
    },

    renderTradingPostWallet(profile) {
        const map = (profile && profile.resources) || {};
        const ids = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds.slice()
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const chip = (id, amount, iconId) => {
            const n = Math.max(0, Math.round(Number(amount) || 0));
            const label = id === 'credits'
                ? 'CREDITS'
                : ((typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel)
                    ? economyConfig.getResourceLabel(id)
                    : String(id).toUpperCase());
            return `<span class="vf-iss-wallet-item${n <= 0 ? ' is-empty' : ''}" data-wallet="${id}">` +
                `<span class="vf-iss-wallet-ico">${this.iconHtml(this.resourceIconKey(iconId || id), 20)}</span>` +
                `<span class="vf-iss-wallet-meta"><span>${label}</span><b>${n}</b></span>` +
                `</span>`;
        };
        return `<div class="vf-iss-wallet" aria-label="Resources">` +
            chip('credits', credits, 'credits') +
            ids.map((id) => chip(id, map[id] || 0, id)).join('') +
            `</div>`;
    },

    renderTradingPostCategoryTabs() {
        return this.getAvailableShopCategories().map((id) => {
            const meta = this._shopCatMeta[id] || { label: id.toUpperCase(), icon: 'hsShop' };
            const active = this.shopCategory === id;
            return `<button type="button" class="hs-shop-cat hs-tps-cat is-cat-${id}${active ? ' active' : ''}" data-shop-cat="${id}" data-nav-item>` +
                `<span class="hs-chip-icon">${this.iconHtml(meta.icon, 24, 'hs-pixel')}</span>` +
                `<span>${meta.label}</span></button>`;
        }).join('');
    },

    tradingPostSlotLayout() {
        if (this._tpsFitCellPx) {
            return {
                cell: Math.max(this.TPS_CELL_MIN_PX, Math.min(this.TPS_CELL_MAX_PX, this._tpsFitCellPx | 0)),
                gap: this.TPS_GAP_PX
            };
        }
        let cell = this.TPS_CELL_PX;
        const host = document.getElementById('vf-trading-post-shop')
            || document.getElementById('vf-in-stage-shop');
        const hostW = (host && host.clientWidth) || 0;
        const hostH = (host && host.clientHeight) || 0;
        if (hostW > 0) {
            const usableW = Math.max(320, Math.floor(hostW * 0.58));
            const usableH = Math.max(240, Math.floor(hostH * 0.62));
            const cols = ((this.tradingPostStockBag() || {}).cols || this.TPS_STOCK_COLS) * 2;
            const rows = 3 + 3;
            const gap = this.TPS_GAP_PX;
            const fromW = Math.floor((usableW - gap * (cols - 1) - 12) / cols);
            const fromH = Math.floor((usableH - gap * (rows - 1) - 72) / rows);
            cell = Math.max(
                this.TPS_CELL_MIN_PX,
                Math.min(this.TPS_CELL_MAX_PX, Math.min(fromW, fromH))
            );
        }
        return { cell: cell, gap: this.TPS_GAP_PX };
    },

    applyTradingPostCellSize(host, cs) {
        if (!host) return;
        const gap = this.TPS_GAP_PX;
        host.querySelectorAll(
            '.vf-iss-stock-grid, .vf-iss-inv-grid, .vf-iss-station-grid, .vf-iss-queued-grid, ' +
            '.vf-iss-ship-inv .hs-storage-grid, .vf-iss-station-inv .hs-storage-grid, ' +
            '.hs-tps-stock .hs-storage-grid, .hs-tps .hs-storage-grid'
        ).forEach((g) => {
            const cols = Math.max(1, parseInt(g.getAttribute('data-inv-cols'), 10) || 1);
            const rows = Math.max(1, parseInt(g.getAttribute('data-inv-rows'), 10) || 1);
            g.style.setProperty('--cs', cs + 'px');
            g.style.setProperty('--hs-gap', gap + 'px');
            g.style.gridTemplateColumns = `repeat(${cols}, ${cs}px)`;
            g.style.gridTemplateRows = `repeat(${rows}, ${cs}px)`;
            g.style.width = (cols * cs + (cols - 1) * gap) + 'px';
            g.style.height = (rows * cs + (rows - 1) * gap) + 'px';
        });
        host.querySelectorAll('.vf-iss-ship-inv, .vf-iss-station-inv').forEach((bag) => {
            bag.style.maxHeight = 'none';
            bag.style.overflow = 'visible';
        });
    },

    measureTradingPostFitCellPx(host) {
        const main = host && host.querySelector('.vf-iss-main');
        if (!main) return this.TPS_CELL_PX;
        const availW = main.clientWidth;
        const availH = main.clientHeight;
        if (availW < 80 || availH < 80) return this.TPS_CELL_PX;

        const bags = host.querySelectorAll('.vf-iss-ship-inv, .vf-iss-station-inv');
        const prevOverflow = main.style.overflow;
        main.style.overflow = 'hidden';
        bags.forEach((bag) => {
            bag.style.maxHeight = 'none';
            bag.style.overflow = 'visible';
        });

        let lo = this.TPS_CELL_MIN_PX;
        let hi = this.TPS_CELL_MAX_PX;
        let best = lo;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            this.applyTradingPostCellSize(host, mid);
            void main.offsetHeight;
            const fits = main.scrollHeight <= availH + 2 && main.scrollWidth <= availW + 2
                && ![...bags].some((bag) => bag.scrollHeight > bag.clientHeight + 2);
            if (fits) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        this.applyTradingPostCellSize(host, best);
        main.style.overflow = prevOverflow;
        return best;
    },

    fitTradingPostBagsToSpace(host) {
        if (!host || this._tpsFittingLock) return;
        const best = this.measureTradingPostFitCellPx(host);
        if (!best) return;
        if (this._tpsFitCellPx && Math.abs(this._tpsFitCellPx - best) <= 1) {
            this.applyTradingPostCellSize(host, this._tpsFitCellPx);
            return;
        }
        this._tpsFitCellPx = best;
        this._tpsFittingLock = true;
        try {
            this.mountTradingPostModal();
        } finally {
            this._tpsFittingLock = false;
        }
    },

    withTradingPostSlotSize(fn) {
        const layout = this.tradingPostSlotLayout();
        const prev = this.STORAGE_CELL_PX;
        const prevGap = this.STORAGE_GAP_PX;
        this.STORAGE_CELL_PX = layout.cell;
        this.STORAGE_GAP_PX = layout.gap;
        try {
            return { layout, html: fn(layout) };
        } finally {
            this.STORAGE_CELL_PX = prev;
            this.STORAGE_GAP_PX = prevGap;
        }
    },

    tradingPostGridShell(cols, rows, cs, gap, extraClass, innerHtml) {
        return `<div class="hs-storage-grid ${extraClass || ''}" data-inv-cols="${cols}" data-inv-rows="${rows}" ` +
            `style="--cs:${cs}px;--hs-gap:${gap}px;grid-auto-flow:row dense;` +
            `grid-template-columns:repeat(${cols},${cs}px);` +
            `grid-template-rows:repeat(${rows},${cs}px);` +
            `width:calc(${cols}*${cs}px + ${cols - 1}*${gap}px);` +
            `height:calc(${rows}*${cs}px + ${rows - 1}*${gap}px)">` +
            innerHtml +
            `</div>`;
    },

    padTradingPostCells(cells, cols, rows) {
        const pad = Math.max(0, cols * rows - cells.length);
        for (let i = 0; i < pad; i++) {
            cells.push(`<span class="hs-storage-cell hs-storage-cell-empty" aria-hidden="true"></span>`);
        }
        return cells;
    },

    /** Compact cost label for a stock cell (credits preferred). */
    tradingPostCostLabel(cost) {
        if (!cost) return '0c';
        const credits = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (credits > 0) return credits + 'c';
        const ids = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        for (let i = 0; i < ids.length; i++) {
            const n = Math.max(0, Math.round(Number(cost[ids[i]]) || 0));
            if (n > 0) return n + ' ' + String(ids[i]).slice(0, 3).toUpperCase();
        }
        return '0c';
    },

    tradingPostStockVisual(kind, id, cs, color, span) {
        const sw = Math.max(1, (span && span[0]) || 1);
        const sh = Math.max(1, (span && span[1]) || 1);
        const boxW = Math.max(28, sw * (cs | 0) - 6);
        const boxH = Math.max(28, sh * (cs | 0) - 6);
        const box = Math.min(boxW, boxH);
        if (kind === 'ship') {
            const src = this.shipThumbSrc ? this.shipThumbSrc(id, Math.max(24, Math.floor(box * 0.85))) : '';
            if (src) {
                return `<img class="hs-tps-ship-thumb" src="${src}" width="${box}" height="${box}" alt="" draggable="false">`;
            }
            return this.iconHtml('hsShip', Math.floor(box * 0.55), 'vf-iss-icon', null, color);
        }
        if (kind === 'resource') {
            return `<span class="hs-storage-cell-icon">${this.iconHtml(this.resourceIconKey(id), Math.floor(box * 0.5), 'vf-iss-icon')}</span>`;
        }
        if (kind === 'portal') {
            const galaxyIcon = id === 'andromeda' ? 'galaxyAndromeda'
                : (id === 'milky_way' ? 'galaxyMilkyWay' : 'galaxyDefault');
            return `<span class="hs-storage-cell-icon">${this.iconHtml(galaxyIcon, Math.floor(box * 0.5), 'vf-iss-icon')}</span>`;
        }
        if (kind === 'style') {
            return `<span class="hs-tps-style-thumb"><canvas width="48" height="36" ${id}></canvas></span>`;
        }
        let inner = '';
        const physKind = (kind === 'weapon' || kind === 'defense' || kind === 'energy' || kind === 'ability')
            ? kind
            : 'ability';
        if (physKind === 'weapon' && typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
            inner = `<span class="hs-storage-cell-icon">${iconRenderer.weaponImgHtml(id, Math.max(18, Math.floor(box * 0.42)), 'vf-iss-icon', false)}</span>`;
        }
        if (typeof physicalItem !== 'undefined' && physicalItem.wrap) {
            return physicalItem.wrap(physKind, id, boxW, boxH, color, inner);
        }
        return inner || this.iconHtml('hsShop', Math.floor(box * 0.55), 'vf-iss-icon', null, color);
    },

    /** Returns { html, span } so packShopStockGrid can place multi-slot parts. */
    tradingPostStockCell(opts) {
        const cs = opts.cs || this.TPS_CELL_PX;
        const accent = opts.accent || '#c08cff';
        const afford = opts.afford !== false;
        const owned = !!opts.owned;
        const span = opts.span || [1, 1];
        const tag = opts.tag
            ? `<span class="vf-iss-stock-tag${opts.temp ? ' is-temp' : ''}">${opts.tag}</span>`
            : '';
        const cost = opts.costLabel
            ? `<span class="vf-iss-stock-cost">${opts.costLabel}</span>`
            : '';
        const tip = String(opts.tip || '').replace(/"/g, '&quot;');
        const head = String(opts.head || 'ITEM').replace(/"/g, '&quot;');
        const buyAttr = opts.buyAttr || '';
        const kind = opts.kind ? String(opts.kind) : '';
        const id = opts.id != null ? String(opts.id) : '';
        const kindAttr = kind ? ` data-tps-kind="${kind.replace(/"/g, '')}"` : '';
        const idAttr = id ? ` data-tps-id="${id.replace(/"/g, '')}"` : '';
        const extraAttr = (opts.extraAttr || '') + kindAttr + idAttr;
        const disabled = owned || (!afford && opts.lockUnaffordable);
        const cls = [
            'hs-storage-cell', 'vf-iss-stock-cell', 'hs-tps-cell',
            opts.cellClass || '',
            afford || owned ? '' : 'is-locked',
            owned ? 'is-owned' : ''
        ].filter(Boolean).join(' ');
        const visual = opts.visual != null
            ? opts.visual
            : this.tradingPostStockVisual(kind, id, cs, accent, span);
        let html;
        if (owned && !opts.buyAttr) {
            html = `<div class="${cls}" style="__SPAN__--pk-c:${accent}" data-ui-tip-compact data-ui-tip-head="${head}" data-ui-tip="${tip}" ${extraAttr}>` +
                visual + tag + cost + `</div>`;
        } else {
            html = `<button type="button" class="${cls}" ${buyAttr} data-nav-item tabindex="-1" style="__SPAN__--pk-c:${accent}" ` +
                `data-ui-tip-compact data-ui-tip-head="${head}" data-ui-tip="${tip}" ${extraAttr}` +
                `${disabled ? ' disabled' : ''} aria-label="${head}">` +
                visual + tag + cost +
                `</button>`;
        }
        return { html, span };
    },

    renderTradingPostStock(profile, cat) {
        if (cat === 'parts') return this.renderTradingPostPartsGrid(profile);
        if (cat === 'ships') return this.renderTradingPostShipsGrid(profile);
        if (cat === 'blueprints') return this.renderTradingPostBlueprintsGrid(profile);
        if (cat === 'resources') return this.renderTradingPostResourcesGrid(profile);
        if (cat === 'portals') return this.renderTradingPostPortalsGrid(profile);
        if (cat === 'styles') return this.renderTradingPostStylesGrid(profile);
        return this.emptyHtml('hsShop', 'EMPTY');
    },

    renderTradingPostPartsGrid(profile) {
        const wallet = profile.resources || {};
        const layout = this.tradingPostSlotLayout();
        const cs = layout.cell;
        const gap = layout.gap;
        const bag = this.tradingPostStockBag();
        const cols = bag.cols;
        let entries = this.catalogPartListings().map((entry) => {
            const cost = (typeof economyConfig !== 'undefined')
                ? economyConfig.getPartCost(entry.kind, entry.item)
                : { scrap: 100 };
            const count = (typeof profileManager !== 'undefined')
                ? profileManager.getPartCount(entry.kind, entry.id, profile)
                : 0;
            let accent = '#c08cff';
            if (entry.kind === 'weapon') {
                accent = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
                    ? (weaponConfigManager.getWeaponUiColor(entry.id) || '#ff6a4a')
                    : '#ff6a4a';
            } else if (this._storageBucketColor) {
                const bucket = entry.kind === 'defense' ? 'defenses'
                    : (entry.kind === 'energy' ? 'energy' : 'abilities');
                accent = this._storageBucketColor(bucket);
            }
            return {
                kind: entry.kind,
                id: entry.id,
                name: entry.name,
                cost: cost,
                costTotal: this.costTotal(cost),
                count: count,
                afford: this.canAffordCost(wallet, cost, profile),
                accent: accent,
                tip: (this.hangarModuleTip ? this.hangarModuleTip(entry.kind, entry.id) : entry.name)
                    + '\n' + this.tradingPostCostLabel(cost)
            };
        });
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.kind === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        const specs = entries.map((e) => {
            const span = this.shopPartSpan ? this.shopPartSpan(e.kind, e.id) : [1, 1];
            return this.tradingPostStockCell({
                cs: cs,
                accent: e.accent,
                afford: e.afford,
                lockUnaffordable: true,
                kind: e.kind,
                id: e.id,
                span: span,
                tag: e.count > 0 ? 'OWN' : e.kind.slice(0, 3).toUpperCase(),
                costLabel: this.tradingPostCostLabel(e.cost),
                head: e.name,
                tip: e.tip,
                buyAttr: `data-buy-part="${e.kind}:${e.id}"`,
                cellClass: `is-part is-kind-${e.kind}`,
                visual: this.tradingPostStockVisual(e.kind, e.id, cs, e.accent, span)
            });
        });
        return this.packShopStockGrid(specs, cols, bag.minRows, cs, gap, 'vf-iss-stock-grid hs-tps-parts-grid');
    },

    renderTradingPostShipsGrid(profile) {
        const wallet = profile.resources || {};
        const layout = this.tradingPostSlotLayout();
        const cs = Math.max(layout.cell, 48);
        const gap = layout.gap;
        const cols = 4;
        let entries = this.catalogShipIds().map((id) => {
            const cfg = (typeof shipConfigManager !== 'undefined')
                ? shipConfigManager.getConfig(id)
                : null;
            const cost = (typeof economyConfig !== 'undefined')
                ? economyConfig.getShopCost(cfg)
                : { scrap: 120 };
            const owned = profile.ownedShipIds.indexOf(id) !== -1;
            return {
                id: id,
                name: this.shipName(id),
                modelClass: this.shipModelClass(id, cfg),
                tier: (cfg && cfg.tier != null) ? Number(cfg.tier) : 1,
                cost: cost,
                costTotal: this.costTotal(cost),
                owned: owned,
                afford: !owned && this.canAffordCost(wallet, cost, profile),
                accent: '#f2c14e'
            };
        });
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.modelClass === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        const rows = Math.max(2, Math.ceil(Math.max(entries.length, 1) / cols));
        const cells = this.padTradingPostCells(entries.map((e) => this.tradingPostStockCell({
            cs: cs,
            accent: e.accent,
            afford: e.afford,
            owned: e.owned,
            lockUnaffordable: true,
            kind: 'ship',
            id: e.id,
            tag: e.owned ? 'OWNED' : ('T' + e.tier),
            costLabel: e.owned ? '' : this.tradingPostCostLabel(e.cost),
            head: e.name,
            tip: e.name + '\n' + this.shipClassLabel(e.modelClass) + '\n' + this.tradingPostCostLabel(e.cost),
            buyAttr: e.owned ? '' : `data-buy="${e.id}"`,
            cellClass: 'is-ship',
            visual: this.tradingPostStockVisual('ship', e.id, cs, e.accent)
        }).html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;')), cols, rows);
        return this.tradingPostGridShell(cols, rows, cs, gap, 'vf-iss-stock-grid hs-tps-ships-grid', cells.join(''));
    },

    renderTradingPostBlueprintsGrid(profile) {
        const wallet = profile.resources || {};
        const layout = this.tradingPostSlotLayout();
        const cs = layout.cell;
        const gap = layout.gap;
        const bag = this.tradingPostStockBag();
        const cols = bag.cols;
        let entries = this.catalogPartListings().map((e) => {
            const key = e.kind + ':' + e.id;
            if (!profileManager.parseBlueprintKey(key)) return null;
            const cost = economyConfig.getBlueprintCost(e.kind, e.item);
            return {
                key: key,
                kind: e.kind,
                id: e.id,
                name: profileManager.getBlueprintName(key),
                cost: cost,
                costTotal: this.costTotal(cost),
                count: profile.blueprints[key] || 0,
                afford: this.canAffordCost(wallet, cost, profile),
                accent: '#7ec8ff'
            };
        }).filter(Boolean);
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.kind === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        const specs = entries.map((e) => {
            const span = this.shopPartSpan ? this.shopPartSpan(e.kind, e.id) : [1, 1];
            return this.tradingPostStockCell({
                cs: cs,
                accent: e.accent,
                afford: e.afford,
                lockUnaffordable: true,
                kind: e.kind,
                id: e.id,
                span: span,
                tag: 'BP',
                temp: true,
                costLabel: this.tradingPostCostLabel(e.cost),
                head: 'BP: ' + e.name,
                tip: 'BLUEPRINT\n' + e.name + '\n' + this.tradingPostCostLabel(e.cost),
                buyAttr: `data-buy-bp="${e.key}"`,
                cellClass: 'is-blueprint',
                visual: this.tradingPostStockVisual(e.kind, e.id, cs, e.accent, span)
            });
        });
        return this.packShopStockGrid(specs, cols, bag.minRows, cs, gap, 'vf-iss-stock-grid hs-tps-bp-grid');
    },

    renderTradingPostResourcesGrid(profile) {
        const bag = this.shopFilter === 'cargo' ? 'cargo' : 'station';
        const qtyMode = this.shopResourceQty || 1;
        const bagMap = bag === 'cargo'
            ? ((profile.cargo && profile.cargo.resources) || {})
            : (profile.resources || {});
        const layout = this.tradingPostSlotLayout();
        const cs = Math.max(layout.cell, 48);
        const gap = layout.gap;
        const cols = 4;
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const accentMap = {
            scrap: '#c8a060',
            ore: '#8ab0d0',
            crystal: '#5ad0ff',
            voltex: '#c08cff'
        };
        const cells = ids.map((id) => {
            const tradeable = (typeof economyConfig !== 'undefined')
                ? economyConfig.isResourceTradeable(id)
                : true;
            const stock = Math.max(0, Math.round(Number(bagMap[id]) || 0));
            let buyQty = tradeable ? this.resolveResourceTradeQty(profile, id, bag, 'buy') : 0;
            if (qtyMode !== 'all') buyQty = Math.max(1, buyQty);
            const buyCost = tradeable && buyQty > 0 && typeof economyConfig !== 'undefined'
                ? economyConfig.getResourceBuyCost(id, buyQty)
                : null;
            const afford = buyCost ? this.canAffordCredits(buyCost, profile) : false;
            const name = (typeof economyConfig !== 'undefined')
                ? economyConfig.getResourceLabel(id)
                : String(id).toUpperCase();
            const accent = accentMap[id] || '#7ec8ff';
            return this.tradingPostStockCell({
                cs: cs,
                accent: accent,
                afford: afford,
                lockUnaffordable: true,
                kind: 'resource',
                id: id,
                tag: '×' + stock,
                costLabel: buyCost ? this.tradingPostCostLabel(buyCost) : '—',
                head: name,
                tip: name + '\nSTOCK ' + stock + '\n' + (buyCost ? this.tradingPostCostLabel(buyCost) : 'LOCKED'),
                buyAttr: buyCost ? `data-buy-res="${id}"` : '',
                cellClass: `is-resource is-res-${id}`,
                visual: this.tradingPostStockVisual('resource', id, cs, accent),
                owned: !buyCost
            }).html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;');
        });
        // Sell buttons row under resources — keep existing sell handlers.
        const sellRow = ids.map((id) => {
            const tradeable = (typeof economyConfig !== 'undefined')
                ? economyConfig.isResourceTradeable(id)
                : true;
            const stock = Math.max(0, Math.round(Number(bagMap[id]) || 0));
            let sellQty = tradeable ? this.resolveResourceTradeQty(profile, id, bag, 'sell') : 0;
            if (qtyMode !== 'all') sellQty = Math.max(1, sellQty);
            const canSell = stock >= 1 && sellQty > 0;
            const sellPay = tradeable && sellQty > 0 && typeof economyConfig !== 'undefined'
                ? economyConfig.getResourceSellPayout(id, sellQty)
                : null;
            return `<button type="button" class="hs-tps-res-sell" data-sell-res="${id}" data-nav-item ${canSell ? '' : 'disabled'}>` +
                `SELL ${String(id).slice(0, 3).toUpperCase()}` +
                (sellPay ? ` +${sellPay.credits || 0}c` : '') +
                `</button>`;
        }).join('');
        const rows = 1;
        return `<div class="hs-tps-res-block">` +
            this.tradingPostGridShell(cols, rows, cs, gap, 'vf-iss-stock-grid hs-tps-res-grid', cells.join('')) +
            `<div class="hs-tps-res-sells">${sellRow}</div>` +
            `<div class="hs-tps-toolbar-mini">${this.renderShopToolbar()}</div>` +
            `</div>`;
    },

    renderTradingPostPortalsGrid(profile) {
        const wallet = profile.resources || {};
        const layout = this.tradingPostSlotLayout();
        const cs = Math.max(layout.cell, 48);
        const gap = layout.gap;
        const cols = 4;
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
            const installed = (typeof profileManager !== 'undefined')
                ? profileManager.ownsPortal(gid, profile)
                : false;
            const inInv = (typeof profileManager !== 'undefined' && profileManager.hasPortalInInventory)
                ? profileManager.hasPortalInInventory(gid, profile)
                : false;
            return {
                id: gid,
                name: String((g && g.name) || gid).replace(/_/g, ' ').toUpperCase(),
                faction: factionId,
                cost: cost,
                costTotal: this.costTotal(cost),
                owned: installed || inInv,
                installed: installed,
                inInv: inInv,
                afford: !installed && !inInv && this.canAffordCost(wallet, cost, profile),
                accent: '#a78bfa'
            };
        }).filter(Boolean);
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.faction === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        const rows = Math.max(2, Math.ceil(Math.max(entries.length, 1) / cols));
        const cells = this.padTradingPostCells(entries.map((e) => this.tradingPostStockCell({
            cs: cs,
            accent: e.accent,
            afford: e.afford,
            owned: e.owned,
            lockUnaffordable: true,
            kind: 'portal',
            id: e.id,
            tag: e.installed ? 'INSTALLED' : (e.inInv ? 'IN BAG' : 'PORTAL'),
            costLabel: e.owned ? '' : this.tradingPostCostLabel(e.cost),
            head: 'PORTAL: ' + e.name,
            tip: e.name +
                '\nPORTAL MODULE' +
                '\nBuy → inventory · install in STATION → TRAVEL' +
                (e.installed ? '\nINSTALLED ON STATION'
                    : (e.inInv ? '\nIN INVENTORY — OPEN TRAVEL TO INSTALL'
                        : ('\n' + this.tradingPostCostLabel(e.cost)))),
            buyAttr: e.owned ? '' : `data-buy-portal="${e.id}"`,
            cellClass: 'is-portal',
            visual: this.tradingPostStockVisual('portal', e.id, cs, e.accent)
        }).html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;')), cols, rows);
        return this.tradingPostGridShell(cols, rows, cs, gap, 'vf-iss-stock-grid hs-tps-portal-grid', cells.join(''));
    },

    /** Bought portals waiting in inventory (install happens in STATION → TRAVEL). */
    renderTradingPostPortalInventory(profile) {
        const layout = this.tradingPostSlotLayout();
        const cs = Math.max(layout.cell, 48);
        const gap = layout.gap;
        const cols = 4;
        const invIds = (typeof profileManager !== 'undefined' && profileManager.getPortalInventory)
            ? profileManager.getPortalInventory(profile)
            : ((profile && profile.homeStation && profile.homeStation.portalInventory) || []);
        const cells = invIds.map((gid) => {
            const id = String(gid || '').toLowerCase();
            const g = (typeof planetConfigManager !== 'undefined')
                ? planetConfigManager.getGalaxy(id)
                : null;
            const name = String((g && g.name) || id).replace(/_/g, ' ').toUpperCase();
            return this.tradingPostStockCell({
                cs: cs,
                accent: '#a78bfa',
                afford: true,
                owned: true,
                lockUnaffordable: false,
                kind: 'portal',
                id: id,
                tag: 'IN BAG',
                costLabel: '',
                head: 'PORTAL: ' + name,
                tip: name +
                    '\nPORTAL MODULE' +
                    '\nIn inventory · install in STATION → TRAVEL',
                buyAttr: '',
                cellClass: 'is-portal is-inventory',
                visual: this.tradingPostStockVisual('portal', id, cs, '#a78bfa')
            }).html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;');
        });
        const rows = Math.max(2, Math.ceil(Math.max(cells.length, 1) / cols));
        const grid = this.tradingPostGridShell(
            cols,
            rows,
            cs,
            gap,
            'vf-iss-stock-grid hs-tps-portal-grid hs-tps-portal-inv',
            this.padTradingPostCells(cells, cols, rows).join('')
        );
        return `<div class="vf-iss-bags hs-tps-portal-bay">` +
            `<section class="vf-iss-col vf-iss-station">` +
            `<h3 class="vf-iss-col-title">INVENTORY · PORTALS</h3>` +
            (cells.length
                ? grid
                : `<div class="vf-iss-note vf-iss-hint">No portal modules yet. Buy from STOCK, then install in STATION → TRAVEL.</div>`) +
            `</section>` +
            `</div>`;
    },

    renderTradingPostStylesGrid(profile) {
        if (typeof profileManager === 'undefined' || !profileManager.getStyleGroups) {
            return this.emptyHtml('hsShop', 'NO STYLES');
        }
        const wallet = profile.resources || {};
        const layout = this.tradingPostSlotLayout();
        const cs = Math.max(layout.cell, 52);
        const gap = layout.gap;
        const cols = 5;
        const groups = profileManager.getStyleGroups()
            .filter((g) => this.shopFilter === 'all' || this.shopFilter === g.id);
        const entries = [];
        groups.forEach((g) => {
            const all = profileManager.getStyleGroupEntries(g.id);
            all.forEach((style, index) => {
                const cost = profileManager.getStyleCost(index);
                if (!cost) return;
                entries.push({
                    groupId: g.id,
                    groupLabel: g.label,
                    style: style,
                    cost: cost,
                    owned: profileManager.isStyleUnlocked(g.id, style.id, profile),
                    afford: this.canAffordCost(wallet, cost, profile),
                    accent: '#ff8ab8',
                    thumbAttrs: this.styleShopThumbAttrs(g.id, style.id)
                });
            });
        });
        if (this.shopSort === 'cost') {
            entries.sort((a, b) => this.costTotal(a.cost) - this.costTotal(b.cost));
        } else if (this.shopSort === 'name') {
            entries.sort((a, b) => a.style.label.localeCompare(b.style.label));
        }
        const rows = Math.max(2, Math.ceil(Math.max(entries.length, 1) / cols));
        const cells = this.padTradingPostCells(entries.map((e) => {
            const key = `${e.groupId}|${e.style.id}`;
            return this.tradingPostStockCell({
                cs: cs,
                accent: e.accent,
                afford: e.afford || e.owned,
                owned: e.owned,
                lockUnaffordable: false,
                tag: e.owned ? 'OWNED' : 'STYLE',
                costLabel: e.owned ? '' : this.tradingPostCostLabel(e.cost),
                head: e.style.label,
                tip: e.style.label + '\n' + e.groupLabel + '\n' + this.tradingPostCostLabel(e.cost),
                buyAttr: e.owned ? '' : `data-buy-style="${key}"`,
                extraAttr: e.owned ? '' : (e.afford ? '' : 'data-short="1"'),
                cellClass: 'is-style',
                visual: this.tradingPostStockVisual('style', e.thumbAttrs, cs, e.accent)
            }).html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;');
        }), cols, rows);
        return this.tradingPostGridShell(cols, rows, cs, gap, 'vf-iss-stock-grid hs-tps-style-grid', cells.join(''));
    },

    renderTradingPostBags(profile) {
        return `<div class="vf-iss-bags">` +
            `<section class="vf-iss-col vf-iss-ship">` +
            `<h3 class="vf-iss-col-title">SHIP</h3>` +
            `<div class="vf-iss-ship-inv hs-slot-picker hs-tps-ship-inv">${this.renderTradingPostShipBag(profile)}</div>` +
            `</section>` +
            `<section class="vf-iss-col vf-iss-station">` +
            `<h3 class="vf-iss-col-title">STATION</h3>` +
            `<div class="vf-iss-station-inv hs-slot-picker hs-tps-station-inv">${this.renderTradingPostStationBag(profile)}</div>` +
            `</section>` +
            `</div>`;
    },

    renderTradingPostShipBag(profile) {
        const shipId = profile && profile.activeShipId;
        if (!profile || !shipId || !this.renderShipStorage) {
            return this.tradingPostEmptyBag('SHIP EMPTY');
        }
        const bagCols = this.tradingPostStockBag().cols;
        const { html } = this.withTradingPostSlotSize(() => this.renderShipStorage(profile, shipId, {
            tipAction: false,
            extraGridClass: 'vf-iss-inv-grid',
            compactSpans: false,
            maxCols: bagCols
        }));
        return html || this.tradingPostEmptyBag('SHIP EMPTY');
    },

    renderTradingPostStationBag(profile) {
        if (!profile || !this.renderStationStorage) {
            return this.tradingPostEmptyBag('STATION EMPTY');
        }
        const bagCols = this.tradingPostStockBag().cols;
        const { html } = this.withTradingPostSlotSize(() => this.renderStationStorage(profile, {
            tipAction: false,
            compactSpans: false,
            maxCols: bagCols
        }));
        if (!html) return this.tradingPostEmptyBag('STATION EMPTY');
        return String(html).replace(
            'class="hs-storage-grid',
            'class="hs-storage-grid vf-iss-station-grid'
        );
    },

    tradingPostEmptyBag(label) {
        const layout = this.tradingPostSlotLayout();
        const cols = this.tradingPostStockBag().cols;
        const rows = 2;
        const cells = [];
        for (let i = 0; i < cols * rows; i++) {
            cells.push(`<span class="hs-storage-cell hs-storage-cell-empty" aria-hidden="true"></span>`);
        }
        return `<div class="vf-iss-empty-bag" data-empty-label="${label}">` +
            this.tradingPostGridShell(cols, rows, layout.cell, layout.gap, 'vf-iss-station-grid', cells.join('')) +
            `</div>`;
    },

    renderTradingPostDetailShell() {
        return `<aside class="vf-iss-detail hs-tps-detail" id="hs-tps-detail" aria-live="polite">` +
            `<h3 class="vf-iss-col-title">DETAIL</h3>` +
            `<div class="vf-iss-detail-body">` +
            `<div class="vf-iss-detail-empty">HOVER AN ITEM</div>` +
            `<div class="vf-iss-detail-hint">Stats and cost show here.</div>` +
            `</div></aside>`;
    },

    /** Large preview icon for the DETAIL pane (clone cell art or rebuild). */
    tradingPostDetailVisual(cell) {
        if (!cell) return '';
        const previewCs = 64;
        const accent = cell.style.getPropertyValue('--pk-c') || '#7ec8ff';
        const kind = cell.getAttribute('data-tps-kind') || cell.getAttribute('data-part-kind') || '';
        const id = cell.getAttribute('data-tps-id') || cell.getAttribute('data-part-id') || '';
        if (kind && id) {
            return this.tradingPostStockVisual(kind, id, previewCs, accent);
        }
        const body = cell.querySelector('.hs-item-body');
        if (body) return body.outerHTML;
        const thumb = cell.querySelector('.hs-tps-ship-thumb, .hs-tps-style-thumb, .hs-storage-cell-icon');
        if (thumb) return thumb.outerHTML;
        const img = cell.querySelector('img.vf-iss-icon, img');
        return img ? img.outerHTML : '';
    },

    bindTradingPostDetailHover(root) {
        if (!root) return;
        root._tpsDetailBound = true;
        const body = () => root.querySelector('#hs-tps-detail .vf-iss-detail-body');
        const show = (payload) => {
            const el = body();
            if (!el) return;
            if (!payload) {
                el.innerHTML = `<div class="vf-iss-detail-empty">HOVER AN ITEM</div>` +
                    `<div class="vf-iss-detail-hint">Stats and cost show here.</div>`;
                return;
            }
            const previewCs = 64;
            const title = String(payload.title || 'ITEM').replace(/</g, '&lt;');
            const tag = payload.tag
                ? `<span class="vf-iss-detail-badge${payload.temp ? ' is-temp' : ''}">${payload.tag}</span>`
                : '';
            const cost = payload.cost
                ? `<div class="vf-iss-detail-price">${payload.cost}</div>`
                : '';
            const lines = (payload.lines || []).map((line, i) => {
                const text = String(line || '');
                const cls = i === 0 ? ' is-tag'
                    : (/\d/.test(text) && /(c|SCR|ORE|CRY|VOL)/i.test(text) ? ' is-cost' : '');
                const body = (typeof this.formatDetailStatLineHtml === 'function')
                    ? this.formatDetailStatLineHtml(text)
                    : text.replace(/</g, '&lt;');
                return `<div class="vf-iss-detail-line${cls}">${body}</div>`;
            }).join('');
            const visual = payload.visualHtml || '';
            el.innerHTML =
                `<div class="vf-iss-detail-hero">` +
                (visual
                    ? `<div class="vf-iss-detail-preview" style="--cs:${previewCs}px">${visual}</div>`
                    : '') +
                `<div class="vf-iss-detail-meta">` +
                `<div class="vf-iss-detail-name">${title}</div>` +
                tag + cost +
                `</div></div>` +
                `<div class="vf-iss-detail-stats">${lines}</div>`;
        };
        root.addEventListener('mousemove', (e) => {
            const cell = e.target.closest && e.target.closest('.hs-tps-cell, .hs-storage-cell[data-drag-key]');
            if (!cell) return;
            const head = cell.getAttribute('data-ui-tip-head') || 'ITEM';
            const tip = String(cell.getAttribute('data-ui-tip') || '');
            const lines = tip.split('\n').filter(Boolean);
            const costLine = lines.find((l) => /\d/.test(l) && /(c|SCR|ORE|CRY|VOL)/i.test(l));
            show({
                title: head,
                tag: cell.classList.contains('is-owned') ? 'OWNED'
                    : (cell.classList.contains('is-blueprint') ? 'BLUEPRINT'
                        : (cell.classList.contains('is-ship') ? 'SHIP'
                            : (cell.classList.contains('is-portal') ? 'PORTAL'
                                : (cell.classList.contains('is-style') ? 'STYLE'
                                    : (cell.classList.contains('is-resource') ? 'RESOURCE' : 'STOCK'))))),
                temp: cell.classList.contains('is-blueprint'),
                cost: costLine || null,
                lines: lines,
                visualHtml: this.tradingPostDetailVisual(cell)
            });
        });
    },

});
