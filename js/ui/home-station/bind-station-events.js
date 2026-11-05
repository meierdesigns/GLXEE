"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    /** Cargo teleport, station upgrade tree, unlocks, purchases and crafting. */
    bindStationEvents() {
        const teleport = this.overlay.querySelector('#hsTeleport');
        if (teleport) {
            teleport.addEventListener('click', () => {
                if (typeof profileManager === 'undefined') return;
                if (!profileManager.hasCargo()) {
                    this.playButtonResult(teleport, false, 'CARGO EMPTY');
                    return;
                }
                const moved = profileManager.teleportCargoToStation();
                if (!moved) {
                    this.playButtonResult(teleport, false, 'STATION FULL — UPGRADE STORAGE');
                    return;
                }
                if (profileManager.hasCargo()) {
                    this.playButtonResult(teleport, true, 'PARTIAL TELEPORT — STORAGE FULL');
                } else {
                    this.playButtonResult(teleport, true, 'CARGO TELEPORTED TO STATION');
                }
            });
        }

        this.overlay.querySelectorAll('[data-upgrade-node]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                const id = btn.getAttribute('data-upgrade-node');
                this.selectedUpgradeNode = id;
                if (btn.hasAttribute('data-upgrade')) {
                    return;
                }
                ev.preventDefault();
                const node = (typeof economyConfig !== 'undefined')
                    ? economyConfig.getStationUpgradeNode(id)
                    : null;
                if (!node) return;
                const profile = this.getProfile();
                const level = profileManager.getStationUpgradeLevel(id, profile);
                if (level >= node.maxLevel) {
                    this.playButtonResult(btn, true, node.label + ' · MAX');
                    return;
                }
                const check = profileManager.canUnlockStationUpgrade(id, profile);
                if (check.reason === 'LOCKED') {
                    const req = economyConfig.getStationUpgradeNode(node.requires);
                    const reqName = req ? req.label : String(node.requires || '').toUpperCase();
                    this.playButtonResult(btn, false, 'REQ ' + reqName + ' L' + (node.requireLevel || 1));
                } else if (check.reason === 'RESOURCES') {
                    const cost = check.cost || economyConfig.getStationUpgradeCost(id, level + 1);
                    this.openResourceBuyModal({
                        title: node.label + ' · L' + (level + 1),
                        cost: cost,
                        action: { type: 'station-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, check.reason || node.label);
                }
            });
        });
        this.bindUpgradeTipEvents();

        this.overlay.querySelectorAll('[data-upgrade]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-upgrade');
                this.selectedUpgradeNode = id;
                const res = profileManager.buyStationUpgrade(id);
                if (res.ok) {
                    const node = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeNode(id)
                        : null;
                    const label = node ? node.label : String(id || '').toUpperCase();
                    this.playButtonResult(btn, true, 'UPGRADED: ' + label + ' L' + res.level);
                } else if (res.reason === 'RESOURCES') {
                    const profile = this.getProfile();
                    const node = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeNode(id)
                        : null;
                    const level = profileManager.getStationUpgradeLevel(id, profile);
                    const cost = (typeof economyConfig !== 'undefined')
                        ? economyConfig.getStationUpgradeCost(id, level + 1)
                        : null;
                    this.openResourceBuyModal({
                        title: (node ? node.label : String(id || '').toUpperCase()) + ' · L' + (level + 1),
                        cost: cost,
                        action: { type: 'station-upgrade', id: id }
                    });
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-buy]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy');
                const res = profileManager.buyShip(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('PURCHASED: ' + this.shipName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-bp]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-buy-bp');
                const res = profileManager.buyBlueprint(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('BLUEPRINT: ' + profileManager.getBlueprintName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-part]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-buy-part') || '';
                const sep = raw.indexOf(':');
                const kind = sep === -1 ? '' : raw.slice(0, sep);
                const id = sep === -1 ? raw : raw.slice(sep + 1);
                const res = profileManager.buyPart(kind, id, this.visitPostId || null);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('PART: ' + id.toUpperCase()) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-buy-portal]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-buy-portal');
                const res = profileManager.buyPortal(gid);
                if (res.ok) {
                    const name = String(gid).replace(/_/g, ' ').toUpperCase();
                    this.playButtonResult(btn, true, 'PORTAL UNLOCKED: ' + name);
                } else if (res.reason === 'UNKNOWN FACTION') {
                    this.playButtonResult(btn, false, 'MEET THIS FACTION IN COMBAT FIRST');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'FAILED');
                }
            });
        });

        this.overlay.querySelectorAll('[data-craft]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-craft');
                const res = profileManager.craftBlueprint(id);
                this.playButtonResult(btn, !!res.ok, res.ok ? ('CRAFTED: ' + profileManager.getBlueprintName(id)) : (res.reason || 'FAILED'));
            });
        });

        this.overlay.querySelectorAll('[data-move-to-ship]').forEach((btn) => {
            if (btn.closest('.hs-bay-inv')) return; // hangar bay inventory: physical-item.js owns its clicks/drag
            btn.addEventListener('click', (e) => {
                // A right-click on a <button> still fires a trailing 'click' (button 2) as the
                // browser's own activation behavior, after contextmenu resolves — not just the
                // pointerdown/contextmenu pair bindStorageEquipContextMenu reacts to, so this
                // button-2 click must be rejected here too, or it runs this move instead.
                if (e.button !== 0) return;
                const raw = btn.getAttribute('data-move-to-ship') || '';
                const sep = raw.indexOf(':');
                const bucket = sep === -1 ? '' : raw.slice(0, sep);
                const id = sep === -1 ? raw : raw.slice(sep + 1);
                const shipId = btn.getAttribute('data-ship');
                if (!shipId) {
                    this.playButtonResult(btn, false, 'NO ACTIVE SHIP');
                    return;
                }
                const profile = this.getProfile();
                const res = this._transferStorageItemPreservingLayout(profile, 'station', null, 'ship', shipId, bucket, id);
                this.playButtonResult(btn, !!res.ok, res.ok ? 'MOVED TO SHIP STORAGE' : (res.reason || 'FAILED'));
                if (res.ok) this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-move-to-station]').forEach((btn) => {
            if (btn.closest('.hs-bay-inv')) return; // hangar bay inventory: physical-item.js owns its clicks/drag
            btn.addEventListener('click', (e) => {
                if (e.button !== 0) return; // see the data-move-to-ship handler above
                const raw = btn.getAttribute('data-move-to-station') || '';
                const sep = raw.indexOf(':');
                const bucket = sep === -1 ? '' : raw.slice(0, sep);
                const id = sep === -1 ? raw : raw.slice(sep + 1);
                const shipId = btn.getAttribute('data-ship');
                const profile = this.getProfile();
                const res = this._transferStorageItemPreservingLayout(profile, 'ship', shipId, 'station', null, bucket, id);
                this.playButtonResult(btn, !!res.ok, res.ok ? 'MOVED TO STATION STORAGE' : (res.reason || 'FAILED'));
                if (res.ok) this.createUI();
            });
        });

        this.bindStorageDragAndDrop();
        this.bindStorageEquipContextMenu();
    },

    /** Right-click a part cell in a ship's OWN storage grid (station tab, not the hangar page):
     *  equips it into a free, fitting slot, or unequips it if it's already installed. Never
     *  swaps into an occupied slot and never moves the part between storages. The hangar's own
     *  bay-inventory grid has a similar gesture in physical-item.js, but goes through DOM hangar
     *  slot elements that only exist while the hangar page is open; this grid has none, so it
     *  drives shipLoadoutManager directly from the cell's own data-ship/data-part-kind/-id.
     *  Bound on 'pointerdown' (button 2), not 'contextmenu'/'click': a <button>'s right-click can
     *  fire a trailing synthetic 'click' as its platform default action, which would run the
     *  data-move-to-ship/-station handler bound on this same cell and move it between storages
     *  instead — acting immediately on pointerdown and stopping it there never gives that a chance to fire. */
    bindStorageEquipContextMenu() {
        // Scoped to [data-storage-target="ship"], not just [data-ship]: STATION storage cells
        // carry a data-ship attribute too (the ship a data-move-to-ship click would file it to),
        // which is a different ship than "the ship this part is stored/equipped on" — matching
        // on data-ship alone equipped station items onto the active ship by mistake, making them
        // vanish from the station grid (now equipped elsewhere) with no visible slot to land on.
        this.overlay.querySelectorAll('.hs-storage-grid[data-storage-target="ship"] .hs-storage-cell[data-part-id][data-ship]').forEach((cell) => {
            if (cell.closest('.hs-bay-inv')) return; // physical-item.js already binds these
            cell.addEventListener('contextmenu', (e) => e.preventDefault());
            cell.addEventListener('pointerdown', (e) => {
                if (e.button !== 2) return;
                e.preventDefault();
                e.stopPropagation();
                this._equipFromStorageCell(cell);
            });
        });
    },

    _equipFromStorageCell(cell) {
        if (typeof shipLoadoutManager === 'undefined') return;
        const kind = cell.getAttribute('data-part-kind');
        const id = cell.getAttribute('data-part-id');
        const shipId = cell.getAttribute('data-ship');
        if (!kind || kind === 'blueprint' || !id || !shipId) return;
        const slm = shipLoadoutManager;
        const key = slm.kindToLoadoutKey(kind);
        const caps = slm.getSlotCaps(shipId, slm.resolveModelClass(shipId));
        const cap = key === 'weapons' ? slm.weaponMountSlots(caps.weapons) : Math.max(0, Number(caps[key]) || 0);
        const L = slm.getLoadout(shipId);
        const list = key === 'weapons' ? (L.weaponSlots || L.weapons || []) : (L[key] || []);
        const at = list.indexOf(id);
        if (at !== -1) { this._applyStorageSlotChoice(shipId, kind, at, '', cell, id); return; } // installed: right-click unequips
        const fits = (i) => !slm.partFitsSlot || slm.partFitsSlot(shipId, kind, id, i).ok;
        let target = -1;
        for (let i = 0; i < cap; i++) { if (!(list[i] || null) && fits(i)) { target = i; break; } }
        if (target === -1) { this.playButtonResult(cell, false, 'NO FREE ' + kind.toUpperCase() + ' SLOT'); return; }
        this._applyStorageSlotChoice(shipId, kind, target, id, cell);
    },

    _applyStorageSlotChoice(shipId, kind, slotIndex, moduleId, sourceEl, clearedId) {
        const L = shipLoadoutManager.getLoadout(shipId);
        const key = shipLoadoutManager.kindToLoadoutKey(kind);
        const list = key === 'weapons' ? ((L && (L.weaponSlots || L.weapons)) || []) : ((L && L[key]) || []);
        const prevId = list[slotIndex] || null;
        const replacedId = (moduleId && prevId && prevId !== moduleId) ? prevId : null;
        const res = shipLoadoutManager.setSlotModule(shipId, kind, slotIndex, moduleId);
        if (!res.ok) {
            let msg = 'SLOT UPDATE FAILED';
            if (res.reason === 'NEED_WEAPON') msg = 'NEED AT LEAST ONE WEAPON';
            if (res.reason === 'NEED_ENERGY') msg = 'NEED AN ENERGY CORE';
            if (res.reason === 'NEED_CHARGE_SHOT') msg = 'NEED CHARGE SHOT FIRST';
            if (res.reason === 'NEED_CHARGE_DRIVE') msg = 'NEED CHARGE DRIVE FIRST';
            if (res.reason === 'NO_SLOT') msg = 'NO SLOT';
            if (res.reason === 'TOO_BIG') msg = this.hangarModuleLabel(moduleId) + ' DOESN\'T FIT · UPGRADE THE SLOT';
            if (res.reason === 'AREA_OFF') msg = 'THAT AREA IS OFF';
            this.playButtonResult(sourceEl, false, msg);
            return;
        }
        const profile = this.getProfile ? this.getProfile() : null;
        if (typeof shipConfigManager !== 'undefined' && profile && profile.activeShipId === shipId) {
            shipConfigManager.applyToRuntime(shipId);
        }
        if (profile && typeof profileManager !== 'undefined') {
            const bucket = shipLoadoutManager.kindToLoadoutKey(kind);
            const backId = (!moduleId && clearedId) ? clearedId : replacedId;
            if (backId && profileManager.fileUnequippedPart) {
                profileManager.fileUnequippedPart(profile, shipId, bucket, backId);
            }
            if (moduleId && profileManager.consumeFiledPart) {
                profileManager.consumeFiledPart(profile, shipId, bucket, moduleId);
            }
        }
        const label = moduleId ? (this.hangarModuleLabel(moduleId) + ' EQUIPPED') : 'SLOT CLEARED';
        this.playButtonResult(sourceEl, true, label);
        this.createUI();
    },

    /** Drag-and-drop for the station/ship storage grids: drag an item cell onto the other
     *  storage's grid to move it there (same transfer the move-to-ship/move-to-station buttons do).
     *  Pointer-based, not native HTML5 DnD (same reasoning as the hangar PARTS list: native drag
     *  doesn't reliably fire dragover/drop in this app shell — only the icon follows the cursor). */
    bindStorageDragAndDrop() {
        // The hangar bay-inventory grid (physical-item.js bayInventoryHtml) renders this exact
        // same renderShipStorage() markup for its own item set/positions, but its cells need
        // the hangar's own drag engine (startHangarPartDrag — equips onto a ship slot when
        // dropped on one, falls back to physicalItem.dropInGrid otherwise), not this one.
        // Binding both here would double-attach a pointerdown handler to the same cell.
        this.overlay.querySelectorAll('.hs-storage-cell[data-drag-key]').forEach((cell) => {
            if (cell.closest('.hs-bay-inv')) return;
            cell.setAttribute('draggable', 'false');
            cell.addEventListener('dragstart', (e) => e.preventDefault());
            cell.addEventListener('pointerdown', (ev) => this._storageDragStart(ev, cell));
        });
    },

    _storageDragStart(downEv, cell) {
        if (downEv.button !== undefined && downEv.button !== 0) return;
        const key = cell.getAttribute('data-drag-key') || '';
        const source = cell.getAttribute('data-drag-source') || '';
        const shipId = cell.getAttribute('data-drag-ship') || '';
        if (!key) return;
        const startX = downEv.clientX, startY = downEv.clientY;
        const THRESH = 6;
        let dragging = false;
        let ghost = null;
        const clearDropMarks = () => this.overlay.querySelectorAll('.hs-storage-grid.is-drag-over')
            .forEach((g) => g.classList.remove('is-drag-over'));
        const gridAt = (x, y) => {
            const el = document.elementFromPoint(x, y);
            return el && el.closest ? el.closest('.hs-storage-grid[data-storage-target]') : null;
        };
        // Dragged item's own footprint in grid cells (read off its own "grid-column: span W;
        // grid-row: span H;" inline style — see _storageGridHtml), so the drop preview covers
        // its real size, not just a single cell, for 1x2 / 2x2 items.
        const spanMatch = (css) => {
            const m = (css || '').match(/span\s+(\d+)/);
            return m ? Math.max(1, parseInt(m[1], 10)) : 1;
        };
        const spanW = spanMatch(cell.style.gridColumn);
        const spanH = spanMatch(cell.style.gridRow);
        let hoverCell = null;
        let previewBox = null;
        let previewGrid = null; // the .hs-storage-grid previewBox is currently appended into
        const clearCellMark = () => {
            hoverCell = null;
            if (previewBox) previewBox.style.display = 'none';
        };
        // Preview the drop position: a box the full size of the dragged item's footprint,
        // anchored at the hovered cell's top-left. It's appended as a normal child of the
        // hovered grid itself (not position:fixed) so CSS Grid's own layout places it
        // correctly without any manual zoom/transform math — the station is rendered inside a
        // scaled stage (body carries transform: scale(--stage-scale)), and a fixed-position
        // element's offsetLeft/top don't line up 1:1 with that scaled coordinate space.
        const markDropCell = (x, y) => {
            const el = document.elementFromPoint(x, y);
            // Any storage cell, including the dashed empty placeholders — hovering empty
            // space still previews a valid drop (append to the end of this grid's order).
            const c = el && el.closest ? el.closest('.hs-storage-cell') : null;
            const target = (c && c !== cell) ? c : null;
            if (target === hoverCell) return;
            hoverCell = target;
            if (!target || !previewBox) {
                if (previewBox) previewBox.style.display = 'none';
                return;
            }
            const parentGrid = target.closest('.hs-storage-grid');
            if (parentGrid && parentGrid !== previewGrid) {
                previewGrid = parentGrid;
                previewGrid.appendChild(previewBox);
            }
            if (previewGrid) {
                // offsetLeft/Top are relative to .hs-storage-grid (position:relative) — same
                // coordinate space as this absolute preview, including the grid's own padding.
                previewBox.style.left = target.offsetLeft + 'px';
                previewBox.style.top = target.offsetTop + 'px';
                previewBox.style.display = 'block';
            }
        };
        let place = null; // (x, y) => position the ghost at viewport coords (x, y)
        const startDrag = () => {
            dragging = true;
            cell.classList.add('is-dragging');
            // Reuse the hangar part-grab flag: ui-tooltip.js skips showing a NEW tooltip
            // while this is set. Without it, hovering another slot mid-drag pops a tooltip
            // box right at the cursor, which then eats the elementFromPoint hit-test below
            // — the other slot never "sees" the drag.
            document.body.classList.add('hs-part-grabbing');
            if (typeof uiTooltip !== 'undefined' && uiTooltip && uiTooltip.hide) uiTooltip.hide();
            // The ghost itself is a plain positioning frame, unscaled: its own box is what
            // the zoom-calibration measurement right below reads, so anything that visually
            // shrinks the held item (the .hs-storage-drag-ghost-inner scale()) has to live on
            // a child instead — scaling the measured element corrupts that calibration and the
            // item drifts away from the cursor while dragging.
            ghost = document.createElement('div');
            ghost.className = 'hs-storage-drag-ghost';
            const ghostInner = cell.cloneNode(true);
            ghostInner.classList.add('hs-storage-drag-ghost-inner');
            ghost.appendChild(ghostInner);
            // Inline, not left to CSS: the dev server hot-rebuilds the JS bundle but not
            // the stylesheet, so a stale/missing .hs-storage-drag-ghost rule must not be
            // able to leave this sitting in normal flow (wrong spot) or eating hit-tests
            // (elementFromPoint would hit the ghost itself instead of the drop target).
            ghost.style.cssText = 'position:fixed;left:0;top:0;margin:0;pointer-events:none;z-index:10050;';
            document.body.appendChild(ghost);
            // The station is rendered inside a scaled stage (body carries
            // transform: scale(--stage-scale), possibly combined with a CSS zoom), so
            // a position:fixed element's own box isn't 1 viewport-px per 1 CSS-px.
            // Measure the real ratio instead of assuming it (same trick as the hangar
            // part-grab ghost in hangar-parts-grid-part2.js).
            const o = ghost.getBoundingClientRect();
            ghost.style.left = '100px';
            const k = (ghost.getBoundingClientRect().left - o.left) / 100 || 1;
            place = (x, y) => {
                ghost.style.left = `${(x - o.left) / k - (cell.offsetWidth / 2)}px`;
                ghost.style.top = `${(y - o.top) / k - (cell.offsetHeight / 2)}px`;
            };
            ghost.style.width = cell.offsetWidth + 'px';
            ghost.style.height = cell.offsetHeight + 'px';
            // Drop-position preview: the item itself shown sitting in the hovered tile — no
            // frame or fill, just its own casing — sized to its full footprint (spanW x spanH
            // cells), rather than a plain highlighted box. Appended into whichever grid is
            // hovered, in markDropCell.
            const gcs = getComputedStyle(cell.closest('.hs-storage-grid') || cell);
            const cs = parseFloat(gcs.getPropertyValue('--cs')) || this.STORAGE_CELL_PX;
            const gap = parseFloat(gcs.getPropertyValue('--hs-gap')) || this.STORAGE_GAP_PX;
            previewBox = document.createElement('div');
            previewBox.className = 'hs-storage-cell hs-storage-drop-preview';
            previewBox.style.cssText = 'position:absolute;margin:0;pointer-events:none;z-index:5;box-sizing:border-box;display:none;';
            previewBox.style.width = (spanW * cs + (spanW - 1) * gap) + 'px';
            previewBox.style.height = (spanH * cs + (spanH - 1) * gap) + 'px';
            const previewBody = cell.querySelector('.hs-item-body');
            if (previewBody) previewBox.appendChild(previewBody.cloneNode(true));
        };
        // Coalesce pointer moves to one update per frame, same as the hangar part drag
        // (hangar-parts-grid-part2.js) — the grid hit-test and ghost placement both read layout.
        let rafId = 0;
        let lastMove = null;
        const applyMove = (ev) => {
            if (!dragging) {
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESH) return;
                startDrag();
            }
            if (place) place(ev.clientX, ev.clientY);
            clearDropMarks();
            const grid = gridAt(ev.clientX, ev.clientY);
            if (grid) grid.classList.add('is-drag-over');
            if (grid) markDropCell(ev.clientX, ev.clientY); else clearCellMark();
        };
        const onMove = (ev) => {
            lastMove = ev;
            if (!rafId) rafId = requestAnimationFrame(() => {
                rafId = 0;
                if (lastMove) applyMove(lastMove);
            });
        };
        const cleanup = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            lastMove = null;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onCancel);
            document.removeEventListener('keydown', onEsc, true);
            try {
                if (downEv.target && downEv.target.releasePointerCapture) downEv.target.releasePointerCapture(downEv.pointerId);
            } catch (err) { /* ignore */ }
            cell.classList.remove('is-dragging');
            document.body.classList.remove('hs-part-grabbing');
            clearDropMarks();
            clearCellMark();
            if (ghost) { ghost.remove(); ghost = null; }
            if (previewBox) { previewBox.remove(); previewBox = null; }
        };
        const onUp = (ev) => {
            const wasDragging = dragging;
            const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
            const dropCell = dropEl && dropEl.closest ? dropEl.closest('.hs-storage-cell') : null;
            const droppedOnSelf = dropCell === cell;
            const grid = gridAt(ev.clientX, ev.clientY);
            // Resolve the drop to an absolute (col, row) tile under the cursor — not just
            // "before this other cell" — so the item lands exactly where it was dropped and
            // stays there, the same way the hangar bay-inventory grid pins items.
            const dropTarget = (grid && !droppedOnSelf) ? this._storageGridTarget(grid, cell, ev.clientX, ev.clientY) : null;
            cleanup();
            if (!wasDragging) return;
            // A real drag still ends with a native 'click' on this button (mouseup landed on
            // it, or close enough) — swallow that one click so it doesn't also fire the cell's
            // own action (data-move-to-ship / data-equip-select) on top of the drop just done.
            const suppressClick = (e) => { e.preventDefault(); e.stopPropagation(); };
            cell.addEventListener('click', suppressClick, { capture: true, once: true });
            setTimeout(() => cell.removeEventListener('click', suppressClick, true), 0);
            if (grid && dropTarget) this._storageDragDrop(key, source, shipId, grid, dropTarget);
        };
        const onCancel = () => cleanup();
        const onEsc = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            cleanup();
        };
        // Keep receiving moves even when the pointer leaves the cell (same as the hangar drag).
        try {
            if (downEv.target && downEv.target.setPointerCapture) downEv.target.setPointerCapture(downEv.pointerId);
        } catch (err) { /* ignore */ }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onCancel);
        document.addEventListener('keydown', onEsc, true);
    },

    /** Pixel origin (top-left of grid tile col=1,row=1) and step (one tile + gap) for `grid`,
     *  derived from the grid's own box (left/top + its border + padding) rather than assumed
     *  from the first DOM cell's rect: once any item has a pinned position, the first cell in
     *  DOM order is no longer guaranteed to actually render at (col 1, row 1) — dense
     *  auto-flow only puts unpinned cells there — so calibrating off "the first cell" drifted
     *  the whole grid's coordinate math as soon as one item was pinned anywhere else,
     *  corrupting every other position computed afterwards. The scale factor k (for a station
     *  rendered inside a scaled stage, body carries transform: scale(--stage-scale)) still
     *  comes from comparing a cell's rendered vs. layout width — that part doesn't depend on
     *  which cell or where it sits. Null when the grid has no cells to measure from yet. */
    _storageGridMetrics(grid) {
        const anyCell = grid.querySelector('.hs-storage-cell');
        if (!anyCell) return null;
        const k = anyCell.getBoundingClientRect().width / Math.max(1, anyCell.offsetWidth);
        const gr = grid.getBoundingClientRect();
        const cs = getComputedStyle(grid);
        const originX = gr.left + ((parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0)) * k;
        const originY = gr.top + ((parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0)) * k;
        const cellPx = parseFloat(cs.getPropertyValue('--cs')) || this.STORAGE_CELL_PX;
        const gapPx = parseFloat(cs.getPropertyValue('--hs-gap')) || this.STORAGE_GAP_PX;
        return { originX, originY, step: (cellPx + gapPx) * k };
    },

    /** Resolve a drop point to an absolute (col, row) tile in `grid`, sized to the dragged
     *  cell's own footprint (read off its inline "grid-column: span W" style). `x`/`y` are the
     *  raw cursor position (the pointer's own point, not a dragged box's top-left corner — unlike
     *  the hangar bay-inventory grid's gridTarget, which snaps a box's corner and so rounds to
     *  the nearest grid line), so the containing cell is found with floor, not round: round
     *  measures distance to the nearest cell CENTER and snaps a cursor sitting anywhere in a
     *  cell's first half into the previous column/row — i.e. the item lands next to, not under,
     *  the cursor. Returns null when the point isn't over the grid, or the grid has no cells to
     *  calibrate against. Clamped so multi-cell items never hang off the grid's far edge. */
    _storageGridTarget(grid, draggedCell, x, y) {
        const gr = grid.getBoundingClientRect();
        if (x < gr.left || x > gr.right || y < gr.top || y > gr.bottom) return null;
        const m = this._storageGridMetrics(grid);
        if (!m) return null;
        const spanMatch = (css) => {
            const match = (css || '').match(/span\s+(\d+)/);
            return match ? Math.max(1, parseInt(match[1], 10)) : 1;
        };
        const w = spanMatch(draggedCell.style.gridColumn);
        const h = spanMatch(draggedCell.style.gridRow);
        const cols = Number(grid.getAttribute('data-inv-cols')) || 8;
        const rows = Number(grid.getAttribute('data-inv-rows')) || 99;
        const col = Math.max(1, Math.min(cols - w + 1, Math.floor((x - m.originX) / m.step) + 1));
        const row = Math.max(1, Math.min(rows - h + 1, Math.floor((y - m.originY) / m.step) + 1));
        return { col, row, w, h };
    },

    /** Every item currently shown in `grid`, as {key: {col, row, w, h}} read off its actual
     *  on-screen tile. Called right before committing a drop, before any position changes, so
     *  the rest of the grid can be pinned exactly where it already was. */
    _readStorageLayout(grid) {
        const m = this._storageGridMetrics(grid);
        const layout = {};
        if (!m) return layout;
        const spanMatch = (css) => {
            const match = (css || '').match(/span\s+(\d+)/);
            return match ? Math.max(1, parseInt(match[1], 10)) : 1;
        };
        grid.querySelectorAll('.hs-storage-cell[data-drag-key]').forEach((c) => {
            const r = c.getBoundingClientRect();
            layout[c.getAttribute('data-drag-key')] = {
                col: Math.round((r.left - m.originX) / m.step) + 1,
                row: Math.round((r.top - m.originY) / m.step) + 1,
                w: spanMatch(c.style.gridColumn),
                h: spanMatch(c.style.gridRow)
            };
        });
        return layout;
    },

    _storageDragDrop(key, source, shipId, grid, dropTarget) {
        const sep = key.indexOf(':');
        const bucket = sep === -1 ? '' : key.slice(0, sep);
        const id = sep === -1 ? key : key.slice(sep + 1);
        const target = grid.getAttribute('data-storage-target');
        const targetShip = grid.getAttribute('data-ship') || '';
        const profile = this.getProfile();
        const scope = target === 'ship' ? 'ship' : 'station';
        const scopeShip = target === 'ship' ? targetShip : null;
        if (target === source && targetShip === shipId) {
            // Dropped back onto its own grid: pin it at the exact tile it landed on (manual
            // arrangement only, never an automatic resort). Every other item keeps its tile too
            // — except whichever item(s) the dragged one now overlaps, which swap into the
            // dragged item's OLD tile, so a drop onto an occupied cell trades places instead of
            // just failing to land (which used to look like the grid silently re-sorting).
            const layout = this._readStorageLayout(grid);
            const dragged = layout[key];
            const posByKey = {};
            Object.keys(layout).forEach((k) => {
                if (k === key) return;
                const o = layout[k];
                posByKey[k] = [o.col, o.row];
            });
            if (dragged) {
                const overlaps = Object.keys(layout).filter((k) => {
                    if (k === key) return false;
                    const o = layout[k];
                    return dropTarget.col < o.col + o.w && o.col < dropTarget.col + dropTarget.w
                        && dropTarget.row < o.row + o.h && o.row < dropTarget.row + dropTarget.h;
                });
                overlaps.forEach((k) => { posByKey[k] = [dragged.col, dragged.row]; });
            }
            posByKey[key] = [dropTarget.col, dropTarget.row];
            profileManager.freezeStoragePositions(profile, scope, scopeShip, posByKey);
            this.createUI();
            return;
        }
        if (target === 'ship' && !targetShip) return;
        // Whatever already sits on the dropped-on tile in the OTHER grid swaps back into this
        // item's old tile — same trade-places behaviour as dropping within one grid, just
        // across the station/ship boundary. Read both sides' *full* layouts before anything
        // moves, and pin every item that's staying put (not just the two that trade places):
        // an item the player never dragged has no pinned position of its own, so adding or
        // removing a sibling from its grid would otherwise let dense auto-flow repack it
        // into whatever gap just opened up — a drop quietly resorting the entire grid around it.
        const sourceGrid = this._storageGridEl(source, shipId);
        const sourceLayout = sourceGrid ? this._readStorageLayout(sourceGrid) : {};
        const oldPos = sourceLayout[key] || null;
        const destLayout = this._readStorageLayout(grid);
        const overlapKeys = Object.keys(destLayout).filter((k) => {
            const o = destLayout[k];
            return dropTarget.col < o.col + o.w && o.col < dropTarget.col + dropTarget.w
                && dropTarget.row < o.row + o.h && o.row < dropTarget.row + dropTarget.h;
        });

        const res = this._transferStorageItem(profile, source, shipId, target, targetShip, bucket, id);
        this.setStatus(res.ok ? (target === 'ship' ? 'MOVED TO SHIP STORAGE' : 'MOVED TO STATION STORAGE') : (res.reason || 'FAILED'));
        if (typeof soundManager !== 'undefined') {
            if (res.ok) { if (soundManager.playUIConfirm) soundManager.playUIConfirm(); }
            else if (soundManager.playUIDeny) soundManager.playUIDeny();
        }
        if (!res.ok) return;
        const pinnedKey = res.instanceKey || key;
        // Everything left behind in the source grid keeps its tile.
        Object.keys(sourceLayout).forEach((k) => {
            if (k === key) return;
            profileManager.setStoragePos(profile, source === 'ship' ? 'ship' : 'station', source === 'ship' ? shipId : null, k, sourceLayout[k].col, sourceLayout[k].row);
        });
        // Everything already in the destination grid keeps its tile too, except what's being
        // swapped out.
        Object.keys(destLayout).forEach((k) => {
            if (overlapKeys.indexOf(k) !== -1) return;
            profileManager.setStoragePos(profile, scope, scopeShip, k, destLayout[k].col, destLayout[k].row);
        });
        profileManager.setStoragePos(profile, scope, scopeShip, pinnedKey, dropTarget.col, dropTarget.row);
        if (oldPos && overlapKeys.length) {
            overlapKeys.forEach((ok) => {
                const osep = ok.indexOf(':');
                const obucket = osep === -1 ? '' : ok.slice(0, osep);
                const oid = osep === -1 ? ok : ok.slice(osep + 1);
                const swapRes = this._transferStorageItem(profile, target, targetShip, source, shipId, obucket, oid);
                if (swapRes.ok) {
                    const swapKey = swapRes.instanceKey || ok;
                    profileManager.setStoragePos(profile, source === 'ship' ? 'ship' : 'station', source === 'ship' ? shipId : null, swapKey, oldPos.col, oldPos.row);
                }
            });
        }
        profileManager.save();
        this.createUI();
    },

    /** The live .hs-storage-grid element for one storage scope, or null if not currently
     *  rendered (e.g. a ship panel that's scrolled out / collapsed). */
    _storageGridEl(scope, shipId) {
        if (!this.overlay) return null;
        return scope === 'ship'
            ? this.overlay.querySelector(`.hs-storage-grid[data-storage-target="ship"][data-ship="${shipId}"]`)
            : this.overlay.querySelector('.hs-storage-grid[data-storage-target="station"]');
    },

    /** Move one unit of bucket/id from one storage scope to another ('station' or 'ship'
     *  + shipId), reusing ProfileManager's move-to-ship/move-to-station API. A same-ship
     *  no-op is skipped; ship-to-ship hops through station storage (no direct API for that).
     *  Instance ids (`defId#unit`) strip to defId for the ledger, then remap upgrade bags
     *  so that specific copy keeps its EQUIPMENT levels. */
    _transferStorageItem(profile, fromScope, fromShip, toScope, toShip, bucket, id) {
        if (fromScope === toScope && (fromScope !== 'ship' || fromShip === toShip)) return { ok: true };
        const parsed = (profileManager.parsePartInstanceId)
            ? profileManager.parsePartInstanceId(id)
            : { defId: id, unit: null };
        const defId = parsed.defId || id;
        const movedUnit = parsed.unit;
        let res;
        if (fromScope === 'ship' && toScope === 'ship') {
            const r = profileManager.moveToStationStorage(profile, fromShip, bucket, defId, 1);
            res = r.ok ? profileManager.moveToShipStorage(profile, toShip, bucket, defId, 1) : r;
        } else if (toScope === 'ship') {
            res = profileManager.moveToShipStorage(profile, toShip, bucket, defId, 1);
        } else {
            res = profileManager.moveToStationStorage(profile, fromShip, bucket, defId, 1);
        }
        if (res && res.ok && movedUnit != null && bucket !== 'blueprints'
            && profileManager.remapPartInstanceUpgrades && profileManager.getPartInstanceLayout) {
            const layout = profileManager.getPartInstanceLayout(profile, bucket, defId);
            let toIndex = movedUnit;
            if (toScope === 'ship') {
                const units = (layout.ships && layout.ships[toShip]) || [];
                if (units.length) toIndex = units[units.length - 1];
            } else if (layout.station && layout.station.length) {
                toIndex = layout.station[layout.station.length - 1];
            }
            profileManager.remapPartInstanceUpgrades(profile, bucket, defId, movedUnit, toIndex);
            res.instanceKey = bucket + ':' + defId + '#' + toIndex;
        } else if (res && res.ok) {
            res.instanceKey = bucket + ':' + defId + (movedUnit != null ? '#' + movedUnit : '');
        }
        return res;
    },

    /** Same transfer as _transferStorageItem, but pins every item that's staying in either
     *  grid at its current tile first — so the MOVE TO SHIP/STATION STORAGE buttons (which
     *  have no drop target of their own to swap into) don't let the rest of the grid quietly
     *  reflow around the one item that just arrived or left, same as a drag. */
    _transferStorageItemPreservingLayout(profile, fromScope, fromShip, toScope, toShip, bucket, id) {
        const fromGrid = this._storageGridEl(fromScope, fromShip);
        const toGrid = this._storageGridEl(toScope, toShip);
        const fromLayout = fromGrid ? this._readStorageLayout(fromGrid) : {};
        const toLayout = toGrid ? this._readStorageLayout(toGrid) : {};
        const oldKey = bucket + ':' + id;
        const res = this._transferStorageItem(profile, fromScope, fromShip, toScope, toShip, bucket, id);
        if (!res.ok) return res;
        Object.keys(fromLayout).forEach((k) => {
            if (k === oldKey) return;
            profileManager.setStoragePos(profile, fromScope === 'ship' ? 'ship' : 'station', fromScope === 'ship' ? fromShip : null, k, fromLayout[k].col, fromLayout[k].row);
        });
        Object.keys(toLayout).forEach((k) => {
            profileManager.setStoragePos(profile, toScope === 'ship' ? 'ship' : 'station', toScope === 'ship' ? toShip : null, k, toLayout[k].col, toLayout[k].row);
        });
        profileManager.save();
        return res;
    },

    /** Hangar ship list, anatomy reset, module toggles, fire modes and test area. */
    bindHangarTabEvents() {
        this.overlay.querySelectorAll('[data-hangar-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const selectedShipId = btn.getAttribute('data-hangar-ship');
                if (selectedShipId === this.hangarShipId) return;
                this.hangarShipId = selectedShipId;
                this.statusMsg = '';
                this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-hangar-sidebar]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.toggleHangarSidebar(btn.getAttribute('data-hangar-sidebar'));
            });
        });
        // A collapsed live-preview strip opens from a click anywhere on it.
        const collapsedPreview = this.overlay.querySelector('.hs-hangar-split.hs-hangar-right-collapsed > .hs-hangar-preview');
        if (collapsedPreview) {
            collapsedPreview.style.cursor = 'pointer';
            collapsedPreview.addEventListener('click', (e) => {
                if (e.target.closest('[data-hangar-sidebar]')) return; // the button handles itself
                this.toggleHangarSidebar('right');
            });
        }
        const resetAnatomy = this.overlay.querySelector('#hsResetAnatomy');
        if (resetAnatomy) resetAnatomy.addEventListener('click', () => this.resetHangarAnatomy());
        const saveAnatomy = this.overlay.querySelector('#hsSaveAnatomyDefault');
        if (saveAnatomy) saveAnatomy.addEventListener('click', () => this.saveHangarAnatomyDefault());
        this.overlay.querySelectorAll('[data-activate-ship]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-activate-ship');
                if (typeof profileManager !== 'undefined' && profileManager.setActiveShip) {
                    profileManager.setActiveShip(id);
                } else if (typeof profileManager !== 'undefined') {
                    const p = profileManager.getActiveProfile();
                    if (p) {
                        p.activeShipId = id;
                        profileManager.save();
                    }
                }
                if (typeof shipConfigManager !== 'undefined') {
                    shipConfigManager.applyToRuntime(id);
                }
                this.playButtonResult(btn, true, 'ACTIVE: ' + this.shipName(id));
            });
        });

        this.overlay.querySelectorAll('[data-toggle-mod]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const kind = btn.getAttribute('data-toggle-mod');
                const modId = btn.getAttribute('data-mod-id');
                if (e.altKey || e.shiftKey) {
                    e.preventDefault();
                    this.openComponentEditorForModule(kind, modId);
                    return;
                }
                if (typeof shipLoadoutManager === 'undefined') return;
                const check = shipLoadoutManager.canInstallModule(this.hangarShipId, kind, modId);
                if (!check.ok && !check.removing) {
                    let msg = 'SLOT FULL — UPGRADE FRAME';
                    if (check.reason === 'NEED_CHARGE_SHOT') msg = 'NEED CHARGE SHOT FIRST';
                    if (check.reason === 'NEED_CHARGE_DRIVE') msg = 'NEED CHARGE DRIVE FIRST';
                    this.playButtonResult(btn, false, msg);
                    return;
                }
                shipLoadoutManager.toggleModule(this.hangarShipId, kind, modId);
                if (typeof shipConfigManager !== 'undefined') {
                    const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                        ? profileManager.getActiveProfile().activeShipId
                        : this.hangarShipId;
                    if (active === this.hangarShipId) {
                        shipConfigManager.applyToRuntime(this.hangarShipId);
                    }
                }
                const L = shipLoadoutManager.getLoadout(this.hangarShipId);
                const n = shipLoadoutManager.moduleCount(L);
                this.playButtonResult(btn, true, 'LOADOUT UPDATED · ' + n + ' MODULES');
            });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const kind = btn.getAttribute('data-toggle-mod');
                const modId = btn.getAttribute('data-mod-id');
                this.openComponentEditorForModule(kind, modId);
            });
        });

        // Main voxel size slider in the hangar header: live redraw, and keep
        // the other voxel sliders (area panels) in step.
        this.overlay.querySelectorAll('[data-hangar-voxel]').forEach((input) => {
            input.addEventListener('input', () => {
                if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.setVoxelScale) return;
                const value = Number(input.value);
                shipLoadoutManager.setVoxelScale(this.hangarShipId, value);
                const out = this.overlay.querySelector('[data-hangar-voxel-out]');
                if (out) out.textContent = value.toFixed(2) + '×';
                this.overlay.querySelectorAll('[data-voxel-scale]').forEach((other) => {
                    if (other !== input) other.value = String(value);
                });
                this.drawHangarBay();
            });
        });

        // Zoom buttons in the bay (the mouse wheel zooms too).
        const zoomSlider = this.overlay.querySelector('#hsBayZoomSlider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', () => this.hangarBayZoomStep('set', zoomSlider.value));
            this.syncHangarZoomSlider();
        }
        this.overlay.querySelectorAll('[data-bay-zoom]').forEach((btn) => {
            btn.addEventListener('click', () => this.hangarBayZoomStep(btn.getAttribute('data-bay-zoom')));
        });

        const openTest = this.overlay.querySelector('#hsOpenTestArea');
        if (openTest) {
            openTest.addEventListener('click', () => this.openHangarTestArea());
        }
    },

    /**
     * Ship fire mode (AUTO / CHARGE), set from the weapon details panel.
     * Returns true when the mode was applied.
     */
    setHangarFireMode(mode, btn) {
        if (typeof shipLoadoutManager === 'undefined') return false;
        if (mode === 'charge' && !shipLoadoutManager.ownsChargePart('ability', 'charge_shot')) {
            this.playButtonResult(btn, false, 'BUY CHARGE SHOT IN PARTS SHOP');
            return false;
        }
        const before = shipLoadoutManager.getLoadout(this.hangarShipId);
        shipLoadoutManager.setFireMode(this.hangarShipId, mode);
        const after = shipLoadoutManager.getLoadout(this.hangarShipId);
        if (mode === 'charge' && (after.abilities || []).indexOf('charge_shot') === -1) {
            this.playButtonResult(btn, false, 'NO ABILITY SLOT — UPGRADE FRAME');
            return false;
        }
        if (typeof shipConfigManager !== 'undefined') {
            const active = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile())
                ? profileManager.getActiveProfile().activeShipId
                : this.hangarShipId;
            if (active === this.hangarShipId) {
                shipConfigManager.applyToRuntime(this.hangarShipId);
            }
        }
        if (typeof bulletManager !== 'undefined' && bulletManager.setFireMode) {
            bulletManager.setFireMode(after.fireMode || 'auto');
        }
        if (typeof chargeSystem !== 'undefined' && typeof shipConfigManager !== 'undefined') {
            const model = shipConfigManager.getMergedModel(this.hangarShipId);
            if (model) chargeSystem.syncFromShipModel(model);
        }
        void before;
        this.playButtonResult(btn, true, 'FIRE MODE: ' + String(after.fireMode || 'auto').toUpperCase());
        return true;
    },
});
