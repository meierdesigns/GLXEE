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
                    action = `<button class="action-button hs-line-action" data-mod-up="${cat}:${track}" ${check.ok ? '' : 'disabled'}>` +
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
            title = 'SHIP FRAME UPGRADES';
            hint = 'Upgrade owned mainframes for more weapon / defense / ability slots and hull stats.';
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
                ? economyConfig.getGalaxyWarpRequirement(gid)
                : 0;
            const planetCount = (g.planetIds && g.planetIds.length) || 0;
            const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
                ? planetConfigManager.getGalaxyFaction(gid)
                : ((g && g.faction) || '');
            const factionLabel = faction ? (' · FACTION ' + String(faction).toUpperCase()) : '';
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

    renderExplorationsTab(profile) {
        const clusters = this._exploreClusters.map((cluster) => {
            const items = cluster.items.filter((entry) => this.isExploreItemVisible(entry.id));
            return { id: cluster.id, label: cluster.label, items: items };
        }).filter((cluster) => cluster.items.length > 0);

        if (!clusters.length) {
            return `<div class="hs-section hs-panel hs-explore-root">` +
                `${this.panelTitle('hsExplore', 'EXPLORATIONS')}` +
                `<div class="hs-tab-fill">` +
                `<p class="hs-muted hs-hint">No archive or arsenal entries unlocked yet. Discover ships, planets, enemies and gear in missions.</p>` +
                `</div></div>`;
        }

        const groups = clusters.map((cluster) => {
            const rows = cluster.items.map((entry) => {
                return `<button type="button" class="action-button hs-explore-item" data-explore="${entry.open}" data-nav-item>` +
                    `<span class="hs-chip-icon">${this.iconHtml(entry.icon, 32, 'hs-pixel')}</span>` +
                    `<span class="hs-explore-label">${entry.id}</span>` +
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

    renderCreditsBar(map, profile) {
        const p = profile || this.getProfile();
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits)
            ? profileManager.getCredits(p)
            : Math.max(0, Math.round(Number((p && p.credits) || 0)));
        const creditChip = `<span class="hs-credit hs-res-credits${credits <= 0 ? ' hs-res-empty' : ''}">` +
            `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey('credits'), 16, 'hs-pixel hs-pixel-16')}</span>` +
            `<span class="hs-credit-amount">${credits}</span>` +
            `</span>`;
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map || {});
        const parts = ids.map((id) => {
            const n = (map && map[id]) || 0;
            const empty = n <= 0 ? ' hs-res-empty' : '';
            return `<span class="hs-credit hs-res-${id}${empty}">` +
                `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey(id), 16, 'hs-pixel hs-pixel-16')}</span>` +
                `<span class="hs-credit-amount">${n}</span>` +
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
        return keys.map((id) =>
            `<span class="hs-chip hs-chip-bp">` +
            `<span class="hs-chip-icon">${this.iconHtml('hsBlueprint', 32, 'hs-pixel')}</span>` +
            `<span class="hs-chip-text">${this.shipName(id)} ×${map[id]}</span>` +
            `</span>`
        ).join('');
    },
});
