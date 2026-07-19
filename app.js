import { VisionUtils } from "./vision-utils.js";
import { PerspectiveSolver, OverlaySnapController } from "./perspective.js";
import { AdaptiveOpacityController } from "./adaptive-opacity.js";
import { SurfaceTracker } from "./tracker.js";
import { ProjectLibrary } from "./project-library.js";
import { HistoryStack } from "./history.js";
import { TransformLocks } from "./transform-locks.js";
import { applyBlendMode } from "./blend-modes.js";
import { MeasurementGuides } from "./measurement-guides.js";
import { Diagnostics } from "./diagnostics.js";
import { getWorkflowPreset } from "./workflow-presets.js";
import { createProjectBundle, validateProjectBundle, migrateProjectBundle, downloadProjectBundle } from "./project-bundles.js";
import { CalibrationProfiles } from "./calibration-profiles.js";
import { SessionTimeline } from "./session-timeline.js";
import { PerspectiveSession } from "./perspective-session.js";
import { CALIBRATION_REFERENCES, calculateCalibration, fromMillimeters } from "./physical-calibration.js";
import { GestureCoach } from "./onboarding.js";
import { registerPWA } from "./pwa.js";
import { createLayer, duplicateLayer, cloneLayers } from "./layers.js";
import { TraceEngine, resultToDataUrl } from "./trace-engine.js";
import { classifyCameraError } from "./camera-errors.js";
import { createDebouncedTask } from "./debounced-task.js";
import { resolveOverlayDisplay } from "./overlay-visibility.js";
import { workspaceFingerprint } from "./workspace-history.js";
import { createTraceQueue } from "./trace-queue.js";
import { TRACE_MODES, normalizeTraceSettings } from "./trace-presets.js";
import { normalizeTraceMask } from "./trace-masks.js";

const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const perspectiveOverlay = document.querySelector("#perspectiveOverlay");
const measurementGuides = document.querySelector("#measurementGuides");
const stage = document.querySelector("#stage");
const imageInput = document.querySelector("#imageInput");
const dockImageInput = document.querySelector("#dockImageInput");
const opacityInput = document.querySelector("#opacityInput");
const scaleInput = document.querySelector("#scaleInput");
const rotationInput = document.querySelector("#rotationInput");
const cameraButton = document.querySelector("#cameraButton");
const cameraFacingButton = document.querySelector("#cameraFacingButton");
const cameraState = document.querySelector("#cameraState");
const gridButton = document.querySelector("#gridButton");
const flipButton = document.querySelector("#flipButton");
const resetButton = document.querySelector("#resetButton");
const adjustButton = document.querySelector("#adjustButton");
const compareButton = document.querySelector("#compareButton");
const workspaceButton = document.querySelector("#workspaceButton");
const closeAdjust = document.querySelector("#closeAdjust");
const adjustSheet = document.querySelector("#adjustSheet");
const autoPerspectiveButton = document.querySelector("#autoPerspectiveButton");
const manualPerspectiveButton = document.querySelector("#manualPerspectiveButton");
const autoOpacityInput = document.querySelector("#autoOpacityInput");
const visionStatus = document.querySelector("#visionStatus");
const blendModeInput = document.querySelector("#blendModeInput");
const guideInput = document.querySelector("#guideInput");
const projectNameInput = document.querySelector("#projectNameInput");
const saveProjectButton = document.querySelector("#saveProjectButton");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const diagnosticsInput = document.querySelector("#diagnosticsInput");
const diagnosticsOutput = document.querySelector("#diagnosticsOutput");
const presetInput = document.querySelector("#presetInput");
const projectList = document.querySelector("#projectList");
const projectSearchInput = document.querySelector("#projectSearchInput");
const projectSortInput = document.querySelector("#projectSortInput");
const loadProjectButton = document.querySelector("#loadProjectButton");
const duplicateProjectButton = document.querySelector("#duplicateProjectButton");
const favoriteProjectButton = document.querySelector("#favoriteProjectButton");
const deleteProjectButton = document.querySelector("#deleteProjectButton");
const exportProjectButton = document.querySelector("#exportProjectButton");
const importProjectInput = document.querySelector("#importProjectInput");
const profileInput = document.querySelector("#profileInput");
const saveProfileButton = document.querySelector("#saveProfileButton");
const timelineOutput = document.querySelector("#timelineOutput");
const gestureCoachElement = document.querySelector("#gestureCoach");
const coachClose = document.querySelector("#coachClose");
const replayHelpButton = document.querySelector("#replayHelpButton");
const calibrationReference = document.querySelector("#calibrationReference");
const calibrationUnit = document.querySelector("#calibrationUnit");
const calibrationWidth = document.querySelector("#calibrationWidth");
const applyCalibrationButton = document.querySelector("#applyCalibrationButton");
const calibrationOutput = document.querySelector("#calibrationOutput");
const grid = document.querySelector("#grid");
const emptyState = document.querySelector("#emptyState");
const layerCard = document.querySelector("#layerCard");
const layerThumb = document.querySelector("#layerThumb");
const layerName = document.querySelector("#layerName");
const layerVisibility = document.querySelector("#layerVisibility");
const layerLock = document.querySelector("#layerLock");
const layerAdd = document.querySelector("#layerAdd");
const layersList = document.querySelector("#layersList");
const layersToggle = document.querySelector("#layersToggle");
const layersCount = document.querySelector("#layersCount");
const selectionFrame = document.querySelector("#selectionFrame");
const gestureHint = document.querySelector("#gestureHint");
const zoomReadout = document.querySelector("#zoomReadout");
const rotationReadout = document.querySelector("#rotationReadout");
const opacityOutput = document.querySelector("#opacityOutput");
const opacityValue = document.querySelector("#opacityValue");
const scaleOutput = document.querySelector("#scaleOutput");
const rotationOutput = document.querySelector("#rotationOutput");
const opacityNumber = document.querySelector("#opacityNumber");
const scaleNumber = document.querySelector("#scaleNumber");
const rotationNumber = document.querySelector("#rotationNumber");
const positionXNumber = document.querySelector("#positionXNumber");
const positionYNumber = document.querySelector("#positionYNumber");
const blendSwatches = document.querySelector("#blendSwatches");
const traceModeInput = document.querySelector("#traceModeInput");
const traceStrengthInput = document.querySelector("#traceStrengthInput");
const traceStrengthOutput = document.querySelector("#traceStrengthOutput");
const traceDetailOutput = document.querySelector("#traceDetailOutput");
const tracePriorityOutput = document.querySelector("#tracePriorityOutput");
const traceThresholdInput = document.querySelector("#traceThresholdInput");
const traceThresholdOutput = document.querySelector("#traceThresholdOutput");
const traceBlurInput = document.querySelector("#traceBlurInput");
const traceBlurOutput = document.querySelector("#traceBlurOutput");
const traceBackgroundInput = document.querySelector("#traceBackgroundInput");
const traceStageInput = document.querySelector("#traceStageInput");
const traceFocusShapeInput = document.querySelector("#traceFocusShapeInput");
const traceOutsideOpacityInput = document.querySelector("#traceOutsideOpacityInput");
const traceResetButton = document.querySelector("#traceResetButton");
const traceProcessing = document.querySelector("#traceProcessing");
const traceRetryButton = document.querySelector("#traceRetryButton");
const traceDetailInput = document.querySelector("#traceDetailInput");
const tracePriorityInput = document.querySelector("#tracePriorityInput");
const traceLineWeightInput = document.querySelector("#traceLineWeightInput");
const traceLevelsInput = document.querySelector("#traceLevelsInput");
const traceIsolationInput = document.querySelector("#traceIsolationInput");
const traceQuality = document.querySelector("#traceQuality");
const layerTraceMode = document.querySelector("#layerTraceMode");
const traceFocusWindow = document.querySelector("#traceFocusWindow");
const quickTraceOpacityInput = document.querySelector("#quickTraceOpacityInput");
const traceModeChips = document.querySelector("#traceModeChips");
const quickTraceBar = document.querySelector("#quickTraceBar");
const quickOriginalButton = document.querySelector("#quickOriginalButton");
const quickAssistButton = document.querySelector("#quickAssistButton");
const quickTraceModeButton = document.querySelector("#quickTraceModeButton");
const quickTraceExpandButton = document.querySelector("#quickTraceExpandButton");
const adjustTitle = document.querySelector("#adjustTitle");
const presetChips = document.querySelector("#presetChips");
const status = document.querySelector("#status");
const updateAction = document.querySelector("#updateAction");
let pendingPWAUpdate = null;

