"use strict";

/**
 * Runtime difficulty tuning. All values are multipliers unless noted.
 * The profile can be changed by SettingsManager or by dev/configuration tools.
 */
class DifficultyConfigManager {
    constructor() {
        this.storageKey = 'vf_difficulty_config_v1';
        this.profiles = {
            easy: {
                enemyDamageMul: 0.7, playerDamageMul: 1.15, enemyHealthMul: 0.85,
                enemySpeedMul: 0.9, enemyCountMul: 0.7, enemyMaxActive: 1,
                evasionMul: 0.55, predictionMul: 0.35, obstacleSpawnMul: 1.5
            },
            normal: {
                enemyDamageMul: 1, playerDamageMul: 1, enemyHealthMul: 1,
                enemySpeedMul: 1, enemyCountMul: 1, enemyMaxActive: 3,
                evasionMul: 1, predictionMul: 1, obstacleSpawnMul: 1
            },
            hard: {
                enemyDamageMul: 1.3, playerDamageMul: 0.9, enemyHealthMul: 1.2,
                enemySpeedMul: 1.12, enemyCountMul: 1.35, enemyMaxActive: 5,
                evasionMul: 1.35, predictionMul: 1.3, obstacleSpawnMul: 0.65
            }
        };
        this.factionProfiles = {
            terran: { evasion: 0.8, prediction: 0.75, damage: 1 },
            pirate: { evasion: 0.9, prediction: 0.8, damage: 1.05 },
            kronax: { evasion: 1.3, prediction: 1.25, damage: 1.05 },
            machine: { evasion: 0.95, prediction: 1.45, damage: 1.2 },
            voidborn: { evasion: 1.1, prediction: 1.15, damage: 1.25 }
        };
        this.tierProfiles = {
            1: { evasion: 0.8, prediction: 0.75, damage: 0.85, health: 0.9 },
            2: { evasion: 1, prediction: 1, damage: 1, health: 1 },
            3: { evasion: 1.2, prediction: 1.2, damage: 1.15, health: 1.12 },
            4: { evasion: 1.4, prediction: 1.4, damage: 1.3, health: 1.25 }
        };
        this.defaults = JSON.parse(JSON.stringify(this.profiles));
        this.current = 'normal';
        this.load();
    }

    load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            if (saved.current && this.profiles[saved.current]) this.current = saved.current;
            if (saved.profiles) Object.keys(saved.profiles).forEach((id) => {
                if (this.profiles[id]) this.profiles[id] = Object.assign({}, this.profiles[id], saved.profiles[id]);
            });
        } catch (e) { /* defaults are valid */ }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                current: this.current, profiles: this.profiles
            }));
        } catch (e) { /* localStorage is optional */ }
    }

    setDifficulty(id) {
        const key = String(id || '').toLowerCase();
        if (!this.profiles[key]) return this.getProfile();
        this.current = key;
        this.save();
        return this.getProfile();
    }

    getProfile(id) {
        return Object.assign({}, this.profiles[String(id || this.current).toLowerCase()] || this.profiles.normal);
    }

    setProfile(id, values) {
        const key = String(id || '').toLowerCase();
        if (!this.profiles[key]) return this.getProfile();
        this.profiles[key] = Object.assign({}, this.profiles[key], values || {});
        this.save();
        return this.getProfile(key);
    }

    resetProfile(id) {
        const key = String(id || '').toLowerCase();
        if (this.defaults[key]) this.profiles[key] = Object.assign({}, this.defaults[key]);
        this.save();
        return this.getProfile(key);
    }

    resolveEnemy(faction, tier, values) {
        const base = this.getProfile();
        const factionCfg = this.factionProfiles[String(faction || '').toLowerCase()] || {};
        const tierCfg = this.tierProfiles[Math.max(1, Math.min(4, Math.round(Number(tier) || 1)))] || {};
        const source = values || {};
        return {
            damageMul: base.enemyDamageMul * (factionCfg.damage || 1) * (tierCfg.damage || 1),
            healthMul: base.enemyHealthMul * (tierCfg.health || 1),
            speedMul: base.enemySpeedMul,
            evasionMul: base.evasionMul * (factionCfg.evasion || 1),
            predictionMul: base.predictionMul * (factionCfg.prediction || 1),
            evasionChance: Math.max(0, Math.min(1, Number(source.evasionChance != null ? source.evasionChance : 1) * base.evasionMul * (factionCfg.evasion || 1))),
            predictionSkill: Math.max(0, Math.min(1, Number(source.predictionSkill != null ? source.predictionSkill : 0) * base.predictionMul * (factionCfg.prediction || 1)))
        };
    }
}

const difficultyConfigManager = new DifficultyConfigManager();
window.difficultyConfigManager = difficultyConfigManager;
