"use strict";

// EnemyEditorUI methods, split from enemy-editor.js.
extendClass(EnemyEditorUI, {
    makeMultiCheck(labelText, options, selected, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'pe-ability-group';
        const title = document.createElement('div');
        title.className = 'pe-ability-group-title';
        title.textContent = labelText;
        wrap.appendChild(title);
        const state = Array.isArray(selected) ? selected.slice() : [];
        options.forEach((opt) => {
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

    renderBehaviorTab(root) {
        root.appendChild(this.makeSlider('Shoot interval (ms)', this.draft.shootInterval, 200, 5000, 50, (v) => {
            this.draft.shootInterval = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Evasion cooldown (ms)', this.draft.evasionCooldown, 500, 12000, 100, (v) => {
            this.draft.evasionCooldown = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Evasion duration (ms)', this.draft.evasionDuration, 200, 4000, 50, (v) => {
            this.draft.evasionDuration = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Evasion speed', this.draft.evasionSpeed, 0.1, 8, 0.1, (v) => {
            this.draft.evasionSpeed = v;
        }));
        root.appendChild(this.makeSlider('Evasion chance', this.draft.evasionChance, 0, 1, 0.05, (v) => {
            this.draft.evasionChance = v;
        }));
        root.appendChild(this.makeSlider('Player prediction', this.draft.predictionSkill, 0, 1, 0.05, (v) => {
            this.draft.predictionSkill = v;
        }));
        root.appendChild(this.makeSlider('Min Y', this.draft.minY, 0, 150, 1, (v) => {
            this.draft.minY = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Max Y', this.draft.maxY, 40, 250, 1, (v) => {
            this.draft.maxY = Math.round(v);
        }));
    },

    renderWeaponsTab(root) {
        const weapons = typeof enemyConfigManager !== 'undefined'
            ? enemyConfigManager.availableWeapons
            : ['laser', 'plasma', 'spread', 'rapid'];
        root.appendChild(this.makeSelect('Default weapon', this.draft.defaultWeapon || 'laser', weapons, (v) => {
            this.draft.defaultWeapon = v;
        }));
        root.appendChild(this.makeSlider('Weapon damage', this.draft.weaponDamage, 1, 60, 1, (v) => {
            this.draft.weaponDamage = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Weapon speed', this.draft.weaponSpeed, 1, 12, 0.5, (v) => {
            this.draft.weaponSpeed = v;
        }));
        root.appendChild(this.makeSlider('Weapon cooldown (ms)', this.draft.weaponCooldown, 100, 4000, 50, (v) => {
            this.draft.weaponCooldown = Math.round(v);
        }));
    },

    renderArmorTab(root) {
        if (!Array.isArray(this.draft.defenseMechanisms)) {
            this.draft.defenseMechanisms = [];
        }
        if (this.draft.shieldMax == null) this.draft.shieldMax = 0;
        if (this.draft.shieldRegen == null) this.draft.shieldRegen = 0;
        if (this.draft.damageReduction == null) this.draft.damageReduction = 0;
        if (this.draft.reflectChance == null) this.draft.reflectChance = 0;

        root.appendChild(this.makeSlider('Armor', this.draft.armor, 0, 120, 1, (v) => {
            this.draft.armor = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Shield capacity', this.draft.shieldMax, 0, 300, 5, (v) => {
            this.draft.shieldMax = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Shield regen /s', this.draft.shieldRegen, 0, 40, 0.5, (v) => {
            this.draft.shieldRegen = v;
        }));
        root.appendChild(this.makeSlider('Damage reduction %', this.draft.damageReduction, 0, 80, 1, (v) => {
            this.draft.damageReduction = Math.round(v);
        }));
        root.appendChild(this.makeSlider('Reflect chance %', this.draft.reflectChance, 0, 100, 1, (v) => {
            this.draft.reflectChance = Math.round(v);
        }));
    },

    syncEnemyAbilities(list) {
        this.draft.abilities = list.slice();
        this.draft.defenseMechanisms = list.slice();
    },

    getAbilityMeta(id) {
        if (typeof abilityConfigManager !== 'undefined') {
            return abilityConfigManager.getMeta(id);
        }
        return { icon: '◆', cluster: 'other', name: id };
    },

    renderAbilitiesTab(root) {
        if (!Array.isArray(this.draft.abilities)) {
            this.draft.abilities = (this.draft.defenseMechanisms || []).slice();
        }
        const abilities = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.getIds()
            : (typeof enemyConfigManager !== 'undefined'
                ? enemyConfigManager.availableAbilities
                : []);
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

        const hint = document.createElement('div');
        hint.className = 'pe-row';
        hint.innerHTML = '<label>Shared ability pool (same as player ships)</label>';
        root.appendChild(hint);

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
                    const next = (this.draft.abilities || []).slice();
                    if (checked) {
                        if (next.indexOf(a) === -1) next.push(a);
                    } else {
                        const idx = next.indexOf(a);
                        if (idx !== -1) next.splice(idx, 1);
                    }
                    this.syncEnemyAbilities(next);
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
        if (typeof enemyConfigManager === 'undefined' || !this.draft) return;
        if (Array.isArray(this.draft.abilities)) {
            this.draft.defenseMechanisms = this.draft.abilities.slice();
        } else if (Array.isArray(this.draft.defenseMechanisms)) {
            this.draft.abilities = this.draft.defenseMechanisms.slice();
        }
        enemyConfigManager.setConfig(this.selectedType, this.draft);
        enemyConfigManager.applyToRuntime(this.selectedType);
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        const header = document.querySelector('#enemyEditorOverlay .planet-editor-header h2');
        if (header) {
            const prev = header.textContent;
            header.textContent = 'SAVED';
            setTimeout(() => { header.textContent = prev || 'ENEMY EDITOR'; }, 700);
        }
    },
});
