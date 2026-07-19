export class HistoryStack {
  constructor(limit = 30, { equals = (a, b) => JSON.stringify(a) === JSON.stringify(b) } = {}) { this.limit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 30; this.equals = equals; this.entries = []; this.index = -1; }
  clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  push(value) { const next = this.clone(value); if (this.index >= 0 && this.equals(this.entries[this.index], next)) return false; this.entries = this.entries.slice(0, this.index + 1); this.entries.push(next); if (this.entries.length > this.limit) this.entries.shift(); this.index = this.entries.length - 1; return true; }
  undo() { if (this.index <= 0) return null; this.index -= 1; return this.clone(this.entries[this.index]); }
  redo() { if (this.index >= this.entries.length - 1) return null; this.index += 1; return this.clone(this.entries[this.index]); }
  clear() { this.entries = []; this.index = -1; }
}
