/**
 * Browser runtime composition root. This module binds DOM events, owns the
 * active workspace/session model, coordinates feature services, and renders
 * small UI updates. Geometry, processing, storage, and state rules stay in
 * dedicated modules. Optional camera/vision/worker failures must not erase
 * the current alignment.
 */
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
import { summarizeTrace } from "./trace-analysis.js";
import { HandTracker } from "./hand-tracker.js";
import { TraceGuideRenderer } from "./trace-guide-renderer.js";
import { TraceGuideController } from "./trace-guide.js";
import { normalizeGuideState } from "./trace-guide-state.js";
import { AppStateMachine } from "./app-state-machine.js";
import { normalizeFeatureFlags } from "./feature-flags.js";
import { createGuidedState, completeStep, setStep } from "./guided-tracing.js";
import { compareImageData, comparisonSummary } from "./comparison.js";
import { addRegion, activeRegion, completeRegion, createRegionState, removeRegion, setActiveRegion } from "./regions.js";
import { createSessionState, pauseSession, recordSessionEvent, resumeSession, sessionDuration, startSession, stopSession, milestones, replayAt } from "./session-replay.js";
import { ghostOverlayCssTransform, normalizeGhostOverlay } from "./ghost-overlay.js";
import { DEFAULT_GHOST_COMPARE, ghostCompareChanged, ghostCompareRenderInstructions, normalizeGhostCompare } from "./ghost-compare.js";
import { DEFAULT_GHOST_BRUSH, appendGhostBrushTrail, ghostBrushChanged, ghostBrushRenderInstructions, ghostBrushStageToOverlayPoint, normalizeGhostBrush, normalizeGhostBrushPoint, resolveGhostBrushPosition } from "./ghost-brush.js";
import { BetaDiagnostics, downloadDiagnosticReport, normalizeDiagnosticViewport } from "./beta-diagnostics.js";
import { waitForVideoMetadata } from "./camera-lifecycle.js";
import { createViewportCoordinator } from "./viewport-coordinator.js";
import { imageDisplayName, isSupportedImageFile } from "./image-import.js";

const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const perspectiveOverlay = document.querySelector("#perspectiveOverlay");
const measurementGuides = document.querySelector("#measurementGuides");
const stage = document.querySelector("#stage");
const freezeFrame = document.querySelector("#freezeFrame");
const imageInput = document.querySelector("#imageInput");
const dockImageInput = document.querySelector("#dockImageInput");
const opacityInput = document.querySelector("#opacityInput");
const scaleInput = document.querySelector("#scaleInput");
const rotationInput = document.querySelector("#rotationInput");
const cameraButton = document.querySelector("#cameraButton");
const cameraFacingButton = document.querySelector("#cameraFacingButton");
const freezeCameraButton = document.querySelector("#freezeCameraButton");
const captureDrawingButton = document.querySelector("#captureDrawingButton");
const compareDrawingButton = document.querySelector("#compareDrawingButton");
const comparisonOverlay = document.querySelector("#comparisonOverlay");
const compareTraceOverlay = document.querySelector("#compareTraceOverlay");
const comparisonStatus = document.querySelector("#comparisonStatus");
const ghostComparePanel = document.querySelector("#ghostComparePanel");
const ghostCompareStatus = document.querySelector("#ghostCompareStatus");
const ghostCompareSummary = document.querySelector("#ghostCompareSummary");
const ghostCompareBlendInput = document.querySelector("#ghostCompareBlendInput");
const ghostCompareBlendOutput = document.querySelector("#ghostCompareBlendOutput");
const ghostCompareSplitInput = document.querySelector("#ghostCompareSplitInput");
const ghostCompareSplitOutput = document.querySelector("#ghostCompareSplitOutput");
const ghostCompareResetButton = document.querySelector("#ghostCompareResetButton");
const ghostCompareExitButton = document.querySelector("#ghostCompareExitButton");
const ghostCompareDivider = document.querySelector("#ghostCompareDivider");
const ghostBrushPanel = document.querySelector("#ghostBrushPanel");
const ghostBrushStatus = document.querySelector("#ghostBrushStatus");
const ghostBrushSummary = document.querySelector("#ghostBrushSummary");
const ghostBrushToggleButton = document.querySelector("#ghostBrushToggleButton");
const ghostBrushResetButton = document.querySelector("#ghostBrushResetButton");
const ghostBrushModeInput = document.querySelector("#ghostBrushModeInput");
const ghostBrushRadiusInput = document.querySelector("#ghostBrushRadiusInput");
const ghostBrushRadiusOutput = document.querySelector("#ghostBrushRadiusOutput");
const ghostBrushFeatherInput = document.querySelector("#ghostBrushFeatherInput");
const ghostBrushFeatherOutput = document.querySelector("#ghostBrushFeatherOutput");
const ghostBrushOutsideInput = document.querySelector("#ghostBrushOutsideInput");
const ghostBrushOutsideOutput = document.querySelector("#ghostBrushOutsideOutput");
const ghostBrushEdgeInput = document.querySelector("#ghostBrushEdgeInput");
const ghostBrushEdgeOutput = document.querySelector("#ghostBrushEdgeOutput");
const ghostBrushTrailInput = document.querySelector("#ghostBrushTrailInput");
const ghostBrushEndpointInput = document.querySelector("#ghostBrushEndpointInput");
const ghostBrushTrailInputRange = document.querySelector("#ghostBrushTrailInputRange");
const ghostBrushTrailOutput = document.querySelector("#ghostBrushTrailOutput");
const regionOverlay = document.querySelector("#regionOverlay");
const cameraState = document.querySelector("#cameraState");
const gridButton = document.querySelector("#gridButton");
const flipButton = document.querySelector("#flipButton");
const resetButton = document.querySelector("#resetButton");
const adjustButton = document.querySelector("#adjustButton");
const compareButton = document.querySelector("#compareButton");
const workspaceButton = document.querySelector("#workspaceButton");
const closeAdjust = document.querySelector("#closeAdjust");
const sheetHandle = document.querySelector("#sheetHandle");
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
const betaDiagnosticsPanel = document.querySelector("#betaDiagnosticsPanel");
const betaDiagnosticsSummary = document.querySelector("#betaDiagnosticsSummary");
const betaDiagnosticsEvents = document.querySelector("#betaDiagnosticsEvents");
const betaDiagnosticsStatus = document.querySelector("#betaDiagnosticsStatus");
const betaDiagnosticsCopy = document.querySelector("#betaDiagnosticsCopy");
const betaDiagnosticsDownload = document.querySelector("#betaDiagnosticsDownload");
const betaDiagnosticsClear = document.querySelector("#betaDiagnosticsClear");
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
const traceGuideOverlay = document.querySelector("#traceGuideOverlay");
const traceGuideEnabledInput = document.querySelector("#traceGuideEnabledInput");
const traceGuidePauseButton = document.querySelector("#traceGuidePauseButton");
const traceGuideNextButton = document.querySelector("#traceGuideNextButton");
const traceGuideModeInput = document.querySelector("#traceGuideModeInput");
const traceGuideToleranceInput = document.querySelector("#traceGuideToleranceInput");
const traceGuideSmoothingInput = document.querySelector("#traceGuideSmoothingInput");
const traceGuideCalibrateButton = document.querySelector("#traceGuideCalibrateButton");
const traceGuideStatus = document.querySelector("#traceGuideStatus");
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
const presetDescription = document.querySelector("#presetDescription");
const status = document.querySelector("#status");
const updateAction = document.querySelector("#updateAction");
let pendingPWAUpdate = null;
const featureFlags = normalizeFeatureFlags();
const appStateMachine = new AppStateMachine({ onInvalid: event => console.warn("[TraceLens state] invalid transition", event.from, event.to) });
/** Apply a user-visible transition without throwing on stale UI input. */
function transitionAppState(next, reason = "") { return appStateMachine.tryTransition(next, { reason }); }

let x = 0, y = 0, scale = 1, rotation = 0, opacity = 0.55, flipped = false, stream = null;
let cameraRequestToken = 0;
let cameraRequestPending = false;
let projectOperationToken = 0;
let imageImportToken = 0;
let pendingImageReader = null;
let freezeCamera = false;
let finishedDrawingImage = null;
let sessionReplay = createSessionState();
let replayCursorMs = 0;
let pointers = new Map(), gestureStart = null, dragging = false, pointerStartX = 0, pointerStartY = 0, originX = 0, originY = 0, ghostGestureStart = null;
const overlayTools = document.querySelectorAll(".overlay-tool");
const WORKSPACE_KEY = "tracelens-workspace-v1";
let workspaceImage = null;
let layers = [];
let activeLayerId = null;
let compareState = normalizeGhostCompare(DEFAULT_GHOST_COMPARE);
let compareDifferenceResult = null;
let compareDifferenceToken = 0;
let compareSplitPointerId = null;
let compareSplitBefore = null;
let compareSplitRect = null;
let compareRenderSnapshot = null;
let ghostBrushState = normalizeGhostBrush(DEFAULT_GHOST_BRUSH);
let ghostBrushPointer = null;
let ghostBrushPointerActive = false;
let ghostBrushPointerId = null;
let ghostBrushPointerRect = null;
let ghostBrushTrail = [];
let ghostBrushEdgeToken = 0;
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
const LAYER_CARD_STATE_KEY = "tracelens-layer-card-expanded-v1";
let layersExpanded = globalThis.localStorage?.getItem(LAYER_CARD_STATE_KEY) === "true";
let traceSheetState = "closed";
let traceCompareHold = false;
let lastAssistMode = "Clean Lines";
let quickOriginalDownAt = 0;
let ignoreQuickOriginalClick = false;
let listenersBound = false;
let overlayEmphasisInput = null;
let overlayEmphasisOutput = null;
let overlayReadabilityButtons = null;
let guidedPanel = null;
let historyRestoring = false;
let traceQueue = null;
let lastPersistenceResult = "unknown";
let lastDiagnosticViewportKey = "";
let pendingDifferenceCount = 0;
let pendingSaveCount = 0;
let pendingProjectLoadCount = 0;
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
const betaDiagnostics = new BetaDiagnostics({ build: "web-rc1-beta" });
const calibrationProfiles = new CalibrationProfiles();
const timeline = new SessionTimeline();
const gestureCoach = new GestureCoach(gestureCoachElement, { reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches });
const traceEngine = new TraceEngine({ onStatus: update => { if (traceProcessing) { traceProcessing.hidden = !["processing", "cancelled"].includes(update.state); traceProcessing.textContent = update.state === "processing" ? (update.preview ? "Previewing…" : "Processing final…") : update.state === "cancelled" ? "Cancelled" : "Complete"; } if (traceRetryButton && update.state === "processing") traceRetryButton.hidden = true; if (update.state === "fallback") console.warn("[TraceLens trace] worker unavailable; using main thread", update.detail); } });
const traceGuideRenderer = new TraceGuideRenderer(traceGuideOverlay);
const traceHandTracker = new HandTracker({ detector: globalThis.TraceLensHandDetector || null, onStatus: update => { if (update.state === "unavailable") { if (traceGuideStatus) traceGuideStatus.textContent = "Unavailable"; if (status) status.textContent = "Trace Guide needs a local hand landmark model."; } } });
const traceGuide = new TraceGuideController({ video: camera, stage, tracker: traceHandTracker, renderer: traceGuideRenderer, onUpdate: state => { const layer = activeLayer(); if (layer) layer.trace.guide = normalizeGuideState(state); if (traceGuideStatus) traceGuideStatus.textContent = state.status || "Off"; if (traceGuidePauseButton) traceGuidePauseButton.textContent = state.running ? "Pause" : "Start"; }, onStatus: update => { if (update.state === "unavailable" && traceGuideStatus) traceGuideStatus.textContent = "Unavailable"; } });
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

function updateGuidedUI(layer = activeLayer()) {
  if (!guidedPanel || !layer) return;
  const guided = layer.guided = createGuidedState(layer.guided); const step = guided.steps[guided.activeStep];
  const title = guidedPanel.querySelector("[data-guided-title]"); const detail = guidedPanel.querySelector("[data-guided-detail]"); const progress = guidedPanel.querySelector("[data-guided-progress]"); const complete = guidedPanel.querySelector("[data-guided-complete]");
  if (title) title.textContent = step ? `${guided.activeStep + 1}/${guided.steps.length} · ${step.title}` : "Guided tracing";
  if (detail) detail.textContent = step?.description || "Work through the suggested layers at your own pace.";
  if (progress) progress.textContent = `${Math.round(guided.sessionProgress * 100)}% complete`;
  if (complete) complete.textContent = step?.completed ? "Completed" : "Mark complete";
  const auto = guidedPanel.querySelector("[data-guided-auto]"); if (auto) auto.checked = guided.autoAdvance;
}

function changeGuidedStep(direction) { const layer = activeLayer(); if (!layer) return; const guided = createGuidedState(layer.guided); guided.activeStep = Math.max(0, Math.min(guided.steps.length - 1, guided.activeStep + direction)); layer.guided = guided; updateGuidedUI(layer); pushHistory(); transitionAppState("Tracing", "guided step changed"); }

function renderRegionOverlay() {
  if (!regionOverlay || !stage) return;
  const region = activeRegion(activeLayer()?.regions);
  regionOverlay.width = Math.max(1, stage.clientWidth); regionOverlay.height = Math.max(1, stage.clientHeight);
  const context = regionOverlay.getContext("2d"); if (!context) return;
  context.clearRect(0, 0, regionOverlay.width, regionOverlay.height);
  if (!region || region.visible === false) { regionOverlay.hidden = true; return; }
  const points = region.points.map(point => ({ x: point.x * regionOverlay.width, y: point.y * regionOverlay.height }));
  context.save(); context.strokeStyle = region.completed ? "rgba(68,210,122,.72)" : "rgba(93,185,255,.78)"; context.fillStyle = region.completed ? "rgba(68,210,122,.06)" : "rgba(93,185,255,.05)"; context.lineWidth = 1.5; context.setLineDash([6, 5]); context.beginPath();
  if (region.shape === "rectangle") { const left = Math.min(points[0].x, points[1].x); const top = Math.min(points[0].y, points[1].y); const width = Math.abs(points[1].x - points[0].x); const height = Math.abs(points[1].y - points[0].y); context.rect(left, top, width, height); } else { points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.closePath(); }
  context.fill(); context.stroke(); context.restore();
  regionOverlay.hidden = false;
}

