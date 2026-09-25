"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
    onComponentPropertyChange(property, value) {
        const entry = this.currentEntry();
        if (!entry) return;

        console.log(`Component property changed: ${property} = ${value}`, entry);

        // Update the entry with the new value
        if (property === "weapon") {
            entry.weaponId = value;
            entry.id = value;  // Also update id
        } else if (property === "style") {
            entry.style = value;
        } else if (property === "weaponStyle") {
            entry.weaponStyle = value;
        } else if (property === "module") {
            entry.modId = value;
            entry.id = value;  // Also update id
        }

        console.log("After update:", entry);

        // Persist the changes
        if (typeof assetGenRegistry !== "undefined" && assetGenRegistry.update) {
            assetGenRegistry.update(this.typeId, entry.id, entry);
        }

        // Refresh the preview
        this.drawShipPreview();
    },
});
