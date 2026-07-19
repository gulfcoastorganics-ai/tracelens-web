export class TraceCache {
  constructor(limit = 12) { this.limit = limit; this.entries = new Map(); this.bytes = 0; this.hits = 0; this.misses = 0; }
  get(key) { const entry = this.entries.get(key); if (!entry) { this.misses += 1; return null; } this.entries.delete(key); this.entries.set(key, entry); this.hits += 1; return entry.value; }
  set(key, value, bytes = value?.data?.byteLength || 0) { if (this.entries.has(key)) this.delete(key); this.entries.set(key, { value, bytes }); this.bytes += bytes; while (this.entries.size > this.limit) this.delete(this.entries.keys().next().value); return value; }
  delete(key) { const entry = this.entries.get(key); if (!entry) return false; this.bytes -= entry.bytes; this.entries.delete(key); return true; }
  clear() { this.entries.clear(); this.bytes = 0; }
  get size() { return this.entries.size; }
}

export function traceCacheKey(sourceFingerprint, settings, resolution = "analysis") { return `${sourceFingerprint}|${resolution}|${JSON.stringify(settings, Object.keys(settings).sort())}`; }
