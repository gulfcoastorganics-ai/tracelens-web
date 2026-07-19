import { VisionUtils } from "./vision-utils.js";
import { SurfaceDetector } from "./surface-detector.js";
import { PerspectiveSolver, OverlaySnapController } from "./perspective.js";
import { AdaptiveOpacityController } from "./adaptive-opacity.js";

const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
const perspectiveOverlay = document.querySelector("#perspectiveOverlay");
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
const adaptiveOpacity = new AdaptiveOpacityController({ analyzer: vision, onOpacity: (value, metrics) => { opacity = value; opacityInput.value = value; renderOverlay(); perspectiveOverlay.style.opacity = value; } });
const surfaceDetector = new SurfaceDetector({ onUpdate: result => {
  if (!workspaceImage || perspectiveActive) return;
  if (result.found) { visionStatus.textContent = `Surface Detected · ${result.confidence}% confidence`; selectionFrame.classList.add("surface-found"); selectionFrame.style.clipPath = `polygon(${result.quad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; }
  else { selectionFrame.classList.remove("surface-found"); if (autoPerspectiveButton.classList.contains("active")) visionStatus.textContent = "Tracking Lost · Tap to reacquire"; }
} });

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
}

function showOverlayTools() {
  overlayTools.forEach(tool => tool.classList.add("available"));
}

function saveWorkspace() {
  if (!workspaceImage) {
    status.textContent = "Import an image before saving a workspace.";
    return;
  }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ image: workspaceImage, x, y, scale, rotation, opacity, flipped }));
  workspaceButton.classList.add("saved");
  status.textContent = "Workspace saved on this device.";
  window.setTimeout(() => workspaceButton.classList.remove("saved"), 900);
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
    status.textContent = "Saved workspace restored."; renderOverlay();
    surfaceDetector.start(camera);
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
    surfaceDetector.start(camera);
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
    gestureHint.hidden = false;
    status.textContent = "Overlay loaded. Drag, pinch, or rotate to position it.";
    surfaceDetector.start(camera);
  };
  reader.onerror = () => { status.textContent = "Could not read that image."; };
  reader.readAsDataURL(file);
}

imageInput.addEventListener("change", event => loadImage(event.target.files?.[0]));
dockImageInput.addEventListener("change", event => loadImage(event.target.files?.[0]));
opacityInput.addEventListener("input", event => { opacity = Number(event.target.value); renderOverlay(); });
scaleInput.addEventListener("input", event => { scale = Number(event.target.value); renderOverlay(); });
rotationInput.addEventListener("input", event => { rotation = Number(event.target.value); renderOverlay(); });
cameraButton.addEventListener("click", startCamera);
gridButton.addEventListener("click", () => { grid.classList.toggle("visible"); gridButton.classList.toggle("active"); });
flipButton.addEventListener("click", () => { flipped = !flipped; flipButton.classList.toggle("active", flipped); renderOverlay(); });
adjustButton.addEventListener("click", () => { adjustSheet.classList.toggle("open"); adjustSheet.setAttribute("aria-hidden", !adjustSheet.classList.contains("open")); });
workspaceButton.addEventListener("click", saveWorkspace);
autoOpacityInput.addEventListener("change", event => { adaptiveOpacity.setEnabled(event.target.checked); if (event.target.checked) status.textContent = "Auto Opacity active."; });
autoPerspectiveButton.addEventListener("click", () => {
  autoPerspectiveButton.classList.add("active");
  const result = surfaceDetector.lastResult;
  if (!result?.found || !workspaceImage) { visionStatus.textContent = "Scanning Surface..."; surfaceDetector.start(camera); return; }
  const quad = perspectiveSolver.toPixels(result.quad, stage.clientWidth, stage.clientHeight);
  snapController.snap(workspaceImage, quad, stage.clientWidth, stage.clientHeight, opacity);
  activePerspectiveQuad = result.quad.map(point => ({ ...point })); perspectiveActive = true; overlay.style.display = "none"; selectionFrame.classList.add("surface-found"); selectionFrame.style.clipPath = `polygon(${result.quad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; status.textContent = "Perspective Locked."; visionStatus.textContent = `Surface Locked · ${result.confidence}% confidence`;
});
closeAdjust.addEventListener("click", () => { adjustSheet.classList.remove("open"); adjustSheet.setAttribute("aria-hidden", "true"); });
layerVisibility.addEventListener("click", () => { overlay.hidden = !overlay.hidden; layerVisibility.textContent = overlay.hidden ? "⊘" : "◉"; });
layerLock.addEventListener("click", () => { stage.classList.toggle("locked"); layerLock.textContent = stage.classList.contains("locked") ? "♙" : "♧"; });
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
  if (perspectiveActive && handle) { perspectiveDragIndex = [...selectionFrame.querySelectorAll("i")].indexOf(handle); stage.setPointerCapture(event.pointerId); return; }
  if (perspectiveActive) { snapController.clear(); perspectiveActive = false; overlay.style.display = "block"; autoPerspectiveButton.classList.remove("active"); selectionFrame.classList.remove("surface-found"); selectionFrame.style.clipPath = "none"; status.textContent = "Manual alignment resumed."; }
  pointers.set(event.pointerId, event); stage.setPointerCapture(event.pointerId);
  if (pointers.size === 1) { dragging = true; pointerStartX = event.clientX; pointerStartY = event.clientY; originX = x; originY = y; }
  if (pointers.size === 2) { dragging = false; const [a, b] = [...pointers.values()]; gestureStart = { distance: distance(a,b), angle: angle(a,b), scale, rotation }; }
});
stage.addEventListener("pointermove", event => {
  if (perspectiveActive && perspectiveDragIndex !== null && activePerspectiveQuad) { activePerspectiveQuad[perspectiveDragIndex] = { x: Math.max(0, Math.min(1, event.offsetX / stage.clientWidth)), y: Math.max(0, Math.min(1, event.offsetY / stage.clientHeight)) }; const pixels = perspectiveSolver.toPixels(activePerspectiveQuad, stage.clientWidth, stage.clientHeight); snapController.snap(workspaceImage, pixels, stage.clientWidth, stage.clientHeight, opacity); selectionFrame.style.clipPath = `polygon(${activePerspectiveQuad.map(point => `${point.x * 100}% ${point.y * 100}%`).join(",")})`; return; }
  if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, event);
  if (pointers.size === 2 && gestureStart) { const [a,b] = [...pointers.values()]; scale = Math.max(.25, Math.min(3, gestureStart.scale * distance(a,b) / gestureStart.distance)); const rawRotation = gestureStart.rotation + angle(a,b) - gestureStart.angle; rotation = Math.round(rawRotation / 15) * 15; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); return; }
  if (dragging) { x = originX + event.clientX - pointerStartX; y = originY + event.clientY - pointerStartY; renderOverlay(); }
});
function endPointer(event) { perspectiveDragIndex = null; pointers.delete(event.pointerId); if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (pointers.size < 2) gestureStart = null; dragging = pointers.size === 1; }
stage.addEventListener("pointerup", endPointer); stage.addEventListener("pointercancel", endPointer);
function requestVisionFrame(now = performance.now()) { adaptiveOpacity.update(camera, now); requestAnimationFrame(requestVisionFrame); }
gestureHint.hidden = true; renderOverlay(); startCamera(); restoreWorkspace(); requestVisionFrame();
