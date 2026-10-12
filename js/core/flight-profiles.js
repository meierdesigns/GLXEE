"use strict";

const flightProfiles = {
    faction: {
        terran:   { speedMul: 0.9,  wobbleAmp: 0.15, wobbleFreq: 0.6, evasionFreqMul: 1.1, formationTightness: 0.8 },
        kronax:   { speedMul: 1.25, wobbleAmp: 0.05, wobbleFreq: 0.3, evasionFreqMul: 0.6, formationTightness: 0.5 },
        voidborn: { speedMul: 1.0,  wobbleAmp: 0.55, wobbleFreq: 1.4, evasionFreqMul: 1.8, formationTightness: 0.3 },
        pirate:   { speedMul: 1.05, wobbleAmp: 0.35, wobbleFreq: 1.0, evasionFreqMul: 1.3, formationTightness: 0.4 },
        machine:  { speedMul: 0.95, wobbleAmp: 0.02, wobbleFreq: 0.2, evasionFreqMul: 0.5, formationTightness: 1.0 }
    },
    class: {
        scout:   { speedMul: 1.3, wobbleAmpMul: 1.6, evasionFreqMul: 1.5 },
        assault: { speedMul: 1.0, wobbleAmpMul: 1.0, evasionFreqMul: 1.0 },
        heavy:   { speedMul: 0.8, wobbleAmpMul: 0.6, evasionFreqMul: 0.7 },
        elite:   { speedMul: 1.1, wobbleAmpMul: 0.9, evasionFreqMul: 1.1 },
        capital: { speedMul: 0.6, wobbleAmpMul: 0.35, evasionFreqMul: 0.4 }
    },

    resolve(faction, enemyClass) {
        const f = this.faction[faction] || this.faction.pirate;
        const c = this.class[enemyClass] || this.class.assault;
        return {
            speedMul: f.speedMul * c.speedMul,
            wobbleAmp: f.wobbleAmp * c.wobbleAmpMul,
            wobbleFreq: f.wobbleFreq,
            evasionFreqMul: f.evasionFreqMul * c.evasionFreqMul,
            formationTightness: f.formationTightness
        };
    }
};

window.flightProfiles = flightProfiles;
