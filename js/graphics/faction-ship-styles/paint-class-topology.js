"use strict";

// FactionShipStyles methods, split from faction-ship-styles.js.
extendClass(FactionShipStyles, {
    /**
     * Class = topology. Same pixel budget for all — never “one more tip”.
     * Grid origin: nose toward smaller row index.
     */
    paintClassTopology(g, enemyClass, cx) {
        const cls = this.normalizeClass(enemyClass);
        switch (cls) {
            case 'scout': {
                // Needle: 1–2 px spine, no wings
                this.fillRect(g, cx - 1, 2, 2, 1, 1);
                this.fillRect(g, cx - 1, 3, 2, 6, 2);
                this.fillRect(g, cx, 4, 1, 4, 3);
                this.setPx(g, cx, 9, 3);
                this.setPx(g, cx, 10, 2);
                break;
            }
            case 'assault': {
                // Delta: triangular mid-wings, solid core
                this.fillRect(g, cx - 2, 2, 4, 1, 1);
                this.fillRect(g, cx - 3, 3, 6, 5, 2);
                this.fillRect(g, cx - 2, 4, 4, 3, 3);
                this.fillRect(g, cx - 5, 5, 2, 2, 2);
                this.fillRect(g, cx + 3, 5, 2, 2, 2);
                this.setPx(g, cx - 1, 9, 3);
                this.setPx(g, cx + 1, 9, 3);
                this.setPx(g, cx - 1, 10, 2);
                this.setPx(g, cx + 1, 10, 2);
                break;
            }
            case 'heavy': {
                // Blunt brick + side turret stubs (no pointed nose)
                this.fillRect(g, cx - 5, 3, 10, 6, 2);
                this.fillRect(g, cx - 4, 4, 8, 4, 3);
                this.fillRect(g, cx - 6, 4, 1, 2, 1);
                this.fillRect(g, cx + 5, 4, 1, 2, 1);
                this.fillRect(g, cx - 6, 5, 1, 1, 2);
                this.fillRect(g, cx + 5, 5, 1, 1, 2);
                this.fillRect(g, cx - 3, 9, 2, 1, 3);
                this.fillRect(g, cx + 1, 9, 2, 1, 3);
                this.fillRect(g, cx - 3, 10, 2, 1, 2);
                this.fillRect(g, cx + 1, 10, 2, 1, 2);
                break;
            }
            case 'elite': {
                // X / fork: twin nose prongs + diagonal fins + center gap
                this.setPx(g, cx - 2, 1, 1);
                this.setPx(g, cx + 2, 1, 1);
                this.setPx(g, cx - 1, 2, 2);
                this.setPx(g, cx + 1, 2, 2);
                this.fillRect(g, cx - 3, 3, 2, 4, 2);
                this.fillRect(g, cx + 1, 3, 2, 4, 2);
                this.fillRect(g, cx - 1, 4, 2, 2, 3);
                this.setPx(g, cx - 5, 4, 1);
                this.setPx(g, cx - 4, 5, 2);
                this.setPx(g, cx + 4, 4, 1);
                this.setPx(g, cx + 3, 5, 2);
                this.setPx(g, cx - 5, 6, 1);
                this.setPx(g, cx + 5, 6, 1);
                this.setPx(g, cx - 2, 8, 2);
                this.setPx(g, cx + 2, 8, 2);
                this.setPx(g, cx - 2, 9, 3);
                this.setPx(g, cx + 2, 9, 3);
                this.setPx(g, cx - 2, 10, 2);
                this.setPx(g, cx + 2, 10, 2);
                break;
            }
            case 'capital':
            default: {
                // Dual-hull / catamaran deck — different topology from heavy brick
                this.fillRect(g, cx - 7, 3, 3, 5, 2);
                this.fillRect(g, cx + 4, 3, 3, 5, 2);
                this.fillRect(g, cx - 4, 4, 8, 4, 2);
                this.fillRect(g, cx - 3, 5, 6, 2, 3);
                this.fillRect(g, cx - 6, 2, 2, 1, 1);
                this.fillRect(g, cx + 4, 2, 2, 1, 1);
                this.setPx(g, cx - 7, 8, 3);
                this.setPx(g, cx - 5, 8, 3);
                this.setPx(g, cx + 4, 8, 3);
                this.setPx(g, cx + 6, 8, 3);
                this.setPx(g, cx - 7, 9, 2);
                this.setPx(g, cx - 5, 9, 2);
                this.setPx(g, cx + 4, 9, 2);
                this.setPx(g, cx + 6, 9, 2);
                break;
            }
        }
    },

    /** Faction remorphs topology — never color, never tip-stacking. */
    paintFactionMorph(g, silhouette, enemyClass, cx, seed) {
        const cls = this.normalizeClass(enemyClass);
        switch (silhouette) {
            case 'modular': {
                // Step sides into plate blocks
                for (let r = 3; r <= 8; r++) {
                    if (r % 2 === 0) {
                        this.setPx(g, cx - 4 - (cls === 'capital' ? 2 : 0), r, 1);
                        this.setPx(g, cx + 3 + (cls === 'capital' ? 2 : 0), r, 1);
                    }
                }
                if (cls === 'assault' || cls === 'heavy') {
                    this.fillRect(g, cx - 1, 4, 2, 2, 3);
                }
                break;
            }
            case 'spikes': {
                // Replace soft wings with diagonal claws
                this.setPx(g, cx - 4, 3, 1);
                this.setPx(g, cx - 5, 4, 1);
                this.setPx(g, cx - 6, 5, 2);
                this.setPx(g, cx + 3, 3, 1);
                this.setPx(g, cx + 4, 4, 1);
                this.setPx(g, cx + 5, 5, 2);
                if (cls !== 'scout') {
                    this.setPx(g, cx - 3, 2, 1);
                    this.setPx(g, cx + 3, 2, 1);
                }
                break;
            }
            case 'rings': {
                // Hollow / arc — punch center, draw incomplete ring
                if (cls === 'scout') {
                    this.clearPx(g, cx, 5);
                    this.clearPx(g, cx, 6);
                } else {
                    this.clearPx(g, cx, 5);
                    this.clearPx(g, cx - 1, 5);
                    this.clearPx(g, cx + 1, 5);
                    this.clearPx(g, cx, 6);
                }
                const rr = cls === 'capital' ? 5 : (cls === 'scout' ? 2 : 4);
                for (let a = 0; a < 12; a++) {
                    if (a === 9 || a === 10) continue; // broken ring gap
                    const ang = (a / 12) * Math.PI * 2;
                    const px = Math.round(cx + Math.cos(ang) * rr);
                    const py = Math.round(5 + Math.sin(ang) * (rr * 0.55));
                    this.setPx(g, px, py, a % 2 ? 1 : 2);
                }
                break;
            }
            case 'scrap': {
                // Asymmetric L-blocks — chop one side, pad the other
                const leftHeavy = (seed & 1) === 0;
                if (leftHeavy) {
                    this.fillRect(g, cx - 6, 6, 2, 2, 1);
                    this.fillRect(g, cx - 5, 7, 3, 1, 2);
                    this.clearPx(g, cx + 4, 4);
                    this.clearPx(g, cx + 5, 5);
                } else {
                    this.fillRect(g, cx + 4, 6, 2, 2, 1);
                    this.fillRect(g, cx + 2, 7, 3, 1, 2);
                    this.clearPx(g, cx - 5, 4);
                    this.clearPx(g, cx - 6, 5);
                }
                break;
            }
            case 'circuit': {
                // Orthogonal notches + grid traces only
                for (let c = cx - 4; c <= cx + 4; c += 2) {
                    this.setPx(g, c, 3, 1);
                    this.setPx(g, c, 8, 1);
                }
                this.setPx(g, cx - 3, 5, 2);
                this.setPx(g, cx + 2, 5, 2);
                this.setPx(g, cx - 2, 6, 1);
                this.setPx(g, cx + 1, 6, 1);
                if (cls === 'elite' || cls === 'capital') {
                    this.fillRect(g, cx - 1, 5, 2, 2, 3);
                }
                break;
            }
            default:
                break;
        }
    },

    enginePositions(enemyClass, cx) {
        const cls = this.normalizeClass(enemyClass);
        switch (cls) {
            case 'scout':
                return [{ x: cx, y: 10 }];
            case 'assault':
                return [{ x: cx - 1, y: 10 }, { x: cx + 1, y: 10 }];
            case 'heavy':
                return [{ x: cx - 2, y: 10 }, { x: cx + 2, y: 10 }];
            case 'elite':
                return [{ x: cx - 2, y: 10 }, { x: cx + 2, y: 10 }];
            case 'capital':
                return [
                    { x: cx - 7, y: 9 },
                    { x: cx - 5, y: 9 },
                    { x: cx + 4, y: 9 },
                    { x: cx + 6, y: 9 }
                ];
            default:
                return [{ x: cx - 1, y: 10 }, { x: cx + 1, y: 10 }];
        }
    },

    buildPixelSprite(faction, enemyClass) {
        const style = this.getFactionStyle(faction);
        const cls = this.normalizeClass(enemyClass);
        const g = this.blankGrid();
        const cx = Math.floor(this.spriteW / 2);
        const seed = this.hash(faction + '|' + cls);

        this.paintClassTopology(g, cls, cx);
        this.paintFactionMorph(g, style.silhouette, cls, cx, seed);
        this.mirrorSprite(g, cx);

        return g;
    },

    mirrorSprite(g, cx) {
        for (let r = 0; r < this.spriteH; r++) {
            for (let d = 1; cx - d >= 0 && cx + d < this.spriteW; d++) {
                const value = Math.max(g[r][cx - d] || 0, g[r][cx + d] || 0);
                g[r][cx - d] = value;
                g[r][cx + d] = value;
            }
        }
    },

    shadeColor(color, amount) {
        const hex = String(color || '').replace('#', '');
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#808080';
        const n = parseInt(hex, 16);
        const target = amount < 0 ? 0 : 255;
        const p = Math.abs(amount);
        const channel = (shift) => {
            const value = (n >> shift) & 255;
            return Math.round(value + (target - value) * p);
        };
        return '#' + [channel(16), channel(8), channel(0)]
            .map((v) => v.toString(16).padStart(2, '0')).join('');
    },

    /** Indexed pixel colors for a faction (edge / hull / accent). */
    buildFactionColors(factionId) {
        const style = this.getFactionStyle(factionId);
        const base = style.hull || '#808080';
        return {
            0: 'transparent',
            1: style.edge || this.shadeColor(base, -0.55),
            2: base,
            3: style.accent || this.shadeColor(base, 0.55)
        };
    },

    getFactionColor(factionId) {
        const style = this.getFactionStyle(factionId);
        return style.hull || '#808080';
    },

    buildEngineGlow(faction, enemyClass, tier) {
        const t = Math.max(1, Math.min(5, tier || 1));
        const cx = Math.floor(this.spriteW / 2);
        const positions = this.enginePositions(enemyClass, cx).map((p) => ({
            x: p.x,
            y: p.y,
            intensity: 0.55 + t * 0.08
        }));
        return {
            positions: positions,
            color: this.sharedEngine,
            width: this.spriteW,
            height: this.spriteH
        };
    },
});
