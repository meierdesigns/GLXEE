"use strict";

// ComponentEditorUI methods, split from component-editor.js.
// Delete / Rename are only wired up for the ICONS type, since that is the
// only entry source with a persistence layer (iconJsonStore -> icons-data.json
// + localStorage). Other types are read-only projections (see core.js listEntries()).
extendClass(ComponentEditorUI, {
    updateIconActionButtons() {
        const r = this.root;
        if (!r) return;
        const delBtn = r.querySelector("#ceDeleteEntry");
        const renBtn = r.querySelector("#ceRenameEntry");
        const enabled = this.typeId === "icon" && !!this.currentEntry();
        if (delBtn) delBtn.disabled = !enabled;
        if (renBtn) renBtn.disabled = !enabled;
    },

    onDeleteIcon() {
        if (this.typeId !== "icon") return;
        const entry = this.currentEntry();
        if (!entry) return;
        const key = entry.spriteKey || entry.id;
        if (!window.confirm(`Delete icon "${entry.label}"? This cannot be undone.`)) return;
        if (typeof IconSprites !== "undefined" && IconSprites) delete IconSprites[key];
        if (typeof IconColors !== "undefined" && IconColors) delete IconColors[key];
        if (typeof iconJsonStore !== "undefined") {
            delete iconJsonStore.data[key];
            iconJsonStore._persistLocal();
        }
        try {
            if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) iconRenderer.clearCache();
        } catch (e) { /* ignore */ }
        this.selectedId = null;
        this.persistSelection();
        this.clearStaging();
        this.refreshAll();
    },

    onRenameIcon() {
        if (this.typeId !== "icon") return;
        const entry = this.currentEntry();
        if (!entry) return;
        const oldKey = entry.spriteKey || entry.id;
        const input = window.prompt("Rename icon", oldKey);
        if (input == null) return;
        const newKey = input.trim();
        if (!newKey || newKey === oldKey) return;
        if (typeof IconSprites !== "undefined" && IconSprites && IconSprites[newKey] != null) {
            window.alert(`An icon named "${newKey}" already exists.`);
            return;
        }
        if (typeof IconSprites !== "undefined" && IconSprites) {
            IconSprites[newKey] = IconSprites[oldKey];
            delete IconSprites[oldKey];
        }
        if (typeof IconColors !== "undefined" && IconColors && IconColors[oldKey] != null) {
            IconColors[newKey] = IconColors[oldKey];
            delete IconColors[oldKey];
        }
        if (typeof iconJsonStore !== "undefined" && iconJsonStore.data[oldKey]) {
            iconJsonStore.data[newKey] = iconJsonStore.data[oldKey];
            delete iconJsonStore.data[oldKey];
            iconJsonStore._persistLocal();
        }
        try {
            if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) iconRenderer.clearCache();
        } catch (e) { /* ignore */ }
        this.selectedId = newKey;
        this.persistSelection();
        this.refreshAll();
    },
});
