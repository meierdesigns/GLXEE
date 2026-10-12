"use strict";

/**
 * Universe savegame: ALL galaxies (planets, maps, control, custom clusters /
 * patterns, faction standing) together with every pilot living in them, as
 * one JSON file. Download it, send it to someone, upload it to continue there.
 *
 *   universeSave.download()            // → glxee-universe-YYYY-MM-DD.json
 *   universeSave.upload()              // file picker → confirm → restore → reload
 *
 * Restoring writes the same localStorage keys the managers use and reloads the
 * page, so every manager starts clean from the loaded data.
 */
const UNIVERSE_FORMAT = 'glxee-universe';
const UNIVERSE_VERSION = 1;
// localStorage key → what it holds. Galaxies + their planets first, then the pilots.
const UNIVERSE_KEYS = [
    { key: 'vf_galaxies_v1', part: 'galaxies' },
    { key: 'vf_planet_configs_v1', part: 'planets' },
    { key: 'vf_custom_clusters_v1', part: 'clusters' },
    { key: 'vf_custom_patterns_v1', part: 'patterns' },
    { key: 'vf_faction_state_v1', part: 'factionState' },
    { key: 'vf_profiles_v1', part: 'players' }
];

const universeSave = {
    /** Everything that belongs to the universe, parsed, as one plain object. */
    collect() {
        const data = {};
        UNIVERSE_KEYS.forEach(({ key, part }) => {
            try {
                const raw = localStorage.getItem(key);
                if (raw != null) data[part] = JSON.parse(raw);
            } catch (e) { /* unreadable part: leave it out */ }
        });
        // Make sure the live state is what gets written, not a stale copy.
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.save) planetConfigManager.save();
        if (typeof profileManager !== 'undefined' && profileManager.save) profileManager.save();
        const fresh = {};
        UNIVERSE_KEYS.forEach(({ key, part }) => {
            try {
                const raw = localStorage.getItem(key);
                if (raw != null) fresh[part] = JSON.parse(raw);
            } catch (e) { if (data[part] !== undefined) fresh[part] = data[part]; }
        });
        return {
            format: UNIVERSE_FORMAT,
            version: UNIVERSE_VERSION,
            savedAt: new Date().toISOString(),
            summary: {
                galaxies: Object.keys(fresh.galaxies || {}).length,
                players: ((fresh.players && fresh.players.profiles) || []).map((p) => p.name)
            },
            data: fresh
        };
    },

    fileName() {
        return `glxee-universe-${new Date().toISOString().slice(0, 10)}.json`;
    },

    download() {
        const json = JSON.stringify(this.collect(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName();
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /** Parses + validates a universe file's text; returns the savegame or throws. */
    parse(text) {
        let doc;
        try { doc = JSON.parse(text); } catch (e) { throw new Error('This is not a JSON file.'); }
        if (!doc || doc.format !== UNIVERSE_FORMAT || !doc.data || typeof doc.data !== 'object') {
            throw new Error('This is not a GLXEE universe file.');
        }
        if (Number(doc.version) > UNIVERSE_VERSION) {
            throw new Error('This universe file is from a newer version of the game.');
        }
        if (!doc.data.galaxies || typeof doc.data.galaxies !== 'object') {
            throw new Error('The file contains no galaxies.');
        }
        return doc;
    },

    /** Writes the savegame into storage (replacing the current universe + pilots). */
    apply(doc) {
        UNIVERSE_KEYS.forEach(({ key, part }) => {
            if (doc.data[part] === undefined) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(doc.data[part]));
        });
        // Start clean on the start screen with the loaded pilots.
        try {
            sessionStorage.removeItem('vf_menu_state_v1');
            localStorage.removeItem('vf_start_menu_state_v1');
        } catch (e) { /* ignore */ }
    },

    /** Validates a picked / dropped file, asks for confirmation, restores and reloads. */
    async loadFile(file) {
        if (!file) return;
        try {
            const doc = this.parse(await file.text());
            const names = (doc.summary && doc.summary.players) || [];
            const msg = `Load universe "${file.name}"?\n` +
                `${Object.keys(doc.data.galaxies).length} galaxies, ` +
                `${names.length ? names.length + ' pilots (' + names.join(', ') + ')' : 'no pilots'}.\n` +
                'This REPLACES your current galaxies and pilots.';
            const ok = await uiDialog.confirm(msg, { title: 'LOAD UNIVERSE', okLabel: 'LOAD', danger: true });
            if (!ok) return;
            this.apply(doc);
            location.reload();
        } catch (err) {
            uiDialog.alert(String(err && err.message || err), { title: 'LOAD UNIVERSE' });
        }
    },

    /** File picker → loadFile. */
    upload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            input.remove();
            this.loadFile(file);
        });
        document.body.appendChild(input);
        input.click();
    }
};
window.universeSave = universeSave;
