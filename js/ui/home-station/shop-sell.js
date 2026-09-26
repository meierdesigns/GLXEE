"use strict";

// HomeStationUI methods: faction tags on shop rows and the SELL mode of the
// shop (ships, unlearned blueprints, parts, styles).
extendClass(HomeStationUI, {
    /** Faction chip for a shop row; items without a faction read NEUTRAL. */
    factionTagHtml(faction) {
        const id = String(faction || '').toLowerCase();
        let label = 'NEUTRAL';
        if (id) {
            const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
                ? planetConfigManager.getFactionMeta(id)
                : null;
            label = String((meta && meta.label) || id).toUpperCase();
        }
        return `<span class="hs-part-faction${id ? '' : ' is-neutral'}">${label}</span>`;
    },

    shipFaction(shipId) {
        const cfg = (typeof shipConfigManager !== 'undefined') ? shipConfigManager.getConfig(shipId) : null;
        return (cfg && cfg.faction) || '';
    },

    isShopSellCategory() {
        return ['ships', 'blueprints', 'parts', 'styles'].indexOf(this.shopCategory) !== -1;
    },

    isShopSellMode() {
        return this.shopMode === 'sell' && this.isShopSellCategory() && !this.visitPostId;
    },

    renderShopModeToggle() {
        if (!this.isShopSellCategory() || this.visitPostId) return '';
        const mode = this.isShopSellMode() ? 'sell' : 'buy';
        const btn = (id, label) => `<button type="button" class="hs-shop-ctrl${mode === id ? ' active' : ''}" data-shop-mode="${id}" data-nav-item>${label}</button>`;
        return `<div class="hs-shop-ctrl-group">` +
            `<span class="hs-shop-ctrl-label">MODE</span>` +
            `<div class="hs-shop-ctrl-row">${btn('buy', 'BUY')}${btn('sell', 'SELL')}</div>` +
            `</div>`;
    },

    /** One sell row: name/meta, payout in credits, SELL button (or reason). */
    renderSellLine(icon, name, meta, credits, attr, block) {
        const action = block
            ? `<span class="hs-muted hs-line-action">${block}</span>`
            : `<button class="action-button hs-line-action" ${attr}>SELL</button>`;
        return `<div class="hs-line hs-shop-line hs-sell-line">` +
            `<span class="hs-line-name">${icon}` +
            `<span class="hs-line-text"><strong>${name}</strong>` +
            `<span class="hs-line-meta">${meta}</span></span></span>` +
            `<span class="hs-sell-value">+${credits} CR</span>` +
            action +
            `</div>`;
    },

    renderShopSellRows(profile) {
        const pm = profileManager;
        const chip = (key) => `<span class="hs-chip-icon">${this.iconHtml(key, 32, 'hs-pixel')}</span>`;
        let rows = [];
        if (this.shopCategory === 'ships') {
            rows = (profile.ownedShipIds || []).map((id) => {
                const cls = this.shipModelClass(id, shipConfigManager.getConfig(id));
                if (this.shopFilter && this.shopFilter !== 'all' && cls !== this.shopFilter) return '';
                return this.renderSellLine(chip('hsShip'), this.shipName(id),
                    `${this.shipClassLabel(cls)} · ${this.factionTagHtml(this.shipFaction(id))}`,
                    pm.getShipSellValue(id), `data-sell-ship="${id}"`, pm.getShipSellBlock(id, profile));
            });
        } else if (this.shopCategory === 'blueprints') {
            rows = Object.keys(profile.blueprints || {}).filter((id) => profile.blueprints[id] > 0).map((id) => {
                const cls = this.shipModelClass(id, shipConfigManager.getConfig(id));
                if (this.shopFilter && this.shopFilter !== 'all' && cls !== this.shopFilter) return '';
                return this.renderSellLine(chip('hsBlueprint'), `BP: ${this.shipName(id)} ×${profile.blueprints[id]}`,
                    `${this.shipClassLabel(cls)} · ${this.factionTagHtml(this.shipFaction(id))} · NOT CRAFTED`,
                    pm.getBlueprintSellValue(id), `data-sell-bp="${id}"`, '');
            });
        } else if (this.shopCategory === 'parts') {
            const bags = [['weapon', 'weapons', 'statWeapon'], ['defense', 'defenses', 'statArmor'],
                ['ability', 'abilities', 'statAbilities'], ['energy', 'energy', 'ability_energy_shield']];
            bags.forEach(([kind, key, icon]) => {
                if (this.shopFilter && this.shopFilter !== 'all' && this.shopFilter !== kind) return;
                const bag = (profile.parts && profile.parts[key]) || {};
                Object.keys(bag).filter((id) => bag[id] > 0).forEach((id) => {
                    const item = pm.getPartItem(kind, id);
                    rows.push(this.renderSellLine(chip(icon),
                        `${String((item && item.name) || id).toUpperCase()} ×${bag[id]}`,
                        `${kind.toUpperCase()} · ${this.factionTagHtml(item && item.faction)}`,
                        pm.getPartSellValue(kind, id), `data-sell-part="${kind}:${id}"`, ''));
                });
            });
        } else if (this.shopCategory === 'styles') {
            pm.getStyleGroups().forEach((g) => {
                if (this.shopFilter && this.shopFilter !== 'all' && this.shopFilter !== g.id) return;
                pm.getSellableStyles(g.id, profile).forEach((e) => {
                    rows.push(this.renderSellLine(chip(g.icon), e.style.label,
                        `${g.label} STYLE · ${this.factionTagHtml('')}`,
                        pm.getSellValue(pm.getStyleCost(e.index)), `data-sell-style="${g.id}|${e.style.id}"`, ''));
                });
            });
        }
        rows = rows.filter(Boolean);
        return rows.length ? rows.join('') : '<p class="hs-muted hs-empty-slot">NOTHING TO SELL</p>';
    },

    renderShopSellHeader() {
        return `<div class="hs-shop-line hs-shop-head">` +
            `<span class="hs-line-name"><span class="hs-line-meta">ITEM</span></span>` +
            `<span class="hs-line-meta">PAYOUT (50%)</span>` +
            `<span class="hs-line-action">SELL</span>` +
            `</div>`;
    },

    bindShopSellEvents() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('[data-shop-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.shopMode = btn.getAttribute('data-shop-mode') === 'sell' ? 'sell' : 'buy';
                this.statusMsg = '';
                if (this._navLevel !== 'tabs') this._navLevel = 'content';
                this.createUI();
            });
        });
        const bind = (attr, sell) => {
            this.overlay.querySelectorAll(`[${attr}]`).forEach((btn) => {
                btn.addEventListener('click', () => {
                    const res = sell(btn.getAttribute(attr) || '');
                    this.playButtonResult(btn, !!res.ok,
                        res.ok ? ('SOLD FOR ' + res.credits + ' CREDITS') : (res.reason || 'FAILED'));
                });
            });
        };
        bind('data-sell-ship', (id) => profileManager.sellShip(id));
        bind('data-sell-bp', (id) => profileManager.sellBlueprint(id));
        bind('data-sell-part', (raw) => {
            const sep = raw.indexOf(':');
            return profileManager.sellPart(raw.slice(0, sep), raw.slice(sep + 1));
        });
        bind('data-sell-style', (raw) => {
            const sep = raw.indexOf('|');
            return profileManager.sellStyle(raw.slice(0, sep), raw.slice(sep + 1));
        });
    },
});
