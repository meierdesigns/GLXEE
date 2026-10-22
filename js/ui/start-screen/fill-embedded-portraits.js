"use strict";

// Menu → PORTRAITS (dev mode): every pilot face of every faction in all five
// states side by side — normal, wounded, dead, joy, anger (VXP.build state 0..4).
extendClass(StartScreenManager, {
    fillEmbeddedPortraits(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section hs-portrait-states';
        body.appendChild(panel);
        if (typeof VXP === 'undefined' || !VXP.build) {
            panel.innerHTML = '<p class="hs-menu-panel-copy">Portrait generator not loaded.</p>';
            return;
        }
        const STATES = ['NORMAL', 'WOUNDED', 'DEAD', 'JOY', 'ANGER'];
        const FACTIONS = ['terran', 'pirate', 'kronax', 'voidborn', 'machine'];
        panel.innerHTML =
            '<h2 class="hs-menu-panel-section-title">PILOT PORTRAITS</h2>' +
            `<p class="hs-menu-panel-copy">Each pilot: ${STATES.join(' · ')}.</p>` +
            FACTIONS.map((f) => `<section class="hs-portrait-faction"><h3 class="hs-menu-panel-section-title">${f.toUpperCase()}</h3><div class="hs-portrait-grid" data-faction="${f}"></div></section>`).join('');
        // Built a faction per frame so opening the tab never stalls on 400 portraits at once.
        let fi = 0;
        const next = () => {
            if (fi >= FACTIONS.length || !panel.isConnected) return;
            const f = FACTIONS[fi++], grid = panel.querySelector(`.hs-portrait-grid[data-faction="${f}"]`);
            for (let v = 0; v < VXP.COUNT; v++) {
                const card = document.createElement('div');
                card.className = 'hs-portrait-card';
                const preset = VXP.preset(f, v);
                STATES.forEach((label, s) => {
                    const c = document.createElement('canvas');
                    c.width = VXP.W; c.height = VXP.H; c.title = `${f} #${v + 1} · ${label}`;
                    c.getContext('2d').putImageData(new ImageData(VXP.build(preset, null, false, false, s), VXP.W, VXP.H), 0, 0);
                    card.appendChild(c);
                });
                grid.appendChild(card);
            }
            requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
    }
});
