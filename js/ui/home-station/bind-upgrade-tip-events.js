"use strict";

// Station upgrade tree: per-faction naming (display only — costs / effects stay in economy-config).
const UPG_FLAVOR = {
    terran: {
        title: 'UGDF STATION GRID',
        trees: { core: 'COMMAND', vault: 'SUPPLY', fleet: 'FLEET', cargo: 'LOGISTICS', drive: 'DRIVE', power: 'POWER', diplo: 'DIPLO' },
        nodes: { core: 'COMMAND DECK', storage: 'SUPPLY DEPOT', hangar: 'FLIGHT DECK', cargo: 'LOGISTICS BAY', impulse_drive: 'IMPULSE ENGINES', reactor: 'FUSION REACTOR',
            compactor: 'SCRAP PRESS', docking_ring: 'DOCKING RING', fabricator: 'FIELD FABRICATOR', warp_drive: 'WARP CORE', cooling: 'COOLANT GRID', refinery: 'ORE REFINERY',
            drone_bay: 'DRONE BAY', sensors: 'RADAR ARRAY', nav_computer: 'NAV COMPUTER', foundry: 'NANO FOUNDRY', quantum_array: 'QUANTUM ARRAY', stargate: 'STARGATE LINK',
            vault_omega: 'OMEGA DEPOT', fleet_yard: 'FLEET YARD', embassy: 'EMBASSY', trade_desk: 'TRADE DESK', war_room: 'WAR ROOM' }
    },
    kronax: {
        title: 'KRONAX WAR NEST',
        trees: { core: 'NEST', vault: 'HOARD', fleet: 'WARFLEET', cargo: 'SPOILS', drive: 'STRIKE', power: 'FORGE', diplo: 'TRUCE' },
        nodes: { core: 'WAR NEST', storage: 'TROPHY VAULT', hangar: 'CLAW HANGAR', cargo: 'SPOILS HOLD', impulse_drive: 'STRIKE DRIVE', reactor: 'FORGE REACTOR',
            compactor: 'SLAG PRESS', docking_ring: 'RAID BERTHS', fabricator: 'WAR FORGE', warp_drive: 'JUMP FORGE', cooling: 'QUENCH GRID', refinery: 'SMELTER',
            drone_bay: 'HUNTER BAY', sensors: 'SCENT ARRAY', nav_computer: 'HUNT CHART', foundry: 'NANO FORGE', quantum_array: 'SHARD ARRAY', stargate: 'RAID GATE',
            vault_omega: 'OMEGA HOARD', fleet_yard: 'WARFLEET YARD', embassy: 'TRUCE HALL', trade_desk: 'TRIBUTE DESK', war_room: 'WAR COUNCIL' }
    },
    voidborn: {
        title: 'VOIDBORN RING SANCTUM',
        trees: { core: 'HEART', vault: 'ECHO', fleet: 'RINGS', cargo: 'PHASE', drive: 'DRIFT', power: 'VOID', diplo: 'CONCLAVE' },
        nodes: { core: 'VOID HEART', storage: 'ECHO VAULT', hangar: 'RING DOCK', cargo: 'PHASE HOLD', impulse_drive: 'DRIFT DRIVE', reactor: 'VOID REACTOR',
            compactor: 'ENTROPY PRESS', docking_ring: 'ORBIT RING', fabricator: 'SHAPING LOOM', warp_drive: 'RIFT ENGINE', cooling: 'STILL GRID', refinery: 'SHADE REFINERY',
            drone_bay: 'WISP BAY', sensors: 'WHISPER ARRAY', nav_computer: 'STAR LOOM', foundry: 'DREAM FOUNDRY', quantum_array: 'ECLIPSE ARRAY', stargate: 'RIFT GATE',
            vault_omega: 'OMEGA ABYSS', fleet_yard: 'HOLLOW YARD', embassy: 'CONCLAVE', trade_desk: 'OFFERING DESK', war_room: 'OMEN ROOM' }
    },
    pirate: {
        title: 'PIRATE SCRAP HAVEN',
        trees: { core: 'HQ', vault: 'STASH', fleet: 'DOCKS', cargo: 'LOOT', drive: 'RUN', power: 'JUNK', diplo: 'DEALS' },
        nodes: { core: 'SCRAP HQ', storage: 'STASH', hangar: 'SCRAP DOCKS', cargo: 'SMUGGLER HOLD', impulse_drive: 'JURY-RIG DRIVE', reactor: 'BOOTLEG REACTOR',
            compactor: 'JUNK CRUSHER', docking_ring: 'RAFT BERTHS', fabricator: 'CHOP SHOP', warp_drive: 'SKIP DRIVE', cooling: 'DUCT-TAPE COOLING', refinery: 'STILL & SMELTER',
            drone_bay: 'SCAV DRONES', sensors: 'SCANNER RIG', nav_computer: 'PIRATE CHARTS', foundry: 'BACK-ALLEY FOUNDRY', quantum_array: 'WILD ARRAY', stargate: 'SMUGGLER GATE',
            vault_omega: 'BLACK VAULT', fleet_yard: 'ARMADA YARD', embassy: 'PARLEY DECK', trade_desk: 'FENCE DESK', war_room: 'RAID ROOM' }
    },
    machine: {
        title: 'MACHINE CORE LATTICE',
        trees: { core: 'NODE', vault: 'ARCHIVE', fleet: 'ASSEMBLY', cargo: 'FREIGHT', drive: 'THRUST', power: 'FLUX', diplo: 'PROTOCOL' },
        nodes: { core: 'CORE NODE', storage: 'DATA VAULT', hangar: 'ASSEMBLY BAY', cargo: 'FREIGHT GRID', impulse_drive: 'THRUST ARRAY', reactor: 'FLUX REACTOR',
            compactor: 'COMPRESSOR UNIT', docking_ring: 'DOCK LATTICE', fabricator: 'AUTO-FABRICATOR', warp_drive: 'WARP MATRIX', cooling: 'THERMAL LATTICE', refinery: 'REFINING UNIT',
            drone_bay: 'SWARM BAY', sensors: 'SENSOR GRID', nav_computer: 'NAV PROCESSOR', foundry: 'NANO ASSEMBLER', quantum_array: 'QUANTUM LATTICE', stargate: 'GATE PROTOCOL',
            vault_omega: 'OMEGA ARCHIVE', fleet_yard: 'FLEET MATRIX', embassy: 'PROTOCOL HUB', trade_desk: 'EXCHANGE NODE', war_room: 'TACTICS CORE' }
    }
};

