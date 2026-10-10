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
            x: GM_MAP_W / 2 + (at.x - 0.5) * (GM_MAP_W - GM_MAP_PAD * 2) * 2.0,
            y: GM_MAP_H / 2 + (at.y - 0.5) * (GM_MAP_H - GM_MAP_PAD * 2) * 2.0
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
            if (p) obstacles.push({ x: p.x, y: p.y, r: 30 });
        });
        (this.getTradingPosts() || []).forEach((post) => {
            if (skip('post', post.id)) return;
            const p = this.locationPoint({ kind: 'post', id: post.id });
            if (p) obstacles.push({ x: p.x, y: p.y, r: 20 });
        });
        // Elegant detour: one symmetric quadratic arc, bowed just far enough to clear every obstacle.
        const clear = (path, pad) => obstacles.every((o) => path.every((q) => Math.hypot(q.x - o.x, q.y - o.y) >= o.r + pad));
        const straight = [from, to];
        const sample = (h, side) => {
            const dx = to.x - from.x, dy = to.y - from.y;
            const L = Math.hypot(dx, dy) || 1;
            const nx = -dy / L * side, ny = dx / L * side;
            const cx = (from.x + to.x) / 2 + nx * 2 * h, cy = (from.y + to.y) / 2 + ny * 2 * h;
            const path = [];
            const n = Math.max(8, Math.ceil(L / 8));
            for (let k = 0; k <= n; k++) {
                const t = k / n, u = 1 - t;
                path.push({ x: u * u * from.x + 2 * u * t * cx + t * t * to.x, y: u * u * from.y + 2 * u * t * cy + t * t * to.y });
            }
            return path;
        };
        if (!clear([from, to].concat((() => { const m = []; for (let k = 1; k < 40; k++) m.push({ x: from.x + (to.x - from.x) * k / 40, y: from.y + (to.y - from.y) * k / 40 }); return m; })()), 4)) {
            const L = Math.hypot(to.x - from.x, to.y - from.y) || 1;
            let best = null;
            for (const side of [1, -1]) {
                for (let h = 8; h <= L * 0.45; h += 4) {
                    const path = sample(h, side);
                    if (clear(path, 10)) {
                        if (!best || h < best.h) best = { h, path };
                        break;
                    }
                }
            }
            if (best) return best.path;
        } else {
            return straight;
        }
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
            pts.splice(hit.i + 1, 0, { x: o.x + nx * (o.r + 16), y: o.y + ny * (o.r + 16) });
        }
        // A direct route stays a straight line; only detours around obstacles get rounded corners.
        if (pts.length === 2) return pts;
        // Catmull-Rom spline through the waypoints: one smooth arc around each obstacle.
        const out = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
            const n = Math.max(6, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 10));
            for (let k = 1; k <= n; k++) {
                const t = k / n, t2 = t * t, t3 = t2 * t;
                const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
                out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
            }
        }
        return out;
    },

    /** Cuts `head` map units off the start and `tail` off the end of a polyline (by arc length). */
    trimPolyline(pts, head, tail) {
        let out = pts.slice();
        const cut = (list, d) => {
            let rest = d;
            while (list.length > 2) {
                const l = Math.hypot(list[1].x - list[0].x, list[1].y - list[0].y);
                if (l > rest) break;
                rest -= l;
                list.shift();
            }
            const l = Math.hypot(list[1].x - list[0].x, list[1].y - list[0].y) || 1;
            const k = Math.min(0.9, rest / l);
            list[0] = { x: list[0].x + (list[1].x - list[0].x) * k, y: list[0].y + (list[1].y - list[0].y) * k };
            return list;
        };
        if (head > 0) out = cut(out, head);
        if (tail > 0) out = cut(out.reverse(), tail).reverse();
        return out;
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
        // Ambushes are hidden events; route appearance must not reveal them.
        const risky = false;
        const mid = this.pointOnPath(pts, 0.5);
        const mx = mid.x;
        const my = mid.y;
        // Start / end on the planet surface, not at its centre (measured along the curve).
        const surf = (loc) => (loc && loc.kind === 'planet' && this.planetSurfaceRadius)
            ? this.planetSurfaceRadius(loc.id) * (this.nodeObjScale ? this.nodeObjScale() : 1) * 0.88 : 0;
        const line = this.trimPolyline(pts, surf(current), surf(target));
        return this.pixelLineSvg(line, 'gm-route' + (risky ? ' risky' : ''), { run: true, width: 2.2 }) +
            (risky ? `<g class="gm-route-warn" transform="translate(${mx},${my})">` +
                `<title>PIRATE ROUTE · AMBUSH POSSIBLE</title>` +
                `<path d="M0 -9 L9 7 L-9 7 Z"/><text x="0" y="5">!</text></g>` : '');
    },

    /** [shipPlanetId, selectedPlanetId] while a planet-to-planet route preview is shown, else null. */
    routeEdgeIds() {
        if (this._flight || typeof profileManager === 'undefined' || !profileManager.getShipLocation) return null;
        const cur = profileManager.getShipLocation(this.galaxyId);
        if (!cur || cur.kind !== 'planet' || this.selectedPostId || !this.selectedPlanetId
            || cur.id === this.selectedPlanetId || !this.isUnlocked(this.selectedPlanetId)) return null;
        return [cur.id, this.selectedPlanetId];
    },

    syncRoutePreview() {
        const layer = this.overlay && this.overlay.querySelector('.gm-route-layer');
        if (this.overlay) {
            const ids = this.routeEdgeIds();
            this.overlay.querySelectorAll('.gm-edge.on-route').forEach((el) => el.classList.remove('on-route'));
            if (ids) this.overlay.querySelectorAll('.gm-edge.gm-e-' + ids[0] + '.gm-e-' + ids[1]).forEach((el) => el.classList.add('on-route'));
        }
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
        const originalViewBox = svg && svg.getAttribute('viewBox');
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
            ? `<image href="${icon}" ${this.shipIconBox().attrs} class="gm-ship-marker-img"/>`
            : '<path d="M0 -7 L6 6 L0 3 L-6 6 Z" class="gm-ship-marker-body"/>';
        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'gm-ship-travel');
        g.innerHTML = `<polyline class="gm-travel-trail" fill="none" points="${from.x},${from.y}"/>` +
            `<g class="gm-travel-ship"><g class="gm-travel-heading" transform="rotate(${angle})">${shipSvg}${this.shipThrustRect()}</g></g>`;
        svg.appendChild(g);
        const layer = svg.querySelector('.gm-route-layer');
        if (layer) layer.innerHTML = '';
        const marker = svg.querySelector('.gm-ship-marker');
        if (marker) marker.style.display = 'none';
        const trail = g.querySelector('.gm-travel-trail');
        const ship = g.querySelector('.gm-travel-ship');
        const ambush = !this._skipAmbushOnce
            && Math.random() < this.ambushChance(current, { kind: kind, id: id });
        this._skipAmbushOnce = false;
        const stopAt = ambush ? 0.45 + Math.random() * 0.2 : 1;
        const duration = Math.max(1800, Math.min(5000, dist * 12));
        this._flight = { kind: kind, id: id, origin: current, from: from, to: to, path: path, g: g, trail: trail, ship: ship,
            heading: g.querySelector('.gm-travel-heading'), duration: duration, t: 0, svg: svg, originalViewBox: originalViewBox };
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
            const vb = (f.originalViewBox || '').trim().split(/\s+/).map(Number);
            if (vb.length === 4 && vb.every(Number.isFinite)) {
                f.svg.setAttribute('viewBox', `${at.x - vb[2] / 2} ${at.y - vb[3] / 2} ${vb[2]} ${vb[3]}`);
            }
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
        if (f && f.svg) {
            const vb = f.svg.viewBox && f.svg.viewBox.baseVal;
            if (f.to && Number.isFinite(f.to.x) && Number.isFinite(f.to.y)
                && vb && Number.isFinite(vb.width) && Number.isFinite(vb.height)) {
                this._panAnchor = { x: f.to.x, y: f.to.y };
                this.mapPan = null;
            } else if (vb && Number.isFinite(vb.x) && Number.isFinite(vb.y)
                && Number.isFinite(vb.width) && Number.isFinite(vb.height)) {
                // Keep the camera at the destination when commitFlight rebuilds
                // the map instead of restoring the pre-flight viewBox.
                this._panAnchor = {
                    x: vb.x + vb.width / 2,
                    y: vb.y + vb.height / 2
                };
                this.mapPan = null;
            }
        }
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
        const psm = typeof profileSelectionManager !== 'undefined' ? profileSelectionManager : null;
        const art = psm && psm.getFactionEmblemHtml ? psm.getFactionEmblemHtml('pirate', 112, 4) : '';
        box.innerHTML = `<div class="gm-ambush-card">` +
            `<div class="gm-ambush-art" aria-hidden="true">${art}</div>` +
            `<div class="gm-ambush-title">PIRATE AMBUSH</div>` +
            `<p>Raiders intercept your flight. Fight them off — or dump part of your stores and slip away.</p>` +
            `<div class="gm-ambush-actions">` +
            `<button type="button" class="action-button secondary gm-ambush-btn" data-ambush="evade" data-nav-item>` +
            `<span class="gm-ambush-lbl">EVADE</span><span class="gm-ambush-info">LOSE ~15% MATERIALS</span></button>` +
            `<button type="button" class="action-button gm-ambush-btn" data-ambush="fight" data-nav-item>FIGHT</button>` +
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
            const dest = amb.kind === 'planet' ? amb.id
                : ((profileManager.getTradingPost(amb.id) || {}).planetId || null);
            // The ambush is temporary; keep the real destination as the
            // return focus so planet selection opens on the same location.
            if (dest) {
                profileManager.setShipLocation(this.galaxyId, 'planet', dest);
            }
            const cfg = planetConfigManager.createAmbushEncounter(this.galaxyId, dest, Date.now());
            this._postAmbushFlight = f;
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

    /**
     * Ambush lost: the ship limps back to where the flight started. Shows
     * the flight from the ambush point back along the same route (the map
     * may still be mounting, so wait for its SVG first).
     */
    retreatAfterAmbush(f) {
        const origin = f && f.origin;
        if (!origin || typeof profileManager === 'undefined') return false;
        // Back at the last station even if the animation can't run.
        profileManager.setShipLocation(this.galaxyId, origin.kind, origin.id);
        let tries = 0;
        const start = () => {
            const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!svg || this._flight || this._ambush) {
                if (++tries < 120) { requestAnimationFrame(start); return; }
                if (!this._flight) this.commitFlight(origin.kind, origin.id);
                return;
            }
            const path = (f.path || [f.from, f.to]).slice().reverse();
            const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (path.length < 2 || reduced) { this.commitFlight(origin.kind, origin.id); return; }
            const icon = this.getShipIconUrl && this.getShipIconUrl();
            const shipSvg = icon
                ? `<image href="${icon}" ${this.shipIconBox().attrs} class="gm-ship-marker-img"/>`
                : '<path d="M0 -7 L6 6 L0 3 L-6 6 Z" class="gm-ship-marker-body"/>';
            // Easing is symmetric, so 1 - t on the reversed path is the ambush point.
            const t0 = Math.max(0, Math.min(1, 1 - (Number(f.t) || 0.5)));
            const at = this.pointOnPath(path, t0 < 0.5 ? 2 * t0 * t0 : 1 - Math.pow(-2 * t0 + 2, 2) / 2);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'gm-ship-travel gm-ship-retreat');
            g.innerHTML = `<polyline class="gm-travel-trail" fill="none" points="${at.x},${at.y}"/>` +
                `<g class="gm-travel-ship" transform="translate(${at.x},${at.y})"><g class="gm-travel-heading" transform="rotate(${at.angle})">${shipSvg}${this.shipThrustRect()}</g></g>`;
            svg.appendChild(g);
            const layer = svg.querySelector('.gm-route-layer');
            if (layer) layer.innerHTML = '';
            const marker = svg.querySelector('.gm-ship-marker');
            if (marker) marker.style.display = 'none';
            this._flight = {
                kind: origin.kind, id: origin.id, from: path[0], to: path[path.length - 1], path: path,
                g: g, trail: g.querySelector('.gm-travel-trail'), ship: g.querySelector('.gm-travel-ship'),
                heading: g.querySelector('.gm-travel-heading'), duration: f.duration || 3000, t: t0,
                svg: svg, originalViewBox: svg.getAttribute('viewBox')
            };
            this.statusMsg = 'AMBUSH LOST · RETURNING TO LAST STATION';
            const msg = this.overlay.querySelector('.gm-status-msg');
            if (msg) msg.textContent = this.statusMsg;
            this.runFlight(t0, 1, () => {
                this.finishFlight();
                const m = this.overlay && this.overlay.querySelector('.gm-status-msg');
                if (m) m.textContent = 'AMBUSH LOST · BACK AT LAST STATION';
            });
        };
        requestAnimationFrame(start);
        return true;
    },

    /**
     * Ambush won: the ship continues from the spot where it was intercepted
     * along the same route to the original destination (waits for the map SVG).
     */
    resumeAfterAmbush(f) {
        if (!f || !f.path || typeof profileManager === 'undefined') return false;
        const dest = { kind: f.kind, id: f.id };
        let tries = 0;
        const start = () => {
            const svg = this.overlay && this.overlay.querySelector('.galaxy-map-svg');
            if (!svg || this._flight || this._ambush) {
                if (++tries < 120) { requestAnimationFrame(start); return; }
                if (!this._flight) this.commitFlight(dest.kind, dest.id);
                return;
            }
            const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduced) { this.commitFlight(dest.kind, dest.id); return; }
            const icon = this.getShipIconUrl && this.getShipIconUrl();
            const shipSvg = icon
                ? `<image href="${icon}" ${this.shipIconBox().attrs} class="gm-ship-marker-img"/>`
                : '<path d="M0 -7 L6 6 L0 3 L-6 6 Z" class="gm-ship-marker-body"/>';
            const t0 = Math.max(0, Math.min(1, Number(f.t) || 0));
            const e0 = t0 < 0.5 ? 2 * t0 * t0 : 1 - Math.pow(-2 * t0 + 2, 2) / 2;
            const at = this.pointOnPath(f.path, e0);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'gm-ship-travel');
            const done = f.path.slice(0, at.seg + 1).map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1));
            done.push(at.x.toFixed(1) + ',' + at.y.toFixed(1));
            g.innerHTML = `<polyline class="gm-travel-trail" fill="none" points="${done.join(' ')}"/>` +
                `<g class="gm-travel-ship" transform="translate(${at.x},${at.y})"><g class="gm-travel-heading" transform="rotate(${at.angle})">${shipSvg}${this.shipThrustRect()}</g></g>`;
            svg.appendChild(g);
            const layer = svg.querySelector('.gm-route-layer');
            if (layer) layer.innerHTML = '';
            const marker = svg.querySelector('.gm-ship-marker');
            if (marker) marker.style.display = 'none';
            this._flight = {
                kind: dest.kind, id: dest.id, origin: f.origin, from: f.from, to: f.to, path: f.path,
                g: g, trail: g.querySelector('.gm-travel-trail'), ship: g.querySelector('.gm-travel-ship'),
                heading: g.querySelector('.gm-travel-heading'), duration: f.duration || 3000, t: t0,
                svg: svg, originalViewBox: svg.getAttribute('viewBox')
            };
            this.runFlight(t0, 1, () => this.finishFlight());
        };
        requestAnimationFrame(start);
        return true;
    },

    continueAfterAmbush() {
        const f = this._postAmbushFlight;
        if (!f) return false;
        this._postAmbushFlight = null;
        this._flight = f;
        this.runFlight(f.t, 1, () => this.finishFlight());
        return true;
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

    /** Engine flame block at the ship's tail, built from the same map pixel as the hull. */
    shipThrustRect() {
        const b = this.shipIconBox(), u = this.mapPixelUnitGlobal();
        return `<rect class="gm-travel-thrust" x="${(-1.5 * u).toFixed(3)}" y="${(b.h / 2 - u).toFixed(3)}" width="${(3 * u).toFixed(3)}" height="${(3 * u).toFixed(3)}"/>`;
    }
});
