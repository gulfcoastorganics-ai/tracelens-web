export function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function signedArea(quad) { return quad.reduce((sum, point, index) => { const next = quad[(index + 1) % quad.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2; }
export function cross(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
export function isConvex(quad, epsilon = 1e-4) {
  if (!Array.isArray(quad) || quad.length !== 4) return false;
  const turns = quad.map((point, index) => cross(point, quad[(index + 1) % 4], quad[(index + 2) % 4]));
  return turns.every(value => value > epsilon) || turns.every(value => value < -epsilon);
}
export function edgeConsistency(quad) {
  const edges = quad.map((point, index) => distance(point, quad[(index + 1) % 4]));
  const opposite = [Math.min(edges[0], edges[2]) / Math.max(edges[0], edges[2]), Math.min(edges[1], edges[3]) / Math.max(edges[1], edges[3])];
  return Math.min(...opposite);
}
export function aspectRatio(quad) {
  const edges = quad.map((point, index) => distance(point, quad[(index + 1) % 4]));
  const width = (edges[0] + edges[2]) / 2; const height = (edges[1] + edges[3]) / 2;
  return Math.max(width, height) / Math.max(1e-6, Math.min(width, height));
}
export function cornerMotion(previous, next) { if (!previous || !next) return 0; return Math.max(...next.map((point, index) => distance(point, previous[index]))); }
export function validateQuad(quad, { minArea = 0.12, minInset = 0.035, minEdgeConsistency = 0.5, minAspect = 0.25, maxAspect = 4.5 } = {}) {
  const metrics = { area: 0, aspectRatio: 0, edgeConsistency: 0, reason: "invalid-shape" };
  if (!Array.isArray(quad) || quad.length !== 4 || quad.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) return { valid: false, metrics };
  if (quad.some(point => point.x < minInset || point.x > 1 - minInset || point.y < minInset || point.y > 1 - minInset)) { metrics.reason = "edge-of-frame"; return { valid: false, metrics }; }
  metrics.area = Math.abs(signedArea(quad)); metrics.aspectRatio = aspectRatio(quad); metrics.edgeConsistency = edgeConsistency(quad);
  if (metrics.area < minArea) { metrics.reason = "area-too-small"; return { valid: false, metrics }; }
  if (!isConvex(quad)) { metrics.reason = "non-convex-or-crossed"; return { valid: false, metrics }; }
  if (metrics.edgeConsistency < minEdgeConsistency) { metrics.reason = "inconsistent-opposite-edges"; return { valid: false, metrics }; }
  if (metrics.aspectRatio < minAspect || metrics.aspectRatio > maxAspect) { metrics.reason = "aspect-ratio-out-of-range"; return { valid: false, metrics }; }
  metrics.reason = "valid"; return { valid: true, metrics };
}
