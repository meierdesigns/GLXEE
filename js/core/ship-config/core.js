"use strict";

/**
 * Player ship configuration — stats, weapons, abilities per ship.
 * Persisted in localStorage; applied when player ships are selected.
 */
class ShipConfigManager {
    constructor() {
        this.storageKey = 'vf_ship_configs_v2';
        this.availableWeapons = (typeof weaponConfigManager !== 'undefined')
            ? weaponConfigManager.getIds()
            : ['laser', 'spread', 'rapid', 'plasma', 'missile', 'ion', 'wave', 'burst', 'pierce', 'nova', 'claw_beam', 'spike_burst'];
        this._fallbackAbilities = [
            'player_control', 'weapon_systems', 'evasion_boost',
            'high_speed', 'rapid_fire', 'agile_maneuver',
            'heavy_armor', 'powerful_cannon', 'shield_generator',
            'balanced_combat', 'versatile_weapons', 'adaptive_shield',
            'shield_regen'
        ];
        Object.defineProperty(this, 'availableAbilities', {
            get: () => {
                if (typeof abilityConfigManager !== 'undefined') {
                    return abilityConfigManager.getIds();
                }
                return this._fallbackAbilities.slice();
            }
        });
        this.baseTypes = [
            'player_scrap', 'player', 'player_interceptor', 'player_heavy', 'player_assault',
            'player_kronax_raider', 'player_kronax_claw'
        ];
        this.displayNames = {
            player_scrap: 'SCRAP FIGHTER',
            player: 'STARFIGHTER',
            player_interceptor: 'INTERCEPTOR',
            player_heavy: 'HEAVY FIGHTER',
            player_assault: 'ASSAULT',
            player_kronax_raider: 'KRONAX RAIDER',
            player_kronax_claw: 'KRONAX CLAW'
        };
        this.modelClassById = {
            player_scrap: 'starfighter',
            player: 'starfighter',
            player_interceptor: 'interceptor',
            player_heavy: 'heavy_fighter',
            player_assault: 'assault',
            player_kronax_raider: 'interceptor',
            player_kronax_claw: 'starfighter'
        };
        this.configs = this.createDefaults();
        this.load();
    }

    createDefaults() {
        return {
            player_scrap: this.makeShip({
                id: 'player_scrap',
                name: 'Scrap Fighter',
                description: 'Self-built starter hull. Basic laser and a simple energy shield. Barely flightworthy.',
                modelClass: 'starfighter',
                speed: 3.5,
                maxHealth: 55,
                armor: 5,
                damage: 12,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'laser',
                availableWeapons: ['laser'],
                weaponDamage: 8,
                weaponSpeed: 8,
                weaponCooldown: 350,
                abilities: ['player_control', 'weapon_systems', 'energy_shield'],
                energy: ['energy_core'],
                tier: 0,
                cost: 0,
                faction: null
            }),
            player: this.makeShip({
                id: 'player',
                name: 'Starfighter',
                description: 'Fast and agile fighter with precision weapons. High speed and maneuverability.',
                modelClass: 'starfighter',
                speed: 5.0,
                maxHealth: 80,
                armor: 15,
                damage: 25,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'laser',
                availableWeapons: ['laser', 'rapid', 'pierce'],
                weaponDamage: 15,
                weaponSpeed: 10,
                weaponCooldown: 250,
                abilities: ['player_control', 'weapon_systems', 'evasion_boost'],
                tier: 1,
                cost: 40,
                faction: 'terran'
            }),
            player_interceptor: this.makeShip({
                id: 'player_interceptor',
                name: 'Interceptor',
                description: 'Ultra-fast attack craft. Extreme speed and rapid fire rate. Low durability.',
                modelClass: 'interceptor',
                speed: 6.0,
                maxHealth: 60,
                armor: 8,
                damage: 18,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'rapid',
                availableWeapons: ['rapid', 'laser', 'ion'],
                weaponDamage: 5,
                weaponSpeed: 15,
                weaponCooldown: 80,
                abilities: ['high_speed', 'rapid_fire', 'agile_maneuver'],
                tier: 1,
                cost: 75,
                faction: 'terran'
            }),
            player_heavy: this.makeShip({
                id: 'player_heavy',
                name: 'Heavy Fighter',
                description: 'Heavily armored combat unit. High health and powerful weapons. Slow but devastating.',
                modelClass: 'heavy_fighter',
                speed: 2.5,
                maxHealth: 150,
                armor: 40,
                damage: 45,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'spread',
                availableWeapons: ['spread', 'plasma', 'missile', 'burst'],
                weaponDamage: 12,
                weaponSpeed: 6,
                weaponCooldown: 500,
                abilities: ['heavy_armor', 'powerful_cannon', 'shield_generator'],
                tier: 2,
                cost: 100,
                faction: 'terran'
            }),
            player_assault: this.makeShip({
                id: 'player_assault',
                name: 'Assault',
                description: 'Balanced combat craft. Good all-around performance. Versatile weapon systems.',
                modelClass: 'assault',
                speed: 3.5,
                maxHealth: 120,
                armor: 25,
                damage: 35,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'laser',
                availableWeapons: ['laser', 'spread', 'rapid', 'wave', 'nova'],
                weaponDamage: 12,
                weaponSpeed: 8,
                weaponCooldown: 300,
                abilities: ['balanced_combat', 'versatile_weapons', 'adaptive_shield'],
                tier: 1,
                cost: 50,
                faction: 'terran'
            }),
            player_kronax_raider: this.makeShip({
                id: 'player_kronax_raider',
                name: 'Kronax Raider',
                description: 'Andromeda strike craft. Aggressive Kronax thrusters and claw batteries.',
                modelClass: 'interceptor',
                speed: 6.2,
                maxHealth: 70,
                armor: 10,
                damage: 22,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'claw_beam',
                availableWeapons: ['claw_beam', 'ion', 'spike_burst', 'laser'],
                weaponDamage: 7,
                weaponSpeed: 14,
                weaponCooldown: 100,
                abilities: ['high_speed', 'spike_drive', 'reflex_shell'],
                tier: 1,
                cost: 85,
                faction: 'kronax'
            }),
            player_kronax_claw: this.makeShip({
                id: 'player_kronax_claw',
                name: 'Kronax Claw',
                description: 'Hardened Kronax hull with carapace plating and spike ordnance.',
                modelClass: 'starfighter',
                speed: 4.4,
                maxHealth: 95,
                armor: 22,
                damage: 30,
                minY: 200,
                maxY: 284,
                defaultWeapon: 'spike_burst',
                availableWeapons: ['spike_burst', 'wave', 'ion', 'claw_beam'],
                weaponDamage: 11,
                weaponSpeed: 9,
                weaponCooldown: 280,
                abilities: ['carapace_armor', 'reflex_shell', 'spike_drive'],
                tier: 2,
                cost: 95,
                faction: 'kronax'
            })
        };
    }

