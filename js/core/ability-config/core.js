"use strict";

/**
 * Shared ability registry — used by player ships and enemies.
 * Persisted in localStorage; editable via Ability Editor.
 */
class AbilityConfigManager {
    constructor() {
        this.storageKey = 'vf_ability_configs_v2';
        this.clusterOrder = [
            { id: 'core', label: 'CORE' },
            { id: 'mobility', label: 'MOBILITY' },
            { id: 'offense', label: 'OFFENSE' },
            { id: 'defense', label: 'DEFENSE' },
            { id: 'combat', label: 'COMBAT' },
            { id: 'other', label: 'OTHER' }
        ];
        this.configs = this.createDefaults();
        this.load();
    }

    createDefaults() {
        return {
            ...this.createCoreAbilityDefaults(),
            ...this.createCombatAbilityDefaults()
        };
    }

    /** Movement, weapon, armor and shield abilities. */
    createCoreAbilityDefaults() {
        return {
            player_control: this.makeAbility({
                id: 'player_control',
                name: 'Player Control',
                description: 'Direct player control with enhanced responsiveness',
                icon: 'ability_player_control',
                cluster: 'core',
                type: 'passive',
                tier: 1,
                uiDescription: 'Enhanced player control and responsiveness'
            }),
            weapon_systems: this.makeAbility({
                id: 'weapon_systems',
                name: 'Weapon Systems',
                description: 'Integrated targeting and fire-control suite',
                icon: 'ability_weapon_systems',
                cluster: 'core',
                type: 'passive',
                tier: 1,
                uiDescription: 'Improved weapon targeting systems'
            }),
            energy_core: this.makeAbility({
                id: 'energy_core',
                name: 'Energy Core',
                description: 'Ship power plant. Supplies weapons, shields and boost systems',
                icon: 'ability_energy_shield',
                mountSprite: 'mount_energy_core',
                cluster: 'core',
                type: 'passive',
                tier: 1,
                uiDescription: 'Power grid generator for ship modules',
                faction: null
            }),
            evasion_boost: this.makeAbility({
                id: 'evasion_boost',
                name: 'Evasion Boost',
                description: 'Enhanced maneuverability and evasion capabilities',
                icon: 'ability_evasion_boost',
                cluster: 'mobility',
                type: 'active',
                tier: 1,
                uiDescription: 'Temporary speed and evasion boost'
            }),
            high_speed: this.makeAbility({
                id: 'high_speed',
                name: 'High Speed',
                description: 'Extreme thruster output for interceptor craft',
                icon: 'ability_high_speed',
                cluster: 'mobility',
                type: 'passive',
                tier: 1,
                uiDescription: 'Significantly increased top speed'
            }),
            agile_maneuver: this.makeAbility({
                id: 'agile_maneuver',
                name: 'Agile Maneuver',
                description: 'Precision thrusters for tight combat turns',
                icon: 'ability_agile_maneuver',
                cluster: 'mobility',
                type: 'passive',
                tier: 1,
                uiDescription: 'Improved turning and dodge response'
            }),
            rapid_fire: this.makeAbility({
                id: 'rapid_fire',
                name: 'Rapid Fire',
                description: 'Accelerated weapon cycling for high fire rate',
                icon: 'ability_rapid_fire',
                cluster: 'offense',
                type: 'passive',
                tier: 1,
                uiDescription: 'Faster weapon cooldown'
            }),
            powerful_cannon: this.makeAbility({
                id: 'powerful_cannon',
                name: 'Powerful Cannon',
                description: 'Heavy ordnance with devastating impact',
                icon: 'ability_powerful_cannon',
                cluster: 'offense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Increased weapon damage'
            }),
            versatile_weapons: this.makeAbility({
                id: 'versatile_weapons',
                name: 'Versatile Weapons',
                description: 'Multi-mode armament switching',
                icon: 'ability_versatile_weapons',
                cluster: 'offense',
                type: 'passive',
                tier: 1,
                uiDescription: 'Access to multiple weapon modes'
            }),
            devastating_cannon: this.makeAbility({
                id: 'devastating_cannon',
                name: 'Devastating Cannon',
                description: 'Boss-grade heavy cannon barrage',
                icon: 'ability_devastating_cannon',
                cluster: 'offense',
                type: 'active',
                tier: 3,
                uiDescription: 'Extreme burst damage'
            }),
            heavy_armor: this.makeAbility({
                id: 'heavy_armor',
                name: 'Heavy Armor',
                description: 'Reinforced plating for frontline durability',
                icon: 'ability_heavy_armor',
                cluster: 'defense',
                type: 'passive',
                tier: 1,
                uiDescription: 'Increased armor rating',
                faction: 'terran'
            }),
            massive_armor: this.makeAbility({
                id: 'massive_armor',
                name: 'Massive Armor',
                description: 'Battleship-grade hull plating',
                icon: 'ability_massive_armor',
                cluster: 'defense',
                type: 'passive',
                tier: 3,
                uiDescription: 'Extreme damage resistance',
                faction: 'terran'
            }),
            shield_generator: this.makeAbility({
                id: 'shield_generator',
                name: 'Shield Generator',
                description: 'Energy barrier generation system',
                icon: 'ability_shield_generator',
                cluster: 'defense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Provides energy shield capacity',
                faction: 'terran'
            }),
            energy_shield: this.makeAbility({
                id: 'energy_shield',
                name: 'Energy Shield',
                description: 'High-capacity energy deflection field',
                icon: 'ability_energy_shield',
                cluster: 'defense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Strong energy shield',
                faction: 'terran'
            }),
            capacitor_shield_regen: this.makeAbility({
                id: 'capacitor_shield_regen',
                name: 'Capacitor Shield',
                description: 'Bulkier shield capacitor bank. Higher capacity and steady regen, needs a larger core mount.',
                icon: 'ability_energy_shield',
                cluster: 'defense',
                type: 'passive',
                tier: 3,
                uiDescription: 'Large-capacity shield with built-in regen',
                faction: null,
                visual: 'plating_capacitor',
                slotMode: 'insert',
                slotZone: 'center',
                slotSize: 3
            }),
            adaptive_shield: this.makeAbility({
                id: 'adaptive_shield',
                name: 'Adaptive Shield',
                description: 'Shield that adapts to incoming damage types',
                icon: 'ability_adaptive_shield',
                cluster: 'defense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Adaptive damage mitigation',
                faction: 'terran'
            }),
            shield_regen: this.makeAbility({
                id: 'shield_regen',
                name: 'Shield Regen',
                description: 'Automatic shield recharge over time',
                icon: 'ability_shield_regen',
                cluster: 'defense',
                type: 'passive',
                tier: 1,
                uiDescription: 'Passive shield regeneration',
                faction: 'terran'
            })
        };
    }
}
