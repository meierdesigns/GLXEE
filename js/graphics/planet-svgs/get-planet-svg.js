"use strict";

// PlanetSVGManager methods, split from planet-svgs.js.
extendClass(PlanetSVGManager, {
    getPlanetSVG(planetName) {
        const id = String(planetName || '').toLowerCase();
        if (!id) return '';
        if (this.planets[id]) return this.planets[id];
        return this.ensurePlanetGraphic(id) || '';
    },

    getPlanetDataURL(planetName) {
        const svg = this.getPlanetSVG(planetName);
        if (svg) {
            const encoded = encodeURIComponent(svg);
            return `data:image/svg+xml,${encoded}`;
        }
        return '';
    },
});
