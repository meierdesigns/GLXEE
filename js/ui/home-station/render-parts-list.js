"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Empty list placeholder: big pixel icon over a short message. */
    emptyHtml(iconKey, text) {
        return `<div class="hs-empty-slot hs-empty-state"><span class="hs-empty-ico">${this.iconHtml(iconKey, 64, 'hs-pixel', false)}</span>` +
            `<span class="hs-empty-txt">${text}</span></div>`;
    },

    /** Border/accent color per bucket, same mapping the hangar bay-inventory grid uses. */
    _storageBucketColor(bucket) {
        const g = (k, d) => (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor && iconRenderer.getModuleKindColor(k)) || d;
        const kind = bucket === 'weapons' ? 'weapon' : bucket === 'defenses' ? 'defense' : bucket === 'energy' ? 'energy' : 'ability';
        const fallback = { weapon: '#ff6a4a', defense: '#4ac8ff', energy: '#ffd24a', ability: '#c08cff' }[kind];
        return g(kind, fallback);
    },

    /** Display name + icon + label prefix for one storage-bucket item (weapons/defenses/abilities/energy/blueprints).
     *  kind/physId identify the underlying part for the physical-item casing (physical-item.js). */
    _storageItemMeta(bucket, id) {
        if (bucket === 'blueprints') {
            const name = (typeof profileManager !== 'undefined') ? profileManager.getBlueprintName(id) : id;
            const bp = (typeof profileManager !== 'undefined') ? profileManager.parseBlueprintKey(id) : null;
            const kind = (bp && bp.kind) || 'weapon';
            return { icon: this.moduleIconHtml(kind, (bp && bp.id) || id, 32, 'hs-pixel'), label: 'BP ' + name, color: this._storageBucketColor('abilities'), kind, physId: (bp && bp.id) || id };
        }
        if (bucket === 'weapons') {
            const name = (typeof weaponConfigManager !== 'undefined')
                ? String(weaponConfigManager.getWeapon(id).name || id).toUpperCase() : id.toUpperCase();
            return { icon: this.iconHtml('statWeapon', 32, 'hs-pixel'), label: 'WPN ' + name, color: this._storageBucketColor(bucket), kind: 'weapon', physId: id };
        }
        if (bucket === 'defenses') {
            const name = (typeof abilityConfigManager !== 'undefined')
                ? String(abilityConfigManager.getDisplayName(id) || id).toUpperCase() : id.toUpperCase();
            return { icon: this.iconHtml('statArmor', 32, 'hs-pixel'), label: 'DEF ' + name, color: this._storageBucketColor(bucket), kind: 'defense', physId: id };
        }
        // abilities / energy
        const name = (typeof abilityConfigManager !== 'undefined')
            ? String(abilityConfigManager.getDisplayName(id) || id).toUpperCase() : id.toUpperCase();
        return { icon: this.iconHtml('statAbilities', 32, 'hs-pixel'), label: (bucket === 'energy' ? 'PWR ' : 'ABL ') + name, color: this._storageBucketColor(bucket), kind: bucket === 'energy' ? 'energy' : 'ability', physId: id };
    },

    /** Cost + affordability lines for a blueprint, for its storage-tile tooltip. */
    _blueprintCostLines(profile, key) {
        if (typeof profileManager === 'undefined' || !profileManager.getBlueprintCraftCost) return [];
        const cost = profileManager.getBlueprintCraftCost(key, profile);
        if (!cost) return [];
        const afford = this.canAffordCost(profile.resources, cost, profile);
        const costText = Object.keys(cost).map((k) => cost[k] + ' ' + k.toUpperCase()).join(' · ');
        return costText ? ['COST ' + costText, afford ? 'READY TO CRAFT' : 'NOT ENOUGH RESOURCES'] : [];
    },

    /** Dimmed placeholder cell for a bucket with no owned items in this view — shows the category icon, greyed out. */
    _storageCategoryPlaceholder(bucket) {
        const color = this._storageBucketColor(bucket);
        const kind = bucket === 'weapons' ? 'weapon' : bucket === 'defenses' ? 'defense' : bucket === 'energy' ? 'energy' : 'ability';
        // Reuse the physical-item generative casing (physical-item.js) for a detailed silhouette, darkened heavily via CSS.
        const body = (typeof physicalItem !== 'undefined') ? physicalItem.wrap(kind, 'placeholder', 40, 40, color, '') : '';
        const html = `<span class="hs-storage-cell is-empty" style="__SPAN__--pk-c:${color}" aria-hidden="true">${body}</span>`;
        return { html, span: [1, 1] };
    },

    /** Station resources as vertical fill-level chambers (replaces the flat chip row).
     *  The chamber grows with the station's resource-cap upgrade level, not just the fill amount. */
    renderResourceChambers(profile) {
        const ids = (typeof economyConfig !== 'undefined') ? economyConfig.resourceIds : Object.keys((profile && profile.resources) || {});
        const stats = (typeof profileManager !== 'undefined' && profile) ? profileManager.getStationStats(profile) : { resourceCap: 80 };
        const cap = Math.max(1, stats.resourceCap || 80);
        const baseCap = (typeof economyConfig !== 'undefined' && economyConfig.stationBaseStats && economyConfig.stationBaseStats.resourceCap) || 80;
        const upgradeScale = Math.max(1, cap / baseCap);
        const width = Math.round(Math.min(88, 55 * Math.min(1.5, Math.sqrt(upgradeScale))));
        const map = (profile && profile.resources) || {};
        const cells = ids.map((id) => {
            const n = map[id] || 0;
            const pct = Math.max(0, Math.min(100, Math.round(n / cap * 100)));
            const label = (typeof economyConfig !== 'undefined') ? economyConfig.getResourceLabel(id) : id.toUpperCase();
            const color = (typeof economyConfig !== 'undefined' && economyConfig.resourceColors && economyConfig.resourceColors[id]) || 'var(--color-primary)';
            const full = n >= cap ? ' is-full' : '';
            const empty = n <= 0 ? ' is-empty' : '';
            // Generative silo casing with the resource chunks piled up to the fill level baked in.
            const casing = (typeof physicalItem !== 'undefined') ? physicalItem.wrapChamber(id, 48, 140, color, pct) : '';
            return `<div class="hs-res-subcard${full}${empty}" style="--chamber-c:${color}" title="${label} ${n}/${cap}">` +
                `<span class="hs-res-chamber-tag">` +
                `<span class="hs-res-chamber-icon">${this.iconHtml(this.resourceIconKey(id), 24, 'hs-pixel')}</span>` +
                `<span class="hs-res-chamber-label">${label}</span>` +
                `</span>` +
                `<span class="hs-res-chamber-tube" style="--tube-w:${width}%">${casing}</span>` +
                `<span class="hs-res-chamber-value">${n}<span class="hs-res-chamber-cap">/${cap}</span></span>` +
                `</div>`;
        });
        return `<div class="hs-res-chambers">${cells.join('')}</div>`;
    },

    /** Every owned bucket/id pair with a positive count (profile.parts + profile.blueprints). */
    _allStorageEntries(profile) {
        const entries = [];
        ['weapons', 'defenses', 'abilities', 'energy'].forEach((bucket) => {
            const map = (profile.parts && profile.parts[bucket]) || {};
            Object.keys(map).forEach((id) => { if ((map[id] || 0) > 0) entries.push({ bucket, id }); });
        });
        const bpMap = profile.blueprints || {};
        Object.keys(bpMap).forEach((key) => {
            if ((bpMap[key] || 0) > 0 && profileManager.parseBlueprintKey(key)) entries.push({ bucket: 'blueprints', id: key });
        });
        return entries;
    },

    /** N dashed placeholder cells, same look as the hangar bay-inventory grid's empty slots. */
    _emptyStorageCells(count) {
        const cells = [];
        for (let i = 0; i < count; i++) cells.push(`<span class="hs-storage-cell hs-storage-cell-empty"></span>`);
        return cells.join('');
    },

    /** Grid footprint [w, h] in slots for a bucket/id item, same sizing the hangar bay-inventory grid uses. */
    _storageItemSpan(bucket, id) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        if (!slm || !slm.getPartSizeLevel || bucket === 'blueprints') return [1, 1];
        const kind = bucket === 'weapons' ? 'weapon' : bucket === 'defenses' ? 'defense' : bucket === 'energy' ? 'energy' : 'ability';
        const lv = Math.max(0, Math.min(2, slm.getPartSizeLevel(kind, id) | 0));
        return [[1, 1], [1, 2], [2, 2]][lv];
    },

    /** Grid shape (cols x rows) for a ship's storage — the same shape the hangar bay-inventory grid uses for that hull. */
    _storageGrid(shipId) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        return (slm && slm.getInventoryGrid ? slm.getInventoryGrid(shipId) : null) || { cols: 4, rows: 2 };
    },

    /** Station storage's own grid shape — always at least 10x4, independent of any ship, growing rows if it holds more than that. */
    STATION_STORAGE_COLS: 10,
    STATION_STORAGE_ROWS: 4,
    _stationStorageGrid(entryCount) {
        const cols = this.STATION_STORAGE_COLS;
        const rows = Math.max(this.STATION_STORAGE_ROWS, Math.ceil(entryCount / cols));
        return { cols, rows };
    },

    /** Item cells padded out to fill cols x rows with empty cells. Cell size (--cs) is pinned to the station storage grid's 10-column
     *  width so ship storage — a smaller grid in the same panel — uses the exact same slot size instead of stretching to fill its row. */
    _storageGridHtml(cellSpecs, grid) {
        const capacity = grid.cols * grid.rows;
        const used = cellSpecs.reduce((n, c) => n + c.span[0] * c.span[1], 0);
        const pad = Math.max(0, capacity - used);
        const baseCols = this.STATION_STORAGE_COLS;
        // cqw (not %) — the host row is a size container (part-07.css), so this stays the same
        // physical cell size whether it ends up sizing a column (width) or a row (height).
        const csExpr = `min(56px, calc((${100 / baseCols}cqw) - ${(baseCols - 1) * 4 / baseCols}px))`;
        const cells = cellSpecs.map((c) => c.html.replace('__SPAN__', `grid-column: span ${c.span[0]}; grid-row: span ${c.span[1]};`));
        return `<div class="hs-storage-grid" style="--cs: ${csExpr}; grid-auto-flow: row dense; grid-template-columns: repeat(${grid.cols}, var(--cs)); grid-template-rows: repeat(${grid.rows}, var(--cs)); width: calc(${grid.cols} * var(--cs) + ${grid.cols - 1} * 4px); height: calc(${grid.rows} * var(--cs) + ${grid.rows - 1} * 4px)">` +
            cells.join('') + this._emptyStorageCells(pad) + `</div>`;
    },

    /** Items not currently filed into any ship's storage or equipped — still sitting at the station, as a grid of icon tiles. */
    renderStationStorage(profile) {
        const entries = this._allStorageEntries(profile).filter((e) => profileManager.getStationStorageQty(profile, e.bucket, e.id) > 0);
        const activeShipId = profile.activeShipId;
        const cells = entries.map((e) => {
            const qty = profileManager.getStationStorageQty(profile, e.bucket, e.id);
            const meta = this._storageItemMeta(e.bucket, e.id);
            const span = this._storageItemSpan(e.bucket, e.id);
            const body = (typeof physicalItem !== 'undefined')
                ? physicalItem.wrap(meta.kind, meta.physId, span[0] * 48 - 8, span[1] * 48 - 8, meta.color, '') : '';
            const stats = String(this.hangarModuleTip(meta.kind, meta.physId) || '').split('\n').slice(1);
            if (e.bucket === 'weapons' && typeof shipLoadoutManager !== 'undefined' && activeShipId) {
                const L2 = shipLoadoutManager.getLoadout(activeShipId);
                stats.push('MODE ' + (L2 && L2.fireMode === 'charge' ? 'CHARGE' : 'AUTO'));
            }
            const isBp = e.bucket === 'blueprints';
            const action = isBp ? `data-craft="${e.id}"` : `data-move-to-ship="${e.bucket}:${e.id}" data-ship="${activeShipId}"`;
            const tip = (isBp ? stats.concat(this._blueprintCostLines(profile, e.id)).concat(['×' + qty])
                : stats.concat(['×' + qty, 'MOVE TO SHIP STORAGE'])).join('\n').replace(/"/g, '&quot;');
            const ariaLabel = isBp ? `Craft ${meta.label}` : `Move ${meta.label} to ship storage`;
            const html = `<button type="button" class="hs-storage-cell${isBp ? ' is-blueprint' : ''}" ${action} style="__SPAN__--pk-c:${meta.color}" ` +
                `data-ui-tip-instant data-ui-tip-compact data-ui-tip-head="${meta.label.replace(/"/g, '&quot;')}" ` +
                `data-ui-tip="${tip}" aria-label="${ariaLabel}">` +
                `${body}` +
                `${isBp ? '<span class="hs-storage-cell-bp-badge">BP</span>' : ''}` +
                `${qty > 1 ? `<span class="hs-storage-cell-qty">×${qty}</span>` : ''}` +
                `</button>`;
            return { html, span };
        });
        return this._storageGridHtml(cells, this._stationStorageGrid(cells.reduce((n, c) => n + c.span[0] * c.span[1], 0)));
    },

    /** Items filed into the given ship's storage, plus anything currently equipped on it, as a grid of icon tiles. */
    renderShipStorage(profile, shipId) {
        const grid = this._storageGrid(shipId);
        if (!shipId) return this._storageGridHtml([], grid);
        const entry = profileManager.getShipStorageEntry(profile, shipId);
        const entries = [];
        const seen = {};
        const addEntry = (bucket, id) => {
            const key = bucket + ':' + id;
            if (seen[key]) return;
            seen[key] = true;
            entries.push({ bucket, id });
        };
        this.profileManagerShipStorageBuckets().forEach((bucket) => {
            Object.keys(entry[bucket] || {}).forEach((id) => {
                if ((entry[bucket][id] || 0) > 0) addEntry(bucket, id);
            });
        });
        const L = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager.getLoadout(shipId) : null;
        if (L) {
            (L.weaponSlots || []).forEach((id) => { if (id) addEntry('weapons', id); });
            ['defenses', 'abilities', 'energy'].forEach((bucket) => {
                (L[bucket] || []).forEach((id) => addEntry(bucket, id));
            });
        }
        const present = new Set(entries.map((e) => e.bucket));
        const cells = entries.map((e) => {
            const qty = profileManager.getShipStorageQty(profile, shipId, e.bucket, e.id);
            const meta = this._storageItemMeta(e.bucket, e.id);
            const span = this._storageItemSpan(e.bucket, e.id);
            const body = (typeof physicalItem !== 'undefined')
                ? physicalItem.wrap(meta.kind, meta.physId, span[0] * 48 - 8, span[1] * 48 - 8, meta.color, '') : '';
            const stats = String(this.hangarModuleTip(meta.kind, meta.physId) || '').split('\n').slice(1);
            if (e.bucket === 'weapons' && typeof shipLoadoutManager !== 'undefined') {
                const L2 = shipLoadoutManager.getLoadout(shipId);
                stats.push('MODE ' + (L2 && L2.fireMode === 'charge' ? 'CHARGE' : 'AUTO'));
            }
            const isBp = e.bucket === 'blueprints';
            const action = isBp ? `data-craft="${e.id}"` : `data-move-to-station="${e.bucket}:${e.id}" data-ship="${shipId}"`;
            const tip = (isBp ? stats.concat(this._blueprintCostLines(profile, e.id)).concat(['×' + qty])
                : stats.concat(['×' + qty, 'MOVE TO STATION STORAGE'])).join('\n').replace(/"/g, '&quot;');
            const ariaLabel = isBp ? `Craft ${meta.label}` : `Move ${meta.label} to station storage`;
            const html = `<button type="button" class="hs-storage-cell${isBp ? ' is-blueprint' : ''}" ${action} style="__SPAN__--pk-c:${meta.color}" ` +
                `data-ui-tip-instant data-ui-tip-compact data-ui-tip-head="${meta.label.replace(/"/g, '&quot;')}" ` +
                `data-ui-tip="${tip}" aria-label="${ariaLabel}">` +
                `${body}` +
                `${isBp ? '<span class="hs-storage-cell-bp-badge">BP</span>' : ''}` +
                `${qty > 1 ? `<span class="hs-storage-cell-qty">×${qty}</span>` : ''}` +
                `</button>`;
            return { html, span };
        });
        ['weapons', 'defenses', 'abilities', 'energy'].forEach((bucket) => {
            if (!present.has(bucket)) cells.push(this._storageCategoryPlaceholder(bucket));
        });
        return this._storageGridHtml(cells, grid);
    },

    profileManagerShipStorageBuckets() {
        return (typeof profileManager !== 'undefined' && profileManager.SHIP_STORAGE_BUCKETS)
            ? profileManager.SHIP_STORAGE_BUCKETS
            : ['weapons', 'defenses', 'abilities', 'energy', 'blueprints'];
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
