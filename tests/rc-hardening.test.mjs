import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GestureCoach } from "../onboarding.js";

const root = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const library = fs.readFileSync(path.join(root, "project-library.js"), "utf8");
const pwa = fs.readFileSync(path.join(root, "pwa.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("diagnostics animation loop has explicit start/stop ownership", () => {
  assert.match(app, /function startVisionLoop\(\)/);
  assert.match(app, /function stopVisionLoop\(\)/);
  assert.match(app, /if \(!visionLoopStarted\) return/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /stopVisionLoop\(\);/);
});

test("camera, image import, and save operations reject stale completions", () => {
  assert.match(app, /cameraRequestToken/);
  assert.match(app, /if \(request !== cameraRequestToken\)/);
  assert.match(app, /imageImportToken/);
  assert.match(app, /pendingImageReader\.abort/);
  assert.match(app, /projectOperationToken/);
  assert.match(app, /operation !== projectOperationToken/);
  assert.match(app, /isSupportedImageFile/);
  assert.match(app, /read-start-failed/);
});

test("corrupt thumbnail assets fail safely", () => {
  assert.match(library, /image\.onerror = \(\) => resolve\(fallback\)/);
  assert.match(library, /if \(!context\) \{ resolve\(fallback\)/);
  assert.match(library, /catch \(error\).*resolve\(fallback\)/s);
});

test("repeated PWA initialization shares one registration promise", () => {
  assert.match(pwa, /let registrationPromise = null/);
  assert.match(pwa, /if \(registrationPromise\) return registrationPromise/);
});

test("beta diagnostics is cached and enabled by a deterministic release flag", () => {
  const flags = fs.readFileSync(path.join(root, "feature-flags.js"), "utf8");
  assert.match(sw, /beta-diagnostics\.js/);
  assert.match(flags, /diagnostics: true/);
  assert.match(app, /betaDiagnosticsPanel/);
  assert.match(app, /downloadDiagnosticReport/);
  assert.match(sw, /image-import\.js/);
});

test("repeated onboarding display clears prior timers", () => {
  const timers = new Set(); let clearCount = 0;
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  globalThis.window = { setTimeout(callback, delay) { const timer = { callback, delay }; timers.add(timer); return timer; }, clearTimeout(timer) { if (timer) { clearCount += 1; timers.delete(timer); } } };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const element = { hidden: true, classList: { add() {}, remove() {} } };
  const coach = new GestureCoach(element); coach.show(); coach.show(); coach.dismiss();
  assert.equal(clearCount >= 2, true);
  globalThis.window = originalWindow; globalThis.localStorage = originalStorage;
});
