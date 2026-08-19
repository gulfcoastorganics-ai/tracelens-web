import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("Ghost Compare is integrated into the existing workspace", () => {
  assert.match(app, /ghostCompareRenderInstructions/);
  assert.match(app, /compareState/);
  assert.match(app, /releaseCompareInteraction/);
  assert.match(app, /prepareGhostDifference/);
  assert.match(app, /ghostCompareDivider/);
  assert.match(html, /data-compare-mode="reference"/);
  assert.match(html, /data-compare-mode="difference"/);
  assert.match(html, /role="slider"/);
});

test("comparison assets are included in offline release coverage", () => {
  assert.match(sw, /ghost-compare\.js/);
});

test("comparison owns split interaction without using the trace stage", () => {
  assert.match(app, /ghostCompareDivider\?\.addEventListener\("pointerdown"/);
  assert.match(app, /event\.stopPropagation\(\)/);
  assert.match(app, /pointercancel/);
  assert.match(app, /pagehide/);
});
