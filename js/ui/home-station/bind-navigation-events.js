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
    },
});
