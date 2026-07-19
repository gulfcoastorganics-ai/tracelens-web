import assert from "node:assert/strict";
import { canCompleteStep, completeStep, createGuidedState, setStep } from "../guided-tracing.js";
import { normalizeGhostStroke, sampleGhostStroke } from "../ghost-stroke.js";
import { compareImageData, comparisonSummary } from "../comparison.js";
import { createLayer, cloneLayers } from "../layers.js";

const initial = createGuidedState({ enabled: true });
assert.equal(initial.steps.length, 5); assert.equal(canCompleteStep(initial, 1), false); assert.equal(canCompleteStep(initial, 0), true);
const first = completeStep(initial, 0); assert.equal(first.steps[0].completed, true); assert.equal(first.sessionProgress > 0, true); assert.equal(setStep(first, 2).activeStep, 2);
const stroke = normalizeGhostStroke({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], durationMs: 1000 }); assert.deepEqual(sampleGhostStroke(stroke, 500), { x: 5, y: 0, progress: .5, index: 0, complete: false }); assert.equal(sampleGhostStroke(stroke, 1000).complete, true);
const image = (value) => ({ width: 2, height: 2, data: new Uint8ClampedArray([value, value, value, 255, value, value, value, 255, value, value, value, 255, value, value, value, 255]) });
const result = compareImageData(image(0), image(255)); assert.equal(result.status, "complete"); assert.equal(result.metrics.mismatchRatio, 1); assert.match(comparisonSummary(result), /Difference 100%/); assert.equal(compareImageData(null, image(1)).status, "missing-input");
const layer = createLayer({ image: "data:image/png;base64,test" }); const cloned = cloneLayers([layer]); cloned[0].guided.steps[0].completed = true; assert.equal(layer.guided.steps[0].completed, false, "guided state must not be shared between layer clones");
console.log("guided tracing and comparison tests passed");
