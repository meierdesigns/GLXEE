"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    selectPlanetNow(planetId) {
        this.selectedPlanet = planetId;
        const gid = typeof planetConfigManager !== 'undefined'
            ? planetConfigManager.getPlanetGalaxyId(planetId)
            : null;
        if (gid) this.expandedGalaxies[gid] = true;
        this.loadDraft();
        this.renderPlanetTree();
        this.renderControls();
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.applyForPlanet(this.selectedPlanet, null);
        }
        this.persistMenuState();
    },

    addPlanetToGalaxy(galaxyId) {
        if (typeof planetConfigManager === 'undefined') return;
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid || !planetConfigManager.getGalaxy(gid)) return;
        // Blank planet: no prompt (blocked in some embeds), empty enemies/layers.
        const name = planetConfigManager.nextBlankPlanetName
            ? planetConfigManager.nextBlankPlanetName(gid)
            : 'NEW PLANET';
        const cfg = planetConfigManager.addPlanet({
            name,
            galaxyId: gid,
            blank: true,
            enemies: [],
            sideEnemies: [],
            backgroundLayers: [],
            obstacleTypes: [],
            obstacles: [],
            stages: {}
        });
        if (!cfg) return;
        this.expandedGalaxies[gid] = true;
        this.selectedPlanet = cfg.id;
        this.loadDraft();
        this.renderPlanetTree();
        this.renderControls();
        this.persistMenuState();
    },

    deletePlanetFromTree(planetId) {
        if (typeof planetConfigManager === 'undefined') return;
        const id = String(planetId || '').toLowerCase();
        if (!id) return;
        if (planetConfigManager.isBuiltinPlanet(id)) return;
        const cfg = planetConfigManager.getConfig(id);
        const label = (cfg && cfg.name) || id.toUpperCase();
        if (!window.confirm(`Delete planet "${label}"?`)) return;
        const galaxyId = planetConfigManager.getPlanetGalaxyId
            ? planetConfigManager.getPlanetGalaxyId(id)
            : (cfg && cfg.galaxyId);
        if (!planetConfigManager.deletePlanet(id)) return;

        if (this.selectedPlanet === id) {
            const tree = planetConfigManager.getGalaxyTree();
            let next = null;
            if (galaxyId) {
                const g = tree.find(t => t.id === galaxyId);
                if (g && g.planets.length) next = g.planets[0].id;
            }
            if (!next) {
                for (let i = 0; i < tree.length; i++) {
                    if (tree[i].planets && tree[i].planets.length) {
                        next = tree[i].planets[0].id;
                        break;
                    }
                }
            }
            this.selectedPlanet = next || 'mars';
            this.loadDraft();
            this.renderControls();
            if (typeof themeContextManager !== 'undefined') {
                themeContextManager.applyForPlanet(this.selectedPlanet, null);
            }
        }
        this.renderPlanetTree();
        this.persistMenuState();
    },

    renderPlanetTree() {
        const tree = document.getElementById('pePlanetTree');
        const label = document.getElementById('peSelectedLabel');
        if (!tree || typeof planetConfigManager === 'undefined') return;

        const galaxyTree = planetConfigManager.getGalaxyTree();
        const selectedCfg = planetConfigManager.getConfig(this.selectedPlanet);
        if (label) {
            const gName = (() => {
                const gid = planetConfigManager.getPlanetGalaxyId(this.selectedPlanet);
                const g = planetConfigManager.getGalaxy(gid);
                return g ? g.name : '';
            })();
            label.textContent = gName
                ? `${gName} / ${(selectedCfg && selectedCfg.name) || this.selectedPlanet.toUpperCase()}`
                : ((selectedCfg && selectedCfg.name) || this.selectedPlanet.toUpperCase());
        }

        tree.innerHTML = '';
        galaxyTree.forEach(galaxy => {
            const open = this.expandedGalaxies[galaxy.id] !== false;
            const group = document.createElement('div');
            group.className = 'pe-tree-galaxy' + (open ? ' open' : '');

            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'pe-tree-galaxy-btn';
            head.setAttribute('data-galaxy-toggle', galaxy.id);
            head.innerHTML =
                `<span class="pe-tree-caret">${open ? '▾' : '▸'}</span>` +
                `<span class="pe-tree-galaxy-name">${galaxy.name}</span>` +
                `<span class="pe-tree-count">${galaxy.planets.length}</span>`;
            group.appendChild(head);

            const list = document.createElement('div');
            list.className = 'pe-tree-planets';
            if (!open) list.hidden = true;

            if (!galaxy.planets.length) {
                const empty = document.createElement('div');
                empty.className = 'pe-tree-empty';
                empty.textContent = '— empty —';
                list.appendChild(empty);
            } else {
                galaxy.planets.forEach(planet => {
                    const row = document.createElement('div');
                    row.className = 'pe-tree-planet-row' +
                        (planet.id === this.selectedPlanet ? ' active' : '');

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'pe-tree-planet' + (planet.id === this.selectedPlanet ? ' active' : '');
                    btn.setAttribute('data-planet-id', planet.id);
                    btn.innerHTML =
                        `<span class="pe-tree-planet-name">${planet.name}</span>` +
                        (planet.difficulty
                            ? `<span class="pe-tree-planet-diff">${planet.difficulty}</span>`
                            : '');
                    row.appendChild(btn);

                    if (!planetConfigManager.isBuiltinPlanet(planet.id)) {
                        const delBtn = document.createElement('button');
                        delBtn.type = 'button';
                        delBtn.className = 'pe-tree-planet-delete';
                        delBtn.setAttribute('data-delete-planet', planet.id);
                        delBtn.title = 'Delete planet';
                        delBtn.textContent = '✕';
                        row.appendChild(delBtn);
                    }

                    list.appendChild(row);
                });
            }

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'pe-tree-add-planet';
            addBtn.setAttribute('data-add-planet', galaxy.id);
            addBtn.textContent = '+ PLANET';
            list.appendChild(addBtn);

            group.appendChild(list);
            tree.appendChild(group);
        });
    },

    renderTabs() {
        document.querySelectorAll('#peTabs .pe-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === this.activeTab);
        });
    },

    renderControls() {
        const root = document.getElementById('peControls');
        if (!root || !this.draft) return;
        root.innerHTML = '';

        if (this.activeTab === 'background') this.renderBackgroundTab(root);
        else if (this.activeTab === 'level') this.renderLevelTab(root);
        else if (this.activeTab === 'obstacles') this.renderObstaclesTab(root);
        else if (this.activeTab === 'enemies') this.renderEnemiesTab(root);
        else if (this.activeTab === 'objectives') this.renderObjectivesTab(root);
        else if (this.activeTab === 'graphics') this.renderGraphicsTab(root);
    },
});
