"use strict";

// Draggable / clickable border between AUDIO settings and Music Editor on the FX remote.
// Click = collapse/expand settings; drag = resize.
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {});
    const STORE = 'vf-fx-audio-split-w';
    const COLLAPSE_STORE = 'vf_fx_audio_settings_collapsed';
    const DEFAULT_W = 280;
    const MIN_LEFT = 180;
    const MIN_RIGHT = 220;
    const CLICK_PX = 4;

    function readSavedW() {
        try {
            const n = Number(localStorage.getItem(STORE));
            if (Number.isFinite(n) && n >= MIN_LEFT && n <= 720) return Math.round(n);
        } catch (e) { /* ignore */ }
        return DEFAULT_W;
    }

    function applyW(settings, w) {
        const px = Math.round(w);
        settings.style.flex = '0 0 ' + px + 'px';
        settings.style.width = px + 'px';
        settings.style.maxWidth = 'none';
        settings.style.minWidth = MIN_LEFT + 'px';
    }

    function clearW(settings) {
        settings.style.flex = '';
        settings.style.width = '';
        settings.style.minWidth = '';
        settings.style.maxWidth = '';
    }

    function setSettingsCollapsed(split, collapsed) {
        if (!split) return;
        const settings = split.querySelector('.vf-fx-audio-settings');
        const handle = split.querySelector('.vf-fx-audio-resize');
        split.classList.toggle('is-settings-collapsed', !!collapsed);
        vfs._fxAudioSettingsCollapsed = !!collapsed;
        try { localStorage.setItem(COLLAPSE_STORE, collapsed ? '1' : '0'); } catch (err) { /* ignore */ }
        if (handle) {
            handle.setAttribute('aria-expanded', String(!collapsed));
            handle.setAttribute('aria-label', collapsed ? 'Expand audio settings' : 'Collapse audio settings');
            handle.title = collapsed
                ? 'Click to expand audio settings'
                : 'Drag to resize · click to collapse';
            // Keep the border first so the expand strip stays visible left of the editor.
            if (collapsed) split.insertBefore(handle, split.firstChild);
            else if (settings && settings.nextSibling !== handle) settings.after(handle);
        }
        if (!settings) return;
        if (collapsed || split.classList.contains('is-stacked')) clearW(settings);
        else applyW(settings, readSavedW());
    }

    function bindFxAudioSplitResize() {
        const split = document.querySelector('#vf-fx .vf-fx-audio-split');
        if (!split) return;
        const settings = split.querySelector('.vf-fx-audio-settings');
        const host = split.querySelector('.vf-fx-music-host');
        if (!settings || !host) return;

        let handle = split.querySelector('.vf-fx-audio-resize');
        if (!handle) {
            handle = document.createElement('div');
            handle.className = 'vf-fx-audio-resize';
            settings.after(handle);
        }
        handle.setAttribute('role', 'button');
        handle.setAttribute('tabindex', '0');

        const collapsed = split.classList.contains('is-settings-collapsed') || !!vfs._fxAudioSettingsCollapsed;
        setSettingsCollapsed(split, collapsed);

        if (handle._vfBound) return;
        handle._vfBound = true;

        handle.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            setSettingsCollapsed(split, !split.classList.contains('is-settings-collapsed'));
        });

        handle.addEventListener('pointerdown', function (e) {
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            handle.setPointerCapture(e.pointerId);
            const startX = e.clientX;
            const startW = settings.getBoundingClientRect().width;
            const wasCollapsed = split.classList.contains('is-settings-collapsed');
            let dragging = false;
            handle.classList.add('is-dragging');
            document.body.classList.add('pe-resizing');
            vfs._fxAudioSplitDragging = true;

            const stacked = split.classList.contains('is-stacked');
            const move = function (ev) {
                const dx = ev.clientX - startX;
                if (!dragging && Math.abs(dx) < CLICK_PX) return;
                // Collapsed or narrow stack: click toggles settings; no drag-resize.
                if (wasCollapsed || stacked) return;
                if (!dragging) {
                    dragging = true;
                    applyW(settings, startW);
                }
                const maxW = Math.max(MIN_LEFT, split.getBoundingClientRect().width - MIN_RIGHT - handle.offsetWidth);
                applyW(settings, Math.max(MIN_LEFT, Math.min(maxW, startW + dx)));
            };
            const up = function () {
                handle.classList.remove('is-dragging');
                document.body.classList.remove('pe-resizing');
                vfs._fxAudioSplitDragging = false;
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                handle.removeEventListener('pointercancel', up);
                if (!dragging) {
                    setSettingsCollapsed(split, !wasCollapsed);
                    return;
                }
                const w = Math.round(settings.getBoundingClientRect().width);
                try { localStorage.setItem(STORE, String(w)); } catch (err) { /* ignore */ }
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
        });
    }

    Object.assign(NS, { bindFxAudioSplitResize, setFxAudioSettingsCollapsed: setSettingsCollapsed });
})(window.vfFitScope || (window.vfFitScope = {}));
