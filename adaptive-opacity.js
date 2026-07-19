export class AdaptiveOpacityController {
  constructor({ analyzer, onOpacity } = {}) { this.analyzer = analyzer; this.onOpacity = onOpacity; this.enabled = false; this.lastRun = 0; this.value = 0.55; }
  setEnabled(enabled) { this.enabled = enabled; }
  update(video, now = performance.now()) {
    if (!this.enabled || now - this.lastRun < 220) return;
    this.lastRun = now;
    const metrics = this.analyzer.analyze(video);
    if (!metrics) return;
    const target = Math.max(0.24, Math.min(0.82, 0.68 - (metrics.average / 255) * 0.38 + (metrics.contrast < 24 ? 0.08 : 0)));
    this.value += (target - this.value) * 0.12;
    this.onOpacity?.(this.value, metrics);
  }
}
