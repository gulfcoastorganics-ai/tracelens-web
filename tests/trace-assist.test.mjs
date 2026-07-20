import assert from "node:assert/strict";
import { summarizeTrace } from "../trace-analysis.js";
import { grayscale, adjustContrast, threshold, posterize, sobelEdges, composeTrace } from "../trace-filters.js";
import { TraceCache, traceCacheKey } from "../trace-cache.js";
import { TRACE_STAGES, getTraceStage } from "../trace-stages.js";
import { findContourComponents, rankContourComponents } from "../trace-components.js";
import { TRACE_MODES, normalizeTraceSettings, detailMapping } from "../trace-presets.js";
import { rankTraceLines, applyLinePriority, scoreTraceQuality, generateValueZones, generateTraceStages, applyTraceMask } from "../trace-analysis.js";
import { normalizeTraceMask, addMaskStroke } from "../trace-masks.js";
import { TraceEngine, resultToDataUrl } from "../trace-engine.js";
import { getWorkflowPreset } from "../workflow-presets.js";

function fixture(width = 9, height = 9) { const data = new Uint8ClampedArray(width * height * 4); for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 20; for (let y = 2; y < 7; y += 1) for (let x = 2; x < 7; x += 1) { const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 240; data[i + 3] = 255; } for (let i = 3; i < data.length; i += 4) data[i] = 255; return { data, width, height }; }
function synthetic(width, height, pixel) { const data = new Uint8ClampedArray(width * height * 4); for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const value = Math.max(0, Math.min(255, pixel(x, y))); const index = (y * width + x) * 4; data[index] = data[index + 1] = data[index + 2] = value; data[index + 3] = 255; } return { data, width, height }; }
let noiseSeed = 17; const randomByte = () => { noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff; return noiseSeed % 256; };
const fixtures = {
  blankWhite: synthetic(32, 32, () => 255), blankBlack: synthetic(32, 32, () => 0), simpleSquare: synthetic(32, 32, (x, y) => x > 8 && x < 24 && y > 8 && y < 24 ? 0 : 255),
  diagonal: synthetic(32, 32, (x, y) => Math.abs(x - y) <= 1 ? 0 : 255), thickCurve: synthetic(32, 32, (x, y) => Math.abs(Math.hypot(x - 16, y - 16) - 10) < 2 ? 0 : 255), checkerboard: synthetic(32, 32, (x, y) => (x + y) % 2 ? 0 : 255), lowContrast: synthetic(32, 32, x => 110 + x), silhouette: synthetic(32, 32, (x, y) => Math.hypot(x - 16, y - 16) < 10 ? 0 : 255), denseNoise: synthetic(32, 32, () => randomByte()),
  architecture: synthetic(32, 32, (x, y) => x % 8 < 2 || y % 8 < 2 ? 0 : 255), portraitLike: synthetic(32, 32, (x, y) => Math.hypot(x - 16, y - 15) < 11 || (Math.abs(x - 12) < 2 && Math.abs(y - 13) < 2) || (Math.abs(x - 20) < 2 && Math.abs(y - 13) < 2) ? 40 : 220), multiValue: synthetic(32, 32, (x, y) => Math.floor(x / 8) * 50 + Math.floor(y / 8) * 12)
};
const input = fixture();
const gray = grayscale(input); assert.equal(gray.data[0], 20); assert.equal(gray.data[4], 20);
assert.ok(adjustContrast(input, 1.5).data.some(value => value !== input.data[0]));
const binary = threshold(input, .5); assert.ok(binary.data.includes(0)); assert.ok(binary.data.includes(255));
const poster = posterize(input, 3); assert.ok(new Set(poster.data.filter((_, index) => index % 4 !== 3)).size <= 3);
const edges = sobelEdges(input, .1); assert.ok(edges.data.includes(255));
assert.equal(composeTrace(input, { mode: "Original" }), input);
assert.equal(composeTrace(input, { mode: "Clean Lines", stage: 0 }).width, input.width);
for (const mode of ["Clean Contour", "Pencil Sketch", "Technical Outline", "Shadow Blocks", "High-Contrast Stencil", "Comic Ink", "Simplified Portrait", "Architecture"]) assert.equal(composeTrace(input, { mode, detail: .6, levels: 5 }).width, input.width);
assert.equal(composeTrace(input, { mode: "Architecture", isolation: true, lineWeight: "Structural" }).height, input.height);