let x = 0, y = 0, scale = 1, rotation = 0, opacity = 0.55, flipped = false, stream = null;
let pointers = new Map(), gestureStart = null, dragging = false, pointerStartX = 0, pointerStartY = 0, originX = 0, originY = 0;
const overlayTools = document.querySelectorAll(".overlay-tool");
const WORKSPACE_KEY = "tracelens-workspace-v1";
let workspaceImage = null;
let layers = [];
let activeLayerId = null;
let comparing = false;
let perspectiveActive = false;
let activePerspectiveQuad = null;
let perspectiveDragIndex = null;
let currentProjectId = null;
let cameraFacing = globalThis.localStorage?.getItem("tracelens-camera-facing") || "environment";
let gestureFrame = 0;
let physicalCalibration = null;
let lastTapAt = 0;
let longPressTimer = null;
let lastAdjustFocus = null;
let autoPerspectiveScanning = false;
let latestSurfaceDiagnostics = {};
const traceResults = new Map();
let traceDebounceTimer = 0;
let tracePreviewTimer = 0;
let traceRequestToken = 0;
let layersExpanded = false;
let traceSheetState = "closed";
let traceCompareHold = false;
let lastAssistMode = "Clean Lines";
let quickOriginalDownAt = 0;
let ignoreQuickOriginalClick = false;
let listenersBound = false;
let historyRestoring = false;
let traceQueue = null;
const vision = new VisionUtils();
const perspectiveSolver = new PerspectiveSolver();
const snapController = new OverlaySnapController(perspectiveOverlay);
const projectLibrary = new ProjectLibrary();
const history = new HistoryStack(30, { equals: (a, b) => workspaceFingerprint(a) === workspaceFingerprint(b) });
const historySources = new Map();
const historySourceIds = new Map();
const locks = new TransformLocks();
const guides = new MeasurementGuides(measurementGuides);
const diagnostics = new Diagnostics(diagnosticsOutput);
const calibrationProfiles = new CalibrationProfiles();
const timeline = new SessionTimeline();
const gestureCoach = new GestureCoach(gestureCoachElement, { reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches });
const traceEngine = new TraceEngine({ onStatus: update => { if (traceProcessing) { traceProcessing.hidden = !["processing", "cancelled"].includes(update.state); traceProcessing.textContent = update.state === "processing" ? (update.preview ? "Previewing…" : "Processing final…") : update.state === "cancelled" ? "Cancelled" : "Complete"; } if (traceRetryButton && update.state === "processing") traceRetryButton.hidden = true; if (update.state === "fallback") console.warn("[TraceLens trace] worker unavailable; using main thread", update.detail); } });
const adaptiveOpacity = new AdaptiveOpacityController({ analyzer: vision, onOpacity: (value, metrics) => { opacity = value; if (opacityInput) opacityInput.value = value; renderOverlay(); if (perspectiveOverlay) perspectiveOverlay.style.opacity = value; } });
const surfaceTracker = new SurfaceTracker({ onUpdate: result => {
  if (!workspaceImage) return;
  latestSurfaceDiagnostics = { rawConfidence: result.rawConfidence ?? result.confidence, stable: `${result.stableSampleCount}/${result.stableSamplesRequired}`, area: ((result.metrics?.area || 0) * 100).toFixed(1), aspect: (result.metrics?.aspectRatio || 0).toFixed(2), motion: (result.cornerMotion || 0).toFixed(3), rejection: result.rejection || "—" };
  const stateLabel = result.state === "tracking" ? "Tracking" : result.state === "weak" ? "Tracking weak" : result.state === "lost" ? "Tracking lost" : "Scanning";
  if (visionStatus) visionStatus.textContent = autoPerspectiveScanning ? perspectiveFeedback(result) : `${stateLabel} · ${result.confidence}%`;
  if (result.found && result.quad) {
    selectionFrame?.classList.add("surface-found"); if (selectionFrame) selectionFrame.style.clipPath = `polygon(${result.quad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`;
    if (result.scanning && result.lockEligible && autoPerspectiveScanning) { perspectiveSession.updateCandidate(result); if (confirmPerspectiveLock()) return; }
    if (perspectiveActive && surfaceTracker.locked && result.found) { activePerspectiveQuad = result.quad.map(point => ({ ...point })); snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(result.quad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); }
  } else if (result.state === "lost") selectionFrame?.classList.remove("surface-found");
}});
const perspectiveSession = new PerspectiveSession(surfaceTracker.stableSamplesRequired);

function updatePresetChips() {
  presetChips?.querySelectorAll("[data-preset]").forEach(button => button.classList.toggle("active", button.dataset.preset === presetInput?.value));
}

function updateContext() {
  const hasOverlay = Boolean(workspaceImage);
  document.querySelectorAll(".overlay-control").forEach(element => { element.hidden = !hasOverlay; });
  document.querySelectorAll(".perspective-control").forEach(element => { element.hidden = !hasOverlay; });
  document.querySelectorAll(".calibration-control").forEach(element => { element.hidden = !hasOverlay; });
  const diagnosticsEnabled = Boolean(diagnosticsInput?.checked);
  if (diagnosticsOutput) diagnosticsOutput.hidden = !diagnosticsEnabled;
  if (quickTraceBar) quickTraceBar.hidden = !hasOverlay;
  updatePresetChips();
}

function perspectiveFeedback(result = {}) {
  const reason = result.rejection || result.metrics?.reason;
  if (reason === "edge-of-frame") return "Too close to frame edge";
  if (reason === "area-too-small" || reason === "insufficient-edges") return "Need a larger surface";
  if (reason === "opposite-edges-inconsistent" || reason === "aspect-ratio-out-of-range" || reason === "non-convex" || reason === "self-intersecting") return "Surface not rectangular enough";
  if (reason === "corner-motion-too-high") return "Hold device steady";
  if (result.lockEligible) return `Surface stable · ${result.stableSampleCount}/${result.stableSamplesRequired}`;
  return "Scanning surface…";
}

