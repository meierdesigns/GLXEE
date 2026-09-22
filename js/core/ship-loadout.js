"use strict";

/**
 * Modular ship layout — hull splits into front / center / back / wings.
 * Modules attach, replace a zone, insert between segments, or expand the hull.
 * Frame upgrades raise per-category slot caps + hull stats.
 */
class ShipLoadoutManager {
    constructor() {
        // Mounts use their native 8x8 component footprint. The renderer crops
        // transparent source margins, so the visible art fills this slot.
        this.moduleSize = 8;
        this.moduleGap = 0;
        /** Visible air gap between hull segments (layout units). */
        this.segmentGap = 0;
        this.wingGap = 0;
        /** Source-sprite UV bands used when segment PNGs are missing. */
        this.segmentUv = {
            front: { x: 0.28, y: 0.02, w: 0.44, h: 0.20 },
            center: { x: 0.32, y: 0.26, w: 0.36, h: 0.48 },
            back: { x: 0.30, y: 0.78, w: 0.40, h: 0.20 },
            wing: { x: 0.02, y: 0.30, w: 0.24, h: 0.40 }
        };
        this.coreSizes = {
            interceptor: { width: 10, height: 8 },
            starfighter: { width: 12, height: 10 },
            assault: { width: 14, height: 12 },
            heavy_fighter: { width: 16, height: 14 }
        };
        /** Base W/D/A/E slot caps by modelClass before frame upgrades. */
        this.baseSlotCaps = {
            interceptor: { weapons: 1, defenses: 1, abilities: 1, energy: 1 },
            starfighter: { weapons: 2, defenses: 1, abilities: 1, energy: 1 },
            assault: { weapons: 2, defenses: 2, abilities: 1, energy: 1 },
            heavy_fighter: { weapons: 3, defenses: 2, abilities: 2, energy: 1 }
        };
        this.maxFrameLevel = 9;
        /** Frame level → which category gains +1 slot (1-indexed rotation). Energy excluded. */
        this.frameSlotRotation = ['weapons', 'defenses', 'abilities'];
        this.heavyWeaponIds = {
            plasma: 1, missile: 1, nova: 1, pierce: 1, burst: 1, ion: 1
        };
    }

    getCoreSize(modelClass, model) {
        if (model) {
            const nw = Math.round(Number(model.nativeWidth) || 0);
            const nh = Math.round(Number(model.nativeHeight) || 0);
            if (nw >= 8 && nh >= 8) {
                return { width: nw, height: nh };
            }
            // Prefer pre-layout core dims if layout already applied
            if (model.layout && model.layout.core) {
                const cw = Math.round(Number(model.layout.core.width) || 0);
                const ch = Math.round(Number(model.layout.core.height) || 0);
                if (cw >= 8 && ch >= 8) {
                    return { width: cw, height: ch };
                }
            }
            if (!model.modular && !model.layout) {
                const w = Math.round(Number(model.width) || 0);
                const h = Math.round(Number(model.height) || 0);
                if (w >= 8 && h >= 8) {
                    return { width: w, height: h };
                }
            }
            if (model.sprite && model.sprite.length && model.sprite[0] && model.sprite[0].length) {
                return {
                    width: Math.max(8, model.sprite[0].length),
                    height: Math.max(8, model.sprite.length)
                };
            }
        }
        const key = String(modelClass || 'starfighter');
        return this.coreSizes[key] || this.coreSizes.starfighter;
    }

    getBaseSlotCaps(modelClass) {
        const key = String(modelClass || 'starfighter');
        const base = this.baseSlotCaps[key] || this.baseSlotCaps.starfighter;
        return {
            weapons: base.weapons,
            defenses: base.defenses,
            abilities: base.abilities,
            energy: base.energy != null ? base.energy : 1
        };
    }

    getFrameLevel(shipId) {
        if (typeof profileManager !== 'undefined' && profileManager.getShipFrameLevel) {
            return profileManager.getShipFrameLevel(shipId);
        }
        return 0;
    }

    /**
     * Slot caps after frame upgrades.
     * Each frame level adds +1 to weapons → defenses → abilities (rotating).
     */
    getSlotCaps(shipId, modelClass) {
        const caps = this.getBaseSlotCaps(modelClass);
        const level = Math.max(0, Math.min(this.maxFrameLevel, this.getFrameLevel(shipId)));
        for (let i = 1; i <= level; i++) {
            const key = this.frameSlotRotation[(i - 1) % this.frameSlotRotation.length];
            caps[key] += 1;
        }
        return caps;
    }

    /** Hull bonuses from frame level: +8 HP and +1 armor per level. */
    getFrameHullBonus(shipId) {
        const level = this.getFrameLevel(shipId);
        return {
            maxHealth: level * 8,
            armor: level * 1
        };
    }

    emptyLoadout() {
        return { weapons: [], defenses: [], abilities: [], energy: [], fireMode: 'auto' };
    }

    normalizeFireMode(mode) {
        const m = String(mode || '').toLowerCase();
        return m === 'charge' ? 'charge' : 'auto';
    }

    normalizeLoadout(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const uniq = (arr) => {
            const out = [];
            const seen = {};
            (Array.isArray(arr) ? arr : []).forEach((id) => {
                const s = String(id || '');
                if (!s || seen[s]) return;
                seen[s] = true;
                out.push(s);
            });
            return out;
        };
        // Weapon slots are positional, not a set — the same weapon id can be
        // installed in more than one slot at once (e.g. twin lasers), so this
        // only drops empty entries and must NOT dedupe like uniq() does.
        const compact = (arr) => (Array.isArray(arr) ? arr : [])
            .map((id) => String(id || ''))
            .filter((s) => !!s);
        const abilities = uniq(src.abilities).filter((id) => !this.isEnergyId(id));
        const energyFromSrc = uniq(src.energy).filter((id) => this.isEnergyId(id));
        const energyFromAbilities = uniq(src.abilities).filter((id) => this.isEnergyId(id));
        const energy = uniq(energyFromSrc.concat(energyFromAbilities));
        return {
            weapons: compact(src.weapons),
            defenses: uniq(src.defenses).filter((id) => !this.isEnergyId(id)),
            abilities: abilities,
            energy: energy,
            moduleOffsets: this.normalizeModuleOffsets(src.moduleOffsets),
            slotAnchors: this.normalizeSlotAnchors(src.slotAnchors),
            moduleScales: this.normalizeModuleScales(src.moduleScales),
            moduleSkins: this.normalizeModuleSkins(src.moduleSkins),
            // Both wings share the same vertical shift and mirror their
            // horizontal distance from the centerline.
            wingOffsetY: Math.max(-0.35, Math.min(0.35, Number(src.wingOffsetY) || 0)),
            wingOffsetX: Math.max(-2, Math.min(2, Number(src.wingOffsetX) || 0)),
            segmentScale: this.normalizeSegmentScale(src.segmentScale),
            segmentOffset: this.normalizeSegmentOffset(src.segmentOffset),
            moduleOffset: this.normalizeModuleOffset(src.moduleOffset),
            fireMode: this.fireModeFromAbilities(abilities, src.fireMode)
        };
    }

    normalizeModuleOffsets(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        ['weapon', 'defense', 'ability', 'energy'].forEach((kind) => {
            out[kind] = {};
            const values = src[kind] && typeof src[kind] === 'object' ? src[kind] : {};
            Object.keys(values).forEach((id) => {
                const value = values[id] && typeof values[id] === 'object' ? values[id] : {};
                out[kind][id] = {
                    x: Math.max(-0.45, Math.min(0.45, Number(value.x) || 0)),
                    y: Math.max(-0.45, Math.min(0.45, Number(value.y) || 0))
                };
            });
        });
        return out;
    }

    /**
     * Custom anchor for an EMPTY hangar slot (no module id to key an offset
     * to). Keyed by kind + slot index, absolute normalized position within
     * the layout bbox — lets the player pre-position a slot before equipping
     * anything, so it doesn't snap back to the generic defaultAnchor().
     */
    normalizeSlotAnchors(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        ['weapon', 'defense', 'ability', 'energy'].forEach((kind) => {
            out[kind] = {};
            const values = src[kind] && typeof src[kind] === 'object' ? src[kind] : {};
            Object.keys(values).forEach((idx) => {
                const value = values[idx] && typeof values[idx] === 'object' ? values[idx] : {};
                const nx = Number(value.nx);
                const ny = Number(value.ny);
                if (!isFinite(nx) || !isFinite(ny)) return;
                out[kind][idx] = {
                    nx: Math.max(0.04, Math.min(0.96, nx)),
                    ny: Math.max(0.06, Math.min(0.94, ny))
                };
            });
        });
        return out;
    }

