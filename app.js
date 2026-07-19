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
import { createProjectBundle, validateProjectBundle, downloadProjectBundle } from "./project-bundles.js";
import { CalibrationProfiles } from "./calibration-profiles.js";
import { SessionTimeline } from "./session-timeline.js";

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
const loadProjectButton = document.querySelector("#loadProjectButton");
const deleteProjectButton = document.querySelector("#deleteProjectButton");
const exportProjectButton = document.querySelector("#exportProjectButton");
const importProjectInput = document.querySelector("#importProjectInput");
const profileInput = document.querySelector("#profileInput");
const saveProfileButton = document.querySelector("#saveProfileButton");
const timelineOutput = document.querySelector("#timelineOutput");
const grid = document.querySelector("#grid");
const emptyState = document.querySelector("#emptyState");
const layerCard = document.querySelector("#layerCard");
const layerThumb = document.querySelector("#layerThumb");
const layerName = document.querySelector("#layerName");
const layerVisibility = document.querySelector("#layerVisibility");
const layerLock = document.querySelector("#layerLock");
const selectionFrame = document.querySelector("#selectionFrame");
const gestureHint = document.querySelector("#gestureHint");
const zoomReadout = document.querySelector("#zoomReadout");
const rotationReadout = document.querySelector("#rotationReadout");
const opacityOutput = document.querySelector("#opacityOutput");
const opacityValue = document.querySelector("#opacityValue");
const scaleOutput = document.querySelector("#scaleOutput");
const rotationOutput = document.querySelector("#rotationOutput");
const status = document.querySelector("#status");