const DEFAULT_TRACE = Object.freeze({ enabled: false, mode: "Original", settings: { strength: .55, detail: .55, priority: .6, threshold: .48, blur: 1, background: "transparent", levels: 5, lineWeight: "Uniform", isolation: false, focusShape: "none", outsideOpacity: 25, assistOpacity: 1, mask: { version: 1, strokes: [] } }, stage: 0, contourProgress: {}, stageReveal: "single" });
function traceState(layer) { layer.trace = { ...DEFAULT_TRACE, ...(layer.trace || {}), mode: TRACE_MODES.includes(layer.trace?.mode) ? layer.trace.mode : "Original", settings: { ...DEFAULT_TRACE.settings, ...(layer.trace?.settings || {}), mask: normalizeTraceMask(layer.trace?.settings?.mask) } }; return layer.trace; }
function applyTraceControls(layer) {
  const trace = traceState(layer); if (traceModeInput) traceModeInput.value = trace.mode; if (traceStrengthInput) traceStrengthInput.value = trace.settings.strength; if (traceDetailInput) traceDetailInput.value = trace.settings.detail; if (tracePriorityInput) tracePriorityInput.value = trace.settings.priority; if (traceLineWeightInput) traceLineWeightInput.value = trace.settings.lineWeight; if (traceLevelsInput) traceLevelsInput.value = trace.settings.levels; if (traceIsolationInput) traceIsolationInput.checked = trace.settings.isolation; if (traceThresholdInput) traceThresholdInput.value = trace.settings.threshold; if (traceBlurInput) traceBlurInput.value = trace.settings.blur; if (traceBackgroundInput) traceBackgroundInput.value = trace.settings.background; if (traceStageInput) traceStageInput.value = trace.stage ?? 0; if (traceFocusShapeInput) traceFocusShapeInput.value = trace.settings.focusShape || "none"; if (traceOutsideOpacityInput) traceOutsideOpacityInput.value = trace.settings.outsideOpacity ?? 25; if (quickTraceOpacityInput) quickTraceOpacityInput.value = trace.settings.assistOpacity ?? 1; updateTraceOutputs(); updateFocusWindow(trace); updateTraceQuickUI(layer); if (layerTraceMode) layerTraceMode.textContent = trace.mode;
}
function updateTraceOutputs() { if (traceStrengthOutput && traceStrengthInput) traceStrengthOutput.textContent = `${Math.round(Number(traceStrengthInput.value) * 100)}%`; if (traceDetailOutput && traceDetailInput) traceDetailOutput.textContent = `${Math.round(Number(traceDetailInput.value) * 100)}%`; if (tracePriorityOutput && tracePriorityInput) tracePriorityOutput.textContent = `${Math.round(Number(tracePriorityInput.value) * 100)}%`; if (traceThresholdOutput && traceThresholdInput) traceThresholdOutput.textContent = `${Math.round(Number(traceThresholdInput.value) * 100)}%`; if (traceBlurOutput && traceBlurInput) traceBlurOutput.textContent = traceBlurInput.value; }
function updateTraceQuickUI(layer = activeLayer()) { const trace = layer ? traceState(layer) : DEFAULT_TRACE; traceModeChips?.querySelectorAll("[data-trace-mode]").forEach(button => button.classList.toggle("active", button.dataset.traceMode === trace.mode)); if (quickTraceModeButton) quickTraceModeButton.textContent = trace.mode === "Original" ? "Original" : trace.mode.replace(" Lines", ""); if (quickOriginalButton) quickOriginalButton.setAttribute("aria-pressed", String(trace.mode === "Original" || traceCompareHold)); if (quickAssistButton) quickAssistButton.setAttribute("aria-pressed", String(trace.enabled && !traceCompareHold)); }
function setTraceSheet(nextState = "closed", view = "trace") { if (!adjustSheet) return; traceSheetState = nextState; const open = nextState !== "closed"; if (open && layersExpanded) { layersExpanded = false; if (layersList) layersList.hidden = true; layerCard?.classList.remove("layers-expanded"); layersToggle?.setAttribute("aria-expanded", "false"); } adjustSheet.classList.toggle("open", open); adjustSheet.dataset.state = nextState; adjustSheet.dataset.view = view; adjustSheet.setAttribute("aria-hidden", String(!open)); document.body.classList.toggle("sheet-open", open); stage?.classList.toggle("adjust-open", open); if (adjustTitle) adjustTitle.textContent = view === "trace" ? "Trace Assist" : "Adjust overlay"; if (quickTraceExpandButton) quickTraceExpandButton.textContent = nextState === "expanded" ? "⌄" : "⌃"; if (open) window.setTimeout(() => closeAdjust?.focus(), 0); }
function setTraceMode(mode) { const layer = activeLayer(); if (!layer || !TRACE_MODES.includes(mode)) return; if (mode !== "Original") lastAssistMode = mode; traceState(layer).mode = mode; traceState(layer).enabled = mode !== "Original"; if (traceModeInput) traceModeInput.value = mode; applyTraceControls(layer); updateTraceQuickUI(layer); queueTraceRefresh(); }
function captureTraceControls(layer) { const trace = traceState(layer); trace.mode = TRACE_MODES.includes(traceModeInput?.value) ? traceModeInput.value : trace.mode; trace.enabled = trace.mode !== "Original"; trace.stage = Number(traceStageInput?.value) || 0; trace.settings = { ...trace.settings, strength: Number(traceStrengthInput?.value ?? trace.settings.strength), detail: Number(traceDetailInput?.value ?? trace.settings.detail), priority: Number(tracePriorityInput?.value ?? trace.settings.priority), lineWeight: traceLineWeightInput?.value || trace.settings.lineWeight, levels: Number(traceLevelsInput?.value ?? trace.settings.levels) || 0, isolation: Boolean(traceIsolationInput?.checked), threshold: Number(traceThresholdInput?.value ?? trace.settings.threshold), blur: Number(traceBlurInput?.value ?? trace.settings.blur), background: traceBackgroundInput?.value || trace.settings.background, focusShape: traceFocusShapeInput?.value || trace.settings.focusShape, outsideOpacity: Number(traceOutsideOpacityInput?.value ?? trace.settings.outsideOpacity) || 0, assistOpacity: Number(quickTraceOpacityInput?.value ?? trace.settings.assistOpacity) || 1, mask: normalizeTraceMask(trace.settings.mask) }; return trace; }
function updateFocusWindow(trace = traceState(activeLayer() || { trace: DEFAULT_TRACE })) { if (!traceFocusWindow) return; const shape = trace.settings.focusShape || "none"; traceFocusWindow.hidden = !workspaceImage || shape === "none"; traceFocusWindow.dataset.shape = shape; traceFocusWindow.style.setProperty("--outside-opacity", String(Math.max(0, Math.min(1, (trace.settings.outsideOpacity ?? 25) / 100)))); }
function traceSettings(layer, preview = false) { const trace = traceState(layer); return normalizeTraceSettings({ mode: trace.mode, ...trace.settings, stage: trace.stage, preview }); }
async function refreshTraceView(layer) {
  if (!layer || layer.id !== activeLayerId || document.hidden) return;
  const trace = traceState(layer); traceRequestToken += 1; const token = traceRequestToken; applyTraceControls(layer); if (!trace.enabled || trace.mode === "Original") { traceResults.delete(layer.id); overlay.src = layer.image; renderOverlay(); return; }
  try { const result = await traceEngine.process(layer.image, traceSettings(layer)); if (token !== traceRequestToken || layer.id !== activeLayerId || result.cancelled) return; const dataUrl = await resultToDataUrl(result, trace.settings.background, trace.mode); traceResults.set(layer.id, { dataUrl, key: result.key, quality: result.quality }); trace.cacheKey = result.key; if (traceQuality) { traceQuality.textContent = result.quality?.warnings?.[0] ? `Quality ${result.quality.score}% · ${result.quality.warnings[0]}` : `Quality ${result.quality?.score ?? 0}% · ${result.quality?.status || "Complete"}`; traceQuality.dataset.state = result.quality?.score >= 60 ? "good" : "warning"; } overlay.src = dataUrl; renderOverlay(); if (traceRetryButton) traceRetryButton.hidden = true; if (perspectiveActive && activePerspectiveQuad) snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); } catch (error) { trace.enabled = false; trace.mode = "Original"; overlay.src = layer.image; if (traceRetryButton) traceRetryButton.hidden = false; if (traceProcessing) { traceProcessing.hidden = false; traceProcessing.textContent = "Failed · retry available"; } if (traceQuality) traceQuality.textContent = "Trace failed · Original restored · Retry available"; status.textContent = "Trace Assist could not process this image. Original restored. Retry is available."; console.error("[TraceLens trace] processing failed", error); }
}
async function previewTraceView(layer) {
  if (!layer || layer.id !== activeLayerId || document.hidden || !traceState(layer).enabled) return;
  const trace = traceState(layer); const token = ++traceRequestToken;
  try { const result = await traceEngine.processPreview(layer.image, traceSettings(layer, true)); if (token !== traceRequestToken || layer.id !== activeLayerId || result.cancelled) return; const dataUrl = await resultToDataUrl(result, trace.settings.background, trace.mode); traceResults.set(layer.id, { dataUrl, key: result.key, quality: result.quality, preview: true }); overlay.src = dataUrl; if (traceProcessing) traceProcessing.textContent = "Previewing…"; renderOverlay(); } catch (error) { if (token === traceRequestToken) console.warn("[TraceLens trace] preview failed", error); }
}
async function processBackgroundTrace(layer, queueToken) {
  if (!layers.some(item => item.id === layer.id) || layer.visible === false || !layer.trace?.enabled || layer.trace.mode === "Original" || !queueToken.isCurrent()) return;
  const result = await traceEngine.process(layer.image, traceSettings(layer)); if (!queueToken.isCurrent() || !layers.some(item => item.id === layer.id)) return; const dataUrl = await resultToDataUrl(result, layer.trace.settings.background, layer.trace.mode); if (!queueToken.isCurrent()) return; traceResults.set(layer.id, { dataUrl, key: result.key }); layer.trace.cacheKey = result.key; renderLayers();
}
async function queueVisibleTraceLayers() {
  traceQueue?.cancel(); traceQueue = createTraceQueue({ process: processBackgroundTrace, onError: (error, layer) => console.error("[TraceLens trace] background layer failed", layer?.id, error) }); traceQueue.start(layers.filter(layer => layer.id !== activeLayerId), activeLayerId);
}
function queueTraceRefresh() { const layer = activeLayer(); if (!layer) return; captureTraceControls(layer); applyTraceControls(layer); updateFocusWindow(layer.trace); renderOverlay(); window.clearTimeout(tracePreviewTimer); if (layer.trace.enabled) tracePreviewTimer = window.setTimeout(() => { traceEngine.cancel(); previewTraceView(layer); }, 40); window.clearTimeout(traceDebounceTimer); traceDebounceTimer = window.setTimeout(() => refreshTraceView(layer), 220); }

function activeLayer() { return layers.find(layer => layer.id === activeLayerId) || null; }
function activeRenderSource() { return traceResults.get(activeLayerId)?.dataUrl || workspaceImage; }
function legacyLayer(project, name) { return createLayer({ image: project.image, name, x: project.x, y: project.y, scale: project.scale, rotation: project.rotation, opacity: project.opacity, flipped: project.flipped, blendMode: project.blendMode, guide: project.guide, physicalCalibration: project.physicalCalibration, perspective: project.perspective ? { enabled: true, locked: Boolean(project.perspectiveLocked), quad: project.perspective } : null, locked: project.locks?.position }); }

function syncActiveLayer() {
  const layer = activeLayer();
  if (!layer) return;
  Object.assign(layer, { x, y, scale, rotation, opacity, flipped, blendMode: blendModeInput?.value || layer.blendMode, guide: guideInput?.value || layer.guide, physicalCalibration, trace: traceState(layer), perspective: perspectiveActive && activePerspectiveQuad ? { enabled: true, locked: surfaceTracker.locked, quad: activePerspectiveQuad.map(point => ({ ...point })) } : null, visible: !overlay.hidden, locked: locks.position });
}

