"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
    resolveModelClass(shipId) {
        if (typeof shipConfigManager !== 'undefined') {
            const cfg = shipConfigManager.getConfig(shipId);
            if (cfg && cfg.modelClass) return cfg.modelClass;
        }
        return 'starfighter';
    },

    defaultLoadoutFromShip(shipId, factionId) {
        const cfg = (typeof shipConfigManager !== 'undefined')
            ? shipConfigManager.getConfig(shipId)
            : null;
        const shipWeapons = (cfg && cfg.availableWeapons) ? cfg.availableWeapons.slice() : ['laser'];
        // Each faction flies its own standard weapon; the hull's list follows.
        const faction = factionId || (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveActiveFaction
            ? factionShipStyles.resolveActiveFaction() : null);
        const factionWeapons = faction && typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionDefaultWeapons
            ? factionShipStyles.getFactionDefaultWeapons(faction) : [];
        const weapons = factionWeapons.concat(shipWeapons.filter((w) => factionWeapons.indexOf(w) === -1));
        const allAbilities = (cfg && cfg.abilities) ? cfg.abilities.slice() : [];
        const defenses = [];
        const abilities = [];
        const energy = Array.isArray(cfg && cfg.energy) ? cfg.energy.slice() : [];
        allAbilities.forEach((id) => {
            if (this.isEnergyId(id)) energy.push(id);
            else if (this.isDefenseId(id)) defenses.push(id);
            else abilities.push(id);
        });
        if (!energy.length) energy.push('energy_core');
        const modelClass = (cfg && cfg.modelClass) || 'starfighter';
        return this.clampLoadoutToCaps({
            weapons: weapons,
            defenses: defenses,
            abilities: abilities,
            energy: energy,
            fireMode: 'auto'
        }, shipId, modelClass);
    },

    setFireMode(shipId, fireMode) {
        const L = this.getLoadout(shipId);
        const wantCharge = this.normalizeFireMode(fireMode) === 'charge';
        const has = L.abilities.indexOf('charge_shot') !== -1;
        if (wantCharge && !has) {
            const owns = this.ownsChargePart('ability', 'charge_shot');
            if (!owns) return L;
            const check = this.canInstallModule(shipId, 'ability', 'charge_shot');
            if (!check.ok && !check.removing) return L;
            L.abilities.push('charge_shot');
        } else if (!wantCharge && has) {
            L.abilities.splice(L.abilities.indexOf('charge_shot'), 1);
        }
        L.fireMode = L.abilities.indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        return this.setLoadout(shipId, L);
    },

    ownsChargePart(kind, partId) {
        if (typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) return false;
        return profileManager.getPartCount(kind, partId) > 0
            || (kind === 'ability' && (profileManager.getDiscovered('abilities') || []).indexOf(partId) !== -1);
    },

    getFireMode(shipId) {
        const L = this.getLoadout(shipId);
        return (L.abilities || []).indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
    },

    getLoadout(shipId) {
        const id = String(shipId || '');
        if (!id) return this.emptyLoadout();
        const modelClass = this.resolveModelClass(id);
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const profile = profileManager.getActiveProfile();
            profileManager.ensureEconomyDefaults(profile);
            if (!profile.shipLoadouts || typeof profile.shipLoadouts !== 'object') {
                profile.shipLoadouts = {};
            }
            if (!profile.shipLoadouts[id]) {
                profile.shipLoadouts[id] = this.defaultLoadoutFromShip(id);
                profileManager.save();
            }
            const L = this.clampLoadoutToCaps(profile.shipLoadouts[id], id, modelClass);
            if (!L.energy || !L.energy.length) {
                L.energy = ['energy_core'];
                profile.shipLoadouts[id] = L;
                profileManager.save();
            }
            return L;
        }
        return this.defaultLoadoutFromShip(id);
    },

    setLoadout(shipId, loadout) {
        const id = String(shipId || '');
        const modelClass = this.resolveModelClass(id);
        const clamped = this.clampLoadoutToCaps(loadout, id, modelClass);
        if (!id || typeof profileManager === 'undefined' || !profileManager.hasActiveProfile()) {
            return clamped;
        }
        const profile = profileManager.getActiveProfile();
        profileManager.ensureEconomyDefaults(profile);
        if (!profile.shipLoadouts || typeof profile.shipLoadouts !== 'object') {
            profile.shipLoadouts = {};
        }
        profile.shipLoadouts[id] = clamped;
        profileManager.save();
        return profile.shipLoadouts[id];
    },

    moduleCount(loadout) {
        const L = this.normalizeLoadout(loadout);
        return L.weapons.length + L.defenses.length + L.abilities.length + L.energy.length;
    },

    /**
     * Scaled component footprint in layout units. displayScale/lengthScale from
     * spriteMeta expand the base slot; one source pixel maps to multiple cells.
     */
    resolveComponentDim(id, kind, base, evenSizeFn) {
        const evenSize = evenSizeFn || ((n) => {
            let v = Math.max(2, Math.round(Number(n) || 0));
            if (v % 2) v -= 1;
            return Math.max(2, v);
        });
        const slot = Math.max(2, Number(base) || this.moduleSize);
        let w = slot;
        let h = slot;
        if (typeof spriteMeta !== 'undefined' && spriteMeta.getDisplayScale) {
            const mountKey = this.resolveModuleShipSprite
                ? this.resolveModuleShipSprite({ kind: kind, id: id })
                : ('mount_' + id);
            const scale = spriteMeta.getDisplayScale(mountKey);
            const length = spriteMeta.getLengthScale
                ? spriteMeta.getLengthScale(mountKey)
                : 1;
            w = evenSize(slot * scale);
            h = evenSize(slot * scale * length);
        }
        return { w: Math.max(2, w), h: Math.max(2, h) };
    },

    /**
     * Dock anchor for a module on a segment: keep contact with the hull root
     * while the module frame grows outward/up/down.
     */
    dockModuleOnSegment(segment, dim, face) {
        if (!segment || !dim) {
            return { x: 0, y: 0 };
        }
        const w = dim.w;
        const h = dim.h;
        let x = segment.x + Math.floor((segment.width - w) / 2);
        let y = segment.y + Math.floor((segment.height - h) / 2);
        if (face === 'left') {
            x = segment.x + segment.width - w;
        } else if (face === 'right') {
            x = segment.x;
        } else if (face === 'up') {
            y = segment.y + Math.max(0, segment.height - h);
            x = segment.x + Math.floor((segment.width - w) / 2);
        } else if (face === 'down') {
            y = segment.y;
            x = segment.x + Math.floor((segment.width - w) / 2);
        } else if (face === 'center') {
            // Horizontal centerline only — keep the caller's vertical stack.
            x = segment.x + Math.floor((segment.width - w) / 2);
            y = null;
        }
        return { x: x, y: y };
    },

    /**
     * Place modules relative to segmented hull (front / center / back / wings).
     * Modules may attach, replace a zone, insert into the center stack, or expand.
     */
    buildLayout(coreWidth, coreHeight, loadout) {
        const ctx = this.createLayoutContext(coreWidth, coreHeight, loadout);
        this.placeLayoutModules(ctx);
        const { segments, wingPanels } = this.buildLayoutSegments(ctx);
        this.dockLayoutParts(ctx, segments);
        this.applyLayoutModuleScales(ctx.parts, segments);
        return this.finalizeLayout(ctx, segments, wingPanels);
    },
});
