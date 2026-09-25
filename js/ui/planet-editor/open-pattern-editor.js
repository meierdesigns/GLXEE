"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    openPatternEditor(patternId, layer, currentCanvas, currentName) {
        this.closePatternEditor();
        if (typeof planetConfigManager === 'undefined') return;

        let draft;
        if (planetConfigManager.hasCustomPattern(patternId)) {
            draft = JSON.parse(JSON.stringify(planetConfigManager.getCustomPattern(patternId)));
        } else if (planetConfigManager.isBuiltinPattern(patternId)) {
            draft = this.sampleBuiltinPattern(patternId);
        } else {
            draft = planetConfigManager.createBlankPattern(patternId, patternId);
        }

        const paintValue = { current: 1 };
        const painting = { active: false };

        const modal = document.createElement('div');
        modal.id = 'pePatternEditor';
        modal.className = 'pe-pattern-editor-modal';

        const dialog = document.createElement('div');
        dialog.className = 'pe-pattern-editor-dialog';

        const head = document.createElement('div');
        head.className = 'pe-pattern-modal-header';
        const title = document.createElement('h3');
        title.textContent = 'PATTERN EDITOR';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pe-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.closePatternEditor());
        head.appendChild(title);
        head.appendChild(closeBtn);

        const idRow = document.createElement('div');
        idRow.className = 'pe-row';
        const idLabel = document.createElement('label');
        idLabel.textContent = 'ID';
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.className = 'pe-text-input';
        idInput.value = draft.id;
        idInput.readOnly = planetConfigManager.isBuiltinPattern(patternId);
        idRow.appendChild(idLabel);
        idRow.appendChild(idInput);

        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'pe-pattern-editor-canvas-wrap';
        const canvas = document.createElement('canvas');
        canvas.className = 'pe-pattern-editor-canvas';
        canvasWrap.appendChild(canvas);

        const redraw = () => {
            const scale = Math.max(12, Math.floor(280 / Math.max(draft.width, draft.height)));
            canvas.width = draft.width * scale;
            canvas.height = draft.height * scale;
            const ctx = canvas.getContext('2d');
            const bg = getComputedStyle(document.documentElement).getPropertyValue('--current-background').trim() || '#0a0a0a';
            const fg = (layer && typeof planetConfigManager !== 'undefined')
                ? planetConfigManager.resolveLayerColor(layer)
                : (getComputedStyle(document.documentElement).getPropertyValue('--current-primary').trim() || '#e07028');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (let y = 0; y < draft.height; y++) {
                for (let x = 0; x < draft.width; x++) {
                    if (draft.cells[y * draft.width + x]) {
                        ctx.fillStyle = fg;
                        ctx.fillRect(x * scale, y * scale, scale, scale);
                    }
                    ctx.strokeStyle = 'rgba(80,60,40,0.45)';
                    ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
                }
            }
        };

        const paintAt = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cellScale = canvas.width / draft.width;
            const x = Math.floor(((clientX - rect.left) * scaleX) / cellScale);
            const y = Math.floor(((clientY - rect.top) * scaleY) / cellScale);
            if (x < 0 || y < 0 || x >= draft.width || y >= draft.height) return;
            draft.cells[y * draft.width + x] = paintValue.current;
            redraw();
        };

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            painting.active = true;
            paintValue.current = e.button === 2 ? 0 : 1;
            paintAt(e.clientX, e.clientY);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (!painting.active) return;
            paintAt(e.clientX, e.clientY);
        });
        const onUp = () => { painting.active = false; };
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        const tools = document.createElement('div');
        tools.className = 'pe-pattern-editor-tools';

        const paintBtn = document.createElement('button');
        paintBtn.type = 'button';
        paintBtn.className = 'pe-btn pe-primary';
        paintBtn.textContent = 'PAINT';
        paintBtn.addEventListener('click', () => { paintValue.current = 1; });

        const eraseBtn = document.createElement('button');
        eraseBtn.type = 'button';
        eraseBtn.className = 'pe-btn';
        eraseBtn.textContent = 'ERASE';
        eraseBtn.addEventListener('click', () => { paintValue.current = 0; });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'pe-btn';
        clearBtn.textContent = 'CLEAR';
        clearBtn.addEventListener('click', () => {
            draft.cells = draft.cells.map(() => 0);
            redraw();
        });

        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.className = 'pe-btn';
        fillBtn.textContent = 'FILL';
        fillBtn.addEventListener('click', () => {
            draft.cells = draft.cells.map(() => 1);
            redraw();
        });

        const resampleBtn = document.createElement('button');
        resampleBtn.type = 'button';
        resampleBtn.className = 'pe-btn';
        resampleBtn.textContent = 'RESAMPLE';
        resampleBtn.title = 'Sample from built-in procedural pattern';
        resampleBtn.disabled = !planetConfigManager.isBuiltinPattern(patternId);
        resampleBtn.addEventListener('click', () => {
            const sampled = this.sampleBuiltinPattern(patternId);
            draft.width = sampled.width;
            draft.height = sampled.height;
            draft.cellSize = sampled.cellSize;
            draft.cells = sampled.cells.slice();
            draft.id = sampled.id;
            draft.name = sampled.name;
            idInput.value = draft.id;
            redraw();
        });

        tools.appendChild(paintBtn);
        tools.appendChild(eraseBtn);
        tools.appendChild(clearBtn);
        tools.appendChild(fillBtn);
        tools.appendChild(resampleBtn);

        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'LMB paint · RMB erase · tile repeats in preview';

        const actions = document.createElement('div');
        actions.className = 'pe-pattern-editor-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'pe-btn pe-primary';
        saveBtn.textContent = 'SAVE';
        saveBtn.addEventListener('click', () => {
            let saveId = String(idInput.value || '').trim().replace(/\s+/g, '_').toLowerCase();
            if (!saveId) saveId = patternId;
            if (!planetConfigManager.isBuiltinPattern(patternId) && saveId !== patternId) {
                if (planetConfigManager.hasCustomPattern(saveId) || planetConfigManager.isBuiltinPattern(saveId)) {
                    saveId = planetConfigManager.nextCustomPatternId();
                }
                if (planetConfigManager.hasCustomPattern(patternId)) {
                    planetConfigManager.deleteCustomPattern(patternId);
                }
            }
            draft.id = saveId;
            draft.name = saveId;
            planetConfigManager.setCustomPattern(saveId, draft);
            if (layer) {
                layer.pattern = saveId;
                if (currentName) currentName.textContent = saveId;
                if (currentCanvas) {
                    const color = planetConfigManager.resolveLayerColor(layer);
                    this.drawPatternThumbnail(currentCanvas, saveId, color);
                }
                const card = currentCanvas && currentCanvas.closest('.pe-layer-card');
                if (card) {
                    const summaryEl = card.querySelector('.pe-layer-summary');
                    if (summaryEl) summaryEl.textContent = saveId;
                }
            }
            this.closePatternEditor();
            this.renderControls();
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'pe-btn';
        delBtn.textContent = planetConfigManager.isBuiltinPattern(patternId) ? 'RESET' : 'DELETE';
        delBtn.addEventListener('click', () => {
            if (planetConfigManager.hasCustomPattern(patternId)) {
                planetConfigManager.deleteCustomPattern(patternId);
            }
            if (layer && !planetConfigManager.isBuiltinPattern(patternId)) {
                layer.pattern = 'grid';
            }
            this.closePatternEditor();
            this.renderControls();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'pe-btn';
        cancelBtn.textContent = 'CANCEL';
        cancelBtn.addEventListener('click', () => this.closePatternEditor());

        actions.appendChild(saveBtn);
        actions.appendChild(delBtn);
        actions.appendChild(cancelBtn);

        dialog.appendChild(head);
        dialog.appendChild(idRow);
        dialog.appendChild(canvasWrap);
        dialog.appendChild(tools);
        dialog.appendChild(hint);
        dialog.appendChild(actions);
        modal.appendChild(dialog);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePatternEditor();
        });

        const overlay = document.getElementById('planetEditorOverlay');
        if (overlay) overlay.appendChild(modal);
        else document.body.appendChild(modal);

        this.patternEditor = { patternId, draft, onUp };
        redraw();
    },

    closePatternEditor() {
        const modal = document.getElementById('pePatternEditor');
        if (!modal) {
            if (this.patternEditor && this.patternEditor.onUp) {
                window.removeEventListener('mouseup', this.patternEditor.onUp);
            }
            this.patternEditor = null;
            return false;
        }
        if (this.patternEditor && this.patternEditor.onUp) {
            window.removeEventListener('mouseup', this.patternEditor.onUp);
        }
        modal.remove();
        this.patternEditor = null;
        return true;
    },
});