/** Branch colours as one family around the faction accent (hue steps), not a rainbow. */
function upgFactionPalette(factionId) {
    let accent = '#4ec4ff';
    try {
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
            const st = factionShipStyles.getFactionStyle(factionId);
            if (st && /^#[0-9a-f]{6}$/i.test(st.accent || '')) accent = st.accent;
        }
    } catch (e) { /* default accent */ }
    const n = parseInt(accent.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0; const l = (mx + mn) / 2; const d = mx - mn;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d) {
        if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
    }
    const steps = [0, 22, -22, 44, -44, 66, -66]; // core, vault, fleet, cargo, drive, power, diplo
    const light = [62, 58, 66, 60, 68, 56, 64];
    return steps.map(function (dh, i) {
        return 'hsl(' + Math.round((h + dh + 360) % 360) + ' ' + Math.round(Math.max(45, Math.min(95, sat * 100 + 10))) + '% ' + light[i] + '%)';
    });
}

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    bindUpgradeTipEvents() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('.hs-upg-node').forEach((btn) => {
            btn.addEventListener('pointerenter', () => this.showUpgradeTip(btn));
            btn.addEventListener('pointerleave', () => {
                if (this._upgTipBtn === btn) this.hideUpgradeTip();
            });
            btn.addEventListener('focus', () => this.showUpgradeTip(btn));
            btn.addEventListener('blur', () => {
                if (this._upgTipBtn === btn) this.hideUpgradeTip();
            });
        });
        const scroll = this.overlay.querySelector('.hs-upg-tree-scroll');
        // Legend button group: click = scroll to that tree and dim the others; click again = clear.
        this.overlay.querySelectorAll('.hs-upg-branch-chip').forEach((chip) => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const tree = this.overlay.querySelector('.hs-upg-tree');
                if (!tree) return;
                const id = chip.getAttribute('data-upg-branch');
                const on = tree.getAttribute('data-focus') !== id;
                if (on) tree.setAttribute('data-focus', id); else tree.removeAttribute('data-focus');
                this.overlay.querySelectorAll('.hs-upg-branch-chip').forEach((c) => {
                    const sel = on && c === chip;
                    c.classList.toggle('on', sel);
                    c.setAttribute('aria-pressed', sel ? 'true' : 'false');
                });
                if (on && scroll) {
                    const x = Number(chip.getAttribute('data-x')) || 0;
                    scroll.scrollTo({ left: Math.max(0, x - scroll.clientWidth / 2), behavior: 'smooth' });
                }
            });
        });
        if (scroll) {
            scroll.addEventListener('scroll', () => {
                if (!this._upgTipBtn) return;
                this.positionUpgradeTip(this._upgTipBtn, this.ensureUpgradeTipHost());
            }, { passive: true });

            let pan = null;
            scroll.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
            // Left drag on empty space or right drag anywhere pans. A left
            // press on a node only pans once it moves a few px, so clicks
            // still buy/select.
            scroll.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 && e.button !== 2) return;
                const onNode = !!(e.target.closest && e.target.closest('.hs-upg-node, button, .hs-upg-dock'));
                pan = {
                    x: e.clientX,
                    y: e.clientY,
                    left: scroll.scrollLeft,
                    top: scroll.scrollTop,
                    active: e.button === 2 || !onNode,
                    pointerId: e.pointerId
                };
                if (pan.active) {
                    scroll.classList.add('is-panning');
                    scroll.setPointerCapture(e.pointerId);
                    e.preventDefault();
                }
            });
            scroll.addEventListener('pointermove', (e) => {
                if (!pan) return;
                if (!pan.active) {
                    if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) < 5) return;
                    pan.active = true;
                    pan.dragged = true;
                    scroll.classList.add('is-panning');
                    scroll.setPointerCapture(e.pointerId);
                }
                // Pointer deltas are visual px, scroll offsets CSS px (zoomed GUI).
                const z = window.vfEffectiveZoom ? window.vfEffectiveZoom(scroll) : 1;
                scroll.scrollLeft = pan.left - (e.clientX - pan.x) / z;
                scroll.scrollTop = pan.top - (e.clientY - pan.y) / z;
                e.preventDefault();
            });
            const stopPan = (e) => {
                if (!pan) return;
                this._upgPanSwallowClick = !!pan.dragged;
                pan = null;
                scroll.classList.remove('is-panning');
                if (e && scroll.hasPointerCapture(e.pointerId)) {
                    scroll.releasePointerCapture(e.pointerId);
                }
            };
            // A drag that started on a node must not also click it.
            scroll.addEventListener('click', (e) => {
                if (!this._upgPanSwallowClick) return;
                this._upgPanSwallowClick = false;
                e.stopPropagation();
                e.preventDefault();
            }, true);
            scroll.addEventListener('pointerup', stopPan);
            scroll.addEventListener('pointercancel', stopPan);
        }
    },

    renderStationUpgradeTree(profile) {
        if (typeof economyConfig === 'undefined' || typeof profileManager === 'undefined') {
            return `<p class="hs-muted">Upgrade system unavailable.</p>`;
        }
        const stats = profileManager.getStationStats(profile);
        const order = economyConfig.stationUpgradeOrder || [];
        const nodes = [];
        const byId = {};
        const facId = (UPG_FLAVOR[profile.faction] ? profile.faction : 'terran');
        const flavor = UPG_FLAVOR[facId];
        const pal = upgFactionPalette(facId);
        order.forEach((id) => {
            const base = economyConfig.getStationUpgradeNode(id);
            if (!base) return;
            // Faction-flavoured copy (name only; effect / cost callbacks are shared).
            const node = flavor.nodes[id] ? Object.assign({}, base, { label: flavor.nodes[id] }) : base;
            nodes.push(node);
            byId[node.id] = node;
        });

        // Independent color-coded trees side-by-side (NOT one hub from CORE).
        const TREES = [
            { id: 'core', root: 'core', color: pal[0], label: flavor.trees.core },
            { id: 'vault', root: 'storage', color: pal[1], label: flavor.trees.vault },
            { id: 'fleet', root: 'hangar', color: pal[2], label: flavor.trees.fleet },
            { id: 'cargo', root: 'cargo', color: pal[3], label: flavor.trees.cargo },
            { id: 'drive', root: 'impulse_drive', color: pal[4], label: flavor.trees.drive },
            { id: 'power', root: 'reactor', color: pal[5], label: flavor.trees.power },
            { id: 'diplo', root: 'embassy', color: pal[6], label: flavor.trees.diplo },
            { id: 'armory', root: 'armory', color: pal[0], label: flavor.trees.armory || 'ARMORY' }
        ].filter((t) => byId[t.root]);
        // One colour for every tree: the node SHAPE tells the tree apart (see part-23.css, data-branch).
        TREES.forEach((t) => { t.color = pal[0]; });

        const kidsByParent = {};
        nodes.forEach((n) => {
            if (!n.requires || !byId[n.requires]) return;
            // No visual parent link from CORE into other trees — each tree is independent.
            if (n.requires === 'core' && n.id !== 'core') return;
            if (!kidsByParent[n.requires]) kidsByParent[n.requires] = [];
            kidsByParent[n.requires].push(n);
        });

        const branchOf = {};
        const colorOf = {};
        TREES.forEach((t) => {
            const stack = [t.root];
            while (stack.length) {
                const id = stack.pop();
                if (branchOf[id]) continue;
                branchOf[id] = t.id;
                colorOf[id] = t.color;
                (kidsByParent[id] || []).forEach((k) => stack.push(k.id));
            }
        });

        // Pixel layout: each tree fans out in local space, then packed side-by-side.
        const nodeSize = 96;
        const half = nodeSize / 2;
        const padX = 56;
        const padY = 32;
        const rowH = 150;
        const sibGap = 128;
        const treeGap = 64;
        const topY = padY + half;
        const iconPx = 80;

        const posPx = {}; // id -> { x, y } centre
        const treeCenters = []; // label x per tree (after packing)
        let cursorX = padX;

        TREES.forEach((t) => {
            // Local coords: root at lx=0; each sibling pack fans under its parent.
            const local = {};
            let minLx = 0;
            let maxLx = 0;
            const place = (id, lx, depth) => {
                local[id] = { lx, ly: depth * rowH };
                minLx = Math.min(minLx, lx);
                maxLx = Math.max(maxLx, lx);
                const kids = kidsByParent[id] || [];
                if (!kids.length) return;
                const spread = (kids.length - 1) * sibGap;
                kids.forEach((k, i) => {
                    place(k.id, lx - spread / 2 + i * sibGap, depth + 1);
                });
            };
            place(t.root, 0, 0);

            const localW = Math.max(nodeSize, (maxLx - minLx) + nodeSize);
            const originX = cursorX + half - minLx;
            treeCenters.push(originX);
            Object.keys(local).forEach((id) => {
                posPx[id] = {
                    x: Math.round(originX + local[id].lx),
                    y: Math.round(topY + local[id].ly)
                };
            });
            cursorX += localW + treeGap;
        });

        let maxX = 0;
        let maxY = 0;
        Object.keys(posPx).forEach((id) => {
            maxX = Math.max(maxX, posPx[id].x);
            maxY = Math.max(maxY, posPx[id].y);
        });
        const treeW = Math.ceil(Math.max(maxX + half + padX, cursorX - treeGap + padX));
        const treeH = Math.ceil(maxY + half + padY + 32);

        const centerOf = (node) => posPx[node.id] || { x: 0, y: 0 };

        const linkParts = [];
        Object.keys(kidsByParent).forEach((pid) => {
            const parent = byId[pid];
            const kids = kidsByParent[pid];
            const a = centerOf(parent);
            const parentBottom = a.y + half;
            let minChildTop = Infinity;
            kids.forEach((k) => {
                minChildTop = Math.min(minChildTop, centerOf(k).y - half);
            });
            const gap = Math.max(36, Math.min(72, (minChildTop - parentBottom) * 0.42));
            const busY = parentBottom + gap;
            kids.forEach((k) => {
                const b = centerOf(k);
                const childLit = profileManager.getStationUpgradeLevel(k.requires, profile) >= (k.requireLevel || 1)
                    ? ' lit'
                    : '';
                const branchId = branchOf[k.id] || branchOf[pid] || 'core';
                const col = colorOf[k.id] || colorOf[pid] || 'var(--color-primary)';
                const x1 = a.x;
                const y1 = parentBottom;
                const x2 = b.x;
                const y2 = b.y - half;
                const dx = Math.abs(x2 - x1);
                let d;
                if (dx < 8) {
                    d = `M ${Math.round(x1)} ${Math.round(y1)} L ${Math.round(x2)} ${Math.round(y2)}`;
                } else {
                    d = `M ${Math.round(x1)} ${Math.round(y1)}` +
                        ` L ${Math.round(x1)} ${Math.round(busY)}` +
                        ` L ${Math.round(x2)} ${Math.round(busY)}` +
                        ` L ${Math.round(x2)} ${Math.round(y2)}`;
                }
                linkParts.push(
                    `<path class="hs-upg-link${childLit}" data-branch="${branchId}" style="--upg-branch:${col}" d="${d}" fill="none"/>`
                );
            });
        });

        // Legend = button group: the shape glyph matches the node shape of that tree; click jumps to / focuses it.
        const legend = TREES.map((t, ti) =>
            `<button type="button" class="hs-upg-branch-chip" data-upg-branch="${t.id}" data-x="${Math.round(treeCenters[ti] || 0)}"` +
            ` style="--upg-branch:${t.color}" aria-pressed="false" title="${t.label}">` +
            `<i class="hs-upg-shape" data-branch="${t.id}"></i>${t.label}</button>`
        ).join('');

        const selectedId = this.selectedUpgradeNode && byId[this.selectedUpgradeNode]
            ? this.selectedUpgradeNode
            : (nodes[0] && nodes[0].id);

        const nodeButtons = nodes.map((node) => {
            if (!posPx[node.id]) return '';
            const level = profileManager.getStationUpgradeLevel(node.id, profile);
            const maxed = level >= node.maxLevel;
            const check = profileManager.canUnlockStationUpgrade(node.id, profile);
            const locked = !maxed && check.reason === 'LOCKED';
            const cost = !maxed
                ? economyConfig.getStationUpgradeCost(node.id, level + 1)
                : null;
            const branchId = branchOf[node.id] || 'core';
            const col = colorOf[node.id] || 'var(--color-primary)';
            let stateClass = 'hs-upg-node';
            if (maxed) stateClass += ' maxed';
            else if (locked) stateClass += ' locked';
            else if (check.ok) stateClass += ' available';
            else stateClass += ' blocked';
            if (node.id === selectedId) stateClass += ' selected';

            const c = centerOf(node);
            const top = c.y - half;
            const left = c.x - half;
            const canBuy = !maxed && !locked && check.ok;
            const tip = this.buildUpgradeTooltip(node, level, maxed, locked, check, cost, false);

            return `<button type="button" class="${stateClass}" data-branch="${branchId}"` +
                ` style="left:${left}px;top:${top}px;width:${nodeSize}px;height:${nodeSize}px;--upg-branch:${col}"` +
                ` data-nav-item data-upgrade-node="${node.id}"` +
                (canBuy ? ` data-upgrade="${node.id}"` : '') +
                ` aria-label="${node.label} ${level}/${node.maxLevel}">` +
                `<span class="hs-upg-face" aria-hidden="true"></span>` +
                `<span class="hs-upg-icon">${(node.grantsWeapon && typeof iconRenderer !== 'undefined' && iconRenderer.weaponImgHtml)
                    ? iconRenderer.weaponImgHtml(node.grantsWeapon, iconPx, 'hs-pixel', false)
                    : this.iconHtml(node.icon || 'hsUpgrade', iconPx, 'hs-pixel')}</span>` +
                this.buildUpgradeSlotBadges(level, node.maxLevel) +
                tip +
                `</button>`;
        }).join('');

        // Per-tree labels above each independent root.
        const colLabels = TREES.map((t, ti) => {
            const x = treeCenters[ti] || 0;
            return `<span class="hs-upg-col-label" style="left:${Math.round(x)}px;--upg-branch:${t.color}">${t.label}</span>`;
        }).join('');

        const sel = byId[selectedId];
        let dock = '';
        if (sel) {
            const level = profileManager.getStationUpgradeLevel(sel.id, profile);
            const maxed = level >= sel.maxLevel;
            const check = profileManager.canUnlockStationUpgrade(sel.id, profile);
            const locked = !maxed && check.reason === 'LOCKED';
            const cost = !maxed ? economyConfig.getStationUpgradeCost(sel.id, level + 1) : null;
            const col = colorOf[sel.id] || 'var(--color-primary)';
            dock = `<div class="hs-upg-dock" style="--upg-branch:${col}">${this.buildUpgradeTooltip(sel, level, maxed, locked, check, cost, false)
                .replace('hs-upg-tip', 'hs-upg-dock-body')
                .replace(' role="tooltip"', '')}</div>`;
        }

        const summaryChip = (icon, label, value) =>
            `<span class="hs-chip">` +
            `<span class="hs-chip-icon">${this.iconHtml(icon, 32, 'hs-pixel')}</span>` +
            `<span class="hs-chip-meta">` +
            `<span class="hs-chip-label">${label}</span>` +
            `<span class="hs-chip-value">${value}</span>` +
            `</span>` +
            `</span>`;

        const summary =
            `<div class="hs-upg-stats">` +
            summaryChip('hsStores', 'STORE', stats.resourceCap) +
            summaryChip('hsCargo', 'CARGO', stats.cargoCap) +
            summaryChip('hsShip', 'SHIPS', stats.shipSlots) +
            summaryChip('hsCraft', 'CRAFT', `-${Math.round((stats.craftDiscount || 0) * 100)}%`) +
            summaryChip('hsBlueprint', 'BP DROP', `+${Math.round((stats.dropBonus || 0) * 1000) / 10}%`) +
            summaryChip('hsUpgrade', 'WARP', 'L' + (stats.warpDrive || 0)) +
            `</div>`;

        return summary +
            `<div class="hs-upg-faction-title" style="--upg-branch:${pal[0]}"><i></i>${flavor.title}<i></i></div>` +
            `<div class="hs-upg-branch-legend" role="group" aria-label="Upgrade trees">${legend}</div>` +
            `<div class="hs-upg-tree-scroll">` +
            `<div class="hs-upg-tree" style="width:${treeW}px;min-width:100%;height:${treeH}px">` +
            `<svg class="hs-upg-links" width="${treeW}" height="${treeH}" viewBox="0 0 ${treeW} ${treeH}" preserveAspectRatio="xMidYMin meet" shape-rendering="crispEdges" aria-hidden="true">${linkParts.join('')}</svg>` +
            nodeButtons +
            `</div></div>` +
            dock;
    },

    renderShipFrameUpgrades(profile) {
        const owned = profile.ownedShipIds || [];
        if (!owned.length) {
            return this.emptyHtml('hsShip', 'NO SHIPS OWNED');
        }
        const wallet = profile.resources || {};
        const max = (typeof economyConfig !== 'undefined') ? (economyConfig.maxShipFrameLevel || 9) : 9;
        return owned.map((id) => {
            const level = profileManager.getShipFrameLevel(id, profile);
            const check = profileManager.canPurchaseShipFrameUpgrade(id, profile);
            const caps = (typeof shipLoadoutManager !== 'undefined')
                ? shipLoadoutManager.getSlotCaps(id, this.shipModelClass(id, typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(id) : null) || 'starfighter')
                : { weapons: 1, defenses: 1, abilities: 1 };
            const cost = !check.ok && check.cost
                ? check.cost
                : (check.ok ? check.cost : (economyConfig.getShipFrameUpgradeCost(level + 1)));
            const maxed = level >= max;
            let action = '';
            if (maxed) {
                action = '<span class="hs-muted hs-line-action">MAX</span>';
            } else {
                // Missing resources stays focusable: the click opens the buy modal.
                const lockAttr = check.ok ? '' : (check.reason === 'RESOURCES' ? 'data-short="1"' : 'disabled');
                action = `<button class="action-button hs-line-action" data-frame-up="${id}" ${lockAttr}>` +
                    `FRAME L${level + 1}` +
                    `</button>`;
            }
            return `<div class="hs-line hs-shop-line">` +
                `<span class="hs-line-name">` +
                `<span class="hs-chip-icon">${this.iconHtml('hsShip', 32, 'hs-pixel')}</span>` +
                `<span class="hs-line-text">` +
                `<strong>${this.shipName(id)}</strong>` +
                `<span class="hs-line-meta">FRAME L${level}/${max} · SLOTS W${caps.weapons}/D${caps.defenses}/A${caps.abilities}</span>` +
                `</span></span>` +
                (cost && !maxed ? this.renderCostGrid(cost, wallet) : '<span></span>') +
                action +
                `</div>`;
        }).join('');
    },
});
