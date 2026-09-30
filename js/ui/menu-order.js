"use strict";

// Order of the Home Station tab rows. Reorder freely; moving an id between
// the lists moves it between the rows ('station' always stays in main).
//   main: the normal tab row
//   esc:  the row shown after pressing ESC
// Shift+C in the station (dev mode) lets you drag tabs to reorder them;
// that order is saved in the browser and overrides the lists below.
// '|' is a cluster divider (a line between tab groups) and can be moved like a tab.
// Available ids: play, travel, explorations, upgrade, hangar, components,
// missions, craft, shop, factions, profiles, settings, assets, credits
const MENU_ORDER = {
    main: [
        'station',
        'play',
        'travel',
        'explorations',
        '|',
        'upgrade',
        'hangar',
        'missions',
        'craft',
        '|',
        'shop'
    ],
    esc: [
        'profiles',
        'settings',
        'layout',
        'assets',
        'components',
        'credits'
    ]
};

// Built-in menu row order (before any saved order replaces it), for RESET.
const MENU_ORDER_DEFAULT_ESC = MENU_ORDER.esc.slice();

// Coarse navigation areas of the top bar. Each area is one big button; the
// tabs of the active area show up next to it as small icon tabs.
// The first tab of an area is where a click on the area lands first.
const MENU_AREAS = [
    { id: 'station', label: 'HOME STATION', icon: 'hsStation', tabs: ['play', 'station', 'hangar'], defaultTab: 'station' },
    // defaultTab: where a click on the area lands (PLAY / the galaxy map is
    // only opened on purpose).
    { id: 'hangar', label: 'HANGAR', icon: 'hsHangar', tabs: ['upgrade', 'missions', 'craft', 'shop'], defaultTab: 'upgrade' },
    { id: 'factions', label: 'FACTIONS', icon: 'menuPeoples', tabs: ['factions', 'ffleet', 'ftrade', 'fcontracts'] },
    { id: 'explore', label: 'EXPLORATIONS', icon: 'hsExplore', tabs: ['travel', 'explorations'] }
];

const MENU_ORDER_STORAGE_KEY = 'vf.menuOrder';

(function loadSavedMenuOrder() {
    try {
        const saved = JSON.parse(localStorage.getItem(MENU_ORDER_STORAGE_KEY) || 'null');
        if (!saved || !Array.isArray(saved.main) || !Array.isArray(saved.esc)) return;
        // Ids added to the defaults later still show up at the end of their row.
        const known = saved.main.concat(saved.esc);
        const isNew = (id) => id !== '|' && known.indexOf(id) === -1;
        // The mission board belongs right before CRAFT, not at the row's end.
        const savedMain = saved.main.slice();
        if (known.indexOf('missions') === -1 && savedMain.indexOf('craft') !== -1) {
            savedMain.splice(savedMain.indexOf('craft'), 0, 'missions');
        }
        const main = savedMain.concat(MENU_ORDER.main.filter((id) => isNew(id) && id !== 'station' && savedMain.indexOf(id) === -1));
        // Home Station became movable later: older saves get it back at the front.
        if (main.indexOf('station') === -1) main.unshift('station');
        // Orders saved before dividers existed: put the default dividers back
        // after the same tab they follow in the defaults.
        if (main.indexOf('|') === -1) {
            MENU_ORDER.main.forEach((id, i) => {
                if (id !== '|' || i === 0) return;
                const at = main.indexOf(MENU_ORDER.main[i - 1]);
                if (at !== -1) main.splice(at + 1, 0, '|');
            });
        }
        MENU_ORDER.main = main;
        MENU_ORDER.esc = saved.esc.concat(MENU_ORDER.esc.filter(isNew)).filter((id) => id !== 'station');
    } catch (e) { /* ignore */ }
})();

function saveMenuOrder() {
    try {
        localStorage.setItem(MENU_ORDER_STORAGE_KEY, JSON.stringify(MENU_ORDER));
    } catch (e) { /* ignore */ }
}

// ---- Player-editable area layout (Menu → LAYOUT) ------------------------
// Saved as [{ id, tabs, defaultTab }] in the order of the areas; labels and
// icons always come from the defaults above. Tabs the save doesn't know
// (added later) go back into their default area.
const MENU_AREAS_STORAGE_KEY = 'vf.menuAreas';
const MENU_AREAS_DEFAULTS = MENU_AREAS.map((a) => Object.assign({}, a, { tabs: a.tabs.slice() }));

