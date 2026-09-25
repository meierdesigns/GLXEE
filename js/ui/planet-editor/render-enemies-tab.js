"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    renderEnemiesTab(root) {
        if (this.objectiveScope == null) this.objectiveScope = 'planet';
        if (!this.objectiveStageKey) this.objectiveStageKey = '1';
        if (!this.enemyGroupBy) this.enemyGroupBy = 'faction';
        if (!this.enemyFilterFaction) this.enemyFilterFaction = '(all)';
        if (!this.enemyFilterClass) this.enemyFilterClass = '(all)';
        if (!this.enemyFilterCluster) this.enemyFilterCluster = '(all)';

        const pcm = planetConfigManager;
        const factions = pcm.availableFactions || [];
        const classes = pcm.availableEnemyClasses || [];
        const clusters = pcm.availableClusters || [];
        const planetFactions = Array.isArray(this.draft.factions) && this.draft.factions.length
            ? this.draft.factions.slice()
            : factions.slice();

        const scopeRow = document.createElement('div');
        scopeRow.className = 'pe-row';
        scopeRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'List scope' }));
        const scopeSelect = document.createElement('select');
        [['planet', 'Planet default'], ['stage', 'Stage override']].forEach(([v, label]) => {
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

        root.appendChild(this.makeSelect(
            'Group by',
            this.enemyGroupBy,
            ['faction', 'enemyClass', 'cluster', 'type', 'none'],
            (v) => {
                this.enemyGroupBy = v;
                this.renderControls();
            }
        ));

        root.appendChild(this.makeSelect(
            'Filter faction',
            this.enemyFilterFaction,
            ['(all)'].concat(planetFactions.length ? planetFactions : factions),
            (v) => {
                this.enemyFilterFaction = v;
                this.renderControls();
            }
        ));
        root.appendChild(this.makeSelect(
            'Filter class',
            this.enemyFilterClass,
            ['(all)'].concat(classes),
            (v) => {
                this.enemyFilterClass = v;
                this.renderControls();
            }
        ));
        root.appendChild(this.makeSelect(
            'Filter cluster',
            this.enemyFilterCluster,
            ['(all)'].concat(clusters),
            (v) => {
                this.enemyFilterCluster = v;
                this.renderControls();
            }
        ));

        const hint = document.createElement('p');
        hint.className = 'pe-hint';
        hint.textContent = 'Assign Faction, Class, Cluster. Same cluster spawns as one wave at the earliest spawnAt. Planet factions are set in GRAPHICS.';
        root.appendChild(hint);

        const list = this.getEditorEnemyList();
        const indexed = list.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
            if (this.enemyFilterFaction !== '(all)' && entry.faction !== this.enemyFilterFaction) return false;
            if (this.enemyFilterClass !== '(all)' && entry.enemyClass !== this.enemyFilterClass) return false;
            if (this.enemyFilterCluster !== '(all)' && entry.cluster !== this.enemyFilterCluster) return false;
            return true;
        });

        const groups = {};
        indexed.forEach(item => {
            let key = 'ALL';
            if (this.enemyGroupBy === 'faction') key = item.entry.faction || 'unknown';
            else if (this.enemyGroupBy === 'enemyClass') key = item.entry.enemyClass || 'unknown';
            else if (this.enemyGroupBy === 'cluster') key = item.entry.cluster || 'unknown';
            else if (this.enemyGroupBy === 'type') key = item.entry.type || 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        const groupKeys = Object.keys(groups).sort();
        groupKeys.forEach(groupKey => {
            if (this.enemyGroupBy !== 'none') {
                const header = document.createElement('div');
                header.className = 'pe-hint';
                header.style.marginTop = '10px';
                header.style.fontWeight = 'bold';
                const prefix = this.enemyGroupBy === 'faction' ? 'FACTION'
                    : this.enemyGroupBy === 'enemyClass' ? 'KLASSE'
                    : this.enemyGroupBy === 'cluster' ? 'CLUSTER'
                    : this.enemyGroupBy === 'type' ? 'TYPE' : '';
                header.textContent = `${prefix}: ${String(groupKey).toUpperCase()} (${groups[groupKey].length})`;
                root.appendChild(header);
            }

            groups[groupKey].forEach(({ entry, index }) => {
                const card = document.createElement('div');
                card.className = 'pe-layer-card';

                const idLabel = document.createElement('div');
                idLabel.className = 'pe-hint';
                idLabel.textContent = 'id: ' + (entry.id || ('e' + (index + 1)));
                card.appendChild(idLabel);

                const typeOpts = pcm.getAvailableEnemyTypesForPlanet
                    ? pcm.getAvailableEnemyTypesForPlanet(this.selectedPlanet)
                    : pcm.availableEnemyTypes;
                const shipTypes = typeOpts.indexOf(entry.type) === -1
                    ? typeOpts.concat([entry.type])
                    : typeOpts;
                card.appendChild(this.makeSelect('Ship type', entry.type, shipTypes, (v) => {
                    entry.type = v;
                    const tax = pcm.taxonomyForType ? pcm.taxonomyForType(v) : null;
                    if (tax) {
                        entry.faction = tax.faction;
                        entry.enemyClass = tax.enemyClass;
                    }
                    if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getConfig) {
                        const ecfg = enemyConfigManager.getConfig(v);
                        if (ecfg && ecfg.factions && ecfg.factions.length) {
                            entry.faction = ecfg.factions[0];
                        }
                    }
                    this.renderControls();
                }));

                const factionOpts = planetFactions.indexOf(entry.faction) === -1 && entry.faction
                    ? planetFactions.concat([entry.faction])
                    : planetFactions;
                card.appendChild(this.makeSelect('Faction', entry.faction || factionOpts[0] || factions[0], factionOpts, (v) => {
                    entry.faction = v;
                    this.renderControls();
                }));

                card.appendChild(this.makeSelect('Class', entry.enemyClass || classes[0], classes, (v) => {
                    entry.enemyClass = v;
                    this.renderControls();
                }));

                card.appendChild(this.makeSelect('Cluster', entry.cluster || clusters[0], clusters, (v) => {
                    entry.cluster = v;
                    this.renderControls();
                }));

                const champRow = document.createElement('div');
                champRow.className = 'pe-row';
                champRow.appendChild(Object.assign(document.createElement('label'), { textContent: 'Champion' }));
                const champCb = document.createElement('input');
                champCb.type = 'checkbox';
                champCb.checked = !!entry.champion;
                champCb.addEventListener('change', () => {
                    entry.champion = champCb.checked;
                    if (entry.champion && (!entry.level || entry.level < 2)) entry.level = 2;
                    this.renderControls();
                });
                champRow.appendChild(champCb);
                card.appendChild(champRow);

                card.appendChild(this.makeSlider('Level', entry.level != null ? entry.level : 1, 1, 10, 1, (v) => {
                    entry.level = Math.round(v);
                }, true));

                card.appendChild(this.makeSlider('Spawn at (s)', entry.spawnAt != null ? entry.spawnAt : 0, 0, 180, 1, (v) => {
                    entry.spawnAt = Math.round(v);
                }, true));

                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'pe-btn';
                del.textContent = 'REMOVE';
                del.addEventListener('click', () => {
                    list.splice(index, 1);
                    this.renderControls();
                });
                card.appendChild(del);
                root.appendChild(card);
            });
        });

        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'pe-btn';
        add.textContent = '+ ENEMY';
        add.addEventListener('click', () => {
            const id = pcm.nextEnemyId ? pcm.nextEnemyId('e') : ('e' + Date.now());
            const tax = pcm.taxonomyForType ? pcm.taxonomyForType('enemyBasic') : { faction: 'pirate', enemyClass: 'scout' };
            list.push({
                id: id,
                type: 'enemyBasic',
                faction: this.enemyFilterFaction !== '(all)' ? this.enemyFilterFaction : tax.faction,
                enemyClass: this.enemyFilterClass !== '(all)' ? this.enemyFilterClass : tax.enemyClass,
                cluster: this.enemyFilterCluster !== '(all)' ? this.enemyFilterCluster : 'alpha',
                champion: false,
                level: 1,
                spawnAt: list.length * 8
            });
            this.renderControls();
        });
        root.appendChild(add);
    },
});