function loadLayerState(layer) {
  if (!layer) return;
  activeLayerId = layer.id; workspaceImage = layer.image; x = Number(layer.x) || 0; y = Number(layer.y) || 0; scale = Number(layer.scale) || 1; rotation = Number(layer.rotation) || 0; opacity = Number(layer.opacity) || .55; flipped = Boolean(layer.flipped);
  if (blendModeInput) blendModeInput.value = layer.blendMode || "Normal"; if (guideInput) guideInput.value = layer.guide || "none"; guides.setMode(layer.guide || "none"); physicalCalibration = layer.physicalCalibration || null; if (opacityInput) opacityInput.value = opacity; if (scaleInput) scaleInput.value = scale; if (rotationInput) rotationInput.value = rotation; if (positionXNumber) positionXNumber.value = Math.round(x); if (positionYNumber) positionYNumber.value = Math.round(y); blendSwatches?.querySelectorAll("[data-blend]").forEach(button => button.classList.toggle("active", button.dataset.blend === (layer.blendMode || "Normal")));
  activePerspectiveQuad = layer.perspective?.quad ? layer.perspective.quad.map(point => ({ ...point })) : null; perspectiveActive = Boolean(activePerspectiveQuad?.length === 4); surfaceTracker.locked = Boolean(layer.perspective?.locked); overlay.src = layer.image; overlay.hidden = layer.visible === false; overlay.style.visibility = "visible"; const display = resolveOverlayDisplay({ visible: layer.visible !== false, perspective: perspectiveActive }); overlay.style.display = display.overlay ? "block" : "none"; if (display.perspective) snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); else snapController.clear(); if (layerThumb) layerThumb.src = workspaceImage; if (layerName) layerName.textContent = layer.name; applyLocks({ position: Boolean(layer.locked) }); applyTraceControls(layer); refreshTraceView(layer);
}

function renderLayerElement(element, layer, index) {
  const flip = layer.flipped ? -1 : 1;
  element.src = traceResults.get(layer.id)?.dataUrl || layer.image; element.hidden = layer.visible === false; element.style.display = layer.visible === false ? "none" : "block"; element.style.opacity = layer.opacity; element.style.transform = `translate(${layer.x}px, ${layer.y}px) scale(${layer.scale * flip}, ${layer.scale}) rotate(${layer.rotation}deg)`; element.style.mixBlendMode = layer.blendMode.toLowerCase(); element.style.zIndex = String(index + 1);
}

function renderLayers(refreshList = false) {
  syncActiveLayer();
  const activeIndex = layers.findIndex(layer => layer.id === activeLayerId);
  overlay.style.zIndex = String(Math.max(1, activeIndex + 1));
  const existing = new Map([...stage.querySelectorAll("img[data-layer-id]")].map(element => [element.dataset.layerId, element]));
  layers.forEach((layer, index) => {
    if (layer.id === activeLayerId) return;
    const element = existing.get(layer.id) || document.createElement("img");
    element.className = "layer-overlay"; element.dataset.layerId = layer.id; element.alt = "";
    if (!element.parentElement) stage.insertBefore(element, perspectiveOverlay || measurementGuides);
    renderLayerElement(element, layer, index);
    existing.delete(layer.id);
  });
  existing.forEach(element => element.remove());
  if (refreshList) renderLayerList();
}

function renderLayerList() {
  if (!layersList) return;
  if (layersCount) layersCount.textContent = layers.length;
  layersList.replaceChildren(...[...layers].reverse().map((layer, reverseIndex) => {
    const row = document.createElement("div"); row.className = `layer-row${layer.id === activeLayerId ? " active" : ""}`; row.dataset.layerId = layer.id;
    row.innerHTML = `<button class="layer-row-main" type="button"><img alt=""><span><strong></strong><small></small></span></button><button class="layer-row-action layer-row-visibility" type="button" aria-label="Toggle visibility">${layer.visible === false ? "⊘" : "◉"}</button><button class="layer-row-action layer-row-lock" type="button" aria-label="Toggle lock">${layer.locked ? "🔒" : "♧"}</button><button class="layer-row-action layer-row-up" type="button" aria-label="Move layer up">↑</button><button class="layer-row-action layer-row-down" type="button" aria-label="Move layer down">↓</button><button class="layer-row-action layer-row-duplicate" type="button" aria-label="Duplicate layer">⧉</button><button class="layer-row-action layer-row-delete" type="button" aria-label="Delete layer">×</button>`;
    row.querySelector("img").src = layer.thumbnail || layer.image; row.querySelector("strong").textContent = layer.name; const trace = traceState(layer); row.querySelector("small").textContent = `${Math.round(layer.opacity * 100)}% · ${layer.blendMode}${layer.perspective ? " · Perspective" : ""}${trace.enabled ? ` · ${trace.mode}` : ""}`;
    return row;
  }));
}

function setLayers(nextLayers, selectedId = null) {
  layers = cloneLayers(nextLayers); activeLayerId = selectedId || layers.at(-1)?.id || null; layersExpanded = false; layerCard?.classList.remove("layers-expanded"); if (layersList) layersList.hidden = true; layersToggle?.setAttribute("aria-expanded", "false"); const layer = activeLayer(); if (layer) loadLayerState(layer); renderLayers(true); updateContext();
}

function restoreLayerVisibility(layer = activeLayer()) {
  if (!layer) return;
  const display = resolveOverlayDisplay({ visible: layer.visible !== false, perspective: layer.id === activeLayerId && perspectiveActive });
  overlay.hidden = layer.visible === false;
  overlay.style.display = display.overlay ? "block" : "none";
  if (display.perspective && activePerspectiveQuad) snapController.canvas.hidden = false;
  if (!display.perspective) snapController.clear();
}

function confirmPerspectiveLock() {
  const candidate = perspectiveSession.candidate || surfaceTracker.getLockCandidate();
  if (!candidate || !perspectiveSession.confirm() || !surfaceTracker.lock()) return false;
  autoPerspectiveScanning = false; autoPerspectiveButton.classList.remove("active"); activePerspectiveQuad = candidate.quad.map(point => ({ ...point })); perspectiveActive = true;
  snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); overlay.style.display = "none"; selectionFrame.classList.add("surface-found"); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; syncActiveLayer(); pushHistory(); status.textContent = "Perspective locked."; visionStatus.textContent = "Perspective locked · Tracking"; addTimeline("Perspective Locked"); updateContext(); return true;
}

function renderOverlay() {
  if (!overlay) return;
  const flip = flipped ? -1 : 1;
  const trace = activeLayer()?.trace; overlay.style.opacity = opacity * (trace?.enabled ? (trace.settings?.assistOpacity ?? 1) : 1);
  overlay.style.transform = `translate(${x}px, ${y}px) scale(${scale * flip}, ${scale}) rotate(${rotation}deg)`;
  if (opacityOutput) opacityOutput.textContent = `${Math.round(opacity * 100)}%`;
  if (opacityValue) opacityValue.textContent = `${Math.round(opacity * 100)}%`;
  if (scaleOutput) scaleOutput.textContent = `${Math.round(scale * 100)}%`;
  if (rotationOutput) rotationOutput.textContent = `${rotation}°`;
  if (opacityNumber) opacityNumber.value = Math.round(opacity * 100);
  if (scaleNumber) scaleNumber.value = Math.round(scale * 100);
  if (rotationNumber) rotationNumber.value = rotation;
  if (positionXNumber) positionXNumber.value = Math.round(x);
  if (positionYNumber) positionYNumber.value = Math.round(y);
  blendSwatches?.querySelectorAll("[data-blend]").forEach(button => button.classList.toggle("active", button.dataset.blend === blendModeInput.value));
  if (zoomReadout) zoomReadout.textContent = `Zoom ${scale.toFixed(2)}×`;
  if (rotationReadout) rotationReadout.textContent = `${rotation}°`;
  if (perspectiveOverlay && !perspectiveOverlay.hidden) perspectiveOverlay.style.opacity = opacity;
  applyBlendMode(overlay, blendModeInput?.value || "Normal");
  applyBlendMode(perspectiveOverlay, blendModeInput?.value || "Normal");
  renderLayers();
}

