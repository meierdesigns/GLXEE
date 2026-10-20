"use strict";

/**
 * Level objective progress — hunt / killCount / surviveCount / surviveTime.
 */
class ObjectiveManager {
    constructor() {
        this.objective = null;
        this.enemies = [];
        this.elapsedMs = 0;
        this.kills = 0;
        this.spawnsSeen = 0;
        this.completed = false;
        this.won = false;
        this.awaitingFieldClear = false;
        this.label = '';
        this.goal = null;
    }

    reset() {
        this.objective = null;
        this.enemies = [];
        this.elapsedMs = 0;
        this.kills = 0;
        this.spawnsSeen = 0;
        this.completed = false;
        this.won = false;
        this.awaitingFieldClear = false;
        this.label = '';
        this.goal = null;
    }

    needsFieldClear() {
        const t = this.objective && this.objective.type;
        return t === 'hunt' || t === 'killCount';
    }

    isFieldClear() {
        if (typeof enemyManager !== 'undefined' && enemyManager.isFieldClear) {
            return enemyManager.isFieldClear();
        }
        return true;
    }

    start(objective, enemies) {
        this.reset();
        this.enemies = Array.isArray(enemies) ? enemies.slice() : [];
        this.objective = objective && typeof objective === 'object'
            ? Object.assign({}, objective)
            : this.fallbackObjective(this.enemies);
        this.label = this.buildLabel();
    }

    fallbackObjective(enemies) {
        const target = (enemies.find(e => e.champion) || enemies[0] || {});
        return { type: 'hunt', targetEnemyId: target.id || null };
    }

    buildLabel() {
        const o = this.objective;
        if (!o) return 'OBJECTIVE';
        switch (o.type) {
            case 'hunt': {
                const t = this.enemies.find(e => e.id === o.targetEnemyId);
                return t ? `HUNT ${t.type}` : 'HUNT TARGET';
            }
            case 'killCount': {
                const bits = [];
                if (o.enemyType) bits.push(o.enemyType);
                if (o.faction) bits.push(o.faction);
                if (o.enemyClass) bits.push(o.enemyClass);
                if (o.cluster) bits.push('#' + o.cluster);
                return bits.length
                    ? `KILL ${o.count} ${bits.join('/')}`
                    : `KILL ${o.count} ENEMIES`;
            }
            case 'surviveCount':
                return `SURVIVE ${o.count} SPAWNS`;
            case 'surviveTime':
                return `SURVIVE ${o.seconds}s`;
            case 'reachGoal':
                return o.goal === 'warp' ? 'REACH THE WARP RING' : 'REACH THE SLUICE';
            default:
                return 'OBJECTIVE';
        }
    }

    getProgressText() {
        const o = this.objective;
        if (!o) return '';
        switch (o.type) {
            case 'hunt':
                return this.completed ? 'DONE' : 'ACTIVE';
            case 'killCount':
                return `${this.kills}/${o.count}`;
            case 'surviveCount':
                return `${this.spawnsSeen}/${o.count}`;
            case 'surviveTime': {
                const left = Math.max(0, Math.ceil((o.seconds * 1000 - this.elapsedMs) / 1000));
                return `${left}s`;
            }
            case 'reachGoal': {
                if (this.completed) return 'DONE';
                if (this.goal) return 'GO!';
                const left = Math.max(0, Math.ceil((o.seconds * 1000 - this.elapsedMs) / 1000));
                return `${left}s`;
            }
            default:
                return '';
        }
    }

    onEnemySpawned(entry) {
        if (this.completed || this.won) return;
        this.spawnsSeen += 1;
        if (this.objective && this.objective.type === 'surviveCount') {
            if (this.spawnsSeen >= this.objective.count) {
                this.complete();
            }
        }
    }

    onEnemyKilled(info) {
        if (this.completed || this.won) return;
        const type = info && info.type;
        const entryId = info && info.entryId;
        const o = this.objective;
        if (!o) return;

        if (o.type === 'hunt') {
            if (entryId && o.targetEnemyId && entryId === o.targetEnemyId) {
                this.complete();
            }
            return;
        }

        if (o.type === 'killCount') {
            if (o.enemyType && type !== o.enemyType) return;
            if (o.faction && info.faction !== o.faction) return;
            if (o.enemyClass && info.enemyClass !== o.enemyClass) return;
            if (o.cluster && info.cluster !== o.cluster) return;
            this.kills += 1;
            if (this.kills >= o.count) {
                this.complete();
            }
        }
    }

    update(deltaTime) {
        if (this.won || !this.objective) return;

        if (!this.completed && this.objective.type === 'reachGoal') {
            this.updateGoal(deltaTime);
        }

        if (!this.completed) {
            this.elapsedMs += deltaTime;
            if (this.objective.type === 'surviveTime') {
                if (this.elapsedMs >= this.objective.seconds * 1000) {
                    this.complete();
                }
            }
        }

        if (this.awaitingFieldClear && !this.won) {
            if (this.isFieldClear()) {
                this.awaitingFieldClear = false;
                this.triggerWin();
            }
        }
    }

