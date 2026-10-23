"use strict";

// viewport-fit part 3 of 4: continues viewport-fit.js (shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const { FRAME_EDIT_ICON, FS_OFF, FS_ON, FXOPEN_KEY, FX_ICON, HUD_ICON, LAYOUT_CANCEL_ICON, LAYOUT_ICON, POWER, RESET_ICON, RES_ICON, ROOT, SAVE_ICON, applyFrameStyle, clamp, getUi, perf, readCssNumber, reduceMotion, saveFrameStyles, setFxOpen } = NS; // from earlier parts
    Object.assign(NS, { guiZoom, onFxEsc, placeResPlate, sizesClose, startSway, syncBezelTools, syncPilotPlate }); // functions (hoisted)

    // Measure the combined effect of the stage's stacked scale layers (CSS zoom, transform:
    // scale, …) directly rather than tracking down each factor by name — same technique as
    // hud-layout-editor.js's measureScale(). Used by the frame-edit grips to convert a pointer
    // delta in real screen px back into authored CSS px.
    function measureFrameScale(referenceEl) {
        const parent = referenceEl && referenceEl.nodeType === 1 ? referenceEl : document.body;
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:0;top:0;width:2000px;height:2000px;margin:0;border:0;padding:0;visibility:hidden;pointer-events:none;';
        parent.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w > 0 ? w / 2000 : 1;
    }

    function swayLoop(now) {
        const plate = document.getElementById('vf-fx');
        if (!plate || !vfs.fxOpen) { vfs.swayRaf = 0; if (plate) plate.style.transform = ''; vfs.swayAmp = 0; return; }
        const dt = Math.min(0.1, (now - vfs.swayLast) / 1000 || 0.016);
        vfs.swayLast = now;
        vfs.swayT += dt;
        // Pixel Size / heavy UI: skip continuous remote sway (rAF transform thrash).
        let pixelOn = false;
        try { pixelOn = document.documentElement.getAttribute('data-vf-pixel-size') === 'on'; } catch (e) { /* */ }
        const target = (vfs.swayHover || pixelOn || perf.sway === 'OFF' || (perf.sway === 'AUTO' && reduceMotion) || !plate.classList.contains('is-in') || plate.classList.contains('is-dragging')) ? 0 : 1;
        vfs.swayAmp += (target - vfs.swayAmp) * Math.min(1, dt * 5); // ease toward held / swaying
        const t = vfs.swayT;
        const x = (Math.sin(t * 0.9) * 1.2 + Math.sin(t * 1.7 + 1) * 0.6) * vfs.swayAmp;
        const y = (Math.sin(t * 1.1 + 2) * 1.0 + Math.sin(t * 2.3) * 0.5) * vfs.swayAmp;
        const r = (Math.sin(t * 0.8 + 0.5) * 0.35 + Math.sin(t * 1.9) * 0.15) * vfs.swayAmp;
        plate.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + r.toFixed(3) + 'deg)';
        vfs.swayRaf = requestAnimationFrame(swayLoop);
    }
    function startSway() {
        if (vfs.swayRaf) return;
        vfs.swayLast = performance.now();
        vfs.swayRaf = requestAnimationFrame(swayLoop);
    }
    // Do not auto-restore the FX remote after reload: an open remote runs swayLoop
    // and keeps a heavy sidebar live (runtime lag with PIXEL SIZE on). User can reopen via FX.

    function onFxEsc(e) {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setFxOpen(false); }
    }
    function placeFxPlate() { /* the sidebar is docked to the window edge */ }

    // "DEVMODE" badge in the bezel's top strip, shown whenever startScreenManager.devMode is on —
    // on every screen (menu, station, combat), not just the one it happened to be eyeballed on.
    // Deliberately independent of syncBezelTools()/`#vf-bezel`: that function returns immediately
    // when `#vf-bezel` isn't found (e.g. a screen that renders its own separate bezel-like chrome,
    // such as the embedded home station), which silently skipped this badge too when it was called
    // from inside there — devMode could be genuinely on with nothing ever flipping `hidden` back to
    // false. Hide/show only ever needs `document.body`, so it's resolved on its own.
    // Positioned immediately to the LEFT of the tool icon row — never the pilot wallet, a loot
    // chip, or anything else that may or may not be there, since those differ by screen and kept
    // putting the badge somewhere wrong (overlapping or stacked below) depending on which neighbor
    // happened to be present. Save/reset only exist in the DOM while actively editing the layout
    // (they're not just `hidden`, see hud-layout-editor.js), so the row is genuinely narrower until
    // then — space for both is reserved unconditionally so starting/stopping an edit never shifts
    // the badge sideways, rather than only reserving it once they happen to already be there.
    // Vertically centered on the icon row's own height. An earlier version tried matching
    // `.vf-pilot-ress` (the pilot resource bar) instead, on the idea that the two aren't always at
    // the same baseline — but that element isn't reliably the one actually on screen next to the
    // icons (a leftover/hidden instance elsewhere pulled the badge to an unrelated height), and the
    // badge sits directly beside the icon row regardless, so matching ITS height is both the
    // simpler measurement and the one that's actually true of what's visually next to it.
    //
    // `document.body` itself carries a `transform: scale(...)` (part of the stage's own stacked
    // scale layers — see the comment on ui-tooltip.js's `position()`, "body carries the stage scale
    // transform"). A `transform` on an element makes it the containing block for its `position:
    // fixed` descendants too, not just `absolute` ones — so this badge, a direct child of body, was
    // never actually fixed to the viewport at all despite the CSS; it was fixed to body's own
    // (scaled) box. `getBoundingClientRect()` still correctly reports the icon row in real viewport
    // pixels, so every px value computed from it was being fed to a containing block operating in a
    // DIFFERENT, scaled coordinate system — the exact mismatch behind the badge landing at a
    // plausible-looking but always-slightly-wrong height no matter which element it was measured
    // against. Fix: work in fractions of body's own rendered box, not raw px — a CSS percentage for
    // a fixed/absolute child resolves against the containing block's (body's) OWN authored size,
    // and a pure scale preserves proportions within that box, so the same fraction lands in the
    // same visual spot regardless of whatever body's transform's scale factor actually is.
    let devBadgeKey = null;
    function syncDevBadge() {
        const devOn = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
        let badge = document.querySelector('.vf-bezel-devmode');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'vf-bezel-devmode';
            badge.textContent = 'DEVMODE';
            document.body.appendChild(badge);
        }
        badge.hidden = !devOn;
        if (!devOn) { devBadgeKey = null; return; }
        const tools = document.querySelector('.vf-bezel-tools');
        if (!tools) return; // CSS fallback position (part-19.css) still applies
        const toolsRect = tools.getBoundingClientRect();
        if (!toolsRect.width) return;
        const bodyRect = document.body.getBoundingClientRect();
        if (!bodyRect.width || !bodyRect.height) return;
        const btn = tools.querySelector('button:not([hidden])');
        const btnRect = btn ? btn.getBoundingClientRect() : null;
        const gap = parseFloat(getComputedStyle(tools).columnGap || getComputedStyle(tools).gap) || 0;
        const saveBtn = tools.querySelector('[data-tool="save"]');
        const saveVisible = !!(saveBtn && !saveBtn.hidden);
        // 2 slots (save + reset) reserved whenever they're not currently shown themselves.
        const reserve = (btnRect && !saveVisible) ? 2 * (btnRect.width + gap) : 0;
        const leftPx = toolsRect.left - reserve;
        const topPx = toolsRect.top + toolsRect.height / 2;
        const key = Math.round(leftPx) + ':' + Math.round(topPx);
        if (key === devBadgeKey) return;
        devBadgeKey = key;
        const leftPct = ((leftPx - bodyRect.left) / bodyRect.width) * 100;
        const topPct = ((topPx - bodyRect.top) / bodyRect.height) * 100;
        badge.style.right = 'auto';
        badge.style.left = leftPct + '%';
        badge.style.top = topPct + '%';
        badge.style.transform = 'translate(-100%, -50%) translateX(-12px)';
    }
    setInterval(syncDevBadge, 500);

    // Bezel tools (top strip): RES icon (opens the slider), fullscreen (every screen),
    // logout (station only). Fullscreen / logout mirror the real buttons.
    function syncBezelTools() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        let tools = frame.querySelector('.vf-bezel-tools');
        // All four keys exist from the first build on and are only updated in place, so
        // nothing pops in one after another. An unavailable key is an empty socket.
        const handlers = {
            res: function (btn) {
                vfs.resOpen = !vfs.resOpen;
                btn.classList.toggle('is-open', vfs.resOpen);
                placeResPlate();
            },
            fx: function () { setFxOpen(!vfs.fxOpen); },
            fs: function () {
                const src = document.querySelector('#vfFullscreenBtn') || document.querySelector('.home-station-overlay .hs-fullscreen-btn');
                if (src) src.click();
                else if (typeof vfFullscreen !== 'undefined') vfFullscreen.toggle();
            },
            logout: function () {
                if (typeof homeStationUI !== 'undefined' && homeStationUI.isVisible && homeStationUI.logout) {
                    homeStationUI.logout();
                    return;
                }
                const lo = document.querySelector('.home-station-overlay #hsLogout');
                if (lo) { lo.click(); return; }
                if (typeof profileManager !== 'undefined') profileManager.logout();
                if (typeof startScreenManager !== 'undefined') startScreenManager.show({ forceMenu: true });
            },
            layout: function (btn) {
                if (typeof hudLayoutEditor === 'undefined') return;
                hudLayoutEditor.toggleEdit();
                btn.classList.toggle('is-open', hudLayoutEditor.isEditing());
            },
            hud: function () { setPhOpen(!vfs.phOpen); },
            frameEdit: function (btn) {
                toggleFrameEdit();
                btn.classList.toggle('is-open', !!vfs.frameEditOn);
            },
            save: function (btn) {
                if (typeof hudLayoutEditor === 'undefined') return;
                hudLayoutEditor.save();
                btn.classList.add('is-open');
                setTimeout(function () { btn.classList.remove('is-open'); }, 500);
            },
            reset: function () {
                if (typeof hudLayoutEditor === 'undefined') return;
                hudLayoutEditor.resetLayout();
            }
        };
        const meta = {
            save: ['Save layout', SAVE_ICON], reset: ['Reset layout', RESET_ICON], layout: ['Layout edit', LAYOUT_ICON],
            hud: ['HUD remote', HUD_ICON], frameEdit: ['Frame edit', FRAME_EDIT_ICON],
            res: ['Resolution', RES_ICON], fx: ['Visual settings', FX_ICON], fs: ['Fullscreen', FS_OFF], logout: ['Logout', POWER]
        };
        // The keys are static markup in index.html (painted with the first frame); this
        // only wires them. Built here as a fallback if the markup is missing.
        if (!tools) {
            tools = document.createElement('div');
            tools.className = 'vf-bezel-tools';
            Object.keys(meta).forEach(function (key) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.tool = key;
                btn.title = meta[key][0];
                btn.setAttribute('aria-label', meta[key][0]);
                btn.innerHTML = meta[key][1];
                if (key === 'hud' || key === 'layout' || key === 'save' || key === 'reset' || key === 'frameEdit') btn.hidden = true;
                tools.appendChild(btn);
            });
            frame.appendChild(tools);
        }
        // Older saves / markup without the HUD key: inject it after layout.
        if (!tools.querySelector('[data-tool="hud"]') && meta.hud) {
            const hudBtn = document.createElement('button');
            hudBtn.type = 'button';
            hudBtn.dataset.tool = 'hud';
            hudBtn.title = meta.hud[0];
            hudBtn.setAttribute('aria-label', meta.hud[0]);
            hudBtn.innerHTML = meta.hud[1];
            hudBtn.hidden = true;
            const after = tools.querySelector('[data-tool="layout"]');
            if (after && after.nextSibling) tools.insertBefore(hudBtn, after.nextSibling);
            else tools.appendChild(hudBtn);
            tools.dataset.wired = '0'; // re-bind so the new key gets a click handler
        }
        // Older saves / markup without the frame-edit key: inject it after HUD.
        if (!tools.querySelector('[data-tool="frameEdit"]') && meta.frameEdit) {
            const feBtn = document.createElement('button');
            feBtn.type = 'button';
            feBtn.dataset.tool = 'frameEdit';
            feBtn.title = meta.frameEdit[0];
            feBtn.setAttribute('aria-label', meta.frameEdit[0]);
            feBtn.innerHTML = meta.frameEdit[1];
            feBtn.hidden = true;
            const after = tools.querySelector('[data-tool="hud"]');
            if (after && after.nextSibling) tools.insertBefore(feBtn, after.nextSibling);
            else tools.appendChild(feBtn);
            tools.dataset.wired = '0';
        }
        if (tools.dataset.wired !== '1') {
            tools.dataset.wired = '1';
            tools.style.pointerEvents = 'auto';
            Object.keys(handlers).forEach(function (key) {
                const btn = tools.querySelector('[data-tool="' + key + '"]');
                if (!btn || btn.dataset.phBound === '1') return;
                btn.dataset.phBound = '1';
                btn.addEventListener('click', function (e) { e.stopPropagation(); handlers[key](btn); });
            });
            const fxb = tools.querySelector('[data-tool="fx"]');
            if (fxb) fxb.setAttribute('data-fx-toggle', '');
            requestAnimationFrame(function () { placeResPlate(); placeFxPlate(); });
        }
        const q = function (k) { return tools.querySelector('[data-tool="' + k + '"]'); };
        const setOff = function (btn, off) {
            btn.classList.toggle('is-off', off);
            btn.disabled = off;
        };
        q('res').classList.toggle('is-open', vfs.resOpen);
        q('fx').classList.toggle('is-open', vfs.fxOpen);
        const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
        const fsBtn = q('fs');
        setOff(fsBtn, !fsOk);
        const fsOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const fsHtml = fsOn ? FS_ON : FS_OFF;
        if (fsBtn.dataset.state !== (fsOn ? '1' : '0')) {
            fsBtn.dataset.state = fsOn ? '1' : '0';
            fsBtn.innerHTML = fsHtml;
            fsBtn.title = fsOn ? 'Exit fullscreen' : 'Fullscreen';
            fsBtn.setAttribute('aria-label', fsBtn.title);
        }
        // Available whenever a pilot is logged in (not only once the station UI has rendered).
        let logged = document.documentElement.hasAttribute('data-vf-logged');
        if (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) {
            logged = !!profileManager.getActiveProfile();
            if (logged !== document.documentElement.hasAttribute('data-vf-logged')) {
                if (logged) document.documentElement.setAttribute('data-vf-logged', '1');
                else document.documentElement.removeAttribute('data-vf-logged');
            }
        }
        setOff(q('logout'), !logged);
        const devOn = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
        const nowEditing = devOn && typeof hudLayoutEditor !== 'undefined' && hudLayoutEditor.isEditing();
        const layoutBtn = q('layout');
        if (layoutBtn) {
            layoutBtn.hidden = !devOn;
            layoutBtn.classList.toggle('is-open', nowEditing);
            // The button itself becomes the exit: clicking it again always ends the same edit
            // session it started, so once editing it should read as "cancel", not still as
            // "open layout edit" sitting there pressed.
            const editState = nowEditing ? '1' : '0';
            if (layoutBtn.dataset.state !== editState) {
                layoutBtn.dataset.state = editState;
                layoutBtn.innerHTML = nowEditing ? LAYOUT_CANCEL_ICON : LAYOUT_ICON;
                layoutBtn.title = nowEditing ? 'Cancel layout edit' : 'Layout edit';
                layoutBtn.setAttribute('aria-label', layoutBtn.title);
            }
        }
        const hudBtn = q('hud');
        if (hudBtn) {
            hudBtn.hidden = !devOn;
            hudBtn.classList.toggle('is-open', !!vfs.phOpen);
        }
        if (!devOn && vfs.phOpen) setPhOpen(false);
        const frameEditBtn = q('frameEdit');
        if (frameEditBtn) {
            frameEditBtn.hidden = !devOn;
            frameEditBtn.classList.toggle('is-open', !!vfs.frameEditOn);
        }
        if (!devOn && vfs.frameEditOn) toggleFrameEdit(false);
        if (vfs.frameEditOn) renderFrameEditGrips();
        const saveBtn = q('save');
        if (saveBtn) saveBtn.hidden = !nowEditing;
        const resetBtn = q('reset');
        if (resetBtn) resetBtn.hidden = !nowEditing;
    }
    // Watches the WHOLE document (childList/subtree/characterData) since the bezel's state can
    // change from almost anywhere (login, fullscreen, a resource tick). Running syncBezelTools()
    // straight from the callback meant every single mutation anywhere on the page — and a running
    // game mutates DOM text/nodes constantly (health bars, counters, animations) — did a fresh
    // round of querySelector lookups and getBoundingClientRect reads synchronously, often many
    // times within one frame. Coalescing bursts into a single rAF-scheduled run keeps the bezel
    // exactly as up to date (still before the next paint) for a fraction of the work.
    let bezelToolsRaf = 0;
    new MutationObserver(function () {
        if (bezelToolsRaf) return;
        bezelToolsRaf = requestAnimationFrame(function () { bezelToolsRaf = 0; syncBezelTools(); });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    // Dev mode can flip without touching the DOM (e.g. Shift+C while in combat), so the layout
    // key's visibility is also polled rather than relying solely on the mutation observer.
    setInterval(syncBezelTools, 500);

    // The slider plate (fixed pixel size, outside the scaled stage) unfolds to the
    // left of the tool buttons, inside the bezel's top strip.
    function placeResPlate() {
        const plate = document.getElementById('vf-res');
        const tools = document.querySelector('.vf-bezel-tools');
        if (!plate) return;
        plate.style.display = vfs.resOpen && tools ? 'inline-flex' : 'none';
        if (!vfs.resOpen || !tools) return;
        const r = tools.getBoundingClientRect();
        const hh = Math.max(14, Math.min(22, Math.round(r.height)));
        plate.style.height = hh + 'px';
        plate.style.top = Math.round(r.top + (r.height - hh) / 2) + 'px';
        plate.style.left = Math.round(r.left - 8 - plate.offsetWidth) + 'px';
    }

    // Pilot display in the bezel's top strip: crest, name, resources of the active pilot,
    // or an "empty screen" graphic when none is selected.
    function pilotPlateHtml() {
        let p = null;
        try { p = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null; } catch (e) { p = null; }
        if (!p) {
            return { plate: '<span class="vf-pilot-empty" title="No pilot selected"><i></i><b>NO SIGNAL</b></span>', res: '' };
        }
        const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        const ico = function (key) {
            return (typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml && key) ? iconRenderer.imgHtml(key, 16, 'hs-pixel') : '';
        };
        const ids = (typeof economyConfig !== 'undefined' && economyConfig.resourceIds) ? economyConfig.resourceIds : ['scrap', 'ore', 'crystal', 'voltex'];
        const credits = (typeof profileManager !== 'undefined' && profileManager.getCredits) ? profileManager.getCredits(p) : (Number(p.credits) || 0);
        const res = ['credits'].concat(ids).map(function (id) {
            const key = (typeof homeStationUI !== 'undefined' && homeStationUI.resourceIconKey) ? homeStationUI.resourceIconKey(id) : null;
            const v = id === 'credits' ? credits : Math.round(Number((p.resources || {})[id]) || 0);
            return '<span class="vf-pilot-res" title="' + esc(id.toUpperCase()) + '">' + ico(key) + '<b>' + v + '</b></span>';
        }).join('');
        const fac = String(p.faction || 'pirate').toLowerCase();
        // Pilot thumbnail (the look picked at creation), falling back to the faction emblem.
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        const accent = fss && fss.getFactionStyle ? (fss.getFactionStyle(fac) || {}).accent : null;
        let big = '';
        try {
            if (typeof heroPortrait !== 'undefined') big = heroPortrait.html(p.portrait || heroPortrait.heroLook(fac), accent, { nobg: true });
        } catch (e) { big = ''; }
        if (!big && typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml) {
            big = profileSelectionManager.getFactionEmblemHtml(p.faction || 'pirate', 64);
        }
        return { plate: '<span class="vf-pilot-crest" data-f="' + esc(fac) + '"><span class="vf-pilot-crest-in">' + big + '</span></span><span class="vf-pilot-name">' + esc(p.name || '') + '</span>', res: res };
    }
    let pilotSig = '';
    function syncPilotPlate() {
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        const frameEl = document.getElementById('vf-bezel');
        let fac = '';
        try {
            const ap = (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) ? profileManager.getActiveProfile() : null;
            if (ap && ap.faction) fac = String(ap.faction).toLowerCase();
        } catch (e) { /* default */ }
        // No profile yet (early boot / refresh): keep what the page already shows instead of snapping to terran.
        const known = !!fac;
        if (!fac) {
            try { fac = ROOT.getAttribute('data-faction') || (frameEl && frameEl.getAttribute('data-faction')) || (window.vfGuiState && window.vfGuiState.id) || ''; } catch (e) { /* ignore */ }
            fac = fac || 'terran';
        }
        // While a faction is being picked, the picker drives the bezel; release it afterwards.
        if (frameEl && frameEl.hasAttribute('data-fx-preview')) {
            // The frame editor in the FX dropdown is previewing another faction.
            fac = frameEl.getAttribute('data-faction') || fac;
        } else if (frameEl && frameEl.hasAttribute('data-preview')) {
            if (document.querySelector('.profile-selection-name-mode') || window.vfWizardRestoring) fac = frameEl.dataset.pendingFaction || frameEl.getAttribute('data-faction') || fac;   // (also while a refresh is still rebuilding the wizard)
            else {
                frameEl.removeAttribute('data-preview');
                if (window.vfClearGuiPreview) window.vfClearGuiPreview();
                frameEl.style.removeProperty('--retro-ink');
                frameEl.style.removeProperty('--color-primary');
            }
        }
        // One owner for the switch (see faction-gui.js): it animates a real change and ignores previews / the wizard.
        if (typeof factionGui !== 'undefined') { factionGui.reconcile(); if (known) factionGui.follow(fac); }
        else if (frameEl && !frameEl.getAttribute('data-faction')) frameEl.setAttribute('data-faction', fac);
        if (frameEl && !frameEl.querySelector('.vf-bezel-deco')) {
            const d = document.createElement('div');
            d.className = 'vf-bezel-deco';
            frameEl.insertBefore(d, frameEl.firstChild);
        }
        const hud = pilotPlateHtml();
        // Bust crest cache when VOXEL / GUI-voxel flips (emblem Scale2x vs NN).
        const vx = (ROOT.getAttribute('data-vf-ship-render') || '') + '|'
            + (ROOT.getAttribute('data-vf-gui-voxel') || '');
        const sig = hud.plate + '|' + hud.res + '|' + vx;
        let plate = frame.querySelector('.vf-pilot-plate');
        let ress = frame.querySelector('.vf-pilot-ress');
        if (!plate) {
            plate = document.createElement('div');
            plate.className = 'vf-pilot-plate vf-pilot-screen';
            frame.appendChild(plate);
            ress = document.createElement('div');
            ress.className = 'vf-pilot-ress vf-pilot-screen';
            frame.appendChild(ress);
            pilotSig = '';
        }
        if (sig !== pilotSig) {
            pilotSig = sig;
            plate.innerHTML = hud.plate;
            ress.innerHTML = hud.res;
            ress.hidden = !hud.res;
        }
        syncPilotTuner(frame);
    }
    setInterval(syncPilotPlate, 700);

    // Dev Mode HUD remote (second fernbedienung): tabs for outside-screen chrome + pilot/res screens.
    const PH_TUNE_KEY = 'vf_pilot_hud_tune_v1';
    const PH_TAB_KEY = 'vf_pilot_hud_tab';
    const PH_TABS = [['outside', 'OUTSIDE'], ['pilot', 'PILOT'], ['res', 'RES']];
    const PH_CLUSTERS = [['FRAME', ['outside']], ['SCREENS', ['pilot', 'res']]];
    const PH_TAB_ICONS = {
        outside: '<svg class="vf-fx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="3" width="12" height="10"/><rect x="5" y="6" width="6" height="4"/></svg>',
        pilot: '<svg class="vf-fx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" shape-rendering="crispEdges" aria-hidden="true"><circle cx="8" cy="5" r="2"/><path d="M3 14c1-3 3-4 5-4s4 1 5 4"/></svg>',
        res: '<svg class="vf-fx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 12h3V6H2zM7 12h3V4H7zM12 12h2V8h-2z"/></svg>'
    };
    // Per-tab rows: header (len<2) or [key, label, min, max, step].
    const PH_SECTIONS = {
        outside: [
            ['FRAME'],
            ['fr:bgCrop', 'BEZEL FILL', 0, 100, 5],
            ['fr:vineInset', 'VINE INSET', 0, 8, 1],
            ['TAB'],
            ['--ph-tab-up', 'TAB UP', 0, 24, 1],
            ['--ph-tab-side', 'TAB SIDE', 0, 40, 1],
            ['--ph-tab-down', 'TAB DOWN', 0, 16, 1],
            ['--ph-tab-cut', 'TAB CUT', 0, 20, 1],
            ['--ph-tab-round', 'TAB ROUND', 0, 24, 1],
            ['RIM'],
            ['--ph-rim-top', 'RIM TOP', 0, 16, 1],
            ['--ph-rim-side', 'RIM SIDE', 0, 12, 1],
            ['--ph-line', 'LINE', 1, 8, 1],
            ['--ph-crest-rim', 'CREST RIM', 0, 12, 1]
        ],
        pilot: [
            ['POSITION'],
            ['--ph-top', 'TOP', 0, 70, 1],
            ['--ph-left', 'LEFT', 40, 400, 2],
            ['--ph-plate-w', 'WIDTH', 200, 600, 2],
            ['--ph-height', 'HEIGHT', 20, 70, 1],
            ['--ph-name-size', 'NAME SIZE', 10, 36, 1],
            ['CREST'],
            ['--ph-crest-top', 'TOP', -120, 20, 1],
            ['--ph-crest-left', 'LEFT', -60, 40, 1],
            ['--ph-crest-w', 'WIDTH', 30, 140, 1],
            ['--ph-crest-h', 'HEIGHT', 30, 160, 1],
            ['IMAGE'],
            ['--ph-pilot-zoom', 'ZOOM', 0.8, 3, 0.05],
            ['--ph-pilot-y', 'OFFSET Y', -40, 40, 1]
        ],
        res: [
            ['POSITION'],
            ['--ph-gap', 'GAP', 0, 120, 2],
            ['--ph-res-height', 'HEIGHT', 20, 70, 1],
            ['--ph-res-pad', 'PADDING', 0, 60, 1],
            ['RESOURCES'],
            ['--ph-res-icon', 'ICON SIZE', 12, 48, 1],
            ['--ph-res-font', 'FONT SIZE', 10, 36, 1],
            ['--ph-res-spacing', 'SPACING', 4, 60, 1]
        ]
    };
    const PH_ALL = PH_TABS.reduce(function (a, t) { return a.concat(PH_SECTIONS[t[0]] || []); }, []);
    const PH_FR_DEFAULTS = { bgCrop: 50, vineInset: 2 };

    // Frame edit (Devmode): draggable on-screen grips for bezel fill / vine inset.
    // Lives on #vf-bezel so the grip sits in the band. Writes via phSetFr (same keys as HUD).
    const FRAME_EDIT_HANDLES = [
        { key: 'bgCrop', min: 0, max: 100, step: 5, label: 'BEZEL FILL', lenExpr: 'var(--fr-open-side, calc(44 * var(--bz-u)))', topPct: 36 },
        { key: 'vineInset', min: 0, max: 8, step: 1, label: 'VINE INSET', lenExpr: 'calc(8 * var(--bz-u))', topPct: 58 }
    ];
    // Renders the probe in the frame itself so its measured width already reflects every scale
    // layer the frame sits under (getBoundingClientRect/clientX share that same viewport space —
    // no separate scale-factor math needed, unlike the FX/HUD remotes which float outside the
    // scaled stage).
    function frameEditProbePx(frame, lenExpr) {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:0;top:0;height:0;visibility:hidden;pointer-events:none;width:' + lenExpr + ';';
        frame.appendChild(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
    }
    function frameEditOverlay(frame) {
        let ov = frame.querySelector('.vf-frame-edit-overlay');
        if (ov) return ov;
        ov = document.createElement('div');
        ov.className = 'vf-frame-edit-overlay';
        FRAME_EDIT_HANDLES.forEach(function (h) {
            const row = document.createElement('div');
            row.className = 'vf-frame-edit-row';
            row.style.top = h.topPct + '%';
            row.innerHTML = '<span class="vf-frame-edit-label">' + h.label + '</span><i class="vf-frame-edit-grip" data-fe="' + h.key + '"></i>';
            ov.appendChild(row);
        });
        ov.addEventListener('pointerdown', onFrameEditGripDown);
        frame.appendChild(ov);
        return ov;
    }
    function renderFrameEditGrips() {
        const frame = document.getElementById('vf-bezel');
        if (!frame || !vfs.frameEditOn) return;
        const ov = frameEditOverlay(frame);
        ov.hidden = false;
        FRAME_EDIT_HANDLES.forEach(function (h) {
            const grip = ov.querySelector('[data-fe="' + h.key + '"]');
            if (!grip || grip.classList.contains('is-dragging')) return;
            const lenPx = frameEditProbePx(frame, h.lenExpr);
            const v = phFrValue(h.key);
            const frac = lenPx > 0 ? clamp((v - h.min) / (h.max - h.min), 0, 1) : 0;
            grip.style.left = (frac * lenPx) + 'px';
            grip.title = h.label + ': ' + v;
        });
    }
    function onFrameEditGripDown(e) {
        const grip = e.target.closest('.vf-frame-edit-grip');
        if (!grip) return;
        const key = grip.getAttribute('data-fe');
        const h = FRAME_EDIT_HANDLES.filter(function (x) { return x.key === key; })[0];
        const frame = document.getElementById('vf-bezel');
        if (!h || !frame) return;
        e.preventDefault();
        e.stopPropagation();
        const frameRect = frame.getBoundingClientRect();
        const lenPx = frameEditProbePx(frame, h.lenExpr);
        grip.classList.add('is-dragging');
        const apply = function (clientX) {
            const frac = lenPx > 0 ? clamp((clientX - frameRect.left) / lenPx, 0, 1) : 0;
            const raw = h.min + frac * (h.max - h.min);
            const v = Math.round(raw / h.step) * h.step;
            grip.style.left = (clamp((v - h.min) / (h.max - h.min), 0, 1) * lenPx) + 'px';
            grip.title = h.label + ': ' + v;
            phSetFr(key, v);
            if (vfs.phOpen) buildPilotTunePanel(frame);
        };
        apply(e.clientX);
        const move = function (ev) { apply(ev.clientX); };
        const up = function () {
            grip.classList.remove('is-dragging');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    }
    function toggleFrameEdit(force) {
        vfs.frameEditOn = force != null ? !!force : !vfs.frameEditOn;
        const frame = document.getElementById('vf-bezel');
        if (!frame) return;
        if (!vfs.frameEditOn) {
            const ov = frame.querySelector('.vf-frame-edit-overlay');
            if (ov) ov.hidden = true;
            return;
        }
        renderFrameEditGrips();
    }
    window.addEventListener('resize', renderFrameEditGrips);
    let phTune = {};
    try { phTune = JSON.parse(localStorage.getItem(PH_TUNE_KEY) || '{}') || {}; } catch (e) { phTune = {}; }
    let phTab = 'outside';
    try {
        const saved = localStorage.getItem(PH_TAB_KEY);
        if (PH_TABS.some(function (t) { return t[0] === saved; })) phTab = saved;
    } catch (e) { /* ignore */ }
    let phPanel = null, phWired = false;
    if (vfs.phOpen == null) vfs.phOpen = false;
    // Move / resize / scale — same behaviour as the FX remote, own storage keys.
    const PHGEOM_KEY = 'vf-ph-geom';
    const PHZOOM_KEY = 'vf-ph-zoom';
    let phGeom = null;
    try { phGeom = JSON.parse(localStorage.getItem(PHGEOM_KEY) || 'null'); } catch (e) { phGeom = null; }
    try {
        const z = Number(localStorage.getItem(PHZOOM_KEY));
        if (z >= 50 && z <= 150) vfs.phZoom = z / 100;
    } catch (e) { /* ignore */ }
    if (vfs.phZoom == null) vfs.phZoom = 1;
    function phFaction() {
        const frame = document.getElementById('vf-bezel');
        return (frame && frame.getAttribute('data-faction')) || 'terran';
    }
    function phFrValue(key) {
        const st = (vfs.frameStyles && vfs.frameStyles[phFaction()]) || {};
        if (st[key] != null) return st[key];
        return PH_FR_DEFAULTS[key];
    }
    function phSetFr(key, v) {
        const fac = phFaction();
        (vfs.frameStyles[fac] = vfs.frameStyles[fac] || {})[key] = v;
        saveFrameStyles();
        applyFrameStyle();
    }
    function applyPilotTune(frame) {
        PH_ALL.forEach(function (t) {
            if (t.length < 2) return;
            if (t[0].indexOf('fr:') === 0) return;
            if (phTune[t[0]] != null) frame.style.setProperty(t[0], String(phTune[t[0]]));
            else frame.style.removeProperty(t[0]);
        });
    }
    function savePilotTune() {
        try { localStorage.setItem(PH_TUNE_KEY, JSON.stringify(phTune)); } catch (e) { /* ignore */ }
    }
    function phRowHtml(t, cs) {
        if (t.length < 2) return '<div class="vf-fx-title">' + t[0] + '</div>';
        let v;
        if (t[0].indexOf('fr:') === 0) v = phFrValue(t[0].slice(3));
        else v = phTune[t[0]] != null ? phTune[t[0]] : (parseFloat(cs.getPropertyValue(t[0])) || t[2]);
        const fill = ((v - t[2]) / (t[3] - t[2]) * 100);
        return '<label class="vf-fx-row"><span>' + t[1] + '</span>'
            + '<input type="range" data-ph="' + t[0] + '" min="' + t[2] + '" max="' + t[3] + '" step="' + t[4]
            + '" value="' + v + '" style="--look-fill:' + fill + '%"><output>' + v + '</output></label>';
    }
    // Pivot = centre of the scale slider (same layout as FX remote).
    function setPhOrigin(plate, w, h) {
        plate.style.transformOrigin = (w / 2 + 78) + 'px ' + (h - 43) + 'px';
    }
    function applyPhZoom(plate, pct) {
        const k = Math.max(50, Math.min(150, pct)) / 100;
        vfs.phZoom = k;
        setPhOrigin(plate, plate.offsetWidth, plate.offsetHeight);
        plate.style.scale = String(k);
    }
    function applyPhGeom() {
        const plate = phPanel || document.getElementById('vf-ph');
        if (plate && !phGeom) setPhOrigin(plate, plate.offsetWidth, plate.offsetHeight);
        if (!plate || !phGeom) return;
        const W = window.innerWidth, H = window.innerHeight;
        const k = vfs.phZoom || 1;
        const w = Math.max(260, Math.min(phGeom.w, W)), h = Math.max(300, Math.min(phGeom.h, H));
        setPhOrigin(plate, w, h);
        const dxo = (w / 2 + 78) * (1 - k), dyo = (h - 43) * (1 - k);
        const l = Math.max(-dxo, Math.min(phGeom.l, W - w * k - dxo)), t = Math.max(-dyo, Math.min(phGeom.t, H - h * k - dyo));
        plate.style.width = w + 'px'; plate.style.height = h + 'px';
        plate.style.left = l + 'px'; plate.style.top = t + 'px';
        plate.style.right = 'auto'; plate.style.bottom = 'auto';
    }
    function startPhDrag(e, mode) {
        const plate = ensurePhPanel();
        const sx = e.clientX, sy = e.clientY;
        const k = vfs.phZoom || 1;
        const g0 = { l: plate.offsetLeft, t: plate.offsetTop, w: plate.offsetWidth, h: plate.offsetHeight };
        e.preventDefault();
        plate.classList.add('is-dragging');
        const move = function (ev) {
            const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
            if (mode === 'move') {
                phGeom = { l: g0.l + ev.clientX - sx, t: g0.t + ev.clientY - sy, w: g0.w, h: g0.h };
            } else {
                const west = mode.indexOf('w') >= 0, north = mode.indexOf('n') >= 0;
                const w = Math.max(260, g0.w + (west ? -dx : dx)), h = Math.max(300, g0.h + (north ? -dy : dy));
                phGeom = { l: west ? g0.l + g0.w - w : g0.l, t: north ? g0.t + g0.h - h : g0.t, w: w, h: h };
            }
            applyPhGeom();
        };
        const up = function () {
            plate.classList.remove('is-dragging');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            try { localStorage.setItem(PHGEOM_KEY, JSON.stringify(phGeom)); } catch (err) { /* ignore */ }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    }
    window.addEventListener('resize', applyPhGeom);
    document.addEventListener('change', function (e) {
        if (e.target.classList && e.target.classList.contains('vf-ph-zoom-in')) applyPhGeom();
    });
    function ensurePhPanel() {
        if (phPanel) return phPanel;
        phPanel = document.createElement('div');
        phPanel.id = 'vf-ph';
        phPanel.className = 'vf-bezel-fx vf-ph-remote';
        phPanel.style.display = 'none';
        phPanel.hidden = true;
        phPanel.style.scale = String(vfs.phZoom || 1);
        document.documentElement.appendChild(phPanel);
        if (!phWired) {
            phWired = true;
            ['keydown', 'keyup'].forEach(function (t) {
                phPanel.addEventListener(t, function (e) { e.stopPropagation(); });
            });
            phPanel.addEventListener('pointerdown', function (e) {
                if (e.target.closest('.vf-fx-grip')) startPhDrag(e, e.target.closest('.vf-fx-grip').getAttribute('data-corner') || 'se');
                else if (e.target.closest('.vf-fx-head') && !e.target.closest('button')) startPhDrag(e, 'move');
            });
            phPanel.addEventListener('input', function (e) {
                const inp = e.target;
                if (inp.classList && inp.classList.contains('vf-ph-zoom-in')) {
                    applyPhZoom(phPanel, Number(inp.value));
                    try { localStorage.setItem(PHZOOM_KEY, String(inp.value)); } catch (err) { /* ignore */ }
                    return;
                }
                const frame = document.getElementById('vf-bezel');
                const k = inp && inp.getAttribute('data-ph');
                if (!k || !frame) return;
                const v = Number(inp.value);
                const min = Number(inp.min), max = Number(inp.max);
                inp.style.setProperty('--look-fill', ((v - min) / (max - min) * 100) + '%');
                if (inp.nextElementSibling) inp.nextElementSibling.textContent = inp.value;
                if (k.indexOf('fr:') === 0) { phSetFr(k.slice(3), v); return; }
                phTune[k] = v;
                applyPilotTune(frame);
                savePilotTune();
            });
            phPanel.addEventListener('click', function (e) {
                const frame = document.getElementById('vf-bezel');
                const tabBtn = e.target.closest('[data-ph-tab]');
                if (tabBtn) {
                    phTab = tabBtn.getAttribute('data-ph-tab');
                    try { localStorage.setItem(PH_TAB_KEY, phTab); } catch (err) { /* ignore */ }
                    buildPilotTunePanel(frame);
                    return;
                }
                if (e.target.closest('[data-ph-close]')) setPhOpen(false);
                else if (e.target.closest('[data-ph-reset]')) {
                    phTune = {};
                    savePilotTune();
                    const fac = phFaction();
                    const st = vfs.frameStyles[fac];
                    if (st) {
                        delete st.stageInset;
                        delete st.bgCrop;
                        delete st.vineInset;
                        saveFrameStyles();
                        applyFrameStyle();
                    }
                    if (frame) applyPilotTune(frame);
                    buildPilotTunePanel(frame);
                }
            });
        }
        return phPanel;
    }
    function setPhOpen(open) {
        vfs.phOpen = !!open;
        ensurePhPanel();
        phPanel.hidden = !vfs.phOpen;
        phPanel.classList.toggle('is-in', vfs.phOpen);
        const hudBtn = document.querySelector('.vf-bezel-tools [data-tool="hud"]');
        if (hudBtn) hudBtn.classList.toggle('is-open', vfs.phOpen);
        if (vfs.phOpen) {
            phPanel.style.display = 'flex';
            buildPilotTunePanel(document.getElementById('vf-bezel'));
            applyPhGeom();
        } else {
            clearTimeout(vfs.phHideTimer);
            vfs.phHideTimer = setTimeout(function () {
                if (!vfs.phOpen && phPanel) phPanel.style.display = 'none';
            }, 420);
        }
    }
    function buildPilotTunePanel(frame) {
        ensurePhPanel();
        if (!frame) return;
        const cs = getComputedStyle(frame);
        const fac = phFaction();
        const tabLabel = (PH_TABS.filter(function (t) { return t[0] === phTab; })[0] || ['', 'HUD'])[1];
        let h = '<div class="vf-fx-head"><span>HUD · ' + fac.toUpperCase() + ' · ' + tabLabel + '</span>'
            + '<button type="button" data-ph-close aria-label="Close">X</button></div>';
        h += '<div class="vf-fx-tabs">' + PH_CLUSTERS.map(function (c) {
            const keys = c[1].map(function (id) {
                const t = PH_TABS.filter(function (x) { return x[0] === id; })[0];
                return '<button type="button" data-ph-tab="' + t[0] + '" title="' + t[1] + '" aria-label="' + t[1]
                    + '" class="' + (phTab === t[0] ? 'on' : '') + '">' + (PH_TAB_ICONS[t[0]] || '')
                    + '<span>' + t[1] + '</span></button>';
            }).join('');
            return '<div class="vf-fx-cluster" style="flex-grow:' + c[1].length
                + '"><span class="vf-fx-cluster-cap">' + c[0] + '</span><div class="vf-fx-cluster-keys">' + keys + '</div></div>';
        }).join('') + '</div>';
        h += '<div class="vf-fx-body">' + (PH_SECTIONS[phTab] || []).map(function (t) { return phRowHtml(t, cs); }).join('')
            + '<div class="vf-fx-row vf-fx-actions"><button type="button" class="vf-fx-reset" data-ph-reset>RESET</button></div></div>';
        phPanel.innerHTML = h;
        phPanel.insertAdjacentHTML('beforeend',
            '<div class="vf-fx-zoom" title="Scale"><input type="range" class="vf-ph-zoom-in" min="50" max="150" step="5" value="'
            + Math.round((vfs.phZoom || 1) * 100) + '" aria-label="Remote scale"></div>'
            + ['nw', 'ne', 'sw', 'se'].map(function (c) {
                return '<i class="vf-fx-grip" data-corner="' + c + '" title="Resize" aria-hidden="true"></i>';
            }).join(''));
        applyPhGeom();
    }
    function syncPilotTuner(frame) {
        applyPilotTune(frame);
        ensurePhPanel();
    }

    function guiZoom() {
        return clamp(readCssNumber('--gui-zoom', 1), 0.25, 4);
    }

    function sizesClose(a, b, eps) {
        return Math.abs(a - b) < eps;
    }
})(window.vfFitScope || (window.vfFitScope = {}));
