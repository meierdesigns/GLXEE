"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    makeMultiCheck(labelText, options, selected, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'pe-ability-group';
        const title = document.createElement('div');
        title.className = 'pe-ability-group-title';
        title.textContent = labelText;
        wrap.appendChild(title);
        const state = Array.isArray(selected) ? selected.slice() : [];
        (options || []).forEach((opt) => {
            const on = state.indexOf(opt) !== -1;
            wrap.appendChild(this.makeCheckbox(opt, on, (checked) => {
                const idx = state.indexOf(opt);
                if (checked && idx === -1) state.push(opt);
                if (!checked && idx !== -1) state.splice(idx, 1);
                onChange(state.slice());
            }));
        });
        return wrap;
    },

    makePatternPicker(layer) {
        const wrap = document.createElement('div');
        wrap.className = 'pe-pattern-picker';

        const label = document.createElement('label');
        label.textContent = 'Pattern';
        wrap.appendChild(label);

        const current = document.createElement('button');
        current.type = 'button';
        current.className = 'pe-pattern-current';
        current.title = 'Choose pattern';

        const currentCanvas = document.createElement('canvas');
        currentCanvas.width = 72;
        currentCanvas.height = 108;
        currentCanvas.className = 'pe-pattern-thumb';

        const currentName = document.createElement('span');
        currentName.className = 'pe-pattern-name';
        currentName.textContent = layer.pattern || '—';

        const hint = document.createElement('span');
        hint.className = 'pe-pattern-open-hint';
        hint.textContent = '▸';

        current.appendChild(currentCanvas);
        current.appendChild(currentName);
        current.appendChild(hint);
        current.addEventListener('click', () => this.openPatternModal(layer, currentCanvas, currentName));
        wrap.appendChild(current);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'pe-btn pe-pattern-edit-btn';
        editBtn.textContent = 'EDIT PATTERN';
        editBtn.addEventListener('click', () => {
            this.openPatternEditor(layer.pattern || 'grid', layer, currentCanvas, currentName);
        });
        wrap.appendChild(editBtn);

        const color = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.resolveLayerColor(layer)
            : '#808080';
        this.drawPatternThumbnail(currentCanvas, layer.pattern, color);

        return wrap;
    },

    openPatternModal(layer, currentCanvas, currentName) {
        this.closePatternModal();
        this.patternModalLayer = layer;

        const modal = document.createElement('div');
        modal.id = 'pePatternModal';
        modal.className = 'pe-pattern-modal';

        const dialog = document.createElement('div');
        dialog.className = 'pe-pattern-modal-dialog';

        const head = document.createElement('div');
        head.className = 'pe-pattern-modal-header';
        const title = document.createElement('h3');
        title.textContent = 'SELECT PATTERN';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pe-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.closePatternModal());
        head.appendChild(title);
        head.appendChild(closeBtn);

        const grid = document.createElement('div');
        grid.className = 'pe-pattern-grid pe-pattern-grid-modal';

        const patterns = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.getAllPatternIds()
            : [];

        const color = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.resolveLayerColor(layer)
            : '#808080';

        const applyPattern = (patternId) => {
            layer.pattern = patternId;
            if (currentName) currentName.textContent = patternId;
            if (currentCanvas) this.drawPatternThumbnail(currentCanvas, patternId, color);
            const summary = currentCanvas && currentCanvas.closest('.pe-layer-card');
            if (summary) {
                const summaryEl = summary.querySelector('.pe-layer-summary');
                if (summaryEl) summaryEl.textContent = patternId;
            }
            this.closePatternModal();
        };

        patterns.forEach(patternId => {
            const item = document.createElement('div');
            item.className = 'pe-pattern-item-wrap' + (patternId === layer.pattern ? ' active' : '');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-pattern-item' + (patternId === layer.pattern ? ' active' : '');
            btn.title = patternId;

            const thumb = document.createElement('canvas');
            thumb.width = 56;
            thumb.height = 84;
            thumb.className = 'pe-pattern-thumb';
            this.drawPatternThumbnail(thumb, patternId, color);

            const name = document.createElement('span');
            name.textContent = patternId;
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.hasCustomPattern(patternId)) {
                name.textContent += ' ✎';
            }

            btn.appendChild(thumb);
            btn.appendChild(name);
            btn.addEventListener('click', () => applyPattern(patternId));

            const editMini = document.createElement('button');
            editMini.type = 'button';
            editMini.className = 'pe-btn pe-pattern-item-edit';
            editMini.title = 'Edit pattern';
            editMini.textContent = '✎';
            editMini.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePatternModal();
                this.openPatternEditor(patternId, layer, currentCanvas, currentName);
            });

            item.appendChild(btn);
            item.appendChild(editMini);
            grid.appendChild(item);
        });

        const foot = document.createElement('div');
        foot.className = 'pe-pattern-modal-footer';
        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'pe-btn pe-primary';
        newBtn.textContent = '+ NEW PATTERN';
        newBtn.addEventListener('click', () => {
            if (typeof planetConfigManager === 'undefined') return;
            const id = planetConfigManager.nextCustomPatternId();
            planetConfigManager.setCustomPattern(id, planetConfigManager.createBlankPattern(id, id));
            this.closePatternModal();
            this.openPatternEditor(id, layer, currentCanvas, currentName);
        });
        foot.appendChild(newBtn);

        dialog.appendChild(head);
        dialog.appendChild(grid);
        dialog.appendChild(foot);
        modal.appendChild(dialog);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePatternModal();
        });

        const overlay = document.getElementById('planetEditorOverlay');
        if (overlay) overlay.appendChild(modal);
        else document.body.appendChild(modal);
    },

    closePatternModal() {
        const modal = document.getElementById('pePatternModal');
        if (!modal) {
            this.patternModalLayer = null;
            return false;
        }
        modal.remove();
        this.patternModalLayer = null;
        return true;
    },

    sampleBuiltinPattern(patternId) {
        const tw = (typeof planetConfigManager !== 'undefined') ? planetConfigManager.defaultTileSize : 16;
        const th = tw;
        const cell = (typeof planetConfigManager !== 'undefined') ? planetConfigManager.defaultCellSize : 4;
        const cells = new Array(tw * th).fill(0);

        if (typeof parallaxManager === 'undefined' || !parallaxManager.drawLayerPattern) {
            return { id: patternId, name: patternId, width: tw, height: th, cellSize: cell, cells };
        }

        const off = document.createElement('canvas');
        off.width = 400;
        off.height = 600;
        const ctx = off.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 400, 600);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;

        const prev = (typeof planetConfigManager !== 'undefined')
            ? planetConfigManager.customPatterns[patternId]
            : null;
        if (prev && typeof planetConfigManager !== 'undefined') {
            delete planetConfigManager.customPatterns[patternId];
        }

        parallaxManager.drawLayerPattern(ctx, {
            pattern: patternId,
            y: 0,
            color: '#ffffff',
            colorSource: 'custom',
            opacity: 1,
            scale: 1,
            visible: true
        }, 0);

        if (prev && typeof planetConfigManager !== 'undefined') {
            planetConfigManager.customPatterns[patternId] = prev;
        }

        const region = Math.min(400, tw * cell);
        const regionH = Math.min(600, th * cell);
        for (let cy = 0; cy < th; cy++) {
            for (let cx = 0; cx < tw; cx++) {
                const px = Math.min(region - 1, Math.floor(cx * cell + cell / 2));
                const py = Math.min(regionH - 1, Math.floor(cy * cell + cell / 2));
                const d = ctx.getImageData(px, py, 1, 1).data;
                cells[cy * tw + cx] = (d[0] + d[1] + d[2] > 40) ? 1 : 0;
            }
        }

        return { id: patternId, name: patternId, width: tw, height: th, cellSize: cell, cells };
    },
});
