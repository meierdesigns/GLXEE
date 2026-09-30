"use strict";

// ShipLoadoutManager: where each weapon slot is mounted.
//
//   weaponMounts[slot] = { area: 'front' | 'center' | 'wing', split, off, ny }
//
// Nose and core mounts are either one gun on the snapped centreline
// (single, stronger) or a mirrored pair left/right of it (split, each half
// half size and weaker). Wing slots are always split across both wings.
// No entry = the classic layout: slot 0 single in the nose, slot 1+ wings.
// The mount is set where an empty slot's socket is dropped.
(function weaponMounts() {
    const proto = ShipLoadoutManager.prototype;
    // Offset from the centreline (share of the area's width) below which a
    // socket snaps onto the centreline and becomes a single mount.
    // Generous on purpose: a fifth of the area's width either side.
    const SNAP_OFF = 0.2;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    // Default wing spot: about a third out from the hull root.
    const WING_FX = 1 - 0.36;

    proto.normalizeWeaponMounts = function (raw) {
        const out = {};
        if (!raw || typeof raw !== 'object') return out;
        Object.keys(raw).forEach((k) => {
            const m = raw[k];
            if (!m || typeof m !== 'object') return;
            const area = ['front', 'center', 'wing'].indexOf(m.area) !== -1 ? m.area : null;
            if (!area) return;
            out[String(Math.max(0, Math.round(Number(k) || 0)))] = {
                area: area,
                split: area === 'wing' ? true : !!m.split,
                off: clamp(Number(m.off) || 0, 0, 0.45),
                ny: clamp(m.ny == null ? 0.5 : Number(m.ny) || 0, 0, 1),
                // Wing mounts: spot along the left wing from its tip (0) to
                // the hull root (1); the right wing mirrors it.
                fx: clamp(m.fx == null ? WING_FX : Number(m.fx) || 0, 0, 1)
            };
        });
        return out;
    };

    const baseNormalize = proto.normalizeLoadout;
    proto.normalizeLoadout = function (src) {
        const L = baseNormalize.call(this, src);
        L.weaponMounts = this.normalizeWeaponMounts(src && src.weaponMounts);
        return L;
    };

    /** Stored mount of a weapon slot, or null for the classic default. */
    proto.getStoredWeaponMount = function (L, index) {
        const m = L && L.weaponMounts && L.weaponMounts[String(index)];
        return m || null;
    };

    /** Nose/core mount of a slot (stored), or null when it is a nose default / wing slot. */
    proto.getBodyWeaponMount = function (L, index) {
        const m = this.getStoredWeaponMount(L, index);
        return m && (m.area === 'front' || m.area === 'center') ? m : null;
    };

    /** Stored free spot of a wing slot, or null (then it uses its default row). */
    proto.getWingWeaponMount = function (L, index) {
        const m = this.getStoredWeaponMount(L, index);
        return m && m.area === 'wing' ? m : null;
    };

    /**
     * Centre point(s) of a nose/core mount in layout units, from the final
     * segments: { area, split, x, y, mx, my } (mx/my = mirrored half).
     */
    proto.weaponBodySpot = function (segments, mount) {
        if (mount.area === 'wing') {
            // Unrotated wing frames; callers rotate with the wing.
            const l = (segments || []).find((s) => s.id === 'wingLeft');
            const r = (segments || []).find((s) => s.id === 'wingRight');
            if (!l) return null;
            const y = l.y + l.height * mount.ny;
            return {
                area: 'wing', split: true,
                x: l.x + l.width * mount.fx, y: y,
                mx: r ? r.x + r.width * (1 - mount.fx) : null, my: r ? r.y + r.height * mount.ny : null
            };
        }
        const seg = (segments || []).find((s) => s.id === mount.area);
        if (!seg) return null;
        const mid = seg.x + seg.width / 2;
        const y = seg.y + seg.height * mount.ny;
        const dx = mount.split ? mount.off * seg.width : 0;
        return { area: mount.area, split: mount.split, x: mid - dx, y: y, mx: mid + dx, my: y };
    };

    /**
     * Mount for a socket dropped at ship-normalized (nx, ny): the area it
     * lands in and, on nose/core, single (near the centreline) or split.
     * Returns null for areas weapons can't use.
     */
    proto.weaponMountAt = function (layout, nx, ny) {
        if (!layout) return null;
        const lw = Math.max(1, layout.width || 1);
        const lh = Math.max(1, layout.height || 1);
        const c = this.clampToSlotArea('weapon', nx, ny, layout);
        if (!c || !c.area) return null;
        if (c.area === 'wingLeft' || c.area === 'wingRight') {
            // Into the left wing's own (unrotated) frame; the right wing is
            // its mirror, so both wings give the same spot.
            const w = (layout.segments || []).find((s) => s.id === c.area);
            if (!w) return null;
            const rot = (layout.loadout && layout.loadout.wingRotation) || 0;
            const p = this.rotateOnWing(w, -rot, c.nx * lw, c.ny * lh);
            let fx = (p.x - w.x) / Math.max(1, w.width);
            if (c.area === 'wingRight') fx = 1 - fx;
            return {
                area: 'wing', split: true, off: 0,
                fx: clamp(fx, 0, 1),
                ny: clamp((p.y - w.y) / Math.max(1, w.height), 0, 1)
            };
        }
        if (c.area !== 'front' && c.area !== 'center') return null;
        const seg = (layout.segments || []).find((s) => s.id === c.area);
        if (!seg) return null;
        const off = Math.abs(c.nx * lw - (seg.x + seg.width / 2)) / Math.max(1, seg.width);
        const split = off > SNAP_OFF;
        return {
            area: c.area,
            split: split,
            off: split ? clamp(off, 0.25, 0.45) : 0,
            ny: clamp((c.ny * lh - seg.y) / Math.max(1, seg.height), 0, 1)
        };
    };

    /**
     * Footprint boxes (layout units, centre + size) of a mount: one for a
     * single, two for a split. Size = the area's mount size (half if split).
     */
    proto.weaponMountBoxes = function (layout, mount) {
        const spot = this.weaponBodySpot(layout.segments, mount);
        if (!spot) return [];
        const ms = layout.mountSizes || {};
        if (mount.area === 'wing') {
            // Wing pairs are mirrors: checking the left wing is enough.
            return [{ x: spot.x, y: spot.y, s: Math.max(2, ms.weaponPair || ms.wing || 2) }];
        }
        // Same gun size on every area (see placeLayoutModules).
        const size = mount.split
            ? Math.max(2, ms.weaponPair || ms.wing || 2)
            : Math.max(2, ms.weapon || ms.front || 4);
        const boxes = [{ x: spot.x, y: spot.y, s: size }];
        if (mount.split) boxes.push({ x: spot.mx, y: spot.my, s: size });
        return boxes;
    };

    /**
     * The mount moved to the nearest height in its area where it overlaps
     * no other weapon slot (other nose/core mounts, and the classic nose
     * slot), or null when there is no free spot.
     */
    proto.freeWeaponMount = function (layout, L, index, mount, slotCount) {
        const seg = (layout.segments || []).find((s) => s.id === (mount.area === 'wing' ? 'wingLeft' : mount.area));
        if (!seg) return mount;
        const taken = [];
        const rows = Math.max(1, slotCount - 1);
        for (let j = 0; j < slotCount; j++) {
            if (j === index) continue;
            const om = this.getStoredWeaponMount(L, j);
            if (mount.area === 'wing' && j > 0 && !om) {
                // Wing slot on its default row.
                taken.push(...this.weaponMountBoxes(layout, { area: 'wing', fx: WING_FX, ny: (j - 0.5) / rows }));
            } else if (om && om.area === mount.area) {
                taken.push(...this.weaponMountBoxes(layout, om));
            } else if (!om && j === 0 && mount.area === 'front') {
                // Classic nose slot: centred near the nose tip (hangar default spot).
                const s = Math.max(2, (layout.mountSizes && layout.mountSizes.front) || 4);
                taken.push({ x: seg.x + seg.width / 2, y: seg.y + Math.min(seg.height * 0.35, 3), s: s });
            }
        }
        const hits = (m) => this.weaponMountBoxes(layout, m).some((a) => taken.some((b) =>
            Math.abs(a.x - b.x) < (a.s + b.s) / 2 && Math.abs(a.y - b.y) < (a.s + b.s) / 2));
        if (!hits(mount)) return mount;
        const step = 1 / Math.max(1, seg.height);
        // Nearest free height first; on nose/core then a split pair further
        // out (smaller halves beside what is already on the centreline).
        const variants = [mount];
        if (mount.area !== 'wing') {
            [0.25, 0.35, 0.45].forEach((off) => {
                if (!mount.split || off > mount.off) variants.push(Object.assign({}, mount, { split: true, off: off }));
            });
        }
        for (const v of variants) {
            if (!hits(v)) return v;
            for (let k = 1; k <= seg.height; k++) {
                for (const dir of [1, -1]) {
                    const ny = v.ny + dir * k * step;
                    if (ny < 0 || ny > 1) continue;
                    const m = Object.assign({}, v, { ny: ny });
                    if (!hits(m)) return m;
                }
            }
        }
        return null;
    };

    // Dropping an empty weapon socket also sets that slot's mount.
    const baseAnchor = proto.setEmptySlotAnchor;
    proto.setEmptySlotAnchor = function (shipId, kind, index, nx, ny) {
        const before = this.getLoadout(shipId).slotAnchors;
        const prev = before && before[kind] && before[kind][String(Math.max(0, Math.round(Number(index) || 0)))];
        const res = baseAnchor.call(this, shipId, kind, index, nx, ny);
        if (kind !== 'weapon' || nx == null || ny == null) return res;
        // A refused drop leaves the socket where it was.
        const refuse = (reason) => {
            const back = baseAnchor.call(this, shipId, kind, index, prev ? prev.nx : null, prev ? prev.ny : null);
            return { ok: false, reason: reason, loadout: back.loadout };
        };
        const L = this.getLoadout(shipId);
        const cls = this.resolveModelClass(shipId);
        const core = this.getCoreSize(cls, null);
        const caps = this.getSlotCaps(shipId, cls);
        const layout = this.buildLayout(core.width, core.height, Object.assign({}, L,
            { wingSlotRows: Math.max(0, this.weaponMountSlots(caps.weapons) - 1) }));
        const mount = this.weaponMountAt(layout, nx, ny);
        if (!mount) return res;
        const mounts = this.normalizeWeaponMounts(L.weaponMounts);
        const key = String(Math.max(0, Math.round(Number(index) || 0)));
        // Any slot may go anywhere: nose/core (single or split) or wings.
        if (mount.area === 'wing') {
            const freeWing = this.freeWeaponMount(layout, L, Number(key),
                mount, this.weaponMountSlots(caps.weapons));
            if (!freeWing) return refuse('SLOT_OCCUPIED');
            mounts[key] = freeWing;
        } else {
            // Slots never overlap: slide to the nearest free height in the
            // area, or refuse the drop when the area is full.
            const free = this.freeWeaponMount(layout, L, Number(key),
                mount, this.weaponMountSlots(caps.weapons));
            if (!free) return refuse('SLOT_OCCUPIED');
            mounts[key] = free;
        }
        L.weaponMounts = mounts;
        return { ok: true, loadout: this.setLoadout(shipId, L) };
    };

    if (typeof FACTION_LAYOUT_KEYS !== 'undefined' && FACTION_LAYOUT_KEYS.indexOf('weaponMounts') === -1) {
        FACTION_LAYOUT_KEYS.push('weaponMounts');
    }
})();
