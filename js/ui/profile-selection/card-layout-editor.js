"use strict";

/**
 * Dev-mode layout editor for the faction-pick card (profile-selection wizard, "FACTION" step).
 * Lets the card itself and its planet/emblem/text be offset and scaled freely (CSS transform),
 * independent of the actual layout logic (flex / HeroPlanetBackdrop's own cx/cy/r math) — this is
 * a presentation-only overlay, same spirit as hudLayoutEditor but transform-based instead of
 * flex-reorder-based, since this card isn't a swappable HUD panel grid.
 *
 * The card is edited IN PLACE, exactly where the real page puts it — two earlier versions tried
 * moving it into the settings panel instead (so "the preview" and "the controls" would be one
 * piece), and both broke the card's own look: its CSS leans on ancestor-scoped rules (the ship
 * render is only hidden on this step via ".profile-selection-name-mode .profile-faction-info-row
 * …", several sizes are %/custom-property against its real flex parent, it shares that row with
 * the sibling lore panel, …) and reparenting it detached it from enough of that context to render
 * visibly differently (wrong proportions, clipped text, the ship reappearing). Leaving it alone
 * and only overlaying handles on the real elements is the only way the preview is guaranteed to
 * look exactly like the live menu, because it IS the live menu.
 *
 * A panel (not a full scrim-modal — it must never cover the real card it's editing) lists every
 * target's X/Y/Scale as number fields, two-way synced with drag handles on the real elements. The
 * handles themselves all live together in one small fixed strip anchored to the card's own rect,
 * not as children of the elements they drag (a handle inside its own target would ride along with
 * that target's drag/scale transform and visibly drift) and not scattered across each target's own
 * parent either (a parent can sit deep inside the card, clipped by its overflow, or just far from
 * the others) — one shared, always-visible strip instead.
 *
 * Persisted to localStorage, gated to startScreenManager.devMode, active only while the
 * faction-pick card (.profile-faction-preview with a .hero-planet-canvas child) is on screen.
 */
