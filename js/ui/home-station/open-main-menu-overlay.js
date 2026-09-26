"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    openMainMenuOverlay(opts) {
        const o = opts || {};
        if (typeof startScreenManager === 'undefined') return;
        const hasProfile = typeof profileManager !== 'undefined' && profileManager.hasActiveProfile();

        // Without profile: full start menu (not embedded in station).
        if (!hasProfile) {
            this.closeMenuTab(true);
            if (startScreenManager.isOverlayOpen()) {
                startScreenManager.hideOverlay();
            }
            this.hide();
            startScreenManager.show({
                forceMenu: true,
                showSettings: !!o.showSettings,
                showCredits: !!o.showCredits,
                skipPersist: !!o.skipPersist
            });
            return;
        }

        // With profile: menu is a tab inside the station modal (no separate overlay BG).
        if (this.tab === 'menu' && !o.force && !o.showSettings && !o.showCredits && !o.tab) {
            this.closeMenuTab();
            return;
        }
        // Opening / switching the menu always starts in the tab row.
        this._menuArmed = false;
        this._navLevel = 'tabs';
        if (this.tab === 'menu' && !o.force && o.tab && typeof startScreenManager !== 'undefined') {
            this._menuOpts = Object.assign({}, this._menuOpts || {}, { tab: o.tab });
            startScreenManager.embeddedMenuTab = o.tab;
            this.createUI();
            return;
        }
        if (this.tab !== 'menu') {
            this._prevTab = this.tab;
        }
        this.tab = 'menu';
        this._menuOpts = {
            tab: o.tab || null,
            showSettings: !!o.showSettings,
            showCredits: !!o.showCredits,
            resetPanels: !(o.showSettings || o.showCredits || o.tab),
            skipPersist: !!o.skipPersist
        };
        this.statusMsg = '';
        this.createUI();
    },

    closeMenuTab(silent) {
        const wasMenu = this.tab === 'menu';
        this.unmountMenuTab();
        this._menuOpts = null;
        if (!wasMenu && silent) return;
        if (wasMenu) {
            this.tab = (this._prevTab && this._prevTab !== 'menu') ? this._prevTab : 'station';
        }
        this._prevTab = null;
        if (!silent && wasMenu && this.isVisible) {
            this.createUI();
        }
    },

    mountMenuTab(opts) {
        const host = this.overlay && this.overlay.querySelector('#hsMenuHost');
        if (!host || typeof startScreenManager === 'undefined') return;
        const o = opts || this._menuOpts || {};
        startScreenManager.showEmbedded({
            host: host,
            tab: o.tab || null,
            showSettings: !!o.showSettings,
            showCredits: !!o.showCredits,
            resetPanels: o.resetPanels !== false && !(o.showSettings || o.showCredits || o.tab),
            skipPersist: !!o.skipPersist
        });
    },

    unmountMenuTab() {
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hideEmbedded();
        }
    },

    renderComponentsTab() {
        return `<div class="hs-section hs-panel hs-components-root">` +
            `${this.panelTitle('hsComponents', 'COMPONENTS')}` +
            `<div class="hs-components-host" id="hsComponentsHost"></div>` +
            `</div>`;
    },

    mountComponentsTab(opts) {
        const host = this.overlay && this.overlay.querySelector('#hsComponentsHost');
        if (!host || typeof componentEditorUI === 'undefined') return;
        const o = Object.assign({}, opts || {});
        if (!o.type && !o.id && typeof menuStateManager !== 'undefined') {
            const s = menuStateManager.get();
            if (s && s.componentType) o.type = s.componentType;
            if (s && s.componentId) o.id = s.componentId;
        }
        componentEditorUI.mount(host, o);
    },

    unmountComponentsTab() {
        if (typeof componentEditorUI !== 'undefined' && componentEditorUI.embedded) {
            componentEditorUI.unmount();
        }
    },

    openComponentEditorForModule(kind, modId) {
        let type = 'mount';
        let id = null;
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.resolveModuleShipSprite) {
            id = shipLoadoutManager.resolveModuleShipSprite({ kind: kind, id: modId });
        }
        if (!id) id = 'mount_' + String(modId || '');
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(id);
            if (hit) {
                type = hit.type;
                id = hit.id;
            }
        }
        if (typeof componentEditorUI === 'undefined') return;
        const stationOnClose = this.onClose;
        this.show({
            tab: 'components',
            onClose: stationOnClose
        });
        // Remount with selection after UI rebuild
        requestAnimationFrame(() => {
            if (typeof componentEditorUI !== 'undefined') {
                componentEditorUI.typeId = type;
                componentEditorUI.selectedId = id;
                if (componentEditorUI.root) componentEditorUI.refreshAll();
            }
        });
    },

    closeMainMenuOverlay() {
        this.unmountMenuTab();
        if (typeof startScreenManager !== 'undefined' && startScreenManager.isOverlayOpen()) {
            startScreenManager.hideOverlay();
        }
    },

    getProfile() {
        if (typeof profileManager === 'undefined') return null;
        const p = profileManager.getActiveProfile();
        if (p) profileManager.ensureEconomyDefaults(p);
        return p;
    },

    shipName(id) {
        if (typeof shipConfigManager !== 'undefined') {
            return shipConfigManager.getDisplayName(id);
        }
        return String(id || '').toUpperCase();
    },

    formatBagMap(map) {
        if (typeof economyConfig !== 'undefined') {
            return economyConfig.formatCost(map);
        }
        return Object.keys(map || {}).map((k) => (map[k] + ' ' + k)).join(' + ') || '—';
    },

    costTotal(map) {
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const weights = { scrap: 1, ore: 2, crystal: 3, voltex: 4 };
        let sum = Math.max(0, Math.round(Number((map && map.credits) || 0)));
        sum += ids.reduce((acc, id) => {
            const n = (map && map[id]) || 0;
            return acc + n * (weights[id] || 1);
        }, 0);
        return sum;
    },

    canAffordCredits(costMap, profile) {
        const need = Math.max(0, Math.round(Number((costMap && costMap.credits) || 0)));
        if (need <= 0) return true;
        if (typeof profileManager !== 'undefined' && profileManager.canAffordCredits) {
            return profileManager.canAffordCredits(need, profile);
        }
        return Math.max(0, Math.round(Number((profile && profile.credits) || 0))) >= need;
    },

    canAffordCost(wallet, costMap, profile) {
        const c = costMap || {};
        if (c.credits) {
            if (!this.canAffordCredits(c, profile || this.getProfile())) return false;
        }
        const materials = Object.assign({}, c);
        delete materials.credits;
        if (!Object.keys(materials).length) return true;
        if (typeof economyConfig !== 'undefined') {
            return economyConfig.canAfford(wallet, materials);
        }
        const w = wallet || {};
        return Object.keys(materials).every((id) => (w[id] || 0) >= (materials[id] || 0));
    },

    renderCostGrid(costMap, wallet, profile) {
        const cells = [];
        const creditNeed = Math.max(0, Math.round(Number((costMap && costMap.credits) || 0)));
        if (creditNeed > 0) {
            const have = (typeof profileManager !== 'undefined' && profileManager.getCredits)
                ? profileManager.getCredits(profile || this.getProfile())
                : Math.max(0, Math.round(Number(((profile || this.getProfile()) || {}).credits) || 0));
            const short = have < creditNeed;
            const missing = short ? (creditNeed - have) : 0;
            cells.push(
                `<span class="hs-cost-cell hs-res-credits${short ? ' hs-cost-short' : ''}" title="${short ? ('NEED ' + missing) : 'CREDITS'}">` +
                `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey('credits'), 20, 'hs-pixel hs-pixel-20')}</span>` +
                `<span class="hs-cost-amt"${short ? ` data-need="−${missing}"` : ''}>${creditNeed}</span>` +
                `</span>`
            );
        }
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const hasMaterials = ids.some((id) => ((costMap && costMap[id]) || 0) > 0);
        if (hasMaterials || creditNeed <= 0) {
            ids.forEach((id) => {
                const n = (costMap && costMap[id]) || 0;
                const have = (wallet && wallet[id]) || 0;
                const empty = n <= 0;
                const short = !empty && have < n;
                const missing = short ? (n - have) : 0;
                const classes = [
                    'hs-cost-cell',
                    'hs-res-' + id,
                    empty ? 'hs-cost-empty' : '',
                    short ? 'hs-cost-short' : ''
                ].filter(Boolean).join(' ');
                const amt = empty ? '—' : String(n);
                const title = empty
                    ? String(id).toUpperCase()
                    : (short ? `NEED ${missing}` : String(id).toUpperCase());
                const needAttr = short ? ` data-need="−${missing}"` : '';
                cells.push(
                    `<span class="${classes}" title="${title}">` +
                    `<span class="hs-cost-icon">${this.iconHtml(this.resourceIconKey(id), 20, 'hs-pixel hs-pixel-20')}</span>` +
                    `<span class="hs-cost-amt"${needAttr}>${amt}</span>` +
                    `</span>`
                );
            });
        }
        return `<span class="hs-cost-grid">${cells.join('')}</span>`;
    },
});
