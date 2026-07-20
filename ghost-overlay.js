/**
 * Ghost Overlay state and transform primitives.
 *
 * The browser workspace already owns the actual image element, layer model,
 * perspective canvas, and history stack. This module is deliberately pure: it
 * gives those systems one safe contract for additive Ghost Overlay state and
 * finite CSS output without creating a parallel renderer or persistence store.
 */

export const GHOST_OVERLAY_LIMITS = Object.freeze({
  opacity: { min: 0, max: 1 },
  scale: { min: 0.1, max: 5 },
  rotation: { min: -180, max: 180 },
  translation: { minViewport: 2, fallback: 2000 }
});

export const DEFAULT_GHOST_OVERLAY = Object.freeze({
  enabled: true,
  opacity: 0.55,
  scale: 1,
  rotation: 0,
  x: 0,
  y: 0,
  locked: false,
  imageRef: null
});

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/** Normalize an angle into the CSS-friendly -180..180 degree range. */
export function normalizeGhostRotation(value) {
  const rotation = finite(value, DEFAULT_GHOST_OVERLAY.rotation);
  const wrapped = ((rotation + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 && rotation > 0 ? 180 : wrapped;
}

/**
 * Normalize persisted or UI-provided Ghost Overlay state.
 * @param {object} input - Additive ghost state or legacy layer-like values.
 * @param {object} viewport - Current stage dimensions used for translation bounds.
 * @returns {object} A finite, bounded, serializable overlay state.
 */
export function normalizeGhostOverlay(input = {}, { viewportWidth = 0, viewportHeight = 0 } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const maxTranslation = Math.max(
    GHOST_OVERLAY_LIMITS.translation.fallback,
    finite(viewportWidth, 0) * GHOST_OVERLAY_LIMITS.translation.minViewport,
    finite(viewportHeight, 0) * GHOST_OVERLAY_LIMITS.translation.minViewport
  );
  const legacyVisible = source.enabled ?? source.visible;
  return {
    enabled: legacyVisible !== false,
    opacity: clamp(finite(source.opacity, DEFAULT_GHOST_OVERLAY.opacity), GHOST_OVERLAY_LIMITS.opacity.min, GHOST_OVERLAY_LIMITS.opacity.max),
    scale: clamp(Math.abs(finite(source.scale, DEFAULT_GHOST_OVERLAY.scale)), GHOST_OVERLAY_LIMITS.scale.min, GHOST_OVERLAY_LIMITS.scale.max),
    rotation: normalizeGhostRotation(source.rotation),
    x: clamp(finite(source.x, DEFAULT_GHOST_OVERLAY.x), -maxTranslation, maxTranslation),
    y: clamp(finite(source.y, DEFAULT_GHOST_OVERLAY.y), -maxTranslation, maxTranslation),
    locked: Boolean(source.locked),
    // Image data belongs to the layer/project asset. Keep only a small logical
    // identifier here so additive ghost state never duplicates a large payload.
    imageRef: typeof source.imageRef === "string" && source.imageRef && source.imageRef.length <= 256 ? source.imageRef : null
  };
}

/** Return a CSS transform string that is guaranteed to contain finite values. */
export function ghostOverlayCssTransform(input = {}, { flip = false, viewportWidth = 0, viewportHeight = 0 } = {}) {
  const state = normalizeGhostOverlay(input, { viewportWidth, viewportHeight });
  const signedScale = state.scale * (flip ? -1 : 1);
  return `translate3d(${state.x}px, ${state.y}px, 0) scale(${signedScale}, ${state.scale}) rotate(${state.rotation}deg)`;
}

/** Return whether two normalized states differ enough to commit history. */
export function ghostOverlayChanged(previous, next, epsilon = 0.001) {
  const a = normalizeGhostOverlay(previous); const b = normalizeGhostOverlay(next);
  return ["enabled", "locked", "imageRef"].some(key => a[key] !== b[key]) || ["opacity", "scale", "rotation", "x", "y"].some(key => Math.abs(a[key] - b[key]) > epsilon);
}
