"use strict";

// HomeStationUI methods: docking at a galaxy trading post. While docked the
// SHOP tab shows that post's own categories (parts = its mixed-faction
// stock) instead of the home station catalog. The first dock unlocks the
// trader: its categories are sold at the home station from then on.
// Leaving the shop tab or UNDOCK ends the visit.
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
        const cats = post.categories || ['resources', 'parts'];
        // Open on the trader's specialty rather than the shared resource market.
        this.shopCategory = cats.find((c) => c !== 'resources') || 'resources';
        const isNew = typeof profileManager !== 'undefined' && profileManager.unlockTrader
            && profileManager.unlockTrader(post.id);
        this.shopFilter = 'all';
        this.tab = 'shop';
        this._navLevel = 'content';
        this.focusIndex = 0;
        this.statusMsg = 'DOCKED AT ' + post.name + (isNew ? ' · TRADER UNLOCKED AT HOME STATION' : '');
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

    /** Parts hint while docked: where the post is and whose stock it carries. */
    renderTradingPostHint(post) {
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
        return `<p class="hs-muted hs-hint">Orbiting ${where}. Stock from ${factions.join(' · ')} — parts are refitted in your faction colours and mix freely on any ship.</p>`;
    },

    bindTradingPostEvents() {
        const undock = this.overlay && this.overlay.querySelector('#hsUndock');
        if (undock) undock.addEventListener('click', () => this.undockTradingPost());
    },
});
