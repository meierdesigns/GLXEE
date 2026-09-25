"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
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
    },

    setWingOffset(shipId, offsetX, offsetY) {
        const loadout = this.getLoadout(shipId);
        loadout.wingOffsetX = Math.max(-2, Math.min(2, Number(offsetX) || 0));
        loadout.wingOffsetY = Math.max(-1.5, Math.min(1.5, Number(offsetY) || 0));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

    setWingConnection(shipId, connectionY) {
        const loadout = this.getLoadout(shipId);
        loadout.wingConnectionY = Math.max(-1, Math.min(1, Number(connectionY) || 0));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

    setWingConnectionWidth(shipId, width) {
        const loadout = this.getLoadout(shipId);
        loadout.wingConnectionWidth = Math.max(0.02, Math.min(0.5, Number(width) || 0.1));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

    setWingRotation(shipId, degrees) {
        const loadout = this.getLoadout(shipId);
        loadout.wingRotation = Math.max(-60, Math.min(60, Number(degrees) || 0));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

    setWingConnectionVoxelScale(shipId, scale) {
        const loadout = this.getLoadout(shipId);
        loadout.wingConnectionVoxelScale = Math.max(0, Math.min(10, Number(scale) || 0));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

    setVoxelScale(shipId, scale) {
        const loadout = this.getLoadout(shipId);
        loadout.voxelScale = Math.max(0.1, Math.min(10, Number(scale) || 1));
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

    setWingConnectionStyle(shipId, style) {
        const allowed = ['strut', 'plate', 'double', 'hinge'];
        const loadout = this.getLoadout(shipId);
        loadout.wingConnectionStyle = allowed.indexOf(style) !== -1 ? style : 'strut';
        const saved = this.setLoadout(shipId, loadout);
        return { ok: true, loadout: saved };
    },

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
    },

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
    },

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
    },

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
    },

    getModuleScale(shipId, kind, moduleId) {
        const id = String(moduleId || '');
        if (!id) return 1;
        const loadout = this.getLoadout(shipId);
        const scales = this.normalizeModuleScales(loadout.moduleScales);
        const n = scales[kind] && scales[kind][id];
        return n != null ? n : 1;
    },

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
    },
});
