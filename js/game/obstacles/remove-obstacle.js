"use strict";

// ObstacleManager methods, split from obstacles.js.
extendClass(ObstacleManager, {
    removeObstacle(index) {
        const obstacle = this.obstacles[index];
        if (obstacle && obstacle.fragmentOnDestroy && obstacle.fragmentCount > 0 && !obstacle.isFog) {
            this.spawnFragments(obstacle);
        }
        if (obstacle && !obstacle.isFog && typeof explosionSystem !== 'undefined' && obstacle._skipDestroyFx !== true) {
            // Destroy FX is usually played by collisions; only play if explicitly requested
        }
        this.obstacles.splice(index, 1);
    },

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
    },

    getFogObstacles() {
        return this.obstacles.filter((o) => o && o.isFog);
    },

    reset() {
        this.obstacles.length = 0;
    },
});