const cache = new TraceCache(2); cache.set("a", { data: new Uint8Array(4) }, 4); cache.set("b", { data: new Uint8Array(4) }, 4); assert.ok(cache.get("a")); cache.set("c", { data: new Uint8Array(4) }, 4); assert.equal(cache.get("b"), null); assert.equal(cache.size, 2); assert.equal(traceCacheKey("source", { threshold: .4, mode: "Clean Lines" }), traceCacheKey("source", { mode: "Clean Lines", threshold: .4 }));
assert.equal(TRACE_STAGES.length, 5); assert.equal(getTraceStage(99).name, "Tonal guide");
const contours = findContourComponents({ data: sobelEdges(input, .1).data, width: input.width, height: input.height }, { minSize: 2 }); assert.ok(contours.length >= 1); assert.equal(rankContourComponents(contours, { width: input.width, height: input.height })[0].relevance >= 0, true);
assert.ok(["Clean Contour", "Pencil Sketch", "Technical Outline", "Shadow Blocks", "High-Contrast Stencil", "Comic Ink", "Simplified Portrait", "Architecture"].every(mode => TRACE_MODES.includes(mode)));
const normalized = normalizeTraceSettings({ mode: "unknown", detail: 2, levels: 99 }); assert.equal(normalized.mode, "Clean Lines"); assert.equal(normalized.detail, 1); assert.equal(normalized.levels, 8); assert.ok(detailMapping({ mode: "Pencil Sketch", detail: .2 }).minimumComponent > detailMapping({ mode: "Pencil Sketch", detail: .9 }).minimumComponent);
assert.equal(normalizeTraceSettings({ mode: "High Contrast" }).mode, "High Contrast"); assert.equal(normalizeTraceSettings({ mode: "Structure" }).mode, "Structure");
assert.equal(normalizeTraceSettings({ mode: "Pencil Sketch" }).lineWeight, "Structural"); assert.ok(normalizeTraceSettings({ mode: "Pencil Sketch" }).blur >= 2);
assert.ok(getWorkflowPreset("Artist").description.length > 0); assert.ok(getWorkflowPreset("Tattoo").description.toLowerCase().includes("contrast")); assert.ok(getWorkflowPreset("Blueprint").description.toLowerCase().includes("structural"));
const ranked = rankTraceLines(contours, { width: input.width, height: input.height, priority: .2 }); assert.ok(ranked.length >= 1); const quality = scoreTraceQuality(edges, contours); assert.ok(quality.score >= 0 && quality.score <= 100); assert.ok(Array.isArray(quality.warnings));
assert.ok(applyLinePriority(edges, ranked).data.some((value, index) => index % 4 === 3 && value === 0));
const zones = generateValueZones(input, 5); assert.equal(zones.levels, 5); assert.ok(Math.max(...zones.data) < 5); const stages = generateTraceStages(input, contours); assert.equal(stages.length, 5); assert.ok(stages[0].components.length <= stages[4].components.length);
const mask = addMaskStroke(null, "ignore", [{ x: .5, y: .5 }], 20); assert.equal(normalizeTraceMask(mask).strokes.length, 1); const masked = applyTraceMask(input, mask); assert.equal(masked.data[(4 * input.width + 4) * 4], 0);
assert.doesNotThrow(() => normalizeTraceMask({ strokes: [null, { points: [null, { x: "bad", y: .4 }] }] })); assert.doesNotThrow(() => applyTraceMask(input, { strokes: [{ points: [null] }] }));
for (const [name, image] of Object.entries(fixtures)) for (const mode of TRACE_MODES) { const output = composeTrace(image, { mode, detail: .6, priority: .6, levels: 5 }); assert.equal(output.width, image.width, `${name}/${mode} width`); assert.equal(output.height, image.height, `${name}/${mode} height`); assert.equal(output.data.length, image.data.length, `${name}/${mode} buffer`); }
const blankQuality = scoreTraceQuality(composeTrace(fixtures.blankWhite, { mode: "Clean Contour" }), []); const squareOutput = composeTrace(fixtures.simpleSquare, { mode: "Clean Contour" }); const squareComponents = findContourComponents(squareOutput, { minSize: 2 }); const squareQuality = scoreTraceQuality(squareOutput, squareComponents); assert.ok(blankQuality.warnings.some(warning => /structure|variation/i.test(warning))); assert.ok(squareQuality.score > blankQuality.score);
const lowDetail = composeTrace(fixtures.simpleSquare, { mode: "Clean Contour", detail: .1 }); const highDetail = composeTrace(fixtures.simpleSquare, { mode: "Clean Contour", detail: .9 }); assert.notDeepEqual(lowDetail.data, highDetail.data);
const zoneStudy = generateValueZones(fixtures.multiValue, 5); assert.equal(Math.min(...zoneStudy.data), 0); assert.ok(Math.max(...zoneStudy.data) < 5); assert.ok(new Set(zoneStudy.data).size >= 3);
const noiseOutput = composeTrace(fixtures.denseNoise, { mode: "Architecture", detail: .8 }); const noiseQuality = scoreTraceQuality(noiseOutput, findContourComponents(noiseOutput, { minSize: 2 })); assert.ok(noiseQuality.warnings.length >= 0); assert.ok(noiseQuality.transitionRatio >= 0);
const originalWorker = globalThis.Worker; const originalImage = globalThis.Image; const originalDocument = globalThis.document; const originalImageData = globalThis.ImageData;
globalThis.Worker = class PendingWorker { postMessage() {} terminate() {} };
globalThis.Image = class FakeTraceImage { constructor() { this.naturalWidth = 4; this.naturalHeight = 4; } set src(value) { queueMicrotask(() => this.onload?.()); } };
globalThis.document = { createElement() { return { width: 0, height: 0, getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 }) }; } }; } };
const cancellableEngine = new TraceEngine({ resolution: 4 }); const pendingTrace = cancellableEngine.process("data:image/png;base64,test", { mode: "Clean Contour" }); await new Promise(resolve => setTimeout(resolve, 0)); cancellableEngine.cancel(); const cancelledTrace = await pendingTrace; assert.equal(cancelledTrace.cancelled, true); assert.ok(cancellableEngine.diagnostics().cancelledJobs >= 1); cancellableEngine.dispose(); let capturedImage = null; globalThis.ImageData = class FakeImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } }; globalThis.document = { createElement() { return { width: 0, height: 0, toDataURL() { return "data:image/png;base64,test"; }, getContext() { return { putImageData(image) { capturedImage = image; } }; } }; } }; await resultToDataUrl({ data: new Uint8ClampedArray([100, 100, 100, 255, 250, 250, 250, 255]), width: 2, height: 1 }, "transparent", "Shadow Blocks"); assert.equal(capturedImage.data[0], 100); globalThis.Worker = originalWorker; globalThis.Image = originalImage; globalThis.document = originalDocument; globalThis.ImageData = originalImageData;
console.log("trace assist tests passed");
const summary = summarizeTrace({ width: 100, height: 100, contours: [{ points: [{ x: 0, y: 0 }] }], lines: [{ points: [{ x: 0, y: 0 }, { x: 30, y: 40 }] }], quality: { score: 84 } });
assert.deepEqual(summary, { contourCount: 1, lineCount: 1, totalLength: 50, coverage: 0.0625, quality: 84 });
const malformedSummary = summarizeTrace({ width: 100, height: 100, lines: [{ points: [{ x: 0, y: 0 }, { x: undefined, y: 1 }, { x: 0, y: 0 }] }] });
assert.equal(malformedSummary.totalLength, 0);
assert.equal(malformedSummary.coverage, 0);
assert.equal(summarizeTrace({ width: 0, height: 0, lines: [] }).coverage, 0);
