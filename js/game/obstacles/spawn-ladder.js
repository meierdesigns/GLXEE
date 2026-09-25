"use strict";

// ObstacleManager methods, split from obstacles.js.
extendClass(ObstacleManager, {
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
    },

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
    },

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
    },

    getObstacles() {
        return this.obstacles;
    },

    // Lighting system methods
    updateLightingBullets() {
        // Get bullets from bullet manager
        if (typeof bulletManager !== 'undefined') {
            this.lightingBullets = [
                ...bulletManager.getBullets(),
                ...bulletManager.getEnemyBullets()
            ].filter(bullet => bullet.lightRadius && bullet.lightIntensity);
        }
    },

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
    },

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
    },

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
    },

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
    },

    getObstacleWithLighting(obstacle) {
        // Return obstacle with lighting information
        return {
            ...obstacle,
            hasLighting: obstacle.lightIntensity > 0,
            lightingIntensity: obstacle.lightIntensity || 0,
            lightingColor: obstacle.lightColor || 'var(--current-text-secondary)'
        };
    },
});
