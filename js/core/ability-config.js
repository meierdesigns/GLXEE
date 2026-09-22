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
            }),
            balanced_combat: this.makeAbility({
                id: 'balanced_combat',
                name: 'Balanced Combat',
                description: 'Versatile combat system with balanced offense and defense',
                icon: 'ability_balanced_combat',
                cluster: 'combat',
                type: 'passive',
                tier: 1,
                uiDescription: 'Balanced performance across combat metrics'
            }),
            boss_ai: this.makeAbility({
                id: 'boss_ai',
                name: 'Boss AI',
                description: 'Advanced tactical combat routines',
                icon: 'ability_boss_ai',
                cluster: 'other',
                type: 'passive',
                tier: 3,
                uiDescription: 'Intelligent enemy behavior patterns'
            }),
            charge_shot: this.makeAbility({
                id: 'charge_shot',
                name: 'Charge Shot',
                description: 'Hold Space to charge; release for a stronger shot',
                icon: 'ability_powerful_cannon',
                cluster: 'offense',
                type: 'passive',
                tier: 1,
                uiDescription: 'Space charge fire mode',
                faction: 'terran'
            }),
            overcharge_core: this.makeAbility({
                id: 'overcharge_core',
                name: 'Overcharge Core',
                description: 'Faster, stronger weapon charge buildup',
                icon: 'ability_devastating_cannon',
                cluster: 'offense',
                type: 'passive',
                tier: 3,
                uiDescription: 'Higher charge multiplier and faster fill',
                faction: 'terran'
            }),
            charge_shield_sync: this.makeAbility({
                id: 'charge_shield_sync',
                name: 'Charge Shield Sync',
                description: 'Weapon charge fills shields; hits dump charge',
                icon: 'ability_energy_shield',
                cluster: 'defense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Charge feeds shield capacity',
                faction: 'terran'
            }),
            shield_divert: this.makeAbility({
                id: 'shield_divert',
                name: 'Shield Divert',
                description: 'Drop shields while charging for a stronger shot',
                icon: 'ability_adaptive_shield',
                cluster: 'defense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Trade shields for charged shot power',
                faction: 'terran'
            }),
            charge_drive: this.makeAbility({
                id: 'charge_drive',
                name: 'Charge Drive',
                description: 'Hold Shift for speed boost (uses energy)',
                icon: 'ability_high_speed',
                cluster: 'mobility',
                type: 'passive',
                tier: 1,
                uiDescription: 'Shift thruster boost',
                faction: 'terran'
            }),
            drive_charge_dampen: this.makeAbility({
                id: 'drive_charge_dampen',
                name: 'Drive Charge Dampen',
                description: 'Less energy drain while boosting',
                icon: 'ability_agile_maneuver',
                cluster: 'mobility',
                type: 'passive',
                tier: 2,
                uiDescription: 'Lower boost energy cost',
                faction: 'terran'
            }),
            carapace_armor: this.makeAbility({
                id: 'carapace_armor',
                name: 'Carapace Armor',
                description: 'Kronax chitin plating for Andromeda hulls',
                icon: 'ability_heavy_armor',
                cluster: 'defense',
                type: 'passive',
                tier: 1,
                uiDescription: 'Kronax armor rating',
                faction: 'kronax'
            }),
            reflex_shell: this.makeAbility({
                id: 'reflex_shell',
                name: 'Reflex Shell',
                description: 'Reactive Kronax barrier that flares on impact',
                icon: 'ability_adaptive_shield',
                cluster: 'defense',
                type: 'passive',
                tier: 2,
                uiDescription: 'Reactive Kronax shield',
                faction: 'kronax'
            }),
            spike_drive: this.makeAbility({
                id: 'spike_drive',
                name: 'Spike Drive',
                description: 'Kronax burst thrusters for ambush runs',
                icon: 'ability_high_speed',
                cluster: 'mobility',
                type: 'passive',
                tier: 1,
                uiDescription: 'Kronax boost profile',
                faction: 'kronax'
            })
        };
    }

    makeAbility(data) {
        const id = String(data.id || 'ability');
        return {
            id: id,
            name: data.name || this.formatName(id),
            description: data.description || '',
            icon: data.icon || ('ability_' + id),
            mountSprite: data.mountSprite || ('mount_' + id),
            cluster: data.cluster || 'other',
            type: data.type || 'passive',
            tier: data.tier != null ? Math.round(Number(data.tier)) : 1,
            uiDescription: data.uiDescription || data.description || '',
            custom: !!data.custom,
            faction: data.faction ? String(data.faction).toLowerCase() : null
        };
    }

    resolveIconHtml(icon, size, className, tipLabel) {
        const key = String(icon || '');
        const px = size || 16;
        const cls = className || 'cv-ability-icon-img';
        if (key && typeof iconRenderer !== 'undefined') {
            const html = iconRenderer.imgHtml(key, px, cls, undefined, tipLabel);
            if (html) return html;
        }
        const label = tipLabel != null
            ? String(tipLabel)
            : (typeof iconRenderer !== 'undefined' && iconRenderer.labelFor
                ? iconRenderer.labelFor(key)
                : key);
        const tip = label
            ? ` class="${cls} cv-ability-icon-text ui-icon-tip" data-ui-tip="${this.escapeHtml(label)}"`
            : ` class="${cls} cv-ability-icon-text"`;
        return `<span${tip} data-ag-key="${this.escapeHtml(key)}">${this.escapeHtml(key || '◆')}</span>`;
    }

    getIconHtml(id, size, className) {
        const tip = this.getDisplayName(id);
        return this.resolveIconHtml(this.getAbility(id).icon, size, className, tip);
    }

    formatName(id) {
        return String(id).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    getIds() {
        return Object.keys(this.configs);
    }

    getIdsByCluster() {
        const grouped = {};
        this.clusterOrder.forEach((c) => { grouped[c.id] = []; });
        this.getIds().forEach((id) => {
            const a = this.configs[id];
            const key = (a && a.cluster) || 'other';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(id);
        });
        return grouped;
    }

    getClusterLabel(clusterId) {
        const found = this.clusterOrder.find((c) => c.id === clusterId);
        return found ? found.label : String(clusterId || 'OTHER').toUpperCase();
    }

    getAbility(id) {
        const key = String(id || '');
        if (!this.configs[key]) {
            this.configs[key] = this.makeAbility({ id: key });
        }
        return this.configs[key];
    }

    getMeta(id) {
        const a = this.getAbility(id);
        return { icon: a.icon, cluster: a.cluster, name: a.name };
    }

    getDisplayName(id) {
        return this.getAbility(id).name;
    }

    getIcon(id) {
        return this.getAbility(id).icon;
    }

    formatAbilityChipsHtml(ids) {
        if (!ids || !ids.length) return '—';
        return ids.map((id) => {
            const a = this.getAbility(id);
            const name = this.escapeHtml(a.name);
            const iconHtml = this.resolveIconHtml(a.icon, 14, 'cv-ability-icon-img');
            return `<span class="cv-ability-chip" title="${name}"><span class="cv-ability-icon">${iconHtml}</span>${name}</span>`;
        }).join('');
    }

    escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    setAbility(id, data) {
        const key = String(id);
        this.configs[key] = this.makeAbility(Object.assign({}, this.getAbility(key), data, { id: key }));
        this.save();
        return this.configs[key];
    }

    createAbility(partial) {
        const base = partial && partial.id
            ? String(partial.id).replace(/\s+/g, '_').toLowerCase()
            : 'custom_ability';
        let id = base;
        let n = 1;
        while (this.configs[id]) {
            id = base + '_' + n;
            n += 1;
        }
        const ability = this.makeAbility(Object.assign({
            id: id,
            name: 'New Ability',
            icon: '◆',
            cluster: 'other',
            type: 'passive',
            tier: 1,
            custom: true
        }, partial || {}, { id: id, custom: true }));
        this.configs[id] = ability;
        this.save();
        return ability;
    }

    deleteAbility(id) {
        const key = String(id);
        const a = this.configs[key];
        if (!a || !a.custom) return false;
        delete this.configs[key];
        this.save();
        return true;
    }

    resetAbility(id) {
        const defaults = this.createDefaults();
        const key = String(id);
        if (defaults[key]) {
            this.configs[key] = defaults[key];
            this.save();
            return this.configs[key];
        }
        return this.getAbility(key);
    }

    resetAll() {
        this.configs = this.createDefaults();
        this.save();
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('AbilityConfigManager: save failed', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const defaults = this.createDefaults();
            Object.keys(defaults).forEach((id) => {
                if (parsed[id]) {
                    this.configs[id] = this.makeAbility(Object.assign({}, defaults[id], parsed[id], { id: id }));
                }
            });
            Object.keys(parsed).forEach((id) => {
                if (!this.configs[id]) {
                    this.configs[id] = this.makeAbility(Object.assign({}, parsed[id], { id: id, custom: true }));
                }
            });
        } catch (e) {
            console.warn('AbilityConfigManager: load failed', e);
        }
    }
}

const abilityConfigManager = new AbilityConfigManager();