const cardLayoutEditor = (function () {
    const STORAGE_KEY = 'vf_profile_card_layout_v1';
    const TARGETS = [
        { sel: '.profile-faction-preview', label: 'CARD', key: 'card' },
        { sel: '.hero-planet-canvas', label: 'PLANET', key: 'planet' },
        { sel: '.profile-faction-preview-emblem', label: 'EMBLEM', key: 'emblem' },
        { sel: '.profile-faction-preview-text', label: 'TEXT', key: 'text' }
    ];
    const KEY_BY_SEL = {};
    TARGETS.forEach((t) => { KEY_BY_SEL[t.sel] = t.key; });
    const MIN_SCALE = 0.4, MAX_SCALE = 2.5;

    let layout = {};
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (raw) layout = raw;
    } catch (e) { /* ignore */ }

    let buttonEl = null;
    let panelEl = null;
    let overlayEl = null;
    let scrimEl = null;
    const liveHandles = []; // { el, handle }
    const liveFields = []; // { sel, xInput, yInput, sInput }

    function saveLayout() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (e) { /* ignore */ }
    }

    function isActive() {
        return typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
    }

    // .profile-faction-preview is reused per wizard step; a stale/hidden duplicate the SPA hasn't
    // torn down yet would otherwise win a plain querySelector (DOM order, not visibility) and put
    // the whole overlay at its zero-size, off-screen position instead of the real visible card's.
    function findCard() {
        const all = document.querySelectorAll('.profile-faction-preview');
        for (let i = 0; i < all.length; i++) {
            const r = all[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return all[i];
        }
        return all[0] || null;
    }

    function cardPresent() {
        const card = findCard();
        return !!(card && card.querySelector('.hero-planet-canvas'));
    }

    // Scoped to the one correct card (see findCard) instead of a bare document.querySelector,
    // so a stale duplicate elsewhere in the document can't be picked for PLANET/EMBLEM/TEXT either.
    function queryTarget(sel) {
        const card = findCard();
        if (!card) return null;
        return sel === '.profile-faction-preview' ? card : card.querySelector(sel);
    }

    function entry(sel) {
        if (!layout[sel]) layout[sel] = { x: 0, y: 0, scale: 1 };
        return layout[sel];
    }

    // Sets CSS custom properties on :root instead of each element's own inline style.transform —
    // the stylesheet rule that reads them (see injectStyles) is in place the instant this script
    // runs, well before the wizard ever builds the card, so a freshly created target picks up its
    // saved offset from its very first paint. Setting el.style.transform after the fact instead
    // (an earlier version did) left a visible beat on page load / faction switch where the target
    // first rendered untransformed and only snapped to the saved offset once JS caught up —
    // reported as the planet still "jumping in" on load.
    function applyTransform(sel) {
        const e = entry(sel);
        const k = KEY_BY_SEL[sel];
        if (!k) return;
        const root = document.documentElement.style;
        root.setProperty(`--cle-${k}-x`, e.x + 'px');
        root.setProperty(`--cle-${k}-y`, e.y + 'px');
        root.setProperty(`--cle-${k}-scale`, String(e.scale));
    }

    function applyAll() {
        TARGETS.forEach((t) => applyTransform(t.sel));
    }

    function isPanelOpen() {
        return !!panelEl;
    }

    function syncFields(sel) {
        const e = entry(sel);
        liveFields.forEach((f) => {
            if (f.sel !== sel) return;
            f.xInput.value = String(e.x);
            f.yInput.value = String(e.y);
            f.sInput.value = String(e.scale);
        });
    }

    // One fixed-position strip, synced to the card's own rect, holding every handle lined up
    // together — not hosted on each target's own parent: a parent can sit deep inside the card
    // (clipped by its overflow, or just visually far from the others), and a handle that's a child
    // of the element it drags would ride along with that element's own transform and visibly
    // drift (this already worked correctly for the planet, whose handle was hosted outside the
    // <canvas> for an unrelated reason — a canvas's DOM children are fallback content and never
    // hit-tested once it's drawn to — everything else needs the same "host elsewhere" treatment,
    // just all sharing one strip instead of each other's parent).
    function ensureOverlay() {
        if (overlayEl) return overlayEl;
        overlayEl = document.createElement('div');
        overlayEl.className = 'cle-overlay';
        document.body.appendChild(overlayEl);
        return overlayEl;
    }

    function syncOverlayPos() {
        if (!overlayEl) return;
        const card = findCard();
        if (!card) return;
        const r = card.getBoundingClientRect();
        overlayEl.style.top = Math.round(r.top) + 'px';
        overlayEl.style.left = Math.round(r.left) + 'px';
    }

    function addHandle(el, sel, label) {
        el.classList.add('cle-target');
        const overlay = ensureOverlay();
        const handle = document.createElement('div');
        handle.className = 'cle-handle';
        handle.innerHTML = `<span class="cle-handle-label">${label}</span><span class="cle-handle-grip">⠿</span>`;
        handle.title = 'Drag to move · wheel to scale · double-click to reset';
        overlay.appendChild(handle);
        liveHandles.push({ el, handle });

        let dragging = false, startX = 0, startY = 0, startEx = 0, startEy = 0;
        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            dragging = true;
            const cur = entry(sel);
            startX = e.clientX; startY = e.clientY;
            startEx = cur.x; startEy = cur.y;
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
        });
        handle.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const cur = entry(sel);
            cur.x = startEx + (e.clientX - startX);
            cur.y = startEy + (e.clientY - startY);
            applyTransform(sel);
            syncFields(sel);
            if (sel === '.profile-faction-preview') syncOverlayPos();
        });
        const stop = () => { if (dragging) { dragging = false; saveLayout(); } };
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
        handle.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const cur = entry(sel);
            const step = e.deltaY < 0 ? 1.05 : (1 / 1.05);
            cur.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cur.scale * step));
            applyTransform(sel);
            syncFields(sel);
            saveLayout();
            if (sel === '.profile-faction-preview') syncOverlayPos();
        }, { passive: false });
        handle.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            layout[sel] = { x: 0, y: 0, scale: 1 };
            applyTransform(sel);
            syncFields(sel);
            saveLayout();
            if (sel === '.profile-faction-preview') syncOverlayPos();
        });
    }

    function removeHandles() {
        liveHandles.forEach(({ el, handle }) => {
            handle.remove();
            el.classList.remove('cle-target');
        });
        liveHandles.length = 0;
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    }

    // Dims everything else so the card being tuned stands out, without hiding or moving it (see
    // file header on why it's never moved) — the card gets bumped above the scrim with its own
    // z-index/position instead, the same "spotlight" trick hud-layout-editor's content picker uses.
    function addSpotlight(card) {
        scrimEl = document.createElement('div');
        scrimEl.className = 'cle-scrim';
        scrimEl.addEventListener('click', closePanel);
        document.body.appendChild(scrimEl);
        if (getComputedStyle(card).position === 'static') {
            card.dataset.clePrevPos = card.style.position || '';
            card.style.position = 'relative';
        }
        card.dataset.clePrevZ = card.style.zIndex || '';
        card.style.zIndex = '100000';
        card.classList.add('cle-spotlit');
    }

    function removeSpotlight(card) {
        if (scrimEl) { scrimEl.remove(); scrimEl = null; }
        if (!card) return;
        card.classList.remove('cle-spotlit');
        if (card.dataset.clePrevPos !== undefined) {
            card.style.position = card.dataset.clePrevPos;
            delete card.dataset.clePrevPos;
        }
        if (card.dataset.clePrevZ !== undefined) {
            card.style.zIndex = card.dataset.clePrevZ;
            delete card.dataset.clePrevZ;
        }
    }

    function addHandles() {
        TARGETS.forEach((t) => {
            const el = queryTarget(t.sel);
            if (el) addHandle(el, t.sel, t.label);
        });
        syncOverlayPos();
    }

    function numberField(labelText, value, step, onChange) {
        const wrap = document.createElement('label');
        wrap.className = 'cle-field';
        const span = document.createElement('span');
        span.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = String(step);
        input.value = String(Math.round(value * 1000) / 1000);
        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            if (Number.isFinite(v)) onChange(v);
        });
        wrap.appendChild(span);
        wrap.appendChild(input);
        return { wrap, input };
    }

    function buildFieldRow(t) {
        const row = document.createElement('div');
        row.className = 'cle-row';
        const title = document.createElement('div');
        title.className = 'cle-row-title';
        title.textContent = t.label;
        row.appendChild(title);

        const e = entry(t.sel);
        const fields = document.createElement('div');
        fields.className = 'cle-row-fields';
        const x = numberField('X', e.x, 1, (v) => { e.x = v; applyTransform(t.sel); saveLayout(); });
        const y = numberField('Y', e.y, 1, (v) => { e.y = v; applyTransform(t.sel); saveLayout(); });
        const s = numberField('SCALE', e.scale, 0.05, (v) => {
            e.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v));
            applyTransform(t.sel);
            saveLayout();
            s.input.value = String(e.scale);
        });
        fields.appendChild(x.wrap);
        fields.appendChild(y.wrap);
        fields.appendChild(s.wrap);
        row.appendChild(fields);
        liveFields.push({ sel: t.sel, xInput: x.input, yInput: y.input, sInput: s.input });

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'cle-row-reset';
        reset.textContent = 'RESET';
        reset.addEventListener('click', () => {
            layout[t.sel] = { x: 0, y: 0, scale: 1 };
            applyTransform(t.sel);
            saveLayout();
            x.input.value = '0'; y.input.value = '0'; s.input.value = '1';
        });
        row.appendChild(reset);

        return row;
    }

    function closePanel() {
        if (!panelEl) return;
        removeHandles();
        removeSpotlight(findCard());
        liveFields.length = 0;
        panelEl.remove();
        panelEl = null;
    }

    function openPanel() {
        if (panelEl || !isActive() || !cardPresent()) return;
        addSpotlight(findCard());

        panelEl = document.createElement('div');
        panelEl.className = 'cle-panel';

        const header = document.createElement('div');
        header.className = 'cle-panel-header';
        header.innerHTML = '<span>FACTION CARD LAYOUT</span>';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'cle-panel-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', closePanel);
        header.appendChild(closeBtn);
        panelEl.appendChild(header);

        TARGETS.forEach((t) => {
            const el = queryTarget(t.sel);
            if (el) panelEl.appendChild(buildFieldRow(t));
        });

        const footer = document.createElement('div');
        footer.className = 'cle-panel-footer';
        const resetAll = document.createElement('button');
        resetAll.type = 'button';
        resetAll.className = 'cle-row-reset';
        resetAll.textContent = 'RESET ALL';
        resetAll.addEventListener('click', () => { resetLayout(); closePanel(); openPanel(); });
        footer.appendChild(resetAll);
        panelEl.appendChild(footer);

        document.body.appendChild(panelEl);
        addHandles();
    }

    function togglePanel() {
        if (isPanelOpen()) closePanel(); else openPanel();
    }

    function resetLayout() {
        layout = {};
        saveLayout();
        applyAll();
    }

    function ensureButton() {
        const card = findCard();
        // The saved offsets are the actual intended layout, not a dev-only preview — they must show
        // for every player, all the time, not just while dev mode happens to be on to edit them.
        // Only the editing chrome (the ⚙ button, handles, panel) is dev-mode-gated below.
        if (cardPresent()) applyAll();
        if (!isActive() || !cardPresent()) {
            if (buttonEl) { buttonEl.remove(); buttonEl = null; }
            if (isPanelOpen()) closePanel();
            return;
        }
        if (buttonEl && !buttonEl.isConnected) buttonEl = null;
        if (!buttonEl) {
            buttonEl = document.createElement('button');
            buttonEl.type = 'button';
            buttonEl.className = 'cle-open-btn';
            buttonEl.title = 'Configure this card\'s layout (dev mode)';
            buttonEl.textContent = '⚙ CARD';
            buttonEl.addEventListener('click', togglePanel);
        }
        if (buttonEl.parentElement !== card) card.appendChild(buttonEl);
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    }

    // The faction-pick card is rebuilt (innerHTML replaced) on every arrow/click pick, step change,
    // and faction swap — none of those call back here, so just poll like hudLayoutEditor does for
    // its own dev-mode gate, re-attaching handles whenever the card's elements are swapped out from
    // under them.
    function tick() {
        ensureButton();
        if (isPanelOpen()) {
            const stale = liveHandles.some(({ el }) => !el.isConnected);
            if (stale) {
                // The old card node (and its spotlight styling) is gone with it — re-spotlight
                // the fresh one the rebuild just put in its place.
                removeHandles();
                if (scrimEl) { scrimEl.remove(); scrimEl = null; }
                const card = findCard();
                if (card) addSpotlight(card);
                addHandles();
            } else {
                syncOverlayPos();
            }
        }
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent =
            // One rule per target, reading its offset/scale from :root custom properties (defaults
            // to no-op: 0px/0px/1) — present from the moment this stylesheet is inserted, long
            // before any wizard screen exists, so whichever element is created later gets it from
            // its first paint onward with no JS timing involved.
            '.profile-faction-preview{transform:translate(var(--cle-card-x,0px),var(--cle-card-y,0px)) scale(var(--cle-card-scale,1));}' +
            '.hero-planet-canvas{transform:translate(var(--cle-planet-x,0px),var(--cle-planet-y,0px)) scale(var(--cle-planet-scale,1));}' +
            '.profile-faction-preview-emblem{transform:translate(var(--cle-emblem-x,0px),var(--cle-emblem-y,0px)) scale(var(--cle-emblem-scale,1));}' +
            '.profile-faction-preview-text{transform:translate(var(--cle-text-x,0px),var(--cle-text-y,0px)) scale(var(--cle-text-scale,1));}' +
            '.cle-open-btn{position:absolute;top:2px;right:2px;z-index:10001;background:#0b2436;color:#ffd79a;' +
            'font:10px monospace;letter-spacing:0.05em;border:1px solid #3a4a60;border-radius:2px;padding:3px 6px;cursor:pointer;}' +
            '.cle-open-btn:hover{background:#1e5278;}' +
            '.cle-target{outline:1px dashed #ffb15f;outline-offset:-1px;}' +
            // Fixed to the card's own rect (see syncOverlayPos) and never a child of any target,
            // so every handle lines up together above the card and none of them ever ride along
            // with a target's own drag/scale transform.
            '.cle-overlay{position:fixed;z-index:100001;display:flex;flex-wrap:wrap;gap:4px;' +
            'pointer-events:none;transform:translateY(-100%);}' +
            '.cle-handle{pointer-events:auto;display:flex;align-items:center;gap:4px;' +
            'background:#0b2436;color:#ffd79a;font:10px monospace;letter-spacing:0.05em;border-radius:2px;' +
            'padding:2px 5px;cursor:grab;user-select:none;touch-action:none;white-space:nowrap;}' +
            '.cle-handle:active{cursor:grabbing;background:#1e5278;}' +
            '.cle-handle-grip{opacity:0.8;}' +
            '.cle-scrim{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;}' +
            '.cle-spotlit{box-shadow:0 0 0 2px #ffd79a,0 0 32px 8px rgba(0,0,0,0.7);}' +
            // The panel floats beside the real card so the card itself stays visible and
            // unmodified behind it (anything else would mean editing a copy, not the real thing).
            '.cle-panel{position:fixed;top:16px;right:16px;z-index:100001;' +
            'background:#0f141cf2;border:1px solid #3a4a60;border-radius:6px;padding:10px;' +
            'display:flex;flex-direction:column;gap:2px;font:12px/1.4 monospace;color:#cfe8ff;' +
            'width:260px;max-height:90vh;overflow:auto;}' +
            '.cle-panel-header{display:flex;align-items:center;justify-content:space-between;' +
            'padding-bottom:6px;margin-bottom:4px;border-bottom:1px solid #3a4a60;letter-spacing:0.06em;color:#ffd79a;}' +
            '.cle-panel-close{background:none;border:none;color:#cfe8ff;cursor:pointer;font:14px monospace;}' +
            '.cle-row{display:flex;flex-direction:column;gap:4px;padding:6px 0;border-bottom:1px solid #22303e;}' +
            '.cle-row-title{color:#ffd79a;letter-spacing:0.06em;}' +
            '.cle-row-fields{display:flex;gap:6px;}' +
            '.cle-field{display:flex;flex-direction:column;gap:2px;font-size:10px;color:#9fb4c8;letter-spacing:0.05em;flex:1 1 0;min-width:0;}' +
            '.cle-field input{width:100%;background:#141821;color:#cfe8ff;border:1px solid #3a4a60;border-radius:3px;padding:3px 4px;font:12px monospace;}' +
            '.cle-row-reset{align-self:flex-start;background:#141821;color:#ff9a9a;border:1px solid #3a4a60;border-radius:3px;' +
            'padding:3px 8px;cursor:pointer;font:10px monospace;letter-spacing:0.05em;}' +
            '.cle-row-reset:hover{background:#2a1e1e;}' +
            '.cle-panel-footer{display:flex;justify-content:flex-end;padding-top:4px;}';
        document.head.appendChild(style);
    }

    // Redundant with the CSS custom properties now driving the actual transform (see
    // injectStyles), but harmless to keep as a fallback and still needed to re-sync the overlay
    // and detect a torn-down card quickly rather than waiting out the 500ms tick.
    function watchRebuilds() {
        if (typeof MutationObserver === 'undefined') return;
        const mo = new MutationObserver(() => { if (cardPresent()) applyAll(); });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        injectStyles();
        // Seeds the :root custom properties from the saved layout immediately, before the wizard
        // has ever built a card — the CSS rule is already live by the time anything matching these
        // selectors is first created, so it never has an untransformed first paint to "jump" from.
        applyAll();
        watchRebuilds();
        setInterval(tick, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    return { openPanel, closePanel, togglePanel, resetLayout, isPanelOpen };
})();

window.cardLayoutEditor = cardLayoutEditor;
