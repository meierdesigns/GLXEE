"use strict";

/**
 * Central explosion preset registry.
 * Persisted in localStorage; referenced by enemies / obstacles via explosionId.
 */
class ExplosionConfigManager {
    constructor() {
        this.storageKey = 'vf_explosion_configs_v1';
        this.soundOptions = ['explosion', 'kill', 'hit', 'none'];
        this.configs = this.createDefaults();
        this.load();
    }

    createDefaults() {
        return {
            default: this.makePreset({
                id: 'default',
                name: 'Default',
                particleCount: 14,
                particleSpeed: 2.5,
                particleLife: 40,
                particleSize: 2,
                colors: ['var(--color-explosion)', 'var(--color-highlight)'],
                rings: 2,
                ringDurationMs: 600,
                ringScale: 1,
                sparkles: 6,
                sound: 'explosion',
                screenShake: 0
            }),
            ship_death: this.makePreset({
                id: 'ship_death',
                name: 'Ship Death',
                particleCount: 22,
                particleSpeed: 3.2,
                particleLife: 55,
                particleSize: 2.5,
                colors: ['var(--color-explosion)', 'var(--color-highlight)', 'var(--color-secondary)'],
                rings: 3,
                ringDurationMs: 2000,
                ringScale: 1.4,
                sparkles: 10,
                sound: 'kill',
                screenShake: 0.35
            }),
            small_pop: this.makePreset({
                id: 'small_pop',
                name: 'Small Pop',
                particleCount: 8,
                particleSpeed: 2,
                particleLife: 28,
                particleSize: 1.5,
                colors: ['var(--color-highlight)', 'var(--color-particle)'],
                rings: 1,
                ringDurationMs: 350,
                ringScale: 0.6,
                sparkles: 3,
                sound: 'hit',
                screenShake: 0
            }),
            asteroid_burst: this.makePreset({
                id: 'asteroid_burst',
                name: 'Asteroid Burst',
                particleCount: 16,
                particleSpeed: 2.8,
                particleLife: 45,
                particleSize: 2.2,
                colors: ['var(--color-explosion)', 'var(--color-warning)', 'var(--color-text)'],
                rings: 2,
                ringDurationMs: 700,
                ringScale: 1.1,
                sparkles: 8,
                sound: 'explosion',
                screenShake: 0.1
            }),
            crystal_shatter: this.makePreset({
                id: 'crystal_shatter',
                name: 'Crystal Shatter',
                particleCount: 20,
                particleSpeed: 3.5,
                particleLife: 50,
                particleSize: 2,
                colors: ['var(--color-highlight)', 'var(--color-accent)', 'var(--color-secondary)', '#aaffee'],
                rings: 3,
                ringDurationMs: 900,
                ringScale: 1.2,
                sparkles: 14,
                sound: 'explosion',
                screenShake: 0.15
            }),
            plasma_bloom: this.makePreset({
                id: 'plasma_bloom',
                name: 'Plasma Bloom',
                particleCount: 18,
                particleSpeed: 2.2,
                particleLife: 48,
                particleSize: 3,
                colors: ['var(--color-primary)', 'var(--color-explosion)', 'var(--color-highlight)'],
                rings: 2,
                ringDurationMs: 800,
                ringScale: 1.3,
                sparkles: 8,
                sound: 'explosion',
                screenShake: 0.2
            })
        };
    }

    makePreset(data) {
        const d = data || {};
        const colors = Array.isArray(d.colors) && d.colors.length
            ? d.colors.map(String)
            : ['var(--color-explosion)', 'var(--color-highlight)'];
        const sound = this.soundOptions.indexOf(d.sound) !== -1 ? d.sound : 'explosion';
        return {
            id: String(d.id || 'default'),
            name: String(d.name || d.id || 'Explosion'),
            particleCount: Math.max(0, Math.min(64, Math.round(Number(d.particleCount != null ? d.particleCount : 12)))),
            particleSpeed: Math.max(0.2, Math.min(12, Number(d.particleSpeed != null ? d.particleSpeed : 2.5))),
            particleLife: Math.max(5, Math.min(120, Math.round(Number(d.particleLife != null ? d.particleLife : 40)))),
            particleSize: Math.max(0.5, Math.min(8, Number(d.particleSize != null ? d.particleSize : 2))),
            colors: colors.slice(0, 8),
            rings: Math.max(0, Math.min(4, Math.round(Number(d.rings != null ? d.rings : 2)))),
            ringDurationMs: Math.max(100, Math.min(5000, Math.round(Number(d.ringDurationMs != null ? d.ringDurationMs : 600)))),
            ringScale: Math.max(0.2, Math.min(4, Number(d.ringScale != null ? d.ringScale : 1))),
            sparkles: Math.max(0, Math.min(32, Math.round(Number(d.sparkles != null ? d.sparkles : 6)))),
            sound: sound,
            screenShake: Math.max(0, Math.min(1, Number(d.screenShake != null ? d.screenShake : 0)))
        };
    }

    getIds() {
        return Object.keys(this.configs);
    }

    getPreset(id) {
        const key = String(id || 'default');
        if (this.configs[key]) return this.configs[key];
        if (!this.configs.default) {
            this.configs.default = this.createDefaults().default;
        }
        return this.configs.default;
    }

    getDisplayName(id) {
        const p = this.getPreset(id);
        return (p && p.name) || String(id || 'default');
    }

    setPreset(id, data) {
        const key = String(id || (data && data.id) || 'custom');
        this.configs[key] = this.makePreset(Object.assign({}, this.getPreset(key), data, { id: key }));
        this.save();
        return this.configs[key];
    }

    createPreset(id, data) {
        const key = String(id || ('fx_' + Date.now().toString(36))).replace(/\s+/g, '_').toLowerCase();
        if (this.configs[key]) return this.configs[key];
        this.configs[key] = this.makePreset(Object.assign({}, data || {}, { id: key }));
        this.save();
        return this.configs[key];
    }

    deletePreset(id) {
        const key = String(id || '');
        const builtins = this.createDefaults();
        if (!key || builtins[key]) return false;
        if (!this.configs[key]) return false;
        delete this.configs[key];
        this.save();
        return true;
    }

    resetToDefaults() {
        this.configs = this.createDefaults();
        this.save();
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('ExplosionConfigManager: save failed', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            const defaults = this.createDefaults();
            const merged = {};
            Object.keys(defaults).forEach((id) => {
                merged[id] = this.makePreset(Object.assign({}, defaults[id], parsed[id] || {}, { id: id }));
            });
            Object.keys(parsed).forEach((id) => {
                if (!merged[id]) {
                    merged[id] = this.makePreset(Object.assign({}, parsed[id], { id: id }));
                }
            });
            this.configs = merged;
        } catch (e) {
            console.warn('ExplosionConfigManager: load failed', e);
            this.configs = this.createDefaults();
        }
    }
}

const explosionConfigManager = new ExplosionConfigManager();
