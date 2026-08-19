import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const html = read("index.html");
const sw = read("sw.js");

test("Ghost Brush controls and module are integrated", () => {
  assert.match(app, /normalizeGhostBrush/); assert.match(app, /renderGhostBrush/); assert.match(app, /updateGhostBrushPointer/); assert.match(app, /ghostBrushState/);
  assert.match(html, /id="ghostBrushPanel"/); assert.match(html, /id="ghostBrushModeInput"/); assert.match(html, /id="ghostBrushToggleButton"/);
  assert.match(sw, /ghost-brush\.js/);
});

test("Ghost Brush observes the existing stage pointer path without owning trace events", () => {
  assert.match(app, /ghostBrushPointerId === null/); assert.match(app, /stage\.getBoundingClientRect\(\)/); assert.match(app, /lostpointercapture/); assert.match(app, /releaseGhostBrushInteraction\(\{ clearTrail: true \}\)/);
  assert.match(app, /renderGhostBrush\(\)/);
});

test("Ghost Brush persistence is additive and transient samples are cleared", () => {
  assert.match(app, /ghostBrush: \{ \.\.\.ghostBrushState \}/); assert.match(app, /next\.ghostBrush \|\| DEFAULT_GHOST_BRUSH/); assert.match(app, /ghostBrushTrail = \[\]/);
});

test("Compare suspends Ghost Brush presentation", () => {
  assert.match(app, /compareState\.enabled/); assert.match(app, /Suspended during Compare/); assert.match(app, /if \(!ghostBrushState\.enabled \|\| compareState\.enabled/);
});
