"use strict";

// HomeStationUI: draggable border between the storage/ships column and the
// STATION STORES chambers. Matches .hs-station-grid's 2-column template
// (left content | chambers). Legacy 3-column fr weights are ignored.
const STATION_COLS_KEY = 'vf_station_cols_v2';
const STATION_COLS_MIN = 0.35;
const STATION_COLS_MAX = 12;
const STATION_LEFT_MIN_PX = 320;
const STATION_RIGHT_MIN_PX = 300;
const STATION_COLS_DEFAULT = [3, 1];

extendClass(HomeStationUI, {
    /** Sanitize persisted [leftFr, rightFr] — reject NaN/Infinity/exploded values from bad drags. */
    _sanitizeStationCols(v) {
        if (!Array.isArray(v) || v.length !== 2) return null;
        const a = Number(v[0]);
        const b = Number(v[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        if (a < STATION_COLS_MIN || b < STATION_COLS_MIN) return null;
        if (a > STATION_COLS_MAX || b > STATION_COLS_MAX) return null;
        // Re-normalize to a stable sum so fr math stays bounded across reloads.
        const total = a + b;
        if (!(total > 0) || !Number.isFinite(total)) return null;
        const scale = (STATION_COLS_DEFAULT[0] + STATION_COLS_DEFAULT[1]) / total;
        return [
            Math.max(STATION_COLS_MIN, Math.min(STATION_COLS_MAX, a * scale)),
            Math.max(STATION_COLS_MIN, Math.min(STATION_COLS_MAX, b * scale))
        ];
    },

    getStationCols() {
        try {
            const v = JSON.parse(localStorage.getItem(STATION_COLS_KEY) || 'null');
            const clean = this._sanitizeStationCols(v);
            if (clean) {
                // Rewrite corrupted / pre-clamp saves so the next load stays clean.
                if (!v || v[0] !== clean[0] || v[1] !== clean[1]) {
                    try { localStorage.setItem(STATION_COLS_KEY, JSON.stringify(clean)); } catch (e) { /* ignore */ }
                }
                return clean;
            }
            if (v != null) {
                try { localStorage.removeItem(STATION_COLS_KEY); } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        return null; // null → leave CSS defaults alone
    },

    bindStationColumnResize() {
        const grid = this.overlay && this.overlay.querySelector('.hs-station-grid');
        if (!grid) return;
        // Avoid stacking handles across soft remounts.
        grid.querySelectorAll('.hs-col-resize').forEach((h) => h.remove());
        grid.style.removeProperty('grid-template-columns');

        const left = grid.querySelector('.hs-panel-stack') ||
            grid.querySelector('.hs-panel-parts') ||
            grid.querySelector('.hs-panel-ships');
        const right = grid.querySelector('.hs-panel-chambers');
        if (!left || !right) return;

        let cols = this.getStationCols();
        const apply = () => {
            if (!cols) {
                grid.style.removeProperty('grid-template-columns');
                return;
            }
            const clean = this._sanitizeStationCols(cols);
            if (!clean) {
                cols = null;
                grid.style.removeProperty('grid-template-columns');
                try { localStorage.removeItem(STATION_COLS_KEY); } catch (e) { /* ignore */ }
                return;
            }
            cols = clean;
            // Keep the chambers column from collapsing; left takes the rest.
            grid.style.gridTemplateColumns =
                `minmax(0, ${cols[0]}fr) minmax(${STATION_RIGHT_MIN_PX}px, ${cols[1]}fr)`;
        };
        apply();

        const normalize = () => {
            if (!cols) return;
            const clean = this._sanitizeStationCols(cols);
            if (!clean) {
                cols = null;
                apply();
                place();
                return;
            }
            cols = clean;
            const total = cols[0] + cols[1];
            const px = grid.offsetWidth || 1;
            const minLeft = Math.max(STATION_COLS_MIN, (STATION_LEFT_MIN_PX / px) * total);
            const minRight = Math.max(STATION_COLS_MIN, (STATION_RIGHT_MIN_PX / px) * total);
            // If mins can't both fit, fall back to CSS defaults instead of exploding ratios.
            if (minLeft + minRight > total + 1e-6) {
                cols = null;
                apply();
                place();
                try { localStorage.removeItem(STATION_COLS_KEY); } catch (e) { /* ignore */ }
                return;
            }
            let changed = false;
            if (cols[0] < minLeft) { cols[1] -= (minLeft - cols[0]); cols[0] = minLeft; changed = true; }
            if (cols[1] < minRight) { cols[0] -= (minRight - cols[1]); cols[1] = minRight; changed = true; }
            if (cols[0] < minLeft) cols[0] = minLeft;
            if (cols[1] < minRight) cols[1] = minRight;
            cols = this._sanitizeStationCols(cols) || STATION_COLS_DEFAULT.slice();
            if (!changed) {
                apply();
                return;
            }
            apply();
            place();
            try { localStorage.setItem(STATION_COLS_KEY, JSON.stringify(cols)); } catch (e) { /* ignore */ }
        };

        grid.style.position = 'relative';
        const handle = document.createElement('div');
        handle.className = 'hs-col-resize';
        handle.title = 'Drag to resize (double-click to reset)';
        grid.appendChild(handle);

        const place = () => {
            const gRect = grid.getBoundingClientRect();
            const scaleX = (gRect.width / (grid.clientWidth || grid.offsetWidth || 1)) || 1;
            const scaleY = (gRect.height / (grid.clientHeight || grid.offsetHeight || 1)) || 1;
            const aRect = left.getBoundingClientRect();
            const bRect = right.getBoundingClientRect();
            const aRight = (aRect.right - gRect.left) / scaleX;
            const bLeft = (bRect.left - gRect.left) / scaleX;
            const gap = Math.max(0, bLeft - aRight);
            const hw = Math.min(12, Math.max(8, gap - 2 || 10));
            // Chambers span both content rows — use its full height for the grip.
            handle.style.width = hw + 'px';
            handle.style.left = (aRight + gap / 2 - hw / 2) + 'px';
            handle.style.top = ((bRect.top - gRect.top) / scaleY) + 'px';
            handle.style.height = (bRect.height / scaleY) + 'px';
        };
        place();
        normalize();

        handle.addEventListener('dblclick', () => {
            cols = null;
            apply();
            place();
            try { localStorage.removeItem(STATION_COLS_KEY); } catch (e) { /* ignore */ }
        });

        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handle.setPointerCapture(e.pointerId);
            if (!cols) cols = STATION_COLS_DEFAULT.slice();
            cols = this._sanitizeStationCols(cols) || STATION_COLS_DEFAULT.slice();
            const total = cols[0] + cols[1];
            // Use the full grid content width so a collapsed column can't divide-by-near-zero
            // and explode the fr weights (that was collapsing the station layout to 0px + 240px).
            const px = Math.max(1, grid.getBoundingClientRect().width - 16);
            const startX = e.clientX;
            const pair = total;
            const startA = cols[0];
            const minLeft = Math.max(STATION_COLS_MIN, (STATION_LEFT_MIN_PX / px) * total);
            const minRight = Math.max(STATION_COLS_MIN, (STATION_RIGHT_MIN_PX / px) * total);
            handle.classList.add('is-dragging');
            const move = (ev) => {
                const d = (ev.clientX - startX) / px * total;
                let next = Math.max(minLeft, Math.min(pair - minRight, startA + d));
                if (!Number.isFinite(next)) next = startA;
                cols[0] = next;
                cols[1] = pair - cols[0];
                cols = this._sanitizeStationCols(cols) || STATION_COLS_DEFAULT.slice();
                apply();
                place();
            };
            const up = () => {
                handle.classList.remove('is-dragging');
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                handle.removeEventListener('pointercancel', up);
                cols = this._sanitizeStationCols(cols);
                if (!cols) {
                    apply();
                    place();
                    try { localStorage.removeItem(STATION_COLS_KEY); } catch (err) { /* ignore */ }
                    return;
                }
                try { localStorage.setItem(STATION_COLS_KEY, JSON.stringify(cols)); } catch (err) { /* ignore */ }
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
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
