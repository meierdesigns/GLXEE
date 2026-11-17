"use strict";

// Defense modes for planets that belong to the pilot's side (own / allied faction,
// or an invasion the pilot came to repel). A regular combat stage there becomes
// one of two timed "survive" missions:
//
//   wall   — a faction-styled station wall along the bottom edge. Every segment
//            has shield + health; enemies from the top shoot and ram it.
//            All segments down = stage lost.
//   escort — a friendly ship flies with you and must reach the end of the timer.
//            Its shield + health are the stake; at 0 the stage is lost.
//
// The win comes from the objective manager (surviveTime); this module only owns
// the protected objects, their damage and their drawing. begin() is called from
// build-stage-level after objectiveManager.start; update() / render() from the
// game loop and render core. The mode is active only while objectiveManager's
// objective carries `defenseMode`, so any later objectiveManager.start() disarms it.

const DEFENSE_STYLES = {
    terran:   { base: '#4a6f9c', dark: '#1d2f4a', accent: '#8fd0ff', shield: '#6fe0ff', style: 'plate' },
    kronax:   { base: '#8c3a2a', dark: '#3a140e', accent: '#ff7a3c', shield: '#ffae5c', style: 'spike' },
    voidborn: { base: '#5a3a8c', dark: '#1f1236', accent: '#c58cff', shield: '#d9a8ff', style: 'rune' },
    pirate:   { base: '#7a6a3a', dark: '#2e2610', accent: '#ffd05a', shield: '#ffe08a', style: 'rust' },
    machine:  { base: '#3a7a74', dark: '#0f2e2b', accent: '#5affe0', shield: '#8affef', style: 'panel' }
};
const DEFENSE_OUTLINE = '#05060a';

class DefenseModeManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.mode = null;
        this.theme = DEFENSE_STYLES.terran;
        this.faction = 'terran';
        this.wall = null;
        this.escort = null;
        this.siegeMs = 0;
        this.siegeEveryMs = 2400;
        this.lost = false;
        this.hitFlash = 0;
    }

    /** Owner of a planet from the pilot's point of view, or null when it is not "ours". */
    resolveOwner(planetId) {
        const pm = typeof profileManager !== 'undefined' ? profileManager : null;
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        const inv = pm && pm.getInvasionForPlanet ? pm.getInvasionForPlanet(planetId) : null;
        if (inv && inv.defender) return String(inv.defender).toLowerCase();
        if (!pcm || !pcm.getPlanetFactions || !pcm.isFriendlyFaction) return null;
        const list = pcm.getPlanetFactions(planetId) || [];
        const own = pcm.getPlayerFaction ? pcm.getPlayerFaction() : '';
        const friendly = list.map((f) => String(f).toLowerCase()).filter((f) => pcm.isFriendlyFaction(f));
        if (!friendly.length) return null;
        return friendly.indexOf(own) !== -1 ? own : friendly[0];
    }

    /** Deterministic wall/escort pick per planet + stage so a retry is the same mission. */
    pickMode(planetId, stageIndex) {
        let h = 0;
        const s = String(planetId || '');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return (Math.abs(h) + (Number(stageIndex) || 0)) % 2 === 0 ? 'wall' : 'escort';
    }

    begin(level) {
        this.reset();
        if (!level || level.isBoss || level.stageKind !== 'combat' || !level.planetId) return;
        if (String(level.planetId).indexOf('ambush_') === 0) return;
        if (typeof objectiveManager === 'undefined' || !objectiveManager.objective) return;
        const owner = this.resolveOwner(level.planetId);
        if (!owner) return;

        const mode = this.pickMode(level.planetId, level.stageIndex);
        const stage = Math.max(1, Number(level.stageIndex) || 1);
        const seconds = 55 + stage * 6;
        this.mode = mode;
        this.faction = owner;
        this.theme = DEFENSE_STYLES[owner] || DEFENSE_STYLES.terran;
        this.siegeEveryMs = Math.max(1400, 2600 - stage * 140);
        this.siegeMs = 2500;

        const W = this.fieldW();
        const H = this.fieldH();
        if (mode === 'wall') {
            const count = 6;
            const gap = 2;
            const segW = Math.floor((W - gap * (count - 1)) / count);
            const x0 = Math.floor((W - (segW * count + gap * (count - 1))) / 2);
            const hpMax = 70 + stage * 12;
            const shMax = 45 + stage * 6;
            this.wall = { y: H - 15, h: 15, segs: [] };
            for (let i = 0; i < count; i++) {
                this.wall.segs.push({
                    x: x0 + i * (segW + gap), w: segW,
                    hp: hpMax, hpMax: hpMax, sh: shMax, shMax: shMax,
                    hitAt: 0, flash: 0, ramAt: 0
                });
            }
        } else {
            const hpMax = 140 + stage * 18;
            const shMax = 80 + stage * 8;
            this.escort = {
                w: 22, h: 14, x: W / 2 - 11, y: H - 42,
                hp: hpMax, hpMax: hpMax, sh: shMax, shMax: shMax,
                hitAt: 0, flash: 0, ramAt: 0, drift: Math.random() * 6
            };
        }

        objectiveManager.objective = { type: 'surviveTime', seconds: seconds, defenseMode: mode };
        objectiveManager.label = mode === 'wall' ? 'DEFEND THE WALL' : 'ESCORT THE SHIP';

        // Defense theaters use the defending faction's own environment (not the attacker's).
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetEnvironment
            && typeof obstacleManager !== 'undefined' && obstacleManager.setEnvironment) {
            const cfg = planetConfigManager.getConfig ? planetConfigManager.getConfig(level.planetId) : null;
            obstacleManager.setEnvironment(
                planetConfigManager.getPlanetEnvironment(level.planetId, cfg, { faction: owner, homeBias: true })
            );
        }
    }

    isActive() {
        const o = typeof objectiveManager !== 'undefined' ? objectiveManager.objective : null;
        return !!(this.mode && o && o.defenseMode === this.mode && !this.lost);
    }

    fieldW() { return (typeof game !== 'undefined' && (game.internalWidth || game.baseWidth)) || 240; }
    fieldH() { return (typeof game !== 'undefined' && (game.internalHeight || game.baseHeight)) || 320; }

    /** Targets that currently take hits: wall segments or the escort. */
    targets() {
        if (this.mode === 'wall' && this.wall) return this.wall.segs.filter((s) => s.hp > 0);
        if (this.mode === 'escort' && this.escort && this.escort.hp > 0) return [this.escort];
        return [];
    }

    rectOf(t) {
        if (this.mode === 'wall') return { x: t.x, y: this.wall.y, width: t.w, height: this.wall.h };
        return { x: t.x, y: t.y, width: t.w, height: t.h };
    }

    damage(t, amount) {
        const now = Date.now();
        t.hitAt = now;
        t.flash = 1;
        let dmg = Math.max(0, Number(amount) || 0);
        if (t.sh > 0) {
            const used = Math.min(t.sh, dmg);
            t.sh -= used;
            dmg -= used;
        }
        if (dmg > 0) t.hp = Math.max(0, t.hp - dmg);
        const r = this.rectOf(t);
        try {
            if (typeof collisionManager !== 'undefined' && collisionManager.spawnPlayerHitFx) {
                collisionManager.spawnPlayerHitFx(r.x + r.width / 2, r.y + 2);
            }
            if (typeof soundManager !== 'undefined' && soundManager.playShieldHit && t.sh > 0) soundManager.playShieldHit();
        } catch (e) { /* fx are optional */ }
    }

    lose() {
        if (this.lost) return;
        this.lost = true;
        if (typeof game !== 'undefined' && game.gameOver) game.gameOver();
    }

    update(deltaTime) {
        if (!this.isActive()) return;
        const om = objectiveManager;
        if (om.won || om.completed) return;
        const dt = Math.min(100, Number(deltaTime) || 16.67);
        const now = Date.now();
        const arrival = (om.isCombatGrace && om.isCombatGrace()) || (om.isArrivalSpawnHold && om.isArrivalSpawnHold());

        // Shield regen after a quiet moment; hit flash decay.
        this.targets().forEach((t) => {
            t.flash = Math.max(0, t.flash - dt / 180);
            if (t.sh < t.shMax && now - t.hitAt > 3000) t.sh = Math.min(t.shMax, t.sh + (t.shMax / 12) * (dt / 1000));
        });

        if (this.mode === 'escort') this.updateEscort(dt);
        if (arrival) return;

        this.absorbBullets();
        this.ramByEnemies(now);
        this.siegeFire(dt);

        if (!this.targets().length) this.lose();
    }

    updateEscort(dt) {
        const e = this.escort;
        if (!e || e.hp <= 0) return;
        const W = this.fieldW();
        const H = this.fieldH();
        const o = objectiveManager.objective;
        const p = Math.max(0, Math.min(1, objectiveManager.elapsedMs / (o.seconds * 1000)));
        e.drift += dt / 1000 * 0.7;
        const player = typeof playerManager !== 'undefined' && playerManager.getPosition ? playerManager.getPosition() : null;
        const pcx = player ? player.x + player.width / 2 : W / 2;
        // Sways on its own course but is pulled towards the pilot, who guards it.
        const tx = (W / 2 + Math.sin(e.drift) * W * 0.3) * 0.55 + pcx * 0.45 - e.w / 2;
        e.x += (tx - e.x) * Math.min(1, dt / 1000 * 0.9);
        e.x = Math.max(2, Math.min(W - e.w - 2, e.x));
        const ty = H - 44 - p * H * 0.22; // travels up the field as the run progresses
        e.y += (ty - e.y) * Math.min(1, dt / 1000 * 1.5);
    }

    absorbBullets() {
        if (typeof bulletManager === 'undefined') return;
        const bullets = bulletManager.getEnemyBullets();
        const targets = this.targets();
        if (!targets.length) return;
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (!b) continue;
            const bw = b.width || 2;
            const bh = b.height || 6;
            for (let k = 0; k < targets.length; k++) {
                const r = this.rectOf(targets[k]);
                if (b.x < r.x + r.width && b.x + bw > r.x && b.y < r.y + r.height && b.y + bh > r.y) {
                    const dmg = b.damage !== undefined ? b.damage : 8;
                    bulletManager.removeEnemyBullet(i);
                    this.damage(targets[k], dmg);
                    break;
                }
            }
        }
    }

    enemyList() {
        if (typeof enemyManager === 'undefined') return [];
        const out = [];
        (enemyManager.sideEnemies || []).forEach((e) => { if (e && !e.fleeing && !e.entering) out.push(e); });
        const m = enemyManager.enemy;
        if (m && !enemyManager.exploding && !m.introEntry) out.push(m);
        return out;
    }

    /** Enemies that dive into a protected object hurt it and bounce back. */
    ramByEnemies(now) {
        const targets = this.targets();
        if (!targets.length) return;
        this.enemyList().forEach((e) => {
            const ew = e.width || 10;
            const eh = e.height || 10;
            for (let k = 0; k < targets.length; k++) {
                const t = targets[k];
                const r = this.rectOf(t);
                if (e.x < r.x + r.width && e.x + ew > r.x && e.y < r.y + r.height && e.y + eh > r.y) {
                    if (now - (e._defRamAt || 0) > 900) {
                        e._defRamAt = now;
                        this.damage(t, 14);
                        e.verticalSpeed = -Math.abs(e.verticalSpeed || 0.4) - 0.3;
                    }
                    break;
                }
            }
        });
    }

    /** Enemies above a protected object take shots at it, so it is attacked even when the pilot dodges. */
    siegeFire(dt) {
        this.siegeMs -= dt;
        if (this.siegeMs > 0 || typeof bulletManager === 'undefined') return;
        this.siegeMs = this.siegeEveryMs * (0.75 + Math.random() * 0.5);
        const targets = this.targets();
        if (!targets.length) return;
        const enemies = this.enemyList();
        if (!enemies.length) return;
        const cap = bulletManager.maxEnemyBullets != null ? bulletManager.maxEnemyBullets + 4 : 8;
        if (bulletManager.getEnemyBullets().length >= cap) return;
        // First enemy that has a target under it.
        const shuffled = enemies.slice().sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i++) {
            const e = shuffled[i];
            const cx = e.x + (e.width || 10) / 2;
            const under = targets.some((t) => {
                const r = this.rectOf(t);
                return cx >= r.x - 2 && cx <= r.x + r.width + 2;
            });
            if (!under) continue;
            const dmgMul = e.damageMul != null ? e.damageMul : 1;
            bulletManager.pushBullet(bulletManager.enemyBullets, {
                x: cx - 1.5,
                y: e.y + (e.height || 10),
                width: 3,
                height: 7,
                speed: 2.2,
                damage: Math.max(2, Math.round(5 * dmgMul)),
                color: '#808080',
                type: 'enemy_laser',
                isEnemyShot: true,
                _sweepDx: 0,
                _sweepDy: 0,
                lightRadius: 14,
                lightIntensity: 1.0,
                lightColor: '#808080'
            });
            return;
        }
    }

    // ---------------------------------------------------------------- render

    render(ctx) {
        if (!ctx || !this.mode || !this.isActive()) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        this.renderFactionGround(ctx);
        if (this.mode === 'wall') this.renderWall(ctx);
        else this.renderEscort(ctx);
        ctx.restore();
    }

    /**
     * Coarse faction props along the bottom / flanks so defense arenas read as
     * the defender's fort — bunkers, fangs, junk piles, circuit pylons, pods.
     */
    renderFactionGround(ctx) {
        const th = this.theme;
        const W = this.fieldW();
        const H = this.fieldH();
        const style = th.style || 'plate';
        const y0 = H - (this.mode === 'wall' ? 22 : 18);
        // Dark embankment strip under the protected line.
        ctx.fillStyle = th.dark;
        ctx.fillRect(0, y0 + 4, W, H - y0 - 4);
        ctx.fillStyle = DEFENSE_OUTLINE;
        ctx.fillRect(0, y0 + 3, W, 1);
        // Chunky side bastions.
        const bastion = (x, mirror) => {
            const bw = 18;
            const bh = 14;
            const bx = mirror ? W - x - bw : x;
            ctx.fillStyle = DEFENSE_OUTLINE;
            ctx.fillRect(bx - 1, y0 - bh, bw + 2, bh + 2);
            ctx.fillStyle = th.base;
            ctx.fillRect(bx, y0 - bh + 1, bw, bh);
            ctx.fillStyle = th.dark;
            ctx.fillRect(bx, y0 - 3, bw, 3);
            ctx.fillStyle = th.accent;
            if (style === 'spike') {
                for (let i = 0; i < 4; i++) ctx.fillRect(bx + 2 + i * 4, y0 - bh - 3, 2, 3);
                ctx.fillRect(bx + 3, y0 - bh + 5, bw - 6, 2);
            } else if (style === 'rune') {
                ctx.fillRect(bx + bw / 2 - 2, y0 - bh + 3, 4, 8);
                ctx.fillRect(bx + 4, y0 - bh + 6, bw - 8, 2);
                ctx.fillRect(bx + 2, y0 - bh + 2, 3, 3);
                ctx.fillRect(bx + bw - 5, y0 - bh + 2, 3, 3);
            } else if (style === 'rust') {
                ctx.fillRect(bx + 2, y0 - bh + 3, bw - 4, 2);
                ctx.fillRect(bx + 3, y0 - bh + 8, 4, 3);
                ctx.fillRect(bx + bw - 7, y0 - bh + 7, 4, 3);
                ctx.fillStyle = th.dark;
                ctx.fillRect(bx + 1, y0 - bh + 1, 3, 3);
                ctx.fillRect(bx + bw - 5, y0 - 6, 4, 2);
            } else if (style === 'panel') {
                ctx.fillRect(bx + 2, y0 - bh + 2, bw - 4, 1);
                ctx.fillRect(bx + 2, y0 - bh + 6, bw - 4, 1);
                ctx.fillRect(bx + Math.floor(bw / 2), y0 - bh + 2, 1, bh - 4);
                ctx.fillRect(bx + 3, y0 - bh + 9, 3, 2);
                ctx.fillRect(bx + bw - 6, y0 - bh + 9, 3, 2);
            } else {
                // Terran plate: slab bunkers with rivet dots.
                ctx.fillRect(bx + 2, y0 - bh + 2, bw - 4, 2);
                ctx.fillRect(bx + 3, y0 - bh + 7, 2, 2);
                ctx.fillRect(bx + bw - 5, y0 - bh + 7, 2, 2);
                ctx.fillRect(bx + Math.floor(bw / 2) - 1, y0 - bh + 4, 2, 5);
            }
        };
        bastion(2, false);
        bastion(2, true);
        // Mid-field coarse markers (faction doctrine blocks) between bastions.
        const midY = y0 - 6;
        for (let i = 0; i < 3; i++) {
            const mx = Math.floor(W * (0.28 + i * 0.18)) - 4;
            ctx.fillStyle = DEFENSE_OUTLINE;
            ctx.fillRect(mx - 1, midY - 1, 10, 8);
            ctx.fillStyle = th.base;
            ctx.fillRect(mx, midY, 8, 6);
            ctx.fillStyle = th.accent;
            if (style === 'spike') ctx.fillRect(mx + 3, midY - 3, 2, 3);
            else if (style === 'rune') ctx.fillRect(mx + 2, midY + 1, 4, 2);
            else if (style === 'rust') { ctx.fillRect(mx + 1, midY + 2, 2, 2); ctx.fillRect(mx + 5, midY + 1, 2, 2); }
            else if (style === 'panel') { ctx.fillRect(mx + 1, midY + 1, 6, 1); ctx.fillRect(mx + 3, midY + 1, 1, 4); }
            else { ctx.fillRect(mx + 2, midY + 2, 1, 1); ctx.fillRect(mx + 5, midY + 2, 1, 1); }
        }
    }

    renderBars(ctx, x, y, w, t) {
        const bw = Math.max(4, w - 2);
        const bx = Math.round(x + 1);
        ctx.fillStyle = DEFENSE_OUTLINE;
        ctx.fillRect(bx - 1, Math.round(y) - 1, bw + 2, 6);
        ctx.fillStyle = '#1b2a1b';
        ctx.fillRect(bx, Math.round(y) + 3, bw, 2);
        ctx.fillStyle = t.hp / t.hpMax > 0.35 ? '#5aff7a' : '#ff5a4a';
        ctx.fillRect(bx, Math.round(y) + 3, Math.round(bw * t.hp / t.hpMax), 2);
        ctx.fillStyle = '#152230';
        ctx.fillRect(bx, Math.round(y), bw, 2);
        ctx.fillStyle = this.theme.shield;
        ctx.fillRect(bx, Math.round(y), Math.round(bw * t.sh / t.shMax), 2);
    }

    renderWall(ctx) {
        const th = this.theme;
        const wall = this.wall;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
        wall.segs.forEach((s) => {
            const x = Math.round(s.x);
            const y = Math.round(wall.y);
            const w = Math.round(s.w);
            const h = wall.h;
            if (s.hp <= 0) {
                // Rubble where a segment fell.
                ctx.fillStyle = th.dark;
                ctx.fillRect(x + 1, y + h - 4, w - 2, 3);
                ctx.fillStyle = DEFENSE_OUTLINE;
                ctx.fillRect(x + 3, y + h - 5, 3, 2);
                ctx.fillRect(x + w - 7, y + h - 6, 3, 3);
                return;
            }
            const hurt = 1 - s.hp / s.hpMax;
            // Dark outline first, then the body.
            ctx.fillStyle = DEFENSE_OUTLINE;
            ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
            ctx.fillStyle = s.flash > 0 ? '#ffffff' : th.base;
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = th.dark;
            ctx.fillRect(x, y + h - 4, w, 4);
            ctx.fillStyle = th.accent;
            ctx.fillRect(x, y, w, 1);
            this.renderWallStyle(ctx, th.style, x, y, w, h);
            // Cracks grow with damage.
            if (hurt > 0.3) {
                ctx.fillStyle = DEFENSE_OUTLINE;
                ctx.fillRect(x + Math.floor(w * 0.3), y + 2, 1, 5);
                ctx.fillRect(x + Math.floor(w * 0.3) + 1, y + 6, 1, 4);
            }
            if (hurt > 0.65) {
                ctx.fillRect(x + Math.floor(w * 0.65), y + 1, 1, 6);
                ctx.fillRect(x + Math.floor(w * 0.65) - 1, y + 7, 1, 5);
            }
            // Shield: a glowing arc above the segment, brighter the fuller it is.
            if (s.sh > 0) {
                const k = s.sh / s.shMax;
                ctx.globalAlpha = (0.25 + 0.4 * k) * (0.8 + 0.2 * pulse) + s.flash * 0.3;
                ctx.fillStyle = th.shield;
                ctx.fillRect(x, y - 4, w, 2);
                ctx.fillRect(x + 2, y - 6, w - 4, 2);
                ctx.globalAlpha = 0.12 + 0.1 * k;
                ctx.fillRect(x, y - 6, w, 6);
                ctx.globalAlpha = 1;
            }
            this.renderBars(ctx, x, y - 12, w, s);
        });
    }

    renderWallStyle(ctx, style, x, y, w, h) {
        const th = this.theme;
        ctx.fillStyle = th.dark;
        if (style === 'spike') {
            for (let px = x + 1; px < x + w - 2; px += 4) ctx.fillRect(px, y - 2, 2, 2);
            ctx.fillStyle = th.accent;
            ctx.fillRect(x + 2, y + 4, w - 4, 1);
        } else if (style === 'rune') {
            ctx.fillStyle = th.accent;
            ctx.fillRect(x + Math.floor(w / 2) - 1, y + 3, 2, 5);
            ctx.fillRect(x + Math.floor(w / 2) - 3, y + 5, 6, 1);
        } else if (style === 'rust') {
            ctx.fillRect(x + 2, y + 3, w - 4, 1);
            ctx.fillRect(x + 4, y + 8, w - 8, 1);
            ctx.fillStyle = th.accent;
            ctx.fillRect(x + 2, y + 6, 2, 2);
            ctx.fillRect(x + w - 4, y + 6, 2, 2);
        } else if (style === 'panel') {
            ctx.fillRect(x + 1, y + 3, w - 2, 1);
            ctx.fillRect(x + Math.floor(w / 2), y + 3, 1, 8);
            ctx.fillStyle = th.accent;
            ctx.fillRect(x + 2, y + 6, 2, 1);
            ctx.fillRect(x + w - 4, y + 6, 2, 1);
        } else {
            ctx.fillRect(x + 1, y + 3, w - 2, 1);
            ctx.fillStyle = th.accent;
            ctx.fillRect(x + 2, y + 7, 1, 1);
            ctx.fillRect(x + w - 3, y + 7, 1, 1);
        }
    }

    renderEscort(ctx) {
        const e = this.escort;
        if (!e || e.hp <= 0) return;
        const th = this.theme;
        const x = Math.round(e.x);
        const y = Math.round(e.y);
        const w = e.w;
        const h = e.h;
        const cx = x + w / 2;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
        // Engine glow behind the hull.
        ctx.globalAlpha = 0.5 + 0.4 * pulse;
        ctx.fillStyle = th.accent;
        ctx.fillRect(Math.round(cx) - 3, y + h + 1, 2, 3);
        ctx.fillRect(Math.round(cx) + 1, y + h + 1, 2, 3);
        ctx.globalAlpha = 1;
        // Hull: dark outline, then a blunt freighter body.
        ctx.fillStyle = DEFENSE_OUTLINE;
        ctx.fillRect(x - 1, y + 2, w + 2, h - 3);
        ctx.fillRect(x + 4, y - 1, w - 8, 4);
        ctx.fillStyle = e.flash > 0 ? '#ffffff' : th.base;
        ctx.fillRect(x, y + 3, w, h - 5);
        ctx.fillRect(x + 5, y, w - 10, 4);
        ctx.fillStyle = th.dark;
        ctx.fillRect(x, y + h - 5, w, 2);
        ctx.fillStyle = th.accent;
        ctx.fillRect(x + 7, y + 1, w - 14, 1);
        ctx.fillRect(x + 2, y + 6, 2, 2);
        ctx.fillRect(x + w - 4, y + 6, 2, 2);
        if (e.sh > 0) {
            const k = e.sh / e.shMax;
            ctx.globalAlpha = (0.2 + 0.35 * k) * (0.8 + 0.2 * pulse) + e.flash * 0.3;
            ctx.strokeStyle = th.shield;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
            ctx.globalAlpha = 0.1 + 0.08 * k;
            ctx.fillStyle = th.shield;
            ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
            ctx.globalAlpha = 1;
        }
        this.renderBars(ctx, x - 2, y - 10, w + 4, e);
    }
}

const defenseModeManager = new DefenseModeManager();
if (typeof window !== 'undefined') {
    window.DefenseModeManager = DefenseModeManager;
    window.defenseModeManager = defenseModeManager;
}
