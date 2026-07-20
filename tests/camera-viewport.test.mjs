import test from "node:test";
import assert from "node:assert/strict";
import { waitForVideoMetadata } from "../camera-lifecycle.js";
import { createViewportCoordinator } from "../viewport-coordinator.js";
import { classifyCameraError } from "../camera-errors.js";

function fakeVideo(width = 0, height = 0) {
  const listeners = new Map();
  return { videoWidth: width, videoHeight: height, addEventListener(type, callback) { listeners.set(type, callback); }, removeEventListener(type) { listeners.delete(type); }, emit(type) { listeners.get(type)?.(); } };
}

test("video metadata waits for non-zero dimensions", async () => {
  const video = fakeVideo();
  const pending = waitForVideoMetadata(video, { timeoutMs: 1000, setTimeoutFn: () => 1, clearTimeoutFn() {} });
  video.videoWidth = 1280; video.videoHeight = 720; video.emit("loadedmetadata");
  assert.equal(await pending, video);
});

test("zero video dimensions produce a safe metadata timeout", async () => {
  const video = fakeVideo();
  await assert.rejects(waitForVideoMetadata(video, { timeoutMs: 0 }), error => error.cameraCode === "metadata-timeout");
  assert.equal(classifyCameraError({ cameraCode: "metadata-timeout" }).code, "metadata-timeout");
});

test("viewport signals coalesce into one update and can be cancelled", () => {
  const callbacks = []; let updates = 0;
  const coordinator = createViewportCoordinator({ onUpdate: () => { updates += 1; }, schedule: callback => { callbacks.push(callback); return callbacks.length; }, cancel: () => {} });
  coordinator.schedule(); coordinator.schedule(); assert.equal(callbacks.length, 1); callbacks[0](); assert.equal(updates, 1);
  coordinator.schedule(); coordinator.cancel(); assert.equal(coordinator.pending, false);
});
