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
        if (this.isPortraitLibrary && this.isPortraitLibrary()
            && typeof assetGenRegistry !== "undefined" && assetGenRegistry.listPortraits) {
            return assetGenRegistry.listPortraits();
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
        if (this.isPortraitLibrary && this.isPortraitLibrary() && this.filteredPortraitEntries) {
            return this.filteredPortraitEntries();
        }
        return this.libraryEntriesForType();
    },

    syncFactionChrome() {
        if (!this.overlay) return;
        const chrome = this.overlay.querySelector("#agFactionChrome");
        if (!chrome) return;
        const on = this.isFactionLibrary();
        chrome.hidden = !on;
        if (this.syncPortraitChrome) this.syncPortraitChrome();
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
            this._observeLazyThumb(thumb, entry, 24);
            thumb.addEventListener("mouseenter", () => {
                if (thumb.dataset.lazyDone !== "1") {
                    this.drawThumbInto(thumb, entry, 24);
                    thumb.dataset.lazyDone = "1";
                }
                this.showHoverZoom(thumb, entry);
            });
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

    loadListView() {
        try {
            const v = localStorage.getItem("vf_asset_gen_list_view_v1");
            if (v === "grid" || v === "list") return v;
        } catch (e) { /* ignore */ }
        return "grid";
    },

    saveListView() {
        try {
            localStorage.setItem("vf_asset_gen_list_view_v1", this.listView || "grid");
        } catch (e) { /* ignore */ }
    },

    setListView(view) {
        this.listView = (view === "grid") ? "grid" : "list";
        this.saveListView();
        this.applyListView();
    },

    applyListView() {
        if (!this.overlay) return;
        const list = this.overlay.querySelector("#agList");
        if (list) list.classList.toggle("is-grid", this.listView === "grid");
        this.overlay.querySelectorAll("#agViewToggle button").forEach((btn) => {
            const on = btn.dataset.view === this.listView;
            btn.classList.toggle("ag-on", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        const toggleHost = this.overlay.querySelector("#agViewToggle");
        if (toggleHost) toggleHost.hidden = this.isFactionLibrary();
        this.applyGridZoom();
    },

    loadGridZoom() {
        try {
            const n = parseInt(localStorage.getItem("vf_asset_gen_grid_zoom_v1"), 10);
            if (Number.isFinite(n)) return Math.min(160, Math.max(48, n));
        } catch (e) { /* ignore */ }
        return 72;
    },

    saveGridZoom() {
        try {
            localStorage.setItem("vf_asset_gen_grid_zoom_v1", String(this.gridZoom || 72));
        } catch (e) { /* ignore */ }
    },

    setGridZoom(px) {
        this.gridZoom = Math.min(160, Math.max(48, Math.round(px) || 72));
        this.saveGridZoom();
        this.applyGridZoom();
    },

    applyGridZoom() {
        if (!this.overlay) return;
        this.overlay.style.setProperty("--ag-grid-zoom", this.gridZoom + "px");
        const zoomHost = this.overlay.querySelector("#agZoomControl");
        if (zoomHost) zoomHost.hidden = !(this.listView === "grid" && this.isPortraitLibrary());
        const zoomInput = this.overlay.querySelector("#agGridZoom");
        if (zoomInput && Number(zoomInput.value) !== this.gridZoom) zoomInput.value = String(this.gridZoom);
    },

    /** Disconnect prior IntersectionObserver used for lazy thumbnails. */
    _teardownThumbObserver() {
        if (this._thumbObserver) {
            try { this._thumbObserver.disconnect(); } catch (e) { /* ignore */ }
            this._thumbObserver = null;
        }
    },

    /** Paint a thumb only when it nears the viewport (portraits are expensive). */
    _observeLazyThumb(thumb, entry, size) {
        if (!thumb || !entry) return;
        thumb.dataset.lazyThumb = "1";
        const paint = () => {
            if (thumb.dataset.lazyDone === "1") return;
            thumb.dataset.lazyDone = "1";
            this.drawThumbInto(thumb, entry, size);
            if (this._thumbObserver) {
                try { this._thumbObserver.unobserve(thumb); } catch (e) { /* ignore */ }
            }
        };
        if (typeof IntersectionObserver === "undefined") {
            paint();
            return;
        }
        if (!this._thumbObserver) {
            this._thumbObserver = new IntersectionObserver((entries) => {
                entries.forEach((ev) => {
                    if (!ev.isIntersecting) return;
                    const el = ev.target;
                    const id = el.dataset.entryId;
                    const ent = (this._lazyThumbEntries && this._lazyThumbEntries.get(id)) || null;
                    const px = Number(el.dataset.thumbSize) || 28;
                    if (ent) this.drawThumbInto(el, ent, px);
                    el.dataset.lazyDone = "1";
                    try { this._thumbObserver.unobserve(el); } catch (e) { /* ignore */ }
                });
            }, { root: this.overlay ? this.overlay.querySelector("#agList") : null, rootMargin: "120px 0px", threshold: 0.01 });
        }
        if (!this._lazyThumbEntries) this._lazyThumbEntries = new Map();
        this._lazyThumbEntries.set(entry.id, entry);
        thumb.dataset.entryId = entry.id;
        thumb.dataset.thumbSize = String(size);
        this._thumbObserver.observe(thumb);
    },

    renderList() {
        if (!this.overlay) return;
        const list = this.overlay.querySelector("#agList");
        this._teardownThumbObserver();
        if (this._lazyThumbEntries) this._lazyThumbEntries.clear();
        list.innerHTML = "";
        this.syncFactionChrome();

        const entries = this.visibleLibraryEntries();
        if (!this.selectedId && entries[0]) this.selectedId = entries[0].id;
        const valid = new Set(this.libraryEntriesForType().map((e) => e.id));
        this.checkedIds = new Set([...this.checkedIds].filter((id) => valid.has(id)));

        if (this.isFactionLibrary()) {
            this.renderFactionTable(list, entries);
            this.updateSelectAllState();
            this.applyListView();
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
            const face = entry.type === "portrait" || entry.kind === "portrait";
            thumb.className = "ag-thumb" + (face ? " ag-thumb-face" : "");
            // Defer expensive VXP/getImageData thumbs until the row is near the list viewport.
            this._observeLazyThumb(thumb, entry, face ? 72 : 28);
            thumb.addEventListener("mouseenter", () => {
                if (thumb.dataset.lazyDone !== "1") {
                    this.drawThumbInto(thumb, entry, face ? 72 : 28);
                    thumb.dataset.lazyDone = "1";
                }
                this.showHoverZoom(thumb, entry);
            });
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
        this.applyListView();
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
