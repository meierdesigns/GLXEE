"use strict";

// ShipEditorUI methods, split from ship-editor.js.
extendClass(ShipEditorUI, {
    renderAbilitiesTab(root) {
        const abilities = this.getSharedAbilityIds();
        const current = this.draft.abilities || [];
        const clusterOrder = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.clusterOrder
            : [
                { id: 'core', label: 'CORE' },
                { id: 'mobility', label: 'MOBILITY' },
                { id: 'offense', label: 'OFFENSE' },
                { id: 'defense', label: 'DEFENSE' },
                { id: 'combat', label: 'COMBAT' },
                { id: 'other', label: 'OTHER' }
            ];
        const grouped = {};
        abilities.forEach((a) => {
            const cluster = this.getAbilityMeta(a).cluster;
            if (!grouped[cluster]) grouped[cluster] = [];
            grouped[cluster].push(a);
        });

        clusterOrder.forEach((cluster) => {
            const list = grouped[cluster.id];
            if (!list || !list.length) return;

            const group = document.createElement('div');
            group.className = 'pe-ability-group';
            const title = document.createElement('div');
            title.className = 'pe-ability-group-title';
            title.textContent = cluster.label;
            group.appendChild(title);

            list.forEach((a) => {
                const on = current.indexOf(a) !== -1;
                const meta = this.getAbilityMeta(a);
                const label = meta.name || a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                group.appendChild(this.makeCheckbox(label, on, (checked) => {
                    if (!Array.isArray(this.draft.abilities)) this.draft.abilities = [];
                    if (checked) {
                        if (this.draft.abilities.indexOf(a) === -1) this.draft.abilities.push(a);
                    } else {
                        this.draft.abilities = this.draft.abilities.filter((x) => x !== a);
                    }
                }, meta.icon));
            });

            root.appendChild(group);
        });
    },

    makeSlider(labelText, value, min, max, step, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const val = document.createElement('span');
        val.className = 'pe-val';
        const format = (v) => (step < 1 ? Number(v).toFixed(2) : String(Math.round(v)));
        val.textContent = format(value);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('input', () => {
            const v = Number(input.value);
            val.textContent = format(v);
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
        options.forEach((opt) => {
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

    makeTextInput(labelText, value, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.className = 'pe-text-input';
        input.addEventListener('input', () => onChange(input.value));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    },

    makeCheckbox(labelText, checked, onChange, icon) {
        const row = document.createElement('div');
        row.className = 'pe-row pe-row-check';
        const label = document.createElement('label');
        if (icon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'pe-ability-icon';
            if (typeof abilityConfigManager !== 'undefined' && String(icon).indexOf('ability_') === 0) {
                iconEl.innerHTML = abilityConfigManager.resolveIconHtml(icon, 16, 'cv-ability-icon-img');
            } else {
                iconEl.textContent = icon;
            }
            label.appendChild(iconEl);
            label.appendChild(document.createTextNode(labelText));
        } else {
            label.textContent = labelText;
        }
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    },

    save() {
        if (typeof shipConfigManager === 'undefined' || !this.draft) return;
        shipConfigManager.setConfig(this.selectedType, this.draft);
        shipConfigManager.applyToRuntime(this.selectedType);
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        const header = document.querySelector('#shipEditorOverlay .planet-editor-header h2');
        if (header) {
            const prev = header.textContent;
            header.textContent = 'SAVED';
            setTimeout(() => { header.textContent = prev || 'SHIP EDITOR'; }, 700);
        }
    },

    reset() {
        if (typeof shipConfigManager === 'undefined') return;
        shipConfigManager.resetConfig(this.selectedType);
        this.loadDraft();
        this.renderControls();
        this.resetPreviewSim();
    },

    startPreview() {
        this.stopPreview();
        this.previewLastTs = 0;
        if (!this.previewSim) this.resetPreviewSim();
        const loop = (ts) => {
            if (!this.visible) return;
            if (!this.previewLastTs) this.previewLastTs = ts;
            const dt = Math.min(50, ts - this.previewLastTs);
            this.previewLastTs = ts;
            this.updatePreviewSim(dt);
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(loop);
        };
        this.previewAnimId = requestAnimationFrame(loop);
    },

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewLastTs = 0;
    },

    getPreviewModel() {
        let base = null;
        if (typeof shipConfigManager !== 'undefined') {
            base = shipConfigManager.getBaseModel(this.selectedType);
            if (this.draft && this.draft.modelClass && base) {
                const classMap = {
                    starfighter: 'player',
                    interceptor: 'player_interceptor',
                    heavy_fighter: 'player_heavy',
                    assault: 'player_assault'
                };
                const key = classMap[this.draft.modelClass];
                if (key && typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
                    const alt = graphicsManager.shipAssetLoader.getShip(key);
                    if (alt) base = alt;
                }
            }
        }
        return Object.assign({}, base || {
            width: 20,
            height: 16,
            type: 'player',
            modelClass: 'starfighter',
            sprite: null
        }, {
            id: this.selectedType,
            name: this.draft && this.draft.name,
            speed: this.draft && this.draft.speed,
            maxHealth: this.draft && this.draft.maxHealth,
            armor: this.draft && this.draft.armor,
            damage: this.draft && this.draft.damage,
            modelClass: this.draft && this.draft.modelClass
        });
    },

    resetPreviewSim() {
        const w = 200;
        const h = 300;
        const model = this.getPreviewModel();
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        this.previewSim = {
            player: {
                x: w / 2 - shipW / 2,
                y: h - 50,
                width: shipW,
                height: shipH,
                vx: 1.2,
                dir: 1
            },
            bullets: [],
            shootAcc: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    },
});
