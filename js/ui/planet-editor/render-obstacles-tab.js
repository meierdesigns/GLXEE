"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    renderObstaclesTab(root) {
        const pcm = planetConfigManager;
        if (!Array.isArray(this.draft.obstacles)) {
            this.draft.obstacles = (this.draft.obstacleTypes || []).map((t, i) =>
                pcm.normalizeObstacleEntry
                    ? pcm.normalizeObstacleEntry(Object.assign({ type: t }, pcm.defaultsFromLegacyObstacleType(t)), i)
                    : { id: 'o' + (i + 1), type: t, kind: 'asteroid', cluster: 'alpha' }
            );
        }
        if (!this.obstacleFilterCluster) this.obstacleFilterCluster = '(all)';
        if (!this.obstacleFilterKind) this.obstacleFilterKind = '(all)';
        if (!this.obstacleGroupBy) this.obstacleGroupBy = 'cluster';

        root.appendChild(this.makeSlider(
            'Spawn interval (ms)',
            this.draft.obstacleSpawnRate || 2000,
            400, 6000, 100,
            (v) => { this.draft.obstacleSpawnRate = Math.round(v); },
            true
        ));

        const clusters = (pcm.availableClusters || []).slice();
        const kinds = pcm.availableObstacleKinds || ['asteroid', 'shield', 'fog'];
        const directions = pcm.availableObstacleDirections || ['ltr', 'rtl', 'ttb', 'btt', 'diag_dr', 'diag_ur'];
        const sprites = pcm.availableObstacleSprites || ['obstacle', 'shield', 'obstacleSmall', 'obstacleMedium', 'obstacleLarge', 'fog'];

        root.appendChild(this.makeSelect(
            'Group by',
            this.obstacleGroupBy,
            ['cluster', 'kind', 'none'],
            (v) => { this.obstacleGroupBy = v; this.renderControls(); }
        ));
        root.appendChild(this.makeSelect(
            'Filter cluster',
            this.obstacleFilterCluster,
            ['(all)'].concat(clusters),
            (v) => { this.obstacleFilterCluster = v; this.renderControls(); }
        ));
        root.appendChild(this.makeSelect(
            'Filter kind',
            this.obstacleFilterKind,
            ['(all)'].concat(kinds),
            (v) => { this.obstacleFilterKind = v; this.renderControls(); }
        ));

        const hint = document.createElement('div');
        hint.className = 'pe-hint';
        hint.textContent = 'Same cluster spawns as one wave. Fog blocks LoS to the player ship.';
        root.appendChild(hint);

        const toolbar = document.createElement('div');
        toolbar.className = 'pe-row';
        toolbar.style.gap = '8px';
        toolbar.style.flexWrap = 'wrap';

        const addClusterBtn = document.createElement('button');
        addClusterBtn.type = 'button';
        addClusterBtn.className = 'pe-btn';
        addClusterBtn.textContent = '+ CLUSTER';
        addClusterBtn.addEventListener('click', async () => {
            const name = await uiDialog.prompt('New cluster name (e.g. nebula_west)');
            if (!name) return;
            const id = pcm.addCluster ? pcm.addCluster(name) : null;
            if (id) {
                this.obstacleFilterCluster = id;
                this.renderControls();
            }
        });
        toolbar.appendChild(addClusterBtn);
        root.appendChild(toolbar);

        const list = this.draft.obstacles;
        const filtered = [];
        list.forEach((entry, index) => {
            if (this.obstacleFilterCluster !== '(all)' && entry.cluster !== this.obstacleFilterCluster) return;
            if (this.obstacleFilterKind !== '(all)' && entry.kind !== this.obstacleFilterKind) return;
            filtered.push({ entry, index });
        });

        const groups = {};
        filtered.forEach((item) => {
            let key = 'all';
            if (this.obstacleGroupBy === 'cluster') key = item.entry.cluster || 'unknown';
            else if (this.obstacleGroupBy === 'kind') key = item.entry.kind || 'unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        Object.keys(groups).forEach((groupKey) => {
            if (this.obstacleGroupBy !== 'none') {
                const header = document.createElement('div');
                header.className = 'pe-hint';
                header.style.marginTop = '10px';
                header.style.fontWeight = 'bold';
                const prefix = this.obstacleGroupBy === 'cluster' ? 'CLUSTER' : 'KIND';
                header.textContent = `${prefix}: ${String(groupKey).toUpperCase()} (${groups[groupKey].length})`;
                root.appendChild(header);
            }

            const options = { pcm, clusters, kinds, directions, sprites };
            groups[groupKey].forEach(({ entry, index }) => {
                this.renderObstacleCard(root, entry, index, options);
            });
        });

        const addRow = document.createElement('div');
        addRow.className = 'pe-row';
        addRow.style.gap = '8px';
        addRow.style.flexWrap = 'wrap';

        const addAst = document.createElement('button');
        addAst.type = 'button';
        addAst.className = 'pe-btn';
        addAst.textContent = '+ ASTEROID';
        addAst.addEventListener('click', () => this.addObstacleEntry('asteroid'));
        addRow.appendChild(addAst);

        const addShield = document.createElement('button');
        addShield.type = 'button';
        addShield.className = 'pe-btn';
        addShield.textContent = '+ SHIELD';
        addShield.addEventListener('click', () => this.addObstacleEntry('shield'));
        addRow.appendChild(addShield);

        const addCrystal = document.createElement('button');
        addCrystal.type = 'button';
        addCrystal.className = 'pe-btn';
        addCrystal.textContent = '+ CRYSTAL';
        addCrystal.addEventListener('click', () => this.addObstacleEntry('crystal'));
        addRow.appendChild(addCrystal);

        const addFog = document.createElement('button');
        addFog.type = 'button';
        addFog.className = 'pe-btn';
        addFog.textContent = '+ FOG / CLOUD';
        addFog.addEventListener('click', () => this.addObstacleEntry('fog'));
        addRow.appendChild(addFog);

        root.appendChild(addRow);
    },
});
