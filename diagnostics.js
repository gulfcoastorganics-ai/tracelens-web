export class Diagnostics {
  constructor(output) { this.output = output; this.frames = 0; this.last = performance.now(); this.fps = 0; }
  frame() { this.frames += 1; const now = performance.now(); if (now - this.last >= 1000) { this.fps = this.frames; this.frames = 0; this.last = now; } }
  render({ tracking = 0, camera = "—", analysis = 0, quality = "high" } = {}) { if (!this.output) return; this.output.textContent = `FPS ${this.fps} · Tracking ${tracking}% · ${camera} · Analysis ${Math.round(analysis)}ms · ${quality}`; }
}
