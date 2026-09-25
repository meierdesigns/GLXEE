"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
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
    },

    openResourceBuyModal(opts) {
        const o = opts || {};
        this._resBuyModal = {
            title: String(o.title || 'NEED RESOURCES'),
            cost: Object.assign({}, o.cost || {}),
            action: o.action || null
        };
        this.focusIndex = 0;
        this.createUI();
    },

    closeResourceBuyModal() {
        this._resBuyModal = null;
        this.focusIndex = 0;
        this.createUI();
    },

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
    },

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
    },

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
    },

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
    },

    shipModelClass(id, cfg) {
        if (cfg && cfg.modelClass) return String(cfg.modelClass).toLowerCase();
        if (typeof shipConfigManager !== 'undefined' && shipConfigManager.modelClassById) {
            return String(shipConfigManager.modelClassById[id] || '').toLowerCase();
        }
        return '';
    },

    shipClassLabel(modelClass) {
        const map = {
            starfighter: 'STARFIGHTER',
            interceptor: 'INTERCEPTOR',
            heavy_fighter: 'HEAVY',
            assault: 'ASSAULT'
        };
        return map[modelClass] || String(modelClass || 'SHIP').toUpperCase();
    },

    resetShopControlsIfNeeded(prevCategory) {
        if (!prevCategory || prevCategory === this.shopCategory) return;
        this.captureShopPrefs(prevCategory);
        this.applyShopPrefsForCategory(this.shopCategory);
    },

    getShopFaction(profile) {
        if (typeof profileManager !== 'undefined' && profileManager.getShopFaction) {
            return profileManager.getShopFaction(profile || this.getProfile());
        }
        return 'terran';
    },
});
