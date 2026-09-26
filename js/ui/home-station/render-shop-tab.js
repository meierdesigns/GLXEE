"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    renderShopTab(profile) {
        const post = this.getVisitedTradingPost();
        this.ensureShopCategory();
        let rows = '';
        let title = 'SHIP SHOP';
        let titleIcon = 'hsShop';
        if (this.shopCategory === 'blueprints') {
            title = 'BLUEPRINT SHOP';
            titleIcon = 'hsBlueprint';
            rows = this.renderShopBlueprintRows(profile);
        } else if (this.shopCategory === 'parts') {
            title = 'PARTS SHOP';
            titleIcon = 'hsCraft';
            rows = this.renderShopPartRows(profile);
        } else if (this.shopCategory === 'portals') {
            title = 'PORTALS SHOP';
            titleIcon = 'galaxyMilkyWay';
            rows = this.renderShopPortalRows(profile);
        } else if (this.shopCategory === 'resources') {
            title = 'RESOURCE MARKET';
            titleIcon = 'hsStores';
            rows = this.renderShopResourceRows(profile);
        } else if (this.shopCategory === 'styles') {
            title = 'STYLE SHOP';
            titleIcon = 'hsShip';
            rows = this.renderShopStyleRows(profile);
        } else {
            rows = this.renderShopShipRows(profile);
        }
        const shopFaction = this.getShopFaction(profile).toUpperCase();
        const galaxyId = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : 'milky_way';
        const galaxyName = String(galaxyId).replace(/_/g, ' ').toUpperCase();
        let stockHint = '';
        if (this.shopCategory === 'portals') {
            stockHint = `<p class="hs-muted hs-hint">Buy portals only for factions you have already met in combat. Filter by discovered faction.</p>`;
        } else if (this.shopCategory === 'resources') {
            stockHint = `<p class="hs-muted hs-hint">CREDITS = money (uncapped). SCRAP / ORE / CRYSTAL / VOLTEX = materials. Buy &amp; sell materials for credits from STATION or CARGO.</p>`;
        } else if (this.shopCategory === 'styles') {
            stockHint = `<p class="hs-muted hs-hint">The first 3 styles of every part and component are free. Unlock more looks here, then pick them in the HANGAR.</p>`;
        } else {
            stockHint = `<p class="hs-muted hs-hint">Station stock for ${galaxyName} · FACTION ${shopFaction}. Travel to change available ships and parts.</p>`;
        }
        if (post) {
            title = post.name + ' · ' + title;
            if (this.shopCategory === 'parts') stockHint = this.renderTradingPostHint(post);
        }
        let head = this.shopCategory === 'resources'
            ? this.renderShopResourceHeader()
            : this.renderShopCostHeader();
        if (this.isShopSellMode()) {
            title += ' · SELL';
            rows = this.renderShopSellRows(profile);
            head = this.renderShopSellHeader();
            stockHint = `<p class="hs-muted hs-hint">Sell back for 50% of the price in credits. Your starter and active ship cannot be sold; only uncrafted blueprints are listed.</p>`;
        }
        const undock = post
            ? `<button type="button" class="hs-shop-cat" id="hsUndock" data-nav-item>` +
                `<span class="hs-chip-icon">${this.iconHtml('hsStation', 32, 'hs-pixel')}</span><span>← UNDOCK</span></button>`
            : '';
        return `<div class="hs-section hs-panel hs-shop-root${post ? ' hs-trading-post' : ''}">` +
            `${this.renderShopWalletBar(profile)}` +
            `<div class="hs-shop-cats">${undock}${this.renderShopCategoryTabs()}</div>` +
            `${this.panelTitle(titleIcon, title)}` +
            `${stockHint}` +
            `${this.renderShopToolbar()}` +
            `<div class="hs-tab-fill hs-shop-list">` +
            `${head}` +
            `${rows || '<p class="hs-muted hs-empty-slot">EMPTY</p>'}` +
            `</div></div>`;
    },

    renderCraftTab(profile) {
        const keys = Object.keys(profile.blueprints || {}).filter((k) => (profile.blueprints[k] || 0) > 0);
        if (!keys.length) {
            return `<div class="hs-section hs-panel">${this.panelTitle('hsCraft', 'CRAFT')}` +
                `<div class="hs-tab-fill"><p class="hs-muted hs-hint">No blueprints in station. Collect drops in missions and teleport cargo.</p></div></div>`;
        }
        const rows = keys.map((id) => {
            if (profile.ownedShipIds.indexOf(id) !== -1) {
                return `<div class="hs-line hs-shop-line">` +
                    `<span class="hs-line-name"><span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
                    `<strong>${this.shipName(id)}</strong></span>` +
                    `<span class="hs-muted">OWNED</span></div>`;
            }
            const cfg = shipConfigManager.getConfig(id);
            const cost = (typeof profileManager !== 'undefined' && profileManager.getDiscountedCraftCost)
                ? profileManager.getDiscountedCraftCost(cfg, profile)
                : economyConfig.getCraftCost(cfg);
            const afford = this.canAffordCost(profile.resources, cost);
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name"><span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
                `<strong>${this.shipName(id)}</strong> ×${profile.blueprints[id]}</span>` +
                `${this.renderCostGrid(cost, profile.resources)}` +
                `<button class="action-button hs-line-action" data-craft="${id}" ${afford ? '' : 'disabled'}>` +
                `<span class="hs-btn-icon">${this.iconHtml('hsCraft', 32, 'hs-pixel')}</span>` +
                `<span>CRAFT</span></button></div>`;
        });
        return `<div class="hs-section hs-panel">${this.panelTitle('hsCraft', 'CRAFT FROM BLUEPRINT')}` +
            `<div class="hs-tab-fill">${rows.join('')}</div></div>`;
    },

    hangarModuleIconKey(kind, id) {
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.resolveModuleIcon) {
            const key = shipLoadoutManager.resolveModuleIcon({ kind: kind, id: id });
            if (key) return key;
        }
        if (kind === 'weapon') {
            const wid = String(id || 'laser');
            return 'shot' + wid.charAt(0).toUpperCase() + wid.slice(1);
        }
        if (kind === 'energy') return 'statEnergy';
        return 'ability_' + String(id || '');
    },

    hangarModuleLabel(id) {
        return String(id || 'EMPTY').replace(/_/g, ' ').toUpperCase();
    },

    /**
     * A second, independent dropdown per slot for choosing the module's
     * visual skin — deliberately separate from the weapon/module select
     * above, so re-skinning a component never changes its stats.
     */
    renderHangarSlotSkinDropdown(slot, kind, current) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getAvailableSkins) return '';
        const skins = shipLoadoutManager.getAvailableSkins(kind);
        if (!skins || skins.length <= 1) return '';
        const activeSkin = current && shipLoadoutManager.getModuleSkin
            ? shipLoadoutManager.getModuleSkin(this.hangarShipId, kind, current, slot.face)
            : (shipLoadoutManager.getSlotSkin
                ? shipLoadoutManager.getSlotSkin(this.hangarShipId, kind, slot.index)
                : 'default');
        return `<div class="hs-hangar-slot-skin-wrap">` +
            `<span class="hs-hangar-slot-skin-label">SKIN</span>` +
            `<div class="hs-hangar-slot-skin-options">` +
            skins.map((s) => `<button type="button" class="hs-hangar-slot-skin-option${s.id === activeSkin ? ' is-active' : ''}" data-hangar-slot-skin-set="${kind}" data-slot-index="${slot.index}" data-mod-face="${slot.face || ''}" data-skin-id="${s.id}">${s.label}</button>`).join('') +
            `</div>` +
            `</div>`;
    },

    renderHangarSlotDropdown(slot, inventory, equippedByKind) {
        const kind = slot.kind;
        const poolKey = kind === 'weapon' ? 'weapons'
            : (kind === 'defense' ? 'defenses'
                : (kind === 'energy' ? 'energy' : 'abilities'));
        const pool = (inventory && inventory[poolKey]) ? inventory[poolKey].slice() : [];
        const equipped = equippedByKind[kind] || {};
        const current = slot.id || '';
        const installBlocked = (id) => {
            if (!id || id === current) return null;
            if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.canInstallModule) return null;
            const fit = shipLoadoutManager.partFitsSlot
                ? shipLoadoutManager.partFitsSlot(this.hangarShipId, kind, id, slot.index) : { ok: true };
            if (!fit.ok) return 'TOO_BIG';
            const check = shipLoadoutManager.canInstallModule(this.hangarShipId, kind, id);
            if (check.ok || check.removing || check.reason === 'FULL') return null;
            return check.reason || 'BLOCKED';
        };
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        const partSize = (id) => (slm && slm.partSizeLabel ? slm.partSizeLabel(kind, id) : 'S');
        const slotSize = slm && slm.getSlotSizeLevel
            ? slm.slotSizeLabel(slm.getSlotSizeLevel(this.hangarShipId, kind, slot.index)) : 'S';
        const options = [`<option value="">EMPTY</option>`].concat(pool.map((id) => {
            const usedElsewhere = !!(equipped[id] && id !== current);
            const blocked = installBlocked(id);
            const label = `[${partSize(id)}] ` + this.hangarModuleLabel(id)
                + (blocked === 'NEED_CHARGE_SHOT' ? ' · NEED CHARGE SHOT'
                    : (blocked === 'NEED_CHARGE_DRIVE' ? ' · NEED CHARGE DRIVE'
                        : (blocked === 'TOO_BIG' ? ' · NEEDS ' + partSize(id) + ' SLOT'
                            : (usedElsewhere ? ' · EQUIPPED' : ''))));
            return `<option value="${id}" ${id === current ? 'selected' : ''}${blocked ? ' disabled' : ''}>${label}</option>`;
        }));
        const iconKey = current
            ? this.hangarModuleIconKey(kind, current)
            : (kind === 'weapon' ? 'statWeapon'
                : (kind === 'defense' ? 'statArmor'
                    : (kind === 'energy' ? 'statEnergy' : 'statAbilities')));
        const mark = current ? '●' : '+';
        const name = current ? this.hangarModuleLabel(current) : 'EMPTY';
        const open = (this._hangarOpenSlot
            && this._hangarOpenSlot.kind === kind
            && Number(this._hangarOpenSlot.index) === Number(slot.index)) ? ' is-open' : '';
        const pinX = Math.round((slot.nx != null ? slot.nx : 0.5) * 1000) / 1000;
        const pinY = Math.round((slot.ny != null ? slot.ny : 0.5) * 1000) / 1000;
        const railI = slot.railIndex != null ? slot.railIndex : 0;
        const railN = Math.max(1, slot.railCount != null ? slot.railCount : 1);
        const side = slot.side === 'left' ? 'left' : 'right';
        const factionAccent = this.hangarFactionAccent();
        // Wing weapon slots are a mirrored pair: a second, display-only marker
        // sits on the right wing (same slot, same weapon).
        const mirror = slot.mirrorNx != null;
        const mirrorVars = mirror ? `--pin-mx:${Math.round(slot.mirrorNx * 1000) / 1000};--pin-my:${Math.round(slot.mirrorNy * 1000) / 1000};` : '';
        return `<div class="hs-hangar-slot${slot.empty ? ' is-empty' : ''}${open}${mirror ? ' is-wing-pair' : ''}" data-slot-kind="${kind}" data-slot-size="${slotSize}" data-slot-index="${slot.index}" data-slot-side="${side}" data-slot-mount="${slot.mount || ''}" style="--pin-x:${pinX};--pin-y:${pinY};${mirrorVars}--rail-i:${railI};--rail-n:${railN};">` +
            `<button type="button" class="hs-hangar-slot-pin" data-hangar-slot-toggle="${kind}" data-slot-index="${slot.index}" data-mod-id="${current}" data-mod-face="${slot.face || ''}" title="${slot.label}">` +
            `<span class="hs-hangar-slot-dot"></span>` +
            `</button>` +
            (mirror ? `<span class="hs-hangar-slot-pin is-mirror" aria-hidden="true"><span class="hs-hangar-slot-dot"></span></span>` : '') +
            `<div class="hs-hangar-slot-card">` +
            `<button type="button" class="hs-hangar-slot-btn" data-nav-item data-hangar-slot-toggle="${kind}" data-slot-index="${slot.index}">` +
            `<span class="hs-btn-icon">${this.iconHtml(iconKey, 20, 'hs-pixel hs-pixel-20', null, factionAccent)}</span>` +
            `<span class="hs-hangar-slot-meta">` +
            `<span class="hs-hangar-slot-kind">${this.slotGlyphHtml(kind)}${slot.label} <span class="hs-slot-size" title="Slot size">${slotSize}</span></span>` +
            `<span class="hs-hangar-slot-name" title="${name}"><span class="hs-hangar-slot-mark">${mark}</span> ${name}</span>` +
            `</span>` +
            `<span class="hs-hangar-slot-caret">▾</span>` +
            `</button>` +
            `<div class="hs-hangar-slot-menu" role="listbox">` +
            `<label class="hs-hangar-slot-select-wrap">` +
            `<select class="hs-hangar-slot-select" data-hangar-slot-select="${kind}" data-slot-index="${slot.index}" aria-label="${slot.label}">` +
            options.join('') +
            `</select>` +
            `</label>` +
            this.renderHangarSlotSkinDropdown(slot, kind, current) +
            `<div class="hs-hangar-slot-options">` +
            `<button type="button" class="hs-hangar-slot-option${current ? '' : ' is-active'}" data-hangar-slot-set="${kind}" data-slot-index="${slot.index}" data-mod-id="">` +
            `<span class="hs-hangar-slot-mark">○</span><span>EMPTY</span></button>` +
            pool.map((id) => {
                const on = id === current;
                const usedElsewhere = !!(equipped[id] && !on);
                const blocked = installBlocked(id);
                const disabled = blocked ? ' disabled' : '';
                const blockedCls = blocked ? ' is-blocked' : '';
                return `<button type="button" class="hs-hangar-slot-option${on ? ' is-active' : ''}${usedElsewhere ? ' is-used' : ''}${blockedCls}" data-hangar-slot-set="${kind}" data-slot-index="${slot.index}" data-mod-id="${id}"${disabled}>` +
                    `<span class="hs-btn-icon">${this.iconHtml(this.hangarModuleIconKey(kind, id), 18, 'hs-pixel hs-pixel-18', null, factionAccent)}</span>` +
                    `<span class="hs-slot-size" title="Part size">${partSize(id)}</span>` +
                    `<span>${this.hangarModuleLabel(id)}${blocked === 'NEED_CHARGE_SHOT' ? ' · NEED CS' : (blocked === 'NEED_CHARGE_DRIVE' ? ' · NEED CD' : (blocked === 'TOO_BIG' ? ' · NEEDS ' + partSize(id) : ''))}</span>` +
                    `<span class="hs-hangar-slot-mark">${on ? '●' : (blocked ? '✕' : (usedElsewhere ? '◇' : '○'))}</span>` +
                    `</button>`;
            }).join('') +
            `</div></div></div></div>`;
    },
});
