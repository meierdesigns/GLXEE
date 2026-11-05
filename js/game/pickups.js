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
        this.popups = [];
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

    pickupLootKind(p) {
        if (!p) return 'resource';
        if (p.lootKind) return p.lootKind;
        if (p.powerUp) return 'powerUp';
        return 'resource';
    }

    pickupRunKey(p) {
        const kind = this.pickupLootKind(p);
        if (kind === 'blueprint') return 'blueprint:' + p.id;
        if (kind === 'part') return 'part:' + (p.partKind || 'weapon') + ':' + p.id;
        return p.id;
    }

    pickupLabel(p) {
        const kind = this.pickupLootKind(p);
        if (kind === 'blueprint' && typeof profileManager !== 'undefined' && profileManager.getBlueprintName) {
            return 'BP ' + profileManager.getBlueprintName(p.id);
        }
        if (kind === 'part' && typeof profileManager !== 'undefined' && profileManager.getBlueprintName) {
            return profileManager.getBlueprintName((p.partKind || 'weapon') + ':' + p.id);
        }
        if (typeof economyConfig !== 'undefined' && economyConfig.getResourceLabel) {
            return economyConfig.getResourceLabel(p.id);
        }
        return String(p.id || '').toUpperCase();
    }

    pickupIconKey(p) {
        const kind = this.pickupLootKind(p);
        if (kind === 'blueprint') return 'hsBlueprint';
        if (kind === 'part') {
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.resolveModuleIcon) {
                const key = shipLoadoutManager.resolveModuleIcon({ kind: p.partKind || 'weapon', id: p.id });
                if (key) return key;
            }
            return 'hsCraft';
        }
        return this.resourceIconKey(p.id);
    }

    pickupTint(p) {
        const kind = this.pickupLootKind(p);
        if (kind === 'blueprint') return '#ffd24a';
        if (kind === 'part') {
            const pk = p.partKind || 'weapon';
            if (typeof iconRenderer !== 'undefined' && iconRenderer.getModuleKindColor) {
                return iconRenderer.getModuleKindColor(pk) || '#c08cff';
            }
            const fallback = { weapon: '#ff6a4a', defense: '#4ac8ff', energy: '#ffd24a', ability: '#c08cff' };
            return fallback[pk] || '#c08cff';
        }
        return this.resourceColor(p.id);
    }

    pushPickup(base) {
        this.pickups.push(base);
    }

    spawnSalvageFromKill(info, baseX, baseY) {
        if (!info || typeof profileManager === 'undefined') return;
        const life = this.lootPhase ? 22000 : 18000;
        const scatter = (lootKind, extra) => {
            const angle = Math.random() * Math.PI * 2;
            const dist = 6 + Math.random() * 12;
            this.pushPickup(Object.assign({
                lootKind: lootKind,
                amount: 1,
                x: baseX + Math.cos(angle) * dist,
                y: baseY + Math.sin(angle) * dist,
                vx: Math.cos(angle) * (0.45 + Math.random() * 0.7),
                vy: Math.sin(angle) * (0.45 + Math.random() * 0.7) - 0.35,
                age: 0,
                life: life,
                size: lootKind === 'blueprint' ? 12 : 11
            }, extra));
        };
        if (profileManager.tryBlueprintDrop) {
            const bpKey = profileManager.tryBlueprintDrop(info);
            if (bpKey) scatter('blueprint', { id: bpKey });
        }
        if (profileManager.tryPartDrop) {
            const part = profileManager.tryPartDrop(info);
            if (part) scatter('part', { id: part.id, partKind: part.kind });
        }
    }

    reset(clearCollected) {
        this.pickups.length = 0;
        this.popups = [];
        this._saveDirty = false;
        this._saveTimer = 0;
        this.lootPhase = false;
        this.powerShotUntil = 0;
        this.powerUntil = {};
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
        const stats = { radius, magnet, yieldMul };
        // MAGNET / DOUBLE LOOT power-ups (power-crates.js).
        return this.applyCollectPerks ? this.applyCollectPerks(stats) : stats;
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
        this.maybeDropFakeCrate(info);
        const stats = this.getCollectStats();
        let yieldMul = stats.yieldMul;
        // stageScale from build-stage-level: later stages / bosses pay slightly more.
        try {
            const host = (typeof game !== 'undefined' && game) ? game : null;
            const lm = host && (host.coreLevelManager || host.levelManager);
            const level = lm && lm.getCurrentLevel ? lm.getCurrentLevel() : null;
            const ss = level && Number(level.stageScale);
            if (ss > 0) yieldMul *= Math.max(0.75, Math.min(1.6, 0.85 + ss * 0.2));
        } catch (e) { /* ignore */ }
        const drops = economyConfig.rollEnemyKillDrops(info, planetId, yieldMul);

        const cx = Number(info.x);
        const cy = Number(info.y);
        const baseX = isFinite(cx) ? cx : 120;
        const baseY = isFinite(cy) ? cy : 80;

        if (drops && drops.length) {
            drops.forEach((drop, i) => {
                const angle = (Math.PI * 2 * i) / Math.max(1, drops.length) + Math.random() * 0.6;
                const dist = 4 + Math.random() * 10;
                const life = this.lootPhase ? 22000 : 18000;
                this.pushPickup({
                    lootKind: 'resource',
                    id: drop.id,
                    amount: drop.amount,
                    x: baseX + Math.cos(angle) * dist,
                    y: baseY + Math.sin(angle) * dist,
                    vx: Math.cos(angle) * (0.4 + Math.random() * 0.6),
                    vy: Math.sin(angle) * (0.4 + Math.random() * 0.6) - 0.3,
                    age: 0,
                    life: life,
                    size: 9 + Math.min(5, drop.amount)
                });
            });
        }
        this.spawnSalvageFromKill(info, baseX, baseY);
    }

    /**
     * Wrecks sometimes shed a fake supply crate: rarely for small craft,
     * more often for elite / capital ships and the champion, most for bosses.
     */
    maybeDropFakeCrate(info) {
        if (this.lootPhase || typeof obstacleManager === 'undefined' || !obstacleManager.spawnFakeCrate) return;
        const cls = String(info.enemyClass || '').toLowerCase();
        const boss = typeof enemyManager !== 'undefined' && enemyManager.levelMods && enemyManager.levelMods.isBoss;
        let chance = 0.03;
        if (cls === 'elite' || cls === 'capital' || info.champion) chance = 0.12;
        if (boss && info.champion) chance = 0.35;
        if (Math.random() >= chance) return;
        const x = Number(info.x);
        const y = Number(info.y);
        if (isFinite(x) && isFinite(y)) obstacleManager.spawnFakeCrate(x, y);
    }

    /**
     * Destroyed obstacles sometimes drop resources. Chance grows with size;
     * fragments rarely drop so fragmenting rocks don't flood the field.
     * Crystal obstacles favour crystal, the rest roll the planet's table.
     */
    spawnFromObstacle(obstacle) {
        if (!obstacle || obstacle.isFog || typeof economyConfig === 'undefined') return;
        const area = (obstacle.width || 8) * (obstacle.height || 8);
        let chance = Math.min(0.45, 0.12 + area / 900);
        if (obstacle.fragmentGeneration > 0) chance *= 0.3;
        if (Math.random() >= chance) return;
        const planetId = (typeof enemyManager !== 'undefined' && enemyManager.levelMods)
            ? (enemyManager.levelMods.planetId || null)
            : null;
        let id = null;
        if (obstacle.kind === 'crystal') id = 'crystal';
        else if (economyConfig.pickWeightedResourceId && economyConfig.getPlanetResourceTable) {
            id = economyConfig.pickWeightedResourceId(economyConfig.getPlanetResourceTable(planetId));
        }
        if (!id) id = Math.random() < 0.6 ? 'scrap' : 'ore';
        const stats = this.getCollectStats();
        const amount = Math.max(1, Math.round((1 + Math.floor(Math.random() * (area > 150 ? 3 : 2))) * stats.yieldMul));
        const cx = obstacle.x + obstacle.width / 2;
        const cy = obstacle.y + obstacle.height / 2;
        this.pickups.push({
            id: id,
            amount: amount,
            x: cx,
            y: cy,
            vx: (obstacle.horizontalSpeed || 0) * 0.4 + (Math.random() - 0.5) * 0.6,
            vy: (obstacle.verticalSpeed || 0) * 0.4 + (Math.random() - 0.5) * 0.6,
            age: 0,
            life: 14000,
            size: 9 + Math.min(5, amount)
        });
    }

    /**
     * Death: everything gathered this run is forfeited. Collected amounts are
     * taken back out of cargo; drops still floating are lost too.
     * Returns { id: amount } of what was lost.
     */
    forfeitRun() {
        const lost = {};
        Object.keys(this.collectedThisRun).forEach((id) => {
            const n = this.collectedThisRun[id] || 0;
            if (n > 0) lost[id] = n;
        });
        this.pickups.forEach((p) => {
            if (p.powerUp) return;
            const key = this.pickupRunKey(p);
            lost[key] = (lost[key] || 0) + (p.amount || 0);
        });
        const profile = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile)
            ? profileManager.getActiveProfile()
            : null;
        if (profile && profile.cargo) {
            Object.keys(this.collectedThisRun).forEach((id) => {
                const n = this.collectedThisRun[id] || 0;
                if (n <= 0) return;
                if (id.indexOf('blueprint:') === 0) {
                    const key = id.slice(10);
                    if (profile.cargo.blueprints) {
                        profile.cargo.blueprints[key] = Math.max(0, (profile.cargo.blueprints[key] || 0) - n);
                        if (profile.cargo.blueprints[key] <= 0) delete profile.cargo.blueprints[key];
                    }
                } else if (id.indexOf('part:') === 0) {
                    const key = id.slice(5);
                    if (profile.cargo.parts) {
                        profile.cargo.parts[key] = Math.max(0, (profile.cargo.parts[key] || 0) - n);
                        if (profile.cargo.parts[key] <= 0) delete profile.cargo.parts[key];
                    }
                } else if (profile.cargo.resources) {
                    const have = profile.cargo.resources[id] || 0;
                    profile.cargo.resources[id] = Math.max(0, have - n);
                    if (profile.cargo.resources[id] <= 0) delete profile.cargo.resources[id];
                }
            });
            if (profileManager.save) profileManager.save();
        }
        this.pickups.length = 0;
        this.collectedThisRun = {};
        this._saveDirty = false;
        return lost;
    }

    update(deltaTime) {
        const dt = Math.max(1, Number(deltaTime) || 16);
        this.updatePopups(dt);
        if (!this.pickups.length && !this._saveDirty) return;
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
            let pdx = p.vx * speedMul;
            let pdy = p.vy * speedMul;

            if (px == null || py == null) {
                const cv0 = (typeof window !== 'undefined') ? window.combatVoxels : null;
                if (cv0 && cv0.active && cv0.active() && cv0.stepMove) cv0.stepMove(p, pdx, pdy);
                else { p.x += pdx; p.y += pdy; }
                continue;
            }
            const dx = px - p.x;
            const dy = py - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

            if (dist <= collectR * 0.45) {
                this.collectOne(p);
                this.pickups.splice(i, 1);
                continue;
            }

            // Victory scoop: pull every resource across the whole map so leftover
            // drops cannot stall the victory screen.
            if (this.lootPhase && !p.powerUp) {
                const pull = Math.min(14, 3.2 + dist * 0.12) * speedMul;
                pdx += (dx / dist) * pull;
                pdy += (dy / dist) * pull;
                const cv1 = (typeof window !== 'undefined') ? window.combatVoxels : null;
                if (cv1 && cv1.active && cv1.active() && cv1.stepMove) cv1.stepMove(p, pdx, pdy);
                else { p.x += pdx; p.y += pdy; }
                if (dist <= collectR * 1.35) {
                    this.collectOne(p);
                    this.pickups.splice(i, 1);
                }
                continue;
            }

            if (dist <= magnetR) {
                const pull = magnetSpeed * (1 - dist / magnetR) * speedMul;
                pdx += (dx / dist) * pull * 2.2;
                pdy += (dy / dist) * pull * 2.2;
            }
            const cv = (typeof window !== 'undefined') ? window.combatVoxels : null;
            if (cv && cv.active && cv.active() && cv.stepMove) cv.stepMove(p, pdx, pdy);
            else { p.x += pdx; p.y += pdy; }
            if (dist <= magnetR && dist <= collectR) {
                this.collectOne(p);
                this.pickups.splice(i, 1);
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
        if (pickup.powerUp) {
            if (this.collectPowerUp) this.collectPowerUp(pickup);
            return;
        }
        const lootKind = this.pickupLootKind(pickup);
        const runKey = this.pickupRunKey(pickup);
        let granted = 0;
        if (typeof profileManager !== 'undefined') {
            if (lootKind === 'blueprint' && profileManager.addCargoBlueprint) {
                const result = profileManager.addCargoBlueprint(pickup.id, pickup.amount || 1, { skipSave: true });
                granted = typeof result === 'number' ? result : (result ? 1 : 0);
            } else if (lootKind === 'part' && profileManager.addCargoPart) {
                const result = profileManager.addCargoPart(
                    pickup.partKind || 'weapon',
                    pickup.id,
                    pickup.amount || 1,
                    { skipSave: true }
                );
                granted = typeof result === 'number' ? result : (result ? 1 : 0);
            } else if (profileManager.addCargoResource) {
                const result = profileManager.addCargoResource(pickup.id, pickup.amount, { skipSave: true });
                granted = typeof result === 'number' ? result : (result ? pickup.amount : 0);
            }
        }
        const tint = this.pickupTint(pickup);
        if (granted > 0) {
            this.collectedThisRun[runKey] = (this.collectedThisRun[runKey] || 0) + granted;
            this._saveDirty = true;
            if (typeof soundManager !== 'undefined' && soundManager.playPickupCollect) {
                soundManager.playPickupCollect(lootKind === 'resource' ? pickup.id : 'crystal');
            }
            if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                levelInfoManager.showLootNotice('+' + granted + ' ' + this.pickupLabel(pickup));
            }
            if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
                graphicsManager.createHitEffect(pickup.x, pickup.y, 4, tint);
            }
        }
        // Always confirm the pickup over the ship; 0 granted = cargo full for this resource.
        this.addPopup(runKey, Math.max(0, granted || 0), pickup);
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

    /** "+N" above the player on pickup; a fresh popup of the same resource sums up instead of stacking. */
    addPopup(id, amount, source) {
        if (this.lootPhase) return;
        const recent = this.popups.find((p) => p.id === id && p.age < 250);
        if (recent) {
            recent.amount += amount;
            recent.age = 0;
            return;
        }
        this.popups.push({
            id: id,
            amount: amount,
            age: 0,
            life: 1100,
            iconKey: source ? this.pickupIconKey(source) : this.resourceIconKey(id),
            tint: source ? this.pickupTint(source) : this.resourceColor(id)
        });
    }

    updatePopups(dt) {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            this.popups[i].age += dt;
            if (this.popups[i].age >= this.popups[i].life) this.popups.splice(i, 1);
        }
    }

    /** Popups follow the player: hold briefly over the ship, then drift up and fade. */
    renderPopups(ctx) {
        if (!this.popups.length) return;
        const player = (typeof playerManager !== 'undefined' && playerManager.getPosition)
            ? playerManager.getPosition()
            : null;
        if (!player) return;
        // The combat canvas is tiny and scaled down, so size in playfield units must be generous to read.
        const fontPx = 12;
        const icon = 11;
        const o = 2;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.font = fontPx + "px 'Silkscreen', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        this.popups.forEach((p, i) => {
            const k = p.age / p.life;
            const rise = k < 0.3 ? 0 : (k - 0.3) / 0.7;
            const text = p.amount > 0 ? String(p.amount) : 'MAX';
            const w = icon + 3 + ctx.measureText(text).width;
            const x = Math.round(player.x + player.width / 2 - w / 2);
            const y = Math.round(player.y - 12 - i * (fontPx + 2) - rise * 28);
            ctx.globalAlpha = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4);
            const iconKey = p.iconKey || this.resourceIconKey(p.id);
            const tint = p.tint || this.resourceColor(p.id);
            if (typeof iconRenderer !== 'undefined' && iconRenderer.drawKey) {
                iconRenderer.drawKey(ctx, iconKey, x, y - icon / 2, icon, tint);
            }
            const tx = x + icon + 3;
            ctx.fillStyle = '#05060a';
            ctx.fillText(text, tx - o, y);
            ctx.fillText(text, tx + o, y);
            ctx.fillText(text, tx, y - o);
            ctx.fillText(text, tx, y + o);
            ctx.fillStyle = tint;
            ctx.fillText(text, tx, y);
        });
        ctx.restore();
    }

    render(ctx) {
        if (!ctx || !this.pickups.length) return;
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        this.pickups.forEach((p) => {
            const bob = cell ? 0 : Math.sin((t + p.age) * 0.008) * 1.5;
            let x = p.x;
            let y = p.y + bob;
            let size = Math.max(6, Math.round(p.size));
            if (cell) {
                x = Math.round(x / cell) * cell;
                y = Math.round(y / cell) * cell;
                // Icon spans whole cells on the shared lattice (same cell size).
                size = Math.max(cell * 4, Math.round(size / cell) * cell);
            } else {
                x = Math.round(x);
                y = Math.round(y);
            }
            if (p.powerUp && this.drawPowerUp) {
                ctx.save();
                this.drawPowerUp(ctx, p, x, y);
                ctx.restore();
                return;
            }
            const key = this.pickupIconKey(p);
            const tint = this.pickupTint(p);
            const fade = p.age > p.life - 2000 ? Math.max(0.25, (p.life - p.age) / 2000) : 1;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            // Dark outline then coloured glow halo so drops read against busy backgrounds.
            const pulse = 0.4 + 0.15 * Math.sin((t + p.age) * 0.006);
            ctx.globalAlpha = fade * pulse;
            ctx.fillStyle = '#05060a';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = tint;
            ctx.beginPath();
            ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = fade;
            if (typeof iconRenderer !== 'undefined' && iconRenderer.drawKey) {
                iconRenderer.drawKey(ctx, key, x - size / 2, y - size / 2, size, tint);
            } else if (cv && cv.fill) {
                cv.fill(ctx, x - size / 2, y - size / 2, size, size, tint, fade);
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