function applyMenuAreasLayout(layout) {
    if (!Array.isArray(layout) || !layout.length) return false;
    const byId = {};
    MENU_AREAS_DEFAULTS.forEach((a) => { byId[a.id] = a; });
    // Station tabs that may live in an area (COMPONENTS defaults to the menu).
    const allTabs = [].concat(...MENU_AREAS_DEFAULTS.map((a) => a.tabs)).concat(['components']);
    // Tabs moved into the menu row stay there (not re-added to an area).
    const seen = {};
    (MENU_ORDER.esc || []).forEach((t) => { seen[t] = true; });
    const next = [];
    layout.forEach((entry) => {
        const base = entry && byId[entry.id];
        if (!base || next.some((a) => a.id === base.id)) return;
        const tabs = (Array.isArray(entry.tabs) ? entry.tabs : []).filter((t) => allTabs.indexOf(t) !== -1 && !seen[t]);
        tabs.forEach((t) => { seen[t] = true; });
        next.push(Object.assign({}, base, { tabs: tabs, defaultTab: entry.defaultTab || base.defaultTab }));
    });
    MENU_AREAS_DEFAULTS.forEach((base) => {
        let area = next.find((a) => a.id === base.id);
        if (!area) { area = Object.assign({}, base, { tabs: [] }); next.push(area); }
        base.tabs.forEach((t) => { if (!seen[t]) { seen[t] = true; area.tabs.push(t); } });
    });
    next.forEach((a) => { if (a.tabs.indexOf(a.defaultTab) === -1) a.defaultTab = a.tabs[0]; });
    MENU_AREAS.length = 0;
    next.filter((a) => a.tabs.length).forEach((a) => MENU_AREAS.push(a));
    return true;
}

function saveMenuAreas() {
    try {
        localStorage.setItem(MENU_AREAS_STORAGE_KEY, JSON.stringify(
            MENU_AREAS.map((a) => ({ id: a.id, tabs: a.tabs.slice(), defaultTab: a.defaultTab || null }))));
    } catch (e) { /* ignore */ }
}

function resetMenuAreas() {
    try { localStorage.removeItem(MENU_AREAS_STORAGE_KEY); } catch (e) { /* ignore */ }
    // The menu row goes back to its built-in order too.
    MENU_ORDER.esc = MENU_ORDER_DEFAULT_ESC.slice();
    if (typeof saveMenuOrder === 'function') saveMenuOrder();
    MENU_AREAS.length = 0;
    MENU_AREAS_DEFAULTS.forEach((a) => MENU_AREAS.push(Object.assign({}, a, { tabs: a.tabs.slice() })));
}

(function loadSavedMenuAreas() {
    try {
        const saved = JSON.parse(localStorage.getItem(MENU_AREAS_STORAGE_KEY) || 'null');
        if (saved) applyMenuAreasLayout(saved);
    } catch (e) { /* ignore */ }
})();

// ---- Player-chosen tab / area icons (Menu → LAYOUT, click an icon) ------
// Keys: a tab id ('shop', 'settings', …) or 'area:<id>' for an area button.
const MENU_ICONS_STORAGE_KEY = 'vf.menuIcons';
let MENU_ICONS = {};
try { MENU_ICONS = JSON.parse(localStorage.getItem(MENU_ICONS_STORAGE_KEY) || '{}') || {}; } catch (e) { MENU_ICONS = {}; }

function getMenuIcon(key, fallback) {
    return MENU_ICONS[key] || fallback;
}

function setMenuIcon(key, icon) {
    if (icon) MENU_ICONS[key] = icon;
    else delete MENU_ICONS[key];
    try { localStorage.setItem(MENU_ICONS_STORAGE_KEY, JSON.stringify(MENU_ICONS)); } catch (e) { /* ignore */ }
}

function resetMenuIcons() {
    MENU_ICONS = {};
    try { localStorage.removeItem(MENU_ICONS_STORAGE_KEY); } catch (e) { /* ignore */ }
}

// ---- Player-chosen tab / area names (Menu → LAYOUT, pencil next to a name)
// Same keys as the icons: a tab id or 'area:<id>'.
const MENU_LABELS_STORAGE_KEY = 'vf.menuLabels';
let MENU_LABELS = {};
try { MENU_LABELS = JSON.parse(localStorage.getItem(MENU_LABELS_STORAGE_KEY) || '{}') || {}; } catch (e) { MENU_LABELS = {}; }

function getMenuLabel(key, fallback) {
    return MENU_LABELS[key] || fallback;
}

function setMenuLabel(key, label) {
    if (label) MENU_LABELS[key] = label;
    else delete MENU_LABELS[key];
    try { localStorage.setItem(MENU_LABELS_STORAGE_KEY, JSON.stringify(MENU_LABELS)); } catch (e) { /* ignore */ }
}

function resetMenuLabels() {
    MENU_LABELS = {};
    try { localStorage.removeItem(MENU_LABELS_STORAGE_KEY); } catch (e) { /* ignore */ }
}
