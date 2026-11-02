"use strict";

// HomeStationUI: draggable column borders in the station storage grid
// (owned ships | blueprints | parts). Widths are kept as fr weights.
const STATION_COLS_KEY = 'vf_station_cols_v1';
const STATION_COLS_MIN = 0.25;
// Floor below which a column's content (title + icon + grid) can no longer fit and gets clipped.
const STATION_COL_MIN_PX = 220;

extendClass(HomeStationUI, {
    getStationCols() {
        try {
            const v = JSON.parse(localStorage.getItem(STATION_COLS_KEY) || 'null');
            if (Array.isArray(v) && v.length === 3 && v.every((n) => n >= STATION_COLS_MIN)) return v;
        } catch (e) { /* ignore */ }
        return [1, 1, 1];
    },

    bindStationColumnResize() {
        const grid = this.overlay && this.overlay.querySelector('.hs-station-grid');
        if (!grid) return;
        const cols = this.getStationCols();
        const apply = () => { grid.style.gridTemplateColumns = cols.map((c) => `minmax(0, ${c}fr)`).join(' '); };
        apply();
        // A layout saved before STATION_COL_MIN_PX existed (or saved at a wider window) can still be
        // narrower than the current floor — renormalize it against the grid's actual rendered width.
        const normalize = () => {
            const total = cols.reduce((s, c) => s + c, 0);
            const px = grid.offsetWidth || 1;
            const minFr = Math.max(STATION_COLS_MIN, (STATION_COL_MIN_PX / px) * total);
            if (cols.every((c) => c >= minFr - 0.001)) return;
            let deficit = 0;
            for (let k = 0; k < cols.length; k++) {
                if (cols[k] < minFr) { deficit += minFr - cols[k]; cols[k] = minFr; }
            }
            const donors = cols.map((c, k) => k).filter((k) => cols[k] > minFr);
            const donorTotal = donors.reduce((s, k) => s + (cols[k] - minFr), 0) || 1;
            donors.forEach((k) => { cols[k] -= deficit * (cols[k] - minFr) / donorTotal; });
            apply(); place();
            try { localStorage.setItem(STATION_COLS_KEY, JSON.stringify(cols)); } catch (e) { /* ignore */ }
        };
        const panels = ['.hs-panel-ships', '.hs-panel-bp', '.hs-panel-parts']
            .map((s) => grid.querySelector(s));
        if (panels.some((p) => !p)) return;
        grid.style.position = 'relative';
        const handles = [0, 1].map((i) => {
            const h = document.createElement('div');
            h.className = 'hs-col-resize';
            h.title = 'Drag to resize (double-click to reset)';
            grid.appendChild(h);
            return h;
        });
        const place = () => {
            // Viewport rects ÷ ancestor scale → local coords. GUI zoom
            // makes getBoundingClientRect scaled while style.left/top stay unscaled.
            const gRect = grid.getBoundingClientRect();
            const scaleX = (gRect.width / (grid.clientWidth || grid.offsetWidth || 1)) || 1;
            const scaleY = (gRect.height / (grid.clientHeight || grid.offsetHeight || 1)) || 1;
            handles.forEach((h, i) => {
                const aRect = panels[i].getBoundingClientRect();
                const bRect = panels[i + 1].getBoundingClientRect();
                const aRight = (aRect.right - gRect.left) / scaleX;
                const bLeft = (bRect.left - gRect.left) / scaleX;
                const gap = Math.max(0, bLeft - aRight);
                const hw = Math.min(12, Math.max(8, gap - 2));
                h.style.width = hw + 'px';
                h.style.left = (aRight + gap / 2 - hw / 2) + 'px';
                h.style.top = ((aRect.top - gRect.top) / scaleY) + 'px';
                h.style.height = (aRect.height / scaleY) + 'px';
            });
        };
        place();
        normalize();
        handles.forEach((h, i) => {
            h.addEventListener('dblclick', () => {
                cols[0] = cols[1] = cols[2] = 1;
                apply(); place();
                try { localStorage.removeItem(STATION_COLS_KEY); } catch (e) { /* ignore */ }
            });
            h.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                h.setPointerCapture(e.pointerId);
                const total = cols.reduce((s, c) => s + c, 0);
                // Match clientX units (viewport/zoomed) — offsetWidth is unscaled under CSS zoom.
                const px = panels.reduce((s, p) => s + p.getBoundingClientRect().width, 0) || 1;
                const startX = e.clientX;
                const pair = cols[i] + cols[i + 1];
                const startA = cols[i];
                // Pixel floor converted to this drag's fr units, so a column can never be dragged
                // narrower than its content needs regardless of how wide the overall row is.
                const minFr = Math.max(STATION_COLS_MIN, (STATION_COL_MIN_PX / px) * total);
                h.classList.add('is-dragging');
                const move = (ev) => {
                    const d = (ev.clientX - startX) / px * total;
                    cols[i] = Math.max(minFr, Math.min(pair - minFr, startA + d));
                    cols[i + 1] = pair - cols[i];
                    apply(); place();
                };
                const up = () => {
                    h.classList.remove('is-dragging');
                    h.removeEventListener('pointermove', move);
                    h.removeEventListener('pointerup', up);
                    h.removeEventListener('pointercancel', up);
                    try { localStorage.setItem(STATION_COLS_KEY, JSON.stringify(cols)); } catch (err) { /* ignore */ }
                };
                h.addEventListener('pointermove', move);
                h.addEventListener('pointerup', up);
                h.addEventListener('pointercancel', up);
            });
        });
        if (window.ResizeObserver) new ResizeObserver(() => { place(); normalize(); }).observe(grid);
    },

    /** Hangar: RESET ANATOMY / SET AS DEFAULT sit on the right of the ship's title row, so the stats row keeps its room. */
    moveHangarBayTools() {
        const tools = this.overlay && this.overlay.querySelector('.hs-hangar-bay-tools');
        const title = this.overlay && this.overlay.querySelector('.hs-hangar-head-title');
        if (!tools || !title) return;
        tools.classList.add('is-topbar');
        title.appendChild(tools);
    }
});
