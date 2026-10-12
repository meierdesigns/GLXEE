"use strict";

/**
 * Shared column resize for editor/viewer grids.
 * Handles: .pe-resize-handle[data-resize="left"|"right"]
 */
(function (global) {
    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function setupPanelResize(options) {
        const body = options.body;
        const root = options.root || body;
        if (!body || !root) return null;

        const storageKey = options.storageKey || null;
        const leftVar = options.leftVar || '--pe-left-w';
        const rightVar = options.rightVar || '--pe-right-w';
        const hasRight = options.defaults && typeof options.defaults.right === 'number';
        const mins = Object.assign({ left: 140, right: 180, center: 220 }, options.mins || {});
        const handleW = options.handleW || 8;

        let leftW = options.defaults && typeof options.defaults.left === 'number'
            ? options.defaults.left
            : 220;
        let rightW = hasRight ? options.defaults.right : null;
        let resizingSide = null;

        if (storageKey) {
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    const saved = JSON.parse(raw);
                    if (saved && typeof saved.left === 'number') leftW = saved.left;
                    if (hasRight && saved && typeof saved.right === 'number') rightW = saved.right;
                }
            } catch (_) { /* ignore */ }
        }

        const apply = () => {
            body.style.setProperty(leftVar, `${leftW}px`);
            if (hasRight) body.style.setProperty(rightVar, `${rightW}px`);
            if (typeof options.onChange === 'function') {
                options.onChange({ left: leftW, right: rightW });
            }
        };

        const onMove = (e) => {
            if (!resizingSide) return;
            const rect = body.getBoundingClientRect();
            const rightVal = hasRight ? rightW : 0;
            const handles = hasRight ? handleW * 2 : handleW;
            if (resizingSide === 'left') {
                const maxLeft = rect.width - rightVal - mins.center - handles;
                leftW = Math.round(clamp(e.clientX - rect.left, mins.left, maxLeft));
            } else if (hasRight) {
                const maxRight = rect.width - leftW - mins.center - handles;
                rightW = Math.round(clamp(rect.right - e.clientX, mins.right, maxRight));
            }
            apply();
        };

        const onUp = () => {
            if (!resizingSide) return;
            resizingSide = null;
            document.body.classList.remove('pe-resizing');
            root.querySelectorAll('.pe-resize-handle').forEach((h) => h.classList.remove('pe-resize-active'));
            if (storageKey) {
                try {
                    const payload = { left: leftW };
                    if (hasRight) payload.right = rightW;
                    localStorage.setItem(storageKey, JSON.stringify(payload));
                } catch (_) { /* ignore */ }
            }
        };

        const handles = root.querySelectorAll('.pe-resize-handle');
        const onDown = (e) => {
            const handle = e.currentTarget;
            if (e.button !== 0) return;
            e.preventDefault();
            resizingSide = handle.getAttribute('data-resize');
            if (!hasRight && resizingSide === 'right') return;
            document.body.classList.add('pe-resizing');
            handle.classList.add('pe-resize-active');
        };

        handles.forEach((handle) => handle.addEventListener('mousedown', onDown));
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('blur', onUp);

        apply();

        return {
            apply,
            getWidths: () => ({ left: leftW, right: rightW }),
            setWidths: (w) => {
                if (w && typeof w.left === 'number') leftW = w.left;
                if (hasRight && w && typeof w.right === 'number') rightW = w.right;
                apply();
            },
            destroy: () => {
                handles.forEach((handle) => handle.removeEventListener('mousedown', onDown));
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('blur', onUp);
                document.body.classList.remove('pe-resizing');
            }
        };
    }

    global.setupPanelResize = setupPanelResize;
})(typeof window !== 'undefined' ? window : globalThis);
