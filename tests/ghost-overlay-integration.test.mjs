import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const app = read("app.js");
const html = read("index.html");
const sw = read("sw.js");
const layers = read("layers.js");

assert.match(app, /ghostOverlayCssTransform/);
assert.match(app, /normalizeGhostOverlay/);
assert.match(app, /releaseGhostInteraction/);
assert.match(app, /pointercancel/);
assert.match(app, /pushHistory\(\)/);
assert.match(app, /event\.preventDefault\(\)/);
assert.match(app, /viewportWidth: stage\?\.clientWidth/);
assert.match(app, /ghostGestureStart/);
assert.match(app, /releaseGhostInteraction\(\{ restore: true \}\)/);
assert.match(app, /pointers\.size < 2/);
assert.match(html, /Lock Ghost Overlay adjustment/);
assert.match(app, /Enable Ghost Overlay/);
assert.match(sw, /\.\/ghost-overlay\.js/);
assert.match(sw, /tracelens-shell-v9/);
assert.match(layers, /ghost: normalizeGhostOverlay/);

console.log("ghost overlay integration checks passed");
