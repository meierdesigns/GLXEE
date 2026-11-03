"use strict";

/**
 * Dev Mode hover readout: a bezel-bottom screen that names the element under the pointer.
 * Optional highlight mode: with the mode on, hold Shift to tint/outline the target.
 */
(function () {
    const SKIP = /^(vf-hover-screen|vf-hover-k|vf-hover-v|vf-hover-hi|vf-bezel-devmode|vf-hover-hl)$/;
    const HI_KEY = 'vf_dev_hover_hi';
    let screen = null;
    let label = null;
    let hiBtn = null;
    let hl = null;
    let lastKey = '';
    let lastTarget = null;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    let shiftDown = false;
    let hiMode = false;
    try { hiMode = localStorage.getItem(HI_KEY) === '1'; } catch (e) { /* ignore */ }

    function ensure() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return null;
        screen = frame.querySelector('.vf-hover-screen');
        if (!screen) {
            screen = document.createElement('div');
            screen.className = 'vf-hover-screen vf-pilot-screen';
            screen.setAttribute('aria-live', 'polite');
            screen.hidden = true;
            screen.innerHTML = ''
                + '<span class="vf-hover-k">HOVER</span>'
                + '<button type="button" class="vf-hover-hi" title="Highlight mode: hold Shift to tint the element under the pointer" aria-label="Toggle hover highlight mode">HI</button>'
                + '<span class="vf-hover-v">—</span>';
            frame.appendChild(screen);
            screen.querySelector('.vf-hover-hi').addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                setHiMode(!hiMode);
            });
        }
        label = screen.querySelector('.vf-hover-v');
        hiBtn = screen.querySelector('.vf-hover-hi');
        syncHiBtn();
        if (!hl) {
            hl = document.createElement('div');
            hl.className = 'vf-hover-hl';
            hl.hidden = true;
        }
        // Must live on <html>, not <body>: body carries transform: scale(--stage-scale),
        // which makes position:fixed resolve in stage space. Client rects are viewport
        // px — mounting under body made the tint sit offset and look like a ghosted
        // second copy of the station UI (double borders / jumping highlight).
        if (hl.parentElement !== document.documentElement) {
            document.documentElement.appendChild(hl);
        }
        return screen;
    }

    function setHiMode(on) {
        hiMode = !!on;
        try { localStorage.setItem(HI_KEY, hiMode ? '1' : '0'); } catch (e) { /* ignore */ }
        syncHiBtn();
        paint();
    }

    function syncHiBtn() {
        if (!hiBtn) return;
        hiBtn.classList.toggle('is-on', hiMode);
        hiBtn.setAttribute('aria-pressed', hiMode ? 'true' : 'false');
        hiBtn.title = hiMode
            ? 'Highlight ON — hold Shift to tint the hovered element (click to turn off)'
            : 'Highlight OFF — click to enable; then hold Shift to tint';
    }

    function devOn() {
        return typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
    }

    function attrToken(el, name) {
        const v = el.getAttribute(name);
        return v != null && v !== '' ? '[' + name + '="' + v + '"]' : '';
    }

    function nodeToken(el) {
        let s = (el.tagName || '?').toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.classList && el.classList.length) {
            const cls = [];
            for (let i = 0; i < el.classList.length && cls.length < 3; i++) {
                const c = el.classList[i];
                if (SKIP.test(c) || c.indexOf('is-') === 0 || c === 'on') continue;
                cls.push(c);
            }
            if (cls.length) s += '.' + cls.join('.');
        }
        s += attrToken(el, 'data-tool')
            || attrToken(el, 'data-tab')
            || attrToken(el, 'data-area')
            || attrToken(el, 'data-slot')
            || attrToken(el, 'data-slot-kind')
            || attrToken(el, 'role');
        return s;
    }

    function pickTarget(raw) {
        let el = raw;
        while (el && el.nodeType === 1) {
            if (el === screen || el === hl || (el.classList && (
                el.classList.contains('vf-hover-screen')
                || el.classList.contains('vf-hover-hl')
                || el.classList.contains('vf-bezel-devmode')
            ))) {
                el = el.parentElement;
                continue;
            }
            break;
        }
        if (!el || el === document.documentElement || el === document.body) return null;
        let best = el;
        let n = el;
        for (let d = 0; n && n.nodeType === 1 && d < 6; d++) {
            if (n.id
                || n.getAttribute('data-tool')
                || n.getAttribute('data-tab')
                || n.getAttribute('data-area')
                || n.getAttribute('data-slot')
                || n.getAttribute('data-ui-tip')
                || n.getAttribute('aria-label')
                || n.getAttribute('title')
                || n.tagName === 'BUTTON'
                || n.tagName === 'A'
                || n.tagName === 'CANVAS'
                || (n.classList && (
                    n.classList.contains('vf-pilot-screen')
                    || n.classList.contains('vf-bezel-tools')
                    || n.classList.contains('hs-nav-card')
                ))) {
                best = n;
                break;
            }
            if (n.id || (n.classList && n.classList.length > 0)) best = n;
            n = n.parentElement;
        }
        return best;
    }

    function describe(el) {
        const parts = [];
        let n = el;
        for (let d = 0; n && n.nodeType === 1 && d < 4 && n !== document.body; d++) {
            parts.unshift(nodeToken(n));
            if (n.id) break;
            n = n.parentElement;
        }
        let text = parts.join(' › ');
        const tip = el.getAttribute('aria-label')
            || el.getAttribute('title')
            || el.getAttribute('data-ui-tip')
            || '';
        if (tip) text += ' · ' + tip;
        const w = Math.round(el.getBoundingClientRect().width);
        const h = Math.round(el.getBoundingClientRect().height);
        if (w || h) text += ' · ' + w + '×' + h;
        return text;
    }

    function placeHighlight(el) {
        if (!hl) return;
        const show = !!(devOn() && hiMode && shiftDown && el && el.isConnected);
        if (!show) {
            hl.hidden = true;
            lastTarget = null;
            return;
        }
        // hl is on <html> (viewport fixed). Rects are already visual/client px.
        const r = el.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
            hl.hidden = true;
            lastTarget = null;
            return;
        }
        hl.hidden = false;
        hl.style.left = Math.round(r.left) + 'px';
        hl.style.top = Math.round(r.top) + 'px';
        hl.style.width = Math.max(0, Math.round(r.width)) + 'px';
        hl.style.height = Math.max(0, Math.round(r.height)) + 'px';
        lastTarget = el;
    }

    function paint() {
        raf = 0;
        if (!ensure()) return;
        const on = devOn();
        screen.hidden = !on;
        if (!on) {
            if (lastKey !== '') {
                lastKey = '';
                if (label) label.textContent = '—';
            }
            placeHighlight(null);
            return;
        }
        const prev = screen.style.visibility;
        const hlPrev = hl ? hl.style.visibility : '';
        screen.style.visibility = 'hidden';
        if (hl) hl.style.visibility = 'hidden';
        const raw = document.elementFromPoint(lastX, lastY);
        screen.style.visibility = prev;
        if (hl) hl.style.visibility = hlPrev;
        const el = pickTarget(raw);
        const key = el ? describe(el) : '—';
        if (key !== lastKey) {
            lastKey = key;
            if (label) label.textContent = key;
        }
        placeHighlight(el);
    }

    function schedule(x, y) {
        lastX = x;
        lastY = y;
        if (raf) return;
        raf = requestAnimationFrame(paint);
    }

    document.addEventListener('pointermove', function (e) {
        shiftDown = !!e.shiftKey;
        schedule(e.clientX, e.clientY);
    }, { passive: true, capture: true });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Shift') return;
        shiftDown = true;
        if (hiMode && devOn()) paint();
    }, true);

    document.addEventListener('keyup', function (e) {
        if (e.key !== 'Shift') return;
        shiftDown = false;
        placeHighlight(null);
    }, true);

    window.addEventListener('blur', function () {
        shiftDown = false;
        placeHighlight(null);
    });

    // DevMode can flip without a pointer move (Shift+C); keep visibility in sync.
    setInterval(function () {
        if (!ensure()) return;
        const on = devOn();
        if (screen.hidden === on) {
            screen.hidden = !on;
            if (on) paint();
            else {
                if (label) { lastKey = ''; label.textContent = '—'; }
                placeHighlight(null);
            }
        }
        // Keep overlay glued if the target moves/resizes while Shift is held.
        if (on && hiMode && shiftDown && lastTarget) placeHighlight(lastTarget);
    }, 400);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensure);
    } else {
        ensure();
    }
})();
