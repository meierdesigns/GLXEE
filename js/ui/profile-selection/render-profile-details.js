"use strict";

// ProfileSelectionManager methods, split from profile-selection.js.
extendClass(ProfileSelectionManager, {
    renderProfileDetails(profile) {
        if (!profile) {
            return '<div class="profile-details-empty">SELECT OR CREATE A PROFILE</div>';
        }
        if (typeof profileManager !== 'undefined') {
            profileManager.ensureEconomyDefaults(profile);
        }

        const stationGid = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : ((profile.homeStation && profile.homeStation.currentGalaxyId) || 'milky_way');
        const progressRows = this.getProfileProgressSummary(profile);
        const clearedTotal = progressRows.reduce((s, r) => s + r.cleared, 0);
        const planetTotal = progressRows.reduce((s, r) => s + (r.total || 0), 0);

        const resIds = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const resources = profile.resources || {};
        // Credits + every resource the profile holds (incl. ones outside the base list), with icons.
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number(profile.credits) || 0));
        const allRes = ['credits'].concat(resIds,
            Object.keys(resources).filter((id) => resIds.indexOf(id) === -1 && id !== 'credits'));
        const ico = (key, size) => (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml
            ? iconRenderer.imgHtml(key, size, 'hs-pixel') : '');
        const resIcon = (id, size) => {
            const key = typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey
                ? homeStationUI.resourceIconKey(id) : null;
            return key ? ico(key, size) : '';
        };
        const ships = profile.ownedShipIds || [];
        const activeShip = profile.activeShipId;
        const fmt = (n) => Number(n).toLocaleString('en-US');

        // Big stat tiles: icon on the left, big number, small caption.
        const tile = (iconHtml, value, caption, cls) =>
            `<div class="pd-tile ${cls || ''}"><span class="pd-tile-icon">${iconHtml}</span>` +
            `<span class="pd-tile-text"><b class="pd-tile-value">${value}</b>${caption ? `<i class="pd-tile-cap">${caption}</i>` : ''}</span></div>`;

        // Per-galaxy progress as chunky cell bars (one cell per planet).
        const bar = (r) => {
            let cells = '';
            if (r.slots && r.slots.length) {
                // Visited galaxy: one slot per planet, in the ruling faction's colour.
                cells = r.slots.map((sl) => `<i class="${sl.state === 'cleared' ? 'on' : (sl.state === 'open' ? 'open' : 'locked')}"` +
                    `${sl.color ? ` style="--gx:${sl.color}"` : ''} title="${String(sl.faction || '').toUpperCase()}"></i>`).join('');
            } else {
                const n = Math.max(0, Math.min(r.total || 0, 14));
                for (let i = 0; i < n; i++) cells += '<i></i>';
            }
            return `<span class="pd-bar">${cells}</span>`;
        };

        const knownOnly = this._pdKnownOnly !== false;
        const px = (d) => `<svg viewBox="0 0 16 16" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill-rule="evenodd" fill="currentColor" d="${d}"/></svg>`;
        const EYE_ON = px('M5 4h6v1h2v1h2v4h-2v1h-2v1H5v-1H3v-1H1V6h2V5h2zM6 6v4h4V6zM7 7h2v2H7z');
        const EYE_OFF = px('M5 4h6v1h2v1h2v4h-2v1h-2v1H5v-1H3v-1H1V6h2V5h2zM2 12l1 1 11-11-1-1z');
        if (!ProfileSelectionManager._pdKnownBound) {
            ProfileSelectionManager._pdKnownBound = true;
            document.addEventListener('click', (e) => {
                const b = e.target.closest && e.target.closest('[data-pd-known-toggle]');
                if (!b) return;
                e.preventDefault();
                e.stopPropagation();
                const m = window.profileSelectionManager;
                if (!m) return;
                m._pdKnownOnly = m._pdKnownOnly === false;
                m.refreshDetails();
            }, true);
        }

        const btnIco = (kind) => (typeof ProfileSelectionManager !== 'undefined' && ProfileSelectionManager.btnIconHtml
            ? ProfileSelectionManager.btnIconHtml(kind) : '');
        return `
            <div class="pd-hero">
                <span class="pd-hero-face${profile.portrait && typeof heroPortrait !== 'undefined' ? ' has-portrait' : ''}">
                    ${profile.portrait && typeof heroPortrait !== 'undefined' ? `<span class="pd-hero-portrait">${heroPortrait.html(profile.portrait, null)}</span>` : ''}
                    <span class="pd-hero-emblem">${this.getFactionEmblemHtml(profile.faction || 'pirate', 28)}</span>
                </span>
                <span class="pd-hero-text">
                    <b class="pd-hero-name">${profile.name}</b>
                    <i class="pd-hero-faction">${this.getFactionLabel(profile.faction || 'pirate')}</i>
                </span>
                <span class="pd-hero-actions">
                    <button type="button" class="pd-hero-btn" id="psRename" data-pd-act="rename" title="Rename">${btnIco('rename')}<span>RENAME</span></button>
                    <button type="button" class="pd-hero-btn is-danger" id="psDelete" data-pd-act="delete" title="Delete">${btnIco('delete')}<span>DELETE</span></button>
                </span>
            </div>
            <div class="pd-scroll">
            <div class="pd-tiles">
                ${tile(ico('hsStation', 32), this.galaxyName(stationGid), 'STATION', 'is-wide')}
                ${tile(ico('menuPlanets', 32), `${clearedTotal}/${planetTotal || '?'}`, '')}
                ${tile(ico('menuShips', 32), ships.length, '')}
            </div>
            <div class="pd-block-title">${resIcon('credits', 20)}RESOURCES</div>
            <div class="pd-res">
                ${allRes.map((id) => `
                    <div class="pd-res-item hs-res-${id}" title="${id === 'credits' ? 'CREDITS' : this.resourceLabel(id)}">
                        <span class="pd-res-icon">${resIcon(id, 28)}</span>
                        <b class="pd-res-value">${fmt(id === 'credits' ? credits : (Math.round(Number(resources[id]) || 0)))}</b>
                    </div>
                `).join('')}
            </div>
            <div class="pd-block-title">${ico('menuShips', 20)}SHIPS</div>
            <div class="pd-ships">
                ${ships.length ? ships.map((id) => `
                    <span class="pd-ship ${id === activeShip ? 'is-active' : ''}">${ico('menuShips', 20)}${this.shipName(id)}</span>
                `).join('') : '<span class="pd-ship">NONE</span>'}
            </div>
            <div class="pd-block-title">${ico('menuPlanets', 20)}GALAXIES
                <button type="button" class="pd-known-toggle${knownOnly ? ' is-on' : ''}" data-pd-known-toggle
                    title="${knownOnly ? 'Showing known galaxies only — click to show all' : 'Showing all galaxies — click to show only known'}"
                    aria-label="Toggle known galaxies only" aria-pressed="${knownOnly}">${knownOnly ? EYE_ON : EYE_OFF}</button>
            </div>
            <div class="pd-galaxies">
                ${progressRows.filter((r) => !knownOnly || r.visited).map((r) => {
                    const here = r.id === stationGid;
                    const gm = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml ? galaxyMapManager : null;
                    const planet = gm && r.currentPlanetId && r.visited ? gm.planetIconHtml(r.currentPlanetId, 40, true) : ico('menuPlanets', 32);
                    return `
                    <div class="pd-galaxy ${here ? 'is-station' : ''}${r.visited ? '' : ' is-unvisited'}"${r.color ? ` style="--gx:${r.color}"` : ''} title="${r.name}${here ? ' — you are here' : ''}">
                        <span class="pd-galaxy-planet">${planet}</span>
                        <span class="pd-galaxy-name">${r.name}</span>
                        <span class="pd-galaxy-count">${here ? ico('hsStation', 20) : ''}${r.label}</span>
                        ${bar(r)}
                    </div>`;
                }).join('')}
            </div>
            </div>
        `;
    },

    refreshDetails() {
        const pane = this.overlay && this.overlay.querySelector('#profileDetails');
        if (!pane) return;
        const profiles = this.getProfiles();
        const selected = this._noVisibleProfile ? null : (profiles[this.selectedIndex] || null);
        pane.innerHTML = this._noVisibleProfile
            ? '<div class="profile-details-empty">NO PROFILE FOR THIS FACTION</div>'
            : this.renderProfileDetails(selected);
        // The dialog takes the selected profile's faction look and shape.
        const box = this.overlay.querySelector('.profile-selection-content');
        if (box && selected && this.applyFactionVars) this.applyFactionVars(box, selected.faction || 'pirate');
        ['psRename', 'psDelete'].forEach((id) => {
            const btn = pane.querySelector('#' + id);
            if (btn) btn.disabled = !!this._noVisibleProfile;
        });
    },

    /** Apply the faction filter (none selected = show everything) and the empty states. */
    applyFactionFilter() {
        const f = this._factionFilter || null;
        this.overlay.querySelectorAll('.profile-faction-btn').forEach((b) => {
            b.classList.toggle('is-active', b.dataset.faction === f);
        });
        const items = Array.from(this.overlay.querySelectorAll('.profile-list-item'));
        items.forEach((el) => { el.hidden = !!f && el.dataset.faction !== f; });
        const visible = items.filter((el) => !el.hidden);
        const empty = this.overlay.querySelector('.profile-list-filter-empty');
        if (empty) empty.hidden = !items.length || visible.length > 0;
        const cur = items[this.selectedIndex];
        if (visible.length && (!cur || cur.hidden)) {
            this.selectIndex(items.indexOf(visible[0]));
            return;
        }
        this._noVisibleProfile = items.length > 0 && !visible.length;
        items.forEach((el, i) => el.classList.toggle('selected', !this._noVisibleProfile && i === this.selectedIndex));
        this.refreshDetails();
        const selBtn = this.overlay.querySelector('#psSelect');
        if (selBtn) selBtn.disabled = this._noVisibleProfile;
    },

    bindListEvents() {
        this.overlay.querySelectorAll('.profile-faction-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.faction;
                this._factionFilter = this._factionFilter === id ? null : id;
                this.applyFactionFilter();
            });
        });
        this.overlay.querySelectorAll('.profile-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index, 10);
                if (!Number.isNaN(idx)) this.selectIndex(idx);
            });
            item.addEventListener('dblclick', () => {
                const idx = parseInt(item.dataset.index, 10);
                if (!Number.isNaN(idx)) {
                    this.selectIndex(idx);
                    this.activateSelected();
                }
            });
        });

        const bind = (id, fn) => {
            const el = this.overlay.querySelector('#' + id);
            if (el) el.addEventListener('click', fn);
        };
        bind('psSelect', () => this.activateSelected());
        bind('psCreate', () => {
            this.mode = 'create';
            this.createStep = 'faction';
            this._heroDefaultName = '';
            this._pilotName = '';
            this.pendingFaction = this.getFactionIds()[0];
            this.createUI();
        });
        // Rename / Delete live in the details hero (rebuilt on refresh); one delegated handler per overlay.
        if (this._pdActOverlay !== this.overlay) {
            this._pdActOverlay = this.overlay;
            this.overlay.addEventListener('click', (e) => {
                const btn = e.target.closest && e.target.closest('[data-pd-act]');
                if (!btn || !this.overlay || !this.overlay.contains(btn) || btn.disabled) return;
                const act = btn.getAttribute('data-pd-act');
                if (act === 'rename') {
                    if (!this.getProfiles().length) return;
                    this.mode = 'rename';
                    this.createUI();
                } else if (act === 'delete') {
                    this.deleteSelected();
                }
            });
        }
        bind('psBack', () => this.close());

        this.actionFocusIndex = 0;
        this.refreshActionFocus();
        // Mouse and keyboard share one focus: hovering an action moves it.
        this.getActionButtons().forEach((btn, i) => {
            btn.addEventListener('mouseenter', () => {
                this.actionFocusIndex = i;
                this.refreshActionFocus();
            });
            btn.addEventListener('mouseleave', () => {
                btn.classList.remove('nav-focused');
            });
        });
        const selectedItem = this.overlay.querySelector('.profile-list-item.selected');
        if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest' });

        this._keyHandler = (e) => {
            if (!this.isVisible || this.mode !== 'list') return;
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectIndex(Math.max(0, this.selectedIndex - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectIndex(Math.min(this.getProfiles().length - 1, this.selectedIndex + 1));
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.moveActionFocus(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.moveActionFocus(1);
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Space confirms like Enter (keyboard/gamepad-style menus).
                e.preventDefault();
                const actions = this.getActionButtons();
                if (actions[this.actionFocusIndex]) {
                    actions[this.actionFocusIndex].click();
                } else {
                    this.activateSelected();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    },

    getActionButtons() {
        if (!this.overlay) return [];
        return Array.prototype.slice.call(
            this.overlay.querySelectorAll('.profile-selection-actions .action-button:not([disabled]), .pd-hero-actions .pd-hero-btn:not([disabled])')
        );
    },

    refreshActionFocus() {
        const actions = this.getActionButtons();
        if (!actions.length) return;
        this.actionFocusIndex = Math.max(0, Math.min(actions.length - 1, this.actionFocusIndex || 0));
        actions.forEach((el, i) => el.classList.toggle('nav-focused', i === this.actionFocusIndex));
    },

    moveActionFocus(dir) {
        const actions = this.getActionButtons();
        if (!actions.length) return;
        this.actionFocusIndex = (this.actionFocusIndex + dir + actions.length) % actions.length;
        this.refreshActionFocus();
    },

    selectIndex(index) {
        const profiles = this.getProfiles();
        if (!profiles.length) return;
        const items = Array.from(this.overlay.querySelectorAll('.profile-list-item'));
        let next = Math.max(0, Math.min(profiles.length - 1, index));
        const dir = next >= this.selectedIndex ? 1 : -1;
        while (items[next] && items[next].hidden) next += dir;
        if (!items[next]) return;
        this.selectedIndex = next;
        this._noVisibleProfile = false;
        ['psSelect', 'psRename', 'psDelete'].forEach((id) => {
            const btn = this.overlay.querySelector('#' + id);
            if (btn) btn.disabled = false;
        });
        this.overlay.querySelectorAll('.profile-list-item').forEach((el, i) => {
            el.classList.toggle('selected', i === this.selectedIndex);
            if (i === this.selectedIndex) el.scrollIntoView({ block: 'nearest' });
        });
        this.refreshDetails();
    },

    /** Apply the name step's start options to a freshly created profile. */
    applyStartOptions(p) {
        const o = this._startOpts || {};
        if (!p) return;
        // Start galaxy: current station galaxy, discovered, ship at its start planet.
        const gid = String(o.galaxy || '').toLowerCase();
        if (gid && typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy && planetConfigManager.getGalaxy(gid)) {
            p.homeStation.currentGalaxyId = gid;
            // Uncharted galaxies get their arrival sector now (same as the
            // first teleport there): planets + an unlocked start planet.
            let map = planetConfigManager.getGalaxyMap(gid) || {};
            if (!(map.nodes && map.nodes.length) && planetConfigManager.ensureGalaxyArrivalContent) {
                const arrival = planetConfigManager.ensureGalaxyArrivalContent(gid, String(p.id) + '|' + gid, { firstVisit: true });
                if (arrival && arrival.faction && profileManager.discoverFaction) profileManager.discoverFaction(arrival.faction);
                map = planetConfigManager.getGalaxyMap(gid) || {};
            }
            // Story step: bind the start-profile story onto start-cluster planets.
            // Fall back to the galaxy's own start planet if nothing (valid) was chosen.
            const storyPath = (this.currentStoryPath && this.currentStoryPath()) || null;
            const boundMissions = (storyPath && this.bindStoryMissionsToPlanets)
                ? this.bindStoryMissionsToPlanets(storyPath, gid) : [];
            if (boundMissions[0] && boundMissions[0].planetId) o.missionPlanetId = boundMissions[0].planetId;
            const chosenPlanet = (o.missionPlanetId && map.nodes && map.nodes.some((n) => n.planetId === o.missionPlanetId)) ? o.missionPlanetId : null;
            const startId = chosenPlanet || map.startPlanetId || (map.nodes && map.nodes[0] && map.nodes[0].planetId);
            if (startId) {
                if (profileManager.ensureGalaxyProgress) profileManager.ensureGalaxyProgress(p, gid);
                if (profileManager.unlockPlanet) profileManager.unlockPlanet(startId);
            }
            // Own-faction galaxy: a few nearby planets are already travelable.
            if (profileManager.unlockOwnFactionStartCluster) profileManager.unlockOwnFactionStartCluster(p, gid);
            if (profileManager.discoverGalaxy) profileManager.discoverGalaxy(gid);
            // Home galaxy: UNDER ATTACK waits until the first stage is cleared.
            const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(p.faction) : null;
            if (meta && meta.homeGalaxy === gid && profileManager.scheduleHomeInvasion) {
                profileManager.scheduleHomeInvasion(p, gid);
            }
            const start = startId;
            if (start && profileManager.setShipLocation) {
                profileManager._suppressHoldingTick = true;
                profileManager.setShipLocation(gid, 'planet', start);
                profileManager._suppressHoldingTick = false;
            }
            // Persist story as MAIN QUEST in the mission logbook.
            if (storyPath && boundMissions.length) {
                const kitId = (this.currentKit && this.currentKit().id) || o.kit || null;
                p.storyPath = {
                    kitId: kitId,
                    pathId: storyPath.id,
                    title: storyPath.title,
                    blurb: storyPath.blurb,
                    icon: storyPath.icon || null,
                    missionIndex: 0,
                    missions: boundMissions.map((m) => Object.assign({}, m, { done: false }))
                };
                if (profileManager.setMainQuestFromStory) {
                    profileManager.setMainQuestFromStory({
                        kitId: kitId,
                        pathId: storyPath.id,
                        id: storyPath.id,
                        title: storyPath.title,
                        blurb: storyPath.blurb,
                        icon: storyPath.icon || null
                    }, boundMissions, p);
                } else {
                    const first = boundMissions[0];
                    if (first && first.planetId) {
                        const rw = profileManager.getMissionReward
                            ? profileManager.getMissionReward(gid, first.planetId, false, p) : null;
                        p.activeMission = {
                            galaxyId: first.galaxyId || gid,
                            planetId: first.planetId,
                            type: String(first.type || 'patrol').toUpperCase(),
                            name: first.name,
                            reward: (rw && rw.reward) || { credits: 60 },
                            story: true,
                            main: true,
                            targetKind: first.targetKind || 'planet',
                            objective: first.objective || '',
                            storyPathId: storyPath.id,
                            storyMissionId: first.id
                        };
                    }
                }
            }
        }
        // Each start profile brings its own hull: owned, active and discovered before the kit and hull-area bonuses land on it.
        const kitShip = this.startShipId();
        if (kitShip && typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig(kitShip)) {
            p.ownedShipIds = [kitShip];
            p.activeShipId = kitShip;
            if (profileManager.discoverShipContents) profileManager.discoverShipContents(kitShip);
        }
        if (!p.shipUpgrades) p.shipUpgrades = {};
        // Starter kit.
        if (!p.resources || typeof p.resources !== 'object') p.resources = {};
        const addRes = (id, n) => { p.resources[id] = (Number(p.resources[id]) || 0) + n; };
        const kit = this.currentKit();
        const bonus = kit.bonus || {};
        if (bonus.credits) p.credits = (Number(p.credits) || 0) + bonus.credits;
        Object.keys(bonus.res || {}).forEach((r) => addRes(r, bonus.res[r]));
        if (bonus.weapon2) {
            if (!p.parts || typeof p.parts !== 'object') p.parts = {};
            if (!p.parts.weapons || typeof p.parts.weapons !== 'object') p.parts.weapons = {};
            p.parts.weapons[bonus.weapon2] = Math.max(1, Number(p.parts.weapons[bonus.weapon2]) || 0);
        }
        if (bonus.slot) {
            const ship = p.activeShipId;
            if (!p.shipUpgrades[ship]) p.shipUpgrades[ship] = { frameLevel: 0 };
            p.shipUpgrades[ship].weaponSlotsBought = (Number(p.shipUpgrades[ship].weaponSlotsBought) || 0) + bonus.slot;
        }
        if (o.areas) {
            const ship = p.activeShipId;
            if (!p.shipUpgrades[ship]) p.shipUpgrades[ship] = { frameLevel: 0 };
            const e = p.shipUpgrades[ship];
            const lv = Object.assign({ front: 0, center: 0, back: 0, wing: 0 }, e.areaLevels || {});
            Object.keys(o.areas).filter((k) => (kit.off || []).indexOf(k) < 0).forEach((k) => { lv[k] = Math.min(2, (Number(lv[k]) || 0) + (Number(o.areas[k]) || 0) + (Number((bonus.areas || {})[k]) || 0)); });
            e.areaLevels = lv;
            e.frameLevel = Object.values(lv).reduce((n, v) => n + v, 0);
        }
        // Areas this hull is built without (no nose / aft / wings).
        if (kit.off && kit.off.length && typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.setAreaEnabled) {
            kit.off.forEach((a) => { try { shipLoadoutManager.setAreaEnabled(p.activeShipId, a, false); } catch (e) { /* cosmetic */ } });
        }
        // A start profile begins with exactly one weapon (the others are bought later).
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getLoadout && shipLoadoutManager.setLoadout) {
            try {
                const L = shipLoadoutManager.getLoadout(p.activeShipId);
                const gun = (L.weaponSlots || []).find(Boolean) || (L.weapons && L.weapons[0]) || 'laser';
                L.weaponSlots = [gun];
                L.weapons = [gun];
                // Small base set: one weapon, one defense, one energy core, one ability.
                L.defenses = (L.defenses || []).slice(0, 1);
                L.abilities = (L.abilities || []).slice(0, 1);
                L.energy = (L.energy || []).slice(0, 1);
                if (!p.shipUpgrades) p.shipUpgrades = {};
                if (!p.shipUpgrades[p.activeShipId]) p.shipUpgrades[p.activeShipId] = { frameLevel: 0 };
                p.shipUpgrades[p.activeShipId].baseSlotCaps = { weapons: 1, defenses: 1, abilities: 1, energy: 1 };
                shipLoadoutManager.setLoadout(p.activeShipId, L);
            } catch (e) { /* cosmetic */ }
        }
        // Start profile with a core gun: slot 0 sits in the core (single on the axis or split left / right).
        if (kit.coreGun && typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getLoadout && shipLoadoutManager.setLoadout) {
            try {
                const L = shipLoadoutManager.getLoadout(p.activeShipId);
                L.weaponMounts = Object.assign({}, L.weaponMounts, { 0: { area: 'center', split: kit.coreGun === 'split', off: 0.2, ny: 0.5, fixed: true } });
                const ws = (L.weaponSlots || []).slice();
                ws[0] = ws[0] || (L.weapons && L.weapons[0]) || 'laser';
                L.weaponSlots = ws;
                shipLoadoutManager.setLoadout(p.activeShipId, L);
            } catch (e) { /* cosmetic */ }
        }
        // Inventory grid: start size and growth per frame level, from the hull plus the kit's bonus.
        if (p.activeShipId && typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.inventoryGrowth) {
            if (!p.shipUpgrades[p.activeShipId]) p.shipUpgrades[p.activeShipId] = { frameLevel: 0 };
            const st = shipLoadoutManager.inventoryStart(p.activeShipId);
            p.shipUpgrades[p.activeShipId].invStart = [Math.max(3, Math.min(8, st[0] + (Number(bonus.invCols) || 0))), Math.max(1, st[1] + (Number(bonus.invRows) || 0))];
            p.shipUpgrades[p.activeShipId].invGrowth = Math.max(0.1, shipLoadoutManager.inventoryGrowth(p.activeShipId) + (Number(bonus.invGrowth) || 0));
        }
        if (o.look) p.portrait = Object.assign({}, o.look);
        p.startKit = kit.id;
        profileManager.save();
    },

    saveName() {
        const input = this.overlay.querySelector('#profileNameInput');
        const name = input ? input.value : (this.mode === 'create' ? (this._pilotName || '') : '');
        if (typeof profileManager === 'undefined') return;
        if (this.mode === 'create') {
            const p = profileManager.create(name, this.pendingFaction);
            if (!p) return;
            profileManager.setActive(p.id);
            profileManager.ensureEconomyDefaults(p);
            this.applyStartOptions(p);
            this.hide();
            const proceed = () => {
                if (typeof homeStationUI !== 'undefined') {
                    homeStationUI.show({
                        tab: 'play',
                        onClose: this.onClose
                    });
                } else if (typeof this.onClose === 'function') {
                    this.onClose();
                }
            };
            // Defer past the START Enter/click so it cannot instantly skip the cutscene.
            const story = (this.currentStoryPath && this.currentStoryPath()) || (p.storyPath || null);
            const startCut = () => {
                if (typeof launchCutsceneManager !== 'undefined') {
                    launchCutsceneManager.play({
                        faction: p.faction,
                        shipId: p.activeShipId,
                        profile: p,
                        story: story ? {
                            id: story.id || story.pathId,
                            title: story.title,
                            blurb: story.blurb,
                            cut: story.cut,
                            missions: story.missions
                        } : null,
                        onDone: proceed
                    });
                } else {
                    proceed();
                }
            };
            requestAnimationFrame(() => setTimeout(startCut, 40));
            return;
        } else if (this.mode === 'rename') {
            const profiles = this.getProfiles();
            const target = profiles[this.selectedIndex];
            if (!target) return;
            profileManager.rename(target.id, name);
        }
        this.mode = 'list';
        this.createUI();
    },

    activateSelected() {
        const profiles = this.getProfiles();
        if (!profiles.length) {
            this.mode = 'create';
            this.createStep = 'faction';
            this._heroDefaultName = '';
            this._pilotName = '';
            this.pendingFaction = this.getFactionIds()[0];
            this.createUI();
            return;
        }
        const p = profiles[this.selectedIndex];
        if (!p || typeof profileManager === 'undefined') return;
        profileManager.setActive(p.id);
        this.close();
    },

    async deleteSelected() {
        const profiles = this.getProfiles();
        const p = profiles[this.selectedIndex];
        if (!p || typeof profileManager === 'undefined') return;
        if (!(await uiDialog.confirm(`Delete profile "${p.name}"?`, { okLabel: 'DELETE', danger: true }))) return;
        if (!this.isVisible) return;
        profileManager.delete(p.id);
        this.selectedIndex = 0;
        this.createUI();
    },

    close() {
        if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-pf');
        const cb = this.onClose;
        this.hide();
        if (typeof cb === 'function') cb();
    },
});
