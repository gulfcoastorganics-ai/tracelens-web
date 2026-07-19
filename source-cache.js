export class SourceCache {
  constructor({ maxEntries = 6, maxBytes = 24 * 1024 * 1024 } = {}) {
    this.maxEntries = Number.isFinite(maxEntries) ? Math.max(0, Math.floor(maxEntries)) : 6;
    this.maxBytes = Number.isFinite(maxBytes) ? Math.max(0, Math.floor(maxBytes)) : 24 * 1024 * 1024;
    this.entries = new Map();
    this.bytes = 0;
    this.active = new Set();
  }
  get(key) { const entry = this.entries.get(key); if (!entry) return null; this.entries.delete(key); this.entries.set(key, entry); return entry.value; }
  set(key, value, bytes = value?.data?.byteLength || 0) {
    this.delete(key);
    if (!this.maxEntries || !this.maxBytes || bytes > this.maxBytes) return value;
    this.entries.set(key, { value, bytes }); this.bytes += bytes; this.evict(); return value;
  }
  markActive(key) { this.active.add(key); }
  unmarkActive(key) { this.active.delete(key); this.evict(); }
  delete(key) { const entry = this.entries.get(key); if (!entry) return false; this.entries.delete(key); this.bytes -= entry.bytes; this.active.delete(key); return true; }
  clear() { this.entries.clear(); this.active.clear(); this.bytes = 0; }
  evict() {
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const candidate = [...this.entries.keys()].find(key => !this.active.has(key));
      if (candidate === undefined) break;
      this.delete(candidate);
    }
  }
  get size() { return this.entries.size; }
}
