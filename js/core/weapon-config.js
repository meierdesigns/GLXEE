"use strict";

/**
 * Shared shot-type / weapon registry.
 */
class WeaponConfigManager {
    constructor() {
        this.configs = this.createDefaults();
    }

    createDefaults() {
        return {
            laser: this.makeWeapon({
                id: 'laser',
                name: 'Laser',
                description: 'Focused single beam',
                iconKey: 'shotLaser',
                damage: 10,
                speed: 12,
                cooldown: 250,
                width: 2,
                height: 8,
                lightRadius: 18,
                lightIntensity: 0.85,
                bulletType: 'laser_beam',
                faction: null
            }),
            spread: this.makeWeapon({
                id: 'spread',
                name: 'Spread',
                description: 'Fan of projectiles',
                iconKey: 'shotSpread',
                damage: 8,
                speed: 10,
                cooldown: 400,
                width: 2,
                height: 7,
                bulletCount: 3,
                spreadAngle: 0.3,
                lightRadius: 14,
                lightIntensity: 0.7,
                bulletType: 'spread_beam',
                faction: 'terran'
            }),
            rapid: this.makeWeapon({
                id: 'rapid',
                name: 'Rapid',
                description: 'Twin rapid bolts',
                iconKey: 'shotRapid',
                damage: 6,
                speed: 14,
                cooldown: 120,
                energyCost: 10,
                width: 2,
                height: 6,
                bulletCount: 2,
                lightRadius: 12,
                lightIntensity: 0.65,
                bulletType: 'rapid_beam',
                faction: 'terran'
            }),
            plasma: this.makeWeapon({
                id: 'plasma',
                name: 'Plasma',
                description: 'Heavy energy orb',
                iconKey: 'shotPlasma',
                damage: 16,
                speed: 5,
                cooldown: 700,
                width: 4,
                height: 8,
                lightRadius: 22,
                lightIntensity: 0.9,
                bulletType: 'plasma_beam',
                faction: 'terran'
            }),
            missile: this.makeWeapon({
                id: 'missile',
                name: 'Missile',
                description: 'Slow high-damage rocket',
                iconKey: 'shotMissile',
                damage: 20,
                speed: 4,
                cooldown: 900,
                width: 3,
                height: 8,
                lightRadius: 16,
                lightIntensity: 0.75,
                bulletType: 'missile_shot',
                faction: 'terran'
            }),
            ion: this.makeWeapon({
                id: 'ion',
                name: 'Ion',
                description: 'Triple ion stream',
                iconKey: 'shotIon',
                damage: 7,
                speed: 11,
                cooldown: 320,
                width: 3,
                height: 10,
                bulletCount: 3,
                bulletSpacing: 5,
                lightRadius: 50,
                lightIntensity: 1.0,
                bulletType: 'ion_beam',
                faction: 'kronax'
            }),
            wave: this.makeWeapon({
                id: 'wave',
                name: 'Wave',
                description: 'Wavering energy arc',
                iconKey: 'shotWave',
                damage: 9,
                speed: 8,
                cooldown: 350,
                width: 4,
                height: 10,
                waveAmp: 1.2,
                lightRadius: 65,
                lightIntensity: 1.1,
                bulletType: 'wave_beam',
                faction: 'kronax'
            }),
            burst: this.makeWeapon({
                id: 'burst',
                name: 'Burst',
                description: 'Short-range shotgun burst',
                iconKey: 'shotBurst',
                damage: 5,
                speed: 9,
                cooldown: 500,
                width: 3,
                height: 8,
                bulletCount: 5,
                spreadAngle: 0.45,
                lightRadius: 40,
                lightIntensity: 0.85,
                bulletType: 'burst_shot',
                faction: 'terran'
            }),
            pierce: this.makeWeapon({
                id: 'pierce',
                name: 'Pierce',
                description: 'Thin piercing lance',
                iconKey: 'shotPierce',
                damage: 14,
                speed: 16,
                cooldown: 380,
                width: 2,
                height: 14,
                pierce: true,
                lightRadius: 70,
                lightIntensity: 1.3,
                bulletType: 'pierce_beam',
                faction: 'terran'
            }),
            nova: this.makeWeapon({
                id: 'nova',
                name: 'Nova',
                description: 'Radial nova volley',
                iconKey: 'shotNova',
                damage: 6,
                speed: 7,
                cooldown: 1100,
                width: 4,
                height: 8,
                bulletCount: 5,
                spreadAngle: 0.55,
                lightRadius: 90,
                lightIntensity: 1.4,
                bulletType: 'nova_shot',
                faction: 'terran'
            }),
            claw_beam: this.makeWeapon({
                id: 'claw_beam',
                name: 'Claw Beam',
                description: 'Kronax twin claw lances',
                iconKey: 'shotPierce',
                damage: 11,
                speed: 13,
                cooldown: 220,
                width: 3,
                height: 14,
                bulletCount: 2,
                bulletSpacing: 6,
                lightRadius: 55,
                lightIntensity: 1.15,
                bulletType: 'pierce_beam',
                faction: 'kronax'
            }),
            spike_burst: this.makeWeapon({
                id: 'spike_burst',
                name: 'Spike Burst',
                description: 'Kronax spike shotgun cluster',
                iconKey: 'shotBurst',
                damage: 6,
                speed: 10,
                cooldown: 480,
                width: 3,
                height: 9,
                bulletCount: 6,
                spreadAngle: 0.5,
                lightRadius: 42,
                lightIntensity: 0.95,
                bulletType: 'burst_shot',
                faction: 'kronax'
            }),
            laser_twin: this.makeWeapon({
                id: 'laser_twin',
                name: 'Twin Laser',
                description: 'Compact twin-linked hardpoint. Lower damage per bolt, faster fire rate.',
                iconKey: 'shotLaser',
                damage: 6,
                speed: 13,
                cooldown: 170,
                width: 2,
                height: 7,
                bulletCount: 2,
                bulletSpacing: 4,
                lightRadius: 16,
                lightIntensity: 0.8,
                bulletType: 'laser_beam',
                faction: null,
                visual: 'hardpoint_twin'
            }),
            railgun: this.makeWeapon({
                id: 'railgun',
                name: 'Railgun',
                description: 'Heavy single-shot rail cannon. Slow but devastating, needs a reinforced mount.',
                iconKey: 'shotPierce',
                damage: 32,
                speed: 18,
                cooldown: 1200,
                width: 2,
                height: 16,
                pierce: true,
                lightRadius: 24,
                lightIntensity: 1.2,
                bulletType: 'pierce_beam',
                faction: null,
                visual: 'hardpoint_heavy',
                slotMode: 'expand',
                slotZone: 'front',
                slotSize: 3
            })
        };
    }

