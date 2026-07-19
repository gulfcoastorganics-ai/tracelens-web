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

export function calculateCalibration({ referenceWidth, referenceHeight, quad, desiredWidth, unit = "mm" }) {
  if (!validateDimension(referenceWidth, "mm") || !validateDimension(referenceHeight, "mm") || !validateDimension(desiredWidth, unit)) throw new Error("Calibration dimensions must be positive and reasonable.");
  const top = Math.hypot((quad?.[1]?.x || 1) - (quad?.[0]?.x || 0), (quad?.[1]?.y || 0) - (quad?.[0]?.y || 0));
  const bottom = Math.hypot((quad?.[2]?.x || 1) - (quad?.[3]?.x || 0), (quad?.[2]?.y || 0) - (quad?.[3]?.y || 0));
  const planeWidth = ((top + bottom) / 2) || 1;
  const desiredWidthMm = toMillimeters(desiredWidth, unit);
  return { referenceWidthMm: referenceWidth, referenceHeightMm: referenceHeight, desiredWidthMm, desiredHeightMm: desiredWidthMm * referenceHeight / referenceWidth, planeWidth, pixelsPerMm: planeWidth / referenceWidth, uncertainty: "Camera perspective and heuristic tracking affect precision." };
}
