"use strict";

// HomeStationUI: draggable column borders in the station storage grid
// (owned ships | blueprints | parts). Widths are kept as fr weights.
const STATION_COLS_KEY = 'vf_station_cols_v1';
const STATION_COLS_MIN = 0.25;

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
            handles.forEach((h, i) => {
                const a = panels[i];
                const b = panels[i + 1];
                const gap = b.offsetLeft - (a.offsetLeft + a.offsetWidth);
                h.style.left = (a.offsetLeft + a.offsetWidth + gap / 2 - 6) + 'px';
                h.style.top = a.offsetTop + 'px';
                h.style.height = a.offsetHeight + 'px';
            });
        };
        place();
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
                const px = panels.reduce((s, p) => s + p.offsetWidth, 0) || 1;
                const startX = e.clientX;
                const pair = cols[i] + cols[i + 1];
                const startA = cols[i];
                h.classList.add('is-dragging');
                const move = (ev) => {
                    const d = (ev.clientX - startX) / px * total;
                    cols[i] = Math.max(STATION_COLS_MIN, Math.min(pair - STATION_COLS_MIN, startA + d));
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
        if (window.ResizeObserver) new ResizeObserver(place).observe(grid);
    },

    /** Hangar: RESET ANATOMY / SET AS DEFAULT sit in the stats row, between the area switches and the ship stats. */
    moveHangarBayTools() {
        const tools = this.overlay && this.overlay.querySelector('.hs-hangar-bay-tools');
        const stats = this.overlay && this.overlay.querySelector('.hs-hangar-stats.is-row');
        if (!tools || !stats) return;
        tools.classList.add('is-topbar');
        const after = stats.querySelector('.hs-stat-group.is-stats');
        stats.insertBefore(tools, after || null);
    }
});
