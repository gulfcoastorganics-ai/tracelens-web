export class PerspectiveSession {
  constructor(requiredSamples = 4) { this.requiredSamples = requiredSamples; this.mode = "manual"; this.candidate = null; }
  beginScan() { this.mode = "scanning"; this.candidate = null; }
  updateCandidate(result) { if (this.mode === "scanning" && result?.lockEligible && result.stableSampleCount >= this.requiredSamples) this.candidate = result; return this.candidate; }
  confirm() { if (this.mode !== "scanning" || !this.candidate) return false; this.mode = "locked"; return true; }
  cancel() { this.mode = "manual"; this.candidate = null; }
  unlock() { this.cancel(); }
  get scanning() { return this.mode === "scanning"; }
  get locked() { return this.mode === "locked"; }
}
