"use strict";

// viewport-fit part 2 of 4: continues viewport-fit.js (shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {}); // shared mutable state (formerly closure lets)
    const { FACTIONS, FR_LIGHT, FR_SAT, FXTAB_KEY, FX_TABS, FX_TAB_ICONS, applyFrameStyle, endPreviewFaction, frameAdjust, frameDefaults, getUi, hexToHsl, perf, saveFrameStyles, setPerf, setPreviewFaction } = NS; // from earlier parts
    const onFxEsc = (...args) => NS.onFxEsc(...args); // defined in a later part
    const startSway = (...args) => NS.startSway(...args); // defined in a later part
    const fillFxPlate = (...args) => NS.fillFxPlate(...args); // defined in viewport-fit-plate.js
    Object.assign(NS, { setFxOpen, restoreFxScroll, buildFxPlate, startDebugFps, applyFxGeom, startPerfFps, collectPerfSnapshot, syncFxAudioMusicSplit }); // functions (hoisted)

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
        plate.addEventListener('change', onFxChange);
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
    if (fxGeom && fxGeom.w) vfs.fxGeomW = fxGeom.w;
    function syncFxAudioMusicSplit() {
        if (vfs._fxFilling || !vfs.fxOpen || vfs.fxTab !== 'audio') return;
        const want = typeof NS.fxWantAudioMusicSplit === 'function' ? NS.fxWantAudioMusicSplit() : false;
        if (want !== !!vfs.fxAudioWide) fillFxPlate();
    }
    function applyFxGeom() {
        const plate = document.getElementById('vf-fx');
        if (plate && !fxGeom) {
            setFxOrigin(plate, plate.offsetWidth, plate.offsetHeight);
            vfs.fxGeomW = plate.offsetWidth || vfs.fxGeomW || 0;
            return;
        }
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
        vfs.fxGeomW = w;
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
            // Rebuild AUDIO split only after resize ends (avoids remount mid-drag).
            if (mode !== 'move') syncFxAudioMusicSplit();
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    }
    window.addEventListener('resize', function () {
        applyFxGeom();
        syncFxAudioMusicSplit();
    });
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
        const secToggle = e.target.closest && e.target.closest('[data-fx-sec-toggle]');
        if (secToggle) {
            e.preventDefault();
            e.stopPropagation();
            const key = secToggle.getAttribute('data-fx-sec-toggle');
            if (!key) return;
            if (!vfs._fxAudioCollapsed) {
                let map = {};
                try {
                    const raw = JSON.parse(localStorage.getItem('vf_fx_audio_collapsed') || '{}');
                    if (raw && typeof raw === 'object' && !Array.isArray(raw)) map = raw;
                } catch (err) { /* ignore */ }
                vfs._fxAudioCollapsed = map;
            }
            const map = vfs._fxAudioCollapsed;
            map[key] = !map[key];
            try { localStorage.setItem('vf_fx_audio_collapsed', JSON.stringify(map)); } catch (err) { /* ignore */ }
            const sec = secToggle.closest('.vf-fx-sec');
            const c = !!map[key];
            if (sec) sec.classList.toggle('is-collapsed', c);
            secToggle.setAttribute('aria-expanded', String(!c));
            const caret = secToggle.querySelector('.vf-fx-sec-caret');
            if (caret) caret.textContent = c ? '▼' : '▲';
            const body = sec && sec.querySelector('.vf-fx-sec-body');
            if (body) body.hidden = c;
            return;
        }
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
        else if (d.lkBase) {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.cycleSecondBaseColor) {
                colorPaletteSystem.cycleSecondBaseColor(d.lkBase === 'prev' ? -1 : 1, { persist: true, apply: true });
                fillFxPlate();
            }
        }
        else if (d.lkGray) {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
                colorPaletteSystem.setGlobalLook({ saturation: d.lkGray === 'ON' ? 0 : 100 });
                fillFxPlate();
            }
        }
        else if (d.lkBorder) { ui.setBorderWeight(d.lkBorder); }
        else if (d.lkIndicator) { ui.setIndicatorWeight(d.lkIndicator); }
        else if (d.toolsAction) {
            setFxOpen(false);
            if (d.toolsAction === 'startupSound' && typeof startupSoundEditorUI !== 'undefined') startupSoundEditorUI.show();
            else if (d.toolsAction === 'soundtrackEditor' && typeof soundtrackEditorUI !== 'undefined') soundtrackEditorUI.show();
            else if (d.toolsAction === 'shotBehavior') {
                const openShot = () => {
                    if (typeof shotBehaviorEditorUI !== 'undefined') shotBehaviorEditorUI.show('laser');
                };
                if (typeof ensureVfEditors === 'function') ensureVfEditors(() => openShot());
                else openShot();
            }
            else if (d.toolsAction === 'factionCommand' && typeof factionCommandUI !== 'undefined' && factionCommandUI.show) factionCommandUI.show();
            else if (d.toolsAction === 'faceEditor' && typeof startScreenManager !== 'undefined') {
                if (startScreenManager.openFaceEditor) startScreenManager.openFaceEditor();
                else startScreenManager.openAssetGenerator({ typeId: 'portrait' });
            }
            else if (d.toolsAction === 'assetGen' && typeof startScreenManager !== 'undefined') startScreenManager.openAssetGenerator(null);
            else if (d.toolsAction === 'assetGenFaction' && typeof startScreenManager !== 'undefined') startScreenManager.openAssetGenerator({ typeId: 'faction' });
            else if (d.toolsAction === 'assetGenFactionShips' && typeof startScreenManager !== 'undefined') startScreenManager.openAssetGenerator({ typeId: 'faction' });
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
        else if (d.auSound || d.auMusic || d.auReset) {
            const smSettings = (typeof game !== 'undefined' && game && game.settingsManager) ? game.settingsManager
                : (typeof settingsManager !== 'undefined' ? settingsManager : null);
            if (d.auReset && typeof volumeControlsManager !== 'undefined') volumeControlsManager.resetToDefaults();
            if (d.auSound && smSettings) {
                if ((d.auSound === 'ON') !== !!smSettings.settings.soundEnabled) smSettings.toggleSound();
                else if (typeof soundManager !== 'undefined') soundManager.setSoundEnabled(d.auSound === 'ON');
            } else if (d.auSound && typeof soundManager !== 'undefined') soundManager.setSoundEnabled(d.auSound === 'ON');
            if (d.auMusic && smSettings) {
                if ((d.auMusic === 'ON') !== !!smSettings.settings.musicEnabled) smSettings.toggleMusic();
                else if (typeof soundManager !== 'undefined') soundManager.setMusicEnabled(d.auMusic === 'ON');
            } else if (d.auMusic && typeof soundManager !== 'undefined') soundManager.setMusicEnabled(d.auMusic === 'ON');
            if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.wakeAudioFromUserGesture) {
                volumeControlsManager.wakeAudioFromUserGesture();
            }
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
    function onFxChange(e) {
        const sel = e.target;
        if (!sel || !sel.classList) return;
        if (sel.dataset && sel.dataset.auStyle === '1') {
            if (typeof volumeControlsManager !== 'undefined' && volumeControlsManager.setMusicTheme) {
                volumeControlsManager.setMusicTheme(parseInt(sel.value, 10));
            }
            if (typeof musicEditorUI !== 'undefined' && musicEditorUI.syncStyleFromVolume
                && !musicEditorUI._syncingStyle) {
                musicEditorUI.syncStyleFromVolume({ reload: true });
            }
            fillFxPlate();
            return;
        }
        if (sel.classList.contains('vf-fx-voice') && sel.dataset.voiceCh != null) {
            const ch = Number(sel.dataset.voiceCh);
            if (Number.isFinite(ch) && ch >= 0 && ch <= 3 && typeof volumeControlsManager !== 'undefined' && volumeControlsManager.setChannelVoice) {
                volumeControlsManager.setChannelVoice(ch, sel.value || 'default');
            }
            const row = sel.closest('.vf-fx-voice-row');
            const pick = row && row.querySelector('.vf-fx-voice-pick');
            if (pick) {
                const ids = String(pick.dataset.voiceIds || '').split('|');
                let i = ids.indexOf(sel.value);
                if (i < 0) i = 0;
                pick.value = String(i);
                pick.style.setProperty('--look-fill', (i / Math.max(1, ids.length - 1) * 100) + '%');
            }
            return;
        }
    }
    /** Bezel TOOLS → PILOT PORTRAIT: sync backdrop / animation everywhere. */
    function applyPilotPortraitMotion(opts) {
        const o = opts || {};
        try {
            if (o.bgv != null) localStorage.setItem('vf_asset_gen_portrait_bgv_v1', String(o.bgv | 0));
            if (o.bga != null) localStorage.setItem('vf_asset_gen_portrait_bga_v1', String(o.bga | 0));
        } catch (err) { /* ignore */ }
        if (typeof assetGenUI !== 'undefined' && assetGenUI) {
            if (o.bgv != null) {
                if (assetGenUI.setPortraitBgv) assetGenUI.setPortraitBgv(o.bgv | 0);
                else assetGenUI.portraitBgv = o.bgv | 0;
            }
            if (o.bga != null) {
                if (assetGenUI.setPortraitBga) assetGenUI.setPortraitBga(o.bga | 0);
                else assetGenUI.portraitBga = o.bga | 0;
            }
        }
        if (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) {
            const p = profileManager.getActiveProfile();
            if (p) {
                p.portrait = Object.assign({}, p.portrait || {});
                if (o.bgv != null) p.portrait.bgv = o.bgv | 0;
                if (o.bga != null) p.portrait.bga = o.bga | 0;
                if (profileManager.save) profileManager.save();
            }
        }
        if (typeof profileSelectionManager !== 'undefined'
            && profileSelectionManager._startOpts
            && profileSelectionManager._startOpts.look) {
            if (o.bgv != null) profileSelectionManager._startOpts.look.bgv = o.bgv | 0;
            if (o.bga != null) profileSelectionManager._startOpts.look.bga = o.bga | 0;
            if (profileSelectionManager.refreshPilotRow) profileSelectionManager.refreshPilotRow();
        }
        if (typeof onboardingManager !== 'undefined' && onboardingManager._pilotLook) {
            if (o.bgv != null) onboardingManager._pilotLook.bgv = o.bgv | 0;
            if (o.bga != null) onboardingManager._pilotLook.bga = o.bga | 0;
            if (onboardingManager.refreshPilotUi) onboardingManager.refreshPilotUi();
        }
        if (typeof voxelPortrait !== 'undefined' && voxelPortrait.setLook) {
            document.querySelectorAll('canvas.vx-portrait').forEach(function (c) {
                let look = {};
                try { look = JSON.parse(c.dataset.look || '{}') || {}; } catch (err) { look = {}; }
                if (o.bgv != null) look.bgv = o.bgv | 0;
                if (o.bga != null) look.bga = o.bga | 0;
                voxelPortrait.setLook(c, look);
            });
        }
        try { window.dispatchEvent(new CustomEvent('vf-pilot-changed')); } catch (err) { /* ignore */ }
    }

    function onFxInput(e) {
        const inp = e.target;
        if (inp.classList && inp.classList.contains('vf-fx-zoom-in')) {
            applyFxZoom(inp.closest('.vf-bezel-fx'), Number(inp.value));
            try { localStorage.setItem('vf-fx-zoom', String(inp.value)); } catch (err) { /* ignore */ }
            return;
        }
        const ui = getUi();
        // AUDIO faders must still work when uiAppearanceManager failed to boot
        // (partial hosted ZIP load) — they only need volumeControlsManager.
        const sl0 = inp.dataset && inp.dataset.sl;
        const audioOnly = (sl0 && String(sl0).indexOf('au:') === 0)
            || (sl0 && String(sl0).indexOf('pp:') === 0)
            || (inp.dataset && inp.dataset.voiceCh != null);
        if (!ui && !audioOnly) return;
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
        if (inp.dataset.voiceCh != null && inp.classList && inp.classList.contains('vf-fx-voice-pick')) {
            const ch = Number(inp.dataset.voiceCh);
            const ids = String(inp.dataset.voiceIds || '').split('|');
            const i = Math.max(0, Math.min(ids.length - 1, Number(inp.value) || 0));
            inp.style.setProperty('--look-fill', (i / Math.max(1, ids.length - 1) * 100) + '%');
            const row = inp.closest('.vf-fx-voice-row');
            const select = row && row.querySelector('select.vf-fx-voice');
            if (select) select.value = ids[i] || 'default';
            if (Number.isFinite(ch) && ch >= 0 && ch <= 3 && typeof volumeControlsManager !== 'undefined' && volumeControlsManager.setChannelVoice) {
                volumeControlsManager.setChannelVoice(ch, ids[i] || 'default');
            }
            return;
        }
        if (inp.dataset.ix) {
            if (!ui) return;
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
        inp.style.setProperty('--look-fill', ((v - min) / Math.max(1, max - min) * 100) + '%');
        // DevMode pilot portrait backdrop / animation (Bezel TOOLS).
        if (parts[0] === 'pp') {
            const out = inp.nextElementSibling;
            if (parts[1] === 'bgv') {
                if (out && out.tagName === 'OUTPUT') {
                    out.textContent = String((v | 0) + 1).padStart(2, '0') + ' / 32';
                }
                applyPilotPortraitMotion({ bgv: v | 0 });
            } else if (parts[1] === 'bga') {
                const names = (typeof heroPortrait !== 'undefined' && heroPortrait.NAMES && heroPortrait.NAMES.bga)
                    ? heroPortrait.NAMES.bga
                    : ['OFF', 'SLOW', 'NORMAL', 'FAST', 'TURBO'];
                if (out && out.tagName === 'OUTPUT') out.textContent = names[v | 0] || String(v);
                applyPilotPortraitMotion({ bga: v | 0 });
            }
            return;
        }
        // Voice rows: next sibling is <select>, not <output> — never wipe the dropdown.
        if (!(parts[0] === 'au' && (parts[1] === 'jungle' || parts[1] === 'theme' || parts[1] === 'bpm' || parts[1] === 'speed'))) {
            const out = (inp.classList && inp.classList.contains('vf-fx-voice-vol')
                && inp.closest('.vf-fx-voice-row')
                && inp.closest('.vf-fx-voice-row').querySelector('output'))
                || (inp.nextElementSibling && inp.nextElementSibling.tagName === 'OUTPUT'
                    ? inp.nextElementSibling : null);
            if (out) out.textContent = (parts[0] === 'fx' && v === 0) ? 'OFF' : v + inp.dataset.unit;
        }
        if (parts[0] === 'fx') { if (ui) ui.setFx(parts[1], v + '%'); }
        else if (parts[0] === 'sz') {
            if (!ui) return;
            ui.setSizePx(parts[1], parts[2], v);
            // Station FLEETS preview uses the same sizes: rebuild it live.
            refreshFleetPreviewLive();
        }
        else if (parts[0] === 'sp') { if (ui) ui.setSizePct(parts[1], v); }
        else if (parts[0] === 'ss') { if (ui) ui.setShotSpeedPct(parts[1], v); }
        else if (parts[0] === 'df') {
            if (typeof difficultyConfigManager !== 'undefined') { const patch = {}; patch[parts[1]] = v; difficultyConfigManager.setProfile(difficultyConfigManager.current, patch); }
        }
        else if (parts[0] === 'lk') {
            if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.setGlobalLook) {
                colorPaletteSystem.setGlobalLook({ [parts[1]]: v });
            }
        }
        else if (parts[0] === 'fr') {
            const frame = document.getElementById('vf-bezel');
            const cur = vfs.editFaction || frame.getAttribute('data-faction');
            (vfs.frameStyles[cur] = vfs.frameStyles[cur] || {})[parts[1]] = v;
            saveFrameStyles();
            if (!frame.hasAttribute('data-fx-preview')) frame.setAttribute('data-fx-preview', '1');
            applyFrameStyle();
        }
        else if (parts[0] === 'au' && typeof volumeControlsManager !== 'undefined') {
            if ((parts[1] === 'bpm' || parts[1] === 'speed') && volumeControlsManager.setMusicBpm) {
                // au:bpm is reference-equivalent BPM; legacy au:speed was a × multiplier.
                let bpmVal;
                if (parts[1] === 'speed' && v <= 4) {
                    bpmVal = Math.round(v * (volumeControlsManager.referenceBpm || 132));
                } else {
                    bpmVal = Math.max(60, Math.min(300, v));
                }
                if (volumeControlsManager.snapMusicBpm) bpmVal = volumeControlsManager.snapMusicBpm(bpmVal);
                volumeControlsManager.setMusicBpm(bpmVal);
                const snapped = volumeControlsManager.getMusicBpm
                    ? volumeControlsManager.getMusicBpm()
                    : bpmVal;
                if (Number(inp.value) !== snapped) {
                    inp.value = String(snapped);
                    inp.style.setProperty('--look-fill', ((snapped - min) / Math.max(1, max - min) * 100) + '%');
                }
                if (volumeControlsManager.applyBpmMark) {
                    volumeControlsManager.applyBpmMark(inp, min, max);
                }
                const out = inp.nextElementSibling;
                if (out) {
                    out.textContent = volumeControlsManager.formatMusicSpeed
                        ? volumeControlsManager.formatMusicSpeed(snapped)
                        : (Math.round(snapped) + ' BPM');
                }
            } else if (parts[1] === 'jungle' && volumeControlsManager.setJungleAmount) {
                volumeControlsManager.setJungleAmount(Math.max(0, Math.min(100, v)) / 100);
                const out = inp.nextElementSibling;
                if (out) out.textContent = v === 0 ? 'OFF' : v + '%';
            } else if (parts[1] === 'theme' && volumeControlsManager.setMusicTheme) {
                volumeControlsManager.setMusicTheme(v);
                const list = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.list)
                    ? VFTrackerThemes.list : null;
                const out = inp.nextElementSibling;
                if (out && list && list[v]) out.textContent = list[v].label;
                // setMusicTheme may bump STRENGTH — keep the amount row in sync.
                const plate = inp.closest('.vf-bezel-fx');
                const strength = plate && plate.querySelector('[data-sl="au:jungle"]');
                if (strength && volumeControlsManager.getJungleAmount) {
                    const pct = Math.round(Math.max(0, Math.min(1, Number(volumeControlsManager.getJungleAmount()) || 0)) * 100);
                    strength.value = String(pct);
                    strength.style.setProperty('--look-fill', pct + '%');
                    if (strength.nextElementSibling) {
                        strength.nextElementSibling.textContent = pct === 0 ? 'OFF' : pct + '%';
                    }
                }
                // Move preferred-BPM mark on MUSIC BPM to the new STYLE.
                const bpmInp = plate && plate.querySelector('[data-sl="au:bpm"]');
                if (bpmInp && volumeControlsManager.applyBpmMark) {
                    volumeControlsManager.applyBpmMark(bpmInp, +bpmInp.min || 60, +bpmInp.max || 300);
                }
                // Mirror into Music Editor STYLE select (same index / label).
                if (typeof musicEditorUI !== 'undefined' && musicEditorUI.syncStyleFromVolume
                    && !musicEditorUI._syncingStyle) {
                    musicEditorUI.syncStyleFromVolume({ reload: true });
                }
            } else if (parts[1] === 'xfade') {
                const sec = Math.max(0.2, Math.min(3, v));
                if (typeof vfTrackerManager !== 'undefined') vfTrackerManager.crossfadeSeconds = sec;
                if (typeof localAudioManager !== 'undefined') localAudioManager.crossfadeSeconds = sec;
                try { localStorage.setItem('vf_musicCrossfade', String(sec)); } catch (err) { /* ignore */ }
                if (volumeControlsManager.wakeAudioFromUserGesture) {
                    volumeControlsManager.wakeAudioFromUserGesture();
                }
            } else if (parts[1] === 'bass' || parts[1] === 'lead' || parts[1] === 'arp' || parts[1] === 'drums') {
                // Legacy volume mix sliders (kept for older plate HTML).
                const chMap = { bass: 0, lead: 1, arp: 2, drums: 3 };
                const ch = chMap[parts[1]];
                const mul = Math.max(0, Math.min(3, v / 100));
                if (volumeControlsManager.setChannelVolume) volumeControlsManager.setChannelVolume(ch, mul);
            } else {
                const pct = Math.max(0, Math.min(100, v)) / 100;
                if (parts[1] === 'master') volumeControlsManager.setMasterVolume(pct);
                else if (parts[1] === 'sound') volumeControlsManager.setSoundVolume(pct);
                else if (parts[1] === 'music') volumeControlsManager.setMusicVolume(pct);
            }
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
            // Skip while mission-start intro is running — pausing there froze the countdown.
            const introOn = typeof missionStartManager !== 'undefined' && missionStartManager.isActive
                && missionStartManager.isActive();
            if (gs && gs.gameRunning && !gs.isPaused && !introOn) {
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
    // Keep the remote open across navigation/reloads if it was open before.
    (function restoreFxOpen() {
        let wasOpen = false;
        try { wasOpen = localStorage.getItem(FXOPEN_KEY) === '1'; } catch (e) { /* ignore */ }
        if (!wasOpen) return;
        const open = function (triesLeft) {
            try { setFxOpen(true, true); } catch (e) {
                // Other game scripts (e.g. `game`) may still be mid-init (TDZ) at window 'load'; retry briefly.
                if (triesLeft > 0) setTimeout(function () { open(triesLeft - 1); }, 200);
            }
        };
        const start = function () { open(10); };
        if (document.readyState === 'complete') start();
        else window.addEventListener('load', start, { once: true });
    })();
})(window.vfFitScope || (window.vfFitScope = {}));
