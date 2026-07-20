import { rankContourComponents } from "./trace-components.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

export function rankTraceLines(components = [], { width = 1, height = 1, priority = .6, focus = null } = {}) {
  const ranked = rankContourComponents(components, { width, height, focus });
  const keep = Math.max(1, Math.ceil(ranked.length * (.12 + clamp(priority) * .88)));
  return ranked.map((component, index) => ({ ...component, priority: index < keep ? 1 : 0, rank: index })).filter(component => component.priority);
}

export function applyLinePriority(image, lines = []) {
  if (!lines.length) return image; const keep = new Uint8Array(image.width * image.height); lines.forEach(line => line.points?.forEach(point => { if (point.x >= 0 && point.y >= 0 && point.x < image.width && point.y < image.height) keep[point.y * image.width + point.x] = 1; })); const output = new Uint8ClampedArray(image.data); for (let i = 0; i < keep.length; i += 1) if (!keep[i]) { const index = i * 4; output[index] = output[index + 1] = output[index + 2] = 0; output[index + 3] = 0; } return { ...image, data: output };
}

export function scoreTraceQuality(image, components = [], { sourceBlur = 0, noise = 0 } = {}) {
  if (!image?.data?.length) return { score: 0, status: "No trace", warnings: ["No processed image is available."], suggestions: ["Retry processing with a valid image."] };
  let active = 0; let sum = 0; let sumSquares = 0; let transitions = 0; let previous = 0;
  for (let i = 0; i < image.data.length; i += 4) { const value = image.data[i] / 255; active += value > .7 ? 1 : 0; sum += value; sumSquares += value * value; if (i && (value > .7) !== Boolean(previous)) transitions += 1; previous = value > .7 ? 1 : 0; }
  const pixels = image.data.length / 4; const mean = sum / Math.max(1, pixels); const variance = Math.max(0, sumSquares / Math.max(1, pixels) - mean * mean); const density = active / Math.max(1, pixels); const transitionRatio = transitions / Math.max(1, pixels); const averageComponentSize = components.length ? components.reduce((total, component) => total + component.size, 0) / components.length : 0; const fragmentRatio = components.length / Math.max(1, active / 12); const blank = density < .005; const overfilled = density > .55; const lowVariation = variance < .002; const fragmented = components.length > 3 && (averageComponentSize < 40 || transitionRatio > .2); const contrast = Math.min(1, Math.sqrt(variance) * 2 + transitionRatio * 2);
  const score = Math.round(clamp((blank || lowVariation ? 0 : .35) + Math.min(.3, density * 2) + Math.min(.2, contrast * .2) + Math.min(.15, components.length / 20) - (fragmented ? .18 : 0) - Math.min(.15, sourceBlur * .05) - Math.min(.1, noise * .1)) * 100);
  const warnings = []; const suggestions = [];
  if (blank) { warnings.push("Very little structure detected."); suggestions.push("Increase sensitivity or source contrast."); }
  if (!blank && lowVariation) { warnings.push("Very little tonal variation detected."); suggestions.push("Use a reference with clearer light and dark separation."); }
  if (overfilled) { warnings.push("Trace is densely filled."); suggestions.push("Lower Detail or increase smoothing."); }
  if (fragmented) { warnings.push("Too many disconnected fragments."); suggestions.push("Lower Detail or increase smoothing."); }
  if (sourceBlur > .5) { warnings.push("Source appears blurred."); suggestions.push("Cleaner input may improve contour quality."); }
  return { score: Math.max(0, Math.min(100, score)), density, variance, transitionRatio, componentCount: components.length, averageComponentSize, fragmentRatio, warnings, suggestions, status: score >= 70 && !warnings.length ? "Good trace" : score >= 40 ? "Trace can be improved" : "Weak trace" };
}

// Compact, presentation-ready metrics for the tracing UI. Keep this separate
// from quality scoring so changing a warning threshold never changes what a
// creator sees as the amount of work in a trace.
export function summarizeTrace(result = {}) {
  const width = Math.max(1, Number(result.width) || 1);
  const height = Math.max(1, Number(result.height) || 1);
  const lines = Array.isArray(result.lines) ? result.lines : [];
  const contours = Array.isArray(result.contours) ? result.contours : lines;
  const length = lines.reduce((total, line) => {
    const points = Array.isArray(line?.points) ? line.points : [];
    return total + points.slice(1).reduce((sum, point, index) => {
      const previous = points[index];
      const x = Number(point?.x), y = Number(point?.y), previousX = Number(previous?.x), previousY = Number(previous?.y);
      // Do not allow malformed optional points to poison all displayed stats.
      return sum + (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(previousX) && Number.isFinite(previousY) ? Math.hypot(x - previousX, y - previousY) : 0);
    }, 0);
  }, 0);
  const finiteLength = Number.isFinite(length) ? length : 0;
  return {
    contourCount: contours.length,
    lineCount: lines.length,
    totalLength: Math.round(finiteLength),
    coverage: Math.min(1, finiteLength / Math.max(1, width * height * .08)),
    quality: Math.max(0, Math.min(100, Math.round(Number(result.quality?.score) || 0)))
  };
}

export function generateValueZones(image, levels = 5) {
  const count = Math.max(3, Math.min(8, Math.round(Number(levels) || 5))); const output = new Uint8Array(image.width * image.height); for (let i = 0; i < output.length; i += 1) output[i] = Math.min(count - 1, Math.floor((image.data[i * 4] / 256) * count)); return { levels: count, data: output, width: image.width, height: image.height };
}

export function generateTraceStages(image, components = []) {
  const sorted = [...components].sort((a, b) => b.size - a.size); const count = sorted.length; return [0, 1, 2, 3, 4].map(stage => ({ stage, components: sorted.filter((_, index) => index < Math.max(1, Math.ceil(count * ([.18, .38, .62, .86, 1][stage])))).map(component => component.points) }));
}

export function applyTraceMask(image, mask) {
  const strokes = Array.isArray(mask?.strokes) ? mask.strokes.filter(stroke => stroke && Array.isArray(stroke.points) && stroke.points.length) : []; if (!strokes.length) return image; const output = new Uint8ClampedArray(image.data); const width = image.width; const inside = (x, y, stroke) => stroke.points.some(point => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) && Math.hypot(x - point.x * width, y - point.y * image.height) <= Math.max(1, Number(stroke.radius) || 12));
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < width; x += 1) { const stroke = strokes.find(item => inside(x, y, item)); if (!stroke) continue; const index = (y * width + x) * 4; if (stroke.mode === "ignore") output[index] = output[index + 1] = output[index + 2] = 0; if (stroke.mode === "protect") output[index + 3] = 255; }
  return { ...image, data: output };
}
