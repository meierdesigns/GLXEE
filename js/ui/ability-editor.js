"use strict";

/**
 * Ability Editor — edit shared ability metadata (icon, cluster, type, …).
 * Open: Abilities viewer → EDIT / NEW
 */
class AbilityEditorUI {
    constructor() {
        this.visible = false;
        this.returnTo = null;
        this.selectedId = 'player_control';
        this.draft = null;
    }

    init() {
        this.ensureOverlay();
    }

    ensureOverlay() {
        if (document.getElementById('abilityEditorOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'abilityEditorOverlay';
        overlay.className = 'planet-editor-overlay ability-editor-overlay hidden';
        overlay.innerHTML = `
            <div class="planet-editor-panel">
                <div class="planet-editor-header">
                    <h2>ABILITY EDITOR</h2>
                    <div class="planet-editor-planet-select" id="aeTypeSelect"></div>
                </div>
                <div class="planet-editor-body ae-body-single">
                    <div class="planet-editor-controls" id="aeControls"></div>
                </div>
                <div class="planet-editor-footer">
                    <button type="button" class="pe-btn" id="aeNew">NEW</button>
                    <button type="button" class="pe-btn" id="aeReset">RESET</button>
                    <button type="button" class="pe-btn pe-primary" id="aeSave">SAVE</button>
                    <button type="button" class="pe-btn" id="aeClose">CLOSE</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#aeSave').addEventListener('click', () => this.save());
        overlay.querySelector('#aeReset').addEventListener('click', () => this.reset());
        overlay.querySelector('#aeNew').addEventListener('click', () => this.createNew());
        overlay.querySelector('#aeClose').addEventListener('click', () => this.hide());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.visible) {
                e.preventDefault();
                this.hide();
            }
        });
    }

    persistMenuState() {
        if (typeof menuStateManager !== 'undefined' && this.visible) {
            menuStateManager.setScreen('ability-editor', {
                abilityId: this.selectedId,
                returnTo: this.returnTo
            });
        }
    }

    show(abilityId, fromRestore, options) {
        this.ensureOverlay();
        if (abilityId) this.selectedId = String(abilityId);
        if (options && options.returnTo) this.returnTo = options.returnTo;
        else if (!fromRestore) this.returnTo = null;
        this.loadDraft();
        this.visible = true;
        document.getElementById('abilityEditorOverlay').classList.remove('hidden');
        this.renderTypeSelect();
        this.renderControls();
        if (!fromRestore && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('ability-editor', {
                abilityId: this.selectedId,
                returnTo: this.returnTo
            });
        }
    }

    hide() {
        this.visible = false;
        const el = document.getElementById('abilityEditorOverlay');
        if (el) el.classList.add('hidden');
        const backTo = this.returnTo;
        this.returnTo = null;
        if (backTo === 'ability-viewer' && typeof abilityViewerUI !== 'undefined') {
            abilityViewerUI.show({ abilityId: this.selectedId });
            return;
        }
        if (backTo === 'defense-viewer' && typeof defenseViewerUI !== 'undefined') {
            defenseViewerUI.show({ defenseId: this.selectedId });
            return;
        }
        if (typeof menuStateManager !== 'undefined') {
            const container = document.querySelector('.game-container');
            const inGame = container && container.style.display !== 'none';
            menuStateManager.setScreen(inGame ? 'ingame' : 'start');
        }
    }

    loadDraft() {
        if (typeof abilityConfigManager === 'undefined') {
            this.draft = {
                id: this.selectedId,
                name: this.selectedId,
                description: '',
                icon: '◆',
                cluster: 'other',
                type: 'passive',
                tier: 1,
                uiDescription: '',
                custom: false
            };
            return;
        }
        this.draft = JSON.parse(JSON.stringify(abilityConfigManager.getAbility(this.selectedId)));
    }

    createNew() {
        if (typeof abilityConfigManager === 'undefined') return;
        const ability = abilityConfigManager.createAbility({ name: 'New Ability' });
        this.selectedId = ability.id;
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        this.persistMenuState();
    }

    renderTypeSelect() {
        const root = document.getElementById('aeTypeSelect');
        if (!root) return;
        root.innerHTML = '';
        const ids = typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.getIds()
            : [this.selectedId];
        ids.forEach((id) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pe-planet-btn' + (id === this.selectedId ? ' active' : '');
            const meta = typeof abilityConfigManager !== 'undefined'
                ? abilityConfigManager.getAbility(id)
                : { icon: '◆', name: id };
            const iconHtml = typeof abilityConfigManager !== 'undefined'
                ? abilityConfigManager.resolveIconHtml(meta.icon, 14, 'cv-ability-icon-img')
                : meta.icon;
            btn.innerHTML = `${iconHtml} <span>${meta.name}</span>`;
            btn.addEventListener('click', () => {
                this.selectedId = id;
                this.loadDraft();
                this.renderTypeSelect();
                this.renderControls();
                this.persistMenuState();
            });
            root.appendChild(btn);
        });
    }

    renderControls() {
        const root = document.getElementById('aeControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        const preview = document.createElement('div');
        preview.className = 'ae-preview';
        preview.innerHTML = `<span class="ae-preview-icon">${typeof abilityConfigManager !== 'undefined' ? abilityConfigManager.resolveIconHtml(this.draft.icon || '◆', 32, 'cv-ability-icon-img') : (this.draft.icon || '◆')}</span>` +
            `<span class="ae-preview-name">${this.draft.name || this.draft.id}</span>`;
        root.appendChild(preview);

        root.appendChild(this.makeTextInput('Name', this.draft.name || '', (v) => {
            this.draft.name = v;
            this.updatePreview();
        }));
        root.appendChild(this.makeTextInput('Icon key', this.draft.icon || '', (v) => {
            this.draft.icon = v || '◆';
            this.updatePreview();
        }));
        root.appendChild(this.makeTextInput('Description', this.draft.description || '', (v) => {
            this.draft.description = v;
        }));
        root.appendChild(this.makeTextInput('UI summary', this.draft.uiDescription || '', (v) => {
            this.draft.uiDescription = v;
        }));

        const clusters = (typeof abilityConfigManager !== 'undefined'
            ? abilityConfigManager.clusterOrder.map((c) => c.id)
            : ['core', 'mobility', 'offense', 'defense', 'combat', 'other']);
        root.appendChild(this.makeSelect('Cluster', this.draft.cluster || 'other', clusters, (v) => {
            this.draft.cluster = v;
        }));
        root.appendChild(this.makeSelect('Type', this.draft.type || 'passive', ['passive', 'active'], (v) => {
            this.draft.type = v;
        }));
        root.appendChild(this.makeSlider('Tier', this.draft.tier || 1, 1, 5, 1, (v) => {
            this.draft.tier = Math.round(v);
        }));
    }

    updatePreview() {
        const icon = document.querySelector('#aeControls .ae-preview-icon');
        const name = document.querySelector('#aeControls .ae-preview-name');
        if (icon) {
            icon.innerHTML = typeof abilityConfigManager !== 'undefined'
                ? abilityConfigManager.resolveIconHtml(this.draft.icon || '◆', 32, 'cv-ability-icon-img')
                : (this.draft.icon || '◆');
        }
        if (name) name.textContent = this.draft.name || this.draft.id;
    }

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
    }

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
    }

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
    }

    save() {
        if (typeof abilityConfigManager === 'undefined' || !this.draft) return;
        abilityConfigManager.setAbility(this.selectedId, this.draft);
        this.loadDraft();
        this.renderTypeSelect();
        this.renderControls();
        const header = document.querySelector('#abilityEditorOverlay .planet-editor-header h2');
        if (header) {
            const prev = header.textContent;
            header.textContent = 'SAVED';
            setTimeout(() => { header.textContent = prev || 'ABILITY EDITOR'; }, 700);
        }
    }

    reset() {
        if (typeof abilityConfigManager === 'undefined') return;
        abilityConfigManager.resetAbility(this.selectedId);
        this.loadDraft();
        this.renderControls();
    }
}

const abilityEditorUI = new AbilityEditorUI();
abilityEditorUI.init();
