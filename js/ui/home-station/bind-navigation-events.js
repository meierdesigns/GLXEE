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

        this.overlay.querySelectorAll('[data-equip-select]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-equip-select') || '';
                this.expandedEquipItem = this.expandedEquipItem === key ? null : key;
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-item-track-up]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [bucket, id, track] = (btn.getAttribute('data-item-track-up') || '').split(':');
                const act = { type: 'item-track-upgrade', bucket: bucket, id: id, track: track };
                const meta = this._storageItemMeta(bucket, id);
                const trackMeta = (typeof economyConfig !== 'undefined' && economyConfig.itemUpgradeTrackDefs[bucket])
                    ? economyConfig.itemUpgradeTrackDefs[bucket][track]
                    : null;
                const title = meta.label + ' · ' + ((trackMeta && trackMeta.label) || track.toUpperCase());
                let res = profileManager.purchaseItemTrackUpgrade(bucket, id, track);
                if (!res.ok && res.reason === 'RESOURCES' && btn.hasAttribute('data-short')) {
                    const cost = res.cost;
                    res = this.buyMissingThenAct(cost, act);
                    if (res.ok) {
                        this.playButtonResult(btn, true, 'BOUGHT · UPGRADED: ' + track.toUpperCase() + ' L' + res.level);
                        this.createUI();
                        return;
                    }
                    this.playButtonResult(btn, false, res.reason === 'CREDITS'
                        ? ('NEED ' + (res.need || 0) + ' CR')
                        : (res.reason || 'BUY FAILED'));
                    this.openResourceBuyModal({ title: title, cost: cost, action: act });
                    return;
                }
                if (res.ok) {
                    this.playButtonResult(btn, true, 'UPGRADED: ' + track.toUpperCase() + ' L' + res.level);
                    this.createUI();
                } else if (res.reason === 'RESOURCES') {
                    this.openResourceBuyModal({
                        title: title + (res.nextLevel ? (' · L' + res.nextLevel) : ''),
                        cost: res.cost,
                        action: act
                    });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-item-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [bucket, id, mode] = (btn.getAttribute('data-item-mode') || '').split(':');
                const res = profileManager.setItemMode(bucket, id, mode);
                if (res.ok) {
                    this.playButtonResult(btn, true, 'MODE: ' + mode.toUpperCase());
                    this.createUI();
                } else {
                    this.playButtonResult(btn, false, res.reason || 'LOCKED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-item-tune-unlock]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [bucket, id] = (btn.getAttribute('data-item-tune-unlock') || '').split(':');
                const act = { type: 'item-tune-unlock', bucket: bucket, id: id };
                const title = this._storageItemMeta(bucket, id).label + ' · FINE TUNE';
                let res = profileManager.purchaseItemTuneUnlock(bucket, id);
                if (!res.ok && res.reason === 'RESOURCES' && btn.hasAttribute('data-short')) {
                    const cost = res.cost;
                    res = this.buyMissingThenAct(cost, act);
                    if (res.ok) {
                        this.playButtonResult(btn, true, 'BOUGHT · FINE TUNE UNLOCKED');
                        this.createUI();
                        return;
                    }
                    this.playButtonResult(btn, false, res.reason === 'CREDITS'
                        ? ('NEED ' + (res.need || 0) + ' CR')
                        : (res.reason || 'BUY FAILED'));
                    this.openResourceBuyModal({ title: title, cost: cost, action: act });
                    return;
                }
                if (res.ok) {
                    this.playButtonResult(btn, true, 'FINE TUNE UNLOCKED');
                    this.createUI();
                } else if (res.reason === 'RESOURCES') {
                    this.openResourceBuyModal({ title: title, cost: res.cost, action: act });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-item-tune]').forEach((input) => {
            input.addEventListener('change', () => {
                const [bucket, id] = (input.getAttribute('data-item-tune') || '').split(':');
                const res = profileManager.setItemTune(bucket, id, Number(input.value) / 100);
                if (!res.ok) {
                    this.playButtonResult(input, false, res.reason || 'LOCKED');
                    return;
                }
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-item-equip]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [shipId, kind, id] = (btn.getAttribute('data-item-equip') || '').split('|');
                const check = shipLoadoutManager.canInstallModule(shipId, kind, id);
                if (check.ok || check.removing) {
                    shipLoadoutManager.toggleModule(shipId, kind, id);
                } else if (check.reason === 'FULL') {
                    // Every slot of this kind is occupied: replace the first one
                    // (same behaviour as dragging a part onto an occupied hangar slot).
                    shipLoadoutManager.setSlotModule(shipId, kind, 0, id);
                } else {
                    this.playButtonResult(btn, false, check.reason || 'FAILED');
                    return;
                }
                this.playButtonResult(btn, true, 'EQUIPPED');
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-item-unequip]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [shipId, kind, id] = (btn.getAttribute('data-item-unequip') || '').split('|');
                shipLoadoutManager.toggleModule(shipId, kind, id);
                this.playButtonResult(btn, true, 'UNEQUIPPED');
                this.createUI();
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
                    this.statusMsg = 'TRAVELLED TO ' + name + factionTag + seeded;
                    this.createUI();
                } else if (res.reason === 'DRIVE') {
                    this.playButtonResult(btn, false, 'NEED WARP L' + (res.requireWarp || 1) + ' OR BUY PORTAL');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-install-portal]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-install-portal');
                const res = profileManager.installPortal
                    ? profileManager.installPortal(gid)
                    : { ok: false, reason: 'FAILED' };
                if (res.ok) {
                    const name = String(gid).replace(/_/g, ' ').toUpperCase();
                    this.statusMsg = 'PORTAL INSTALLED: ' + name;
                    this.createUI();
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
        // Set on the whole station box: tabs without a resource row (PLAY)
        // indent their first content row by the same amount.
        const root = header && header.closest('.home-station-content');
        if (!tabs || !root) return;
        const measure = () => {
            // Shift the whole tab row (PLAY button included) so its left edge
            // lines up with the first container below it.
            const body = header.nextElementSibling;
            const first = body && body.firstElementChild;
            const play = header.querySelector('[data-play-launch]') || tabs;
            if (first) {
                const zoom = window.vfEffectiveZoom ? window.vfEffectiveZoom(header) : 1;
                const cur = parseFloat(header.dataset.alignPad) || 0;
                const base = play.getBoundingClientRect().left - cur * zoom;
                const pad = Math.round((first.getBoundingClientRect().left - base) / zoom);
                // Hysteresis: ignore sub-2px differences so the row never jitters.
                if (Math.abs(pad) <= 30 && Math.abs(pad - cur) >= 2) {
                    header.dataset.alignPad = String(pad);
                    header.style.paddingLeft = pad + 'px';
                }
            }
            // Exclude the alignment padding itself, else offset and padding feed
            // each other and the row swings left/right while loading.
            const zoom2 = window.vfEffectiveZoom ? window.vfEffectiveZoom(header) : 1;
            const offset = (tabs.getBoundingClientRect().left - header.getBoundingClientRect().left) / zoom2 - (parseFloat(header.dataset.alignPad) || 0);
            root.style.setProperty('--hs-tabs-offset', Math.max(0, Math.round(offset)) + 'px');
        };
        measure();
        requestAnimationFrame(measure);
        // The content below builds up and the window / zoom can change after
        // this point: measure again so the row stays flush with it.
        // Re-measure only on a real window resize (debounced), never in a loop.
        if (!this._tabsAlignResizeBound) {
            this._tabsAlignResizeBound = true;
            let t = 0;
            window.addEventListener('resize', () => {
                clearTimeout(t);
                t = setTimeout(() => { const h = this.overlay && this.overlay.querySelector('.hs-header'); if (h) this.alignCreditsBarToTabs(); }, 200);
            });
        }
    },

    /**
     * Top-bar drag reorder removed — use MENU LAYOUT settings instead.
     * Stub kept so createUI callers stay stable.
     */
    bindTabOrderEditing() {},
});