    makeShip(data) {
        const weapons = Array.isArray(data.availableWeapons)
            ? data.availableWeapons.map(String)
            : ['laser'];
        const abilities = Array.isArray(data.abilities)
            ? data.abilities.map(String)
            : [];
        return {
            id: data.id,
            name: data.name || data.id,
            description: data.description || '',
            modelClass: data.modelClass || 'starfighter',
            baseId: data.baseId || null,
            custom: !!data.custom,
            speed: data.speed != null ? Number(data.speed) : 4,
            maxHealth: data.maxHealth != null ? Math.round(Number(data.maxHealth)) : 100,
            armor: data.armor != null ? Math.round(Number(data.armor)) : 15,
            damage: data.damage != null ? Math.round(Number(data.damage)) : 25,
            minY: data.minY != null ? Math.round(Number(data.minY)) : 200,
            maxY: data.maxY != null ? Math.round(Number(data.maxY)) : 284,
            defaultWeapon: data.defaultWeapon || 'laser',
            availableWeapons: weapons.length ? weapons : ['laser'],
            weaponDamage: data.weaponDamage != null ? Number(data.weaponDamage) : 10,
            weaponSpeed: data.weaponSpeed != null ? Number(data.weaponSpeed) : 8,
            weaponCooldown: data.weaponCooldown != null ? Math.round(Number(data.weaponCooldown)) : 300,
            abilities: abilities,
            energy: Array.isArray(data.energy) ? data.energy.map(String) : [],
            tier: data.tier != null ? Math.round(Number(data.tier)) : 1,
            cost: data.cost != null ? Math.round(Number(data.cost)) : 0,
            faction: data.faction ? String(data.faction).toLowerCase() : null,
            segmentUv: data.segmentUv && typeof data.segmentUv === 'object'
                ? data.segmentUv
                : null
        };
    }

    getTypeIds() {
        const defaults = this.createDefaults();
        const ids = Object.keys(defaults);
        Object.keys(this.configs).forEach((id) => {
            if (ids.indexOf(id) === -1) ids.push(id);
        });
        return ids;
    }

    getDisplayName(typeId) {
        const cfg = this.configs[typeId];
        if (cfg && cfg.name) return String(cfg.name).toUpperCase();
        return this.displayNames[typeId] || String(typeId).toUpperCase();
    }

    getConfig(typeId) {
        const id = String(typeId || 'player');
        if (!this.configs[id]) {
            const defaults = this.createDefaults();
            this.configs[id] = defaults[id] || this.makeShip({ id: id, name: id });
        }
        return this.configs[id];
    }

    setConfig(typeId, data) {
        const id = String(typeId);
        this.configs[id] = this.makeShip(Object.assign({}, this.getConfig(id), data, { id: id }));
        this.save();
        return this.configs[id];
    }
}
