"use strict";

/**
 * In-stage shop: opened from the victory screen between stages.
 * Two vendor grids — TEMP PERKS (next stage only, stronger than crate drops)
 * and PERMANENT PARTS (owned modules that stay in storage).
 *
 * Layout: local planet inhabitant · perk/part stock · ship/station bags.
 * Gamepad/keyboard: arrows move focus, Enter buys, Escape/B/E closes.
 */
class InStageShop {
    constructor() {
        this.isOpen = false;
        this.fromVictory = false;
        this.prevInteract = false;
        this.lastMsg = '';
        this.pendingBuffs = [];
        this.pendingWeapons = [];
        /** @type {Set<string>} Keys `source::shipId::bucket:id` marked for sale (right-click). */
        this.markedForSale = new Set();
        /** @type {Set<string>} Stock buy keys (`buff:id` / `weapon:id` / `part:kind:id`) in the cart. */
        this.cartBuys = new Set();
        /** Frozen permanent-part offer for this shop visit. */
        this._partsOffer = null;
        this._faceState = 0;
        this._faceUntil = 0;
        this.focusIndex = 0;
        this._stockCols = 3;
        this._hsPatched = false;
        this._hsPrevOverlay = null;
        this._hsPrevCreate = null;
    }

    /**
     * Temp perks for the next stage — stronger / longer than crate pickups.
     * `stats` lines feed the tooltip (damage, ammo, shields, etc.).
     */
    perkCatalog() {
        return {
            buffs: [
                {
                    id: 'barrier', label: 'SHIELD BARRIER', cost: 85, ms: 90000,
                    icon: 'ability_energy_shield',
                    stats: ['DMG TAKEN ×0.5', 'SHIELD HOLD · 90s', 'STACKS WITH SHIELD REGEN']
                },
                {
                    id: 'speed_boost', label: 'AFTERBURNER', cost: 55, ms: 75000,
                    icon: 'ability_high_speed',
                    stats: ['MOVE SPEED ×1.45', 'DURATION 75s']
                },
                {
                    id: 'power_shot', label: 'POWER SHOT', cost: 95, ms: 90000,
                    icon: 'ability_powerful_cannon',
                    stats: ['DAMAGE ×1.6', 'SHOT SIZE ×1.3', 'DURATION 90s']
                },
                {
                    id: 'rapid_fire', label: 'RAPID FIRE', cost: 90, ms: 75000,
                    icon: 'ability_versatile_weapons',
                    stats: ['FIRE RATE ×1.7', 'COOLDOWN ×0.6', 'DURATION 75s']
                },
                {
                    id: 'repair', label: 'FIELD REPAIR', cost: 70, ms: 60000,
                    icon: 'ability_energy_shield',
                    stats: ['HULL REGEN 4%/s', 'DURATION 60s']
                },
                {
                    id: 'magnet', label: 'LOOT MAGNET', cost: 50, ms: 90000,
                    icon: 'ability_high_speed',
                    stats: ['PICKUP RADIUS ×1.8', 'DURATION 90s']
                }
            ],
            /** Temporary weapons — ammo depletes, then reverts. */
            weapons: [
                {
                    id: 'spread', label: 'SPREAD GUN', shots: 48, cost: 65,
                    icon: 'ability_versatile_weapons',
                    stats: ['AMMO 48', 'MULTI-SHOT BURST']
                },
                {
                    id: 'missile', label: 'MISSILES', shots: 18, cost: 95,
                    icon: 'ability_devastating_cannon',
                    stats: ['AMMO 18', 'HIGH DAMAGE']
                },
                {
                    id: 'plasma', label: 'PLASMA CANNON', shots: 32, cost: 110,
                    icon: 'ability_weapon_systems',
                    stats: ['AMMO 32', 'SUSTAINED BEAM']
                }
            ]
        };
    }

    /** @deprecated use perkCatalog — kept for any external callers. */
    catalog() {
        return this.perkCatalog();
    }

    flatPerks() {
        const c = this.perkCatalog();
        return c.buffs.map((i) => Object.assign({ kind: 'buff', stock: 'perk' }, i))
            .concat(c.weapons.map((i) => Object.assign({ kind: 'weapon', stock: 'perk' }, i)));
    }

    flatParts() {
        return (this._partsOffer || this.buildPartsOffer()).slice();
    }

    flatStock() {
        return this.flatPerks().concat(this.flatParts());
    }

