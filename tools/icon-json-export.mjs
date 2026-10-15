#!/usr/bin/env node
"use strict";
/**
 * Seed / refresh script: executes the game's built-in icon-sprite source files
 * (js/graphics/icon-sprites/*.js, same order as js/bundles/deferred.js) in a
 * sandboxed context, then dumps the resulting IconSprites grids as letters
 * into assets/meta/icons-data.json.
 *
 * That file is the live, editable source for every icon: js/graphics/icon-json-store.js
 * loads it at runtime, applies it over the built-in sprites, and the Components
 * editor's "ICONS" type (js/ui/component-editor/) edits and saves back into it
 * via iconJsonStore (through the asset-gen bridge). Only rerun this script if
 * you want to re-seed entries that aren't in icons-data.json yet — rerunning it
 * does NOT overwrite icons that already have an entry (their color/levels are
 * preserved), but it never deletes edited pixel grids either, so it's safe to
 * rerun after adding new built-in icons upstream.
 *
 * Run: node tools/icon-json-export.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPRITE_DIR = path.join(ROOT, "js/graphics/icon-sprites");
const OUT_FILE = path.join(ROOT, "assets/meta/icons-data.json");

// Same order js/bundles/deferred.js loads them in.
const ORDER = [
    "shots.js",
    "abilities-offense.js",
    "abilities-defense.js",
    "stats.js",
    "menu.js",
    "home-station-tabs.js",
    "home-station-panels.js",
    "emblems.js",
    "emblems-hires.js",
    "resources-hires.js",
    "ui-nav.js",
    "ui-nav-part2.js",
    "menu-hd.js",
    "kits.js"
];

const LETTERS = "abcdefghijklmno"; // index 0..14 -> gray level 1..15
const numberToLetter = (n) => (n === 0 ? "." : LETTERS[Math.max(1, Math.min(15, n)) - 1]);

function run() {
    const sandbox = { IconSprites: {}, window: {}, console };
    sandbox.window.IconSprites = sandbox.IconSprites;
    vm.createContext(sandbox);
    for (const file of ORDER) {
        const full = path.join(SPRITE_DIR, file);
        // "const IconSprites = {...}" declares a lexical binding, not a global-object
        // property, so the vm sandbox would never see it; drop the keyword so later
        // files' plain assignments/Object.assign calls all hit sandbox.IconSprites.
        const code = fs.readFileSync(full, "utf8").replace(/^(const|let)\s+IconSprites\s*=/m, "IconSprites =");
        vm.runInContext(code, sandbox, { filename: file });
    }

    let existing = {};
    if (fs.existsSync(OUT_FILE)) {
        try { existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf8")); } catch (e) { existing = {}; }
    }

    const out = {};
    const keys = Object.keys(sandbox.IconSprites).sort();
    for (const key of keys) {
        const grid = sandbox.IconSprites[key];
        if (!Array.isArray(grid) || !Array.isArray(grid[0])) continue; // skip non-grid aliases
        const prev = existing[key];
        if (prev && Array.isArray(prev.grid)) {
            // Already has an entry (possibly hand-edited via the Components editor) — keep it as-is.
            out[key] = prev;
            continue;
        }
        const rows = grid.map((row) => row.map(numberToLetter).join(""));
        out[key] = { color: null, levels: null, grid: rows };
    }

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
    console.log(`Wrote ${Object.keys(out).length} icons to ${path.relative(ROOT, OUT_FILE)}`);
}

run();
