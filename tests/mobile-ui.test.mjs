import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must remain unique");
for (const id of ["quickTraceBar", "quickOriginalButton", "quickAssistButton", "quickTraceExpandButton", "traceModeChips", "traceDetailInput", "tracePriorityInput", "traceQuality", "traceGuideOverlay", "traceGuideEnabledInput", "traceGuideModeInput", "traceGuideStatus", "layersToggle", "adjustSheet"]) assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
assert.match(css, /100dvh|--app-viewport-height/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /trace-mode-chips/);
assert.match(css, /trace-control-section/);
assert.match(app, /layersExpanded = false/);
assert.match(app, /adjustSheet\.dataset\.state = nextState/);
console.log("mobile UI static checks passed");
