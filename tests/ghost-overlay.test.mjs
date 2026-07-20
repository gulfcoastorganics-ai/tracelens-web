import assert from "node:assert/strict";
import { DEFAULT_GHOST_OVERLAY, ghostOverlayChanged, ghostOverlayCssTransform, normalizeGhostOverlay, normalizeGhostRotation } from "../ghost-overlay.js";
import { createLayer, normalizeLayer } from "../layers.js";

const finiteTransform = value => !/[Nn]a[Nn]|[Ii]nfinity/.test(value);

assert.deepEqual(normalizeGhostOverlay(), DEFAULT_GHOST_OVERLAY);
assert.equal(normalizeGhostOverlay({ opacity: "nope", scale: -0, rotation: Infinity, x: NaN, y: "bad" }).opacity, .55);
assert.equal(normalizeGhostOverlay({ opacity: "2", scale: -9 }).opacity, 1);
assert.equal(normalizeGhostOverlay({ opacity: "2", scale: -9 }).scale, 5);
assert.equal(normalizeGhostOverlay({ scale: 0 }).scale, .1);
assert.equal(normalizeGhostRotation(540), 180);
assert.equal(normalizeGhostRotation(-540), -180);

const bounded = normalizeGhostOverlay({ x: Infinity, y: -Infinity, rotation: 721 }, { viewportWidth: 320, viewportHeight: 640 });
assert.equal(bounded.rotation, 1);
assert.ok(Math.abs(bounded.x) <= 2000 && Math.abs(bounded.y) <= 2000);
const css = ghostOverlayCssTransform({ x: "bad", y: NaN, scale: 0, rotation: Infinity }, { flip: true, viewportWidth: 0, viewportHeight: 0 });
assert.ok(finiteTransform(css));
assert.match(css, /translate3d\(/);

assert.equal(ghostOverlayChanged({ x: 0 }, { x: 0 }), false);
assert.equal(ghostOverlayChanged({ x: 0 }, { x: 3 }), true);

const legacy = normalizeLayer(createLayer({ image: "data:image/png;base64,legacy", x: 14, y: -8, scale: 1.5, opacity: .4, locked: true }));
assert.equal(legacy.ghost.imageRef, null);
assert.deepEqual({ ...legacy.ghost, imageRef: null }, { enabled: true, opacity: .4, scale: 1.5, rotation: 0, x: 14, y: -8, locked: true, imageRef: null });
const malformed = normalizeLayer({ image: "data:image/png;base64,old", visible: false, x: "bad", scale: 0, rotation: NaN, opacity: "bad" });
assert.equal(malformed.ghost.enabled, false);
assert.equal(malformed.ghost.scale, .1);
assert.ok(finiteTransform(ghostOverlayCssTransform(malformed.ghost)));

console.log("ghost overlay tests passed");
