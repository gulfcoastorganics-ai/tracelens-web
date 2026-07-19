import assert from "node:assert/strict";
import { createLayer, duplicateLayer, cloneLayers } from "../layers.js";

const first = createLayer({ image: "data:image/png;base64,one", name: "Sketch" });
assert.equal(first.visible, true);
assert.equal(first.opacity, .55);
const copy = duplicateLayer(first);
assert.notEqual(copy.id, first.id);
assert.equal(copy.name, "Sketch copy");
const cloned = cloneLayers([first, copy]);
assert.equal(cloned.length, 2);
assert.notEqual(cloned[0], first);
console.log("layer model tests passed");
