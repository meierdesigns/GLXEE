"use strict";

// Order of the Home Station tab rows. Reorder freely; moving an id between
// the lists moves it between the rows ('station' always stays in main).
//   main: the normal tab row
//   esc:  the row shown after pressing ESC
// Shift+C in the station (dev mode) lets you drag tabs to reorder them;
// that order is saved in the browser and overrides the lists below.
// '|' is a cluster divider (a line between tab groups) and can be moved like a tab.
// Available ids: play, travel, explorations, upgrade, hangar, components,
// craft, shop, profiles, settings, assets, credits
const MENU_ORDER = {
    main: [
        'station',
        'play',
        'travel',
        'explorations',
        '|',
        'upgrade',
        'hangar',
        'craft',
        '|',
        'shop'
    ],
    esc: [
        'profiles',
        'settings',
        'assets',
        'components',
        'credits'
    ]
};

const MENU_ORDER_STORAGE_KEY = 'vf.menuOrder';

(function loadSavedMenuOrder() {
    try {
        const saved = JSON.parse(localStorage.getItem(MENU_ORDER_STORAGE_KEY) || 'null');
        if (!saved || !Array.isArray(saved.main) || !Array.isArray(saved.esc)) return;
        // Ids added to the defaults later still show up at the end of their row.
        const known = saved.main.concat(saved.esc);
        const isNew = (id) => id !== '|' && known.indexOf(id) === -1;
        const main = saved.main.concat(MENU_ORDER.main.filter((id) => isNew(id) && id !== 'station'));
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