    /**
     * Permanent modules for this visit — credit-priced, faction-flavoured,
     * capped so the PARTS grid stays readable.
     */
    buildPartsOffer() {
        const planetFaction = String((this.planetContext().faction) || '').toLowerCase();
        const list = [];
        const push = (kind, id, item) => {
            if (!item || !id) return;
            if (typeof economyConfig === 'undefined' || !economyConfig.getPartCost) return;
            const cost = economyConfig.getPartCost(kind, item);
            const credits = Math.max(0, Math.round(Number(cost && cost.credits) || 0));
            if (credits <= 0) return;
            list.push({
                kind: 'part',
                stock: 'part',
                partKind: kind,
                id: id,
                label: String((item && item.name) || id).toUpperCase(),
                cost: credits,
                item: item,
                icon: kind === 'weapon' ? 'statWeapon'
                    : (kind === 'defense' ? 'statArmor'
                        : (kind === 'energy' ? 'ability_energy_shield' : 'statAbilities'))
            });
        };

        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getIds) {
            weaponConfigManager.getIds().forEach((id) => {
                push('weapon', id, weaponConfigManager.getWeapon(id));
            });
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const by = abilityConfigManager.getIdsByCluster
                ? abilityConfigManager.getIdsByCluster()
                : {};
            (by.defense || []).forEach((id) => {
                push('defense', id, abilityConfigManager.getAbility(id));
            });
            ['mobility', 'offense', 'combat', 'core', 'other'].forEach((cluster) => {
                (by[cluster] || []).forEach((id) => {
                    const a = abilityConfigManager.getAbility(id);
                    if (!a || a.cluster === 'defense') return;
                    if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                        && shipLoadoutManager.isEnergyId(id)) return;
                    push('ability', id, a);
                });
            });
            const core = abilityConfigManager.getAbility('energy_core');
            if (core) push('energy', 'energy_core', core);
        }

        const factionScore = (e) => {
            const f = e.item && e.item.faction != null ? String(e.item.faction).toLowerCase() : '';
            if (f && planetFaction && f === planetFaction) return 0;
            if (!f) return 1;
            return 2;
        };
        list.sort((a, b) => factionScore(a) - factionScore(b) || a.cost - b.cost || a.label.localeCompare(b.label));

        // Keep a tight stash: mix kinds, max 8.
        const picked = [];
        const kindCount = { weapon: 0, defense: 0, ability: 0, energy: 0 };
        const kindCap = { weapon: 3, defense: 2, ability: 2, energy: 1 };
        list.forEach((e) => {
            if (picked.length >= 8) return;
            if ((kindCount[e.partKind] || 0) >= (kindCap[e.partKind] || 1)) return;
            kindCount[e.partKind] = (kindCount[e.partKind] || 0) + 1;
            picked.push(e);
        });
        this._partsOffer = picked;
        return picked;
    }

    /** Current fight planet (or ambush stub) for trader flavour. */
    planetContext() {
        let lvl = null;
        if (typeof game !== 'undefined') {
            if (typeof game.getCurrentLevel === 'function') lvl = game.getCurrentLevel();
            if (!lvl && game.coreLevelManager && game.coreLevelManager.getCurrentLevel) {
                lvl = game.coreLevelManager.getCurrentLevel();
            }
            if (!lvl && game.levelManager && game.levelManager.getCurrentLevel) {
                lvl = game.levelManager.getCurrentLevel();
            }
        }
        const pid = String((lvl && (lvl.planetId || lvl.id)) || '').toLowerCase().split('-')[0];
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const cfg = (pid && pcm && pcm.getConfig) ? pcm.getConfig(pid) : null;
        const isAmbush = pid.indexOf('ambush_') === 0;
        let faction = 'terran';
        if (isAmbush) {
            faction = 'pirate';
        } else if (pcm && pcm.getPlanetFactions && pid) {
            const list = pcm.getPlanetFactions(pid) || [];
            if (list[0]) faction = String(list[0]).toLowerCase();
        }
        let name = String((lvl && lvl.planetName) || (cfg && cfg.name) || pid || 'UNKNOWN').toUpperCase();
        if (isAmbush && (!name || name.indexOf('AMBUSH_') === 0 || name === pid.toUpperCase())) {
            name = 'PIRATE OUTPOST';
        }
        let hash = 0;
        const seed = pid || name;
        for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
        const v = Math.abs(hash) % 16;
        return { planetId: pid, name, faction, variant: v, isAmbush };
    }

    update(_deltaTime, _keys) {
        /* portraits animate via voxelPortrait rAF */
    }

    show(opts) {
        if (this.isOpen) return;
        this.isOpen = true;
        this.fromVictory = !!(opts && opts.fromVictory);
        this._faceState = 0;
        this._faceUntil = 0;
        this.focusIndex = 0;
        this.markedForSale.clear();
        this.cartBuys.clear();
        this._partsOffer = null;
        this.buildPartsOffer();
        if (!this.fromVictory
            && typeof game !== 'undefined'
            && game.gameState
            && game.gameState.pauseGame) {
            game.gameState.pauseGame();
        }
        this.renderDom();
    }

    showFromVictory() {
        this.show({ fromVictory: true });
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.markedForSale.clear();
        this.cartBuys.clear();
        this._unpatchHomeStation();
        if (this._faceRaf) cancelAnimationFrame(this._faceRaf);
        this._faceRaf = null;
        const el = document.getElementById('vf-in-stage-shop');
        if (el) el.remove();
        const wasVictory = this.fromVictory;
        this.fromVictory = false;
        if (!wasVictory
            && typeof game !== 'undefined'
            && game.gameState
            && game.gameState.resumeGame) {
            game.gameState.resumeGame();
        }
    }

    /** Route hangar storage drag drops back into this shop UI while open. */
    _patchHomeStation() {
        if (this._hsPatched || typeof homeStationUI === 'undefined') return;
        this._hsPrevOverlay = homeStationUI.overlay;
        this._hsPrevCreate = typeof homeStationUI.createUI === 'function'
            ? homeStationUI.createUI.bind(homeStationUI)
            : null;
        const shop = this;
        homeStationUI.overlay = document.getElementById('vf-in-stage-shop');
        homeStationUI.createUI = function () {
            if (shop.isOpen) shop.renderDom();
            else if (shop._hsPrevCreate) shop._hsPrevCreate();
        };
        this._hsPatched = true;
    }

    _unpatchHomeStation() {
        if (!this._hsPatched || typeof homeStationUI === 'undefined') return;
        homeStationUI.overlay = this._hsPrevOverlay;
        if (this._hsPrevCreate) homeStationUI.createUI = this._hsPrevCreate;
        this._hsPatched = false;
        this._hsPrevOverlay = null;
        this._hsPrevCreate = null;
    }

    _syncHomeStationOverlay() {
        if (typeof homeStationUI === 'undefined') return;
        this._patchHomeStation();
        homeStationUI.overlay = document.getElementById('vf-in-stage-shop');
    }

    saleMarkKey(source, shipId, dragKey) {
        return `${source || ''}::${shipId || ''}::${dragKey || ''}`;
    }

    parseSaleMarkKey(mark) {
        const parts = String(mark || '').split('::');
        return {
            source: parts[0] || '',
            shipId: parts[1] || '',
            dragKey: parts.slice(2).join('::') || ''
        };
    }

    bucketToSellKind(bucket) {
        if (bucket === 'weapons') return 'weapon';
        if (bucket === 'defenses') return 'defense';
        if (bucket === 'abilities') return 'ability';
        if (bucket === 'energy') return 'energy';
        return '';
    }

    /** Credits the trader would pay for one unit of this storage cell. */
    sellValueForCell(cell) {
        if (typeof profileManager === 'undefined') return 0;
        const kind = cell.getAttribute('data-part-kind') || '';
        const id = cell.getAttribute('data-part-id') || '';
        if (!id) return 0;
        let raw = 0;
        if (kind === 'blueprint') {
            raw = profileManager.getBlueprintSellValue
                ? profileManager.getBlueprintSellValue(id)
                : 0;
        } else {
            raw = profileManager.getPartSellValue
                ? profileManager.getPartSellValue(kind, id)
                : 0;
        }
        return Math.max(0, Math.round(Number(raw) || 0));
    }

    sellValueForMark(mark) {
        const { dragKey } = this.parseSaleMarkKey(mark);
        const sep = dragKey.indexOf(':');
        const bucket = sep === -1 ? '' : dragKey.slice(0, sep);
        const id = sep === -1 ? dragKey : dragKey.slice(sep + 1);
        if (!id || typeof profileManager === 'undefined') return 0;
        let raw = 0;
        if (bucket === 'blueprints') {
            raw = profileManager.getBlueprintSellValue
                ? profileManager.getBlueprintSellValue(id)
                : 0;
        } else {
            const kind = this.bucketToSellKind(bucket);
            raw = kind && profileManager.getPartSellValue
                ? profileManager.getPartSellValue(kind, id)
                : 0;
        }
        return Math.max(0, Math.round(Number(raw) || 0));
    }

    markedSalePayout() {
        let total = 0;
        this.markedForSale.forEach((mark) => { total += this.sellValueForMark(mark); });
        return Math.max(0, Math.round(total));
    }

    /** Buy-key used in cart / data-shop-buy. */
    stockBuyKey(item) {
        if (!item) return '';
        if (item.kind === 'part') return `part:${item.partKind}:${item.id}`;
        return `${item.kind}:${item.id}`;
    }

    cartBuyCost() {
        let total = 0;
        this.cartBuys.forEach((key) => {
            const item = this.resolveBuyKey(key);
            total += Math.max(0, Math.round(Number(item && item.cost) || 0));
        });
        return total;
    }

    /** Credits after settling marked sells then cart buys (preview only). */
    projectedCredits() {
        return Math.max(0, this.getCredits() + this.markedSalePayout() - this.cartBuyCost());
    }

    tradeNet() {
        return this.markedSalePayout() - this.cartBuyCost();
    }

    canAffordCartItem(item) {
        if (!item) return false;
        const key = this.stockBuyKey(item);
        const already = this.cartBuys.has(key);
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        // Removing from cart is always allowed; adding needs headroom after sells − other cart lines.
        if (already) return true;
        const others = this.cartBuyCost(); // includes this only if already in cart
        return this.getCredits() + this.markedSalePayout() - others >= cost;
    }

    toggleCartBuy(item) {
        if (!item) return false;
        const key = this.stockBuyKey(item);
        if (!key) return false;
        if (this.cartBuys.has(key)) {
            this.cartBuys.delete(key);
            this.applyCartMarks();
            this.updateCompleteButton();
            this.updateWalletProjection();
            return true;
        }
        if (!this.canAffordCartItem(item)) {
            this.flashFace('sad');
            this.lastMsg = 'NOT ENOUGH CREDITS';
            return false;
        }
        this.cartBuys.add(key);
        this.applyCartMarks();
        this.updateCompleteButton();
        this.updateWalletProjection();
        return true;
    }

    applyCartMarks() {
        const root = document.getElementById('vf-in-stage-shop');
        if (!root) return;
        root.querySelectorAll('[data-shop-buy]').forEach((cell) => {
            const key = cell.getAttribute('data-shop-buy') || '';
            const on = this.cartBuys.has(key);
            cell.classList.toggle('is-in-cart', on);
            let badge = cell.querySelector('.vf-iss-cart-mark');
            if (on) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'vf-iss-cart-mark';
                    cell.appendChild(badge);
                }
                badge.textContent = 'CART';
            } else if (badge) {
                badge.remove();
            }
        });
    }

    updateWalletProjection() {
        const root = document.getElementById('vf-in-stage-shop');
        if (!root) return;
        const now = this.getCredits();
        const next = this.projectedCredits();
        const cash = root.querySelector('.vf-iss-trader-cash');
        if (cash) {
            cash.textContent = (this.cartBuys.size || this.markedForSale.size)
                ? `${now}c → ${next}c`
                : `${now}c ON HAND`;
        }
        const chip = root.querySelector('.vf-iss-wallet-item[data-wallet="credits"] b');
        if (chip) {
            chip.textContent = String(
                (this.cartBuys.size || this.markedForSale.size) ? next : now
            );
        }
    }

    toggleMarkForSale(cell) {
        if (!cell || cell.classList.contains('is-equipped')) {
            this.flashFace('sad');
            this.lastMsg = 'UNEQUIP FIRST';
            return false;
        }
        const dragKey = cell.getAttribute('data-drag-key') || '';
        const source = cell.getAttribute('data-drag-source') || '';
        const shipId = cell.getAttribute('data-drag-ship') || '';
        if (!dragKey || !source) return false;
        const mark = this.saleMarkKey(source, shipId, dragKey);
        if (this.markedForSale.has(mark)) this.markedForSale.delete(mark);
        else this.markedForSale.add(mark);
        this.applySaleMarks();
        this.updateCompleteButton();
        this.updateWalletProjection();
        return true;
    }

    applySaleMarks() {
        const root = document.getElementById('vf-in-stage-shop');
        if (!root) return;
        const cells = Array.from(root.querySelectorAll(
            '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
        ));
        // After a bag-to-bag drag the cell's source/ship changes — rematch by drag-key.
        if (this.markedForSale.size) {
            const next = new Set();
            this.markedForSale.forEach((mark) => {
                const { dragKey } = this.parseSaleMarkKey(mark);
                const cell = cells.find((c) => c.getAttribute('data-drag-key') === dragKey);
                if (!cell) return;
                next.add(this.saleMarkKey(
                    cell.getAttribute('data-drag-source') || '',
                    cell.getAttribute('data-drag-ship') || '',
                    dragKey
                ));
            });
            this.markedForSale = next;
        }
        cells.forEach((cell) => {
            const mark = this.saleMarkKey(
                cell.getAttribute('data-drag-source') || '',
                cell.getAttribute('data-drag-ship') || '',
                cell.getAttribute('data-drag-key') || ''
            );
            const on = this.markedForSale.has(mark);
            cell.classList.toggle('is-for-sale', on);
            let badge = cell.querySelector('.vf-iss-sell-mark');
            if (on) {
                const val = this.sellValueForCell(cell);
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'vf-iss-sell-mark';
                    cell.appendChild(badge);
                }
                badge.textContent = `SELL +${val}c`;
            } else if (badge) {
                badge.remove();
            }
        });
    }

    updateCompleteButton() {
        const btn = document.querySelector('#vf-in-stage-shop [data-shop-complete]');
        if (!btn) return;
        const sells = this.markedForSale.size;
        const buys = this.cartBuys.size;
        const pay = this.markedSalePayout();
        const spend = this.cartBuyCost();
        const net = pay - spend;
        const busy = sells > 0 || buys > 0;
        const canSettle = busy && this.projectedCredits() >= 0
            && this.getCredits() + pay >= spend;
        btn.disabled = !canSettle;
        btn.classList.toggle('is-ready', canSettle);
        if (!busy) {
            btn.textContent = 'COMPLETE TRADE';
            return;
        }
        const bits = [];
        if (buys) bits.push(`BUY −${spend}c`);
        if (sells) bits.push(`SELL +${pay}c`);
        bits.push(`NET ${net >= 0 ? '+' : ''}${net}c`);
        btn.textContent = `COMPLETE TRADE (${bits.join(' · ')})`;
    }

    /**
     * Settle cart: sell marked inventory first (credits in), then purchase
     * cart stock (credits out). Nothing is charged until this runs.
     */
    completeTrade() {
        if ((!this.markedForSale.size && !this.cartBuys.size)
            || typeof profileManager === 'undefined') {
            this.flashFace('sad');
            return false;
        }
        const profile = this.getProfile();
        if (!profile) {
            this.flashFace('sad');
            return false;
        }

        let gained = 0;
        let sold = 0;
        Array.from(this.markedForSale).forEach((mark) => {
            const res = this._sellMarkedUnit(profile, mark);
            if (res && res.ok) {
                sold += 1;
                gained += Math.max(0, Math.round(Number(res.credits) || 0));
                this.markedForSale.delete(mark);
            }
        });

        let spent = 0;
        let bought = 0;
        const buyKeys = Array.from(this.cartBuys);
        buyKeys.forEach((key) => {
            const item = this.resolveBuyKey(key);
            if (!item) {
                this.cartBuys.delete(key);
                return;
            }
            const cost = Math.max(0, Math.round(Number(item.cost) || 0));
            if (!profileManager.canAffordCredits(cost)) return;
            if (!this._fulfillCartBuy(item)) return;
            this.cartBuys.delete(key);
            spent += cost;
            bought += 1;
        });

        if (sold <= 0 && bought <= 0) {
            this.flashFace('sad');
            this.lastMsg = 'TRADE FAILED';
            this.updateCompleteButton();
            return false;
        }
        this.flashFace('happy');
        const net = gained - spent;
        this.lastMsg = `TRADE · +${gained}c / −${spent}c · NET ${net >= 0 ? '+' : ''}${net}c`;
        this.renderDom();
        return true;
    }

    /** Spend + grant one cart line (perk queue / temp weapon / permanent part). */
    _fulfillCartBuy(item) {
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        if (!profileManager.spendCredits(cost)) return false;
        if (item.kind === 'part') {
            const profile = this.getProfile();
            if (!profile) {
                if (profileManager.addCredits) profileManager.addCredits(cost, true);
                return false;
            }
            if (profileManager.ensureEconomyDefaults) profileManager.ensureEconomyDefaults(profile);
            const bag = item.partKind === 'weapon' ? profile.parts.weapons
                : (item.partKind === 'defense' ? profile.parts.defenses
                    : (item.partKind === 'energy' ? profile.parts.energy : profile.parts.abilities));
            if (!bag) {
                if (profileManager.addCredits) profileManager.addCredits(cost, true);
                return false;
            }
            bag[item.id] = (bag[item.id] || 0) + 1;
            const discoverCat = item.partKind === 'weapon' ? 'weapons'
                : (item.partKind === 'defense' ? 'defenses'
                    : (item.partKind === 'energy' ? 'energy' : 'abilities'));
            if (profileManager.discover) profileManager.discover(discoverCat, item.id);
            profileManager.save();
            return true;
        }
        if (item.kind === 'weapon') {
            if (this.fromVictory) {
                this.pendingWeapons.push({
                    id: item.id, shots: item.shots, cost: cost, label: item.label, icon: item.icon
                });
            } else if (typeof bulletManager !== 'undefined' && bulletManager.equipTemporaryWeapon) {
                bulletManager.equipTemporaryWeapon(item.id, item.shots);
            }
            return true;
        }
        // buff / perk
        if (this.fromVictory) {
            this.pendingBuffs.push({
                id: item.id, ms: item.ms, cost: cost, label: item.label, icon: item.icon
            });
        } else if (typeof pickupManager !== 'undefined' && pickupManager.grantPowerUp) {
            pickupManager.grantPowerUp(item.id, item.ms);
        }
        return true;
    }

    _sellMarkedUnit(profile, mark) {
        const { source, shipId, dragKey } = this.parseSaleMarkKey(mark);
        const sep = dragKey.indexOf(':');
        const bucket = sep === -1 ? '' : dragKey.slice(0, sep);
        const id = sep === -1 ? dragKey : dragKey.slice(sep + 1);
        if (!bucket || !id) return { ok: false, reason: 'BAD KEY' };

        if (bucket === 'blueprints') {
            return profileManager.sellBlueprint
                ? profileManager.sellBlueprint(id)
                : { ok: false, reason: 'NO API' };
        }

        const kind = this.bucketToSellKind(bucket);
        if (!kind) return { ok: false, reason: 'BAD BUCKET' };

        // Equipped-only: refuse (marking already blocks, but re-check).
        if (source === 'ship' && shipId
            && typeof profileManager._equippedStorageCount === 'function'
            && profileManager._equippedStorageCount(profile, shipId, bucket, id) > 0) {
            const entry = (profile.shipStorage || {})[shipId];
            const filed = (entry && entry[bucket] && entry[bucket][id]) || 0;
            if (filed <= 0) return { ok: false, reason: 'EQUIPPED' };
        }

        // Filed ship cargo must leave the ship's ledger before ownership drops.
        if (source === 'ship' && shipId && profileManager.consumeFiledPart) {
            const entry = (profile.shipStorage || {})[shipId];
            const filed = (entry && entry[bucket] && entry[bucket][id]) || 0;
            if (filed > 0) profileManager.consumeFiledPart(profile, shipId, bucket, id);
        }

        return profileManager.sellPart
            ? profileManager.sellPart(kind, id)
            : { ok: false, reason: 'NO API' };
    }

    /** Pointer drag-sort / bag transfer via HomeStationUI storage drag engine. */
    bindInventoryInteractions(root) {
        if (!root || typeof homeStationUI === 'undefined') return;
        this._syncHomeStationOverlay();
        const bags = root.querySelectorAll('.vf-iss-ship-inv, .vf-iss-station-inv');
        bags.forEach((bag) => {
            bag.querySelectorAll('.hs-storage-cell[data-drag-key]').forEach((cell) => {
                cell.setAttribute('draggable', 'false');
                cell.addEventListener('dragstart', (e) => e.preventDefault());
                cell.addEventListener('pointerdown', (ev) => {
                    if (ev.button !== 0) return;
                    this._syncHomeStationOverlay();
                    homeStationUI._storageDragStart(ev, cell);
                });
            });
        });
    }

    getCredits() {
        return (typeof profileManager !== 'undefined' && profileManager.getCredits) ? profileManager.getCredits() : 0;
    }

    getProfile() {
        if (typeof profileManager === 'undefined' || !profileManager.getActiveProfile) return null;
        return profileManager.getActiveProfile();
    }

    resolveBuyKey(raw) {
        const key = String(raw || '');
        if (key.startsWith('part:')) {
            const rest = key.slice(5);
            const sep = rest.indexOf(':');
            const partKind = sep === -1 ? '' : rest.slice(0, sep);
            const id = sep === -1 ? rest : rest.slice(sep + 1);
            return this.flatParts().find((i) => i.partKind === partKind && i.id === id) || null;
        }
        const sep = key.indexOf(':');
        const kind = sep === -1 ? key : key.slice(0, sep);
        const id = sep === -1 ? '' : key.slice(sep + 1);
        return this.flatPerks().find((i) => i.kind === kind && i.id === id) || null;
    }

    /** Left-click stock: toggle cart line — credits move only on COMPLETE TRADE. */
    purchaseItem(item) {
        return this.toggleCartBuy(item);
    }

    buyFocused() {
        const list = this.focusables();
        const el = list[this.focusIndex];
        if (!el) return;
        if (el.hasAttribute('data-shop-close')) {
            this.close();
            return;
        }
        if (el.hasAttribute('data-shop-complete')) {
            this.completeTrade();
            return;
        }
        const key = el.getAttribute('data-shop-buy');
        if (!key) return;
        this.purchaseItem(this.resolveBuyKey(key));
    }

    applyPending() {
        const buffs = this.pendingBuffs.splice(0, this.pendingBuffs.length);
        const weapons = this.pendingWeapons.splice(0, this.pendingWeapons.length);
        buffs.forEach((item) => {
            if (typeof pickupManager !== 'undefined' && pickupManager.grantPowerUp) {
                pickupManager.grantPowerUp(item.id, item.ms);
            }
        });
        weapons.forEach((item) => {
            if (typeof bulletManager !== 'undefined' && bulletManager.equipTemporaryWeapon) {
                bulletManager.equipTemporaryWeapon(item.id, item.shots);
            }
        });
    }

    refundPending() {
        let back = 0;
        this.pendingBuffs.forEach((item) => { back += Number(item.cost) || 0; });
        this.pendingWeapons.forEach((item) => { back += Number(item.cost) || 0; });
        this.pendingBuffs.length = 0;
        this.pendingWeapons.length = 0;
        if (back > 0 && typeof profileManager !== 'undefined' && profileManager.addCredits) {
            profileManager.addCredits(back);
        } else if (back > 0 && typeof profileManager !== 'undefined' && profileManager.getCredits) {
            const cur = profileManager.getCredits() || 0;
            if (typeof profileManager.setCredits === 'function') {
                profileManager.setCredits(cur + back);
            }
        }
    }

    flashFace(state) {
        this._faceState = state === 'happy' ? 3 : (state === 'sad' ? 4 : 0);
        this._faceUntil = performance.now() + 1200;
        const canvas = document.querySelector('#vf-in-stage-shop canvas.vx-portrait');
        if (canvas && typeof voxelPortrait !== 'undefined' && voxelPortrait.setState) {
            voxelPortrait.setState(canvas, this._faceState);
        }
        if (!this._faceRaf) this.startFaceLoop();
    }

    iconHtml(key, size, tint) {
        if (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml) {
            return iconRenderer.imgHtml(key, size || 40, 'vf-iss-icon', tint, false);
        }
        return '';
    }

    resourceIconKey(id) {
        const map = {
            credits: 'menuCredits',
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        return map[id] || 'resScrap';
    }

    /** Same generative casing the hangar bay uses — ability_* UI icons tint into blank blobs. */
    stockVisualHtml(item, cellPx) {
        const box = Math.max(28, (cellPx | 0) - 6);
        let kind = 'ability';
        let color = '#c08cff';
        let inner = '';
        let physId = 'iss_' + item.id;

        if (item.kind === 'part') {
            kind = item.partKind === 'weapon' ? 'weapon'
                : (item.partKind === 'defense' ? 'defense'
                    : (item.partKind === 'energy' ? 'energy' : 'ability'));
            physId = item.id;
            if (kind === 'weapon') {
                color = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
                    ? (weaponConfigManager.getWeaponUiColor(item.id) || '#ff6a4a')
                    : '#ff6a4a';
                if (typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
                    inner = `<span class="hs-storage-cell-icon">${iconRenderer.weaponImgHtml(item.id, Math.max(18, Math.floor(box * 0.42)), 'vf-iss-icon', false)}</span>`;
                }
            } else if (typeof homeStationUI !== 'undefined' && homeStationUI._storageBucketColor) {
                const bucket = item.partKind === 'defense' ? 'defenses'
                    : (item.partKind === 'energy' ? 'energy' : 'abilities');
                color = homeStationUI._storageBucketColor(bucket);
            }
        } else if (item.kind === 'weapon') {
            kind = 'weapon';
            color = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
                ? (weaponConfigManager.getWeaponUiColor(item.id) || '#ff6a4a')
                : '#ff6a4a';
            if (typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
                inner = `<span class="hs-storage-cell-icon">${iconRenderer.weaponImgHtml(item.id, Math.max(18, Math.floor(box * 0.42)), 'vf-iss-icon', false)}</span>`;
            }
        } else {
            const pu = (typeof POWER_UPS !== 'undefined') ? POWER_UPS[item.id] : null;
            if (item.id === 'barrier' || item.id === 'repair') {
                kind = 'defense';
                color = (pu && pu.color) || '#5cff7a';
            } else if (item.id === 'speed_boost' || item.id === 'magnet') {
                kind = 'ability';
                color = (pu && pu.color) || '#ff8a3a';
            } else {
                kind = 'weapon';
                color = (pu && pu.color) || '#ffcf3a';
            }
            inner = `<span class="hs-storage-cell-icon">${this.powerUpBadgeHtml(item.id, color, Math.max(16, Math.floor(box * 0.4)))}</span>`;
        }
        if (typeof physicalItem !== 'undefined' && physicalItem.wrap) {
            return physicalItem.wrap(kind, physId, box, box, color, inner);
        }
        return inner || this.iconHtml(item.icon || 'hsShop', Math.floor(box * 0.55), color);
    }

    escTip(s) {
        return String(s == null ? '' : s).replace(/"/g, '&quot;');
    }

    /** Stat / flavour lines for a perk or temp weapon. */
    perkDetailLines(item) {
        const lines = ['TEMP · NEXT STAGE'];
        (item.stats || []).forEach((s) => lines.push(String(s)));
        if (item.kind === 'weapon') {
            const w = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon)
                ? weaponConfigManager.getWeapon(item.id) : null;
            if (w) {
                const rate = w.cooldown ? (1000 / w.cooldown).toFixed(1) + '/S' : null;
                lines.push(['DMG ' + w.damage, 'SPD ' + w.speed, rate, 'AMMO ' + item.shots]
                    .filter(Boolean).join(' · '));
                if (w.description) lines.push(String(w.description));
            } else if (item.shots != null) {
                lines.push('AMMO ' + item.shots);
            }
            lines.push('REVERTS WHEN AMMO EMPTY');
        } else if (item.ms) {
            lines.push('DURATION ' + Math.round(item.ms / 1000) + 's');
        }
        lines.push(item.cost + 'c');
        return lines;
    }

    /** Tooltip body for a perk/temp-weapon — always includes concrete combat stats. */
    perkTipText(item) {
        return this.escTip(this.perkDetailLines(item).join('\n'));
    }

    /** Stat lines for a permanent part. */
    partDetailLines(item) {
        const lines = ['PERMANENT PART'];
        if (typeof homeStationUI !== 'undefined' && homeStationUI.hangarModuleTip) {
            const tip = String(homeStationUI.hangarModuleTip(item.partKind, item.id) || '');
            tip.split('\n').slice(1).forEach((line) => {
                if (line) lines.push(line);
            });
        } else if (item.partKind === 'weapon') {
            const w = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon)
                ? weaponConfigManager.getWeapon(item.id) : null;
            if (w) {
                if (w.description) lines.push(String(w.description));
                lines.push(['DMG ' + w.damage, 'SPD ' + w.speed]
                    .filter((x) => x && !String(x).includes('undefined')).join(' · '));
            }
        }
        lines.push(item.cost + 'c');
        return lines;
    }

    /** Tooltip for a permanent part — hangar module stats when available. */
    partTipText(item) {
        return this.escTip(this.partDetailLines(item).join('\n'));
    }

    detailEmptyHtml() {
        return `<div class="vf-iss-detail-empty">HOVER AN ITEM</div>` +
            `<div class="vf-iss-detail-hint">Stats, ammo, shields and cost show here.</div>`;
    }

    detailShellHtml() {
        return `<aside class="vf-iss-detail" id="vf-iss-detail" aria-live="polite">` +
            `<h3 class="vf-iss-col-title">DETAIL</h3>` +
            `<div class="vf-iss-detail-body">${this.detailEmptyHtml()}</div>` +
            `</aside>`;
    }

    detailStatRowsHtml(lines) {
        return (lines || []).map((line, i) => {
            const text = String(line || '');
            const cls = i === 0 ? ' is-tag' : (/\d+c$/.test(text.trim()) ? ' is-cost' : '');
            return `<div class="vf-iss-detail-line${cls}">${text.replace(/</g, '&lt;')}</div>`;
        }).join('');
    }

    /** Paint the right-hand detail pane for a stock item or inventory cell. */
    showDetail(payload) {
        const root = document.querySelector('#vf-in-stage-shop #vf-iss-detail .vf-iss-detail-body');
        if (!root) return;
        if (!payload) {
            root.innerHTML = this.detailEmptyHtml();
            return;
        }
        const layout = this.slotLayout();
        const previewCs = Math.max(layout.cell + 10, 64);
        const visual = payload.visualHtml
            || (payload.item ? this.stockVisualHtml(payload.item, previewCs) : '');
        const title = String(payload.title || 'ITEM').replace(/</g, '&lt;');
        const tag = payload.tag
            ? `<span class="vf-iss-detail-badge${payload.temp ? ' is-temp' : ''}">${payload.tag}</span>`
            : '';
        const cost = payload.cost != null
            ? `<div class="vf-iss-detail-price">${payload.cost}c</div>`
            : '';
        root.innerHTML =
            `<div class="vf-iss-detail-hero">` +
            `<div class="vf-iss-detail-preview" style="--cs:${previewCs}px">${visual}</div>` +
            `<div class="vf-iss-detail-meta">` +
            `<div class="vf-iss-detail-name">${title}</div>` +
            tag +
            cost +
            `</div></div>` +
            `<div class="vf-iss-detail-stats">${this.detailStatRowsHtml(payload.lines || [])}</div>`;
    }

    detailFromStockItem(item) {
        if (!item) return null;
        const isPart = item.kind === 'part';
        const lines = (isPart ? this.partDetailLines(item) : this.perkDetailLines(item)).slice();
        // Cost already in lines — keep it once in the header price.
        if (lines.length && /\d+c$/.test(String(lines[lines.length - 1]).trim())) lines.pop();
        return {
            item: item,
            title: item.label || item.id,
            tag: isPart ? 'PERMANENT' : 'TEMP · NEXT STAGE',
            temp: !isPart,
            cost: item.cost,
            lines: lines
        };
    }

    detailFromInvCell(cell) {
        if (!cell) return null;
        const kind = cell.getAttribute('data-part-kind') || '';
        const id = cell.getAttribute('data-part-id') || '';
        const dragKey = cell.getAttribute('data-drag-key') || '';
        const head = cell.getAttribute('data-ui-tip-head') || id || 'ITEM';
        const tip = String(cell.getAttribute('data-ui-tip') || '');
        const lines = tip.split('\n').filter(Boolean);
        const marked = cell.classList.contains('is-for-sale');
        if (marked) {
            const val = this.sellValueForCell(cell);
            lines.push('MARKED FOR SALE · +' + val + 'c');
        }
        let visual = '';
        const body = cell.querySelector('.hs-item-body');
        if (body) {
            visual = body.outerHTML;
        } else if (typeof physicalItem !== 'undefined' && physicalItem.wrap && kind && id) {
            const color = cell.style.getPropertyValue('--pk-c') || '#7ec8ff';
            visual = physicalItem.wrap(kind === 'blueprint' ? 'ability' : kind, id, 58, 58, color, '');
        }
        return {
            title: head,
            tag: cell.classList.contains('is-equipped') ? 'EQUIPPED'
                : (marked ? 'FOR SALE' : (dragKey.indexOf('blueprints:') === 0 ? 'BLUEPRINT' : 'INVENTORY')),
            temp: false,
            lines: lines,
            visualHtml: visual
        };
    }

    bindDetailHover(root) {
        if (!root) return;
        const update = (target) => {
            const buy = target && target.closest && target.closest('[data-shop-buy]');
            if (buy) {
                this.showDetail(this.detailFromStockItem(
                    this.resolveBuyKey(buy.getAttribute('data-shop-buy'))
                ));
                return;
            }
            const inv = target && target.closest && target.closest(
                '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
            );
            if (inv) {
                this.showDetail(this.detailFromInvCell(inv));
                return;
            }
        };
        root.addEventListener('mousemove', (e) => update(e.target));
        root.addEventListener('focusin', (e) => update(e.target));
    }

    /** Pixel silhouette matching in-world power-up pickups (POWER_UPS). */
    powerUpBadgeHtml(id, color, size) {
        const def = (typeof POWER_UPS !== 'undefined' && POWER_UPS[id]) || {
            color: color || '#c08cff',
            light: '#ffffff',
            shape: 'circle',
            glyph: 'cross'
        };
        const s = Math.max(12, size | 0);
        try {
            const c = document.createElement('canvas');
            c.width = s;
            c.height = s;
            const ctx = c.getContext('2d');
            if (!ctx) return '';
            ctx.imageSmoothingEnabled = false;
            const x = Math.floor(s / 2);
            const y = Math.floor(s / 2);
            const r = Math.max(3, Math.floor(s * 0.36));
            const half = (dy, rr) => {
                const a = Math.abs(dy);
                if (def.shape === 'diamond') return rr - a;
                if (def.shape === 'hex') return Math.min(rr - 1, (rr - a) * 2);
                if (def.shape === 'square') return rr - 1;
                if (def.shape === 'triangle') return Math.round((rr - 1) * ((dy + rr) / (2 * rr || 1)));
                return Math.round(Math.sqrt(Math.max(0, rr * rr - a * a)));
            };
            const shape = (rr, col) => {
                ctx.fillStyle = col;
                for (let dy = -rr; dy <= rr; dy++) {
                    const h = half(dy, rr);
                    if (h >= 0) ctx.fillRect(x - h, y + dy, h * 2 + 1, 1);
                }
            };
            shape(r + 1, '#05060a');
            shape(r, def.color || color);
            shape(Math.max(1, r - 2), def.light || '#ffffff');
            ctx.fillStyle = '#05060a';
            const mark = (mx, my, mw, mh) => ctx.fillRect(mx, my, mw, mh);
            if (def.glyph === 'arrow') {
                mark(x, y - 2, 1, 5); mark(x - 1, y - 1, 3, 1); mark(x - 2, y, 5, 1);
            } else if (def.glyph === 'chevrons') {
                for (let k = 0; k < 2; k++) {
                    const yy = y - 2 + k * 3;
                    mark(x, yy, 1, 1); mark(x - 1, yy + 1, 1, 1); mark(x + 1, yy + 1, 1, 1);
                    mark(x - 2, yy + 2, 1, 1); mark(x + 2, yy + 2, 1, 1);
                }
            } else {
                mark(x, y - 2, 1, 5); mark(x - 2, y, 5, 1);
            }
            return `<img class="vf-iss-icon" src="${c.toDataURL()}" width="${s}" height="${s}" alt="" draggable="false" style="image-rendering:pixelated;width:${s}px;height:${s}px">`;
        } catch (err) {
            return '';
        }
    }

    /** Focusable: stock cells + complete + close. */
    focusables() {
        const root = document.getElementById('vf-in-stage-shop');
        if (!root) return [];
        return Array.from(root.querySelectorAll(
            '[data-shop-buy], [data-shop-complete], [data-shop-close]'
        ));
    }

    updateFocusDisplay() {
        const list = this.focusables();
        if (!list.length) return;
        if (this.focusIndex < 0) this.focusIndex = list.length - 1;
        if (this.focusIndex >= list.length) this.focusIndex = 0;
        list.forEach((el, i) => {
            const on = i === this.focusIndex;
            el.classList.toggle('nav-focused', on);
            el.classList.toggle('is-focused', on);
            if (on) {
                try { el.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
                if (typeof gamepadCursor !== 'undefined' && gamepadCursor.follow) {
                    gamepadCursor.follow(el);
                }
                if (el.hasAttribute('data-shop-buy')) {
                    this.showDetail(this.detailFromStockItem(
                        this.resolveBuyKey(el.getAttribute('data-shop-buy'))
                    ));
                }
            }
        });
    }

    moveFocus(dx, dy) {
        const list = this.focusables();
        if (!list.length) return;
        const cols = this._stockCols || 3;
        const stockCount = this.flatStock().length;
        // Last item is CLOSE — treat as its own row.
        let idx = this.focusIndex;
        if (idx >= stockCount) {
            if (dy < 0 || dx !== 0) idx = Math.min(stockCount - 1, Math.max(0, idx));
            else return;
        } else {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            let nc = col + dx;
            let nr = row + dy;
            if (dy > 0 && (row + 1) * cols >= stockCount) {
                // Drop to CLOSE
                this.focusIndex = stockCount; // close button index among focusables if present
                // focusables = stock + close → close at stockCount
                this.updateFocusDisplay();
                return;
            }
            if (nc < 0) nc = cols - 1;
            if (nc >= cols) nc = 0;
            const next = nr * cols + nc;
            if (next < 0) idx = stockCount; // wrap to close
            else if (next >= stockCount) idx = Math.min(stockCount - 1, Math.max(0, next));
            else idx = next;
        }
        this.focusIndex = idx;
        this.updateFocusDisplay();
    }

    /**
     * Victory / gamepad key path. Returns true when the event was handled.
     */
    handleInput(event) {
        if (!this.isOpen) return false;
        if (event.repeat) return true;
        const key = event.key;
        switch (key) {
            case 'ArrowLeft':
                this.moveFocus(-1, 0);
                return true;
            case 'ArrowRight':
                this.moveFocus(1, 0);
                return true;
            case 'ArrowUp':
                this.moveFocus(0, -1);
                return true;
            case 'ArrowDown':
                this.moveFocus(0, 1);
                return true;
            case 'Enter':
            case ' ':
                this.buyFocused();
                return true;
            case 'Escape':
            case 'e':
            case 'E':
                this.close();
                return true;
            default:
                return false;
        }
    }

    walletHtml() {
        const profile = this.getProfile();
        const map = (profile && profile.resources) || {};
        const ids = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds)
            ? economyConfig.resourceIds.slice()
            : ['scrap', 'ore', 'crystal', 'voltex'];
        const chip = (id, amount, iconId) => {
            const n = Math.max(0, Math.round(Number(amount) || 0));
            const label = id === 'credits'
                ? 'CREDITS'
                : ((typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel)
                    ? economyConfig.getResourceLabel(id)
                    : String(id).toUpperCase());
            return `<span class="vf-iss-wallet-item${n <= 0 ? ' is-empty' : ''}">` +
                `<span class="vf-iss-wallet-ico">${this.iconHtml(this.resourceIconKey(iconId || id), 28)}</span>` +
                `<span class="vf-iss-wallet-meta"><span>${label}</span><b>${n}</b></span>` +
                `</span>`;
        };
        return `<div class="vf-iss-wallet" aria-label="Resources">` +
            chip('credits', this.getCredits(), 'credits').replace(
                'class="vf-iss-wallet-item',
                'data-wallet="credits" class="vf-iss-wallet-item'
            ) +
            ids.map((id) => chip(id, map[id] || 0, id)).join('') +
            `</div>`;
    }

    /** Compact stash cells — room for the right-hand detail pane. */
    SHOP_CELL_PX = 40;
    SHOP_GAP_PX = 2;
    /** Vendor stash footprint (empty pads give the Diablo bag feel). */
    STOCK_COLS = 6;
    STOCK_ROWS = 4;

    slotLayout() {
        if (typeof homeStationUI !== 'undefined' && homeStationUI._storageLayoutPx) {
            const prev = homeStationUI.STORAGE_CELL_PX;
            const prevGap = homeStationUI.STORAGE_GAP_PX;
            homeStationUI.STORAGE_CELL_PX = this.SHOP_CELL_PX;
            homeStationUI.STORAGE_GAP_PX = this.SHOP_GAP_PX;
            let layout;
            try {
                layout = homeStationUI._storageLayoutPx();
            } finally {
                homeStationUI.STORAGE_CELL_PX = prev;
                homeStationUI.STORAGE_GAP_PX = prevGap;
            }
            return layout;
        }
        return { cell: this.SHOP_CELL_PX, gap: this.SHOP_GAP_PX };
    }

    /** Run hangar storage renderers with shop cell size, then restore. */
    withShopSlotSize(fn) {
        const layout = this.slotLayout();
        if (typeof homeStationUI === 'undefined') return { layout, html: fn(layout) };
        const prev = homeStationUI.STORAGE_CELL_PX;
        const prevGap = homeStationUI.STORAGE_GAP_PX;
        homeStationUI.STORAGE_CELL_PX = layout.cell;
        homeStationUI.STORAGE_GAP_PX = layout.gap;
        try {
            return { layout, html: fn(layout) };
        } finally {
            homeStationUI.STORAGE_CELL_PX = prev;
            homeStationUI.STORAGE_GAP_PX = prevGap;
        }
    }

    storageGridShell(cols, rows, cs, gap, extraClass, innerHtml) {
        return `<div class="hs-storage-grid ${extraClass || ''}" data-inv-cols="${cols}" data-inv-rows="${rows}" ` +
            `style="--cs:${cs}px;--hs-gap:${gap}px;grid-auto-flow:row dense;` +
            `grid-template-columns:repeat(${cols},${cs}px);` +
            `grid-template-rows:repeat(${rows},${cs}px);` +
            `width:calc(${cols}*${cs}px + ${cols - 1}*${gap}px);` +
            `height:calc(${rows}*${cs}px + ${rows - 1}*${gap}px)">` +
            innerHtml +
            `</div>`;
    }

    /** Shared cell builder for perk / part vendor grids. */
    stockCellHtml(item, cs) {
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        item.cost = cost;
        const buyKey = this.stockBuyKey(item);
        const inCart = this.cartBuys.has(buyKey);
        const afford = inCart || this.canAffordCartItem(item);
        const isPart = item.kind === 'part';
        let accent = '#c08cff';
        if (isPart && item.partKind === 'weapon') {
            accent = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
                ? (weaponConfigManager.getWeaponUiColor(item.id) || '#ff6a4a')
                : '#ff6a4a';
        } else if (item.kind === 'weapon') {
            accent = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor)
                ? (weaponConfigManager.getWeaponUiColor(item.id) || '#ff6a4a')
                : '#ff6a4a';
        } else {
            const pu = (typeof POWER_UPS !== 'undefined') ? POWER_UPS[item.id] : null;
            accent = (pu && pu.color) || accent;
        }
        const tip = isPart ? this.partTipText(item) : this.perkTipText(item);
        const head = String(item.label || item.id).replace(/"/g, '&quot;');
        const badge = isPart
            ? `<span class="vf-iss-stock-tag">OWN</span>`
            : `<span class="vf-iss-stock-tag is-temp">TEMP</span>`;
        const cartBadge = inCart ? `<span class="vf-iss-cart-mark">CART</span>` : '';
        // Keep unaffordable cells clickable so the trader can flash "NOT ENOUGH CREDITS".
        return `<button type="button" class="hs-storage-cell vf-iss-stock-cell${isPart ? ' is-part' : ' is-perk'}${afford ? '' : ' is-locked'}${inCart ? ' is-in-cart' : ''}" ` +
            `data-shop-buy="${buyKey}" data-nav-item tabindex="-1" style="--pk-c:${accent}" ` +
            `data-ui-tip-compact data-ui-tip-head="${head}" data-ui-tip="${tip}" ` +
            `aria-label="Add ${head} to cart for ${cost} credits">` +
            this.stockVisualHtml(item, cs) +
            badge +
            cartBadge +
            `<span class="vf-iss-stock-cost">${cost}c</span>` +
            `</button>`;
    }

    /** Pad a cell list out to cols×rows empty slots. */
    padStockCells(cells, cols, rows) {
        const pad = Math.max(0, cols * rows - cells.length);
        for (let i = 0; i < pad; i++) {
            cells.push(`<span class="hs-storage-cell hs-storage-cell-empty" aria-hidden="true"></span>`);
        }
        return cells;
    }

    /** Temp perks / temp weapons for the next stage. */
    perkGridHtml() {
        const items = this.flatPerks();
        const cols = this.STOCK_COLS;
        const rows = Math.max(2, Math.ceil(Math.max(items.length, 1) / cols));
        this._stockCols = cols;
        const layout = this.slotLayout();
        const cs = layout.cell;
        const gap = layout.gap;
        const cells = this.padStockCells(items.map((item) => this.stockCellHtml(item, cs)), cols, rows);
        return this.storageGridShell(cols, rows, cs, gap, 'vf-iss-stock-grid vf-iss-perk-grid', cells.join(''));
    }

    /** Permanent parts that go into ship/station storage. */
    partsGridHtml() {
        const items = this.flatParts();
        const cols = this.STOCK_COLS;
        const rows = Math.max(2, Math.ceil(Math.max(items.length, 1) / cols));
        const layout = this.slotLayout();
        const cs = layout.cell;
        const gap = layout.gap;
        const cells = this.padStockCells(items.map((item) => this.stockCellHtml(item, cs)), cols, rows);
        return this.storageGridShell(cols, rows, cs, gap, 'vf-iss-stock-grid vf-iss-parts-grid', cells.join(''));
    }

    /** Both vendor grids under STOCK. */
    stockGridsHtml() {
        return `<h3 class="vf-iss-col-title vf-iss-sub-title">PERKS · NEXT STAGE</h3>` +
            this.perkGridHtml() +
            `<h3 class="vf-iss-col-title vf-iss-sub-title">PARTS · PERMANENT</h3>` +
            this.partsGridHtml();
    }

    /** Ship cargo bay at shop slot size. */
    shipInventoryHtml() {
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        if (!profile || !shipId || typeof homeStationUI === 'undefined' || !homeStationUI.renderShipStorage) {
            return this.fallbackInventoryGrid(this.slotLayout(), 'vf-iss-inv-grid');
        }
        const { html } = this.withShopSlotSize(() => homeStationUI.renderShipStorage(profile, shipId, {
            tipAction: false,
            extraGridClass: 'vf-iss-inv-grid',
            // Shop: one tile per part — hangar footprints make the trader bag look messy.
            compactSpans: true
        }));
        return html || this.fallbackInventoryGrid(this.slotLayout(), 'vf-iss-inv-grid');
    }

    /** Station storage bay at the same shop slot size, beside ship. */
    stationInventoryHtml() {
        const profile = this.getProfile();
        if (!profile || typeof homeStationUI === 'undefined' || !homeStationUI.renderStationStorage) {
            return this.emptyBagHtml('STATION EMPTY');
        }
        const { html } = this.withShopSlotSize(() => homeStationUI.renderStationStorage(profile, {
            tipAction: false,
            compactSpans: true,
            maxCols: this.STOCK_COLS
        }));
        if (!html) return this.emptyBagHtml('STATION EMPTY');
        // Tag for shop CSS (renderStationStorage has no extraGridClass hook).
        return String(html).replace(
            'class="hs-storage-grid',
            'class="hs-storage-grid vf-iss-station-grid'
        );
    }

    emptyBagHtml(label) {
        const layout = this.slotLayout();
        const cols = 6;
        const rows = 2;
        const cells = [];
        for (let i = 0; i < cols * rows; i++) {
            cells.push(`<span class="hs-storage-cell hs-storage-cell-empty" aria-hidden="true"></span>`);
        }
        return `<div class="vf-iss-empty-bag" data-empty-label="${label}">` +
            this.storageGridShell(cols, rows, layout.cell, layout.gap, 'vf-iss-station-grid', cells.join('')) +
            `</div>`;
    }

    /** Ship + station bags (+ queued stage buys). */
    inventoryColumnsHtml() {
        const layout = this.slotLayout();
        return `<div class="vf-iss-bags">` +
            `<section class="vf-iss-col vf-iss-ship">` +
            `<h3 class="vf-iss-col-title">SHIP</h3>` +
            `<div class="vf-iss-ship-inv hs-slot-picker">${this.shipInventoryHtml()}</div>` +
            `</section>` +
            `<section class="vf-iss-col vf-iss-station">` +
            `<h3 class="vf-iss-col-title">STATION</h3>` +
            `<div class="vf-iss-station-inv hs-slot-picker">${this.stationInventoryHtml()}</div>` +
            `</section>` +
            `</div>` +
            this.queuedInventoryCells(layout.cell);
    }

    /** Stage buys waiting for next fight — same slot casing as hangar parts. */
    queuedInventoryCells(cs) {
        const pending = this.pendingBuffs.concat(this.pendingWeapons);
        if (!pending.length) return '';
        const layout = this.slotLayout();
        const gap = layout.gap;
        const cols = Math.min(4, Math.max(1, pending.length));
        const rows = Math.ceil(pending.length / cols);
        const cells = pending.map((item) => {
            const kind = item.shots != null ? 'weapon' : 'ability';
            const color = (typeof POWER_UPS !== 'undefined' && POWER_UPS[item.id] && POWER_UPS[item.id].color)
                || '#4fd8e8';
            const body = (typeof physicalItem !== 'undefined' && physicalItem.wrap)
                ? physicalItem.wrap(kind, 'iss_q_' + item.id, cs - 6, cs - 6, color, '')
                : this.iconHtml(item.icon || 'hsShop', Math.floor(cs * 0.5), color);
            return `<div class="hs-storage-cell is-queued" style="--pk-c:${color}" title="${item.label || item.id}">` +
                body +
                `<span class="hs-storage-cell-qty">${item.shots != null ? item.shots : 1}</span>` +
                `</div>`;
        });
        const pad = Math.max(0, cols * rows - pending.length);
        for (let i = 0; i < pad; i++) {
            cells.push(`<span class="hs-storage-cell hs-storage-cell-empty" aria-hidden="true"></span>`);
        }
        return `<h3 class="vf-iss-col-title vf-iss-queued-title">QUEUED</h3>` +
            this.storageGridShell(cols, rows, cs, gap, 'vf-iss-queued-grid', cells.join(''));
    }

    fallbackInventoryGrid(layout, extraClass) {
        const cols = 6;
        const rows = 4;
        const cs = layout.cell;
        const gap = layout.gap;
        const cells = [];
        for (let i = 0; i < cols * rows; i++) {
            cells.push(`<span class="hs-storage-cell hs-storage-cell-empty" aria-hidden="true"></span>`);
        }
        return this.storageGridShell(cols, rows, cs, gap, extraClass || 'vf-iss-inv-grid', cells.join(''));
    }

    portraitHtml(ctx) {
        if (typeof voxelPortrait !== 'undefined' && voxelPortrait.canvasHtml) {
            return voxelPortrait.canvasHtml(
                { faction: ctx.faction, v: ctx.variant },
                null,
                { state: this._faceState || 0 }
            );
        }
        return `<canvas id="vf-shop-face" class="vf-iss-face-fallback" width="96" height="96" aria-hidden="true"></canvas>`;
    }

    /** Paint shop chrome in the trader's faction colours (not the player's HUD theme). */
    applyTraderTheme(root, factionId) {
        if (!root) return;
        const id = String(factionId || 'terran').toLowerCase();
        root.dataset.faction = id;
        let style = null;
        if (typeof factionShipStyles !== 'undefined') {
            if (factionShipStyles.getFactionStyle) style = factionShipStyles.getFactionStyle(id);
            else if (factionShipStyles.getDefaultFactionStyle) style = factionShipStyles.getDefaultFactionStyle(id);
        }
        const hull = (style && style.hull) || '#3A6EA5';
        const edge = (style && style.edge) || '#1a2a3a';
        const accent = (style && style.accent)
            || (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor
                ? factionShipStyles.getFactionColor(id) : null)
            || '#7ec8ff';
        const set = (k, v) => root.style.setProperty(k, v);
        set('--faction-hull', hull);
        set('--faction-edge', edge);
        set('--faction-accent', accent);
        set('--color-primary', accent);
        set('--color-secondary', hull);
        set('--color-border', edge);
        set('--iss-accent', accent);
        set('--iss-hull', hull);
        set('--iss-edge', edge);
    }

    renderDom() {
        const keepFocus = this.focusIndex;
        let el = document.getElementById('vf-in-stage-shop');
        if (!el) {
            el = document.createElement('div');
            el.id = 'vf-in-stage-shop';
            el.className = 'vf-iss';
            document.body.appendChild(el);
            el.addEventListener('click', (e) => {
                // Inventory cells: left-click does not move/craft — drag sorts, right-click marks.
                const invCell = e.target.closest(
                    '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
                );
                if (invCell) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                const buyBtn = e.target.closest('[data-shop-buy]');
                if (buyBtn) {
                    const list = this.focusables();
                    const idx = list.indexOf(buyBtn);
                    if (idx >= 0) this.focusIndex = idx;
                    this.purchaseItem(this.resolveBuyKey(buyBtn.getAttribute('data-shop-buy')));
                    return;
                }
                if (e.target.closest('[data-shop-complete]')) {
                    this.completeTrade();
                    return;
                }
                if (e.target.closest('[data-shop-close]')) this.close();
            });
            el.addEventListener('contextmenu', (e) => {
                const cell = e.target.closest(
                    '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
                );
                if (!cell) return;
                e.preventDefault();
                e.stopPropagation();
                this.toggleMarkForSale(cell);
            });
            el.addEventListener('mousemove', (e) => {
                const btn = e.target.closest(
                    '[data-shop-buy], [data-shop-complete], [data-shop-close]'
                );
                if (btn) {
                    const list = this.focusables();
                    const idx = list.indexOf(btn);
                    if (idx >= 0 && idx !== this.focusIndex) {
                        this.focusIndex = idx;
                        this.updateFocusDisplay();
                    }
                }
            });
            this.bindDetailHover(el);
        }
        const ctx = this.planetContext();
        this.applyTraderTheme(el, ctx.faction);
        const factionLabel = String(ctx.faction || 'local').toUpperCase();
        const pendingNote = (this.pendingBuffs.length || this.pendingWeapons.length)
            ? `<div class="vf-iss-note">QUEUED FOR NEXT STAGE</div>`
            : '';
        const saleHint = `<div class="vf-iss-note vf-iss-hint">CLICK stock → cart · RIGHT-CLICK inventory → sell mark · COMPLETE TRADE settles credits</div>`;
        el.innerHTML =
            `<div class="vf-iss-panel" data-faction="${String(ctx.faction || 'terran').toLowerCase()}" role="dialog" aria-label="Planet shop">` +
            `<header class="vf-iss-head">` +
            `<div class="vf-iss-trader">` +
            `<div class="vf-iss-portrait">${this.portraitHtml(ctx)}</div>` +
            `<div class="vf-iss-trader-meta">` +
            `<div class="vf-iss-trader-title">${ctx.name} LOCAL</div>` +
            `<div class="vf-iss-trader-sub">${factionLabel} · PLANET TRADER</div>` +
            `<div class="vf-iss-trader-cash">${this.getCredits()}c ON HAND</div>` +
            `</div></div>` +
            `<button type="button" class="vf-iss-close" data-shop-close data-nav-item tabindex="-1">CLOSE [E / B]</button>` +
            `</header>` +
            this.walletHtml() +
            pendingNote +
            saleHint +
            `<div class="vf-iss-body">` +
            `<div class="vf-iss-main">` +
            `<section class="vf-iss-col vf-iss-stock">` +
            `<h3 class="vf-iss-col-title">STOCK</h3>` +
            this.stockGridsHtml() +
            `</section>` +
            this.inventoryColumnsHtml() +
            `</div>` +
            this.detailShellHtml() +
            `</div>` +
            `<footer class="vf-iss-foot">` +
            `<button type="button" class="vf-iss-complete" data-shop-complete data-nav-item tabindex="-1" disabled>COMPLETE TRADE</button>` +
            `</footer></div>`;
        // Theme lives on the root; re-apply after innerHTML so dataset/vars stay.
        this.applyTraderTheme(el, ctx.faction);
        if (typeof voxelPortrait !== 'undefined' && voxelPortrait.scan) {
            voxelPortrait.scan(el);
        }
        this.bindInventoryInteractions(el);
        this.applySaleMarks();
        this.applyCartMarks();
        this.updateCompleteButton();
        this.updateWalletProjection();
        this.focusIndex = Math.min(keepFocus, Math.max(0, this.focusables().length - 1));
        this.updateFocusDisplay();
        const focused = this.focusables()[this.focusIndex];
        if (focused && focused.hasAttribute('data-shop-buy')) {
            this.showDetail(this.detailFromStockItem(
                this.resolveBuyKey(focused.getAttribute('data-shop-buy'))
            ));
        }
        this.startFaceLoop();
    }

    startFaceLoop() {
        if (this._faceRaf) cancelAnimationFrame(this._faceRaf);
        const fallback = document.getElementById('vf-shop-face');
        const tick = () => {
            if (!this.isOpen) {
                this._faceRaf = null;
                return;
            }
            const now = performance.now();
            if (this._faceUntil && now >= this._faceUntil) {
                this._faceUntil = 0;
                this._faceState = 0;
                const canvas = document.querySelector('#vf-in-stage-shop canvas.vx-portrait');
                if (canvas && typeof voxelPortrait !== 'undefined' && voxelPortrait.setState) {
                    voxelPortrait.setState(canvas, 0);
                }
            }
            if (fallback && typeof shopkeeperFace !== 'undefined') {
                const ctx = fallback.getContext('2d');
                shopkeeperFace.update(16);
                shopkeeperFace.render(ctx, fallback.width, fallback.height);
            }
            this._faceRaf = requestAnimationFrame(tick);
        };
        this._faceRaf = requestAnimationFrame(tick);
    }
}

const inStageShop = new InStageShop();
window.inStageShop = inStageShop;
