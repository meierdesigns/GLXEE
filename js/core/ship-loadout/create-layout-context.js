"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
    /**
     * buildLayout phase 1: base segment geometry, module integration effects
     * and wing sizing. Returns the shared layout context.
     */
    createLayoutContext(coreWidth, coreHeight, loadout) {
        const L = this.normalizeLoadout(loadout);
        const ms = this.moduleSize;
        const gap = this.moduleGap;
        const evenSize = (n) => {
            let v = Math.max(2, Math.round(Number(n) || 0));
            if (v % 2) v -= 1;
            return Math.max(2, v);
        };
        const edgeMs = evenSize(ms);
        const centerMs = evenSize(ms);
        const hullMid = coreWidth / 2;
        const parts = [];
        const uv = L.segmentUv || this.segmentUv;
        const slotCounters = { weapon: 0, defense: 0, ability: 0, energy: 0 };

        const alignCenter = (center, size) => Math.floor(center - size / 2);

        const moduleScales = this.normalizeModuleScales(L.moduleScales);
        // Place with unscaled footprint; apply moduleScales from center at the end
        // so the slider grows the module in place instead of shoving it sideways.
        const resolveDim = (id, kind, base) => {
            const d = this.resolveComponentDim(id, kind, base, evenSize);
            const s = (moduleScales[kind] && moduleScales[kind][id]) || 1;
            return {
                w: d.w,
                h: d.h,
                scaleW: s === 1 ? d.w : evenSize(d.w * s),
                scaleH: s === 1 ? d.h : evenSize(d.h * s)
            };
        };

        const pushPart = (id, kind, x, y, face, w, h, extra) => {
            const integ = this.getModuleIntegration(kind, id);
            let mountSegment = integ.zone || 'center';
            if (kind === 'weapon') {
                mountSegment = face === 'left' || face === 'right' ? 'wing' : 'front';
            } else if (kind === 'ability') {
                mountSegment = 'back';
            } else if (kind === 'energy') {
                mountSegment = 'center';
            } else if (kind === 'defense') {
                mountSegment = 'center';
            }
            const scaleW = extra && extra.scaleW != null ? extra.scaleW : w;
            const scaleH = extra && extra.scaleH != null ? extra.scaleH : h;
            const rest = extra ? Object.assign({}, extra) : {};
            delete rest.scaleW;
            delete rest.scaleH;
            const slotIndex = rest.slotIndex != null
                ? Number(rest.slotIndex)
                : (slotCounters[kind]++);
            delete rest.slotIndex;
            parts.push(Object.assign({
                id: id,
                kind: kind,
                slotIndex: slotIndex,
                x: x,
                y: y,
                width: w,
                height: h,
                scaleW: scaleW,
                scaleH: scaleH,
                face: face || 'up',
                role: this.getModuleVisualRole(kind, id),
                integrate: integ.mode,
                zone: integ.zone,
                mountSegment: mountSegment
            }, rest));
        };

        // --- Base segment geometry (layout units inside core) ---
        const segGap = Math.max(0, Number(this.segmentGap) || 0);
        const wingGap = Math.max(0, Number(this.wingGap) || 0);
        const segmentScale = this.normalizeSegmentScale(L.segmentScale);
        const segmentOffset = this.normalizeSegmentOffset(L.segmentOffset);
        const moduleOffset = this.normalizeModuleOffset(L.moduleOffset);
        let frontH = Math.max(2, Math.round(coreHeight * uv.front.h));
        let backH = Math.max(2, Math.round(coreHeight * uv.back.h));
        let centerH = Math.max(2, coreHeight - frontH - backH);
        let wingSpan = 0;
        let wingH = Math.max(2, Math.floor(coreHeight * uv.wing.h));
        // Center fuselage is narrower than nose/aft so parts read as separate blocks
        const centerW = Math.max(4, Math.round(coreWidth * 0.72));
        const frontW = Math.max(4, Math.round(coreWidth * 0.78));
        const backW = Math.max(4, Math.round(coreWidth * 0.82));
        frontH = Math.max(2, Math.round(frontH * segmentScale.front.y));
        centerH = Math.max(2, Math.round(centerH * segmentScale.center.y));
        backH = Math.max(2, Math.round(backH * segmentScale.back.y));
        wingH = Math.max(2, Math.round(wingH * segmentScale.wing.y));
        const scaledFrontW = Math.max(4, Math.round(frontW * segmentScale.front.x));
        const scaledCenterW = Math.max(4, Math.round(centerW * segmentScale.center.x));
        const scaledBackW = Math.max(4, Math.round(backW * segmentScale.back.x));
        const scaledFrontX = Math.floor((coreWidth - scaledFrontW) / 2);
        const scaledCenterX = Math.floor((coreWidth - scaledCenterW) / 2);
        const scaledBackX = Math.floor((coreWidth - scaledBackW) / 2);

        // Collect integration effects before placing attach mounts
        const armorIds = L.defenses.filter((id) => this.isArmorId(id));
        const shieldIds = L.defenses.filter((id) => !this.isArmorId(id));
        const drives = L.abilities.filter((id) => this.isDriveId(id));
        const systemPods = L.abilities.filter((id) => !this.isDriveId(id));

        const zoneReplace = { front: null, center: null, back: null, wing: null };
        const centerInserts = [];
        let expandFront = 0;
        let expandBack = 0;
        let expandWing = 0;

        const applyInteg = (id, kind) => {
            const integ = this.getModuleIntegration(kind, id);
            const size = Math.max(2, Number(integ.expandSize) || edgeMs);
            if (integ.mode === 'replace') {
                zoneReplace[integ.zone] = { id: id, kind: kind };
                if (integ.zone === 'wing') expandWing = Math.max(expandWing, size);
                if (integ.zone === 'back') expandBack = Math.max(expandBack, size);
                if (integ.zone === 'front') expandFront = Math.max(expandFront, size);
            } else if (integ.mode === 'insert' && integ.zone === 'center') {
                centerInserts.push({ id: id, kind: kind, size: size });
            } else if (integ.mode === 'expand') {
                if (integ.zone === 'front' || integ.expandDir === 'forward') {
                    expandFront += size;
                } else if (integ.zone === 'back' || integ.expandDir === 'aft') {
                    expandBack += size;
                } else if (integ.zone === 'wing' || integ.expandDir === 'side') {
                    expandWing = Math.max(expandWing, size);
                }
            }
        };

        L.weapons.forEach((id) => applyInteg(id, 'weapon'));
        armorIds.forEach((id) => applyInteg(id, 'defense'));
        shieldIds.forEach((id) => applyInteg(id, 'defense'));
        L.energy.forEach((id) => applyInteg(id, 'energy'));
        systemPods.forEach((id) => applyInteg(id, 'ability'));
        drives.forEach((id) => applyInteg(id, 'ability'));

        // Grow segments from inserts / expands
        const insertH = centerInserts.reduce((sum, it) => sum + it.size + gap, 0);
        centerH += insertH;
        frontH += expandFront;
        backH += expandBack;

        const weaponsOnSides = L.weapons.length > 1;
        const wingNeed = Math.max(
            weaponsOnSides ? L.weapons.length - 1 : 0,
            zoneReplace.wing ? 1 : 0,
            expandWing > 0 ? 1 : 0
        );
        // Wings are always independent geometry, even when no wing module is
        // installed. This lets the player move both mirrored wings inward.
        wingSpan = Math.max(
            edgeMs + 1,
            expandWing || Math.round(coreWidth * 0.24),
            Math.min(3, Math.max(1, wingNeed)) * edgeMs
        );
        wingSpan = Math.max(2, Math.round(wingSpan * segmentScale.wing.x));

        // Pre-size wing plate from side-mounted modules so left/right stay mirrored
        // and every docked frame stays inside the wing bounds.
        const sideMountIds = [];
        if (L.weapons.length >= 2) {
            L.weapons.slice(L.weapons.length === 2 ? 0 : 1).forEach((id) => {
                sideMountIds.push({ id: id, kind: 'weapon' });
            });
        }
        if (sideMountIds.length) {
            let maxW = edgeMs;
            let leftH = 0;
            let rightH = 0;
            sideMountIds.forEach((item, i) => {
                const d = resolveDim(item.id, item.kind, edgeMs);
                maxW = Math.max(maxW, d.scaleW);
                if (i % 2 === 0) leftH += d.scaleH + (leftH > 0 ? gap : 0);
                else rightH += d.scaleH + (rightH > 0 ? gap : 0);
            });
            wingSpan = Math.max(wingSpan, maxW);
            wingH = Math.max(wingH, leftH, rightH, edgeMs);
        }

        // Absolute Y offsets with visible gaps between front / center / back
        const totalCoreH = frontH + segGap + centerH + segGap + backH;
        const frontY = 0;
        const centerY = frontH + segGap;
        const backY = frontH + segGap + centerH + segGap;
        // Shift scales with the whole hull height (not just the center band).
        // Wings may overhang both hull ends by their own height: pinning them
        // flush to nose and tail left roughly two thirds of the drag range
        // doing nothing, so they could not be swept forward or past the
        // engines at all.
        const wingShiftY = Math.round(totalCoreH * L.wingOffsetY);
        const wingTravel = wingH;
        const wingY = Math.max(
            frontY - wingTravel,
            Math.min(
                Math.max(frontY, totalCoreH - wingH) + wingTravel,
                Math.floor(centerY + (centerH - wingH) / 2 + wingShiftY)
            )
        );
        const wingShiftX = Math.round(coreWidth * L.wingOffsetX);

        return {
            coreWidth, coreHeight, L, ms, gap, evenSize, edgeMs, centerMs, hullMid, parts,
            uv, alignCenter, resolveDim, pushPart, segGap, wingGap, segmentOffset,
            moduleOffset, frontH, backH, centerH, wingSpan, wingH, scaledFrontW,
            scaledCenterW, scaledBackW, scaledFrontX, scaledCenterX, scaledBackX, armorIds,
            shieldIds, drives, systemPods, zoneReplace, centerInserts, expandFront,
            expandBack, insertH, totalCoreH, frontY, centerY, backY, wingY, wingShiftX
        };
    },
});
