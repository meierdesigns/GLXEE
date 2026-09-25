"use strict";

// HomeStationUI methods, split from home-station.js.
extendClass(HomeStationUI, {
    updateHangarPreviewSim(dtMs) {
        const sim = this._hangarPreviewSim;
        const canvas = this._hangarPreviewCanvas;
        if (!sim || !canvas) return;
        if (this._hangarPreviewShipId !== this.hangarShipId) {
            this.resetHangarPreviewSim();
            return;
        }

        const frameScale = dtMs / 16.67;
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarShipModel(shipId);
        const cfg = (typeof shipConfigManager !== 'undefined')
            ? shipConfigManager.getConfig(shipId)
            : null;
        const size = this.hangarCloseupSize(model, canvas.width, canvas.height);
        const p = sim.player;
        p.width = size.width;
        p.height = size.height;

        sim.phase += dtMs * 0.0035;
        sim.modeTimer -= dtMs;
        if (sim.modeTimer <= 0) {
            sim.mode = sim.mode === 'fly' ? 'shoot' : 'fly';
            sim.modeTimer = sim.mode === 'shoot' ? 1600 + Math.random() * 900 : 2200 + Math.random() * 1400;
            if (sim.mode === 'shoot') {
                sim.burstLeft = 3 + Math.floor(Math.random() * 3);
                sim.burstGap = 0;
            }
        }

        const speed = Math.max(0.4, Number((cfg && cfg.speed) || model.speed || 4) * 0.22);
        const margin = Math.max(12, (canvas.width - size.width) * 0.18);
        const baseX = (canvas.width - size.width) / 2;
        const sway = Math.sin(sim.phase) * Math.min(28, canvas.width * 0.08);
        if (sim.mode === 'fly') {
            p.x = baseX + sway + Math.sin(sim.phase * 0.55) * 10;
            p.dir = Math.cos(sim.phase) >= 0 ? 1 : -1;
        } else {
            p.x += p.dir * speed * 0.35 * frameScale;
            if (p.x <= margin || p.x + p.width >= canvas.width - margin) {
                p.dir *= -1;
                p.x = Math.max(margin, Math.min(canvas.width - margin - p.width, p.x));
            }
        }
        p.x = Math.max(8, Math.min(canvas.width - p.width - 8, p.x));
        p.y = canvas.height * 0.40 + Math.sin(sim.phase * 1.35) * 10;

        // Engine thrust particles (flying feel)
        if (Math.random() < 0.55) {
            sim.thrust.push({
                x: p.x + p.width * (0.35 + Math.random() * 0.3),
                y: p.y + p.height - 2,
                vy: 1.2 + Math.random() * 1.6,
                life: 280 + Math.random() * 220,
                w: 2 + Math.floor(Math.random() * 2)
            });
        }
        sim.thrust = sim.thrust.filter((t) => {
            t.y += t.vy * frameScale;
            t.life -= dtMs;
            return t.life > 0 && t.y < canvas.height + 8;
        });

        // Intermittent shooting bursts
        const cooldown = Math.max(70, Number((cfg && cfg.weaponCooldown) || model.weaponCooldown || 300));
        const bulletSpeed = Math.max(2.5, Number((cfg && cfg.weaponSpeed) || model.weaponSpeed || 8) * 0.85);
        if (sim.mode === 'shoot' && sim.burstLeft > 0) {
            sim.burstGap -= dtMs;
            if (sim.burstGap <= 0) {
                sim.burstGap = Math.min(160, cooldown * 0.45);
                sim.burstLeft -= 1;
                sim.bullets.push({
                    x: p.x + p.width / 2 - 1,
                    y: p.y - 4,
                    vy: -bulletSpeed,
                    life: 1400,
                    w: 2,
                    h: 6
                });
            }
        } else {
            sim.shootAcc += dtMs;
            if (sim.shootAcc >= sim.nextBurst) {
                sim.shootAcc = 0;
                sim.nextBurst = 1400 + Math.random() * 1600;
                sim.burstLeft = 2 + Math.floor(Math.random() * 3);
                sim.burstGap = 0;
                sim.mode = 'shoot';
                sim.modeTimer = 900 + sim.burstLeft * 120;
            }
        }

        sim.bullets = sim.bullets.filter((b) => {
            b.y += b.vy * frameScale;
            b.life -= dtMs;
            return b.life > 0 && b.y > -16;
        });
    },

    drawHangarPreview() {
        const ctx = this._hangarPreviewCtx;
        const canvas = this._hangarPreviewCanvas;
        const sim = this._hangarPreviewSim;
        if (!ctx || !canvas || !sim) return;

        const w = canvas.width;
        const h = canvas.height;
        const accent = this.getHangarPreviewAccent();
        const shipId = this.hangarShipId || 'player_scrap';
        let model = this.getHangarShipModel(shipId);
        if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.applyLayoutToModel) {
            model = Object.assign({}, model);
            shipLoadoutManager.applyLayoutToModel(model, shipId);
        }

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, w, h);

        // Starfield — vertical scroll only (matches playfield motion cues)
        ctx.fillStyle = accent;
        for (let i = 0; i < 48; i++) {
            const alpha = 0.18 + (i % 5) * 0.08;
            ctx.globalAlpha = alpha;
            const sx = (i * 53) % w;
            const sy = (i * 79 + sim.phase * 36) % h;
            ctx.fillRect(sx, sy, 1 + (i % 3 === 0 ? 1 : 0), 1);
        }
        ctx.globalAlpha = 1;

        // Soft vignette ring
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.22;
        ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        ctx.globalAlpha = 1;

        // Thrust
        sim.thrust.forEach((t) => {
            ctx.globalAlpha = Math.max(0.15, t.life / 500);
            ctx.fillStyle = accent;
            ctx.fillRect(t.x, t.y, t.w, t.w + 2);
        });
        ctx.globalAlpha = 1;

        // Bullets
        sim.bullets.forEach((b) => {
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.95;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.globalAlpha = 0.35;
            ctx.fillRect(b.x - 1, b.y + 2, b.w + 2, b.h - 2);
        });
        ctx.globalAlpha = 1;

        const p = sim.player;
        if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
            const scale = Math.min(p.width / (model.width || 20), p.height / (model.height || 16));
            graphicsManager.shipAssetLoader.renderShip(ctx, model, p.x, p.y, scale, null, 0, {
                showThrusterGlow: true,
                allowColorMountSprites: true
            });
        } else if (typeof shipRenderer !== 'undefined') {
            if (shipRenderer.init) shipRenderer.init();
            const tmp = document.createElement('canvas');
            tmp.width = Math.max(1, p.width);
            tmp.height = Math.max(1, p.height);
            shipRenderer.renderShipPreview(tmp, model, 1);
            ctx.drawImage(tmp, Math.round(p.x), Math.round(p.y), p.width, p.height);
        } else {
            ctx.fillStyle = accent;
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.shipName(shipId), 10, 16);
        ctx.globalAlpha = 0.55;
        ctx.fillText(sim.mode === 'shoot' ? 'FIRE' : 'FLY', 10, 30);
        ctx.globalAlpha = 1;
    },

    captureFlashTarget(btn) {
        if (!btn || !btn.getAttribute) return null;
        const attrs = [
            'data-upgrade-node', 'data-upgrade', 'data-frame-up', 'data-mod-up',
            'data-travel', 'data-unlock', 'data-buy', 'data-buy-bp', 'data-buy-part',
            'data-buy-portal', 'data-craft', 'data-activate-ship', 'data-toggle-mod',
            'data-hangar-slot-set', 'data-fire-mode', 'id'
        ];
        for (let i = 0; i < attrs.length; i++) {
            const a = attrs[i];
            if (!btn.hasAttribute(a)) continue;
            const out = { attr: a, value: btn.getAttribute(a), ok: false };
            if (a === 'data-toggle-mod') out.modId = btn.getAttribute('data-mod-id');
            if (a === 'data-hangar-slot-set') {
                out.modId = btn.getAttribute('data-mod-id');
                out.slotIndex = btn.getAttribute('data-slot-index');
            }
            return out;
        }
        return null;
    },

    flashResult(el, ok) {
        if (!el) return;
        el.classList.remove('hs-fx-ok', 'hs-fx-fail');
        void el.offsetWidth;
        el.classList.add(ok ? 'hs-fx-ok' : 'hs-fx-fail');
        const status = this.overlay && this.overlay.querySelector('.hs-status');
        if (status) {
            status.classList.remove('hs-status-ok', 'hs-status-fail');
            void status.offsetWidth;
            status.classList.add(ok ? 'hs-status-ok' : 'hs-status-fail');
        }
        if (this._fxClearTimer) clearTimeout(this._fxClearTimer);
        this._fxClearTimer = setTimeout(() => {
            el.classList.remove('hs-fx-ok', 'hs-fx-fail');
            if (status) status.classList.remove('hs-status-ok', 'hs-status-fail');
            this._fxClearTimer = null;
        }, 520);
    },

    applyPendingFlash() {
        const p = this._pendingFlash;
        this._pendingFlash = null;
        if (!p || !this.overlay) return;
        let el = null;
        if (p.attr === 'id') {
            el = this.overlay.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(p.value) : p.value));
        } else {
            const nodes = this.overlay.querySelectorAll('[' + p.attr + ']');
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n.getAttribute(p.attr) !== p.value) continue;
                if (p.attr === 'data-toggle-mod' && p.modId && n.getAttribute('data-mod-id') !== p.modId) continue;
                if (p.attr === 'data-hangar-slot-set') {
                    if (p.modId != null && n.getAttribute('data-mod-id') !== p.modId) continue;
                    if (p.slotIndex != null && n.getAttribute('data-slot-index') !== String(p.slotIndex)) continue;
                }
                el = n;
                break;
            }
        }
        if (el) this.flashResult(el, !!p.ok);
    },

    setStatus(msg, opts) {
        this.statusMsg = String(msg || '');
        if (opts && opts.refresh === false && this.overlay) {
            const status = this.overlay.querySelector('.hs-status');
            if (status) {
                status.textContent = this.statusMsg || '\u00A0';
                status.classList.toggle('is-empty', !this.statusMsg);
            }
            return;
        }
        this.createUI();
    },
});
