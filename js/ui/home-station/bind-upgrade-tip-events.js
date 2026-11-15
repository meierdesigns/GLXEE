"use strict";

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
        order.forEach((id) => {
            const node = economyConfig.getStationUpgradeNode(id);
            if (!node) return;
            nodes.push(node);
            byId[node.id] = node;
        });

        // Independent color-coded trees side-by-side (NOT one hub from CORE).
        const TREES = [
            { id: 'core', root: 'core', color: 'var(--color-primary, #3dff6a)', label: 'CORE' },
            { id: 'vault', root: 'storage', color: '#e8b84a', label: 'VAULT' },
            { id: 'fleet', root: 'hangar', color: '#4ec4ff', label: 'FLEET' },
            { id: 'cargo', root: 'cargo', color: '#d46cff', label: 'CARGO' },
            { id: 'drive', root: 'impulse_drive', color: '#5dff8a', label: 'DRIVE' },
            { id: 'power', root: 'reactor', color: '#ff7a45', label: 'POWER' },
            { id: 'diplo', root: 'embassy', color: '#ff5cab', label: 'DIPLO' }
        ].filter((t) => byId[t.root]);

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
        const nodeSize = 104;
        const half = nodeSize / 2;
        const padX = 56;
        const padY = 48;
        const rowH = 188;
        const sibGap = 168;
        const treeGap = 96;
        const topY = padY + half + 36;
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

        const legend = TREES.map((t) =>
            `<span class="hs-upg-branch-chip" style="--upg-branch:${t.color}">` +
            `<i style="background:${t.color}"></i>${t.label}</span>`
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
                `<span class="hs-upg-icon">${this.iconHtml((node.icon || 'hsUpgrade') + '@d', iconPx, 'hs-pixel')}</span>` +
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
            `<div class="hs-upg-branch-legend">${legend}</div>` +
            `<div class="hs-upg-tree-scroll">` +
            `<div class="hs-upg-tree" style="width:${treeW}px;min-width:100%;height:${treeH}px">` +
            colLabels +
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