function captureState() { return { x, y, scale, rotation, opacity, flipped, blendMode: blendModeInput?.value || "Normal", guide: guideInput?.value || "none", physicalCalibration }; }
function captureLayers() { syncActiveLayer(); return cloneLayers(layers); }
function applyState(next) {
  if (!next) return;
  x = Number(next.x) || 0; y = Number(next.y) || 0; scale = Number(next.scale) || 1; rotation = Number(next.rotation) || 0; opacity = Number(next.opacity) || .55; flipped = Boolean(next.flipped);
  if (blendModeInput) blendModeInput.value = next.blendMode || "Normal"; if (guideInput) guideInput.value = next.guide || "none"; guides.setMode(next.guide || "none");
  physicalCalibration = next.physicalCalibration || null;
  if (opacityInput) opacityInput.value = opacity; if (scaleInput) scaleInput.value = scale; if (rotationInput) rotationInput.value = rotation; renderOverlay(); renderLayerList();
}
function historySourceId(image) { if (!image) return null; if (!historySourceIds.has(image)) { const id = `source-${historySourceIds.size + 1}`; historySourceIds.set(image, id); historySources.set(id, image); } return historySourceIds.get(image); }
function workspaceState() { syncActiveLayer(); return { layers: layers.map(layer => { const { image, thumbnail, ...state } = layer; return { ...state, sourceId: historySourceId(image) }; }), activeLayerId, locks: { ...locks }, ...captureState() }; }
function pushHistory() { if (workspaceImage && !historyRestoring) history.push(workspaceState()); }
function restoreWorkspaceState(next) { if (!next) return; historyRestoring = true; try { if (Array.isArray(next.layers) && next.layers.length) { const restored = next.layers.map(layer => ({ ...layer, image: layer.image || historySources.get(layer.sourceId) })).filter(layer => layer.image); setLayers(restored, next.activeLayerId); } applyState(next); applyLocks(next.locks || activeLayer()?.locks || {}); updateContext(); } finally { historyRestoring = false; } }
function addTimeline(type, detail = "") { timeline.add(type, detail); const latest = timeline.latest(); if (timelineOutput) timelineOutput.textContent = latest ? `${latest.type}${latest.detail ? ` · ${latest.detail}` : ""}` : "Session ready."; }
function applyLocks(saved = {}) { Object.keys(locks).forEach(key => { if (typeof locks[key] === "boolean") locks[key] = Boolean(saved[key]); const input = document.querySelector(`[data-lock="${key}"]`); if (input) input.checked = locks[key]; }); stage?.classList.toggle("locked", locks.position); if (layerLock) { layerLock.textContent = locks.position ? "♙" : "♧"; layerLock.setAttribute("aria-label", locks.position ? "Unlock overlay" : "Lock overlay"); } }
function applyProject(project) {
  const projectImage = project?.image || project?.layers?.find(layer => layer?.image)?.image;
  if (!projectImage) { status.textContent = "That project has no usable reference image."; return false; }
  traceQueue?.cancel(); traceEngine.cancel(); traceEngine.clearSources(); traceResults.clear(); history.clear(); historySources.clear(); historySourceIds.clear();
  currentProjectId = project.id || null; projectNameInput.value = project.name || "Untitled project"; emptyState.style.display = "none"; layerCard.hidden = false; selectionFrame.classList.add("visible"); showOverlayTools();
  const restoredLayers = Array.isArray(project.layers) && project.layers.length ? project.layers : [legacyLayer(project, project.name || "Reference image")];
  setLayers(restoredLayers, project.activeLayerId || restoredLayers.at(-1).id);
  if (project.preset) { presetInput.value = project.preset; applyPreset(project.preset, false); } applyState(project); applyLocks(project.locks); updateContext(); pushHistory(); surfaceTracker.start(camera); queueVisibleTraceLayers(); return true;
}
let projectSearchToken = 0;
async function refreshProjectList() { const request = ++projectSearchToken; try { let projects = await projectLibrary.all(); if (request !== projectSearchToken) return; const query = projectSearchInput.value.trim().toLowerCase(); if (query) projects = projects.filter(project => (project.name || "").toLowerCase().includes(query) || (project.preset || "").toLowerCase().includes(query)); const sort = projectSortInput.value; projects.sort((a, b) => sort === "name" ? (a.name || "").localeCompare(b.name || "") : sort === "created" ? b.createdAt - a.createdAt : sort === "favorite" ? Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt : b.updatedAt - a.updatedAt); projectList.replaceChildren(new Option(projects.length ? "Projects" : "No projects yet", ""), ...projects.map(project => new Option(`${project.favorite ? "★ " : ""}${project.name || "Untitled project"} · ${new Date(project.updatedAt || Date.now()).toLocaleDateString()}`, project.id))); } catch (error) { if (request !== projectSearchToken) return; console.error("[TraceLens projects] list failed", error); status.textContent = "Project storage is unavailable. Try again."; } }
const debouncedProjectSearch = createDebouncedTask(() => refreshProjectList(), 140);
function applyPreset(name, announce = true) { const preset = getWorkflowPreset(name); presetInput.value = name; opacity = preset.opacity; opacityInput.value = opacity; blendModeInput.value = preset.blendMode; guideInput.value = preset.guide; guides.setMode(preset.guide); grid.style.backgroundSize = `${100 / preset.gridSpacing}% ${100 / preset.gridSpacing}%`; surfaceTracker.state.retainAt = preset.tracking.weakAt; surfaceTracker.state.acquireAt = Math.max(72, preset.tracking.weakAt + 12); surfaceTracker.state.lostAt = preset.tracking.lostAt; renderOverlay(); updatePresetChips(); if (announce) { status.textContent = `${name} workspace active.`; addTimeline("Preset", name); } }
function applyPhysicalCalibration() {
  const reference = CALIBRATION_REFERENCES[calibrationReference.value];
  const desired = Number(calibrationWidth.value);
  const quad = activePerspectiveQuad || [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  try {
    physicalCalibration = { reference: calibrationReference.value, unit: calibrationUnit.value, ...calculateCalibration({ referenceWidth: reference.width, referenceHeight: reference.height, quad, desiredWidth: desired, unit: calibrationUnit.value }) };
    scale = Math.max(.25, Math.min(3, desired / fromMillimeters(reference.width, calibrationUnit.value)));
    scaleInput.value = scale; renderOverlay(); pushHistory(); calibrationOutput.textContent = `Estimated ${fromMillimeters(physicalCalibration.desiredWidthMm, calibrationUnit.value).toFixed(1)} ${calibrationUnit.value} wide · ${fromMillimeters(physicalCalibration.desiredHeightMm, calibrationUnit.value).toFixed(1)} high. Approximate only.`; addTimeline("Calibrated", calibrationReference.value);
  } catch (error) { calibrationOutput.textContent = error.message; }
}
function wakeHUD() { stage.classList.remove("hud-idle"); window.clearTimeout(gestureFrame); gestureFrame = window.setTimeout(() => { if (!adjustSheet.classList.contains("open")) stage.classList.add("hud-idle"); }, 2200); }

function showOverlayTools() {
  overlayTools.forEach(tool => tool.classList.add("available"));
}

function saveWorkspace() {
  if (!workspaceImage) {
    status.textContent = "Import an image before saving a workspace.";
    return;
  }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ image: workspaceImage, layers: captureLayers(), activeLayerId, ...captureState() }));
  workspaceButton.classList.add("saved");
  status.textContent = "Workspace saved on this device.";
  window.setTimeout(() => workspaceButton.classList.remove("saved"), 900);
}

