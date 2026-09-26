"use strict";

// ShipLoadoutManager: hull areas that can be switched off (nose, aft).
// Stored as loadout.disabledAreas = { front, back, wing }. The core always
// stays. A switched-off area is left out of the layout (not drawn, no
// bbox), its slots disappear, and parts that must live somewhere move to
// the core:
//   nose off → the nose weapon slot (weaponSlots[0]) is gone and emptied
//   aft off  → aft modules (ability pods, drives) sit at the core's tail
//   wings off → wing weapon slots (weaponSlots[1..]) are gone; the first
//               wing weapon moves into a free nose slot
const TOGGLEABLE_AREAS = ['front', 'wing', 'back'];

extendClass(ShipLoadoutManager, {
    getToggleableAreas() {
        return TOGGLEABLE_AREAS.slice();
    },

    isAreaEnabled(shipId, areaId) {
        const off = this.getLoadout(shipId).disabledAreas || {};
        return !off[areaId];
    },

    setAreaEnabled(shipId, areaId, enabled) {
        if (TOGGLEABLE_AREAS.indexOf(areaId) === -1) return { ok: false, reason: 'INVALID' };
        const L = this.getLoadout(shipId);
        L.disabledAreas = Object.assign({ front: false, back: false, wing: false }, L.disabledAreas || {});
        L.disabledAreas[areaId] = !enabled;
        if (areaId === 'front' && !enabled) {
            // The nose gun moves to the first free wing slot (so the ship
            // keeps a weapon); with no free wing slot it is unequipped.
            const slots = (L.weaponSlots || L.weapons || []).slice();
            const noseGun = slots[0] || null;
            if (slots.length) slots[0] = null;
            if (noseGun) {
                const caps = this.getSlotCaps(shipId, this.resolveModelClass(shipId));
                const mounts = this.weaponMountSlots ? this.weaponMountSlots(caps.weapons) : caps.weapons;
                for (let i = 1; i < Math.max(2, mounts); i++) {
                    if (!slots[i]) {
                        slots[i] = noseGun;
                        break;
                    }
                }
            }
            while (slots.length && !slots[slots.length - 1]) slots.pop();
            L.weaponSlots = slots;
            L.weapons = slots.filter(Boolean);
        }
        if (areaId === 'wing' && !enabled) {
            const slots = (L.weaponSlots || L.weapons || []).slice();
            const wingGun = slots.slice(1).find(Boolean) || null;
            const noseFree = !slots[0] && !L.disabledAreas.front;
            const next = [noseFree ? wingGun : (slots[0] || null)];
            while (next.length && !next[next.length - 1]) next.pop();
            L.weaponSlots = next;
            L.weapons = next.filter(Boolean);
        }
        const saved = this.setLoadout(shipId, L);
        return { ok: true, loadout: saved };
    },
});

(function wrapAreaToggles() {
    const proto = ShipLoadoutManager.prototype;

    // Layout: drop switched-off segments and move their modules to the core.
    const baseSegments = proto.buildLayoutSegments;
    proto.buildLayoutSegments = function (ctx) {
        const res = baseSegments.call(this, ctx);
        const off = (ctx.L && ctx.L.disabledAreas) || {};
        if (!off.front && !off.back && !off.wing) return res;
        const center = res.segments.find((s) => s.id === 'center');
        const isOff = (id) => !!off[id] || (off.wing && (id === 'wingLeft' || id === 'wingRight'));
        res.segments = res.segments.filter((s) => !isOff(s.id));
        if (off.wing) {
            res.wingPanels.length = 0;
            // Wing mounts go with the wings.
            for (let i = ctx.parts.length - 1; i >= 0; i--) {
                const p = ctx.parts[i];
                if (p.face === 'left' || p.face === 'right') ctx.parts.splice(i, 1);
            }
            if (ctx.L) ctx.L.hideWingConnection = true;
        }
        const coreTop = center ? center.y : ctx.centerY;
        const coreBottom = center ? center.y + center.height : ctx.centerY + ctx.centerH;
        if (off.front) {
            // bbox starts at the core; nose parts (the nose gun) are gone.
            ctx.frontY = coreTop;
            for (let i = ctx.parts.length - 1; i >= 0; i--) {
                const p = ctx.parts[i];
                if (p.kind === 'weapon' && p.face === 'up' && p.y < coreTop) ctx.parts.splice(i, 1);
            }
            if (ctx.L) ctx.L.hideSpineFront = true;
        }
        if (off.back) {
            ctx.hullBottom = coreBottom;
            // Aft modules tuck into the lower core instead — inset from the
            // bottom edge, where the hull tapers and a pod would stick out.
            const inset = center ? Math.max(1, Math.round(center.height * 0.18)) : 1;
            ctx.parts.forEach((p) => {
                if (p.face === 'left' || p.face === 'right') return; // wing mounts stay
                if (p.y + p.height > coreBottom - inset) p.y = Math.max(coreTop, coreBottom - inset - p.height);
            });
            if (ctx.L) ctx.L.hideSpineBack = true;
        }
        if (off.front || off.back) {
            // layout.core (hull span the renderers use, e.g. for the engine
            // glow) must end where the hull now ends, not at the old aft.
            ctx.totalCoreH = Math.max(1, ctx.hullBottom - ctx.frontY);
        }
        return res;
    };

    // Hangar slots: no nose weapon slot while the nose is off.
    const baseSlots = proto.buildHangarSlots;
    proto.buildHangarSlots = function (shipId, modelClass, model) {
        const res = baseSlots.call(this, shipId, modelClass, model);
        const off = (res.loadout && res.loadout.disabledAreas) || {};
        if (off.front || off.wing) {
            res.slots = res.slots.filter((s) => {
                if (s.kind !== 'weapon') return true;
                const nose = Number(s.index) === 0;
                return nose ? !off.front : !off.wing;
            });
        }
        return res;
    };

    // Nothing can be installed into the nose weapon slot while it is off.
    const baseSet = proto.setSlotModule;
    proto.setSlotModule = function (shipId, kind, slotIndex, moduleId) {
        const nose = (Number(slotIndex) || 0) === 0;
        if (moduleId && kind === 'weapon'
            && !this.isAreaEnabled(shipId, nose ? 'front' : 'wing')) {
            return { ok: false, reason: 'AREA_OFF', loadout: this.getLoadout(shipId) };
        }
        return baseSet.call(this, shipId, kind, slotIndex, moduleId);
    };
})();

// No aft, no engine glow: the model's glow belongs to the aft section.
(function wrapAftGlow() {
    const proto = ShipLoadoutManager.prototype;
    const base = proto.applyLayoutToModel;
    if (!base) return;
    proto.applyLayoutToModel = function (model, shipId) {
        const res = base.apply(this, arguments);
        const target = model || res;
        const off = target && target.layout && target.layout.loadout && target.layout.loadout.disabledAreas;
        if (off && off.back) target.engineGlow = null;
        return res;
    };
})();
