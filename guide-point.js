import { distance, lerpPoint, predictPoint, smoothPoint } from "./trace-guide-math.js";

export function landmarkPoint(landmarks, index) { const point = landmarks?.[index]; return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) ? { x: Number(point.x), y: Number(point.y), z: Number(point.z) || 0 } : null; }
export function pinchPoint(landmarks, threshold = .12) { const thumb = landmarkPoint(landmarks, 4); const index = landmarkPoint(landmarks, 8); if (!thumb || !index) return null; const pinchDistance = distance(thumb, index); return { active: pinchDistance <= threshold, distance: pinchDistance, point: lerpPoint(thumb, index, .5) }; }

export class GuidePointFilter {
  constructor({ smoothing = "Medium", prediction = true, maxPrediction = 18 } = {}) { this.smoothing = smoothing; this.prediction = prediction; this.maxPrediction = maxPrediction; this.previous = null; this.previousTimestamp = 0; }
  reset() { this.previous = null; this.previousTimestamp = 0; }
  update(raw, timestamp = 0, confidence = 1) { if (!raw) return { raw: null, stabilized: null, predicted: null }; const stabilized = smoothPoint(this.previous, raw, this.smoothing); const delta = this.previousTimestamp ? Math.max(0, (timestamp - this.previousTimestamp) / 1000) : 0; const predicted = this.prediction ? predictPoint(stabilized, this.previous, delta, confidence, this.maxPrediction) : stabilized; this.previous = stabilized; this.previousTimestamp = timestamp; return { raw: { ...raw }, stabilized, predicted }; }
}
