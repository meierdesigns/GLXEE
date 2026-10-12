"use strict";

// ExplosionViewerUI methods, split from explosion-viewer.js.
extendClass(ExplosionViewerUI, {
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
    },

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
    },

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
    },

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
    },

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
    },

    stopPreview() {
        if (this.previewAnimId) {
            cancelAnimationFrame(this.previewAnimId);
            this.previewAnimId = null;
        }
    },

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
    },

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
    },

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
    },

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
    },
});
