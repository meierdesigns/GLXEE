"use strict";

// StartScreenManager members, continued from create-main-menu-ui.js (kept under ~500 lines per file).
extendClass(StartScreenManager, {
    /** Start menu PROFILES page, shown inside the terminal screen. */
    createProfilesScreenUI(content) {
        const host = document.createElement('div');
        host.className = 'start-screen-profiles-host';
        content.appendChild(host);
        if (typeof profileSelectionManager === 'undefined') return;
        // The profile dialog itself, rendered inside the terminal screen.
        const createNew = !!this._profilesCreate;
        this._profilesCreate = false;
        profileSelectionManager.show({
            host,
            create: createNew,
            onClose: () => {
                this.showProfiles = false;
                const thenStart = this._profilesThenStart;
                this._profilesThenStart = false;
                if (thenStart && this.hasActiveProfile()) {
                    this.returnToHub();
                    return;
                }
                this.createStartScreenUI();
                if (typeof menuStateManager !== 'undefined') menuStateManager.setScreen('start');
            }
        });
    },
    openProfileCreate(factionId) {
        this.showProfiles = false;
        if (typeof profileSelectionManager === 'undefined') return;
        this.hideEmbedded();
        profileSelectionManager.show({
            onClose: () => {
                if (this.hasActiveProfile()) {
                    this.returnToHub();
                } else {
                    this.show({ forceMenu: true });
                }
            }
        });
        const ids = profileSelectionManager.getFactionIds ? profileSelectionManager.getFactionIds() : [];
        profileSelectionManager.mode = 'create';
        profileSelectionManager.createStep = 'faction';
        profileSelectionManager._heroDefaultName = '';
        profileSelectionManager.pendingFaction = (factionId && ids.indexOf(factionId) !== -1) ? factionId : ids[0];
        profileSelectionManager.createUI();
    },
    fillEmbeddedAssets(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section';

        const heading = document.createElement('h2');
        heading.className = 'hs-menu-panel-section-title';
        heading.textContent = 'ASSETS';
        panel.appendChild(heading);

        const status = document.createElement('p');
        status.className = 'hs-menu-panel-copy';
        status.dataset.assetStatus = '1';
        status.textContent = 'Bridge: …';
        panel.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'hs-menu-panel-actions';

        const mk = (label, opts) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'action-button hs-menu-panel-action';
            b.textContent = label;
            b.addEventListener('click', () => this.openAssetGenerator(opts));
            return b;
        };
        actions.appendChild(mk('OPEN GENERATOR', { returnToSettings: true }));
        actions.appendChild(mk('FACTIONS', { typeId: 'faction', returnToSettings: true }));
        actions.appendChild(mk('FACTION SHIPS', { typeId: 'faction', returnToSettings: true }));
        panel.appendChild(actions);
        body.appendChild(panel);

        this.refreshAssetBridgeStatus().then(() => {
            const item = this.settingsItems.find((s) => s.type === 'assetStatus');
            if (item && status.isConnected) {
                status.textContent = `Bridge: ${item.value}`;
                status.classList.toggle('settings-asset-ready', item.value === 'READY');
                status.classList.toggle('settings-asset-warn', /BRIDGE/.test(item.value));
                status.classList.toggle('settings-asset-off', item.value === 'OFFLINE');
            }
        });
    },
});
