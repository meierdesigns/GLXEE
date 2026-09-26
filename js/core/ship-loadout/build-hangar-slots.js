"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
// Which hull areas each slot type may sit in.
const SLOT_AREAS = {
    weapon: ['front', 'wingLeft', 'wingRight'],
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
    clampToSlotArea(kind, nx, ny, layout) {
        const lw = Math.max(1, layout.width || 1);
        const lh = Math.max(1, layout.height || 1);
        const allowed = this.getSlotAreas(kind);
        const segs = (layout.segments || []).filter((s) => allowed.indexOf(s.id) !== -1);
        if (!segs.length) return { nx: nx, ny: ny, area: null };
        let best = null;
        let bestD = Infinity;
        segs.forEach((s) => {
            // Keep a little inside the edge so the marker sits on the part.
            const x0 = (s.x + Math.min(1, s.width * 0.2)) / lw;
            const x1 = (s.x + s.width - Math.min(1, s.width * 0.2)) / lw;
            const y0 = (s.y + Math.min(1, s.height * 0.2)) / lh;
            const y1 = (s.y + s.height - Math.min(1, s.height * 0.2)) / lh;
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
                    nx: (seg.x + seg.width / 2) / lw,
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
                ? { nx: (nose.x + nose.width / 2) / lw, ny: (nose.y + Math.min(nose.height * 0.35, 3)) / lh }
                : { nx: 0.5, ny: Math.max(0.06, (coreBox.y - 4) / lh) };
            const pairs = Math.max(1, cap - 1);
            for (let i = 1; i < cap; i++) {
                if (!wingL || !wingR) {
                    weaponSpotFor[i] = { nx: weaponSpotFor[0].nx, ny: weaponSpotFor[0].ny + i * 0.05 };
                    continue;
                }
                // About a third out from the hull root, where the wing is broadest.
                const fromRoot = 0.36;
                const row = i - 1;
                // Follow the wing when it is rotated.
                const pl = this.rotateOnWing(wingL, loadout.wingRotation,
                    wingL.x + wingL.width * (1 - fromRoot), wingL.y + wingL.height * (row + 0.5) / pairs);
                const pr = this.rotateOnWing(wingR, loadout.wingRotation,
                    wingR.x + wingR.width * fromRoot, wingR.y + wingR.height * (row + 0.5) / pairs);
                weaponSpotFor[i] = {
                    nx: pl.x / lw,
                    ny: pl.y / lh,
                    mirrorNx: pr.x / lw,
                    mirrorNy: pr.y / lh,
                    area: 'wingLeft'
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
                    const matchIdx = placed.findIndex((m) => m && m.id === id);
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
                const weaponAnchor = kind === 'weapon' && !id && loadout.slotAnchors
                    && loadout.slotAnchors.weapon && loadout.slotAnchors.weapon[String(i)];
                if (weaponAnchor) {
                    const c = this.clampToSlotArea('weapon', weaponAnchor.nx, weaponAnchor.ny, layout);
                    const centreNx = (coreBox.x + coreBox.width / 2) / lw;
                    const onWing = c.area === 'wingLeft' || c.area === 'wingRight';
                    spot = {
                        area: c.area,
                        nx: c.nx,
                        ny: c.ny,
                        mirrorNx: onWing ? 2 * centreNx - c.nx : null,
                        mirrorNy: onWing ? c.ny : null
                    };
                }
                if (spot) {
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
                slots.push({
                    mirrorNx: spot && spot.mirrorNx != null ? spot.mirrorNx : null,
                    mirrorNy: spot && spot.mirrorNy != null ? spot.mirrorNy : null,
                    mount: kind === 'weapon' ? (i === 0 ? 'front' : 'wing') : null,
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
