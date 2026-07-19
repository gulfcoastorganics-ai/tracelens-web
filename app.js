const camera = document.querySelector("#camera");
const overlay = document.querySelector("#overlay");
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
const closeAdjust = document.querySelector("#closeAdjust");
const adjustSheet = document.querySelector("#adjustSheet");
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
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported.");
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    camera.srcObject = stream;
    cameraState.textContent = "CAMERA ACTIVE";
    status.textContent = "Camera active.";
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
    overlay.src = reader.result;
    layerThumb.src = reader.result;
    layerName.textContent = file.name.replace(/\.[^/.]+$/, "");
    overlay.style.display = "block";
    overlay.hidden = false;
    layerVisibility.textContent = "◉";
    emptyState.style.display = "none";
    layerCard.hidden = false;
    selectionFrame.classList.add("visible");
    overlayTools.forEach(tool => tool.classList.add("available"));
    gestureHint.hidden = false;
    status.textContent = "Overlay loaded. Drag, pinch, or rotate to position it.";
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
closeAdjust.addEventListener("click", () => { adjustSheet.classList.remove("open"); adjustSheet.setAttribute("aria-hidden", "true"); });
layerVisibility.addEventListener("click", () => { overlay.hidden = !overlay.hidden; layerVisibility.textContent = overlay.hidden ? "⊘" : "◉"; });
layerLock.addEventListener("click", () => { stage.classList.toggle("locked"); layerLock.textContent = stage.classList.contains("locked") ? "♙" : "♧"; });
resetButton.addEventListener("click", () => { x = 0; y = 0; scale = 1; rotation = 0; opacity = 0.55; flipped = false; opacityInput.value = opacity; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); flipButton.classList.remove("active"); status.textContent = "Overlay position reset."; });

function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
function angle(a, b) { return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180 / Math.PI; }
stage.addEventListener("pointerdown", event => {
  if (!overlay.src || stage.classList.contains("locked")) return;
  pointers.set(event.pointerId, event); stage.setPointerCapture(event.pointerId);
  if (pointers.size === 1) { dragging = true; pointerStartX = event.clientX; pointerStartY = event.clientY; originX = x; originY = y; }
  if (pointers.size === 2) { dragging = false; const [a, b] = [...pointers.values()]; gestureStart = { distance: distance(a,b), angle: angle(a,b), scale, rotation }; }
});
stage.addEventListener("pointermove", event => {
  if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, event);
  if (pointers.size === 2 && gestureStart) { const [a,b] = [...pointers.values()]; scale = Math.max(.25, Math.min(3, gestureStart.scale * distance(a,b) / gestureStart.distance)); const rawRotation = gestureStart.rotation + angle(a,b) - gestureStart.angle; rotation = Math.round(rawRotation / 15) * 15; scaleInput.value = scale; rotationInput.value = rotation; renderOverlay(); return; }
  if (dragging) { x = originX + event.clientX - pointerStartX; y = originY + event.clientY - pointerStartY; renderOverlay(); }
});
function endPointer(event) { pointers.delete(event.pointerId); if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (pointers.size < 2) gestureStart = null; dragging = pointers.size === 1; }
stage.addEventListener("pointerup", endPointer); stage.addEventListener("pointercancel", endPointer);
gestureHint.hidden = true; renderOverlay(); startCamera();
