/** Pure coordinate, smoothing, prediction, and contour helpers for Trace Guide. */
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

export function distance(a, b) { return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)); }
export function lerpPoint(a, b, amount = .25) { const t = clamp(amount); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

/** Map normalized video coordinates into stage pixels, including cover crop/mirror. */
export function videoToStage(point, { videoWidth, videoHeight, stageWidth, stageHeight, mirrored = false, fit = "cover" } = {}) {
  if (!videoWidth || !videoHeight || !stageWidth || !stageHeight) return null;
  const scale = fit === "contain" ? Math.min(stageWidth / videoWidth, stageHeight / videoHeight) : Math.max(stageWidth / videoWidth, stageHeight / videoHeight);
  const drawnWidth = videoWidth * scale; const drawnHeight = videoHeight * scale; const cropX = (drawnWidth - stageWidth) / 2; const cropY = (drawnHeight - stageHeight) / 2; const sourceX = mirrored ? 1 - clamp(point.x) : clamp(point.x);
  return { x: sourceX * drawnWidth - cropX, y: clamp(point.y) * drawnHeight - cropY, scale, cropX, cropY };
}

/** Inverse of `videoToStage`; used when UI points must be compared to landmarks. */
export function stageToVideo(point, dimensions = {}) {
  const mapped = videoToStage({ x: 0, y: 0 }, dimensions); if (!mapped) return null; const { videoWidth, videoHeight, stageWidth, stageHeight, mirrored = false, fit = "cover" } = dimensions; const scale = fit === "contain" ? Math.min(stageWidth / videoWidth, stageHeight / videoHeight) : Math.max(stageWidth / videoWidth, stageHeight / videoHeight); const drawnWidth = videoWidth * scale; const drawnHeight = videoHeight * scale; const cropX = (drawnWidth - stageWidth) / 2; const cropY = (drawnHeight - stageHeight) / 2; const sourceX = (point.x + cropX) / drawnWidth; return { x: mirrored ? 1 - sourceX : sourceX, y: (point.y + cropY) / drawnHeight };
}

export function layerToStage(point, { width, height, x = 0, y = 0, scale = 1, rotation = 0, flipped = false } = {}) {
  const radians = rotation * Math.PI / 180; const local = { x: (point.x - .5) * width * scale * (flipped ? -1 : 1), y: (point.y - .5) * height * scale }; const rotated = { x: local.x * Math.cos(radians) - local.y * Math.sin(radians), y: local.x * Math.sin(radians) + local.y * Math.cos(radians) }; return { x: width / 2 + x + rotated.x, y: height / 2 + y + rotated.y };
}

/** Low-pass filter a point; smaller alpha is steadier but adds visible latency. */
export function smoothPoint(previous, next, strength = "Medium") { if (!next) return previous || null; if (!previous || strength === "Off") return { ...next }; const alpha = { Light: .42, Medium: .24, Strong: .12 }[strength] ?? .24; return lerpPoint(previous, next, alpha); }

/** Extrapolate only recent, confident motion and cap distance to avoid stale-frame jumps. */
export function predictPoint(current, previous, deltaSeconds, confidence = 1, maxDistance = 18) { if (!current || !previous || confidence < .55 || !deltaSeconds || deltaSeconds > .25) return current ? { ...current } : null; const velocity = { x: (current.x - previous.x) / deltaSeconds, y: (current.y - previous.y) / deltaSeconds }; const length = Math.hypot(velocity.x, velocity.y); if (!length) return { ...current }; const distanceLimit = Math.min(maxDistance, length * .035); return { x: current.x + velocity.x / length * distanceLimit, y: current.y + velocity.y / length * distanceLimit }; }

export function projectPointToSegment(point, start, end) { const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy; const t = lengthSquared ? clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared) : 0; const projected = { x: start.x + dx * t, y: start.y + dy * t }; return { point: projected, t, distance: distance(point, projected) }; }
export function angleOf(vector) { return Math.atan2(vector.y, vector.x); }

export function resampleContour(points = [], spacing = 4, closed = false) {
  if (points.length < 2) return points.map(point => ({ ...point })); const output = [{ ...points[0] }]; let carry = 0; const source = closed ? [...points, points[0]] : points;
  for (let index = 1; index < source.length; index += 1) { let start = source[index - 1]; const end = source[index]; let segment = distance(start, end); while (carry + segment >= spacing && segment > 0) { const ratio = (spacing - carry) / segment; start = lerpPoint(start, end, ratio); output.push({ ...start }); segment = distance(start, end); carry = 0; } carry += segment; }
  return output;
}

export function createContourTarget(points = [], { closed = false, spacing = 4 } = {}) { const sampled = resampleContour(points, spacing, closed); const lengths = [0]; for (let index = 1; index < sampled.length; index += 1) lengths[index] = lengths[index - 1] + distance(sampled[index - 1], sampled[index]); return { points: sampled, lengths, totalLength: lengths.at(-1) || 0, closed }; }

export function nearestContourPoint(target, point, { progressIndex = 0, searchRadius = 28, direction = 1, allowGlobal = false } = {}) {
  if (!target?.points?.length || !point) return null; const count = target.points.length; const start = Math.max(0, progressIndex - searchRadius); const end = Math.min(count - 1, progressIndex + searchRadius); let best = null;
  const inspect = (index, segmentIndex = index) => { const nextIndex = segmentIndex + 1 < count ? segmentIndex + 1 : target.closed ? 0 : null; if (nextIndex === null) return; const projected = projectPointToSegment(point, target.points[segmentIndex], target.points[nextIndex]); const progress = target.lengths[segmentIndex] + distance(target.points[segmentIndex], projected.point); if (!best || projected.distance < best.distance) best = { ...projected, index: segmentIndex, progress, tangent: { x: target.points[nextIndex].x - target.points[segmentIndex].x, y: target.points[nextIndex].y - target.points[segmentIndex].y }, direction }; };
  for (let index = start; index <= end; index += 1) inspect(index); if (allowGlobal && (!best || best.distance > searchRadius * 1.5)) for (let index = 0; index < count - (target.closed ? 0 : 1); index += 1) inspect(index); return best;
}