    /** Store/clear a custom anchor for an empty slot (see normalizeSlotAnchors). */
    setEmptySlotAnchor(shipId, kind, index, nx, ny) {
        const loadout = this.getLoadout(shipId);
        const anchors = this.normalizeSlotAnchors(loadout.slotAnchors);
        anchors[kind] = anchors[kind] || {};
        const idx = String(Math.max(0, Math.round(Number(index) || 0)));
        if (nx == null || ny == null) {
            delete anchors[kind][idx];
        } else {
            anchors[kind][idx] = {
                nx: Math.max(0.04, Math.min(0.96, Number(nx) || 0.5)),
                ny: Math.max(0.06, Math.min(0.94, Number(ny) || 0.5))
            };
        }
        loadout.slotAnchors = anchors;
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    /** Per-slot cosmetic skin choice, independent of the module's own stats. */
    normalizeModuleSkins(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        ['weapon', 'defense', 'ability', 'energy'].forEach((kind) => {
            out[kind] = {};
            const values = src[kind] && typeof src[kind] === 'object' ? src[kind] : {};
            Object.keys(values).forEach((key) => {
                if (values[key]) out[kind][key] = String(values[key]);
            });
        });
        return out;
    }

    /** Skins available for a given module kind, independent of any specific id's stats. */
    getAvailableSkins(kind) {
        const common = [{ id: 'default', label: 'DEFAULT' }];
        if (kind === 'weapon') {
            return common.concat([
                { id: 'hardpoint_twin', label: 'TWIN' },
                { id: 'hardpoint_heavy', label: 'HEAVY' }
            ]);
        }
        return common.concat([
            { id: 'plating_capacitor', label: 'CAPACITOR' }
        ]);
    }

    setModuleSkin(shipId, kind, moduleId, face, skinId) {
        const id = String(moduleId || '');
        const key = this.kindToLoadoutKey(kind);
        if (!id || !key) return { ok: false, reason: 'INVALID' };
        const loadout = this.getLoadout(shipId);
        if (!Array.isArray(loadout[key]) || loadout[key].indexOf(id) === -1) {
            return { ok: false, reason: 'NOT_EQUIPPED' };
        }
        const skins = this.normalizeModuleSkins(loadout.moduleSkins);
        skins[kind] = skins[kind] || {};
        const offsetKey = this.moduleOffsetKey(id, face);
        if (!skinId || skinId === 'default') {
            delete skins[kind][offsetKey];
        } else {
            skins[kind][offsetKey] = String(skinId);
        }
        loadout.moduleSkins = skins;
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    getModuleSkin(shipId, kind, moduleId, face) {
        const loadout = this.getLoadout(shipId);
        const skins = loadout.moduleSkins && loadout.moduleSkins[kind];
        if (!skins) return 'default';
        const offsetKey = this.moduleOffsetKey(moduleId, face);
        return skins[offsetKey] || 'default';
    }

    normalizeModuleScales(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        ['weapon', 'defense', 'ability', 'energy'].forEach((kind) => {
            out[kind] = {};
            const values = src[kind] && typeof src[kind] === 'object' ? src[kind] : {};
            Object.keys(values).forEach((id) => {
                const n = Number(values[id]);
                out[kind][id] = Math.max(0.25, Math.min(6, isFinite(n) && n > 0 ? n : 1));
            });
        });
        return out;
    }

    normalizeSegmentScale(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const read = (id) => {
            const value = src[id] && typeof src[id] === 'object' ? src[id] : {};
            return {
                x: Math.max(0.25, Math.min(6, Number(value.x) || 1)),
                y: Math.max(0.25, Math.min(6, Number(value.y) || 1))
            };
        };
        return {
            front: read('front'),
            center: read('center'),
            back: read('back'),
            wing: read('wing')
        };
    }

    normalizeSegmentOffset(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const read = (id) => {
            const value = src[id] && typeof src[id] === 'object' ? src[id] : {};
            const maxX = id === 'wing' ? 2 : 0.5;
            return {
                x: Math.max(-maxX, Math.min(maxX, Number(value.x) || 0)),
                y: Math.max(-1, Math.min(1, Number(value.y) || 0))
            };
        };
        return {
            front: read('front'),
            center: read('center'),
            back: read('back'),
            wing: read('wing')
        };
    }

    normalizeModuleOffset(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        Object.keys(src).forEach((key) => {
            const value = src[key] && typeof src[key] === 'object' ? src[key] : {};
            out[key] = {
                x: Math.max(-1, Math.min(1, Number(value.x) || 0)),
                y: Math.max(-1, Math.min(1, Number(value.y) || 0))
            };
        });
        return out;
    }

    fireModeFromAbilities(abilities, fallback) {
        const list = Array.isArray(abilities) ? abilities : [];
        if (list.indexOf('charge_shot') !== -1) return 'charge';
        if (fallback === 'charge' && list.indexOf('charge_shot') === -1) return 'auto';
        return this.normalizeFireMode(fallback);
    }

    /**
     * Trim loadout arrays to slot caps (keeps order, drops overflow).
     */
    clampLoadoutToCaps(loadout, shipId, modelClass) {
        const L = this.normalizeLoadout(loadout);
        const caps = this.getSlotCaps(shipId, modelClass);
        L.weapons = L.weapons.slice(0, Math.max(1, caps.weapons));
        L.defenses = L.defenses.slice(0, Math.max(0, caps.defenses));
        L.abilities = L.abilities.slice(0, Math.max(0, caps.abilities));
        L.energy = L.energy.slice(0, Math.max(0, caps.energy != null ? caps.energy : 1));
        if (!L.weapons.length) L.weapons.push('laser');
        return L;
    }

    isEnergyId(id) {
        const s = String(id || '').toLowerCase();
        return s === 'energy_core' || s.indexOf('energy_core') === 0;
    }

    isDefenseId(abilityId) {
        if (this.isEnergyId(abilityId)) return false;
        if (typeof profileManager !== 'undefined' && profileManager.isDefenseAbilityId) {
            return profileManager.isDefenseAbilityId(abilityId);
        }
        const id = String(abilityId || '').toLowerCase();
        return id.indexOf('shield') !== -1 ||
            id.indexOf('armor') !== -1 ||
            id === 'evasion_boost';
    }

    /** Thruster / drive pods — mount on the aft of the hull. */
    isDriveId(id) {
        const s = String(id || '').toLowerCase();
        if (!s) return false;
        if (s.indexOf('drive') !== -1) return true;
        return s === 'high_speed' || s === 'agile_maneuver';
    }

    /** Armor / plating — docks on hull flanks (silhouette). */
    isArmorId(id) {
        const s = String(id || '').toLowerCase();
        if (!s) return false;
        return s.indexOf('armor') !== -1 ||
            s.indexOf('carapace') !== -1 ||
            s === 'massive_armor' ||
            s === 'heavy_armor';
    }

    /** Shield bubbles / generators — sit in the hull center. */
    isShieldId(id) {
        const s = String(id || '').toLowerCase();
        if (!s) return false;
        return s.indexOf('shield') !== -1 || s === 'reflex_shell';
    }

    /** Visual role for renderer accents / glow. */
    getModuleVisualRole(kind, id) {
        const k = String(kind || '');
        if (k === 'weapon') return 'hardpoint';
        if (k === 'energy') return 'core';
        if (k === 'defense') {
            return this.isArmorId(id) ? 'plating' : 'core';
        }
        if (k === 'ability') {
            return this.isDriveId(id) ? 'thruster' : 'pod';
        }
        return 'pod';
    }

    /** Looks up the weapon/ability config entry backing a module id, if any. */
    getModuleConfigEntry(kind, id) {
        const k = String(kind || '');
        if (k === 'weapon' && typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon) {
            return weaponConfigManager.getWeapon(id);
        }
        if ((k === 'ability' || k === 'defense' || k === 'energy')
            && typeof abilityConfigManager !== 'undefined' && abilityConfigManager.getAbility) {
            return abilityConfigManager.getAbility(id);
        }
        return null;
    }

    /**
     * How a module integrates into hull segments.
     * mode: attach | replace | insert | expand
     * zone: front | center | back | wing
     */
    getModuleIntegration(kind, id) {
        const k = String(kind || '');
        const sid = String(id || '').toLowerCase();
        // A module id can declare its own slot footprint (slotMode/slotSize/
        // slotZone on its weapon/ability config entry) instead of relying on
        // the hardcoded id-name whitelists below — this is what lets a new
        // purchasable variant of an existing module type occupy a different
        // hull footprint than the default of its kind.
        const cfg = this.getModuleConfigEntry(k, id);
        if (cfg && cfg.slotMode) {
            const defaultZone = k === 'weapon' ? 'front' : (k === 'ability' ? 'back' : 'center');
            const defaultDir = k === 'weapon' ? 'forward' : (k === 'ability' ? 'aft' : 'side');
            return {
                mode: cfg.slotMode,
                zone: cfg.slotZone || defaultZone,
                expandDir: cfg.slotMode === 'expand' ? defaultDir : undefined,
                expandSize: cfg.slotSize != null ? cfg.slotSize : 2
            };
        }
        if (k === 'weapon') {
            if (this.heavyWeaponIds[sid]) {
                return { mode: 'expand', zone: 'front', expandDir: 'forward', expandSize: 2 };
            }
            return { mode: 'attach', zone: 'front' };
        }
        if (k === 'defense') {
            if (this.isArmorId(sid)) {
                if (sid === 'massive_armor' || sid === 'carapace_armor') {
                    return { mode: 'replace', zone: 'wing', expandSize: 4 };
                }
                return { mode: 'expand', zone: 'wing', expandDir: 'side', expandSize: 3 };
            }
            if (this.isShieldId(sid)) {
                return { mode: 'insert', zone: 'center', expandSize: 2 };
            }
            return { mode: 'attach', zone: 'center' };
        }
        if (k === 'energy') {
            return { mode: 'insert', zone: 'center', expandSize: 2 };
        }
        if (k === 'ability') {
            if (this.isDriveId(sid)) {
                return { mode: 'replace', zone: 'back', expandSize: 3 };
            }
            return { mode: 'expand', zone: 'back', expandDir: 'aft', expandSize: 2 };
        }
        return { mode: 'attach', zone: 'center' };
    }

    /** Sprite key suffix for a segment of a full ship sprite. */
    segmentSpriteKey(shipSpriteKey, segmentId) {
        if (!shipSpriteKey) return null;
        return String(shipSpriteKey) + '-' + String(segmentId);
    }

    resolveModelClass(shipId) {
        if (typeof shipConfigManager !== 'undefined') {
            const cfg = shipConfigManager.getConfig(shipId);
            if (cfg && cfg.modelClass) return cfg.modelClass;
        }
        return 'starfighter';
    }

    defaultLoadoutFromShip(shipId) {
        const cfg = (typeof shipConfigManager !== 'undefined')
            ? shipConfigManager.getConfig(shipId)
            : null;
        const weapons = (cfg && cfg.availableWeapons) ? cfg.availableWeapons.slice() : ['laser'];
        const allAbilities = (cfg && cfg.abilities) ? cfg.abilities.slice() : [];
        const defenses = [];
        const abilities = [];
        const energy = Array.isArray(cfg && cfg.energy) ? cfg.energy.slice() : [];
        allAbilities.forEach((id) => {
            if (this.isEnergyId(id)) energy.push(id);
            else if (this.isDefenseId(id)) defenses.push(id);
            else abilities.push(id);
        });
        if (!energy.length) energy.push('energy_core');
        const modelClass = (cfg && cfg.modelClass) || 'starfighter';
        return this.clampLoadoutToCaps({
            weapons: weapons,
            defenses: defenses,
            abilities: abilities,
            energy: energy,
            fireMode: 'auto'
        }, shipId, modelClass);
    }

    setFireMode(shipId, fireMode) {
        const L = this.getLoadout(shipId);
        const wantCharge = this.normalizeFireMode(fireMode) === 'charge';
        const has = L.abilities.indexOf('charge_shot') !== -1;
        if (wantCharge && !has) {
            const owns = this.ownsChargePart('ability', 'charge_shot');
            if (!owns) return L;
            const check = this.canInstallModule(shipId, 'ability', 'charge_shot');
            if (!check.ok && !check.removing) return L;
            L.abilities.push('charge_shot');
        } else if (!wantCharge && has) {
            L.abilities.splice(L.abilities.indexOf('charge_shot'), 1);
        }
        L.fireMode = L.abilities.indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        return this.setLoadout(shipId, L);
    }

    ownsChargePart(kind, partId) {
        if (typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) return false;
        return profileManager.getPartCount(kind, partId) > 0
            || (kind === 'ability' && (profileManager.getDiscovered('abilities') || []).indexOf(partId) !== -1);
    }

    getFireMode(shipId) {
        const L = this.getLoadout(shipId);
        return (L.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
    }

    getLoadout(shipId) {
        const id = String(shipId || '');
        if (!id) return this.emptyLoadout();
        const modelClass = this.resolveModelClass(id);
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const profile = profileManager.getActiveProfile();
            profileManager.ensureEconomyDefaults(profile);
            if (!profile.shipLoadouts || typeof profile.shipLoadouts !== 'object') {
                profile.shipLoadouts = {};
            }
            if (!profile.shipLoadouts[id]) {
                profile.shipLoadouts[id] = this.defaultLoadoutFromShip(id);
                profileManager.save();
            }
            const L = this.clampLoadoutToCaps(profile.shipLoadouts[id], id, modelClass);
            if (!L.energy || !L.energy.length) {
                L.energy = ['energy_core'];
                profile.shipLoadouts[id] = L;
                profileManager.save();
            }
            return L;
        }
        return this.defaultLoadoutFromShip(id);
    }

    setLoadout(shipId, loadout) {
        const id = String(shipId || '');
        const modelClass = this.resolveModelClass(id);
        const clamped = this.clampLoadoutToCaps(loadout, id, modelClass);
        if (!id || typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) {
            return clamped;
        }
        const profile = profileManager.getActiveProfile();
        profileManager.ensureEconomyDefaults(profile);
        if (!profile.shipLoadouts || typeof profile.shipLoadouts !== 'object') {
            profile.shipLoadouts = {};
        }
        profile.shipLoadouts[id] = clamped;
        profileManager.save();
        return profile.shipLoadouts[id];
    }

    moduleCount(loadout) {
        const L = this.normalizeLoadout(loadout);
        return L.weapons.length + L.defenses.length + L.abilities.length + L.energy.length;
    }

    /**
     * Scaled component footprint in layout units. displayScale/lengthScale from
     * spriteMeta expand the base slot; one source pixel maps to multiple cells.
     */
    resolveComponentDim(id, kind, base, evenSizeFn) {
        const evenSize = evenSizeFn || ((n) => {
            let v = Math.max(2, Math.round(Number(n) || 0));
            if (v % 2) v -= 1;
            return Math.max(2, v);
        });
        const slot = Math.max(2, Number(base) || this.moduleSize);
        let w = slot;
        let h = slot;
        if (typeof spriteMeta !== 'undefined' && spriteMeta.getDisplayScale) {
            const mountKey = this.resolveModuleShipSprite
                ? this.resolveModuleShipSprite({ kind: kind, id: id })
                : ('mount_' + id);
            const scale = spriteMeta.getDisplayScale(mountKey);
            const length = spriteMeta.getLengthScale
                ? spriteMeta.getLengthScale(mountKey)
                : 1;
            w = evenSize(slot * scale);
            h = evenSize(slot * scale * length);
        }
        return { w: Math.max(2, w), h: Math.max(2, h) };
    }

    /**
     * Dock anchor for a module on a segment: keep contact with the hull root
     * while the module frame grows outward/up/down.
     */
    dockModuleOnSegment(segment, dim, face) {
        if (!segment || !dim) {
            return { x: 0, y: 0 };
        }
        const w = dim.w;
        const h = dim.h;
        let x = segment.x + Math.floor((segment.width - w) / 2);
        let y = segment.y + Math.floor((segment.height - h) / 2);
        if (face === 'left') {
            x = segment.x + segment.width - w;
        } else if (face === 'right') {
            x = segment.x;
        } else if (face === 'up') {
            y = segment.y + Math.max(0, segment.height - h);
            x = segment.x + Math.floor((segment.width - w) / 2);
        } else if (face === 'down') {
            y = segment.y;
            x = segment.x + Math.floor((segment.width - w) / 2);
        } else if (face === 'center') {
            // Horizontal centerline only — keep the caller's vertical stack.
            x = segment.x + Math.floor((segment.width - w) / 2);
            y = null;
        }
        return { x: x, y: y };
    }

    /**
     * Place modules relative to segmented hull (front / center / back / wings).
     * Modules may attach, replace a zone, insert into the center stack, or expand.
     */
    buildLayout(coreWidth, coreHeight, loadout) {
        const L = this.normalizeLoadout(loadout);
        const ms = this.moduleSize;
        const gap = this.moduleGap;
        const evenSize = (n) => {
            let v = Math.max(2, Math.round(Number(n) || 0));
            if (v % 2) v -= 1;
            return Math.max(2, v);
        };
        const edgeMs = evenSize(ms);
        const centerMs = evenSize(ms);
        const hullMid = coreWidth / 2;
        const parts = [];
        const uv = this.segmentUv;

        const alignCenter = (center, size) => Math.floor(center - size / 2);

        const moduleScales = this.normalizeModuleScales(L.moduleScales);
        // Place with unscaled footprint; apply moduleScales from center at the end
        // so the slider grows the module in place instead of shoving it sideways.
        const resolveDim = (id, kind, base) => {
            const d = this.resolveComponentDim(id, kind, base, evenSize);
            const s = (moduleScales[kind] && moduleScales[kind][id]) || 1;
            return {
                w: d.w,
                h: d.h,
                scaleW: s === 1 ? d.w : evenSize(d.w * s),
                scaleH: s === 1 ? d.h : evenSize(d.h * s)
            };
        };

        const pushPart = (id, kind, x, y, face, w, h, extra) => {
            const integ = this.getModuleIntegration(kind, id);
            let mountSegment = integ.zone || 'center';
            if (kind === 'weapon') {
                mountSegment = face === 'left' || face === 'right' ? 'wing' : 'front';
            } else if (kind === 'ability') {
                mountSegment = 'back';
            } else if (kind === 'energy') {
                mountSegment = 'center';
            } else if (kind === 'defense') {
                mountSegment = 'center';
            }
            const scaleW = extra && extra.scaleW != null ? extra.scaleW : w;
            const scaleH = extra && extra.scaleH != null ? extra.scaleH : h;
            const rest = extra ? Object.assign({}, extra) : {};
            delete rest.scaleW;
            delete rest.scaleH;
            parts.push(Object.assign({
                id: id,
                kind: kind,
                x: x,
                y: y,
                width: w,
                height: h,
                scaleW: scaleW,
                scaleH: scaleH,
                face: face || 'up',
                role: this.getModuleVisualRole(kind, id),
                integrate: integ.mode,
                zone: integ.zone,
                mountSegment: mountSegment
            }, rest));
        };

        // --- Base segment geometry (layout units inside core) ---
        const segGap = Math.max(0, Number(this.segmentGap) || 0);
        const wingGap = Math.max(0, Number(this.wingGap) || 0);
        const segmentScale = this.normalizeSegmentScale(L.segmentScale);
        const segmentOffset = this.normalizeSegmentOffset(L.segmentOffset);
        const moduleOffset = this.normalizeModuleOffset(L.moduleOffset);
        let frontH = Math.max(2, Math.round(coreHeight * uv.front.h));
        let backH = Math.max(2, Math.round(coreHeight * uv.back.h));
        let centerH = Math.max(2, coreHeight - frontH - backH);
        let wingSpan = 0;
        let wingH = Math.max(2, Math.floor(coreHeight * uv.wing.h));
        // Center fuselage is narrower than nose/aft so parts read as separate blocks
        const centerW = Math.max(4, Math.round(coreWidth * 0.72));
        const frontW = Math.max(4, Math.round(coreWidth * 0.78));
        const backW = Math.max(4, Math.round(coreWidth * 0.82));
        frontH = Math.max(2, Math.round(frontH * segmentScale.front.y));
        centerH = Math.max(2, Math.round(centerH * segmentScale.center.y));
        backH = Math.max(2, Math.round(backH * segmentScale.back.y));
        wingH = Math.max(2, Math.round(wingH * segmentScale.wing.y));
        const scaledFrontW = Math.max(4, Math.round(frontW * segmentScale.front.x));
        const scaledCenterW = Math.max(4, Math.round(centerW * segmentScale.center.x));
        const scaledBackW = Math.max(4, Math.round(backW * segmentScale.back.x));
        const scaledFrontX = Math.floor((coreWidth - scaledFrontW) / 2);
        const scaledCenterX = Math.floor((coreWidth - scaledCenterW) / 2);
        const scaledBackX = Math.floor((coreWidth - scaledBackW) / 2);

        // Collect integration effects before placing attach mounts
        const armorIds = L.defenses.filter((id) => this.isArmorId(id));
        const shieldIds = L.defenses.filter((id) => !this.isArmorId(id));
        const drives = L.abilities.filter((id) => this.isDriveId(id));
        const systemPods = L.abilities.filter((id) => !this.isDriveId(id));

        const zoneReplace = { front: null, center: null, back: null, wing: null };
        const centerInserts = [];
        let expandFront = 0;
        let expandBack = 0;
        let expandWing = 0;

        const applyInteg = (id, kind) => {
            const integ = this.getModuleIntegration(kind, id);
            const size = Math.max(2, Number(integ.expandSize) || edgeMs);
            if (integ.mode === 'replace') {
                zoneReplace[integ.zone] = { id: id, kind: kind };
                if (integ.zone === 'wing') expandWing = Math.max(expandWing, size);
                if (integ.zone === 'back') expandBack = Math.max(expandBack, size);
                if (integ.zone === 'front') expandFront = Math.max(expandFront, size);
            } else if (integ.mode === 'insert' && integ.zone === 'center') {
                centerInserts.push({ id: id, kind: kind, size: size });
            } else if (integ.mode === 'expand') {
                if (integ.zone === 'front' || integ.expandDir === 'forward') {
                    expandFront += size;
                } else if (integ.zone === 'back' || integ.expandDir === 'aft') {
                    expandBack += size;
                } else if (integ.zone === 'wing' || integ.expandDir === 'side') {
                    expandWing = Math.max(expandWing, size);
                }
            }
        };

        L.weapons.forEach((id) => applyInteg(id, 'weapon'));
        armorIds.forEach((id) => applyInteg(id, 'defense'));
        shieldIds.forEach((id) => applyInteg(id, 'defense'));
        L.energy.forEach((id) => applyInteg(id, 'energy'));
        systemPods.forEach((id) => applyInteg(id, 'ability'));
        drives.forEach((id) => applyInteg(id, 'ability'));

        // Grow segments from inserts / expands
        const insertH = centerInserts.reduce((sum, it) => sum + it.size + gap, 0);
        centerH += insertH;
        frontH += expandFront;
        backH += expandBack;

        const weaponsOnSides = L.weapons.length > 1;
        const wingNeed = Math.max(
            weaponsOnSides ? L.weapons.length - 1 : 0,
            zoneReplace.wing ? 1 : 0,
            expandWing > 0 ? 1 : 0
        );
        // Wings are always independent geometry, even when no wing module is
        // installed. This lets the player move both mirrored wings inward.
        wingSpan = Math.max(
            edgeMs + 1,
            expandWing || Math.round(coreWidth * 0.24),
            Math.min(3, Math.max(1, wingNeed)) * edgeMs
        );
        wingSpan = Math.max(2, Math.round(wingSpan * segmentScale.wing.x));

        // Pre-size wing plate from side-mounted modules so left/right stay mirrored
        // and every docked frame stays inside the wing bounds.
        const sideMountIds = [];
        if (L.weapons.length >= 2) {
            L.weapons.slice(L.weapons.length === 2 ? 0 : 1).forEach((id) => {
                sideMountIds.push({ id: id, kind: 'weapon' });
            });
        }
        if (sideMountIds.length) {
            let maxW = edgeMs;
            let leftH = 0;
            let rightH = 0;
            sideMountIds.forEach((item, i) => {
                const d = resolveDim(item.id, item.kind, edgeMs);
                maxW = Math.max(maxW, d.scaleW);
                if (i % 2 === 0) leftH += d.scaleH + (leftH > 0 ? gap : 0);
                else rightH += d.scaleH + (rightH > 0 ? gap : 0);
            });
            wingSpan = Math.max(wingSpan, maxW);
            wingH = Math.max(wingH, leftH, rightH, edgeMs);
        }

        // Absolute Y offsets with visible gaps between front / center / back
        const totalCoreH = frontH + segGap + centerH + segGap + backH;
        const frontY = 0;
        const centerY = frontH + segGap;
        const backY = frontH + segGap + centerH + segGap;
        const wingShiftY = Math.round(centerH * L.wingOffsetY);
        const wingY = Math.max(
            centerY,
            Math.min(
                centerY + Math.max(0, centerH - wingH),
                Math.floor(centerY + (centerH - wingH) / 2 + wingShiftY)
            )
        );
        const wingShiftX = Math.round(coreWidth * L.wingOffsetX);

        const placeRow = (ids, kind, y, centerX, face, size) => {
            if (!ids.length) return;
            const base = size != null ? size : ms;
            const dims = ids.map((id) => resolveDim(id, kind, base));
            const rowW0 = dims.reduce((sum, d) => sum + d.w, 0)
                + Math.max(0, dims.length - 1) * gap;
            let cursor = centerX - rowW0 / 2;
            const maxH = dims.reduce((m, d) => Math.max(m, d.h), base);
            dims.forEach((d, i) => {
                const cx = cursor + d.w / 2;
                // Dock vertically: 'up' sits on the bottom of the band, 'down' on top.
                const cy = face === 'up'
                    ? y + maxH - d.h / 2
                    : (face === 'down' ? y + d.h / 2 : y + maxH / 2);
                pushPart(ids[i], kind, alignCenter(cx, d.w), alignCenter(cy, d.h), face, d.w, d.h, {
                    scaleW: d.scaleW,
                    scaleH: d.scaleH
                });
                cursor += d.w + gap;
            });
        };

        const placeSideColumns = (ids, kind, startY, preferTop, size) => {
            if (!ids.length) return;
            const base = size != null ? size : ms;
            const left = [];
            const right = [];
            ids.forEach((id, i) => {
                (i % 2 === 0 ? left : right).push(id);
            });
            const leftDims = left.map((id) => resolveDim(id, kind, base));
            const rightDims = right.map((id) => resolveDim(id, kind, base));
            const leftH = leftDims.reduce((sum, d) => sum + d.h, 0)
                + Math.max(0, leftDims.length - 1) * gap;
            const rightH = rightDims.reduce((sum, d) => sum + d.h, 0)
                + Math.max(0, rightDims.length - 1) * gap;
            const pairedH = Math.max(leftH, rightH);
            const pairedStartY = preferTop
                ? Math.max(0, Math.min(startY, totalCoreH - pairedH))
                : Math.max(0, Math.min(
                    startY != null ? startY : Math.floor((totalCoreH - pairedH) / 2),
                    totalCoreH - pairedH
                ));
            const placeSide = (sideIds, sideDims, face) => {
                if (!sideIds.length) return;
                const maxW = sideDims.reduce((m, d) => Math.max(m, d.scaleW), base);
                wingSpan = Math.max(wingSpan, maxW);
                wingH = Math.max(wingH, pairedH, sideDims.reduce((m, d) => Math.max(m, d.scaleH), 0));
                const wingX = face === 'left'
                    ? -wingSpan - wingGap - wingShiftX
                    : coreWidth + wingGap + wingShiftX;
                let slotY = pairedStartY;
                if (sideDims.length < 2) {
                    slotY += Math.floor((pairedH - sideDims[0].h) / 2);
                }
                sideIds.forEach((id, i) => {
                    const d = sideDims[i];
                    // Dock at the hull root of the wing plate.
                    const x = face === 'left'
                        ? wingX + wingSpan - d.w
                        : wingX;
                    const y = slotY;
                    pushPart(id, kind, x, y, face, d.w, d.h, {
                        scaleW: d.scaleW,
                        scaleH: d.scaleH
                    });
                    slotY += d.h + gap;
                });
            };
            placeSide(left, leftDims, 'left');
            placeSide(right, rightDims, 'right');
        };

        // Weapons: 1 → front tip; 2 → wings; 3+ → nose + wings
        if (L.weapons.length <= 1) {
            placeRow(
                L.weapons,
                'weapon',
                frontY + Math.max(0, frontH - edgeMs),
                hullMid,
                'up',
                edgeMs
            );
        } else if (L.weapons.length === 2) {
            placeSideColumns(
                L.weapons,
                'weapon',
                Math.floor(wingY + (wingH - edgeMs) / 2),
                false,
                edgeMs
            );
        } else {
            placeRow(
                L.weapons.slice(0, 1),
                'weapon',
                frontY + Math.max(0, frontH - edgeMs),
                hullMid,
                'up',
                edgeMs
            );
            placeSideColumns(
                L.weapons.slice(1),
                'weapon',
                Math.floor(wingY + (wingH - edgeMs) / 2),
                false,
                edgeMs
            );
        }

        // Center inserts (reactor layers etc.) then defense / energy attach stack
        let insertCursor = centerY + Math.floor((centerH - insertH) / 2);
        centerInserts.forEach((it) => {
            const d = resolveDim(it.id, it.kind, Math.min(centerMs, evenSize(coreWidth * 0.7)));
            pushPart(
                it.id,
                it.kind,
                alignCenter(hullMid, d.w),
                alignCenter(insertCursor + it.size / 2, d.h),
                'center',
                d.w,
                d.h,
                { integrate: 'insert', zone: 'center', scaleW: d.scaleW, scaleH: d.scaleH }
            );
            insertCursor += it.size + gap;
        });

        // Defense modules stack on the centerline (horizontal middle of the hull).
        // Armor no longer rides the wings — shields and plating share the core band.
        const attachCenter = [];
        armorIds.forEach((id) => {
            attachCenter.push({ id: id, kind: 'defense' });
        });
        shieldIds.forEach((id) => {
            if (this.getModuleIntegration('defense', id).mode === 'attach') {
                attachCenter.push({ id: id, kind: 'defense' });
            }
        });
        L.energy.forEach((id) => {
            if (this.getModuleIntegration('energy', id).mode === 'attach') {
                attachCenter.push({ id: id, kind: 'energy' });
            }
        });
        if (attachCenter.length) {
            let fitMs = Math.min(centerMs, evenSize(coreWidth));
            const n = attachCenter.length;
            while (fitMs > 4 && (n * fitMs + Math.max(0, n - 1) * gap) > centerH) {
                fitMs = evenSize(fitMs - 2);
            }
            let slotY = centerY + Math.floor((centerH - (n * fitMs + Math.max(0, n - 1) * gap)) / 2);
            attachCenter.forEach((item) => {
                const d = resolveDim(item.id, item.kind, fitMs);
                pushPart(
                    item.id,
                    item.kind,
                    alignCenter(hullMid, d.w),
                    alignCenter(slotY + d.h / 2, d.h),
                    'center',
                    d.w,
                    d.h,
                    { scaleW: d.scaleW, scaleH: d.scaleH }
                );
                slotY += Math.max(fitMs, d.h) + gap;
            });
        }

        // Aft pods / drives
        let aftY = backY + Math.max(0, backH - Math.max(2, Math.floor(edgeMs * 0.35)));
        if (systemPods.length) {
            placeRow(systemPods, 'ability', aftY, hullMid, 'down', edgeMs);
            aftY += edgeMs + gap;
        }
        if (drives.length) {
            placeRow(drives, 'ability', aftY, hullMid, 'down', edgeMs);
        }

        // Build segment list (layout coords before bbox normalize)
        const wingPanels = wingSpan > 0 ? [
            { side: 'left', x: -wingSpan - wingGap - wingShiftX, y: wingY, width: wingSpan, height: wingH },
            { side: 'right', x: coreWidth + wingGap + wingShiftX, y: wingY, width: wingSpan, height: wingH }
        ] : [];

        const segments = [
            {
                id: 'back',
                x: scaledBackX,
                y: backY,
                width: scaledBackW,
                height: backH,
                mirror: false,
                uv: uv.back,
                replace: zoneReplace.back
            },
            {
                id: 'center',
                x: scaledCenterX,
                y: centerY,
                width: scaledCenterW,
                height: centerH,
                mirror: false,
                uv: uv.center,
                replace: zoneReplace.center,
                inserts: centerInserts.slice()
            },
            {
                id: 'front',
                x: scaledFrontX,
                y: frontY,
                width: scaledFrontW,
                height: frontH,
                mirror: false,
                uv: uv.front,
                replace: zoneReplace.front
            },
            ...(wingSpan > 0 ? [
                {
                    id: 'wingLeft',
                    x: -wingSpan - wingGap - wingShiftX,
                    y: wingY,
                    width: wingSpan,
                    height: wingH,
                    mirror: false,
                    uv: uv.wing,
                    replace: zoneReplace.wing
                },
                {
                    id: 'wingRight',
                    x: coreWidth + wingGap + wingShiftX,
                    y: wingY,
                    width: wingSpan,
                    height: wingH,
                    mirror: true,
                    uv: uv.wing,
                    replace: zoneReplace.wing
                }
            ] : [])
        ];

        const moveFor = (id) => {
            const key = id === 'wingLeft' || id === 'wingRight' ? 'wing' : id;
            const off = segmentOffset[key] || { x: 0, y: 0 };
            return {
                x: Math.round(coreWidth * off.x),
                y: Math.round(totalCoreH * off.y)
            };
        };
        segments.forEach((seg) => {
            const off = moveFor(seg.id);
            seg.x += off.x;
            seg.y += off.y;
        });
        parts.forEach((part) => {
            const off = moveFor(part.mountSegment);
            part.x += off.x;
            part.y += off.y;
            const key = String(part.kind || 'module') + ':' + String(part.id || '');
            const modOff = moduleOffset[key] || { x: 0, y: 0 };
            part.x += Math.round(coreWidth * modOff.x);
            part.y += Math.round(totalCoreH * modOff.y);
        });
        // Re-dock modules to their segment roots after segment moves/scales so
        // growing frames stay attached to the hull instead of floating in empty space.
        parts.forEach((part) => {
            const segmentId = part.mountSegment === 'wing'
                ? (part.face === 'left' ? 'wingLeft' : 'wingRight')
                : part.mountSegment;
            const segment = segments.find((seg) => seg.id === segmentId);
            if (!segment) return;
            // Expand segment plate symmetrically to contain the module frame.
            if (part.width > segment.width) {
                const grow = part.width - segment.width;
                segment.x -= Math.floor(grow / 2);
                segment.width = part.width;
            }
            if (part.height > segment.height) {
                const grow = part.height - segment.height;
                segment.y -= Math.floor(grow / 2);
                segment.height = part.height;
            }
            const docked = this.dockModuleOnSegment(
                segment,
                { w: part.width, h: part.height },
                part.face
            );
            part.x = docked.x;
            if (docked.y != null) part.y = docked.y;
            // Defense / center mounts stay on the hull midline.
            if (part.kind === 'defense' || part.face === 'center') {
                part.x = segment.x + Math.floor((segment.width - part.width) / 2);
            }
        });
        // Full-hull bounding box (all segments combined) — a dragged module's
        // travel range is not limited to its own small mount plate, so the
        // player can pull a wing-mounted weapon back onto the front/center
        // hull (or anywhere else) to line it up with the drawn art.
        const hullBBox = segments.reduce((box, seg) => ({
            x: Math.min(box.x, seg.x),
            y: Math.min(box.y, seg.y),
            right: Math.max(box.right, seg.x + seg.width),
            bottom: Math.max(box.bottom, seg.y + seg.height)
        }), { x: 0, y: 0, right: coreWidth, bottom: totalCoreH });

        // Module offsets are local to their owning component, so moving or
        // scaling a component keeps its installed hardware attached to it.
        parts.forEach((part) => {
            const skins = L.moduleSkins && L.moduleSkins[part.kind];
            const skin = skins ? skins[this.moduleOffsetKey(part.id, part.face)] : null;
            if (skin) part.skin = skin;
            const segmentId = part.mountSegment === 'wing'
                ? (part.face === 'left' ? 'wingLeft' : 'wingRight')
                : part.mountSegment;
            const segment = segments.find((seg) => seg.id === segmentId);
            const stored = L.moduleOffsets && L.moduleOffsets[part.kind]
                ? (L.moduleOffsets[part.kind][this.moduleOffsetKey(part.id, part.face)]
                    || L.moduleOffsets[part.kind][part.id])
                : null;
            if (!segment || !stored) {
                if (segment && (part.kind === 'defense' || part.face === 'center')) {
                    part.x = segment.x + Math.floor((segment.width - part.width) / 2);
                }
                return;
            }
            const baseX = segment.x + (segment.width - part.width) / 2;
            const baseY = segment.y + (segment.height - part.height) / 2;
            const minX = hullBBox.x;
            const minY = hullBBox.y;
            const maxX = Math.max(minX, hullBBox.right - part.width);
            const maxY = Math.max(minY, hullBBox.bottom - part.height);
            if (part.kind === 'defense' || part.face === 'center') {
                // Defense stays horizontally centered; only vertical nudge is kept.
                part.x = baseX;
                part.y = Math.max(minY, Math.min(maxY,
                    baseY + Number(stored.y || 0) * segment.height));
            } else {
                part.x = Math.max(minX, Math.min(maxX,
                    baseX + Number(stored.x || 0) * segment.width));
                part.y = Math.max(minY, Math.min(maxY,
                    baseY + Number(stored.y || 0) * segment.height));
            }
        });
        // Apply per-module scale from the placed center so the hangar slider
        // grows in place instead of sliding left/right off the dock root.
        parts.forEach((part) => {
            const sw = part.scaleW != null ? part.scaleW : part.width;
            const sh = part.scaleH != null ? part.scaleH : part.height;
            delete part.scaleW;
            delete part.scaleH;
            if (sw === part.width && sh === part.height) return;
            const oldX = part.x;
            const oldY = part.y;
            const oldRight = part.x + part.width;
            const oldBottom = part.y + part.height;
            const cx = part.x + part.width / 2;
            const cy = part.y + part.height / 2;
            part.width = sw;
            part.height = sh;
            part.x = part.face === 'left'
                ? Math.round(oldRight - sw)
                : (part.face === 'right' ? Math.round(oldX) : Math.round(cx - sw / 2));
            part.y = part.face === 'up'
                ? Math.round(oldBottom - sh)
                : (part.face === 'down' ? Math.round(oldY) : Math.round(cy - sh / 2));
            const segmentId = part.mountSegment === 'wing'
                ? (part.face === 'left' ? 'wingLeft' : 'wingRight')
                : part.mountSegment;
            const segment = segments.find((seg) => seg.id === segmentId);
            if (!segment) return;
            if (part.width > segment.width) {
                const grow = part.width - segment.width;
                segment.x -= Math.floor(grow / 2);
                segment.width = part.width;
            }
            if (part.height > segment.height) {
                const grow = part.height - segment.height;
                segment.y -= Math.floor(grow / 2);
                segment.height = part.height;
            }
            if (part.kind === 'defense' || part.face === 'center') {
                part.x = segment.x + Math.floor((segment.width - part.width) / 2);
            }
        });

        // Keep wingPanels in sync with final wing segment frames.
        const syncedWings = [];
        segments.forEach((seg) => {
            if (seg.id === 'wingLeft') {
                syncedWings.push({
                    side: 'left',
                    x: seg.x,
                    y: seg.y,
                    width: seg.width,
                    height: seg.height
                });
            } else if (seg.id === 'wingRight') {
                syncedWings.push({
                    side: 'right',
                    x: seg.x,
                    y: seg.y,
                    width: seg.width,
                    height: seg.height
                });
            }
        });
        if (syncedWings.length) {
            wingPanels.length = 0;
            syncedWings.forEach((w) => wingPanels.push(w));
        }

        let minX = 0;
        let minY = 0;
        let maxX = coreWidth;
        let maxY = totalCoreH;
        segments.forEach((seg) => {
            minX = Math.min(minX, seg.x);
            minY = Math.min(minY, seg.y);
            maxX = Math.max(maxX, seg.x + seg.width);
            maxY = Math.max(maxY, seg.y + seg.height);
        });
        parts.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + p.width);
            maxY = Math.max(maxY, p.y + p.height);
        });

