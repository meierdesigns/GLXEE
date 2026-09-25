"use strict";

// EnemyConfigManager methods, split from enemy-config.js.
extendClass(EnemyConfigManager, {
    /** Enemies built on ship hulls, including player hulls. */
    createHullEnemyDefaults() {
        return {
            fighter: this.makeEnemy({
                id: 'fighter',
                name: 'Fighter',
                description: 'Fast enemy fighter. Quick but fragile.',
                hullId: 'fighter',
                factions: ['terran'],
                speed: 1.5,
                verticalSpeed: 0.4,
                maxHealth: 60,
                armor: 6,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                abilities: [],
                damage: 25,
                shootInterval: 1200,
                evasionCooldown: 2000,
                evasionDuration: 800,
                evasionSpeed: 3,
                minY: 25,
                maxY: 100,
                experienceValue: 80,
                defaultWeapon: 'laser',
                weaponDamage: 6,
                weaponSpeed: 6,
                weaponCooldown: 1200
            }),
            interceptor: this.makeEnemy({
                id: 'interceptor',
                name: 'Interceptor',
                description: 'High-speed attack craft.',
                hullId: 'interceptor',
                factions: ['kronax'],
                speed: 2.75,
                verticalSpeed: 0.75,
                maxHealth: 50,
                armor: 4,
                shieldMax: 0,
                shieldRegen: 0,
                damageReduction: 0,
                reflectChance: 0,
                defenseMechanisms: [],
                damage: 20,
                shootInterval: 1000,
                evasionCooldown: 1800,
                evasionDuration: 700,
                evasionSpeed: 4,
                minY: 25,
                maxY: 100,
                experienceValue: 150,
                defaultWeapon: 'laser',
                weaponDamage: 5,
                weaponSpeed: 7,
                weaponCooldown: 1000
            }),
            cruiser: this.makeEnemy({
                id: 'cruiser',
                name: 'Cruiser',
                description: 'Heavy armored warship.',
                hullId: 'cruiser',
                factions: ['machine'],
                speed: 1.0,
                verticalSpeed: 0.2,
                maxHealth: 110,
                armor: 16,
                shieldMax: 20,
                shieldRegen: 1,
                damageReduction: 5,
                reflectChance: 0,
                defenseMechanisms: ['heavy_armor', 'shield_regen'],
                abilities: ['heavy_armor', 'shield_regen'],
                damage: 40,
                shootInterval: 3000,
                evasionCooldown: 5000,
                evasionDuration: 1500,
                evasionSpeed: 1,
                minY: 25,
                maxY: 100,
                experienceValue: 300,
                defaultWeapon: 'plasma',
                weaponDamage: 16,
                weaponSpeed: 3,
                weaponCooldown: 1500
            }),
            battleship: this.makeEnemy({
                id: 'battleship',
                name: 'Battleship',
                description: 'Massive enemy battleship.',
                hullId: 'battleship',
                factions: ['voidborn'],
                speed: 0.4,
                verticalSpeed: 0.05,
                maxHealth: 220,
                armor: 28,
                shieldMax: 45,
                shieldRegen: 1,
                damageReduction: 10,
                reflectChance: 0,
                defenseMechanisms: ['massive_armor', 'energy_shield', 'shield_regen'],
                abilities: ['massive_armor', 'energy_shield', 'shield_regen', 'boss_ai'],
                damage: 90,
                shootInterval: 1800,
                evasionCooldown: 8000,
                evasionDuration: 2500,
                evasionSpeed: 0.5,
                minY: 25,
                maxY: 100,
                experienceValue: 750,
                defaultWeapon: 'plasma',
                weaponDamage: 22,
                weaponSpeed: 2,
                weaponCooldown: 1200,
                combatEvents: [
                    {
                        id: 'reinforce_low',
                        trigger: 'hpBelow',
                        threshold: 0.35,
                        once: true,
                        action: 'summon',
                        count: 2,
                        role: 'gunner',
                        type: 'enemyFast'
                    },
                    {
                        id: 'repair_panic',
                        trigger: 'hpBelow',
                        threshold: 0.2,
                        once: true,
                        action: 'summon',
                        count: 2,
                        role: 'repair',
                        type: 'enemyBasic'
                    }
                ]
            }),
            player: this.makeEnemyFromPlayerHull('player', {
                name: 'Starfighter (Enemy)',
                description: 'Player starfighter hull used as enemy.',
                factions: ['terran'],
                speed: 1.8,
                verticalSpeed: 0.45,
                maxHealth: 90,
                armor: 15,
                damage: 22,
                experienceValue: 100,
                defaultWeapon: 'laser',
                weaponDamage: 8,
                weaponSpeed: 7,
                weaponCooldown: 900
            }),
            player_interceptor: this.makeEnemyFromPlayerHull('player_interceptor', {
                name: 'Interceptor (Enemy)',
                description: 'Player interceptor hull used as enemy.',
                factions: ['terran', 'kronax'],
                speed: 2.9,
                verticalSpeed: 0.8,
                maxHealth: 70,
                armor: 8,
                damage: 18,
                experienceValue: 140,
                defaultWeapon: 'rapid',
                weaponDamage: 5,
                weaponSpeed: 9,
                weaponCooldown: 500
            }),
            player_heavy: this.makeEnemyFromPlayerHull('player_heavy', {
                name: 'Heavy Fighter (Enemy)',
                description: 'Player heavy fighter hull used as enemy.',
                factions: ['terran', 'machine'],
                speed: 1.0,
                verticalSpeed: 0.2,
                maxHealth: 160,
                armor: 40,
                damage: 40,
                experienceValue: 280,
                defaultWeapon: 'spread',
                weaponDamage: 14,
                weaponSpeed: 4,
                weaponCooldown: 1400
            }),
            player_assault: this.makeEnemyFromPlayerHull('player_assault', {
                name: 'Assault (Enemy)',
                description: 'Player assault hull used as enemy.',
                factions: ['terran', 'pirate'],
                speed: 1.4,
                verticalSpeed: 0.35,
                maxHealth: 120,
                armor: 25,
                damage: 30,
                experienceValue: 180,
                defaultWeapon: 'laser',
                weaponDamage: 10,
                weaponSpeed: 6,
                weaponCooldown: 1000
            })
        };
    },

    makeEnemyFromPlayerHull(hullId, data) {
        return this.makeEnemy(Object.assign({
            id: hullId,
            hullId: hullId,
            minY: 25,
            maxY: 100
        }, data || {}));
    },

    normalizeIdList(value) {
        if (!Array.isArray(value)) return [];
        const out = [];
        value.forEach((v) => {
            const id = String(v || '').trim();
            if (id && out.indexOf(id) === -1) out.push(id);
        });
        return out;
    },
});
