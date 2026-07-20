import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GHOST_COMPARE, ghostCompareChanged, ghostCompareRenderInstructions, normalizeGhostCompare } from "../ghost-compare.js";

test("Ghost Compare defaults are safe and disabled", () => {
  assert.deepEqual(normalizeGhostCompare(), DEFAULT_GHOST_COMPARE);
});

test("malformed persisted state is bounded and Difference falls back", () => {
  const state = normalizeGhostCompare({ enabled: "yes", mode: "difference", blend: "nope", splitPosition: 4, referenceOpacity: -2, traceOpacity: Infinity, splitOrientation: "diagonal" });
  assert.deepEqual(state, { enabled: true, mode: "split", blend: .5, splitPosition: 1, splitOrientation: "vertical", referenceOpacity: 0, traceOpacity: 1 });
});

test("Difference mode is retained only when data is available", () => {
  assert.equal(normalizeGhostCompare({ mode: "difference" }, { differenceAvailable: true }).mode, "difference");
});

test("render instructions remain finite for normal and zero-size viewports", () => {
  const instructions = ghostCompareRenderInstructions({ enabled: true, mode: "split", splitPosition: .25 }, { width: 400, height: 300 });
  assert.equal(instructions.referenceClipPath, "inset(0 75% 0 0)");
  assert.equal(instructions.traceClipPath, "inset(0 0 0 25%)");
  assert.equal(instructions.visible, true);
  const empty = ghostCompareRenderInstructions({ enabled: true }, { width: 0, height: 0 });
  assert.equal(empty.visible, false);
  for (const value of Object.values(empty)) if (typeof value === "number") assert.equal(Number.isFinite(value), true);
});

test("horizontal split uses finite boundary values", () => {
  const instructions = ghostCompareRenderInstructions({ enabled: true, mode: "split", splitPosition: .75, splitOrientation: "horizontal" }, { width: 1, height: 1 });
  assert.equal(instructions.referenceClipPath, "inset(0 0 25% 0)");
  assert.equal(instructions.traceClipPath, "inset(75% 0 0 0)");
  assert.equal(instructions.dividerPosition, "25%");
});

test("meaningful compare changes are detectable", () => {
  assert.equal(ghostCompareChanged(DEFAULT_GHOST_COMPARE, { ...DEFAULT_GHOST_COMPARE, splitPosition: .8 }), true);
  assert.equal(ghostCompareChanged(DEFAULT_GHOST_COMPARE, { ...DEFAULT_GHOST_COMPARE, blend: .5001 }), false);
});

test("old projects without compare state normalize compatibly", () => {
  assert.deepEqual(normalizeGhostCompare({ enabled: true }), { ...DEFAULT_GHOST_COMPARE, enabled: true });
});