let x = 0, y = 0, scale = 1, rotation = 0, opacity = 0.55, flipped = false, stream = null;
let pointers = new Map(), gestureStart = null, dragging = false, pointerStartX = 0, pointerStartY = 0, originX = 0, originY = 0;
const overlayTools = document.querySelectorAll(".overlay-tool");
const WORKSPACE_KEY = "tracelens-workspace-v1";
let workspaceImage = null;
let comparing = false;
let perspectiveActive = false;
let activePerspectiveQuad = null;
let perspectiveDragIndex = null;
const vision = new VisionUtils();
const perspectiveSolver = new PerspectiveSolver();
const snapController = new OverlaySnapController(perspectiveOverlay);
const projectLibrary = new ProjectLibrary();
const history = new HistoryStack();
const locks = new TransformLocks();
const guides = new MeasurementGuides(measurementGuides);
const diagnostics = new Diagnostics(diagnosticsOutput);
const calibrationProfiles = new CalibrationProfiles();
const timeline = new SessionTimeline();
const adaptiveOpacity = new AdaptiveOpacityController({ analyzer: vision, onOpacity: (value, metrics) => { opacity = value; opacityInput.value = value; renderOverlay(); perspectiveOverlay.style.opacity = value; } });
const surfaceTracker = new SurfaceTracker({ onUpdate: result => {
  if (!workspaceImage) return;
  const stateLabel = result.state === "tracking" ? "Stable" : result.state === "weak" ? "Weak" : result.state === "lost" ? "Lost · Hold device steady" : "Searching";
  visionStatus.textContent = `${result.state === "tracking" ? "Tracking" : stateLabel} · ${result.confidence}% · ${stateLabel}`;
  if (result.found && result.quad) {
    selectionFrame.classList.add("surface-found"); selectionFrame.style.clipPath = `polygon(${result.quad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`;
    if (perspectiveActive && !locks.perspective) { activePerspectiveQuad = result.quad.map(point => ({ ...point })); snapController.snap(workspaceImage, perspectiveSolver.toPixels(result.quad, stage.clientWidth, stage.clientHeight), stage.clientWidth, stage.clientHeight, opacity); }
  } else if (result.state === "lost") selectionFrame.classList.remove("surface-found");
});

function renderOverlay() {
  const flip = flipped ? -1 : 1;
  overlay.style.opacity = opacity;
  overlay.style.transform = `translate(${x}px, ${y}px) scale(${scale * flip}, ${scale}) rotate(${rotation}deg)`;
  opacityOutput.textContent = `${Math.round(opacity * 100)}%`;
  opacityValue.textContent = `${Math.round(opacity * 100)}%`;
  scaleOutput.textContent = `${Math.round(scale * 100)}%`;
  rotationOutput.textContent = `${rotation}°`;
  zoomReadout.textContent = `Zoom ${scale.toFixed(2)}×`;
  rotationReadout.textContent = `${rotation}°`;
  if (perspectiveOverlay && !perspectiveOverlay.hidden) perspectiveOverlay.style.opacity = opacity;
  applyBlendMode(overlay, blendModeInput.value);
  applyBlendMode(perspectiveOverlay, blendModeInput.value);
}

function captureState() { return { x, y, scale, rotation, opacity, flipped, blendMode: blendModeInput.value, guide: guideInput.value }; }
function applyState(next) {
  if (!next) return;
  x = Number(next.x) || 0; y = Number(next.y) || 0; scale = Number(next.scale) || 1; rotation = Number(next.rotation) || 0; opacity = Number(next.opacity) || .55; flipped = Boolean(next.flipped);
  blendModeInput.value = next.blendMode || "Normal"; guideInput.value = next.guide || "none"; guides.setMode(guideInput.value);
  opacityInput.value = opacity; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay();
}
function pushHistory() { if (workspaceImage) history.push(captureState()); }
function addTimeline(type, detail = "") { timeline.add(type, detail); const latest = timeline.latest(); timelineOutput.textContent = latest ? `${latest.type}${latest.detail ? ` · ${latest.detail}` : ""}` : "Session ready."; }
function applyLocks(saved = {}) { Object.keys(locks).forEach(key => { if (typeof locks[key] === "boolean") locks[key] = Boolean(saved[key]); const input = document.querySelector(`[data-lock="${key}"]`); if (input) input.checked = locks[key]; }); stage.classList.toggle("locked", locks.position); layerLock.textContent = locks.position ? "♙" : "♧"; }
function applyProject(project) {
  if (!project?.image) return;
  workspaceImage = project.image; overlay.src = workspaceImage; layerThumb.src = workspaceImage; layerName.textContent = project.name || "Reference image"; projectNameInput.value = project.name || "Untitled project"; overlay.style.display = "block"; overlay.hidden = false; emptyState.style.display = "none"; layerCard.hidden = false; selectionFrame.classList.add("visible"); showOverlayTools();
  if (project.preset) { presetInput.value = project.preset; applyPreset(project.preset, false); } applyState(project); applyLocks(project.locks); pushHistory(); surfaceTracker.start(camera);
}
async function refreshProjectList() { try { const projects = await projectLibrary.all(); projectList.replaceChildren(new Option("Projects", ""), ...projects.map(project => new Option(`${project.name} · ${new Date(project.updatedAt).toLocaleDateString()}`, project.id))); } catch (error) { console.warn("Could not list projects", error); } }
function applyPreset(name, announce = true) { const preset = getWorkflowPreset(name); opacity = preset.opacity; opacityInput.value = opacity; blendModeInput.value = preset.blendMode; guideInput.value = preset.guide; guides.setMode(preset.guide); grid.style.backgroundSize = `${100 / preset.gridSpacing}% ${100 / preset.gridSpacing}%`; surfaceTracker.state.weakAt = preset.tracking.weakAt; surfaceTracker.state.lostAt = preset.tracking.lostAt; renderOverlay(); if (announce) { status.textContent = `${name} workspace active.`; addTimeline("Preset", name); } }

function showOverlayTools() {
  overlayTools.forEach(tool => tool.classList.add("available"));
}

function saveWorkspace() {
  if (!workspaceImage) {
    status.textContent = "Import an image before saving a workspace.";
    return;
  }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ image: workspaceImage, ...captureState() }));
  workspaceButton.classList.add("saved");
  status.textContent = "Workspace saved on this device.";
  window.setTimeout(() => workspaceButton.classList.remove("saved"), 900);
}

