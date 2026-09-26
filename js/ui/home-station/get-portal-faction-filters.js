"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
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
    },

    renderShopToolbar() {
        const isParts = this.shopCategory === 'parts';
        const isPortals = this.shopCategory === 'portals';
        const isResources = this.shopCategory === 'resources';
        const isStyles = this.shopCategory === 'styles';
        const filters = isStyles ? this.getStyleShopFilters() : isResources
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
            this.renderShopModeToggle() +
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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },
});
