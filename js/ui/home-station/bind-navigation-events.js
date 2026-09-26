"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Menu, logout, tabs and explore buttons. */
    bindNavigationEvents() {
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
        this.bindTabOrderEditing();
        this.alignCreditsBarToTabs();

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
    },

    /** Shop filters, frame/module upgrades, galaxy travel and the resource market. */
    bindShopEvents() {
        this.bindTradingPostEvents();
        this.bindShopSellEvents();
        this.bindShopStyleEvents();
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
                this.persistTab();
                this._resBuyModal = null;
                this.statusMsg = '';
                this.focusIndex = 0;
                this._navLevel = 'sub';
                this.createUI();
            });
        });

        this.bindAreaUpgradeButtons();
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
    },

    /** Start the resource row under the first tab so the crest can hang beside it. */
    alignCreditsBarToTabs() {
        const header = this.overlay && this.overlay.querySelector('.hs-header');
        const tabs = header && header.querySelector('.hs-tabs');
        const bar = header && header.querySelector('.hs-credits-bar');
        if (!tabs || !bar) return;
        const measure = () => {
            const offset = tabs.getBoundingClientRect().left - header.getBoundingClientRect().left;
            header.style.setProperty('--hs-tabs-offset', Math.max(0, Math.round(offset)) + 'px');
        };
        measure();
        requestAnimationFrame(measure);
    },

    /**
     * Dev mode (Shift+C): drag tabs and '|' dividers within their row to
     * reorder them. Main row only: drag the "+ |" handle in to add a divider,
     * drag a divider out of the row to remove it.
     */
    bindTabOrderEditing() {
        if (typeof MENU_ORDER === 'undefined' || typeof startScreenManager === 'undefined' ||
            !startScreenManager.devMode) return;
        const row = this.overlay.querySelector('.hs-tabs');
        if (!row) return;
        const isEsc = this.isMenuRowTab();
        const list = isEsc ? MENU_ORDER.esc : MENU_ORDER.main;
        const NEW_DIVIDER = -2;
        // Main row items carry their MENU_ORDER.main index; ESC row items are found by id.
        const indexOf = (el) => isEsc
            ? list.indexOf(el.getAttribute('data-menu-tab'))
            : parseInt(el.getAttribute('data-order-index'), 10);
        const items = Array.from(row.querySelectorAll(isEsc ? '[data-menu-tab]' : '[data-order-index]'))
            .filter((el) => indexOf(el) >= 0);
        const commit = () => {
            saveMenuOrder();
            this.applyMenuOrder();
            this.createUI();
        };

        row.classList.add('hs-tabs-editing');
        // One bar shows where the dragged item will land (tabs are clip-pathed,
        // so it cannot be drawn on the tabs themselves).
        const marker = document.createElement('span');
        marker.className = 'hs-drop-marker';
        marker.setAttribute('aria-hidden', 'true');
        row.appendChild(marker);

        let dragFrom = -1;
        let dropAt = -1; // insertion index into list (before removal)
        const hideMarker = () => {
            marker.classList.remove('visible');
            dropAt = -1;
        };
        const showMarker = (el, after) => {
            const gap = 1;
            marker.style.left = (el.offsetLeft + (after ? el.offsetWidth + gap : -gap - 2)) + 'px';
            marker.style.top = el.offsetTop + 'px';
            marker.style.height = el.offsetHeight + 'px';
            marker.classList.add('visible');
        };
        const isNoop = (to) => dragFrom >= 0 && (to === dragFrom || to === dragFrom + 1);

        const startDrag = (el, from, e) => {
            dragFrom = from;
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', 'hs-tab'); } catch (err) { /* ignore */ }
            el.classList.add('hs-tab-dragging');
            row.classList.add('hs-tabs-dragging');
        };
        const endDrag = (el) => {
            dragFrom = -1;
            hideMarker();
            el.classList.remove('hs-tab-dragging');
            row.classList.remove('hs-tabs-dragging');
        };

        items.forEach((el) => {
            el.draggable = true;
            el.addEventListener('dragstart', (e) => startDrag(el, indexOf(el), e));
            el.addEventListener('dragend', (e) => {
                const from = dragFrom;
                endDrag(el);
                // A divider dropped outside the row is removed.
                if (!isEsc && from >= 0 && list[from] === '|' && e.dataTransfer.dropEffect === 'none') {
                    list.splice(from, 1);
                    commit();
                }
            });
        });

        // The whole row is the drop zone (gaps and row ends included): the
        // insertion point is the item edge closest to the pointer.
        const findDrop = (clientX) => {
            for (let k = 0; k < items.length; k++) {
                const rect = items[k].getBoundingClientRect();
                if (clientX < rect.left + rect.width / 2) return { el: items[k], after: false, to: indexOf(items[k]) };
            }
            const last = items[items.length - 1];
            return last ? { el: last, after: true, to: indexOf(last) + 1 } : null;
        };
        row.addEventListener('dragover', (e) => {
            if (dragFrom === -1) return;
            const hit = findDrop(e.clientX);
            if (!hit || isNoop(hit.to)) {
                hideMarker();
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = dragFrom === NEW_DIVIDER ? 'copy' : 'move';
            dropAt = hit.to;
            showMarker(hit.el, hit.after);
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const to = dropAt;
            const from = dragFrom;
            if (to < 0 || from === -1) return;
            if (from === NEW_DIVIDER) {
                list.splice(to, 0, '|');
            } else {
                const moved = list.splice(from, 1)[0];
                list.splice(from < to ? to - 1 : to, 0, moved);
            }
            commit();
        });
        row.addEventListener('dragleave', (e) => {
            if (!row.contains(e.relatedTarget)) hideMarker();
        });

        if (isEsc) return;
        const source = document.createElement('span');
        source.className = 'hs-divider-source';
        source.draggable = true;
        source.title = 'Drag into the row to add a divider';
        source.textContent = '+ |';
        source.addEventListener('dragstart', (e) => {
            startDrag(source, NEW_DIVIDER, e);
            e.dataTransfer.effectAllowed = 'copy';
        });
        source.addEventListener('dragend', () => endDrag(source));
        row.appendChild(source);
    },
});