function updateRegionUI(layer = activeLayer()) {
  const panel = document.querySelector("#regionTracingPanel"); if (!panel) return;
  const state = createRegionState(layer?.regions); const select = panel.querySelector("[data-region-select]"); const statusOutput = panel.querySelector("[data-region-status]"); const complete = panel.querySelector("[data-region-complete]"); const deleteButton = panel.querySelector("[data-region-delete]");
  if (select) { select.replaceChildren(new Option(state.regions.length ? "Select region" : "No regions yet", ""), ...state.regions.map(region => new Option(`${region.completed ? "✓ " : ""}${region.name}`, region.id))); select.value = state.activeRegionId || ""; }
  const current = activeRegion(state); if (statusOutput) statusOutput.textContent = current ? `${current.shape} · ${Math.round(current.progress * 100)}%${current.notes ? ` · ${current.notes}` : ""}` : "Add a region to focus tracing.";
  let progress = panel.querySelector("[data-region-progress]"); if (!progress) { progress = document.createElement("progress"); progress.dataset.regionProgress = "true"; progress.max = 1; progress.className = "region-progress"; panel.querySelector("[data-region-status]")?.after(progress); }
  if (progress) { progress.value = current?.progress || 0; progress.setAttribute("aria-label", current ? `${current.name} progress` : "Trace region progress"); }
  if (complete) complete.textContent = current?.completed ? "Restore region" : "Complete region";
  if (deleteButton) deleteButton.disabled = !current;
  renderRegionOverlay();
}

function updateSessionUI() {
  const panel = document.querySelector("#sessionReplayPanel"); if (!panel) return;
  const stateOutput = panel.querySelector("[data-session-status]"); const duration = panel.querySelector("[data-session-duration]"); const milestoneOutput = panel.querySelector("[data-session-milestones]"); const start = panel.querySelector("[data-session-start]"); const pause = panel.querySelector("[data-session-pause]"); const stop = panel.querySelector("[data-session-stop]");
  if (stateOutput) stateOutput.textContent = sessionReplay.status === "recording" ? "Recording" : sessionReplay.status === "paused" ? "Paused" : sessionReplay.status === "stopped" ? "Stopped" : "Ready";
  if (duration) duration.textContent = `${Math.round(sessionDuration(sessionReplay) / 1000)}s active`;
  if (milestoneOutput) milestoneOutput.textContent = `${milestones(sessionReplay).length} milestones · ${sessionReplay.events.length} events`;
  if (start) start.disabled = sessionReplay.status === "recording";
  if (pause) { pause.disabled = !["recording", "paused"].includes(sessionReplay.status); pause.textContent = sessionReplay.status === "paused" ? "Resume" : "Pause"; }
  if (stop) stop.disabled = !["recording", "paused"].includes(sessionReplay.status);
}

function recordSession(type, detail = {}) { sessionReplay = recordSessionEvent(sessionReplay, type, { ...detail, appState: appStateMachine.state }); updateSessionUI(); }

function recordBetaEvent(type, metadata = {}) {
  betaDiagnostics.record(type, metadata);
  if (betaDiagnosticsPanel && !betaDiagnosticsPanel.hidden) updateBetaDiagnosticsUI();
}

function diagnosticReport() {
  const visual = globalThis.visualViewport;
  const orientation = globalThis.screen?.orientation;
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return betaDiagnostics.report({
    environment: { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language },
    viewport: normalizeDiagnosticViewport({ width: window.innerWidth, height: window.innerHeight, visualWidth: visual?.width, visualHeight: visual?.height, dpr: window.devicePixelRatio, orientation: orientation?.type, angle: orientation?.angle }),
    capabilities: { mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia), indexedDB: Boolean(globalThis.indexedDB), serviceWorker: Boolean(navigator.serviceWorker), pointerEvents: Boolean(globalThis.PointerEvent), maxTouchPoints: Number(navigator.maxTouchPoints) || 0, stylusObserved: Boolean(window.__traceLensStylusObserved), reducedMotion, offscreenCanvas: Boolean(globalThis.OffscreenCanvas) },
    camera: { state: cameraState?.textContent, facingMode: cameraFacing, videoWidth: Number(camera?.videoWidth) || 0, videoHeight: Number(camera?.videoHeight) || 0, mirrored: Boolean(camera?.classList.contains("selfie-camera") || flipped), requestGeneration: cameraRequestToken, streamActive: Boolean(stream) },
    application: { state: appStateMachine.state, visibility: document.visibilityState, activeProject: Boolean(currentProjectId || workspaceImage), activeLayerValid: Boolean(activeLayer()), activeRegionValid: Boolean(activeRegion(activeLayer()?.regions)), pendingAsyncOperations: { camera: Number(cameraRequestPending), imageImport: Number(Boolean(pendingImageReader)), save: pendingSaveCount, projectLoad: pendingProjectLoadCount, difference: pendingDifferenceCount, trace: Number(Boolean(traceDebounceTimer)) + Number(Boolean(tracePreviewTimer)) }, animationFrameOwners: { visionLoop: visionLoopStarted, compare: compareSplitPointerId !== null, brush: ghostBrushPointerActive } },
    storage: { indexedDB: Boolean(globalThis.indexedDB), lastPersistenceResult },
    serviceWorker: { supported: Boolean(navigator.serviceWorker), controller: Boolean(navigator.serviceWorker?.controller), state: navigator.serviceWorker?.controller?.state || "unknown" },
    features: { diagnostics: featureFlags.diagnostics, ghostOverlay: Boolean(workspaceImage), ghostCompare: Boolean(compareState.enabled), ghostCompareMode: compareState.mode, ghostBrush: Boolean(ghostBrushState.enabled), ghostBrushMode: ghostBrushState.mode, sessionReplay: featureFlags.sessionReplay }
  });
}

function updateBetaDiagnosticsUI() {
  if (!betaDiagnosticsPanel || betaDiagnosticsPanel.hidden) return;
  const report = diagnosticReport();
  if (betaDiagnosticsSummary) betaDiagnosticsSummary.textContent = `State: ${report.application.state} · Camera: ${report.camera.state || "unknown"} · Viewport: ${report.viewport.width || 0}×${report.viewport.height || 0}`;
  if (betaDiagnosticsEvents) {
    betaDiagnosticsEvents.replaceChildren(...report.recentEvents.slice(-8).reverse().map(event => { const item = document.createElement("li"); item.textContent = `${event.type} · ${new Date(event.timestamp).toLocaleTimeString()}`; return item; }));
  }
}

async function copyDiagnosticReport() {
  const text = JSON.stringify(diagnosticReport(), null, 2);
  try { await navigator.clipboard.writeText(text); if (betaDiagnosticsStatus) betaDiagnosticsStatus.textContent = "Diagnostic report copied."; }
  catch { if (betaDiagnosticsStatus) betaDiagnosticsStatus.textContent = "Copy is unavailable; use Download report."; }
}

function bindBetaDiagnostics() {
  if (!betaDiagnosticsPanel) return;
  betaDiagnosticsCopy?.addEventListener("click", copyDiagnosticReport);
  betaDiagnosticsDownload?.addEventListener("click", () => { const filename = downloadDiagnosticReport(diagnosticReport()); if (betaDiagnosticsStatus) betaDiagnosticsStatus.textContent = filename ? `Downloaded ${filename}` : "Download is unavailable."; });
  betaDiagnosticsClear?.addEventListener("click", () => { betaDiagnostics.clear(); updateBetaDiagnosticsUI(); if (betaDiagnosticsStatus) betaDiagnosticsStatus.textContent = "Diagnostic event log cleared."; });
}

window.addEventListener("error", event => { const message = event.error?.message || event.message || "Unhandled application error"; betaDiagnostics.error(message, { source: "window" }); recordBetaEvent("unhandled-application-error", { message }); });
window.addEventListener("unhandledrejection", event => { const reason = event.reason; const message = reason instanceof Error ? reason.message : String(reason || "Unhandled promise rejection"); betaDiagnostics.error(message, { source: "promise" }); recordBetaEvent("unhandled-promise-rejection", { message }); });

function updateContext() {
  const hasOverlay = Boolean(workspaceImage);
  document.querySelectorAll(".overlay-control").forEach(element => { element.hidden = !hasOverlay; });
  document.querySelectorAll(".perspective-control").forEach(element => { element.hidden = !hasOverlay; });
  document.querySelectorAll(".calibration-control").forEach(element => { element.hidden = !hasOverlay; });
  const diagnosticsEnabled = Boolean(diagnosticsInput?.checked);
  if (diagnosticsInput) diagnosticsInput.closest(".diagnostics-toggle")?.toggleAttribute("hidden", !featureFlags.diagnostics);
  if (diagnosticsOutput) diagnosticsOutput.hidden = !diagnosticsEnabled;
  if (betaDiagnosticsPanel) betaDiagnosticsPanel.hidden = !diagnosticsEnabled || !featureFlags.diagnostics;
  updateBetaDiagnosticsUI();
  if (quickTraceBar) quickTraceBar.hidden = !hasOverlay;
  const guideAvailable = featureFlags.guidedTracing && Boolean(traceHandTracker?.detector);
  if (traceGuideEnabledInput) traceGuideEnabledInput.disabled = !hasOverlay || !guideAvailable;
  if (traceGuidePauseButton) traceGuidePauseButton.disabled = !hasOverlay || !guideAvailable || !traceGuide.state.enabled;
  if (traceGuideNextButton) traceGuideNextButton.disabled = !hasOverlay || !(traceResults.get(activeLayerId)?.lines?.length);
  if (traceGuideCalibrateButton) traceGuideCalibrateButton.disabled = !hasOverlay || !guideAvailable;
  if (traceGuideStatus && !guideAvailable) traceGuideStatus.textContent = "Requires local hand-landmark model.";
  const traceGuidePanel = document.querySelector("#traceGuidePanel"); if (traceGuidePanel) traceGuidePanel.dataset.unavailable = String(!guideAvailable);
  updatePresetChips();
  updateGhostCompareControls();
  updateGhostBrushControls();
  updateRegionUI(); updateSessionUI();
}

function ghostBrushEndpoint() {
  const result = traceResults.get(activeLayerId); const width = Number(result?.analysisWidth); const height = Number(result?.analysisHeight);
  const lines = Array.isArray(result?.lines) ? result.lines : [];
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const points = Array.isArray(lines[index]?.points) ? lines[index].points : [];
    for (let pointIndex = points.length - 1; pointIndex >= 0; pointIndex -= 1) {
      const point = points[pointIndex]; if (Number.isFinite(point?.x) && Number.isFinite(point?.y) && width > 0 && height > 0) return { x: point.x / width * (stage?.clientWidth || 0), y: point.y / height * (stage?.clientHeight || 0) };
    }
  }
  return null;
}

function updateGhostBrushControls() {
  const available = Boolean(workspaceImage && activeLayer()?.image); const suspended = compareState.enabled;
  if (ghostBrushPanel) { ghostBrushPanel.hidden = !available; ghostBrushPanel.dataset.suspended = String(suspended); }
  if (ghostBrushToggleButton) { ghostBrushToggleButton.disabled = !available || suspended; ghostBrushToggleButton.textContent = ghostBrushState.enabled ? "Disable guidance" : "Enable guidance"; ghostBrushToggleButton.setAttribute("aria-pressed", String(ghostBrushState.enabled)); }
  [ghostBrushModeInput, ghostBrushRadiusInput, ghostBrushFeatherInput, ghostBrushOutsideInput, ghostBrushEdgeInput, ghostBrushTrailInput, ghostBrushEndpointInput, ghostBrushTrailInputRange].forEach(input => { if (input) input.disabled = !available || suspended; });
  if (ghostBrushModeInput) ghostBrushModeInput.value = ghostBrushState.mode;
  if (ghostBrushRadiusInput) ghostBrushRadiusInput.value = String(ghostBrushState.radius);
  if (ghostBrushRadiusOutput) ghostBrushRadiusOutput.textContent = `${ghostBrushState.radius}px`;
  if (ghostBrushFeatherInput) ghostBrushFeatherInput.value = String(ghostBrushState.feather);
  if (ghostBrushFeatherOutput) ghostBrushFeatherOutput.textContent = `${Math.round(ghostBrushState.feather * 100)}%`;
  if (ghostBrushOutsideInput) ghostBrushOutsideInput.value = String(ghostBrushState.outsideOpacity);
  if (ghostBrushOutsideOutput) ghostBrushOutsideOutput.textContent = `${Math.round(ghostBrushState.outsideOpacity * 100)}%`;
  if (ghostBrushEdgeInput) ghostBrushEdgeInput.value = String(ghostBrushState.edgeStrength);
  if (ghostBrushEdgeOutput) ghostBrushEdgeOutput.textContent = `${Math.round(ghostBrushState.edgeStrength * 100)}%`;
  if (ghostBrushTrailInput) ghostBrushTrailInput.checked = ghostBrushState.trailEnabled;
  if (ghostBrushEndpointInput) ghostBrushEndpointInput.checked = ghostBrushState.followEndpoint;
  if (ghostBrushTrailInputRange) ghostBrushTrailInputRange.value = String(ghostBrushState.trailLength);
  if (ghostBrushTrailOutput) ghostBrushTrailOutput.textContent = `${ghostBrushState.trailLength} points`;
  if (ghostBrushStatus) ghostBrushStatus.textContent = suspended ? "Suspended during Compare" : !available ? "Add a reference image." : !ghostBrushState.enabled ? "Guidance off" : (!ghostBrushPointerActive && ghostBrushState.followEndpoint && !ghostBrushEndpoint() ? "No trace endpoint yet" : "Guidance active");
  if (ghostBrushSummary) ghostBrushSummary.textContent = ghostBrushState.mode === "edge-focus" ? "Local contrast emphasis · not analytical edge detection." : "Guidance follows your tracing location and never alters the trace.";
}

