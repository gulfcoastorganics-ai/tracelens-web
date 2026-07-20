import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("service-worker activation only removes TraceLens shell caches", () => {
  assert.match(sw, /key\.startsWith\("tracelens-shell-"\)/);
  assert.doesNotMatch(sw, /keys\.filter\(key => key !== CACHE\)/);
});
