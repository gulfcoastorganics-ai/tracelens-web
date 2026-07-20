/** Browser-safe camera readiness helpers. DOM ownership stays in app.js. */
export function waitForVideoMetadata(video, { timeoutMs = 4000, setTimeoutFn = globalThis.setTimeout, clearTimeoutFn = globalThis.clearTimeout } = {}) {
  if (!video) return Promise.reject(Object.assign(new Error("Camera metadata could not be read."), { cameraCode: "metadata-failed" }));
  if (Number(video.videoWidth) > 0 && Number(video.videoHeight) > 0) return Promise.resolve(video);
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = 0;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      video.removeEventListener?.("loadedmetadata", onReady);
      video.removeEventListener?.("resize", onReady);
      if (timer) clearTimeoutFn?.(timer);
      if (error) reject(error); else resolve(video);
    };
    const onReady = () => {
      if (Number(video.videoWidth) > 0 && Number(video.videoHeight) > 0) finish();
    };
    timer = typeof setTimeoutFn === "function" ? setTimeoutFn(() => finish(Object.assign(new Error("Camera metadata did not become ready."), { name: "NotReadableError", cameraCode: "metadata-timeout" })), timeoutMs) : 0;
    video.addEventListener?.("loadedmetadata", onReady);
    video.addEventListener?.("resize", onReady);
    onReady();
  });
}
