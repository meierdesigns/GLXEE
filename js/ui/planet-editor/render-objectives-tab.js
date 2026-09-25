"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    renderObjectivesTab(root) {
        if (this.objectiveScope == null) this.objectiveScope = 'planet';
        if (!this.objectiveStageKey) this.objectiveStageKey = '1';

        const scopeRow = document.createElement('div');
        scopeRow.className = 'pe-row';
        scopeRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'Objective scope' }));
        const scopeSelect = document.createElement('select');
        [['planet', 'Planet overall'], ['stage', 'Stage']].forEach(([v, label]) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = label;
            if (this.objectiveScope === v) opt.selected = true;
            scopeSelect.appendChild(opt);
        });
        scopeSelect.addEventListener('change', () => {
            this.objectiveScope = scopeSelect.value;
            this.renderControls();
        });
        scopeRow.appendChild(scopeSelect);
        root.appendChild(scopeRow);

        if (this.objectiveScope === 'stage') {
            root.appendChild(this.makeSelect('Stage', this.objectiveStageKey, ['1', '2', '3', 'boss'], (v) => {
                this.objectiveStageKey = v;
                this.renderControls();
            }));
        }

        const objective = this.getEditorObjective();
        const enemies = this.objectiveScope === 'stage'
            ? this.getEditorEnemyList()
            : (this.draft.enemies || []);

        root.appendChild(this.makeSelect(
            'Type',
            objective.type || 'hunt',
            ['hunt', 'killCount', 'surviveCount', 'surviveTime'],
            (v) => {
                objective.type = v;
                this.renderControls();
            }
        ));

        if (objective.type === 'hunt') {
            const ids = enemies.map(e => e.id);
            if (!ids.length) ids.push('(add enemies first)');
            root.appendChild(this.makeSelect(
                'Target enemy id',
                objective.targetEnemyId || ids[0],
                ids,
                (v) => { objective.targetEnemyId = v; }
            ));
        } else if (objective.type === 'killCount') {
            root.appendChild(this.makeSlider('Kill count', objective.count != null ? objective.count : 5, 1, 50, 1, (v) => {
                objective.count = Math.round(v);
            }, true));
            const typeOpts = ['(any)'].concat(planetConfigManager.availableEnemyTypes);
            root.appendChild(this.makeSelect(
                'Enemy type filter',
                objective.enemyType || '(any)',
                typeOpts,
                (v) => {
                    if (v === '(any)') delete objective.enemyType;
                    else objective.enemyType = v;
                }
            ));
            root.appendChild(this.makeSelect(
                'Faction filter',
                objective.faction || '(any)',
                ['(any)'].concat(planetConfigManager.availableFactions || []),
                (v) => {
                    if (v === '(any)') delete objective.faction;
                    else objective.faction = v;
                }
            ));
            root.appendChild(this.makeSelect(
                'Class filter',
                objective.enemyClass || '(any)',
                ['(any)'].concat(planetConfigManager.availableEnemyClasses || []),
                (v) => {
                    if (v === '(any)') delete objective.enemyClass;
                    else objective.enemyClass = v;
                }
            ));
            root.appendChild(this.makeSelect(
                'Cluster filter',
                objective.cluster || '(any)',
                ['(any)'].concat(planetConfigManager.availableClusters || []),
                (v) => {
                    if (v === '(any)') delete objective.cluster;
                    else objective.cluster = v;
                }
            ));
        } else if (objective.type === 'surviveCount') {
            root.appendChild(this.makeSlider('Survive spawns', objective.count != null ? objective.count : 5, 1, 50, 1, (v) => {
                objective.count = Math.round(v);
            }, true));
        } else if (objective.type === 'surviveTime') {
            root.appendChild(this.makeSlider('Survive seconds', objective.seconds != null ? objective.seconds : 60, 5, 300, 5, (v) => {
                objective.seconds = Math.round(v);
            }, true));
        }

        const dailyHead = document.createElement('h3');
        dailyHead.className = 'pe-hint';
        dailyHead.textContent = 'DAILIES';
        dailyHead.style.marginTop = '16px';
        root.appendChild(dailyHead);

        if (!this.draft.dailies) {
            this.draft.dailies = { enabled: false, enemyType: 'enemyBasic', killCountPerDay: 5, requiredDays: 3 };
        }
        const d = this.draft.dailies;

        const enRow = document.createElement('div');
        enRow.className = 'pe-row';
        enRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'Enabled' }));
        const enCb = document.createElement('input');
        enCb.type = 'checkbox';
        enCb.checked = d.enabled !== false;
        enCb.addEventListener('change', () => { d.enabled = enCb.checked; });
        enRow.appendChild(enCb);
        root.appendChild(enRow);

        root.appendChild(this.makeSelect('Kill type', d.enemyType || 'enemyBasic', planetConfigManager.availableEnemyTypes, (v) => {
            d.enemyType = v;
        }));
        root.appendChild(this.makeSelect(
            'Faction filter',
            d.faction || '(any)',
            ['(any)'].concat(planetConfigManager.availableFactions || []),
            (v) => {
                if (v === '(any)') d.faction = null;
                else d.faction = v;
            }
        ));
        root.appendChild(this.makeSelect(
            'Class filter',
            d.enemyClass || '(any)',
            ['(any)'].concat(planetConfigManager.availableEnemyClasses || []),
            (v) => {
                if (v === '(any)') d.enemyClass = null;
                else d.enemyClass = v;
            }
        ));
        root.appendChild(this.makeSlider('Kills per day', d.killCountPerDay != null ? d.killCountPerDay : 5, 1, 30, 1, (v) => {
            d.killCountPerDay = Math.round(v);
        }, true));
        root.appendChild(this.makeSlider('Required days', d.requiredDays != null ? d.requiredDays : 3, 1, 30, 1, (v) => {
            d.requiredDays = Math.round(v);
        }, true));

        const resHead = document.createElement('h3');
        resHead.className = 'pe-hint';
        resHead.textContent = 'RESOURCES (MISSION LOOT)';
        resHead.style.marginTop = '16px';
        root.appendChild(resHead);

        if (!Array.isArray(this.draft.resources)) {
            this.draft.resources = [];
        }
        const resourceIds = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];

        this.draft.resources.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'pe-row pe-resource-row';
            row.style.flexWrap = 'wrap';
            row.style.gap = '6px';
            row.style.marginBottom = '8px';

            const idSel = document.createElement('select');
            resourceIds.forEach((rid) => {
                const opt = document.createElement('option');
                opt.value = rid;
                opt.textContent = (typeof economyConfig !== 'undefined')
                    ? economyConfig.getResourceLabel(rid)
                    : rid.toUpperCase();
                if (entry.id === rid) opt.selected = true;
                idSel.appendChild(opt);
            });
            idSel.addEventListener('change', () => {
                entry.id = idSel.value;
            });
            row.appendChild(idSel);

            const minLab = document.createElement('label');
            minLab.textContent = 'min';
            const minIn = document.createElement('input');
            minIn.type = 'number';
            minIn.min = '0';
            minIn.value = entry.min != null ? entry.min : 1;
            minIn.style.width = '48px';
            minIn.addEventListener('change', () => {
                entry.min = Math.max(0, parseInt(minIn.value, 10) || 0);
            });
            row.appendChild(minLab);
            row.appendChild(minIn);

            const maxLab = document.createElement('label');
            maxLab.textContent = 'max';
            const maxIn = document.createElement('input');
            maxIn.type = 'number';
            maxIn.min = '0';
            maxIn.value = entry.max != null ? entry.max : 2;
            maxIn.style.width = '48px';
            maxIn.addEventListener('change', () => {
                entry.max = Math.max(0, parseInt(maxIn.value, 10) || 0);
            });
            row.appendChild(maxLab);
            row.appendChild(maxIn);

            const rem = document.createElement('button');
            rem.className = 'action-button secondary';
            rem.type = 'button';
            rem.textContent = '×';
            rem.addEventListener('click', () => {
                this.draft.resources.splice(index, 1);
                this.renderControls();
            });
            row.appendChild(rem);
            root.appendChild(row);
        });

        const addRes = document.createElement('button');
        addRes.className = 'action-button';
        addRes.type = 'button';
        addRes.textContent = 'ADD RESOURCE';
        addRes.addEventListener('click', () => {
            this.draft.resources.push({ id: resourceIds[0], weight: 1, min: 1, max: 3 });
            this.renderControls();
        });
        root.appendChild(addRes);
    },

    renderSideEnemiesTab(root) {
        this.renderEnemiesTab(root);
    },
});
