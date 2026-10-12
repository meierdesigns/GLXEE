"use strict";

// EnemyManager methods: planet difficulty curve and boss fights
// (phases, attack patterns, escort calls, HP bar).

/** Per planet tier (EASY .. NIGHTMARE): early planets forgiving, late ones brutal. */
const PLANET_TIER_MODS = [
    // evasion: dodge chance / speed multiplier (early planets barely dodge).
    { health: 0.65, speed: 0.85, damage: 0.65, spawn: 1.35, boss: 0.85, evasion: 0.25 },
    { health: 0.9,  speed: 0.95, damage: 0.85, spawn: 1.1,  boss: 0.95, evasion: 0.45 },
    { health: 1.15, speed: 1.05, damage: 1.05, spawn: 0.95, boss: 1.05, evasion: 0.7 },
    { health: 1.45, speed: 1.15, damage: 1.25, spawn: 0.82, boss: 1.15, evasion: 0.9 },
    { health: 1.8,  speed: 1.25, damage: 1.45, spawn: 0.7,  boss: 1.25, evasion: 1 }
];
const PLANET_TIERS = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'];
const BOSS_SIZE_MUL = 1.6;
const BOSS_MAX_BULLETS = 40;

/** Visual / motion profile per weapon family for boss pattern shots. */
const BOSS_WEAPON_SHOT = {
    laser:      { type: 'enemy_laser',  w: 2.5, h: 9,  light: 16, spd: 1 },
    laser_twin: { type: 'enemy_laser',  w: 2,   h: 8,  light: 14, spd: 1.05 },
    claw_beam:  { type: 'enemy_pierce', w: 3,   h: 12, light: 20, spd: 1.15 },
    pierce:     { type: 'enemy_pierce', w: 2,   h: 14, light: 18, spd: 1.35 },
    rapid:      { type: 'enemy_rapid',  w: 2,   h: 7,  light: 12, spd: 1.25 },
    burst:      { type: 'enemy_spread', w: 3,   h: 7,  light: 14, spd: 0.95 },
    spread:     { type: 'enemy_spread', w: 2.5, h: 7,  light: 14, spd: 1 },
    wave:       { type: 'enemy_wave',   w: 4,   h: 6,  light: 22, spd: 0.85 },
    plasma:     { type: 'enemy_plasma', w: 5,   h: 8,  light: 24, spd: 0.75 },
    ion:        { type: 'enemy_rapid',  w: 2.5, h: 8,  light: 18, spd: 1.1 },
    missile:    { type: 'enemy_plasma', w: 4,   h: 10, light: 20, spd: 0.65 },
    nova:       { type: 'enemy_spread', w: 3,   h: 6,  light: 16, spd: 0.9 },
    spike_burst:{ type: 'enemy_spread', w: 2.5, h: 8,  light: 15, spd: 1 }
};

function planetTierIndex(difficulty) {
    const i = PLANET_TIERS.indexOf(String(difficulty || '').toUpperCase());
    return i < 0 ? 1 : i;
}

function planetTierMods(tier) {
    return PLANET_TIER_MODS[Math.max(0, Math.min(PLANET_TIER_MODS.length - 1, tier | 0))];
}

