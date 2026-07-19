export class TrackingState {
  constructor({ acquireAt = 78, retainAt = 55, lostAt = 35, graceMs = 1200 } = {}) {
    this.state = "searching"; this.confidence = 0; this.lastSeen = 0;
    this.acquireAt = acquireAt; this.retainAt = retainAt; this.lostAt = lostAt; this.graceMs = graceMs;
  }

  update(confidence, now = performance.now(), locked = false) {
    this.confidence = Math.round(confidence || 0);
    const threshold = locked ? this.retainAt : this.acquireAt;
    if (!locked && this.confidence < threshold) { this.state = "searching"; return { state: this.state, confidence: this.confidence }; }
    if (this.confidence >= threshold) { this.lastSeen = now; this.state = "tracking"; }
    else if (this.lastSeen && now - this.lastSeen <= this.graceMs) this.state = "weak";
    else if (this.confidence < this.lostAt) this.state = locked ? "lost" : "searching";
    else this.state = "weak";
    return { state: this.state, confidence: this.confidence };
  }

  reset() { this.state = "searching"; this.confidence = 0; this.lastSeen = 0; }
}
