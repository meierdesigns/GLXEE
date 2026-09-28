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

    /**
     * Route polyline from one location to another that bends around every
     * other planet / station instead of cutting through them: while a leg
     * passes within an obstacle's radius, a waypoint is inserted beside that
     * obstacle (on the side the leg already passes). SVG coords.
     */
    routePath(fromLoc, toLoc) {
        const from = this.locationPoint(fromLoc);
        const to = this.locationPoint(toLoc);
        if (!from || !to) return null;
        const skip = (kind, id) => (fromLoc.kind === kind && fromLoc.id === id) || (toLoc.kind === kind && toLoc.id === id);
        const obstacles = [];
        (this.nodes || Object.values(this.nodeById || {})).forEach((n) => {
            if (skip('planet', n.planetId)) return;
            const p = this.locationPoint({ kind: 'planet', id: n.planetId });
            if (p) obstacles.push({ x: p.x, y: p.y, r: 34 });
        });
        (this.getTradingPosts() || []).forEach((post) => {
            if (skip('post', post.id)) return;
            const p = this.locationPoint({ kind: 'post', id: post.id });
            if (p) obstacles.push({ x: p.x, y: p.y, r: 22 });
        });
        const pts = [from, to];
        for (let iter = 0; iter < 12; iter++) {
            let hit = null;
            for (let i = 0; i < pts.length - 1 && !hit; i++) {
                const a = pts[i];
                const b = pts[i + 1];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len2 = dx * dx + dy * dy || 1;
                let best = null;
                obstacles.forEach((o) => {
                    const t = ((o.x - a.x) * dx + (o.y - a.y) * dy) / len2;
                    if (t <= 0.02 || t >= 0.98) return;
                    const px = a.x + dx * t;
                    const py = a.y + dy * t;
                    const d = Math.hypot(o.x - px, o.y - py);
                    if (d < o.r && (!best || t < best.t)) best = { o, t, px, py, d };
                });
                if (best) hit = { i, best, dx, dy };
            }
            if (!hit) break;
            const { o, px, py, d } = hit.best;
            // Push out from the obstacle centre towards where the leg passes;
            // dead-centre hits go sideways (perpendicular to the leg).
            let nx = px - o.x;
            let ny = py - o.y;
            if (d < 0.5) {
                const l = Math.hypot(hit.dx, hit.dy) || 1;
                nx = -hit.dy / l;
                ny = hit.dx / l;
            } else {
                nx /= d;
                ny /= d;
            }
            pts.splice(hit.i + 1, 0, { x: o.x + nx * (o.r + 8), y: o.y + ny * (o.r + 8) });
        }
        return pts;
    },

    /** Point + heading at progress e (0..1) along a polyline, by arc length. */
    pointOnPath(pts, e) {
        const lens = [];
        let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
            lens.push(l);
            total += l;
        }
        let dist = Math.max(0, Math.min(1, e)) * total;
        for (let i = 0; i < lens.length; i++) {
            if (dist <= lens[i] || i === lens.length - 1) {
                const k = lens[i] ? Math.min(1, dist / lens[i]) : 0;
                const a = pts[i];
                const b = pts[i + 1];
                return {
                    x: a.x + (b.x - a.x) * k,
                    y: a.y + (b.y - a.y) * k,
                    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90,
                    seg: i
                };
            }
            dist -= lens[i];
        }
        return { x: pts[0].x, y: pts[0].y, angle: 0, seg: 0 };
    },

    /** Dashed route from the ship to the selected target, "!" if pirates prowl it. */
    routePreviewSvg() {
        const current = (typeof profileManager !== 'undefined' && profileManager.getShipLocation)
            ? profileManager.getShipLocation(this.galaxyId) : null;
        const target = this.selectedPostId
            ? { kind: 'post', id: this.selectedPostId }
            : (this.selectedPlanetId ? { kind: 'planet', id: this.selectedPlanetId } : null);
        if (!current || !target || (current.kind === target.kind && current.id === target.id)) return '';
        // No route to a planet the ship can't reach.
        if (target.kind === 'planet' && !this.isUnlocked(target.id)) return '';
        // …or to a station / trading post that is still locked.
        if (target.kind === 'post') {
            const post = this.getTradingPosts().find((p) => p.id === target.id);
            if (!post || !profileManager.isTradingPostUnlocked(post)) return '';
        }
        const pts = this.routePath(current, target);
        if (!pts) return '';
        const risky = this.isRouteRisky(current, target);
        const mid = this.pointOnPath(pts, 0.5);
        const mx = mid.x;
        const my = mid.y;
        return `<polyline class="gm-route ${risky ? 'risky' : ''}" fill="none" points="${pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}"/>` +
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
        // Same obstacle-avoiding path as the route preview.
        const path = this.routePath(current, { kind: kind, id: id }) || [from, to];
        let dist = 0;
        for (let i = 0; i < path.length - 1; i++) dist += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
        const angle = this.pointOnPath(path, 0).angle; // ship art points up
        const icon = this.getShipIconUrl && this.getShipIconUrl();
        const shipSvg = icon
            ? `<image href="${icon}" x="-5.5" y="-7.5" width="11" height="15" class="gm-ship-marker-img"/>`
            : '<path d="M0 -7 L6 6 L0 3 L-6 6 Z" class="gm-ship-marker-body"/>';
        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'gm-ship-travel');
        g.innerHTML = `<polyline class="gm-travel-trail" fill="none" points="${from.x},${from.y}"/>` +
            `<g class="gm-travel-ship"><g class="gm-travel-heading" transform="rotate(${angle})">${shipSvg}<rect class="gm-travel-thrust" x="-1.5" y="7" width="3" height="3"/></g></g>`;
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
        this._flight = { kind: kind, id: id, from: from, to: to, path: path, g: g, trail: trail, ship: ship,
            heading: g.querySelector('.gm-travel-heading'), duration: duration, t: 0 };
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
            const path = f.path || [f.from, f.to];
            const at = this.pointOnPath(path, e);
            f.t = t;
            f.ship.setAttribute('transform', `translate(${at.x},${at.y})`);
            if (f.heading) f.heading.setAttribute('transform', `rotate(${at.angle})`);
            // Trail: the path's corners passed so far, then the ship.
            const trailPoints = path.slice(0, at.seg + 1).map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1));
            trailPoints.push(at.x.toFixed(1) + ',' + at.y.toFixed(1));
            f.trail.setAttribute('points', trailPoints.join(' '));
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
