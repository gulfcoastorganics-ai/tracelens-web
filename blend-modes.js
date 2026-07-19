export const BLEND_MODES = ["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Difference"];
export function applyBlendMode(element, mode) { element.style.mixBlendMode = mode.toLowerCase(); }
