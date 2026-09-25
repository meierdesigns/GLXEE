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
            scroll.addEventListener('pointerdown', (e) => {
                if (e.button !== 2) return;
                pan = {
                    x: e.clientX,
                    y: e.clientY,
                    left: scroll.scrollLeft,
                    top: scroll.scrollTop
                };
                scroll.classList.add('is-panning');
                scroll.setPointerCapture(e.pointerId);
                e.preventDefault();
            });
            scroll.addEventListener('pointermove', (e) => {
                if (!pan) return;
                scroll.scrollLeft = pan.left - (e.clientX - pan.x);
                scroll.scrollTop = pan.top - (e.clientY - pan.y);
                e.preventDefault();
            });
            const stopPan = (e) => {
                if (!pan) return;
                pan = null;
                scroll.classList.remove('is-panning');
                if (e && scroll.hasPointerCapture(e.pointerId)) {
                    scroll.releasePointerCapture(e.pointerId);
                }
            };
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
        const pos = {};
        let maxX = 0;
        let maxY = 0;
        order.forEach((id) => {
            const node = economyConfig.getStationUpgradeNode(id);
            if (!node) return;
            nodes.push(node);
            byId[node.id] = node;
            const tx = Number(node.treeX != null ? node.treeX : ((node.treeCol || 0) + 0.5) * 20);
            const ty = Number(node.treeY != null ? node.treeY : ((node.treeRow || 0) + 0.5) * 20);
            pos[node.id] = { tx, ty };
            maxX = Math.max(maxX, tx);
            maxY = Math.max(maxY, ty);
        });
        const nodeSize = 76;
        const half = nodeSize / 2;
        const padX = 56;
        const padY = 56;
        const scaleX = 12.4;
        const scaleY = 10.2;
        const treeW = Math.ceil(padX * 2 + maxX * scaleX + nodeSize);
        const treeH = Math.ceil(padY * 2 + maxY * scaleY + nodeSize);

        const centerOf = (node) => {
            const p = pos[node.id] || { tx: 0, ty: 0 };
            return {
                x: Math.round(padX + p.tx * scaleX),
                y: Math.round(padY + p.ty * scaleY)
            };
        };

        const kidsByParent = {};
        nodes.forEach((n) => {
            if (!n.requires || !byId[n.requires]) return;
            if (!kidsByParent[n.requires]) kidsByParent[n.requires] = [];
            kidsByParent[n.requires].push(n);
        });

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
            const gap = Math.max(12, Math.min(28, (minChildTop - parentBottom) * 0.4));
            const busY = parentBottom + gap;
            kids.forEach((k) => {
                const b = centerOf(k);
                const childLit = profileManager.getStationUpgradeLevel(k.requires, profile) >= (k.requireLevel || 1)
                    ? ' lit'
                    : '';
                const x1 = a.x;
                const y1 = parentBottom;
                const x2 = b.x;
                const y2 = b.y - half;
                const dx = Math.abs(x2 - x1);
                let d;
                if (dx < 6) {
                    d = `M ${Math.round(x1)} ${Math.round(y1)} L ${Math.round(x2)} ${Math.round(y2)}`;
                } else {
                    // Hard right-angle bus (no curves) for retro pixel look
                    d = `M ${Math.round(x1)} ${Math.round(y1)}` +
                        ` L ${Math.round(x1)} ${Math.round(busY)}` +
                        ` L ${Math.round(x2)} ${Math.round(busY)}` +
                        ` L ${Math.round(x2)} ${Math.round(y2)}`;
                }
                linkParts.push(
                    `<path class="hs-upg-link${childLit}" d="${d}" fill="none"/>`
                );
            });
        });

        const selectedId = this.selectedUpgradeNode && byId[this.selectedUpgradeNode]
            ? this.selectedUpgradeNode
            : (nodes[0] && nodes[0].id);

        const nodeButtons = nodes.map((node) => {
            const level = profileManager.getStationUpgradeLevel(node.id, profile);
            const maxed = level >= node.maxLevel;
            const check = profileManager.canUnlockStationUpgrade(node.id, profile);
            const locked = !maxed && check.reason === 'LOCKED';
            const cost = !maxed
                ? economyConfig.getStationUpgradeCost(node.id, level + 1)
                : null;
            let stateClass = 'hs-upg-node';
            if (maxed) stateClass += ' maxed';
            else if (locked) stateClass += ' locked';
            else if (check.ok) stateClass += ' available';
            else stateClass += ' blocked';
            if (node.id === selectedId) stateClass += ' selected';

            const c = centerOf(node);
            const left = c.x - half;
            const top = c.y - half;
            const canBuy = !maxed && !locked && check.ok;
            const tip = this.buildUpgradeTooltip(node, level, maxed, locked, check, cost, false);

            const leftPercent = (left / treeW) * 100;
            return `<button type="button" class="${stateClass}" style="left:${leftPercent}%;top:${top}px;width:${nodeSize}px;height:${nodeSize}px"` +
                ` data-nav-item data-upgrade-node="${node.id}"` +
                (canBuy ? ` data-upgrade="${node.id}"` : '') +
                ` aria-label="${node.label} ${level}/${node.maxLevel}">` +
                `<span class="hs-upg-face" aria-hidden="true"></span>` +
                `<span class="hs-upg-icon">${this.iconHtml(node.icon || 'hsUpgrade', 40, 'hs-pixel')}</span>` +
                this.buildUpgradeSlotBadges(level, node.maxLevel) +
                tip +
                `</button>`;
        }).join('');

        const sel = byId[selectedId];
        let dock = '';
        if (sel) {
            const level = profileManager.getStationUpgradeLevel(sel.id, profile);
            const maxed = level >= sel.maxLevel;
            const check = profileManager.canUnlockStationUpgrade(sel.id, profile);
            const locked = !maxed && check.reason === 'LOCKED';
            const cost = !maxed ? economyConfig.getStationUpgradeCost(sel.id, level + 1) : null;
            dock = `<div class="hs-upg-dock">${this.buildUpgradeTooltip(sel, level, maxed, locked, check, cost, false)
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
            `<div class="hs-upg-tree-scroll">` +
            `<div class="hs-upg-tree" style="width:100%;height:${treeH}px">` +
            `<svg class="hs-upg-links" width="100%" height="${treeH}" viewBox="0 0 ${treeW} ${treeH}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${linkParts.join('')}</svg>` +
            nodeButtons +
            `</div></div>` +
            dock;
    },

    renderShipFrameUpgrades(profile) {
        const owned = profile.ownedShipIds || [];
        if (!owned.length) {
            return '<p class="hs-muted hs-empty-slot">NO SHIPS OWNED</p>';
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
                action = `<button class="action-button hs-line-action" data-frame-up="${id}" ${check.ok ? '' : 'disabled'}>` +
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
