/**
 * Integration Guide für HangarUI in HomeStationUI
 * 
 * SCHRITT-FÜR-SCHRITT Integration der neuen HangarUI Klasse
 */

// SCHRITT 1: In HomeStationUI Constructor
// ====================================
class HomeStationUI {
    constructor() {
        // ... existing code ...
        
        // NEU: HangarUI Instanz
        this.hangarUI = new HangarUI(this);
    }
}

// SCHRITT 2: In renderTabs() Methode
// ==================================
renderTabs() {
    const profile = this.getProfile();
    if (!profile) return '';
    
    let body = '';
    
    // ... other tabs ...
    
    if (this.tab === 'hangar') {
        // NEU: Nutze HangarUI zum Rendern
        body = this.hangarUI.render();
    }
    
    // ... rest of rendering ...
}

// SCHRITT 3: In bindRoot() oder equivalent
// =========================================
bindRoot() {
    const r = this.root;
    if (!r) return;
    
    // ... existing bindings ...
    
    // NEU: Hangar Event-Handler
    if (this.tab === 'hangar') {
        this._bindHangarEvents();
    }
}

_bindHangarEvents() {
    const r = this.root;
    if (!r) return;
    
    // Slot Selection
    r.addEventListener('click', (e) => {
        const slotItem = e.target.closest('.hs-slot-item');
        if (slotItem) {
            const idx = parseInt(slotItem.dataset.slotIdx);
            this.hangarUI.onSlotSelected(idx);
        }
    });
    
    // Collapse/Expand Sidebars
    r.addEventListener('click', (e) => {
        const collapseBtn = e.target.closest('.hs-hangar-collapse-btn');
        if (collapseBtn) {
            const side = collapseBtn.dataset.side;
            if (side === 'left') {
                this.hangarUI.leftCollapsed = !this.hangarUI.leftCollapsed;
            } else if (side === 'right') {
                this.hangarUI.rightCollapsed = !this.hangarUI.rightCollapsed;
            }
            this.hangarUI.savePrefs();
            this.createUI();
        }
    });
    
    // Equipment Selection
    r.addEventListener('change', (e) => {
        const select = e.target.closest('.hs-hangar-slot-select');
        if (select) {
            const idx = parseInt(select.dataset.slotIdx);
            const newId = select.value;
            this.hangarUI.onSlotEquipmentChange(idx, newId);
        }
    });
    
    // Zoom Controls
    r.addEventListener('click', (e) => {
        const zoomBtn = e.target.closest('.hs-zoom-btn');
        if (zoomBtn) {
            const action = zoomBtn.dataset.action;
            if (action === 'zoom-in') {
                this.hangarUI.previewZoom *= 1.2;
            } else if (action === 'zoom-out') {
                this.hangarUI.previewZoom /= 1.2;
            }
            this.hangarUI.previewZoom = Math.max(0.5, Math.min(3, this.hangarUI.previewZoom));
            // TODO: Redraw preview
        }
    });
}

// SCHRITT 4: In hide() Methode
// =============================
hide() {
    // ... existing code ...
    
    // NEU: Cleanup HangarUI
    if (this.hangarUI) {
        this.hangarUI.destroy();
    }
    
    // ... rest of hide ...
}

// SCHRITT 5: Setze Ship bei Navigation
// ======================================
navigateToHangarForShip(shipId) {
    this.tab = 'hangar';
    this.hangarUI.setShip(shipId);
    this.createUI();
}

// SCHRITT 6: Teste in Browser
// =============================
/*
 * Test Checklist:
 * 
 * 1. Öffne Hangar
 * 2. Überprüfe 3-Spalten-Layout:
 *    ✓ Linke Spalte (Slot-Liste)
 *    ✓ Mittlere Spalte (Preview)
 *    ✓ Rechte Spalte (Details)
 * 
 * 3. Teste Slot-Selection:
 *    ✓ Klick auf Slot → selected-Klasse
 *    ✓ Details Panel aktualisiert
 * 
 * 4. Teste Equipment-Wechsel:
 *    ✓ Dropdown wechseln → Schiff aktualisiert
 *    ✓ Preview aktualisiert
 * 
 * 5. Teste Collapse-Button:
 *    ✓ Linke Sidebar collapse
 *    ✓ Rechte Sidebar collapse
 *    ✓ Status persisted in localStorage
 * 
 * 6. Responsive Test:
 *    ✓ Desktop (1200px+) - 3-Spalten
 *    ✓ Tablet (900px) - Stack vertikal
 *    ✓ Mobile - Single column
 */

// SCHRITT 7: Performance-Tipps
// ==============================
/*
 * Event Delegation:
 * - Alle Events am root Element binden (nicht auf jedem Slot)
 * - Nutze e.target.closest() zum finden des Elements
 * - Dies reduziert Event-Listener-Count massiv
 * 
 * Render-Caching:
 * - HangarUI.render() wird bei jedem createUI() aufgerufen
 * - Falls Daten nicht geändert, könnte gecacht werden:
 *   if (this._lastShipId === this.hangarUI.shipId) return this._cachedHtml;
 * 
 * DOM Minimierung:
 * - Template-String in render() verwenden ✓
 * - Keine innerHTML bei jedem Update
 * - Nur bei Daten-Änderung re-render
 */

// SCHRITT 8: Zukünftige Verbesserungen
// ====================================
/*
 * Phase 2:
 * - Drag-Drop für Module zwischen Slots
 * - Preview Animation (rotation, pulsing)
 * - Shader/Skin-Selector für Slots
 * - Multi-Select für schnelle Vergleiche
 * 
 * Phase 3:
 * - Save/Load Loadout-Presets
 * - Export Hangar-Konfiguration
 * - Undo/Redo für Änderungen
 */
