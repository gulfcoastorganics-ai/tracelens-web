/**
 * Pure Ghost Brush state, coordinate, mask, and trail helpers.
 *
 * The browser runtime owns the reference image and pointer lifecycle. This
 * module only turns finite stage coordinates into bounded presentation data;
 * it never stores image payloads, pointer IDs, or trace geometry.
 */

export const GHOST_BRUSH_MODES = Object.freeze(["spotlight", "edge-focus", "trail", "endpoint"]);
export const GHOST_BRUSH_LIMITS = Object.freeze({
  radius: { min: 24, max: 320 },
  feather: { min: 0, max: 1 },
  opacity: { min: 0, max: 1 },
  edgeStrength: { min: 0, max: 1 },
  trailLength: { min: 0, max: 12 },
  maxTrailSamples: 12,
  minTrailDistance: 4
});
export const DEFAULT_GHOST_BRUSH = Object.freeze({
  enabled: false,
  mode: "spotlight",
  radius: 96,
  feather: 0.45,
  referenceOpacity: 1,
  outsideOpacity: 0.15,
  edgeStrength: 0.5,
  trailEnabled: false,
  trailLength: 6,
  followEndpoint: true,
  locked: false
});

function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/** Normalize persistent Ghost Brush settings into safe, backward-compatible state. */
export function normalizeGhostBrush(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    enabled: Boolean(source.enabled),
    mode: GHOST_BRUSH_MODES.includes(source.mode) ? source.mode : DEFAULT_GHOST_BRUSH.mode,
    radius: clamp(finite(source.radius, DEFAULT_GHOST_BRUSH.radius), GHOST_BRUSH_LIMITS.radius.min, GHOST_BRUSH_LIMITS.radius.max),
    feather: clamp(finite(source.feather, DEFAULT_GHOST_BRUSH.feather), GHOST_BRUSH_LIMITS.feather.min, GHOST_BRUSH_LIMITS.feather.max),
    referenceOpacity: clamp(finite(source.referenceOpacity, DEFAULT_GHOST_BRUSH.referenceOpacity), 0, 1),
    outsideOpacity: clamp(finite(source.outsideOpacity, DEFAULT_GHOST_BRUSH.outsideOpacity), 0, 1),
    edgeStrength: clamp(finite(source.edgeStrength, DEFAULT_GHOST_BRUSH.edgeStrength), 0, 1),
    trailEnabled: Boolean(source.trailEnabled),
    trailLength: Math.round(clamp(finite(source.trailLength, DEFAULT_GHOST_BRUSH.trailLength), 0, GHOST_BRUSH_LIMITS.maxTrailSamples)),
    followEndpoint: source.followEndpoint !== false,
    locked: Boolean(source.locked)
  };
}

/** Normalize a stage point, rejecting non-finite coordinates and zero viewports. */
export function normalizeGhostBrushPoint(point, { width = 0, height = 0 } = {}) {
  const viewportWidth = finite(width, 0); const viewportHeight = finite(height, 0);
  if (!point || viewportWidth <= 0 || viewportHeight <= 0) return null;
  const x = finite(point.x ?? point.clientX, NaN); const y = finite(point.y ?? point.clientY, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp(x, 0, viewportWidth), y: clamp(y, 0, viewportHeight) };
}

/** Convert a stage point into the active overlay's local mask space. */
export function ghostBrushStageToOverlayPoint(point, overlay = {}, { width = 0, height = 0 } = {}) {
  const safe = normalizeGhostBrushPoint(point, { width, height });
  if (!safe || finite(width, 0) <= 0 || finite(height, 0) <= 0) return null;
  const scale = Math.max(.1, Math.abs(finite(overlay.scale, 1))); const radians = -finite(overlay.rotation, 0) * Math.PI / 180;
  const dx = safe.x - width / 2 - finite(overlay.x, 0); const dy = safe.y - height / 2 - finite(overlay.y, 0);
  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians); const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
  const local = { x: width / 2 + rotatedX / scale, y: height / 2 + rotatedY / scale };
  if (overlay.flipped) local.x = width - local.x;
  return { x: finite(local.x, width / 2), y: finite(local.y, height / 2) };
}

