const PROFILES = ["Pencil", "Pen", "Marker", "Brush", "Chalk", "Custom"];
export function normalizeToolCalibration(calibration = {}) { return { profile: PROFILES.includes(calibration.profile) ? calibration.profile : "Pencil", hand: calibration.hand === "left" ? "left" : "right", camera: calibration.camera || "environment", offset: { x: Number(calibration.offset?.x) || 0, y: Number(calibration.offset?.y) || 0 }, confidence: Math.max(0, Math.min(1, Number(calibration.confidence) || 0)), calibratedAt: calibration.calibratedAt || 0 }; }
export function estimateToolPoint(anchor, calibration) { const normalized = normalizeToolCalibration(calibration); return anchor ? { x: anchor.x + normalized.offset.x, y: anchor.y + normalized.offset.y, estimated: true, confidence: normalized.confidence } : null; }
export function calibrateToolOffset(samples = [], reticle = { x: .5, y: .5 }, profile = "Pencil", hand = "right", camera = "environment") {
  const valid = samples.filter(point => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) && Number(point.x) >= 0 && Number(point.x) <= 1 && Number(point.y) >= 0 && Number(point.y) <= 1).map(point => ({ x: Number(point.x), y: Number(point.y) }));
  if (!valid.length || !Number.isFinite(Number(reticle.x)) || !Number.isFinite(Number(reticle.y))) return null;
  const average = valid.reduce((sum, point) => ({ x: sum.x + point.x / valid.length, y: sum.y + point.y / valid.length }), { x: 0, y: 0 });
  const variance = valid.reduce((sum, point) => sum + Math.hypot(point.x - average.x, point.y - average.y) ** 2, 0) / valid.length;
  const stability = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / .08));
  const sampleConfidence = Math.min(1, valid.length / 20);
  return normalizeToolCalibration({ profile, hand, camera, offset: { x: Number(reticle.x) - average.x, y: Number(reticle.y) - average.y }, confidence: sampleConfidence * stability, calibratedAt: Date.now() });
}
export { PROFILES as TOOL_PROFILES };
