"use strict";

// viewport-fit part 2b: the FX plate builders (split from viewport-fit-part2.js; shared scope: window.vfFitScope).
(function (NS) {
    const vfs = NS.vfs || (NS.vfs = {});
    const { FACTIONS, FR_LIGHT, FR_SAT, FXTAB_KEY, FX_TABS, FX_TAB_ICONS, applyFrameStyle, endPreviewFaction, frameAdjust, frameDefaults, getUi, hexToHsl, perf, saveFrameStyles, setPerf, setPreviewFaction } = NS; // from earlier parts
    const { restoreFxScroll, buildFxPlate, startDebugFps, applyFxGeom, startPerfFps } = NS; // from viewport-fit-part2.js (hoisted functions)
    Object.assign(NS, { fillFxPlate }); // function (hoisted)

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
    function fxSlider(label, key, min, max, step, value, unit, displayValue) {
        const shown = displayValue == null ? value : displayValue;
        return '<label class="vf-fx-row"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step +
            '" value="' + value + '" data-sl="' + key + '" data-unit="' + (unit || '') + '" style="--look-fill:' + ((value - min) / (max - min) * 100) + '%"><output>' +
            (key.indexOf('fx:') === 0 && +value === 0 ? 'OFF' : shown + (unit || '')) + '</output></label>';
    }
    // The slider edits the raw, un-scaled px stored in uiAppearanceManager; what actually
    // reaches the screen/collision box is that raw value times the level's playfield zoom
    // (game.contentScale, see resolve-enemy-hit-profile.js). Show that effective size so the
    // panel's numbers match what the player sees, instead of the un-scaled stored value.
    function effectivePx(rawPx) {
        const scale = (typeof game !== 'undefined' && game && game.contentScale) ? game.contentScale : 1;
        return Math.round(rawPx * scale);
    }
    function fxToggle(label, key, on) {
        return '<div class="vf-fx-row"><span>' + label + '</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], on, 'tg-' + key.replace(':', '-')) + '</div>';
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
        if (!ui) return;
        vfs.fxScrollLock = true;
        let h = '<div class="vf-fx-head"><span>VISUAL SETTINGS</span><button type="button" data-fx-close aria-label="Close">X</button></div>' +
            '<div class="vf-fx-tabs">' + FX_TABS.map(function (t) {
                return '<button type="button" data-fx-tab="' + t[0] + '" class="' + (vfs.fxTab === t[0] ? 'on' : '') + '" style="font-size:11px!important;line-height:1!important;letter-spacing:.05em!important;">' + (FX_TAB_ICONS[t[0]] || '') + '<span>' + t[1] + '</span></button>';
            }).join('') + '</div><div class="vf-fx-body">';
        if (vfs.fxTab === 'fx') {
            h += '<div class="vf-fx-row"><span>AREA</span>' + fxStepper([['SCREEN', 'INSIDE'], ['FRAME', 'OUTSIDE'], ['ALL', 'BOTH']], ui.fxArea, 'fx-area') + '</div>';
            [['glow', 'GLOW'], ['scanlines', 'SCANLINES'], ['crt', 'CRT'], ['chroma', 'CHROMA'], ['vignette', 'VIGNETTE'], ['noise', 'NOISE'], ['flicker', 'FLICKER'], ['bloom', 'BLOOM'], ['bloomSpread', 'B. SPREAD'], ['bloomThreshold', 'B. CUTOFF'], ['hdr', 'HDR']].forEach(function (r) {
                h += fxSlider(r[1], 'fx:' + r[0], 0, 100, r[0] === 'flicker' ? 1 : 5, ui.getFxPercent(r[0]), '%');
            });
            h += fxSlider('SCAN SIZE', 'fx:scanSize', 25, 400, 5, ui.getFxPercent('scanSize'), '%');
            h += fxSlider('SCAN SPEED', 'fx:scanSpeed', 0, 300, 5, ui.getFxPercent('scanSpeed'), '%');
            h += fxSlider('SCAN WARP', 'fx:scanWarp', 0, 100, 5, ui.getFxPercent('scanWarp'), '%');
            h += fxSlider('FX SCALE', 'fx:fxScale', 25, 400, 5, ui.getFxPercent('fxScale'), '%');
            h += '<div class="vf-fx-row"><span>SEL. PULSE</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.arcade, 'fx-arcade') + '</div>';
            (function () {
                const frame = document.getElementById('vf-bezel');
                const cur = vfs.editFaction || (frame && frame.getAttribute('data-faction')) || 'terran';
                const st = vfs.frameStyles[cur] || {};
                h += '<div class="vf-fx-title">FRAME · ' + cur.toUpperCase() + '</div>' +
                    fxSlider('BEVEL', 'fr:bevel', 0, 14, 1, st.bevel != null ? st.bevel : 5, '') +
                    fxSlider('DECO', 'fr:deco', 0, 100, 10, st.deco != null ? st.deco : 100, '%');
            })();
        } else if (vfs.fxTab === 'voxel') {
            h += '<div class="vf-fx-title">SHIPS &amp; PLAYFIELD</div>' +
                '<div class="vf-fx-row"><span>SHIP RENDER</span>' + fxSeg(ui.getShipRenderStyleOptions().map(function (v) { return [v, v]; }), ui.shipRenderStyle, 'vx-ship') + '</div>' +
                fxOptSlider('VOXEL SIZE', 'vxsize', ui.getVoxelSizeOptions(), ui.voxelSize) +
                '<div class="vf-fx-title">FRAME OUTSIDE THE SCREEN</div>' +
                fxOptSlider('FRAME PIXEL', 'framepx', ui.getFxOptions('framePx'), ui.getFxValue('framePx')) +
                fxOptSlider('FRAME ROUND', 'framerad', ui.getFxOptions('frameRound'), ui.getFxValue('frameRound')) +
                '<div class="vf-fx-title">GUI</div>' +
                '<div class="vf-fx-row"><span>GUI VOXEL</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.guiVoxel, 'vx-gui') + '</div>' +
                fxOptSlider('GUI CELL', 'gvcell', ui.getFxOptions('gvCell'), ui.getFxValue('gvCell'));
            h += '<div class="vf-fx-title">GUI PARTS</div><div class="vf-fx-grid">';
            [['gvLines', 'LINES'], ['gvCorners', 'CORNERS'], ['gvText', 'TEXT'], ['gvImages', 'IMAGES'], ['gvSvg', 'SVG']].forEach(function (p) {
                const on = ui.getFxValue(p[0]) === 'ON';
                h += '<button type="button" class="vf-fx-key' + (on ? ' on' : '') + '" data-vx-gv="' + p[0] + ':' + (on ? 'OFF' : 'ON') + '">' + p[1] + '</button>';
            });
            h += '</div>';
        } else if (vfs.fxTab === 'perf') {
            const mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
            const backdropOk = !!(window.CSS && CSS.supports && CSS.supports('backdrop-filter', 'blur(1px)'));
            h += '<div class="vf-fx-title">PRESET</div><div class="vf-fx-row">' +
                fxSeg([['LOW', 'LOW'], ['BALANCED', 'BALANCED'], ['HIGH', 'HIGH']], '', 'pf-preset') + '</div>' +
                '<div class="vf-fx-title">LIVE</div><div class="vf-fx-row"><span>FPS</span><output class="vf-fx-fps" data-pf-fps>--</output></div>' +
                '<div class="vf-fx-title">EFFECTS</div>' +
                '<div class="vf-fx-row"><span>SWAY</span>' + fxSeg([['AUTO', 'AUTO'], ['ON', 'ON'], ['OFF', 'OFF']], perf.sway, 'pf-sway') + '</div>' +
                '<div class="vf-fx-row"><span>CHROMA/BLOOM/CRT</span>' + fxSeg([['ON', 'ON'], ['OFF', 'OFF']], perf.heavy, 'pf-heavy') + '</div>' +
                '<div class="vf-fx-row"><span>FX ANIMATION</span>' + fxSeg([['ON', 'ON'], ['OFF', 'OFF']], perf.anim, 'pf-anim') + '</div>' +
                '<div class="vf-fx-row"><span>FRAME PIXEL</span>' + fxSeg([['OFF', 'OFF'], ['ON', 'ON']], ui.framePx === 'OFF' ? 'OFF' : 'ON', 'pf-framepx') + '</div>' +
                '<div class="vf-fx-title">SYSTEM</div>' +
                '<div class="vf-fx-row"><span>OS REDUCE MOTION</span><output>' + (mq('(prefers-reduced-motion: reduce)') ? 'YES (AUTO = no sway)' : 'NO') + '</output></div>' +
                '<div class="vf-fx-row"><span>BACKDROP FILTER</span><output>' + (backdropOk ? 'SUPPORTED' : 'MISSING') + '</output></div>';
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
            h += '<div class="vf-fx-title">DIAGNOSTICS</div>' +
                '<div class="vf-fx-row"><span>FPS</span><output data-debug-fps>--</output></div>' +
                '<div class="vf-fx-row"><span>VIEWPORT</span><output>' + innerWidth + ' × ' + innerHeight + '</output></div>' +
                '<div class="vf-fx-row"><span>DEVICE PIXEL RATIO</span><output>' + (window.devicePixelRatio || 1) + '</output></div>' +
                '<div class="vf-fx-row"><span>LOCAL STORAGE</span><output>' + storage + '</output></div>' +
                '<div class="vf-fx-title">LOADING BY AREA</div>' + (areaRows || '<div class="vf-fx-row"><output>NO RESOURCE DATA</output></div>') +
                '<div class="vf-fx-title">SLOWEST SCRIPTS</div>' + (heavy || '<div class="vf-fx-row"><output>NO SCRIPT DATA</output></div>') +
                '<div class="vf-fx-title">ACTIONS</div>' +
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
        } else if (vfs.fxTab === 'sizes') {
            h += '<div class="vf-fx-title">VOXEL SIZES</div>' +
                fxOptSlider('PLAYFIELD', 'vxsize', ui.getVoxelSizeOptions(), ui.voxelSize) +
                fxOptSlider('GUI CELL', 'gvcell', ui.getFxOptions('gvCell'), ui.getFxValue('gvCell'));
            h += '<div class="vf-fx-title">SHIPS (PX)</div>' + fxSlider('PLAYER', 'sz:player:player', 6, 60, 1, Math.round(ui.getSizePx('player')), 'px', effectivePx(ui.getSizePx('player')));
            ['scout', 'assault', 'heavy', 'elite', 'capital'].forEach(function (c) {
                h += fxSlider(c.toUpperCase(), 'sz:enemy:' + c, 12, 200, 1, Math.round(ui.getSizePx('enemy', c)), 'px', effectivePx(ui.getSizePx('enemy', c)));
            });
            h += '<div class="vf-fx-title">SHOTS (PX)</div>';
            ['player', 'enemy', 'boss'].forEach(function (c) {
                h += fxSlider(c.toUpperCase(), 'sz:shot:' + c, 1, 40, 1, Math.round(ui.getSizePx('shot', c)), 'px', effectivePx(ui.getSizePx('shot', c)));
            });
        }
        h += '</div>';
        plate.innerHTML = h;
        const body = plate.querySelector('.vf-fx-body');
        restoreFxScroll();
        plate.insertAdjacentHTML('beforeend', '<i class="vf-fx-grip" title="Resize" aria-hidden="true"></i>');
        applyFxGeom();
    }
})(window.vfFitScope || (window.vfFitScope = {}));