function clearGhostBrushRender() { overlay.style.maskImage = "none"; overlay.style.webkitMaskImage = "none"; overlay.style.filter = "none"; perspectiveOverlay.style.maskImage = "none"; perspectiveOverlay.style.webkitMaskImage = "none"; perspectiveOverlay.style.filter = "none"; }
function renderGhostBrush({ updateControls = false } = {}) {
  clearGhostBrushRender();
  const target = perspectiveActive && !perspectiveOverlay.hidden ? perspectiveOverlay : overlay;
  if (!ghostBrushState.enabled || compareState.enabled || !workspaceImage || !stage?.clientWidth || !stage?.clientHeight || target.hidden) { if (updateControls) updateGhostBrushControls(); return; }
  const width = stage.clientWidth; const height = stage.clientHeight; const endpoint = ghostBrushEndpoint(); const position = resolveGhostBrushPosition({ pointer: ghostBrushPointerActive ? ghostBrushPointer : null, endpoint, followEndpoint: ghostBrushState.followEndpoint }, { width, height });
  const instructions = ghostBrushState.mode === "endpoint" && !position ? { visible: false } : ghostBrushRenderInstructions(ghostBrushState, position, { width, height, trail: ghostBrushTrail });
  if (!instructions.visible) { updateGhostBrushControls(); return; }
  let renderInstructions = instructions;
  if (target === overlay) {
    const localPosition = ghostBrushStageToOverlayPoint(instructions.position, { x, y, scale, rotation, flipped }, { width, height });
    const localTrail = instructions.trail.map(point => ghostBrushStageToOverlayPoint(point, { x, y, scale, rotation, flipped }, { width, height })).filter(Boolean);
    renderInstructions = ghostBrushRenderInstructions({ ...ghostBrushState, radius: ghostBrushState.radius / Math.max(.1, Math.abs(scale)) }, localPosition, { width, height, trail: localTrail });
  }
  target.style.maskImage = renderInstructions.mask; target.style.webkitMaskImage = renderInstructions.mask; target.style.maskSize = "100% 100%"; target.style.webkitMaskSize = "100% 100%"; target.style.opacity = String(Math.max(0, Math.min(1, opacity * renderInstructions.opacity))); target.style.filter = renderInstructions.filter;
  if (ghostBrushStatus && !ghostBrushPointerActive && !endpoint) ghostBrushStatus.textContent = "No trace endpoint yet";
  if (updateControls) updateGhostBrushControls();
}

function setGhostBrushState(next, { commit = false } = {}) { const previous = ghostBrushState; ghostBrushState = normalizeGhostBrush(next); renderGhostBrush({ updateControls: true }); if (commit && ghostBrushChanged(previous, ghostBrushState)) pushHistory(); }
function resetGhostBrush() { const previous = ghostBrushState; ghostBrushState = normalizeGhostBrush(DEFAULT_GHOST_BRUSH); ghostBrushTrail = []; renderGhostBrush({ updateControls: true }); if (ghostBrushChanged(previous, ghostBrushState)) pushHistory(); }
function updateGhostBrushPointer(event, { active = true } = {}) { if (!stage || !ghostBrushState.enabled || compareState.enabled) return; const rect = ghostBrushPointerRect || stage.getBoundingClientRect(); const point = normalizeGhostBrushPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top }, { width: stage.clientWidth, height: stage.clientHeight }); if (!point) return; ghostBrushPointer = point; ghostBrushPointerActive = active; if (ghostBrushState.trailEnabled && ghostBrushState.mode === "trail") ghostBrushTrail = appendGhostBrushTrail(ghostBrushTrail, point, { maxSamples: ghostBrushState.trailLength, time: performance.now() }); renderGhostBrush(); }
function releaseGhostBrushInteraction({ clearTrail = false } = {}) { ghostBrushPointerActive = false; ghostBrushPointerId = null; ghostBrushPointerRect = null; if (clearTrail) ghostBrushTrail = []; renderGhostBrush(); }

