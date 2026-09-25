"use strict";

// EnemyEditorUI methods, split from enemy-editor.js.
extendClass(EnemyEditorUI, {
    reset() {
        if (typeof enemyConfigManager === 'undefined') return;
        enemyConfigManager.resetConfig(this.selectedType);
        this.loadDraft();
        this.renderControls();
    },

    startPreview() {
        this.stopPreview();
        this.previewLastTs = 0;
        if (!this.previewSim) this.resetPreviewSim();
        const loop = () => {
            if (!this.visible) return;
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(loop);
        };
        this.previewAnimId = requestAnimationFrame(loop);
    },

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
        this.previewLastTs = 0;
    },

    getPreviewModel() {
        const hullId = (this.draft && this.draft.hullId)
            || (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getHullId
                ? enemyConfigManager.getHullId(this.selectedType)
                : this.selectedType);
        let base = null;
        if (typeof graphicsManager !== 'undefined') {
            if (graphicsManager.shipAssetLoader && graphicsManager.shipAssetLoader.isLoaded()) {
                base = graphicsManager.shipAssetLoader.getShip(hullId);
            } else if (graphicsManager.shipModels) {
                base = graphicsManager.shipModels.getShipModel(hullId);
            }
        }
        const model = Object.assign({}, base || {
            width: 18,
            height: 14,
            sprite: null
        }, this.draft || {});
        model.forceEnemyOrientation = true;
        return model;
    },

    resetPreviewSim() {
        const w = 200;
        const h = 300;
        const model = this.getPreviewModel();
        const shipW = Math.max(8, Math.round(model.width || 18));
        const shipH = Math.max(8, Math.round(model.height || 14));
        const minY = Number(this.draft && this.draft.minY != null ? this.draft.minY : 25);
        const maxY = Number(this.draft && this.draft.maxY != null ? this.draft.maxY : 100);
        this.previewSim = {
            enemy: {
                x: w / 2 - shipW / 2,
                y: minY,
                width: shipW,
                height: shipH,
                speed: Number(this.draft && this.draft.speed != null ? this.draft.speed : 1),
                verticalSpeed: Number(this.draft && this.draft.verticalSpeed != null ? this.draft.verticalSpeed : 0.3),
                minY,
                maxY
            },
            player: {
                x: w / 2 - 12,
                y: h - 36,
                width: 24,
                height: 20,
                vx: 0
            },
            enemyBullets: [],
            playerBullets: [],
            enemyShootAcc: 0,
            playerShootAcc: 400,
            evasionTimer: Number(this.draft && this.draft.evasionCooldown != null ? this.draft.evasionCooldown : 2000),
            isEvading: false,
            hitFlash: 0,
            starPhase: 0
        };
        this.previewLastTs = 0;
    },

    syncPreviewEnemyFromDraft() {
        const sim = this.previewSim;
        const d = this.draft;
        if (!sim || !d) return;
        const model = this.getPreviewModel();
        const shipW = Math.max(8, Math.round(model.width || 18));
        const shipH = Math.max(8, Math.round(model.height || 14));
        const e = sim.enemy;
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height / 2;
        e.width = shipW;
        e.height = shipH;
        e.x = cx - shipW / 2;
        e.y = cy - shipH / 2;
        const signX = e.speed >= 0 ? 1 : -1;
        const signY = e.verticalSpeed >= 0 ? 1 : -1;
        e.speed = signX * Math.abs(Number(d.speed));
        e.verticalSpeed = signY * Math.abs(Number(d.verticalSpeed));
        e.minY = Number(d.minY);
        e.maxY = Number(d.maxY);
        e.y = Math.max(e.minY, Math.min(e.maxY, e.y));
        e.x = Math.max(0, Math.min(200 - e.width, e.x));
    },

    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const d = this.draft;
        if (!sim || !d) return;

        this.syncPreviewEnemyFromDraft();
        const e = sim.enemy;
        const p = sim.player;
        const frameScale = dtMs / 16.67;

        // --- Invisible player AI: track enemy + wander slightly ---
        const targetX = e.x + e.width / 2 - p.width / 2;
        const track = (targetX - p.x) * 0.04 * frameScale;
        p.vx = p.vx * 0.85 + track + Math.sin(sim.starPhase * 0.7) * 0.15;
        p.x += p.vx;
        p.x = Math.max(4, Math.min(200 - p.width - 4, p.x));
        p.y = 300 - 36 + Math.sin(sim.starPhase * 1.2) * 2;

        // Player shoots at enemy
        sim.playerShootAcc += dtMs;
        const playerInterval = 520;
        if (sim.playerShootAcc >= playerInterval) {
            sim.playerShootAcc = 0;
            const aimX = e.x + e.width / 2 + (Math.random() - 0.5) * 10;
            sim.playerBullets.push({
                x: p.x + p.width / 2 - 1.5,
                y: p.y,
                width: 3,
                height: 10,
                vx: (aimX - (p.x + p.width / 2)) * 0.02,
                speed: 4.2,
                color: '#e07028'
            });
        }

        // --- Enemy patrol ---
        if (!sim.isEvading) {
            e.x += e.speed * frameScale;
            e.y += e.verticalSpeed * frameScale;
            if (e.x <= 0) {
                e.x = 0;
                e.speed = Math.abs(e.speed);
            } else if (e.x >= 200 - e.width) {
                e.x = 200 - e.width;
                e.speed = -Math.abs(e.speed);
            }
            if (e.y <= e.minY) {
                e.y = e.minY;
                e.verticalSpeed = Math.abs(e.verticalSpeed);
            } else if (e.y >= e.maxY) {
                e.y = e.maxY;
                e.verticalSpeed = -Math.abs(e.verticalSpeed);
            }
        }

        // --- Evasion vs player bullets ---
        const evasionCooldown = Number(d.evasionCooldown) || 2000;
        const evasionDuration = Number(d.evasionDuration) || 800;
        const evasionSpeed = Number(d.evasionSpeed) || 2;
        sim.evasionTimer += dtMs;

        if (!sim.isEvading && sim.evasionTimer >= evasionCooldown) {
            for (const b of sim.playerBullets) {
                const dx = (b.x + b.width / 2) - (e.x + e.width / 2);
                const dy = (b.y + b.height / 2) - (e.y + e.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) < 90) {
                    sim.isEvading = true;
                    sim.evasionTimer = 0;
                    break;
                }
            }
        }

        if (sim.isEvading) {
            if (sim.evasionTimer >= evasionDuration) {
                sim.isEvading = false;
                sim.evasionTimer = 0;
            } else if (sim.playerBullets.length) {
                let closest = sim.playerBullets[0];
                let closestDist = Infinity;
                const ecx = e.x + e.width / 2;
                const ecy = e.y + e.height / 2;
                for (const b of sim.playerBullets) {
                    const dx = (b.x + b.width / 2) - ecx;
                    const dy = (b.y + b.height / 2) - ecy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = b;
                    }
                }
                const bcx = closest.x + closest.width / 2;
                const bcy = closest.y + closest.height / 2;
                let edx = ecx - bcx;
                let edy = ecy - bcy;
                const mag = Math.sqrt(edx * edx + edy * edy) || 1;
                const strength = Math.max(0.6, 1.0 - closestDist / 100);
                e.x += (edx / mag) * evasionSpeed * strength * frameScale;
                e.y += (edy / mag) * evasionSpeed * strength * frameScale;
                e.x = Math.max(0, Math.min(200 - e.width, e.x));
                e.y = Math.max(e.minY, Math.min(e.maxY, e.y));
            }
        }

        // --- Enemy shooting ---
        sim.enemyShootAcc += dtMs;
        const shootInterval = Math.max(200, Number(d.shootInterval) || 1200);
        if (sim.enemyShootAcc >= shootInterval) {
            sim.enemyShootAcc = 0;
            this.spawnPreviewEnemyShot(sim, d);
        }

        // --- Move bullets ---
        for (let i = sim.playerBullets.length - 1; i >= 0; i--) {
            const b = sim.playerBullets[i];
            b.x += (b.vx || 0) * frameScale;
            b.y -= b.speed * frameScale;
            if (b.y + b.height < 0 || b.x < -20 || b.x > 220) {
                sim.playerBullets.splice(i, 1);
                continue;
            }
            if (this.rectsOverlap(b, e)) {
                sim.playerBullets.splice(i, 1);
                sim.hitFlash = 180;
            }
        }

        for (let i = sim.enemyBullets.length - 1; i >= 0; i--) {
            const b = sim.enemyBullets[i];
            if (b.angle != null) {
                b.x += Math.sin(b.angle) * b.speed * frameScale;
                b.y += Math.cos(b.angle) * b.speed * frameScale;
            } else {
                b.x += (b.vx || 0) * frameScale;
                b.y += b.speed * frameScale;
            }
            if (b.y > 310 || b.x < -30 || b.x > 230) {
                sim.enemyBullets.splice(i, 1);
                continue;
            }
            // Invisible player still "blocks"/absorbs shots for feedback
            if (this.rectsOverlap(b, p)) {
                sim.enemyBullets.splice(i, 1);
            }
        }

        if (sim.hitFlash > 0) sim.hitFlash = Math.max(0, sim.hitFlash - dtMs);
        sim.starPhase += 0.04 * frameScale;
    },
});
