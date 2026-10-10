"use strict";

// Generative galaxy icon: a 64x64 pixel disc drawn from the galaxy's real data, so every galaxy looks different.
//   spiral arms   — count / twist seeded by the galaxy id, tinted by the ruling faction
//   planet pixels — the galaxy's real map nodes + links, each in its planet's faction colour (home planet larger)
//   rim           — split into arcs by faction share (full ring when held)
const galaxyIcon = {
    _cache: {},
    SIZE: 64,

    hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    },

    rng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    factionColor(fid) {
        const st = typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle ? factionShipStyles.getFactionStyle(fid) : null;
        return (st && (st.accent || st.hull)) || '#7ec8ff';
    },

    /** PNG data URL for a galaxy id (cached per id + content signature). */
    dataUrl(gid) {
        const pcm = typeof planetConfigManager !== 'undefined' ? planetConfigManager : null;
        if (!pcm || typeof document === 'undefined') return '';
        const map = (pcm.getGalaxyMap && pcm.getGalaxyMap(gid)) || {};
        const nodes = map.nodes || [];
        const ctl = pcm.getGalaxyControl ? pcm.getGalaxyControl(gid) : { main: 'pirate', factions: [{ id: 'pirate', share: 1 }] };
        const sig = gid + '|' + nodes.map((n) => n.planetId).join(',') + '|' + ctl.factions.map((f) => f.id + f.share).join(',');
        if (this._cache[sig]) return this._cache[sig];

        const S = this.SIZE;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const g = c.getContext('2d');
        const R = this.rng(this.hash('galaxy-icon|' + gid));
        const mid = S / 2;
        const px = (x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
        const main = this.factionColor(ctl.main);

        // disc
        g.fillStyle = '#070a12';
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            if (Math.hypot(x + 0.5 - mid, y + 0.5 - mid) <= 29.5) g.fillRect(x, y, 1, 1);
        }
        // spiral arms
        const arms = 2 + Math.floor(R() * 3);
        const twist = 1.4 + R() * 2.2;
        const tilt = R() * Math.PI * 2;
        const dense = Math.min(1, 0.45 + nodes.length / 14);
        g.globalAlpha = 0.55;
        for (let a = 0; a < arms; a++) {
            for (let i = 0; i < 90 * dense + 40; i++) {
                const t = R();
                const r = 3 + t * 26;
                const ang = tilt + (a / arms) * Math.PI * 2 + t * twist * Math.PI + (R() - 0.5) * 0.5;
                px(mid + Math.cos(ang) * r, mid + Math.sin(ang) * r, R() < 0.25 ? '#ffffff' : main);
            }
        }
        g.globalAlpha = 1;
        // core glow
        for (let r = 5; r > 0; r--) {
            g.globalAlpha = 0.12 + (5 - r) * 0.1;
            g.fillStyle = main;
            g.beginPath(); g.arc(mid, mid, r, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;

        // map links + planets, in the real layout
        const pos = {};
        nodes.forEach((n) => { pos[n.planetId] = [mid + (n.x - 0.5) * 48, mid + (n.y - 0.5) * 48]; });
        g.globalAlpha = 0.5;
        (map.edges || []).forEach((e) => {
            const a = pos[e[0]]; const b = pos[e[1]];
            if (!a || !b) return;
            const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
            for (let i = 0; i <= steps; i += 2) px(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps, '#cfe8ff');
        });
        g.globalAlpha = 1;
        nodes.forEach((n) => {
            const p = pos[n.planetId];
            const home = n.planetId === map.startPlanetId;
            const fid = (pcm.getPlanetFactions && pcm.getPlanetFactions(n.planetId)[0]) || ctl.main;
            const s = home ? 4 : 3;
            const x = Math.round(p[0] - s / 2); const y = Math.round(p[1] - s / 2);
            g.fillStyle = '#05060a';
            g.fillRect(x - 1, y - 1, s + 2, s + 2);
            g.fillStyle = this.factionColor(fid);
            g.fillRect(x, y, s, s);
            if (home) { g.fillStyle = '#ffffff'; g.fillRect(x + 1, y + 1, 2, 2); }
        });

        // rim split by faction share
        let from = -Math.PI / 2;
        ctl.factions.forEach((f) => {
            const to = from + f.share * Math.PI * 2;
            g.strokeStyle = this.factionColor(f.id);
            g.lineWidth = 2;
            g.beginPath(); g.arc(mid, mid, 30.5, from, to - (ctl.factions.length > 1 ? 0.06 : 0)); g.stroke();
            from = to;
        });
        return (this._cache[sig] = c.toDataURL());
    },

    html(gid, size) {
        const url = this.dataUrl(gid);
        const px = size || 64;
        return url ? `<img class="hs-galaxy-icon" src="${url}" width="${px}" height="${px}" alt="" style="image-rendering:pixelated">` : '';
    }
};
