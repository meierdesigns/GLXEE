"use strict";

// ComponentEditorUI is defined in component-editor/core.js and extended by the other files in component-editor/,
// which index.html loads before this file.
const componentEditorUI = new ComponentEditorUI();
window.ComponentEditorUI = ComponentEditorUI;
window.componentEditorUI = componentEditorUI;
