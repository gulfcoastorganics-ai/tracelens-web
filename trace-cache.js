export class TraceCache {
  constructor(limit = 12, maxBytes = Infinity) { this.limit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 12; this.maxBytes = Number.isFinite(maxBytes) ? Math.max(0, maxBytes) : Infinity; this.entries = new Map(); this.bytes = 0; this.hits = 0; this.misses = 0; }
  get(key) { const entry = this.entries.get(key); if (!entry) { this.misses += 1; return null; } this.entries.delete(key); this.entries.set(key, entry); this.hits += 1; return entry.value; }
  set(key, value, bytes = value?.data?.byteLength || 0) { if (this.entries.has(key)) this.delete(key); if (!this.limit || !this.maxBytes || bytes > this.maxBytes) return value; this.entries.set(key, { value, bytes }); this.bytes += bytes; this.evict(); return value; }
  evict() { while (this.entries.size > this.limit || this.bytes > this.maxBytes) { const key = this.entries.keys().next().value; if (key === undefined) break; this.delete(key); } }
  delete(key) { const entry = this.entries.get(key); if (!entry) return false; this.bytes -= entry.bytes; this.entries.delete(key); return true; }
  clear() { this.entries.clear(); this.bytes = 0; }
  get size() { return this.entries.size; }
}

export function traceCacheKey(sourceFingerprint, settings, resolution = "analysis") { return `${sourceFingerprint}|${resolution}|${JSON.stringify(settings, Object.keys(settings).sort())}`; }
