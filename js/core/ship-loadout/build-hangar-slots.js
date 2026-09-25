"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
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

        // Empty slots sit on the centreline by default. Only weapon slots past
        // the first mount on the wings, so only those spread left/right —
        // everything else docks to the hull and reads wrong off-centre.
        const defaultAnchor = (kind, index, cap) => {
            const t = cap <= 1 ? 0.5 : (index + 0.5) / cap;
            if (kind === 'weapon') {
                const onWing = index > 0;
                return {
                    nx: onWing ? 0.2 + t * 0.6 : 0.5,
                    ny: Math.max(0.08, (coreBox.y - 4) / lh),
                    side: index % 2 === 0 ? 'left' : 'right'
                };
            }
            if (kind === 'defense') {
                return {
                    nx: 0.5,
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
                nx: 0.5,
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
    },
});
