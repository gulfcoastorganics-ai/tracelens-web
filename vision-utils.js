export class VisionUtils {
  constructor(width = 160, height = 120) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  analyze(video) {
    if (!video.videoWidth || video.readyState < 2) return null;
    const { width, height } = this.canvas;
    this.context.drawImage(video, 0, 0, width, height);
    const pixels = this.context.getImageData(0, 0, width, height).data;
    let sum = 0, sumSquares = 0, min = 255, max = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const luminance = (pixels[i] * 0.2126) + (pixels[i + 1] * 0.7152) + (pixels[i + 2] * 0.0722);
      sum += luminance; sumSquares += luminance * luminance; min = Math.min(min, luminance); max = Math.max(max, luminance); count += 1;
    }
    const average = sum / count;
    return { average, contrast: Math.sqrt(Math.max(0, sumSquares / count - average ** 2)), dynamicRange: max - min, timestamp: performance.now() };
  }
}
