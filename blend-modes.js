export const BLEND_MODES = ["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Difference"];
export function applyBlendMode(element, mode) { if (!element) return; element.style.mixBlendMode = mode.toLowerCase(); }
