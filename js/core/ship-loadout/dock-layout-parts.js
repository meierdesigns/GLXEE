"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
    /** buildLayout phase 4: apply segment/module offsets and dock parts to their segments. */
    dockLayoutParts(ctx, segments) {
        const { coreWidth, L, parts, segmentOffset, moduleOffset, totalCoreH } = ctx;
        // Offsets are fractions of the unscaled hull height, so resizing one
        // part never shifts the others (the scaled total changed with it).
        const offsetH = ctx.baseCoreH || totalCoreH;

        const moveFor = (id) => {
            const key = id === 'wingLeft' || id === 'wingRight' ? 'wing' : id;
            const off = segmentOffset[key] || { x: 0, y: 0 };
            return {
                x: Math.round(coreWidth * off.x),
                y: Math.round(offsetH * off.y)
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
            part.y += Math.round(offsetH * modOff.y);
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
        }), {
            x: 0,
            y: ctx.frontY != null ? ctx.frontY : 0,
            right: coreWidth,
            bottom: ctx.hullBottom != null ? ctx.hullBottom : totalCoreH
        });

        // Module offsets are local to their owning component, so moving or
        // scaling a component keeps its installed hardware attached to it.
        parts.forEach((part) => {
            const skins = L.moduleSkins && L.moduleSkins[part.kind];
            const slotSkins = L.slotSkins && L.slotSkins[part.kind];
            const moduleSkin = skins ? skins[this.moduleOffsetKey(part.id, part.face)] : null;
            const slotSkin = slotSkins ? slotSkins[String(part.slotIndex)] : null;
            const skin = moduleSkin || slotSkin;
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
    },

    /** buildLayout phase 5: per-module scale. */
    applyLayoutModuleScales(parts, segments) {
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
    },

    /** buildLayout phase 6: sync wing panels, normalize to bbox and assemble the result. */
    finalizeLayout(ctx, segments, wingPanels) {
        const { coreWidth, L, parts, segGap, wingGap, armorIds, shieldIds, drives,
            systemPods, expandFront, expandBack, insertH, totalCoreH } = ctx;

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

        // Hull spans frontY..hullBottom (the body is anchored, so the nose can
        // sit above y=0 or below it) — start the bbox there, not at 0..total.
        let minX = 0;
        let minY = ctx.frontY != null ? ctx.frontY : 0;
        let maxX = coreWidth;
        let maxY = ctx.hullBottom != null ? ctx.hullBottom : totalCoreH;
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
            // Actual hull span (nose top → aft bottom) for the renderers.
            core: {
                x: ox,
                y: oy + (ctx.frontY != null ? ctx.frontY : 0),
                width: coreWidth,
                height: totalCoreH
            },
            // Fixed reference point (layout origin, where the unscaled nose
            // starts). It never moves when a part is resized, so the hangar
            // pins the view on it instead of on the core.
            anchor: { x: ox, y: oy },
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
    },
});
