export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  guidedTracing: true,
  segmentation: false,
  backgroundRemoval: false,
  handOcclusion: false,
  pencilOcclusion: false,
  smartFade: false,
  ghostStroke: false,
  voiceCommands: false,
  drawingComparison: true,
  sessionReplay: false,
  templateCreation: false,
  experimentalAnalysis: false
});

export function normalizeFeatureFlags(flags = {}) {
  return Object.fromEntries(Object.keys(DEFAULT_FEATURE_FLAGS).map(key => [key, flags[key] === undefined ? DEFAULT_FEATURE_FLAGS[key] : Boolean(flags[key])]));
}

export function featureEnabled(flags, name) { return normalizeFeatureFlags(flags)[name] === true; }
