# Hangar UI Refactoring

## Überblick

Diese Refaktorierung teilt die **5700+ Zeilen große `HomeStationUI` Klasse** in spezialisierte, wartbare Module auf. Der Fokus liegt auf:
- ✅ **Code Separation of Concerns** - Jedes Modul hat eine Verantwortung
- ✅ **Bessere Wartbarkeit** - Einfacher zu verstehen und zu ändern
- ✅ **Modern CSS** - Responsive Grid-Layout statt verschachteltem HTML
- ✅ **Klare API** - Öffentliche Methoden sind eindeutig dokumentiert

---

## Neue Struktur

### Alte Struktur (Monolith)
```
HomeStationUI (5700+ lines)
├── Station Tab
├── Upgrade Tab
├── Hangar Tab ← 1000+ Zeilen hier
├── Shop Tab
├── Craft Tab
└── Components Tab
```

### Neue Struktur (Modular)
```
HomeStationUI (gekürzt, nur Tab-Manager)
├── HangarUI (hangar-ui.js) ← neue Klasse
├── ShopUI (shop-ui.js) ← TODO
├── CraftUI (craft-ui.js) ← TODO
└── UpgradeUI (upgrade-ui.js) ← TODO
```

---

## Neue Datei: `hangar-ui.js`

### Klasse: `HangarUI`

Verwaltung aller Hangar-Funktionalität:

#### Constructor
```javascript
new HangarUI(parentHomeStationUI)
```

#### Wichtige Methoden

| Methode | Beschreibung |
|---------|------------|
| `render()` | Gibt HTML-String für den Hangar zurück |
| `setShip(shipId)` | Wechselt zum angegebenen Schiff |
| `selectSlot(idx)` | Wählt einen Slot für Details-Anzeige |
| `onSlotEquipmentChange(idx, itemId)` | Handle Slot-Ausrüstungswechsel |
| `destroy()` | Cleanup bei Schließung |

#### State Properties

```javascript
this.shipId              // Aktuell angezeigtes Schiff
this.selectedSlot        // Index des ausgewählten Slots
this.leftCollapsed       // Sidebar-Status
this.rightCollapsed      // Sidebar-Status
```

---

## Neues CSS: Modernes Grid-Layout

### Features

1. **3-Spalten Grid** (PC) / **Responsiv** (Mobile)
   ```css
   grid-template-columns: 280px 1fr 280px;
   ```

2. **Collapsible Sidebars**
   - Speichert Zustand in `localStorage`
   - Smooth Transitions

3. **Moderne Farben**
   - Basis: `rgba(0,20,40,0.7)` (dunkles Blau)
   - Accent: `#00ffcc` (Cyan)
   - Hover: `rgba(0,255,200,0.2)`

4. **Komponenten**
   - `.hs-hangar-container` - Main Layout
   - `.hs-hangar-left-panel` - Slot-Konfiguration
   - `.hs-hangar-preview` - Canvas-Vorschau
   - `.hs-hangar-right-panel` - Slot-Details
   - `.hs-slot-item` - Individual Slots (selectable)

---

## Integration in HomeStationUI

### Schritt 1: Instanz erstellen
```javascript
class HomeStationUI {
    constructor() {
        // ... andere Inits ...
        this.hangarUI = new HangarUI(this);
    }
}
```

### Schritt 2: In `renderTabs()` verwenden
```javascript
renderTabs() {
    // ...
    if (this.tab === 'hangar') {
        return this.hangarUI.render();
    }
}
```

### Schritt 3: Event-Handler delegieren
```javascript
// Slot selection
root.addEventListener('click', (e) => {
    const slot = e.target.closest('.hs-slot-item');
    if (slot) {
        const idx = parseInt(slot.dataset.slotIdx);
        this.hangarUI.onSlotSelected(idx);
    }
});

// Equipment change
root.addEventListener('change', (e) => {
    if (e.target.classList.contains('hs-hangar-slot-select')) {
        const idx = parseInt(e.target.dataset.slotIdx);
        this.hangarUI.onSlotEquipmentChange(idx, e.target.value);
    }
});
```

---

## Migration Path

### Phase 1: HangarUI Modul
- [x] `hangar-ui.js` erstellt
- [x] CSS-Styles hinzugefügt
- [ ] Integration in HomeStationUI testen
- [ ] Alte Hangar-Code in home-station.js entfernen

### Phase 2: Weitere Module
- [ ] `shop-ui.js` für Shop-Tab
- [ ] `craft-ui.js` für Craft-Tab
- [ ] `upgrade-ui.js` für Upgrade-Tab

### Phase 3: Cleanup
- [ ] HomeStationUI auf Tab-Manager reduzieren
- [ ] Alte Hangar-Methoden löschen
- [ ] Tests schreiben

---

## Vorteile

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| **Dateigröße** | 5700 Zeilen (1 Datei) | 400 Zeilen × N Module |
| **Wartbarkeit** | Schwer (monolith) | Einfach (modular) |
| **Test-barkeit** | Kaum möglich | Leicht (Unit-Tests pro Modul) |
| **Wiederverwendung** | Keine | HangarUI auch in anderen Kontexten |
| **CSS Organis.** | Vermischt | Zentral in `.hs-hangar-*` Styles |
| **Debugging** | Stack-Traces schwer | Klare Modulaufteilung |

---

## Nächste Schritte

1. **Test in Browser** - Überprüfe, ob HangarUI korrekt rendert
2. **CSS-Tweaking** - Farben/Layout an Spiel anpassen
3. **Event-Handler** - Slot-Selection/Equipment-Change testen
4. **Alte Code Entfernen** - Hangar-Methoden aus home-station.js löschen
5. **Andere Tabs** - Shop/Craft/Upgrade Module erstellen

---

## Notizen

- `HangarUI.render()` gibt nur HTML zurück — keine direkte DOM-Manipulation
- Alle Events werden durch Parent-Element delegiert (event delegation)
- State wird in `HangarUI` gehalten, nicht in DOM
- localStorage wird für Sidebar-Preferences verwendet (persistent)
