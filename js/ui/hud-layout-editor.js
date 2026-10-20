"use strict";

/**
 * Dev-mode HUD layout editor. The combat HUD panels stay in normal flex flow — this only lets
 * the player (a) reorder panels within their own cluster via a drag grip, and (b) drag the
 * boundary between two adjacent panels to resize them (an explicit pixel height via flex-basis),
 * rather than freely moving/resizing panels. Persisted to localStorage. Only reachable while
 * startScreenManager.devMode is on.
 *
 * Resizing uses a plain height, not `zoom`: zoom was tried first so a panel's content (text,
 * icons, bars) would scale together with it, but on the game's tightly packed icon rows (the
 * under-stage stat bar in particular) it produced overlapping, garbled icons — the combination of
 * this zoom with the stage's own existing zoom/transform layers doesn't render cleanly for that
 * kind of content. A plain height is quietly safe: the panel just gets more or less room, its
 * content never gets distorted.
 */
const hudLayoutEditor = (function () {
    const STORAGE_KEY = 'vf_hud_layout_v4';
    const CLUSTER_SELECTORS = ['#gameLeftCluster', '.game-canvas-container', '#gameRightCluster'];
    const GAME_CONTAINER_SEL = '.game-container';
    const MIN_H = 30, MAX_H = 2000;
    const MIN_SIDE_W = 140, MAX_SIDE_W = 460;
    // Dragging the boundary between a side cluster and the playfield resizes that cluster's width
    // directly (not via zoom — it's a column width, not panel content); the canvas column is
    // `flex: 1 1 auto` already, so it absorbs whatever width the side cluster gives up or takes,
    // i.e. "the game gets resized" as a natural side effect, with no extra code needed for that.
    const CONTAINER_SPLITTERS = [
        { clusterSel: '#gameLeftCluster', sign: 1 },
        { clusterSel: '#gameRightCluster', sign: -1 }
    ];

    let layout = { clusters: {}, container: {}, scales: {} };
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (raw && raw.clusters) layout = raw;
        if (!layout.container) layout.container = {};
        if (!layout.scales) layout.scales = {};
    } catch (e) { /* ignore */ }

    const originalOrder = {}; // clusterSel -> [childKey, ...] as authored, captured once at boot

    let editing = false;
    const liveGrips = []; // { child, grip }
    const livePickers = []; // { child, btn }
    const liveSplitters = []; // element refs
    let picker = null; // the open content-picker popover, or null

    // Every panel across all three clusters that a slot can be made to show, keyed by a selector
    // stable enough to find it wherever it currently lives (its id/class never changes, only its
    // parent does). .game-stage is deliberately absent: it's the actual game canvas, sized by the
    // game's own viewport-fit code, never a swappable slot.
    const PANEL_REGISTRY = [
        { sel: '#gameInfoPanel', label: 'INFO' },
        { sel: '.weapon-selection', label: 'WEAPONS' },
        { sel: '.player-vitals-side', label: 'PLAYER VITALS' },
        { sel: '#giLoadoutSide', label: 'LOADOUT' },
        { sel: '.enemy-vitals-side', label: 'ENEMY VITALS' },
        { sel: '#giMissionSide', label: 'MISSION' },
        { sel: '#giUnderStage', label: 'UNDER-STAGE BAR' }
    ];

    function findPanelByKey(k) {
        for (let i = 0; i < PANEL_REGISTRY.length; i++) {
            const el = document.querySelector(PANEL_REGISTRY[i].sel);
            if (el && childKey(el) === k) return el;
        }
        return null;
    }

    function isActive() {
        return typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
    }

    // The stage sits under several stacked, independent scale layers (CSS `zoom`, `transform:
    // scale`, possibly more) between an authored CSS pixel and what getBoundingClientRect() /
    // mouse coordinates report. Rather than track down and multiply every factor by name (fragile
    // — a new layer silently breaks the math again), measure the combined effect directly: drop an
    // invisible probe of a known authored size into the same parent and compare its rendered size.
    function measureScale(referenceEl) {
        const parent = referenceEl && referenceEl.nodeType === 1 ? referenceEl : document.body;
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:0;top:0;width:2000px;height:2000px;margin:0;border:0;padding:0;visibility:hidden;pointer-events:none;';
        parent.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w > 0 ? w / 2000 : 1;
    }

    function saveLayout() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (e) { /* ignore */ }
    }

    function childKey(el) {
        if (el.id) return '#' + el.id;
        const cls = (el.className || '').toString().trim().split(/\s+/)[0];
        if (cls) return '.' + cls;
        return 'idx' + Array.prototype.indexOf.call(el.parentElement ? el.parentElement.children : [], el);
    }

    function clusterEntry(sel) {
        if (!layout.clusters[sel]) layout.clusters[sel] = { order: [], sizes: {} };
        return layout.clusters[sel];
    }

    // Direct children of a cluster that are real HUD panels, excluding the splitter bars we
    // inject ourselves while editing.
    function liveChildren(cluster) {
        return Array.prototype.filter.call(cluster.children, function (c) {
            return !c.hasAttribute('data-hle-splitter');
        });
    }

    function clusterSelOf(cluster) {
        return CLUSTER_SELECTORS.filter(function (s) { return document.querySelector(s) === cluster; })[0] || null;
    }

    function applySaved() {
        CLUSTER_SELECTORS.forEach(function (sel) {
            const cluster = document.querySelector(sel);
            if (!cluster) return;
            const entry = layout.clusters[sel];
            if (entry && entry.order && entry.order.length) {
                // Looked up globally (not just among this cluster's current children) so a panel
                // the player dragged into a DIFFERENT cluster via the content picker gets moved
                // back there too, not just reordered within whatever cluster it happens to already
                // be in.
                entry.order.forEach(function (k) {
                    const el = findPanelByKey(k);
                    if (el) cluster.appendChild(el);
                });
            }
            liveChildren(cluster).forEach(function (c) {
                const h = entry && entry.sizes && entry.sizes[childKey(c)];
                if (h) {
                    ownPanelBox(c);
                    c.style.flexGrow = '0';
                    c.style.flexShrink = '0';
                    c.style.flexBasis = h + 'px';
                    c.dataset.hleSized = '1';
                }
            });
        });
        CONTAINER_SPLITTERS.forEach(function (cfg) {
            const w = layout.container && layout.container[cfg.clusterSel];
            const el = w && document.querySelector(cfg.clusterSel);
            if (el) {
                el.style.width = w + 'px';
                el.dataset.hleSized = '1';
            }
        });
        applyAllScales();
    }

    // Icon/font size, set by the picker modal's sliders (see openPicker), keyed globally like
    // PANEL_REGISTRY rather than per-cluster — the scale belongs to the PANEL, not the slot, so it
    // travels with it across a content-picker swap into a different cluster.
    function applyScale(panel) {
        const s = layout.scales[childKey(panel)];
        panel.style.setProperty('--hle-icon-scale', s && s.icon ? s.icon : '');
        panel.style.setProperty('--hle-font-scale', s && s.font ? s.font : '');
    }

    function applyAllScales() {
        PANEL_REGISTRY.forEach(function (entry) {
            const el = document.querySelector(entry.sel);
            if (el) applyScale(el);
        });
    }

    function refreshOrder(cluster) {
        const sel = clusterSelOf(cluster);
        if (!sel) return;
        clusterEntry(sel).order = liveChildren(cluster).map(childKey);
    }

    function refreshAllOrders() {
        CLUSTER_SELECTORS.forEach(function (sel) {
            const cluster = document.querySelector(sel);
            if (cluster) clusterEntry(sel).order = liveChildren(cluster).map(childKey);
        });
    }

    // A splitter resizes only the two panels it directly sits between: the one before gains
    // exactly what the one after gives up (and vice versa), both pinned to an explicit flex-basis.
    // Non-adjacent panels (e.g. one further up the column) are never touched, regardless of their
    // own flex-grow/shrink — that would resize a panel the player never actually dragged a border
    // of.
    // Pinning a panel for the editor means OWNING its box model outright, not layering an inline
    // flex-basis on top of whatever the rest of the stylesheet happens to say. Earlier versions
    // only pinned flex-grow/shrink/basis and left each panel's own CSS min-height/max-height (a mix
    // of fixed clamps and percentages, written for the responsive auto-layout, not for a human
    // dragging a border) in effect — a growing panel would silently cap out against its own
    // max-height while the splitter kept being dragged, so the border froze there while the OTHER
    // panel in the pair (unaware anything stopped) kept shrinking; and panels not already
    // `box-sizing: border-box` jumped by their padding the instant they were pinned, because
    // flex-basis sizes the content box while getBoundingClientRect() reports the border box. Both
    // are instances of the same problem: two systems (this editor and the stylesheet) independently
    // claiming authority over the same box. The fix is to leave only one in charge — the moment a
    // panel is grabbed, this neutralizes every stylesheet constraint on its height (min/max-height,
    // box-sizing) with inline styles, so from then on flex-basis is the panel's one and only source
    // of size, bounded purely by the generous, editor-owned MIN_H/MAX_H.
    function ownPanelBox(panel) {
        panel.style.boxSizing = 'border-box';
        panel.style.minHeight = '0';
        panel.style.maxHeight = 'none';
    }

    function bindSplitter(splitter) {
        let prevPanel = null, nextPanel = null, startY = 0, startPrevH = 0, startNextH = 0, scale = 1;

        function onMove(e) {
            if (!prevPanel && !nextPanel) return;
            const dy = (startY - e.clientY) / scale;
            // Moving the splitter up grows the panel after it by taking exactly that much from the
            // panel before it (and vice versa), so the pair's combined height never changes. Both
            // panels' height is now fully owned by this editor (see ownPanelBox), so MIN_H/MAX_H are
            // the only limits left to honor — no external CSS constraint can intervene mid-drag.
            let nextH = startNextH + dy;
            let prevH = startPrevH - dy;
            if (nextH < MIN_H) { prevH -= (MIN_H - nextH); nextH = MIN_H; }
            if (prevH < MIN_H) { nextH -= (MIN_H - prevH); prevH = MIN_H; }
            nextH = Math.min(MAX_H, nextH);
            prevH = Math.min(MAX_H, prevH);
            if (nextPanel) { nextPanel.style.flexBasis = Math.round(nextH) + 'px'; nextPanel.dataset.hleSized = '1'; }
            if (prevPanel) { prevPanel.style.flexBasis = Math.round(prevH) + 'px'; prevPanel.dataset.hleSized = '1'; }
        }
        function onUp() {
            if (!prevPanel && !nextPanel) return;
            const cluster = splitter.parentElement;
            const sel = cluster && clusterSelOf(cluster);
            if (sel) {
                if (nextPanel) clusterEntry(sel).sizes[childKey(nextPanel)] = parseFloat(nextPanel.style.flexBasis) || 0;
                if (prevPanel) clusterEntry(sel).sizes[childKey(prevPanel)] = parseFloat(prevPanel.style.flexBasis) || 0;
            }
            prevPanel = null;
            nextPanel = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        }
        splitter.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            prevPanel = splitter.previousElementSibling;
            nextPanel = splitter.nextElementSibling;
            if (!prevPanel && !nextPanel) return;
            scale = measureScale(splitter.parentElement);
            // Panels can be `flex: 1 1 auto` in CSS (fills whatever space is left), so take over
            // the box first (see ownPanelBox) and set flex-basis to its CURRENT rendered height in
            // the same step, so pinning never itself jumps the layout — only the drag from here on
            // does.
            if (nextPanel) {
                ownPanelBox(nextPanel);
                startNextH = nextPanel.getBoundingClientRect().height / scale;
                nextPanel.style.flexGrow = '0';
                nextPanel.style.flexShrink = '0';
                nextPanel.style.flexBasis = startNextH + 'px';
                nextPanel.dataset.hleSized = '1';
            }
            if (prevPanel) {
                ownPanelBox(prevPanel);
                startPrevH = prevPanel.getBoundingClientRect().height / scale;
                prevPanel.style.flexGrow = '0';
                prevPanel.style.flexShrink = '0';
                prevPanel.style.flexBasis = startPrevH + 'px';
                prevPanel.dataset.hleSized = '1';
            }
            startY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp, { once: true });
        });
    }

    function refreshSplitters(cluster) {
        Array.prototype.slice.call(cluster.querySelectorAll(':scope > [data-hle-splitter]')).forEach(function (s) {
            const i = liveSplitters.indexOf(s);
            if (i >= 0) liveSplitters.splice(i, 1);
            s.remove();
        });
        const children = liveChildren(cluster);
        children.forEach(function (child, i) {
            if (i >= children.length - 1) return;
            const splitter = document.createElement('div');
            splitter.className = 'hle-splitter';
            splitter.setAttribute('data-hle-splitter', '1');
            cluster.insertBefore(splitter, child.nextSibling);
            bindSplitter(splitter);
            liveSplitters.push(splitter);
        });
    }

    function bindContainerSplitter(splitter, cfg) {
        let startX = 0, startW = 0, scale = 1;
        const cluster = document.querySelector(cfg.clusterSel);

        function onMove(e) {
            if (!cluster) return;
            const dx = (e.clientX - startX) / scale;
            const w = Math.max(MIN_SIDE_W, Math.min(MAX_SIDE_W, Math.round(startW + cfg.sign * dx)));
            cluster.style.width = w + 'px';
            cluster.dataset.hleSized = '1';
        }
        function onUp() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (!cluster) return;
            layout.container[cfg.clusterSel] = parseFloat(cluster.style.width) || 0;
        }
        splitter.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            if (!cluster) return;
            scale = measureScale(splitter.parentElement);
            startX = e.clientX;
            startW = cluster.getBoundingClientRect().width / scale;
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp, { once: true });
        });
    }

    function setupContainerSplitters() {
        const container = document.querySelector(GAME_CONTAINER_SEL);
        if (!container) return;
        CONTAINER_SPLITTERS.forEach(function (cfg) {
            const cluster = document.querySelector(cfg.clusterSel);
            if (!cluster || cluster.parentElement !== container) return;
            const splitter = document.createElement('div');
            splitter.className = 'hle-vsplitter';
            splitter.setAttribute('data-hle-splitter', '1');
            splitter.setAttribute('data-hle-vsplitter', '1');
            if (cfg.sign > 0) container.insertBefore(splitter, cluster.nextSibling);
            else container.insertBefore(splitter, cluster);
            bindContainerSplitter(splitter, cfg);
            liveSplitters.push(splitter);
        });
    }

    function addGrip(child) {
        child.dataset.hlePrevPos = child.style.position || '';
        child.style.position = 'relative';
        const grip = document.createElement('div');
        grip.className = 'hle-grip';
        grip.title = 'Drag to reorder (within this column)';
        grip.textContent = '⠿';
        child.appendChild(grip);
        liveGrips.push({ child, grip });

        let dragging = false;
        function onMove(e) {
            if (!dragging) return;
            const cluster = child.parentElement;
            if (!cluster) return;
            const siblings = liveChildren(cluster).filter(function (c) { return c !== child; });
            let target = null, before = true;
            for (let i = 0; i < siblings.length; i++) {
                const r = siblings[i].getBoundingClientRect();
                const mid = r.top + r.height / 2;
                if (e.clientY < mid) { target = siblings[i]; before = true; break; }
                target = siblings[i]; before = false;
            }
            if (target) {
                cluster.insertBefore(child, before ? target : target.nextSibling);
                refreshSplitters(cluster);
            }
        }
        function onUp() {
            if (!dragging) return;
            dragging = false;
            grip.classList.remove('hle-grip-active');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (child.parentElement) refreshOrder(child.parentElement);
        }
        grip.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            dragging = true;
            grip.classList.add('hle-grip-active');
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp, { once: true });
        });
    }

    // Swaps two panels' positions in the DOM outright, even across different clusters — the
    // classic two-pointer swap (insert each where the other used to be) handles adjacency and
    // cross-parent moves alike without a temporary placeholder node. Both clusters' splitters and
    // saved order are refreshed afterward since the set of children in each one just changed.
    function swapPanels(a, b) {
        if (!a || !b || a === b) return;
        const aParent = a.parentElement, aNext = a.nextElementSibling;
        const bParent = b.parentElement, bNext = b.nextElementSibling;
        if (!aParent || !bParent) return;
        bParent.insertBefore(a, bNext);
        aParent.insertBefore(b, aNext);
        [aParent, bParent].forEach(function (p) {
            refreshSplitters(p);
            refreshOrder(p);
        });
    }

    let pickOverlay = null;
    let pickSpotlit = null; // the panel currently poking through the overlay

    function closePicker() {
        if (pickSpotlit) {
            pickSpotlit.style.zIndex = pickSpotlit.dataset.hlePrevZ || '';
            delete pickSpotlit.dataset.hlePrevZ;
            pickSpotlit.classList.remove('hle-spotlit');
            pickSpotlit = null;
        }
        if (pickOverlay) { pickOverlay.remove(); pickOverlay = null; }
        if (picker) { picker.remove(); picker = null; }
    }

    // A full modal, not a corner popover: everything else on screen dims behind a scrim, and the
    // panel being reassigned is lifted (z-index) above that same scrim so it alone stays lit — the
    // player sees exactly which slot they're about to change while they pick its new content.
    function openPicker(forPanel) {
        closePicker();
        pickOverlay = document.createElement('div');
        pickOverlay.className = 'hle-pick-overlay';
        pickOverlay.addEventListener('click', closePicker);
        document.body.appendChild(pickOverlay);

        pickSpotlit = forPanel;
        forPanel.dataset.hlePrevZ = forPanel.style.zIndex || '';
        forPanel.style.zIndex = '100001';
        forPanel.classList.add('hle-spotlit');

        picker = document.createElement('div');
        picker._forPanel = forPanel;
        picker.className = 'hle-picker';
        PANEL_REGISTRY.forEach(function (entry) {
            const el = document.querySelector(entry.sel);
            if (!el) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = entry.label;
            if (el === forPanel) btn.className = 'hle-pick-current';
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                swapPanels(forPanel, el);
                closePicker();
            });
            picker.appendChild(btn);
        });

        const sep = document.createElement('div');
        sep.className = 'hle-pick-sep';
        picker.appendChild(sep);

        const key = childKey(forPanel);
        const cur = layout.scales[key] || {};
        function addSlider(labelText, prop, initial) {
            const wrap = document.createElement('label');
            wrap.className = 'hle-pick-slider';
            const span = document.createElement('span');
            span.textContent = labelText;
            const input = document.createElement('input');
            input.type = 'range';
            input.min = '0.6';
            input.max = '2';
            input.step = '0.05';
            input.value = String(initial);
            input.addEventListener('input', function () {
                const v = parseFloat(input.value) || 1;
                if (!layout.scales[key]) layout.scales[key] = {};
                layout.scales[key][prop] = v;
                forPanel.style.setProperty('--hle-' + prop + '-scale', v);
            });
            wrap.appendChild(span);
            wrap.appendChild(input);
            picker.appendChild(wrap);
        }
        addSlider('ICON SIZE', 'icon', cur.icon || 1);
        addSlider('FONT SIZE', 'font', cur.font || 1);

        document.body.appendChild(picker);
    }

    // The whole panel is the click target (not just a tiny corner icon) — "click the container" is
    // the whole point. The `⇄` badge is just a passive hint that it's clickable (pointer-events:
    // none, see injectStyles), so it never needs its own listener or steals the click. Clicks that
    // land on the reorder grip, the resize handle, or inside an already-open picker are excluded so
    // this doesn't fight those, and so a drag-to-reorder release (which still fires a trailing
    // `click`) doesn't immediately reopen the picker on top of it.
    function addPicker(child) {
        const hint = document.createElement('div');
        hint.className = 'hle-pick';
        hint.title = 'Click to change what this slot shows';
        hint.textContent = '⇄';
        child.appendChild(hint);
        livePickers.push({ child, btn: hint });
        child.addEventListener('click', function (e) {
            if (e.target.closest('.hle-grip, .hle-splitter, .hle-picker')) return;
            if (picker && picker._forPanel === child) { closePicker(); return; }
            e.stopPropagation();
            openPicker(child);
        });
    }

    // .game-stage (the actual game canvas) is never grip-draggable or re-assignable: it's
    // sized/rendered by the game's own viewport-fit code, not something this editor should let the
    // player reorder or replace.
    function isReorderable(el) {
        return !el.classList.contains('game-stage');
    }

    function setupCluster(cluster) {
        liveChildren(cluster).filter(isReorderable).forEach(function (c) {
            addGrip(c);
            addPicker(c);
        });
        refreshSplitters(cluster);
    }

    function enterEdit() {
        if (editing || !isActive()) return;
        editing = true;
        document.documentElement.setAttribute('data-hud-edit', '1');
        CLUSTER_SELECTORS.forEach(function (sel) {
            const cluster = document.querySelector(sel);
            if (!cluster || !cluster.offsetWidth || !cluster.offsetHeight) return;
            setupCluster(cluster);
        });
        setupContainerSplitters();
        syncControls();
    }

    function exitEdit() {
        if (!editing) return;
        editing = false;
        document.documentElement.removeAttribute('data-hud-edit');
        liveGrips.forEach(function (g) {
            g.grip.remove();
            g.child.style.position = g.child.dataset.hlePrevPos || '';
            delete g.child.dataset.hlePrevPos;
        });
        liveGrips.length = 0;
        livePickers.forEach(function (p) { p.btn.remove(); });
        livePickers.length = 0;
        closePicker();
        liveSplitters.forEach(function (s) { s.remove(); });
        liveSplitters.length = 0;
        syncControls();
    }

    function toggleEdit() {
        if (editing) exitEdit(); else enterEdit();
    }

    function isEditing() {
        return editing;
    }

    function resetLayout() {
        layout = { clusters: {}, container: {}, scales: {} };
        saveLayout();
        PANEL_REGISTRY.forEach(function (entry) {
            const el = document.querySelector(entry.sel);
            if (el) { el.style.removeProperty('--hle-icon-scale'); el.style.removeProperty('--hle-font-scale'); }
        });
        CLUSTER_SELECTORS.forEach(function (sel) {
            const cluster = document.querySelector(sel);
            if (!cluster) return;
            const order = originalOrder[sel];
            if (order) {
                // Global lookup for the same reason as in applySaved: a panel the content picker
                // moved to a different cluster needs to be found there and moved back, not just
                // reordered among whichever children this cluster currently happens to have.
                order.forEach(function (k) {
                    const el = findPanelByKey(k);
                    if (el) cluster.appendChild(el);
                });
            }
            liveChildren(cluster).forEach(function (c) {
                if (c.dataset.hleSized === '1') {
                    c.style.flexBasis = '';
                    c.style.flexGrow = '';
                    c.style.flexShrink = '';
                    c.style.minHeight = '';
                    c.style.maxHeight = '';
                    c.style.boxSizing = '';
                    delete c.dataset.hleSized;
                }
            });
        });
        CONTAINER_SPLITTERS.forEach(function (cfg) {
            const el = document.querySelector(cfg.clusterSel);
            if (el && el.dataset.hleSized === '1') {
                el.style.width = '';
                delete el.dataset.hleSized;
            }
        });
        if (editing) { exitEdit(); enterEdit(); }
    }

    // SAVE/RESET/LAYOUT all live as icon keys in the bezel tool strip (see
    // js/core/viewport-fit-part3.js, data-tool="save"/"reset"/"layout"), gated to show only while
    // dev mode is on (and, for save/reset, only while actively editing). Nothing to build here.
    function save() {
        refreshAllOrders();
        saveLayout();
    }

    function syncControls() {
        if (!isActive() && editing) exitEdit();
    }

    // Shift+C already toggles dev mode on the start screen / station (see
    // js/ui/start-screen/build-controls-show-btn.js and bind-controls-toggle-part2.js), but both of
    // those handlers only run while their own screen is on top, so the shortcut is dead once a run
    // is in progress. This mirrors it for everywhere else (in combat): only acts while the start
    // screen isn't the one handling it, so the same keypress is never toggled twice.
    function bindGlobalToggle() {
        window.addEventListener('keydown', function (e) {
            if (!e.shiftKey || (e.key !== 'c' && e.key !== 'C')) return;
            if (typeof startScreenManager === 'undefined' || startScreenManager.visible) return;
            // The home station (js/ui/home-station/bind-controls-toggle-part2.js) has its own,
            // entirely separate `document` keydown listener for Shift+C, and it keeps handling the
            // key on its own tab rows even while `startScreenManager.visible` is false (that flag
            // only tracks the start screen's OWN menu, which is merely one tab the station can
            // embed — embeddedMode/visible both go false again the moment a different tab is
            // selected). Missing this meant both listeners fired for one keypress whenever the
            // station was open on any tab but its embedded menu: two toggleDevMode() calls
            // cancelled each other out, so devMode net stayed unchanged while the station's own
            // toast still reported "DEV MODE ON" — a clean double-fire, not a dev-mode bug.
            if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            startScreenManager.toggleDevMode();
            syncControls();
        });
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent =
            '[data-hud-edit="1"] #gameLeftCluster > :not([data-hle-splitter]),' +
            '[data-hud-edit="1"] .game-canvas-container > :not([data-hle-splitter]),' +
            '[data-hud-edit="1"] #gameRightCluster > :not([data-hle-splitter])' +
            '{outline:1px dashed #5fd0ff;outline-offset:-1px;cursor:pointer;}' +
            '.hle-splitter{flex:0 0 8px;margin:2px 0;cursor:ns-resize;background:repeating-linear-gradient(90deg,#5fd0ff 0 6px,transparent 6px 12px);opacity:0.6;border-radius:2px;}' +
            '.hle-splitter:hover{opacity:1;}' +
            '.hle-vsplitter{flex:0 0 8px;margin:0 2px;cursor:ew-resize;background:repeating-linear-gradient(180deg,#ffb15f 0 6px,transparent 6px 12px);opacity:0.6;border-radius:2px;}' +
            '.hle-vsplitter:hover{opacity:1;}' +
            '.hle-grip{position:absolute;bottom:2px;right:2px;width:16px;height:16px;line-height:16px;text-align:center;' +
            'background:#0b2436;color:#aee6ff;font:12px monospace;border-radius:2px;cursor:grab;user-select:none;z-index:10000;}' +
            '.hle-grip-active{cursor:grabbing;background:#1e5278;}' +
            '.hle-pick{position:absolute;top:2px;right:2px;width:16px;height:16px;line-height:16px;text-align:center;' +
            'background:#0b2436;color:#ffd79a;font:12px monospace;border-radius:2px;user-select:none;z-index:10000;pointer-events:none;}' +
            '.hle-pick-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100000;}' +
            '.hle-spotlit{position:relative;box-shadow:0 0 0 2px #ffd79a,0 0 28px 6px rgba(0,0,0,0.6);}' +
            '.hle-picker{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100002;' +
            'background:#0f141c;border:1px solid #3a4a60;border-radius:6px;' +
            'padding:4px;display:flex;flex-direction:column;gap:2px;font:12px/1.4 monospace;min-width:180px;}' +
            '.hle-picker button{background:#141821;color:#cfe8ff;border:1px solid transparent;border-radius:4px;' +
            'padding:6px 10px;cursor:pointer;text-align:left;}' +
            '.hle-picker button:hover{background:#1e2733;}' +
            '.hle-picker button.hle-pick-current{border-color:#ffd79a;color:#fff;}' +
            '.hle-pick-sep{height:1px;background:#3a4a60;margin:4px 2px;}' +
            '.hle-pick-slider{display:flex;flex-direction:column;gap:4px;padding:4px 8px;color:#9fb4c8;' +
            'letter-spacing:0.06em;font-size:11px;}' +
            '.hle-pick-slider input[type=range]{width:100%;accent-color:#ffd79a;}';
        document.head.appendChild(style);
    }

    function captureOriginalOrder() {
        CLUSTER_SELECTORS.forEach(function (sel) {
            const cluster = document.querySelector(sel);
            if (cluster) originalOrder[sel] = liveChildren(cluster).map(childKey);
        });
    }

    // Lets .gi-loadout-side / .gi-mission-side switch their rows from icon-left to icon-on-top
    // once the player has actually resized them tall enough (see the `.gi-roomy` rules in
    // css/styles/part-02.css). This used to be a CSS container query, but that silently does
    // nothing on an engine without `@container` size-containment support, leaving the icons stuck
    // left with no visible failure; a ResizeObserver gets the same result and is universally
    // supported, so there's no silent-failure mode to debug around.
    const ROOMY_MIN_H = 240;
    function watchRoomyPanels() {
        if (typeof ResizeObserver === 'undefined') return;
        const targets = Array.prototype.filter.call(
            document.querySelectorAll('.gi-loadout-side, .gi-mission-side'),
            function (el) { return el.nodeType === 1; }
        );
        if (!targets.length) return;
        const ro = new ResizeObserver(function (entries) {
            entries.forEach(function (entry) {
                const h = entry.contentRect ? entry.contentRect.height : entry.target.getBoundingClientRect().height;
                entry.target.classList.toggle('gi-roomy', h >= ROOMY_MIN_H);
            });
        });
        targets.forEach(function (el) { ro.observe(el); });
    }

    function init() {
        injectStyles();
        captureOriginalOrder();
        applySaved();
        bindGlobalToggle();
        watchRoomyPanels();
        syncControls();
        setInterval(syncControls, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    return { enterEdit, exitEdit, toggleEdit, resetLayout, isActive, isEditing, save };
})();

window.hudLayoutEditor = hudLayoutEditor;
