"use strict";

// Menu → PORTRAITS (dev mode): Face Editor (Flux + ComfyUI) + every pilot face
// of every faction in all five states — normal, wounded, dead, joy, anger.
extendClass(StartScreenManager, {
    fillEmbeddedPortraits(body) {
        const panel = document.createElement('div');
        panel.className = 'hs-menu-panel-section hs-portrait-states';
        body.appendChild(panel);

        const editor = document.createElement('div');
        editor.className = 'hs-portrait-face-editor';
        editor.innerHTML =
            '<h2 class="hs-menu-panel-section-title">FACE EDITOR</h2>' +
            '<p class="hs-menu-panel-copy">Flux + ComfyUI · reference image → img2img → assets/factions/*/portraits/</p>' +
            '<div class="hs-portrait-face-actions">' +
            '<button type="button" class="hs-portrait-face-open" id="hsFaceEditorOpen">OPEN FACE EDITOR ›</button>' +
            '</div>';
        panel.appendChild(editor);
        const openBtn = editor.querySelector('#hsFaceEditorOpen');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                if (this.openFaceEditor) this.openFaceEditor({ returnToSettings: false });
                else this.openAssetGenerator({ typeId: 'portrait', returnToSettings: false });
            });
        }

        if (typeof VXP === 'undefined' || !VXP.build) {
            const miss = document.createElement('p');
            miss.className = 'hs-menu-panel-copy';
            miss.textContent = 'Portrait preview generator not loaded.';
            panel.appendChild(miss);
            return;
        }
        const STATES = ['NORMAL', 'WOUNDED', 'DEAD', 'JOY', 'ANGER'];
        const FACTIONS = ['terran', 'pirate', 'kronax', 'voidborn', 'machine'];
        const gallery = document.createElement('div');
        gallery.className = 'hs-portrait-gallery';
        gallery.innerHTML =
            '<h2 class="hs-menu-panel-section-title">PILOT PORTRAITS</h2>' +
            `<p class="hs-menu-panel-copy">Each pilot: ${STATES.join(' · ')}.</p>` +
            FACTIONS.map((f) => `<section class="hs-portrait-faction"><h3 class="hs-menu-panel-section-title">${f.toUpperCase()}</h3><div class="hs-portrait-grid" data-faction="${f}"></div></section>`).join('');
        panel.appendChild(gallery);
        // Built a faction per frame so opening the tab never stalls on 400 portraits at once.
        let fi = 0;
        const next = () => {
            if (fi >= FACTIONS.length || !panel.isConnected) return;
            const f = FACTIONS[fi++];
            const grid = gallery.querySelector(`.hs-portrait-grid[data-faction="${f}"]`);
            for (let v = 0; v < VXP.COUNT; v++) {
                const card = document.createElement('div');
                card.className = 'hs-portrait-card';
                const preset = VXP.preset(f, v);
                STATES.forEach((label, s) => {
                    const c = document.createElement('canvas');
                    c.width = VXP.W;
                    c.height = VXP.H;
                    c.title = `${f} #${v + 1} · ${label}`;
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
