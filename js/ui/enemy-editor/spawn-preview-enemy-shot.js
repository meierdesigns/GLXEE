"use strict";

// EnemyEditorUI methods, split from enemy-editor.js.
extendClass(EnemyEditorUI, {
    spawnPreviewEnemyShot(sim, d) {
        const e = sim.enemy;
        const p = sim.player;
        const weapon = String(d.defaultWeapon || 'laser');
        const speed = Number(d.weaponSpeed) || 5;
        const damage = Number(d.weaponDamage) || 6;
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height;
        const aimDx = (p.x + p.width / 2) - cx;
        const aimVx = Math.max(-1.2, Math.min(1.2, aimDx * 0.015));

        const push = (bullet) => {
            if (sim.enemyBullets.length < 8) sim.enemyBullets.push(bullet);
        };

        if (weapon === 'spread') {
            [-0.35, 0, 0.35].forEach((angle) => {
                push({
                    x: cx - 1.5,
                    y: cy,
                    width: 3,
                    height: 10,
                    speed,
                    damage,
                    angle,
                    color: '#c05050',
                    type: 'enemy_spread'
                });
            });
        } else if (weapon === 'rapid') {
            push({
                x: cx - 1,
                y: cy,
                width: 2,
                height: 8,
                speed: speed * 1.25,
                vx: aimVx,
                damage,
                color: '#e09040',
                type: 'enemy_rapid'
            });
        } else if (weapon === 'plasma') {
            push({
                x: cx - 3,
                y: cy,
                width: 6,
                height: 6,
                speed: speed * 0.85,
                vx: aimVx * 0.6,
                damage,
                color: '#70c0e0',
                type: 'enemy_plasma'
            });
        } else {
            push({
                x: cx - 1.5,
                y: cy,
                width: 3,
                height: 12,
                speed,
                vx: aimVx,
                damage,
                color: '#a0a0a0',
                type: 'enemy_laser'
            });
        }
    },

    rectsOverlap(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x &&
            a.y < b.y + b.height && a.y + a.height > b.y;
    },

    drawPreview() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        if (!canvas || !ctx || !this.draft) return;

        const now = performance.now();
        const dt = this.previewLastTs ? Math.min(48, now - this.previewLastTs) : 16;
        this.previewLastTs = now;
        if (!this.previewSim) this.resetPreviewSim();
        this.updatePreviewSim(dt);

        const w = canvas.width;
        const h = canvas.height;
        const sim = this.previewSim;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(200, 180, 140, 0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 97) % w;
            const sy = (i * 53 + Math.floor(sim.starPhase * 20)) % h;
            ctx.fillRect(sx, sy, 2, 2);
        }

        // Enemy bullets
        for (const b of sim.enemyBullets) {
            ctx.fillStyle = b.color || '#c06040';
            if (b.type === 'enemy_plasma') {
                ctx.beginPath();
                ctx.arc(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(b.x, b.y, b.width, b.height);
            }
        }

        // Player bullets (visible — player ship is not)
        for (const b of sim.playerBullets) {
            ctx.fillStyle = b.color || '#e07028';
            ctx.fillRect(b.x, b.y, b.width, b.height);
        }

        const model = this.getPreviewModel();
        const e = sim.enemy;
        let rendered = false;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            const prev = graphicsManager.currentEnemyModel;
            graphicsManager.currentEnemyModel = model;
            try {
                if (sim.hitFlash > 0) {
                    ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(sim.hitFlash * 0.08));
                }
                graphicsManager.renderEnemyShip(ctx, {
                    x: e.x,
                    y: e.y,
                    width: e.width,
                    height: e.height,
                    type: this.selectedType
                }, 1);
                rendered = true;
            } finally {
                ctx.globalAlpha = 1;
                graphicsManager.currentEnemyModel = prev;
            }
        }
        if (!rendered) {
            if (model.sprite) this.drawPixelSprite(ctx, model, e.x, e.y, 1);
            else {
                ctx.fillStyle = sim.hitFlash > 0 ? '#fff' : '#e07028';
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
        }

        // Evasion indicator ring
        if (sim.isEvading) {
            ctx.strokeStyle = 'rgba(224, 112, 40, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(e.x + e.width / 2, e.y + e.height / 2, Math.max(e.width, e.height) * 0.85, 0, Math.PI * 2);
            ctx.stroke();
        }

        // HUD
        ctx.fillStyle = '#e07028';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(this.draft.name || this.selectedType).toUpperCase(), w / 2, h - 46);
        ctx.fillStyle = '#b09070';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(`HP ${this.draft.maxHealth}  SPD ${Number(this.draft.speed).toFixed(2)}`, w / 2, h - 32);
        ctx.fillText(`ARM ${this.draft.armor}  SHD ${this.draft.shieldMax || 0}  DMG ${this.draft.damage}`, w / 2, h - 20);
        const evadeTag = sim.isEvading ? ' EVADE' : '';
        ctx.fillText(`SHOT ${this.draft.shootInterval}ms  ${String(this.draft.defaultWeapon || '').toUpperCase()}${evadeTag}`, w / 2, h - 8);
    },

    drawPixelSprite(ctx, model, x, y, scale) {
        const sprite = model.sprite;
        if (!sprite || !sprite.length) return;
        const colors = model.colors || {
            0: 'transparent',
            1: '#404040',
            2: '#808080',
            3: '#C0C0C0'
        };
        const rows = sprite.length;
        const cols = sprite[0].length;
        const pw = (model.width * scale) / cols;
        const ph = (model.height * scale) / rows;
        ctx.save();
        // Flip vertically like enemies
        ctx.translate(x + (model.width * scale) / 2, y + (model.height * scale) / 2);
        ctx.scale(1, -1);
        ctx.translate(-(model.width * scale) / 2, -(model.height * scale) / 2);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = sprite[r][c];
                if (!v) continue;
                let color = colors[v] || '#888';
                if (typeof color === 'string' && color.indexOf('var(') === 0) {
                    color = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#e07028';
                }
                ctx.fillStyle = color;
                ctx.fillRect(c * pw, r * ph, Math.ceil(pw), Math.ceil(ph));
            }
        }
        ctx.restore();
    },
});
