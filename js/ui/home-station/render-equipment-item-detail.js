"use strict";

// HomeStationUI methods, split from home-station.js.
// EQUIPMENT row detail panel (opened via DETAILS toggle in
// render-equipment-upgrades.js): independent stat tracks, weapon fire mode
// (SINGLE/BURST/AUTO), and a free fine-tune slider.
extendClass(HomeStationUI, {
    /** One upgradable stat track line inside the detail panel. */
    _renderItemTrackLine(bucket, id, track, meta, profile) {
        const level = profileManager.getItemTrackLevel(bucket, id, track, profile);
        const maxed = level >= meta.maxLevel;
        const check = profileManager.canPurchaseItemTrackUpgrade(bucket, id, track, profile);
        const cost = check.cost || (typeof economyConfig !== 'undefined' ? economyConfig.getItemTrackUpgradeCost(bucket, id, track, level + 1) : null);
        let action;
        if (maxed) {
            action = '<span class="hs-muted hs-line-action">MAX</span>';
        } else {
            action = this.renderUpgradeOrBuyButton(
                `data-item-track-up="${bucket}:${id}:${track}"`,
                check,
                cost,
                profile
            );
        }
        return `<div class="hs-line hs-shop-line hs-equip-track-line">` +
            `<span class="hs-line-name"><span class="hs-line-text">` +
            `<strong>${meta.label}</strong>` +
            `<span class="hs-line-meta">${meta.desc} · L${level}/${meta.maxLevel}</span>` +
            `</span></span>` +
            (cost && !maxed ? this.renderCostGrid(cost, profile.resources || {}) : '<span class="hs-equip-cost-empty"></span>') +
            action +
            `</div>`;
    },

    /** Weapon-only fire-mode row: toggle buttons, locked until the mode's unlock track hits its level. */
    _renderItemModeRow(bucket, id, profile) {
        if (bucket !== 'weapons' || typeof economyConfig === 'undefined' || !economyConfig.itemFireModes) return '';
        const current = profileManager.getItemMode(bucket, id, profile);
        const available = profileManager.getAvailableItemModes(bucket, id, profile);
        const trackDefs = economyConfig.itemUpgradeTrackDefs[bucket];
        const buttons = Object.keys(economyConfig.itemFireModes).map((modeId) => {
            const def = economyConfig.itemFireModes[modeId];
            const unlocked = available.indexOf(modeId) !== -1;
            const active = modeId === current;
            const trackLabel = def.unlockTrack && trackDefs[def.unlockTrack] ? trackDefs[def.unlockTrack].label : '';
            const lockNote = !unlocked && def.unlockTrack ? ` title="Needs ${trackLabel} L${def.unlockLevel}"` : ` title="${def.desc}"`;
            return `<button class="action-button hs-equip-mode-btn${active ? ' is-active' : ''}${unlocked ? '' : ' is-locked'}" ` +
                `data-item-mode="${bucket}:${id}:${modeId}" ${unlocked ? '' : 'disabled'}${lockNote}>${def.label}</button>`;
        }).join('');
        return `<div class="hs-equip-mode-row">` +
            `<span class="hs-equip-mode-label">FIRE MODE</span>` +
            `<span class="hs-equip-mode-btns">${buttons}</span>` +
            `</div>`;
    },

    /** 0..1 fine-tune slider — purchasable unlock per part, then free to adjust. */
    _renderItemTuneRow(bucket, id, profile) {
        const unlock = (typeof economyConfig !== 'undefined' && economyConfig.itemTuneUnlock)
            ? economyConfig.itemTuneUnlock[bucket]
            : null;
        const labels = (unlock && unlock.labels) || {
            weapons: ['RATE OF FIRE', 'DAMAGE'],
            defenses: ['REGEN', 'CAPACITY'],
            abilities: ['COOLDOWN', 'POTENCY'],
            energy: ['COOLDOWN', 'POTENCY']
        }[bucket] || ['', ''];
        const unlocked = profileManager.isItemTuneUnlocked(bucket, id, profile);
        if (!unlocked) {
            const check = profileManager.canPurchaseItemTuneUnlock(bucket, id, profile);
            const cost = check.cost || (typeof economyConfig !== 'undefined' ? economyConfig.getItemTuneUnlockCost(bucket) : null);
            return `<div class="hs-line hs-shop-line hs-equip-track-line hs-equip-tune-unlock">` +
                `<span class="hs-line-name"><span class="hs-line-text">` +
                `<strong>FINE TUNE</strong>` +
                `<span class="hs-line-meta">${labels[0]} ↔ ${labels[1]} · LOCKED</span>` +
                `</span></span>` +
                (cost ? this.renderCostGrid(cost, profile.resources || {}) : '<span class="hs-equip-cost-empty"></span>') +
                this.renderUpgradeOrBuyButton(
                    `data-item-tune-unlock="${bucket}:${id}"`,
                    check,
                    cost,
                    profile
                ) +
                `</div>`;
        }
        const tune = Math.round(profileManager.getItemTune(bucket, id, profile) * 100);
        return `<div class="hs-equip-tune">` +
            `<span class="hs-equip-tune-label">${labels[0]}</span>` +
            `<input type="range" min="0" max="100" step="1" value="${tune}" data-item-tune="${bucket}:${id}">` +
            `<span class="hs-equip-tune-label">${labels[1]}</span>` +
            `</div>`;
    },

    /** Expanded EQUIPMENT row: independent stat tracks + (weapons) fire mode + fine-tune slider. */
    renderEquipmentItemDetail(bucket, id, profile) {
        if (typeof economyConfig === 'undefined' || typeof profileManager === 'undefined') return '';
        const trackDefs = economyConfig.itemUpgradeTrackDefs[bucket];
        if (!trackDefs) return '';
        const tracks = Object.keys(trackDefs).map((track) => this._renderItemTrackLine(bucket, id, track, trackDefs[track], profile)).join('');
        return `<div class="hs-equip-detail">` +
            tracks +
            this._renderItemModeRow(bucket, id, profile) +
            this._renderItemTuneRow(bucket, id, profile) +
            `</div>`;
    },
});
