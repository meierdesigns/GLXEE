"use strict";

/**
 * Main menu GALAXIES: a full start-screen page (like CREDITS) to browse
 * every galaxy (they are global, shared by all pilots). List with ruler emblems left; map, control and planets right.
 * NEW GALAXY opens the same modal as pilot creation; generated galaxies
 * nobody has visited can be deleted.
 * Keys: ↑/↓ galaxy, N new, DEL delete, ESC back.
 */
class GalaxyViewer {
    constructor() {
        this.el = null;
        this.selected = null;
        try { this.selected = localStorage.getItem('vf_galaxy_viewer_selected_v1') || null; } catch (e) { /* ignore */ }
        this.focus = null;
        this._scroll = {};
        try {
            const c = JSON.parse(localStorage.getItem('vf_galaxy_viewer_state_v1') || 'null');
            if (c) {
                if (c.focus && c.gid === this.selected) this.focus = c.focus;
                this._scroll = c.scroll || {};
            }
        } catch (e) { /* ignore */ }
        this.onClose = null;
        this._onKey = null;
    }

    static get SCROLL_SELECTORS() { return ['.galaxy-viewer-list', '.galaxy-viewer-directory', '.galaxy-viewer-stats']; }

    /** Remember scroll positions of the three columns (in memory and across sessions). */
    saveScroll() {
        if (!this.el) return;
        GalaxyViewer.SCROLL_SELECTORS.forEach((q) => {
            const n = this.el.querySelector(q);
            if (n) this._scroll[q] = n.scrollTop;
        });
    }

    /** Persist selected planet/station and scroll positions. */
    saveState() {
        this.saveScroll();
        try {
            localStorage.setItem('vf_galaxy_viewer_state_v1', JSON.stringify({ gid: this.selected, focus: this.focus, scroll: this._scroll }));
        } catch (e) { /* ignore */ }
    }

