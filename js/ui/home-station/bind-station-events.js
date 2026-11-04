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
            btn.addEventListener('click', () => {
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
                const res = profileManager.moveToShipStorage(profile, shipId, bucket, id, 1);
                this.playButtonResult(btn, !!res.ok, res.ok ? 'MOVED TO SHIP STORAGE' : (res.reason || 'FAILED'));
                if (res.ok) this.createUI();
            });
        });

        this.overlay.querySelectorAll('[data-move-to-station]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-move-to-station') || '';
                const sep = raw.indexOf(':');
                const bucket = sep === -1 ? '' : raw.slice(0, sep);
                const id = sep === -1 ? raw : raw.slice(sep + 1);
                const shipId = btn.getAttribute('data-ship');
                const profile = this.getProfile();
                const res = profileManager.moveToStationStorage(profile, shipId, bucket, id, 1);
                this.playButtonResult(btn, !!res.ok, res.ok ? 'MOVED TO STATION STORAGE' : (res.reason || 'FAILED'));
                if (res.ok) this.createUI();
            });
        });

        this.bindStorageDragAndDrop();
    },

    /** Drag-and-drop for the station/ship storage grids: drag an item cell onto the other
     *  storage's grid to move it there (same transfer the move-to-ship/move-to-station buttons do).
     *  Pointer-based, not native HTML5 DnD (same reasoning as the hangar PARTS list: native drag
     *  doesn't reliably fire dragover/drop in this app shell — only the icon follows the cursor). */
    bindStorageDragAndDrop() {
        this.overlay.querySelectorAll('.hs-storage-cell[data-drag-key]').forEach((cell) => {
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
                if (!previewGrid.style.position) previewGrid.style.position = 'relative';
                previewGrid.appendChild(previewBox);
            }
            if (previewGrid) {
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
            ghost = cell.cloneNode(true);
            ghost.classList.add('hs-storage-drag-ghost');
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
            // Drop-position preview box, sized to the dragged item's full footprint (spanW x
            // spanH cells). Appended into whichever grid is hovered, in markDropCell.
            const cs = this.STORAGE_CELL_PX;
            previewBox = document.createElement('div');
            previewBox.style.cssText = 'position:absolute;margin:0;pointer-events:none;' +
                'z-index:5;box-sizing:border-box;border:2px solid var(--color-primary, #8cf);' +
                'background:rgba(140,200,255,0.18);border-radius:4px;display:none;';
            previewBox.style.width = (spanW * cs + (spanW - 1) * 4) + 'px';
            previewBox.style.height = (spanH * cs + (spanH - 1) * 4) + 'px';
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
            // Read the drop cell before cleanup() clears the mark/ghost, so we know
            // which cell the item should land before (not just which grid).
            const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
            // Any storage cell counts as a drop target now, including the dashed empty
            // placeholders (they carry no data-drag-key, so they resolve to "append to end").
            const dropCell = dropEl && dropEl.closest ? dropEl.closest('.hs-storage-cell') : null;
            const droppedOnSelf = dropCell === cell;
            const dropBeforeKey = (dropCell && !droppedOnSelf) ? dropCell.getAttribute('data-drag-key') : null;
            cleanup();
            if (!wasDragging) return;
            // A real drag still ends with a native 'click' on this button (mouseup landed on
            // it, or close enough) — swallow that one click so it doesn't also fire the cell's
            // own action (data-move-to-ship / data-equip-select) on top of the drop just done.
            const suppressClick = (e) => { e.preventDefault(); e.stopPropagation(); };
            cell.addEventListener('click', suppressClick, { capture: true, once: true });
            setTimeout(() => cell.removeEventListener('click', suppressClick, true), 0);
            const grid = gridAt(ev.clientX, ev.clientY);
            if (grid) this._storageDragDrop(key, source, shipId, grid, dropBeforeKey, droppedOnSelf);
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

    _storageDragDrop(key, source, shipId, grid, beforeKey, droppedOnSelf) {
        const sep = key.indexOf(':');
        const bucket = sep === -1 ? '' : key.slice(0, sep);
        const id = sep === -1 ? key : key.slice(sep + 1);
        const target = grid.getAttribute('data-storage-target');
        const targetShip = grid.getAttribute('data-ship') || '';
        const profile = this.getProfile();
        if (target === source && targetShip === shipId) {
            // Dropped back onto its own grid: reorder in place (manual arrangement only,
            // never an automatic resort) instead of transferring. beforeKey is null both for
            // "dropped on empty space" (append to the end) and "dropped on itself" — only the
            // latter is a true no-op, so that case alone is skipped.
            if (!droppedOnSelf) {
                profileManager.reorderStorage(profile, target, target === 'ship' ? targetShip : null, key, beforeKey);
                this.createUI();
            }
            return;
        }
        let res;
        if (target === 'ship' && source === 'ship') {
            // Ship-to-ship: hop through station storage (no direct ship-to-ship transfer API).
            res = profileManager.moveToStationStorage(profile, shipId, bucket, id, 1);
            if (res.ok) res = profileManager.moveToShipStorage(profile, targetShip, bucket, id, 1);
        } else if (target === 'ship') {
            if (!targetShip) return;
            res = profileManager.moveToShipStorage(profile, targetShip, bucket, id, 1);
        } else {
            const srcShip = source === 'ship' ? shipId : targetShip;
            res = profileManager.moveToStationStorage(profile, srcShip, bucket, id, 1);
        }
        this.setStatus(res.ok ? (target === 'ship' ? 'MOVED TO SHIP STORAGE' : 'MOVED TO STATION STORAGE') : (res.reason || 'FAILED'));
        if (typeof soundManager !== 'undefined') {
            if (res.ok) { if (soundManager.playUIConfirm) soundManager.playUIConfirm(); }
            else if (soundManager.playUIDeny) soundManager.playUIDeny();
        }
        if (res.ok) this.createUI();
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
