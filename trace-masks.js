export function normalizeTraceMask(mask) {
  if (!mask || !Array.isArray(mask.strokes)) return { version: 1, strokes: [] };
  return { version: 1, strokes: mask.strokes.filter(stroke => stroke && Array.isArray(stroke.points)).map(stroke => ({ mode: ["ignore", "protect", "simplify", "trace"].includes(stroke.mode) ? stroke.mode : "ignore", radius: Math.max(1, Math.min(200, Number(stroke.radius) || 12)), points: stroke.points.filter(point => point && typeof point === "object").map(point => ({ x: Math.max(0, Math.min(1, Number(point.x) || 0)), y: Math.max(0, Math.min(1, Number(point.y) || 0)) })) })).filter(stroke => stroke.points.length) };
}

export function addMaskStroke(mask, mode, points, radius = 12) {
  const normalized = normalizeTraceMask(mask); normalized.strokes.push({ mode, radius, points }); return normalized;
}
