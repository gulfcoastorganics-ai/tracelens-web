/** Physical-size calibration helpers; values are normalized to millimetres. */
export const CALIBRATION_REFERENCES = {
  "US Letter": { width: 215.9, height: 279.4, unit: "mm" },
  "A4": { width: 210, height: 297, unit: "mm" },
  "Credit card": { width: 85.6, height: 53.98, unit: "mm" },
  "Custom": { width: 100, height: 100, unit: "mm" },
  "Ruler segment": { width: 100, height: 10, unit: "mm" }
};

export function toMillimeters(value, unit) { return unit === "in" ? Number(value) * 25.4 : Number(value); }
export function fromMillimeters(value, unit) { return unit === "in" ? Number(value) / 25.4 : Number(value); }
export function validateDimension(value, unit) { const mm = toMillimeters(value, unit); return Number.isFinite(mm) && mm > 0 && mm < 100000; }

import { validateQuad } from "./quad-geometry.js";

export function calculateCalibration({ referenceWidth, referenceHeight, quad, desiredWidth, unit = "mm" }) {
  if (!validateDimension(referenceWidth, "mm") || !validateDimension(referenceHeight, "mm") || !validateDimension(desiredWidth, unit)) throw new Error("Calibration dimensions must be positive and reasonable.");
  const validation = validateQuad(quad, { minArea: 0.01, minInset: 0, minEdgeConsistency: 0.25 });
  if (!validation.valid) throw new Error(`Calibration target is not measurable (${validation.metrics.reason}).`);
  const top = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const bottom = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
  const left = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
  const right = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);
  const planeWidth = (top + bottom) / 2;
  const widthSpread = Math.abs(top - bottom) / Math.max(planeWidth, Number.EPSILON);
  const heightSpread = Math.abs(left - right) / Math.max((left + right) / 2, Number.EPSILON);
  const desiredWidthMm = toMillimeters(desiredWidth, unit);
  const confidence = Math.max(0, Math.min(1, 1 - Math.max(widthSpread, heightSpread) * 2));
  return { referenceWidthMm: Number(referenceWidth), referenceHeightMm: Number(referenceHeight), desiredWidthMm, desiredHeightMm: desiredWidthMm * referenceHeight / referenceWidth, planeWidth, pixelsPerMm: planeWidth / referenceWidth, confidence, uncertainty: `${Math.round((1 - confidence) * 100)}% estimated geometric uncertainty; camera perspective and surface tracking still affect precision.` };
}
