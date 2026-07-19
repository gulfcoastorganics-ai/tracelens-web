import assert from "node:assert/strict";
import { createProjectBundle, migrateProjectBundle, validateProjectBundle } from "../project-bundles.js";
import { HistoryStack } from "../history.js";
import { applyBlendMode, BLEND_MODES } from "../blend-modes.js";
import { calculateCalibration, fromMillimeters, toMillimeters } from "../physical-calibration.js";

const project = { id: "p1", name: "Test", image: "data:image/png;base64,test", layers: [{ id: "l1", image: "data:image/png;base64,test" }] };
const bundle = createProjectBundle(project);
assert.equal(validateProjectBundle(bundle), true);
assert.equal(migrateProjectBundle(bundle).project.schemaVersion, 2);
assert.equal(validateProjectBundle({ format: "tracelens-project", version: 999, project }), false);
const legacy = migrateProjectBundle({ format: "tracelens-project", version: 1, project: { image: project.image } });
assert.equal(legacy.project.layers.length, 1);

const history = new HistoryStack(2);
history.push({ value: 1 }); history.push({ value: 2 }); history.push({ value: 3 });
assert.deepEqual(history.undo(), { value: 2 });
assert.deepEqual(history.redo(), { value: 3 });
assert.equal(history.entries.length, 2);

assert.deepEqual(BLEND_MODES, ["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Difference"]);
const element = { style: {} }; applyBlendMode(element, "Multiply"); assert.equal(element.style.mixBlendMode, "multiply");
assert.equal(toMillimeters(1, "in"), 25.4);
assert.equal(fromMillimeters(25.4, "in"), 1);
const calibration = calculateCalibration({ referenceWidth: 210, referenceHeight: 297, quad: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], desiredWidth: 420, unit: "mm" });
assert.equal(calibration.desiredHeightMm, 594);
console.log("release core tests passed");
