"use strict";

// WeaponConfigManager methods, split from weapon-config.js.
extendClass(WeaponConfigManager, {
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
    },

    /** Keep projectiles tiny relative to ships (~30px). */
    clampBulletSize(width, height) {
        return {
            width: Math.max(1, Math.min(3, Math.round(Number(width) || 2))),
            height: Math.max(3, Math.min(8, Math.round(Number(height) || 7)))
        };
    },

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
    },

    getIds() {
        return Object.keys(this.configs);
    },

    getWeapon(id) {
        const key = String(id || 'laser');
        return this.configs[key] || this.configs.laser;
    },

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
    },
});
