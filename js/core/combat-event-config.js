"use strict";

/**
 * Combat-event archetypes for announcements + Explorations archive.
 * Runtime combatEvents reference these via `role` (and optional catalogId).
 */
class CombatEventConfigManager {
    constructor() {
        this.configs = this.createDefaults();
        this.defaultAnnounceMs = 1800;
    }

    createDefaults() {
        return {
            repair: this.makeEvent({
                id: 'repair',
                name: 'Repair Drones',
                shortName: 'REPAIR',
                description: 'Support craft that restore the champion hull while in range.',
                announce: 'INCOMING: REPAIR DRONES',
                counter: 'Destroy the drones to stop the heal.',
                role: 'repair',
                announceMs: 2000,
                accent: '#6fbf73'
            }),
            shieldBattery: this.makeEvent({
                id: 'shieldBattery',
                name: 'Shield Battery',
                shortName: 'SHIELD BAT',
                description: 'Escorts that recharge the champion energy shield.',
                announce: 'INCOMING: SHIELD BATTERY',
                counter: 'Destroy the battery craft to cut shield regen.',
                role: 'shieldBattery',
                announceMs: 1800,
                accent: '#6aa8e8'
            }),
            gunner: this.makeEvent({
                id: 'gunner',
                name: 'Gunner Wing',
                shortName: 'GUNNERS',
                description: 'Escort fighters that open fire on the player.',
                announce: 'INCOMING: GUNNER WING',
                counter: 'Shoot them down before they overwhelm you.',
                role: 'gunner',
                announceMs: 1600,
                accent: '#e09060'
            }),
            blocker: this.makeEvent({
                id: 'blocker',
                name: 'Blocker Screen',
                shortName: 'BLOCKERS',
                description: 'Heavy escorts that sit in front of the champion and soak hits.',
                announce: 'INCOMING: BLOCKER SCREEN',
                counter: 'Burn through the blockers to reach the champion.',
                role: 'blocker',
                announceMs: 1700,
                accent: '#a0a8b8'
            }),
            bomber: this.makeEvent({
                id: 'bomber',
                name: 'Kamikaze Bombers',
                shortName: 'BOMBERS',
                description: 'Dive craft that rush the player and detonate on contact.',
                announce: 'WARNING: BOMBERS INBOUND',
                counter: 'Shoot them before they reach you.',
                role: 'bomber',
                announceMs: 1500,
                accent: '#e06060'
            }),
            jammer: this.makeEvent({
                id: 'jammer',
                name: 'Signal Jammer',
                shortName: 'JAMMER',
                description: 'Electronic warfare craft that slow your rate of fire.',
                announce: 'SIGNAL JAM DETECTED',
                counter: 'Destroy the jammer to restore fire rate.',
                role: 'jammer',
                announceMs: 1800,
                accent: '#c080e0'
            }),
            tether: this.makeEvent({
                id: 'tether',
                name: 'Gravity Tether',
                shortName: 'TETHER',
                description: 'Support craft that drag your movement while they live.',
                announce: 'GRAVITY TETHER LOCK',
                counter: 'Destroy the tether to regain speed.',
                role: 'tether',
                announceMs: 1800,
                accent: '#70c0c8'
            }),
            assault: this.makeEvent({
                id: 'assault',
                name: 'Reinforcement Call',
                shortName: 'REINFORCE',
                description: 'Standard escort or flyby craft summoned as backup.',
                announce: 'INCOMING: REINFORCEMENTS',
                counter: 'Clear the extras or ignore flybys and focus the champion.',
                role: 'assault',
                announceMs: 1600,
                accent: '#c0c0c0'
            })
        };
    }

    makeEvent(data) {
        const d = data || {};
        return {
            id: String(d.id || 'assault'),
            name: d.name || d.id || 'Combat Event',
            shortName: d.shortName || String(d.name || d.id || 'EVENT').toUpperCase(),
            description: d.description || '',
            announce: d.announce || ('INCOMING: ' + String(d.name || d.id || 'EVENT').toUpperCase()),
            counter: d.counter || '',
            role: d.role || d.id || 'assault',
            announceMs: Math.max(400, Math.round(Number(d.announceMs != null ? d.announceMs : 1800))),
            accent: d.accent || '#c0c0c0'
        };
    }

    getTypeIds() {
        return Object.keys(this.configs);
    }

    getConfig(id) {
        const key = String(id || 'assault');
        if (this.configs[key]) return this.configs[key];
        return this.configs.assault;
    }

    catalogIdForSpec(spec) {
        if (!spec) return 'assault';
        if (spec.catalogId && this.configs[spec.catalogId]) return spec.catalogId;
        const role = spec.role || 'assault';
        if (this.configs[role]) return role;
        return 'assault';
    }

    getAnnounceText(spec) {
        if (spec && spec.announce) return String(spec.announce);
        const cfg = this.getConfig(this.catalogIdForSpec(spec));
        return cfg.announce;
    }

    getAnnounceMs(spec) {
        if (spec && spec.announceMs != null) {
            return Math.max(400, Math.round(Number(spec.announceMs)));
        }
        const cfg = this.getConfig(this.catalogIdForSpec(spec));
        return cfg.announceMs || this.defaultAnnounceMs;
    }

    getList() {
        return this.getTypeIds().map((id) => this.getConfig(id));
    }
}

const combatEventConfigManager = new CombatEventConfigManager();
