"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Empty list placeholder: big pixel icon over a short message. */
    emptyHtml(iconKey, text) {
        return `<div class="hs-empty-slot hs-empty-state"><span class="hs-empty-ico">${this.iconHtml(iconKey, 64, 'hs-pixel', false)}</span>` +
            `<span class="hs-empty-txt">${text}</span></div>`;
    },

    renderPartsList(profile) {
        const weapons = Object.keys((profile.parts && profile.parts.weapons) || {})
            .filter((id) => (profile.parts.weapons[id] || 0) > 0);
        const defenses = Object.keys((profile.parts && profile.parts.defenses) || {})
            .filter((id) => (profile.parts.defenses[id] || 0) > 0);
        const abilities = Object.keys((profile.parts && profile.parts.abilities) || {})
            .filter((id) => (profile.parts.abilities[id] || 0) > 0);
        if (!weapons.length && !defenses.length && !abilities.length) {
            return this.emptyHtml('statAbilities', 'NO PARTS YET');
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
    },

    renderShopCategoryTabs() {
        return this.getAvailableShopCategories().map((id) => {
            const meta = this._shopCatMeta[id] || { label: id.toUpperCase() };
            const active = this.shopCategory === id;
            return `<button type="button" class="hs-shop-cat ${active ? 'active' : ''}" data-shop-cat="${id}" data-nav-item>` +
                `<span class="hs-chip-icon">${this.iconHtml(meta.icon, 32, 'hs-pixel')}</span>` +
                `<span>${meta.label}</span></button>`;
        }).join('');
    },

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
    },

    catalogPartListings() {
        const post = this.getVisitedTradingPost();
        if (post) {
            return profileManager.getTradingPostStock(post).map((e) => ({
                kind: e.kind,
                id: e.id,
                name: String((e.item && e.item.name) || e.id).toUpperCase(),
                item: e.item,
                faction: e.faction
            }));
        }
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
    },

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
            return this.emptyHtml('hsShip', 'NO SHIPS MATCH FILTER');
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
                `<span class="hs-line-meta">${this.shipClassLabel(e.modelClass)} · T${e.tier} · ${this.factionTagHtml(this.shipFaction(e.id))}</span>` +
                `</span></span>` +
                `${this.renderCostGrid(e.cost, wallet, profile)}${action}</div>`;
        }).join('');
    },

    renderShopBlueprintRows(profile) {
        let entries = this.catalogPartListings().map((e) => {
            const key = e.kind + ':' + e.id;
            const cost = economyConfig.getBlueprintCost(e.kind, e.item);
            return {
                key: key,
                kind: e.kind,
                id: e.id,
                name: profileManager.getBlueprintName(key),
                faction: e.faction || (e.item && e.item.faction),
                cost: cost,
                costTotal: this.costTotal(cost),
                count: profile.blueprints[key] || 0
            };
        }).filter((e) => profileManager.parseBlueprintKey(e.key));
        if (this.shopFilter && this.shopFilter !== 'all') {
            entries = entries.filter((e) => e.kind === this.shopFilter);
        }
        entries = this.sortShopEntries(entries);
        if (!entries.length) {
            return this.emptyHtml('hsBlueprint', 'NO BLUEPRINTS MATCH FILTER');
        }
        const wallet = profile.resources || {};
        return entries.map((e) => {
            const stock = e.count > 0 ? ` ×${e.count}` : '';
            const afford = this.canAffordCost(wallet, e.cost, profile);
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.moduleIconHtml(e.kind, e.id, 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>BP: ${e.name}${stock}</strong>` +
                `<span class="hs-line-meta">${e.kind.toUpperCase()} · ${this.factionTagHtml(e.faction)}</span>` +
                `</span></span>` +
                `${this.renderCostGrid(e.cost, wallet, profile)}` +
                `<button class="action-button hs-line-action" data-buy-bp="${e.key}" ${afford ? '' : 'disabled'}>BUY</button></div>`;
        }).join('');
    },
});
