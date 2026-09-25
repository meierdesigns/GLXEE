"use strict";

// ShipEditorUI methods, split from ship-editor.js.
extendClass(ShipEditorUI, {
    updatePreviewSim(dtMs) {
        const sim = this.previewSim;
        const d = this.draft;
        if (!sim || !d) return;
        const frameScale = dtMs / 16.67;
        const model = this.getPreviewModel();
        const shipW = Math.round((model.width || 20) * 1.5);
        const shipH = Math.round((model.height || 16) * 1.5);
        const p = sim.player;
        p.width = shipW;
        p.height = shipH;
        const speed = Math.max(0.5, Number(d.speed) || 4) * 0.35;
        p.x += p.dir * speed * frameScale;
        if (p.x <= 8 || p.x + p.width >= 192) {
            p.dir *= -1;
            p.x = Math.max(8, Math.min(192 - p.width, p.x));
        }
        p.y = 300 - 50 + Math.sin(sim.starPhase * 1.5) * 3;
        sim.starPhase += dtMs * 0.004;

        sim.shootAcc += dtMs;
        const cooldown = Math.max(80, Number(d.weaponCooldown) || 300);
        if (sim.shootAcc >= cooldown) {
            sim.shootAcc = 0;
            const bulletSpeed = Math.max(2, Number(d.weaponSpeed) || 8);
            sim.bullets.push({
                x: p.x + p.width / 2 - 1,
                y: p.y - 4,
                vy: -bulletSpeed,
                life: 1200
            });
        }
        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y > -10;
        });
    },

    drawPreview() {
        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        const sim = this.previewSim;
        if (!ctx || !canvas || !sim) return;
        const w = this.previewBaseWidth;
        const h = this.previewBaseHeight;
        const backingScale = this.previewBackingScale || 1;
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        ctx.scale(backingScale, backingScale);
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,140,40,0.35)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 47 + sim.starPhase * 20) % w;
            const sy = (i * 73 + sim.starPhase * 8) % h;
            ctx.fillRect(sx, sy, 1, 1);
        }

        ctx.strokeStyle = 'rgba(255,140,40,0.15)';
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        sim.bullets.forEach((b) => {
            ctx.fillStyle = '#ffaa44';
            ctx.fillRect(b.x, b.y, 2, 6);
        });

        const model = this.getPreviewModel();
        const p = sim.player;
        if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            // Size the offscreen ship canvas to the actual backing-store density
            // (not the fixed logical p.width/height) so the hull/module pixels
            // regenerate crisp at the current zoom instead of being upscaled.
            tmp.width = Math.max(1, Math.round(p.width * backingScale));
            tmp.height = Math.max(1, Math.round(p.height * backingScale));
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, p.x, p.y, p.width, p.height);
        } else if (model.sprite) {
            const scale = Math.max(1, Math.floor(p.width / (model.width || 20)));
            for (let row = 0; row < model.sprite.length; row++) {
                for (let col = 0; col < model.sprite[row].length; col++) {
                    const pixel = model.sprite[row][col];
                    if (!pixel) continue;
                    ctx.fillStyle = (model.colors && model.colors[pixel]) || '#ccc';
                    ctx.fillRect(p.x + col * scale, p.y + row * scale, scale, scale);
                }
            }
        } else {
            ctx.fillStyle = '#ff8c28';
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.fillStyle = 'rgba(255,140,40,0.85)';
        ctx.font = '10px monospace';
        ctx.fillText((this.draft && this.draft.name) || 'SHIP', 8, 14);
        ctx.fillText(`SPD ${this.draft ? this.draft.speed : 0}`, 8, 28);
        ctx.fillText(`HP ${this.draft ? this.draft.maxHealth : 0}`, 8, 42);
        ctx.restore();
    },
});
