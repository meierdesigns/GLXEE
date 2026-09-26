"use strict";

// PlanetSVGManager methods, split from planet-svgs.js.
extendClass(PlanetSVGManager, {
    getPlanetSVG(planetName) {
        const id = String(planetName || '').toLowerCase();
        if (!id) return '';
        if (this.planets[id]) return this.planets[id];
        return this.ensurePlanetGraphic(id) || '';
    },

    /**
     * Higher-resolution version of a planet for large views (sector card).
     * detail multiplies the 16px grid; falls back to the icon if unknown.
     */
    getPlanetSVGDetailed(planetName, detail) {
        const id = String(planetName || '').toLowerCase();
        const k = Math.max(1, Math.round(detail || 1));
        const base = this.getPlanetSVG(id);
        if (k === 1 || !base) return base;
        const spec = this.planetSpecs && this.planetSpecs[id];
        if (!spec) return base;
        this.planetsDetailed = this.planetsDetailed || {};
        const key = id + '@' + k;
        if (!this.planetsDetailed[key]) {
            this.planetsDetailed[key] = this.createPixelPlanetSVG(
                id, spec.style, spec.seed, spec.baseColor, spec.features, k);
        }
        return this.planetsDetailed[key];
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
