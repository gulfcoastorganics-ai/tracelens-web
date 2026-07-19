export function normalizeGhostStroke(stroke = {}) {
  const points = Array.isArray(stroke.points) ? stroke.points.filter(point => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))).map(point => ({ x: Number(point.x), y: Number(point.y) })) : [];
  return { id: stroke.id || null, points, durationMs: Math.max(100, Number(stroke.durationMs) || 1400), loop: Boolean(stroke.loop), visible: stroke.visible !== false };
}

export function sampleGhostStroke(stroke, elapsedMs) {
  const normalized = normalizeGhostStroke(stroke); if (normalized.points.length < 2) return null;
  const duration = normalized.durationMs; const elapsed = normalized.loop ? ((Math.max(0, elapsedMs) % duration) / duration) : Math.max(0, Math.min(1, elapsedMs / duration)); const scaled = elapsed * (normalized.points.length - 1); const index = Math.min(normalized.points.length - 2, Math.floor(scaled)); const amount = scaled - index; const a = normalized.points[index]; const b = normalized.points[index + 1]; return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount, progress: elapsed, index, complete: !normalized.loop && elapsed >= 1 };
}
