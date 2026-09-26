"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Cargo teleport, station upgrade tree, unlocks, purchases and crafting. */
    bindStationEvents() {
        const teleport = this.overlay.querySelector('#hsTeleport');
        if (teleport) {
            teleport.addEventListener('click', () => {
                if (typeof profileManager === 'undefined') return;
                if (!profileManager.hasCargo()) {
                    this.playButtonResult(teleport, false, 'CARGO EMPTY');
                    return;
                }
                const moved = profileManager.teleportCargoToStation();
                if (!moved) {
                    this.playButtonResult(teleport, false, 'STATION FULL — UPGRADE STORAGE');
                    return;
                }
                if (profileManager.hasCargo()) {
                    this.playButtonResult(teleport, true, 'PARTIAL TELEPORT — STORAGE FULL');
                } else {
                    this.playButtonResult(teleport, true, 'CARGO TELEPORTED TO STATION');
                }
            });
        }

        this.overlay.querySelectorAll('[data-upgrade-node]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                const id = btn.getAttribute('data-upgrade-node');
                this.selectedUpgradeNode = id;
                if (btn.hasAttribute('data-upgrade')) {
                    return;
                }
                ev.preventDefault();
                const node = (typeof economyConfig !== 'undefined')
                    ? economyConfig.getStationUpgradeNode(id)
                    : null;
                if (!node) return;
                const profile = this.getProfile();
                const level = profileManager.getStationUpgradeLevel(id, profile);
                if (level >= node.maxLevel) {
                    this.playButtonResult(btn, true, node.label + ' · MAX');
                    return;
                }
                const check = profileManager.canUnlockStationUpgrade(id, profile);
                if (check.reason === 'LOCKED') {
                    const req = economyConfig.getStationUpgradeNode(node.requires);
                    const reqName = req ? req.label : String(node.requires || '').toUpperCase();
                    this.playButtonResult(btn, false, 'REQ ' + reqName + ' L' + (node.requireLevel || 1));
                } else if (check.reason === 'RESOURCES') {
                    const cost = check.cost || economyConfig.getStationUpgradeCost(id, level + 1);
                    this.openResourceBuyModal({
                        title: node.label + ' · L' + (level + 1),
                        cost: cost,
                        action: { type: 'station-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, check.reason || node.label);
                }
            });
        });
        this.bindUpgradeTipEvents();

        this.overlay.querySelectorAll('[data-upgrade]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-upgrade');
                this.selectedUpgradeNode = id;
                const res = profileManager.buyStationUpgrade(id);
                if (res.ok) {
                    const node = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeNode(id)
                        : null;
                    const label = node ? node.label : String(id || '').toUpperCase();
                    this.playButtonResult(btn, true, 'UPGRADED: ' + label + ' L' + res.level);
                } else if (res.reason === 'RESOURCES') {
                    const profile = this.getProfile();
                    const node = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeNode(id)
                        : null;
                    const level = profileManager.getStationUpgradeLevel(id, profile);
                    const cost = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeCost(id, level + 1)
                        : null;
                    this.openResourceBuyModal({
                        title: (node ? node.label : String(id || '').toUpperCase()) + ' · L' + (level + 1),
                        cost: cost,
                        action: { type: 'station-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-unlock]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-unlock');
                const res = profileManager.unlockShopItem(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('UNLOCKED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy');
                const res = profileManager.buyShip(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('PURCHASED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-bp]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy-bp');
                const res = profileManager.buyBlueprint(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('BLUEPRINT: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-part]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-buy-part') || '';
                const sep = raw.indexOf(':');
                const kind = sep === -1 ? '' : raw.slice(0, sep);
                const id = sep === -1 ? raw : raw.slice(sep + 1);
                const res = profileManager.buyPart(kind, id, this.visitPostId || null);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('PART: ' + id.toUpperCase()) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-portal]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-buy-portal');
                const res = profileManager.buyPortal(gid);
                if (res.ok) {
                    const name = String(gid).replace(/_/g, ' ').toUpperCase();
                    this.playButtonResult(btn, true, 'PORTAL UNLOCKED: ' + name);
                } else if (res.reason === 'UNKNOWN FACTION') {
                    this.playButtonResult(btn, false, 'MEET THIS FACTION IN COMBAT FIRST');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-craft]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-craft');
                const res = profileManager.craftShip(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('CRAFTED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });
    },

    /** Hangar ship list, anatomy reset, module toggles, fire modes and test area. */
    bindHangarTabEvents() {
        this.overlay.querySelectorAll('[data-hangar-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const selectedShipId = btn.getAttribute('data-hangar-ship');
                if (selectedShipId === this.hangarShipId) return;
                this.hangarShipId = selectedShipId;
                this.statusMsg = '';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-hangar-sidebar]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.toggleHangarSidebar(btn.getAttribute('data-hangar-sidebar'));
            });
        });
        const resetAnatomy = this.overlay.querySelector('#hsResetAnatomy');
        if (resetAnatomy) resetAnatomy.addEventListener('click', () => this.resetHangarAnatomy());
        this.overlay.querySelectorAll('[data-activate-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-activate-ship');
                if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
                    profileManager.setActiveShip(id);
                } else if (typeof profileManager !== 'undefined') {
                    const p = profileManager.getActiveProfile();
                    if (p) {
                        p.activeShipId = id;
                        profileManager.save();
                    }
                }
                if (typeof shipConfigManager !== 'undefined') {
                    shipConfigManager.applyToRuntime(id);
                }
                this.playButtonResult(btn, true, 'ACTIVE: ' + this.shipName(id));
            });
        });

        this.overlay.querySelectorAll('[data-toggle-mod]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const kind = btn.getAttribute('data-toggle-mod');
                const modId = btn.getAttribute('data-mod-id');
                if (e.altKey || e.shiftKey) {
                    e.preventDefault();
                    this.openComponentEditorForModule(kind, modId);
                    return;
                }
                if (typeof shipLoadoutManager === 'undefined') return;
                const check = shipLoadoutManager.canInstallModule(this.hangarShipId, kind, modId);
                if (!check.ok && !check.removing) {
                    let msg = 'SLOT FULL — UPGRADE FRAME';
                    if (check.reason === 'NEED_CHARGE_SHOT') msg = 'NEED CHARGE SHOT FIRST';
                    if (check.reason === 'NEED_CHARGE_DRIVE') msg = 'NEED CHARGE DRIVE FIRST';
                    this.playButtonResult(btn, false, msg);
                    return;
                }
                shipLoadoutManager.toggleModule(this.hangarShipId, kind, modId);
                if (typeof shipConfigManager !== 'undefined') {
                    const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                        ? profileManager.getActiveProfile().activeShipId
                        : this.hangarShipId;
                    if (active === this.hangarShipId) {
                        shipConfigManager.applyToRuntime(this.hangarShipId);
                    }
                }
                const L = shipLoadoutManager.getLoadout(this.hangarShipId);
                const n = shipLoadoutManager.moduleCount(L);
                this.playButtonResult(btn, true, 'LOADOUT UPDATED · ' + n + ' MODULES');
            });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const kind = btn.getAttribute('data-toggle-mod');
                const modId = btn.getAttribute('data-mod-id');
                this.openComponentEditorForModule(kind, modId);
            });
        });

        // Main voxel size slider in the hangar header: live redraw, and keep
        // the other voxel sliders (area panels) in step.
        this.overlay.querySelectorAll('[data-hangar-voxel]').forEach((input) => {
            input.addEventListener('input', () => {
                if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.setVoxelScale) return;
                const value = Number(input.value);
                shipLoadoutManager.setVoxelScale(this.hangarShipId, value);
                const out = this.overlay.querySelector('[data-hangar-voxel-out]');
                if (out) out.textContent = value.toFixed(2) + '×';
                this.overlay.querySelectorAll('[data-voxel-scale]').forEach((other) => {
                    if (other !== input) other.value = String(value);
                });
                this.drawHangarBay();
            });
        });

        this.overlay.querySelectorAll('[data-fire-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-fire-mode');
                if (typeof shipLoadoutManager === 'undefined') return;
                if (mode === 'charge' && !shipLoadoutManager.ownsChargePart('ability', 'charge_shot')) {
                    this.playButtonResult(btn, false, 'BUY CHARGE SHOT IN PARTS SHOP');
                    return;
                }
                const before = shipLoadoutManager.getLoadout(this.hangarShipId);
                shipLoadoutManager.setFireMode(this.hangarShipId, mode);
                const after = shipLoadoutManager.getLoadout(this.hangarShipId);
                if (mode === 'charge' && (after.abilities || []).indexOf('charge_shot') === -1) {
                    this.playButtonResult(btn, false, 'NO ABILITY SLOT — UPGRADE FRAME');
                    return;
                }
                if (typeof shipConfigManager !== 'undefined') {
                    const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                        ? profileManager.getActiveProfile().activeShipId
                        : this.hangarShipId;
                    if (active === this.hangarShipId) {
                        shipConfigManager.applyToRuntime(this.hangarShipId);
                    }
                }
                if (typeof bulletManager !== 'undefined' && bulletManager.setFireMode) {
                    bulletManager.setFireMode(after.fireMode || 'auto');
                }
                if (typeof chargeSystem !== 'undefined' && typeof shipConfigManager !== 'undefined') {
                    const model = shipConfigManager.getMergedModel(this.hangarShipId);
                    if (model) chargeSystem.syncFromShipModel(model);
                }
                void before;
                this.playButtonResult(btn, true, 'FIRE MODE: ' + String(after.fireMode || 'auto').toUpperCase());
            });
        });

        const openTest = this.overlay.querySelector('#hsOpenTestArea');
        if (openTest) {
            openTest.addEventListener('click', () => this.openHangarTestArea());
        }
    },
});