function organizeTraceControls() {
  const panel = document.querySelector("#traceAssistPanel"); const advanced = document.querySelector("#traceAdvanced"); const modeRow = traceModeInput?.closest(".trace-mode-row"); const traceGuidePanel = document.querySelector("#traceGuidePanel"); if (!panel || !advanced || !modeRow || panel.dataset.organized === "true") return;
  const section = (title, open = false) => { const details = document.createElement("details"); details.className = "trace-control-section"; details.open = open; const summary = document.createElement("summary"); summary.textContent = title; details.append(summary); return details; };
  const basic = section("Basic", true); const advancedSection = section("Advanced"); const creative = section("Creative"); const diagnosticsSection = section("Diagnostics"); const experimental = section("Experimental · Trace Guide (Beta)");
  const labelFor = input => input?.closest("label"); basic.append(modeRow, labelFor(traceDetailInput), labelFor(tracePriorityInput));
  const readability = document.createElement("div"); readability.className = "trace-readability"; readability.innerHTML = `<label class="slider"><span><span>Overlay emphasis</span><output id="overlayEmphasisOutput">Balanced</output></span><input id="overlayEmphasisInput" type="range" min="0" max="1" step="0.05" value="0.5" aria-label="Overlay emphasis" /></label><div class="trace-readability-actions" role="group" aria-label="Overlay visibility"><button type="button" data-readability="camera">Camera</button><button type="button" data-readability="blend" class="active">Blend</button><button type="button" data-readability="overlay">Overlay</button></div>`;
  basic.append(readability); overlayEmphasisInput = readability.querySelector("#overlayEmphasisInput"); overlayEmphasisOutput = readability.querySelector("#overlayEmphasisOutput"); overlayReadabilityButtons = readability.querySelectorAll("[data-readability]");
  const updateReadability = mode => { const layer = activeLayer(); if (!layer) return; const trace = traceState(layer); trace.settings.readabilityMode = mode; if (mode === "camera") trace.settings.overlayEmphasis = 0; if (mode === "overlay") trace.settings.overlayEmphasis = 1; applyTraceControls(layer); renderOverlay(); };
  overlayEmphasisInput?.addEventListener("input", () => { const layer = activeLayer(); if (!layer) return; traceState(layer).settings.overlayEmphasis = Math.max(0, Math.min(1, Number(overlayEmphasisInput.value))); traceState(layer).settings.readabilityMode = "blend"; applyTraceControls(layer); renderOverlay(); });
  overlayReadabilityButtons?.forEach(button => button.addEventListener("click", () => updateReadability(button.dataset.readability)));
  advancedSection.append(labelFor(traceThresholdInput), labelFor(traceBlurInput), labelFor(traceLineWeightInput));
  creative.append(labelFor(traceLevelsInput), labelFor(traceIsolationInput), labelFor(traceBackgroundInput), labelFor(traceStageInput), traceFocusShapeInput?.closest(".trace-focus-row"));
  const guidedSection = section("Guided tracing"); guidedPanel = document.createElement("div"); guidedPanel.className = "guided-tracing-panel"; guidedPanel.id = "guidedTracingPanel"; guidedPanel.innerHTML = `<div class="guided-tracing-heading"><strong data-guided-title>Guided tracing</strong><span data-guided-progress>0% complete</span></div><p data-guided-detail>Work through the suggested layers at your own pace.</p><div class="guided-tracing-actions"><button type="button" class="feature-button" data-guided-prev aria-label="Previous guided step">Previous</button><button type="button" class="feature-button" data-guided-next aria-label="Next guided step">Next</button><button type="button" class="feature-button" data-guided-complete>Mark complete</button></div><label class="check-control"><input type="checkbox" data-guided-auto /> Auto-advance steps</label>`; guidedSection.append(guidedPanel); guidedPanel.querySelector("[data-guided-prev]")?.addEventListener("click", () => changeGuidedStep(-1)); guidedPanel.querySelector("[data-guided-next]")?.addEventListener("click", () => changeGuidedStep(1)); guidedPanel.querySelector("[data-guided-complete]")?.addEventListener("click", () => { const layer = activeLayer(); if (!layer) return; layer.guided = completeStep(layer.guided); updateGuidedUI(layer); pushHistory(); status.textContent = layer.guided.sessionProgress >= 1 ? "Guided tracing complete." : "Guided step completed."; transitionAppState("Tracing", "guided step completed"); }); guidedPanel.querySelector("[data-guided-auto]")?.addEventListener("change", event => { const layer = activeLayer(); if (!layer) return; layer.guided = createGuidedState({ ...layer.guided, autoAdvance: event.target.checked }); pushHistory(); }); creative.append(guidedSection);
  const regionSection = section("Trace regions"); const regionPanel = document.createElement("div"); regionPanel.className = "guided-tracing-panel"; regionPanel.id = "regionTracingPanel"; regionPanel.innerHTML = `<div class="guided-tracing-heading"><strong>Trace regions</strong><span data-region-status>Add a region to focus tracing.</span></div><div class="feature-row"><label class="select-control"><span class="sr-only">Active trace region</span><select data-region-select aria-label="Active trace region"><option value="">No regions yet</option></select></label><button type="button" class="feature-button" data-region-add>Add region</button></div><div class="feature-row"><button type="button" class="feature-button" data-region-complete disabled>Complete region</button><button type="button" class="feature-button" data-region-delete disabled>Delete region</button></div>`; regionSection.append(regionPanel); creative.append(regionSection);
  regionPanel.querySelector("[data-region-add]")?.addEventListener("click", () => { const layer = activeLayer(); if (!layer) return; layer.regions = addRegion(layer.regions, { name: `Region ${layer.regions.regions.length + 1}` }); updateRegionUI(layer); pushHistory(); recordSession("Region created", { regionId: layer.regions.activeRegionId }); status.textContent = "Trace region added."; });
  regionPanel.querySelector("[data-region-select]")?.addEventListener("change", event => { const layer = activeLayer(); if (!layer) return; layer.regions = setActiveRegion(layer.regions, event.target.value); updateRegionUI(layer); pushHistory(); status.textContent = "Trace region selected."; });
  regionPanel.querySelector("[data-region-complete]")?.addEventListener("click", () => { const layer = activeLayer(); const current = activeRegion(layer?.regions); if (!layer || !current) return; layer.regions = completeRegion(layer.regions, current.id, !current.completed); updateRegionUI(layer); pushHistory(); recordSession("Region completed", { regionId: current.id }); status.textContent = current.completed ? "Trace region completed." : "Trace region restored."; });
  regionPanel.querySelector("[data-region-delete]")?.addEventListener("click", () => { const layer = activeLayer(); const current = activeRegion(layer?.regions); if (!layer || !current) return; layer.regions = removeRegion(layer.regions, current.id); updateRegionUI(layer); pushHistory(); recordSession("Region deleted", { regionId: current.id }); status.textContent = "Trace region deleted."; });
  const sessionSection = section("Session replay"); const sessionPanel = document.createElement("div"); sessionPanel.className = "guided-tracing-panel"; sessionPanel.id = "sessionReplayPanel"; sessionPanel.innerHTML = `<div class="guided-tracing-heading"><strong>Session replay</strong><span data-session-status>Ready</span></div><p><span data-session-duration>0s active</span> · <span data-session-milestones>0 milestones · 0 events</span></p><div class="guided-tracing-actions"><button type="button" class="feature-button" data-session-start>Start</button><button type="button" class="feature-button" data-session-pause disabled>Pause</button><button type="button" class="feature-button" data-session-stop disabled>Stop</button></div><label class="slider"><span>Replay position <output data-session-position>0%</output></span><input data-session-scrub type="range" min="0" max="100" value="0" aria-label="Replay position" /></label>`; sessionSection.append(sessionPanel); diagnosticsSection.append(sessionSection);
  sessionPanel.querySelector("[data-session-start]")?.addEventListener("click", () => { sessionReplay = startSession(sessionReplay); recordSession("Session started"); updateSessionUI(); });
  sessionPanel.querySelector("[data-session-pause]")?.addEventListener("click", () => { if (sessionReplay.status === "paused") { sessionReplay = resumeSession(sessionReplay); recordSession("Session resumed"); } else { recordSession("Session paused"); sessionReplay = pauseSession(sessionReplay); } updateSessionUI(); });
  sessionPanel.querySelector("[data-session-stop]")?.addEventListener("click", () => { sessionReplay = stopSession(sessionReplay); updateSessionUI(); recordSession("Session stopped"); updateSessionUI(); });
  sessionPanel.querySelector("[data-session-scrub]")?.addEventListener("input", event => { const value = Number(event.target.value) / 100; replayCursorMs = sessionDuration(sessionReplay) * value; const events = replayAt(sessionReplay, replayCursorMs); const position = sessionPanel.querySelector("[data-session-position]"); if (position) position.textContent = `${Math.round(value * 100)}%`; if (timelineOutput) timelineOutput.textContent = events.at(-1) ? `${events.at(-1).type} · replay` : "Session start · replay"; });
  if (traceGuidePanel) { experimental.append(traceGuidePanel); const note = traceGuidePanel.querySelector(".trace-guide-note"); if (note) note.textContent = "Requires local hand-landmark model. Guidance is approximate and does not directly detect a tool tip."; const actions = document.createElement("div"); actions.className = "trace-guide-actions"; actions.innerHTML = `<button type="button" class="feature-button" data-guide-action="learn">Learn more</button><button type="button" class="feature-button" data-guide-action="enable">Enable</button>`; actions.querySelector('[data-guide-action="learn"]')?.addEventListener("click", () => { if (traceGuideStatus) traceGuideStatus.textContent = "Runs locally when a hand-landmark model is installed."; }); actions.querySelector('[data-guide-action="enable"]')?.addEventListener("click", () => { if (!traceHandTracker?.detector) { if (traceGuideStatus) traceGuideStatus.textContent = "Requires local hand-landmark model."; return; } if (traceGuideEnabledInput) { traceGuideEnabledInput.disabled = false; traceGuideEnabledInput.checked = true; traceGuideEnabledInput.dispatchEvent(new Event("change", { bubbles: true })); } }); experimental.append(actions); }
  advanced.replaceChildren(advancedSection, creative, experimental); if (traceQuality) diagnosticsSection.append(traceQuality); panel.append(basic, advanced, diagnosticsSection); panel.dataset.organized = "true";
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

const DEFAULT_TRACE = Object.freeze({ enabled: false, mode: "Original", settings: { strength: .55, detail: .55, priority: .6, threshold: .48, blur: 1, background: "transparent", levels: 5, lineWeight: "Uniform", isolation: false, focusShape: "none", outsideOpacity: 25, assistOpacity: 1, overlayEmphasis: 1, readabilityMode: "blend", mask: { version: 1, strokes: [] } }, stage: 0, contourProgress: {}, stageReveal: "single", guide: { enabled: false, running: false, mode: "finger", tolerance: "Standard", smoothing: "Medium", direction: 1, contourId: null, progressIndex: 0, progress: 0, highestProgress: 0, visited: [], status: "Paused" } });
function traceState(layer) { layer.trace = { ...DEFAULT_TRACE, ...(layer.trace || {}), mode: TRACE_MODES.includes(layer.trace?.mode) ? layer.trace.mode : "Original", settings: { ...DEFAULT_TRACE.settings, ...(layer.trace?.settings || {}), mask: normalizeTraceMask(layer.trace?.settings?.mask) }, guide: normalizeGuideState(layer.trace?.guide) }; return layer.trace; }
function applyTraceControls(layer) {
  const trace = traceState(layer); if (traceModeInput) traceModeInput.value = trace.mode; if (traceStrengthInput) traceStrengthInput.value = trace.settings.strength; if (traceDetailInput) traceDetailInput.value = trace.settings.detail; if (tracePriorityInput) tracePriorityInput.value = trace.settings.priority; if (traceLineWeightInput) traceLineWeightInput.value = trace.settings.lineWeight; if (traceLevelsInput) traceLevelsInput.value = trace.settings.levels; if (traceIsolationInput) traceIsolationInput.checked = trace.settings.isolation; if (traceThresholdInput) traceThresholdInput.value = trace.settings.threshold; if (traceBlurInput) traceBlurInput.value = trace.settings.blur; if (traceBackgroundInput) traceBackgroundInput.value = trace.settings.background; if (traceStageInput) traceStageInput.value = trace.stage ?? 0; if (traceFocusShapeInput) traceFocusShapeInput.value = trace.settings.focusShape || "none"; if (traceOutsideOpacityInput) traceOutsideOpacityInput.value = trace.settings.outsideOpacity ?? 25; if (quickTraceOpacityInput) quickTraceOpacityInput.value = trace.settings.assistOpacity ?? 1; if (overlayEmphasisInput) overlayEmphasisInput.value = trace.settings.overlayEmphasis ?? .5; if (overlayEmphasisOutput) { const emphasis = Number(trace.settings.overlayEmphasis ?? .5); overlayEmphasisOutput.textContent = emphasis < .2 ? "Camera" : emphasis > .8 ? "Overlay" : "Balanced"; } overlayReadabilityButtons?.forEach(button => button.classList.toggle("active", button.dataset.readability === (trace.settings.readabilityMode || "blend"))); if (traceGuideEnabledInput) traceGuideEnabledInput.checked = trace.guide.enabled; if (traceGuideModeInput) traceGuideModeInput.value = trace.guide.mode; if (traceGuideToleranceInput) traceGuideToleranceInput.value = trace.guide.tolerance; if (traceGuideSmoothingInput) traceGuideSmoothingInput.value = trace.guide.smoothing; if (traceGuidePauseButton) traceGuidePauseButton.textContent = trace.guide.running ? "Pause" : "Start"; traceGuide?.setSettings(trace.guide); updateTraceOutputs(); updateFocusWindow(trace); updateTraceQuickUI(layer); updateGuidedUI(layer); if (layerTraceMode) layerTraceMode.textContent = trace.mode;
}
function updateTraceOutputs() { if (traceStrengthOutput && traceStrengthInput) traceStrengthOutput.textContent = `${Math.round(Number(traceStrengthInput.value) * 100)}%`; if (traceDetailOutput && traceDetailInput) traceDetailOutput.textContent = `${Math.round(Number(traceDetailInput.value) * 100)}%`; if (tracePriorityOutput && tracePriorityInput) tracePriorityOutput.textContent = `${Math.round(Number(tracePriorityInput.value) * 100)}%`; if (traceThresholdOutput && traceThresholdInput) traceThresholdOutput.textContent = `${Math.round(Number(traceThresholdInput.value) * 100)}%`; if (traceBlurOutput && traceBlurInput) traceBlurOutput.textContent = traceBlurInput.value; }
function updateTraceQuickUI(layer = activeLayer()) { const trace = layer ? traceState(layer) : DEFAULT_TRACE; traceModeChips?.querySelectorAll("[data-trace-mode]").forEach(button => button.classList.toggle("active", button.dataset.traceMode === trace.mode)); if (quickTraceModeButton) quickTraceModeButton.textContent = trace.mode === "Original" ? "Original" : trace.mode.replace(" Lines", ""); if (quickOriginalButton) quickOriginalButton.setAttribute("aria-pressed", String(trace.mode === "Original" || traceCompareHold)); if (quickAssistButton) quickAssistButton.setAttribute("aria-pressed", String(trace.enabled && !traceCompareHold)); }
function setTraceSheet(nextState = "closed", view = "trace") { if (!adjustSheet) return; const open = nextState !== "closed"; if (open) { releaseGhostInteraction(); releaseCompareInteraction({ restore: true }); releaseGhostBrushInteraction({ clearTrail: true }); } traceSheetState = nextState; if (open && layersExpanded) { layersExpanded = false; if (layersList) layersList.hidden = true; layerCard?.classList.remove("layers-expanded"); layersToggle?.setAttribute("aria-expanded", "false"); } adjustSheet.classList.toggle("open", open); adjustSheet.dataset.state = nextState; adjustSheet.dataset.view = view; adjustSheet.setAttribute("aria-hidden", String(!open)); document.body.classList.toggle("sheet-open", open); document.body.classList.toggle("trace-mode", open && view === "trace"); stage?.classList.toggle("adjust-open", open); if (adjustTitle) adjustTitle.textContent = view === "trace" ? "Trace Assist" : "Adjust overlay"; if (quickTraceExpandButton) quickTraceExpandButton.textContent = nextState === "expanded" ? "⌄" : "⌃"; if (open) window.setTimeout(() => closeAdjust?.focus(), 0); }
function bindSheetDrag() { if (!sheetHandle || !adjustSheet) return; let draggingSheet = false; sheetHandle.addEventListener("pointerdown", event => { if (!adjustSheet.classList.contains("open")) return; draggingSheet = true; sheetHandle.setPointerCapture?.(event.pointerId); event.preventDefault(); }); sheetHandle.addEventListener("pointerup", event => { if (!draggingSheet) return; draggingSheet = false; sheetHandle.releasePointerCapture?.(event.pointerId); const viewport = globalThis.visualViewport?.height || window.innerHeight; const ratio = Math.max(0, Math.min(1, (viewport - event.clientY) / viewport)); const next = ratio < .35 ? "peek" : ratio < .72 ? "half" : "expanded"; setTraceSheet(next, adjustSheet.dataset.view || "trace"); }); sheetHandle.addEventListener("pointercancel", () => { draggingSheet = false; }); }
function setTraceMode(mode) { const layer = activeLayer(); if (!layer || !TRACE_MODES.includes(mode)) return; if (mode !== "Original") lastAssistMode = mode; traceState(layer).mode = mode; traceState(layer).enabled = mode !== "Original"; if (traceModeInput) traceModeInput.value = mode; applyTraceControls(layer); updateTraceQuickUI(layer); if (mode !== "Original") transitionAppState("Tracing", `trace mode: ${mode}`); queueTraceRefresh(); }
function captureTraceControls(layer) { const trace = traceState(layer); trace.mode = TRACE_MODES.includes(traceModeInput?.value) ? traceModeInput.value : trace.mode; trace.enabled = trace.mode !== "Original"; trace.stage = Number(traceStageInput?.value) || 0; trace.settings = { ...trace.settings, strength: Number(traceStrengthInput?.value ?? trace.settings.strength), detail: Number(traceDetailInput?.value ?? trace.settings.detail), priority: Number(tracePriorityInput?.value ?? trace.settings.priority), lineWeight: traceLineWeightInput?.value || trace.settings.lineWeight, levels: Number(traceLevelsInput?.value ?? trace.settings.levels) || 0, isolation: Boolean(traceIsolationInput?.checked), threshold: Number(traceThresholdInput?.value ?? trace.settings.threshold), blur: Number(traceBlurInput?.value ?? trace.settings.blur), background: traceBackgroundInput?.value || trace.settings.background, focusShape: traceFocusShapeInput?.value || trace.settings.focusShape, outsideOpacity: Number(traceOutsideOpacityInput?.value ?? trace.settings.outsideOpacity) || 0, assistOpacity: Number(quickTraceOpacityInput?.value ?? trace.settings.assistOpacity) || 1, overlayEmphasis: Number(overlayEmphasisInput?.value ?? trace.settings.overlayEmphasis ?? .5), readabilityMode: trace.settings.readabilityMode || "blend", mask: normalizeTraceMask(trace.settings.mask) }; return trace; }
function updateFocusWindow(trace = traceState(activeLayer() || { trace: DEFAULT_TRACE })) { if (!traceFocusWindow) return; const shape = trace.settings.focusShape || "none"; traceFocusWindow.hidden = !workspaceImage || shape === "none"; traceFocusWindow.dataset.shape = shape; traceFocusWindow.style.setProperty("--outside-opacity", String(Math.max(0, Math.min(1, (trace.settings.outsideOpacity ?? 25) / 100)))); }
function traceSettings(layer, preview = false) { const trace = traceState(layer); return normalizeTraceSettings({ mode: trace.mode, ...trace.settings, stage: trace.stage, preview }); }
async function refreshTraceView(layer) {
  if (!layer || layer.id !== activeLayerId || document.hidden) return;
  const trace = traceState(layer); traceRequestToken += 1; const token = traceRequestToken; applyTraceControls(layer); if (!trace.enabled || trace.mode === "Original") { traceResults.delete(layer.id); overlay.src = layer.image; renderOverlay(); return; }
  try { const result = await traceEngine.process(layer.image, traceSettings(layer)); if (token !== traceRequestToken || layer.id !== activeLayerId || result.cancelled) return; const dataUrl = await resultToDataUrl(result, trace.settings.background, trace.mode); const summary = summarizeTrace(result); traceResults.set(layer.id, { dataUrl, key: result.key, quality: result.quality, summary, lines: result.lines, analysisWidth: result.width, analysisHeight: result.height }); trace.cacheKey = result.key; updateTraceGuideTarget(); if (traceQuality) { const warning = result.quality?.warnings?.[0]; traceQuality.textContent = warning ? `Quality ${summary.quality}% · ${warning}` : `Quality ${summary.quality}% · ${summary.lineCount} lines · ${Math.round(summary.coverage * 100)}% coverage`; traceQuality.dataset.state = summary.quality >= 60 ? "good" : "warning"; traceQuality.title = `${summary.contourCount} contours · ${summary.totalLength}px traced`; } overlay.src = dataUrl; renderOverlay(); if (traceRetryButton) traceRetryButton.hidden = true; if (perspectiveActive && activePerspectiveQuad) snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); } catch (error) { trace.enabled = false; trace.mode = "Original"; overlay.src = layer.image; if (traceRetryButton) traceRetryButton.hidden = false; if (traceProcessing) { traceProcessing.hidden = false; traceProcessing.textContent = "Failed · retry available"; } if (traceQuality) traceQuality.textContent = "Trace failed · Original restored · Retry available"; status.textContent = "Trace Assist could not process this image. Original restored. Retry is available."; console.error("[TraceLens trace] processing failed", error); }
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
let traceGuideContourIndex = 0;
function updateTraceGuideTarget() { const result = traceResults.get(activeLayerId); const line = result?.lines?.[traceGuideContourIndex] || result?.lines?.[0]; if (!line || !stage) { traceGuide.setContour([]); return; } const width = result.analysisWidth || stage.clientWidth; const height = result.analysisHeight || stage.clientHeight; const target = line.points.map(point => ({ x: point.x / width * stage.clientWidth, y: point.y / height * stage.clientHeight })); traceGuide.setContour(target, { id: `${activeLayerId}:${traceGuideContourIndex}`, closed: false, spacing: 5 }); }
function nextTraceGuideContour() { const count = traceResults.get(activeLayerId)?.lines?.length || 0; if (!count) { status.textContent = "Process a Trace Assist contour first."; return; } traceGuideContourIndex = (traceGuideContourIndex + 1) % count; updateTraceGuideTarget(); status.textContent = `Suggested contour ${traceGuideContourIndex + 1} of ${count}.`; }
function legacyLayer(project, name) { return createLayer({ image: project.image, name, x: project.x, y: project.y, scale: project.scale, rotation: project.rotation, opacity: project.opacity, flipped: project.flipped, blendMode: project.blendMode, guide: project.guide, physicalCalibration: project.physicalCalibration, perspective: project.perspective ? { enabled: true, locked: Boolean(project.perspectiveLocked), quad: project.perspective } : null, locked: project.locks?.position }); }
function validImageSource(source) { return typeof source === "string" && source.length > 0 && source.length <= 50 * 1024 * 1024 && /^(data:image\/[a-z0-9.+-]+;base64,|blob:|https?:\/\/)/i.test(source); }

function syncActiveLayer() {
  const layer = activeLayer();
  if (!layer) return;
  const ghost = normalizeGhostOverlay({ ...layer.ghost, enabled: compareState.enabled ? layer.visible !== false : !overlay.hidden, imageRef: layer.id, x, y, scale, rotation, opacity, locked: locks.position }, { viewportWidth: stage?.clientWidth, viewportHeight: stage?.clientHeight });
  Object.assign(layer, { x: ghost.x, y: ghost.y, scale: ghost.scale, rotation: ghost.rotation, opacity: ghost.opacity, flipped, ghost, blendMode: blendModeInput?.value || layer.blendMode, guide: guideInput?.value || layer.guide, physicalCalibration, trace: traceState(layer), perspective: perspectiveActive && activePerspectiveQuad ? { enabled: true, locked: surfaceTracker.locked, quad: activePerspectiveQuad.map(point => ({ ...point })) } : null, visible: ghost.enabled, locked: ghost.locked });
}

function loadLayerState(layer) {
  if (!layer) return;
  const ghost = normalizeGhostOverlay(layer.ghost || { ...layer, enabled: layer.visible !== false, locked: layer.locked }, { viewportWidth: stage?.clientWidth, viewportHeight: stage?.clientHeight });
  activeLayerId = layer.id; workspaceImage = layer.image; x = ghost.x; y = ghost.y; scale = ghost.scale; rotation = ghost.rotation; opacity = ghost.opacity; flipped = Boolean(layer.flipped); layer.ghost = ghost;
  if (blendModeInput) blendModeInput.value = layer.blendMode || "Normal"; if (guideInput) guideInput.value = layer.guide || "none"; guides.setMode(layer.guide || "none"); physicalCalibration = layer.physicalCalibration || null; if (opacityInput) opacityInput.value = opacity; if (scaleInput) scaleInput.value = scale; if (rotationInput) rotationInput.value = rotation; if (positionXNumber) positionXNumber.value = Math.round(x); if (positionYNumber) positionYNumber.value = Math.round(y); blendSwatches?.querySelectorAll("[data-blend]").forEach(button => button.classList.toggle("active", button.dataset.blend === (layer.blendMode || "Normal")));
  activePerspectiveQuad = layer.perspective?.quad ? layer.perspective.quad.map(point => ({ ...point })) : null; perspectiveActive = Boolean(activePerspectiveQuad?.length === 4); surfaceTracker.locked = Boolean(layer.perspective?.locked); overlay.src = layer.image; overlay.hidden = !ghost.enabled; overlay.style.visibility = "visible"; const display = resolveOverlayDisplay({ visible: ghost.enabled, perspective: perspectiveActive }); overlay.style.display = display.overlay ? "block" : "none"; if (display.perspective) snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); else snapController.clear(); if (layerThumb) layerThumb.src = workspaceImage; if (layerName) layerName.textContent = layer.name; traceGuideContourIndex = 0; applyLocks({ position: ghost.locked }); applyTraceControls(layer); updateRegionUI(layer); refreshTraceView(layer);
}

