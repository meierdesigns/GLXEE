"use strict";

/**
 * Pixel-art mouse cursors in the game's style, used everywhere.
 *
 * Every CSS `cursor` keyword (stylesheet rules and inline `el.style.cursor`
 * set from JS) is rewritten to a generated 16×16 pixel sprite, drawn at 2×
 * in the active faction accent, with the original keyword as fallback.
 * Sprites are regenerated when the faction / theme on <html> changes.
 */
(function () {
    const SCALE = 2;
    const SIZE = 16;

    // '#' outline, 'o' highlight, 'a' faction accent, '.' transparent.
    const ART = {
        arrow: { hot: [1, 1], rows: [
            '#...............',
            '##..............',
            '#o#.............',
            '#oa#............',
            '#oaa#...........',
            '#oaaa#..........',
            '#oaaaa#.........',
            '#oaaaaa#........',
            '#oaaaaaa#.......',
            '#oaaaaaaa#......',
            '#oaaa#####......',
            '#oa#oa#.........',
            '#o#.#oa#........',
            '##...#oa#.......',
            '#.....##........',
            '................'] },
        hand: { hot: [5, 1], rows: [
            '....##..........',
            '...#oa#.........',
            '...#oa#.........',
            '...#oa#.........',
            '...#oa###.......',
            '...#oa#oa###....',
            '.###oa#oa#oa##..',
            '#oa#oa#oa#oa#a#.',
            '#oaaoaaaaaaaaa#.',
            '.#oaaaaaaaaaaa#.',
            '.#oaaaaaaaaaaa#.',
            '..#oaaaaaaaaa#..',
            '..#oaaaaaaaaa#..',
            '...#oaaaaaaa#...',
            '...##########...',
            '................'] },
        grab: { hot: [8, 8], rows: [
            '................',
            '......##.##.....',
            '...##.oa#oa##...',
            '..#oa#oa#oa#a#..',
            '..#oa#oa#oa#a#..',
            '..#oa#oa#oa#a#..',
            '.##oaaaaaaaaa#..',
            '#oa#aaaaaaaaa#..',
            '#oaaaaaaaaaaa#..',
            '.#oaaaaaaaaaa#..',
            '..#oaaaaaaaa#...',
            '..#oaaaaaaaa#...',
            '...#oaaaaaa#....',
            '...#########....',
            '................',
            '................'] },
        grabbing: { hot: [8, 8], rows: [
            '................',
            '................',
            '................',
            '................',
            '....##.##.##....',
            '...#oa#oa#oa##..',
            '..##oaaaaaaaa#..',
            '.#oa#aaaaaaaa#..',
            '.#oaaaaaaaaaa#..',
            '..#oaaaaaaaaa#..',
            '..#oaaaaaaaa#...',
            '...#oaaaaaaa#...',
            '...#oaaaaaa#....',
            '...#########....',
            '................',
            '................'] }
    };

    /** Blank 16×16 grid of '.'. */
    const blank = () => Array.from({ length: SIZE }, () => new Array(SIZE).fill('.'));
    const put = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y][x] = c; };
    /** Thick accent stroke with a dark 1px outline around it. */
    const stroke = (g, pts) => {
        pts.forEach(([x, y]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy] && g[y + dy][x + dx] === '.') put(g, x + dx, y + dy, '#'); });
        pts.forEach(([x, y]) => put(g, x, y, 'a'));
    };
    const line = (x0, y0, x1, y1) => {
        const pts = [];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)]);
        return pts;
    };
    const rows = (g) => g.map((r) => r.join(''));

    /** Double-headed arrow along direction (dx, dy) through the centre. */
    const doubleArrow = (dx, dy) => {
        const g = blank();
        const c = 7;
        const r = 6;
        const pts = line(c - dx * r, c - dy * r, c + dx * r, c + dy * r);
        // Arrow heads: two short barbs at each end, perpendicular-ish.
        [[1], [-1]].forEach(([s]) => {
            const ex = c + dx * r * s;
            const ey = c + dy * r * s;
            const bx = -dx * s;
            const by = -dy * s;
            // perpendicular
            const px = -by;
            const py = bx;
            for (let i = 1; i <= 3; i++) {
                pts.push([ex + bx * i + px * i, ey + by * i + py * i]);
                pts.push([ex + bx * i - px * i, ey + by * i - py * i]);
            }
        });
        stroke(g, pts);
        return { hot: [c, c], rows: rows(g) };
    };

    const generated = {
        blocked: (() => {
            const g = blank();
            const pts = [];
            for (let a = 0; a < 64; a++) {
                const t = a / 64 * Math.PI * 2;
                pts.push([Math.round(7 + Math.cos(t) * 5), Math.round(7 + Math.sin(t) * 5)]);
            }
            stroke(g, pts.concat(line(4, 4, 10, 10)));
            return { hot: [7, 7], rows: rows(g) };
        })(),
        crosshair: (() => {
            const g = blank();
            stroke(g, line(7, 1, 7, 5).concat(line(7, 9, 7, 13), line(1, 7, 5, 7), line(9, 7, 13, 7)));
            put(g, 7, 7, 'o');
            return { hot: [7, 7], rows: rows(g) };
        })(),
        text: (() => {
            const g = blank();
            stroke(g, line(7, 2, 7, 12).concat(line(5, 2, 9, 2), line(5, 12, 9, 12)));
            return { hot: [7, 7], rows: rows(g) };
        })(),
        move: (() => {
            const h = doubleArrow(1, 0).rows.map((r) => r.split(''));
            const v = doubleArrow(0, 1).rows.map((r) => r.split(''));
            const g = h.map((r, y) => r.map((c, x) => (c === 'a' || v[y][x] === 'a') ? 'a' : ((c === '#' || v[y][x] === '#') ? '#' : '.')));
            return { hot: [7, 7], rows: rows(g) };
        })(),
        ew: doubleArrow(1, 0),
        ns: doubleArrow(0, 1),
        nwse: doubleArrow(1, 1),
        nesw: doubleArrow(1, -1),
        zoom: (sign) => {
            const g = blank();
            const pts = [];
            for (let a = 0; a < 48; a++) {
                const t = a / 48 * Math.PI * 2;
                pts.push([Math.round(6 + Math.cos(t) * 4), Math.round(6 + Math.sin(t) * 4)]);
            }
            stroke(g, pts.concat(line(10, 10, 13, 13)));
            put(g, 5, 6, 'o'); put(g, 6, 6, 'o'); put(g, 7, 6, 'o');
            if (sign > 0) { put(g, 6, 5, 'o'); put(g, 6, 7, 'o'); }
            return { hot: [6, 6], rows: rows(g) };
        }
    };

    // CSS keyword → sprite. Keywords not listed keep the system cursor.
    const KEYWORDS = {
        default: () => ART.arrow, auto: () => ART.arrow, help: () => ART.arrow,
        'context-menu': () => ART.arrow, progress: () => ART.arrow,
        pointer: () => ART.hand,
        grab: () => ART.grab, grabbing: () => ART.grabbing,
        'not-allowed': () => generated.blocked, 'no-drop': () => generated.blocked,
        crosshair: () => generated.crosshair, cell: () => generated.crosshair,
        text: () => generated.text, 'vertical-text': () => generated.text,
        move: () => generated.move, 'all-scroll': () => generated.move,
        'ew-resize': () => generated.ew, 'col-resize': () => generated.ew,
        'e-resize': () => generated.ew, 'w-resize': () => generated.ew,
        'ns-resize': () => generated.ns, 'row-resize': () => generated.ns,
        'n-resize': () => generated.ns, 's-resize': () => generated.ns,
        'nwse-resize': () => generated.nwse, 'nw-resize': () => generated.nwse, 'se-resize': () => generated.nwse,
        'nesw-resize': () => generated.nesw, 'ne-resize': () => generated.nesw, 'sw-resize': () => generated.nesw,
        'zoom-in': () => generated.zoom(1), 'zoom-out': () => generated.zoom(-1)
    };

    let values = {};

    const readAccent = () => {
        const css = getComputedStyle(document.documentElement);
        const v = (css.getPropertyValue('--faction-accent') || css.getPropertyValue('--color-primary') || '').trim();
        return v || '#ff7a3c';
    };

    const renderSprite = (sprite, accent) => {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE * SCALE;
        canvas.height = SIZE * SCALE;
        const ctx = canvas.getContext('2d');
        const colors = { '#': '#0a0a10', o: '#ffffff', a: accent };
        sprite.rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const c = colors[row[x]];
                if (!c) continue;
                ctx.fillStyle = c;
                ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
            }
        });
        return canvas.toDataURL('image/png');
    };

    let builtAccent = null;
    const buildValues = () => {
        const accent = readAccent();
        builtAccent = accent;
        const cache = new Map();
        values = {};
        Object.keys(KEYWORDS).forEach((kw) => {
            const sprite = KEYWORDS[kw]();
            if (!cache.has(sprite)) cache.set(sprite, renderSprite(sprite, accent));
            values[kw] = `url(${cache.get(sprite)}) ${sprite.hot[0] * SCALE} ${sprite.hot[1] * SCALE}, ${kw}`;
        });
    };

    /** Themed cursor value for a keyword, or the input unchanged. */
    const themed = (value) => {
        const kw = String(value || '').trim().toLowerCase();
        return values[kw] || value;
    };

    // Stylesheet rules: remember each rule's original keyword so a theme
    // change can re-point it at the regenerated sprite.
    const patchedRules = new Map();
    const patchRules = (rules) => {
        Array.from(rules || []).forEach((rule) => {
            if (rule.cssRules && !rule.style) { patchRules(rule.cssRules); return; }
            if (rule.cssRules) patchRules(rule.cssRules);
            if (!rule.style) return;
            let kw = patchedRules.get(rule);
            if (!kw) {
                const cur = rule.style.getPropertyValue('cursor').trim().toLowerCase();
                if (!cur || !KEYWORDS[cur]) return;
                kw = cur;
                patchedRules.set(rule, { kw: kw, prio: rule.style.getPropertyPriority('cursor') });
            } else {
                kw = kw.kw;
            }
            const meta = patchedRules.get(rule);
            rule.style.setProperty('cursor', values[kw], meta.prio);
        });
    };
    const patchAllSheets = () => {
        Array.from(document.styleSheets).forEach((sheet) => {
            try { patchRules(sheet.cssRules); } catch (e) { /* cross-origin sheet (fonts) */ }
        });
    };

    // Inline cursors set from JS (el.style.cursor = 'grab', setProperty).
    const hookInline = () => {
        const proto = CSSStyleDeclaration.prototype;
        // Newer engines keep property accessors on a sub-prototype
        // (CSSStyleProperties / CSS2Properties): find the one that owns it.
        let owner = Object.getPrototypeOf(document.documentElement.style);
        while (owner && !Object.getOwnPropertyDescriptor(owner, 'cursor')) owner = Object.getPrototypeOf(owner);
        const desc = owner ? Object.getOwnPropertyDescriptor(owner, 'cursor') : null;
        if (desc && desc.set && desc.configurable) {
            Object.defineProperty(owner, 'cursor', {
                configurable: true,
                enumerable: desc.enumerable,
                get() { return desc.get.call(this); },
                set(v) { desc.set.call(this, themed(v)); }
            });
        }
        const setProp = proto.setProperty;
        proto.setProperty = function (name, value, prio) {
            if (String(name).toLowerCase() === 'cursor') value = themed(value);
            return setProp.call(this, name, value, prio);
        };
    };

    // Base cursor for the whole page and text fields.
    const baseStyle = document.createElement('style');
    const writeBase = () => {
        baseStyle.textContent =
            `html, body { cursor: ${values.default}; }\n` +
            `input:not([type]), input[type="text"], input[type="search"], input[type="number"], textarea, [contenteditable="true"] { cursor: ${values.text}; }\n` +
            `a[href], button:not([disabled]), select, label[for], summary { cursor: ${values.pointer}; }\n` +
            `button[disabled] { cursor: ${values['not-allowed']}; }\n`;
    };

    const refresh = (force) => {
        if (force !== true && builtAccent !== null && readAccent() === builtAccent) return;
        buildValues();
        writeBase();
        patchAllSheets();
    };

    const init = () => {
        hookInline();
        refresh(true);
        document.head.insertBefore(baseStyle, document.head.firstChild);
        // Theme / faction switches change the accent colour.
        let pending = 0;
        new MutationObserver(() => {
            clearTimeout(pending);
            pending = setTimeout(refresh, 60);
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-faction', 'data-theme', 'style', 'class'] });
        // Fallback for engines where `el.style.cursor = …` cannot be hooked:
        // swap a plain keyword in any changed inline style for its sprite.
        new MutationObserver((records) => {
            records.forEach((rec) => {
                const st = rec.target && rec.target.style;
                if (!st) return;
                const cur = st.getPropertyValue('cursor').trim().toLowerCase();
                if (cur && values[cur]) st.setProperty('cursor', values[cur], st.getPropertyPriority('cursor'));
            });
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'], subtree: true });
        // Stylesheets / <style> blocks added later get patched too.
        new MutationObserver(() => {
            clearTimeout(pending);
            pending = setTimeout(patchAllSheets, 60);
        }).observe(document.head, { childList: true });
    };

    window.pixelCursors = { refresh: () => refresh(true), themed: themed };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    // Late-loading stylesheets.
    window.addEventListener('load', patchAllSheets);
})();
