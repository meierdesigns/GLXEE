"use strict";

// HomeStationUI: hull area upgrades (slot size S → M → L), shown in the
// hangar head bar and in the upgrade tab's SHIPS list.
extendClass(HomeStationUI, {
    /** One row per area: level, slots it holds, next size, cost, button. */
    renderAreaUpgradeRows(shipId, profile, compact) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getShipAreas
            || typeof profileManager === 'undefined' || !profileManager.getShipAreaLevels) return '';
        const slm = shipLoadoutManager;
        const levels = profileManager.getShipAreaLevels(shipId, profile);
        const max = slm.getMaxAreaLevel();
        const wallet = profile.resources || {};
        const kindsIn = { front: 'NOSE WEAPON', center: 'DEFENSE · ENERGY', back: 'ABILITY', wing: 'WING WEAPONS (PAIRS)' };
        return slm.getShipAreas().map((area) => {
            const lv = levels[area.id] || 0;
            const size = slm.slotSizeLabel(lv);
            const maxed = lv >= max;
            const check = profileManager.canPurchaseShipAreaUpgrade(shipId, area.id, profile);
            const cost = check.cost || (!maxed ? economyConfig.getShipAreaUpgradeCost(area.id, lv + 1) : null);
            const bonus = !maxed ? slm.getAreaSlotBonusAt(area.id, lv + 1) : [];
            const bonusText = bonus.length ? ' +' + bonus.length + ' ' + this.slotKindName(bonus[0]) + (bonus.length > 1 ? ' SLOTS' : ' SLOT') : '';
            // Missing resources stays clickable: the click opens the buy modal.
            const lockAttr = check.ok ? '' : (check.reason === 'RESOURCES' ? 'data-short="1"' : 'disabled');
            const action = maxed
                ? '<span class="hs-muted hs-line-action">MAX</span>'
                : `<button type="button" class="action-button hs-line-action" data-area-up="${shipId}|${area.id}" ${lockAttr}` +
                    ` title="${area.label}: ${size} → ${slm.slotSizeLabel(lv + 1)}${bonusText}">` +
                    `${size} → ${slm.slotSizeLabel(lv + 1)}</button>`;
            return `<div class="hs-area-row${compact ? ' is-compact' : ''}" data-area="${area.id}">` +
                `<span class="hs-area-name"><span class="hs-slot-size is-${size}">${size}</span>` +
                `<strong>${area.label}</strong>` +
                (compact ? '' : `<small>${kindsIn[area.id]}${bonusText ? ' · NEXT' + bonusText : ''}</small>`) +
                `</span>` +
                (cost && !maxed ? this.renderCostGrid(cost, wallet) : '<span></span>') +
                action +
                `</div>`;
        }).join('');
    },

    /** Only the resources the cost actually needs, icon + amount, short ones marked. */
    renderCompactCost(cost, wallet) {
        const ids = (typeof economyConfig !== 'undefined') ? economyConfig.resourceIds : ['scrap', 'ore', 'crystal', 'voltex'];
        return ids.filter((id) => (cost[id] || 0) > 0).map((id) => {
            const short = ((wallet && wallet[id]) || 0) < cost[id];
            return `<span class="hs-area-cost${short ? ' is-short' : ''}" title="${id.toUpperCase()}">` +
                `${this.iconHtml(this.resourceIconKey(id), 16, 'hs-pixel hs-pixel-16')}${cost[id]}</span>`;
        }).join('');
    },

    /** Hangar: four compact area tiles — name, slot size, next cost, upgrade button. */
    renderHangarAreaUpgrades(shipId, profile) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getShipAreas
            || typeof profileManager === 'undefined' || !profileManager.getShipAreaLevels) return '';
        const slm = shipLoadoutManager;
        const levels = profileManager.getShipAreaLevels(shipId, profile);
        const max = slm.getMaxAreaLevel();
        const toggleable = slm.getToggleableAreas ? slm.getToggleableAreas() : [];
        // ON/OFF switch for every area except the core.
        const switchHtml = (areaId, on) => toggleable.indexOf(areaId) === -1 ? '' :
            `<label class="hs-area-switch" title="${on ? 'Switch off' : 'Switch on'}">` +
            `<input type="checkbox" data-area-toggle="${shipId}|${areaId}"${on ? ' checked' : ''} aria-label="${this.areaLabel(areaId)} on/off">` +
            `<span class="hs-area-switch-track"><span class="hs-area-switch-label">${on ? 'ON' : 'OFF'}</span></span></label>`;
        const tiles = slm.getShipAreas().map((area) => {
            if (slm.isAreaEnabled && !slm.isAreaEnabled(shipId, area.id)) {
                return `<div class="hs-area-tile is-off" data-area="${area.id}">` +
                    `<span class="hs-area-name"><strong>${area.label}</strong>${switchHtml(area.id, false)}</span>` +
                    `</div>`;
            }
            const lv = levels[area.id] || 0;
            const size = slm.slotSizeLabel(lv);
            const maxed = lv >= max;
            const check = profileManager.canPurchaseShipAreaUpgrade(shipId, area.id, profile);
            const cost = check.cost || (!maxed ? economyConfig.getShipAreaUpgradeCost(area.id, lv + 1) : null);
            const bonus = !maxed ? slm.getAreaSlotBonusAt(area.id, lv + 1) : [];
            const bonusText = bonus.length ? ' · +' + bonus.length + ' ' + this.slotKindName(bonus[0]) + (bonus.length > 1 ? ' SLOTS' : ' SLOT') : '';
            const lockAttr = check.ok ? '' : (check.reason === 'RESOURCES' ? 'data-short="1"' : 'disabled');
            return `<div class="hs-area-tile" data-area="${area.id}">` +
                `<span class="hs-area-name"><strong>${area.label}</strong><span class="hs-slot-size is-${size}">${size}</span>${switchHtml(area.id, true)}</span>` +
                (maxed
                    ? '<span class="hs-muted hs-area-max">MAX</span>'
                    : `<button type="button" class="action-button hs-area-btn" data-area-up="${shipId}|${area.id}"` +
                      ` title="${area.label}: ${size} → ${slm.slotSizeLabel(lv + 1)}${bonusText}">→ ${slm.slotSizeLabel(lv + 1)}</button>`) +
                `</div>`;
        }).join('');
        return `<div class="hs-hangar-areas" aria-label="Hull areas">${tiles}</div>`;
    },

    /** Upgrade tab → SHIPS: per ship, its four hull areas. */
    renderShipFrameUpgrades(profile) {
        const owned = profile.ownedShipIds || [];
        if (!owned.length) {
            return '<p class="hs-muted hs-empty-slot">NO SHIPS OWNED</p>';
        }
        const max = (typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 8) : 8;
        return owned.map((id) => {
            const level = profileManager.getShipFrameLevel(id, profile);
            const caps = (typeof shipLoadoutManager !== 'undefined')
                ? shipLoadoutManager.getSlotCaps(id, this.shipModelClass(id, typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(id) : null) || 'starfighter')
                : { weapons: 1, defenses: 1, abilities: 1, energy: 1 };
            return `<div class="hs-area-ship">` +
                `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${this.shipName(id)}</strong>` +
                `<span class="hs-line-meta">AREAS ${level}/${max} · SLOTS W${caps.weapons}/D${caps.defenses}/A${caps.abilities}/E${caps.energy || 1}</span>` +
                `</span></span></div>` +
                this.renderAreaUpgradeRows(id, profile, false) +
                `</div>`;
        }).join('');
    },

    bindAreaUpgradeButtons() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('[data-area-toggle]').forEach((input) => {
            input.addEventListener('change', () => {
                const [id, area] = (input.getAttribute('data-area-toggle') || '').split('|');
                const res = shipLoadoutManager.setAreaEnabled(id, area, input.checked);
                if (!res.ok) return;
                this.statusMsg = this.areaLabel(area) + (input.checked ? ' ON' : ' OFF');
                this.createUI();
            });
        });
        this.overlay.querySelectorAll('[data-area-up]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [id, area] = (btn.getAttribute('data-area-up') || '').split('|');
                this.openAreaUpgradeModal(id, area);
            });
        });
    },

    /** Buy an area level (after the confirm modal). */
    confirmAreaUpgrade(id, area) {
        const label = this.shipName(id) + ' · ' + this.areaLabel(area);
        const btn = this.overlay && this.overlay.querySelector(`[data-area-up="${id}|${area}"]`);
        const res = profileManager.purchaseShipAreaUpgrade(id, area);
        if (res.ok) {
            const msg = label + ' → ' + shipLoadoutManager.slotSizeLabel(res.level);
            if (btn) this.playButtonResult(btn, true, msg);
            else this.setStatus(msg);
        } else if (res.reason === 'RESOURCES') {
            this.openResourceBuyModal({
                title: label + ' → ' + shipLoadoutManager.slotSizeLabel(res.nextLevel || 1),
                cost: res.cost,
                action: { type: 'area-upgrade', id: id, area: area }
            });
        } else if (btn) {
            this.playButtonResult(btn, false, res.reason || 'FAILED');
        }
    },

    /**
     * Confirm dialog for an area upgrade: what changes (slot size, new
     * slots, hull bonus), the cost against the wallet, CONFIRM / CANCEL.
     */
    openAreaUpgradeModal(shipId, areaId) {
        const root = this.overlay && this.overlay.querySelector('.home-station-content');
        if (!root || typeof shipLoadoutManager === 'undefined') return;
        this.closeAreaUpgradeModal();
        const slm = shipLoadoutManager;
        const profile = this.getProfile();
        const lv = profileManager.getShipAreaLevels(shipId, profile)[areaId] || 0;
        const check = profileManager.canPurchaseShipAreaUpgrade(shipId, areaId, profile);
        const cost = check.cost || economyConfig.getShipAreaUpgradeCost(areaId, lv + 1);
        const from = slm.slotSizeLabel(lv);
        const to = slm.slotSizeLabel(lv + 1);
        const bonus = slm.getAreaSlotBonusAt(areaId, lv + 1);
        // Every area level is one frame level: +8 HP, +1 armor (getFrameHullBonus).
        const hull = { hp: 8, armor: 1 };
        const holds = { front: 'the nose weapon', center: 'defense and energy parts', back: 'ability parts', wing: 'the wing weapons' }[areaId] || '';
        const lines = [
            `<li>Slots in the ${this.areaLabel(areaId)} (${holds}): <strong>${from} → ${to}</strong> — parts up to size ${to} fit</li>`,
            bonus.length ? `<li>New: <strong>+${bonus.length} ${this.slotKindName(bonus[0])} slot${bonus.length > 1 ? 's' : ''}</strong></li>` : '',
            hull ? `<li>Hull: <strong>+${hull.hp} HP, +${hull.armor} armor</strong></li>` : ''
        ].join('');
        const short = check.reason === 'RESOURCES';
        const modal = document.createElement('div');
        modal.className = 'hs-res-buy-modal hs-area-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Area upgrade');
        modal.innerHTML = `<div class="hs-res-buy-dialog">` +
            `<div class="hs-res-buy-head"><h3>UPGRADE ${this.areaLabel(areaId)}</h3>` +
            `<p class="hs-res-buy-sub">${this.shipName(shipId)} · ${from} → ${to}</p></div>` +
            `<ul class="hs-area-modal-list">${lines}</ul>` +
            `<div class="hs-res-buy-cost">${cost ? this.renderCostGrid(cost, profile.resources || {}, profile) : ''}</div>` +
            (short ? `<p class="hs-area-modal-short">NOT ENOUGH RESOURCES — CONFIRM OPENS THE RESOURCE SHOP</p>` : '') +
            `<div class="hs-res-buy-actions">` +
            `<button type="button" class="action-button hs-res-buy-close" data-area-modal-cancel>CANCEL</button>` +
            `<button type="button" class="action-button" data-area-modal-confirm ${check.ok || short ? '' : 'disabled'}>` +
            `${short ? 'GET RESOURCES' : 'CONFIRM'}</button>` +
            `</div></div>`;
        root.appendChild(modal);
        const confirmBtn = modal.querySelector('[data-area-modal-confirm]');
        const close = () => this.closeAreaUpgradeModal();
        modal.querySelector('[data-area-modal-cancel]').addEventListener('click', close);
        // Click on the dark backdrop cancels too.
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        confirmBtn.addEventListener('click', () => {
            close();
            this.confirmAreaUpgrade(shipId, areaId);
        });
        // ESC cancels, ENTER confirms; the station's own keys stay out of it.
        this._areaModalKeys = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace') close();
            else if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
            else return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        document.addEventListener('keydown', this._areaModalKeys, true);
        (confirmBtn.disabled ? modal.querySelector('[data-area-modal-cancel]') : confirmBtn).focus();
    },

    closeAreaUpgradeModal() {
        if (this._areaModalKeys) {
            document.removeEventListener('keydown', this._areaModalKeys, true);
            this._areaModalKeys = null;
        }
        const m = this.overlay && this.overlay.querySelector('.hs-area-modal');
        if (m) m.remove();
    },

    /** Singular slot name for a loadout key (weapons → WEAPON). */
    slotKindName(key) {
        return { weapons: 'WEAPON', defenses: 'DEFENSE', abilities: 'ABILITY', energy: 'ENERGY' }[key]
            || String(key || '').toUpperCase();
    },

    /**
     * ON/OFF switch in the NOSE and AFT branch headers of the component
     * tree. A switched-off area is dimmed and its contents collapsed.
     */
    appendAreaToggles(treeContainer, shipId) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getToggleableAreas) return;
        shipLoadoutManager.getToggleableAreas().forEach((area) => {
            // Wings are one branch, or left/right branches when asymmetric.
            const branch = area === 'wing'
                ? treeContainer.querySelector('#hs-tree-area-wings, #hs-tree-area-wingLeft')
                : treeContainer.querySelector(`#hs-tree-area-${area}`);
            const summary = branch && branch.querySelector(':scope > summary');
            if (!summary || summary.querySelector('.hs-area-switch')) return;
            const on = shipLoadoutManager.isAreaEnabled(shipId, area);
            const branches = area === 'wing'
                ? Array.from(treeContainer.querySelectorAll('#hs-tree-area-wings, #hs-tree-area-wingLeft, #hs-tree-area-wingRight'))
                : [branch];
            branches.forEach((b) => {
                b.classList.toggle('is-area-off', !on);
                if (!on) b.removeAttribute('open');
            });
            const sw = document.createElement('label');
            sw.className = 'hs-area-switch';
            sw.title = (on ? 'Switch off ' : 'Switch on ') + this.areaLabel(area);
            sw.innerHTML = `<input type="checkbox"${on ? ' checked' : ''} aria-label="${this.areaLabel(area)} on/off">` +
                `<span class="hs-area-switch-track"><span class="hs-area-switch-label">${on ? 'ON' : 'OFF'}</span></span>`;
            // Clicks on the switch must not open/close the branch.
            sw.addEventListener('click', (e) => e.stopPropagation());
            sw.querySelector('input').addEventListener('change', (e) => {
                const res = shipLoadoutManager.setAreaEnabled(shipId, area, e.target.checked);
                if (!res.ok) return;
                this.statusMsg = this.areaLabel(area) + (e.target.checked ? ' ON' : ' OFF');
                this.createUI();
            });
            summary.appendChild(sw);
        });
    },

    areaLabel(areaId) {
        const a = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getShipAreas)
            ? shipLoadoutManager.getShipAreas().find((x) => x.id === areaId) : null;
        return a ? a.label : String(areaId || '').toUpperCase();
    },
});
