"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    switchSubTab(dir) {
        if (this.tab === 'shop') {
            const ids = this._shopCategories;
            const idx = ids.indexOf(this.shopCategory);
            const next = ids[(idx + dir + ids.length) % ids.length];
            const prev = this.shopCategory;
            this.shopCategory = next;
            this.resetShopControlsIfNeeded(prev);
            this.statusMsg = '';
            this._navLevel = 'sub';
            this.persistTab();
            this.createUI();
            return true;
        }
        if (this.tab === 'upgrade') {
            const ids = this._upgradeSubTabs;
            const idx = ids.indexOf(this.upgradeSubTab);
            const next = ids[(idx + dir + ids.length) % ids.length];
            this.upgradeSubTab = next;
            this._resBuyModal = null;
            this.statusMsg = '';
            this._navLevel = 'sub';
            this.createUI();
            return true;
        }
        return false;
    },

    syncNavHint() {
        this.syncNavZone();
        if (!this.overlay || this.tab === 'menu') return;
        const hint = this.overlay.querySelector('.hs-footer .profile-selection-instructions p');
        if (!hint) return;
        const level = this.getNavLevel();
        if (this.tab === 'play') {
            if (this.isPlayMapActive()) {
                hint.textContent = '[MAP] ARROWS Planets | ENTER Start Mission | ESC/BACKSPACE Back to Tabs';
            } else {
                hint.textContent = '[TABS] ←→ Switch | ENTER Enter Map | ESC/BACKSPACE Menu';
            }
            return;
        }
        if (level === 'sub') {
            hint.textContent = '[SECTION] ←→ Switch | ENTER Enter Content | ESC/BACKSPACE Back to Tabs';
            return;
        }
        if (level === 'content') {
            const back = this.hasSubTabs() ? 'ESC/BACKSPACE Back to Section' : 'ESC/BACKSPACE Back to Tabs';
            if (this.tab === 'components') {
                hint.textContent = `[CONTENT] ↑↓←→ Navigate | GENERATE / ACCEPT | ${back}`;
            } else {
                hint.textContent = `[CONTENT] ↑↓←→ Navigate | ENTER Select | ${back}`;
            }
            return;
        }
        const enterLabel = this.hasSubTabs() ? 'ENTER Sections | SHIFT+ENTER Content' : 'ENTER Enter Tab';
        hint.textContent = `[TABS] ←→ Switch | ${enterLabel} | ESC/BACKSPACE Menu`;
    },

    syncNavZone() {
        if (!this.overlay) return;
        const root = this.overlay.querySelector('.home-station-content');
        if (!root) return;
        root.classList.remove('hs-nav-tabs', 'hs-nav-sub', 'hs-nav-content', 'hs-nav-menu');
        if (this.tab === 'menu') {
            root.classList.add('hs-nav-menu');
            return;
        }
        const level = this.getNavLevel();
        if (level === 'sub') root.classList.add('hs-nav-sub');
        else if (level === 'content') root.classList.add('hs-nav-content');
        else root.classList.add('hs-nav-tabs');
    },

    syncPlayHint() {
        this.syncNavHint();
    },

    unmountPlayTab() {
        if (typeof galaxyMapManager === 'undefined') return;
        if (galaxyMapManager.isVisible && galaxyMapManager._mountEl) {
            galaxyMapManager.hide();
        }
    },

    focusActiveTab() {
        const list = this.getFocusables();
        const active = this.overlay && (
            (this.tab === 'menu' && this.overlay.querySelector('.hs-menu-tab-btn.active')) ||
            this.overlay.querySelector('.hs-tab.active') ||
            this.overlay.querySelector('.hs-home-btn.active')
        );
        const idx = active ? list.indexOf(active) : -1;
        if (idx >= 0) this.focusIndex = idx;
        this.refreshFocus();
    },

    renderResourceList(map, bagKind) {
        const ids = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : Object.keys(map || {});
        const profile = this.getProfile();
        const stats = (typeof profileManager !== 'undefined' && profile)
            ? profileManager.getStationStats(profile)
            : { resourceCap: 80, cargoCap: 40 };
        const cap = bagKind === 'cargo' ? stats.cargoCap : stats.resourceCap;
        const parts = ids.map((id) => {
            const n = (map && map[id]) || 0;
            const label = (typeof economyConfig !== 'undefined')
                ? economyConfig.getResourceLabel(id)
                : id.toUpperCase();
            const empty = n <= 0 ? ' hs-res-empty' : '';
            const full = n >= cap ? ' hs-res-full' : '';
            return `<span class="hs-chip hs-res-chip hs-res-${id}${empty}${full}">` +
                `<span class="hs-chip-icon">${this.iconHtml(this.resourceIconKey(id), 32, 'hs-pixel')}</span>` +
                `<span class="hs-chip-meta">` +
                `<span class="hs-chip-label">${label}</span>` +
                `<span class="hs-chip-value">${n}<span class="hs-chip-cap">/${cap}</span></span>` +
                `</span>` +
                `</span>`;
        });
        return parts.join('') || '<span class="hs-muted hs-empty-slot">EMPTY</span>';
    },

    formatUpgradeEffect(node, level) {
        if (!node || typeof node.effect !== 'function' || level <= 0) return '—';
        const bonus = node.effect(level) || {};
        const parts = [];
        if (bonus.resourceCap) parts.push('+' + bonus.resourceCap + ' STORE');
        if (bonus.cargoCap) parts.push('+' + bonus.cargoCap + ' CARGO');
        if (bonus.shipSlots) parts.push('+' + bonus.shipSlots + ' SHIP SLOT' + (bonus.shipSlots > 1 ? 'S' : ''));
        if (bonus.craftDiscount) parts.push('-' + Math.round(bonus.craftDiscount * 100) + '% CRAFT');
        if (bonus.dropBonus) parts.push('+' + Math.round(bonus.dropBonus * 1000) / 10 + '% BP DROP');
        if (bonus.impulseDrive) parts.push('IMPULSE READY');
        if (bonus.warpDrive) parts.push('WARP ' + bonus.warpDrive);
        if (bonus.exploreBudget) parts.push('+' + bonus.exploreBudget + ' EXPLORE');
        return parts.join(' · ') || 'ACTIVE';
    },

    buildUpgradeSlotBadges(level, maxLevel) {
        const max = Math.max(1, Math.round(Number(maxLevel) || 1));
        const filled = Math.max(0, Math.min(max, Math.round(Number(level) || 0)));
        const slots = [];
        for (let i = 0; i < max; i++) {
            slots.push(`<span class="hs-upg-slot${i < filled ? ' filled' : ''}"></span>`);
        }
        return `<span class="hs-upg-slots" aria-hidden="true">${slots.join('')}</span>`;
    },

    renderUpgradeSubTabs() {
        return this._upgradeSubTabs.map((id) => {
            const meta = this._upgradeSubMeta[id] || { label: id.toUpperCase() };
            const active = this.upgradeSubTab === id;
            return `<button type="button" class="hs-shop-cat ${active ? 'active' : ''}" data-upgrade-sub="${id}" data-nav-item>` +
                `<span class="hs-chip-icon">${this.iconHtml(meta.icon, 32, 'hs-pixel')}</span>` +
                `<span>${meta.label}</span></button>`;
        }).join('');
    },

    buildUpgradeTooltip(node, level, maxed, locked, check, cost, tipBelow) {
        const price = cost ? this.formatBagMap(cost) : '';
        let statusLine = '';
        if (maxed) {
            statusLine = '<div class="hs-upg-tip-row">STATUS · MAX</div>';
        } else if (locked) {
            const req = economyConfig.getStationUpgradeNode(node.requires);
            const reqName = req ? req.label : String(node.requires || '').toUpperCase();
            statusLine = `<div class="hs-upg-tip-row">REQ · ${reqName} ${node.requireLevel || 1}</div>`;
        } else if (check && check.ok) {
            statusLine = `<div class="hs-upg-tip-row hs-upg-tip-ok">UPGRADE · ${price}</div>`;
        } else {
            statusLine = `<div class="hs-upg-tip-row">NEED · ${price || (check && check.reason) || '—'}</div>`;
        }
        return `<div class="hs-upg-tip${tipBelow ? ' below' : ''}" role="tooltip">` +
            `<div class="hs-upg-tip-title">${node.label} · ${level}/${node.maxLevel}</div>` +
            `<div class="hs-upg-tip-desc">${node.desc || ''}</div>` +
            `<div class="hs-upg-tip-row">${level > 0 ? 'NOW · ' + this.formatUpgradeEffect(node, level) : 'NOT BUILT'}</div>` +
            (!maxed ? `<div class="hs-upg-tip-row">NEXT · ${this.formatUpgradeEffect(node, level + 1)}</div>` : '') +
            statusLine +
            `</div>`;
    },

    ensureUpgradeTipHost() {
        if (this._upgTipHost && this._upgTipHost.isConnected) return this._upgTipHost;
        const el = document.createElement('div');
        el.className = 'hs-upg-tip hs-upg-tip-float';
        el.setAttribute('role', 'tooltip');
        el.hidden = true;
        document.body.appendChild(el);
        this._upgTipHost = el;
        return el;
    },

    showUpgradeTip(btn) {
        if (!btn || !btn.isConnected) {
            this.hideUpgradeTip();
            return;
        }
        const source = btn.querySelector('.hs-upg-tip');
        if (!source) {
            this.hideUpgradeTip();
            return;
        }
        const host = this.ensureUpgradeTipHost();
        this._upgTipBtn = btn;
        host.innerHTML = source.innerHTML;
        host.hidden = false;
        host.classList.add('visible');
        host.classList.remove('below');
        if (this._upgTipRaf) cancelAnimationFrame(this._upgTipRaf);
        this._upgTipRaf = requestAnimationFrame(() => {
            this._upgTipRaf = 0;
            if (this._upgTipBtn !== btn || !btn.isConnected) return;
            this.positionUpgradeTip(btn, host);
        });
    },

    positionUpgradeTip(btn, host) {
        if (!btn || !host || !btn.isConnected) {
            this.hideUpgradeTip();
            return;
        }
        const r = btn.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
            this.hideUpgradeTip();
            return;
        }
        const tw = host.offsetWidth;
        const th = host.offsetHeight;
        let left = r.left + (r.width / 2) - (tw / 2);
        let top = r.top - th - 12;
        host.classList.remove('below');
        if (top < 8) {
            top = r.bottom + 12;
            host.classList.add('below');
        }
        left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
        if (top + th > window.innerHeight - 8 && !host.classList.contains('below')) {
            top = Math.max(8, window.innerHeight - th - 8);
        }
        host.style.left = Math.round(left) + 'px';
        host.style.top = Math.round(top) + 'px';
    },

    hideUpgradeTip() {
        this._upgTipBtn = null;
        if (this._upgTipRaf) {
            cancelAnimationFrame(this._upgTipRaf);
            this._upgTipRaf = 0;
        }
        if (!this._upgTipHost) return;
        this._upgTipHost.classList.remove('visible', 'below');
        this._upgTipHost.hidden = true;
        this._upgTipHost.innerHTML = '';
        this._upgTipHost.style.left = '';
        this._upgTipHost.style.top = '';
    },
});
