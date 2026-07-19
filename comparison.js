export function compareImageData(reference, drawing, { threshold = 24 } = {}) {
  if (!validImage(reference) || !validImage(drawing)) return { status: "missing-input", confidence: 0, width: 0, height: 0, diff: null, metrics: null };
  const width = Math.min(reference.width, drawing.width); const height = Math.min(reference.height, drawing.height); const diff = new Uint8ClampedArray(width * height * 4); let changed = 0; let total = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const ri = (y * reference.width + x) * 4; const di = (y * drawing.width + x) * 4; const oi = (y * width + x) * 4; const delta = (Math.abs(reference.data[ri] - drawing.data[di]) + Math.abs(reference.data[ri + 1] - drawing.data[di + 1]) + Math.abs(reference.data[ri + 2] - drawing.data[di + 2])) / 3; const value = Math.min(255, Math.round(delta * 2)); diff[oi] = value; diff[oi + 1] = Math.max(0, 255 - value); diff[oi + 2] = value > threshold ? 48 : 24; diff[oi + 3] = 255; total += delta; if (delta > threshold) changed += 1; }
  const pixels = width * height; const mismatchRatio = pixels ? changed / pixels : 1; const meanDelta = pixels ? total / pixels : 255; const confidence = Math.max(0, Math.min(1, Math.min(reference.width, drawing.width) / Math.max(reference.width, drawing.width) * Math.min(reference.height, drawing.height) / Math.max(reference.height, drawing.height)));
  return { status: "complete", confidence, width, height, diff: { data: diff, width, height }, metrics: { mismatchRatio, meanDelta, comparedPixels: pixels } };
}

export function comparisonSummary(result) {
  if (!result || result.status !== "complete") return "Comparison needs two valid images.";
  const ratio = Math.round(result.metrics.mismatchRatio * 100); const confidence = Math.round(result.confidence * 100); return `Difference ${ratio}% · confidence ${confidence}%`;
}

function validImage(image) { return image && Number.isInteger(image.width) && image.width > 0 && Number.isInteger(image.height) && image.height > 0 && image.data?.length >= image.width * image.height * 4; }
