"use strict";

// PlanetEditorUI methods, split from planet-editor.js.
extendClass(PlanetEditorUI, {
    /** One obstacle entry editor card (renderObstaclesTab). */
    renderObstacleCard(root, entry, index, options) {
        const { pcm, clusters, kinds, directions, sprites } = options;
        const list = this.draft.obstacles;
        const card = document.createElement('div');
        card.className = 'pe-layer-card';

        const idLabel = document.createElement('div');
        idLabel.className = 'pe-hint';
        idLabel.textContent = 'id: ' + (entry.id || ('o' + (index + 1)));
        card.appendChild(idLabel);

        card.appendChild(this.makeSelect('Kind', entry.kind || 'asteroid', kinds, (v) => {
            entry.kind = v;
            if (v === 'fog') {
                entry.sprite = 'fog';
                entry.destructible = false;
                entry.reflectsShots = false;
                entry.fragmentOnDestroy = false;
                entry.opticalMode = 'none';
                entry.opacity = entry.opacity < 1 ? entry.opacity : 0.4;
                if (entry.width < 30) { entry.width = 48; entry.height = 36; }
            } else if (v === 'shield') {
                entry.sprite = 'shield';
                entry.reflectsShots = true;
                entry.destructible = false;
                entry.opticalMode = 'none';
                entry.opacity = 1;
                entry.explosionId = entry.explosionId || 'small_pop';
            } else if (v === 'crystal') {
                entry.sprite = 'crystal';
                entry.reflectsShots = false;
                entry.destructible = true;
                entry.opticalMode = entry.opticalMode && entry.opticalMode !== 'none' ? entry.opticalMode : 'prism';
                entry.fragmentOnDestroy = true;
                if (!entry.fragmentCount) entry.fragmentCount = 4;
                if (entry.fragmentDepth == null) entry.fragmentDepth = 1;
                if (entry.childFragmentChance == null) entry.childFragmentChance = 0.45;
                entry.explosionId = 'crystal_shatter';
                entry.opacity = 1;
            } else {
                entry.sprite = entry.sprite === 'fog' || entry.sprite === 'shield' || entry.sprite === 'crystal' ? 'obstacle' : entry.sprite;
                entry.destructible = true;
                entry.reflectsShots = false;
                entry.opticalMode = 'none';
                entry.opacity = 1;
                entry.explosionId = entry.explosionId || 'asteroid_burst';
            }
            this.syncObstacleTypesFromDraft();
            this.previewObstacles = [];
            this.renderControls();
        }));

        const clusterOpts = clusters.indexOf(entry.cluster) === -1 && entry.cluster
            ? clusters.concat([entry.cluster])
            : clusters;
        card.appendChild(this.makeSelect('Cluster', entry.cluster || clusterOpts[0], clusterOpts, (v) => {
            entry.cluster = v;
            this.renderControls();
        }));

        card.appendChild(this.makeSelect('Direction', entry.direction || 'ltr', directions, (v) => {
            entry.direction = v;
        }));

        card.appendChild(this.makeSlider('Speed', entry.speed != null ? entry.speed : 0.8, 0.1, 3, 0.05, (v) => {
            entry.speed = Math.round(v * 100) / 100;
        }));

        card.appendChild(this.makeSlider('Width', entry.width != null ? entry.width : 18, 6, 200, 1, (v) => {
            entry.width = Math.round(v);
        }, true));

        card.appendChild(this.makeSlider('Height', entry.height != null ? entry.height : 18, 6, 200, 1, (v) => {
            entry.height = Math.round(v);
        }, true));

        card.appendChild(this.makeSlider('Weight', entry.weight != null ? entry.weight : 1, 1, 10, 1, (v) => {
            entry.weight = Math.round(v);
        }, true));

        if (entry.kind !== 'fog') {
            card.appendChild(this.makeCheckbox('Destructible', !!entry.destructible, (checked) => {
                entry.destructible = checked;
            }));
            card.appendChild(this.makeCheckbox('Reflects shots', !!entry.reflectsShots, (checked) => {
                entry.reflectsShots = checked;
            }));
            card.appendChild(this.makeSlider('Health', entry.health != null ? entry.health : 1, 1, 10, 1, (v) => {
                entry.health = Math.round(v);
            }, true));
            card.appendChild(this.makeCheckbox('Fragment on destroy', !!entry.fragmentOnDestroy, (checked) => {
                entry.fragmentOnDestroy = checked;
                if (checked && !entry.fragmentCount) entry.fragmentCount = 3;
                this.renderControls();
            }));
            if (entry.fragmentOnDestroy) {
                card.appendChild(this.makeSlider('Fragment count', entry.fragmentCount != null ? entry.fragmentCount : 3, 1, 12, 1, (v) => {
                    entry.fragmentCount = Math.round(v);
                }, true));
                card.appendChild(this.makeSlider('Fragment depth', entry.fragmentDepth != null ? entry.fragmentDepth : 0, 0, 3, 1, (v) => {
                    entry.fragmentDepth = Math.round(v);
                }, true));
                card.appendChild(this.makeSlider('Size ratio', entry.fragmentSizeRatio != null ? entry.fragmentSizeRatio : 0.45, 0.2, 0.8, 0.05, (v) => {
                    entry.fragmentSizeRatio = Math.round(v * 100) / 100;
                }));
                card.appendChild(this.makeSlider('Fragment dmg', entry.fragmentDamage != null ? entry.fragmentDamage : 8, 1, 40, 1, (v) => {
                    entry.fragmentDamage = Math.round(v);
                }, true));
                card.appendChild(this.makeSlider('Fragment HP', entry.fragmentHealth != null ? entry.fragmentHealth : 1, 1, 5, 1, (v) => {
                    entry.fragmentHealth = Math.round(v);
                }, true));
                card.appendChild(this.makeSlider('Child chance', entry.childFragmentChance != null ? entry.childFragmentChance : 0, 0, 1, 0.05, (v) => {
                    entry.childFragmentChance = Math.round(v * 100) / 100;
                }));
            }
            card.appendChild(this.makeSlider('Collision dmg', entry.collisionDamage != null ? entry.collisionDamage : 15, 1, 50, 1, (v) => {
                entry.collisionDamage = Math.round(v);
            }, true));
            const opticalModes = pcm.availableOpticalModes || ['none', 'mirror', 'prism', 'kaleidoscope'];
            card.appendChild(this.makeSelect('Optical', entry.opticalMode || 'none', opticalModes, (v) => {
                entry.opticalMode = v;
                if (v !== 'none' && entry.kind !== 'crystal') {
                    // keep kind; optical can apply to any solid
                }
                this.renderControls();
            }));
            if (entry.opticalMode === 'prism' || entry.opticalMode === 'kaleidoscope') {
                card.appendChild(this.makeSlider('Prism splits', entry.prismSplitCount != null ? entry.prismSplitCount : 3, 2, 4, 1, (v) => {
                    entry.prismSplitCount = Math.round(v);
                }, true));
                card.appendChild(this.makeSlider('Prism angle', entry.prismAngleDeg != null ? entry.prismAngleDeg : 25, 5, 60, 1, (v) => {
                    entry.prismAngleDeg = Math.round(v);
                }, true));
            }
            const explosionIds = (typeof explosionConfigManager !== 'undefined')
                ? explosionConfigManager.getIds()
                : ['default', 'asteroid_burst', 'crystal_shatter', 'small_pop', 'plasma_bloom'];
            card.appendChild(this.makeSelect('Explosion', entry.explosionId || 'asteroid_burst', explosionIds, (v) => {
                entry.explosionId = v;
            }));
        }

        const spriteOpts = entry.kind === 'fog' ? ['fog'] : sprites.filter((s) => s !== 'fog' || entry.kind === 'fog');
        card.appendChild(this.makeSelect('Sprite', entry.sprite || spriteOpts[0], spriteOpts, (v) => {
            entry.sprite = v;
        }));

        card.appendChild(this.makeSlider('Opacity', entry.opacity != null ? entry.opacity : 1, 0.1, 1, 0.05, (v) => {
            entry.opacity = Math.round(v * 100) / 100;
        }));

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'pe-btn';
        del.textContent = 'REMOVE';
        del.addEventListener('click', () => {
            list.splice(index, 1);
            this.syncObstacleTypesFromDraft();
            this.previewObstacles = [];
            this.renderControls();
        });
        card.appendChild(del);
        root.appendChild(card);
    },

    addObstacleEntry(kind) {
        if (!Array.isArray(this.draft.obstacles)) this.draft.obstacles = [];
        const pcm = planetConfigManager;
        const cluster = this.obstacleFilterCluster !== '(all)'
            ? this.obstacleFilterCluster
            : ((pcm.availableClusters && pcm.availableClusters[0]) || 'alpha');
        let seed = { kind: kind || 'asteroid', cluster };
        if (kind === 'fog') {
            seed = Object.assign(seed, {
                width: 48, height: 36, sprite: 'fog', opacity: 0.4,
                destructible: false, reflectsShots: false, fragmentOnDestroy: false,
                direction: 'ltr', speed: 0.5, type: 'fog'
            });
        } else if (kind === 'shield') {
            seed = Object.assign(seed, {
                width: 18, height: 18, sprite: 'shield', opacity: 1,
                destructible: false, reflectsShots: true, health: 1, type: 'medium_shield',
                explosionId: 'small_pop', opticalMode: 'none'
            });
        } else if (kind === 'crystal') {
            seed = Object.assign(seed, {
                width: 16, height: 20, sprite: 'crystal', opacity: 1,
                destructible: true, reflectsShots: false, health: 3,
                fragmentOnDestroy: true, fragmentCount: 4, fragmentDepth: 1,
                childFragmentChance: 0.45, fragmentDamage: 10, collisionDamage: 18,
                opticalMode: 'prism', prismSplitCount: 3, prismAngleDeg: 25,
                explosionId: 'crystal_shatter', type: 'crystal'
            });
        } else {
            seed = Object.assign(seed, {
                width: 18, height: 18, sprite: 'obstacle', opacity: 1,
                destructible: true, reflectsShots: false, health: 2,
                fragmentOnDestroy: false, type: 'medium_asteroid',
                explosionId: 'asteroid_burst', opticalMode: 'none'
            });
        }
        const entry = pcm.normalizeObstacleEntry
            ? pcm.normalizeObstacleEntry(seed, this.draft.obstacles.length)
            : seed;
        this.draft.obstacles.push(entry);
        this.syncObstacleTypesFromDraft();
        this.previewObstacles = [];
        this.renderControls();
    },

    syncObstacleTypesFromDraft() {
        if (!this.draft) return;
        const types = [];
        (this.draft.obstacles || []).forEach((o) => {
            if (o && o.type && types.indexOf(o.type) === -1) types.push(o.type);
        });
        this.draft.obstacleTypes = types;
    },

    getEditorEnemyList() {
        if (this.objectiveScope === 'stage') {
            if (!this.draft.stages) this.draft.stages = {};
            if (!this.draft.stages[this.objectiveStageKey]) {
                this.draft.stages[this.objectiveStageKey] = {};
            }
            const stage = this.draft.stages[this.objectiveStageKey];
            if (!Array.isArray(stage.enemies)) {
                stage.enemies = JSON.parse(JSON.stringify(this.draft.enemies || []));
            }
            return stage.enemies;
        }
        if (!Array.isArray(this.draft.enemies)) this.draft.enemies = [];
        return this.draft.enemies;
    },

    getEditorObjective() {
        if (this.objectiveScope === 'stage') {
            if (!this.draft.stages) this.draft.stages = {};
            if (!this.draft.stages[this.objectiveStageKey]) {
                this.draft.stages[this.objectiveStageKey] = {};
            }
            const stage = this.draft.stages[this.objectiveStageKey];
            if (!stage.objective) {
                stage.objective = Object.assign({}, this.draft.objective || { type: 'hunt' });
            }
            return stage.objective;
        }
        if (!this.draft.objective) this.draft.objective = { type: 'hunt' };
        return this.draft.objective;
    },
});
