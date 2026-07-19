import { SurfaceDetector } from "./surface-detector.js";
import { TrackingState } from "./tracking-state.js";

export class SurfaceTracker {
  constructor({ onUpdate, interval = 200 } = {}) {
    this.state = new TrackingState(); this.locked = false; this.lastResult = null; this.smoothedQuad = null; this.onUpdate = onUpdate;
    this.detector = new SurfaceDetector({ interval, onUpdate: result => this.handleResult(result) });
  }

  start(video) { this.detector.start(video); }
  stop() { this.detector.stop(); }
  lock() { this.locked = true; }
  unlock() { this.locked = false; }

  handleResult(result) {
    const now = performance.now();
    if (result.found && result.quad) {
      this.lastResult = result;
      if (!this.smoothedQuad) this.smoothedQuad = result.quad.map(point => ({ ...point }));
      else result.quad.forEach((point, index) => { this.smoothedQuad[index].x += (point.x - this.smoothedQuad[index].x) * 0.22; this.smoothedQuad[index].y += (point.y - this.smoothedQuad[index].y) * 0.22; });
    }
    const status = this.state.update(result.found ? result.confidence : 0, now);
    this.onUpdate?.({ ...result, ...status, quad: this.smoothedQuad });
  }
}
