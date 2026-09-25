"use strict";

// EconomyConfig methods, split from economy-config.js.
extendClass(EconomyConfig, {
    computeStationStats(levels) {
        const lv = levels || {};
        const stats = Object.assign({}, this.stationBaseStats, {
            impulseDrive: 0,
            warpDrive: 0,
            exploreBudget: 1
        });
        this.stationUpgradeOrder.forEach((id) => {
            const node = this.stationUpgradeNodes[id];
            if (!node || typeof node.effect !== 'function') return;
            const n = Math.max(0, Math.min(node.maxLevel, Math.round(Number(lv[id]) || 0)));
            if (n <= 0) return;
            const bonus = node.effect(n) || {};
            Object.keys(bonus).forEach((k) => {
                stats[k] = (stats[k] || 0) + (bonus[k] || 0);
            });
        });
        stats.resourceCap = Math.max(1, Math.round(stats.resourceCap));
        stats.cargoCap = Math.max(1, Math.round(stats.cargoCap));
        stats.shipSlots = Math.max(1, Math.round(stats.shipSlots));
        stats.craftDiscount = Math.max(0, Math.min(0.7, Number(stats.craftDiscount) || 0));
        stats.dropBonus = Math.max(0, Math.min(0.4, Number(stats.dropBonus) || 0));
        stats.impulseDrive = Math.max(0, Math.round(stats.impulseDrive || 0));
        stats.warpDrive = Math.max(0, Math.round(stats.warpDrive || 0));
        stats.exploreBudget = Math.max(1, Math.round(this.getExploreBudget(lv)));
        return stats;
    },

    getResourceLabel(id) {
        return this.resourceLabels[id] || String(id || '').toUpperCase();
    },

    getResourceColor(id) {
        const key = String(id || '').toLowerCase();
        return this.resourceColors[key] || '#b8b0a0';
    },

    getResourceIconKey(id) {
        const key = String(id || '').toLowerCase();
        return this.resourceIconKeys[key] || 'resScrap';
    },

    resourceIdFromIconKey(iconKey) {
        const k = String(iconKey || '');
        const entry = Object.keys(this.resourceIconKeys || {}).find((id) => this.resourceIconKeys[id] === k);
        return entry || null;
    },

    getVictoryLootGraceMs() {
        const n = Number(this.victoryLootGraceMs);
        return Math.max(3000, isFinite(n) ? n : 10000);
    },

    getResourceTradeValue(id) {
        const key = String(id || '').toLowerCase();
        const v = this.resourceTradeValue[key];
        return v != null ? v : 1;
    },

    isResourceTradeable(id) {
        const key = String(id || '').toLowerCase();
        return key && this.resourceIds.indexOf(key) !== -1;
    },

    /** Credits cost to buy `amount` units of a material resource. */
    getResourceBuyCost(id, amount) {
        const key = String(id || '').toLowerCase();
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (!this.isResourceTradeable(key) || n <= 0) return null;
        const unit = this.getResourceTradeValue(key) * this.resourceBuyMult;
        return { credits: Math.max(1, Math.ceil(unit * n)) };
    },

    /** Credits payout for selling `amount` units of a material resource. */
    getResourceSellPayout(id, amount) {
        const key = String(id || '').toLowerCase();
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (!this.isResourceTradeable(key) || n <= 0) return null;
        const unit = this.getResourceTradeValue(key) * this.resourceSellMult;
        return { credits: Math.max(1, Math.floor(unit * n)) };
    },

    /**
     * Convert a material cost map into an uncapped CREDITS price.
     */
    materialCostToCredits(costMap) {
        let total = 0;
        Object.keys(costMap || {}).forEach((id) => {
            const n = Math.max(0, Math.round(Number(costMap[id]) || 0));
            if (n <= 0) return;
            if (id === 'credits') {
                total += n;
                return;
            }
            total += n * this.getResourceTradeValue(id);
        });
        return Math.max(1, Math.ceil(total));
    },

    /**
     * Material breakdown for a ship (used by craft). Scrap is a real resource here.
     */
    getShopMaterialCost(shipConfig) {
        const cost = Math.max(0, Math.round(Number((shipConfig && shipConfig.cost) || 0)));
        if (cost <= 0) {
            return { scrap: 120 };
        }
        if (cost <= 50) {
            return {
                scrap: Math.ceil(cost * 4),
                ore: Math.ceil(cost * 2)
            };
        }
        if (cost <= 75) {
            return {
                scrap: Math.ceil(cost * 3.2),
                ore: Math.ceil(cost * 2.5),
                crystal: Math.ceil(cost * 1.2)
            };
        }
        return {
            scrap: Math.ceil(cost * 2.8),
            ore: Math.ceil(cost * 2.2),
            crystal: Math.ceil(cost * 1.6),
            voltex: Math.max(40, Math.ceil(cost * 0.6))
        };
    },

    /**
     * Shop buy price in CREDITS (money). Materials stay for craft/upgrades.
     */
    getShopCost(shipConfig) {
        return { credits: this.materialCostToCredits(this.getShopMaterialCost(shipConfig)) };
    },

    /** Craft costs materials (scrap/ore/…), more than shop credit value implies. */
    getCraftCost(shipConfig) {
        const shop = this.getShopMaterialCost(shipConfig);
        const craft = {};
        Object.keys(shop).forEach((id) => {
            craft[id] = Math.ceil(shop[id] * 1.5);
        });
        if (!craft.scrap) craft.scrap = 80;
        return craft;
    },

    /** Blueprint listing — CREDITS, cheaper than the finished ship. */
    getBlueprintCost(shipConfig) {
        const mat = this.getShopMaterialCost(shipConfig);
        const bpMat = {};
        Object.keys(mat).forEach((id) => {
            bpMat[id] = Math.max(20, Math.ceil(mat[id] * 0.45));
        });
        if (!bpMat.scrap) bpMat.scrap = 60;
        return { credits: this.materialCostToCredits(bpMat) };
    },

    /**
     * Part shop price in CREDITS.
     * kind: 'weapon' | 'defense' | 'ability' | 'energy'
     */
    getPartMaterialCost(kind, item) {
        if (kind === 'weapon') {
            const dmg = Math.max(1, Number((item && item.damage) || 10));
            const cd = Math.max(50, Number((item && item.cooldown) || 300));
            const score = Math.round(dmg * 2 + (400 / cd) * 8);
            if (score <= 20) return { scrap: 85, ore: 35 };
            if (score <= 35) return { scrap: 140, ore: 55, crystal: 25 };
            return { scrap: 200, ore: 80, crystal: 45, voltex: 20 };
        }
        const tier = Math.max(0, Math.round(Number((item && item.tier) || 1)));
        if (kind === 'energy') {
            if (tier <= 1) return { scrap: 95, ore: 40, crystal: 15 };
            if (tier <= 2) return { scrap: 150, ore: 60, crystal: 35 };
            return { scrap: 210, ore: 85, crystal: 50, voltex: 25 };
        }
        if (kind === 'ability') {
            if (tier <= 1) return { scrap: 110, ore: 45 };
            if (tier <= 2) return { scrap: 170, ore: 70, crystal: 40 };
            return { scrap: 240, ore: 95, crystal: 55, voltex: 30 };
        }
        if (tier <= 1) return { scrap: 100, ore: 40 };
        if (tier <= 2) return { scrap: 160, ore: 65, crystal: 35 };
        return { scrap: 220, ore: 85, crystal: 50, voltex: 25 };
    },

    getPartCost(kind, item) {
        return { credits: this.materialCostToCredits(this.getPartMaterialCost(kind, item)) };
    },

    getBlueprintDropChance(info) {
        if (!info) return this.blueprintDropChance.default;
        if (info.champion) return this.blueprintDropChance.champion;
        const cls = String(info.enemyClass || '').toLowerCase();
        if (this.blueprintDropChance[cls] != null) return this.blueprintDropChance[cls];
        return this.blueprintDropChance.default;
    },

    pickBlueprintShipId(excludeOwned) {
        const exclude = new Set(Array.isArray(excludeOwned) ? excludeOwned : []);
        exclude.add(this.starterShipId);
        let pool = [];
        if (typeof shipConfigManager !== 'undefined') {
            pool = shipConfigManager.getTypeIds().filter((id) => {
                if (exclude.has(id)) return false;
                if (id === this.starterShipId) return false;
                const cfg = shipConfigManager.getConfig(id);
                return cfg && !cfg.custom;
            });
        }
        if (!pool.length) {
            pool = ['player', 'player_interceptor', 'player_assault', 'player_heavy'].filter((id) => !exclude.has(id));
        }
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    rollAmount(min, max) {
        const a = Math.max(0, Math.round(Number(min) || 0));
        const b = Math.max(a, Math.round(Number(max) || a));
        return a + Math.floor(Math.random() * (b - a + 1));
    },

    rollPlanetResources(resourceTable) {
        const table = Array.isArray(resourceTable) ? resourceTable : [];
        const granted = {};
        table.forEach((entry) => {
            const id = String((entry && entry.id) || '').toLowerCase();
            if (!id || this.resourceIds.indexOf(id) === -1) return;
            const amount = this.rollAmount(entry.min, entry.max);
            if (amount > 0) {
                granted[id] = (granted[id] || 0) + amount;
            }
        });
        return granted;
    },

    getPlanetResourceTable(planetId) {
        const pid = String(planetId || '').toLowerCase();
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(pid);
            if (cfg && Array.isArray(cfg.resources) && cfg.resources.length) {
                return cfg.resources;
            }
        }
        return this.defaultPlanetResources[pid] || this.defaultPlanetResources.mars || [
            { id: 'scrap', weight: 4, min: 1, max: 3 },
            { id: 'ore', weight: 2, min: 1, max: 2 }
        ];
    },

    getEnemyDropScale(info) {
        if (!info) return this.enemyDropScale.default;
        if (info.champion) return this.enemyDropScale.champion;
        const cls = String(info.enemyClass || '').toLowerCase();
        if (this.enemyDropScale[cls] != null) return this.enemyDropScale[cls];
        return this.enemyDropScale.default;
    },
});
