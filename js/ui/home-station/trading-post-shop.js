"use strict";

// HomeStationUI methods: docking at a galaxy trading post. While docked the
// SHOP tab shows that post's own stock (mixed factions) instead of the
// home station catalog; leaving the shop tab or UNDOCK ends the visit.
extendClass(HomeStationUI, {
    getVisitedTradingPost() {
        if (!this.visitPostId || this.tab !== 'shop' || typeof profileManager === 'undefined') return null;
        const post = profileManager.getTradingPost(this.visitPostId);
        return post && profileManager.isTradingPostUnlocked(post) ? post : null;
    },

    openTradingPost(post) {
        if (!post) return;
        this.exitPlayMap();
        this.visitPostId = post.id;
        this._shopCategoryBeforeDock = this.shopCategory;
        this.shopCategory = 'parts';
        this.shopFilter = 'all';
        this.tab = 'shop';
        this._navLevel = 'content';
        this.focusIndex = 0;
        this.statusMsg = 'DOCKED AT ' + post.name;
        this.createUI();
    },

    undockTradingPost() {
        this.visitPostId = null;
        if (this._shopCategoryBeforeDock) this.shopCategory = this._shopCategoryBeforeDock;
        this._shopCategoryBeforeDock = null;
        this.tab = 'play';
        this._navLevel = 'tabs';
        this.statusMsg = '';
        this.persistTab();
        this.createUI();
    },

    renderTradingPostShop(profile) {
        const post = this.getVisitedTradingPost();
        const stock = profileManager.getTradingPostStock(post);
        const factions = [];
        stock.forEach((e) => {
            const f = (e.faction || 'neutral').toUpperCase();
            if (factions.indexOf(f) === -1) factions.push(f);
        });
        const planet = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig)
            ? planetConfigManager.getConfig(post.planetId)
            : null;
        const where = String((planet && planet.name) || post.planetId).toUpperCase();
        return `<div class="hs-section hs-panel hs-shop-root hs-trading-post">` +
            `${this.renderShopWalletBar(profile)}` +
            `<div class="hs-shop-cats">` +
            `<button type="button" class="hs-shop-cat" id="hsUndock" data-nav-item>` +
            `<span class="hs-chip-icon">${this.iconHtml('hsStation', 32, 'hs-pixel')}</span><span>← UNDOCK</span></button>` +
            `</div>` +
            `${this.panelTitle('hsShop', post.name + ' TRADING POST')}` +
            `<p class="hs-muted hs-hint">Orbiting ${where}. Stock from ${factions.join(' · ')} — parts are refitted in your faction colours and mix freely on any ship.</p>` +
            `${this.renderShopToolbar()}` +
            `<div class="hs-tab-fill hs-shop-list">` +
            `${this.renderShopCostHeader()}` +
            `${this.renderShopPartRows(profile) || '<p class="hs-muted hs-empty-slot">SOLD OUT</p>'}` +
            `</div></div>`;
    },

    bindTradingPostEvents() {
        const undock = this.overlay && this.overlay.querySelector('#hsUndock');
        if (undock) undock.addEventListener('click', () => this.undockTradingPost());
    },
});
