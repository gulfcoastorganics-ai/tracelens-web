const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

export const TRACE_PRESETS = Object.freeze({
  "Clean Contour": { blur: 1, contrast: 1.2, threshold: .42, edgeOperator: "sobel", morphology: 1, minComponent: .0008, simplification: .04, lineWeight: "Uniform", zones: 0, backgroundSuppression: .15 },
  "Pencil Sketch": { blur: 1, contrast: 1.05, threshold: .24, edgeOperator: "sobel", morphology: 0, minComponent: .0002, simplification: .01, lineWeight: "Expressive", zones: 0, backgroundSuppression: 0 },
  "Technical Outline": { blur: 1, contrast: 1.3, threshold: .5, edgeOperator: "sobel", morphology: 1, minComponent: .0012, simplification: .06, lineWeight: "Structural", zones: 0, backgroundSuppression: .3 },
  "Shadow Blocks": { blur: 2, contrast: 1.25, threshold: .5, edgeOperator: "sobel", morphology: 1, minComponent: .001, simplification: .05, lineWeight: "Structural", zones: 5, backgroundSuppression: .1 },
  "High-Contrast Stencil": { blur: 2, contrast: 1.5, threshold: .52, edgeOperator: "sobel", morphology: 2, minComponent: .002, simplification: .08, lineWeight: "Uniform", zones: 3, backgroundSuppression: .35 },
  "Comic Ink": { blur: 1, contrast: 1.35, threshold: .35, edgeOperator: "sobel", morphology: 1, minComponent: .0005, simplification: .03, lineWeight: "Expressive", zones: 0, backgroundSuppression: .15 },
  "Simplified Portrait": { blur: 2, contrast: 1.15, threshold: .3, edgeOperator: "sobel", morphology: 1, minComponent: .0007, simplification: .045, lineWeight: "Expressive", zones: 5, backgroundSuppression: .2 },
  Architecture: { blur: 1, contrast: 1.35, threshold: .48, edgeOperator: "sobel", morphology: 1, minComponent: .0015, simplification: .07, lineWeight: "Structural", zones: 0, backgroundSuppression: .4 },
  "Clean Lines": { blur: 1, contrast: 1.15, threshold: .48, edgeOperator: "sobel", morphology: 1, minComponent: .0002, simplification: .04, lineWeight: "Uniform", zones: 0, backgroundSuppression: 0 },
  "Detailed Lines": { blur: 0, contrast: 1.05, threshold: .34, edgeOperator: "sobel", morphology: 0, minComponent: .0001, simplification: .01, lineWeight: "Expressive", zones: 0, backgroundSuppression: 0 },
  Original: { blur: 0, contrast: 1, threshold: .5, edgeOperator: "none", morphology: 0, minComponent: 0, simplification: 0, lineWeight: "Uniform", zones: 0, backgroundSuppression: 0 },
  "Silhouette": { blur: 2, contrast: 1.15, threshold: .5, edgeOperator: "sobel", morphology: 1, minComponent: .001, simplification: .05, lineWeight: "Structural", zones: 0, backgroundSuppression: .1 },
  "High Contrast": { blur: 1, contrast: 1.35, threshold: .5, edgeOperator: "threshold", morphology: 1, minComponent: .001, simplification: .05, lineWeight: "Uniform", zones: 3, backgroundSuppression: .2 },
  "Grayscale": { blur: 0, contrast: 1.1, threshold: .5, edgeOperator: "none", morphology: 0, minComponent: 0, simplification: 0, lineWeight: "Uniform", zones: 0, backgroundSuppression: 0 },
  "Posterize": { blur: 0, contrast: 1.1, threshold: .5, edgeOperator: "none", morphology: 0, minComponent: 0, simplification: 0, lineWeight: "Uniform", zones: 5, backgroundSuppression: 0 },
  "Inverted Lines": { blur: 1, contrast: 1.1, threshold: .4, edgeOperator: "sobel", morphology: 1, minComponent: .0002, simplification: .03, lineWeight: "Uniform", zones: 0, backgroundSuppression: 0 },
  "Structure": { blur: 2, contrast: 1.2, threshold: .48, edgeOperator: "sobel", morphology: 1, minComponent: .001, simplification: .06, lineWeight: "Structural", zones: 0, backgroundSuppression: .2 },
  Custom: { blur: 1, contrast: 1.1, threshold: .45, edgeOperator: "sobel", morphology: 0, minComponent: .0003, simplification: .03, lineWeight: "Uniform", zones: 0, backgroundSuppression: 0 }
});

export const TRACE_MODES = Object.freeze(Object.keys(TRACE_PRESETS));

export function normalizeTraceSettings(settings = {}) {
  const requestedMode = TRACE_MODES.includes(settings.mode) ? settings.mode : "Clean Lines";
  const preset = TRACE_PRESETS[requestedMode] || TRACE_PRESETS["Clean Lines"];
  const detail = clamp01(settings.detail ?? settings.strength ?? .55);
  const priority = clamp01(settings.priority ?? settings.coreLines ?? .6);
  const zones = Math.max(0, Math.min(8, Math.round(Number(settings.levels ?? settings.zones ?? preset.zones) || 0)));
  return { ...preset, ...settings, mode: requestedMode, detail, priority, strength: detail, threshold: clamp01(settings.threshold ?? preset.threshold), blur: Math.max(0, Math.min(6, Number(settings.blur ?? preset.blur) || 0)), contrast: Math.max(.1, Math.min(3, Number(settings.contrast ?? preset.contrast) || 1)), levels: zones, lineWeight: ["Uniform", "Structural", "Expressive"].includes(settings.lineWeight) ? settings.lineWeight : preset.lineWeight, isolation: settings.isolation === true, preview: settings.preview === true };
}

export function detailMapping(settings = {}) {
  const normalized = normalizeTraceSettings(settings);
  return { edgeThreshold: Math.max(.03, Math.min(.95, normalized.threshold * (1.18 - normalized.detail * .55))), minimumComponent: Math.max(.00002, normalized.minComponent * (1.7 - normalized.detail * 1.25)), simplification: normalized.simplification * (1.45 - normalized.detail * .8), textureSuppression: 1 - normalized.detail, retention: .25 + normalized.detail * .75 };
}
