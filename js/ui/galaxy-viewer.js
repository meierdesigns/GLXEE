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
        this.onClose = null;
        this._onKey = null;
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
        this._onKey = (e) => this.handleKey(e);
        window.addEventListener('keydown', this._onKey, true);
        this.render();
    }

    unmount() {
        if (!this.el) return;
        window.removeEventListener('keydown', this._onKey, true);
        this.el.remove();
        this.el = null;
    }

    hide() {
        if (!this.el) return;
        this.unmount();
        if (this.onClose) this.onClose();
    }

    emblem(f, size) {
        return f && typeof profileSelectionManager !== 'undefined' && profileSelectionManager.getFactionEmblemHtml
            ? profileSelectionManager.getFactionEmblemHtml(f, size) : '';
    }

    render() {
        const pcm = planetConfigManager;
        const ids = pcm.getGalaxyIds();
        const list = ids.map((gid) => {
            const g = pcm.getGalaxy(gid);
            const c = pcm.getGalaxyControl(gid);
            return `<li class="${gid === this.selected ? 'selected' : ''}" data-gv-id="${gid}" title="${String(c.main).toUpperCase()}${c.control === 'contested' ? ' · CONTESTED' : ''}">` +
                `<span class="ruler">${this.emblem(c.main, 20)}</span>` +
                `<span class="name">${String(g.name || gid).toUpperCase()}</span>` +
                (c.rivals.length ? `<span class="rivals">${c.rivals.map((f) => this.emblem(f, 12)).join('')}</span>` : '') +
                (g.custom ? '<span class="tag">NEW</span>' : '') +
                '</li>';
        }).join('');
        this.el.innerHTML = `
            <div class="galaxy-viewer-box" role="dialog" aria-label="Galaxies">
                <div class="galaxy-viewer-head">
                    <h2>GALAXIES</h2>
                    <button type="button" class="galaxy-viewer-btn" data-gv-close>ESC BACK</button>
                </div>
                <div class="galaxy-viewer-body">
                    <div class="galaxy-viewer-side">
                        <ul class="galaxy-viewer-list">${list}</ul>
                        <button type="button" class="galaxy-viewer-btn" data-gv-new>+ NEW GALAXY</button>
                    </div>
                    <div class="galaxy-viewer-detail">${this.renderDetailHtml(this.selected)}</div>
                    <div class="galaxy-viewer-stats">${this.renderStatsHtml()}</div>
                </div>
            </div>`;
        const sel = this.el.querySelector('.galaxy-viewer-list .selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
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
                ${g.custom ? `<button type="button" class="galaxy-viewer-btn danger" data-gv-delete${pilots.length ? ' disabled title="Visited galaxies cannot be deleted"' : ''}>DELETE</button>` : ''}
            </div>
            <h3 class="galaxy-viewer-sub">PLANETS</h3>
            <ul class="galaxy-viewer-rows">${planetRows}</ul>
            ${posts.length ? `<h3 class="galaxy-viewer-sub">STATIONS</h3><ul class="galaxy-viewer-rows">${stationRows}</ul>` : ''}`;
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
            return `<h3 class="gv-title"><i class="gv-station-icon${post.factionStation ? ' is-faction' : ''}"></i>${this.stationName(post)}</h3>` +
                line('TYPE', post.factionStation ? 'FACTION STATION' : 'TRADING POST') +
                line('OWNER', this.emblem(owner, 16) + String(owner).toUpperCase()) +
                line('ORBITS', String((cfg && cfg.name) || post.planetId).toUpperCase()) +
                ((post.categories || []).length ? line('SELLS', post.categories.map((x) => String(x).toUpperCase()).join(', ')) : '');
        }
        const cfg = pcm.getConfig ? pcm.getConfig(f.id) : null;
        if (!cfg) return '<p class="gv-empty">NO DATA</p>';
        const icon = typeof galaxyMapManager !== 'undefined' && galaxyMapManager.planetIconHtml
            ? galaxyMapManager.planetIconHtml(f.id, 48, true) : '';
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
        return `<div class="gv-planet-head"><span class="gv-planet-icon">${icon}</span><h3 class="gv-title">${String(cfg.name || f.id).toUpperCase()}</h3></div>` +
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

    focusOn(kind, id) {
        this.focus = { kind, id };
        if (this.el) this.render();
    }

    select(gid) {
        if (gid !== this.selected) this.focus = null;
        this.selected = gid;
        try { localStorage.setItem('vf_galaxy_viewer_selected_v1', gid || ''); } catch (e) { /* ignore */ }
        if (this.el) this.render();
    }

    openNew() {
        if (typeof profileSelectionManager === 'undefined') return;
        profileSelectionManager.openNewGalaxyModal({ host: document.body, onCreate: (g) => this.select(g.id) });
    }

    deleteSelected() {
        const g = planetConfigManager.getGalaxy(this.selected);
        if (!g || !g.custom) return;
        if (!window.confirm('Delete galaxy ' + String(g.name).toUpperCase() + '?')) return;
        const res = planetConfigManager.deleteGalaxy(this.selected);
        if (!res.ok) { window.alert(res.reason); return; }
        this.select(planetConfigManager.getGalaxyIds()[0]);
    }

    handleClick(e) {
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
