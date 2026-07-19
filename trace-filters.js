import { getTraceStage } from "./trace-stages.js";

function clamp(value, min = 0, max = 255) { return Math.max(min, Math.min(max, value)); }

export function grayscale(image) {
  const output = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 4) { const value = (image.data[i] * 54 + image.data[i + 1] * 183 + image.data[i + 2] * 19) >> 8; output[i] = output[i + 1] = output[i + 2] = value; output[i + 3] = image.data[i + 3]; }
  return { data: output, width: image.width, height: image.height };
}

export function adjustContrast(image, amount = 1) {
  const output = new Uint8ClampedArray(image.data.length); const factor = Math.max(.1, Number(amount) || 1);
  for (let i = 0; i < image.data.length; i += 4) { output[i] = clamp(factor * (image.data[i] - 128) + 128); output[i + 1] = clamp(factor * (image.data[i + 1] - 128) + 128); output[i + 2] = clamp(factor * (image.data[i + 2] - 128) + 128); output[i + 3] = image.data[i + 3]; }
  return { data: output, width: image.width, height: image.height };
}

export function blurGray(image, radius = 1) {
  const source = grayscale(image); const output = new Uint8ClampedArray(source.data.length); const { width, height } = source; const size = Math.max(1, Math.min(3, Math.round(radius)));
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { let sum = 0; let count = 0; for (let dy = -size; dy <= size; dy += 1) for (let dx = -size; dx <= size; dx += 1) { const sx = x + dx; const sy = y + dy; if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue; sum += source.data[(sy * width + sx) * 4]; count += 1; } const index = (y * width + x) * 4; const value = sum / count; output[index] = output[index + 1] = output[index + 2] = value; output[index + 3] = source.data[index + 3]; }
  return { data: output, width, height };
}

export function sobelEdges(image, threshold = 0.22, invert = false) {
  const source = grayscale(image); const { width, height } = source; const values = new Float32Array(width * height); let max = 1;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) { const at = (row, col) => source.data[(row * width + col) * 4]; const gx = -at(y - 1, x - 1) + at(y - 1, x + 1) - 2 * at(y, x - 1) + 2 * at(y, x + 1) - at(y + 1, x - 1) + at(y + 1, x + 1); const gy = -at(y - 1, x - 1) - 2 * at(y - 1, x) - at(y - 1, x + 1) + at(y + 1, x - 1) + 2 * at(y + 1, x) + at(y + 1, x + 1); const magnitude = Math.hypot(gx, gy); values[y * width + x] = magnitude; max = Math.max(max, magnitude); }
  const output = new Uint8ClampedArray(source.data.length); for (let i = 0; i < values.length; i += 1) { const value = values[i] / max >= threshold ? 255 : 0; const visible = invert ? 255 - value : value; const index = i * 4; output[index] = output[index + 1] = output[index + 2] = visible; output[index + 3] = source.data[index + 3]; }
  return { data: output, width, height };
}

export function threshold(image, level = 0.5, invert = false) {
  const source = grayscale(image); const output = new Uint8ClampedArray(source.data.length); const target = level * 255;
  for (let i = 0; i < source.data.length; i += 4) { const value = source.data[i] >= target ? 255 : 0; const visible = invert ? 255 - value : value; output[i] = output[i + 1] = output[i + 2] = visible; output[i + 3] = source.data[i + 3]; }
  return { data: output, width: source.width, height: source.height };
}

export function posterize(image, levels = 5) {
  const source = image; const output = new Uint8ClampedArray(source.data.length); const bands = Math.max(2, Math.round(levels));
  for (let i = 0; i < source.data.length; i += 4) for (let channel = 0; channel < 3; channel += 1) output[i + channel] = Math.round(Math.round(source.data[i + channel] / 255 * (bands - 1)) / (bands - 1) * 255); for (let i = 3; i < source.data.length; i += 4) output[i] = source.data[i];
  return { data: output, width: source.width, height: source.height };
}

export function composeTrace(image, settings = {}) {
  const mode = settings.mode || "Original"; if (mode === "Original") return image;
  const stage = getTraceStage(settings.stage); const contrast = settings.contrast ?? (1.05 + (settings.strength ?? .55) * .35); const blur = (settings.blur ?? 1) + stage.blur; const level = clamp((settings.threshold ?? .48) + stage.thresholdBias, .03, .95); const invert = Boolean(settings.invert || mode === "Inverted Lines");
  if (mode === "Grayscale") return adjustContrast(grayscale(image), contrast);
  if (mode === "Posterize") return posterize(adjustContrast(image, contrast), settings.levels || 5);
  if (mode === "High Contrast") return threshold(adjustContrast(image, contrast), level, invert);
  if (mode === "Silhouette") return sobelEdges(blurGray(image, blur + 1), Math.max(.24, level), invert);
  if (mode === "Clean Lines") return sobelEdges(blurGray(image, blur + 1), Math.max(.18, level), invert);
  if (mode === "Detailed Lines") return sobelEdges(blurGray(image, Math.max(1, blur)), Math.max(.08, level * .7), invert);
  if (mode === "Inverted Lines") return sobelEdges(blurGray(image, blur + 1), Math.max(.14, level), true);
  if (mode === "Structure") return sobelEdges(blurGray(image, blur + 2), Math.max(.2, level), invert);
  return sobelEdges(blurGray(adjustContrast(image, contrast), blur), level, invert);
}

export function imageDataToArray(image) { return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height }; }
