"use strict";

/**
 * Makes every sidebar resizable, including screens that never wired up
 * setupPanelResize. Finds side columns (asides / *sidebar* / *-left-col /
 * *-right-col / *-list-col) sitting at the start or end of a horizontal
 * grid or flex row, adds a drag handle on their inner edge and remembers
 * the width per sidebar. Layouts that already have .pe-resize-handle keep
 * their own resizer.
 */
(function sidebarResizeAuto() {
    const SELECTOR = 'aside, [class*="sidebar"], [class*="-left-col"], [class*="-right-col"], [class*="-list-col"]';
    const STORE = 'vf_sidebar_widths_v1';
    const MIN_W = 120;
    const MIN_CENTER = 200;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (_) { saved = {}; }
    const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (_) { /* ignore */ } };

    const visibleChildren = (el) => Array.from(el.children).filter((c) =>
        !c.classList.contains('sb-auto-handle') && getComputedStyle(c).display !== 'none'
        && getComputedStyle(c).position !== 'absolute' && getComputedStyle(c).position !== 'fixed');

    const isCollapsed = (side) => {
        const cls = side.className + ' ' + (side.parentElement ? side.parentElement.className : '');
        return /collapsed/i.test(cls);
    };

    const keyFor = (side) => {
        const parent = side.parentElement;
        const pcls = parent ? String(parent.className).split(/\s+/).filter((c) => c && !/collapsed/i.test(c))[0] || parent.tagName : '';
        const own = side.id || String(side.className).split(/\s+/).filter((c) => c && !/collapsed|sb-auto/i.test(c)).join('.');
        return pcls + '>' + own;
    };

    function placement(side) {
        const parent = side.parentElement;
        if (!parent) return null;
        const ps = getComputedStyle(parent);
        const isGrid = ps.display.indexOf('grid') !== -1;
        const isFlexRow = ps.display.indexOf('flex') !== -1 && ps.flexDirection.indexOf('row') === 0;
        if (!isGrid && !isFlexRow) return null;
        const kids = visibleChildren(parent);
        if (kids.length < 2) return null;
        const idx = kids.indexOf(side);
        if (idx === 0) return { parent, isGrid, idx, edge: 'right', kids };
        if (idx === kids.length - 1) return { parent, isGrid, idx, edge: 'left', kids };
        return null;
    }

    function applyWidth(side, info, w) {
        if (info.isGrid) {
            const cols = getComputedStyle(info.parent).gridTemplateColumns.split(' ').filter(Boolean);
            if (cols.length !== info.kids.length) return false;
            cols[info.idx] = Math.round(w) + 'px';
            // The widest remaining track flexes so the row still fills.
            let best = -1;
            let bestW = -1;
            cols.forEach((c, i) => {
                if (i === info.idx) return;
                const v = parseFloat(c) || 0;
                if (v > bestW) { bestW = v; best = i; }
            });
            if (best >= 0) cols[best] = 'minmax(0, 1fr)';
            info.parent.style.gridTemplateColumns = cols.join(' ');
        } else {
            side.style.flex = '0 0 ' + Math.round(w) + 'px';
            side.style.width = Math.round(w) + 'px';
            side.style.maxWidth = 'none';
        }
        return true;
    }

    function clearWidth(side, info) {
        if (info && info.isGrid) info.parent.style.gridTemplateColumns = '';
        side.style.flex = '';
        side.style.width = '';
        side.style.maxWidth = '';
    }

    function attach(side) {
        if (side.__sbAuto || !side.isConnected) return;
        // Elements that failed the size / placement checks are re-checked at
        // most every 3 s (each check forces a layout; map planets swap their
        // frames several times a second and trigger scans constantly).
        const now = performance.now();
        if (side.__sbTried && now - side.__sbTried < 3000) return;
        side.__sbTried = now;
        const parent = side.parentElement;
        if (!parent || parent.querySelector(':scope > .pe-resize-handle')) return;
        if (side.closest('.pe-resize-handle')) return;
        const rect = side.getBoundingClientRect();
        const prect = parent.getBoundingClientRect();
        if (rect.height < 150 || rect.width <= 0 || rect.width > prect.width * 0.6) return;
        const info = placement(side);
        if (!info) return;
        side.__sbAuto = true;
        if (getComputedStyle(side).position === 'static') side.style.position = 'relative';
        const handle = document.createElement('div');
        handle.className = 'sb-auto-handle sb-auto-' + info.edge;
        handle.title = 'Drag to resize';
        side.appendChild(handle);
        const key = keyFor(side);

        const sync = () => {
            const cur = placement(side);
            if (!cur) return;
            if (isCollapsed(side)) { clearWidth(side, cur); handle.style.display = 'none'; return; }
            handle.style.display = '';
            if (saved[key]) applyWidth(side, cur, saved[key]);
        };
        sync();
        new MutationObserver(sync).observe(side, { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(sync).observe(parent, { attributes: true, attributeFilter: ['class'] });

        handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const cur = placement(side);
            if (!cur) return;
            const startX = e.clientX;
            const startW = side.getBoundingClientRect().width;
            const maxW = Math.max(MIN_W, cur.parent.getBoundingClientRect().width - MIN_CENTER);
            document.body.classList.add('pe-resizing');
            handle.classList.add('is-active');
            const move = (ev) => {
                const dx = ev.clientX - startX;
                const w = Math.max(MIN_W, Math.min(maxW, startW + (cur.edge === 'right' ? dx : -dx)));
                if (applyWidth(side, cur, w)) saved[key] = Math.round(w);
                window.dispatchEvent(new Event('resize'));
            };
            const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
                document.body.classList.remove('pe-resizing');
                handle.classList.remove('is-active');
                persist();
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        });
        handle.addEventListener('dblclick', () => {
            delete saved[key];
            persist();
            clearWidth(side, placement(side));
        });
    }

    let queued = false;
    const scan = () => {
        queued = false;
        document.querySelectorAll(SELECTOR).forEach(attach);
    };
    const queue = () => {
        if (queued) return;
        queued = true;
        // Coalesce bursts of mutations into one scan.
        setTimeout(() => requestAnimationFrame(scan), 300);
    };
    const start = () => {
        // Screens are often shown by a class/style change, not new nodes.
        new MutationObserver(queue).observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden']
        });
        queue();
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
})();
