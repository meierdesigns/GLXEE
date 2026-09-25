"use strict";

/**
 * Enemy configuration — stats, behavior, weapons, armor/shields per enemy type.
 * Persisted in localStorage; applied when enemy models are selected.
 */
class EnemyConfigManager {
    constructor() {
        this.storageKey = 'vf_enemy_configs_v2_balanced';
        this.playerHullIds = [
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableTypes = [
            'enemyBasic', 'enemyFast', 'enemyHeavy', 'enemyBoss',
            'fighter', 'interceptor', 'cruiser', 'battleship',
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableHullIds = [
            'enemyBasic', 'enemyFast', 'enemyHeavy', 'enemyBoss',
            'fighter', 'interceptor', 'cruiser', 'battleship', 'scout',
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableWeapons = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getIds()
            : ['laser', 'plasma', 'spread', 'rapid', 'missile', 'ion', 'wave', 'burst', 'pierce', 'nova'];
        this.availableDefenseMechanisms = [
            'heavy_armor', 'energy_shield', 'adaptive_shield', 'shield_regen', 'massive_armor'
        ];
        Object.defineProperty(this, 'availableAbilities', {
            get: () => {
                if (typeof abilityConfigManager !== 'undefined') {
                    return abilityConfigManager.getIds();
                }
                return this.availableDefenseMechanisms.slice();
            }
        });
        this.displayNames = {
            enemyBasic: 'BASIC',
            enemyFast: 'FAST',
            enemyHeavy: 'HEAVY',
            enemyBoss: 'BOSS',
            fighter: 'FIGHTER',
            interceptor: 'INTERCEPTOR',
            cruiser: 'CRUISER',
            battleship: 'BATTLESHIP',
            player: 'STARFIGHTER',
            player_interceptor: 'P-INTERCEPTOR',
            player_heavy: 'P-HEAVY',
            player_assault: 'P-ASSAULT'
        };
        this.defaultFactionsByType = {
            enemyBasic: ['pirate'],
            enemyFast: ['kronax'],
            enemyHeavy: ['machine'],
            enemyBoss: ['voidborn'],
            fighter: ['terran'],
            interceptor: ['kronax'],
            cruiser: ['machine'],
            battleship: ['voidborn'],
            player: ['terran'],
            player_interceptor: ['terran'],
            player_heavy: ['terran'],
            player_assault: ['terran']
        };
        this.configs = this.createDefaults();
        this.load();
    }

    createDefaults() {
        return {
            ...this.createClassicEnemyDefaults(),
            ...this.createHullEnemyDefaults()
        };
    }

    /** Original enemy types (basic, fast, heavy, boss). */
    createClassicEnemyDefaults() {
        return {
            enemyBasic: this.makeEnemy({
                id: 'enemyBasic',
                name: 'Basic Fighter',
                description: 'Fast enemy fighter. Quick but fragile.',
                hullId: 'fighter',
                factions: ['pirate'],
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
            enemyFast: this.makeEnemy({
                id: 'enemyFast',
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
            enemyHeavy: this.makeEnemy({
                id: 'enemyHeavy',
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
            enemyBoss: this.makeEnemy({
                id: 'enemyBoss',
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
            })
        };
    }
}
