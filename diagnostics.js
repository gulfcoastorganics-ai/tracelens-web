export class Diagnostics {
  constructor(output) { this.output = output; this.frames = 0; this.last = performance.now(); this.fps = 0; }
  frame() { this.frames += 1; const now = performance.now(); if (now - this.last >= 1000) { this.fps = this.frames; this.frames = 0; this.last = now; } }
  render({ tracking = 0, camera = "—", analysis = 0, quality = "high", rawConfidence = "—", stable = "—", area = "—", aspect = "—", motion = "—", rejection = "—", trace = null } = {}) { if (!this.output) return; const traceText = trace ? ` · Trace ${trace.worker ? "worker" : "main"} ${trace.analysisResolution}px Cache ${trace.cacheHits}/${trace.cacheMisses}` : ""; this.output.textContent = `FPS ${this.fps} · Tracking ${tracking}% · Raw ${rawConfidence}% · Stable ${stable} · Area ${area}% · AR ${aspect} · Motion ${motion} · Reject ${rejection} · ${camera} · Analysis ${Math.round(analysis)}ms · ${quality}${traceText}`; }
}
