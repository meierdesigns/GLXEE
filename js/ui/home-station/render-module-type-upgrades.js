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
        let showHead = true;
        if (this.upgradeSubTab === 'ships') {
            title = 'HULL AREAS';
            hint = 'Upgrade a hull area to grow its slots S → M → L (bigger parts fit) and open extra slots. Every level adds hull HP and armor.';
            inner = this.renderShipFrameUpgrades(profile);
        } else if (this.upgradeSubTab === 'modules') {
            title = 'MODULE TYPE UPGRADES';
            hint = 'Global bonuses for weapons, defenses, abilities — and charge systems (after buying charge parts).';
            inner = this.renderModuleTypeUpgrades(profile);
        } else if (this.upgradeSubTab === 'equipment') {
            showHead = false;
            inner = this.renderEquipmentUpgrades(profile);
        } else {
            inner = this.renderStationUpgradeTree(profile);
        }

        return `<div class="hs-section hs-panel hs-upgrade-root">` +
            `<div class="hs-shop-cats">${this.renderUpgradeSubTabs()}</div>` +
            (showHead
                ? `${this.panelTitle('hsUpgrade', title)}` +
                  `<p class="hs-muted hs-hint">${hint}</p>`
                : '') +
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
        // Always list every galaxy. Locked rows keep NEED WARP / INSTALL PORTAL
        // so destinations do not vanish after travelling home with Warp L0.
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
            const portalReady = (typeof profileManager !== 'undefined' && profileManager.hasPortalInInventory)
                ? profileManager.hasPortalInInventory(gid, profile)
                : false;
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
            } else if (travel.ok) {
                action = `<button class="action-button hs-line-action" data-travel="${gid}">TRAVEL HERE</button>`;
            } else if (portalReady) {
                action = `<button class="action-button hs-line-action" data-install-portal="${gid}">INSTALL PORTAL</button>`;
            } else {
                action = `<span class="hs-muted hs-line-action">NEED WARP L${req} OR PORTAL</span>`;
            }
            const ctl = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyControl) ? planetConfigManager.getGalaxyControl(gid) : null;
            const held = !ctl || ctl.control !== 'contested';
            const chip = (fid) => `<span class="hs-travel-fac" title="${this.factionLabel(fid)}">${this.factionEmblemHtml({ faction: fid }, 24)}</span>`;
            const facs = ctl ? [chip(ctl.main)].concat(ctl.rivals.length ? ['<i class="hs-travel-vs">VS</i>'].concat(ctl.rivals.map(chip)) : []).join('') : '';
            const stat = (icon, val, tip, col) => {
                const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
                const img = ir && ir.imgHtml ? ir.imgHtml(icon, 32, 'hs-pixel', col, false) : this.iconHtml(icon, 24, 'hs-pixel', false);
                return `<span class="hs-mi-col" style="--stat:${col}" title="${tip}"><span class="hs-mi">${img}</span><span class="hs-mi-val">${val}</span></span>`;
            };
            const warpCol = ['#5cff7a', '#ffe14a', '#ff9a3c', '#ff4a3c'][Math.min(3, req)] || '#ff4a3c';
            return `<div class="hs-line hs-travel-row ${here ? 'hs-travel-here' : ''} ${!travel.ok ? 'locked' : ''}">` +
                `<span class="hs-chip-icon hs-galaxy-ico">${(typeof galaxyIcon !== 'undefined' && galaxyIcon.html(gid, 96)) || this.iconHtml('hsStation', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-name"><span class="hs-line-text">` +
                `<strong>${(g && g.name) || gid.toUpperCase()}${here ? ' <em class="hs-travel-tag">HOME</em>' : ''}</strong>` +
                `<span class="hs-travel-facs">${facs}</span>` +
                `</span></span>` +
                `<span class="hs-mission-info hs-mission-icons hs-travel-stats">` +
                stat('navPlanet', planetCount, 'Planets in this galaxy', '#5ce1ff') +
                stat('hsTeleport', 'L' + req, 'Warp drive level required', warpCol) +
                stat(held ? 'navFlag' : 'navSword', held ? 'HELD' : 'CONTESTED', held ? 'One faction rules this galaxy' : 'Several factions fight over this galaxy', held ? '#5cff7a' : '#ff5a3c') +
                `</span>` +
                `<span class="hs-travel-action">${action}</span>` +
                `</div>`;
        }).join('');

        return `<div class="hs-section hs-panel">` +
            `${this.panelTitle('hsTravel', 'GALAXY TRAVEL')}` +
            `<p class="hs-muted hs-hint">Move the home station between galaxies. Buy portal modules in the shop — they go into inventory. Install them here to unlock that galaxy route. Warp Drive can also unlock destinations by level.</p>` +
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
            'DEFENSE SYSTEMS': ['defenses'], 'ENERGY SYSTEMS': ['energy'], COMPONENTS: ['weapons', 'abilities', 'defenses']
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
                    `<span class="hs-chip-icon">${this.iconHtml(entry.icon + '@d', 128, 'hs-pixel')}</span>` +
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
        const run = () => {
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
                energy: () => typeof energyViewerUI !== 'undefined' && energyViewerUI.show({ onClose: returnToExplorations }),
                explosions: () => typeof explosionViewerUI !== 'undefined' && explosionViewerUI.show({ onClose: returnToExplorations })
            };
            const open = openers[kind];
            if (!open) return;
            this.tab = 'explorations';
            this.persistTab();
            this.hide();
            open();
        };
        // Viewers live in deferred-editors.js — warm that chunk before opening.
        if (typeof window.ensureVfEditors === 'function' && typeof window.vfEditorsReady === 'function'
            && !window.vfEditorsReady()) {
            window.ensureVfEditors(run);
            return;
        }
        run();
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
            energy: () => typeof energyViewerUI !== 'undefined' ? energyViewerUI : null,
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
            `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey('credits'), 32, 'hs-pixel hs-pixel-32')}</span>` +
            `<span class="hs-credit-amount" title="${credits}">${this.shortAmount(credits)}</span>` +
            `</span>`;
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map || {});
        const parts = ids.map((id) => {
            const n = (map && map[id]) || 0;
            const empty = n <= 0 ? ' hs-res-empty' : '';
            return `<span class="hs-credit hs-res-${id}${empty}">` +
                `<span class="hs-credit-icon">${this.iconHtml(this.resourceIconKey(id), 32, 'hs-pixel hs-pixel-32')}</span>` +
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

    renderBlueprintList(profile) {
        const map = profile.blueprints || {};
        const keys = Object.keys(map).filter((k) => (map[k] || 0) > 0 && profileManager.parseBlueprintKey(k));
        if (!keys.length) return this.emptyHtml('hsBlueprint', 'NO BLUEPRINTS YET');
        return keys.map((key) => this.renderBlueprintRow(key, profile)).join('');
    },

    /** One part blueprint: part icon, name, count, craft cost and craft button. */
    renderBlueprintRow(key, profile) {
        const bp = profileManager.parseBlueprintKey(key);
        const name = profileManager.getBlueprintName(key);
        const cost = profileManager.getBlueprintCraftCost(key, profile);
        const afford = this.canAffordCost(profile.resources, cost);
        const kindLabel = { weapon: 'WEAPON', defense: 'DEFENSE', ability: 'ABILITY', energy: 'ENERGY' }[bp.kind];
        return `<div class="hs-line hs-shop-line hs-craft-line">` +
            `<span class="hs-line-name"><span class="hs-chip-icon">${this.moduleIconHtml(bp.kind, bp.id, 32, 'hs-pixel')}</span>` +
            `<span class="hs-line-text"><strong>${name}</strong>` +
            `<span class="hs-line-meta">${kindLabel} · BLUEPRINT ×${profile.blueprints[key]}</span></span></span>` +
            `${this.renderCostGrid(cost, profile.resources)}` +
            `<button class="action-button hs-line-action hs-craft-go" data-craft="${key}" title="Craft ${name}" aria-label="Craft" ${afford ? '' : 'disabled'}>` +
            `<span class="hs-btn-icon">${this.iconHtml('hsCraft', 32, 'hs-pixel')}</span></button></div>`;
    },

    /** Header + body for a ship table (thumb, name/class, core stats). */
    shipTableHtml(rowsHtml, withAction) {
        return `<table class="hs-ship-table">` +
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
        const val = (v) => (v != null ? v : '—');
        // tip: a multi-line per-part breakdown (e.g. each weapon's own damage) shown as a proper
        // hover tooltip instead of the plain native `title`, for stats that sum several equipped
        // parts into one number — so hovering the total explains what it's made of.
        const stat = (icon, label, v, col, tip, key) => {
            const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
            const img = ir && ir.imgHtml ? ir.imgHtml(icon, 14, 'hs-pixel hs-pixel-12', col, false) : this.iconHtml(icon, 14, 'hs-pixel hs-pixel-12', false);
            const tipAttrs = tip
                ? `data-ui-tip-instant data-ui-tip-head="${label}" data-ui-tip="${String(tip).replace(/"/g, '&quot;')}"`
                : `title="${label}"`;
            return `<span class="hs-ship-stat" data-stat="${key || label.toLowerCase()}" style="--stat:${col}" ${tipAttrs}><span class="hs-ship-stat-ico">${img}</span><b>${val(v)}</b></span>`;
        };
        // HP/Armor/Speed/Damage: live, not the static hull config — getMergedModel() runs the
        // same base-hull → frame-hull-bonus → equipped-ability-stat-mod → weapon-upgrade-bonus
        // pipeline the ship actually flies with (shipLoadoutManager.applyLayoutToModel, called
        // from here regardless of which ship is active), so these numbers move when a part is
        // equipped/unequipped instead of only ever showing the hull's fixed base stats.
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(id) : cfg;
        // Damage: every actually-equipped weapon's own damage added up, not just the first/
        // default one — a ship with several weapon slots filled under-reported its firepower
        // otherwise. An unarmed ship shows 0, not the hull's unrelated base cfg.damage (that
        // number used to appear even with nothing equipped — an unarmed ship can't deal that
        // damage, it only happens to match the laser's fallback shot fired in combat).
        const equippedWeapons = (merged.loadout && merged.loadout.weapons) || [];
        const liveDamage = merged.weaponConfig
            ? equippedWeapons.reduce((sum, w) => {
                const d = merged.weaponConfig[w] && merged.weaponConfig[w].damage;
                return sum + (d != null ? Number(d) : 0);
            }, 0)
            : cfg.damage;
        // Per-weapon breakdown: only worth a tooltip when there's more than one separate weapon
        // contributing to the total — a single weapon's damage already IS the shown number.
        const damageTip = (merged.weaponConfig && equippedWeapons.length > 1)
            ? equippedWeapons.map((w) => {
                const d = merged.weaponConfig[w] && merged.weaponConfig[w].damage;
                return this.hangarModuleLabel(w) + ': ' + (d != null ? d : '—');
            }).join('\n')
            : null;
        // Armor: the flat armor stat (hull + ability bonuses) plus the damage-reduction % from
        // equipped defense modules (massive/heavy armor plating) — both are "how much less
        // damage gets through", so a defense part now actually moves this number too.
        const liveArmor = (Number(merged.armor) || 0) + (Number(merged.damageReduction) || 0);
        const tier = Math.max(0, Math.round(Number(cfg.tier) || 0));
        const ir = typeof iconRenderer !== 'undefined' ? iconRenderer : null;
        const tierStarIco = ir && ir.imgHtml
            ? ir.imgHtml('navStar', 14, 'hs-pixel hs-pixel-12', '#ffe14a', false)
            : '★';
        const tierStarsHtml = tier > 0
            ? (' <span class="hs-ship-tier-stars">' + Array.from({ length: tier }, () =>
                `<span class="hs-ship-tier-star">${tierStarIco}</span>`).join('') + '</span>')
            : '';
        const tipText = [['TIER', tier], ['HP', merged.maxHealth], ['ARMOR', liveArmor], ['DAMAGE', liveDamage], ['SPEED', merged.speed], ['ENERGY', merged.maxEnergy]]
            .map((x) => x[0] + ' ' + val(x[1])).join(' · ')
            + (merged.shieldMax ? ' · SHIELD ' + merged.shieldMax : '');
        // Tier lives as stars after the name — no separate star+value column.
        // Name → one column per stat, with that stat's equipment slots directly
        // underneath (Armor→defense, Damage→weapons, Speed→ability, Energy→energy;
        // Health has hull only, so an empty spacer keeps the row height even).
        const thumbInner = (thumbClass === 'hs-ship-thumb-bp'
            ? `<span class="hs-ship-thumb-type">${this.iconHtml('hsShip', 48, 'hs-pixel')}</span>`
            : `<span class="hs-ship-thumb-empty">${this.iconHtml('hsShip', 48, 'hs-pixel', false)}</span>` +
              `<canvas width="140" height="110" data-area-thumb="${id}|"></canvas>`) +
            (actionHtml != null ? `<span class="hs-ship-thumb-action">${actionHtml}</span>` : '');
        return `<tr class="hs-ship-id-row">` +
            `<td class="hs-ship-table-thumb"><span class="hs-ship-thumb ${thumbClass}" data-open-anatomy-modal="${id}" data-ui-tip="EDIT ANATOMY" role="button" tabindex="0">` +
            thumbInner +
            `</span></td>` +
            `<td class="hs-ship-table-name" data-ui-tip="${tipText}">` +
            `<strong>${this.shipName(id)}${tierStarsHtml}</strong>` +
            (() => {
                const modelClass = (typeof this.shipModelClass === 'function') ? this.shipModelClass(id, cfg) : null;
                const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
                const caps = (slm && slm.getSlotCaps) ? slm.getSlotCaps(id, modelClass) : {};
                const loadout = (slm && slm.getLoadout) ? slm.getLoadout(id) : {};
                // Size level (0 S, 1 M, 2 L) sizes the dot itself and is spelled out in
                // the tooltip head, same S/M/L the hangar slot-upgrade menu uses.
                const SIZE_LABEL = ['S', 'M', 'L'];
                const BUCKET_OF = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy' };
                const dot = (kind, label, filledId, split, sizeLevel) => {
                    // Full item tooltip (name, description, stats, type/tier) — not just
                    // the bare name — same detail level the storage-grid cells show.
                    const tip = filledId
                        ? String(this.hangarModuleTip(kind, filledId) || this.hangarModuleLabel(filledId)).replace(/"/g, '&quot;')
                        : (split
                            ? ('EMPTY SPLIT ' + label + ' SLOT · L/R PAIR')
                            : ('EMPTY ' + label + ' SLOT'));
                    const lv = Math.max(0, Math.min(2, Number(sizeLevel) || 0));
                    const sizeTag = SIZE_LABEL[lv];
                    // Hidden physical-item casing, same art the storage grid uses — invisible on
                    // the dot itself (0×0), but ui-tooltip.js picks up its .hs-item-body
                    // background-image to show the actual item icon in the tooltip head.
                    let icon = '';
                    if (filledId && this._storageItemMeta && typeof physicalItem !== 'undefined') {
                        const meta = this._storageItemMeta(BUCKET_OF[kind] || 'weapons', filledId);
                        icon = physicalItem.wrap(meta.kind, meta.physId, 48, 48, meta.color, '');
                    }
                    return `<span class="hs-ship-slot-dot hs-ship-slot-dot-size-${lv}${filledId ? ' is-filled' : ''}${split ? ' is-split' : ''}" data-slot-kind="${kind}" data-slot-size="${sizeTag}"` +
                        (filledId ? ` data-module-id="${filledId}"` : '') +
                        ` data-ui-tip-instant data-ui-tip-head="${label} · ${sizeTag}" data-ui-tip="${tip}">${icon}</span>`;
                };
                // Weapons are positional (weaponSlots[i] === null means that exact slot is
                // empty); the other categories have no slot index, so the first N equipped
                // ids fill the first N dots and the rest render empty.
                const padDots = (kind, label, ids, count, isSplit) => {
                    const list = ids || [];
                    const out = [];
                    for (let i = 0; i < (count || 0); i++) {
                        const split = isSplit && isSplit(i);
                        let sizeLevel = (slm && slm.getSlotSizeLevel) ? slm.getSlotSizeLevel(id, kind, i) : 1;
                        // A split mount's own slot level is stored as S (it's a pair of
                        // half-size sockets) but displays as its full M/L mount size —
                        // same bump shipLoadoutManager.partFitsSlot applies for fit checks.
                        if (split) sizeLevel = Math.max(sizeLevel, 1);
                        out.push(dot(kind, label, list[i] || null, split, sizeLevel));
                    }
                    return out;
                };
                // loadout.weaponSlots only lists slots currently in use — pad it out to every
                // mount the ship actually has (weaponMountSlots(caps.weapons)) so unused mounts
                // show up as empty dots too, not just the ones already touched.
                const weaponMounts = (slm && slm.weaponMountSlots) ? slm.weaponMountSlots(caps.weapons) : (loadout.weaponSlots || []).length;
                // A split weapon mount is a mirrored pair (wing/split guns) sharing one
                // dot — mark it so the CSS can draw a vertical divider through it.
                const isSplitWeapon = (i) => (slm && slm.isSplitSlot) ? slm.isSplitSlot(id, 'weapon', i) : false;
                const weaponDots = padDots('weapon', 'WEAPON', loadout.weaponSlots, Math.max(weaponMounts, (loadout.weaponSlots || []).length), isSplitWeapon);
                const defenseDots = padDots('defense', 'SHIELD', loadout.defenses, caps.defenses);
                const abilityDots = padDots('ability', 'ABILITY', loadout.abilities, caps.abilities);
                const energyDots = padDots('energy', 'ENERGY', loadout.energy, caps.energy);
                // One column = one stat + its matching slot kind under it. Multiple mounts
                // of the same kind share that column (side by side), so a second gun never
                // pushes Energy's bar under Speed.
                const col = (key, statHtml, dots) => {
                    const dotsHtml = (dots && dots.length)
                        ? `<span class="hs-ship-slot-dots">${dots.join('')}</span>`
                        : `<span class="hs-ship-slot-dots is-empty" aria-hidden="true"></span>`;
                    return `<div class="hs-ship-meta-col" data-stat-col="${key}">${statHtml}${dotsHtml}</div>`;
                };
                return `<div class="hs-ship-meta">` +
                    col('health', stat('statHealth', 'Health', merged.maxHealth, '#5cff7a', null, 'health'), []) +
                    col('armor', stat('statArmor', 'Armor', liveArmor, '#5ce1ff', null, 'armor'), defenseDots) +
                    col('damage', stat('statDamage', 'Damage', liveDamage, '#ff5a3c', damageTip, 'damage'), weaponDots) +
                    col('speed', stat('statSpeed', 'Speed', merged.speed, '#c58bff', null, 'speed'), abilityDots) +
                    col('energy', stat('statEnergy', 'Energy', merged.maxEnergy, '#ffd24a', null, 'energy'), energyDots) +
                    (note ? `<span class="hs-ship-meta-note">${note}</span>` : '') +
                    `</div>`;
            })() +
            `</td>` +
            `</tr>`;
    },

    /** Hovering a ship row's slot dot highlights the same module's icon wherever
     * else it's shown on screen (parts list / hangar grid), matched by the id
     * both sides already carry (data-module-id here, data-part-id there). */
    bindShipSlotDotHoverHighlight() {
        if (!this.overlay) return;
        // Bound once on the overlay root (stable for the UI's whole lifetime), not on
        // the ship table itself — that table is torn down and rebuilt on every tab
        // switch/refresh, so a listener attached to it (even re-attached per render)
        // can race a cached/soft re-render that skips the rebind step and silently
        // leave hovering dead with no console error.
        if (this.overlay.dataset.slotDotHoverBound === '1') return;
        this.overlay.dataset.slotDotHoverBound = '1';
        const clearHighlight = () => {
            this.overlay.querySelectorAll('.is-slot-hover-highlight').forEach((el) => el.classList.remove('is-slot-hover-highlight'));
        };
        const escId = (id) => (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(id) : id;
        this.overlay.addEventListener('pointerover', (e) => {
            const dot = e.target && e.target.closest ? e.target.closest('.hs-ship-slot-dot[data-module-id]') : null;
            if (dot) {
                const id = dot.getAttribute('data-module-id');
                clearHighlight();
                if (this.clearShipStatCompareMarks) this.clearShipStatCompareMarks();
                dot.classList.add('is-slot-hover-highlight');
                this.overlay.querySelectorAll(`[data-part-id="${escId(id)}"]`).forEach((el) => el.classList.add('is-slot-hover-highlight'));
                return;
            }
            // Reverse direction: hovering an assigned item (storage grid / parts
            // list) pulses the matching slot dot(s) on the ship row.
            const item = e.target && e.target.closest ? e.target.closest('[data-part-id]') : null;
            if (!item) return;
            const id = item.getAttribute('data-part-id');
            clearHighlight();
            if (this.clearShipStatCompareMarks) this.clearShipStatCompareMarks();
            item.classList.add('is-slot-hover-highlight');
            this.overlay.querySelectorAll(`.hs-ship-slot-dot[data-module-id="${escId(id)}"]`).forEach((el) => el.classList.add('is-slot-hover-highlight'));
            // Storage weapon hover: punch ship damage green/red vs the mounted gun.
            if (item.getAttribute('data-part-kind') === 'weapon' && this.markShipStatCompareForWeapon) {
                const shipId = item.getAttribute('data-drag-ship')
                    || item.getAttribute('data-ship')
                    || (typeof profileManager !== 'undefined' && profileManager.getActiveProfile
                        ? ((profileManager.getActiveProfile() || {}).activeShipId || '') : '');
                if (shipId) this.markShipStatCompareForWeapon(shipId, id);
            }
        });
        this.overlay.addEventListener('pointerout', (e) => {
            const source = (e.target && e.target.closest) ? e.target.closest('.hs-ship-slot-dot[data-module-id], [data-part-id]') : null;
            if (!source) return;
            const related = (e.relatedTarget && e.relatedTarget.closest) ? e.relatedTarget.closest('.hs-ship-slot-dot[data-module-id], [data-part-id]') : null;
            if (related === source) return;
            clearHighlight();
            if (this.clearShipStatCompareMarks) this.clearShipStatCompareMarks();
            // Keep equipment-tab selection marks if a part stays selected.
            if (this.markShipStatsWorseForSelected && this.expandedEquipItem) {
                const p = typeof profileManager !== 'undefined' && profileManager.getActiveProfile
                    ? profileManager.getActiveProfile() : null;
                const shipId = (p && p.activeShipId) || '';
                if (shipId) this.markShipStatsWorseForSelected(shipId);
            }
        });
    },
});
