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

    /**
     * Parts never stack in the grid: each owned unit is `defId#unit` so it can sit
     * in its own cell and keep its own EQUIPMENT upgrades. Blueprints stay stacked.
     */
    _partInstanceParts(id) {
        const raw = String(id || '');
        const m = raw.match(/^(.*)#(\d+)$/);
        if (m) {
            return {
                defId: m[1],
                unit: Math.max(0, parseInt(m[2], 10) || 0),
                instanceId: raw
            };
        }
        return { defId: raw, unit: null, instanceId: raw };
    },

    _storageDefId(id) {
        return this._partInstanceParts(id).defId;
    },

    /** Expand a positive qty into one storage entry per unit (no ×N stacks). */
    _expandPartUnits(bucket, defId, qty) {
        const n = Math.max(0, Math.round(Number(qty) || 0));
        const out = [];
        for (let i = 0; i < n; i++) {
            out.push({ bucket: bucket, id: defId + '#' + i, defId: defId, unit: i });
        }
        return out;
    },

    /** Display name + icon + label prefix for one storage-bucket item (weapons/defenses/abilities/energy/blueprints).
     *  kind/physId identify the underlying part for the physical-item casing (physical-item.js). */
    _storageItemMeta(bucket, id) {
        const defId = this._storageDefId(id);
        if (bucket === 'blueprints') {
            const name = (typeof profileManager !== 'undefined') ? profileManager.getBlueprintName(defId) : defId;
            const bp = (typeof profileManager !== 'undefined') ? profileManager.parseBlueprintKey(defId) : null;
            const kind = (bp && bp.kind) || 'weapon';
            // Color by what the blueprint actually crafts (weapon/defense/ability/energy), not a
            // flat ability-purple for every blueprint regardless of its real type.
            const colorBucket = kind === 'weapon' ? 'weapons' : kind === 'defense' ? 'defenses' : kind === 'energy' ? 'energy' : 'abilities';
            return { icon: this.moduleIconHtml(kind, (bp && bp.id) || defId, 32, 'hs-pixel'), label: name, color: this._storageBucketColor(colorBucket), kind, physId: (bp && bp.id) || defId };
        }
        if (bucket === 'weapons') {
            const w = (typeof weaponConfigManager !== 'undefined') ? weaponConfigManager.getWeapon(defId) : null;
            const name = String((w && w.name) || defId).toUpperCase();
            return { icon: this.iconHtml('statWeapon', 32, 'hs-pixel'), label: 'WPN ' + name, color: this._storageBucketColor(bucket), kind: 'weapon', physId: defId };
        }
        if (bucket === 'defenses') {
            const name = (typeof abilityConfigManager !== 'undefined')
                ? String(abilityConfigManager.getDisplayName(defId) || defId).toUpperCase() : defId.toUpperCase();
            return { icon: this.iconHtml('statArmor', 32, 'hs-pixel'), label: 'DEF ' + name, color: this._storageBucketColor(bucket), kind: 'defense', physId: defId };
        }
        // abilities / energy
        const name = (typeof abilityConfigManager !== 'undefined')
            ? String(abilityConfigManager.getDisplayName(defId) || defId).toUpperCase() : defId.toUpperCase();
        return { icon: this.iconHtml('statAbilities', 32, 'hs-pixel'), label: (bucket === 'energy' ? 'PWR ' : 'ABL ') + name, color: this._storageBucketColor(bucket), kind: bucket === 'energy' ? 'energy' : 'ability', physId: defId };
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

    /** Station resources as vertical fill-level chambers (replaces the flat chip row).
     *  The chamber grows with the station's resource-cap upgrade level, not just the fill amount. */
    renderResourceChambers(profile) {
        const ids = (typeof economyConfig !== 'undefined') ? economyConfig.resourceIds : Object.keys((profile && profile.resources) || {});
        const stats = (typeof profileManager !== 'undefined' && profile) ? profileManager.getStationStats(profile) : { resourceCap: 80 };
        const cap = Math.max(1, stats.resourceCap || 80);
        const baseCap = (typeof economyConfig !== 'undefined' && economyConfig.stationBaseStats && economyConfig.stationBaseStats.resourceCap) || 80;
        const upgradeScale = Math.max(1, cap / baseCap);
        const width = Math.round(Math.min(95, 80 * Math.min(1.5, Math.sqrt(upgradeScale))));
        const map = (profile && profile.resources) || {};
        const cells = ids.map((id) => {
            const n = map[id] || 0;
            const pct = Math.max(0, Math.min(100, Math.round(n / cap * 100)));
            const label = (typeof economyConfig !== 'undefined') ? economyConfig.getResourceLabel(id) : id.toUpperCase();
            const color = (typeof economyConfig !== 'undefined' && economyConfig.resourceColors && economyConfig.resourceColors[id]) || 'var(--color-primary)';
            const full = n >= cap ? ' is-full' : '';
            const empty = n <= 0 ? ' is-empty' : '';
            // Default capacity Grenze at the top of the glass; lower only after store upgrades.
            const capMarkPct = Math.max(1, Math.min(100, Math.round((baseCap / cap) * 100)));
            // Generative silo casing with the resource chunks piled up to the fill level baked in.
            const casing = (typeof physicalItem !== 'undefined')
                ? physicalItem.wrapChamber(id, 48, 140, color, pct, capMarkPct)
                : '';
            return `<div class="hs-res-subcard${full}${empty}" style="--chamber-c:${color}" title="${label} ${n}/${cap}">` +
                `<span class="hs-res-chamber-tag">` +
                `<span class="hs-res-chamber-icon" aria-hidden="true">${this.iconHtml(this.resourceIconKey(id), 12, 'hs-pixel hs-pixel-12', false)}</span>` +
                `<span class="hs-res-chamber-label">${label}</span>` +
                `</span>` +
                `<span class="hs-res-chamber-tube" style="--tube-w:${width}%">${casing}</span>` +
                `<span class="hs-res-chamber-value">${n}<span class="hs-res-chamber-cap">/${cap}</span></span>` +
                `</div>`;
        });
        return `<div class="hs-res-chambers">${cells.join('')}</div>`;
    },

    /** Apply the player's manually-arranged drag order (ProfileManager.getStorageOrderList) to a
     *  bucket/id entry list for one storage grid — never auto-sorts, just replays past drags. */
    _orderStorageEntries(profile, scope, shipId, rawEntries) {
        if (typeof profileManager === 'undefined' || !profileManager.getStorageOrderList) return rawEntries;
        const byKey = {};
        rawEntries.forEach((e) => { byKey[e.bucket + ':' + e.id] = e; });
        const keys = rawEntries.map((e) => e.bucket + ':' + e.id);
        const order = profileManager.getStorageOrderList(profile, scope, shipId, keys);
        return order.map((k) => byKey[k]).filter(Boolean);
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
        if (!slm || !slm.getPartSizeLevel) return [1, 1];
        const defId = this._storageDefId(id);
        let kind, partId;
        if (bucket === 'blueprints') {
            const bp = (typeof profileManager !== 'undefined') ? profileManager.parseBlueprintKey(defId) : null;
            if (!bp) return [1, 1];
            kind = bp.kind;
            partId = bp.id;
        } else {
            kind = bucket === 'weapons' ? 'weapon' : bucket === 'defenses' ? 'defense' : bucket === 'energy' ? 'energy' : 'ability';
            partId = defId;
        }
        const lv = Math.max(0, Math.min(2, slm.getPartSizeLevel(kind, partId) | 0));
        return [[1, 1], [1, 2], [2, 2]][lv];
    },

    /** Grid shape (cols x rows) for a ship's storage — the same shape the hangar bay-inventory grid uses for that hull. */
    _storageGrid(shipId) {
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        return (slm && slm.getInventoryGrid ? slm.getInventoryGrid(shipId) : null) || { cols: 4, rows: 2 };
    },

    /** Max columns the station bay ever reaches — also the cell-size reference so ship storage matches. */
    STATION_STORAGE_COLS: 14,

    /** Profile-backed bay capacity (empty slots + filled). Fresh stations start small. */
    _stationStorageSlots(profile) {
        const stats = (typeof profileManager !== 'undefined' && profile)
            ? profileManager.getStationStats(profile)
            : null;
        const n = stats && stats.storageSlots != null ? stats.storageSlots : 12;
        return Math.max(8, Math.round(n) || 12);
    },

    /** How many bay cells station-filed items currently occupy (one cell set per part copy). */
    _stationStorageUsed(profile) {
        if (!profile || typeof profileManager === 'undefined') return 0;
        return this._allStorageEntries(profile).reduce((n, e) => {
            const qty = profileManager.getStationStorageQty(profile, e.bucket, e.id);
            if (qty <= 0) return n;
            const span = this._storageItemSpan(e.bucket, e.id);
            const cells = span[0] * span[1];
            return n + (e.bucket === 'blueprints' ? cells : cells * qty);
        }, 0);
    },

    /** Title suffix like "3/12" for the station bay panel. */
    stationStorageLabel(profile) {
        const used = this._stationStorageUsed(profile);
        const cap = this._stationStorageSlots(profile);
        return used + '/' + cap;
    },

    /** Turn a slot budget into a compact cols×rows bay (grows wider first, then taller). */
    _stationStorageGrid(profile, usedCells, opts) {
        const budget = Math.max(this._stationStorageSlots(profile), usedCells | 0);
        let cols;
        let rows;
        if (budget <= 12) { cols = 6; rows = 2; }
        else if (budget <= 16) { cols = 8; rows = 2; }
        else if (budget <= 20) { cols = 10; rows = 2; }
        else if (budget <= 28) { cols = 14; rows = 2; }
        else if (budget <= 42) { cols = 14; rows = 3; }
        else {
            cols = this.STATION_STORAGE_COLS;
            rows = Math.max(4, Math.ceil(budget / cols));
        }
        const maxCols = opts && opts.maxCols != null ? Math.max(1, opts.maxCols | 0) : 0;
        if (maxCols && cols > maxCols) {
            cols = maxCols;
            rows = Math.max(rows, Math.ceil(budget / cols));
        }
        // If items overfill the budget, grow rows so nothing is clipped.
        if (usedCells > cols * rows) rows = Math.ceil(usedCells / cols);
        return { cols, rows, slots: budget };
    },

    /** Shared square slot size for every station/ship storage bay (px, target before snap). */
    STORAGE_CELL_PX: 56,
    /** Slot divider target (px) — snapped with the cell so lines stay even under glass scale. */
    STORAGE_GAP_PX: 2,

    /** Effective glass zoom (home-station host uses transform:scale(z)). */
    _glassZoom() {
        try {
            const cs = getComputedStyle(document.documentElement);
            return parseFloat(cs.getPropertyValue('--gui-zoom-eff'))
                || parseFloat(cs.getPropertyValue('--gui-zoom'))
                || 0.75;
        } catch (e) {
            return 0.75;
        }
    },

    /**
     * Integer cell + gap near STORAGE_* targets such that gap·z and (cell+gap)·z land on
     * whole device pixels. Fractional scale otherwise makes every other divider 1px vs 2–3px.
     */
    _storageLayoutPx() {
        const z = this._glassZoom();
        const targetCell = this.STORAGE_CELL_PX;
        const targetGap = this.STORAGE_GAP_PX;
        let best = { cell: targetCell, gap: Math.max(2, targetGap), err: Infinity };
        for (let gap = 2; gap <= 6; gap++) {
            for (let cell = targetCell - 8; cell <= targetCell + 8; cell++) {
                if (cell < 40) continue;
                const step = cell + gap;
                const gapErr = Math.abs(gap * z - Math.round(gap * z));
                const stepErr = Math.abs(step * z - Math.round(step * z));
                // Step snap first: a half-pixel stride makes every other divider 1px vs 2–3px.
                const err = stepErr * 10 + gapErr * 5
                    + Math.abs(cell - targetCell) * 0.01
                    + Math.abs(gap - targetGap) * 0.05;
                if (err < best.err) best = { cell, gap, err };
            }
        }
        return { cell: best.cell, gap: best.gap };
    },

    /** Item cells padded out to fill cols x rows. Slot size is snapped for the current glass
     *  zoom so ship + station dividers stay equal under transform:scale.
     *  cellSpecs entries carry an optional `pos: [col, row]` (1-based) — the player's pinned
     *  tile for that item (bind-station-events.js _storageDragDrop). Pinned cells get an
     *  explicit grid-column/row so they stay exactly where dropped; everything else still
     *  auto-packs into the first free gap via `grid-auto-flow: dense`. A pin that collides
     *  with another pin (stale data after an item's footprint changed) is ignored for this
     *  render so the layout never overlaps — the item just falls back to auto-placement. */
    _storageGridHtml(cellSpecs, grid, targetAttrs, extraClass) {
        const capacity = grid.cols * grid.rows;
        const used = cellSpecs.reduce((n, c) => n + c.span[0] * c.span[1], 0);
        const pad = Math.max(0, capacity - used);
        const claimed = new Set();
        const claim = (col, row, w, h) => {
            const cells = [];
            for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) cells.push(c + ',' + r);
            if (col < 1 || row < 1 || col + w - 1 > grid.cols || row + h - 1 > grid.rows || cells.some((k) => claimed.has(k))) return false;
            cells.forEach((k) => claimed.add(k));
            return true;
        };
        const cells = cellSpecs.map((c) => {
            const [w, h] = c.span;
            const pinned = c.pos && claim(c.pos[0], c.pos[1], w, h);
            const place = pinned
                ? `grid-column: ${c.pos[0]} / span ${w}; grid-row: ${c.pos[1]} / span ${h};`
                : `grid-column: span ${w}; grid-row: span ${h};`;
            return c.html.replace('__SPAN__', place);
        });
        const layout = this._storageLayoutPx();
        const cs = layout.cell;
        const gap = layout.gap;
        return `<div class="hs-storage-grid${extraClass ? ' ' + extraClass : ''}" ${targetAttrs || ''} data-inv-cols="${grid.cols}" data-inv-rows="${grid.rows}" style="--cs:${cs}px; --hs-gap:${gap}px; grid-auto-flow: row dense; grid-template-columns: repeat(${grid.cols}, ${cs}px); grid-template-rows: repeat(${grid.rows}, ${cs}px); width: calc(${grid.cols} * ${cs}px + ${grid.cols - 1} * ${gap}px); height: calc(${grid.rows} * ${cs}px + ${grid.rows - 1} * ${gap}px)">` +
            cells.join('') + this._emptyStorageCells(pad) + `</div>`;
    },

    /** Items not currently filed into any ship's storage or equipped — still sitting at the station, as a grid of icon tiles.
     *  opts.selectKey: when set (EQUIPMENT tab), cells select for the detail panel instead of moving.
     *  Parts expand to one cell per owned unit (no stacks); blueprints stay qty-stacked. */
    renderStationStorage(profile, opts) {
        opts = opts || {};
        const selectMode = opts.selectKey !== undefined;
        const selectKey = opts.selectKey || null;
        const rawEntries = [];
        this._allStorageEntries(profile).forEach((e) => {
            const qty = profileManager.getStationStorageQty(profile, e.bucket, e.id);
            if (qty <= 0) return;
            if (e.bucket === 'blueprints') {
                rawEntries.push(e);
                return;
            }
            const layout = (profileManager.getPartInstanceLayout)
                ? profileManager.getPartInstanceLayout(profile, e.bucket, e.id)
                : null;
            const units = (layout && layout.station) || null;
            if (units && units.length) {
                units.forEach((unit) => {
                    rawEntries.push({ bucket: e.bucket, id: e.id + '#' + unit, defId: e.id, unit });
                });
                return;
            }
            this._expandPartUnits(e.bucket, e.id, qty).forEach((u) => rawEntries.push(u));
        });
        const entries = this._orderStorageEntries(profile, 'station', null, rawEntries);
        const posMap = profileManager.getStoragePosMap(profile, 'station', null);
        const activeShipId = profile.activeShipId;
        const compact = !!opts.compactSpans;
        const cells = entries.map((e) => {
            const defId = e.defId || this._storageDefId(e.id);
            const isBp = e.bucket === 'blueprints';
            const qty = isBp ? profileManager.getStationStorageQty(profile, e.bucket, defId) : 1;
            const meta = this._storageItemMeta(e.bucket, defId);
            const span = compact ? [1, 1] : this._storageItemSpan(e.bucket, defId);
            const cs = this._storageLayoutPx().cell;
            const body = (typeof physicalItem !== 'undefined')
                ? physicalItem.wrap(meta.kind, meta.physId, span[0] * cs - 6, span[1] * cs - 6, meta.color, '') : '';
            const stats = String(this.hangarModuleTip(meta.kind, meta.physId) || '').split('\n').slice(1);
            if (e.bucket === 'weapons' && typeof shipLoadoutManager !== 'undefined' && activeShipId) {
                const L2 = shipLoadoutManager.getLoadout(activeShipId);
                stats.push('MODE ' + (L2 && L2.fireMode === 'charge' ? 'CHARGE' : 'AUTO'));
            }
            if (!isBp && e.unit != null) {
                const lv = (typeof profileManager !== 'undefined' && profileManager.getItemUpgradeLevel)
                    ? profileManager.getItemUpgradeLevel(e.bucket, e.id, profile) : 0;
                if (lv > 0) stats.push('UPGRADE L' + lv);
            }
            const key = e.bucket + ':' + e.id;
            const moveKey = e.bucket + ':' + defId;
            const selected = selectMode && selectKey === key;
            const action = isBp ? `data-craft="${defId}"`
                : (selectMode
                    ? `data-equip-select="${key}"`
                    : `data-move-to-ship="${moveKey}" data-ship="${activeShipId}"`);
            const tip = (isBp ? stats.concat(this._blueprintCostLines(profile, defId)).concat(qty > 1 ? ['×' + qty] : [])
                : stats.concat([selectMode ? 'SELECT' : '→ SHIP'].filter(Boolean))).join('\n').replace(/"/g, '&quot;');
            const ariaLabel = isBp ? `Craft ${meta.label}`
                : (selectMode ? `Select ${meta.label}` : `Move ${meta.label} to ship storage`);
            const dragAttrs = `draggable="true" data-drag-key="${key}" data-drag-source="station"`;
            // data-part-kind/-id: used by the hangar bay-inventory grid (physical-item.js, which
            // reuses this exact markup) to match a dragged cell against a ship slot's
            // data-slot-kind for equip-by-drag, and by its category filter buttons. "blueprint"
            // (not the real weapon/defense/... kind) specifically so a blueprint — not an
            // equippable part — can never register as a slot match and get equipped by accident.
            // Compact shop bags drop pinned multi-cell poses — they fight 1×1 packing.
            const pinnedPos = compact ? null : (posMap[key] || (e.unit === 0 ? posMap[moveKey] : null));
            const html = `<button type="button" class="hs-storage-cell${isBp ? ' is-blueprint' : ''}${selected ? ' is-selected' : ''}" ${action} ${dragAttrs} data-part-kind="${isBp ? 'blueprint' : meta.kind}" data-part-id="${isBp ? defId : meta.physId}" style="__SPAN__--pk-c:${meta.color}" ` +
                `data-ui-tip-compact data-ui-tip-head="${meta.label.replace(/"/g, '&quot;')}" ` +
                `data-ui-tip="${tip}" aria-label="${ariaLabel}"${selected ? ' aria-pressed="true"' : ''}>` +
                `${body}` +
                `${isBp && qty > 1 ? `<span class="hs-storage-cell-qty">×${qty}</span>` : ''}` +
                `</button>`;
            return { html, span, pos: pinnedPos };
        });
        const used = cells.reduce((n, c) => n + c.span[0] * c.span[1], 0);
        return this._storageGridHtml(
            cells,
            this._stationStorageGrid(profile, used, { maxCols: opts.maxCols }),
            'data-storage-target="station"'
        );
    },

    /** Items filed into the given ship's storage, plus anything currently equipped on it, as a grid of icon tiles.
     *  opts.selectKey: when set (EQUIPMENT tab), cells select for the detail panel instead of moving.
     *  Parts expand to one cell per owned unit on this ship (no stacks); blueprints stay qty-stacked. */
    renderShipStorage(profile, shipId, opts) {
        opts = opts || {};
        const selectMode = opts.selectKey !== undefined;
        const selectKey = opts.selectKey || null;
        const grid = this._storageGrid(shipId);
        if (!shipId) return this._storageGridHtml([], grid);
        const entry = profileManager.getShipStorageEntry(profile, shipId);
        const rawEntries = [];
        const seenDef = {};
        const addDef = (bucket, defId) => {
            if (!defId) return;
            const dk = bucket + ':' + defId;
            if (seenDef[dk]) return;
            seenDef[dk] = true;
            if (bucket === 'blueprints') {
                rawEntries.push({ bucket, id: defId, defId });
                return;
            }
            const layout = (profileManager.getPartInstanceLayout)
                ? profileManager.getPartInstanceLayout(profile, bucket, defId)
                : null;
            const units = (layout && layout.ships && layout.ships[shipId]) || null;
            if (units && units.length) {
                units.forEach((unit) => {
                    rawEntries.push({ bucket, id: defId + '#' + unit, defId, unit });
                });
                return;
            }
            const qty = profileManager.getShipStorageQty(profile, shipId, bucket, defId);
            if (qty > 0) {
                this._expandPartUnits(bucket, defId, qty).forEach((u) => rawEntries.push(u));
            }
        };
        this.profileManagerShipStorageBuckets().forEach((bucket) => {
            Object.keys(entry[bucket] || {}).forEach((id) => {
                if ((entry[bucket][id] || 0) > 0) addDef(bucket, id);
            });
        });
        const L = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager.getLoadout(shipId) : null;
        const equippedOcc = {};
        if (L) {
            (L.weaponSlots || []).forEach((id) => {
                if (!id) return;
                addDef('weapons', id);
                equippedOcc['weapons:' + id] = (equippedOcc['weapons:' + id] || 0) + 1;
            });
            ['defenses', 'abilities', 'energy'].forEach((bucket) => {
                (L[bucket] || []).forEach((id) => {
                    if (!id) return;
                    addDef(bucket, id);
                    equippedOcc[bucket + ':' + id] = (equippedOcc[bucket + ':' + id] || 0) + 1;
                });
            });
        }
        const equippedUnits = {};
        Object.keys(equippedOcc).forEach((dk) => {
            const sep = dk.indexOf(':');
            const bucket = dk.slice(0, sep);
            const defId = dk.slice(sep + 1);
            const layout = (profileManager.getPartInstanceLayout)
                ? profileManager.getPartInstanceLayout(profile, bucket, defId)
                : null;
            const shipUnits = (layout && layout.ships && layout.ships[shipId]) || [];
            const n = equippedOcc[dk];
            for (let i = 0; i < n && i < shipUnits.length; i++) {
                equippedUnits[bucket + ':' + defId + '#' + shipUnits[i]] = true;
            }
            if (!shipUnits.length) equippedUnits[dk] = true;
        });
        const orderedEntries = this._orderStorageEntries(profile, 'ship', shipId, rawEntries);
        const posMap = profileManager.getStoragePosMap(profile, 'ship', shipId);
        const compact = !!opts.compactSpans;
        const cells = orderedEntries.map((e) => {
            const defId = e.defId || this._storageDefId(e.id);
            const isBp = e.bucket === 'blueprints';
            const qty = isBp ? profileManager.getShipStorageQty(profile, shipId, e.bucket, defId) : 1;
            const meta = this._storageItemMeta(e.bucket, defId);
            const span = compact ? [1, 1] : this._storageItemSpan(e.bucket, defId);
            const cs = this._storageLayoutPx().cell;
            const body = (typeof physicalItem !== 'undefined')
                ? physicalItem.wrap(meta.kind, meta.physId, span[0] * cs - 6, span[1] * cs - 6, meta.color, '') : '';
            const stats = String(this.hangarModuleTip(meta.kind, meta.physId) || '').split('\n').slice(1);
            if (e.bucket === 'weapons' && typeof shipLoadoutManager !== 'undefined') {
                const L2 = shipLoadoutManager.getLoadout(shipId);
                stats.push('MODE ' + (L2 && L2.fireMode === 'charge' ? 'CHARGE' : 'AUTO'));
            }
            if (!isBp && e.unit != null) {
                const lv = (typeof profileManager !== 'undefined' && profileManager.getItemUpgradeLevel)
                    ? profileManager.getItemUpgradeLevel(e.bucket, e.id, profile) : 0;
                if (lv > 0) stats.push('UPGRADE L' + lv);
            }
            const key = e.bucket + ':' + e.id;
            const moveKey = e.bucket + ':' + defId;
            const selected = selectMode && selectKey === key;
            const equipped = !!(equippedUnits[key] || equippedUnits[moveKey]);
            const action = isBp ? `data-craft="${defId}"`
                : (selectMode
                    ? `data-equip-select="${key}"`
                    : `data-move-to-station="${key}" data-ship="${shipId}"`);
            // tipAction:false (hangar bay) drops the station-move hint — click toggles equip there.
            const tipAction = selectMode ? 'SELECT'
                : (opts.tipAction === false ? null : '→ STATION');
            const tip = (isBp ? stats.concat(this._blueprintCostLines(profile, defId)).concat(qty > 1 ? ['×' + qty] : [])
                : stats.concat([equipped ? 'EQUIPPED' : null, tipAction].filter(Boolean))).join('\n').replace(/"/g, '&quot;');
            const ariaLabel = isBp ? `Craft ${meta.label}`
                : (selectMode ? `Select ${meta.label}` : `Move ${meta.label} to station storage`);
            const dragAttrs = `draggable="true" data-drag-key="${key}" data-drag-source="ship" data-drag-ship="${shipId}"`;
            // data-part-kind/-id: see renderStationStorage above — same reason, needed here too
            // since this is the function the hangar bay-inventory grid actually calls.
            const pinnedPos = compact ? null : (posMap[key] || (e.unit === 0 ? posMap[moveKey] : null));
            const html = `<button type="button" class="hs-storage-cell${isBp ? ' is-blueprint' : ''}${selected ? ' is-selected' : ''}${equipped ? ' is-equipped' : ''}" ${action} ${dragAttrs} data-part-kind="${isBp ? 'blueprint' : meta.kind}" data-part-id="${isBp ? defId : meta.physId}" style="__SPAN__--pk-c:${meta.color}" ` +
                `data-ui-tip-compact data-ui-tip-head="${meta.label.replace(/"/g, '&quot;')}" ` +
                `data-ui-tip="${tip}" aria-label="${ariaLabel}"${selected ? ' aria-pressed="true"' : ''}>` +
                `${body}` +
                `${isBp && qty > 1 ? `<span class="hs-storage-cell-qty">×${qty}</span>` : ''}` +
                `</button>`;
            return { html, span, pos: pinnedPos };
        });
        // opts.extraGridClass: the hangar bay-inventory grid (physical-item.js bayInventoryHtml)
        // calls this same function for its item set/positions/grid size — one source of truth —
        // and tags the result with its own class for CSS/selector hooks (.hs-pick-grid) that
        // don't apply to this function's own Station-tab callers.
        return this._storageGridHtml(cells, grid, `data-storage-target="ship" data-ship="${shipId}"`, opts.extraGridClass);
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
