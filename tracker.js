import { SurfaceDetector } from "./surface-detector.js";
import { TrackingState } from "./tracking-state.js";
import { cornerMotion, validateQuad } from "./quad-geometry.js";

export class SurfaceTracker {
  constructor({ onUpdate, interval = 200, stableSamples = 4, stableWindowMs = 800, maxCornerMotion = 0.055 } = {}) {
    this.state = new TrackingState(); this.locked = false; this.scanning = false; this.lastResult = null; this.smoothedQuad = null; this.stableResult = null; this.onUpdate = onUpdate;
    this.stableSamplesRequired = stableSamples; this.stableWindowMs = stableWindowMs; this.maxCornerMotion = maxCornerMotion; this.stableSampleCount = 0; this.scanStartedAt = 0; this.previousCandidate = null; this.detector = new SurfaceDetector({ interval, onUpdate: result => this.handleResult(result) });
  }

  start(video) { this.detector.start(video); }
  stop() { this.detector.stop(); }
  beginScan(now = performance.now()) { this.scanning = true; this.locked = false; this.stableResult = null; this.stableSampleCount = 0; this.scanStartedAt = now; this.previousCandidate = null; this.lastResult = null; this.state.reset?.(); }
  cancelScan() { this.scanning = false; this.stableResult = null; this.stableSampleCount = 0; this.previousCandidate = null; }
  lock() { if (!this.scanning || !this.stableResult || this.stableSampleCount < this.stableSamplesRequired) return false; this.locked = true; this.scanning = false; return true; }
  unlock() { this.locked = false; this.cancelScan(); }
  getLockCandidate() { return this.stableSampleCount >= this.stableSamplesRequired ? this.stableResult : null; }

  handleResult(result) {
    const now = performance.now(); const validation = result.quad ? validateQuad(result.quad) : { valid: false, metrics: { reason: result.rejection || "no-quad" } }; const valid = Boolean(result.found && validation.valid); const motion = valid ? cornerMotion(this.previousCandidate, result.quad) : 0;
    if (valid) {
      this.lastResult = { ...result, metrics: validation.metrics, cornerMotion: motion };
      if (!this.smoothedQuad) this.smoothedQuad = result.quad.map(point => ({ ...point })); else result.quad.forEach((point, index) => { this.smoothedQuad[index].x += (point.x - this.smoothedQuad[index].x) * 0.22; this.smoothedQuad[index].y += (point.y - this.smoothedQuad[index].y) * 0.22; });
      if (this.scanning) {
        const inWindow = now - this.scanStartedAt <= this.stableWindowMs;
        if (!inWindow || motion > this.maxCornerMotion) { this.stableSampleCount = 1; this.scanStartedAt = now; } else this.stableSampleCount += 1;
        this.previousCandidate = result.quad.map(point => ({ ...point }));
        if (this.stableSampleCount >= this.stableSamplesRequired) this.stableResult = { ...result, quad: this.smoothedQuad.map(point => ({ ...point })), metrics: validation.metrics, cornerMotion: motion };
      }
    } else if (this.scanning) { this.stableSampleCount = 0; this.stableResult = null; this.previousCandidate = null; }
    const status = this.state.update(valid ? result.confidence : 0, now, this.locked);
    this.onUpdate?.({ ...result, ...status, found: valid, quad: this.smoothedQuad, metrics: valid ? validation.metrics : (result.metrics || validation.metrics), cornerMotion: motion, stableSampleCount: this.stableSampleCount, stableSamplesRequired: this.stableSamplesRequired, lockEligible: Boolean(this.stableResult), scanning: this.scanning, locked: this.locked, rejection: valid ? null : (result.rejection || validation.metrics.reason) });
  }
}
