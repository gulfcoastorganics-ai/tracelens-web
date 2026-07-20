/**
 * Privacy-safe diagnostics for internal beta validation.
 *
 * This module deliberately stores only bounded, sanitized metadata. It never
 * accepts project objects, image elements, media streams, trace points, or
 * camera frames as report data. The report is a troubleshooting aid, not a
 * session recording or telemetry pipeline.
 */

export const DIAGNOSTICS_SCHEMA_VERSION = 1;
export const DIAGNOSTICS_MAX_EVENTS = 80;
export const DIAGNOSTICS_MAX_STRING = 160;

const PRIVATE_KEYS = /(?:^|[a-z_])(?:trace|points?|image|frame|canvas|stream|mediaLabel|filename|filepath|projectData|projectTitle|projectName|projectContent|objectUrl|blob|pixel|geometry)(?:$|[A-Z_])/i;

export function sanitizeDiagnosticsString(value, maxLength = DIAGNOSTICS_MAX_STRING) {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b(?:Bearer|Basic)\s+[^\s]+/gi, "$1 [redacted]")
    .replace(/\b(?:api[_-]?key|token|secret|password|authorization)\s*[=:]\s*[^\s&]+/gi, "$1=[redacted]")
    .replace(/(?:file:\/\/|(?:[A-Za-z]:[\\/]|\/(?:home|Users|private|tmp|var)\/))[^\s"'`]+/g, "[path]")
    .trim().slice(0, Math.max(1, maxLength));
}

export function finiteDiagnosticNumber(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeValue(value, depth = 0, key = "") {
  if (depth > 3 || (key !== "devicePixelRatio" && PRIVATE_KEYS.test(key))) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeDiagnosticsString(value);
  if (value === null) return null;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeValue(item, depth + 1)).filter(item => item !== undefined);
  if (typeof value !== "object") return undefined;
  const output = {};
  Object.keys(value).slice(0, 40).forEach(childKey => {
    const child = sanitizeValue(value[childKey], depth + 1, childKey);
    if (child !== undefined) output[sanitizeDiagnosticsString(childKey, 48) || "field"] = child;
  });
  return output;
}

export function sanitizeDiagnosticsValue(value) {
  return sanitizeValue(value);
}

export function normalizeDiagnosticViewport({ width, height, visualWidth, visualHeight, dpr, orientation, angle } = {}) {
  return {
    width: finiteDiagnosticNumber(width),
    height: finiteDiagnosticNumber(height),
    visualWidth: finiteDiagnosticNumber(visualWidth),
    visualHeight: finiteDiagnosticNumber(visualHeight),
    devicePixelRatio: finiteDiagnosticNumber(dpr),
    orientation: sanitizeDiagnosticsString(orientation) || "unknown",
    angle: finiteDiagnosticNumber(angle)
  };
}

export function createDiagnosticEventLog({ maxEntries = DIAGNOSTICS_MAX_EVENTS, clock = () => Date.now() } = {}) {
  const entries = [];
  const limit = Math.max(1, Math.min(500, Math.floor(Number(maxEntries) || DIAGNOSTICS_MAX_EVENTS)));
  let sequence = 0;
  return {
    record(type, metadata = {}) {
      const event = {
        sequence: ++sequence,
        timestamp: finiteDiagnosticNumber(clock()) || Date.now(),
        type: sanitizeDiagnosticsString(type, 64) || "unknown",
        metadata: sanitizeDiagnosticsValue(metadata) || {}
      };
      entries.push(event);
      while (entries.length > limit) entries.shift();
      return event;
    },
    clear() { entries.length = 0; },
    entries() { return entries.map(event => ({ ...event, metadata: { ...event.metadata } })); },
    get size() { return entries.length; }
  };
}

export function createDiagnosticReport({
  generatedAt = new Date().toISOString(),
  build = {}, environment = {}, viewport = {}, capabilities = {}, camera = {},
  application = {}, storage = {}, serviceWorker = {}, features = {},
  recentEvents = [], recentWarnings = [], recentErrors = []
} = {}) {
  return {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    generatedAt: sanitizeDiagnosticsString(generatedAt, 64) || new Date(0).toISOString(),
    build: sanitizeDiagnosticsValue(build) || {},
    environment: sanitizeDiagnosticsValue(environment) || {},
    viewport: sanitizeDiagnosticsValue(viewport) || {},
    capabilities: sanitizeDiagnosticsValue(capabilities) || {},
    camera: sanitizeDiagnosticsValue(camera) || {},
    application: sanitizeDiagnosticsValue(application) || {},
    storage: sanitizeDiagnosticsValue(storage) || {},
    serviceWorker: sanitizeDiagnosticsValue(serviceWorker) || {},
    features: sanitizeDiagnosticsValue(features) || {},
    recentEvents: sanitizeDiagnosticsValue(recentEvents) || [],
    recentWarnings: sanitizeDiagnosticsValue(recentWarnings) || [],
    recentErrors: sanitizeDiagnosticsValue(recentErrors) || []
  };
}

export function diagnosticFilename(date = new Date()) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date(0);
  const pad = number => String(number).padStart(2, "0");
  return `tracelens-diagnostic-${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}-${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}.json`;
}

/** Create a browser download and revoke its temporary URL after the click. */
export function downloadDiagnosticReport(report, {
  BlobCtor = globalThis.Blob,
  createObjectURL = globalThis.URL?.createObjectURL,
  revokeObjectURL = globalThis.URL?.revokeObjectURL,
  documentRef = globalThis.document,
  setTimeoutFn = globalThis.setTimeout,
  date = new Date()
} = {}) {
  if (typeof BlobCtor !== "function" || typeof createObjectURL !== "function" || !documentRef?.createElement) return false;
  const blob = new BlobCtor([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = diagnosticFilename(date);
  anchor.rel = "noopener";
  anchor.click();
  const revoke = () => { if (typeof revokeObjectURL === "function") revokeObjectURL(url); anchor.remove?.(); };
  if (typeof setTimeoutFn === "function") setTimeoutFn(revoke, 0);
  else revoke();
  return anchor.download;
}

export class BetaDiagnostics {
  constructor({ build = "web-mvp", maxEntries = DIAGNOSTICS_MAX_EVENTS, clock } = {}) {
    this.build = sanitizeDiagnosticsString(build) || "web-mvp";
    this.log = createDiagnosticEventLog({ maxEntries, clock });
    this.warnings = [];
    this.errors = [];
  }

  record(type, metadata) { return this.log.record(type, metadata); }
  warning(message, metadata = {}) { this.warnings.push({ message: sanitizeDiagnosticsString(message) || "warning", ...sanitizeDiagnosticsValue(metadata) }); this.warnings = this.warnings.slice(-20); }
  error(message, metadata = {}) { this.errors.push({ message: sanitizeDiagnosticsString(message) || "error", ...sanitizeDiagnosticsValue(metadata) }); this.errors = this.errors.slice(-20); }
  clear() { this.log.clear(); this.warnings = []; this.errors = []; }
  report(context = {}) {
    return createDiagnosticReport({ ...context, build: { version: this.build, ...context.build }, recentEvents: this.log.entries(), recentWarnings: this.warnings, recentErrors: this.errors });
  }
}
