"use strict";

// Obstacle management
class ObstacleManager {
    constructor() {
        this.obstacles = [];
        this.lightingBullets = []; // Track bullets for lighting effects
        this.allowedTypes = null; // null = all types; set per planet (legacy)
        this.obstacleDefs = []; // ObstacleEntry[] from planet config
    }

    setAllowedTypes(types) {
        if (!types || !types.length) {
            this.allowedTypes = null;
            return;
        }
        this.allowedTypes = types.slice();
    }

    getAllowedTypes() {
        return this.allowedTypes;
    }

    setObstacleDefs(defs) {
        this.obstacleDefs = Array.isArray(defs) ? defs.slice() : [];
        // Derive legacy allowlist for formation fallbacks
        const types = [];
        this.obstacleDefs.forEach((d) => {
            if (d && d.type && types.indexOf(d.type) === -1) types.push(d.type);
        });
        this.allowedTypes = types.length ? types : null;
    }

    getObstacleDefs() {
        return this.obstacleDefs;
    }

    hasDefs() {
        return this.obstacleDefs && this.obstacleDefs.length > 0;
    }

    pickWeightedDef(list) {
        const pool = list && list.length ? list : this.obstacleDefs;
        if (!pool || !pool.length) return null;
        let total = 0;
        pool.forEach((d) => { total += Math.max(1, d.weight || 1); });
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
            r -= Math.max(1, pool[i].weight || 1);
            if (r <= 0) return pool[i];
        }
        return pool[pool.length - 1];
    }

    directionToSpeed(direction, speed) {
        const s = Math.max(0.1, Number(speed) || 0.8);
        switch (direction) {
            case 'rtl':
                return { horizontalSpeed: -s, verticalSpeed: -s * 0.12 };
            case 'ttb':
                return { horizontalSpeed: s * 0.15, verticalSpeed: s };
            case 'btt':
                return { horizontalSpeed: s * 0.15, verticalSpeed: -s };
            case 'diag_dr':
                return { horizontalSpeed: s * 0.85, verticalSpeed: s * 0.55 };
            case 'diag_ur':
                return { horizontalSpeed: s * 0.85, verticalSpeed: -s * 0.55 };
            case 'ltr':
            default:
                // Shallow drift so side-crossing obstacles stay in the mid lane.
                return { horizontalSpeed: s, verticalSpeed: s * 0.12 };
        }
    }

    /**
     * Mid lane between the enemy zone (top third) and the player zone
     * (bottom): obstacles mostly cross here so neither ship's flight band is
     * cluttered. A small share still spawns anywhere to keep it unpredictable.
     */
    midLane(canvasHeight) {
        const H = canvasHeight || 300;
        return { top: H * 0.36, bottom: H * 0.66 };
    }

    pickLaneY(canvasHeight, h, strayChance) {
        const H = canvasHeight || 300;
        const size = h || 10;
        if (Math.random() < (strayChance != null ? strayChance : 0.15)) {
            return Math.random() * Math.max(1, H - size);
        }
        const lane = this.midLane(H);
        return lane.top + Math.random() * Math.max(1, lane.bottom - lane.top - size);
    }

    spawnOriginForDirection(direction, width, height, gameState) {
        const canvasWidth = (gameState && gameState.width) ? gameState.width : 240;
        const canvasHeight = (gameState && gameState.height) ? gameState.height : 300;
        const w = width || 18;
        const h = height || 18;
        switch (direction) {
            case 'rtl':
                return { x: canvasWidth + 2, y: this.pickLaneY(canvasHeight, h) };
            case 'ttb':
                return { x: Math.random() * Math.max(1, canvasWidth - w), y: -h - 2 };
            case 'btt':
                return { x: Math.random() * Math.max(1, canvasWidth - w), y: canvasHeight + 2 };
            case 'diag_ur':
                return { x: -w - 2, y: canvasHeight * (0.4 + Math.random() * 0.5) };
            case 'diag_dr':
            case 'ltr':
            default:
                return { x: -w - 2, y: this.pickLaneY(canvasHeight, h) };
        }
    }

    createObstacleFromDef(def, overrides) {
        const d = def || {};
        const ov = overrides || {};
        const direction = d.direction || 'ltr';
        const speeds = this.directionToSpeed(direction, d.speed != null ? d.speed : 0.8);
        const contentScale = (typeof game !== 'undefined' && game && game.contentScale != null)
            ? Math.max(0.5, Math.min(1.35, Number(game.contentScale) || 1))
            : 1;
        const baseW = ov.width != null ? ov.width : (d.width || 10);
        const baseH = ov.height != null ? ov.height : (d.height || 10);
        const width = Math.max(4, Math.min(32, Math.round(baseW * contentScale)));
        const height = Math.max(4, Math.min(32, Math.round(baseH * contentScale)));
        const isFog = d.kind === 'fog';
        const kind = d.kind || 'asteroid';
        const opticalMode = isFog ? 'none' : (d.opticalMode || (kind === 'crystal' ? 'prism' : 'none'));
        const collisionDamage = isFog ? 0 : Math.max(1, d.collisionDamage != null ? d.collisionDamage : 15);
        return {
            x: ov.x != null ? ov.x : 0,
            y: ov.y != null ? ov.y : 0,
            width,
            height,
            horizontalSpeed: ov.horizontalSpeed != null ? ov.horizontalSpeed : speeds.horizontalSpeed,
            verticalSpeed: ov.verticalSpeed != null ? ov.verticalSpeed : speeds.verticalSpeed,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * (isFog ? 0.02 : (kind === 'crystal' ? 0.15 : 0.1)),
            type: d.type || d.kind || 'asteroid',
            kind: kind,
            cluster: d.cluster || 'alpha',
            defId: d.id || null,
            color: isFog ? 'var(--current-accent)' : (kind === 'crystal' ? 'var(--color-highlight)' : this.getObstacleColor(d.type || 'medium_asteroid')),
            health: isFog ? 1 : Math.max(1, d.health || 1),
            maxHealth: isFog ? 1 : Math.max(1, d.health || 1),
            isDestructible: isFog ? false : (d.destructible !== false && d.kind !== 'fog'),
            reflectsShots: isFog ? false : !!d.reflectsShots,
            isFog: isFog,
            fragmentOnDestroy: !isFog && !!d.fragmentOnDestroy,
            fragmentCount: !isFog ? Math.max(0, d.fragmentCount || 0) : 0,
            fragmentDepth: !isFog ? Math.max(0, Math.min(3, d.fragmentDepth || 0)) : 0,
            fragmentSizeRatio: d.fragmentSizeRatio != null ? d.fragmentSizeRatio : 0.45,
            fragmentDamage: !isFog ? Math.max(1, d.fragmentDamage != null ? d.fragmentDamage : Math.round(collisionDamage * 0.45)) : 1,
            fragmentHealth: !isFog ? Math.max(1, d.fragmentHealth || 1) : 1,
            childFragmentChance: !isFog ? Math.max(0, Math.min(1, d.childFragmentChance != null ? d.childFragmentChance : 0)) : 0,
            collisionDamage: collisionDamage,
            opticalMode: opticalMode,
            prismSplitCount: Math.max(2, Math.min(4, d.prismSplitCount || 3)),
            prismAngleDeg: d.prismAngleDeg != null ? d.prismAngleDeg : 25,
            explosionId: d.explosionId || (kind === 'crystal' ? 'crystal_shatter' : kind === 'shield' ? 'small_pop' : 'asteroid_burst'),
            fragmentGeneration: ov.fragmentGeneration != null ? ov.fragmentGeneration : 0,
            sprite: d.sprite || (isFog ? 'fog' : kind === 'shield' ? 'shield' : kind === 'crystal' ? 'crystal' : 'obstacle'),
            opacity: d.opacity != null ? d.opacity : (isFog ? 0.4 : 1),
            lightIntensity: kind === 'crystal' ? 0.4 : 0,
            lightColor: kind === 'crystal' ? 'var(--color-highlight)' : null
        };
    }

    update(deltaTime, gameState) {
        // Use gameState instead of game object
        if (!gameState) {
            console.warn('ObstacleManager.update: gameState is undefined');
            return;
        }
        if (!gameState.obstacleSpawnTimer) gameState.obstacleSpawnTimer = 0;
        if (!gameState.obstacleSpawnInterval) gameState.obstacleSpawnInterval = 3000;

        gameState.obstacleSpawnTimer += deltaTime;
        this.runTime = (this.runTime || 0) + deltaTime;

        // Update lighting bullets from bullet manager
        this.updateLightingBullets();

        // Spawn new obstacles more frequently
        if (gameState.obstacleSpawnTimer >= gameState.obstacleSpawnInterval) {
            if (this.hasDefs()) {
                // Mostly shaped pattern waves; the authored cluster waves stay
                // in the mix so planet-specific groupings still show up.
                if (Math.random() < 0.8) {
                    this.spawnPatternWave(gameState);
                } else {
                    this.spawnClusterWave(gameState);
                }
            } else if (Math.random() < 0.7) {
                this.spawnObstacleGroup(gameState);
            } else {
                this.spawnObstacle(gameState);
            }
            // Jitter the next wave so the rhythm isn't a metronome; the
            // pause shortens as the run's intensity ramps up.
            const pace = 1.1 - this.patternIntensity() * 0.35;
            gameState.obstacleSpawnTimer = -gameState.obstacleSpawnInterval * (pace * (0.8 + Math.random() * 0.5) - 1);
        }

        // Update existing obstacles
        const canvasWidth = gameState.width || 240;
        const canvasHeight = gameState.height || 300;
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];

            obstacle.x += obstacle.horizontalSpeed;
            obstacle.y += obstacle.verticalSpeed;
            obstacle.rotation += obstacle.rotationSpeed;

            this.calculateObstacleLighting(obstacle);

            const margin = Math.max(obstacle.width, obstacle.height) + 8;
            // Pattern rocks start queued outside the field; only cull them
            // once they've been inside (or if they never arrive).
            if (obstacle.entering) {
                obstacle.age = (obstacle.age || 0) + deltaTime;
                const inside = obstacle.x + obstacle.width > 0 && obstacle.x < canvasWidth
                    && obstacle.y + obstacle.height > 0 && obstacle.y < canvasHeight;
                if (inside) {
                    obstacle.entering = false;
                } else {
                    if (obstacle.age > 20000) this.obstacles.splice(i, 1);
                    continue;
                }
            }
            if (
                obstacle.x > canvasWidth + margin ||
                obstacle.y > canvasHeight + margin ||
                obstacle.x < -margin ||
                obstacle.y < -margin
            ) {
                this.obstacles.splice(i, 1);
            }
        }
    }

    spawnFromDef(def, gameState = null, offsetX, offsetY) {
        if (!def) return null;
        const direction = def.direction || 'ltr';
        const origin = this.spawnOriginForDirection(direction, def.width, def.height, gameState);
        const obstacle = this.createObstacleFromDef(def, {
            x: origin.x + (offsetX || 0),
            y: origin.y + (offsetY || 0)
        });
        this.obstacles.push(obstacle);
        return obstacle;
    }

    spawnClusterWave(gameState = null) {
        if (!this.hasDefs()) return;
        const clusters = {};
        this.obstacleDefs.forEach((d) => {
            const c = d.cluster || 'alpha';
            if (!clusters[c]) clusters[c] = [];
            clusters[c].push(d);
        });
        const keys = Object.keys(clusters);
        if (!keys.length) return;
        const clusterId = keys[Math.floor(Math.random() * keys.length)];
        const members = clusters[clusterId];
        // Shared direction from first member (or random member)
        const lead = members[Math.floor(Math.random() * members.length)];
        const direction = lead.direction || 'ltr';
        const speeds = this.directionToSpeed(direction, lead.speed != null ? lead.speed : 0.8);
        const baseOrigin = this.spawnOriginForDirection(direction, lead.width, lead.height, gameState);

        members.forEach((def, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const ox = col * ((def.width || 18) * 0.95);
            const oy = row * ((def.height || 18) * 0.95);
            const obs = this.createObstacleFromDef(def, {
                x: baseOrigin.x + (direction === 'rtl' ? -ox : ox),
                y: baseOrigin.y + oy,
                horizontalSpeed: speeds.horizontalSpeed,
                verticalSpeed: speeds.verticalSpeed
            });
            this.obstacles.push(obs);
        });
    }
}
