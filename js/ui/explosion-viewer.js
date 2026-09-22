"use strict";

/**
 * Explosion Viewer — browse / edit explosion presets.
 * Open: Home Station → Explorations → EXPLOSIONS
 */
class ExplosionViewerUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.items = [];
        this.overlay = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.previewAnimId = null;
        this.previewLastTs = 0;
        this._keyHandler = (e) => this.handleKeyDown(e);
        this._previewBurst = null;
    }

    getList() {
        if (typeof explosionConfigManager === 'undefined') return [];
        return explosionConfigManager.getIds().map((id) => {
            return Object.assign({}, explosionConfigManager.getPreset(id));
        });
    }

    show(options) {
        if (options && Object.prototype.hasOwnProperty.call(options, 'onClose')) {
            this.onClose = options.onClose;
        }
        this.items = this.getList();
        if (!this.items.length) return;
        const preferId = options && options.explosionId;
        if (preferId) {
            const idx = this.items.findIndex((p) => p.id === preferId);
            if (idx >= 0) this.selectedIndex = idx;
        }
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.items.length - 1));
        this.visible = true;
        this.createUI();
        document.addEventListener('keydown', this._keyHandler);
        if (!(options && options.skipPersist) && typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('explosion-viewer', {
                explosionId: this.items[this.selectedIndex].id
            });
        }
    }

    hide() {
        this.visible = false;
        this.stopPreview();
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.previewCanvas = null;
        this.previewCtx = null;
        this._previewBurst = null;
    }

    createUI() {
        if (this.overlay) this.overlay.remove();
        this.overlay = document.createElement('div');
        this.overlay.className = 'content-viewer-overlay';
        this.overlay.innerHTML = `
            <div class="content-viewer-panel">
                <h2 class="content-viewer-title">EXPLOSIONS</h2>
                <div class="content-viewer-body has-preview" id="xvViewerBody">
                    <aside class="content-viewer-list" id="xvList"></aside>
                    <div class="content-viewer-detail" id="xvDetail"></div>
                    <aside class="content-viewer-preview planet-editor-preview-wrap" id="xvPreviewWrap">
                        <div class="pe-preview-toolbar">
                            <button type="button" class="pe-btn pe-preview-btn" id="xvPlay">PLAY</button>
                        </div>
                        <div class="pe-preview-viewport" id="xvPreviewViewport">
                            <canvas id="xvPreview" width="200" height="240"></canvas>
                        </div>
                        <div class="pe-preview-label">PREVIEW</div>
                    </aside>
                </div>
                <div class="content-viewer-footer">
                    <button type="button" class="pe-btn" id="xvNew">NEW</button>
                    <button type="button" class="pe-btn" id="xvReset">RESET</button>
                    <button type="button" class="pe-btn" id="xvClose">CLOSE</button>
                </div>
                <div class="content-viewer-hint">↑↓ Navigate • ESC Close</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.previewCanvas = this.overlay.querySelector('#xvPreview');
        this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;

        this.overlay.querySelector('#xvClose').addEventListener('click', () => this.close());
        this.overlay.querySelector('#xvPlay').addEventListener('click', () => this.triggerPreviewBurst());
        this.overlay.querySelector('#xvNew').addEventListener('click', () => this.createNew());
        this.overlay.querySelector('#xvReset').addEventListener('click', () => {
            if (typeof explosionConfigManager !== 'undefined') {
                explosionConfigManager.resetToDefaults();
                this.items = this.getList();
                this.selectedIndex = 0;
                this.renderList();
                this.renderDetail();
                this.triggerPreviewBurst();
            }
        });

        this.renderList();
        this.renderDetail();
        this.triggerPreviewBurst();
        this.startPreview();
    }

    close() {
        const cb = this.onClose;
        this.hide();
        if (typeof menuStateManager !== 'undefined') {
            menuStateManager.setScreen('start');
        }
        if (typeof cb === 'function') cb();
    }

    createNew() {
        if (typeof explosionConfigManager === 'undefined') return;
        const id = 'custom_' + Date.now().toString(36).slice(-5);
        const base = this.items[this.selectedIndex] || explosionConfigManager.getPreset('default');
        explosionConfigManager.createPreset(id, Object.assign({}, base, {
            id: id,
            name: 'Custom ' + id.slice(-4).toUpperCase()
        }));
        this.items = this.getList();
        this.selectedIndex = this.items.findIndex((p) => p.id === id);
        if (this.selectedIndex < 0) this.selectedIndex = 0;
        this.renderList();
        this.renderDetail();
        this.triggerPreviewBurst();
    }

    current() {
        return this.items[this.selectedIndex] || null;
    }

    persistCurrent() {
        const cur = this.current();
        if (!cur || typeof explosionConfigManager === 'undefined') return;
        explosionConfigManager.setPreset(cur.id, cur);
        this.items = this.getList();
        const idx = this.items.findIndex((p) => p.id === cur.id);
        if (idx >= 0) this.selectedIndex = idx;
    }

    renderList() {
        const list = this.overlay && this.overlay.querySelector('#xvList');
        if (!list) return;
        list.innerHTML = '';
        this.items.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'content-viewer-list-item' + (i === this.selectedIndex ? ' active' : '');
            btn.textContent = (item.name || item.id || '').toUpperCase();
            btn.addEventListener('click', () => {
                this.selectedIndex = i;
                this.renderList();
                this.renderDetail();
                this.triggerPreviewBurst();
                if (typeof menuStateManager !== 'undefined') {
                    menuStateManager.setScreen('explosion-viewer', { explosionId: item.id });
                }
            });
            list.appendChild(btn);
        });
    }

    renderDetail() {
        const detail = this.overlay && this.overlay.querySelector('#xvDetail');
        const cur = this.current();
        if (!detail || !cur) return;
        detail.innerHTML = '';

        detail.appendChild(this.makeText('Name', cur.name, (v) => {
            cur.name = v;
            this.persistCurrent();
            this.renderList();
        }));
        detail.appendChild(this.makeSlider('Particles', cur.particleCount, 0, 48, 1, (v) => {
            cur.particleCount = Math.round(v);
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Speed', cur.particleSpeed, 0.5, 8, 0.1, (v) => {
            cur.particleSpeed = Math.round(v * 10) / 10;
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Life', cur.particleLife, 10, 100, 1, (v) => {
            cur.particleLife = Math.round(v);
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Size', cur.particleSize, 0.5, 6, 0.1, (v) => {
            cur.particleSize = Math.round(v * 10) / 10;
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Rings', cur.rings, 0, 4, 1, (v) => {
            cur.rings = Math.round(v);
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Ring ms', cur.ringDurationMs, 100, 3000, 50, (v) => {
            cur.ringDurationMs = Math.round(v);
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Ring scale', cur.ringScale, 0.3, 3, 0.05, (v) => {
            cur.ringScale = Math.round(v * 100) / 100;
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Sparkles', cur.sparkles, 0, 24, 1, (v) => {
            cur.sparkles = Math.round(v);
            this.persistCurrent();
        }));
        const sounds = (typeof explosionConfigManager !== 'undefined')
            ? explosionConfigManager.soundOptions
            : ['explosion', 'kill', 'hit', 'none'];
        detail.appendChild(this.makeSelect('Sound', cur.sound || 'explosion', sounds, (v) => {
            cur.sound = v;
            this.persistCurrent();
        }));
        detail.appendChild(this.makeSlider('Shake', cur.screenShake, 0, 1, 0.05, (v) => {
            cur.screenShake = Math.round(v * 100) / 100;
            this.persistCurrent();
        }));

        const colorsHint = document.createElement('div');
        colorsHint.className = 'pe-hint';
        colorsHint.textContent = 'Colors: ' + (cur.colors || []).join(', ');
        detail.appendChild(colorsHint);

        const builtins = typeof explosionConfigManager !== 'undefined'
            ? explosionConfigManager.createDefaults()
            : {};
        if (!builtins[cur.id]) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'pe-btn';
            del.textContent = 'DELETE';
            del.addEventListener('click', () => {
                if (typeof explosionConfigManager !== 'undefined') {
                    explosionConfigManager.deletePreset(cur.id);
                    this.items = this.getList();
                    this.selectedIndex = Math.min(this.selectedIndex, this.items.length - 1);
                    this.renderList();
                    this.renderDetail();
                }
            });
            detail.appendChild(del);
        }
    }

    makeSlider(labelText, value, min, max, step, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const val = document.createElement('span');
        val.className = 'pe-val';
        val.textContent = String(value);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('input', () => {
            const v = Number(input.value);
            val.textContent = String(v);
            onChange(v);
        });
        row.appendChild(label);
        row.appendChild(val);
        row.appendChild(input);
        return row;
    }

    makeSelect(labelText, value, options, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        options.forEach((opt) => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === value) o.selected = true;
            select.appendChild(o);
        });
        select.addEventListener('change', () => onChange(select.value));
        row.appendChild(label);
        row.appendChild(select);
        return row;
    }

    makeText(labelText, value, onChange) {
        const row = document.createElement('div');
        row.className = 'pe-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.addEventListener('change', () => onChange(input.value));
        row.appendChild(label);
        row.appendChild(input);
        return row;
    }

    triggerPreviewBurst() {
        const cur = this.current();
        if (!cur || !this.previewCanvas) return;
        const cx = this.previewCanvas.width / 2;
        const cy = this.previewCanvas.height / 2;
        this._previewBurst = {
            x: cx,
            y: cy,
            width: 28,
            height: 28,
            timer: 0,
            duration: cur.ringDurationMs,
            rings: cur.rings,
            ringScale: cur.ringScale,
            sparkles: cur.sparkles,
            colors: (cur.colors || []).slice(),
            particles: []
        };
        const n = cur.particleCount || 0;
        for (let i = 0; i < n; i++) {
            const angle = (Math.PI * 2 * i) / Math.max(1, n);
            const speed = cur.particleSpeed * (0.7 + Math.random() * 0.6);
            this._previewBurst.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: cur.particleLife,
                maxLife: cur.particleLife,
                size: cur.particleSize,
                color: (cur.colors && cur.colors[i % cur.colors.length]) || '#ff8844'
            });
        }
    }

    startPreview() {
        this.stopPreview();
        this.previewLastTs = 0;
        const tick = (ts) => {
            if (!this.visible) return;
            const dt = this.previewLastTs ? Math.min(50, ts - this.previewLastTs) : 16;
            this.previewLastTs = ts;
            this.updatePreview(dt);
            this.drawPreview();
            this.previewAnimId = requestAnimationFrame(tick);
        };
        this.previewAnimId = requestAnimationFrame(tick);
    }

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
    }

    updatePreview(dt) {
        const b = this._previewBurst;
        if (!b) return;
        b.timer += dt;
        for (let i = b.particles.length - 1; i >= 0; i--) {
            const p = b.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08;
            p.vx *= 0.98;
            p.life -= dt / 16;
            if (p.life <= 0) b.particles.splice(i, 1);
        }
        if (b.timer >= b.duration && !b.particles.length) {
            this.triggerPreviewBurst();
        }
    }

    resolveColor(color) {
        if (!color) return '#ff8844';
        if (String(color).indexOf('var(') === -1) return color;
        try {
            const match = String(color).match(/var\(\s*(--[^)\s]+)/);
            if (match) {
                const v = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                if (v) return v;
            }
        } catch (e) { /* ignore */ }
        return '#ff8844';
    }

    drawPreview() {
        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        if (!ctx || !canvas) return;
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const b = this._previewBurst;
        if (!b) return;

        if (typeof explosionSystem !== 'undefined' && explosionSystem.drawBurst) {
            explosionSystem.drawBurst(ctx, b);
        }

        ctx.save();
        for (let i = 0; i < b.particles.length; i++) {
            const p = b.particles[i];
            ctx.globalAlpha = Math.max(0.3, p.life / p.maxLife);
            ctx.fillStyle = this.resolveColor(p.color);
            const s = Math.max(1, Math.ceil(p.size));
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), s, s);
        }
        ctx.restore();
    }

    handleKeyDown(e) {
        if (!this.visible) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
            this.renderList();
            this.renderDetail();
            this.triggerPreviewBurst();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
            this.renderList();
            this.renderDetail();
            this.triggerPreviewBurst();
        }
    }
}

const explosionViewerUI = new ExplosionViewerUI();
