"use strict";

// AssetGenUI methods, split from asset-gen-ui.js.
extendClass(AssetGenUI, {
    factionIds() {
        if (typeof assetGenRegistry !== "undefined" && assetGenRegistry.factionIds) {
            return assetGenRegistry.factionIds();
        }
        return ["terran", "kronax", "voidborn", "pirate", "machine"];
    },

    factionLabel(factionId) {
        if (typeof planetConfigManager !== "undefined" && planetConfigManager.getFactionMeta) {
            const meta = planetConfigManager.getFactionMeta(factionId);
            if (meta && meta.label) return meta.label;
        }
        return String(factionId || "").toUpperCase();
    },

    libraryEntriesForType() {
        if (this.isFactionLibrary() && typeof assetGenRegistry !== "undefined"
            && assetGenRegistry.listFactionLibrary) {
            return assetGenRegistry.listFactionLibrary();
        }
        return (typeof assetGenRegistry !== "undefined" && assetGenRegistry.list)
            ? (assetGenRegistry.list(this.typeId) || [])
            : [];
    },

    filteredFactionEntries() {
        const all = (typeof assetGenRegistry !== "undefined" && assetGenRegistry.listFactionLibrary)
            ? assetGenRegistry.listFactionLibrary()
            : [];
        const cat = this.factionCategory || "all";
        const q = String(this.factionFilterText || "").trim().toLowerCase();
        return all.filter((entry) => {
            if (cat !== "all" && entry.faction !== cat) return false;
            // In a specific faction tab, always show that faction's emblem (even if filter is ship-focused)
            if (cat !== "all" && entry.kind === "emblem") {
                if (!q) return true;
            }
            // On ALL tab, hide emblems from the ship table (emblem only on faction tabs)
            if (cat === "all" && entry.kind === "emblem") return false;
            if (!q) return true;
            const hay = [
                entry.label,
                entry.id,
                entry.faction,
                entry.enemyClass,
                entry.kind
            ].map((x) => String(x || "").toLowerCase()).join(" ");
            return hay.indexOf(q) >= 0;
        });
    },

    visibleLibraryEntries() {
        if (this.isFactionLibrary()) return this.filteredFactionEntries();
        return this.libraryEntriesForType();
    },

    syncFactionChrome() {
        if (!this.overlay) return;
        const chrome = this.overlay.querySelector("#agFactionChrome");
        if (!chrome) return;
        const on = this.isFactionLibrary();
        chrome.hidden = !on;
        if (!on) return;
        this.renderFactionTabs();
        const filterEl = this.overlay.querySelector("#agFactionFilter");
        if (filterEl && filterEl.value !== (this.factionFilterText || "")) {
            filterEl.value = this.factionFilterText || "";
        }
    },

    renderFactionTabs() {
        const host = this.overlay && this.overlay.querySelector("#agFactionTabs");
        if (!host) return;
        host.innerHTML = "";
        const cats = ["all"].concat(this.factionIds());
        cats.forEach((cat) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.dataset.category = cat;
            if (cat === (this.factionCategory || "all")) btn.classList.add("ag-on");
            if (cat === "all") {
                btn.textContent = "ALL";
            } else {
                const color = this.factionColor(cat);
                if (color) {
                    btn.style.setProperty("--ag-faction-color", color);
                    btn.style.borderColor = color;
                    btn.style.color = color;
                }
                const icon = document.createElement("span");
                icon.className = "ag-faction-tab-icon";
                const emblem = (typeof assetGenRegistry !== "undefined" && assetGenRegistry.listFactions)
                    ? (assetGenRegistry.listFactions().find((e) => e.faction === cat) || null)
                    : null;
                if (emblem) this.drawThumbInto(icon, emblem, 14);
                const span = document.createElement("span");
                span.textContent = this.factionLabel(cat);
                btn.appendChild(icon);
                btn.appendChild(span);
            }
            btn.addEventListener("click", () => {
                this.factionCategory = cat;
                this.saveFactionCategory();
                this.selectedId = null;
                this.clearStaging();
                this.renderList();
                this.renderDetail();
                this.persistMenuState();
            });
            host.appendChild(btn);
        });
    },

    selectLibraryEntry(entry) {
        if (!entry) return;
        this.selectedId = entry.id;
        this.clearStaging();
        this.renderList();
        this.renderDetail();
        this.persistMenuState();
    },

    renderFactionTable(listEl, entries) {
        const showFactionCol = (this.factionCategory || "all") === "all";
        const table = document.createElement("table");
        table.className = "ag-ships-table";
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr>"
            + "<th></th><th></th><th>SHIP</th>"
            + (showFactionCol ? "<th>FACTION</th>" : "")
            + "<th>SIZE</th></tr>";
        table.appendChild(thead);
        const tbody = document.createElement("tbody");

        entries.forEach((entry) => {
            const tr = document.createElement("tr");
            if (entry.id === this.selectedId) tr.classList.add("ag-on");
            tr.dataset.id = entry.id;

            const tdCb = document.createElement("td");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = this.checkedIds.has(entry.id);
            cb.addEventListener("click", (e) => e.stopPropagation());
            cb.addEventListener("change", (e) => {
                e.stopPropagation();
                if (cb.checked) this.checkedIds.add(entry.id);
                else this.checkedIds.delete(entry.id);
                this.updateSelectAllState();
            });
            tdCb.appendChild(cb);

            const tdThumb = document.createElement("td");
            const thumb = document.createElement("div");
            thumb.className = "ag-thumb";
            this.drawThumbInto(thumb, entry, 24);
            thumb.addEventListener("mouseenter", () => this.showHoverZoom(thumb, entry));
            thumb.addEventListener("mouseleave", () => this.hideHoverZoom());
            tdThumb.appendChild(thumb);

            const tdName = document.createElement("td");
            if (entry.kind === "emblem") {
                tdName.textContent = "EMBLEM";
                const kind = document.createElement("span");
                kind.className = "ag-ships-kind";
                kind.textContent = this.factionLabel(entry.faction);
                tdName.appendChild(kind);
            } else {
                tdName.textContent = String(entry.enemyClass || entry.label || "").toUpperCase();
            }

            tr.appendChild(tdCb);
            tr.appendChild(tdThumb);
            tr.appendChild(tdName);

            if (showFactionCol) {
                const tdFac = document.createElement("td");
                tdFac.textContent = this.factionLabel(entry.faction);
                tr.appendChild(tdFac);
            }

            const tdSize = document.createElement("td");
            tdSize.textContent = String(entry.size != null ? entry.size : "—");
            tr.appendChild(tdSize);

            tr.addEventListener("click", () => this.selectLibraryEntry(entry));
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        listEl.appendChild(table);
    },

    renderList() {
        if (!this.overlay) return;
        const list = this.overlay.querySelector("#agList");
        list.innerHTML = "";
        this.syncFactionChrome();

        const entries = this.visibleLibraryEntries();
        if (!this.selectedId && entries[0]) this.selectedId = entries[0].id;
        const valid = new Set(this.libraryEntriesForType().map((e) => e.id));
        this.checkedIds = new Set([...this.checkedIds].filter((id) => valid.has(id)));

        if (this.isFactionLibrary()) {
            this.renderFactionTable(list, entries);
            this.updateSelectAllState();
            const on = list.querySelector("tr.ag-on");
            if (on) on.scrollIntoView({ block: "nearest" });
            return;
        }

        entries.forEach((entry) => {
            const row = document.createElement("div");
            row.className = "ag-list-item" + (entry.id === this.selectedId ? " ag-on" : "");
            row.dataset.id = entry.id;

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = this.checkedIds.has(entry.id);
            cb.addEventListener("click", (e) => e.stopPropagation());
            cb.addEventListener("change", (e) => {
                e.stopPropagation();
                if (cb.checked) this.checkedIds.add(entry.id);
                else this.checkedIds.delete(entry.id);
                this.updateSelectAllState();
            });

            const thumb = document.createElement("div");
            thumb.className = "ag-thumb";
            this.drawThumbInto(thumb, entry, 28);
            thumb.addEventListener("mouseenter", () => this.showHoverZoom(thumb, entry));
            thumb.addEventListener("mouseleave", () => this.hideHoverZoom());

            const label = document.createElement("span");
            label.className = "ag-list-label";
            label.textContent = entry.label;

            row.appendChild(cb);
            row.appendChild(thumb);
            row.appendChild(label);
            row.addEventListener("click", () => this.selectLibraryEntry(entry));
            list.appendChild(row);
        });

        this.updateSelectAllState();
        const on = list.querySelector(".ag-list-item.ag-on");
        if (on) on.scrollIntoView({ block: "nearest" });
    },

    currentEntry() {
        if (typeof assetGenRegistry === "undefined") return null;
        if (this.isFactionLibrary()) {
            return assetGenRegistry.get("faction", this.selectedId)
                || assetGenRegistry.get("factionShip", this.selectedId)
                || null;
        }
        return assetGenRegistry.get(this.typeId, this.selectedId);
    },

    checkedEntries() {
        const byId = new Map();
        this.libraryEntriesForType().forEach((e) => byId.set(e.id, e));
        return [...this.checkedIds].map((id) => byId.get(id)).filter(Boolean);
    },
});
