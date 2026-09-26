"use strict";

// ShipLoadoutManager: hull areas with sized slots.
//
// Every ship has four areas (nose, core, aft, wings). An area's level
// (0..2) is the size of every slot in it: S, M or L. Parts have a size too
// and only fit a slot of the same size or larger. Upgrading an area grows
// its slots and can open new ones. The old frame level is now the sum of
// the area levels (it still drives the hull HP/armor bonus).
const SHIP_AREAS = [
    { id: 'front', label: 'NOSE' },
    { id: 'center', label: 'CORE' },
    { id: 'back', label: 'AFT' },
    { id: 'wing', label: 'WINGS' }
];
const SLOT_SIZES = ['S', 'M', 'L'];

extendClass(ShipLoadoutManager, {
    getShipAreas() {
        return SHIP_AREAS;
    },

    getMaxAreaLevel() {
        return SLOT_SIZES.length - 1;
    },

    slotSizeLabel(level) {
        return SLOT_SIZES[Math.max(0, Math.min(SLOT_SIZES.length - 1, level | 0))];
    },

    getAreaLevels(shipId) {
        if (typeof profileManager !== 'undefined' && profileManager.getShipAreaLevels) {
            return profileManager.getShipAreaLevels(shipId);
        }
        return { front: 0, center: 0, back: 0, wing: 0 };
    },

    /**
     * Slots an area opens at one level. Wing weapons always come in mirrored
     * pairs (one per wing), so a wing level adds two.
     */
    getAreaSlotBonusAt(areaId, level) {
        const table = {
            front: [[], []],
            wing: [['weapons', 'weapons'], ['weapons', 'weapons']],
            center: [['defenses'], ['energy']],
            back: [['abilities'], ['abilities']]
        };
        return ((table[areaId] || [])[level - 1] || []).slice();
    },

    /** All slots an area has opened up to `level`. */
    getAreaSlotBonus(areaId, level) {
        let out = [];
        for (let l = 1; l <= level; l++) out = out.concat(this.getAreaSlotBonusAt(areaId, l));
        return out;
    },

    /** Frame level = total area levels (keeps the hull HP/armor bonus). */
    getFrameLevel(shipId) {
        const lv = this.getAreaLevels(shipId);
        return SHIP_AREAS.reduce((sum, a) => sum + (lv[a.id] || 0), 0);
    },

    /**
     * Slot caps: one nose weapon, the class's wing weapons rounded up to a
     * mirrored pair, plus the slots each area level opens.
     */
    getSlotCaps(shipId, modelClass) {
        const caps = this.getBaseSlotCaps(modelClass);
        caps.weapons = 1 + Math.max(2, Math.ceil((Number(caps.weapons) || 0) / 2) * 2);
        const lv = this.getAreaLevels(shipId);
        SHIP_AREAS.forEach((a) => {
            this.getAreaSlotBonus(a.id, lv[a.id] || 0).forEach((key) => { caps[key] += 1; });
        });
        return caps;
    },

    /**
     * Area a slot sits in: weapon slot 0 is the nose gun, every further
     * weapon slot is on the wings; defense/energy in the core, abilities aft.
     */
    getSlotArea(kind, index) {
        if (kind === 'weapon') return (Number(index) || 0) === 0 ? 'front' : 'wing';
        if (kind === 'ability') return 'back';
        return 'center';
    },

    /**
     * Size level (0 S, 1 M, 2 L) of a slot. Without an index (weapons), the
     * largest weapon slot counts — "does this part fit anywhere".
     */
    getSlotSizeLevel(shipId, kind, index) {
        const lv = this.getAreaLevels(shipId);
        if (kind === 'weapon' && index == null) return Math.max(lv.front || 0, lv.wing || 0);
        return lv[this.getSlotArea(kind, index)] || 0;
    },

    /**
     * Part size level (0 S, 1 M, 2 L). A config entry may set
     * `slotSizeClass: 'S'|'M'|'L'`; otherwise it follows the part's hull
     * footprint: small mounts S, heavy guns / armor / drives M, the biggest L.
     */
    getPartSizeLevel(kind, moduleId) {
        const cfg = this.getModuleConfigEntry(kind, moduleId);
        if (cfg && cfg.slotSizeClass) {
            const i = SLOT_SIZES.indexOf(String(cfg.slotSizeClass).toUpperCase());
            if (i !== -1) return i;
        }
        const sid = String(moduleId || '').toLowerCase();
        if (kind === 'weapon') {
            if (sid === 'missile' || sid === 'nova') return 2;
            return this.heavyWeaponIds[sid] ? 1 : 0;
        }
        const integ = this.getModuleIntegration(kind, moduleId) || {};
        const size = Number(integ.expandSize) || 0;
        if (size >= 4) return 2;
        if (size >= 3) return 1;
        return 0;
    },

    partSizeLabel(kind, moduleId) {
        return this.slotSizeLabel(this.getPartSizeLevel(kind, moduleId));
    },

    /** Does this part fit this ship's slots of its kind? */
    partFitsSlot(shipId, kind, moduleId, index) {
        const need = this.getPartSizeLevel(kind, moduleId);
        const have = this.getSlotSizeLevel(shipId, kind, index);
        return { ok: need <= have, need: need, have: have };
    },
});

