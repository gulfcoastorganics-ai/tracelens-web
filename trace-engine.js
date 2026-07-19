import { composeTrace, imageDataToArray } from "./trace-filters.js";
import { TraceCache, traceCacheKey } from "./trace-cache.js";
import { findContourComponents } from "./trace-components.js";

function fingerprint(source) { let hash = 2166136261; const sample = `${source.length}:${source.slice(0, 96)}:${source.slice(-96)}`; for (let i = 0; i < sample.length; i += 1) { hash ^= sample.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }

export class TraceEngine {
  constructor({ onStatus, resolution = 640, cacheLimit = 12 } = {}) { this.onStatus = onStatus; this.resolution = resolution; this.cache = new TraceCache(cacheLimit); this.sources = new Map(); this.worker = null; this.jobs = new Map(); this.jobId = 0; this.lastRequest = 0; try { this.worker = new Worker("./trace-worker.js", { type: "module" }); this.worker.onmessage = event => this.resolveWorker(event.data); this.worker.onerror = error => { this.worker?.terminate(); this.worker = null; this.onStatus?.({ state: "fallback", detail: error.message || "Worker unavailable" }); }; } catch { this.worker = null; } }

  async decode(source) {
    const key = fingerprint(source); if (this.sources.has(key)) return this.sources.get(key);
    const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("Reference image could not be decoded.")); element.src = source; });
    const ratio = Math.min(1, this.resolution / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio)); const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0, canvas.width, canvas.height); const data = context.getImageData(0, 0, canvas.width, canvas.height); const result = { data: new Uint8ClampedArray(data.data), width: data.width, height: data.height, sourceKey: key }; this.sources.set(key, result); return result;
  }

  async process(source, settings = {}) {
    const sourceKey = fingerprint(source); const key = traceCacheKey(sourceKey, settings, this.resolution); const cached = this.cache.get(key); if (cached) return { ...cached, cached: true, key };
    const requestId = ++this.lastRequest; this.onStatus?.({ state: "processing", requestId }); const sourceImage = await this.decode(source); if (requestId !== this.lastRequest) return { cancelled: true, key };
    let result; if (this.worker) result = await this.runWorker(requestId, imageDataToArray(sourceImage), settings); else result = composeTrace(sourceImage, settings);
    if (requestId !== this.lastRequest) return { cancelled: true, key }; result.contours = findContourComponents(result, { minSize: Math.max(3, Math.round(result.width * result.height * .0002)) }); this.cache.set(key, result, result.data.byteLength); this.onStatus?.({ state: "ready", requestId, cached: false, key, contourCount: result.contours.length }); return { ...result, cached: false, key };
  }

  runWorker(id, image, settings) { return new Promise((resolve, reject) => { this.jobs.set(id, { resolve, reject }); try { this.worker.postMessage({ id, image, settings }, [image.data.buffer]); } catch (error) { this.jobs.delete(id); this.worker = null; resolve(composeTrace(image, settings)); } }); }
  resolveWorker(message) { const job = this.jobs.get(message.id); if (!job) return; this.jobs.delete(message.id); if (message.error) job.reject(new Error(message.error)); else job.resolve(message.result); }
  cancel() { this.lastRequest += 1; this.onStatus?.({ state: "cancelled" }); }
  clearLayerCache(source) { this.sources.delete(fingerprint(source)); }
  diagnostics() { return { worker: Boolean(this.worker), analysisResolution: this.resolution, cacheEntries: this.cache.size, cacheBytes: this.cache.bytes, cacheHits: this.cache.hits, cacheMisses: this.cache.misses, cancelledJobs: this.lastRequest }; }
  dispose() { this.cancel(); this.worker?.terminate(); this.worker = null; this.sources.clear(); this.cache.clear(); }
}

export async function resultToDataUrl(result, background = "transparent", mode = "Original") { const canvas = document.createElement("canvas"); canvas.width = result.width; canvas.height = result.height; const context = canvas.getContext("2d"); const image = new ImageData(new Uint8ClampedArray(result.data), result.width, result.height); const lineMode = ["Clean Lines", "Detailed Lines", "Silhouette", "High Contrast", "Inverted Lines", "Structure"].includes(mode); if (lineMode && (background === "white" || background === "black")) for (let i = 0; i < image.data.length; i += 4) { const edge = image.data[i] > 200; const foreground = background === "white" ? 0 : 255; const base = background === "white" ? 255 : 0; const value = edge ? foreground : base; image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255; } else if (background === "transparent") for (let i = 0; i < image.data.length; i += 4) { const edge = image.data[i] > 200; image.data[i] = image.data[i + 1] = image.data[i + 2] = 255; image.data[i + 3] = edge ? 255 : 0; } context.putImageData(image, 0, 0); return canvas.toDataURL("image/png"); }
