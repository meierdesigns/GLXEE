"use strict";

// viewport-fit part 3 of 4: continues viewport-fit.js (shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const { FS_OFF, FS_ON, FXOPEN_KEY, FX_ICON, LAYOUT_CANCEL_ICON, LAYOUT_ICON, POWER, RESET_ICON, RES_ICON, ROOT, SAVE_ICON, clamp, getUi, perf, readCssNumber, reduceMotion, setFxOpen } = NS; // from earlier parts
    Object.assign(NS, { guiZoom, onFxEsc, placeResPlate, sizesClose, startSway, syncBezelTools, syncPilotPlate }); // functions (hoisted)

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
                tools.appendChild(btn);
            });
            frame.appendChild(tools);
        }
        if (tools.dataset.wired !== '1') {
            tools.dataset.wired = '1';
            tools.style.pointerEvents = 'auto';
            Object.keys(handlers).forEach(function (key) {
                const btn = tools.querySelector('[data-tool="' + key + '"]');
                if (!btn) return;
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

    // Dev Mode: sliders for the pilot plate / resources screen sizes (--ph-* on the bezel), saved in localStorage.
    const PH_TUNE_KEY = 'vf_pilot_hud_tune_v1';
    const PH_TUNE = [
        ['PILOT SCREEN · POSITION'],
        ['--ph-top', 'TOP', 0, 70, 1],
        ['--ph-left', 'LEFT', 40, 400, 2],
        ['--ph-plate-w', 'WIDTH', 200, 600, 2],
        ['--ph-height', 'HEIGHT', 20, 70, 1],
        ['--ph-name-size', 'NAME SIZE', 10, 36, 1],
        ['PILOT FRAME'],
        ['--ph-crest-top', 'TOP', -120, 20, 1],
        ['--ph-crest-left', 'LEFT', -60, 40, 1],
        ['--ph-crest-w', 'WIDTH', 30, 140, 1],
        ['--ph-crest-h', 'HEIGHT', 30, 160, 1],
        ['PILOT IMAGE'],
        ['--ph-pilot-zoom', 'ZOOM', 0.8, 3, 0.05],
        ['--ph-pilot-y', 'OFFSET Y', -40, 40, 1],
        ['RESOURCE SCREEN · POSITION'],
        ['--ph-gap', 'GAP', 0, 120, 2],
        ['--ph-res-height', 'HEIGHT', 20, 70, 1],
        ['--ph-res-pad', 'PADDING', 0, 60, 1],
        ['RESOURCES'],
        ['--ph-res-icon', 'ICON SIZE', 12, 48, 1],
        ['--ph-res-font', 'FONT SIZE', 10, 36, 1],
        ['--ph-res-spacing', 'SPACING', 4, 60, 1]
    ];
    let phTune = {};
    try { phTune = JSON.parse(localStorage.getItem(PH_TUNE_KEY) || '{}') || {}; } catch (e) { phTune = {}; }
    let phPanel = null, phBtn = null;
    function applyPilotTune(frame) {
        PH_TUNE.forEach(function (t) {
            if (t.length < 2) return;
            if (phTune[t[0]] != null) frame.style.setProperty(t[0], String(phTune[t[0]]));
            else frame.style.removeProperty(t[0]);
        });
    }
    function savePilotTune() {
        try { localStorage.setItem(PH_TUNE_KEY, JSON.stringify(phTune)); } catch (e) { /* ignore */ }
    }
    function buildPilotTunePanel(frame) {
        const cs = getComputedStyle(frame);
        const rows = PH_TUNE.map(function (t) {
            if (t.length < 2) return '<div class="vf-ph-tune-h">' + t[0] + '</div>';
            const v = phTune[t[0]] != null ? phTune[t[0]] : (parseFloat(cs.getPropertyValue(t[0])) || t[2]);
            return '<label class="vf-ph-tune-row"><span>' + t[1] + '</span>'
                + '<input type="range" data-ph="' + t[0] + '" min="' + t[2] + '" max="' + t[3] + '" step="' + t[4] + '" value="' + v + '">'
                + '<b>' + v + '</b></label>';
        }).join('');
        phPanel.innerHTML = rows + '<div class="vf-ph-tune-btns"><button type="button" data-ph-reset>RESET</button><button type="button" data-ph-close>CLOSE</button></div>';
    }
    function syncPilotTuner(frame) {
        applyPilotTune(frame);
        const dev = typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
        if (!phBtn) {
            phBtn = document.createElement('button');
            phBtn.type = 'button';
            phBtn.className = 'vf-ph-tune-btn';
            phBtn.title = 'Pilot HUD size (Dev Mode)';
            phBtn.textContent = 'HUD';
            document.body.appendChild(phBtn);
            phPanel = document.createElement('div');
            phPanel.className = 'vf-ph-tune';
            phPanel.hidden = true;
            document.body.appendChild(phPanel);
            phBtn.addEventListener('click', function () {
                phPanel.hidden = !phPanel.hidden;
                if (!phPanel.hidden) buildPilotTunePanel(frame);
            });
            phPanel.addEventListener('input', function (e) {
                const k = e.target && e.target.getAttribute('data-ph');
                if (!k) return;
                phTune[k] = Number(e.target.value);
                e.target.nextElementSibling.textContent = e.target.value;
                applyPilotTune(frame);
                savePilotTune();
            });
            phPanel.addEventListener('click', function (e) {
                if (e.target.closest('[data-ph-close]')) phPanel.hidden = true;
                else if (e.target.closest('[data-ph-reset]')) {
                    phTune = {};
                    savePilotTune();
                    applyPilotTune(frame);
                    buildPilotTunePanel(frame);
                }
            });
        }
        phBtn.hidden = !dev;
        if (!dev) phPanel.hidden = true;
    }

    function guiZoom() {
        return clamp(readCssNumber('--gui-zoom', 1), 0.25, 4);
    }

    function sizesClose(a, b, eps) {
        return Math.abs(a - b) < eps;
    }
})(window.vfFitScope || (window.vfFitScope = {}));
