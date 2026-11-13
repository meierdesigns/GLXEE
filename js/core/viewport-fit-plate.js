"use strict";

// viewport-fit part 2b: the FX plate builders (split from viewport-fit-part2.js; shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {});
    const { FACTIONS, FR_LIGHT, FR_SAT, FXTAB_KEY, FX_CLUSTERS, FX_TABS, FX_TAB_ICONS, FX_AUDIO_SPLIT_MIN_W, applyFrameStyle, endPreviewFaction, frameAdjust, frameDefaults, getUi, hexToHsl, perf, saveFrameStyles, setPerf, setPreviewFaction } = NS; // from earlier parts
    const { restoreFxScroll, buildFxPlate, startDebugFps, applyFxGeom, startPerfFps } = NS; // from viewport-fit-part2.js (hoisted functions)
    Object.assign(NS, { fillFxPlate, mountFxMusicEditor, fxDevModeOn, fxWantAudioMusicSplit, fxWantMusicEditor }); // function (hoisted)

    function fxDevModeOn() {
        return typeof startScreenManager !== 'undefined' && !!startScreenManager.devMode;
    }
    /** DevMode AUDIO always hosts the Music Editor (narrow = stacked, wide = side-by-side). */
    function fxWantMusicEditor() {
        if (!fxDevModeOn() || vfs.fxTab !== 'audio') return false;
        // itch / GitHub ZIP: js/ui/dev/ is gitignored — don't reserve split chrome
        // for a "Local-dev only" stub that makes AUDIO settings feel broken.
        if (vfs._musicEditorUnavailable) return false;
        if (typeof musicEditorUI !== 'undefined') return true;
        // Allow a one-shot load attempt only on local origins that can serve /js/ui/dev/.
        try {
            const h = String(location.hostname || '');
            if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '') return true;
        } catch (e) { /* ignore */ }
        return false;
    }
    /** Wide enough for AUDIO settings | Music Editor side-by-side (else stacked). */
    function fxWantAudioMusicSplit() {
        if (!fxWantMusicEditor()) return false;
        const plate = document.getElementById('vf-fx');
        const w = vfs.fxGeomW || (plate && plate.offsetWidth) || 0;
        return w >= (FX_AUDIO_SPLIT_MIN_W || 560);
    }
    function mountFxMusicEditor() {
        const host = document.getElementById('vf-fx-music-editor');
        if (!host) return;
        const mount = function (ui) {
            if (ui && ui.mount) ui.mount(host, { compact: true });
            else {
                host.innerHTML = '<div class="vf-fx-title">MUSIC EDITOR</div>'
                    + '<p class="vf-fx-row">Local-dev only (`js/ui/dev/` — not uploaded).</p>';
            }
        };
        if (typeof musicEditorUI !== 'undefined') {
            // mount() itself no-ops to a style sync when the editor is already live.
            mount(musicEditorUI);
            return;
        }
        if (vfs._musicEditorLoading) {
            host.innerHTML = '<div class="vf-fx-title">MUSIC EDITOR</div><p class="vf-fx-row">Loading…</p>';
            return;
        }
        vfs._musicEditorLoading = true;
        host.innerHTML = '<div class="vf-fx-title">MUSIC EDITOR</div><p class="vf-fx-row">Loading…</p>';
        const s = document.createElement('script');
        s.src = 'js/ui/dev/music-editor.js?v=' + Date.now();
        s.onload = function () {
            vfs._musicEditorLoading = false;
            const h = document.getElementById('vf-fx-music-editor');
            if (h) mount(typeof musicEditorUI !== 'undefined' ? musicEditorUI : null);
        };
        s.onerror = function () {
            vfs._musicEditorLoading = false;
            vfs._musicEditorUnavailable = true;
            // Rebuild AUDIO without the empty editor split so volume/STYLE faders
            // keep the full remote (hosted ZIP / itch).
            try { if (typeof fillFxPlate === 'function') fillFxPlate(); } catch (err) { /* ignore */ }
        };
        document.head.appendChild(s);
    }

    function fxSeg(items, current, attr, wrap) {
        return '<span class="vf-fx-seg' + (wrap ? ' vf-fx-wrap' : '') + '">' + items.map(function (it) {
            return '<button type="button" data-' + attr + '="' + it[0] + '" class="' + (String(current) === String(it[0]) ? 'on' : '') + '">' + it[1] + '</button>';
        }).join('') + '</span>';
    }
    /** ‹ value › stepper over a list of [value, label] — wraps around. */
    function fxStepper(items, current, attr) {
        let i = items.findIndex(function (it) { return String(it[0]) === String(current); });
        if (i < 0) i = 0;
        const prev = items[(i - 1 + items.length) % items.length][0], next = items[(i + 1) % items.length][0];
        return '<span class="vf-fx-step"><button type="button" data-' + attr + '="' + prev + '" aria-label="Previous">&lt;</button>' +
            '<output>' + items[i][1] + '</output><button type="button" data-' + attr + '="' + next + '" aria-label="Next">&gt;</button></span>';
    }
    /** Slider over a list of allowed values (index slider); shows the value itself. */
    function fxOptSlider(label, id, options, current) {
        let i = options.indexOf(String(current));
        if (i < 0) i = 0;
        const max = Math.max(1, options.length - 1);
        return '<label class="vf-fx-row"><span>' + label + '</span><input type="range" min="0" max="' + max + '" step="1" value="' + i +
            '" data-ix="' + id + '" data-opts="' + options.join('|') + '" style="--look-fill:' + (i / max * 100) + '%"><output>' + options[i] + '</output></label>';
    }
    // Small stroke icons for the DIFFICULTY rows, picked from the setting key.
    const DF_ICONS = {
        damage: '<path d="M8 1l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z"/>',
        health: '<path d="M8 14L2 8V4h4l2 2 2-2h4v4z"/>',
        speed: '<path d="M2 3l5 5-5 5M8 3l5 5-5 5"/>',
        count: '<path d="M3 3h3v3H3zM10 3h3v3h-3zM3 10h3v3H3zM10 10h3v3h-3z"/>',
        evasion: '<path d="M2 13c3 0 3-10 6-10s3 10 6 10"/>',
        aim: '<circle cx="8" cy="8" r="4"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/>',
        obstacle: '<path d="M3 13l-1-6 4-4 6 1 3 5-3 5z"/>',
        rate: '<path d="M9 1L3 9h4l-1 6 7-8H9z"/>',
        ship: '<path d="M8 1l4 10-4-2-4 2zM5 13h6"/>',
        shot: '<path d="M2 8h8M10 5l4 3-4 3z"/>',
        limit: '<path d="M2 4h12M2 8h12M2 12h12"/>'
    };
    function dfIcon(key) {
        let id = 'speed';
        if (key === 'df:playerSpeedMul') id = 'ship';
        else if (key.indexOf('ss:') === 0) id = 'shot';
        else if (/Damage/.test(key)) id = 'damage';
        else if (/Health/.test(key)) id = 'health';
        else if (/Evasion|evasion/.test(key)) id = 'evasion';
        else if (/prediction/.test(key)) id = 'aim';
        else if (/obstacle/.test(key)) id = 'obstacle';
        else if (/AttackRate/.test(key)) id = 'rate';
        else if (/Count/.test(key)) id = 'count';
        else if (/MaxActive/.test(key)) id = 'limit';
        return '<svg class="vf-fx-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" shape-rendering="crispEdges" aria-hidden="true">' + DF_ICONS[id] + '</svg>';
    }
    function fxSlider(label, key, min, max, step, value, unit, displayValue, markValue) {
        if (key.indexOf('df:') === 0 || key.indexOf('ss:') === 0) label = dfIcon(key) + '<em>' + label + '</em>';
        const shown = displayValue == null ? value : displayValue;
        const span = Math.max(1, max - min);
        let markStyle = '';
        let markClass = '';
        let markAttr = '';
        if (markValue != null && Number.isFinite(Number(markValue))) {
            const mv = Math.max(min, Math.min(max, Number(markValue)));
            const markPct = ((mv - min) / span * 100).toFixed(2);
            markStyle = ';--bpm-mark:' + markPct + '%';
            markClass = ' has-bpm-mark';
            markAttr = ' data-bpm-mark="' + Math.round(mv) + '"';
        }
        return '<label class="vf-fx-row"><span>' + label + '</span><input type="range"' +
            (markClass ? ' class="' + markClass.trim() + '"' : '') +
            ' min="' + min + '" max="' + max + '" step="' + step +
            '" value="' + value + '" data-sl="' + key + '" data-unit="' + (unit || '') + '"' + markAttr +
            ' style="--look-fill:' + ((value - min) / span * 100) + '%' + markStyle + '"><output>' +
            (key.indexOf('fx:') === 0 && +value === 0 ? 'OFF' : shown + (unit || '')) + '</output></label>';
    }
    function fxToggle(label, key, on) {
        return '<div class="vf-fx-row"><span>' + label + '</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], on, 'tg-' + key.replace(':', '-')) + '</div>';
    }
    /** Voice dropdown + option slider + channel volume (BASS / LEAD / ARP / DRUMS). */
    function fxVoiceSelect(label, ch, current, volPct) {
        const opts = (typeof VFTrackerVoices !== 'undefined' && VFTrackerVoices.optionsFor)
            ? VFTrackerVoices.optionsFor(ch)
            : [{ id: 'default', label: 'DEFAULT' }];
        const cur = String(current || 'default');
        let idx = 0;
        for (let i = 0; i < opts.length; i++) if (opts[i].id === cur) { idx = i; break; }
        const max = Math.max(0, opts.length - 1);
        const keys = ['bass', 'lead', 'arp', 'drums'];
        const pct = Math.max(0, Math.min(300, Math.round(Number(volPct) || 100)));
        const ids = opts.map(function (o) { return o.id; }).join('|');
        const labels = opts.map(function (o) { return o.label; }).join('|');
        const html = opts.map(function (o) {
            return '<option value="' + o.id + '"' + (o.id === cur ? ' selected' : '') + '>' + o.label + '</option>';
        }).join('');
        // Order: label | volume | dropdown | style pick (dropdown left of style fader).
        return '<label class="vf-fx-row vf-fx-voice-row"><span>' + label + '</span>' +
            '<input type="range" class="vf-fx-voice-vol" min="0" max="300" step="1" value="' + pct + '" data-sl="au:' + keys[ch] +
            '" data-unit="%" style="--look-fill:' + Math.min(100, pct / 3) + '%" aria-label="' + label + ' volume">' +
            '<select class="vf-fx-voice" data-voice-ch="' + ch + '" title="' + label + ' voice">' + html + '</select>' +
            '<input type="range" class="vf-fx-voice-pick" min="0" max="' + max + '" step="1" value="' + idx +
            '" data-voice-ch="' + ch + '" data-voice-ids="' + ids + '" data-voice-labels="' + labels +
            '" style="--look-fill:' + (idx / Math.max(1, max) * 100) + '%" title="' + label + ' voice slider" aria-label="' + label + ' voice">' +
            '<output>' + pct + '%</output></label>';
    }
    /** Collapsed AUDIO sections { key: true }, loaded once from localStorage. */
    function fxAudioCollapsedMap() {
        if (!vfs._fxAudioCollapsed) {
            let map = {};
            try {
                const raw = JSON.parse(localStorage.getItem('vf_fx_audio_collapsed') || '{}');
                if (raw && typeof raw === 'object' && !Array.isArray(raw)) map = raw;
            } catch (err) { /* ignore */ }
            vfs._fxAudioCollapsed = map;
        }
        return vfs._fxAudioCollapsed;
    }
    /** Collapsible AUDIO block: clickable title + body (VOLUME / VOICES / PLAYBACK / TOGGLES). */
    function fxAudioSection(key, label, bodyHtml) {
        const c = !!fxAudioCollapsedMap()[key];
        return '<section class="vf-fx-sec' + (c ? ' is-collapsed' : '') + '" data-fx-sec="' + key + '">' +
            '<button type="button" class="vf-fx-title" data-fx-sec-toggle="' + key + '" aria-expanded="' + (!c) + '">' +
            '<span class="vf-fx-sec-label">' + label + '</span>' +
            '<i class="vf-fx-title-rule" aria-hidden="true"></i>' +
            '<span class="vf-fx-sec-caret" aria-hidden="true">' + (c ? '▼' : '▲') + '</span></button>' +
            '<div class="vf-fx-sec-body"' + (c ? ' hidden' : '') + '>' + bodyHtml + '</div></section>';
    }
    /** Music STYLE index slider + STRENGTH (amount) on the row below. */
    function fxStyleSelect(currentIdx, junglePct, jungleLabel) {
        const list = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.list)
            ? VFTrackerThemes.list
            : [{ id: 'planet', label: 'PLANET' }];
        const max = Math.max(0, list.length - 1);
        const cur = Math.max(0, Math.min(max, Math.round(Number(currentIdx) || 0)));
        const pct = Math.max(0, Math.min(100, Math.round(Number(junglePct) || 0)));
        const styleName = (list[cur] && list[cur].label) || 'PLANET';
        const strengthLabel = jungleLabel == null ? (pct === 0 ? 'OFF' : pct + '%') : jungleLabel;
        const fill = max > 0 ? (cur / max * 100) : 0;
        return '<label class="vf-fx-row vf-fx-style-pick-row"><span>STYLE</span>' +
            '<input type="range" class="vf-fx-voice-pick" min="0" max="' + max + '" step="1" value="' + cur +
            '" data-sl="au:theme" data-unit="" style="--look-fill:' + fill + '%" title="Music style" aria-label="Music style">' +
            '<output>' + styleName + '</output></label>' +
            fxSlider('STRENGTH', 'au:jungle', 0, 100, 1, pct, '', strengthLabel);
    }
    // Fleet colours (hull / edge / accent / engine of the faction's ships): HUE continuous,
    // SAT / LIGHT in three steps. Slider moves are unsaved drafts shown live; SAVE keeps them.
    function fleetColorsHtml(cur) {
        const fss = typeof factionShipStyles !== 'undefined' ? factionShipStyles : null;
        if (!fss || !fss.getDefaultFactionStyle) return '';
        const style = fss.getFactionStyle(cur), dflt = fss.getDefaultFactionStyle(cur), ov = fss.getColorOverrides(cur);
        const near = function (steps, x) { return steps.reduce(function (bi, y, i) { return Math.abs(y - x) < Math.abs(steps[bi] - x) ? i : bi; }, 0); };
        const dirty = fss.hasColorDraft(cur);
        return '<div class="vf-fx-title vf-fx-title-row"><span>FLEET COLORS</span><button type="button" class="vf-fx-reset" data-fc-reset="' + cur + '">RESET</button></div>' + [['hull', 'HULL (BASE)'], ['edge', 'EDGE'], ['accent', 'ACCENT'], ['engine', 'ENGINE']].map(function (k) {
            const c = style[k[0]];
            if (!c) return '';
            const o = ov[k[0]] || {};
            const row = function (part, tag, min, max, val) {
                return '<span class="hs-fd-slider-tag">' + tag + '</span><input type="range" class="hs-fd-adj hs-fd-adj-' + part + '" min="' + min + '" max="' + max +
                    '" step="1" value="' + val + '" data-fc="' + k[0] + ':' + part + '" aria-label="' + k[1] + ' ' + tag + '">';
            };
            return '<div class="vf-fr-color" data-fc-block="' + k[0] + '"><div class="hs-fd-color-row"><i class="hs-fd-color-chip" style="background:' + c + '"></i>' +
                '<span class="hs-fd-color-label">' + k[1] + '</span><em>' + String(c).toUpperCase() + '</em></div><div class="vf-fr-sliders">' +
                row('h', 'HUE', 0, 359, o.h != null ? o.h : fss.hueOf(dflt[k[0]])) +
                row('s', 'SAT', 0, 2, near(fss.satSteps, o.s != null ? o.s : 100)) +
                row('l', 'LIGHT', 0, 2, near(fss.lightSteps, o.l != null ? o.l : 0)) + '</div></div>';
        }).join('') + '<div class="vf-fx-row vf-fx-actions"><button type="button" class="vf-fx-reset" data-fc-cancel="' + cur + '"' + (dirty ? '' : ' disabled') +
            '>CANCEL</button><button type="button" class="vf-fx-reset" data-fc-save="' + cur + '"' + (dirty ? '' : ' disabled') + '>SAVE</button></div>';
    }
    function fillFxPlate() {
        const ui = getUi();
        const plate = buildFxPlate();
        // AUDIO only needs volumeControlsManager; other tabs need appearance.
        if (!ui && vfs.fxTab !== 'audio') return;
        vfs._fxFilling = true;
        try {
        vfs.fxScrollLock = true;
        const devOn = fxDevModeOn();
        if (vfs.fxTab === 'music') vfs.fxTab = 'audio'; // stale saved tab → AUDIO
        let h = '<div class="vf-fx-head"><span>' + (FX_TABS.filter(function (t) { return t[0] === vfs.fxTab; })[0] || ['', ''])[1] + '</span><button type="button" data-fx-close aria-label="Close">X</button></div>' +
            '<div class="vf-fx-tabs">' + FX_CLUSTERS.map(function (c, ci) {
                const ids = c[1];
                if (!ids.length) return '';
                const keys = ids.map(function (id) {
                    const t = FX_TABS.filter(function (x) { return x[0] === id; })[0];
                    const html = '<button type="button" data-fx-tab="' + t[0] + '" title="' + t[1] + '" aria-label="' + t[1] + '" class="' + (vfs.fxTab === t[0] ? 'on' : '') + '" style="font-size:11px!important;line-height:1!important;letter-spacing:.05em!important;">' + (FX_TAB_ICONS[t[0]] || '') + '<span>' + t[1] + '</span></button>';
                    return html;
                }).join('');
                return (ci === 2 ? '<i class="vf-fx-tabs-break"></i>' : '') + '<div class="vf-fx-cluster" style="flex-grow:' + ids.length + '"><span class="vf-fx-cluster-cap">' + c[0] + '</span><div class="vf-fx-cluster-keys">' + keys + '</div></div>';
            }).join('') + '</div>';
        const wantEditor = fxWantMusicEditor();
        const wantSplit = wantEditor && fxWantAudioMusicSplit();
        vfs.fxAudioWide = wantSplit;
        h += '<div class="vf-fx-body' + (wantEditor ? ' is-audio-split' + (wantSplit ? '' : ' is-audio-stack') : '') + '">';
        if (vfs.fxTab === 'fx') {
            h += '<div class="vf-fx-row"><span>AREA</span>' + fxStepper([['SCREEN', 'INSIDE'], ['FRAME', 'OUTSIDE'], ['ALL', 'BOTH']], ui.fxArea, 'fx-area') + '</div>';
            [['glow', 'GLOW'], ['scanlines', 'SCANLINES'], ['crt', 'CRT'], ['chroma', 'CHROMA'], ['vignette', 'VIGNETTE'], ['noise', 'NOISE'], ['flicker', 'FLICKER'], ['bloom', 'BLOOM'], ['bloomSpread', 'B. SPREAD'], ['bloomThreshold', 'B. CUTOFF'], ['hdr', 'HDR']].forEach(function (r) {
                h += fxSlider(r[1], 'fx:' + r[0], 0, 100, r[0] === 'flicker' ? 1 : 5, ui.getFxPercent(r[0]), '%');
            });
            h += fxSlider('SCAN SIZE', 'fx:scanSize', 25, 400, 5, ui.getFxPercent('scanSize'), '%');
            h += fxSlider('SCAN SPEED', 'fx:scanSpeed', 0, 300, 5, ui.getFxPercent('scanSpeed'), '%');
            h += fxSlider('SCAN WARP', 'fx:scanWarp', 0, 100, 5, ui.getFxPercent('scanWarp'), '%');
            h += fxSlider('VINE MOTION', 'fx:vineMotion', 0, 300, 10, ui.getFxPercent('vineMotion'), '%');
            h += fxSlider('FX SCALE', 'fx:fxScale', 25, 400, 5, ui.getFxPercent('fxScale'), '%');
            h += '<div class="vf-fx-row"><span>SEL. PULSE</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.arcade, 'fx-arcade') + '</div>';
            (function () {
                const frame = document.getElementById('vf-bezel');
                const cur = vfs.editFaction || (frame && frame.getAttribute('data-faction')) || 'terran';
                const st = vfs.frameStyles[cur] || {};
                h += '<div class="vf-fx-title">FRAME · ' + cur.toUpperCase() + '</div>' +
                    fxSlider('BEVEL', 'fr:bevel', 0, 14, 1, st.bevel != null ? st.bevel : 5, '') +
                    fxSlider('DECO', 'fr:deco', 0, 100, 10, st.deco != null ? st.deco : 100, '%');
                if (cur === 'voidborn') {
                    h += fxSlider('BEZEL FILL', 'fr:bgCrop', 0, 100, 5, st.bgCrop != null ? st.bgCrop : 50, '%') +
                        fxSlider('VINE INSET', 'fr:vineInset', 0, 8, 1, st.vineInset != null ? st.vineInset : 2, '');
                }
            })();
        } else if (vfs.fxTab === 'look') {
            const look = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getGlobalLook) ? colorPaletteSystem.getGlobalLook() : { brightness: 50, contrast: 68, saturation: 100 };
            const secondBase = (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getSecondBaseColor) ? colorPaletteSystem.getSecondBaseColor() : '#FFFFFF';
            h += '<div class="vf-fx-title">LOOK</div>' +
                '<div class="vf-fx-row"><span>2ND BASE</span><span class="vf-fx-swatch" style="display:inline-block;width:16px;height:16px;border:1px solid #fff4;vertical-align:middle;background:' + secondBase + '"></span>' + fxSeg([['prev', '‹'], ['next', '›']], '', 'lk-base') + '</div>' +
                fxSlider('BRIGHTNESS', 'lk:brightness', 0, 200, 5, Math.round(look.brightness), '%') +
                fxSlider('CONTRAST', 'lk:contrast', 0, 200, 5, Math.round(look.contrast), '%') +
                fxSlider('SATURATION', 'lk:saturation', 0, 200, 5, Math.round(look.saturation), '%') +
                '<div class="vf-fx-row"><span>GRAYSCALE</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], Math.round(look.saturation) === 0 ? 'ON' : 'OFF', 'lk-gray') + '</div>' +
                '<div class="vf-fx-title">FRAME CHROME</div>' +
                '<div class="vf-fx-row"><span>LINE WEIGHT</span>' + fxSeg(ui.getBorderWeightOptions().map(function (v) { return [v, v]; }), ui.borderWeight, 'lk-border') + '</div>' +
                '<div class="vf-fx-row"><span>INDICATOR</span>' + fxSeg(ui.getIndicatorWeightOptions().map(function (v) { return [v, v]; }), ui.indicatorWeight, 'lk-indicator') + '</div>';
        } else if (vfs.fxTab === 'voxel') {
            h += '<div class="vf-fx-title">SHIPS</div>' +
                '<div class="vf-fx-row"><span>SHIP RENDER</span>' + fxSeg(ui.getShipRenderStyleOptions().map(function (v) { return [v, v]; }), ui.shipRenderStyle, 'vx-ship') + '</div>' +
                '<div class="vf-fx-title">GUI</div>' +
                '<div class="vf-fx-row"><span>GUI VOXEL</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.guiVoxel, 'vx-gui') + '</div>';
            h += '<div class="vf-fx-title">GUI PARTS</div><div class="vf-fx-grid">';
            [['gvLines', 'LINES'], ['gvCorners', 'CORNERS'], ['gvText', 'TEXT'], ['gvImages', 'IMAGES'], ['gvSvg', 'SVG']].forEach(function (p) {
                const on = ui.getFxValue(p[0]) === 'ON';
                h += '<button type="button" class="vf-fx-key' + (on ? ' on' : '') + '" data-vx-gv="' + p[0] + ':' + (on ? 'OFF' : 'ON') + '">' + p[1] + '</button>';
            });
            h += '</div>';
        } else if (vfs.fxTab === 'voxelpixel') {
            h += '<div class="vf-fx-title">VOXEL &amp; PIXEL SIZE</div>' +
                fxOptSlider('VOXEL SIZE', 'vxsize', ui.getVoxelSizeOptions(), ui.voxelSize) +
                fxOptSlider('PIXEL SIZE', 'pxsize', ui.getFxOptions('pixelSize'), ui.getFxValue('pixelSize')) +
                '<div class="vf-fx-title">FRAME OUTSIDE THE SCREEN</div>' +
                fxOptSlider('FRAME PIXEL', 'framepx', ui.getFxOptions('framePx'), ui.getFxValue('framePx')) +
                fxOptSlider('FRAME ROUND', 'framerad', ui.getFxOptions('frameRound'), ui.getFxValue('frameRound')) +
                '<div class="vf-fx-title">GUI CELL SIZE</div>' +
                fxOptSlider('GUI CELL', 'gvcell', ui.getFxOptions('gvCell'), ui.getFxValue('gvCell'));
        } else if (vfs.fxTab === 'perf') {
            const mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
            const backdropOk = !!(window.CSS && CSS.supports && CSS.supports('backdrop-filter', 'blur(1px)'));
            h += '<div class="vf-fx-title">PRESET</div><div class="vf-fx-row">' +
                fxSeg([['LOW', 'LOW'], ['BALANCED', 'BALANCED'], ['HIGH', 'HIGH']], '', 'pf-preset') + '</div>' +
                '<div class="vf-fx-title">LIVE</div>' +
                '<div class="vf-fx-row"><span>FPS</span><output class="vf-fx-fps" data-pf-fps>--</output></div>' +
                '<div class="vf-fx-row"><span>FRAME</span><output class="vf-fx-fps" data-pf-framems>--</output></div>' +
                '<div class="vf-fx-row"><span>LOOP</span><output data-pf-loop>--</output></div>' +
                '<div class="vf-fx-row"><span>PLAYFIELD</span><output data-pf-backing>--</output></div>' +
                '<div class="vf-fx-row"><span>SCALE</span><output data-pf-scale>--</output></div>' +
                '<div class="vf-fx-row"><span>BACKING PX</span><output data-pf-px>--</output></div>' +
                '<div class="vf-fx-row"><span>GLOBAL PIXEL</span><output data-pf-gp>--</output></div>' +
                '<div class="vf-fx-row"><span>JS HEAP</span><output data-pf-heap>--</output></div>' +
                '<div class="vf-fx-row"><span>ENTITIES</span><output data-pf-entities>--</output></div>' +
                '<div class="vf-fx-row"><span>MAP PX FILTER</span><output data-pf-mapfilter>--</output></div>' +
                '<div class="vf-fx-title">EFFECTS</div>' +
                '<div class="vf-fx-row"><span>SWAY</span>' + fxSeg([['AUTO', 'AUTO'], ['ON', 'ON'], ['OFF', 'OFF']], perf.sway, 'pf-sway') + '</div>' +
                '<div class="vf-fx-row"><span>CHROMA/BLOOM/CRT</span>' + fxSeg([['ON', 'ON'], ['OFF', 'OFF']], perf.heavy, 'pf-heavy') + '</div>' +
                '<div class="vf-fx-row"><span>FX ANIMATION</span>' + fxSeg([['ON', 'ON'], ['OFF', 'OFF']], perf.anim, 'pf-anim') + '</div>' +
                '<div class="vf-fx-row"><span>FRAME PIXEL</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.framePx === 'OFF' ? 'OFF' : 'ON', 'pf-framepx') + '</div>' +
                '<div class="vf-fx-title">SYSTEM</div>' +
                '<div class="vf-fx-row"><span>OS REDUCE MOTION</span><output>' + (mq('(prefers-reduced-motion: reduce)') ? 'YES (AUTO = no sway)' : 'NO') + '</output></div>' +
                '<div class="vf-fx-row"><span>BACKDROP FILTER</span><output>' + (backdropOk ? 'SUPPORTED' : 'MISSING') + '</output></div>' +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-debug-action="perf">LOG / COPY PERF</button></div>';
            startPerfFps();
        } else if (vfs.fxTab === 'debug') {
            const storage = (() => {
                try { return Math.round(JSON.stringify(localStorage).length / 1024) + ' KB'; } catch (e) { return 'BLOCKED'; }
            })();
            const resources = performance.getEntriesByType('resource').filter((r) => r.name && /\.(?:js|css)(?:\?|$)/i.test(r.name));
            const loadedMs = (r) => Math.max(0, r.responseEnd - r.startTime);
            const areaOf = (r) => {
                if (/\/__bundle\//.test(r.name)) return 'BUNDLES';
                const m = new URL(r.name, location.href).pathname.match(/\/(core|game|graphics|ui|levels|abilities)(?:\/|$)/);
                return m ? m[1].toUpperCase() : 'OTHER';
            };
            const areas = {};
            resources.forEach((r) => {
                const key = areaOf(r);
                areas[key] = areas[key] || { count: 0, ms: 0, bytes: 0 };
                const bn = /\/__bundle\/b(\d+)-/.exec(r.name);   // a bundle stands for N script files
                areas[key].count += bn ? Number(bn[1]) : 1;
                areas[key].ms += loadedMs(r);
                areas[key].bytes += r.transferSize || 0;
            });
            const areaRows = Object.keys(areas).sort().map((key) => {
                const a = areas[key];
                return '<div class="vf-fx-row"><span>' + key + ' · ' + a.count + ' FILES</span><output>' +
                    a.ms.toFixed(0) + ' MS · ' + Math.round(a.bytes / 1024) + ' KB</output></div>';
            }).join('');
            const heavy = resources.slice().sort((a, b) => loadedMs(b) - loadedMs(a)).slice(0, 5).map((r) => {
                const name = new URL(r.name, location.href).pathname.split('/').pop();
                return '<div class="vf-debug-script"><span title="' + r.name + '">' + name + '</span><output>' +
                    loadedMs(r).toFixed(0) + ' MS · ' + Math.round((r.transferSize || 0) / 1024) + ' KB</output></div>';
            }).join('');
            h += '<div class="vf-fx-title">LIVE PERFORMANCE</div>' +
                '<div class="vf-fx-row"><span>FPS</span><output class="vf-fx-fps" data-debug-fps>--</output></div>' +
                '<div class="vf-fx-row"><span>FRAME</span><output class="vf-fx-fps" data-debug-framems>--</output></div>' +
                '<div class="vf-fx-row"><span>LOOP</span><output data-debug-loop>--</output></div>' +
                '<div class="vf-fx-row"><span>PLAYFIELD</span><output data-debug-backing>--</output></div>' +
                '<div class="vf-fx-row"><span>SCALE</span><output data-debug-scale>--</output></div>' +
                '<div class="vf-fx-row"><span>BACKING PX</span><output data-debug-px>--</output></div>' +
                '<div class="vf-fx-row"><span>GLOBAL PIXEL</span><output data-debug-gp>--</output></div>' +
                '<div class="vf-fx-row"><span>JS HEAP</span><output data-debug-heap>--</output></div>' +
                '<div class="vf-fx-row"><span>ENTITIES</span><output data-debug-entities>--</output></div>' +
                '<div class="vf-fx-row"><span>MAP PX FILTER</span><output data-debug-mapfilter>--</output></div>' +
                '<div class="vf-fx-row"><span>TAB HIDDEN</span><output data-debug-hidden>--</output></div>' +
                '<div class="vf-fx-title">MACHINE</div>' +
                '<div class="vf-fx-row"><span>VIEWPORT</span><output>' + innerWidth + ' × ' + innerHeight + '</output></div>' +
                '<div class="vf-fx-row"><span>DEVICE PIXEL RATIO</span><output data-debug-dpr>' + (window.devicePixelRatio || 1) + '</output></div>' +
                '<div class="vf-fx-row"><span>CPU CORES</span><output data-debug-cores>--</output></div>' +
                '<div class="vf-fx-row"><span>DEVICE MEMORY</span><output data-debug-devmem>--</output></div>' +
                '<div class="vf-fx-row"><span>PERF HEAVY</span><output data-debug-heavy>--</output></div>' +
                '<div class="vf-fx-row"><span>PERF ANIM</span><output data-debug-anim>--</output></div>' +
                '<div class="vf-fx-row"><span>PERF SWAY</span><output data-debug-sway>--</output></div>' +
                '<div class="vf-fx-row"><span>LOCAL STORAGE</span><output>' + storage + '</output></div>' +
                '<div class="vf-fx-title">LOADING BY AREA</div>' + (areaRows || '<div class="vf-fx-row"><output>NO RESOURCE DATA</output></div>') +
                '<div class="vf-fx-title">SLOWEST SCRIPTS</div>' + (heavy || '<div class="vf-fx-row"><output>NO SCRIPT DATA</output></div>') +
                '<div class="vf-fx-title">ACTIONS</div>' +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-debug-action="perf">LOG / COPY PERF</button></div>' +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-debug-action="reload">RELOAD GAME</button></div>' +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-debug-action="clear">CLEAR LOCAL SETTINGS</button></div>' +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-debug-action="console">LOG DEBUG INFO</button></div>';
            startDebugFps();
        } else if (vfs.fxTab === 'frame') {
            const frame = document.getElementById('vf-bezel');
            const cur = vfs.editFaction || (frame && frame.getAttribute('data-faction')) || 'terran';
            const st = vfs.frameStyles[cur] || {};
            const cs = frame ? getComputedStyle(frame) : null;
            h += '<div class="vf-fx-facs">' + FACTIONS.map(function (f) {
                    let col = '';
                    try { if (typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionColor) col = ' style="--faction-color:' + factionShipStyles.getFactionColor(f) + '"'; } catch (e) { /* default */ }
                    return '<button type="button" class="vf-fx-fac' + (cur === f ? ' on' : '') + '" data-faction="' + f + '" data-fx-fac="' + f + '"' + col + '>' + f.toUpperCase() + '</button>';
                }).join('') + '</div>' +
                '<div class="vf-fx-title vf-fx-title-row"><span>FRAME COLORS</span><button type="button" class="vf-fx-reset" data-fr-colors-reset="' + cur + '">RESET</button></div>' +
                (function () {
                    const defs = frameDefaults(cur);
                    return [['hull', 'HULL'], ['lit', 'LIT'], ['dark', 'DARK']].map(function (c) {
                        const adj = (st.adj && st.adj[c[0]]) || { h: hexToHsl(defs[c[0]])[0], s: 100, l: 0 };
                        const v = st[c[0]] || defs[c[0]];
                        const near = function (steps, x) { return steps.reduce(function (bi, y, i) { return Math.abs(y - x) < Math.abs(steps[bi] - x) ? i : bi; }, 0); };
                        const row = function (part, tag, min, max, val) {
                            return '<span class="hs-fd-slider-tag">' + tag + '</span><input type="range" class="hs-fd-adj hs-fd-adj-' + part + '" min="' + min + '" max="' + max +
                                '" step="1" value="' + val + '" data-frc="' + c[0] + ':' + part + '" aria-label="' + c[1] + ' ' + tag + '">';
                        };
                        return '<div class="vf-fr-color" data-frc-block="' + c[0] + '"><div class="hs-fd-color-row"><i class="hs-fd-color-chip" style="background:' + v + '"></i>' +
                            '<span class="hs-fd-color-label">' + c[1] + '</span><em>' + v.toUpperCase() + '</em></div><div class="vf-fr-sliders">' +
                            row('h', 'HUE', 0, 359, adj.h) + row('s', 'SAT', 0, 2, near(FR_SAT, adj.s)) + row('l', 'LIGHT', 0, 2, near(FR_LIGHT, adj.l)) + '</div></div>';
                    }).join('');
                })() +
                fleetColorsHtml(cur) +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-fr-reset="' + cur + '">RESET ' + cur.toUpperCase() + '</button></div>';
        } else if (vfs.fxTab === 'text') {
            h += '<div class="vf-fx-title">MAIN FONT</div><div class="vf-fx-row"><span>FAMILY</span>' +
                fxStepper(ui.getFontOptions().map(function (v) { return ['main:' + v, v]; }), 'main:' + ui.font, 'tx') + '</div>';
            // 3 sizes: LG (titles) / MD (values) / SM (labels) + in-game scale %
            [['h1', 'LG · TITLES'], ['h2', 'MD · VALUES'], ['small', 'SM · LABELS'], ['game', 'IN-GAME (HUD) · SIZE %']].forEach(function (t) {
                const famKey = t[0] === 'h2' ? 'h2' : t[0];
                h += '<div class="vf-fx-card"><div class="vf-fx-title">' + t[1] + '</div>' +
                    fxOptSlider('SIZE', 'fsize:' + t[0], ui.getFontSizeOptions(t[0]), ui.fontSizes[t[0]]) +
                    (t[0] === 'game' ? '' : '<div class="vf-fx-row"><span>FONT</span>' + fxStepper(ui.getFontFamilyOptions().map(function (v) { return ['fam:' + famKey + ':' + v, v]; }), 'fam:' + famKey + ':' + ui.fontFamilies[famKey], 'tx') + '</div>') +
                    '</div>';
            });
            h += '<div class="vf-fx-title">PREVIEW</div><div class="vf-fx-preview"><div class="type-lg">LG TITLE</div><div class="type-md">MD VALUES 100</div><div class="type-sm">SM LABELS</div></div>';
        } else if (vfs.fxTab === 'difficulty') {
            const dm = typeof difficultyConfigManager !== 'undefined' ? difficultyConfigManager : null;
            if (!dm) { h += '<div class="vf-fx-row"><output>DIFFICULTY NOT LOADED</output></div>'; }
            else {
                const prof = dm.getProfile();
                h += '<div class="vf-fx-title">PRESET</div><div class="vf-fx-row">' +
                    fxSeg([['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']], dm.current, 'df-preset') + '</div>';
                h += '<div class="vf-fx-title">SPEED</div>' +
                    fxSlider('PLAYER SHIP', 'df:playerSpeedMul', 0.2, 3, 0.05, Math.round((prof.playerSpeedMul || 1) * 100) / 100, '×') +
                    fxSlider('PLAYER SHOTS', 'ss:player', 20, 300, 5, ui.getShotSpeedPct('player'), '%') +
                    fxSlider('ENEMY SHIPS', 'df:enemySpeedMul', 0.2, 3, 0.05, Math.round((prof.enemySpeedMul == null ? 1 : prof.enemySpeedMul) * 100) / 100, '×') +
                    fxSlider('ENEMY SHOTS', 'ss:enemy', 20, 300, 5, ui.getShotSpeedPct('enemy'), '%') +
                    fxSlider('BOSS SHOTS', 'ss:boss', 20, 300, 5, ui.getShotSpeedPct('boss'), '%');
                [['GLOBAL', [['enemyDamageMul', 'ENEMY DMG'], ['playerDamageMul', 'PLAYER DMG'], ['enemyHealthMul', 'ENEMY HP'], ['enemyCountMul', 'ENEMY COUNT'], ['evasionMul', 'EVASION'], ['predictionMul', 'AIMING'], ['obstacleSpawnMul', 'OBSTACLES']]],
                    ['CHAMPION', [['championDamageMul', 'DAMAGE'], ['championHealthMul', 'HEALTH'], ['championSpeedMul', 'SPEED'], ['championEvasionMul', 'EVASION']]],
                    ['SIDE ENEMIES', [['sideDamageMul', 'DAMAGE'], ['sideHealthMul', 'HEALTH'], ['sideSpeedMul', 'SPEED'], ['sideCountMul', 'COUNT']]],
                    ['BOSS', [['bossDamageMul', 'DAMAGE'], ['bossHealthMul', 'HEALTH'], ['bossSpeedMul', 'SPEED'], ['bossAttackRateMul', 'ATTACK RATE']]]].forEach(function (g) {
                    h += '<div class="vf-fx-title">' + g[0] + '</div>';
                    g[1].forEach(function (r) {
                        const v = Math.round((prof[r[0]] == null ? 1 : prof[r[0]]) * 100) / 100;
                        h += fxSlider(r[1], 'df:' + r[0], 0.2, 3, 0.05, v, '×');
                    });
                });
                h += '<div class="vf-fx-title">LIMITS</div>' + fxSlider('MAX ACTIVE', 'df:enemyMaxActive', 1, 10, 1, prof.enemyMaxActive == null ? 3 : prof.enemyMaxActive, '');
                h += '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-df-reset="1">RESET ' + dm.current.toUpperCase() + '</button></div>';
            }
        } else if (vfs.fxTab === 'sizes') {
            h += '<div class="vf-fx-title">SHIPS (PX)</div>' + fxSlider('PLAYER', 'sz:player:player', 6, 60, 1, Math.round(ui.getSizePx('player')), 'px');
            ['scout', 'assault', 'heavy', 'elite', 'capital'].forEach(function (c) {
                h += fxSlider(c.toUpperCase(), 'sz:enemy:' + c, 12, 200, 1, Math.round(ui.getSizePx('enemy', c)), 'px');
            });
            h += '<div class="vf-fx-title">BOSS / SIDE CRAFT (% OF CLASS SIZE)</div>' +
                fxSlider('BOSS', 'sp:boss', 30, 150, 5, ui.getSizePct('boss'), '%') +
                fxSlider('SIDE CRAFT', 'sp:side', 30, 150, 5, ui.getSizePct('side'), '%');
            h += '<div class="vf-fx-title">SHOTS (PX)</div>';
            ['player', 'enemy', 'boss'].forEach(function (c) {
                h += fxSlider(c.toUpperCase(), 'sz:shot:' + c, 1, 40, 1, Math.round(ui.getSizePx('shot', c)), 'px');
            });
            h += '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-sz-copy="1">COPY SIZES (JSON)</button></div>';
        } else if (vfs.fxTab === 'audio') {
            const vol = (typeof volumeControlsManager !== 'undefined') ? volumeControlsManager : null;
            const sm = (typeof soundManager !== 'undefined') ? soundManager : null;
            const settings = (typeof game !== 'undefined' && game && game.settingsManager) ? game.settingsManager.settings
                : (typeof settingsManager !== 'undefined' && settingsManager ? settingsManager.settings : null);
            const masterPct = vol ? Math.round(vol.getMasterVolume() * 100) : 10;
            const soundPct = vol ? Math.round(vol.getSoundVolume() * 100) : 50;
            const musicPct = vol ? Math.round(vol.getMusicVolume() * 100) : 65;
            const musicBpm = vol && vol.getMusicBpm
                ? Math.round(vol.getMusicBpm())
                : (vol && vol.getMusicSpeed ? Math.round(vol.getMusicSpeed() * 132) : 132);
            const jungleAmt = vol && vol.getJungleAmount ? Number(vol.getJungleAmount()) : 0;
            const junglePct = Math.round(Math.max(0, Math.min(1, Math.abs(jungleAmt) || 0)) * 100);
            const jungleLabel = junglePct === 0 ? 'OFF' : junglePct + '%';
            const themeMax = (typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.count)
                ? VFTrackerThemes.count() - 1
                : 6;
            const themeIdx = vol && vol.getMusicTheme != null
                ? Math.max(0, Math.min(themeMax, Math.round(vol.getMusicTheme())))
                : 0;
            const voiceOf = function (i) {
                return vol && vol.getChannelVoice ? vol.getChannelVoice(i) : 'default';
            };
            const chVolOf = function (i) {
                const v = vol && vol.getChannelVolume ? vol.getChannelVolume(i) : 1;
                return Math.round(Math.max(0, Math.min(3, Number(v) || 1)) * 100);
            };
            const xfade = (typeof vfTrackerManager !== 'undefined' && vfTrackerManager.crossfadeSeconds != null)
                ? Math.round(Number(vfTrackerManager.crossfadeSeconds) * 100) / 100
                : 1.4;
            const soundOn = settings ? !!settings.soundEnabled : (sm ? !!sm.getSoundEnabled() : true);
            const musicOn = settings ? !!settings.musicEnabled : (sm ? !!sm.getMusicEnabled() : true);
            const audioHtml = fxAudioSection('volume', 'VOLUME',
                fxSlider('MASTER', 'au:master', 0, 100, 1, masterPct, '%') +
                fxSlider('SOUNDS', 'au:sound', 0, 100, 1, soundPct, '%') +
                fxSlider('MUSIC', 'au:music', 0, 100, 1, musicPct, '%')) +
                fxAudioSection('voices', 'MUSIC VOICES',
                fxVoiceSelect('BASS', 0, voiceOf(0), chVolOf(0)) +
                fxVoiceSelect('LEAD', 1, voiceOf(1), chVolOf(1)) +
                fxVoiceSelect('ARP', 2, voiceOf(2), chVolOf(2)) +
                fxVoiceSelect('DRUMS', 3, voiceOf(3), chVolOf(3))) +
                fxAudioSection('playback', 'MUSIC PLAYBACK',
                fxSlider('MUSIC BPM', 'au:bpm', 60, 300, 1, musicBpm, '',
                    (vol && vol.formatMusicSpeed)
                        ? vol.formatMusicSpeed(musicBpm)
                        : (Math.round(musicBpm) + ' BPM'),
                    (vol && vol.getPreferredMusicBpm)
                        ? vol.getPreferredMusicBpm(themeIdx)
                        : ((typeof VFTrackerThemes !== 'undefined' && VFTrackerThemes.preferredBpmOf)
                            ? VFTrackerThemes.preferredBpmOf(themeIdx) : 132)) +
                fxStyleSelect(themeIdx, junglePct, jungleLabel) +
                fxSlider('CROSSFADE', 'au:xfade', 0.2, 3, 0.05, xfade, 's')) +
                fxAudioSection('toggles', 'TOGGLES',
                '<div class="vf-fx-row"><span>SOUND FX</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], soundOn ? 'ON' : 'OFF', 'au-sound') + '</div>' +
                '<div class="vf-fx-row"><span>MUSIC</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], musicOn ? 'ON' : 'OFF', 'au-music') + '</div>' +
                '<div class="vf-fx-row"><button type="button" class="vf-fx-reset" data-au-reset="1">RESET AUDIO</button></div>');
            if (wantEditor) {
                let paneCollapsed = false;
                try { paneCollapsed = localStorage.getItem('vf_fx_audio_settings_collapsed') === '1'; } catch (err) { /* ignore */ }
                vfs._fxAudioSettingsCollapsed = paneCollapsed;
                h += '<div class="vf-fx-audio-split' + (paneCollapsed ? ' is-settings-collapsed' : '')
                    + (wantSplit ? '' : ' is-stacked') + '">'
                    + '<div class="vf-fx-audio-settings">' + audioHtml + '</div>'
                    + '<div class="vf-fx-audio-resize" role="button" tabindex="0" aria-expanded="' + (!paneCollapsed) + '"'
                    + ' title="' + (paneCollapsed
                        ? 'Click to show audio settings'
                        : (wantSplit ? 'Drag to resize · click to collapse' : 'Click to collapse settings')) + '"></div>'
                    + '<div class="vf-fx-music-host" id="vf-fx-music-editor"></div>'
                    + '</div>';
            } else {
                h += audioHtml;
            }
        } else if (vfs.fxTab === 'tools') {
            const soundCode = (typeof startupSound !== 'undefined' && startupSound.toCode) ? startupSound.toCode() : '';
            const menuUrl = (typeof youtubeSoundtrackManager !== 'undefined' && youtubeSoundtrackManager.getMenuUrl) ? (youtubeSoundtrackManager.getMenuUrl() || '') : '';
            h += '<div class="vf-fx-title">AUDIO ASSETS</div>' +
                '<div class="vf-fx-row"><span>SOUND CODE</span><output>' + (soundCode || '—') + '</output></div>' +
                '<div class="vf-fx-row"><span>MENU SOUNDTRACK</span><output>' + (menuUrl || '—') + '</output></div>' +
                '<div class="vf-fx-row"><button type="button" data-tools-action="startupSound">STARTUP SOUND ›</button></div>' +
                (fxDevModeOn() ? '<div class="vf-fx-row"><button type="button" data-tools-action="soundtrackEditor">SOUNDTRACK EDITOR ›</button></div>' : '') +
                '<div class="vf-fx-title">EDITORS</div>' +
                (fxDevModeOn() ? '<div class="vf-fx-row"><button type="button" data-tools-action="faceEditor">FACE EDITOR · FLUX ›</button></div>' : '') +
                '<div class="vf-fx-row"><button type="button" data-tools-action="factionCommand">FACTION COMMAND ›</button></div>' +
                '<div class="vf-fx-row"><button type="button" data-tools-action="assetGen">ASSET GENERATOR ›</button></div>' +
                '<div class="vf-fx-row"><button type="button" data-tools-action="assetGenFaction">FACTION EMBLEMS ›</button></div>' +
                '<div class="vf-fx-row"><button type="button" data-tools-action="assetGenFactionShips">FACTION SHIPS ›</button></div>';
            if (fxDevModeOn()) {
                let ppBgv = 0, ppBga = 2;
                try {
                    const bv = parseInt(localStorage.getItem('vf_asset_gen_portrait_bgv_v1'), 10);
                    const ba = parseInt(localStorage.getItem('vf_asset_gen_portrait_bga_v1'), 10);
                    if (Number.isFinite(bv) && bv >= 0) ppBgv = bv % 32;
                    if (Number.isFinite(ba) && ba >= 0) ppBga = ba % 5;
                } catch (err) { /* ignore */ }
                if (typeof profileManager !== 'undefined' && profileManager.getActiveProfile) {
                    const p = profileManager.getActiveProfile();
                    if (p && p.portrait) {
                        if (p.portrait.bgv != null) ppBgv = ((p.portrait.bgv | 0) % 32 + 32) % 32;
                        if (p.portrait.bga != null) ppBga = ((p.portrait.bga | 0) % 5 + 5) % 5;
                    }
                }
                const bgaNames = (typeof heroPortrait !== 'undefined' && heroPortrait.NAMES && heroPortrait.NAMES.bga)
                    ? heroPortrait.NAMES.bga
                    : ['OFF', 'SLOW', 'NORMAL', 'FAST', 'TURBO'];
                h += '<div class="vf-fx-title">PILOT PORTRAIT</div>' +
                    fxSlider('BACKDROP', 'pp:bgv', 0, 31, 1, ppBgv, '',
                        String(ppBgv + 1).padStart(2, '0') + ' / 32') +
                    fxSlider('ANIMATION', 'pp:bga', 0, 4, 1, ppBga, '',
                        bgaNames[ppBga] || String(ppBga));
            }
        }
        h += '</div>';
        plate.innerHTML = h;
        const body = plate.querySelector('.vf-fx-body');
        restoreFxScroll();
        plate.insertAdjacentHTML('beforeend', '<div class="vf-fx-zoom" title="Scale"><input type="range" class="vf-fx-zoom-in" min="50" max="150" step="5" value="' + Math.round((vfs.fxZoom || 1) * 100) + '" aria-label="Remote scale"></div>' + ['nw', 'ne', 'sw', 'se'].map(function (c) { return '<i class="vf-fx-grip" data-corner="' + c + '" title="Resize" aria-hidden="true"></i>'; }).join(''));
        plate.insertAdjacentHTML('beforeend', '<button type="button" class="vf-fx-more vf-fx-more-up" aria-label="Scroll up" hidden></button><button type="button" class="vf-fx-more vf-fx-more-down" aria-label="Scroll down" hidden></button>');
        (function () {
            const up = plate.querySelector('.vf-fx-more-up'), down = plate.querySelector('.vf-fx-more-down');
            const sync = function () {
                const b = plate.querySelector('.vf-fx-body');
                if (!b) return;
                up.style.left = down.style.left = b.offsetLeft + 'px';
                up.style.width = down.style.width = b.offsetWidth + 'px';
                up.style.top = b.offsetTop + 'px';
                down.style.top = (b.offsetTop + b.offsetHeight - 22) + 'px';
                if (b.classList.contains('is-audio-split')) {
                    up.hidden = true;
                    down.hidden = true;
                    return;
                }
                up.hidden = !(b.scrollTop > 2);
                down.hidden = !(b.scrollTop + b.clientHeight < b.scrollHeight - 2);
            };
            const step = function (dir) { const b = plate.querySelector('.vf-fx-body'); if (b) b.scrollBy({ top: dir * b.clientHeight * 0.8, behavior: 'smooth' }); };
            up.addEventListener('click', function () { step(-1); });
            down.addEventListener('click', function () { step(1); });
            if (body) body.addEventListener('scroll', sync, { passive: true });
            requestAnimationFrame(sync);
            setTimeout(sync, 250);
            vfs.fxMoreSync = sync;
        })();
        applyFxGeom();
        mountFxMusicEditor();
        if (typeof NS.bindFxAudioSplitResize === 'function') NS.bindFxAudioSplitResize();
        } finally {
            vfs._fxFilling = false;
        }
    }
})(window.vfFitScope || (window.vfFitScope = {}));
