"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    renderGraphicsTab(root) {
        if (!this.draft.graphics) this.draft.graphics = {};

        const themeIds = ['inherit'].concat(
            (typeof themeContextManager !== 'undefined')
                ? themeContextManager.presetIds.slice()
                : ['grayscale', 'retro', 'neon', 'ocean', 'fire', 'purple', 'forest', 'sunset']
        );

        const galaxyId = this.draft.galaxyId || planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
        const galaxy = planetConfigManager.getGalaxy(galaxyId);
        if (galaxy) planetConfigManager.migrateGalaxyThemeToBaseColor(galaxy);
        const galaxyBase = (galaxy && galaxy.baseColor) || '#808080';
        const galaxyHasBase = !!(galaxy && galaxy.baseColor);

        root.appendChild(this.makeColor(
            'Galaxy base color',
            galaxyBase,
            (v) => {
                planetConfigManager.setGalaxyBaseColor(galaxyId, v, { persist: false });
                if (typeof themeContextManager !== 'undefined') {
                    themeContextManager.applyForPlanet(this.selectedPlanet, null);
                }
            },
            {
                clearable: true,
                cleared: !galaxyHasBase,
                onClear: () => {
                    planetConfigManager.setGalaxyBaseColor(galaxyId, null, { persist: false });
                    if (typeof themeContextManager !== 'undefined') {
                        themeContextManager.applyForPlanet(this.selectedPlanet, null);
                    }
                    this.renderControls();
                }
            }
        ));

        root.appendChild(this.makeSelect(
            'Planet theme',
            this.draft.theme || 'inherit',
            themeIds,
            (v) => {
                this.draft.theme = (v === 'inherit') ? null : v;
                if (typeof themeContextManager !== 'undefined') {
                    themeContextManager.applyForPlanet(this.selectedPlanet, null);
                }
            }
        ));

        const stageKeys = ['1', '2', '3', 'boss'];
        if (!this.draft.stages) this.draft.stages = {};
        stageKeys.forEach((key) => {
            const stage = this.draft.stages[key] || {};
            const current = stage.theme || 'inherit';
            root.appendChild(this.makeSelect(
                `Stage ${key} theme`,
                current,
                themeIds,
                (v) => {
                    if (!this.draft.stages[key]) this.draft.stages[key] = {};
                    if (v === 'inherit') {
                        delete this.draft.stages[key].theme;
                    } else {
                        this.draft.stages[key].theme = v;
                    }
                }
            ));
        });

        root.appendChild(this.makeSelect(
            'Obstacle style',
            this.draft.graphics.obstacleStyle || 'asteroid',
            ['asteroid', 'shield', 'mixed'],
            (v) => { this.draft.graphics.obstacleStyle = v; }
        ));

        root.appendChild(this.makeText(
            'YouTube soundtrack',
            this.draft.soundtrackUrl || '',
            (v) => { this.draft.soundtrackUrl = String(v || '').trim(); },
            'https://youtu.be/… or video id'
        ));
        const ytHint = document.createElement('p');
        ytHint.className = 'pe-hint';
        ytHint.textContent = 'Optional YouTube URL as planet BGM. Empty = procedural ambient. Video must allow embedding.';
        root.appendChild(ytHint);

        root.appendChild(this.makeSlider(
            'Soundtrack BPM',
            this.draft.soundtrackBpm != null ? this.draft.soundtrackBpm : 120,
            60,
            220,
            1,
            (v) => { this.draft.soundtrackBpm = Math.round(Number(v)); },
            true
        ));
        const bpmHint = document.createElement('p');
        bpmHint.className = 'pe-hint';
        bpmHint.textContent = 'Beat sync for enemy movement and power shots. Match this to the YouTube track tempo.';
        root.appendChild(bpmHint);

        if (!Array.isArray(this.draft.factions)) this.draft.factions = [];
        const factionHint = document.createElement('p');
        factionHint.className = 'pe-hint';
        factionHint.textContent = 'Factions on this planet. Empty = all factions allowed. Enemy ship types and spawn factions are filtered by this list.';
        root.appendChild(factionHint);
        root.appendChild(this.makeMultiCheck(
            'Factions',
            planetConfigManager.availableFactions || [],
            this.draft.factions,
            (next) => { this.draft.factions = next; }
        ));

        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'Environment theme (background only — ships & UI keep the faction look). Priority: Stage → Planet → Galaxy → Faction. Inherit skips that level.';
        root.appendChild(hint);

        const hint2 = document.createElement('p');
        hint2.className = 'pe-hint';
        hint2.textContent = 'Enemy ships, champions and spawn times are configured in the ENEMIES tab.';
        root.appendChild(hint2);

        const comfyRow = document.createElement('div');
        comfyRow.className = 'pe-row';
        const comfyLabel = document.createElement('label');
        comfyLabel.textContent = 'Pixel assets';
        const comfyBtn = document.createElement('button');
        comfyBtn.type = 'button';
        comfyBtn.className = 'pe-btn pe-primary';
        comfyBtn.textContent = 'COMFYUI';
        comfyBtn.title = 'Open ComfyUI pixel renderer (npm run comfy → :8188)';
        comfyBtn.addEventListener('click', () => {
            window.open('http://127.0.0.1:8188', '_blank', 'noopener');
        });
        comfyRow.appendChild(comfyLabel);
        comfyRow.appendChild(comfyBtn);
        root.appendChild(comfyRow);

        const comfyHint = document.createElement('p');
        comfyHint.className = 'pe-hint';
        comfyHint.textContent = 'Start: npm run comfy · UI: http://127.0.0.1:8188 · Workflow: VF Pixel Sprite · Output: assets/_generated/';
        root.appendChild(comfyHint);
    },

    makeSlider(labelText, value, min, max, step, onChange, integer) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-slider-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const val = document.createElement('span');
        val.className = 'pe-val';
        val.textContent = integer ? String(Math.round(value)) : Number(value).toFixed(2);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('input', () => {
            const v = Number(input.value);
            val.textContent = integer ? String(Math.round(v)) : v.toFixed(2);
            onChange(v);
        });
        row.appendChild(label);
        row.appendChild(val);
        row.appendChild(input);
        return row;
    },

    makeSelect(labelText, value, options, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === value) o.selected = true;
            select.appendChild(o);
        });
        select.addEventListener('change', () => onChange(select.value));
        row.appendChild(label);
        row.appendChild(select);
        return row;
    },

    makeText(labelText, value, onChange, placeholder) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-text-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'url';
        input.value = value || '';
        if (placeholder) input.placeholder = placeholder;
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.addEventListener('change', () => onChange(input.value));
        input.addEventListener('blur', () => onChange(input.value));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    },

    makeColor(labelText, value, onChange, options) {
        const opts = options || {};
        const row = document.createElement('div');
        row.className = 'pe-row pe-color-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'color';
        const hex = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex)
            ? colorPaletteSystem.normalizeHex(value || '#808080')
            : (value || '#808080');
        input.value = hex;
        input.disabled = !!opts.cleared;
        const hexEl = document.createElement('span');
        hexEl.className = 'pe-hex';
        hexEl.textContent = opts.cleared ? 'inherit' : input.value;
        input.addEventListener('input', () => {
            hexEl.textContent = input.value;
            onChange(input.value);
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(hexEl);
        if (opts.clearable) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'pe-btn pe-color-clear';
            clearBtn.textContent = opts.cleared ? 'SET' : 'INHERIT';
            clearBtn.addEventListener('click', () => {
                if (opts.cleared) {
                    input.disabled = false;
                    onChange(input.value);
                    if (typeof this.renderControls === 'function') this.renderControls();
                } else if (typeof opts.onClear === 'function') {
                    opts.onClear();
                }
            });
            row.appendChild(clearBtn);
        }
        return row;
    },

    makeCheckbox(labelText, checked, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-row-check';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    },
});
