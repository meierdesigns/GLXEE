"use strict";

// ThemeEditorUI methods, split from theme-editor.js.
extendClass(ThemeEditorUI, {
    setupPanelResize() {
        const body = this.overlay && this.overlay.querySelector('#teEditorBody');
        if (!body || typeof setupPanelResize !== 'function') return;
        if (this._panelResize) {
            this._panelResize.destroy();
            this._panelResize = null;
        }
        this._panelResize = setupPanelResize({
            body,
            root: this.overlay,
            storageKey: 'tePanelWidths',
            defaults: { left: 180, right: 340 },
            mins: { left: 120, right: 220, center: 280 },
            onChange: () => this.updateGfxColumns()
        });
        this.updateGfxColumns();
    },

    updateGfxColumns() {
        const gfx = this.overlay && this.overlay.querySelector('#teGfx');
        if (!gfx) return;
        const pad = 12;
        const cellMin = 84;
        const gap = 6;
        const avail = Math.max(0, gfx.clientWidth - pad);
        const cols = Math.max(1, Math.min(8, Math.floor((avail + gap) / (cellMin + gap)) || 1));
        gfx.style.setProperty('--te-gfx-cols', String(cols));
    },

    renderList() {
        const list = this.overlay.querySelector('#teList');
        if (!list) return;
        list.innerHTML = '';
        const palettes = (typeof colorManager !== 'undefined')
            ? colorManager.getPalettes()
            : [];
        palettes.forEach((p) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'theme-editor-item' + (p.id === this.editingId ? ' selected' : '');
            const baseDot = (typeof colorPaletteSystem !== 'undefined'
                && colorPaletteSystem.palettes[p.id]
                && colorPaletteSystem.palettes[p.id].baseColor)
                || p.baseColor
                || p.primary;
            const secondDot = (typeof colorPaletteSystem !== 'undefined'
                && colorPaletteSystem.palettes[p.id]
                && colorPaletteSystem.palettes[p.id].secondBaseColor)
                || p.secondBaseColor
                || '#FFFFFF';
            btn.innerHTML = `<span class="te-dot" style="background:linear-gradient(135deg, ${baseDot} 50%, ${secondDot} 50%)"></span><span>${p.name}</span>`;
            btn.addEventListener('click', () => {
                this.loadDraft(p.id);
                this.previewDraft(false);
                this.renderList();
                this.renderMeta();
                this.renderAppearance();
                this.updatePreviewCard();
            });
            list.appendChild(btn);
        });
    },

    renderMeta() {
        const meta = this.overlay.querySelector('#teMeta');
        if (!meta || !this.draft) return;
        meta.innerHTML = '';
        const nameRow = document.createElement('div');
        nameRow.className = 'theme-editor-name-row';
        const label = document.createElement('label');
        label.textContent = 'Name';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pe-text-input';
        input.value = this.draft.name || this.editingId;
        input.addEventListener('input', () => {
            this.draft.name = input.value;
        });
        nameRow.appendChild(label);
        nameRow.appendChild(input);
        meta.appendChild(nameRow);

        const idHint = document.createElement('div');
        idHint.className = 'theme-editor-id';
        const builtin = typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.isBuiltin(this.editingId);
        idHint.textContent = builtin
            ? `ID: ${this.editingId} (builtin — SAVE overwrites locally)`
            : `ID: ${this.editingId}`;
        meta.appendChild(idHint);
    },

    addSlider(parent, labelText, value, onChange) {
        const row = document.createElement('div');
        row.className = 'theme-editor-contrast-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const valEl = document.createElement('span');
        valEl.className = 'te-contrast-val';
        valEl.textContent = String(Math.round(value));
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '200';
        slider.step = '1';
        slider.value = String(value);
        slider.className = 'te-contrast-slider';
        slider.addEventListener('input', () => {
            const v = Number(slider.value);
            valEl.textContent = String(v);
            onChange(v);
        });
        label.appendChild(slider);
        row.appendChild(label);
        row.appendChild(valEl);
        parent.appendChild(row);
        return row;
    },

    renderAppearance() {
        const root = this.overlay.querySelector('#teAppearance');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        const baseTitle = document.createElement('div');
        baseTitle.className = 'theme-editor-appearance-title';
        baseTitle.textContent = 'Theme Basecolors';
        root.appendChild(baseTitle);

        const baseRow = document.createElement('div');
        baseRow.className = 'theme-editor-swatch te-swatch-base';
        const baseName = document.createElement('span');
        baseName.textContent = 'Base';
        const baseInput = document.createElement('button');
        baseInput.type = 'button';
        baseInput.className = 'te-color-swatch';
        const baseHexVal = this.toHex(this.draft.baseColor);
        baseInput.dataset.color = baseHexVal;
        baseInput.style.backgroundColor = baseHexVal;
        baseInput.setAttribute('aria-label', 'Pick base color');
        const baseHex = document.createElement('span');
        baseHex.className = 'te-hex';
        baseHex.textContent = baseHexVal;
        baseInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof colorPickerOverlay === 'undefined' || !colorPickerOverlay.open) return;
            colorPickerOverlay.open(baseInput.dataset.color || baseHexVal, {
                anchor: baseInput,
                onChange: (hex) => {
                    const next = this.toHex(hex);
                    this.draft.baseColor = next;
                    baseInput.dataset.color = next;
                    baseInput.style.backgroundColor = next;
                    baseHex.textContent = next;
                    this.previewDraft(false);
                    this.updatePreviewCard();
                    this.renderList();
                }
            });
        });
        baseRow.appendChild(baseName);
        baseRow.appendChild(baseInput);
        baseRow.appendChild(baseHex);
        root.appendChild(baseRow);

        const secondRow = document.createElement('div');
        secondRow.className = 'theme-editor-swatch te-swatch-base';
        const secondName = document.createElement('span');
        secondName.textContent = '2nd Base';
        const secondInput = document.createElement('button');
        secondInput.type = 'button';
        secondInput.className = 'te-color-swatch';
        const secondHexVal = this.toHex(this.draft.secondBaseColor || '#ffffff');
        secondInput.dataset.color = secondHexVal;
        secondInput.style.backgroundColor = secondHexVal;
        secondInput.setAttribute('aria-label', 'Pick second base color');
        const secondHex = document.createElement('span');
        secondHex.className = 'te-hex';
        secondHex.textContent = secondHexVal;
        secondInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof colorPickerOverlay === 'undefined' || !colorPickerOverlay.open) return;
            colorPickerOverlay.open(secondInput.dataset.color || secondHexVal, {
                anchor: secondInput,
                onChange: (hex) => {
                    const next = this.toHex(hex);
                    this.draft.secondBaseColor = next;
                    secondInput.dataset.color = next;
                    secondInput.style.backgroundColor = next;
                    secondHex.textContent = next;
                    this.previewDraft(false);
                    this.updatePreviewCard();
                    this.renderList();
                }
            });
        });
        secondRow.appendChild(secondName);
        secondRow.appendChild(secondInput);
        secondRow.appendChild(secondHex);
        root.appendChild(secondRow);

        const lookTitle = document.createElement('div');
        lookTitle.className = 'theme-editor-appearance-title';
        lookTitle.style.marginTop = '12px';
        lookTitle.textContent = 'Global Look (all themes)';
        root.appendChild(lookTitle);

        const look = this.getGlobalLook();
        this.addSlider(root, 'Contrast', look.contrast, (v) => {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
                colorPaletteSystem.setGlobalLook({ contrast: v }, { apply: false });
            }
            this.previewDraft(false);
            this.updatePreviewCard();
        });

        this.addSlider(root, 'Saturation', look.saturation, (v) => {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
                colorPaletteSystem.setGlobalLook({ saturation: v }, { apply: false });
            }
            this.previewDraft(false);
            this.updatePreviewCard();
        });
    },

    buildGraphicsPreviewDom() {
        const scroll = this.overlay.querySelector('#teGfxScroll');
        if (!scroll) return;
        scroll.innerHTML = '';
        this.previewGroups.forEach((group) => {
            if (!group.items || !group.items.length) return;
            const section = document.createElement('div');
            section.className = 'te-gfx-section';
            const title = document.createElement('div');
            title.className = 'te-gfx-section-title';
            title.textContent = group.title;
            section.appendChild(title);
            const grid = document.createElement('div');
            grid.className = 'te-gfx-grid';
            group.items.forEach((item) => {
                const cell = document.createElement('div');
                cell.className = 'te-gfx-cell';
                cell.dataset.kind = item.kind;
                cell.dataset.key = item.key;
                const canvas = document.createElement('canvas');
                canvas.width = 48;
                canvas.height = 48;
                canvas.className = 'te-gfx-canvas';
                const caption = document.createElement('span');
                caption.className = 'te-gfx-label';
                caption.textContent = item.label;
                caption.title = item.label;
                cell.appendChild(canvas);
                cell.appendChild(caption);
                grid.appendChild(cell);
            });
            section.appendChild(grid);
            scroll.appendChild(section);
        });
    },

    getPreviewTint() {
        if (!this.draft) return '#808080';
        return this.toHex(this.draft.baseColor || this.draft.primary || '#808080');
    },

    getSecondPreviewTint() {
        if (!this.draft) return '#ffffff';
        return this.toHex(this.draft.secondBaseColor || '#ffffff');
    },
});
