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
