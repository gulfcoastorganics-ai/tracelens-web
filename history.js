export class HistoryStack {
  constructor(limit = 30) { this.limit = limit; this.entries = []; this.index = -1; }
  clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  push(value) { this.entries = this.entries.slice(0, this.index + 1); this.entries.push(this.clone(value)); if (this.entries.length > this.limit) this.entries.shift(); this.index = this.entries.length - 1; }
  undo() { if (this.index <= 0) return null; this.index -= 1; return this.clone(this.entries[this.index]); }
  redo() { if (this.index >= this.entries.length - 1) return null; this.index += 1; return this.clone(this.entries[this.index]); }
}