    /** Renders into host (the start-screen content); onClose after ESC / BACK. */
    mount(host, options) {
        this.unmount();
        this.onClose = (options && options.onClose) || null;
        const ids = planetConfigManager.getGalaxyIds();
        if (ids.indexOf(this.selected) === -1) this.selected = ids[0];
        if (planetConfigManager.syncWorldFromProfiles) planetConfigManager.syncWorldFromProfiles();
        this.el = document.createElement('div');
        this.el.className = 'galaxy-viewer';
        host.appendChild(this.el);
        this.el.addEventListener('click', (e) => this.handleClick(e));
        // Drag & drop of a universe file onto the UNIVERSE LOADER drop area.
        const dropEl = (e) => e.target.closest && e.target.closest('[data-gv-drop]');
        this.el.addEventListener('dragover', (e) => {
            const z = dropEl(e);
            if (!z) return;
            e.preventDefault();
            z.classList.add('is-over');
        });
        this.el.addEventListener('dragleave', (e) => {
            const z = dropEl(e);
            if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-over');
        });
        this.el.addEventListener('drop', (e) => {
            const z = dropEl(e);
            if (!z) return;
            e.preventDefault();
            z.classList.remove('is-over');
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) universeSave.loadFile(file);
        });
        this._onKey = (e) => this.handleKey(e);
        window.addEventListener('keydown', this._onKey, true);
        this.render();
    }

    unmount() {
        if (!this.el) return;
        this.saveState();
        window.removeEventListener('keydown', this._onKey, true);
        this._universeOpen = false;
        this._reassign = null;
        this._newId = null;
        this.el.remove();
        this.el = null;
    }

    hide() {
        if (!this.el) return;
        this.unmount();
        if (this.onClose) this.onClose();
    }

    /** Pixel glyph before a button label (same set as the profile dialog). */
    btnIcon(kind) {
        if (kind === 'universe') {
            return typeof iconRenderer !== 'undefined' && iconRenderer.imgHtml
                ? `<span class="gv-btn-ico">${iconRenderer.imgHtml('menuPlanets', 16, 'hs-pixel')}</span>` : '';
        }
        return typeof ProfileSelectionManager !== 'undefined' && ProfileSelectionManager.btnIconHtml
            ? ProfileSelectionManager.btnIconHtml(kind) : '';
    }

    emblem(f, size) {
        return f && typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(f, size) : '';
    }

    render() {
        this.saveScroll();
        const pcm = planetConfigManager;
        const ids = pcm.getGalaxyIds();
        const list = ids.map((gid) => {
            const g = pcm.getGalaxy(gid);
            const c = pcm.getGalaxyControl(gid);
            return `<li class="${gid === this.selected ? 'selected' : ''}" data-gv-id="${gid}" title="${String(c.main).toUpperCase()}${c.control === 'contested' ? ' · CONTESTED' : ''}">` +
                `<span class="ruler">${this.emblem(c.main, 20)}</span>` +
                `<span class="name">${String(g.name || gid).toUpperCase()}</span>` +
                (c.rivals.length ? `<span class="rivals">${c.rivals.map((f) => this.emblem(f, 12)).join('')}</span>` : '') +
                (gid === this._newId ? '<span class="tag">NEW</span>' : '') +
                '</li>';
        }).join('');
        this.el.innerHTML = `
            <div class="galaxy-viewer-box" role="dialog" aria-label="Galaxies">
                <div class="galaxy-viewer-head">
                    <h2>GALAXIES</h2>
                    <div class="galaxy-viewer-head-actions">
                        <button type="button" class="galaxy-viewer-btn" data-gv-new>${this.btnIcon('create')}NEW GALAXY</button>
                        <button type="button" class="galaxy-viewer-btn" data-gv-universe>${this.btnIcon('universe')}UNIVERSE</button>
                        <button type="button" class="galaxy-viewer-btn" data-gv-close>${this.btnIcon('back')}ESC BACK</button>
                    </div>
                </div>
                <div class="galaxy-viewer-body">
                    <div class="galaxy-viewer-side">
                        <ul class="galaxy-viewer-list">${list}</ul>
                    </div>
                    <div class="galaxy-viewer-detail">${this.renderDetailHtml(this.selected)}</div>
                    <div class="galaxy-viewer-stats">${this.renderStatsHtml()}</div>
                </div>
            </div>${this._universeOpen ? this.universeModalHtml() : ''}${this._reassign ? this.reassignModalHtml() : ''}`;
        const sel = this.el.querySelector('.galaxy-viewer-list .selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
        GalaxyViewer.SCROLL_SELECTORS.forEach((q) => {
            const n = this.el.querySelector(q);
            if (n && this._scroll[q] != null && (q !== '.galaxy-viewer-list' || !sel)) n.scrollTop = this._scroll[q];
        });
        // Keep the picked planet / station visible; again next frame in case the page was not laid out yet.
        const reveal = () => {
            const dir = this.el && this.el.querySelector('.galaxy-viewer-directory');
            const row = dir && dir.querySelector('li.selected');
            if (!row) return;
            const d = dir.getBoundingClientRect();
            const r = row.getBoundingClientRect();
            // Centre the row as far as the scroll range allows.
            dir.scrollTop += (r.top + r.height / 2) - (d.top + d.height / 2);
        };
        reveal();
        requestAnimationFrame(() => { reveal(); this.saveScroll(); });
        this.saveState();
    }

    /** Trading posts + faction stations of a galaxy (map coords 0..1). */
    getStations(gid) {
        try {
            return typeof profileManager !== 'undefined' && profileManager.getTradingPosts
                ? (profileManager.getTradingPosts(gid) || []) : [];
        } catch (e) { return []; }
    }

    stationName(post) {
        return String(post.name || 'STATION').toUpperCase();
    }

    renderDetailHtml(gid) {
        const pcm = planetConfigManager;
        const g = pcm.getGalaxy(gid);
        if (!g) return '';
        // The pilot-creation card renders (and charts) the map; reuse its SVG
        // and add the stations plus click targets on top.
        const tmp = document.createElement('div');
        tmp.innerHTML = profileSelectionManager.renderStartGalaxyCardHtml(gid, null);
        const svg = tmp.querySelector('.profile-start-galaxy-map');
        const c = pcm.getGalaxyControl(gid);
        const tiers = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'];
        // The map is the galaxy's real layout (planetIds can hold strays).
        const map = pcm.getGalaxyMap(gid) || {};
        const nodes = map.nodes || [];
        const posts = this.getStations(gid);
        if (svg) {
            const W = 560;
            const H = 220;
            const P = 20;
            const px = (v) => Math.round(P + v * (W - P * 2));
            const py = (v) => Math.round(P + v * (H - P * 2));
            const sel = this.focus || {};
            const stations = posts.map((post) => {
                const x = px(post.x);
                const y = py(post.y);
                const on = sel.kind === 'post' && sel.id === post.id;
                return `<g class="gv-station${post.factionStation ? ' is-faction' : ''}${on ? ' is-selected' : ''}" data-gv-post="${post.id}">` +
                    `<title>${this.stationName(post)}</title>` +
                    `<rect x="${x - 5}" y="${y - 5}" width="10" height="10"/><rect class="core" x="${x - 2}" y="${y - 2}" width="4" height="4"/>` +
                    `<rect class="hit" x="${x - 9}" y="${y - 9}" width="18" height="18"/></g>`;
            }).join('');
            const hits = nodes.map((n) => {
                const on = sel.kind === 'planet' && sel.id === n.planetId;
                return `<rect class="gv-hit${on ? ' is-selected' : ''}" data-gv-planet="${n.planetId}" x="${px(n.x) - 16}" y="${py(n.y) - 16}" width="32" height="32"/>`;
            }).join('');
            svg.insertAdjacentHTML('beforeend', `<g class="gv-overlay">${stations}${hits}</g>`);
        }
        const row = (kind, id, icon, name, meta) => {
            const on = this.focus && this.focus.kind === kind && this.focus.id === id;
            return `<li class="${on ? 'selected' : ''}" data-gv-${kind}="${id}"><span class="icon">${icon}</span>` +
                `<span class="name">${name}</span><span class="diff">${meta}</span></li>`;
        };
        const planetRows = nodes.map((n) => {
            const cfg = pcm.getConfig ? pcm.getConfig(n.planetId) : null;
            const icon = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml
                ? galaxyMapManager.planetIconHtml(n.planetId, 20, true) : '';
            const here = posts.filter((post) => post.planetId === n.planetId).length;
            const owner = g.owners && g.owners[n.planetId];
            return row('planet', n.planetId, icon, String((cfg && cfg.name) || n.planetId).toUpperCase() + (n.planetId === map.startPlanetId ? ' ★' : ''),
                (owner ? `<span class="gv-owner" title="HELD BY ${String(owner.faction).toUpperCase()} · ${String(owner.pilot).toUpperCase()}">${this.emblem(owner.faction, 16)}</span>` : '') +
                String((cfg && cfg.difficulty) || '').toUpperCase() + (here ? ' · ' + here + ' ST' : ''));
        }).join('');
        const stationRows = posts.map((post) => row('post', post.id,
            `<i class="gv-station-icon${post.factionStation ? ' is-faction' : ''}"></i>`,
            this.stationName(post), post.factionStation ? 'FACTION' : 'TRADE')).join('');
        const pilots = pcm.getGalaxyPilots(gid);
        const own = pcm.getGalaxyOwnership ? pcm.getGalaxyOwnership(gid) : { byFaction: {} };
        const held = Object.keys(own.byFaction).sort((a, b) => own.byFaction[b] - own.byFaction[a]);
        const warp = typeof economyConfig !== 'undefined' && economyConfig.getGalaxyWarpTier ? economyConfig.getGalaxyWarpTier(gid) : null;
        return `
            <div class="galaxy-viewer-map">${svg ? svg.outerHTML : ''}</div>
            <div class="galaxy-viewer-info">
                <strong class="galaxy-viewer-name">${String(g.name || gid).toUpperCase()}</strong>
                <span>${this.emblem(c.main, 20)}${String(c.main).toUpperCase()} · ${c.control === 'contested' ? 'CONTESTED' : 'HELD'}</span>
                ${c.rivals.length ? `<span class="vs">VS ${c.rivals.map((f) => this.emblem(f, 16) + f.toUpperCase()).join(' · ')}</span>` : ''}
                <span>${nodes.length} PLANETS · ${posts.length} STATIONS${g.custom ? ' · STARTS ' + tiers[g.difficultyTier || 0] : ''}${warp != null && warp < 99 ? ' · WARP TIER ' + warp : ''}</span>
                ${held.length ? `<span>CONQUERED ${held.map((f) => this.emblem(f, 16) + own.byFaction[f] + '/' + own.total).join(' ')}${g.originalFaction && g.originalFaction !== c.main ? ' · TAKEN FROM ' + this.emblem(g.originalFaction, 16) + String(g.originalFaction).toUpperCase() : ''}</span>` : ''}
                <span class="muted">${pilots.length ? 'PILOTS: ' + pilots.join(', ').toUpperCase() : 'NO PILOT HAS BEEN HERE'}</span>
                ${g.custom ? `<button type="button" class="galaxy-viewer-btn danger" data-gv-delete${pilots.length ? ' title="Pilots in this galaxy will be moved to another one"' : ''}>DELETE</button>` : ''}
            </div>
            <div class="galaxy-viewer-directory">
                <h3 class="galaxy-viewer-sub">PLANETS</h3>
                <ul class="galaxy-viewer-rows">${planetRows}</ul>
                ${posts.length ? `<h3 class="galaxy-viewer-sub">STATIONS</h3><ul class="galaxy-viewer-rows">${stationRows}</ul>` : ''}
            </div>`;
    }

    /** Right column: stats of the clicked planet / station. */
    renderStatsHtml() {
        const f = this.focus;
        const pcm = planetConfigManager;
        const line = (k, v) => `<div class="gv-stat"><span class="k">${k}</span><span class="v">${v}</span></div>`;
        if (!f) return '<p class="gv-empty">CLICK A PLANET OR STATION</p>';
        if (f.kind === 'post') {
            const post = this.getStations(this.selected).find((p) => p.id === f.id);
            if (!post) return '<p class="gv-empty">CLICK A PLANET OR STATION</p>';
            const cfg = pcm.getConfig ? pcm.getConfig(post.planetId) : null;
            const owner = post.faction || pcm.getGalaxyFaction(this.selected);
            const art = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.stationArtImage
                ? `<span class="gv-planet-bg gv-station-bg" aria-hidden="true"><svg viewBox="-9 -9 18 18" width="360" height="360" shape-rendering="crispEdges">${galaxyMapManager.stationArtImage(post, 8, true)}</svg></span>` : '';
            return this.spaceBgHtml(this.selected) + art + `<h3 class="gv-title"><i class="gv-station-icon${post.factionStation ? ' is-faction' : ''}"></i>${this.stationName(post)}</h3>` +
                line('TYPE', post.factionStation ? 'FACTION STATION' : 'TRADING POST') +
                line('OWNER', this.emblem(owner, 16) + String(owner).toUpperCase()) +
                line('ORBITS', String((cfg && cfg.name) || post.planetId).toUpperCase()) +
                ((post.categories || []).length ? line('SELLS', post.categories.map((x) => String(x).toUpperCase()).join(', ')) : '');
        }
        const cfg = pcm.getConfig ? pcm.getConfig(f.id) : null;
        if (!cfg) return '<p class="gv-empty">NO DATA</p>';
        const icon = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml
            ? galaxyMapManager.planetIconHtml(f.id, 48, true) : '';
        const bgIcon = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml
            ? galaxyMapManager.planetIconHtml(f.id, 360, true) : '';
        const atmo = galaxyMapManager.planetAtmoColor ? galaxyMapManager.planetAtmoColor(bgIcon) : '';
        const factions = cfg.factions || (cfg.graphics && cfg.graphics.faction ? [cfg.graphics.faction] : []);
        const enemies = {};
        (cfg.enemies || []).forEach((e) => {
            const t = String(e.type || '?') + (/_boss$/.test(String(e.id || '')) || e.boss ? ' ★' : '');
            enemies[t] = (enemies[t] || 0) + 1;
        });
        const res = (cfg.resources || []).map((r) => `${String(r.id).toUpperCase()} ${r.min}–${r.max}`).join('<br>');
        const posts = this.getStations(this.selected).filter((p) => p.planetId === f.id);
        const g = pcm.getGalaxy(this.selected);
        const owner = g && g.owners && g.owners[f.id];
        return this.spaceBgHtml(this.selected) +
            `<span class="gv-planet-bg${atmo ? ' has-atmo' : ''}" style="--atmo:${atmo || 'transparent'}" aria-hidden="true">${bgIcon}</span><div class="gv-planet-head"><span class="gv-planet-icon">${icon}</span><h3 class="gv-title">${String(cfg.name || f.id).toUpperCase()}</h3></div>` +
            line('HELD BY', owner
                ? this.emblem(owner.faction, 16) + String(owner.faction).toUpperCase() + ' · ' + String(owner.pilot || '?').toUpperCase()
                : 'NOT CONQUERED') +
            line('DIFFICULTY', String(cfg.difficulty || '—').toUpperCase()) +
            (factions.length ? line('FACTIONS', factions.map((x) => this.emblem(x, 16) + String(x).toUpperCase()).join(' ')) : '') +
            (cfg.enemyHealth != null ? line('ENEMY HP', cfg.enemyHealth + '%') : '') +
            (cfg.enemySpeed != null ? line('ENEMY SPEED', '×' + cfg.enemySpeed) : '') +
            (Object.keys(enemies).length ? line('ENEMIES', Object.keys(enemies).map((t) => t.replace(/_/g, ' ').toUpperCase() + (enemies[t] > 1 ? ' ×' + enemies[t] : '')).join('<br>')) : '') +
            (res ? line('LOOT', res) : '') +
            (posts.length ? line('STATIONS', posts.map((p) => this.stationName(p)).join('<br>')) : '');
    }

    /** Seeded star field + nebula dust in the galaxy colour (same look as the start-screen galaxy map). */
    spaceBgHtml(gid) {
        const g = planetConfigManager.getGalaxy(gid);
        const color = (g && g.baseColor) || '#6a7cff';
        const W = 240;
        const H = 640;
        let seed = 0;
        for (const ch of String(gid)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
        const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
        let dust = '';
        for (let c = 0; c < 6; c++) {
            const cx = rnd() * W;
            const cy = rnd() * H;
            const rr = 50 + rnd() * 80;
            for (let i = 0; i < 160; i++) {
                const a = rnd() * Math.PI * 2;
                const d = Math.pow(rnd(), 0.7) * rr;
                const x = Math.floor((cx + Math.cos(a) * d * 1.3) / 6) * 6;
                const y = Math.floor((cy + Math.sin(a) * d * 1.3) / 6) * 6;
                dust += `<rect x="${x}" y="${y}" width="6" height="6" opacity="${(0.06 + (1 - d / rr) * 0.22).toFixed(2)}"/>`;
            }
        }
        let stars = '';
        for (let i = 0; i < 90; i++) {
            const sz = rnd() < 0.12 ? 2 : 1;
            stars += `<rect x="${Math.floor(rnd() * W)}" y="${Math.floor(rnd() * H)}" width="${sz}" height="${sz}" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`;
        }
        return `<svg class="gv-space-bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" style="--galaxy-color:${color}"><g fill="${color}">${dust}</g><g fill="#fff">${stars}</g></svg>`;
    }

    focusOn(kind, id) {
        this.focus = { kind, id };
        if (this.el) this.render(); else this.saveState();
    }

    select(gid) {
        if (gid !== this.selected) this.focus = null;
        // The NEW tag only marks the galaxy created a moment ago, until another is picked.
        if (gid !== this._newId) this._newId = null;
        this.selected = gid;
        try { localStorage.setItem('vf_galaxy_viewer_selected_v1', gid || ''); } catch (e) { /* ignore */ }
        if (this.el) this.render();
    }

    openNew() {
        if (typeof profileSelectionManager === 'undefined') return;
        profileSelectionManager.openNewGalaxyModal({ host: document.body, onCreate: (g) => { this._newId = g.id; this.select(g.id); } });
    }

    async deleteSelected() {
        const g = planetConfigManager.getGalaxy(this.selected);
        if (!g || !g.custom) return;
        const pilots = planetConfigManager.getGalaxyPilots(this.selected);
        if (pilots.length) {
            // Pilots live here: they need another galaxy first.
            const others = planetConfigManager.getGalaxyIds().filter((id) => id !== this.selected);
            if (!others.length) { uiDialog.alert('There is no other galaxy to move the pilots to.', { title: 'DELETE GALAXY' }); return; }
            this._reassign = { gid: this.selected, pilots, target: others.indexOf('milky_way') !== -1 ? 'milky_way' : others[0] };
            this.render();
            return;
        }
        const ok = await uiDialog.confirm('Delete galaxy ' + String(g.name).toUpperCase() + '?', { title: 'DELETE GALAXY', okLabel: 'DELETE', danger: true });
        if (!ok) return;
        const res = planetConfigManager.deleteGalaxy(this.selected);
        if (!res.ok) { uiDialog.alert(res.reason, { title: 'DELETE GALAXY' }); return; }
        this.select(planetConfigManager.getGalaxyIds()[0]);
    }

    /** Pilots in the galaxy to delete: pick the galaxy they move to. */
    reassignModalHtml() {
        const r = this._reassign;
        const pcm = planetConfigManager;
        const g = pcm.getGalaxy(r.gid);
        const options = pcm.getGalaxyIds().filter((id) => id !== r.gid).map((id) => {
            const gg = pcm.getGalaxy(id);
            const c = pcm.getGalaxyControl(id);
            return `<li class="${id === r.target ? 'selected' : ''}" data-gv-target="${id}">` +
                `<span class="ruler">${this.emblem(c.main, 20)}</span><span class="name">${String(gg.name || id).toUpperCase()}</span></li>`;
        }).join('');
        return `
            <div class="galaxy-viewer-modal-backdrop" data-gv-reassign-close>
                <div class="galaxy-viewer-modal" role="dialog" aria-label="Delete galaxy">
                    <h3>DELETE ${String(g.name || r.gid).toUpperCase()}</h3>
                    <p>${r.pilots.length === 1 ? 'This pilot has' : 'These pilots have'} been here: <b>${r.pilots.map((n) => String(n).toUpperCase()).join(', ')}</b>.
                    Pick the galaxy ${r.pilots.length === 1 ? 'they move' : 'they move'} to. Their progress here is lost.</p>
                    <ul class="galaxy-viewer-list gv-target-list">${options}</ul>
                    <div class="galaxy-viewer-modal-actions">
                        <button type="button" class="action-button secondary" data-gv-reassign-close>${this.btnIcon('cancel')}CANCEL</button>
                        <button type="button" class="action-button" data-gv-reassign-ok>${this.btnIcon('delete')}DELETE</button>
                    </div>
                </div>
            </div>`;
    }

    confirmReassign() {
        const r = this._reassign;
        if (!r) return;
        const res = planetConfigManager.deleteGalaxy(r.gid, { reassignTo: r.target });
        this._reassign = null;
        if (!res.ok) { this.render(); uiDialog.alert(res.reason || 'COULD NOT DELETE', { title: 'DELETE GALAXY' }); return; }
        this.select(r.target);
    }

    /** UNIVERSE LOADER: save / load all galaxies together with their pilots as one file. */
    universeModalHtml() {
        const icon = (k) => this.btnIcon(k);
        return `
            <div class="galaxy-viewer-modal-backdrop" data-gv-universe-close>
                <div class="galaxy-viewer-modal" role="dialog" aria-label="Universe loader">
                    <h3>UNIVERSE LOADER</h3>
                    <p>All galaxies and the pilots living in them, as one file. Send it to someone, or load one you received.</p>
                    <div class="gv-drop" data-gv-drop tabindex="0" role="button" aria-label="Drop a universe file or click to choose one">
                        <span class="gv-drop-icon">${this.dropIconHtml()}</span>
                        <b class="gv-drop-title">DROP UNIVERSE FILE HERE</b>
                        <span class="gv-drop-sub">or click to choose a .json file</span>
                    </div>
                    <div class="galaxy-viewer-modal-actions">
                        <button type="button" class="action-button secondary" data-gv-universe-close>${icon('cancel')}CLOSE</button>
                        <button type="button" class="action-button" data-gv-download>${icon('download')}DOWNLOAD</button>
                    </div>
                </div>
            </div>`;
    }

    /** Big pixel arrow into a tray, for the drop area. */
    dropIconHtml() {
        return '<svg viewBox="0 0 16 16" width="48" height="48" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M7 1h2v1h1v1h1v1h1v1h-3v5H7V5H4V4h1V3h1V2h1z M2 10h2v3h8v-3h2v5H2z"/></svg>';
    }

    setUniverseOpen(open) {
        this._universeOpen = !!open;
        this.render();
    }

    handleClick(e) {
        if (this._reassign) {
            const t = e.target.closest('[data-gv-target]');
            if (t) { this._reassign.target = t.getAttribute('data-gv-target'); this.render(); return; }
            if (e.target.closest('[data-gv-reassign-ok]')) { this.confirmReassign(); return; }
            const box = e.target.closest('.galaxy-viewer-modal');
            if (e.target.closest('button[data-gv-reassign-close]') || (!box && e.target.closest('[data-gv-reassign-close]'))) {
                this._reassign = null; this.render();
            }
            return;
        }
        if (this._universeOpen) {
            if (e.target.closest('[data-gv-download]')) { universeSave.download(); return; }
            if (e.target.closest('[data-gv-drop]')) { universeSave.upload(); return; }
            const box = e.target.closest('.galaxy-viewer-modal');
            if (e.target.closest('button[data-gv-universe-close]') || (!box && e.target.closest('[data-gv-universe-close]'))) {
                this.setUniverseOpen(false);
            }
            return;
        }
        if (e.target.closest('[data-gv-universe]')) { this.setUniverseOpen(true); return; }
        if (e.target.closest('[data-gv-close]')) { this.hide(); return; }
        const planet = e.target.closest('[data-gv-planet]');
        if (planet) { this.focusOn('planet', planet.getAttribute('data-gv-planet')); return; }
        const post = e.target.closest('[data-gv-post]');
        if (post) { this.focusOn('post', post.getAttribute('data-gv-post')); return; }
        const item = e.target.closest('[data-gv-id]');
        if (item) { this.select(item.getAttribute('data-gv-id')); return; }
        if (e.target.closest('[data-gv-new]')) { this.openNew(); return; }
        if (e.target.closest('[data-gv-delete]:not([disabled])')) this.deleteSelected();
    }

    handleKey(e) {
        if (!this.el) return;
        // Page rebuilt underneath: stop listening.
        if (!this.el.isConnected) { this.unmount(); return; }
        // The NEW GALAXY modal handles its own keys.
        if (typeof profileSelectionManager !== 'undefined' && profileSelectionManager._galaxyModal) return;
        e.stopImmediatePropagation();
        // DELETE GALAXY modal: ↑/↓ pick the target, ENTER deletes, ESC cancels.
        if (this._reassign) {
            const r = this._reassign;
            const ids = planetConfigManager.getGalaxyIds().filter((id) => id !== r.gid);
            const i = ids.indexOf(r.target);
            if (e.key === 'Escape') { e.preventDefault(); this._reassign = null; this.render(); }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                r.target = ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length];
                this.render();
            } else if (e.key === 'Enter') { e.preventDefault(); this.confirmReassign(); }
            return;
        }
        // UNIVERSE LOADER open: ESC closes just the modal, other keys do nothing.
        if (this._universeOpen) {
            if (e.key === 'Escape') { e.preventDefault(); this.setUniverseOpen(false); }
            return;
        }
        const ids = planetConfigManager.getGalaxyIds();
        const i = ids.indexOf(this.selected);
        if (e.key === 'Escape') { e.preventDefault(); this.hide(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const d = e.key === 'ArrowDown' ? 1 : -1;
            this.select(ids[(i + d + ids.length) % ids.length]);
        } else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.openNew(); }
        else if (e.key === 'Delete') { e.preventDefault(); this.deleteSelected(); }
    }
}

const galaxyViewer = new GalaxyViewer();
window.galaxyViewer = galaxyViewer;