async function saveProject() {
  if (!workspaceImage) { status.textContent = "Import an image before saving a project."; return; }
  const name = projectNameInput.value.trim() || "Untitled project";
  currentProjectId ||= globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`;
  const savedLayers = captureLayers(); await Promise.all(savedLayers.map(async layer => { if (!layer.thumbnail) layer.thumbnail = await projectLibrary.thumbnail(layer.image); }));
  await projectLibrary.put({ id: currentProjectId, name, image: workspaceImage, layers: savedLayers, activeLayerId, preset: presetInput.value, perspective: surfaceTracker.locked ? activePerspectiveQuad : null, perspectiveLocked: surfaceTracker.locked, ...captureState(), locks: { ...locks }, updatedAt: Date.now(), thumbnail: await projectLibrary.thumbnail(workspaceImage) });
  await refreshProjectList(); addTimeline("Saved", name);
  status.textContent = `Project “${name}” saved.`;
}

async function restoreLatestProject() {
  if (workspaceImage) return;
  try { const projects = await projectLibrary.all(); const project = projects[0]; if (!project) return; applyProject(project); status.textContent = `Project “${project.name}” restored.`; } catch (error) { console.warn("Could not restore project library", error); }
}

function restoreWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY));
    if (!saved?.image) return;
    traceQueue?.cancel(); traceEngine.cancel(); traceEngine.clearSources(); traceResults.clear(); history.clear(); historySources.clear(); historySourceIds.clear();
    const restoredLayers = Array.isArray(saved.layers) && saved.layers.length ? saved.layers : [legacyLayer(saved, "Saved workspace")];
    currentProjectId = null; emptyState.style.display = "none"; layerCard.hidden = false; selectionFrame.classList.add("visible"); showOverlayTools(); setLayers(restoredLayers, saved.activeLayerId || restoredLayers.at(-1).id);
    applyState(saved); status.textContent = "Saved workspace restored.";
    addTimeline("Restored", "Workspace");
    pushHistory();
    if (workspaceImage) { surfaceTracker.start(camera); queueVisibleTraceLayers(); }
  } catch (error) { console.warn("Could not restore workspace", error); }
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported.");
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraFacing } }, audio: false });
    camera.srcObject = stream;
    stream.getTracks().forEach(track => track.addEventListener("ended", () => {
      if (camera.srcObject === stream) { cameraState.textContent = "CAMERA STOPPED"; status.textContent = "Camera stopped. Tap restart to try again."; }
    }));
    camera.classList.toggle("selfie-camera", cameraFacing === "user");
    cameraState.textContent = "CAMERA ACTIVE";
    status.textContent = "Camera active.";
    if (workspaceImage) surfaceTracker.start(camera);
    return stream;
  } catch (error) {
    cameraState.textContent = "CAMERA UNAVAILABLE";
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    const classified = classifyCameraError(error); status.textContent = classified.message; console.error("[TraceLens camera]", classified.code, error); throw Object.assign(error instanceof Error ? error : new Error(classified.message), { cameraCode: classified.code });
  }
}

function loadImage(file) {
  if (!file) return;
  if (!file.type?.startsWith("image/")) { status.textContent = "Choose a supported image file."; return; }
  if (file.size > 25 * 1024 * 1024) { status.textContent = "That image is larger than 25 MB. Choose a smaller file."; return; }
  const reader = new FileReader();
  reader.onload = () => {
    snapController.clear();
    perspectiveActive = false;
    surfaceTracker.unlock(); surfaceTracker.cancelScan(); perspectiveSession.cancel(); autoPerspectiveScanning = false; autoPerspectiveButton?.classList.remove("active");
    syncActiveLayer();
    const newLayer = createLayer({ image: reader.result, name: file.name.replace(/\.[^/.]+$/, "") });
    setLayers([...layers, newLayer], newLayer.id);
    projectLibrary.thumbnail(reader.result).then(thumbnail => { const layer = layers.find(item => item.id === newLayer.id); if (layer) layer.thumbnail = thumbnail; renderLayerList(); }).catch(error => console.warn("[TraceLens layers] thumbnail generation failed", error));
    overlay.style.display = "block";
    overlay.hidden = false;
    if (layerVisibility) layerVisibility.textContent = "◉";
    if (emptyState) emptyState.style.display = "none";
    if (layerCard) layerCard.hidden = false;
    selectionFrame?.classList.add("visible");
    showOverlayTools();
    pushHistory();
    if (gestureHint) gestureHint.hidden = false;
    addTimeline("Imported", file.name); gestureCoach.show();
    status.textContent = "Overlay loaded. Drag, pinch, or rotate to position it.";
    updateContext();
    surfaceTracker.start(camera);
  };
  reader.onerror = () => { status.textContent = "Could not read that image. Try another file."; console.error("[TraceLens import] FileReader failed", reader.error); };
  reader.readAsDataURL(file);
}

function bindEventListeners() {
  if (listenersBound) return;
  listenersBound = true;
imageInput?.addEventListener("change", event => { loadImage(event.target.files?.[0]); event.target.value = ""; });
dockImageInput?.addEventListener("change", event => { loadImage(event.target.files?.[0]); event.target.value = ""; });
updateAction?.addEventListener("click", () => { pendingPWAUpdate?.activate?.(); });
opacityInput?.addEventListener("input", event => { opacity = Number(event.target.value); renderOverlay(); });
opacityInput?.addEventListener("change", () => renderLayerList());
scaleInput?.addEventListener("input", event => { if (!locks.canEdit("scale")) return; scale = Number(event.target.value); renderOverlay(); });
rotationInput?.addEventListener("input", event => { if (!locks.canEdit("rotation")) return; rotation = Number(event.target.value); renderOverlay(); });
scaleInput?.addEventListener("change", pushHistory);
rotationInput?.addEventListener("change", pushHistory);
opacityInput?.addEventListener("change", pushHistory);
function setNumericTransform(target, value) {
  if (target === opacityInput) { if (!Number.isFinite(value)) return; opacityInput.value = Math.max(.05, Math.min(1, value)); opacity = Number(opacityInput.value); }
  if (target === scaleInput) { if (!locks.canEdit("scale") || !Number.isFinite(value)) return; scaleInput.value = Math.max(.25, Math.min(3, value)); scale = Number(scaleInput.value); }
  if (target === rotationInput) { if (!locks.canEdit("rotation") || !Number.isFinite(value)) return; rotationInput.value = Math.max(-180, Math.min(180, value)); rotation = Number(rotationInput.value); }
  renderOverlay();
}
opacityNumber?.addEventListener("change", event => setNumericTransform(opacityInput, Number(event.target.value) / 100));
scaleNumber?.addEventListener("change", event => setNumericTransform(scaleInput, Number(event.target.value) / 100));
rotationNumber?.addEventListener("change", event => setNumericTransform(rotationInput, Number(event.target.value)));
positionXNumber?.addEventListener("change", event => { if (!locks.canEdit("position")) return; x = Number(event.target.value) || 0; renderOverlay(); });
positionYNumber?.addEventListener("change", event => { if (!locks.canEdit("position")) return; y = Number(event.target.value) || 0; renderOverlay(); });
document.querySelectorAll("[data-step-target]").forEach(button => button.addEventListener("click", () => {
  const target = document.querySelector(`#${button.dataset.stepTarget}`);
  if (target) setNumericTransform(target, Number(target.value) + Number(button.dataset.step));
}));
cameraButton?.addEventListener("click", () => startCamera().catch(() => {}));
cameraFacingButton?.addEventListener("click", () => { cameraFacing = cameraFacing === "environment" ? "user" : "environment"; globalThis.localStorage?.setItem("tracelens-camera-facing", cameraFacing); startCamera().catch(() => {}); });
gridButton?.addEventListener("click", () => { grid.classList.toggle("visible"); gridButton.classList.toggle("active"); });
flipButton?.addEventListener("click", () => { flipped = !flipped; flipButton.classList.toggle("active", flipped); renderOverlay(); });
adjustButton?.addEventListener("click", () => { const opening = !adjustSheet.classList.contains("open"); if (opening) lastAdjustFocus = document.activeElement; setTraceSheet(opening ? "expanded" : "closed", "normal"); if (!opening && lastAdjustFocus?.focus) lastAdjustFocus.focus(); });
closeAdjust?.addEventListener("click", () => { setTraceSheet("closed"); if (lastAdjustFocus?.focus) lastAdjustFocus.focus(); });
replayHelpButton?.addEventListener("click", () => gestureCoach.replay());
coachClose?.addEventListener("click", () => gestureCoach.dismiss());
applyCalibrationButton?.addEventListener("click", applyPhysicalCalibration);
workspaceButton?.addEventListener("click", saveWorkspace);
presetInput?.addEventListener("change", event => applyPreset(event.target.value));
presetChips?.addEventListener("click", event => { const button = event.target.closest("[data-preset]"); if (button) applyPreset(button.dataset.preset); });
projectSearchInput?.addEventListener("input", debouncedProjectSearch);
projectSortInput?.addEventListener("change", refreshProjectList);
saveProjectButton?.addEventListener("click", () => { saveProject().catch(error => { status.textContent = "Project storage unavailable."; console.warn(error); }); });
loadProjectButton?.addEventListener("click", async () => { try { const project = await projectLibrary.get(projectList.value); if (project) { applyProject(project); addTimeline("Loaded", project.name || "Project"); status.textContent = `Project “${project.name || "Project"}” loaded.`; } } catch (error) { status.textContent = "That project could not be loaded. It may be corrupted."; console.error("[TraceLens projects] load failed", error); } });
duplicateProjectButton?.addEventListener("click", async () => { const project = await projectLibrary.get(projectList.value); if (!project) return; currentProjectId = globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`; projectNameInput.value = `${project.name} copy`; await saveProject(); await refreshProjectList(); });
favoriteProjectButton?.addEventListener("click", async () => { if (!projectList.value) return; const project = await projectLibrary.get(projectList.value); if (project) { await projectLibrary.patch(project.id, { favorite: !project.favorite }); await refreshProjectList(); } });
deleteProjectButton?.addEventListener("click", async () => { if (!projectList.value) return; if (window.confirm("Archive this project?")) { await projectLibrary.patch(projectList.value, { archived: true }); await refreshProjectList(); status.textContent = "Project archived on this device."; } });
exportProjectButton?.addEventListener("click", async () => { if (!projectList.value) { status.textContent = "Select a project to export."; return; } const project = await projectLibrary.get(projectList.value); if (project) { downloadProjectBundle(createProjectBundle(project), `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`); addTimeline("Exported", project.name); } });
importProjectInput?.addEventListener("change", event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 30 * 1024 * 1024) { status.textContent = "That project bundle is too large."; return; } const reader = new FileReader(); reader.onload = async () => { try { const bundle = JSON.parse(reader.result); const migrated = migrateProjectBundle(bundle); if (!migrated || !validateProjectBundle(migrated)) throw new Error("Unsupported project bundle"); const project = { ...migrated.project, id: globalThis.crypto?.randomUUID?.() || `import-${Date.now()}`, updatedAt: Date.now() }; await projectLibrary.put(project); applyProject(project); await refreshProjectList(); addTimeline("Imported", project.name || "Project"); status.textContent = `Project “${project.name || "Project"}” imported.`; } catch (error) { status.textContent = "That project bundle is not compatible. Choose a TraceLens export."; console.warn("[TraceLens import] bundle failed", error); } }; reader.onerror = () => { status.textContent = "Could not read that project bundle."; }; reader.readAsText(file); });
saveProfileButton?.addEventListener("click", () => { calibrationProfiles.save(profileInput.value, { preset: presetInput.value, perspective: activePerspectiveQuad, state: captureState(), locks: { ...locks } }); status.textContent = `Calibration “${profileInput.value}” saved.`; });
undoButton?.addEventListener("click", () => { const state = history.undo(); if (state) { restoreWorkspaceState(state); status.textContent = "Undo applied."; } });
redoButton?.addEventListener("click", () => { const state = history.redo(); if (state) { restoreWorkspaceState(state); status.textContent = "Redo applied."; } });
blendModeInput?.addEventListener("change", () => { renderOverlay(); pushHistory(); });
blendSwatches?.addEventListener("click", event => { const button = event.target.closest("[data-blend]"); if (!button) return; blendModeInput.value = button.dataset.blend; renderOverlay(); pushHistory(); });
guideInput?.addEventListener("change", event => { guides.setMode(event.target.value); pushHistory(); });
traceModeInput?.addEventListener("change", queueTraceRefresh);
traceModeChips?.addEventListener("click", event => { const chip = event.target.closest("[data-trace-mode]"); if (chip) setTraceMode(chip.dataset.traceMode); });
[traceStrengthInput, traceDetailInput, tracePriorityInput, traceLineWeightInput, traceLevelsInput, traceIsolationInput, traceThresholdInput, traceBlurInput, traceBackgroundInput, traceStageInput, traceFocusShapeInput, traceOutsideOpacityInput, quickTraceOpacityInput].forEach(input => { input?.addEventListener("input", () => { updateTraceOutputs(); queueTraceRefresh(); }); input?.addEventListener("change", pushHistory); });
traceResetButton?.addEventListener("click", () => { const layer = activeLayer(); if (!layer) return; layer.trace = { ...DEFAULT_TRACE, settings: { ...DEFAULT_TRACE.settings } }; applyTraceControls(layer); refreshTraceView(layer); status.textContent = "Trace Assist reset."; });
traceRetryButton?.addEventListener("click", () => { const layer = activeLayer(); if (layer) { layer.trace.enabled = layer.trace.mode !== "Original"; refreshTraceView(layer); } });
diagnosticsInput?.addEventListener("change", event => { diagnosticsOutput.hidden = !event.target.checked; updateContext(); });
document.querySelectorAll("[data-lock]").forEach(input => input.addEventListener("change", event => { locks.toggle(event.target.dataset.lock); status.textContent = `${event.target.dataset.lock} ${event.target.checked ? "locked" : "unlocked"}.`; pushHistory(); }));
autoOpacityInput?.addEventListener("change", event => { adaptiveOpacity.setEnabled(event.target.checked); if (event.target.checked) status.textContent = "Auto Opacity active."; });
autoPerspectiveButton?.addEventListener("click", () => {
  if (perspectiveActive && surfaceTracker.locked) { snapController.clear(); perspectiveActive = false; activePerspectiveQuad = null; surfaceTracker.unlock(); perspectiveSession.unlock(); autoPerspectiveScanning = false; autoPerspectiveButton.classList.remove("active"); restoreLayerVisibility(); selectionFrame.style.clipPath = "none"; pushHistory(); status.textContent = "Manual mode."; visionStatus.textContent = "Manual mode"; updateContext(); return; }
  if (autoPerspectiveScanning) { surfaceTracker.cancelScan(); perspectiveSession.cancel(); autoPerspectiveScanning = false; autoPerspectiveButton.classList.remove("active"); visionStatus.textContent = "Manual mode"; status.textContent = "Surface scan cancelled."; updateContext(); return; }
  autoPerspectiveScanning = true; surfaceTracker.beginScan(); perspectiveSession.beginScan(); surfaceTracker.start(camera); autoPerspectiveButton.classList.add("active"); visionStatus.textContent = "Scanning surface…"; status.textContent = "Scanning surface. Hold steady."; updateContext();
});
manualPerspectiveButton?.addEventListener("click", () => { surfaceTracker.unlock(); surfaceTracker.cancelScan(); perspectiveSession.cancel(); autoPerspectiveScanning = false; activePerspectiveQuad = [{ x: .08, y: .08 }, { x: .92, y: .08 }, { x: .92, y: .92 }, { x: .08, y: .92 }]; perspectiveActive = true; autoPerspectiveButton.classList.remove("active"); overlay.style.display = "none"; snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; syncActiveLayer(); pushHistory(); status.textContent = "Manual mode · adjust corners."; visionStatus.textContent = "Manual mode"; updateContext(); });
layerVisibility?.addEventListener("click", () => { overlay.hidden = !overlay.hidden; const layer = activeLayer(); if (layer) layer.visible = !overlay.hidden; restoreLayerVisibility(layer); layerVisibility.textContent = overlay.hidden ? "⊘" : "◉"; layerVisibility.setAttribute("aria-label", overlay.hidden ? "Show overlay" : "Hide overlay"); pushHistory(); });
layerLock?.addEventListener("click", () => { locks.toggle("position"); const layer = activeLayer(); if (layer) layer.locked = locks.position; stage.classList.toggle("locked", locks.position); layerLock.textContent = locks.position ? "♙" : "♧"; layerLock.setAttribute("aria-label", locks.position ? "Unlock overlay" : "Lock overlay"); pushHistory(); });
layerAdd?.addEventListener("click", () => dockImageInput?.click());
quickTraceModeButton?.addEventListener("click", () => setTraceSheet("peek", "trace"));
quickTraceExpandButton?.addEventListener("click", () => setTraceSheet(traceSheetState === "expanded" ? "peek" : "expanded", "trace"));
quickAssistButton?.addEventListener("click", () => setTraceMode(activeLayer()?.trace?.mode !== "Original" ? activeLayer().trace.mode : lastAssistMode));
quickOriginalButton?.addEventListener("pointerdown", event => { event.preventDefault(); quickOriginalDownAt = performance.now(); traceCompareHold = true; const layer = activeLayer(); if (layer) { overlay.src = layer.image; updateTraceQuickUI(layer); } });
quickOriginalButton?.addEventListener("pointerup", () => { const held = performance.now() - quickOriginalDownAt >= 350; traceCompareHold = false; const layer = activeLayer(); if (layer) refreshTraceView(layer); if (held) ignoreQuickOriginalClick = true; });
quickOriginalButton?.addEventListener("pointercancel", () => { traceCompareHold = false; const layer = activeLayer(); if (layer) refreshTraceView(layer); ignoreQuickOriginalClick = true; });
quickOriginalButton?.addEventListener("click", () => { if (ignoreQuickOriginalClick) { ignoreQuickOriginalClick = false; return; } setTraceMode("Original"); });
layersToggle?.addEventListener("click", () => { layersExpanded = !layersExpanded; if (layersExpanded && adjustSheet.classList.contains("open")) setTraceSheet("closed"); layersList.hidden = !layersExpanded; layerCard.classList.toggle("layers-expanded", layersExpanded); layersToggle.setAttribute("aria-expanded", String(layersExpanded)); layersToggle.lastChild.textContent = layersExpanded ? "⌄" : "⌃"; });
layersList?.addEventListener("click", event => {
  const row = event.target.closest("[data-layer-id]"); if (!row) return;
  const id = row.dataset.layerId; const layer = layers.find(item => item.id === id); if (!layer) return;
  const action = event.target.closest(".layer-row-action")?.className || "";
  if (action.includes("visibility")) { layer.visible = layer.visible === false; if (id === activeLayerId) { overlay.hidden = !layer.visible; overlay.style.display = layer.visible ? "block" : "none"; } renderLayers(true); return; }
  if (action.includes("lock")) { layer.locked = !layer.locked; if (id === activeLayerId) applyLocks({ position: layer.locked }); renderLayers(true); return; }
  if (action.includes("duplicate")) { syncActiveLayer(); const copy = duplicateLayer(layer); layers.splice(layers.indexOf(layer) + 1, 0, copy); setLayers(layers, copy.id); pushHistory(); status.textContent = `${copy.name} duplicated.`; return; }
  if (action.includes("delete")) { if (layers.length === 1) { status.textContent = "Keep at least one reference layer."; return; } if (!window.confirm(`Delete layer “${layer.name}”?`)) return; traceQueue?.cancel(); traceResults.delete(layer.id); traceEngine.clearLayerCache(layer.image); const index = layers.indexOf(layer); layers.splice(index, 1); setLayers(layers, layers[Math.max(0, index - 1)]?.id || layers[0].id); queueVisibleTraceLayers(); pushHistory(); status.textContent = `${layer.name} deleted.`; return; }
  if (action.includes("up") || action.includes("down")) { const index = layers.indexOf(layer); const nextIndex = action.includes("up") ? Math.min(layers.length - 1, index + 1) : Math.max(0, index - 1); if (index !== nextIndex) [layers[index], layers[nextIndex]] = [layers[nextIndex], layers[index]]; renderLayers(true); pushHistory(); return; }
  if (event.target.closest(".layer-row-main")) { syncActiveLayer(); surfaceTracker.unlock(); perspectiveSession.cancel(); perspectiveActive = false; activePerspectiveQuad = null; layersExpanded = false; layersList.hidden = true; layerCard.classList.remove("layers-expanded"); layersToggle.setAttribute("aria-expanded", "false"); loadLayerState(layer); renderOverlay(); selectionFrame.classList.add("visible"); pushHistory(); status.textContent = `${layer.name} selected.`; }
});
resetButton?.addEventListener("click", () => { x = 0; y = 0; scale = 1; rotation = 0; opacity = 0.55; flipped = false; opacityInput.value = opacity; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); flipButton?.classList.remove("active"); status.textContent = "Overlay position reset."; });

function setComparing(next) {
  comparing = next;
  overlay.classList.toggle("comparison-hidden", comparing);
  perspectiveOverlay.classList.toggle("comparison-hidden", comparing);
  compareButton.classList.toggle("active", comparing);
  if (comparing) status.textContent = "Before view · release to restore overlay.";
}
compareButton?.addEventListener("pointerdown", event => { event.preventDefault(); setComparing(true); compareButton.setPointerCapture(event.pointerId); });
compareButton?.addEventListener("pointerup", () => setComparing(false));
compareButton?.addEventListener("pointercancel", () => setComparing(false));
compareButton?.addEventListener("pointerleave", () => { if (comparing) setComparing(false); });

function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function angle(a, b) { return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180 / Math.PI; }
stage?.addEventListener("pointerdown", event => {
  if (!overlay.src || (locks.position && locks.rotation && locks.scale && locks.perspective)) return;
  wakeHUD(); gestureCoach.dismiss();
  const now = performance.now();
  if (now - lastTapAt < 320) { x = 0; y = 0; renderOverlay(); status.textContent = "Overlay centered."; }
  lastTapAt = now;
  window.clearTimeout(longPressTimer); longPressTimer = window.setTimeout(() => { locks.toggle("position"); stage.classList.toggle("locked", locks.position); layerLock.textContent = locks.position ? "♙" : "♧"; status.textContent = locks.position ? "Overlay locked." : "Overlay unlocked."; }, 650);
  const handle = event.target.closest?.(".selection-frame i");
  if (perspectiveActive && handle && locks.canEdit("perspective")) { perspectiveDragIndex = [...selectionFrame.querySelectorAll("i")].indexOf(handle); stage.setPointerCapture(event.pointerId); return; }
  if (!locks.canEdit("position")) return;
  if (perspectiveActive && locks.canEdit("perspective")) { snapController.clear(); perspectiveActive = false; surfaceTracker.unlock(); perspectiveSession.cancel(); overlay.style.display = "block"; autoPerspectiveButton.classList.remove("active"); selectionFrame.classList.remove("surface-found"); selectionFrame.style.clipPath = "none"; status.textContent = "Manual alignment resumed."; updateContext(); }
  pointers.set(event.pointerId, event); stage.setPointerCapture(event.pointerId);
  if (pointers.size === 1) { dragging = true; pointerStartX = event.clientX; pointerStartY = event.clientY; originX = x; originY = y; }
  if (pointers.size === 2) { dragging = false; const [a, b] = [...pointers.values()]; gestureStart = { distance: distance(a,b), angle: angle(a,b), scale, rotation }; }
});
stage?.addEventListener("pointermove", event => {
  if (perspectiveActive && perspectiveDragIndex !== null && activePerspectiveQuad) { activePerspectiveQuad[perspectiveDragIndex] = { x: Math.max(0, Math.min(1, event.offsetX / stage.clientWidth)), y: Math.max(0, Math.min(1, event.offsetY / stage.clientHeight)) }; const pixels = perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight); snapController.snap(activeRenderSource(), pixels, stage.clientWidth, stage.clientHeight, opacity); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; return; }
  if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, event);
  if (pointers.size === 2 && gestureStart) { const [a,b] = [...pointers.values()]; if (locks.canEdit("scale")) scale = Math.max(.25, Math.min(3, gestureStart.scale * distance(a,b) / gestureStart.distance)); if (locks.canEdit("rotation")) { const rawRotation = gestureStart.rotation + angle(a,b) - gestureStart.angle; rotation = Math.round(rawRotation / 15) * 15; } scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); return; }
  if (dragging) { x = originX + event.clientX - pointerStartX; y = originY + event.clientY - pointerStartY; renderOverlay(); }
});
function endPointer(event) { const wasPerspective = perspectiveDragIndex !== null; perspectiveDragIndex = null; pointers.delete(event.pointerId); if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (wasPerspective) syncActiveLayer(); if (pointers.size < 2) { gestureStart = null; pushHistory(); } dragging = pointers.size === 1; }
stage?.addEventListener("pointerup", endPointer); stage?.addEventListener("pointercancel", endPointer);
stage?.addEventListener("pointerup", () => window.clearTimeout(longPressTimer));
stage?.addEventListener("pointercancel", () => { window.clearTimeout(longPressTimer); pointers.clear(); gestureStart = null; dragging = false; });
window.addEventListener("blur", () => { window.clearTimeout(longPressTimer); pointers.clear(); gestureStart = null; dragging = false; });
}
document.addEventListener("visibilitychange", () => { if (document.hidden) { traceEngine.cancel(); surfaceTracker.stop(); } else if (camera.srcObject && workspaceImage) { surfaceTracker.start(camera); const layer = activeLayer(); if (layer?.trace?.enabled) refreshTraceView(layer); } });
window.addEventListener("keydown", event => { if (event.key === "Escape" && adjustSheet.classList.contains("open")) { closeAdjust.click(); } });
let visionFrameId = 0;
let visionLoopStarted = false;
function requestVisionFrame(now = performance.now()) { diagnostics.frame(); if (workspaceImage && !document.hidden && camera.srcObject) adaptiveOpacity.update(camera, now); diagnostics.render({ tracking: surfaceTracker.state.confidence, camera: camera.videoWidth ? `${camera.videoWidth}×${camera.videoHeight}` : "—", quality: perspectiveActive ? "perspective" : "high", trace: diagnosticsInput?.checked ? traceEngine.diagnostics() : null, ...latestSurfaceDiagnostics }); visionFrameId = requestAnimationFrame(requestVisionFrame); }
function updateViewportHeight() { const height = globalThis.visualViewport?.height || window.innerHeight; document.documentElement.style.setProperty("--app-viewport-height", `${Math.round(height)}px`); }
updateViewportHeight(); window.addEventListener("resize", updateViewportHeight, { passive: true }); window.visualViewport?.addEventListener("resize", updateViewportHeight, { passive: true }); window.visualViewport?.addEventListener("scroll", updateViewportHeight, { passive: true });

function initializeCoreUI() {
  const required = { stage, camera, overlay, cameraState, status, imageInput, dockImageInput, cameraButton };
  const missing = Object.entries(required).filter(([, element]) => !element).map(([name]) => name);
  if (missing.length) throw new Error(`TraceLens core UI missing: ${missing.join(", ")}`);
  if (gestureHint) gestureHint.hidden = true;
  renderOverlay();
  updateContext();
}

function initializeCamera() {
  startCamera().catch(error => { console.error("[TraceLens camera] startup failed", error); });
}

function initializeImageImport() {
  if (!imageInput || !dockImageInput) throw new Error("TraceLens image import controls are missing.");
  console.info("[TraceLens core] image import handlers ready");
}

function initializeOptionalSystems() {
  try {
    profileInput.replaceChildren(...calibrationProfiles.names().map(name => new Option(name, name)));
    applyPreset(presetInput.value, false);
    refreshProjectList();
    restoreWorkspace();
    restoreLatestProject();
  } catch (error) {
    console.error("[TraceLens optional] initialization failed; core camera/import remain active", error);
    status.textContent = "Camera ready. Advanced workspace tools are unavailable.";
  }
}

try {
  bindEventListeners();
  initializeCoreUI();
  initializeImageImport();
  initializeCamera();
  initializeOptionalSystems();
  registerPWA({ onUpdate: update => { pendingPWAUpdate = update; if (updateAction) updateAction.hidden = false; status.textContent = "Update available. Apply it when ready."; } });
  if (!visionLoopStarted) { visionLoopStarted = true; requestVisionFrame(); }
} catch (error) {
  console.error("[TraceLens core] initialization failed", error);
  if (status) status.textContent = "TraceLens could not initialize. Refresh and try again.";
}
