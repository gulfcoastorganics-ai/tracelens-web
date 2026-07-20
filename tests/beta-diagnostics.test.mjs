import test from "node:test";
import assert from "node:assert/strict";
import {
  BetaDiagnostics,
  createDiagnosticEventLog,
  createDiagnosticReport,
  diagnosticFilename,
  downloadDiagnosticReport,
  normalizeDiagnosticViewport
} from "../beta-diagnostics.js";

test("diagnostic report has a versioned privacy-safe schema", () => {
  const report = createDiagnosticReport({ build: { version: "test" }, application: { activeProject: true, tracePoints: [{ x: 1 }] }, camera: { frame: "secret", mediaLabel: "private" }, viewport: { dpr: Infinity } });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.build.version, "test");
  assert.equal(report.application.tracePoints, undefined);
  assert.equal(report.camera.frame, undefined);
  assert.equal(report.camera.mediaLabel, undefined);
  assert.equal(report.viewport.dpr, null);
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("reports remain valid when browser APIs are unavailable", () => {
  const report = createDiagnosticReport({ capabilities: { mediaDevices: false, indexedDB: false }, viewport: normalizeDiagnosticViewport({ width: "bad", height: 0, dpr: NaN }) });
  assert.equal(report.capabilities.mediaDevices, false);
  assert.equal(report.viewport.width, null);
  assert.equal(report.viewport.devicePixelRatio, null);
});

test("event logs are bounded and sanitize metadata", () => {
  const log = createDiagnosticEventLog({ maxEntries: 2, clock: () => 100 });
  log.record("first", { message: "ok", tracePoints: [1, 2], bad: Infinity });
  log.record("second", { nested: { stream: "secret" } });
  log.record("third", { value: 4 });
  assert.equal(log.size, 2);
  assert.deepEqual(log.entries().map(entry => entry.type), ["second", "third"]);
  assert.equal(log.entries()[1].metadata.value, 4);
  assert.equal(log.entries()[0].metadata.nested.stream, undefined);
});

test("warnings and errors are bounded and all report numbers are finite or null", () => {
  const diagnostics = new BetaDiagnostics({ build: "test", maxEntries: 2 });
  for (let index = 0; index < 25; index += 1) {
    diagnostics.warning(`warning-${index}`, { value: Infinity });
    diagnostics.error(`error-${index}`, { value: NaN, projectTitle: "private" });
  }
  const report = diagnostics.report({ application: { pending: Infinity } });
  assert.equal(report.recentWarnings.length, 20);
  assert.equal(report.recentErrors.length, 20);
  assert.equal(report.application.pending, null);
  assert.equal(JSON.stringify(report).includes("private"), false);
  assert.doesNotThrow(() => JSON.stringify(report));
});

test("diagnostic error strings redact paths and credential-like values", () => {
  const diagnostics = new BetaDiagnostics({ build: "test" });
  diagnostics.error("Failed file:///Users/alice/private.png token=secret Bearer abc123", { source: "window" });
  const serialized = JSON.stringify(diagnostics.report());
  assert.equal(serialized.includes("alice"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("abc123"), false);
});

test("diagnostic reports exclude trace, image, frame, and media-label data", () => {
  const diagnostics = new BetaDiagnostics({ build: "test" });
  diagnostics.record("import", { filename: "secret.png", imageData: "secret", trace: [{ x: 2 }], cameraFrame: "secret", userAgent: "Chrome" });
  const report = diagnostics.report();
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("secret.png"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes('"userAgent":"Chrome"'), true);
});

test("download uses a private filename and revokes its object URL", () => {
  let revoked = "";
  let clicked = false;
  const anchor = { click: () => { clicked = true; }, remove: () => {} };
  const filename = downloadDiagnosticReport({ schemaVersion: 1 }, {
    BlobCtor: class BlobMock { constructor(parts, options) { this.parts = parts; this.options = options; } },
    createObjectURL: () => "blob:test",
    revokeObjectURL: value => { revoked = value; },
    documentRef: { createElement: () => anchor },
    setTimeoutFn: callback => callback(),
    date: new Date("2026-07-19T12:34:56Z")
  });
  assert.equal(clicked, true);
  assert.equal(revoked, "blob:test");
  assert.equal(filename, "tracelens-diagnostic-20260719-123456.json");
  assert.equal(filename.includes("secret"), false);
});
