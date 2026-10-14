"use strict";

// ProfileSelectionManager members, continued from core.js (kept under ~500 lines per file).
extendClass(ProfileSelectionManager, {
    /** All portrait features apply to every species (helmeted pilots). */
    pilotLookKeys() {
        const o = this._startOpts;
        return heroPortrait.keysFor(o && o.look);
    },
    /** 12x12 pixel glyph shown before each pilot feature label (currentColor). */
    pilotLookIconHtml(k) {
        const paths = {
            gender: 'M4 1h4v4H4zM3 6h6v5H7V8H5v3H3z',
            skin: 'M4 1h4v1h2v1h1v6h-1v1H8v1H4v-1H2V9H1V3h1V2h2zM3 3v6h1v1h4V9h1V3H8V2H4v1zM4 5h1v1H4zM7 5h1v1H7z',
            hair: 'M3 2h6v1h1v1h1v5H1V4h1V3h1zM2 10h8v1H2z',
            hairCol: 'M5 1h2v2h1v1h1v1h1v3H9v1H8v1H4V9H3V8H2V5h1V4h1V3h1z',
            hairc: 'M2 3h1v7H2zM5 1h2v9H5zM9 3h1v7H9z',
            eye: 'M1 6h1V5h1V4h6v1h1v1h1v1h-1v1h-1v1H3V8H2V7H1zM5 5v3h2V5z',
            face: 'M1 4h4v1h2V4h4v4H7V7H5v1H1zM2 5v2h2V5zM8 5v2h2V5z',
            nose: 'M2 2h8v8H2zM3 3v6h6V3zM4 4h4v1H4zM4 6h4v1H4z',
            mouth: 'M1 3h10v4H9v2H7V8H5v1H3V7H1z',
            brow: 'M1 4h4v1h2V4h4v2h-4V5H5v1H1z',
            scar: 'M8 1h2v2H9v2H8v2H7v2H6v2H4v-2h1V8h1V6h1V4h1z',
            beard: 'M2 2h8v4H9v3H8v1H4V9H3V6H2z',
            gear: 'M5 1h2v2h2V2h1v1h-1v2h2v2h-2v2h1v1H9V9H7v2H5V9H3v1H2V9h1V7H1V5h2V3H2V2h1v1h2zM5 5v2h2V5z'
        };
        return `<svg class="pp-ico" viewBox="0 0 12 12" width="22" height="22" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${paths[k] || paths.skin}"/></svg>`;
    },
    /** PILOT row of the create step: generated portrait plus feature pickers. */
    renderPilotRowHtml() {
        const o = this._startOpts;
        if (typeof heroPortrait === 'undefined' || !o || !o.look) return '';
        o.look = heroPortrait.normalize(o.look);
        const keys = this.pilotLookKeys();
        if (keys.indexOf(o.lookKey) < 0) o.lookKey = keys[0];
        const pick = () => `<div class="pp-picks" role="listbox" aria-label="Portrait">` + [13, 10, 0, 15, 5, 2, 8, 6, 7, 12, 11, 1, 14, 4, 3, 9].map((i) =>
            `<button type="button" class="pp-pick${i === o.look.v ? ' selected' : ''}" data-pp-pick="${i}" data-build="${typeof VXP !== 'undefined' ? VXP.preset(o.look.faction, i).build : 0}" tabindex="-1" aria-label="Portrait ${i + 1}" aria-selected="${i === o.look.v}">` +
            (typeof voxelPortrait !== 'undefined' ? voxelPortrait.canvasHtml({ faction: o.look.faction, v: i }, this.pilotAccent(), { coarse: true }) : '') + '</button>').join('') + '</div>';
        const ctlSlider = (k) => `<div class="pp-ctl${k === o.lookKey ? ' active' : ''}" data-pp-key="${k}">` +
            `<span class="pp-name">${this.pilotLookIconHtml(k)}<span>${heroPortrait.labelFor(k, o.look)}</span></span>` +
            `<input type="range" class="pp-slider" data-pp-slider min="0" max="${heroPortrait.OPTIONS[k] - 1}" step="1" value="${o.look[k]}" tabindex="-1" aria-label="${heroPortrait.labelFor(k, o.look)}">` +
            `<b class="pp-val">${heroPortrait.valueName(k, o.look[k], o.look)}</b></div>`;
        const ctl = (k) => (k === 'v' && typeof voxelPortrait !== 'undefined' ? pick() : ctlSlider(k));
        return `<div class="profile-start-row" data-start-row="pilot">
                    <span class="profile-start-label">PILOT</span>
                    <div class="profile-pilot-card">
                        <div class="profile-pilot-side">
                            <div class="profile-pilot-portrait" id="psPortrait">${heroPortrait.html(o.look, this.pilotAccent())}</div>
                        </div>
                        <div class="profile-pilot-controls">
                            <div class="pp-grid">${keys.map(ctl).join('')}</div>
                        </div>
                    </div>
                </div>`;
    },
    /** Persist the pilot look so a reload returns to the same settings. */
    savePilotState() {
        if (typeof menuStateManager !== 'undefined' && this.isVisible && this.mode === 'create') {
            menuStateManager.save({ pstart: this._startOpts || null, pname: this._pilotName || '' });
        }
    },
    /** Re-render the portrait and feature values after a change. */
    refreshPilotRow() {
        this.savePilotState();
        const o = this._startOpts;
        const box = this.overlay && this.overlay.querySelector('#psPortrait');
        if (!box || !o || !o.look) return;
        box.innerHTML = heroPortrait.html(o.look, this.pilotAccent());
        this.overlay.querySelectorAll('.pp-pick').forEach((b) => {
            const on = Number(b.getAttribute('data-pp-pick')) === o.look.v;
            b.classList.toggle('selected', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        this.overlay.querySelectorAll('.pp-ctl').forEach((el) => {
            const k = el.getAttribute('data-pp-key');
            el.classList.toggle('active', k === o.lookKey);
            const v = el.querySelector('.pp-val');
            if (v) v.textContent = heroPortrait.valueName(k, o.look[k], o.look);
            const sl = el.querySelector('.pp-slider');
            if (sl && Number(sl.value) !== o.look[k]) sl.value = o.look[k];
        });
    },
    stepPilotLook(key, d) {
        const o = this._startOpts;
        if (!o || !o.look) return;
        o.lookKey = key;
        o.look = heroPortrait.cycle(o.look, key, d);
        this.refreshPilotRow();
    },
    randomizePilotLook() {
        const o = this._startOpts;
        if (!o) return;
        o.look = heroPortrait.randomLook(this.pendingFaction);
        this.refreshPilotRow();
    },
    /**
     * NEW GALAXY modal (over the pilot screen): name, ruler, held/contested,
     * planet count and difficulty. CREATE generates it and selects it as
     * the start galaxy. Rows: ↑/↓ move, ←/→ change, ENTER create, ESC close.
     */
    generateStartGalaxy() {
        const box = this.overlay && this.overlay.querySelector('#psStartGalaxy');
        if (!box || !this._startOpts) return;
        this.openNewGalaxyModal({
            host: this.overlay.querySelector('.profile-selection-content') || this.overlay,
            onCreate: (g) => {
                this._startOpts.galaxy = g.id;
                const meta = planetConfigManager.getFactionMeta ? planetConfigManager.getFactionMeta(this.pendingFaction) : null;
                box.innerHTML = this.renderStartGalaxyCardHtml(g.id, (meta && meta.homeGalaxy) || 'milky_way', GALAXY_MAP_H);
            }
        });
    },
    /** NEW GALAXY modal in opts.host; opts.onCreate(galaxy) after CREATE. Also used by the galaxy viewer. */
    openNewGalaxyModal(opts) {
        if (!planetConfigManager.generateGalaxy || this._galaxyModal) return;
        const factions = this.getFactionIds();
        const tiers = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'];
        const counts = [5, 7, 9, 12];
        const st = {
            name: planetConfigManager.randomGalaxyName(),
            faction: factions[Math.floor(Math.random() * factions.length)],
            control: 'held',
            planetCount: 7,
            sunCount: 1,
            difficultyTier: 1,
            rivals: [],
            seed: Math.floor(Math.random() * 1e9)
        };
        const groups = {
            faction: factions.map((f) => [f, String(f).toUpperCase(), this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, 16) : '']),
            control: [['held', 'HELD', ''], ['contested', 'CONTESTED', '']],
            planetCount: counts.map((n) => [n, String(n), '']),
            sunCount: [1, 2, 3].map((n) => [n, String(n), '']),
            difficultyTier: tiers.map((t, i) => [i, t, ''])
        };
        const labels = { faction: 'RULER', control: 'CONTROL', planetCount: 'PLANETS', sunCount: 'SUNS', difficultyTier: 'DIFFICULTY' };
        const sliders = ['planetCount', 'sunCount', 'difficultyTier'];
        const rows = ['name', 'faction', 'control', 'planetCount', 'sunCount', 'difficultyTier', 'buttons'];
        const modal = document.createElement('div');
        modal.className = 'profile-galaxy-modal';
        modal.innerHTML = `
            <div class="profile-galaxy-modal-box" role="dialog" aria-label="New galaxy">
                <h3 class="profile-galaxy-modal-title">NEW GALAXY</h3>
                <div class="profile-galaxy-modal-body">
                <div class="profile-galaxy-modal-form">
                <div class="profile-start-row" data-gm-row="name">
                    <span class="profile-start-label">NAME</span>
                    <div class="profile-galaxy-modal-name">
                        <input type="text" class="profile-galaxy-modal-input" maxlength="24" value="${st.name}">
                        <button type="button" class="profile-start-chip" data-gm-reroll tabindex="-1" title="Random name">↻</button>
                    </div>
                </div>
                ${Object.keys(groups).map((g) => `
                <div class="profile-start-row" data-gm-row="${g}">
                    <span class="profile-start-label">${labels[g]}</span>
                    ${sliders.indexOf(g) >= 0 ? `<div class="profile-gm-slider" style="--gm-n:${groups[g].length}">
                        <input type="range" class="profile-gm-range" data-gm-slider="${g}" min="0" max="${groups[g].length - 1}" step="1" value="${groups[g].findIndex((o) => o[0] === st[g])}" tabindex="-1" aria-label="${labels[g]}">
                        <div class="profile-gm-ticks">${groups[g].map(([v, l], i) =>
                            `<span class="profile-gm-tick${st[g] === v ? ' selected' : ''}" style="--i:${i}" data-gm-opt="${g}" data-value="${v}">${l}</span>`).join('')}</div>
                    </div>` : `<div class="profile-start-chips">${groups[g].map(([v, l, icon]) =>
                        `<button type="button" class="profile-start-chip${st[g] === v ? ' selected' : ''}" data-gm-opt="${g}" data-value="${v}" tabindex="-1">${icon}${l}</button>`).join('')}</div>`}
                </div>`).join('')}
                </div>
                <div class="profile-galaxy-modal-preview" data-gm-preview></div>
                </div>
                <div class="profile-galaxy-modal-buttons" data-gm-row="buttons">
                    <button type="button" class="profile-start-chip" data-gm-cancel tabindex="-1">CANCEL</button>
                    <button type="button" class="profile-start-chip" data-gm-create tabindex="-1">CREATE</button>
                </div>
            </div>`;
        ((opts && opts.host) || document.body).appendChild(modal);
        this._galaxyModal = modal;
        const input = modal.querySelector('.profile-galaxy-modal-input');
        const actions = [modal.querySelector('[data-gm-cancel]'), modal.querySelector('[data-gm-create]')];
        let row = 0;
        let btn = 1;
        const preview = modal.querySelector('[data-gm-preview]');
        const refresh = () => { preview.innerHTML = this.renderNewGalaxyPreviewHtml(st, input.value, tiers); };
        const setOpt = (g, v) => {
            st[g] = v;
            // Contested: pick the rivals now so the preview shows who fights.
            if (g === 'faction' || g === 'control') {
                st.rivals = st.control === 'contested' ? planetConfigManager.pickGalaxyRivals(st.faction) : [];
            }
            if (g === 'planetCount') st.seed = Math.floor(Math.random() * 1e9);
            modal.querySelectorAll(`[data-gm-opt="${g}"]`).forEach((b) =>
                b.classList.toggle('selected', String(v) === b.getAttribute('data-value')));
            const range = modal.querySelector(`[data-gm-slider="${g}"]`);
            if (range) range.value = String(groups[g].findIndex((o) => o[0] === v));
            refresh();
        };
        const sync = () => {
            modal.querySelectorAll('[data-gm-row]').forEach((r) =>
                r.classList.toggle('nav-row-active', r.getAttribute('data-gm-row') === rows[row]));
            actions.forEach((b, i) => b.classList.toggle('selected', rows[row] === 'buttons' && i === btn));
            if (rows[row] === 'name') input.focus(); else input.blur();
        };
        const close = () => {
            window.removeEventListener('keydown', onKey, true);
            modal.remove();
            this._galaxyModal = null;
        };
        const create = () => {
            const g = planetConfigManager.generateGalaxy(Object.assign({}, st, { name: input.value }));
            close();
            if (opts && opts.onCreate) opts.onCreate(g);
        };
        const onKey = (e) => {
            // Screen rebuilt underneath: drop the stale modal.
            if (!modal.isConnected) { close(); return; }
            // The modal owns the keyboard while open.
            e.stopImmediatePropagation();
            const id = rows[row];
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (id === 'buttons' && btn === 0) close(); else create();
                return;
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                row = Math.max(0, Math.min(rows.length - 1, row + (e.key === 'ArrowDown' ? 1 : -1)));
                sync();
                return;
            }
            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && id !== 'name') {
                e.preventDefault();
                const d = e.key === 'ArrowLeft' ? -1 : 1;
                if (id === 'buttons') { btn = (btn + d + 2) % 2; sync(); return; }
                const vals = groups[id].map((o) => o[0]);
                const i = vals.indexOf(st[id]);
                setOpt(id, vals[(i + d + vals.length) % vals.length]);
            }
        };
        window.addEventListener('keydown', onKey, true);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { close(); return; }
            const opt = e.target.closest('[data-gm-opt]');
            if (opt) {
                const g = opt.getAttribute('data-gm-opt');
                const raw = opt.getAttribute('data-value');
                setOpt(g, typeof st[g] === 'number' ? Number(raw) : raw);
                const r = rows.indexOf(g);
                if (r >= 0) { row = r; sync(); }
            } else if (e.target.closest('[data-gm-reroll]')) {
                input.value = planetConfigManager.randomGalaxyName();
                st.seed = Math.floor(Math.random() * 1e9);
                refresh();
            } else if (e.target.closest('[data-gm-create]')) {
                create();
            } else if (e.target.closest('[data-gm-cancel]')) {
                close();
            }
        });
        modal.addEventListener('input', (e) => {
            const range = e.target.closest && e.target.closest('[data-gm-slider]');
            if (!range) return;
            const g = range.getAttribute('data-gm-slider');
            setOpt(g, groups[g][Number(range.value)][0]);
            const r = rows.indexOf(g);
            if (r >= 0) { row = r; sync(); }
        });
        input.addEventListener('input', refresh);
        sync();
        refresh();
        input.select();
    },
    /**
     * Sketch of the galaxy about to be created: planets in their ruler's
     * colour (contested ones split with a rival), lanes, a sun and the
     * difficulty ramp. The real layout is charted on first visit.
     */
    renderNewGalaxyPreviewHtml(st, name, tiers) {
        const pcm = planetConfigManager;
        const color = (f) => (pcm.getFactionPlanetTheme(f).baseColor || '#888');
        let s = (st.seed >>> 0) || 1;
        const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        const W = 320;
        const H = 200;
        const P = 26;
        const n = st.planetCount;
        const pts = [];
        for (let i = 0; i < n; i++) {
            let best = null;
            for (let k = 0; k < 12; k++) {
                const c = { x: P + rnd() * (W - P * 2), y: P + rnd() * (H - P * 2) };
                const d = pts.reduce((m, p) => Math.min(m, Math.hypot(p.x - c.x, p.y - c.y)), 1e9);
                if (!best || d > best.d) best = Object.assign(c, { d });
            }
            pts.push(best);
        }
        // Lanes: each planet links to its nearest earlier planet (a tree).
        let edges = '';
        for (let i = 1; i < n; i++) {
            let j = 0;
            for (let k = 1; k < i; k++) {
                if (Math.hypot(pts[k].x - pts[i].x, pts[k].y - pts[i].y) < Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y)) j = k;
            }
            edges += `<line x1="${pts[i].x | 0}" y1="${pts[i].y | 0}" x2="${pts[j].x | 0}" y2="${pts[j].y | 0}"/>`;
        }
        const rivals = st.control === 'contested' ? (st.rivals || []) : [];
        // Home planet marker: a pixel house (2px cells) with its top-left corner at (hx, hy).
        const houseRows = ['....X....', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '.XXX.XXX.', '.XXX.XXX.', '.XXX.XXX.'];
        const houseD = (hx, hy) => houseRows.map((row, ry) => row.split('').map((ch, cx) => (ch === 'X' ? `M${(hx + cx * 2) | 0} ${(hy + ry * 2) | 0}h2v2h-2z` : '')).join('')).join('');
        const planets = pts.map((p, i) => {
            const tier = Math.min(tiers.length - 1, st.difficultyTier + Math.floor(i / 2));
            const r = i === 0 ? 9 : 6 + Math.floor(rnd() * 3);
            const rival = rivals.length && i > 0 && i % 2 === 0 ? rivals[(i / 2) % rivals.length | 0] : null;
            const x = p.x | 0;
            const y = p.y | 0;
            return `<g><title>${tiers[tier]}${rival ? ' · ' + rival.toUpperCase() : ''}</title>` +
                `<circle cx="${x}" cy="${y}" r="${r}" fill="${color(st.faction)}"/>` +
                (rival ? `<path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z" fill="${color(rival)}"/>` : '') +
                `<rect x="${x - 3}" y="${y + r + 3}" width="${(tier + 1) * 3}" height="2" class="tier"/>` +
                (i === 0 ? `<path class="start start-house" d="${houseD(x - 9, y - r - 22)}"/>` : '') +
                `</g>`;
        }).join('');
        // Suns on the map edge, spread so they don't overlap.
        const sunKinds = ['#ffb347', '#ff9a3d', '#cfe8ff', '#ff6a4a'];
        const sunSpots = [{ x: 0, y: 0.3 }, { x: W, y: 0.7 }, { x: 0.5, y: 0 }, { x: 0, y: 0.8 }, { x: W, y: 0.2 }, { x: 0.5, y: 1 }];
        const sunOff = Math.floor(rnd() * sunSpots.length);
        const suns = [];
        for (let i = 0; i < (st.sunCount || 1); i++) {
            const sp = sunSpots[(sunOff + i * 2) % sunSpots.length];
            suns.push({
                x: sp.x <= 1 && sp.x > 0 ? sp.x * W : sp.x,
                y: sp.y * H,
                c: sunKinds[Math.floor(rnd() * sunKinds.length)],
                r: 26 + Math.floor(rnd() * 16)
            });
        }
        const emblem = (f) => (this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, 16) : '');
        const last = Math.min(tiers.length - 1, st.difficultyTier + Math.floor((n - 1) / 2));
        return `
            <svg class="profile-galaxy-modal-map" viewBox="0 0 ${W} ${H}" aria-hidden="true" style="--gm-color:${color(st.faction)}">
                ${suns.map((u) => `<circle cx="${u.x | 0}" cy="${u.y | 0}" r="${u.r * 1.8 | 0}" fill="${u.c}" opacity="0.12"/>` +
                    `<circle cx="${u.x | 0}" cy="${u.y | 0}" r="${u.r}" fill="${u.c}" opacity="0.85"/>`).join('')}
                <g class="lanes">${edges}</g>${planets}
            </svg>
            <div class="profile-galaxy-modal-sum">
                <strong class="gm-sum-name">${String(name || '').trim().toUpperCase() || '—'}</strong>
                <dl class="gm-sum-list">
                    <dt>RULER</dt><dd>${emblem(st.faction)}${st.faction.toUpperCase()}<em class="gm-sum-state${rivals.length ? ' is-contested' : ''}">${rivals.length ? 'CONTESTED' : 'HELD'}</em></dd>
                    ${rivals.length ? `<dt>RIVALS</dt><dd class="vs">${rivals.map((f) => '<span>' + emblem(f) + f.toUpperCase() + '</span>').join('')}</dd>` : ''}
                    <dt>PLANETS</dt><dd>${n}</dd>
                    <dt>SUNS</dt><dd>${st.sunCount || 1}</dd>
                    <dt>DIFFICULTY</dt><dd>${tiers[st.difficultyTier]}${last !== st.difficultyTier ? '<i class="gm-sum-arrow">→</i>' + tiers[last] : ''}</dd>
                </dl>
            </div>`;
    },
    /**
     * Galaxy dropdown under the card's name: every galaxy with its ruler's
     * emblem in front (plus small rival emblems when contested).
     */
    toggleStartGalaxyList(box) {
        const open = box.querySelector('.profile-start-galaxy-list');
        if (open) { open.remove(); return; }
        const pcm = planetConfigManager;
        const meta = pcm.getFactionMeta ? pcm.getFactionMeta(this.pendingFaction) : null;
        const home = (meta && meta.homeGalaxy) || 'milky_way';
        const emblem = (f, size) => (f && this.getFactionEmblemHtml ? this.getFactionEmblemHtml(f, size) : '');
        const items = this.getStartGalaxyIds(this.pendingFaction, this._startOpts.galaxy).map((gid) => {
            const g = pcm.getGalaxy(gid);
            const c = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : null;
            const ruler = (c && c.main) || (g && g.faction);
            const rivals = c && c.control === 'contested' ? c.rivals : [];
            const sel = gid === this._startOpts.galaxy;
            return `<li role="option" aria-selected="${sel}" class="${sel ? 'selected' : ''}" data-galaxy-id="${gid}"` +
                ` title="${String(ruler || '').toUpperCase()}${rivals.length ? ' · CONTESTED' : ''}">` +
                `<span class="ruler">${emblem(ruler, 20)}</span>` +
                `<span class="name">${String((g && g.name) || gid).toUpperCase()}${gid === home ? ' ★' : ''}</span>` +
                (rivals.length ? `<span class="rivals">${rivals.map((f) => emblem(f, 12)).join('')}</span>` : '') +
                `</li>`;
        }).join('');
        const list = document.createElement('ul');
        list.className = 'profile-start-galaxy-list';
        list.setAttribute('role', 'listbox');
        list.innerHTML = items;
        const info = box.querySelector('.profile-start-galaxy-info');
        info.appendChild(list);
        const sel = list.querySelector('.selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
        // Close on any click outside the list.
        const away = (e) => {
            if (!list.isConnected) { document.removeEventListener('mousedown', away, true); return; }
            if (!e.target.closest('.profile-start-galaxy-list, [data-galaxy-pick]')) {
                list.remove();
                document.removeEventListener('mousedown', away, true);
            }
        };
        document.addEventListener('mousedown', away, true);
    },
});
