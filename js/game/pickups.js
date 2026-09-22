"use strict";

/**
 * Mission resource pickups dropped by defeated enemies.
 * Collection radius / magnet / yield come from collector module upgrades.
 */
class PickupManager {
    constructor() {
        this.pickups = [];
        this.collectedThisRun = {};
        this._saveDirty = false;
        this._saveTimer = 0;
        this.lootPhase = false;
    }

    resourceColor(id) {
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceColor) {
            return economyConfig.getResourceColor(id);
        }
        const fallback = { scrap: '#b8b0a0', ore: '#c49a4a', crystal: '#6ec8e8', voltex: '#c86ef0' };
        return fallback[id] || '#b8b0a0';
    }

    resourceIconKey(id) {
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceIconKey) {
            return economyConfig.getResourceIconKey(id);
        }
        const fallback = { scrap: 'resScrap', ore: 'resOre', crystal: 'resCrystal', voltex: 'resVoltex' };
        return fallback[id] || 'resScrap';
    }

    reset(clearCollected) {
        this.pickups.length = 0;
        this._saveDirty = false;
        this._saveTimer = 0;
        this.lootPhase = false;
        if (clearCollected !== false) {
            this.collectedThisRun = {};
        }
    }

    getCollectedThisRun() {
        const out = {};
        Object.keys(this.collectedThisRun).forEach((id) => {
            const n = this.collectedThisRun[id] || 0;
            if (n > 0) out[id] = n;
        });
        return out;
    }

    getCollectStats() {
        let bonuses = null;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            bonuses = profileManager.getModuleUpgradeBonuses();
        }
        const baseRadius = (typeof economyConfig !== 'undefined' && economyConfig.collectBaseRadius != null)
            ? economyConfig.collectBaseRadius
            : 32;
        let radius = Math.max(12, baseRadius + (bonuses && bonuses.collectRadiusBonus || 0));
        let magnet = Math.max(0, bonuses && bonuses.collectMagnet || 0);
        const yieldMul = Math.max(1, bonuses && bonuses.collectYieldMul || 1);
        if (this.lootPhase) {
            radius *= 1.35;
            magnet = Math.max(magnet, 1) + 1.5;
        }
        return { radius, magnet, yieldMul };
    }

    /** Keep drops alive through the post-victory scoop window. */
    beginLootPhase(extraMs) {
        this.lootPhase = true;
        const pad = Math.max(4000, Number(extraMs) || 10000);
        this.pickups.forEach((p) => {
            p.life = Math.max(p.life, p.age + pad);
        });
    }

    endLootPhase() {
        this.lootPhase = false;
    }

    spawnFromKill(info) {
        if (!info || typeof economyConfig === 'undefined') return;
        const planetId = (typeof enemyManager !== 'undefined' && enemyManager.levelMods)
            ? (enemyManager.levelMods.planetId || null)
            : null;
        const stats = this.getCollectStats();
        const drops = economyConfig.rollEnemyKillDrops(info, planetId, stats.yieldMul);
        if (!drops || !drops.length) return;

        const cx = Number(info.x);
        const cy = Number(info.y);
        const baseX = isFinite(cx) ? cx : 120;
        const baseY = isFinite(cy) ? cy : 80;

        drops.forEach((drop, i) => {
            const angle = (Math.PI * 2 * i) / Math.max(1, drops.length) + Math.random() * 0.6;
            const dist = 4 + Math.random() * 10;
            const life = this.lootPhase ? 22000 : 18000;
            this.pickups.push({
                id: drop.id,
                amount: drop.amount,
                x: baseX + Math.cos(angle) * dist,
                y: baseY + Math.sin(angle) * dist,
                vx: Math.cos(angle) * (0.4 + Math.random() * 0.6),
                vy: Math.sin(angle) * (0.4 + Math.random() * 0.6) - 0.3,
                age: 0,
                life: life,
                size: 7 + Math.min(4, drop.amount)
            });
        });
    }

    update(deltaTime) {
        if (!this.pickups.length && !this._saveDirty) return;
        const dt = Math.max(1, Number(deltaTime) || 16);
        if (typeof objectiveManager !== 'undefined' && objectiveManager.awaitingFieldClear) {
            this.pickups.forEach((p) => {
                p.life = Math.max(p.life, p.age + 6000);
            });
        }
        const speedMul = dt / 16.67;
        const stats = this.getCollectStats();
        const player = (typeof playerManager !== 'undefined' && playerManager.getPosition)
            ? playerManager.getPosition()
            : null;
        const px = player ? player.x + player.width / 2 : null;
        const py = player ? player.y + player.height / 2 : null;
        const collectR = stats.radius;
        const magnetR = collectR * (1.35 + stats.magnet * 0.35);
        const magnetSpeed = 0.55 + stats.magnet * 0.55;

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.age += dt;
            if (p.age > p.life) {
                this.pickups.splice(i, 1);
                continue;
            }

            p.vx *= 0.96;
            p.vy = p.vy * 0.96 + 0.015 * speedMul;
            p.x += p.vx * speedMul;
            p.y += p.vy * speedMul;

            if (px == null || py == null) continue;
            const dx = px - p.x;
            const dy = py - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

            if (dist <= collectR * 0.45) {
                this.collectOne(p);
                this.pickups.splice(i, 1);
                continue;
            }

            if (dist <= magnetR) {
                const pull = magnetSpeed * (1 - dist / magnetR) * speedMul;
                p.x += (dx / dist) * pull * 2.2;
                p.y += (dy / dist) * pull * 2.2;
                if (dist <= collectR) {
                    this.collectOne(p);
                    this.pickups.splice(i, 1);
                }
            }
        }

        if (this._saveDirty) {
            this._saveTimer += dt;
            if (this._saveTimer >= 400) {
                this.flushSave();
            }
        }
    }

    collectOne(pickup) {
        if (!pickup) return;
        let granted = pickup.amount;
        if (typeof profileManager !== 'undefined' && profileManager.addCargoResource) {
            const result = profileManager.addCargoResource(pickup.id, pickup.amount, { skipSave: true });
            granted = typeof result === 'number' ? result : (result ? pickup.amount : 0);
        }
        if (granted > 0) {
            this.collectedThisRun[pickup.id] = (this.collectedThisRun[pickup.id] || 0) + granted;
            this._saveDirty = true;
            if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                const label = (typeof economyConfig !== 'undefined')
                    ? economyConfig.getResourceLabel(pickup.id)
                    : String(pickup.id).toUpperCase();
                levelInfoManager.showLootNotice('+' + granted + ' ' + label);
            }
            if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
                graphicsManager.createHitEffect(pickup.x, pickup.y, 4, this.resourceColor(pickup.id));
            }
        }
    }

    /** Vacuum remaining pickups into cargo (victory / end of run). */
    collectAll() {
        while (this.pickups.length) {
            this.collectOne(this.pickups.pop());
        }
        this.flushSave();
        return this.getCollectedThisRun();
    }

    flushSave() {
        this._saveDirty = false;
        this._saveTimer = 0;
        if (typeof profileManager !== 'undefined' && profileManager.save) {
            profileManager.save();
        }
    }

    render(ctx) {
        if (!ctx || !this.pickups.length) return;
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.pickups.forEach((p) => {
            const bob = Math.sin((t + p.age) * 0.008) * 1.5;
            const x = Math.round(p.x);
            const y = Math.round(p.y + bob);
            const size = Math.max(6, Math.round(p.size));
            const key = this.resourceIconKey(p.id);
            const tint = this.resourceColor(p.id);
            const fade = p.age > p.life - 2000 ? Math.max(0.25, (p.life - p.age) / 2000) : 1;
            ctx.save();
            ctx.globalAlpha = fade;
            if (typeof iconRenderer !== 'undefined' && iconRenderer.drawKey) {
                iconRenderer.drawKey(ctx, key, x - size / 2, y - size / 2, size, tint);
            } else {
                ctx.fillStyle = tint;
                ctx.fillRect(x - 3, y - 3, 6, 6);
            }
            ctx.restore();
        });
    }
}

const pickupManager = new PickupManager();
window.pickupManager = pickupManager;
