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
                return { horizontalSpeed: -s, verticalSpeed: -s * 0.3 };
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
                return { horizontalSpeed: s, verticalSpeed: s * 0.3 };
        }
    }

    spawnOriginForDirection(direction, width, height, gameState) {
        const canvasWidth = (gameState && gameState.width) ? gameState.width : 240;
        const canvasHeight = (gameState && gameState.height) ? gameState.height : 300;
        const w = width || 18;
        const h = height || 18;
        switch (direction) {
            case 'rtl':
                return { x: canvasWidth + 2, y: Math.random() * Math.max(1, canvasHeight - h) };
            case 'ttb':
                return { x: Math.random() * Math.max(1, canvasWidth - w), y: -h - 2 };
            case 'btt':
                return { x: Math.random() * Math.max(1, canvasWidth - w), y: canvasHeight + 2 };
            case 'diag_ur':
                return { x: -w - 2, y: canvasHeight * (0.4 + Math.random() * 0.5) };
            case 'diag_dr':
            case 'ltr':
            default:
                return { x: -w - 2, y: Math.random() * Math.max(1, canvasHeight - h) };
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
        const width = Math.max(4, Math.min(20, Math.round(baseW * contentScale)));
        const height = Math.max(4, Math.min(20, Math.round(baseH * contentScale)));
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
        
        // Update lighting bullets from bullet manager
        this.updateLightingBullets();
        
        // Spawn new obstacles more frequently
        if (gameState.obstacleSpawnTimer >= gameState.obstacleSpawnInterval) {
            if (this.hasDefs()) {
                // Prefer cluster wave; sometimes a single weighted pick
                if (Math.random() < 0.65) {
                    this.spawnClusterWave(gameState);
                } else {
                    this.spawnFromDef(this.pickWeightedDef(), gameState);
                }
            } else if (Math.random() < 0.7) {
                this.spawnObstacleGroup(gameState);
            } else {
                this.spawnObstacle(gameState);
            }
            gameState.obstacleSpawnTimer = 0;
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

    spawnObstacle(gameState = null) {
        if (this.hasDefs()) {
            this.spawnFromDef(this.pickWeightedDef(), gameState);
            return;
        }
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        // Get canvas dimensions
        const canvasHeight = (gameState && gameState.height) ? gameState.height : 300;
        
        // Horizontal speed: left to right movement
        const horizontalSpeed = 0.5 + Math.random() * 1.0; // 0.5-1.5 pixels per frame
        // Vertical speed: 30% of horizontal speed
        const verticalSpeed = horizontalSpeed * 0.3;
        
        const obstacle = {
            x: -size.width, // Start from left side of screen
            y: Math.random() * canvasHeight, // Random vertical position
            width: size.width,
            height: size.height,
            // Movement properties
            horizontalSpeed: horizontalSpeed, // Left to right movement
            verticalSpeed: verticalSpeed, // 30% of horizontal speed
            // Rotation properties
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.1, // -0.05 to 0.05 radians per frame
            // Obstacle properties
            type: obstacleType,
            kind: obstacleType.includes('shield') ? 'shield' : 'asteroid',
            color: this.getObstacleColor(obstacleType),
            health: this.getObstacleHealth(obstacleType),
            maxHealth: this.getObstacleHealth(obstacleType),
            isDestructible: this.isObstacleDestructible(obstacleType),
            reflectsShots: this.doesObstacleReflect(obstacleType),
            isFog: false,
            fragmentOnDestroy: obstacleType.startsWith('fragmented_'),
            fragmentCount: obstacleType.startsWith('fragmented_') ? 3 : 0,
            fragmentDepth: 0,
            fragmentSizeRatio: 0.45,
            fragmentDamage: 8,
            fragmentHealth: 1,
            childFragmentChance: 0,
            collisionDamage: 15,
            opticalMode: 'none',
            prismSplitCount: 3,
            prismAngleDeg: 25,
            explosionId: obstacleType.includes('shield') ? 'small_pop' : 'asteroid_burst',
            fragmentGeneration: 0,
            sprite: this.doesObstacleReflect(obstacleType) ? 'shield' : 'obstacle',
            opacity: 1
        };
        this.obstacles.push(obstacle);
    }

    getRandomObstacleType() {
        const all = ['small_asteroid', 'medium_asteroid', 'large_asteroid', 'small_shield', 'medium_shield', 'large_shield', 'fragmented_asteroid', 'fragmented_shield'];
        const types = (this.allowedTypes && this.allowedTypes.length) ? this.allowedTypes : all;
        return types[Math.floor(Math.random() * types.length)];
    }

    getRandomFormationType() {
        const formations = ['wall', 'barrier', 'zigzag', 'ladder', 'bridge', 'cluster', 'solid_block', 'maze_wall', 'corridor'];
        return formations[Math.floor(Math.random() * formations.length)];
    }

    getObstacleSize(type) {
        switch (type) {
            case 'small_asteroid':
            case 'small_shield':
                return { width: 7, height: 7 };
            case 'medium_asteroid':
            case 'medium_shield':
                return { width: 10, height: 10 };
            case 'large_asteroid':
            case 'large_shield':
                return { width: 14, height: 14 };
            case 'fragmented_asteroid':
                return { width: 9, height: 11 };
            case 'fragmented_shield':
                return { width: 9, height: 11 };
            default:
                return { width: 9, height: 9 };
        }
    }

    getObstacleColor(type) {
        switch (type) {
            case 'small_asteroid':
            case 'medium_asteroid':
            case 'large_asteroid':
            case 'fragmented_asteroid':
                return this.getRandomObstacleColor();
            case 'small_shield':
            case 'medium_shield':
            case 'large_shield':
            case 'fragmented_shield':
                return this.getRandomShieldColor();
            default:
                return 'var(--current-text-secondary)';
        }
    }

    getObstacleHealth(type) {
        switch (type) {
            case 'small_asteroid':
                return 1;
            case 'medium_asteroid':
                return 2;
            case 'large_asteroid':
                return 3;
            case 'fragmented_asteroid':
                return 2; // Fragmented asteroids are medium health
            case 'small_shield':
            case 'medium_shield':
            case 'large_shield':
                return 1; // Shields are fragile but reflect shots
            case 'fragmented_shield':
                return 1; // Fragmented shields are also fragile
            default:
                return 1;
        }
    }

    isObstacleDestructible(type) {
        return type.includes('asteroid');
    }

    doesObstacleReflect(type) {
        return type.includes('shield');
    }

    getRandomShieldColor() {
        const colors = ['var(--gray-400)', 'var(--gray-500)', 'var(--gray-300)'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getRandomObstacleColor() {
        const colors = ['var(--gray-400)', 'var(--gray-500)', 'var(--gray-600)'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    spawnObstacleGroup(gameState = null) {
        const formationType = this.getRandomFormationType();
        this.spawnFormation(formationType, gameState);
    }

    spawnFormation(formationType, gameState = null) {
        // Get canvas dimensions
        const canvasHeight = (gameState && gameState.height) ? gameState.height : 300;
        const startY = Math.random() * (canvasHeight * 0.5); // Random vertical position for the formation
        
        // Horizontal speed: left to right movement
        const horizontalSpeed = 0.5 + Math.random() * 1.0; // 0.5-1.5 pixels per frame
        // Vertical speed: 30% of horizontal speed
        const verticalSpeed = horizontalSpeed * 0.3;
        
        switch (formationType) {
            case 'wall':
                this.spawnWall(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'barrier':
                this.spawnBarrier(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'zigzag':
                this.spawnZigzag(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'ladder':
                this.spawnLadder(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'bridge':
                this.spawnBridge(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'cluster':
                this.spawnCluster(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'solid_block':
                this.spawnSolidBlock(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'maze_wall':
                this.spawnMazeWall(startY, horizontalSpeed, verticalSpeed);
                break;
            case 'corridor':
                this.spawnCorridor(startY, horizontalSpeed, verticalSpeed);
                break;
        }
    }

    spawnWall(startY, horizontalSpeed, verticalSpeed) {
        // Create a vertical wall of connected obstacles
        const wallHeight = 6 + Math.floor(Math.random() * 4); // Increased from 4-6 to 6-9 obstacles high
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let i = 0; i < wallHeight; i++) {
            const obstacle = {
                x: -size.width,
                y: startY + (i * size.height * 0.8), // Reduced spacing for tighter connection
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
    }

    spawnBarrier(startY, horizontalSpeed, verticalSpeed) {
        // Create a horizontal barrier with fewer gaps for better connection
        const barrierLength = 8 + Math.floor(Math.random() * 4); // Increased from 6-9 to 8-11 obstacles wide
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let i = 0; i < barrierLength; i++) {
            // Reduced gap chance for more connected barriers
            if (Math.random() < 0.15) continue; // Reduced from 0.3 to 0.15
            
            const obstacle = {
                x: -size.width - (i * size.width * 0.9), // Reduced spacing for tighter connection
                y: startY,
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
    }

    spawnZigzag(startY, horizontalSpeed, verticalSpeed) {
        // Create a zigzag pattern
        const zigzagLength = 5 + Math.floor(Math.random() * 3); // 5-7 obstacles
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let i = 0; i < zigzagLength; i++) {
            const obstacle = {
                x: -size.width - (i * size.width),
                y: startY + (i % 2 === 0 ? 0 : size.height), // Alternate up/down
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
    }

    spawnLadder(startY, horizontalSpeed, verticalSpeed) {
        // Create a ladder-like structure with horizontal rungs
        const rungs = 3 + Math.floor(Math.random() * 2); // 3-4 rungs
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let rung = 0; rung < rungs; rung++) {
            const rungLength = 2 + Math.floor(Math.random() * 2); // 2-3 obstacles per rung
            for (let i = 0; i < rungLength; i++) {
                const obstacle = {
                    x: -size.width - (i * size.width),
                    y: startY + (rung * size.height * 2), // Space between rungs
                    width: size.width,
                    height: size.height,
                    horizontalSpeed: horizontalSpeed,
                    verticalSpeed: verticalSpeed,
                    rotation: 0,
                    rotationSpeed: (Math.random() - 0.5) * 0.05,
                    type: obstacleType,
                    color: this.getObstacleColor(obstacleType),
                    health: this.getObstacleHealth(obstacleType),
                    maxHealth: this.getObstacleHealth(obstacleType),
                    isDestructible: this.isObstacleDestructible(obstacleType),
                    reflectsShots: this.doesObstacleReflect(obstacleType)
                };
                this.obstacles.push(obstacle);
            }
        }
    }

    spawnBridge(startY, horizontalSpeed, verticalSpeed) {
        // Create a bridge-like structure with supports
        const bridgeLength = 4 + Math.floor(Math.random() * 3); // 4-6 obstacles
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        // Bridge deck
        for (let i = 0; i < bridgeLength; i++) {
            const obstacle = {
                x: -size.width - (i * size.width),
                y: startY,
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
        
        // Bridge supports
        for (let i = 0; i < bridgeLength; i += 2) {
            const obstacle = {
                x: -size.width - (i * size.width),
                y: startY + size.height,
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
    }

    spawnCluster(startY, horizontalSpeed, verticalSpeed) {
        // Create a tight cluster of obstacles
        const clusterSize = 3 + Math.floor(Math.random() * 3); // 3-5 obstacles
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let i = 0; i < clusterSize; i++) {
            const obstacle = {
                x: -size.width - (i * size.width * 0.7), // Overlap slightly
                y: startY + (i * size.height * 0.5), // Slight vertical offset
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.1,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
    }

    getObstacles() {
        return this.obstacles;
    }

    // Lighting system methods
    updateLightingBullets() {
        // Get bullets from bullet manager
        if (typeof bulletManager !== 'undefined') {
            this.lightingBullets = [
                ...bulletManager.getBullets(),
                ...bulletManager.getEnemyBullets()
            ].filter(bullet => bullet.lightRadius && bullet.lightIntensity);
        }
    }

    calculateObstacleLighting(obstacle) {
        // Reset lighting
        obstacle.lightIntensity = 0;
        obstacle.lightColor = null;
        
        // Check distance to all lighting bullets
        for (const bullet of this.lightingBullets) {
            const dx = (obstacle.x + obstacle.width/2) - (bullet.x + bullet.width/2);
            const dy = (obstacle.y + obstacle.height/2) - (bullet.y + bullet.height/2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If within light radius
            if (distance <= bullet.lightRadius) {
                // Enhanced light intensity calculation with smoother falloff
                const normalizedDistance = distance / bullet.lightRadius;
                const falloffFactor = Math.pow(1 - normalizedDistance, 2); // Quadratic falloff for smoother transition
                const intensity = bullet.lightIntensity * falloffFactor;
                
                // Accumulate light from multiple sources
                if (intensity > obstacle.lightIntensity) {
                    obstacle.lightIntensity = Math.min(1.5, intensity); // Cap at 1.5 for bright effect
                    obstacle.lightColor = bullet.lightColor;
                }
            }
        }
    }

    spawnSolidBlock(startY, horizontalSpeed, verticalSpeed) {
        // Create a solid rectangular block of obstacles
        const blockWidth = 4 + Math.floor(Math.random() * 3); // 4-6 obstacles wide
        const blockHeight = 3 + Math.floor(Math.random() * 2); // 3-4 obstacles high
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let x = 0; x < blockWidth; x++) {
            for (let y = 0; y < blockHeight; y++) {
                const obstacle = {
                    x: -size.width - (x * size.width * 0.95), // Very tight spacing
                    y: startY + (y * size.height * 0.95), // Very tight spacing
                    width: size.width,
                    height: size.height,
                    horizontalSpeed: horizontalSpeed,
                    verticalSpeed: verticalSpeed,
                    rotation: 0,
                    rotationSpeed: (Math.random() - 0.5) * 0.05,
                    type: obstacleType,
                    color: this.getObstacleColor(obstacleType),
                    health: this.getObstacleHealth(obstacleType),
                    maxHealth: this.getObstacleHealth(obstacleType),
                    isDestructible: this.isObstacleDestructible(obstacleType),
                    reflectsShots: this.doesObstacleReflect(obstacleType)
                };
                this.obstacles.push(obstacle);
            }
        }
    }

    spawnMazeWall(startY, horizontalSpeed, verticalSpeed) {
        // Create a maze-like wall with strategic gaps
        const wallLength = 6 + Math.floor(Math.random() * 4); // 6-9 obstacles
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let i = 0; i < wallLength; i++) {
            // Create gaps only at specific intervals for maze effect
            if (i % 3 === 1 && Math.random() < 0.4) continue;
            
            const obstacle = {
                x: -size.width - (i * size.width * 0.9),
                y: startY + (i % 2 === 0 ? 0 : size.height * 0.8), // Alternating height
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(obstacle);
        }
    }

    spawnCorridor(startY, horizontalSpeed, verticalSpeed) {
        // Create walls on both sides forming a corridor
        const corridorLength = 5 + Math.floor(Math.random() * 3); // 5-7 obstacles
        const obstacleType = this.getRandomObstacleType();
        const size = this.getObstacleSize(obstacleType);
        
        for (let i = 0; i < corridorLength; i++) {
            // Top wall
            const topObstacle = {
                x: -size.width - (i * size.width * 0.9),
                y: startY,
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(topObstacle);
            
            // Bottom wall
            const bottomObstacle = {
                x: -size.width - (i * size.width * 0.9),
                y: startY + size.height * 3, // Gap between walls
                width: size.width,
                height: size.height,
                horizontalSpeed: horizontalSpeed,
                verticalSpeed: verticalSpeed,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                type: obstacleType,
                color: this.getObstacleColor(obstacleType),
                health: this.getObstacleHealth(obstacleType),
                maxHealth: this.getObstacleHealth(obstacleType),
                isDestructible: this.isObstacleDestructible(obstacleType),
                reflectsShots: this.doesObstacleReflect(obstacleType)
            };
            this.obstacles.push(bottomObstacle);
        }
    }

    getObstacleWithLighting(obstacle) {
        // Return obstacle with lighting information
        return {
            ...obstacle,
            hasLighting: obstacle.lightIntensity > 0,
            lightingIntensity: obstacle.lightIntensity || 0,
            lightingColor: obstacle.lightColor || 'var(--current-text-secondary)'
        };
    }

    removeObstacle(index) {
        const obstacle = this.obstacles[index];
        if (obstacle && obstacle.fragmentOnDestroy && obstacle.fragmentCount > 0 && !obstacle.isFog) {
            this.spawnFragments(obstacle);
        }
        if (obstacle && !obstacle.isFog && typeof explosionSystem !== 'undefined' && obstacle._skipDestroyFx !== true) {
            // Destroy FX is usually played by collisions; only play if explicitly requested
        }
        this.obstacles.splice(index, 1);
    }

    spawnFragments(parent) {
        const count = Math.max(1, Math.min(12, parent.fragmentCount || 3));
        const ratio = parent.fragmentSizeRatio != null ? parent.fragmentSizeRatio : 0.45;
        const fw = Math.max(6, Math.round(parent.width * ratio));
        const fh = Math.max(6, Math.round(parent.height * ratio));
        const generation = (parent.fragmentGeneration || 0) + 1;
        const maxDepth = parent.fragmentDepth != null ? parent.fragmentDepth : 0;
        const canCascade = generation <= maxDepth;
        const childChance = parent.childFragmentChance != null ? parent.childFragmentChance : 0;
        const hardCap = 24;
        let spawned = 0;

        for (let i = 0; i < count; i++) {
            if (spawned >= hardCap) break;
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
            const speed = 0.6 + Math.random() * 0.8;
            const willFragment = canCascade && Math.random() < childChance;
            const isCrystal = parent.kind === 'crystal' || parent.opticalMode === 'prism'
                || parent.opticalMode === 'mirror' || parent.opticalMode === 'kaleidoscope';
            this.obstacles.push({
                x: parent.x + parent.width / 2 - fw / 2,
                y: parent.y + parent.height / 2 - fh / 2,
                width: fw,
                height: fh,
                horizontalSpeed: Math.cos(angle) * speed + (parent.horizontalSpeed || 0) * 0.4,
                verticalSpeed: Math.sin(angle) * speed + (parent.verticalSpeed || 0) * 0.4,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.25,
                type: isCrystal ? 'crystal_shard' : 'small_asteroid',
                kind: isCrystal ? 'crystal' : 'asteroid',
                cluster: parent.cluster || 'alpha',
                color: parent.color,
                health: Math.max(1, parent.fragmentHealth || 1),
                maxHealth: Math.max(1, parent.fragmentHealth || 1),
                isDestructible: true,
                reflectsShots: false,
                isFog: false,
                fragmentOnDestroy: willFragment,
                fragmentCount: willFragment ? Math.max(2, Math.round((parent.fragmentCount || 3) * 0.7)) : 0,
                fragmentDepth: parent.fragmentDepth || 0,
                fragmentSizeRatio: Math.max(0.25, ratio * 0.85),
                fragmentDamage: Math.max(1, Math.round((parent.fragmentDamage || 8) * 0.7)),
                fragmentHealth: 1,
                childFragmentChance: Math.max(0, (parent.childFragmentChance || 0) * 0.7),
                collisionDamage: Math.max(1, parent.fragmentDamage != null ? parent.fragmentDamage : 8),
                opticalMode: isCrystal
                    ? (parent.opticalMode === 'kaleidoscope' ? 'prism' : (parent.opticalMode || 'none'))
                    : 'none',
                prismSplitCount: Math.max(2, (parent.prismSplitCount || 3) - 1),
                prismAngleDeg: parent.prismAngleDeg || 25,
                explosionId: parent.explosionId || (isCrystal ? 'crystal_shatter' : 'asteroid_burst'),
                fragmentGeneration: generation,
                sprite: isCrystal ? 'crystal' : 'obstacleSmall',
                opacity: 1,
                lightIntensity: isCrystal ? 0.3 : 0,
                lightColor: isCrystal ? 'var(--color-highlight)' : null
            });
            spawned++;
        }
    }

    getFogObstacles() {
        return this.obstacles.filter((o) => o && o.isFog);
    }

    reset() {
        this.obstacles.length = 0;
    }
}

// Global obstacle manager instance
const obstacleManager = new ObstacleManager();