        const ox = -minX;
        const oy = -minY;
        const modules = parts.map((p) => ({
            id: p.id,
            kind: p.kind,
            role: p.role || this.getModuleVisualRole(p.kind, p.id),
            x: p.x + ox,
            y: p.y + oy,
            width: p.width,
            height: p.height,
            face: p.face || 'up',
            integrate: p.integrate || 'attach',
            zone: p.zone || null,
            moduleOffsetKey: String(p.kind || 'module') + ':' + String(p.id || ''),
            mountSegment: p.mountSegment || null,
            skin: p.skin || null
        }));

        const appearance = {
            weapons: L.weapons.length,
            armor: armorIds.length,
            shields: shieldIds.length,
            energy: L.energy.length,
            pods: systemPods.length,
            thrusters: drives.length,
            wide: true,
            long: expandFront + expandBack + insertH > 0,
            segments: true,
            wingSplit: true,
            segmentGap: segGap,
            wingGap: wingGap
        };

        return {
            width: Math.max(1, Math.round(maxX - minX)),
            height: Math.max(1, Math.round(maxY - minY)),
            core: {
                x: ox,
                y: oy,
                width: coreWidth,
                height: totalCoreH
            },
            segments: segments.map((seg) => ({
                id: seg.id,
                x: seg.x + ox,
                y: seg.y + oy,
                width: seg.width,
                height: seg.height,
                mirror: !!seg.mirror,
                uv: seg.uv,
                replace: seg.replace || null,
                inserts: seg.inserts || null
            })),
            wingPanels: wingPanels.map((wing) => ({
                side: wing.side,
                x: wing.x + ox,
                y: wing.y + oy,
                width: wing.width,
                height: wing.height
            })),
            modules: modules,
            loadout: L,
            moduleCount: this.moduleCount(L),
            appearance: appearance
        };
    }

    resolveModuleIcon(module) {
        if (!module) return null;
        if (module.kind === 'weapon') {
            if (typeof weaponConfigManager !== 'undefined') {
                const w = weaponConfigManager.getWeapon
                    ? weaponConfigManager.getWeapon(module.id)
                    : (weaponConfigManager.getConfig && weaponConfigManager.getConfig(module.id));
                if (w && w.iconKey) return w.iconKey;
            }
            const id = String(module.id || '');
            return 'shot' + id.charAt(0).toUpperCase() + id.slice(1);
        }
        if (module.kind === 'energy') {
            if (typeof abilityConfigManager !== 'undefined') {
                const a = abilityConfigManager.getAbility
                    ? abilityConfigManager.getAbility(module.id)
                    : null;
                if (a && a.icon) return a.icon;
            }
            return 'ability_energy_core';
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const a = abilityConfigManager.getAbility
                ? abilityConfigManager.getAbility(module.id)
                : (abilityConfigManager.getConfig && abilityConfigManager.getConfig(module.id));
            if (a && a.icon) return a.icon;
        }
        return 'ability_' + String(module.id || '');
    }

    /** On-ship hardware graphic key (not the UI icon). */
    resolveModuleShipSprite(module) {
        if (!module) return null;
        if (module.kind === 'weapon') {
            if (typeof weaponConfigManager !== 'undefined') {
                const w = weaponConfigManager.getWeapon
                    ? weaponConfigManager.getWeapon(module.id)
                    : (weaponConfigManager.getConfig && weaponConfigManager.getConfig(module.id));
                if (w && w.mountSprite) return w.mountSprite;
            }
            return 'mount_' + String(module.id || 'weapon');
        }
        if (module.kind === 'energy') {
            if (typeof abilityConfigManager !== 'undefined') {
                const a = abilityConfigManager.getAbility
                    ? abilityConfigManager.getAbility(module.id)
                    : null;
                if (a && a.mountSprite) return a.mountSprite;
            }
            return 'mount_energy_core';
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const a = abilityConfigManager.getAbility
                ? abilityConfigManager.getAbility(module.id)
                : (abilityConfigManager.getConfig && abilityConfigManager.getConfig(module.id));
            if (a && a.mountSprite) return a.mountSprite;
        }
        if (module.kind === 'defense') return 'mount_' + String(module.id || 'defense');
        return 'mount_' + String(module.id || 'ability');
    }

    getModuleShipSprite(module) {
        const key = this.resolveModuleShipSprite(module);
        if (!key || typeof ModuleSprites === 'undefined' || !ModuleSprites) return null;
        if (ModuleSprites[key]) return ModuleSprites[key];
        const role = module.role || this.getModuleVisualRole(module.kind, module.id);
        const fallback = role === 'hardpoint' || module.kind === 'weapon' ? 'mount_hardpoint'
            : (role === 'plating' ? 'mount_plating'
                : (module.kind === 'energy' || role === 'core' ? 'mount_energy_core'
                    : (role === 'thruster' ? 'mount_thruster'
                        : (role === 'pod' ? 'mount_pod' : 'mount_ability'))));
        return ModuleSprites[fallback] || ModuleSprites.mount_ability || null;
    }

    applyLayoutToModel(model, shipId) {
        if (!model) return model;
        const id = shipId || model.id;
        const coreSize = this.getCoreSize(model.modelClass, model);
        const loadout = this.getLoadout(id);
        const layout = this.buildLayout(coreSize.width, coreSize.height, loadout);
        const caps = this.getSlotCaps(id, model.modelClass);
        const hullBonus = this.getFrameHullBonus(id);

        model.coreWidth = coreSize.width;
        model.coreHeight = coreSize.height;
        model.nativeWidth = coreSize.width;
        model.nativeHeight = coreSize.height;
        model.modular = true;
        model.layout = layout;
        model.width = layout.width;
        model.height = layout.height;
        model.loadout = layout.loadout;
        model.moduleCount = layout.moduleCount;
        model.appearance = layout.appearance || null;
        model.slotCaps = caps;
        model.frameLevel = this.getFrameLevel(id);
        model.fireMode = (layout.loadout.abilities || []).indexOf('charge_shot') !== -1
            ? 'charge'
            : 'auto';
        layout.loadout.fireMode = model.fireMode;

        if (hullBonus.maxHealth) {
            model.maxHealth = (Number(model.maxHealth) || 0) + hullBonus.maxHealth;
        }
        if (hullBonus.armor) {
            model.armor = (Number(model.armor) || 0) + hullBonus.armor;
        }

        model.availableWeapons = layout.loadout.weapons.length
            ? layout.loadout.weapons.slice()
            : ['laser'];
        model.defaultWeapon = layout.loadout.weapons[0] || model.defaultWeapon || 'laser';
        model.abilities = layout.loadout.abilities.concat(layout.loadout.defenses);
        model.specialAbilities = model.abilities.map((a) =>
            String(a).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        );
        model.weapons = model.availableWeapons.map((w) =>
            String(w).replace(/\b\w/g, (c) => c.toUpperCase())
        );

        const defStats = this.computeDefenseStats(model.abilities);
        model.shieldMax = defStats.shieldMax;
        model.shieldRegen = defStats.shieldRegen;
        model.damageReduction = defStats.damageReduction;
        model.reflectChance = defStats.reflectChance;
        model.defenseMechanisms = defStats.mechs.slice();

        const chargeStats = this.computeChargeStats(model.abilities);
        model.chargeStats = chargeStats;

        const energyStats = this.computeEnergyStats(layout.loadout);
        model.maxEnergy = energyStats.maxEnergy;
        model.energyRegen = energyStats.regen;
        model.energyIdleDraw = energyStats.idleDraw;
        model.energyDrainMul = energyStats.drainMul;
        model.hasEnergyCore = energyStats.hasCore;
        model.energyStats = energyStats;
        model.shotEnergyCost = energyStats.shotCost;
        model.chargeEnergyPerSec = energyStats.chargePerSec;
        model.shieldAbsorbEnergyPerDmg = energyStats.shieldAbsorbPerDmg;
        model.boostEnergyPerSec = energyStats.boostPerSec;
        model.boostSpeedMul = energyStats.boostSpeedMul;

        return model;
    }

    /**
     * Shield / armor / reflect values from equipped defense modules.
     * Shared by hangar preview and in-game player.
     */
    computeDefenseStats(ids) {
        const list = Array.isArray(ids) ? ids : [];
        let shieldMax = 0;
        let shieldRegen = 0;
        let damageReduction = 0;
        let reflectChance = 0;
        const mechs = [];
        list.forEach((raw) => {
            const s = String(raw || '');
            if (!s) return;
            mechs.push(s);
            if (s.indexOf('shield') !== -1) {
                shieldMax += s.indexOf('adaptive') !== -1 ? 18
                    : (s.indexOf('generator') !== -1 ? 22 : 12);
                if (s.indexOf('regen') !== -1) shieldRegen += 4;
            }
            if (s.indexOf('massive_armor') !== -1) {
                damageReduction = Math.max(damageReduction, 15);
            } else if (s.indexOf('heavy_armor') !== -1) {
                damageReduction = Math.max(damageReduction, 10);
            }
        });
        if (mechs.indexOf('energy_shield') !== -1 || mechs.indexOf('adaptive_shield') !== -1) {
            reflectChance = Math.max(reflectChance, 20);
        }
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            const b = profileManager.getModuleUpgradeBonuses();
            shieldMax = Math.round(shieldMax * (b.defenseCapacityMul || 1));
            shieldRegen *= (b.defenseRegenMul || 1);
            damageReduction = Math.min(80, damageReduction + Math.round((b.defenseHarden || 0) * 100));
        }
        return { shieldMax, shieldRegen, damageReduction, reflectChance, mechs };
    }

    /**
     * Idle draw for a single module id/kind.
     */
    getModuleIdleDraw(kind, id) {
        const s = String(id || '').toLowerCase();
        if (kind === 'weapon') {
            return this.heavyWeaponIds[s] ? 0.6 : 0.4;
        }
        if (kind === 'defense') {
            if (s.indexOf('shield') !== -1) return 0.8;
            return 0.2;
        }
        if (kind === 'ability') {
            if (s === 'charge_drive') return 0.2;
            return 0.3;
        }
        if (kind === 'energy') return 0;
        return 0;
    }

    getWeaponShotCost(weaponId) {
        const s = String(weaponId || 'laser').toLowerCase();
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon) {
            const weapon = weaponConfigManager.getWeapon(s);
            if (weapon && weapon.energyCost != null) {
                return Math.max(0, Number(weapon.energyCost) || 0);
            }
        }
        return this.heavyWeaponIds[s] ? 6 : 4;
    }

    /**
     * Energy pool + drain multipliers from loadout + upgrades.
     */
    computeEnergyStats(loadout) {
        const L = this.normalizeLoadout(loadout);
        const hasCore = (L.energy || []).some((id) => this.isEnergyId(id));
        let drainMul = 1;
        let capBonus = 0;
        let regenBonus = 0;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            const b = profileManager.getModuleUpgradeBonuses();
            drainMul = Math.max(0.4, Number(b.energyDrainMul) || 1);
            capBonus = Math.max(0, Number(b.energyCapacityBonus) || 0);
            regenBonus = Math.max(0, Number(b.energyRegenBonus) || 0);
        }

        if (!hasCore) {
            return {
                hasCore: false,
                maxEnergy: 0,
                regen: 0,
                idleDraw: 0,
                drainMul: drainMul,
                shotCost: 0,
                chargePerSec: 0,
                shieldAbsorbPerDmg: 0,
                boostPerSec: 0,
                boostSpeedMul: 1
            };
        }

        const budget = this.computePowerBudget(L);
        const primaryWeapon = (L.weapons && L.weapons[0]) || 'laser';
        const hasDrive = (L.abilities || []).indexOf('charge_drive') !== -1;
        const hasDampen = (L.abilities || []).indexOf('drive_charge_dampen') !== -1;
        let boostPerSec = hasDrive ? 22 : 0;
        if (hasDrive && hasDampen) boostPerSec *= 0.7;

        return {
            hasCore: true,
            maxEnergy: 100 + capBonus,
            regen: 12 + regenBonus,
            idleDraw: budget.idleDraw,
            drainMul: drainMul,
            shotCost: this.getWeaponShotCost(primaryWeapon) * drainMul,
            chargePerSec: 12 * drainMul,
            shieldAbsorbPerDmg: 0.5 * drainMul,
            boostPerSec: boostPerSec * drainMul,
            boostSpeedMul: hasDrive ? 1.55 : 1
        };
    }

    /**
     * Hangar power budget: GEN vs IDLE DRAW.
     */
    computePowerBudget(loadout) {
        const L = this.normalizeLoadout(loadout);
        const energyStatsBase = (() => {
            const hasCore = (L.energy || []).some((id) => this.isEnergyId(id));
            let regenBonus = 0;
            if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
                regenBonus = Math.max(0, Number(profileManager.getModuleUpgradeBonuses().energyRegenBonus) || 0);
            }
            return {
                hasCore: hasCore,
                gen: hasCore ? (12 + regenBonus) : 0
            };
        })();
        const perModule = [];
        let idleDraw = 0;
        const add = (kind, id) => {
            const idle = this.getModuleIdleDraw(kind, id);
            if (idle <= 0 && kind === 'energy') return;
            perModule.push({ id: id, kind: kind, idle: idle });
            idleDraw += idle;
        };
        (L.weapons || []).forEach((id) => add('weapon', id));
        (L.defenses || []).forEach((id) => add('defense', id));
        (L.abilities || []).forEach((id) => add('ability', id));
        let drainMul = 1;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            drainMul = Math.max(0.4, Number(profileManager.getModuleUpgradeBonuses().energyDrainMul) || 1);
        }
        idleDraw *= drainMul;
        perModule.forEach((m) => { m.idle = Math.round(m.idle * drainMul * 100) / 100; });
        const gen = energyStatsBase.gen;
        return {
            gen: gen,
            idleDraw: Math.round(idleDraw * 100) / 100,
            net: Math.round((gen - idleDraw) * 100) / 100,
            perModule: perModule,
            hasCore: energyStatsBase.hasCore
        };
    }

    /**
     * Charge-module combat stats from equipped ability/defense ids.
     */
    computeChargeStats(ids) {
        const list = Array.isArray(ids) ? ids : [];
        const has = (id) => list.indexOf(id) !== -1;
        const weaponCharge = has('charge_shot');
        const overcharge = has('overcharge_core');
        const shieldSync = has('charge_shield_sync');
        const shieldDivert = has('shield_divert');
        const driveCharge = has('charge_drive');
        const driveDampen = has('drive_charge_dampen');

        let focus = 0;
        let output = 0;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            const b = profileManager.getModuleUpgradeBonuses();
            focus = Math.max(0, Number(b.chargeFocus) || 0);
            output = Math.max(0, Number(b.chargeOutput) || 0);
        }

        let maxChargeMs = overcharge && weaponCharge ? 700 : 900;
        maxChargeMs = Math.max(500, Math.round(maxChargeMs * (1 - focus * 0.12)));

        let maxChargeMult = overcharge && weaponCharge ? 3.5 : 2.75;
        maxChargeMult += output * 0.18;
        let divertShotBonus = shieldDivert ? 0.55 : 0;
        divertShotBonus += shieldDivert ? output * 0.12 : 0;
        let shieldFillPerSec = shieldSync ? 18 : 0;
        shieldFillPerSec *= (1 + output * 0.2);

        // Hold-Shift boost (no charge/burst/slowdown)
        let driveBoostMul = driveCharge ? 1.55 : 1;
        driveBoostMul += driveCharge ? output * 0.05 : 0;
        let driveBoostDrainPerSec = driveCharge ? 22 : 0;
        if (driveCharge && driveDampen) driveBoostDrainPerSec *= 0.7;

        return {
            weaponCharge: weaponCharge,
            overcharge: overcharge && weaponCharge,
            shieldSync: shieldSync && !shieldDivert,
            shieldDivert: shieldDivert && !shieldSync,
            driveCharge: driveCharge,
            driveDampen: driveDampen && driveCharge,
            maxChargeMs: maxChargeMs,
            minChargeMult: 1,
            maxChargeMult: maxChargeMult,
            divertShotBonus: divertShotBonus,
            shieldFillPerSec: shieldFillPerSec,
            driveBoostMul: driveBoostMul,
            driveBoostDrainPerSec: driveBoostDrainPerSec,
            driveSlowMul: 1,
            driveFullSlowMul: 1,
            driveBurstMul: 1,
            driveBurstMs: 0
        };
    }

    /**
     * Inventory pools for hangar equip UI.
     */
    getInventory(shipId) {
        const defaults = this.defaultLoadoutFromShip(shipId);
        const owned = {
            weapons: defaults.weapons.slice(),
            defenses: defaults.defenses.slice(),
            abilities: defaults.abilities.filter((id) => !this.isEnergyId(id)),
            energy: defaults.energy.slice()
        };
        const add = (arr, id) => {
            if (id && arr.indexOf(id) === -1) arr.push(id);
        };
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const profile = profileManager.getActiveProfile();
            profileManager.ensureEconomyDefaults(profile);
            profileManager.getDiscovered('weapons').forEach((id) => add(owned.weapons, id));
            profileManager.getDiscovered('defenses').forEach((id) => add(owned.defenses, id));
            profileManager.getDiscovered('abilities').forEach((id) => {
                if (this.isEnergyId(id)) add(owned.energy, id);
                else if (this.isDefenseId(id)) add(owned.defenses, id);
                else add(owned.abilities, id);
            });
            profileManager.getDiscovered('energy').forEach((id) => add(owned.energy, id));
            Object.keys((profile.parts && profile.parts.weapons) || {}).forEach((id) => {
                if ((profile.parts.weapons[id] || 0) > 0) add(owned.weapons, id);
            });
            Object.keys((profile.parts && profile.parts.defenses) || {}).forEach((id) => {
                if ((profile.parts.defenses[id] || 0) > 0) add(owned.defenses, id);
            });
            Object.keys((profile.parts && profile.parts.abilities) || {}).forEach((id) => {
                if ((profile.parts.abilities[id] || 0) > 0) {
                    if (this.isEnergyId(id)) add(owned.energy, id);
                    else if (this.isDefenseId(id)) add(owned.defenses, id);
                    else add(owned.abilities, id);
                }
            });
            Object.keys((profile.parts && profile.parts.energy) || {}).forEach((id) => {
                if ((profile.parts.energy[id] || 0) > 0) add(owned.energy, id);
            });
            const current = this.getLoadout(shipId);
            current.weapons.forEach((id) => add(owned.weapons, id));
            current.defenses.forEach((id) => add(owned.defenses, id));
            current.abilities.forEach((id) => add(owned.abilities, id));
            (current.energy || []).forEach((id) => add(owned.energy, id));
        }
        add(owned.energy, 'energy_core');
        return owned;
    }

    canInstallModule(shipId, kind, moduleId) {
        const L = this.getLoadout(shipId);
        const key = kind === 'weapon' ? 'weapons'
            : kind === 'defense' ? 'defenses'
                : kind === 'energy' ? 'energy'
                    : 'abilities';
        const id = String(moduleId || '');
        if (!id) return { ok: false, reason: 'INVALID' };
        if (L[key].indexOf(id) !== -1) return { ok: true, removing: true };
        if (id === 'overcharge_core' && L.abilities.indexOf('charge_shot') === -1) {
            return { ok: false, reason: 'NEED_CHARGE_SHOT' };
        }
        if (id === 'drive_charge_dampen' && L.abilities.indexOf('charge_drive') === -1) {
            return { ok: false, reason: 'NEED_CHARGE_DRIVE' };
        }
        const caps = this.getSlotCaps(shipId, this.resolveModelClass(shipId));
        if (L[key].length >= caps[key]) {
            return { ok: false, reason: 'FULL', caps: caps };
        }
        return { ok: true, removing: false, caps: caps };
    }

    toggleModule(shipId, kind, moduleId) {
        const L = this.getLoadout(shipId);
        const key = kind === 'weapon' ? 'weapons'
            : kind === 'defense' ? 'defenses'
                : kind === 'energy' ? 'energy'
                    : 'abilities';
        const id = String(moduleId || '');
        if (!id) return L;
        const idx = L[key].indexOf(id);
        if (idx === -1) {
            const check = this.canInstallModule(shipId, kind, id);
            if (!check.ok) return L;
            L[key].push(id);
            if (id === 'charge_shield_sync') {
                const di = L.defenses.indexOf('shield_divert');
                if (di !== -1) L.defenses.splice(di, 1);
            } else if (id === 'shield_divert') {
                const si = L.defenses.indexOf('charge_shield_sync');
                if (si !== -1) L.defenses.splice(si, 1);
            }
        } else {
            L[key].splice(idx, 1);
            if (id === 'charge_shot') {
                const oi = L.abilities.indexOf('overcharge_core');
                if (oi !== -1) L.abilities.splice(oi, 1);
            }
            if (id === 'charge_drive') {
                const di = L.abilities.indexOf('drive_charge_dampen');
                if (di !== -1) L.abilities.splice(di, 1);
            }
        }
        if (key === 'weapons' && !L.weapons.length) {
            L.weapons.push(id);
        }
        L.fireMode = L.abilities.indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        return this.setLoadout(shipId, L);
    }

    kindToLoadoutKey(kind) {
        if (kind === 'weapon') return 'weapons';
        if (kind === 'defense') return 'defenses';
        if (kind === 'energy') return 'energy';
        return 'abilities';
    }

    categoryLabel(kind) {
        if (kind === 'weapon') return 'WEAPON';
        if (kind === 'defense') return 'DEFENSE';
        if (kind === 'energy') return 'ENERGY';
        return 'ABILITY';
    }

    /**
     * Set or clear a specific hangar slot index. Passing empty/null clears it.
     * Weapons cannot be fully emptied (falls back to laser).
     */
    setSlotModule(shipId, kind, slotIndex, moduleId) {
        const key = this.kindToLoadoutKey(kind);
        const L = this.getLoadout(shipId);
        const caps = this.getSlotCaps(shipId, this.resolveModelClass(shipId));
        const cap = Math.max(0, Number(caps[key]) || 0);
        const idx = Math.max(0, Math.min(cap - 1, Math.round(Number(slotIndex) || 0)));
        if (cap <= 0 || idx < 0) return { ok: false, reason: 'NO_SLOT', loadout: L };

        const nextId = moduleId == null || moduleId === '' || moduleId === 'empty'
            ? null
            : String(moduleId);
        const list = (L[key] || []).slice();

        while (list.length < cap) list.push(null);
        const current = list[idx] || null;

        if (!nextId) {
            if (key === 'weapons' && list.filter(Boolean).length <= 1 && current) {
                return { ok: false, reason: 'NEED_WEAPON', loadout: L };
            }
            list[idx] = null;
            if (current === 'charge_shot') {
                const oi = list.indexOf('overcharge_core');
                if (oi !== -1) list[oi] = null;
            }
            if (current === 'charge_drive') {
                const di = list.indexOf('drive_charge_dampen');
                if (di !== -1) list[di] = null;
            }
        } else {
            // Slot replace: reuse canInstallModule for incompatibles.
            // FULL is allowed because we overwrite a specific index.
            if (current !== nextId) {
                const check = this.canInstallModule(shipId, kind, nextId);
                if (!check.ok && !check.removing && check.reason !== 'FULL') {
                    return { ok: false, reason: check.reason || 'BLOCKED', loadout: L };
                }
            }
            // Move/replace: remove duplicates elsewhere in this category
            for (let i = 0; i < list.length; i++) {
                if (i !== idx && list[i] === nextId) list[i] = null;
            }
            list[idx] = nextId;
            if (key === 'defenses') {
                if (nextId === 'charge_shield_sync') {
                    for (let i = 0; i < list.length; i++) {
                        if (i !== idx && list[i] === 'shield_divert') list[i] = null;
                    }
                } else if (nextId === 'shield_divert') {
                    for (let i = 0; i < list.length; i++) {
                        if (i !== idx && list[i] === 'charge_shield_sync') list[i] = null;
                    }
                }
            }
        }

        L[key] = list.filter(Boolean);
        if (key === 'weapons' && !L.weapons.length) {
            L.weapons.push('laser');
        }
        L.fireMode = (L.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        const saved = this.setLoadout(shipId, L);
        return { ok: true, loadout: saved };
    }

    setWingOffset(shipId, offsetX, offsetY) {
        const loadout = this.getLoadout(shipId);
        loadout.wingOffsetX = Math.max(-2, Math.min(2, Number(offsetX) || 0));
        loadout.wingOffsetY = Math.max(-0.35, Math.min(0.35, Number(offsetY) || 0));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    setSegmentScale(shipId, segmentId, scaleX, scaleY) {
        const id = segmentId === 'wingLeft' || segmentId === 'wingRight'
            ? 'wing'
            : String(segmentId || 'center');
        const loadout = this.getLoadout(shipId);
        const scales = this.normalizeSegmentScale(loadout.segmentScale);
        scales[id] = {
            x: Math.max(0.25, Math.min(6, Number(scaleX) || 1)),
            y: Math.max(0.25, Math.min(6, Number(scaleY) || 1))
        };
        loadout.segmentScale = scales;
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    setSegmentOffset(shipId, segmentId, offsetX, offsetY) {
        const id = segmentId === 'wingLeft' || segmentId === 'wingRight'
            ? 'wing'
            : String(segmentId || 'center');
        const loadout = this.getLoadout(shipId);
        const offsets = this.normalizeSegmentOffset(loadout.segmentOffset);
        offsets[id] = {
            x: id !== 'wing'
                ? 0
                : Math.max(-2, Math.min(2, Number(offsetX) || 0)),
            y: Math.max(-1, Math.min(1, Number(offsetY) || 0))
        };
        loadout.segmentOffset = offsets;
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    /**
     * Two equipped modules of the same kind can share the same id (e.g. the
     * same weapon installed in both weapon slots) — mount position must be
     * per-slot, not per-id, or dragging one moves both. `face` (up/left/
     * right/down, already assigned per module by buildLayout) disambiguates
     * the common cases; modules sharing both id and face fall back to a
     * single shared offset, same as before this fix.
     */
    moduleOffsetKey(id, face) {
        return String(id || '') + '@' + String(face || 'up');
    }

    setModuleOffset(shipId, kind, moduleId, offsetX, offsetY, face) {
        const id = String(moduleId || '');
        const key = this.kindToLoadoutKey(kind);
        if (!id || !key) return { ok: false, reason: 'INVALID' };
        const loadout = this.getLoadout(shipId);
        if (!Array.isArray(loadout[key]) || loadout[key].indexOf(id) === -1) {
            return { ok: false, reason: 'NOT_EQUIPPED' };
        }
        const offsets = this.normalizeModuleOffsets(loadout.moduleOffsets);
        offsets[kind] = offsets[kind] || {};
        offsets[kind][this.moduleOffsetKey(id, face)] = {
            x: Math.max(-0.45, Math.min(0.45, Number(offsetX) || 0)),
            y: Math.max(-0.45, Math.min(0.45, Number(offsetY) || 0))
        };
        loadout.moduleOffsets = offsets;
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    getModuleScale(shipId, kind, moduleId) {
        const id = String(moduleId || '');
        if (!id) return 1;
        const loadout = this.getLoadout(shipId);
        const scales = this.normalizeModuleScales(loadout.moduleScales);
        const n = scales[kind] && scales[kind][id];
        return n != null ? n : 1;
    }

    setModuleScale(shipId, kind, moduleId, scale) {
        const id = String(moduleId || '');
        const key = this.kindToLoadoutKey(kind);
        if (!id || !key) return { ok: false, reason: 'INVALID' };
        const loadout = this.getLoadout(shipId);
        if (!Array.isArray(loadout[key]) || loadout[key].indexOf(id) === -1) {
            return { ok: false, reason: 'NOT_EQUIPPED' };
        }
        const scales = this.normalizeModuleScales(loadout.moduleScales);
        scales[kind] = scales[kind] || {};
        scales[kind][id] = Math.max(0.25, Math.min(6, Number(scale) || 1));
        loadout.moduleScales = scales;
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    }

    /**
     * Slot anchors for hangar bay UI: one entry per available frame slot.
     * Positions are normalized 0..1 relative to the modular layout bbox.
     */
    buildHangarSlots(shipId, modelClass, model) {
        const cls = modelClass || this.resolveModelClass(shipId);
        const loadout = this.getLoadout(shipId);
        const caps = this.getSlotCaps(shipId, cls);
        const core = this.getCoreSize(cls, model || null);
        const layout = this.buildLayout(core.width, core.height, loadout);
        const lw = Math.max(1, layout.width || 1);
        const lh = Math.max(1, layout.height || 1);
        const coreBox = layout.core || { x: 0, y: 0, width: core.width, height: core.height };

        const modulesByKind = {
            weapon: [],
            defense: [],
            ability: [],
            energy: []
        };
        (layout.modules || []).forEach((m) => {
            if (m && modulesByKind[m.kind]) modulesByKind[m.kind].push(m);
        });

        const defaultAnchor = (kind, index, cap) => {
            const t = cap <= 1 ? 0.5 : (index + 0.5) / cap;
            if (kind === 'weapon') {
                return {
                    nx: 0.2 + t * 0.6,
                    ny: Math.max(0.08, (coreBox.y - 4) / lh),
                    side: index % 2 === 0 ? 'left' : 'right'
                };
            }
            if (kind === 'defense') {
                return {
                    nx: index % 2 === 0 ? 0.12 : 0.88,
                    ny: 0.35 + (Math.floor(index / 2) * 0.18),
                    side: index % 2 === 0 ? 'left' : 'right'
                };
            }
            if (kind === 'energy') {
                return {
                    nx: 0.5,
                    ny: (coreBox.y + coreBox.height * 0.45) / lh,
                    side: 'right'
                };
            }
            return {
                nx: 0.25 + t * 0.5,
                ny: Math.min(0.92, (coreBox.y + coreBox.height + 6) / lh),
                side: index % 2 === 0 ? 'left' : 'right'
            };
        };

        const slots = [];
        const pushCategory = (kind, key) => {
            const cap = Math.max(0, Number(caps[key]) || 0);
            const equipped = loadout[key] || [];
            const placed = modulesByKind[kind] || [];
            for (let i = 0; i < cap; i++) {
                const id = equipped[i] || null;
                let mod = null;
                if (id) {
                    const matchIdx = placed.findIndex((m) => m && m.id === id);
                    if (matchIdx !== -1) {
                        mod = placed[matchIdx];
                        placed.splice(matchIdx, 1);
                    }
                }
                let nx;
                let ny;
                let side;
                if (mod) {
                    nx = (mod.x + (mod.width || 0) * 0.5) / lw;
                    ny = (mod.y + (mod.height || 0) * 0.5) / lh;
                    // Prefer even left/right split so hangar rails fill both sides
                    if (kind === 'weapon') side = (i % 2 === 0) ? 'left' : 'right';
                    else if (kind === 'defense') side = (i % 2 === 0) ? 'left' : 'right';
                    else if (kind === 'energy') side = 'right';
                    else side = (i % 2 === 0) ? 'left' : 'right';
                    // Keep pin-side bias if clearly off-center
                    if (nx < 0.32) side = 'left';
                    else if (nx > 0.68) side = 'right';
                } else {
                    const customAnchor = loadout.slotAnchors
                        && loadout.slotAnchors[kind]
                        && loadout.slotAnchors[kind][String(i)];
                    const a = defaultAnchor(kind, i, cap);
                    nx = customAnchor ? customAnchor.nx : a.nx;
                    ny = customAnchor ? customAnchor.ny : a.ny;
                    side = a.side;
                    if (customAnchor) {
                        if (nx < 0.32) side = 'left';
                        else if (nx > 0.68) side = 'right';
                    }
                }
                slots.push({
                    kind: kind,
                    key: key,
                    index: i,
                    id: id,
                    face: mod ? mod.face : null,
                    label: this.categoryLabel(kind) + ' ' + (i + 1),
                    nx: Math.max(0.04, Math.min(0.96, nx)),
                    ny: Math.max(0.06, Math.min(0.94, ny)),
                    side: side,
                    empty: !id
                });
            }
        };

        pushCategory('weapon', 'weapons');
        pushCategory('defense', 'defenses');
        pushCategory('ability', 'abilities');
        pushCategory('energy', 'energy');

        return {
            layout: layout,
            caps: caps,
            loadout: loadout,
            slots: slots,
            width: layout.width,
            height: layout.height
        };
    }
}

const shipLoadoutManager = new ShipLoadoutManager();
window.shipLoadoutManager = shipLoadoutManager;