function renderLayerElement(element, layer, index) {
  const flip = layer.flipped ? -1 : 1;
  const ghost = normalizeGhostOverlay(layer.ghost || layer, { viewportWidth: stage?.clientWidth, viewportHeight: stage?.clientHeight });
  element.src = traceResults.get(layer.id)?.dataUrl || layer.image; element.hidden = !ghost.enabled; element.style.display = ghost.enabled ? "block" : "none"; element.style.opacity = ghost.opacity; element.style.transform = ghostOverlayCssTransform(ghost, { flip: layer.flipped, viewportWidth: stage?.clientWidth, viewportHeight: stage?.clientHeight }); element.style.mixBlendMode = layer.blendMode.toLowerCase(); element.style.zIndex = String(index + 1);
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
  layers = cloneLayers(Array.isArray(nextLayers) ? nextLayers : []); activeLayerId = layers.some(layer => layer.id === selectedId) ? selectedId : (layers.at(-1)?.id || null); layersExpanded = globalThis.localStorage?.getItem(LAYER_CARD_STATE_KEY) === "true"; layerCard?.classList.toggle("layers-expanded", layersExpanded); if (layersList) layersList.hidden = !layersExpanded; layersToggle?.setAttribute("aria-expanded", String(layersExpanded)); const layer = activeLayer(); if (layer) loadLayerState(layer); renderLayers(true); updateContext();
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

function ghostCompareDifferenceAvailable() { return compareDifferenceResult?.status === "complete"; }
function ghostCompareHasTrace() { return Boolean(finishedDrawingImage); }

function updateGhostCompareControls() {
  const hasReference = Boolean(workspaceImage && activeLayer()?.image);
  const hasTrace = ghostCompareHasTrace();
  const differenceAvailable = ghostCompareDifferenceAvailable();
  const modeButtons = ghostComparePanel?.querySelectorAll("[data-compare-mode]") || [];
  modeButtons.forEach(button => {
    const mode = button.dataset.compareMode;
    button.disabled = !hasReference || (mode !== "reference" && mode !== "difference" && !hasTrace) || (mode === "difference" && !differenceAvailable);
    button.classList.toggle("active", mode === compareState.mode);
    button.setAttribute("aria-pressed", String(mode === compareState.mode));
  });
  if (ghostComparePanel) ghostComparePanel.hidden = !compareState.enabled || !hasReference;
  if (ghostCompareBlendInput) { ghostCompareBlendInput.value = String(compareState.blend); ghostCompareBlendInput.disabled = !hasTrace; }
  if (ghostCompareBlendOutput) ghostCompareBlendOutput.textContent = `${Math.round(compareState.blend * 100)}%`;
  if (ghostCompareSplitInput) ghostCompareSplitInput.value = String(compareState.splitPosition);
  if (ghostCompareSplitOutput) ghostCompareSplitOutput.textContent = `${Math.round(compareState.splitPosition * 100)}%`;
  if (ghostCompareStatus) ghostCompareStatus.textContent = !hasReference ? "Add a reference to compare." : !hasTrace ? "Capture a finished drawing for Trace, Blend, or Split." : compareState.mode === "difference" && !differenceAvailable ? "Difference is unavailable until a valid raster comparison is ready." : "Inspection mode";
  if (ghostCompareSummary && differenceAvailable) ghostCompareSummary.textContent = `Raster difference aid · ${comparisonSummary(compareDifferenceResult)} · not a measurement guarantee.`;
  if (compareButton) { compareButton.classList.toggle("active", compareState.enabled); compareButton.setAttribute("aria-pressed", String(compareState.enabled)); }
  if (compareDrawingButton) compareDrawingButton.textContent = compareState.enabled ? "Close Compare" : "Compare";
}

function clearGhostCompareRender() {
  if (compareRenderSnapshot) { overlay.hidden = compareRenderSnapshot.overlayHidden; perspectiveOverlay.hidden = compareRenderSnapshot.perspectiveHidden; compareRenderSnapshot = null; }
  overlay.style.clipPath = "none"; perspectiveOverlay.style.clipPath = "none";
  overlay.classList.remove("comparison-hidden"); perspectiveOverlay.classList.remove("comparison-hidden"); comparisonOverlay.hidden = true; compareTraceOverlay.hidden = true;
  ghostCompareDivider.hidden = true; ghostCompareDivider.style.display = "none";
  compareTraceOverlay.style.clipPath = "none"; compareTraceOverlay.style.opacity = "0";
}

function renderGhostCompare() {
  const width = stage?.clientWidth || 0; const height = stage?.clientHeight || 0;
  if (!compareState.enabled || !workspaceImage || !width || !height) { clearGhostCompareRender(); updateGhostCompareControls(); return; }
  const differenceAvailable = ghostCompareDifferenceAvailable();
  const instructions = ghostCompareRenderInstructions(compareState, { width, height, differenceAvailable });
  const reference = perspectiveActive && !perspectiveOverlay.hidden ? perspectiveOverlay : overlay;
  const otherReference = reference === overlay ? perspectiveOverlay : overlay;
  const referenceReady = Boolean(reference.src || workspaceImage);
  const traceReady = ghostCompareHasTrace();
  reference.style.clipPath = instructions.referenceClipPath;
  otherReference.style.clipPath = "none";
  reference.style.opacity = String(instructions.referenceOpacity);
  reference.style.zIndex = "6";
  otherReference.classList.add("comparison-hidden");
  compareTraceOverlay.style.clipPath = instructions.traceClipPath;
  compareTraceOverlay.style.opacity = String(instructions.traceOpacity);
  compareTraceOverlay.style.zIndex = "5";
  if (traceReady && compareTraceOverlay.src !== finishedDrawingImage) compareTraceOverlay.src = finishedDrawingImage;
  reference.hidden = !instructions.referenceVisible || !referenceReady;
  otherReference.hidden = true;
  compareTraceOverlay.hidden = !instructions.traceVisible || !traceReady;
  if (instructions.differenceVisible && compareDifferenceResult?.diff) {
    comparisonOverlay.width = compareDifferenceResult.width; comparisonOverlay.height = compareDifferenceResult.height;
    const context = comparisonOverlay.getContext("2d");
    if (context) { context.clearRect(0, 0, comparisonOverlay.width, comparisonOverlay.height); context.putImageData(new ImageData(compareDifferenceResult.diff.data, compareDifferenceResult.width, compareDifferenceResult.height), 0, 0); }
    comparisonOverlay.hidden = false; comparisonOverlay.style.opacity = "1"; comparisonOverlay.style.zIndex = "7";
    reference.hidden = true; compareTraceOverlay.hidden = true;
  } else comparisonOverlay.hidden = true;
  if (instructions.mode === "split" && instructions.visible && traceReady) {
    ghostCompareDivider.hidden = false; ghostCompareDivider.style.display = instructions.splitOrientation === "horizontal" ? "block" : "block";
    if (instructions.splitOrientation === "horizontal") { ghostCompareDivider.style.width = "100%"; ghostCompareDivider.style.height = "2px"; ghostCompareDivider.style.left = "0"; ghostCompareDivider.style.top = instructions.dividerPosition; ghostCompareDivider.style.transform = "translateY(-1px)"; ghostCompareDivider.style.cursor = "ns-resize"; } else { ghostCompareDivider.style.width = "2px"; ghostCompareDivider.style.height = "100%"; ghostCompareDivider.style.left = instructions.dividerPosition; ghostCompareDivider.style.top = "0"; ghostCompareDivider.style.transform = "translateX(-1px)"; ghostCompareDivider.style.cursor = "ew-resize"; }
    ghostCompareDivider.setAttribute("aria-orientation", instructions.splitOrientation);
    ghostCompareDivider.setAttribute("aria-valuenow", String(Math.round(compareState.splitPosition * 100)));
  }
  updateGhostCompareControls();
}

async function prepareGhostDifference() {
  pendingDifferenceCount += 1;
  const token = ++compareDifferenceToken; const reference = activeLayer()?.image; const trace = finishedDrawingImage;
  compareDifferenceResult = null; compareState = normalizeGhostCompare(compareState, { differenceAvailable: false }); renderGhostCompare();
  if (!reference || !trace) { updateGhostCompareControls(); pendingDifferenceCount = Math.max(0, pendingDifferenceCount - 1); return null; }
  try {
    const result = compareImageData(await loadImageData(reference), await loadImageData(trace));
    if (token !== compareDifferenceToken || result.status !== "complete") return null;
    compareDifferenceResult = result; if (comparisonStatus) comparisonStatus.textContent = `Raster difference aid · ${comparisonSummary(result)}.`; renderGhostCompare(); return result;
  } catch (error) {
    if (token === compareDifferenceToken) { compareDifferenceResult = null; if (comparisonStatus) comparisonStatus.textContent = "Difference unavailable · the captured images could not be decoded."; updateGhostCompareControls(); }
    console.warn("[TraceLens comparison] difference preparation failed", error); return null;
  } finally {
    pendingDifferenceCount = Math.max(0, pendingDifferenceCount - 1);
  }
}

function setGhostCompareMode(mode) {
  const requested = normalizeGhostCompare({ ...compareState, mode }, { differenceAvailable: ghostCompareDifferenceAvailable() });
  if (mode === "difference" && !ghostCompareDifferenceAvailable()) { prepareGhostDifference(); if (ghostCompareStatus) ghostCompareStatus.textContent = "Preparing raster Difference…"; return; }
  const previous = compareState; compareState = { ...requested, enabled: previous.enabled }; renderGhostCompare(); if (ghostCompareChanged(previous, compareState)) pushHistory();
}

function setGhostCompareEnabled(enabled) {
  const next = Boolean(enabled) && Boolean(workspaceImage && activeLayer()?.image);
  if (!next && enabled) { status.textContent = "Add a reference image before comparing."; return; }
  releaseCompareInteraction({ restore: true });
  if (!next && compareState.enabled) clearGhostCompareRender();
  if (next && !compareState.enabled) compareRenderSnapshot = { overlayHidden: overlay.hidden, perspectiveHidden: perspectiveOverlay.hidden };
  compareState = normalizeGhostCompare({ ...compareState, enabled: next }, { differenceAvailable: ghostCompareDifferenceAvailable() });
  transitionAppState(next ? "Comparing" : (workspaceImage ? "Reviewing" : "Home"), next ? "Ghost Compare opened" : "Ghost Compare closed");
  if (next && !ghostCompareHasTrace()) compareState = { ...compareState, mode: "reference" };
  renderOverlay();
  updateGhostBrushControls();
}

function resetGhostCompare() {
  const previous = compareState; compareState = normalizeGhostCompare({ ...DEFAULT_GHOST_COMPARE, enabled: previous.enabled }, { differenceAvailable: ghostCompareDifferenceAvailable() });
  renderGhostCompare(); if (ghostCompareChanged(previous, compareState)) pushHistory();
}

function releaseCompareInteraction({ restore = false } = {}) {
  if (compareSplitPointerId !== null && ghostCompareDivider?.hasPointerCapture(compareSplitPointerId)) ghostCompareDivider.releasePointerCapture(compareSplitPointerId);
  if (restore && compareSplitBefore) compareState = { ...compareSplitBefore };
  compareSplitPointerId = null; compareSplitBefore = null; compareSplitRect = null; renderGhostCompare();
}

function updateCompareSplitFromPointer(event) {
  if (compareSplitPointerId !== event.pointerId || !compareSplitRect) return;
  const ratio = compareState.splitOrientation === "horizontal"
    ? (event.clientY - compareSplitRect.top) / compareSplitRect.height
    : (event.clientX - compareSplitRect.left) / compareSplitRect.width;
  compareState = normalizeGhostCompare({ ...compareState, splitPosition: ratio }); renderGhostCompare();
}
function finishCompareSplit(event, cancelled = false) {
  if (compareSplitPointerId !== event.pointerId) return;
  if (cancelled) releaseCompareInteraction({ restore: true });
  else { if (ghostCompareDivider.hasPointerCapture(event.pointerId)) ghostCompareDivider.releasePointerCapture(event.pointerId); const changed = ghostCompareChanged(compareSplitBefore, compareState); compareSplitPointerId = null; compareSplitRect = null; compareSplitBefore = null; if (changed) pushHistory(); renderGhostCompare(); }
}
ghostCompareDivider?.addEventListener("pointerdown", event => {
  if (!compareState.enabled || compareState.mode !== "split" || !stage?.clientWidth || !stage?.clientHeight) return;
  event.preventDefault(); event.stopPropagation(); compareSplitPointerId = event.pointerId; compareSplitBefore = { ...compareState }; compareSplitRect = stage.getBoundingClientRect(); ghostCompareDivider.setPointerCapture(event.pointerId);
});
ghostCompareDivider?.addEventListener("pointermove", updateCompareSplitFromPointer);
ghostCompareDivider?.addEventListener("pointerup", event => finishCompareSplit(event));
ghostCompareDivider?.addEventListener("pointercancel", event => finishCompareSplit(event, true));
ghostCompareDivider?.addEventListener("keydown", event => {
  if (!compareState.enabled || compareState.mode !== "split") return;
  const increment = event.shiftKey ? .05 : .01; let delta = 0;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") delta = increment;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") delta = -increment;
  if (event.key === "Home") compareState = { ...compareState, splitPosition: 0 };
  else if (event.key === "End") compareState = { ...compareState, splitPosition: 1 };
  else if (delta) compareState = normalizeGhostCompare({ ...compareState, splitPosition: compareState.splitPosition + delta });
  else return;
  event.preventDefault(); renderGhostCompare(); pushHistory();
});

