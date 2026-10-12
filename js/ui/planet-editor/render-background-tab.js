"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    renderBackgroundTab(root) {
        const starsRow = document.createElement('div');
        starsRow.className = 'pe-row';
        starsRow.innerHTML = `<label>Stars</label>`;
        const starsToggle = document.createElement('input');
        starsToggle.type = 'checkbox';
        starsToggle.checked = this.draft.starsEnabled !== false;
        starsToggle.addEventListener('change', () => {
            this.draft.starsEnabled = starsToggle.checked;
        });
        starsRow.appendChild(starsToggle);
        root.appendChild(starsRow);

        const starsOp = this.makeSlider('Stars opacity', this.draft.starsOpacity != null ? this.draft.starsOpacity : 0.35, 0, 1, 0.01, (v) => {
            this.draft.starsOpacity = v;
        });
        root.appendChild(starsOp);

        const layerList = document.createElement('div');
        layerList.className = 'pe-layer-list';

        (this.draft.backgroundLayers || []).forEach((layer, index) => {
            const collapsed = this.expandedLayerIndex !== index;
            const card = document.createElement('div');
            card.className = 'pe-layer-card' + (collapsed ? ' pe-layer-collapsed' : '');

            const header = document.createElement('div');
            header.className = 'pe-layer-header';

            const expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.className = 'pe-layer-expand';
            expandBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

            const toggle = document.createElement('span');
            toggle.className = 'pe-layer-toggle';
            toggle.textContent = collapsed ? '+' : '−';

            const title = document.createElement('span');
            title.className = 'pe-layer-title';
            title.textContent = `Layer ${index + 1}`;

            const summary = document.createElement('span');
            summary.className = 'pe-layer-summary';
            summary.textContent = layer.pattern || '—';

            expandBtn.appendChild(toggle);
            expandBtn.appendChild(title);
            expandBtn.appendChild(summary);
            expandBtn.addEventListener('click', () => {
                this.expandedLayerIndex = this.expandedLayerIndex === index ? null : index;
                this.renderControls();
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'pe-layer-delete';
            delBtn.title = 'Delete layer';
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.draft.backgroundLayers.splice(index, 1);
                const count = this.draft.backgroundLayers.length;
                if (count === 0) {
                    this.expandedLayerIndex = null;
                } else if (this.expandedLayerIndex === index) {
                    this.expandedLayerIndex = Math.min(index, count - 1);
                } else if (this.expandedLayerIndex != null && this.expandedLayerIndex > index) {
                    this.expandedLayerIndex -= 1;
                }
                this.renderControls();
            });

            header.appendChild(expandBtn);
            header.appendChild(delBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'pe-layer-body';

            const vis = document.createElement('label');
            vis.className = 'pe-inline';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = layer.visible !== false;
            cb.addEventListener('change', () => { layer.visible = cb.checked; });
            vis.appendChild(cb);
            vis.appendChild(document.createTextNode(' Visible'));
            body.appendChild(vis);

            body.appendChild(this.makePatternPicker(layer));

            body.appendChild(this.makeSlider('Opacity', layer.opacity != null ? layer.opacity : 0.15, 0, 1, 0.01, (v) => {
                layer.opacity = v;
            }));

            body.appendChild(this.makeSlider('Scale', layer.scale != null ? layer.scale : 1, 0.25, 3, 0.05, (v) => {
                layer.scale = v;
            }));

            body.appendChild(this.makeSlider('Speed', layer.speed != null ? layer.speed : 0.3, 0, 2, 0.05, (v) => {
                layer.speed = v;
            }));

            body.appendChild(this.makeSelect('Color', layer.colorSource || 'primary', planetConfigManager.colorSources, (v) => {
                layer.colorSource = v;
                this.renderControls();
            }));

            card.appendChild(body);
            layerList.appendChild(card);
        });

        root.appendChild(layerList);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'pe-btn';
        addBtn.textContent = '+ LAYER';
        addBtn.addEventListener('click', () => {
            this.draft.backgroundLayers.push({
                pattern: 'dots', speed: 0.3, opacity: 0.1, scale: 1, visible: true, colorSource: 'accent'
            });
            this.expandedLayerIndex = this.draft.backgroundLayers.length - 1;
            this.renderControls();
        });
        root.appendChild(addBtn);
    },

    renderLevelTab(root) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const minW = (pcm && pcm.minLevelWidth) || 160;
        const maxW = (pcm && pcm.maxLevelWidth) || 960;
        const minH = (pcm && pcm.minLevelHeight) || 200;
        const maxH = (pcm && pcm.maxLevelHeight) || 1200;
        const minZ = (pcm && pcm.minViewZoom) || 0.5;
        const maxZ = (pcm && pcm.maxViewZoom) || 3;
        const defW = (pcm && pcm.defaultLevelWidth) || 240;
        const defH = (pcm && pcm.defaultLevelHeight) || 300;
        const defZ = (pcm && pcm.defaultViewZoom) || 1;

        const hint = document.createElement('div');
        hint.className = 'pe-hint';
        hint.textContent = 'Map size = full playfield (always fully visible; larger map = automatic zoom-out). Content scale stays fixed for the whole mission (ships / multi-part bosses / obstacles).';
        root.appendChild(hint);

        root.appendChild(this.makeSlider(
            'Map width',
            this.draft.levelWidth != null ? this.draft.levelWidth : defW,
            minW, maxW, 10,
            (v) => {
                this.draft.levelWidth = Math.round(v);
                this.syncPreviewPlayfield();
            },
            true
        ));

        root.appendChild(this.makeSlider(
            'Map height',
            this.draft.levelHeight != null ? this.draft.levelHeight : defH,
            minH, maxH, 10,
            (v) => {
                this.draft.levelHeight = Math.round(v);
                this.syncPreviewPlayfield();
            },
            true
        ));

        root.appendChild(this.makeSlider(
            'Content scale',
            this.draft.viewZoom != null ? this.draft.viewZoom : defZ,
            minZ, maxZ, 0.05,
            (v) => {
                this.draft.viewZoom = Math.round(v * 100) / 100;
            }
        ));

        const scaleHint = document.createElement('div');
        scaleHint.className = 'pe-hint';
        scaleHint.textContent = 'Content scale enlarges ships, bosses and obstacles in world units. It does not change mid-fight and does not crop the map.';
        root.appendChild(scaleHint);

        const presets = document.createElement('div');
        presets.className = 'pe-row';
        presets.style.gap = '8px';
        presets.style.flexWrap = 'wrap';

        const makePreset = (label, w, h, z) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-btn';
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.draft.levelWidth = w;
                this.draft.levelHeight = h;
                this.draft.viewZoom = z;
                this.syncPreviewPlayfield();
                this.renderControls();
            });
            return btn;
        };

        presets.appendChild(makePreset('DEFAULT 240×300', defW, defH, 1));
        presets.appendChild(makePreset('WIDE 320×360', 320, 360, 1));
        presets.appendChild(makePreset('LARGE 480×600', 480, 600, 1));
        presets.appendChild(makePreset('BOSS ARENA 640×800', 640, 800, 1.25));
        root.appendChild(presets);

        const sizeLabel = document.createElement('div');
        sizeLabel.className = 'pe-hint';
        sizeLabel.style.marginTop = '8px';
        const lw = this.draft.levelWidth != null ? this.draft.levelWidth : defW;
        const lh = this.draft.levelHeight != null ? this.draft.levelHeight : defH;
        const vz = this.draft.viewZoom != null ? this.draft.viewZoom : defZ;
        const fitPct = Math.round((defW / Math.max(lw, 1)) * 100);
        sizeLabel.textContent = `Map ${lw}×${lh} · content ×${vz.toFixed(2)} · auto fit ~${fitPct}% vs default (whole map visible)`;
        root.appendChild(sizeLabel);
    },

    syncPreviewPlayfield() {
        if (!this.previewCanvas || !this.draft) return;
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const w = pcm && pcm.normalizeLevelWidth
            ? pcm.normalizeLevelWidth(this.draft.levelWidth)
            : Math.max(160, Math.min(960, Math.round(this.draft.levelWidth || 240)));
        const h = pcm && pcm.normalizeLevelHeight
            ? pcm.normalizeLevelHeight(this.draft.levelHeight)
            : Math.max(200, Math.min(1200, Math.round(this.draft.levelHeight || 300)));
        if (this.previewCanvas.width !== w || this.previewCanvas.height !== h) {
            this.previewCanvas.width = w;
            this.previewCanvas.height = h;
            this.previewCtx = this.previewCanvas.getContext('2d');
            if (this.previewCtx) this.previewCtx.imageSmoothingEnabled = false;
            this.previewObstacles = [];
        }
        this.applyPreviewView();
    },
});