    makeWeapon(data) {
        const id = String(data.id || 'laser');
        const dims = this.clampBulletSize(
            data.width != null ? Number(data.width) : 2,
            data.height != null ? Number(data.height) : 8
        );
        const lightRadius = Math.max(8, Math.min(28, data.lightRadius != null ? Number(data.lightRadius) : 16));
        return {
            id: id,
            name: data.name || id.toUpperCase(),
            description: data.description || '',
            iconKey: data.iconKey || ('shot' + id.charAt(0).toUpperCase() + id.slice(1)),
            mountSprite: data.mountSprite || ('mount_' + id),
            damage: data.damage != null ? Number(data.damage) : 10,
            speed: data.speed != null ? Number(data.speed) : 10,
            cooldown: data.cooldown != null ? Math.round(Number(data.cooldown)) : 300,
            energyCost: data.energyCost != null ? Math.max(0, Number(data.energyCost)) : 4,
            width: dims.width,
            height: dims.height,
            bulletCount: data.bulletCount != null ? Math.round(Number(data.bulletCount)) : 1,
            spreadAngle: data.spreadAngle != null ? Number(data.spreadAngle) : 0,
            bulletSpacing: data.bulletSpacing != null ? Number(data.bulletSpacing) : 4,
            waveAmp: data.waveAmp != null ? Number(data.waveAmp) : 0,
            pierce: !!data.pierce,
            lightRadius: lightRadius,
            lightIntensity: data.lightIntensity != null ? Math.min(1, Number(data.lightIntensity)) : 0.75,
            lightColor: data.lightColor || '#808080',
            bulletType: data.bulletType || (id + '_beam'),
            soundEffect: data.soundEffect || 'laser-shoot',
            faction: data.faction ? String(data.faction).toLowerCase() : null,
            // Optional per-id visual/slot overrides — when set, these take
            // priority over the generic role-based lookups in
            // ship-asset-loader.js (visual) and ship-loadout.js (slotMode),
            // so a weapon id can have its own distinct icon and hull footprint.
            visual: data.visual || null,
            slotMode: data.slotMode || null,
            slotZone: data.slotZone || null,
            slotSize: data.slotSize != null ? Number(data.slotSize) : null
        };
    }

    /** Keep projectiles tiny relative to ships (~30px). */
    clampBulletSize(width, height) {
        return {
            width: Math.max(1, Math.min(3, Math.round(Number(width) || 2))),
            height: Math.max(3, Math.min(8, Math.round(Number(height) || 7)))
        };
    }

    clampWeaponShot(cfg) {
        if (!cfg || typeof cfg !== 'object') return cfg;
        const dims = this.clampBulletSize(cfg.width, cfg.height);
        cfg.width = dims.width;
        cfg.height = dims.height;
        if (cfg.damage != null) {
            cfg.damage = Math.max(1, Math.min(28, Math.round(Number(cfg.damage) || 1)));
        }
        if (cfg.lightRadius != null) {
            cfg.lightRadius = Math.max(8, Math.min(28, Number(cfg.lightRadius) || 16));
        }
        return cfg;
    }

    getIds() {
        return Object.keys(this.configs);
    }

    getWeapon(id) {
        const key = String(id || 'laser');
        return this.configs[key] || this.configs.laser;
    }

    getDefaultsForShip(weaponId) {
        const w = this.getWeapon(weaponId);
        const cfg = {
            damage: w.damage,
            speed: w.speed,
            cooldown: w.cooldown,
            energyCost: w.energyCost,
            width: w.width,
            height: w.height
        };
        if (w.bulletCount > 1) cfg.bulletCount = w.bulletCount;
        if (w.spreadAngle) cfg.spreadAngle = w.spreadAngle;
        if (w.bulletSpacing) cfg.bulletSpacing = w.bulletSpacing;
        if (w.waveAmp) cfg.waveAmp = w.waveAmp;
        if (w.pierce) cfg.pierce = true;
        return this.clampWeaponShot(cfg);
    }
}

const weaponConfigManager = new WeaponConfigManager();
window.weaponConfigManager = weaponConfigManager;