function renderOverlay() {
  if (!overlay) return;
  const ghost = normalizeGhostOverlay({ ...activeLayer()?.ghost, enabled: !overlay.hidden, imageRef: workspaceImage, x, y, scale, rotation, opacity, locked: locks.position }, { viewportWidth: stage?.clientWidth, viewportHeight: stage?.clientHeight });
  x = ghost.x; y = ghost.y; scale = ghost.scale; rotation = ghost.rotation; opacity = ghost.opacity;
  const trace = activeLayer()?.trace; const emphasis = Math.max(0, Math.min(1, Number(trace?.settings?.overlayEmphasis ?? .5))); const readabilityMode = trace?.settings?.readabilityMode || "blend"; const overlayFactor = readabilityMode === "camera" ? 0 : readabilityMode === "overlay" ? 1 : emphasis; overlay.style.opacity = opacity * (trace?.enabled ? (trace.settings?.assistOpacity ?? 1) : 1) * overlayFactor; if (camera) camera.style.opacity = readabilityMode === "overlay" ? "0" : "1";
  overlay.style.transform = ghostOverlayCssTransform(ghost, { flip: flipped, viewportWidth: stage?.clientWidth, viewportHeight: stage?.clientHeight });
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
  renderLayers(); renderRegionOverlay(); renderGhostCompare(); renderGhostBrush();
}

function setFreezeCamera(enabled) {
  freezeCamera = Boolean(enabled);
  if (freezeCamera && camera?.videoWidth && freezeFrame) {
    freezeFrame.width = camera.videoWidth;
    freezeFrame.height = camera.videoHeight;
    freezeFrame.getContext("2d")?.drawImage(camera, 0, 0, freezeFrame.width, freezeFrame.height);
  }
  if (camera) camera.hidden = freezeCamera;
  if (freezeFrame) freezeFrame.hidden = !freezeCamera;
  freezeFrame?.classList.toggle("selfie-camera", camera?.classList.contains("selfie-camera"));
  freezeCameraButton?.classList.toggle("active", freezeCamera);
  freezeCameraButton?.setAttribute("aria-pressed", String(freezeCamera));
  if (freezeCameraButton) freezeCameraButton.textContent = freezeCamera ? "Unfreeze camera" : "Freeze camera";
  stage?.classList.toggle("camera-frozen", freezeCamera);
}

function captureCurrentDrawing() {
  const source = freezeCamera ? freezeFrame : camera; if (!source?.videoWidth && !source?.width) { status.textContent = "Camera is not ready for capture."; return null; }
  const canvas = document.createElement("canvas"); canvas.width = source.videoWidth || source.width; canvas.height = source.videoHeight || source.height; canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height); finishedDrawingImage = canvas.toDataURL("image/jpeg", .9); compareDifferenceResult = null; updateComparisonUI(); if (comparisonStatus) comparisonStatus.textContent = "Finished drawing captured. Ready to compare."; addTimeline("Captured", "Finished drawing"); if (compareState.enabled) prepareGhostDifference(); return finishedDrawingImage;
}

function updateComparisonUI() { if (compareDrawingButton) compareDrawingButton.disabled = !workspaceImage; if (comparisonStatus && !finishedDrawingImage) comparisonStatus.textContent = "No finished drawing captured."; updateGhostCompareControls(); }

function loadImageData(source) { return new Promise((resolve, reject) => { if (!source) return reject(new Error("Missing image source")); const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height; const context = canvas.getContext("2d"); if (!context) return reject(new Error("Canvas processing is unavailable")); context.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(context.getImageData(0, 0, canvas.width, canvas.height)); }; image.onerror = () => reject(new Error("Could not decode comparison image")); image.src = source; }); }

async function compareFinishedDrawing() {
  if (!finishedDrawingImage || !activeLayer()?.image) { status.textContent = "Capture a finished drawing before comparing."; return; }
  setGhostCompareEnabled(true); const result = await prepareGhostDifference(); if (result) setGhostCompareMode("difference"); else setGhostCompareMode("split");
}

function clearFinishedComparison() { setGhostCompareEnabled(false); }

function captureState() { return { x, y, scale, rotation, opacity, flipped, freezeCamera, blendMode: blendModeInput?.value || "Normal", guide: guideInput?.value || "none", physicalCalibration, compare: { ...compareState }, ghostBrush: { ...ghostBrushState } }; }
function captureLayers() { syncActiveLayer(); return cloneLayers(layers); }
function applyState(next) {
  if (!next) return;
  const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  x = safeNumber(next.x, 0); y = safeNumber(next.y, 0); scale = Math.max(.25, Math.min(3, Math.abs(safeNumber(next.scale, 1)))); rotation = Math.max(-180, Math.min(180, safeNumber(next.rotation, 0))); opacity = Math.max(.05, Math.min(1, safeNumber(next.opacity, .55))); flipped = Boolean(next.flipped); setFreezeCamera(Boolean(next.freezeCamera));
  if (blendModeInput) blendModeInput.value = next.blendMode || "Normal"; if (guideInput) guideInput.value = next.guide || "none"; guides.setMode(next.guide || "none");
  physicalCalibration = next.physicalCalibration || null;
  compareState = normalizeGhostCompare(next.compare || DEFAULT_GHOST_COMPARE, { differenceAvailable: ghostCompareDifferenceAvailable() });
  ghostBrushState = normalizeGhostBrush(next.ghostBrush || DEFAULT_GHOST_BRUSH); ghostBrushPointer = null; ghostBrushPointerActive = false; ghostBrushPointerId = null; ghostBrushTrail = [];
  if (opacityInput) opacityInput.value = opacity; if (scaleInput) scaleInput.value = scale; if (rotationInput) rotationInput.value = rotation; renderOverlay(); renderLayerList();
}
function historySourceId(image) { if (!image) return null; if (!historySourceIds.has(image)) { const id = `source-${historySourceIds.size + 1}`; historySourceIds.set(image, id); historySources.set(id, image); } return historySourceIds.get(image); }
function workspaceState() { syncActiveLayer(); return { layers: layers.map(layer => { const { image, thumbnail, ...state } = layer; return { ...state, sourceId: historySourceId(image) }; }), activeLayerId, locks: { ...locks }, ...captureState() }; }
function pushHistory() { if (workspaceImage && !historyRestoring) history.push(workspaceState()); }
function restoreWorkspaceState(next) { if (!next) return; historyRestoring = true; try { if (Array.isArray(next.layers) && next.layers.length) { const restored = next.layers.map(layer => ({ ...layer, image: layer.image || historySources.get(layer.sourceId) })).filter(layer => layer.image); setLayers(restored, next.activeLayerId); } applyState(next); applyLocks(next.locks || activeLayer()?.locks || {}); updateContext(); } finally { historyRestoring = false; } }
function addTimeline(type, detail = "") { timeline.add(type, detail); recordSession(type, { detail }); const latest = timeline.latest(); if (timelineOutput) timelineOutput.textContent = latest ? `${latest.type}${latest.detail ? ` · ${latest.detail}` : ""}` : "Session ready."; }
function applyLocks(saved = {}) { Object.keys(locks).forEach(key => { if (typeof locks[key] === "boolean") locks[key] = Boolean(saved[key]); const input = document.querySelector(`[data-lock="${key}"]`); if (input) input.checked = locks[key]; }); stage?.classList.toggle("locked", locks.position); if (layerLock) { layerLock.textContent = locks.position ? "♙" : "♧"; layerLock.setAttribute("aria-label", locks.position ? "Unlock Ghost Overlay adjustment" : "Lock Ghost Overlay adjustment"); } }
function applyProject(project) {
  const projectLayers = Array.isArray(project?.layers) ? project.layers.filter(layer => validImageSource(layer?.image)) : [];
  const projectImage = validImageSource(project?.image) ? project.image : projectLayers[0]?.image;
  if (!projectImage) { status.textContent = "That project has no usable reference image."; return false; }
  projectOperationToken += 1; imageImportToken += 1; if (pendingImageReader) { try { pendingImageReader.abort(); } catch {} pendingImageReader = null; }
  releaseGhostInteraction(); releaseCompareInteraction({ restore: true }); releaseGhostBrushInteraction({ clearTrail: true }); compareDifferenceToken += 1; compareDifferenceResult = null; ghostBrushPointer = null; ghostBrushPointerActive = false; ghostBrushPointerId = null; ghostBrushTrail = [];
  traceQueue?.cancel(); traceEngine.cancel(); traceEngine.clearSources(); traceResults.clear(); history.clear(); historySources.clear(); historySourceIds.clear();
  currentProjectId = project.id || null; finishedDrawingImage = project.finishedDrawingImage || null; sessionReplay = createSessionState(project.session); updateComparisonUI(); projectNameInput.value = project.name || "Untitled project"; emptyState.style.display = "none"; layerCard.hidden = false; selectionFrame.classList.add("visible"); showOverlayTools();
  const restoredLayers = projectLayers.length ? projectLayers : [legacyLayer({ ...project, image: projectImage }, project.name || "Reference image")];
  setLayers(restoredLayers, project.activeLayerId || restoredLayers.at(-1).id);
  if (project.preset) { presetInput.value = project.preset; applyPreset(project.preset, false); } applyState(project); applyLocks(project.locks); updateContext(); pushHistory(); surfaceTracker.start(camera); queueVisibleTraceLayers(); return true;
}
let projectSearchToken = 0;
async function refreshProjectList() { const request = ++projectSearchToken; try { let projects = await projectLibrary.all(); if (request !== projectSearchToken) return; const query = projectSearchInput.value.trim().toLowerCase(); if (query) projects = projects.filter(project => (project.name || "").toLowerCase().includes(query) || (project.preset || "").toLowerCase().includes(query)); const sort = projectSortInput.value; projects.sort((a, b) => sort === "name" ? (a.name || "").localeCompare(b.name || "") : sort === "created" ? b.createdAt - a.createdAt : sort === "favorite" ? Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt : b.updatedAt - a.updatedAt); projectList.replaceChildren(new Option(projects.length ? "Projects" : "No projects yet", ""), ...projects.map(project => new Option(`${project.favorite ? "★ " : ""}${project.name || "Untitled project"} · ${new Date(project.updatedAt || Date.now()).toLocaleDateString()}`, project.id))); } catch (error) { if (request !== projectSearchToken) return; console.error("[TraceLens projects] list failed", error); status.textContent = "Project storage is unavailable. Try again."; } }
const debouncedProjectSearch = createDebouncedTask(() => refreshProjectList(), 140);
function applyPreset(name, announce = true) { const preset = getWorkflowPreset(name); presetInput.value = name; opacity = preset.opacity; opacityInput.value = opacity; blendModeInput.value = preset.blendMode; guideInput.value = preset.guide; guides.setMode(preset.guide); grid.style.backgroundSize = `${100 / preset.gridSpacing}% ${100 / preset.gridSpacing}%`; surfaceTracker.state.retainAt = preset.tracking.weakAt; surfaceTracker.state.acquireAt = Math.max(72, preset.tracking.weakAt + 12); surfaceTracker.state.lostAt = preset.tracking.lostAt; if (presetDescription) presetDescription.textContent = preset.description || "Choose a workspace to tune alignment defaults."; renderOverlay(); updatePresetChips(); if (announce) { status.textContent = `${name} workspace active.`; addTimeline("Preset", name); } }
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
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ image: workspaceImage, layers: captureLayers(), activeLayerId, session: sessionReplay, ...captureState() }));
    workspaceButton.classList.add("saved");
    status.textContent = "Workspace saved on this device.";
    window.setTimeout(() => workspaceButton.classList.remove("saved"), 900);
  } catch (error) {
    status.textContent = "This browser could not save the workspace. Export the project instead.";
    console.warn("[TraceLens workspace] save failed", error);
  }
}

