import assert from "node:assert/strict";
import { grayscale, adjustContrast, threshold, posterize, sobelEdges, composeTrace } from "../trace-filters.js";
import { TraceCache, traceCacheKey } from "../trace-cache.js";
import { TRACE_STAGES, getTraceStage } from "../trace-stages.js";
import { findContourComponents, rankContourComponents } from "../trace-components.js";

function fixture(width = 9, height = 9) { const data = new Uint8ClampedArray(width * height * 4); for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 20; for (let y = 2; y < 7; y += 1) for (let x = 2; x < 7; x += 1) { const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 240; data[i + 3] = 255; } for (let i = 3; i < data.length; i += 4) data[i] = 255; return { data, width, height }; }
const input = fixture();
const gray = grayscale(input); assert.equal(gray.data[0], 20); assert.equal(gray.data[4], 20);
assert.ok(adjustContrast(input, 1.5).data.some(value => value !== input.data[0]));
const binary = threshold(input, .5); assert.ok(binary.data.includes(0)); assert.ok(binary.data.includes(255));
const poster = posterize(input, 3); assert.ok(new Set(poster.data.filter((_, index) => index % 4 !== 3)).size <= 3);
const edges = sobelEdges(input, .1); assert.ok(edges.data.includes(255));
assert.equal(composeTrace(input, { mode: "Original" }), input);
assert.equal(composeTrace(input, { mode: "Clean Lines", stage: 0 }).width, input.width);

const cache = new TraceCache(2); cache.set("a", { data: new Uint8Array(4) }, 4); cache.set("b", { data: new Uint8Array(4) }, 4); assert.ok(cache.get("a")); cache.set("c", { data: new Uint8Array(4) }, 4); assert.equal(cache.get("b"), null); assert.equal(cache.size, 2); assert.equal(traceCacheKey("source", { threshold: .4, mode: "Clean Lines" }), traceCacheKey("source", { mode: "Clean Lines", threshold: .4 }));
assert.equal(TRACE_STAGES.length, 5); assert.equal(getTraceStage(99).name, "Tonal guide");
const contours = findContourComponents({ data: sobelEdges(input, .1).data, width: input.width, height: input.height }, { minSize: 2 }); assert.ok(contours.length >= 1); assert.equal(rankContourComponents(contours, { width: input.width, height: input.height })[0].relevance >= 0, true);
console.log("trace assist tests passed");
