"use strict";

/**
 * Runtime difficulty tuning. All values are multipliers unless noted.
 * Global preset + separate Champion / Side / Boss role scales.
 */
class DifficultyConfigManager {
    constructor() {
        this.storageKey = 'vf_difficulty_config_v2';
        this.profiles = {
            easy: {
                enemyDamageMul: 0.7, playerDamageMul: 1.15, enemyHealthMul: 0.85,
                enemySpeedMul: 0.9, enemyCountMul: 0.7, enemyMaxActive: 1,
                evasionMul: 0.55, predictionMul: 0.35, obstacleSpawnMul: 1.5,
                championDamageMul: 0.75, championHealthMul: 0.85, championSpeedMul: 0.9,
                championEvasionMul: 0.7,
                sideDamageMul: 0.55, sideHealthMul: 0.7, sideSpeedMul: 0.85,
                sideCountMul: 0.65,
                bossDamageMul: 0.8, bossHealthMul: 0.75, bossSpeedMul: 0.9,
                bossAttackRateMul: 0.85
            },
            normal: {
                enemyDamageMul: 1, playerDamageMul: 1, enemyHealthMul: 1,
                enemySpeedMul: 1, enemyCountMul: 1, enemyMaxActive: 3,
                evasionMul: 1, predictionMul: 1, obstacleSpawnMul: 1,
                championDamageMul: 1, championHealthMul: 1, championSpeedMul: 1,
                championEvasionMul: 1,
                sideDamageMul: 1, sideHealthMul: 1, sideSpeedMul: 1,
                sideCountMul: 1,
                bossDamageMul: 1, bossHealthMul: 1, bossSpeedMul: 1,
                bossAttackRateMul: 1
            },
            hard: {
                enemyDamageMul: 1.3, playerDamageMul: 0.9, enemyHealthMul: 1.2,
                enemySpeedMul: 1.12, enemyCountMul: 1.35, enemyMaxActive: 5,
                evasionMul: 1.35, predictionMul: 1.3, obstacleSpawnMul: 0.65,
                championDamageMul: 1.25, championHealthMul: 1.2, championSpeedMul: 1.15,
                championEvasionMul: 1.25,
                sideDamageMul: 1.2, sideHealthMul: 1.15, sideSpeedMul: 1.2,
                sideCountMul: 1.4,
                bossDamageMul: 1.45, bossHealthMul: 1.35, bossSpeedMul: 1.2,
                bossAttackRateMul: 1.35
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
        /** Boss attack kit per faction — fan / aimed / sweep feel distinct. */
        this.bossWeaponKits = {
            terran:  { fan: 'laser',      aimed: 'pierce',      sweep: 'rapid',  primary: 'laser' },
            kronax:  { fan: 'claw_beam',  aimed: 'spike_burst', sweep: 'plasma', primary: 'claw_beam' },
            voidborn:{ fan: 'wave',       aimed: 'nova',        sweep: 'ion',    primary: 'wave' },
            pirate:  { fan: 'spread',     aimed: 'burst',       sweep: 'rapid',  primary: 'spread' },
            machine: { fan: 'missile',    aimed: 'pierce',      sweep: 'ion',    primary: 'missile' }
        };
        this.defaults = JSON.parse(JSON.stringify(this.profiles));
        this.current = 'normal';
        this.load();
    }

    load() {
        try {
            // Prefer v2; migrate v1 once if present.
            let raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                const legacy = localStorage.getItem('vf_difficulty_config_v1');
                if (legacy) raw = legacy;
            }
            const saved = JSON.parse(raw || '{}');
            if (saved.current && this.profiles[saved.current]) this.current = saved.current;
            if (saved.profiles) Object.keys(saved.profiles).forEach((id) => {
                if (this.profiles[id]) {
                    this.profiles[id] = Object.assign({}, this.profiles[id], saved.profiles[id]);
                }
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

    normalizeRole(role) {
        const r = String(role || 'champion').toLowerCase();
        if (r === 'boss') return 'boss';
        if (r === 'side' || r === 'sideenemy' || r === 'escort') return 'side';
        return 'champion';
    }

    roleMul(profile, role, kind) {
        const p = profile || this.getProfile();
        const r = this.normalizeRole(role);
        const key = r + kind;
        const v = Number(p[key]);
        return Number.isFinite(v) ? v : 1;
    }

    /**
     * @param {string} faction
     * @param {number} tier
     * @param {object} [values]
     * @param {string} [role] champion | side | boss
     */
    resolveEnemy(faction, tier, values, role) {
        const base = this.getProfile();
        const factionCfg = this.factionProfiles[String(faction || '').toLowerCase()] || {};
        const tierCfg = this.tierProfiles[Math.max(1, Math.min(4, Math.round(Number(tier) || 1)))] || {};
        const source = values || {};
        const r = this.normalizeRole(role);
        const roleDmg = this.roleMul(base, r, 'DamageMul');
        const roleHp = this.roleMul(base, r, 'HealthMul');
        const roleSpd = this.roleMul(base, r, 'SpeedMul');
        const roleEva = r === 'champion'
            ? this.roleMul(base, 'champion', 'EvasionMul')
            : (r === 'boss' ? 0.55 : 1);
        return {
            role: r,
            damageMul: base.enemyDamageMul * (factionCfg.damage || 1) * (tierCfg.damage || 1) * roleDmg,
            healthMul: base.enemyHealthMul * (tierCfg.health || 1) * roleHp,
            speedMul: base.enemySpeedMul * roleSpd,
            evasionMul: base.evasionMul * (factionCfg.evasion || 1) * roleEva,
            predictionMul: base.predictionMul * (factionCfg.prediction || 1),
            attackRateMul: r === 'boss' ? this.roleMul(base, 'boss', 'AttackRateMul') : 1,
            sideCountMul: this.roleMul(base, 'side', 'CountMul'),
            evasionChance: Math.max(0, Math.min(1,
                Number(source.evasionChance != null ? source.evasionChance : 1)
                * base.evasionMul * (factionCfg.evasion || 1) * roleEva)),
            predictionSkill: Math.max(0, Math.min(1,
                Number(source.predictionSkill != null ? source.predictionSkill : 0)
                * base.predictionMul * (factionCfg.prediction || 1)))
        };
    }

    getBossWeaponKit(factionId) {
        const id = String(factionId || 'pirate').toLowerCase();
        return this.bossWeaponKits[id] || this.bossWeaponKits.pirate;
    }
}

const difficultyConfigManager = new DifficultyConfigManager();
window.difficultyConfigManager = difficultyConfigManager;