async function saveProject() {
  if (!workspaceImage) { status.textContent = "Import an image before saving a project."; return false; }
  const operation = ++projectOperationToken;
  pendingSaveCount += 1;
  recordBetaEvent("save-start", { generation: operation });
  transitionAppState("Saving", "project save");
  const name = projectNameInput.value.trim() || "Untitled project";
  currentProjectId ||= globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`;
  const projectId = currentProjectId; const savedLayers = captureLayers();
  try {
    await Promise.all(savedLayers.map(async layer => { if (!layer.thumbnail) layer.thumbnail = await projectLibrary.thumbnail(layer.image); }));
    const thumbnail = await projectLibrary.thumbnail(workspaceImage);
    if (operation !== projectOperationToken || currentProjectId !== projectId || !workspaceImage) return false;
    await projectLibrary.put({ id: projectId, name, image: workspaceImage, layers: savedLayers, activeLayerId, finishedDrawingImage, session: sessionReplay, preset: presetInput.value, perspective: surfaceTracker.locked ? activePerspectiveQuad : null, perspectiveLocked: surfaceTracker.locked, ...captureState(), locks: { ...locks }, updatedAt: Date.now(), thumbnail });
    if (operation !== projectOperationToken) return false;
    lastPersistenceResult = "success";
    recordBetaEvent("save-success", { generation: operation });
    await refreshProjectList(); addTimeline("Saved", name);
    status.textContent = `Project “${name}” saved.`;
    transitionAppState(workspaceImage ? "Tracing" : "Home", "project saved");
    return true;
  } catch (error) {
    if (operation === projectOperationToken) { lastPersistenceResult = "failure"; recordBetaEvent("save-failure", { generation: operation, reason: "storage" }); betaDiagnostics.error("Project save failed", { source: "storage" }); status.textContent = "Project could not be saved. Export the project instead."; transitionAppState(workspaceImage ? "Tracing" : "Home", "project save failed"); }
    throw error;
  } finally {
    pendingSaveCount = Math.max(0, pendingSaveCount - 1);
  }
}

async function restoreLatestProject() {
  if (workspaceImage) return;
  try { const projects = await projectLibrary.all(); const project = projects[0]; if (!project) return; applyProject(project); status.textContent = `Project “${project.name}” restored.`; } catch (error) { console.warn("Could not restore project library", error); }
}

function restoreWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY));
    const savedLayers = Array.isArray(saved.layers) ? saved.layers.filter(layer => validImageSource(layer?.image)) : [];
    const savedImage = validImageSource(saved?.image) ? saved.image : savedLayers[0]?.image;
    if (!savedImage) return;
    projectOperationToken += 1; imageImportToken += 1; if (pendingImageReader) { try { pendingImageReader.abort(); } catch {} pendingImageReader = null; }
    traceQueue?.cancel(); traceEngine.cancel(); traceEngine.clearSources(); traceResults.clear(); history.clear(); historySources.clear(); historySourceIds.clear();
    const restoredLayers = savedLayers.length ? savedLayers : [legacyLayer({ ...saved, image: savedImage }, "Saved workspace")];
    currentProjectId = null; sessionReplay = createSessionState(saved.session); emptyState.style.display = "none"; layerCard.hidden = false; selectionFrame.classList.add("visible"); showOverlayTools(); setLayers(restoredLayers, saved.activeLayerId || restoredLayers.at(-1).id);
    applyState(saved); status.textContent = "Saved workspace restored.";
    addTimeline("Restored", "Workspace");
    pushHistory();
    if (workspaceImage) { surfaceTracker.start(camera); queueVisibleTraceLayers(); }
  } catch (error) { console.warn("Could not restore workspace", error); }
}

async function startCamera() {
  const request = ++cameraRequestToken;
  cameraRequestPending = true;
  recordBetaEvent("camera-request", { generation: request, facingMode: cameraFacing });
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported.");
    if (stream) stream.getTracks().forEach(track => track.stop());
    surfaceTracker.stop(); traceHandTracker.stop(); stream = null; camera.srcObject = null;
    const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraFacing } }, audio: false });
    if (request !== cameraRequestToken) { nextStream.getTracks().forEach(track => track.stop()); recordBetaEvent("stale-camera-rejection", { generation: request }); return null; }
    stream = nextStream; camera.srcObject = stream; cameraState.textContent = "CAMERA STARTING";
    await waitForVideoMetadata(camera);
    if (request !== cameraRequestToken) { nextStream.getTracks().forEach(track => track.stop()); recordBetaEvent("stale-camera-rejection", { generation: request }); return null; }
    stream.getTracks().forEach(track => track.addEventListener("ended", () => {
      if (request === cameraRequestToken && camera.srcObject === stream) { cameraState.textContent = "CAMERA STOPPED"; status.textContent = "Camera stopped. Tap restart to try again."; }
    }));
    camera.classList.toggle("selfie-camera", cameraFacing === "user");
    cameraState.textContent = "CAMERA ACTIVE";
    recordBetaEvent("camera-success", { generation: request, facingMode: cameraFacing, videoWidth: camera.videoWidth || 0, videoHeight: camera.videoHeight || 0 });
    status.textContent = "Camera active.";
    if (freezeCamera) setFreezeCamera(true);
    if (workspaceImage) surfaceTracker.start(camera);
    return stream;
  } catch (error) {
    if (request !== cameraRequestToken) return null;
    cameraState.textContent = "CAMERA UNAVAILABLE";
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    const classified = classifyCameraError(error); recordBetaEvent("camera-rejection", { code: classified.code }); betaDiagnostics.error(classified.message, { source: "camera", code: classified.code }); status.textContent = classified.message; console.error("[TraceLens camera]", classified.code, error); throw Object.assign(error instanceof Error ? error : new Error(classified.message), { cameraCode: classified.code });
  } finally {
    if (request === cameraRequestToken) cameraRequestPending = false;
  }
}

function stopCamera({ clearVideo = true } = {}) {
  cameraRequestToken += 1;
  cameraRequestPending = false;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  surfaceTracker.stop();
  traceHandTracker.stop();
  if (clearVideo && camera) camera.srcObject = null;
  if (cameraState) cameraState.textContent = "CAMERA PAUSED";
  recordBetaEvent("stream-stop", { clearVideo });
}

function loadImage(file) {
  if (!file) return;
  recordBetaEvent("image-import-start", { size: Number(file.size) || 0, type: file.type || "unknown" });
  const importRequest = ++imageImportToken;
  projectOperationToken += 1;
  if (pendingImageReader) { try { pendingImageReader.abort(); } catch {} pendingImageReader = null; }
  if (!isSupportedImageFile(file)) { status.textContent = "Choose a supported image file."; return; }
  if (file.size > 25 * 1024 * 1024) { status.textContent = "That image is larger than 25 MB. Choose a smaller file."; return; }
  releaseGhostInteraction(); releaseCompareInteraction({ restore: true }); releaseGhostBrushInteraction({ clearTrail: true }); compareDifferenceToken += 1; compareDifferenceResult = null; compareState = normalizeGhostCompare({ ...compareState, enabled: false });
  transitionAppState("Importing", "image selected");
  const reader = new FileReader(); pendingImageReader = reader;
  reader.onload = () => {
    if (importRequest !== imageImportToken) { recordBetaEvent("stale-import-rejection", { generation: importRequest }); return; }
    pendingImageReader = null;
    transitionAppState("PreparingImage", "image decoded");
    snapController.clear();
    perspectiveActive = false;
    surfaceTracker.unlock(); surfaceTracker.cancelScan(); perspectiveSession.cancel(); autoPerspectiveScanning = false; autoPerspectiveButton?.classList.remove("active");
    syncActiveLayer();
    const newLayer = createLayer({ image: reader.result, name: imageDisplayName(file.name) });
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
    sessionReplay = startSession(sessionReplay); addTimeline("Imported", file.name); gestureCoach.show();
    status.textContent = "Overlay loaded. Drag, pinch, or rotate to position it.";
    recordBetaEvent("image-import-success", { size: Number(file.size) || 0 });
    updateContext();
    surfaceTracker.start(camera);
    transitionAppState("Positioning", "reference ready");
  };
  reader.onerror = () => { if (importRequest !== imageImportToken) return; pendingImageReader = null; recordBetaEvent("image-import-failure", { reason: "read-failed" }); betaDiagnostics.error("Could not read image", { source: "image-import" }); transitionAppState("Error", "image read failed"); status.textContent = "Could not read that image. Try another file."; console.error("[TraceLens import] FileReader failed", reader.error); };
  try {
    reader.readAsDataURL(file);
  } catch (error) {
    if (importRequest !== imageImportToken) return;
    pendingImageReader = null;
    recordBetaEvent("image-import-failure", { reason: "read-start-failed" });
    betaDiagnostics.error("Could not start image read", { source: "image-import" });
    transitionAppState("Error", "image read could not start");
    status.textContent = "Could not read that image. Try another file.";
  }
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
freezeCameraButton?.addEventListener("click", () => { setFreezeCamera(!freezeCamera); pushHistory(); status.textContent = freezeCamera ? "Camera frame frozen." : "Live camera restored."; });
captureDrawingButton?.addEventListener("click", () => captureCurrentDrawing());
compareDrawingButton?.addEventListener("click", () => { if (compareState.enabled) clearFinishedComparison(); else compareFinishedDrawing(); });
compareButton?.addEventListener("click", () => setGhostCompareEnabled(!compareState.enabled));
ghostCompareExitButton?.addEventListener("click", () => setGhostCompareEnabled(false));
ghostCompareResetButton?.addEventListener("click", resetGhostCompare);
ghostComparePanel?.addEventListener("click", event => { const button = event.target.closest("[data-compare-mode]"); if (button && !button.disabled) setGhostCompareMode(button.dataset.compareMode); });
ghostCompareBlendInput?.addEventListener("input", event => { compareState = normalizeGhostCompare({ ...compareState, blend: event.target.value }); renderGhostCompare(); });
ghostCompareBlendInput?.addEventListener("change", () => pushHistory());
ghostCompareSplitInput?.addEventListener("input", event => { compareState = normalizeGhostCompare({ ...compareState, splitPosition: event.target.value }); renderGhostCompare(); });
ghostCompareSplitInput?.addEventListener("change", () => pushHistory());
ghostBrushToggleButton?.addEventListener("click", () => setGhostBrushState({ ...ghostBrushState, enabled: !ghostBrushState.enabled }, { commit: true }));
ghostBrushResetButton?.addEventListener("click", resetGhostBrush);
ghostBrushModeInput?.addEventListener("change", event => setGhostBrushState({ ...ghostBrushState, mode: event.target.value }, { commit: true }));
const ghostBrushSliderMap = [[ghostBrushRadiusInput, "radius"], [ghostBrushFeatherInput, "feather"], [ghostBrushOutsideInput, "outsideOpacity"], [ghostBrushEdgeInput, "edgeStrength"], [ghostBrushTrailInputRange, "trailLength"]];
ghostBrushSliderMap.forEach(([input, key]) => { input?.addEventListener("input", event => setGhostBrushState({ ...ghostBrushState, [key]: event.target.value })); input?.addEventListener("change", () => pushHistory()); });
ghostBrushTrailInput?.addEventListener("change", event => setGhostBrushState({ ...ghostBrushState, trailEnabled: event.target.checked }, { commit: true }));
ghostBrushEndpointInput?.addEventListener("change", event => setGhostBrushState({ ...ghostBrushState, followEndpoint: event.target.checked }, { commit: true }));
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
loadProjectButton?.addEventListener("click", async () => { pendingProjectLoadCount += 1; try { const project = await projectLibrary.get(projectList.value); if (project) { applyProject(project); addTimeline("Loaded", project.name || "Project"); status.textContent = `Project “${project.name || "Project"}” loaded.`; } } catch (error) { status.textContent = "That project could not be loaded. It may be corrupted."; console.error("[TraceLens projects] load failed", error); } finally { pendingProjectLoadCount = Math.max(0, pendingProjectLoadCount - 1); } });
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
traceGuideEnabledInput?.addEventListener("change", async event => { const layer = activeLayer(); if (!layer) { event.target.checked = false; return; } layer.trace.guide.enabled = event.target.checked; if (event.target.checked) { const started = await traceGuide.enable(); if (!started) { event.target.checked = false; layer.trace.guide.enabled = false; traceGuide.disable(); } else { traceGuide.resume(); } } else traceGuide.disable(); pushHistory(); });
traceGuidePauseButton?.addEventListener("click", () => { if (traceGuide.state.running) traceGuide.pause(); else traceGuide.resume(); const layer = activeLayer(); if (layer) layer.trace.guide = normalizeGuideState(traceGuide.state); pushHistory(); });
traceGuideNextButton?.addEventListener("click", nextTraceGuideContour);
[traceGuideModeInput, traceGuideToleranceInput, traceGuideSmoothingInput].forEach(input => input?.addEventListener("change", () => { const layer = activeLayer(); if (!layer) return; traceGuide.setSettings({ mode: traceGuideModeInput?.value, tolerance: traceGuideToleranceInput?.value, smoothing: traceGuideSmoothingInput?.value }); layer.trace.guide = normalizeGuideState(traceGuide.state); pushHistory(); }));
diagnosticsInput?.addEventListener("change", event => { diagnosticsOutput.hidden = !event.target.checked; recordBetaEvent("diagnostics-toggled", { enabled: event.target.checked }); updateContext(); });
document.querySelectorAll("[data-lock]").forEach(input => input.addEventListener("change", event => { locks.toggle(event.target.dataset.lock); status.textContent = `${event.target.dataset.lock} ${event.target.checked ? "locked" : "unlocked"}.`; pushHistory(); }));
autoOpacityInput?.addEventListener("change", event => { adaptiveOpacity.setEnabled(event.target.checked); if (event.target.checked) status.textContent = "Auto Opacity active."; });
autoPerspectiveButton?.addEventListener("click", () => {
  if (perspectiveActive && surfaceTracker.locked) { snapController.clear(); perspectiveActive = false; activePerspectiveQuad = null; surfaceTracker.unlock(); perspectiveSession.unlock(); autoPerspectiveScanning = false; autoPerspectiveButton.classList.remove("active"); restoreLayerVisibility(); selectionFrame.style.clipPath = "none"; pushHistory(); status.textContent = "Manual mode."; visionStatus.textContent = "Manual mode"; updateContext(); return; }
  if (autoPerspectiveScanning) { surfaceTracker.cancelScan(); perspectiveSession.cancel(); autoPerspectiveScanning = false; autoPerspectiveButton.classList.remove("active"); visionStatus.textContent = "Manual mode"; status.textContent = "Surface scan cancelled."; updateContext(); return; }
  autoPerspectiveScanning = true; surfaceTracker.beginScan(); perspectiveSession.beginScan(); surfaceTracker.start(camera); transitionAppState("ScanningSurface", "automatic surface scan"); autoPerspectiveButton.classList.add("active"); visionStatus.textContent = "Scanning surface…"; status.textContent = "Scanning surface. Hold steady."; updateContext();
});
manualPerspectiveButton?.addEventListener("click", () => { surfaceTracker.unlock(); surfaceTracker.cancelScan(); perspectiveSession.cancel(); autoPerspectiveScanning = false; activePerspectiveQuad = [{ x: .08, y: .08 }, { x: .92, y: .08 }, { x: .92, y: .92 }, { x: .08, y: .92 }]; perspectiveActive = true; transitionAppState("Calibrating", "manual four-corner calibration"); autoPerspectiveButton.classList.remove("active"); overlay.style.display = "none"; snapController.snap(activeRenderSource(), perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; syncActiveLayer(); pushHistory(); status.textContent = "Manual mode · adjust corners."; visionStatus.textContent = "Manual mode"; updateContext(); });
layerVisibility?.addEventListener("click", () => { overlay.hidden = !overlay.hidden; const layer = activeLayer(); if (layer) layer.visible = !overlay.hidden; restoreLayerVisibility(layer); layerVisibility.textContent = overlay.hidden ? "⊘" : "◉"; layerVisibility.setAttribute("aria-label", overlay.hidden ? "Enable Ghost Overlay" : "Disable Ghost Overlay"); pushHistory(); });
layerLock?.addEventListener("click", () => { locks.toggle("position"); const layer = activeLayer(); if (layer) layer.locked = locks.position; stage.classList.toggle("locked", locks.position); layerLock.textContent = locks.position ? "♙" : "♧"; layerLock.setAttribute("aria-label", locks.position ? "Unlock Ghost Overlay adjustment" : "Lock Ghost Overlay adjustment"); pushHistory(); });
layerAdd?.addEventListener("click", () => dockImageInput?.click());
quickTraceModeButton?.addEventListener("click", () => setTraceSheet("peek", "trace"));
quickTraceExpandButton?.addEventListener("click", () => setTraceSheet(traceSheetState === "expanded" ? "peek" : "expanded", "trace"));
quickAssistButton?.addEventListener("click", () => setTraceMode(activeLayer()?.trace?.mode !== "Original" ? activeLayer().trace.mode : lastAssistMode));
quickOriginalButton?.addEventListener("pointerdown", event => { event.preventDefault(); quickOriginalDownAt = performance.now(); traceCompareHold = true; const layer = activeLayer(); if (layer) { overlay.src = layer.image; updateTraceQuickUI(layer); } });
quickOriginalButton?.addEventListener("pointerup", () => { const held = performance.now() - quickOriginalDownAt >= 350; traceCompareHold = false; const layer = activeLayer(); if (layer) refreshTraceView(layer); if (held) ignoreQuickOriginalClick = true; });
quickOriginalButton?.addEventListener("pointercancel", () => { traceCompareHold = false; const layer = activeLayer(); if (layer) refreshTraceView(layer); ignoreQuickOriginalClick = true; });
quickOriginalButton?.addEventListener("click", () => { if (ignoreQuickOriginalClick) { ignoreQuickOriginalClick = false; return; } setTraceMode("Original"); });
layersToggle?.addEventListener("click", () => { layersExpanded = !layersExpanded; globalThis.localStorage?.setItem(LAYER_CARD_STATE_KEY, String(layersExpanded)); if (layersExpanded && adjustSheet.classList.contains("open")) setTraceSheet("closed"); layersList.hidden = !layersExpanded; layerCard.classList.toggle("layers-expanded", layersExpanded); layersToggle.setAttribute("aria-expanded", String(layersExpanded)); layersToggle.lastChild.textContent = layersExpanded ? "⌄" : "⌃"; });
layersList?.addEventListener("click", event => {
  const row = event.target.closest("[data-layer-id]"); if (!row) return;
  const id = row.dataset.layerId; const layer = layers.find(item => item.id === id); if (!layer) return;
  const action = event.target.closest(".layer-row-action")?.className || "";
  if (action.includes("visibility")) { layer.visible = layer.visible === false; if (id === activeLayerId) { overlay.hidden = !layer.visible; overlay.style.display = layer.visible ? "block" : "none"; } renderLayers(true); return; }
  if (action.includes("lock")) { layer.locked = !layer.locked; if (id === activeLayerId) applyLocks({ position: layer.locked }); renderLayers(true); return; }
  if (action.includes("duplicate")) { syncActiveLayer(); const copy = duplicateLayer(layer); layers.splice(layers.indexOf(layer) + 1, 0, copy); setLayers(layers, copy.id); pushHistory(); status.textContent = `${copy.name} duplicated.`; return; }
  if (action.includes("delete")) { if (layers.length === 1) { status.textContent = "Keep at least one reference layer."; return; } if (!window.confirm(`Delete layer “${layer.name}”?`)) return; traceQueue?.cancel(); traceResults.delete(layer.id); traceEngine.clearLayerCache(layer.image); const index = layers.indexOf(layer); layers.splice(index, 1); setLayers(layers, layers[Math.max(0, index - 1)]?.id || layers[0].id); queueVisibleTraceLayers(); pushHistory(); status.textContent = `${layer.name} deleted.`; return; }
  if (action.includes("up") || action.includes("down")) { const index = layers.indexOf(layer); const nextIndex = action.includes("up") ? Math.min(layers.length - 1, index + 1) : Math.max(0, index - 1); if (index !== nextIndex) [layers[index], layers[nextIndex]] = [layers[nextIndex], layers[index]]; renderLayers(true); pushHistory(); return; }
  if (event.target.closest(".layer-row-main")) { syncActiveLayer(); releaseCompareInteraction({ restore: true }); compareDifferenceToken += 1; compareDifferenceResult = null; surfaceTracker.unlock(); perspectiveSession.cancel(); perspectiveActive = false; activePerspectiveQuad = null; layersExpanded = false; layersList.hidden = true; layerCard.classList.remove("layers-expanded"); layersToggle.setAttribute("aria-expanded", "false"); loadLayerState(layer); renderOverlay(); selectionFrame.classList.add("visible"); pushHistory(); status.textContent = `${layer.name} selected.`; }
});
resetButton?.addEventListener("click", () => { x = 0; y = 0; scale = 1; rotation = 0; opacity = 0.55; flipped = false; opacityInput.value = opacity; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); flipButton?.classList.remove("active"); status.textContent = "Overlay position reset."; });

function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function angle(a, b) { return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180 / Math.PI; }
function releaseGhostInteraction({ restore = false } = {}) {
  window.clearTimeout(longPressTimer);
  for (const [pointerId] of pointers) if (stage?.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
  pointers.clear(); gestureStart = null; dragging = false; perspectiveDragIndex = null;
  if (restore && ghostGestureStart) { ({ x, y, scale, rotation } = ghostGestureStart); renderOverlay(); }
  ghostGestureStart = null;
}
stage?.addEventListener("pointerdown", event => {
  if (!overlay.src) return;
  if (!stage.clientWidth || !stage.clientHeight) return;
  if (ghostBrushPointerId === null && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) { ghostBrushPointerId = event.pointerId; ghostBrushPointerRect = stage.getBoundingClientRect(); updateGhostBrushPointer(event); }
  if (locks.position && locks.rotation && locks.scale && locks.perspective) return;
  wakeHUD(); gestureCoach.dismiss();
  const now = performance.now();
  if (now - lastTapAt < 320) { x = 0; y = 0; renderOverlay(); status.textContent = "Overlay centered."; }
  lastTapAt = now;
  window.clearTimeout(longPressTimer); longPressTimer = window.setTimeout(() => { locks.toggle("position"); stage.classList.toggle("locked", locks.position); layerLock.textContent = locks.position ? "♙" : "♧"; status.textContent = locks.position ? "Overlay locked." : "Overlay unlocked."; }, 650);
  const handle = event.target.closest?.(".selection-frame i");
  if (perspectiveActive && handle && locks.canEdit("perspective")) { perspectiveDragIndex = [...selectionFrame.querySelectorAll("i")].indexOf(handle); stage.setPointerCapture(event.pointerId); return; }
  if (!locks.canEdit("position")) return;
  if (perspectiveActive && locks.canEdit("perspective")) { snapController.clear(); perspectiveActive = false; surfaceTracker.unlock(); perspectiveSession.cancel(); overlay.style.display = "block"; autoPerspectiveButton.classList.remove("active"); selectionFrame.classList.remove("surface-found"); selectionFrame.style.clipPath = "none"; status.textContent = "Manual alignment resumed."; updateContext(); }
  if (pointers.size === 0) ghostGestureStart = { x, y, scale, rotation };
  pointers.set(event.pointerId, event); stage.setPointerCapture(event.pointerId); event.preventDefault();
  if (pointers.size === 1) { dragging = true; pointerStartX = event.clientX; pointerStartY = event.clientY; originX = x; originY = y; }
  if (pointers.size === 2) { dragging = false; const [a, b] = [...pointers.values()]; gestureStart = { distance: distance(a,b), angle: angle(a,b), scale, rotation }; }
});
stage?.addEventListener("pointermove", event => {
  if (perspectiveActive && perspectiveDragIndex !== null && activePerspectiveQuad) { if (!stage.clientWidth || !stage.clientHeight) return; activePerspectiveQuad[perspectiveDragIndex] = { x: Math.max(0, Math.min(1, event.offsetX / stage.clientWidth)), y: Math.max(0, Math.min(1, event.offsetY / stage.clientHeight)) }; const pixels = perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight); snapController.snap(activeRenderSource(), pixels, stage.clientWidth, stage.clientHeight, opacity); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; return; }
  if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, event);
  if (pointers.size === 2 && gestureStart) { const [a,b] = [...pointers.values()]; if (locks.canEdit("scale")) scale = Math.max(.25, Math.min(3, gestureStart.scale * distance(a,b) / gestureStart.distance)); if (locks.canEdit("rotation")) { const rawRotation = gestureStart.rotation + angle(a,b) - gestureStart.angle; rotation = Math.round(rawRotation / 15) * 15; } scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); return; }
  if (dragging) { x = originX + event.clientX - pointerStartX; y = originY + event.clientY - pointerStartY; renderOverlay(); }
});
stage?.addEventListener("pointermove", event => { if (ghostBrushPointerId === event.pointerId) updateGhostBrushPointer(event); });
stage?.addEventListener("pointerup", event => { if (ghostBrushPointerId === event.pointerId) releaseGhostBrushInteraction(); });
stage?.addEventListener("pointercancel", event => { recordBetaEvent("pointer-cancellation", { owner: "stage" }); if (ghostBrushPointerId === event.pointerId) releaseGhostBrushInteraction({ clearTrail: true }); });
stage?.addEventListener("lostpointercapture", event => { recordBetaEvent("lost-pointer-capture", { owner: "stage" }); if (ghostBrushPointerId === event.pointerId) releaseGhostBrushInteraction({ clearTrail: true }); });
function endPointer(event, cancelled = false) { const wasPerspective = perspectiveDragIndex !== null; perspectiveDragIndex = null; pointers.delete(event.pointerId); if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (wasPerspective) syncActiveLayer(); if (cancelled) { releaseGhostInteraction({ restore: true }); return; } if (pointers.size < 2) { gestureStart = null; pushHistory(); ghostGestureStart = null; } dragging = pointers.size === 1; }
stage?.addEventListener("pointerup", event => endPointer(event)); stage?.addEventListener("pointercancel", event => endPointer(event, true));
stage?.addEventListener("pointerup", () => window.clearTimeout(longPressTimer));
stage?.addEventListener("pointercancel", () => releaseGhostInteraction({ restore: true }));
window.addEventListener("blur", () => { releaseGhostInteraction({ restore: true }); releaseCompareInteraction({ restore: true }); releaseGhostBrushInteraction({ clearTrail: true }); });
}
document.addEventListener("visibilitychange", () => {
  recordBetaEvent("visibility-change", { state: document.visibilityState });
  if (document.hidden) {
    stopVisionLoop();
    releaseGhostInteraction({ restore: true });
    releaseCompareInteraction({ restore: true });
    releaseGhostBrushInteraction({ clearTrail: true });
    traceEngine.cancel();
    traceGuide.pause();
    stopCamera();
    if (sessionReplay.status === "recording") sessionReplay = pauseSession(sessionReplay);
    updateSessionUI();
  } else if (workspaceImage) {
    startVisionLoop();
    startCamera().catch(error => console.warn("[TraceLens camera] resume failed", error));
    if (sessionReplay.status === "paused") sessionReplay = resumeSession(sessionReplay);
    updateSessionUI();
  }
});
window.addEventListener("pagehide", () => { stopVisionLoop(); releaseGhostInteraction({ restore: true }); releaseCompareInteraction({ restore: true }); releaseGhostBrushInteraction({ clearTrail: true }); stopCamera(); });
window.addEventListener("keydown", event => { if (event.key === "Escape" && adjustSheet.classList.contains("open")) { closeAdjust.click(); } });
let visionFrameId = 0;
let visionLoopStarted = false;
/**
 * Lightweight presentation/diagnostics loop. Heavy detection and processing
 * are cadence-limited elsewhere so the camera interaction remains responsive.
 */
function requestVisionFrame(now = performance.now()) { if (!visionLoopStarted) return; diagnostics.frame(); if (workspaceImage && !document.hidden && camera.srcObject) adaptiveOpacity.update(camera, now); diagnostics.render({ appState: appStateMachine.state, tracking: surfaceTracker.state.confidence, camera: camera.videoWidth ? `${camera.videoWidth}×${camera.videoHeight}` : "—", quality: perspectiveActive ? "perspective" : "high", trace: diagnosticsInput?.checked ? traceEngine.diagnostics() : null, ...latestSurfaceDiagnostics }); visionFrameId = requestAnimationFrame(requestVisionFrame); }
function startVisionLoop() { if (visionLoopStarted || document.hidden) return; visionLoopStarted = true; visionFrameId = requestAnimationFrame(requestVisionFrame); }
function stopVisionLoop() { visionLoopStarted = false; if (visionFrameId) cancelAnimationFrame(visionFrameId); visionFrameId = 0; }
function updateViewportHeight() { if (pointers.size) releaseGhostInteraction({ restore: true }); if (compareSplitPointerId !== null) releaseCompareInteraction({ restore: true }); if (ghostBrushPointerActive) { ghostBrushPointerRect = stage?.getBoundingClientRect() || null; } const height = globalThis.visualViewport?.height || window.innerHeight; document.documentElement.style.setProperty("--app-viewport-height", `${Math.max(0, Math.round(height))}px`); const key = `${window.innerWidth}x${Math.round(height)}:${window.screen?.orientation?.type || "unknown"}`; if (key !== lastDiagnosticViewportKey) { lastDiagnosticViewportKey = key; recordBetaEvent("viewport-change", { width: window.innerWidth, height, orientation: window.screen?.orientation?.type }); } renderRegionOverlay(); renderGhostCompare(); renderGhostBrush(); }
const viewportCoordinator = createViewportCoordinator({ onUpdate: updateViewportHeight });
viewportCoordinator.schedule();
window.addEventListener("resize", () => viewportCoordinator.schedule(), { passive: true }); window.visualViewport?.addEventListener("resize", () => viewportCoordinator.schedule(), { passive: true }); window.visualViewport?.addEventListener("scroll", () => viewportCoordinator.schedule(), { passive: true }); window.addEventListener("orientationchange", () => viewportCoordinator.schedule(), { passive: true }); window.screen?.orientation?.addEventListener?.("change", () => viewportCoordinator.schedule(), { passive: true });

function initializeCoreUI() {
  const required = { stage, camera, overlay, cameraState, status, imageInput, dockImageInput, cameraButton };
  const missing = Object.entries(required).filter(([, element]) => !element).map(([name]) => name);
  if (missing.length) throw new Error(`TraceLens core UI missing: ${missing.join(", ")}`);
  if (gestureHint) gestureHint.hidden = true;
  organizeTraceControls();
  bindSheetDrag();
  renderOverlay();
  updateContext();
  transitionAppState("Home", "core UI ready");
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
  recordBetaEvent("boot", { visibility: document.visibilityState });
  bindEventListeners();
  initializeCoreUI();
  bindBetaDiagnostics();
  initializeImageImport();
    initializeCamera();
  initializeOptionalSystems();
  registerPWA({ onUpdate: update => { recordBetaEvent("service-worker-update", {}); pendingPWAUpdate = update; if (updateAction) updateAction.hidden = false; status.textContent = "Update available. Apply it when ready."; } }).then(registration => { recordBetaEvent("service-worker-registration", { supported: Boolean(registration) }); });
  startVisionLoop();
} catch (error) {
  console.error("[TraceLens core] initialization failed", error);
  if (status) status.textContent = "TraceLens could not initialize. Refresh and try again.";
}
