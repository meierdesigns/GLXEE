"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    createMainMenuUI(content) {
        this.rebuildVisibleMenu();
        if (this.selectedIndex >= this.menuItems.length) {
            this.selectedIndex = Math.max(0, this.menuItems.length - 1);
        }

        const title = document.createElement('h1');
        title.textContent = 'GLXEE';
        title.className = 'start-screen-title';
        
        const subtitle = document.createElement('p');
        subtitle.textContent = 'RETRO SPACE SHOOTER';
        subtitle.className = 'start-screen-subtitle';

        const profileLine = document.createElement('p');
        profileLine.className = 'start-screen-profile';
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const p = profileManager.getActiveProfile();
            profileLine.textContent = `PROFILE: ${p.name}`;
        } else {
            profileLine.textContent = 'PROFILE: NONE';
            profileLine.classList.add('no-profile');
        }

        const menu = document.createElement('div');
        menu.className = 'start-screen-menu start-screen-menu-clustered';

        let flatIndex = 0;
        this.visibleMenuClusters.forEach((cluster) => {
            const group = document.createElement('div');
            group.className = 'menu-cluster';
            group.dataset.cluster = cluster.id;

            if (cluster.label) {
                const header = document.createElement('div');
                header.className = 'menu-cluster-title';
                header.textContent = cluster.label;
                group.appendChild(header);
            }

            cluster.items.forEach((entry) => {
                const index = flatIndex;
                flatIndex += 1;
                const itemId = entry.id;
                const menuItem = document.createElement('div');
                const primaryClass = entry.primary ? ' menu-item-primary' : '';
                menuItem.className = `menu-item${primaryClass}${index === this.selectedIndex ? ' selected' : ''}`;
                menuItem.dataset.menuIndex = String(index);
                menuItem.dataset.cluster = cluster.id;

                const iconWrap = document.createElement('span');
                iconWrap.className = 'menu-item-icon';
                const iconKey = entry.icon || this.menuIconById[itemId];
                if (typeof iconRenderer !== 'undefined' && iconKey) {
                    iconWrap.innerHTML = iconRenderer.imgHtml(iconKey, 32, 'menu-pixel-icon');
                }

                const label = document.createElement('span');
                label.className = 'menu-item-label';
                label.textContent = entry.label || itemId;

                menuItem.appendChild(iconWrap);
                menuItem.appendChild(label);
                menuItem.addEventListener('mouseenter', () => {
                    this.selectedIndex = index;
                    this.updateMenuSelection();
                });
                menuItem.addEventListener('click', () => {
                    this.selectedIndex = index;
                    this.updateMenuSelection();
                    this.selectMenuItem();
                });
                group.appendChild(menuItem);
            });

            menu.appendChild(group);
        });

        const instructions = this.buildControlsHint([
            'ARROW KEYS / MOUSE: Navigate',
            'SPACEBAR / CLICK: Select'
        ]);

        const footer = document.createElement('div');
        footer.className = 'start-screen-footer';
        if (this.devMode) {
            footer.innerHTML =
                '<span class="dev-mode-badge">DEV MODE ON</span>' +
                '<span class="dev-mode-hint">SHIFT+C TOGGLE</span>' +
                '<span class="dev-mode-hint-block">' +
                'ARCHIVE: K Know/Forget • B Build/Unbuild • V Visit/Unvisit • C Clear/Unclear' +
                '</span>';
        } else {
            footer.innerHTML = '<span class="dev-mode-hint">SHIFT+C DEV MODE</span>';
        }

        content.appendChild(title);
        content.appendChild(subtitle);
        content.appendChild(profileLine);
        content.appendChild(menu);
        content.appendChild(instructions);
        content.appendChild(this.buildControlsShowBtn());
        content.appendChild(footer);
    },

    createEmbeddedMenuUI(content) {
        this.syncEmbeddedFlags();

        const header = document.createElement('div');
        header.className = 'hs-menu-panel-header';

        const brand = document.createElement('div');
        brand.className = 'hs-menu-panel-brand';
        const title = document.createElement('h1');
        title.className = 'start-screen-title hs-menu-panel-title';
        title.textContent = 'GLXEE';
        const profileLine = document.createElement('p');
        profileLine.className = 'start-screen-profile hs-menu-panel-profile';
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const p = profileManager.getActiveProfile();
            profileLine.textContent = `PROFILE: ${p.name}`;
        } else {
            profileLine.textContent = 'PROFILE: NONE';
            profileLine.classList.add('no-profile');
        }
        brand.appendChild(title);
        brand.appendChild(profileLine);
        header.appendChild(brand);

        const tabs = document.createElement('div');
        tabs.className = 'hs-menu-panel-tabs';
        this.embeddedMenuTabs.forEach((tab) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'hs-menu-panel-tab' + (tab.id === this.embeddedMenuTab ? ' active' : '');
            btn.dataset.menuTab = tab.id;
            const iconWrap = document.createElement('span');
            iconWrap.className = 'hs-menu-panel-tab-icon';
            if (typeof iconRenderer !== 'undefined' && tab.icon) {
                iconWrap.innerHTML = iconRenderer.imgHtml(tab.icon, 28, 'menu-pixel-icon');
            }
            const label = document.createElement('span');
            label.className = 'hs-menu-panel-tab-label';
            label.textContent = tab.label;
            btn.appendChild(iconWrap);
            btn.appendChild(label);
            btn.addEventListener('click', () => this.setEmbeddedMenuTab(tab.id));
            tabs.appendChild(btn);
        });
        header.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'hs-menu-panel-body';
        if (this.embeddedMenuTab === 'profiles') {
            this.fillEmbeddedProfiles(body);
        } else if (this.embeddedMenuTab === 'settings') {
            this.createSettingsUI(body, { bare: true });
        } else if (this.embeddedMenuTab === 'assets') {
            this.fillEmbeddedAssets(body);
        } else {
            body.classList.add('hs-menu-panel-body-credits');
            this.fillEmbeddedCredits(body);
        }

        const footer = document.createElement('div');
        footer.className = 'start-screen-footer hs-menu-panel-footer';
        footer.innerHTML = this.devMode
            ? '<span class="dev-mode-badge">DEV MODE ON</span><span class="dev-mode-hint">SHIFT+C TOGGLE</span>'
            : '<span class="dev-mode-hint">SHIFT+C DEV MODE</span>';

        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(this.buildControlsShowBtn());
        content.appendChild(footer);
    },

    fillEmbeddedProfiles(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section';

        const heading = document.createElement('h2');
        heading.className = 'hs-menu-panel-section-title';
        heading.textContent = 'PROFILES';
        panel.appendChild(heading);

        const active = document.createElement('p');
        active.className = 'hs-menu-panel-copy';
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const p = profileManager.getActiveProfile();
            active.textContent = `Active pilot: ${p.name}`;
        } else {
            active.textContent = 'No profile loaded.';
        }
        panel.appendChild(active);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-button hs-menu-panel-action';
        btn.textContent = 'MANAGE PROFILES';
        btn.addEventListener('click', () => {
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
        });
        panel.appendChild(btn);
        body.appendChild(panel);
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