    /** Transit stage: the goal scrolls in once the timer ends; fly into the opening. */
    updateGoal(deltaTime) {
        const o = this.objective;
        const W = (typeof renderManager !== 'undefined' && renderManager.width) || 240;
        if (!this.goal) {
            if (this.elapsedMs < o.seconds * 1000) return;
            const open = o.goal === 'warp' ? 44 : 64;
            this.goal = {
                kind: o.goal === 'warp' ? 'warp' : 'sluice',
                y: -30,
                h: 22,
                open: open,
                cx: W * (0.3 + Math.random() * 0.4),
                restY: 46
            };
            return;
        }
        const g = this.goal;
        if (g.y < g.restY) g.y = Math.min(g.restY, g.y + 0.04 * deltaTime);
        const pm = typeof playerManager !== 'undefined' ? playerManager : null;
        const p = pm && pm.player;
        if (!p || g.y < g.restY) return;
        const px = p.x + p.width / 2;
        const py = p.y + p.height / 2;
        const inOpening = Math.abs(px - g.cx) <= g.open / 2;
        if (py <= g.y + g.h && inOpening) {
            this.complete();
            return;
        }
        // The gate walls are solid: ships outside the opening are held below them.
        if (!inOpening && p.y < g.y + g.h) p.y = g.y + g.h;
    }

    render(ctx) {
        const g = this.goal;
        if (!g || !ctx) return;
        const W = ctx.canvas ? ctx.canvas.width : 240;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 160);
        ctx.save();
        const l = g.cx - g.open / 2;
        const r = g.cx + g.open / 2;
        const stripes = (x, w) => {
            if (w <= 0) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, g.y, w, g.h);
            ctx.clip();
            ctx.fillStyle = '#e8b020';
            for (let sx = x - g.h; sx < x + w; sx += 12) {
                ctx.beginPath();
                ctx.moveTo(sx, g.y + g.h);
                ctx.lineTo(sx + 6, g.y + g.h);
                ctx.lineTo(sx + 6 + g.h, g.y);
                ctx.lineTo(sx + g.h, g.y);
                ctx.fill();
            }
            ctx.restore();
        };
        if (g.kind === 'warp') {
            // Two pylons with a pulsing energy field between them.
            [[0, l], [r, W]].forEach(([x0, x1]) => {
                ctx.fillStyle = '#05060a';
                ctx.fillRect(x0, g.y, x1 - x0, g.h);
                ctx.fillStyle = '#3a4a6a';
                ctx.fillRect(x0, g.y + g.h - 4, x1 - x0, 4);
            });
            ctx.fillStyle = 'rgba(127,232,255,' + (0.2 + pulse * 0.3) + ')';
            ctx.fillRect(l, g.y, g.open, g.h);
            ctx.strokeStyle = '#7fe8ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(l + 1, g.y + 1, g.open - 2, g.h - 2);
        } else {
            ctx.fillStyle = '#05060a';
            ctx.fillRect(0, g.y, l, g.h);
            ctx.fillRect(r, g.y, W - r, g.h);
            stripes(0, l);
            stripes(r, W - r);
            ctx.fillStyle = '#8c96a8';
            ctx.fillRect(0, g.y + g.h - 3, l, 3);
            ctx.fillRect(r, g.y + g.h - 3, W - r, 3);
            ctx.fillStyle = 'rgba(120,255,160,' + (0.35 + pulse * 0.45) + ')';
            ctx.fillRect(l - 2, g.y, 3, g.h);
            ctx.fillRect(r - 1, g.y, 3, g.h);
        }
        ctx.restore();
    }

    complete() {
        if (this.completed) return;
        this.completed = true;
        if (this.needsFieldClear()) {
            this.awaitingFieldClear = true;
            if (this.isFieldClear()) {
                this.awaitingFieldClear = false;
                this.triggerWin();
            }
            return;
        }
        this.triggerWin();
    }

    triggerWin() {
        if (this.won) return;
        this.won = true;
        // Delay slightly so explosion / spawn FX can play when hunt/kill completes
        const fire = () => {
            if (this.needsFieldClear() && !this.isFieldClear()) {
                this.won = false;
                this.awaitingFieldClear = true;
                return;
            }
            if (typeof game !== 'undefined' && game.playerWins) {
                game.playerWins();
            } else if (typeof gameCore !== 'undefined' && gameCore.playerWins) {
                gameCore.playerWins();
            }
        };
        if (typeof setTimeout === 'function') {
            setTimeout(fire, 900);
        } else {
            fire();
        }
    }

    getObjective() {
        return this.objective;
    }

    isComplete() {
        return this.completed;
    }
}

const objectiveManager = new ObjectiveManager();
