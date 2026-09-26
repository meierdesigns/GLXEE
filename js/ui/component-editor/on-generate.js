"use strict";

// ComponentEditorUI methods, split from component-editor.js.
extendClass(ComponentEditorUI, {
    async onGenerate() {
        const entry = this.currentEntry();
        if (!entry || this.busy) return;
        if (typeof assetGenClient === "undefined") {
            this.setStatus("assetGenClient missing");
            return;
        }
        this.readGenFields();
        this.busy = true;
        this.drawCenter();
        this.setStatus("Generating via Flux…");
        try {
            const promptEl = this.root.querySelector("#cePrompt");
            const prompt = promptEl ? promptEl.value : entry.promptSuffix;
            const opts = {
                prompt: prompt,
                size: this.outSize,
                genSize: this.genSize,
                steps: this.steps,
                prependStyle: this.prependStyle,
                colors: this.colorCount,
                bgColor: this.normalizeHex(this.bgColor)
            };
            if (this.seed !== "") opts.seed = Number(this.seed);
            const result = await assetGenClient.generate(entry, opts);
            this.stagingId = result.stagingId;
            this.previewDataUrl = result.previewDataUrl;
            this.setStatus("Ready · seed " + result.seed + " · Accept to apply");
            this.drawGenThumb();
            this.reloadEditBuffer(true);
            this.drawCenter();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    },

    async onAccept() {
        const entry = this.currentEntry();
        if (!entry || !this.stagingId || this.busy) return;
        this.busy = true;
        this.setStatus("Accepting…");
        try {
            const result = await assetGenClient.accept(this.stagingId, entry.targetPath);
            const key = entry.spriteKey || entry.id;
            if (typeof spriteLoader !== "undefined" && spriteLoader.reloadSprite) {
                await spriteLoader.reloadSprite(key, result.url);
            }
            if (typeof iconRenderer !== "undefined" && iconRenderer.clearCache) {
                iconRenderer.clearCache();
            }
            this.persistMetaFields();
            window.dispatchEvent(new CustomEvent("vf-asset-accepted", {
                detail: { entry: entry, path: result.path, url: result.url, key: key }
            }));
            this.clearStaging();
            this.setStatus("Accepted · " + (result.path || key));
            this.reloadEditBuffer(true);
            this.drawCurrentThumb();
            this.drawCenter();
            this.renderList();
        } catch (e) {
            this.setStatus(String(e && e.message || e));
        } finally {
            this.busy = false;
        }
    },

    async onSaveMeta() {
        this.readGenFields();
        this.persistMetaFields();
        if (typeof spriteMeta === "undefined") {
            this.setStatus("spriteMeta missing");
            return;
        }
        this.setStatus("Saving meta…");
        try {
            const r = await spriteMeta.saveToDisk();
            if (r && r.ok) this.setStatus("Meta saved · " + (r.path || spriteMeta.path));
            else this.setStatus((r && r.error) || "Meta saved locally only (bridge offline)");
        } catch (e) {
            this.setStatus("Meta local only · " + String(e && e.message || e));
        }
    },

    openAssetGen() {
        const entry = this.currentEntry();
        if (typeof assetGenUI === "undefined") return;
        assetGenUI.show({
            typeId: this.typeId,
            selectedId: entry ? entry.id : null,
            returnToSettings: false
        });
    },

    renderComponentProperties() {
        const r = this.root;
        const propsPanel = r && r.querySelector("#ceComponentProps");
        if (!propsPanel) return;

        // Only show if we have selected typeId and selectedId
        const hasSelection = !!this.typeId && !!this.selectedId;
        if (!hasSelection) {
            propsPanel.style.display = "none";
            return;
        }

        const entry = this.currentEntry();
        if (!entry) {
            propsPanel.style.display = "none";
            return;
        }

        // Only show for weapon or mount types
        const isWeapon = entry.type === "weapon";
        const isMount = entry.type === "mount";

        if (!isWeapon && !isMount) {
            propsPanel.style.display = "none";
            return;
        }

        // Show panel only for this specific component
        propsPanel.style.display = "block";

        // Build component-specific properties HTML
        let propsHtml = `<div class="hs-comp-section-title">${entry.label} PROPERTIES</div>`;
        propsHtml += '<div class="hs-comp-fields">';

        if (isWeapon) {
            propsHtml += `<label>WEAPON
              <select id="ceComponentWeapon" data-property="weapon">
                ${this.buildWeaponOptions()}
              </select>
            </label>
            <label>STYLE
              <select id="ceComponentStyle" data-property="style">
                ${this.buildStyleOptions()}
              </select>
            </label>
            <label>WEAPON STYLE
              <select id="ceComponentWeaponStyle" data-property="weaponStyle">
                ${this.buildWeaponStyleOptions()}
              </select>
            </label>`;
        } else if (isMount) {
            propsHtml += `<label>MODULE
              <select id="ceComponentModule" data-property="module">
                ${this.buildModuleOptions()}
              </select>
            </label>
            <label>STYLE
              <select id="ceComponentStyle" data-property="style">
                ${this.buildStyleOptions()}
              </select>
            </label>`;
        }

        propsHtml += '</div>';

        // Update panel content
        propsPanel.innerHTML = propsHtml;

        // Set values
        const weaponSel = propsPanel.querySelector("#ceComponentWeapon");
        if (weaponSel) {
            weaponSel.value = entry.id || "";
        }

        const styleSel = propsPanel.querySelector("#ceComponentStyle");
        if (styleSel) {
            styleSel.value = entry.style || "";
        }

        const weaponStyleSel = propsPanel.querySelector("#ceComponentWeaponStyle");
        if (weaponStyleSel) {
            weaponStyleSel.value = entry.weaponStyle || "";
        }

        const moduleSel = propsPanel.querySelector("#ceComponentModule");
        if (moduleSel) {
            moduleSel.value = entry.modId || entry.id || "";
        }

        // Remove any old event listeners
        if (this._propsListenerHandler) {
            propsPanel.removeEventListener("change", this._propsListenerHandler);
        }

        // Attach a single delegated event listener
        this._propsListenerHandler = (e) => {
            if (e.target && e.target.tagName === "SELECT") {
                const property = e.target.getAttribute("data-property");
                const value = e.target.value;
                if (property) {
                    this.onComponentPropertyChange(property, value);
                }
            }
        };

        propsPanel.addEventListener("change", this._propsListenerHandler);
    },

    buildWeaponOptions() {
        const weapons = this.getAvailableWeapons();
        return "<option value=\"\">— Select Weapon —</option>" +
            weapons.map(w => `<option value="${w.id}">${w.label}</option>`).join("");
    },

    buildStyleOptions() {
        const styles = this.getAvailableStyles();
        return "<option value=\"\">— Default Style —</option>" +
            styles.map(s => `<option value="${s.id}">${s.label}</option>`).join("");
    },

    buildWeaponStyleOptions() {
        const weaponStyles = this.getAvailableWeaponStyles();
        return "<option value=\"\">— Default Weapon Style —</option>" +
            weaponStyles.map(ws => `<option value="${ws.id}">${ws.label}</option>`).join("");
    },

    buildModuleOptions() {
        const modules = this.getAvailableModules();
        return modules.map(m => `<option value="${m.id}">${m.label}</option>`).join("");
    },

    getAvailableWeapons() {
        if (typeof weaponConfigManager !== "undefined" && weaponConfigManager.getAllWeapons) {
            return weaponConfigManager.getAllWeapons();
        }
        return [];
    },

    getAvailableStyles() {
        if (typeof shipStyleManager !== "undefined" && shipStyleManager.getAvailableStyles) {
            return shipStyleManager.getAvailableStyles();
        }
        return [
            { id: "default", label: "Default" },
            { id: "faction1", label: "Faction 1" },
            { id: "faction2", label: "Faction 2" }
        ];
    },

    getAvailableWeaponStyles() {
        if (typeof weaponStyleManager !== "undefined" && weaponStyleManager.getAvailableStyles) {
            return weaponStyleManager.getAvailableStyles();
        }
        return [
            { id: "standard", label: "Standard" },
            { id: "overcharge", label: "Overcharge" },
            { id: "precision", label: "Precision" }
        ];
    },

    getAvailableModules() {
        if (typeof moduleConfigManager !== "undefined" && moduleConfigManager.getAllModules) {
            return moduleConfigManager.getAllModules();
        }
        return [];
    },
});
