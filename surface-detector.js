import { VisionUtils } from "./vision-utils.js";

export class SurfaceDetector {
  constructor({ interval = 200, onUpdate } = {}) {
    this.interval = interval;
    this.onUpdate = onUpdate;
    this.vision = new VisionUtils(160, 120);
    this.luminance = new Uint8Array(160 * 120);
    this.running = false;
    this.lastRun = 0;
    this.lastResult = null;
  }

  start(video) {
    if (this.running && this.video === video) return;
    this.video = video;
    this.running = true;
    this.tick();
  }

  stop() { this.running = false; }

  tick = (now = performance.now()) => {
    if (!this.running) return;
    if (now - this.lastRun >= this.interval) {
      this.lastRun = now;
      const result = this.detect();
      if (result) { this.lastResult = result; this.onUpdate?.(result); }
    }
    requestAnimationFrame(this.tick);
  };

  detect() {
    if (!this.video?.videoWidth || this.video.readyState < 2) return null;
    const canvas = this.vision.canvas;
    const context = this.vision.context;
    const { width, height } = canvas;
    context.drawImage(this.video, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const luminance = this.luminance;
    let mean = 0;
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      luminance[p] = (pixels[i] * 54 + pixels[i + 1] * 183 + pixels[i + 2] * 19) >> 8; mean += luminance[p];
    }
    mean /= luminance.length;
    const threshold = Math.max(14, Math.min(42, mean * 0.18));
    let left = width, right = 0, top = height, bottom = 0, edges = 0;
    for (let y = 2; y < height - 2; y += 2) for (let x = 2; x < width - 2; x += 2) {
      const index = y * width + x;
      const horizontal = Math.abs(luminance[index] - luminance[index - 2]);
      const vertical = Math.abs(luminance[index] - luminance[index - width * 2]);
      if (Math.max(horizontal, vertical) > threshold) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); edges += 1; }
    }
    const area = Math.max(0, right - left) * Math.max(0, bottom - top);
    const frameArea = width * height;
    if (edges < 18 || area < frameArea * 0.12) return { found: false, confidence: 0 };
    const inset = 2;
    const quad = [
      { x: (left + inset) / width, y: (top + inset) / height },
      { x: (right - inset) / width, y: (top + inset) / height },
      { x: (right - inset) / width, y: (bottom - inset) / height },
      { x: (left + inset) / width, y: (bottom - inset) / height }
    ];
    const confidence = Math.round(Math.min(0.98, 0.45 + (area / frameArea) * 0.35 + Math.min(0.2, edges / 500)) * 100);
    return { found: true, type: "planar surface", confidence, quad, timestamp: performance.now() };
  }
}