// Size check on top of the existing install rules. Parts already installed
// stay (removing is always allowed); only new installs must fit.
(function wrapInstallCheck() {
    const proto = ShipLoadoutManager.prototype;
    const base = proto.canInstallModule;
    proto.canInstallModule = function (shipId, kind, moduleId) {
        const res = base.call(this, shipId, kind, moduleId);
        if (res && res.removing) return res;
        if (res && !res.ok && res.reason !== 'FULL') return res;
        const fit = this.partFitsSlot(shipId, kind, moduleId);
        if (!fit.ok) {
            return { ok: false, reason: 'TOO_BIG', need: fit.need, have: fit.have };
        }
        return res;
    };
})();

// Exact per-slot size check when a part goes into a specific slot (the nose
// and wing weapon slots can differ in size).
(function wrapSetSlotModule() {
    const proto = ShipLoadoutManager.prototype;
    const base = proto.setSlotModule;
    proto.setSlotModule = function (shipId, kind, slotIndex, moduleId) {
        if (moduleId) {
            const fit = this.partFitsSlot(shipId, kind, moduleId, slotIndex);
            if (!fit.ok) {
                return { ok: false, reason: 'TOO_BIG', need: fit.need, have: fit.have, loadout: this.getLoadout(shipId) };
            }
        }
        return base.call(this, shipId, kind, slotIndex, moduleId);
    };
})();

// Wing weapons move in mirrored pairs: moving one wing weapon (or an empty
// wing weapon slot) moves its partner on the other wing to the mirror spot.
(function wrapMirroredWingMoves() {
    const proto = ShipLoadoutManager.prototype;

    /** Partner of a wing weapon slot index: 1↔2, 3↔4, … (0 is the nose). */
    proto.mirrorWeaponSlotIndex = function (index) {
        const i = Number(index) || 0;
        if (i <= 0) return -1;
        return i % 2 === 1 ? i + 1 : i - 1;
    };

    const baseOffset = proto.setModuleOffset;
    proto.setModuleOffset = function (shipId, kind, moduleId, offsetX, offsetY, face) {
        const res = baseOffset.call(this, shipId, kind, moduleId, offsetX, offsetY, face);
        if (!res || !res.ok || kind !== 'weapon' || (face !== 'left' && face !== 'right')) return res;
        // Find the partner: same row on the other wing in the built layout.
        const loadout = this.getLoadout(shipId);
        const cls = this.resolveModelClass(shipId);
        const core = this.getCoreSize(cls, null);
        const layout = this.buildLayout(core.width, core.height, loadout);
        const side = (f) => (layout.modules || [])
            .filter((m) => m.kind === 'weapon' && m.face === f)
            .sort((a, b) => a.y - b.y);
        const mine = side(face);
        const row = mine.findIndex((m) => m.id === moduleId);
        const other = side(face === 'left' ? 'right' : 'left')[row];
        if (row === -1 || !other) return res;
        // Wing offsets are in the wing's own frame: mirrored x, same y.
        return baseOffset.call(this, shipId, kind, other.id, -(Number(offsetX) || 0), offsetY, other.face);
    };

    const baseAnchor = proto.setEmptySlotAnchor;
    proto.setEmptySlotAnchor = function (shipId, kind, index, nx, ny) {
        const res = baseAnchor.call(this, shipId, kind, index, nx, ny);
        if (kind !== 'weapon') return res;
        const partner = this.mirrorWeaponSlotIndex(index);
        if (partner < 0) return res;
        const L = this.getLoadout(shipId);
        // An equipped partner keeps its module offset; only empty slots mirror here.
        if ((L.weapons || [])[partner]) return res;
        return baseAnchor.call(this, shipId, kind, partner,
            nx == null ? null : 1 - Number(nx), ny == null ? null : ny);
    };
})();
