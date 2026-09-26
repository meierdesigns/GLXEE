"use strict";

// HomeStationUI methods: STYLES shop category (cosmetic style unlocks).
extendClass(HomeStationUI, {
    getStyleShopFilters() {
        const groups = (typeof profileManager !== 'undefined' && profileManager.getStyleGroups)
            ? profileManager.getStyleGroups()
            : [];
        return [{ id: 'all', label: 'ALL' }].concat(groups.map((g) => ({ id: g.id, label: g.label })));
    },

    /** Thumbnail canvas attributes for one style, reusing renderStyleThumbs. */
    styleShopThumbAttrs(groupId, styleId) {
        if (groupId === 'joint') return `data-thumb="joint" data-thumb-style="${styleId}"`;
        if (groupId.indexOf('skin:') === 0) {
            return `data-thumb="skin" data-thumb-kind="${groupId.slice(5)}" data-thumb-module="" data-thumb-skin="${styleId}"`;
        }
        const seg = groupId.slice(5);
        const area = seg === 'wing' ? 'wingRight' : seg;
        return `data-thumb="area" data-thumb-area="${area}" data-thumb-index="${styleId}"`;
    },

    /** Top-level cluster of a style group: hull parts, components, joints. */
    styleShopSection(groupId) {
        if (groupId.indexOf('hull:') === 0) return { id: 'hull', label: 'HULL PARTS' };
        if (groupId.indexOf('skin:') === 0) return { id: 'skin', label: 'COMPONENTS' };
        return { id: 'joint', label: 'CONNECTIONS' };
    },

    renderShopStyleRows(profile) {
        if (typeof profileManager === 'undefined' || !profileManager.getStyleGroups) return '';
        const wallet = profile.resources || {};
        const groups = profileManager.getStyleGroups()
            .filter((g) => this.shopFilter === 'all' || this.shopFilter === g.id);
        let html = '';
        let lastSection = '';
        groups.forEach((g) => {
            const all = profileManager.getStyleGroupEntries(g.id);
            let entries = [];
            all.forEach((style, index) => {
                const cost = profileManager.getStyleCost(index);
                if (!cost) return; // starter styles are always owned
                entries.push({
                    style: style,
                    cost: cost,
                    owned: profileManager.isStyleUnlocked(g.id, style.id, profile)
                });
            });
            if (!entries.length) return;
            // Sorting applies inside each group; TIER keeps the price steps.
            if (this.shopSort === 'cost') {
                entries.sort((a, b) => this.costTotal(a.cost) - this.costTotal(b.cost));
            } else if (this.shopSort === 'name') {
                entries.sort((a, b) => a.style.label.localeCompare(b.style.label));
            }
            const section = this.styleShopSection(g.id);
            if (section.id !== lastSection) {
                lastSection = section.id;
                html += `<div class="hs-style-shop-section">${section.label}</div>`;
            }
            const owned = all.filter((st) => profileManager.isStyleUnlocked(g.id, st.id, profile)).length;
            html += `<div class="hs-style-shop-group">` +
                `<span class="hs-chip-icon">${this.iconHtml(g.icon, 20, 'hs-pixel hs-pixel-20')}</span>` +
                `<strong>${g.label}</strong>` +
                `<span class="hs-style-shop-count">${owned}/${all.length} OWNED</span>` +
                `</div>`;
            html += entries.map((e) => {
                const key = `${g.id}|${e.style.id}`;
                const afford = this.canAffordCost(wallet, e.cost, profile);
                // Unaffordable stays focusable (like upgrades): the click explains why.
                const action = e.owned
                    ? '<span class="hs-muted hs-line-action">OWNED</span>'
                    : `<button class="action-button hs-line-action" data-buy-style="${key}"${afford ? '' : ' data-short="1"'}>UNLOCK</button>`;
                return `<div class="hs-line hs-shop-line hs-style-shop-line${e.owned ? ' is-owned' : ''}">` +
                    `<span class="hs-line-name">` +
                    `<span class="hs-style-shop-thumb"><canvas width="48" height="36" ${this.styleShopThumbAttrs(g.id, e.style.id)}></canvas></span>` +
                    `<span class="hs-line-text">` +
                    `<strong>${e.style.label}</strong>` +
                    `<span class="hs-line-meta">${g.label} STYLE · ${this.factionTagHtml('')}</span>` +
                    `</span></span>` +
                    (e.owned ? '<span></span>' : this.renderCostGrid(e.cost, wallet, profile)) +
                    action +
                    `</div>`;
            }).join('');
        });
        return html || '<p class="hs-muted hs-empty-slot">NO STYLES</p>';
    },

    bindShopStyleEvents() {
        if (!this.overlay) return;
        const list = this.overlay.querySelector('.hs-shop-list');
        if (list && this.shopCategory === 'styles' && this.renderStyleThumbs) this.renderStyleThumbs(list);
        this.overlay.querySelectorAll('[data-buy-style]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-buy-style') || '';
                const sep = raw.indexOf('|');
                const groupId = raw.slice(0, sep);
                const styleId = raw.slice(sep + 1);
                const res = profileManager.purchaseStyle(groupId, styleId);
                const label = (profileManager.getStyleGroupEntries(groupId)
                    .find((s) => s.id === styleId) || { label: styleId }).label;
                if (res.ok) {
                    this.playButtonResult(btn, true, 'STYLE UNLOCKED: ' + label);
                } else if (res.reason === 'RESOURCES') {
                    this.playButtonResult(btn, false, 'NOT ENOUGH CREDITS');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });
    },
});
