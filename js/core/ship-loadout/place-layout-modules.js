"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
    /** buildLayout phase 2: place weapons, center stack and aft modules (may grow wings). */
    placeLayoutModules(ctx) {
        const { coreWidth, L, ms, gap, evenSize, hullMid, alignCenter,
            resolveDim, pushPart, wingGap, frontH, backH, centerH, armorIds, shieldIds,
            drives, systemPods, centerInserts, insertH, totalCoreH, frontY, centerY, backY,
            wingY, wingShiftX } = ctx;

        // Slot base size follows the part it mounts on (a share of that
        // part's width and height) instead of one fixed module size, so
        // small parts get small mounts and big parts get big ones.
        const fitBase = (w, h) => evenSize(Math.max(4, Math.min(ms * 2, w, h)));
        const noseMs = fitBase(ctx.scaledFrontW * 0.55, frontH * 0.7);
        const wingPerSide = Math.max(1, Math.ceil(Math.max(0, L.weapons.length - (L.weapons.length === 2 ? 0 : 1)) / 2));
        const wingMs = fitBase(ctx.wingSpan * 0.7, (ctx.wingH * 0.8) / wingPerSide);
        const aftCount = Math.max(1, systemPods.length, drives.length);
        const aftRows = (systemPods.length ? 1 : 0) + (drives.length ? 1 : 0) || 1;
        const aftMs = fitBase((ctx.scaledBackW * 0.8) / aftCount, (backH * 0.9) / aftRows);
        const coreMs = fitBase(ctx.scaledCenterW * 0.6, centerH);

        const placeRow = (ids, kind, y, centerX, face, size) => {
            if (!ids.length) return;
            const base = size != null ? size : ms;
            const dims = ids.map((id) => resolveDim(id, kind, base));
            const rowW0 = dims.reduce((sum, d) => sum + d.w, 0)
                + Math.max(0, dims.length - 1) * gap;
            let cursor = centerX - rowW0 / 2;
            const maxH = dims.reduce((m, d) => Math.max(m, d.h), base);
            dims.forEach((d, i) => {
                const cx = cursor + d.w / 2;
                // Dock vertically: 'up' sits on the bottom of the band, 'down' on top.
                const cy = face === 'up'
                    ? y + maxH - d.h / 2
                    : (face === 'down' ? y + d.h / 2 : y + maxH / 2);
                pushPart(ids[i], kind, alignCenter(cx, d.w), alignCenter(cy, d.h), face, d.w, d.h, {
                    scaleW: d.scaleW,
                    scaleH: d.scaleH
                });
                cursor += d.w + gap;
            });
        };

        const placeSideColumns = (ids, kind, startY, preferTop, size) => {
            if (!ids.length) return;
            const base = size != null ? size : ms;
            const left = [];
            const right = [];
            ids.forEach((id, i) => {
                (i % 2 === 0 ? left : right).push(id);
            });
            const leftDims = left.map((id) => resolveDim(id, kind, base));
            const rightDims = right.map((id) => resolveDim(id, kind, base));
            const leftH = leftDims.reduce((sum, d) => sum + d.h, 0)
                + Math.max(0, leftDims.length - 1) * gap;
            const rightH = rightDims.reduce((sum, d) => sum + d.h, 0)
                + Math.max(0, rightDims.length - 1) * gap;
            const pairedH = Math.max(leftH, rightH);
            // Hull spans frontY..hullBottom (body-anchored layout).
            const hullTop = frontY;
            const hullEnd = ctx.hullBottom != null ? ctx.hullBottom : totalCoreH;
            const pairedStartY = preferTop
                ? Math.max(hullTop, Math.min(startY, hullEnd - pairedH))
                : Math.max(hullTop, Math.min(
                    startY != null ? startY : Math.floor((hullTop + hullEnd - pairedH) / 2),
                    hullEnd - pairedH
                ));
            const placeSide = (sideIds, sideDims, face) => {
                if (!sideIds.length) return;
                const maxW = sideDims.reduce((m, d) => Math.max(m, d.scaleW), base);
                ctx.wingSpan = Math.max(ctx.wingSpan, maxW);
                ctx.wingH = Math.max(ctx.wingH, pairedH, sideDims.reduce((m, d) => Math.max(m, d.scaleH), 0));
                const wingX = face === 'left'
                    ? -ctx.wingSpan - wingGap - wingShiftX
                    : coreWidth + wingGap + wingShiftX;
                let slotY = pairedStartY;
                if (sideDims.length < 2) {
                    slotY += Math.floor((pairedH - sideDims[0].h) / 2);
                }
                sideIds.forEach((id, i) => {
                    const d = sideDims[i];
                    // Dock at the hull root of the wing plate.
                    const x = face === 'left'
                        ? wingX + ctx.wingSpan - d.w
                        : wingX;
                    const y = slotY;
                    pushPart(id, kind, x, y, face, d.w, d.h, {
                        scaleW: d.scaleW,
                        scaleH: d.scaleH
                    });
                    slotY += d.h + gap;
                });
            };
            placeSide(left, leftDims, 'left');
            placeSide(right, rightDims, 'right');
        };

        // Weapons: 1 → front tip; 2 → wings; 3+ → nose + wings
        if (L.weapons.length <= 1) {
            placeRow(
                L.weapons,
                'weapon',
                frontY + Math.max(0, frontH - noseMs),
                hullMid,
                'up',
                noseMs
            );
        } else if (L.weapons.length === 2) {
            placeSideColumns(
                L.weapons,
                'weapon',
                Math.floor(wingY + (ctx.wingH - wingMs) / 2),
                false,
                wingMs
            );
        } else {
            placeRow(
                L.weapons.slice(0, 1),
                'weapon',
                frontY + Math.max(0, frontH - noseMs),
                hullMid,
                'up',
                noseMs
            );
            placeSideColumns(
                L.weapons.slice(1),
                'weapon',
                Math.floor(wingY + (ctx.wingH - wingMs) / 2),
                false,
                wingMs
            );
        }

        // Center inserts (reactor layers etc.) then defense / energy attach stack
        let insertCursor = centerY + Math.floor((centerH - insertH) / 2);
        centerInserts.forEach((it) => {
            const d = resolveDim(it.id, it.kind, coreMs);
            pushPart(
                it.id,
                it.kind,
                alignCenter(hullMid, d.w),
                alignCenter(insertCursor + it.size / 2, d.h),
                'center',
                d.w,
                d.h,
                { integrate: 'insert', zone: 'center', scaleW: d.scaleW, scaleH: d.scaleH }
            );
            insertCursor += it.size + gap;
        });

        // Defense modules stack on the centerline (horizontal middle of the hull).
        // Armor no longer rides the wings — shields and plating share the core band.
        const attachCenter = [];
        armorIds.forEach((id) => {
            attachCenter.push({ id: id, kind: 'defense' });
        });
        shieldIds.forEach((id) => {
            if (this.getModuleIntegration('defense', id).mode === 'attach') {
                attachCenter.push({ id: id, kind: 'defense' });
            }
        });
        L.energy.forEach((id) => {
            if (this.getModuleIntegration('energy', id).mode === 'attach') {
                attachCenter.push({ id: id, kind: 'energy' });
            }
        });
        if (attachCenter.length) {
            let fitMs = coreMs;
            const n = attachCenter.length;
            while (fitMs > 4 && (n * fitMs + Math.max(0, n - 1) * gap) > centerH) {
                fitMs = evenSize(fitMs - 2);
            }
            let slotY = centerY + Math.floor((centerH - (n * fitMs + Math.max(0, n - 1) * gap)) / 2);
            attachCenter.forEach((item) => {
                const d = resolveDim(item.id, item.kind, fitMs);
                pushPart(
                    item.id,
                    item.kind,
                    alignCenter(hullMid, d.w),
                    alignCenter(slotY + d.h / 2, d.h),
                    'center',
                    d.w,
                    d.h,
                    { scaleW: d.scaleW, scaleH: d.scaleH }
                );
                slotY += Math.max(fitMs, d.h) + gap;
            });
        }

        // Aft pods / drives
        let aftY = backY + Math.max(0, backH - Math.max(2, Math.floor(aftMs * 0.35)));
        if (systemPods.length) {
            placeRow(systemPods, 'ability', aftY, hullMid, 'down', aftMs);
            aftY += aftMs + gap;
        }
        if (drives.length) {
            placeRow(drives, 'ability', aftY, hullMid, 'down', aftMs);
        }
    },

    /** buildLayout phase 3: segment frames in layout coords (before bbox normalize). */
    buildLayoutSegments(ctx) {
        const { coreWidth, uv, wingGap, frontH, backH, centerH, wingSpan, wingH,
            scaledFrontW, scaledCenterW, scaledBackW, scaledFrontX, scaledCenterX,
            scaledBackX, zoneReplace, centerInserts, frontY, centerY, backY, wingY,
            wingShiftX } = ctx;

        const wingPanels = wingSpan > 0 ? [
            { side: 'left', x: -wingSpan - wingGap - wingShiftX, y: wingY, width: wingSpan, height: wingH },
            { side: 'right', x: coreWidth + wingGap + wingShiftX, y: wingY, width: wingSpan, height: wingH }
        ] : [];

        const segments = [
            {
                id: 'back',
                x: scaledBackX,
                y: backY,
                width: scaledBackW,
                height: backH,
                mirror: false,
                uv: uv.back,
                replace: zoneReplace.back
            },
            {
                id: 'center',
                x: scaledCenterX,
                y: centerY,
                width: scaledCenterW,
                height: centerH,
                mirror: false,
                uv: uv.center,
                replace: zoneReplace.center,
                inserts: centerInserts.slice()
            },
            {
                id: 'front',
                x: scaledFrontX,
                y: frontY,
                width: scaledFrontW,
                height: frontH,
                mirror: false,
                uv: uv.front,
                replace: zoneReplace.front
            },
            ...(wingSpan > 0 ? [
                {
                    id: 'wingLeft',
                    x: -wingSpan - wingGap - wingShiftX,
                    y: wingY,
                    width: wingSpan,
                    height: wingH,
                    mirror: false,
                    uv: uv.wing,
                    replace: zoneReplace.wing
                },
                {
                    id: 'wingRight',
                    x: coreWidth + wingGap + wingShiftX,
                    y: wingY,
                    width: wingSpan,
                    height: wingH,
                    mirror: true,
                    uv: uv.wing,
                    replace: zoneReplace.wing
                }
            ] : [])
        ];

        return { segments: segments, wingPanels: wingPanels };
    },
});
