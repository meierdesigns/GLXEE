"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    nextEnemyId(prefix) {
        this._enemyIdCounter += 1;
        return (prefix || 'e') + this._enemyIdCounter;
    },

    nextObstacleId(prefix) {
        this._obstacleIdCounter += 1;
        return (prefix || 'o') + this._obstacleIdCounter;
    },

    addCluster(name) {
        const raw = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
        if (!raw) return null;
        if (this.availableClusters.indexOf(raw) === -1) {
            this.availableClusters.push(raw);
            this.saveCustomClusters();
        }
        return raw;
    },

    saveCustomClusters() {
        try {
            const builtins = ['alpha', 'bravo', 'charlie', 'swarm', 'vanguard', 'rear', 'nebula', 'clouds'];
            const custom = this.availableClusters.filter((c) => builtins.indexOf(c) === -1);
            localStorage.setItem(this.clusterStorageKey, JSON.stringify(custom));
        } catch (e) {
            console.warn('PlanetConfigManager: saveCustomClusters failed', e);
        }
    },

    loadCustomClusters() {
        try {
            const raw = localStorage.getItem(this.clusterStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            parsed.forEach((c) => {
                const id = String(c || '').trim().toLowerCase();
                if (id && this.availableClusters.indexOf(id) === -1) {
                    this.availableClusters.push(id);
                }
            });
        } catch (e) {
            console.warn('PlanetConfigManager: loadCustomClusters failed', e);
        }
    },

    defaultsFromLegacyObstacleType(typeId) {
        const t = String(typeId || 'small_asteroid');
        const isShield = t.includes('shield');
        const isFog = t === 'fog' || t.includes('cloud') || t.includes('nebula');
        const isCrystal = t.includes('crystal');
        const fragmented = t.startsWith('fragmented_');
        let width = 10;
        let height = 10;
        let health = 2;
        if (t.startsWith('small_')) {
            width = 7;
            height = 7;
            health = 1;
        } else if (t.startsWith('large_')) {
            width = 14;
            height = 14;
            health = isShield ? 1 : 3;
        } else if (fragmented) {
            width = 9;
            height = 11;
            health = isShield ? 1 : 2;
        } else if (isFog) {
            width = 28;
            height = 20;
            health = 1;
        } else if (isCrystal) {
            width = 9;
            height = 11;
            health = 3;
        }
        if (isShield) health = 1;
        let kind = 'asteroid';
        if (isFog) kind = 'fog';
        else if (isShield) kind = 'shield';
        else if (isCrystal) kind = 'crystal';
        let sprite = 'obstacle';
        if (kind === 'fog') sprite = 'fog';
        else if (kind === 'shield') sprite = 'shield';
        else if (kind === 'crystal') sprite = 'crystal';
        else if (t.startsWith('small_')) sprite = 'obstacleSmall';
        else if (t.startsWith('large_')) sprite = 'obstacleLarge';
        else if (fragmented) sprite = 'obstacleMedium';
        let explosionId = 'asteroid_burst';
        if (kind === 'shield') explosionId = 'small_pop';
        else if (kind === 'crystal') explosionId = 'crystal_shatter';
        else if (kind === 'fog') explosionId = 'small_pop';
        return {
            kind,
            width,
            height,
            health,
            destructible: kind === 'asteroid' || kind === 'crystal',
            reflectsShots: kind === 'shield',
            fragmentOnDestroy: fragmented || (kind === 'asteroid' && t.includes('fragmented')) || kind === 'crystal',
            fragmentCount: fragmented ? 3 : (kind === 'crystal' ? 4 : 0),
            fragmentDepth: kind === 'crystal' ? 1 : 0,
            fragmentSizeRatio: 0.45,
            fragmentDamage: kind === 'crystal' ? 10 : 8,
            fragmentHealth: 1,
            childFragmentChance: kind === 'crystal' ? 0.45 : 0,
            collisionDamage: kind === 'crystal' ? 18 : 15,
            opticalMode: kind === 'crystal' ? 'prism' : 'none',
            prismSplitCount: 3,
            prismAngleDeg: 25,
            explosionId,
            sprite,
            opacity: kind === 'fog' ? 0.4 : 1,
            direction: 'ltr',
            speed: 0.8,
            weight: 1
        };
    },

    normalizeObstacleEntry(entry, index) {
        const e = entry || {};
        let base = {};
        if (e.type && !e.kind) {
            base = this.defaultsFromLegacyObstacleType(e.type);
        } else if (typeof e === 'string') {
            base = this.defaultsFromLegacyObstacleType(e);
        }
        const kindRaw = e.kind || base.kind || 'asteroid';
        const kind = this.availableObstacleKinds.indexOf(kindRaw) !== -1 ? kindRaw : 'asteroid';
        const cluster = this.ensureCatalogValue(
            this.availableClusters,
            e.cluster != null ? String(e.cluster).trim() : 'alpha',
            'alpha'
        );
        const dirRaw = e.direction || base.direction || 'ltr';
        const direction = this.availableObstacleDirections.indexOf(dirRaw) !== -1 ? dirRaw : 'ltr';
        const spriteRaw = e.sprite || base.sprite || (kind === 'fog' ? 'fog' : kind === 'shield' ? 'shield' : kind === 'crystal' ? 'crystal' : 'obstacle');
        const sprite = this.availableObstacleSprites.indexOf(spriteRaw) !== -1
            ? spriteRaw
            : (kind === 'fog' ? 'fog' : kind === 'shield' ? 'shield' : kind === 'crystal' ? 'crystal' : 'obstacle');

        const maxObs = kind === 'fog' ? 64 : 20;
        const width = Math.max(4, Math.min(maxObs, Math.round(e.width != null ? Number(e.width) : (base.width || 10))));
        const height = Math.max(4, Math.min(maxObs, Math.round(e.height != null ? Number(e.height) : (base.height || 10))));
        const isFog = kind === 'fog';
        const destructible = e.destructible != null ? !!e.destructible : (base.destructible != null ? !!base.destructible : (kind === 'asteroid' || kind === 'crystal'));
        const reflectsShots = e.reflectsShots != null ? !!e.reflectsShots : (base.reflectsShots != null ? !!base.reflectsShots : kind === 'shield');
        const health = Math.max(1, Math.round(e.health != null ? Number(e.health) : (base.health || 1)));
        const fragmentOnDestroy = e.fragmentOnDestroy != null
            ? !!e.fragmentOnDestroy
            : !!(base.fragmentOnDestroy);
        const fragmentCount = Math.max(0, Math.min(12, Math.round(
            e.fragmentCount != null ? Number(e.fragmentCount) : (base.fragmentCount || (fragmentOnDestroy ? 3 : 0))
        )));
        const fragmentDepth = Math.max(0, Math.min(3, Math.round(
            e.fragmentDepth != null ? Number(e.fragmentDepth) : (base.fragmentDepth || 0)
        )));
        const fragmentSizeRatio = Math.max(0.2, Math.min(0.8, Number(
            e.fragmentSizeRatio != null ? e.fragmentSizeRatio : (base.fragmentSizeRatio != null ? base.fragmentSizeRatio : 0.45)
        )));
        const collisionDamage = Math.max(1, Math.round(
            e.collisionDamage != null ? Number(e.collisionDamage) : (base.collisionDamage != null ? base.collisionDamage : 15)
        ));
        const fragmentDamage = Math.max(1, Math.round(
            e.fragmentDamage != null ? Number(e.fragmentDamage) : (base.fragmentDamage != null ? base.fragmentDamage : Math.max(1, Math.round(collisionDamage * fragmentSizeRatio)))
        ));
        const fragmentHealth = Math.max(1, Math.round(
            e.fragmentHealth != null ? Number(e.fragmentHealth) : (base.fragmentHealth != null ? base.fragmentHealth : 1)
        ));
        const childFragmentChance = Math.max(0, Math.min(1, Number(
            e.childFragmentChance != null ? e.childFragmentChance : (base.childFragmentChance != null ? base.childFragmentChance : 0)
        )));
        const opticalRaw = e.opticalMode != null ? e.opticalMode : (base.opticalMode || (kind === 'crystal' ? 'prism' : 'none'));
        const opticalMode = isFog
            ? 'none'
            : ((this.availableOpticalModes || []).indexOf(opticalRaw) !== -1 ? opticalRaw : 'none');
        const prismSplitCount = Math.max(2, Math.min(4, Math.round(
            e.prismSplitCount != null ? Number(e.prismSplitCount) : (base.prismSplitCount != null ? base.prismSplitCount : 3)
        )));
        const prismAngleDeg = Math.max(5, Math.min(60, Number(
            e.prismAngleDeg != null ? e.prismAngleDeg : (base.prismAngleDeg != null ? base.prismAngleDeg : 25)
        )));
        let explosionId = e.explosionId || base.explosionId || 'asteroid_burst';
        if (kind === 'crystal' && !e.explosionId && !base.explosionId) explosionId = 'crystal_shatter';
        if (kind === 'shield' && !e.explosionId && !base.explosionId) explosionId = 'small_pop';
        const opacity = Math.max(0.05, Math.min(1, Number(
            e.opacity != null ? e.opacity : (base.opacity != null ? base.opacity : (isFog ? 0.4 : 1))
        )));
        const speed = Math.max(0.1, Math.min(4, Number(e.speed != null ? e.speed : (base.speed || 0.8))));
        const weight = Math.max(1, Math.round(e.weight != null ? Number(e.weight) : (base.weight || 1)));

        // Keep legacy type string for derived allowlists / display
        let type = e.type || null;
        if (!type) {
            if (isFog) type = 'fog';
            else if (kind === 'shield') type = width <= 14 ? 'small_shield' : width >= 22 ? 'large_shield' : 'medium_shield';
            else if (kind === 'crystal') type = 'crystal';
            else if (fragmentOnDestroy) type = 'fragmented_asteroid';
            else type = width <= 14 ? 'small_asteroid' : width >= 22 ? 'large_asteroid' : 'medium_asteroid';
        }

        return {
            id: e.id || this.nextObstacleId('o'),
            kind,
            type,
            cluster,
            weight,
            direction,
            speed,
            width,
            height,
            destructible: isFog ? false : destructible,
            reflectsShots: isFog ? false : reflectsShots,
            health: isFog ? 1 : health,
            fragmentOnDestroy: isFog ? false : fragmentOnDestroy,
            fragmentCount: isFog ? 0 : fragmentCount,
            fragmentDepth: isFog ? 0 : fragmentDepth,
            fragmentSizeRatio: isFog ? 0.45 : fragmentSizeRatio,
            fragmentDamage: isFog ? 1 : fragmentDamage,
            fragmentHealth: isFog ? 1 : fragmentHealth,
            childFragmentChance: isFog ? 0 : childFragmentChance,
            collisionDamage: isFog ? 0 : collisionDamage,
            opticalMode: isFog ? 'none' : opticalMode,
            prismSplitCount: isFog ? 2 : prismSplitCount,
            prismAngleDeg: isFog ? 25 : prismAngleDeg,
            explosionId: isFog ? 'small_pop' : explosionId,
            sprite: isFog ? 'fog' : sprite,
            opacity
        };
    },

    migrateLegacyObstacles(data) {
        if (Array.isArray(data.obstacles)) {
            return data.obstacles.map((o, i) => this.normalizeObstacleEntry(o, i));
        }
        if (Array.isArray(data.obstacleTypes)) {
            if (!data.obstacleTypes.length) return [];
            return data.obstacleTypes.map((t, i) => this.normalizeObstacleEntry(
                Object.assign(
                    { cluster: i === 0 ? 'alpha' : (i === 1 ? 'bravo' : 'charlie') },
                    this.defaultsFromLegacyObstacleType(t),
                    { type: t }
                ),
                i
            ));
        }
        return [this.normalizeObstacleEntry(
            Object.assign({ cluster: 'alpha' }, this.defaultsFromLegacyObstacleType('small_asteroid'), { type: 'small_asteroid' }),
            0
        )];
    },

    deriveObstacleTypes(obstacles) {
        const set = [];
        (obstacles || []).forEach((o) => {
            const t = o && o.type ? String(o.type) : null;
            if (t && set.indexOf(t) === -1) set.push(t);
        });
        return set.length ? set : [];
    },

    taxonomyForType(type) {
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
            const base = this.typeTaxonomyDefaults[type] || { faction: 'pirate', enemyClass: 'assault' };
            return {
                faction: enemyConfigManager.getDefaultFaction(type) || base.faction,
                enemyClass: base.enemyClass
            };
        }
        return this.typeTaxonomyDefaults[type] || { faction: 'pirate', enemyClass: 'assault' };
    },
});
