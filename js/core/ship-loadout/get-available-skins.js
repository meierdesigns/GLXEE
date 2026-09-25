"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
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
    },

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
    },

    getModuleSkin(shipId, kind, moduleId, face) {
        const loadout = this.getLoadout(shipId);
        const skins = loadout.moduleSkins && loadout.moduleSkins[kind];
        if (!skins) return 'default';
        const offsetKey = this.moduleOffsetKey(moduleId, face);
        return skins[offsetKey] || 'default';
    },

    setSlotSkin(shipId, kind, slotIndex, skinId) {
        const loadout = this.getLoadout(shipId);
        const skins = this.normalizeSlotSkins(loadout.slotSkins);
        skins[kind] = skins[kind] || {};
        const key = String(Math.max(0, Number(slotIndex) || 0));
        if (!skinId || skinId === 'default') delete skins[kind][key];
        else skins[kind][key] = String(skinId);
        loadout.slotSkins = skins;
        return { ok: true, loadout: this.setLoadout(shipId, loadout) };
    },

    getSlotSkin(shipId, kind, slotIndex) {
        const loadout = this.getLoadout(shipId);
        const skins = loadout.slotSkins && loadout.slotSkins[kind];
        return (skins && skins[String(slotIndex)]) || 'default';
    },

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
    },

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
    },

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
    },

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
    },

    fireModeFromAbilities(abilities, fallback) {
        const list = Array.isArray(abilities) ? abilities : [];
        if (list.indexOf('charge_shot') !== -1) return 'charge';
        if (fallback === 'charge' && list.indexOf('charge_shot') === -1) return 'auto';
        return this.normalizeFireMode(fallback);
    },

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
    },

    isEnergyId(id) {
        const s = String(id || '').toLowerCase();
        return s === 'energy_core' || s.indexOf('energy_core') === 0;
    },

    isDefenseId(abilityId) {
        if (this.isEnergyId(abilityId)) return false;
        if (typeof profileManager !== 'undefined' && profileManager.isDefenseAbilityId) {
            return profileManager.isDefenseAbilityId(abilityId);
        }
        const id = String(abilityId || '').toLowerCase();
        return id.indexOf('shield') !== -1 ||
            id.indexOf('armor') !== -1 ||
            id === 'evasion_boost';
    },

    /** Thruster / drive pods — mount on the aft of the hull. */
    isDriveId(id) {
        const s = String(id || '').toLowerCase();
        if (!s) return false;
        if (s.indexOf('drive') !== -1) return true;
        return s === 'high_speed' || s === 'agile_maneuver';
    },

    /** Armor / plating — docks on hull flanks (silhouette). */
    isArmorId(id) {
        const s = String(id || '').toLowerCase();
        if (!s) return false;
        return s.indexOf('armor') !== -1 ||
            s.indexOf('carapace') !== -1 ||
            s === 'massive_armor' ||
            s === 'heavy_armor';
    },

    /** Shield bubbles / generators — sit in the hull center. */
    isShieldId(id) {
        const s = String(id || '').toLowerCase();
        if (!s) return false;
        return s.indexOf('shield') !== -1 || s === 'reflex_shell';
    },

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
    },

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
    },

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
    },

    /** Sprite key suffix for a segment of a full ship sprite. */
    segmentSpriteKey(shipSpriteKey, segmentId) {
        if (!shipSpriteKey) return null;
        return String(shipSpriteKey) + '-' + String(segmentId);
    },
});
