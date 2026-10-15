"use strict";

// HomeStationUI members, continued from update-hangar-preview-sim.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
    drawHangarPreview() {
        const ctx = this._hangarPreviewCtx;
        const canvas = this._hangarPreviewCanvas;
        const sim = this._hangarPreviewSim;
        if (!ctx || !canvas || !sim) return;

        const w = canvas.width;
        const h = canvas.height;
        const accent = this.getHangarPreviewAccent();
        const shipId = this.hangarShipId || 'player_scrap';
        const model = this.getHangarPreviewModel(shipId);

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

        // Right-drag pan (bindHangarPreviewPan): moves the scene, not the HUD text.
        ctx.save();
        ctx.translate(Math.round(this._hangarPreviewPanX || 0), Math.round(this._hangarPreviewPanY || 0));

        // Thrust
        sim.thrust.forEach((t) => {
            ctx.globalAlpha = Math.max(0.15, t.life / 500);
            ctx.fillStyle = accent;
            ctx.fillRect(t.x, t.y, t.w, t.w + 2);
        });
        ctx.globalAlpha = 1;

        const en = sim.enemy;
        if (en && en.respawn <= 0 && typeof graphicsManager !== 'undefined' && graphicsManager.renderEnemyShip) {
            graphicsManager.renderEnemyShip(ctx, en, 1);
            if (en.hitFlash > 0) {
                // Flash only the ship's pixels, not its box.
                if (!this._hangarEnemyBuf) this._hangarEnemyBuf = document.createElement('canvas');
                const eb = this._hangarEnemyBuf;
                eb.width = Math.max(1, en.width + 8);
                eb.height = Math.max(1, en.height + 8);
                const ectx = eb.getContext('2d');
                ectx.imageSmoothingEnabled = false;
                graphicsManager.renderEnemyShip(ectx, Object.assign({}, en, { x: 4, y: 4 }), 1);
                ectx.globalCompositeOperation = 'source-atop';
                ectx.fillStyle = '#ffffff';
                ectx.fillRect(0, 0, eb.width, eb.height);
                ctx.globalAlpha = 0.6 * en.hitFlash / 120;
                ctx.drawImage(eb, Math.round(en.x) - 4, Math.round(en.y) - 4);
                ctx.globalAlpha = 1;
            }
            // Shield bar on top, health bar below it, just above the ship.
            const bw = Math.max(30, en.width);
            const bx = Math.round(en.x + (en.width - bw) / 2);
            const bar = (y, frac, color) => {
                ctx.fillStyle = '#05060a';
                ctx.fillRect(bx - 1, y - 1, bw + 2, 6);
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fillRect(bx, y, bw, 4);
                ctx.fillStyle = color;
                ctx.fillRect(bx, y, Math.round(bw * Math.max(0, Math.min(1, frac))), 4);
            };
            const top = Math.round(en.y) - 16;
            if (en.shieldMax > 0) bar(top, en.shield / en.shieldMax, '#4ad8ff');
            bar(top + 7, en.health / en.maxHealth, '#ff4d4d');
        }
        (sim.damageTexts || []).forEach((t) => {
            ctx.globalAlpha = Math.min(1, t.life / 300);
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#05060a';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.shield ? '#4ad8ff' : '#ffd24a';
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
        });

        // Bullets — same renderer as in-game shots
        const bullets = (sim.bm && sim.bm.bullets) || [];
        bullets.forEach((b) => {
            if (typeof renderManager !== 'undefined' && renderManager.drawBullet) {
                renderManager.drawBullet(ctx, b, null);
                return;
            }
            ctx.fillStyle = accent;
            ctx.fillRect(b.x, b.y, b.width, b.height);
        });
        ctx.globalAlpha = 1;

        const p = sim.player;
        const recharging = !!(sim.bm && sim.bm.lastShots && Object.keys(sim.bm.lastShots).length);
        if (!recharging && typeof graphicsManager !== 'undefined' && graphicsManager.renderPlayerShip) {
            // Nothing recharging: draw straight to the preview (no extra buffer pass).
            const prev = graphicsManager.currentPlayerModel;
            graphicsManager.currentPlayerModel = model;
            graphicsManager.renderPlayerShip(ctx, p, 1);
            graphicsManager.currentPlayerModel = prev;
            if (sim.bm && sim.bm.drawMuzzleFlashes) sim.bm.drawMuzzleFlashes(ctx, p);
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.renderPlayerShip) {
            // Exactly the in-game path (colour overlay, thruster glow, fit),
            // into a transparent buffer so the recharge tint can be masked to
            // the weapon pixels.
            if (!this._hangarPreviewShipBuf) this._hangarPreviewShipBuf = document.createElement('canvas');
            const buf = this._hangarPreviewShipBuf;
            if (buf.width !== w) buf.width = w;
            if (buf.height !== h) buf.height = h;
            const bctx = buf.getContext('2d');
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.clearRect(0, 0, w, h);
            bctx.imageSmoothingEnabled = false;
            const prev = graphicsManager.currentPlayerModel;
            graphicsManager.currentPlayerModel = model;
            graphicsManager.renderPlayerShip(bctx, p, 1);
            graphicsManager.currentPlayerModel = prev;
            this.drawHangarPreviewRecharge(bctx, p, sim.bm);
            ctx.drawImage(buf, 0, 0);
            if (sim.bm && sim.bm.drawMuzzleFlashes) sim.bm.drawMuzzleFlashes(ctx, p);
        } else if (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader) {
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

        ctx.restore();

        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.shipName(shipId), 10, 22);
        ctx.globalAlpha = 0.55;
        ctx.font = '13px monospace';
        const allKey = this.hangarPreviewAllKey(shipId);
        const keyName = (k) => (k === 'space' ? 'SPACE' : k.toUpperCase());
        ctx.fillText(sim.demoKey ? 'FIRE · ' + keyName(sim.demoKey) + (sim.demoKey === allKey ? ' (ALL)' : '') : 'FLY', 10, 40);
        ctx.globalAlpha = 1;

        this.drawHangarPreviewEnergyBar(ctx, w, h, sim, accent);
    },
    captureFlashTarget(btn) {
        if (!btn || !btn.getAttribute) return null;
        const attrs = [
            'data-upgrade-node', 'data-upgrade', 'data-frame-up', 'data-area-up', 'data-mod-up',
            'data-travel', 'data-unlock', 'data-buy', 'data-buy-bp', 'data-buy-part',
            'data-buy-portal', 'data-buy-style', 'data-sell-ship', 'data-sell-bp',
            'data-sell-part', 'data-sell-style', 'data-craft', 'data-activate-ship', 'data-toggle-mod',
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
        const status = document.getElementById('hsStatusToast');
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
        if (opts && opts.refresh === false) {
            if (this.statusMsg) this.showStatusToast(this.statusMsg);
            this.statusMsg = '';
            return;
        }
        this.createUI();
    },
    /**
     * Temporary toast top-right, under the logout button, in the station UI style.
     * Lives on <body> so overlay re-renders don't cut it short; fades out on its own.
     */
    showStatusToast(msg) {
        const text = String(msg || '').trim();
        if (!text) return;
        let el = document.getElementById('hsStatusToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'hsStatusToast';
            el.className = 'hs-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.remove('is-visible', 'hs-status-ok', 'hs-status-fail');
        // Header height varies by skin/responsive breakpoint — anchor under the
        // logout button itself instead of a fixed CSS offset (see part-13.css .hs-toast).
        try {
            const logout = document.getElementById('hsLogout');
            if (logout) {
                const rect = logout.getBoundingClientRect();
                if (rect.bottom > 0) el.style.top = Math.round(rect.bottom + 8) + 'px';
            }
        } catch (e) { /* ignore */ }
        void el.offsetWidth;
        el.classList.add('is-visible');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        // Longer messages stay a little longer.
        const ms = Math.min(6000, 2600 + text.length * 30);
        this._toastTimer = setTimeout(() => {
            el.classList.remove('is-visible');
            this._toastTimer = null;
        }, ms);
    },
});
