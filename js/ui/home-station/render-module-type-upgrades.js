"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    renderModuleTypeUpgrades(profile) {
        if (typeof economyConfig === 'undefined' || !economyConfig.moduleUpgradeDefs) {
            return '<p class="hs-muted">Module upgrades unavailable.</p>';
        }
        const wallet = profile.resources || {};
        const defs = economyConfig.moduleUpgradeDefs;
        const sections = Object.keys(defs).map((cat) => {
            const tracks = Object.keys(defs[cat]).map((track) => {
                const meta = defs[cat][track];
                const level = profileManager.getModuleUpgradeLevel(cat, track, profile);
                const check = profileManager.canPurchaseModuleUpgrade(cat, track, profile);
                const maxed = level >= meta.maxLevel;
                const cost = check.cost || economyConfig.getModuleUpgradeCost(cat, track, level + 1);
                let action = '';
                if (maxed) {
                    action = '<span class="hs-muted hs-line-action">MAX</span>';
                } else {
                    // Missing resources stays focusable: the click opens the buy modal.
                    const lockAttr = check.ok ? '' : (check.reason === 'RESOURCES' ? 'data-short="1"' : 'disabled');
                    action = `<button class="action-button hs-line-action" data-mod-up="${cat}:${track}" ${lockAttr}>` +
                        `UPGRADE` +
                        `</button>`;
                }
                const icon = cat === 'weapons' ? 'statWeapon'
                    : (cat === 'defenses' ? 'statArmor'
                        : (cat === 'charge' ? 'statDamage'
                            : (cat === 'energy' ? 'ability_energy_shield'
                                : (cat === 'collector' ? 'hsCargo' : 'statAbilities'))));
                return `<div class="hs-line hs-shop-line">` +
                    `<span class="hs-line-name">` +
                    `<span class="hs-chip-icon">${this.iconHtml(icon, 32, 'hs-pixel')}</span>` +
                    `<span class="hs-line-text">` +
                    `<strong>${meta.label}</strong>` +
                    `<span class="hs-line-meta">${meta.desc} · L${level}/${meta.maxLevel}</span>` +
                    `</span></span>` +
                    (cost && !maxed ? this.renderCostGrid(cost, wallet) : '<span></span>') +
                    action +
                    `</div>`;
            }).join('');
            const titleIcon = cat === 'weapons' ? 'statWeapon'
                : (cat === 'defenses' ? 'statArmor'
                    : (cat === 'charge' ? 'statDamage'
                        : (cat === 'collector' ? 'hsCargo'
                            : (cat === 'energy' ? 'ability_energy_shield' : 'statAbilities'))));
            return `<div class="hs-panel" style="margin-bottom:12px">` +
                `${this.panelTitle(titleIcon, cat.toUpperCase())}` +
                tracks +
                `</div>`;
        }).join('');
        return sections;
    },

    renderUpgradeTab(profile) {
        if (typeof economyConfig === 'undefined' || typeof profileManager === 'undefined') {
            return `<div class="hs-section hs-panel">${this.panelTitle('hsUpgrade', 'UPGRADES')}` +
                `<p class="hs-muted">Upgrade system unavailable.</p></div>`;
        }
        let inner = '';
        let title = 'STATION UPGRADE TREE';
        let hint = 'Spend station resources to expand capacity, hangar slots, drives and station systems.';
        if (this.upgradeSubTab === 'ships') {
            title = 'HULL AREAS';
            hint = 'Upgrade a hull area to grow its slots S → M → L (bigger parts fit) and open extra slots. Every level adds hull HP and armor.';
            inner = this.renderShipFrameUpgrades(profile);
        } else if (this.upgradeSubTab === 'modules') {
            title = 'MODULE TYPE UPGRADES';
            hint = 'Global bonuses for weapons, defenses, abilities — and charge systems (after buying charge parts).';
            inner = this.renderModuleTypeUpgrades(profile);
        } else {
            inner = this.renderStationUpgradeTree(profile);
        }

        return `<div class="hs-section hs-panel hs-upgrade-root">` +
            `<div class="hs-shop-cats">${this.renderUpgradeSubTabs()}</div>` +
            `${this.panelTitle('hsUpgrade', title)}` +
            `<p class="hs-muted hs-hint">${hint}</p>` +
            `<div class="hs-tab-fill">${inner}</div>` +
            `</div>`;
    },

    renderTravelTab(profile) {
        const current = (typeof profileManager !== 'undefined')
            ? profileManager.getCurrentGalaxyId(profile)
            : 'milky_way';
        const levels = (typeof profileManager !== 'undefined')
            ? profileManager.getStationUpgradeLevels(profile)
            : {};
        const ids = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getGalaxyIds()
            : ['milky_way', 'andromeda'];
        const cards = ids.map((gid) => {
            const g = (typeof planetConfigManager !== 'undefined')
                ? planetConfigManager.getGalaxy(gid)
                : { id: gid, name: gid.toUpperCase() };
            const travel = (typeof profileManager !== 'undefined')
                ? profileManager.canTravelToGalaxy(gid, profile)
                : { ok: gid === 'milky_way' };
            const here = gid === current;
            const req = (typeof economyConfig !== 'undefined')
                ? economyConfig.getGalaxyWarpRequirement(gid, current)
                : 0;
            // Map nodes = the galaxy's real planets (planetIds can hold strays).
            const gmap = (typeof planetConfigManager !== 'undefined') ? planetConfigManager.getGalaxyMap(gid) : null;
            const planetCount = (gmap && gmap.nodes && gmap.nodes.length) || 0;
            const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
                ? planetConfigManager.getGalaxyFaction(gid)
                : ((g && g.faction) || '');
            const factionLabel = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyControlLabel)
                ? (' · ' + planetConfigManager.getGalaxyControlLabel(gid))
                : (faction ? (' · FACTION ' + String(faction).toUpperCase()) : '');
            let action = '';
            if (here) {
                action = '<span class="hs-muted hs-line-action">CURRENT</span>';
            } else if (!travel.ok) {
                action = `<span class="hs-muted hs-line-action">NEED WARP L${req} OR PORTAL</span>`;
            } else {
                action = `<button class="action-button hs-line-action" data-travel="${gid}">TRAVEL HERE</button>`;
            }
            return `<div class="hs-line hs-shop-line ${here ? 'hs-travel-here' : ''} ${!travel.ok ? 'locked' : ''}">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsStation', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${(g && g.name) || gid.toUpperCase()}</strong>` +
                `<span class="hs-line-meta">${planetCount} PLANETS · WARP REQ L${req}${factionLabel}` +
                (here ? ' · HOME' : '') +
                `</span>` +
                `</span></span>` +
                action +
                `</div>`;
        }).join('');

        return `<div class="hs-section hs-panel">` +
            `${this.panelTitle('hsTravel', 'GALAXY TRAVEL')}` +
            `<p class="hs-muted hs-hint">Move the home station between galaxies. First travel into a foreign galaxy charts faction-matched planets and icons immediately. START only shows planets in the current galaxy. Unlock destinations with WARP DRIVE or buy a PORTAL in the shop.</p>` +
            `<p class="hs-line">CURRENT: <strong>${String(current).replace(/_/g, ' ').toUpperCase()}</strong> · WARP L${levels.warp_drive || 0}</p>` +
            `<div class="hs-tab-fill">${cards}</div>` +
            `</div>`;
    },

    isExploreItemVisible(itemId) {
        if (typeof startScreenManager !== 'undefined') {
            return startScreenManager.isExploreItemVisible(itemId);
        }
        return true;
    },

    /** Discovered entries behind an Explorations item, or null if untracked. */
    getExploreItemCount(itemId) {
        if (typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) return 0;
        const count = (cat) => (profileManager.getDiscovered(cat) || []).length;
        const cats = {
            SHIPS: ['ships'], PLANETS: ['planets'], ENEMIES: ['enemies'], FACTIONS: ['factions'],
            EVENTS: ['events'], WEAPONS: ['weapons'], ABILITIES: ['abilities'],
            'DEFENSE SYSTEMS': ['defenses'], COMPONENTS: ['weapons', 'abilities', 'defenses']
        }[itemId];
        return cats ? cats.reduce((sum, cat) => sum + count(cat), 0) : null;
    },

    renderExplorationsTab(profile) {
        // Every entry is listed; ones with nothing discovered yet are dimmed.
        const clusters = this._exploreClusters;

        const groups = clusters.map((cluster) => {
            const rows = cluster.items.map((entry) => {
                const count = this.getExploreItemCount(entry.id);
                const empty = !this.isExploreItemVisible(entry.id);
                return `<button type="button" class="action-button hs-explore-item${empty ? ' is-empty' : ''}" data-explore="${entry.open}" data-nav-item${empty ? ' disabled' : ''}>` +
                    `<span class="hs-chip-icon">${this.iconHtml(entry.icon, 128, 'hs-pixel')}</span>` +
                    `<span class="hs-explore-label">${entry.id}</span>` +
                    `<span class="hs-explore-count">${count == null ? '—' : count}</span>` +
                    `</button>`;
            }).join('');
            return `<div class="hs-explore-cluster" data-cluster="${cluster.id}">` +
                `<div class="hs-explore-cluster-title">${cluster.label}</div>` +
                `<div class="hs-explore-cluster-items">${rows}</div>` +
                `</div>`;
        }).join('');

        return `<div class="hs-section hs-panel hs-explore-root">` +
            `${this.panelTitle('hsExplore', 'EXPLORATIONS')}` +
            `<p class="hs-muted hs-hint">Browse discovered ships, worlds, foes, peoples, events, equipment and components.</p>` +
            `<div class="hs-tab-fill hs-explore-grid">${groups}</div>` +
            `</div>`;
    },

    openExploration(kind) {
        const stationOnClose = this.onClose;
        const returnToExplorations = () => {
            this.show({
                tab: 'explorations',
                onClose: stationOnClose,
                focusExplore: kind
            });
        };
        if (kind === 'components') {
            this.show({
                tab: 'components',
                onClose: stationOnClose
            });
            return;
        }
        // Inside the station: show the viewer in the WIKI area itself.
        if (this.openExplorationInline(kind)) return;
        const openers = {
            ships: () => typeof shipViewerUI !== 'undefined' && shipViewerUI.show({ onClose: returnToExplorations }),
            planets: () => typeof planetViewerUI !== 'undefined' && planetViewerUI.show({ onClose: returnToExplorations }),
            enemies: () => typeof enemyViewerUI !== 'undefined' && enemyViewerUI.show({ onClose: returnToExplorations }),
            factions: () => typeof factionViewerUI !== 'undefined' && factionViewerUI.show({ onClose: returnToExplorations }),
            events: () => typeof eventViewerUI !== 'undefined' && eventViewerUI.show({ onClose: returnToExplorations }),
            weapons: () => typeof weaponViewerUI !== 'undefined' && weaponViewerUI.show({ onClose: returnToExplorations }),
            abilities: () => typeof abilityViewerUI !== 'undefined' && abilityViewerUI.show({ onClose: returnToExplorations }),
            defenses: () => typeof defenseViewerUI !== 'undefined' && defenseViewerUI.show({ onClose: returnToExplorations }),
            explosions: () => typeof explosionViewerUI !== 'undefined' && explosionViewerUI.show({ onClose: returnToExplorations })
        };
        const open = openers[kind];
        if (!open) return;
        this.tab = 'explorations';
        this.persistTab();
        this.hide();
        open();
    },

    /** Viewer object per WIKI category (all render a .content-viewer-overlay). */
    getExploreViewer(kind) {
        const pick = {
            ships: () => typeof shipViewerUI !== 'undefined' ? shipViewerUI : null,
            planets: () => typeof planetViewerUI !== 'undefined' ? planetViewerUI : null,
            enemies: () => typeof enemyViewerUI !== 'undefined' ? enemyViewerUI : null,
            factions: () => typeof factionViewerUI !== 'undefined' ? factionViewerUI : null,
            events: () => typeof eventViewerUI !== 'undefined' ? eventViewerUI : null,
            weapons: () => typeof weaponViewerUI !== 'undefined' ? weaponViewerUI : null,
            abilities: () => typeof abilityViewerUI !== 'undefined' ? abilityViewerUI : null,
            defenses: () => typeof defenseViewerUI !== 'undefined' ? defenseViewerUI : null,
            explosions: () => typeof explosionViewerUI !== 'undefined' ? explosionViewerUI : null
        }[kind];
        return pick ? pick() : null;
    },

    /**
     * Mount a WIKI viewer into the station body: the viewer builds its usual
     * overlay on <body>; an observer moves it into the body host and flags it
     * embedded. CLOSE / ESC return to the category grid.
     */
    openExplorationInline(kind, showOpts) {
        const viewer = this.getExploreViewer(kind);
        const body = this.overlay && this.isVisible && this.overlay.querySelector('.home-station-content .hs-body');
        if (!viewer || !body) return false;
        this.closeEmbeddedViewer();
        this.tab = 'explorations';
        this.persistTab();
        let host = body.querySelector(':scope > .hs-viewer-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'hs-viewer-host';
            body.appendChild(host);
        }
        body.classList.add('hs-body-viewer');
        const adopt = (node) => {
            if (!(node instanceof HTMLElement) || !node.classList.contains('content-viewer-overlay')) return;
            node.classList.add('is-embedded');
            if (node.parentNode !== host) host.appendChild(node);
        };
        this._viewerObserver = new MutationObserver((muts) => {
            muts.forEach((m) => m.addedNodes.forEach(adopt));
        });
        this._viewerObserver.observe(document.body, { childList: true });
        this._embeddedViewer = viewer;
        this._embeddedViewerKind = kind;
        viewer.show(Object.assign({}, showOpts || {}, {
            onClose: () => {
                this.closeEmbeddedViewer({ keepViewer: true });
                if (this.isVisible) this.createUI();
            }
        }));
        document.querySelectorAll('body > .content-viewer-overlay').forEach(adopt);
        // Opening found nothing to show (empty list): back to the grid.
        if (!viewer.visible && !viewer.isVisible) {
            this.closeEmbeddedViewer({ keepViewer: true });
            body.classList.remove('hs-body-viewer');
            return true;
        }
        this.overlay.querySelectorAll('.hs-explore-subtab').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-explore') === kind);
        });
        return true;
    },

    /** Stop the embedded viewer (tab switch / other category / its own close). */
    closeEmbeddedViewer(opts) {
        if (this._viewerObserver) {
            this._viewerObserver.disconnect();
            this._viewerObserver = null;
        }
        const viewer = this._embeddedViewer;
        this._embeddedViewer = null;
        this._embeddedViewerKind = null;
        if (viewer && !(opts && opts.keepViewer) && (viewer.visible || viewer.isVisible) && viewer.hide) viewer.hide();
    },

    /** Compact amount: 999 · 1.2K · 12K · 1.2M (full value in the tooltip). */
    shortAmount(v) {
        const n = Math.round(Number(v) || 0);
        const a = Math.abs(n);
        const fmt = (x, suf) => (x < 10 ? (Math.floor(x * 10) / 10).toString() : Math.floor(x).toString()) + suf;
        if (a >= 1e9) return (n < 0 ? '-' : '') + fmt(a / 1e9, 'B');
        if (a >= 1e6) return (n < 0 ? '-' : '') + fmt(a / 1e6, 'M');
        if (a >= 1e3) return (n < 0 ? '-' : '') + fmt(a / 1e3, 'K');
        return String(n);
    },

    renderCreditsBar(map, profile) {
        const p = profile || this.getProfile();
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(p)
            : Math.max(0, Math.round(Number((p && p.credits) || 0)));
        const creditChip = `<span class="hs-credit hs-res-credits${credits <= 0 ? ' hs-res-empty' : ''}">` +
            `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey('credits'), 16, 'hs-pixel hs-pixel-16')}</span>` +
            `<span class="hs-credit-amount" title="${credits}">${this.shortAmount(credits)}</span>` +
            `</span>`;
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map || {});
        const parts = ids.map((id) => {
            const n = (map && map[id]) || 0;
            const empty = n <= 0 ? ' hs-res-empty' : '';
            return `<span class="hs-credit hs-res-${id}${empty}">` +
                `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey(id), 16, 'hs-pixel hs-pixel-16')}</span>` +
                `<span class="hs-credit-amount" title="${n}">${this.shortAmount(n)}</span>` +
                `</span>`;
        });
        return creditChip + (parts.join('') || '');
    },

    /** Larger wallet strip used inside SHOP (above category tabs). */
    renderShopWalletBar(profile) {
        const map = (profile && profile.resources) || {};
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(profile)
            : Math.max(0, Math.round(Number((profile && profile.credits) || 0)));
        const chip = (id, amount, iconId) => {
            const n = Math.max(0, Math.round(Number(amount) || 0));
            const empty = n <= 0 ? ' hs-res-empty' : '';
            return `<span class="hs-shop-wallet-item hs-res-${id}${empty}">` +
                `<span class="hs-shop-wallet-icon">${this.iconHtml(this.resourceIconKey(iconId || id), 32, 'hs-pixel hs-pixel-32')}</span>` +
                `<span class="hs-shop-wallet-meta">` +
                `<span class="hs-shop-wallet-label">${String(id).toUpperCase()}</span>` +
                `<span class="hs-shop-wallet-amount">${n}</span>` +
                `</span></span>`;
        };
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map);
        const mats = ids.map((id) => chip(id, map[id], id)).join('');
        return `<div class="hs-shop-wallet" aria-label="Resources">` +
            chip('credits', credits, 'credits') +
            mats +
            `</div>`;
    },

    renderBlueprintList(map) {
        const keys = Object.keys(map || {}).filter((k) => (map[k] || 0) > 0);
        if (!keys.length) return '<span class="hs-muted hs-empty-slot">NONE</span>';
        const rows = keys.map((id) => this.renderShipTableRow(id, 'hs-ship-thumb-bp', 'BLUEPRINT ×' + map[id])).join('');
        return this.shipTableHtml(rows);
    },

    /** Header + body for a ship table (thumb, name/class, core stats). */
    shipTableHtml(rowsHtml, withAction) {
        return `<table class="hs-ship-table">` +
            `<thead><tr><th></th><th>SHIP</th><th>TIER</th><th>HP</th><th>ARM</th><th>DMG</th><th>SPD</th>${withAction ? '<th>WEAPONS</th><th></th>' : ''}</tr></thead>` +
            `<tbody>${rowsHtml}</tbody></table>`;
    },

    /** Names of the weapons currently equipped in this ship's loadout. */
    equippedWeaponsLabel(id) {
        if (typeof shipLoadoutManager === 'undefined') return '—';
        const ids = (shipLoadoutManager.getLoadout(id).weapons || []).filter(Boolean);
        if (!ids.length) return '—';
        const cfg = (typeof shipConfigManager !== 'undefined') ? shipConfigManager.getConfig(id) : null;
        const profile = this.getProfile();
        const faction = (cfg && cfg.faction) || (profile && profile.faction) || '';
        return ids.map((w) => {
            const bonus = typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getFactionWeaponMul
                && weaponConfigManager.getFactionWeaponMul(faction, w) > 1;
            return this.weaponIconHtml(w, 24, bonus ? '+20% DMG · ' + faction.toUpperCase() : '');
        }).join('');
    },

    /**
     * Weapon icon tilted 45° and tinted per weapon, name in the tooltip.
     * `bonusNote` marks a faction-affinity weapon (glow + tooltip suffix).
     */
    weaponIconHtml(weaponId, size, bonusNote) {
        const color = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
            ? weaponConfigManager.getWeaponUiColor(weaponId) : null;
        const name = (typeof iconRenderer !== 'undefined') ? iconRenderer.weaponIconInfo(weaponId).name : String(weaponId);
        const tip = bonusNote ? name + ' · ' + bonusNote : name;
        return `<span class="hs-weapon-icon${bonusNote ? ' is-affinity' : ''}"` +
            (color ? ` style="--weapon-color:${color}"` : '') + `>` +
            this.moduleIconHtml('weapon', weaponId, size, 'hs-pixel hs-pixel-' + size, tip) +
            `</span>`;
    },

    /** One ship row; the thumb canvas is filled later by drawAreaThumbs(). */
    renderShipTableRow(id, thumbClass, note, actionHtml) {
        const cfg = (typeof shipConfigManager !== 'undefined') ? shipConfigManager.getConfig(id) : {};
        const cls = this.shipClassLabel(this.shipModelClass(id, cfg));
        const val = (v) => (v != null ? v : '—');
        return `<tr>` +
            `<td class="hs-ship-table-thumb"><span class="hs-ship-thumb ${thumbClass}">` +
            (thumbClass === 'hs-ship-thumb-bp'
                ? `<span class="hs-ship-thumb-type">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>`
                : `<span class="hs-ship-thumb-empty">${this.iconHtml('hsShip', 32, 'hs-pixel', false)}</span>` +
                  `<canvas width="56" height="44" data-area-thumb="${id}|"></canvas>`) +
            `</span></td>` +
            `<td class="hs-ship-table-name"><strong>${this.shipName(id)}</strong>` +
            `<span>${cls}${note ? ' · ' + note : ''}</span></td>` +
            `<td>${val(cfg.tier)}</td><td>${val(cfg.maxHealth)}</td><td>${val(cfg.armor)}</td>` +
            `<td>${val(cfg.damage)}</td><td>${val(cfg.speed)}</td>` +
            (actionHtml != null
                ? `<td><span class="hs-ship-table-weapons">${this.equippedWeaponsLabel(id)}</span></td>` +
                  `<td class="hs-ship-table-action">${actionHtml}</td>`
                : '') +
            `</tr>`;
    },
});
