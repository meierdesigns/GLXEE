"use strict";

// viewport-fit part 3 of 4: continues viewport-fit.js (shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const { FS_OFF, FS_ON, FXOPEN_KEY, FX_ICON, POWER, RES_ICON, ROOT, clamp, getUi, perf, readCssNumber, reduceMotion, setFxOpen } = NS; // from earlier parts
    Object.assign(NS, { guiZoom, onFxEsc, placeResPlate, sizesClose, startSway, syncBezelTools, syncPilotPlate }); // functions (hoisted)

    function swayLoop(now) {
        const plate = document.getElementById('vf-fx');
        if (!plate || !vfs.fxOpen) { vfs.swayRaf = 0; if (plate) plate.style.transform = ''; vfs.swayAmp = 0; return; }
        const dt = Math.min(0.1, (now - vfs.swayLast) / 1000 || 0.016);
        vfs.swayLast = now;
        vfs.swayT += dt;
        const target = (vfs.swayHover || perf.sway === 'OFF' || (perf.sway === 'AUTO' && reduceMotion) || !plate.classList.contains('is-in') || plate.classList.contains('is-dragging')) ? 0 : 1;
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
    // Remember whether the remote was out: restore it after a reload / screen change.
    (function restoreFx() {
        let was = false;
        try { was = localStorage.getItem(FXOPEN_KEY) === '1'; } catch (e) { /* ignore */ }
        if (!was) return;
        let tries = 0;
        (function wait() {
            if (vfs.fxOpen) return;
            if (getUi() && document.querySelector('.vf-bezel-tools')) { setFxOpen(true, true); return; }
            if (++tries < 200) setTimeout(wait, 50);
        })();
    })();
    function onFxEsc(e) {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setFxOpen(false); }
    }
    function placeFxPlate() { /* the sidebar is docked to the window edge */ }

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
            }
        };
        const meta = {
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
    }
    new MutationObserver(function () { syncBezelTools(); })
        .observe(document.documentElement, { childList: true, subtree: true, characterData: true });

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
        const big = (typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml)
            ? profileSelectionManager.getFactionEmblemHtml(p.faction || 'pirate', 64) : '';
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
    }
    setInterval(syncPilotPlate, 700);

    function guiZoom() {
        return clamp(readCssNumber('--gui-zoom', 1), 0.25, 4);
    }

    function sizesClose(a, b, eps) {
        return Math.abs(a - b) < eps;
    }
})(window.vfFitScope || (window.vfFitScope = {}));
