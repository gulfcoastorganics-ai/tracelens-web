/**
 * Pure Ghost Compare state and render-instruction helpers.
 *
 * Comparison is a temporary inspection layer over the existing viewport. The
 * module does not own images, canvases, DOM listeners, or trace data; app.js
 * supplies those assets and applies the returned instructions to the existing
 * overlay/compare elements.
 */

export const GHOST_COMPARE_MODES = Object.freeze(["reference", "trace", "blend", "split", "difference"]);
export const GHOST_COMPARE_ORIENTATIONS = Object.freeze(["vertical", "horizontal"]);
export const DEFAULT_GHOST_COMPARE = Object.freeze({
  enabled: false,
  mode: "split",
  blend: 0.5,
  splitPosition: 0.5,
  splitOrientation: "vertical",
  referenceOpacity: 1,
  traceOpacity: 1
});

function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/** Normalize persisted/UI comparison values and safely fall back from Difference. */
export function normalizeGhostCompare(input = {}, { differenceAvailable = false } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const requestedMode = GHOST_COMPARE_MODES.includes(source.mode) ? source.mode : DEFAULT_GHOST_COMPARE.mode;
  const mode = requestedMode === "difference" && !differenceAvailable ? "split" : requestedMode;
  return {
    enabled: Boolean(source.enabled),
    mode,
    blend: clamp(finite(source.blend, DEFAULT_GHOST_COMPARE.blend), 0, 1),
    splitPosition: clamp(finite(source.splitPosition, DEFAULT_GHOST_COMPARE.splitPosition), 0, 1),
    splitOrientation: GHOST_COMPARE_ORIENTATIONS.includes(source.splitOrientation) ? source.splitOrientation : DEFAULT_GHOST_COMPARE.splitOrientation,
    referenceOpacity: clamp(finite(source.referenceOpacity, DEFAULT_GHOST_COMPARE.referenceOpacity), 0, 1),
    traceOpacity: clamp(finite(source.traceOpacity, DEFAULT_GHOST_COMPARE.traceOpacity), 0, 1)
  };
}
/** Return whether a comparison state has a meaningful persistent change. */
export function ghostCompareChanged(previous, next, epsilon = 0.001) {
  const a = normalizeGhostCompare(previous); const b = normalizeGhostCompare(next);
  return ["enabled", "mode", "splitOrientation"].some(key => a[key] !== b[key]) || ["blend", "splitPosition", "referenceOpacity", "traceOpacity"].some(key => Math.abs(a[key] - b[key]) > epsilon);
}

/**
 * Produce finite DOM/CSS instructions for a comparison viewport.
 * Zero-size viewports intentionally return hidden instructions so resize races
 * cannot produce invalid clip percentages or dimensions.
 */
export function ghostCompareRenderInstructions(input = {}, { width = 0, height = 0, differenceAvailable = false } = {}) {
  const state = normalizeGhostCompare(input, { differenceAvailable });
  const viewportReady = Number(width) > 0 && Number(height) > 0;
  const split = clamp(state.splitPosition, 0, 1) * 100;
  const clip = state.splitOrientation === "horizontal"
    ? { reference: `inset(0 0 ${100 - split}% 0)`, trace: `inset(${split}% 0 0 0)`, divider: `${100 - split}%` }
    : { reference: `inset(0 ${100 - split}% 0 0)`, trace: `inset(0 0 0 ${split}%)`, divider: `${split}%` };
  return {
    ...state,
    mode: state.mode,
    visible: Boolean(state.enabled && viewportReady),
    referenceVisible: Boolean(state.enabled && viewportReady && ["reference", "blend", "split"].includes(state.mode)),
    traceVisible: Boolean(state.enabled && viewportReady && ["trace", "blend", "split"].includes(state.mode)),
    differenceVisible: Boolean(state.enabled && viewportReady && state.mode === "difference" && differenceAvailable),
    referenceClipPath: state.mode === "split" ? clip.reference : "none",
    traceClipPath: state.mode === "split" ? clip.trace : "none",
    dividerPosition: state.mode === "split" ? clip.divider : "50%",
    referenceOpacity: state.mode === "blend" ? state.referenceOpacity * (1 - state.blend) : state.referenceOpacity,
    traceOpacity: state.mode === "blend" ? state.traceOpacity * state.blend : state.traceOpacity
  };
}
