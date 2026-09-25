"use strict";

/**
 * HangarUI — Extracted hangar functionality from HomeStationUI
 * Manages ship preview, slot management, and module configuration
 */
class HangarUI {
    constructor(parent) {
        this.parent = parent; // HomeStationUI instance
        this.shipId = null;
        this.selectedSlot = null;
        this.slotDragState = null;
        this.previewAnimId = null;
        this.previewLastTs = 0;
        this.previewSim = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewZoom = 1;
        this.wheelBound = null;
        this.panelResize = null;
        this.leftCollapsed = false;
        this.rightCollapsed = false;
        
        this._loadPrefs();
    }

    _loadPrefs() {
        try {
            const raw = localStorage.getItem('vf_hs_hangar_sidebar_prefs_v1');
            const prefs = raw ? JSON.parse(raw) : null;
            if (prefs && typeof prefs === 'object') {
                this.leftCollapsed = prefs.left === true;
                this.rightCollapsed = prefs.right === true;
            }
        } catch (e) { /* ignore */ }
    }

    savePrefs() {
        try {
            localStorage.setItem('vf_hs_hangar_sidebar_prefs_v1', JSON.stringify({
                left: this.leftCollapsed,
                right: this.rightCollapsed
            }));
        } catch (e) { /* ignore */ }
    }

    setShip(shipId) {
        this.shipId = shipId;
        this.selectedSlot = null;
    }

    selectSlot(slotIndex) {
        this.selectedSlot = slotIndex;
    }

    render() {
        const profile = this.parent.getProfile();
        if (!profile) return '';
        
        const ship = profile.ships && profile.ships[this.shipId];
        if (!ship) return `<div class="hs-hangar-empty">Select a ship to view</div>`;
        
        return `
            <div class="hs-hangar-container">
                ${this._renderLeftPanel(profile, ship)}
                ${this._renderPreviewPanel(ship)}
                ${this._renderRightPanel(profile, ship)}
            </div>
        `;
    }

    _renderLeftPanel(profile, ship) {
        const collapsed = this.leftCollapsed ? ' collapsed' : '';
        return `
            <div class="hs-hangar-left-panel${collapsed}">
                <div class="hs-hangar-panel-header">
                    <h3>CONFIGURATION</h3>
                    <button class="hs-hangar-collapse-btn" data-side="left">−</button>
                </div>
                <div class="hs-hangar-panel-body">
                    ${this._renderShipInfo(ship)}
                    ${this._renderSlotsList(profile, ship)}
                </div>
            </div>
        `;
    }

    _renderShipInfo(ship) {
        return `
            <div class="hs-hangar-ship-info">
                <div class="hs-info-row">
                    <span class="label">SIZE:</span>
                    <span class="value">${ship.size || 'N/A'}</span>
                </div>
                <div class="hs-info-row">
                    <span class="label">POWER:</span>
                    <span class="value">${ship.power || 'N/A'}</span>
                </div>
            </div>
        `;
    }

    _renderSlotsList(profile, ship) {
        if (!ship.slots || ship.slots.length === 0) {
            return '<div class="hs-slots-empty">No slots configured</div>';
        }

        const slots = ship.slots.map((slot, idx) => {
            const isSelected = this.selectedSlot === idx ? ' selected' : '';
            const equippedByKind = this._buildEquippedByKind(profile, ship);
            return this._renderSlotItem(slot, idx, profile, ship, equippedByKind, isSelected);
        }).join('');

        return `<div class="hs-slots-list">${slots}</div>`;
    }

    _renderSlotItem(slot, idx, profile, ship, equippedByKind, selectedClass) {
        const label = this._getSlotLabel(slot);
        const current = slot.equipped || '';
        const currentLabel = this._getComponentLabel(current, profile);
        
        return `
            <div class="hs-slot-item${selectedClass}" data-slot-idx="${idx}">
                <div class="hs-slot-header">
                    <span class="hs-slot-kind">${slot.kind.toUpperCase()}</span>
                    <span class="hs-slot-index">${idx + 1}</span>
                </div>
                <div class="hs-slot-selector">
                    ${this._renderSlotDropdown(slot, idx, profile, ship, equippedByKind)}
                    ${this._renderSlotStyleDropdown(slot, idx, profile, ship)}
                </div>
                <div class="hs-slot-current">
                    ${currentLabel}
                </div>
            </div>
        `;
    }

