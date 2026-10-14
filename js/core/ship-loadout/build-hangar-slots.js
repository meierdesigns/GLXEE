"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
// Which hull areas each slot type may sit in.
const SLOT_AREAS = {
    // Weapons: nose and core (single on the centreline or split), wings (split).
    weapon: ['front', 'center', 'wingLeft', 'wingRight'],
    defense: ['center'],
    energy: ['center'],
    ability: ['back', 'center']
};

extendClass(ShipLoadoutManager, {
    /**
     * Weapon slots as mounted: caps.weapons counts nose + every wing side
     * (1 + 2k); a wing slot is one weapon mirrored left+right, so that is
     * the nose plus k wing pairs = 1 + k slots.
     */
    weaponMountSlots(capWeapons) {
        const c = Math.max(0, Number(capWeapons) || 0);
        return c <= 1 ? c : 1 + Math.floor((c - 1) / 2);
    },

    /** Allowed hull area ids for a slot type. */
    getSlotAreas(kind) {
        return SLOT_AREAS[kind] || ['front', 'center', 'back', 'wingLeft', 'wingRight'];
    },

    /**
     * Pull a ship-normalized point into the nearest allowed area of its slot
     * type (returns it unchanged when already inside one, or when the layout
     * has none of those areas). Returns { nx, ny, area }.
     */
    clampToSlotArea(kind, nx, ny, layout, rectOnly) {
        const lw = Math.max(1, layout.width || 1);
        const lh = Math.max(1, layout.height || 1);
        const allowed = this.getSlotAreas(kind);
        const segs = (layout.segments || []).filter((s) => allowed.indexOf(s.id) !== -1);
        if (!segs.length) return { nx: nx, ny: ny, area: null };
        let best = null;
        let bestD = Infinity;
        // Wings: work in the wing's own (unturned) frame and only allow its lit pixels, then turn back with the wing,
        // so a gun can sit anywhere on the visible, rotated wing.
        const loader = typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader;
        const model = typeof homeStationUI !== 'undefined' ? homeStationUI._hangarLastModel : null;
        const rot = (layout.loadout && layout.loadout.wingRotation) || 0;
        segs.forEach((s) => {
            const isWing = s.id === 'wingLeft' || s.id === 'wingRight';
            if (!rectOnly && loader && model && model.layout && (isWing ? loader.wingLitCells : loader.bodyLitCells)) {
                // The art is voxelised at the fit scale (draw-hangar-bay), so the lit pixels must be read at that scale too.
                const sc = (loader._voxelRef && loader._voxelRef.scale) || (typeof homeStationUI !== 'undefined' ? homeStationUI._hangarLastScale || 1 : 1);
                const lit = isWing ? loader.wingLitCells(s, model, sc) : loader.bodyLitCells(s, model, sc);
                if (lit && lit.pts.length) {
                    const q = isWing ? this.rotateOnWing(s, -rot, nx * lw, ny * lh) : { x: nx * lw, y: ny * lh };
                    let bp = null, bd = Infinity;
                    lit.pts.forEach((p) => { const d = Math.hypot(p[0] - q.x, p[1] - q.y); if (d < bd) { bd = d; bp = p; } });
                    // Inside a lit cell: keep the exact point.
                    const at = bd <= lit.cell * 0.75 ? q : { x: bp[0], y: bp[1] };
                    const g = isWing ? this.rotateOnWing(s, rot, at.x, at.y) : at;
                    const d = Math.hypot(g.x / lw - nx, g.y / lh - ny);
                    if (d < bestD) { bestD = d; best = { nx: g.x / lw, ny: g.y / lh, area: s.id }; }
                    return;
                }
            }
            // The whole area is placeable, edge pixels included.
            const x0 = s.x / lw;
            const x1 = (s.x + s.width) / lw;
            const y0 = s.y / lh;
            const y1 = (s.y + s.height) / lh;
            const cx = Math.max(x0, Math.min(x1, nx));
            const cy = Math.max(y0, Math.min(y1, ny));
            const d = Math.hypot(cx - nx, cy - ny);
            if (d < bestD) {
                bestD = d;
                best = { nx: cx, ny: cy, area: s.id };
            }
        });
        return best;
    },

    /**
     * Slot anchors for hangar bay UI: one entry per available frame slot.
     * Positions are normalized 0..1 relative to the modular layout bbox.
     */
    buildHangarSlots(shipId, modelClass, model) {
        const cls = modelClass || this.resolveModelClass(shipId);
        const caps = this.getSlotCaps(shipId, cls);
        // Wing rows follow the ship's wing slot count, so the layout puts each
        // wing weapon on the same row as its hangar marker.
        const loadout = Object.assign(this.withWeaponSlotScales
            ? this.withWeaponSlotScales(shipId, this.getLoadout(shipId)) : Object.assign({}, this.getLoadout(shipId)),
            { wingSlotRows: Math.max(0, this.weaponMountSlots(caps.weapons) - 1) });
        const core = this.getCoreSize(cls, model || null);
        const layout = this.buildLayout(core.width, core.height, loadout);
        const lw = Math.max(1, layout.width || 1);
        const lh = Math.max(1, layout.height || 1);
        const coreBox = layout.core || { x: 0, y: 0, width: core.width, height: core.height };

        // Hull axis: middle of all segments. Slots on the centre line use it, so they sit exactly centred on the art.
        const hullAxis = (() => {
            let lo = Infinity, hi = -Infinity;
            (layout.segments || []).forEach((sg) => { lo = Math.min(lo, sg.x); hi = Math.max(hi, sg.x + sg.width); });
            return isFinite(lo) && hi > lo ? (lo + hi) / 2 / lw : 0.5;
        })();

        const modulesByKind = {
            weapon: [],
            defense: [],
            ability: [],
            energy: []
        };
        (layout.modules || []).forEach((m) => {
            if (m && modulesByKind[m.kind]) modulesByKind[m.kind].push(m);
        });

        // Empty slots sit on the centreline by default. A lone weapon slot is
        // the nose tip; with two or more, every weapon slot mounts on the
        // wings, so only those spread left/right — everything else docks to
        // the hull and reads wrong off-centre.
        const defaultAnchor = (kind, index, cap) => {
            // Hull slots sit on the centreline, spread evenly down their part:
            // defense then energy share the core, abilities the aft.
            const segs = layout.segments || [];
            const spread = (segId, k, n, fallbackY) => {
                const seg = segs.find((sg) => sg.id === segId);
                if (!seg) return { nx: 0.5, ny: fallbackY };
                return {
                    nx: hullAxis,
                    ny: (seg.y + seg.height * (k + 1) / (n + 1)) / lh
                };
            };
            const capD = Math.max(0, Number(caps.defenses) || 0);
            const capE = Math.max(0, Number(caps.energy != null ? caps.energy : 1) || 0);
            const capA = Math.max(0, Number(caps.abilities) || 0);
            let spot;
            if (kind === 'defense') spot = spread('center', index, capD + capE, 0.4);
            else if (kind === 'energy') spot = spread('center', capD + index, capD + capE, 0.5);
            else spot = spread('back', index, capA, 0.9);
            return { nx: spot.nx, ny: spot.ny, side: index % 2 === 0 ? 'left' : 'right' };
        };

        // Fixed weapon mount spots: slot 0 = nose tip; slot 1+ = wing pairs,
        // stacked down the wings. A wing slot holds one weapon mirrored on
        // both wings, so it carries a second (mirror) marker on the right.
        const weaponSpotFor = {};
        (() => {
            const cap = this.weaponMountSlots(caps.weapons);
            const segs = layout.segments || [];
            const nose = segs.find((sg) => sg.id === 'front');
            const wingL = segs.find((sg) => sg.id === 'wingLeft');
            const wingR = segs.find((sg) => sg.id === 'wingRight');
            weaponSpotFor[0] = nose
                ? { nx: hullAxis, ny: (nose.y + Math.min(nose.height * 0.35, 3)) / lh }
                : { nx: 0.5, ny: Math.max(0.06, (coreBox.y - 4) / lh) };
            const pairs = Math.max(1, cap - 1);
            for (let i = 1; i < cap; i++) {
                if (!wingL || !wingR) {
                    weaponSpotFor[i] = { nx: weaponSpotFor[0].nx, ny: weaponSpotFor[0].ny + i * 0.05 };
                    continue;
                }
                // About a third out from the hull root, where the wing is
                // broadest — or the spot the player moved this slot to.
                const wm = this.getWingWeaponMount ? this.getWingWeaponMount(loadout, i) : null;
                const fx = wm ? wm.fx : 1 - 0.36;
                const fy = wm ? wm.ny : (i - 0.5) / pairs;
                // Follow the wing when it is rotated.
                const pl = this.rotateOnWing(wingL, loadout.wingRotation,
                    wingL.x + wingL.width * fx, wingL.y + wingL.height * fy);
                const pr = this.rotateOnWing(wingR, loadout.wingRotation,
                    wingR.x + wingR.width * (1 - fx), wingR.y + wingR.height * fy);
                weaponSpotFor[i] = {
                    nx: pl.x / lw,
                    ny: pl.y / lh,
                    mirrorNx: pr.x / lw,
                    mirrorNy: pr.y / lh,
                    area: 'wingLeft',
                    stored: !!wm
                };
            }
            // Nose slot moved onto the wings: a wing pair at its stored spot.
            const wm0 = this.getWingWeaponMount ? this.getWingWeaponMount(loadout, 0) : null;
            if (wm0 && wingL && wingR) {
                const pl = this.rotateOnWing(wingL, loadout.wingRotation,
                    wingL.x + wingL.width * wm0.fx, wingL.y + wingL.height * wm0.ny);
                const pr = this.rotateOnWing(wingR, loadout.wingRotation,
                    wingR.x + wingR.width * (1 - wm0.fx), wingR.y + wingR.height * wm0.ny);
                weaponSpotFor[0] = {
                    nx: pl.x / lw, ny: pl.y / lh, mirrorNx: pr.x / lw, mirrorNy: pr.y / lh,
                    area: 'wingLeft', stored: true
                };
            }
            // Nose/core mounts: single on the centreline or a mirrored pair
            // (same spot the layout puts the weapon, see weaponBodySpot).
            for (let i = 0; i < cap; i++) {
                const m = this.getBodyWeaponMount ? this.getBodyWeaponMount(loadout, i) : null;
                const b = m ? this.weaponBodySpot(segs, m) : null;
                if (!b) continue;
                weaponSpotFor[i] = {
                    nx: b.x / lw,
                    ny: b.y / lh,
                    mirrorNx: b.split ? b.mx / lw : null,
                    mirrorNy: b.split ? b.my / lh : null,
                    area: b.area,
                    split: b.split,
                    body: true
                };
            }
        })();

        const slots = [];
        const pushCategory = (kind, key) => {
            const cap = kind === 'weapon'
                ? this.weaponMountSlots(caps[key])
                : Math.max(0, Number(caps[key]) || 0);
            // Weapons are positional (weaponSlots: 0 = nose, gaps allowed);
            // the compact `weapons` list would shift wing weapons onto the
            // wrong slot when the nose is empty.
            const equipped = (kind === 'weapon' && Array.isArray(loadout.weaponSlots)
                ? loadout.weaponSlots : loadout[key]) || [];
            const placed = modulesByKind[kind] || [];
            for (let i = 0; i < cap; i++) {
                const id = equipped[i] || null;
                let mod = null;
                if (id) {
                    // Same weapon in nose and wing: match by slot first.
                    let matchIdx = placed.findIndex((m) => m && m.id === id && m.slotIndex === i
                        && (kind !== 'weapon' || m.face !== 'right'));
                    if (matchIdx === -1) matchIdx = placed.findIndex((m) => m && m.id === id);
                    if (matchIdx !== -1) {
                        mod = placed[matchIdx];
                        placed.splice(matchIdx, 1);
                    }
                }
                let nx;
                let ny;
                let side;
                let spot = kind === 'weapon' ? weaponSpotFor[i] : null;
                // An empty weapon slot can be dragged to a custom spot; wing
                // slots keep their mirror marker on the other wing.
                const weaponAnchor = kind === 'weapon' && !id && !(spot && (spot.body || spot.stored)) && loadout.slotAnchors
                    && loadout.slotAnchors.weapon && loadout.slotAnchors.weapon[String(i)];
                if (weaponAnchor) {
                    const c = this.clampToSlotArea('weapon', weaponAnchor.nx, weaponAnchor.ny, layout);
                    const centreNx = hullAxis;
                    const onWing = c.area === 'wingLeft' || c.area === 'wingRight';
                    spot = {
                        area: c.area,
                        nx: c.nx,
                        ny: c.ny,
                        mirrorNx: onWing ? 2 * centreNx - c.nx : null,
                        mirrorNy: onWing ? c.ny : null
                    };
                }
                if (spot && mod && kind === 'weapon') {
                    // Equipped: the marker sits on the gun itself (and its
                    // mirror on the other half), not on the planned spot.
                    nx = (mod.x + (mod.width || 0) * 0.5) / lw;
                    ny = (mod.y + (mod.height || 0) * 0.5) / lh;
                    side = 'left';
                    const twin = (layout.modules || []).find((m) => m !== mod && m.kind === 'weapon'
                        && m.id === mod.id && m.slotIndex === mod.slotIndex);
                    spot = Object.assign({}, spot, twin ? {
                        mirrorNx: (twin.x + twin.width * 0.5) / lw,
                        mirrorNy: (twin.y + twin.height * 0.5) / lh
                    } : { mirrorNx: null, mirrorNy: null });
                } else if (spot) {
                    nx = spot.nx;
                    ny = spot.ny;
                    side = 'left';
                } else if (mod) {
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
                    // Saved spots from before the area rules get pulled into
                    // an allowed area.
                    const clamped = this.clampToSlotArea(kind, nx, ny, layout);
                    nx = clamped.nx;
                    ny = clamped.ny;
                    side = a.side;
                    if (customAnchor) {
                        if (nx < 0.32) side = 'left';
                        else if (nx > 0.68) side = 'right';
                    }
                }
                // A pin within 1.5 voxels of the hull axis sits exactly on it (module x is rounded to whole voxels).
                if (Math.abs(nx - hullAxis) * lw < 1.5) nx = hullAxis;
                slots.push({
                    mirrorNx: spot && spot.mirrorNx != null ? spot.mirrorNx : null,
                    mirrorNy: spot && spot.mirrorNy != null ? spot.mirrorNy : null,
                    mount: kind === 'weapon'
                        ? (spot && spot.body ? spot.area
                            : (spot && spot.area === 'wingLeft' ? 'wing' : (i === 0 ? 'front' : 'wing'))) : null,
                    // Split mounts (wing pairs, nose/core pairs) are half size.
                    split: kind === 'weapon' && (spot && spot.body ? !!spot.split
                        : (i > 0 || (spot && spot.area === 'wingLeft'))),
                    area: spot ? (spot.area || (i === 0 ? 'front' : 'wingLeft')) : null,
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
    },
});
