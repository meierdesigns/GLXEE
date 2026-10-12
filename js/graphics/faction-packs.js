"use strict";

// Drop-in faction packs: everything a faction needs lives in assets/factions/<faction>/ —
//   faction.json        style (ship colours, silhouette, anatomy ...) and gui (baseColor/secondBaseColor of the app palette, CSS vars)
//   portraits.png       4x4 sheet of 16 portraits (or portraits/01.png .. 16.png)
//   ships/<class>.png   scout | assault | heavy | elite | capital (+ -front/-center/-back/-wingLeft/-wingRight/-wing segments)
//   gui.css             extra GUI CSS, scope it with html[data-faction="<faction>"]
//   ui/*                images, referenced from faction.json as "{pack}/ui/name.png"
// The file list comes from the dev server (/__factions) or from assets/factions/<faction>/manifest.json
// (tools/build-faction-manifests.py). See assets/factions/README.md.
const factionPacks = (() => {
    const BASE = 'assets/factions/';
    const SHIP_RE = /^ships\/((?:scout|assault|heavy|elite|capital)(?:-(?:front|center|back|wingLeft|wingRight|wing))?|(?:player|enemy)-[\w-]+)\.png$/;
    const files = {}, cfg = {};
    let resolve;
    const ready = new Promise((r) => { resolve = r; });

    const getJson = async (url) => { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const has = (f, name) => !!(files[f] && files[f].indexOf(name) >= 0);
    const url = (f, name) => BASE + f + '/' + name;
    const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

    async function listFiles() {
        // Manifests first (tools/build-faction-manifests.py): a plain static host then logs no 404 at all. Only without
        // any manifest does it ask the dev server (/__factions), which lists the folders live.
        const out = {}, ids = (typeof factionShipStyles !== 'undefined' && factionShipStyles.factions) || ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        await Promise.all(ids.map(async (f) => { const m = await getJson(BASE + f + '/manifest.json'); if (Array.isArray(m)) out[f] = m; }));
        if (Object.keys(out).length) return out;
        return (await getJson('/__factions')) || out;
    }
    function applyStyle(f, style) {
        if (typeof factionShipStyles === 'undefined' || !style || !factionShipStyles.styles[f]) return;
        const { styleStrength, ...rest } = style;
        Object.assign(factionShipStyles.styles[f], rest, { packKeys: Object.keys(rest) });
        if (Number.isFinite(styleStrength)) factionShipStyles.styleStrength = styleStrength;
    }
    function applyGui(f, gui) {
        if (!gui || !gui.vars) return;
        const body = Object.keys(gui.vars).map((k) => `${k}:${String(gui.vars[k]).replace(/\{pack\}/g, BASE + f)} !important;`).join('');
        const st = document.createElement('style');
        st.dataset.factionPack = f;
        st.textContent = `html[data-faction="${f}"]{${body}}`;
        document.head.appendChild(st);
    }
    async function loadFaction(f, list) {
        files[f] = list;
        if (has(f, 'faction.json')) cfg[f] = (await getJson(url(f, 'faction.json'))) || {};
        const c = cfg[f] || {};
        applyStyle(f, c.style);
        applyGui(f, c.gui);
        if (has(f, 'gui.css') && !document.querySelector('link[href^="' + url(f, 'gui.css') + '"]')) {  // index.html links them statically
            const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url(f, 'gui.css'); document.head.appendChild(l);
        }
        const ships = list.filter((n) => SHIP_RE.test(n));
        await Promise.all(ships.map(async (n) => {
            const stem = n.match(SHIP_RE)[1], key = /^(player|enemy)-/.test(stem) ? stem : 'enemy-' + f + '-' + stem;
            const im = await loadImg(url(f, n));
            if (im && typeof spriteLoader !== 'undefined') spriteLoader.sprites.set(key, im);
        }));
        return ships.length > 0 || !!c.style || !!c.gui;
    }
    async function init() {
        let restyle = false;
        try {
            const all = await listFiles();
            const res = await Promise.all(Object.keys(all).map((f) => loadFaction(f, all[f])));
            restyle = res.some(Boolean);
        } catch (e) { if (window.console) console.warn('[factionPacks]', e.message); }
        if (restyle && typeof factionShipStyles !== 'undefined') {                  // rebuild everything derived from the style tables
            factionShipStyles.pixelCache = Object.create(null);
            factionShipStyles.buildAllPixelSprites();
            if (factionShipStyles.invalidateColorCaches) factionShipStyles.invalidateColorCaches();
            if (factionShipStyles.applyDocumentFactionTheme) {                       // silent: no bezel cable swap on a plain reload
                factionShipStyles._cablesDone = true;
                try { factionShipStyles.applyDocumentFactionTheme(); } finally { factionShipStyles._cablesDone = false; }
            }
        }
        // Backdrops (menu, wizard, station tabs): decode them ahead of use so a screen or faction switch never paints the fallback
        // room while the faction PNG is still loading. The active faction (menu / wizard first) goes at once, the others one by
        // one while the browser is idle, so the start does not fight the scripts for bandwidth.
        const act = (window.vfGuiState && window.vfGuiState.id) || '';
        const rank = (src) => (src.indexOf('/' + act + '/') >= 0 ? 0 : 10) + (/bg-(menu|profiles)/.test(src) ? 0 : 1);
        const bgs = [];
        Object.keys(files).forEach((f) => files[f].forEach((n) => { if (/^ui\/bg-[\w-]+\.png$/.test(n)) bgs.push(url(f, n)); }));
        bgs.sort((a, b) => rank(a) - rank(b));
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 120));
        const warm = (src) => {
            const im = new Image(); im.src = src;
            (window.vfBgKeep = window.vfBgKeep || []).push(im);
            return im.decode ? im.decode().catch(() => {}) : Promise.resolve();
        };
        const warmNext = () => { const src = bgs.shift(); if (src) warm(src).then(() => idle(warmNext)); };
        while (bgs.length && rank(bgs[0]) < 10) warm(bgs.shift());
        idle(warmNext);
        resolve();
        document.dispatchEvent(new CustomEvent('vf-faction-packs-ready'));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    return { ready, has, url, config: (f) => cfg[f] || {}, files: (f) => (files[f] || []).slice() };
})();