async function saveProject() {
  if (!workspaceImage) { status.textContent = "Import an image before saving a project."; return; }
  const name = projectNameInput.value.trim() || "Untitled project";
  await projectLibrary.put({ id: `${name}-${Date.now()}`, name, image: workspaceImage, preset: presetInput.value, perspective: activePerspectiveQuad, ...captureState(), locks: { ...locks }, updatedAt: Date.now(), thumbnail: workspaceImage });
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
    workspaceImage = saved.image;
    x = Number(saved.x) || 0; y = Number(saved.y) || 0; scale = Number(saved.scale) || 1;
    rotation = Number(saved.rotation) || 0; opacity = Number(saved.opacity) || .55; flipped = Boolean(saved.flipped);
    overlay.src = workspaceImage; layerThumb.src = workspaceImage; layerName.textContent = "Saved workspace";
    overlay.style.display = "block"; emptyState.style.display = "none"; layerCard.hidden = false; selectionFrame.classList.add("visible");
    showOverlayTools(); opacityInput.value = opacity; scaleInput.value = scale; rotationInput.value = rotation;
    applyState(saved); status.textContent = "Saved workspace restored.";
    addTimeline("Restored", "Workspace");
    pushHistory();
    surfaceTracker.start(camera);
  } catch (error) { console.warn("Could not restore workspace", error); }
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported.");
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    camera.srcObject = stream;
    cameraState.textContent = "CAMERA ACTIVE";
    status.textContent = "Camera active.";
    surfaceTracker.start(camera);
  } catch (error) {
    cameraState.textContent = "CAMERA UNAVAILABLE";
    status.textContent = "Camera blocked. Allow access from the secure link.";
    console.error(error);
  }
}

function loadImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    snapController.clear();
    perspectiveActive = false;
    overlay.src = reader.result;
    workspaceImage = reader.result;
    layerThumb.src = reader.result;
    layerName.textContent = file.name.replace(/\.[^/.]+$/, "");
    overlay.style.display = "block";
    overlay.hidden = false;
    layerVisibility.textContent = "◉";
    emptyState.style.display = "none";
    layerCard.hidden = false;
    selectionFrame.classList.add("visible");
    showOverlayTools();
    pushHistory();
    gestureHint.hidden = false;
    addTimeline("Imported", file.name);
    status.textContent = "Overlay loaded. Drag, pinch, or rotate to position it.";
    surfaceTracker.start(camera);
  };
  reader.onerror = () => { status.textContent = "Could not read that image."; };
  reader.readAsDataURL(file);
}

