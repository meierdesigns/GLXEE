"use strict";

const flightProfiles = {
    // Distinct per-faction flight signatures (speed, weave, formation, dive style).
    faction: {
        terran:   { speedMul: 0.95, wobbleAmp: 0.18, wobbleFreq: 0.65, evasionFreqMul: 1.1, formationTightness: 0.85, driftStyle: 'steady',  fireStyle: 'volley' },
        kronax:   { speedMul: 1.35, wobbleAmp: 0.04, wobbleFreq: 0.25, evasionFreqMul: 0.55, formationTightness: 0.45, driftStyle: 'charge',  fireStyle: 'claw' },
        voidborn: { speedMul: 1.10, wobbleAmp: 0.70, wobbleFreq: 1.60, evasionFreqMul: 2.0,  formationTightness: 0.25, driftStyle: 'weave',   fireStyle: 'arc' },
        pirate:   { speedMul: 1.15, wobbleAmp: 0.45, wobbleFreq: 1.15, evasionFreqMul: 1.4,  formationTightness: 0.35, driftStyle: 'skitter', fireStyle: 'spray' },
        machine:  { speedMul: 0.85, wobbleAmp: 0.01, wobbleFreq: 0.15, evasionFreqMul: 0.40, formationTightness: 1.0,  driftStyle: 'lockstep', fireStyle: 'salvo' }
    },
    class: {
        scout:   { speedMul: 1.3, wobbleAmpMul: 1.6, evasionFreqMul: 1.5, fireRateMul: 1.35, spreadMul: 0.85, shotCountMul: 1.0, aimJitter: 0.04 },
        assault: { speedMul: 1.0, wobbleAmpMul: 1.0, evasionFreqMul: 1.0, fireRateMul: 1.0,  spreadMul: 1.0,  shotCountMul: 1.0, aimJitter: 0.06 },
        heavy:   { speedMul: 0.8, wobbleAmpMul: 0.6, evasionFreqMul: 0.7, fireRateMul: 0.65, spreadMul: 0.55, shotCountMul: 1.0, aimJitter: 0.02 },
        elite:   { speedMul: 1.1, wobbleAmpMul: 0.9, evasionFreqMul: 1.1, fireRateMul: 1.15, spreadMul: 1.1,  shotCountMul: 1.25, aimJitter: 0.05 },
        capital: { speedMul: 0.6, wobbleAmpMul: 0.35, evasionFreqMul: 0.4, fireRateMul: 0.55, spreadMul: 1.4,  shotCountMul: 1.8,  aimJitter: 0.08 }
    },
    // Start-kit prototypes: own cadence / cone / hardpoint count.
    prototype: {
        player_scrap:        { fireRateMul: 1.1,  spreadMul: 0.7,  shotCountMul: 1.0, aimJitter: 0.05, fireStyle: 'steady' },
        player_interceptor:  { fireRateMul: 1.4,  spreadMul: 1.15, shotCountMul: 1.2, aimJitter: 0.08, fireStyle: 'spray' },
        player_heavy:        { fireRateMul: 0.6,  spreadMul: 0.4,  shotCountMul: 1.0, aimJitter: 0.02, fireStyle: 'claw' },
        player_assault:      { fireRateMul: 1.05, spreadMul: 0.95, shotCountMul: 1.35, aimJitter: 0.04, fireStyle: 'volley' }
    },

    resolve(faction, enemyClass) {
        const f = this.faction[faction] || this.faction.pirate;
        const c = this.class[enemyClass] || this.class.assault;
        return {
            speedMul: f.speedMul * c.speedMul,
            wobbleAmp: f.wobbleAmp * c.wobbleAmpMul,
            wobbleFreq: f.wobbleFreq,
            evasionFreqMul: f.evasionFreqMul * c.evasionFreqMul,
            formationTightness: f.formationTightness,
            driftStyle: f.driftStyle || 'steady',
            fireStyle: f.fireStyle || 'volley',
            fireRateMul: c.fireRateMul != null ? c.fireRateMul : 1,
            spreadMul: c.spreadMul != null ? c.spreadMul : 1,
            shotCountMul: c.shotCountMul != null ? c.shotCountMul : 1,
            aimJitter: c.aimJitter != null ? c.aimJitter : 0.05
        };
    },

    /** Merge faction/class fire profile with an optional start-kit prototype. */
    resolveFire(faction, enemyClass, prototypeId) {
        const base = this.resolve(faction, enemyClass);
        const proto = prototypeId ? this.prototype[String(prototypeId)] : null;
        if (!proto) return base;
        return {
            speedMul: base.speedMul,
            wobbleAmp: base.wobbleAmp,
            wobbleFreq: base.wobbleFreq,
            evasionFreqMul: base.evasionFreqMul,
            formationTightness: base.formationTightness,
            driftStyle: base.driftStyle,
            fireStyle: proto.fireStyle || base.fireStyle,
            fireRateMul: base.fireRateMul * (proto.fireRateMul != null ? proto.fireRateMul : 1),
            spreadMul: base.spreadMul * (proto.spreadMul != null ? proto.spreadMul : 1),
            shotCountMul: base.shotCountMul * (proto.shotCountMul != null ? proto.shotCountMul : 1),
            aimJitter: (proto.aimJitter != null ? proto.aimJitter : base.aimJitter)
        };
    }
};

window.flightProfiles = flightProfiles;
