"use strict";

// StartScreenManager methods, split from start-screen.js.
extendClass(StartScreenManager, {
    createMainMenuUI(content) {
        content.classList.add('start-screen-retro');
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
                    // Big chunky variant where one exists, shown at 64 px.
                    const hdKey = { hsStation: 'menuStationHd', menuProfiles: 'menuProfilesHd', menuSettings: 'menuSettingsHd', menuCredits: 'menuCreditsHd' }[iconKey];
                    const hd = hdKey && typeof IconSprites !== 'undefined' && IconSprites[hdKey];
                    iconWrap.innerHTML = iconRenderer.imgHtml(hd ? hdKey : iconKey, hd ? 64 : 48, 'menu-pixel-icon');
                }

                const text = document.createElement('span');
                text.className = 'menu-item-text';
                const label = document.createElement('span');
                label.className = 'menu-item-label';
                label.textContent = entry.label || itemId;
                text.appendChild(label);
                // Description lives in the tooltip, not as a subline
                if (entry.desc) menuItem.dataset.uiTip = entry.desc;

                menuItem.appendChild(iconWrap);
                menuItem.appendChild(text);
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
        // Menu on the left, recent-pilots scoreboard on the right.
        const menuRow = document.createElement('div');
        menuRow.className = 'start-menu-row';
        menuRow.appendChild(menu);
        const board = this.buildRecentPilotsBoard();
        if (board) menuRow.appendChild(board);
        content.appendChild(menuRow);
        content.appendChild(instructions);
        const utilRow = document.createElement('div');
        utilRow.className = 'ui-menu-util-row';
        utilRow.appendChild(this.buildControlsShowBtn());
        utilRow.appendChild(this.buildIntroBtn());
        content.appendChild(utilRow);
        // Dev hint lives in the hover row; the DEV MODE ON badge stays visible
        if (this.devMode) content.appendChild(footer);
        else utilRow.appendChild(footer);
    },

    /** Top-5 style scoreboard of the last five played profiles. */
    buildRecentPilotsBoard() {
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        if (!pm || !pm.getRecentProfiles) return null;
        // Last five played, ranked by score like an arcade top 5.
        const recent = pm.getRecentProfiles(5)
            .map((p) => ({ p, score: pm.getProfileScore(p) }))
            .sort((a, b) => b.score - a.score);
        const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const activeId = pm.hasActiveProfile() ? pm.getActiveProfile().id : null;
        const board = document.createElement('div');
        board.className = 'start-scoreboard';
        const rows = recent.map(({ p, score: raw }, i) => {
            const faction = String(p.faction || 'pirate');
            const emblem = typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
                ? profileSelectionManager.getFactionEmblemHtml(faction, 24) : '';
            const score = raw.toLocaleString('en-US');
            return `<li class="start-scoreboard-row is-pickable${p.id === activeId ? ' is-active' : ''}" data-profile-id="${esc(p.id)}" tabindex="0" role="button" data-ui-tip="${p.id === activeId ? 'Active pilot' : 'Select pilot'}">` +
                `<span class="start-scoreboard-rank">${i + 1}</span>` +
                `<span class="start-scoreboard-emblem">${emblem}</span>` +
                `<span class="start-scoreboard-name">${esc(p.name)}</span>` +
                `<span class="start-scoreboard-score">${score}</span>` +
                '</li>';
        }).join('') + Array.from({ length: Math.max(0, 5 - recent.length) }, (_, k) =>
            '<li class="start-scoreboard-row is-empty">' +
            `<span class="start-scoreboard-rank">${recent.length + k + 1}</span>` +
            '<span class="start-scoreboard-emblem"></span>' +
            '<span class="start-scoreboard-name">---</span>' +
            '<span class="start-scoreboard-score">0</span>' +
            '</li>').join('');
        board.innerHTML =
            '<div class="start-scoreboard-title">RECENT PILOTS</div>' +
            '<div class="start-scoreboard-head"><span>#</span><span></span><span>NAME</span><span>SCORE</span></div>' +
            `<ol class="start-scoreboard-list">${rows}</ol>`;
        // Picking a row only selects the pilot; START launches with it.
        board.querySelectorAll('.start-scoreboard-row.is-pickable').forEach((row) => {
            const pick = () => {
                const id = row.getAttribute('data-profile-id');
                if (id === activeId) return;
                pm.setActive(id);
                this.createStartScreenUI();
            };
            row.addEventListener('click', pick);
            row.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                pick();
            });
        });
        return board;
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
        // The station top bar already shows these tabs (renderMenuTabs);
        // only build the in-panel copy when no station bar hosts the menu.
        const stationHostsTabs = typeof homeStationUI !== 'undefined' && homeStationUI.isVisible;
        if (!stationHostsTabs) header.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'hs-menu-panel-body';
        if (this.embeddedMenuTab === 'profiles') {
            this.fillEmbeddedProfiles(body);
        } else if (this.embeddedMenuTab === 'settings' || this.embeddedMenuTab === 'assets') {
            this.createSettingsUI(body, { bare: true });
        } else if (this.embeddedMenuTab === 'assets') {
            this.fillEmbeddedAssets(body);
        } else if (this.embeddedMenuTab === 'layout' && this.fillEmbeddedLayout) {
            this.fillEmbeddedLayout(body);
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
        const utilRow = document.createElement('div');
        utilRow.className = 'ui-menu-util-row';
        utilRow.appendChild(this.buildControlsShowBtn());
        utilRow.appendChild(this.buildIntroBtn());
        content.appendChild(utilRow);
        // Dev hint lives in the hover row; the DEV MODE ON badge stays visible
        if (this.devMode) content.appendChild(footer);
        else utilRow.appendChild(footer);
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

        // Profiles listed right here — pick one to switch pilots.
        if (typeof profileManager !== 'undefined' && profileManager.getProfiles) {
            const activeId = profileManager.hasActiveProfile() ? profileManager.getActiveProfile().id : null;
            const profiles = profileManager.getProfiles();
            const factions = (typeof factionManager !== 'undefined' && factionManager.getFactionIds)
                ? factionManager.getFactionIds().slice() : [];
            profiles.forEach((p) => {
                const f = p.faction || 'pirate';
                if (factions.indexOf(f) === -1) factions.push(f);
            });
            if (this._profileFactionFilter && factions.indexOf(this._profileFactionFilter) === -1) {
                this._profileFactionFilter = null;
            }
            const list = document.createElement('div');
            list.className = 'hs-menu-profile-list';
            let applyFilter = () => {
                const f = this._profileFactionFilter;
                list.querySelectorAll('.hs-menu-profile-row').forEach((row) => {
                    row.hidden = !!f && row.getAttribute('data-faction') !== f;
                });
                filterBar.querySelectorAll('[data-profile-filter]').forEach((b) => {
                    const on = b.getAttribute('data-profile-filter') === (f || '');
                    b.classList.toggle('is-active', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
            };
            const filterBar = document.createElement('div');
            filterBar.className = 'hs-menu-profile-filters';
            filterBar.setAttribute('role', 'group');
            filterBar.setAttribute('aria-label', 'Filter by faction');
            ['', ...factions].forEach((f) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'hs-menu-profile-filter';
                b.setAttribute('data-profile-filter', f);
                const count = f ? profiles.filter((p) => (p.faction || 'pirate') === f).length : profiles.length;
                const emblem = f && typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
                    ? profileSelectionManager.getFactionEmblemHtml(f, 24)
                    : '';
                b.innerHTML = emblem ? `<span class="hs-menu-profile-filter-ico">${emblem}</span>` : '';
                b.appendChild(document.createTextNode(f ? f.toUpperCase() : 'ALL'));
                if (!count) b.classList.add('is-empty');
                if (f && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
                    const st = factionShipStyles.getFactionStyle(f);
                    if (st && st.accent) b.style.setProperty('--row-accent', st.accent);
                }
                b.addEventListener('click', () => {
                    this._profileFactionFilter = f || null;
                    applyFilter();
                });
                filterBar.appendChild(b);
            });
            const createBtn = document.createElement('button');
            createBtn.type = 'button';
            createBtn.className = 'hs-menu-profile-filter hs-menu-profile-create';
            createBtn.innerHTML = '<svg class="hs-menu-profile-act-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg>CREATE PROFILE';
            createBtn.addEventListener('click', () => this.openProfileCreate(this._profileFactionFilter));
            filterBar.appendChild(createBtn);
            panel.appendChild(filterBar);
            let pinned = null;
            // Redraw after switch / delete; with no pilot left, back to the start menu.
            const rerender = () => {
                if (!profileManager.hasActiveProfile()) {
                    if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) homeStationUI.hide();
                    if (this.hideEmbedded) this.hideEmbedded();
                    this.show({ forceMenu: true });
                    return;
                }
                if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) {
                    homeStationUI.createUI();
                    if (homeStationUI._menuArmed && this.focusEmbeddedButtons) this.focusEmbeddedButtons();
                } else {
                    this.createStartScreenUI();
                }
            };
            profiles.forEach((p) => {
                const faction = p.faction || 'pirate';
                // Row = div (it holds its own SWITCH / DELETE buttons).
                const row = document.createElement('div');
                row.tabIndex = 0;
                row.setAttribute('role', 'button');
                row.className = 'hs-menu-profile-row' + (p.id === activeId ? ' is-active' : '');
                row.setAttribute('data-faction', faction);
                if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
                    const st = factionShipStyles.getFactionStyle(faction);
                    if (st && st.accent) row.style.setProperty('--row-accent', st.accent);
                }
                const emblem = (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml)
                    ? profileSelectionManager.getFactionEmblemHtml(faction, 32) : '';
                const icoSwitch = '<svg class="hs-menu-profile-act-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3"/></svg>';
                const icoDelete = '<svg class="hs-menu-profile-act-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10M7 7v4M9 7v4"/></svg>';
                const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                row.innerHTML =
                    `<span class="hs-menu-profile-emblem">${emblem}</span>` +
                    `<span class="hs-menu-profile-name">${esc(p.name)}</span>` +
                    `<span class="hs-menu-profile-faction">${esc(faction.toUpperCase())}</span>` +
                    // Badge cell always present (empty when inactive) so the actions keep their column.
                    (p.id === activeId ? '<span class="hs-menu-profile-badge">ACTIVE</span>' : '<span class="hs-menu-profile-badge-slot"></span>') +
                    `<span class="hs-menu-profile-actions">` +
                    (p.id === activeId ? '' : `<button type="button" class="hs-menu-profile-act" data-profile-switch="${esc(p.id)}">${icoSwitch}<span class="hs-menu-profile-act-label">SWITCH</span></button>`) +
                    `<button type="button" class="hs-menu-profile-act is-danger" data-profile-delete="${esc(p.id)}">${icoDelete}<span class="hs-menu-profile-act-label">DELETE</span></button>` +
                    `</span>`;
                row.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.target === row) row.click();
                });
                // Row click only shows this pilot's details; switching is explicit.
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.hs-menu-profile-act')) return;
                    pinned = p;
                    renderStats(p);
                });
                const switchBtn = row.querySelector('[data-profile-switch]');
                if (switchBtn) {
                    switchBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        profileManager.setActive(p.id);
                        rerender();
                    });
                }
                const delBtn = row.querySelector('[data-profile-delete]');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Two-step: first click arms, second (within 3 s) deletes.
                    if (!delBtn.classList.contains('is-armed')) {
                        delBtn.classList.add('is-armed');
                        delBtn.querySelector('.hs-menu-profile-act-label').textContent = 'CONFIRM?';
                        clearTimeout(delBtn._disarm);
                        delBtn._disarm = setTimeout(() => {
                            delBtn.classList.remove('is-armed');
                            delBtn.querySelector('.hs-menu-profile-act-label').textContent = 'DELETE';
                        }, 3000);
                        return;
                    }
                    clearTimeout(delBtn._disarm);
                    profileManager.delete(p.id);
                    rerender();
                });
                list.appendChild(row);
            });
            const renderStats = (profile) => {
                if (typeof profileSelectionManager === 'undefined' || !profileSelectionManager.renderProfileDetails) return;
                stats.innerHTML = profileSelectionManager.renderProfileDetails(profile || null);
                if (profile && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
                    const st = factionShipStyles.getFactionStyle(profile.faction || 'pirate');
                    if (st && st.accent) stats.style.setProperty('--row-accent', st.accent);
                }
            };
            // No pilot active yet: preview the first one instead of an empty panel.
            const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0] || null;
            list.querySelectorAll('.hs-menu-profile-row').forEach((row, i) => {
                const show = () => renderStats(profiles[i]);
                row.addEventListener('mouseenter', show);
                row.addEventListener('focus', show);
            });
            list.addEventListener('mouseleave', () => renderStats(pinned || activeProfile));
            const split = document.createElement('div');
            split.className = 'hs-menu-profile-split';
            const left = document.createElement('div');
            left.className = 'hs-menu-profile-col';
            const stats = document.createElement('aside');
            stats.className = 'profile-details hs-menu-profile-stats';
            const empty = document.createElement('p');
            empty.className = 'hs-menu-panel-copy hs-menu-profile-empty';
            empty.textContent = 'No pilots in this faction.';
            left.appendChild(list);
            left.appendChild(empty);
            split.appendChild(left);
            split.appendChild(stats);
            panel.appendChild(split);
            renderStats(activeProfile);
            const baseApply = applyFilter;
            applyFilter = () => {
                baseApply();
                empty.hidden = !!list.querySelector('.hs-menu-profile-row:not([hidden])');
            };
            applyFilter();
        }

        body.appendChild(panel);
    },

    /** Start menu PROFILES page, shown inside the terminal screen. */
    createProfilesScreenUI(content) {
        const host = document.createElement('div');
        host.className = 'start-screen-profiles-host';
        content.appendChild(host);
        if (typeof profileSelectionManager === 'undefined') return;
        // The profile dialog itself, rendered inside the terminal screen.
        profileSelectionManager.show({
            host,
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
