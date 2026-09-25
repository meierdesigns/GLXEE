"use strict";

// ShipViewerUI methods, split from ship-viewer.js.
extendClass(ShipViewerUI, {
    statIconHtml(key, size) {
        const px = size || 16;
        if (typeof iconRenderer !== 'undefined') {
            const html = iconRenderer.imgHtml(key, px, 'cv-stat-icon-img');
            if (html) return html;
        }
        return '';
    },

    weaponIconKey(weapon) {
        const w = String(weapon || '').toLowerCase();
        const map = {
            laser: 'shotLaser',
            rapid: 'shotRapid',
            spread: 'shotSpread',
            plasma: 'shotPlasma',
            missile: 'shotMissile',
            ion: 'shotIon',
            wave: 'shotWave',
            burst: 'shotBurst',
            pierce: 'shotPierce',
            nova: 'shotNova'
        };
        return map[w] || 'statWeapon';
    },

    statRowHtml(iconKey, label, value, extraClass, valueClass) {
        const icon = this.statIconHtml(iconKey, 16);
        const cls = extraClass ? ` ${extraClass}` : '';
        const vCls = valueClass ? ` ${valueClass}` : '';
        return `<div class="stat-row${cls}">` +
            `<span class="stat-label"><span class="cv-stat-icon">${icon}</span>${label}</span>` +
            `<span class="stat-value${vCls}">${value}</span>` +
            `</div>`;
    },

    renderDetail() {
        const root = this.overlay && this.overlay.querySelector('#svDetail');
        const s = this.ships[this.selectedIndex];
        if (!root || !s) return;
        const cfg = typeof shipConfigManager !== 'undefined' ? shipConfigManager.getConfig(s.id) : null;
        const abilities = (cfg && cfg.abilities) || [];
        const abilityChips = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.formatAbilityChipsHtml(abilities)
            : (abilities.length ? abilities.join(', ') : '—');
        const weaponKey = this.weaponIconKey(s.weapon);
        root.innerHTML = `
            <div class="content-viewer-hero cv-ship-hero">
                <canvas class="cv-ship-preview" width="64" height="64" id="svHeroCanvas"></canvas>
                <div class="cv-ship-hero-text">
                    <h3 class="content-viewer-name">${s.name}</h3>
                    <p class="content-viewer-desc">${s.description || 'No description.'}</p>
                </div>
            </div>
            <div class="content-viewer-stats cv-stat-clusters">
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Defense</div>
                    ${this.statRowHtml('statHealth', 'Health', s.maxHealth)}
                    ${this.statRowHtml('statArmor', 'Armor', s.armor)}
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Combat</div>
                    ${this.statRowHtml('statDamage', 'Damage', s.damage)}
                    ${this.statRowHtml(weaponKey, 'Weapon', String(s.weapon || '—').toUpperCase())}
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Mobility</div>
                    ${this.statRowHtml('statSpeed', 'Speed', s.speed)}
                </div>
                <div class="cv-stat-cluster">
                    <div class="cv-stat-cluster-title">Abilities</div>
                    ${this.statRowHtml('statAbilities', 'Abilities', abilityChips, 'stat-row-abilities', 'cv-ability-chips')}
                </div>
            </div>
        `;
        const hero = root.querySelector('#svHeroCanvas');
        this.paintShipIcon(hero, s.id);
        this.updateDeleteButton();
        if (this._devToggles) this._devToggles.refresh();
    },

    updateDeleteButton() {
        const btn = this.overlay && this.overlay.querySelector('#svDelete');
        const s = this.ships[this.selectedIndex];
        if (!btn) return;
        btn.disabled = !(s && s.custom);
        btn.style.opacity = btn.disabled ? '0.4' : '1';
    },

    persist() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            const s = this.ships[this.selectedIndex];
            menuStateManager.setScreen('ship-viewer', { shipId: s ? s.id : 'player' });
        }
    },

    handleKeyDown(e) {
        if (!this.visible) return;
        if (this._devToggles && this._devToggles.handleKey(e)) return;
        if (e.key === 'Escape' && this.previewFullscreen) {
            e.preventDefault();
            this.setPreviewFullscreen(false);
            return;
        }
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.selectedIndex = Math.min(this.ships.length - 1, this.selectedIndex + 1);
                this.renderList();
                this.renderDetail();
                this.resetPreviewSim();
                this.persist();
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                this.createNew();
                break;
            case 'e':
            case 'E':
            case 'Enter':
                e.preventDefault();
                this.openEditor();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.deleteSelected();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    },

    createNew() {
        if (typeof shipConfigManager === 'undefined') return;
        const current = this.ships[this.selectedIndex];
        const ship = shipConfigManager.createShip({
            baseId: current ? current.id : 'player',
            name: 'New Ship'
        });
        this.ships = this.getShipList();
        const idx = this.ships.findIndex((s) => s.id === ship.id);
        this.selectedIndex = idx >= 0 ? idx : this.ships.length - 1;
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
        this.openEditor();
    },

    deleteSelected() {
        const ship = this.ships[this.selectedIndex];
        if (!ship || !ship.custom || typeof shipConfigManager === 'undefined') return;
        shipConfigManager.deleteShip(ship.id);
        this.ships = this.getShipList();
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.ships.length - 1));
        this.renderList();
        this.renderDetail();
        this.resetPreviewSim();
        this.persist();
    },

    openEditor() {
        const ship = this.ships[this.selectedIndex];
        if (!ship || typeof shipEditorUI === 'undefined') return;
        this.hide();
        shipEditorUI.show(ship.id, undefined, false, { returnTo: 'ship-viewer' });
    },

    openGfxEditor() {
        const ship = this.ships[this.selectedIndex];
        if (!ship || typeof componentEditorUI === 'undefined') return;
        let type = 'ship';
        let id = ship.id;
        if (typeof assetGenRegistry !== 'undefined' && assetGenRegistry.findByKey) {
            const hit = assetGenRegistry.findByKey(ship.id)
                || assetGenRegistry.findByKey(String(ship.id).replace(/_/g, '-'));
            if (hit) {
                type = hit.type;
                id = hit.id;
            }
        }
        const returnCb = this.onClose;
        this.hide();
        componentEditorUI.open({
            type: type,
            id: id,
            returnTo: 'ship-viewer',
            onClose: () => {
                this.show({ onClose: returnCb });
            }
        });
    },

    close() {
        this.hide();
        const container = document.querySelector('.game-container');
        const inGame = container && container.style.display !== 'none';
        if (inGame) {
            if (typeof menuStateManager !== 'undefined') menuStateManager.setScreen('ingame');
            return;
        }
        if (this.onClose) {
            const cb = this.onClose;
            this.onClose = null;
            cb();
            return;
        }
        if (typeof homeStationUI !== 'undefined') {
            homeStationUI.show({
                tab: 'explorations',
                focusExplore: 'ships',
                onClose: () => {
                    if (typeof startScreenManager !== 'undefined') startScreenManager.show();
                }
            });
        } else if (typeof startScreenManager !== 'undefined') {
            startScreenManager.show();
        } else if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
    },
});
