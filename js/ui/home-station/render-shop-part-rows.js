"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
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
    },

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
    },

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
    },

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
    },

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
    },
});