extendClass(EnemyManager, {
    /** Tier mods of the running level (NORMAL when unknown). */
    currentTierMods() {
        const host = (typeof game !== 'undefined' && game) ? game : null;
        const lm = host && (host.coreLevelManager || host.levelManager);
        const level = lm && lm.getCurrentLevel ? lm.getCurrentLevel() : null;
        return planetTierMods(level && level.planetTier != null ? level.planetTier : 1);
    },

    /**
     * Dodge skill of the running level: planet tier × stage (stage 1 dodges
     * least, later stages ramp toward the tier's full value).
     */
    currentEvasionMul() {
        const host = (typeof game !== 'undefined' && game) ? game : null;
        const lm = host && (host.coreLevelManager || host.levelManager);
        const level = lm && lm.getCurrentLevel ? lm.getCurrentLevel() : null;
        const tier = planetTierMods(level && level.planetTier != null ? level.planetTier : 1);
        const stage = level && level.stageIndex ? level.stageIndex : 1;
        const stageMul = Math.min(1, 0.55 + (stage - 1) * 0.15);
        return (tier.evasion != null ? tier.evasion : 1) * stageMul;
    },

    bossWeaponKitFor(e) {
        if (e && e.bossWeaponKit) return e.bossWeaponKit;
        if (typeof difficultyConfigManager !== 'undefined' && difficultyConfigManager.getBossWeaponKit) {
            return difficultyConfigManager.getBossWeaponKit(e && e.faction);
        }
        return { fan: 'spread', aimed: 'burst', sweep: 'rapid', primary: 'spread' };
    },

    /** Called at the end of spawnEnemy for boss levels. */
    initBoss() {
        const e = this.enemy;
        if (!e || !e.isBoss) return;
        const cx = e.x + e.width / 2;
        e.width = Math.round(e.width * BOSS_SIZE_MUL);
        e.height = Math.round(e.height * BOSS_SIZE_MUL);
        e.x = cx - e.width / 2;
        if (e.collision) e.collision = this.scaleEnemyCollision(e.collision, BOSS_SIZE_MUL);
        const mods = this.currentTierMods();
        this.maxHealth = Math.round(this.maxHealth * mods.boss * 0.6);
        this.health = this.maxHealth;
        e.bossTierMul = mods.boss;
        // Heavy hull: dodges rarely, briefly and slowly (it's meant to be hit).
        this.evasionSpeed = (this.evasionSpeed || 2) * 0.3;
        this.evasionCooldown = Math.max(4000, (this.evasionCooldown || 5000) * 2.5);
        this.evasionDuration = (this.evasionDuration || 1000) * 0.5;
        this.evasionChance = (this.evasionChance != null ? this.evasionChance : 1) * 0.35;
        e.bossPhase = 1;
        e.bossAttackTimer = 1500;
        e.bossPattern = 0;
        e.bossSweep = null;
        e.bossBaseSpeed = Math.abs(e.speed) || 0.4;
        e.bossWeaponKit = this.bossWeaponKitFor(e);
        e.weaponId = e.bossWeaponKit.primary || e.weaponId || 'laser';
        e.attackRateMul = e.attackRateMul != null ? e.attackRateMul : 1;
        this.bossFlash = 0;
        this.announceBoss('BOSS INCOMING');
    },

    announceBoss(text) {
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice(text);
        }
    },

    updateBoss(deltaTime, gameState) {
        const e = this.enemy;
        if (!e || !e.isBoss || this.exploding) return;
        const dt = Math.max(0, Number(deltaTime) || 16.67);
        if (this.bossFlash > 0) this.bossFlash = Math.max(0, this.bossFlash - dt);

        // Phases at 66% / 33% health.
        const ratio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
        const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
        if (phase > e.bossPhase) this.enterBossPhase(phase, gameState);

        // Sweep in progress: one shot per tick along an arc.
        if (e.bossSweep) {
            const s = e.bossSweep;
            const kit = this.bossWeaponKitFor(e);
            s.timer -= dt;
            while (s.timer <= 0 && s.left > 0) {
                const t = 1 - s.left / s.total;
                this.bossFire(e, [s.from + (s.to - s.from) * t], 1.6 + e.bossPhase * 0.2, kit.sweep);
                s.left--;
                s.timer += s.step;
            }
            if (s.left <= 0) e.bossSweep = null;
            return;
        }

        e.bossAttackTimer -= dt;
        if (e.bossAttackTimer > 0) return;
        const rate = Math.max(0.45, Number(e.attackRateMul) || 1);
        const interval = [3200, 2400, 1700][e.bossPhase - 1];
        e.bossAttackTimer = (interval / Math.sqrt(e.bossTierMul || 1) / rate)
            * (0.85 + Math.random() * 0.3);

        const kit = this.bossWeaponKitFor(e);
        const pattern = e.bossPattern++ % 3;
        if (pattern === 0) this.bossFan(e, kit.fan);
        else if (pattern === 1) this.bossAimed(e, kit.aimed);
        else this.bossStartSweep(e, kit.sweep);
    },

    enterBossPhase(phase, gameState) {
        const e = this.enemy;
        e.bossPhase = phase;
        this.bossFlash = 450;
        const sp = e.bossBaseSpeed * (1 + 0.3 * (phase - 1));
        e.speed = Math.sign(e.speed || 1) * sp;
        e.verticalSpeed = Math.sign(e.verticalSpeed || 1) * sp * 0.6;
        e.bossAttackTimer = 600;
        this.announceBoss(phase === 3 ? 'BOSS ENRAGED' : 'BOSS PHASE ' + phase);
        if (typeof explosionSystem !== 'undefined' && explosionSystem.play) {
            try { explosionSystem.play('small_pop', e.x + e.width / 2, e.y + e.height / 2); } catch (err) { /* optional fx */ }
        }
        // Call in escorts: one in phase 2, two when enraged.
        const escorts = phase - 1;
        const cap = this.sideEnemyCap;
        this.sideEnemyCap = Math.max(cap, this.sideEnemies.length + escorts);
        for (let i = 0; i < escorts; i++) this.spawnSideEnemy(gameState || (typeof game !== 'undefined' ? game : null));
        this.sideEnemyCap = Math.max(cap, 3);
    },

    /** Fan of bullets straight down, wider each phase — faction fan weapon. */
    bossFan(e, weaponId) {
        const id = String(weaponId || 'spread');
        const n = id === 'missile' || id === 'plasma' ? 2 + e.bossPhase
            : (id === 'wave' || id === 'ion' ? 4 + e.bossPhase : 3 + e.bossPhase);
        const spread = id === 'burst' || id === 'spike_burst' ? 0.32
            : (id === 'pierce' || id === 'claw_beam' ? 0.14 : 0.22);
        const angles = [];
        for (let i = 0; i < n; i++) angles.push((i - (n - 1) / 2) * spread);
        this.bossFire(e, angles, 1.4 + e.bossPhase * 0.15, id);
    },

    /** Tight volley aimed at the player — faction aimed weapon. */
    bossAimed(e, weaponId) {
        const id = String(weaponId || 'burst');
        let aim = 0;
        if (typeof playerManager !== 'undefined' && playerManager.getPosition) {
            const p = playerManager.getPosition();
            if (p) {
                const dx = (p.x + (p.width || 0) / 2) - (e.x + e.width / 2);
                const dy = (p.y + (p.height || 0) / 2) - (e.y + e.height);
                aim = Math.atan2(dx, Math.max(8, dy));
            }
        }
        const n = id === 'missile' || id === 'plasma' ? Math.max(1, e.bossPhase)
            : (id === 'pierce' || id === 'claw_beam' ? 1 + e.bossPhase : 1 + e.bossPhase);
        const gap = id === 'pierce' || id === 'claw_beam' ? 0.05 : 0.08;
        const angles = [];
        for (let i = 0; i < n; i++) angles.push(aim + (i - (n - 1) / 2) * gap);
        this.bossFire(e, angles, 2.2 + e.bossPhase * 0.25, id);
    },

    bossStartSweep(e) {
        const total = 5 + e.bossPhase * 2;
        const dir = Math.random() < 0.5 ? 1 : -1;
        e.bossSweep = { from: -0.8 * dir, to: 0.8 * dir, total, left: total, step: 90 - e.bossPhase * 15, timer: 0 };
    },

    bossFire(e, angles, speed, weaponId) {
        if (typeof bulletManager === 'undefined') return;
        const list = bulletManager.getEnemyBullets();
        const id = String(weaponId || (e && e.weaponId) || 'spread');
        const shot = BOSS_WEAPON_SHOT[id] || BOSS_WEAPON_SHOT.spread;
        const sizeMul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getShotSizeMul)
            ? uiAppearanceManager.getShotSizeMul('boss') : 1;
        const sw = Math.max(1, shot.w * sizeMul);
        const sh = Math.max(3, shot.h * sizeMul);
        let color = '#808080';
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeaponUiColor) {
            color = weaponConfigManager.getWeaponUiColor(id) || color;
        }
        const dmgBase = id === 'missile' || id === 'plasma' ? 8
            : (id === 'pierce' || id === 'claw_beam' ? 7 : 5);
        const dmg = Math.max(1, Math.round(dmgBase * (e.damageMul != null ? e.damageMul : 1)));
        const x = e.x + e.width / 2;
        const y = e.y + e.height * 0.85;
        const spd = speed * (shot.spd || 1);
        angles.forEach((a) => {
            if (list.length >= BOSS_MAX_BULLETS) return;
            list.push({
                x: x - sw / 2, y,
                width: sw, height: sh,
                speed: spd, damage: dmg, angle: a,
                color: color, type: shot.type,
                weaponId: id, isEnemyShot: true, isBossShot: true,
                lightRadius: shot.light * Math.max(0.7, Math.sqrt(sizeMul)),
                lightIntensity: 1.15, lightColor: color
            });
        });
        if (typeof soundManager !== 'undefined' && soundManager.playEnemyShoot) {
            soundManager.playEnemyShoot(id);
        }
    },

    /** Boss HP bar along the top of the play field. */
    renderBossBar(ctx, width) {
        const e = this.enemy;
        if (!e || !e.isBoss || this.exploding || !(this.maxHealth > 0)) return;
        const W = width || 240;
        const bw = Math.round(W * 0.7);
        const x = Math.round((W - bw) / 2);
        const y = 6;
        const ratio = Math.max(0, Math.min(1, this.health / this.maxHealth));
        ctx.save();
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x - 1, y - 1, bw + 2, 6);
        ctx.fillStyle = '#3a1016';
        ctx.fillRect(x, y, bw, 4);
        const phaseCol = ['#e0484e', '#ff8a3a', '#ff3a8a'][Math.max(0, (e.bossPhase || 1) - 1)];
        ctx.fillStyle = this.bossFlash > 0 && Math.floor(this.bossFlash / 60) % 2 ? '#ffffff' : phaseCol;
        ctx.fillRect(x, y, Math.round(bw * ratio), 4);
        // Phase thresholds.
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x + Math.round(bw * 0.33), y, 1, 4);
        ctx.fillRect(x + Math.round(bw * 0.66), y, 1, 4);
        ctx.restore();
    },
});
