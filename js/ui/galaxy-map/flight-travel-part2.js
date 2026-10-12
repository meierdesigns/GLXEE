"use strict";

// GalaxyMapManager members, continued from flight-travel.js (kept under ~500 lines per file).
extendClass(GalaxyMapManager, {
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
    },
});
