export class PerspectiveSolver {
  toPixels(quad, width, height) { return quad.map(point => ({ x: point.x * width, y: point.y * height })); }
}

export class OverlaySnapController {
  constructor(canvas) { this.canvas = canvas || document.createElement("canvas"); this.context = this.canvas.getContext("2d"); this.active = false; this.sourceKey = null; this.image = null; this.loadPromise = null; this.generation = 0; this.decodeCount = 0; }

  snap(imageSource, quad, width, height, opacity = 0.55) {
    const sourceKey = imageSource;
    const generation = ++this.generation;
    const draw = image => { if (generation !== this.generation || sourceKey !== this.sourceKey) return; this.canvas.width = width; this.canvas.height = height; this.canvas.style.opacity = opacity; this.context.clearRect(0, 0, width, height); this.drawTriangle(image, 0, 0, image.width, 0, image.width, image.height, quad[0], quad[1], quad[2]); this.drawTriangle(image, 0, 0, image.width, image.height, 0, image.height, quad[0], quad[2], quad[3]); this.canvas.hidden = false; this.active = true; };
    if (this.sourceKey === sourceKey && this.image) { draw(this.image); return; }
    if (this.sourceKey === sourceKey && this.loadPromise) { this.loadPromise.then(draw); return; }
    this.sourceKey = sourceKey; this.image = null; this.loadPromise = new Promise((resolve, reject) => { const image = new Image(); image.onload = () => { this.decodeCount += 1; resolve(image); }; image.onerror = () => reject(new Error("Perspective image could not be decoded.")); image.src = imageSource; }).then(image => { if (generation === this.generation && sourceKey === this.sourceKey) this.image = image; draw(image); }).catch(error => { if (generation === this.generation) { this.active = false; this.canvas.hidden = true; this.onError?.(error); } });
  }

  drawTriangle(image, sx0, sy0, sx1, sy1, sx2, sy2, d0, d1, d2) {
    const context = this.context;
    const denominator = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
    const a = (d0.x * (sy1 - sy2) + d1.x * (sy2 - sy0) + d2.x * (sy0 - sy1)) / denominator;
    const c = (d0.x * (sx2 - sx1) + d1.x * (sx0 - sx2) + d2.x * (sx1 - sx0)) / denominator;
    const e = d0.x - a * sx0 - c * sy0;
    const b = (d0.y * (sy1 - sy2) + d1.y * (sy2 - sy0) + d2.y * (sy0 - sy1)) / denominator;
    const d = (d0.y * (sx2 - sx1) + d1.y * (sx0 - sx2) + d2.y * (sx1 - sx0)) / denominator;
    const f = d0.y - b * sx0 - d * sy0;
    context.save(); context.beginPath(); context.moveTo(d0.x, d0.y); context.lineTo(d1.x, d1.y); context.lineTo(d2.x, d2.y); context.closePath(); context.clip(); context.setTransform(a, b, c, d, e, f); context.drawImage(image, 0, 0); context.restore();
  }

  clear() { this.generation += 1; this.sourceKey = null; this.image = null; this.loadPromise = null; this.active = false; this.canvas.hidden = true; this.context.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}
