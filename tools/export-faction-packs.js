// Fills assets/factions/<faction>/ from the running game: faction.json (current style + palette), portraits/_reference/01..16.png (previews only: portraits/NN.png is hand-painted art that REPLACES the live animated portrait),
// ui/ emblems and ships/_reference previews. Existing non-template files are kept unless --force is given.
// usage: node tools/export-faction-packs.js [--force] [http://localhost:3000]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), force = process.argv.includes('--force');
const base = process.argv.find((a) => /^http/.test(a)) || 'http://localhost:3000';
const isEmpty = (f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return !j.style || !Object.keys(j.style).length; } catch (e) { return true; } };
(async () => {
    const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
    const p = await b.newPage();
    await p.goto(base + '/index.html'); await p.waitForTimeout(4000);
    const data = await p.evaluate(async () => {
        await factionPacks.ready;
        const th = themeContextManager, out = {};
        factionShipStyles.factions.forEach((f) => {
            const s = Object.assign({}, factionShipStyles.getDefaultFactionStyle(f));
            delete s.id; delete s.packKeys;
            s.styleStrength = factionShipStyles.styleStrength;
            const acc = th.normalizeHexColor(s.accent || s.hull);
            const shots = [];
            for (let v = 0; v < VXP.COUNT; v++) {
                const c = document.createElement('canvas'); c.width = VXP.W; c.height = VXP.H;
                const img = c.getContext('2d').createImageData(VXP.W, VXP.H);
                img.data.set(VXP.build(VXP.preset(f, v), s.accent, false)); c.getContext('2d').putImageData(img, 0, 0);
                shots.push(c.toDataURL('image/png').split(',')[1]);
            }
            out[f] = { json: { style: s, gui: { baseColor: acc, secondBaseColor: th.lightenHex(acc, 0.72), vars: {} } }, shots };
        });
        return out;
    });
    for (const f of Object.keys(data)) {
        const dir = path.join(root, 'assets', 'factions', f), jf = path.join(dir, 'faction.json');
        for (const d of ['portraits/_reference', 'ships/_reference', 'ui']) fs.mkdirSync(path.join(dir, d), { recursive: true });
        if (force || isEmpty(jf)) fs.writeFileSync(jf, JSON.stringify(data[f].json, null, 2) + '\n');
        data[f].shots.forEach((s, i) => { const pf = path.join(dir, 'portraits', '_reference', String(i + 1).padStart(2, '0') + '.png'); if (force || !fs.existsSync(pf)) fs.writeFileSync(pf, Buffer.from(s, 'base64')); });
        const live = path.join(root, 'assets', 'ui', 'readme-live');
        [['emblem-' + f, 'ui/emblem'], ['emblem-hi-' + f, 'ui/emblem-hi']].forEach(([src, dst]) => { if (fs.existsSync(path.join(live, src + '.png'))) fs.copyFileSync(path.join(live, src + '.png'), path.join(dir, dst + '.png')); });
        ['scout', 'assault', 'heavy', 'elite', 'capital'].forEach((c) => { const sp = path.join(live, `ship-${f}-${c}.png`); if (fs.existsSync(sp)) fs.copyFileSync(sp, path.join(dir, 'ships/_reference', c + '.png')); });
        const css = path.join(dir, 'gui.css');
        if (!fs.existsSync(css)) fs.writeFileSync(css, `/* GUI styles for ${f}. Scope every rule with html[data-faction="${f}"], e.g.\nhtml[data-faction="${f}"] .some-panel { border-color: #fff; } */\n`);
        console.log(f, 'ok');
    }
    await b.close();
})();
