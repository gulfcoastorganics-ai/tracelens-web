import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GHOST_BRUSH, GHOST_BRUSH_LIMITS, appendGhostBrushTrail, ghostBrushChanged, ghostBrushRenderInstructions, ghostBrushStageToOverlayPoint, normalizeGhostBrush, normalizeGhostBrushPoint, resolveGhostBrushPosition } from "../ghost-brush.js";

test("Ghost Brush defaults are disabled and stable", () => assert.deepEqual(normalizeGhostBrush(), DEFAULT_GHOST_BRUSH));

test("malformed state normalizes modes, finite values, and bounds", () => {
  const state = normalizeGhostBrush({ enabled: "yes", mode: "unknown", radius: Infinity, feather: -1, referenceOpacity: 4, outsideOpacity: -2, edgeStrength: "bad", trailLength: 99, followEndpoint: 0 });
  assert.deepEqual(state, { enabled: true, mode: "spotlight", radius: 96, feather: 0, referenceOpacity: 1, outsideOpacity: 0, edgeStrength: .5, trailEnabled: false, trailLength: 12, followEndpoint: true, locked: false });
});

test("point normalization rejects invalid input and clamps viewport coordinates", () => {
  assert.equal(normalizeGhostBrushPoint({ x: NaN, y: 2 }, { width: 100, height: 100 }), null);
  assert.deepEqual(normalizeGhostBrushPoint({ x: -3, y: 104 }, { width: 100, height: 100 }), { x: 0, y: 100 });
  assert.equal(normalizeGhostBrushPoint({ x: 1, y: 1 }, { width: 0, height: 100 }), null);
});

test("pointer position wins and endpoint fallback is explicit", () => {
  assert.deepEqual(resolveGhostBrushPosition({ pointer: { x: 20, y: 30 }, endpoint: { x: 80, y: 90 }, followEndpoint: true }, { width: 100, height: 100 }), { x: 20, y: 30 });
  assert.deepEqual(resolveGhostBrushPosition({ pointer: null, endpoint: { x: 80, y: 90 }, followEndpoint: true }, { width: 100, height: 100 }), { x: 80, y: 90 });
  assert.equal(resolveGhostBrushPosition({ pointer: null, endpoint: null, followEndpoint: true }, { width: 100, height: 100 }), null);
});

test("overlay coordinate conversion remains finite and honors mirroring", () => {
  assert.deepEqual(ghostBrushStageToOverlayPoint({ x: 20, y: 50 }, { x: 0, y: 0, scale: 1, rotation: 0, flipped: false }, { width: 100, height: 100 }), { x: 20, y: 50 });
  assert.deepEqual(ghostBrushStageToOverlayPoint({ x: 20, y: 50 }, { x: 0, y: 0, scale: 1, rotation: 0, flipped: true }, { width: 100, height: 100 }), { x: 80, y: 50 });
  const point = ghostBrushStageToOverlayPoint({ x: 20, y: 50 }, { x: Infinity, y: 0, scale: -2, rotation: NaN }, { width: 100, height: 100 });
  assert.equal(Number.isFinite(point.x) && Number.isFinite(point.y), true);
});

test("mask instructions are finite and safe for zero-size viewports", () => {
  const instructions = ghostBrushRenderInstructions({ enabled: true, radius: 120, feather: .5 }, { x: 50, y: 60 }, { width: 200, height: 160 });
  assert.equal(instructions.visible, true);
  assert.equal(instructions.mask.includes("NaN"), false);
  assert.equal(instructions.mask.includes("Infinity"), false);
  const empty = ghostBrushRenderInstructions({ enabled: true }, null, { width: 0, height: 0 });
  assert.equal(empty.visible, false);
});

test("trail sampling is distance bounded and clears at zero length", () => {
  let trail = [];
  for (let index = 0; index < 40; index += 1) trail = appendGhostBrushTrail(trail, { x: index * 10, y: 10 }, { maxSamples: 6 });
  assert.equal(trail.length, 6);
  assert.equal(appendGhostBrushTrail(trail, { x: 500, y: 500 }, { maxSamples: 0 }).length, 0);
  assert.equal(GHOST_BRUSH_LIMITS.maxTrailSamples, 12);
});

test("trail and Edge Focus instructions remain bounded", () => {
  const instructions = ghostBrushRenderInstructions({ enabled: true, mode: "trail", trailEnabled: true, trailLength: 2 }, { x: 50, y: 50 }, { width: 100, height: 100, trail: [{ x: 10, y: 10 }, { x: 30, y: 30 }, { x: 50, y: 50 }] });
  assert.equal(instructions.trail.length, 2);
  assert.match(ghostBrushRenderInstructions({ enabled: true, mode: "edge-focus", edgeStrength: 1 }, { x: 1, y: 1 }, { width: 10, height: 10 }).filter, /contrast/);
});

test("settings change detection supports transaction-style history", () => {
  assert.equal(ghostBrushChanged(DEFAULT_GHOST_BRUSH, { ...DEFAULT_GHOST_BRUSH, radius: 180 }), true);
  assert.equal(ghostBrushChanged(DEFAULT_GHOST_BRUSH, { ...DEFAULT_GHOST_BRUSH, radius: 96.0001 }), false);
});
