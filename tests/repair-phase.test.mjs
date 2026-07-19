import assert from "node:assert/strict";
import { classifyCameraError } from "../camera-errors.js";
import { createDebouncedTask } from "../debounced-task.js";
import { resolveOverlayDisplay } from "../overlay-visibility.js";
import { SourceCache } from "../source-cache.js";
import { TraceCache } from "../trace-cache.js";
import { migrateProjectBundle } from "../project-bundles.js";
import { HistoryStack } from "../history.js";
import { workspaceFingerprint } from "../workspace-history.js";
import { createTraceQueue } from "../trace-queue.js";
import { ProjectLibrary } from "../project-library.js";
import { OverlaySnapController } from "../perspective.js";

assert.deepEqual(resolveOverlayDisplay({ visible: true, perspective: true }), { overlay: false, perspective: true });
assert.deepEqual(resolveOverlayDisplay({ visible: false, perspective: true }), { overlay: false, perspective: false });
assert.deepEqual(resolveOverlayDisplay({ visible: true, perspective: false }), { overlay: true, perspective: false });

const originalImage = globalThis.Image;
globalThis.Image = class FakeImage {
  constructor() { this.width = 100; this.height = 100; this.naturalWidth = 100; this.naturalHeight = 100; }
  set src(value) { this.srcValue = value; queueMicrotask(() => this.onload?.()); }
};
const context = { clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, setTransform() {}, drawImage() {} };
const canvas = { hidden: true, style: {}, width: 0, height: 0, getContext: () => context };
const snap = new OverlaySnapController(canvas);
const quad = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
snap.snap("source-a", quad, 100, 100); await new Promise(resolve => setTimeout(resolve, 0));
snap.snap("source-a", quad, 100, 100); snap.snap("source-a", quad, 100, 100); await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(snap.decodeCount, 1);
snap.snap("source-b", quad, 100, 100); await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(snap.decodeCount, 2);
snap.clear(); assert.equal(snap.active, false);
globalThis.Image = originalImage;

assert.equal(classifyCameraError({ name: "NotAllowedError" }, { secureContext: true }).code, "permission-denied");
assert.equal(classifyCameraError({ name: "NotFoundError" }, { secureContext: true }).code, "no-device");
assert.equal(classifyCameraError({ name: "NotReadableError" }, { secureContext: true }).code, "busy");
assert.equal(classifyCameraError({}, { secureContext: false }).code, "insecure-context");

const sourceCache = new SourceCache({ maxEntries: 2, maxBytes: 10 });
sourceCache.set("a", { data: new Uint8Array(4) });
sourceCache.set("b", { data: new Uint8Array(4) });
assert.equal(sourceCache.get("a") !== null, true);
sourceCache.set("c", { data: new Uint8Array(4) });
assert.equal(sourceCache.get("b"), null);
sourceCache.markActive("a"); sourceCache.set("d", { data: new Uint8Array(4) });
assert.equal(sourceCache.get("a") !== null, true);
sourceCache.unmarkActive("a"); sourceCache.clear(); assert.equal(sourceCache.size, 0);
assert.doesNotThrow(() => new SourceCache({ maxEntries: NaN, maxBytes: Infinity }));

for (const limit of [0, -1, NaN, Infinity]) {
  const cache = new TraceCache(limit);
  assert.doesNotThrow(() => cache.set("x", { data: new Uint8Array(1) }));
  assert.ok(cache.size <= 12);
}

const layersOnly = migrateProjectBundle({ format: "tracelens-project", version: 2, project: { layers: [{ id: "a", image: "data:image/png;base64,a" }] } });
assert.equal(layersOnly.project.image, "data:image/png;base64,a");
assert.equal(migrateProjectBundle({ format: "tracelens-project", version: 2, project: { layers: [] } }), null);

const history = new HistoryStack(3, { equals: (a, b) => workspaceFingerprint(a) === workspaceFingerprint(b) });
const first = { layers: [{ id: "a", image: "large-source", x: 0 }], activeLayerId: "a" };
assert.equal(history.push(first), true);
assert.equal(history.push({ layers: [{ id: "a", image: "different-source", x: 0 }], activeLayerId: "a" }), false);
assert.equal(history.push({ layers: [{ id: "a", image: "different-source", x: 1 }], activeLayerId: "a" }), true);
assert.equal(history.undo().layers[0].x, 0);
assert.equal(workspaceFingerprint(first).includes("large-source"), false);

let calls = 0;
const debounced = createDebouncedTask(() => { calls += 1; }, 10);
debounced(); debounced();
await new Promise(resolve => setTimeout(resolve, 25));
assert.equal(calls, 1);
debounced(); debounced.cancel();
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(calls, 1);

const processed = [];
const queue = createTraceQueue({ process: async (layer, signal) => { processed.push(layer.id); if (layer.id === "active") await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(signal.isCurrent(), true); } });
await queue.start([{ id: "hidden", visible: false, trace: { enabled: true, mode: "Clean Lines" } }, { id: "other", visible: true, trace: { enabled: true, mode: "Clean Lines" } }, { id: "active", visible: true, trace: { enabled: true, mode: "Clean Lines" } }], "active");
assert.deepEqual(processed, ["active", "other"]);
processed.length = 0;
const cancelled = createTraceQueue({ process: async (layer, signal) => { processed.push(layer.id); await new Promise(resolve => setTimeout(resolve, 15)); assert.equal(signal.isCurrent(), false); } });
const pending = cancelled.start([{ id: "a", visible: true, trace: { enabled: true, mode: "Clean Lines" } }, { id: "b", visible: true, trace: { enabled: true, mode: "Clean Lines" } }], "a");
cancelled.cancel(); await pending; assert.deepEqual(processed, ["a"]);

const originalIndexedDB = globalThis.indexedDB;
let opens = 0;
globalThis.indexedDB = { open() { opens += 1; const request = {}; queueMicrotask(() => { if (opens === 1) { request.error = new Error("temporary"); request.onerror?.(); } else { request.result = { objectStoreNames: { contains: () => true }, close() {} }; request.onsuccess?.(); } }); return request; } };
const library = new ProjectLibrary();
await assert.rejects(library.open());
const [dbA, dbB] = await Promise.all([library.open(), library.open()]);
assert.equal(dbA, dbB); assert.equal(opens, 2);
globalThis.indexedDB = originalIndexedDB;

console.log("repair phase tests passed");
