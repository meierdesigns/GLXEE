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
        /** @type {Set<string>} Keys `source::shipId::bucket:id` marked for sale (left-click inventory). */
        this.markedForSale = new Set();
        /** @type {Set<string>} Stock buy keys (`buff:id` / `weapon:id` / `part:kind:id`) in the cart. */
        this.cartBuys = new Set();
        /** Frozen permanent-part offer for this shop visit. */
        this._partsOffer = null;
        /** Frozen temp-perk offer for this shop visit. */
        this._perksOffer = null;
        /** Frozen vendor bag size for this shop visit (rolled on open). */
        this._visitBag = null;
        /** Seed for per-offer stat rolls this visit. */
        this._visitSeed = 0;
        this._faceState = 0;
        this._faceUntil = 0;
        this.focusIndex = 0;
        this._stockCols = 3;
        this._hsPatched = false;
        this._hsPrevOverlay = null;
        this._hsPrevCreate = null;
        this._shopSessionKey = 'vf_iss_session_v1';
    }

    _shopSessionLevelId() {
        if (typeof game !== 'undefined' && game.gameControl && game.gameControl.getRestartLevelId) {
            return game.gameControl.getRestartLevelId();
        }
        if (typeof game !== 'undefined' && game.coreLevelManager && game.coreLevelManager.currentLevelId) {
            return game.coreLevelManager.currentLevelId;
        }
        return '';
    }

    _serializeOfferEntry(e) {
        if (!e) return null;
        return {
            kind: e.kind,
            stock: e.stock,
            partKind: e.partKind,
            id: e.id,
            label: e.label,
            cost: e.cost,
            icon: e.icon,
            stats: e.stats,
            ms: e.ms,
            shots: e.shots,
            shopClass: e.shopClass,
            shopClassLabel: e.shopClassLabel,
            shopRoll: e.shopRoll
        };
    }

    _rehydratePartItem(e) {
        if (!e || e.kind !== 'part') return e;
        const kind = e.partKind;
        let item = null;
        if (kind === 'weapon' && typeof weaponConfigManager !== 'undefined') {
            item = weaponConfigManager.getWeapon(e.id);
        } else if (typeof abilityConfigManager !== 'undefined') {
            item = abilityConfigManager.getAbility(e.id);
        }
        return Object.assign({}, e, { item: item || e.item });
    }

    persistShopSession() {
        if (!this.isOpen) return;
        try {
            const ctx = this.planetContext();
            const snap = {
                v: 1,
                open: true,
                fromVictory: this.fromVictory,
                levelId: this._shopSessionLevelId(),
                planetId: ctx.planetId,
                visitSeed: this._visitSeed,
                visitBag: this._visitBag,
                partsOffer: (this._partsOffer || []).map((e) => this._serializeOfferEntry(e)).filter(Boolean),
                perksOffer: (this._perksOffer || []).map((e) => this._serializeOfferEntry(e)).filter(Boolean),
                cartBuys: Array.from(this.cartBuys),
                markedForSale: Array.from(this.markedForSale),
                focusIndex: this.focusIndex
            };
            sessionStorage.setItem(this._shopSessionKey, JSON.stringify(snap));
            if (typeof menuStateManager !== 'undefined' && this.fromVictory) {
                menuStateManager.save({ issShopOpen: true });
            }
        } catch (e) { /* ignore */ }
    }

    loadShopSession() {
        try {
            const raw = sessionStorage.getItem(this._shopSessionKey);
            if (!raw) return null;
            const snap = JSON.parse(raw);
            if (!snap || snap.v !== 1 || !snap.open) return null;
            return snap;
        } catch (e) {
            return null;
        }
    }

    clearShopSession() {
        try {
            sessionStorage.removeItem(this._shopSessionKey);
            if (typeof menuStateManager !== 'undefined') {
                menuStateManager.save({ issShopOpen: false });
            }
        } catch (e) { /* ignore */ }
    }

    restoreFromSession(snap) {
        if (!snap || !snap.open || this.isOpen) return false;
        const levelId = this._shopSessionLevelId();
        if (snap.levelId && levelId && snap.levelId !== levelId) {
            this.clearShopSession();
            return false;
        }
        this.isOpen = true;
        this.fromVictory = !!snap.fromVictory;
        this._visitSeed = Number(snap.visitSeed) || 0;
        this._visitBag = snap.visitBag || null;
        this._partsOffer = (snap.partsOffer || []).map((e) => this._rehydratePartItem(e));
        this._perksOffer = (snap.perksOffer || []).slice();
        this.cartBuys = new Set(snap.cartBuys || []);
        this.markedForSale = new Set(snap.markedForSale || []);
        this.focusIndex = Math.max(0, Number(snap.focusIndex) || 0);
        this._faceState = 0;
        this._faceUntil = 0;
        this._fitCellPx = null;
        this._fittingLock = false;
        if (!this.fromVictory
            && typeof game !== 'undefined'
            && game.gameState
            && game.gameState.pauseGame) {
            game.gameState.pauseGame();
        }
        if (typeof soundManager !== 'undefined' && soundManager.startShopMusic) {
            const planet = (typeof soundManager._endMusicPlanet !== 'undefined'
                && soundManager._endMusicPlanet)
                || soundManager._currentPlanetId
                || snap.planetId
                || (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.selectedPlanetId)
                || 'mars';
            soundManager.startShopMusic(planet, {
                resume: this.fromVictory ? 'victory' : 'menu'
            });
        }
        this.renderDom();
        this.persistShopSession();
        return true;
    }

    /** Reopen planet trader after F5 on the victory screen. */
    tryRestoreAfterVictoryBoot() {
        const snap = this.loadShopSession();
        if (!snap || !snap.open || !snap.fromVictory) return false;
        return this.restoreFromSession(snap);
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
                    id: 'aegis', label: 'AEGIS', cost: 75, ms: 80000,
                    icon: 'ability_energy_shield',
                    stats: ['DMG TAKEN ×0.7', 'DURATION 80s']
                },
                {
                    id: 'speed_boost', label: 'AFTERBURNER', cost: 55, ms: 75000,
                    icon: 'ability_high_speed',
                    stats: ['MOVE SPEED ×1.45', 'DURATION 75s']
                },
                {
                    id: 'turbo', label: 'TURBO', cost: 40, ms: 60000,
                    icon: 'ability_high_speed',
                    stats: ['MOVE SPEED ×1.25', 'DURATION 60s']
                },
                {
                    id: 'power_shot', label: 'POWER SHOT', cost: 95, ms: 90000,
                    icon: 'ability_powerful_cannon',
                    stats: ['DAMAGE ×1.6', 'SHOT SIZE ×1.3', 'DURATION 90s']
                },
                {
                    id: 'overcharge', label: 'OVERCHARGE', cost: 100, ms: 75000,
                    icon: 'ability_powerful_cannon',
                    stats: ['DAMAGE ×2.0', 'SHOT SIZE ×1.15', 'DURATION 75s']
                },
                {
                    id: 'focus', label: 'FOCUS BEAM', cost: 90, ms: 80000,
                    icon: 'ability_weapon_systems',
                    stats: ['DAMAGE ×1.35', 'SHOT SIZE ×1.55', 'DURATION 80s']
                },
                {
                    id: 'rapid_fire', label: 'RAPID FIRE', cost: 90, ms: 75000,
                    icon: 'ability_versatile_weapons',
                    stats: ['FIRE RATE ×1.7', 'COOLDOWN ×0.6', 'DURATION 75s']
                },
                {
                    id: 'spray', label: 'SPRAY FIRE', cost: 85, ms: 70000,
                    icon: 'ability_versatile_weapons',
                    stats: ['FIRE RATE ×2.1', 'COOLDOWN ×0.48', 'DURATION 70s']
                },
                {
                    id: 'repair', label: 'FIELD REPAIR', cost: 70, ms: 60000,
                    icon: 'ability_energy_shield',
                    stats: ['HULL REGEN 4%/s', 'DURATION 60s']
                },
                {
                    id: 'stim', label: 'STIM PACK', cost: 60, ms: 50000,
                    icon: 'ability_energy_shield',
                    stats: ['INSTANT +20% HULL', 'REGEN 2.5%/s', 'DURATION 50s']
                },
                {
                    id: 'magnet', label: 'LOOT MAGNET', cost: 50, ms: 90000,
                    icon: 'ability_high_speed',
                    stats: ['PICKUP RADIUS ×1.8', 'DURATION 90s']
                },
                {
                    id: 'scrapper', label: 'SCRAPPER', cost: 65, ms: 90000,
                    icon: 'ability_high_speed',
                    stats: ['PICKUP RADIUS ×1.35', 'LOOT ×1.5', 'DURATION 90s']
                },
                {
                    id: 'double_loot', label: 'DOUBLE LOOT', cost: 80, ms: 90000,
                    icon: 'ability_high_speed',
                    stats: ['RESOURCE YIELD ×2', 'DURATION 90s']
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
        return (this._perksOffer || this.buildPerksOffer()).slice();
    }

    flatParts() {
        return (this._partsOffer || this.buildPartsOffer()).slice();
    }

    /**
     * Temp perk / weapon shelf for this visit — shuffled and capped by bag size
     * (better faction standing → richer shelves).
     */
    buildPerksOffer() {
        const c = this.perkCatalog();
        const list = c.buffs.map((i) => Object.assign({ kind: 'buff', stock: 'perk' }, i))
            .concat(c.weapons.map((i) => Object.assign({ kind: 'weapon', stock: 'perk' }, i)));
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
        const bag = this.shopStockLayout();
        const cap = Math.max(1, Math.min(list.length, bag.perkCap || list.length));
        this._perksOffer = list.slice(0, cap);
        this._perksOffer.forEach((e, i) => this.applyShopClassification(e, i));
        return this._perksOffer;
    }

    /** Relation to the planet's resident faction (-100..100 + label). */
    planetFactionRelation() {
        const faction = String((this.planetContext().faction) || '').toLowerCase();
        if (typeof factionManager !== 'undefined' && factionManager.getRelation) {
            return factionManager.getRelation(faction);
        }
        return { score: 0, label: 'NEUTRAL', tone: 'neutral' };
    }

    /**
     * Roll vendor bag size for this visit from alliance + luck.
     * Allied residents stock deeper shelves; hostiles keep a thin stall.
     */
    rollVisitStockLayout() {
        const rel = this.planetFactionRelation();
        const score = Number(rel.score) || 0;
        let minR = 0.08;
        let maxR = 0.55;
        if (score >= 90) {
            minR = 0.55;
            maxR = 1;
        } else if (score >= 60) {
            minR = 0.4;
            maxR = 0.95;
        } else if (score >= 40) {
            minR = 0.28;
            maxR = 0.8;
        } else if (score <= -30) {
            minR = 0;
            maxR = 0.32;
        } else if (score < 0) {
            minR = 0.04;
            maxR = 0.42;
        }
        const rich = minR + Math.random() * Math.max(0.01, maxR - minR);
        let bag;
        if (rich >= 0.78) {
            bag = { cols: 10, rows: 4, minRows: 3, partCap: 16, perkCap: 9 };
        } else if (rich >= 0.52) {
            bag = { cols: 8, rows: 4, minRows: 3, partCap: 12, perkCap: 8 };
        } else if (rich >= 0.28) {
            bag = { cols: 7, rows: 3, minRows: 3, partCap: 10, perkCap: 6 };
        } else {
            bag = { cols: 5, rows: 3, minRows: 2, partCap: 7, perkCap: 4 };
        }
        bag.relation = rel;
        bag.richness = rich;
        this._visitBag = bag;
        return bag;
    }

    flatStock() {
        return this.flatPerks().concat(this.flatParts());
    }

    _rollSeedHash(str) {
        let h = 2166136261;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    shopClassKeyForItem(item) {
        if (!item) return 'sustained';
        if (item.kind === 'part') {
            if (item.partKind === 'weapon' && typeof balanceConfigManager !== 'undefined') {
                return balanceConfigManager.getWeaponRole(item.id) || 'sustained';
            }
            if (item.partKind === 'defense') return 'defense';
            if (item.partKind === 'energy') return 'energy';
            return 'ability';
        }
        if (item.kind === 'weapon') return 'perk_weapon';
        return 'perk_buff';
    }

    rollShopOfferStats(item, index) {
        const bcm = typeof balanceConfigManager !== 'undefined' ? balanceConfigManager : null;
        const classKey = this.shopClassKeyForItem(item);
        const def = (bcm && bcm.SHOP_ITEM_CLASSES && bcm.SHOP_ITEM_CLASSES[classKey])
            || { label: classKey.toUpperCase() };
        const idKey = item.id || item.label || String(index);
        let s = ((this._visitSeed || 0) ^ this._rollSeedHash(idKey + ':' + index)) >>> 0;
        const next = () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s;
        };
        const pick = (pair) => {
            if (!pair || pair.length < 2) return 1;
            const t = (next() % 10000) / 10000;
            return Math.round((pair[0] + t * (pair[1] - pair[0])) * 1000) / 1000;
        };
        const mul = {};
        if (def.dmg) mul.dmgMul = pick(def.dmg);
        if (def.spd) mul.spdMul = pick(def.spd);
        if (def.cd) mul.cdMul = pick(def.cd);
        if (def.potency) mul.potencyMul = pick(def.potency);
        if (def.duration) mul.durationMul = pick(def.duration);
        if (def.ammo) mul.ammoMul = pick(def.ammo);
        return { classKey, classLabel: def.label || classKey.toUpperCase(), mul };
    }

    applyShopClassification(item, index) {
        const roll = this.rollShopOfferStats(item, index);
        item.shopClass = roll.classKey;
        item.shopClassLabel = roll.classLabel;
        item.shopRoll = roll.mul;
    }

    rolledWeaponStatLine(weaponId, mul) {
        const w = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon)
            ? weaponConfigManager.getWeapon(weaponId) : null;
        if (!w) return '';
        const m = mul || {};
        const dmg = Math.round((w.damage || 0) * (m.dmgMul || 1));
        const spd = Math.round((w.speed || 0) * (m.spdMul || 1) * 10) / 10;
        const cd = Math.max(50, (w.cooldown || 300) * (m.cdMul || 1));
        const rate = (1000 / cd).toFixed(1) + '/S';
        return 'DMG ' + dmg + ' · SPD ' + spd + ' · ' + rate;
    }

    scaleStatTipLine(line, potencyMul) {
        const mul = Number(potencyMul) || 1;
        if (Math.abs(mul - 1) < 0.001) return line;
        return String(line).replace(/(\+?\d+(?:\.\d+)?)/g, (m) => {
            const n = Number(m);
            if (!Number.isFinite(n)) return m;
            const v = Math.round(n * mul * 10) / 10;
            return (v >= 0 && !String(m).startsWith('-') ? (String(m).startsWith('+') ? '+' : '') : '') + v;
        });
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

        // Offer size follows this planet's shop bag (modest → rich).
        const bag = this.shopStockLayout();
        const cap = bag.partCap || 8;
        const picked = [];
        const kindCount = { weapon: 0, defense: 0, ability: 0, energy: 0 };
        const kindCap = bag.partCap >= 14
            ? { weapon: 5, defense: 4, ability: 4, energy: 2 }
            : (bag.partCap >= 10
                ? { weapon: 4, defense: 3, ability: 3, energy: 2 }
                : (bag.partCap <= 7
                    ? { weapon: 2, defense: 2, ability: 2, energy: 1 }
                    : { weapon: 3, defense: 2, ability: 2, energy: 1 }));
        list.forEach((e) => {
            if (picked.length >= cap) return;
            if ((kindCount[e.partKind] || 0) >= (kindCap[e.partKind] || 1)) return;
            kindCount[e.partKind] = (kindCount[e.partKind] || 0) + 1;
            picked.push(e);
        });
        picked.forEach((e, i) => this.applyShopClassification(e, i));
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
        this._perksOffer = null;
        this._visitBag = null;
        this._visitSeed = 0;
        this._fitCellPx = null;
        this._fittingLock = false;
        const ctx = this.planetContext();
        this._visitSeed = this._rollSeedHash(String(ctx.planetId || ctx.name) + '|' + Date.now());
        this.rollVisitStockLayout();
        this.buildPerksOffer();
        this.buildPartsOffer();
        if (!this.fromVictory
            && typeof game !== 'undefined'
            && game.gameState
            && game.gameState.pauseGame) {
            game.gameState.pauseGame();
        }
        if (typeof soundManager !== 'undefined' && soundManager.startShopMusic) {
            const planet = (typeof soundManager._endMusicPlanet !== 'undefined'
                && soundManager._endMusicPlanet)
                || soundManager._currentPlanetId
                || (typeof galaxyMapManager !== 'undefined' && galaxyMapManager.selectedPlanetId)
                || 'mars';
            soundManager.startShopMusic(planet, {
                resume: this.fromVictory ? 'victory' : 'menu'
            });
        }
        this.renderDom();
        this.persistShopSession();
    }

    showFromVictory() {
        this.show({ fromVictory: true });
    }

    close() {
        if (!this.isOpen) return;
        this.clearShopSession();
        this.isOpen = false;
        this.markedForSale.clear();
        this.cartBuys.clear();
        this._partsOffer = null;
        this._perksOffer = null;
        this._visitBag = null;
        this._fitCellPx = null;
        this._fittingLock = false;
        if (this._shopRo) {
            try { this._shopRo.disconnect(); } catch (e) { /* ignore */ }
            this._shopRo = null;
        }
        this._unpatchHomeStation();
        if (this._faceRaf) cancelAnimationFrame(this._faceRaf);
        this._faceRaf = null;
        const el = document.getElementById('vf-in-stage-shop');
        if (el) el.remove();
        const wasVictory = this.fromVictory;
        this.fromVictory = false;
        if (typeof soundManager !== 'undefined' && soundManager.stopShopMusic) {
            soundManager.stopShopMusic();
        }
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
        let id = sep === -1 ? dragKey : dragKey.slice(sep + 1);
        if (!id || typeof profileManager === 'undefined') return 0;
        // Storage cells use instance keys (`defId#unit`); sell value is per def.
        if (bucket !== 'blueprints' && profileManager.partDefId) {
            id = profileManager.partDefId(id) || id;
        }
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
            this.persistShopSession();
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
        this.persistShopSession();
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

    creditHoverFromTarget(target) {
        if (!target || !target.closest) return null;
        const buyNow = target.closest('[data-shop-buy-now]');
        if (buyNow) {
            const item = this.resolveBuyKey(buyNow.getAttribute('data-shop-buy-now'));
            if (!item) return null;
            const cost = Math.max(0, Math.round(Number(item.cost) || 0));
            if (!cost) return null;
            return {
                delta: -cost,
                next: Math.max(0, this.getCredits() - cost)
            };
        }
        const buy = target.closest('[data-shop-buy]');
        if (buy) {
            const item = this.resolveBuyKey(buy.getAttribute('data-shop-buy'));
            if (!item) return null;
            const cost = Math.max(0, Math.round(Number(item.cost) || 0));
            if (!cost) return null;
            const inCart = this.cartBuys.has(this.stockBuyKey(item));
            const delta = inCart ? cost : -cost;
            return {
                delta,
                next: Math.max(0, this.projectedCredits() + delta)
            };
        }
        const inv = target.closest(
            '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
        );
        if (!inv || inv.classList.contains('is-equipped')) return null;
        const val = this.sellValueForCell(inv);
        if (val <= 0) return null;
        const mark = this.saleMarkKey(
            inv.getAttribute('data-drag-source') || '',
            inv.getAttribute('data-drag-ship') || '',
            inv.getAttribute('data-drag-key') || ''
        );
        const marked = this.markedForSale.has(mark);
        const delta = marked ? -val : val;
        return {
            delta,
            next: Math.max(0, this.projectedCredits() + delta)
        };
    }

    creditDeltaHtml(delta) {
        const d = Math.round(Number(delta) || 0);
        if (!d) return '';
        const sign = d > 0 ? '+' : '−';
        return `<span class="vf-iss-cash-delta${d > 0 ? ' is-gain' : ' is-spend'}">` +
            `${sign}${Math.abs(d)}</span>`;
    }

    traderCashIconHtml() {
        const key = this.resourceIconKey('credits');
        if (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml) {
            return iconRenderer.imgHtml(key, 28, 'vf-iss-cash-ico hs-pixel', '#ffd24a', false);
        }
        return this.iconHtml(key, 28);
    }

    /** One credit icon + compact amounts (no icon spam per number). */
    traderCashBarHtml(now, displayNext, opts) {
        const o = opts || {};
        const idle = !o.pending && !o.preview;
        const icon = `<span class="vf-iss-cash-chip-ico" aria-hidden="true">${this.traderCashIconHtml()}</span>`;
        if (idle) {
            return icon +
                `<span class="vf-iss-cash-stack">` +
                `<span class="vf-iss-cash-row">` +
                `<span class="vf-iss-cash-amt">${now}</span>` +
                `<span class="vf-iss-cash-label">ON HAND</span>` +
                `</span></span>`;
        }
        const deltaHtml = o.previewDelta ? this.creditDeltaHtml(o.previewDelta) : '';
        const showArrow = now !== displayNext || o.pending || o.preview;
        const nextHtml = showArrow
            ? `<span class="vf-iss-cash-arrow" aria-hidden="true">→</span>` +
                `<span class="vf-iss-cash-amt is-next">${displayNext}</span>`
            : '';
        return icon +
            `<span class="vf-iss-cash-stack">` +
            `<span class="vf-iss-cash-row">` +
            `<span class="vf-iss-cash-amt">${now}</span>` +
            `${nextHtml}` +
            `${deltaHtml}` +
            `</span></span>`;
    }

    updateWalletProjection(hover) {
        const root = document.getElementById('vf-in-stage-shop');
        if (!root) return;
        const now = this.getCredits();
        const settled = this.projectedCredits();
        const pending = this.cartBuys.size || this.markedForSale.size;
        const preview = hover && hover.delta ? hover : null;
        const displayNext = preview ? preview.next : settled;
        const cash = root.querySelector('.vf-iss-trader-cash');
        if (cash) {
            cash.classList.toggle('is-hover-preview', !!preview);
            cash.innerHTML = this.traderCashBarHtml(now, displayNext, {
                pending,
                preview: !!preview,
                previewDelta: preview ? preview.delta : 0
            });
        }
        this.refreshDetailBuyButton();
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
        if (this.markedForSale.has(mark)) {
            this.markedForSale.delete(mark);
        } else {
            // Starter loadout copies (owned=0, filed only) cannot be sold.
            if (typeof profileManager !== 'undefined' && profileManager._ownedStorageCount) {
                const sep = dragKey.indexOf(':');
                const bucket = sep === -1 ? '' : dragKey.slice(0, sep);
                const rawId = sep === -1 ? dragKey : dragKey.slice(sep + 1);
                if (bucket && bucket !== 'blueprints' && rawId) {
                    const defId = profileManager.partDefId
                        ? profileManager.partDefId(rawId)
                        : rawId;
                    const profile = this.getProfile();
                    if (profile && profileManager._ownedStorageCount(profile, bucket, defId) <= 0) {
                        this.flashFace('sad');
                        this.lastMsg = 'STARTER PART';
                        return false;
                    }
                }
            }
            this.markedForSale.add(mark);
        }
        this.applySaleMarks();
        this.updateCompleteButton();
        this.updateWalletProjection();
        this.persistShopSession();
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
            let cartIco = cell.querySelector('.vf-iss-sell-cart');
            let badge = cell.querySelector('.vf-iss-sell-mark');
            if (on) {
                const val = this.sellValueForCell(cell);
                if (!cartIco) {
                    cartIco = document.createElement('span');
                    cartIco.className = 'vf-iss-sell-cart';
                    cartIco.setAttribute('aria-hidden', 'true');
                    cell.appendChild(cartIco);
                }
                cartIco.innerHTML = this.iconHtml('hsShop', 14);
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'vf-iss-sell-mark';
                    cell.appendChild(badge);
                }
                badge.innerHTML = `+${val}`;
            } else {
                if (cartIco) cartIco.remove();
                if (badge) badge.remove();
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
        btn.classList.toggle('is-trade-buy', canSettle && buys > 0);
        btn.classList.toggle('is-trade-sell', canSettle && sells > 0 && !buys);
        btn.classList.toggle('is-trade-mixed', canSettle && sells > 0 && buys > 0);
        if (!busy) {
            btn.innerHTML = '<span class="vf-iss-complete-main">COMPLETE TRADE</span>';
            return;
        }
        const bits = [];
        if (buys) {
            bits.push(`<span class="vf-iss-complete-bit is-buy">BUY ${this.creditAmountHtml(spend, { sign: '−', size: 11 })}</span>`);
        }
        if (sells) {
            bits.push(`<span class="vf-iss-complete-bit is-sell">SELL ${this.creditAmountHtml(pay, { sign: '+', size: 11 })}</span>`);
        }
        bits.push(`<span class="vf-iss-complete-bit is-net">NET ${this.creditAmountHtml(net, { sign: net >= 0 ? '+' : '−', size: 11 })}</span>`);
        btn.innerHTML =
            '<span class="vf-iss-complete-main">COMPLETE TRADE</span> ' +
            `<span class="vf-iss-complete-meta">(${bits.join('<span class="vf-iss-complete-sep"> · </span>')})</span>`;
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
        this.persistShopSession();
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
            const unit = bag[item.id] || 0;
            bag[item.id] = unit + 1;
            const bucket = item.partKind === 'weapon' ? 'weapons'
                : (item.partKind === 'defense' ? 'defenses'
                    : (item.partKind === 'energy' ? 'energy' : 'abilities'));
            if (item.shopRoll && profileManager.setShopVendorRoll) {
                profileManager.setShopVendorRoll(bucket, item.id + '#' + unit, item.shopRoll, item.shopClass);
            }
            const discoverCat = bucket === 'weapons' ? 'weapons'
                : (bucket === 'defenses' ? 'defenses'
                    : (bucket === 'energy' ? 'energy' : 'abilities'));
            if (profileManager.discover) profileManager.discover(discoverCat, item.id);
            profileManager.save();
            return true;
        }
        if (item.kind === 'weapon') {
            if (this.fromVictory) {
                const ammoMul = (item.shopRoll && item.shopRoll.ammoMul) || 1;
                this.pendingWeapons.push({
                    id: item.id,
                    shots: Math.max(1, Math.round((item.shots || 0) * ammoMul)),
                    cost: cost,
                    label: item.label,
                    icon: item.icon
                });
            } else if (typeof bulletManager !== 'undefined' && bulletManager.equipTemporaryWeapon) {
                bulletManager.equipTemporaryWeapon(item.id, item.shots);
            }
            return true;
        }
        // buff / perk
        if (this.fromVictory) {
            const durMul = (item.shopRoll && item.shopRoll.durationMul) || 1;
            this.pendingBuffs.push({
                id: item.id,
                ms: Math.max(1000, Math.round((item.ms || 0) * durMul)),
                cost: cost,
                label: item.label,
                icon: item.icon
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
        const rawId = sep === -1 ? dragKey : dragKey.slice(sep + 1);
        if (!bucket || !rawId) return { ok: false, reason: 'BAD KEY' };

        if (bucket === 'blueprints') {
            return profileManager.sellBlueprint
                ? profileManager.sellBlueprint(rawId)
                : { ok: false, reason: 'NO API' };
        }

        const kind = this.bucketToSellKind(bucket);
        if (!kind) return { ok: false, reason: 'BAD BUCKET' };

        // Inventory drag-keys are instance ids (`defId#unit`); ledgers use bare defId.
        const parsed = profileManager.parsePartInstanceId
            ? profileManager.parsePartInstanceId(rawId)
            : { defId: rawId, unit: null };
        const defId = parsed.defId || rawId;
        if (!defId) return { ok: false, reason: 'BAD KEY' };

        // Equipped-only: refuse (marking already blocks, but re-check).
        if (source === 'ship' && shipId
            && typeof profileManager._equippedStorageCount === 'function'
            && profileManager._equippedStorageCount(profile, shipId, bucket, defId) > 0) {
            const entry = (profile.shipStorage || {})[shipId];
            const filed = (entry && entry[bucket] && entry[bucket][defId]) || 0;
            if (filed <= 0) return { ok: false, reason: 'EQUIPPED' };
        }

        // Starter loadout copies can sit filed with owned=0 — not sellable stock.
        const owned = profileManager._ownedStorageCount
            ? profileManager._ownedStorageCount(profile, bucket, defId)
            : 0;
        if (owned <= 0) return { ok: false, reason: 'STARTER' };

        // Filed ship cargo must leave the ship's ledger before ownership drops.
        if (source === 'ship' && shipId && profileManager.consumeFiledPart) {
            const entry = (profile.shipStorage || {})[shipId];
            const filed = (entry && entry[bucket] && entry[bucket][defId]) || 0;
            if (filed > 0) profileManager.consumeFiledPart(profile, shipId, bucket, defId);
        }

        // Pass the instance id so sellPart can compact per-copy upgrades.
        return profileManager.sellPart
            ? profileManager.sellPart(kind, rawId)
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

    /** Drop zones for dragging stock onto ship / station (or complete) for instant buy. */
    _shopBuyDropTarget(x, y) {
        const el = document.elementFromPoint(x, y);
        if (!el || !el.closest) return null;
        const root = document.getElementById('vf-in-stage-shop');
        if (!root || !root.contains(el)) return null;
        const complete = el.closest('[data-shop-complete]');
        if (complete && !complete.disabled) return { kind: 'complete', el: complete };
        const bag = el.closest('.vf-iss-ship-inv, .vf-iss-station-inv, .vf-iss-station, section.vf-iss-station');
        if (bag) return { kind: 'bag', el: bag };
        return null;
    }

    _clearShopBuyDropMarks(root) {
        if (!root) return;
        root.querySelectorAll('.is-shop-buy-over, .is-shop-buy-denied').forEach((n) => {
            n.classList.remove('is-shop-buy-over', 'is-shop-buy-denied');
        });
    }

    _shopBuyDragAfford(item, cost) {
        const c = Math.max(0, Math.round(Number(cost) || 0));
        if (!item || !c) return false;
        return typeof profileManager !== 'undefined' && profileManager.canAffordCredits
            ? profileManager.canAffordCredits(c)
            : this.getCredits() >= c;
    }

    _markShopBuyDrop(root, x, y, item, cost) {
        this._clearShopBuyDropMarks(root);
        const hit = this._shopBuyDropTarget(x, y);
        if (!hit || !hit.el) return null;
        const afford = this._shopBuyDragAfford(item, cost);
        hit.el.classList.add('is-shop-buy-over');
        hit.el.classList.toggle('is-shop-buy-denied', !afford);
        return { hit: hit, afford: afford };
    }

    /** Drag stock onto ship / station for purchase preview; drop buys immediately. */
    bindStockDrag(root) {
        if (!root) return;
        root.querySelectorAll('.vf-iss-stock-grid [data-shop-buy]').forEach((cell) => {
            cell.setAttribute('draggable', 'false');
            cell.addEventListener('dragstart', (e) => e.preventDefault());
            cell.addEventListener('pointerdown', (ev) => this._stockDragStart(ev, cell, root));
        });
    }

    _stockDragStart(downEv, cell, root) {
        if (downEv.button !== undefined && downEv.button !== 0) return;
        const buyKey = cell.getAttribute('data-shop-buy') || '';
        if (!buyKey) return;
        const item = this.resolveBuyKey(buyKey);
        const cost = Math.max(
            0,
            Math.round(Number((item && item.cost) || cell.getAttribute('data-shop-cost')) || 0)
        );
        const startX = downEv.clientX;
        const startY = downEv.clientY;
        const THRESH = 6;
        let dragging = false;
        let ghost = null;
        let place = null;
        let rafId = 0;
        let lastMove = null;
        let detailPreviewOn = false;

        const walletPreviewForDrag = (x, y, afford) => {
            if (!item || !cost || !afford) {
                this.updateWalletProjection();
                return;
            }
            this.updateWalletProjection({
                delta: -cost,
                next: Math.max(0, this.getCredits() - cost)
            });
        };

        const startDrag = () => {
            dragging = true;
            cell.classList.add('is-dragging');
            document.body.classList.add('hs-part-grabbing');
            if (typeof uiTooltip !== 'undefined' && uiTooltip && uiTooltip.hide) uiTooltip.hide();
            ghost = document.createElement('div');
            ghost.className = 'hs-storage-drag-ghost vf-iss-stock-drag-ghost';
            const ghostInner = cell.cloneNode(true);
            ghostInner.classList.add('hs-storage-drag-ghost-inner');
            const mark = ghostInner.querySelector('.vf-iss-cart-mark');
            if (mark) mark.remove();
            const badges = ghostInner.querySelector('.vf-iss-stock-hover-badges');
            if (badges) {
                badges.classList.add('is-drag-visible');
                const costEl = badges.querySelector('.vf-iss-stock-cost');
                if (costEl && cost) costEl.innerHTML = this.creditAmountHtml(cost, { size: 11 });
            }
            ghost.appendChild(ghostInner);
            ghost.style.cssText = 'position:fixed;left:0;top:0;margin:0;pointer-events:none;z-index:10050;';
            document.body.appendChild(ghost);
            const o = ghost.getBoundingClientRect();
            ghost.style.left = '100px';
            const k = (ghost.getBoundingClientRect().left - o.left) / 100 || 1;
            place = (x, y) => {
                ghost.style.left = `${(x - o.left) / k - (cell.offsetWidth / 2)}px`;
                ghost.style.top = `${(y - o.top) / k - (cell.offsetHeight / 2)}px`;
            };
            ghost.style.width = cell.offsetWidth + 'px';
            ghost.style.height = cell.offsetHeight + 'px';
        };

        const applyMove = (ev) => {
            if (!dragging) {
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESH) return;
                startDrag();
            }
            if (place) place(ev.clientX, ev.clientY);
            const marked = this._markShopBuyDrop(root, ev.clientX, ev.clientY, item, cost);
            const onDropZone = !!(marked && marked.hit);
            if (onDropZone !== detailPreviewOn) {
                detailPreviewOn = onDropZone;
                if (onDropZone) this.showDetail(this.detailFromStockItem(item));
            }
            walletPreviewForDrag(ev.clientX, ev.clientY, marked && marked.afford);
        };

        const onMove = (ev) => {
            lastMove = ev;
            if (!rafId) {
                rafId = requestAnimationFrame(() => {
                    rafId = 0;
                    if (lastMove) applyMove(lastMove);
                });
            }
        };

        const cleanup = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            lastMove = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onCancel);
            document.removeEventListener('keydown', onEsc, true);
            try {
                if (downEv.target && downEv.target.releasePointerCapture) {
                    downEv.target.releasePointerCapture(downEv.pointerId);
                }
            } catch (err) { /* ignore */ }
            cell.classList.remove('is-dragging');
            document.body.classList.remove('hs-part-grabbing');
            this._clearShopBuyDropMarks(root);
            if (ghost) { ghost.remove(); ghost = null; }
            this.updateWalletProjection();
        };

        const onUp = (ev) => {
            const wasDragging = dragging;
            const drop = wasDragging ? this._shopBuyDropTarget(ev.clientX, ev.clientY) : null;
            cleanup();
            if (!wasDragging || !drop || !item) return;
            const suppressClick = (e) => { e.preventDefault(); e.stopPropagation(); };
            cell.addEventListener('click', suppressClick, { capture: true, once: true });
            setTimeout(() => cell.removeEventListener('click', suppressClick, true), 0);
            if (!this._shopBuyDragAfford(item, cost)) {
                this.flashFace('sad');
                this.lastMsg = 'NOT ENOUGH CREDITS';
                return;
            }
            this.buyItemNow(item);
        };

        const onCancel = () => cleanup();
        const onEsc = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            cleanup();
        };

        try {
            if (downEv.target && downEv.target.setPointerCapture) {
                downEv.target.setPointerCapture(downEv.pointerId);
            }
        } catch (err) { /* ignore */ }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onCancel);
        document.addEventListener('keydown', onEsc, true);
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

    /** Detail pane: charge credits and grant immediately (no cart / COMPLETE TRADE). */
    buyItemNow(item) {
        if (!item || typeof profileManager === 'undefined') {
            this.flashFace('sad');
            return false;
        }
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        if (!profileManager.canAffordCredits(cost)) {
            this.flashFace('sad');
            this.lastMsg = 'NOT ENOUGH CREDITS';
            this.refreshDetailBuyButton();
            return false;
        }
        if (!this._fulfillCartBuy(item)) {
            this.flashFace('sad');
            this.lastMsg = 'BUY FAILED';
            return false;
        }
        const key = this.stockBuyKey(item);
        if (key) this.cartBuys.delete(key);
        this.flashFace('happy');
        this.lastMsg = `BOUGHT · −${cost}c · ${String(item.label || item.id).toUpperCase()}`;
        this.renderDom();
        this.persistShopSession();
        return true;
    }

    detailBuyButtonHtml(item) {
        if (!item || item.cost == null) return '';
        const key = this.stockBuyKey(item);
        if (!key) return '';
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        const afford = typeof profileManager !== 'undefined' && profileManager.canAffordCredits
            ? profileManager.canAffordCredits(cost)
            : this.getCredits() >= cost;
        const dis = afford ? '' : ' disabled';
        return `<div class="vf-iss-detail-actions">` +
            `<button type="button" class="vf-iss-detail-buy" data-shop-buy-now="${key}" data-nav-item tabindex="-1"${dis}>` +
            `<span class="vf-iss-detail-buy-label">BUY NOW</span>` +
            `<span class="vf-iss-detail-buy-cost">${this.creditAmountHtml(cost, { size: 14 })}</span>` +
            `</button></div>`;
    }

    refreshDetailBuyButton() {
        const btn = document.querySelector('#vf-in-stage-shop [data-shop-buy-now]');
        if (!btn) return;
        const item = this.resolveBuyKey(btn.getAttribute('data-shop-buy-now'));
        if (!item) return;
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        const afford = typeof profileManager !== 'undefined' && profileManager.canAffordCredits
            ? profileManager.canAffordCredits(cost)
            : this.getCredits() >= cost;
        btn.disabled = !afford;
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
        if (el.hasAttribute('data-shop-buy-now')) {
            this.buyItemNow(this.resolveBuyKey(el.getAttribute('data-shop-buy-now')));
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
            credits: 'resCredits',
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        return map[id] || 'resScrap';
    }

    /** Credits with menu icon (replaces trailing «c»). */
    creditAmountHtml(amount, opts) {
        const o = opts || {};
        const raw = Math.round(Number(amount) || 0);
        const sign = o.sign != null ? String(o.sign) : '';
        const display = sign ? Math.abs(raw) : raw;
        const size = o.size || 14;
        const extra = o.className ? ` ${o.className}` : '';
        const signHtml = sign
            ? `<span class="vf-iss-credit-sign">${sign}</span>`
            : '';
        return `<span class="vf-iss-credit${extra}">` +
            signHtml +
            `<span class="vf-iss-credit-num">${display}</span>` +
            `<span class="vf-iss-credit-icon" aria-hidden="true">` +
            `${this.iconHtml(this.resourceIconKey('credits'), size)}` +
            `</span></span>`;
    }

    /** Same generative casing the hangar bay uses — ability_* UI icons tint into blank blobs.
     *  `span` is [w,h] slots so M/L parts fill their multi-cell footprint. */
    stockVisualHtml(item, cellPx, span) {
        const sw = Math.max(1, (span && span[0]) || 1);
        const sh = Math.max(1, (span && span[1]) || 1);
        const boxW = Math.max(16, sw * (cellPx | 0) - 4);
        const boxH = Math.max(16, sh * (cellPx | 0) - 4);
        const box = Math.min(boxW, boxH);
        let kind = 'ability';
        let color = '#c08cff';
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
        } else {
            const pu = (typeof POWER_UPS !== 'undefined') ? POWER_UPS[item.id] : null;
            if (item.id === 'barrier' || item.id === 'aegis' || item.id === 'repair' || item.id === 'stim') {
                kind = 'defense';
                color = (pu && pu.color) || '#5cff7a';
            } else if (item.id === 'speed_boost' || item.id === 'turbo' || item.id === 'magnet'
                || item.id === 'scrapper' || item.id === 'double_loot') {
                kind = 'ability';
                color = (pu && pu.color) || '#ff8a3a';
            } else {
                kind = 'weapon';
                color = (pu && pu.color) || '#ffcf3a';
            }
        }
        // Shop stock: plain casing (no baked-in gem/glow) — type icon shows in hover badge.
        if (typeof physicalItem !== 'undefined' && physicalItem.wrap) {
            const wrapped = physicalItem.wrap(kind, physId, boxW, boxH, color, '', { plain: true });
            if (wrapped) return wrapped;
        }
        return '';
    }

    detailTitleIconHtml(item, cell) {
        const s = 20;
        const wrap = (inner) => `<span class="vf-iss-detail-title-ico" aria-hidden="true">${inner}</span>`;
        if (item) {
            if ((item.kind === 'part' && item.partKind === 'weapon') || item.kind === 'weapon') {
                if (typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
                    return wrap(iconRenderer.weaponImgHtml(item.id, s, 'vf-iss-icon', false));
                }
            }
            if (item.kind !== 'part') {
                const pu = (typeof POWER_UPS !== 'undefined') ? POWER_UPS[item.id] : null;
                const color = (pu && pu.color) || '#c08cff';
                return wrap(this.powerUpBadgeHtml(item.id, color, s));
            }
            const kindIcon = {
                weapon: 'statWeapon',
                defense: 'statArmor',
                energy: 'statEnergy',
                ability: 'statAbilities'
            };
            const key = kindIcon[item.partKind] || 'statAbilities';
            return wrap(this.iconHtml(key, s));
        }
        if (!cell) return '';
        const kind = cell.getAttribute('data-part-kind') || '';
        const id = cell.getAttribute('data-part-id') || '';
        if (!kind || !id) return '';
        if (kind === 'weapon' && typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
            return wrap(iconRenderer.weaponImgHtml(id, s, 'vf-iss-icon', false));
        }
        if (kind === 'blueprint') {
            return wrap(this.iconHtml('hsBlueprint', s));
        }
        const kindIcon = {
            weapon: 'statWeapon',
            defense: 'statArmor',
            energy: 'statEnergy',
            ability: 'statAbilities'
        };
        const key = kindIcon[kind] || 'statAbilities';
        return wrap(this.iconHtml(key, s));
    }

    stockTypeBadgeHtml(item, cs) {
        const s = Math.max(14, Math.floor((cs | 0) * 0.34));
        const isWeapon = (item.kind === 'part' && item.partKind === 'weapon') || item.kind === 'weapon';
        if (isWeapon && typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml) {
            return `<span class="vf-iss-stock-type-ico">${iconRenderer.weaponImgHtml(item.id, s, 'vf-iss-icon', false)}</span>`;
        }
        if (item.kind !== 'part') {
            const pu = (typeof POWER_UPS !== 'undefined') ? POWER_UPS[item.id] : null;
            const color = (pu && pu.color) || '#c08cff';
            return `<span class="vf-iss-stock-type-ico">${this.powerUpBadgeHtml(item.id, color, s)}</span>`;
        }
        const kindIcon = {
            weapon: 'statWeapon',
            defense: 'statArmor',
            energy: 'statEnergy',
            ability: 'statAbilities'
        };
        const key = kindIcon[item.partKind] || 'statAbilities';
        return `<span class="vf-iss-stock-type-ico">${this.iconHtml(key, s)}</span>`;
    }

    escTip(s) {
        return String(s == null ? '' : s).replace(/"/g, '&quot;');
    }

    /** Stat / flavour lines for a perk or temp weapon. */
    perkDetailLines(item) {
        const lines = ['TEMP · NEXT STAGE'];
        const mul = item.shopRoll || {};
        if (item.shopClassLabel) {
            lines.push('CLASS · ' + item.shopClassLabel);
            if (typeof balanceConfigManager !== 'undefined' && balanceConfigManager.shopClassRangeLine) {
                const r = balanceConfigManager.shopClassRangeLine(item.shopClass);
                if (r) lines.push(r);
            }
        }
        (item.stats || []).forEach((s) => {
            lines.push(mul.potencyMul ? this.scaleStatTipLine(String(s), mul.potencyMul) : String(s));
        });
        if (item.kind === 'weapon') {
            const w = (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon)
                ? weaponConfigManager.getWeapon(item.id) : null;
            if (w) {
                lines.push(this.rolledWeaponStatLine(item.id, mul));
                const shots = Math.max(1, Math.round((item.shots || 0) * (mul.ammoMul || 1)));
                lines.push('AMMO ' + shots);
                if (w.description) lines.push(String(w.description));
            } else if (item.shots != null) {
                lines.push('AMMO ' + Math.max(1, Math.round(item.shots * (mul.ammoMul || 1))));
            }
            lines.push('REVERTS WHEN AMMO EMPTY');
        } else if (item.ms) {
            const sec = Math.max(1, Math.round((item.ms / 1000) * (mul.durationMul || 1)));
            lines.push('DURATION ' + sec + 's');
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
        const mul = item.shopRoll || {};
        if (item.shopClassLabel) {
            lines.push('CLASS · ' + item.shopClassLabel);
            if (typeof balanceConfigManager !== 'undefined' && balanceConfigManager.shopClassRangeLine) {
                const r = balanceConfigManager.shopClassRangeLine(item.shopClass);
                if (r) lines.push(r);
            }
        }
        if (typeof homeStationUI !== 'undefined' && homeStationUI.hangarModuleTip) {
            const tip = String(homeStationUI.hangarModuleTip(item.partKind, item.id) || '');
            tip.split('\n').slice(1).forEach((line) => {
                if (!line) return;
                if (item.partKind === 'weapon' && /^DMG /.test(line)) {
                    lines.push(this.rolledWeaponStatLine(item.id, mul));
                } else if (mul.potencyMul && /(\+|SHIELD|REGEN|MAX ENERGY|\d)/.test(line)) {
                    lines.push(this.scaleStatTipLine(line, mul.potencyMul));
                } else {
                    lines.push(line);
                }
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

    /** Active ship silhouette + slot strip (right-hand pane, always visible). */
    detailShipRigHtml() {
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        if (!shipId || typeof homeStationUI === 'undefined') {
            return `<section class="vf-iss-detail-rig" aria-label="Ship loadout">` +
                `<div class="vf-iss-detail-rig-empty">NO ACTIVE SHIP</div></section>`;
        }
        const ui = homeStationUI;
        const name = (ui.shipName ? ui.shipName(shipId) : shipId).toUpperCase();
        const slm = typeof shipLoadoutManager !== 'undefined' ? shipLoadoutManager : null;
        let slotsHtml = '';
        if (slm && slm.buildHangarSlots && ui.renderHangarSlotsView) {
            const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig)
                ? shipConfigManager.getConfig(shipId) : null;
            const modelClass = (ui.shipModelClass ? ui.shipModelClass(shipId, cfg) : null) || 'starfighter';
            const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
                ? shipConfigManager.getMergedModel(shipId) : null;
            const prevHangar = ui.hangarShipId;
            ui.hangarShipId = shipId;
            const built = slm.buildHangarSlots(shipId, modelClass, merged);
            slotsHtml = ui.renderHangarSlotsView(built.slots || [], built.layout || { width: 0, height: 0 });
            ui.hangarShipId = prevHangar;
        }
        return `<section class="vf-iss-detail-rig" aria-label="Ship loadout">` +
            `<div class="vf-iss-detail-rig-head">` +
            `<span class="vf-iss-detail-ship-kicker">SHIP</span>` +
            `<strong class="vf-iss-detail-ship-name">${String(name).replace(/</g, '&lt;')}</strong>` +
            `</div>` +
            `<canvas class="vf-iss-detail-ship-canvas" data-shop-ship-canvas width="200" height="120" aria-hidden="true"></canvas>` +
            `<div class="vf-iss-detail-slots">${slotsHtml || '<div class="vf-iss-detail-rig-empty">NO SLOTS</div>'}</div>` +
            `<p class="vf-iss-detail-rig-hint">LEFT-CLICK INV · SELL · RIGHT-CLICK · ASSIGN</p>` +
            `</section>`;
    }

    paintDetailShipCanvas(root) {
        const canvas = root && root.querySelector('[data-shop-ship-canvas]');
        if (!canvas || typeof shipRenderer === 'undefined' || !shipRenderer.renderShipPreview) return;
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        if (!shipId || typeof homeStationUI === 'undefined') return;
        const ui = homeStationUI;
        const model = (ui.getHangarShipModel ? ui.getHangarShipModel(shipId) : null) || { id: shipId, type: 'player' };
        try {
            shipRenderer.renderShipPreview(canvas, model, 1);
        } catch (err) { /* ignore */ }
    }

    detailShellHtml() {
        return `<aside class="vf-iss-detail" id="vf-iss-detail" aria-live="polite">` +
            `<h3 class="vf-iss-col-title">DETAIL</h3>` +
            `<div class="vf-iss-detail-body">` +
            `<div class="vf-iss-detail-rig-wrap" id="vf-iss-detail-rig-wrap">${this.detailShipRigHtml()}</div>` +
            `<div class="vf-iss-detail-item" id="vf-iss-detail-item">${this.detailEmptyHtml()}</div>` +
            `</div></aside>`;
    }

    /** Part already in a slot of this kind, or the slot this item would land in. */
    shopEquippedCompareId(shipId, kind, partId) {
        if (!shipId || typeof shipLoadoutManager === 'undefined' || typeof homeStationUI === 'undefined') {
            return null;
        }
        const slm = shipLoadoutManager;
        const ui = homeStationUI;
        const defId = (typeof profileManager !== 'undefined' && profileManager.partDefId)
            ? (profileManager.partDefId(partId) || partId)
            : partId;
        const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig)
            ? shipConfigManager.getConfig(shipId) : null;
        const modelClass = (ui.shipModelClass ? ui.shipModelClass(shipId, cfg) : null) || 'starfighter';
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId) : null;
        const built = slm.buildHangarSlots(shipId, modelClass, merged);
        const indices = [];
        (built.slots || []).forEach((sl) => {
            if (!sl || sl.kind !== kind) return;
            const i = Number(sl.index) || 0;
            if (indices.indexOf(i) === -1) indices.push(i);
        });
        indices.sort((a, b) => a - b);
        const prev = ui.hangarShipId;
        ui.hangarShipId = shipId;
        const same = (a, b) => a === b
            || (profileManager.partDefId && profileManager.partDefId(a) === profileManager.partDefId(b));
        let compareId = null;
        const at = indices.find((i) => same(ui.hangarSlotModuleId(kind, i), partId));
        if (at != null) {
            const other = indices.find((i) => {
                const m = ui.hangarSlotModuleId(kind, i);
                return i !== at && m && !same(m, partId);
            });
            compareId = other ? ui.hangarSlotModuleId(kind, other) : null;
        } else {
            const fits = (i) => !slm.partFitsSlot || slm.partFitsSlot(shipId, kind, defId, i).ok;
            const target = indices.find((i) => !ui.hangarSlotModuleId(kind, i) && fits(i))
                ?? indices.find((i) => fits(i));
            if (target != null) compareId = ui.hangarSlotModuleId(kind, target);
            if (!compareId) {
                compareId = indices.map((i) => ui.hangarSlotModuleId(kind, i)).find((m) => m && !same(m, partId)) || null;
            }
        }
        ui.hangarShipId = prev;
        return compareId && !same(compareId, partId) ? compareId : null;
    }

    detailStatRowsHtml(lines, compareMeta) {
        const meta = compareMeta || {};
        const ui = typeof homeStationUI !== 'undefined' ? homeStationUI : null;
        const shipId = meta.shipId || (this.getProfile() && this.getProfile().activeShipId);
        const partDefId = (meta.partId && typeof profileManager !== 'undefined' && profileManager.partDefId)
            ? (profileManager.partDefId(meta.partId) || meta.partId)
            : meta.partId;
        const src = (lines || []).slice();
        const out = [];
        const lineClass = (text, i) => (ui && ui.detailStatLineClass)
            ? ui.detailStatLineClass(text, i)
            : (i === 0 ? ' is-tag' : (/\d+c$/.test(String(text).trim()) ? ' is-cost' : ''));
        const formatBody = (text) => {
            if (meta.kind === 'weapon' && partDefId && shipId && ui && ui.hangarWeaponStatsHtml
                && /^DMG \d/.test(text)) {
                const prev = ui.hangarShipId;
                ui.hangarShipId = shipId;
                const compareId = this.shopEquippedCompareId(shipId, 'weapon', meta.partId || partDefId);
                const html = ui.hangarWeaponStatsHtml(partDefId, compareId, meta.statMul || null);
                ui.hangarShipId = prev;
                return html;
            }
            if (ui && ui.formatDetailStatLineHtml) return ui.formatDetailStatLineHtml(text);
            return text.replace(/</g, '&lt;');
        };
        for (let i = 0; i < src.length; i++) {
            const text = String(src[i] || '');
            if (/^CLASS ·/i.test(text) && i + 1 < src.length && /^CLASS RANGE ·/i.test(src[i + 1])
                && ui && ui.formatDetailClassClusterHtml) {
                out.push(`<div class="vf-iss-detail-line is-cluster">${ui.formatDetailClassClusterHtml(text, src[i + 1])}</div>`);
                i += 1;
                continue;
            }
            const cls = lineClass(text, i);
            out.push(`<div class="vf-iss-detail-line${cls}">${formatBody(text)}</div>`);
        }
        return out.join('');
    }

    /** Paint the right-hand detail pane for a stock item or inventory cell. */
    showDetail(payload) {
        const root = document.querySelector('#vf-in-stage-shop #vf-iss-detail-item');
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
            ? `<div class="vf-iss-detail-price">${this.creditAmountHtml(payload.cost, { size: 16 })}</div>`
            : '';
        root.innerHTML =
            `<div class="vf-iss-detail-hero">` +
            `<div class="vf-iss-detail-preview" style="--cs:${previewCs}px">${visual}</div>` +
            `<div class="vf-iss-detail-meta">` +
            `<div class="vf-iss-detail-name">${payload.titleIcon || ''}<span class="vf-iss-detail-name-text">${title}</span></div>` +
            tag +
            cost +
            `</div></div>` +
            `<div class="vf-iss-detail-stats">${this.detailStatRowsHtml(payload.lines || [], payload.compareMeta)}</div>` +
            (payload.item ? this.detailBuyButtonHtml(payload.item) : '');
    }

    /** Right-click inventory: equip into the first fitting slot, or unequip when already mounted. */
    toggleInventoryAssign(cell) {
        if (!cell) return false;
        const kind = cell.getAttribute('data-part-kind') || '';
        const id = cell.getAttribute('data-part-id') || '';
        if (!kind || !id || kind === 'blueprint') {
            this.flashFace('sad');
            this.lastMsg = 'CANNOT ASSIGN';
            return false;
        }
        if (typeof homeStationUI === 'undefined' || typeof shipLoadoutManager === 'undefined') return false;
        const ui = homeStationUI;
        const slm = shipLoadoutManager;
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        if (!shipId) {
            this.flashFace('sad');
            return false;
        }
        const cfg = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getConfig)
            ? shipConfigManager.getConfig(shipId) : null;
        const modelClass = (ui.shipModelClass ? ui.shipModelClass(shipId, cfg) : null) || 'starfighter';
        const merged = (typeof shipConfigManager !== 'undefined' && shipConfigManager.getMergedModel)
            ? shipConfigManager.getMergedModel(shipId) : null;
        const built = slm.buildHangarSlots(shipId, modelClass, merged);
        const indices = [];
        (built.slots || []).forEach((sl) => {
            if (!sl || sl.kind !== kind) return;
            const i = Number(sl.index) || 0;
            if (indices.indexOf(i) === -1) indices.push(i);
        });
        indices.sort((a, b) => a - b);
        const prevHangar = ui.hangarShipId;
        ui.hangarShipId = shipId;
        const at = indices.find((i) => ui.hangarSlotModuleId(kind, i) === id);
        if (at != null) {
            ui.applyHangarSlotChoice(kind, at, '', null);
            ui.hangarShipId = prevHangar;
            return true;
        }
        const fits = (i) => !slm.partFitsSlot || slm.partFitsSlot(shipId, kind, id, i).ok;
        const target = indices.find((i) => !ui.hangarSlotModuleId(kind, i) && fits(i))
            ?? indices.find((i) => fits(i));
        ui.hangarShipId = prevHangar;
        if (target == null) {
            this.flashFace('sad');
            this.lastMsg = indices.length ? 'NO FITTING SLOT' : 'NO ' + kind.toUpperCase() + ' SLOT';
            return false;
        }
        ui.hangarShipId = shipId;
        ui.applyHangarSlotChoice(kind, target, id, null);
        ui.hangarShipId = prevHangar;
        return true;
    }

    detailFromStockItem(item) {
        if (!item) return null;
        const isPart = item.kind === 'part';
        const lines = (isPart ? this.partDetailLines(item) : this.perkDetailLines(item)).slice();
        if (isPart && lines[0] === 'PERMANENT PART') lines.shift();
        // Cost already in lines — keep it once in the header price.
        if (lines.length && /\d+c$/.test(String(lines[lines.length - 1]).trim())) lines.pop();
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        let compareMeta = null;
        if (isPart && shipId) {
            compareMeta = {
                kind: item.partKind, partId: item.id, shipId: shipId, statMul: item.shopRoll || null
            };
        } else if (!isPart && item.kind === 'weapon' && shipId) {
            compareMeta = { kind: 'weapon', partId: item.id, shipId: shipId, statMul: item.shopRoll || null };
        } else if (!isPart && item.shopRoll) {
            compareMeta = { statMul: item.shopRoll };
        }
        return {
            item: item,
            title: item.label || item.id,
            titleIcon: this.detailTitleIconHtml(item, null),
            tag: isPart ? 'PERMANENT' : 'TEMP · NEXT STAGE',
            temp: !isPart,
            cost: item.cost,
            lines: lines,
            compareMeta: compareMeta
        };
    }

    detailFromInvCell(cell) {
        if (!cell) return null;
        const kind = cell.getAttribute('data-part-kind') || '';
        const id = cell.getAttribute('data-part-id') || '';
        const dragKey = cell.getAttribute('data-drag-key') || '';
        const head = cell.getAttribute('data-ui-tip-head') || id || 'ITEM';
        const tip = String(cell.getAttribute('data-ui-tip') || '');
        let lines = tip.split('\n').filter(Boolean);
        const headNorm = String(head).trim().toUpperCase();
        if (lines.length && String(lines[0]).trim().toUpperCase() === headNorm) lines = lines.slice(1);
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        const compareMeta = (kind && id && kind !== 'blueprint' && shipId)
            ? { kind: kind, partId: id, shipId: shipId }
            : null;
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
            titleIcon: this.detailTitleIconHtml(null, cell),
            tag: cell.classList.contains('is-equipped') ? 'EQUIPPED'
                : (marked ? 'FOR SALE' : (dragKey.indexOf('blueprints:') === 0 ? 'BLUEPRINT' : 'INVENTORY')),
            temp: false,
            lines: lines,
            visualHtml: visual,
            compareMeta: compareMeta
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
                this.updateWalletProjection(this.creditHoverFromTarget(buy));
                return;
            }
            const inv = target && target.closest && target.closest(
                '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
            );
            if (inv) {
                this.showDetail(this.detailFromInvCell(inv));
                this.updateWalletProjection(this.creditHoverFromTarget(inv));
                return;
            }
            this.updateWalletProjection();
        };
        root.addEventListener('mousemove', (e) => update(e.target));
        root.addEventListener('focusin', (e) => update(e.target));
        root.addEventListener('mouseleave', () => this.updateWalletProjection());
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
            '[data-shop-buy], [data-shop-buy-now], [data-shop-complete], [data-shop-close]'
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
                if (el.hasAttribute('data-shop-buy') || el.hasAttribute('data-shop-buy-now')) {
                    const raw = el.getAttribute('data-shop-buy') || el.getAttribute('data-shop-buy-now');
                    this.showDetail(this.detailFromStockItem(this.resolveBuyKey(raw)));
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

    shopHelpTipText() {
        return [
            'STOCK — click toggles cart (credits on COMPLETE TRADE)',
            'INVENTORY — left-click sell mark, right-click assign',
            'Drag items between ship / station bags to sort',
            'Settle sells and buys with COMPLETE TRADE'
        ].join('\n');
    }

    shopHelpButtonHtml() {
        const tip = this.escTip(this.shopHelpTipText());
        return `<button type="button" class="vf-iss-info-btn" data-ui-tip-head="HOW TO TRADE" data-ui-tip-instant data-ui-tip="${tip}" ` +
            `aria-label="How to trade on this screen" data-nav-item tabindex="-1">?</button>`;
    }

    walletRowHtml() {
        return `<div class="vf-iss-wallet-bar">${this.walletHtml()}</div>`;
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
                `<span class="vf-iss-wallet-ico">${this.iconHtml(this.resourceIconKey(iconId || id), 20)}</span>` +
                `<span class="vf-iss-wallet-meta"><span>${label}</span><b>${n}</b></span>` +
                `</span>`;
        };
        return `<div class="vf-iss-wallet" aria-label="Resources">` +
            ids.map((id) => chip(id, map[id] || 0, id)).join('') +
            `</div>`;
    }

    /** Stash cells — fitted to the main column beside DETAIL (no vertical scroll). */
    SHOP_CELL_PX = 48;
    SHOP_GAP_PX = 2;
    SHOP_CELL_MIN_PX = 32;
    SHOP_CELL_MAX_PX = 120;
    /** Fallback vendor bag when planet context is missing. */
    STOCK_COLS = 7;
    STOCK_ROWS = 3;

    /**
     * Frozen vendor bag for this shop visit.
     * Size is rolled on open from resident-faction standing + luck.
     */
    shopStockLayout() {
        if (this._visitBag) return this._visitBag;
        return this.rollVisitStockLayout();
    }

    /** S/M/L footprint for a stock listing (buffs stay 1×1). */
    stockItemSpan(item) {
        if (!item) return [1, 1];
        if (item.kind === 'part' && item.partKind) {
            if (typeof homeStationUI !== 'undefined' && homeStationUI.shopPartSpan) {
                return homeStationUI.shopPartSpan(item.partKind, item.id);
            }
        }
        if (item.kind === 'weapon') {
            if (typeof homeStationUI !== 'undefined' && homeStationUI.shopPartSpan) {
                return homeStationUI.shopPartSpan('weapon', item.id);
            }
        }
        return [1, 1];
    }

    slotLayout() {
        // Fitted size is already measured at shop zoom 1 — do not re-snap via glass zoom.
        if (this._fitCellPx) {
            return {
                cell: Math.max(this.SHOP_CELL_MIN_PX, Math.min(this.SHOP_CELL_MAX_PX, this._fitCellPx | 0)),
                gap: this.SHOP_GAP_PX
            };
        }
        let cell = this.SHOP_CELL_PX;
        const host = document.getElementById('vf-in-stage-shop');
        const hostW = (host && host.clientWidth) || 0;
        const hostH = (host && host.clientHeight) || 0;
        if (hostW > 0) {
            // First paint guess: main column beside DETAIL (~1.6/2.5 of body).
            const usableW = Math.max(320, Math.floor(hostW * 0.58));
            const usableH = Math.max(240, Math.floor(hostH * 0.62));
            const cols = Math.max(this.STOCK_COLS || 7, 8) * 2;
            const rows = 3 + 3;
            const gap = this.SHOP_GAP_PX;
            const fromW = Math.floor((usableW - gap * (cols - 1) - 12) / cols);
            const fromH = Math.floor((usableH - gap * (rows - 1) - 72) / rows);
            cell = Math.max(
                this.SHOP_CELL_MIN_PX,
                Math.min(this.SHOP_CELL_MAX_PX, Math.min(fromW, fromH))
            );
        }
        return { cell: cell, gap: this.SHOP_GAP_PX };
    }

    /** Apply one cell size to every shop bag grid (measure / final CSS). */
    applyShopCellSize(host, cs) {
        if (!host) return;
        const gap = this.SHOP_GAP_PX;
        host.querySelectorAll(
            '.vf-iss-stock-grid, .vf-iss-inv-grid, .vf-iss-station-grid, .vf-iss-queued-grid, ' +
            '.vf-iss-ship-inv .hs-storage-grid, .vf-iss-station-inv .hs-storage-grid'
        ).forEach((g) => {
            const cols = Math.max(1, parseInt(g.getAttribute('data-inv-cols'), 10) || 1);
            const rows = Math.max(1, parseInt(g.getAttribute('data-inv-rows'), 10) || 1);
            g.style.setProperty('--cs', cs + 'px');
            g.style.setProperty('--hs-gap', gap + 'px');
            g.style.gridTemplateColumns = `repeat(${cols}, ${cs}px)`;
            g.style.gridTemplateRows = `repeat(${rows}, ${cs}px)`;
            g.style.width = (cols * cs + (cols - 1) * gap) + 'px';
            g.style.height = (rows * cs + (rows - 1) * gap) + 'px';
        });
        host.querySelectorAll('.vf-iss-ship-inv, .vf-iss-station-inv').forEach((bag) => {
            bag.style.maxHeight = 'none';
            bag.style.overflow = 'visible';
        });
    }

    /**
     * Largest cell that fills .vf-iss-main up to the DETAIL column without
     * vertical (or horizontal) overflow/scroll.
     */
    measureFitCellPx(host) {
        const main = host && host.querySelector('.vf-iss-main');
        if (!main) return this.SHOP_CELL_PX;
        const availW = main.clientWidth;
        const availH = main.clientHeight;
        if (availW < 80 || availH < 80) return this.SHOP_CELL_PX;

        const bags = host.querySelectorAll('.vf-iss-ship-inv, .vf-iss-station-inv');
        const prevBag = [];
        bags.forEach((bag) => {
            prevBag.push({
                el: bag,
                maxHeight: bag.style.maxHeight,
                overflow: bag.style.overflow
            });
        });
        const prevOverflow = main.style.overflow;
        main.style.overflow = 'hidden';

        let lo = this.SHOP_CELL_MIN_PX;
        let hi = this.SHOP_CELL_MAX_PX;
        let best = lo;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            this.applyShopCellSize(host, mid);
            void main.offsetHeight;
            const fits = main.scrollHeight <= availH + 2 && main.scrollWidth <= availW + 2
                && ![...bags].some((bag) => bag.scrollHeight > bag.clientHeight + 2);
            if (fits) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        this.applyShopCellSize(host, best);
        main.style.overflow = prevOverflow;
        prevBag.forEach((p) => {
            p.el.style.maxHeight = p.maxHeight;
            p.el.style.overflow = p.overflow;
        });
        return best;
    }

    /** Fit bags once after layout, then re-render so icons match the cell. */
    fitBagsToSpace(host) {
        if (!host || this._fittingLock) return;
        const best = this.measureFitCellPx(host);
        if (!best) return;
        if (this._fitCellPx && Math.abs(this._fitCellPx - best) <= 1) {
            this.applyShopCellSize(host, this._fitCellPx);
            return;
        }
        this._fitCellPx = best;
        this._fittingLock = true;
        try {
            this.renderDom();
        } finally {
            this._fittingLock = false;
        }
    }

    bindShopResize(host) {
        if (!host || typeof ResizeObserver === 'undefined') return;
        if (this._shopRo) {
            try { this._shopRo.disconnect(); } catch (e) { /* ignore */ }
            this._shopRo = null;
        }
        let t = 0;
        this._shopRo = new ResizeObserver(() => {
            if (!this.isOpen || this._fittingLock) return;
            clearTimeout(t);
            t = setTimeout(() => {
                if (!this.isOpen) return;
                const el = document.getElementById('vf-in-stage-shop');
                if (!el) return;
                const next = this.measureFitCellPx(el);
                if (!next || (this._fitCellPx && Math.abs(this._fitCellPx - next) <= 1)) return;
                this._fitCellPx = next;
                this._fittingLock = true;
                try { this.renderDom(); } finally { this._fittingLock = false; }
            }, 80);
        });
        this._shopRo.observe(host);
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

    /** Shared cell builder for perk / part vendor grids. Returns { html, span }. */
    stockCellHtml(item, cs, span) {
        const cost = Math.max(0, Math.round(Number(item.cost) || 0));
        item.cost = cost;
        const buyKey = this.stockBuyKey(item);
        const inCart = this.cartBuys.has(buyKey);
        const afford = inCart || this.canAffordCartItem(item);
        const isPart = item.kind === 'part';
        const footprint = span || this.stockItemSpan(item);
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
        const cartBadge = inCart ? `<span class="vf-iss-cart-mark">CART</span>` : '';
        // Keep unaffordable cells clickable so the trader can flash "NOT ENOUGH CREDITS".
        const html = `<button type="button" class="hs-storage-cell vf-iss-stock-cell${isPart ? ' is-part' : ' is-perk'}${afford ? '' : ' is-locked'}${inCart ? ' is-in-cart' : ''}" ` +
            `data-shop-buy="${buyKey}" data-shop-cost="${cost}" data-nav-item tabindex="-1" style="__SPAN__--pk-c:${accent}" ` +
            `data-ui-tip-compact data-ui-tip-head="${head}" data-ui-tip="${tip}" ` +
            `aria-label="Add ${head} to cart for ${cost} credits">` +
            this.stockVisualHtml(item, cs, footprint) +
            cartBadge +
            `<span class="vf-iss-stock-hover-badges">` +
            `${this.stockTypeBadgeHtml(item, cs)}` +
            `<span class="vf-iss-stock-cost">${cost}</span>` +
            `</span>` +
            `</button>`;
        return { html, span: footprint };
    }

    /** Temp perks / temp weapons for the next stage. */
    perkGridHtml() {
        const bag = this.shopStockLayout();
        const cols = bag.cols;
        this._stockCols = cols;
        const layout = this.slotLayout();
        const cs = layout.cell;
        const gap = layout.gap;
        const specs = this.flatPerks().map((item) => this.stockCellHtml(item, cs));
        if (typeof homeStationUI !== 'undefined' && homeStationUI.packShopStockGrid) {
            return homeStationUI.packShopStockGrid(specs, cols, bag.minRows, cs, gap, 'vf-iss-stock-grid vf-iss-perk-grid');
        }
        return this.storageGridShell(cols, bag.minRows, cs, gap, 'vf-iss-stock-grid vf-iss-perk-grid',
            specs.map((s) => s.html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;')).join(''));
    }

    /** Permanent parts that go into ship/station storage. */
    partsGridHtml() {
        const bag = this.shopStockLayout();
        const cols = bag.cols;
        const layout = this.slotLayout();
        const cs = layout.cell;
        const gap = layout.gap;
        const specs = this.flatParts().map((item) => this.stockCellHtml(item, cs));
        if (typeof homeStationUI !== 'undefined' && homeStationUI.packShopStockGrid) {
            return homeStationUI.packShopStockGrid(specs, cols, bag.minRows, cs, gap, 'vf-iss-stock-grid vf-iss-parts-grid');
        }
        return this.storageGridShell(cols, bag.minRows, cs, gap, 'vf-iss-stock-grid vf-iss-parts-grid',
            specs.map((s) => s.html.replace('__SPAN__', 'grid-column: span 1; grid-row: span 1;')).join(''));
    }

    /** Both vendor grids under STOCK — side by side, wrap when too wide. */
    stockGridsHtml() {
        return `<div class="vf-iss-stock-row">` +
            `<div class="vf-iss-stock-bay">` +
            `<h3 class="vf-iss-col-title vf-iss-sub-title">PERKS · NEXT STAGE</h3>` +
            this.perkGridHtml() +
            `</div>` +
            `<div class="vf-iss-stock-bay">` +
            `<h3 class="vf-iss-col-title vf-iss-sub-title">PARTS · PERMANENT</h3>` +
            this.partsGridHtml() +
            `</div>` +
            `</div>`;
    }

    /** Ship cargo bay at shop slot size. */
    shipInventoryHtml() {
        const profile = this.getProfile();
        const shipId = profile && profile.activeShipId;
        if (!profile || !shipId || typeof homeStationUI === 'undefined' || !homeStationUI.renderShipStorage) {
            return this.fallbackInventoryGrid(this.slotLayout(), 'vf-iss-inv-grid');
        }
        const bagCols = this.shopStockLayout().cols;
        const { html } = this.withShopSlotSize(() => homeStationUI.renderShipStorage(profile, shipId, {
            tipAction: false,
            extraGridClass: 'vf-iss-inv-grid',
            // Real S/M/L footprints — bag width follows this shop's offer size.
            compactSpans: false,
            maxCols: bagCols
        }));
        return html || this.fallbackInventoryGrid(this.slotLayout(), 'vf-iss-inv-grid');
    }

    /** Station storage bay at the same shop slot size, beside ship. */
    stationInventoryHtml() {
        const profile = this.getProfile();
        if (!profile || typeof homeStationUI === 'undefined' || !homeStationUI.renderStationStorage) {
            return this.emptyBagHtml('STATION EMPTY');
        }
        const bagCols = this.shopStockLayout().cols;
        const { html } = this.withShopSlotSize(() => homeStationUI.renderStationStorage(profile, {
            tipAction: false,
            compactSpans: false,
            maxCols: bagCols
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
        const cols = this.shopStockLayout().cols;
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
    /** Keep the shop panel filling the glass host (1:1 CSS, no shrink zoom). */
    fitPanelToHost(host) {
        if (!host) return;
        const panel = host.querySelector('.vf-iss-panel');
        if (!panel) return;
        panel.style.width = '100%';
        panel.style.height = '100%';
        panel.style.zoom = '';
        panel.style.transform = '';
    }

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
                if (e.button !== 0) return;
                const invCell = e.target.closest(
                    '.vf-iss-ship-inv .hs-storage-cell[data-drag-key], .vf-iss-station-inv .hs-storage-cell[data-drag-key]'
                );
                if (invCell) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!invCell.classList.contains('is-dragging')) this.toggleMarkForSale(invCell);
                    return;
                }
                const buyNowBtn = e.target.closest('[data-shop-buy-now]');
                if (buyNowBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const list = this.focusables();
                    const idx = list.indexOf(buyNowBtn);
                    if (idx >= 0) this.focusIndex = idx;
                    this.buyItemNow(this.resolveBuyKey(buyNowBtn.getAttribute('data-shop-buy-now')));
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
                this.toggleInventoryAssign(cell);
            });
            el.addEventListener('mousemove', (e) => {
                const btn = e.target.closest(
                    '[data-shop-buy], [data-shop-buy-now], [data-shop-complete], [data-shop-close]'
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
        const rel = (this._visitBag && this._visitBag.relation) || this.planetFactionRelation();
        const standLabel = String((rel && rel.label) || 'NEUTRAL').toUpperCase();
        const pendingNote = (this.pendingBuffs.length || this.pendingWeapons.length)
            ? `<div class="vf-iss-note">QUEUED FOR NEXT STAGE</div>`
            : '';
        el.innerHTML =
            `<div class="vf-iss-panel" data-faction="${String(ctx.faction || 'terran').toLowerCase()}" role="dialog" aria-label="Planet shop">` +
            `<div class="vf-iss-primary">` +
            `<header class="vf-iss-head">` +
            `<div class="vf-iss-trader">` +
            `<div class="vf-iss-portrait">${this.portraitHtml(ctx)}</div>` +
            `<div class="vf-iss-trader-meta">` +
            `<div class="vf-iss-trader-title">${ctx.name} LOCAL</div>` +
            `<div class="vf-iss-trader-sub">${factionLabel} · ${standLabel} · PLANET TRADER</div>` +
            `<div class="vf-iss-trader-cash">${this.traderCashBarHtml(this.getCredits(), this.getCredits(), {})}</div>` +
            `</div></div>` +
            `<div class="vf-iss-head-actions">` +
            `${this.shopHelpButtonHtml()}` +
            `<button type="button" class="vf-iss-close" data-shop-close data-nav-item tabindex="-1">CLOSE [E / B]</button>` +
            `</div></header>` +
            this.walletRowHtml() +
            pendingNote +
            `<div class="vf-iss-body">` +
            `<div class="vf-iss-main">` +
            `<section class="vf-iss-col vf-iss-stock">` +
            `<h3 class="vf-iss-col-title">STOCK</h3>` +
            this.stockGridsHtml() +
            `</section>` +
            this.inventoryColumnsHtml() +
            `<footer class="vf-iss-foot">` +
            `<button type="button" class="vf-iss-complete" data-shop-complete data-nav-item tabindex="-1" disabled><span class="vf-iss-complete-main">COMPLETE TRADE</span></button>` +
            `</footer>` +
            `</div>` +
            `</div>` +
            `</div>` +
            this.detailShellHtml() +
            `</div>`;
        // Theme lives on the root; re-apply after innerHTML so dataset/vars stay.
        this.applyTraderTheme(el, ctx.faction);
        this.fitPanelToHost(el);
        if (typeof voxelPortrait !== 'undefined' && voxelPortrait.scan) {
            voxelPortrait.scan(el);
        }
        this.bindInventoryInteractions(el);
        this.bindStockDrag(el);
        this.paintDetailShipCanvas(el);
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
        this.bindShopResize(el);
        // Grow bags to fill main (beside DETAIL) without scrolling; re-renders once.
        if (!this._fittingLock) {
            requestAnimationFrame(() => {
                if (this.isOpen) this.fitBagsToSpace(document.getElementById('vf-in-stage-shop'));
            });
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
