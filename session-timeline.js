export class SessionTimeline {
  constructor(limit = 50) { this.limit = limit; this.events = []; }
  add(type, detail = "") { this.events.push({ type, detail, at: new Date().toISOString() }); if (this.events.length > this.limit) this.events.shift(); }
  latest() { return this.events[this.events.length - 1] || null; }
}
