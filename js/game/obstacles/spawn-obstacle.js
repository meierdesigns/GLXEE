"use strict";

// ObstacleManager methods, split from obstacles.js.
extendClass(ObstacleManager, {
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
        const verticalSpeed = horizontalSpeed * 0.12;

        const obstacle = {
            x: -size.width, // Start from left side of screen
            y: this.pickLaneY(canvasHeight, size.height), // Mostly the mid lane
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
    },

    getRandomObstacleType() {
        const all = ['small_asteroid', 'medium_asteroid', 'large_asteroid', 'small_shield', 'medium_shield', 'large_shield', 'fragmented_asteroid', 'fragmented_shield'];
        const types = (this.allowedTypes && this.allowedTypes.length) ? this.allowedTypes : all;
        return types[Math.floor(Math.random() * types.length)];
    },

    getRandomFormationType() {
        const formations = ['wall', 'barrier', 'zigzag', 'ladder', 'bridge', 'cluster', 'solid_block', 'maze_wall', 'corridor'];
        return formations[Math.floor(Math.random() * formations.length)];
    },

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
    },

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
    },

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
    },

    isObstacleDestructible(type) {
        return type.includes('asteroid');
    },

    doesObstacleReflect(type) {
        return type.includes('shield');
    },

    getRandomShieldColor() {
        const colors = ['var(--gray-400)', 'var(--gray-500)', 'var(--gray-300)'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    getRandomObstacleColor() {
        const colors = ['var(--gray-400)', 'var(--gray-500)', 'var(--gray-600)'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    spawnObstacleGroup(gameState = null) {
        const formationType = this.getRandomFormationType();
        this.spawnFormation(formationType, gameState);
    },

    spawnFormation(formationType, gameState = null) {
        // Get canvas dimensions
        const canvasHeight = (gameState && gameState.height) ? gameState.height : 300;
        // Formations start at the top of the mid lane (rarely anywhere).
        const lane = this.midLane(canvasHeight);
        const startY = Math.random() < 0.15
            ? Math.random() * (canvasHeight * 0.5)
            : lane.top + Math.random() * (lane.bottom - lane.top) * 0.4;

        // Horizontal speed: left to right movement
        const horizontalSpeed = 0.5 + Math.random() * 1.0; // 0.5-1.5 pixels per frame
        // Vertical speed: 30% of horizontal speed
        const verticalSpeed = horizontalSpeed * 0.12;

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
    },

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
    },

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
    },

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
    },
});
