"use strict";

// GameControlSystem methods, split from game-control-system.js.
extendClass(GameControlSystem, {
    showVictoryOverlay() {
        // Hide start screen to prevent input conflicts
        if (typeof startScreenManager !== 'undefined') {
            startScreenManager.hide();
        }

        // Hide side HUD clusters
        const leftCluster = document.getElementById('gameLeftCluster');
        if (leftCluster) {
            leftCluster.style.display = 'none';
        }

        const rightCluster = document.getElementById('gameRightCluster');
        if (rightCluster) {
            rightCluster.style.display = 'none';
        }

        // Create / refresh victory overlay layout
        let victoryOverlay = document.getElementById('victoryOverlay');
        // Template: next + shop + leave; ambush/boss hide leave after paint.
        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuItems = ['nextLevel', 'shop', 'levelSelection'];
        }
        const existingBtns = victoryOverlay
            ? victoryOverlay.querySelectorAll('.victory-button').length
            : 0;
        // Rebuild when missing, or when stale HTML lacks the shop button.
        const needsBuild = !victoryOverlay
            || !document.getElementById('victoryLootList')
            || !document.getElementById('victoryLootCredits')
            || !document.getElementById('victoryLoadoutList')
            || existingBtns !== 3
            || !victoryOverlay.querySelector('.victory-button[data-action="nextLevel"]')
            || !victoryOverlay.querySelector('.victory-button[data-action="shop"]');
        if (!victoryOverlay) {
            victoryOverlay = document.createElement('div');
            victoryOverlay.id = 'victoryOverlay';
            victoryOverlay.className = 'victory-screen';
            document.body.appendChild(victoryOverlay);
        }
        if (needsBuild) {
            victoryOverlay.innerHTML = `
                <div class="victory-content">
                    <div class="victory-header">
                        <h1 class="victory-title">VICTORY!</h1>
                        <p class="victory-subtitle">Mission Accomplished</p>
                    </div>

                    <div class="victory-stats">
                        <div class="stat-item" title="Score">
                            <span class="stat-icon" data-icon="navTrophy" aria-label="Score"></span>
                            <span class="stat-value" id="victoryScore">0</span>
                        </div>
                        <div class="stat-item" title="Time">
                            <span class="stat-icon" data-icon="navClock" aria-label="Time"></span>
                            <span class="stat-value" id="victoryTime">00:00</span>
                        </div>
                        <div class="stat-item" title="Enemies">
                            <span class="stat-icon" data-icon="navSkull" aria-label="Enemies"></span>
                            <span class="stat-value" id="victoryEnemies">0</span>
                        </div>
                    </div>

                    <div class="victory-body">
                        <div class="victory-panels" style="display:flex !important;flex-direction:row !important;width:100% !important;gap:12px !important;align-items:stretch !important;">
                            <div class="victory-loot" id="victoryLoot" style="flex:1 1 0 !important;width:0 !important;min-width:0 !important;box-sizing:border-box !important;overflow-x:auto !important;">
                                <div class="victory-loot-title">
                                    <span>FOUND ITEMS</span>
                                    <span class="victory-loot-credits" id="victoryLootCredits"></span>
                                </div>
                                <div class="victory-loot-list" id="victoryLootList"></div>
                            </div>

                            <div class="victory-loadout" id="victoryLoadout" style="flex:1 1 0 !important;width:0 !important;min-width:0 !important;box-sizing:border-box !important;overflow-x:auto !important;">
                                <div class="victory-loot-title"><span>SHIP LOADOUT</span></div>
                                <div class="victory-loadout-list" id="victoryLoadoutList"></div>
                            </div>
                        </div>

                        <div class="victory-buttons">
                            <button type="button" class="victory-button" data-index="0" data-action="nextLevel" id="victoryNextButton" tabindex="-1">
                                <span class="button-icon" data-icon="menuStart"></span>
                                <span class="button-text">NEXT STAGE</span>
                            </button>
                            <button type="button" class="victory-button" data-index="1" data-action="shop" id="victoryShopButton" tabindex="-1">
                                <span class="button-icon" data-icon="hsShop"></span>
                                <span class="button-text">SHOP</span>
                            </button>
                            <button type="button" class="victory-button" data-index="2" data-action="levelSelection" tabindex="-1">
                                <span class="button-icon" data-icon="menuPlanets"></span>
                                <span class="button-text">Leave Planet</span>
                            </button>
                        </div>
                    </div>

                    <div class="victory-instructions">
                        <p>ARROW KEYS: Navigate | ENTER: Select</p>
                    </div>
                </div>
            `;
            victoryOverlay.dataset.bound = '';
        }
        victoryOverlay.classList.remove('hidden');
        // Retrigger panel entrance (CSS animation) on every show.
        const panel = victoryOverlay.querySelector('.victory-content');
        if (panel) {
            panel.style.animation = 'none';
            void panel.offsetWidth;
            panel.style.animation = '';
        }
        this.applyVictoryFactionFlavor(victoryOverlay);
        this.applyVictoryPixelIcons(victoryOverlay);

        if (!victoryOverlay.dataset.bound) {
            this.bindVictoryButtons(victoryOverlay);
            victoryOverlay.dataset.bound = '1';
        }
        this.bindVictoryLootList(victoryOverlay);

        this.updateVictoryNextButton();
        this.cancelVictoryAutoReturn();

        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuIndex = 0;
            uiManager.updateVictoryMenuDisplay();
        }

        this.updateVictoryStats();
        if (this.applyOutcomeStepper) this.applyOutcomeStepper(victoryOverlay.querySelector('.victory-header'), 'won');

        if (typeof VFBgMouseParallax !== 'undefined' && VFBgMouseParallax.refresh) {
            VFBgMouseParallax.refresh();
        }
        this.persistEndScreen('victory', { endLoot: this.lastVictoryLoot || null });
    },

    /** Faction-specific victory wording; the look comes from html[data-faction]. */
    applyVictoryFactionFlavor(overlay) {
        const faction = String(document.documentElement.dataset.faction || 'terran').toLowerCase();
        const lines = {
            terran: ['VICTORY!', 'Mission Accomplished'],
            kronax: ['CONQUEST!', 'The blade prevails'],
            voidborn: ['ASCENSION', 'The void has fed'],
            pirate: ['PLUNDERED!', 'Loot secured, crew alive'],
            machine: ['OBJECTIVE COMPLETE', 'Efficiency: optimal']
        };
        const pick = lines[faction] || lines.terran;
        const title = overlay.querySelector('.victory-title');
        const sub = overlay.querySelector('.victory-subtitle');
        if (title) title.textContent = pick[0];
        if (sub) sub.textContent = pick[1];
        overlay.dataset.faction = faction;
    },

    victoryResourceIconKey(id) {
        if (String(id || '').indexOf('blueprint:') === 0) return 'hsBlueprint';
        if (String(id || '').indexOf('part:') === 0) {
            const rest = String(id).slice(5);
            const sep = rest.indexOf(':');
            if (sep !== -1 && typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.resolveModuleIcon) {
                const key = shipLoadoutManager.resolveModuleIcon({
                    kind: rest.slice(0, sep),
                    id: rest.slice(sep + 1)
                });
                if (key) return key;
            }
            return 'hsCraft';
        }
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceIconKey) {
            return economyConfig.getResourceIconKey(id);
        }
        const map = {
            scrap: 'resScrap',
            ore: 'resOre',
            crystal: 'resCrystal',
            voltex: 'resVoltex'
        };
        return map[id] || 'resScrap';
    },

    victoryLootLabel(id) {
        const raw = String(id || '');
        if (raw.indexOf('blueprint:') === 0 && typeof profileManager !== 'undefined' && profileManager.getBlueprintName) {
            return 'BP ' + profileManager.getBlueprintName(raw.slice(10));
        }
        if (raw.indexOf('part:') === 0 && typeof profileManager !== 'undefined' && profileManager.getBlueprintName) {
            return profileManager.getBlueprintName(raw.slice(5));
        }
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel) {
            return economyConfig.getResourceLabel(id);
        }
        return raw.toUpperCase();
    },

    victoryLootTint(id) {
        const raw = String(id || '');
        if (raw.indexOf('blueprint:') === 0) return '#ffd24a';
        if (raw.indexOf('part:') === 0) {
            const rest = raw.slice(5);
            const sep = rest.indexOf(':');
            const kind = sep !== -1 ? rest.slice(0, sep) : 'weapon';
            if (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor) {
                return iconRenderer.getModuleKindColor(kind) || '#c08cff';
            }
            return '#c08cff';
        }
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor) {
            return economyConfig.getResourceColor(id);
        }
        return undefined;
    },

    /** Found items as the same square-slot grid used for the ship bag (hs-storage-grid): one
     *  cell per pending cargo part/blueprint, read LIVE off profile.cargo (not a frozen
     *  snapshot) since selling/taking changes it while this screen stays open. Click takes a
     *  part onto the SHIP grid (right-click sells); blueprints stay click-to-sell. Drag onto
     *  SHIP also files a part. Still-pending cargo is wiped when the screen closes
     *  (clearPendingCargo in hideVictoryOverlay) — the player has to decide now. Plain
     *  resources aren't shown: those auto-bank straight to the station wallet at victory
     *  (teleportCargoResourcesToStation), no decision needed. */
    renderVictoryLootHtml() {
        if (typeof profileManager === 'undefined') return '';
        const profile = profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
        // Fixed 6x4 slots at the exact same px size as the SHIP grid (homeStationUI.STORAGE_CELL_PX)
        // — no stretching, no adding rows/cols to fill the panel, so the two grids always read
        // as one consistent slot size no matter how tall/wide the surrounding panel ends up.
        const cs = (typeof homeStationUI !== 'undefined' && homeStationUI.STORAGE_CELL_PX) || 56;
        const gap = (typeof homeStationUI !== 'undefined' && homeStationUI.STORAGE_GAP_PX) || 2;
        const cols = 6;
        const rows = 4;
        const fillSlots = cols * rows;
        const gridStyle = `--cs:${cs}px;--hs-gap:${gap}px;` +
            `grid-template-columns:repeat(${cols},${cs}px);grid-template-rows:repeat(${rows},${cs}px);`;
        const emptyGrid = (label) => {
            const placeholders = Array.from({ length: fillSlots })
                .map(() => '<span class="hs-storage-cell hs-storage-cell-empty"></span>')
                .join('');
            return `<div class="hs-storage-grid victory-loot-grid" style="${gridStyle}">` +
                placeholders +
                `</div>` +
                (label ? `<div class="victory-loot-empty">${label}</div>` : '');
        };
        if (!profile) return emptyGrid();
        const cargoParts = profile.cargo && profile.cargo.parts ? profile.cargo.parts : {};
        const cargoBps = profile.cargo && profile.cargo.blueprints ? profile.cargo.blueprints : {};
        // Parts never stack visually (one cell per found unit, same rule as the home-station
        // bag); blueprints stay one stacked cell with a ×N badge, matching render-parts-list.js.
        const entries = [];
        Object.keys(cargoParts).forEach((key) => {
            const n = Math.max(0, Math.round(Number(cargoParts[key]) || 0));
            for (let i = 0; i < n; i++) entries.push({ key: key, amount: n, unitAmount: 1, isBlueprint: false });
        });
        Object.keys(cargoBps).forEach((key) => {
            if ((cargoBps[key] || 0) > 0) entries.push({ key: key, amount: cargoBps[key], unitAmount: cargoBps[key], isBlueprint: true });
        });
        if (!entries.length) {
            return emptyGrid();
        }
        const cells = entries.map((e) => {
            const id = 'part:' + e.key;
            const tint = this.victoryLootTint(id);
            const parsed = (typeof profileManager !== 'undefined' && profileManager.parseBlueprintKey)
                ? profileManager.parseBlueprintKey(e.key) : null;
            // Real name + stat lines (DMG/SPD, SHIELD, ARMOR, …) from the same lookup the
            // home-station hangar uses — not just a bare id label.
            const fullTip = (parsed && typeof homeStationUI !== 'undefined' && homeStationUI.hangarModuleTip)
                ? homeStationUI.hangarModuleTip(parsed.kind, parsed.id)
                : 'UNKNOWN ITEM';
            const tipLines = fullTip.split('\n');
            const name = tipLines[0] + (e.isBlueprint ? ' (BP)' : '');
            const iconHtml = (parsed && typeof homeStationUI !== 'undefined' && homeStationUI.moduleIconHtml)
                ? homeStationUI.moduleIconHtml(parsed.kind, parsed.id, cs - 20, 'victory-loot-pixel', false, tint)
                : (typeof iconRenderer !== 'undefined')
                    ? iconRenderer.imgHtml(this.victoryResourceIconKey(id), cs - 20, 'victory-loot-pixel', tint)
                    : '';
            const color = tint || '#ccc';
            const sellValue = (profileManager.getCargoPartSellValue ? profileManager.getCargoPartSellValue(e.key) : 0) * e.amount;
            const sellable = sellValue > 0 ? ' is-sellable' : '';
            const draggable = (!e.isBlueprint && parsed) ? ' is-draggable' : '';
            const qtyHtml = e.unitAmount > 1 ? `<span class="hs-storage-cell-qty">×${e.unitAmount}</span>` : '';
            const actionLine = (e.isBlueprint ? `${e.unitAmount > 1 ? '×' + e.unitAmount + '\n' : ''}CLICK TO SELL ALL · ${sellValue}c`
                : (parsed ? `CLICK TO LOOT · DRAG TO SHIP · RIGHT-CLICK SELL · ${sellValue}c`
                    : `CLICK TO SELL · ${sellValue}c`));
            const tip = tipLines.concat(actionLine.split('\n')).join('\n');
            return `<button type="button" class="hs-storage-cell victory-loot-cell${sellable}${draggable}" ` +
                `data-cargo-key="${e.key}" data-cargo-blueprint="${e.isBlueprint ? '1' : '0'}" style="--pk-c:${color}" ` +
                `data-ui-tip-compact data-ui-tip-head="${name.replace(/"/g, '&quot;')}" data-ui-tip="${tip.replace(/"/g, '&quot;')}" ` +
                `aria-label="${name}">` +
                iconHtml +
                qtyHtml +
                `</button>`;
        }).join('');
        const totalRows = Math.max(rows, Math.ceil(entries.length / cols));
        const padCount = Math.max(0, cols * totalRows - entries.length);
        const padding = Array.from({ length: padCount })
            .map(() => '<span class="hs-storage-cell hs-storage-cell-empty"></span>')
            .join('');
        const filledGridStyle = totalRows === rows
            ? gridStyle
            : `--cs:${cs}px;--hs-gap:${gap}px;` +
                `grid-template-columns:repeat(${cols},${cs}px);grid-template-rows:repeat(${totalRows},${cs}px);`;
        return `<div class="hs-storage-grid victory-loot-grid" style="${filledGridStyle}">` +
            cells + padding +
            `</div>`;
    },

    /** Sells one pending cargo stack (part or blueprint) and refreshes the panel. */
    sellVictoryCargoItem(key, isBlueprint) {
        if (typeof profileManager === 'undefined' || !profileManager.sellCargoPart) return;
        const res = profileManager.sellCargoPart(key, isBlueprint);
        if (!res || !res.ok) return;
        this.updateVictoryStats();
    },

    /** Files one pending cargo part onto the active ship and refreshes the panel. */
    takeVictoryCargoItem(key) {
        if (typeof profileManager === 'undefined' || !profileManager.takeCargoPartToShip) return;
        const shipId = profileManager.getActiveShipId ? profileManager.getActiveShipId() : null;
        if (!shipId) return;
        const res = profileManager.takeCargoPartToShip(shipId, key);
        if (!res || !res.ok) return;
        this.updateVictoryStats();
    },

    /** Same square-slot storage grid as the home station (hs-storage-grid): the active ship's
     *  equipped + filed parts, view-only except as a drop target for the found-items grid. */
    renderVictoryLoadoutHtml() {
        if (typeof profileManager === 'undefined' || typeof homeStationUI === 'undefined') return '';
        const profile = profileManager.getActiveProfile ? profileManager.getActiveProfile() : null;
        const shipId = profileManager.getActiveShipId ? profileManager.getActiveShipId() : null;
        if (!profile || !shipId) return '<div class="victory-loot-empty">NO SHIP</div>';
        const shipGrid = homeStationUI.renderShipStorage(profile, shipId, { tipAction: false }) || '';
        return `<div class="victory-loadout-bags">` +
            `<div class="victory-loadout-col"><h3 class="victory-loadout-col-title">SHIP</h3>${shipGrid}</div>` +
            `</div>`;
    },

    victoryShipGridAt(x, y) {
        const el = document.elementFromPoint(x, y);
        return el && el.closest ? el.closest('#victoryLoadoutList .hs-storage-grid[data-storage-target="ship"]') : null;
    },

    /** Route the home-station storage drag engine at the victory screen's own SHIP grid for the
     *  span of exactly one drag gesture, so items already on the ship can be rearranged — same
     *  monkey-patch idea as js/ui/in-stage-shop/core.js, but patched and unpatched around each
     *  drag rather than left in place for the overlay's whole lifetime. Opening SHOP from the
     *  victory screen does not hide it (hideVictoryOverlay never runs), so a patch left "on"
     *  for the whole screen would still be active when the shop's OWN patch runs, has it save
     *  OUR wrapper as "the real original", and leave homeStationUI permanently pointed at the
     *  victory screen afterwards — which is exactly why rearranges stopped showing up anywhere
     *  else. Patching only around the drag itself means every other UI always sees the real,
     *  unpatched homeStationUI. */
    patchHomeStationForVictory() {
        if (this._hsVictoryPatched || typeof homeStationUI === 'undefined') return;
        this._hsVictoryPrevOverlay = homeStationUI.overlay;
        this._hsVictoryPrevCreate = typeof homeStationUI.createUI === 'function'
            ? homeStationUI.createUI.bind(homeStationUI)
            : null;
        const self = this;
        homeStationUI.overlay = document.getElementById('victoryOverlay');
        homeStationUI.createUI = function () {
            self.unpatchHomeStationForVictory();
            self.updateVictoryStats();
        };
        this._hsVictoryPatched = true;
    },

    unpatchHomeStationForVictory() {
        if (!this._hsVictoryPatched || typeof homeStationUI === 'undefined') return;
        homeStationUI.overlay = this._hsVictoryPrevOverlay;
        if (this._hsVictoryPrevCreate) homeStationUI.createUI = this._hsVictoryPrevCreate;
        this._hsVictoryPatched = false;
        this._hsVictoryPrevOverlay = null;
        this._hsVictoryPrevCreate = null;
    },

    bindVictoryShipGridDrag(victoryOverlay) {
        if (!victoryOverlay || typeof homeStationUI === 'undefined') return;
        victoryOverlay.querySelectorAll('#victoryLoadoutList .hs-storage-cell[data-drag-key]').forEach((cell) => {
            cell.setAttribute('draggable', 'false');
            cell.addEventListener('dragstart', (e) => e.preventDefault());
            cell.addEventListener('pointerdown', (ev) => {
                if (ev.button !== 0) return;
                this.patchHomeStationForVictory();
                homeStationUI._storageDragStart(ev, cell);
                // Safety net: a plain click (no real drag past the threshold) never reaches a
                // drop, so createUI — where the patch normally lifts — never runs either.
                // These fire after the engine's own pointerup/cancel handlers (registered
                // first, during _storageDragStart above), so unpatching here never races a
                // drop that's still in flight.
                const releasePatch = () => {
                    document.removeEventListener('pointerup', releasePatch);
                    document.removeEventListener('pointercancel', releasePatch);
                    this.unpatchHomeStationForVictory();
                };
                document.addEventListener('pointerup', releasePatch);
                document.addEventListener('pointercancel', releasePatch);
            });
        });
    },

    /** Pointer-drag (not native HTML5 DnD — this app shell runs inside a scaled stage where
     *  dragover/drop don't fire reliably) from a found-items cargo cell onto the SHIP grid. */
    bindVictoryCargoDrag(victoryOverlay) {
        const list = victoryOverlay.querySelector('#victoryLootList');
        if (!list) return;
        list.querySelectorAll('.victory-loot-cell.is-draggable').forEach((cell) => {
            cell.addEventListener('pointerdown', (downEv) => {
                if (downEv.button !== 0) return;
                const startX = downEv.clientX;
                const startY = downEv.clientY;
                const THRESH = 6;
                let dragging = false;
                let ghost = null;
                try {
                    if (cell.setPointerCapture) cell.setPointerCapture(downEv.pointerId);
                } catch (err) { /* ignore */ }
                const cleanup = () => {
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    document.removeEventListener('pointercancel', onCancel);
                    try {
                        if (cell.releasePointerCapture) cell.releasePointerCapture(downEv.pointerId);
                    } catch (err) { /* ignore */ }
                    cell.classList.remove('is-dragging');
                    victoryOverlay.querySelectorAll('.hs-storage-grid.is-drag-over')
                        .forEach((g) => g.classList.remove('is-drag-over'));
                    if (ghost) { ghost.remove(); ghost = null; }
                };
                const onMove = (ev) => {
                    if (!dragging) {
                        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESH) return;
                        dragging = true;
                        cell.classList.add('is-dragging');
                        ghost = cell.cloneNode(true);
                        ghost.classList.add('victory-drag-ghost');
                        ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:10050;opacity:0.85;margin:0;';
                        ghost.style.width = cell.offsetWidth + 'px';
                        ghost.style.height = cell.offsetHeight + 'px';
                        document.body.appendChild(ghost);
                    }
                    ev.preventDefault();
                    ghost.style.left = (ev.clientX - cell.offsetWidth / 2) + 'px';
                    ghost.style.top = (ev.clientY - cell.offsetHeight / 2) + 'px';
                    const overShip = this.victoryShipGridAt(ev.clientX, ev.clientY);
                    victoryOverlay.querySelectorAll('#victoryLoadoutList .hs-storage-grid[data-storage-target="ship"]')
                        .forEach((g) => g.classList.toggle('is-drag-over', g === overShip));
                };
                const onUp = (ev) => {
                    const wasDragging = dragging;
                    const dropTarget = wasDragging ? this.victoryShipGridAt(ev.clientX, ev.clientY) : null;
                    cleanup();
                    if (!wasDragging) return;
                    // A real drag still ends with a native 'click' on this button — swallow it
                    // so it doesn't also fire the cell's own sell action right after the drop.
                    const suppressClick = (e) => { e.preventDefault(); e.stopPropagation(); };
                    cell.addEventListener('click', suppressClick, { capture: true, once: true });
                    setTimeout(() => cell.removeEventListener('click', suppressClick, true), 0);
                    if (dropTarget) this.takeVictoryCargoItem(cell.dataset.cargoKey);
                };
                const onCancel = () => cleanup();
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
                document.addEventListener('pointercancel', onCancel);
            });
        });
    },

    bindVictoryLootList(victoryOverlay) {
        const list = victoryOverlay.querySelector('#victoryLootList');
        if (!list || list.dataset.sellBound) return;
        list.dataset.sellBound = '1';
        list.addEventListener('click', (event) => {
            const btn = event.target.closest('.victory-loot-cell');
            if (!btn) return;
            event.preventDefault();
            event.stopPropagation();
            const isBlueprint = btn.dataset.cargoBlueprint === '1';
            // Parts: click loots onto the active ship. Blueprints can't file on a ship
            // (craft-only), so left-click still sells those.
            if (!isBlueprint && btn.classList.contains('is-draggable')) {
                this.takeVictoryCargoItem(btn.dataset.cargoKey);
                return;
            }
            if (!btn.classList.contains('is-sellable')) return;
            this.sellVictoryCargoItem(btn.dataset.cargoKey, isBlueprint);
        });
        list.addEventListener('contextmenu', (event) => {
            const btn = event.target.closest('.victory-loot-cell.is-sellable');
            if (!btn) return;
            event.preventDefault();
            event.stopPropagation();
            this.sellVictoryCargoItem(btn.dataset.cargoKey, btn.dataset.cargoBlueprint === '1');
        });
    },

    applyVictoryPixelIcons(victoryOverlay) {
        if (!victoryOverlay) return;
        const defaults = {
            '0': 'menuStart',
            '1': 'hsShop',
            '2': 'menuPlanets'
        };
        if (typeof iconRenderer !== 'undefined') {
            victoryOverlay.querySelectorAll('.victory-stats .stat-icon[data-icon]').forEach((iconEl) => {
                iconEl.innerHTML = iconRenderer.imgHtml(iconEl.dataset.icon, 32, 'victory-pixel-icon');
            });
        }
        victoryOverlay.querySelectorAll('.victory-button').forEach((button) => {
            let iconEl = button.querySelector('.button-icon');
            if (!iconEl) {
                iconEl = document.createElement('span');
                iconEl.className = 'button-icon';
                button.insertBefore(iconEl, button.firstChild);
            }
            const key = iconEl.dataset.icon || defaults[button.dataset.index];
            if (!key) return;
            iconEl.dataset.icon = key;
            if (typeof iconRenderer !== 'undefined') {
                iconEl.innerHTML = iconRenderer.imgHtml(key, 20, 'victory-pixel-icon');
            }
        });
    },

    /**
     * Last stage of a planet won → no next stage to offer: show the victory
     * screen briefly (with a countdown) and return to planet selection.
     * Any button pressed meanwhile wins; hiding the overlay cancels the timer.
     */
    getVictoryCurrentLevelId() {
        const level = this.coreLevelManager.getCurrentLevel();
        if (!level) return null;
        if (level.planetId && Number.isFinite(Number(level.stageIndex))) {
            return `${level.planetId}-${level.isBoss ? 'boss' : level.stageIndex}`;
        }
        return level.id || level.levelId || level.stageId || level.planetId || level.background || null;
    },

    scheduleAutoReturnIfPlanetCleared(overlay) {
        this.cancelVictoryAutoReturn();
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        const currentId = this.getVictoryCurrentLevelId();
        const meta = currentId && typeof this.coreLevelManager.getNextLevelMeta === 'function'
            ? this.coreLevelManager.getNextLevelMeta(currentId)
            : null;
        const cleared = !!(currentLevel && currentLevel.isBoss) || !meta || meta.kind === 'planet';
        if (!cleared) return;
        const leaveBtn = overlay.querySelector('.victory-button[data-action="levelSelection"]');
        const label = leaveBtn && leaveBtn.querySelector('.button-text');
        let left = 4;
        const tick = () => {
            if (label) label.textContent = `Leave Planet (${left})`;
            if (left <= 0) {
                this.cancelVictoryAutoReturn();
                if (label) label.textContent = 'Leave Planet';
                if (typeof game !== 'undefined' && game.showLevelSelection) game.showLevelSelection();
                return;
            }
            left -= 1;
            this._victoryAutoReturn = setTimeout(tick, 1000);
        };
        if (typeof uiManager !== 'undefined' && leaveBtn) {
            const buttons = typeof uiManager.getVictoryButtons === 'function'
                ? uiManager.getVictoryButtons()
                : [];
            const leaveIdx = buttons.indexOf(leaveBtn);
            uiManager.victoryMenuIndex = leaveIdx >= 0 ? leaveIdx : Math.max(0, buttons.length - 1);
            uiManager.updateVictoryMenuDisplay();
        }
        tick();
    },

    cancelVictoryAutoReturn() {
        if (this._victoryAutoReturn) {
            clearTimeout(this._victoryAutoReturn);
            this._victoryAutoReturn = null;
        }
        const label = document.querySelector('#victoryOverlay .victory-button[data-action="levelSelection"] .button-text');
        if (label) label.textContent = 'Leave Planet';
    },

    updateVictoryNextButton() {
        const currentLevel = this.coreLevelManager.getCurrentLevel();
        const hasInterruptedTravel = typeof galaxyMapManager !== 'undefined'
            && galaxyMapManager
            && galaxyMapManager._postAmbushFlight;
        const isAmbush = currentLevel && [
            currentLevel.id,
            currentLevel.levelId,
            currentLevel.stageId,
            currentLevel.planetId
        ].some((value) => String(value || '').toLowerCase().indexOf('ambush_') === 0);
        const currentId = this.getVictoryCurrentLevelId();
        const ambushVictory = !!hasInterruptedTravel || isAmbush
            || String(currentId || '').toLowerCase().indexOf('ambush_') === 0;
        const meta = currentId && typeof this.coreLevelManager.getNextLevelMeta === 'function'
            ? this.coreLevelManager.getNextLevelMeta(currentId)
            : null;

        const button = document.querySelector('#victoryOverlay .victory-button[data-index="0"] .button-text')
            || document.querySelector('#victoryNextButton .button-text');
        const bossVictory = !ambushVictory && !!(currentLevel && currentLevel.isBoss);
        const nextLabel = ambushVictory ? 'CONTINUE TRAVEL'
            : (bossVictory ? 'MAP SELECT' : (meta ? meta.label : 'CAMPAIGN COMPLETE'));
        if (button) button.textContent = nextLabel;

        const nextBtn = document.querySelector('#victoryOverlay .victory-button[data-index="0"]');
        if (nextBtn) {
            const canAdvance = !!meta || ambushVictory || !!(currentLevel && currentLevel.isBoss);
            nextBtn.disabled = !canAdvance;
            nextBtn.classList.toggle('disabled', !canAdvance);
            const isBossRoom = !ambushVictory && !bossVictory
                && !!(meta && (meta.kind === 'boss' || String(meta.label || '').toUpperCase() === 'BOSS ROOM'));
            const iconKey = isBossRoom ? 'navSkull' : 'menuStart';
            let iconEl = nextBtn.querySelector('.button-icon');
            if (!iconEl) {
                iconEl = document.createElement('span');
                iconEl.className = 'button-icon';
                nextBtn.insertBefore(iconEl, nextBtn.firstChild);
            }
            iconEl.dataset.icon = iconKey;
            if (typeof iconRenderer !== 'undefined') {
                iconEl.innerHTML = iconRenderer.imgHtml(iconKey, 20, 'victory-pixel-icon');
            }
        }

        // Ambush is mid-flight combat — no planet to leave; only continue travel.
        // Boss victory already routes "MAP SELECT" to leave the planet, so hide
        // the separate "Leave Planet" button to avoid two buttons doing the same thing.
        const hideLeaveBtn = ambushVictory || bossVictory;
        const leaveBtn = document.querySelector('#victoryOverlay .victory-button[data-action="levelSelection"]');
        if (leaveBtn) {
            leaveBtn.hidden = hideLeaveBtn;
            leaveBtn.setAttribute('aria-hidden', hideLeaveBtn ? 'true' : 'false');
        }
        // Ambush is a brief raider interruption, not a real planet stage — no
        // trader to shop from, so the SHOP button has no business showing here.
        const shopBtn = document.querySelector('#victoryOverlay .victory-button[data-action="shop"]');
        if (shopBtn) {
            shopBtn.hidden = ambushVictory;
            shopBtn.setAttribute('aria-hidden', ambushVictory ? 'true' : 'false');
        }
        if (typeof uiManager !== 'undefined') {
            uiManager.victoryMenuItems = ambushVictory
                ? ['nextLevel']
                : (hideLeaveBtn ? ['nextLevel', 'shop'] : ['nextLevel', 'shop', 'levelSelection']);
            const visible = typeof uiManager.getVictoryButtons === 'function'
                ? uiManager.getVictoryButtons().length
                : uiManager.victoryMenuItems.length;
            if (uiManager.victoryMenuIndex >= visible) {
                uiManager.victoryMenuIndex = 0;
            }
        }
    },

    bindVictoryButtons(victoryOverlay) {
        const buttons = victoryOverlay.querySelectorAll('.victory-button');
        buttons.forEach((button) => {
            button.addEventListener('mouseenter', () => {
                const index = parseInt(button.dataset.index, 10);
                if (typeof uiManager !== 'undefined' && !Number.isNaN(index)) {
                    uiManager.victoryMenuIndex = index;
                    uiManager.updateVictoryMenuDisplay();
                }
            });
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const action = button.dataset.action;
                const index = parseInt(button.dataset.index, 10);
                if (typeof uiManager === 'undefined') return;
                if (!Number.isNaN(index)) {
                    uiManager.victoryMenuIndex = index;
                    uiManager.updateVictoryMenuDisplay();
                }
                if (action && uiManager.runVictoryAction) {
                    uiManager.runVictoryAction(action);
                } else {
                    uiManager.selectVictoryOption();
                }
            });
        });
    },

    hideVictoryOverlay() {
        this.cancelVictoryAutoReturn();
        this.unpatchHomeStationForVictory();
        // Whatever the player never took or sold is lost here — no silent fallback into
        // station storage, so the found-items decision on this screen actually matters.
        if (typeof profileManager !== 'undefined' && profileManager.clearPendingCargo) {
            profileManager.clearPendingCargo();
        }
        const victoryOverlay = document.getElementById('victoryOverlay');
        if (victoryOverlay) {
            victoryOverlay.querySelectorAll('.victory-button.nav-focused, .victory-button.selected')
                .forEach((btn) => btn.classList.remove('nav-focused', 'selected'));
            victoryOverlay.classList.add('hidden');
        }

        // Show side HUD clusters again
        const leftCluster = document.getElementById('gameLeftCluster');
        if (leftCluster) {
            leftCluster.style.display = '';
        }

        const rightCluster = document.getElementById('gameRightCluster');
        if (rightCluster) {
            rightCluster.style.display = '';
        }
    },

    hideAllOverlays() {
        this.hidePauseOverlay();
        this.hideGameOverOverlay();
        this.hideVictoryOverlay();

        // Hide settings overlay
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    },

    // Level info management
    updateLevelInfo() {
        const levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        if (levelInfoManager) {
            const levelData = levelInfoManager.collectLevelData();
            levelInfoManager.updateLevelData(levelData);
            // Always paint the info panel when combat HUD is up. Only the
            // combat clock waits for FIRE TO START → fly-in to finish.
            if (typeof missionStartManager !== 'undefined' && missionStartManager.isActive()) {
                if (typeof levelInfoManager.prepareForCombat === 'function') {
                    levelInfoManager.prepareForCombat();
                } else {
                    levelInfoManager.showPanel();
                    levelInfoManager.updateDisplay();
                }
            } else {
                levelInfoManager.startLevel();
            }
        } else {
            console.warn('LevelInfoManager not available for update');
        }
    },

    updateLevelStats(stats) {
        const levelInfoManager = this.systemManager.getSubsystem('levelInfoManager');
        if (levelInfoManager) {
            levelInfoManager.updateStats(stats);
        }
    },
});