imageInput.addEventListener("change", event => loadImage(event.target.files?.[0]));
dockImageInput.addEventListener("change", event => loadImage(event.target.files?.[0]));
opacityInput.addEventListener("input", event => { opacity = Number(event.target.value); renderOverlay(); });
scaleInput.addEventListener("input", event => { if (!locks.canEdit("scale")) return; scale = Number(event.target.value); renderOverlay(); });
rotationInput.addEventListener("input", event => { if (!locks.canEdit("rotation")) return; rotation = Number(event.target.value); renderOverlay(); });
cameraButton.addEventListener("click", startCamera);
gridButton.addEventListener("click", () => { grid.classList.toggle("visible"); gridButton.classList.toggle("active"); });
flipButton.addEventListener("click", () => { flipped = !flipped; flipButton.classList.toggle("active", flipped); renderOverlay(); });
adjustButton.addEventListener("click", () => { adjustSheet.classList.toggle("open"); adjustSheet.setAttribute("aria-hidden", !adjustSheet.classList.contains("open")); });
workspaceButton.addEventListener("click", saveWorkspace);
presetInput.addEventListener("change", event => applyPreset(event.target.value));
saveProjectButton.addEventListener("click", () => { saveProject().catch(error => { status.textContent = "Project storage unavailable."; console.warn(error); }); });
loadProjectButton.addEventListener("click", async () => { const project = await projectLibrary.get(projectList.value); if (project) { applyProject(project); addTimeline("Loaded", project.name); status.textContent = `Project “${project.name}” loaded.`; } });
deleteProjectButton.addEventListener("click", async () => { if (!projectList.value) return; await projectLibrary.remove(projectList.value); await refreshProjectList(); status.textContent = "Project archived from this device."; });
exportProjectButton.addEventListener("click", async () => { if (!projectList.value) { status.textContent = "Select a project to export."; return; } const project = await projectLibrary.get(projectList.value); if (project) { downloadProjectBundle(createProjectBundle(project), `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`); addTimeline("Exported", project.name); } });
importProjectInput.addEventListener("change", event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const bundle = JSON.parse(reader.result); if (!validateProjectBundle(bundle)) throw new Error("Unsupported project bundle"); const project = { ...bundle.project, id: `${bundle.project.name || "Imported project"}-${Date.now()}`, updatedAt: Date.now() }; await projectLibrary.put(project); applyProject(project); await refreshProjectList(); addTimeline("Imported", project.name); status.textContent = `Project “${project.name}” imported.`; } catch (error) { status.textContent = "That project bundle is not compatible."; console.warn(error); } }; reader.readAsText(file); });
saveProfileButton.addEventListener("click", () => { calibrationProfiles.save(profileInput.value, { preset: presetInput.value, perspective: activePerspectiveQuad, state: captureState(), locks: { ...locks } }); status.textContent = `Calibration “${profileInput.value}” saved.`; });
undoButton.addEventListener("click", () => { const state = history.undo(); if (state) { applyState(state); status.textContent = "Undo applied."; } });
redoButton.addEventListener("click", () => { const state = history.redo(); if (state) { applyState(state); status.textContent = "Redo applied."; } });
blendModeInput.addEventListener("change", () => { renderOverlay(); pushHistory(); });
guideInput.addEventListener("change", event => { guides.setMode(event.target.value); pushHistory(); });
diagnosticsInput.addEventListener("change", event => { diagnosticsOutput.hidden = !event.target.checked; });
document.querySelectorAll("[data-lock]").forEach(input => input.addEventListener("change", event => { locks.toggle(event.target.dataset.lock); status.textContent = `${event.target.dataset.lock} ${event.target.checked ? "locked" : "unlocked"}.`; }));
autoOpacityInput.addEventListener("change", event => { adaptiveOpacity.setEnabled(event.target.checked); if (event.target.checked) status.textContent = "Auto Opacity active."; });
autoPerspectiveButton.addEventListener("click", () => {
  autoPerspectiveButton.classList.add("active");
  const result = surfaceTracker.lastResult;
  if (!result?.found || !workspaceImage) { visionStatus.textContent = "Scanning Surface..."; surfaceTracker.start(camera); return; }
  const quad = perspectiveSolver.toPixels(result.quad, stage.clientWidth, stage.clientHeight);
  snapController.snap(workspaceImage, quad, stage.clientWidth, stage.clientHeight, opacity);
  activePerspectiveQuad = result.quad.map(point => ({ ...point })); perspectiveActive = true; surfaceTracker.lock(); overlay.style.display = "none"; selectionFrame.classList.add("surface-found"); selectionFrame.style.clipPath = `polygon(${result.quad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; status.textContent = "Perspective Locked."; visionStatus.textContent = `Tracking · ${result.confidence}% · Stable`; addTimeline("Perspective Locked");
});
closeAdjust.addEventListener("click", () => { adjustSheet.classList.remove("open"); adjustSheet.setAttribute("aria-hidden", "true"); });
layerVisibility.addEventListener("click", () => { overlay.hidden = !overlay.hidden; layerVisibility.textContent = overlay.hidden ? "⊘" : "◉"; });
layerLock.addEventListener("click", () => { locks.toggle("position"); stage.classList.toggle("locked", locks.position); layerLock.textContent = locks.position ? "♙" : "♧"; });
resetButton.addEventListener("click", () => { x = 0; y = 0; scale = 1; rotation = 0; opacity = 0.55; flipped = false; opacityInput.value = opacity; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); flipButton.classList.remove("active"); status.textContent = "Overlay position reset."; });

function setComparing(next) {
  comparing = next;
  overlay.classList.toggle("comparison-hidden", comparing);
  perspectiveOverlay.classList.toggle("comparison-hidden", comparing);
  compareButton.classList.toggle("active", comparing);
  if (comparing) status.textContent = "Before view · release to restore overlay.";
}
compareButton.addEventListener("pointerdown", event => { event.preventDefault(); setComparing(true); compareButton.setPointerCapture(event.pointerId); });
compareButton.addEventListener("pointerup", () => setComparing(false));
compareButton.addEventListener("pointercancel", () => setComparing(false));
compareButton.addEventListener("pointerleave", () => { if (comparing) setComparing(false); });

function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function angle(a, b) { return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180 / Math.PI; }
stage.addEventListener("pointerdown", event => {
  if (!overlay.src || stage.classList.contains("locked")) return;
  const handle = event.target.closest?.(".selection-frame i");
  if (perspectiveActive && handle && locks.canEdit("perspective")) { perspectiveDragIndex = [...selectionFrame.querySelectorAll("i")].indexOf(handle); stage.setPointerCapture(event.pointerId); return; }
  if (!locks.canEdit("position")) return;
  if (perspectiveActive && locks.canEdit("perspective")) { snapController.clear(); perspectiveActive = false; surfaceTracker.unlock(); overlay.style.display = "block"; autoPerspectiveButton.classList.remove("active"); selectionFrame.classList.remove("surface-found"); selectionFrame.style.clipPath = "none"; status.textContent = "Manual alignment resumed."; }
  pointers.set(event.pointerId, event); stage.setPointerCapture(event.pointerId);
  if (pointers.size === 1) { dragging = true; pointerStartX = event.clientX; pointerStartY = event.clientY; originX = x; originY = y; }
  if (pointers.size === 2) { dragging = false; const [a, b] = [...pointers.values()]; gestureStart = { distance: distance(a,b), angle: angle(a,b), scale, rotation }; }
});
stage.addEventListener("pointermove", event => {
  if (perspectiveActive && perspectiveDragIndex !== null && activePerspectiveQuad) { activePerspectiveQuad[perspectiveDragIndex] = { x: Math.max(0, Math.min(1, event.offsetX / stage.clientWidth)), y: Math.max(0, Math.min(1, event.offsetY / stage.clientHeight)) }; const pixels = perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight); snapController.snap(workspaceImage, pixels, stage.clientWidth, stage.clientHeight, opacity); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; return; }
  if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, event);
  if (pointers.size === 2 && gestureStart) { const [a,b] = [...pointers.values()]; if (locks.canEdit("scale")) scale = Math.max(.25, Math.min(3, gestureStart.scale * distance(a,b) / gestureStart.distance)); if (locks.canEdit("rotation")) { const rawRotation = gestureStart.rotation + angle(a,b) - gestureStart.angle; rotation = Math.round(rawRotation / 15) * 15; } scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); return; }
  if (dragging) { x = originX + event.clientX - pointerStartX; y = originY + event.clientY - pointerStartY; renderOverlay(); }
});
function endPointer(event) { perspectiveDragIndex = null; pointers.delete(event.pointerId); if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (pointers.size < 2) gestureStart = null; dragging = pointers.size === 1; }
stage.addEventListener("pointerup", endPointer); stage.addEventListener("pointercancel", endPointer);
function requestVisionFrame(now = performance.now()) { diagnostics.frame(); adaptiveOpacity.update(camera, now); diagnostics.render({ tracking: surfaceTracker.state.confidence, camera: camera.videoWidth ? `${camera.videoWidth}×${camera.videoHeight}` : "—", quality: perspectiveActive ? "perspective" : "high" }); requestAnimationFrame(requestVisionFrame); }
profileInput.replaceChildren(...calibrationProfiles.names().map(name => new Option(name, name)));
applyPreset(presetInput.value, false);
refreshProjectList();
gestureHint.hidden = true; renderOverlay(); startCamera(); restoreWorkspace(); restoreLatestProject(); requestVisionFrame();