/** Resolve pointer-first or endpoint fallback guidance without inventing coordinates. */
export function resolveGhostBrushPosition({ pointer = null, endpoint = null, followEndpoint = true } = {}, viewport) {
  return normalizeGhostBrushPoint(pointer, viewport) || (followEndpoint ? normalizeGhostBrushPoint(endpoint, viewport) : null);
}

/** Append a distance-sampled transient trail with a hard memory bound. */
export function appendGhostBrushTrail(samples = [], point, { maxSamples = GHOST_BRUSH_LIMITS.maxTrailSamples, minDistance = GHOST_BRUSH_LIMITS.minTrailDistance, time = 0 } = {}) {
  const safePoint = normalizeGhostBrushPoint(point, { width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER });
  if (!safePoint) return samples.slice(-Math.max(0, Math.min(GHOST_BRUSH_LIMITS.maxTrailSamples, Math.round(maxSamples))));
  const boundedMax = Math.max(0, Math.min(GHOST_BRUSH_LIMITS.maxTrailSamples, Math.round(finite(maxSamples, GHOST_BRUSH_LIMITS.maxTrailSamples))));
  if (!boundedMax) return [];
  const previous = samples.at(-1); const distance = previous ? Math.hypot(previous.x - safePoint.x, previous.y - safePoint.y) : Infinity;
  if (distance < Math.max(0, finite(minDistance, GHOST_BRUSH_LIMITS.minTrailDistance))) return samples.slice(-boundedMax);
  return [...samples, { x: safePoint.x, y: safePoint.y, time: finite(time, 0) }].slice(-boundedMax);
}

/** Return finite CSS mask/filter instructions for the existing reference element. */
export function ghostBrushRenderInstructions(input = {}, position = null, { width = 0, height = 0, trail = [] } = {}) {
  const state = normalizeGhostBrush(input); const point = normalizeGhostBrushPoint(position, { width, height });
  if (!state.enabled || !point || finite(width, 0) <= 0 || finite(height, 0) <= 0) return { visible: false, state, position: null, mask: "none", filter: "none", opacity: 0, trail: [] };
  const radius = clamp(state.radius, GHOST_BRUSH_LIMITS.radius.min, GHOST_BRUSH_LIMITS.radius.max);
  const inner = clamp(radius * (1 - state.feather), 0, radius);
  const center = `${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`;
  const maskStops = `rgba(0,0,0,1) ${inner.toFixed(2)}px, rgba(0,0,0,${state.outsideOpacity.toFixed(3)}) ${radius.toFixed(2)}px`;
  const trailPoints = state.trailEnabled && state.mode === "trail" ? trail.slice(-state.trailLength).map(item => normalizeGhostBrushPoint(item, { width, height })).filter(Boolean) : [];
  const gradients = [ `radial-gradient(ellipse ${radius.toFixed(2)}px ${radius.toFixed(2)}px at ${center}, ${maskStops}, rgba(0,0,0,${state.outsideOpacity.toFixed(3)}) 100%)` ];
  trailPoints.slice(0, -1).forEach(item => gradients.push(`radial-gradient(ellipse ${(radius * .72).toFixed(2)}px ${(radius * .72).toFixed(2)}px at ${item.x.toFixed(2)}px ${item.y.toFixed(2)}px, rgba(0,0,0,.5), rgba(0,0,0,${state.outsideOpacity.toFixed(3)}) 100%)`));
  return {
    visible: true,
    state,
    position: point,
    mask: gradients.join(", "),
    filter: state.mode === "edge-focus" ? `contrast(${(1 + state.edgeStrength * .8).toFixed(3)}) saturate(${(1 + state.edgeStrength * .25).toFixed(3)})` : "none",
    opacity: state.referenceOpacity,
    trail: trailPoints
  };
}

/** Return whether two stable settings differ enough for one history commit. */
export function ghostBrushChanged(previous, next, epsilon = 0.001) {
  const a = normalizeGhostBrush(previous); const b = normalizeGhostBrush(next);
  return ["enabled", "mode", "trailEnabled", "followEndpoint", "locked"].some(key => a[key] !== b[key]) || ["radius", "feather", "referenceOpacity", "outsideOpacity", "edgeStrength", "trailLength"].some(key => Math.abs(a[key] - b[key]) > epsilon);
}
