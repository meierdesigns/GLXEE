"use strict";

// HomeStationUI methods, split from home-station.js.
// UPGRADE → EQUIPMENT: station/ship inventory grids for the active ship.
// Equipped parts appear in SHIP STORAGE; select a cell for upgrades/unequip.
extendClass(HomeStationUI, {
    /** bucket (weapons/defenses/abilities/energy) -> kind arg expected by shipLoadoutManager. */
    _itemBucketKind(bucket) {
        return bucket === 'weapons' ? 'weapon'
            : bucket === 'defenses' ? 'defense'
                : bucket === 'energy' ? 'energy' : 'ability';
    },

    /** Whether the active ship currently has this item mounted. */
    _itemIsEquippedOnShip(shipId, bucket, id) {
        if (typeof shipLoadoutManager === 'undefined' || !shipId || !id) return false;
        const L = shipLoadoutManager.getLoadout(shipId);
        if (!L) return false;
        if (bucket === 'weapons') {
            return (L.weaponSlots || L.weapons || []).indexOf(id) !== -1;
        }
        return (L[bucket] || []).indexOf(id) !== -1;
    },

    /** Selected storage item: header + DETAILS upgrades + move/unequip actions.
     *  Empty state when no part is selected in STATION/SHIP STORAGE. */
    renderSelectedEquipItem(profile, shipId) {
        const key = this.expandedEquipItem;
        const wrap = (body) => `<div class="hs-panel hs-equip-col hs-equip-selected">` +
            this.panelTitle('hsHangar', 'SELECTED') + body + `</div>`;
        if (!key || key.indexOf(':') === -1) {
            return wrap(this.emptyHtml('hsHangar', 'SELECT A PART'));
        }
        const sep = key.indexOf(':');
        const bucket = key.slice(0, sep);
        const id = key.slice(sep + 1);
        if (!bucket || !id || bucket === 'blueprints') {
            return wrap(this.emptyHtml('hsHangar', 'SELECT A PART'));
        }
        const parsed = (typeof profileManager !== 'undefined' && profileManager.parsePartInstanceId)
            ? profileManager.parsePartInstanceId(id)
            : { defId: id, unit: null };
        const defId = parsed.defId || id;
        const meta = this._storageItemMeta(bucket, defId);
        const level = (typeof profileManager !== 'undefined') ? profileManager.getItemUpgradeLevel(bucket, id, profile) : 0;
        const trackDefs = (typeof economyConfig !== 'undefined' && economyConfig.itemUpgradeTrackDefs)
            ? economyConfig.itemUpgradeTrackDefs[bucket]
            : null;
        const maxLevel = trackDefs
            ? Object.keys(trackDefs).reduce((sum, t) => sum + (trackDefs[t].maxLevel || 5), 0)
            : ((typeof economyConfig !== 'undefined' && economyConfig.itemUpgradeMaxLevel) || 5);
        const kind = this._itemBucketKind(bucket);
        let onStation = false;
        let onShip = false;
        let equipped = false;
        if (parsed.unit != null && profileManager.getPartInstanceLayout) {
            const layout = profileManager.getPartInstanceLayout(profile, bucket, defId);
            onStation = (layout.station || []).indexOf(parsed.unit) !== -1;
            const shipUnits = (layout.ships && layout.ships[shipId]) || [];
            const shipIdx = shipUnits.indexOf(parsed.unit);
            onShip = shipIdx !== -1;
            if (onShip) {
                const eq = profileManager._equippedStorageCount
                    ? profileManager._equippedStorageCount(profile, shipId, bucket, defId)
                    : 0;
                equipped = shipIdx >= 0 && shipIdx < eq;
            }
        } else {
            equipped = this._itemIsEquippedOnShip(shipId, bucket, defId);
            onStation = profileManager.getStationStorageQty(profile, bucket, defId) > 0;
            onShip = profileManager.getShipStorageQty(profile, shipId, bucket, defId) > 0;
        }
        let actionHtml = '';
        if (equipped) {
            actionHtml += `<button class="action-button hs-line-action hs-equip-unequip" data-item-unequip="${shipId}|${kind}|${defId}" title="Unequip">UNEQUIP</button>`;
        }
        // Keep instance id on move attrs so upgrade bags follow this specific copy.
        if (onStation && shipId) {
            actionHtml += `<button class="action-button hs-line-action" data-move-to-ship="${bucket}:${id}" data-ship="${shipId}">TO SHIP</button>`;
        }
        if (onShip) {
            actionHtml += `<button class="action-button hs-line-action" data-move-to-station="${bucket}:${id}" data-ship="${shipId}">TO STATION</button>`;
        }
        const where = equipped ? 'EQUIPPED' : (onStation ? 'STATION' : 'SHIP');
        // Compare selected weapon to what's currently mounted so weaker stats
        // light up (is-bad) — same signal as hangar ability hover.
        let statsHtml = '';
        if (bucket === 'weapons' && this.hangarWeaponStatsHtml) {
            let compareId = null;
            if (!equipped && typeof shipLoadoutManager !== 'undefined') {
                const L = shipLoadoutManager.getLoadout(shipId);
                const mounted = (L && (L.weaponSlots || L.weapons)) || [];
                compareId = mounted.find((w) => w) || null;
            }
            statsHtml = this.hangarWeaponStatsHtml(defId, compareId);
        } else if (bucket === 'abilities' && this.hangarAbilityStatsHtml) {
            statsHtml = this.hangarAbilityStatsHtml(defId);
        } else if (bucket === 'energy' && this.hangarEnergyStatsHtml) {
            statsHtml = this.hangarEnergyStatsHtml(defId);
        }
        const tip = this.hangarModuleTip ? this.hangarModuleTip(kind, defId) : '';
        const desc = tip ? String(tip).split('\n')[1] : '';
        return wrap(
            `<div class="hs-line hs-shop-line hs-equip-line is-expanded">` +
            `<span class="hs-line-name">` +
            `<span class="hs-chip-icon">${meta.icon}</span>` +
            `<span class="hs-line-text">` +
            `<strong>${meta.label}</strong>` +
            `<span class="hs-line-meta">L${level}/${maxLevel} · ${where}</span>` +
            (desc ? `<span class="hs-line-desc">${String(desc).replace(/</g, '&lt;')}</span>` : '') +
            (statsHtml ? `<span class="hs-equip-compare-stats">${statsHtml}</span>` : '') +
            `</span></span>` +
            `<span class="hs-line-actions">${actionHtml}</span>` +
            `</div>` +
            this.renderEquipmentItemDetail(bucket, id, profile)
        );
    },

    /** UPGRADE tab → EQUIPMENT: active ship + station/ship inventory (+ selected part detail). */
    renderEquipmentUpgrades(profile) {
        if (typeof shipLoadoutManager === 'undefined' || typeof profileManager === 'undefined') {
            return '<p class="hs-muted">Equipment management unavailable.</p>';
        }
        const owned = profile.ownedShipIds || [];
        if (!owned.length) return this.emptyHtml('hsShip', 'NO SHIPS OWNED');

        const shipId = (profile.activeShipId && owned.indexOf(profile.activeShipId) !== -1)
            ? profile.activeShipId
            : owned[0];
        const shipPicker = owned.length > 1
            ? `<div class="hs-equip-ship-pick">` + owned.map((id) => {
                const on = id === shipId;
                return `<button type="button" class="action-button hs-equip-ship-btn${on ? ' is-active' : ''}" ` +
                    `data-select-ship="${id}" data-nav-item${on ? ' aria-current="true"' : ''}>` +
                    `${this.shipName(id)}</button>`;
            }).join('') + `</div>`
            : '';

        const selected = this.renderSelectedEquipItem(profile, shipId);

        // After paint: if the selected part is a weaker swap, light up ship-card damage.
        requestAnimationFrame(() => {
            if (this.markShipStatsWorseForSelected) this.markShipStatsWorseForSelected(shipId);
        });

        return `<div class="hs-equip-ship">` +
            shipPicker +
            `<div class="hs-equip-cols">` +
            `<div class="hs-equip-inv">` +
            `<div class="hs-panel hs-equip-col hs-panel-storage">` +
            this.panelTitle('hsCraft', 'STATION STORAGE · ' + this.stationStorageLabel(profile)) +
            `<div class="hs-row">${this.renderStationStorage(profile, { selectKey: this.expandedEquipItem })}</div>` +
            `</div>` +
            `<div class="hs-panel hs-equip-col hs-panel-storage">` +
            this.panelTitle('hsShip', 'SHIP STORAGE') +
            `<div class="hs-row">${this.renderShipStorage(profile, shipId, { selectKey: this.expandedEquipItem })}</div>` +
            `</div>` +
            `</div>` +
            selected +
            `</div>` +
            `</div>`;
    },

    /** Clear up/down marks on ship-card stat chips. */
    clearShipStatCompareMarks() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-ship-stat.is-worse, .hs-ship-stat.is-better').forEach((el) => {
            el.classList.remove('is-worse', 'is-better');
        });
    },

    /** Mark ship-card damage when a weapon would upgrade/downgrade vs the mounted gun. */
    markShipStatCompareForWeapon(shipId, defId) {
        if (!this.overlay || !shipId || !defId || typeof weaponConfigManager === 'undefined') return;
        if (this._itemIsEquippedOnShip && this._itemIsEquippedOnShip(shipId, 'weapons', defId)) return;
        const L = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager.getLoadout(shipId) : null;
        const mounted = (L && (L.weaponSlots || L.weapons)) || [];
        const compareId = mounted.find((w) => w) || null;
        if (!compareId || compareId === defId) return;
        const w = weaponConfigManager.getWeapon(defId);
        const c = weaponConfigManager.getWeapon(compareId);
        if (!w || !c) return;
        const mine = Number(w.damage) || 0;
        const theirs = Number(c.damage) || 0;
        if (mine === theirs) return;
        const el = this.overlay.querySelector(
            `.hs-ship-table-name .hs-ship-stat[data-stat="damage"]`
        );
        if (!el) return;
        el.classList.add(mine < theirs ? 'is-worse' : 'is-better');
    },

    /** Highlight ship-card numbers for the selected storage part (equipment tab). */
    markShipStatsWorseForSelected(shipId) {
        this.clearShipStatCompareMarks();
        const key = this.expandedEquipItem;
        if (!key || key.indexOf(':') < 0) return;
        const sep = key.indexOf(':');
        const bucket = key.slice(0, sep);
        const rawId = key.slice(sep + 1);
        if (bucket !== 'weapons') return;
        const defId = (typeof profileManager !== 'undefined' && profileManager.parsePartInstanceId)
            ? (profileManager.parsePartInstanceId(rawId).defId || rawId) : rawId;
        this.markShipStatCompareForWeapon(shipId, defId);
    },
});