    _renderSlotDropdown(slot, idx, profile, ship, equippedByKind) {
        const current = slot.equipped || '';
        const inventory = this._getInventoryForKind(profile, slot.kind);
        
        let options = '<option value="">— Empty —</option>';
        inventory.forEach(item => {
            const selected = item.id === current ? ' selected' : '';
            options += `<option value="${item.id}"${selected}>${item.label}</option>`;
        });
        
        return `
            <select class="hs-hangar-slot-select" data-slot-idx="${idx}" data-kind="equipment">
                ${options}
            </select>
        `;
    }

    _renderSlotStyleDropdown(slot, idx, profile, ship) {
        // Render module style/skin dropdown if applicable
        return '';
    }

    _renderPreviewPanel(ship) {
        const collapsed = this.leftCollapsed && this.rightCollapsed ? ' full-width' : '';
        return `
            <div class="hs-hangar-preview${collapsed}">
                <canvas id="hs-hangar-preview-canvas" width="600" height="400"></canvas>
                <div class="hs-hangar-preview-controls">
                    <button class="hs-zoom-btn" data-action="zoom-in">+</button>
                    <button class="hs-zoom-btn" data-action="zoom-out">−</button>
                </div>
            </div>
        `;
    }

    _renderRightPanel(profile, ship) {
        const collapsed = this.rightCollapsed ? ' collapsed' : '';
        return `
            <div class="hs-hangar-right-panel${collapsed}">
                <div class="hs-hangar-panel-header">
                    <h3>DETAILS</h3>
                    <button class="hs-hangar-collapse-btn" data-side="right">−</button>
                </div>
                <div class="hs-hangar-panel-body">
                    ${this._renderSlotDetails(profile, ship)}
                </div>
            </div>
        `;
    }

    _renderSlotDetails(profile, ship) {
        if (this.selectedSlot === null) {
            return '<div class="hs-details-empty">Select a slot to view details</div>';
        }

        const slot = ship.slots[this.selectedSlot];
        if (!slot) return '';

        const item = this._getItemById(profile, slot.equipped);
        if (!item) return '<div class="hs-details-empty">No item equipped</div>';

        return `
            <div class="hs-slot-details">
                <div class="hs-detail-name">${item.label}</div>
                <div class="hs-detail-stats">
                    ${this._renderItemStats(item)}
                </div>
                <div class="hs-detail-description">
                    ${item.description || 'No description'}
                </div>
            </div>
        `;
    }

    _renderItemStats(item) {
        // Render stats based on item type
        let stats = '';
        if (item.damage) stats += `<div class="stat">Damage: ${item.damage}</div>`;
        if (item.cooldown) stats += `<div class="stat">Cooldown: ${item.cooldown}s</div>`;
        if (item.energy) stats += `<div class="stat">Energy: ${item.energy}</div>`;
        return stats || '<div class="stat">No stats</div>';
    }

    _buildEquippedByKind(profile, ship) {
        const map = {};
        if (ship.slots) {
            ship.slots.forEach(slot => {
                if (slot.equipped) {
                    if (!map[slot.kind]) map[slot.kind] = [];
                    map[slot.kind].push(slot.equipped);
                }
            });
        }
        return map;
    }

    _getSlotLabel(slot) {
        return `${slot.kind || 'SLOT'} ${slot.index || ''}`.trim();
    }

    _getComponentLabel(id, profile) {
        if (!id) return '— Empty —';
        const item = this._getItemById(profile, id);
        return item ? item.label : id;
    }

    _getInventoryForKind(profile, kind) {
        if (!profile || !profile.inventory) return [];
        
        const inventory = [];
        const items = profile.inventory[kind] || [];
        
        items.forEach(item => {
            inventory.push({
                id: item.id,
                label: item.label || item.id
            });
        });
        
        return inventory;
    }

    _getItemById(profile, id) {
        if (!profile || !id) return null;
        
        // Search in inventory
        for (const kind in profile.inventory || {}) {
            const items = profile.inventory[kind] || [];
            const found = items.find(i => i.id === id);
            if (found) return found;
        }
        
        return null;
    }

    onSlotSelected(idx) {
        this.selectSlot(idx);
        this.parent.createUI();
    }
}
