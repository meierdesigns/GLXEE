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

    normalizeWingJointSides(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const f = (v) => Math.max(0.01, Math.min(0.6, Number(v) || 0.1));
        return { up0: f(raw.up0), down0: f(raw.down0), up1: f(raw.up1), down1: f(raw.down1) };
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
            slotSkins: this.normalizeSlotSkins(src.slotSkins),
            // Both wings share the same vertical shift and mirror their
            // horizontal distance from the centerline.
            wingOffsetY: Math.max(-1.5, Math.min(1.5, Number(src.wingOffsetY) || 0)),
            wingOffsetX: Math.max(-2, Math.min(2, Number(src.wingOffsetX) || 0)),
            wingConnectionY: Math.max(-1, Math.min(1, Number(src.wingConnectionY) || 0)),
            wingConnectionWidth: Math.max(0.02, Math.min(0.5, Number(src.wingConnectionWidth) || 0.1)),
            wingRotation: Math.max(-60, Math.min(60, Number(src.wingRotation) || 0)),
            voxelScale: Math.max(0.5, Math.min(1.5, Number(src.voxelScale) || 1)),
            // 0 = follow the hull's voxelScale instead of its own value.
            wingConnectionVoxelScale: Math.max(0, Math.min(10, Number(src.wingConnectionVoxelScale) || 0)),
            wingConnectionStyle: ['strut', 'plate', 'double', 'hinge'].indexOf(src.wingConnectionStyle) !== -1
                ? src.wingConnectionStyle
                : 'strut',
            // Fore/aft spine joints (nose→body→aft), tuned like the wing ones.
            spineConnectionStyle: ['strut', 'plate', 'double', 'hinge'].indexOf(src.spineConnectionStyle) !== -1
                ? src.spineConnectionStyle
                : 'strut',
            spineConnectionWidth: Math.max(0.05, Math.min(0.6, Number(src.spineConnectionWidth) || 0.18)),
            // End-side strength; 0 = same as the start-side strength.
            wingConnectionWidthEnd: Math.max(0, Math.min(0.5, Number(src.wingConnectionWidthEnd) || 0)),
            spineConnectionWidthEnd: Math.max(0, Math.min(0.6, Number(src.spineConnectionWidthEnd) || 0)),
            // Per-joint visibility, toggled from the outer parts' panels.
            hideWingConnection: src.hideWingConnection === true,
            hideSpineFront: src.hideSpineFront === true,
            hideSpineBack: src.hideSpineBack === true,
            // Per-side wing joint extents {up0, down0, up1, down1} (0 = hull
            // end, 1 = wing end), in the same units as the strength values.
            // null = symmetric, taken from the two strength values.
            wingJointSides: this.normalizeWingJointSides(src.wingJointSides),
            spineConnectionX: Math.max(-1, Math.min(1, Number(src.spineConnectionX) || 0)),
            segmentScale: this.normalizeSegmentScale(src.segmentScale),
            segmentOffset: this.normalizeSegmentOffset(src.segmentOffset),
            moduleOffset: this.normalizeModuleOffset(src.moduleOffset),
            segmentUv: src.segmentUv && typeof src.segmentUv === 'object'
                ? src.segmentUv
                : null,
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

    normalizeSlotSkins(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const out = {};
        ['weapon', 'defense', 'ability', 'energy'].forEach((kind) => {
            out[kind] = {};
            const values = src[kind] && typeof src[kind] === 'object' ? src[kind] : {};
            Object.keys(values).forEach((index) => {
                if (values[index]) out[kind][String(index)] = String(values[index]);
            });
        });
        return out;
    }
}
