"use strict";

// viewport-fit part 2 of 4: continues viewport-fit.js (shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const { FACTIONS, FR_LIGHT, FR_SAT, FXTAB_KEY, FX_TABS, FX_TAB_ICONS, applyFrameStyle, endPreviewFaction, frameAdjust, frameDefaults, getUi, hexToHsl, perf, saveFrameStyles, setPerf, setPreviewFaction } = NS; // from earlier parts
    const onFxEsc = (...args) => NS.onFxEsc(...args); // defined in a later part
    const startSway = (...args) => NS.startSway(...args); // defined in a later part
    const fillFxPlate = (...args) => NS.fillFxPlate(...args); // defined in viewport-fit-plate.js
    Object.assign(NS, { setFxOpen, restoreFxScroll, buildFxPlate, startDebugFps, applyFxGeom, startPerfFps, collectPerfSnapshot }); // functions (hoisted)

    function restoreFxScroll() {
        const body = document.querySelector('#vf-fx .vf-fx-body');
        if (!body) return;
        const y = vfs.fxScroll[vfs.fxTab] || 0;
        body.scrollTop = y;
        // Layout may not be ready (plate just opened): once more next frame.
        requestAnimationFrame(function () {
            const b = document.querySelector('#vf-fx .vf-fx-body');
            if (b && Math.abs(b.scrollTop - y) > 1) b.scrollTop = y;
            vfs.fxScrollLock = false;
        });
    }
    function buildFxPlate() {
        let plate = document.getElementById('vf-fx');
        if (plate) return plate;
        plate = document.createElement('div');
        plate.id = 'vf-fx';
        plate.className = 'vf-bezel-fx';
        try { const z = Number(localStorage.getItem('vf-fx-zoom')); if (z >= 50 && z <= 150) { vfs.fxZoom = z / 100; plate.style.scale = String(z / 100); } } catch (err) { /* ignore */ }
        plate.style.display = 'none';
        document.documentElement.appendChild(plate);
        ['keydown', 'keyup'].forEach(function (t) {
            plate.addEventListener(t, function (e) { e.stopPropagation(); });
        });
        plate.addEventListener('pointerdown', function (e) {
            if (e.target.closest('.vf-fx-grip')) startFxDrag(e, e.target.closest('.vf-fx-grip').getAttribute('data-corner') || 'se');
            else if (e.target.closest('.vf-fx-head') && !e.target.closest('button')) startFxDrag(e, 'move');
        });
        plate.addEventListener('pointerenter', function () { vfs.swayHover = true; });
        plate.addEventListener('pointerleave', function () { vfs.swayHover = false; });
        plate.addEventListener('scroll', function (e) {
            if (vfs.fxScrollLock || !e.target.classList || !e.target.classList.contains('vf-fx-body')) return;
            vfs.fxScroll[vfs.fxTab] = e.target.scrollTop;
            try { localStorage.setItem('vf-fx-scroll', JSON.stringify(vfs.fxScroll)); } catch (err) { /* ignore */ }
        }, true);
        plate.addEventListener('click', onFxClick);
        plate.addEventListener('input', onFxInput);
        return plate;
    }
    /** Live performance snapshot for PERF / DEBUG tabs and console. */
    function collectPerfSnapshot(fps) {
        const canvas = document.getElementById('gameCanvas');
        const bw = canvas ? canvas.width : 0;
        const bh = canvas ? canvas.height : 0;
        let scale = Number(window.PLAYFIELD_RENDER_SCALE) || 0;
        try {
            if (typeof renderManager !== 'undefined' && renderManager && renderManager.getRenderScale) {
                scale = renderManager.getRenderScale();
            }
        } catch (e) { /* optional */ }
        let gp = 0;
        try {
            if (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getGlobalPixelPx) {
                gp = uiAppearanceManager.getGlobalPixelPx() || 0;
            }
        } catch (e) { /* optional */ }
        const gs = (typeof game !== 'undefined' && game && game.gameState)
            || (typeof gameStateManager !== 'undefined' ? gameStateManager : null);
        const running = !!(gs && gs.gameRunning);
        const paused = !!(gs && gs.isPaused);
        let combat = false;
        try {
            const gl = (typeof game !== 'undefined' && game && game.gameLoop) || null;
            if (gl && typeof gl.isCombatSurfaceActive === 'function') combat = !!gl.isCombatSurfaceActive();
            else combat = document.documentElement.classList.contains('vf-game-shown');
        } catch (e) { combat = false; }
        let loop = 'IDLE';
        if (running && combat && paused) loop = 'PAUSED';
        else if (running && combat) loop = 'COMBAT';
        else if (running && !combat) loop = 'PARKED';
        let enemies = 0, bullets = 0, particles = 0, explosions = 0;
        try {
            if (typeof enemyManager !== 'undefined' && enemyManager) {
                enemies = (enemyManager.enemies && enemyManager.enemies.length) || 0;
                enemies += (enemyManager.sideEnemies && enemyManager.sideEnemies.length) || 0;
            }
        } catch (e) { /* optional */ }
        try {
            if (typeof bulletManager !== 'undefined' && bulletManager && bulletManager.bullets) {
                bullets = bulletManager.bullets.length;
            }
        } catch (e) { /* optional */ }
        try {
            if (typeof graphicsManager !== 'undefined' && graphicsManager && graphicsManager.particles) {
                particles = graphicsManager.particles.length;
            } else if (typeof particleSystem !== 'undefined' && particleSystem && particleSystem.particles) {
                particles = particleSystem.particles.length;
            }
        } catch (e) { /* optional */ }
        try {
            if (typeof explosionSystem !== 'undefined' && explosionSystem && explosionSystem.active) {
                explosions = explosionSystem.active.length;
            }
        } catch (e) { /* optional */ }
        let heap = '—';
        try {
            const m = performance.memory;
            if (m && m.usedJSHeapSize) {
                heap = Math.round(m.usedJSHeapSize / 1048576) + ' / ' +
                    Math.round(m.jsHeapSizeLimit / 1048576) + ' MB';
            }
        } catch (e) { /* Chrome-only */ }
        const area = document.getElementById('gmMapArea');
        const mapFilter = !!(area && area.style && /url\(#vfMapPx\)/.test(area.style.filter || ''));
        const fpsN = (typeof fps === 'number' && fps > 0) ? fps : 0;
        return {
            fps: fpsN || null,
            frameMs: fpsN ? (1000 / fpsN).toFixed(1) : null,
            loop: loop,
            backing: bw && bh ? (bw + '×' + bh) : '—',
            backingPx: bw * bh,
            scale: scale ? Number(scale).toFixed(2) : '—',
            gp: gp > 0 ? String(gp) : 'OFF',
            heap: heap,
            enemies: enemies,
            bullets: bullets,
            particles: particles,
            explosions: explosions,
            mapFilter: mapFilter ? 'ON' : 'OFF',
            cores: navigator.hardwareConcurrency || '?',
            dpr: window.devicePixelRatio || 1,
            deviceMem: navigator.deviceMemory ? (navigator.deviceMemory + ' GB') : '?',
            heavy: perf.heavy,
            anim: perf.anim,
            sway: perf.sway,
            viewport: innerWidth + '×' + innerHeight,
            hidden: !!(typeof document !== 'undefined' && document.hidden)
        };
    }
    function paintPerfOutputs(root, snap) {
        if (!root || !snap) return;
        const set = function (sel, val) {
            const el = root.querySelector(sel);
            if (el) el.textContent = val == null ? '—' : String(val);
        };
        const fps = snap.fps != null ? snap.fps : '—';
        const ms = snap.frameMs != null ? snap.frameMs + ' ms' : '—';
        const ent = snap.enemies + ' E · ' + snap.bullets + ' B · ' + snap.particles + ' P · ' + snap.explosions + ' X';
        const px = snap.backingPx ? snap.backingPx.toLocaleString() : '—';
        set('[data-pf-fps]', fps); set('[data-debug-fps]', fps);
        set('[data-pf-framems]', ms); set('[data-debug-framems]', ms);
        set('[data-pf-loop]', snap.loop); set('[data-debug-loop]', snap.loop);
        set('[data-pf-backing]', snap.backing); set('[data-debug-backing]', snap.backing);
        set('[data-pf-scale]', snap.scale); set('[data-debug-scale]', snap.scale);
        set('[data-pf-px]', px); set('[data-debug-px]', px);
        set('[data-pf-gp]', snap.gp); set('[data-debug-gp]', snap.gp);
        set('[data-pf-heap]', snap.heap); set('[data-debug-heap]', snap.heap);
        set('[data-pf-entities]', ent); set('[data-debug-entities]', ent);
        set('[data-pf-mapfilter]', snap.mapFilter); set('[data-debug-mapfilter]', snap.mapFilter);
        set('[data-debug-cores]', snap.cores);
        set('[data-debug-dpr]', snap.dpr);
        set('[data-debug-devmem]', snap.deviceMem);
        set('[data-debug-heavy]', snap.heavy);
        set('[data-debug-anim]', snap.anim);
        set('[data-debug-sway]', snap.sway);
        set('[data-debug-hidden]', snap.hidden ? 'YES' : 'NO');
    }
    function startPerfProbe(tab) {
        const key = tab === 'debug' ? '_debugProbeRaf' : '_perfProbeRaf';
        if (vfs[key]) return;
        let n = 0, t0 = performance.now(), lastFps = 0;
        const tick = function (now) {
            const plate = document.getElementById('vf-fx');
            if (!plate || !vfs.fxOpen || vfs.fxTab !== tab) { vfs[key] = 0; return; }
            n++;
            if (now - t0 >= 500) {
                lastFps = Math.round(n * 1000 / (now - t0));
                n = 0;
                t0 = now;
                paintPerfOutputs(plate, collectPerfSnapshot(lastFps));
            }
            vfs[key] = requestAnimationFrame(tick);
        };
        vfs[key] = requestAnimationFrame(tick);
    }
    let debugFpsRaf = 0;
    function startDebugFps() {
        if (debugFpsRaf) { cancelAnimationFrame(debugFpsRaf); debugFpsRaf = 0; }
        startPerfProbe('debug');
    }
    try { window.vfPerfSnapshot = function () { return collectPerfSnapshot(null); }; } catch (e) { /* optional */ }

    // Move (drag the readout) and resize (corner grip); position and size are remembered.
    const FXGEOM_KEY = 'vf-fx-geom';
    let fxGeom = null;
    try { fxGeom = JSON.parse(localStorage.getItem(FXGEOM_KEY) || 'null'); } catch (e) { fxGeom = null; }
    function applyFxGeom() {
        const plate = document.getElementById('vf-fx');
        if (plate && !fxGeom) setFxOrigin(plate, plate.offsetWidth, plate.offsetHeight);
        if (!plate || !fxGeom) return;
        const W = window.innerWidth, H = window.innerHeight;
        // Clamp the scaled (visual) box: scale pivots on transform-origin, so it sits offset from left/top.
        const k = vfs.fxZoom || 1;
        const w = Math.max(260, Math.min(fxGeom.w, W)), h = Math.max(300, Math.min(fxGeom.h, H));
        setFxOrigin(plate, w, h);
        const dxo = (w / 2 + 78) * (1 - k), dyo = (h - 43) * (1 - k);
        const l = Math.max(-dxo, Math.min(fxGeom.l, W - w * k - dxo)), t = Math.max(-dyo, Math.min(fxGeom.t, H - h * k - dyo));
        plate.style.width = w + 'px'; plate.style.height = h + 'px';
        plate.style.left = l + 'px'; plate.style.top = t + 'px';
        plate.style.right = 'auto'; plate.style.bottom = 'auto';
    }
    function startFxDrag(e, mode) {
        const plate = document.getElementById('vf-fx');
        const r = plate.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;
        const k = vfs.fxZoom || 1;
        const g0 = { l: plate.offsetLeft, t: plate.offsetTop, w: plate.offsetWidth, h: plate.offsetHeight };
        e.preventDefault();
        plate.classList.add('is-dragging');
        const move = function (ev) {
            const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
            if (mode === 'move') {
                // left/top are not scaled, so the plate follows the pointer 1:1
                fxGeom = { l: g0.l + ev.clientX - sx, t: g0.t + ev.clientY - sy, w: g0.w, h: g0.h };
            } else {
                const west = mode.indexOf('w') >= 0, north = mode.indexOf('n') >= 0;
                const w = Math.max(260, g0.w + (west ? -dx : dx)), h = Math.max(300, g0.h + (north ? -dy : dy));
                fxGeom = { l: west ? g0.l + g0.w - w : g0.l, t: north ? g0.t + g0.h - h : g0.t, w: w, h: h };
            }
            applyFxGeom();
        };
        const up = function () {
            plate.classList.remove('is-dragging');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            try { localStorage.setItem(FXGEOM_KEY, JSON.stringify(fxGeom)); } catch (err) { /* ignore */ }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    }
    window.addEventListener('resize', applyFxGeom);
    /** Re-run the station FLEET preview so colour edits show at once (for the faction being edited). */
    function refreshFleetPreviewLive(faction) {
        // enemySizeOverlay is no longer loaded (SIZES live in this panel), so restart the station preview directly.
        if (typeof homeStationUI === 'undefined' || !homeStationUI || !homeStationUI.overlay || !homeStationUI.startFactionFleetPreview) return;
        const cv = homeStationUI.overlay.querySelector('[data-fleet-preview]');
        if (cv) homeStationUI.startFactionFleetPreview(faction || cv.getAttribute('data-faction'), cv.getAttribute('data-ship'));
    }
    // Live PERF probe: only runs while the PERF tab is on screen.
    function startPerfFps() {
        startPerfProbe('perf');
    }
    function onFxClick(e) {
        const b = e.target.closest && e.target.closest('button');
        const ui = getUi();
        if (!b || !ui) return;
        const d = b.dataset;
        if ('fxClose' in d) { setFxOpen(false); return; }
        if (d.fxTab) {
            vfs.fxTab = d.fxTab;
            try { localStorage.setItem(FXTAB_KEY, vfs.fxTab); } catch (err) { /* ignore */ }
            fillFxPlate();
            return;
        }
        if (d.fxArea) ui.setFxArea(d.fxArea);
        else if (d.fxArcade) ui.setFx('arcade', d.fxArcade);
        else if (d.tx) {
            const t = d.tx.split(':');
            if (t[0] === 'main') ui.setFont(t[1]);
            else if (t[0] === 'size') ui.setFontSize(t[1], t[2]);
            else if (t[0] === 'fam') ui.setFontFamily(t[1], t[2]);
        }
        else if (d.vxShip) ui.setShipRenderStyle(d.vxShip);
        else if (d.vxSize) ui.setVoxelSize(d.vxSize);
        else if (d.vxGui) ui.setGuiVoxel(d.vxGui);
        else if (d.vxGv) { const kv = d.vxGv.split(':'); ui.setFx(kv[0], kv[1]); }
        else if (d.szCopy) {
            const text = JSON.stringify({ sizePx: ui.sizePx, shotSpeeds: ui.shotSpeeds }, null, 2);
            console.info('[GLXEE SIZES]', text);
            const legacy = function () {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
                    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                } catch (err2) { /* optional */ }
            };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(legacy); else legacy();
        }
        else if (d.dfPreset) { if (typeof difficultyConfigManager !== 'undefined') difficultyConfigManager.setDifficulty(d.dfPreset); }
        else if (d.dfReset) { if (typeof difficultyConfigManager !== 'undefined') difficultyConfigManager.resetProfile(difficultyConfigManager.current); }
        else if (d.pfSway) setPerf('sway', d.pfSway);
        else if (d.pfHeavy) setPerf('heavy', d.pfHeavy);
        else if (d.pfAnim) setPerf('anim', d.pfAnim);
        else if (d.pfFramepx) ui.setFx('framePx', d.pfFramepx === 'ON' ? '5' : 'OFF');
        else if (d.pfPreset) {
            const lo = d.pfPreset === 'LOW', hi = d.pfPreset === 'HIGH';
            setPerf('sway', lo ? 'OFF' : 'AUTO');
            setPerf('heavy', hi ? 'ON' : 'OFF');
            setPerf('anim', lo ? 'OFF' : 'ON');
            if (lo) ui.setFx('framePx', 'OFF');
        }
        else if (d.debugAction === 'reload') window.location.reload();
        else if (d.debugAction === 'clear') {
            try { localStorage.clear(); sessionStorage.clear(); } catch (err) { /* optional */ }
            window.location.reload();
        }
        else if (d.debugAction === 'console') {
            console.info('[GLXEE DEBUG]', {
                viewport: [innerWidth, innerHeight],
                devicePixelRatio: window.devicePixelRatio || 1,
                localStorage: (() => { try { return JSON.stringify(localStorage).length; } catch (err) { return 'blocked'; } })(),
                perf: collectPerfSnapshot(null)
            });
        }
        else if (d.debugAction === 'perf') {
            const snap = collectPerfSnapshot(null);
            console.info('[GLXEE PERF]', snap);
            try {
                const text = JSON.stringify(snap, null, 2);
                // Sandboxed iframes (itch.io) block the Clipboard API: fall back to a hidden textarea copy.
                const legacyCopy = function () {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
                        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                    } catch (err2) { /* optional */ }
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(legacyCopy);
                } else legacyCopy();
            } catch (err) { /* optional */ }
        }
        else if (d.fxFac) { fxFacPrev = vfs.editFaction || (document.getElementById('vf-bezel') || document.body).getAttribute('data-faction'); vfs.editFaction = d.fxFac; setPreviewFaction(vfs.editFaction); }
        else if (d.frReset) {
            delete vfs.frameStyles[d.frReset]; saveFrameStyles(); applyFrameStyle();
            if (typeof factionShipStyles !== 'undefined' && factionShipStyles.setColorOverride) {
                factionShipStyles.clearColorDraft(d.frReset);
                ['hull', 'edge', 'accent', 'engine'].forEach(function (k) { factionShipStyles.setColorOverride(d.frReset, k, null, null); });
            }
        }
        else if (d.frColorsReset) {
            const o = vfs.frameStyles[d.frColorsReset];
            if (o) { delete o.hull; delete o.lit; delete o.dark; delete o.adj; saveFrameStyles(); applyFrameStyle(); }
        }
        else if (d.fcReset) {
            factionShipStyles.clearColorDraft(d.fcReset);
            ['hull', 'edge', 'accent', 'engine'].forEach(function (k) { factionShipStyles.setColorOverride(d.fcReset, k, null, null); });
        }
        else if (d.fcSave) factionShipStyles.commitColorDrafts(d.fcSave);
        else if (d.fcCancel) factionShipStyles.clearColorDraft(d.fcCancel);
        else return;
        if (d.fcReset || d.fcSave || d.fcCancel || d.frReset) refreshFleetPreviewLive(d.fcReset || d.fcSave || d.fcCancel || d.frReset);
        fillFxPlate();
        if (d.fxFac && fxFacPrev && fxFacPrev !== d.fxFac) fadeFxFac(fxFacPrev, d.fxFac);
        fxFacPrev = null;
    }
    /** The plate is rebuilt on a faction pick; replay the on/off change so the tabs fade instead of jumping. */
    let fxFacPrev = null;
    function fadeFxFac(prev, next) {
        const plate = document.getElementById('vf-fx');
        if (!plate) return;
        const a = plate.querySelector('.vf-fx-fac[data-fx-fac="' + prev + '"]'), b = plate.querySelector('.vf-fx-fac[data-fx-fac="' + next + '"]');
        if (!a || !b) return;
        a.classList.add('on'); b.classList.remove('on');
        void plate.offsetWidth;
        a.classList.remove('on'); b.classList.add('on');
    }
    // Remote scale (UI resolution): zooms around the centre of the slider so it stays under the pointer.
    // Pivot = centre of the scale slider (CSS: left 50% + 36px, width 84px, bottom 34px, height 18px).
    function setFxOrigin(plate, w, h) {
        plate.style.transformOrigin = (w / 2 + 78) + 'px ' + (h - 43) + 'px';
    }
    function applyFxZoom(plate, pct) {
        const k = Math.max(50, Math.min(150, pct)) / 100;
        vfs.fxZoom = k;
        setFxOrigin(plate, plate.offsetWidth, plate.offsetHeight);
        plate.style.scale = String(k);
    }
    // Re-clamp into the window only once the scale slider is released, so the pivot never jumps while dragging.
    document.addEventListener('change', function (e) {
        if (e.target.classList && e.target.classList.contains('vf-fx-zoom-in')) applyFxGeom();
    });
    function onFxInput(e) {
        const inp = e.target;
        if (inp.classList && inp.classList.contains('vf-fx-zoom-in')) {
            applyFxZoom(inp.closest('.vf-bezel-fx'), Number(inp.value));
            try { localStorage.setItem('vf-fx-zoom', String(inp.value)); } catch (err) { /* ignore */ }
            return;
        }
        const ui = getUi();
        if (!ui) return;
        if (inp.dataset.frColor) {
            const frame = document.getElementById('vf-bezel');
            const cur = vfs.editFaction || frame.getAttribute('data-faction');
            (vfs.frameStyles[cur] = vfs.frameStyles[cur] || {})[inp.dataset.frColor] = inp.value;
            saveFrameStyles();
            applyFrameStyle();
            return;
        }
        if (inp.dataset.fc) {
            const frame = document.getElementById('vf-bezel');
            const cur = vfs.editFaction || frame.getAttribute('data-faction');
            const key = inp.dataset.fc.split(':')[0];
            const blk = inp.closest('[data-fc-block]');
            const val = function (k) { const el = blk.querySelector('[data-fc$=":' + k + '"]'); return el ? +el.value : 0; };
            const adj = { h: val('h'), s: factionShipStyles.satSteps[val('s')], l: factionShipStyles.lightSteps[val('l')] };
            factionShipStyles.setColorDraft(cur, key, adj);
            const col = factionShipStyles.adjustColor(factionShipStyles.getDefaultFactionStyle(cur)[key], adj);
            blk.querySelector('.hs-fd-color-chip').style.background = col;
            blk.querySelector('em').textContent = col.toUpperCase();
            document.querySelectorAll('#vf-fx [data-fc-save], #vf-fx [data-fc-cancel]').forEach(function (b) { b.disabled = false; });
            refreshFleetPreviewLive(cur);
            return;
        }
        if (inp.dataset.frc) {
            const frame = document.getElementById('vf-bezel');
            const cur = vfs.editFaction || frame.getAttribute('data-faction');
            const key = inp.dataset.frc.split(':')[0];
            const blk = inp.closest('[data-frc-block]');
            const val = function (k) { const el = blk.querySelector('[data-frc$=":' + k + '"]'); return el ? +el.value : 0; };
            const adj = { h: val('h'), s: FR_SAT[val('s')], l: FR_LIGHT[val('l')] };
            const col = frameAdjust(frameDefaults(cur)[key], adj);
            const fs = (vfs.frameStyles[cur] = vfs.frameStyles[cur] || {});
            fs.adj = fs.adj || {};
            fs.adj[key] = adj;
            blk.querySelector('.hs-fd-color-chip').style.background = col;
            blk.querySelector('em').textContent = col.toUpperCase();
            fs[key] = col;
            saveFrameStyles();
            if (!frame.hasAttribute('data-fx-preview')) frame.setAttribute('data-fx-preview', '1');
            applyFrameStyle();
            return;
        }
        if (inp.dataset.ix) {
            const opts = inp.dataset.opts.split('|');
            const v = opts[+inp.value];
            inp.style.setProperty('--look-fill', (+inp.value / Math.max(1, opts.length - 1) * 100) + '%');
            inp.nextElementSibling.textContent = v;
            const id = inp.dataset.ix;
            if (id === 'vxsize') ui.setVoxelSize(v);
            else if (id === 'gvcell') ui.setFx('gvCell', v);
            else if (id === 'pxsize') ui.setFx('pixelSize', v);
            else if (id === 'framepx') ui.setFx('framePx', v);
            else if (id === 'framerad') ui.setFx('frameRound', v);
            else if (id.indexOf('fsize:') === 0) {
                ui.setFontSize(id.slice(6), v);
                // Live HUD preview: keep the plate outputs in sync with 3-size scale.
                if (id.slice(6) === 'h2' || id.slice(6) === 'text') {
                    const mdOut = document.querySelectorAll('#vf-fx [data-ix="fsize:h2"] + output, #vf-fx [data-ix="fsize:text"] + output');
                    mdOut.forEach(function (o) { o.textContent = v; });
                }
            }
            return;
        }
        if (!inp.dataset.sl) return;
        const parts = inp.dataset.sl.split(':');
        const v = +inp.value, min = +inp.min, max = +inp.max;
        inp.style.setProperty('--look-fill', ((v - min) / (max - min) * 100) + '%');
        inp.nextElementSibling.textContent = (parts[0] === 'fx' && v === 0) ? 'OFF' : v + inp.dataset.unit;
        if (parts[0] === 'fx') ui.setFx(parts[1], v + '%');
        else if (parts[0] === 'sz') {
            ui.setSizePx(parts[1], parts[2], v);
            // Station FLEETS preview uses the same sizes: rebuild it live.
            refreshFleetPreviewLive();
        }
        else if (parts[0] === 'sp') ui.setSizePct(parts[1], v);
        else if (parts[0] === 'ss') ui.setShotSpeedPct(parts[1], v);
        else if (parts[0] === 'df') {
            if (typeof difficultyConfigManager !== 'undefined') { const patch = {}; patch[parts[1]] = v; difficultyConfigManager.setProfile(difficultyConfigManager.current, patch); }
        }
        else if (parts[0] === 'fr') {
            const frame = document.getElementById('vf-bezel');
            const cur = vfs.editFaction || frame.getAttribute('data-faction');
            (vfs.frameStyles[cur] = vfs.frameStyles[cur] || {})[parts[1]] = v;
            saveFrameStyles();
            if (!frame.hasAttribute('data-fx-preview')) frame.setAttribute('data-fx-preview', '1');
            applyFrameStyle();
        }
    }
    const FXOPEN_KEY = 'vf-fx-open';
    function setFxOpen(open, instant) {
        vfs.fxOpen = open;
        try { localStorage.setItem(FXOPEN_KEY, open ? '1' : '0'); } catch (e) { /* ignore */ }
        window.vfFxSidebarOpen = open;
        const plate = buildFxPlate();
        // Leave (and enter) on the side it is parked on.
        if (plate.style.display !== 'none' && plate.offsetWidth) {
            const r = plate.getBoundingClientRect();
            plate.classList.toggle('is-left', r.left + r.width / 2 < window.innerWidth / 2);
        }
        const btn = document.querySelector('.vf-bezel-tools button[data-fx-toggle]');
        if (btn) btn.classList.toggle('is-open', open);
        const gs = (typeof game !== 'undefined' && game && game.gameState) ? game.gameState : null;
        const overlay = document.getElementById('pauseOverlay');
        if (open) {
            fillFxPlate();
            clearTimeout(vfs.fxHideTimer);
            plate.style.display = 'flex';
            if (instant) plate.style.transition = 'none'; // restored on load: already in hand
            void plate.offsetWidth; // start the slide-in from the off-screen pose
            plate.classList.add('is-in');
            if (instant) { void plate.offsetWidth; plate.style.transition = ''; }
            startSway();
            document.addEventListener('keydown', onFxEsc, true);
            // In combat: freeze the field (no dark pause menu) so the effects can be judged.
            if (gs && gs.gameRunning && !gs.isPaused) {
                gs.pauseGame();
                vfs.fxPausedByUs = true;
            }
            if (gs && gs.gameRunning && overlay) overlay.classList.add('hidden');
        } else {
            plate.classList.remove('is-in');
            // Held back out of view first, hidden once the slide is done.
            clearTimeout(vfs.fxHideTimer);
            vfs.fxHideTimer = setTimeout(function () { if (!vfs.fxOpen) plate.style.display = 'none'; }, 420);
            document.removeEventListener('keydown', onFxEsc, true);
            endPreviewFaction();
            if (vfs.fxPausedByUs && gs) gs.resumeGame();
            else if (gs && gs.gameRunning && gs.isPaused && overlay) overlay.classList.remove('hidden');
            vfs.fxPausedByUs = false;
        }
    }
    // Hand sway: driven here (not by a CSS animation) so hover and release ease the
    // amplitude in and out instead of snapping the pose.
    vfs.swayAmp = 0;
    vfs.swayHover = false;
    vfs.swayRaf = 0;
    vfs.swayLast = 0;
    vfs.swayT = 0;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Object.assign(NS, { FXOPEN_KEY, reduceMotion });
})(window.vfFitScope || (window.vfFitScope = {}));
