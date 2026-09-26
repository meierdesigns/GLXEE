"use strict";

// GalaxyMapManager methods: animated flights between map locations, with a
// chance of a pirate ambush on routes pirates prowl (marked "!") (fight it or evade).

const GM_MAP_W = 640;
const GM_MAP_H = 320;
const GM_MAP_PAD = 48;

extendClass(GalaxyMapManager, {
    /** SVG position of a ship location ({ kind: 'planet'|'post', id }). */
    locationPoint(loc) {
        if (!loc) return null;
        const at = loc.kind === 'post'
            ? (this.getTradingPosts() || []).find((p) => p.id === loc.id)
            : this.nodeById[loc.id];
        if (!at) return null;
        return {
            x: GM_MAP_PAD + at.x * (GM_MAP_W - GM_MAP_PAD * 2),
            y: GM_MAP_PAD + at.y * (GM_MAP_H - GM_MAP_PAD * 2)
        };
    },

    /**
     * Pirate presence in this galaxy: share of routes that raiders prowl.
     * More where pirates hold or contest the galaxy.
     */
    pirateRouteShare() {
        let share = 0.3;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyControl) {
            const c = planetConfigManager.getGalaxyControl(this.galaxyId);
            if (c.main === 'pirate') share = 0.6;
            else if (c.rivals.indexOf('pirate') !== -1) share = 0.45;
        }
        return share;
    },

    /**
     * Whether pirates prowl the route between two locations. Fixed per route
     * (hashed from galaxy + both ends, direction-independent) so the map can
     * warn about it before you fly.
     */
    isRouteRisky(fromLoc, toLoc) {
        if (!fromLoc || !toLoc) return false;
        const a = fromLoc.kind + ':' + fromLoc.id;
        const b = toLoc.kind + ':' + toLoc.id;
        if (a === b) return false;
        const key = String(this.galaxyId) + '|' + (a < b ? a + '|' + b : b + '|' + a);
        let hash = 2166136261;
        for (let i = 0; i < key.length; i++) {
            hash ^= key.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return (hash % 1000) / 1000 < this.pirateRouteShare();
    },

    /**
     * Ambush chance for a flight: only on pirate routes (marked with "!").
     * window.GM_AMBUSH_CHANCE overrides it (testing).
     */
    ambushChance(fromLoc, toLoc) {
        const forced = Number(window.GM_AMBUSH_CHANCE);
        if (Number.isFinite(forced)) return forced;
        return this.isRouteRisky(fromLoc, toLoc) ? 0.5 : 0;
    },

    /** Dashed route from the ship to the selected target, "!" if pirates prowl it. */
    routePreviewSvg() {
        const current = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId) : null;
        const target = this.selectedPostId
            ? { kind: 'post', id: this.selectedPostId }
            : (this.selectedPlanetId ? { kind: 'planet', id: this.selectedPlanetId } : null);
        if (!current || !target || (current.kind === target.kind && current.id === target.id)) return '';
        const from = this.locationPoint(current);
        const to = this.locationPoint(target);
        if (!from || !to) return '';
        const risky = this.isRouteRisky(current, target);
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return `<line class="gm-route ${risky ? 'risky' : ''}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>` +
            (risky ? `<g class="gm-route-warn" transform="translate(${mx},${my})">` +
                `<title>PIRATE ROUTE · AMBUSH POSSIBLE</title>` +
                `<path d="M0 -9 L9 7 L-9 7 Z"/><text x="0" y="5">!</text></g>` : '');
    },

    syncRoutePreview() {
        const layer = this.overlay && this.overlay.querySelector('.gm-route-layer');
        if (layer) layer.innerHTML = this._flight ? '' : this.routePreviewSvg();
    },

    /** Animate the ship to a planet / post, then commit the new location. */
    flyTo(kind, id) {
        if (this._flight || this._ambush) return;
        const current = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId) : null;
        const from = this.locationPoint(current);
        const to = this.locationPoint({ kind: kind, id: id });
        const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!from || !to || !svg || reduced) {
            this.commitFlight(kind, id);
            return;
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90; // ship art points up
        const icon = this.getShipIconUrl && this.getShipIconUrl();
        const shipSvg = icon
            ? `<image href="${icon}" x="-5.5" y="-7.5" width="11" height="15" class="gm-ship-marker-img"/>`
            : '<path d="M0 -7 L6 6 L0 3 L-6 6 Z" class="gm-ship-marker-body"/>';
        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'gm-ship-travel');
        g.innerHTML = `<line class="gm-travel-trail" x1="${from.x}" y1="${from.y}" x2="${from.x}" y2="${from.y}"/>` +
            `<g class="gm-travel-ship"><g transform="rotate(${angle})">${shipSvg}<rect class="gm-travel-thrust" x="-1.5" y="7" width="3" height="3"/></g></g>`;
        svg.appendChild(g);
        const layer = svg.querySelector('.gm-route-layer');
        if (layer) layer.innerHTML = '';
        const marker = svg.querySelector('.gm-ship-marker');
        if (marker) marker.style.display = 'none';
        const trail = g.querySelector('.gm-travel-trail');
        const ship = g.querySelector('.gm-travel-ship');
        const ambush = Math.random() < this.ambushChance(current, { kind: kind, id: id });
        const stopAt = ambush ? 0.45 + Math.random() * 0.2 : 1;
        const duration = Math.max(700, Math.min(1800, dist * 5));
        this._flight = { kind: kind, id: id, from: from, to: to, g: g, trail: trail, ship: ship, duration: duration, t: 0 };
        this.statusMsg = '';
        this.runFlight(0, stopAt, () => {
            if (stopAt < 1) this.showAmbush();
            else this.finishFlight();
        });
    },

    /** Advance the flight from progress t0 to t1, then call done. */
    runFlight(t0, t1, done) {
        const f = this._flight;
        if (!f) return;
        const start = performance.now();
        const span = Math.max(1, f.duration * (t1 - t0));
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const step = (now) => {
            if (this._flight !== f) return;
            const local = Math.min(1, (now - start) / span);
            const t = t0 + (t1 - t0) * local;
            const e = ease(t);
            const x = f.from.x + (f.to.x - f.from.x) * e;
            const y = f.from.y + (f.to.y - f.from.y) * e;
            f.t = t;
            f.ship.setAttribute('transform', `translate(${x},${y})`);
            f.trail.setAttribute('x2', x);
            f.trail.setAttribute('y2', y);
            if (local < 1) requestAnimationFrame(step);
            else done();
        };
        requestAnimationFrame(step);
    },

    finishFlight() {
        const f = this._flight;
        this._flight = null;
        if (f && f.g && f.g.parentNode) f.g.parentNode.removeChild(f.g);
        if (f) this.commitFlight(f.kind, f.id);
    },

    showAmbush() {
        const f = this._flight;
        if (!f || !this.overlay) return;
        this._ambush = { kind: f.kind, id: f.id };
        const area = this.overlay.querySelector('#gmMapArea');
        if (!area) { this.resolveAmbush('evade'); return; }
        const box = document.createElement('div');
        box.className = 'gm-ambush';
        box.innerHTML = `<div class="gm-ambush-card">` +
            `<div class="gm-ambush-title">PIRATE AMBUSH</div>` +
            `<p>Raiders intercept your flight. Fight them off — or dump part of your stores and slip away.</p>` +
            `<div class="gm-ambush-actions">` +
            `<button type="button" class="action-button" data-ambush="fight" data-nav-item>FIGHT</button>` +
            `<button type="button" class="action-button secondary" data-ambush="evade" data-nav-item>EVADE · LOSE ~15% MATERIALS</button>` +
            `</div></div>`;
        area.appendChild(box);
        box.querySelectorAll('[data-ambush]').forEach((btn) => {
            btn.addEventListener('click', () => this.resolveAmbush(btn.getAttribute('data-ambush')));
        });
        const first = box.querySelector('[data-ambush="fight"]');
        if (first) first.focus();
    },

    /** 'fight' starts the ambush combat; 'evade' costs materials and flies on. */
    resolveAmbush(choice) {
        const amb = this._ambush;
        if (!amb) return;
        this._ambush = null;
        const box = this.overlay && this.overlay.querySelector('.gm-ambush');
        if (box) box.remove();
        if (choice === 'fight') {
            const f = this._flight;
            this._flight = null;
            if (f && f.g && f.g.parentNode) f.g.parentNode.removeChild(f.g);
            // You arrive afterwards either way; the fight happens en route.
            profileManager.setShipLocation(this.galaxyId, amb.kind, amb.id);
            const dest = amb.kind === 'planet' ? amb.id
                : ((profileManager.getTradingPost(amb.id) || {}).planetId || null);
            const cfg = planetConfigManager.createAmbushEncounter(this.galaxyId, dest, Date.now());
            const cb = this.onConfirm;
            if (!this._mountEl) this.hide();
            if (typeof cb === 'function') {
                cb({
                    galaxyId: this.galaxyId,
                    planetId: cfg.id,
                    levelId: cfg.id + '-1',
                    startMode: 'start',
                    name: cfg.name,
                    difficulty: cfg.difficulty,
                    description: cfg.description,
                    enemyCount: cfg.enemies.length,
                    unlocked: true
                });
            }
            return;
        }
        // Evade: jettison part of each material, then finish the flight.
        const lost = this.jettisonMaterials(0.15);
        this.statusMsg = lost ? ('EVADED RAIDERS · LOST ' + lost) : 'EVADED RAIDERS';
        const f = this._flight;
        if (!f) return;
        this.runFlight(f.t, 1, () => {
            this.finishFlight();
            const msg = this.overlay && this.overlay.querySelector('.gm-status-msg');
            if (msg) msg.textContent = this.statusMsg;
        });
    },

    /** Remove `share` of every station material; returns a short summary. */
    jettisonMaterials(share) {
        const p = typeof profileManager !== 'undefined' && profileManager.getActiveProfile();
        if (!p || !p.resources) return '';
        const parts = [];
        Object.keys(p.resources).forEach((id) => {
            const have = Number(p.resources[id]) || 0;
            const loss = Math.floor(have * share);
            if (loss <= 0) return;
            p.resources[id] = have - loss;
            parts.push(loss + ' ' + String(id).toUpperCase());
        });
        if (parts.length) profileManager.save();
        return parts.join(', ');
    },
});
