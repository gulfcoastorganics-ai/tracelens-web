/** Region authoring state; points are normalized so regions survive resizing. */
const REGION_LIMIT = 64;

export const REGION_SHAPES = Object.freeze(["rectangle", "polygon", "freeform"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

function regionId() {
  return globalThis.crypto?.randomUUID?.() || `region-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePoints(points) {
  return Array.isArray(points)
    ? points.slice(0, 512).map(point => ({ x: clamp(point?.x, 0, 1), y: clamp(point?.y, 0, 1) }))
    : [];
}

export function createRegion(input = {}) {
  const shape = REGION_SHAPES.includes(input.shape) ? input.shape : "rectangle";
  const points = normalizePoints(input.points);
  const defaultPoints = shape === "rectangle" ? [{ x: .2, y: .2 }, { x: .8, y: .8 }] : [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .5, y: .8 }];
  return {
    id: input.id || regionId(),
    name: String(input.name || "Trace region").trim().slice(0, 80) || "Trace region",
    shape,
    points: points.length >= (shape === "rectangle" ? 2 : 3) ? points : defaultPoints,
    visible: input.visible !== false,
    locked: Boolean(input.locked),
    opacity: clamp(input.opacity ?? 1, 0, 1),
    notes: String(input.notes || "").slice(0, 1000),
    completed: Boolean(input.completed),
    progress: clamp(input.progress ?? 0, 0, 1),
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
    updatedAt: Number(input.updatedAt) || 0
  };
}

export function createRegionState(input = {}) {
  const source = Array.isArray(input.regions) ? input.regions : [];
  const regions = source.slice(0, REGION_LIMIT).map((region, index) => createRegion({ ...region, order: region?.order ?? index }));
  const activeRegionId = regions.some(region => region.id === input.activeRegionId) ? input.activeRegionId : (regions[0]?.id || null);
  return { version: 1, regions, activeRegionId, updatedAt: Number(input.updatedAt) || 0 };
}

export function addRegion(state, input = {}) {
  const next = createRegionState(state);
  if (next.regions.length >= REGION_LIMIT) return next;
  const region = createRegion({ ...input, order: next.regions.length });
  next.regions.push(region);
  next.activeRegionId = region.id;
  next.updatedAt = Date.now();
  return next;
}

export function updateRegion(state, id, patch = {}) {
  const next = createRegionState(state);
  const index = next.regions.findIndex(region => region.id === id);
  if (index < 0) return next;
  next.regions[index] = createRegion({ ...next.regions[index], ...patch, id });
  next.updatedAt = Date.now();
  return next;
}

export function removeRegion(state, id) {
  const next = createRegionState(state);
  next.regions = next.regions.filter(region => region.id !== id).map((region, index) => ({ ...region, order: index }));
  if (next.activeRegionId === id) next.activeRegionId = next.regions[0]?.id || null;
  next.updatedAt = Date.now();
  return next;
}

export function setActiveRegion(state, id) {
  const next = createRegionState(state);
  next.activeRegionId = next.regions.some(region => region.id === id) ? id : next.activeRegionId;
  return next;
}

export function completeRegion(state, id, completed = true) {
  const next = updateRegion(state, id, { completed, progress: completed ? 1 : 0 });
  return next;
}

export function regionProgress(state) {
  const normalized = createRegionState(state);
  return normalized.regions.length ? normalized.regions.reduce((sum, region) => sum + region.progress, 0) / normalized.regions.length : 0;
}

export function regionContainsPoint(region, point) {
  const normalized = createRegion(region);
  const x = Number(point?.x); const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (normalized.shape === "rectangle") {
    const xs = normalized.points.map(item => item.x); const ys = normalized.points.map(item => item.y);
    return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys);
  }
  let inside = false;
  const points = normalized.points;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index]; const prior = points[previous];
    const intersects = ((current.y > y) !== (prior.y > y)) && x < ((prior.x - current.x) * (y - current.y)) / ((prior.y - current.y) || Number.EPSILON) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function activeRegion(state) {
  const normalized = createRegionState(state);
  return normalized.regions.find(region => region.id === normalized.activeRegionId) || null;
}

export { REGION_LIMIT };
