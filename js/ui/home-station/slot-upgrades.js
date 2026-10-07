"use strict";

// HomeStationUI: per-slot size upgrades (S → M → L) in the hangar slot menu.
// Logic in js/core/ship-loadout/slot-sizes.js.
extendClass(HomeStationUI, {
    /** "SLOT S → M · cost · UPGRADE" row at the top of a slot's menu. */
    renderSlotUpgradeRow(kind, index) {
        if (typeof shipLoadoutManager === 'undefined' || !shipLoadoutManager.getSlotSizeLevel
            || typeof profileManager === 'undefined' || !profileManager.canPurchaseSlotUpgrade) return '';
        const shipId = this.hangarShipId;
        const slm = shipLoadoutManager;
        const size = slm.getSlotSizeLevel(shipId, kind, index);
        const split = slm.isSplitSlot(shipId, kind, index);
        const label = slm.slotSizeLabel(size);
        const kindTag = split ? 'SPLIT PAIR' : 'CENTRED';
        if (size >= slm.getMaxSlotSizeLevel()) {
            return `<div class="hs-slot-upgrade is-max"><span class="hs-slot-upgrade-label">SLOT <span class="hs-slot-size">${label}</span> · ${kindTag}</span><span class="hs-muted">MAX</span></div>`;
        }
        const check = profileManager.canPurchaseSlotUpgrade(shipId, kind, index);
        const cost = check.cost || profileManager.getSlotUpgradeCost(size + 1, split);
        const profile = this.getProfile ? this.getProfile() : profileManager.getActiveProfile();
        const costHtml = this.renderCompactCost ? this.renderCompactCost(cost, profile && profile.resources) : '';
        return `<div class="hs-slot-upgrade">` +
            `<span class="hs-slot-upgrade-label">SLOT <span class="hs-slot-size">${label}</span> → <span class="hs-slot-size">${slm.slotSizeLabel(size + 1)}</span> · ${kindTag}</span>` +
            `<span class="hs-slot-upgrade-cost">${costHtml}</span>` +
            `<button type="button" class="action-button hs-slot-upgrade-btn" data-slot-up="${kind}|${index}"${check.ok ? '' : (check.reason === 'RESOURCES' ? ' data-short="1"' : ' disabled')}>UPGRADE</button>` +
            `</div>`;
    },

    /**
     * Smoothly pan the hangar bay so the clicked slot marker sits in the
     * centre. `target` is the marker that was clicked (either half of a
     * split pair); without it the slot's main marker is used.
     */
    panHangarToSlot(kind, index, target) {
        const canvas = this.overlay && this.overlay.querySelector('#hsHangarBayCanvas');
        const marker = (target && target.classList && target.classList.contains('hs-hangar-slot-pin'))
            ? target
            : this.overlay && this.overlay.querySelector(
                `.hs-hangar-slot[data-slot-kind="${kind}"][data-slot-index="${index}"] .hs-hangar-slot-pin:not(.is-mirror)`);
        if (!canvas || !marker) return;
        const cr = canvas.getBoundingClientRect();
        const pr = marker.getBoundingClientRect();
        if (!pr.width && !pr.height) return;
        const px = pr.left + pr.width / 2;
        const py = pr.top + pr.height / 2;
        // Screen → canvas pixels (the pan offset is in canvas pixels).
        const sx = canvas.width / Math.max(1, cr.width);
        const sy = canvas.height / Math.max(1, cr.height);
        const dx = (cr.left + cr.width / 2 - px) * sx;
        const dy = (cr.top + cr.height / 2 - py) * sy;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        const fromX = this._hangarBayPanX || 0;
        const fromY = this._hangarBayPanY || 0;
        const start = performance.now();
        const dur = 260;
        if (this._hangarPanRaf) cancelAnimationFrame(this._hangarPanRaf);
        const step = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const e = 1 - Math.pow(1 - t, 3);
            this._hangarBayPanX = Math.round(fromX + dx * e);
            this._hangarBayPanY = Math.round(fromY + dy * e);
            if (this.isVisible && this.tab === 'hangar') this.drawHangarBay();
            this._hangarPanRaf = t < 1 ? requestAnimationFrame(step) : 0;
        };
        this._hangarPanRaf = requestAnimationFrame(step);
    },

    bindSlotUpgradeEvents() {
        if (!this.overlay) return;
        this.overlay.querySelectorAll('[data-slot-up]').forEach((btn) => {
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const [kind, idx] = (btn.getAttribute('data-slot-up') || '').split('|');
                const index = Number(idx) || 0;
                const res = profileManager.purchaseSlotUpgrade(this.hangarShipId, kind, index);
                if (res.ok) {
                    this.statusMsg = 'SLOT UPGRADED → ' + shipLoadoutManager.slotSizeLabel(res.size);
                    // Keep the slot's menu open after the rebuild.
                    this._hangarOpenSlot = { kind: kind, index: index };
                    this.createUI();
                } else if (res.reason === 'RESOURCES' && this.openResourceBuyModal) {
                    this.playButtonResult(btn, false, 'NOT ENOUGH RESOURCES');
                } else {
                    this.playButtonResult(btn, false, res.reason || 'NOT AVAILABLE');
                }
            });
        });
    }
});

// Hangar header stat tile: icon · label / big value · detail line.
extendClass(HomeStationUI, {
    hangarStatTile(icon, label, valueHtml, title, detailHtml, extraClass, tint) {
        // Icons sit bare in the title bar: tint them (accent by default) so they don't fall back to white.
        let color = tint || null;
        if (!color) {
            try {
                const v = getComputedStyle(this.overlay || document.documentElement).getPropertyValue('--color-primary').trim();
                if (v && v.charAt(0) === '#') color = v;
            } catch (e) { /* ignore */ }
        }
        return `<div class="hs-hangar-stat${extraClass || ''}" title="${String(title || '').replace(/"/g, '&quot;')}">` +
            `<span class="hs-stat-icon">${this.iconHtml(icon, 32, 'hs-pixel', label, color)}</span>` +
            `<span class="hs-stat-body">` +
                `<em>${label}</em>` +
                `<strong class="hs-stat-value">${valueHtml}</strong>` +
                (detailHtml ? `<span class="hs-stat-detail">${detailHtml}</span>` : '') +
            `</span>` +
            `</div>`;
    }
});
