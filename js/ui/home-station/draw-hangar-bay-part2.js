"use strict";

// HomeStationUI members, continued from draw-hangar-bay.js (kept under ~500 lines per file).
extendClass(HomeStationUI, {
    /**
     * Installed parts are drawn as hull mounts, which all look alike. In the
     * hangar each one also shows its part icon (same as the PARTS grid), so
     * you can see what sits in which slot.
     */
    drawHangarModuleIcons(canvas, model, ox, oy, scale) {
        if (!canvas || !model || !model.layout || typeof iconRenderer === 'undefined') return;
        const ctx = canvas.getContext('2d');
        const tint = (getComputedStyle(this.overlay || document.documentElement)
            .getPropertyValue('--color-second-basecolor') || '').trim() || '#ffffff';
        // Parts stacked in one spot (shield + core in the fuselage) would hide
        // each other's icon: group overlapping mounts and list their icons
        // top to bottom on the centreline of the group.
        // Only weapons are placed on the ship; other parts are switched in the sidebar.
        // Icons only show for the hovered hull part.
        const hoverArea = this._hangarHoverArea;
        if (!hoverArea) return;
        const items = (model.layout.modules || []).filter((mod) => mod.kind === 'weapon'
            && this.hangarAreaAt(model.layout, mod.x + mod.width / 2, mod.y + mod.height / 2) === hoverArea).map((mod) => {
            const w = mod.width * scale;
            const h = mod.height * scale;
            return {
                mod: mod,
                cx: ox + mod.x * scale + w / 2,
                cy: oy + mod.y * scale + h / 2,
                size: Math.max(16, Math.floor(Math.min(w, h) * 0.8 / 16) * 16)
            };
        });
        const groups = [];
        items.forEach((it) => {
            const g = groups.find((gr) => gr.some((o) =>
                Math.abs(o.cx - it.cx) < (o.size + it.size) / 2 && Math.abs(o.cy - it.cy) < (o.size + it.size) / 2));
            if (g) g.push(it);
            else groups.push([it]);
        });
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        groups.forEach((g) => {
            const n = g.length;
            const cx = g.reduce((a, it) => a + it.cx, 0) / n;
            const cy = g.reduce((a, it) => a + it.cy, 0) / n;
            const base = Math.min.apply(null, g.map((it) => it.size));
            const size = n > 1 ? Math.max(16, Math.floor(base / n / 16) * 16 || 16) : base;
            const gap = 2;
            const total = n * size + (n - 1) * gap;
            g.forEach((it, i) => {
                const x = Math.round(cx - size / 2);
                const y = Math.round(cy - total / 2 + i * (size + gap));
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
                if (it.mod.kind === 'weapon' && iconRenderer.drawWeapon) {
                    iconRenderer.drawWeapon(ctx, it.mod.id, x, y, size);
                } else {
                    iconRenderer.drawKey(ctx, this.hangarModuleIconKey(it.mod.kind, it.mod.id), x, y, size, tint);
                }
            });
        });
        ctx.restore();
    },
    /** Hover feedback for an equipped part on the ship: glowing accent frame + tint. */
    drawHangarModuleHover(canvas, model, ox, oy, scale) {
        const hov = this._hangarHoverModule;
        if (!hov || !canvas || !model || !model.layout) return;
        const mod = (model.layout.modules || []).find((m) =>
            m.kind === hov.kind && m.id === hov.id && (!hov.face || m.face === hov.face));
        if (!mod) return;
        const ctx = canvas.getContext('2d');
        const accent = (getComputedStyle(this.overlay || document.documentElement)
            .getPropertyValue('--faction-accent') || '').trim() || '#ffffff';
        // Same box the pointer hits: clamped into the part's area.
        const b = this.hangarModuleHitBox(model.layout, mod);
        const x = Math.round(ox + b.x * scale) - 1;
        const y = Math.round(oy + b.y * scale) - 1;
        const w = Math.round(b.width * scale) + 2;
        const h = Math.round(b.height * scale) + 2;
        ctx.save();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 4;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    },
    /** Smallest hull part (front/center/back/wingLeft/wingRight) containing a layout point. */
    hangarAreaAt(layout, lx, ly) {
        let best = null;
        let bestArea = Infinity;
        (layout.segments || []).forEach((seg) => {
            if (lx < seg.x || lx > seg.x + seg.width || ly < seg.y || ly > seg.y + seg.height) return;
            const area = seg.width * seg.height;
            if (area < bestArea) {
                bestArea = area;
                best = seg.id;
            }
        });
        return best;
    },
    /** Reveal the slot pins of one hull part (null hides them all again). */
    setHangarHoverArea(areaId) {
        const changed = (areaId || null) !== (this._hangarHoverArea || null);
        this._hangarHoverArea = areaId || null;
        if (!this.overlay) return;
        if (changed && !this._hangarHoverAreaSyncing) {
            // Part icons are drawn on the canvas: redraw so they follow the hover.
            this._hangarHoverAreaSyncing = true;
            try { this.drawHangarBay(true); } finally { this._hangarHoverAreaSyncing = false; }
        }
        // A slot drag reveals its target area's slots; redraws keep that.
        const reveal = this._hangarDragRevealArea;
        const revealWing = reveal && reveal.indexOf('wing') === 0;
        this.overlay.querySelectorAll('.hs-hangar-slot').forEach((el) => {
            const at = el.getAttribute('data-slot-area') || '';
            const revealed = !!reveal && (revealWing ? at.indexOf('wing') === 0 : at === reveal);
            el.classList.toggle('is-area-hover', revealed || (!!areaId && at === areaId));
        });
    },
    /**
     * Draws the actual connector path from each dropdown card to its on-ship
     * mount point. A single CSS line couldn't do this: the card's anchor and
     * the pin sit at different heights (nose vs. mid vs. aft mounts), so a
     * horizontal-only stub stopped short of the mount instead of visibly
     * reaching it. This reads both real DOM rects (card + pin, both already
     * positioned correctly by CSS) and draws a straight diagonal line from
     * the card's edge directly to the pin's exact center — the center of the
     * mounted component — so it's always geometrically exact regardless of
     * zoom, panel resize, or how many slots share a rail.
     */
    updateHangarSlotLinks() {
        if (!this.overlay) return;
        const layer = this.overlay.querySelector('#hsHangarSlotLayer');
        const svg = this.overlay.querySelector('#hsHangarLinkSvg');
        if (!layer || !svg) return;
        const layerRect = layer.getBoundingClientRect();
        if (!layerRect.width || !layerRect.height) return;
        const seen = new Set();
        layer.querySelectorAll('.hs-hangar-slot').forEach((slotEl) => {
            const kind = slotEl.getAttribute('data-slot-kind');
            const index = slotEl.getAttribute('data-slot-index');
            const card = slotEl.querySelector('.hs-hangar-slot-card');
            const pin = slotEl.querySelector('.hs-hangar-slot-pin');
            if (!card || !pin || !kind || index == null) return;
            const cardRect = card.getBoundingClientRect();
            const pinRect = pin.getBoundingClientRect();
            const side = slotEl.getAttribute('data-slot-side') === 'left' ? 'left' : 'right';
            const startX = (side === 'left' ? cardRect.right : cardRect.left) - layerRect.left;
            const startY = (cardRect.top + cardRect.height / 2) - layerRect.top;
            const endX = (pinRect.left + pinRect.width / 2) - layerRect.left;
            const endY = (pinRect.top + pinRect.height / 2) - layerRect.top;
            const d = `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;
            const key = kind + ':' + index;
            seen.add(key);
            let path = svg.querySelector(`path[data-slot-kind="${kind}"][data-slot-index="${index}"]`);
            if (!path) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'hs-hangar-link');
                path.setAttribute('data-slot-kind', kind);
                path.setAttribute('data-slot-index', index);
                svg.appendChild(path);
            }
            path.setAttribute('d', d);
            const active = slotEl.classList.contains('is-open') || slotEl.classList.contains('is-hover-linked');
            path.classList.toggle('is-active', active);
        });
        svg.querySelectorAll('path[data-slot-kind]').forEach((path) => {
            const key = path.getAttribute('data-slot-kind') + ':' + path.getAttribute('data-slot-index');
            if (!seen.has(key)) path.remove();
        });
    },
});
