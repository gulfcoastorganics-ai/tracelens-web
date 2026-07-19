export class TrackingState {
  constructor({ weakAt = 58, lostAt = 35, recoverAt = 68, graceMs = 1200 } = {}) {
    this.state = "searching"; this.confidence = 0; this.lastSeen = 0;
    this.weakAt = weakAt; this.lostAt = lostAt; this.recoverAt = recoverAt; this.graceMs = graceMs;
  }

  update(confidence, now = performance.now()) {
    this.confidence = Math.round(confidence || 0);
    if (this.confidence >= this.recoverAt) { this.lastSeen = now; if (this.state !== "tracking") this.state = "tracking"; }
    else if (this.confidence >= this.weakAt) { this.lastSeen = now; if (this.state === "searching" || this.state === "lost") this.state = "tracking"; else this.state = "weak"; }
    else if (now - this.lastSeen > this.graceMs) this.state = this.confidence < this.lostAt ? "lost" : "weak";
    return { state: this.state, confidence: this.confidence };
  }
}
