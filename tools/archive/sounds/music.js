// Music Assets for GLXEE Game Boy Edition
export const musicAssets = {
    // Main menu music
    menuMusic: {
        name: "menuMusic",
        type: "ambient",
        tempo: 120,
        key: "C",
        scale: "minor",
        instruments: ["square", "triangle"],
        description: "Ambient menu background music"
    },
    
    // Mars level music
    marsMusic: {
        name: "marsMusic",
        type: "ambient",
        tempo: 100,
        key: "D",
        scale: "minor",
        instruments: ["square", "noise"],
        description: "Desert planet ambient music"
    },
    
    // Jupiter level music
    jupiterMusic: {
        name: "jupiterMusic",
        type: "ambient",
        tempo: 140,
        key: "E",
        scale: "major",
        instruments: ["square", "sawtooth"],
        description: "Gas giant atmospheric music"
    },
    
    // Saturn level music
    saturnMusic: {
        name: "saturnMusic",
        type: "ambient",
        tempo: 110,
        key: "F",
        scale: "minor",
        instruments: ["square", "triangle", "noise"],
        description: "Ringed planet mysterious music"
    },
    
    // Neptune level music
    neptuneMusic: {
        name: "neptuneMusic",
        type: "ambient",
        tempo: 90,
        key: "G",
        scale: "minor",
        instruments: ["square", "sawtooth", "noise"],
        description: "Ice giant stormy music"
    },
    
    // Pluto level music
    plutoMusic: {
        name: "plutoMusic",
        type: "ambient",
        tempo: 80,
        key: "A",
        scale: "minor",
        instruments: ["square", "triangle", "noise"],
        description: "Dwarf planet cold music"
    },
    
    // Battle music
    battleMusic: {
        name: "battleMusic",
        type: "action",
        tempo: 160,
        key: "C",
        scale: "minor",
        instruments: ["square", "sawtooth", "noise"],
        description: "Intense battle music"
    },
    
    // Victory music
    victoryMusic: {
        name: "victoryMusic",
        type: "fanfare",
        tempo: 120,
        key: "C",
        scale: "major",
        instruments: ["square", "triangle"],
        description: "Victory celebration music"
    }
};
